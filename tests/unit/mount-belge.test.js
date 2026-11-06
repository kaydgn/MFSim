/**
 * mount-belge.test.js — ŞANZIMAN AİLESİNİN BELGESİ (Canlı Not 52, 2026-11-06)
 * ─────────────────────────────────────────────────────────────────────────
 * Kullanıcı: *"Önce şanzıman ailesi seçeriz, ardından o seçtiğimiz şanzıman
 * ailesine ait PDF açılır ve o PDF üzerinden işaretlemeli şekilde şanzımanın
 * özelliklerini seçeriz. Ama PDF ile aynı kalırız."*
 *
 * Sayfalar ve bölgeler belgeden ÜRETİLİR (tools/belge-sayfa.js → js/mount-belge-veri.js):
 *   · VERİ — her sayfanın görseli diskte, kutular sayfanın içinde, aynı sayfada iki
 *     bölge üst üste binmez (tık hangi satırın olduğunu bilir), her seçeneğin her
 *     değeri en az bir bölgeden seçilir.
 *   · PDF İLE AYNI — bölgenin satırındaki sayılar (belgeden okunan, metrik) programın
 *     Allison 4000 tablolarıyla birebir: 62 değer (§8 · §9 · §11 · §12 · §13).
 *     Belge değişirse ya da tablo elle bozulursa burası kırmızı.
 *   · DURUM — seçimin bölgeleri seçili; 7-Speed'de altı vitesin satırları kapalı ve
 *     sebebi listedeki dille; tık ailenin sırasıyla yazar (koşul önce).
 *   · GÖRÜNÜM — belgenin HTML'i (sayfa, bölge, dizin) ve Özellikler'in Belge satırı.
 *   · ARAÇ — belgenin sayılarını okuyan ayrıştırıcı (kapanmayan parantez, en tire).
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
const { VE_MNT_BELGE } = require('../../js/mount-belge-veri.js');
global.VE_MNT_BELGE = VE_MNT_BELGE;
const BL = require('../../js/mount-belge.js');
Object.keys(BL).forEach((k) => { global[k] = BL[k]; });
eval(loadSource('cp-mount-wizard.js'));
const W = module.exports;
Object.keys(W).forEach((k) => { if (global[k] === undefined) global[k] = W[k]; });
const CAD = require('../../js/cp-mount-cad.js');
Object.keys(CAD).forEach((k) => { if (global[k] === undefined) global[k] = CAD[k]; });
eval(loadSource('cp-mount-3b.js'));
const M3 = module.exports;
Object.keys(M3).forEach((k) => { if (global[k] === undefined) global[k] = M3[k]; });
eval(loadSource('cp-mount-3b-belge.js'));
const MB = module.exports;
Object.keys(MB).forEach((k) => { global[k] = MB[k]; });
const { sayilar } = require('../../tools/belge-sayfa.js');
const TANIM = require('../../tools/belge-tanim.js');
const S = require('../helpers/step-takoz.js');

const A = VS.VE_MNT_A4K, B = VE_MNT_BELGE['allison-4000'];
const yol = (p) => p.split('.').reduce((o, k) => (o == null ? o : o[k]), A);
const varsayilan = () => VS.veMntVeriSayfasi('allison-4000');
const uye = (o) => VS.veMntVeriSayfasi(VS.veMntVsAnahtar(A, Object.assign({}, varsayilan().secenek, o)));
const sayfa = (no) => B.sayfalar.find((s) => s.no === no);
const kur = (html) => { const el = document.createElement('div'); el.innerHTML = html; return el; };

beforeEach(() => resetStubs(stubs));

describe('VERİ — sayfalar, kutular, kapsam', () => {
  test('tanımın her sayfası üretilmiş; görsel diskte ve ölçüsü kayıtla aynı; ailenin künyesi', () => {
    expect([B.ad, B.kod, B.tarih, B.olcu]).toEqual(['4000 Product Family Transmission Data', 'DATA_4K', '15.10.2020', [612, 792]]);
    expect(B.sayfalar.map((s) => s.no)).toEqual(TANIM['allison-4000'].sayfalar.map((s) => s.no));
    expect(B.sayfalar.map((s) => s.no)).toEqual([5, 6, 7, 8, 9, 10, 21, 27, 33, 37, 41, 45]);
    const { webpOlcu } = require('../../tools/karsilama-webp.js');
    B.sayfalar.forEach((s) => {
      const f = path.join(KOK, 'assets', s.resim);
      expect(fs.existsSync(f)).toBe(true);
      expect(webpOlcu(fs.readFileSync(f))).toEqual([s.g, s.y]);
      expect(s.bolge.length).toBe(TANIM['allison-4000'].sayfalar.find((t) => t.no === s.no).bolge.length);
    });
    // klasörde öksüz sayfa yok
    expect(fs.readdirSync(path.join(KOK, 'assets/belge/allison-4000')).sort()).toEqual(B.sayfalar.map((s) => path.basename(s.resim)).sort());
  });

  test('her kutu sayfanın içinde ve boş değil; aynı sayfada iki bölge üst üste binmez', () => {
    B.sayfalar.forEach((s) => {
      s.bolge.forEach((b) => {
        const [x, y, g, h] = b.k;
        expect(g).toBeGreaterThan(8); expect(h).toBeGreaterThan(8);
        expect(x).toBeGreaterThanOrEqual(0); expect(y).toBeGreaterThanOrEqual(0);
        expect(x + g).toBeLessThanOrEqual(B.olcu[0]); expect(y + h).toBeLessThanOrEqual(B.olcu[1]);
      });
      for (let i = 0; i < s.bolge.length; i++) for (let j = i + 1; j < s.bolge.length; j++) {
        const a = s.bolge[i].k, c = s.bolge[j].k;
        const ust = a[0] < c[0] + c[2] && c[0] < a[0] + a[2] && a[1] < c[1] + c[3] - 0.05 && c[1] < a[1] + a[3] - 0.05;
        expect([s.no, i, j, ust]).toEqual([s.no, i, j, false]);
      }
    });
  });

  // Belgede "akümülatör yok" satırı yok: akümülatör belgede yalnız eklenir (Yok listeden)
  test('bölgenin yazdığı her değer ailenin seçeneği; belgenin satırı olan her değer belgeden seçilir', () => {
    const kapsam = {};
    B.sayfalar.forEach((s) => s.bolge.forEach((b) => {
      Object.keys(b.s || {}).concat(Object.keys(b.ek || {})).forEach((k) => {
        const o = A.secenek.find((x) => x.k === k);
        expect(o && o.d).toBeTruthy();
        [].concat((b.s || {})[k] || [], (b.ek || {})[k] || []).forEach((v) => expect(o.d.map((e) => e[0])).toContain(v));
      });
      Object.keys(b.s || {}).forEach((k) => { (kapsam[k] = kapsam[k] || {})[b.s[k]] = 1; });
    }));
    const hepsi = (k) => A.secenek.find((o) => o.k === k).d.map((e) => e[0]).sort();
    expect(Object.keys(kapsam).sort().map((k) => [k, Object.keys(kapsam[k]).sort()])).toEqual(
      ['aku', 'bag', 'dizi', 'kar', 'pto', 'ret', 'sog'].map((k) => [k, k === 'aku' ? ['1'] : hepsi(k)]));
  });
});

describe('PDF İLE AYNI — belgenin satırındaki sayılar programın tablosunda', () => {
  test('62 değer: §8 kuru kütleler, §9 ağırlık merkezi, §11 atalet, §12 oranlar, §13 yağ', () => {
    const L = [];
    B.sayfalar.forEach((s) => s.bolge.forEach((b) => {
      if (!b.alan) return;
      const prog = [].concat(b.alan).reduce((t, a) => t.concat(yol(a)), []);
      L.push([s.no, b.alan, prog, b.d]);
    }));
    // 11 kütle · 20 + 8 ağırlık merkezi (×3) · 10 atalet (×3) · 3 sütun oran (7 + 7 + 8) · 10 yağ
    expect(L.reduce((t, x) => t + x[3].length, 0)).toBe(157);
    expect(L.length).toBe(62);
    L.forEach(([no, alan, prog, d]) => expect([no, alan, d]).toEqual([no, alan, prog]));
  });

  test('bölgenin seçtiği üye o satırın tablosunu kullanır: ağırlık merkezi ve atalet satırdan', () => {
    // §9 satırı → kaydın ağırlık merkezi (Allison X·Y·Z → boy · −yukarı · −yan)
    sayfa(6).bolge.concat(sayfa(7).bolge).filter((b) => b.alan).forEach((b) => {
      const v = BL.veMntBelgeDurum(A, varsayilan(), b).anahtar, P = VS.veMntVeriSayfasi(v || varsayilan().k);
      const [X, Y, Z] = b.d;
      expect([b.alan, P.cg.boy, P.cg.yukari, P.cg.yan]).toEqual([b.alan, X, -Y, -Z + 0]);
    });
    // §11 satırı → atalet
    sayfa(8).bolge.filter((b) => b.alan).forEach((b) => {
      const P = VS.veMntVeriSayfasi(BL.veMntBelgeDurum(A, varsayilan(), b).anahtar);
      expect([b.alan, P.atalet.x, P.atalet.y, P.atalet.z]).toEqual([b.alan].concat(b.d));
    });
  });
});

describe('DURUM — seçili · geçerli · sebep · yazılan anahtar', () => {
  const seciliSatirlar = (vs) => B.sayfalar.map((s) => [s.no, s.bolge.map((b, i) => (BL.veMntBelgeDurum(A, vs, b).secili ? i : -1)).filter((i) => i >= 0)]);
  test('varsayılan (CR · Direct mount · PTO yok · Retarder yok · Remote · Deep): tablolarda o satırlar', () => {
    expect(seciliSatirlar(varsayilan())).toEqual([[5, [0, 12]], [6, [0, 1, 2]], [7, []], [8, [0]], [9, [0]], [10, [1]],
      [21, []], [27, []], [33, []], [37, []], [41, [0]], [45, [0]]]);
  });
  test('7-Speed: altı vitesin satırları kapalı, sebebi "Vites konfigürasyonu: 7-Speed."; yedi vitesin satırı seçilir', () => {
    const v7 = uye({ dizi: '7' });
    const d6 = BL.veMntBelgeDurum(A, v7, sayfa(6).bolge[2]);
    expect(d6).toEqual({ secili: false, tik: false, anahtar: null, neden: 'Vites konfigürasyonu: 7-Speed.' });
    const sig = sayfa(10).bolge.find((b) => b.alan === 'yag.6.sig.0');
    expect(BL.veMntBelgeDurum(A, v7, sig).neden).toBe('Vites konfigürasyonu: 7-Speed.');
    expect(seciliSatirlar(v7).find((x) => x[0] === 7)[1]).toEqual([0, 1]);   // DIRECT-MOUNT · No Retarder, No PTO
    // akümülatör retardersizde: tık retarderi de yazar
    const aku = sayfa(5).bolge.find((b) => b.alan === 'kutle.aku');
    expect(VS.veMntVeriSayfasi(BL.veMntBelgeDurum(A, varsayilan(), aku).anahtar).secenek).toMatchObject({ ret: '1', aku: '1', sog: 'u' });
  });
  test('tık ailenin sırasıyla yazar: retarderli soğutucu retarderi açar; altı vitesin satırı 7-Speed yazmaz; tıksız satır yazmaz', () => {
    const r = BL.veMntBelgeDurum(A, uye({ sog: 's' }), sayfa(5).bolge.find((b) => b.alan === 'kutle.sog.r'));
    expect(VS.veMntVeriSayfasi(r.anahtar).secenek).toMatchObject({ ret: '1', sog: 'r' });
    const satir = sayfa(6).bolge.find((b) => b.alan === 'cg.6.u.11.r');
    expect(VS.veMntVeriSayfasi(BL.veMntBelgeDurum(A, varsayilan(), satir).anahtar).secenek).toMatchObject({ dizi: 'cr', bag: 'u', ret: '1', pto: '1', sog: 'r' });
    const w = BL.veMntBelgeDurum(A, varsayilan(), sayfa(9).bolge[1]);
    expect(VS.veMntVeriSayfasi(w.anahtar).secenek.dizi).toBe('wr');
    expect(BL.veMntBelgeDurum(A, varsayilan(), sayfa(5).bolge[0])).toEqual({ secili: true, tik: false, anahtar: null, neden: '' });
  });
  test('bölgenin adı yazdığı değerlerle, ailenin sırasıyla', () => {
    expect(BL.veMntBelgeEtiket(A, sayfa(5).bolge.find((b) => b.alan === 'kutle.sog.r'))).toBe('Retarder: Var · Soğutucu: Direct · retarder/sump');
    expect(BL.veMntBelgeEtiket(A, sayfa(9).bolge[2])).toBe('Vites konfigürasyonu: 7-Speed');
    expect(BL.veMntBelgeEtiket(A, sayfa(5).bolge[0])).toBe('');
  });
});

describe('GÖRÜNÜM — belgenin HTML\'i, Özellikler\'in Belge satırı', () => {
  test('12 sayfa, 85 bölge (tıklanan düğme, tıksız işaret), dizinde bölümler; konum sayfanın yüzdesi', () => {
    const el = kur(MB.veMntWiz3bBelgeHTML(B));
    expect(el.querySelectorAll('.ve-mw-3b-belge-s')).toHaveLength(12);
    const tik = B.sayfalar.reduce((t, s) => t + s.bolge.filter((b) => b.s).length, 0);
    expect(el.querySelectorAll('button[data-belge-b]')).toHaveLength(tik);
    expect(el.querySelectorAll('[data-belge-y]')).toHaveLength(85 - tik);
    expect(Array.from(el.querySelectorAll('[data-belge-git] span')).map((x) => x.textContent)).toEqual(B.sayfalar.map((s) => s.bas));
    const img = el.querySelector('[data-belge-sayfa="9"] img');
    expect([img.getAttribute('src'), img.getAttribute('alt')]).toEqual(['assets/belge/allison-4000/s09.webp', 'Page 9']);
    const b = el.querySelector('[data-belge-b="4-0"]'), k = sayfa(9).bolge[0].k;
    expect(parseFloat(b.style.left)).toBeCloseTo(k[0] / 612 * 100, 2);
    expect(parseFloat(b.style.height)).toBeCloseTo(k[3] / 792 * 100, 2);
    // gömülü görsel varsa derlemenin haritasından
    window.__MFSIM_BELGE = { 'belge/allison-4000/s09.webp': 'data:image/webp;base64,AA' };
    expect(kur(MB.veMntWiz3bBelgeHTML(B)).querySelector('[data-belge-sayfa="9"] img').getAttribute('src')).toBe('data:image/webp;base64,AA');
    delete window.__MFSIM_BELGE;
  });

  test('derleme belgenin bütün sayfalarını gömer (assets/belge)', () => {
    const src = fs.readFileSync(path.join(KOK, 'build.js'), 'utf8');
    expect(src).toMatch(/window\.__MFSIM_BELGE = /);
    expect(src).toMatch(/path\.join\(ROOT, 'assets', 'belge'\)/);
    expect(src).toMatch(/BELGE\['belge\/' \+ aile \+ '\/' \+ f\]/);
  });

  test('Özellikler: ailenin satırının altında Belge (Transmission Data); liste seçimi açar; motorda satır yok', () => {
    const TAKOZ = S.TULGA_TAKOZ.map((t) => t[1]);
    const s = W.veMntWizStpOku(S.tulgaKalibi({ oteleme: S.TULGA_OTELEME, krank: true }), 'tulga.stp');
    const i = (a) => s.sonuc.agac.findIndex((d) => d.ad === a);
    s.sonuc.agac.forEach((d) => { if (TAKOZ.indexOf(d.ad) >= 0) W.veMntWizStpRol(d.i, 'mnt-mount'); });
    W.veMntWizStpRol(i('Şanzıman gövdesi'), 'mnt-gearbox');
    W.veMntWizStpRol(i('Motor bloğu'), 'mnt-motor');
    const sanz = i('Şanzıman gövdesi');
    let el = kur(M3.veMntWiz3bAltHTML(s, sanz, {}));
    expect(el.querySelector('#ve-mw-3b-belge-ac')).toBe(null);
    expect(el.querySelector('#ve-mw-3b-veri').getAttribute('onchange')).toBe('veMntWiz3bVeriSec(' + sanz + ', this.value)');
    W.veMntWizStpYogunluk(sanz, 'allison-4000');
    el = kur(M3.veMntWiz3bAltHTML(s, sanz, {}));
    const kb = Array.from(el.querySelectorAll('.ve-mw-3b-kb')).map((x) => x.textContent);
    expect(kb.slice(0, 4)).toEqual(['Rol', 'Şanzıman ailesi', 'Belge', 'Vites konfigürasyonu']);
    const b = el.querySelector('#ve-mw-3b-belge-ac');
    expect([b.textContent.trim(), b.getAttribute('title'), b.getAttribute('aria-pressed')])
      .toEqual(['Transmission Data', '4000 Product Family Transmission Data · 15.10.2020', 'false']);
    expect(b.getAttribute('onclick')).toBe('veMntWiz3bBelgeAc(' + sanz + ')');
    expect(kur(M3.veMntWiz3bAltHTML(s, i('Motor bloğu'), {})).querySelector('#ve-mw-3b-belge-ac')).toBe(null);
  });
});

describe('ARAÇ — belgenin sayıları', () => {
  test('parantezdeki ABD birimi atılır (kapanmasa da), en tire eksidir, tek tire sayı değildir', () => {
    expect(sayilar('342.7 (13.49)')).toEqual([342.7]);
    expect(sayilar('15.55 (11.47) 54.06 (39.87)')).toEqual([15.55, 54.06]);
    expect(sayilar('49.84 (36.76')).toEqual([49.84]);
    expect(sayilar('– 4.80')).toEqual([-4.8]);
    expect(sayilar('–1.5 (–0.06)')).toEqual([-1.5]);
    expect(sayilar('51.3 ((2.02)')).toEqual([51.3]);
    expect(sayilar('–')).toEqual([]);
    expect(sayilar('kg-m² (lb f -ft-sec²)')).toEqual([]);
  });
});
