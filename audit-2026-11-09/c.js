const fs = require('fs');
const L = require('./lib2');
const sleep = L.sleep, OUT = {};
const VPS = [{ name: '1366x768', width: 1366, height: 768 }, { name: '360x800', width: 360, height: 800 }];
const cnt = (re, t) => (t.match(re) || []).length;

async function check10(vp) {
  const r = {};
  for (const [label, scrolled, picker] of [['Send in view, picker closed', false, false], ['picker open, page scrolled to the bottom', true, true]]) {
    const { browser, page } = await L.open(vp, { cfg: { refer500: true } });
    await L.example(page);
    if (picker) await page.click('#pickBtn');
    await sleep(1200);
    if (scrolled) await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await sleep(300);
    const y0 = await page.evaluate(() => scrollY);
    if (scrolled) await page.keyboard.press('Control+Enter'); else await page.click('#sendBtn');
    await page.waitForSelector('#sendErr:not([hidden])'); await sleep(900);   // smooth scroll settles
    r[label] = await page.evaluate(y0 => { const b = document.querySelector('#sendErr').getBoundingClientRect(), s = document.querySelector('#sendBtn').getBoundingClientRect(), bar = document.querySelector('#cmd').getBoundingClientRect(); return { scrollYBefore: Math.round(y0), scrollYAfter: Math.round(scrollY), boxTop: +b.top.toFixed(1), boxBottom: +b.bottom.toFixed(1), sendTop: +s.top.toFixed(1), barBottom: +bar.bottom.toFixed(1), innerHeight, boxBelowBar: b.top >= bar.bottom - 0.5, boxFullyInViewport: b.bottom <= innerHeight + 0.5, boxAboveSend: b.bottom <= s.top + 0.5, text: document.querySelector('#sendErr').innerText.replace(/\s+/g, ' '), bar: document.querySelector('#cmdText').textContent }; }, y0);
    await browser.close();
  }
  return r;
}

async function check11(vp) {
  const cases = [
    ['empty notes', null, async p => { await p.fill('#notes', ''); await p.fill('#zip', 'B1P 5E7'); await p.click('#findBtn'); await sleep(300); return '#notesErr'; }],
    ['one word', null, async p => { await p.fill('#notes', 'pain'); await p.fill('#zip', 'B1P 5E7'); await p.click('#findBtn'); await sleep(300); return '#notesErr'; }],
    ['empty postal code', null, async p => { await p.fill('#notes', 'chest pain for two hours'); await p.fill('#zip', ''); await p.click('#findBtn'); await sleep(300); return '#zipErr'; }],
    ['triage {} with 200', { triageRaw: '{}' }, async p => { await p.click('.ex[data-i="0"]'); await p.waitForSelector('#findErr:not([hidden])'); return '#findErr'; }],
    ['triage 503', { triageStatus: 503 }, async p => { await p.click('.ex[data-i="0"]'); await p.waitForSelector('#findErr:not([hidden])'); return '#findErr'; }],
  ];
  const r = {};
  for (const [label, cfg, act] of cases) {
    const { browser, page } = await L.open(vp, { cfg });
    const sel = await act(page);
    const box = await page.evaluate(sel => document.querySelector(sel).innerText.replace(/\s+/g, ' ').trim(), sel);
    const bar = await page.evaluate(() => document.querySelector('#cmdText').textContent);
    const A = L.sentences(box), B = L.sentences(bar);
    r[label] = { box, bar, sharedSentences: A.filter(s => B.includes(s)) };
    await browser.close();
  }
  return r;
}

async function check12(vp) {
  const R = {};
  const pick = async (p, kind) => { await p.click('#pickBtn'); await p.click(kind === 'mismatch' ? '#pickList .opt.no' : '#pickList .opt:not(.no):not(:has(.rush))'); await sleep(250); };
  const sc = [
    ['a. keyword guess + override to a hospital that offers it', {}, async p => { await pick(p, 'offers'); }],
    ['b. keyword guess + override to a hospital that does NOT offer it', {}, async p => { await pick(p, 'mismatch'); }],
    ['c. practice mode + override to a hospital that offers it', { practice: true }, async p => { await pick(p, 'offers'); }],
    ['c2. practice mode + override to a hospital that does NOT offer it', { practice: true }, async p => { await pick(p, 'mismatch'); }],
    ['d. AI-style result with symptoms + override (offers)', { cfg: { triageStub: L.STUB_AI } }, async p => { await pick(p, 'offers'); }],
    ['d2. AI-style result with symptoms + override (does NOT offer)', { cfg: { triageStub: L.STUB_AI } }, async p => { await pick(p, 'mismatch'); }],
    ['d3. control: AI-style result with symptoms, no override', { cfg: { triageStub: L.STUB_AI } }, async p => {}],
    ['e. AI-style result with NO symptoms, risks or medications (F11), no override', { cfg: { triageStub: L.STUB_EMPTY } }, async p => {}],
    ['e2. F11 result + override (offers)', { cfg: { triageStub: L.STUB_EMPTY } }, async p => { await pick(p, 'offers'); }],
    ['f. F11 result, then the doctor applies a change to urgency (F1)', { cfg: { triageStub: L.STUB_EMPTY } }, async p => { await p.click('#fixBtn'); await p.selectOption('#fixUrg', '9'); await p.click('#fixApply'); await sleep(250); }],
    ['f2. keyword guess, then the doctor applies a change to urgency (F1)', {}, async p => { await p.click('#fixBtn'); await p.selectOption('#fixUrg', '9'); await p.click('#fixApply'); await sleep(250); }],
    ['f3. keyword guess, doctor changes only the specialty (urgency still a guess)', {}, async p => { await p.click('#fixBtn'); await p.selectOption('#fixSpec', 'Orthopedics'); await p.click('#fixApply'); await sleep(250); }],
  ];
  for (const [label, o, act] of sc) {
    const { browser, page } = await L.open(vp, o);
    await L.example(page); await act(page);
    R[label] = await L.warnings(page);
    await browser.close();
  }
  return R;
}

async function check13(vp) {
  const R = {};
  for (const [label, cfg] of [['AI-style result (no warning)', { triageStub: L.STUB_AI }], ['keyword result (guess warning)', null]]) {
    const { browser, page } = await L.open(vp, { cfg });
    await L.example(page);
    R[label] = await page.evaluate(() => {
      const parts = [...document.querySelectorAll('#v2 > *')].filter(el => !el.matches('details, .picker, .fix, [hidden]') && el.getClientRects().length).map(el => el.innerText.replace(/\s+/g, ' ').trim()).filter(Boolean);
      const t = parts.join(' | ');
      const grab = re => (t.match(re) || []);
      return { text: t, percentFull: grab(/\d+% full/g), km: grab(/~?\d+(\.\d+)?\s?km/g), days: grab(/\d+ days?|\bdays?\b/g), urgency: grab(/\d+\/10/g) };
    });
    await browser.close();
  }
  return R;
}

(async () => {
  for (const vp of VPS) {
    OUT[vp.name] = { c10: await check10(vp), c11: await check11(vp) };
    if (vp.width === 1366) { OUT[vp.name].c12 = await check12(vp); OUT[vp.name].c13 = await check13(vp); }
    fs.writeFileSync(__dirname + '/c_raw.json', JSON.stringify(OUT, null, 1));
    console.log(vp.name, 'done');
  }
})().catch(e => { console.error('ERR', e); process.exit(1); });
