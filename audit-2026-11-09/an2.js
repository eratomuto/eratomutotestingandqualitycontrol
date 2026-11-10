const r = require('./f8_raw.json');
const short = x => x.split(' "')[0];
console.log('--- div.tbl details (tall bar):');
for (const [k, w] of Object.entries(r.walks)) for (const s of w.stops) if (s.el.startsWith('div.tbl')) console.log(k, 'top', s.top.toFixed(1), 'h', s.h.toFixed(1), 'barBottom', s.barBottom.toFixed(1), 'gap', s.gap.toFixed(1));
console.log('\n=== CHECK 2: focus indicator (natural forward walk). threshold 3:1 vs surround (what the ring touches) and vs own bg');
const all = {};
for (const [k, w] of Object.entries(r.walks)) for (const s of w.stops) { const key = k.split(' | ')[0] + ' | ' + s.el.split(' "')[0] + (s.invalid ? '[aria-invalid]' : ''); all[key] = s; }
let bad = [];
for (const [key, s] of Object.entries(all)) {
  const flag = s.indKind === 'none' ? 'NO INDICATOR' : (s.vsSurround < 3 ? 'UNDER 3:1 vs surround' : (s.vsOwn < 3 ? 'ring vs OWN bg under 3:1 (ring sits outside, offset)' : ''));
  if (flag) bad.push(key + ' -> ' + flag + ` [${s.indKind} ${s.indColor} surround=${s.surround} own=${s.ownBg} vsS=${s.vsSurround} vsO=${s.vsOwn}]`);
}
console.log('distinct (viewport|element) combos checked:', Object.keys(all).length);
console.log(bad.length ? bad.join('\n') : 'none flagged');
console.log('\nSample rows (1366x768):');
const want = ['select#town', 'textarea#notes', 'input#zip[aria-invalid]', 'input#zip', 'div.tbl', 'button#sendBtn', 'button#useRush', 'summary', 'button.opt', 'button#findBtn', 'button.ex', 'button#backBtn', 'button#newBtn'];
for (const [key, s] of Object.entries(all)) if (key.startsWith('1366x768') && want.some(w => key.endsWith('| ' + w))) console.log(key.padEnd(62), s.outline, '| shadow:', s.boxShadow.slice(0, 40), '| ring', s.indColor, 'vsSurround', s.vsSurround, 'vsOwn', s.vsOwn, 'invalid=' + s.invalid);
console.log('\nAll 360 distinct elements flagged? (same check above covers both viewports)');
