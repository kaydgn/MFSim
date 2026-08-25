/**
 * fead-example.test.js — TEDARİKÇİ SAYFASI ÇIPASI (FEAD_INFORMATION)
 *
 * Bu dosya FEAD zincirinin İKİNCİ, BAĞIMSIZ doğrulamasıdır. fead-core.test.js
 * 17 Gates raporunun 2095 değerine bakıyor; burada bakılan şey kullanıcının
 * KENDİ tedarikçi sayfası: 6 kasnaklı BMC düzeni, kendi koordinatları, kendi
 * yay künyesi, kendi duty tablosu. Gates raporlarıyla ortak hiçbir sayı yok.
 *
 * Sayfada yazan ve MODELDEN ÇIKMASI GEREKEN dört bağımsız değer:
 *
 *   | sayfada                       | değer     | nereden çıkıyor              |
 *   |-------------------------------|-----------|------------------------------|
 *   | kayış efektif boyu            | 1715 mm   | 6 kasnağın koordinatı + çapı |
 *   | gergi kol boyu (Arm Length)   | 90.0 mm   | |montaj merkezi − pivot|     |
 *   | Spring Mean Load              | 22.07 Nm  | çalışma noktası yay dengesi  |
 *   | tahrik oranı (KRANK/FAN)      | 1.1       | 197.32 / 179.62              |
 *
 * Dördü BİRBİRİNDEN BAĞIMSIZ: kayış boyu salt geometri, kol boyu salt
 * koordinat aritmetiği, mean load geometri + yay dengesi, tahrik oranı iki çap.
 * Aynı anda dördünün de tutması, zincirin baştan sona doğru bağlandığı anlamına
 * geliyor — biri bile kayarsa hangi katmanın bozulduğu doğrudan okunuyor.
 *
 * EN KRİTİK TEST: "montaj merkezi serbest açı diye girilirse". Sayfa serbest
 * kol açısını VERMİYOR; montaj merkezini veriyor. Karıştırılırsa çekirdek
 * geometriyi kusursuz çözer, hata VERMEZ, ama gerginlik 2.6 kat düşük çıkar.
 * O sessizliği belgeleyen test aşağıda.
 */
const M = require('../../js/fead-model.js');
const F = require('../../js/fead-core.js');

const stubs = stubGlobals();
document.body.innerHTML = '<div id="ve-canvas"></div>';
global.nodes = [];
global.connections = [];
eval(loadSource('components.js'));
global.FEADCore = F;
Object.keys(M).forEach((k) => { global[k] = M[k]; });

beforeEach(() => { resetStubs(stubs); global.nodes = []; global.connections = []; });

// Sayfadan okunan referans değerler — tek yerde, kaynağıyla birlikte.
const SAYFA = {
  beltEffMm: 1715,          // "1715 mm kayış uzunluğu (modelden bulunan)"
  armLenMm: 90.0,           // Tensioner tablosu: Arm Length
  springPreNm: 8.60,        // Spring Pre-Load
  springRateNmDeg: 0.480,   // Spring Rate
  springMeanNm: 22.07,      // Spring Mean Load
  driveRatio: 1.1,          // KRANK/FAN Oranı (197.32 / 179.62)
  cylinders: 6,             // Engine Info: Nr of cylinders
  dutyToplamPct: 100,       // Duty Cycle sütun toplamı
};

// Örneği köprüden geçir. Kanvas YOK: örnek tanımı DOM'suz katmanda durduğu için
// düğüm dizisi doğrudan veFeadBuildSystem'e verilebiliyor.
function kur() {
  const pack = veFeadExampleNodes('BMC_FEAD_2026');
  pack.nodes.forEach((n) => { n.def = componentDefs[n.type]; });
  const build = veFeadBuildSystem(pack.nodes, pack.connections);
  return { pack, build };
}

// Çekirdeğe giden adlar KULLANICININ GÖRDÜĞÜ adlardır (veFeadUniqueNames
// customName'den üretir) — kısaltma değil. Tabloların anahtarı bu.
const AD = {
  SRC: 'Sürücü Kasnak', IDR1: 'Avara 1', A_C: 'Klima Kompresörü',
  IDR2: 'Avara 2', ALT: 'Alternatör', TEN: 'Otomatik Gergi'
};
// Örnekteki bir kasnağı kayış sırasındaki indeksiyle bul.
function bul(build, key) {
  const i = build.names.indexOf(AD[key]);
  return { i, node: build.order[i] };
}

describe('BMC örneği köprüden geçiyor', () => {
  test('hata olmadan çözülüyor', () => {
    const { build } = kur();
    expect(build.errors).toEqual([]);
    expect(build.ok).toBe(true);
  });

  test('6 kasnak, kayış sırası serpantin sırasıyla aynı', () => {
    const { build } = kur();
    expect(build.names).toEqual(
      [AD.SRC, AD.IDR1, AD.A_C, AD.IDR2, AD.ALT, AD.TEN]);
  });

  test('temas tarafları: üç kaburgalı, üç sırttan', () => {
    const { build } = kur();
    const yan = build.sys.pulleys.map((p) => p.contact);
    expect(yan).toEqual(['grooved', 'back', 'grooved', 'back', 'grooved', 'back']);
  });
});

describe('sayfanın dört çıpası', () => {
  test('kayış efektif boyu 1715 mm — 6 koordinat + 6 çaptan', () => {
    const { build } = kur();
    const L = F.geometryAt(build.sys, F.meanRel(build.sys)).LeffMm;
    // %0.05: sayfadaki 1715 yuvarlanmış bir sayı, çözüm 1715.27 veriyor.
    expect(Math.abs(L - SAYFA.beltEffMm) / SAYFA.beltEffMm).toBeLessThan(0.0005);
  });

  test('gergi kol boyu 90.0 mm — montaj merkezi ile pivot arasındaki uzaklık', () => {
    const ten = veFeadExampleOf('BMC_FEAD_2026').pulleys.find((p) => p.key === 'TEN');
    const ac = veFeadArmCheck(ten.data);
    expect(ac.fromCoords).toBeCloseTo(SAYFA.armLenMm, 2);
    expect(ac.entered).toBe(SAYFA.armLenMm);
    expect(ac.ok).toBe(true);                       // sapma 0.5 mm kapısının altında
    expect(Math.abs(ac.deltaMm)).toBeLessThan(0.01);
  });

  test('Spring Mean Load 22.07 Nm — ÇÖZÜLEN nokta ondan ne kadar ayrışıyor', () => {
    // Sayfanın "Spring Mean Load"u kolun NOMİNAL çalışma açısını söyler:
    // rel_nominal = (22,07 − 8,60)/0,480 = 28,06°. Serbest açı buradan türetilir.
    // Ama GERÇEK çalışma açısı kayış boyundan çözülür ve ikisi aynı olmak
    // zorunda değildir — aradaki fark, gergi künyesi ile kayış künyesinin ne
    // kadar tutarlı olduğunun ÖLÇÜSÜDÜR.
    //
    // Bu örnek artık İKİ KAYNAK KARIŞTIRIYOR (kullanıcı kararı, 2026-08-25):
    // gergi künyesi Gates raporunun "Tensioner Data" bloğundan, kayış künyesi
    // hâlâ tedarikçiye giden sayfadan (effLength 1715 · tolerans 0 · aşınma 0 ·
    // lengthOffset 0). ÖLÇÜLDÜ: çözülen açı 29,73°, orada M = 22,87 Nm → %3,6.
    //
    // Kapı bu farkı GÖRÜNÜR tutuyor, gizlemiyor: %5'i aşarsa iki künye artık
    // aynı sistemi anlatmıyor demektir. Raporun Belt Data bloğu da alınınca
    // fark kapanıyor — AG00976_GATES_2025'te aynı büyüklük %0,09 (testi orada).
    const { build } = kur();
    const mr = F.meanRel(build.sys);
    const M_yay = F.springTorque(build.sys, mr);
    // PİVOT TÜRETİLDİĞİNDEN BERİ MODEL YİNE KENDİ İÇİNDE TUTARLI: gergi künyesi
    // (kol boyu + kol açısı + yay) ile kayış künyesi aynı kaynaktan geliyor ve
    // çözülen açı nominale %0.79 ile oturuyor. Gates'in pivotu sayfanın kayışıyla
    // birlikte kullanıldığında bu sapma %3.6'ya çıkıyordu — iki kaynağın
    // karıştığının ölçüsüydü.
    const sapma = Math.abs(M_yay - SAYFA.springMeanNm) / SAYFA.springMeanNm;
    expect(sapma).toBeLessThan(0.015);
  });

  test('tahrik oranı 1.1 — krank/fan çapından', () => {
    const sd = veFeadExampleOf('BMC_FEAD_2026').solver;
    const dr = veFeadDriveRatio(sd);
    expect(dr.mode).toBe('derive');
    expect(dr.ratio).toBeCloseTo(197.32 / 179.62, 6);
    expect(Math.abs(dr.ratio - SAYFA.driveRatio)).toBeLessThan(0.002);
  });
});

describe('sarım değişmezi ve çevrim kapanışı', () => {
  test('Σ(kaburgalı) − Σ(sırttan) = 360° — TAM', () => {
    const { build } = kur();
    const g = F.geometryAt(build.sys, F.meanRel(build.sys));
    let sg = 0, bk = 0;
    g.wraps.forEach((w, i) => {
      if (build.sys.pulleys[i].contact === 'back') bk += w; else sg += w;
    });
    expect((sg - bk) * 180 / Math.PI).toBeCloseTo(360, 6);
  });

  test('sarım açılarının hepsi pozitif ve 360°ın altında', () => {
    const { build } = kur();
    F.geometryAt(build.sys, F.meanRel(build.sys)).wraps.forEach((w) => {
      expect(w).toBeGreaterThan(0);
      expect(w * 180 / Math.PI).toBeLessThan(360);
    });
  });
});

// ════════════════════════════════════════════════════════════════════════════
//  MONTAJ MERKEZİ ↔ SERBEST AÇI — bu modülün en pahalı sessizliği
// ════════════════════════════════════════════════════════════════════════════
describe('montaj merkezi serbest açı DEĞİLDİR', () => {
  test('montaj konumundan türetme: serbest açı = montaj açısı − sense × rel_mean', () => {
    const ten = veFeadExampleOf('BMC_FEAD_2026').pulleys.find((p) => p.key === 'TEN');
    const m = veFeadTensionerMount(ten.data);
    expect(m.ok).toBe(true);
    // Montaj açısı = kolun MUTLAK açısı ve artık PARÇA KÜNYESİNDEN geliyor:
    // E9843 çizimi "344° MEAN ANGLE" diyor, −16° onun eşdeğeri.
    expect(m.montajDeg).toBeCloseTo(-16.0, 3);
    expect(m.pivotDerived).toBe(true);
    expect(m.relMeanDeg).toBeCloseTo((22.07 - 8.60) / 0.480, 6);   // 28.06°
    expect(veFeadFreeAngleFrom(m, +1)).toBeCloseTo(m.montajDeg - m.relMeanDeg, 9);
    expect(veFeadFreeAngleFrom(m, -1)).toBeCloseTo(m.montajDeg + m.relMeanDeg, 9);
  });

  // KAPININ VARLIK NEDENİ. Yanlış okuma hata VERMEZ; ölçülen fark burada.
  test('sayfadaki montaj açısı serbest açı diye girilirse gerginlik 2.6 KAT düşer', () => {
    const pack = veFeadExampleNodes('BMC_FEAD_2026');
    pack.nodes.forEach((n) => { n.def = componentDefs[n.type]; });
    const dogru = veFeadBuildSystem(pack.nodes, pack.connections);
    expect(dogru.ok).toBe(true);
    const T_dogru = F.tensionerState(dogru.sys, F.meanRel(dogru.sys)).tensionN;

    // YANLIŞ okuma: montaj açısı doğrudan freeAngleDeg alanına yazılmış.
    const yanlisNodes = JSON.parse(JSON.stringify(pack.nodes));
    const ten = yanlisNodes.find((n) => n.type === 'fead-tensioner');
    const m = veFeadTensionerMount(ten.data);
    ten.data.angleMode = 'direct';
    ten.data.freeAngleDeg = m.montajDeg;
    yanlisNodes.forEach((n) => { n.def = componentDefs[n.type]; });
    const yanlis = veFeadBuildSystem(yanlisNodes, pack.connections);

    // 1) HATA VERMİYOR — sessizlik tam olarak burada.
    expect(yanlis.errors).toEqual([]);
    expect(yanlis.ok).toBe(true);

    // 2) Ama çalışma noktasındaki yay momenti sayfadaki değerin çok altında.
    const M_yanlis = F.springTorque(yanlis.sys, F.meanRel(yanlis.sys));
    expect(M_yanlis).toBeLessThan(10);                     // ölçüldü: 8.81 Nm
    expect(SAYFA.springMeanNm / M_yanlis).toBeGreaterThan(2);

    // 3) Ve gerginlik 2.6 kat düşük (ölçüldü: 650 N ↔ 251 N).
    const T_yanlis = F.tensionerState(yanlis.sys, F.meanRel(yanlis.sys)).tensionN;
    // ÖLÇÜLDÜ (türetilen pivotla): 532,1 N ↔ yanlış yol belirgin altında.
    expect(T_dogru / T_yanlis).toBeGreaterThan(2.2);
    expect(T_dogru).toBeGreaterThan(500);
    expect(T_yanlis).toBeLessThan(300);
  });

  test('montaj yolu: eksik çalışma momenti HATA verir (sessizce 0 sayılmaz)', () => {
    const pack = veFeadExampleNodes('BMC_FEAD_2026');
    const ten = pack.nodes.find((n) => n.type === 'fead-tensioner');
    delete ten.data.meanLoad;
    pack.nodes.forEach((n) => { n.def = componentDefs[n.type]; });
    const build = veFeadBuildSystem(pack.nodes, pack.connections);
    expect(build.ok).toBe(false);
    expect(build.errors.join(' ')).toMatch(/çalışma momenti|Spring Mean Load/i);
  });

  test('montaj yolu: montaj merkezi girilmeden çözülmez', () => {
    const pack = veFeadExampleNodes('BMC_FEAD_2026');
    const ten = pack.nodes.find((n) => n.type === 'fead-tensioner');
    delete ten.data.cenX; delete ten.data.cenY;
    pack.nodes.forEach((n) => { n.def = componentDefs[n.type]; });
    const build = veFeadBuildSystem(pack.nodes, pack.connections);
    expect(build.ok).toBe(false);
    expect(build.errors.join(' ')).toMatch(/montaj merkezi/i);
  });

  // KOL BOYU ÇAPRAZ KONTROLÜ YALNIZ GİRİLMİŞ PİVOTTA BİR ŞEY ÖLÇER.
  // Pivot türetildiğinde (BMC_FEAD_2026) kontrol TOTOLOJİKTİR: pivot zaten
  // merkezden tam armLen uzağa konuyor, dolayısıyla fark yapısal olarak sıfır.
  // Bunu bir "geçti" gibi sunmak, bu oturumda iki kez düzeltilen hatanın
  // (uygunluk #6, ilk pivot bloğu) tekrarı olurdu — kod bayrakla söylüyor.
  test('TÜRETİLEN pivotta kol boyu kontrolü TOTOLOJİK ve öyle işaretli', () => {
    const ten = veFeadExampleOf('BMC_FEAD_2026').pulleys.find((p) => p.key === 'TEN');
    expect(ten.data.pivotX).toBeUndefined();
    const ac = veFeadArmCheck(ten.data);
    expect(ac.ok).toBe(true);
    expect(ac.tautological).toBe(true);
    // Kol boyunu değiştirmek pivotu da taşıdığı için fark YİNE sıfır kalır.
    const ac2 = veFeadArmCheck(Object.assign({}, ten.data, { armLen: 70 }));
    expect(Math.abs(ac2.deltaMm)).toBeLessThan(1e-9);
    expect(ac2.tautological).toBe(true);
  });

  // Pivot GİRİLDİĞİNDE (tedarikçi raporundan gelen ÖLÇÜLMÜŞ pivot) kontrol
  // gerçek bir denetimdir: iki bağımsız sayı karşılaştırılır.
  test('GİRİLEN pivotta kol boyu uyuşmazlığı çözümü DURDURUR', () => {
    const pack = veFeadExampleNodes('AG00976_GATES_2025');
    const ten = pack.nodes.find((n) => n.type === 'fead-tensioner');
    expect(ten.data.pivotX).toBeDefined();
    expect(veFeadArmCheck(ten.data).tautological).toBe(false);
    ten.data.armLen = 70;                     // koordinatlar 90 mm diyor
    pack.nodes.forEach((n) => { n.def = componentDefs[n.type]; });
    const build = veFeadBuildSystem(pack.nodes, pack.connections);
    expect(build.ok).toBe(false);
    expect(build.errors.join(' ')).toMatch(/kol boyu tutmuyor/i);
  });

  test('0.5 mm altındaki sapma kabul edilir (ölçü yuvarlaması)', () => {
    const ten = veFeadExampleOf('AG00976_GATES_2025').pulleys.find((p) => p.key === 'TEN');
    expect(veFeadArmCheck(Object.assign({}, ten.data, { armLen: 90.3 })).ok).toBe(true);
    expect(veFeadArmCheck(Object.assign({}, ten.data, { armLen: 90.8 })).ok).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════════════════════
//  AKSESUAR GÜÇ EĞRİSİ
// ════════════════════════════════════════════════════════════════════════════
describe('güç eğrisi: sayfanın devir → kW tabloları', () => {
  test('eğri sıralanır, eksik satırlar düşer', () => {
    const n = { type: 'fead-ac', data: { pwrCurve: [
      { rpm: 2000, kw: 5 }, { rpm: 1000, kw: 2 },
      { rpm: '', kw: 9 }, { rpm: 1500, kw: '' }, { rpm: -5, kw: 1 }
    ] } };
    expect(veFeadPowerCurve(n)).toEqual([{ rpm: 1000, kw: 2 }, { rpm: 2000, kw: 5 }]);
  });

  test('ara değer doğrusal, uçlarda SABİT — ekstrapolasyon yok', () => {
    const pts = [{ rpm: 1000, kw: 2 }, { rpm: 2000, kw: 6 }];
    expect(veFeadInterpKw(pts, 1500)).toBeCloseTo(4, 9);
    expect(veFeadInterpKw(pts, 500)).toBe(2);        // uzatılsaydı eksi olurdu
    expect(veFeadInterpKw(pts, 9000)).toBe(6);
  });

  test('sayfadaki A/C tablosu: 2346 rpm → 6.47 kW birebir', () => {
    const ac = veFeadExampleOf('BMC_FEAD_2026').pulleys.find((p) => p.key === 'A_C');
    expect(veFeadInterpKw(veFeadPowerCurve({ data: ac.data }), 2346)).toBeCloseTo(6.47, 9);
  });

  test('sayfadaki ALT tablosu: 6300 rpm → 4.28 kW birebir', () => {
    const alt = veFeadExampleOf('BMC_FEAD_2026').pulleys.find((p) => p.key === 'ALT');
    expect(veFeadInterpKw(veFeadPowerCurve({ data: alt.data }), 6300)).toBeCloseTo(4.28, 9);
  });

  // DÜĞÜMÜN KENDİ EĞRİSİ KATALOĞUN ÖNÜNDE. Tersi olsaydı kullanıcının girdiği
  // tedarikçi verisi sessizce genel katalogla değiştirilirdi.
  test('düğümün kendi eğrisi kataloğu EZER', () => {
    global.VE_AC_PRESETS = { X: { name: 'X', curve: [[0, 99], [10000, 99]] } };
    global.veAccInterpCurve = (c, rpm) => 99;
    const { build } = kur();
    const { i, node: ac } = bul(build, 'A_C');
    ac.data.accPreset = 'X';                       // katalog da seçili
    const kw = veFeadAutoKw(build.sys, i, ac, 2000);
    expect(kw).not.toBeCloseTo(99, 1);             // katalog kazanmadı
    expect(kw).toBeGreaterThan(5);                 // sayfanın eğrisinden geldi
    expect(kw).toBeLessThan(8);
    delete global.VE_AC_PRESETS; delete global.veAccInterpCurve;
  });

  test('eğrisi olmayan aksesuarda katalog yolu bozulmadan çalışır', () => {
    const { build } = kur();
    const { i, node } = bul(build, 'IDR1');
    // Avaranın ne eğrisi ne kataloğu var → null (çevrimde 0 kW sayılır).
    expect(veFeadAutoKw(build.sys, i, node, 2000)).toBeNull();
  });
});

// ════════════════════════════════════════════════════════════════════════════
//  ÇALIŞMA ÇEVRİMİ + ÇÖZÜM
// ════════════════════════════════════════════════════════════════════════════
describe('sayfanın duty tablosuyla tam çözüm', () => {
  test('duty yüzdeleri toplamı 100 (%0 satırı hariç)', () => {
    const duty = veFeadExampleOf('BMC_FEAD_2026').solver.duty;
    expect(duty.reduce((a, r) => a + r.dcPct, 0)).toBe(SAYFA.dutyToplamPct);
  });

  test('analyze() koşuyor ve her devir noktası sonuç üretiyor', () => {
    const { pack, build } = kur();
    const sv = pack.nodes.find((n) => n.type === 'fead-solver');
    const R = veFeadAnalyze(build, {
      rows: veFeadDutyRows(sv), cylinders: SAYFA.cylinders
    });
    expect(R.error).toBeNull();
    expect(R.ok).toBe(true);
    expect(R.duty.length).toBe(veFeadExampleOf('BMC_FEAD_2026').solver.duty.length);
  });

  test('aksesuar güçleri sayfanın eğrilerinden geliyor (kW > 0)', () => {
    const { pack, build } = kur();
    const sv = pack.nodes.find((n) => n.type === 'fead-solver');
    const duty = veFeadDutyToCore(build, veFeadDutyRows(sv));
    const at2000 = duty.find((d) => d.engineRpm === 2000);
    expect(at2000.loadsKw[AD.A_C]).toBeGreaterThan(5);   // sayfada 2346 rpm → 6.47
    expect(at2000.loadsKw[AD.ALT]).toBeGreaterThan(3);   // sayfada ~4.28
    expect(at2000.loadsKw[AD.IDR1]).toBe(0);             // avara yük çekmez
    expect(at2000.loadsKw[AD.SRC]).toBeUndefined();      // sürücü: hesaplanır
  });

  test('ateşleme frekansı: 6 silindir, 2000 rpm → 100 Hz', () => {
    expect(F.firingFrequencyHz(2000, SAYFA.cylinders)).toBeCloseTo(100, 6);
  });

  // Sürücü gücü = diğerlerinin toplamı (çevrim kapanışı). Elle girilirse
  // çekirdek reddeder; burada kontrol edilen şey köprünün onu HİÇ göndermediği.
  test('sürücü gücü gönderilmiyor — çevrimi çekirdek kapatıyor', () => {
    const { pack, build } = kur();
    const sv = pack.nodes.find((n) => n.type === 'fead-solver');
    veFeadDutyToCore(build, veFeadDutyRows(sv)).forEach((d) => {
      expect(Object.keys(d.loadsKw)).not.toContain(AD.SRC);
    });
  });
});

// ════════════════════════════════════════════════════════════════════════════
//  ÖRNEK TANIMININ YAPISAL TUTARLILIĞI
// ════════════════════════════════════════════════════════════════════════════
describe('örnek kaydı ↔ tanım tutarlılığı', () => {
  test('route içindeki her anahtar bir kasnağa karşılık geliyor', () => {
    veFeadExampleKeys().forEach((k) => {
      const ex = veFeadExampleOf(k);
      const anahtarlar = ex.pulleys.map((p) => p.key);
      expect(new Set(anahtarlar).size).toBe(anahtarlar.length);   // tekrar yok
      ex.route.forEach((r) => expect(anahtarlar).toContain(r));
      expect(ex.route.length).toBe(ex.pulleys.length);            // öksüz kasnak yok
    });
  });

  test('bağlantılar KAPALI ÇEVRİM kuruyor', () => {
    veFeadExampleKeys().forEach((k) => {
      const pack = veFeadExampleNodes(k);
      const kasnakSay = veFeadExampleOf(k).pulleys.length;
      expect(pack.connections.length).toBe(kasnakSay);
      // her kasnağın tam bir çıkışı ve tam bir girişi var
      const cikis = {}, giris = {};
      pack.connections.forEach((c) => {
        cikis[c.from] = (cikis[c.from] || 0) + 1;
        giris[c.to] = (giris[c.to] || 0) + 1;
      });
      Object.keys(cikis).forEach((id) => expect(cikis[id]).toBe(1));
      Object.keys(giris).forEach((id) => expect(giris[id]).toBe(1));
      expect(Object.keys(cikis).length).toBe(kasnakSay);
    });
  });

  test('her örnekte TEK sürücü ve TEK gergi var', () => {
    veFeadExampleKeys().forEach((k) => {
      const ex = veFeadExampleOf(k);
      expect(ex.pulleys.filter((p) => p.data.driver).length).toBe(1);
      expect(ex.pulleys.filter((p) => p.type === 'fead-tensioner').length).toBe(1);
    });
  });

  test('gergi dışındaki her kasnağın x/y ve çapı var', () => {
    veFeadExampleKeys().forEach((k) => {
      veFeadExampleOf(k).pulleys.forEach((p) => {
        expect(p.data.od).toBeGreaterThan(0);
        if (p.type === 'fead-tensioner') {
          // Merkez HER ZAMAN gerekli; pivot ya girilir ya da kol açısından
          // türetilir — ikisinden biri olmak zorunda.
          expect(p.data.cenX).toBeDefined();
          expect(p.data.pivotX !== undefined || p.data.armMeanDeg !== undefined).toBe(true);
        } else {
          expect(Number.isFinite(p.data.x)).toBe(true);
          expect(Number.isFinite(p.data.y)).toBe(true);
        }
      });
    });
  });

  test('örnek tipleri componentDefs\'te GERÇEKTEN tanımlı', () => {
    veFeadExampleKeys().forEach((k) => {
      const pack = veFeadExampleNodes(k);
      pack.nodes.forEach((n) => {
        expect(componentDefs[n.type]).toBeDefined();
      });
    });
  });

  test('veFeadExampleNodes çağrılar arası PAYLAŞILAN nesne döndürmez', () => {
    const a = veFeadExampleNodes('BMC_FEAD_2026');
    a.nodes[0].data.od = 999;
    const b = veFeadExampleNodes('BMC_FEAD_2026');
    expect(b.nodes[0].data.od).toBe(162);            // tanım kirlenmedi
  });

  test('bilinmeyen anahtar null döner (patlamaz)', () => {
    expect(veFeadExampleOf('YOK')).toBeNull();
    expect(veFeadExampleNodes('YOK')).toBeNull();
  });
});

// ════════════════════════════════════════════════════════════════════════════
//  SERVİS FAKTÖRÜ HÜKMÜ
// ════════════════════════════════════════════════════════════════════════════
// Motor Künyesi kartı "servis faktörü kayma emniyeti için istenen alt sınır
// olarak sonuçta karşılaştırılır" diyor. Bu söz karşılanmazsa panel bir şey
// vaat edip başka şey yapıyor demektir — eşik eskiden 1.3'te SABİTTİ.
describe('servis faktörü kayma emniyetiyle karşılaştırılır', () => {
  const fead = (() => {
    const g = {};
    return g;
  })();

  test('sayfadaki 1.3 örnekte kayıtlı', () => {
    expect(veFeadExampleOf('BMC_FEAD_2026').solver.serviceFact).toBe(1.3);
  });

  test('çözümde her duty noktasının kayma emniyeti hesaplanıyor', () => {
    const { pack, build } = kur();
    const sv = pack.nodes.find((n) => n.type === 'fead-solver');
    const R = veFeadAnalyze(build, { rows: veFeadDutyRows(sv), cylinders: 6 });
    expect(R.ok).toBe(true);
    R.analysis.duty.forEach((d) => {
      expect(Array.isArray(d.slip)).toBe(true);
      expect(d.slip.length).toBeGreaterThan(0);
      d.slip.forEach((s) => expect(Number.isFinite(s.SF)).toBe(true));
    });
  });
});

// ════════════════════════════════════════════════════════════════════════════
//  TASARIM GERGİNLİĞİ ↔ YAY DENGESİ (ikinci sessiz kanal)
// ════════════════════════════════════════════════════════════════════════════
// designTensionN gerilme zincirinin ankrajı; gergi kasnağının taşıyabileceği
// gerginlik ise yay dengesinden ZATEN belli. Çekirdek ikisini karşılaştırmıyor:
// zinciri girilen sayıdan kurar. Uyuşmazlık TÜM gerilmeleri ve hubloadları
// kaydırır ama kayma emniyetini (bir ORAN) değiştirmez — yani tabloya bakarak
// da anlaşılmaz. Uyarı bu boşluğu kapatıyor.
// ════════════════════════════════════════════════════════════════════════════
//  TASARIM GERGİNLİĞİ TÜRETİLİR — ARTIK BİR GİRDİ DEĞİL
// ════════════════════════════════════════════════════════════════════════════
// Bu blok eskiden "girilen değer ↔ yay dengesi" karşılaştırmasını ve uyuşmazlık
// uyarısını sınıyordu. Alan kaldırıldı: karşılaştırılacak ikinci bir sayı yok,
// çünkü tasarım gerginliği bağımsız bir veri değil — gergi kolunun taşıdığı
// gerginlik geometri + yay künyesinden zaten belirli:
//
//     T = M(θ)/(dL/dθ),  M = M₀ + k·θ,  dL/dθ = a·sinβ·2sin(φ/2)
//
// ÖLÇÜLDÜ (10 Gates raporu): girilen ↔ türeyen farkı en çok %0.12, RMS %0.08 —
// tamamı yuvarlama. Türetilmiş ankrajla 2095 değerlik kapı geçiyor
// (çalışma %0.328 → %0.391, eşik %0.5).
describe('tasarım gerginliği YAY DENGESİNDEN türetilir', () => {
  test('örnek tasarım gerginliği TAŞIMIYOR — sorulmuyor', () => {
    expect(veFeadExampleOf('BMC_FEAD_2026').solver.designTensionN).toBeUndefined();
  });

  test('türetilen değer çekirdeğe ANKRAJ olarak yazılıyor', () => {
    const { build } = kur();
    expect(build.warnings).toEqual([]);
    // Bu sistemde 22,87 Nm / 0,6990 mm/° = 571 N. (Gergi künyesi Gates
    // raporunun "Tensioner Data" bloğundan geldiğinden beri; sayfanın
    // TÜRETİLMİŞ pivotuyla 650 N çıkıyordu ve Gates'in 544 N'undan %19,5
    // yukarıdaydı. Kalan %5 kayış künyesinden — bkz. yay momenti testi.)
    expect(build.springTensionN).toBeCloseTo(532, 0);
    expect(build.sys.designTensionN).toBeCloseTo(build.springTensionN, 9);
    expect(build.cfg.designTensionN).toBeCloseTo(build.springTensionN, 9);
  });

  test('KURULUŞU: T = M/(dL/dθ) — üç çarpan da türev', () => {
    const { build } = kur();
    const st = F.tensionerState(build.sys, F.meanRel(build.sys));
    // take-up = a·sinβ·2sin(φ/2), mm/° cinsinden
    const a = build.sys.tensioner.armLength;
    const beklenenTakeup = a * Math.sin(st.betaDeg * Math.PI / 180)
      * 2 * Math.sin(st.wrapDeg * Math.PI / 180 / 2) * (Math.PI / 180);
    expect(st.takeupMmPerDeg).toBeCloseTo(beklenenTakeup, 6);
    expect(st.tensionN).toBeCloseTo(st.springNm / (st.takeupMmPerDeg / 1000 * (180 / Math.PI)), 6);
    expect(st.tensionN).toBeCloseTo(build.sys.designTensionN, 9);
  });

  test('kullanıcı ARTIK bu sayıyı ezemez — girilen alan yok sayılır', () => {
    // Eski kayıtlarda designTensionN duruyor olabilir; okunmamalı.
    const pack = veFeadExampleNodes('BMC_FEAD_2026');
    pack.nodes.find((n) => n.type === 'fead-solver').data.designTensionN = 400;
    pack.nodes.forEach((n) => { n.def = componentDefs[n.type]; });
    const build = veFeadBuildSystem(pack.nodes, pack.connections);
    expect(build.ok).toBe(true);
    expect(build.sys.designTensionN).toBeCloseTo(532, 0);   // 400 DEĞİL
    expect(build.warnings).toEqual([]);                     // uyuşmazlık diye bir şey kalmadı
  });

  // Eskiden bu sınıfın tehlikesi şuydu: kayma emniyeti bir ORAN olduğu için
  // yanlış ankraj tablodan fark edilmiyordu. Artık ankraj kullanıcıdan
  // gelmediği için sınıf tamamen kapandı — testi bunu belgeliyor.
  test('ankraj artık kullanıcıdan gelmediği için sessiz kayma sınıfı kapandı', () => {
    const coz = (dt) => {
      const pack = veFeadExampleNodes('BMC_FEAD_2026');
      const sv = pack.nodes.find((n) => n.type === 'fead-solver');
      if (dt != null) sv.data.designTensionN = dt;
      pack.nodes.forEach((n) => { n.def = componentDefs[n.type]; });
      const b = veFeadBuildSystem(pack.nodes, pack.connections);
      const R = veFeadAnalyze(b, { rows: veFeadDutyRows(sv), cylinders: 6 });
      return R.analysis.duty[0].perPulley.map((p) => p.exitTensionN);
    };
    // Eskiden 400 girmek BÜTÜN gerilmeleri 250 N kaydırıyordu; artık hiçbir şey.
    expect(coz(400)).toEqual(coz(null));
  });

  // KAYIŞ SIĞMAZSA ARTIK "ÇÖZÜM YOK" DEĞİL — sözleşme değişti.
  //
  // Eskiden erişilemeyen bir kayış boyu meanRel'i çözülemez yapıyor, ankraj
  // yazılamıyor ve model gerilme üretemiyordu. Kullanıcı bildirimi (2026-08-25):
  // *"modelin çözülemez olduğu bir küme olmaması gerekiyor"*. Artık kol
  // gerginin NOMİNAL açısına alınıyor, ankraj oradan türüyor ve asıl cevap
  // veriliyor: bu yerleşim hangi kayışı istiyor.
  test('erişilemeyen kayış boyu ÇÖZÜLÜYOR ve gereken boyu söylüyor', () => {
    const pack = veFeadExampleNodes('BMC_FEAD_2026');
    pack.nodes.forEach((n) => { n.def = componentDefs[n.type]; });
    pack.nodes.find((n) => n.type === 'fead-belt').data.effLength = 1000;
    const b = veFeadBuildSystem(pack.nodes, pack.connections);

    expect(b.ok).toBe(true);
    const al = b.workPoint.atLimit;
    expect(al).not.toBeNull();
    expect(al.resolvedAt).toBe('nominalArm');
    expect(b.warnings.join(' ')).toMatch(/700[.,]4 mm KISA/);

    // Ankraj YİNE türetiliyor — çalışma noktası fiziksel olduğu için.
    expect(b.sys.designTensionN).toBeGreaterThan(0);
    expect(b.sys.designTensionN).toBeLessThan(5000);

    // Ve gereken boy, sayfanın kendi kayışını (1715 mm) geri veriyor.
    expect(al.suggestedBeltMm).toBeCloseTo(SAYFA.beltEffMm, 0);
  });

  // TÜRETME YİNE DE BAŞARISIZ OLABİLİR: yay ÖLÜyse (ön yük 0, katsayı 0)
  // moment sıfırdır, dolayısıyla gerginlik de sıfırdır ve ankraj YOKTUR.
  // Sessiz geçmek en kötü hâl olurdu: model "çözüldü" görünür, gerilme
  // tablosu ise boş/çöker.
  test('ölü yayda ankraj türetilemiyor ve SESSİZ kalınmıyor', () => {
    const pack = veFeadExampleNodes('BMC_FEAD_2026');
    pack.nodes.forEach((n) => { n.def = componentDefs[n.type]; });
    const ten = pack.nodes.find((n) => n.type === 'fead-tensioner');
    ten.data.angleMode = 'direct';
    ten.data.freeAngleDeg = 3.6;
    ten.data.preload = 0;
    ten.data.kArm = 0;
    delete ten.data.meanLoad;

    const b = veFeadBuildSystem(pack.nodes, pack.connections);
    // Geometri hâlâ çizilebilir olduğu için ok kalır (kayış yolu kartı çalışsın)
    expect(b.ok).toBe(true);
    expect(b.sys.designTensionN).toBeUndefined();
    expect(b.warnings.join(' ')).toMatch(/türetilemedi/);
    // ve çekirdek gerilme istendiğinde kendi açık hatasını verir
    expect(() => F.spanTensions(b.sys, { engineRpm: 1000, loadsKw: {} }))
      .toThrow(/designTensionN veya slackN gerekli/);
    // hata çevirisi de artık "girilmedi" DEMİYOR
    expect(veFeadTranslateError('FEADCore: designTensionN veya slackN gerekli'))
      .toMatch(/türetilemedi/);
  });
});
