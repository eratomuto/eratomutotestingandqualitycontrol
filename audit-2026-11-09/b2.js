const L = require('./lib2'); const VP = { width: 1366, height: 768 }, sleep = L.sleep;
(async () => {
  // (a) cancel at ~2 s, late answer ignores abort and really arrives
  { const { browser, page } = await L.open(VP, { cfg: { triageDelay: 12000, ignoreAbort: true } });
    const resp = []; page.on('response', r => { if (r.url().includes('/triage')) resp.push(Date.now()); });
    const snap = () => page.evaluate(() => { const $ = s => document.querySelector(s), vis = el => !el.hidden && el.getClientRects().length > 0; return { view: ['v1','v2','v3'].find(id => !$('#' + id).hidden), bar: $('#cmdText').textContent, findErr: vis($('#findErr')) ? $('#findErr').textContent : '', hospList: $('#hlist').innerText, hospName: $('#hospName').textContent, find: $('#findBtn').disabled + '|' + $('#findBtn').textContent, cancelVisible: vis($('#cancelFindBtn')), active: document.activeElement.id, notes: $('#notes').value, zip: $('#zip').value }; });
    await page.click('.ex[data-i="0"]'); const t0 = Date.now(); await sleep(2000); await page.click('#cancelFindBtn'); await sleep(500);
    const a = await snap(); await sleep(15500); const b = await snap();
    const d = []; for (const k of Object.keys(a)) if (a[k] !== b[k]) d.push(k + ': ' + JSON.stringify(a[k]) + ' -> ' + JSON.stringify(b[k]));
    console.log('(a) late answer ignoring abort: triage responses received:', resp.length, 'arrived at', resp.map(t => t - t0 + ' ms after Find'), '| state after cancel:', a.view, '| 15 s later:', b.view, '| changes:', d.length ? d.join('; ') : 'none');
    await browser.close(); }
  // (b) picker-open slow send, timing anchored to the click's return and to the app's own fetch timestamp
  { const { browser, page } = await L.open(VP);
    await L.example(page); await page.click('#pickBtn'); await sleep(800);
    await L.setCfg(page, { referDelay: 12000 });
    await page.click('#sendBtn'); const t0 = Date.now();
    const sample = async (ms) => { await sleep(Math.max(0, t0 + ms - Date.now())); return page.evaluate(() => ({ bar: document.querySelector('#cmdText').textContent, btn: document.querySelector('#sendBtn').textContent, appFetchAgeMs: Math.round(performance.now() - window.__log.filter(x => x.key === 'refer')[0].t) })); };
    console.log('(b) picker open, slow send: at 7.5 s after click:', JSON.stringify(await sample(7500)));
    console.log('    at 8.5 s after click:', JSON.stringify(await sample(8500)));
    await page.waitForSelector('#v3:not([hidden])', { timeout: 30000 }); await browser.close(); }
})().catch(e => { console.error('ERR', e); process.exit(1); });
