// Final-audit helpers (scratchpad only, outside the repo).
const { chromium } = require('playwright');
const L = require('./lib');
const sleep = L.sleep;
const BASE = 'http://localhost:8000/';
const PRACTICE_URL = 'http://localhost:5500/?api=http://localhost:1';

// before the page script runs: configurable stubs, delays, failures and a log of app-level fetches
const INIT = () => {
  window.__cfg = { triageDelay: 0, referDelay: 0, ignoreAbort: false, triageStub: null, triageStatus: 0, triageRaw: null, refer500: false, dropSpecialty: null };
  window.__log = [];
  const orig = window.fetch.bind(window);
  window.fetch = (u, o = {}) => {
    const url = String(u), c = window.__cfg;
    const key = url.includes('/triage') ? 'triage' : url.includes('/refer') ? 'refer' : url.includes('update-capacity') ? 'capacity' : /\/hubs(\?|$)/.test(url) ? 'hubs' : null;
    if (key) window.__log.push({ key, t: Math.round(performance.now()), body: o.body || null });
    if (key === 'refer' && c.refer500) return Promise.resolve(new Response('{"detail":"x"}', { status: 500, headers: { 'content-type': 'application/json' } }));
    if (key === 'triage' && c.triageStatus) return Promise.resolve(new Response('{"detail":"down"}', { status: c.triageStatus, headers: { 'content-type': 'application/json' } }));
    let real = () => orig(u, o);
    if (key === 'triage' && c.triageRaw !== null) real = () => Promise.resolve(new Response(c.triageRaw, { headers: { 'content-type': 'application/json' } }));
    else if (key === 'triage' && c.triageStub) real = () => Promise.resolve(new Response(JSON.stringify({ ...JSON.parse(o.body), ...c.triageStub }), { headers: { 'content-type': 'application/json' } }));
    else if (key === 'hubs' && c.dropSpecialty) real = () => orig(u, o).then(r => r.json()).then(h => new Response(JSON.stringify(h.map(x => ({ ...x, specialties: x.specialties.filter(s => s !== c.dropSpecialty) }))), { headers: { 'content-type': 'application/json' } }));
    const d = key === 'triage' ? c.triageDelay : key === 'refer' ? c.referDelay : 0;
    if (!d) return real();
    return new Promise((res, rej) => {
      const sig = o.signal;
      if (sig && !c.ignoreAbort) { const ab = () => rej(new DOMException('aborted', 'AbortError')); if (sig.aborted) return ab(); sig.addEventListener('abort', ab, { once: true }); }
      setTimeout(() => (c.ignoreAbort ? (key === 'triage' && (c.triageStub || c.triageRaw !== null) ? real() : orig(u, { ...o, signal: undefined })) : real()).then(res, rej), d);
    });
  };
};

const STUB_AI = { urgency_score: 7, primary_specialty_required: 'Cardiology', key_symptoms: ['chest pain'], acute_risks: ['possible heart attack'], current_medications: ['aspirin'] };
const STUB_EMPTY = { urgency_score: 7, primary_specialty_required: 'Cardiology', key_symptoms: [], acute_risks: [], current_medications: [] };

async function open(vp, { practice = false, cfg = null, perms = false } = {}) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: vp, ignoreHTTPSErrors: true, deviceScaleFactor: 1, permissions: perms ? ['clipboard-read', 'clipboard-write'] : [] });
  const page = await ctx.newPage();
  page.__reqs = []; page.__console = [];
  page.on('request', r => page.__reqs.push({ url: r.url(), method: r.method(), post: r.postData() || '' }));
  page.on('console', m => page.__console.push(m.type() + ': ' + m.text()));
  await page.addInitScript(INIT);
  if (cfg) await page.addInitScript(c => Object.assign(window.__cfg, c), cfg);
  await page.goto(practice ? PRACTICE_URL : BASE, { waitUntil: 'load', timeout: 45000 });
  const want = practice ? 'Practice mode' : 'Connected';
  await page.waitForFunction(w => document.querySelector('#conn') && document.querySelector('#conn').textContent === w, want, { timeout: 20000 });
  await page.evaluate(() => document.fonts.ready);
  await L.install(page);
  return { browser, ctx, page };
}
const setCfg = (page, o) => page.evaluate(o => Object.assign(window.__cfg, o), o);
const view = page => page.evaluate(() => ['v1', 'v2', 'v3'].find(id => !document.getElementById(id).hidden));
async function find(page, notes, zip) {
  await page.fill('#notes', notes); await page.fill('#zip', zip);
  await page.click('#findBtn');
  await page.waitForSelector('#v2:not([hidden])', { timeout: 25000 });
}
async function example(page) { await page.click('.ex[data-i="0"]'); await page.waitForSelector('#v2:not([hidden])', { timeout: 25000 }); }
async function send(page) { await page.click('#sendBtn'); await page.waitForSelector('#v3:not([hidden])', { timeout: 30000 }); }
const warnings = page => page.evaluate(() => {
  const vis = el => el && !el.hidden && el.getClientRects().length > 0;
  const out = {};
  for (const id of ['mismatchNote', 'checkNote', 'overrideNote', 'sendErr']) { const el = document.getElementById(id); out[id] = vis(el) ? el.innerText.trim().replace(/\s+/g, ' ') : null; }
  out.practiceBarTop = vis(document.getElementById('practiceBar'));
  out.bar = document.getElementById('cmdText').textContent;
  out.pill = document.getElementById('urgPill').textContent;
  out.hospital = document.getElementById('hospName').textContent;
  return out;
});
const ratio = page => page.evaluate(() => { const r = document.querySelector('#cmd').getBoundingClientRect(); return { h: +r.height.toFixed(1), vh: innerHeight, ratio: +(r.height / innerHeight).toFixed(4), text: document.querySelector('#cmdText').textContent.slice(0, 70) }; });
const activeId = page => page.evaluate(() => { const a = document.activeElement; return a ? (a.id || a.tagName) : null; });
const sentences = t => (t || '').split(/(?<=[.!?])\s+/).map(s => s.trim().toLowerCase().replace(/[.!?]+$/, '')).filter(s => s.length > 3);

module.exports = { ...L, open, setCfg, view, find, example, send, warnings, ratio, activeId, sentences, STUB_AI, STUB_EMPTY, sleep, BASE, PRACTICE_URL };
