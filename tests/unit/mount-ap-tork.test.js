/**
 * mount-ap-tork.test.js — TAKOZ'UN TORK ZİNCİRİ ORTAK KATALOGDAN ve ARAÇ PERFORMANS'TAN (F002)
 * ─────────────────────────────────────────────────────────────────────────
 * Takoz Araç Performans kurulmadan da eksiksiz çalışır: şanzımanın ve konvertörün
 * kataloğu veri sayfası olmayan aileleri programın ortak kataloğundan (Araç
 * Performans'ın VE_GEARBOX_PRESETS · VE_FT_TC_PRESETS), transferin kataloğu
 * VE_TRANSFER_PRESETS'ten okur — kopya yok. Projede Araç Performans modeli varsa
 * Çözücü'nün "Araç Performans'tan doldur"u zinciri ondan yazar (tek geri-al adımı).
 *
 *   · KATALOG — ortak kayıtlar listede; veri sayfasıyla aynı oranlı düzen ve aynı
 *     konvertör ikinci kez yok; yediden çok vitesli düzen yok.
 *   · TRANSFER — kademe seçimi transfer oranını yazar, sapma söylenir.
 *   · DOLDUR — gerçek örnek (ap_isg430_4000sp): değerler, geri vites katalogdan,
 *     transferin en yüksek kademesi, okuyan gövdeye yazım, mil torku.
 *   · YOK — Araç Performans modeli yoksa bölüm yok, tork elle.
 */
const fs = require('fs');
const path = require('path');
const KOK = path.join(__dirname, '../..');

const stubs = stubGlobals({ saveState: jest.fn(), showToast: jest.fn(), showNodeProperties: jest.fn() });
eval(loadSource('components.js'));
global.componentDefs = componentDefs;
global.veMountCore = require('../../js/mount-core.js');
// Ortak kataloglar — GERÇEK dosyalar (kopya değil)
eval(loadSource('cp-gearbox.js'));
eval(loadSource('cp-torque-converter.js'));
eval(loadSource('cp-drivetrain.js'));
global.VE_GEARBOX_PRESETS = VE_GEARBOX_PRESETS;
global.VE_FT_TC_PRESETS = VE_FT_TC_PRESETS;
global.VE_TRANSFER_PRESETS = VE_TRANSFER_PRESETS;
global.veResolveGearboxPresetKey = veResolveGearboxPresetKey;
global.veResolveTCPresetKey = veResolveTCPresetKey;
const cp = require('../../js/cp-mount.js');
Object.keys(cp).forEach((k) => { if (global[k] === undefined) global[k] = cp[k]; });
const VS = require('../../js/mount-veri-sayfasi.js');
Object.keys(VS).forEach((k) => { global[k] = VS[k]; });

const ornek = JSON.parse(fs.readFileSync(path.join(KOK, 'assets/examples/ap_isg430_4000sp_topoloji.json'), 'utf8'));

function takoz(ek) {
  return [
    { id: 'm', type: 'mnt-motor', data: { Te: 1500, idleRpm: 650, cylinders: 6, enginePreset: 'x' } },
    { id: 'g', type: 'mnt-gearbox', data: { g1: 3.1, gR: -4.49, Rstall: 2.0, gearPreset: 'y' } },
    { id: 't', type: 'mnt-transfer', data: {} },
    { id: 's', type: 'mnt-solver', data: {} },
  ].concat(ek || []);
}
function apKart() {
  return { id: 'ap', type: 'arac-performans', data: { subTopology: { nodes: ornek.nodes } } };
}
beforeEach(() => { resetStubs(stubs); global.nodes = []; });

describe('KATALOG — ortak kayıtlar Takoz şanzımanının listesinde', () => {
  test('veri sayfası olmayan aile ve konvertör listede', () => {
    const K = _mntVsKatalog();
    const d = K.disli.find((x) => x.k === 'ap:3000SP');
    expect(d).toBeTruthy();
    expect(d.ileri).toEqual([3.49, 1.86, 1.41, 1, 0.75, 0.65]);
    expect(d.geri).toBe(-5.03);
    expect(d.aile).toBe('Allison 3000');
    const c = K.tc.find((x) => x.k === 'ap:tc411');
    expect(c.stall).toBe(2.71);
    expect(_mntDisliPresetValues('ap:3700SP')).toMatchObject({ g1: 6.93, g7: 0.78, gR: -6.03 });
    expect(_mntDisliPresetValues('ap:3000SP').g7).toBeNull();
    expect(_mntKonvertorPresetValues('ap:tc411')).toEqual({ Rstall: 2.71 });
  });
  test('veri sayfasıyla aynı kayıt ikinci kez yok; yediden çok vites yok', () => {
    const K = _mntVsKatalog();
    expect(K.disli.find((x) => x.k === 'ap:4000SP')).toBeUndefined();     // = Allison 4000 CR
    expect(K.disli.find((x) => x.k === 'ap:4700SP')).toBeUndefined();     // = 7-Speed
    expect(K.disli.find((x) => x.k === 'ap:8L90')).toBeUndefined();
    expect(K.tc.find((x) => x.k === 'ap:tc571')).toBeUndefined();         // = Allison 4000 TC-571
    expect(K.disli.find((x) => x.k === 'ap:4500SP')).toBeUndefined();     // = Wide Ratio (WR)
    expect(K.disli.filter((x) => x.k.indexOf('ap:') === 0).length).toBe(9);
    expect(K.tc.filter((x) => x.k.indexOf('ap:') === 0).length).toBe(11);
    const anahtar = K.disli.map((x) => x.k).concat(K.tc.map((x) => x.k));
    expect(new Set(anahtar).size).toBe(anahtar.length);
  });
});

describe('TRANSFER — kademe seçimi transfer oranını yazar', () => {
  test('liste, değer, sapma', () => {
    const L = _mntTransferKatalog();
    expect(L.length).toBe(31);
    expect(_mntTransferPresetValues('ZF|VG750#OffRoad')).toEqual({ iTransfer: 2.103 });
    global.nodes = takoz();
    veMntApplyTransferPreset('t', 'ZF|VG750#OffRoad');
    expect(nodes[2].data).toEqual({ iTransfer: 2.103, trPreset: 'ZF|VG750#OffRoad' });
    expect(stubs.saveState).toHaveBeenCalledTimes(1);
    expect(_mntTransferSection(nodes[2])).toContain('VG750 · OffRoad');
    nodes[2].data.iTransfer = 2;
    expect(_mntTransferSection(nodes[2])).toContain('Katalogdan sapıldı');
  });
});

describe('DOLDUR — Araç Performans modelinden (ap_isg430_4000sp)', () => {
  test('zincirin değerleri', () => {
    global.nodes = takoz([apKart()]);
    const Z = _mntApZinciri();
    expect(Z.v).toMatchObject({ Te: 2000, TeRpm: 1000, Pmax: 319.9, PmaxRpm: 1600, idleRpm: 700, Rstall: 1.62,
      g1: 3.51, g2: 1.906, g6: 0.639, g7: null, gR: -4.8, iTransfer: 1.536 });
    expect(Z.not).toEqual([]);
  });
  test('yazım okuyan gövdeye, tek geri-al adımı, bağ düşer; mil torku zincirden', () => {
    global.nodes = takoz([apKart()]);
    expect(_mntCozucuApGovde(nodes[3])).toContain('Takoz’daki değerler farklı');
    expect(veMntApDoldur('s')).toBe(14);
    expect(stubs.saveState).toHaveBeenCalledTimes(1);
    expect(nodes[0].data).toMatchObject({ Te: 2000, idleRpm: 700, cylinders: 6 });
    expect(nodes[0].data.enginePreset).toBeUndefined();
    expect(nodes[1].data).toMatchObject({ g1: 3.51, gR: -4.8, Rstall: 1.62 });
    expect(nodes[1].data.gearPreset).toBeUndefined();
    expect(nodes[2].data.iTransfer).toBe(1.536);
    const Zc = _mntTorkZinciri();
    expect(Zc.ileri).toBeCloseTo(2000 * 1.62 * 3.51 * 1.536, 6);
    const ap = _mntCozucuApGovde(nodes[3]);
    expect(ap).toContain('birebir');
    expect(ap).toContain('aria-disabled="true"');
  });
  test('transfer gövdesi yoksa transfer oranı onu okuyan şanzımana', () => {
    global.nodes = takoz([apKart()]).filter((n) => n.id !== 't');
    nodes[1].data.iTransfer = 1.2;
    veMntApDoldur('s');
    expect(nodes[1].data.iTransfer).toBe(1.536);
  });
});

describe('YOK — Araç Performans modeli yoksa', () => {
  test('bölüm yok, değer yazılmaz', () => {
    global.nodes = takoz();
    expect(veMntApModeli()).toBeNull();
    expect(_mntCozucuApGovde(nodes[3])).toBe('');
    expect(veMntApDoldur('s')).toBe(0);
    expect(nodes[0].data.Te).toBe(1500);
  });
});

describe('ŞANZIMAN → KONVERTÖR — seçilen şanzımanın ailesi konvertörü süzer', () => {
  test('liste ailenin konvertörleri; şanzımansız liste tam', () => {
    const tam = _mntVsKatalog().tc.length;
    expect(_mntKonvertorListesi('').length).toBe(tam);
    expect(_mntKonvertorListesi('ap:3000SP').map((x) => x.ad)).toEqual(['TC-411', 'TC-413', 'TC-415', 'TC-417', 'TC-418', 'TC-419', 'TC-421']);
    expect(_mntKonvertorListesi('allison-4000:cr').every((x) => x.aile === 'Allison 4000')).toBe(true);
    expect(_mntKonvertorListesi('ap:1000SP').every((x) => x.aile === 'Allison 1000/2000')).toBe(true);
  });
  test('aile değişince uymayan konvertör ve stall düşer; uyan kalır', () => {
    global.nodes = takoz();
    veMntApplyTcPreset('g', 'ap:tc411');
    veMntApplyGearPreset('g', 'ap:3200SP');
    expect(nodes[1].data).toMatchObject({ tcPreset: 'ap:tc411', Rstall: 2.71, g1: 3.49 });
    veMntApplyGearPreset('g', 'allison-4000:wr');
    expect(nodes[1].data.tcPreset).toBeUndefined();
    expect(nodes[1].data.Rstall).toBeUndefined();
    const h = _mntGearboxSection(nodes[1]);
    expect(h).toContain('TC-571');
    expect(h).not.toContain('TC-411');
  });
  test('sihirbaz aynı kuralla', () => {
    const t = { gearPreset: 'ap:3000SP', tcPreset: 'ap:tc411', Rstall: 2.71 };
    _mntKonvertorEsle(t);
    expect(t.tcPreset).toBe('ap:tc411');
    t.gearPreset = 'allison-4000:cr';
    _mntKonvertorEsle(t);
    expect(t).toEqual({ gearPreset: 'allison-4000:cr' });
  });
});
