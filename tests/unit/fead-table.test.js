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
 *
 * ── PAFTA (2026-09-26): TABLO KARTIN İÇİNDE ────────────────────────────────
 * Kullanıcı kararı (tasarım tezgâhı III → "A · Pafta"): Kayış Yolu kartı bir
 * Gates sayfası — çizim üstte, Layout Data altında — ve tablolu kart DİĞERİNDEN
 * GENİŞ. Çekmece (tuvalin altı) emekli. Buradaki kapılar paftanın üretilen
 * HTML'ini, kartın katmanını (ön ayar · düğme · genişlik), boy sabitlerinin
 * CSS'le birebirliğini ve kayıtlı projelerin göçünü tutar; gerçek tarayıcı
 * halkaları `fead-tablo.spec.js`te.
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
// node-resize.js'in `veNodeMinSize`i: en küçük ölçüyü TİPTEN okuyor, yani
// componentDefs global'e yazıldıktan SONRA yüklenmeli.
eval(loadSource('node-resize.js'));
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

// components.js test kapsamında çalışıyor; eski ölçüyü yükseltirken kartın
// tablosunu cp-fead.js'ten soruyor (tarayıcıda ikisi de üst-seviye).
global.veFeadKartVarsayilanW = fead.veFeadKartVarsayilanW;
// Ters yön de aynı: cp-fead.js eski varsayılan ölçüleri components.js'in
// listesinden okuyor.
global.VE_FEAD_LAYOUT_LEGACY = VE_FEAD_LAYOUT_LEGACY;

// ── PAFTA'NIN ÜRETİLEN HTML'İ ─────────────────────────────────────────────
// Üretici kartın düğümünü alır (genişlik oradan); `null` kılavuzun sahnesi.
const paftaHTML = (n) => fead.veFeadTableCardHTML(n === undefined ? null : n);
const dom = (h) => { const k = document.createElement('div'); k.innerHTML = h; return k; };

describe('pafta HTML\'i', () => {
  // ── BAŞLIKLAR KISA, DEFTERİN ADI `title`DA ──────────────────────────────
  // Sütun başı dar olduğu için kısa ("Efektif Çap" → "Ø eff"); defterin adı
  // KAYBOLMAZ — tablonun varlık sebebi kullanıcının hesap sayfasıyla birebir
  // olması.
  test('sütun başları kısa, DEFTERİN ADI title\'da', () => {
    kurOrnek();
    const h = paftaHTML();
    const satirda = fead.VE_FEAD_TABLE_COLS.filter((c) => c.yer === 'gir' || c.yer === 'coz');
    expect(satirda.length).toBe(7);
    const k = dom(h);
    satirda.forEach((c) => {
      const th = k.querySelector('th.k-' + c.k);
      expect(th).toBeTruthy();
      expect(th.getAttribute('title').indexOf(c.t + (c.u ? ' (' + c.u + ')' : ''))).toBe(0);
      expect(th.textContent.indexOf(c.kt || c.t)).toBe(0);          // ekranda kısa ad
    });
    expect(h).not.toContain('X(mm)');
    // "mm" başlık şeridinde BİR KEZ (Gates: "Layout Data mm"), her sütunda değil;
    // mm dışı birim (°) sütununda.
    expect(k.querySelector('.ve-fead-pf-bas .ad').textContent).toBe('Layout Data · mm');
    expect(k.querySelector('th.k-sar .br').textContent).toBe('°');
    expect(k.querySelectorAll('th .br')).toHaveLength(1);
    // Kayış künyesi (salt okunur): profil · marka.
    expect(k.querySelector('.ve-fead-pf-bas .kunye').textContent).toBe('PK · GATES');
  });

  test('KART KANVASTA: her düzenlenebilir hücre mousedown YUTUYOR', () => {
    kurOrnek();
    const h = paftaHTML();
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
    // Her alan kimin hangi sütunu olduğunu SÖYLÜYOR (satırda etiket yok).
    expect((h.match(/aria-label="[^"]+ (X|Y|D)"/g) || []).length).toBe(18);
  });

  // GENİŞLİK SÜTUN LİSTESİNDEN TÜRÜYOR — `<colgroup>`ta VERİ olarak. KASNAK
  // sütunu artanı alır: varsayılan tablolu kartta sütunların toplamı + iki
  // kenar = kartın genişliği, yani ne boş şerit ne yatay kaydırma.
  test('sütun genişlikleri TEK KAYNAKTAN — KASNAK artanı alır', () => {
    kurOrnek();
    const k = dom(paftaHTML());
    const col = [...k.querySelectorAll('col')].map((c) => parseFloat(c.style.width));
    const sabit = fead.VE_FEAD_TABLE_COLS.reduce((a, c) => a + c.w, 0);
    expect(col).toHaveLength(fead.VE_FEAD_TABLE_COLS.length);
    // Kartın içi = genişlik − iki dolgu − iki KUTU KENARI (ölçüldü: kenar
    // sayılmayınca tablo 2 px taşıyor, yatay kaydırma çubuğu çıkıyordu).
    const P = fead.VE_FEAD_PF;
    expect(col.reduce((a, w) => a + w, 0) + 2 * (P.yan + P.kenar)).toBe(VE_FEAD_PAFTA_W);
    // KASNAK: tablolu kartın varsayılanında "Otomatik Gergi (T38519)" sığsın
    // (gerçek tarayıcıda ölçüldü: 640 px kartta kısaltmasız).
    const ad = parseFloat(k.querySelector('col.k-ad').style.width);
    expect(ad).toBe(VE_FEAD_PAFTA_W - 2 * (P.yan + P.kenar) - sabit);
    expect(ad).toBeGreaterThanOrEqual(190);
    // BASILDIĞI SIRA BÖLGE SIRASI: kimlik · girdi · çözüm · sil.
    expect([...k.querySelectorAll('col')].map((c) => c.className.slice(2)))
      .toEqual(['no', 'ad', 'x', 'y', 'od', 'yon', 'eff', 'sar', 'span', 'sil']);
    // DAR KART: KASNAK tabanında kalır, tablo kartı aşar (yatay kaydırma) —
    // sütun sessizce KAYBOLMAZ.
    const dar = dom(paftaHTML({ id: 'k', type: 'fead-layout', width: 440, height: 500, data: {} }));
    expect(parseFloat(dar.querySelector('col.k-ad').style.width)).toBe(fead.VE_FEAD_PF_AD_MIN);
    expect(dar.querySelectorAll('col')).toHaveLength(fead.VE_FEAD_TABLE_COLS.length);
  });

  // ÇEVRİM DENETİMİ TABLODA TEKRARLANMAZ: kartın rozeti (sağ üst) aynı hükmü
  // kartın KENDİ kol konumuyla veriyor. Burada yalnız tabloya ait hüküm var.
  test('ÇEVRİM DENETİMİ TEKRARLANMAZ — kartın rozeti söylüyor', () => {
    const { build } = kurOrnek();
    const h = paftaHTML();
    expect(h).not.toMatch(/Çevrim kapalı|Çevrim AÇIK|Σsarım|Σ toplam|Efektif boy/);
    // Hüküm rozette ve AYNI modelden.
    const rozet = fead.veFeadLayoutCardStrip(build, 'mean');
    expect(rozet).toContain('Σsarım 360.0°');
    expect(rozet).toContain('ve-fead-kan-durum ok');
  });

  // ÇÖZÜLEMEYEN MODEL: satırlar yine DOLU (giriş yüzeyi), türetilen hücreler
  // uydurma bir sayı basmaz.
  test('çevrim ÇÖZÜLEMİYORSA satırlar dolu, türetilenler —', () => {
    const { ns } = kurOrnek();
    ns.filter((n) => n.id === 'ex-ALT')[0].data.od = 5000;   // yerleşimi yutuyor
    global.nodes = ns;
    const k = dom(paftaHTML());
    expect(k.querySelectorAll('input')).toHaveLength(18);
    const cz = [...k.querySelectorAll('td.cz')].map((td) => td.textContent);
    expect(cz).toHaveLength(18);
    expect(cz.every((t) => t === '—')).toBe(true);
  });

  // ── GİRDİ/ÇÖZÜM AYRIMI: YÜZEY + TEK KIL ÇİZGİ ──────────────────────────
  // KAPI SABİT BİR LİSTE DEĞİL, BİR KURAL: değeri çözümden gelen her sütun
  // `coz` bölgesinde, elle yazılan hiçbir sütun orada değil. Liste yazılsaydı
  // yeni bir türetilen sütun sessizce girdi bölgesine düşerdi.
  test('ÇÖZÜM SÜTUNLARI tam olarak ÇÖZÜMDEN GELEN alanlar', () => {
    kurOrnek();
    const k = dom(paftaHTML());
    const C = fead.VE_FEAD_TABLE_COLS;
    C.forEach((c) => {
      expect(['kim', 'gir', 'coz', 'son']).toContain(c.yer);
      if (c.coz) expect(c.yer).toBe('coz');
      else expect(c.yer).not.toBe('coz');
    });
    const tr = k.querySelector('tr[data-ve-node]');
    const cz = tr.querySelectorAll('td.cz');
    expect(cz).toHaveLength(C.filter((c) => c.coz).length);
    cz.forEach((td) => expect(td.querySelectorAll('input, button, select')).toHaveLength(0));
    // Girdi hücrelerinde çözüm sınıfı YOK.
    ['x', 'y', 'od', 'yon'].forEach((c) => expect(tr.querySelector('td.k-' + c).classList.contains('cz')).toBe(false));
    // Tek kıl çizgi: YALNIZ ilk çözüm sütununda, başlıkta ve satırda.
    expect(k.querySelectorAll('th.ayr')).toHaveLength(1);
    expect(k.querySelector('th.ayr').classList.contains('k-eff')).toBe(true);
    expect(tr.querySelectorAll('td.ayr')).toHaveLength(1);
  });

  // ── BASAMAK: TEK — model tam hassasiyette ────────────────────────────────
  test('türetilen sayılar TEK BASAMAK basılıyor, model tam hassasiyette', () => {
    const { build } = kurOrnek();
    const T = fead.veFeadTableRows(build);
    const k = dom(paftaHTML());
    const hucre = [...k.querySelectorAll('td.cz')].map((el) => el.textContent);
    expect(hucre).toHaveLength(18);                // 6 satır × (eff, sarım, span)
    hucre.forEach((t) => expect(t).toMatch(/^-?\d+\.\d$/));
    expect(hucre[0]).toBe(T.rows[0].effDiaMm.toFixed(1));
    expect(hucre[1]).toBe(T.rows[0].wrapDeg.toFixed(1));
    expect(hucre[2]).toBe(T.rows[0].spanMm.toFixed(1));
  });

  // ── EKLEYİCİ BAŞLIK ŞERİDİNDE ─────────────────────────────────────────────
  test('EKLEYİCİ başlık şeridinde — boş tablo onu gösteriyor', () => {
    kurOrnek();
    const k = dom(paftaHTML());
    expect(k.querySelector('.ve-fead-pf-bas .ve-fead-tbl-add')).toBeTruthy();
    expect(k.querySelectorAll('.ve-fead-tbl-add')).toHaveLength(1);
    // Boş tablonun tavsiyesi o yeri gösteriyor ("aşağıdaki" artık bayat olurdu).
    global.nodes = []; global.connections = [];
    const b = paftaHTML();
    expect(b).toContain('Yukarıdaki');
    expect(b).not.toContain('Aşağıdaki');
  });

  // ── SÜRÜCÜ SATIRIN KENDİSİNDE ─────────────────────────────────────────
  test('SÜRÜCÜ satırın SINIFINDA da işaretli — seçim sınıfıyla birlikte', () => {
    const { ns } = kurOrnek();
    const trs = [...dom(paftaHTML()).querySelectorAll('tr[data-ve-node]')];
    expect(trs.filter((t) => t.classList.contains('drv'))).toHaveLength(1);
    expect(trs[0].classList.contains('drv')).toBe(true);
    // İKİ KATMAN AYRI: sürücülük kalıcı bir ROL, seçim geçici bir DURUM.
    const src = ns.filter((n) => n.data && n.data.driver)[0];
    global.selectedNodes = [src];
    const tr0 = dom(paftaHTML()).querySelector('tr[data-ve-node]');
    expect(tr0.classList.contains('drv')).toBe(true);
    expect(tr0.classList.contains('is-sel')).toBe(true);
    global.selectedNodes = [];
  });
});

// ── KARTIN KABUĞU: çizim + pafta, tek kapıdan tazelenir ────────────────────
// Kartı gerçek kuruluşuyla kurar: düğüm DOM'u + veFeadApplyLayoutCard.
function kurKart(ns, id, data, w) {
  const d = componentDefs['fead-layout'];
  const n = { id, type: 'fead-layout', def: d, x: 0, y: 0,
              width: w || d.defaultWidth, height: d.defaultHeight, data: data || {} };
  ns.push(n);
  const el = document.createElement('div');
  el.id = id;
  el.innerHTML = '<div class="ve-node-box"></div>';
  document.body.appendChild(el);
  return { n, el };
}
const kare = () => new Promise((r) => (typeof requestAnimationFrame === 'function'
  ? requestAnimationFrame(r) : setTimeout(r, 0)));

describe('tazeleme TEK KAPIDAN', () => {
  // Çizim ve tablo aynı modeli gösteriyor; birini tazeleyip öbürünü unutmak
  // sessiz bir ayrışma demek. Tek kapı (veFeadRefreshCards) ikisini de tazeler:
  // çizim anında, tablo bir sonraki karede (odak kuralı).
  test('veFeadRefreshCards ÇİZİMİ ve KARTIN TABLOSUNU birlikte tazeler', async () => {
    const { ns } = kurOrnek();
    const { el } = kurKart(ns, 'kart0');
    expect(fead.veFeadRefreshCards()).toBe(2);            // çizim + tablo
    expect(el.querySelector('.' + fead.VE_FEAD_CARD_CLASS + ' > .ve-fead-kanvas')).toBeTruthy();
    const paf = el.querySelector('.' + fead.VE_FEAD_CARD_CLASS + ' > .' + fead.VE_FEAD_PAFTA_CLASS);
    expect(paf).toBeTruthy();
    expect(paf.querySelectorAll('tr[data-ve-node]')).toHaveLength(6);
    const xAlani = () => [...el.querySelectorAll('.ve-fead-pafta input')]
      .find((i) => i.getAttribute('onchange') === "veFeadTableSet('ex-IDR1','x',this.value)");
    expect(xAlani().value).toBe('130.1');

    ns.find((n) => n.id === 'ex-IDR1').data.x = 140;
    fead.veFeadRefreshCards();
    await kare();
    expect(xAlani().value).toBe('140');
    // PAFTA KALICI: çizim yeniden kuruldu, pafta AYNI öğe (içi tazelendi).
    expect(el.querySelector('.ve-fead-pafta')).toBe(paf);
    document.body.innerHTML = '';
  });

  // ODAK KORUNUR — Sekme ile geçilen hücre sökülmez; YAZILMAKTA OLAN değer de
  // kaybolmaz (change ateşlenmeden bir tazeleme gelirse).
  test('ODAK KORUNUR: tazeleme sonrası aynı hücre odakta, yazılan metin yerinde', async () => {
    const { ns } = kurOrnek();
    const { el } = kurKart(ns, 'kart0');
    fead.veFeadRefreshCards();
    await kare();
    const sec = "veFeadTableSet('ex-ALT','y',this.value)";
    const bul = () => [...el.querySelectorAll('.ve-fead-pafta input')].find((i) => i.getAttribute('onchange') === sec);
    const eski = bul();
    eski.focus();
    eski.value = '26';                                    // yazılıyor, change yok
    expect(document.activeElement).toBe(eski);
    fead.veFeadRefreshCards();
    await kare();
    const yeni = bul();
    expect(yeni).not.toBe(eski);                          // hücre yeniden kuruldu…
    expect(document.activeElement).toBe(yeni);            // …odak onda
    expect(yeni.value).toBe('26');                        // …yazılan metin de
    document.body.innerHTML = '';
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

  // ÇİZİM HER KURULDUĞUNDA TABLO DA SIRAYA GİRER. saveState yalnız çizimi
  // tazeliyor (state.js); kartın kurulumu tablonun tazelemesini istemeseydi
  // saveState'ten geçen bir düzenleme çizimde görünür, tabloda görünmezdi.
  test('kart kurulumu tablonun tazelemesini de istiyor', async () => {
    const { ns } = kurOrnek();
    const { el, n } = kurKart(ns, 'kart0');
    fead.veFeadRefreshCards();
    await kare();
    ns.find((x) => x.id === 'ex-ALT').data.od = 59;
    fead.veFeadApplyLayoutCard(el, n);                    // YALNIZ çizim yolu
    await kare();
    const od = [...el.querySelectorAll('.ve-fead-pafta input')]
      .find((i) => i.getAttribute('onchange') === "veFeadTableSet('ex-ALT','od',this.value)");
    expect(od.value).toBe('59');
    document.body.innerHTML = '';
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
  // METİN DÜĞMESİ (Pafta, 2026-09-26): yön yazılı, tık ÖTEKİ yöne çevirir. İki
  // seçenek olduğu için bir tık tam olarak bir değişiklik. Seçenek SAYISI
  // ikiden çıkarsa karar geri alınır — kapı o yüzden sayıyı da ölçüyor.
  test('METİN DÜĞMESİ — yön yazılı, tık öteki yöne çevirir, liste YOK', () => {
    const { build } = kurOrnek();
    const T = fead.veFeadTableRows(build);
    const k = dom(paftaHTML());
    const d = [...k.querySelectorAll('button.ve-fead-pf-yon[data-ve="spin"]')];
    expect(d).toHaveLength(6);
    d.forEach((b, i) => {
      const yon = b.getAttribute('data-yon');
      expect(yon).toBe(T.rows[i].spin);
      expect(b.textContent).toBe(yon);                      // yön YAZILI
      const obur = (yon === 'Sağ') ? 'Sol' : 'Sağ';
      expect(b.getAttribute('onclick')).toBe("veFeadTableSetSpin('" + T.rows[i].id + "','" + obur + "')");
      expect(b.getAttribute('onmousedown')).toBe('event.stopPropagation();');
      // Ok ÇİZİM: eksik bir glif afordansı yok ederdi.
      expect(b.querySelector('svg.ok')).toBeTruthy();
    });
    expect(k.textContent).not.toMatch(/↻|↺|⟳|⟲/);
    // Satırlarda <select> YOK — geriye yalnız ekleyicininki.
    expect(k.querySelectorAll('select')).toHaveLength(1);
    expect(k.querySelector('select').classList.contains('ve-fead-tbl-add')).toBe(true);
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
    const h = paftaHTML();
    expect(h).not.toMatch(/veFeadTableSetSpin/);              // düğme basılmadı
    expect(dom(h).querySelectorAll('.ve-fead-pf-yon.bos')).toHaveLength(6);
    const krank = ns.find((n) => n.data && n.data.driver);
    const once = krank.data.contact;
    expect(fead.veFeadTableSetSpin(krank.id, 'Sol')).toBe(false);
    expect(krank.data.contact).toBe(once);                    // uydurulmadı
  });
});

// ── SÜTUN LİSTESİ ─────────────────────────────────────────────────────────
// KAYIŞ BOYU TABLODA YOK. Satıra değil çevrime ait (defterde K5:K10
// birleştirilmiş) ve kartın rozeti boyu zaten yazıyor ("L … mm"); Gates'in
// Layout Data tablosunda da yok.
describe('sütun listesi', () => {
  test('ON sütun — sonuncusu silme, kayış boyu listede yok', () => {
    expect(fead.VE_FEAD_TABLE_COLS).toHaveLength(10);
    expect(fead.VE_FEAD_TABLE_COLS[9].k).toBe('sil');
    expect(fead.VE_FEAD_TABLE_COLS.some((c) => c.k === 'kayis')).toBe(false);
    // SIRA DEFTERİN SIRASI (bölgeler basımda gruplar, listeyi değil).
    expect(fead.VE_FEAD_TABLE_COLS.map((c) => c.k))
      .toEqual(['no', 'ad', 'x', 'y', 'eff', 'od', 'yon', 'sar', 'span', 'sil']);
    // Boy kartın rozetinde, modelin kendi sayısıyla.
    const { build } = kurOrnek();
    const T = fead.veFeadTableRows(build);
    expect(fead.veFeadLayoutCardStrip(build, 'mean')).toContain('L ' + T.LeffMm.toFixed(1) + ' mm');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  KUTULAR KALKTI — EKLEME/SİLMENİN TEK YOLU TABLO (ve çizimdeki kayış)
// ═══════════════════════════════════════════════════════════════════════════
//
// Kullanıcı isteği (2026-09-09): *"Kutular kalkacak. Kutulara tıklayarak
// ulaşabildiğimiz detay panellerine tablodan parça isimlerinin üstüne
// tıklayarak yapacağız. Kutulara gerek yok artık bu modülde."*
describe('satır ekle / sil — kutu olmayınca tek yol', () => {
  test('ekleyici tip listesi componentDefs\'ten türer, ikinci liste yok', () => {
    kurOrnek();
    const h = fead.veFeadTableAddHTML();
    const tipler = Object.keys(componentDefs).filter((t) => componentDefs[t].isFeadPulley);
    expect(tipler.length).toBeGreaterThan(5);
    // GERGİ HARİÇ: örnekte zaten bir tane var ve çekirdek ikincisini kabul
    // etmiyor (aşağıdaki kapı). Listenin geri kalanı componentDefs'ten türer.
    tipler.filter((t) => !componentDefs[t].isFeadTensioner)
      .forEach((t) => expect(h).toContain('value="' + t + '"'));
    // Kasnak OLMAYAN bir tip listeye sızmamalı.
    expect(h).not.toContain('value="fead-belt"');
    expect(h).not.toContain('value="fead-layout"');
  });

  // GERGİ TEKİLDİR VE HER İKİ YÜZEYDE ÖYLE DAVRANIR (2026-09-22).
  test('GERGİ TEKİL: listede sunulmaz, eklenmez, silinmez', () => {
    const { ns } = kurOrnek();
    const ten = ns.find((n) => componentDefs[n.type].isFeadTensioner);
    expect(ten).toBeTruthy();

    // (1) Modelde gergi varken liste onu SUNMUYOR.
    expect(fead.veFeadTableAddHTML()).not.toContain('value="fead-tensioner"');

    // (2) Liste atlansa bile İŞLEV reddediyor — kapı iki katmanlı.
    global.createNode = () => { throw new Error('çağrılmamalıydı'); };
    expect(fead.veFeadTableAdd('fead-tensioner')).toBe(false);
    delete global.createNode;

    // (3) Silinmiyor ve model bozulmuyor.
    const once = global.nodes.length;
    expect(fead.veFeadTableDelete(ten.id)).toBe(false);
    expect(global.nodes.length).toBe(once);
    expect(global.nodes.some((n) => n.id === ten.id)).toBe(true);

    // (4) Ama BAŞKA bir kasnak hâlâ silinebiliyor: kilit her şeyi dondurmuyor.
    const alt = global.nodes.find((n) => n.type === 'fead-alternator');
    expect(fead.veFeadTableDelete(alt.id)).toBe(true);
    expect(global.nodes.some((n) => n.id === alt.id)).toBe(false);
  });

  // DAVRANIŞ 2026-09-22'DE DEĞİŞTİ: yeni kasnak gerginin ÖNÜNE düşer.
  test('ekleme OTOMATİK GERGİNİN ÖNÜNE düşer — döngü gergiyle bitmeye devam eder', () => {
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
    const son = sira[sira.length - 1];
    expect(componentDefs[son.type].isFeadTensioner).toBe(true);        // GERGİ SONDA
    expect(sira[sira.length - 2].type).toBe('fead-waterpump');         // yeni onun ÖNÜNDE
    expect(sira[0].data.driver).toBe(true);                            // sürücü hâlâ ilk
    expect(sira.map((n) => n.data.beltIndex))
      .toEqual(sira.map((_, i) => i + 1));
  });

  test('kasnak olmayan tip EKLENMEZ', () => {
    kurOrnek();
    global.createNode = () => { throw new Error('çağrılmamalıydı'); };
    expect(fead.veFeadTableAdd('fead-layout')).toBe(false);
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
    const oncekiAdet = ns.length;
    stubs.saveState.mockClear();
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
    const kanvas = ns.find((n) => n.type === 'fead-layout');
    const solver = ns.find((n) => n.type === 'fead-solver');
    expect(fead.veFeadTableDelete(kanvas.id)).toBe(false);
    expect(fead.veFeadTableDelete(solver.id)).toBe(false);
    expect(fead.veFeadTableDelete('yok-boyle-bir-kimlik')).toBe(false);
    expect(global.nodes.length).toBe(ns.length);
  });

  // GERGİNİN ✕'İ PASİF ve sebebini söylüyor — sihirbazın aynı satırı gibi.
  // Etkin görünüp hiçbir şey yapmayan (yalnız uyarı basan) bir düğme bu depoda
  // ölçülmüş bir kusur sınıfı.
  test('her satırda bir ✕; gerginin ✕\'i PASİF ve sebebi title\'da', () => {
    kurOrnek();
    const k = dom(paftaHTML());
    const del = [...k.querySelectorAll('button.ve-fead-tbl-del')];
    expect(del).toHaveLength(6);
    const pasif = del.filter((b) => b.disabled);
    expect(pasif).toHaveLength(1);
    expect(pasif[0].closest('tr').classList.contains('ten')).toBe(true);
    expect(pasif[0].getAttribute('title')).toMatch(/gergi silinemez/i);
    del.forEach((b) => expect(b.getAttribute('onmousedown')).toBe('event.stopPropagation();'));
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  GÖRÜNÜM CSS'TE — "DEMODE VE İLKEL"İN ASIL SEBEBİ TAŞIYICIYDI
// ═══════════════════════════════════════════════════════════════════════════
//
// Kullanıcı bildirimi (2026-09-09): *"'Kayış Tablosu' çok demode ve ilkel
// duruyor."* Tablo satır içi `style="…"` diziyordu ve o taşıyıcı DURUM İFADE
// EDEMEZ: `:hover`, `:focus` yazılamadığı için fare hangi satırdaysa, imleç
// hangi hücredeyse, hangi kasnağın paneli açıksa — üçü de görünmüyordu.
//
// İKİ KAPI BİRLİKTE ÇALIŞIR: JS tarafı hücrelerin satır içi renk YAZMADIĞINI,
// CSS tarafı o rengi veren kuralların VAR OLDUĞUNU tutuyor.
describe('görünüm CSS\'te, satır içinde değil', () => {
  const fs = require('fs');
  const path = require('path');
  const CSS = fs.readFileSync(path.join(__dirname, '../../css/styles.css'), 'utf8');
  const blok = () => CSS.slice(CSS.indexOf('.ve-fead-pafta{'), CSS.indexOf('/* ═══ KOMUTA PENCERESİ'));
  const kural = (sec) => {
    const i = CSS.indexOf(sec + '{');
    return i < 0 ? '' : CSS.slice(i, CSS.indexOf('}', i));
  };

  test('pafta HTML\'i satır içi RENK / ÇERÇEVE / YAZI yazmıyor', () => {
    kurOrnek();
    const h = paftaHTML();
    const stiller = (h.match(/style="[^"]*"/g) || []);
    // İZİNLİ TEK ŞEY: sütun genişliği (VERİ — tek kaynaktan geliyor).
    expect(stiller).toHaveLength(fead.VE_FEAD_TABLE_COLS.length);
    stiller.forEach((st) => expect(st).toMatch(/^style="width:\d+px"$/));
    expect(h).not.toMatch(/#3b82f6|#f59e0b|#0f1115|#ef4444|#22c55e/);
  });

  test('DURUM KURALLARI CSS\'te: fare · odak · seçili satır · oyuk sütun', () => {
    // Üçü de satır içi CSS'te YAZILAMAZ; tablonun donuk görünmesinin sebebi
    // buydu ve kapı tam olarak onların varlığını tutuyor.
    expect(CSS).toMatch(/\.ve-fead-pf-satir:hover > td,\s*\.ve-fead-pf-satir\.is-hov > td\{/);
    expect(CSS).toMatch(/\.ve-fead-pf-satir\.is-sel > td\{/);
    expect(CSS).toMatch(/\.ve-fead-tbl-in:hover\{/);
    expect(CSS).toMatch(/\.ve-fead-tbl-in:focus\{/);
    expect(CSS).toMatch(/\.ve-fead-pf-yon:hover\{/);
    expect(CSS).toMatch(/\.ve-fead-pf-yon:focus-visible\{/);
    // ÇÖZÜM SÜTUNLARI OYUK ZEMİNDE — panelin türetilen değeriyle AYNI jeton,
    // SOLUK MÜREKKEP DEĞİL (modül skill'i 14: asıl çıktı en zor okunan şeydi).
    expect(kural('.ve-fead-pf-t td.cz, .ve-fead-pf-t th.cz')).toMatch(/background:var\(--bg-tertiary\)/);
    expect(CSS).not.toMatch(/td\.cz\{[^}]*color:var\(--text-(muted|secondary)\)/);
    // SİLME DİNLENMEDE GÖRÜNMEZ, satıra gelince belirir.
    expect(kural('.ve-fead-tbl-del')).toMatch(/opacity:0;/);
    expect(CSS).toMatch(/\.ve-fead-pf-satir:hover \.ve-fead-tbl-del/);
    // SIRA OKLARI da öyle — ve klavye odağında geri geliyor.
    expect(kural('.ve-fead-pf-mv')).toMatch(/opacity:0;/);
    expect(CSS).toMatch(/\.ve-fead-pf-mv:focus-within\{/);
    // AD DÜĞMESİ: kabarma · basılı · paneli açık. Hücresi gölgeyi kırpmıyor.
    expect(CSS).toMatch(/\.ve-fead-tbl-name:hover\{[^}]*box-shadow/);
    expect(CSS).toMatch(/\.ve-fead-tbl-name:active\{/);
    expect(CSS).toMatch(/\.ve-fead-pf-satir\.is-sel \.ve-fead-tbl-name\{/);
    expect(kural('.ve-fead-pf-t td.k-ad')).toMatch(/overflow:visible/);
    // ZEBRA YOK — kıl çizgiler yeter; ikinci bir ton fare ve seçim vurgusunun
    // üstüne binerdi.
    expect(CSS).not.toMatch(/\.ve-fead-pf-satir:nth-child/);
    // Vurgular AKTİF AKSANDAN türer, sabit renkten değil.
    expect(blok()).toMatch(/var\(--accent-tint-/);
    expect(blok()).toMatch(/var\(--focus-ring\)/);
    expect(blok()).not.toMatch(/#[0-9a-fA-F]{6}/);
  });

  // ÖLÇÜ SABİTLERİ CSS'LE BİREBİR. Çizimin payı JS'te hesaplanıyor
  // (veFeadPaftaH); CSS başka bir sayı yazarsa çizim tablonun altına uzar ya
  // da aralarında boş bir şerit kalır — ikisi de sessiz.
  test('ÖLÇÜ SABİTLERİ CSS\'le BİREBİR — başlık · sütun başı · satır · pay · kenar', () => {
    const P = fead.VE_FEAD_PF;
    expect(kural('.ve-fead-pf-bas')).toMatch(new RegExp('height:' + P.bas + 'px'));
    expect(kural('.ve-fead-pf-bas')).toMatch(/box-sizing:border-box/);
    expect(kural('.ve-fead-pf-t th')).toMatch(new RegExp('height:' + P.sut + 'px'));
    expect(kural('.ve-fead-pf-t td')).toMatch(new RegExp('height:' + P.satir + 'px'));
    expect(kural('.ve-fead-pf-t td')).toMatch(/box-sizing:border-box/);
    expect(kural('.ve-fead-pf-bos > td')).toMatch(new RegExp('height:' + P.bos + 'px'));
    expect(kural('.ve-fead-pafta')).toMatch(new RegExp('padding:0 ' + P.yan + 'px ' + P.alt + 'px'));
    // Kutu kenarı: kartın kutusunun kenarlığı (sütun bütçesi ondan düşülüyor).
    const kutu = CSS.slice(CSS.indexOf('\n.ve-node-box{'), CSS.indexOf('}', CSS.indexOf('\n.ve-node-box{')));
    expect(kutu).toMatch(new RegExp('border:' + P.kenar + 'px solid'));
    // Çubuk bandı: tablonun alt kenarı CSS'te, çizimin payı JS'te — aynı sayı.
    expect(CSS).toMatch(new RegExp('\\.ve-fead-layout-card\\{ --fead-yuz-ust:' + fead.VE_FEAD_YUZ_UST + 'px; \\}'));
    // Tablo, panel ve titreşim şeridi TEK YERDEN hizalanıyor (kartın --fead-paf-h'i).
    expect(kural('.ve-fead-pafta')).toMatch(/height:var\(--fead-paf-h/);
    expect(kural('.ve-fead-pafta')).toMatch(/bottom:var\(--fead-yuz-ust/);
    expect(CSS).toMatch(/--fead-kat-alt:calc\(var\(--fead-yuz-ust, 50px\) \+ var\(--fead-paf-h, 0px\)\)/);
  });
});

describe('yeni yüzeyin işlevleri', () => {
  test('SEÇİLİ SATIR işaretli — tablo ile panel arasındaki tek bağ', () => {
    const { ns } = kurOrnek();
    const alt = ns.filter((n) => n.id === 'ex-ALT')[0];

    global.selectedNodes = [];
    expect(paftaHTML()).not.toContain('is-sel');

    // Adı tıklayıp paneli açtıktan sonra HANGİ satırın açık olduğu tabloda ve
    // çizimde yazılı; kutular kalktığı için başka yerde yazmıyor.
    global.selectedNodes = [alt];
    const k = dom(paftaHTML());
    expect([...k.querySelectorAll('tr.is-sel')].map((t) => t.getAttribute('data-ve-node'))).toEqual(['ex-ALT']);
    // Çok seçimde işaret YOK.
    global.selectedNodes = [alt, ns.filter((n) => n.id === 'ex-A_C')[0]];
    expect(paftaHTML()).not.toContain('is-sel');
    global.selectedNodes = [];
  });

  // ── SEÇİM DEĞİŞİNCE İŞARET TAZELENİR — ÖLÇÜLMÜŞ HATA ────────────────────
  // Gerçek tarayıcıda çıktı (AG00976): işaret DOĞRU satıra konuyordu ama seçim
  // değiştiğinde hiç tazelenmiyordu, çünkü tablo yalnız MODEL değişince yeniden
  // kuruluyor — panel açmak modeli değiştirmez.
  test('SEÇİM DEĞİŞİNCE işaret DOM\'da eşitlenir — tablo yeniden KURULMADAN', () => {
    const { ns } = kurOrnek();
    document.body.innerHTML = '<div class="' + fead.VE_FEAD_PAFTA_CLASS + '">' + paftaHTML() + '</div>';
    const isaretli = () => [...document.querySelectorAll('tr.is-sel')]
      .map((tr) => tr.getAttribute('data-ve-node'));
    expect(isaretli()).toEqual([]);

    global.selectedNodes = [ns.filter((n) => n.id === 'ex-A_C')[0]];
    expect(fead.veFeadMarkSelectedRow()).toBe(1);
    expect(isaretli()).toEqual(['ex-A_C']);

    // İkinci seçim öncekini SÖNDÜRÜR — iki satır birden işaretli kalamaz.
    global.selectedNodes = [ns.filter((n) => n.id === 'ex-TEN')[0]];
    expect(fead.veFeadMarkSelectedRow()).toBe(2);
    expect(isaretli()).toEqual(['ex-TEN']);

    global.selectedNodes = [];
    expect(fead.veFeadMarkSelectedRow()).toBe(1);
    expect(isaretli()).toEqual([]);
    // Değişiklik yoksa DOM'a HİÇ yazılmaz.
    expect(fead.veFeadMarkSelectedRow()).toBe(0);
  });

  test('SEÇİM KAPISI cp-core\'un iki merkezinden de çağrılıyor', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '../../js/cp-core.js'), 'utf8');
    const govde = (ad) => {
      const i = src.indexOf('function ' + ad + '(');
      return src.slice(i, src.indexOf('\n}', i));
    };
    expect(govde('addToSelection')).toContain('veFeadMarkSelectedRow()');
    expect(govde('clearSelection')).toContain('veFeadMarkSelectedRow()');
  });

  // ── AD HÜCRESİ: "BURASI BİR PENCERE AÇAR" ─────────────────────────────
  test('ad bir DÜĞME ve üstünde "pencere açılır" simgesi var', () => {
    kurOrnek();
    const h = paftaHTML();
    expect((h.match(/class="ve-fead-tbl-name"/g) || []).length).toBe(6);
    // SİMGE ÇİZİM, YAZI KARAKTERİ DEĞİL.
    expect((h.match(/<svg class="ac"/g) || []).length).toBe(6);
    expect(h).not.toMatch(/⧉|⤢|↗/);
    expect(typeof fead.VE_FEAD_TBL_OPEN_ICON).toBe('string');
    expect(h.split(fead.VE_FEAD_TBL_OPEN_ICON).length - 1).toBe(6);
    // Düğme KASNAK hücresinde, alanların arasında değil ("düğme dolu / alan
    // boş" ayrımı — modül skill'i 14).
    const k = dom(h);
    k.querySelectorAll('td.k-ad').forEach((td) => {
      expect(td.querySelector('.ve-fead-tbl-name')).toBeTruthy();
      expect(td.querySelector('input')).toBeNull();
    });
  });

  test('SÜRÜCÜ satırı numarasında işaretli ve ▲▼ pasif', () => {
    kurOrnek();
    const k = dom(paftaHTML());
    // Numara çizimdeki balonla aynı dil: sürücü DOLU, gergi YEŞİL HALKA.
    expect(k.querySelectorAll('.ve-fead-pf-no.drv')).toHaveLength(1);
    expect(k.querySelectorAll('.ve-fead-pf-no.ten')).toHaveLength(1);
    const ilk = k.querySelector('tr[data-ve-node]');
    expect(ilk.classList.contains('drv')).toBe(true);
    expect(ilk.querySelector('.ve-fead-pf-no.drv').textContent).toBe('1');
    expect(ilk.querySelectorAll('.ve-fead-tbl-mv[disabled]')).toHaveLength(2);
    expect(ilk.querySelector('.ve-fead-pf-no').getAttribute('title')).toMatch(/Sürücü/);
  });

  test('SIRA OKUNUN pasif hâli `disabled` — görünmez bir düğme değil', () => {
    kurOrnek();
    const k = dom(paftaHTML());
    expect(k.querySelectorAll('button.ve-fead-tbl-mv')).toHaveLength(12);
    // ALTI pasif ok: 1. satırın ikisi (sürücü kilitli), 2. satırın ▲'sı,
    // son satırın ikisi ve bir üstünün ▼'si (GERGİ KİLİDİ, 2026-09-22).
    expect(k.querySelectorAll('button.ve-fead-tbl-mv[disabled]')).toHaveLength(6);

    // KİLİT YALNIZ KURAL YERİNDEYKEN: gergisi ortada duran bir kayıt okla
    // düzeltilebilmeli.
    const ten = global.nodes.find((n) => componentDefs[n.type].isFeadTensioner);
    const alt = global.nodes.find((n) => n.type === 'fead-alternator');
    const t0 = ten.data.beltIndex, a0 = alt.data.beltIndex;
    ten.data.beltIndex = a0; alt.data.beltIndex = t0;          // gergiyi ORTAYA al
    M.veFeadNormalizeBeltOrder(global.nodes);
    const h2 = paftaHTML();
    expect(dom(h2).querySelectorAll('button.ve-fead-tbl-mv[disabled]')).toHaveLength(4);
    // ve hüküm BAŞLIK ŞERİDİNDE görünüyor (sıranın düzenlendiği yüzeyde).
    expect(dom(h2).querySelector('.ve-fead-pf-bas .ve-fead-pf-hukum').textContent)
      .toContain('Gergi sonda değil');
    expect(k.querySelector('.ve-fead-pf-hukum')).toBeNull();  // kural yerindeyken sessiz
  });

  test('GERGİ SATIRININ X/Y\'si ne olduğunu SÖYLÜYOR', () => {
    kurOrnek();
    const k = dom(paftaHTML());
    // O satırın alanı `cenX/cenY` — AVARA MERKEZİ; montaj konumu ondan türer.
    const tr = k.querySelector('tr.ten');
    expect(tr.querySelector('td.k-x').getAttribute('title')).toMatch(/^X \(mm\) — avara merkezi/);
    expect(tr.querySelector('td.k-y').getAttribute('title')).toMatch(/^Y \(mm\) — avara merkezi/);
    expect(tr.querySelector('td.k-x input').getAttribute('onchange')).toContain("'cenX'");
    // Kasnak satırlarında böyle bir not YOK.
    expect((k.innerHTML.match(/avara merkezi/g) || []).length).toBe(2);
  });

  test('Σ: gösterilen sütunların toplamı, yeni bir büyüklük DEĞİL (model)', () => {
    const { build } = kurOrnek();
    const T = fead.veFeadTableRows(build);
    const sar = T.rows.reduce((a, r) => a + r.wrapDeg, 0);
    const spn = T.rows.reduce((a, r) => a + r.spanMm, 0);
    expect(T.sumWrapDeg).toBeCloseTo(sar, 9);
    expect(T.sumSpanMm).toBeCloseTo(spn, 9);
    const yay = T.rows.reduce((a, r) =>
      a + (r.wrapDeg * Math.PI / 180) * (r.effDiaMm / 2), 0);
    expect(T.sumSpanMm + yay).toBeCloseTo(T.LpitchMm, 6);
  });

  test('BOŞ DURUM tablonun kendi ekleyicisini gösteriyor — palet SESSİZ', () => {
    global.nodes = []; global.connections = [];
    const h = paftaHTML();
    expect(h).not.toMatch(/paletten/i);
    expect(h).toContain('Kasnak ekle');
    expect(dom(h).querySelectorAll('tr.ve-fead-pf-bos')).toHaveLength(1);
    expect(dom(h).querySelectorAll('thead')).toHaveLength(0);   // sütun başı yok
  });

  // TABLO BİR KANVAS BİLEŞENİ DEĞİL, KARTIN KATMANI: tip, palet girdisi, paneli
  // ve çekmecesi yok. Kapısı kartın yüzen çubuğundaki "Tablo" düğmesi.
  test('Kayış Tablosu bir kanvas bileşeni DEĞİL — tip, palet, panel ve çekmece yok', () => {
    expect(componentDefs['fead-table']).toBeUndefined();
    expect(typeof VE_FEAD_TABLE_W).toBe('undefined');
    const html = require('fs').readFileSync(
      require('path').join(__dirname, '../../index.html'), 'utf8');
    expect(html).not.toMatch(/data-type="fead-table"/);
    expect(loadSource('cp-core.js')).not.toMatch(/'fead-table'/);
    expect(fead.getFeadTablePropertiesHTML).toBeUndefined();
    // ÇEKMECE EMEKLİ: açan/kapatan/tutamak/kamera işlevleri YOK.
    ['veFeadTabloAc', 'veFeadTabloKapat', 'veFeadTabloAcikMi', '_feadTabloBoyut',
     '_feadTabloCizimiGoster', '_feadTabloKameraGeri'].forEach((f) => expect(fead[f]).toBeUndefined());
    expect(loadSource('cp-fead.js')).not.toMatch(/ve-fead-tablo-pencere|VE_FEAD_TABLO_ID/);
    // Kapı kartın yüzen çubuğunda ve KARTIN KENDİSİNE bağlı.
    expect(loadSource('cp-fead.js')).toMatch(/veFeadTabloDugmeHTML\(node\) \+ '<\/div>'/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  PAFTA — TABLO KARTIN KATMANI, TABLOLU KART GENİŞ
// ═══════════════════════════════════════════════════════════════════════════
//
// Kullanıcı: *"İki kanvasımız var ya, o tablonun olduğu kanvas, diğer kanvasa
// göre daha geniş olsun ama. Yani daha rahat okunsun tablodakiler."*
describe('PAFTA — tablo kartın katmanı', () => {
  test('ÖN AYAR tabloyu seçer: geometri açık, işletme kapalı; alan yazılmışsa karışmaz', () => {
    const n = (data) => ({ type: 'fead-layout', data });
    expect(fead.veFeadTabloAcik(n({}))).toBe(true);                     // varsayılan = geometri
    expect(fead.veFeadTabloAcik(n({ katOn: 'isletme' }))).toBe(false);
    expect(fead.veFeadTabloAcik(n({ katOn: 'isletme', tablo: 1 }))).toBe(true);
    expect(fead.veFeadTabloAcik(n({ tablo: 0 }))).toBe(false);
    expect(fead.veFeadTabloAcik(n({ katOn: 'uydurma' }))).toBe(true);  // tanınmayan → varsayılan
    // Tek kaynak: ön ayar listesinin alanı.
    expect(fead.VE_FEAD_ON_AYARLAR.map((O) => [O.k, O.tablo])).toEqual([['geometri', 1], ['isletme', 0]]);
  });

  test('Tablo düğmesi KARTIN alanını yazar — ön ayarın söylediğine dönünce SİLER', () => {
    const ns = [];
    global.nodes = ns;
    const { n } = kurKart(ns, 'k1', {}, 640);
    stubs.saveState.mockClear();
    let tabloVardi = 'yok';
    stubs.saveState.mockImplementation(() => { if (tabloVardi === 'yok') tabloVardi = n.data.tablo; });
    expect(fead.veFeadTabloToggle('k1')).toBe(false);          // kapandı
    expect(tabloVardi).toBeUndefined();                          // saveState mutasyondan ÖNCE
    expect(n.data.tablo).toBe(0);
    expect(fead.veFeadTabloToggle('k1')).toBe(true);           // açıldı = ön ayarın dediği
    expect('tablo' in n.data).toBe(false);                     // alan SİLİNDİ
    stubs.saveState.mockImplementation(() => {});
    // Düğmenin basılı hâli kartın kendi durumundan.
    expect(fead.veFeadTabloDugmeHTML(n)).toContain('aria-pressed="true"');
    expect(fead.veFeadTabloDugmeHTML(n)).toContain("veFeadTabloToggle('k1')");
    expect(fead.veFeadTabloDugmeHTML({ id: 'k2', type: 'fead-layout', data: { katOn: 'isletme' } }))
      .toContain('aria-pressed="false"');
    expect(fead.veFeadTabloToggle('yok-boyle')).toBe(false);
    document.body.innerHTML = '';
  });

  test('ön ayar uygulamak TABLOYU da temizler (ön ayarın söz söylediği alan)', () => {
    const ns = [];
    global.nodes = ns;
    const { n } = kurKart(ns, 'k1', { tablo: 0 }, 640);
    fead.veFeadKatmanIslem('k1', 'geometri');
    expect('tablo' in n.data).toBe(false);
    expect(fead.veFeadTabloAcik(n)).toBe(true);
    document.body.innerHTML = '';
  });

  // VARSAYILAN ÖLÇÜDEKİ KART TABLOYU İZLER, elle verilmiş ölçüye DOKUNULMAZ;
  // genişleyen kartın SAĞINDAKİ komşu fark kadar kayar (üstüne binmesin).
  test('varsayılan ölçüdeki kart tabloyu izler: 440 ↔ 640, sağdaki komşu kayar', () => {
    const ns = [];
    global.nodes = ns;
    const { n: sol } = kurKart(ns, 'k1', {}, 640);
    const { n: sag } = kurKart(ns, 'k2', { katOn: 'isletme' }, 440);
    sol.x = 0; sol.y = 0; sag.x = 664; sag.y = 0;
    const alt = { id: 'k3', type: 'fead-layout', def: componentDefs['fead-layout'],
                  x: 700, y: 900, width: 440, height: 500, data: { katOn: 'isletme' } };
    ns.push(alt);                                               // aynı sırada DEĞİL
    fead.veFeadTabloToggle('k1');                               // tablo kapandı
    expect(sol.width).toBe(VE_FEAD_LAYOUT_W);
    expect(sag.x).toBe(664 - (VE_FEAD_PAFTA_W - VE_FEAD_LAYOUT_W));
    expect(alt.x).toBe(700);                                    // altta: dokunulmadı
    fead.veFeadTabloToggle('k1');                               // geri
    expect(sol.width).toBe(VE_FEAD_PAFTA_W);
    expect(sag.x).toBe(664);
    // ELLE VERİLMİŞ ÖLÇÜ korunur.
    sol.width = 700;
    fead.veFeadTabloToggle('k1');
    expect(sol.width).toBe(700);
    expect(sag.x).toBe(664);
    // DOM da yazıldı (kutu + tutamak) — kurulu kartta.
    expect(document.getElementById('k2').style.left).toBe('664px');
    document.body.innerHTML = '';
  });

  test('TİPİN VARSAYILANI tablolu kart: geniş; tablosuz kart dar', () => {
    expect(componentDefs['fead-layout'].defaultWidth).toBe(VE_FEAD_PAFTA_W);
    expect(VE_FEAD_PAFTA_W).toBeGreaterThan(VE_FEAD_LAYOUT_W);
    expect(fead.veFeadKartVarsayilanW({ type: 'fead-layout', data: {} })).toBe(VE_FEAD_PAFTA_W);
    expect(fead.veFeadKartVarsayilanW({ type: 'fead-layout', data: { katOn: 'isletme' } }))
      .toBe(VE_FEAD_LAYOUT_W);
    // ESKİ VARSAYILAN yükseltilirken genişlik KARTIN TABLOSUNDAN.
    expect(veFeadLayoutSizeFor({ type: 'fead-layout', width: 420, height: 340, data: {} }))
      .toEqual({ w: VE_FEAD_PAFTA_W, h: VE_FEAD_LAYOUT_H, changed: true });
    expect(veFeadLayoutSizeFor({ type: 'fead-layout', width: 420, height: 340, data: { katOn: 'isletme' } }))
      .toEqual({ w: VE_FEAD_LAYOUT_W, h: VE_FEAD_LAYOUT_H, changed: true });
  });

  // PAFTANIN BOYU satır sayısından; TAVAN kartın %55'i (çizime yer kalsın),
  // TABAN iki satır.
  test('paftanın boyu: satır sayısından, tavanı %55, tabanı iki satır', () => {
    const P = fead.VE_FEAD_PF, kart = { height: 500 };
    expect(fead.veFeadPaftaH(kart, 4)).toBe(P.bas + P.sut + 4 * P.satir + P.alt);
    expect(fead.veFeadPaftaH(kart, 0)).toBe(P.bas + P.bos + P.alt);
    expect(fead.veFeadPaftaH(kart, 30)).toBe(Math.round(500 * 0.55));
    // Küçük kart: %55 iki satırdan azsa TABAN iki satır (150 × 0,55 = 83 < 104).
    const kisa = { height: 150 };
    expect(fead.veFeadPaftaH(kisa, 9)).toBe(P.bas + P.sut + 2 * P.satir + P.alt);
  });

  // ÇİZİM TABLONUN VE ÇUBUĞUN ÜSTÜNDE KALIR: tablo açıkken çizimin oranı
  // (W : H − pafta − çubuk bandı); kapalıyken kartın tamamı. Göbekte satır
  // numarası yalnız tablo açıkken.
  test('çizim tablonun ÜSTÜNDE kalan yer; göbekte satır numarası yalnız tablo açıkken', () => {
    const { ns } = kurOrnek();
    const oran = (h) => {
      const m = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(h);
      return m ? Number(m[2]) / Number(m[1]) : NaN;
    };
    const acik = { id: 'k1', type: 'fead-layout', def: componentDefs['fead-layout'],
                   width: 640, height: 500, data: {} };
    const kapali = { id: 'k2', type: 'fead-layout', def: componentDefs['fead-layout'],
                     width: 640, height: 500, data: { tablo: 0 } };
    ns.push(acik, kapali);
    const pH = fead.veFeadPaftaH(acik, 6);
    const hA = fead.veFeadLayoutCardHTML(acik), hK = fead.veFeadLayoutCardHTML(kapali);
    expect(oran(hA)).toBeCloseTo((500 - pH - fead.VE_FEAD_YUZ_UST) / 640, 3);
    expect(oran(hK)).toBeCloseTo(500 / 640, 3);
    expect(hA).toContain('class="ve-fead-kanvas pafta-var"');
    expect(hK).not.toContain('pafta-var');
    // Balonlar: 1..6, isabet halkasının ALTINDA ve fareye kapalı.
    const b = dom(hA).querySelectorAll('[data-ve="sira-no"]');
    expect([...b].map((g) => g.textContent)).toEqual(['1', '2', '3', '4', '5', '6']);
    b.forEach((g) => expect(g.getAttribute('pointer-events')).toBe('none'));
    expect(hA.indexOf('data-ve="sira-no"')).toBeLessThan(hA.indexOf('data-ve="hit"'));
    expect(dom(hK).querySelectorAll('[data-ve="sira-no"]')).toHaveLength(0);
    // Tablo açıkken boş kartın "Tabloyu aç" düğmesi YOK (tablo zaten altında).
    global.nodes = [acik, kapali];
    expect(fead.veFeadLayoutCardHTML(acik)).not.toContain('Tabloyu aç');
    expect(fead.veFeadLayoutCardHTML(kapali)).toContain("veFeadTabloToggle('k2')");
  });

  // ── ŞEMA 7 → 8: KAYITLI PROJEDE TABLOLU KART GENİŞLER ──────────────────
  test('göç: dokunulmamış tablolu kart genişler, sağdaki kart kayar, DOM\'a dokunulmaz', () => {
    const st = { nodes: [
      { id: 'comp-3', type: 'fead-layout', x: 100, y: 50, width: 440, height: 500, data: {} },
      { id: 'comp-4', type: 'fead-layout', x: 564, y: 50, width: 440, height: 500,
        data: { katOn: 'isletme' } },
      { id: 'comp-5', type: 'fead-solver', x: -60, y: 50, width: 65, height: 60, data: {} },
    ] };
    // Ana tuvalde AYNI kimlikli bir kutu: göç ona dokunmamalı.
    const el = document.createElement('div');
    el.id = 'comp-4'; el.style.left = '7px';
    document.body.appendChild(el);
    expect(fead.veFeadMigratePafta(st)).toBe(1);
    expect(st.nodes[0].width).toBe(VE_FEAD_PAFTA_W);
    expect(st.nodes[1].x).toBe(564 + (VE_FEAD_PAFTA_W - 440));   // aralık korundu
    expect(st.nodes[1].width).toBe(440);                          // tablosuz kart dar kalır
    expect(st.nodes[2].x).toBe(-60);                              // soldaki araç kıpırdamadı
    expect(el.style.left).toBe('7px');
    // ELLE VERİLMİŞ ÖLÇÜ: dokunulmaz.
    const st2 = { nodes: [{ id: 'a', type: 'fead-layout', x: 0, y: 0, width: 520, height: 500, data: {} }] };
    expect(fead.veFeadMigratePafta(st2)).toBe(0);
    expect(st2.nodes[0].width).toBe(520);
    // ESKİ varsayılan (420×340) da tablolu kart olarak yükselir.
    const st3 = { nodes: [{ id: 'a', type: 'fead-layout', x: 0, y: 0, width: 420, height: 340, data: {} }] };
    expect(fead.veFeadMigratePafta(st3)).toBe(1);
    expect([st3.nodes[0].width, st3.nodes[0].height]).toEqual([VE_FEAD_PAFTA_W, VE_FEAD_LAYOUT_H]);
    // Kapı state.js'te: sürüm 8'den eski her dosya bu adımdan geçer.
    expect(loadSource('state.js')).toMatch(/var VE_SCHEMA_VERSION = 8;/);
    expect(loadSource('state.js')).toMatch(/if\(v < 8 && typeof veFeadMigratePafta === 'function'\) veFeadMigratePafta\(state\);/);
    document.body.innerHTML = '';
  });

  // ENTER BİR ALT SATIRA (Shift+Enter bir üste) — Gates defterini satır satır
  // geçirmek. Sekme sağa gider (tarayıcının kendisi).
  test('ENTER alttaki satırın AYNI sütununa, Shift+Enter üsttekine', async () => {
    const { ns } = kurOrnek();
    const { el } = kurKart(ns, 'kart0');
    fead.veFeadRefreshCards();
    await kare();
    const hucre = (i, k) => el.querySelectorAll('.ve-fead-pafta tr[data-ve-node]')[i].querySelector('td.k-' + k + ' input');
    hucre(1, 'y').focus();
    hucre(1, 'y').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(document.activeElement).toBe(hucre(2, 'y'));
    hucre(2, 'y').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, bubbles: true }));
    expect(document.activeElement).toBe(hucre(1, 'y'));
    // Son satırda Enter odağı bırakır (değer yazılır), başka yere atlamaz.
    hucre(5, 'x').focus();
    hucre(5, 'x').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(document.activeElement).not.toBe(hucre(5, 'x'));
    document.body.innerHTML = '';
  });

  // KART TABLODAN TAŞINMAZ: tablo bir yazı yüzeyi; kart çizimden tutulur.
  test('pafta mousedown\'ı YUTUYOR — hücreye basmak kartı sürüklemez', async () => {
    const { ns } = kurOrnek();
    const { el } = kurKart(ns, 'kart0');
    fead.veFeadRefreshCards();
    await kare();
    let ulasti = 0;
    el.addEventListener('mousedown', () => { ulasti++; });
    el.querySelector('.ve-fead-pafta td.k-sar').dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(ulasti).toBe(0);
    el.querySelector('.ve-fead-kanvas').dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(ulasti).toBe(1);                                     // çizim kartı taşır
    document.body.innerHTML = '';
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  KART KÜÇÜLTÜLÜNCE İÇERİK KAYBOLUYORDU — EN KÜÇÜK ÖLÇÜ (mekanizma)
// ═══════════════════════════════════════════════════════════════════════════
describe('en küçük ölçü — kart içeriğinin altına inmiyor', () => {
  test('taban TİPTEN okunuyor — beyan etmeyen tip eski 50×50\'de kalıyor', () => {
    expect(typeof veNodeMinSize).toBe('function');
    componentDefs['test-kart'] = { name: 'Deneme', minWidth: 300, minHeight: 120 };
    try {
      expect(veNodeMinSize({ type: 'test-kart' })).toEqual({ w: 300, h: 120 });
    } finally { delete componentDefs['test-kart']; }
    expect(veNodeMinSize({ type: 'fead-idler' })).toEqual({ w: 50, h: 50 });
    expect(veNodeMinSize(null)).toEqual({ w: 50, h: 50 });
    expect(veNodeMinSize({ def: { minWidth: 111, minHeight: 222 } }))
      .toEqual({ w: 111, h: 222 });
  });

  test('TABANIN ALTINDA KAYITLI kart açılışta yükseliyor', () => {
    componentDefs['test-kart'] = { name: 'Deneme', minWidth: 300, minHeight: 120 };
    try {
      expect(veFeadLayoutSizeFor({ type: 'test-kart', width: 200, height: 90 }))
        .toEqual({ w: 300, h: 120, changed: true });
      expect(veFeadLayoutSizeFor({ type: 'test-kart', width: 1400, height: 100 }))
        .toEqual({ w: 1400, h: 120, changed: true });
      expect(veFeadLayoutSizeFor({ type: 'test-kart', width: 1000, height: 500 }).changed)
        .toBe(false);
    } finally { delete componentDefs['test-kart']; }
    expect(veFeadLayoutSizeFor({ type: 'fead-layout', width: 120, height: 90 }).changed)
      .toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  EKLENEN SATIR GÖRÜNÜR OLMALI
// ═══════════════════════════════════════════════════════════════════════════
//
// ÖLÇÜLDÜ (2026-09-11, gerçek tarayıcı): yedinci kasnak listenin dibinin 35 px
// ALTINA düşüyor ve tablo hiç kaymıyordu. Kullanıcı "＋ Kasnak ekle" diyor,
// paneli açılıyor, ama DOLDURACAĞI SATIR ekranda yok.
describe('eklenen satır görünür kılınıyor', () => {
  test('ekleyici satırı görüş alanına ALIYOR — ve zaten görünense DOKUNMUYOR', async () => {
    const { ns } = kurOrnek();
    const { el } = kurKart(ns, 'kart0');
    fead.veFeadRefreshCards();
    await kare();
    const cagri = [];
    el.querySelectorAll('.ve-fead-pafta tr[data-ve-node]')
      .forEach((tr) => { tr.scrollIntoView = (o) => cagri.push([tr.getAttribute('data-ve-node'), o]); });
    // `nearest` — görünen satır listeyi ZIPLATMAZ.
    expect(fead._feadScrollRowIntoView('ex-ALT')).toBe(true);
    expect(cagri).toHaveLength(1);
    expect(cagri[0][0]).toBe('ex-ALT');
    expect(cagri[0][1].block).toBe('nearest');
    expect(fead._feadScrollRowIntoView('yok-boyle-bir-id')).toBe(false);
    expect(fead._feadScrollRowIntoView(null)).toBe(false);
    expect(cagri).toHaveLength(1);
    document.body.innerHTML = '';
  });

  test('bekleyen tazeleme kaydırmadan ÖNCE boşaltılıyor — satır o kurulumla doğuyor', async () => {
    const { ns } = kurOrnek();
    const { el } = kurKart(ns, 'kart0');
    fead.veFeadRefreshCards();
    await kare();
    const yeni = { id: 'yeni1', type: 'fead-idler', def: componentDefs['fead-idler'],
                   x: 0, y: 0, width: 65, height: 60, data: { od: 70, beltIndex: 5.5 } };
    ns.push(yeni);
    fead.veFeadRefreshCards();                          // tablo bir SONRAKİ karede…
    expect(el.querySelector('.ve-fead-pafta tr[data-ve-node="yeni1"]')).toBeNull();
    Element.prototype.scrollIntoView = function(){};
    expect(fead._feadScrollRowIntoView('yeni1')).toBe(true);   // …ama kaydırma bekletmez
    delete Element.prototype.scrollIntoView;
    document.body.innerHTML = '';
  });

  test('veFeadTableAdd kaydırmayı TAZELEMEDEN SONRA çağırıyor', () => {
    const src = require('fs').readFileSync(
      require('path').join(__dirname, '../../js/cp-fead.js'), 'utf8');
    const fn = src.slice(src.indexOf('function veFeadTableAdd(type)'));
    const govde = fn.slice(0, fn.indexOf('\n}'));
    expect(govde).toContain('_feadScrollRowIntoView(n.id)');
    expect(govde.indexOf('createNode(')).toBeLessThan(govde.indexOf('_feadScrollRowIntoView'));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AD HÜCRESİ BİR KAPI: TIKLAYINCA PENCERE **AÇILMALI**
//
// `addToSelection` panelin İÇERİĞİNİ doldurur ama `#ve-properties-overlay` bir
// MODAL'dır ve kapalı kalır (map.js veTogglePropertiesPanel). Ölçüldü (gerçek
// tarayıcı): ada tıklanınca satır işaretleniyor, panelin HTML'i kuruluyor,
// ekranda hiçbir şey olmuyordu.
// ─────────────────────────────────────────────────────────────────────────────
describe('ad hücresi paneli AÇIYOR', () => {
  const kur = () => {
    const d = componentDefs['fead-alternator'];
    const n = { id: 'ex-ALT', type: 'fead-alternator', def: d, x: 0, y: 0,
                width: d.defaultWidth || 65, height: d.defaultHeight || 60,
                data: { od: 60, beltIndex: 2, x: 10, y: 20 } };
    global.nodes = [n]; global.connections = [];
    return n;
  };

  beforeEach(() => {
    global.clearSelection = jest.fn();
    global.addToSelection = jest.fn();
    global.veTogglePropertiesPanel = jest.fn();
  });
  afterEach(() => {
    delete global.clearSelection; delete global.addToSelection;
    delete global.veTogglePropertiesPanel;
  });

  test('veFeadTableOpen SEÇMEKLE KALMIYOR, pencereyi de açıyor', () => {
    const n = kur();
    expect(fead.veFeadTableOpen('ex-ALT')).toBe(true);
    expect(global.clearSelection).toHaveBeenCalled();
    expect(global.addToSelection).toHaveBeenCalledWith(n);
    expect(global.veTogglePropertiesPanel).toHaveBeenCalledWith(true);
  });

  test('olmayan kasnakta pencere AÇILMIYOR', () => {
    kur();
    expect(fead.veFeadTableOpen('yok-boyle-bir-id')).toBe(false);
    expect(global.veTogglePropertiesPanel).not.toHaveBeenCalled();
  });

  test('veTogglePropertiesPanel yokken PATLAMIYOR (yükleme sırası sözleşmesi)', () => {
    kur();
    delete global.veTogglePropertiesPanel;
    expect(() => fead.veFeadTableOpen('ex-ALT')).not.toThrow();
    expect(global.addToSelection).toHaveBeenCalled();
  });

  test('ad hücresinin onclick\'i veFeadTableOpen — kapının gerçekten kablosu var', () => {
    const src = require('fs').readFileSync(
      require('path').join(__dirname, '../../js/cp-fead.js'), 'utf8');
    expect(src).toContain('class="ve-fead-tbl-name"');
    expect(src).toMatch(/onclick="veFeadTableOpen\(/);
  });
});
