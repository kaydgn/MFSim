/**
 * mount-param-eleme.test.js — Parametrik Analiz · BEKLENEN TAKOZ SEHİMİYLE ELEME
 * ─────────────────────────────────────────────────────────────────────────
 * Kullanıcı (2026-11-13): "Tam parametrik analiz çalışmadan önce, program kullanıcıdan 'Çözücü'
 * bileşeninden ilk önce girdilere göre çözmesini istesin. Çözücü bileşeninden program girdilere göre
 * çözerken, bir yandan da program tüm takozları programdaki EN DÜŞÜK TAKOZ YÜKÜNE göre çözsün gizlice.
 * Ardından parametrik analiz bileşenine geldiğimizde, kullanıcıya 'beklenen takoz sehim' aralık değeri
 * sorulsun. Kullanıcı o aralık değeri girdiğinde, o aralık değerden dışında kalan takozlar otomatik
 * olarak elensin." Kapasite kullanılmaz.
 *
 * Kapılar (js/cp-mount.js → R.tipSehim · veMntTipSehim; js/cp-mount-param.js → _mntParamEleme):
 *   GİZLİ HESAP — Çözücü'nün çözümü en düşük takoz yükünü (Statik durum, yalnız takozlar) ve
 *                 kütüphanenin çözülebilen HER tipinin o yükteki sehimini taşır: doğrusal tipte
 *                 F/k_z, eğrili tipte yasanın tersi; Lineer çözüm modunda eğri yok; kütüphane
 *                 değişmez; çözümden sonra değişen tip yeniden hesaplanır
 *   PENCERE     — çözüm yok / eski: alanlar kapalı, durum ve yönlendirme, eleme yok; çözüm güncel +
 *                 aralık: aralığın dışındaki tipler elenir — aday listesi, sayılar, kombinasyon,
 *                 Özel kombinasyonun araması; geçersiz aralık durum; boş aralık eksik bandında
 *   AYAR        — makine biçimi, boş siler, düzenleme başına bir geri-al adımı
 *   YERİNDE     — çözüm gelince ve aralık yazılınca pencere kurulmaz, alan ve odak yerinde
 */
const H = require('../helpers/takoz-dogrulama.js');

const { cp, core } = H.kur();
Object.keys(cp).forEach((k) => { if (global[k] === undefined) global[k] = cp[k]; });
global.veMntKatalog = require('../../js/mount-katalog.js');
const P = require('../../js/cp-mount-param.js');
Object.keys(P).forEach((k) => { if (global[k] === undefined) global[k] = P[k]; });
global.veSayi = global.veSayi || require('../../js/sayi.js').veSayi;
global.veMntAkso = global.veMntAkso || require('../../js/mount-akso.js');
global.veIkon = global.veIkon || require('../../js/ikon.js').veIkon;

const dom = (h) => { const d = document.createElement('div'); d.innerHTML = h; return d; };
const tam6 = (e) => ['sx', 'sy', 'sz', 'dx', 'dy', 'dz'].every((f) => Number(e[f]) > 0);
const adayHakem = () => Object.values(cp.veMntGetLibraryMap()).filter((e) => e.aday !== false && tam6(e));
const bagil = (a, b) => Math.abs(a - b) / Math.max(1e-12, Math.abs(b));
const binlik = (v) => String(v).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
// Analiz'in alanları, etiketiyle
const analiz = (d) => Object.fromEntries([...d.querySelectorAll('.ve-fp-side .ve-fp-f')]
  .map((f) => [f.querySelector('.ve-fp-l').textContent, f.querySelector('input').value]));

// Örneği çözer (Çözücü'nün yolu) ve Parametrik Analiz düğümünü canlı modele ekler.
function cozKur(ad, data, topoDuzelt) {
  const t = H.ornek(ad);
  if (topoDuzelt) topoDuzelt(t);
  const R = H.coz(t);
  expect(R && !R.error).toBe(true);
  cp._veMntLast = R;
  const n = { id: 'pe', type: 'mnt-parametric', data: data || {} };
  global.nodes.push(n);
  return { R, n, T: R.tipSehim };
}
function cozumsuzKur(ad, data) {
  const t = H.ornek(ad);
  global.nodes = JSON.parse(JSON.stringify(t.nodes));
  global.connections = t.connections || [];
  cp._veMntLast = null;
  const n = { id: 'pe', type: 'mnt-parametric', data: data || {} };
  global.nodes.push(n);
  return n;
}
const statikYuk = (R) => R.allCases.find((c) => c.name === 'Static').res.perMount.map((pm) => -pm.f[2]);

// ═══════════════════════════════════════════════════════════════════════════
describe('GİZLİ HESAP — Çözücü en düşük takoz yükünde bütün tipleri çözer', () => {
  test('Tulga: referans yük Statik durumun en düşük takoz kuvveti; kütüphanenin çözülebilen her tipi', () => {
    const { R, T } = cozKur('tulga');
    const F = statikYuk(R), j = F.indexOf(Math.min(...F));
    expect(T).toBeTruthy();
    expect(T.F).toBe(F[j]);
    expect(T.yuk).toBeCloseTo(F[j] / 9.81, 12);
    expect([T.takoz, T.ad]).toEqual([R.mounts[j].id, R.mounts[j].name]);
    expect(T.ad).toBe('Sol Arka Takoz');
    expect(T.yuk).toBeGreaterThan(100);
    expect(T.lineer).toBe(false);
    // her takozun yükü referanstan büyük ya da eşit
    F.forEach((f) => expect(f).toBeGreaterThanOrEqual(T.F));
    // kapsam: aday tiplerin hepsi (bağımsız hakem), başka tip yok
    expect(Object.keys(T.d).sort()).toEqual(adayHakem().map((e) => e.key).sort());
    expect(Object.keys(T.d).length).toBeGreaterThan(200);
    Object.values(T.d).forEach((d) => expect(d).toBeGreaterThan(0));
  });

  test('askılı model: askı yayı ve nokta kütle takoz değil — en düşük yük takozlardan', () => {
    const { R, T } = cozKur('tta10askili');
    const st = R.allCases.find((c) => c.name === 'Static').res;
    expect(st.perHanger.length).toBe(2);
    expect(Math.min(...st.perHanger.map((h) => h.F))).toBeLessThan(T.F);         // askı daha az taşıyor: hesaba girmiyor
    expect(T.F).toBe(Math.min(...statikYuk(R)));
    expect(global.nodes.find((n) => n.id === T.takoz).type).toBe('mnt-mount');
  });

  test('doğrusal tipte sehim F/k_z; eğrili tipte yasanın F’yi taşıdığı sehim (ters denetim)', () => {
    const { T } = cozKur('tulga');
    const A = adayHakem();
    const dogrusal = A.filter((e) => !e.fitZ && !(Array.isArray(e.curveZ) && e.curveZ.length >= 2));
    const egri = A.filter((e) => !dogrusal.includes(e));
    expect(dogrusal.length).toBeGreaterThan(200);
    expect(egri.length).toBeGreaterThanOrEqual(4);
    expect(egri.some((e) => e.fitZ) && egri.some((e) => !e.fitZ)).toBe(true);    // fit ve nokta tablosu
    dogrusal.forEach((e) => expect(bagil(T.d[e.key], T.F / e.sz)).toBeLessThan(1e-12));
    // tersi: yasa (çekirdeğin, mm → m) hesaplanan sehimde referans kuvveti taşıyor
    egri.forEach((e) => {
      const law = e.fitZ ? core.makeAxisLaw(e.fitZ)
        : core.makeAxisLaw({ type: 'curve', points: e.curveZ.map((p) => [p[0] / 1000, p[1]]) });
      expect([e.key, bagil(-law.force(-T.d[e.key] / 1000), T.F) < 1e-9]).toEqual([e.key, true]);
      expect(Math.abs(T.d[e.key] - T.F / e.sz)).toBeGreaterThan(1e-3);          // doğrusal değil
    });
  });

  test('Lineer çözüm modu: eğri yok — her tip F/k_z', () => {
    const { T } = cozKur('tulga', {}, (t) => { t.nodes.find((n) => n.type === 'mnt-solver').data.solveMode = 'linear'; });
    expect(T.lineer).toBe(true);
    adayHakem().forEach((e) => expect(bagil(T.d[e.key], T.F / e.sz)).toBeLessThan(1e-12));
  });

  test('kütüphane değişmez; çözümden sonra değişen ya da eklenen tip yeniden hesaplanır', () => {
    const once = JSON.stringify(cp.VE_MOUNT_LIBRARY);
    const { T } = cozKur('tulga');
    expect(JSON.stringify(cp.VE_MOUNT_LIBRARY)).toBe(once);
    const e = adayHakem().find((x) => !x.fitZ && !x.curveZ);
    expect(cp.veMntTipSehim(T, e)).toBe(T.d[e.key]);
    const e2 = Object.assign({}, e, { sz: e.sz * 2 });
    expect(bagil(cp.veMntTipSehim(T, e2), T.F / e.sz / 2)).toBeLessThan(1e-12);
    const yeni = { key: 'ozel-x', sx: 300, sy: 300, sz: 600, dx: 390, dy: 390, dz: 780 };
    expect(bagil(cp.veMntTipSehim(T, yeni), T.F / 600)).toBeLessThan(1e-12);
    expect(T.d['ozel-x']).toBe(cp.veMntTipSehim(T, yeni));
  });

  test('yüksüz takoz: en düşük yük ≤ 0 → sehim yok', () => {
    const prep = { mounts: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], si: { g: 9.81 }, mode: 'auto' };
    const T = cp._mntTipSehimKur(prep, { res: { perMount: [{ f: [0, 0, -2000] }, { f: [0, 0, 50] }] } });
    expect([T.F, T.ad, Object.keys(T.d).length]).toEqual([-50, 'B', 0]);
    expect(cp.veMntTipSehim(T, adayHakem()[0])).toBeNaN();
    expect(cp._mntTipSehimKur(prep, { res: null })).toBeNull();
  });

  test('ters çözüm: 1 m’de de yükü taşımayan yasa sonsuz; doğrusalda tam F/k', () => {
    expect(cp._mntSehimTers(core.makeAxisLaw({ type: 'linear', k: 2e5 }), 1000)).toBeCloseTo(5, 12);
    // 500 N'de doyan eğri (uç eğimi sıfır) 1.000 N'yi hiç taşımaz; doğrusal uzantısı 1 m'yi aşan da
    const doyan = core.makeAxisLaw({ type: 'curve', points: [[-0.02, -500], [-0.01, -500], [0, 0], [0.01, 500]] });
    expect(cp._mntSehimTers(doyan, 1000)).toBe(Infinity);
    expect(cp._mntSehimTers(doyan, 250)).toBeGreaterThan(0);
    const yumusak = core.makeAxisLaw({ type: 'curve', points: [[-0.01, -500], [0, 0], [0.01, 500]] });
    expect(cp._mntSehimTers(yumusak, 1e9)).toBe(Infinity);
    expect(cp._mntSehimTers(yumusak, 250)).toBeCloseTo(5, 6);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('PENCERE — beklenen takoz sehimi', () => {
  beforeEach(() => { global.saveState = jest.fn(); global.showNodeProperties = jest.fn(); });
  const bolum = (d) => d.querySelector('.ve-fp-kat[data-k="sehim"]');
  const not = (d) => d.querySelector('#ve-mnt-param-sehim-not-pe').textContent;
  const alanlar = (d) => ['alt', 'ust'].map((u) => d.querySelector('#ve-mnt-param-sehim-' + u + '-pe'));
  const bant = (d) => [...d.querySelectorAll('#ve-fp-eksik-pe .ve-fp-eksik-t')].map((x) => x.textContent);

  test('bölüm Takoz yerleşimi ile Adaylar arasında; iki sayı alanı (en az · en çok, mm), Türkçe sayı alanı', () => {
    const n = cozumsuzKur('tulga', { sehim: { alt: 3, ust: 5.5 } });
    const d = dom(P.getMntParamPropertiesHTML(n));
    expect([...d.querySelectorAll('.ve-fp-kat')].map((k) => k.dataset.k)).toEqual(['yerlesim', 'sehim', 'aday']);
    expect(bolum(d).querySelector('.ve-fp-sect b').textContent).toBe('Beklenen takoz sehimi');
    expect([...bolum(d).querySelectorAll('.ve-fp-l')].map((l) => l.textContent)).toEqual(['En az [mm]', 'En çok [mm]']);
    alanlar(d).forEach((a) => expect([a.type, a.getAttribute('inputmode'), a.hasAttribute('data-mnt-izle'), a.hasAttribute('data-tazele')])
      .toEqual(['text', 'decimal', true, false]));
    expect(alanlar(d).map((a) => a.getAttribute('value'))).toEqual(['3', '5.5']);       // makine biçimi
    expect(bolum(d).querySelector('section').hasAttribute('data-cozum-durumu')).toBe(true);
  });

  test('ÇÖZÜM YOK: alanlar kapalı, sebebi notta; aralık girili olsa da eleme yok', () => {
    const n = cozumsuzKur('tulga', { sehim: { alt: 3, ust: 5 } });
    const Y = P._mntParamYeni(n), d = dom(P.getMntParamPropertiesHTML(n));
    expect(not(d)).toBe('Model çözülmedi. Çözücü penceresinde Hesapla ile çözün.');
    alanlar(d).forEach((a) => expect([a.disabled, a.getAttribute('aria-describedby')]).toEqual([true, 've-mnt-param-sehim-not-pe']));
    expect([Y.E.cozum, Y.E.aktif, Y.A.length]).toEqual(['yok', false, Y.Atum.length]);
    expect(Y.Atum.length).toBe(adayHakem().length);
    const A = analiz(d);
    expect([A['En düşük takoz yükü [kg]'], A['Elenen'], A['Aday tip']]).toEqual(['—', '—', binlik(Y.Atum.length)]);
    expect(bant(d)).toEqual([]);                                                        // aralık dolu: soru yok
  });

  test('BOŞ ARALIK: kullanıcıya sorulur — eksik bandı, çözümle de çözümsüz de aynı', () => {
    const n = cozumsuzKur('tulga');
    let d = dom(P.getMntParamPropertiesHTML(n));
    expect(bant(d)).toEqual(['Beklenen takoz sehimi — Aralık boş.']);
    expect(bolum(d).getAttribute('data-d')).toBe('eksik');
    const c = cozKur('tulga');
    d = dom(P.getMntParamPropertiesHTML(c.n));
    expect(bant(d)).toEqual(['Beklenen takoz sehimi — Aralık boş.']);
    expect(not(d)).toBe('');
    alanlar(d).forEach((a) => expect([a.disabled, a.hasAttribute('aria-describedby')]).toEqual([false, false]));
    expect(P._mntParamYeni(c.n).E.aktif).toBe(false);
    c.n.data = { sehim: { alt: 3 } };
    expect(bant(dom(P.getMntParamPropertiesHTML(c.n)))).toEqual(['Beklenen takoz sehimi — En çok boş.']);
    c.n.data = { sehim: { ust: 5 } };
    expect(bant(dom(P.getMntParamPropertiesHTML(c.n)))).toEqual(['Beklenen takoz sehimi — En az boş.']);
    expect(P._mntParamYeni(c.n).A.length).toBe(adayHakem().length);
  });

  // Canlı Not 1009: *"Bu yazıyı daha sadeleştirelim … Alt satıra inmesin, bir satırda halledelim."*
  // Eski satır durumun ardından sonucu da yazıyordu ("Aralık boş: aday tipler elenmez.") ve
  // pencerenin sütununda ikiye iniyordu. Satır yalnız DURUM: açıklama yok, üç sözcüğü geçmez.
  test('BANDIN SATIRI TEK DURUM (Canlı Not 1009): açıklamasız, kısa; Doldur aynı satırda', () => {
    const c = cozKur('tulga');
    [{}, { sehim: { alt: 3 } }, { sehim: { ust: 5 } }].forEach((data) => {
      c.n.data = data;
      const d = dom(P.getMntParamPropertiesHTML(c.n));
      const sat = d.querySelectorAll('#ve-fp-eksik-pe .ve-fp-eksik-s');
      expect(sat.length).toBe(1);
      const neden = sat[0].querySelector('.ve-fp-eksik-t').textContent.split(' — ')[1];
      expect(neden).not.toMatch(/[:;]/);
      expect(neden).not.toMatch(/elen/);
      expect(neden.replace(/\.$/, '').split(/\s+/).length).toBeLessThanOrEqual(3);
      expect(sat[0].querySelector('button').textContent.trim()).toBe('Doldur');
    });
  });

  test('ELEME (Tulga, 3–5 mm): aralığın dışındaki tip elenir — aday tip, elenen, kombinasyon, başlık; en düşük takoz yükü ipucunda takozun adıyla', () => {
    const { n, T } = cozKur('tulga', { sehim: { alt: 3, ust: 5 } });
    const hakem = adayHakem(), kal = hakem.filter((e) => T.d[e.key] >= 3 && T.d[e.key] <= 5).map((e) => e.key);
    expect(kal.length).toBeGreaterThan(10);
    expect(kal.length).toBeLessThan(hakem.length - 100);
    const Y = P._mntParamYeni(n), d = dom(P.getMntParamPropertiesHTML(n));
    expect([Y.E.cozum, Y.E.aktif]).toEqual(['tamam', true]);
    expect(Y.A.map((a) => a.key)).toEqual(kal);                                         // kütüphane sırası
    expect(Y.E.elenen.length).toBe(hakem.length - kal.length);
    expect([Y.say, Y.N]).toEqual([[kal.length, kal.length, kal.length], kal.length ** 3]);
    const A = analiz(d);
    expect(A['Aday tip']).toBe(binlik(kal.length));
    expect(A['Elenen']).toBe(binlik(hakem.length - kal.length));
    expect(A['Kombinasyon']).toBe(binlik(kal.length ** 3));
    expect(Number(A['Ölçülü rijitlik'].replace(/\./g, '')) + Number(A['Tahmini rijitlik'].replace(/\./g, ''))).toBe(kal.length);
    // kayıtlı = aday + elenen + rijitlik eksik + aday değil
    const say = (k) => Number(A[k].replace(/\./g, ''));
    expect(say('Aday tip') + say('Elenen') + say('Rijitlik eksik') + say('Aday değil')).toBe(say('Kayıtlı takoz'));
    expect(A['En düşük takoz yükü [kg]']).toBe(cp._mntS(T.yuk, 1));
    const yuk = [...d.querySelectorAll('.ve-fp-side .ve-fp-f')].find((f) => /En düşük/.test(f.textContent)).querySelector('input');
    expect(yuk.getAttribute('title')).toBe('Sol Arka Takoz');
    expect(d.querySelector('#ve-mnt-param-aday-em-pe').textContent).toBe(binlik(kal.length) + ' tip');
    expect([not(d), bant(d), bolum(d).getAttribute('data-d')]).toEqual(['', [], 'ok']);
    // aralığın ucu dâhil: tam uçtaki tip kalır
    const e = hakem.find((x) => kal.includes(x.key));
    n.data.sehim = { alt: T.d[e.key], ust: T.d[e.key] + 1e-9 };
    expect(P._mntParamYeni(n).A.map((a) => a.key)).toContain(e.key);
  });

  test('ÖZEL KOMBİNASYON: elenen tip listede ve aramada yok, sayılmaz, eklenmez; kayıtta kalır ve aralık değişince geri gelir', () => {
    const { n, T } = cozKur('tulga', { adaylarKip: 'ozel', sehim: { alt: 3, ust: 5 } });
    const Y = P._mntParamYeni(n), G = Y.M.G;
    const elenen = Y.E.elenen[0].key, kalan = Y.A.map((a) => a.key);
    expect(T.d[elenen] < 3 || T.d[elenen] > 5).toBe(true);
    expect(P._mntParamAra(P._mntParamListeSira(Y.A), '', []).map((a) => a.key).sort()).toEqual(kalan.slice().sort());
    n.data.adaylar = { [G[0].anahtar]: [elenen, kalan[0]] };
    expect(P._mntParamYeni(n).say).toEqual([1, 0, 0]);
    expect(P.veMntParamGrupAday('pe', 1, Y.E.elenen[1].key, true)).toBe(false);         // elenen tip eklenmez
    expect(n.data.adaylar).toEqual({ [G[0].anahtar]: [elenen, kalan[0]] });
    expect(P.veMntParamGrupAday('pe', 1, kalan[1], true)).toBe(true);
    const sira = Y.Atum.map((a) => a.key).filter((k) => [elenen, kalan[0], kalan[1]].includes(k));
    expect(n.data.adaylar[G[0].anahtar]).toEqual(sira);                                 // elenen kayıtta kaldı
    expect(P._mntParamYeni(n).say).toEqual([2, 0, 0]);
    const d = dom(P.getMntParamPropertiesHTML(n));
    // seçim listesi (Canlı Not 1012): seçili satırlar yalnız kalan tipler; elenen tipin satırı yok
    const L = d.querySelector('#ve-mnt-param-sec-pe-1');
    expect([...L.querySelectorAll('.ve-prm-sec-o[aria-checked="true"]')].map((b) => b.dataset.key).sort()).toEqual([kalan[0], kalan[1]].sort());
    expect([...L.querySelectorAll('.ve-prm-sec-o')].every((b) => kalan.includes(b.dataset.key))).toBe(true);
    expect(L.querySelector('[data-key="' + elenen + '"]')).toBeNull();
    expect(d.querySelector('#ve-mnt-param-oz-n-pe-1').textContent).toBe('2 tip');
    delete n.data.sehim;                                                                // aralık yok: geri gelir
    expect(P._mntParamYeni(n).say).toEqual([3, 0, 0]);
    expect(P.veMntParamGrupAday('pe', 1, elenen, false)).toBe(true);                    // kaldırmak her zaman
  });

  test('ESKİ ÇÖZÜM: model değişince alanlar kapalı, durum ve yönlendirme; eleme yok', () => {
    const { n } = cozKur('tulga', { sehim: { alt: 3, ust: 5 } });
    global.nodes.find((x) => x.type === 'mnt-mount').data.kzs = 999;
    const Y = P._mntParamYeni(n), d = dom(P.getMntParamPropertiesHTML(n));
    expect([Y.E.cozum, Y.E.aktif, Y.A.length]).toEqual(['eski', false, Y.Atum.length]);
    expect(not(d)).toBe('Model son hesaptan sonra değişti. Çözücü penceresinde Hesapla ile yeniden çözün.');
    alanlar(d).forEach((a) => expect(a.disabled).toBe(true));
    expect(analiz(d)['En düşük takoz yükü [kg]']).toBe('—');
  });

  test('GEÇERSİZ ARALIK: durum notta, bölüm işaretli, bantta değil; eleme yok', () => {
    const { n } = cozKur('tulga');
    [[{ alt: 5, ust: 3 }, 'En az, en çoktan küçük olmalı.'], [{ alt: 4, ust: 4 }, 'En az, en çoktan küçük olmalı.'],
     [{ alt: 0, ust: 3 }, 'Sınır sıfırdan büyük olmalı.'], [{ alt: -1, ust: 3 }, 'Sınır sıfırdan büyük olmalı.']].forEach(([c, metin]) => {
      n.data.sehim = c;
      const Y = P._mntParamYeni(n), d = dom(P.getMntParamPropertiesHTML(n));
      expect([not(d), bolum(d).getAttribute('data-d'), bant(d), Y.E.aktif, Y.A.length]).toEqual([metin, 'eksik', [], false, Y.Atum.length]);
      alanlar(d).forEach((a) => expect(a.disabled).toBe(false));
    });
  });

  test('YÜKSÜZ TAKOZ: en düşük yük ≤ 0 — durum takozun adıyla, alanlar kapalı, eleme yok', () => {
    const { n, R } = cozKur('tulga', { sehim: { alt: 3, ust: 5 } });
    R.tipSehim = Object.assign({}, R.tipSehim, { F: -10, yuk: -10 / 9.81, d: {}, yasa: {} });
    const Y = P._mntParamYeni(n), d = dom(P.getMntParamPropertiesHTML(n));
    expect([Y.E.cozum, Y.E.aktif, Y.A.length]).toEqual(['yuksuz', false, Y.Atum.length]);
    expect(not(d)).toBe('Sol Arka Takoz statik durumda yük taşımıyor.');
    alanlar(d).forEach((a) => expect(a.disabled).toBe(true));
  });

  test('takozsuz model: bölüm başlıklı ve boş, soru yok', () => {
    const n = cozumsuzKur('tulga');
    global.nodes = global.nodes.filter((x) => x.type !== 'mnt-mount');
    const d = dom(P.getMntParamPropertiesHTML(n));
    expect(bolum(d).querySelector('.ve-fp-sect b').textContent).toBe('Beklenen takoz sehimi');
    expect(bolum(d).querySelectorAll('input').length).toBe(0);
    expect(bant(d)).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('AYAR — veMntParamSehim', () => {
  test('makine biçimi; boş ve sayı olmayan ucu siler; iki uç boşsa alan yok; değişmeyen değer adım düşürmez', () => {
    const n = cozumsuzKur('tulga');
    global.saveState = jest.fn();
    expect(P.veMntParamSehim('pe', 'alt', '3,5')).toBe(true);
    expect(n.data.sehim).toEqual({ alt: 3.5 });
    expect(P.veMntParamSehim('pe', 'ust', '6.25')).toBe(true);
    expect(n.data.sehim).toEqual({ alt: 3.5, ust: 6.25 });
    expect(global.saveState).toHaveBeenCalledTimes(2);
    expect(P.veMntParamSehim('pe', 'ust', '6.25')).toBe(false);                         // aynı değer
    expect(P.veMntParamSehim('pe', 'xyz', '1')).toBe(false);                            // tanınmayan uç
    expect(P.veMntParamSehim('yok', 'alt', '1')).toBe(false);                           // olmayan düğüm
    expect(global.saveState).toHaveBeenCalledTimes(2);
    expect(P.veMntParamSehim('pe', 'ust', 'abc')).toBe(true);
    expect(n.data.sehim).toEqual({ alt: 3.5 });
    expect(P.veMntParamSehim('pe', 'alt', '  ')).toBe(true);
    expect(n.data).toEqual({});
    expect(global.saveState).toHaveBeenCalledTimes(4);
    expect(P.veMntParamSehim('pe', 'alt', '')).toBe(false);                             // zaten boş
    P.veMntParamSehim('pe', 'alt', '7');                                                 // geçersiz ilişki yazılır, durum söyler
    P.veMntParamSehim('pe', 'ust', '2');
    expect(n.data.sehim).toEqual({ alt: 7, ust: 2 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('YERİNDE — pencere kurulmaz, alan ve odak yerinde', () => {
  test('çözüm gelince alanlar açılır; aralık yazılınca sayılar, başlık ve bant tazelenir', () => {
    const t = H.ornek('tulga');
    const topo = JSON.parse(JSON.stringify(t));
    global.nodes = topo.nodes;
    global.connections = [];
    cp._veMntLast = null;
    const n = { id: 'pe', type: 'mnt-parametric', data: {} };
    global.nodes.push(n);
    global.saveState = () => cp.veMntPencereTazele();
    document.body.innerHTML = '<div class="ve-properties-content">' + P.getMntParamPropertiesHTML(n) + '</div>';
    const govde = document.querySelector('#ve-fp-panes-pe');
    const [alt, ust] = ['alt', 'ust'].map((u) => document.getElementById('ve-mnt-param-sehim-' + u + '-pe'));
    const yan = () => analiz(document);
    expect([alt.disabled, ust.disabled]).toEqual([true, true]);
    // Çözücü'nün çözümü canlı modelde (Hesapla'nın yolu: _mntComputeResults → veMntPencereTazele)
    const R = cp._mntComputeResults(global.nodes.find((x) => x.type === 'mnt-solver').id);
    expect(R && !R.error).toBe(true);
    cp.veMntPencereTazele();
    expect(document.getElementById('ve-mnt-param-sehim-alt-pe')).toBe(alt);
    expect([alt.disabled, ust.disabled, alt.hasAttribute('aria-describedby')]).toEqual([false, false, false]);
    expect(document.getElementById('ve-mnt-param-sehim-not-pe').textContent).toBe('');
    expect(yan()['En düşük takoz yükü [kg]']).toBe(cp._mntS(R.tipSehim.yuk, 1));
    expect(document.querySelectorAll('#ve-fp-eksik-pe').length).toBe(1);
    // en az yazılır, odak en çoğa geçer: ikisi de yerinde, odak kalır
    alt.focus();
    alt.value = '3';
    ust.focus();
    alt.dispatchEvent(new Event('change', { bubbles: true }));
    expect(n.data.sehim).toEqual({ alt: 3 });
    expect(document.activeElement).toBe(ust);
    expect(document.getElementById('ve-mnt-param-sehim-ust-pe')).toBe(ust);
    expect(document.querySelector('.ve-fp-eksik-t').textContent).toBe('Beklenen takoz sehimi — En çok boş.');
    ust.value = '5';
    ust.dispatchEvent(new Event('change', { bubbles: true }));
    expect(n.data.sehim).toEqual({ alt: 3, ust: 5 });
    expect(document.activeElement).toBe(ust);
    expect(document.querySelector('#ve-fp-panes-pe')).toBe(govde);                       // pencere kurulmadı
    expect(document.getElementById('ve-fp-eksik-pe')).toBeNull();
    const Y = P._mntParamYeni(n);
    expect(Y.E.aktif).toBe(true);
    expect([yan()['Aday tip'], yan()['Elenen'], yan()['Kombinasyon']])
      .toEqual([binlik(Y.A.length), binlik(Y.E.elenen.length), binlik(Y.A.length ** 3)]);
    expect(document.getElementById('ve-mnt-param-aday-em-pe').textContent).toBe(binlik(Y.A.length) + ' tip');
    // geçersiz aralık: not yerinde, alanlar açık
    ust.value = '2';
    ust.dispatchEvent(new Event('change', { bubbles: true }));
    expect(document.getElementById('ve-mnt-param-sehim-not-pe').textContent).toBe('En az, en çoktan küçük olmalı.');
    expect(yan()['Elenen']).toBe('—');
    expect(document.querySelector('.ve-fp-kat[data-k="sehim"]').getAttribute('data-d')).toBe('eksik');
    // model değişir (geri-al, başka pencere): yerinde tazelemede alanlar kapanır
    global.nodes.find((x) => x.type === 'mnt-mount').data.kzs = 999;
    cp.veMntPencereTazele();
    expect([alt.disabled, ust.disabled, ust.getAttribute('aria-describedby')]).toEqual([true, true, 've-mnt-param-sehim-not-pe']);
    expect(document.getElementById('ve-mnt-param-sehim-not-pe').textContent)
      .toBe('Model son hesaptan sonra değişti. Çözücü penceresinde Hesapla ile yeniden çözün. En az, en çoktan küçük olmalı.');
    // değer modelden (odakta olmayan ya da kapalı alan): geri-al aralığı geri getirir
    n.data.sehim = { alt: 3, ust: 5 };
    cp.veMntPencereTazele();
    expect([alt.value, ust.value]).toEqual(['3', '5']);
  });
});
