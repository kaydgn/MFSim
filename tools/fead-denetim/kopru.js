/* SUITE F — KÖPRÜNÜN DÜZELTMELERİ ÖLÇÜLÜYOR
 * A–E takımları ÇEKİRDEĞİ sınıyor ve çekirdek dokunulmaz. Bulguların
 * düzeltmesi köprüde (js/fead-model.js); bu takım aynı referanssız ölçütleri
 * köprüden geçirerek koşuyor. Kalıcı kapı: tests/unit/fead-denetim-bulgular.js */
const L = require('./lib.js'); const C = L.C;
const ref = require('./ref.js');
const F = require('../../js/fead-core.js');
const M = require('../../js/fead-model.js');
global.FEADCore = F;
Object.keys(M).forEach(function (k) { global[k] = M[k]; });
const say = (...a) => console.log(...a);
const LOADS = { FAN: 4.2, AC: 3.6, ALT: 2.8 };

const buildOf = (o) => {
  const R = ref.refSys(o);
  return { ok: true, sys: R.sys, st: R.st, names: R.sys.pulleys.map(p => p.name),
    order: R.sys.pulleys.map(p => ({ data: { inertia: p.inertiaKgM2 } })),
    solver: { data: { cylinders: 6 } } };
};

say('═════ F1 — TAHRİK ORANI DEĞİŞMEZLİĞİ, KÖPRÜDEN ═════');
{
  const A = buildOf({ driveRatio: 1 }), B = buildOf({ driveRatio: 2 });
  const olc = (kopru) => {
    const pa = C.peakEstimate(A.sys, { engineRpm: 1800, accelRpmS: 1100, loadsKw: LOADS,
      inertias: kopru ? veFeadPeakInertias(A) : undefined });
    const pb = C.peakEstimate(B.sys, { engineRpm: 900, accelRpmS: 550, loadsKw: LOADS,
      inertias: kopru ? veFeadPeakInertias(B) : undefined });
    let w = 0;
    pa.accel.spanN.forEach((T, i) => { w = Math.max(w, Math.abs(T - pb.accel.spanN[i]) / Math.abs(T)); });
    const n = A.sys._n, t = A.sys._tenIdx;
    return { w: w * 100,
      artik: Math.abs(pa.accel.spanN[(t - 1 + n) % n] - pa.accel.spanN[t]),
      max: pa.accel.maxN };
  };
  const ham = olc(false), duz = olc(true);
  say(`  iki yazım arasındaki en büyük fark : ham %${ham.w.toFixed(2)}  →  köprüyle %${duz.w.toExponential(1)}`);
  say(`  çevrim artığı (0 olmalı)           : ham ${ham.artik.toFixed(2)} N  →  köprüyle ${duz.artik.toExponential(1)} N`);
  say(`  tepe gerginlik                     : ham ${ham.max.toFixed(1)} N  →  köprüyle ${duz.max.toFixed(1)} N`);
}

say('\n═════ F2 — AÇIKLIK FREKANSI, KÖPRÜDEN ═════');
{
  const B = buildOf();
  say('  devir   ham f₁[Hz]  köprü f₁[Hz]  fark      ham çırpınma  köprü çırpınma');
  [1200, 1800, 2400, 3000, 4000].forEach(rpm => {
    const tn = C.spanTensions(B.sys, { engineRpm: rpm, loadsKw: LOADS });
    const ham = C.spanFrequencies(B.sys, B.st.geom, tn.spanN, { engineRpm: rpm });
    const yeni = veFeadSpanFreqRows(B.sys, B.st.geom, tn.spanN, { engineRpm: rpm });
    let i = 0, w = -1;
    B.st.geom.spans.forEach((s, k) => { if (s.L > w) { w = s.L; i = k; } });
    say(`  ${String(rpm).padStart(5)}  ${ham[i].fHz[0].toFixed(1).padStart(9)}  ${yeni[i].fHz[0].toFixed(1).padStart(12)}  ${(((yeni[i].fHz[0] / ham[i].fHz[0]) - 1) * 100).toFixed(1).padStart(6)}%   ${String(ham.some(s => s.flutter)).padStart(11)}  ${String(yeni.some(s => s.flutter)).padStart(14)}`);
  });
  /* popülasyonda yapay çırpınma */
  const rr = L.rng(90210);
  let n = 0, hamFl = 0, yeniFl = 0;
  for (let i = 0; i < 500; i++) {
    const S = L.genSystem(rr); if (!S) continue;
    S.sys.belt.massPerRibKgM = 0.0196;
    try {
      const rel = C.meanRel(S.sys), st = C.tensionerState(S.sys, rel);
      const tn = C.spanTensions(S.sys, { engineRpm: 3000, loadsKw: S.loads });
      if (tn.spanN.some(t => t <= 0)) continue;
      const perRib = S.sys.designTensionN / S.sys.belt.ribs;
      if (!(perRib >= 60 && perRib <= 130)) continue;
      n++;
      if (C.spanFrequencies(S.sys, st.geom, tn.spanN, { engineRpm: 3000 }).some(s => s.flutter)) hamFl++;
      if (veFeadSpanFreqRows(S.sys, st.geom, tn.spanN, { engineRpm: 3000 }).some(s => s.flutter)) yeniFl++;
    } catch (e) { }
  }
  say(`  3000 d/d · ${n} gerçekçi tasarım → çırpınma bayrağı: ham ${hamFl} · köprüyle ${yeniFl}`);
}

say('\n═════ F3 — BURULMA RİJİT MODU, KÖPRÜDEN ═════');
{
  const rr = L.rng(20260921);
  let n = 0, hamKotu = 0, yeniKotu = 0, ornek = null;
  for (let i = 0; i < 600; i++) {
    const S = L.genSystem(rr); if (!S) continue;
    let tor; try { tor = C.torsionalModel(S.sys, { relDeg: C.meanRel(S.sys) }); } catch (e) { continue; }
    if (tor.error) continue;
    n++;
    const hamRb = tor.rigidBodyModes, hamF = tor.firstElasticHz;
    const yeni = veFeadTorsionalNorm(tor);
    if (hamRb !== 1) { hamKotu++; if (!ornek) ornek = { hamF, yeniF: yeni.firstElasticHz, esik: yeni.modeFloorHz }; }
    if (yeni.rigidBodyModes !== 1) yeniKotu++;
  }
  say(`  ${n} sistem · rijit cisim modu ≠ 1: ham ${hamKotu} (%${(hamKotu / n * 100).toFixed(1)})  →  köprüyle ${yeniKotu}`);
  if (ornek) say(`  örnek: firstElasticHz ham ${ornek.hamF.toExponential(2)} Hz → köprüyle ${ornek.yeniF.toFixed(2)} Hz (göreli eşik ${ornek.esik.toExponential(2)} Hz)`);
}
