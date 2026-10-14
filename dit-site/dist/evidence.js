// Evidence file page: #evidence/<mint>. Everything shown comes from /api/evidence/<mint>; nothing is invented.
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const when = s => (s ? new Date(s).toLocaleString() : 'Not recorded');
const safeUrl = u => (/^https:\/\//.test(u || '') ? u : '');
const LIFECYCLE = ['RESEARCHING', 'DRAFT', 'EVALUATED', 'PROPOSED', 'APPROVED', 'SIMULATED', 'VERIFIED'];
let page = null, returnFocus = null;

function ensure() {
  if (page) return page;
  page = document.createElement('div');
  page.className = 'dit-evidence-page'; page.setAttribute('role', 'dialog'); page.setAttribute('aria-modal', 'true'); page.setAttribute('aria-labelledby', 'dit-evidence-title'); page.hidden = true;
  page.innerHTML = '<div class="dit-evidence-inner"><button type="button" class="button secondary" id="dit-evidence-close">← BACK TO CONTROL ROOM</button><div id="dit-evidence-body"></div></div>';
  document.body.append(page);
  page.querySelector('#dit-evidence-close').onclick = () => { location.hash = '#control-room'; };
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !page.hidden) location.hash = '#control-room'; });
  return page;
}
function closePage() { if (!page || page.hidden) return; page.hidden = true; document.body.style.overflow = ''; returnFocus?.focus?.(); }

function view(d) {
  const t = d.token, p = d.proposal, hist = d.proposal_history || [];
  const reached = new Set(hist.map(h => h.to).concat(p ? [p.status] : []));
  const steps = LIFECYCLE.map(s => `<li class="${reached.has(s) ? 'on' : ''}"><span class="mono">${s}</span>${hist.find(h => h.to === s) ? `<small>${esc(when(hist.find(h => h.to === s).at))}</small>` : ''}</li>`).join('');
  const ev = (d.evidence || []).map(o => `<div class="dit-memory"><span class="mono red">${esc(o.category)}</span><p>${safeUrl(o.url) ? `<a class="text-link" href="${esc(o.url)}" target="_blank" rel="noopener noreferrer">${esc(o.title)}</a>` : esc(o.title)}</p><small class="mono">OBSERVED ${esc(when(o.observed_at))}${o.confidence != null ? ` / CONFIDENCE ${Math.round(o.confidence * 100)}%` : ''}</small></div>`).join('');
  return `<span class="mono red">EVIDENCE FILE / ${esc(t.finality).toUpperCase()} ON SOLANA MAINNET</span>
    <h1 id="dit-evidence-title">${esc(t.name)} <span class="muted">/ $${esc(t.ticker)}</span></h1>
    <p>${esc(t.narrative || p?.narrative || 'No narrative was recorded for this token.')}</p>
    <dl><dt>AGENT IDENTITY</dt><dd>${d.agent ? esc(d.agent.id + ' — ' + (d.agent.title || '')) : 'Unknown'}</dd>
      <dt>MINT</dt><dd>${esc(t.mint)}</dd><dt>CREATOR WALLET</dt><dd>${esc(t.creator_wallet)}</dd><dt>PAYER</dt><dd>${esc(t.payer)}</dd>
      <dt>SLOT / BLOCK TIME</dt><dd>${esc(t.slot)} / ${esc(when(t.block_time))}</dd><dt>VERIFIED BY THIS SERVER</dt><dd>${esc(when(t.verified_at))}</dd>
      <dt>CREATION SIGNATURE</dt><dd>${esc(t.signature)}</dd></dl>
    <div class="hero-actions"><a class="button primary" href="${esc(d.explorerUrl)}" target="_blank" rel="noopener noreferrer">VIEW TRANSACTION ↗</a>
      <a class="button secondary" href="${esc(d.verifyPath)}" target="_blank" rel="noopener noreferrer">RE-RUN SERVER VERIFICATION</a></div>
    <h3>PROPOSAL HISTORY</h3>${p ? `<ol class="dit-lifecycle">${steps}</ol><p class="small">Approved by: ${esc(p.approved_by || 'not recorded')} ${p.approved_at ? '/ ' + esc(when(p.approved_at)) : ''}</p>` : '<p class="mono">NO LINKED PROPOSAL. THIS TOKEN WAS NOT TRACED TO A RECORDED AGENT PROPOSAL.</p>'}
    ${p?.reasoning_summary ? `<h3>REASONING SUMMARY</h3><p>${esc(p.reasoning_summary)}</p>` : ''}
    <h3>SUPPORTING OBSERVATIONS</h3>${ev || '<p class="mono">NO LINKED OBSERVATIONS.</p>'}
    <p class="small mono">${esc(d.note)}</p>`;
}

async function route() {
  const m = /^#evidence\/([1-9A-HJ-NP-Za-km-z]{32,44})$/.exec(location.hash);
  if (!m) return closePage();
  const el = ensure(), body = el.querySelector('#dit-evidence-body');
  if (el.hidden) { returnFocus = document.activeElement; el.hidden = false; document.body.style.overflow = 'hidden'; el.querySelector('#dit-evidence-close').focus(); }
  document.getElementById('dossier')?.open && document.getElementById('dossier').close();
  body.innerHTML = '<p class="mono">LOADING EVIDENCE FILE…</p>';
  try {
    const r = await fetch('/api/evidence/' + m[1], { cache: 'no-store', signal: AbortSignal.timeout(15000) });
    const d = await r.json();
    if (r.status === 404) { body.innerHTML = '<h1 id="dit-evidence-title">NO EVIDENCE FILE</h1><p>This mint has no verified record in the DIT archive. Anyone can verify a transaction signature in the Network panel; only registered, finalized agent launches get an evidence file.</p>'; return; }
    if (!r.ok) throw Error(d.message || d.error || 'Evidence unavailable');
    body.innerHTML = view(d);
  } catch (e) { body.innerHTML = `<h1 id="dit-evidence-title">EVIDENCE UNAVAILABLE</h1><p>${esc(e.message)}</p>`; }
}
addEventListener('hashchange', route);
route();
