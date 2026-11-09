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
 *     sebebi listedeki dille; tık ailenin sırasıyla yazar (koşul önce); birbirini dışlayan
 *     satırlardan en çok biri seçili, zorunlu grupta tam biri; tıkın değiştireceği öteki
 *     satırlar (ön izleme).
 *   · GÖRÜNÜM — belgenin HTML'i (sayfa, bölge, işaret, zorunlu seçimin çizgisi) ve
 *     Özellikler'in Belge satırı.
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
    expect(d6).toEqual({ secili: false, tik: false, anahtar: null, neden: 'Vites konfigürasyonu: 7-Speed.', kaldir: null, radyo: true });
    const sig = sayfa(10).bolge.find((b) => b.alan === 'yag.6.sig.0');
    expect(BL.veMntBelgeDurum(A, v7, sig).neden).toBe('Vites konfigürasyonu: 7-Speed.');
    expect(seciliSatirlar(v7).find((x) => x[0] === 7)[1]).toEqual([0, 1]);   // DIRECT-MOUNT (başlık) · No Retarder, No PTO
    // akümülatör retardersizde: tık retarderi de yazar
    const aku = sayfa(5).bolge.find((b) => b.alan === 'kutle.aku');
    expect(VS.veMntVeriSayfasi(BL.veMntBelgeDurum(A, varsayilan(), aku).anahtar).secenek).toMatchObject({ ret: '1', aku: '1', sog: 'u' });
  });
  test('tık ailenin sırasıyla yazar: retarderli soğutucu retarderi açar; altı vitesin satırı 7-Speed yazmaz; yalnız işaret yazmaz', () => {
    const r = BL.veMntBelgeDurum(A, uye({ sog: 's' }), sayfa(5).bolge.find((b) => b.alan === 'kutle.sog.r'));
    expect(VS.veMntVeriSayfasi(r.anahtar).secenek).toMatchObject({ ret: '1', sog: 'r' });
    const satir = sayfa(6).bolge.find((b) => b.alan === 'cg.6.u.11.r');
    expect(VS.veMntVeriSayfasi(BL.veMntBelgeDurum(A, varsayilan(), satir).anahtar).secenek).toMatchObject({ dizi: 'cr', bag: 'u', ret: '1', pto: '1', sog: 'r' });
    const w = BL.veMntBelgeDurum(A, varsayilan(), sayfa(9).bolge[1]);
    expect(VS.veMntVeriSayfasi(w.anahtar).secenek.dizi).toBe('wr');
    // yalnız işaret: Output Flange (her seçimde) ve tabloların başlıkları (Canlı Not 73: başlığın tıkı
    // alt satırlardan birini kendiliğinden seçiyordu)
    const yalniz = { secili: true, tik: false, anahtar: null, neden: '', kaldir: null, radyo: false };
    expect(BL.veMntBelgeDurum(A, varsayilan(), sayfa(5).bolge[12])).toEqual(yalniz);
    expect(BL.veMntBelgeDurum(A, varsayilan(), sayfa(6).bolge[0])).toEqual(yalniz);              // DIRECT-MOUNT TRANSMISSIONS
    expect(BL.veMntBelgeDurum(A, varsayilan(), sayfa(6).bolge[1])).toEqual(yalniz);              // No Retarder, No PTO Provision
    expect(BL.veMntBelgeDurum(A, uye({ ret: '1' }), sayfa(8).bolge[2])).toEqual(yalniz);          // With Retarder, No PTO Provision
    expect(B.sayfalar.map((s) => [s.no, s.bolge.filter((b) => !b.s).length])).toEqual(
      [[5, 1], [6, 10], [7, 2], [8, 2], [9, 0], [10, 0], [21, 0], [27, 0], [33, 0], [37, 0], [41, 0], [45, 0]]);
  });
  // Canlı Not 56 (kullanıcı 2026-11-06): "Seçtiklerimizi geri kaldıramıyoruz. Yani seçim oluyor
  // ama iptal edemiyoruz." Önce: işaretli bölgenin tıkı hiçbir şey yazmıyordu (anahtar = seçim).
  // Şimdi kaldırır — en özel seçenekten başlayarak, bölge düşene dek varsayılana.
  test('KALDIR: işaretli onay kutusunun tıkı seçimini kaldırır — en özel seçenek önce; varsayılanın kendisi kilitli', () => {
    const k = (vs, b) => { const d = BL.veMntBelgeDurum(A, vs, b); return d.kaldir ? VS.veMntVeriSayfasi(d.kaldir).secenek : null; };
    const p5 = (alan) => sayfa(5).bolge.find((b) => b.alan === alan);
    const tam = uye({ dizi: '7', pto: '1', ret: '1', sog: 'r', aku: '1', bag: 'u' });
    // PTO · akümülatör · bağlama: yalnız kendi seçeneği
    expect(k(tam, p5('kutle.pto'))).toMatchObject({ pto: '0', ret: '1', sog: 'r', aku: '1', dizi: '7', bag: 'u' });
    expect(k(tam, p5('kutle.aku'))).toMatchObject({ aku: '0', ret: '1', sog: 'r' });              // retarder kalır
    expect(k(tam, p5('kutle.uzak'))).toMatchObject({ bag: 'd', dizi: '7' });
    // retarderin kendisi: soğutucu ve akümülatör de düşer
    expect(k(tam, p5('kutle.ret'))).toMatchObject({ ret: '0', sog: 'u', aku: '0', pto: '1' });
    // retarderli olmayan soğutucu onay kutusu (bu sayfada "yok" satırı yok): kaldırınca Remote
    expect(k(uye({ sog: 's' }), p5('kutle.sog.s'))).toMatchObject({ ret: '0', sog: 'u' });
    // soğutucunun sayfası (17.3): retarder kalkar (soğutucu zaten Remote)
    expect(k(uye({ ret: '1' }), sayfa(21).bolge[0])).toMatchObject({ ret: '0', sog: 'u' });
    // varsayılanın kendisi kilitli: yalnız uzak soğutucunun sayfaları (öteki varsayılanlar birbirini dışlayan satırda)
    const kilitli = B.sayfalar.reduce((L, s0) => L.concat(s0.bolge.filter((b) => {
      const d = BL.veMntBelgeDurum(A, varsayilan(), b);
      return b.s && d.secili && !d.kaldir && !d.radyo;
    }).map((b) => s0.no + ':' + JSON.stringify(b.s))), []);
    expect(kilitli).toEqual(['41:{"sog":"u"}', '45:{"sog":"u"}']);
    // işaretli her onay kutusu ya kaldırılır ya kilitli; kaldırılan bölge seçimden düşer, kayıt geçerli
    [varsayilan(), tam, uye({ ret: '1', sog: 'u', pto: '1' }), uye({ bag: 'u', kar: 'sig' })].forEach((vs) => {
      B.sayfalar.forEach((s0) => s0.bolge.forEach((b) => {
        const d = BL.veMntBelgeDurum(A, vs, b);
        if (!d.secili || !d.kaldir) return;
        const P = VS.veMntVeriSayfasi(d.kaldir);
        expect(P).not.toBeNull();
        expect(BL.veMntBelgeDurum(A, P, b).secili).toBe(false);
      }));
    });
  });
  // ZORUNLU SEÇİM (kullanıcı 2026-11-09, Canlı Not 73): "'Retarder Option' seçeneğine tıkladığım zaman,
  // altındaki iki seçenekten birini seçiyor. Ama … aşağıdakilerden birinin zorunlu olduğunu belirgin
  // etmemiz gerekiyor. … Diğer maddelerde de var böyle şeyler." Önce: bütün satırlar onay kutusuydu,
  // seçili satırın tıkı onu kaldırıyordu ve tabloların başlığı alt satırlarından birini seçiyordu.
  // Şimdi birbirini dışlayan satırlar bir grup: her seçimde gruptan EN ÇOK biri seçili, zorunlu
  // grupta TAM biri; seçili satırın tıkı seçimi kaldırmaz (öteki satır seçilir).
  test('ZORUNLU SEÇİM: ailenin her üyesinde gruptan en çok biri seçili; zorunlu grupta tam biri', () => {
    const D = (k) => A.secenek.find((o) => o.k === k).d.map((e) => e[0]);
    const uyeler = [];
    D('dizi').forEach((dizi) => D('bag').forEach((bag) => D('pto').forEach((pto) => D('ret').forEach((ret) =>
      D('sog').forEach((sog) => D('kar').forEach((kar) => D('aku').forEach((aku) => {
        const sec = { dizi, bag, pto, ret, sog, kar, aku };
        const ok = A.secenek.every((o) => Object.keys(o.kosul || {}).every((bk) => { const izin = o.kosul[bk][sec[bk]]; return !izin || izin.indexOf(sec[o.k]) >= 0; }));
        if (ok) uyeler.push(sec);
    })))))));
    // bağlama 2 × PTO 2 × (retarder yok: soğutucu 3 · var: soğutucu 2 × akümülatör 2) × (CR · WR: karter 2 · 7-Speed: Deep)
    expect(uyeler).toHaveLength(2 * 2 * (3 + 2 * 2) * (2 + 2 + 1));
    const say = (sec, f) => B.sayfalar.reduce((t, s) => t + s.bolge.filter((b) => f(s, b) && BL.veMntBelgeDurum(A, { k: 'x', secenek: sec }, b).secili).length, 0);
    const gruplar = {};
    B.sayfalar.forEach((s) => s.bolge.forEach((b) => { if (b.grup) gruplar[s.no + ':' + b.grup] = 1; }));
    expect(Object.keys(gruplar).sort()).toEqual(['10:yag', '5:dizi', '5:sog-ret', '6:cg', '7:cg', '8:at', '9:dizi'].sort());
    uyeler.forEach((sec) => {
      Object.keys(gruplar).forEach((g) => {
        const [no, ad] = g.split(':');
        expect([g, say(sec, (s, b) => String(s.no) === no && b.grup === ad) <= 1]).toEqual([g, true]);
      });
      const tam = (f) => say(sec, f);
      expect([sec, tam((s, b) => b.grup === 'dizi' && s.no === 5), tam((s, b) => b.grup === 'dizi' && s.no === 9),
        tam((s, b) => b.grup === 'cg'), tam((s, b) => b.grup === 'at'), tam((s, b) => b.grup === 'yag'),
        tam((s, b) => b.grup === 'sog-ret')]).toEqual([sec, 1, 1, 1, 1, 1, sec.ret === '1' ? 1 : 0]);
    });
  });
  test('ZORUNLU SEÇİM: seçili satırın tıkı kaldırmaz, öteki satır seçilir; zorunlu grubun üst satırı belgede', () => {
    const p5 = (alan) => sayfa(5).bolge.find((b) => b.alan === alan);
    // Canlı Not 74: "Birincisi neden seçilmiyor? İkincisini seçebiliyorum?" — 7-Speed'den altı vitesin
    // satırı CR yazar; CR ya da WR seçiliyken seçili
    const cr = sayfa(5).bolge[0];
    expect(VS.veMntVeriSayfasi(BL.veMntBelgeDurum(A, uye({ dizi: '7' }), cr).anahtar).secenek.dizi).toBe('cr');
    expect(['cr', 'wr', '7'].map((d) => BL.veMntBelgeDurum(A, uye({ dizi: d }), cr).secili)).toEqual([true, true, false]);
    // seçili satır: kaldırma yok, kilitli de değil (radyo)
    [[uye({ dizi: 'wr' }), cr], [uye({ dizi: '7' }), p5('kutle.temel.7')], [uye({ ret: '1', sog: 'r' }), p5('kutle.sog.r')],
     [uye({ ret: '1' }), sayfa(5).bolge.find((b) => b.s && b.s.ret === '1' && b.s.sog === 'u')],
     [uye({ dizi: 'wr' }), sayfa(9).bolge[1]], [varsayilan(), sayfa(8).bolge[0]], [varsayilan(), sayfa(10).bolge[1]],
     [uye({ bag: 'u', ret: '1', pto: '1', sog: 'r' }), sayfa(6).bolge.find((b) => b.alan === 'cg.6.u.11.r')]].forEach(([vs, b]) => {
      const d = BL.veMntBelgeDurum(A, vs, b);
      expect([b.alan || JSON.stringify(b.s), d.secili, d.radyo, d.kaldir]).toEqual([b.alan || JSON.stringify(b.s), true, true, null]);
    });
    // tablonun satırı: kardeşi seçilir
    const v = uye({ bag: 'u', ret: '1', pto: '1', sog: 'r' }), kardes = sayfa(6).bolge.find((b) => b.alan === 'cg.6.u.11.u');
    expect(VS.veMntVeriSayfasi(BL.veMntBelgeDurum(A, v, kardes).anahtar).secenek).toMatchObject({ bag: 'u', ret: '1', pto: '1', sog: 'u' });
    // zorunlu grubun üst satırı (belgedeki sırası): retarderli iki soğutucu → Retarder Option
    const s5 = sayfa(5).bolge, ust = s5.findIndex((b) => b.alan === 'kutle.ret');
    expect(s5.filter((b) => b.ust !== undefined).map((b) => [b.grup, b.ust])).toEqual([['sog-ret', ust], ['sog-ret', ust]]);
    expect(B.sayfalar.reduce((t, s) => t + s.bolge.filter((b) => b.ust !== undefined).length, 0)).toBe(2);
    // retarderin kendisi onay kutusu: kaldırınca grubun ikisi de düşer
    const P = VS.veMntVeriSayfasi(BL.veMntBelgeDurum(A, uye({ ret: '1', sog: 'r' }), s5[ust]).kaldir);
    expect(s5.filter((b) => b.grup === 'sog-ret').map((b) => BL.veMntBelgeDurum(A, P, b).secili)).toEqual([false, false]);
  });
  // ÖN İZLEME (Canlı Not 73 — "Diğer maddelerde de var böyle şeyler"): tık birden çok satırı birlikte
  // değiştiriyordu ve yalnız tıklanan satır görünüyordu
  test('ÖN İZLEME: tıkın seçime katacağı ve düşüreceği öteki satırlar', () => {
    const id = (no, f) => { const si = B.sayfalar.findIndex((s) => s.no === no); return si + '-' + B.sayfalar[si].bolge.findIndex(f); };
    const al = (alan) => (b) => b.alan === alan;
    const oz = (vs, no, f) => { const [si, bi] = id(no, f).split('-').map(Number); return BL.veMntBelgeOnizleme(A, vs, B, si, bi); };
    // varsayılandan akümülatör: retarder, uzak soğutucusu (17.3 · yağ satırı), solenoid ve yağı; tablolarda
    // retarderli satır girer, retarderli olmayan çıkar
    const r = oz(varsayilan(), 5, al('kutle.aku'));
    [id(5, al('kutle.ret')), id(5, (b) => b.s && b.s.ret === '1' && b.s.sog === 'u'), id(5, al('kutle.akuSol')),
     id(10, al('yag.aku')), id(21, () => true), id(6, al('cg.6.d.10.u')), id(8, al('atalet.6.10.u'))]
      .forEach((x) => expect(r.ekle).toContain(x));
    [id(6, al('cg.6.d.00.u')), id(8, al('atalet.6.00'))].forEach((x) => expect(r.cikar).toContain(x));
    expect(r.ekle).not.toContain(id(5, al('kutle.aku')));                                       // kendisi yok
    // Remote-Mount Provision: arka braket birlikte
    expect(oz(varsayilan(), 5, al('kutle.uzak')).ekle).toContain(id(5, al('kutle.uzakArka6')));
    // seçili satırın tıkı bir şey değiştirmiyorsa ön izleme boş (radyo · kilitli · yalnız işaret)
    expect(oz(varsayilan(), 5, () => true)).toEqual({ ekle: [], cikar: [] });                   // CR/WR seçili
    expect(oz(varsayilan(), 41, () => true)).toEqual({ ekle: [], cikar: [] });                  // kilitli
    expect(oz(varsayilan(), 5, (b) => !b.s)).toEqual({ ekle: [], cikar: [] });                  // Output Flange
  });
  test('bölgenin adı yazdığı değerlerle, ailenin sırasıyla', () => {
    expect(BL.veMntBelgeEtiket(A, sayfa(5).bolge.find((b) => b.alan === 'kutle.sog.r'))).toBe('Retarder: Var · Soğutucu: Direct · retarder/sump');
    expect(BL.veMntBelgeEtiket(A, sayfa(9).bolge[2])).toBe('Vites konfigürasyonu: 7-Speed');
    expect(BL.veMntBelgeEtiket(A, sayfa(5).bolge[0])).toBe('Vites konfigürasyonu: Close Ratio (CR) / Wide Ratio (WR)');   // koşulun değerleri
    expect(BL.veMntBelgeEtiket(A, sayfa(5).bolge[12])).toBe('');
  });
});

describe('GÖRÜNÜM — belgenin HTML\'i, Özellikler\'in Belge satırı', () => {
  test('12 sayfa, 85 bölge (tıklanan düğme, tıksız işaret); konum sayfanın yüzdesi', () => {
    const el = kur(MB.veMntWiz3bBelgeHTML(B));
    expect(el.querySelectorAll('.ve-mw-3b-belge-s')).toHaveLength(12);
    const tik = B.sayfalar.reduce((t, s) => t + s.bolge.filter((b) => b.s).length, 0);
    expect(el.querySelectorAll('button[data-belge-b]')).toHaveLength(tik);
    expect(el.querySelectorAll('[data-belge-y]')).toHaveLength(85 - tik);
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

  // BÖLÜMLER YOK (Canlı Not 75, 2026-11-09): "Bu kısımlara gerek yok. Kullanıcıya sunmayalım.
  // Kaldıralım." Önce: solda 12 satırlık bölüm dizini (208 px); şimdi sayfalar kaydırılır.
  test('BÖLÜMLER YOK: belgede bölüm dizini ve dizinin düğmeleri yok; CSS kuralı da yok', () => {
    const el = kur(MB.veMntWiz3bBelgeHTML(B));
    expect(el.querySelector('.ve-mw-3b-belge-dizin, [data-belge-git], nav')).toBe(null);
    expect(el.querySelector('.ve-mw-3b-belge-govde > .ve-mw-3b-belge-kay')).not.toBe(null);
    const css = fs.readFileSync(path.join(__dirname, '../../css/styles.css'), 'utf8');
    expect(css).not.toMatch(/\.ve-mw-3b-belge-dizin|\.ve-mw-3b-belge-d\b/);
  });

  // Canlı Not 56: "Maddelerin yanında tik atabileceğimiz kutucuk olsun." Önce: her bölge kesikli
  // çerçeveydi, seçim dolu çerçeve; kutu yoktu.
  test('ONAY KUTUSU: her tıklanan bölgede bir kutu — satırda solunda, çizimde üst hizada, sütunda başlığın altında', () => {
    const el = kur(MB.veMntWiz3bBelgeHTML(B));
    const btn = [...el.querySelectorAll('button[data-belge-b]')];
    const kutu = btn.filter((b) => !b.hasAttribute('data-belge-grup')), radyo = btn.filter((b) => b.hasAttribute('data-belge-grup'));
    expect(kutu.every((b) => b.querySelectorAll(':scope > .ve-mw-3b-belge-t .mf-ico-check').length === 1)).toBe(true);
    // birbirini dışlayan satır (Canlı Not 73 · 74): yuvarlak işaret, onay simgesi yok
    expect([kutu.length, radyo.length]).toEqual([19, 51]);
    expect(radyo.every((b) => b.querySelectorAll(':scope > .ve-mw-3b-belge-t.ve-mw-3b-belge-t--radyo > i').length === 1
      && !b.querySelector('.mf-ico-check'))).toBe(true);
    expect(el.querySelectorAll('[data-belge-y] .ve-mw-3b-belge-t')).toHaveLength(0);              // tıksız satırda kutu yok
    // sütun: tanımın yeri, kutunun yüzdesi (başlığın altı ile ilk değerin arası)
    sayfa(9).bolge.forEach((b, i) => {
      const t = el.querySelector('[data-belge-b="4-' + i + '"] .ve-mw-3b-belge-t');
      expect(el.querySelector('[data-belge-b="4-' + i + '"]').classList.contains('ve-mw-3b-belge-b--ic')).toBe(true);
      expect(parseFloat(t.style.left)).toBeCloseTo((b.t[0] - b.k[0]) / b.k[2] * 100, 2);
      expect(parseFloat(t.style.top)).toBeCloseTo((b.t[1] - b.k[1]) / b.k[3] * 100, 2);
      expect(b.t[1]).toBeGreaterThan(b.k[1]); expect(b.t[1]).toBeLessThan(b.k[1] + 60);          // başlığın altında
    });
    // çizim (17.x) üst hizada; satırlar ortada
    expect(el.querySelector('[data-belge-sayfa="21"] [data-belge-b]').classList.contains('ve-mw-3b-belge-b--alan')).toBe(true);
    expect(el.querySelector('[data-belge-sayfa="5"] [data-belge-b]').className).toBe('ve-mw-3b-belge-b');
    const css = fs.readFileSync(path.join(KOK, 'css/styles.css'), 'utf8');
    const kural = (sec) => { const i = css.indexOf('\n' + sec + '{'); return i < 0 ? '' : css.slice(i + 1, css.indexOf('}', i)).replace(/\s+/g, ' '); };
    expect(kural('.ve-mw-3b-belge-b')).toMatch(/border:0;/);                                     // kesikli çerçeve yok
    expect(kural('.ve-mw-3b-belge-t')).toMatch(/position:absolute; right:100%; top:50%; width:14px; height:14px; margin:-7px 6px 0 0/);
    expect(kural('.ve-mw-3b-belge-b[aria-pressed="true"] > .ve-mw-3b-belge-t')).toMatch(/background:var\(--accent-primary\); color:var\(--on-accent\)/);
    expect(css).not.toMatch(/\.ve-mw-3b-belge-b[^{]*\{[^}]*dashed/);
  });

  // Canlı Not 73: zorunlu grubun çizgisi üst satırın işaretinden grubun son satırına; her satıra kol
  test('ZORUNLU SEÇİM: Retarder Option\'dan retarderli iki soğutucuya çizgi; her satıra kol; yalnız orada', () => {
    const el = kur(MB.veMntWiz3bBelgeHTML(B));
    const g = [...el.querySelectorAll('.ve-mw-3b-belge-grup')];
    const s5 = sayfa(5).bolge, ust = s5.findIndex((b) => b.alan === 'kutle.ret');
    expect(g.map((x) => [x.getAttribute('data-belge-grup-ust'), x.getAttribute('aria-hidden')])).toEqual([['0-' + ust, 'true']]);
    expect(g[0].parentNode.getAttribute('data-belge-sayfa')).toBe('5');
    const orta = (b) => b.k[1] + b.k[3] / 2, uye = s5.filter((b) => b.grup === 'sog-ret');
    const y0 = orta(s5[ust]), y1 = orta(uye[1]);
    expect(parseFloat(g[0].style.top)).toBeCloseTo(y0 / 792 * 100, 2);
    expect(parseFloat(g[0].style.height)).toBeCloseTo((y1 - y0) / 792 * 100, 2);
    expect(parseFloat(g[0].style.left)).toBeCloseTo(s5[ust].k[0] / 612 * 100, 2);
    expect([...g[0].querySelectorAll('i')].map((i) => Math.round(parseFloat(i.style.top)))).toEqual([0, Math.round((orta(uye[0]) - y0) / (y1 - y0) * 100), 100]);
    const css = fs.readFileSync(path.join(KOK, 'css/styles.css'), 'utf8');
    expect(css).toMatch(/\.ve-mw-3b-belge-grup\.etkin\{ color:var\(--accent-primary\); \}/);
    expect(css).toMatch(/\.ve-mw-3b-belge-t--radyo\{ border-radius:50%; \}/);
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
