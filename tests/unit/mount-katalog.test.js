/**
 * mount-katalog.test.js — Parametrik Analiz · Katalogdan seçim, DOM'suz çekirdek
 * ─────────────────────────────────────────────────────────────────────────
 * Kullanıcı isteği (2026-10-16): "sağ ve sol takoz aynı tip olacak. Sadece
 * konumları, ön, orta, arka gibi takoz grupları farklı olacak … transmissibility
 * değeri ve takoz çökmeleri en iyi olan takozları seçeceğiz … Kütüphanedeki
 * her takoz her yere takılabilir."
 *
 * Kapılar (js/mount-katalog.js):
 *   GRUP      — ad (yan sözcüğü) önce, geometri yedek, tek takoz tek grup; ön → arka
 *   KISIT     — dört kesin kriterin sınır yönü programın uygunluk tablosununki
 *   PARETO    — kaba kuvvet hakemiyle (O(n²) baskınlık) birebir; eşitlik nicemli
 *   UZLAŞI    — en küçük uzaklık cephede; ağırlık uçlarında tek amaç
 *   TARAYICI  — her kombinasyon bir kez; parça parça = tek seferde; iki aşama;
 *               uygun yoksa en az ihlalli; huni tekdüze; tek başına ihlal sayısı hakemle
 * Gerçek modellerle "aynı yol" kapısı: mount-param.test.js.
 */
const K = require('../../js/mount-katalog.js');

const tk = (id, name, x, y, z, libKey) => ({ id, name, x, y, z, libKey: libKey || null });

describe('GRUP — sağ/sol çift, konum grubu', () => {
  test('ad eşleşmesi: yan sözcüğü çıkınca kalan ad aynıysa çift; söz dizimi ve büyük/küçük harf fark etmez', () => {
    const G = K.gruplar([
      tk('a', 'Sağ Ön Takoz', 0, 300, 400), tk('b', 'Sol Ön Takoz', 0, -300, 400),
      tk('c', 'Ön Sol · 57RS313774', -900, -50, 370), tk('d', 'Ön Sağ · 57RS313774', -900, 50, 370),
      tk('e', 'sağ arka', 600, 350, 600), tk('f', 'SOL ARKA', 600, -350, 600)]);
    expect(G.map((g) => [g.ad, g.idler.slice().sort().join('')])).toEqual([
      ['Ön Sağ/Sol · 57RS313774', 'cd'], ['Sağ/Sol Ön Takoz', 'ab'], ['sağ/sol arka', 'ef']]);
    expect(G.every((g) => g.cift)).toBe(true);
  });

  test('grubun adı tek boşlukla (ASFAT: "Ön Sol   · 57RS313774" — ekran birleştirir, ipucu birleştirmez)', () => {
    const G = K.gruplar([tk('a', 'Ön Sol   · 57RS313774', -900, -50, 370), tk('b', 'Ön Sağ   · 57RS313774', -900, 50, 370),
                         tk('c', '  Orta  takoz ', 0, 0, 300)]);
    expect(G.map((g) => g.ad)).toEqual(['Ön Sağ/Sol · 57RS313774', 'Orta takoz']);
  });

  test('orta hattaki "Ön Takoz", çiftin kalan adıyla AYNI olsa da tek başına grup (TULGA)', () => {
    const G = K.gruplar([
      tk('o', 'Ön Takoz', -196, 0.047, 180), tk('r', 'Sağ Ön Takoz', 440, 356, 500),
      tk('l', 'Sol Ön Takoz', 440, -356, 500)]);
    expect(G.map((g) => [g.ad, g.uyeler.length])).toEqual([['Ön Takoz', 1], ['Sağ/Sol Ön Takoz', 2]]);
  });

  test('adla eşleşmeyen iki takoz y\'de ayna ve x, z\'de aynıysa çift (≤ TOL_MM); fazlası iki tek grup', () => {
    const t = K.TOL_MM;
    expect(K.gruplar([tk('p', 'A', 100, 300, 50), tk('q', 'B', 100 + t, -300 + t, 50 - t)]).map((g) => g.ad)).toEqual(['A + B']);
    expect(K.gruplar([tk('p', 'A', 100, 300, 50), tk('q', 'B', 100 + t + 0.1, -300, 50)]).length).toBe(2);
    // orta hattaki iki takoz (|y| ≤ TOL) ayna sayılmaz
    expect(K.gruplar([tk('p', 'A', 100, 4, 50), tk('q', 'B', 100, -4, 50)]).length).toBe(2);
    // iki yan sözcüğü taşıyan ad belirsizdir → adla değil, geometriyle
    expect(K.yanAyir('Sağ-Sol köprü')).toBeNull();
  });

  test('gruplar önden arkaya (x artan), numara sırayla, anahtar üye kimliklerinden ve sıradan bağımsız', () => {
    const T = [tk('z9', 'Sağ Arka', 900, 300, 0), tk('a1', 'Sol Arka', 900, -300, 0), tk('m5', 'Şanzıman', 400, 0, 0)];
    const G = K.gruplar(T);
    expect(G.map((g) => [g.no, g.x])).toEqual([[1, 400], [2, 900]]);
    expect(G[1].anahtar).toBe('a1|z9');
    expect(K.gruplar(T.slice().reverse())[1].anahtar).toBe('a1|z9');
  });

  test('mevcut tip: üyelerin hepsi aynı kütüphane tipindeyse o, değilse null', () => {
    const G = K.gruplar([tk('a', 'Sağ X', 0, 300, 0, 'TK040'), tk('b', 'Sol X', 0, -300, 0, 'TK040'),
                         tk('c', 'Sağ Y', 500, 300, 0, 'TK040'), tk('d', 'Sol Y', 500, -300, 0, 'TK050')]);
    expect(G.map((g) => g.tip)).toEqual(['TK040', null]);
  });

  test('kombinasyon sayısı: taranan gruplar üzerinden çarpım; sabit grup girmez, hepsi sabitse 0', () => {
    const G = K.gruplar([tk('a', 'Sağ X', 0, 300, 0), tk('b', 'Sol X', 0, -300, 0), tk('c', 'Orta', 500, 0, 0)]);
    expect(K.kombinasyonSayisi(G, 27, {})).toBe(729);
    expect(K.kombinasyonSayisi(G, 27, { [G[0].anahtar]: true })).toBe(27);
    expect(K.kombinasyonSayisi(G, 27, { [G[0].anahtar]: true, [G[1].anahtar]: true })).toBe(0);
  });
});

describe('KISIT — dört kesin kriter programın uygunluk tablosuyla aynı yönde', () => {
  const c = K.baglam({ fAtes: 30 });
  const o = (f, T) => ({ f, T, dz: [-3, -4], pay: [100, 100], kap: [null, null] });
  const ok = (k, x) => K.degerlendir(x, c, 1).sonuc[k].ok;

  test('Kriter 1: f ≥ 0,5·f_ateş ihlal (sınırın kendisi ihlal), altı sağlıyor', () => {
    expect(ok('k1', o([5, 6, 7, 11, 12, 15], 0.1))).toBe(false);
    expect(ok('k1', o([5, 6, 7, 11, 12, 14.999999], 0.1))).toBe(true);
  });
  test('Kriter 1a: en küçük aralık > 0,5 Hz (0,5 ihlal)', () => {
    expect(ok('k1a', o([5, 5.5, 7, 11, 12, 14], 0.1))).toBe(false);
    expect(ok('k1a', o([5, 5.5001, 7, 11, 12, 14], 0.1))).toBe(true);
  });
  test('Kriter 1b: 8 ve 10 Hz bandın İÇİNDE (iki uç dâhil)', () => {
    expect(ok('k1b', o([5, 6, 8, 11, 12, 14], 0.1))).toBe(false);
    expect(ok('k1b', o([5, 6, 10, 11, 12, 14], 0.1))).toBe(false);
    expect(ok('k1b', o([5, 6, 7.999, 10.001, 12, 14], 0.1))).toBe(true);
  });
  test('Kriter 2: T ≥ %50 ihlal; T sonsuzsa (sönümsüz rezonans) ihlal ve ihlal büyüklüğü sonlu', () => {
    expect(ok('k2', o([5, 6, 7, 11, 12, 14], 0.5))).toBe(false);
    expect(ok('k2', o([5, 6, 7, 11, 12, 14], 0.4999))).toBe(true);
    const r = K.degerlendir(o([5, 6, 7, 11, 12, 14], Infinity), c, 1).sonuc.k2;
    expect(r.ok).toBe(false);
    expect(Number.isFinite(r.v) && r.v > 0).toBe(true);
  });

  test('dört kesin kriter kapatılamaz; ek kısıtların varsayılanı ve kapatılması', () => {
    const c2 = K.baglam({ fAtes: 30, acik: { k1: false, k2: false, sehim: false, ayrisma: true } });
    expect(c2.acik.k1 && c2.acik.k1a && c2.acik.k1b && c2.acik.k2).toBe(true);
    expect(c2.acik.sehim).toBe(false);
    expect(c2.acik.ayrisma).toBe(true);
    expect(K.baglam({ fAtes: 30 }).acik).toEqual(Object.assign({ k1: true, k1a: true, k1b: true, k2: true }, K.ACIK_VARSAYILAN));
  });

  test('sınır girdisi: geçersiz → varsayılan; ağırlık 0 ve 1 geçerli', () => {
    expect(K.baglam({ s: { sehimUst: -1, isletmeUst: 'x' } }).s.sehimUst).toBe(K.SINIR_VARSAYILAN.sehimUst);
    expect(K.baglam({ s: { agirlik: 0 } }).s.agirlik).toBe(0);
    expect(K.baglam({ s: { agirlik: 1 } }).s.agirlik).toBe(1);
    expect(K.baglam({ s: { agirlik: 1.2 } }).s.agirlik).toBe(K.SINIR_VARSAYILAN.agirlik);
  });

  test('ek kısıtlar: statik sehim |δ_z| ile, kapasite yalnız tanımlı takozda, çekme işletme durumlarında', () => {
    const cc = K.baglam({ fAtes: 30, s: { sehimUst: 5 } });
    const a = K.degerlendir({ f: [1], T: 0, dz: [-5, -4], pay: [400, 200], kap: [null, 150] }, cc, 1).sonuc;
    expect(a.sehim.ok).toBe(true);
    expect(a.kapasite.ok).toBe(false);
    expect(a.kapasite.deger).toBeCloseTo(200 / 150, 12);
    expect(K.degerlendir({ f: [1], T: 0, dz: [-5.01], pay: [1], kap: [null] }, cc, 1).sonuc.sehim.ok).toBe(false);
    expect(K.degerlendir({ f: [1], T: 0, dz: [-1], pay: [1], kap: [null] }, cc, 1).sonuc.kapasite.na).toBe(true);
    const b = K.degerlendir({ dIsl: [10, 9], cekmeMm: 0 }, cc, 2).sonuc;
    expect(b.isletme.ok && b.cekme.ok).toBe(true);
    const d = K.degerlendir({ dIsl: [10.001], cekmeMm: 0.2 }, cc, 2).sonuc;
    expect(d.isletme.ok || d.cekme.ok).toBe(false);
  });

  test('işletme yük durumu: 1 g düşey + ≤ 1 g yatay (tork dâhil); 3,5 g · bordür · geri esneme darbe', () => {
    expect(K.isletmeMi({ n: [0, 0, -1] })).toBe(true);
    expect(K.isletmeMi({ n: [-1, 0, -1] })).toBe(true);
    expect(K.isletmeMi({ n: [-0.4, 0.4, -1] })).toBe(true);
    expect(K.isletmeMi({ n: [0, 1, -1] })).toBe(true);
    expect(K.isletmeMi({ n: [0, 0, -3.5] })).toBe(false);
    expect(K.isletmeMi({ n: [-3, 0, -3.5] })).toBe(false);
    expect(K.isletmeMi({ n: [0, 1.55, -1] })).toBe(false);
    expect(K.isletmeMi({ n: [0, 0, 1] })).toBe(false);
  });
});

describe('KÖŞE ve EK KISIT — tolerans, alt sınırlar, darbe', () => {
  const c = K.baglam({ fAtes: 30, s: { sehimAlt: 3, sehimUst: 5, altMod: 5 } });
  const o = (f, T, dz) => ({ f, T, dz, pay: [1], kap: [null] });
  const ok = (k, x, cc) => K.degerlendir(x, cc || c, 1).sonuc[k];

  test('her kısıt kendi kötü köşesinde: frekans üstü ve T sertte, sehim ve alt frekans yumuşakta', () => {
    const anma = o([5.5, 6.5, 8.5, 11, 12, 14], 0.3, [-4]);
    const x = Object.assign({}, anma, { sert: o([5.9, 7, 9.1, 11.8, 12.9, 15.1], 0.55, [-3.5]), yumusak: o([5.1, 6, 7.8, 10.2, 11, 12.9], 0.2, [-5.1]) });
    expect([ok('k1', anma).ok, ok('k1', x).ok]).toEqual([true, false]);              // sert köşe 15,1 ≥ 15
    expect([ok('k2', anma).ok, ok('k2', x).ok]).toEqual([true, false]);              // sert köşe T 0,55
    expect([ok('sehim', anma).ok, ok('sehim', x).ok]).toEqual([true, false]);        // yumuşak köşe 5,1 > 5
    expect(ok('sehimAlt', x).deger).toBe(3.5);                                       // alt sınır sert köşede
    expect(ok('altMod', x).deger).toBe(5.1);
    expect(ok('k1b', x).deger).toBeCloseTo(0.501 + 0.901, 12);                       // anma 8,5 ve sert 9,1 bantta (derinlik)
  });

  test('statik sehim bandı: alt sınır en büyük sehime, iki uç dâhil', () => {
    expect(ok('sehimAlt', o([6], 0, [-3, -1])).ok).toBe(true);
    expect(ok('sehimAlt', o([6], 0, [-2.999, -1])).ok).toBe(false);
    expect(ok('sehim', o([6], 0, [-5, -1])).ok).toBe(true);
    expect(ok('altMod', o([5, 9], 0, [-4])).ok).toBe(true);
    expect(ok('altMod', o([4.999, 9], 0, [-4])).ok).toBe(false);
  });

  test('darbe yükü: kapasite yoksa değerlendirilmez; oran ≤ 2 sağlıyor', () => {
    const d = (r) => K.degerlendir({ dIsl: [1], cekmeMm: 0, darbeOran: r }, c, 2).sonuc.darbe;
    expect(d(null).na).toBe(true);
    expect(d(2).ok).toBe(true);
    expect(d(2.01).ok).toBe(false);
  });

  test('parametre aralıkları: sürünme 0 geçerli, tolerans 0 geçersiz, %50 üst sınır', () => {
    expect(K.baglam({ s: { surunme: 0 } }).s.surunme).toBe(0);
    expect(K.baglam({ s: { tolerans: 0 } }).s.tolerans).toBe(K.SINIR_VARSAYILAN.tolerans);
    expect(K.baglam({ s: { tolerans: 0.5 } }).s.tolerans).toBe(0.5);
    expect(K.baglam({ s: { tolerans: 0.51 } }).s.tolerans).toBe(K.SINIR_VARSAYILAN.tolerans);
    expect(K.baglam({}).acik.tolerans).toBe(false);
    expect(K.baglam({ acik: { tolerans: true } }).acik.tolerans).toBe(true);
  });
});

describe('PARETO ve UZLAŞI', () => {
  // Kaba kuvvet hakemi: a, b'yi baskılar ⇔ iki amaçta ≤ ve birinde <.
  const baskin = (a, b) => a.T <= b.T && a.d <= b.d && (a.T < b.T || a.d < b.d);
  const hakem = (P) => P.map((p) => !P.some((q) => q !== p && baskin(q, p)));
  let tohum = 7;
  const rnd = () => { tohum = (tohum * 16807) % 2147483647; return tohum / 2147483647; };

  test('rastgele kümelerde cephe kaba kuvvet hakemiyle birebir (eşit T ve eşit d dâhil)', () => {
    for (let n = 1; n <= 60; n++) {
      const P = Array.from({ length: n }, () => ({ T: Math.round(rnd() * 8) / 8, d: Math.round(rnd() * 8) / 2 }));
      expect(K.pareto(P)).toEqual(hakem(P));
    }
  });

  test('Σk_z aynı iki kombinasyonun T\'si son basamakta ayrışsa da baskın olan cepheye girmez', () => {
    const T = 0.1 + 0.2;                                  // 0.30000000000000004
    const P = [{ T: 0.3, d: 5 }, { T, d: 4 }, { T: 0.3, d: 4 }];
    expect(K.pareto(P)).toEqual([false, true, true]);
    expect(K.pareto([{ T: 0.3, d: 5 }, { T: T - 1e-15, d: 6 }])).toEqual([true, false]);
  });

  test('en küçük uzlaşı uzaklığı her zaman cephede; w = 1 yalnız T, w = 0 yalnız sehim', () => {
    for (let n = 2; n <= 40; n++) {
      const P = Array.from({ length: n }, () => ({ T: rnd(), d: 1 + 9 * rnd() }));
      const par = K.pareto(P);
      [0.2, 0.5, 0.8].forEach((w) => {
        const u = K.uzlasi(P, w).uz;
        expect(par[u.indexOf(Math.min(...u))]).toBe(true);
      });
      const u1 = K.uzlasi(P, 1).uz, u0 = K.uzlasi(P, 0).uz;
      expect(u1.indexOf(Math.min(...u1))).toBe(P.map((p) => p.T).indexOf(Math.min(...P.map((p) => p.T))));
      expect(u0.indexOf(Math.min(...u0))).toBe(P.map((p) => p.d).indexOf(Math.min(...P.map((p) => p.d))));
    }
  });
});

describe('TARAYICI', () => {
  // Sentetik model: grup başına tip anahtarı bir rijitliktir; T yumuşakta küçük, sehim büyük.
  const G = K.gruplar([tk('a', 'Sağ Ön', 0, 300, 0), tk('b', 'Sol Ön', 0, -300, 0),
                       tk('c', 'Sağ Arka', 800, 300, 0), tk('d', 'Sol Arka', 800, -300, 0), tk('e', 'Orta', 400, 0, 0)]);
  const A = [1, 2, 3, 4, 5].map((k) => ({ key: 'k' + k, name: 'Tip ' + k }));
  const kNum = (t) => (t ? Number(t.slice(1)) : 3);
  const sentetik = (izle) => ({
    olc1: (t) => {
      if (izle) izle.push(t.join(','));
      const k = t.map(kNum), s = k[0] * 2 + k[1] * 2 + k[2];
      return { f: [4, 5, 6, 7, 11, 5 + s / 2], T: s / 40, dz: k.map((x) => -12 / x), pay: [1, 1, 1], kap: [null, null, null] };
    },
    olc2: (t) => ({ dIsl: t.map((x) => 20 / kNum(x)), cekmeMm: 0 })
  });
  const kur = (ek) => Object.assign({ G, adaylar: A, sabit: {}, ctx: { fAtes: 40, s: { sehimAlt: 0.001, sehimUst: 8, altMod: 1 } }, enIyi: 10 }, sentetik(), ek || {});

  test('her kombinasyon bir kez ve sabit grup modelde olduğu gibi (null) ölçülür', () => {
    const izle = [];
    const it = K.tarayici(Object.assign(kur(), sentetik(izle), { sabit: { [G[1].anahtar]: true } }));
    expect(it.N).toBe(25);
    while (!it.adim(7).bitti);
    expect(new Set(izle).size).toBe(25);
    expect(izle.every((s) => s.split(',')[1] === '')).toBe(true);     // sabit grup null
  });

  test('parça parça adım ile tek seferde adım AYNI sonucu verir', () => {
    const a = K.tarayici(kur()); while (!a.adim(1).bitti);
    const b = K.tarayici(kur()); b.adim(Infinity);
    const sade = (S) => JSON.stringify(Object.assign({}, S, { sure: 0, olc: null }));
    expect(sade(a.sonuc())).toBe(sade(b.sonuc()));
  });

  test('iki aşama: olc2 yalnız birinci aşamayı geçenlerde; huni tekdüze; tek başına ihlal sayısı hakemle', () => {
    let n2 = 0;
    const P = kur({ olc2: (t) => { n2++; return { dIsl: t.map((x) => 20 / kNum(x)), cekmeMm: 0 }; } });
    const it = K.tarayici(P); it.adim(Infinity);
    const S = it.sonuc(), c = K.baglam(P.ctx);
    let gecen = 0;
    const red = { k1: 0, k2: 0, sehim: 0 };
    for (let i = 0; i < S.N; i++) {
      const t = [A[Math.floor(i / 25) % 5].key, A[Math.floor(i / 5) % 5].key, A[i % 5].key];
      const r = K.degerlendir(P.olc1(t), c, 1);
      if (r.ok) gecen++;
      Object.keys(red).forEach((k) => { if (!r.sonuc[k].ok) red[k]++; });
    }
    expect(n2).toBe(gecen);
    expect(S.ikinciN).toBe(gecen);
    Object.keys(red).forEach((k) => expect(S.red[k]).toBe(red[k]));
    for (let i = 1; i < S.huni.length; i++) expect(S.huni[i].kalan).toBeLessThanOrEqual(S.huni[i - 1].kalan);
    expect(S.huni[S.huni.length - 1].kalan).toBe(S.uygunN);
  });

  test('sıra: uygunlar uzlaşı uzaklığına göre, birincisi cephede, araları tekdüze', () => {
    const it = K.tarayici(kur()); it.adim(Infinity);
    const S = it.sonuc();
    expect(S.uygunN).toBeGreaterThan(3);
    expect(S.sira[0].pareto).toBe(true);
    for (let i = 1; i < S.sira.length; i++) expect(S.sira[i].uz).toBeGreaterThanOrEqual(S.sira[i - 1].uz);
  });

  test('uygun yoksa ikinci aşama en az ihlalli enIyi kombinasyonda koşar ve sıra ihlale göre', () => {
    let n2 = 0;
    const P = kur({ ctx: { fAtes: 10 }, olc2: () => { n2++; return { dIsl: [1, 1, 1], cekmeMm: 0 }; } });   // K1: 5 Hz sınırı aşılır
    const it = K.tarayici(P); it.adim(Infinity);
    const S = it.sonuc();
    expect(S.uygunN).toBe(0);
    expect(n2).toBe(P.enIyi);
    for (let i = 1; i < S.sira.length; i++) expect(S.sira[i].v).toBeGreaterThanOrEqual(S.sira[i - 1].v);
  });

  test('ölçülemeyen kombinasyon hata sayılır, sıraya ve hunide çözülenlere girmez', () => {
    const P = kur({ olc1: (t) => (t[0] === 'k1' ? null : sentetik().olc1(t)) });
    const it = K.tarayici(P); it.adim(Infinity);
    const S = it.sonuc();
    expect(S.hata).toBe(25);
    expect(S.huni[0].kalan).toBe(100);
    expect(S.sira.some((r) => r.tipler[0] === 'k1')).toBe(false);
  });

  test('f_ateş yoksa tarayıcı kurulmaz (Kriter 1 ve 2 tanımsız)', () => {
    expect(() => K.tarayici(kur({ ctx: {} }))).toThrow();
  });
});

describe('DEPO — ölçü saklanır, hüküm sınırdan yeniden kurulur', () => {
  // Zengin sentetik model: bütün kısıtların ölçüsü var (KED, kapasite, sürünmüş
  // sehim, darbe) ve her kısıt bazı kombinasyonlarda ihlal ediyor.
  const G = K.gruplar([tk('a', 'Sağ Ön', 0, 300, 0), tk('b', 'Sol Ön', 0, -300, 0),
                       tk('c', 'Sağ Arka', 800, 300, 0), tk('d', 'Sol Arka', 800, -300, 0), tk('e', 'Orta', 400, 0, 0)]);
  const A = [1, 2, 3, 4, 5, 6].map((k) => ({ key: 'k' + k, name: 'Tip ' + k }));
  const kN = (t) => (t ? Number(t.slice(1)) : 3);
  // Tiplerden belirlenimci, ölçü başına bağımsız sayı (0–1; murmur3 karıştırıcısı).
  const u = (t, s) => {
    let h = (0x9e3779b9 ^ Math.imul(s + 1, 0x85ebca6b)) >>> 0;
    t.forEach((x, i) => { h = Math.imul(h ^ (kN(x) + 16 * i), 0xcc9e2d51); h = (h << 15) | (h >>> 17); h = Math.imul(h, 0x1b873593); });
    h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
  const olc1 = (t) => {
    if (u(t, 0) < 0.03) return null;                                             // çözülemeyen
    return { f: [2.6 + 2 * u(t, 1), 4 + 2 * u(t, 2), 5.5 + 2 * u(t, 3), 7 + 0.8 * u(t, 4), 9.6 + 2 * u(t, 5), 13 + 8 * u(t, 6)],
             T: 0.15 + 0.4 * u(t, 7), dz: [-(1.6 + 6 * u(t, 8)), -1.2, -1], pay: [100, 100, 100],
             kap: [100 / (0.6 + 0.6 * u(t, 9)), null, 140], ked: { bounce: 0.6 + 0.4 * u(t, 10), roll: 0.7 + 0.3 * u(t, 11) } };
  };
  const olc2 = (t) => {
    if (u(t, 17) < 0.04) return null;                                            // ikinci aşamada çözülemeyen
    return { dIsl: [5 + 9 * u(t, 12), 4, 3], dSur: [6 + 10 * u(t, 13), 5, 4], cekmeMm: u(t, 14) < 0.1 ? 0.3 : 0,
             darbeOran: u(t, 15) < 0.15 ? null : 0.4 + u(t, 16) };
  };
  const ctx0 = { fAtes: 40, s: { sehimAlt: 2.5, sehimUst: 7, altMod: 2.8, kapasite: 1.1, isletmeUst: 12, durdurucuUst: 14, darbe: 1.2 } };
  const kur = (ek) => Object.assign({ G, adaylar: A, sabit: {}, ctx: ctx0, olc1, olc2, enIyi: 12 }, ek || {});
  const tara = (ek) => { const it = K.tarayici(kur(ek)); it.adim(Infinity); return { S: it.sonuc(), D: it.depo() }; };
  const sade = (S) => JSON.stringify(Object.assign({}, S, { sure: 0, olc: null, ctx: null }));

  test('kombinasyon numarası ↔ aday sıraları: ilk taranan grup en anlamlı basamak, gidiş-dönüş birebir', () => {
    const { D } = tara({ sabit: { [G[1].anahtar]: true } });
    expect(D.N).toBe(36);
    for (let x = 0; x < D.N; x++) expect(D.indeks(D.kod(x))).toBe(x);
    expect(D.kod(7)).toEqual([1, 1]);
    expect(D.tipler(7)).toEqual(['k2', null, 'k2']);
  });

  test('depodaki hüküm kombinasyon başına degerlendir\'in AYNISI (bit, ihlal toplamı; iki aşama)', () => {
    const { D } = tara({ tam: true });
    const c = K.baglam(Object.assign({}, ctx0, { acik: { ayrisma: true } }));
    const H = K.hukumler(D, c);
    let ihlal = 0;
    for (let x = 0; x < D.N; x++) {
      const t = D.tipler(x), o1 = olc1(t);
      if (!o1) { expect(D.d1[x]).toBe(0); continue; }
      const a = K.degerlendir(o1, c, 1), o2 = olc2(t);
      const b = o2 ? K.degerlendir(o2, c, 2) : null;
      let bit = 0;
      K.KISITLAR.forEach((Q, i) => { const r = (Q.asama === 1 ? a : b || { sonuc: {} }).sonuc[Q.k]; if (r && !r.ok) bit |= 1 << i; });
      expect(H.m[x]).toBe(bit);
      expect(H.v1[x]).toBe(a.v);
      if (b) expect(H.v2[x]).toBe(b.v); else expect(D.d2[x]).toBe(-1);
      if (bit) ihlal++;
    }
    expect(ihlal).toBeGreaterThan(D.N / 3);                                       // sınama boş geçmiyor
    K.KISITLAR.forEach((Q, i) => expect(Array.from(H.m).some((m) => m & (1 << i))).toBe(true));
  });

  test('TAM: ikinci aşama her kombinasyonda koşar; özet aynı, ikinci aşamanın bağımsız ihlali bütün ölçülenlerde', () => {
    let n2 = 0;
    const say = (t) => { n2++; return olc2(t); };
    const a = tara({ olc2: say });
    const yalniz = n2; n2 = 0;
    const b = tara({ olc2: say, tam: true });
    expect(n2).toBe(b.S.N - b.S.hata);                                            // çözülen her kombinasyon bir kez
    expect(yalniz).toBe(a.S.ikinciN);
    const redsiz = (S) => sade(Object.assign({}, S, { red: null, tam: null }));
    expect(redsiz(b.S)).toBe(redsiz(a.S));
    K.KISITLAR.filter((Q) => a.S.red[Q.k] !== undefined).forEach((Q) => {
      if (Q.asama === 1) expect(b.S.red[Q.k]).toBe(a.S.red[Q.k]);
      else expect(b.S.red[Q.k]).toBeGreaterThanOrEqual(a.S.red[Q.k]);
    });
    expect(K.KISITLAR.some((Q) => Q.asama === 2 && b.S.red[Q.k] > a.S.red[Q.k])).toBe(true);
    expect(a.S.uygunN).toBeGreaterThan(5);
    expect(b.S.cephe.length).toBe(b.S.paretoN);
    b.S.cephe.forEach((x) => expect(b.S.nokta.some((p) => p.pareto && p.T === b.D.T[x] && p.d === b.D.d[x])).toBe(true));
  });

  // TEK GEÇİŞ (2026-10-18): tam taramada kombinasyonun ikinci aşaması
  // birincisinin HEMEN ardından ölçülür — ölçücü aynı kombinasyonun hazırlığını
  // paylaşır (cp-mount-param.js) ve ilerleme tek sayıdır. Depo iki geçişli
  // hakemin (önce bütün olc1, sonra çözülenlerde olc2) aynısı.
  test('TEK GEÇİŞ: olc2 aynı kombinasyonun olc1\'inin hemen ardından; ilerleme i / N tekdüze; depo iki geçişli hakemle birebir', () => {
    const iz = [];
    const it = K.tarayici(kur({ tam: true,
      olc1: (t) => { iz.push('1|' + t.join(',')); return olc1(t); },
      olc2: (t) => { iz.push('2|' + t.join(',')); return olc2(t); } }));
    let once = 0, r;
    do {
      r = it.adim(7);
      expect([r.asama, r.n]).toEqual([0, it.N]);
      expect(r.i).toBeGreaterThanOrEqual(once);
      once = r.i;
    } while (!r.bitti);
    expect(r.i).toBe(it.N);
    iz.forEach((e, j) => { if (e[0] === '2') expect(iz[j - 1]).toBe('1|' + e.slice(2)); });
    const D = it.depo();
    let cozulen = 0;
    for (let x = 0; x < D.N; x++) {
      const t = D.tipler(x), o1 = olc1(t);
      expect(D.d1[x]).toBe(o1 ? 1 : 0);
      if (!o1) { expect(D.d2[x]).toBe(0); continue; }
      cozulen++;
      const o2 = olc2(t);
      expect(D.d2[x]).toBe(o2 ? 1 : -1);
      expect([D.T[x], D.fMin[x], D.fMax[x], D.d[x]]).toEqual([o1.T, Math.min(...o1.f), Math.max(...o1.f), Math.max(...o1.dz.map(Math.abs))]);
      K.KISITLAR.forEach((Q) => {
        const o = Q.asama === 1 ? o1 : o2;
        expect([Q.k, D.X[Q.k][x]]).toEqual([Q.k, o ? K.olcu(Q.k, o) : NaN]);
      });
    }
    expect(iz.filter((e) => e[0] === '2').length).toBe(cozulen);
    expect(cozulen).toBeLessThan(D.N);                                          // çözülemeyen de var: sınama boş geçmiyor
  });

  test('CANLI: sınır, açıklık ve ağırlık değişince depodan özet = o sınırlarla YENİ tarama', () => {
    const { D } = tara({ tam: true });
    const degisik = [
      { s: { sehimUst: 5.2 } }, { s: { sehimAlt: 3.4, altMod: 3.3 } }, { s: { durdurucuUst: 9 } },
      { s: { isletmeUst: 8.5, darbe: 2.5 } }, { s: { agirlik: 0.15 } },
      { acik: { ayrisma: true }, s: { ayrisma: 0.85 } }, { acik: { cekme: false, kapasite: false } },
      { s: { sehimUst: 1 } }                                                       // uygun yok → en az ihlalli
    ];
    degisik.forEach((d) => {
      const ctx = { fAtes: 40, s: Object.assign({}, ctx0.s, d.s || {}), acik: d.acik || {} };
      expect(sade(K.ozet(D, K.baglam(ctx)))).toBe(sade(tara({ ctx, tam: true }).S));
    });
  });

  test('tam olmayan depo yeni sınırla özetlenmez — ölçülmemiş ikinci aşama sessizce geçilmez', () => {
    const { D } = tara();
    expect(() => K.ozet(D, K.baglam({ fAtes: 40, s: Object.assign({}, ctx0.s, { sehimUst: 50 }) }))).toThrow();
  });

  test('BAĞLAYICI: bağımsız ihlal ve tek engel kaba kuvvetle; uygun sayısı özetinkiyle aynı', () => {
    const { D, S } = tara({ tam: true });
    const c = K.baglam(ctx0), B = K.baglayici(D, c);
    const hak = {};
    let n = 0, uyg = 0;
    for (let x = 0; x < D.N; x++) {
      const t = D.tipler(x), o1 = olc1(t), o2 = o1 && olc2(t);
      if (!o1) continue;
      // bağımsız ihlal: aşamanın ölçüldüğü her kombinasyonda
      const r = K.hepsi(o1, o2, ctx0), boz = Object.keys(r.sonuc).filter((k) => !r.sonuc[k].ok);
      boz.forEach((k) => { hak[k] = hak[k] || { red: 0, tek: 0 }; hak[k].red++; });
      if (!o2) continue;
      n++;
      if (!boz.length) uyg++;
      if (boz.length === 1) hak[boz[0]].tek++;
    }
    expect(B.n).toBe(n);
    expect(B.uygun).toBe(uyg);
    expect(B.uygun).toBe(S.uygunN);
    B.kisit.forEach((q) => expect([q.k, q.red, q.tek]).toEqual([q.k, (hak[q.k] || {}).red || 0, (hak[q.k] || {}).tek || 0]));
    B.kisit.forEach((q) => expect(q.red).toBe(S.red[q.k]));                       // raporun eleme tablosuyla aynı
    expect(B.kisit.map((q) => q.k)).toEqual(K.KISITLAR.filter((Q) => c.acik[Q.k]).map((Q) => Q.k));
    expect(B.kisit.some((q) => q.tek > 0)).toBe(true);
  });

  test('DUYARLILIK: bugünkü sınırda uygun sayısı; başka sınırda o sınırla yeni taramanın uygun sayısı', () => {
    const { D, S } = tara({ tam: true });
    const c = K.baglam(ctx0);
    const yeniden = (key, L) => tara({ ctx: { fAtes: 40, s: Object.assign({}, ctx0.s, { [key]: L }) } }).S.uygunN;
    [['sehimAlt', [1.5, 2.8, 3.5]], ['sehim', [4.5, 6, 9.4]], ['altMod', [2, 3.1, 4]], ['kapasite', [0.5, 0.9, 2]],
     ['isletme', [7, 9, 20]], ['durdurucu', [9.5, 11.4, 40]], ['darbe', [0.8, 1.6, 3.5]]].forEach(([k, Ls]) => {
      const d = K.duyarlilik(D, c, k);
      expect(d.sayi(d.sinir)).toBe(S.uygunN);
      // sınır tam bir ölçünün üstünde: eşitlik sağlıyor (≤ · ≥ iki uç dâhil)
      const uc = [d.deger[0], d.deger[d.deger.length >> 1], d.deger[d.deger.length - 1]];
      const anahtar = { sehim: 'sehimUst', isletme: 'isletmeUst', durdurucu: 'durdurucuUst' }[k] || k;
      Ls.concat(uc).forEach((L) => expect([k, L, d.sayi(L)]).toEqual([k, L, yeniden(anahtar, L)]));
    });
    expect(K.duyarlilik(D, c, 'cekme')).toBeNull();                                // sınırı yok
    expect(K.duyarlilik(D, c, 'k1')).toBeNull();                                   // kesin kriter
  });
});

describe('KED — kinetik enerji dağılımı (Jeong & Singh 2000)', () => {
  test('köşegen kütle: Σ KED = 1 ve saf öteleme modunda tek serbestlik %100', () => {
    const M = [[100, 0, 0, 0, 0, 0], [0, 100, 0, 0, 0, 0], [0, 0, 100, 0, 0, 0], [0, 0, 0, 5, 0, 0], [0, 0, 0, 0, 9, 0], [0, 0, 0, 0, 0, 8]];
    expect(K.ked([0, 0, 1, 0, 0, 0], M)).toEqual([0, 0, 1, 0, 0, 0]);
    const k = K.ked([0.2, 0.1, 1, 0.3, -0.4, 0.1], M);
    expect(k.reduce((s, v) => s + v, 0)).toBeCloseTo(1, 12);
  });
});
