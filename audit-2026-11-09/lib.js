// Audit helpers. Lives in the scratchpad, outside the repo.
const { chromium } = require('playwright');
const URL = 'http://localhost:8000/';
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function open(viewport, opts = {}) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport, ignoreHTTPSErrors: true, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.__reqs = [];
  page.on('request', r => page.__reqs.push({ url: r.url(), method: r.method(), t: Date.now() }));
  if (opts.init) await page.addInitScript(opts.init);
  await page.goto(URL, { waitUntil: 'load', timeout: 45000 });
  await page.waitForFunction(() => document.querySelector('#conn') && document.querySelector('#conn').textContent === 'Connected', null, { timeout: 15000 });
  await page.evaluate(() => document.fonts.ready);
  return { browser, ctx, page };
}

async function toStep2(page) {
  await page.click('.ex[data-i="0"]');
  await page.waitForSelector('#v2:not([hidden])', { timeout: 20000 });
}
async function toStep3(page) {
  await page.click('#sendBtn');
  await page.waitForSelector('#v3:not([hidden])', { timeout: 30000 });
}

// helpers that run inside the page (installed once per page)
const PAGE_HELPERS = () => {
  const parse = s => {
    if (!s || s === 'transparent') return [0, 0, 0, 0];
    const m = s.match(/rgba?\(([^)]+)\)/);
    if (!m) return [0, 0, 0, 0];
    const p = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number);
    return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
  };
  const over = (top, bot) => { const a = top[3]; return [0, 1, 2].map(i => top[i] * a + bot[i] * (1 - a)).concat([1]); };
  const bgOf = el => {
    const layers = [];
    for (let e = el; e; e = e.parentElement) {
      const c = parse(getComputedStyle(e).backgroundColor);
      if (c[3] > 0) { layers.push(c); if (c[3] === 1) break; }
    }
    let acc = [255, 255, 255, 1];
    for (let i = layers.length - 1; i >= 0; i--) acc = over(layers[i], acc);
    return acc;
  };
  const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b), hi = Math.max(l1, l2), lo = Math.min(l1, l2); return (hi + 0.05) / (lo + 0.05); };
  const name = el => {
    const t = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 28);
    const cls = typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/).join('.') : '';
    return el.tagName.toLowerCase() + (el.id ? '#' + el.id : cls) + (t ? ` "${t}"` : '');
  };
  window.__a = {
    name,
    describeActive() {
      const el = document.activeElement;
      if (!el || el === document.body || el === document.documentElement) return null;
      const bar = document.querySelector('#cmd').getBoundingClientRect();
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      const outlineOn = cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0;
      const shadow = cs.boxShadow;
      let ind = null, indKind = 'none';
      if (outlineOn) { ind = parse(cs.outlineColor); indKind = 'outline'; }
      else if (shadow && shadow !== 'none') { const m = shadow.match(/rgba?\([^)]+\)/); if (m) { ind = parse(m[0]); indKind = 'box-shadow'; } }
      const surround = bgOf(el.parentElement || el);
      const own = bgOf(el);
      const off = parseFloat(cs.outlineOffset) || 0, w = parseFloat(cs.outlineWidth) || 0;
      const d = el.closest('details');
      return {
        el: name(el), id: el.id || '', tag: el.tagName.toLowerCase(),
        top: r.top, left: r.left, pageTop: r.top + scrollY, pageLeft: r.left + scrollX, w: r.width, h: r.height,
        barBottom: bar.bottom, gap: r.top - bar.bottom, ringGap: r.top - (outlineOn ? off + w : 0) - bar.bottom,
        outline: `${cs.outlineStyle} ${cs.outlineWidth} ${cs.outlineColor} offset ${cs.outlineOffset}`, boxShadow: shadow,
        indKind, indColor: ind ? ind.slice(0, 3).map(Math.round).join(',') : null,
        vsSurround: ind ? +ratio(over(ind, surround), surround).toFixed(2) : null,
        vsOwn: ind ? +ratio(over(ind, own), own).toFixed(2) : null,
        surround: surround.slice(0, 3).map(Math.round).join(','), ownBg: own.slice(0, 3).map(Math.round).join(','),
        invalid: el.getAttribute('aria-invalid') || '',
        inHidden: !!el.closest('[hidden]'),
        inClosedDetails: !!(d && !d.open && !(el.tagName === 'SUMMARY' && el.parentElement === d)),
      };
    },
    cmdH() { return { var: getComputedStyle(document.documentElement).getPropertyValue('--cmd-h').trim(), bar: document.querySelector('#cmd').getBoundingClientRect().height, pad: getComputedStyle(document.documentElement).scrollPaddingTop }; },
  };
};

async function install(page) { await page.evaluate(PAGE_HELPERS); }

async function tallBar(page) {
  const before = await page.evaluate(() => window.__a.cmdH());
  await page.evaluate(() => { document.querySelector('#cmdText').textContent = 'x '.repeat(120); });
  let after;
  for (let i = 0; i < 30; i++) {
    await sleep(100);
    after = await page.evaluate(() => window.__a.cmdH());
    if (after.var !== before.var && Math.ceil(after.bar) + 'px' === after.var) break;
  }
  return { before, after };
}

// mode 'forward' starts before the first element (Tab); 'reverse' starts after the last (Shift+Tab).
// scrollBottom: before every Tab, scroll to the page bottom so each focused element has to be scrolled into
// view from above, which is the case where a sticky bar could cover it.
async function walk(page, { mode = 'forward', scrollBottom = false, max = 80 } = {}) {
  await page.evaluate(mode => {
    const old = document.getElementById('__start'); if (old) old.remove();
    const m = document.createElement('span'); m.id = '__start'; m.tabIndex = -1; m.style.cssText = 'position:absolute;width:0;height:0';
    if (mode === 'forward') { document.body.insertBefore(m, document.body.firstChild); window.scrollTo(0, 0); }
    else { document.body.appendChild(m); window.scrollTo(0, document.documentElement.scrollHeight); }
    m.focus({ preventScroll: true });
  }, mode);
  const stops = [], seen = new Set();
  for (let i = 0; i < max; i++) {
    if (scrollBottom) await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.keyboard.press(mode === 'forward' ? 'Tab' : 'Shift+Tab');
    await sleep(60);
    const d = await page.evaluate(() => (document.activeElement && document.activeElement.id === '__start') ? null : window.__a.describeActive());
    if (!d) break;
    const key = d.el + '@' + Math.round(d.pageTop) + ',' + Math.round(d.pageLeft);
    if (seen.has(key)) break;
    seen.add(key); stops.push(d);
  }
  await page.evaluate(() => { const m = document.getElementById('__start'); if (m) m.remove(); });
  return stops;
}

function visualOrder(stops) {
  const s = stops.slice();
  s.sort((a, b) => (Math.abs(a.pageTop - b.pageTop) < 12 ? a.pageLeft - b.pageLeft : a.pageTop - b.pageTop));
  return s;
}

module.exports = { open, toStep2, toStep3, install, tallBar, walk, visualOrder, sleep, URL };
