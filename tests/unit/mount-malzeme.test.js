/**
 * mount-malzeme.test.js — TAKOZ STEP: MALZEME VERİTABANI (adım 5, 2026-11-02)
 * ─────────────────────────────────────────────────────────────────────────
 * Kullanıcı: "Ağırlık merkezi hesaplamaları için tıpkı CAD programlarında
 * olduğu gibi basit bir malzeme veritabanı oluşturabiliriz."
 *
 * Önce: malzeme yalnız BİRİMİN kütle kaynağıydı (beş malzeme, homojen
 * yoğunluk: kütle ρ·V, ağırlık merkezi hacim merkezi); birimin içindeki bir
 * parçaya başka malzeme verilemiyordu.
 *   · KATALOG — on malzeme; ilk beşin anahtarı ve yoğunluğu kayıtlı projelerde.
 *   · KALITIM — malzeme bir düğüme verilir, parça birimin içindeki EN YAKIN
 *     atamayı alır; birimin dışındaki atama birimin parçasına geçmez.
 *   · HESAP — atanan parça kendi yoğunluğuyla: kütle Σρ·V, ağırlık merkezi ve
 *     tensör kütleyle ağırlıklı; atama yoksa sonuç atamasız hesabın aynısı.
 *   · KAYIT — atama rolle birlikte projeye, aynı dosya okununca geri.
 *   · OTURUM — atama hesabı yeniler; birimde kütle kaynağı, rol değişince düğümde kalır.
 *   · 3B — alttaki dizinin seçicisi, ağacın etiketi.
 * Gerçek tarayıcı (3B'den atama → kart; kaydet → aç): tests/e2e/mount-kutle.spec.js → MALZEME.
 */
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
global.veSayi = require('../../js/sayi.js').veSayi;
global.veMountCore = require('../../js/mount-core.js');
const cp = require('../../js/cp-mount.js');
Object.keys(cp).forEach((k) => { if (global[k] === undefined) global[k] = cp[k]; });
const STP = require('../../js/mount-step.js');
Object.keys(STP).forEach((k) => { global[k] = STP[k]; });
// Sihirbaz ve 3B aynı kapsamda (3B'nin çizicileri sihirbazın yardımcılarını çağırır)
eval(loadSource('cp-mount-wizard.js'));
const W = { veMntWizStpOku, veMntWizStpRol, veMntWizStpHesapla, veMntWizStpKapat, veMntWizStpYogunluk, veMntWizStpMalzeme,
            _mwStpKutleK, _mwStpKutleHTML };
const PK = require('../../js/pencere-kabuk.js');
global.vePencereEylem = PK.vePencereEylem;
global.vePencereIlerlemeHTML = PK.vePencereIlerlemeHTML;
eval(loadSource('cp-mount-3b.js'));
eval(loadSource('cp-mount-3b-agac.js'));
const S = require('../helpers/step-takoz.js');
beforeEach(() => resetStubs(stubs));

const uz = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const RIJIT = (p, i) => p.konum[i] + (S.KUTLE.montaj.find((m) => m.id === p.alt) || { konum: [0, 0, 0] }).konum[i];
// ── ANALİTİK CEVAPLAR (kalıbın tanımından; modülün koduyla değil) ──────────
function kutu(p, alt) {
  const P = Object.assign({ alt }, p), c = [0, 1, 2].map((i) => RIJIT(P, i)), [a, b, h] = p.olcu, V = a * b * h;
  return { ad: p.ad, V, c, J: [[V * (b * b + h * h) / 12, 0, 0], [0, V * (a * a + h * h) / 12, 0], [0, 0, V * (a * a + b * b) / 12]] };
}
function topla(liste, rho) {
  let W = 0; const s = [0, 0, 0];
  liste.forEach((p) => { const w = rho(p) * p.V; W += w; for (let i = 0; i < 3; i++) s[i] += w * p.c[i]; });
  const c = s.map((x) => x / W), T = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  liste.forEach((p) => {
    const q = rho(p), d = p.c.map((x, i) => x - c[i]), dd = d[0] * d[0] + d[1] * d[1] + d[2] * d[2];
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) T[i][j] += q * (p.J[i][j] + p.V * ((i === j ? dd : 0) - d[i] * d[j]));
  });
  return { W, c, T };
}
const tfark = (A, B) => {
  let m = 0, n = 0;
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) { m = Math.max(m, Math.abs(A[i][j] - B[i][j])); n = Math.max(n, Math.abs(B[i][j])); }
  return m / n;
};
const BRAKET = S.KUTLE.braket.map((p) => kutu(p, 'BRAKET_ASM'));
const SANZ = S.KUTLE.sanziman.map((p) => Object.assign(kutu(p, 'SANZ_ASM'), { rho: p.yogunluk }));
const RHO = { celik: 7850, aluminyum: 2700, dokme: 7200 };

const ROL = { Motor: 'mnt-motor', 'Şanzıman': 'mnt-gearbox', 'Arka braket': 'mnt-bracket' };
const dugum = (son, ad) => son.agac.findIndex((d) => d.ad === ad);
const parca = (son, ad) => son.parcalar.findIndex((p) => p.ad === ad);
const roller = (son) => { const r = son.agac.map(() => null); Object.keys(ROL).forEach((a) => { r[dugum(son, a)] = ROL[a]; }); return r; };
const adla = (son, o) => { const r = {}; Object.keys(o).forEach((a) => { r[dugum(son, a)] = o[a]; }); return r; };
const SON = STP.veMntStpOku(S.kutleKalibi());
const coz = (yog = {}, mz = {}) => STP.veMntStpCoz(SON, roller(SON), { yogunluk: adla(SON, yog), malzeme: adla(SON, mz) });
const birim = (c, ad) => c.birimler.find((b) => b.ad === ad);

describe('KATALOG — CAD\'in malzeme kütüphanesi gibi', () => {
  test('sekiz malzeme, anahtar tekil, yoğunluk ve sınıf dolu; ilk beşin anahtarı ve yoğunluğu değişmez', () => {
    const M = STP.VE_MNT_STP_MALZEME;
    expect(M.length).toBe(8);
    expect(new Set(M.map((m) => m.k)).size).toBe(M.length);
    M.forEach((m) => { expect(m.rho).toBeGreaterThan(500); expect(m.rho).toBeLessThan(20000); expect(m.sinif.length).toBeGreaterThan(1); expect(m.ad.length).toBeGreaterThan(1); });
    expect(M.slice(0, 5).map((m) => [m.k, m.rho])).toEqual([['celik', 7850], ['dokme', 7200], ['sfero', 7100], ['aluminyum', 2700], ['magnezyum', 1800]]);
    expect(STP.veMntStpMalzeme('pirinc')).toMatchObject({ ad: 'Pirinç', rho: 8470 });
    // paslanmaz çelik ve alüminyum döküm ayrı kayıt değil (çelik · alüminyum)
    expect(M.filter((m) => /paslanmaz|döküm$/i.test(m.ad) && m.k !== 'sfero').map((m) => m.k)).toEqual([]);
    expect(STP.veMntStpMalzeme('titanyum')).toBe(null);
  });
});

describe('KALITIM — parça birimin içindeki en yakın atamayı alır', () => {
  const ust = parca(SON, 'Braket üst'), brk = dugum(SON, 'Arka braket');
  test('parçanın kendisi, alt montajı, birimin dışı', () => {
    const ad = (o) => STP.veMntStpParcaMalzemesi(SON, adla(SON, o), ust, brk);
    expect(ad({})).toBe(null);
    expect(ad({ 'Braket üst': 'aluminyum' })).toMatchObject({ k: 'aluminyum', dugum: SON.parcalar[ust].dugum });
    // Birimin kendi düğümündeki atama sayılmaz (birimin malzemesi kütle kaynağıdır)
    expect(ad({ 'Arka braket': 'celik' })).toBe(null);
    // birim verilmezse (ağacın kökü) üstteki atama gelir; en yakın kazanır
    expect(STP.veMntStpParcaMalzemesi(SON, adla(SON, { 'Arka braket': 'celik' }), ust)).toMatchObject({ k: 'celik', dugum: brk });
    expect(STP.veMntStpParcaMalzemesi(SON, adla(SON, { 'Arka braket': 'celik', 'Braket üst': 'pirinc' }), ust)).toMatchObject({ k: 'pirinc' });
    // bilinmeyen anahtar atlanır, aramayı kesmez
    expect(STP.veMntStpParcaMalzemesi(SON, adla(SON, { 'Arka braket': 'celik', 'Braket üst': 'titanyum' }), ust)).toMatchObject({ k: 'celik' });
  });
});

describe('HESAP — atanan parça kendi yoğunluğuyla; ağırlık merkezi ve tensör kütleyle', () => {
  test('atama yoksa: atamasız hesabın aynısı (homojen; nokta hacim merkezi)', () => {
    const a = birim(coz({ 'Arka braket': 'celik' }), 'Arka braket'), b = birim(STP.veMntStpCoz(SON, roller(SON), { yogunluk: adla(SON, { 'Arka braket': 'celik' }) }), 'Arka braket');
    expect(a.mz).toBeUndefined();
    expect(a.konum).toEqual(b.konum);
    expect(STP.veMntStpKutle(a, 0, 'celik')).toEqual(STP.veMntStpKutle(b, 0, 'celik'));
    expect(STP.veMntStpKutle(a, 0, 'celik').m).toBe(7850 * a.V * 1e-9);
  });

  test('birim çelik, üst levha alüminyum: kütle Σρ·V, ağırlık merkezi ağır levhaya kayar, tensör paralel eksenle', () => {
    const b = birim(coz({ 'Arka braket': 'celik' }, { 'Braket üst': 'aluminyum' }), 'Arka braket');
    const rho = (p) => (p.ad === 'Braket üst' ? RHO.aluminyum : RHO.celik) * 1e-9, H = topla(BRAKET, rho);
    const K = STP.veMntStpKutle(b, 0, 'celik');
    expect(K.kaynak).toBe('malzeme');
    expect(K.m).toBeCloseTo((2700 + 7850) * 120 * 600 * 20 * 1e-9, 12);
    expect(K.m).toBeCloseTo(H.W, 12);
    expect(uz(b.konum, H.c)).toBeLessThan(1e-9);
    expect(b.konum[2]).toBeCloseTo(300 + (40 * 2700 - 40 * 7850) / (2700 + 7850), 9);   // alttaki çelik levhaya iner
    expect(tfark(K.I, H.T.map((r) => r.map((v) => v * 1e-6)))).toBeLessThan(1e-9);
    expect(K.not).toBe('Çelik · 7.850 kg/m³ · 1 parça atanan malzemeyle (Alüminyum)');
    // Başka malzemeye geçen birimde eski toplam kullanılmaz
    expect(STP.veMntStpKutle(b, 0, 'dokme').m).toBe(7200 * b.V * 1e-9);
  });

  test('"Parçalardan": bütün parçalar atanınca seçilir; eksik atamada yok', () => {
    const tam = birim(coz({ 'Arka braket': 'atanan' }, { 'Braket üst': 'aluminyum', 'Braket alt': 'dokme' }), 'Arka braket');
    const H = topla(BRAKET, (p) => (p.ad === 'Braket üst' ? RHO.aluminyum : RHO.dokme) * 1e-9);
    const K = STP.veMntStpKutle(tam, 0, 'atanan');
    expect([K.kaynak, K.not]).toEqual(['malzeme', 'parçaların malzemesi (Alüminyum, Dökme demir)']);
    expect(K.m).toBeCloseTo(H.W, 12);
    expect(uz(tam.konum, H.c)).toBeLessThan(1e-9);
    expect(tfark(K.I, H.T.map((r) => r.map((v) => v * 1e-6)))).toBeLessThan(1e-9);
    // Alt montaja atama iki levhaya da geçer — ama alt montaj birimin kendisi: sayılmaz
    expect(birim(coz({}, { 'Arka braket': 'celik' }), 'Arka braket').atanan).toBeUndefined();
    const yarim = birim(coz({ 'Arka braket': 'atanan' }, { 'Braket üst': 'aluminyum' }), 'Arka braket');
    expect(yarim.atanan).toBeUndefined();
    expect(STP.veMntStpKutle(yarim, 12, 'atanan')).toMatchObject({ kaynak: 'elle', m: 12 });     // seçilemez: elle kalır
    expect(yarim.konum).toEqual(birim(coz(), 'Arka braket').konum);                           // hacim merkezi
  });

  test('"Dosyadan" + atama: atanan parça dosyanın yoğunluğunun yerine; yoğunluksuz parçayı atama tamamlar', () => {
    const b = birim(coz({ 'Şanzıman': 'dosya' }, { 'Çan': 'celik' }), 'Şanzıman');
    const H = topla(SANZ, (p) => (p.ad === 'Çan' ? RHO.celik : p.rho) * 1e-9);
    const K = STP.veMntStpKutle(b, 0, 'dosya');
    expect(K.m).toBeCloseTo(H.W, 12);
    expect(uz(b.konum, H.c)).toBeLessThan(1e-9);
    expect(K.not).toBe('dosyanın yoğunlukları (EN-GJL-250, Çelik) · 1 parça atanan malzemeyle');
    // başka malzeme de aynı yoldan: çana atanan bakır dosyanın 2.700'ünün yerine
    const yalniz = birim(coz({ 'Şanzıman': 'dosya' }, { 'Çan': 'bakir' }), 'Şanzıman');
    expect(yalniz.dosya.m).toBeCloseTo(topla(SANZ, (p) => (p.ad === 'Çan' ? 8930 : p.rho) * 1e-9).W, 12);
    // braketin dosyada hiç yoğunluğu yok: iki levha atanınca "Dosyadan" AÇILMAZ — o "Parçalardan"
    expect(birim(coz(), 'Arka braket').dosya).toBeUndefined();
    const brk = birim(coz({}, { 'Braket üst': 'celik', 'Braket alt': 'celik' }), 'Arka braket');
    expect([brk.yogEksik, brk.ataYogsuz, brk.dosya]).toEqual([0, 2, undefined]);
    expect(brk.atanan.m).toBeCloseTo(7850 * 2 * 120 * 600 * 20 * 1e-9, 12);
  });
});

describe('KAYIT — atama rolle birlikte projeye, aynı dosyada geri', () => {
  test('yalnız rolsüz düğümün geçerli ataması yazılır; uygulama yoldan geri getirir', () => {
    const r = roller(SON), mz = adla(SON, { 'Braket üst': 'aluminyum', 'Braket alt': 'titanyum', 'Arka braket': 'celik', 'Çan': 'pirinc' });
    const k = STP.veMntStpRolKaydi(SON, r, {}, {}, {}, {}, {}, mz);
    expect(k.malzeme.map((m) => [m.yol[m.yol.length - 1], m.k]).sort()).toEqual([
      [SON.agac[dugum(SON, 'Braket üst')].ornek, 'aluminyum'], [SON.agac[dugum(SON, 'Çan')].ornek, 'pirinc']].sort());
    const u = STP.veMntStpRolKaydiUygula(SON, JSON.parse(JSON.stringify(k)));
    expect(u.malzeme).toEqual(adla(SON, { 'Braket üst': 'aluminyum', 'Çan': 'pirinc' }));
    // atamasız kayıtta alan yok (eski kayıtlar değişmez); bozuk satır düşer
    expect(STP.veMntStpRolKaydi(SON, r, {}, {}, {}, {}, {}, {}).malzeme).toBeUndefined();
    const bozuk = Object.assign({}, k, { malzeme: [{ yol: ['YOK'], k: 'celik' }, { yol: k.malzeme[0].yol, k: 'titanyum' }, null] });
    expect(STP.veMntStpRolKaydiUygula(SON, bozuk).malzeme).toEqual({});
    // "Parçaların malzemesi" kütle kaynağı olarak yazılır ve döner
    const k2 = STP.veMntStpRolKaydi(SON, r, {}, {}, {}, adla(SON, { 'Arka braket': 'atanan' }), {}, {});
    expect(k2.roller.find((x) => x.ad === 'Arka braket').yog).toBe('atanan');
    expect(STP.veMntStpRolKaydiUygula(SON, k2).yogunluk[dugum(SON, 'Arka braket')]).toBe('atanan');
  });
});

describe('OTURUM — atama hesabı yeniler; birimde kütle kaynağı; rol değişince düğümde kalır', () => {
  let ev;
  beforeEach(() => {
    W.veMntWizStpKapat();
    global.veMntStack = [{ nodeId: 'mod-1' }];
    ev = { id: 'v1', type: 'mnt-viewer', def: componentDefs['mnt-viewer'], data: {} };
    global.nodes = [ev];
  });
  afterEach(() => { delete global.veMntStack; });
  const ac = () => {
    const s = W.veMntWizStpOku(S.kutleKalibi(), 'kutle.stp');
    Object.keys(ROL).forEach((a) => W.veMntWizStpRol(dugum(s.sonuc, a), ROL[a]));
    W.veMntWizStpHesapla();
    return s;
  };
  const b = (s, ad) => s.coz.birimler.find((x) => x.ad === ad);

  test('rolsüz düğüme atama: hesap yenilenir, kayda yazılır; aynı değer ve geçersiz anahtar false; takoz yok sayılır', () => {
    const s = ac(), brk = dugum(s.sonuc, 'Arka braket'), ust = dugum(s.sonuc, 'Braket üst'), alt = dugum(s.sonuc, 'Braket alt');
    expect(W.veMntWizStpYogunluk(brk, 'celik')).toBe(true);
    const once = W._mwStpKutleK(s, b(s, 'Arka braket')).m;
    expect(W.veMntWizStpMalzeme([ust], 'aluminyum')).toBe(true);
    expect(s.malzeme[ust]).toBe('aluminyum');
    const sonra = W._mwStpKutleK(s, b(s, 'Arka braket')).m;
    expect(sonra).toBeCloseTo(once * (2700 + 7850) / (2 * 7850), 12);
    expect(ev.data.cad.malzeme.map((m) => m.k)).toEqual(['aluminyum']);
    expect(W.veMntWizStpMalzeme([ust], 'aluminyum')).toBe(false);
    expect(W.veMntWizStpMalzeme([ust], 'titanyum')).toBe(false);
    // çoklu: ikisine birden, tek hesap; sonra kaldır
    expect(W.veMntWizStpMalzeme([ust, alt], 'dokme')).toBe(true);
    expect(W.veMntWizStpYogunluk(brk, 'atanan')).toBe(true);
    expect(W._mwStpKutleK(s, b(s, 'Arka braket')).m).toBeCloseTo(7200 * 2 * 120 * 600 * 20 * 1e-9, 12);
    expect(W.veMntWizStpMalzeme([ust, alt], '')).toBe(true);
    expect(s.malzeme).toEqual({});
    expect(ev.data.cad.malzeme).toBeUndefined();
  });

  test('birimin malzemesi kütle kaynağıdır; kaldırmak yalnız malzeme kaynağını kaldırır', () => {
    const s = ac(), brk = dugum(s.sonuc, 'Arka braket'), san = dugum(s.sonuc, 'Şanzıman');
    expect(W.veMntWizStpMalzeme([brk], 'sfero')).toBe(true);
    expect([s.yogunluk[brk], s.malzeme[brk]]).toEqual(['sfero', undefined]);
    expect(W._mwStpKutleK(s, b(s, 'Arka braket')).kaynak).toBe('malzeme');
    expect(W.veMntWizStpYogunluk(san, 'dosya')).toBe(false);                     // varsayılan zaten "Dosyadan"
    expect(W.veMntWizStpMalzeme([brk, san], '')).toBe(true);
    expect([s.yogunluk[brk], s.yogunluk[san]]).toEqual([undefined, undefined]);
    expect(W._mwStpKutleK(s, b(s, 'Şanzıman')).kaynak).toBe('dosya');           // dosya kaynağı kalır
  });

  test('rol değişince malzeme düğümde kalır: rol alan düğümün ataması kütle kaynağı, rolü düşenin kaynağı atama olur', () => {
    const s = ac(), ust = dugum(s.sonuc, 'Braket üst'), brk = dugum(s.sonuc, 'Arka braket');
    W.veMntWizStpMalzeme([ust], 'bakir');
    W.veMntWizStpRol(ust, 'mnt-pump');                    // iç içe başka rol (aynı rol iç içe olmaz)
    expect([s.yogunluk[ust], s.malzeme[ust]]).toEqual(['bakir', undefined]);
    W.veMntWizStpRol(ust, '');
    expect([s.yogunluk[ust], s.malzeme[ust]]).toEqual([undefined, 'bakir']);
    W.veMntWizStpYogunluk(brk, 'aluminyum');
    W.veMntWizStpRol(brk, '');
    expect(s.malzeme[brk]).toBe('aluminyum');
  });

  test('kartın kaynak seçicisi: "Parçalardan" yalnız bütün parçaları atanmış birimde', () => {
    const s = ac(), ust = dugum(s.sonuc, 'Braket üst'), alt = dugum(s.sonuc, 'Braket alt');
    const sec = () => {
      const d = document.createElement('div');
      d.innerHTML = W._mwStpKutleHTML(s);
      return Array.from(d.querySelector('select[aria-label="Kütle kaynağı — Arka braket"]').options).map((o) => o.value);
    };
    expect(sec()).not.toContain('atanan');
    W.veMntWizStpMalzeme([ust], 'celik');
    expect(sec()).not.toContain('atanan');
    W.veMntWizStpMalzeme([alt], 'celik');
    expect(sec().slice(0, 2)).toEqual(['', 'atanan']);                  // dosyada yoğunluk yok: "Dosyadan" değil
  });

  test('kayıt → yeniden okuma: atamalar ve "Parçaların malzemesi" geri gelir', () => {
    const s = ac(), ust = dugum(s.sonuc, 'Braket üst'), alt = dugum(s.sonuc, 'Braket alt'), brk = dugum(s.sonuc, 'Arka braket');
    W.veMntWizStpMalzeme([ust], 'aluminyum');
    W.veMntWizStpMalzeme([alt], 'celik');
    W.veMntWizStpYogunluk(brk, 'atanan');
    const kayit = JSON.parse(JSON.stringify(ev.data.cad));
    W.veMntWizStpKapat();
    ev.data = { cad: kayit };
    const s2 = W.veMntWizStpOku(S.kutleKalibi(), 'kutle.stp');
    expect(s2.malzeme).toEqual({ [ust]: 'aluminyum', [alt]: 'celik' });
    expect(s2.yogunluk[brk]).toBe('atanan');
    W.veMntWizStpHesapla();
    expect(W._mwStpKutleK(s2, b(s2, 'Arka braket')).m).toBeCloseTo((2700 + 7850) * 120 * 600 * 20 * 1e-9, 12);
  });
});

describe('3B — alttaki dizinin seçicisi ve ağacın etiketi', () => {
  let ev;
  beforeEach(() => {
    W.veMntWizStpKapat();
    global.veMntStack = [{ nodeId: 'mod-1' }];
    ev = { id: 'v1', type: 'mnt-viewer', def: componentDefs['mnt-viewer'], data: {} };
    global.nodes = [ev];
  });
  afterEach(() => { delete global.veMntStack; });
  const ac = () => {
    const s = W.veMntWizStpOku(S.kutleKalibi(), 'kutle.stp');
    Object.keys(ROL).forEach((a) => W.veMntWizStpRol(dugum(s.sonuc, a), ROL[a]));
    return s;
  };
  const dizi = (s, secim) => { const d = document.createElement('div'); d.innerHTML = _mw3bMalzemeHTML(s, secim, secim.length > 1, secim[secim.length - 1]); return d; };
  const sec = (d) => d.querySelector('#ve-mw-3b-malzeme');

  // Kullanıcı 2026-11-05 (Canlı Not 9): "Her seçilen komponent için 'malzeme' tanımı
  // isteniyor … Sadece istediğimiz parçalara malzeme tanımlayacağız." Önce: her
  // seçimde Malzeme seçicisi ("—"); sonra satır yalnız atanmış (ya da devralınan)
  // malzemeyi okur, atama sağ tık menüsünden. Not 16: motorda hiç yok.
  test('malzeme satırı yalnız atanmışsa: devralınan "birimden" · "üstten", ayrışan "Karışık"; kaldır yalnız kendi ataması varken; takozda yok', () => {
    const s = ac(), ust = dugum(s.sonuc, 'Braket üst'), alt = dugum(s.sonuc, 'Braket alt'), brk = dugum(s.sonuc, 'Arka braket');
    const mzS = (d) => d.querySelector('.ve-mw-3b-malzeme');
    let d = dizi(s, [ust]);
    expect(mzS(d)).toBe(null);                                                  // atama yok: satır yok
    s.yogunluk[brk] = 'celik';
    d = dizi(s, [ust]);
    expect(mzS(d).querySelector('.ve-mw-3b-kb').textContent).toBe('Malzeme');
    expect(mzS(d).querySelector('.ve-mw-3b-oz-mz').textContent).toBe('Çelikbirimden');
    expect(mzS(d).querySelector('.ve-mw-3b-oz-mz').getAttribute('title')).toBe('Çelik · S235–S355 · 7.850 kg/m³');
    expect(d.querySelector('#ve-mw-3b-malzeme-kaldir')).toBe(null);             // devralınan kaldırılmaz
    s.malzeme[ust] = 'aluminyum';
    d = dizi(s, [ust]);
    expect(mzS(d).querySelector('.ve-mw-3b-oz-mz b').textContent).toBe('Alüminyum');
    expect(d.querySelector('#ve-mw-3b-malzeme-kaldir').getAttribute('onclick')).toBe("veMntWiz3bMalzeme('')");
    d = dizi(s, [ust, alt]);
    expect(mzS(d).querySelector('.ve-mw-3b-oz-mz b').textContent).toBe('Karışık');
    // birim seçiliyse kendi malzemesi kütle kaynağı
    d = dizi(s, [brk]);
    expect(mzS(d).querySelector('.ve-mw-3b-oz-mz b').textContent).toBe('Çelik');
    // takozun kütlesi yok: satır çizilmez
    const s2 = Object.assign({}, s, { roller: s.roller.map((r, i) => (i === brk ? 'mnt-mount' : r)) });
    expect(dizi(s2, [brk]).querySelector('.ve-mw-3b-malzeme')).toBe(null);
  });

  test('ağaç: rolsüz düğümün kendi malzemesi satırda, tam adı ve yoğunluğu ipucunda', () => {
    const s = ac(), ust = dugum(s.sonuc, 'Braket üst');
    s.acik = {}; s.sonuc.agac.forEach((x) => { if (x.cocuklar.length) s.acik[x.i] = x.cocuklar.length; });
    s.malzeme[ust] = 'pirinc';
    const d = document.createElement('div');
    d.innerHTML = veMntWiz3bAgacHTML(s, []);
    const et = d.querySelector('[data-ve-3b-agac="' + ust + '"] .ve-mw-3b-agac-mz');
    expect([et.textContent, et.getAttribute('title')]).toEqual(['Pirinç', 'Pirinç · CW614N · 8.470 kg/m³']);
    expect(d.querySelectorAll('.ve-mw-3b-agac-mz').length).toBe(1);
  });
});
