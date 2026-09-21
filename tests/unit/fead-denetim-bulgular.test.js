/**
 * fead-denetim-bulgular.test.js — BAĞIMSIZ DENETİMİN AÇTIĞI KAPILAR
 *
 * Bu dosyadaki sınamaların ortak özelliği: hiçbiri Gates verisine BAKMIYOR.
 * Ölçüt ya kapalı biçimli bir sonuç ya da bir değişmezlik. Sebebi, hepsinin
 * 2.095 değerlik kalibrasyon kapısının KÖR NOKTASINDAN çıkmış olması —
 * arşivdeki örneklerin tamamı `driveRatio = 1` yazılı, tedarikçi açıklık
 * frekansını sayı olarak hiç basmıyor, ve rijit cisim modu her sistemde
 * sıfırın aynı tarafına düşmüyor.
 *
 * Aracı: `npm run fead:denetim` (tools/fead-denetim).
 */
const F = require('../../js/fead-core.js');
const M = require('../../js/fead-model.js');

global.FEADCore = F;
Object.keys(M).forEach((k) => { global[k] = M[k]; });
const TR = require('../../js/fead-transient.js');

const DEG = Math.PI / 180;

// Elle kurgulanmış 6 kasnaklı serpantin — Gates'ten DEĞİL. Gergi kolu hubload
// bileşkesine dik konuyor (take-up en büyük) ve kayış boyu 18°'deki çözüme
// eşitleniyor, yani çalışma noktası kurgu gereği biliniyor.
function kurSys(o) {
  o = o || {};
  const belt = { profile: 'PK', brand: 'GATES', ribs: 6, massPerRibKgM: 0.0196 };
  const TC = [430, 270];
  const P = [
    { name: 'KRANK', od: 180, contact: 'grooved', x: 0, y: 0, crank: true, inertiaKgM2: 0.060 },
    { name: 'FAN', od: 150, contact: 'grooved', x: 30, y: 300, inertiaKgM2: 0.011 },
    { name: 'AC', od: 120, contact: 'grooved', x: 300, y: 330, inertiaKgM2: 0.0042 },
    { name: 'GERGI', od: 76, contact: 'grooved', x: TC[0], y: TC[1], inertiaKgM2: 0.0009 },
    { name: 'ALT', od: 62, contact: 'grooved', x: 420, y: 60, inertiaKgM2: 0.0021 },
    { name: 'AVARA', od: 70, contact: 'back', x: 213, y: 8, inertiaKgM2: 0.0007 },
  ];
  const bp = F.beltProps(belt);
  const g0 = F.solveGeometry(P.map((p) => Object.assign(
    { name: p.name, contact: p.contact, c: [p.x, p.y] }, F.radiiFromOD(p.od, p.contact, bp))));
  const uIn = g0.spans[2].u, uOut = g0.spans[3].u;
  const hubDir = Math.atan2(uOut[1] - uIn[1], uOut[0] - uIn[0]);
  const armLength = 70, pAng = hubDir - Math.PI / 2;
  const pivot = [TC[0] + armLength * Math.cos(pAng), TC[1] + armLength * Math.sin(pAng)];
  const pl = JSON.parse(JSON.stringify(P));
  pl[3].tensioner = true; delete pl[3].x; delete pl[3].y;
  const sys = F.makeSystem({
    pulleys: pl, belt,
    driveRatio: o.driveRatio != null ? o.driveRatio : 1,
    tensioner: {
      pivot, armLength, preloadNm: 34, rateNmPerDeg: 0.22,
      freeAngleDeg: Math.atan2(TC[1] - pivot[1], TC[0] - pivot[0]) / DEG,
      armInertiaKgM2: 0.0009, pulleyMassKg: 0.5,
    },
  });
  const st = F.tensionerState(sys, 18);
  sys.belt.effLength = st.driveLenMm;
  sys.designTensionN = st.tensionN;
  return { sys, st };
}
const kurBuild = (o) => {
  const { sys, st } = kurSys(o);
  return {
    ok: true, sys, st,
    names: sys.pulleys.map((p) => p.name),
    order: sys.pulleys.map((p) => ({ data: { inertia: p.inertiaKgM2 } })),
    solver: { data: { cylinders: 6 } },
  };
};
const LOADS = { FAN: 4.2, AC: 3.6, ALT: 2.8 };

// ═══════════════════════════════════════════════════════════════════════════
// BULGU 1 — TAHRİK ORANI ÇARPANI İKİ KEZ BİNİYOR
//
// `peakEstimate` açısal ivmeyi `ivme·driveRatio·2π/60` ile kurup atalet
// terimini `speedRatio` ile çarpıyor; `speedRatio` ise tanımı gereği
// `driveRatio`yu zaten içeriyor. Kalibrasyon takımı bunu göremez çünkü Gates
// örneklerinin tamamında çarpan 1.
//
// Sınama REFERANSSIZ: aynı makinenin iki yazımı. A'da motor 1800 d/d ve oran
// 1, B'de motor 900 d/d ve oran 2 — krank kasnağı ikisinde de 1800 d/d, ivmesi
// de aynı. Fiziksel olarak TEK makine, dolayısıyla bütün gerginlikler birebir
// aynı olmak zorunda.
// ═══════════════════════════════════════════════════════════════════════════
describe('bulgu 1 — tepe zinciri tahrik oranından bağımsız', () => {
  const IVME = 1100;
  const A = kurBuild({ driveRatio: 1 });
  const B = kurBuild({ driveRatio: 2 });

  test('iki yazım aynı kayış hızını ve aynı aksesuar devrini veriyor', () => {
    expect(F.beltSpeed(A.sys, 1800)).toBeCloseTo(F.beltSpeed(B.sys, 900), 12);
    A.sys.pulleys.forEach((p, i) => {
      expect(F.accessoryRpm(A.sys, i, 1800)).toBeCloseTo(F.accessoryRpm(B.sys, i, 900), 9);
    });
  });

  test('KÖPRÜNÜN ataletleriyle tepe gerginlikleri BİREBİR aynı', () => {
    const pa = F.peakEstimate(A.sys, { engineRpm: 1800, accelRpmS: IVME,
      loadsKw: LOADS, inertias: veFeadPeakInertias(A) });
    const pb = F.peakEstimate(B.sys, { engineRpm: 900, accelRpmS: IVME / 2,
      loadsKw: LOADS, inertias: veFeadPeakInertias(B) });
    ['accel', 'decel'].forEach((dal) => {
      pa[dal].spanN.forEach((T, i) => expect(T).toBeCloseTo(pb[dal].spanN[i], 9));
    });
  });

  test('düzeltmesiz hâl AYRIŞIYOR — kapının neyi tuttuğu ölçülü', () => {
    const pa = F.peakEstimate(A.sys, { engineRpm: 1800, accelRpmS: IVME, loadsKw: LOADS });
    const pb = F.peakEstimate(B.sys, { engineRpm: 900, accelRpmS: IVME / 2, loadsKw: LOADS });
    let enKotu = 0;
    pa.accel.spanN.forEach((T, i) =>
      { enKotu = Math.max(enKotu, Math.abs(T - pb.accel.spanN[i]) / Math.abs(T)); });
    expect(enKotu).toBeGreaterThan(0.03);          // ölçülen %5,25
  });

  test('sözlük BÜTÜN kasnakları taşır ve 1/driveRatio ile ölçeklenir', () => {
    const oa = veFeadPeakInertias(A), ob = veFeadPeakInertias(B);
    expect(Object.keys(oa).sort()).toEqual(A.names.slice().sort());
    A.names.forEach((ad) => expect(ob[ad]).toBeCloseTo(oa[ad] / 2, 12));
  });

  test('çevrim her iki yazımda da KAPANIYOR (gergi girişte = çıkışta)', () => {
    [[A, 1800, IVME], [B, 900, IVME / 2]].forEach(([b, rpm, al]) => {
      const p = F.peakEstimate(b.sys, { engineRpm: rpm, accelRpmS: al,
        loadsKw: LOADS, inertias: veFeadPeakInertias(b) });
      const n = b.sys._n, t = b.sys._tenIdx;
      ['accel', 'decel'].forEach((dal) => {
        const artik = p[dal].spanN[(t - 1 + n) % n] - p[dal].spanN[t];
        expect(Math.abs(artik)).toBeLessThan(1e-9);
      });
    });
  });

  test('ham ataletlerde çevrim AÇIK — düzeltmenin kapattığı şey', () => {
    const p = F.peakEstimate(A.sys, { engineRpm: 1800, accelRpmS: IVME, loadsKw: LOADS });
    const n = A.sys._n, t = A.sys._tenIdx;
    const artik = Math.abs(p.accel.spanN[(t - 1 + n) % n] - p.accel.spanN[t]);
    expect(artik).toBeGreaterThan(1);              // ölçülen 17,2 N
  });

  // Geçici rejim yolu aynı sözlüğü kullanmalı. Ayrı tutulduğu sürece
  // senaryonun gerginlik–ivme eğimi özet tablosundan BAŞKA bir sayı anlatır
  // ve fark hiçbir yerde görünmez.
  test('geçici rejim ile özet AYNI atalet sözlüğünü okuyor', () => {
    const b = kurBuild();
    expect(TR.veFeadScnInertias(b)).toEqual(veFeadPeakInertias(b));
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// BULGU 2 — AÇIKLIK FREKANSI GERÇEK GERGİNLİĞİ İSTER
//
// Kasnak yüzey kuvveti hareketli kayışta N = T − m′v². Çekirdeğin zinciri bu
// yüzden ETKİN gerginlik taşıyor; hubload, kapstan oranı ve güç akışı onunla
// tutarlı. Hareketli tel formülü ise GERÇEĞİNİ ister: T_gerçek = T + m′v².
// Gates arşivi bu sözleşmeyi çözmüyor (11 raporda açıklık frekansı SAYI
// olarak yok), dolayısıyla kapı türetmeyi tutuyor.
// ═══════════════════════════════════════════════════════════════════════════
describe('bulgu 2 — açıklık frekansı merkezkaç payını taşıyor', () => {
  const B = kurBuild();
  const RPM = 3000;
  const tn = () => F.spanTensions(B.sys, { engineRpm: RPM, loadsKw: LOADS });

  test('satırlar ÇEKİRDEĞİN formülünden, T + m′v² ile', () => {
    const t = tn();
    const mp = F.massPerM(B.sys), v = F.beltSpeed(B.sys, RPM);
    const ref = F.spanFrequencies(B.sys, B.st.geom,
      t.spanN.map((T) => T + mp * v * v), { engineRpm: RPM, modes: 2 });
    const rows = veFeadSpanFreqRows(B.sys, B.st.geom, t.spanN, { engineRpm: RPM, modes: 2 });
    rows.forEach((r, i) => {
      expect(r.fHz[0]).toBeCloseTo(ref[i].fHz[0], 12);
      expect(r.fHz[1]).toBeCloseTo(ref[i].fHz[1], 12);
    });
  });

  test('GERGİNLİK SÜTUNU zincirin sayısı kalır, merkezkaç AYRI taşınır', () => {
    const t = tn();
    const mp = F.massPerM(B.sys), v = F.beltSpeed(B.sys, RPM);
    const rows = veFeadSpanFreqRows(B.sys, B.st.geom, t.spanN, { engineRpm: RPM });
    rows.forEach((r, i) => {
      expect(r.TN).toBeCloseTo(t.spanN[i], 12);
      expect(r.TcN).toBeCloseTo(mp * v * v, 9);
    });
  });

  test('düzeltme frekansı YÜKSELTİR ve yön her açıklıkta aynı', () => {
    const t = tn();
    const ham = F.spanFrequencies(B.sys, B.st.geom, t.spanN, { engineRpm: RPM });
    const yeni = veFeadSpanFreqRows(B.sys, B.st.geom, t.spanN, { engineRpm: RPM });
    yeni.forEach((r, i) => expect(r.fHz[0]).toBeGreaterThan(ham[i].fHz[0]));
  });

  test('GEVŞEK açıklığa merkezkaç EKLENMEZ (uyarı gizlenmesin)', () => {
    const t = tn();
    const gevsek = t.spanN.slice();
    gevsek[0] = -5;
    const rows = veFeadSpanFreqRows(B.sys, B.st.geom, gevsek, { engineRpm: RPM });
    expect(rows[0].TcN).toBe(0);
    expect(rows[0].fHz[0]).toBe(0);
    expect(rows[0].flutter).toBe(true);
  });

  test('YAPAY çırpınma kalkıyor: T > 0 iken c ≤ v olamaz', () => {
    // Gerginliği kasten düşürüp ham formülün çırpınma dediği bir hâl kur.
    const t = tn();
    const mp = F.massPerM(B.sys), v = F.beltSpeed(B.sys, RPM);
    const dusuk = t.spanN.map(() => 0.5 * mp * v * v);      // c_etkin < v
    const ham = F.spanFrequencies(B.sys, B.st.geom, dusuk, { engineRpm: RPM });
    const yeni = veFeadSpanFreqRows(B.sys, B.st.geom, dusuk, { engineRpm: RPM });
    expect(ham.some((s) => s.flutter)).toBe(true);
    expect(yeni.some((s) => s.flutter)).toBe(false);
  });

  test('devir verilmezse davranış BİREBİR eski hâli (merkezkaç yok)', () => {
    const t = tn();
    const ham = F.spanFrequencies(B.sys, B.st.geom, t.spanN, {});
    const yeni = veFeadSpanFreqRows(B.sys, B.st.geom, t.spanN, {});
    yeni.forEach((r, i) => {
      expect(r.TcN).toBe(0);
      expect(r.fHz[0]).toBeCloseTo(ham[i].fHz[0], 12);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// BULGU 3 — RİJİT CİSİM MODU SABİT EŞİKLE AYIKLANAMAZ
//
// Rijit modun frekansı analitik olarak tam sıfır; Jacobi artığı matris
// normuyla büyüyor ve çekirdeğin sabit 1e-6 Hz eşiğini aşabiliyor. Aştığı
// anda `firstElasticHz` ~0 Hz dönüyor. ÖLÇÜLDÜ: 1942 rastgele sistemin
// 23'ünde (%1,2).
// ═══════════════════════════════════════════════════════════════════════════
describe('bulgu 3 — burulma modu sınıflandırması göreli eşikle', () => {
  const sahte = (fler) => ({ modes: fler.map((f) => ({ fHz: f, shape: [] })) });

  test('eşiği aşan sayısal rijit mod ELASTİK sayılmıyor', () => {
    const T = veFeadTorsionalNorm(sahte([1.26e-6, 35.99, 78.24, 110.0]));
    expect(T.rigidBodyModes).toBe(1);
    expect(T.firstElasticHz).toBeCloseTo(35.99, 6);
    expect(T.elasticHz).toHaveLength(3);
  });

  test('GERÇEKTEN düşük bir elastik mod elenmiyor', () => {
    const T = veFeadTorsionalNorm(sahte([0, 4.6, 60, 100]));
    expect(T.rigidBodyModes).toBe(1);
    expect(T.firstElasticHz).toBeCloseTo(4.6, 9);
  });

  test('eşik ÖLÇEKLE büyüyor (mutlak bir sayı değil)', () => {
    const T = veFeadTorsionalNorm(sahte([1.26e-6, 35.99, 110.0]));
    expect(T.modeFloorHz).toBeCloseTo(110.0 * VE_FEAD_TORS_REL_FLOOR, 12);
    // Aynı şekil 1000 kat büyütülünce eşik de 1000 kat büyür.
    const T2 = veFeadTorsionalNorm(sahte([1.26e-3, 35990, 110000]));
    expect(T2.rigidBodyModes).toBe(1);
  });

  test('İKİNCİ bir sıfır özdeğer SAYILIYOR, sessizce elastik yapılmıyor', () => {
    const T = veFeadTorsionalNorm(sahte([0, 0, 40, 90]));
    expect(T.rigidBodyModes).toBe(2);
    expect(T.firstElasticHz).toBeCloseTo(40, 9);
  });

  test('gerçek modelde tek rijit mod ve özvektörü θ ∝ 1/R', () => {
    const B = kurBuild();
    const T = veFeadTorsionalNorm(F.torsionalModel(B.sys, { relDeg: 18 }));
    expect(T.rigidBodyModes).toBe(1);
    expect(T.firstElasticHz).toBeGreaterThan(1);
    const rb = T.modes[0].shape, taban = rb[0].amp * B.sys.pulleys[0].rPitch;
    B.sys.pulleys.forEach((p, i) =>
      expect(rb[i].amp * p.rPitch).toBeCloseTo(taban, 6));
  });

  test('hatalı/boş sonuç olduğu gibi geri dönüyor', () => {
    expect(veFeadTorsionalNorm(null)).toBe(null);
    const e = { error: 'x' };
    expect(veFeadTorsionalNorm(e)).toBe(e);
  });

  // Fonksiyonun doğru olması yetmez, ÇAĞRILIYOR olması gerekir. Köprünün
  // sonucu normalleştirmeyi bırakması, bu dosyadaki öteki sınamaların hiçbirini
  // kırmazdı — panel yine sıfır Hz basardı ve kimse görmezdi.
  // ÜÇ ÇAĞRI YERİ VAR ve üçü de normalleştirmeden geçmek ZORUNDA. Bu kapı
  // yazılırken ikisi (mod listesi ve mod animasyonu) atlanmıştı: ikisi de
  // sabit 1e-6 eşiğiyle süzüyordu, yani kullanıcının mod listesinin başına
  // rijit cisim modu düşebiliyor ve "1. mod" animasyonu bir titreşim modu
  // değil sistemin birlikte dönüşü oluyordu.
  test('burulma modelinin ÜÇ çağrı yeri de normalleştiriliyor', () => {
    const src = require('fs').readFileSync(
      require('path').join(__dirname, '../../js/fead-model.js'), 'utf8');
    const cagri = (src.match(/FEADCore\.torsionalModel\(/g) || []).length;
    const sarili = (src.match(/veFeadTorsionalNorm\(\s*\n?\s*FEADCore\.torsionalModel\(/g)
                    || []).length;
    expect(cagri).toBe(3);
    expect(sarili).toBe(cagri);
    // Ve sabit eşik köprüde hiç kalmadı (yorum satırı hariç).
    const kod = src.split('\n').filter((L) => !/^\s*(\/\/|\*)/.test(L)).join('\n');
    expect(/fHz\s*>\s*1e-6/.test(kod)).toBe(false);
  });

  test('mod listesi ve mod animasyonu rijit modu ELEMİŞ olarak alıyor', () => {
    const B = kurBuild();
    const ham = F.torsionalModel(B.sys, { relDeg: 18 });
    const liste = veFeadVibModeList(B, {});
    expect(liste).not.toBeNull();
    expect(liste.length).toBe(ham.modes.length - 1);
    expect(liste[0]).toBeGreaterThan(1);
    const P = veFeadVibModePayload(B, 0, 6, {}, 18);
    expect(P).not.toBeNull();
    expect(P.modeCount).toBe(liste.length);
    expect(P.fHz).toBeCloseTo(liste[0], 9);        // "1. mod" = 1. ELASTİK mod
    expect(P.fHz).toBeGreaterThan(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// BULGU 4·5·6 — ÇEKİRDEKTE TUZAK, KÖPRÜDE KAPI
//
// Üçü de çekirdeğin API'sinde duruyor ama programda zaten kapatılmış. Kapı
// yoksa "kapatılmış olmak" bir sonraki düzenlemede sessizce kaybolur; bu
// testlerin işi tam olarak o.
// ═══════════════════════════════════════════════════════════════════════════
describe('bulgu 4·5·6 — mevcut korumalar yerinde duruyor', () => {
  // BULGU 6a — `analyze(sys,{mu:0.30})` sayıyı SESSİZCE yutuyor: çekirdek
  // `opt.muGrooved` arıyor. MFSim `mu` geçmiyor; geçecekse nesne biçiminde
  // geçmek ZORUNDA.
  test('sayı olarak geçilen mu çekirdekte etkisiz — nesne biçimi şart', () => {
    const B = kurBuild();
    const duty = [{ engineRpm: 1800, dcPct: 100, loadsKw: LOADS }];
    const sayi = F.analyze(B.sys, { duty, mu: 0.30, torsional: false });
    const yok = F.analyze(B.sys, { duty, torsional: false });
    const nesne = F.analyze(B.sys, { duty, mu: { muGrooved: 0.30 }, torsional: false });
    expect(sayi.duty[0].slip[0].capstanCapacity)
      .toBeCloseTo(yok.duty[0].slip[0].capstanCapacity, 12);
    expect(nesne.duty[0].slip[0].capstanCapacity)
      .toBeLessThan(yok.duty[0].slip[0].capstanCapacity * 0.5);
  });

  test('köprü çekirdeğe ÇIPLAK SAYI olarak mu geçmiyor', () => {
    const src = require('fs').readFileSync(
      require('path').join(__dirname, '../../js/fead-model.js'), 'utf8');
    const cagri = /FEADCore\.analyze\(([\s\S]*?)\n    \}\);/.exec(src);
    expect(cagri).toBeTruthy();
    expect(/\bmu\s*:/.test(cagri[1])).toBe(false);
  });

  // BULGU 6b — aynı adlı iki kasnak `loadsKw` sözlüğünde BİRLEŞİR: biri iki
  // kez sayılır, öteki düşer, uyarı çıkmaz. Köprü adları tekilleştiriyor.
  test('aynı ad çekirdekte yükleri birleştiriyor — köprü tekilleştiriyor', () => {
    const { sys } = kurSys();
    const cfg = JSON.parse(JSON.stringify(sys));
    cfg.pulleys[2].name = 'FAN';                    // AC → FAN
    const s2 = F.makeSystem(cfg);
    const st = F.tensionerState(s2, 18);
    s2.belt.effLength = st.driveLenMm; s2.designTensionN = st.tensionN;
    const t = F.spanTensions(s2, { engineRpm: 1800, loadsKw: LOADS });
    const toplam = t.perPulley.reduce((a, p, i) => a + (i === s2._crkIdx ? 0 : p.powerKw), 0);
    expect(toplam).toBeCloseTo(11.2, 2);            // olması gereken 10,6
    expect(t.warnings).toHaveLength(0);             // ve uyarı YOK
    // Köprünün kapısı:
    const un = veFeadUniqueNames([
      { data: { name: 'Avara' } }, { data: { name: 'Avara' } }, { data: { name: 'Avara' } }]);
    expect(new Set(un.names).size).toBe(3);
  });

  // BULGU 4 — duty kapsamı eksikse ömür DOĞRUDAN büyüyor. Çekirdek sayıyı
  // döndürüyor ama uyarmıyor; rapor hüküm veriyor (bkz. _frDutySum kapısı).
  test('duty kapsamı yarıya inince ömür iki katına çıkıyor', () => {
    const B = kurBuild();
    const tam = [{ engineRpm: 900, dcPct: 40, loadsKw: LOADS },
                 { engineRpm: 1800, dcPct: 45, loadsKw: LOADS },
                 { engineRpm: 2400, dcPct: 15, loadsKw: LOADS }];
    const yarim = tam.map((r) => Object.assign({}, r, { dcPct: r.dcPct / 2 }));
    const b1 = F.beltLifeB10(B.sys, { duty: tam, degC: 90 });
    const b2 = F.beltLifeB10(B.sys, { duty: yarim, degC: 90 });
    expect(b1.dutyCoverage).toBeCloseTo(1, 9);
    expect(b2.dutyCoverage).toBeCloseTo(0.5, 9);
    expect(b2.hoursB10 / b1.hoursB10).toBeCloseTo(2, 2);
  });

  test('raporun kapsam kapısı %100 dışını HÜKÜMLE işaretliyor', () => {
    const src = require('fs').readFileSync(
      require('path').join(__dirname, '../../js/cp-fead-report.js'), 'utf8');
    expect(src).toMatch(/Çalışma çevrimi kapsamı/);
    expect(src).toMatch(/dc >= 95 && dc <= 105/);
  });

  // BULGU 5 — yorulma defterindeki AÇIK AYRIŞMA. Kontrollü kaburga deneyinden
  // gelen üs 1,13; mutlak ömür 0,96 kullanıyor. İkisi aynı fiziksel ölçekleme
  // için ve birbirini tutmuyor. Değiştirmek kalibrasyon sabiti C'yi yeniden
  // uydurmayı gerektirir (C geometri toplamının ölçeğini soğuruyor), o yüzden
  // burada DEĞİŞTİRİLMİYOR — KAYDEDİLİYOR ki sessizce kaymasın.
  test('ömür üssü 0,96; ribTensionExp = 1,13 KULLANILMIYOR (açık ayrışma)', () => {
    const B = kurBuild();
    const duty = [{ engineRpm: 1800, dcPct: 100, loadsKw: LOADS }];
    const b6 = F.beltLifeB10(B.sys, { duty, degC: 90 });
    B.sys.belt.ribs = 12;
    const b12 = F.beltLifeB10(B.sys, { duty, degC: 90 });
    B.sys.belt.ribs = 6;
    // Ömür ∝ (kaburga/T)^üs — kaburga ikiye katlanınca 2^üs kat.
    const us = Math.log2(b12.hoursB10 / b6.hoursB10);
    expect(us).toBeCloseTo(F.FATIGUE.absolute.tensionExp, 6);
    expect(F.FATIGUE.ribTensionExp).toBeCloseTo(1.13, 6);
    expect(Math.abs(us - F.FATIGUE.ribTensionExp)).toBeGreaterThan(0.1);
  });

  test('dağılımın `note` alanı çekirdekte TANIMSIZ (kimse basmıyor)', () => {
    const B = kurBuild();
    const d = F.ribFatigueDistribution(B.sys,
      { duty: [{ engineRpm: 1800, dcPct: 100, loadsKw: LOADS }] });
    expect(d.note).toBeUndefined();
    expect(F.FATIGUE.distributionNote).toBeUndefined();
    // Toplam yine de sağlam — model değil defter eksik.
    expect(d.perPulley.reduce((a, p) => a + p.sharePct, 0)).toBeCloseTo(100, 9);
  });
});
