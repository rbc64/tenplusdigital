#!/usr/bin/env python3
"""
Tenplus Digital — portfolio processor.

Takes every image in portfolio/uploads/, works out its title and date from the
file name (e.g. "WIFE_-A-Nov-06.png" -> "Wife", variant A, 6 November), converts
it to a fast-loading WebP (full size + small thumbnail), stores it under
portfolio/images/<year>/, adds it to portfolio/manifest.json and removes the
original from uploads.

Year: taken from the file name if it contains one ("...-Jan-01-2025.png"),
otherwise the year the file was uploaded (today, UTC).

Run by the GitHub Action on every push; can also be run locally:
    python tools/process_uploads.py [--year 2026] [--src some/folder] [--keep]
"""
import argparse, datetime as dt, json, os, re, sys
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
PORT = ROOT / "portfolio"
UPLOADS = PORT / "uploads"
IMAGES = PORT / "images"
MANIFEST = PORT / "manifest.json"

FULL_W, THUMB_W = 1280, 480
EXTS = {".png", ".jpg", ".jpeg", ".webp"}
MONTHS = {"jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6, "jul": 7,
          "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12}
DATE_RE = re.compile(r"(?i)(?<![a-z])(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[-_ .]?(\d{1,2})(?!\d)(?:[-_ .]?((?:19|20)\d{2}))?")
YEAR_RE = re.compile(r"(?<!\d)((?:19|20)\d{2})(?!\d)")


def nice_title(raw: str) -> str:
    words = [w for w in re.split(r"[-_\s]+", raw) if w]
    out = []
    for w in words:
        w = w.replace("’", "'")
        out.append(w if (w.isupper() and len(w) <= 3) else (w[:1].upper() + w[1:].lower()))
    return " ".join(out).strip()


def parse_name(stem: str, upload_year: int, today: dt.date):
    matches = list(DATE_RE.finditer(stem))
    variant, alt = "", False
    if matches:
        m = matches[-1]
        month, day = MONTHS[m.group(1).lower()[:3]], int(m.group(2))
        year = int(m.group(3)) if m.group(3) else None
        before, after = stem[:m.start()], stem[m.end():]
    else:
        month, day, year = today.month, today.day, None
        before, after = stem, ""
    if year is None:
        ym = YEAR_RE.search(stem)
        year = int(ym.group(1)) if ym else upload_year
    if not (1 <= day <= 31):
        day = 1
    tokens = [t for t in re.split(r"[-_\s]+", before) if t]
    if len(tokens) > 1 and re.fullmatch(r"[A-Za-z]\d?", tokens[-1]):
        variant = tokens.pop().upper()
    if re.search(r"(?i)alt", after):
        alt = True
    title = nice_title(" ".join(tokens)) or nice_title(stem)
    if variant and alt:
        variant += " (alt)"
    elif alt:
        variant = "alt"
    return title, variant, year, month, day


def slugify(stem: str) -> str:
    s = stem.replace("’", "").replace("'", "")
    s = re.sub(r"[^A-Za-z0-9]+", "-", s).strip("-")
    return s or "image"


def save_webp(img: Image.Image, width: int, path: Path, quality: int):
    im = img
    if im.width > width:
        im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    path.parent.mkdir(parents=True, exist_ok=True)
    im.save(path, "WEBP", quality=quality, method=6)
    return im.size


def load_manifest():
    if MANIFEST.exists():
        return json.loads(MANIFEST.read_text(encoding="utf-8"))
    return {"items": []}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", default=str(UPLOADS), help="folder to import from")
    ap.add_argument("--year", type=int, help="year for files whose name has no year (default: this year)")
    ap.add_argument("--keep", action="store_true", help="don't delete the originals")
    args = ap.parse_args()

    today = dt.datetime.now(dt.timezone.utc).date()
    upload_year = args.year or today.year
    src = Path(args.src)
    files = sorted(p for p in src.iterdir() if p.is_file() and p.suffix.lower() in EXTS) if src.exists() else []
    if not files:
        print("No new images to process.")
        return 0

    data = load_manifest()
    items = data["items"]
    used = {i["id"] for i in items}
    now = dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")
    added = 0
    for f in files:
        title, variant, year, month, day = parse_name(f.stem, upload_year, today)
        base = slugify(f.stem)
        slug, n = base, 2
        while f"{year}/{slug}" in used:
            slug = f"{base}-{n}"; n += 1
        try:
            with Image.open(f) as im:
                im = im.convert("RGB")
                w, h = save_webp(im, FULL_W, IMAGES / str(year) / f"{slug}.webp", 82)
                save_webp(im, THUMB_W, IMAGES / str(year) / "thumbs" / f"{slug}.webp", 74)
        except Exception as e:  # unreadable file: leave it and report
            print(f"!! Skipped {f.name}: {e}")
            continue
        items.append({
            "id": f"{year}/{slug}", "title": title, "variant": variant,
            "year": year, "month": month, "day": day,
            "src": f"images/{year}/{slug}.webp", "thumb": f"images/{year}/thumbs/{slug}.webp",
            "w": w, "h": h, "added": now, "original": f.name,
        })
        used.add(f"{year}/{slug}")
        added += 1
        if not args.keep:
            f.unlink()
        print(f"+ {f.name} -> {year}/{slug} ({title}{' ' + variant if variant else ''}, {day}/{month})")

    # newest first; within a day keep sets together in A, B, C order
    items.sort(key=lambda i: (i["title"].lower(), i["variant"]))
    items.sort(key=lambda i: (i["year"], i["month"], i["day"]), reverse=True)
    data["items"] = items
    data["count"] = len(items)
    data["updated"] = now
    MANIFEST.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"Done: {added} added, {len(items)} in portfolio.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
