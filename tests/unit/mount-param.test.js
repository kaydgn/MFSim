/**
 * mount-param.test.js — Parametrik Analiz · Katalogdan seçim, gerçek modellerle
 * ─────────────────────────────────────────────────────────────────────────
 * Kapılar (js/cp-mount-param.js · js/cp-mount-param-sonuc.js · js/cp-mount-param-rapor.js):
 *   TEK YOL   — taramanın seçtiği kombinasyon modele uygulanıp Çözücü'yle
 *               çözülünce frekanslar, statik sehimler, T ve işletme sehimleri
 *               taramanın ölçtüğünün AYNISI (ayrı bir "tarama için" çözüm yok)
 *   AYNI HÜKÜM — Kriter 1 · 1a · 1b · 2 için taramanın hükmü raporun uygunluk
 *               tablosunun (veMntUygunluk) hükmüyle aynı, örneklenen her kombinasyonda
 *   PENCERE   — girdiler: gruplar, markaya göre adaylar, dört kesin kriter, rijitlik
 *               toleransı (ek kısıt, sürünme, ağırlık YOK); durumlar
 *   KOŞUCU    — dilim dilim koşar (≤ 10 ms; kullanıcı 2026-10-18: "program
 *               kasıyor"), ilerleme eylem satırında, durdurulur, bitince
 *               Sonuç kategorisi kurulur
 *   SONUÇ     — Excel'in kuralı (kullanıcı kararı 2026-11-10): dört kesin kriter, sonra
 *               en küçük statik sehim; K0 (mevcut) ve K1…K9 pencerede, Excel'in Özet'inde
 *               ve raporda AYNI liste (kaba kuvvet hakemiyle); seçilen K'nın kriterleri ve
 *               modları; dokuz diyagram galeride; model/aday/sabit/tolerans değişince
 *               ESKİR; seçim görünüm durumu
 *   RAPOR     — ayrı belge: bölümler, aynı K listesi, Türkçe sayı, sayısız alan yok
 */
const H = require('../helpers/takoz-dogrulama.js');

const { cp, rp } = H.kur();
// GERÇEK KÜTÜPHANE (donmadan önceki girdilerin kopyası): Canlı Not 1008'in kapısı onunla koşar —
// tahmini rijitlikli, rijitliği eksik ve aday olmayan tipler donmuş kümede yok.
const TAM_KUTUPHANE = Object.fromEntries(Object.entries(cp.VE_MOUNT_LIBRARY).map(([k, e]) => [k, Object.assign({}, e)]));
// KATALOG ONAY ANINDAKİ 24 TİP: tarama testleri kütüphanenin ilk 24 girdisiyle (2026-11-10'a
// dek tam tiplerin hepsi) koşar — beklenen sayılar ve onaylı Excel o kümenin. Teknik
// resimlerle tamamlanan AMC kodları (137061 · 137062 · 137961) adayları 27'ye çıkarır;
// o sayı mount-amc.test.js → PARAMETRİK'te kilitli.
Object.keys(cp.VE_MOUNT_LIBRARY).slice(24).forEach((k) => { delete cp.VE_MOUNT_LIBRARY[k]; });
// Canlı Not 133 dört 57RS tipini taramanın adaylığından çıkardı (`aday:false`); donmuş kümede
// aday kalırlar — beklenen sayılar ve onaylı Excel o kümenin. Adaylıktan çıkış kapısı:
// mount-param.test.js → ADAY OLMAYAN TİP.
Object.keys(cp.VE_MOUNT_LIBRARY).forEach((k) => { delete cp.VE_MOUNT_LIBRARY[k].aday; });
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
global.veMntParamExcel = require('../../js/mount-param-excel.js');
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
// K1…K9 hakemi (Excel'in onaylanan kuralı, kaba kuvvet): dört kesin kriteri sağlayanlar
// (ikinci aşaması ölçülmüş) statik sehimden, en çok dokuz; yoksa en az ihlalli dokuz —
// normalleştirilmiş ihlallerin toplamı, eşitlikte statik sehim.
function hakemK(D, Hk) {
  const coz = [];
  for (let x = 0; x < D.N; x++) if (D.d1[x] === 1) coz.push(x);
  const u = coz.filter((x) => D.d2[x] === 1 && Hk.m[x] === 0).sort((a, b) => D.d[a] - D.d[b] || a - b);
  if (u.length) return u.slice(0, 9);
  const v = (x) => Hk.v1[x] + (D.d2[x] === 1 ? Hk.v2[x] : 0);
  return coz.sort((a, b) => v(a) - v(b) || D.d[a] - D.d[b] || a - b).slice(0, 9);
}

describe('TEK YOL — taramanın ölçtüğü, Çözücü\'nün bulduğu', () => {
  const topo = modelKur('kamyon');
  const { Hz, O, S } = tara({ id: 'pa', type: 'mnt-parametric', data: {} });

  test('kamyon: 2 grup × 24 tip = 576 kombinasyon taranıyor', () => {
    expect(Hz.M.G.map((g) => g.ad)).toEqual(['Sağ/Sol Ön Takoz', 'Sağ/Sol Arka Takoz']);
    expect(S.N).toBe(576);
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

  test('AYNI HÜKÜM: Kriter 1 · 1a · 1b · 2 taramada ve raporun uygunluk tablosunda aynı (36 kombinasyon)', () => {
    const NO = { k1: '1', k1a: '1a', k1b: '1b', k2: '2' };
    const c = K.baglam(Hz.ctx), A = Hz.aday;
    const say = { gecen: 0, kalan: 0 };
    for (let i = 0; i < 576; i += 16) {
      const tipler = [A[Math.floor(i / 24)].key, A[i % 24].key];
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

// YÖN AYARI (2026-11-10, Tulga'nın Excel'i Adams'la denetlenirken bulundu): taramanın
// hazırlığı toplayıcıyı Çözücü'nün yön ayarı (ileri · kaldırım · tork yönü) olmadan
// kuruyordu ve yük durumları varsayılana iniyordu — Tulga'da (tork +X) iki tork durumu
// ters (Adams'tan RMS 17,28 mm), Siper'de (ileri +X, kaldırım 3,5 g aynı) g durumları
// ayna. Taramanın her yük durumu, her takozda, her eksende Çözücü'nün aynısı.
describe('TEK YOL — Çözücü\'nün yön ayarıyla (tork · ileri · kaldırım)', () => {
  [['tulga', { ileri: '-x' }], ['siper', { ileri: '+x', kaldirimG: 3.5, kaldirimYon: 'ayni' }]].forEach(([ad, yon]) => {
    test(ad + ': mevcut tasarımın ve iki kütüphane kombinasyonunun her yük durumu Çözücü\'yle birebir', () => {
      const topo = modelKur(ad);
      const cz = topo.nodes.find((n) => n.type === 'mnt-solver').data;
      Object.keys(yon).forEach((k) => expect([k, cz[k]]).toEqual([k, yon[k]]));    // örnek varsayılanda değil
      if (ad === 'tulga') expect(topo.nodes.find((n) => n.type === 'mnt-transfer').data.donus).toBe('ters');   // tork +X (F049)
      const Hz = P._mntParamHazirlik({ id: 'pa', type: 'mnt-parametric', data: {} });
      const O = P._mntParamOlcucu(Hz.M, K.baglam(Hz.ctx));
      const A = Hz.aday;
      const say = { vaka: 0, tork: 0 };
      [Hz.M.G.map(() => null), Hz.M.G.map((g, i) => A[(3 + 5 * i) % A.length].key), Hz.M.G.map((g, i) => (i % 2 ? 'TK035' : 'TK040'))]
        .forEach((tipler) => {
          const t = O.tam(tipler);
          const R = tipler.every((x) => !x) ? H.coz(topo) : uygulaCoz(topo, Hz, tipler);
          expect(R && !R.error).toBe(true);
          expect(t.vakalar.map((v) => v.ad)).toEqual(R.allCases.map((c) => c.name));
          t.vakalar.forEach((v, q) => {
            const c = R.allCases[q];
            say.vaka++; if (/Torque/.test(v.ad)) say.tork++;
            v.d.forEach((d, i) => d.forEach((x, a) => {
              expect([v.ad, i, a, Math.abs(x - c.res.perMount[i].delta[a] * 1000) < 1e-9]).toEqual([v.ad, i, a, true]);
            }));
          });
        });
      expect(say.vaka).toBeGreaterThanOrEqual(3 * 12);
      if (ad === 'tulga') expect(say.tork).toBe(3 * 2);
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
    const k = K.hepsi(o1, o2, K.baglam({ fAtes: Hz.M.fAtes })).sonuc;   // ek kısıt motorda (pencere sıralamaya katmaz)
    expect(k.kapasite.na).toBeUndefined();
    expect(k.kapasite.deger).toBeCloseTo(Math.max(...pay) / 250, 12);
    expect(k.darbe.deger).toBeCloseTo(oran, 12);
  });
});

// YERLEŞİM ve ADAYLAR (kullanıcı 2026-11-11, Canlı Not 1002: "Kullanıcının ilk takoz
// konumlarını baz alarak, model üzerindeki takoz dağılımlarını çıkaracağız … kullanıcı takoz
// yerlerine göre parametrik analize katılacak takozları seçecek. İstediği kadar takoz
// seçebilir. Ardından seçilen tüm takozlar, kendi aralarında kombinasyon yapılıp … çözdürülecek";
// Excel'i Tulga_takoz_konfigurasyonlari: grup sütunları Ön Takoz · Sağ/Sol Ön Takoz · Sağ/Sol Arka
// Takoz, 24 tip × 3 grup = 13.824 kombinasyon — Canlı Not 1005'ten beri varsayılan Tüm kombinasyonlar).
// Pencere Canlı Not 1001'de boşaltıldı, adım adım kuruluyor: tarama henüz bağlı değil; eski pencere
// aşağıda PARKTA (_mntParamEskiPencereHTML).
// Canlı Not 1008 (kullanıcı 2026-11-13: "Tüm kombinasyonlara 'tüm takozların' dahil olduğundan ve
// takoz eklendiğinde kombinasyona dahil olduğundan emin olalım … programda kayıtlı olan takoz
// sayısını vs yazalım"): aday kütüphanenin ÇÖZÜLEBİLEN her tipi (tahmini rijitlikli de), liste
// haritadan türer; Analiz kütüphanenin sayılarını taşır. Kapılar GERÇEK kütüphaneyle (TAM_KUTUPHANE).
describe('YERLEŞİM ve ADAYLAR — Canlı Not 1002 · 1005 · 1008', () => {
  const dom = (h) => { const d = document.createElement('div'); d.innerHTML = h; return d; };
  const kur = (ad, data) => { modelKur(ad); const n = { id: 'py', type: 'mnt-parametric', data: data || {} }; global.nodes.push(n); return n; };
  // Analiz'in alanları, etiketiyle; `yan` taranan grup ve kombinasyon
  const analiz = (d) => Object.fromEntries([...d.querySelectorAll('.ve-fp-side .ve-fp-f')]
    .map((f) => [f.querySelector('.ve-fp-l').textContent, f.querySelector('input').value]));
  const yan = (d) => { const A = analiz(d); return [A['Taranan grup'], A['Kombinasyon']]; };
  // Bağımsız hakem: altı rijitliğin hepsi > 0 (çözücünün kuralı) · binlik noktalı tam sayı
  const tam6 = (e) => ['sx', 'sy', 'sz', 'dx', 'dy', 'dz'].every((f) => Number(e[f]) > 0);
  const binlik = (v) => String(v).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  // Kütüphane geçici olarak başka girdilerle (donmuş küme sonunda geri gelir)
  const kutuphaneyle = (L, fn) => {
    const lib = cp.VE_MOUNT_LIBRARY, eski = Object.assign({}, lib);
    const koy = (X) => { Object.keys(lib).forEach((k) => { delete lib[k]; }); Object.assign(lib, X); };
    koy(Object.fromEntries(Object.entries(L).map(([k, e]) => [k, Object.assign({}, e)])));
    try { return fn(); } finally { koy(eski); }
  };
  // çizimin modeli: takozun numarası ve rengi grubunki (Canlı Not 1003 · 1006)
  const cizimModeli = (n) => cp._mntAksoModel(P._mntParamAksoVeri(n.id)).takoz.map((t) => [t.ad, t.no, t.renk]);

  test('YERLEŞİM: Tulga’nın üç grubu Excel’in sütunları; çizim güç grubunun aksonometrisi, takozun çipi ve rengi grubunki', () => {
    const n = kur('tulga'), d = dom(P.getMntParamPropertiesHTML(n));
    expect([...d.querySelectorAll('.ve-fp-kat')].map((k) => k.getAttribute('aria-label'))).toEqual(['Takoz yerleşimi', 'Beklenen takoz sehimi', 'Adaylar']);
    const satir = [...d.querySelectorAll('.ve-fp-kat[data-k="yerlesim"] tbody tr')].map((r) => [...r.cells].map((c) => c.textContent.trim()));
    // Tulga'nın takozları doğrusal (Adams'ın girdisi), kütüphanenin TK0xx'leri yasalı: mevcut tip
    // o tip DEĞİL — adı "· doğrusal" (mount-adams-isg.test.js → PARAMETRİK ANALİZ)
    expect(satir).toEqual([
      ['1', 'Ön Takoz', '1', '−196', 'TK050 50 ShA · doğrusal'],
      ['2', 'Sağ/Sol Ön Takoz', '2', '440', 'TK040 45 ShA · doğrusal'],
      ['3', 'Sağ/Sol Arka Takoz', '2', '1.382', 'TK035 35 ShA · doğrusal']]);
    expect(d.querySelector('.ve-fp-kat[data-k="yerlesim"] .ve-fp-sect em').textContent).toBe('3 grup · 5 takoz');
    // föyün numarası grubun renginde (kare + düz yazı — NUMARA BALONSUZ)
    expect([...d.querySelectorAll('.ve-fp-kat[data-k="yerlesim"] tbody .ve-prm-no')].map((e) => [e.textContent, e.dataset.renk]))
      .toEqual([['1', '1'], ['2', '2'], ['3', '3']]);
    // çizim: Görünümler'in bileşeni, bu pencerenin kaynağıyla; tam ekranı yok (Görünümler'in modelini kurardı)
    const ak = d.querySelector('#ve-mnt-param-ak-py');
    expect(ak.querySelector('svg.ve-mnt2d-akso')).not.toBeNull();
    expect(ak.querySelector('button[aria-label="Tam ekran"]')).toBeNull();
    expect(ak.querySelector('.ve-mnt-kroki-lej').textContent).toMatch('takoz · grup numarası');
    expect(cizimModeli(n)).toEqual([
      ['Ön Takoz', '1', 1], ['Sağ Ön Takoz', '2', 2], ['Sağ Arka Takoz', '3', 3], ['Sol Ön Takoz', '2', 2], ['Sol Arka Takoz', '3', 3]]);
    // küpler ve çipler grubun renginde
    const renk = (sec) => [...ak.querySelectorAll(sec)].map((g) => (/ve-ak-renk-(\d)/.exec(g.getAttribute('class')) || [])[1]).sort().join('');
    expect(renk('g.ve-ak-t')).toBe('12233');
    expect([...ak.querySelectorAll('g.ve-ak-cip.t-cip')].every((c) => /ve-ak-renk-\d/.test(c.getAttribute('class')))).toBe(true);
    // Görünümler'in kendi çizimi değişmedi: T numarası, renksiz
    expect(cp._mntAksoModel(cp._mnt2DPencereVeri()).takoz.map((t) => [t.no, t.renk])).toEqual([['T1', undefined], ['T2', undefined], ['T3', undefined], ['T4', undefined], ['T5', undefined]]);
  });

  test('YERLEŞİM: ASFAT ve hafif — çiftin iki takozu aynı numara ve renkte; renk dörtten sonra döner', () => {
    const ad = (m) => m.map((t) => t[1] + ':' + t[2]).sort().join(' ');
    expect(ad(cizimModeli(kur('asfat')))).toBe('1:1 1:1 2:2 2:2 3:3 3:3');
    expect(ad(cizimModeli(kur('hafif')))).toBe('1:1 1:1 2:2');
    expect([1, 2, 3, 4, 5, 6, 9].map(P._mntParamRenk)).toEqual([1, 2, 3, 4, 1, 2, 1]);
  });

  // NUMARA BALONSUZ (kullanıcı 2026-11-11, Canlı Not 1007: "bunları baloncuk yapmana gerek yok.
  // Çocukça duruyor"): grubun numarası düz yazı; renk önündeki keskin köşeli küçük karede.
  test('NUMARA BALONSUZ: numara düz yazı, grubun rengi önündeki karede; zemin ve yuvarlak köşe yok', () => {
    const d = dom(P.getMntParamPropertiesHTML(kur('tulga')));
    const no = [...d.querySelectorAll('.ve-fp-kat[data-k="yerlesim"] tbody .ve-prm-no')];
    expect(no.length).toBe(3);
    no.forEach((e) => {
      expect([...e.children].map((c) => [c.className, c.getAttribute('aria-hidden'), c.textContent])).toEqual([['ve-prm-kare', 'true', '']]);
      expect([e.lastChild.nodeType, e.lastChild.nodeValue]).toEqual([Node.TEXT_NODE, e.textContent]);
    });
    const css = require('fs').readFileSync(require('path').join(__dirname, '../../css/styles.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    const kural = (s) => [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
      .filter((m) => m[1].split(',').some((x) => x.trim() === s)).map((m) => m[2]).join(';');
    expect(kural('.ve-prm-no')).toMatch(/color:/);                            // kural bulundu
    expect(kural('.ve-prm-no')).not.toMatch(/background|border|radius/);
    expect(kural('.ve-prm-kare')).toMatch(/background:\s*var\(--grup-renk/);
    expect(kural('.ve-prm-kare')).not.toMatch(/radius/);
  });

  // ADAYLAR (Canlı Not 1005: "adaylar alt penceresini kaldıralım … Program default olarak TÜM TAKOZ
  // KOMBİNASYONLARINI analiz etsin … kullanıcının gireceği özel kombinasyonu seçebilsin … her konum
  // için takoz aratarak girecek"): tip × grup işaret tablosunun yerine iki kip.
  test('ADAYLAR: varsayılan Tüm kombinasyonlar — her grupta bütün aday tipler (Excel’in taraması); tablo ve alan yok', () => {
    const n = kur('tulga'), Y = P._mntParamYeni(n), d = dom(P.getMntParamPropertiesHTML(n));
    expect(Y.A.length).toBe(24);
    expect([Y.kip, Y.say, Y.taranan, Y.N]).toEqual(['hepsi', [24, 24, 24], 3, 24 ** 3]);
    expect(yan(d)).toEqual(['3 / 3', '13.824']);
    const kat = d.querySelector('.ve-fp-kat[data-k="aday"]');
    expect(kat.querySelector('.ve-fp-sect em').textContent).toBe('24 tip');
    expect([...kat.querySelectorAll('.ve-prm-kip button')].map((b) => [b.textContent, b.getAttribute('aria-pressed')]))
      .toEqual([['Tüm kombinasyonlar', 'true'], ['Özel kombinasyon', 'false']]);
    expect(kat.querySelectorAll('table, input, .ve-prm-oz').length).toBe(0);
    expect(d.querySelector('.ve-fp-durum')).toBeNull();
    expect(d.querySelector('.ve-fp-solve')).toBeNull();                       // tarama henüz pencereye bağlı değil
    expect(n.data).toEqual({});
  });

  // TÜM TİPLER (Canlı Not 1008): aday kütüphanenin çözülebilen HER tipi — tahmini rijitlikli de
  // (Canlı Not 113'ün tahmini; eski liste tahminsizdi); rijitliği eksik tip (çözücü reddeder) ve
  // aday:false tip (Canlı Not 133) dışarıda. Tüm kombinasyonlar ve Özel kombinasyonun araması AYNI listeden.
  test('TÜM TİPLER (Canlı Not 1008): aday kütüphanenin çözülebilen her tipi, tahminli dâhil; rijitliği eksik ve aday olmayan tip dışarıda; kombinasyon ve arama aynı listeden', () => {
    kutuphaneyle(TAM_KUTUPHANE, () => {
      const n = kur('tulga'), Y = P._mntParamYeni(n), L = Object.values(cp.veMntGetLibraryMap());
      const bek = L.filter((e) => e.aday !== false && tam6(e)).map((e) => e.key);
      expect(Y.A.map((a) => a.key)).toEqual(bek);                                  // kütüphane sırası
      // tahmini rijitlikli tip aday — üç üreticide de
      const tah = Y.A.filter((a) => (a.e.tahmin || []).length);
      expect(tah.length).toBeGreaterThan(0);
      expect([...new Set(tah.map((a) => a.e.marka))].sort()).toEqual(['AMC Mecanocaucho', 'Angst+Pfister', 'LASPAR']);
      // dışarıda yalnız iki sınıf: rijitliği eksik ve aday olmayan — ikisi de kütüphanede var
      const dis = L.filter((e) => bek.indexOf(e.key) < 0);
      expect(dis.every((e) => e.aday === false || !tam6(e))).toBe(true);
      expect([dis.some((e) => e.aday === false), dis.some((e) => e.aday !== false && !tam6(e))]).toEqual([true, true]);
      // Tüm kombinasyonlar: her grupta bütün adaylar (sınır yok — aşağıda SINIR YOK)
      const G = Y.M.G.length, d = dom(P.getMntParamPropertiesHTML(n));
      expect([Y.say, Y.N]).toEqual([Y.M.G.map(() => bek.length), bek.length ** G]);
      expect(d.querySelector('.ve-fp-kat[data-k="aday"] .ve-fp-sect em').textContent).toBe(binlik(bek.length) + ' tip');
      expect(yan(d)).toEqual([G + ' / ' + G, binlik(bek.length ** G)]);
      // Özel kombinasyonun araması aynı listeden: boş sorgu bütün adaylar, tahminli tip adıyla bulunur
      const S = P._mntParamListeSira(Y.A);
      expect(P._mntParamAra(S, '', []).map((a) => a.key).sort()).toEqual(bek.slice().sort());
      expect(P._mntParamAra(S, tah[0].name, []).map((a) => a.key)).toContain(tah[0].key);
    });
  });

  // EKLENEN TİP (Canlı Not 1008: "takoz eklendiğinde kombinasyona dahil olduğundan emin olalım"):
  // liste her kurulumda haritadan türer — gömülü kataloğa giren tip, Takoz Özellikleri'nde eklenen
  // özel tip ve rijitliği Takoz Özellikleri'nde tamamlanan tip kendiliğinden aday; aramada bulunur,
  // kombinasyona girer, Analiz'de sayılır.
  test('EKLENEN TİP (Canlı Not 1008): kataloğa giren, Takoz Özellikleri’nde eklenen ve rijitliği tamamlanan tip kendiliğinden aday — aramada, kombinasyonda, Analiz’de', () => {
    kutuphaneyle(TAM_KUTUPHANE, () => {
      const n = kur('tulga'), G = P._mntParamYeni(n).M.G.length, say = (s) => Number(s.replace(/\./g, ''));
      const durum = () => {
        const Y = P._mntParamYeni(n), A = analiz(dom(P.getMntParamPropertiesHTML(n)));
        return { A: Y.A.map((a) => a.key), N: Y.N, kayitli: say(A['Kayıtlı takoz']), aday: say(A['Aday tip']),
          tahmini: say(A['Tahmini rijitlik']), eksik: say(A['Rijitlik eksik']), komb: say(A['Kombinasyon']) };
      };
      const ara = (q) => P._mntParamAra(P._mntParamListeSira(P._mntParamYeni(n).A), q, []).map((a) => a.key);
      const s0 = durum(), n0 = s0.A.length;
      expect([s0.aday, s0.komb]).toEqual([n0, n0 ** G]);
      // (a) gömülü kataloğa giren tip — tahmini rijitlikli
      cp.VE_MOUNT_LIBRARY['zz-yeni'] = { marka: 'LASPAR', name: 'Zeta konik 60 ShA', sx: 900, sy: 900, sz: 450,
        dx: 1170, dy: 1170, dz: 585, tahmin: ['sx', 'sy', 'dx', 'dy', 'dz'] };
      let s = durum();
      expect(s.A).toEqual(s0.A.concat(['zz-yeni']));
      expect([s.N, s.komb, s.kayitli, s.aday, s.tahmini]).toEqual([(n0 + 1) ** G, (n0 + 1) ** G, s0.kayitli + 1, n0 + 1, s0.tahmini + 1]);
      expect(ara('zeta')).toEqual(['zz-yeni']);
      // (b) Takoz Özellikleri'nde eklenen özel tip
      const lib = global.nodes.find((x) => x.type === 'mnt-library');
      lib.data.mounts = [{ key: 'ozel-kasa', name: 'Kasa takozu', sx: 300, sy: 300, sz: 600, dx: 390, dy: 390, dz: 780 }];
      s = durum();
      expect(s.A.slice(-1)).toEqual(['ozel-kasa']);
      expect([s.N, s.kayitli, s.aday]).toEqual([(n0 + 2) ** G, s0.kayitli + 2, n0 + 2]);
      expect(P._mntParamYeni(n).A.find((a) => a.key === 'ozel-kasa').e.marka).toBe('Özel takozlar');
      expect(ara('kasa')).toEqual(['ozel-kasa']);
      global.saveState = jest.fn();                                                // … Özel kombinasyonda gruba eklenir
      n.data = { adaylarKip: 'ozel' };
      expect(P.veMntParamGrupAday('py', 1, 'ozel-kasa', true)).toBe(true);
      expect(P._mntParamYeni(n).say).toEqual([1].concat(Array(G - 1).fill(0)));
      n.data = {};
      // (c) rijitliği eksik tip aday değil; Takoz Özellikleri'nde boş rijitlikleri girilince aday
      const e = Object.values(cp.veMntGetLibraryMap()).find((x) => x.aday !== false && !tam6(x));
      const bos = ['sx', 'sy', 'sz', 'dx', 'dy', 'dz'].filter((f) => !(Number(e[f]) > 0));
      expect(durum().A).not.toContain(e.key);
      lib.data.overrides = { [e.key]: Object.fromEntries(bos.map((f, i) => [f, 400 + 100 * i])) };
      s = durum();
      expect(s.A).toContain(e.key);
      expect([s.N, s.aday, s.eksik]).toEqual([(n0 + 3) ** G, n0 + 3, s0.eksik - 1]);
    });
  });

  // ANALİZ (Canlı Not 1008: "programda kayıtlı olan takoz sayısını vs yazalım. Kullanıcı bilgilensin"):
  // okunur alanlar — kayıtlı takoz · aday tip · ölçülü ve tahmini rijitlik · rijitlik eksik · aday değil
  // (kütüphanenin sınıfları, bağımsız hakemle) · taranan grup · kombinasyon; binlik noktalı Türkçe sayı.
  // Çözümsüz: eleme yok — en düşük takoz yükü ve elenen boş (eleme: mount-param-eleme.test.js).
  test('ANALİZ (Canlı Not 1008): kayıtlı takoz, aday tip, ölçülü ve tahmini rijitlik, rijitlik eksik, aday değil — kütüphanenin sınıfları; okunur, Türkçe sayı', () => {
    kutuphaneyle(TAM_KUTUPHANE, () => {
      cp._veMntLast = null;
      const n = kur('tulga'), L = Object.values(cp.veMntGetLibraryMap()), d = dom(P.getMntParamPropertiesHTML(n));
      const aday = L.filter((e) => e.aday !== false && tam6(e)), tah = aday.filter((e) => (e.tahmin || []).length).length;
      const bek = [['Kayıtlı takoz', L.length], ['Aday tip', aday.length], ['Ölçülü rijitlik', aday.length - tah],
        ['Tahmini rijitlik', tah], ['Rijitlik eksik', L.filter((e) => e.aday !== false && !tam6(e)).length],
        ['Aday değil', L.filter((e) => e.aday === false).length]];
      // sınıflar ayrık ve kütüphanenin tamamı; hiçbiri boş değil
      expect(bek[1][1] + bek[4][1] + bek[5][1]).toBe(bek[0][1]);
      bek.forEach(([, v]) => expect(v).toBeGreaterThan(0));
      const G = P._mntParamYeni(n).M.G.length;
      expect(Object.entries(analiz(d))).toEqual(bek.map(([k, v]) => [k, binlik(v)])
        .concat([['En düşük takoz yükü [kg]', '—'], ['Elenen', '—'], ['Taranan grup', G + ' / ' + G], ['Kombinasyon', binlik(aday.length ** G)]]));
      expect(analiz(d)['Kombinasyon']).toMatch(/^\d{1,3}(\.\d{3})+$/);
      // okunur alanlar; bölüm bütünüyle yerinde tazelenir
      const sec = d.querySelector('#ve-mnt-param-ozet-py');
      expect(sec.hasAttribute('data-tazele')).toBe(true);
      expect([...sec.querySelectorAll('input')].map((i) => i.readOnly)).toEqual(Array(10).fill(true));
    });
  });

  test('KİP: Özel kombinasyon alanı yazar, Tüm kombinasyonlar siler; özelin seçimi korunur; aynı kip adım düşürmez', () => {
    const n = kur('tulga');
    global.saveState = jest.fn(); global.showNodeProperties = jest.fn();
    const Y0 = P._mntParamYeni(n), G = Y0.M.G, A = Y0.A;
    P.veMntParamAdayKip('py', 'ozel');
    expect(n.data).toEqual({ adaylarKip: 'ozel' });
    expect(global.saveState).toHaveBeenCalledTimes(1);
    expect(global.showNodeProperties).toHaveBeenCalledWith(n);
    P.veMntParamAdayKip('py', 'ozel');                                         // aynı kip: yazılmaz
    expect(global.saveState).toHaveBeenCalledTimes(1);
    // özelde tip eklenmeyen grup mevcut tipinde: taranan grup yok
    const Y = P._mntParamYeni(n), d = dom(P.getMntParamPropertiesHTML(n));
    expect([Y.kip, Y.say, Y.taranan, Y.N]).toEqual(['ozel', [0, 0, 0], 0, 0]);
    expect(yan(d)).toEqual(['0 / 3', '0']);
    expect(d.querySelector('.ve-fp-durum')).toBeNull();
    expect([...d.querySelectorAll('.ve-prm-kip button[aria-pressed="true"]')].map((b) => b.dataset.kip)).toEqual(['ozel']);
    // her grubun bloğu: numarası, adı, sayısı ve arama kutusu (adıyla)
    expect([...d.querySelectorAll('.ve-prm-oz')].map((b) => [b.dataset.no, b.querySelector('.ve-prm-oz-bas .ve-prm-oz-ad').textContent,
      b.querySelector('.ve-prm-oz-n').textContent, b.querySelector('.ve-prm-ara-k input').getAttribute('aria-label'),
      b.querySelectorAll('.ve-prm-oz-t li').length]))
      .toEqual(G.map((g) => [String(g.no), g.ad, 'Mevcut tip', 'Takoz ara · ' + g.ad, 0]));
    d.querySelectorAll('.ve-prm-ara-k input').forEach((i) => expect(i.getAttribute('placeholder')).toBe('Takoz ara'));
    P.veMntParamGrupAday('py', 1, A[0].key, true);
    P.veMntParamAdayKip('py', 'hepsi');
    expect(n.data).toEqual({ adaylar: { [G[0].anahtar]: [A[0].key] } });       // özelin seçimi korunur …
    expect(P._mntParamYeni(n).N).toBe(24 ** 3);                                  // … Tüm kombinasyonlarda sayılmaz
    P.veMntParamAdayKip('py', 'ozel');
    expect(P._mntParamYeni(n).N).toBe(1);
    P.veMntParamAdayKip('py', 'xyz');                                            // tanınmayan kip: Tüm kombinasyonlar
    expect(n.data.adaylarKip).toBeUndefined();
    const adim = global.saveState.mock.calls.length;
    P.veMntParamAdayKip('yok', 'ozel');                                          // olmayan düğüm
    expect(global.saveState).toHaveBeenCalledTimes(adim);
  });

  test('SEÇİM: grup başına; kütüphane sırasında yazılır, tekrar yok; boşalan grup ve alan silinir; aday olmayan tip, olmayan grup ve değişmeyen seçim yazılmaz', () => {
    const n = kur('tulga', { adaylarKip: 'ozel' });
    global.saveState = jest.fn();
    const Y = P._mntParamYeni(n), G = Y.M.G, A = Y.A;
    expect(P.veMntParamGrupAday('py', 2, A[5].key, true)).toBe(true);
    expect(P.veMntParamGrupAday('py', 2, A[1].key, true)).toBe(true);
    expect(n.data.adaylar).toEqual({ [G[1].anahtar]: [A[1].key, A[5].key] });
    expect(global.saveState).toHaveBeenCalledTimes(2);
    expect(P.veMntParamGrupAday('py', 2, A[1].key, true)).toBe(false);          // ikinci kez: tekrar yok
    expect(P.veMntParamGrupAday('py', 2, 'yok', true)).toBe(false);             // aday olmayan tip
    expect(P.veMntParamGrupAday('py', 9, A[0].key, true)).toBe(false);          // olmayan grup
    expect(P.veMntParamGrupAday('yok', 1, A[0].key, true)).toBe(false);         // olmayan düğüm
    expect(P.veMntParamGrupAday('py', 1, A[3].key, false)).toBe(false);         // eklenmemiş tip
    expect(global.saveState).toHaveBeenCalledTimes(2);
    expect(n.data.adaylar).toEqual({ [G[1].anahtar]: [A[1].key, A[5].key] });
    P.veMntParamGrupAday('py', 3, A[0].key, true);
    expect(P._mntParamYeni(n).say).toEqual([0, 2, 1]);
    P.veMntParamGrupAday('py', 2, A[1].key, false);
    P.veMntParamGrupAday('py', 2, A[5].key, false);
    expect(n.data.adaylar).toEqual({ [G[2].anahtar]: [A[0].key] });
    P.veMntParamGrupAday('py', 3, A[0].key, false);
    expect(n.data).toEqual({ adaylarKip: 'ozel' });
  });

  test('KOMBİNASYON: Tüm kombinasyonlarda tip sayısının grup sayısınca kuvveti; özelde seçili grupların çarpımı, seçilmeyen grup mevcut tipinde', () => {
    const n = kur('tulga'), G = P._mntParamYeni(n).M.G, A = P._mntParamYeni(n).A;
    expect(P._mntParamYeni(n).N).toBe(A.length ** G.length);
    n.data = { adaylarKip: 'ozel', adaylar: { [G[0].anahtar]: A.slice(0, 4).map((a) => a.key), [G[2].anahtar]: A.slice(0, 6).map((a) => a.key) } };
    let Y = P._mntParamYeni(n), d = dom(P.getMntParamPropertiesHTML(n));
    expect([Y.say, Y.taranan, Y.N]).toEqual([[4, 0, 6], 2, 24]);
    expect(yan(d)).toEqual(['2 / 3', '24']);
    expect([...d.querySelectorAll('.ve-prm-oz-n')].map((t) => t.textContent)).toEqual(['4 tip', 'Mevcut tip', '6 tip']);
    expect([...d.querySelectorAll('.ve-prm-oz-t')].map((u) => u.querySelectorAll('li').length)).toEqual([4, 0, 6]);
    // bugün aday olmayan tip, tekrar ve olmayan grup sayılmaz (model ya da kütüphane değişmiş olabilir)
    n.data.adaylar = { [G[0].anahtar]: ['yok', A[0].key, A[0].key], 'x|y': [A[1].key] };
    expect(P._mntParamYeni(n).say).toEqual([1, 0, 0]);
  });

  // SINIR YOK (kullanıcı 2026-11-13: "Bu limiti kaldıralım, yani program sonsuz sayıda iterasyon
  // yapabilmeli. Zaten onun için de bir gösterge ekleyeceğiz."): kombinasyon sayısının üst sınırı ve
  // "Kombinasyon sayısı … üstünde" durumu YOK — Tulga gerçek kütüphaneyle, sentetik kütüphane üç ve
  // altı grupla; sayı Analiz'de bütünüyle, binlik noktalı; iki kipte, eski pencerede de.
  test('SINIR YOK: büyük kombinasyon sayısı durum üretmez — Tulga gerçek kütüphaneyle, sentetik 10⁹ ve 10¹⁸; sayı bütünüyle, binlik noktalı', () => {
    expect(K).not.toHaveProperty('MAKS_KOMB');
    const durumsuz = (n) => {
      const d = dom(P.getMntParamPropertiesHTML(n));
      expect([P._mntParamYeni(n).eksik, d.querySelector('#ve-mnt-param-durum-py').textContent, d.querySelector('.ve-fp-durum')]).toEqual(['', '', null]);
      return yan(d);
    };
    kutuphaneyle(TAM_KUTUPHANE, () => {
      const n = kur('tulga'), Y = P._mntParamYeni(n), a = Y.A.length;
      expect(Y.N).toBe(a ** 3);
      expect(Y.N).toBeGreaterThan(200000);                                       // eski sınır
      expect(durumsuz(n)).toEqual(['3 / 3', binlik(a ** 3)]);
      // Özel kombinasyon: her grupta bütün adaylar — aynı sayı, durum yok
      n.data = { adaylarKip: 'ozel', adaylar: Object.fromEntries(Y.M.G.map((g) => [g.anahtar, Y.A.map((x) => x.key)])) };
      expect(durumsuz(n)).toEqual(['3 / 3', binlik(a ** 3)]);
    });
    // sentetik kütüphane: 1.000 tam tip → üç grupta 10⁹, altı grupta 10¹⁸
    const SENT = Object.fromEntries(Array.from({ length: 1000 }, (_, i) => ['s' + i,
      { marka: 'Diğer', name: 'Sentetik ' + i, sx: 500, sy: 500, sz: 300, dx: 650, dy: 650, dz: 390 }]));
    kutuphaneyle(SENT, () => {
      const n = kur('tulga');
      expect(durumsuz(n)).toEqual(['3 / 3', '1.000.000.000']);
      // üç tek takoz daha: altı grup
      const m = global.nodes.find((x) => x.type === 'mnt-mount');
      [1, 2, 3].forEach((k) => global.nodes.push(Object.assign(JSON.parse(JSON.stringify(m)),
        { id: 'ek' + k, customName: 'Ek takoz ' + k, data: Object.assign({}, m.data, { x: 1600 + 300 * k, y: 0, z: 500 }) })));
      expect(P._mntParamYeni(n).M.G.length).toBe(6);
      expect(durumsuz(n)).toEqual(['6 / 6', '1.000.000.000.000.000.000']);
    });
  });

  test('ARAMA: sorgunun her sözcüğü adda ya da markada (sırası serbest); Türkçe harf katlaması; eklenmiş tip düşer; sıra verilen listenin', () => {
    const n = kur('tulga'), A = P._mntParamYeni(n).A;
    const anahtar = (L) => L.map((a) => a.key);
    expect(P._mntParamAra(A, '', [])).toEqual(A);                               // boş sorgu: hepsi
    expect(anahtar(P._mntParamAra(A, '  ', [A[0].key, A[2].key]))).toEqual(anahtar(A.filter((a, i) => i !== 0 && i !== 2)));
    const amc = A.filter((a) => a.e.marka === 'AMC Mecanocaucho');
    expect(amc.length).toBeGreaterThan(1);
    expect(P._mntParamAra(A, 'MECANOCAUCHO', [])).toEqual(amc);                // marka
    // iki sözcük: ikisini de taşıyanlar, sözcüklerin sırası serbest (kaba hakem: düz küçük harf)
    const iki = A.filter((a) => /cone/i.test(a.name) && /60/.test(a.name));
    expect(iki.length).toBeGreaterThan(1);
    expect(P._mntParamAra(A, '60 CONE', [])).toEqual(iki);
    expect(P._mntParamAra(A, 'cone 60', [iki[0].key])).toEqual(iki.slice(1));
    expect(P._mntParamAra(A, 'cone zzz', [])).toEqual([]);
    const ters = A.slice().reverse();
    expect(P._mntParamAra(ters, 'cone 60', [])).toEqual(iki.slice().reverse());  // verilen listenin sırası
    // Türkçe: I · ı · İ · i eşdeğer, ş · s eşdeğer
    const T = [{ key: 'a', name: 'IŞIK 40 ShA', e: { marka: 'Diğer' } }, { key: 'b', name: 'İnce 50 ShA', e: { marka: 'Diğer' } },
      { key: 'c', name: 'Kasa', e: { marka: 'Özel takozlar' } }];
    const ad = (q, h) => P._mntParamAra(T, q, h || []).map((a) => a.key).join('');
    expect(['ışık', 'isik', 'IŞIK', 'Işık'].map((q) => ad(q))).toEqual(['a', 'a', 'a', 'a']);
    expect(['ince', 'İNCE', 'ınce', 'INCE'].map((q) => ad(q))).toEqual(['b', 'b', 'b', 'b']);
    expect([ad('özel'), ad('ozel takoz'), ad('sha'), ad('sha', ['a'])]).toEqual(['c', 'c', 'ab', 'b']);
  });

  test('SIRA: özelin listeleri Takoz Özellikleri’nin Tip listesinin sırasıyla (marka, markanın sırası); kayıt kütüphane sırasında', () => {
    const n = kur('tulga', { adaylarKip: 'ozel' }), Y = P._mntParamYeni(n), A = Y.A, G = Y.M.G;
    const S = P._mntParamListeSira(A);
    expect(S.map((a) => a.key).sort()).toEqual(A.map((a) => a.key).sort());
    expect(S.map((a) => a.key)).toEqual(cp.veMntLibMarkalar(A.map((a) => a.e)).flatMap((m) => m.girdiler.map((e) => e.key)));
    expect(S.map((a) => a.key)).not.toEqual(A.map((a) => a.key));            // sıra gerçekten başka
    global.saveState = jest.fn();
    [...A].reverse().forEach((a) => P.veMntParamGrupAday('py', 1, a.key, true));
    expect(n.data.adaylar[G[0].anahtar]).toEqual(A.map((a) => a.key));       // kayıt: kütüphane sırası
    const d = dom(P.getMntParamPropertiesHTML(n));
    expect([...d.querySelectorAll('#ve-mnt-param-oz-py-1 li button')].map((b) => b.dataset.key)).toEqual(S.map((a) => a.key));
    // satır: ad, kz (Tip listesinin yazımı), mevcut tip işaretli, kaldır düğmesi adıyla
    const li = [...d.querySelectorAll('#ve-mnt-param-oz-py-1 li')];
    li.forEach((r, i) => {
      expect(r.querySelector('.ve-prm-kz').textContent).toBe('kz ' + cp._mntS(S[i].e.sz, 0));
      expect(r.querySelector('button').getAttribute('aria-label')).toBe('Kaldır · ' + S[i].name);
      expect(r.querySelector('button .mf-ico-x')).not.toBeNull();
    });
    const mev = (dd) => [...dd.querySelectorAll('#ve-mnt-param-oz-py-1 li')].filter((r) => r.querySelector('.ve-prm-mev'))
      .map((r) => r.querySelector('button').dataset.key);
    // doğrusal ön takoz yasalı TK050 değil: işaret yok; tip yasasıyla uygulanınca işaretli
    expect([G[0].tip, mev(d)]).toEqual([null, []]);
    global.nodes.filter((x) => G[0].idler.includes(x.id)).forEach((x) => cp._mntLibUygula(x.data, G[0].benzer));
    expect(mev(dom(P.getMntParamPropertiesHTML(n)))).toEqual([G[0].benzer]);
  });

  test('takozsuz model: bölümler başlıklı ve boş, durum sağ sütunda bir kez — iki kipte', () => {
    modelKur('tulga');
    global.nodes = global.nodes.filter((x) => !/^mnt-mount$/.test(x.type));
    const n = { id: 'py', type: 'mnt-parametric', data: {} }; global.nodes.push(n);
    [{}, { adaylarKip: 'ozel' }].forEach((data) => {
      n.data = data;
      const d = dom(P.getMntParamPropertiesHTML(n));
      expect([...d.querySelectorAll('.ve-fp-kat .ve-fp-sect b')].map((b) => b.textContent)).toEqual(['Takoz yerleşimi', 'Beklenen takoz sehimi', 'Adaylar']);
      expect(d.querySelector('.ve-prm-ak')).toBeNull();
      expect(d.querySelectorAll('.ve-fp-main table, .ve-fp-main input, .ve-fp-main button').length).toBe(0);
      expect(d.textContent.match(/Takoz yok/g).length).toBe(1);
      expect(d.querySelector('.ve-fp-durum').textContent).toMatch(/^Takoz yok\. /);
    });
  });

  test('YERİNDE TAZELEME: yazınca liste açılır; ↓ ve Enter ekler — arama kutusu aynı öğe ve odakta, satırlar, sayı ve özet pencere kurulmadan değişir; tık ekler; Esc temizler; kaldır odağı yerinde bırakır', () => {
    const n = kur('tulga', { adaylarKip: 'ozel' }), Y = P._mntParamYeni(n), G = Y.M.G, A = Y.A;
    global.saveState = () => cp.veMntPencereTazele();
    document.body.innerHTML = '<div class="ve-properties-content">' + P.getMntParamPropertiesHTML(n) + '</div>';
    const govde = document.querySelector('#ve-fp-panes-py'), cizim = document.querySelector('#ve-mnt-param-ak-py');
    const kutu = document.getElementById('ve-mnt-param-ara-py-1'), liste = document.getElementById('ve-mnt-param-ara-l-py-1');
    const sonuc = () => [...liste.querySelectorAll('.ve-prm-ara-o')];                    // tip satırları (marka başlıkları ayrı)
    const yaz = (q) => { kutu.value = q; kutu.dispatchEvent(new Event('input', { bubbles: true })); };
    const tus = (key) => { const e = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }); kutu.dispatchEvent(e); return e; };
    const satir = (no) => [...document.querySelectorAll('#ve-mnt-param-oz-py-' + no + ' li button')].map((b) => b.dataset.key);
    kutu.focus();
    expect([document.activeElement === kutu, liste.hidden]).toEqual([true, false]);     // boş kutuda odak tabloyu açar (Canlı Not 1010)
    kutu.value = ''; P.veMntParamAraKapat(kutu);
    // yazınca: sonuçlar Tip listesinin sırasıyla, ilk tip satırı etkin
    const bek = P._mntParamAra(P._mntParamListeSira(A), 'cone 60', []);
    expect(bek.length).toBeGreaterThan(2);
    yaz('cone 60');
    expect([liste.hidden, kutu.getAttribute('aria-expanded')]).toEqual([false, 'true']);
    expect(sonuc().map((o) => o.dataset.key)).toEqual(bek.map((a) => a.key));
    expect(kutu.getAttribute('aria-activedescendant')).toBe(sonuc()[0].id);
    const sira = () => [...liste.querySelectorAll('[role="option"]')];
    tus('ArrowDown');
    expect(sira().filter((o) => o.getAttribute('aria-selected') === 'true').map((o) => o.dataset.key)).toEqual([bek[1].key]);
    expect(tus('Enter').defaultPrevented).toBe(true);
    expect(n.data.adaylar).toEqual({ [G[0].anahtar]: [bek[1].key] });
    expect(document.getElementById('ve-mnt-param-ara-py-1')).toBe(kutu);                 // kutu tazelenmedi
    expect([document.activeElement === kutu, kutu.value, liste.hidden]).toEqual([true, '', true]);
    expect(document.querySelector('#ve-fp-panes-py')).toBe(govde);                        // pencere kurulmadı
    expect(document.querySelector('#ve-mnt-param-ak-py')).toBe(cizim);                   // çizim yerinde
    expect(satir(1)).toEqual([bek[1].key]);
    expect(document.getElementById('ve-mnt-param-oz-n-py-1').textContent).toBe('1 tip');
    expect(yan(document)).toEqual(['1 / 3', '1']);
    // eklenen tip yeni aramada yok; satıra tık ekler (kayıt kütüphane sırası), odak kutuda
    yaz('cone 60');
    expect(sonuc().map((o) => o.dataset.key)).toEqual(bek.filter((a, i) => i !== 1).map((a) => a.key));
    sonuc()[0].click();
    expect(n.data.adaylar[G[0].anahtar]).toEqual(A.filter((a) => a.key === bek[0].key || a.key === bek[1].key).map((a) => a.key));
    expect(satir(1)).toEqual([bek[0].key, bek[1].key]);
    expect([document.activeElement === kutu, kutu.value, liste.hidden]).toEqual([true, '', true]);
    // ↓ boş sorguda tabloyu açar: marka başlıkları kapalı, açılınca bütün tipler (eklenenler hariç)
    P.veMntParamAraKapat(kutu);
    tus('ArrowDown');
    expect(sonuc().length).toBe(0);
    for (let i = 0; i < liste.querySelectorAll('.ve-prm-ara-m').length; i++) liste.querySelectorAll('.ve-prm-ara-ok')[i].click();
    expect(sonuc().length).toBe(A.length - 2);
    // Esc aramayı temizler ve listeyi kapatır; olay pencereye gitmez
    yaz('zzz');
    expect([sonuc().length, liste.textContent]).toEqual([0, 'Eşleşen takoz yok.']);
    expect(tus('Enter').defaultPrevented).toBe(true);                                  // eşleşme yok: eklenmez
    expect(satir(1).length).toBe(2);
    expect(tus('Escape').defaultPrevented).toBe(true);
    expect([kutu.value, liste.hidden, kutu.getAttribute('aria-expanded')]).toEqual(['', true, 'false']);
    // odak kutudan çıkınca liste kapanır
    yaz('cone');
    expect(liste.hidden).toBe(false);
    kutu.blur();
    expect(liste.hidden).toBe(true);
    // kaldır: satır gider; odak aynı sıradaki satırın düğmesine, satır kalmayınca arama kutusuna
    document.querySelector('#ve-mnt-param-oz-py-1 li button').click();
    expect(satir(1)).toEqual([bek[1].key]);
    expect(document.activeElement).toBe(document.querySelector('#ve-mnt-param-oz-py-1 li button'));
    document.querySelector('#ve-mnt-param-oz-py-1 li button').click();
    expect(satir(1)).toEqual([]);
    expect(document.getElementById('ve-mnt-param-oz-n-py-1').textContent).toBe('Mevcut tip');
    expect(document.activeElement).toBe(kutu);
    expect(n.data).toEqual({ adaylarKip: 'ozel' });
    expect(document.querySelector('#ve-fp-panes-py')).toBe(govde);
  });
});

describe('PENCERE (parkta: eski pencere) — yalnız girdi', () => {
  const dom = (h) => { const d = document.createElement('div'); d.innerHTML = h; return d; };
  const node = () => { const n = { id: 'pa', type: 'mnt-parametric', data: {} }; global.nodes.push(n); return n; };

  // Kullanıcı kararı (2026-11-10, Excel): dört kesin kriter, sonra en küçük statik sehim.
  // Ek kısıtlar, sınırları, sürünme payı ve amaç ağırlığı pencerede YOK — tek ayar
  // rijitlik toleransı.
  test('üç kategori: Gruplar · Adaylar · Kriterler; Kriterler dört kesin kriter, sıralama ölçütü ve tolerans; sağ sütunda tek eylem', () => {
    modelKur('kamyon');
    const n = node(), d = dom(P._mntParamEskiPencereHTML(n));
    expect([...d.querySelectorAll('.ve-fp-kat')].map((t) => t.getAttribute('aria-label'))).toEqual(['Gruplar', 'Adaylar', 'Kriterler']);
    expect(d.querySelector('.ve-fp-tab')).toBeNull();                       // tek gövde (2026-10-16)
    expect(d.querySelector('.ve-fp-side .ve-fp-sect b').textContent).toBe('Analiz');
    expect(d.querySelector('.ve-fp-side select').selectedOptions[0].textContent).toBe('Katalogdan seçim');
    expect([...d.querySelectorAll('.ve-fp-side input')].map((i) => i.value)).toEqual(['2', '24', '576']);
    expect(d.querySelector('.ve-fp-side .ve-fp-durum').textContent).toBe('Taramaya hazır');
    expect(d.querySelectorAll('.ve-fp-solve').length).toBe(1);
    expect(d.querySelector('[data-cozum-durumu]')).toBeNull();
    const kat = d.querySelector('.ve-fp-kat[data-k="kriter"]'), fA = P._mntParamHazirlik(n).M.fAtes;
    expect([...kat.querySelectorAll('.ve-fp-sect > b')].map((b) => b.textContent)).toEqual(['Kesin kriterler', 'Sıralama']);
    expect([...kat.querySelectorAll('tbody tr')].map((r) => [...r.children].map((td) => td.textContent)))
      .toEqual(['k1', 'k1a', 'k1b', 'k2'].map((k) => [K.KISITLAR.find((Q) => Q.k === k).no, P._MNT_PARAM_KRITER_AD[k],
        dom(P._mntParamKriterSinir(k, fA)).textContent]));
    const alan = [...kat.querySelectorAll('input')];                      // ölçüt (salt okunur), toleransın kutusu ve değeri
    expect(alan.map((i) => [i.type, i.readOnly])).toEqual([['text', true], ['checkbox', false], ['text', false]]);
    expect(alan[0].value).toBe('Statik sehim');
    expect(kat.querySelector('#ve-mnt-param-tolerans-pa').disabled).toBe(true);
    ['Sürünme', 'ağırlığı', 'Ek kısıt', 'Kapasite', 'Darbe'].forEach((w) => expect([w, kat.textContent.includes(w)]).toEqual([w, false]));
  });

  test('ayarlar: sabit grup, dışarıda bırakılan tip ve marka, rijitlik toleransı → kombinasyon ve bağlam; eski projenin ek kısıtı okunmaz', () => {
    modelKur('kamyon');
    const n = node();
    P.veMntParamSabit('pa', 1, true);
    expect(P._mntParamHazirlik(n).N).toBe(24);
    P.veMntParamSabit('pa', 1, false);
    expect(n.data.sabit).toBeUndefined();
    P.veMntParamAday('pa', 'TK035', false);
    P.veMntParamAday('pa', 'TK040', false);
    expect(P._mntParamHazirlik(n).N).toBe(484);
    P.veMntParamAdayHepsi('pa', true);
    expect(n.data.haric).toBeUndefined();
    // marka: grubun bütün tipleri birlikte girer, birlikte çıkar
    const H0 = P._mntParamHazirlik(n), mk = P._mntParamMarkalar(H0.A).find((x) => x.A.length > 1);
    P.veMntParamMarka('pa', mk.ad, false);
    expect(P._mntParamHazirlik(n).aday.length).toBe(H0.aday.length - mk.A.length);
    expect(n.data.haric.slice().sort()).toEqual(mk.A.map((a) => a.key).sort());
    P.veMntParamMarka('pa', mk.ad, true);
    expect(n.data.haric).toBeUndefined();
    P.veMntParamAdayHepsi('pa', false);
    expect(P._mntParamHazirlik(n).eksik).toBe('Aday tip yok');
    P.veMntParamAdayHepsi('pa', true);
    // rijitlik toleransı: değer % (aralık çekirdeğin), açıklık ayrı
    let c = K.baglam(P._mntParamHazirlik(n).ctx);
    expect([c.acik.tolerans, c.s.tolerans]).toEqual([false, 0.15]);
    P.veMntParamTolerans('pa', '20');
    P.veMntParamToleransAc('pa', true);
    c = K.baglam(P._mntParamHazirlik(n).ctx);
    expect([c.acik.tolerans, c.s.tolerans]).toEqual([true, 0.2]);
    expect(P._mntParamTolerans(n)).toBe(20);
    P.veMntParamTolerans('pa', '60');                                       // %60 > %50 sınırı
    expect(n.data.sinir).toBeUndefined();
    expect(P._mntParamTolerans(n)).toBe(15);
    P.veMntParamToleransAc('pa', false);
    expect(n.data.acik).toBeUndefined();
    // eski projenin ek kısıtları ve sınırları okunmaz: bağlam dört kesin kriter
    n.data.acik = { darbe: true, ayrisma: true, sehim: true };
    n.data.sinir = { sehimUst: 2, agirlik: 0, surunme: 50 };
    c = K.baglam(P._mntParamHazirlik(n).ctx);
    expect(K.KISITLAR.filter((Q) => c.acik[Q.k]).map((Q) => Q.k)).toEqual(['k1', 'k1a', 'k1b', 'k2']);
    expect([c.acik.tolerans, c.s.surunme]).toEqual([false, 0.3]);
  });

  test('yerinde tazeleme: aday kalmayınca kombinasyon, cevap ve düğme pencere kurulmadan değişir', () => {
    modelKur('kamyon');
    const n = node();
    const canli = global.getMntParamPropertiesHTML;
    global.getMntParamPropertiesHTML = P._mntParamEskiPencereHTML;          // parkta: tazeleme eski pencereyi kurar
    try {
      document.body.innerHTML = '<div class="ve-properties-content">' + P._mntParamEskiPencereHTML(n) + '</div>';
      const dugme = () => document.getElementById('ve-mnt-param-btn-pa');
      expect(dugme().disabled).toBe(false);
      const govde = document.querySelector('#ve-fp-panes-pa');              // pencere kurulmuyor: aynı öğe kalmalı
      n.data.haric = Object.keys(cp.veMntGetLibraryMap());
      expect(cp.veMntPencereTazele()).toBeGreaterThan(0);
      expect(dugme().disabled).toBe(true);
      expect(document.querySelector('#ve-mnt-param-durum-pa').textContent).toBe('Aday tip yok');
      expect([...document.querySelectorAll('#ve-mnt-param-ozet-pa input')].map((i) => i.value)).toEqual(['2', '0', '0']);
      expect(document.querySelector('#ve-fp-panes-pa')).toBe(govde);
      delete n.data.haric;
      cp.veMntPencereTazele();
      expect(dugme().disabled).toBe(false);
    } finally { global.getMntParamPropertiesHTML = canli; }
  });

  // AD SARAR (kullanıcı turu 2026-10-19: "Cone 67 50Sh (AMC 1…" iki ayrı tipte
  // aynı görünüyordu — Adaylar'da 27 adın 17'si, Gruplar'da 6 hücrenin 6'sı
  // kırpılıyordu). Ad hücrenin yazısıdır (ipucu değil), sarar; sondaki
  // parantezli künye tek blok, kod bölünmez. Satır kırılımı tarayıcıda
  // ölçülür (mount-param-sonuc.spec.js → MODELE UYGULA · yerleşim turu).
  // Sertlik de bölünmez (2026-10-19, resmi adlar: "Cone 38 60 ShA (AMC 137963)").
  // Adaylar markaya göre gruplu (açılır kapanır), sıra kütüphanenin marka sırası.
  test('AD SARAR: ad hücresi tam adı taşır, ipucu yok; künye tek blok; tireli kod, önek + numara ve sertlik bölünmez', () => {
    modelKur('asfat');
    const n = node(), d = dom(P._mntParamEskiPencereHTML(n));
    // Aday yalnız TAM ve TAHMİNSİZ tip: radyali tahmini AMC kodları (Canlı Not 113) listede yok.
    const lib = cp.veMntGetLibraryMap(), Hz = P._mntParamHazirlik(n);
    const keys = P._mntParamMarkalar(Hz.A).flatMap((M) => M.A.map((a) => a.key));
    expect(keys.slice().sort()).toEqual(Object.keys(lib).filter((k) => cp._mntLibTam(lib[k]) && !cp._mntLibTahmin(lib[k]).length).sort());
    expect([...d.querySelectorAll('.ve-prm-marka')].map((x) => x.getAttribute('data-marka'))).toEqual(P._mntParamMarkalar(Hz.A).map((M) => M.ad));
    const aday = [...d.querySelectorAll('.ve-fp-kat[data-k="aday"] tbody tr')].map((r) => r.children[1]);
    const grup = [...d.querySelectorAll('.ve-fp-kat[data-k="grup"] tbody tr')].flatMap((r) => [r.children[1], r.children[3]]);
    expect(aday.map((td) => td.textContent)).toEqual(keys.map((k) => lib[k].name));
    const G = P._mntParamModel().G;
    expect(grup.map((td) => td.textContent)).toEqual(G.flatMap((g) => [g.ad, lib[g.tip].name]));
    aday.concat(grup).forEach((td) => {
      expect([td.textContent, td.classList.contains('sar'), td.hasAttribute('title')]).toEqual([td.textContent, true, false]);
    });
    const ek = (k) => (aday[keys.indexOf(k)].querySelector('.ve-mnt-ek') || {}).textContent;
    expect(ek('amc137731')).toBe('(AMC 137731)');
    expect(aday[keys.indexOf('asfat-a')].querySelector('.ve-mnt-ek')).toBeNull();      // ASFAT takozu A: künyesiz (Canlı Not 1004)
    expect(aday[keys.indexOf('amc55sha')].querySelector('.ve-mnt-ek')).toBeNull();     // LMT-1433-37 55 ShA: künyesiz
    const nw = [...d.querySelectorAll('.ve-fp-kat[data-k="aday"] .ve-mnt-nw, .ve-fp-kat[data-k="grup"] .ve-mnt-nw')].map((e) => e.textContent);
    ['AMC 137731)', 'LMT-1433-00', 'LMT-1433-37', 'Sağ/Sol', '60 ShA', 'NG 55 ShA', '45 ShA'].forEach((k) => expect([k, nw.includes(k)]).toEqual([k, true]));
    expect(P._mntParamAd('A&B-1 <x>')).toBe('<span class="ve-mnt-nw">A&amp;B-1</span> &lt;x&gt;');
    expect(P._mntParamAd('Cone 121 NG 55 ShA (AMC 137830)'))
      .toBe('Cone 121 <span class="ve-mnt-nw">NG 55 ShA</span> <span class="ve-mnt-ek">(<span class="ve-mnt-nw">AMC 137830)</span></span>');
    expect(P._mntParamAd('LMT-1433-20 40 ShA')).toBe('<span class="ve-mnt-nw">LMT-1433-20</span> <span class="ve-mnt-nw">40 ShA</span>');
  });

  test('durumlar: takoz yok · f_ateş yok · bütün gruplar sabit; kombinasyonun sınırı yok', () => {
    global.nodes = [];
    expect(P._mntParamHazirlik(node()).eksik).toBe('Takoz yok');
    modelKur('tulga');
    global.nodes.find((x) => x.type === 'mnt-motor').data.cylinders = '';   // silindir sayısı yok
    expect(P._mntParamHazirlik(node()).eksik).toBe('Rölanti devri ve silindir sayısı yok');
    modelKur('kamyon');
    const n = node();
    P.veMntParamSabit('pa', 1, true); P.veMntParamSabit('pa', 2, true);
    expect(P._mntParamHazirlik(n).eksik).toBe('Taranacak grup yok');
    const dom1 = dom(P._mntParamEskiPencereHTML(n));
    expect(dom1.querySelector('.ve-fp-solve').disabled).toBe(true);
    // dört grup → 24⁴ = 331.776: sınır yok (SINIR YOK), Tara açık
    modelKur('kamyon');
    const m = global.nodes.find((x) => x.type === 'mnt-mount');
    [[1, 'Sağ Orta'], [2, 'Sol Orta']].forEach(([k, ad]) => global.nodes.push(Object.assign(JSON.parse(JSON.stringify(m)),
      { id: 'ek' + k, customName: ad, data: Object.assign({}, m.data, { x: 300, y: k === 1 ? 350 : -350, z: 500 }) })));
    [[3, 'Sağ Kuyruk'], [4, 'Sol Kuyruk']].forEach(([k, ad]) => global.nodes.push(Object.assign(JSON.parse(JSON.stringify(m)),
      { id: 'ek' + k, customName: ad, data: Object.assign({}, m.data, { x: 1500, y: k === 3 ? 350 : -350, z: 500 }) })));
    const n4 = node(), H4 = P._mntParamHazirlik(n4);
    expect(H4.M.G.length).toBe(4);
    expect(H4.N).toBe(331776);
    expect(H4.eksik).toBe('');
    expect(dom(P._mntParamEskiPencereHTML(n4)).querySelector('.ve-fp-solve').disabled).toBe(false);
  });
});

describe('RAPOR — ayrı belge, pencerenin K listesi', () => {
  // Tarar ve saklar (pencerenin yolu): ent ve bugünkü özet.
  const kurR = (ad, hazirla) => {
    modelKur(ad);
    const n = { id: 'pr', type: 'mnt-parametric', data: {} };
    global.nodes.push(n);
    if (hazirla) hazirla(n, P._mntParamHazirlik(n));
    const Hz = P._mntParamHazirlik(n), c = K.baglam(Hz.ctx), O = P._mntParamOlcucu(Hz.M, c);
    const it = K.tarayici({ G: Hz.M.G, adaylar: Hz.aday, sabit: Hz.sabit, ctx: Hz.ctx, olc1: O.olc1, olc2: O.olc2, enIyi: 25 });
    it.adim(Infinity);
    PS._mntParamSonucKaydet(n.id, Hz, O, it.depo());
    const ent = PS._MNT_PARAM_SONUC[n.id];
    return { n, Hz, c, ent, Z: PS._mntParamOzet(ent, c) };
  };
  const govdeOf = (html) => html.slice(html.indexOf('<body>'), html.indexOf('<script>', html.indexOf('<body>')));

  test('bölümler; K0…K9 pencerenin listesi, kriterin hükmü taramanınki; Türkçe sayı; NaN · undefined · {,} gövdede yok', () => {
    // Hızlı: ön grup sabit (2 grup × 24 = 576).
    const { Hz, c, ent, Z } = kurR('asfat', (n, H0) => { n.data.sabit = { [H0.M.G[0].anahtar]: true }; });
    const E = PS._mntParamZenginlestir(ent, Z, Hz), L = PS._mntParamKonfig(ent, Z, c);
    expect(E.konfig.map((k) => [k.K, k.idx, k.uygunluk, k.kriter])).toEqual(L.map((k) => [k.K, k.idx, k.uygunluk, k.kriter]));
    expect(E.kSay).toBe(9);
    // AYNI HÜKÜM: tam ölçümün hükmü (hepsi) deponun bitleriyle aynı
    E.konfig.forEach((k) => expect(['k1', 'k1a', 'k1b', 'k2'].map((q) => k.h[q].ok)).toEqual(k.kriter));
    const html = RP.veMntParamRaporHTML(E), govde = govdeOf(html);
    ['Kapsam', 'Yöntem', 'Kriterler', 'Kriterleri sağlayan', 'Sonuç', 'Konfigürasyonlar', 'Varsayımlar ve sınırlar', 'Kaynaklar']
      .forEach((b) => expect(govde).toContain('</span>' + b + '</h2>'));
    expect(html).toContain('<title>Katalogdan takoz seçimi</title>');
    expect(govde).not.toMatch(/NaN|undefined|Infinity/);
    expect(govde).not.toContain('[0]');                                   // her dayanak listede
    expect(govde.replace(/\$\$[\s\S]*?\$\$/g, '')).not.toContain('{,}');
    expect(govde).not.toMatch(/\d\.\d{1,2}(?!\d)\s*(Hz|mm|kg)/);        // ondalık nokta yok
    ['Uzlaşı', 'Pareto cephesi', 'Sürünme', 'ağırlığı', 'En az ihlalli', 'E1', 'E9'].forEach((w) => expect([w, govde.includes(w)]).toEqual([w, false]));
    // Konfigürasyonlar tablosu: K0…K9 sırayla, uygunluk pencerenin
    const t6 = dom6(govde);
    expect(t6.map((r) => r[0])).toEqual(L.map((k) => 'K' + k.K));
    const ui = t6[0].length - 6;                                          // Uygunluk sütunu: grupların ardından
    expect(t6.map((r) => r[ui])).toEqual(L.map((k) => k.uygunluk));
    expect(govde).toContain('K1 · ' + L[1].uygunluk + ': grup başına tip');
    expect(govde).toContain('<figure><svg');
    const duz = govde.replace(/<[^>]+>/g, '');                            // tip adının sertliği ve kodu bölünmez (span)
    L[1].tipler.forEach((t) => { if (t) expect(duz).toContain(Hz.M.lib[t].name.replace(/&/g, '&amp;')); });
    expect(govde).toContain('<span style="white-space:nowrap">55 ShA</span>');
  });
  // §6'nın tablosu → hücre metinleri
  function dom6(govde) {
    const d = document.createElement('div');
    d.innerHTML = govde.slice(govde.indexOf('<h2 id="p6"'), govde.indexOf('<h2 id="p7"'));
    return [...d.querySelector('table').querySelectorAll('tr')].slice(1).map((r) => [...r.children].map((td) => td.textContent));
  }

  test('dayanaklar: anılan her anahtar listede, listedeki her kaynak anılıyor; bilinmeyen anahtar [0] değil hata', () => {
    const fs = require('fs');
    const kaynak = fs.readFileSync(require.resolve('../../js/cp-mount-param-rapor.js'), 'utf8');
    const liste = RP._MNT_PRM_KAYNAK.map((x) => x.k);
    const anilan = new Set();
    // Doğrudan atıflar: _mntPrmRef('a', 'b') — işlenmeyen dallar dâhil, kaynaktan.
    (kaynak.match(/_mntPrmRef\(([^)]*)\)/g) || []).forEach((c) =>
      (c.match(/'([^']+)'/g) || []).forEach((q) => anilan.add(q.slice(1, -1))));
    // Kriter tablosunun dayanak sütunu.
    const ctx = K.baglam({ fAtes: 30 });
    Object.values(RP._mntPrmKriterTanim(ctx)).forEach((d) => d[2].forEach((k) => anilan.add(k)));
    expect(anilan.size).toBe(liste.length);
    anilan.forEach((k) => expect(liste).toContain(k));
    liste.forEach((k) => expect(anilan.has(k)).toBe(true));
    expect(RP._mntPrmRef('sirket', 'bmc')).toBe('[1] [' + liste.length + ']');
    expect(() => RP._mntPrmKaynakNo('yok')).toThrow(/Kaynak yok: yok/);
    expect(() => RP._mntPrmRef('shen', 'yok')).toThrow();
  });

  test('uygun kombinasyonu olmayan model: "Uygun kombinasyon yok"; K1…K9 en az ihlalli dokuz (kaba kuvvet hakemi)', () => {
    const { Hz, ent, Z } = kurR('hafif');
    expect(Z.S.uygunN).toBe(0);
    const E = PS._mntParamZenginlestir(ent, Z, Hz);
    expect(E.konfig.slice(1).map((k) => k.idx)).toEqual(hakemK(ent.D, Z.Hk));
    E.konfig.slice(1).forEach((k) => expect(k.uygunluk).toBe('Uygun değil'));
    const html = RP.veMntParamRaporHTML(E);
    expect(html).toContain('<span class="t">Uygun kombinasyon yok</span>');
    expect(html).toContain('K1 · Uygun değil: grup başına tip');
    expect(govdeOf(html)).not.toMatch(/NaN|undefined|Infinity/);
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
    document.body.innerHTML = '<div class="ve-properties-content">' + P._mntParamEskiPencereHTML(n) + '</div>';
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
    expect(cubuk().querySelector('span').textContent).toMatch(/^Kombinasyon [\d.]+ \/ 576$/);
    const p0 = +cubuk().getAttribute('aria-valuenow');
    expect(p0).toBeGreaterThan(0);
    expect(p0).toBeLessThan(100);
    // pencere tarama sürerken yeniden kurulsa da ilerleme ve Durdur yerinde
    document.querySelector('.ve-properties-content').innerHTML = P._mntParamEskiPencereHTML(n);
    expect(+cubuk().getAttribute('aria-valuenow')).toBe(p0);
    expect(btn().textContent).toMatch(/Durdur/);
    jest.runAllTimers();
    expect(indir).not.toHaveBeenCalled();
    const ent = PS._MNT_PARAM_SONUC.pa;
    expect(ent && ent.D.tam).toBe(false);                    // ek kısıt yok: ikinci aşama yalnız kesin kriterleri sağlayanlarda
    expect(ent.D.N).toBe(576);
    expect(document.getElementById('ve-mnt-param-st-pa').textContent).toMatch(/^Tarandı \([\d.,]+ s\)$/);
    expect(btn().textContent.trim()).toBe('Tara');
    expect(btn().hasAttribute('data-durdur')).toBe(false);
    expect(document.querySelector('.ve-fp-ilerleme, .ve-fp-yurut[data-is]')).toBeNull();
    const d = document.createElement('div'); d.innerHTML = P._mntParamEskiPencereHTML(n);
    expect([...d.querySelectorAll('.ve-fp-kat')].map((t) => t.getAttribute('aria-label'))).toEqual(['Gruplar', 'Adaylar', 'Kriterler', 'Sonuç']);
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
  test('dilim bütçesi: bir dilim ~10 ms (saat okuması başına 1 ms) — 576 kombinasyon ve ikinci aşaması ≥ 55 dilimde', () => {
    const nd = kurPencere();
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
    const ent = PS._MNT_PARAM_SONUC.pa, Sz = PS._mntParamOzet(ent, K.baglam(P._mntParamHazirlik(nd).ctx)).S;
    expect(dilim.reduce((a, x) => a + x, 0)).toBe(576 + Sz.ikinciN);   // birinci aşama + kesin kriterleri sağlayanların ikincisi
    expect(Math.max(...dilim)).toBeLessThanOrEqual(10);
    expect(dilim.length).toBeGreaterThanOrEqual(55);
    expect(ent.D.N).toBe(576);
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

describe('SONUÇ — Excel’in kuralı: K0 ve K1…K9, seçilen K, modlar, iki grafik; diyagramlar galeride', () => {
  // ASFAT, altı aday: 3 grup × 6 tip = 216 kombinasyon; dört kesin kriteri sağlayan var.
  const ADAY = ['a26-a', 'amc137731', 'bmc-mount1-55sh', 'asfat-a', 'asfat-b', 'bmc-mount1-40sh'];
  const KR = ['k1', 'k1a', 'k1b', 'k2'];
  const dom = (h) => { const d = document.createElement('div'); d.innerHTML = h; return d; };
  function kur(data) {
    PS.veMntParamUnut();
    modelKur('asfat');
    const n = { id: 'pa', type: 'mnt-parametric', data: Object.assign({
      haric: Object.keys(cp.veMntGetLibraryMap()).filter((k) => ADAY.indexOf(k) < 0) }, data || {}) };
    global.nodes.push(n);
    return n;
  }
  // Pencerenin taraması (veMntParamTara'nın seçenekleri) ve saklanması.
  function taraSakla(n, say) {
    const Hz = P._mntParamHazirlik(n);
    const O = P._mntParamOlcucu(Hz.M, K.baglam(Hz.ctx));
    const olc1 = say ? (t) => { say.n++; return O.olc1(t); } : O.olc1;
    const it = K.tarayici({ G: Hz.M.G, adaylar: Hz.aday, sabit: Hz.sabit, ctx: Hz.ctx, olc1, olc2: O.olc2, enIyi: 25, tam: false });
    it.adim(Infinity);
    PS._mntParamSonucKaydet(n.id, Hz, O, it.depo());
    return { Hz, S: it.sonuc() };
  }
  const ozet = (n) => {
    const Hz = P._mntParamHazirlik(n), c = K.baglam(Hz.ctx), ent = PS._MNT_PARAM_SONUC[n.id];
    return { Hz, c, ent, Z: PS._mntParamOzet(ent, c) };
  };
  const bitler = () => KR.map((q) => 1 << K.KISITLAR.findIndex((Q) => Q.k === q));
  const basliklar = (d) => [...d.querySelectorAll('.ve-fp-kat[data-k="sonuc"] .ve-fp-sect > b')].map((b) => b.textContent);

  // ISITICI (2026-10-18): tarama bitince Sonuç ayrı dilimlerde belleğe alınır
  // (koşucu), pencere kurulumu yalnız birleştirir. Galerinin diyagramları
  // pencerede HİÇ çizilmez — yalnız tam ekranda açılınca.
  test('ISITICI: üç adım (özet · K1’in ölçümü · bölüm); pencere kurulumu ne çizer ne ölçer; anahtar önce ve sonra aynı', () => {
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
      const d = dom(P._mntParamEskiPencereHTML(n));
      expect(d.querySelectorAll('.ve-fp-kat[data-k="sonuc"] svg.ve-pd').length).toBe(2);
    } finally { Object.keys(asil).forEach((k) => { C[k] = asil[k]; }); ent.O.olc1 = olc1; }
    expect(say).toEqual([]);
    expect(olcSay).toBe(0);
  });

  // Kullanıcı (2026-11-10): "Bu bileşen çok eski kalmış … güncel ve modern bir hale
  // getirelim." Önce: Öneri · Kriterler (ek kısıtlarla) · Modlar · Statik sehim ·
  // Yakın seçenekler · Eleme · on diyagram; uzlaşıyla sıralı, Excel'den ayrı.
  test('YAPI: altı bölüm, iki grafik; dokuz diyagram yalnız listede; uzlaşı, yakın seçenek, ek kısıt yok', () => {
    const n = kur(), { S } = taraSakla(n);
    expect(S.N).toBe(216);
    expect(S.uygunN).toBeGreaterThan(1);
    const d = dom(P._mntParamEskiPencereHTML(n));
    expect(basliklar(d)).toEqual(['Konfigürasyonlar', 'K1', 'Modlar', 'Statik sehim ve iletilebilirlik', 'Kriterleri sağlayan', 'Diyagramlar']);
    const kat = d.querySelector('.ve-fp-kat[data-k="sonuc"]');
    expect(kat.getAttribute('data-d')).toBe('ok');
    expect([...kat.querySelectorAll('.ve-pd-kap svg.ve-pd')].map((s) => s.parentElement.getAttribute('data-pd'))).toEqual(['mod', 'dag']);
    expect(kat.querySelector('[data-3b], .ve-pd-kesit, .ve-pd-tam')).toBeNull();
    expect(PS._MNT_PRM_DIYAGRAM.map((x) => x[1])).toEqual(['Pareto cephesi', 'Mod yerleşimi', 'Bağlayıcı kriterler', 'Ana etkiler',
      'Kriter haritaları', 'İletilebilirlik haritası', 'Kriter penceresi', 'Tepki yüzeyi', 'Tasarım uzayı']);
    expect([...kat.querySelectorAll('.ve-prm-dg')].map((b) => b.textContent)).toEqual(PS._MNT_PRM_DIYAGRAM.map((x) => x[1]));
    ['Uzlaşı', 'Öneri', 'Yakın seçenekler', 'Eleme', 'En az ihlalli', 'Sürünme', 'Kısıt', 'kısıt'].forEach((w) =>
      expect([w, kat.textContent.includes(w)]).toEqual([w, false]));
    expect(kat.textContent).not.toMatch(/(^|[^\p{L}\p{N}])E[1-9](?![\p{L}\p{N}])/u);
    const em = [...d.querySelectorAll('.ve-fp-sect')].find((s) => s.querySelector('b').textContent === 'K1').querySelector('em');
    expect(em.textContent).toBe('En uygun');
    expect(d.querySelector('#ve-mnt-param-durum-pa').textContent).toBe('Uygun ' + S.uygunN + ' / 216');
    expect(kat.innerHTML).not.toMatch(/NaN|undefined|Infinity/);
  });

  test('KONFİGÜRASYONLAR: K0 mevcut, K1… dört kesin kriteri sağlayanlar en küçük statik sehimden (kaba kuvvet hakemi); uygunluk ve işaretler hükmün kendisi', () => {
    const n = kur(); taraSakla(n);
    const { c, ent, Z } = ozet(n), D = ent.D, Hk = Z.Hk, B = bitler();
    const L = PS._mntParamKonfig(ent, Z, c), bek = hakemK(D, Hk);
    const boz = (x) => B.filter((b) => Hk.m[x] & b).length;
    expect(L.map((k) => k.K)).toEqual([0].concat(bek.map((x, i) => i + 1)));
    expect(L.slice(1).map((k) => k.idx)).toEqual(bek);
    expect(bek.length).toBe(Math.min(9, Z.S.uygunN));                      // uygun varsa yalnız uygunlar
    let en = true;
    L.slice(1).forEach((k) => {
      const ok = boz(k.idx) === 0;
      expect(k.kriter).toEqual(B.map((b) => !(Hk.m[k.idx] & b)));
      expect(k.uygunluk).toBe(ok ? (en ? 'En uygun' : 'Uygun') : 'Uygun değil');
      expect([k.d, k.T]).toEqual([D.d[k.idx], D.T[k.idx]]);
      if (ok) en = false;
    });
    const R = K.hepsi(ent.mevcut.o1, ent.mevcut.o2, c).sonuc;
    expect(L[0].kriter).toEqual(KR.map((q) => R[q].ok));
    expect(L[0].uygunluk).toBe(L[0].kriter.every(Boolean) ? 'Uygun' : 'Uygun değil');
    // pencere: on satır, seçili K1; işaretler kriterin hükmü; adlar ayırt edici kısa tiplerle
    const d = dom(P._mntParamEskiPencereHTML(n));
    const sat = [...d.querySelectorAll('.ve-prm-k')];
    expect(sat.map((b) => b.getAttribute('data-k'))).toEqual(L.map((k) => String(k.K)));
    expect(sat.map((b) => b.getAttribute('aria-selected'))).toEqual(L.map((k) => String(k.K === 1)));
    const ks = PS._mntPrmKisaF(ent);
    sat.forEach((b, i) => {
      expect(b.querySelector('.ve-prm-k-uy').textContent).toBe(L[i].uygunluk);
      expect([...b.querySelectorAll('.ve-prm-k-kr > span')].map((s) => s.getAttribute('data-ok'))).toEqual(L[i].kriter.map(String));
      expect([...b.querySelectorAll('.ve-prm-k-ad .t')].map((s) => s.textContent)).toEqual(PS._mntPrmKAdi(ent, L[i]).map(ks));
    });
    expect(new Set(sat.map((b) => b.querySelector('.ve-prm-k-ad').textContent)).size).toBe(sat.length);
  });

  // EXCEL = PENCERE: Excel'in Özet'i ve Sonuç'u pencerenin listesinden (aynı işlev);
  // K adı (Özet'in bağlantısı) pencerenin satırındaki kısa tiplerle.
  test('EXCEL = PENCERE: Özet’in konfigürasyonları pencerenin listesi — K, uygunluk, kriter, statik sehim ve ad', () => {
    const n = kur(); taraSakla(n);
    const { Hz, c, ent, Z } = ozet(n), L = PS._mntParamKonfig(ent, Z, c);
    const plan = PS._mntParamExcelPlan(ent, Hz);
    plan.adim.slice(0, L.length).forEach((f) => f());
    const E = plan.E(), X = global.veMntParamExcel;
    expect(E.konfig.map((k) => [k.K, k.uygunluk, k.kriter, k.d])).toEqual(L.map((k) => [k.K, k.uygunluk, k.kriter, k.d]));
    const evren = [];
    E.konfig.forEach((k) => evren.push(...k.tipler));
    E.tarama.adaylar.forEach((A) => evren.push(...A));
    const xk = X.ayirici(evren), pk = PS._mntPrmKisaF(ent);
    L.forEach((k, i) => {
      if (k.mevcut) return;
      expect(X.sayfaAdi(E.konfig[i], E.konfig[i].tipler, xk)).toBe('K' + k.K + ' ' + PS._mntPrmKAdi(ent, k).map(pk).join(' + '));
    });
  });

  test('SEÇİM: K’ya tık seçilen bölümü o K’nın yapar; seçim görünüm durumu (modele ve geri-al yığınına yazılmaz)', () => {
    const n = kur(); taraSakla(n);
    const { c, ent, Z } = ozet(n), L = PS._mntParamKonfig(ent, Z, c);
    global.saveState = jest.fn(); global.showNodeProperties = jest.fn();
    const veri = JSON.stringify(global.nodes.map((x) => x.data));
    const ks = Math.min(3, L.length - 1);
    expect(ks).toBeGreaterThan(1);
    PS.veMntParamKSec('pa', ks);
    expect(global.showNodeProperties).toHaveBeenCalledWith(n);
    const d = dom(P._mntParamEskiPencereHTML(n));
    expect(basliklar(d)[1]).toBe('K' + ks);
    expect(d.querySelector('.ve-prm-k[aria-selected="true"]').getAttribute('data-k')).toBe(String(ks));
    expect(d.querySelector('table.ve-prm-kriter thead th:last-child').textContent).toBe('K' + ks);
    const ad = PS._mntPrmKAdi(ent, L[ks]), ad0 = PS._mntPrmKAdi(ent, L[0]);
    let degisen = 0;
    [...d.querySelectorAll('.ve-prm-og-s')].forEach((r, i) => {
      expect(r.querySelector('.ve-prm-og-g').textContent).toBe(ent.M.G[i].ad);
      if (ad[i] === ad0[i]) expect(r.querySelector('.ayni').textContent).toBe(ad[i]);
      else { degisen++; expect(r.querySelector('b').textContent).toBe(ad[i]); expect(r.querySelector('s').textContent).toBe(ad0[i]); }
    });
    expect(degisen).toBeGreaterThan(0);
    PS.veMntParamKSec('pa', 0);                                             // K0: uygulanacak bir şey yok, tek sütun
    const d0 = dom(P._mntParamEskiPencereHTML(n));
    expect(basliklar(d0)[1]).toBe('K0 · Mevcut');
    expect(d0.querySelector('.ve-prm-eylem [data-uygula]')).toBeNull();
    expect([...d0.querySelectorAll('table.ve-prm-kriter thead th')].map((t) => t.textContent)).toEqual(['Kriter', 'Sınır', 'K0']);
    expect(global.saveState).not.toHaveBeenCalled();
    expect(JSON.stringify(global.nodes.map((x) => x.data))).toBe(veri);
  });

  // KRİTERLER = HÜKÜM: satırın işareti sıranın kullandığı hüküm — seçilende DEPONUN
  // ölçüsü, K0'da taramanın ölçücüsüyle hepsi(); yazılan sayı ölçünün kendisi
  // (gösterilen ondalığın yarım adımı içinde).
  test('KRİTERLER: dört satır; işaret ve sayı hükmün kendisi — seçilen depodan, K0 hepsi() ile', () => {
    const oku = require('../../js/sayi.js').veSayiOku;
    const n = kur(); taraSakla(n);
    const { c, ent, Z } = ozet(n), L = PS._mntParamKonfig(ent, Z, c), idx = L[1].idx, D = ent.D;
    const d = dom(P._mntParamEskiPencereHTML(n));
    const hm = K.hepsi(ent.mevcut.o1, ent.mevcut.o2, c).sonuc, ho = {};
    KR.forEach((q) => { ho[q] = K.hukum(q, D.X[q][idx], c); });
    const isaret = (td) => (td.querySelector('.ve-durum-ok') ? true : td.querySelector('.ve-durum-err') ? false : null);
    const satir = [...d.querySelectorAll('table.ve-prm-kriter tbody tr')];
    expect(satir.map((r) => r.getAttribute('data-k'))).toEqual(KR);
    let sayili = 0;
    satir.forEach((r) => {
      const k = r.getAttribute('data-k'), td = r.querySelectorAll('td');
      [['m', hm, td[2]], ['o', ho, td[3]]].forEach(([yan, h, hucre]) => {
        expect([k, yan, isaret(hucre)]).toEqual([k, yan, h[k].ok]);
        expect([k, yan, hucre.classList.contains('kr')]).toEqual([k, yan, !h[k].ok]);
        const m = hucre.textContent.match(/−?[\d.]+(,\d+)?/);
        if (!m || k === 'k1b') return;
        const v = h[k].deger * (k === 'k2' ? 100 : 1), ond = m[1] ? m[1].length - 1 : 0;
        expect([k, yan, Math.abs(oku(m[0]) - v) <= 0.5 * Math.pow(10, -ond) + 1e-9]).toEqual([k, yan, true]);
        sayili++;
      });
    });
    expect(sayili).toBeGreaterThanOrEqual(6);
    expect(satir.filter((r) => r.querySelectorAll('td')[2].classList.contains('kr')).length).toBeGreaterThan(0);  // ASFAT'ın mevcut tasarımı Kriter 1'i bozuyor
    expect(satir.filter((r) => r.querySelectorAll('td')[3].classList.contains('kr')).length).toBe(0);        // K1 En uygun
  });

  // SINIRDA YAZIM: yuvarlanınca sınıra eşit çıkan değer ondalığını uzatır.
  test('SINIRDA YAZIM: değer sınırla aynı görünmez; tam eşitlik ve sayı olmayan değer', () => {
    expect(PS._mntPrmYaz(4.996, 5, 1)).toBe('4,996');
    expect(PS._mntPrmYaz(5.004, 5, 2)).toBe('5,004');
    expect(PS._mntPrmYaz(4.9, 5, 1)).toBe('4,9');
    expect(PS._mntPrmYaz(15, 15, 1)).toBe('15,0');
    expect(PS._mntPrmYaz(NaN, 5, 1)).toBe('—');
  });

  // MODLAR: kırmızı çentik = kesin kriteri bozan mod. Hakem modların KENDİSİNDEN üç
  // kural: Kriter 1 (≥ 0,5·f_ateş), 1a (komşuya ≤ 0,5 Hz), 1b (8–10 Hz).
  test('MODLAR: K0 ve seçilen; kırmızı çentikler üç kuralın kendisi ve kriter tablosuyla tutarlı; tolerans açıkken köşeler de', () => {
    const kontrol = (ent, c, sec) => {
      const Z = PS._mntParamOzet(ent, c), L = PS._mntParamKonfig(ent, Z, c), k = L[sec], k1 = K.K1_ORAN * c.fAtes;
      const V = PS._mntPrmModV(ent, Z, c, k.mevcut ? -1 : k.idx, 'K' + k.K);
      expect(V.satir.map((r) => r.ad)).toEqual(k.mevcut ? ['K0'] : ['K0', 'K' + k.K]);
      V.satir.forEach((r) => {
        const kos = [r.f].concat(r.kose ? [r.kose.a, r.kose.b] : []);
        const hakem = r.f.map((v, i) => kos.some((f) => f[i] >= k1 || (f[i] >= 8 && f[i] <= 10)
          || f.some((w, j) => j !== i && Math.abs(w - f[i]) <= K.K1A_HZ)));
        expect(r.kotu).toEqual(hakem);
      });
      const modal = (kk) => kk.kriter.slice(0, 3).some((x) => !x);         // Kriter 1 · 1a · 1b
      expect(V.satir[0].kotu.some(Boolean)).toBe(modal(L[0]));
      if (!k.mevcut) expect(V.satir[1].kotu.some(Boolean)).toBe(modal(k));
      return V;
    };
    const n = kur(); taraSakla(n);
    const o = ozet(n);
    const V = kontrol(o.ent, o.c, 1);
    expect(V.satir[0].kotu.some(Boolean)).toBe(true);                       // mevcut: 19,2 Hz ≥ 15 Hz
    expect(V.satir[1].kotu.some(Boolean)).toBe(false);                      // K1 En uygun
    expect(V.satir.every((r) => r.kose === null)).toBe(true);
    kontrol(o.ent, o.c, 0);
    const n2 = kur({ acik: { tolerans: true } }); taraSakla(n2);
    const o2 = ozet(n2);
    const Vt = kontrol(o2.ent, o2.c, 1);
    expect(Vt.satir.every((r) => r.kose && r.kose.a.length === r.f.length)).toBe(true);
    // yalnız köşesi bozan mod: anma 7,6 Hz bandın dışında, sert köşe 8,1 Hz içinde
    const c = K.baglam({ fAtes: 30 });
    const sentetik = { mevcut: { o1: { f: [5.5, 7.6, 12], sert: { f: [5.9, 8.1, 12.9] }, yumusak: { f: [5.1, 7.0, 11.1] } } }, olc: {} };
    const Vs = PS._mntPrmModV(sentetik, { S: { sira: [], uygunN: 0 } }, c, -1);
    expect(Vs.satir[0].kotu).toEqual([false, true, false]);
  });

  test('KRİTERLERİ SAĞLAYAN: çözülen, kriter başına tek başına sağlayan ve dördünü birden sağlayan — özetin sayıları', () => {
    const oku = require('../../js/sayi.js').veSayiOku;
    const n = kur(), { S } = taraSakla(n);
    const d = dom(P._mntParamEskiPencereHTML(n));
    const sat = [...d.querySelectorAll('table.ve-prm-eleme tbody tr')].map((r) => [r.children[0].textContent, oku(r.children[1].textContent)]);
    const coz = S.N - S.hata;
    expect(sat).toEqual([['Çözülen', coz]].concat(KR.map((q) => ['Kriter ' + K.KISITLAR.find((Q) => Q.k === q).no + ' · ' + P._MNT_PARAM_KRITER_AD[q], coz - S.red[q]]),
      [['Dört kriter', S.uygunN]]));
    // dört kriter: hakem, depodan
    const { ent, Z } = ozet(n), B = bitler();
    let say = 0;
    for (let x = 0; x < ent.D.N; x++) if (ent.D.d1[x] === 1 && !B.some((b) => Z.Hk.m[x] & b)) say++;
    expect(say).toBe(S.uygunN);
  });

  test('UYGUN YOK: bütün K’lar Uygun değil, ilki K1; kriter tablosunda K1 kırmızı; grafikler K adıyla', () => {
    PS.veMntParamUnut();
    modelKur('kamyon');
    const n = { id: 'pa', type: 'mnt-parametric', data: {} };
    global.nodes.push(n);
    const { S } = taraSakla(n);
    expect(S.uygunN).toBe(0);
    const { c, ent, Z } = ozet(n), L = PS._mntParamKonfig(ent, Z, c);
    L.slice(1).forEach((k) => expect(k.uygunluk).toBe('Uygun değil'));
    const d = dom(P._mntParamEskiPencereHTML(n));
    expect(basliklar(d)[1]).toBe('K1');
    expect([...d.querySelectorAll('.ve-fp-sect')].find((s) => s.querySelector('b').textContent === 'K1').querySelector('em').textContent).toBe('Uygun değil');
    expect(d.querySelectorAll('table.ve-prm-kriter td:last-child.kr').length).toBeGreaterThan(0);
    expect(d.querySelector('.ve-pd-kap[data-pd="mod"]').textContent).toContain('K1');
    expect(d.querySelector('.ve-pd-kap[data-pd="dag"]').textContent).toContain('K1');
    expect(d.querySelector('#ve-mnt-param-durum-pa').textContent).toBe('Uygun 0 / ' + S.N);
  });

  test('ESKİME: model · aday · sabit grup · toleransın açıklığı ve açıkken değeri eskitir; kapalı toleransın değeri · çözüm · eski projenin ek kısıtı eskitmez', () => {
    const taze = (n) => PS._mntParamSonucDurum('pa', P._mntParamHazirlik(n)).taze;
    const dene = (fn, beklenen, data) => { const n = kur(data); taraSakla(n); fn(n); return [beklenen, taze(n)]; };
    const sonuc = [
      dene(() => { global.nodes.find((x) => x.type === 'mnt-mount').data.x += 5; }, false),
      dene(() => { global.nodes.find((x) => x.type === 'mnt-motor').data.mass += 1; }, false),
      dene(() => { P.veMntParamAday('pa', ADAY[5], false); }, false),
      dene(() => { P.veMntParamSabit('pa', 1, true); }, false),
      dene(() => { P.veMntParamToleransAc('pa', true); }, false),
      dene(() => { P.veMntParamTolerans('pa', '25'); }, false, { acik: { tolerans: true } }),
      dene(() => { P.veMntParamTolerans('pa', '25'); }, true),             // tolerans kapalıyken değeri taramaya girmez
      dene((n) => { n.data.acik = { darbe: true, sehim: true }; n.data.sinir = { sehimUst: 1, surunme: 50, agirlik: 0 }; }, true),
      dene(() => { const s = global.nodes.find((x) => x.type === 'mnt-solver'); global._veMntLast = cp._mntComputeResults(s.id); }, true)
    ];
    sonuc.forEach((x, i) => expect([i, x[1]]).toEqual([i, x[0]]));
    // eskimiş tarama: Sonuç yalnız durumu yazar, eksik bandında
    const n = kur(); taraSakla(n); P.veMntParamToleransAc('pa', true);
    const d = dom(P._mntParamEskiPencereHTML(n));
    const kat = d.querySelector('.ve-fp-kat[data-k="sonuc"]');
    expect(kat.getAttribute('data-d')).toBe('eksik');
    expect(kat.querySelector('svg')).toBeNull();
    expect(kat.textContent).toContain('Taramadan sonra girdi değişti');
    expect(d.querySelector('.ve-fp-eksik').textContent).toContain('Taramadan sonra girdi değişti');
  });

  // GALERİ: dokuz diyagram tam ekranda, yalnız açılınca çizilir; soldaki listeden
  // geçiş AYNI katmanda; kesit, büyüklük ve kamera seçimi GÖRÜNÜM durumu —
  // modelde değil (geri-al yığınına ve düğüme yazılmaz).
  test('GALERİ: ray geçişi aynı katmanda; seçimler galeriye yansır ve modele yazılmaz; dört kriterin kodu ve adı', () => {
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
      expect([...document.querySelectorAll('.ve-pd-kod dt')].map((x) => x.textContent)).toEqual(['K1', 'K1a', 'K1b', 'K2']);
      expect([...document.querySelectorAll('.ve-pd-kod dd')].map((x) => x.textContent)).toEqual(KR.map((q) => P._MNT_PARAM_KRITER_AD[q]));
      document.getElementById('ve-mnt-fs-x').click();
      expect(kat().length).toBe(0);
      PS.veMntParamTamEkran('pa', 'd2');                                    // kapandıktan sonra yeniden açılır
      expect(kat().length).toBe(1);
      expect(basili()).toEqual(['d2']);
      expect(ciz().getAttribute('aria-label')).toBe('Kriter penceresi');
      document.getElementById('ve-mnt-fs-x').click();
    } finally {
      eski.forEach(([ad, e]) => { if (e) Object.defineProperty(HTMLElement.prototype, ad, e); else delete HTMLElement.prototype[ad]; });
    }
  });

  test('proje değişince taramalar ve görünüm seçimleri unutulur (topology.js → veResetSubtopoNav)', () => {
    const n = kur(); taraSakla(n);
    PS.veMntParamKesit('pa', 'cift', '0,1');
    global.showNodeProperties = jest.fn();
    PS.veMntParamKSec('pa', 4);
    expect(PS._mntParamSonucDurum('pa', P._mntParamHazirlik(n))).not.toBeNull();
    PS.veMntParamUnut();
    expect(PS._mntParamSonucDurum('pa', P._mntParamHazirlik(n))).toBeNull();
    expect(PS._MNT_PARAM_KESIT.pa).toBeUndefined();
    expect(PS._MNT_PARAM_SECIM.pa).toBeUndefined();
    const src = require('fs').readFileSync(require.resolve('../../js/topology.js'), 'utf8');
    const fn = src.slice(src.indexOf('function veResetSubtopoNav('), src.indexOf('\n}', src.indexOf('function veResetSubtopoNav(')));
    expect(fn).toContain('veMntParamUnut()');
  });

  test('RAPOR: Sonuç düğmesi indirir — pencerenin K listesi; eskimiş taramada indirmez', () => {
    const n = kur(); taraSakla(n);
    const indir = jest.fn();
    global._mntReportDownload = indir;
    global._mntReportEnsureAssets = (cb) => cb(true);
    PS.veMntParamRapor('pa');
    expect(indir).toHaveBeenCalledTimes(1);
    const html = indir.mock.calls[0][0];
    expect(html).toContain('K1 · En uygun: grup başına tip');
    expect(html).toContain(' · dört kesin kriteri sağlayan ');
    P.veMntParamToleransAc('pa', true);
    PS.veMntParamRapor('pa');
    expect(indir).toHaveBeenCalledTimes(1);
  });

  // MODELE UYGULA (kullanıcı turu 2026-10-19: "Öneriyi modele aktaran bir düğme yok;
  // altı takozun tipini tek tek değiştirdim"). Seçilen K tek tıkla taranan grupların
  // takozlarına — Takoz penceresinin yazıcısıyla, TEK geri-al adımında; sabit grup
  // yerinde. Tarama eskimez: uygulanan kombinasyon K0 olur.
  test('UYGULA: seçilen K Takoz penceresinin yazımıyla, tek geri-al adımı, sabit grup yerinde; tarama taze, K0 = uygulanan, düğme kapalı ve sebebi ipucunda', () => {
    const n = kur();
    P.veMntParamSabit('pa', 3, true);
    taraSakla(n);
    const { c, ent, Z } = ozet(n), L = PS._mntParamKonfig(ent, Z, c), idx = L[1].idx, t = ent.D.tipler(idx), G = ent.M.G;
    expect(t[2]).toBeNull();
    const tk = () => global.nodes.filter((x) => x.type === 'mnt-mount');
    const veri = () => JSON.stringify(tk().map((x) => x.data));
    const once = veri(), mev0 = JSON.stringify(ent.mevcut);
    const kopya = JSON.parse(JSON.stringify(global.nodes));                // beklenen: Takoz penceresinin yazıcısı
    G.forEach((g, i) => { if (t[i]) g.idler.forEach((id) => cp._mntLibUygula(kopya.find((x) => x.id === id).data, t[i])); });
    const bek = JSON.stringify(kopya.filter((x) => x.type === 'mnt-mount').map((x) => x.data));
    expect(bek).not.toBe(once);
    const sabit0 = G[2].idler.map((id) => JSON.stringify(global.nodes.find((x) => x.id === id).data));
    global.saveState = jest.fn(); global.showNodeProperties = jest.fn();
    expect(PS.veMntParamUygula('pa', idx)).toBe(4);                         // iki taranan grup × iki takoz
    expect(veri()).toBe(bek);
    expect(G[2].idler.map((id) => JSON.stringify(global.nodes.find((x) => x.id === id).data))).toEqual(sabit0);
    expect(global.saveState).toHaveBeenCalledTimes(1);
    expect(global.showNodeProperties).toHaveBeenCalledWith(n);
    expect(PS._mntParamSonucDurum('pa', P._mntParamHazirlik(n)).taze).toBe(true);
    expect(PS._MNT_PARAM_SONUC.pa).toBe(ent);
    expect(JSON.stringify(ent.mevcut.o1.f)).toBe(JSON.stringify(ent.O.olc1(t).f));   // K0 = uygulananın ölçümü
    const d = dom(P._mntParamEskiPencereHTML(n)), kat = d.querySelector('.ve-fp-kat[data-k="sonuc"]');
    expect(kat.getAttribute('data-d')).toBe('ok');
    expect(basliklar(d)[1]).toBe('K1');
    expect([...kat.querySelectorAll('.ve-prm-og-s em')].map((e) => e.textContent)).toEqual(['Aynı', 'Aynı', 'Sabit']);
    const hucre = (td) => [td.textContent, td.className];
    [...kat.querySelectorAll('table.ve-prm-kriter tbody tr')].forEach((r) => expect(hucre(r.children[2])).toEqual(hucre(r.children[3])));
    const b = kat.querySelector('.ve-prm-eylem button[data-uygula="' + idx + '"]');
    expect([b.getAttribute('aria-disabled'), b.getAttribute('title'), b.getAttribute('onclick')]).toEqual(['true', 'K1 modelde.', null]);
    expect(PS.veMntParamUygula('pa', idx)).toBe(0);                         // modeldeki kombinasyon: değişen yok, adım yok
    expect(global.saveState).toHaveBeenCalledTimes(1);
    // sıranın ikincisi: kendi kombinasyonu; K1'in düğmesi yeniden açık
    expect(PS.veMntParamUygula('pa', Z.S.sira[1].idx)).toBeGreaterThan(0);
    const d2 = dom(P._mntParamEskiPencereHTML(n));
    expect(d2.querySelector('.ve-prm-eylem button[data-uygula="' + idx + '"]').getAttribute('aria-disabled')).toBeNull();
    // geri-al: model eski hâline dönünce K0 da döner
    const eski = JSON.parse(once);
    tk().forEach((m, i) => { m.data = eski[i]; });
    expect(PS._mntParamSonucDurum('pa', P._mntParamHazirlik(n)).taze).toBe(true);
    expect(JSON.stringify(ent.mevcut)).toBe(mev0);
    // eskimiş taramada uygulanmaz
    P.veMntParamToleransAc('pa', true);
    expect(PS.veMntParamUygula('pa', idx)).toBe(0);
    expect(veri()).toBe(once);
  });

  // İMZA: taranan grubun tipi taramanın ölçüsüne girmez — her kombinasyon onu
  // kütüphaneden takar (_mntLibGirdiYaz). Değişince depo, aynı girdiyle YENİ
  // taramanın bit bit aynısı ve mevcut tasarım yeniden ölçülür. Sabit grubun
  // tipi her kombinasyona girer: eskitir.
  test('İMZA: taranan grubun tipi eskitmez — depo yeni taramanın aynısı, mevcut bugünkü model; sabit grubun tipi eskitir', () => {
    const n = kur(); taraSakla(n);
    const ent = PS._MNT_PARAM_SONUC.pa, D0 = ent.D, G = ent.M.G;
    const tk = (gi, j) => global.nodes.find((x) => x.id === G[gi].idler[j || 0]);
    cp._mntLibUygula(tk(0).data, 'amc137731');
    cp._mntLibUygula(tk(1, 1).data, 'TK040');                               // yasalı (nonlineer) tip, çiftin tek üyesi
    const Hz = P._mntParamHazirlik(n);
    expect(PS._mntParamSonucDurum('pa', Hz).taze).toBe(true);
    const O = P._mntParamOlcucu(Hz.M, K.baglam(Hz.ctx)), nl = Hz.M.G.map(() => null);
    expect(JSON.stringify(ent.mevcut)).toBe(JSON.stringify({ o1: O.olc1(nl), o2: O.olc2(nl) }));
    expect(ent.M).toBe(Hz.M);
    const it = K.tarayici({ G: Hz.M.G, adaylar: Hz.aday, sabit: Hz.sabit, ctx: Hz.ctx, olc1: O.olc1, olc2: O.olc2, enIyi: 25, tam: false });
    it.adim(Infinity);
    const imza = (D) => JSON.stringify(['T', 'd', 'fMin', 'fMax', 'd1', 'd2'].map((k) => Array.from(D[k]))
      .concat(K.KISITLAR.map((Q) => Array.from(D.X[Q.k]))));
    expect(imza(it.depo())).toBe(imza(D0));
    P.veMntParamSabit('pa', 3, true); taraSakla(n);
    expect(PS._mntParamSonucDurum('pa', P._mntParamHazirlik(n)).taze).toBe(true);
    cp._mntLibUygula(tk(2).data, 'amc137731');
    expect(PS._mntParamSonucDurum('pa', P._mntParamHazirlik(n)).taze).toBe(false);
  });

  // Aracın ileri yönü yük durumlarını çevirir (Çözücü'nün ayarı, 2026-11-02):
  // taramanın ölçüsü değişir, tarama eskir; geri alınınca yine taze.
  test('İMZA: Çözücü\'nün ileri yönü eskitir', () => {
    const n = kur(); taraSakla(n);
    const cz = global.nodes.find((x) => x.type === 'mnt-solver');
    expect(PS._mntParamSonucDurum('pa', P._mntParamHazirlik(n)).taze).toBe(true);
    cz.data.ileri = '+x';
    expect(PS._mntParamSonucDurum('pa', P._mntParamHazirlik(n)).taze).toBe(false);
    delete cz.data.ileri;
    expect(PS._mntParamSonucDurum('pa', P._mntParamHazirlik(n)).taze).toBe(true);
  });
});

// AMC KAPASİTESİ (2026-11-10): AMC tipleri üreticinin tablosundaki "Max. Load"u taşır
// (js/mount-amc.js); E4 (taşıma kapasitesi) ve E9 (darbe yükü ≤ 2 × anma, Paulstra)
// motorda o tiplerde ÖLÇÜLÜR (varsayılan bağlam). Pencere ek kısıtları sıralamaya
// katmaz (Excel'in kuralı): ASFAT'ın, altı adayla, Cone 67 50 ShA'lı kombinasyonu
// dört kesin kriteri sağlar ve E9'a takılmaz; kapasite Excel'in Tarama'sında veridir.
describe('AMC KAPASİTESİ — katalog yükü E4 · E9\'u ölçtürür (motor); pencere sıralamaya katmaz', () => {
  const ADAY = ['a26-a', 'amc137731', 'bmc-mount1-55sh', 'asfat-a', 'asfat-b', 'bmc-mount1-40sh'];
  const tara2 = (ctx) => {
    modelKur('asfat');
    const n = { id: 'pa', type: 'mnt-parametric', data: { haric: Object.keys(cp.veMntGetLibraryMap()).filter((k) => ADAY.indexOf(k) < 0) } };
    global.nodes.push(n);
    const Hz = P._mntParamHazirlik(n), cx = ctx ? Object.assign({ fAtes: Hz.M.fAtes }, ctx) : Hz.ctx;
    const O = P._mntParamOlcucu(Hz.M, K.baglam(cx));
    const it = K.tarayici({ G: Hz.M.G, adaylar: Hz.aday, sabit: Hz.sabit, ctx: cx, olc1: O.olc1, olc2: O.olc2, enIyi: 25, tam: true });
    it.adim(Infinity);
    return it.sonuc();
  };
  test('Cone 67 50 ShA 900 kg taşır; varsayılan bağlamda ASFAT\'ın tek uygun kombinasyonu E9\'da elenir, E9 kapalıyken uygun; pencerenin bağlamında sıradadır', () => {
    expect(cp.VE_MOUNT_LIBRARY.amc137731.maxLoad).toBe(900);
    const S = tara2({});
    const kalan = (k) => S.huni.find((h) => h.k === k).kalan;
    expect([S.N, kalan('kapasite'), kalan('darbe'), S.uygunN]).toEqual([216, 1, 0, 0]);
    const A = tara2({ acik: { darbe: false } });
    expect(A.uygunN).toBe(1);
    expect(A.sira[0].tipler).toContain('amc137731');
    const W = tara2();
    expect(W.huni.map((h) => h.k)).toEqual(['cozulen', 'k1', 'k1a', 'k1b', 'k2']);
    expect(W.uygunN).toBeGreaterThan(1);
    expect(W.sira.slice(0, W.uygunN).some((r) => JSON.stringify(r.tipler) === JSON.stringify(A.sira[0].tipler))).toBe(true);
  });
});


// ADAY OLMAYAN TİP (kullanıcı 2026-11-11, Canlı Not 133 · Parametrik Analiz › Adaylar › Diğer:
// dört 57RS tipi işaretlendi — *"Şu takozları kaldır."*): taramanın aday listesinde yoklar;
// Takoz Özellikleri'nin Tip listesinde, örneklerin eşleşmesinde ve anahtarla çözümde dururlar.
describe('ADAY OLMAYAN TİP — A26 · ASR-SR-116\'nın dört tipi taramanın adayı değil', () => {
  const DORT = ['a26-a', 'a26-b', 'asfat-a', 'asfat-b'];
  test('kütüphanede aday:false; birleşik haritada aday değil, Tip listesinde var', () => {
    const kod = require('fs').readFileSync(require('path').join(__dirname, '../../js/cp-mount.js'), 'utf8');
    DORT.forEach((k) => expect(kod).toMatch(new RegExp("'" + k + "':\\s*\\{ marka:'Diğer', aday:false,")));
    // Bu dosyanın donmuş kümesi bayrağı siler; harita bayrağı girdiden okur.
    const tip = { aday: false };
    expect(DORT.every((k) => cp.veMntGetLibraryMap()[k])).toBe(true);
    const M = { lib: Object.assign({}, cp.veMntGetLibraryMap()) };
    DORT.forEach((k) => { M.lib[k] = Object.assign({}, M.lib[k], tip); });
    const ad = P._mntParamAdaylar(M, null).map((a) => a.key);
    DORT.forEach((k) => expect(ad).not.toContain(k));
    expect(ad).toContain('TK040');
    const liste = cp.veMntGetLibraryList().map((e) => e.key);
    DORT.forEach((k) => expect(liste).toContain(k));
  });
});
