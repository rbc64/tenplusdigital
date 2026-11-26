// Tenplus Digital — small interactions
const WORK = Array.from({ length: 12 }, (_, i) => `assets/work/w${String(i + 1).padStart(2, '0')}.webp`);

// Marquee (duplicated so it loops seamlessly)
const track = document.getElementById('track');
[...WORK, ...WORK].forEach((src) => {
  const img = document.createElement('img');
  img.src = src; img.alt = ''; img.decoding = 'async';
  track.appendChild(img);
});

// Featured work grid
const grid = document.getElementById('workGrid');
[0, 3, 5, 6, 7, 9, 10, 11, 4].forEach((i) => {
  const a = document.createElement('a');
  a.href = 'portfolio/';
  a.className = 'reveal';
  a.innerHTML = `<img src="${WORK[i]}" alt="YouTube thumbnail by Tenplus Digital" decoding="async">`;
  grid.appendChild(a);
});

// Sticky nav style + mobile menu
const nav = document.getElementById('nav');
const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 20);
window.addEventListener('scroll', onScroll, { passive: true }); onScroll();
document.getElementById('navToggle').onclick = () => nav.classList.toggle('open');
document.querySelectorAll('#navLinks a').forEach((a) => a.addEventListener('click', () => nav.classList.remove('open')));

// Reveal on scroll
document.querySelectorAll('.svc, .tool, .section-head').forEach((el) => el.classList.add('reveal'));
const io = new IntersectionObserver((entries) => {
  entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
}, { threshold: 0.12 });
document.querySelectorAll('.reveal').forEach((el) => io.observe(el));

document.getElementById('year').textContent = new Date().getFullYear();

// Live portfolio count (falls back to the built-in text when offline)
fetch('portfolio/manifest.json', { cache: 'no-cache' })
  .then((r) => r.json())
  .then((d) => {
    const n = (d.items || []).length;
    if (!n) return;
    const rounded = n >= 20 ? Math.floor(n / 10) * 10 + '+' : String(n);
    document.querySelectorAll('[data-count]').forEach((el) => {
      el.textContent = el.dataset.count.replace('{n}', rounded);
    });
  })
  .catch(() => {});
