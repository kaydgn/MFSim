/**
 * mount-nokta.test.js — TAKOZ NOKTASI: ÜST BAĞLANTI YÜZEYİNİN MERKEZİ (Takoz adım 5, 2026-10-20)
 * ─────────────────────────────────────────────────────────────────────────
 * Kural (kullanıcının onayı): takozun noktası üst bağlantı yüzeyinin merkezi —
 * analizcinin CATIA'da ölçtüğü dairenin merkezi. Ölçülen önce (main 7d1539b,
 * Tulga sunusunun beş noktasında duran sentetik takoz kalıbı): nokta biriminin
 * hacim merkeziydi, sunudaki noktanın 37,97 mm altında (somunlu kalıpta
 * 37,44 mm); Tulga modelinde bu kayma statik sehimi 1,15 mm, modal frekansı
 * %5,3 değiştiriyordu. 3B'de daireden nokta seçmenin yolu yoktu. Sonra: beş
 * takozun önerisi sunudaki sayılarla 1e-9 mm içinde; seçilen dairenin merkezi
 * dosyadaki sayı.
 *
 *   · OKUYUCU — kenarın çemberi dosyadan (veStepP21KenarCemberi); yüzün yönü.
 *   · AĞIN ÇEMBER DİZİNİ — ağ hangi çizgi parçasının hangi çemberin olduğunu
 *     söyler; örnekler diziyi paylaşır.
 *   · ÖNERİ — eksen, aday yüz, boyun: düz, somunlu, konik, eğik, cıvatalı flanş;
 *     yatay eksen ve dairesiz takoz öneri vermez, söylenir.
 *   · SEÇİLEN DAİRE — dosyada yeniden aranır; yoksa öneri ve uyarı.
 *   · KAYIT — seçilen daire rolle birlikte projeye.
 *   · OTURUM — seçim, öneriye dönüş, rol düşünce seçim gider; aktarım eskir.
 * Gerçek tarayıcı (kenara gelince halka, tıklayınca merkez, Esc): tests/e2e/mount-nokta.spec.js.
 */
const fs = require('fs');
const path = require('path');

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
const cp = require('../../js/cp-mount.js');
Object.keys(cp).forEach((k) => { if (global[k] === undefined) global[k] = cp[k]; });
const P21 = require('../../js/step-p21.js');
const SU = require('../../js/step-ucgen.js');
const STP = require('../../js/mount-step.js');
Object.keys(STP).forEach((k) => { global[k] = STP[k]; });
const W = require('../../js/cp-mount-wizard.js');
Object.keys(W).forEach((k) => { if (global[k] === undefined) global[k] = W[k]; });
const CAD = require('../../js/cp-mount-cad.js');
const S = require('../helpers/step-takoz.js');

const uz = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const rolle = (son, adlar, tip = 'mnt-mount') => {
  const r = son.agac.map(() => null);
  adlar.forEach((a) => { r[son.agac.findIndex((d) => d.ad === a)] = tip; });
  return r;
};
const TAKOZ_AD = S.TULGA_TAKOZ.map((t) => t[1]);
const coz = (opt) => {
  const son = STP.veMntStpOku(S.tulgaKalibi(opt));
  expect(son.ok).toBe(true);
  return { son, c: STP.veMntStpCoz(son, rolle(son, TAKOZ_AD)) };
};
const birim = (c, ad) => c.birimler.filter((b) => b.ad === ad)[0];

// ── OKUYUCU ────────────────────────────────────────────────────────────────
describe('OKUYUCU — kenarın çemberi dosyadan', () => {
  const son = STP.veMntStpOku(S.tulgaKalibi({ govde: false }));
  const pi = son.parcalar.findIndex((p) => p.ad === 'Ön takoz üst plaka');
  const g = son._geo[pi];

  test('yüz: düzlemde yönü (ayni) ve sınır çemberlerinin kenar kimliği', () => {
    const yz = g.yuzler.map((f) => P21.veStepP21Yuz(son._model, f, g.M, g.birim));
    const duz = yz.filter((y) => y.tip === 'PLANE');
    expect(duz).toHaveLength(2);
    // üst disk yukarı, alt disk aşağı bakar (alt diskin bayrağı .F.)
    expect(duz.map((y) => (y.ayni ? 1 : -1) * y.z[2]).sort()).toEqual([-1, 1]);
    yz.forEach((y) => y.cemberler.forEach((c) => expect(P21.veStepP21Tip(son._model, c.kenar)).toBe('EDGE_CURVE')));
  });

  test('çember kenar: merkez, normal, yarıçap birebir (dünya, mm); doğru kenar ve kenar olmayan kimlik: null', () => {
    const yz = g.yuzler.map((f) => P21.veStepP21Yuz(son._model, f, g.M, g.birim));
    const ust = yz.filter((y) => y.tip === 'PLANE' && (y.ayni ? 1 : -1) * y.z[2] > 0)[0];
    const c = P21.veStepP21KenarCemberi(son._model, ust.cemberler[0].kenar, g.M, g.birim);
    expect(uz(c.c, S.TULGA_TAKOZ[0][2])).toBeLessThan(1e-9);
    expect(c.r).toBe(35);
    expect(Math.abs(c.n[2])).toBeCloseTo(1, 12);
    // aynı parçanın yan yüzündeki doğru kenarı
    const yan = g.yuzler.map((f) => P21.veStepP21Varlik(son._model, f).a).filter((a) => P21.veStepP21Tip(son._model, a[2].ref) === 'CYLINDRICAL_SURFACE')[0];
    const dongu = P21.veStepP21Varlik(son._model, P21.veStepP21Varlik(son._model, yan[1][0].ref).a[1].ref).a[1];
    const kenarlar = dongu.map((oe) => P21.veStepP21Varlik(son._model, oe.ref).a[3].ref);
    const dogru = kenarlar.filter((k) => P21.veStepP21Tip(son._model, P21.veStepP21Varlik(son._model, k).a[3].ref) === 'LINE')[0];
    expect(P21.veStepP21KenarCemberi(son._model, dogru, g.M, g.birim)).toBe(null);
    expect(P21.veStepP21KenarCemberi(son._model, g.yuzler[0], g.M, g.birim)).toBe(null);
  });
});

// ── AĞIN ÇEMBER DİZİNİ ─────────────────────────────────────────────────────
describe('AĞIN ÇEMBER DİZİNİ — çizgi parçası → çemberin kenarı', () => {
  const son = STP.veMntStpOku(S.tulgaKalibi({ govde: false }));
  const ag = STP.veMntStpAgUret(son, [], son.parcalar.map((p) => p.i));

  test('her üçlünün parçaları kendi çemberinin üstünde; doğru kenarlar dizide yok', () => {
    let n = 0;
    son.parcalar.forEach((p) => {
      const a = ag[p.i], g = son._geo[p.i];
      expect(a.daire).toBeInstanceOf(Uint32Array);
      expect(a.daire.length % 3).toBe(0);
      // silindir: iki çember × iki yarım kenar
      expect(a.daire.length / 3).toBe(4);
      for (let q = 0; q < a.daire.length; q += 3) {
        const c = P21.veStepP21KenarCemberi(son._model, a.daire[q], g.M, g.birim);
        expect(c).not.toBe(null);
        for (let sg = a.daire[q + 1]; sg < a.daire[q + 1] + a.daire[q + 2]; sg++) {
          for (const j of [sg * 6, sg * 6 + 3]) {
            const v = [a.cizgi[j], a.cizgi[j + 1], a.cizgi[j + 2]];
            const d = [v[0] - c.c[0], v[1] - c.c[1], v[2] - c.c[2]], h = d[0] * c.n[0] + d[1] * c.n[1] + d[2] * c.n[2];
            expect(Math.abs(h)).toBeLessThan(1e-3);                                   // çemberin düzleminde
            expect(Math.abs(Math.sqrt(d[0] * d[0] + d[1] * d[1] + d[2] * d[2] - h * h) - c.r)).toBeLessThan(2e-3);
            n++;
          }
        }
      }
      // dizinin parçaları çizginin içinde ve çakışmasız
      expect(a.daire[a.daire.length - 2] + a.daire[a.daire.length - 1]).toBeLessThanOrEqual(a.cizgi.length / 6);
    });
    expect(n).toBeGreaterThan(100);
  });

  test('aynı şeklin örnekleri DİZİYİ paylaşır (taşınan yerel ağ)', () => {
    const t = S.tekrarliMontaj();
    const so = STP.veMntStpOku(t);
    const a = STP.veMntStpAgUret(so, [], so.parcalar.map((p) => p.i));
    const brk = so.parcalar.filter((p) => p.ad === 'Braket').map((p) => a[p.i]);
    expect(brk).toHaveLength(3);
    expect(brk[1].daire).toBe(brk[0].daire);
    expect(brk[2].daire).toBe(brk[0].daire);
  });

  test('dizi kaynağa değil ağa ait: Topla ↔ Taşı aynı diziyi verir', () => {
    const p = son.parcalar[0], g = son._geo[p.i];
    const B = SU.veStepUcgenBaglam(son._model, STP.VE_MNT_STP_UCGEN);
    const T = SU.veStepUcgenTopla(B, g.M, g.birim);
    g.yuzler.forEach(T.ekle);
    const r = T.bitir({ yerel: true });
    expect(Array.from(r.yerel.daire)).toEqual(Array.from(r.daire));
    expect(SU.veStepUcgenTasi(r.yerel, g.M).daire).toBe(r.yerel.daire);
  });
});

// ── ÖNERİ ──────────────────────────────────────────────────────────────────
describe('ÖNERİ — eksenden üst bağlantı yüzeyinin merkezi', () => {
  test('TULGA: beş takoz sunudaki CATIA ölçüsüyle 1e-9 mm içinde (ölçüt 0,01 mm); kaynak eksen, daire üst plakanın', () => {
    const { c } = coz({});
    S.TULGA_TAKOZ.forEach(([, ad, p]) => {
      const b = birim(c, ad);
      expect(b.kaynak).toBe('eksen');
      expect(uz(b.konum, p)).toBeLessThan(1e-9);
      expect(b.nokta.r).toBe(35);
      expect(b.nokta.n.map((v) => +v.toFixed(12))).toEqual([0, 0, 1]);
    });
    expect(c.uyarilar).toEqual([]);
  });

  test('ÖNCE ÖLÇÜLEN: hacim merkezi aynı takozda 37,97 mm aşağıdaydı (kalıbın kendisinden)', () => {
    const { c } = coz({});
    const b = birim(c, 'Ön takoz');
    expect(b.c[2] - S.TULGA_TAKOZ[0][2][2]).toBeCloseTo(-37.97, 2);
  });

  test('SOMUNLU: braket boşluğunun üstündeki pul ve somun seçilmez', () => {
    const { c } = coz({ varyant: 'somun' });
    S.TULGA_TAKOZ.forEach(([, ad, p]) => expect(uz(birim(c, ad).konum, p)).toBeLessThan(1e-9));
  });

  test('KONİK: geniş flanşın ve kauçuğun üstündeki göbeğin üstü (saplama sayılmaz)', () => {
    const { c } = coz({ varyant: 'konik' });
    S.TULGA_TAKOZ.forEach(([, ad, p]) => {
      expect(uz(birim(c, ad).konum, p)).toBeLessThan(1e-9);
      expect(birim(c, ad).nokta.r).toBe(20);
    });
  });

  test('EĞİK (30°): eksen dönük, nokta eğik üst yüzün merkezi', () => {
    const z = [0, Math.sin(Math.PI / 6), Math.cos(Math.PI / 6)];
    const { c } = coz({ z, x: [1, 0, 0] });
    S.TULGA_TAKOZ.forEach(([, ad, p]) => {
      const b = birim(c, ad);
      expect(uz(b.konum, p)).toBeLessThan(1e-9);
      expect(uz(b.nokta.n, z)).toBeLessThan(1e-9);
    });
  });

  test('SOMUNLU, SAPLAMASIZ: braket boşluğu BOŞ dilim, üstünde pul ve somun — bağlantı yüzü yine plakanın üstü', () => {
    const { c } = coz({ varyant: 'somun', saplama: false });
    S.TULGA_TAKOZ.forEach(([, ad, p]) => expect(uz(birim(c, ad).konum, p)).toBeLessThan(1e-9));
  });

  test('TERS TAKOZ (alt montaj baş aşağı): üst yine dosyanın +z\'si — flanşın dış yüzü', () => {
    const { c } = coz({ z: [0, 0, -1], x: [1, 0, 0] });
    S.TULGA_TAKOZ.forEach(([, ad, p]) => {
      const b = birim(c, ad);
      expect(uz(b.konum, [p[0], p[1], p[2] + 68])).toBeLessThan(1e-9);
      expect(b.nokta.r).toBe(60);
      expect(b.nokta.n.map((v) => +v.toFixed(12))).toEqual([0, 0, 1]);
    });
  });

  test('CIVATALI FLANŞ: eksen dışındaki iki cıvata (dosyada önce) ekseni ve noktayı değiştirmez', () => {
    const { c } = coz({ civata: true });
    S.TULGA_TAKOZ.forEach(([, ad, p]) => expect(uz(birim(c, ad).konum, p)).toBeLessThan(1e-9));
  });

  test('EKSEN DIŞI YÜZ aday değil: konik takozun göbeğinden yüksek iki cıvata (eksen dışı) seçilmez', () => {
    const { c } = coz({ varyant: 'konik', civata: 80 });
    S.TULGA_TAKOZ.forEach(([, ad, p]) => {
      expect(uz(birim(c, ad).konum, p)).toBeLessThan(1e-9);
      expect(birim(c, ad).nokta.r).toBe(20);
    });
  });

  test('YATAY EKSEN: öneri yok, sebebi söylenir; nokta hacim merkezi', () => {
    const { c } = coz({ z: [0, 1, 0], x: [1, 0, 0] });
    const b = birim(c, 'Ön takoz');
    expect(b.kaynak).toBe('hacim');
    expect(b.nokta).toBeUndefined();
    expect(c.uyarilar).toContain('"Ön takoz": takoz ekseni bulunamadı (eksen düşey değil); nokta hacim merkezi.');
  });

  test('DAİRESİZ (kutu) takoz: öneri yok, sebebi söylenir', () => {
    const son = STP.veMntStpOku(S.gucGrubu());
    const c2 = STP.veMntStpCoz(son, rolle(son, ['Motor bloğu']));
    expect(c2.birimler[0].kaynak).toBe('hacim');
    const t = STP.veMntStpTakozNoktasi(son, son.agac.find((d) => d.ad === 'Motor bloğu').parcalar, []);
    expect(t).toEqual({ ok: false, neden: 'dairesel kenar yok' });
  });

  test('ağ yoksa boyun ölçülmez: en üstteki aday (saplamanın ucu) — ağ şart', () => {
    const son = STP.veMntStpOku(S.tulgaKalibi({ govde: false }));
    const d = son.agac.find((x) => x.ad === 'Ön takoz');
    const bos = STP.veMntStpTakozNoktasi(son, d.parcalar, []);
    expect(bos.c[2] - S.TULGA_TAKOZ[0][2][2]).toBeCloseTo(35, 9);
    const ag = STP.veMntStpAgUret(son, [], d.parcalar);
    const dolu = STP.veMntStpTakozNoktasi(son, d.parcalar, d.parcalar.map((i) => ag[i]));
    expect(uz(dolu.c, S.TULGA_TAKOZ[0][2])).toBeLessThan(1e-9);
  });
});

// ── SEÇİLEN DAİRE ──────────────────────────────────────────────────────────
describe('SEÇİLEN DAİRE — 3B\'de tıklanan kenarın merkezi', () => {
  const son = STP.veMntStpOku(S.tulgaKalibi({}));
  const pi = son.parcalar.findIndex((p) => p.ad === 'Sol ön takoz taban flanşı');
  const ag = STP.veMntStpAgUret(son, [], [pi]);
  const kenar = ag[pi].daire[0];

  test('kenar → seçim: parçanın örnek yolu ve dosyadaki merkez', () => {
    const d = STP.veMntStpKenarDaire(son, pi, kenar);
    expect(d.yol).toEqual(['TK-SOL-ON_ASM.1', 'TK-SOL-ON-FLANS.1']);
    expect(d.r).toBe(60);
    expect([d.c[0], d.c[1]]).toEqual([439.957, -355.957]);
    expect([431.855, 441.855]).toContain(+d.c[2].toFixed(9));
    expect(STP.veMntStpKenarDaire(son, pi, son._geo[pi].yuzler[0])).toBe(null);
  });

  test('hesapta kullanılır (kaynak kenar); aynı yarıçap başka merkez ya da başka yarıçap: öneri + uyarı', () => {
    const d = STP.veMntStpKenarDaire(son, pi, kenar);
    const r = rolle(son, TAKOZ_AD), dug = son.agac.findIndex((x) => x.ad === 'Sol ön takoz');
    const c = STP.veMntStpCoz(son, r, { nokta: { [dug]: { yol: d.yol, c: d.c, r: d.r } } });
    const b = c.birimler.find((x) => x.dugum === dug);
    expect(b.kaynak).toBe('kenar');
    expect(uz(b.konum, d.c)).toBe(0);
    expect(b.nokta.r).toBe(60);
    // bir µm'den uzak merkez · başka yarıçap · olmayan yol
    [{ c: [d.c[0], d.c[1], d.c[2] + 0.01], r: 60 }, { c: d.c, r: 61 }].forEach((x) => {
      const c2 = STP.veMntStpCoz(son, r, { nokta: { [dug]: { yol: d.yol, c: x.c, r: x.r } } });
      const b2 = c2.birimler.find((y) => y.dugum === dug);
      expect(b2.kaynak).toBe('eksen');
      expect(c2.uyarilar).toContain('"Sol ön takoz": seçilen daire bu dosyada yok; öneri kullanıldı.');
    });
    expect(STP.veMntStpDaireBul(son, ['YOK.1'], d.c, d.r)).toBe(null);
    // dosyadaki sayının µm altındaki yuvarlaması bulunur ve dosyadaki sayıya döner
    const y = STP.veMntStpDaireBul(son, d.yol, d.c.map((v) => v + 4e-4), d.r);
    expect(uz(y.c, d.c)).toBe(0);
  });
});

// ── KAYIT ──────────────────────────────────────────────────────────────────
describe('KAYIT — seçilen daire rolle birlikte projeye', () => {
  const son = STP.veMntStpOku(S.tulgaKalibi({}));
  const r = rolle(son, TAKOZ_AD);
  r[son.agac.findIndex((d) => d.ad === 'Motor bloğu')] = 'mnt-motor';
  const dug = son.agac.findIndex((x) => x.ad === 'Sol ön takoz'), mot = son.agac.findIndex((x) => x.ad === 'Motor bloğu');
  const sec = { yol: ['TK-SOL-ON_ASM.1', 'TK-SOL-ON-FLANS.1'], c: [439.957, -355.957, 441.855], r: 60, n: [0, 0, 1] };

  test('yalnız takozun satırında, yönsüz; gövdeye yazılmaz; bozuk kayıt düşer', () => {
    const k = STP.veMntStpRolKaydi(son, r, {}, {}, { [dug]: sec, [mot]: sec, [son.agac.findIndex((x) => x.ad === 'Ön takoz')]: { yol: 'x', c: [1, 2], r: 0 } });
    const satir = k.roller.filter((x) => x.nokta);
    expect(satir).toHaveLength(1);
    expect(satir[0]).toEqual({ yol: ['TK-SOL-ON_ASM.1'], rol: 'mnt-mount', ad: 'Sol ön takoz', nokta: { yol: sec.yol, c: sec.c, r: 60 } });
    expect(JSON.parse(JSON.stringify(k))).toEqual(k);
  });

  test('kayıtta SONRAKİ satır takozun parçasına takoz rolü verirse takoz birimi düşer, seçimi de gider; başka rol iç içe kalır', () => {
    const k = STP.veMntStpRolKaydi(son, r, {}, {}, { [dug]: sec });
    const k2 = JSON.parse(JSON.stringify(k));
    k.roller.push({ yol: ['TK-SOL-ON_ASM.1', 'TK-SOL-ON-FLANS.1'], rol: 'mnt-mount', ad: 'flanş' });
    const u = STP.veMntStpRolKaydiUygula(son, k);
    expect(u.roller[dug]).toBe(null);
    expect(u.nokta).toEqual({});
    k2.roller.push({ yol: ['TK-SOL-ON_ASM.1', 'TK-SOL-ON-FLANS.1'], rol: 'mnt-bracket', ad: 'flanş' });
    const u2 = STP.veMntStpRolKaydiUygula(son, k2);
    expect(u2.roller[dug]).toBe('mnt-mount');
    expect(Object.keys(u2.nokta)).toEqual([String(dug)]);
  });

  test('aynı dosyada geri gelir; rolü düşen düğümün seçimi gider; bozuk satırın seçimi okunmaz', () => {
    const k = STP.veMntStpRolKaydi(son, r, {}, {}, { [dug]: sec });
    const u = STP.veMntStpRolKaydiUygula(STP.veMntStpOku(S.tulgaKalibi({})), k);
    expect(u.nokta).toEqual({ [dug]: { yol: sec.yol, c: sec.c, r: 60 } });
    const k2 = JSON.parse(JSON.stringify(k));
    k2.roller.find((x) => x.nokta).rol = 'mnt-bracket';                     // takoz değil
    expect(STP.veMntStpRolKaydiUygula(son, k2).nokta).toEqual({});
    const k3 = JSON.parse(JSON.stringify(k));
    k3.roller.find((x) => x.nokta).nokta.c = ['a', 1, 2];
    expect(STP.veMntStpRolKaydiUygula(son, k3).nokta).toEqual({});
  });
});

// ── OTURUM ─────────────────────────────────────────────────────────────────
describe('OTURUM — seçim, öneriye dönüş, rol, aktarım', () => {
  let ev = null;
  beforeEach(() => {
    resetStubs(stubs);
    W._mwStpSifirla();
    global.veMntStack = [{ nodeId: 'mod-1' }];
    ev = { id: 'v1', type: 'mnt-viewer', def: componentDefs['mnt-viewer'], data: {} };
    global.nodes = [ev];
  });
  afterEach(() => { delete global.veMntStack; });
  const ac = () => {
    const s = W.veMntWizStpOku(S.tulgaKalibi({}), 'tulga.stp');
    TAKOZ_AD.forEach((a) => W.veMntWizStpRol(s.sonuc.agac.findIndex((d) => d.ad === a), 'mnt-mount'));
    W.veMntWizStpHesapla();
    return s;
  };
  const daire = (s) => {
    const pi = s.sonuc.parcalar.findIndex((p) => p.ad === 'Sol ön takoz taban flanşı');
    const ag = STP.veMntStpAgUret(s.sonuc, s.ag, [pi]);
    return STP.veMntStpKenarDaire(s.sonuc, pi, ag[pi].daire[0]);
  };

  test('seçim hesabı yeniler (kaynak kenar), kayda yazılır; öneriye dönüş ikisini de geri alır', () => {
    const s = ac(), dug = s.sonuc.agac.findIndex((d) => d.ad === 'Sol ön takoz'), d = daire(s);
    const b = () => s.coz.birimler.find((x) => x.dugum === dug);
    expect(b().kaynak).toBe('eksen');
    expect(W.veMntWizStpNokta(dug, d)).toBe(true);
    expect(b().kaynak).toBe('kenar');
    expect(uz(b().konum, d.c)).toBe(0);
    expect(s.nokta[dug]).toEqual({ yol: d.yol, c: d.c, r: 60, n: d.n });
    expect(ev.data.cad.roller.find((x) => x.ad === 'Sol ön takoz').nokta).toEqual({ yol: d.yol, c: d.c, r: 60 });
    expect(W.veMntWizStpNoktaKaynak(b())).toBe('Daire Ø 120,0');
    expect(W.veMntWizStpNokta(dug, null)).toBe(true);
    expect(b().kaynak).toBe('eksen');
    expect(W.veMntWizStpNoktaKaynak(b())).toBe('Üst yüz Ø 70,0');
    expect(ev.data.cad.roller.find((x) => x.ad === 'Sol ön takoz').nokta).toBeUndefined();
    expect(W.veMntWizStpNokta(dug, null)).toBe(false);                         // dönülecek seçim yok
  });

  test('takoz olmayan birime seçim verilmez; rolü düşen (ya da değişen) takozun seçimi gider', () => {
    const s = ac(), dug = s.sonuc.agac.findIndex((d) => d.ad === 'Sol ön takoz'), d = daire(s);
    expect(W.veMntWizStpNokta(s.sonuc.agac.findIndex((x) => x.ad === 'Motor bloğu'), d)).toBe(false);
    W.veMntWizStpNokta(dug, d);
    W.veMntWizStpRol(dug, 'mnt-bracket');
    expect(s.nokta[dug]).toBeUndefined();
    W.veMntWizStpRol(dug, 'mnt-mount');
    W.veMntWizStpNokta(dug, d);
    W.veMntWizStpRol(s.sonuc.agac[dug].ebeveyn === 0 ? s.sonuc.agac[dug].cocuklar[0] : dug, 'mnt-mount');   // torun rol alınca birim değişir
    expect(s.nokta[dug]).toBeUndefined();
  });

  test('aynı dosya yeniden okununca seçim kayıttan gelir; aktarım imzası seçimi içerir', () => {
    const s = ac(), dug = s.sonuc.agac.findIndex((d) => d.ad === 'Sol ön takoz'), d = daire(s);
    const i0 = W._mwStpImza(s);
    W.veMntWizStpNokta(dug, d);
    expect(W._mwStpImza(s)).not.toBe(i0);
    W.veMntWizStpKapat();
    const s2 = W.veMntWizStpOku(S.tulgaKalibi({}), 'tulga.stp');
    expect(s2.nokta).toEqual({ [dug]: { yol: d.yol, c: d.c, r: 60 } });
    W.veMntWizStpHesapla();
    expect(s2.coz.birimler.find((x) => x.dugum === dug).kaynak).toBe('kenar');
  });

  test('uyarı işareti: gövdede kutu merkezi, takozda öneri ya da seçim dışı her kaynak', () => {
    expect(W.veMntWizStpKonumUyari({ tip: 'mnt-motor', kaynak: 'hacim' })).toBe(false);
    expect(W.veMntWizStpKonumUyari({ tip: 'mnt-motor', kaynak: 'kutu' })).toBe(true);
    expect(W.veMntWizStpKonumUyari({ tip: 'mnt-mount', kaynak: 'eksen' })).toBe(false);
    expect(W.veMntWizStpKonumUyari({ tip: 'mnt-mount', kaynak: 'kenar' })).toBe(false);
    expect(W.veMntWizStpKonumUyari({ tip: 'mnt-mount', kaynak: 'hacim' })).toBe(true);
    expect(W._mwStpKonum([1381.6715, -304.131, 51.439], 3)).toBe('1.381,672; −304,131; 51,439');
    expect(W._mwStpKonum([124.96, 0.05, 550.03])).toBe('125,0; 0,1; 550,0');
  });

  test('ağaç: takozun konumu 0,001 mm haneli; hücrenin ipucu tam konum + kaynağı', () => {
    const s = ac(), d = document.createElement('div');
    s.acik = null;
    d.innerHTML = W._mwStpAgacHTML(s);
    const tr = Array.from(d.querySelectorAll('tr[data-ve-stp]')).find((x) => x.cells[0].textContent.trim() === 'Sol ön takoz');
    expect(tr.cells[2].textContent.trim()).toBe('439,957; −355,957; 499,855');
    expect(tr.cells[2].getAttribute('title')).toBe('439,957; −355,957; 499,855 · Üst yüz Ø 70,0');
  });
});

// ── PENCERE — kayıtlı roller föyü ──────────────────────────────────────────
describe('PENCERE — kayıtlı roller föyünde seçilen daire', () => {
  test('takozun dairesi çapıyla, merkezi ipucunda; seçimsiz satır —', () => {
    global.veSayi = require('../../js/sayi.js').veSayi;
    const k = { roller: [
      { yol: ['TK-SOL-ON_ASM.1'], rol: 'mnt-mount', ad: 'Sol ön takoz', nokta: { yol: ['TK-SOL-ON_ASM.1', 'F.1'], c: [439.957, -355.957, 441.855], r: 60 } },
      { yol: ['MOTOR.1'], rol: 'mnt-motor', ad: 'Motor bloğu', kg: 418 }] };
    const d = document.createElement('div');
    d.innerHTML = CAD._mntCadKayitHTML(k);
    const satir = Array.from(d.querySelectorAll('tbody tr')).map((tr) => Array.from(tr.cells).map((c) => c.textContent.trim()));
    expect(satir).toEqual([['Sol ön takoz', 'Takoz', '—', 'Ø 120,0'], ['Motor bloğu', 'Motor', '418,0', '—']]);
    expect(d.querySelector('tbody tr td:nth-child(4)').getAttribute('title')).toBe('439,957; −355,957; 441,855');
  });
});

// ── KAYNAK DÜZENİ ──────────────────────────────────────────────────────────
describe('KAYNAK — nokta dosyadan, ağdan değil', () => {
  test('mount-step: takozun konumu üçgen ağından türetilmez (konum = dairenin merkezi)', () => {
    const src = fs.readFileSync(path.join(__dirname, '../../js/mount-step.js'), 'utf8');
    const govde = src.slice(src.indexOf('function veMntStpTakozNoktasi'), src.indexOf('function veMntStpDaireBul'));
    expect(govde).toMatch(/c: g\.d\.c\.slice\(\)/);
    expect(govde).not.toMatch(/c: \[.*U\[/);
  });
});

// ── ESC — sihirbazın içinde önce kip kapanır ───────────────────────────────
describe('ESC — sihirbazda daireden seçim kipi önce kapanır', () => {
  afterEach(() => { delete global.veMntWiz3bNoktaBitir; delete global.veMntWiz3bAcik; delete global.veMntWiz3bKapat; });
  test('kip açıkken Esc yalnız kipi kapatır; kapalıyken 3B\'yi', () => {
    let kip = true;
    global.veMntWiz3bNoktaBitir = jest.fn(() => { const k = kip; kip = false; return k; });
    global.veMntWiz3bAcik = jest.fn(() => true);
    global.veMntWiz3bKapat = jest.fn();
    W.veMntWizKey({ key: 'Escape' });
    expect(global.veMntWiz3bKapat).not.toHaveBeenCalled();
    W.veMntWizKey({ key: 'Escape' });
    expect(global.veMntWiz3bKapat).toHaveBeenCalledTimes(1);
  });
});
