// Gates kayma eğrileri ↔ MFSim geometrisiyle kurulan Gates koşulu: tanım testi + μ kalibrasyonu.
const fs = require('fs');
const G = process.argv[2];
const Z = JSON.parse(fs.readFileSync(G + '/' + (process.env.ZINCIR || 'zincir.json'), 'utf8'));

const TANIM = {
  oran:   (e, Tx, Tn) => e / (Tx / Tn),                   // MFSim bugün
  gevsek: (e, Tx, Tn) => Tn * (e - 1) / (Tx - Tn),         // gevşek taraf kapasitesi / talep
  gergin: (e, Tx, Tn) => Tx * (1 - 1 / e) / (Tx - Tn),     // gergin taraf kapasitesi / talep
};
const SF = (tanim, mu, phi, Tin, Tout) => {
  const Tx = Math.max(Tin, Tout), Tn = Math.min(Tin, Tout);
  if (!(Tn > 0)) return 0;
  if (Tx - Tn < 1e-9) return Infinity;
  return TANIM[tanim](Math.exp(mu * phi), Tx, Tn);
};

// kasnak × devir: kombinasyonların en küçüğü ve hangisi olduğu
function egri(r, i, tanim, muG, muB) {
  const p = r.pl[i], phi = p.wrapDeg * Math.PI / 180, mu = p.contact === 'grooved' ? muG : muB;
  return r.izgara.map((rpm, a) => {
    let en = Infinity, arg = -1;
    r.zincir[a].forEach((kb, b) => { const s = SF(tanim, mu, phi, kb[i][0], kb[i][1]); if (s < en) { en = s; arg = b; } });
    return { rpm, sf: en, kombi: r.kombi[arg], gates: r.gates[p.key][a] };
  });
}

const sinif = (r, i) => {
  const p = r.pl[i];
  if (i === r.pl.findIndex((q) => q.speedRatio === Math.max(...r.pl.map((z) => z.speedRatio))) && false) return '';
  if (r.yukler.includes(p.key)) return 'aksesuar';
  if (p.key === 'CRK' || p.key === 'FAN' || p.key === 'SRC') return 'surucu';
  return p.contact === 'back' ? 'avara-sirt' : 'avara-oluk';
};

// ── 1) Bugünkü μ ile üç tanımın Gates'e uzaklığı
const MUg = 0.90, MUb = 0.35;
function ozet(tanim, muG, muB, filtre = () => true) {
  const ln = [];
  const satir = [];
  for (const [ad, r] of Object.entries(Z)) {
    r.pl.forEach((p, i) => {
      if (!filtre(ad, r, i)) return;
      const e = egri(r, i, tanim, muG, muB).filter((x) => x.gates > 0 && isFinite(x.sf) && x.sf > 0);
      if (!e.length) return;
      const oranlar = e.map((x) => x.sf / x.gates);
      oranlar.forEach((o) => ln.push(Math.log10(o)));
      const med = oranlar.slice().sort((a, b) => a - b)[Math.floor(oranlar.length / 2)];
      satir.push({ ad, key: p.key, sinif: sinif(r, i), temas: p.contact, sarim: +p.wrapDeg.toFixed(1),
        gatesMin: Math.min(...e.map((x) => x.gates)), modelMin: Math.min(...e.map((x) => x.sf)), medOran: med });
    });
  }
  const rms = Math.sqrt(ln.reduce((a, b) => a + b * b, 0) / ln.length);
  return { rms, n: ln.length, satir };
}

const yaz = (x, d = 2) => (x == null || !isFinite(x)) ? '—' : x.toFixed(d);
const out = {};
console.log('== 1) Bugünkü μ (0,90 / 0,35) ile — log10 RMS ve kasnak başına ortanca model/Gates');
for (const t of Object.keys(TANIM)) {
  const o = ozet(t, MUg, MUb);
  out['bugunMu_' + t] = o;
  console.log(`   ${t.padEnd(7)} RMS(log10) ${yaz(o.rms, 3)}  (×${yaz(Math.pow(10, o.rms), 2)})  n=${o.n}`);
}

// ── 2) Kritik koşul: gevşek-taraf tanımında modelin en kötü koşulu Gates'in tablosuyla aynı mı?
console.log('\n== 2) En kötü koşul — model (gevşek tanım) ↔ Gates tablosu');
let tut = 0, top = 0; const kritikSatir = [];
for (const [ad, r] of Object.entries(Z)) {
  r.pl.forEach((p, i) => {
    const k = r.kritik[p.key]; if (!k) return;
    const e = egri(r, i, 'gevsek', MUg, MUb).filter((x) => x.gates > 0);
    if (!e.length) return;
    // devir aralığının EN KÖTÜ noktasındaki koşul (Gates tabloyu tek satır basıyor)
    const enk = e.reduce((a, b) => (b.sf < a.sf ? b : a));
    const aOk = Math.sign(enk.kombi.a) === Math.sign(k[0]);
    const fOk = Object.entries(k[1]).every(([y, v]) => enk.kombi.fr[y] === v);
    top++; if (aOk && fOk) tut++;
    kritikSatir.push({ ad, key: p.key, gates: k, model: [enk.kombi.a, enk.kombi.fr], ivme: aOk, yuk: fOk });
  });
}
out.kritik = { tut, top, satir: kritikSatir };
console.log(`   ${tut}/${top} kasnakta ivme işareti VE yük kombinasyonu aynı`);
kritikSatir.filter((s) => !(s.ivme && s.yuk)).forEach((s) =>
  console.log(`     ≠ ${s.ad} ${s.key}: Gates ${JSON.stringify(s.gates)}  model ${JSON.stringify(s.model)}`));

// ── 3) μ kalibrasyonu (her tanım için)
console.log('\n== 3) μ kalibrasyonu — ızgara taraması, log10 RMS en küçük');
for (const t of Object.keys(TANIM)) {
  let en = { rms: Infinity };
  for (let g = 0.30; g <= 1.60001; g += 0.02) for (let b = 0.10; b <= 1.20001; b += 0.02) {
    const o = ozet(t, g, b);
    if (o.rms < en.rms) en = { rms: o.rms, g: +g.toFixed(2), b: +b.toFixed(2) };
  }
  // yalnız oluklu (aksesuar + sürücü) ve yalnız sırt ayrı ayrı
  let enG = { rms: Infinity }, enB = { rms: Infinity };
  for (let g = 0.30; g <= 1.60001; g += 0.01) {
    const o = ozet(t, g, en.b, (ad, r, i) => r.pl[i].contact === 'grooved');
    if (o.rms < enG.rms) enG = { rms: o.rms, g: +g.toFixed(2) };
  }
  for (let b = 0.05; b <= 1.20001; b += 0.01) {
    const o = ozet(t, en.g, b, (ad, r, i) => r.pl[i].contact === 'back');
    if (o.rms < enB.rms) enB = { rms: o.rms, b: +b.toFixed(2) };
  }
  out['kalib_' + t] = { ortak: en, oluk: enG, sirt: enB, detay: ozet(t, en.g, en.b) };
  console.log(`   ${t.padEnd(7)} ortak μg ${en.g} μb ${en.b} RMS ${yaz(en.rms, 3)} (×${yaz(Math.pow(10, en.rms), 2)})` +
    ` | yalnız oluk μg ${enG.g} RMS ${yaz(enG.rms, 3)} | yalnız sırt μb ${enB.b} RMS ${yaz(enB.rms, 3)}`);
}

// ── 4) Kalibre gevşek tanımında kasnak kasnak
const k = out.kalib_gevsek.ortak;
console.log(`\n== 4) Gevşek tanım, μg ${k.g} μb ${k.b}: kasnak başına (en küçük SF, Gates ↔ model, ortanca oran)`);
out.kalib_gevsek.detay.satir.forEach((s) => console.log(
  `   ${s.ad.padEnd(20)} ${s.key.padEnd(7)} ${s.sinif.padEnd(11)} ${s.temas.padEnd(7)} φ ${String(s.sarim).padStart(5)}°  Gates ${yaz(s.gatesMin).padStart(8)}  model ${yaz(s.modelMin).padStart(8)}  ×${yaz(s.medOran)}`));

// ── 5) Bugünkü MFSim çıktısı (çevrim, kararlı durum, oran) ↔ Gates, yük taşıyan kasnaklar
console.log('\n== 5) Bugünkü MFSim (çevrim yükü, kararlı durum, oran tanımı) ↔ Gates — en küçük SF');
const bugunSatir = [];
for (const [ad, r] of Object.entries(Z)) {
  r.pl.forEach((p, i) => {
    const b = (r.bugun[p.key] || []).filter((x) => isFinite(x[1]));
    const g = r.gates[p.key].filter((x) => x > 0);
    if (!b.length || !g.length) return;
    const yuklu = b.some((x) => x[2] >= 1.01);
    bugunSatir.push({ ad, key: p.key, yuklu, bugunMin: Math.min(...b.map((x) => x[1])), gatesMin: Math.min(...g) });
  });
}
out.bugun = bugunSatir;
bugunSatir.forEach((s) => console.log(`   ${s.ad.padEnd(20)} ${s.key.padEnd(7)} ${s.yuklu ? 'yüklü ' : 'boşta '} MFSim ${yaz(s.bugunMin).padStart(7)}  Gates ${yaz(s.gatesMin).padStart(8)}`));

fs.writeFileSync(G + '/' + (process.env.ZINCIR || 'zincir.json').replace('zincir', 'analiz'), JSON.stringify(out));
