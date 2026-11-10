const fs = require('fs');
const L = require('./lib2');
const VP = { width: 1366, height: 768 }, sleep = L.sleep;
const OUT = {};

const SNAP = () => {
  const $ = s => document.querySelector(s), vis = el => !!el && !el.hidden && el.getClientRects().length > 0;
  const buttons = {}; document.querySelectorAll('button, summary, select').forEach(b => { buttons[b.id || (b.className + ':' + b.textContent.trim().slice(0, 20))] = b.disabled ? 'disabled' : (vis(b) ? 'enabled' : 'enabled(hidden)'); });
  const a = document.activeElement;
  return { view: ['v1', 'v2', 'v3'].find(id => !$('#' + id).hidden), notes: $('#notes').value, zip: $('#zip').value, find: { disabled: $('#findBtn').disabled, text: $('#findBtn').textContent }, cancelVisible: vis($('#cancelFindBtn')), bar: $('#cmdText').textContent, step: $('#cmdStep').textContent, findErr: vis($('#findErr')) ? $('#findErr').textContent : '', sendErr: vis($('#sendErr')) ? $('#sendErr').textContent : '', hospName: $('#hospName').textContent, hospList: $('#hlist').innerText, rcH: $('#rcH').textContent, sendBtn: { disabled: $('#sendBtn').disabled, text: $('#sendBtn').textContent }, buttons, active: a ? (a.id || a.tagName) : null };
};
const diff = (a, b) => { const out = []; const w = (x, y, p) => { if (x && typeof x === 'object') for (const k of new Set([...Object.keys(x), ...Object.keys(y || {})])) w(x[k], (y || {})[k], p + '.' + k); else if (x !== y) out.push(`${p}: ${JSON.stringify(x)} -> ${JSON.stringify(y)}`); }; w(a, b, ''); return out; };
const barState = page => page.evaluate(() => ({ bar: document.querySelector('#cmdText').textContent, btn: document.querySelector('#findBtn').textContent, btnDisabled: document.querySelector('#findBtn').disabled, cancelVisible: !document.querySelector('#cancelFindBtn').hidden && document.querySelector('#cancelFindBtn').getClientRects().length > 0, live: document.querySelector('#cmd').getAttribute('aria-live'), view: ['v1', 'v2', 'v3'].find(id => !document.getElementById(id).hidden) }));

async function slowFind() {
  const R = {};
  { // 8a timing, abort-respecting
    const { browser, page } = await L.open(VP, { cfg: { triageDelay: 12000 } });
    const t0 = Date.now(); await page.click('.ex[data-i="0"]'); let firstSlow = null; const s = {};
    for (let ms = 100; ms <= 13500; ms += 100) { const w = t0 + ms - Date.now(); if (w > 0) await sleep(w); const st = await barState(page); if (firstSlow === null && /longer than usual/.test(st.bar)) firstSlow = Date.now() - t0; if (ms === 2000) s.at2s = st; if (ms === 8500) s.at8_5s = st; if (ms === 13500) s.at13_5s = st; }
    R.timing = { firstSlowAtMs: firstSlow, ...s, slowTextStillShownAfterFinish: /longer than usual/.test(s.at13_5s.bar + s.at13_5s.btn) };
    await browser.close();
  }
  for (const [label, ignoreAbort] of [['cancel at ~2 s, abort honoured', false], ['cancel at ~2 s, late answer ignores abort', true]]) {
    const { browser, page } = await L.open(VP, { cfg: { triageDelay: 12000, ignoreAbort } });
    const lateResp = []; page.on('response', r => { if (r.url().includes('/triage')) lateResp.push(Date.now()); });
    const t0 = Date.now(); await page.click('.ex[data-i="0"]');
    const typed = await page.evaluate(() => ({ notes: document.querySelector('#notes').value, zip: document.querySelector('#zip').value }));
    await sleep(Math.max(0, t0 + 2000 - Date.now())); await page.click('#cancelFindBtn'); await sleep(500);
    const after = await page.evaluate(SNAP); await sleep(15000); const later = await page.evaluate(SNAP);
    R[label] = { landedOn: after.view, notesUnchanged: after.notes === typed.notes, zipUnchanged: after.zip === typed.zip, findDisabled: after.find.disabled, findText: after.find.text, activeAfterCancel: after.active, cancelVisible: after.cancelVisible, bar: after.bar, lateTriageResponsesReceived: lateResp.length, changesDuring15s: diff(after, later) };
    await browser.close();
  }
  { // fast Find: every change recorded
    const { browser, page } = await L.open(VP);
    await page.evaluate(() => { window.__ch = []; const t0 = performance.now(); for (const [w, s] of [['bar', '#cmdText'], ['findBtn', '#findBtn']]) new MutationObserver(() => window.__ch.push({ ms: Math.round(performance.now() - t0), w, text: document.querySelector(s).textContent.trim().slice(0, 60) })).observe(document.querySelector(s), { childList: true, characterData: true, subtree: true }); });
    await page.click('.ex[data-i="0"]'); await page.waitForSelector('#v2:not([hidden])'); await sleep(9500);
    const ch = await page.evaluate(() => window.__ch); R.fast = { changes: ch.length, anySlowText: ch.some(c => /longer than usual/.test(c.text)), last: ch[ch.length - 1] };
    await browser.close();
  }
  return R;
}

const CTRL = ['#backBtn', '#pickBtn', '#fixBtn', '#sendBtn', '#surgeBtn', '#resetBtn', '#fixApply', '#fixCancel', '#fixUrg', '#fixSpec', '#pickList .opt', '#useRush'];
const ctrlState = (page, sels) => page.evaluate(sels => sels.flatMap(sel => { const els = [...document.querySelectorAll(sel)]; return els.map((el, i) => { const before = document.activeElement; el.focus(); const focused = document.activeElement === el; if (before && before.focus) before.focus(); return { sel: sel + (els.length > 1 ? `[${i}]` : ''), disabled: el.disabled, canTakeFocus: focused, inHiddenSection: !!el.closest('[hidden]') }; }); }), sels);
const flagsNow = page => page.evaluate(sels => sels.flatMap(sel => [...document.querySelectorAll(sel)].map((el, i) => `${sel}[${i}]:${el.disabled ? 'DISABLED' : 'enabled'}`)), CTRL);

async function slowSend() {
  const R = {};
  const setups = {
    'picker closed': async p => {},
    'picker open': async p => { await p.click('#pickBtn'); },
    'override to a hospital that offers it (Use RUSH pick in override note)': async p => { await p.evaluate(() => { window.__cfg.triageStub = { urgency_score: 7, primary_specialty_required: 'Cardiology', key_symptoms: ['chest pain'], acute_risks: [], current_medications: [] }; }); },
    'override to a hospital that does not offer it (Use RUSH pick in mismatch banner)': async p => { await p.click('#pickBtn'); await p.click('#pickList .opt.no'); await p.waitForSelector('#mismatchNote:not([hidden])'); },
    'F1 panel open': async p => { await p.click('#fixBtn'); await p.waitForSelector('#fixPanel:not([hidden])'); },
  };
  for (const [label, setup] of Object.entries(setups)) {
    const cfg = label.startsWith('override to a hospital that offers') ? { triageStub: L.STUB_AI } : null;
    const { browser, page } = await L.open(VP, { cfg });
    await L.example(page);
    if (label.startsWith('override to a hospital that offers')) { await page.click('#pickBtn'); await page.click('#pickList .opt:not(.no):not(:has(.rush))'); await page.waitForSelector('#overrideNote:not([hidden]) #useRush'); }
    else await setup(page);
    await L.setCfg(page, { referDelay: 12000 });
    const t0 = Date.now(); await page.click('#sendBtn'); await sleep(Math.max(0, t0 + 3000 - Date.now()));
    await page.click('#hospitals > summary');
    const during = await ctrlState(page, CTRL);
    const hosp0 = await page.evaluate(() => document.querySelector('#hospName').textContent);
    await page.keyboard.press('Control+Enter'); await page.keyboard.press('Meta+Enter');
    const clickAt = async sel => { const pt = await page.evaluate(sel => { const el = document.querySelector(sel); if (!el || el.hidden || el.closest('[hidden]') || !el.getClientRects().length) return null; el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, sel); if (!pt) return 'not visible'; await page.mouse.click(pt.x, pt.y); return 'clicked'; };
    const att = { sendBtn: await clickAt('#sendBtn') }; await page.evaluate(() => document.querySelector('#sendBtn').click());
    for (const sel of ['#backBtn', '#pickBtn', '#fixBtn', '#fixApply', '#fixCancel', '#useRush', '#pickList .opt:not([aria-pressed="true"])', '#surgeBtn']) att[sel] = await clickAt(sel);
    await sleep(300);
    const mid = await page.evaluate(() => ({ view: ['v1', 'v2', 'v3'].find(id => !document.getElementById(id).hidden), hospName: document.querySelector('#hospName').textContent, pickerOpen: !document.querySelector('#picker').hidden, panelOpen: !document.querySelector('#fixPanel').hidden, referCalls: window.__log.filter(x => x.key === 'refer').length, capacityCalls: window.__log.filter(x => x.key === 'capacity').length }));
    const stops = await L.walk(page);
    await sleep(Math.max(0, t0 + 8500 - Date.now()));
    const at8 = await page.evaluate(() => ({ bar: document.querySelector('#cmdText').textContent, sendBtn: document.querySelector('#sendBtn').textContent, cancelButtonsVisible: [...document.querySelectorAll('button')].filter(b => /cancel/i.test(b.textContent) && !b.hidden && !b.closest('[hidden]') && b.getClientRects().length).map(b => b.id), cancelFindHidden: document.querySelector('#cancelFindBtn').hidden }));
    await page.waitForSelector('#v3:not([hidden])', { timeout: 30000 });
    const net = page.__reqs.filter(r => r.url.includes('/refer')).length;
    const afterOk = await flagsNow(page);
    R[label] = { hospitalBefore: hosp0, at8_5s: at8, duringWait_control: during.filter(c => !c.inHiddenSection || /opt|fix|useRush/.test(c.sel)).map(c => `${c.sel}: disabled=${c.disabled} canFocus=${c.canTakeFocus}${c.inHiddenSection ? ' (in hidden section)' : ''}`), anyEnabledOrFocusable: during.filter(c => !c.disabled || c.canTakeFocus).map(c => c.sel), attempts: att, afterAttempts: mid, hospitalUnchanged: mid.hospName === hosp0, tabReachableDuringWait: stops.map(s => s.el.split(' "')[0]), referFetchCalls: mid.referCalls, referNetworkRequests: net, afterSuccessFlags: afterOk.filter(f => f.includes('DISABLED')) };
    await browser.close();
  }
  for (const [label, open] of [['500, picker closed', false], ['500, F1 panel open', 'fix'], ['500, picker open', 'pick']]) {
    const { browser, page } = await L.open(VP, { cfg: { refer500: true } });
    await L.example(page);
    if (open === 'pick') await page.click('#pickBtn'); if (open === 'fix') await page.click('#fixBtn');
    await page.click('#sendBtn'); await page.waitForSelector('#sendErr:not([hidden])'); await sleep(300);
    const st = await page.evaluate(() => { const a = document.activeElement; return { active: a ? (a.id || a.tagName) : null, sendBtn: { text: document.querySelector('#sendBtn').textContent, disabled: document.querySelector('#sendBtn').disabled } }; });
    const flags = await flagsNow(page);
    R[label] = { ...st, disabledAfterFailure: flags.filter(f => f.includes('DISABLED')) };
    await browser.close();
  }
  { const { browser, page } = await L.open(VP); await L.example(page); await page.click('#pickBtn'); await L.send(page); const flags = await flagsNow(page); R['normal success (fast), picker had been open'] = { view: 'v3', disabledAfter: flags.filter(f => f.includes('DISABLED')), note: 'sendBtn stays disabled on the hidden step 2 until the next match re-enables it' }; await page.click('#newBtn'); await L.example(page); const f2 = await flagsNow(page); R['normal success (fast), picker had been open'].afterNextPatientStep2Disabled = f2.filter(f => f.includes('DISABLED')); await browser.close(); }
  return R;
}

(async () => {
  OUT.check8_slowFind = await slowFind(); fs.writeFileSync(__dirname + '/b_raw.json', JSON.stringify(OUT, null, 1)); console.log('find done');
  OUT.check9_slowSend = await slowSend(); fs.writeFileSync(__dirname + '/b_raw.json', JSON.stringify(OUT, null, 1)); console.log('send done');
})().catch(e => { console.error('ERR', e); process.exit(1); });
