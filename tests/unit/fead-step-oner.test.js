/**
 * fead-step-oner.test.js — GERGİ DOSYA OKUNUNCA BULUNUR (5.2)
 *
 * Kullanıcı sorusu (2026-09-28): *"Modeli attığımız zaman otomatik gergi
 * otomatik olarak bulunabilir mi?"* Ölçüldü: rol vermeden bütün birimleri
 * tarayan imza kullanıcının dosyasında 5 parçadan YALNIZ gergiyi işaretledi
 * (dosya depoda değil — aynı yapı sentetik montajlarla).
 *
 * Kapılar:
 *   · İMZA: kayış düzleminde bir avara + ona paralel, kol aralığında, disk
 *     dışında, göbekli bir pivot. Her kural bir tuzak montajda TEK BAŞINA yük
 *     taşır (R1 · R2 · R3 · R6 · R8 · RP) — kural kapatılınca o montaj yanlış
 *     işaretlenir
 *   · Bayrak en KÜÇÜK birime: alt montaj gergide rol üst düğüme
 *   · ÖNERİ bir karar değil: yalnız TEK aday varsa ve ad · kod · katalogdan biri
 *     de gergi diyorsa sihirbaz rolü önceden verir; adsız aday yalnız önerilir
 *   · Kullanıcı kaldırır ya da başka parçaya verir — otomatik atama söner
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

beforeEach(() => { resetStubs(stubs); global.nodes = []; global.connections = []; });

const kabuk = () => {
  document.body.innerHTML = '<div id="ve-canvas"></div>'
    + '<div id="ve-feadwiz-overlay" style="display:none;">'
    + '<div id="ve-fw-nav"></div><div id="ve-fw-body"></div><div id="ve-fw-foot"></div></div>';
};
const oner = (metin, opt) => S.veFeadStpOner(S.veFeadStpOku(metin), opt);
const adlar = (r) => r.adaylar.map((a) => a.ad);

describe('İMZA — kullanıcının dosyasının kalıbında', () => {
  test('AG00686: yalnız gergi; kol 90, Ø75 düz; ad · kod · katalog uyuşuyor', () => {
    for (const metin of [O.ag00686Step(), O.ag00686Step({ motor: '-X' }), O.ag00686Step({ uzunluk: 'inch', aci: 'derece' })]) {
      const r = oner(metin);
      expect(adlar(r)).toEqual(['OTOMATİK GERGİ-T38624']);
      expect(r.gergi.kol).toBeCloseTo(90, 6);
      expect(r.gergi.od).toBeCloseTo(75, 6);                  // inç dosyası dönüşüm gürültüsü taşır
      expect(r.gergi).toMatchObject({ tur: 'duz', kod: 'T38624', adDiyor: true });
      expect(r.gergi.uyusan).toEqual(['ad', 'kod', 'katalog']);
    }
  });
  test('alt montaj gergi: bayrak ALT MONTAJA (kasnak ve kol ayrı parça)', () => {
    const o = S.veFeadStpOku(O.gergiAltMontaj());
    const r = S.veFeadStpOner(o);
    expect(adlar(r)).toEqual(['OTOMATİK GERGİ']);
    expect(o.agac[r.gergi.dugum].cocuklar.length).toBe(2);
  });
  test('gergi parçası ara montajın içinde: bayrak PARÇAYA, ara montaja değil', () => {
    const r = oner(O.gergiIcIceMontaj());
    expect(adlar(r)).toEqual(['OTOMATİK GERGİ']);
    expect(r.gergi.kol).toBeCloseTo(90, 6);
  });
  test('İKİ gergi adayı: ikisi de listede, hiçbiri önerilmez (hangisi belli değil)', () => {
    const r = oner(O.feadStep([
      { id: 'K', ad: 'KRANK', x: 0, y: 0, geometri: [{ profil: require('../helpers/step-yaz.js').kanalliProfil({ od: 150, n: 8 }) }] },
      O.gergiParcasi('OTOMATİK GERGİ-T38624', { x: -150, y: 100 }, { x: -200, y: 170 }, { id: 'G1', pivotYuz: 9 }),
      O.gergiParcasi('OTOMATİK GERGİ-T38624', { x: 180, y: 120 }, { x: 250, y: 60 }, { id: 'G2', pivotYuz: 9 }),
    ]));
    expect(r.adaylar).toHaveLength(2);
    expect(r.gergi).toBeNull();
  });
  test('adsız, kataloğa uymayan gergi BULUNUR ama uyuşan yok — yalnız önerilir', () => {
    const r = oner(O.tuzak('kaburgaliGergiKol56'));
    expect(r.adaylar).toHaveLength(1);
    expect(r.gergi.kol).toBeCloseTo(56, 6);
    expect(r.gergi.uyusan).toEqual([]);
  });
});

describe('TUZAKLAR — her kural bir montajda tek başına yük taşır', () => {
  // [montaj, kapatılınca yanlış işaretleten kural]
  const vakalar = [
    ['ikinciKayisGergisi', 'RP'],      // ikinci kayışın gergisi: avara bu kayışın düzleminde değil
    ['alternatorKulakR22', 'R8'],      // gövdesi kasnağıyla eşeksenli, kulak göbeği r 22
    ['diskIciGobek', 'R1'],            // göbek kasnak diskinin İÇİNDE
    ['alternatorKulakR12', 'R2'],      // kulak göbeği r 12 — göbek değil
    ['disaridaEsGobek', 'R3'],         // disk dışında üç EŞ göbek — bağlantı flanşı
    ['uzakKulak', 'R4'],               // kulak 300 mm'de — kol aralığının dışında
    ['esEksenBraket', 'R5'],           // braketin göbeği başka bir kasnakla eşeksenli
    ['ciftAvaraFarkli', 'R6'],         // iki avaralı braket: "pivot" öteki avara
  ];
  test.each(vakalar)('%s: bütün kurallar açıkken aday YOK, %s kapanınca yanlış aday', (ad, kural) => {
    const metin = O.tuzak(ad);
    expect(oner(metin).adaylar).toEqual([]);
    expect(oner(metin, { kapali: [kural] }).adaylar.length).toBeGreaterThan(0);
  });
  test('krankın cıvata dairesi, iki izli damper, kaburgalı avara: aday yok', () => {
    for (const ad of ['krankCivataDairesi', 'ikiIzliDamper', 'kaburgaliAvara'])
      expect([ad, oner(O.tuzak(ad)).adaylar]).toEqual([ad, []]);
  });
});

describe('SİHİRBAZ — öneri bir karar değil', () => {
  const oku = (metin) => { kabuk(); wiz.veFeadWizReset(); return wiz.veFeadWizStpOku(metin, 'X.stp'); };
  test('uyuşan aday: gergi rolü ÖNCEDEN verilir ve işaretli; diğerleri rolsüz', () => {
    const s = oku(O.ag00686Step());
    const g = s.sonuc.agac.findIndex((d) => /GERG/.test(d.ad));
    expect(s.roller.filter(Boolean)).toEqual(['fead-tensioner']);
    expect(s.roller[g]).toBe('fead-tensioner');
    expect(s.otomatik).toMatchObject({ dugum: g, tip: 'fead-tensioner' });
    // kart ve 3B işareti taşır
    expect(wiz.veFeadWizStepHTML(0, null)).toMatch(/data-ve-otomatik="1"/);
    expect(G.veFeadWiz3bPanelHTML(s, g)).toMatch(/otomatik bulundu/);
  });
  test('uyuşmayan aday rol ALMAZ; öneri satırı ve tek tıkla ver', () => {
    const s = oku(O.tuzak('kaburgaliGergiKol56'));
    expect(s.roller.filter(Boolean)).toEqual([]);
    expect(s.otomatik).toBeNull();
    expect(wiz.veFeadWizStepHTML(0, null)).toMatch(/Gergi olabilir/);
    wiz.veFeadWizStpOneriUygula();
    expect(s.roller.filter(Boolean)).toEqual(['fead-tensioner']);
  });
  test('kullanıcı kaldırırsa ya da başka parçaya verirse otomatik atama söner', () => {
    let s = oku(O.ag00686Step());
    const g = s.otomatik.dugum;
    wiz.veFeadWizStpRol(g, '');
    expect(s.otomatik).toBeNull();
    expect(s.roller.filter(Boolean)).toEqual([]);
    s = oku(O.ag00686Step());
    const avara = s.sonuc.agac.findIndex((d) => /AVARA/.test(d.ad));
    wiz.veFeadWizStpRol(avara, 'fead-tensioner');       // kullanıcının seçimi kazanır
    expect(s.roller[s.sonuc.agac.findIndex((d) => /GERG/.test(d.ad))]).toBeNull();
    expect(s.roller.filter(Boolean)).toEqual(['fead-tensioner']);
    expect(s.otomatik).toBeNull();
  });
});
