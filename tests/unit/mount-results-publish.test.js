/**
 * Takoz çözümünün Sonuçlar paneline yayınlanması
 * ──────────────────────────────────────────────
 * Çözücü (js/cp-mount.js) sonucu iki yere koyar: Rapor'un okuduğu _veMntLast ve
 * Sonuçlar panosunun okuduğu window.veMountResults. Bu dosya o yayının ve —
 * daha önemlisi — YAYINLARKEN YAPMADIĞI ŞEYİN kilididir.
 *
 * REGRESYON KİLİDİ: çözüm bittiğinde Sonuçlar ağacı TAZELENMEZ.
 * veUpdateResultsTree ilk işi olarak veSaveActiveTabStateKeepView'i çağırır, o da
 * veSaveActiveTabState → veMntCollapseToRoot zincirini işletir (js/topology.js:122).
 * "▶ Hesapla" düğmesine ALT TOPOLOJİDEN basılır; oradan tazeleme istemek kanvası
 * köke çökertir, DOM'u yeniden kurar ve az önce basılan çözüm durumunu ekrandan
 * siler. Aynı zincirin daha önce kaydedilen dosyayı bozduğu yer:
 * tests/unit/topology-save-reentrancy.test.js.
 *
 * Tazelemeye gerek yok: kullanıcı Sonuçlar sayfasına geçtiğinde veEnterResults
 * sekmeleri ve ağacı zaten kuruyor (js/tabs.js:56).
 */
const core = require('../../js/mount-core.js');
global.veMountCore = core;
const S = require('../../js/mount-signals.js');
global.veMntSignals = S;
const cp = require('../../js/cp-mount.js');

// Çözücüye bağlı gerçek kanvas topolojisi (cp-mount.test.js ile aynı desen)
function buildTopology() {
  const EX = core.TTAR_EXAMPLE;
  const nodes = [], connections = [];
  const solver = { id: 'sv', type: 'mnt-solver', def: { name: 'Takoz Çözücü', isMountSolver: true }, data: {} };
  let c = 0;
  EX.components.forEach((b) => {
    const kind = /motor/i.test(b.name) ? 'mnt-motor'
      : /şanz|sanz/i.test(b.name) ? 'mnt-gearbox'
      : /şaft|saft/i.test(b.name) ? 'mnt-shaft' : 'mnt-bracket';
    const id = 'm' + (++c);
    nodes.push({ id, type: kind, customName: b.name, def: { name: b.name, isMountBody: true },
      data: { mass: b.mass, cgx: b.cg[0], cgy: b.cg[1], cgz: b.cg[2], Ixx: b.Ixx, Iyy: b.Iyy,
              Izz: b.Izz, Ixy: b.Ixy, Ixz: b.Ixz, Iyz: b.Iyz, pointMass: !!b.pointMass } });
    connections.push({ id: 'c' + c, from: id, to: solver.id, fromPort: 'output', toPort: 'input' });
  });
  EX.mounts.forEach((m) => {
    const id = 'm' + (++c);
    nodes.push({ id, type: 'mnt-mount', customName: m.name, def: { name: m.name, isMount: true },
      data: { x: m.pos[0], y: m.pos[1], z: m.pos[2],
              kxs: m.kstat[0], kys: m.kstat[1], kzs: m.kstat[2],
              kxd: m.kdyn[0], kyd: m.kdyn[1], kzd: m.kdyn[2] } });
    connections.push({ id: 'c' + c, from: id, to: solver.id, fromPort: 'output', toPort: 'input' });
  });
  nodes.push(solver);
  return { nodes, connections, solver };
}

let treeRefreshes = 0;
global.veUpdateResultsTree = jest.fn(() => { treeRefreshes++; });
global.showToast = jest.fn();

beforeEach(() => {
  treeRefreshes = 0;
  global.veUpdateResultsTree.mockClear();
  window.veMountResults = null;
  const topo = buildTopology();
  global.nodes = topo.nodes;
  global.connections = topo.connections;
});

describe('çözüm sonucunun yayınlanması', () => {
  test('senkron çözüm window.veMountResults ve R.signals üretir', () => {
    const R = cp._mntComputeResults('sv');
    expect(R.error).toBeUndefined();
    expect(R.signals.map((d) => d.key)).toEqual(['frf', 'campbell', 'fdefl', 'gz', 'gy', 'gx', 'shockz', 'shocky', 'shockx']);
    expect(window.veMountResults).toBe(R);
  });

  test('süpürme çözücünün kendi yolundan geçer — a=1 g Statik ile aynı', () => {
    // R.signals'ı prep.solveOne ile kurmak yerine ayrı bir çözüm yolu yazılırsa
    // burası kırılır: pano ile Rapor sessizce ayrışamaz.
    const R = cp._mntComputeResults('sv');
    const gz = R.signals.find((d) => d.key === 'gz');
    const i1 = gz.x.data.findIndex((a) => Math.abs(a - 1) < 1e-9);
    const stat = R.allCases.find((c) => c.name === 'Static');
    R.mounts.forEach((mnt, k) => {
      const ch = gz.channels.find((c) => c.name === mnt.name + ' · bileşke çökme');
      const ref = Math.hypot(...stat.res.perMount[k].delta) * 1000;
      expect(ch.data[i1]).toBeCloseTo(ref, 9);
    });
  });

  test('geçersiz model saklanan kanalları TEMİZLER — bayat eğri kalmaz', () => {
    cp._mntComputeResults('sv');
    expect(window.veMountResults).not.toBeNull();
    // Kütle ve takoz bileşenlerini kaldır: validateModel hata döndürür
    global.nodes = global.nodes.filter((n) => n.type === 'mnt-solver');
    global.connections = [];
    const R2 = cp._mntComputeResults('sv');
    expect(R2.error.length).toBeGreaterThan(0);
    expect(window.veMountResults).toBeNull();
  });

  test('kanal üretimi patlarsa çözüm yine döner — hesap kaybedilmez', () => {
    const spy = jest.spyOn(S, 'build').mockImplementation(() => { throw new Error('patladı'); });
    try {
      const R = cp._mntComputeResults('sv');
      expect(R.error).toBeUndefined();
      expect(R.modes.length).toBe(6);       // asıl hesap sağlam
      expect(R.signals).toEqual([]);        // yalnız kanallar boş
    } finally { spy.mockRestore(); }
  });
});

describe('çözüm Sonuçlar ağacını tazelemez (alt-topoloji çökertme regresyonu)', () => {
  test('senkron çözüm veUpdateResultsTree çağırmaz', () => {
    cp._mntComputeResults('sv');
    expect(treeRefreshes).toBe(0);
  });

  test('▶ Hesapla (async) yolu da çağırmaz', async () => {
    const R = await cp.veMntSolverCompute('sv');
    expect(R.error).toBeUndefined();
    expect(window.veMountResults).toBe(R);
    expect(R.signals.length).toBe(9);
    // Bu satır kırmızıya dönerse: çözüm bittiğinde kanvas köke çökertiliyor,
    // kullanıcı alt-topolojiden atılıyor ve çözüm durumu ekrandan siliniyor.
    expect(treeRefreshes).toBe(0);
  }, 20000);
});

describe('sensör kimliği çakışması', () => {
  test('~mnt- öneki alt-topoloji BİLEŞEN tiplerini kaçırmaz', () => {
    // Alt topolojide mnt-motor / mnt-mount / mnt-solver gibi tipler var ve
    // sihirbazın sanal sensör kimliği "~" + bileşen tipi. Salt önek eşlemesi
    // bir gün "~mnt-motor"u takoz kanalı sanıp o sensörü öldürürdü.
    ['~mnt-motor', '~mnt-mount', '~mnt-solver', '~mnt-gearbox', '~mnt-report']
      .forEach((id) => expect(S.isMountSensor(id)).toBe(false));
    S.SET_KEYS.forEach((k) => expect(S.isMountSensor('~mnt-' + k)).toBe(true));
    expect(S.isMountSensor('~engine')).toBe(false);
    expect(S.isMountSensor(null)).toBe(false);
  });

  test('yayınlanan küme kimlikleri beyaz listeyle birebir', () => {
    const R = cp._mntComputeResults('sv');
    R.signals.forEach((ds) => expect(S.isMountSensor(ds.sensorId)).toBe(true));
  });
});
