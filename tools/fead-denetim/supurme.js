/* SUITE D — DEĞİŞKEN SÜPÜRMELERİ ve FİZİKSEL MAKULLÜK */
const L = require('./lib.js'); const C = L.C;
const DEG = Math.PI / 180; const OUT = {}; const say = (...a) => console.log(...a);
const ref = require('./ref.js');
const LOADS = { FAN: 4.2, AC: 3.6, ALT: 2.8 };

/* ═════ D1 — KAYIŞ PROFİLİ × MARKA: çap katmanı her profilde tutarlı mı ═══
 * Özdeşlik L_pitch − L_eff = 2π·hb her profil/marka için AYRI hb ile. */
say('═════ D1 — BEŞ PROFİL × MARKA (çap katmanı) ═════');
{
  const rows = [];
  const DB = C.BELT_DB;
  Object.keys(DB).forEach(prof => Object.keys(DB[prof]).forEach(brand => {
    const bp = C.beltProps({ profile: prof, brand });
    /* düzgün altıgen, kasnak çapı profilin alt sınırının üstünde */
    const od = Math.max(bp.minPulleyDia * 1.6, 60), Rc = od * 3;
    const P = [];
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3;
      P.push(Object.assign({ name: 'P' + i, contact: i === 4 ? 'back' : 'grooved',
        c: [Rc * Math.cos(a), Rc * Math.sin(a)] },
        C.radiiFromOD(od, i === 4 ? 'back' : 'grooved', bp)));
    }
    /* sırt kasnağını içeri al ki gerçekten ters bükülsün */
    let g, ok = true, msg = '';
    try { g = C.solveGeometry(P); } catch (e) { ok = false; msg = e.message.slice(0, 40); }
    const idOK = g ? Math.abs(g.LpitchMm - g.LeffMm - 2 * Math.PI * bp.hb) < 1e-9 : false;
    rows.push({ prof, brand, hb: bp.hb, hr: bp.hr, ok, idOK, msg,
      sarim: g ? +Math.abs(g.signedWrapDeg).toFixed(6) : null });
    say(`  ${(prof + '/' + brand).padEnd(16)} hb=${String(bp.hb).padEnd(5)} hr=${String(bp.hr).padEnd(4)} ` +
      (ok ? `Σsarım=${Math.abs(g.signedWrapDeg).toFixed(4)}° · özdeşlik ${idOK ? '✓' : '✗'}` : `çözülemedi: ${msg}`));
  }));
  OUT.D1 = rows;
  say(`  → ${rows.filter(r => r.ok && r.idOK).length}/${rows.length} profil-marka çiftinde çap katmanı tutarlı`);
}

/* ═════ D2 — YAY KÜNYESİ SÜPÜRMESİ: T ve hubload nasıl davranıyor ═══════ */
say('\n═════ D2 — YAY ÖN YÜKÜ / KATSAYISI SÜPÜRMESİ ═════');
{
  say('  önyük[Nm] katsayı  kol[°]   T[N]   hub[N]  T/kaburga  SF_min');
  const rows = [];
  for (const pre of [15, 25, 34, 45, 60]) {
    for (const rate of [0.10, 0.22, 0.40]) {
      const R = ref.refSys({ preloadNm: pre, rateNmPerDeg: rate });
      const rel = C.meanRel(R.sys), st = C.tensionerState(R.sys, rel);
      const tn = C.spanTensions(R.sys, { engineRpm: 1800, loadsKw: LOADS });
      const sl = C.slipSafety(st.geom, tn.spanN);
      const sf = Math.min.apply(null, sl.map(x => x.SF));
      rows.push({ pre, rate, rel, T: st.tensionN, hub: st.hubloadN, perRib: st.tensionN / 6, sf });
      say(`  ${String(pre).padStart(7)}  ${String(rate).padEnd(6)} ${rel.toFixed(2).padStart(6)} ${st.tensionN.toFixed(0).padStart(7)} ${st.hubloadN.toFixed(0).padStart(7)}  ${(st.tensionN / 6).toFixed(0).padStart(8)}   ${sf.toFixed(2)}`);
    }
  }
  OUT.D2 = rows;
  /* kayış boyu SABİT tutulduğu için kol açısı da sabit: T ön yükle DOĞRUSAL olmalı */
  const a = rows.filter(r => r.rate === 0.22);
  const lin = a.map(r => r.T / (r.pre + r.rate * r.rel));
  const sac = (Math.max.apply(null, lin) - Math.min.apply(null, lin)) / lin[0];
  say(`  → T/(M₀+k·θ) sabit mi: saçılma %${(sac * 100).toFixed(4)} (take-up geometriden, yaydan bağımsız)`);
  OUT.D2lin = sac;
}

/* ═════ D3 — KABURGA SAYISI ve ÖMÜR ÖLÇEKLEMESİ ═════════════════════════ */
say('\n═════ D3 — KABURGA SAYISI ↔ ÖMÜR ═════');
{
  const duty = [{ engineRpm: 900, dcPct: 40, loadsKw: LOADS }, { engineRpm: 1800, dcPct: 45, loadsKw: LOADS },
    { engineRpm: 2400, dcPct: 15, loadsKw: LOADS }];
  say('  kaburga  T_tas[N]  T/kaburga  B10[h]   ölçek (ribs/T)^0.96');
  const rows = [];
  for (const ribs of [4, 6, 8, 10]) {
    const R = ref.refSys({ ribs });
    const b = C.beltLifeB10(R.sys, { duty, degC: 90 });
    rows.push({ ribs, T: R.sys.designTensionN, b10: b.hoursB10, oran: R.sys.designTensionN / ribs });
    say(`  ${String(ribs).padStart(7)}  ${R.sys.designTensionN.toFixed(0).padStart(8)}  ${(R.sys.designTensionN / ribs).toFixed(1).padStart(9)}  ${b.hoursB10.toFixed(0).padStart(7)}   ${Math.pow(ribs / R.sys.designTensionN, 0.96).toExponential(2)}`);
  }
  /* T sabit kaldığı için (geometri aynı) B10 ~ ribs^0.96 olmalı */
  const k = rows.map(r => r.b10 / Math.pow(r.ribs / r.T, 0.96));
  say(`  → B10/(kaburga/T)^0.96 sabit mi: saçılma %${((Math.max.apply(null, k) - Math.min.apply(null, k)) / k[0] * 100).toFixed(4)}`);
  say(`  NOT: çekirdeğin ribTensionExp=1.13 sabiti (AG0868 kontrollü deneyi) beltLifeB10'da KULLANILMIYOR;`);
  say(`       mutlak ömürde üs absolute.tensionExp=0.96.`);
  OUT.D3 = rows;
}

/* ═════ D4 — DUTY KAPSAMI 100'DEN FARKLIYSA ═════════════════════════════ */
say('\n═════ D4 — ÇALIŞMA ÇEVRİMİ KAPSAMI ═════');
{
  const R = ref.refSys();
  const tam = [{ engineRpm: 900, dcPct: 40, loadsKw: LOADS }, { engineRpm: 1800, dcPct: 45, loadsKw: LOADS },
    { engineRpm: 2400, dcPct: 15, loadsKw: LOADS }];
  const yarim = [{ engineRpm: 900, dcPct: 20, loadsKw: LOADS }, { engineRpm: 1800, dcPct: 22, loadsKw: LOADS },
    { engineRpm: 2400, dcPct: 8, loadsKw: LOADS }];
  const b1 = C.beltLifeB10(R.sys, { duty: tam, degC: 90 });
  const b2 = C.beltLifeB10(R.sys, { duty: yarim, degC: 90 });
  say(`  Σdc=100% → B10 ${b1.hoursB10.toFixed(0)} h (dutyCoverage ${b1.dutyCoverage.toFixed(2)})`);
  say(`  Σdc= 50% → B10 ${b2.hoursB10.toFixed(0)} h (dutyCoverage ${b2.dutyCoverage.toFixed(2)}) · uyarı: ${JSON.stringify(b2.warnings)}`);
  say(`  → eksik kapsam ömrü ${(b2.hoursB10 / b1.hoursB10).toFixed(2)}× büyütüyor; çekirdek sayıyı DÖNDÜRÜYOR ama UYARMIYOR`);
  OUT.D4 = { b1: b1.hoursB10, b2: b2.hoursB10, cov: b2.dutyCoverage, uyari: b2.warnings.length };
}

/* ═════ D5 — SPAN FREKANSI: GERGİNLİK SÖZLEŞMESİ ════════════════════════
 * Zincir ETKİN gerginlik taşıyor (kasnak yüzey kuvveti N = T − m′v²).
 * Hareketli tel formülü ise GERÇEK gerginlik ister: T_gerçek = T_zincir + m′v².
 *   çekirdek : f = (c_e² − v²)/(2L·c_e),  c_e² = T_zincir/m′
 *   tutarlısı: f = c_e²/(2L·√(c_e²+v²)) */
say('\n═════ D5 — SPAN FREKANSI GERGİNLİK SÖZLEŞMESİ ═════');
{
  const R = ref.refSys();
  const mp = C.massPerM(R.sys);
  say('  devir   v[m/s]  çekirdek f1[Hz]  tutarlı f1[Hz]  fark      flutter?');
  const rows = [];
  for (const rpm of [800, 1500, 2200, 3000, 4000, 5000]) {
    const tn = C.spanTensions(R.sys, { engineRpm: rpm, loadsKw: LOADS });
    const fr = C.spanFrequencies(R.sys, R.st.geom, tn.spanN, { engineRpm: rpm });
    let i = 0, w = -1;                                   /* en uzun span */
    R.st.geom.spans.forEach((s, k) => { if (s.L > w) { w = s.L; i = k; } });
    const Lm = w / 1000, Te = tn.spanN[i];
    const ce = Math.sqrt(Te / mp);
    const dogru = ce * ce / (2 * Lm * Math.sqrt(ce * ce + tn.vMs * tn.vMs));
    rows.push({ rpm, v: tn.vMs, core: fr[i].fHz[0], tutarli: dogru, flutter: fr[i].flutter });
    say(`  ${String(rpm).padStart(5)}  ${tn.vMs.toFixed(2).padStart(6)}  ${fr[i].fHz[0].toFixed(1).padStart(13)}  ${dogru.toFixed(1).padStart(13)}  ${((fr[i].fHz[0] / dogru - 1) * 100).toFixed(1).padStart(7)}%   ${fr[i].flutter}`);
  }
  OUT.D5 = rows;
  /* flutter bayrağı popülasyonda ne sıklıkta yanıyor */
  const rr = L.rng(5150); let n = 0, fl = 0;
  for (let i = 0; i < 400; i++) {
    const S = L.genSystem(rr); if (!S) continue;
    try {
      const rel = C.meanRel(S.sys), st = C.tensionerState(S.sys, rel);
      const tn = C.spanTensions(S.sys, { engineRpm: 3000, loadsKw: S.loads });
      const fr = C.spanFrequencies(S.sys, st.geom, tn.spanN, { engineRpm: 3000 });
      n++; if (fr.some(f => f.flutter)) fl++;
    } catch (e) { }
  }
  say(`  → 3000 d/d'de flutter bayrağı yanan sistem: ${fl}/${n} (%${(fl / n * 100).toFixed(1)})`);
  say(`     m′v² dahil edilseydi c > v her zaman sağlanır, flutter YAPISAL OLARAK oluşamaz.`);
  OUT.D5fl = { n, fl };
}

/* ═════ D6 — MOTOR DEVRİ SÜPÜRMESİ: mühendislik aralıkları makul mü ════ */
say('\n═════ D6 — FİZİKSEL MAKULLÜK PANOSU (referans sistem) ═════');
{
  const R = ref.refSys();
  const cyl = 6;
  say('  devir  v[m/s] T_min T_max T/kab SF_min hub_krank[N] f_span[Hz] f_ateş[Hz]  1.mod[Hz]');
  const rows = [];
  for (const rpm of [700, 1200, 1800, 2400, 3000]) {
    const tn = C.spanTensions(R.sys, { engineRpm: rpm, loadsKw: LOADS });
    const sl = C.slipSafety(R.st.geom, tn.spanN);
    const hb = C.hubloads(R.st.geom, tn.spanN);
    const fr = C.spanFrequencies(R.sys, R.st.geom, tn.spanN, { engineRpm: rpm });
    const tor = C.torsionalModel(R.sys, { relDeg: 18 });
    const fs = fr.map(f => f.fHz[0]).filter(x => x > 0);
    const row = { rpm, v: tn.vMs, tmin: Math.min.apply(null, tn.spanN), tmax: Math.max.apply(null, tn.spanN),
      sf: Math.min.apply(null, sl.map(x => x.SF)), hub: hb[R.sys._crkIdx].FN,
      fspan: Math.min.apply(null, fs), fir: C.firingFrequencyHz(rpm, cyl), mod1: tor.firstElasticHz };
    rows.push(row);
    say(`  ${String(rpm).padStart(5)} ${tn.vMs.toFixed(1).padStart(6)} ${row.tmin.toFixed(0).padStart(5)} ${row.tmax.toFixed(0).padStart(5)} ${(R.sys.designTensionN / 6).toFixed(0).padStart(5)} ${row.sf.toFixed(2).padStart(6)} ${row.hub.toFixed(0).padStart(12)} ${row.fspan.toFixed(0).padStart(10)} ${row.fir.toFixed(0).padStart(10)} ${row.mod1.toFixed(1).padStart(10)}`);
  }
  OUT.D6 = rows;
  say(`  ölçütler: T/kaburga 60–130 N · SF>1.2 · hubload<2500 N · 1.mod ateşleme frekansından uzak`);
}

