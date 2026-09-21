/* E2b — FLUTTER: iki farklı sebep AYRILIYOR
 *   (a) T_span ≤ 0  → kayış gerçekten gevşek, bayrak HAKLI
 *   (b) T_span > 0 ama c ≤ v → merkezkaç ihmalinin ürettiği YAPAY bayrak */
const L = require('./lib.js'); const C = L.C; const say = (...a) => console.log(...a);
const OUT = {};
say('═════ E2b — ÇIRPINMA BAYRAĞININ SEBEBİ AYRIŞTIRILDI ═════');
say('  devir  m′/kab   sistem  gevşek(T≤0)  YAPAY(T>0,c≤v)  frekans sapması ortanca/%5');
for (const mr of [0.0144, 0.0196]) {
  for (const rpm of [1200, 1800, 2400, 3000, 4000]) {
    const rr = L.rng(90210);
    let n = 0, gevsek = 0, yapay = 0; const sap = [];
    for (let i = 0; i < 500; i++) {
      const S = L.genSystem(rr); if (!S) continue;
      S.sys.belt.massPerRibKgM = mr;
      try {
        const rel = C.meanRel(S.sys), st = C.tensionerState(S.sys, rel);
        const tn = C.spanTensions(S.sys, { engineRpm: rpm, loadsKw: S.loads });
        const perRib = S.sys.designTensionN / S.sys.belt.ribs;
        if (!(perRib >= 60 && perRib <= 130)) continue;          /* gerçekçi tasarımlar */
        const fr = C.spanFrequencies(S.sys, st.geom, tn.spanN, { engineRpm: rpm });
        const mp = C.massPerM(S.sys);
        n++;
        const negVar = tn.spanN.some(t => t <= 0);
        const yapayVar = fr.some((f, k) => f.flutter && tn.spanN[k] > 0);
        if (negVar) gevsek++;
        if (yapayVar && !negVar) yapay++;
        if (!negVar) fr.forEach((f, k) => {
          const ce = Math.sqrt(tn.spanN[k] / mp), Lm = st.geom.spans[k].L / 1000;
          const dogru = ce * ce / (2 * Lm * Math.sqrt(ce * ce + tn.vMs * tn.vMs));
          sap.push((f.fHz[0] / dogru - 1) * 100);
        });
      } catch (e) { }
    }
    sap.sort((a, b) => a - b);
    const p5 = sap[Math.floor(sap.length * 0.05)];
    say(`  ${String(rpm).padStart(5)}  ${String(mr).padEnd(7)} ${String(n).padStart(6)} ${String(gevsek).padStart(11)} ${String(yapay).padStart(15)}   %${sap[Math.floor(sap.length/2)].toFixed(1)} / %${p5 != null ? p5.toFixed(1) : '—'}`);
    OUT[`${mr}_${rpm}`] = { n, gevsek, yapay, ortanca: sap[Math.floor(sap.length/2)], p5 };
  }
}
say('  → "gevşek" sütunu MODELİN HAKLI uyarısı (negatif span gerginliği ayrıca uyarı üretiyor).');
say('  → "YAPAY" sütunu merkezkaç ihmalinden doğan bayrak: T>0 olduğu hâlde c ≤ v.');
