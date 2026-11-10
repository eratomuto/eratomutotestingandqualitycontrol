const fs = require('fs');
const L = require('./lib2');
const sleep = L.sleep, VP = { width: 1366, height: 768 }, OUT = {};
const stub = (u, sp = 'Cardiology') => ({ triageStub: { urgency_score: u, primary_specialty_required: sp, key_symptoms: ['chest pain'], acute_risks: ['possible heart attack'], current_medications: ['aspirin'] } });
const rows = page => page.evaluate(() => { const dt = [...document.querySelectorAll('#rcList dt')], dd = [...document.querySelectorAll('#rcList dd')]; const o = {}; dt.forEach((d, i) => { o[d.textContent] = dd[i].textContent; }); return o; });
const copy = async page => { await page.click('#copyBtn'); await sleep(250); return page.evaluate(() => navigator.clipboard.readText()).catch(e => 'ERR ' + e.message); };
const review = page => page.evaluate(() => { const $ = s => document.querySelector(s); return { pill: $('#urgPill').textContent, pillClass: $('#urgPill').className, hospital: $('#hospName').textContent, sub: $('#hospSub').textContent, why: $('#whyText').innerText.replace(/\s+/g, ' '), driveTile: $('#fDist').textContent + ' / ' + $('#fDistS').textContent, waitTile: $('#fWait').textContent + ' / ' + $('#fWaitS').textContent, needTile: $('#fNeed').textContent + ' / ' + $('#fNeedS').textContent, bar: $('#cmdText').textContent, check: !$('#checkNote').hidden ? $('#checkNote').textContent : null, active: document.activeElement.id }; });
const refBody = page => page.evaluate(() => { const l = window.__log.filter(x => x.key === 'refer'); return l.length ? JSON.parse(l[l.length - 1].body) : null; });
const tierOf = u => u >= 8 ? 'high' : u >= 4 ? 'med' : 'low';
const WHYSTART = { high: 'Why: Emergency, so', med: 'Why: Should be seen soon', low: 'Why: Routine, so' };
const TIERNAME = { high: 'Emergency', med: 'See soon', low: 'Routine' };

async function fixCase(label, start, apply) {
  const { browser, page } = await L.open(VP, { cfg: stub(start.u, start.sp), perms: true });
  await L.example(page);
  const before = await review(page);
  await page.click('#fixBtn'); await page.waitForSelector('#fixPanel:not([hidden])');
  const panelOpts = await page.evaluate(() => ({ urgency: [...document.querySelectorAll('#fixUrg option')].map(o => o.textContent), specialties: [...document.querySelectorAll('#fixSpec option')].map(o => o.textContent), expanded: document.querySelector('#fixBtn').getAttribute('aria-expanded') }));
  if (apply.u) await page.selectOption('#fixUrg', String(apply.u));
  if (apply.sp) await page.selectOption('#fixSpec', apply.sp);
  await page.click('#fixApply'); await sleep(300);
  const after = await review(page);
  const wantU = apply.u || start.u, wantSp = apply.sp || start.sp, tier = tierOf(wantU);
  await L.send(page);
  const body = await refBody(page), rc = await rows(page), ct = await copy(page);
  const agree = {
    pillNumber: after.pill.startsWith(wantU + '/10'), pillTierName: after.pill.includes(TIERNAME[tier]), pillColourClass: after.pillClass.includes(tier),
    whyLineTier: after.why.startsWith(WHYSTART[tier]), needTile: after.needTile.startsWith(wantSp), barMentionsChange: /You set/.test(after.bar),
    requestUrgency: body.urgency_score === wantU, requestSpecialty: body.primary_specialty_required === wantSp,
    receiptUrgencyRow: rc['Urgency'].startsWith(wantU + '/10'), receiptHospitalEqualsReviewPick: rc['To'] === after.hospital,
    receiptDistanceEqualsTile: rc['Distance'] === after.driveTile.split(' / ')[0], receiptWaitEqualsTile: rc['Expected wait'].startsWith(after.waitTile.split(' / ')[0]),
    activeAfterApply: after.active,
  };
  const r = { start, apply, before: { pill: before.pill, hospital: before.hospital, why: before.why.slice(0, 60) }, after, requestBody: { urgency_score: body.urgency_score, primary_specialty_required: body.primary_specialty_required }, receipt: { Urgency: rc['Urgency'], 'Urgency set by': rc['Urgency set by'], 'Specialty set by': rc['Specialty set by'] || '(no row)', To: rc['To'] }, copyRows: ct.split('\n').filter(l => /^(Urgency|Specialty set by)/.test(l)), agree, allAgree: Object.entries(agree).filter(([k]) => k !== 'activeAfterApply').every(([, v]) => v === true), panelOptions: label.startsWith('3->4') ? panelOpts : undefined };
  await browser.close(); return [label, r];
}

async function c17() {
  const R = {};
  for (const [label, start, apply] of [
    ['3->4 (Routine -> See soon)', { u: 3, sp: 'Cardiology' }, { u: 4 }], ['4->3 (See soon -> Routine)', { u: 4, sp: 'Cardiology' }, { u: 3 }],
    ['7->8 (See soon -> Emergency)', { u: 7, sp: 'Cardiology' }, { u: 8 }], ['8->7 (Emergency -> See soon)', { u: 8, sp: 'Cardiology' }, { u: 7 }],
    ['specialty only Cardiology->Orthopedics', { u: 7, sp: 'Cardiology' }, { sp: 'Orthopedics' }], ['urgency 5->9 and specialty Cardiology->Neurology', { u: 5, sp: 'Cardiology' }, { u: 9, sp: 'Neurology' }],
  ]) { const [k, v] = await fixCase(label, start, apply); R[k] = v; }
  // no hospital offers the specialty
  { const { browser, page } = await L.open(VP, { cfg: { ...stub(7), dropSpecialty: 'Oncology' } });
    await L.example(page); const before = await review(page);
    await page.click('#fixBtn'); await page.selectOption('#fixSpec', 'Oncology'); await page.click('#fixApply'); await sleep(300);
    const st = await page.evaluate(() => ({ msg: document.querySelector('#fixMsg').innerText.replace(/\s+/g, ' '), msgVisible: !document.querySelector('#fixMsg').hidden, panelOpen: !document.querySelector('#fixPanel').hidden, sendDisabled: document.querySelector('#sendBtn').disabled, bar: document.querySelector('#cmdText').textContent, pill: document.querySelector('#urgPill').textContent, hospital: document.querySelector('#hospName').textContent, fixBtnDisabled: document.querySelector('#fixBtn').disabled }));
    await sleep(900); await page.keyboard.press('Control+Enter'); await sleep(400);
    const afterShortcut = await page.evaluate(() => ({ referCalls: window.__log.filter(x => x.key === 'refer').length, view: ['v1', 'v2', 'v3'].find(id => !document.getElementById(id).hidden) }));
    await page.click('#fixCancel'); await sleep(200);
    const afterCancel = await page.evaluate(() => ({ panelOpen: !document.querySelector('#fixPanel').hidden, sendDisabled: document.querySelector('#sendBtn').disabled, active: document.activeElement.id, hospital: document.querySelector('#hospName').textContent }));
    R['specialty no hospital offers (Oncology removed from /hubs)'] = { hospitalBefore: before.hospital, ...st, afterCtrlEnter: afterShortcut, afterCancel }; await browser.close(); }
  // Apply with nothing changed
  { const { browser, page } = await L.open(VP, { cfg: stub(7), perms: true });
    await L.example(page); const b = await review(page); await page.click('#fixBtn'); await page.click('#fixApply'); await sleep(300); const a = await review(page);
    const panelHidden = await page.evaluate(() => document.querySelector('#fixPanel').hidden); await L.send(page); const rc = await rows(page);
    R['Apply with nothing changed'] = { panelClosed: panelHidden, activeAfter: a.active, pillSame: b.pill === a.pill, hospitalSame: b.hospital === a.hospital, barSame: b.bar === a.bar, receipt: { 'Urgency set by': rc['Urgency set by'], 'Specialty set by': rc['Specialty set by'] || '(no row)' } }; await browser.close(); }
  // sources
  const src = {};
  for (const [label, o] of [['AI (stubbed AI-style result)', { cfg: stub(7) }], ['Keyword guess (server keyword mode)', {}], ['Practice guess (server not running)', { practice: true }]]) {
    const { browser, page } = await L.open(VP, { ...o, perms: true }); await L.example(page); await L.send(page);
    const rc = await rows(page), ct = await copy(page);
    await page.emulateMedia({ media: 'print' }); const printed = await page.evaluate(() => document.querySelector('#v3').innerText.replace(/\s+/g, ' '));
    src[label] = { screen: rc['Urgency set by'], specialtyRow: rc['Specialty set by'] || '(no row)', copy: (ct.split('\n').find(l => l.startsWith('Urgency set by')) || '(missing)'), printHasRow: /Urgency set by\s*[A-Za-z ]+/.test(printed) && printed.includes('Urgency set by ' + rc['Urgency set by']) };
    await browser.close();
  }
  R.sources = src;
  // doctor source (receipt, copy, print)
  { const { browser, page } = await L.open(VP, { cfg: stub(7), perms: true }); await L.example(page);
    await page.click('#fixBtn'); await page.selectOption('#fixUrg', '9'); await page.click('#fixApply'); await sleep(200); await L.send(page);
    const rc = await rows(page), ct = await copy(page); await page.emulateMedia({ media: 'print' }); const printed = await page.evaluate(() => document.querySelector('#v3').innerText.replace(/\s+/g, ' '));
    R.sources['Doctor (urgency changed)'] = { screen: rc['Urgency set by'], specialtyRow: rc['Specialty set by'] || '(no row)', copy: (ct.split('\n').find(l => l.startsWith('Urgency set by')) || '(missing)'), printHasRow: printed.includes('Urgency set by Doctor') }; await browser.close(); }
  { const { browser, page } = await L.open(VP, { cfg: stub(7), perms: true }); await L.example(page);
    await page.click('#fixBtn'); await page.selectOption('#fixSpec', 'Neurology'); await page.click('#fixApply'); await sleep(200); await L.send(page);
    const rc = await rows(page), ct = await copy(page); await page.emulateMedia({ media: 'print' }); const printed = await page.evaluate(() => document.querySelector('#v3').innerText.replace(/\s+/g, ' '));
    R.sources['Doctor (specialty only changed)'] = { screen: rc['Urgency set by'], specialtyRow: rc['Specialty set by'] || '(no row)', copy: ct.split('\n').filter(l => /^(Urgency set by|Specialty set by)/.test(l)), printHasSpecialtyRow: printed.includes('Specialty set by Doctor') }; await browser.close(); }
  // panel clears on Back, Next patient, new Find; doctor flags reset
  { const { browser, page } = await L.open(VP, { cfg: stub(7), perms: true }); const out = {};
    const panel = () => page.evaluate(() => ({ hidden: document.querySelector('#fixPanel').hidden, expanded: document.querySelector('#fixBtn').getAttribute('aria-expanded') }));
    await L.example(page); await page.click('#fixBtn'); out.openedPanel = await panel();
    await page.click('#backBtn'); await sleep(250); out.afterBack = { ...(await panel()), view: await L.view(page) };
    await L.example(page); out.afterNewFindFromBack = await panel();
    await page.click('#fixBtn'); await page.selectOption('#fixUrg', '9'); await page.click('#fixApply'); await sleep(200); await page.click('#fixBtn'); out.reopened = await panel();
    await page.click('#backBtn'); await sleep(250); await L.example(page); out.afterNewFindAfterApply = await panel();
    await L.send(page); const rc = await rows(page); out.receiptAfterBackThenNewFind = rc['Urgency set by'];
    await page.click('#newBtn'); await sleep(250); await L.example(page); out.afterNextPatientAndNewFind = await panel();
    await page.click('#fixBtn'); out.panelOpenedOnNewPatient = await panel(); await page.click('#fixCancel');
    await page.evaluate(() => { document.querySelector('#fixBtn').click(); }); await page.click('#pickBtn'); out.afterOpeningPicker = await panel();
    R.panelClearing = out; await browser.close(); }
  return R;
}

async function c18() {
  const R = {};
  for (const [label, o] of [['practice mode', { practice: true, perms: true }], ['server mode', { perms: true }]]) {
    const { browser, page } = await L.open(VP, o); await L.example(page); await L.send(page);
    const info = await page.evaluate(() => { const dts = [...document.querySelectorAll('#rcList dt')].map(d => d.textContent); return { headline: document.querySelector('#rcH').textContent, v3Label: document.querySelector('#v3').getAttribute('aria-label'), bar: document.querySelector('#cmdText').textContent, timeRowLabel: dts.find(d => /^(Sent|Practice run)$/.test(d)) || '(none)', allRowLabels: dts }; });
    const ct = await copy(page); const lines = ct.split('\n');
    await page.emulateMedia({ media: 'print' });
    const pr = await page.evaluate(() => { const first = document.querySelector('#v3').firstElementChild; const d = document.querySelector('#printDemo'); const cs = getComputedStyle(d); const hidden = ['.top', '.cmd', '#v1', '#v2', '.foot', '.hosp', '#v3 .actions'].filter(s => { const e = document.querySelector(s); return e && getComputedStyle(e).display === 'none'; }); return { firstChildIsDemoBanner: first === d, demoBannerDisplay: cs.display, demoBannerText: d.textContent, headline: document.querySelector('#rcH').textContent, timeRow: [...document.querySelectorAll('#rcList dt')].map(x => x.textContent).filter(x => /^(Sent|Practice run)$/.test(x)), hiddenInPrint: hidden }; });
    R[label] = { ...info, copyFirstLine: lines[0], copySecondLine: lines[1], copyHasPracticeHeadline: ct.includes('Practice referral (nothing was sent)'), copyTimeRowLabel: (lines.find(l => /^(Sent|Practice run):/.test(l)) || '').split(':')[0], print: pr };
    await browser.close();
  }
  return R;
}

(async () => {
  OUT.c17 = await c17(); fs.writeFileSync(__dirname + '/e_raw.json', JSON.stringify(OUT, null, 1)); console.log('c17 done');
  OUT.c18 = await c18(); fs.writeFileSync(__dirname + '/e_raw.json', JSON.stringify(OUT, null, 1)); console.log('c18 done');
})().catch(e => { console.error('ERR', e); process.exit(1); });
