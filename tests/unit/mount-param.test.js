/**
 * mount-param.test.js — Parametrik Analiz · Katalogdan seçim, gerçek modellerle
 * ─────────────────────────────────────────────────────────────────────────
 * Kapılar (js/cp-mount-param.js · js/cp-mount-param-rapor.js):
 *   TEK YOL   — taramanın seçtiği kombinasyon modele uygulanıp Çözücü'yle
 *               çözülünce frekanslar, statik sehimler, T ve işletme sehimleri
 *               taramanın ölçtüğünün AYNISI (ayrı bir "tarama için" çözüm yok)
 *   AYNI HÜKÜM — Kriter 1 · 1a · 1b · 2 için taramanın hükmü raporun uygunluk
 *               tablosunun (veMntUygunluk) hükmüyle aynı, örneklenen her kombinasyonda
 *   PENCERE   — girdiler, durumlar (eksik · sınır); taramadan önce sonuç yok
 *   RAPOR     — ayrı belge: bölümler, Türkçe sayı, sayısız alan yok
 *   KOŞUCU    — dilim dilim koşar (≤ 10 ms; kullanıcı 2026-10-18: "program
 *               kasıyor"), ilerleme eylem satırında, durdurulur, bitince
 *               Sonuç kategorisi kurulur
 *   SONUÇ     — kullanıcı kararı 2026-10-18 (Takoz pencerelerinin "sonuç
 *               göstermez" kuralının bu pencereye özgü istisnası): öneri,
 *               kriterler, iki sade grafik, yakın seçenekler, eleme; kısıtlar
 *               ADIYLA; tablonun hükmü huninin hükmü; on diyagram yalnız tam
 *               ekranın galerisinde; sınır değişince tarama YİNELENMEDEN yeni
 *               sınırla taramanın aynısı; model/aday/sabit/tolerans/sürünme
 *               değişince ESKİR; görünüm seçimi modelde değil; rapor bugünkü sınırlarla
 */
const H = require('../helpers/takoz-dogrulama.js');

const { cp, rp } = H.kur();
Object.keys(cp).forEach((k) => { if (global[k] === undefined) global[k] = cp[k]; });
Object.keys(rp).forEach((k) => { if (global[k] === undefined) global[k] = rp[k]; });
global.veMntKatalog = require('../../js/mount-katalog.js');
const P = require('../../js/cp-mount-param.js');
const RP = require('../../js/cp-mount-param-rapor.js');
Object.keys(P).forEach((k) => { if (global[k] === undefined) global[k] = P[k]; });
global.veMntParamRaporHTML = RP.veMntParamRaporHTML;
global.veSayi = global.veSayi || require('../../js/sayi.js').veSayi;
global.veMntAkso = global.veMntAkso || require('../../js/mount-akso.js');
global.veMntParamCiz = require('../../js/mount-param-ciz.js');
const PS = require('../../js/cp-mount-param-sonuc.js');
Object.keys(PS).forEach((k) => { if (global[k] === undefined) global[k] = PS[k]; });
global.veIkon = global.veIkon || require('../../js/ikon.js').veIkon;
global.veDurumIkon = global.veDurumIkon || require('../../js/ikon.js').veDurumIkon;
require('../../js/mount-report-template.js');
require('../../js/mount-report-assets.js');

const K = global.veMntKatalog;
function modelKur(ad) {
  const t = H.ornek(ad);
  global.nodes = JSON.parse(JSON.stringify(t.nodes));
  global.connections = t.connections || [];
  return t;
}
function tara(node, enIyi) {
  const Hz = P._mntParamHazirlik(node);
  const O = P._mntParamOlcucu(Hz.M, K.baglam(Hz.ctx));
  const it = K.tarayici({ G: Hz.M.G, adaylar: Hz.aday, sabit: Hz.sabit, ctx: Hz.ctx, olc1: O.olc1, olc2: O.olc2, enIyi: enIyi || 10 });
  it.adim(Infinity);
  return { Hz, O, S: it.sonuc() };
}
// Kombinasyonu topolojinin KENDİ düğümlerine yazar (Takoz penceresinin yazıcısı) ve Çözücü'yle çözer.
function uygulaCoz(topo, Hz, tipler) {
  const t = JSON.parse(JSON.stringify(topo));
  global.nodes = t.nodes;
  Hz.M.G.forEach((g, gi) => {
    if (!tipler[gi]) return;
    g.idler.forEach((id) => { cp._mntLibUygula(t.nodes.find((n) => n.id === id).data, tipler[gi]); });
  });
  return H.coz(t);
}
const bagil = (a, b) => Math.abs(a - b) / Math.max(1e-12, Math.abs(b));

describe('TEK YOL — taramanın ölçtüğü, Çözücü\'nün bulduğu', () => {
  const topo = modelKur('kamyon');
  const { Hz, O, S } = tara({ id: 'pa', type: 'mnt-parametric', data: {} });

  test('kamyon: 2 grup × 27 tip = 729 kombinasyon taranıyor', () => {
    expect(Hz.M.G.map((g) => g.ad)).toEqual(['Sağ/Sol Ön Takoz', 'Sağ/Sol Arka Takoz']);
    expect(S.N).toBe(729);
    expect(S.hata).toBe(0);
  });

  test('sıranın ilk üç kombinasyonu ve nonlineer bir kombinasyon: frekans, statik sehim, T ve işletme sehimi Çözücü\'yle birebir', () => {
    const ISL = (rc) => rc.res && K.isletmeMi(rc.loadCase);
    const O0 = P._mntParamOlcucu(Hz.M, K.baglam(Object.assign({}, Hz.ctx, { s: { surunme: 0 } })));   // sürünmesiz: ham sehim
    const nl = Hz.M.G.map((g, i) => (i ? 'TK035' : 'TK040'));                 // analitik fitli (nonlineer) tipler
    expect(Hz.M.lib.TK040.fitZ && Hz.M.lib.TK035.fitZ).toBeTruthy();
    S.sira.slice(0, 3).concat([{ tipler: nl }]).forEach((r) => {
      const o1 = O0.olc1(r.tipler), o2 = O0.olc2(r.tipler);
      const R = uygulaCoz(topo, Hz, r.tipler);
      expect(R && !R.error).toBe(true);
      R.modes.forEach((m, i) => expect(bagil(o1.f[i], m.f_Hz)).toBeLessThan(1e-9));
      const st = R.allCases.find((c) => c.name === 'Static');
      st.res.perMount.forEach((pm, i) => expect(Math.abs(o1.dz[i] - pm.delta[2] * 1000)).toBeLessThan(1e-9));
      expect(bagil(o1.T, rp._mntRepIsolation(R, rp.veMntRaporOpts()).T)).toBeLessThan(1e-12);
      const dIsl = R.mounts.map(() => 0);
      R.allCases.concat(R.gearCases, R.designCases).filter(ISL).forEach((rc) => rc.res.perMount.forEach((pm, i) => {
        dIsl[i] = Math.max(dIsl[i], ...pm.delta.map((d) => Math.abs(d) * 1000));
      }));
      dIsl.forEach((d, i) => expect(Math.abs(o2.dIsl[i] - d)).toBeLessThan(1e-9));
    });
  });

  test('AYNI HÜKÜM: Kriter 1 · 1a · 1b · 2 taramada ve raporun uygunluk tablosunda aynı (37 kombinasyon)', () => {
    const NO = { k1: '1', k1a: '1a', k1b: '1b', k2: '2' };
    const c = K.baglam(Hz.ctx), A = Hz.aday;
    const say = { gecen: 0, kalan: 0 };
    for (let i = 0; i < 729; i += 20) {
      const tipler = [A[Math.floor(i / 27)].key, A[i % 27].key];
      const tarama = K.degerlendir(O.olc1(tipler), c, 1).sonuc;
      const R = uygulaCoz(topo, Hz, tipler);
      const U = rp.veMntUygunluk(R, rp.veMntRaporOpts());
      Object.keys(NO).forEach((k) => {
        const satir = U.satirlar.find((s) => s.no === NO[k]);
        expect([k, i, tarama[k].ok]).toEqual([k, i, satir.st === 'ok']);
        say[tarama[k].ok ? 'gecen' : 'kalan']++;
      });
    }
    expect(say.gecen).toBeGreaterThan(20);                 // kapı iki yönü de görüyor
    expect(say.kalan).toBeGreaterThan(20);
  });

  // HAZIRLIK PAYLAŞILIR (2026-10-18): tam tarama bir kombinasyonun iki
  // aşamasını ardışık ölçer; ikinci aşama birincinin hazırlığını ve statik
  // çözümünü kullanır (Çözücü de tek hazırlıkla çözer). Sonuç paylaşımsız
  // ölçümle BİT BİT aynı — hazırlık başka bir çözüm üretmez.
  test('HAZIRLIK PAYLAŞILIR: iki aşama tek hazırlıkla (toleransla ölçek başına bir); sonuç paylaşımsız ölçümün aynısı', () => {
    const A = Hz.aday;
    const nl = Hz.M.G.map((g, i) => (i ? 'TK035' : 'TK040'));                 // nonlineer (Newton) yol da
    [[A[3].key, A[11].key], nl].forEach((tipler) => {
      [false, true].forEach((tol) => {
        const ctx = K.baglam(Object.assign({}, Hz.ctx, { acik: Object.assign({}, Hz.ctx.acik, { tolerans: tol }) }));
        const say = jest.spyOn(global, '_mntPrepareFrom');
        const Op = P._mntParamOlcucu(Hz.M, ctx);
        const o1 = Op.olc1(tipler), o2 = Op.olc2(tipler);
        expect([tipler.join(), tol, say.mock.calls.length]).toEqual([tipler.join(), tol, tol ? 3 : 1]);
        say.mockRestore();
        expect(o1 && o2).toBeTruthy();
        const r1 = P._mntParamOlcucu(Hz.M, ctx).olc1(tipler), r2 = P._mntParamOlcucu(Hz.M, ctx).olc2(tipler);
        expect(JSON.stringify(o1)).toBe(JSON.stringify(r1));
        expect(JSON.stringify(o2)).toBe(JSON.stringify(r2));
      });
    });
  });
});

describe('SÜRÜNME · TOLERANS · DARBE — literatür kısıtlarının ölçümü Çözücü\'nün sayısından', () => {
  test('sürünme: E7 sehimi = max(|δx|, |δy|, |δz + c·δz,s|), c = %30 varsayılan; E6 sürünmesiz', () => {
    const topo = modelKur('kutu');                         // düşey sehim yataydan büyük: sürünme yolu gerçekten sınanır
    const Hz = P._mntParamHazirlik({ id: 'pa', type: 'mnt-parametric', data: {} });
    const c = K.baglam(Hz.ctx);
    expect(c.s.surunme).toBe(0.3);
    const o2 = P._mntParamOlcucu(Hz.M, c).olc2(Hz.M.G.map(() => null));
    const R = uygulaCoz(topo, Hz, Hz.M.G.map(() => null));
    const st = R.allCases.find((x) => x.name === 'Static').res.perMount.map((pm) => pm.delta[2]);
    const d = R.mounts.map(() => 0);
    R.allCases.concat(R.gearCases, R.designCases).filter((rc) => rc.res && K.isletmeMi(rc.loadCase)).forEach((rc) =>
      rc.res.perMount.forEach((pm, i) => { d[i] = Math.max(d[i], Math.abs(pm.delta[0]) * 1000, Math.abs(pm.delta[1]) * 1000, Math.abs(pm.delta[2] + 0.3 * st[i]) * 1000); }));
    d.forEach((v, i) => expect(Math.abs(o2.dSur[i] - v)).toBeLessThan(1e-9));
    expect(o2.dSur.some((v, i) => v > o2.dIsl[i] + 1e-6)).toBe(true);   // sürünme gerçekten kaydırıyor
  });

  test('tolerans: doğrusal modelde köşeler kapalı formda — f·√(1 ± t), δ/(1 ± t); T sertte büyür', () => {
    modelKur('kutu');                                      // bütün takozları doğrusal
    const Hz = P._mntParamHazirlik({ id: 'pa', type: 'mnt-parametric', data: { acik: { tolerans: true } } });
    const c = K.baglam(Hz.ctx);
    expect(c.acik.tolerans).toBe(true);
    const o = P._mntParamOlcucu(Hz.M, c).olc1(Hz.M.G.map(() => null));
    o.f.forEach((f, i) => {
      expect(bagil(o.sert.f[i], f * Math.sqrt(1.15))).toBeLessThan(1e-9);
      expect(bagil(o.yumusak.f[i], f * Math.sqrt(0.85))).toBeLessThan(1e-9);
    });
    o.dz.forEach((d, i) => expect(bagil(o.yumusak.dz[i], d / 0.85)).toBeLessThan(1e-9));
    expect(o.sert.T).toBeGreaterThan(o.T);
    const yok = P._mntParamOlcucu(Hz.M, K.baglam({ fAtes: Hz.M.fAtes })).olc1(Hz.M.G.map(() => null));
    expect(yok.sert).toBeUndefined();
  });

  // Bütün yasaları s katına çekmek bütün kütle ve ataletleri 1/s katına çekmekle
  // AYNI denklemi verir (s·g(δ) = m·g·n ⇔ g(δ) = (m/s)·g·n; s·K_t·φ = λ·M·φ ⇔
  // K_t·φ = λ·(M/s)·φ) — hakem ölçekleyiciyi kullanmaz, kütleleri değiştirir ve
  // Çözücü'yle çözer. Nonlineer (poly + asym fitli) modelde geçer.
  test('tolerans köşesi = kütleleri 1/s ölçeklenmiş modelin Çözücü çözümü (nonlineer, bağımsız hakem)', () => {
    const topo = modelKur('kamyon');
    const Hz = P._mntParamHazirlik({ id: 'pa', type: 'mnt-parametric', data: { acik: { tolerans: true } } });
    const bos = Hz.M.G.map(() => null);
    const O = P._mntParamOlcucu(Hz.M, K.baglam(Object.assign({}, Hz.ctx, { s: { surunme: 0 } })));
    const o1 = O.olc1(bos), o2 = O.olc2(bos);
    expect(Hz.M.gather.mounts.some((m) => m.fitZ)).toBe(true);
    [[1.15, o1.sert, null], [0.85, o1.yumusak, o2.yumusak]].forEach(([s, k1, k2]) => {
      const t = JSON.parse(JSON.stringify(topo));
      t.nodes.forEach((n) => {
        if (!(componentDefs[n.type] || {}).isMountBody || !n.data) return;
        ['mass', 'Ixx', 'Iyy', 'Izz', 'Ixy', 'Ixz', 'Iyz'].forEach((a) => { if (n.data[a] != null && n.data[a] !== '') n.data[a] = Number(n.data[a]) / s; });
      });
      const R = H.coz(t);
      R.modes.forEach((m, i) => expect(bagil(k1.f[i], m.f_Hz)).toBeLessThan(1e-7));
      R.allCases.find((c) => c.name === 'Static').res.perMount.forEach((pm, i) => expect(Math.abs(k1.dz[i] - pm.delta[2] * 1000)).toBeLessThan(1e-7));
      expect(bagil(k1.T, rp._mntRepIsolation(R, rp.veMntRaporOpts()).T)).toBeLessThan(1e-7);
      if (k2) {
        const d = R.mounts.map(() => 0);
        R.allCases.concat(R.gearCases, R.designCases).filter((rc) => rc.res && K.isletmeMi(rc.loadCase)).forEach((rc) =>
          rc.res.perMount.forEach((pm, i) => { d[i] = Math.max(d[i], ...pm.delta.map((x) => Math.abs(x) * 1000)); }));
        d.forEach((v, i) => expect(Math.abs(k2.dIsl[i] - v)).toBeLessThan(1e-7));
      }
    });
  });

  test('kapasite ve darbe yükü: kapasitesi tanımlı özel tip — oranlar Çözücü\'nün kuvvetinden', () => {
    const topo = modelKur('kamyon');
    const kut = { id: 'kut', type: 'mnt-library', data: { mounts: [{ key: 'ozel-k', name: 'Özel kapasiteli', sx: 120, sy: 90, sz: 300,
      dx: 180, dy: 135, dz: 450, maxLoad: 250 }] } };
    topo.nodes.push(kut);
    global.nodes.push(JSON.parse(JSON.stringify(kut)));
    const Hz = P._mntParamHazirlik({ id: 'pa', type: 'mnt-parametric', data: {} });
    const tipler = Hz.M.G.map(() => 'ozel-k');
    const O = P._mntParamOlcucu(Hz.M, K.baglam(Hz.ctx));
    const o1 = O.olc1(tipler), o2 = O.olc2(tipler);
    const R = uygulaCoz(topo, Hz, tipler);
    const g = 9.81;
    const pay = R.allCases.find((x) => x.name === 'Static').res.perMount.map((pm) => Math.abs(pm.f[2]) / g);
    expect(o1.kap).toEqual(R.mounts.map(() => 250));
    pay.forEach((p, i) => expect(Math.abs(o1.pay[i] - p)).toBeLessThan(1e-9));
    let oran = 0;
    R.allCases.concat(R.gearCases, R.designCases).filter((rc) => rc.res && !K.isletmeMi(rc.loadCase)).forEach((rc) =>
      rc.res.perMount.forEach((pm) => { oran = Math.max(oran, Math.abs(pm.f[2]) / (250 * g)); }));
    expect(Math.abs(o2.darbeOran - oran)).toBeLessThan(1e-12);
    const k = K.hepsi(o1, o2, K.baglam(Hz.ctx)).sonuc;
    expect(k.kapasite.na).toBeUndefined();
    expect(k.kapasite.deger).toBeCloseTo(Math.max(...pay) / 250, 12);
    expect(k.darbe.deger).toBeCloseTo(oran, 12);
  });
});

describe('PENCERE — yalnız girdi', () => {
  const dom = (h) => { const d = document.createElement('div'); d.innerHTML = h; return d; };
  const node = () => { const n = { id: 'pa', type: 'mnt-parametric', data: {} }; global.nodes.push(n); return n; };

  test('üç kategori; sağ sütunda analiz adı, büyüklüğü, cevap ve tek eylem', () => {
    modelKur('kamyon');
    const d = dom(P.getMntParamPropertiesHTML(node()));
    expect([...d.querySelectorAll('.ve-fp-kat')].map((t) => t.getAttribute('aria-label'))).toEqual(['Gruplar', 'Adaylar', 'Kısıtlar']);
    expect(d.querySelector('.ve-fp-tab')).toBeNull();                       // tek gövde (2026-10-16)
    expect(d.querySelector('.ve-fp-side .ve-fp-sect b').textContent).toBe('Katalogdan seçim');
    expect([...d.querySelectorAll('.ve-fp-side input')].map((i) => i.value)).toEqual(['2', '27', '729']);
    expect(d.querySelector('.ve-fp-side .ve-fp-durum').textContent).toBe('Taramaya hazır');
    expect(d.querySelectorAll('.ve-fp-solve').length).toBe(1);
    expect(d.querySelector('[data-cozum-durumu]')).toBeNull();
  });

  test('ayarlar: sabit grup, dışarıda bırakılan tip, sınır ve açık/kapalı → kombinasyon ve bağlam', () => {
    modelKur('kamyon');
    const n = node();
    P.veMntParamSabit('pa', 1, true);
    expect(P._mntParamHazirlik(n).N).toBe(27);
    P.veMntParamSabit('pa', 1, false);
    expect(n.data.sabit).toBeUndefined();
    P.veMntParamAday('pa', 'TK035', false);
    P.veMntParamAday('pa', 'TK040', false);
    expect(P._mntParamHazirlik(n).N).toBe(625);
    P.veMntParamAdayHepsi('pa', true);
    expect(n.data.haric).toBeUndefined();
    P.veMntParamAdayHepsi('pa', false);
    expect(P._mntParamHazirlik(n).eksik).toBe('Aday tip yok');
    P.veMntParamAdayHepsi('pa', true);
    P.veMntParamSinir('pa', 'sehimUst', '6,5');
    P.veMntParamSinir('pa', 'kapasite', '90');
    P.veMntParamSinir('pa', 'agirlik', '0');
    const c = K.baglam(P._mntParamHazirlik(n).ctx);
    expect([c.s.sehimUst, c.s.kapasite, c.s.agirlik]).toEqual([6.5, 0.9, 0]);
    P.veMntParamSinir('pa', 'sehimUst', '-2');
    P.veMntParamSinir('pa', 'agirlik', '1,5');
    expect(n.data.sinir).toEqual({ kapasite: 90 });
    P.veMntParamSinir('pa', 'tolerans', '20');
    expect(K.baglam(P._mntParamHazirlik(n).ctx).s.tolerans).toBe(0.2);
    P.veMntParamSinir('pa', 'tolerans', '60');                             // %60 > %50 sınırı
    expect(n.data.sinir.tolerans).toBeUndefined();
    P.veMntParamSinir('pa', 'surunme', '0');                               // sürünmesiz geçerli
    expect(K.baglam(P._mntParamHazirlik(n).ctx).s.surunme).toBe(0);
    P.veMntParamSinir('pa', 'surunme', '');
    P.veMntParamAcik('pa', 'ayrisma', true);
    P.veMntParamAcik('pa', 'sehim', false);
    expect(n.data.acik).toEqual({ ayrisma: true, sehim: false });
    P.veMntParamAcik('pa', 'ayrisma', false);
    P.veMntParamAcik('pa', 'sehim', true);
    expect(n.data.acik).toBeUndefined();
  });

  test('yerinde tazeleme: aday kalmayınca kombinasyon, cevap ve düğme pencere kurulmadan değişir', () => {
    modelKur('kamyon');
    const n = node();
    document.body.innerHTML = '<div class="ve-properties-content">' + P.getMntParamPropertiesHTML(n) + '</div>';
    const dugme = () => document.getElementById('ve-mnt-param-btn-pa');
    expect(dugme().disabled).toBe(false);
    const govde = document.querySelector('#ve-fp-panes-pa');                // pencere kurulmuyor: aynı öğe kalmalı
    n.data.haric = Object.keys(cp.veMntGetLibraryMap());
    expect(cp.veMntPencereTazele()).toBeGreaterThan(0);
    expect(dugme().disabled).toBe(true);
    expect(document.querySelector('#ve-mnt-param-durum-pa').textContent).toBe('Aday tip yok');
    expect([...document.querySelectorAll('#ve-mnt-param-ozet-pa input')].map((i) => i.value)).toEqual(['2', '0', '0']);
    expect(document.querySelector('#ve-fp-panes-pa')).toBe(govde);
    delete n.data.haric;
    cp.veMntPencereTazele();
    expect(dugme().disabled).toBe(false);
  });

  test('durumlar: takoz yok · f_ateş yok · bütün gruplar sabit · kombinasyon sınırı', () => {
    global.nodes = [];
    expect(P._mntParamHazirlik(node()).eksik).toBe('Takoz yok');
    modelKur('tulga');                                     // örnekte rölanti devri ve silindir sayısı yok
    expect(P._mntParamHazirlik(node()).eksik).toBe('Rölanti devri ve silindir sayısı yok');
    modelKur('kamyon');
    const n = node();
    P.veMntParamSabit('pa', 1, true); P.veMntParamSabit('pa', 2, true);
    expect(P._mntParamHazirlik(n).eksik).toBe('Taranacak grup yok');
    const dom1 = dom(P.getMntParamPropertiesHTML(n));
    expect(dom1.querySelector('.ve-fp-solve').disabled).toBe(true);
    // dört grup → 27⁴ = 531.441 > sınır
    modelKur('kamyon');
    const m = global.nodes.find((x) => x.type === 'mnt-mount');
    [[1, 'Sağ Orta'], [2, 'Sol Orta']].forEach(([k, ad]) => global.nodes.push(Object.assign(JSON.parse(JSON.stringify(m)),
      { id: 'ek' + k, customName: ad, data: Object.assign({}, m.data, { x: 300, y: k === 1 ? 350 : -350, z: 500 }) })));
    [[3, 'Sağ Kuyruk'], [4, 'Sol Kuyruk']].forEach(([k, ad]) => global.nodes.push(Object.assign(JSON.parse(JSON.stringify(m)),
      { id: 'ek' + k, customName: ad, data: Object.assign({}, m.data, { x: 1500, y: k === 3 ? 350 : -350, z: 500 }) })));
    const H4 = P._mntParamHazirlik(node());
    expect(H4.M.G.length).toBe(4);
    expect(H4.N).toBe(531441);
    expect(H4.eksik).toMatch(/^Kombinasyon sayısı 200\.000 üstünde$/);
  });
});

describe('RAPOR — ayrı belge', () => {
  test('bölümler, uzlaşı tablosu ve şekil; Türkçe sayı; NaN · undefined · {,} gövdede yok', () => {
    modelKur('asfat');
    const node = { id: 'pa', type: 'mnt-parametric', data: { sabit: {} } };
    // Hızlı: ön grup sabit (2 grup × 27 = 729).
    const Hz0 = P._mntParamHazirlik(node);
    node.data.sabit[Hz0.M.G[0].anahtar] = true;
    const { Hz, O, S } = tara(node, 5);
    const E = P._mntParamZenginlestir(S, Hz, O);
    const html = RP.veMntParamRaporHTML(E);
    const govde = html.slice(html.indexOf('<body>'), html.indexOf('<script>', html.indexOf('<body>')));
    ['Kapsam', 'Yöntem', 'Kısıtlar', 'Eleme', 'Sonuç', 'Sıralama', 'Varsayımlar ve sınırlar', 'Kaynaklar']
      .forEach((b) => expect(govde).toContain('</span>' + b + '</h2>'));
    expect(html).toContain('<title>Katalogdan takoz seçimi</title>');
    expect(govde).not.toMatch(/NaN|undefined|Infinity/);
    expect(govde).not.toContain('[0]');                                   // her dayanak listede
    expect(govde.replace(/\$\$[\s\S]*?\$\$/g, '')).not.toContain('{,}');
    expect(govde).not.toMatch(/\d\.\d{1,2}(?!\d)\s*(Hz|mm|kg)/);        // ondalık nokta yok
    if (S.uygunN) {
      expect(govde).toContain('Uzlaşı çözümü: grup başına tip');
      expect(govde).toContain('<figure><svg');
      const ilk = E.satir[0];
      Hz.M.G.forEach((g, gi) => { if (ilk.tipler[gi]) expect(govde).toContain(Hz.M.lib[ilk.tipler[gi]].name.replace(/&/g, '&amp;')); });
    } else {
      expect(govde).toContain('<span class="t">Uygun kombinasyon yok</span>');
    }
  });

  test('dayanaklar: anılan her anahtar listede, listedeki her kaynak anılıyor; bilinmeyen anahtar [0] değil hata', () => {
    const fs = require('fs');
    const kaynak = fs.readFileSync(require.resolve('../../js/cp-mount-param-rapor.js'), 'utf8');
    const liste = RP._MNT_PRM_KAYNAK.map((x) => x.k);
    const anilan = new Set();
    // Doğrudan atıflar: _mntPrmRef('a', 'b') — işlenmeyen dallar dâhil, kaynaktan.
    (kaynak.match(/_mntPrmRef\(([^)]*)\)/g) || []).forEach((c) =>
      (c.match(/'([^']+)'/g) || []).forEach((q) => anilan.add(q.slice(1, -1))));
    // Kısıt tablosunun dayanak sütunu.
    const ctx = K.baglam({ fAtes: 30, s: Object.assign({}, K.SINIR_VARSAYILAN), acik: {} });
    Object.values(RP._mntPrmKisitTanim(ctx)).forEach((d) => d[2].forEach((k) => anilan.add(k)));
    expect(anilan.size).toBeGreaterThan(5);
    anilan.forEach((k) => expect(liste).toContain(k));
    liste.forEach((k) => expect(anilan.has(k)).toBe(true));
    expect(RP._mntPrmRef('sirket', 'bmc')).toBe('[1] [' + liste.length + ']');
    expect(() => RP._mntPrmKaynakNo('yok')).toThrow(/Kaynak yok: yok/);
    expect(() => RP._mntPrmRef('shen', 'yok')).toThrow();
  });

  test('uygun kombinasyonu olmayan model: "Uygun kombinasyon yok" ve en az ihlalli sıra', () => {
    modelKur('hafif');
    const { Hz, O, S } = tara({ id: 'pa', type: 'mnt-parametric', data: {} }, 5);
    expect(S.uygunN).toBe(0);
    const html = RP.veMntParamRaporHTML(P._mntParamZenginlestir(S, Hz, O));
    expect(html).toContain('<span class="t">Uygun kombinasyon yok</span>');
    expect(html).toContain('En az ihlalli kombinasyonlar');
    expect(html).not.toContain('Uzlaşı çözümü: grup başına tip');
  });
});

describe('KOŞUCU', () => {
  beforeEach(() => { jest.useFakeTimers(); });
  // Yarıda kalan bir test taramayı açık bırakmasın (sonrakiler başlayamazdı).
  afterEach(() => { if (P.veMntParamDurdur()) jest.runAllTimers(); jest.restoreAllMocks(); jest.useRealTimers(); });
  const kurPencere = () => {
    modelKur('kamyon');
    const n = { id: 'pa', type: 'mnt-parametric', data: {} };
    global.nodes.push(n);
    const PK = require('../../js/pencere-kabuk.js');
    global.vePencereEylem = PK.vePencereEylem;
    global.vePencereIlerleme = PK.vePencereIlerleme;
    global.vePencereIlerlemeHTML = PK.vePencereIlerlemeHTML;
    document.body.innerHTML = '<div class="ve-properties-content">' + P.getMntParamPropertiesHTML(n) + '</div>';
    delete PS._MNT_PARAM_SONUC.pa;
    return n;
  };
  const cubuk = () => document.querySelector('.ve-fp-yurut[data-is] .ve-fp-ilerleme');

  test('dilim dilim koşar, ilerlemeyi eylem satırına yazar, bitince Sonuç kategorisi kurulur; tarama indirmez; ikinci tıklama durdurur', () => {
    const n = kurPencere();
    const indir = jest.fn();
    global._mntReportDownload = indir;
    global._mntReportEnsureAssets = (cb) => cb(true);
    P.veMntParamTara('pa');
    const btn = () => document.getElementById('ve-mnt-param-btn-pa');
    expect(btn().textContent).toMatch(/Durdur/);
    expect(btn().hasAttribute('data-durdur')).toBe(true);
    expect(cubuk().getAttribute('aria-valuenow')).toBe('0');
    jest.advanceTimersByTime(0);                    // ilk dilim (saat durgun: dilim kombinasyon tavanında biter)
    expect(cubuk().querySelector('span').textContent).toMatch(/^Kombinasyon [\d.]+ \/ 729$/);
    const p0 = +cubuk().getAttribute('aria-valuenow');
    expect(p0).toBeGreaterThan(0);
    expect(p0).toBeLessThan(100);
    // pencere tarama sürerken yeniden kurulsa da ilerleme ve Durdur yerinde
    document.querySelector('.ve-properties-content').innerHTML = P.getMntParamPropertiesHTML(n);
    expect(+cubuk().getAttribute('aria-valuenow')).toBe(p0);
    expect(btn().textContent).toMatch(/Durdur/);
    jest.runAllTimers();
    expect(indir).not.toHaveBeenCalled();
    const ent = PS._MNT_PARAM_SONUC.pa;
    expect(ent && ent.D.tam).toBe(true);
    expect(ent.D.N).toBe(729);
    expect(document.getElementById('ve-mnt-param-st-pa').textContent).toMatch(/^Tarandı \([\d.,]+ s\)$/);
    expect(btn().textContent.trim()).toBe('Tara');
    expect(btn().hasAttribute('data-durdur')).toBe(false);
    expect(document.querySelector('.ve-fp-ilerleme, .ve-fp-yurut[data-is]')).toBeNull();
    const d = document.createElement('div'); d.innerHTML = P.getMntParamPropertiesHTML(n);
    expect([...d.querySelectorAll('.ve-fp-kat')].map((t) => t.getAttribute('aria-label'))).toEqual(['Gruplar', 'Adaylar', 'Kısıtlar', 'Sonuç']);
    // rapor Sonuç'taki düğmeyle, bir kez
    PS.veMntParamRapor('pa');
    expect(indir).toHaveBeenCalledTimes(1);
    expect(indir.mock.calls[0][1]).toBe('takoz_katalogdan_secim.html');
    expect(document.getElementById('ve-mnt-param-st-pa').textContent).toMatch(/^İndirildi \([\d.]+ KB\)$/);
    // durdurma: yarıda kalan tarama saklanmaz, öncekinin yerine geçmez
    P.veMntParamTara('pa');
    jest.advanceTimersByTime(0);
    P.veMntParamTara('pa');
    jest.runAllTimers();
    expect(document.getElementById('ve-mnt-param-st-pa').textContent).toBe('Durduruldu');
    expect(cubuk()).toBeNull();
    expect(PS._MNT_PARAM_SONUC.pa).toBe(ent);
  });

  // DİLİM BÜTÇESİ (kullanıcı 2026-10-18: "program kasıyor"): eski parça 50 ms ve
  // 200 kombinasyona kadar koşuyordu. Saat her okumada 1 ms ilerler — dilim
  // bütçesini (10 ms) aşan hiçbir dilim yok, iş olay döngüsüne dönerek ilerler.
  test('dilim bütçesi: bir dilim ~10 ms (saat okuması başına 1 ms) — 729 kombinasyon ≥ 70 dilimde', () => {
    kurPencere();
    let t = 0;
    jest.spyOn(performance, 'now').mockImplementation(() => (t += 1));
    const T0 = global.veMntKatalog.tarayici;
    let n = 0;
    const sar = jest.spyOn(global.veMntKatalog, 'tarayici').mockImplementation((Pp) => {
      const it = T0(Pp), a = it.adim;
      it.adim = (k) => { n += (k === Infinity ? 1e9 : k); return a(k); };
      return it;
    });
    P.veMntParamTara('pa');
    const dilim = [];
    for (let g = 0; g < 2000 && document.getElementById('ve-mnt-param-btn-pa').hasAttribute('data-durdur'); g++) {
      n = 0; jest.advanceTimersToNextTimer();
      if (n) dilim.push(n);
    }
    jest.runAllTimers();
    expect(sar).toHaveBeenCalledTimes(1);
    expect(dilim.reduce((a, x) => a + x, 0)).toBe(729);
    expect(Math.max(...dilim)).toBeLessThanOrEqual(10);
    expect(dilim.length).toBeGreaterThanOrEqual(70);
    expect(PS._MNT_PARAM_SONUC.pa.D.N).toBe(729);
  });

  test('proje değişince süren tarama durur ve sonucu saklanmaz', () => {
    kurPencere();
    P.veMntParamTara('pa');
    jest.advanceTimersByTime(0);
    PS.veMntParamUnut();
    jest.runAllTimers();
    expect(PS._MNT_PARAM_SONUC.pa).toBeUndefined();
    expect(document.getElementById('ve-mnt-param-st-pa').textContent).toBe('Durduruldu');
  });
});

describe('SONUÇ — öneri, kriterler, iki grafik; diyagramlar galeride (kullanıcı kararları 2026-10-18)', () => {
  // ASFAT, altı aday: 3 grup × 6 tip = 216 kombinasyon (uzlaşı tipleri aday).
  const ADAY = ['57RS313773', 'amc137731', 'bmc-mount1-55sh', '57RS313773-sr116', '57RS313774-sr116', 'bmc-mount1-40sh'];
  const dom = (h) => { const d = document.createElement('div'); d.innerHTML = h; return d; };
  function kur() {
    modelKur('asfat');
    const n = { id: 'pa', type: 'mnt-parametric', data: { haric: Object.keys(cp.veMntGetLibraryMap()).filter((k) => ADAY.indexOf(k) < 0) } };
    global.nodes.push(n);
    return n;
  }
  function taraSakla(n, say) {
    const Hz = P._mntParamHazirlik(n);
    const O = P._mntParamOlcucu(Hz.M, K.baglam(Hz.ctx));
    const olc1 = say ? (t) => { say.n++; return O.olc1(t); } : O.olc1;
    const it = K.tarayici({ G: Hz.M.G, adaylar: Hz.aday, sabit: Hz.sabit, ctx: Hz.ctx, olc1, olc2: O.olc2, enIyi: 25, tam: true });
    it.adim(Infinity);
    PS._mntParamSonucKaydet(n.id, Hz, O, it.depo());
    return { Hz, S: it.sonuc() };
  }
  const basliklar = (d) => [...d.querySelectorAll('.ve-fp-kat[data-k="sonuc"] .ve-fp-sect > b')].map((b) => b.textContent);

  // ISITICI (2026-10-18): tarama bitince Sonuç ayrı dilimlerde belleğe alınır
  // (koşucu), pencere kurulumu yalnız birleştirir. Galerinin on diyagramı
  // pencerede HİÇ çizilmez — yalnız tam ekranda açılınca.
  test('ISITICI: üç adım (özet · önerinin ölçümü · bölüm); pencere kurulumu ne çizer ne ölçer; anahtar önce ve sonra aynı', () => {
    PS.veMntParamUnut();
    const n = kur(), { Hz } = taraSakla(n), ent = PS._MNT_PARAM_SONUC.pa;
    const once = PS._mntParamSonucBaglam(n, Hz, ent).anahtar;
    const L = PS._mntParamSonucIsitici(n, Hz, ent);
    expect(L.length).toBe(3);
    L.forEach((f) => f());
    expect(PS._mntParamSonucBaglam(n, Hz, ent).anahtar).toBe(once);
    const C = global.veMntParamCiz, asil = {}, say = [], olc1 = ent.O.olc1;
    let olcSay = 0;
    Object.keys(C).filter((k) => typeof C[k] === 'function').forEach((k) => {
      asil[k] = C[k];
      C[k] = function () { say.push(k); return asil[k].apply(this, arguments); };
    });
    ent.O.olc1 = function () { olcSay++; return olc1.apply(this, arguments); };
    try {
      const d = dom(P.getMntParamPropertiesHTML(n));
      expect(d.querySelectorAll('.ve-fp-kat[data-k="sonuc"] svg.ve-pd').length).toBe(2);
    } finally { Object.keys(asil).forEach((k) => { C[k] = asil[k]; }); ent.O.olc1 = olc1; }
    expect(say).toEqual([]);
    expect(olcSay).toBe(0);
  });

  // SADE (kullanıcı kararı 2026-10-18: "Tablo + iki sade grafik, diğer
  // diyagramlar kalsın fakat kullanıcı istediği zaman açabilsin"). Önce: on bir
  // bölüm, on çizim, kısıtlar KODLA (K1, E3 …) — girdideki Kısıtlar adlarla.
  test('SADE: yedi bölüm, iki grafik; on diyagram yalnız listede; kısıt kodu yok; öneri sıranın birincisi', () => {
    const n = kur(), { S } = taraSakla(n);
    expect(S.N).toBe(216);
    expect(S.uygunN).toBeGreaterThan(0);
    const d = dom(P.getMntParamPropertiesHTML(n));
    expect(basliklar(d)).toEqual(['Öneri', 'Kriterler', 'Modlar', 'Statik sehim ve iletilebilirlik', 'Yakın seçenekler', 'Eleme', 'Diyagramlar']);
    const kat = d.querySelector('.ve-fp-kat[data-k="sonuc"]');
    expect(kat.getAttribute('data-d')).toBe('ok');
    expect([...kat.querySelectorAll('.ve-pd-kap svg.ve-pd')].map((s) => s.parentElement.getAttribute('data-pd'))).toEqual(['mod', 'dag']);
    expect(kat.querySelector('[data-3b], .ve-pd-kesit, .ve-pd-tam')).toBeNull();
    expect([...kat.querySelectorAll('.ve-prm-dg')].map((b) => b.textContent)).toEqual(PS._MNT_PRM_DIYAGRAM.map((x) => x[1]));
    // kod yok — tipin adı (parça numarası) hariç Sonuç'un bütün yazısında; metin
    // düğümleri ayraçla (textContent hücreleri yapıştırır: "216K174")
    const yazi = kat.cloneNode(true);
    yazi.querySelectorAll('.ve-prm-og-t, .ve-prm-y ul').forEach((e) => e.remove());
    const tw = document.createTreeWalker(yazi, NodeFilter.SHOW_TEXT), parca = [];
    while (tw.nextNode()) parca.push(tw.currentNode.nodeValue);
    expect(parca.length).toBeGreaterThan(100);
    expect(parca.join(' ')).not.toMatch(/(^|[^\p{L}\p{N}])(K1[ab]?|K2|E[1-9])(?![\p{L}\p{N}])/u);
    // öneri: sıranın birincisinin tipleri; değişen grupta mevcut tip üstü çizili
    const ent = PS._MNT_PARAM_SONUC.pa, ilk = ent.D.tipler(S.sira[0].idx);
    const sat = [...kat.querySelectorAll('.ve-prm-og-s')];
    expect(sat.length).toBe(ent.M.G.length);
    let degisen = 0;
    sat.forEach((r, i) => {
      const g = ent.M.G[i], ad = ent.M.lib[ilk[i]].name;
      expect(r.querySelector('.ve-prm-og-g').textContent).toBe(g.ad);
      if (ilk[i] === g.tip) expect(r.querySelector('.ayni').textContent).toBe(ad);
      else { degisen++; expect(r.querySelector('b').textContent).toBe(ad); expect(r.querySelector('s').textContent).toBe(ent.M.lib[g.tip].name); }
    });
    expect(degisen).toBeGreaterThan(0);
    expect(d.querySelector('#ve-mnt-param-durum-pa').textContent).toBe('Uygun ' + S.uygunN + ' / 216');
    expect(kat.innerHTML).not.toMatch(/NaN|undefined|Infinity/);
  });

  // KRİTERLER = HÜKÜM: satırın işareti huninin ve sıranın kullandığı hüküm —
  // öneride DEPONUN ölçüsü, mevcutta taramanın ölçücüsüyle hepsi(); yazılan
  // sayı ölçünün kendisi (gösterilen ondalığın yarım adımı içinde). Statik
  // sehimin iki sınırı tek satır: ikisi de sağlanınca ✓.
  test('KRİTERLER: her satırın hükmü ve sayısı ölçünün kendisi — öneri depodan, mevcut hepsi() ile', () => {
    const oku = require('../../js/sayi.js').veSayiOku;
    const n = kur(), { Hz, S } = taraSakla(n), ent = PS._MNT_PARAM_SONUC.pa, c = K.baglam(Hz.ctx), idx = S.sira[0].idx, D = ent.D;
    const d = dom(P.getMntParamPropertiesHTML(n));
    const hm = K.hepsi(ent.mevcut.o1, ent.mevcut.o2, Hz.ctx).sonuc, ho = {};
    K.KISITLAR.forEach((Q) => { if (c.acik[Q.k]) ho[Q.k] = K.hukum(Q.k, D.X[Q.k][idx], c); });
    const isaret = (td) => (td.querySelector('.ve-durum-ok') ? true : td.querySelector('.ve-durum-err') ? false : null);
    const satir = [...d.querySelectorAll('table.ve-prm-kriter tbody tr')];
    expect(satir.map((r) => r.getAttribute('data-k'))).toEqual(
      K.KISITLAR.filter((Q) => c.acik[Q.k] && Q.k !== 'sehim').map((Q) => (Q.k === 'sehimAlt' ? 'sehim' : Q.k)));
    const nominal = { m: Math.max(...ent.mevcut.o1.dz.map(Math.abs)), o: D.d[idx] };
    let sayili = 0;
    satir.forEach((r) => {
      const k = r.getAttribute('data-k'), td = r.querySelectorAll('td');
      [['m', hm, td[2]], ['o', ho, td[3]]].forEach(([yan, h, hucre]) => {
        const bek = k === 'sehim' ? (h.sehimAlt.ok && h.sehim.ok) : (h[k].na ? null : h[k].ok);
        expect([k, yan, isaret(hucre)]).toEqual([k, yan, bek]);
        expect([k, yan, hucre.classList.contains('kr')]).toEqual([k, yan, bek === false]);
        // sayı: ölçü (sehimde bozulan sınırın ölçüsü, yoksa anma δs; yüzdeli kısıtta ×100)
        const m = hucre.textContent.match(/−?[\d.]+(,\d+)?/);
        if (!m || k === 'k1b') return;
        const bozuk = k === 'sehim' ? [h.sehimAlt, h.sehim].find((x) => !x.ok) : null;
        let v = k === 'sehim' ? (bozuk ? bozuk.deger : nominal[yan]) : h[k].deger;
        if (['k2', 'kapasite', 'ayrisma', 'darbe'].includes(k)) v *= 100;
        const ond = m[1] ? m[1].length - 1 : 0;
        expect([k, yan, Math.abs(oku(m[0]) - v) <= 0.5 * Math.pow(10, -ond) + 1e-9]).toEqual([k, yan, true]);
        sayili++;
      });
    });
    expect(sayili).toBeGreaterThanOrEqual(14);
    // öneri uygun: hiçbir satırda ihlal yok; başlık iki sütunun ihlal sayısı
    const nm = satir.filter((r) => r.querySelectorAll('td')[2].classList.contains('kr')).length;
    expect(nm).toBeGreaterThan(0);                                            // ASFAT'ın mevcut tasarımı Kriter 1'i bozuyor
    expect(satir.filter((r) => r.querySelectorAll('td')[3].classList.contains('kr')).length).toBe(0);
    const em = [...d.querySelectorAll('.ve-fp-sect')].find((s) => s.querySelector('b').textContent === 'Kriterler').querySelector('em');
    expect(em.textContent).toBe('Mevcut ' + nm + ' ihlal · Öneri 0 ihlal');
  });

  // SINIRDA YAZIM: yuvarlanınca sınıra eşit çıkan değer ondalığını uzatır —
  // "≤ 5 mm" satırında ihlal işaretinin yanında "5,0" yazmaz.
  test('SINIRDA YAZIM: değer sınırla aynı görünmez; tam eşitlik ve sayı olmayan değer', () => {
    expect(PS._mntPrmYaz(4.996, 5, 1)).toBe('4,996');
    expect(PS._mntPrmYaz(5.004, 5, 2)).toBe('5,004');
    expect(PS._mntPrmYaz(4.9, 5, 1)).toBe('4,9');
    expect(PS._mntPrmYaz(15, 15, 1)).toBe('15,0');
    expect(PS._mntPrmYaz(NaN, 5, 1)).toBe('—');
  });

  // MODLAR: kırmızı çentik = sınırı bozan mod. Hakem modların KENDİSİNDEN dört
  // kural: Kriter 1 (≥ 0,5·f_ateş), 1a (komşuya ≤ 0,5 Hz), 1b (8–10 Hz), en
  // düşük mod. Satırda kırmızı çentik varsa tablonun modal satırlarından biri ✗.
  test('MODLAR: kırmızı çentikler dört kuralın kendisi; tablonun modal satırlarıyla tutarlı; tolerans açıkken köşeler de', () => {
    const kontrol = (ent, c) => {
      const Z = PS._mntParamOzet(ent, c), V = PS._mntPrmModV(ent, Z, c), k1 = K.K1_ORAN * c.fAtes;
      expect(V.satir.map((r) => r.ad)).toEqual(['Mevcut', Z.S.uygunN ? 'Öneri' : 'En az ihlalli']);
      V.satir.forEach((r) => {
        const kos = [r.f].concat(r.kose ? [r.kose.a, r.kose.b] : []);
        const hakem = r.f.map((v, i) => kos.some((f) => f[i] >= k1 || (c.acik.altMod && f[i] < c.s.altMod) || (f[i] >= 8 && f[i] <= 10)
          || f.some((w, j) => j !== i && Math.abs(w - f[i]) <= K.K1A_HZ)));
        expect(r.kotu).toEqual(hakem);
      });
      const R = PS._mntPrmKriterler(ent, Z, c);
      const modal = (yan) => R.filter((x) => ['k1', 'k1a', 'k1b', 'altMod'].includes(x.k)).some((x) => x[yan].ok === false);
      expect(V.satir[0].kotu.some(Boolean)).toBe(modal('m'));
      expect(V.satir[1].kotu.some(Boolean)).toBe(modal('o'));
      return V;
    };
    const n = kur(), { Hz } = taraSakla(n);
    const V = kontrol(PS._MNT_PARAM_SONUC.pa, K.baglam(Hz.ctx));
    expect(V.satir[0].kotu.some(Boolean)).toBe(true);                       // mevcut: 19,2 Hz ≥ 15 Hz
    expect(V.satir[1].kotu.some(Boolean)).toBe(false);                      // öneri uygun
    expect(V.satir.every((r) => r.kose === null)).toBe(true);
    P.veMntParamAcik('pa', 'tolerans', true);
    const Ht = taraSakla(n).Hz;
    const Vt = kontrol(PS._MNT_PARAM_SONUC.pa, K.baglam(Ht.ctx));
    expect(Vt.satir.every((r) => r.kose && r.kose.a.length === r.f.length)).toBe(true);
    // yalnız köşesi bozan mod: anma 7,6 Hz bandın dışında, sert köşe 8,1 Hz içinde
    const c = K.baglam({ fAtes: 30 });
    const sentetik = { mevcut: { o1: { f: [5.5, 7.6, 12], sert: { f: [5.9, 8.1, 12.9] }, yumusak: { f: [5.1, 7.0, 11.1] } } }, olc: {} };
    const Vs = PS._mntPrmModV(sentetik, { S: { sira: [], uygunN: 0 } }, c);
    expect(Vs.satir[0].kotu).toEqual([false, true, false]);
  });

  // YAKIN SEÇENEKLER: sıranın 2.–6.'sı; uygun beşten azsa en az ihlalli uygun
  // olmayanlarla tamamlanır; bozulan kısıtlar ADIYLA (hükmün maskesi).
  // ELEME: huninin kendisi — eleyen adımlar, sonu uygun sayısı.
  test('YAKIN SEÇENEKLER ve ELEME: sıra + en az ihlalli, bozulan kısıtların adı; eleme huninin eleyen adımları, sonu uygun sayısı', () => {
    const oku = require('../../js/sayi.js').veSayiOku;
    const n = kur(), { Hz, S } = taraSakla(n), ent = PS._MNT_PARAM_SONUC.pa, Z = PS._mntParamOzet(ent, K.baglam(Hz.ctx));
    const L = PS._mntPrmYakinL(ent, Z);
    expect(L.length).toBe(5);
    const uygunL = S.sira.slice(1, 6).map((r) => r.idx);
    expect(L.slice(0, uygunL.length)).toEqual(uygunL);
    L.slice(uygunL.length).forEach((x) => expect(K.uygunMu(ent.D, Z.Hk, x)).toBe(false));
    const d = dom(P.getMntParamPropertiesHTML(n));
    const li = [...d.querySelectorAll('.ve-prm-yakin > li')];
    expect(li.length).toBe(5);
    li.forEach((x, k) => {
      const idx = L[k], boz = K.KISITLAR.filter((Q, b) => Z.Hk.m[idx] & (1 << b)).map((Q) => Q.ad);
      expect(x.querySelector('.ve-prm-no').textContent).toBe(String(k + 2));
      expect(x.querySelector('.ve-prm-y-boz, .ve-prm-y-ok').textContent)
        .toBe(boz.length ? boz.slice(0, 2).join(' · ') + (boz.length > 2 ? ' …' : '') : 'Uygun');
      expect(x.querySelectorAll('li').length).toBe(ent.M.G.length);
    });
    const ad = {}; K.KISITLAR.forEach((Q) => { ad[Q.k] = Q.ad; });
    const sat = [...d.querySelectorAll('table.ve-prm-eleme tbody tr')].map((r) => [r.children[0].textContent, oku(r.children[1].textContent)]);
    const bek = [['Taranan', S.N]];
    S.huni.forEach((x) => { if (x.kalan !== bek[bek.length - 1][1]) bek.push([x.k === 'cozulen' ? 'Çözülen' : ad[x.k], x.kalan]); });
    expect(sat).toEqual(bek);
    expect(sat[sat.length - 1][1]).toBe(S.uygunN);
  });

  test('UYGUN YOK: "En az ihlalli" — bölüm, sütun, grafikler ve galeri aynı adla; ihlalli satırlar kırmızı', () => {
    const n = kur(); taraSakla(n);
    P.veMntParamSinir('pa', 'sehimUst', '1');                              // hiçbir kombinasyon sağlamaz
    const d = dom(P.getMntParamPropertiesHTML(n));
    expect(basliklar(d)[0]).toBe('En az ihlalli');
    expect(d.querySelector('table.ve-prm-kriter thead th:last-child').textContent).toBe('En az ihlalli');
    expect(d.querySelector('.ve-pd-kap[data-pd="mod"]').textContent).toContain('En az ihlalli');
    expect(d.querySelector('.ve-pd-kap[data-pd="dag"]').textContent).toContain('En az ihlalli');
    expect(d.querySelectorAll('table.ve-prm-kriter td:last-child.kr').length).toBeGreaterThan(0);
    const ent = PS._MNT_PARAM_SONUC.pa, c = K.baglam(P._mntParamHazirlik(n).ctx);
    const v11 = PS._mntPrmV11(ent, PS._mntParamOzet(ent, c).S, PS._mntParamOzet(ent, c).Hk, c);
    expect(v11.uzlasi.ad).toBe('En az ihlalli');
  });

  test('CANLI: sınır, açıklık ve ağırlık değişince tarama yinelenmez; Sonuç o sınırlarla YENİ taramanın aynısı', () => {
    const n = kur(), say = { n: 0 };
    taraSakla(n, say);
    const once = say.n;
    expect(once).toBe(216);
    const ilk = dom(P.getMntParamPropertiesHTML(n));                       // bugünkü sınırlarla bir kez çizildi (bellekte)
    expect(ilk.querySelector('#ve-mnt-param-durum-pa').textContent).toMatch(/^Uygun \d+ \/ 216$/);
    P.veMntParamSinir('pa', 'sehimUst', '6');
    P.veMntParamAcik('pa', 'ayrisma', true);
    P.veMntParamSinir('pa', 'agirlik', '0,2');
    const d = dom(P.getMntParamPropertiesHTML(n));
    expect(say.n).toBe(once);                                              // tarama yinelenmedi
    const canli = PS._mntParamOzet(PS._MNT_PARAM_SONUC.pa, K.baglam(P._mntParamHazirlik(n).ctx)).S;
    const yeni = (() => { const Hz = P._mntParamHazirlik(n), O = P._mntParamOlcucu(Hz.M, K.baglam(Hz.ctx));
      const it = K.tarayici({ G: Hz.M.G, adaylar: Hz.aday, sabit: Hz.sabit, ctx: Hz.ctx, olc1: O.olc1, olc2: O.olc2, enIyi: 25, tam: true });
      it.adim(Infinity); return it.sonuc(); })();
    const sade = (S) => JSON.stringify(Object.assign({}, S, { sure: 0, olc: null, ctx: null }));
    expect(sade(canli)).toBe(sade(yeni));
    expect(yeni.red.ayrisma).toBeGreaterThanOrEqual(0);                     // açılan kısıt özette
    expect(d.querySelector('#ve-mnt-param-durum-pa').textContent).toBe('Uygun ' + yeni.uygunN + ' / 216');
    // sınır sıkılaşınca cevap da değişir (bellek sınırla anahtarlı)
    P.veMntParamSinir('pa', 'sehimUst', '1');
    const d2 = dom(P.getMntParamPropertiesHTML(n));
    expect(d2.querySelector('#ve-mnt-param-durum-pa').textContent).toBe('Uygun 0 / 216');
  });

  test('ESKİME: model · aday · sabit grup · tolerans · sürünme eskitir; sınır · açıklık · ağırlık · kapalı toleransın değeri · çözüm eskitmez', () => {
    const taze = (n) => PS._mntParamSonucDurum('pa', P._mntParamHazirlik(n)).taze;
    const dene = (fn, beklenen) => { const n = kur(); taraSakla(n); fn(n); return [beklenen, taze(n)]; };
    const sonuc = [
      dene(() => { global.nodes.find((x) => x.type === 'mnt-mount').data.x += 5; }, false),
      dene(() => { global.nodes.find((x) => x.type === 'mnt-motor').data.mass += 1; }, false),
      dene((n) => { P.veMntParamAday('pa', ADAY[5], false); }, false),
      dene((n) => { P.veMntParamSabit('pa', 1, true); }, false),
      dene(() => { P.veMntParamAcik('pa', 'tolerans', true); }, false),
      dene(() => { P.veMntParamSinir('pa', 'surunme', '20'); }, false),
      dene(() => { P.veMntParamSinir('pa', 'sehimUst', '7'); P.veMntParamSinir('pa', 'isletmeUst', '9'); }, true),
      dene(() => { P.veMntParamAcik('pa', 'cekme', false); }, true),
      dene(() => { P.veMntParamSinir('pa', 'agirlik', '0,9'); }, true),
      dene(() => { P.veMntParamSinir('pa', 'tolerans', '25'); }, true),           // tolerans kapalıyken değeri taramaya girmez
      dene(() => { const s = global.nodes.find((x) => x.type === 'mnt-solver'); global._veMntLast = cp._mntComputeResults(s.id); }, true)
    ];
    sonuc.forEach((x, i) => expect([i, x[1]]).toEqual([i, x[0]]));
    // eskimiş tarama: Sonuç yalnız durumu yazar, eksik bandında
    const n = kur(); taraSakla(n); P.veMntParamAcik('pa', 'tolerans', true);
    const d = dom(P.getMntParamPropertiesHTML(n));
    const kat = d.querySelector('.ve-fp-kat[data-k="sonuc"]');
    expect(kat.getAttribute('data-d')).toBe('eksik');
    expect(kat.querySelector('svg')).toBeNull();
    expect(kat.textContent).toContain('Taramadan sonra girdi değişti');
    expect(d.querySelector('.ve-fp-eksik').textContent).toContain('Taramadan sonra girdi değişti');
  });

  // GALERİ: on diyagram tam ekranda, yalnız açılınca çizilir; soldaki listeden
  // geçiş AYNI katmanda; kesit, büyüklük, K1 ve kamera seçimi GÖRÜNÜM durumu —
  // modelde değil (geri-al yığınına ve düğüme yazılmaz).
  test('GALERİ: ray geçişi aynı katmanda; seçimler galeriye yansır ve modele yazılmaz; açık kısıtların kodu ve adı', () => {
    const n = kur(); taraSakla(n);
    document.body.innerHTML = '';
    const boy = (ad, v) => { const e = Object.getOwnPropertyDescriptor(HTMLElement.prototype, ad); Object.defineProperty(HTMLElement.prototype, ad, { configurable: true, get: () => v }); return e; };
    const eski = [['clientWidth', boy('clientWidth', 1100)], ['clientHeight', boy('clientHeight', 760)]];
    try {
      const veri = JSON.stringify(global.nodes.map((x) => x.data));
      global.saveState = jest.fn();
      const kat = () => document.querySelectorAll('#ve-mnt-fs');
      const basili = () => [...document.querySelectorAll('.ve-pd-ray button[aria-pressed="true"]')].map((b) => b.getAttribute('data-pd'));
      const ciz = () => document.querySelector('#ve-mnt-prm-fs svg.ve-pd');
      PS.veMntParamTamEkran('pa', 'd11');
      expect(kat().length).toBe(1);
      const ilk = kat()[0];
      expect([...document.querySelectorAll('.ve-pd-ray button[data-pd]')].map((b) => b.textContent)).toEqual(PS._MNT_PRM_DIYAGRAM.map((x) => x[1]));
      expect(basili()).toEqual(['d11']);
      expect(ciz().getAttribute('aria-label')).toBe('Pareto cephesi');
      expect(Number(ciz().getAttribute('width'))).toBe(1100 - 26);
      PS.veMntParamTamEkran('pa', 'd4');                                    // listeden geçiş: aynı katman
      expect(kat().length).toBe(1);
      expect(kat()[0]).toBe(ilk);
      expect(basili()).toEqual(['d4']);
      expect(document.querySelector('#ve-mnt-fs .ve-settings-header > span').textContent.trim()).toBe('İletilebilirlik haritası');
      PS.veMntParamKesit('pa', 'cift', '0,1');
      PS.veMntParamKesit('pa', '2', '3');
      expect(document.querySelector('#ve-mnt-prm-fs .ve-pd-kesit select').value).toBe('0,1');
      PS.veMntParamTamEkran('pa', 'd3');
      PS.veMntParamSec('pa', 'd3', 'f');
      expect(document.querySelector('#ve-mnt-prm-fs .ve-mnt-seg button[aria-pressed="true"]').textContent).toBe('f maks');
      expect(document.querySelector('#ve-mnt-prm-fs .ve-pd-arac .ve-pd-sifirla')).not.toBeNull();
      PS.veMntParamSec('pa', 'd1k1', true);
      PS._MNT_PARAM_KAM['pa|d2'] = { az: 100, el: 50 };
      PS.veMntParam3bSifirla('pa', 'd2');
      expect(PS._MNT_PARAM_KAM['pa|d2']).toBeUndefined();
      expect(global.saveState).not.toHaveBeenCalled();
      expect(JSON.stringify(global.nodes.map((x) => x.data))).toBe(veri);
      const c = K.baglam(P._mntParamHazirlik(n).ctx);
      expect([...document.querySelectorAll('.ve-pd-kod dt')].map((x) => x.textContent))
        .toEqual(K.KISITLAR.filter((Q) => c.acik[Q.k]).map((Q) => (Q.zorunlu ? 'K' : '') + Q.no));
      expect([...document.querySelectorAll('.ve-pd-kod dd')].map((x) => x.textContent))
        .toEqual(K.KISITLAR.filter((Q) => c.acik[Q.k]).map((Q) => Q.ad));
      document.getElementById('ve-mnt-fs-x').click();
      expect(kat().length).toBe(0);
      PS.veMntParamTamEkran('pa', 'd2');                                    // kapandıktan sonra yeniden açılır
      expect(kat().length).toBe(1);
      expect(basili()).toEqual(['d2']);
      document.getElementById('ve-mnt-fs-x').click();
    } finally {
      eski.forEach(([ad, e]) => { if (e) Object.defineProperty(HTMLElement.prototype, ad, e); else delete HTMLElement.prototype[ad]; });
    }
  });

  test('proje değişince taramalar ve görünüm seçimleri unutulur (topology.js → veResetSubtopoNav)', () => {
    const n = kur(); taraSakla(n);
    PS.veMntParamKesit('pa', 'cift', '0,1');
    expect(PS._mntParamSonucDurum('pa', P._mntParamHazirlik(n))).not.toBeNull();
    PS.veMntParamUnut();
    expect(PS._mntParamSonucDurum('pa', P._mntParamHazirlik(n))).toBeNull();
    expect(PS._MNT_PARAM_KESIT.pa).toBeUndefined();
    const src = require('fs').readFileSync(require.resolve('../../js/topology.js'), 'utf8');
    const fn = src.slice(src.indexOf('function veResetSubtopoNav('), src.indexOf('\n}', src.indexOf('function veResetSubtopoNav(')));
    expect(fn).toContain('veMntParamUnut()');
  });

  test('RAPOR: Sonuç düğmesi bugünkü sınırlarla indirir; eskimiş taramada indirmez', () => {
    const n = kur(); taraSakla(n);
    const indir = jest.fn();
    global._mntReportDownload = indir;
    global._mntReportEnsureAssets = (cb) => cb(true);
    expect(PS._mntParamOzet(PS._MNT_PARAM_SONUC.pa, K.baglam(P._mntParamHazirlik(n).ctx)).S.uygunN).toBeGreaterThan(0);
    P.veMntParamSinir('pa', 'sehimUst', '1');                              // hiçbir kombinasyon sağlamaz
    PS.veMntParamRapor('pa');
    expect(indir).toHaveBeenCalledTimes(1);
    expect(indir.mock.calls[0][0]).toContain(' · uygun 0 · ');
    expect(indir.mock.calls[0][0]).toContain('<span class="t">Uygun kombinasyon yok</span>');
    P.veMntParamAcik('pa', 'tolerans', true);
    PS.veMntParamRapor('pa');
    expect(indir).toHaveBeenCalledTimes(1);
  });
});
