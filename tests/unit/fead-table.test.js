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

describe('kart HTML\'i', () => {
  // ── ALAN ETİKETLERİ: KISA AD EKRANDA, DEFTERİN ADI `title`DA ────────────
  // Kart listesinde başlık satırı yok; etiket alanın ÜSTÜNDE duruyor ve dar
  // olduğu için kısaltılıyor ("Efektif Çap" → "Ø eff"). Defterin adı KAYBOLMAZ:
  // kapı her sütunun tam adının `title`da yazılı olduğunu tutuyor — tablonun
  // varlık sebebi kullanıcının hesap sayfasıyla birebir olması.
  test('alan etiketleri kısa, DEFTERİN ADI title\'da', () => {
    kurOrnek();
    const h = fead.veFeadTableCardHTML({ id: 't', type: 'fead-table',
      def: componentDefs['fead-table'], data: {} });
    // Satırda görünen her sütunun tam adı title'da geçiyor (tek kaynak:
    // VE_FEAD_TABLE_COLS — burada ikinci bir liste tutulmuyor).
    const satirda = fead.VE_FEAD_TABLE_COLS.filter(
      (c) => c.yer === 'gir' || c.yer === 'coz');
    expect(satirda.length).toBe(7);
    satirda.forEach((c) => {
      expect(h).toContain('title="' + c.t + (c.u ? ' (' + c.u + ')' : ''));
      expect(h).toContain('>' + (c.kt || c.t));     // ekranda kısa ad
    });
    // Kayış boyu satırdan ÇIKTI ama adı künyede duruyor.
    expect(h).toContain('Kayış boyu');
    expect(h).not.toContain('X(mm)');
    // Birimi olan her sütun birimini etiketin yanında basıyor.
    const birimli = fead.VE_FEAD_TABLE_COLS.filter((c) => c.u);
    expect(birimli.length).toBe(7);
    expect((h.match(/class="br"/g) || []).length).toBeGreaterThanOrEqual(6);
    // Üst künye: kayış + marka + kasnak sayısı
    expect(h).toMatch(/>Kayış</);
    expect(h).toMatch(/>Marka</);
    expect(h).toMatch(/>Kasnak</);
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

  // GENİŞLİK HÂLÂ SÜTUN LİSTESİNDEN TÜRÜYOR — ama sütun sütun değil BÖLGE
  // bölge. (Tablo kanvastan inince — 2026-09-23 — bir KART ölçüsü kalmadı;
  // toplam yine `--fead-krt-en` olarak basılıyor, kılavuzun sahne ölçekleyicisi
  // onu okuyor.)
  test('bölge genişlikleri TEK KAYNAKTAN — toplam da basılıyor', () => {
    const satirda = ['kim', 'gir', 'coz', 'son']
      .reduce((a, y) => a + fead.veFeadKartBolgeW(y), 0);
    // Her bölge kendi sütunlarının toplamı; hiçbir sütun iki bölgeye düşmüyor.
    const hepsi = fead.VE_FEAD_TABLE_COLS.reduce((a, c) => a + c.w, 0);
    const ozet = fead.veFeadKartBolgeW('ozet');
    expect(satirda + ozet).toBe(hepsi);
    expect(ozet).toBeGreaterThan(0);                  // kayış boyu künyede
    kurOrnek();
    const h = fead.veFeadTableCardHTML(null);
    expect(h).toContain('--fead-krt-en:' + satirda + 'px;');
  });

  // ── ÇEVRİM DENETİMİ ÜST KÜNYEDE ────────────────────────────────────────
  // Kartın ALTINDA bir şerit vardı ve dört sayıyı kısaltmalarla diziyordu:
  // `Σsarım …° (|Σ| 360 olmalı) · L_pitch … · L_eff … · … konumu`. Okunması
  // için üçünün de ne olduğunu bilmek gerekiyordu, oysa tablonun tek EVET/HAYIR
  // sorusu var — kayış yolu kapandı mı. Üçü de başka yerde zaten okunuyordu:
  // L_pitch birleşik hücrede, L_eff künyede, konum künyenin devamında.
  test('ÇEVRİM DENETİMİ ÜST KÜNYEDE — alt şerit ve kısaltmaları KALKTI', () => {
    const { build } = kurOrnek();
    const T = fead.veFeadTableRows(build);
    const h = fead.veFeadTableCardHTML({ id: 't', type: 'fead-table',
      def: componentDefs['fead-table'], data: {} });
    expect(h).not.toContain('ve-fead-tbl-foot');
    expect(h).not.toMatch(/L_pitch|L_eff/);          // kısaltma değil, Türkçe
    // Denetim TABLODAN ÖNCE geliyor: künyenin devamı, kartın dibi değil.
    expect(h.indexOf('ve-fead-tbl-durum')).toBeGreaterThan(-1);
    expect(h.indexOf('ve-fead-tbl-durum')).toBeLessThan(h.indexOf('ve-fead-krt-wrap'));
    expect(h).toContain('Çevrim kapalı');
    expect(h).toMatch(/✓/);
    // L_eff künyeye "efektif boy" olarak geçti — sayı KAYBOLMADI, adı oldu.
    expect(h).toContain('Efektif boy');
    expect(h).toContain(T.LeffMm.toFixed(1) + ' mm');
    // Kol konumu denetimin DEVAMI değil bağlamı: aynı şeritte ama soluk.
    expect(h).toContain(T.posLabel + ' konumu');
  });

  // ÇÖZÜLEMEYEN MODEL: denetim sessizce "kapalı" DEMEZ. Tablo bir giriş yüzeyi
  // olduğu için satırlar yine dolu yazılır (kullanıcı düzelteceği sayıyı
  // görmeli) — ama üstteki hüküm bunu ✓ ile onaylayamaz.
  test('çevrim ÇÖZÜLEMİYORSA denetim ✗ ve "AÇIK" diyor', () => {
    // ALTERNATÖR ÇAPI 5000 mm: kasnak bütün yerleşimi yutuyor, çekirdek
    // güzergâhı çözemiyor. (`od = 0` ya da `null` YETMEZ — çekirdek hoşgörülü,
    // eksik çapı kendi varsayılanıyla çözüyor ve Σ yine 360 çıkıyor. Kapının
    // gerçekten çözülemeyen bir hâle bağlanması şart, yoksa ✗ dalı hiç
    // koşmaz.)
    const { ns } = kurOrnek();
    ns.filter((n) => n.id === 'ex-ALT')[0].data.od = 5000;
    global.nodes = ns;
    const h = fead.veFeadTableCardHTML({ id: 't', type: 'fead-table',
      def: componentDefs['fead-table'], data: {} });
    expect(h).toContain('ve-fead-tbl-durum no');
    expect(h).toContain('Çevrim AÇIK');
    expect(h).toMatch(/✗/);
    expect(h).not.toContain('Çevrim kapalı');
    // Ve satırlar YİNE DOLU — tablo bir rapor değil, GİRİŞ YÜZEYİ: kullanıcı
    // düzelteceği sayıyı göremezse tabloyu düzeltemez.
    expect((h.match(/<input /g) || []).length).toBe(18);
    // Künyenin efektif boyu da sessizce bir sayı UYDURMUYOR.
    expect(h).toContain('<span>Efektif boy</span><b>—</b>');
  });

  // İKİNCİ DAL: geometri ÇÖZÜLDÜ ama çevrim KAPANMADI. Denetim `T.ok`un
  // kopyası olsaydı bu hâlde sessizce ✓ derdi — Σ 0°, yani kayış hiçbir
  // kasnağı sarmıyor.
  test('geometri çözülse DE Σ 360 değilse denetim ✗', () => {
    const { ns } = kurOrnek();
    const alt = ns.filter((n) => n.id === 'ex-ALT')[0];
    const idr = ns.filter((n) => n.id === 'ex-IDR1')[0];
    alt.data.x = idr.data.x; alt.data.y = idr.data.y;   // iki kasnak üst üste
    global.nodes = ns;
    const T = fead.veFeadTableRows(M.veFeadBuildSystem(ns));
    expect(T.ok).toBe(true);                            // çözüldü…
    expect(Math.abs(T.signedWrapDeg)).toBeLessThan(1);  // …ama kapanmadı
    const h = fead.veFeadTableCardHTML({ id: 't', type: 'fead-table',
      def: componentDefs['fead-table'], data: {} });
    expect(h).toContain('ve-fead-tbl-durum no');
    expect(h).toContain('Çevrim AÇIK');
  });

  // ── GİRDİ/ÇÖZÜM AYRIMI: TAŞIYICI DEĞİŞTİ, KURAL DEĞİL ──────────────────
  // Künyede iki satırlık bir lejant vardı ("123 girilir · 123 çözümden"): SÖZLE
  // anlatıyordu. Yerine türetilen sütunların `<col>` şeridi geldi — ama şerit
  // vurgu renginin %6'sıydı ve ekranda seçilemiyordu (kullanıcı bildirimi,
  // 2026-09-21). Taşıyıcı artık BÖLGENİN KENDİSİ: çözüm alanları gömülü bir
  // okuma yüzeyinde, girdiler kartın zemininde.
  //
  // KAPI SABİT BİR LİSTE DEĞİL, BİR KURAL: değeri çözümden gelen her alan
  // `coz` bölgesinde (ya da çevrimin tamamına ait olan `ozet`te), elle yazılan
  // hiçbir alan orada değil. Liste yazılsaydı yeni bir türetilen sütun
  // sessizce girdi bölgesine düşerdi.
  test('ÇÖZÜM BÖLGESİ tam olarak ÇÖZÜMDEN GELEN alanlarda — lejant KALKTI', () => {
    kurOrnek();
    const h = fead.veFeadTableCardHTML({ id: 't', type: 'fead-table',
      def: componentDefs['fead-table'], data: {} });
    const kap = document.createElement('div');
    kap.innerHTML = h;
    const C = fead.VE_FEAD_TABLE_COLS;
    const sat = kap.querySelector('.ve-fead-krt');
    expect(sat).toBeTruthy();

    // Her sütunun bir BÖLGESİ var ve `coz` bayrağıyla tutarlı.
    C.forEach((c) => {
      expect(['kim', 'gir', 'coz', 'ozet', 'son']).toContain(c.yer);
      if (c.coz) expect(['coz', 'ozet']).toContain(c.yer);
      else expect(['kim', 'gir', 'son']).toContain(c.yer);
    });

    // ÇÖZÜM bölgesinde yazılabilir hiçbir şey YOK.
    const cz = sat.querySelector('.coz');
    expect(cz).toBeTruthy();
    expect(cz.querySelectorAll('input, select, .ve-fead-krt-seg')).toHaveLength(0);
    expect(cz.querySelectorAll('.ve-fead-krt-rv'))
      .toHaveLength(C.filter((c) => c.yer === 'coz').length);

    // GİRDİ bölgesinde çözümden gelen hiçbir okuma YOK.
    const gr = sat.querySelector('.gir');
    expect(gr.querySelectorAll('.ve-fead-krt-rv')).toHaveLength(0);
    expect(gr.querySelectorAll('.ve-fead-krt-fld'))
      .toHaveLength(C.filter((c) => c.yer === 'gir').length);

    // Lejant kalktı.
    expect(h).not.toContain('ve-fead-tbl-lgn');
    expect(h).not.toMatch(/girilir|çözümden geliyor/);
  });

  // ── BASAMAK: 3 → 1 ────────────────────────────────────────────────────
  // Türetilen sütunlar `126.660` · `142.317` · `221.514` basıyordu ve üçüncü
  // basamak bir hassasiyet DEĞİLDİ: girdi çapı iki basamaklı, 0,001 mm 1723
  // mm'lik bir kayışta ölçülemez. Yuvarlama yalnız BASIMDA — model tam
  // hassasiyette kalıyor (kimlik kapısı bu dosyada ayrıca duruyor).
  test('türetilen sayılar TEK BASAMAK basılıyor, model tam hassasiyette', () => {
    const { build } = kurOrnek();
    const T = fead.veFeadTableRows(build);
    const h = fead.veFeadTableCardHTML({ id: 't', type: 'fead-table',
      def: componentDefs['fead-table'], data: {} });
    const kap = document.createElement('div');
    kap.innerHTML = h;
    const hucre = [...kap.querySelectorAll('.ve-fead-krt .coz .ve-fead-krt-rv > b')]
      .map((el) => el.textContent);
    expect(hucre).toHaveLength(18);                // 6 satır × (eff, sarım, span)
    hucre.forEach((t) => expect(t).toMatch(/^-?\d+\.\d$/));
    // Künyedeki Σ da AYNI basamakta: aynı büyüklük iki farklı yuvarlamayla
    // okunmaz.
    const sig = [...kap.querySelectorAll('.ve-fead-tbl-kunye')]
      .filter((e) => /Σ toplam/.test(e.textContent))[0];
    expect(sig).toBeTruthy();
    expect(sig.textContent).toMatch(/\d+\.\d° · \d+\.\d mm/);
    // Basılan sayı MODELDEN geliyor (sunum kendi geometrisini hesaplamıyor).
    expect(hucre[0]).toBe(T.rows[0].effDiaMm.toFixed(1));
    expect(hucre[1]).toBe(T.rows[0].wrapDeg.toFixed(1));
    expect(hucre[2]).toBe(T.rows[0].spanMm.toFixed(1));
    // Ve model kısalmadı: toplamlar hâlâ kayış boyu kimliğini kapatıyor.
    expect(T.sumWrapDeg.toFixed(1)).not.toBe(String(T.sumWrapDeg));
  });

  // ── EKLEYİCİ LİSTENİN SONUNDA ─────────────────────────────────────────
  test('EKLEYİCİ tablonun ALTINDA — künyede değil', () => {
    kurOrnek();
    const h = fead.veFeadTableCardHTML({ id: 't', type: 'fead-table',
      def: componentDefs['fead-table'], data: {} });
    const kap = document.createElement('div');
    kap.innerHTML = h;
    // Künyenin sağ ucunda dururken bir kayış künyesi ALANI gibi okunuyordu;
    // oysa eklenen kasnak sıranın SONUNA düşüyor — eylemin sonucu tam olarak
    // listenin bittiği yerde beliriyor.
    expect(kap.querySelector('.ve-fead-tbl-head .ve-fead-tbl-add')).toBeNull();
    expect(kap.querySelector('.ve-fead-tbl-ekle .ve-fead-tbl-add')).toBeTruthy();
    expect(h.indexOf('ve-fead-tbl-ekle')).toBeGreaterThan(h.indexOf('ve-fead-krt-wrap'));

    // Boş tablonun tavsiyesi de o yeri gösteriyor. "Sağ üstteki" artık bayat
    // bir tavsiye olurdu ve bayat tavsiye, tavsiye olmamasından kötüdür.
    global.nodes = []; global.connections = [];
    const b = fead.veFeadTableCardHTML({ id: 't', type: 'fead-table',
      def: componentDefs['fead-table'], data: {} });
    expect(b).toContain('Aşağıdaki');
    expect(b).not.toContain('Sağ üstteki');
  });

  // ── SÜRÜCÜ SATIRIN KENDİSİNDE ─────────────────────────────────────────
  test('SÜRÜCÜ satırın SINIFINDA da işaretli — seçim sınıfıyla birlikte', () => {
    const { ns } = kurOrnek();
    const h = fead.veFeadTableCardHTML({ id: 't', type: 'fead-table',
      def: componentDefs['fead-table'], data: {} });
    const kap = document.createElement('div');
    kap.innerHTML = h;
    const trs = [...kap.querySelectorAll('.ve-fead-krt')];
    expect(trs.filter((t) => t.classList.contains('drv'))).toHaveLength(1);
    expect(trs[0].classList.contains('drv')).toBe(true);

    // İKİ KATMAN AYRI: sürücülük kalıcı bir ROL, seçim geçici bir DURUM.
    // Tek bir sınıfa sıkıştırılsalardı sürücünün paneli açıkken hangisinin
    // işareti olduğu okunamazdı.
    const src = ns.filter((n) => n.data && n.data.driver)[0];
    global.selectedNodes = [src];
    const kap2 = document.createElement('div');
    kap2.innerHTML = fead.veFeadTableCardHTML({ id: 't', type: 'fead-table',
      def: componentDefs['fead-table'], data: {} });
    const tr0 = kap2.querySelector('.ve-fead-krt');
    expect(tr0.classList.contains('drv')).toBe(true);
    expect(tr0.classList.contains('is-sel')).toBe(true);
    global.selectedNodes = [];
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
  // TABLO ARTIK BİR PENCERE (Çizim Masası, 2026-09-23): tek kapı şemayı VE —
  // açıksa — tablo penceresini tazeler. Pencere bir sonraki karede kurulur
  // (odak kuralı: Sekme ile geçilen hücre sökülmesin).
  test('veFeadRefreshCards ŞEMAYI ve AÇIK TABLO PENCERESİNİ birlikte tazeler', async () => {
    const { ns } = kurOrnek();
    const d = componentDefs['fead-layout'];
    ns.push({ id: 'kart0', type: 'fead-layout', def: d, x: 0, y: 0,
              width: d.defaultWidth, height: d.defaultHeight, data: {} });
    const el = document.createElement('div');
    el.id = 'kart0';
    el.innerHTML = '<div class="ve-node-box"></div>';
    document.body.appendChild(el);
    const kap = document.createElement('div');
    kap.id = 've-canvas-wrapper';
    document.body.appendChild(kap);
    expect(fead.veFeadRefreshCards()).toBe(1);            // pencere kapalı: yalnız şema
    expect(document.querySelector('#kart0 .' + fead.VE_FEAD_CARD_CLASS)).toBeTruthy();

    expect(fead.veFeadTabloAc()).toBe(true);
    const govde = () => document.querySelector('#ve-fead-tablo .' + fead.VE_FEAD_TABLE_CLASS);
    expect(govde().querySelectorAll('.ve-fead-krt[data-ve-node]')).toHaveLength(6);
    const xAlani = () => [...govde().querySelectorAll('input')]
      .find((i) => i.getAttribute('onchange') === "veFeadTableSet('ex-IDR1','x',this.value)");
    expect(xAlani().value).toBe('130.1');

    ns.find((n) => n.id === 'ex-IDR1').data.x = 140;
    expect(fead.veFeadRefreshCards()).toBe(2);            // şema + pencere
    await new Promise((r) => (typeof requestAnimationFrame === 'function'
      ? requestAnimationFrame(r) : setTimeout(r, 0)));
    expect(xAlani().value).toBe('140');

    expect(fead.veFeadTabloKapat()).toBe(true);
    expect(document.getElementById('ve-fead-tablo')).toBeNull();
    expect(fead.veFeadRefreshCards()).toBe(1);
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
  // İKİ DURUMLU SEGMENT — açılır liste DEĞİL (2026-09-21). İki seçenekli bir
  // `<select>` seçeneklerini göstermek için tıklanmayı gerektiriyordu, oysa
  // ikisi birden tek bakışta sığıyor; üstelik tarayıcının oku listedeki en çok
  // göze batan parçaydı (altı satırda altı ok). Seçenek SAYISI ikiden
  // çıkarsa bu karar geri alınır — kapı o yüzden sayıyı da ölçüyor.
  test('iki durumlu SEGMENT — iki düğme, açık olan işaretli, liste YOK', () => {
    kurOrnek();
    const h = fead.veFeadTableCardHTML({ id: 't', type: 'fead-table',
      def: componentDefs['fead-table'], data: {} });
    const seg = h.match(/<span class="ve-fead-krt-seg" data-ve="spin">[\s\S]*?<\/span>/g) || [];
    expect(seg).toHaveLength(6);                       // altı kasnak, altı segment
    seg.forEach((s) => {
      const dugme = s.match(/<button /g) || [];
      expect(dugme).toHaveLength(2);                   // Sağ + Sol, ikisi de görünür
      expect(s).toContain('>Sağ</button>');
      expect(s).toContain('>Sol</button>');
      // Açık olan TAM OLARAK BİR tane: hiçbiri işaretli değilse hücre hangi
      // yönde olduğunu söylemiyor demektir, ikisi birden işaretliyse çelişir.
      expect((s.match(/class="on"/g) || []).length).toBe(1);
      // Kart kanvasta: her düğme mousedown yutmalı, yoksa tıklamak düğümü
      // sürüklemeye başlar.
      expect((s.match(/onmousedown="event\.stopPropagation\(\);"/g) || []).length).toBe(2);
    });
    expect((h.match(/veFeadTableSetSpin\(/g) || []).length).toBe(12);
    // Satırlarda <select> KALMADI — geriye yalnız ekleyicininki kaldı.
    expect((h.match(/<select /g) || []).length).toBe(1);
    expect((h.match(/<select [^>]*onmousedown="event\.stopPropagation\(\);"/g) || []).length)
      .toBe(1);
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

// KAYIŞ BOYU SATIRA DEĞİL ÇEVRİME AİT — VE ARTIK KÜNYEDE
//
// Defterde K5:K10 BİRLEŞTİRİLMİŞ ve tek formül; ızgara döneminde bu bir
// `rowspan` hücresiydi ve altı satır boyu bir dikdörtgenin ortasında TEK bir
// sayı taşıyordu (ölçüldü: 88 px × ~170 px, içinde 5 karakter). Kart listesinde
// satır diye bir hizalanmış ızgara olmadığı için `rowspan` da yok; değer
// künyeye taşındı ve orada "çevrimin tamamına ait" olduğu ayrıca söylenmiş
// oluyor. Defterle bağ KOPMUYOR: sütun listesinde `kayis` girdisi duruyor,
// künyedeki etiket ondan okunuyor.
describe('Kayış Uzunluğu — çevrime ait, künyede', () => {
  test('künyede TEK KEZ, listede HİÇ — ve sütun listesinden okunuyor', () => {
    kurOrnek();
    const h = fead.veFeadTableCardHTML({ id: 't', type: 'fead-table',
      def: componentDefs['fead-table'], data: {} });
    const kol = fead.VE_FEAD_TABLE_COLS.find((c) => c.k === 'kayis');
    expect(kol.yer).toBe('ozet');                       // listede değil, özette
    // Künyede, kısa adıyla ve tam olarak bir kez.
    expect(h.split(kol.kt).length - 1).toBe(1);
    expect(h).toContain('<span>' + kol.kt + '</span>');
    // `rowspan` hücresi KALKTI — kart listesinde hizalanmış satır yok.
    expect(h).not.toMatch(/rowspan=/);
    // Değer çözümden geliyor: gerçek sayı basılıyor, yer tutucu değil.
    const T = fead.veFeadTableRows(M.veFeadBuildSystem(global.nodes));
    expect(h).toContain('<b>' + T.LpitchMm.toFixed(1) + ' mm</b>');
  });

  test('sütun sayısı ON BİR — kayış boyu listede yer kaplamıyor', () => {
    // Onbirinci sütun SİLME. Sıra oklarıyla aynı hücrede dururken sık yapılan
    // işlem ile geri dönüşü olmayan işlem bitişikti (indis + ▲▼ + ✕ / 70 px /
    // 9 px yazı) — ayrı sütun bir kozmetik değil bir ölçü kararı.
    expect(fead.VE_FEAD_TABLE_COLS).toHaveLength(11);
    expect(fead.VE_FEAD_TABLE_COLS[9].k).toBe('kayis');
    expect(fead.VE_FEAD_TABLE_COLS[10].k).toBe('sil');
    // Listenin genişliği = dört bölgenin toplamı; KÜNYEYE giden sütun sayılmaz.
    // (Kartın ölçüsü bu toplamdan türüyordu; tablo kanvastan inince —
    // 2026-09-23 — kart ölçüsü de kalktı, toplam yalnız kılavuzun ölçeğinde.)
    const toplam = ['kim', 'gir', 'coz', 'son']
      .reduce((a, y) => a + fead.veFeadKartBolgeW(y), 0);
    expect(toplam).toBe(fead.veFeadKartBolgeW());
    expect(fead.veFeadKartBolgeW('ozet')).toBe(fead.VE_FEAD_TABLE_COLS[9].w);
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
    // GERGİ HARİÇ: örnekte zaten bir tane var ve çekirdek ikincisini kabul
    // etmiyor (aşağıdaki kapı). Listenin geri kalanı componentDefs'ten türer.
    tipler.filter((t) => !componentDefs[t].isFeadTensioner)
      .forEach((t) => expect(h).toContain('value="' + t + '"'));
    // Kasnak OLMAYAN bir tip listeye sızmamalı.
    expect(h).not.toContain('value="fead-belt"');
    expect(h).not.toContain('value="fead-table"');
  });

  // GERGİ TEKİLDİR VE HER İKİ YÜZEYDE ÖYLE DAVRANIR (2026-09-22).
  //
  // Ölçülen aykırılık: sihirbaz gergi satırının ✕'ini `disabled` basıyor ve
  // sebebini yazıyordu; Kayış Tablosu ise hem silmeye hem İKİNCİ bir gergi
  // eklemeye izin veriyordu. Yani kullanıcı tablodan modeli İKİ AYRI yönden
  // çözülemez hâle getirebiliyordu (0 gergi / 2 gergi) — `fead-core.js`
  // ikisini de reddediyor (:371 ve :374) ama reddi ancak çözüm anında,
  // başka bir yüzeyde görünüyordu.
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

  // DAVRANIŞ 2026-09-22'DE DEĞİŞTİ ve bu test o gün TERS ÇEVRİLDİ.
  //
  // Eskiden yeni kasnak sıranın SONUNA düşüyordu (indissiz kasnağı
  // `veFeadBeltOrder` sona atıyor). Bedeli: "döngü otomatik gergiyle biter"
  // kuralı, kullanıcı bir kasnak ekler eklemez kırılıyor, gergi N−1'e kayıyor
  // ve `build.warnings` uyarı basıyordu — yani kullanıcı hiçbir şey yanlış
  // yapmadan modeli uyarılı hâle getiriyordu. Yeni kasnağın KOORDİNATI henüz
  // olmadığı için halkadaki yerini seçmek bedava (geometriye hiç girmiyor).
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
    // İNDİSLER 1..N'e oturmuş: kesirli indis kalıcı bir sıralama kuralı DEĞİL.
    expect(sira.map((n) => n.data.beltIndex))
      .toEqual(sira.map((_, i) => i + 1));
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
    const kanvas = ns.find((n) => n.type === 'fead-layout');
    const solver = ns.find((n) => n.type === 'fead-solver');
    expect(fead.veFeadTableDelete(kanvas.id)).toBe(false);
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

// ═══════════════════════════════════════════════════════════════════════════
//  GÖRÜNÜM CSS'TE — "DEMODE VE İLKEL"İN ASIL SEBEBİ TAŞIYICIYDI
// ═══════════════════════════════════════════════════════════════════════════
//
// Kullanıcı bildirimi (2026-09-09): *"'Kayış Tablosu' çok demode ve ilkel
// duruyor."* Kart baştan sona satır içi `style="…"` diziyordu ve o taşıyıcı
// DURUM İFADE EDEMEZ: `:hover`, `:focus`, `:nth-child` yazılamadığı için fare
// hangi satırdaysa, imleç hangi hücredeyse, hangi kasnağın paneli açıksa —
// üçü de görünmüyordu. Yani donukluk bir renk tercihi değil, o taşıyıcının
// sınırıydı.
//
// AŞAĞIDAKİ İKİ KAPI BİRLİKTE ÇALIŞIR ve ayrı ayrı hiçbir şey ifade etmezler:
// JS tarafı hücrelerin satır içi renk YAZMADIĞINI, CSS tarafı o rengi veren
// kuralların VAR OLDUĞUNU tutuyor. Yalnız birincisi olsaydı css bloğunu silmek
// bütün testleri yeşil bırakır, tablo da renksiz bir iskelete dönerdi.
describe('görünüm CSS\'te, satır içinde değil', () => {
  const fs = require('fs');
  const path = require('path');
  const CSS = fs.readFileSync(
    path.join(__dirname, '../../css/styles.css'), 'utf8');

  test('kart HTML\'i satır içi RENK / ÇERÇEVE / YAZI yazmıyor', () => {
    kurOrnek();
    const h = fead.veFeadTableCardHTML({ id: 't', type: 'fead-table',
      def: componentDefs['fead-table'], data: {} });
    const stiller = (h.match(/style="[^"]*"/g) || []);
    expect(stiller.length).toBeGreaterThan(0);          // bölge genişlikleri
    stiller.forEach((st) => {
      // İZİNLİ: bölge genişliği (özel özellik olarak) ve `display:inline`.
      // İlki VERİ — sütun ölçüsü tek kaynaktan geliyor ve CSS'te ikinci kez
      // yazılamaz; ikincisi boş durum metninin içindeki bir <b>'yi satır
      // içine çevirmek, bir tema kararı değil.
      expect(st).toMatch(/^style="(--fead-krt-[a-z]+:\d+px;\s*|display:inline;)+"$/);
    });
    // ÖLÜ VERİ YOK: çözüm bölgesi `1fr` olduğu için genişliği CSS'te
    // kullanılmıyor — kart onu basmıyor da. Bassaydı hiçbir şey yapmayan bir
    // sayı dolaşırdı ve bir sonraki okuyan onu kaynak sanırdı.
    expect(h).not.toContain('--fead-krt-coz');
    // TOPLAM İSE BASILIYOR ve okuyanı var: kartı EKRAN DIŞINDA yerleştiren
    // kılavuz sahne ölçekleyicisi (`guide-kit.js` → `_gkNaturalWidth`).
    // Bölgeleri toplamak çözüm bölgesini ATLIYOR — ölçüldü, 768 yerine 534,
    // yani sahne sığmadığı hâlde "sığıyor" sayılırdı ve baskıda kırpılırdı.
    expect(h).toContain('--fead-krt-en:' + fead.veFeadKartBolgeW() + 'px');
    expect(fead.veFeadKartBolgeW()).toBe(
      ['kim', 'gir', 'coz', 'son'].reduce((a, y) => a + fead.veFeadKartBolgeW(y), 0));
    // ...ve KÜNYEYE giden sütun toplama GİRMİYOR (listede yer kaplamıyor).
    expect(fead.veFeadKartBolgeW()).toBeLessThan(
      fead.VE_FEAD_TABLE_COLS.reduce((a, c) => a + c.w, 0));
    // Eski kartın imzası: her hücrede aksanın sabit yedeği. Geri gelirse tema
    // değişikliği tabloya geçmez — projenin kendi kuralı (--accent-tint-*).
    expect(h).not.toMatch(/#3b82f6|#f59e0b|#0f1115|#ef4444|#22c55e/);
    expect(h).not.toMatch(/style="[^"]*color:/);
    expect(h).not.toMatch(/style="[^"]*background/);
    expect(h).not.toMatch(/style="[^"]*border/);
    expect(h).not.toMatch(/style="[^"]*font-size/);
  });

  test('DURUM KURALLARI CSS\'te: fare · odak · seçili satır', () => {
    // Üçü de satır içi CSS'te YAZILAMAZ; tablonun donuk görünmesinin sebebi
    // buydu ve kapı tam olarak onların varlığını tutuyor.
    expect(CSS).toMatch(/\.ve-fead-krt:hover\s*\{/);
    expect(CSS).toMatch(/\.ve-fead-krt\.is-sel\s*\{/);
    expect(CSS).toMatch(/\.ve-fead-tbl-in:hover\s*\{/);
    expect(CSS).toMatch(/\.ve-fead-tbl-in:focus\s*\{/);
    expect(CSS).toMatch(/\.ve-fead-tbl-sel:focus\s*\{/);
    // İKİ DURUMLU SEGMENT: açık olan dolu, fare altındaki aksanlı, odak halkası
    // var. Üçü de `<select>` döneminde tarayıcıdan geliyordu; segmenti biz
    // çizdiğimiz için artık üçünü de yazmak ZORUNDAYIZ.
    expect(CSS).toMatch(/\.ve-fead-krt-seg button\.on\{/);
    expect(CSS).toMatch(/\.ve-fead-krt-seg button:hover\{/);
    expect(CSS).toMatch(/\.ve-fead-krt-seg button:focus-visible\{/);
    // ÇÖZÜM BÖLGESİNİN ZEMİNİ — `<col class="coz">` şeridinin yerini alan şey.
    // Ayrım artık bir sütun tonu değil bir YÜZEY: okuma bölgesi gömülü.
    expect(CSS).toMatch(/\.ve-fead-krt > \.coz\{[^}]*background:/);
    // ZEBRA YOK — kart listesinde satır zaten kendi kabında; ikinci bir ton
    // fare ve seçim vurgusunun üstüne binerdi.
    expect(CSS).not.toMatch(/\.ve-fead-krt:nth-child\(even\)/);
    // SİLME DİNLENMEDE GÖRÜNMEZ, satıra gelince belirir. `:hover` satır içi
    // CSS'te yazılamaz; kural buradan çıkarsa altı ✕ sürekli görünür kalır.
    expect(CSS).toMatch(/\.ve-fead-tbl-del\{[^}]*opacity:0;/);
    expect(CSS).toMatch(/\.ve-fead-krt:hover \.ve-fead-tbl-del/);
    // SÜRÜCÜ RAYI ve SEÇİM RAYI aynı kenarda: seçim SONRA tanımlı olmak
    // zorunda, yoksa sürücünün paneli açıkken işaret sürücü rayında kalır.
    expect(CSS.indexOf('.ve-fead-krt.drv{ box-shadow'))
      .toBeLessThan(CSS.indexOf('.ve-fead-krt.is-sel{ box-shadow'));
    // AD DÜĞMESİ: kabarma (gölge) · basılı hâl · paneli açık hâl. Üçü de satır
    // içi CSS'te yazılamaz ve üçü birlikte "burası bir pencere açar" diyor.
    expect(CSS).toMatch(/\.ve-fead-tbl-name:hover\{[^}]*box-shadow/);
    expect(CSS).toMatch(/\.ve-fead-tbl-name:active\{/);
    expect(CSS).toMatch(/\.ve-fead-krt\.is-sel \.ve-fead-tbl-name\{/);
    // Kimlik bölgesi gölgeyi kırpmıyor — kırpsaydı gölge hiç görünmezdi.
    expect(CSS).toMatch(/\.ve-fead-krt > \.kim\{[^}]*overflow:visible/);
    // Vurgular AKTİF AKSANDAN türer, sabit maviden değil: projenin on teması
    // tek renk dilini konuşsun (bkz. --accent-tint-* gerekçesi, styles.css).
    const blok = CSS.slice(CSS.indexOf('.ve-fead-table-card{'));
    expect(blok).toMatch(/var\(--accent-tint-/);
    expect(blok).toMatch(/var\(--focus-ring\)/);
    expect(blok).not.toMatch(/#[0-9a-fA-F]{6}/);
  });

  test('kart kabuğunun ölçüsü de CSS\'te — ikinci kopya yok', () => {
    // `veFeadApplyTableCard` bir zamanlar aynı yerleşimi cssText olarak da
    // yazıyordu; sınıf zaten var olduğu için ikisi ayrışabilirdi.
    const src = fs.readFileSync(path.join(__dirname, '../../js/cp-fead.js'), 'utf8');
    const fn = src.slice(src.indexOf('function veFeadApplyTableCard'));
    expect(fn.slice(0, fn.indexOf('\n}'))).not.toMatch(/cssText/);
    expect(CSS).toMatch(/\.ve-fead-table-card\{/);
  });
});

describe('yeni yüzeyin işlevleri', () => {
  test('SEÇİLİ SATIR işaretli — tablo ile panel arasındaki tek bağ', () => {
    const { ns } = kurOrnek();
    const alt = ns.filter((n) => n.id === 'ex-ALT')[0];
    const arg = { id: 't', type: 'fead-table',
                  def: componentDefs['fead-table'], data: {} };

    global.selectedNodes = [];
    expect(fead.veFeadTableCardHTML(arg)).not.toContain('class="is-sel"');

    // Adı tıklayıp paneli açtıktan sonra HANGİ satırın açık olduğu başka
    // hiçbir yerde yazmıyor: kutular kalktığı için kanvasta seçili bir kutu
    // da yok. İşaret olmasa kullanıcı paneldeki sayının hangi satıra ait
    // olduğunu tablodan okuyamazdı.
    global.selectedNodes = [alt];
    const h = fead.veFeadTableCardHTML(arg);
    expect((h.match(/ is-sel"/g) || []).length).toBe(1);
    expect(h).toContain('<div class="ve-fead-krt is-sel" data-ve-node="ex-ALT">');
    // Çok seçimde işaret YOK: "hangi kasnağın paneli açık" sorusunun tek
    // cevabı yokken bir satırı işaretlemek yanlış cevap vermek olurdu.
    global.selectedNodes = [alt, ns.filter((n) => n.id === 'ex-A_C')[0]];
    expect(fead.veFeadTableCardHTML(arg)).not.toContain('is-sel');
    global.selectedNodes = [];
  });

  // ── SEÇİM DEĞİŞİNCE İŞARET TAZELENİR — ÖLÇÜLMÜŞ HATA ────────────────────
  // Gerçek tarayıcıda çıktı (AG00976): işaret DOĞRU satıra konuyordu ama seçim
  // değiştiğinde hiç tazelenmiyordu, çünkü kart yalnız MODEL değişince yeniden
  // kuruluyor — panel açmak modeli değiştirmez. Sonuç işaretin olmamasından
  // KÖTÜ: tabloda bir satır işaretli duruyordu ve o satır paneli açık olan
  // kasnak DEĞİLDİ (yüklemenin son kurduğu kasnakta kalmıştı). Node'da
  // görünmezdi; kapı bu yüzden DOM üstünden ölçüyor.
  test('SEÇİM DEĞİŞİNCE işaret DOM\'da eşitlenir — kart yeniden KURULMADAN', () => {
    const { ns } = kurOrnek();
    document.body.innerHTML = '<div class="ve-fead-table-card">'
      + fead.veFeadTableCardHTML({ id: 't', type: 'fead-table',
          def: componentDefs['fead-table'], data: {} }) + '</div>';
    const isaretli = () => [...document.querySelectorAll('.ve-fead-krt.is-sel')]
      .map((tr) => tr.getAttribute('data-ve-node'));
    expect(isaretli()).toEqual([]);

    global.selectedNodes = [ns.filter((n) => n.id === 'ex-A_C')[0]];
    expect(fead.veFeadMarkSelectedRow()).toBe(1);
    expect(isaretli()).toEqual(['ex-A_C']);

    // İkinci seçim öncekini SÖNDÜRÜR — iki satır birden işaretli kalamaz.
    global.selectedNodes = [ns.filter((n) => n.id === 'ex-TEN')[0]];
    expect(fead.veFeadMarkSelectedRow()).toBe(2);
    expect(isaretli()).toEqual(['ex-TEN']);

    // Seçim boşalınca işaret de kalkar.
    global.selectedNodes = [];
    expect(fead.veFeadMarkSelectedRow()).toBe(1);
    expect(isaretli()).toEqual([]);

    // Değişiklik yoksa DOM'a HİÇ yazılmaz (her seçimde tablo kirletilmez).
    expect(fead.veFeadMarkSelectedRow()).toBe(0);
  });

  test('SEÇİM KAPISI cp-core\'un iki merkezinden de çağrılıyor', () => {
    // Kasnakların kutusu olmadığı için `addToSelection`'ın kutuya eklediği
    // `selected` sınıfı onlarda hiçbir şeye yazmıyor; işaretin tek yeri tablo.
    // Çağrı düşerse hata SESSİZ: tablo bir önceki seçimi göstermeye devam eder.
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
  // Kullanıcı isteği (2026-09-09): *"artık bu tablo üzerinden kasnakların
  // detay özelliklerine gireceğiz… tıklanınca açılır bir pencere olduğunu
  // belli eden bir yapı olsun."* Kasnakların kanvasta kutusu olmadığı için
  // panele giden TEK yol bu hücre; okunur bir metin olarak dururken varlığı
  // ancak DENEYEREK keşfediliyordu (altı çizili hâli yalnız fare üstüne
  // gelince beliriyordu, yani afordans ondan haberi olana görünüyordu).
  test('ad bir DÜĞME ve üstünde "pencere açılır" simgesi var', () => {
    kurOrnek();
    const h = fead.veFeadTableCardHTML({ id: 't', type: 'fead-table',
      def: componentDefs['fead-table'], data: {} });
    expect((h.match(/class="ve-fead-tbl-name"/g) || []).length).toBe(6);
    // SİMGE ÇİZİM, YAZI KARAKTERİ DEĞİL: `⧉` gibi bir glif konteynerin yazı
    // tipinde olmayabilir ve eksik glif tam da anlatması gereken şeyi yok eder.
    expect((h.match(/<svg class="ac"/g) || []).length).toBe(6);
    expect(h).not.toMatch(/⧉|⤢|↗/);
    expect(h).toContain('stroke="currentColor"');   // düğmenin durumunu izler
    // Simge TEK KOPYA bir sabitten geliyor, satır başına yeniden yazılmıyor.
    expect(typeof fead.VE_FEAD_TBL_OPEN_ICON).toBe('string');
    expect(h.split(fead.VE_FEAD_TBL_OPEN_ICON).length - 1).toBe(6);
    // Düğme KİMLİK bölgesinde, girdilerin arasında değil: basılan bir şey ile
    // yazılan bir şey aynı bölgede dursaydı "düğme dolu / alan boş" ayrımı
    // (modül skill'i 14) tek bakışta okunmazdı.
    const kim = h.match(/<div class="kim">[\s\S]*?<\/div>/g) || [];
    expect(kim).toHaveLength(6);
    kim.forEach((k) => {
      expect(k).toContain('class="ve-fead-tbl-name"');
      expect(k).not.toContain('ve-fead-tbl-in');      // yazılabilir alan YOK
    });
  });

  test('SÜRÜCÜ satırı sıra sütununda işaretli ve ▲ pasif', () => {
    kurOrnek();
    const h = fead.veFeadTableCardHTML({ id: 't', type: 'fead-table',
      def: componentDefs['fead-table'], data: {} });
    // İşaret ADDA değil SIRADA: sürücülüğün görünür sonucu sıraya dair —
    // kayış sırası ondan başlar, o yüzden satır kilitli. Ada çip koymak
    // 152 px'lik hücreden ~46 px alırdı, karşılığı olmadan.
    expect((h.match(/<b class="drv"/g) || []).length).toBe(1);
    // Satırın KENDİSİ de işaretli (`drv`): sol ray listeye bakar bakmaz
    // sıranın nerede başladığını söylüyor.
    const b0 = h.indexOf('<div class="ve-fead-krt drv"');
    expect(b0).toBeGreaterThan(-1);
    const ilk = h.slice(b0, h.indexOf('<div class="ve-fead-krt"', b0));
    expect(ilk).toContain('<b class="drv"');
    expect((ilk.match(/ve-fead-tbl-mv" disabled/g) || []).length).toBe(2);
    // Rol çipi de orada — "Sürücü" kelimesi listede bir kez geçiyor.
    expect((h.match(/<span class="ve-fead-krt-rz">Sürücü<\/span>/g) || []).length).toBe(1);
  });

  test('SIRA OKUNUN pasif hâli `disabled` — görünmez bir düğme değil', () => {
    kurOrnek();
    const h = fead.veFeadTableCardHTML({ id: 't', type: 'fead-table',
      def: componentDefs['fead-table'], data: {} });
    // Eskiden pasif okun yerine soluk bir <span> basılıyordu: klavyeyle
    // gezinen için o hiç var olmayan bir düğmeydi ve okuyucu "burada bir
    // eylem vardı ama kullanılamıyor" bilgisini hiç almıyordu.
    expect(h).not.toMatch(/opacity:0\.22/);
    expect((h.match(/<button[^>]*ve-fead-tbl-mv/g) || []).length).toBe(12);
    // ALTI pasif ok. DÖRDÜ eski kilitten: 1. satırın ikisi (sürücü kilitli),
    // 2. satırın ▲'sı (sürücünün üstüne çıkamaz), son satırın ▼'si.
    // İKİSİ 2026-09-22'de GERGİ KİLİDİNDEN geldi: gergi son satırda olduğu
    // için kendi ▲'sı ve bir üstteki satırın ▼'si de pasif — yoksa kullanıcı
    // ETKİN görünüp hiçbir şey yapmayan bir düğmeye basardı (bu depoda daha
    // önce ölçülmüş kusur sınıfı).
    expect((h.match(/ve-fead-tbl-mv" disabled/g) || []).length).toBe(6);

    // KİLİT YALNIZ KURAL YERİNDEYKEN: gergisi ortada duran bir kayıt okla
    // düzeltilebilmeli, yoksa kilit onu o hâlde DONDURURDU.
    const ten = global.nodes.find((n) => componentDefs[n.type].isFeadTensioner);
    const alt = global.nodes.find((n) => n.type === 'fead-alternator');
    const t0 = ten.data.beltIndex, a0 = alt.data.beltIndex;
    ten.data.beltIndex = a0; alt.data.beltIndex = t0;          // gergiyi ORTAYA al
    M.veFeadNormalizeBeltOrder(global.nodes);
    const h2 = fead.veFeadTableCardHTML({ id: 't', type: 'fead-table',
      def: componentDefs['fead-table'], data: {} });
    expect((h2.match(/ve-fead-tbl-mv" disabled/g) || []).length).toBe(4);
    // ve hüküm künyede GÖRÜNÜYOR (sıranın düzenlendiği yüzeyde).
    expect(h2).toContain('Gergi sonda değil');
    expect(h).not.toContain('Gergi sonda değil');              // kural yerindeyken sessiz
  });

  test('GERGİ SATIRININ X/Y\'si ne olduğunu SÖYLÜYOR', () => {
    kurOrnek();
    const h = fead.veFeadTableCardHTML({ id: 't', type: 'fead-table',
      def: componentDefs['fead-table'], data: {} });
    // O satırın alanı `cenX/cenY` — AVARA MERKEZİ; montaj konumu ondan
    // TÜREYEN bir çıktı (bkz. fead-model.js). Sütun başlığı "X" dediği için
    // hangi X olduğu yalnız burada yazılı.
    expect(h).toMatch(/title="X \(mm\) — avara merkezi[^"]*"[\s\S]{0,400}?veFeadTableSet\('ex-TEN','cenX'/);
    expect(h).toMatch(/title="Y \(mm\) — avara merkezi[^"]*"[\s\S]{0,400}?veFeadTableSet\('ex-TEN','cenY'/);
    // Kasnak satırlarında böyle bir not YOK — orada X sadece X.
    expect((h.match(/avara merkezi/g) || []).length).toBe(2);
    // Ve satır GERGİ olduğunu kimlik bölgesinde de söylüyor: not yalnız
    // `title`da dursaydı fareyi üstüne götürmeden görünmezdi.
    expect(h).toContain('<span class="ve-fead-krt-rz ten">Gergi</span>');
  });

  test('Σ SATIRI: gösterilen sütunların toplamı, yeni bir büyüklük DEĞİL', () => {
    const { build } = kurOrnek();
    const T = fead.veFeadTableRows(build);
    // Defterdeki SUM satırının karşılığı: kullanıcı sütunu seçince aldığı
    // sayının aynısı. Sunum katmanı kendi geometrisini hesaplamıyor (üç
    // katman kuralı) — toplananların her biri çekirdeğin çıktısı.
    const sar = T.rows.reduce((a, r) => a + r.wrapDeg, 0);
    const spn = T.rows.reduce((a, r) => a + r.spanMm, 0);
    expect(T.sumWrapDeg).toBeCloseTo(sar, 9);
    expect(T.sumSpanMm).toBeCloseTo(spn, 9);
    // Ve kimlik: kayış boyu = Σspan + Σyay. Σyay çekirdeğin kendi boyundan
    // kalıyor, ikinci bir formülle YENİDEN TÜRETİLMİYOR.
    const yay = T.rows.reduce((a, r) =>
      a + (r.wrapDeg * Math.PI / 180) * (r.effDiaMm / 2), 0);
    expect(T.sumSpanMm + yay).toBeCloseTo(T.LpitchMm, 6);

    const h = fead.veFeadTableCardHTML({ id: 't', type: 'fead-table',
      def: componentDefs['fead-table'], data: {} });
    // Σ ARTIK KÜNYEDE: listenin altındaki yapışkan şerit kalktı (kart
    // listesinde hizalanacak sütun yok, toplam bir sütunun altına düşemez) ve
    // çevrimin tamamına ait olan öteki sayılarla aynı yere geçti.
    expect(h).toContain('Σ toplam');
    expect(h).not.toContain('<tfoot>');
    const bas = h.indexOf('Σ toplam');
    expect(bas).toBeLessThan(h.indexOf('ve-fead-krt-wrap'));     // künyede
    expect(h).toContain('<b>' + T.sumWrapDeg.toFixed(1) + '° · '
                        + T.sumSpanMm.toFixed(1) + ' mm</b>');
  });

  test('BOŞ DURUM tablonun kendi ekleyicisini gösteriyor — palet SESSİZ', () => {
    global.nodes = []; global.connections = [];
    const h = fead.veFeadTableCardHTML({ id: 't', type: 'fead-table',
      def: componentDefs['fead-table'], data: {} });
    // Burada bir zamanlar "sol paletten ekleyin" yazıyordu ve o tavsiye
    // kutular kalktığından beri BAYAT: paletten sürüklenen kasnak kanvasta
    // hiçbir iz bırakmıyor, kullanıcı hiçbir şey olmadığını sanıyor.
    expect(h).not.toMatch(/paletten/i);
    expect(h).toContain('Kasnak ekle');
    expect(h).toContain('ve-fead-tbl-empty');
    // Boş listede Σ künyesi de basılmaz: toplanacak bir şey yok.
    expect(h).not.toContain('Σ toplam');
  });

  // TABLO KANVASTAN İNDİ (2026-09-23, Çizim Masası): bir KART değil, kanvas
  // kartının "Tablo" düğmesiyle açılan pencere. Tip, palet girdisi, paneli ve
  // kart ölçüsü sabitleri KALKTI; biri kalsa kanvasa yeniden bir form girerdi
  // — açılış yakınlaştırmasında 7,1 px'e küçülen (ölçüldü) aynı form.
  test('Kayış Tablosu bir kanvas bileşeni DEĞİL — tip, palet, panel ve ölçü yok', () => {
    expect(componentDefs['fead-table']).toBeUndefined();
    expect(typeof VE_FEAD_TABLE_W).toBe('undefined');
    expect(typeof VE_FEAD_TABLE_LEGACY).toBe('undefined');
    const html = require('fs').readFileSync(
      require('path').join(__dirname, '../../index.html'), 'utf8');
    expect(html).not.toMatch(/data-type="fead-table"/);
    expect(loadSource('cp-core.js')).not.toMatch(/'fead-table'/);
    expect(fead.getFeadTablePropertiesHTML).toBeUndefined();
    // Pencereye giden kapı kanvas kartının yüzen çubuğunda.
    expect(loadSource('cp-fead.js')).toMatch(/veFeadTabloDugmeHTML\(\) \+ '<\/div>'/);
    // Şema kartının yükseltme listesi bozulmadı (tek kapı).
    expect(veFeadLayoutSizeFor({ type: 'fead-layout', width: 420, height: 340 }))
      .toEqual({ w: VE_FEAD_LAYOUT_W, h: VE_FEAD_LAYOUT_H, changed: true });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  KART KÜÇÜLTÜLÜNCE İÇERİK KAYBOLUYORDU — EN KÜÇÜK ÖLÇÜ
// ═══════════════════════════════════════════════════════════════════════════
//
// Kullanıcı gibi kullanıldı (2026-09-11, gerçek tarayıcı) ve iki SESSİZ kayıp
// ölçüldü. İkisi de "bir şey patlamıyor, yalnız görünmüyor" sınıfından:
//
//   • 130 px yükseklikte gövdeye yer kalmıyor. Yapışkan başlık (50 px) ile
//     yapışkan Σ satırı (24 px) 48 px'lik kaydırma alanını tamamen örtüyor:
//     ALTI SATIRIN ALTISI DA görünmez oluyor ama Σ satırı hâlâ 663,4 ve
//     1048,7 yazıyor. Kart boş görünüyor, boş OLMADIĞINI yalnız toplamlar
//     söylüyor — yanıltıcı.
//   • 560 px genişlikte on bir sütunun altısı kayıyor (298 px gizli) ve
//     ölçülen yatay kaydırma çubuğu 0 px yer kaplıyor: kaybın işareti YOK.
//
// Kart BÜYÜTÜLEBİLİR; küçültme içeriğin bütün kaldığı yerde durur.
describe('en küçük ölçü — kart içeriğinin altına inmiyor', () => {
  // Kayış Tablosu kartı bu kuralın İLK kullanıcısıydı; tablo kanvastan inince
  // (2026-09-23) kart gitti, MEKANİZMA kaldı (kökteki CLAUDE.md'de genel kural).
  // Kapı artık sentetik bir tiple mekanizmayı ölçüyor; listenin bölge
  // tabanları ise pencerede de geçerli (daralır, kaybolmaz).
  test('liste bölgeleri TABANINI CSS\'te taşıyor — daralır, kaybolmaz', () => {
    const tabanlar = { kim: 150, gir: 210, coz: 160 };
    const cssBlok = require('fs').readFileSync(
      require('path').join(__dirname, '../../css/styles.css'), 'utf8');
    ['kim', 'gir'].forEach((y) => {
      expect(cssBlok).toContain('minmax(' + tabanlar[y] + 'px, var(--fead-krt-'
                                + y + ', auto))');
    });
    // ÇÖZÜM BÖLGESİ `1fr`: tabanı var ama tercih ettiği genişlik yok — ARTAN
    // NE İSE O. Bu yüzden `--fead-krt-coz` CSS'te KULLANILMIYOR.
    expect(cssBlok).toContain('minmax(' + tabanlar.coz + 'px, 1fr)');
    expect(cssBlok).not.toContain('var(--fead-krt-coz');
    expect(cssBlok).toContain('var(--fead-krt-son, auto);');
    // ÇEKMECEDE TAVAN (2026-09-24): tuvalin sütunu kadar geniş bir çekmecede
    // `1fr` üç türetilen sayıyı yayıyordu (1920 px'te ~320 px arayla). Orada
    // çözüm bölgesinin tavanı var; artan satırın SONUNDAKİ boş ize gider.
    const cekmece = cssBlok.match(/\.ve-fead-tablo-pencere \.ve-fead-krt\{\s*grid-template-columns:([^;]*);/);
    expect(cekmece).toBeTruthy();
    expect(cekmece[1]).toMatch(new RegExp('minmax\\(' + tabanlar.coz + 'px, \\d+px\\)'));
    expect(cekmece[1].trim()).toMatch(/1fr$/);
  });

  test('taban TİPTEN okunuyor — beyan etmeyen tip eski 50×50\'de kalıyor', () => {
    // Mekanizma genel: kart başına `if` yazılsaydı yeni bir kart eklendiğinde
    // sessizce tabansız kalırdı.
    expect(typeof veNodeMinSize).toBe('function');
    componentDefs['test-kart'] = { name: 'Deneme', minWidth: 300, minHeight: 120 };
    try {
      expect(veNodeMinSize({ type: 'test-kart' })).toEqual({ w: 300, h: 120 });
    } finally { delete componentDefs['test-kart']; }
    // Beyan etmeyen tip: eski taban.
    expect(veNodeMinSize({ type: 'fead-idler' })).toEqual({ w: 50, h: 50 });
    expect(veNodeMinSize(null)).toEqual({ w: 50, h: 50 });
    // `def` düğümün üstünde taşınıyorsa da okunur (kopyalanan düğüm yolu).
    expect(veNodeMinSize({ def: { minWidth: 111, minHeight: 222 } }))
      .toEqual({ w: 111, h: 222 });
  });

  test('TABANIN ALTINDA KAYITLI kart açılışta yükseliyor', () => {
    // Taban yalnız sürüklemeye konsaydı, kuraldan önce küçültülüp KAYDEDİLMİŞ
    // bir kart o bozuk hâlde açılmaya devam ederdi.
    componentDefs['test-kart'] = { name: 'Deneme', minWidth: 300, minHeight: 120 };
    try {
      expect(veFeadLayoutSizeFor({ type: 'test-kart', width: 200, height: 90 }))
        .toEqual({ w: 300, h: 120, changed: true });
      // Tek eksen de yeter — öteki bilerek verilmiş olabilir, korunur.
      expect(veFeadLayoutSizeFor({ type: 'test-kart', width: 1400, height: 100 }))
        .toEqual({ w: 1400, h: 120, changed: true });
      // TABANIN ÜSTÜNDEKİ ölçüye DOKUNULMUYOR.
      expect(veFeadLayoutSizeFor({ type: 'test-kart', width: 1000, height: 500 }).changed)
        .toBe(false);
    } finally { delete componentDefs['test-kart']; }
    // Taban BEYAN ETMEYEN kart etkilenmiyor.
    expect(veFeadLayoutSizeFor({ type: 'fead-layout', width: 120, height: 90 }).changed)
      .toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  EKLENEN SATIR GÖRÜNÜR OLMALI
// ═══════════════════════════════════════════════════════════════════════════
//
// ÖLÇÜLDÜ (2026-09-11, gerçek tarayıcı): varsayılan kartta yedinci kasnak
// eklendiğinde satır listenin dibinin 35 px ALTINA düşüyor ve tablo hiç
// kaymıyor (scrollTop 0'da kalıyor). Kullanıcı "＋ Kasnak ekle" diyor, paneli
// açılıyor, ama DOLDURACAĞI SATIR ekranda yok.
describe('eklenen satır görünür kılınıyor', () => {
  test('ekleyici satırı görüş alanına ALIYOR — ve zaten görünense DOKUNMUYOR', () => {
    kurOrnek();
    // Tablo PENCERESİNİ aç ki satırlar gerçekten var olsun (tablo kanvastan
    // indi, 2026-09-23 — satırlar artık pencerede).
    const kap = document.createElement('div');
    kap.id = 've-canvas-wrapper';
    document.body.appendChild(kap);
    expect(fead.veFeadTabloAc()).toBe(true);

    const cagri = [];
    document.querySelectorAll('.' + fead.VE_FEAD_TABLE_CLASS + ' .ve-fead-krt[data-ve-node]')
      .forEach((tr) => { tr.scrollIntoView = (o) => cagri.push([tr.getAttribute('data-ve-node'), o]); });

    // Var olan bir satır: çağrılıyor ama `nearest` — görünen satır listeyi
    // ZIPLATMAZ. ('center' olsaydı her ekleme listeyi oynatırdı.)
    expect(fead._feadScrollRowIntoView('ex-ALT')).toBe(true);
    expect(cagri).toHaveLength(1);
    expect(cagri[0][0]).toBe('ex-ALT');
    expect(cagri[0][1].block).toBe('nearest');

    // Olmayan satır sessizce yutuluyor — kart kurulu değilken de çağrılıyor.
    expect(fead._feadScrollRowIntoView('yok-boyle-bir-id')).toBe(false);
    expect(fead._feadScrollRowIntoView(null)).toBe(false);
    expect(cagri).toHaveLength(1);
    fead.veFeadTabloKapat();
    document.body.innerHTML = '';
  });

  test('veFeadTableAdd kaydırmayı TAZELEMEDEN SONRA çağırıyor', () => {
    // Sıra kritik: satır `veFeadRefreshCards` ile doğuyor, öncesinde DOM'da
    // yok — kaydırma önce çağrılsaydı hiçbir şey bulamaz ve sessizce
    // hiçbir şey yapmazdı.
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
// Kasnakların kanvasta kutusu yok; detay panele giden TEK yol bu hücre ve
// hücre "pencere açılır" simgesi taşıyor. `addToSelection` panelin İÇERİĞİNİ
// doldurur ama `#ve-properties-overlay` bir MODAL'dır ve kapalı kalır
// (map.js veTogglePropertiesPanel). Ölçüldü (gerçek tarayıcı): ada tıklanınca
// satır işaretleniyor, panelin HTML'i kuruluyor, ekranda hiçbir şey olmuyordu.
//
// Kapı çağrının KENDİSİNİ tutuyor, çünkü ayrışma SESSİZ: seçim doğru, içerik
// doğru, yalnız pencere görünmüyor — hiçbir şey patlamıyor.
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
    // ASIL KAPI: pencere açma çağrısı — yoksa panel dolu ama görünmez.
    expect(global.veTogglePropertiesPanel).toHaveBeenCalledWith(true);
  });

  test('olmayan kasnakta pencere AÇILMIYOR', () => {
    kur();
    expect(fead.veFeadTableOpen('yok-boyle-bir-id')).toBe(false);
    expect(global.veTogglePropertiesPanel).not.toHaveBeenCalled();
  });

  test('veTogglePropertiesPanel yokken PATLAMIYOR (yükleme sırası sözleşmesi)', () => {
    // cp-fead.js map.js'ten ÖNCE yüklenebiliyor; çıplak çağrı ReferenceError
    // atardı ve seçim de yapılmamış olurdu.
    kur();
    delete global.veTogglePropertiesPanel;
    expect(() => fead.veFeadTableOpen('ex-ALT')).not.toThrow();
    expect(global.addToSelection).toHaveBeenCalled();
  });

  test('ad hücresinin onclick\'i veFeadTableOpen — kapının gerçekten kablosu var', () => {
    const src = require('fs').readFileSync(
      require('path').join(__dirname, '../../js/cp-fead.js'), 'utf8');
    // Hücre bir DÜĞME ve onclick'i bu fonksiyon; sınıf adı değişse de kablo
    // bu iki parçanın yan yana durmasıyla ölçülüyor.
    expect(src).toContain('class="ve-fead-tbl-name"');
    expect(src).toMatch(/onclick="veFeadTableOpen\(/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  KARTIN TAŞIMA TUTAMAĞI
// ═══════════════════════════════════════════════════════════════════════════
//
// Kullanıcı bildirimi (2026-09-22): *"Tablo taşıması düzelmemiş."* Ölçüldü
// (gerçek tarayıcı, AG00976): kart YALNIZ üstteki künye şeridinden
// taşınıyordu; kasnak listesinin gövdesi taşımıyordu. Kusur "kart taşınmıyor"
// değil, İMLECİN YALAN SÖYLEMESİYDİ: `.ve-node{cursor:move}` kartın
// tamamında taşıma imleci gösteriyor, ama liste mousedown'ı yutuyor (yutmak
// ZORUNDA — yoksa bir alana yazmak kartı taşırdı). Kullanıcı imlecin
// gösterdiği yerden tutuyor ve hiçbir şey olmuyordu.
//
// #932 bu davranışı "künyeden sürükleme kartı taşıyor / gövdeden taşımıyor"
// diye EL ile ölçmüş ama o turda eklenen altı kapının hiçbiri sürüklemeyi
// tutmuyordu — bu yüzden ne bozulduğu ne de keşfedilemez olduğu görüldü.
//
// KURAL: kartın KÜNYESİ taşır, VERİ yüzeyi taşımaz, ve İMLEÇ ikisini de doğru
// söyler. Tutamak ayrıca GÖRÜNÜR (nokta ızgarası) — asıl kusur onun hiçbir
// işaret taşımamasıydı.
describe('kart taşıma tutamağı — künye taşır, liste taşımaz', () => {
  const fs = require('fs');
  const path = require('path');
  const CSS = fs.readFileSync(path.join(__dirname, '../../css/styles.css'), 'utf8');

  // İMLEÇ KAPISI. Gerçek sürükleme jsdom'da koşamaz (olay kabarması ve
  // `getComputedStyle(cursor)` yok) — o halka `fead-tablo.spec.js` → "KART
  // TAŞIMA"da. Buradaki kapı KURALIN CSS'te var olduğunu tutuyor; ikisi ayrı
  // ayrı anlamsız: E2E olmadan kural yazılıp uygulanmayabilir, bu olmadan
  // CSS bloğu silinince E2E'nin neden kırmızıya döndüğü anlaşılmaz.
  test('İMLEÇ künye ile veri yüzeyini AYIRIYOR (kural CSS\'te)', () => {
    const blok = CSS.slice(CSS.indexOf('.ve-fead-table-card{'));
    // Künye: taşır ve öyle der.
    expect(blok).toMatch(/\.ve-fead-tbl-head\{[^}]*cursor:move;/);
    // Veri yüzeyi: `.ve-node{cursor:move}` buraya kadar iniyordu.
    expect(blok).toMatch(/\.ve-fead-krt-wrap\{[^}]*cursor:default;/);
    expect(blok).toMatch(/cursor:text;/);
  });

  // TUTAMAK GÖRÜNÜR: nokta ızgarası ÇİZİM (yazı karakteri değil — eksik bir
  // glif afordansın kendisini yok ederdi, ad hücresindeki kuralın aynısı) ve
  // DİNLENMEDE de duruyor (yalnız fare üstündeyken belirse keşfedilemezlik
  // aynen sürerdi).
  test('TUTAMAK GÖRÜNÜR — nokta ızgarası, çizim, dinlenmede de var', () => {
    const blok = CSS.slice(CSS.indexOf('.ve-fead-table-card{'));
    expect(blok).toMatch(/\.ve-fead-tbl-head::before\{/);
    expect(blok).toMatch(/\.ve-fead-tbl-head::before\{[^}]*radial-gradient/);
    // `content` BOŞ: ızgara arka plandan geliyor, bir karakterden değil.
    expect(blok).not.toMatch(/\.ve-fead-tbl-head::before\{[^}]*content:"[^"]+"/);
    // Dinlenmede opaklık sıfır DEĞİL.
    const m = /\.ve-fead-tbl-head::before\{([^}]*)\}/.exec(blok);
    expect(m).toBeTruthy();
    expect(/opacity:0;/.test(m[1])).toBe(false);
  });

  // KASNAK LİSTESİ MOUSEDOWN'I YUTMAYA DEVAM EDİYOR — kural bunun ÜSTÜNE
  // kuruldu, yerine değil. Yutma kalkarsa bir alana yazmak kartı taşır.
  test('liste kabı mousedown\'ı yutmayı SÜRDÜRÜYOR', () => {
    kurOrnek();
    const h = fead.veFeadTableCardHTML({ id: 't', type: 'fead-table',
      def: componentDefs['fead-table'], data: {} });
    expect(h).toMatch(/class="ve-fead-krt-wrap" onmousedown="event\.stopPropagation\(\);"/);
  });
});
