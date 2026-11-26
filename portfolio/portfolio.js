// Tenplus Digital — portfolio page (reads manifest.json, built automatically from uploads)
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const PAGE = 48;
const $ = (id) => document.getElementById(id);
let all = [], view = [], shown = 0, year = 'all', month = 'all', lbIndex = -1;

const label = (it) => it.title + (it.variant ? ' — ' + it.variant : '');
const dateStr = (it) => `${it.day} ${MONTHS[it.month - 1]} ${it.year}`;

function pill(text, count, on, onClick) {
  const b = document.createElement('button');
  b.className = 'pill-btn' + (on ? ' on' : '');
  b.innerHTML = `${text}<small>${count}</small>`;
  b.onclick = onClick;
  return b;
}

function renderFilters() {
  const years = [...new Set(all.map((i) => i.year))].sort((a, b) => b - a);
  const yEl = $('years'); yEl.innerHTML = '';
  yEl.appendChild(pill('All', all.length, year === 'all', () => { year = 'all'; month = 'all'; apply(); }));
  years.forEach((y) => yEl.appendChild(pill(y, all.filter((i) => i.year === y).length, year === y, () => { year = y; month = 'all'; apply(); })));
  // only offer a year filter once there is more than one year
  yEl.style.display = years.length > 1 ? '' : 'none';

  const inYear = year === 'all' ? all : all.filter((i) => i.year === year);
  const keys = [...new Set(inYear.map((i) => i.year * 100 + i.month))].sort((a, b) => b - a);
  const mEl = $('months'); mEl.innerHTML = '';
  mEl.appendChild(pill(year === 'all' && years.length > 1 ? 'All months' : 'All', inYear.length, month === 'all', () => { month = 'all'; apply(); }));
  keys.forEach((k) => {
    const y = Math.floor(k / 100), m = k % 100;
    const name = MONTHS[m - 1] + (year === 'all' && years.length > 1 ? ' ' + y : '');
    mEl.appendChild(pill(name, inYear.filter((i) => i.year === y && i.month === m).length, month === k, () => { month = k; apply(); }));
  });
}

function apply() {
  view = all.filter((i) => (year === 'all' || i.year === year) && (month === 'all' || i.year * 100 + i.month === month));
  shown = 0;
  $('grid').innerHTML = '';
  renderFilters();
  more();
  $('empty').hidden = view.length > 0;
}

function more() {
  const grid = $('grid');
  const frag = document.createDocumentFragment();
  view.slice(shown, shown + PAGE).forEach((it, k) => {
    const idx = shown + k;
    const b = document.createElement('button');
    b.className = 'pf-item';
    b.setAttribute('aria-label', `${label(it)}, ${dateStr(it)}`);
    const img = new Image();
    img.loading = 'lazy'; img.decoding = 'async'; img.alt = '';
    img.onload = () => img.classList.add('ok');
    img.src = it.thumb;
    b.appendChild(img);
    const cap = document.createElement('div');
    cap.className = 'cap';
    cap.innerHTML = `<b></b><span>${dateStr(it)}</span>`;
    cap.querySelector('b').textContent = label(it);
    b.appendChild(cap);
    b.onclick = () => openLb(idx);
    frag.appendChild(b);
  });
  grid.appendChild(frag);
  shown = Math.min(view.length, shown + PAGE);
  $('more').hidden = shown >= view.length;
  $('more').textContent = `Show more (${view.length - shown} left)`;
}
$('more').onclick = more;

// auto-load more when nearing the bottom
new IntersectionObserver((e) => { if (e[0].isIntersecting && shown < view.length) more(); }, { rootMargin: '600px' }).observe($('more'));

// lightbox
function openLb(i) {
  lbIndex = (i + view.length) % view.length;
  const it = view[lbIndex];
  $('lbImg').src = it.src;
  $('lbTitle').textContent = label(it);
  $('lbMeta').textContent = dateStr(it) + ` · ${lbIndex + 1} / ${view.length}`;
  $('lb').hidden = false;
  document.body.style.overflow = 'hidden';
  [1, -1].forEach((d) => { const n = view[(lbIndex + d + view.length) % view.length]; if (n) new Image().src = n.src; });
}
function closeLb() { $('lb').hidden = true; document.body.style.overflow = ''; }
$('lbClose').onclick = closeLb;
$('lbPrev').onclick = () => openLb(lbIndex - 1);
$('lbNext').onclick = () => openLb(lbIndex + 1);
$('lb').addEventListener('click', (e) => { if (e.target.id === 'lb') closeLb(); });
window.addEventListener('keydown', (e) => {
  if ($('lb').hidden) return;
  if (e.key === 'Escape') closeLb();
  if (e.key === 'ArrowLeft') openLb(lbIndex - 1);
  if (e.key === 'ArrowRight') openLb(lbIndex + 1);
});
let tx = null;
$('lb').addEventListener('touchstart', (e) => { tx = e.touches[0].clientX; }, { passive: true });
$('lb').addEventListener('touchend', (e) => {
  if (tx === null) return;
  const dx = e.changedTouches[0].clientX - tx; tx = null;
  if (Math.abs(dx) > 50) openLb(lbIndex + (dx < 0 ? 1 : -1));
});

// nav
const nav = $('nav');
$('navToggle').onclick = () => nav.classList.toggle('open');
$('year').textContent = new Date().getFullYear();

fetch('manifest.json', { cache: 'no-cache' })
  .then((r) => r.json())
  .then((d) => {
    all = d.items || [];
    $('count').textContent = all.length;
    apply();
  })
  .catch(() => {
    $('count').textContent = '';
    $('empty').hidden = false;
    $('empty').textContent = 'The portfolio could not be loaded. If you opened this file directly, view it through the website instead.';
  });
