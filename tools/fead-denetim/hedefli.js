/* SUITE C — HEDEFLİ İNCELEMELER. Her biri fiziksel bir hükmü sınar. */
const L = require('./lib.js');
const C = L.C;
const DEG = Math.PI / 180;
const OUT = {};
const say = (...a) => console.log(...a);
const r = L.rng(777);

/* Denetime elverişli, tekrarlanabilir bir referans sistem: 6 kasnaklı
 * serpantin. Gates'ten değil, elle kurgulanmış. */
const refSys = require('./ref.js').refSys;
const LOADS = { FAN: 4.2, AC: 3.6, ALT: 2.8 };
{
  const R = refSys();
  say('REFERANS SİSTEM (elle kurgulandı, Gates değil)');
  say(`  6 kasnak · kayış ${R.sys.belt.effLength.toFixed(1)} mm · 6PK`);
  say(`  çalışma kolu 18.0° · T_tasarım ${R.sys.designTensionN.toFixed(1)} N · hubload ${R.st.hubloadN.toFixed(0)} N`);
  say(`  sarım: ` + R.st.geom.names.map((n, i) => `${n} ${R.st.geom.wrapDeg(i).toFixed(1)}°`).join(' · '));
  OUT.ref = { L: R.sys.belt.effLength, T: R.sys.designTensionN, hub: R.st.hubloadN };
}

/* ═════ C1 — TAHRİK ORANI: FİZİKSEL OLARAK AYNI SİSTEM, İKİ YAZIM ═════════
 * driveRatio = krank kasnağı devri / motor devri. Aşağıdaki iki yazım AYNI
 * fiziksel makinedir: krank kasnağı her ikisinde de 1800 d/d ve 1100 d/d/s.
 * Dolayısıyla bütün gerginlikler birebir aynı olmak ZORUNDA. */
say('\n═════ C1 — TAHRİK ORANI DEĞİŞMEZLİĞİ (tepe yük zinciri) ═════');
{
  const A = refSys({ driveRatio: 1 });
  const B = refSys({ driveRatio: 2 });
  const accel = 1100;
  const pa = C.peakEstimate(A.sys, { engineRpm: 1800, accelRpmS: accel, loadsKw: LOADS });
  const pb = C.peakEstimate(B.sys, { engineRpm: 900, accelRpmS: accel / 2, loadsKw: LOADS });
  /* elle: ΔT_k = P_k/v + J_k·α_k/r_k ,  α_k = ivme_motor·oran(motor→aksesuar)·2π/60 */
  const v = C.beltSpeed(A.sys, 1800);
  const hand = {};
  A.sys.pulleys.forEach((p, i) => {
    const oran = C.speedRatio(A.sys, i);
    const alphaK = accel * oran * 2 * Math.PI / 60;
    hand[p.name] = (LOADS[p.name] || 0) * 1000 / v + (p.inertiaKgM2 || 0) * alphaK / (p.rPitch / 1000);
  });
  say(`  kayış hızı: A ${C.beltSpeed(A.sys, 1800).toFixed(3)} m/s · B ${C.beltSpeed(B.sys, 900).toFixed(3)} m/s  → ${Math.abs(C.beltSpeed(A.sys,1800)-C.beltSpeed(B.sys,900))<1e-12 ? 'AYNI ✓' : 'FARKLI ✗'}`);
  say(`  ALT devri:  A ${C.accessoryRpm(A.sys, 4, 1800).toFixed(1)} · B ${C.accessoryRpm(B.sys, 4, 900).toFixed(1)}  → ${Math.abs(C.accessoryRpm(A.sys,4,1800)-C.accessoryRpm(B.sys,4,900))<1e-9 ? 'AYNI ✓' : 'FARKLI ✗'}`);
  say('  tepe gerginlik (ivme dalı):');
  const names = A.sys.pulleys.map(p => p.name);
  let worst = 0;
  names.forEach((nm, i) => {
    const a = pa.accel.spanN[i], b = pb.accel.spanN[i];
    const d = Math.abs(a - b) / Math.max(1, Math.abs(a)) * 100;
    worst = Math.max(worst, d);
    say(`    ${nm.padEnd(6)} A=${a.toFixed(1).padStart(8)} N   B=${b.toFixed(1).padStart(8)} N   fark ${d.toFixed(2)}%`);
  });
  say(`  → en büyük fark ${worst.toFixed(2)}% (0 olmak ZORUNDA: aynı makine)`);
  say('  elle hesap (ΔT = P/v + J·α/r) ile karşılaştırma, ivme adımları:');
  let hw = { A: 0, B: 0 };
  names.forEach((nm, i) => {
    if (i === A.sys._crkIdx || i === A.sys._tenIdx) return;
    const dA = Math.abs(pa.accel.spanN[i] - pa.accel.spanN[(i - 1 + 6) % 6]);
    const dB = Math.abs(pb.accel.spanN[i] - pb.accel.spanN[(i - 1 + 6) % 6]);
    hw.A = Math.max(hw.A, Math.abs(dA - hand[nm]) / hand[nm] * 100);
    hw.B = Math.max(hw.B, Math.abs(dB - hand[nm]) / hand[nm] * 100);
    say(`    ${nm.padEnd(6)} elle=${hand[nm].toFixed(2).padStart(8)} N   A=${dA.toFixed(2).padStart(8)}   B=${dB.toFixed(2).padStart(8)}`);
  });
  say(`  → elle hesaptan sapma: A %${hw.A.toFixed(2)} · B %${hw.B.toFixed(2)}`);
  OUT.C1 = { worstPct: worst, handA: hw.A, handB: hw.B };
}

/* ═════ C2 — TEPE ZİNCİRİNDE ÇEVRİM KAPANIŞI ═════════════════════════════
 * Kayış kapalı bir halka: bir turda gerginlik değişimlerinin toplamı 0.
 * Zincir gergi açıklığında ankrajlanır ve bir önceki kasnakta biter; gergi
 * YÜKSÜZ bir avara olduğu için giriş = çıkış olmak zorunda. */
say('\n═════ C2 — TEPE ZİNCİRİ ÇEVRİM KAPANIŞI ═════');
{
  const R = refSys();
  const n = R.sys._n, t = R.sys._tenIdx, c = R.sys._crkIdx;
  const mean = C.spanTensions(R.sys, { engineRpm: 1800, loadsKw: LOADS });
  const artikOrt = mean.perPulley[t].entryTensionN - mean.perPulley[t].exitTensionN;
  const pk = C.peakEstimate(R.sys, { engineRpm: 1800, accelRpmS: 1100, loadsKw: LOADS });
  const artikTepe = pk.accel.spanN[(t - 1 + n) % n] - pk.accel.spanN[t];
  say(`  ORTALAMA zincir artığı : ${artikOrt.toExponential(3)} N   (0 olmalı)`);
  say(`  TEPE   zincir artığı   : ${artikTepe.toFixed(2)} N   (0 olmalı)`);
  say(`     → tepe gerginliğinin %${Math.abs(artikTepe / pk.accel.maxN * 100).toFixed(1)}'i kadar`);
  /* köprünün düzeltmesi: kranka EŞDEĞER atalet geçir */
  let pay = 0;
  R.sys.pulleys.forEach((p, i) => {
    if (i === c || i === t) return;
    pay += (p.inertiaKgM2 || 0) * C.speedRatio(R.sys, i) / (p.rPitch / 1000);
  });
  const Jeq = pay * (R.sys.pulleys[c].rPitch / 1000) / C.speedRatio(R.sys, c);
  const pk2 = C.peakEstimate(R.sys, { engineRpm: 1800, accelRpmS: 1100, loadsKw: LOADS,
    inertias: { KRANK: Jeq } });
  const artik2 = pk2.accel.spanN[(t - 1 + n) % n] - pk2.accel.spanN[t];
  say(`  köprünün eşdeğer ataleti J_eş = ${Jeq.toFixed(5)} kg·m² (krankın kendi ${R.sys.pulleys[c].inertiaKgM2})`);
  say(`  düzeltilmiş artık       : ${artik2.toExponential(3)} N  → ${Math.abs(artik2) < 1e-9 ? 'KAPANIYOR ✓' : 'KAPANMIYOR ✗'}`);
  say(`  tepe gerginlik farkı (düzeltmesiz → düzeltmeli): ${pk.accel.maxN.toFixed(1)} → ${pk2.accel.maxN.toFixed(1)} N`);
  OUT.C2 = { artikOrt, artikTepe, Jeq, artik2, maxHam: pk.accel.maxN, maxDuz: pk2.accel.maxN };
  /* aynı sınama 200 rastgele sistemde: çekirdeğin ham davranışı */
  let nn = 0, sum = 0, worst = 0;
  const rr = L.rng(4242);
  for (let i = 0; i < 300; i++) {
    const S = L.genSystem(rr); if (!S) continue;
    try {
      const p = C.peakEstimate(S.sys, { engineRpm: 1800, accelRpmS: 1000, loadsKw: S.loads });
      const tt = S.sys._tenIdx, N = S.sys._n;
      const a = Math.abs(p.accel.spanN[(tt - 1 + N) % N] - p.accel.spanN[tt]);
      const pct = a / Math.abs(p.accel.maxN) * 100;
      nn++; sum += pct; worst = Math.max(worst, pct);
    } catch (e) { }
  }
  say(`  300 bağımsız sistemde ham artık: ortalama %${(sum / nn).toFixed(1)} · en kötü %${worst.toFixed(1)} (n=${nn})`);
  OUT.C2.fuzz = { n: nn, ort: sum / nn, worst };
}

/* ═════ C3 — L(θ) TEK KÖKLÜ MÜ? (bisection'ın sessiz varsayımı) ═════ */
say('\n═════ C3 — KOL AÇISI ÇÖZÜMÜNÜN TEK KÖKLÜLÜĞÜ ═════');
{
  const rr = L.rng(31337);
  let n = 0, statIcinde = 0, statVar = 0, paylar = [];
  for (let i = 0; i < 600; i++) {
    const S = L.genSystem(rr); if (!S) continue;
    let hi, rel; try { hi = C.feasibleRelMax(S.sys); rel = C.meanRel(S.sys); } catch (e) { continue; }
    n++;
    let stat = null, prevL = Infinity;
    for (let k = 0; k <= 90; k++) {
      const a = hi * k / 90;
      let s2; try { s2 = C.tensionerState(S.sys, a); } catch (e) { break; }
      if (s2.driveLenMm > prevL + 1e-9) { stat = a; break; }
      prevL = s2.driveLenMm;
    }
    if (stat != null) {
      statVar++;
      const stop = rel * 1.8;                      /* MFSim'in koyduğu durdurucu */
      paylar.push(stat - stop);
      if (stat <= stop) statIcinde++;
    }
  }
  paylar.sort((a, b) => a - b);
  say(`  ${n} sistem · boy eğrisinde durağan nokta OLAN: ${statVar} (%${(statVar / n * 100).toFixed(0)})`);
  say(`  → çekirdeğin varsayılan aralığı (0…89°) bu sistemlerde TEK KÖKLÜ DEĞİL`);
  say(`  MFSim'in durdurucusu (1.8 × çalışma açısı) içinde kalan: ${statIcinde} (%${(statIcinde / n * 100).toFixed(1)})`);
  if (paylar.length) say(`  durdurucu → durağan nokta payı: en dar ${paylar[0].toFixed(1)}° · ortanca ${paylar[Math.floor(paylar.length / 2)].toFixed(1)}° · en geniş ${paylar[paylar.length - 1].toFixed(1)}°`);
  OUT.C3 = { n, statVar, statIcinde, payEnDar: paylar[0], payOrtanca: paylar[Math.floor(paylar.length / 2)] };
  /* kasten iki köklü bir hedef: çekirdek ne yapıyor? */
  const R2 = refSys();
  say(`  referans sistemde kol sınırı ${C.feasibleRelMax(R2.sys).toFixed(1)}° — durağan nokta yok, tek köklü.`);
}

/* ═════ C4 — MERKEZKAÇ GERGİNLİĞİ MODELDE YOK ═════════════════════════════
 * Gerçek kayışta T_c = m'·v² her açıklığa eklenir ve sürtünme kapasitesini
 * DÜŞÜRÜR: (T₁−T_c)/(T₂−T_c) ≤ e^(μφ). Çekirdeğin zinciri m'v² taşımıyor. */
say('\n═════ C4 — MERKEZKAÇ GERGİNLİĞİ (m′v²) ═════');
{
  const R = refSys();
  const mp = C.massPerM(R.sys);
  say(`  kayış birim kütlesi m′ = ${mp.toFixed(4)} kg/m (6PK, 0.0196 kg/m/kaburga)`);
  say('  devir    v [m/s]   m′v² [N]   T_tasarım   oran      SF(kranK) modelde  SF merkezkaçlı');
  const rows = [];
  [800, 1500, 2200, 3000, 4000, 5000].forEach(rpm => {
    const tn = C.spanTensions(R.sys, { engineRpm: rpm, loadsKw: LOADS });
    const Tc = mp * tn.vMs * tn.vMs;
    const g = R.st.geom, c = R.sys._crkIdx, n = R.sys._n;
    const Tin = tn.spanN[(c - 1 + n) % n], Tout = tn.spanN[c];
    const hi2 = Math.max(Tin, Tout), lo2 = Math.min(Tin, Tout);
    const cap = Math.exp(0.90 * g.wraps[c]);
    const sf0 = cap / (hi2 / lo2);
    const sfC = cap / ((hi2 - Tc) / Math.max(lo2 - Tc, 1e-9));
    rows.push({ rpm, v: tn.vMs, Tc, sf0, sfC });
    say(`  ${String(rpm).padStart(5)}   ${tn.vMs.toFixed(2).padStart(6)}   ${Tc.toFixed(1).padStart(7)}    ${R.sys.designTensionN.toFixed(0).padStart(6)} N   ${(Tc / R.sys.designTensionN * 100).toFixed(1).padStart(5)}%   ${sf0.toFixed(3).padStart(7)}        ${sfC.toFixed(3)}`);
  });
  OUT.C4 = { mp, rows };
  say('  → m′v² zincire girmiyor; 5000 d/d\'de tasarım gerginliğinin %' +
    (rows[5].Tc / R.sys.designTensionN * 100).toFixed(0) + "'i kadar bir terim ihmal ediliyor.");
  say('  → span frekansı v\'yi HESABA KATIYOR ((c²−v²)/2Lc), gerginlik zinciri KATMIYOR: iki katman ayrışık.');
}

/* ═════ C5 — BURULMA: SIFIRA YAKIN ÖZDEĞER 1. ELASTİK MODU MASKELİYOR ═══ */
say('\n═════ C5 — BURULMA MODELİ: RİJİT CİSİM MODU SAYISI ═════');
{
  const rr = L.rng(20260921);
  let n = 0, kotu = [];
  for (let i = 0; i < 600; i++) {
    const S = L.genSystem(rr); if (!S) continue;
    let tor; try { tor = C.torsionalModel(S.sys, { relDeg: C.meanRel(S.sys) }); } catch (e) { continue; }
    if (tor.error) continue;
    n++;
    if (tor.rigidBodyModes !== 1)
      kotu.push({ i, rb: tor.rigidBodyModes, f: tor.modes.map(m => m.fHz).slice(0, 4).map(x => +x.toFixed(6)),
        first: tor.firstElasticHz, n: S.sys._n });
  }
  say(`  ${n} sistem · rijit cisim modu ≠ 1 olan: ${kotu.length} (%${(kotu.length / n * 100).toFixed(1)})`);
  kotu.slice(0, 5).forEach(k => say(`    #${k.i} n=${k.n} rb=${k.rb} ilk frekanslar=${JSON.stringify(k.f)} → firstElasticHz=${k.first && k.first.toFixed(3)}`));
  /* rijit cisim modunun SAYISAL frekansı: eşik 1e-6 Hz nereye düşüyor? */
  const rr2 = L.rng(20260921); const f0 = [];
  for (let i = 0; i < 600; i++) {
    const S = L.genSystem(rr2); if (!S) continue;
    let tor; try { tor = C.torsionalModel(S.sys, { relDeg: C.meanRel(S.sys) }); } catch (e) { continue; }
    if (!tor.error) f0.push(tor.modes[0].fHz);
  }
  f0.sort((a, b) => a - b);
  say(`  rijit cisim modunun sayısal frekansı (0 olmalı): ortanca ${f0[Math.floor(f0.length/2)].toExponential(2)} Hz · en büyük ${f0[f0.length-1].toExponential(2)} Hz`);
  say(`  çekirdeğin eşiği SABİT 1e-6 Hz → eşiği aşan ${f0.filter(x => x > 1e-6).length} sistemde firstElasticHz ≈ 0 Hz basılıyor`);
  OUT.C5 = { n, kotu: kotu.length, ornek: kotu.slice(0, 8),
    f0ortanca: f0[Math.floor(f0.length/2)], f0max: f0[f0.length-1], asan: f0.filter(x => x > 1e-6).length };
}

/* ═════ C6 — analyze({mu}) SESSİZCE YOK SAYILIYOR MU? ═════ */
say('\n═════ C6 — analyze() SEÇENEK GEÇİRME ═════');
{
  const R = refSys();
  const a1 = C.analyze(R.sys, { duty: [{ engineRpm: 1800, dcPct: 100, loadsKw: LOADS }], mu: 0.30 });
  const a2 = C.analyze(R.sys, { duty: [{ engineRpm: 1800, dcPct: 100, loadsKw: LOADS }] });
  const a3 = C.analyze(R.sys, { duty: [{ engineRpm: 1800, dcPct: 100, loadsKw: LOADS }], mu: { muGrooved: 0.30 } });
  const s1 = a1.duty[0].slip[0].capstanCapacity, s2 = a2.duty[0].slip[0].capstanCapacity,
    s3 = a3.duty[0].slip[0].capstanCapacity;
  say(`  mu:0.30 sayı  → kapasite ${s1.toFixed(3)}`);
  say(`  mu verilmemiş → kapasite ${s2.toFixed(3)}`);
  say(`  mu:{muGrooved:0.30} → kapasite ${s3.toFixed(3)}`);
  say(`  → sayı olarak verilen mu ${Math.abs(s1 - s2) < 1e-12 ? 'SESSİZCE YOK SAYILDI ✗' : 'etkili ✓'}`);
  OUT.C6 = { sayi: s1, yok: s2, nesne: s3, sessiz: Math.abs(s1 - s2) < 1e-12 };
}

/* ═════ C7 — AYNI ADLI İKİ KASNAK ═════ */
say('\n═════ C7 — KASNAK ADI ÇAKIŞMASI ═════');
{
  const cfg = JSON.parse(JSON.stringify(refSys().cfg));
  cfg.pulleys[2].name = 'FAN';                    /* AC → FAN (çakışma) */
  const sys = C.makeSystem(cfg);
  const st = C.tensionerState(sys, 18);
  sys.belt.effLength = st.driveLenMm; sys.designTensionN = st.tensionN;
  const tn = C.spanTensions(sys, { engineRpm: 1800, loadsKw: { FAN: 4.2, AC: 3.6, ALT: 2.8 } });
  const tot = tn.perPulley.reduce((a, p, i) => a + (i === sys._crkIdx ? 0 : p.powerKw), 0);
  say(`  yükler: FAN 4.2 · AC 3.6 · ALT 2.8 kW → toplam beklenen 10.6 kW`);
  say(`  modelin topladığı: ${tot.toFixed(2)} kW · krank ${tn.perPulley[sys._crkIdx].powerKw.toFixed(2)} kW`);
  say(`  → ${Math.abs(tot - 10.6) > 0.01 ? 'YÜK KAYBI/ÇİFT SAYIM, uyarı YOK ✗' : 'sorun yok'}`);
  OUT.C7 = { tot, beklenen: 10.6 };
}

/* ═════ C8 — YORULMA: BELGE ↔ KOD, VE SEÇENEK GEÇİRME ═════ */
say('\n═════ C8 — YORULMA / ÖMÜR MODELİ ═════');
{
  const R = refSys();
  const duty = [{ engineRpm: 900, dcPct: 40, loadsKw: LOADS }, { engineRpm: 1800, dcPct: 45, loadsKw: LOADS },
    { engineRpm: 2400, dcPct: 15, loadsKw: LOADS }];
  const d1 = C.ribFatigueDistribution(R.sys, { duty });
  const toplam = d1.perPulley.reduce((a, p) => a + p.sharePct, 0);
  say(`  payların toplamı: ${toplam.toFixed(6)} % (100 olmalı)`);
  say(`  ribFatigueDistribution().note = ${JSON.stringify(d1.note)}  ${d1.note === undefined ? '← FATIGUE.distributionNote YOK ✗' : ''}`);
  const b1 = C.beltLifeB10(R.sys, { duty, degC: 90 });
  const b2 = C.beltLifeB10(R.sys, { duty, degC: 90, fatigueModel: 'PK-2_2a-MT3' });
  const b3 = C.beltLifeB10(R.sys, { duty, degC: 90, m: 4.05, wBackside: 1.10 });
  say(`  B10: varsayılan ${b1.hoursB10.toFixed(0)} h · fatigueModel:'PK-2_2a' ${b2.hoursB10.toFixed(0)} h · elle m/w ${b3.hoursB10.toFixed(0)} h`);
  say(`  → fatigueModel ${Math.abs(b1.hoursB10 - b2.hoursB10) < 1e-9 ? 'YOK SAYILIYOR ✗ (ribFatigueDistribution onu okuyor)' : 'etkili'}`);
  const b90 = C.beltLifeB10(R.sys, { duty, degC: 90 }).hoursB10;
  const b113 = C.beltLifeB10(R.sys, { duty, degC: 113 }).hoursB10;
  say(`  sıcaklık: 90°C ${b90.toFixed(0)} h → 113°C ${b113.toFixed(0)} h · oran ${(b90 / b113).toFixed(4)} (2 olmalı)`);
  /* belgelenen formül ile uygulanan formül aynı mı? */
  say(`  başlık yorumu D = Σdc·(v/L)·Σ w_i·(T_ort,i + Kb/d_eff,i)^m diyor;`);
  say(`  kod ise       D = [Σ w_i·d_i^−m]·[Σ dc·v/L]·(T_tas/kaburga)^0.96·2^((T−80)/23)`);
  say(`  → gerginlik kasnak BAŞINA değil KÜRESEL ve üssü 0.96, kasnak toplamı gerginlikten BAĞIMSIZ.`);
  OUT.C8 = { toplam, note: d1.note === undefined, modelYokSayildi: Math.abs(b1.hoursB10 - b2.hoursB10) < 1e-9,
    sicaklikOran: b90 / b113, b1: b1.hoursB10, b3: b3.hoursB10 };
}

/* ═════ C9 — KAYMA MI, GEVŞEME Mİ ÖNCE? (fiziksel sıralama) ═════ */
say('\n═════ C9 — YÜK ARTTIKÇA HANGİ SINIR ÖNCE GELİR ═════');
{
  const R = refSys();
  say('  yük[kW]  T_min[N]  T_max[N]  SF_krank  SF_min   ilk ihlal');
  const rows = [];
  for (const k of [5, 10, 15, 20, 25, 30, 40, 50]) {
    const f = k / 10.6;
    const ld = { FAN: 4.2 * f, AC: 3.6 * f, ALT: 2.8 * f };
    const tn = C.spanTensions(R.sys, { engineRpm: 1800, loadsKw: ld });
    const sl = C.slipSafety(R.st.geom, tn.spanN);
    const sfmin = Math.min.apply(null, sl.map(x => x.SF));
    const sfc = sl[R.sys._crkIdx].SF;
    const tmin = Math.min.apply(null, tn.spanN), tmax = Math.max.apply(null, tn.spanN);
    const ihlal = tmin < 0 ? 'T<0 (gevşeme)' : (sfmin < 1 ? 'SF<1 (kayma)' : '—');
    rows.push({ k, tmin, tmax, sfc, sfmin, ihlal, uyari: tn.warnings.length });
    say(`  ${String(k).padStart(6)}  ${tmin.toFixed(0).padStart(8)}  ${tmax.toFixed(0).padStart(8)}  ${sfc.toFixed(3).padStart(8)}  ${sfmin.toFixed(3).padStart(6)}   ${ihlal}`);
  }
  OUT.C9 = rows;
  say('  → fiziksel beklenti: KAYMA gevşemeden ÖNCE gelmeli (kayış negatif gerginlik taşıyamaz).');
}

