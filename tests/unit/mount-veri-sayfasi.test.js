/**
 * mount-veri-sayfasi.test.js — VERİ SAYFASINDAN AĞIRLIK MERKEZİ (2026-11-02)
 * ─────────────────────────────────────────────────────────────────────────
 * Kullanıcının yöntemi: motorun (ve şanzımanın) veri sayfası ağırlık merkezini
 * bir referanstan verir — ISB6.7 360: bloğun ön yüzünden 402 mm, krank
 * ekseninin 144 mm üstü; referansın yeri STEP dosyasındaki yüz ve eksen.
 * Katalog yedi Cummins motoru (ikinci gönderi: ISB4.5E5 — Tulga'nın motoru —,
 * ISB6.7E3, L9, ISM11, X12, X15). X12 ağırlık merkezini bloğun ARKA yüzünden
 * ve yanal kaçıklıkla veriyor, kuru kütlesi yok.
 * Önce (main 143c2cc): motorun ağırlık merkezi yalnız geometriden (homojen
 * yoğunluk) — gerçek Tulga dosyasında sunudakinden 38,4 mm uzak; model
 * seçilemiyordu. Gerçek dosyada sunudaki motor ağırlık merkezi krank
 * ekseninin düşey düzleminde (0,005 mm) ve 185,2 mm üstünde.
 *
 *   · KATALOG — yedi sayfanın sayıları birebir (kuru kütlesi olmayan, yanal
 *     alanı olan kayıt dâhil); alanlar ve
 *     ataletin fiziksel geçerliliği (asal momentlerin üçgen eşitsizliği).
 *   · REFERANS — R = eksen ∩ yüz; yön yüzün dışa bakan normalinden; eğik
 *     motorda uzaklık ve atalet motorun eksenlerinde; arka yüz referansı;
 *     yanal kaçıklığın yönü (önden bakanın sağı); hatalar adıyla.
 *   · DÜZLEM — tıklanan üçgen dosyanın düzlemine oturur; kayıttaki yüz bulunur.
 *   · HESAP — sentetik Tulga (öteleme dâhil): ağırlık merkezi sununun motor
 *     ağırlık merkezine oturur; referans eksikse hacimden ve uyarıyla.
 *   · KAYIT — kaynak ve referans projeyle; başka rolde veri sayfası düşer.
 *   · OTURUM — hesaptan önce seçim, föyde seçili gövde, modele uygula.
 *   · 3B DİZİSİ — model listesi ve iki seçim düğmesi.
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
// Sihirbaz ve 3B aynı kapsamda (3B'nin dizisi sihirbazın yardımcılarını okur)
eval(loadSource('cp-mount-wizard.js'));
const W = module.exports;
Object.keys(W).forEach((k) => { if (global[k] === undefined) global[k] = W[k]; });
const CAD = require('../../js/cp-mount-cad.js');
Object.keys(CAD).forEach((k) => { if (global[k] === undefined) global[k] = CAD[k]; });
eval(loadSource('cp-mount-3b.js'));
const M3 = module.exports;
const S = require('../helpers/step-takoz.js');

const ISB = 'cummins-isb67-360';
const KAY = S.TULGA_OTELEME;
const SUNU_CG = [124.96, 0.05, 550.03];
const uz = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const topla = (a, b) => a.map((v, i) => v + b[i]);
const nok = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

// ── KATALOG ────────────────────────────────────────────────────────────────
// Veri sayfalarındaki metrik değerler, sayfadan birebir (kullanıcının
// gönderdiği yedi sayfa; belgeler depoda değil — değerler programın içinde).
// [k, ad, konfig, kuru, ıslak, boy, yukarı, yan, roll, pitch, yaw, referans yüzü]
const SAYFALAR = [
  ['cummins-isb45e5', 'ISB4.5E5', 'D323018BX03', 366, 385, 271, 158, undefined, 14.7, 25, 19.1, 'Bloğun ön yüzü'],
  ['cummins-isb67e3', 'ISB6.7E3', 'D313023BX03-E3', 485, 512, 402, 144, undefined, 19.2, 49.6, 42.9, 'Bloğun ön yüzü'],
  ['cummins-isb67-360', 'ISB6.7 360', 'D313003BX03', 485, 512, 402, 144, undefined, 19.2, 49.6, 42.9, 'Bloğun ön yüzü'],
  ['cummins-l9', 'L9', 'D563020BX03', 774, 804, 427, 212, undefined, 29.8, 76.8, 66.9, 'Bloğun ön yüzü'],
  ['cummins-ism11', 'ISM11', 'D353029BX03', 940, 990, 450, 191, undefined, 80.9, 164.9, 122.6, 'Bloğun ön yüzü'],
  ['cummins-x12', 'X12', 'D0S3002CX03', null, 860, 477, 195, 0, 51.3, 149, 123, 'Bloğun arka yüzü'],
  ['cummins-x15', 'X15', 'D103018BX03', 1327, 1401, 455, 244, undefined, 110.7, 260.2, 205.9, 'Bloğun ön yüzü'],
];
describe('KATALOG — veri sayfasının sayıları', () => {
  test.each(SAYFALAR)('%s · %s (%s): kütle, ağırlık merkezi, atalet sayfayla birebir',
    (k, ad, konfig, kuru, islak, boy, yukari, yan, x, y, z, yuz) => {
      const v = VS.veMntVeriSayfasi(k);
      const cg = { boy, yukari };
      if (yan !== undefined) cg.yan = yan;
      expect(v).toMatchObject({ tip: 'mnt-motor', ad, uretici: 'Cummins', konfig,
        kutle: { kuru, islak }, atalet: { x, y, z }, ref: { yuz, eksen: 'Krank ekseni' } });
      expect(v.cg).toEqual(cg);                                          // yanal alan yalnız sayfa verirse
      expect(!!v.ref.arka).toBe(yuz === 'Bloğun arka yüzü');
    });

  test('katalog yedi motor, sıra hacme göre; şanzımanda tek satır: Allison 4000 ailesi', () => {
    expect(VS.VE_MNT_VERI_SAYFASI.map((v) => v.k)).toEqual(SAYFALAR.map((r) => r[0]));
    expect(VS.veMntVeriSayfalari('mnt-gearbox').map((v) => [v.k, v.ad])).toEqual([['allison-4000', 'Allison 4000']]);
    expect(VS.veMntVeriSayfalari('mnt-motor').map((v) => v.k)).toEqual(SAYFALAR.map((r) => r[0]));
  });

  // Canlı Not 42: listenin adı seçilen şeyin adı — "Veri sayfası" değil; Canlı Not 51: şanzımanda
  // seçilen şey bir AİLE ("Bir sürü model var 4000 serisinde")
  test('listenin adı rolün modeli: motorda "Motor modeli", şanzımanda "Şanzıman ailesi"; kataloğun her rolünün adı var', () => {
    expect([VS.veMntModelAd('mnt-motor'), VS.veMntModelAd('mnt-gearbox'), VS.veMntModelAd('mnt-transfer')])
      .toEqual(['Motor modeli', 'Şanzıman ailesi', 'Model']);
    VS.VE_MNT_VERI_SAYFASI.forEach((v) => expect(VS.VE_MNT_MODEL_AD[v.tip]).toBeTruthy());
  });

  test('her kayıt: tekil anahtar, rol, kütle, uzaklık, atalet fiziksel (asal momentlerin üçgen eşitsizliği)', () => {
    const k = VS.VE_MNT_VERI_SAYFASI.map((v) => v.k);
    expect(new Set(k).size).toBe(k.length);
    VS.VE_MNT_VERI_SAYFASI.forEach((v) => {
      expect(['mnt-motor', 'mnt-gearbox']).toContain(v.tip);
      expect(STP.VE_MNT_STP_ROLLER).toContain(v.tip);
      expect(v.kutle.islak).toBeGreaterThan(0);
      if (v.kutle.kuru !== null) { expect(v.kutle.kuru).toBeGreaterThan(0); expect(v.kutle.islak).toBeGreaterThanOrEqual(v.kutle.kuru); }
      expect([v.cg.boy, v.cg.yukari].every(Number.isFinite)).toBe(true);
      expect(v.cg.yan === undefined || Number.isFinite(v.cg.yan)).toBe(true);
      const I = [v.atalet.x, v.atalet.y, v.atalet.z];
      I.forEach((x, i) => { expect(x).toBeGreaterThan(0); expect(x).toBeLessThanOrEqual(I[(i + 1) % 3] + I[(i + 2) % 3]); });
      expect(v.ref.yuz && v.ref.eksen && v.kaynak).toBeTruthy();
      expect(STP.veMntStpVs(v.k, v.tip)).toBe(v);
    });
    expect(VS.veMntVeriSayfalari('mnt-motor').map((v) => v.k)).toContain(ISB);
    expect(STP.veMntStpVs(ISB, 'mnt-gearbox')).toBe(null);               // başka rolde yok
    expect(STP.veMntStpVs('dosya', 'mnt-motor')).toBe(null);
  });
});

// ── REFERANS ───────────────────────────────────────────────────────────────
describe('REFERANS — eksen ∩ yüz, motorun eksenlerinde', () => {
  const vs = VS.veMntVeriSayfasi(ISB);

  test('yatay motor: R ön yüzde ve krank ekseninde; ağırlık merkezi R + (402; 0; 144); atalet köşegen', () => {
    const r = STP.veMntStpVeriKonum(vs, { yuz: { o: [-150, 90, 777], n: [-1, 0, 0] }, eksen: { c: [-260, 40.021, 393.426], n: [1, 0, 0] } });
    expect(r.ok).toBe(true);
    expect(uz(r.R, [-150, 40.021, 393.426])).toBeLessThan(1e-12);
    expect(uz(r.c, [252, 40.021, 537.426])).toBeLessThan(1e-9);
    expect(r.I).toEqual([[19.2, 0, 0], [0, 49.6, 0], [0, 0, 42.9]]);
  });

  test('dairenin yönü ve konumu (eksen boyunca), yüzün noktası (düzlemde) sonucu değiştirmez', () => {
    const a = STP.veMntStpVeriKonum(vs, { yuz: { o: [-150, 0, 0], n: [-1, 0, 0] }, eksen: { c: [-300, 40, 400], n: [1, 0, 0] } });
    const b = STP.veMntStpVeriKonum(vs, { yuz: { o: [-150, -500, 1200], n: [-1, 0, 0] }, eksen: { c: [800, 40, 400], n: [-1, 0, 0] } });
    expect(uz(a.c, b.c)).toBeLessThan(1e-9);
  });

  test('boy yönü yüzün DIŞA bakan normalinin tersi: arka yüz seçilirse ağırlık merkezi öne düşer', () => {
    const on = STP.veMntStpVeriKonum(vs, { yuz: { o: [0, 0, 0], n: [-1, 0, 0] }, eksen: { c: [0, 0, 400], n: [1, 0, 0] } });
    const arka = STP.veMntStpVeriKonum(vs, { yuz: { o: [0, 0, 0], n: [1, 0, 0] }, eksen: { c: [0, 0, 400], n: [1, 0, 0] } });
    expect(on.c[0]).toBeCloseTo(402, 9);
    expect(arka.c[0]).toBeCloseTo(-402, 9);
    expect(on.c[2]).toBeCloseTo(544, 9);
  });

  test('eğik motor (burun 5° yukarı): uzaklıklar ve atalet motorun eksenlerinde', () => {
    const t = 5 * Math.PI / 180, a = [Math.cos(t), 0, -Math.sin(t)];
    const r = STP.veMntStpVeriKonum(vs, { yuz: { o: [-150, 0, 0], n: [-a[0], 0, -a[2]] }, eksen: { c: [-250, 0, 400], n: a } });
    expect(r.ok).toBe(true);
    const d = r.c.map((x, i) => x - r.R[i]);
    expect(nok(d, a)).toBeCloseTo(402, 9);                              // eksen boyunca
    expect(nok(d, r.v)).toBeCloseTo(144, 9);                            // eksene dik, yukarı
    expect(r.v[2]).toBeCloseTo(Math.cos(t), 12);
    expect(nok(r.v, a)).toBeCloseTo(0, 12);
    // tensör: simetrik, izi korunur, eksen roll momentinin özvektörü
    const I = r.I;
    expect(I[0][2]).toBeCloseTo(I[2][0], 12);
    expect(I[0][0] + I[1][1] + I[2][2]).toBeCloseTo(19.2 + 49.6 + 42.9, 9);
    const Ia = [0, 1, 2].map((i) => nok(I[i], a));
    expect(uz(Ia, a.map((x) => 19.2 * x))).toBeLessThan(1e-9);
    expect(I[0][2]).toBeCloseTo((42.9 - 19.2) * Math.sin(t) * Math.cos(t), 9);   // Ixz = −∫xz dm > 0
  });

  test('ARKA YÜZ (X12): boy arka yüzden öne; R arka yüzde, ağırlık merkezi R + (−477; 0; 195)', () => {
    const x12 = VS.veMntVeriSayfasi('cummins-x12');
    // Motorun önü −x (Tulga'daki gibi): arka yüz +x'e bakar
    const r = STP.veMntStpVeriKonum(x12, { yuz: { o: [700, -90, 300], n: [1, 0, 0] }, eksen: { c: [-260, 40, 400], n: [1, 0, 0] } });
    expect(r.ok).toBe(true);
    expect(uz(r.R, [700, 40, 400])).toBeLessThan(1e-12);
    expect(uz(r.c, [223, 40, 595])).toBeLessThan(1e-9);
    expect(r.I).toEqual([[51.3, 0, 0], [0, 149, 0], [0, 0, 123]]);
    expect(STP.veMntStpVeriKonum(x12, {}).neden).toBe('Bloğun arka yüzü ve krank ekseni seçilmedi');
  });

  test('YANAL: + motorun sağı ÖNDEN bakınca — ön ve arka yüz referansında aynı taraf, ayna motorda ters', () => {
    const on = Object.assign({}, vs, { cg: { boy: 402, yukari: 144, yan: 10 } });
    const arka = Object.assign({}, on, { ref: { yuz: 'Bloğun arka yüzü', eksen: 'Krank ekseni', arka: true } });
    const eksen = { c: [0, 40, 400], n: [1, 0, 0] };
    // Önü −x: önden bakan +x'e bakar, sağı −y
    const a = STP.veMntStpVeriKonum(on, { yuz: { o: [-150, 0, 0], n: [-1, 0, 0] }, eksen });
    const b = STP.veMntStpVeriKonum(arka, { yuz: { o: [800, 0, 0], n: [1, 0, 0] }, eksen });
    expect(a.c[1]).toBeCloseTo(30, 9);
    expect(b.c[1]).toBeCloseTo(30, 9);
    expect(uz(a.s, [0, -1, 0])).toBeLessThan(1e-12);
    expect(uz(b.s, [0, -1, 0])).toBeLessThan(1e-12);
    // Önü +x (ayna): sağı +y
    const c = STP.veMntStpVeriKonum(on, { yuz: { o: [150, 0, 0], n: [1, 0, 0] }, eksen });
    expect(c.c[1]).toBeCloseTo(50, 9);
    // Yanı olmayan kayıt: eksenin düşey düzleminde; yan 0 aynı sonuç
    const sifir = Object.assign({}, on, { cg: { boy: 402, yukari: 144, yan: 0 } });
    const yok = STP.veMntStpVeriKonum(vs, { yuz: { o: [-150, 0, 0], n: [-1, 0, 0] }, eksen });
    expect(yok.c[1]).toBe(40);
    expect(STP.veMntStpVeriKonum(sifir, { yuz: { o: [-150, 0, 0], n: [-1, 0, 0] }, eksen }).c).toEqual(yok.c);
  });

  test('hatalar adıyla: eksik referans · yüz eksene dik değil · eksen düşey', () => {
    expect(STP.veMntStpVeriKonum(vs, {}).neden).toBe('Bloğun ön yüzü ve krank ekseni seçilmedi');
    expect(STP.veMntStpVeriKonum(vs, { eksen: { c: [0, 0, 0], n: [1, 0, 0] } }).neden).toBe('Bloğun ön yüzü seçilmedi');
    expect(STP.veMntStpVeriKonum(vs, { yuz: { o: [0, 0, 0], n: [-1, 0, 0] } }).neden).toBe('Krank ekseni seçilmedi');
    const egik = STP.veMntStpVeriKonum(vs, { yuz: { o: [0, 0, 0], n: [-Math.cos(0.05), Math.sin(0.05), 0] }, eksen: { c: [0, 0, 0], n: [1, 0, 0] } });
    expect(egik.ok).toBe(false);
    expect(egik.neden).toMatch(/^Bloğun ön yüzü eksene dik değil \(2,9°\)$/);
    expect(STP.veMntStpVeriKonum(vs, { yuz: { o: [0, 0, 0], n: [0, 0, 1] }, eksen: { c: [0, 0, 0], n: [0, 0, 1] } }).neden).toBe('Krank ekseni düşey');
    // 0,5° eğik yüz kabul (CAD'de dik; payı VE_MNT_STP_VERI.aci)
    const az = 0.5 * Math.PI / 180;
    expect(STP.veMntStpVeriKonum(vs, { yuz: { o: [0, 0, 0], n: [-Math.cos(az), Math.sin(az), 0] }, eksen: { c: [0, 0, 0], n: [1, 0, 0] } }).ok).toBe(true);
  });
});

// ── DÜZLEM ─────────────────────────────────────────────────────────────────
describe('DÜZLEM — tıklanan üçgen dosyanın düzlemine oturur', () => {
  const son = STP.veMntStpOku(S.tulgaKalibi({ oteleme: KAY, krank: true }));
  const pi = son.parcalar.findIndex((p) => p.ad === 'Motor bloğu');
  const xOn = S.TULGA_KRANK.yuz + KAY[0];

  test('ön yüz: nokta düzleme izdüşer, normal dışa (−x); üçgenin normali ters de verilse dışa bakan yüz', () => {
    const p = [xOn + 0.02, 30, 700];
    const a = STP.veMntStpDuzlemSec(son, pi, p, [-1, 0, 0]);
    expect(a).toMatchObject({ parca: pi, n: [-1, 0, 0] });
    expect(a.o[0]).toBeCloseTo(xOn, 9);
    expect(a.yol).toEqual(STP.veMntStpYol(son, son.parcalar[pi].dugum));
    expect(STP.veMntStpDuzlemSec(son, pi, p, [1, 0, 0]).n).toEqual([-1, 0, 0]);
  });

  test('düzlemden uzak nokta ve eğri normal: yok', () => {
    expect(STP.veMntStpDuzlemSec(son, pi, [xOn + 1, 30, 700], [-1, 0, 0])).toBe(null);
    expect(STP.veMntStpDuzlemSec(son, pi, [xOn, 30, 700], [-1, 0.1, 0])).toBe(null);
  });

  test('kayıttaki yüz aynı parçada yeniden bulunur; başka düzlem ya da yol: yok', () => {
    const a = STP.veMntStpDuzlemSec(son, pi, [xOn, 0, 600], [-1, 0, 0]);
    expect(STP.veMntStpDuzlemBul(son, a.yol, a.o, a.n)).toMatchObject({ parca: pi, n: [-1, 0, 0] });
    expect(STP.veMntStpDuzlemBul(son, a.yol, topla(a.o, [5, 0, 0]), a.n)).toBe(null);
    expect(STP.veMntStpDuzlemBul(son, ['YOK.1'], a.o, a.n)).toBe(null);
  });
});

// ── HESAP ──────────────────────────────────────────────────────────────────
const TAKOZ_AD = S.TULGA_TAKOZ.map((t) => t[1]);
const GOVDE = { 'Motor bloğu': 'mnt-motor', 'Şanzıman gövdesi': 'mnt-gearbox', 'Transfer gövdesi': 'mnt-transfer' };
function referans(son) {
  const pm = son.parcalar.findIndex((p) => p.ad === 'Motor bloğu');
  const pk = son.parcalar.findIndex((p) => p.ad === 'Krank kasnağı');
  const yuz = STP.veMntStpDuzlemSec(son, pm, [S.TULGA_KRANK.yuz + KAY[0], 0, 700], [-1, 0, 0]);
  const c = STP.veMntStpYuzler(son, pk).filter((y) => y.cemberler.length)[0].cemberler[0];
  const eksen = STP.veMntStpKenarDaire(son, pk, c.kenar);
  return { yuz, eksen };
}

describe('HESAP — veri sayfası ve referans: sununun motor ağırlık merkezi', () => {
  const son = STP.veMntStpOku(S.tulgaKalibi({ oteleme: KAY, krank: true }));
  const roller = son.agac.map((d) => (TAKOZ_AD.indexOf(d.ad) >= 0 ? 'mnt-mount' : GOVDE[d.ad] || null));
  const motor = son.agac.findIndex((d) => d.ad === 'Motor bloğu');

  test('ağırlık merkezi = sunudaki + öteleme (µm altında); kaynak "veri"; uyarı yok', () => {
    const c = STP.veMntStpCoz(son, roller, { yogunluk: { [motor]: ISB }, referans: { [motor]: referans(son) } });
    const b = c.birimler.filter((x) => x.dugum === motor)[0];
    expect(b.kaynak).toBe('veri');
    expect(uz(b.konum, topla(SUNU_CG, KAY))).toBeLessThan(1e-6);
    expect(uz(b.veri.R, topla([S.TULGA_KRANK.yuz, S.TULGA_KRANK.eksen[0], S.TULGA_KRANK.eksen[1]], KAY))).toBeLessThan(1e-6);
    expect(c.uyarilar.filter((m) => m.indexOf('Motor bloğu') >= 0)).toEqual([]);
    // kütle: sayfanın ıslak kütlesi, yazılan kütle SAYILMAZ (aksesuarlar ayrı
    // bileşen — kullanıcı 2026-11-02); atalet veri sayfasının
    expect(STP.veMntStpKutle(b, undefined, ISB)).toMatchObject({ kaynak: 'veri', m: 512, I: [[19.2, 0, 0], [0, 49.6, 0], [0, 0, 42.9]] });
    expect(STP.veMntStpKutle(b, '418', ISB).m).toBe(512);
  });

  test('referans eksik: hacimden ve uyarıyla; kütle yine veri sayfasının, atalet homojen', () => {
    const c = STP.veMntStpCoz(son, roller, { yogunluk: { [motor]: ISB } });
    const b = c.birimler.filter((x) => x.dugum === motor)[0];
    expect(b.kaynak).toBe('hacim');
    expect(c.uyarilar).toContain('"Motor bloğu": Bloğun ön yüzü ve krank ekseni seçilmedi.');
    const K = STP.veMntStpKutle(b, undefined, ISB);
    expect([K.kaynak, K.m, K.Inot]).toEqual(['veri', 512, 'homojen yoğunluk']);
    const r = referans(son);
    const c2 = STP.veMntStpCoz(son, roller, { yogunluk: { [motor]: ISB }, referans: { [motor]: { yuz: r.yuz, eksen: Object.assign({}, r.eksen, { yol: ['YOK.1'] }) } } });
    expect(c2.uyarilar).toContain('"Motor bloğu": seçilen krank ekseni bu dosyada yok.');
  });

  test('aktarımın kaydı: veri sayfasının alanı "S" değil; referans yoksa ağırlık merkezi ve atalet "S"', () => {
    const c = STP.veMntStpCoz(son, roller, { yogunluk: { [motor]: ISB }, referans: { [motor]: referans(son) } });
    const k = STP.veMntStpKayit(c, {}, { [motor]: ISB }, KAY);
    const i = k.liste.findIndex((n) => n.dugum === motor);
    expect(k.liste[i].data).toMatchObject({ cgx: 124.96, cgy: 0.05, cgz: 550.03, mass: 512, Ixx: 19.2, Iyy: 49.6, Izz: 42.9, Ixy: 0, pointMass: false });
    expect(k.kaynak[i]).toEqual({ not: 'ISB6.7 360 · veri sayfası' });
    const c2 = STP.veMntStpCoz(son, roller, { yogunluk: { [motor]: ISB } });
    const k2 = STP.veMntStpKayit(c2, {}, { [motor]: ISB });
    const j = k2.liste.findIndex((n) => n.dugum === motor);
    expect(k2.kaynak[j]).toEqual({ cg: true, I: true, not: 'homojen yoğunluk' });
    expect(k2.liste[j].data.mass).toBe(512);
  });
});

// ── KAYIT ──────────────────────────────────────────────────────────────────
describe('KAYIT — kaynak ve referans projeyle', () => {
  const son = STP.veMntStpOku(S.tulgaKalibi({ oteleme: KAY, krank: true }));
  const roller = son.agac.map((d) => (TAKOZ_AD.indexOf(d.ad) >= 0 ? 'mnt-mount' : GOVDE[d.ad] || null));
  const motor = son.agac.findIndex((d) => d.ad === 'Motor bloğu');
  const sanz = son.agac.findIndex((d) => d.ad === 'Şanzıman gövdesi');

  test('rol kaydı → aynı dosya: kaynak ve referans birebir; veri sayfası yalnız kendi rolünde', () => {
    const r = referans(son);
    const k = STP.veMntStpRolKaydi(son, roller, {}, { dosya: 't.stp' }, {}, { [motor]: ISB, [sanz]: ISB }, { [motor]: r });
    const km = k.roller.filter((x) => x.rol === 'mnt-motor')[0];
    expect(km.yog).toBe(ISB);
    expect(km.ref.yuz).toEqual({ yol: r.yuz.yol, o: r.yuz.o, n: r.yuz.n });
    expect(km.ref.eksen).toEqual({ yol: r.eksen.yol, c: r.eksen.c, n: r.eksen.n, r: r.eksen.r });
    expect(k.roller.filter((x) => x.rol === 'mnt-gearbox')[0].yog).toBeUndefined();   // motorun veri sayfası şanzımanda yok
    const u = STP.veMntStpRolKaydiUygula(son, JSON.parse(JSON.stringify(k)));
    expect(u.yogunluk).toEqual({ [motor]: ISB });
    expect(u.referans[motor]).toEqual(km.ref);
    const c = STP.veMntStpCoz(son, u.roller, { yogunluk: u.yogunluk, referans: u.referans });
    expect(uz(c.birimler.filter((x) => x.dugum === motor)[0].konum, topla(SUNU_CG, KAY))).toBeLessThan(1e-6);
  });

  test('dosya açık değilken "Kayıtlı roller": kütle hücresinde model ve ıslak kütlesi, daire hücresinde eksen', () => {
    const r = referans(son);
    const k = STP.veMntStpRolKaydi(son, roller, { [motor]: 418 }, {}, {}, { [motor]: ISB }, { [motor]: r });
    const el = document.createElement('div');
    el.innerHTML = CAD._mntCadKayitHTML(k);
    const satir = Array.from(el.querySelectorAll('tr')).filter((tr) => tr.cells[0] && tr.cells[0].textContent === 'Motor bloğu')[0];
    expect([satir.cells[1].textContent, satir.cells[2].firstChild.textContent, satir.cells[2].querySelector('.ve-mnt-cad-kaynak').textContent])
      .toEqual(['Motor Ø 157,0', '512', 'ISB6.7 360']);
    expect(satir.cells.length).toBe(3);
  });

  test('bozuk referans kaydı yazılmaz ve okunmaz', () => {
    const k = STP.veMntStpRolKaydi(son, roller, {}, {}, {}, {}, { [motor]: { yuz: { yol: ['X'], o: [1, 2], n: [0, 0, 1] }, eksen: { yol: ['X'], c: [0, 0, 0], n: [1, 0, 0], r: 0 } } });
    expect(k.roller.filter((x) => x.rol === 'mnt-motor')[0].ref).toBeUndefined();
  });
});

// ── OTURUM ─────────────────────────────────────────────────────────────────
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
  const s = W.veMntWizStpOku(S.tulgaKalibi({ oteleme: KAY, onFark: [0, 0, -2], krank: true }), 'tulga.stp');
  s.sonuc.agac.forEach((d) => {
    if (TAKOZ_AD.indexOf(d.ad) >= 0) W.veMntWizStpRol(d.i, 'mnt-mount');
    if (GOVDE[d.ad]) W.veMntWizStpRol(d.i, GOVDE[d.ad]);
  });
  return s;
}

describe('OTURUM — hesaptan önce seçim, föy, modele uygula', () => {
  beforeEach(() => { resetStubs(stubs); tulgaTuval(); });

  test('veri sayfası ve referans hesaptan ÖNCE verilir; kayda girer; hesap ağırlık merkezini sunuya oturtur', () => {
    const s = oturum(), motor = s.sonuc.agac.findIndex((d) => d.ad === 'Motor bloğu');
    expect(s.coz).toBe(null);
    expect(W.veMntWizStpYogunluk(motor, ISB)).toBe(true);
    expect(W.veMntWizStpYogunluk(motor, 'celik')).toBe(false);                // malzeme ölçülmüş birimi ister
    const r = referans(s.sonuc);
    expect(W.veMntWizStpReferans(motor, 'yuz', r.yuz)).toBe(true);
    expect(W.veMntWizStpReferans(motor, 'eksen', r.eksen)).toBe(true);
    expect(ev.data.cad.roller.filter((x) => x.rol === 'mnt-motor')[0]).toMatchObject({ yog: ISB, ref: { yuz: { n: [-1, 0, 0] } } });
    W.veMntWizStpHesapla();
    const b = s.coz.birimler.filter((x) => x.dugum === motor)[0];
    expect(b.kaynak).toBe('veri');
    expect(uz(b.konum, topla(SUNU_CG, KAY))).toBeLessThan(1e-6);
    // yüzü kaldırmak hesabı yeniler: hacimden
    W.veMntWizStpReferans(motor, 'yuz', null);
    expect(s.coz.birimler.filter((x) => x.dugum === motor)[0].kaynak).toBe('hacim');
    expect(ev.data.cad.roller.filter((x) => x.rol === 'mnt-motor')[0].ref.yuz).toBeUndefined();
  });

  test('rol değişince: motorun veri sayfası şanzımanda düşer, referans da gider', () => {
    const s = oturum(), motor = s.sonuc.agac.findIndex((d) => d.ad === 'Motor bloğu');
    W.veMntWizStpYogunluk(motor, ISB);
    W.veMntWizStpReferans(motor, 'eksen', referans(s.sonuc).eksen);
    W.veMntWizStpRol(motor, 'mnt-gearbox');
    expect(s.yogunluk[motor]).toBeUndefined();
    expect(s.referans[motor]).toBeDefined();                                  // gövde kaldı: referans durur
    W.veMntWizStpRol(motor, '');
    expect(s.referans[motor]).toBeUndefined();
  });

  test('föy: veri sayfalı gövde SEÇİLİ, öteki gövdeler değil; modele uygula sayfanın kütlesini ve ataletini yazar', () => {
    const s = oturum(), motor = s.sonuc.agac.findIndex((d) => d.ad === 'Motor bloğu');
    W.veMntWizStpYogunluk(motor, ISB);
    const r = referans(s.sonuc);
    W.veMntWizStpReferans(motor, 'yuz', r.yuz);
    W.veMntWizStpReferans(motor, 'eksen', r.eksen);
    W.veMntWizStpKutle(motor, '418');                                         // hesaptan önce yazılmaz
    W.veMntWizStpHesapla();
    W.veMntWizStpKutle(motor, '418');
    const K = W.veMntWizStpKarsilastirma(s, 'tuval');
    const satir = (tip) => K.satirlar.filter((x) => x.tip === tip)[0];
    expect(satir('mnt-motor')).toMatchObject({ secili: true });
    expect(satir('mnt-motor').fark).toBeLessThan(0.001);                       // sununun motor ağırlık merkezi
    expect([satir('mnt-gearbox').secili, satir('mnt-transfer').secili]).toEqual([false, false]);
    W.veMntWizStpModeleUygula();
    const m = global.nodes.filter((n) => n.type === 'mnt-motor')[0].data;
    expect([+m.cgx, +m.cgy, +m.cgz]).toEqual(SUNU_CG);
    expect(+m.mass).toBe(512);                                                 // yazılan 418 sayılmaz
    expect([+m.Ixx, +m.Iyy, +m.Izz]).toEqual([19.2, 49.6, 42.9]);
  });

  test('kütle tablosu: motor modeli listede ("Motor modeli" grubu), kütle sayfanın ıslak kütlesi ve yazılmaz; şanzımanda model yok', () => {
    const s = oturum(), motor = s.sonuc.agac.findIndex((d) => d.ad === 'Motor bloğu');
    W.veMntWizStpHesapla();
    W.veMntWizStpYogunluk(motor, ISB);
    const el = document.createElement('div');
    el.innerHTML = W._mwStpKutleHTML ? W._mwStpKutleHTML(s) : _mwStpKutleHTML(s);
    const sec = el.querySelector('select[data-mw-stp-yog="' + motor + '"]');
    expect(sec.querySelector('optgroup[label="Motor modeli"] option[value="' + ISB + '"]').selected).toBe(true);
    expect(sec.querySelector('optgroup[label="Veri sayfası"]')).toBe(null);
    expect(el.querySelector('input[data-mw-stp-kutle="' + motor + '"]')).toBe(null);   // alan yok
    const alan = el.querySelector('[data-mw-stp-kutle-deger="' + motor + '"]');
    expect([alan.textContent, alan.getAttribute('title')]).toEqual(['512,0', 'Islak 512 kg · kuru 485 kg']);
    expect(Array.from(sec.querySelectorAll('optgroup[label="Motor modeli"] option')).map((o) => o.textContent))
      .toEqual(VS.veMntVeriSayfalari('mnt-motor').map((v) => v.ad));
    // X12: veri sayfası kuru kütleyi vermiyor
    W.veMntWizStpYogunluk(motor, 'cummins-x12');
    el.innerHTML = _mwStpKutleHTML(s);
    const x12 = el.querySelector('[data-mw-stp-kutle-deger="' + motor + '"]');
    expect([x12.textContent, x12.getAttribute('title')]).toEqual(['860,0', 'Islak 860 kg']);
    // Şanzımanın listesi: "Şanzıman ailesi" grubunda Allison 4000 ailesi
    const sanz = s.sonuc.agac.findIndex((d) => d.ad === 'Şanzıman gövdesi');
    expect(Array.from(el.querySelectorAll('select[data-mw-stp-yog="' + sanz + '"] optgroup[label="Şanzıman ailesi"] option'))
      .map((o) => [o.value, o.textContent])).toEqual([['allison-4000', 'Allison 4000']]);
  });
});

// ── EKSİK REFERANS — durum + TEK yönlendirme (kullanım notu T08) ───────────
// Pencerede "Bloğun ön yüzü ve krank ekseni seçilmedi." çaresinin yerini
// söylemiyordu: seçim yalnız 3B'de, birim seçiliyken.
describe('EKSİK REFERANS — uyarının arkasında 3B\'nin yönlendirmesi', () => {
  beforeEach(() => { resetStubs(stubs); tulgaTuval(); });

  test('referanssız veri sayfası: uyarı satırında TEK yönlendirme; referanslar seçilince yönlendirme yok', () => {
    const s = oturum(), motor = s.sonuc.agac.findIndex((d) => d.ad === 'Motor bloğu');
    W.veMntWizStpYogunluk(motor, ISB);
    W.veMntWizStpHesapla();
    const d = W.veMntWizStpDenetim(s);
    expect(d.refEksik).toEqual(['"Motor bloğu": Bloğun ön yüzü ve krank ekseni seçilmedi.']);
    const el = document.createElement('div');
    el.innerHTML = W._mwStpSorunHTML(d);
    const satir = Array.from(el.querySelectorAll('.ve-fw-issue')).map((x) => x.textContent.trim());
    expect(satir.filter((m) => m.indexOf('3B’de birimi seçip referansları gösterin.') >= 0))
      .toEqual(['"Motor bloğu": Bloğun ön yüzü ve krank ekseni seçilmedi. 3B’de birimi seçip referansları gösterin.']);
    const r = referans(s.sonuc);
    W.veMntWizStpReferans(motor, 'yuz', r.yuz);
    W.veMntWizStpReferans(motor, 'eksen', r.eksen);
    W.veMntWizStpHesapla();
    const d2 = W.veMntWizStpDenetim(s);
    expect(d2.refEksik).toEqual([]);
    el.innerHTML = W._mwStpSorunHTML(d2);
    expect(el.textContent).not.toContain('referansları gösterin');
  });
});

// ── 3B DİZİSİ ──────────────────────────────────────────────────────────────
describe('3B DİZİSİ — model ve iki seçim düğmesi', () => {
  beforeEach(() => { resetStubs(stubs); tulgaTuval(); });

  test('motor seçiliyken liste; model seçilince "Bloğun ön yüzü" · "Krank ekseni"; seçilen işaretli; açık kipte yönlendirme', () => {
    const s = oturum(), motor = s.sonuc.agac.findIndex((d) => d.ad === 'Motor bloğu');
    const dizi = (opt) => { const el = document.createElement('div'); el.innerHTML = M3.veMntWiz3bAltHTML(s, motor, opt || {}); return el; };
    let el = dizi();
    expect(el.querySelector('#ve-mw-3b-veri')).not.toBe(null);
    expect(el.querySelectorAll('[data-ve-3b-ref]')).toHaveLength(0);
    // Motorda malzeme satırı yok (Canlı Not 16: "motor için bir malzeme girdimiz olmayacak")
    expect(el.querySelector('.ve-mw-3b-malzeme')).toBe(null);
    // Listenin adı rolün modeli (Canlı Not 42: "'Veri sayfası' ne demek? 'Motor modeli' …")
    expect(Array.from(el.querySelectorAll('.ve-mw-3b-kb')).map((x) => x.textContent)).toEqual(['Rol', 'Motor modeli']);
    expect(el.querySelector('#ve-mw-3b-veri').getAttribute('aria-label')).toBe('Motor modeli');
    expect(el.textContent).not.toContain('Veri sayfası');
    W.veMntWizStpYogunluk(motor, ISB);
    W.veMntWizStpReferans(motor, 'eksen', referans(s.sonuc).eksen);
    el = dizi({ ref: 'yuz' });
    const d = Array.from(el.querySelectorAll('[data-ve-3b-ref]'));
    expect(d.map((b) => b.textContent.trim())).toEqual(['Bloğun ön yüzü', 'Krank ekseni']);
    expect(d.map((b) => [b.getAttribute('aria-pressed'), b.hasAttribute('data-secildi')])).toEqual([['true', false], ['false', true]]);
    expect(el.textContent).toContain('Düzlem yüzü seçin.');
    // Fare aynı düzlemde gezinirken aday değişmez: çizim yenilenmez (ekran kartı
    // olmayan makinede gerçek motor montajının bir karesi ~4 sn)
    const yz = (parca, o, n) => ({ tur: 'yuz', parca, secim: { o, n } });
    expect(_mw3bAyniDuzlem(yz(1, [0, 0, 0], [-1, 0, 0]), yz(1, [0, 40, 700], [-1, 0, 0]))).toBe(true);
    expect(_mw3bAyniDuzlem(yz(1, [0, 0, 0], [-1, 0, 0]), yz(1, [0.5, 0, 0], [-1, 0, 0]))).toBe(false);
    expect(_mw3bAyniDuzlem(yz(1, [0, 0, 0], [-1, 0, 0]), yz(2, [0, 0, 0], [-1, 0, 0]))).toBe(false);
    expect(_mw3bAyniDuzlem(yz(1, [0, 0, 0], [-1, 0, 0]), yz(1, [0, 0, 0], [1, 0, 0]))).toBe(false);
    expect(Array.from(el.querySelectorAll('#ve-mw-3b-veri option')).map((o) => o.textContent))
      .toEqual(['—'].concat(VS.veMntVeriSayfalari('mnt-motor').map((v) => v.ad)));
    W.veMntWizStpYogunluk(motor, 'cummins-x12');
    expect(Array.from(dizi().querySelectorAll('[data-ve-3b-ref]')).map((b) => b.textContent.trim()))
      .toEqual(['Bloğun arka yüzü', 'Krank ekseni']);
    // transfer kutusunun kataloğunda model yok: liste yok
    const tc = s.sonuc.agac.findIndex((x) => x.ad === 'Transfer gövdesi');
    const e2 = document.createElement('div');
    e2.innerHTML = M3.veMntWiz3bAltHTML(s, tc, {});
    expect(e2.querySelector('#ve-mw-3b-veri')).toBe(null);
  });
});
