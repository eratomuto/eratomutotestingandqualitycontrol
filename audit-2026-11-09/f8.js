const fs = require('fs');
const L = require('./lib');
const OUT = __dirname;
const VPS = [{ name: '1366x768', width: 1366, height: 768 }, { name: '360x800', width: 360, height: 800 }];

// ---- state builders (each returns a fresh page in the requested state) ----
const STATES = {
  'step1': async p => {},
  'step1+townpicker(blocked Find, aria-invalid)': async p => {
    await p.fill('#notes', 'chest pain for two hours');
    await p.fill('#zip', 'B3S 0B6');
    await p.click('#findBtn');
    await p.waitForSelector('#townWrap:not([hidden])');
  },
  'step2': async p => { await L.toStep2(p); },
  'step2+picker+details open': async p => {
    await L.toStep2(p);
    await p.click('#pickBtn');
    await p.click('#more > summary');
    await p.click('#hospitals > summary');
    await L.sleep(400);
  },
  'step2+override(useRush shown)': async p => {
    await L.toStep2(p);
    await p.click('#pickBtn');
    await p.click('#pickList .opt:not(.no):not(:has(.rush))');
    await p.waitForSelector('#useRush');
  },
  'step3': async p => { await L.toStep2(p); await L.toStep3(p); },
  'step3+hospitals open': async p => { await L.toStep2(p); await L.toStep3(p); await p.click('#hospitals > summary'); await L.sleep(300); },
};

async function main() {
  const report = { walks: {}, focusAfter: {}, small: {}, narrow: {} };
  for (const vp of VPS) {
    // ---------- checks 1,2,3: tall bar + Tab walk ----------
    for (const [label, build] of Object.entries(STATES)) {
      const { browser, page } = await L.open({ width: vp.width, height: vp.height });
      await L.install(page);
      await build(page);
      const bar = await L.tallBar(page);
      const stops = await L.walk(page);                                   // natural forward Tab
      const worst = await L.walk(page, { scrollBottom: true });           // forward, scrolled to bottom before each Tab
      const rev = await L.walk(page, { mode: 'reverse' });                // Shift+Tab from the end
      const visual = L.visualOrder(stops);
      report.walks[vp.name + ' | ' + label] = { bar, stops, worst, rev, tabOrder: stops.map(s => s.el), visualOrder: visual.map(s => s.el) };
      await browser.close();
    }
    // ---------- check 4: focus after screen change ----------
    {
      const { browser, page } = await L.open({ width: vp.width, height: vp.height });
      const act = () => page.evaluate(() => document.activeElement && (document.activeElement.id || document.activeElement.tagName));
      const r = {};
      await L.toStep2(page); r.afterFind = await act();
      await L.toStep3(page); r.afterSend = await act();
      await page.click('#newBtn'); await L.sleep(200); r.afterNextPatient = await act();
      await L.toStep2(page);
      await page.click('#backBtn'); await L.sleep(200); r.afterBack = await act();
      report.focusAfter[vp.name] = r;
      await browser.close();
    }
    // ---------- check 5: text under 14px ----------
    for (const label of ['step1', 'step1+townpicker(blocked Find, aria-invalid)', 'step2+picker+details open', 'step2+override(useRush shown)', 'step3+hospitals open']) {
      const { browser, page } = await L.open({ width: vp.width, height: vp.height });
      await STATES[label](page);
      const small = await page.evaluate(() => {
        const out = {};
        for (const el of document.body.querySelectorAll('*')) {
          if (el.closest('script,style,.sr-only')) continue;
          const hasText = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
          if (!hasText) continue;
          const rects = el.getClientRects();
          if (!rects.length) continue;
          const cs = getComputedStyle(el);
          if (cs.display === 'none' || cs.visibility === 'hidden') continue;
          const fs = parseFloat(cs.fontSize);
          if (fs < 14) {
            const k = el.tagName.toLowerCase() + '.' + (typeof el.className === 'string' ? el.className : (el.className.baseVal || '')) + ' ' + fs + 'px';
            const t = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join(' ').slice(0, 24);
            (out[k] = out[k] || { n: 0, sample: t }).n++;
          }
        }
        return out;
      });
      report.small[vp.name + ' | ' + label] = small;
      await browser.close();
    }
    // ---------- check 6: narrow layout (360 only) ----------
    if (vp.width === 360) {
      for (const label of ['step1', 'step1+townpicker(blocked Find, aria-invalid)', 'step2', 'step2+picker+details open', 'step3', 'step3+hospitals open']) {
        const { browser, page } = await L.open({ width: vp.width, height: vp.height });
        await STATES[label](page);
        if (label === 'step2') { await page.click('#pickBtn'); await L.sleep(300); }   // picker open for the first-row measurement
        const m = await page.evaluate(() => {
          const de = document.documentElement, W = de.clientWidth;
          const lines = el => {
            if (!el) return null;
            const rg = document.createRange(); rg.selectNodeContents(el);
            const tops = new Set([...rg.getClientRects()].filter(r => r.width > 0).map(r => Math.round(r.top)));
            return tops.size;
          };
          const over = [];
          for (const el of document.body.querySelectorAll('*')) {
            if (el.closest('.sr-only,script,style,.tbl,svg,[hidden],details:not([open]) > :not(summary)')) continue;
            const r = el.getBoundingClientRect();
            if (r.width && r.right > W + 0.5) over.push(el.tagName.toLowerCase() + (el.id ? '#' + el.id : '.' + el.className) + ' right=' + Math.round(r.right));
          }
          const first = document.querySelector('#pickList .opt');
          let name = null, badge = null;
          if (first && first.getClientRects().length) {
            const on = first.querySelector('.on'), ot = first.querySelector('.ot');
            const rg = document.createRange(); rg.selectNodeContents(on);
            const nameRects = [...rg.getClientRects()].filter(r => r.width > 0);
            name = { lines: lines(on), text: on.textContent, rects: nameRects.map(r => [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)]) };
            if (ot) {
              const b = ot.getBoundingClientRect();
              badge = { text: ot.textContent, box: [Math.round(b.left * 10) / 10, Math.round(b.top * 10) / 10, Math.round(b.right * 10) / 10, Math.round(b.bottom * 10) / 10], w: Math.round(b.width), h: Math.round(b.height),
                overlapsName: nameRects.some(r => r.left < b.right && r.right > b.left && r.top < b.bottom && r.bottom > b.top) };
            }
          }
          return { hscroll: de.scrollWidth > W, docScrollWidth: de.scrollWidth, clientWidth: W, bodyScrollWidth: document.body.scrollWidth, over: over.slice(0, 6), name, badge, footerLines: lines(document.querySelector('#footDemo')), footerText: document.querySelector('#footDemo').textContent };
        });
        report.narrow[label] = m;
        await browser.close();
      }
    }
  }
  fs.writeFileSync(OUT + '/f8_raw.json', JSON.stringify(report, null, 1));
  console.log('done');
}
main().catch(e => { console.error('ERR', e); process.exit(1); });
