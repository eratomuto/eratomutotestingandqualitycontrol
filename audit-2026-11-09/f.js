const fs = require('fs');
const L = require('./lib2');
const sleep = L.sleep, VP = { width: 1366, height: 768 }, OUT = {};
const INPUTS = [
  ['crushing chest pain, ST elevation, troponin elevated', 'B1P 5E7'], ['chronic knee pain, MRI shows meniscus tear', 'B2N 1L5'],
  ['persistent right lower quadrant pain, fever, suspect appendicitis', 'B4N 1V5'], ['severe headache with seizure and weakness on the left side', 'B0W 2M0'],
  ['tumor found on scan, cancer follow-up needed', 'B0N 1X0'], ['routine check of hip joint pain, chronic', 'B2H 1A1'],
];
const rows = page => page.evaluate(() => { const dt = [...document.querySelectorAll('#rcList dt')], dd = [...document.querySelectorAll('#rcList dd')]; const o = {}; dt.forEach((d, i) => { o[d.textContent] = dd[i].textContent; }); return o; });
const rev = page => page.evaluate(() => { const $ = s => document.querySelector(s); return { hospital: $('#hospName').textContent, km: $('#fDist').textContent, wait: $('#fWait').textContent, urgency: $('#urgPill').textContent.split('/')[0], specialty: $('#fNeed').textContent }; });

async function run(mode, notes, zip, stubTriage) {
  const { browser, page } = await L.open(VP, { practice: mode === 'practice', cfg: stubTriage ? { triageStub: stubTriage } : null });
  await L.find(page, notes, zip); const r = await rev(page);
  await L.send(page); const rc = await rows(page); const bar = await page.evaluate(() => document.querySelector('#cmdText').textContent);
  await browser.close();
  const specName = rc['Urgency'].split(', ')[1] || '';
  return { review: r, receipt: { to: rc['To'], distance: rc['Distance'], wait: rc['Expected wait'], urgency: rc['Urgency'].split('/')[0] }, hospitalsChangedBanner: /Hospitals changed/.test(bar),
    agree: { hospital: rc['To'] === r.hospital, distance: rc['Distance'] === r.km, wait: rc['Expected wait'].startsWith(r.wait), urgency: rc['Urgency'].split('/')[0] === r.urgency } };
}

async function c19() {
  const R = [];
  for (const [notes, zip] of INPUTS) {
    const server = await run('server', notes, zip), practice = await run('practice', notes, zip);
    const stub = { urgency_score: +practice.review.urgency, primary_specialty_required: practice.review.specialty, key_symptoms: ['x'], acute_risks: [], current_medications: [] };
    const serverSame = await run('server', notes, zip, stub);
    R.push({ notes: notes.slice(0, 40), zip, server: { pick: server.review.hospital, urg: server.review.urgency, sp: server.review.specialty, km: server.review.km, wait: server.review.wait, agree: server.agree, bannerShown: server.hospitalsChangedBanner },
      practice: { pick: practice.review.hospital, urg: practice.review.urgency, sp: practice.review.specialty, km: practice.review.km, wait: practice.review.wait, agree: practice.agree, bannerShown: practice.hospitalsChangedBanner },
      serverWithPracticeTriage: { pick: serverSame.review.hospital, agree: serverSame.agree },
      samePickNaturally: server.review.hospital === practice.review.hospital, sameTriageNaturally: server.review.urgency === practice.review.urgency && server.review.specialty === practice.review.specialty,
      samePickWhenTriageEqualised: serverSame.review.hospital === practice.review.hospital && serverSame.review.km === practice.review.km && serverSame.review.wait === practice.review.wait });
  }
  return R;
}

async function c20() {
  const R = {}; const calls = (p, k) => p.evaluate(k => window.__log.filter(x => x.key === k).length, k);
  { // held Ctrl+Enter: repeat after the cooldown must do nothing
    const { browser, page } = await L.open(VP); await page.fill('#notes', 'chest pain for two hours'); await page.fill('#zip', 'B1P 5E7'); await page.click('#notes');
    await page.keyboard.down('Control'); await page.keyboard.down('Enter');
    await page.waitForSelector('#v2:not([hidden])'); await sleep(1300);
    for (let i = 0; i < 5; i++) { await page.keyboard.down('Enter'); await sleep(60); }
    await page.keyboard.up('Enter'); await page.keyboard.up('Control'); await sleep(500);
    R.heldCtrlEnter_repeatsAfterCooldown = { view: await L.view(page), triageCalls: await calls(page, 'triage'), referCalls: await calls(page, 'refer') };
    await page.keyboard.press('Control+Enter'); await sleep(700);
    R.heldCtrlEnter_thenFreshPress = { view: await L.view(page), referCalls: await calls(page, 'refer') };
    await sleep(1200); await page.keyboard.press('Control+Enter'); await sleep(500);
    R.receipt_ctrlEnter = { view: await L.view(page), triageCalls: await calls(page, 'triage'), referCalls: await calls(page, 'refer') };
    await page.keyboard.press('Meta+Enter'); await page.keyboard.press('F1'); await sleep(500);
    R.receipt_metaEnter_F1 = { view: await L.view(page), triageCalls: await calls(page, 'triage'), referCalls: await calls(page, 'refer'), notes: await page.inputValue('#notes') };
    await browser.close();
  }
  { // cooldown after Find (fresh press 300 ms after step 2 appears), then after the cooldown
    const { browser, page } = await L.open(VP); await L.example(page); const t = Date.now(); await sleep(300);
    await page.keyboard.press('Control+Enter'); await sleep(150);
    R.ctrlEnter_300msAfterFind = { view: await L.view(page), referCalls: await calls(page, 'refer') };
    await sleep(900); await page.keyboard.press('Control+Enter'); await sleep(600);
    R.ctrlEnter_1300msAfterFind = { view: await L.view(page), referCalls: await calls(page, 'refer') };
    await browser.close();
  }
  { // cooldown after Back for F1-F3, and after Next patient
    const { browser, page } = await L.open(VP); await L.example(page); await sleep(1000); await page.click('#backBtn'); await sleep(300);
    await page.fill('#notes', 'typed after back'); await page.click('#zip'); await page.keyboard.press('F2'); await sleep(300);
    R.F2_300msAfterBack = { view: await L.view(page), notes: await page.inputValue('#notes'), triageCalls: await calls(page, 'triage') };
    await sleep(900); await page.keyboard.press('F2'); await sleep(700);
    R.F2_1500msAfterBack = { view: await L.view(page), notes: (await page.inputValue('#notes')).slice(0, 30), triageCalls: await calls(page, 'triage') };
    await sleep(1000); await L.send(page); await sleep(1000); await page.click('#newBtn'); await sleep(300); await page.keyboard.press('F1'); await sleep(300);
    R.F1_300msAfterNextPatient = { view: await L.view(page), notes: await page.inputValue('#notes') };
    await sleep(900); await page.keyboard.press('F1'); await sleep(700);
    R.F1_1500msAfterNextPatient = { view: await L.view(page), notes: (await page.inputValue('#notes')).slice(0, 30) };
    await browser.close();
  }
  { // held F2 (key repeat) after the cooldown
    const { browser, page } = await L.open(VP); await sleep(1200); await page.click('#notes');
    await page.keyboard.down('F3'); for (let i = 0; i < 5; i++) { await page.keyboard.down('F3'); await sleep(50); } await page.keyboard.up('F3'); await sleep(1500);
    R.heldF3 = { triageCalls: await calls(page, 'triage'), view: await L.view(page) };
    await browser.close();
  }
  return R;
}

async function c21() {
  const R = {}, SENT = 'PRIVSENTINEL9QX7';
  for (const mode of ['server', 'practice']) {
    const { browser, ctx, page } = await L.open(VP, { practice: mode === 'practice', perms: true });
    await L.find(page, `${SENT} chest pain for two hours with shortness of breath`, 'B1P 5E7');
    await page.click('#fixBtn'); await page.selectOption('#fixUrg', '9'); await page.click('#fixApply'); await sleep(200);
    await page.click('#pickBtn'); await page.click('#pickBtn'); await L.send(page); await page.click('#copyBtn'); await sleep(300);
    const clip = await page.evaluate(() => navigator.clipboard.readText());
    const dump = await page.evaluate(() => ({ href: location.href, title: document.title, hash: location.hash, local: JSON.stringify(Object.fromEntries(Object.entries(localStorage))), session: JSON.stringify(Object.fromEntries(Object.entries(sessionStorage))), historyState: JSON.stringify(history.state) }));
    const reqs = page.__reqs;
    const hosts = [...new Set(reqs.map(r => { try { const u = new URL(r.url); return u.protocol === 'http:' || u.protocol === 'https:' ? u.host : u.protocol; } catch { return r.url.slice(0, 20); } }))];
    const inUrl = reqs.filter(r => r.url.includes(SENT) || r.url.includes(encodeURIComponent(SENT)));
    const postWithNote = reqs.filter(r => r.post.includes(SENT)).map(r => r.method + ' ' + new URL(r.url).pathname);
    R[mode] = { requestCount: reqs.length, networkHosts: hosts, thirdPartyOrFontRequests: reqs.filter(r => /fonts\.g|googleapis|gstatic/.test(r.url)).map(r => r.url), sentinelInAnyRequestUrl: inUrl.length, sentinelInLocation: JSON.stringify(dump).includes(SENT) ? 'FOUND in ' + Object.entries(dump).filter(([, v]) => String(v).includes(SENT)).map(([k]) => k).join(',') : false, sentinelInLocalStorage: dump.local.includes(SENT), sentinelInSessionStorage: dump.session.includes(SENT), localStorageKeys: Object.keys(JSON.parse(dump.local)), sessionStorageKeys: Object.keys(JSON.parse(dump.session)), consoleMessages: page.__console.length, sentinelInConsole: page.__console.filter(m => m.includes(SENT)), consoleSample: page.__console.slice(0, 5), requestBodiesContainingNote_expectedOnlyToLocalServer: postWithNote, sentinelInCopiedReceipt: clip.includes(SENT), finalUrl: dump.href };
    await browser.close();
  }
  return R;
}

async function c22() {
  const R = {}, NOTICE = "DEMO: simulated hospitals, not a real referral. Don't use it for real clinical decisions.", TAG = 'RUSH points each one to whoever can see the patient soonest.';
  const { browser, page } = await L.open(VP, { perms: true });
  const read = async () => page.evaluate(() => ({ footer: document.querySelector('#footDemo').innerText, footerVisible: document.querySelector('#footDemo').getClientRects().length > 0, printBanner: document.querySelector('#printDemo').textContent, tagline: document.querySelector('.why-rush b') && document.querySelector('.why-rush b').innerText, taglineParagraph: document.querySelector('.why-rush').innerText }));
  R.step1 = await read(); await L.example(page); R.step2 = await read(); await L.send(page); R.step3 = await read();
  await page.click('#copyBtn'); await sleep(250); R.copyFirstLine = (await page.evaluate(() => navigator.clipboard.readText())).split('\n')[0];
  R.expected = { notice: NOTICE, tagline: TAG };
  R.matches = { tagline: R.step1.tagline === TAG, footerStep1: R.step1.footer === NOTICE, footerStep2: R.step2.footer === NOTICE, footerStep3: R.step3.footer === NOTICE, printBannerAllSteps: [R.step1, R.step2, R.step3].every(s => s.printBanner === NOTICE), copyFirstLine: R.copyFirstLine === NOTICE };
  await browser.close(); return R;
}

(async () => {
  OUT.c19 = await c19(); fs.writeFileSync(__dirname + '/f_raw.json', JSON.stringify(OUT, null, 1)); console.log('c19 done');
  OUT.c20 = await c20(); fs.writeFileSync(__dirname + '/f_raw.json', JSON.stringify(OUT, null, 1)); console.log('c20 done');
  OUT.c21 = await c21(); OUT.c22 = await c22(); fs.writeFileSync(__dirname + '/f_raw.json', JSON.stringify(OUT, null, 1)); console.log('c21-22 done');
})().catch(e => { console.error('ERR', e); process.exit(1); });
