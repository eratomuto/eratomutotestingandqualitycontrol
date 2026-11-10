const L = require('./lib');
(async () => {
  for (const vp of [{ n: '1366x768', width: 1366, height: 768 }, { n: '360x800', width: 360, height: 800 }]) {
    for (const barMode of ['normal bar', 'tall bar']) {
      const { browser, page } = await L.open({ width: vp.width, height: vp.height });
      await L.install(page);
      await L.toStep2(page);
      await page.click('#more > summary');
      await L.sleep(300);
      let bar = null;
      if (barMode === 'tall bar') bar = await L.tallBar(page);
      const stops = await L.walk(page);
      const rev = await L.walk(page, { mode: 'reverse' });
      const pick = a => a.find(s => s.el.startsWith('div.tbl'));
      const f = pick(stops), r = pick(rev);
      const info = await page.evaluate(() => ({ cmdH: window.__a.cmdH(), vh: innerHeight }));
      const show = s => s && { top: +s.top.toFixed(1), h: +s.h.toFixed(1), barBottom: +s.barBottom.toFixed(1), gap: +s.gap.toFixed(1), visibleBelowBar: +(Math.min(s.top + s.h, info.vh) - Math.max(s.top, s.barBottom)).toFixed(1) };
      console.log(vp.n, barMode, '--cmd-h', info.cmdH.var, 'viewport h', info.vh, '\n  Tab      ', JSON.stringify(show(f)), '\n  Shift+Tab', JSON.stringify(show(r)));
      await browser.close();
    }
  }
})().catch(e => { console.error('ERR', e); process.exit(1); });
