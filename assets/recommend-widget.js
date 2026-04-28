(function () {
  if (window.__SQRecommendLoaded) return;
  window.__SQRecommendLoaded = true;

  const css = `
  .sq-fab{position:fixed;bottom:24px;right:24px;background:linear-gradient(135deg,#ef6c1a,#f59e0b);color:#fff;border:0;padding:14px 20px;border-radius:999px;font-weight:700;box-shadow:0 8px 24px rgba(0,0,0,.25);cursor:pointer;z-index:9998;font-family:system-ui,sans-serif;font-size:14px}
  .sq-fab:hover{transform:translateY(-2px)}
  .sq-overlay{position:fixed;inset:0;background:rgba(7,30,32,.7);backdrop-filter:blur(4px);display:none;align-items:center;justify-content:center;z-index:9999;font-family:system-ui,sans-serif}
  .sq-overlay.open{display:flex}
  .sq-modal{background:#0e3d40;color:#fff;width:min(560px,92vw);max-height:90vh;overflow:auto;border-radius:14px;padding:24px;box-shadow:0 20px 60px rgba(0,0,0,.5)}
  .sq-modal h2{margin:0 0 4px;font-size:1.4rem}
  .sq-modal p.lede{margin:0 0 16px;opacity:.8;font-size:.9rem}
  .sq-modal label{display:block;font-size:.85rem;margin:10px 0 4px;opacity:.9}
  .sq-modal input,.sq-modal select,.sq-modal textarea{width:100%;padding:9px 10px;border-radius:8px;border:1px solid rgba(255,255,255,.18);background:rgba(0,0,0,.25);color:#fff;box-sizing:border-box;font-size:14px}
  .sq-row{display:grid;grid-template-columns:1fr 1fr;gap:10px}
  .sq-actions{display:flex;gap:10px;margin-top:18px}
  .sq-btn{flex:1;padding:11px;border:0;border-radius:8px;font-weight:700;cursor:pointer;font-size:14px}
  .sq-btn.primary{background:#ef6c1a;color:#fff}
  .sq-btn.ghost{background:transparent;color:#fff;border:1px solid rgba(255,255,255,.25)}
  .sq-close{position:absolute;top:14px;right:18px;color:#fff;background:transparent;border:0;font-size:22px;cursor:pointer;opacity:.7}
  .sq-result{margin-top:14px;background:rgba(255,255,255,.05);padding:14px;border-radius:10px;font-size:14px;line-height:1.5}
  .sq-result h3{margin:0 0 6px;color:#f59e0b;font-size:1.05rem}
  .sq-result ul{margin:6px 0 10px 18px;padding:0}
  .sq-flag{background:rgba(245,158,11,.12);border-left:3px solid #f59e0b;padding:8px 10px;border-radius:6px;margin:6px 0;font-size:13px}
  .sq-disclaimer{margin-top:14px;font-size:12px;opacity:.65}
  .sq-loading{padding:20px;text-align:center;opacity:.85}
  `;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  const fab = document.createElement('button');
  fab.className = 'sq-fab';
  fab.textContent = '\u2728 Get My Recommendation';
  document.body.appendChild(fab);

  const overlay = document.createElement('div');
  overlay.className = 'sq-overlay';
  overlay.innerHTML = `
    <div class="sq-modal" style="position:relative">
      <button class="sq-close" aria-label="Close">\u00d7</button>
      <h2>AI Medicare Recommendation</h2>
      <p class="lede">Answer a few quick questions. Educational only \u2014 not insurance advice.</p>
      <form id="sq-form">
        <div class="sq-row">
          <div><label>Age</label><input name="age" type="number" min="50" max="100" required></div>
          <div><label>ZIP</label><input name="zip" pattern="[0-9]{5}" maxlength="5" required></div>
        </div>
        <label>Current coverage</label>
        <select name="current_coverage">
          <option value="none">None / turning 65 soon</option>
          <option value="employer">Employer group plan</option>
          <option value="medicare_ab">Original Medicare A&B only</option>
          <option value="medicare_advantage">Medicare Advantage</option>
          <option value="medigap">Medicare + Medigap</option>
          <option value="cobra">COBRA</option>
          <option value="vaTRICARE">VA / TRICARE</option>
        </select>
        <div class="sq-row">
          <div><label>Still working past 65?</label><select name="still_working"><option>No</option><option>Yes</option></select></div>
          <div><label>Employer size</label><select name="employer_size"><option>n/a</option><option>Under 20</option><option>20+</option></select></div>
        </div>
        <div class="sq-row">
          <div><label>Contributing to HSA?</label><select name="hsa"><option>No</option><option>Yes</option></select></div>
          <div><label>Travel often?</label><select name="travel"><option>Rarely</option><option>Sometimes</option><option>Frequently</option></select></div>
        </div>
        <label>Prescriptions (comma separated)</label>
        <input name="prescriptions" placeholder="e.g., Eliquis, Lipitor">
        <label>Doctors you must keep</label>
        <input name="doctors" placeholder="e.g., Dr. Smith (cardiologist)">
        <div class="sq-row">
          <div><label>Monthly budget comfort</label><select name="budget"><option>Lowest possible</option><option>Moderate</option><option>Premium for full coverage</option></select></div>
          <div><label>Top priority</label><select name="priorities"><option>Predictable costs</option><option>Doctor choice</option><option>Drug coverage</option><option>Extras (dental/vision)</option></select></div>
        </div>
        <div class="sq-actions">
          <button type="button" class="sq-btn ghost" id="sq-cancel">Cancel</button>
          <button type="submit" class="sq-btn primary">Get Recommendation</button>
        </div>
      </form>
      <div id="sq-result"></div>
      <div class="sq-disclaimer">SelectQuote AI \u00b7 Educational guidance only. Always confirm with a licensed agent.</div>
    </div>`;
  document.body.appendChild(overlay);

  const close = () => overlay.classList.remove('open');
  fab.addEventListener('click', () => overlay.classList.add('open'));
  overlay.querySelector('.sq-close').addEventListener('click', close);
  overlay.querySelector('#sq-cancel').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  const escapeHtml = (s) => String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  overlay.querySelector('#sq-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const payload = Object.fromEntries(fd.entries());
    const result = overlay.querySelector('#sq-result');
    result.innerHTML = '<div class="sq-loading">Analyzing your profile\u2026</div>';
    try {
      const r = await fetch('/api/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Request failed');
      const flags = (data.red_flags||[]).map(f => `<div class="sq-flag">\u26a0 ${escapeHtml(f)}</div>`).join('');
      const qs = (data.key_questions_for_agent||[]).map(q => `<li>${escapeHtml(q)}</li>`).join('');
      const ns = (data.next_steps||[]).map(q => `<li>${escapeHtml(q)}</li>`).join('');
      result.innerHTML = `
        <div class="sq-result">
          <h3>${escapeHtml(data.recommended_path||'Recommendation')}</h3>
          <p>${escapeHtml(data.why||'')}</p>
          ${flags}
          ${qs ? `<strong>Ask your agent:</strong><ul>${qs}</ul>` : ''}
          ${ns ? `<strong>Next steps:</strong><ul>${ns}</ul>` : ''}
        </div>`;
    } catch (err) {
      result.innerHTML = `<div class="sq-flag">Error: ${escapeHtml(err.message||err)}</div>`;
    }
  });
})();
