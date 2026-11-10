const fs = require('fs');
const L = require('./lib2');
const VPS = [{ name: '1366x768', width: 1366, height: 768 }, { name: '360x800', width: 360, height: 800 }];
const R = { ratios: {}, walks: {}, focusAfter: {}, small: {}, narrow: {} };
const short = x => x.split(' "')[0];

const STATES = {
  'step1': async p => {},
  'step1+townpicker(blocked Find, aria-invalid)': async p => { await p.fill('#notes', 'chest pain for two hours'); await p.fill('#zip', 'B3S 0B6'); await p.click('#findBtn'); await p.waitForSelector('#townWrap:not([hidden])'); },
  'step2': async p => { await L.example(p); },
  'step2+F1 panel open': async p => { await L.example(p); await p.click('#fixBtn'); await p.waitForSelector('#fixPanel:not([hidden])'); },
  'step2+picker+details open': async p => { await L.example(p); await p.click('#pickBtn'); await p.click('#more > summary'); await p.click('#hospitals > summary'); await L.sleep(400); },
  'step2+override mismatch (warning+useRush in banner)': async p => { await L.example(p); await p.click('#pickBtn'); await p.click('#pickList .opt.no'); await p.waitForSelector('#mismatchNote:not([hidden])'); },
  'step3': async p => { await L.example(p); await L.send(p); },
  'step3+hospitals open': async p => { await L.example(p); await L.send(p); await p.click('#hospitals > summary'); await L.sleep(300); },
};

async function ratios(vp) {
  const out = {};
  const run = async (label, setup, cfg) => { const { browser, page } = await L.open(vp, { cfg }); await setup(page); out[label] = await L.ratio(page); await browser.close(); };
  await run('step1', async p => {});
  await run('step1 after Find error (triage {} -> unreadable)', async p => { await p.click('.ex[data-i="0"]'); await p.waitForSelector('#findErr:not([hidden])'); }, { triageRaw: '{}' });
  await run('step2 (keyword result: check first)', async p => { await L.example(p); });
  await run('step2 (AI-style stub, no warning)', async p => { await L.example(p); }, { triageStub: L.STUB_AI });
  await run('step2 after override to a hospital that does not offer the specialty', async p => { await L.example(p); await p.click('#pickBtn'); await p.click('#pickList .opt.no'); await p.waitForSelector('#mismatchNote:not([hidden])'); });
  await run('step2 with F1 panel open', async p => { await L.example(p); await p.click('#fixBtn'); });
  await run('step2 during slow send (/refer +12 s, at 9 s)', async p => { await L.example(p); await p.evaluate(() => { window.__cfg.referDelay = 12000; }); await p.click('#sendBtn'); await L.sleep(9000); }, null);
  await run('step3', async p => { await L.example(p); await L.send(p); });
  return out;
}

(async () => {
  for (const vp of VPS) {
    R.ratios[vp.name] = await ratios(vp);
    // ---- checks 2,3,4: tall bar, Tab walks, indicator, order ----
    for (const [label, build] of Object.entries(STATES)) {
      const { browser, page } = await L.open(vp);
      await build(page);
      const bar = await L.tallBar(page);
      const stops = await L.walk(page), worst = await L.walk(page, { scrollBottom: true }), rev = await L.walk(page, { mode: 'reverse' });
      R.walks[vp.name + ' | ' + label] = { bar, stops, worst, rev, tabOrder: stops.map(s => s.el), visualOrder: L.visualOrder(stops).map(s => s.el) };
      await browser.close();
    }
    // ---- check 5: focus after changes ----
    {
      const r = {};
      let s = await L.open(vp); let p = s.page;
      await L.example(p); r.afterFind = await L.activeId(p);
      await p.click('#fixBtn'); await p.selectOption('#fixUrg', '9'); await p.click('#fixApply'); await L.sleep(200); r.afterF1Apply = await L.activeId(p);
      await L.send(p); r.afterSend = await L.activeId(p);
      await p.click('#newBtn'); await L.sleep(200); r.afterNextPatient = await L.activeId(p);
      await L.example(p); await p.click('#backBtn'); await L.sleep(200); r.afterBack = await L.activeId(p);
      await s.browser.close();
      s = await L.open(vp, { cfg: { refer500: true } }); p = s.page;
      await L.example(p); await p.click('#sendBtn'); await p.waitForSelector('#sendErr:not([hidden])'); await L.sleep(300); r.afterFailedSend = await L.activeId(p);
      await s.browser.close();
      R.focusAfter[vp.name] = r;
    }
    // ---- check 6: text under 14px ----
    for (const label of ['step1', 'step1+townpicker(blocked Find, aria-invalid)', 'step2+picker+details open', 'step2+F1 panel open', 'step3+hospitals open']) {
      const { browser, page } = await L.open(vp);
      await STATES[label](page);
      if (label === 'step2+F1 panel open') { await page.click('#more > summary'); await L.sleep(200); }
      R.small[vp.name + ' | ' + label] = await page.evaluate(() => {
        const out = {};
        for (const el of document.body.querySelectorAll('*')) {
          if (el.closest('script,style,.sr-only')) continue;
          if (![...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) continue;
          if (!el.getClientRects().length) continue;
          const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden') continue;
          const fs = parseFloat(cs.fontSize);
          if (fs < 14) { const k = el.tagName.toLowerCase() + '.' + (typeof el.className === 'string' ? el.className : (el.className.baseVal || '')) + ' ' + fs + 'px'; (out[k] = out[k] || { n: 0, sample: [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join(' ').slice(0, 24) }).n++; }
        }
        return out;
      });
      await browser.close();
    }
    // ---- check 7: narrow layout ----
    if (vp.width === 360) {
      for (const label of ['step1', 'step1+townpicker(blocked Find, aria-invalid)', 'step2', 'step2+F1 panel open', 'step2+picker+details open', 'step3', 'step3+hospitals open']) {
        const { browser, page } = await L.open(vp);
        await STATES[label](page);
        if (label === 'step2') { await page.click('#pickBtn'); await L.sleep(300); }
        R.narrow[label] = await page.evaluate(() => {
          const de = document.documentElement, W = de.clientWidth;
          const lines = el => { if (!el) return null; const rg = document.createRange(); rg.selectNodeContents(el); return new Set([...rg.getClientRects()].filter(r => r.width > 0).map(r => Math.round(r.top))).size; };
          const over = [];
          for (const el of document.body.querySelectorAll('*')) { if (el.closest('.sr-only,script,style,.tbl,svg,[hidden],details:not([open]) > :not(summary)')) continue; const r = el.getBoundingClientRect(); if (r.width && r.right > W + 0.5) over.push(el.tagName.toLowerCase() + (el.id ? '#' + el.id : '.' + el.className) + ' right=' + Math.round(r.right)); }
          const first = document.querySelector('#pickList .opt'); let name = null, badge = null;
          if (first && first.getClientRects().length) {
            const on = first.querySelector('.on'), ot = first.querySelector('.ot'); const rg = document.createRange(); rg.selectNodeContents(on);
            const nr = [...rg.getClientRects()].filter(r => r.width > 0); name = { lines: lines(on), text: on.textContent };
            if (ot) { const b = ot.getBoundingClientRect(); badge = { text: ot.textContent, w: Math.round(b.width), h: Math.round(b.height), overlapsName: nr.some(r => r.left < b.right && r.right > b.left && r.top < b.bottom && r.bottom > b.top) }; }
          }
          return { hscroll: de.scrollWidth > W, docScrollWidth: de.scrollWidth, clientWidth: W, over: over.slice(0, 5), name, badge, footerLines: lines(document.querySelector('#footDemo')) };
        });
        await browser.close();
      }
    }
  }
  fs.writeFileSync(__dirname + '/a_raw.json', JSON.stringify(R, null, 1));
  console.log('done');
})().catch(e => { console.error('ERR', e); process.exit(1); });
