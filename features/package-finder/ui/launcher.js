// Package Finder slice — entry points on the main Medicare guide (index.html).
// The workflow itself lives on its own page (review.html); this only links into it.
const URL_BASE = 'review.html';
const STEPS = ['Basics', '10 questions', 'Your package', 'Finish'];

function mountLauncher() {
  const slot = document.getElementById('sq-recommend-mount');
  if (!slot) return;
  slot.innerHTML = `<div class="gr-launch">
    <div class="gr-launch-eb">Medicare Package Review</div>
    <h3>Answer 10 questions. Get the package that fits.</h3>
    <ol>${STEPS.map((s, i) => `<li><i class="fa-solid ${['fa-user', 'fa-list-check', 'fa-box-open', 'fa-paper-plane'][i]}"></i>${s}</li>`).join('')}</ol>
    <a href="${URL_BASE}" class="gr-btn primary">Start Package Review <i class="fa-solid fa-arrow-right"></i></a>
    <small>Free · About 5 minutes · Answers stay on your device</small></div>`;
}
function mountFab() {
  if (document.getElementById('gr-fab')) return;
  const b = document.createElement('a');
  b.id = 'gr-fab'; b.href = URL_BASE; b.className = 'gr-fab';
  b.innerHTML = '<i class="fa-solid fa-box-open"></i> Find my package';
  document.body.appendChild(b);
  const pk = document.getElementById('packages');
  if (pk && 'IntersectionObserver' in window) new IntersectionObserver(([en]) => b.classList.toggle('hide', en.isIntersecting), { threshold: 0.2 }).observe(pk);
}
// Package cards → open the review with that package as the stated interest.
window.selectPackage = (path, tier) => { location.href = `${URL_BASE}?path=${encodeURIComponent(path)}&tier=${encodeURIComponent(tier)}`; };

function init() { mountLauncher(); mountFab(); }
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
