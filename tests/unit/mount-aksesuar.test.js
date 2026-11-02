/**
 * mount-aksesuar.test.js — MOTORUN AKSESUARLARI (2026-11-02)
 * ─────────────────────────────────────────────────────────────────────────
 * Kullanıcı: "Aksesuarlar için ayrı bir 'aksesuar' bileşeni açmamamız lazım.
 * Her aksesuarı (alternatör, klima kompresörü vb) ayrı ayrı tanımlamamız
 * lazım. Bu aksesuarların ağırlıkları ve ağırlık merkezleri genelde teknik
 * resim üzerinden okunabiliyor fakat bazı aksesuarların ağırlık merkezi
 * olmuyor. Bu tarz durumlarda aksesuarın orta noktasını kabul ediyoruz."
 * Liste kullanıcının Ağırlık Merkezi Hesaplama Programı'nın motor parçaları
 * ("Motor üzerinde genelde bunlar kullanılıyor"): Alternatör · Alternatör
 * Braketi · Klima Kompresörü · Isı Sacı.
 * Önce (main 7c94ad5): Takoz'da aksesuar bileşeni yoktu (sentetik örnekler
 * "Alternatör + klima"yı Pompa olarak taşıyordu), STEP'te aksesuar rolü yoktu.
 *
 *   · TİPLER — dört tip, her biri ayrı bileşen; gövde + taşınan; nokta kütle
 *     varsayılan; paletin "Motor aksesuarları" grubu; sihirbazın gövde
 *     tipleri, STEP rolleri ve 3B renkleri.
 *   · TAŞIYICI — aksesuar motora bağlanır (şanzıman daha yakın olsa da);
 *     PTO/Pompa en yakın gövdeye; motor yoksa en yakın gövdeye.
 *   · ÇÖZÜCÜ — aksesuar çözücünün kütle listesinde (nokta kütle).
 *   · ORTA NOKTA — STEP'te ağırlık merkezi dış ölçülerin (kutunun) merkezi,
 *     hacim merkezi DEĞİL; açık kabukta da; atalet yok; kayıtta nokta kütle
 *     ve "S" notu "orta nokta".
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
const STP = require('../../js/mount-step.js');
Object.keys(STP).forEach((k) => { if (global[k] === undefined) global[k] = STP[k]; });
global.veSayi = require('../../js/sayi.js').veSayi;
eval(loadSource('cp-mount-wizard.js'));
const W = module.exports;
eval(loadSource('cp-mount-3b.js'));
const M3 = module.exports;
const S = require('../helpers/step-takoz.js');

const AKS = ['mnt-alternator', 'mnt-alt-bracket', 'mnt-ac', 'mnt-heat-shield'];
const ADLAR = ['Alternatör', 'Alternatör Braketi', 'Klima Kompresörü', 'Isı Sacı'];
const uz = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

beforeEach(() => resetStubs(stubs));

// ── TİPLER ─────────────────────────────────────────────────────────────────
describe('TİPLER — her aksesuar ayrı bileşen', () => {
  test('dört tip, adlarıyla; kütle gövdesi + motorun taşıdığı; nokta kütle varsayılan', () => {
    expect(Object.keys(componentDefs).filter((t) => componentDefs[t].isMountAksesuar)).toEqual(AKS);
    expect(AKS.map((t) => componentDefs[t].name)).toEqual(ADLAR);
    AKS.forEach((t) => {
      expect(componentDefs[t]).toMatchObject({ isMountBody: true, isMountCarried: true });
      expect(componentDefs[t].isMount).toBeFalsy();
      expect(cp._MNT_POINTMASS_DEFAULT[t]).toBe(1);
      expect(componentDefs[t].svg).not.toMatch(/<text/);                         // harf çizgiyle (ikon kuralı)
    });
    // tek "Aksesuar" bileşeni YOK
    expect(Object.keys(componentDefs).filter((t) => /aksesuar|accessory/i.test(t) && /^mnt-/.test(t))).toEqual([]);
  });

  test('paletin "Motor aksesuarları" grubu: dört satır, componentDefs\'in adlarıyla, Takoz kapsamında', () => {
    const html = fs.readFileSync(path.join(KOK, 'index.html'), 'utf8');
    const i = html.indexOf('<div class="ve-category-title">Motor aksesuarları</div>');
    expect(i).toBeGreaterThan(0);
    const bas = html.lastIndexOf('<div class="ve-category"', i), son = html.indexOf('\n          </div>\n', i);
    expect(html.slice(bas, i)).toContain('data-ve-scope="mount-analysis"');
    const blok = html.slice(i, son);
    expect([...blok.matchAll(/data-type="([^"]+)"/g)].map((m) => m[1])).toEqual(AKS);
    expect([...blok.matchAll(/<span class="ve-comp-label">([^<]+)<\/span>/g)].map((m) => m[1])).toEqual(ADLAR);
  });

  test('sihirbazın gövde tipleri, STEP rolleri ve 3B rengi her aksesuarı taşır', () => {
    AKS.forEach((t) => {
      expect(W.VE_MW_GOVDE_TIPLERI || VE_MW_GOVDE_TIPLERI).toContain(t);
      expect(STP.VE_MNT_STP_ROLLER).toContain(t);
      expect(STP.veMntStpAksesuar(t)).toBe(true);
      expect(M3.VE_MW_3B_ROL_RENK[t]).toMatch(/^--/);
    });
    expect(STP.VE_MNT_STP_AKSESUAR).toEqual(AKS);
    ['mnt-motor', 'mnt-pump', 'mnt-mount'].forEach((t) => expect(STP.veMntStpAksesuar(t)).toBe(false));
  });
});

// ── TAŞIYICI ───────────────────────────────────────────────────────────────
describe('TAŞIYICI — aksesuar motora civatalı', () => {
  const ogeler = (motor) => [
    motor ? { id: 'm', kind: 'mnt-motor', lx: 0, ly: 0 } : null,
    { id: 'g', kind: 'mnt-gearbox', lx: 400, ly: 0 },
    { id: 'a', kind: 'mnt-alternator', lx: 380, ly: 60 },
    { id: 'k', kind: 'mnt-ac', lx: 360, ly: -70 },
    { id: 'p', kind: 'mnt-pump', lx: 380, ly: -60 },
    { id: 't1', kind: 'mnt-mount', lx: 0, ly: 200 },
    { id: 't2', kind: 'mnt-mount', lx: 400, ly: 200 }
  ].filter(Boolean);
  const hedef = (L, id) => L.links.filter((l) => l.from === id).map((l) => l.to);

  test('şanzıman daha yakın olsa da aksesuar motora; Pompa en yakın gövdeye (şanzıman)', () => {
    const L = cp._mntComputeSupportLinks(ogeler(true));
    expect([hedef(L, 'a'), hedef(L, 'k'), hedef(L, 'p')]).toEqual([['m'], ['m'], ['g']]);
    // takoz asla aksesuara asılmaz
    expect(L.links.filter((l) => l.to === 'a' || l.to === 'k')).toEqual([]);
  });

  test('motor yoksa en yakın ana gövdeye', () => {
    const L = cp._mntComputeSupportLinks(ogeler(false));
    expect([hedef(L, 'a'), hedef(L, 'k')]).toEqual([['g'], ['g']]);
  });
});

// ── ÇÖZÜCÜ ─────────────────────────────────────────────────────────────────
describe('ÇÖZÜCÜ — aksesuar kütle listesinde', () => {
  test('aksesuar düğümü çözücünün kütle listesine nokta kütle olarak girer', () => {
    const liste = [
      { id: 'm', type: 'mnt-motor', data: { mass: 385, cgx: 0, cgy: 0, cgz: 500, Ixx: 14.7, Iyy: 25, Izz: 19.1 } },
      { id: 'a', type: 'mnt-alternator', customName: 'Alternatör', data: { mass: 9, cgx: -400, cgy: 260, cgz: 760, pointMass: true } },
      { id: 's', type: 'mnt-heat-shield', data: { mass: 1.358, cgx: 300, cgy: -300, cgz: 400, pointMass: true } }
    ];
    const G = cp._mntGatherForSolver(null, liste);
    expect(G.components.map((c) => [c.id, c.mass, c.pointMass])).toEqual([['m', 385, false], ['a', 9, true], ['s', 1.358, true]]);
    expect(G.mounts).toEqual([]);
  });
});

// ── ORTA NOKTA ─────────────────────────────────────────────────────────────
// Alternatör iki parçalı alt montaj (gövde + öne taşan kasnak): dış ölçülerin
// merkezi x'te −15, hacim merkezi −4,27 (montajın yerelinde) — ikisi ayrışır.
// Isı sacı AÇIK kabuk (üst yüzü yok — sac yüzey modeli): hacmi yok, orta noktası var.
describe('ORTA NOKTA — STEP\'te aksesuarın ağırlık merkezi dış ölçülerin merkezi', () => {
  const ALT = [-420, 260, 760];
  const stp = S.guçGrubuStep([
    { id: 'MOTOR', ad: 'Motor bloğu', sekil: 'kutu', olcu: [700, 500, 600], konum: [0, 0, 600] },
    { id: 'ALT-GOVDE', ad: 'Alternatör gövdesi', sekil: 'kutu', olcu: [160, 150, 170], konum: [0, 0, 0], alt: 'ALT_ASM' },
    { id: 'ALT-KASNAK', ad: 'Alternatör kasnağı', sekil: 'kutu', olcu: [30, 80, 80], konum: [-95, 0, 0], alt: 'ALT_ASM' },
    { id: 'SAC', ad: 'Isı sacı', sekil: 'acik-kutu', olcu: [260, 120, 120], konum: [300, -300, 400] }
  ], { altMontajlar: [{ id: 'ALT_ASM', ad: 'Alternatör', konum: ALT }] });
  const son = STP.veMntStpOku(stp);
  const ROL = { 'Motor bloğu': 'mnt-motor', 'Alternatör': 'mnt-alternator', 'Isı sacı': 'mnt-heat-shield' };
  const roller = son.agac.map((d) => ROL[d.ad] || null);
  const coz = STP.veMntStpCoz(son, roller, {});
  const birim = (ad) => coz.birimler.filter((b) => b.ad === ad)[0];

  test('alternatör: konum kutunun merkezi (−435; 260; 760), hacim merkezinden 10 mm\'den fazla uzak; kaynak "orta"', () => {
    const b = birim('Alternatör');
    expect(b.kaynak).toBe('orta');
    expect(uz(b.konum, [ALT[0] - 15, ALT[1], ALT[2]])).toBeLessThan(1e-6);
    const Vg = 160 * 150 * 170, Vk = 30 * 80 * 80;
    expect(uz(b.c, [ALT[0] + (Vk * -95) / (Vg + Vk), ALT[1], ALT[2]])).toBeLessThan(1e-6);   // hacim merkezi ayrı
    expect(Math.abs(b.konum[0] - b.c[0])).toBeGreaterThan(10);
  });

  test('ısı sacı açık kabuk: orta noktası var, hacim uyarısı yok', () => {
    const b = birim('Isı sacı');
    expect(b.kapali).toBe(false);
    expect(b.kaynak).toBe('orta');
    expect(uz(b.konum, [300, -300, 400])).toBeLessThan(1e-6);
    expect(coz.uyarilar.filter((m) => m.indexOf('Isı sacı') >= 0)).toEqual([]);
  });

  test('motor hacim merkezinden (aksesuar kuralı motora uygulanmaz)', () => {
    expect(birim('Motor bloğu').kaynak).toBe('hacim');
  });

  test('kütle elle ya da malzemeden; atalet YOK (nokta kütle)', () => {
    const b = birim('Alternatör');
    expect(STP.veMntStpKutle(b, '9', '')).toMatchObject({ kaynak: 'elle', m: 9, I: null });
    const K = STP.veMntStpKutle(b, undefined, 'celik');
    expect(K.kaynak).toBe('malzeme');
    expect(K.m).toBeCloseTo(7850 * (160 * 150 * 170 + 30 * 80 * 80) * 1e-9, 9);
    expect(K.I).toBe(null);
    // motor (gövde) atalet alır — kural yalnız aksesuarda
    expect(STP.veMntStpKutle(birim('Motor bloğu'), '385', '').I).not.toBe(null);
  });

  test('kayıt: aksesuar nokta kütle, ağırlık merkezi "S" notu "orta nokta"; yazılan kütle "S" değil', () => {
    const a = son.agac.findIndex((d) => d.ad === 'Alternatör'), m = son.agac.findIndex((d) => d.ad === 'Isı sacı');
    const k = STP.veMntStpKayit(coz, { [a]: 9, [m]: 1.358 }, {});
    const i = k.liste.findIndex((n) => n.dugum === a);
    expect(k.liste[i]).toMatchObject({ type: 'mnt-alternator', customName: 'Alternatör',
      data: { cgx: ALT[0] - 15, cgy: ALT[1], cgz: ALT[2], mass: 9, pointMass: true } });
    expect(k.liste[i].data.Ixx).toBeUndefined();
    expect(k.kaynak[i]).toEqual({ cg: true, not: 'orta nokta' });
    // malzemeden kütle: "S" kütlede de, not malzemeyi de söyler
    const k2 = STP.veMntStpKayit(coz, {}, { [a]: 'celik' });
    const j = k2.liste.findIndex((n) => n.dugum === a);
    expect(k2.kaynak[j]).toMatchObject({ cg: true, mass: true });
    expect(k2.kaynak[j].not).toMatch(/^orta nokta · Çelik/);
  });
});

// ── KATALOG ────────────────────────────────────────────────────────────────
// Programda kayıtlı aksesuarların (js/fead-accessories.js — FEAD künyesi,
// anahtar BMC parça numarası) kütlesi üreticinin belgesinden; klima
// kompresöründe kavramalı. Bulunamayan null ve listede görünmez.
describe('KATALOG — kayıtlı aksesuarın kütlesi', () => {
  const ACC = require('../../js/fead-accessories.js');
  const KLIMA = [['57RS321633', 'Valeo TM21', 8.1], ['55100000130', 'Valeo TM31', 15.5],
                 ['57RS319930', 'Sanden 7H15', 6.9], ['57RS322530', 'Valeo TM31', 15.5]];

  test('klima kompresörleri: kavramalı kütle üreticinin belgesinden, kaynağıyla', () => {
    expect(STP.veMntStpAksKatalog('mnt-ac').map((a) => [a.key, a.ad, a.kg])).toEqual(KLIMA);
    STP.veMntStpAksKatalog('mnt-ac').forEach((a) => expect(a.kgKaynak).toMatch(/^(Valeo|Sanden) · .*kavramalı$/));
  });

  // Alternatör: AYNI AKIM AYNI ALTERNATÖR (kullanıcı: "hepsi 180A ise aynıdır.
  // Fark yoktur."); kütle akımın Prestolite 24 V ailesinden
  const ALT = [['57RS317093', 'Prestolite 180A', 9.8], ['57RS309791', 'Prestolite 120A', 8.16],
               ['57RS309036', 'Prestolite 155A', 16.18], ['57RS309348', 'Prestolite 155A', 16.18],
               ['57RS318932', 'Prestolite 180A', 9.8], ['57RS320300', 'Prestolite 180A', 9.8],
               ['54100000001', 'Prestolite 250A', 17.7], ['57RS322565', 'Prestolite 600A', 42]];
  test('alternatör: sekiz kayıt kütleli (Prestolite 24 V aileleri); 140 A ve Tepaş 350 A boş', () => {
    expect(STP.veMntStpAksKatalog('mnt-alternator').map((a) => [a.key, a.ad, a.kg])).toEqual(ALT);
    expect(ACC.VE_FEAD_ACC_DB.filter((a) => a.tip === 'alternator' && !(a.kg > 0)).map((a) => a.ad))
      .toEqual(['Tepaş 350A', 'Prestolite 140A']);
    STP.veMntStpAksKatalog('mnt-alternator').forEach((a) => expect(a.kgKaynak).toMatch(/^Prestolite · /));
  });

  test('AYNI AD AYNI KÜTLE: aynı akımdaki (aynı adlı) kayıtların kütlesi ve kaynağı aynı', () => {
    const grup = {};
    ACC.VE_FEAD_ACC_DB.forEach((a) => { (grup[a.ad] = grup[a.ad] || []).push(a); });
    Object.keys(grup).forEach((ad) => {
      const L = grup[ad];
      expect({ ad, kg: [...new Set(L.map((a) => a.kg == null ? null : a.kg))] }).toEqual({ ad, kg: [L[0].kg == null ? null : L[0].kg] });
      expect({ ad, kaynak: [...new Set(L.map((a) => a.kgKaynak || null))].length }).toEqual({ ad, kaynak: 1 });
    });
    expect(grup['Prestolite 180A'].length).toBe(3);
  });

  test('kütlesi bilinmeyen kayıt listede yok; kütle ya null ya pozitif; yalnız iki aile', () => {
    ACC.VE_FEAD_ACC_DB.forEach((a) => {
      expect(a.kg === undefined || a.kg === null || a.kg > 0).toBe(true);
      if (a.kg > 0) expect(typeof a.kgKaynak).toBe('string');
    });
    const say = (tip) => ACC.VE_FEAD_ACC_DB.filter((a) => a.tip === tip && a.kg > 0).length;
    expect(STP.veMntStpAksKatalog('mnt-alternator').length).toBe(say('alternator'));
    ['mnt-alt-bracket', 'mnt-heat-shield', 'mnt-motor'].forEach((t) => expect(STP.veMntStpAksKatalog(t)).toEqual([]));
  });

  test('anahtar yalnız kendi ailesinde geçerli; kütle kaynağı "katalog", atalet yok', () => {
    expect(STP.veMntStpAks('57RS321633', 'mnt-ac').kg).toBe(8.1);
    expect(STP.veMntStpAks('57RS321633', 'mnt-alternator')).toBe(null);
    expect(STP.veMntStpAks('yok', 'mnt-ac')).toBe(null);
    const b = { tip: 'mnt-ac', kaynak: 'orta', kapali: true, V: 1e6, J: [[1, 0, 0], [0, 1, 0], [0, 0, 1]] };
    expect(STP.veMntStpKutle(b, '20', '57RS321633')).toMatchObject({ kaynak: 'katalog', m: 8.1, I: null,
      not: 'Valeo TM21 · 57RS321633' });
  });

  test('pencere: "Kayıtlı aksesuar" seçimi kütleyi yazar (TEK geri-al adımı); "— elle gir —" yalnız bağı çözer', () => {
    global.nodes = [{ id: 'k1', type: 'mnt-ac', def: componentDefs['mnt-ac'], data: {} }];
    const el = document.createElement('div');
    el.innerHTML = cp.getMntMassPropertiesHTML(global.nodes[0]);
    const sec = el.querySelector('#ve-mnt-aks-k1');
    expect(Array.from(sec.options).map((o) => o.value)).toEqual([''].concat(KLIMA.map((k) => k[0])));
    expect(cp.veMntAksUygula('k1', '57RS321633')).toBe(true);
    expect(global.nodes[0].data).toMatchObject({ aksKatalog: '57RS321633', mass: 8.1 });
    expect(stubs.saveState).toHaveBeenCalledTimes(1);
    expect(cp.veMntAksUygula('k1', 'yok')).toBe(false);
    expect(cp.veMntAksUygula('k1', '')).toBe(true);
    expect(global.nodes[0].data).toEqual(expect.objectContaining({ mass: 8.1 }));
    expect(global.nodes[0].data.aksKatalog).toBeUndefined();
    // Isı Sacı'nın kayıtlı modeli yok: bölüm de yok
    global.nodes = [{ id: 'h1', type: 'mnt-heat-shield', def: componentDefs['mnt-heat-shield'], data: {} }];
    el.innerHTML = cp.getMntMassPropertiesHTML(global.nodes[0]);
    expect(el.querySelector('select[id^="ve-mnt-aks-"]')).toBe(null);
  });

  test('STEP kütle kaynağı: klima rolünde "Katalog" grubu; başka rolün anahtarı kayda yazılmaz', () => {
    const b = { tip: 'mnt-ac', dugum: 7, ad: 'Klima', kapali: false, V: 0, say: { ag: 1, dosya: 0, nokta: 0 }, yogSay: 0 };
    const el = document.createElement('div');
    el.innerHTML = _mwStpKaynakSecHTML({ yogunluk: {} }, b, '57RS319930');
    const g = el.querySelector('optgroup[label="Katalog"]');
    expect(Array.from(g.querySelectorAll('option')).map((o) => [o.value, o.textContent]))
      .toEqual(KLIMA.map((k) => [k[0], k[1] + ' · ' + k[0]]));
    expect(g.querySelector('option[value="57RS319930"]').selected).toBe(true);
  });
});

// ── KAYITLI ROLLER — dosya açık değilken kaynağı okunur ──────────────────
describe('KAYITLI ROLLER — kayıtlı aksesuarın modeli ve kütlesi', () => {
  test('rol kaydında klima kompresörünün kaynağı katalog anahtarı: hücre model · kütle; başka rolde yazılmaz', () => {
    const CAD = require('../../js/cp-mount-cad.js');
    const stp = S.guçGrubuStep([{ id: 'KLIMA', ad: 'Klima kompresörü', sekil: 'kutu', olcu: [180, 140, 140], konum: [0, 0, 0] }]);
    const son = STP.veMntStpOku(stp);
    const i = son.agac.findIndex((d) => d.ad === 'Klima kompresörü');
    const roller = son.agac.map((d, j) => (j === i ? 'mnt-ac' : null));
    const k = STP.veMntStpRolKaydi(son, roller, {}, {}, {}, { [i]: '57RS321633' }, {});
    expect(k.roller.filter((r) => r.rol === 'mnt-ac')[0].yog).toBe('57RS321633');
    const el = document.createElement('div');
    el.innerHTML = CAD._mntCadKayitHTML(k);
    const satir = Array.from(el.querySelectorAll('tr')).filter((tr) => tr.cells[0] && tr.cells[0].textContent === 'Klima kompresörü')[0];
    expect(satir.cells[2].textContent).toBe('Valeo TM21 · 8,1');
    // alternatör rolünde klima anahtarı geçersiz: kayda girmez
    const roller2 = son.agac.map((d, j) => (j === i ? 'mnt-alternator' : null));
    const k2 = STP.veMntStpRolKaydi(son, roller2, {}, {}, {}, { [i]: '57RS321633' }, {});
    expect(k2.roller.filter((r) => r.rol === 'mnt-alternator')[0].yog).toBeUndefined();
  });
});
