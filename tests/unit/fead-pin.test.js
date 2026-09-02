/**
 * fead-pin.test.js — KOL AÇISININ İMALAT KARŞILIĞI: KONUM PİMİ
 *
 * Kullanıcı bir gergi parça çizimi gönderdi (2026-08-29): *"Genelde hemen
 * hemen tüm otomatik gergilerin görünümü böyle. Yani teknik resimleri bu."*
 * Çizim iki şeyi birden kapatıyor:
 *
 *   1) MODELİN AÇIK BIRAKTIĞI SORU — gövdenin montaj cıvatası kolun dönme
 *      ekseniyle eşeksenli mi? Çizimde gövdenin merkezî deliği kolun dönme
 *      ekseniyle eşmerkezli, yani MFSim'in "girilen koordinat = pivot"
 *      varsayımı artık ÖLÇÜLMÜŞ (bkz. CLAUDE.md, eski "ÖLÇÜLMEDİ" maddesi).
 *   2) YENİ BİR SONUÇ — zarf bir açı SEÇİYOR (θ*), ama atölyeye gidecek
 *      talimat "gövdeyi 236,1°'ye kur" değildir. Gövdeyi merkezî cıvata
 *      TUTAR (saati belirlemez); saati bir KONUM PİMİ sabitler. Seçimin
 *      imalat karşılığı pim deliğinin yeridir.
 *
 * ÜÇ SESSİZ HATA SINIFI VE KAPILARI:
 *
 *   • Ofsetin İŞARETİ — pim açısı θ* − 113° yerine θ* + 113° yazılırsa sayı
 *     yine makul görünür (0…360 arası bir açı) ve hiçbir şey patlamaz;
 *     yalnız delik 226° yanlış yere açılır. Kapı çizimin KENDİ sayısını
 *     çıpalıyor: 344° → 231,00°.
 *   • KOD SIZMASI — bir künyeden başka bir künyeye geçince eski parça kodu
 *     kalırsa, yeni gerginin pimi ESKİ parçanın çizimiyle hesaplanır. Aynı
 *     sınıf: sayı çıkar, uyarı çıkmaz.
 *   • UYDURMA — çizimi olmayan parçaya sayı yazmak. Kütüphanenin kendi
 *     kuralı (doğrulanamayan dört AG00976 kaydı `part` taşımıyor) burada da
 *     geçerli: `ok:false` + sebep.
 */
const M = require('../../js/fead-model.js');
const F = require('../../js/fead-core.js');
const T = require('../../js/fead-tensioners.js');
const RP = require('../../js/cp-fead-report.js');
Object.keys(T).forEach((k) => { global[k] = T[k]; });

const stubs = stubGlobals();
document.body.innerHTML = '<div id="ve-canvas"></div>';
global.nodes = [];
global.connections = [];
eval(loadSource('components.js'));
global.FEADCore = F;
Object.keys(M).forEach((k) => { global[k] = M[k]; });
const fead = require('../../js/cp-fead.js');
Object.keys(fead).forEach((k) => { global[k] = fead[k]; });

beforeEach(() => { resetStubs(stubs); global.nodes = []; global.connections = []; });

/* AG00976 örneğini kanvasa kur. Örneğin gergi koordinatı avara merkezi
   (−161,97 / 91,29) — raporun Layout Data satırı; montaj konumu ondan türer. */
function ornek(patch) {
  const pack = M.veFeadExampleNodes('AG00976_GATES_2025');
  pack.nodes.forEach((n) => { n.def = componentDefs[n.type]; });
  const ten = pack.nodes.find((n) => n.type === 'fead-tensioner');
  if (patch) patch(ten.data);
  global.nodes = pack.nodes; global.connections = pack.connections;
  return { pack, ten };
}
function kanvasKur(opt) {
  const o = opt || {};
  const { pack, ten } = ornek((td) => {
    if (o.part !== undefined) { if (o.part) td.tenPart = o.part; else delete td.tenPart; }
    else td.tenPart = 'E9843';
  });
  return { pack, ten, build: M.veFeadBuildSystem(pack.nodes, pack.connections) };
}

/* ═══════════════════════════════════════════════════════════════════════════
   1 · ÇİZİMİN KENDİ ARİTMETİĞİ — künye çizimle BİREBİR tutmalı
   ═══════════════════════════════════════════════════════════════════════════ */
describe('parça çizimi ↔ künye', () => {
  test('E9843 pim künyesi çizimin basılı ölçülerinden çıkıyor', () => {
    const p = T.veFeadTenPin('E9843');
    expect(p).toBeTruthy();
    // r = √(19,51² + 24,09²) — çizimin iki basılı dik ölçüsü
    expect(p.rMm).toBeCloseTo(Math.hypot(19.51, 24.09), 2);
    // pim mutlak = 180° + 51° (üçüncü bölge), kol çalışma = 360° − 16° = 344°
    expect(p.offsetDeg).toBeCloseTo((180 + 51) - 344, 2);
    expect(p.src).toMatch(/E9843/);
  });

  test('ÇİZİMİN KENDİ SAYISI: kol 344° → pim 231,00°', () => {
    const a = T.veFeadTenPinAngle('E9843', 344);
    expect(a.angleDeg).toBeCloseTo(231.00, 2);
  });

  test('basılı 51° iki dik ölçüyle 0,01° içinde tutuyor', () => {
    expect(Math.atan2(24.09, 19.51) * 180 / Math.PI).toBeCloseTo(51, 1);
  });

  test('çizimin "28° FREEARM-MEAN" satırı yay künyesini BAĞIMSIZ doğruluyor', () => {
    // (M_çalışma − M₀)/k — çizimden değil, tedarikçi raporunun künyesinden
    const rec = T.veFeadTensionerOf('AG0868-8PK');
    const rel = (rec.meanNm - rec.preloadNm) / rec.rateNm;
    expect(rel).toBeCloseTo(28, 0);       // iki bağımsız kaynak, aynı sayı
    expect(Math.abs(rel - 28)).toBeLessThan(0.2);
  });

  test('açı 0…360 bandına katlanıyor (negatif θ* de geçerli)', () => {
    expect(T.veFeadTenPinAngle('E9843', -10.90).angleDeg).toBeCloseTo(236.10, 2);
    expect(T.veFeadTenPinAngle('E9843', 700).angleDeg).toBeCloseTo(227.00, 2);
    for (let a = -720; a <= 720; a += 37) {
      const v = T.veFeadTenPinAngle('E9843', a).angleDeg;
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(360);
    }
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   2 · UYDURULMUYOR — sayı yoksa SEBEP var
   ═══════════════════════════════════════════════════════════════════════════ */
describe('pim künyesi UYDURULMUYOR', () => {
  test('çizimi olmayan parça null döner (T38624 / T38665 / T38519)', () => {
    ['T38624', 'T38665', 'T38519'].forEach((k) => {
      expect(T.veFeadTenPin(k)).toBeNull();
      expect(T.veFeadTenPinAngle(k, 344)).toBeNull();
    });
  });

  test('kütüphanenin her parça kodu ya çizimli ya da AÇIKÇA çizimsiz', () => {
    // Kod uydurmamanın ikinci yüzü: pim tablosunda kütüphanede OLMAYAN bir
    // parça bulunmamalı — öyle bir kayıt hiçbir zaman okunmayan ölü veridir.
    const kodlar = new Set(T.veFeadTensionerList().map((r) => r.part).filter(Boolean));
    Object.keys(T.VE_FEAD_TEN_PIN).forEach((k) => expect(kodlar.has(k)).toBe(true));
  });

  test('parça kodu OLMAYAN künyede plan ok:false ve sebebi yazılı', () => {
    const td = {};
    T.veFeadTensionerApply(td, T.veFeadTensionerOf('AG00976-1715'));
    expect(td.tenPart).toBeUndefined();               // doğrulanamayan kod YOK
    const p = M.veFeadPinPlan(td, 344);
    expect(p.ok).toBe(false);
    expect(p.reason).toMatch(/parça kodu yok/i);
    expect(Number.isFinite(p.angleDeg)).toBe(false);
  });

  test('kodu olup çizimi olmayan künyede sebep PARÇAYI adıyla söylüyor', () => {
    const td = {};
    T.veFeadTensionerApply(td, T.veFeadTensionerOf('AG00686'));
    expect(td.tenPart).toBe('T38624');
    const p = M.veFeadPinPlan(td, 344);
    expect(p.ok).toBe(false);
    expect(p.part).toBe('T38624');
    expect(p.reason).toMatch(/T38624/);
    expect(p.reason).toMatch(/UYDURULMAZ/);
  });

  test('kol açısı çözülmemişse sayı değil sebep döner', () => {
    const td = { tenPart: 'E9843' };
    const p = M.veFeadPinPlan(td, NaN);
    expect(p.ok).toBe(false);
    expect(p.rMm).toBe(31);                           // parça verisi yine dolu
    expect(p.reason).toMatch(/çözülmedi/i);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   3 · KOD SIZMASI — künye değişince eski parça kalmamalı
   ═══════════════════════════════════════════════════════════════════════════ */
describe('parça kodu KOPYA olarak gider, kodsuz künyede SİLİNİR', () => {
  test('kodlu künye uygulanınca kod kayda yazılıyor', () => {
    const td = {};
    T.veFeadTensionerApply(td, T.veFeadTensionerOf('AG0868-8PK'));
    expect(td.tenPart).toBe('E9843');
    expect(td.tenLib).toBe('AG0868-8PK');             // iz de duruyor
  });

  test('ÜSTÜNE kodsuz künye uygulanınca eski kod SİLİNİYOR', () => {
    const td = {};
    T.veFeadTensionerApply(td, T.veFeadTensionerOf('AG0868-8PK'));
    T.veFeadTensionerApply(td, T.veFeadTensionerOf('AG00976-1715'));
    expect(td.tenPart).toBeUndefined();
    expect(M.veFeadPinPlan(td, 344).ok).toBe(false);
  });

  test('kodlu → başka kodlu geçişte kod GÜNCELLENİYOR', () => {
    const td = {};
    T.veFeadTensionerApply(td, T.veFeadTensionerOf('AG0868-8PK'));   // E9843
    T.veFeadTensionerApply(td, T.veFeadTensionerOf('AG00686'));      // T38624
    expect(td.tenPart).toBe('T38624');
  });

  test('kütüphanenin 14 kaydının 14’ü de uygulandığında pim planı PATLAMIYOR', () => {
    T.veFeadTensionerList().forEach((rec) => {
      const td = {};
      T.veFeadTensionerApply(td, rec);
      const p = M.veFeadPinPlan(td, 344);
      expect(typeof p.ok).toBe('boolean');
      if (p.ok) { expect(p.part).toBe(rec.part); expect(Number.isFinite(p.angleDeg)).toBe(true); }
      else expect(p.reason.length).toBeGreaterThan(10);   // sessiz kalmıyor
    });
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   4 · UÇTAN UCA — zarf çözümü pim açısını gerçekten üretiyor
   ═══════════════════════════════════════════════════════════════════════════ */
describe('uçtan uca — kol açısı → pim', () => {
  test('AG00976 çözülüyor ve pim planı BUİLD’de duruyor', () => {
    const { build } = kanvasKur();
    expect(build.ok).toBe(true);
    expect(build.pin).toBeTruthy();
    expect(build.pin.ok).toBe(true);
    // (4.8): θ_pim = θ_kol + Δ_parça, 0…360 bandında
    const bekle = ((build.armAbsDeg - 113) % 360 + 360) % 360;
    expect(build.pin.angleDeg).toBeCloseTo(bekle, 6);
  });

  test('kol açısı değişince pim açısı AYNI KADAR kayıyor (ofset sabit)', () => {
    const { build } = kanvasKur();
    const d = 12.5;
    const p2 = M.veFeadPinPlan({ tenPart: 'E9843' }, build.armAbsDeg + d);
    const fark = ((p2.angleDeg - build.pin.angleDeg) % 360 + 360) % 360;
    expect(fark).toBeCloseTo(d, 6);
  });

  test('parça kodu olmayan modelde build.pin SESSİZ değil', () => {
    const { build } = kanvasKur({ part: '' });
    expect(build.ok).toBe(true);
    expect(build.pin.ok).toBe(false);
    expect(build.pin.reason.length).toBeGreaterThan(10);
  });

  test('BAŞKA bir kol açısında da pim planı kuruluyor', () => {
    // Kol açısı bir GİRDİ; pim planı ondan çıkıyor ve açı ne olursa olsun
    // aynı bağıntıyı izliyor.
    const { pack } = ornek((td) => { td.armMeanDeg = 344; td.tenPart = 'E9843'; });
    const b = M.veFeadBuildSystem(pack.nodes, pack.connections);
    expect(b.armAbsDeg).toBe(344);
    expect(b.pin.ok).toBe(true);
    expect(b.pin.angleDeg).toBeCloseTo(231.00, 6);   // 344 − 113
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   5 · YÜZEYLER — panel ve rapor ÜRETİLEN çıktıdan ölçülüyor
   ═══════════════════════════════════════════════════════════════════════════
   Bu modülün tekrar eden dersi: kapı ÜRETİCİYE değil ÜRETİLEN YÜZEYE bakmalı.
   Aşağıdaki testler `veFeadPinRows`/`_frPinBlock` çağırmıyor; panelin ve
   raporun kendi giriş noktalarını koşturup çıktıda pimi arıyor.
   ═══════════════════════════════════════════════════════════════════════════ */
describe('panel yüzeyi', () => {
  // Künye satırı ile açıklama notu AYRI şeyler ve ikisi de "Konum pimi"
  // yazıyor: yalnız metne bakan bir kapı, satırın düşürülmesini SESSİZCE
  // geçiriyor (mutasyonla ölçüldü). Kapı satırın KENDİ işaretine bakıyor.
  const SATIR = (et) => new RegExp('<span style="color:var\\(--text-muted\\);">'
    + et + '</span>');

  test('avara hareketi okuması pim yarıçapını, açısını ve ofsetini BASIYOR', () => {
    const { ten, build } = kanvasKur();
    const h = fead.veFeadArmReadout(ten);
    expect(h).toMatch(SATIR('Konum pimi · yarıçap'));
    expect(h).toMatch(SATIR('Konum pimi · AÇI \\(imalat\\)'));
    expect(h).toMatch(/31\.00 mm/);
    expect(h).toMatch(new RegExp(build.pin.angleDeg.toFixed(2).replace('.', '\\.')));
    expect(h).toMatch(/parça sabiti/);
    expect(h).not.toMatch(/undefined|NaN/);
  });

  test('pim künyesi yoksa panel SATIRI YİNE BASIYOR — sayı yerine sebep', () => {
    const { ten } = kanvasKur({ part: '' });
    const h = fead.veFeadArmReadout(ten);
    expect(h).toMatch(SATIR('Konum pimi'));       // satır DÜŞMÜYOR
    expect(h).toMatch(/uydurulmaz/i);             // sebep de yazılı
    expect(h).not.toMatch(/31\.00 mm/);           // ama sayı UYDURULMUYOR
  });

});

describe('rapor yüzeyi', () => {
  // §8.7'nin İKİ alt bloğu birden: montaj konumunun kuruluşu ve pim planı.
  // Kaçış kapısı ikisini de taramalı — ölçüldü, `\;` yutulması ilk kez
  // pivot bloğunun denkleminde çıktı (yalnız pim bloğuna bakan bir kapı onu
  // SESSİZCE geçiriyordu).
  function raporBolumu(opt) {
    const { build } = kanvasKur(opt);
    return RP._frPivotBlock({ build }) + RP._frPinBlock({ build });
  }

  test('§8.7 pim bloğu alt başlığını, denklemi ve sayıyı BASIYOR', () => {
    const h = raporBolumu();
    expect(h).toMatch(/konum pimi/i);
    expect(h).toMatch(/\\theta_\{\\text\{pim\}\}/);     // KaTeX denklemi
    expect(h).toMatch(/\\Delta_\{\\text\{parça\}\}/);
    expect(h).toMatch(/E9843/);
    expect(h).toMatch(/31,00/);
    expect(h).not.toMatch(/undefined|NaN|\[object/);
  });

  // ── LaTeX KAÇIŞI — JS dizgisinde TEK ters bölü SESSİZCE YUTULUR ────────
  // Ölçülmüş kusur (bu turda çıktı): kaynakta '\;' yazmak KaTeX'e ince boşluk
  // değil DÜZ NOKTALI VİRGÜL gönderiyor — denklem "θ_nom ;=; …" diye
  // basılıyordu. Aynı sınıf '\theta'yı SEKME + "heta" yapıyor. Belge yine
  // üretiliyor, hata çıkmıyor; yalnız denklem yalan söylüyor.
  //
  // Kapı ÜRETİLEN METNE bakıyor, kaynağa değil: her denklem bloğu içinde
  // kaçışı yenmiş bir komut kalıntısı aranıyor.
  test('denklemlerde YUTULMUŞ LaTeX kaçışı yok', () => {
    const h = raporBolumu();
    const eq = h.match(/\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]/g) || [];
    expect(eq.length).toBeGreaterThan(1);
    eq.forEach((e) => {
      // ters bölüsüz noktalı virgül = yenmiş \; (ince boşluk)
      expect(e.replace(/\\;/g, '')).not.toMatch(/;/);
      // SEKME = yenmiş \t (\theta, \text, \times …)
      expect(e).not.toMatch(/\t/);
      // çıplak komut gövdesi = ters bölüsü yenmiş komut
      ['theta', 'text', 'Delta', 'frac', 'circ', 'big', 'sin', 'cos']
        .forEach((k) => expect(e.replace(new RegExp('\\\\' + k, 'g'), ''))
          .not.toMatch(new RegExp('(^|[^A-Za-z\\\\])' + k)));
    });
  });

  test('paragraf içi \\( … \\) satır içi matematiği de sağlam', () => {
    const h = raporBolumu();
    (h.match(/\\\([\s\S]*?\\\)/g) || []).forEach((e) => {
      expect(e).not.toMatch(/\t/);
      expect(e.replace(/\\(theta|text|Delta|circ)/g, '')).not.toMatch(/theta|text|Delta|circ/);
    });
  });

  test('cıvata ekseni = kol dönme ekseni AÇIKÇA yazılı (artık ÖLÇÜLDÜ)', () => {
    expect(raporBolumu()).toMatch(/eşmerkezli/i);
  });

  test('pim künyesi yoksa rapor sayı yerine SEBEP basıyor', () => {
    const h = raporBolumu({ part: '' });
    expect(h).toMatch(/konum pimi/i);
    expect(h).toMatch(/uydurulmaz/i);
    expect(h).not.toMatch(/31,00 mm/);
  });

  test('teori belgesi (4.8)’i ve iki sembolü taşıyor', () => {
    const src = require('fs').readFileSync(
      require('path').join(__dirname, '../../tools/report-assets/fead-theory-source.html'), 'utf8');
    expect(src).toMatch(/\\theta_\{\\text\{pim\}\}/);
    expect(src).toMatch(/\(4\.8\)/);
    expect(src).toMatch(/\\Delta_\{\\text\{parça\}\}/);
    expect(src).toMatch(/konum pimi/i);
    // §4.1: cıvata/pivot eşeksenliliği artık ÖLÇÜLMÜŞ olarak yazılı
    expect(src).toMatch(/eşmerkezli/i);
  });

  test('şablon yeniden üretildi — teori metni js/fead-report-template.js’te', () => {
    const b64 = require('fs').readFileSync(
      require('path').join(__dirname, '../../js/fead-report-template.js'), 'utf8');
    const m = b64.match(/FEAD_REPORT_TEMPLATE_B64\s*=\s*"([^"]+)"/);
    expect(m).toBeTruthy();
    const html = Buffer.from(m[1], 'base64').toString('utf8');
    expect(html).toMatch(/konum pimi/i);
    expect(html).toMatch(/\(4\.8\)/);
  });
});
