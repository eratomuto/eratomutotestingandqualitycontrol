const r = require('./f8_raw.json');
console.log('=== CHECK 3: Tab order vs visual order (top, then left; rows within 12px treated as one row)');
for (const [k, w] of Object.entries(r.walks)) {
  const t = w.tabOrder, v = w.visualOrder;
  const mism = [];
  t.forEach((x, i) => { if (x !== v[i]) mism.push(`pos ${i + 1}: tab=${x.split(' "')[0]} visual=${v[i].split(' "')[0]}`); });
  const hidden = [...w.stops, ...w.worst, ...w.rev].filter(s => s.inHidden || s.inClosedDetails).map(s => s.el);
  console.log('\n' + k);
  console.log(' TAB   :', t.map(x => x.split(' "')[0] + (x.includes('"') ? ' "' + x.split(' "')[1].slice(0, 14) : '')).join(' > '));
  console.log(' VISUAL:', v.map(x => x.split(' "')[0]).join(' > '));
  console.log(' mismatches:', mism.length ? mism.join(' | ') : 'none');
  console.log(' reached by Tab inside [hidden] or closed <details> (all 3 walks):', hidden.length ? hidden.join(', ') : 'none');
  // reverse order == reverse of forward?
  const fw = w.stops.map(s => s.el), rv = w.rev.map(s => s.el).reverse();
  console.log(' Shift+Tab order is exact reverse of Tab order:', JSON.stringify(fw) === JSON.stringify(rv));
}
