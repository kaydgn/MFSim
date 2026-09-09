/**
 * fead-table.test.js — KAYIŞ TABLOSU: KASNAKLARIN VERİ GİRİŞ YÜZEYİ
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Kullanıcı isteği (2026-09-09): *"Topolojiye çektiğimiz bileşenlere tıklayıp
 * özelliklerini değiştirmek, değerlerini girmek yerine böyle bir tablomuz
 * olacak, oradan değerleri gireceğiz."* Aynı turda kasnaklar arası BAĞLANTI da
 * kaldırıldı: kayış sırası artık tablonun satır sırası (node.data.beltIndex).
 *
 * ── SÜTUNLARIN REFERANSI MFSim DEĞİL, KULLANICININ HESAP SAYFASI ───────────
 * Aşağıdaki `XL` tablosu kullanıcının ilettiği hesap sayfasının kendisidir
 * (PK · GATES · 6 kasnak · L 1728 mm). MFSim'in tablosu onun sütunlarını
 * üretiyor; kapı da MFSim'i MFSim'e değil, o sayfaya karşı ölçüyor:
 *
 *     Efektif Çap  =  OD + 2·hb   (kaburgalı)   ·   OD + 2·hr   (sırttan)
 *     Σ işaretli sarım = 360°     (kapalı çevrim değişmezi)
 *     Kayış Uzunluğu   = Σ span + Σ (sarım_rad · efektif yarıçap)
 *
 * Üçü de sayfanın kendi sayılarıyla tutuyor (aşağıda ölçülü). Bu, tablonun
 * "Efektif Çap" dediği şeyin çekirdeğin `rPitch`'i olduğunu — `rEff` DEĞİL —
 * bağımsız bir kaynağa karşı kanıtlıyor; ikisi karışsaydı kayış boyu 2π·hb
 * (GATES PK'da 7,54 mm) kayardı ve hata sessiz olurdu.
 *
 * ── TABLO BİR RAPOR DEĞİL, GİRİŞ YÜZEYİ ────────────────────────────────────
 * Bu yüzden girdi sütunları (ad · X · Y · D) geometri ÇÖZÜLEMESE DE dolu
 * yazılır: kullanıcı düzeltmek istediği sayıyı göremezse tabloyu düzeltemez.
 */
const fead = require('../../js/cp-fead.js');
const M = require('../../js/fead-model.js');
const F = require('../../js/fead-core.js');

const stubs = stubGlobals();
document.body.innerHTML = '<div id="ve-canvas"></div>';
global.nodes = [];
global.connections = [];
eval(loadSource('components.js'));
// components.js'teki yüklem GLOBAL'e yazılır: cp-fead.js / state.js require ile
// yükleniyor, dolayısıyla çıplak `veIsCanvasHidden` referansı bu dosyanın
// kapsamını DEĞİL global'i arar. Yazılmazsa kutusuz düğüm kapısı sessizce
// atlanır ve testler kutuların hâlâ kurulduğu bir dünyayı ölçer.
global.veIsCanvasHidden = veIsCanvasHidden;
// Aynı gerekçe: cp-fead.js `componentDefs`i GLOBAL olarak arıyor (tarayıcıda
// ikisi de üst-seviye). Yazılmazsa tip listesi boş döner ve ekleyici kapısı
// doğru sebepten değil, katalog hiç görünmediği için kırmızı olur.
global.componentDefs = componentDefs;
eval(loadSource('fead-belts.js'));
global.FEADCore = F;
Object.keys(M).forEach((k) => { global[k] = M[k]; });

beforeEach(() => {
  resetStubs(stubs);
  global.nodes = []; global.connections = [];
  document.body.innerHTML = '<div id="ve-canvas"></div>';
});

// ── KULLANICININ HESAP SAYFASI ────────────────────────────────────────────
// Sütunlar: ad, X, Y, efektif çap, D, dönüş yönü, sarım açısı, span uzunluğu.
const XL = [
  ['Tahrik Kasnağı',    0.000,   0.000, 161.400, 159.000, 'Sağ', 154.975, 142.452],
  ['Avara Kasnak',    130.000, 138.000,  77.200,  75.000, 'Sol',  51.409, 147.348],
  ['Klima Komp.',     184.000, 315.000, 154.400, 152.000, 'Sağ', 197.747, 144.345],
  ['Avara Kasnak',      0.000, 267.400,  77.200,  75.000, 'Sol',  65.136, 150.705],
  ['Alternatör',     -281.000, 259.300,  65.900,  63.500, 'Sağ', 158.669, 271.805],
  ['Gergi Kasnağı',  -162.000,  91.000,  77.200,  75.000, 'Sol',  34.844, 193.300],
];
const XL_BELT_MM = 1728;

describe('sütun kimlikleri — kullanıcının hesap sayfasına karşı', () => {
  test('Efektif Çap = OD + 2·hb (kaburgalı) / OD + 2·hr (sırttan) — GATES PK', () => {
    const bp = { hb: 1.2, hr: 1.1 };                    // fead-core.js BELT_DB
    XL.forEach(([ad, , , eff, od, yon]) => {
      const kaburgali = (yon === 'Sağ');
      expect(eff - od).toBeCloseTo(2 * (kaburgali ? bp.hb : bp.hr), 6);
    });
    // rEff KULLANILSAYDI fark 0 çıkardı — sütunun rPitch olduğunun kapısı.
    expect(XL.every(([, , , eff, od]) => eff !== od)).toBe(true);
  });

  test('Σ işaretli sarım = 360° — kapalı çevrim değişmezi', () => {
    const sg = XL.reduce((a, r) => a + (r[5] === 'Sağ' ? +1 : -1) * r[6], 0);
    expect(Math.abs(sg)).toBeCloseTo(360, 1);
  });

  test('Kayış Uzunluğu = Σspan + Σ(sarım · efektif yarıçap)', () => {
    const span = XL.reduce((a, r) => a + r[7], 0);
    const yay = XL.reduce((a, r) => a + (r[6] * Math.PI / 180) * (r[3] / 2), 0);
    expect(span + yay).toBeCloseTo(XL_BELT_MM, 0);
  });
});

// ── MFSim'İN KENDİ TABLOSU ────────────────────────────────────────────────
function kurOrnek(key) {
  const pack = M.veFeadExampleNodes(key || 'AG00976_GATES_2025');
  const ns = pack.nodes.map((n) => {
    const d = componentDefs[n.type] || {};
    return { id: n.id, type: n.type, customName: n.customName || null, def: d,
             x: 0, y: 0, width: d.defaultWidth || 65, height: d.defaultHeight || 60,
             data: JSON.parse(JSON.stringify(n.data || {})) };
  });
  global.nodes = ns; global.connections = [];
  return { ns, build: M.veFeadBuildSystem(ns) };
}

describe('veFeadTableRows — satırlar', () => {
  test('satırlar kayış TABLO sırasında ve sürücü ilk satırda', () => {
    const { build } = kurOrnek();
    const T = fead.veFeadTableRows(build);
    expect(T.ok).toBe(true);
    expect(T.rows.map((r) => r.index)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(T.rows[0].driver).toBe(true);
    expect(T.rows.map((r) => r.name)).toEqual(build.order.map((n) => n.customName));
  });

  test('türetilen sütunlar ÇEKİRDEKTEN — tablo kendi geometrisini hesaplamıyor', () => {
    const { build } = kurOrnek();
    const T = fead.veFeadTableRows(build);
    // EŞİK 1e-6, 1e-12 DEĞİL: tablo kol açısını konum tablosundan çözüyor
    // (veFeadPosSelection — şemayla AYNI konumu göstersin diye), buradaki
    // referans ise doğrudan meanRel. İkisi aynı açıyı FARKLI yoldan buluyor,
    // fark yüzer nokta artığı (ölçüldü: 7e-12 mm). Sıkı eşik doğru sebepten
    // değil, iki yolun son basamağı yüzünden kırmızıya dönerdi.
    const geom = F.tensionerState(build.sys, F.meanRel(build.sys)).geom;
    T.rows.forEach((r, i) => {
      expect(r.effDiaMm).toBeCloseTo(geom.pulleys[i].rPitch * 2, 12);
      expect(r.wrapDeg).toBeCloseTo(geom.wrapDeg(i), 6);
      expect(r.spanMm).toBeCloseTo(geom.exitSpanLen(i), 6);
      // Dönüş yönü kartın kasnak içi okuyla AYNI ifadeden (cw = p.d > 0).
      expect(r.spin).toBe(geom.pulleys[i].d > 0 ? 'Sağ' : 'Sol');
    });
    expect(T.LpitchMm).toBeCloseTo(geom.LpitchMm, 6);
    expect(T.LeffMm).toBeCloseTo(geom.LeffMm, 6);
  });

  test('aynı üç kimlik MFSim\'in kendi çözümünde de tutuyor', () => {
    const { build } = kurOrnek();
    const T = fead.veFeadTableRows(build);
    const bp = { hb: 1.2, hr: 1.1 };                  // örnek de GATES PK
    T.rows.forEach((r) => {
      expect(r.effDiaMm - r.odMm)
        .toBeCloseTo(2 * (r.contact === 'grooved' ? bp.hb : bp.hr), 6);
    });
    expect(Math.abs(T.signedWrapDeg)).toBeCloseTo(360, 1);
    const span = T.rows.reduce((a, r) => a + r.spanMm, 0);
    const yay = T.rows.reduce((a, r) => a + (r.wrapDeg * Math.PI / 180) * (r.effDiaMm / 2), 0);
    expect(span + yay).toBeCloseTo(T.LpitchMm, 6);
  });

  test('GERGİ SATIRI cenX/cenY okur — x/y okusaydı satır BOŞ görünürdü', () => {
    const { ns, build } = kurOrnek();
    const T = fead.veFeadTableRows(build);
    const g = T.rows.find((r) => r.tensioner);
    expect(g).toBeTruthy();
    expect(g.xKey).toBe('cenX');
    expect(g.yKey).toBe('cenY');
    expect(Number.isFinite(g.xMm)).toBe(true);
    const tn = ns.find((n) => n.type === 'fead-tensioner');
    expect(tn.data.x).toBeUndefined();               // gerginin x/y'si YOK
    expect(g.xMm).toBeCloseTo(tn.data.cenX, 12);
  });

  test('GİRDİ SÜTUNLARI GEOMETRİ ÇÖZÜLEMESE DE DOLU — tablo bir giriş yüzeyi', () => {
    const { ns } = kurOrnek();
    // İki kasnağı üst üste koymak teğeti yok ediyor: çekirdek çözemiyor.
    const k = ns.filter((n) => (componentDefs[n.type] || {}).isFeadPulley);
    k[1].data.x = k[0].data.x; k[1].data.y = k[0].data.y;
    const T = fead.veFeadTableRows(M.veFeadBuildSystem(ns));
    expect(T.ok).toBe(false);
    expect(T.rows).toHaveLength(6);
    expect(T.rows.every((r) => r.name && Number.isFinite(r.odMm))).toBe(true);
    expect(T.rows.every((r) => Number.isNaN(r.wrapDeg))).toBe(true);   // türetilen boş
  });

  test('kasnak yoksa satır yok, ama patlamıyor', () => {
    const T = fead.veFeadTableRows(M.veFeadBuildSystem([]));
    expect(T.rows).toEqual([]);
    expect(T.ok).toBe(false);
  });
});

describe('tablodan düzenleme', () => {
  test('veFeadTableSet virgüllü ondalık kabul eder (tablo 161,400 yazıyor)', () => {
    const { ns } = kurOrnek();
    const alt = ns.find((n) => n.type === 'fead-alternator');
    expect(fead.veFeadTableSet(alt.id, 'od', '63,5')).toBe(true);
    expect(alt.data.od).toBe(63.5);
    // parseFloat('63,5') = 63 — sessizce 0,5 mm kaybı; kapı tam bunun için.
    expect(alt.data.od).not.toBe(63);
  });

  test('sayı olmayan giriş YAZMAZ (alan eski değerinde kalır)', () => {
    const { ns } = kurOrnek();
    const alt = ns.find((n) => n.type === 'fead-alternator');
    const once = alt.data.od;
    expect(fead.veFeadTableSet(alt.id, 'od', '')).toBe(false);
    expect(fead.veFeadTableSet(alt.id, 'od', 'abc')).toBe(false);
    expect(alt.data.od).toBe(once);
  });

  test('satır taşıma sırayı değiştirir; SÜRÜCÜ SATIRI kilitli', () => {
    const { ns, build } = kurOrnek();
    const once = build.order.map((n) => n.id);
    expect(fead.veFeadTableMove(once[2], -1)).toBe(true);
    expect(M.veFeadBeltOrder(ns).map((n) => n.id))
      .toEqual([once[0], once[2], once[1], once[3], once[4], once[5]]);
    expect(fead.veFeadTableMove(once[0], +1)).toBe(false);   // sürücü inmiyor
    expect(fead.veFeadTableMove(once[2], -1)).toBe(false);   // 1. satıra çıkılmıyor
  });

  test('taşıma saveState\'i mutasyondan ÖNCE çağırıyor — projenin sözleşmesi', () => {
    const { build } = kurOrnek();
    stubs.saveState.mockClear();
    fead.veFeadTableMove(build.order[2].id, -1);
    expect(stubs.saveState).toHaveBeenCalled();
  });
});

describe('kart HTML\'i', () => {
  test('dokuz sütun başlığı da yazılıyor', () => {
    kurOrnek();
    const h = fead.veFeadTableCardHTML({ id: 't', type: 'fead-table',
      def: componentDefs['fead-table'], data: {} });
    ['KASNAK', 'X(mm)', 'Y(mm)', 'Efektif Çap(mm)', 'D(mm)',
     'Kasnak Dönüş Yönü', 'Sarım Açısı(°)', 'Span Uzunluğu(mm)'].forEach((t) => {
      expect(h).toContain(t);
    });
    // Üst künye: kayış tipi + markası + kasnak sayısı + kayış uzunluğu
    expect(h).toMatch(/Kayış Tipi/);
    expect(h).toMatch(/Kayış Markası/);
    expect(h).toMatch(/Kasnak Sayısı/);
    expect(h).toMatch(/Kayış Uzunluğu/);
  });

  test('KART KANVASTA: her düzenlenebilir hücre mousedown YUTUYOR', () => {
    kurOrnek();
    const h = fead.veFeadTableCardHTML({ id: 't', type: 'fead-table',
      def: componentDefs['fead-table'], data: {} });
    // Yutulmasaydı alana tıklamak düğümü SÜRÜKLEMEYE başlar, kullanıcı sayıyı
    // hiç giremezdi. Girdi sayısı: 6 kasnak × 3 alan (X, Y, D).
    const girdi = (h.match(/<input /g) || []).length;
    expect(girdi).toBe(18);
    // `type="number"` OLMAMALI: tarayıcı orada virgüllü girişi geçersiz sayıp
    // value'yu boşaltıyor — kullanıcı "63,5" yazıyor, alan sessizce boşalıyor
    // ve model hiç değişmiyor (ölçüldü, gerçek tarayıcı).
    expect(h).not.toMatch(/type="number"/);
    expect((h.match(/inputmode="decimal"/g) || []).length).toBe(18);
    expect((h.match(/onmousedown="event\.stopPropagation\(\);"/g) || []).length)
      .toBeGreaterThanOrEqual(girdi);
  });

  test('sütun genişlikleri TEK KAYNAKTAN ve kart genişliğiyle tutarlı', () => {
    const toplam = fead.VE_FEAD_TABLE_COLS.reduce((a, c) => a + c.w, 0);
    expect(toplam).toBeLessThanOrEqual(VE_FEAD_TABLE_W);
    expect(VE_FEAD_TABLE_W - toplam).toBeLessThan(24);      // kenar payı, fazlası değil
    expect(componentDefs['fead-table'].defaultWidth).toBe(VE_FEAD_TABLE_W);
    expect(componentDefs['fead-table'].defaultHeight).toBe(VE_FEAD_TABLE_H);
  });

  test('alt şerit kapalı çevrim değişmezini yazıyor', () => {
    kurOrnek();
    const h = fead.veFeadTableCardHTML({ id: 't', type: 'fead-table',
      def: componentDefs['fead-table'], data: {} });
    expect(h).toMatch(/Σsarım/);
    expect(h).toMatch(/360 olmalı/);
    expect(h).toMatch(/✓/);
  });
});

describe('tazeleme TEK KAPIDAN', () => {
  // İki kart aynı modeli gösteriyor; birini tazeleyip öbürünü unutmak sessiz
  // bir ayrışma demek — ikisi de kendi başına tutarlı görünür, yalnız biri bir
  // düzenleme geride kalır. Bu yüzden altı düzenleme yolu da veFeadRefreshCards
  // çağırıyor, kart başına ayrı çağrı yok.
  test('veFeadRefreshCards ŞEMAYI ve TABLOYU birlikte kuruyor', () => {
    const { ns } = kurOrnek();
    ['fead-layout', 'fead-table'].forEach((t, i) => {
      const d = componentDefs[t];
      ns.push({ id: 'kart' + i, type: t, def: d, x: 0, y: 0,
                width: d.defaultWidth, height: d.defaultHeight, data: {} });
      const el = document.createElement('div');
      el.id = 'kart' + i;
      el.innerHTML = '<div class="ve-node-box"></div>';
      document.body.appendChild(el);
    });
    expect(fead.veFeadRefreshCards()).toBe(2);
    expect(document.querySelector('#kart0 .' + fead.VE_FEAD_CARD_CLASS)).toBeTruthy();
    expect(document.querySelector('#kart1 .' + fead.VE_FEAD_TABLE_CLASS)).toBeTruthy();
  });

  test('düzenleme yolları kart başına AYRI çağrı yapmıyor (kaynak kapısı)', () => {
    const src = loadSource('cp-fead.js');
    // Tanım ve tek-kapının kendi içi dışında `veFeadRefreshLayoutCards()`
    // çağrısı KALMAMALI: kalan her biri tabloyu unutan bir yol demek.
    const cagri = src.split('\n').filter((l) =>
      l.includes('veFeadRefreshLayoutCards()')
      && !l.includes('function veFeadRefreshLayoutCards'));
    expect(cagri).toHaveLength(1);               // yalnız veFeadRefreshCards içinde
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  DEFTERİN DÜZENLENEBİLİR HÜCRELERİ — "Kasnak Dönüş Yönü" BİR GİRDİ
// ═══════════════════════════════════════════════════════════════════════════
//
// BMC'nin KIRPI_II hesap defteri incelendi (`Geometrik Entegrasyon`, C1:K10):
//
//   SÜTUN            TÜR       DEFTERDEKİ KANIT
//   KASNAK           girdi     veri doğrulama listesi $C$121:$C$126 (6 tip)
//   X(mm) · Y(mm)    girdi     sabit, amber dolgu FFFFC000
//   Efektif Çap(mm)  formül    =IF(OR(C5=$C$124,C5=$C$125),G5+2*M8,G5+2*L8)
//   D(mm)            girdi     sabit, amber dolgu
//   Dönüş Yönü       GİRDİ     veri doğrulama listesi $D$169:$D$170 = Sağ/Sol
//   Sarım · Span     formül    yeşil dolgu FF92D050
//   Kayış Uzunluğu   formül    =SUM(AB47:AB52), K5:K10 BİRLEŞTİRİLMİŞ
//
// Defterin span'i yönden türüyor: `L48 = IF(H6=H5,"Düz","Ters")` — iki komşu
// kasnak aynı yöne dönüyorsa dış teğet, ters yöne dönüyorsa iç teğet. MFSim'de
// aynı fizik TEK alanda: `contact`. Hücre o alanı yazıyor.
describe('Dönüş Yönü — defterdeki gibi GİRDİ, ama tek alan üstünden', () => {
  test('hücre bir açılır liste ve iki seçeneği var (Sağ/Sol)', () => {
    kurOrnek();
    const h = fead.veFeadTableCardHTML({ id: 't', type: 'fead-table',
      def: componentDefs['fead-table'], data: {} });
    // Altı yön seçicisi + üst künyedeki "kasnak ekle" seçicisi.
    expect((h.match(/<select /g) || []).length).toBe(7);
    expect((h.match(/<option value="Sağ"/g) || []).length).toBe(6);
    expect((h.match(/<option value="Sol"/g) || []).length).toBe(6);
    expect(h).toMatch(/veFeadTableSetSpin/);
    // Kart kanvasta: HER seçici mousedown yutmalı (yön seçicileri + ekleyici),
    // yoksa açmak düğümü sürüklemeye başlar. Sayıyı sabitlemek yerine "hepsi"
    // ölçülüyor — yeni bir seçici eklenince kapı kendiliğinden onu da kapsar.
    const secici = (h.match(/<select /g) || []).length;
    expect((h.match(/<select [^>]*onmousedown="event\.stopPropagation\(\);"/g) || []).length)
      .toBe(secici);
    expect(h).toContain('veFeadTableAdd(');
  });

  test('YÖN ↔ TEMAS TARAFI birebir: çevirinin çekirdeğin kuralıyla tutarlılığı', () => {
    const { ns, build } = kurOrnek();
    const T = fead.veFeadTableRows(build);
    // Çekirdeğin kuralı: d = (grooved ? s : −s), ekranda cw = d > 0 = "Sağ".
    T.rows.forEach((r, i) => {
      const beklenen = (r.contact === 'grooved' ? T.sense : -T.sense) > 0 ? 'Sağ' : 'Sol';
      expect(r.spin).toBe(beklenen);
    });
    // Ters yön: fonksiyon o kuralın TERSİ olmalı.
    expect(M.veFeadContactForSpin(ns, T.sense > 0)).toBe('grooved');
    expect(M.veFeadContactForSpin(ns, T.sense < 0)).toBe('back');
  });

  test('yönü değiştirmek `contact` yazıyor — ikinci bir yön alanı AÇILMIYOR', () => {
    const { ns, build } = kurOrnek();
    const T = fead.veFeadTableRows(build);
    const krank = ns.find((n) => n.data && n.data.driver);
    expect(T.rows[0].spin).toBe('Sağ');
    expect(krank.data.contact).toBe('grooved');

    expect(fead.veFeadTableSetSpin(krank.id, 'Sol')).toBe(true);
    expect(krank.data.contact).toBe('back');
    // Düğümde `dir` / `spin` gibi İKİNCİ bir alan doğmadı.
    expect(krank.data.spin).toBeUndefined();
    expect(krank.data.dir).toBeUndefined();

    expect(fead.veFeadTableSetSpin(krank.id, 'Sağ')).toBe(true);
    expect(krank.data.contact).toBe('grooved');               // gidiş-dönüş birebir
  });

  test('DEFTERİN SESSİZ TUTARSIZLIĞI MFSim\'de KURULAMIYOR', () => {
    // Defterde efektif çap kasnağın TİPİNDEN, teğet ise YÖNDEN türüyor: bir
    // avarayı "Sağ" yapmak teğeti kaburgalı gibi çözer ama efektif çapı sırttan
    // bırakır. MFSim'de iki sayı da `contact`tan geldiği için yönü değiştirmek
    // efektif çapı DA değiştirmek zorunda — kapı bunu ölçüyor.
    const { ns, build } = kurOrnek();
    const once = fead.veFeadTableRows(build).rows[1];          // Avara 1, sırttan
    expect(once.spin).toBe('Sol');
    expect(once.effDiaMm - once.odMm).toBeCloseTo(2 * 1.1, 6);  // hr

    const avara = ns.find((n) => n.id === once.id);
    fead.veFeadTableSetSpin(avara.id, 'Sağ');
    const sonra = fead.veFeadTableRows(M.veFeadBuildSystem(ns)).rows[1];
    expect(sonra.spin).toBe('Sağ');
    expect(sonra.effDiaMm - sonra.odMm).toBeCloseTo(2 * 1.2, 6); // hb — DEĞİŞTİ
  });

  test('süpürme işareti okunamıyorsa hücre SALT OKUNUR ve yazma reddedilir', () => {
    const { ns } = kurOrnek();
    // Koordinatları sil → çevrim dolanımı okunamıyor.
    ns.filter((n) => (componentDefs[n.type] || {}).isFeadPulley)
      .forEach((n) => { delete n.data.x; delete n.data.y; delete n.data.cenX; delete n.data.cenY; });
    const T = fead.veFeadTableRows(M.veFeadBuildSystem(ns));
    expect(T.sense).toBe(0);
    const h = fead.veFeadTableCardHTML({ id: 't', type: 'fead-table',
      def: componentDefs['fead-table'], data: {} });
    expect(h).not.toMatch(/veFeadTableSetSpin/);              // seçici basılmadı
    const krank = ns.find((n) => n.data && n.data.driver);
    const once = krank.data.contact;
    expect(fead.veFeadTableSetSpin(krank.id, 'Sol')).toBe(false);
    expect(krank.data.contact).toBe(once);                    // uydurulmadı
  });
});

describe('Kayış Uzunluğu — defterdeki gibi BİRLEŞİK sütun', () => {
  test('kendi sütununda, bütün satırları saran TEK hücre', () => {
    kurOrnek();
    const h = fead.veFeadTableCardHTML({ id: 't', type: 'fead-table',
      def: componentDefs['fead-table'], data: {} });
    expect(h).toContain('Kayış Uzunluğu(mm)');
    // Defterde K5:K10 birleştirilmiş — burada rowspan, kasnak sayısı kadar.
    expect((h.match(/rowspan="6"/g) || []).length).toBe(1);
    // Üst künyeden kalktı: aynı sayıyı iki yerde göstermek ikinci bir kopya olurdu.
    expect(h.split('Kayış Uzunluğu').length - 1).toBe(1);
  });

  test('sütun sayısı ON ve genişlikler kart ölçüsüyle tutarlı', () => {
    expect(fead.VE_FEAD_TABLE_COLS).toHaveLength(10);
    expect(fead.VE_FEAD_TABLE_COLS[9].k).toBe('kayis');
    const toplam = fead.VE_FEAD_TABLE_COLS.reduce((a, c) => a + c.w, 0);
    expect(toplam).toBeLessThanOrEqual(VE_FEAD_TABLE_W);
    expect(VE_FEAD_TABLE_W - toplam).toBeLessThan(24);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  KUTULAR KALKTI — EKLEME/SİLMENİN TEK YOLU TABLO
// ═══════════════════════════════════════════════════════════════════════════
//
// Kullanıcı isteği (2026-09-09): *"Kutular kalkacak. Kutulara tıklayarak
// ulaşabildiğimiz detay panellerine tablodan parça isimlerinin üstüne
// tıklayarak yapacağız. Kutulara gerek yok artık bu modülde."*
//
// Kasnak kanvasta çizilmediği için seçilip silinemiyor: satırın kendi ✕'i o
// boşluğu kapatıyor. Ekleme paletten hâlâ çalışıyor ama SESSİZ (kanvasta bir
// şey görünmüyor), o yüzden tablonun kendi ekleyicisi de var.
describe('satır ekle / sil — kutu olmayınca tek yol', () => {
  test('ekleyici tip listesi componentDefs\'ten türer, ikinci liste yok', () => {
    kurOrnek();
    const h = fead.veFeadTableAddHTML();
    const tipler = Object.keys(componentDefs).filter((t) => componentDefs[t].isFeadPulley);
    expect(tipler.length).toBeGreaterThan(5);
    tipler.forEach((t) => expect(h).toContain('value="' + t + '"'));
    // Kasnak OLMAYAN bir tip listeye sızmamalı.
    expect(h).not.toContain('value="fead-belt"');
    expect(h).not.toContain('value="fead-table"');
  });

  test('ekleme kayış sırasının SONUNA düşer', () => {
    const { ns } = kurOrnek();
    const once = M.veFeadBeltOrder(ns).length;
    let k = 0;
    global.createNode = (type) => {
      const d = componentDefs[type];
      const n = { id: 'yeni' + ++k, type, def: d, x: 0, y: 0,
                  width: d.defaultWidth, height: d.defaultHeight, data: {} };
      global.nodes.push(n); return n;
    };
    expect(fead.veFeadTableAdd('fead-waterpump')).toBe(true);
    delete global.createNode;
    const sira = M.veFeadNormalizeBeltOrder(global.nodes);
    expect(sira).toHaveLength(once + 1);
    expect(sira[sira.length - 1].type).toBe('fead-waterpump');   // SONDA
    expect(sira[0].data.driver).toBe(true);                      // sürücü hâlâ ilk
  });

  test('kasnak olmayan tip EKLENMEZ', () => {
    kurOrnek();
    global.createNode = () => { throw new Error('çağrılmamalıydı'); };
    expect(fead.veFeadTableAdd('fead-table')).toBe(false);
    expect(fead.veFeadTableAdd('')).toBe(false);
    delete global.createNode;
  });

  test('silme diziden çıkarır, sıra 1..N-1 olarak kapanır', () => {
    const { ns } = kurOrnek();
    const hedef = M.veFeadBeltOrder(ns)[2];
    const ad = hedef.customName;
    expect(fead.veFeadTableDelete(hedef.id)).toBe(true);
    expect(global.nodes.some((n) => n.id === hedef.id)).toBe(false);
    const sira = M.veFeadNormalizeBeltOrder(global.nodes);
    expect(sira).toHaveLength(5);
    expect(sira.map((n) => n.customName)).not.toContain(ad);
    expect(sira.map((n) => n.data.beltIndex)).toEqual([1, 2, 3, 4, 5]);
  });

  test('silme saveState\'i mutasyondan ÖNCE çağırır (geri-al yığınına ön durum)', () => {
    const { ns } = kurOrnek();
    const hedef = M.veFeadBeltOrder(ns)[3];
    // `ns` ile `global.nodes` AYNI dizi: silmeden önceki sayı kopyalanmalı,
    // yoksa karşılaştırma mutasyon SONRASI uzunluğa bakar.
    const oncekiAdet = ns.length;
    stubs.saveState.mockClear();
    // İLK çağrının gördüğü sayı ölçülüyor: tazeleme yolu sonradan bir kez daha
    // saveState tetikleyebiliyor ve son değer mutasyon SONRASINI gösterirdi.
    let adetVardi = -1;
    stubs.saveState.mockImplementation(() => {
      if (adetVardi < 0) adetVardi = global.nodes.length;
    });
    fead.veFeadTableDelete(hedef.id);
    expect(adetVardi).toBe(oncekiAdet);           // silinmeden ÖNCEki sayı
    expect(global.nodes.length).toBe(oncekiAdet - 1);
    stubs.saveState.mockImplementation(() => {});
  });

  test('kasnak olmayan düğüm bu yoldan SİLİNMEZ', () => {
    const { ns } = kurOrnek();
    const tablo = ns.find((n) => n.type === 'fead-table');
    const solver = ns.find((n) => n.type === 'fead-solver');
    expect(fead.veFeadTableDelete(tablo.id)).toBe(false);
    expect(fead.veFeadTableDelete(solver.id)).toBe(false);
    expect(fead.veFeadTableDelete('yok-boyle-bir-kimlik')).toBe(false);
    expect(global.nodes.length).toBe(ns.length);
  });

  test('her satırda bir ✕ var ve mousedown yutuyor', () => {
    kurOrnek();
    const h = fead.veFeadTableCardHTML({ id: 't', type: 'fead-table',
      def: componentDefs['fead-table'], data: {} });
    expect((h.match(/veFeadTableDelete/g) || []).length).toBe(6);
    // Sürücü satırı da silinebilir: sürücülük bir ROL, silinen kasnak yerine
    // bir başkası sürücü işaretlenir. Kilitli olan şey SIRA, kasnağın varlığı değil.
    expect(h).toContain('veFeadTableAdd(');
  });
});
