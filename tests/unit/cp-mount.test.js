/**
 * cp-mount.test.js — Takoz Çökme-Titreşim GERÇEK KANVAS BİLEŞENLERİ
 *
 * Yeni mimari: Motor/Şanzıman/Şaft/Braket/Kütle + Takoz bileşenleri normal
 * kanvasta Çözücü'ye bağlanır; Çözücü connections'tan okuyup OTOMATİK yük
 * durumlarıyla analiz eder. Burada panel üreticileri, kütüphane, otomatik yük
 * durumları ve EN ÖNEMLİSİ "bağlı node'lar → _mntGatherForSolver → _mntToSI →
 * çekirdek" köprüsü TTAR ile T1/T3/T6'ya karşı doğrulanır.
 */
const core = require('../../js/mount-core.js');
global.veMountCore = core;
const cp = require('../../js/cp-mount.js');

// TTAR (UI birimleri) → gerçek node + connection topolojisi (hepsi Çözücü'ye bağlı)
function buildTTARTopology() {
  const EX = core.TTAR_EXAMPLE;
  const nodes = [];
  const connections = [];
  const solver = { id: 'sv', type: 'mnt-solver', def: { name: 'Takoz Çözücü', isMountSolver: true }, data: {} };
  let c = 0;
  EX.components.forEach(cp0 => {
    const kind = /motor/i.test(cp0.name) ? 'mnt-motor' : /şanz|sanz/i.test(cp0.name) ? 'mnt-gearbox'
      : /şaft|saft|shaft/i.test(cp0.name) ? 'mnt-shaft' : /cradle|braket/i.test(cp0.name) ? 'mnt-bracket' : 'mnt-transfer';
    const id = 'm' + (++c);
    nodes.push({ id, type: kind, customName: cp0.name, def: { name: cp0.name, isMountBody: true },
      data: { mass: cp0.mass, cgx: cp0.cg[0], cgy: cp0.cg[1], cgz: cp0.cg[2], Ixx: cp0.Ixx, Iyy: cp0.Iyy, Izz: cp0.Izz, Ixy: cp0.Ixy, Ixz: cp0.Ixz, Iyz: cp0.Iyz, pointMass: !!cp0.pointMass } });
    connections.push({ id: 'c' + c, from: id, to: solver.id, fromPort: 'output', toPort: 'input' });
  });
  EX.mounts.forEach(m => {
    const id = 'm' + (++c);
    nodes.push({ id, type: 'mnt-mount', customName: m.name, def: { name: m.name, isMount: true },
      data: { x: m.pos[0], y: m.pos[1], z: m.pos[2], kxs: m.kstat[0], kys: m.kstat[1], kzs: m.kstat[2], kxd: m.kdyn[0], kyd: m.kdyn[1], kzd: m.kdyn[2] } });
    connections.push({ id: 'c' + c, from: id, to: solver.id, fromPort: 'output', toPort: 'input' });
  });
  nodes.push(solver);
  return { nodes, connections, solver };
}

describe('Ana modül (alt-sistem) paneli', () => {
  test('getMntModulePropertiesHTML "Alt Topolojiyi Aç" düğmesi verir', () => {
    const node = { id: 'comp-1', type: 'mount-analysis', def: { name: 'Takoz Çökme-Titreşim' }, data: {} };
    const html = cp.getMntModulePropertiesHTML(node);
    expect(html).toContain("veMntOpenEditor('comp-1')");
    expect(html).toContain('alt topolojisine');
  });
  test('başlatılmış alt-topoloji özeti bileşen/bağlantı sayısını gösterir', () => {
    const node = { id: 'comp-2', type: 'mount-analysis', data: { subTopology: { nodes: [{}, {}, {}], connections: [{}, {}] } } };
    const html = cp.getMntModulePropertiesHTML(node);
    expect(html).toContain('>3<'); // 3 bileşen
    expect(html).toContain('>2<'); // 2 bağlantı
  });
});

describe('Panel üreticileri', () => {
  test('Kütle paneli: kütle/CG/atalet alanları + nokta-kütle', () => {
    const node = { id: 'n1', type: 'mnt-motor', def: { name: 'Motor (Kütle)' }, data: {} };
    const html = cp.getMntMassPropertiesHTML(node);
    expect(html).toContain('Kütle');
    expect(html).toContain('ve-mnt-mass-n1');
    expect(html).toContain('ve-mnt-cgx-n1');
    expect(html).toContain('Nokta kütle');
    expect(html).toContain('Atalet Tensörü'); // pointMass false → atalet görünür
  });
  test('Şaft varsayılan nokta-kütle (atalet gizli)', () => {
    const node = { id: 'n2', type: 'mnt-shaft', def: { name: 'Şaft (Kütle)' }, data: {} };
    const html = cp.getMntMassPropertiesHTML(node);
    expect(node.data.pointMass).toBe(true);
    expect(html).not.toContain('Atalet Tensörü');
  });
  test('Takoz paneli: konum + rijitlik + kütüphane', () => {
    const node = { id: 'm1', type: 'mnt-mount', def: { name: 'Takoz' }, data: {} };
    const html = cp.getMntMountPropertiesHTML(node);
    expect(html).toContain('ve-mnt-x-m1');
    expect(html).toContain('ve-mnt-kzs-m1');
    expect(html).toContain('AMC 55 ShA');
    expect(html).toContain("veMntApplyLib('m1'");
  });
  test('Çözücü paneli: Hesapla + sonuç kabı', () => {
    const node = { id: 'sv', type: 'mnt-solver', def: { name: 'Takoz Çözücü' }, data: {} };
    const html = cp.getMntSolverPropertiesHTML(node);
    expect(html).toContain("veMntSolverCompute('sv')");
    expect(html).toContain('ve-mnt-results');
    expect(html).toContain('otomatik');
  });
});

describe('Otomatik yük durumları (kullanıcı girişi yok)', () => {
  test('6 g-tabanlı standart durum, tork gerektirmez', () => {
    expect(cp.MNT_AUTO_CASES).toHaveLength(6);
    expect(cp.MNT_AUTO_CASES[0]).toEqual({ name: 'Static', n: [0, 0, -1], T: [0, 0, 0] });
    expect(cp.MNT_AUTO_CASES.every(c => c.T[0] === 0 && c.T[1] === 0 && c.T[2] === 0)).toBe(true);
    expect(cp.MNT_AUTO_CASES.map(c => c.name)).toEqual(['Static', 'Max Bump', 'Acceleration', 'Braking', 'Cornering L', 'Cornering R']);
  });
});

describe('Takoz kütüphanesi', () => {
  test('AMC 55 ShA doğru rijitlikler', () => {
    const m = cp.VE_MOUNT_LIBRARY['amc55sha'];
    expect([m.sx, m.sy, m.sz]).toEqual([1252, 1252, 640]);
    expect([m.dx, m.dy, m.dz]).toEqual([2055, 2055, 977]);
  });
});

describe('Çözücü otomatik algılama (bağlantı gerekmez) → gather → çekirdek — TTAR', () => {
  const topo = buildTTARTopology();
  beforeEach(() => { global.nodes = topo.nodes; global.connections = topo.connections; });

  test('_mntGatherForSolver iç topolojideki tüm kütle+takozları toplar', () => {
    const g = cp._mntGatherForSolver(topo.solver);
    expect(g.components).toHaveLength(5);
    expect(g.mounts).toHaveLength(6);
  });
  test('BAĞLANTISIZ node da algılanır (otomatik algılama)', () => {
    global.connections = []; // hiç bağlantı yok
    const g = cp._mntGatherForSolver(topo.solver);
    expect(g.components).toHaveLength(5); // bağlantı olmadan da hepsi
    expect(g.mounts).toHaveLength(6);
  });
  test('eklenen her kütle gövdesi bağlantısız da dahil olur', () => {
    global.nodes = topo.nodes.concat([{ id: 'extra', type: 'mnt-transfer', def: { isMountBody: true }, data: { mass: 120, cgx: 0, cgy: 0, cgz: 0, pointMass: true } }]);
    global.connections = [];
    const g = cp._mntGatherForSolver(topo.solver);
    expect(g.components).toHaveLength(6); // yeni Transfer Kutusu bağlanmadan algılandı
  });

  test('T1 — kütle birleştirme (2294.522 kg)', () => {
    const si = cp._mntToSI(cp._mntGatherForSolver(topo.solver), 9.81);
    const mp = core.combineMassProps(si.components);
    expect(mp.m).toBeCloseTo(2294.522, 2);
    expect(mp.cg[0] * 1000).toBeCloseTo(254.669, 2);
    expect(mp.cg[2] * 1000).toBeCloseTo(746.052, 2);
  });
  test('T3 — Static durumu (sağ ön δz=-3.941, ΣFz ✓)', () => {
    const si = cp._mntToSI(cp._mntGatherForSolver(topo.solver), 9.81);
    const mp = core.combineMassProps(si.components);
    const Kstat = core.buildK(si.mounts, mp.cg, false);
    // si.loadCases[0] otomatik 'Static'
    const res = core.solveCase(Kstat, si.mounts, mp.cg, mp.m, si.g, si.loadCases[0]);
    expect(res.perMount[0].delta[2] * 1000).toBeCloseTo(-3.941, 2);
    expect(res.checks.sumFzOk).toBe(true);
  });
  test('T6 — modal frekanslar', () => {
    const si = cp._mntToSI(cp._mntGatherForSolver(topo.solver), 9.81);
    const mp = core.combineMassProps(si.components);
    const Kdyn = core.buildK(si.mounts, mp.cg, true);
    const M6 = core.buildM6(mp.m, mp.I_G);
    const modes = core.solveModal(Kdyn, M6, si.mounts, mp.cg);
    const expF = [5.039, 6.111, 8.364, 10.148, 12.071, 21.239];
    modes.forEach((md, i) => expect(md.f_Hz).toBeCloseTo(expF[i], 2));
  });
  test('otomatik yük durumları çözücüde uygulanır (6 durum)', () => {
    const si = cp._mntToSI(cp._mntGatherForSolver(topo.solver), 9.81);
    expect(si.loadCases).toHaveLength(6);
    const mp = core.combineMassProps(si.components);
    const model = { m: mp.m, cg: mp.cg, Kstat: core.buildK(si.mounts, mp.cg, false), mounts: si.mounts, g: si.g };
    const rows = core.solveAllCases(model, si.loadCases);
    expect(rows).toHaveLength(6);
    rows.forEach(r => expect(r.res).not.toBeNull());
  });
});

describe('Renk skalaları', () => {
  test('eşikler', () => {
    expect(cp._mntDeflColor(0.2)).toBe('#22c55e');
    expect(cp._mntDeflColor(15)).toBe('#ef4444');
    expect(cp._mntForceColor(25)).toBe('#f97316');
  });
});
