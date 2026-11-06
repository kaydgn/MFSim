/**
 * mount-baglanti-momenti.test.js — BAĞLANTI YÜZÜNDE STATİK EĞİLME MOMENTİ (2026-11-06)
 * ─────────────────────────────────────────────────────────────────────────
 * Allison 4000'in veri sayfası (§10): motor ↔ şanzıman bağlantısında statik
 * eğilme momenti ≤ 3.500 N·m, bütün modeller. Güç grubu bağlantı yüzünde (merkezi
 * S, normali şanzımanın ekseni a) kesilir; şanzıman tarafındaki kütlelerin yükü
 * ve takoz kuvvetlerinin S'ye göre momentinin a'ya dik bileşeni eğilme momenti
 * (çekirdek sectionMoment). Önce (main cbff5d4): rapor bu sınırı hiç sınamıyordu.
 *
 *   · ELLE HESAP — dört takoz aynı yükseklikte, sağ/sol simetrik: çift başına
 *     düşey kuvvet statikçe belirli (rijitlikten bağımsız) → M_b elle; arka takoz
 *     yoksa konsol: M_b = m·g·d.
 *   · BİLEŞENLER — eğilme eksene dik, burulma eksen boyunca; taraf düzlemden.
 *   · SONUÇ — torksuz her durum bir satır, tork durumu yok; bağlantı yüzü imzada
 *     (değişince sonuç bayatlar).
 *   · RAPOR — §8.18 ve uygunluk tablosunun 5. satırı: hüküm Statik durumda.
 */
const fs = require('fs');
const path = require('path');
const core = require('../../js/mount-core.js');
global.veMountCore = core;
global.veMntSignals = require('../../js/mount-signals.js');
global.veMntBrief = require('../../js/mount-brief.js');
const stubs = stubGlobals({ saveState: jest.fn(), showToast: jest.fn(), showNodeProperties: jest.fn() });
eval(fs.readFileSync(path.join(__dirname, '../../js/components.js'), 'utf8'));
global.componentDefs = componentDefs;
const cp = require('../../js/cp-mount.js');
const rep = require('../../js/cp-mount-report.js');
global.veMntUygunluk = rep.veMntUygunluk;
global.veMntRaporOpts = rep.veMntRaporOpts;
global._mntRepCaseTr = rep._mntRepCaseTr;
global._mntRepIsolation = rep._mntRepIsolation;
global._mntRepEngine = rep._mntRepEngine;
global._mntRepZeta = rep._mntRepZeta;
global.veSayi = require('../../js/sayi.js').veSayi;

const G = 9.81;
// Motor 800 kg x = 0 · şanzıman 600 kg x = 1000 mm; takozlar z = 300'de
// (önde x = −200, y = ±400; arkada x = 1300, y = ±300); bağlantı yüzü x = 500
function model(opt = {}) {
  const tak = (id, x, y) => ({ id, type: 'mnt-mount', data: { x, y, z: 300, kxs: 300, kys: 250, kzs: opt.kz ? opt.kz(x) : 500,
    kxd: 400, kyd: 350, kzd: 700 } });
  const arka = opt.arka === false ? [tak('t3', 200, 380), tak('t4', 200, -380)] : [tak('t3', 1300, 300), tak('t4', 1300, -300)];
  const sanz = { mass: 600, cgx: 1000, cgy: 0, cgz: opt.zt != null ? opt.zt : 500, Ixx: 15, Iyy: 60, Izz: 55,
    bagX: 500, bagY: 0, bagZ: 500, egSinir: opt.sinir != null ? opt.sinir : 3500 };
  if (opt.bagN) Object.assign(sanz, { bagNx: opt.bagN[0], bagNy: opt.bagN[1], bagNz: opt.bagN[2] });
  const motor = Object.assign({ mass: 800, cgx: 0, cgy: 0, cgz: 600, Ixx: 30, Iyy: 80, Izz: 70 }, opt.tork ? { Te: 2000, Rstall: 1.9, g1: 3.51, gR: -4.8 } : {});
  global.nodes = [
    { id: 's1', type: 'mnt-solver', data: { solveMode: 'linear' } },
    { id: 'm1', type: 'mnt-motor', data: motor },
    { id: 'g1', type: 'mnt-gearbox', customName: 'Şanzıman', data: sanz },
    tak('t1', -200, 400), tak('t2', -200, -400)].concat(arka).map((n) => Object.assign(n, { def: componentDefs[n.type] }));
  global.connections = [];
  return cp._mntComputeResults('s1');
}
const satir = (R, ad) => R.baglanti.satirlar.filter((r) => r.name === ad)[0];

beforeEach(() => { resetStubs(stubs); cp._mntForgetResults(); global._veMntLast = null; });

describe('ELLE HESAP — statikçe belirli takoz çiftleri', () => {
  test('Statik: arka çift F_r = W·(x_G − x_f)/(x_r − x_f); M_b = m_ş·g·(x_ş − x_S) − F_r·(x_r − x_S)', () => {
    const W = 1400 * G, xG = (600 * 1.0) / 1400, Fr = W * (xG + 0.2) / 1.5;
    const Mb = Math.abs(600 * G * 0.5 - Fr * 0.8);
    const R = model();
    expect(R.error).toBeUndefined();
    const st = satir(R, 'Static');
    expect(st.egilme).toBeCloseTo(Mb, 6);                      // 1.661,2 N·m
    expect(Mb).toBeCloseTo(1661.16, 2);
    expect(st.burulma).toBeLessThan(1e-6);
    expect([st.m, st.takoz]).toEqual([600, 2]);
    // rijitlikten bağımsız: çiftlerin düşey rijitliği farklı olsa da aynı moment
    expect(satir(model({ kz: (x) => (x > 0 ? 1500 : 300) }), 'Static').egilme).toBeCloseTo(Mb, 6);
  });

  test('arka takoz yoksa konsol: M_b = m_ş·g·d (bütün takozlar düzlemin önünde)', () => {
    const R = model({ arka: false });
    const st = satir(R, 'Static');
    expect(st.egilme).toBeCloseTo(600 * G * 0.5, 6);            // 2.943 N·m
    expect([st.m, st.takoz]).toEqual([600, 0]);
    // 3,5 g düşey: 3,5 kat
    expect(satir(R, '3,5g Düşey').egilme).toBeCloseTo(3.5 * 600 * G * 0.5, 6);
  });

  test('1 g yanal (konsol): eğilme √2·m·g·d, burulma m·g·|z_ş − z_S| — eğilme eksene dik, burulma eksen boyunca', () => {
    const R = model({ arka: false, zt: 450 });
    const r = satir(R, '1g Yanal');
    expect(r.egilme).toBeCloseTo(Math.SQRT2 * 600 * G * 0.5, 6);
    expect(r.burulma).toBeCloseTo(600 * G * 0.05, 6);
  });
});

describe('BİLEŞENLER — çekirdek sectionMoment', () => {
  const comp = [{ mass: 100, cg: [1, 0, 0] }, { mass: 50, cg: [-1, 0, 0] }];
  const res = { perMount: [{ f: [0, 0, -300] }, { f: [0, 0, -1000] }] };
  const mounts = [{ pos: [2, 0, 0] }, { pos: [-0.5, 0, 0] }];

  test('taraf düzlemden: arkadaki kütle ve takoz sayılır, öndeki sayılmaz; takozun gövdeye etkisi −f', () => {
    const r = core.sectionMoment(comp, mounts, res, 10, [0, 0, -1], [0, 0, 0], [1, 0, 0]);
    // M = (1,0,0)×(0,0,−1000) − (2,0,0)×(0,0,−300) = (0, 1000, 0) − (0, 600, 0)
    expect(r.M.map((v) => +v.toFixed(9))).toEqual([0, 400, 0]);
    expect([r.egilme, r.burulma, r.m, r.takoz]).toEqual([400, 0, 100, 1]);
  });

  test('eksen ters verilirse öteki taraf; eksen eğik: eğilme + burulma = |M|; bozuk girdi null', () => {
    const r = core.sectionMoment(comp, mounts, res, 10, [0, 0, -1], [0, 0, 0], [-2, 0, 0]);
    expect([r.m, r.takoz]).toEqual([50, 1]);
    // eksen x–y düzleminde 45°: M = (0; 400; 0) yarı yarıya eğilme ve burulma
    const e = core.sectionMoment(comp, mounts, res, 10, [0, 0, -1], [0, 0, 0], [1, 1, 0]);
    expect(Math.hypot(e.egilme, e.burulma)).toBeCloseTo(Math.hypot.apply(null, e.M), 9);
    expect(e.burulma).toBeCloseTo(400 / Math.SQRT2, 9);
    expect(e.egilme).toBeCloseTo(400 / Math.SQRT2, 9);
    // eksen x–z düzleminde eğik: M eksene dik kalır, hepsi eğilme
    const z = core.sectionMoment(comp, mounts, res, 10, [0, 0, -1], [0, 0, 0], [1, 0, 1]);
    expect([+z.egilme.toFixed(9), +z.burulma.toFixed(9)]).toEqual([400, 0]);
    expect(core.sectionMoment(comp, mounts, null, 10, [0, 0, -1], [0, 0, 0], [1, 0, 0])).toBe(null);
    expect(core.sectionMoment(comp, mounts, res, 10, [0, 0, -1], [0, 0, 0], [0, 0, 0])).toBe(null);
  });
});

describe('SONUÇ — torksuz durumlar, imza', () => {
  test('torksuz her yük durumu bir satır; tork durumları (ileri · geri) yok', () => {
    const R = model({ tork: true });
    const adlar = R.baglanti.satirlar.map((r) => r.name);
    const torksuz = R.allCases.concat(R.designCases).filter((c) => !c.loadCase.T.some((t) => t !== 0)).map((c) => c.name);
    expect(adlar).toEqual(torksuz);
    expect(R.allCases.some((c) => c.name === 'Forward Torque')).toBe(true);
    expect(adlar).not.toContain('Forward Torque');
    expect(adlar).not.toContain('Reverse Torque');
    expect(R.baglanti).toMatchObject({ ad: 'Şanzıman', S: [500, 0, 500], a: [1, 0, 0], sinir: 3500 });
  });

  test('bağlantı yüzü yoksa sonuç yok; değişince sonuç bayatlar', () => {
    global._veMntLast = model();
    expect(cp.veMntSonucDurumu().durum).toBe('guncel');
    const g = global.nodes.filter((n) => n.id === 'g1')[0];
    g.data.bagX = 520;
    expect(cp.veMntSonucDurumu().durum).toBe('bayat');
    g.data.bagX = 500;
    expect(cp.veMntSonucDurumu().durum).toBe('guncel');
    g.data.egSinir = 3000;
    expect(cp.veMntSonucDurumu().durum).toBe('bayat');
    delete g.data.bagX; delete g.data.bagY; delete g.data.bagZ;
    expect(cp._mntComputeResults('s1').baglanti).toBe(null);
  });

  test('eksenin yönü düğümden: eğik eksen momenti o düzlemde keser', () => {
    // eksen yatayda 0,1 rad dönük: konsolun momenti M = d × W = (0; m·g·d; 0),
    // eksen boyunca payı m·g·d·sin(0,1) burulma, kalanı eğilme
    const a = [Math.cos(0.1), Math.sin(0.1), 0];
    const R = model({ arka: false, bagN: a });
    expect(R.baglanti.a.map((v) => +v.toFixed(12))).toEqual(a.map((v) => +v.toFixed(12)));
    const st = satir(R, 'Static');
    expect(st.egilme).toBeCloseTo(600 * G * 0.5 * Math.cos(0.1), 6);
    expect(st.burulma).toBeCloseTo(600 * G * 0.5 * Math.sin(0.1), 6);
  });
});

describe('RAPOR — §8.18 ve uygunluğun 5. satırı', () => {
  test('sınırın altında: tablo, Statik satırı hükümlü; uygunlukta "Bağlantı yüzü" uygun', () => {
    const R = global._veMntLast = model();
    const el = document.createElement('div');
    el.innerHTML = rep._mntRepSection8(R);
    const h = Array.from(el.querySelectorAll('h3')).map((x) => x.textContent);
    expect(h[h.length - 1]).toBe('8.18 Bağlantı yüzünde statik eğilme momenti');
    const tablo = Array.from(el.querySelectorAll('table')).filter((t) => /kesit momenti/.test((t.querySelector('caption') || {}).textContent || ''))[0];
    expect(tablo.querySelector('caption').textContent).toContain('sınır 3.500 N·m');
    const st = Array.from(tablo.querySelectorAll('tr')).filter((tr) => tr.cells[0].textContent === 'Statik (yerçekimi)')[0];
    expect(Array.from(st.cells).map((c) => c.textContent)).toEqual(['Statik (yerçekimi)', '600', '2', '1.661', '0', '%47,5', '✓ Uygun']);
    const U = rep.veMntUygunluk(R);
    expect(U.satirlar.map((s) => s.no)).toEqual(['1', '1a', '1b', '2', '3', '4', '5']);
    expect(U.satirlar[6]).toMatchObject({ kisa: 'Bağlantı yüzü', st: 'ok', hedef: '≤ 3.500 N·m (veri sayfası)' });
  });

  test('sınırın üstünde: Statik satırı "sınırın üstünde", uygunluk "kontrol"; sınır yoksa satır da hüküm de yok', () => {
    const R = global._veMntLast = model({ arka: false, sinir: 2000 });
    const el = document.createElement('div');
    el.innerHTML = rep._mntRepSection8(R);
    expect(el.textContent).toContain('✗ sınırın üstünde');
    const U = rep.veMntUygunluk(R);
    expect(U.satirlar[6].st).toBe('no');
    expect(U.anyNo).toBe(true);
    const R2 = global._veMntLast = model({ sinir: 0 });
    expect(R2.baglanti.sinir).toBe(null);
    expect(rep.veMntUygunluk(R2).satirlar.map((s) => s.no)).toEqual(['1', '1a', '1b', '2', '3', '4']);
    el.innerHTML = rep._mntRepSection8(R2);
    expect(el.textContent).toContain('8.18');
    expect(el.textContent).not.toContain('✓ Uygun');
  });

  test('bağlantı yüzü yoksa bölüm yok, uygunluk altı satır', () => {
    model();
    const g = global.nodes.filter((n) => n.id === 'g1')[0];
    delete g.data.bagX; delete g.data.bagY; delete g.data.bagZ;
    const R = global._veMntLast = cp._mntComputeResults('s1');
    expect(rep._mntRepSection8(R)).not.toContain('8.18');
    expect(rep.veMntUygunluk(R).satirlar).toHaveLength(6);
  });
});
