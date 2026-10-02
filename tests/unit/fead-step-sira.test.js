/**
 * fead-step-sira.test.js — KAYIŞ SIRASI STEP'İN KAYIŞ ESKİZİNDEN
 * (js/fead-step.js veFeadStpEskizSirasi + veFeadStpKayit · js/cp-fead-wizard.js
 *  aktarım ve sıra numaraları · js/cp-fead-3b.js tablo)
 *
 * Kullanıcı bildirimi (2026-10-02): *"3D görselleştirici ile kasnakları
 * sırayla modelledikten sonra, topolojiye aktarırken, 1-2 kasnağın sırasını
 * yanlış aktarıyor."* Aktarım sırayı montaj AĞACINDAN kuruyordu; ağaç kayışın
 * sırası değildir ve kullanıcının rol verme sırası hiçbir yere yazılmıyordu.
 * Kayış parçası kapalı bir eskiz taşır (yay, doğru, yay…) ve her yay bir
 * kasnağın sarımıdır: sıra oradan okunur. Eskizin yönü CAD'de keyfi — yön
 * gergiden: gevşek tarafta, tablonun SONUNDA (arşivin 11 düzeninin 11'inde).
 *
 * Kapılar:
 *   · saf okuma: sürücüye döndürme, gergiden yön, bölünmüş sarım, sarmalama,
 *     çift geçiş, eksik kasnak, belirsiz yön
 *   · ARŞİVİN 11 DÜZENİ, ağaç tablonun TERSİ: kayışa rol verilince sıra Gates
 *     tablosunun sırası; verilmezse ağaç sırası ve sebebi söylenir
 *   · eskiz ters yazılsa, başka yaydan başlasa, bir sarım iki yaya bölünse de AYNI sıra
 *   · sihirbazın durumu, kurulan topolojinin `beltIndex`i, 3B tablosu ve
 *     kartın numaraları AYNI sırayı söyler — aktarmadan önce
 */
const wiz = require('../../js/cp-fead-wizard.js');
const fead = require('../../js/cp-fead.js');
const M = require('../../js/fead-model.js');
const F = require('../../js/fead-core.js');
const P = require('../../js/step-p21.js');
const S = require('../../js/fead-step.js');
const U = require('../../js/step-ucgen.js');
const O = require('../helpers/step-ornek.js');

const stubs = stubGlobals();
document.body.innerHTML = '<div id="ve-canvas"></div>';
global.nodes = [];
global.connections = [];
eval(loadSource('components.js'));
global.veIsCanvasHidden = veIsCanvasHidden;
global.componentDefs = componentDefs;
global.VE_MODULES = VE_MODULES;
eval(loadSource('cp-accessories.js'));
global.VE_ALTERNATOR_PRESETS = VE_ALTERNATOR_PRESETS;
global.VE_AC_PRESETS = VE_AC_PRESETS;
global.VE_AIRCOMP_PRESETS = VE_AIRCOMP_PRESETS;
global.veAccInterpCurve = veAccInterpCurve;
[require('../../js/fead-duty.js'), require('../../js/fead-belts.js'), require('../../js/fead-tensioners.js'),
  require('../../js/fead-engines.js'), require('../../js/fead-accessories.js'), require('../../js/fead-checks.js'), P, S, U]
  .forEach((m) => { Object.keys(m).forEach((k) => { global[k] = m[k]; }); });
global.FEADCore = F;
Object.keys(M).forEach((k) => { global[k] = M[k]; });
Object.keys(fead).forEach((k) => { if (global[k] === undefined) global[k] = fead[k]; });
Object.keys(wiz).forEach((k) => { global[k] = wiz[k]; });
const G = require('../../js/cp-fead-3b.js');

beforeEach(() => {
  resetStubs(stubs);
  global.nodes = [];
  global.connections = [];
});

const kabuk = () => {
  document.body.innerHTML = '<div id="ve-canvas"></div><div id="ve-canvas-wrapper"></div>'
    + '<div id="ve-feadwiz-overlay" style="display:none;">'
    + '<div id="ve-fw-nav"></div><div id="ve-fw-body"></div><div id="ve-fw-foot"></div></div>';
};
const html = (h) => { const d = document.createElement('div'); d.innerHTML = h; return d; };

// ── Düzenler ────────────────────────────────────────────────────────────
// Arşivin örnekleri Gates TABLO sırasında (O.ornekDuzen); ağaç onların TERSİ
// ve kayış en başta — eski aktarımın sürücü dışındaki kasnakları ters dizdiği hâl.
const KEYS = M.veFeadExampleKeys();
const tabloAd = (duzen) => duzen.map((k) => k.ad);
const tersAgac = (duzen) => ['KAYIS'].concat(tabloAd(duzen).reverse());
// Gergi krankın KARŞISINDA (4 kasnağın 3.'sü): çevrim yazılı, yön belirsiz
const C45 = Math.cos(Math.PI / 4);
const KARE = [
  { id: 'K1', ad: 'KRANK', rol: 'fead-crank', od: 160, x: 0, y: 0, contact: 'grooved' },
  { id: 'L1', ad: 'ALTERNATÖR', rol: 'fead-alternator', od: 60, x: 300, y: 0, contact: 'grooved' },
  { id: 'G1', ad: 'OTOMATİK GERGİ', rol: 'fead-tensioner', od: 75, x: 190, y: 190, contact: 'back',
    ten: { x: 190 - 90 * C45, y: 190 - 90 * C45 } },
  { id: 'C1', ad: 'KLİMA', rol: 'fead-ac', od: 120, x: 0, y: 300, contact: 'grooved' },
];

// ── Tanıyıcı düzeyi: rolü TEST verir (adla) ─────────────────────────────
const rolle = (o, duzen, kayis, degis = {}) => {
  const r = [];
  duzen.forEach((k) => { r[o.agac.findIndex((d) => d.ad === k.ad)] = degis[k.ad] || k.rol; });
  if (kayis) r[o.agac.findIndex((d) => /^KAYIŞ/.test(d.ad))] = 'fead-belt';
  return r;
};
const kayitOf = (metin, duzen, kayis = true, degis) => {
  const o = S.veFeadStpOku(metin);
  const c = S.veFeadStpCoz(o, rolle(o, duzen, kayis, degis));
  expect(c.ok).toBe(true);
  return S.veFeadStpKayit(c, { gergiKatalog: [] });
};
const kayitSira = (k) => k.route.map((key) => k.pulleys.find((p) => p.key === key).name);
const siraUyari = (k) => k.uyarilar.filter((m) => /^Kayış sırası/.test(m));

// ═════════════════════════════════════════════════════════════════════════
describe('veFeadStpEskizSirasi — eskizin yaylarından sıra', () => {
  const y = (...k) => k.map((kasnak) => ({ kasnak }));
  const K4 = [0, 1, 2, 3];

  test('sürücüden başlar, yönü gergi verir: gergi tablonun SONUNDA', () => {
    expect(S.veFeadStpEskizSirasi(y(1, 2, 3, 0), K4, 0, 3)).toEqual({ sira: [0, 1, 2, 3], yon: 'gergi' });
    // eğri TERS yazılmış, başka bir yaydan başlıyor: AYNI sıra
    expect(S.veFeadStpEskizSirasi(y(3, 2, 1, 0), K4, 0, 3)).toEqual({ sira: [0, 1, 2, 3], yon: 'gergi' });
    expect(S.veFeadStpEskizSirasi(y(2, 1, 0, 3), K4, 0, 3)).toEqual({ sira: [0, 1, 2, 3], yon: 'gergi' });
    // sürücü ve gergi tanıyıcının herhangi bir indisinde olabilir
    expect(S.veFeadStpEskizSirasi(y(0, 3, 1, 2), K4, 2, 1)).toEqual({ sira: [2, 0, 3, 1], yon: 'gergi' });
  });

  test('bölünmüş sarım TEK geçiş; eğrinin başı ile sonu aynı kasnaksa birleşir', () => {
    expect(S.veFeadStpEskizSirasi(y(0, 0, 1, 2, 2, 3), K4, 0, 3).sira).toEqual([0, 1, 2, 3]);
    expect(S.veFeadStpEskizSirasi(y(0, 1, 2, 3, 0), K4, 0, 3).sira).toEqual([0, 1, 2, 3]);
  });

  test('aktarılmayan kasnağın yayı sayılmaz (ikinci gergi · rolsüz)', () => {
    expect(S.veFeadStpEskizSirasi(y(0, 4, 1, 2, 3), K4, 0, 3).sira).toEqual([0, 1, 2, 3]);
  });

  test('okunamayan eskiz sıra VERMEZ: çift geçiş · eksik kasnak · sürücü yok', () => {
    expect(S.veFeadStpEskizSirasi(y(0, 1, 0, 2, 3), K4, 0, 3)).toEqual({ sira: null, eksik: [], cift: [0] });
    expect(S.veFeadStpEskizSirasi(y(0, 1, 3), K4, 0, 3)).toEqual({ sira: null, eksik: [2], cift: [] });
    expect(S.veFeadStpEskizSirasi(y(0, 1, 2, 3), K4, -1, 3).sira).toBeNull();
    expect(S.veFeadStpEskizSirasi([], K4, 0, 3).sira).toBeNull();
  });

  test('yön belirsiz — gergi krankın karşısında ya da yok: eskizin yönü, İŞARETLİ', () => {
    expect(S.veFeadStpEskizSirasi(y(0, 1, 2, 3), K4, 0, 2)).toEqual({ sira: [0, 1, 2, 3], yon: 'eskiz' });
    expect(S.veFeadStpEskizSirasi(y(0, 3, 2, 1), K4, 0, -1)).toEqual({ sira: [0, 3, 2, 1], yon: 'eskiz' });
    // üç kasnakta gergi hep krankın komşusu; iki kasnakta yön sırayı değiştirmez
    expect(S.veFeadStpEskizSirasi(y(0, 1, 2), [0, 1, 2], 0, 1)).toEqual({ sira: [0, 2, 1], yon: 'gergi' });
    expect(S.veFeadStpEskizSirasi(y(1, 0), [0, 1], 0, -1)).toEqual({ sira: [0, 1], yon: 'gergi' });
  });
});

// ═════════════════════════════════════════════════════════════════════════
describe('arşivin 11 düzeni — ağaç tablonun TERSİ', () => {
  test('arşivin her düzeninde gergi tablonun SONUNDA ve krankın komşusu — yön kuralının dayanağı', () => {
    expect(KEYS).toHaveLength(11);
    KEYS.forEach((key) => {
      const d = O.ornekDuzen(key);
      expect([key, d[0].rol, d[d.length - 1].rol]).toEqual([key, 'fead-crank', 'fead-tensioner']);
    });
  });

  test.each(KEYS)('%s: kayışa rol verilince sıra Gates tablosunun sırası', (key) => {
    const duzen = O.ornekDuzen(key);
    const kayit = kayitOf(O.duzenStep(duzen, tersAgac(duzen)), duzen);
    expect(kayitSira(kayit)).toEqual(tabloAd(duzen));
    expect(kayit.siraKaynagi).toBe('kayis');
    expect(siraUyari(kayit)).toEqual([]);
  });

  test('kayışa rol VERİLMEZSE sıra ağaçtan ve SEBEBİ söylenir — bildirilen hatanın kendisi', () => {
    const yanlis = [];
    KEYS.forEach((key) => {
      const duzen = O.ornekDuzen(key);
      const kayit = kayitOf(O.duzenStep(duzen, tersAgac(duzen)), duzen, false);
      expect(kayit.siraKaynagi).toBe('agac');
      expect(siraUyari(kayit)).toEqual(['Kayış sırası dosyadan okunmadı (kayışa rol verilmedi); '
        + 'ağaç sırasıyla dizildi. Sırayı Kasnaklar adımında verin.']);
      // ağaç sırası: sürücü, ağaçtaki öteki kasnaklar, gergi
      const ag = tersAgac(duzen).filter((a) => a !== 'KAYIS');
      const bek = [duzen[0].ad].concat(ag.filter((a) => a !== duzen[0].ad && a !== duzen[duzen.length - 1].ad),
        duzen[duzen.length - 1].ad);
      expect(kayitSira(kayit)).toEqual(bek);
      if (JSON.stringify(bek) !== JSON.stringify(tabloAd(duzen))) yanlis.push(key);
    });
    // Ara kasnağı ikiden çok olan 8 düzenin 8'i ağaçtan YANLIŞ sırayla gelir;
    // üç kasnaklı AG0868'lerde ağaç sırası tesadüfen doğru
    expect(yanlis).toHaveLength(8);
    expect(yanlis.filter((k) => /AG0868/.test(k))).toEqual([]);
  });
});

// ═════════════════════════════════════════════════════════════════════════
describe('eskizin yönü, başı ve yay bölümü keyfi — sıra AYNI', () => {
  test.each(KEYS)('%s', (key) => {
    const duzen = O.ornekDuzen(key);
    [{ eskizTers: true }, { eskizKaydir: 2 }, { eskizTers: true, eskizKaydir: 1 }, { yayBol: duzen[1].ad },
      { yayBol: duzen[0].ad, eskizTers: true }].forEach((opt) => {
      const kayit = kayitOf(O.duzenStep(duzen, tersAgac(duzen), opt), duzen);
      // seçenek mesajda: hangisinin düştüğü okunur
      expect([opt, kayitSira(kayit), kayit.siraKaynagi]).toEqual([opt, tabloAd(duzen), 'kayis']);
    });
  });

  test('eskizin uzunluğu ve sarımları çekirdekle birebir — sentetik eskiz doğru çizilmiş', () => {
    const duzen = O.ornekDuzen('AG00976_GATES_2025');
    const K = duzen.map((k) => ({ name: k.ad, c: [k.x, k.y], od: k.od, contact: k.contact, rPitch: k.od / 2 + 1.5 }))
      .map((k) => Object.assign(k, { rEff: k.rPitch }));
    const g = F.solveGeometry(K);
    [{}, { eskizTers: true }, { eskizKaydir: 3 }, { yayBol: duzen[2].ad }].forEach((opt) => {
      const o = S.veFeadStpOku(O.duzenStep(duzen, tersAgac(duzen), opt));
      const es = S.veFeadStpCoz(o, rolle(o, duzen, true)).kayis.eskiz;
      expect(es.L).toBeCloseTo(g.LpitchMm, 6);
      const sar = {};
      es.yaylar.forEach((y) => { sar[y.ad] = (sar[y.ad] || 0) + y.aci; });
      duzen.forEach((k, i) => { expect(sar[k.ad]).toBeCloseTo(g.wraps[i] * 180 / Math.PI, 6); });
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════
describe('eskiz sıra veremezse ağaç sırası — SEBEBİYLE', () => {
  const AG686 = O.ornekDuzen('AG00686_1475_GATES_2023');
  test('kayışta eskiz yok', () => {
    const k = kayitOf(O.duzenStep(AG686, tersAgac(AG686), { eskizYok: true }), AG686);
    expect(k.siraKaynagi).toBe('agac');
    expect(siraUyari(k)[0]).toMatch(/^Kayış sırası dosyadan okunmadı \("KAYIŞ - 8PK1500" kapalı bir eskiz taşımıyor\)/);
  });
  test('eskiz bir kasnaktan geçmiyor (bayat eskiz)', () => {
    const k = kayitOf(O.duzenStep(AG686, tersAgac(AG686), { eskizHaric: 'AVARA' }), AG686);
    expect(k.siraKaynagi).toBe('agac');
    expect(siraUyari(k)[0]).toMatch(/^Kayış sırası dosyadan okunmadı \(eskiz "AVARA" kasnağından geçmiyor\)/);
  });
  test('sürücü seçilmedi', () => {
    const k = kayitOf(O.duzenStep(AG686, tersAgac(AG686)), AG686, true, { 'KRANK KASNAĞI': 'fead-idler' });
    expect(k.siraKaynagi).toBe('agac');
    expect(siraUyari(k)[0]).toMatch(/\(sürücü seçilmedi\)/);
  });
});

// ═════════════════════════════════════════════════════════════════════════
describe('yön belirsizse çevrim eskizden, yön İŞARETLİ', () => {
  test('gergi krankın karşısında: sıra eskizin yönünde, uyarı yön için', () => {
    const k = kayitOf(O.duzenStep(KARE, tersAgac(KARE)), KARE);
    expect(k.siraKaynagi).toBe('kayis-yon');
    expect(kayitSira(k)).toEqual(tabloAd(KARE));
    expect(siraUyari(k)).toEqual(['Kayış sırası "Sketch.2" eskizinden okundu; dönüş yönü belirsiz '
      + '(gergi krankın komşusu değil). Yönü Kasnaklar adımında seçin.']);
    // ters eskiz: çevrim aynı, yön ters — dosya yönü söylemiyor
    const t = kayitOf(O.duzenStep(KARE, tersAgac(KARE), { eskizTers: true }), KARE);
    expect(t.siraKaynagi).toBe('kayis-yon');
    expect(kayitSira(t)).toEqual(['KRANK', 'KLİMA', 'OTOMATİK GERGİ', 'ALTERNATÖR']);
  });
  test('gergi seçilmedi: sebebi o', () => {
    const k = kayitOf(O.duzenStep(KARE, tersAgac(KARE)), KARE, true, { 'OTOMATİK GERGİ': 'fead-idler' });
    expect(k.siraKaynagi).toBe('kayis-yon');
    expect(siraUyari(k)[0]).toMatch(/dönüş yönü belirsiz \(gergi seçilmedi\)/);
  });
});

// ═════════════════════════════════════════════════════════════════════════
// SİHİRBAZ: kullanıcının yolu — dosya → 3B'de rol (KAYIŞ SIRASIYLA verilir,
// kod bunu kullanmaz) → hesapla → aktar → Modeli kur.
const akis = (duzen, agac, opt = {}) => {
  kabuk(); wiz.veFeadWizReset();
  wiz.veFeadWizStpOku(O.duzenStep(duzen, agac, opt), 'SIRA.stp');
  const s = wiz.veFeadWizStp();
  duzen.forEach((k) => {
    const i = s.sonuc.agac.findIndex((d) => d.ad === k.ad);
    if (s.roller[i] !== k.rol) wiz.veFeadWizStpRol(i, k.rol);   // gergi okunurken önceden atanabilir
  });
  if (opt.kayisRol !== false) wiz.veFeadWizStpRol(s.sonuc.agac.findIndex((d) => /^KAYIŞ/.test(d.ad)), 'fead-belt');
  expect(wiz.veFeadWizStpHesapla().ok).toBe(true);
  return wiz.veFeadWizStp();
};
const sihirbazSira = () => {
  const st = wiz.veFeadWizState();
  const ad = (k) => (k === '__ten__' ? st.ten.name : st.pulleys.find((p) => p.key === k).name);
  return M.veFeadRouteFlip(wiz.veFeadWizRoute(st)).map(ad);
};
// Sahte kanvas GERÇEĞİN TAZELEMESİYLE: gerçek `createNode` her düğümde
// kartları tazeliyor ve tazeleme köprüden geçip sırayı YARIM modelde 1..N'e
// oturtuyor (`veFeadBuildSystem` → `veFeadNormalizeBeltOrder`). Tazelemesiz
// sahte bu halkayı hiç koşturmuyordu — sihirbazın birim testi yeşilken
// gerçek tarayıcıda kurulan sıra dizinin sırasıydı (ölçüldü).
const sahteKanvas = () => {
  kabuk();
  global.nodes = []; global.connections = [];
  let k = 0;
  global.createNode = (type, x, y) => {
    const d = componentDefs[type] || {};
    if (d.maxInstances && global.nodes.filter((n) => n.type === type).length >= d.maxInstances) return null;
    const n = { id: 'cv' + ++k, type, def: d, x, y, width: d.defaultWidth || 65, height: d.defaultHeight || 60, data: {} };
    global.nodes.push(n);
    M.veFeadBuildSystem(global.nodes);                  // gerçeğin kart tazelemesi
    return n;
  };
  global.createConnection = () => null;
};
const kur = () => {
  sahteKanvas();
  expect(wiz.veFeadWizCreate()).toBeTruthy();
  delete global.createNode; delete global.createConnection;
  return M.veFeadBeltOrder(global.nodes).map((n) => n.customName);
};
const siraUyarisi = () => wiz.veFeadWizIssues(wiz.veFeadWizBuild(), 1)
  .filter((x) => x.m === wiz.VE_FW_SIRA_AGAC || x.m === wiz.VE_FW_SIRA_YON).map((x) => x.m);

describe('sihirbaz: aktarılan sıra eskizin sırası — topolojiye kadar', () => {
  test.each(['AG00686_1475_GATES_2023', 'AG00976_GATES_2025', 'AG00894_GATES_2023'])('%s', (key) => {
    const duzen = O.ornekDuzen(key);
    akis(duzen, tersAgac(duzen));
    wiz.veFeadWizStpAktar();
    expect(wiz.veFeadWizState().siraKaynagi).toBe('kayis');
    expect(sihirbazSira()).toEqual(tabloAd(duzen));
    // eskizden okunan sıra bir varsayım DEĞİL: onay istenmez, durum söylenir
    expect(siraUyarisi()).toEqual([]);
    const d = html(wiz.veFeadWizStepHTML(1, wiz.veFeadWizBuild()));
    expect(d.querySelector('#ve-fw-sira-onay')).toBeNull();
    const satir = d.querySelector('.ve-fw-kl-onay[data-kaynak="kayis"]');
    expect(satir).not.toBeNull();
    expect(satir.textContent.trim()).toBe('Sıra kayışın eskizinden okundu');
    // MODELİ KUR: tuvaldeki kasnakların `beltIndex`i aynı sıra
    expect(kur()).toEqual(tabloAd(duzen));
  });

  test('kayışa rol verilmezse ağaç sırası — uyarı ve onay düğmesi duruyor', () => {
    const duzen = O.ornekDuzen('AG00686_1475_GATES_2023');
    akis(duzen, tersAgac(duzen), { kayisRol: false });
    wiz.veFeadWizStpAktar();
    expect(wiz.veFeadWizState().siraKaynagi).toBe('agac');
    expect(sihirbazSira()).toEqual(['KRANK KASNAĞI', 'KLİMA KOMPRESÖRÜ', 'AVARA', 'OTOMATİK GERGİ T38624']);
    expect(siraUyarisi()).toEqual([wiz.VE_FW_SIRA_AGAC]);
    expect(html(wiz.veFeadWizStepHTML(1, wiz.veFeadWizBuild())).querySelector('.ve-fw-kl-onay[data-kaynak="agac"] #ve-fw-sira-onay'))
      .not.toBeNull();
  });

  test('yön belirsiz: kendi uyarısı ve onayı; onay kaldırır', () => {
    akis(KARE, tersAgac(KARE));
    wiz.veFeadWizStpAktar();
    expect(wiz.veFeadWizState().siraKaynagi).toBe('kayis-yon');
    expect(siraUyarisi()).toEqual([wiz.VE_FW_SIRA_YON]);
    const d = html(wiz.veFeadWizStepHTML(1, wiz.veFeadWizBuild()));
    const satir = d.querySelector('.ve-fw-kl-onay[data-kaynak="kayis-yon"]');
    expect(satir.textContent).toMatch(/Sıra eskizden, yön belirsiz/);
    expect(satir.querySelector('#ve-fw-sira-onay').getAttribute('title')).toBe(wiz.VE_FW_SIRA_YON);
    expect(wiz.veFeadWizSiraOnay()).toBe(true);
    expect(siraUyarisi()).toEqual([]);
    expect(html(wiz.veFeadWizStepHTML(1, wiz.veFeadWizBuild())).querySelector('.ve-fw-kl-onay')).toBeNull();
  });
});

// ═════════════════════════════════════════════════════════════════════════
// MODELİ KUR SİHİRBAZIN SIRASINI KURAR — dizinin değil. Kasnaklar sihirbazın
// DİZİSİNDE kuruluyor, sıra rotada; ayrıştıkları her yol aynı kapıdan geçer.
describe('Modeli kur: kurulan sıra sihirbazın gösterdiği sıra', () => {
  test('↑ ↓ ile elle değiştirilen sıra (örnekten dolan sihirbaz)', () => {
    kabuk(); wiz.veFeadWizSeed('AG00976_GATES_2025');
    const r = wiz.veFeadWizRoute(wiz.veFeadWizState());
    expect(wiz.veFeadWizRouteMove(r[2], 1)).toBe(true);
    const bek = sihirbazSira();
    expect(bek).toEqual(['Sürücü Kasnak (FAN)', 'Avara 1', 'Klima Kompresörü', 'Alternatör (155 A)', 'Avara 2',
      'Otomatik Gergi (E9843)']);
    expect(kur()).toEqual(bek);
  });
  test('CW/CCW ile çevrilen sıra', () => {
    kabuk(); wiz.veFeadWizSeed('AG00894_GATES_2023');
    wiz.veFeadWizRouteReverse();
    const bek = sihirbazSira();
    expect(kur()).toEqual(bek);
  });
  test('örnek olduğu gibi: sıra değişmez', () => {
    kabuk(); wiz.veFeadWizSeed('AG00976_GATES_2025');
    const bek = sihirbazSira();
    expect(kur()).toEqual(bek);
  });
});

// ═════════════════════════════════════════════════════════════════════════
// AKTARMADAN ÖNCE GÖRÜNÜR: 3B tablosu, kartın çizimi ve ağaç tablosu kaydın
// sırasını numaralar — aktarılacak olanı (veFeadWizStpSira → veFeadStpKayit).
describe('aktarılacak sıra aktarmadan ÖNCE görünür', () => {
  const duzen = O.ornekDuzen('AG00976_GATES_2025');
  const kasnakAd = (s, i) => s.coz.kasnaklar[i].ad;

  test('3B tablosu satırları sırayla dizer ve numaralar; kaynağı altında', () => {
    const s = akis(duzen, tersAgac(duzen));
    const d = html(G.veFeadWiz3bPanelHTML(s, -1));
    const satir = [...d.querySelectorAll('tr[data-ve-3b-kasnak]')];
    expect(satir.map((r) => kasnakAd(s, +r.getAttribute('data-ve-3b-kasnak')))).toEqual(tabloAd(duzen));
    expect(satir.map((r) => r.querySelector('[data-ve-3b-sira]').textContent)).toEqual(['1', '2', '3', '4', '5', '6']);
    // Ø sütunu yerinde (numara ilk hücrenin İÇİNDE, yeni sütun değil)
    expect(satir[0].children[1].textContent).toBe('162,0');
    const p = d.querySelector('[data-ve-3b-sira-kaynak]');
    expect(p.getAttribute('data-ve-3b-sira-kaynak')).toBe('kayis');
    expect(p.textContent.trim()).toBe('Sıra kayışın eskizinden');
  });

  test('kartın çizimi ve ağaç tablosu AYNI numaraları basar; aktarım o sırayı kurar', () => {
    const s = akis(duzen, tersAgac(duzen));
    const sr = wiz.veFeadWizStpSira(s);
    expect(sr.kaynak).toBe('kayis');
    const bek = {};
    duzen.forEach((k, j) => { bek[k.ad] = String(j + 1); });
    const cizim = html(wiz._fwStpCizimSVG(s));
    const g = [...cizim.querySelectorAll('g[data-ve-stp-kasnak]')];
    expect(g).toHaveLength(6);
    g.forEach((e) => {
      expect(e.querySelector('[data-ve-stp-sira]').textContent).toBe(bek[kasnakAd(s, +e.dataset.veStpKasnak)] + ' · ');
    });
    const kart = html(wiz.veFeadWizStepHTML(0, wiz.veFeadWizBuild()));
    const rozet = [...kart.querySelectorAll('.ve-fw-tbl-stp [data-ve-stp-sira]')];
    expect(rozet.map((r) => r.closest('tr').querySelector('td').textContent.trim()))
      .toEqual(tersAgac(duzen).filter((a) => a !== 'KAYIS'));            // ağacın sırasında satır
    expect(rozet.map((r) => r.textContent)).toEqual(tersAgac(duzen).filter((a) => a !== 'KAYIS').map((a) => bek[a]));
    wiz.veFeadWizStpAktar();
    expect(sihirbazSira()).toEqual(tabloAd(duzen));
  });

  test('kayışa rol verilmeden: numara ağaç sırası ve durum bunu SÖYLER', () => {
    const s = akis(duzen, tersAgac(duzen), { kayisRol: false });
    const p = html(G.veFeadWiz3bPanelHTML(s, -1)).querySelector('[data-ve-3b-sira-kaynak]');
    expect(p.getAttribute('data-ve-3b-sira-kaynak')).toBe('agac');
    expect(p.textContent.trim()).toBe('Sıra ağaçtan — kayışa rol verin');
    expect(p.getAttribute('title')).toMatch(/kayışa rol verilmedi/);
  });

  test('sıra çözümle önbelleklenir: aynı çözümde kayıt yeniden kurulmaz, rol değişince tazelenir', () => {
    const s = akis(duzen, tersAgac(duzen));
    const a = wiz.veFeadWizStpSira(s);
    expect(wiz.veFeadWizStpSira(s)).toBe(a);
    wiz.veFeadWizStpRol(s.sonuc.agac.findIndex((d) => /^KAYIŞ/.test(d.ad)), '');
    const b = wiz.veFeadWizStpSira(wiz.veFeadWizStp());
    expect(b).not.toBe(a);
    expect(b.kaynak).toBe('agac');
  });
});

// ═════════════════════════════════════════════════════════════════════════
describe('ağaç tablosu: rollü alt montajın parçası ikonla — ham HTML basılmaz', () => {
  test('gergi alt montajının parçaları', () => {
    kabuk(); wiz.veFeadWizReset();
    wiz.veFeadWizStpOku(O.gergiAltMontaj(), 'ALT.stp');
    const s = wiz.veFeadWizStp();
    const i = s.sonuc.agac.findIndex((d) => /GERG/.test(d.ad) && d.cocuklar.length);
    if (s.roller[i] !== 'fead-tensioner') wiz.veFeadWizStpRol(i, 'fead-tensioner');
    const d = html(wiz.veFeadWizStepHTML(0, wiz.veFeadWizBuild()));
    // KASNAK ve KOL: gergi biriminin parçaları (Kasnak sütunu birimi söyler)
    const alt = [...d.querySelectorAll('.ve-fw-tbl-stp tbody tr')].filter((r) => /birimi/.test(r.children[2].textContent));
    expect(alt.map((r) => r.children[0].textContent.trim())).toEqual(['KASNAK', 'KOL']);
    alt.forEach((r) => {
      const h = r.children[2];
      expect(h.textContent).not.toMatch(/<|mf-ico/);
      expect(h.querySelector('.mf-ico-corner-down-right')).not.toBeNull();
      expect(h.textContent.trim()).toBe('Otomatik Gergi birimi');
    });
  });
});
