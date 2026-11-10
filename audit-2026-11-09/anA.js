const r = require('./a_raw.json');
const short = x => x.split(' "')[0], f1 = x => Math.round(x * 10) / 10;
console.log('=== A1 bar height / innerHeight');
for (const [vp, o] of Object.entries(r.ratios)) { console.log(vp); for (const [k, v] of Object.entries(o)) console.log('  ', (v.ratio > 0.15 ? 'OVER ' : 'ok   ') + String(v.ratio).padEnd(7), v.h + 'px/' + v.vh, '|', k, '|', JSON.stringify(v.text)); }
console.log('\n=== A2 clearance with tall bar (min gap per state/walk; negatives)');
for (const [k, w] of Object.entries(r.walks)) {
  const parts = [];
  for (const [lab, arr] of [['fwd', w.stops], ['bottom', w.worst], ['rev', w.rev]]) { const neg = arr.filter(x => x.gap < 0); parts.push(`${lab}: n=${arr.length} min=${arr.length ? f1(Math.min(...arr.map(x => x.gap))) : '-'}${neg.length ? ' NEG[' + neg.map(x => short(x.el) + ' ' + f1(x.gap)).join(', ') + ']' : ''}`); }
  console.log(k.padEnd(78), parts.join(' | '), '| --cmd-h', w.bar.after.var);
}
console.log('\n=== A3 focus indicator: elements flagged (none/under 3:1 vs surround)');
const seen = {}; let flagged = 0, total = 0;
for (const [k, w] of Object.entries(r.walks)) for (const s of w.stops) { const key = k.split(' | ')[0] + '|' + short(s.el) + (s.invalid ? '[invalid]' : ''); if (seen[key]) continue; seen[key] = 1; total++; if (s.indKind === 'none' || s.vsSurround < 3) { flagged++; console.log('  FLAG', key, s.indKind, s.vsSurround); } }
console.log(' distinct viewport|element combos:', total, 'flagged:', flagged);
const rs = Object.values(seen).length; const vals = []; for (const [k, w] of Object.entries(r.walks)) for (const s of w.stops) if (s.vsSurround) vals.push(s.vsSurround); console.log(' contrast vs surround min/max:', Math.min(...vals), Math.max(...vals));
const outl = new Set(); for (const w of Object.values(r.walks)) for (const s of w.stops) outl.add(s.outline); console.log(' distinct outline values:', [...outl].join(' || '));
console.log('\n=== A4 tab order vs visual; hidden reachable');
for (const [k, w] of Object.entries(r.walks)) { const t = w.tabOrder, v = w.visualOrder; const m = []; t.forEach((x, i) => { if (x !== v[i]) m.push(`pos ${i + 1}: tab=${short(x)} visual=${short(v[i])}`); }); const hid = [...w.stops, ...w.worst, ...w.rev].filter(s => s.inHidden || s.inClosedDetails).map(s => s.el); const rv = JSON.stringify(w.stops.map(s => s.el)) === JSON.stringify(w.rev.map(s => s.el).reverse()); console.log(k.padEnd(78), 'stops', t.length, '| mismatches:', m.length ? m.join('; ') : 'none', '| hidden/closed reached:', hid.length ? hid.join(',') : 'none', '| rev==reverse:', rv); }
console.log('\n=== A4b tab order (F1 panel and tbl states, 1366)'); for (const k of Object.keys(r.walks)) if (/1366.*(F1|picker\+details)/.test(k)) console.log(k, '\n   ', r.walks[k].tabOrder.map(x => short(x) + (x.includes('"') ? '"' + x.split(' "')[1].slice(0, 12) : '')).join(' > '));
console.log('\n=== A5 activeElement id'); console.log(JSON.stringify(r.focusAfter, null, 1));
console.log('\n=== A6 text under 14px'); for (const [k, v] of Object.entries(r.small)) { const e = Object.entries(v); console.log(k, '->', e.length ? e.map(([kk, vv]) => kk + ' x' + vv.n).join('; ') : 'none'); }
console.log('\n=== A7 narrow 360'); for (const [k, v] of Object.entries(r.narrow)) console.log(k, '\n   hscroll', v.hscroll, '(scrollWidth', v.docScrollWidth, 'vs clientWidth', v.clientWidth + ')', '| past right edge:', v.over.length ? v.over.join('; ') : 'none', '| first row name lines:', v.name ? v.name.lines + ' (' + v.name.text + ')' : 'n/a', '| badge:', v.badge ? JSON.stringify(v.badge) : 'n/a', '| footer lines:', v.footerLines);
