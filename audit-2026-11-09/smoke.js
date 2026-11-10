const L = require('./lib');
(async () => {
  const { browser, page } = await L.open({ width: 1366, height: 768 });
  const info = await page.evaluate(() => ({
    fonts: [...document.fonts].map(f => f.family + ' ' + f.weight + ' ' + f.status),
    bodyFont: getComputedStyle(document.body).fontFamily,
    overpass: document.fonts.check('18px Overpass'),
    conn: document.querySelector('#conn').textContent,
    cmdH: getComputedStyle(document.documentElement).getPropertyValue('--cmd-h'),
  }));
  console.log(JSON.stringify(info, null, 1));
  await browser.close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
