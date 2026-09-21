/* SUITE B — DEĞİŞMEZLİK BATARYASI, N rastgele sistem üzerinde */
const L = require('./lib.js');
const N = Number(process.env.FEAD_DENETIM_N || 2000);
const agg = new Map();
let uretilen = 0, nul = 0, istisna = 0;
const istisnalar = new Map();
const monoFail = [];
const r = L.rng(Number(process.env.FEAD_DENETIM_SEED || 20260921));

for (let i = 0; i < N; i++) {
  const S = L.genSystem(r);
  if (!S) { nul++; continue; }
  let R;
  try { R = L.checks(S); } catch (e) {
    istisna++;
    const k = String(e.message).slice(0, 70);
    istisnalar.set(k, (istisnalar.get(k) || 0) + 1);
    continue;
  }
  uretilen++;
  R.out.forEach(c => {
    let a = agg.get(c.ad);
    if (!a) { a = { n: 0, bad: 0, worst: 0 }; agg.set(c.ad, a); }
    a.n++; if (!c.ok) a.bad++;
    if (Number.isFinite(c.dev)) a.worst = Math.max(a.worst, c.dev);
  });
  if (R.out._monoFull === false)
    monoFail.push({ i, statRel: R.out._statRel, hiRel: R.out._hiRel, rel: R.rel,
      n: S.sys._n, arm: S.sys.tensioner.armLength });
}

console.log(`SUITE B — ${uretilen} geçerli sistem (${nul} üretim reddi, ${istisna} istisna)\n`);
const pad = 42;
[...agg.entries()].forEach(([ad, a]) => {
  const ok = a.bad === 0;
  console.log(`${ok ? '✓' : '✗'} ${ad.padEnd(pad)} ${String(a.n - a.bad) + '/' + a.n}`.padEnd(pad + 14)
    + ` en kötü sapma = ${a.worst.toExponential(3)}`);
});
if (istisnalar.size) {
  console.log('\nİSTİSNALAR:');
  [...istisnalar.entries()].sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${v}× ${k}`));
}
console.log(`\nTÜM ARALIKTA L(θ) monoton DEĞİL: ${monoFail.length}/${uretilen} sistem`);
monoFail.slice(0, 6).forEach(m => console.log(`  #${m.i}: durağan nokta ${m.statRel && m.statRel.toFixed(1)}°, kolun sınırı ${m.hiRel.toFixed(1)}°, çalışma ${m.rel.toFixed(1)}°`));
