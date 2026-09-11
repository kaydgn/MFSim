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
  // BAŞLIKTA AD İLE BİRİM AYRI SATIRDA. `X(mm)` bir başlıktan çok bir değişken
  // adı gibi okunuyordu; kapı ikisinin de basıldığını ama BİTİŞİK BASILMADIĞINI
  // tutuyor — birleşik yazım geri gelirse sütun yeniden genişler ve iki
  // satırlık başlığın kazandırdığı genişlik geri kaybedilir.
  test('sütun başlıkları defterin adları, birimleri KENDİ satırında', () => {
    kurOrnek();
    const h = fead.veFeadTableCardHTML({ id: 't', type: 'fead-table',
      def: componentDefs['fead-table'], data: {} });
    // Kullanıcının hesap sayfasındaki adlar — tablonun varlık sebebi bu
    // sütunlarla birebir olması.
    ['KASNAK', 'Efektif Çap', 'Kasnak Dönüş Yönü', 'Sarım Açısı',
     'Span Uzunluğu', 'Kayış Uzunluğu'].forEach((t) => expect(h).toContain(t));
    expect(h).not.toContain('X(mm)');
    expect(h).not.toContain('Efektif Çap(mm)');
    // Birimi olan HER sütun birimini kendi satırında basıyor (tek kaynak:
    // VE_FEAD_TABLE_COLS — burada ikinci bir liste tutulmuyor).
    const birimli = fead.VE_FEAD_TABLE_COLS.filter((c) => c.u);
    expect(birimli.length).toBe(7);
    expect((h.match(/class="ve-fead-tbl-unit"/g) || []).length).toBe(birimli.length);
    birimli.forEach((c) => {
      expect(h).toContain(c.t + '<span class="ve-fead-tbl-unit">' + c.u + '</span>');
    });
    // Üst künye: kayış + marka + kasnak sayısı (+ tabloda kayış uzunluğu)
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

  test('sütun genişlikleri TEK KAYNAKTAN ve kart genişliğiyle tutarlı', () => {
    const toplam = fead.VE_FEAD_TABLE_COLS.reduce((a, c) => a + c.w, 0);
    expect(toplam).toBeLessThanOrEqual(VE_FEAD_TABLE_W);
    expect(VE_FEAD_TABLE_W - toplam).toBeLessThan(24);      // kenar payı, fazlası değil
    expect(componentDefs['fead-table'].defaultWidth).toBe(VE_FEAD_TABLE_W);
    expect(componentDefs['fead-table'].defaultHeight).toBe(VE_FEAD_TABLE_H);
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
    expect(h.indexOf('ve-fead-tbl-durum')).toBeLessThan(h.indexOf('<table'));
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

  // ── TÜRETİLEN SÜTUN ŞERİDİ ─────────────────────────────────────────────
  // Künyede iki satırlık bir lejant vardı: "123 girilir · 123 çözümden". SÖZLE
  // anlatıyordu ve okunduktan sonra hangi sütunun hangisi olduğu yine hücrenin
  // görünümünden çıkarılmak zorundaydı. Şerit sütunun KENDİSİNDE duruyor ve
  // sıraya (defterle birebir) hiç dokunmuyor.
  //
  // KAPI SABİT BİR LİSTE DEĞİL, BİR KURAL: bant tam olarak DEĞERİ ÇÖZÜMDEN
  // GELEN sütunlarda. Liste yazılsaydı yeni bir türetilen sütun eklenince
  // sessizce bantsız kalırdı.
  test('BANT tam olarak ÇÖZÜMDEN GELEN sütunlarda — lejant KALKTI', () => {
    kurOrnek();
    const h = fead.veFeadTableCardHTML({ id: 't', type: 'fead-table',
      def: componentDefs['fead-table'], data: {} });
    const kap = document.createElement('div');
    kap.innerHTML = h;
    const C = fead.VE_FEAD_TABLE_COLS;
    const cols = kap.querySelectorAll('colgroup > col');
    const tds = kap.querySelectorAll('tbody tr:first-child > td');
    expect(cols).toHaveLength(C.length);
    expect(tds).toHaveLength(C.length);            // ilk satırda birleşik hücre de var
    C.forEach((c, i) => {
      const yazilir = !!tds[i].querySelector('input, select');
      const deger = tds[i].classList.contains('ve-fead-tbl-ro')
                 || tds[i].classList.contains('ve-fead-tbl-L');
      expect(!!c.coz).toBe(deger);                 // kural: değer okunuyorsa bantlı
      expect(cols[i].classList.contains('coz')).toBe(!!c.coz);
      if (yazilir) expect(!!c.coz).toBe(false);    // yazılan hiçbir sütun bantlı değil
    });
    expect(C.filter((c) => c.coz).map((c) => c.k))
      .toEqual(['eff', 'sar', 'span', 'kayis']);
    expect(h).not.toContain('ve-fead-tbl-lgn');
    expect(h).not.toMatch(/girilir|çözümden/);
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
    const hucre = [...kap.querySelectorAll('tbody td.ve-fead-tbl-ro')]
      .map((td) => td.textContent);
    expect(hucre).toHaveLength(18);                // 6 satır × (eff, sarım, span)
    hucre.forEach((t) => expect(t).toMatch(/^-?\d+\.\d$/));
    // Σ satırı da AYNI basamakta: aynı sütunda iki farklı yuvarlama okunmaz.
    const tf = kap.querySelectorAll('tfoot td');
    expect(tf[1].textContent).toMatch(/^-?\d+\.\d$/);
    expect(tf[2].textContent).toMatch(/^-?\d+\.\d$/);
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
    expect(h.indexOf('ve-fead-tbl-ekle')).toBeGreaterThan(h.indexOf('</table>'));

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
    const trs = [...kap.querySelectorAll('tbody tr')];
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
    const tr0 = kap2.querySelector('tbody tr');
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
    expect(h).toContain('Kayış Uzunluğu<span class="ve-fead-tbl-unit">mm</span>');
    // Defterde K5:K10 birleştirilmiş — burada rowspan, kasnak sayısı kadar.
    expect((h.match(/rowspan="6"/g) || []).length).toBe(1);
    // Üst künyeden kalktı: aynı sayıyı iki yerde göstermek ikinci bir kopya olurdu.
    expect(h.split('Kayış Uzunluğu').length - 1).toBe(1);
  });

  test('sütun sayısı ON BİR ve genişlikler kart ölçüsüyle tutarlı', () => {
    // Onbirinci sütun SİLME. Sıra oklarıyla aynı hücrede dururken sık yapılan
    // işlem ile geri dönüşü olmayan işlem bitişikti (indis + ▲▼ + ✕ / 70 px /
    // 9 px yazı) — ayrı sütun bir kozmetik değil bir ölçü kararı.
    expect(fead.VE_FEAD_TABLE_COLS).toHaveLength(11);
    expect(fead.VE_FEAD_TABLE_COLS[9].k).toBe('kayis');
    expect(fead.VE_FEAD_TABLE_COLS[10].k).toBe('sil');
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
    expect(stiller.length).toBeGreaterThan(0);          // colgroup ölçüleri
    stiller.forEach((st) => {
      // İZİNLİ: genişlik ve hücre payı. İkisi de VERİ (sütun ölçüsü tek
      // kaynaktan geliyor), tema değil — bir stil dosyasında duramazlar.
      expect(st).toMatch(/^style="(width:\d+px;|padding:(0|[\d ]+px)( \d+px)?;)+"$/);
    });
    // Eski kartın imzası: her hücrede aksanın sabit yedeği. Geri gelirse tema
    // değişikliği tabloya geçmez — projenin kendi kuralı (--accent-tint-*).
    expect(h).not.toMatch(/#3b82f6|#f59e0b|#0f1115|#ef4444|#22c55e/);
    expect(h).not.toMatch(/style="[^"]*color:/);
    expect(h).not.toMatch(/style="[^"]*background/);
    expect(h).not.toMatch(/style="[^"]*border/);
    expect(h).not.toMatch(/style="[^"]*font-size/);
  });

  test('DURUM KURALLARI CSS\'te: fare · odak · seçili satır · zebra', () => {
    // Dördü de satır içi CSS'te YAZILAMAZ; tablonun donuk görünmesinin sebebi
    // buydu ve kapı tam olarak onların varlığını tutuyor.
    expect(CSS).toMatch(/\.ve-fead-tbl tbody tr:hover\s*\{/);
    expect(CSS).toMatch(/\.ve-fead-tbl tbody tr\.is-sel\s*\{/);
    expect(CSS).toMatch(/\.ve-fead-tbl-in:hover\s*\{/);
    expect(CSS).toMatch(/\.ve-fead-tbl-in:focus\s*\{/);
    expect(CSS).toMatch(/\.ve-fead-tbl-sel:focus\s*\{/);
    // TÜRETİLEN SÜTUN ŞERİDİ — `<col>` zemini satır içi yazılabilirdi ama
    // zebra/fare/seçim vurgusuyla katman sırası ancak stil dosyasında kurulur.
    expect(CSS).toMatch(/\.ve-fead-tbl col\.coz\{/);
    // ZEBRA YOK — ve olmaması bir ihmal değil ölçüm: `rowspan`lı kayış boyu
    // hücresi zebrayı atlıyor, kartın sağ ucunda gri/beyaz merdiven kalıyordu.
    expect(CSS).not.toMatch(/\.ve-fead-tbl tbody tr:nth-child\(even\)/);
    // SİLME DİNLENMEDE GÖRÜNMEZ, satıra gelince belirir. `:hover` satır içi
    // CSS'te yazılamaz; kural buradan çıkarsa altı ✕ sürekli görünür kalır.
    expect(CSS).toMatch(/\.ve-fead-tbl-del\{[^}]*opacity:0;/);
    expect(CSS).toMatch(/\.ve-fead-tbl tbody tr:hover \.ve-fead-tbl-del/);
    // SÜRÜCÜ RAYI ve SEÇİM RAYI aynı kenarda: seçim SONRA tanımlı olmak
    // zorunda, yoksa sürücünün paneli açıkken işaret sürücü rayında kalır.
    expect(CSS.indexOf('tr.drv td:first-child'))
      .toBeLessThan(CSS.indexOf('tr.is-sel td:first-child'));
    // AD DÜĞMESİ: kabarma (gölge) · basılı hâl · paneli açık hâl. Üçü de satır
    // içi CSS'te yazılamaz ve üçü birlikte "burası bir pencere açar" diyor.
    expect(CSS).toMatch(/\.ve-fead-tbl-name:hover\{[^}]*box-shadow/);
    expect(CSS).toMatch(/\.ve-fead-tbl-name:active\{/);
    expect(CSS).toMatch(/tr\.is-sel \.ve-fead-tbl-name\{/);
    // Hücre gölgeyi kırpmıyor — kırpsaydı gölge hiç görünmezdi.
    expect(CSS).toMatch(/\.ve-fead-tbl td\.ad-cell\{[^}]*overflow:visible/);
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
    expect((h.match(/class="is-sel"/g) || []).length).toBe(1);
    expect(h).toContain('<tr data-ve-node="ex-ALT" class="is-sel">');
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
    // Ve hücre gölgeyi KIRPMIYOR — `td`nin genel overflow:hidden'ı gölgeyi de
    // 1 px'lik kalkışı da keserdi, yani "gölge olsun" isteği sessizce hiçbir
    // şey yapmazdı.
    expect((h.match(/class="al-l ad-cell"/g) || []).length).toBe(6);
  });

  test('SÜRÜCÜ satırı sıra sütununda işaretli ve ▲ pasif', () => {
    kurOrnek();
    const h = fead.veFeadTableCardHTML({ id: 't', type: 'fead-table',
      def: componentDefs['fead-table'], data: {} });
    // İşaret ADDA değil SIRADA: sürücülüğün görünür sonucu sıraya dair —
    // kayış sırası ondan başlar, o yüzden satır kilitli. Ada çip koymak
    // 152 px'lik hücreden ~46 px alırdı, karşılığı olmadan.
    expect((h.match(/<b class="drv"/g) || []).length).toBe(1);
    const b0 = h.indexOf('<tbody>');
    const ilk = h.slice(b0, h.indexOf('</tr>', b0));
    expect(ilk).toContain('<b class="drv"');
    expect((ilk.match(/ve-fead-tbl-mv" disabled/g) || []).length).toBe(2);
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
    // DÖRT pasif ok, üç değil: 1. satırın ikisi (sürücü kilitli), 2. satırın
    // ▲'sı (sürücünün üstüne çıkamaz) ve son satırın ▼'si.
    expect((h.match(/ve-fead-tbl-mv" disabled/g) || []).length).toBe(4);
  });

  test('GERGİ SATIRININ X/Y\'si ne olduğunu SÖYLÜYOR', () => {
    kurOrnek();
    const h = fead.veFeadTableCardHTML({ id: 't', type: 'fead-table',
      def: componentDefs['fead-table'], data: {} });
    // O satırın alanı `cenX/cenY` — AVARA MERKEZİ; montaj konumu ondan
    // TÜREYEN bir çıktı (bkz. fead-model.js). Sütun başlığı "X" dediği için
    // hangi X olduğu yalnız burada yazılı.
    expect(h).toMatch(/title="Avara merkezi X[^"]*"[^>]*onchange="veFeadTableSet\('ex-TEN','cenX'/);
    expect(h).toMatch(/title="Avara merkezi Y[^"]*"[^>]*onchange="veFeadTableSet\('ex-TEN','cenY'/);
    // Kasnak satırlarında böyle bir not YOK — orada X sadece X.
    expect((h.match(/Avara merkezi/g) || []).length).toBe(2);
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
    expect(h).toContain('<tfoot>');
    expect(h).toContain('Σ toplam');
    expect(h).toContain('Σspan + Σyay');
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
    // Boş tabloda Σ satırı da basılmaz: toplanacak bir şey yok.
    expect(h).not.toContain('<tfoot>');
  });

  test('KART ÖLÇÜSÜ yeniden türedi ve eski ölçü YÜKSELİYOR', () => {
    // Ölçüldü (AG00976, 6 kasnak): 430 px'lik kartta içerik 200 px yer
    // kaplıyordu, yani kartın 230 px'i boştu. Yeni ölçü sekiz kasnak +
    // künye + iki satırlık başlık + Σ satırı + alt şerit içindir.
    expect(VE_FEAD_TABLE_H).toBe(340);
    const toplam = fead.VE_FEAD_TABLE_COLS.reduce((a, c) => a + c.w, 0);
    expect(VE_FEAD_TABLE_W - toplam).toBeLessThan(24);

    // Kayıtlı bir proje eski ölçüde açılsaydı aynı sürümde iki farklı tablo
    // görünümü dolaşırdı — Kayış Yolu kartındaki kuralın aynısı.
    expect(VE_FEAD_TABLE_LEGACY).toContainEqual({ w: 824, h: 430 });
    expect(veFeadLayoutSizeFor({ type: 'fead-table', width: 824, height: 430 }))
      .toEqual({ w: VE_FEAD_TABLE_W, h: VE_FEAD_TABLE_H, changed: true });
    // BİLEREK verilmiş ölçü korunur.
    expect(veFeadLayoutSizeFor({ type: 'fead-table', width: 900, height: 500 }).changed)
      .toBe(false);
    // Şema kartının kendi listesi bozulmadı (tek kapı, iki kart).
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
  test('Kayış Tablosu tabanını BEYAN EDİYOR ve taban sütunlardan geri kalmıyor', () => {
    const def = componentDefs['fead-table'];
    expect(def.minWidth).toBe(VE_FEAD_TABLE_MIN_W);
    expect(def.minHeight).toBe(VE_FEAD_TABLE_MIN_H);
    // GENİŞLİK TABANI SÜTUNLARDAN GERİ KALAMAZ: bir sütun eklenirse taban da
    // büyümeli, yoksa yeni sütun ilk daraltmada sessizce kayar.
    const toplam = fead.VE_FEAD_TABLE_COLS.reduce((a, c) => a + c.w, 0);
    expect(VE_FEAD_TABLE_MIN_W).toBeGreaterThanOrEqual(toplam);
    // YÜKSEKLİK TABANI: künye + iki satırlık başlık + İKİ veri satırı + Σ +
    // ekleme şeridi. Altındaki her değer gövdeyi yapışkan iki şeridin
    // arasında eziyor.
    expect(VE_FEAD_TABLE_MIN_H).toBeGreaterThanOrEqual(24 + 50 + 2 * 34 + 24 + 36);
    // Ve taban VARSAYILANI aşmıyor — aşsaydı kart açılışta kendi tabanının
    // altında doğardı.
    expect(VE_FEAD_TABLE_MIN_W).toBeLessThanOrEqual(VE_FEAD_TABLE_W);
    expect(VE_FEAD_TABLE_MIN_H).toBeLessThanOrEqual(VE_FEAD_TABLE_H);
  });

  test('taban TİPTEN okunuyor — beyan etmeyen tip eski 50×50\'de kalıyor', () => {
    // Mekanizma genel: kart başına `if` yazılsaydı üçüncü kart eklendiğinde
    // sessizce tabansız kalırdı.
    expect(typeof veNodeMinSize).toBe('function');
    expect(veNodeMinSize({ type: 'fead-table' }))
      .toEqual({ w: VE_FEAD_TABLE_MIN_W, h: VE_FEAD_TABLE_MIN_H });
    // Beyan etmeyen tip: eski taban.
    expect(veNodeMinSize({ type: 'fead-idler' })).toEqual({ w: 50, h: 50 });
    expect(veNodeMinSize(null)).toEqual({ w: 50, h: 50 });
    // `def` düğümün üstünde taşınıyorsa da okunur (kopyalanan düğüm yolu).
    expect(veNodeMinSize({ def: { minWidth: 111, minHeight: 222 } }))
      .toEqual({ w: 111, h: 222 });
  });

  test('TABANIN ALTINDA KAYITLI kart açılışta yükseliyor', () => {
    // Taban yalnız sürüklemeye konsaydı, bu kural gelmeden önce küçültülüp
    // KAYDEDİLMİŞ bir kart o bozuk hâlde açılmaya devam ederdi.
    expect(veFeadLayoutSizeFor({ type: 'fead-table', width: 300, height: 130 }))
      .toEqual({ w: VE_FEAD_TABLE_MIN_W, h: VE_FEAD_TABLE_MIN_H, changed: true });
    // Tek eksen de yeter — öteki bilerek verilmiş olabilir, korunur.
    expect(veFeadLayoutSizeFor({ type: 'fead-table', width: 1400, height: 120 }))
      .toEqual({ w: 1400, h: VE_FEAD_TABLE_MIN_H, changed: true });
    // TABANIN ÜSTÜNDEKİ ölçüye DOKUNULMUYOR (eski kart yükseltme listesi de
    // bozulmadı — o hâlâ tam eşleşmeyle çalışıyor).
    expect(veFeadLayoutSizeFor({ type: 'fead-table', width: 1000, height: 500 }).changed)
      .toBe(false);
    expect(veFeadLayoutSizeFor({ type: 'fead-table', width: 824, height: 430 }))
      .toEqual({ w: VE_FEAD_TABLE_W, h: VE_FEAD_TABLE_H, changed: true });
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
    const { ns } = kurOrnek();
    // Kartı DOM'a kur ki satırlar gerçekten var olsun.
    const d = componentDefs['fead-table'];
    ns.push({ id: 'kart', type: 'fead-table', def: d, x: 0, y: 0,
              width: d.defaultWidth, height: d.defaultHeight, data: {} });
    const el = document.createElement('div');
    el.id = 'kart';
    el.innerHTML = '<div class="ve-node-box"></div>';
    document.body.appendChild(el);
    expect(fead.veFeadRefreshCards()).toBeGreaterThan(0);

    const cagri = [];
    document.querySelectorAll('.' + fead.VE_FEAD_TABLE_CLASS + ' tbody tr[data-ve-node]')
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
