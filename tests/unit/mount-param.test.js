/**
 * mount-param.test.js — Parametrik Analiz · Katalogdan seçim, gerçek modellerle
 * ─────────────────────────────────────────────────────────────────────────
 * Kapılar (js/cp-mount-param.js · js/cp-mount-param-rapor.js):
 *   TEK YOL   — taramanın seçtiği kombinasyon modele uygulanıp Çözücü'yle
 *               çözülünce frekanslar, statik sehimler, T ve işletme sehimleri
 *               taramanın ölçtüğünün AYNISI (ayrı bir "tarama için" çözüm yok)
 *   AYNI HÜKÜM — Kriter 1 · 1a · 1b · 2 için taramanın hükmü raporun uygunluk
 *               tablosunun (veMntUygunluk) hükmüyle aynı, örneklenen her kombinasyonda
 *   PENCERE   — girdiler, durumlar (eksik · sınır), sonuç taşımaz
 *   RAPOR     — ayrı belge: bölümler, Türkçe sayı, sayısız alan yok
 *   KOŞUCU    — parça parça koşar, durdurulur, bitince bir kez indirir
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
global.veIkon = global.veIkon || ((ad) => '<i class="mf-ico mf-ico-' + ad + '"></i>');
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
  afterEach(() => { jest.useRealTimers(); });

  test('parça parça koşar, durumu yazar, bitince BİR kez indirir; ikinci tıklama durdurur', () => {
    modelKur('kamyon');
    const n = { id: 'pa', type: 'mnt-parametric', data: {} };
    global.nodes.push(n);
    document.body.innerHTML = '<div class="ve-properties-content">' + P.getMntParamPropertiesHTML(n) + '</div>';
    const indir = jest.fn();
    global._mntReportDownload = indir;
    global._mntReportEnsureAssets = (cb) => cb(true);
    P.veMntParamTara('pa');
    expect(document.getElementById('ve-mnt-param-btn-pa').textContent).toMatch(/Durdur/);
    jest.advanceTimersByTime(0);
    expect(document.getElementById('ve-mnt-param-st-pa').textContent).toMatch(/^Aşama [12] · [\d.]+ \/ [\d.]+$/);
    jest.runAllTimers();
    expect(indir).toHaveBeenCalledTimes(1);
    expect(indir.mock.calls[0][1]).toBe('takoz_katalogdan_secim.html');
    expect(document.getElementById('ve-mnt-param-st-pa').textContent).toMatch(/^İndirildi \([\d.]+ KB\)$/);
    expect(document.getElementById('ve-mnt-param-btn-pa').textContent).toMatch(/Tara ve raporu indir/);
    // durdurma
    P.veMntParamTara('pa');
    P.veMntParamTara('pa');
    jest.runAllTimers();
    expect(indir).toHaveBeenCalledTimes(1);
    expect(document.getElementById('ve-mnt-param-st-pa').textContent).toBe('Durduruldu');
  });
});
