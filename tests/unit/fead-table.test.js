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
