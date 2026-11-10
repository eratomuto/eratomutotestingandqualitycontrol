const fs = require('fs');
const L = require('./lib');
const VP = { width: 1366, height: 768 };
const sleep = L.sleep;

// installed before the page script runs: delayed / failing responses, and an app-level fetch log
const INIT = () => {
  window.__cfg = { triage: 0, refer: 0, ignoreAbort: false, refer500: false };
  window.__log = [];
  const orig = window.fetch.bind(window);
  window.fetch = (u, o = {}) => {
    const url = String(u);
    const key = url.includes('/triage') ? 'triage' : url.includes('/refer') ? 'refer' : url.includes('update-capacity') ? 'capacity' : null;
    if (key) window.__log.push({ key, t: Math.round(performance.now()) });
    if (key === 'refer' && window.__cfg.refer500) return Promise.resolve(new Response('{"detail":"x"}', { status: 500, headers: { 'content-type': 'application/json' } }));
    const d = (key && window.__cfg[key]) || 0;
    if (!d) return orig(u, o);
    return new Promise((res, rej) => {
      const sig = o.signal;
      if (sig && !window.__cfg.ignoreAbort) {
        const ab = () => rej(new DOMException('aborted', 'AbortError'));
        if (sig.aborted) return ab();
        sig.addEventListener('abort', ab, { once: true });
      }
      setTimeout(() => orig(u, window.__cfg.ignoreAbort ? { ...o, signal: undefined } : o).then(res, rej), d);
    });
  };
};

const SNAP = () => {
  const $ = s => document.querySelector(s);
  const vis = el => !!el && !el.hidden && el.getClientRects().length > 0;
  const buttons = {};
  document.querySelectorAll('button, summary').forEach(b => { buttons[b.id || (b.className + ':' + b.textContent.trim().slice(0, 20))] = b.disabled ? 'disabled' : (vis(b) ? 'enabled' : 'enabled(hidden)'); });
  const a = document.activeElement;
  return {
    view: ['v1', 'v2', 'v3'].find(id => !$('#' + id).hidden),
    notes: $('#notes').value, zip: $('#zip').value,
    find: { disabled: $('#findBtn').disabled, text: $('#findBtn').textContent },
    cancel: { visible: vis($('#cancelFindBtn')) },
    bar: $('#cmdText').textContent, step: $('#cmdStep').textContent, tone: $('#cmd').dataset.tone || '',
    findErr: vis($('#findErr')) ? $('#findErr').textContent : '', sendErr: vis($('#sendErr')) ? $('#sendErr').textContent : '',
    hospName: $('#hospName').textContent, hospList: $('#hlist').innerText, rcH: $('#rcH').textContent,
    sendBtn: { disabled: $('#sendBtn').disabled, text: $('#sendBtn').textContent },
    buttons, active: a ? (a.id || a.tagName) : null,
  };
};
const diff = (a, b) => {
  const out = [];
  const walk = (x, y, p) => {
    if (x && typeof x === 'object') for (const k of new Set([...Object.keys(x), ...Object.keys(y || {})])) walk(x[k], (y || {})[k], p + '.' + k);
    else if (x !== y) out.push(`${p}: ${JSON.stringify(x)} -> ${JSON.stringify(y)}`);
  };
  walk(a, b, ''); return out;
};
const bar = page => page.evaluate(() => ({ bar: document.querySelector('#cmdText').textContent, step: document.querySelector('#cmdStep').textContent, btn: document.querySelector('#findBtn').textContent, btnDisabled: document.querySelector('#findBtn').disabled, cancelVisible: !document.querySelector('#cancelFindBtn').hidden && document.querySelector('#cancelFindBtn').getClientRects().length > 0, live: document.querySelector('#cmd').getAttribute('aria-live'), view: ['v1', 'v2', 'v3'].find(id => !document.getElementById(id).hidden) }));
const cfg = (page, o) => page.evaluate(o => Object.assign(window.__cfg, o), o);

async function newPage() { const s = await L.open(VP, { init: INIT }); await L.install(s.page); return s; }

async function slowFind() {
  const R = {};
  // ---- 7a: timing without cancel (abort-respecting delay of 12 s) ----
  {
    const { browser, page } = await newPage();
    await cfg(page, { triage: 12000 });
    const t0 = Date.now();
    await page.click('.ex[data-i="0"]');
    let firstSlow = null; const samples = {};
    for (let ms = 100; ms <= 13500; ms += 100) {
      const wait = t0 + ms - Date.now(); if (wait > 0) await sleep(wait);
      const s = await bar(page);
      if (firstSlow === null && /longer than usual/.test(s.bar)) firstSlow = Date.now() - t0;
      if (ms === 2000) samples.at2s = s;
      if (ms === 8500) samples.at8_5s = s;
      if (ms === 13500) samples.at13_5s = s;
    }
    R.timing = { firstSlowAtMs: firstSlow, ...samples, afterIsSlowTextStillShown: /longer than usual/.test(samples.at13_5s.bar + samples.at13_5s.btn) };
    await browser.close();
  }
  // ---- 7b/7c: cancel at ~2 s; then wait 15 s ----
  for (const [label, ignoreAbort] of [['cancel (abort-respecting delay)', false], ['cancel + late answer that ignores abort', true]]) {
    const { browser, page } = await newPage();
    await cfg(page, { triage: 12000, ignoreAbort });
    const triageResponses = []; page.on('response', r => { if (r.url().includes('/triage')) triageResponses.push(Date.now()); });
    const t0 = Date.now();
    await page.click('.ex[data-i="0"]');
    const typedBefore = await page.evaluate(() => ({ notes: document.querySelector('#notes').value, zip: document.querySelector('#zip').value }));
    await sleep(Math.max(0, t0 + 2000 - Date.now()));
    const before = await page.evaluate(SNAP);
    await page.click('#cancelFindBtn');
    await sleep(500);
    const afterCancel = await page.evaluate(SNAP);
    await sleep(15000);
    const later = await page.evaluate(SNAP);
    R[label] = {
      typedBefore, afterCancel: { view: afterCancel.view, notes: afterCancel.notes, zip: afterCancel.zip, notesUnchanged: afterCancel.notes === typedBefore.notes, zipUnchanged: afterCancel.zip === typedBefore.zip, findDisabled: afterCancel.find.disabled, findText: afterCancel.find.text, active: afterCancel.active, cancelVisible: afterCancel.cancel.visible, bar: afterCancel.bar },
      cancelAt: 'about 2s', triageNetworkResponsesReceived: triageResponses.length, lateAnswerArrivedAtMsAfterClick: triageResponses.map(t => t - t0),
      changesDuringNext15s: diff(afterCancel, later), screenAfter15s: { view: later.view, bar: later.bar, findErr: later.findErr, active: later.active, find: later.find, cancel: later.cancel },
    };
    await browser.close();
  }
  // ---- 7d: normal fast Find ----
  {
    const { browser, page } = await newPage();
    const seen = []; const t0 = Date.now();
    await page.click('.ex[data-i="0"]');
    let done = false;
    while (Date.now() - t0 < 4000 && !done) { const s = await bar(page); seen.push(s); if (s.view === 'v2') done = true; await sleep(50); }
    const slowDuring = seen.filter(s => /longer than usual/.test(s.bar + s.btn)).length;
    await sleep(9500);
    const after = await page.evaluate(SNAP);
    R.fast = { samples: seen.length, reachedStep2: done, samplesWithSlowText: slowDuring, after9_5s: { view: after.view, bar: after.bar, find: after.find, cancelVisible: after.cancel.visible } };
    await browser.close();
  }
  return R;
}

const CONTROLS = ['#backBtn', '#pickBtn', '#sendBtn', '#surgeBtn', '#resetBtn'];
async function controlState(page, extraSel = []) {
  return page.evaluate(sels => sels.map(sel => {
    const els = [...document.querySelectorAll(sel)];
    return els.map((el, i) => {
      const before = document.activeElement; el.focus(); const focused = document.activeElement === el; if (before && before.focus) before.focus();
      return { sel: sel + (els.length > 1 ? `[${i}]` : ''), disabled: el.disabled, tabIndex: el.tabIndex, hiddenAttr: !!el.closest('[hidden]'), canTakeFocus: focused, label: el.textContent.trim().slice(0, 24) };
    });
  }).flat(), [...CONTROLS, ...extraSel]);
}

async function slowSend() {
  const R = {};
  const setups = {
    'S1 picker closed': async p => {},
    'S2 picker open': async p => { await p.click('#pickBtn'); await p.waitForSelector('#picker:not([hidden])'); },
    'S3 other hospital chosen (Use RUSH pick shown)': async p => { await p.click('#pickBtn'); await p.click('#pickList .opt:not(.no):not(:has(.rush))'); await p.waitForSelector('#useRush'); },
  };
  for (const [label, setup] of Object.entries(setups)) {
    const { browser, page } = await newPage();
    await L.toStep2(page);
    await setup(page);
    const hospBefore = await page.evaluate(() => document.querySelector('#hospName').textContent);
    await cfg(page, { refer: 12000 });
    const t0 = Date.now();
    await page.click('#sendBtn');
    await sleep(Math.max(0, t0 + 3000 - Date.now()));
    // during the wait: open the hospitals drawer (allowed) so the demo buttons are measurable
    await page.click('#hospitals > summary');
    const extra = ['#pickList .opt', '#useRush'];
    const during = await controlState(page, extra);
    const reqBefore = await page.evaluate(() => window.__log.filter(x => x.key === 'refer').length);
    // attempts
    await page.keyboard.press('Control+Enter');
    await page.keyboard.press('Meta+Enter');
    const clickAt = async sel => { const pt = await page.evaluate(sel => { const el = document.querySelector(sel); if (!el || el.hidden || !el.getClientRects().length) return null; el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, sel); if (!pt) return 'not visible'; await page.mouse.click(pt.x, pt.y); return 'clicked'; };
    const attempts = { sendBtn: await clickAt('#sendBtn') };
    await page.evaluate(() => document.querySelector('#sendBtn').click());
    attempts.backBtn = await clickAt('#backBtn');
    attempts.pickBtn = await clickAt('#pickBtn');
    attempts.firstOpt = await clickAt('#pickList .opt:not([aria-pressed="true"])');
    attempts.useRush = await clickAt('#useRush');
    attempts.surgeBtn = await clickAt('#surgeBtn');
    attempts.resetBtn = await clickAt('#resetBtn');
    await sleep(300);
    const mid = await page.evaluate(SNAP);
    const stops = await L.walk(page);
    const afterAttempts = await page.evaluate(() => ({ view: ['v1', 'v2', 'v3'].find(id => !document.getElementById(id).hidden), hospName: document.querySelector('#hospName').textContent, pickerOpen: !document.querySelector('#picker').hidden, referCalls: window.__log.filter(x => x.key === 'refer').length, capacityCalls: window.__log.filter(x => x.key === 'capacity').length, surgeHintVisible: !document.querySelector('#surgeHint').hidden }));
    // 8.5 s reading
    await sleep(Math.max(0, t0 + 8500 - Date.now()));
    const at8 = await page.evaluate(() => ({ bar: document.querySelector('#cmdText').textContent, sendBtn: document.querySelector('#sendBtn').textContent, sendDisabled: document.querySelector('#sendBtn').disabled, cancelButtonsVisible: [...document.querySelectorAll('button')].filter(b => /cancel/i.test(b.textContent) && !b.hidden && b.getClientRects().length).map(b => b.id || b.textContent), cancelFindHidden: document.querySelector('#cancelFindBtn').hidden, live: document.querySelector('#cmd').getAttribute('aria-live') }));
    // wait for the receipt
    await page.waitForSelector('#v3:not([hidden])', { timeout: 30000 });
    const receiptAt = Date.now() - t0;
    const refNet = page.__reqs.filter(r => r.url.includes('/refer')).length;
    const afterOk = await page.evaluate(() => ({ view: 'v3', rcH: document.querySelector('#rcH').textContent, referCalls: window.__log.filter(x => x.key === 'refer').length, flags: ['#backBtn', '#pickBtn', '#sendBtn', '#surgeBtn', '#resetBtn'].map(s => s + ':' + (document.querySelector(s).disabled ? 'disabled' : 'enabled')), opts: [...document.querySelectorAll('#pickList .opt')].map(o => o.disabled ? 'disabled' : 'enabled'), useRush: [...document.querySelectorAll('#useRush')].map(o => o.disabled ? 'disabled' : 'enabled') }));
    R[label] = { hospBefore, during, attempts, mid: { bar: mid.bar, sendBtn: mid.sendBtn, view: mid.view }, tabReachableDuringWait: stops.map(s => s.el.split(' "')[0] + (s.el.includes('"') ? ' "' + s.el.split(' "')[1].slice(0, 16) : '')), afterAttempts: { ...afterAttempts, referCallsBeforeAttempts: reqBefore }, at8, receiptAfterMs: receiptAt, refererNetworkRequestsTotal: refNet, afterSuccessDomFlags: afterOk };
    // after success: Next patient -> new Find -> step 2: are controls enabled and working?
    await page.click('#newBtn');
    await cfg(page, { refer: 0 });
    await L.toStep2(page);
    await page.click('#pickBtn');
    const picked = await page.evaluate(() => ({ flags: ['#backBtn', '#pickBtn', '#sendBtn', '#surgeBtn', '#resetBtn'].map(s => s + ':' + (document.querySelector(s).disabled ? 'disabled' : 'enabled')), pickerOpen: !document.querySelector('#picker').hidden, opts: [...document.querySelectorAll('#pickList .opt')].map(o => o.disabled ? 'disabled' : 'enabled') }));
    R[label].nextPatientThenStep2 = picked;
    await browser.close();
  }
  // ---- 500 from /refer, with and without the picker open ----
  for (const [label, open] of [['500 picker closed', false], ['500 picker open', true]]) {
    const { browser, page } = await newPage();
    await L.toStep2(page);
    if (open) { await page.click('#pickBtn'); await page.waitForSelector('#picker:not([hidden])'); }
    await cfg(page, { refer500: true });
    await page.click('#sendBtn');
    await page.waitForSelector('#sendErr:not([hidden])', { timeout: 10000 });
    await sleep(300);
    const state = await page.evaluate(() => { const a = document.activeElement; return { activeElement: a ? { id: a.id, tag: a.tagName, text: (a.textContent || '').trim().slice(0, 24) } : null, sendErr: document.querySelector('#sendErr').textContent, bar: document.querySelector('#cmdText').textContent, sendBtn: { text: document.querySelector('#sendBtn').textContent, disabled: document.querySelector('#sendBtn').disabled }, flags: ['#backBtn', '#pickBtn', '#surgeBtn', '#resetBtn'].map(s => s + ':' + (document.querySelector(s).disabled ? 'disabled' : 'enabled')), opts: [...document.querySelectorAll('#pickList .opt')].map(o => o.disabled ? 'disabled' : 'enabled'), referCalls: window.__log.filter(x => x.key === 'refer').length, view: ['v1', 'v2', 'v3'].find(id => !document.getElementById(id).hidden) }; });
    // functional check: with the picker open, an option can be chosen again
    let choose = 'n/a';
    if (open) { const before = await page.evaluate(() => document.querySelector('#hospName').textContent); await page.click('#pickList .opt:not([aria-pressed="true"]):not(.no)'); await sleep(200); const after = await page.evaluate(() => document.querySelector('#hospName').textContent); choose = `${before} -> ${after}`; }
    const backWorks = await (async () => { await page.click('#backBtn'); await sleep(200); return page.evaluate(() => ['v1', 'v2', 'v3'].find(id => !document.getElementById(id).hidden)); })();
    R[label] = { ...state, optionChoiceAfterFailure: choose, backButtonWorksAfterFailure: backWorks };
    await browser.close();
  }
  // ---- normal success, fast ----
  {
    const { browser, page } = await newPage();
    await L.toStep2(page);
    await page.click('#pickBtn');
    await L.toStep3(page);
    const s = await page.evaluate(() => ({ view: ['v1', 'v2', 'v3'].find(id => !document.getElementById(id).hidden), flags: ['#backBtn', '#pickBtn', '#sendBtn', '#surgeBtn', '#resetBtn'].map(s => s + ':' + (document.querySelector(s).disabled ? 'disabled' : 'enabled')), opts: [...document.querySelectorAll('#pickList .opt')].map(o => o.disabled ? 'disabled' : 'enabled'), referCalls: window.__log.filter(x => x.key === 'refer').length, bar: document.querySelector('#cmdText').textContent }));
    R['normal success (fast), picker had been open'] = s;
    await browser.close();
  }
  return R;
}

(async () => {
  const out = {};
  out.F9_7_slowFind = await slowFind();
  fs.writeFileSync(__dirname + '/f9_raw.json', JSON.stringify(out, null, 1));
  console.log('find done');
  out.F9_8_slowSend = await slowSend();
  fs.writeFileSync(__dirname + '/f9_raw.json', JSON.stringify(out, null, 1));
  console.log('send done');
})().catch(e => { console.error('ERR', e); process.exit(1); });
