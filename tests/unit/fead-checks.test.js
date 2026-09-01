/**
 * fead-checks.test.js — BMC HESAP DEFTERİNDEN GELEN ÜÇ KAPI
 *
 * Bu dosyanın kapısı olağandışı biçimde güçlü: üç denetimin de referansı
 * MFSim'in kendi hesabı değil, BMC'nin `KIRPI_II_NEX_GEN.FEAD.xlsx` hesap
 * defterinin KENDİ SAYILARI. Defter aynı sistemi bağımsız olarak çözüyor ve
 * altı merkez mesafesini, iki oran penceresini hücre hücre basıyor.
 *
 * ── ÖLÇÜM: MERKEZ MESAFELERİ 0,000 FARKLA ÖRTÜŞÜYOR ────────────────────────
 * Aşağıdaki `XL_A` dizisi defterin `Kasnak Mesafe Uygunluğu` sayfasının E
 * sütunu, `XL_LO`/`XL_HI` ise G ve I sütunlarıdır. Altısında da fark 1e-6'nın
 * altında. Bu, kapının doğru yarıçapı (pitch, dış çap DEĞİL) kullandığını
 * bağımsız bir kaynağa karşı kanıtlıyor.
 *
 * ── DEFTERİN KENDİ İÇİNDE ÜÇ AYRI ORAN VAR — MFSim'de BİR TANE ─────────────
 * Aynı alternatör için defterde üç sayı duruyor:
 *     2,4492  pitch çaplarından (fizik)
 *     2,5039  "Komponent Secimi" — DIŞ çapla, +%2,2
 *     3,1300  "Kuvvet Hesabi-" F sütunu — ELLE yazılmış, +%27,8
 * Sonuncusu çevresel kuvvete doğrudan giriyor (Fu ∝ 1/n) ve alternatörün
 * kuvvetini %27,8, klimanınkini %11,9 DÜŞÜK gösteriyor. MFSim'de böyle bir
 * sapma yapısal olarak imkânsız: oran her zaman `FEADCore.speedRatio`'dan,
 * yani pitch yarıçaplarından gelir. Aşağıdaki `oran sapması` testi bu üç
 * sayıyı ve etkisini çıpalıyor ki fark bir gün "düzeltilmeye" çalışılmasın.
 *
 * ── MERKEZ MESAFESİ İHLALİ 'warn', 'no' DEĞİL ──────────────────────────────
 * Kural iki kasnaklı V-kayış tahrikleri için yazılmış; serpantinde uzaktaki
 * bir aksesuar üst sınırı doğal olarak zorlar. Defterin KENDİ tasarımında
 * alternatör–avara çifti üst sınıra %1,8 (5,08 mm) kala duruyor ve tasarım
 * gerçekte sorunsuz. Seviye testi bunu kilitliyor.
 */
const FEADCore = require('../../js/fead-core.js');
const A = require('../../js/fead-accessories.js');
const E = require('../../js/fead-engines.js');

// fead-checks.js çekirdeği ve aksesuar sınırlarını GLOBAL olarak arıyor
// (tarayıcıda hepsi tek kapsamda). Testte de öyle sunuluyor.
global.FEADCore = FEADCore;
global.veFeadAccLimits = A.veFeadAccLimits;
const K = require('../../js/fead-checks.js');

// ─── DEFTERİN KENDİ SİSTEMİ ────────────────────────────────────────────────
// Kasnak tablosu `Geometrik Entegrasyon` A5:H10; gergi künyesi C20:D24.
// Montaj açısı 168° defterde KASNAK MERKEZİNDEN pivota bakan açıdır; çekirdek
// kolun mutlak açısını (pivottan kasnağa) ister, yani 180° farkla.
const PIVOT = [-162 + 90 * Math.cos((168 * Math.PI) / 180),
                 91 + 90 * Math.sin((168 * Math.PI) / 180)];
const ARM_ABS = (Math.atan2(91 - PIVOT[1], -162 - PIVOT[0]) * 180) / Math.PI;

const MOTOR = E.veFeadEngineOf('57RS303234');   // ISL8.9E3 375 — defterin motoru

function kirpiBuild(opt) {
  opt = opt || {};
  const order = [
    { id: 'SRC', name: 'Tahrik Kasnağı', data: {} },
    { id: 'ID1', name: 'Avara 1', data: {} },
    { id: 'A_C', name: 'Klima Komp.', data: Object.assign({ accLib: '57RS322530' }, opt.ac) },
    { id: 'ID2', name: 'Avara 2', data: {} },
    { id: 'ALT', name: 'Alternatör', data: Object.assign({ accLib: '57RS309348' }, opt.alt) },
    { id: 'TEN', name: 'Gergi Kasnağı', data: {} },
  ];
  const sys = FEADCore.makeSystem({
    belt: { profile: 'PK', brand: 'GATES', ribs: 8, effLength: 1720.434 },
    pulleys: [
      { name: 'Tahrik Kasnağı', od: 159, x: 0, y: 0, contact: 'grooved', crank: true },
      { name: 'Avara 1', od: opt.id1OD != null ? opt.id1OD : 75, x: 130, y: 138, contact: 'back' },
      { name: 'Klima Komp.', od: 152, x: 184, y: 315, contact: 'grooved' },
      { name: 'Avara 2', od: 75, x: 0, y: 267.4, contact: 'back' },
      { name: 'Alternatör', od: 63.5, x: opt.altX != null ? opt.altX : -281,
        y: opt.altY != null ? opt.altY : 259.3, contact: 'grooved' },
      { name: 'Gergi Kasnağı', od: 75, contact: 'back', tensioner: true },
    ],
    driveRatio: MOTOR.crankOD / MOTOR.fanDriveOD,
    tensioner: { pivot: PIVOT, armLength: 90, preloadNm: 8.6,
                 rateNmPerDeg: 0.477, freeAngleDeg: ARM_ABS },
  });
  return { ok: true, sys, ratioSys: sys, order };
}

// Motor devirleri: defterin kendi motorundan.
const OPT = {
  governedRpm: MOTOR.governedRpm,      // 2100
  overspeedRpm: MOTOR.overspeedRpm,    // 2900
  maxDutyRpm: 2100,
};

// ─────────────────────────────────────────── 1) KASNAK MERKEZ MESAFESİ ──
describe('Kapı 1 — kasnak merkez mesafesi', () => {
  // Defterin kendi sayıları. Sıra: (0,1) çiftinden başlıyor, defterin
  // "2 ile 1 · 3 ile 2 · 4 ile 3 · 5 ile 4 · 6 ile 5 · Son ile 1" sırası.
  const XL_A  = [189.589029, 185.054046, 190.057255, 281.11672, 206.121057, 185.809042];
  const XL_LO = [167.02, 162.12, 162.12, 100.17, 100.17, 167.02];   // defter G sütunu
  const XL_HI = [477.20, 463.20, 463.20, 286.20, 286.20, 477.20];   // defter I sütunu

  test('altı çiftin merkez mesafesi defterle 1e-6 içinde örtüşüyor', () => {
    const c = K.veFeadCheckCenterDistance(kirpiBuild(), { relDeg: 0 });
    expect(c.rows.length).toBe(6);
    c.rows.forEach((r, i) => expect(r.a).toBeCloseTo(XL_A[i], 6));
  });

  test('alt ve üst sınırlar defterle örtüşüyor (pitch çapı kullanılıyor)', () => {
    const c = K.veFeadCheckCenterDistance(kirpiBuild(), { relDeg: 0 });
    c.rows.forEach((r, i) => {
      expect(r.lo).toBeCloseTo(XL_LO[i], 2);
      expect(r.hi).toBeCloseTo(XL_HI[i], 2);
      // Kural katsayıları tek kaynaktan
      expect(r.lo).toBeCloseTo(K.VE_FEAD_CENTER_RULE.lo * r.dSum, 9);
      expect(r.hi).toBeCloseTo(K.VE_FEAD_CENTER_RULE.hi * r.dSum, 9);
    });
  });

  // DIŞ ÇAPLA HESAPLASAYDI kapı sessizce kayardı: PK'da kasnak başına 2,4 mm.
  //
  // BU KAPININ TOPLAMA BAKMASI YETMEZ ve sebebi ölçüldü: KIRPI II'de kaburgalı
  // ve sırt kasnaklar SIRAYLA geliyor, dolayısıyla her çiftte h_b ve h_r
  // toplamda birbirini götürüyor (161,4+77,2 = 159+79,6 = 238,6). Yanlış
  // yarıçapla kurulmuş bir kapı bu düzende alt/üst sınırı DEĞİŞTİRMEDEN geçer.
  // Bu yüzden çaplar tek tek çıpalı.
  test('çap = 2·rPitch, dış çap DEĞİL — altı çiftin on iki çapı', () => {
    const c = K.veFeadCheckCenterDistance(kirpiBuild(), { relDeg: 0 });
    const bek = [161.4, 77.2, 154.4, 77.2, 65.9, 77.2];   // defterin F5:F10 sütunu
    c.rows.forEach((r, i) => {
      expect(r.dI).toBeCloseTo(bek[i], 9);
      expect(r.dJ).toBeCloseTo(bek[(i + 1) % 6], 9);
      expect(r.dSum).toBeCloseTo(bek[i] + bek[(i + 1) % 6], 9);
    });
  });

  test('defterin tasarımı geçiyor; en kritik çift alternatör–avara, pay %1,8', () => {
    const c = K.veFeadCheckCenterDistance(kirpiBuild(), { relDeg: 0 });
    expect(c.ok).toBe(true);
    expect(c.durum).toBe('ok');
    expect(c.worst.cift).toBe('Avara 2 ↔ Alternatör');
    expect(c.worst.payPct).toBeCloseTo(1.775, 2);
    expect(c.worst.hi - c.worst.a).toBeCloseTo(5.083, 2);
  });

  // İHLAL 'no' DEĞİL 'warn' — kuralın iki kasnaklı kökeni yüzünden.
  test('üst sınır aşılırsa durum "warn", genel hükmü kırmaz', () => {
    const c = K.veFeadCheckCenterDistance(kirpiBuild({ altX: -420 }), { relDeg: 0 });
    expect(c.ok).toBe(false);
    expect(c.durum).toBe('warn');
    const ihlal = c.rows.filter((r) => !r.ok);
    expect(ihlal.length).toBeGreaterThan(0);
    ihlal.forEach((r) => expect(r.payPct).toBeLessThan(0));
  });

  // ALT SINIR ÇAPI BÜYÜTEREK İHLAL EDİLİYOR, KASNAĞI YAKLAŞTIRARAK DEĞİL:
  // yaklaştırmak kayış yolunu katlayıp geometriyi çözülemez yapıyor (işaretli
  // sarım toplamı 0), yani ölçülen şey kapı değil çekirdeğin reddi olurdu.
  // Çap büyütmek `a`yı değiştirmeden yalnız sınırı yukarı taşır.
  test('alt sınırın altı da yakalanıyor', () => {
    // Avara 1 Ø75 → Ø130: alt sınır 167,0 → 205,5 mm, a = 189,6 mm sabit.
    const c = K.veFeadCheckCenterDistance(kirpiBuild({ id1OD: 130 }), { relDeg: 0 });
    const dar = c.rows.find((r) => r.a < r.lo);
    expect(dar).toBeTruthy();
    expect(dar.cift).toBe('Tahrik Kasnağı ↔ Avara 1');
    expect(dar.a).toBeCloseTo(189.589, 2);
    expect(dar.lo).toBeCloseTo(0.7 * (161.4 + 132.2), 2);
    expect(dar.altPayPct).toBeLessThan(0);
    expect(c.durum).toBe('warn');
  });

  test('geometri yoksa uydurmuyor — "wait"', () => {
    const c = K.veFeadCheckCenterDistance({ ok: false }, {});
    expect(c.durum).toBe('wait');
    expect(c.rows).toEqual([]);
    expect(c.ok).toBeNull();
  });

  test('komşuluk kayış yolu sırası ve çevrim KAPANIYOR', () => {
    const c = K.veFeadCheckCenterDistance(kirpiBuild(), { relDeg: 0 });
    expect(c.rows.map((r) => r.i)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(c.rows.map((r) => r.j)).toEqual([1, 2, 3, 4, 5, 0]);
  });
});

// ───────────────────────────────────────── 2) ÇEVRİM ORANI PENCERESİ ──
describe('Kapı 2 — çevrim oranı penceresi', () => {
  test('defterin tasarımında iki aksesuar da bandın içinde', () => {
    const w = K.veFeadCheckRatioWindow(kirpiBuild(), OPT);
    expect(w.durum).toBe('ok');
    expect(w.rows.length).toBe(2);
    const alt = w.rows.find((r) => r.ad === 'Alternatör');
    const ac = w.rows.find((r) => r.ad === 'Klima Komp.');
    expect(alt.optimumRpm).toBe(6000);
    expect(alt.maxContRpm).toBe(8000);
    expect(alt.accRpm).toBeCloseTo(6250.8, 1);
    expect(alt.verdict).toBe('uygun');
    expect(ac.accRpm).toBeCloseTo(2667.9, 1);
    expect(ac.verdict).toBe('uygun');
  });

  // DEFTERİN KENDİ İÇİNDEKİ ÜÇ ORAN — dosya başlığındaki ölçüm.
  test('oran sapması: MFSim pitch çapından, defter iki farklı sayı taşıyor', () => {
    const w = K.veFeadCheckRatioWindow(kirpiBuild(), OPT);
    const alt = w.rows.find((r) => r.ad === 'Alternatör');
    const oran = alt.accRpm / OPT.governedRpm;

    expect(oran).toBeCloseTo(2.4492 * (218.3 / 179.62), 3);   // pitch çapından
    expect(oran).toBeCloseTo(2.9766, 3);

    // Defterin "Komponent Secimi" F20'si DIŞ çapla: 159/63.5 · 218,3/179,62
    const defterKS = (159 / 63.5) * (218.3 / 179.62);
    expect(defterKS).toBeCloseTo(3.0431, 3);
    expect((defterKS / oran - 1) * 100).toBeCloseTo(2.24, 1);

    // Defterin "Kuvvet Hesabi-" F9'u ELLE: 3,13 · 218,3/179,62
    const defterKH = 3.13 * (218.3 / 179.62);
    expect((defterKH / oran - 1) * 100).toBeCloseTo(27.80, 1);
    // Fu ∝ 1/n → defterin alternatör çevresel kuvveti %27,8 DÜŞÜK.
    expect((201.855417 * defterKH) / oran).toBeCloseTo(258.0, 0);
  });

  test('devir bandın altındaysa "kasnak çapı küçültülmeli"', () => {
    // Alternatör sınırını yukarı it: 6250 d/dk artık optimumun altında kalır.
    const w = K.veFeadCheckRatioWindow(kirpiBuild({ alt: { optimumRpm: 7000 } }), OPT);
    const alt = w.rows.find((r) => r.ad === 'Alternatör');
    expect(alt.verdict).toBe('kucult');
    expect(alt.metin).toBe('Kasnak çapı küçültülmeli');
    expect(alt.payPct).toBeLessThan(0);
    expect(w.durum).toBe('no');
  });

  test('devir bandın üstündeyse "kasnak çapı büyütülmeli"', () => {
    const w = K.veFeadCheckRatioWindow(kirpiBuild({ alt: { maxContRpm: 5000 } }), OPT);
    const alt = w.rows.find((r) => r.ad === 'Alternatör');
    expect(alt.verdict).toBe('buyut');
    expect(alt.metin).toBe('Kasnak çapı büyütülmeli');
    expect(w.durum).toBe('no');
  });

  test('governed devir bilinmiyorsa uydurmuyor — "wait"', () => {
    const w = K.veFeadCheckRatioWindow(kirpiBuild(), { governedRpm: NaN });
    expect(w.durum).toBe('wait');
    expect(w.rows).toEqual([]);
    expect(w.note).toMatch(/governed/i);
  });

  test('sürücü, gergi ve avara satır ÜRETMEZ', () => {
    const w = K.veFeadCheckRatioWindow(kirpiBuild(), OPT);
    const adlar = w.rows.map((r) => r.ad);
    expect(adlar).not.toContain('Tahrik Kasnağı');
    expect(adlar).not.toContain('Gergi Kasnağı');
    expect(adlar).not.toContain('Avara 1');
  });

  test('sınırı olmayan aksesuar satır üretmez, kapı "wait" olur', () => {
    const b = kirpiBuild();
    b.order.forEach((n) => { delete n.data.accLib; });
    const w = K.veFeadCheckRatioWindow(b, OPT);
    expect(w.durum).toBe('wait');
  });
});

// ──────────────────────────────────────────── 3) AKSESUAR DEVİR SINIRI ──
describe('Kapı 3 — aksesuar devir sınırı', () => {
  test('üç devir noktası da bakılıyor ve doğru sınıra bağlanıyor', () => {
    const s = K.veFeadCheckSpeedLimit(kirpiBuild(), OPT);
    expect(s.durum).toBe('ok');
    const alt = s.rows.find((r) => r.ad === 'Alternatör');
    expect(alt.noktalar.map((p) => p.ad)).toEqual(['çevrim tepesi', 'governed', 'overspeed']);
    expect(alt.noktalar.map((p) => p.limitAd)).toEqual(['sürekli', 'sürekli', 'anlık']);
    expect(alt.noktalar[2].accRpm).toBeCloseTo(8631.7, 0);   // 2900 d/dk'da
    expect(alt.noktalar[2].limit).toBe(12000);
    expect(alt.noktalar[2].ok).toBe(true);
  });

  test('overspeed anlık sınırı aşarsa "no"', () => {
    const s = K.veFeadCheckSpeedLimit(kirpiBuild({ alt: { maxPeakRpm: 8000 } }), OPT);
    expect(s.durum).toBe('no');
    const alt = s.rows.find((r) => r.ad === 'Alternatör');
    const over = alt.noktalar.find((p) => p.ad === 'overspeed');
    expect(over.ok).toBe(false);
    expect(over.payPct).toBeLessThan(0);
  });

  test('çevrim tepesi sürekli sınırı aşarsa "no"', () => {
    const s = K.veFeadCheckSpeedLimit(kirpiBuild({ alt: { maxContRpm: 5000 } }), OPT);
    const alt = s.rows.find((r) => r.ad === 'Alternatör');
    expect(alt.noktalar.filter((p) => p.limitAd === 'sürekli').every((p) => !p.ok)).toBe(true);
    expect(s.durum).toBe('no');
  });

  test('bilinmeyen devir noktası ATLANIR, uydurulmaz', () => {
    const s = K.veFeadCheckSpeedLimit(kirpiBuild(), { governedRpm: 2100 });
    const alt = s.rows.find((r) => r.ad === 'Alternatör');
    expect(alt.noktalar.map((p) => p.ad)).toEqual(['governed']);
  });

  test('hiçbir motor devri yoksa "wait"', () => {
    const s = K.veFeadCheckSpeedLimit(kirpiBuild(), {});
    expect(s.durum).toBe('wait');
    expect(s.rows).toEqual([]);
  });

  test('kritik nokta en dar paylı olan', () => {
    const s = K.veFeadCheckSpeedLimit(kirpiBuild(), OPT);
    s.rows.forEach((r) => {
      const enDar = Math.min.apply(null, r.noktalar.map((p) => p.payPct));
      expect(r.kritik.payPct).toBeCloseTo(enDar, 9);
      expect(r.payPct).toBeCloseTo(enDar, 9);
    });
  });
});

// ──────────────────────────────────────────────────── ORTAK GİRİŞ NOKTASI ──
describe('veFeadChecks + veFeadCheckOpt', () => {
  test('üçü birden tek çağrıda döner', () => {
    const R = K.veFeadChecks(kirpiBuild(), OPT);
    expect(Object.keys(R).sort())
      .toEqual(['centerDistance', 'ratioWindow', 'speedLimit', 'version']);
    expect(R.centerDistance.durum).toBe('ok');
    expect(R.ratioWindow.durum).toBe('ok');
    expect(R.speedLimit.durum).toBe('ok');
  });

  test('checkOpt: çevrim tepesi duty satırlarının EN YÜKSEK devri', () => {
    const o = K.veFeadCheckOpt(
      { governedRpm: 2100, overspeedRpm: 2900, idleRpm: 700 },
      [{ rpm: 800 }, { rpm: 2750 }, { rpm: 1500 }]);
    expect(o.maxDutyRpm).toBe(2750);
    expect(o.governedRpm).toBe(2100);
    expect(o.overspeedRpm).toBe(2900);
  });

  test('checkOpt: metin devirleri de okur (panel alanları string döndürür)', () => {
    const o = K.veFeadCheckOpt({ governedRpm: '2100', overspeedRpm: '2900' }, [{ rpm: '1800' }]);
    expect(o.governedRpm).toBe(2100);
    expect(o.maxDutyRpm).toBe(1800);
  });

  test('checkOpt: duty yoksa çevrim tepesi NaN — 0 DEĞİL', () => {
    const o = K.veFeadCheckOpt({ governedRpm: 2100 }, []);
    expect(Number.isNaN(o.maxDutyRpm)).toBe(true);
  });

  // SIFIR PAYLI SATIR BİR ÇALIŞMA NOKTASI DEĞİL. Arşivde AG00810 tam olarak
  // böyle kurulmuş: ara devirler sıfır ağırlıklı, yalnız gerilme tablosuna
  // giriyorlar. Onları "sürekli" sınırla karşılaştırmak, motorun hiç kalmadığı
  // bir devirde ihlal ilan etmek olurdu.
  test('checkOpt: süre payı sıfır olan devir çevrim tepesi SAYILMAZ', () => {
    const o = K.veFeadCheckOpt({ governedRpm: 2100 },
      [{ rpm: 800, dcPct: 27 }, { rpm: 2000, dcPct: 13 }, { rpm: 2600, dcPct: 0 }]);
    expect(o.maxDutyRpm).toBe(2000);
  });

  // Payı YAZILMAMIŞ satır sıfır sayılmaz — eksik veri, sıfır beyanı değildir.
  test('checkOpt: süre payı boş olan satır yine de sayılır', () => {
    expect(K.veFeadCheckOpt({}, [{ rpm: 800, dcPct: 27 }, { rpm: 2600 }]).maxDutyRpm).toBe(2600);
    expect(K.veFeadCheckOpt({}, [{ rpm: 800, dcPct: 27 }, { rpm: 2600, dcPct: '' }]).maxDutyRpm)
      .toBe(2600);
  });
});

// ──────────────────────────────────────────────────── PANEL VE RAPOR BAĞI ──
describe('İki yüzey de AYNI çağrıyı kullanıyor', () => {
  const fs = require('fs');
  const path = require('path');
  const PANEL = fs.readFileSync(path.join(__dirname, '../../js/cp-fead.js'), 'utf8');
  const REPORT = fs.readFileSync(path.join(__dirname, '../../js/cp-fead-report.js'), 'utf8');

  test('panel kartı kapıları veFeadChecks ile hesaplıyor', () => {
    expect(PANEL).toContain('function veFeadChecksCard');
    expect(PANEL).toMatch(/veFeadChecks\(build,\s*opt\)/);
  });

  // Rapor kapıları YENİDEN HESAPLAMAZ: çözümden sonra değiştirilen bir devir
  // sınırı belgeye sızardı ve rapor kendi modelinden başkasını denetlerdi.
  test('rapor kapıları R.checks\'ten OKUYOR, yeniden hesaplamıyor', () => {
    expect(REPORT).toContain('function _frCheckRows');
    expect(REPORT).toMatch(/R\s*&&\s*R\.checks/);
    expect(REPORT).not.toContain('veFeadCheckCenterDistance(');
    expect(REPORT).not.toContain('veFeadCheckRatioWindow(');
  });

  test('çözüm kapıları sonuca yazıyor', () => {
    expect(PANEL).toMatch(/res\.checks\s*=/);
    expect(PANEL).toMatch(/res\.checkOpt\s*=/);
  });

  test('rapor rozetinde dördüncü durum "warn" var', () => {
    expect(REPORT).toMatch(/d === 'warn'/);
  });
});
