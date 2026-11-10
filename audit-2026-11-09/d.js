const fs = require('fs');
const L = require('./lib2');
const sleep = L.sleep, VP = { width: 1366, height: 768 }, OUT = {};
const NOTES = 'chest pain for two hours with shortness of breath';
const vis = (page, sel) => page.evaluate(sel => { const el = document.querySelector(sel); return !!el && !el.hidden && el.getClientRects().length > 0; }, sel);
const txt = (page, sel) => page.evaluate(sel => { const el = document.querySelector(sel); return el ? el.textContent.trim().replace(/\s+/g, ' ') : null; }, sel);
const triageCalls = page => page.evaluate(() => window.__log.filter(x => x.key === 'triage').length);

async function c14() {
  const R = {};
  { // typing an unknown code: picker must not appear while the field has focus
    const { browser, page } = await L.open(VP);
    await page.fill('#notes', NOTES); await page.click('#zip'); const seq = [];
    for (const ch of 'B3S 0B6') { await page.keyboard.type(ch); await sleep(60); seq.push({ typed: await page.inputValue('#zip'), pickerVisible: await vis(page, '#townWrap'), focused: await L.activeId(page) }); }
    R.typingUnknown_whileFocused = { anyPickerVisibleWhileTyping: seq.some(s => s.pickerVisible), samples: seq.length, last: seq[seq.length - 1] };
    await page.click('#notes'); await sleep(200);
    R.afterBlur = { pickerVisible: await vis(page, '#townWrap'), help: await txt(page, '#zipHelp') };
    await browser.close();
  }
  { // Find pressed with an unusable code
    const { browser, page } = await L.open(VP);
    await page.fill('#notes', NOTES); await page.fill('#zip', 'B3S 0B6'); await page.click('#findBtn'); await sleep(400);
    R.findWithUnknown = { view: await L.view(page), triageRequests: await triageCalls(page), pickerVisible: await vis(page, '#townWrap'), zipAriaInvalid: await page.getAttribute('#zip', 'aria-invalid'), help: await txt(page, '#zipHelp'), bar: await txt(page, '#cmdText'), focus: await L.activeId(page) };
    await browser.close();
  }
  { // O / I where a digit goes
    const { browser, page } = await L.open(VP);
    await page.fill('#notes', NOTES); await page.click('#zip'); await page.keyboard.type('B1P 5EI'); await sleep(100);
    const whileTyping = { pickerVisible: await vis(page, '#townWrap'), help: await txt(page, '#zipHelp') };
    await page.click('#notes'); await sleep(200);
    const afterBlur = { pickerVisible: await vis(page, '#townWrap'), help: await txt(page, '#zipHelp') };
    await page.click('#findBtn'); await sleep(400);
    R.letterOI = { whileTyping, afterBlur, findBlocked: (await L.view(page)) === 'v1', triageRequests: await triageCalls(page), focus: await L.activeId(page), bar: await txt(page, '#cmdText') };
    await browser.close();
  }
  { // Send guard: force an unknown code past step 1 (stubbed triage echoes a different postal code)
    const { browser, page } = await L.open(VP, { cfg: { triageStub: { ...L.STUB_AI, home_clinic_zip: 'Z9Z 9Z9' } } });
    await page.click('.ex[data-i="0"]'); await sleep(2500);
    R.sendGuard_unknownCodeForcedPastStep1 = { view: await L.view(page), reachedReviewScreen: (await L.view(page)) === 'v2', findErrBox: (await vis(page, '#findErr')) ? await txt(page, '#findErr') : null, bar: await txt(page, '#cmdText'), referCalls: await page.evaluate(() => window.__log.filter(x => x.key === 'refer').length), consoleWarnings: page.__console.filter(m => /warn|error/i.test(m)).slice(0, 3) };
    await browser.close();
  }
  { // typed known codes in any case / spacing
    const { browser, page } = await L.open(VP); await page.fill('#notes', NOTES); const rows = [];
    for (const v of ['b1p 5e7', 'B1P5E7', 'b1p5e7', 'B1P  5E7', 'b3h2y9', ' B3H 2Y9 ']) {
      await page.fill('#zip', ''); await page.click('#zip'); await page.keyboard.type(v); await page.click('#notes'); await sleep(150);
      rows.push({ typed: JSON.stringify(v), field: await page.inputValue('#zip'), pickerVisible: await vis(page, '#townWrap'), help: await txt(page, '#zipHelp') });
    }
    await page.fill('#zip', ''); await page.click('#zip'); await page.keyboard.type('b1p5e7'); await page.click('#findBtn'); await page.waitForSelector('#v2:not([hidden])', { timeout: 20000 });
    R.typedKnown = { variants: rows, anyPicker: rows.some(r => r.pickerVisible), findWithLowercaseNoSpace: 'reached ' + (await L.view(page)), zipSentToServer: await page.evaluate(() => JSON.parse(window.__log.filter(x => x.key === 'triage')[0].body).home_clinic_zip) };
    await browser.close();
  }
  return R;
}

async function c15() {
  const R = {};
  const read = async page => {
    const o = {};
    o.tileDriveSub = await txt(page, '#fDistS');
    await page.click('#pickBtn'); await sleep(250);
    o.pickSub = await txt(page, '#pickSub');
    o.pickerRows = await page.$$eval('#pickList .opt .om', els => els.map(e => e.textContent.replace(/\s+/g, ' ').trim()));
    await page.click('#pickBtn');
    await page.click('#more > summary'); await sleep(250);
    o.tableHeader = await txt(page, '#thDist');
    o.tableCells = await page.$$eval('#scoreRows tr td:nth-child(2)', els => els.map(e => e.textContent.trim()));
    o.whyLine = await txt(page, '#whyText');
    return o;
  };
  { const { browser, page } = await L.open(VP);
    await page.fill('#notes', NOTES); await page.click('#zip'); await page.keyboard.type('B3S 0B6'); await page.click('#notes'); await sleep(200);
    await page.selectOption('#town', 'B2N 1L5'); await page.click('#findBtn'); await page.waitForSelector('#v2:not([hidden])');
    R.pickedTown = await read(page); await browser.close(); }
  { const { browser, page } = await L.open(VP); await L.example(page); R.typedKnown = await read(page); await browser.close(); }
  for (const k of ['pickedTown', 'typedKnown']) { const v = R[k]; R[k].summary = { rowsWithTilde: v.pickerRows.filter(r => /~\d/.test(r)).length + '/' + v.pickerRows.length, cellsWithTilde: v.tableCells.filter(c => c.startsWith('~')).length + '/' + v.tableCells.length, pickSubSaysApproximate: /approximate/i.test(v.pickSub), headerSaysApproximate: /approximate/i.test(v.tableHeader), halifaxLineHasTilde: /vs\. Halifax: ~/.test(v.whyLine), halifaxLine: (v.whyLine.match(/vs\. Halifax:.*$/) || [''])[0] }; }
  return R;
}

async function c16() {
  const R = {}, BAD = ['Cape Breton (east)', 'Saint John NB'];
  for (const [label, code, picked] of [['East Cape Breton typed', 'B1S 1A1', false], ['East Cape Breton picked', 'B1S 1A1', true], ['Saint John typed', 'E2L 4L2', false], ['Saint John picked', 'E2L 4L2', true]]) {
    const { browser, page } = await L.open(VP, { perms: true });
    const o = {};
    o.datalist = await page.$$eval('#zipList option', os => os.map(x => `${x.value}=${x.textContent}`));
    o.pickerOptions = await page.$$eval('#town option', os => os.map(x => `${x.value}=${x.textContent}`));
    await page.fill('#notes', NOTES);
    if (!picked) { await page.click('#zip'); await page.keyboard.type(code); await page.click('#notes'); await sleep(150); o.helpLine = await txt(page, '#zipHelp'); }
    else { await page.click('#zip'); await page.keyboard.type('B3S 0B6'); await page.click('#notes'); await sleep(150); await page.selectOption('#town', code); await sleep(100); o.helpLine = await txt(page, '#zipHelp'); }
    await page.click('#findBtn'); await page.waitForSelector('#v2:not([hidden])');
    o.tileDriveSub = await txt(page, '#fDistS'); o.hospSub = await txt(page, '#hospSub');
    await page.click('#pickBtn'); await sleep(200); o.pickSub = await txt(page, '#pickSub');
    o.pickerRows = await page.$$eval('#pickList .opt', els => els.map(e => e.textContent.replace(/\s+/g, ' ').trim()));
    await page.click('#pickBtn'); await page.click('#more > summary'); await sleep(250);
    o.mapCaption = await txt(page, '#mapCap'); o.tableHospitalCells = await page.$$eval('#scoreRows tr td:nth-child(1)', els => els.map(e => e.textContent.replace(/\s+/g, ' ').trim()));
    await page.click('#hospitals > summary'); await sleep(150); o.drawerRows = await page.$$eval('#hlist .hrow .svc', els => els.map(e => e.textContent.replace(/\s+/g, ' ').trim().slice(0, 40)));
    await page.click('#sendBtn').catch(() => {}); await page.waitForSelector('#v3:not([hidden])', { timeout: 20000 });
    o.receiptFrom = await page.evaluate(() => { const dts = [...document.querySelectorAll('#rcList dt')]; const i = dts.findIndex(d => d.textContent === 'From'); return i < 0 ? null : document.querySelectorAll('#rcList dd')[i].textContent; });
    await page.click('#copyBtn'); await sleep(300);
    o.copyText = await page.evaluate(() => navigator.clipboard.readText()).catch(e => 'clipboard error: ' + e.message);
    o.copyFromLine = (o.copyText.split('\n').find(l => l.startsWith('From:')) || '');
    const everything = await page.evaluate(() => document.body.innerText + ' ' + [...document.querySelectorAll('option')].map(x => x.textContent).join(' ') + ' ' + document.querySelector('#mapCap').textContent);
    o.stillShowingZipsName = BAD.filter(b => (everything + ' ' + o.copyText + ' ' + JSON.stringify(o)).includes(b));
    R[label] = o; await browser.close();
  }
  return R;
}

(async () => {
  OUT.c14 = await c14(); fs.writeFileSync(__dirname + '/d_raw.json', JSON.stringify(OUT, null, 1)); console.log('c14 done');
  OUT.c15 = await c15(); fs.writeFileSync(__dirname + '/d_raw.json', JSON.stringify(OUT, null, 1)); console.log('c15 done');
  OUT.c16 = await c16(); fs.writeFileSync(__dirname + '/d_raw.json', JSON.stringify(OUT, null, 1)); console.log('c16 done');
})().catch(e => { console.error('ERR', e); process.exit(1); });
