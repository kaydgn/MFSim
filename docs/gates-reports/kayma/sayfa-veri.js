// Analiz sayfasının verisi — zincir-surukleme.json + zincir.json'dan.
const fs = require('fs');
const G = process.argv[2];
const Z = JSON.parse(fs.readFileSync(G + '/zincir-surukleme.json', 'utf8'));
const Z0 = JSON.parse(fs.readFileSync(G + '/zincir.json', 'utf8'));
const MUG = 0.88, MUB = 0.60;

const SFf = {
  oran: (e, Tx, Tn) => e / (Tx / Tn),
  gevsek: (e, Tx, Tn) => Tn * (e - 1) / (Tx - Tn),
  gergin: (e, Tx, Tn) => Tx * (1 - 1 / e) / (Tx - Tn),
};
const sf = (t, mu, phi, Tin, Tout) => {
  const Tx = Math.max(Tin, Tout), Tn = Math.min(Tin, Tout);
  if (!(Tn > 0)) return 0; if (Tx - Tn < 1e-9) return Infinity;
  return SFf[t](Math.exp(mu * phi), Tx, Tn);
};
const egri = (r, i, t, mg, mb) => {
  const p = r.pl[i], phi = p.wrapDeg * Math.PI / 180, mu = p.contact === 'grooved' ? mg : mb;
  return r.izgara.map((rpm, a) => {
    let en = Infinity, arg = -1;
    r.zincir[a].forEach((kb, b) => { const s = sf(t, mu, phi, kb[i][0], kb[i][1]); if (s < en) { en = s; arg = b; } });
    return { rpm, sf: en, kombi: r.kombi[arg] };
  });
};
const RAPORLAR = Object.keys(Z).filter((k) => !/Takas/.test(k));
const r2 = (x, d = 2) => Math.round(x * 10 ** d) / 10 ** d;

// 1) tanım testi — bugünkü μ ile ve kalibre ile (log10 RMS → çarpan)
function rms(t, mg, mb, ZZ) {
  const ln = [];
  RAPORLAR.forEach((ad) => { const r = ZZ[ad]; r.pl.forEach((p, i) => {
    egri(r, i, t, mg, mb).forEach((x, a) => { const g = r.gates[p.key][a]; if (g > 0 && x.sf > 0 && isFinite(x.sf)) ln.push(Math.log10(x.sf / g)); });
  }); });
  return { kat: r2(Math.pow(10, Math.sqrt(ln.reduce((s, v) => s + v * v, 0) / ln.length))), n: ln.length };
}
const tanim = {
  bugunMu: { oran: rms('oran', 0.90, 0.35, Z0), gevsek: rms('gevsek', 0.90, 0.35, Z0), gergin: rms('gergin', 0.90, 0.35, Z0) },
  gatesMu: { oran: rms('oran', MUG, MUB, Z), gevsek: rms('gevsek', MUG, MUB, Z), gergin: rms('gergin', MUG, MUB, Z) },
};

// 2) kasnak başına Gates'i veren μ (gevşek tanım, sürtünmeli zincir)
const minK = (r, a, i, f) => Math.min(...r.zincir[a].map((kb) => f(kb[i][0], kb[i][1])));
function muCoz(r, i, a) {
  const g = r.gates[r.pl[i].key][a]; if (!(g > 0)) return null;
  const phi = r.pl[i].wrapDeg * Math.PI / 180;
  const f = (mu) => minK(r, a, i, (Tin, Tout) => sf('gevsek', mu, phi, Tin, Tout)) - g;
  let lo = 0.01, hi = 4; if (f(lo) > 0 || f(hi) < 0) return null;
  for (let k = 0; k < 60; k++) { const m = (lo + hi) / 2; if (f(m) > 0) hi = m; else lo = m; }
  return (lo + hi) / 2;
}
const med = (v) => { const s = v.filter((x) => x != null).sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : null; };
const mu = [];
RAPORLAR.forEach((ad) => { const r = Z[ad]; r.pl.forEach((p, i) => {
  const m = med(r.izgara.map((_, a) => muCoz(r, i, a)));
  const rol = r.yukler.includes(p.key) ? (p.key === 'ALT' ? 'alternator' : 'aksesuar') : (/^(CRK|FAN|SRC)$/.test(p.key) ? 'surucu' : 'avara');
  mu.push({ rapor: ad, kasnak: p.key, rol, temas: p.contact, sarim: r2(p.wrapDeg, 1), cap: r2(2 * p.rPitch, 1), J: r.J[p.key], mu: m == null ? null : r2(m, 3) });
}); });

// 3) karşılaştırma tablosu: Gates · bugünkü MFSim · yeniden kurulan (gevşek, 0,88/0,60)
const tablo = [];
RAPORLAR.forEach((ad) => { const r = Z[ad]; r.pl.forEach((p, i) => {
  const g = r.gates[p.key].filter((x) => x > 0);
  const e = egri(r, i, 'gevsek', MUG, MUB).filter((x, a) => r.gates[p.key][a] > 0);
  const b = (r.bugun[p.key] || []).filter((x) => isFinite(x[1]));
  if (!g.length) return;
  tablo.push({ rapor: ad, kasnak: p.key, temas: p.contact, sarim: r2(p.wrapDeg, 1),
    yuklu: b.some((x) => x[2] >= 1.01), gates: r2(Math.min(...g)), bugun: b.length ? r2(Math.min(...b.map((x) => x[1]))) : null,
    yeni: r2(Math.min(...e.map((x) => x.sf))) });
}); });

// 4) grafik verisi: iki rapor
function grafik(ad) {
  const r = Z[ad];
  return { rapor: ad, izgara: r.izgara, kasnaklar: r.pl.map((p, i) => ({
    kasnak: p.key, temas: p.contact,
    gates: r.gates[p.key].map((x) => (x > 0 ? r2(x, 3) : null)),
    yeni: egri(r, i, 'gevsek', MUG, MUB).map((x) => r2(x.sf, 3)),
    bugun: (r.bugun[p.key] || []).map((x) => [x[0], r2(x[1], 3)]),
  })) };
}
const grafikler = [grafik('AG00810_10PK1215HD'), grafik('AG00879_8PK1392HD')];

// 5) bağımsız doğrulama: AG00810 tepe gerginliği (Gates s.1: CRK 2530 N @ 600 d/dk, +1000 RPM/s).
// Zincir tam 600 d/dk'da, Gates'in yük tablosundaki ALT gücüyle (9,0 kW) kurulur.
function zincirTek(r, rpm, a, kwMap) {
  const n = r.pl.length, c = r.pl.findIndex((p) => /^(CRK|FAN|SRC)$/.test(p.key)), t = r.pl.findIndex((p) => p.key === 'TEN');
  const rc = r.pl[c].rPitch / 1000, v = rpm * 2 * Math.PI / 60 * rc;
  const dT = r.pl.map((p, i) => i === c ? 0 : ((kwMap[p.key] || 0) * 1000 / v + r.J[p.key] * a * p.speedRatio * 2 * Math.PI / 60 / (p.rPitch / 1000)));
  dT[c] = dT.reduce((s, x, i) => s + (i === c ? 0 : x), 0);
  const T = new Array(n).fill(NaN); T[t] = r.T0;
  for (let j = 1; j < n; j++) { const k = (t + j) % n, pr = (k - 1 + n) % n; T[k] = T[pr] + (k === c ? +1 : -1) * dT[k]; }
  return Math.max(...T);
}
const r810 = Z0.AG00810_10PK1215HD;
const dogrulama = { gates: 2530, model: r2(zincirTek(r810, 600, 1000, { ALT: 9.0 }), 1), ivmesiz: r2(zincirTek(r810, 600, 0, { ALT: 9.0 }), 1) };

const out = { mu: { g: MUG, b: MUB }, tanim, muListe: mu, tablo, grafikler, dogrulama, rapor: RAPORLAR.length,
  nokta: tanim.gatesMu.gevsek.n };
fs.writeFileSync(G + '/sayfa-veri.json', JSON.stringify(out));
console.log(JSON.stringify({ tanim, dogrulama, rapor: RAPORLAR.length }, null, 1));
const gr = (rol, temas) => mu.filter((m) => m.rol === rol && (!temas || m.temas === temas)).map((m) => m.mu);
console.log('sürücü', gr('surucu'), '\naksesuar', gr('aksesuar'), '\nalternatör', gr('alternator'), '\navara', gr('avara'));
