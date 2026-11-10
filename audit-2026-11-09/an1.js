const r = require('./f8_raw.json');
const short = x => x.split(' "')[0];
const f1 = x => Math.round(x * 10) / 10;
for (const [k, w] of Object.entries(r.walks)) {
  console.log('\n=== ' + k);
  console.log(' bar --cmd-h before->after:', w.bar.before.var, '->', w.bar.after.var, '| bar px', w.bar.after.bar, '| scroll-padding-top', w.bar.after.pad);
  console.log(' stops: forward=' + w.stops.length + ' scrolled-bottom=' + w.worst.length + ' reverse=' + w.rev.length);
  for (const [lab, arr] of [['forward', w.stops], ['scrolled-to-bottom', w.worst], ['reverse', w.rev]]) {
    if (!arr.length) { console.log(`  [${lab}] no stops`); continue; }
    const g = arr.map(x => x.gap);
    const neg = arr.filter(x => x.gap < 0), negR = arr.filter(x => x.gap >= 0 && x.ringGap < 0);
    console.log(`  [${lab}] min gap=${f1(Math.min(...g))}px; negative: ${neg.length ? neg.map(x => short(x.el) + ' ' + f1(x.gap)).join(', ') : 'none'}; ring-under-bar (gap>=0, ringGap<0): ${negR.length ? negR.map(x => short(x.el) + ' gap ' + f1(x.gap) + ' ring ' + f1(x.ringGap)).join(', ') : 'none'}`);
  }
  console.log('  smallest gaps (scrolled-bottom):', [...w.worst].sort((a, b) => a.gap - b.gap).slice(0, 4).map(x => short(x.el) + '=' + f1(x.gap)).join(', '));
  console.log('  smallest gaps (reverse):', [...w.rev].sort((a, b) => a.gap - b.gap).slice(0, 4).map(x => short(x.el) + '=' + f1(x.gap)).join(', '));
}
