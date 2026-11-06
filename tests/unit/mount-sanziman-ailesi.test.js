/**
 * mount-sanziman-ailesi.test.js — ŞANZIMAN AİLESİ: Allison 4000 (2026-11-06)
 * ─────────────────────────────────────────────────────────────────────────
 * Kullanıcının gönderdiği "4000 Product Family Transmission Data" (15.10.2020)
 * ailenin bütün modellerini seçenekleriyle veriyor. Programda TEK kayıt, seçenekler
 * anahtarda (dişli düzeni · bağlama · PTO · retarder · soğutucu · karter ·
 * akümülatör · çıkış flanşı · yağ yoğunluğu). Önce (main cbff5d4): şanzımanın
 * kataloğu boştu — kütle, ağırlık merkezi ve atalet yalnız geometriden; vites
 * oranları ve stall oranı elle; 7. vites alanı yoktu.
 *
 *   · AİLE — belgenin tabloları birebir (§8 kuru kütleler, §9 ağırlık merkezi 28
 *     satır, §11 atalet 10 satır, §13 yağ, §12 oranlar, §6 konvertörler, §10 sınır);
 *     tablolar burada İKİNCİ kez, belgenin satır düzeninde yazılı (kataloğun
 *     yazımından bağımsız). Bilinen tutarsızlık: §9.1'in bir satırında mm ↔ inç.
 *   · SEÇENEK — bağdaşmayan değer geçersiz; değişiklik ötekini ilk izinli değere
 *     çeker; bozuk anahtar kayıt vermez; kanonik anahtar; aynı anahtar aynı nesne.
 *   · KÜTLE — toplam: kuru = donanım + flanş, ıslak = kuru + yağ; uzak soğutucu
 *     gövdeye girmez.
 *   · YÖN — Allison'un sistemi (X arkaya, Y aşağı, Z sağa) → programın (x arkaya,
 *     y sağa, z yukarı): ağırlık merkezi R + (X; Z; −Y).
 *   · STEP — 3B'de seçilen ön yüz ve eksen: hesap ve aktarım (bağlantı yüzü dâhil).
 *   · OTURUM — kart ve 3B: liste, seçenek satırları, kapalı seçeneğin sebebi,
 *     ailenin satırı seçenekleri sıfırlamaz, aralık dışı sayı yazılmaz.
 *   · PENCERE — şanzımanın kataloğu (dişli düzeni · konvertör), 7. vites, sapma,
 *     sihirbazın Tork adımı.
 */
const fs = require('fs');
const path = require('path');
const KOK = path.join(__dirname, '../..');

const stubs = stubGlobals({
  vePortStyleAttr: jest.fn(() => ''), escapeHTML: jest.fn((s) => String(s)),
  updateNodeHandles: jest.fn(), startResize: jest.fn(), enablePortContextMenu: jest.fn(),
  veAttachNodeDrag: jest.fn(), veAttachPortConnect: jest.fn(), getPortPosition: jest.fn(() => ({ x: 0, y: 0 })),
  updatePortPosition: jest.fn(), applyNodeLabelPos: jest.fn(), showLabelContextMenu: jest.fn(),
  updateNodeCount: jest.fn(), clearSelection: jest.fn(), veMinimapUpdate: jest.fn(), veUpdateBoundary: jest.fn(),
});
global.nodes = [];
global.connections = [];
global.compCounter = 0;
eval(loadSource('components.js'));
global.componentDefs = componentDefs;
global.veMountCore = require('../../js/mount-core.js');
global.veMntSignals = require('../../js/mount-signals.js');
global.veMntBrief = require('../../js/mount-brief.js');
const cp = require('../../js/cp-mount.js');
Object.keys(cp).forEach((k) => { if (global[k] === undefined) global[k] = cp[k]; });
const VS = require('../../js/mount-veri-sayfasi.js');
Object.keys(VS).forEach((k) => { global[k] = VS[k]; });
const STP = require('../../js/mount-step.js');
Object.keys(STP).forEach((k) => { global[k] = STP[k]; });
global.veSayi = require('../../js/sayi.js').veSayi;
eval(loadSource('cp-mount-wizard.js'));
const W = module.exports;
Object.keys(W).forEach((k) => { if (global[k] === undefined) global[k] = W[k]; });
const CAD = require('../../js/cp-mount-cad.js');
Object.keys(CAD).forEach((k) => { if (global[k] === undefined) global[k] = CAD[k]; });
eval(loadSource('cp-mount-3b.js'));
const M3 = module.exports;
const S = require('../helpers/step-takoz.js');

const A4K = 'allison-4000';
const KAY = S.TULGA_OTELEME;
const uz = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const topla = (a, b) => a.map((v, i) => v + b[i]);
const anahtar = (o) => VS.veMntVsAnahtar(VS.VE_MNT_A4K, Object.assign({ dizi: 'cr', bag: 'd', pto: '0', ret: '0', sog: 'u', kar: 'derin', aku: '0', flans: 8, yag: 0.85 }, o));

// ── AİLE — belgenin tabloları, belgenin satır düzeninde ──────────────────────
// §9 ağırlık merkezi — [bağlama, dizi, retarder, PTO, soğutucu, X, Y, Z] (mm)
// soğutucu: u uzak · s doğrudan standart · y doğrudan yüksek kapasite · r retarder/karter
const CG = [
  ['d', '6', '0', '0', 'u', 342.7, 40.2, 3.6], ['d', '6', '0', '0', 's', 357.9, 40.8, 3.6], ['d', '6', '0', '0', 'y', 367.5, 51.3, 3.6],
  ['d', '6', '0', '1', 'u', 387.7, 36.3, 0.6], ['d', '6', '0', '1', 's', 402.8, 43.7, 0.6], ['d', '6', '0', '1', 'y', 412.5, 47.0, 0.6],
  ['d', '6', '1', '0', 'u', 367.5, 45.7, 7.1], ['d', '6', '1', '0', 'r', 407.9, 56.4, 6.1],
  ['d', '6', '1', '1', 'u', 404.6, 37.6, 5.3], ['d', '6', '1', '1', 'r', 445.2, 46.5, 4.8],
  ['u', '6', '0', '0', 'u', 288.7, 35.2, 3.6], ['u', '6', '0', '0', 's', 304.0, 42.1, 3.6], ['u', '6', '0', '0', 'y', 313.7, 45.2, 3.6],
  ['u', '6', '0', '1', 'u', 331.9, 32.0, 0.6], ['u', '6', '0', '1', 's', 348.2, 38.9, 0.6], ['u', '6', '0', '1', 'y', 357.6, 41.7, 0.6],
  ['u', '6', '1', '0', 'u', 314.7, 40.4, 7.1], ['u', '6', '1', '0', 'r', 354.0, 50.4, 6.1],
  ['u', '6', '1', '1', 'u', 350.9, 33.5, 5.3], ['u', '6', '1', '1', 'r', 391.8, 41.8, 4.8],
  ['d', '7', '0', '0', '', 414.0, 38.4, -1.5], ['d', '7', '0', '1', '', 489.5, 33.8, 2.8],
  ['d', '7', '1', '0', '', 465.8, 42.7, 0.8], ['d', '7', '1', '1', '', 525.5, 39.9, 5.6],
  ['u', '7', '0', '0', '', 364.7, 34.6, -1.5], ['u', '7', '0', '1', '', 435.8, 30.6, 2.8],
  ['u', '7', '1', '0', '', 414.8, 38.7, 0.8], ['u', '7', '1', '1', '', 471.7, 36.4, 5.6],
];
// §11 atalet — [dizi, retarder, PTO, soğutucu ('' ayırmıyor), roll, pitch, yaw] (kg·m²)
const ATALET = [
  ['6', '0', '0', '', 11.93, 28.35, 26.44], ['6', '0', '1', '', 12.08, 33.65, 31.50],
  ['6', '1', '0', 'u', 13.02, 32.59, 30.44], ['6', '1', '0', 'r', 15.28, 44.66, 41.70],
  ['6', '1', '1', 'u', 14.18, 41.01, 37.87], ['6', '1', '1', 'r', 15.55, 54.06, 49.84],
  ['7', '0', '0', '', 15.34, 53.10, 48.82], ['7', '0', '1', '', 15.27, 62.02, 57.79],
  ['7', '1', '0', '', 15.34, 59.16, 54.13], ['7', '1', '1', '', 16.43, 68.15, 64.91],
];

describe('AİLE — belgenin tabloları birebir', () => {
  test.each(CG)('§9 ağırlık merkezi · %s %s · retarder %s · PTO %s · soğutucu %s → (%s; %s; %s)', (bag, d, ret, pto, sog, X, Y, Z) => {
    const sogu = sog || (ret === '1' ? 'r' : 'u');
    ['cr', 'wr', '7'].filter((x) => (d === '7') === (x === '7')).forEach((dizi) => {
      const v = VS.veMntVeriSayfasi(anahtar({ dizi, bag, ret, pto, sog: sogu }));
      expect(v.cg).toEqual({ boy: X, yukari: -Y, yan: -Z });
    });
  });

  test('7 vitesli tablo soğutucuyu ayırmıyor: retardersiz üç soğutucu aynı satır', () => {
    const cg = ['u', 's', 'y'].map((sog) => VS.veMntVeriSayfasi(anahtar({ dizi: '7', sog })).cg);
    expect(cg[1]).toEqual(cg[0]);
    expect(cg[2]).toEqual(cg[0]);
  });

  test.each(ATALET)('§11 atalet · %s vites · retarder %s · PTO %s · soğutucu %s → (%s; %s; %s)', (d, ret, pto, sog, x, y, z) => {
    const soglar = sog ? [sog] : (ret === '1' ? ['u', 'r'] : ['u', 's', 'y']);
    ['cr', 'wr', '7'].filter((k) => (d === '7') === (k === '7')).forEach((dizi) => {
      soglar.forEach((sg) => ['d', 'u'].forEach((bag) => {   // atalet tablosu bağlamayı ayırmıyor
        expect(VS.veMntVeriSayfasi(anahtar({ dizi, bag, ret, pto, sog: sg })).atalet).toEqual({ x, y, z });
      }));
    });
  });

  test('§8 kuru kütleler, §13 yağ, §10 sınır, ref adları', () => {
    const A = VS.VE_MNT_A4K;
    expect(A.kutle).toEqual({ temel: { cr: 377, wr: 377, '7': 493 }, pto: 28, ret: 34, sog: { u: 0, s: 16, y: 23, r: 33 },
      aku: 4.5, akuSol: 0.6, uzak: 52, uzakArka6: 17 });
    expect(A.yag).toEqual({ '6': { derin: [45, 48], sig: [38, 41] }, '7': { derin: [48, 51] }, sog: { u: 0, s: 1.0, y: 2.1, r: 2.5 }, aku: 0.6 });
    expect(A.egilme).toBe(3500);
    expect(A.ref).toEqual({ yuz: 'Konvertör muhafazasının ön yüzü', eksen: 'Şanzıman ekseni' });
    expect(A.kaynak).toBe('Allison 4000 Product Family Transmission Data · 15.10.2020');
  });

  test('§12 dişli oranları ve §6 konvertörler; pencerenin listeleri onlardan', () => {
    expect(VS.veMntVsDisliDuzenleri().map((d) => [d.k, d.etiket, d.ileri, d.geri])).toEqual([
      ['allison-4000:cr', 'Close Ratio (CR)', [3.51, 1.91, 1.43, 1.00, 0.74, 0.64], -4.80],
      ['allison-4000:wr', 'Wide Ratio (WR)', [4.70, 2.21, 1.53, 1.00, 0.76, 0.67], -5.55],
      ['allison-4000:7', '7-Speed', [7.63, 3.51, 1.91, 1.43, 1.00, 0.74, 0.64], -4.80],
    ]);
    // Seçilen konfigürasyonun oranları belgenin vites adlarıyla (Canlı Not 50): 7-Speed'in ilki LO
    const ad = (d) => VS.veMntVsOranlar(VS.VE_MNT_A4K, d).map((x) => x.ad);
    expect(ad('cr')).toEqual(['1', '2', '3', '4', '5', '6', 'R']);
    expect(ad('7')).toEqual(['LO', '1', '2', '3', '4', '5', '6', 'R']);
    expect(VS.veMntVsOranlar(VS.VE_MNT_A4K, 'wr').map((x) => x.v)).toEqual([4.70, 2.21, 1.53, 1.00, 0.76, 0.67, -5.55]);
    expect(VS.veMntVsOranlar(VS.VE_MNT_A4K, 'yok')).toEqual([]);
    expect(VS.veMntVsKonvertorler().map((c) => [c.k, c.stall, c.K])).toEqual([
      ['allison-4000:TC-521', 2.42, 50.7], ['allison-4000:TC-531', 2.34, 44.8], ['allison-4000:TC-541', 1.90, 39.7],
      ['allison-4000:TC-551', 1.79, 38.2], ['allison-4000:TC-561', 1.58, 35.4], ['allison-4000:TC-571', 1.62, 32.5],
    ]);
  });

  // Belgenin notu: inç değerleri yalnız başvuru. Bir satırda mm ↔ inç 7,2 mm
  // ayrışıyor (40,8 mm · 1,89 in = 48,0 mm): katalog metrik değeri taşır.
  test('bilinen tutarsızlık: doğrudan · retardersiz · PTO\'suz · standart soğutucu Y = 40,8 mm (metrik)', () => {
    expect(VS.veMntVeriSayfasi(anahtar({ sog: 's' })).cg.yukari).toBe(-40.8);
    expect(1.89 * 25.4).toBeCloseTo(48.0, 1);
  });

  test('her kayıt fiziksel: asal momentlerin üçgen eşitsizliği; ıslak ≥ kuru > 0', () => {
    CG.forEach(([bag, d, ret, pto, sog]) => {
      const v = VS.veMntVeriSayfasi(anahtar({ dizi: d === '7' ? '7' : 'cr', bag, ret, pto, sog: sog || (ret === '1' ? 'r' : 'u') }));
      const I = [v.atalet.x, v.atalet.y, v.atalet.z];
      I.forEach((x, i) => expect(x).toBeLessThanOrEqual(I[(i + 1) % 3] + I[(i + 2) % 3]));
      expect(v.kutle.kuru).toBeGreaterThan(0);
      expect(v.kutle.islak).toBeGreaterThan(v.kutle.kuru);
    });
  });
});

// ── SEÇENEK — bağdaşma, düzeltme, anahtar ────────────────────────────────────
describe('SEÇENEK — bağdaşmayan değer, düzeltme, kanonik anahtar', () => {
  const A = VS.VE_MNT_A4K;

  test('ailenin adı varsayılan seçenekler; anahtar sırası sabit; aynı anahtar aynı nesne', () => {
    const v = VS.veMntVeriSayfasi(A4K);
    expect(v.k).toBe('allison-4000?dizi=cr&bag=d&pto=0&ret=0&sog=u&kar=derin&aku=0&flans=8&yag=0.85');
    expect(VS.veMntVeriSayfasi(v.k)).toBe(VS.veMntVeriSayfasi(v.k));
    expect(VS.veMntVeriSayfasi('allison-4000?ret=1&dizi=7').k).toBe('allison-4000?dizi=7&bag=d&pto=0&ret=1&sog=u&kar=derin&aku=0&flans=8&yag=0.85');
    expect([v.aile, v.tip, v.uretici, VS.veMntVsSatir(v), VS.veMntVsSatir(VS.veMntVeriSayfasi('cummins-l9'))])
      .toEqual([A4K, 'mnt-gearbox', 'Allison', A4K, 'cummins-l9']);
  });

  test('bağdaşma: retarder soğutucusu retarder ister, standart/yüksek soğutucu retardersiz; sığ karter 7 vitesliye yok; akümülatör retarder ister', () => {
    const s = { dizi: 'cr', bag: 'd', pto: '0', ret: '0', sog: 'u', kar: 'derin', aku: '0', flans: 8, yag: 0.85 };
    expect(['u', 's', 'y', 'r'].map((v) => VS.veMntVsGecerli(A, s, 'sog', v))).toEqual([true, true, true, false]);
    expect(['u', 's', 'y', 'r'].map((v) => VS.veMntVsGecerli(A, Object.assign({}, s, { ret: '1' }), 'sog', v))).toEqual([true, false, false, true]);
    expect(VS.veMntVsGecerli(A, Object.assign({}, s, { dizi: '7' }), 'kar', 'sig')).toBe(false);
    expect(VS.veMntVsGecerli(A, s, 'kar', 'sig')).toBe(true);
    expect([VS.veMntVsGecerli(A, s, 'aku', '1'), VS.veMntVsGecerli(A, Object.assign({}, s, { ret: '1' }), 'aku', '1')]).toEqual([false, true]);
    expect([VS.veMntVsGecerli(A, s, 'flans', 12), VS.veMntVsGecerli(A, s, 'flans', 31), VS.veMntVsGecerli(A, s, 'yag', 0.5)]).toEqual([true, false, false]);
  });

  test('değişiklik ötekini ilk izinli değere çeker: retarder kalkınca soğutucu "Uzak", akümülatör "Yok"; 7 vitesli derin karter', () => {
    const k = anahtar({ dizi: '7', pto: '1', ret: '1', sog: 'r', aku: '1' });
    expect(VS.veMntVeriSayfasi(VS.veMntVsSecenekYaz(k, 'ret', '0')).secenek).toMatchObject({ ret: '0', sog: 'u', aku: '0', pto: '1', dizi: '7' });
    const sig = VS.veMntVsSecenekYaz(A4K, 'kar', 'sig');
    expect(VS.veMntVeriSayfasi(VS.veMntVsSecenekYaz(sig, 'dizi', '7')).secenek.kar).toBe('derin');
    // değeri bağdaşmayan istek: kayıt yok (öteki seçenek değiştirilmez)
    expect(VS.veMntVsSecenekYaz(A4K, 'sog', 'r')).toBe(null);
    expect(VS.veMntVsSecenekYaz(A4K, 'flans', 40)).toBe(null);
    expect(VS.veMntVsSecenekYaz(A4K, 'yok', '1')).toBe(null);
    expect(VS.veMntVsSecenekYaz('cummins-l9', 'dizi', '7')).toBe(null);
  });

  test('bozuk anahtar kayıt vermez: bilinmeyen seçenek, değer, tekrar, boş sayı, bağdaşmayan çift', () => {
    ['allison-4000?x=1', 'allison-4000?dizi=8', 'allison-4000?pto=1&pto=0', 'allison-4000?flans=', 'allison-4000?flans=abc',
      'allison-4000?sog=r', 'allison-4000?dizi=7&kar=sig', 'allison-4000?aku=1', 'allison-5000', 'allison-4000?dizi'].forEach((k) => {
      expect(VS.veMntVeriSayfasi(k)).toBe(null);
    });
    expect(VS.veMntVeriSayfasi(undefined)).toBe(null);
  });

  test('bağlantı yüzü sınırı yalnız doğrudan bağlamada', () => {
    expect(VS.veMntVeriSayfasi(anahtar({})).sinir).toEqual({ egilme: 3500 });
    expect(VS.veMntVeriSayfasi(anahtar({ bag: 'u' })).sinir).toBeUndefined();
  });
});

// ── KÜTLE — toplam ───────────────────────────────────────────────────────────
describe('KÜTLE — kuru = donanım + flanş, ıslak = kuru + yağ', () => {
  test('varsayılan: 377 + 8 = 385 kg kuru; derin karter PTO\'suz 45 L × 0,85 = 38,25 kg; ıslak 423,25', () => {
    const v = VS.veMntVeriSayfasi(A4K);
    expect(v.kutle).toEqual({ kuru: 385, islak: 423.25 });
    expect(v.yag).toEqual({ L: 45, rho: 0.85, kg: 38.25 });
    expect(v.kalem.map((x) => [x.ad, x.kg])).toEqual([['Şanzıman', 377], ['Çıkış flanşı', 8]]);
  });

  test('7 vitesli · PTO · retarder · retarder/karter soğutucusu · akümülatör: 493+28+34+33+4,5+0,6 = 593,1 + flanş; yağ 51 + 2,5 + 0,6', () => {
    const v = VS.veMntVeriSayfasi(anahtar({ dizi: '7', pto: '1', ret: '1', sog: 'r', aku: '1' }));
    expect(v.kalem.map((x) => [x.ad, x.kg])).toEqual([['Şanzıman', 493], ['PTO provizyonu', 28], ['Retarder', 34],
      ['Retarder/sump cooler', 33], ['Retarder akümülatörü', 4.5], ['Akümülatör solenoidi', 0.6], ['Çıkış flanşı', 8]]);
    expect(v.kutle.kuru).toBe(601.1);
    expect(v.yag).toEqual({ L: 54.1, rho: 0.85, kg: 45.985 });
    expect(v.kutle.islak).toBe(647.085);
  });

  test('uzak soğutucu şasidedir: retarderli uzak soğutucuda soğutucu kütlesi ve yağı gövdeye girmez', () => {
    const v = VS.veMntVeriSayfasi(anahtar({ ret: '1', sog: 'u' }));
    expect(v.kalem.map((x) => x.ad)).toEqual(['Şanzıman', 'Retarder', 'Çıkış flanşı']);
    expect(v.yag.L).toBe(45);
  });

  test('uzak bağlama: provizyon 52 kg; 6 vitesliye arka braket 17 kg, 7 vitesliye yok', () => {
    const alti = VS.veMntVeriSayfasi(anahtar({ bag: 'u' })), yedi = VS.veMntVeriSayfasi(anahtar({ bag: 'u', dizi: '7' }));
    expect(alti.kutle.kuru).toBe(377 + 52 + 17 + 8);
    expect(yedi.kutle.kuru).toBe(493 + 52 + 8);
  });

  test('sığ karter, standart/yüksek soğutucu, flanş ve yoğunluk', () => {
    expect(VS.veMntVeriSayfasi(anahtar({ kar: 'sig', pto: '1', sog: 'y' })).yag.L).toBe(41 + 2.1);
    expect(VS.veMntVeriSayfasi(anahtar({ sog: 's' })).kutle.kuru).toBe(377 + 16 + 8);
    const v = VS.veMntVeriSayfasi(anahtar({ flans: 12, yag: 0.9 }));
    expect([v.kutle.kuru, v.yag.kg, v.kutle.islak]).toEqual([389, 40.5, 429.5]);
    expect(VS.veMntVeriSayfasi(anahtar({ flans: 0 })).kalem.map((x) => x.ad)).toEqual(['Şanzıman']);
  });
});

// ── YÖN — Allison'un sistemi → programın sistemi ────────────────────────────
describe('YÖN — ağırlık merkezi R + (X; Z; −Y): X arkaya, Y aşağı, Z sağa', () => {
  // Ön yüz x = 600'de, dışa −x; eksen x boyunca (y = 10, z = 400)
  const ref = { yuz: { o: [600, 0, 0], n: [-1, 0, 0] }, eksen: { c: [700, 10, 400], n: [1, 0, 0] } };
  test('7 vitesli · retarder · PTO (doğrudan): (600 + 525,5; 10 + 5,6; 400 − 39,9); atalet köşegen', () => {
    const v = VS.veMntVeriSayfasi(anahtar({ dizi: '7', pto: '1', ret: '1', sog: 'r' }));
    const V = STP.veMntStpVeriKonum(v, ref);
    expect(V.ok).toBe(true);
    expect(uz(V.R, [600, 10, 400])).toBeLessThan(1e-12);
    expect(uz(V.c, [1125.5, 15.6, 360.1])).toBeLessThan(1e-9);
    expect(V.I.map((r) => r.map((x) => +x.toFixed(9)))).toEqual([[16.43, 0, 0], [0, 68.15, 0], [0, 0, 64.91]]);
  });
  test('Z eksi (7 vitesli, retardersiz, PTO\'suz −1,5 mm) aracın soluna: y azalır; referans yoksa durum adıyla', () => {
    const V = STP.veMntStpVeriKonum(VS.veMntVeriSayfasi(anahtar({ dizi: '7' })), ref);
    expect(V.c[1]).toBeCloseTo(10 - 1.5, 9);
    expect(STP.veMntStpVeriKonum(VS.veMntVeriSayfasi(A4K), {}).neden).toBe('Konvertör muhafazasının ön yüzü ve şanzıman ekseni seçilmedi');
  });
});

// ── STEP — hesap ve aktarım ─────────────────────────────────────────────────
const TAKOZ_AD = S.TULGA_TAKOZ.map((t) => t[1]);
const GOVDE = { 'Motor bloğu': 'mnt-motor', 'Şanzıman gövdesi': 'mnt-gearbox', 'Transfer gövdesi': 'mnt-transfer' };
// Şanzımanın ön yüzü (kutunun x−'i) ve ekseni: krank kasnağının dairesi (motor
// ile şanzıman eş eksenli — gerçek montajda da)
const SANZ_ON = 814.55 - 200;
function sanzRef(son) {
  const ps = son.parcalar.findIndex((p) => p.ad === 'Şanzıman gövdesi');
  const pk = son.parcalar.findIndex((p) => p.ad === 'Krank kasnağı');
  const yuz = STP.veMntStpDuzlemSec(son, ps, [SANZ_ON + KAY[0], 80, 420], [-1, 0, 0]);
  const c = STP.veMntStpYuzler(son, pk).filter((y) => y.cemberler.length)[0].cemberler[0];
  return { yuz, eksen: STP.veMntStpKenarDaire(son, pk, c.kenar) };
}
describe('STEP — ön yüz ve eksenden ağırlık merkezi; aktarımda bağlantı yüzü', () => {
  const son = STP.veMntStpOku(S.tulgaKalibi({ oteleme: KAY, krank: true }));
  const roller = son.agac.map((d) => (TAKOZ_AD.indexOf(d.ad) >= 0 ? 'mnt-mount' : GOVDE[d.ad] || null));
  const sanz = son.agac.findIndex((d) => d.ad === 'Şanzıman gövdesi');
  const k = anahtar({ dizi: '7', pto: '1', ret: '1', sog: 'r', aku: '1' });
  // R: krank ekseni ∩ ön yüz (dosyanın sistemi)
  const R = topla([SANZ_ON, S.TULGA_KRANK.eksen[0], S.TULGA_KRANK.eksen[1]], KAY);

  test('hesap: kaynak "veri", ağırlık merkezi R + (525,5; 5,6; −39,9); kütle ıslak, atalet satırdan', () => {
    const c = STP.veMntStpCoz(son, roller, { yogunluk: { [sanz]: k }, referans: { [sanz]: sanzRef(son) } });
    const b = c.birimler.filter((x) => x.dugum === sanz)[0];
    expect(b.kaynak).toBe('veri');
    expect(uz(b.veri.R, R)).toBeLessThan(1e-6);
    expect(uz(b.konum, topla(R, [525.5, 5.6, -39.9]))).toBeLessThan(1e-6);
    expect(STP.veMntStpKutle(b, '900', k)).toMatchObject({ kaynak: 'veri', m: 647.085, I: [[16.43, 0, 0], [0, 68.15, 0], [0, 0, 64.91]] });
    expect(c.uyarilar.filter((m) => m.indexOf('Şanzıman') >= 0)).toEqual([]);
  });

  test('aktarım: ağırlık merkezi, kütle, atalet; bağlantı yüzünün merkezi R − T, ekseni +x, sınırı 3.500 N·m', () => {
    const c = STP.veMntStpCoz(son, roller, { yogunluk: { [sanz]: k }, referans: { [sanz]: sanzRef(son) } });
    const kay = STP.veMntStpKayit(c, {}, { [sanz]: k }, KAY);
    const i = kay.liste.findIndex((n) => n.dugum === sanz);
    expect(kay.liste[i].data).toMatchObject({ cgx: 1140.05, cgy: 5.65, cgz: 366.13, mass: 647.085, Ixx: 16.43, Iyy: 68.15, Izz: 64.91,
      bagX: SANZ_ON, bagY: S.TULGA_KRANK.eksen[0], bagZ: S.TULGA_KRANK.eksen[1], bagNx: 1, bagNy: 0, bagNz: 0, egSinir: 3500 });
    expect(kay.kaynak[i]).toEqual({ not: 'Allison 4000 · veri sayfası', bag: true });
    // uzak bağlama: sınır yok — bağlantı yüzü yazılmaz
    const ku = anahtar({ bag: 'u' });
    const c2 = STP.veMntStpCoz(son, roller, { yogunluk: { [sanz]: ku }, referans: { [sanz]: sanzRef(son) } });
    const d2 = STP.veMntStpKayit(c2, {}, { [sanz]: ku }, KAY).liste.filter((n) => n.dugum === sanz)[0].data;
    expect(d2.bagX).toBeUndefined();
    expect(d2.egSinir).toBeUndefined();
  });

  test('kayıt: seçenekli anahtar rol kaydına girer ve aynı dosyada geri gelir; başka rolde düşer', () => {
    const r = sanzRef(son);
    const kayit = STP.veMntStpRolKaydi(son, roller, {}, { dosya: 't.stp' }, {}, { [sanz]: k }, { [sanz]: r });
    expect(kayit.roller.filter((x) => x.rol === 'mnt-gearbox')[0].yog).toBe(k);
    const u = STP.veMntStpRolKaydiUygula(son, JSON.parse(JSON.stringify(kayit)));
    expect(u.yogunluk[sanz]).toBe(k);
    const motor = son.agac.findIndex((d) => d.ad === 'Motor bloğu');
    const k2 = STP.veMntStpRolKaydi(son, roller, {}, {}, {}, { [motor]: k }, {});
    expect(k2.roller.filter((x) => x.rol === 'mnt-motor')[0].yog).toBeUndefined();
  });
});

// ── OTURUM — kart ve 3B ─────────────────────────────────────────────────────
const TOPO = JSON.parse(fs.readFileSync(path.join(KOK, 'assets/examples/tulga_topoloji.json'), 'utf8'));
let ev = null;
function tulgaTuval() {
  global.veMntStack = [{ nodeId: 'mod-1' }];
  ev = { id: 'v1', type: 'mnt-viewer', def: componentDefs['mnt-viewer'], data: {} };
  const t = JSON.parse(JSON.stringify(TOPO));
  global.nodes = [ev].concat(t.nodes);
  global.connections = t.connections;
}
function oturum() {
  const s = W.veMntWizStpOku(S.tulgaKalibi({ oteleme: KAY, krank: true }), 'tulga.stp');
  s.sonuc.agac.forEach((d) => {
    if (TAKOZ_AD.indexOf(d.ad) >= 0) W.veMntWizStpRol(d.i, 'mnt-mount');
    if (GOVDE[d.ad]) W.veMntWizStpRol(d.i, GOVDE[d.ad]);
  });
  return s;
}
const kur = (html) => { const el = document.createElement('div'); el.innerHTML = html; return el; };

describe('OTURUM — liste, seçenekler, kapalı seçeneğin sebebi', () => {
  beforeEach(() => { resetStubs(stubs); tulgaTuval(); });

  test('ailenin satırı seçilince kanonik anahtar; seçenek değişir; satır yeniden seçilince seçenekler kalır', () => {
    const s = oturum(), sanz = s.sonuc.agac.findIndex((d) => d.ad === 'Şanzıman gövdesi');
    expect(W.veMntWizStpYogunluk(sanz, A4K)).toBe(true);
    expect(s.yogunluk[sanz]).toBe(VS.veMntVeriSayfasi(A4K).k);
    expect(W.veMntWizStpVsSecenek(sanz, 'dizi', '7')).toBe(true);
    expect(W.veMntWizStpVsSecenek(sanz, 'ret', '1')).toBe(true);
    expect(W.veMntWizStpVsSecenek(sanz, 'sog', 'r')).toBe(true);
    expect(W.veMntWizStpVsSecenek(sanz, 'flans', '11,5')).toBe(true);           // Türkçe yazım okunur
    expect(VS.veMntVeriSayfasi(s.yogunluk[sanz]).secenek).toMatchObject({ dizi: '7', ret: '1', sog: 'r', flans: 11.5 });
    expect(W.veMntWizStpYogunluk(sanz, A4K)).toBe(false);                     // aynı aile: değişiklik yok
    expect(VS.veMntVeriSayfasi(s.yogunluk[sanz]).secenek.dizi).toBe('7');
    // kayıt projeyle: seçenekli anahtar
    expect(ev.data.cad.roller.filter((x) => x.rol === 'mnt-gearbox')[0].yog).toBe(s.yogunluk[sanz]);
  });

  test('aralık dışı sayı yazılmaz ve bildirilir; bağdaşmayan değer yazılmaz', () => {
    const s = oturum(), sanz = s.sonuc.agac.findIndex((d) => d.ad === 'Şanzıman gövdesi');
    W.veMntWizStpYogunluk(sanz, A4K);
    const once = s.yogunluk[sanz];
    expect(W.veMntWizStpVsSecenek(sanz, 'flans', '45')).toBe(false);
    expect(stubs.showToast).toHaveBeenCalledWith('Çıkış flanşı 0–30 kg arasında olmalı.', 'warning');
    expect(W.veMntWizStpVsSecenek(sanz, 'sog', 'r')).toBe(false);              // retarder yok
    expect(s.yogunluk[sanz]).toBe(once);
    // motor ailesiz: seçenek yok
    const motor = s.sonuc.agac.findIndex((d) => d.ad === 'Motor bloğu');
    W.veMntWizStpYogunluk(motor, 'cummins-l9');
    expect(W.veMntWizStpVsSecenek(motor, 'dizi', '7')).toBe(false);
  });

  test('kart: şanzımanın satırında model seçili, altında dokuz seçenek; kapalı seçenek sebebiyle; kütle ıslak, ipucunda yağ', () => {
    const s = oturum(), sanz = s.sonuc.agac.findIndex((d) => d.ad === 'Şanzıman gövdesi');
    W.veMntWizStpHesapla();
    W.veMntWizStpYogunluk(sanz, A4K);
    const el = kur(_mwStpKutleHTML(s));
    expect(el.querySelector('select[data-mw-stp-yog="' + sanz + '"] option[value="' + A4K + '"]').selected).toBe(true);
    const sat = el.querySelector('[data-mw-stp-secenek="' + sanz + '"]');
    expect(Array.from(sat.querySelectorAll('.ve-fw-lbl')).map((x) => x.textContent)).toEqual(VS.VE_MNT_A4K.secenek.map((o) => o.ad));
    const sog = sat.querySelector('select[data-mw-vs-secenek="sog"]');
    expect(Array.from(sog.options).map((o) => [o.value, o.disabled, o.getAttribute('title')])).toEqual([
      ['u', false, null], ['s', false, null], ['y', false, null], ['r', true, 'Retarder: Yok.']]);
    expect(sat.querySelector('select[data-mw-vs-secenek="aku"] option[value="1"]').getAttribute('title')).toBe('Retarder: Yok.');
    expect(sat.querySelector('input[data-mw-vs-secenek="yag"]').getAttribute('value')).toBe('0.85');   // makine biçimi
    const kg = el.querySelector('[data-mw-stp-kutle-deger="' + sanz + '"]');
    expect([kg.textContent, kg.getAttribute('title')]).toEqual(['423,3', 'Islak 423 kg · kuru 385 kg · yağ 45,0 L']);
    W.veMntWizStpVsSecenek(sanz, 'dizi', '7');
    const k7 = kur(_mwStpKutleHTML(s)).querySelector('select[data-mw-vs-secenek="kar"] option[value="sig"]');
    expect([k7.disabled, k7.getAttribute('title')]).toEqual([true, 'Vites konfigürasyonu: 7-Speed.']);
  });

  test('3B: "Şanzıman ailesi" listesinde aile; seçenek satırları; referans düğmeleri; kuru kütle ve yağ', () => {
    const s = oturum(), sanz = s.sonuc.agac.findIndex((d) => d.ad === 'Şanzıman gövdesi');
    let el = kur(M3.veMntWiz3bAltHTML(s, sanz, {}));
    expect(Array.from(el.querySelectorAll('#ve-mw-3b-veri option')).map((o) => o.textContent)).toEqual(['—', 'Allison 4000']);
    expect(el.querySelectorAll('.ve-mw-3b-secenek')).toHaveLength(0);
    W.veMntWizStpYogunluk(sanz, A4K);
    el = kur(M3.veMntWiz3bAltHTML(s, sanz, {}));
    expect(el.querySelector('#ve-mw-3b-veri').value).toBe(A4K);
    expect(Array.from(el.querySelectorAll('.ve-mw-3b-secenek .ve-mw-3b-kb')).map((x) => x.textContent)).toEqual(VS.VE_MNT_A4K.secenek.map((o) => o.ad));
    // Vites konfigürasyonu (Canlı Not 50): seçilenin oranları listenin altında, belgenin vites adlarıyla
    const oran = (e) => Array.from(e.querySelectorAll('.ve-mw-3b-secenek .ve-mw-vs-oran [role="listitem"]'))
      .map((x) => x.querySelector('i').textContent + ' ' + x.querySelector('b').textContent);
    expect(el.querySelector('.ve-mw-3b-secenek .ve-mw-3b-kb').textContent).toBe('Vites konfigürasyonu');
    expect(Array.from(el.querySelectorAll('select[data-mw-vs-secenek="dizi"] option')).map((o) => o.textContent)).toEqual(['Close Ratio (CR)', 'Wide Ratio (WR)', '7-Speed']);
    // Terimler belgenin İngilizcesiyle (Canlı Not 51: "Uzak yerine genelde remote derler"); Yok/Var Türkçe;
    // listenin adı "Şanzıman ailesi"
    const ops = (k) => Array.from(el.querySelectorAll('select[data-mw-vs-secenek="' + k + '"] option')).map((o) => o.textContent);
    expect([ops('bag'), ops('sog'), ops('kar'), ops('pto')]).toEqual([['Direct mount', 'Remote mount'],
      ['Remote', 'Direct · standard capacity', 'Direct · high capacity', 'Direct · retarder/sump'], ['Deep', 'Shallow'], ['Yok', 'Var']]);
    expect(el.querySelector('.ve-mw-3b-veri .ve-mw-3b-kb').textContent).toBe('Şanzıman ailesi');
    expect(oran(el)).toEqual(['1 3,51', '2 1,91', '3 1,43', '4 1,00', '5 0,74', '6 0,64', 'R −4,80']);
    expect(el.querySelectorAll('.ve-mw-vs-oran')).toHaveLength(1);                     // yalnız konfigürasyonun satırında
    W.veMntWizStpVsSecenek(sanz, 'dizi', '7');
    expect(oran(kur(M3.veMntWiz3bAltHTML(s, sanz, {})))).toEqual(['LO 7,63', '1 3,51', '2 1,91', '3 1,43', '4 1,00', '5 0,74', '6 0,64', 'R −4,80']);
    W.veMntWizStpVsSecenek(sanz, 'dizi', 'cr');
    expect(Array.from(el.querySelectorAll('[data-ve-3b-ref]')).map((b) => b.textContent.trim())).toEqual(['Konvertör muhafazasının ön yüzü', 'Şanzıman ekseni']);
    W.veMntWizStpReferans(sanz, 'yuz', sanzRef(s.sonuc).yuz);
    W.veMntWizStpReferans(sanz, 'eksen', sanzRef(s.sonuc).eksen);
    W.veMntWizStpHesapla();
    const bk = kur(M3.veMntWiz3bBirimKutleHTML(s, sanz, [sanz]));
    expect(bk.querySelector('[data-ve-3b-kuru]').textContent).toBe('385,0kg');
    expect(bk.querySelector('[data-ve-3b-yag]').textContent).toBe('45,0L · 38,3kg');
  });

  test('aktarım sihirbaza: bağlantı yüzü şanzımanın satırında, kurulan düğüme geçer; dosyanın sistemine taşı onu da öteler', () => {
    const s = oturum(), sanz = s.sonuc.agac.findIndex((d) => d.ad === 'Şanzıman gövdesi');
    W.veMntWizStpYogunluk(sanz, A4K);
    const r = sanzRef(s.sonuc);
    W.veMntWizStpReferans(sanz, 'yuz', r.yuz);
    W.veMntWizStpReferans(sanz, 'eksen', r.eksen);
    W.veMntWizStpHesapla();
    // sihirbazın modeliyle öteleme (bu oturumda sihirbaz boş: T = 0, dosyanın sistemi)
    const A = W._mwStpAktarDurumu(s), Rd = topla([SANZ_ON, S.TULGA_KRANK.eksen[0], S.TULGA_KRANK.eksen[1]], KAY);
    const g = A.st.govdeler.filter((x) => x.type === 'mnt-gearbox')[0];
    expect([g.bagX, g.bagY, g.bagZ].map((v) => +v.toFixed(3)).concat([g.bagNx, g.egSinir])).toEqual(Rd.map((v) => +v.toFixed(3)).concat([1, 3500]));
    const n = W.veMntWizNodes(A.st).filter((x) => x.type === 'mnt-gearbox')[0];
    expect([n.data.bagX, n.data.egSinir]).toEqual([g.bagX, 3500]);
    // tuvaldeki şanzımana uygula, sonra dosyanın sistemine taşı: bağlantı yüzü de T kadar
    W.veMntWizStpModeleUygula();
    const tg = global.nodes.filter((x) => x.type === 'mnt-gearbox')[0].data;
    expect([tg.bagX, tg.bagY, tg.bagZ]).toEqual([SANZ_ON, S.TULGA_KRANK.eksen[0], S.TULGA_KRANK.eksen[1]]);
    W.veMntWizStpSistemeTasi();
    expect([tg.bagX, tg.bagY, tg.bagZ].map((v) => +v.toFixed(3))).toEqual(topla([SANZ_ON, S.TULGA_KRANK.eksen[0], S.TULGA_KRANK.eksen[1]], KAY).map((v) => +v.toFixed(3)));
  });
});

// ── PENCERE — şanzımanın kataloğu, 7. vites, Tork adımı ─────────────────────
describe('PENCERE — dişli düzeni ve konvertör doldurur; 7. vites; sapma', () => {
  beforeEach(() => { resetStubs(stubs); tulgaTuval(); });
  const sanzDugum = () => global.nodes.filter((n) => n.type === 'mnt-gearbox')[0];

  test('yedi vitesli: 7 ileri + geri; altı vitesliye dönünce 7. vites SİLİNİR; konvertör stall oranını yazar', () => {
    const n = sanzDugum();
    cp.veMntApplyGearPreset(n.id, 'allison-4000:7');
    expect([1, 2, 3, 4, 5, 6, 7].map((i) => n.data['g' + i]).concat(n.data.gR)).toEqual([7.63, 3.51, 1.91, 1.43, 1.00, 0.74, 0.64, -4.80]);
    expect(n.data.gearPreset).toBe('allison-4000:7');
    cp.veMntApplyGearPreset(n.id, 'allison-4000:wr');
    expect(n.data.g7).toBeUndefined();
    expect(n.data.g1).toBe(4.70);
    cp.veMntApplyTcPreset(n.id, 'allison-4000:TC-541');
    expect([n.data.Rstall, n.data.tcPreset]).toEqual([1.90, 'allison-4000:TC-541']);
    // bağ kaldırılınca girilen değerler kalır
    cp.veMntApplyGearPreset(n.id, '');
    expect([n.data.gearPreset, n.data.g1]).toEqual([undefined, 4.70]);
    expect(stubs.saveState).toHaveBeenCalled();
  });

  test('sapma alan alan: birebir (7/7) · elle değişen vites adıyla · altı vitesli düzende dolu 7. vites sapmadır', () => {
    const n = sanzDugum();
    cp.veMntApplyGearPreset(n.id, 'allison-4000:cr');
    expect(cp._mntDisliSapma(n)).toEqual({ ad: 'Allison 4000 · Close Ratio (CR)', ayni: ['1. vites', '2. vites', '3. vites', '4. vites', '5. vites', '6. vites', 'Geri'], farkli: [] });
    n.data.g3 = 1.5; n.data.g7 = 0.6;
    expect(cp._mntDisliSapma(n).farkli).toEqual(['3. vites', '7. vites']);
    cp.veMntApplyTcPreset(n.id, 'allison-4000:TC-571');
    expect(cp._mntKonvertorSapma(n)).toEqual({ ad: 'Allison 4000 TC-571', ayni: ['stall oranı'], farkli: [] });
  });

  test('Kriter 3: 7. vites kendi tork durumunu kurar; tork alanı toplanır', () => {
    const n = sanzDugum();
    cp.veMntApplyGearPreset(n.id, 'allison-4000:7');
    cp.veMntApplyTcPreset(n.id, 'allison-4000:TC-541');
    const t = cp._mntGatherTorque();
    expect(t.g7).toBe(0.64);
    const c = cp._mntGearTorqueCases(t);
    expect(c.map((x) => x.gearLabel)).toEqual(['1. Vites', '2. Vites', '3. Vites', '4. Vites', '5. Vites', '6. Vites', '7. Vites', 'Geri']);
    expect(c[6].Tshaft / c[0].Tshaft).toBeCloseTo(0.64 / 7.63, 12);
  });

  test('pencere: Katalog bölümünde iki liste (aile grubu), Vitesler föyünde 7. vites, Bağlantı yüzü kategorisi', () => {
    const n = sanzDugum();
    cp.veMntApplyGearPreset(n.id, 'allison-4000:7');
    const el = kur(cp.getMntMassPropertiesHTML(n));
    const dis = el.querySelector('#ve-mnt-gearPreset-' + n.id), tc = el.querySelector('#ve-mnt-tcPreset-' + n.id);
    expect(Array.from(dis.querySelectorAll('optgroup[label="Allison 4000"] option')).map((o) => o.textContent))
      .toEqual(['Close Ratio (CR)', 'Wide Ratio (WR)', '7-Speed']);
    expect(dis.value).toBe('allison-4000:7');
    expect(Array.from(tc.querySelectorAll('option')).map((o) => o.textContent)[3]).toBe('TC-541 · 1,90');
    expect(el.querySelector('#ve-mnt-g7-' + n.id).value).toBe('0.64');
    expect(el.querySelector('#ve-mnt-sanzkat-' + n.id).textContent).toContain('Allison 4000 · 7-Speed');
    expect(Array.from(el.querySelectorAll('.ve-fp-l')).map((x) => x.textContent)).toContain('Vites konfigürasyonu');
    expect(el.querySelector('#ve-mnt-bagX-' + n.id)).not.toBe(null);
    expect(el.querySelector('#ve-mnt-egSinir-' + n.id)).not.toBe(null);
    expect(cp._mntBaglantiDurumu(n)).toMatchObject({ d: 'bos', yazi: 'tanımsız' });
    n.data.bagX = 400;
    expect(cp._mntBaglantiDurumu(n)).toMatchObject({ d: 'eksik', hedef: 've-mnt-bagY-' + n.id });
    n.data.bagY = 0; n.data.bagZ = 400; n.data.egSinir = 3500;
    expect(cp._mntBaglantiDurumu(n)).toMatchObject({ d: 'ok', yazi: 'sınır 3.500 N·m' });
    expect(cp._mntBagYon(n.data)).toEqual([1, 0, 0]);                          // yön yoksa boyuna eksen
    expect(cp._mntBagYon({ bagNx: 0.6, bagNy: 0, bagNz: 0.8 })).toEqual([0.6, 0, 0.8]);
  });

  test('sihirbazın Tork adımı: iki liste ve 7. vites alanı; seçim tork alanlarını doldurur, şanzıman düğümüne gider', () => {
    document.body.innerHTML = '<div id="ve-canvas-wrapper"></div><div id="ve-mntwiz-overlay" style="display:none;"><div class="ve-fw-shell">'
      + '<nav id="ve-mw-nav"></nav><div id="ve-mw-body"></div></div><div id="ve-mw-foot"></div><div id="ve-mw-3b" style="display:none;"></div></div>';
    expect(W.veMntWizAc()).toBe(true);
    W.veMntWizDisliKatalog('allison-4000:7');
    W.veMntWizKonvertorKatalog('allison-4000:TC-531');
    const st = W.veMntWizState();
    expect([st.tork.g1, st.tork.g7, st.tork.gR, st.tork.Rstall, st.tork.gearPreset]).toEqual([7.63, 0.64, -4.80, 2.34, 'allison-4000:7']);
    const el = kur(W._mwStepTork({ ok: false }));
    expect(Array.from(el.querySelectorAll('select[aria-label="Vites konfigürasyonu"] option')).filter((o) => o.selected).map((o) => o.value)).toEqual(['allison-4000:7']);
    expect(el.querySelector('select[aria-label="Konvertör"]').value).toBe('allison-4000:TC-531');
    expect(el.innerHTML).toContain('7. vites');
    W.veMntWizDisliKatalog('allison-4000:cr');
    expect(W.veMntWizState().tork.g7).toBeUndefined();
    const n = W.veMntWizNodes().filter((x) => x.type === 'mnt-gearbox')[0];
    expect([n.data.g1, n.data.gearPreset, n.data.tcPreset]).toEqual([3.51, 'allison-4000:cr', 'allison-4000:TC-531']);
    W.veMntWizKapat();
  });
});
