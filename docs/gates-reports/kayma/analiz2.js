// Ayrıntı testleri: kasnak başına μ, AG00894 renk takası, alternatör fazlası, avara ataleti.
const fs = require('fs');
const G = process.argv[2];
const Z = JSON.parse(fs.readFileSync(G + '/' + (process.env.ZINCIR || 'zincir.json'), 'utf8'));
const out = {};

const minKombi = (r, a, i, f) => Math.min(...r.zincir[a].map((kb) => f(kb[i][0], kb[i][1])));
const gevsek = (e, Tin, Tout) => { const Tx = Math.max(Tin, Tout), Tn = Math.min(Tin, Tout); return Tn > 0 ? Tn * (e - 1) / (Tx - Tn) : 0; };
const oran = (e, Tin, Tout) => { const Tx = Math.max(Tin, Tout), Tn = Math.min(Tin, Tout); return Tn > 0 ? e / (Tx / Tn) : 0; };

// kasnak × devir: Gates'in SF'sini veren μ (ikiye bölme) — tanım başına
function muCoz(r, i, a, tanim) {
  const g = r.gates[r.pl[i].key][a]; if (!(g > 0)) return null;
  const phi = r.pl[i].wrapDeg * Math.PI / 180;
  const f = (mu) => minKombi(r, a, i, (Tin, Tout) => tanim(Math.exp(mu * phi), Tin, Tout)) - g;
  let lo = 0.01, hi = 4;
  if (f(lo) > 0 || f(hi) < 0) return null;
  for (let k = 0; k < 60; k++) { const m = (lo + hi) / 2; if (f(m) > 0) hi = m; else lo = m; }
  return (lo + hi) / 2;
}
const med = (v) => { const s = v.filter((x) => x != null).sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : null; };
const q = (v, p) => { const s = v.filter((x) => x != null).sort((a, b) => a - b); return s.length ? s[Math.floor(p * (s.length - 1))] : null; };

console.log('== A) Kasnak başına Gates\'i veren μ — oluklu yük taşıyanlar (sürücü + aksesuar)');
const satirA = [];
for (const [ad, r] of Object.entries(Z)) r.pl.forEach((p, i) => {
  if (p.contact !== 'grooved') return;
  const mG = r.izgara.map((_, a) => muCoz(r, i, a, gevsek));
  const mO = r.izgara.map((_, a) => muCoz(r, i, a, oran));
  satirA.push({ ad, key: p.key, sarim: +p.wrapDeg.toFixed(1), gevsek: med(mG), gevsekAralik: [q(mG, 0.1), q(mG, 0.9)], oran: med(mO) });
});
satirA.forEach((s) => console.log(`   ${s.ad.padEnd(20)} ${s.key.padEnd(7)} φ ${String(s.sarim).padStart(5)}°  gevşek μ ${s.gevsek == null ? '—' : s.gevsek.toFixed(3)} [${s.gevsekAralik.map((x) => x == null ? '—' : x.toFixed(2)).join('–')}]   oran μ ${s.oran == null ? '—' : s.oran.toFixed(3)}`));
out.A = satirA;

console.log('\n== B) Sırttan temaslı avaralar — gevşek tanımda μ');
const satirB = [];
for (const [ad, r] of Object.entries(Z)) r.pl.forEach((p, i) => {
  if (p.contact !== 'back') return;
  const m = r.izgara.map((_, a) => muCoz(r, i, a, gevsek));
  satirB.push({ ad, key: p.key, sarim: +p.wrapDeg.toFixed(1), J: r.J[p.key], mu: med(m), aralik: [q(m, 0.1), q(m, 0.9)] });
});
satirB.forEach((s) => console.log(`   ${s.ad.padEnd(20)} ${s.key.padEnd(7)} φ ${String(s.sarim).padStart(5)}°  J ${s.J}  μ ${s.mu == null ? '—' : s.mu.toFixed(3)} [${s.aralik.map((x) => x == null ? '—' : x.toFixed(2)).join('–')}]`));
out.B = satirB;

// C) Alternatör: Gates SF'sinden geri çözülen etkin gerginlik farkı ↔ modelin P/v ve J·α/r bileşenleri
console.log('\n== C) Alternatör — Gates\'in ima ettiği talep (μg 0,86) ↔ model bileşenleri');
out.C = [];
for (const [ad, r] of Object.entries(Z)) r.pl.forEach((p, i) => {
  if (p.key !== 'ALT') return;
  const phi = p.wrapDeg * Math.PI / 180, e = Math.exp(0.86 * phi);
  r.izgara.forEach((rpm, a) => {
    if (rpm % 200) return;
    const g = r.gates.ALT[a]; if (!(g > 0)) return;
    // modelin en kötü kombinasyonundaki gevşek taraf ve talep
    let en = null;
    r.zincir[a].forEach((kb, b) => { const s = gevsek(e, kb[i][0], kb[i][1]); if (!en || s < en.s) en = { s, kb: kb[i], b }; });
    const Tn = Math.min(...en.kb), talepModel = Math.abs(en.kb[0] - en.kb[1]);
    const talepGates = Tn * (e - 1) / g;
    out.C.push({ ad, rpm, talepModel: +talepModel.toFixed(1), talepGates: +talepGates.toFixed(1), kat: +(talepGates / talepModel).toFixed(3), kombi: r.kombi[en.b] });
  });
});
out.C.forEach((s) => console.log(`   ${s.ad.padEnd(20)} ${String(s.rpm).padStart(5)} d/dk  talep model ${String(s.talepModel).padStart(7)} N  Gates ${String(s.talepGates).padStart(7)} N  ×${s.kat}  ${JSON.stringify(s.kombi)}`));

// D) AG00894 aynı renkli eğriler: TM31 ↔ SD7H15 takası
console.log('\n== D) AG00894 — aynı renkli eğrilerin takası (gevşek, μg 0,86)');
{
  const r = Z.AG00894_8PK1738HD;
  const iT = r.pl.findIndex((p) => p.key === 'TM31'), iS = r.pl.findIndex((p) => p.key === 'SD7H15');
  const mdl = (i) => r.izgara.map((_, a) => minKombi(r, a, i, (Tin, Tout) => gevsek(Math.exp(0.86 * r.pl[i].wrapDeg * Math.PI / 180), Tin, Tout)));
  const mT = mdl(iT), mS = mdl(iS);
  const oranMed = (m, g) => med(m.map((x, a) => g[a] > 0 ? x / g[a] : null));
  const d = { olduguGibi: [oranMed(mT, r.gates.TM31), oranMed(mS, r.gates.SD7H15)], takasli: [oranMed(mT, r.gates.SD7H15), oranMed(mS, r.gates.TM31)] };
  out.D = d;
  console.log(`   olduğu gibi: TM31 ×${d.olduguGibi[0].toFixed(2)}  SD7H15 ×${d.olduguGibi[1].toFixed(2)}`);
  console.log(`   takaslı    : TM31 ×${d.takasli[0].toFixed(2)}  SD7H15 ×${d.takasli[1].toFixed(2)}`);
}

// E) AG00902: krank ve klima — hangi talep Gates'in iki eğrisini birlikte verir?
console.log('\n== E) AG00902 — Gates\'in ima ettiği talepler (gevşek, μg 0,86) ↔ model');
out.E = [];
for (const ad of ['AG00902_8PK1275HD', 'AG00902_8PK1300HD']) {
  const r = Z[ad];
  r.pl.forEach((p, i) => {
    if (p.contact !== 'grooved') return;
    const e = Math.exp(0.86 * p.wrapDeg * Math.PI / 180);
    [800, 1500, 2500].forEach((rpm) => {
      const a = r.izgara.reduce((b, x, j) => Math.abs(x - rpm) < Math.abs(r.izgara[b] - rpm) ? j : b, 0);
      let en = null;
      r.zincir[a].forEach((kb, b) => { const s = gevsek(e, kb[i][0], kb[i][1]); if (!en || s < en.s) en = { s, kb: kb[i], b }; });
      const Tn = Math.min(...en.kb);
      const o = { ad, key: p.key, rpm, Tgevsek: +Tn.toFixed(0), talepModel: +Math.abs(en.kb[0] - en.kb[1]).toFixed(0),
        talepGates: +(Tn * (e - 1) / r.gates[p.key][a]).toFixed(0), yukA_C_kW: +(r.yukOrnek.A_C[a]).toFixed(2) };
      out.E.push(o);
      console.log(`   ${ad} ${p.key.padEnd(4)} ${rpm} d/dk  T_gevşek ${o.Tgevsek} N  talep model ${o.talepModel} N  Gates ${o.talepGates} N  (A_C tepe ${o.yukA_C_kW} kW)`);
    });
  });
}

fs.writeFileSync(G + '/' + (process.env.ZINCIR || 'zincir.json').replace('zincir', 'analiz2'), JSON.stringify(out));
