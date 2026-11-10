const L = require('./lib');
(async () => {
  const { browser, page } = await L.open({ width: 1366, height: 768 });
  const rec = () => page.evaluate(() => {
    window.__changes = []; const t0 = performance.now();
    const add = (what, el) => window.__changes.push({ ms: Math.round(performance.now() - t0), what, text: el.textContent.trim().slice(0, 70) });
    for (const [what, sel] of [['bar', '#cmdText'], ['findBtn', '#findBtn'], ['sendBtn', '#sendBtn']])
      new MutationObserver(() => add(what, document.querySelector(sel))).observe(document.querySelector(sel), { childList: true, characterData: true, subtree: true });
  });
  await rec();
  await page.click('.ex[data-i="0"]');
  await page.waitForSelector('#v2:not([hidden])');
  await L.sleep(9500);
  const find = await page.evaluate(() => window.__changes);
  console.log('FAST FIND: every change recorded to bar/buttons over ~10 s:'); find.forEach(c => console.log('  ', JSON.stringify(c)));
  console.log('  any "longer than usual":', find.some(c => /longer than usual/.test(c.text)));
  await rec();
  await page.click('#sendBtn');
  await page.waitForSelector('#v3:not([hidden])');
  await L.sleep(9500);
  const send = await page.evaluate(() => window.__changes);
  console.log('FAST SEND: every change recorded over ~10 s:'); send.forEach(c => console.log('  ', JSON.stringify(c)));
  console.log('  any "longer than usual":', send.some(c => /longer than usual/.test(c.text)));
  await browser.close();
})().catch(e => { console.error('ERR', e); process.exit(1); });
