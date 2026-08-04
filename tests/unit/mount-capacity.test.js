/**
 * Takoz taşıma kapasitesi ve % kullanım
 * ─────────────────────────────────────
 * Kapasite (maxLoad) üretici kataloğundan gelen OPSİYONEL bir sınırdır ve
 * FİZİĞE GİRMEZ: çözücü onu görmez, rijitliği ve çökmeyi değiştirmez. Yalnız
 * "bu takoz taşıdığı yükün yüzde kaçında çalışıyor" sorusunu cevaplar.
 *
 * Burada test edilen iki şey var, ikisi de sessiz hata sınıfından:
 *
 *  1. BİRİM DÖNÜŞÜMÜ. Alan kg (katalog konvansiyonu: "Max. Load 2.000 kg"),
 *     karşılaştırma N. Dönüşüm TEK yerde (cp-mount.js _mntToSI: fCap = kg·g).
 *     İki yerde çarpılırsa biri unutulur ve yüzde 9,81 kat şaşar; "%4" yazan
 *     bir tablo tamamen makul görünür.
 *
 *  2. TANIMSIZ KAPASİTENİN SESSİZ KALMASI. Kapasite girilmemişse sütun, çizgi
 *     ve cümle HİÇ çıkmaz. Sıfır kapasiteli bir satır "%∞ yüklü" der; boş bir
 *     sütun "kapasite biliniyor ama sıfır" izlenimi verir. İkisi de yanlış.
 */
const core = require('../../js/mount-core.js');
global.veMountCore = core;
global.veMntBrief = require('../../js/mount-brief.js');
const S = require('../../js/mount-signals.js');
global.veMntSignals = S;
const B = global.veMntBrief;
const cp = require('../../js/cp-mount.js');
const rep = require('../../js/cp-mount-report.js');

const G = 9.81;

// Çözücüye bağlı gerçek kanvas topolojisi. caps[i] = o takozun maxLoad'u [kg]
// (null → alan hiç yazılmaz, kullanıcının boş bıraktığı hâl).
function buildTopology(caps) {
  const EX = core.TTAR_EXAMPLE;
  const nodes = [], connections = [];
  const solver = { id: 'sv', type: 'mnt-solver', def: { name: 'Takoz Çözücü', isMountSolver: true }, data: {} };
  let c = 0;
  EX.components.forEach((b) => {
    const id = 'm' + (++c);
    nodes.push({ id, type: 'mnt-motor', customName: b.name, def: { name: b.name, isMountBody: true },
      data: { mass: b.mass, cgx: b.cg[0], cgy: b.cg[1], cgz: b.cg[2], Ixx: b.Ixx, Iyy: b.Iyy,
              Izz: b.Izz, Ixy: b.Ixy, Ixz: b.Ixz, Iyz: b.Iyz, pointMass: !!b.pointMass } });
    connections.push({ id: 'c' + c, from: id, to: solver.id, fromPort: 'output', toPort: 'input' });
  });
  EX.mounts.forEach((m, k) => {
    const id = 'm' + (++c);
    const data = { x: m.pos[0], y: m.pos[1], z: m.pos[2],
                   kxs: m.kstat[0], kys: m.kstat[1], kzs: m.kstat[2],
                   kxd: m.kdyn[0], kyd: m.kdyn[1], kzd: m.kdyn[2] };
    if (caps && caps[k] != null) data.maxLoad = caps[k];
    nodes.push({ id, type: 'mnt-mount', customName: m.name, def: { name: m.name, isMount: true }, data });
    connections.push({ id: 'c' + c, from: id, to: solver.id, fromPort: 'output', toPort: 'input' });
  });
  nodes.push(solver);
  return { nodes, connections };
}

global.veUpdateResultsTree = jest.fn();
global.showToast = jest.fn();
global.saveState = jest.fn();

function solve(caps) {
  const topo = buildTopology(caps);
  global.nodes = topo.nodes;
  global.connections = topo.connections;
  return cp._mntComputeResults('sv');
}

const NM = core.TTAR_EXAMPLE.mounts.length;
const capsAll = (kg) => new Array(NM).fill(kg);

// Kapasitesiz referans çözüm (birden çok testte paylaşılır).
let R0 = null;
beforeAll(() => { R0 = solve(null); });

describe('kg → N dönüşümü TEK yerde', () => {
  test('fCap = maxLoad · g — katalog kg\'ı SI newton olur', () => {
    const R = solve(capsAll(2000));
    R.mounts.forEach((mt) => expect(mt.fCap).toBeCloseTo(2000 * G, 9));
  });

  test('kapasite girilmemişse fCap alanı HİÇ yok', () => {
    const R = solve(null);
    R.mounts.forEach((mt) => expect(mt.fCap).toBeUndefined());
  });

  test('sıfır / negatif / metin kapasite yok sayılır', () => {
    [0, -5, ''].forEach((bad) => {
      const R = solve(capsAll(bad));
      R.mounts.forEach((mt) => expect(mt.fCap).toBeUndefined());
    });
  });

  test('kapasite ÇÖZÜMÜ DEĞİŞTİRMEZ — sehim ve kuvvet birebir aynı', () => {
    // Kapasite bir raporlama sınırıdır. Çözüme sızarsa (ör. yanlışlıkla bir
    // durdurucu gibi davranırsa) sonuç sessizce değişirdi.
    const a = solve(null), b = solve(capsAll(1500));
    const sa = a.allCases.find((c) => c.name === 'Static').res;
    const sb = b.allCases.find((c) => c.name === 'Static').res;
    sa.perMount.forEach((pm, i) => {
      expect(sb.perMount[i].f[2]).toBeCloseTo(pm.f[2], 9);
      expect(sb.perMount[i].delta[2]).toBeCloseTo(pm.delta[2], 12);
    });
    expect(b.modes.map((m) => m.f_Hz)).toEqual(a.modes.map((m) => m.f_Hz));
  });
});

describe('F(δ) diyagramında kapasite çizgisi', () => {
  const markOf = (R) => R.signals.find((d) => d.key === 'fdefl').brief.marks
    .filter((m) => m.axis === 'y');

  test('çizgi BASMA tarafında (−fCap) ve newton şeridine ait', () => {
    // İşaret sözleşmesi: δ < 0 basma → F < 0. Kapasite çizgisi eğrinin ezilme
    // kolunda durmalı; +fCap'e konsaydı grafiğin boş yarısında dururdu.
    const R = solve(capsAll(2000));
    const y = markOf(R);
    expect(y.length).toBe(1);
    expect(y[0].value).toBeCloseTo(-2000 * G, 6);
    expect(y[0].unit).toBe('N');
    expect(y[0].kind).toBe('limit');
  });

  test('kapasite yoksa çizgi de yok', () => {
    expect(markOf(solve(null)).length).toBe(0);
  });

  test('farklı kapasiteler AYRI çizgi alır', () => {
    const caps = capsAll(2000);
    caps[0] = 1200;
    const y = markOf(solve(caps));
    expect(y.length).toBe(2);
    expect(y.map((m) => Math.round(-m.value / G)).sort((a, b) => a - b)).toEqual([1200, 2000]);
  });

  test('üçten fazla ayrı kapasitede yalnız EN DÜŞÜK çizilir', () => {
    // Sınırı ilk zorlayan en düşük kapasitedir; altı ayrı çizgi grafiği
    // okunmaz yapardı.
    const caps = [900, 1200, 1500, 1800, 2100, 2400].slice(0, NM);
    while (caps.length < NM) caps.push(3000);
    const y = markOf(solve(caps));
    expect(y.length).toBe(1);
    expect(Math.round(-y[0].value / G)).toBe(Math.min(...caps));
    expect(y[0].label).toContain('en düşük');
  });
});

describe('yorum — % kullanım', () => {
  test('yüzde = |f_z| / fCap · 100, modelin kendi kuvvetiyle', () => {
    const R = solve(capsAll(2000));
    const stat = R.allCases.find((c) => c.name === 'Static').res;
    const worst = Math.max(...stat.perMount.map((pm) => Math.abs(pm.f[2])));
    const beklenen = (worst / (2000 * G)) * 100;

    const ds = R.signals.find((d) => d.key === 'fdefl');
    const ids = ds.channels.filter((ch) => /Z \(düşey\)/.test(ch.name)).map((ch) => ch.id);
    const t = B.forLane(ds, R, ids).paras.join(' ');
    // Yüzde bir ondalıkla yazılır; virgül Türkçe ayraç
    expect(t).toContain('%' + beklenen.toFixed(1).replace('.', ','));
  });

  test('kapasite yoksa yüzde cümlesi HİÇ kurulmaz', () => {
    const R = solve(null);
    const ds = R.signals.find((d) => d.key === 'fdefl');
    const ids = ds.channels.filter((ch) => /Z \(düşey\)/.test(ch.name)).map((ch) => ch.id);
    const t = B.forLane(ds, R, ids).paras.join(' ');
    expect(t).not.toContain('kapasite');
  });

  test('kapasite aşılırsa cümle bunu açıkça söyler', () => {
    // Küçücük bir kapasite: statik yük onu kesin aşar.
    const R = solve(capsAll(10));
    const ds = R.signals.find((d) => d.key === 'fdefl');
    const ids = ds.channels.filter((ch) => /Z \(düşey\)/.test(ch.name)).map((ch) => ch.id);
    expect(B.forLane(ds, R, ids).paras.join(' ')).toContain('Kapasite aşılıyor');
  });
});

describe('Rapor §8.3 — Yük (%) sütunu', () => {
  // §8.3 doğrudan çağrılır: tüm raporu kurmak bu testin ilgi alanı değil.
  const html = (R) => rep._mntRepStep3Static(R, rep._mntRepGeom(R));

  test('kapasite tanımlıysa sütun açılır ve yüzde tabloda görünür', () => {
    const R = solve(capsAll(2000));
    const h = html(R);
    expect(h).toContain('Yük [%]');
    expect(h).toContain('Kapasite [kN]');
    const stat = R.allCases.find((c) => c.name === 'Static').res;
    const worst = Math.max(...stat.perMount.map((pm) => Math.abs(pm.f[2])));
    expect(h).toContain(((worst / (2000 * G)) * 100).toFixed(1));
  });

  test('kapasite yoksa sütun HİÇ açılmaz — boş sütun görünmez', () => {
    expect(html(solve(null))).not.toContain('Yük [%]');
  });

  test('kapasitesi olan / olmayan takozlar bir arada — eksik hücre tire', () => {
    const caps = capsAll(2000);
    caps[0] = null;
    const h = html(solve(caps));
    expect(h).toContain('Yük [%]');
    expect(h).toContain('—');
  });
});

describe('kütüphaneden uygulama', () => {
  test('kapasitesiz tipe geçilince ESKİ kapasite temizlenir', () => {
    // Aksi hâlde önceki tipin kapasitesi sessizce devam eder ve yeni takoz
    // için tamamen yanlış bir "% kullanım" raporlanırdı.
    const node = { id: 'mnt1', type: 'mnt-mount', def: { isMount: true },
                   data: { maxLoad: 2000 } };
    global.nodes = [node];
    const key = Object.keys(cp.VE_MOUNT_LIBRARY)[0];
    cp.veMntApplyLib('mnt1', key);
    expect(cp.VE_MOUNT_LIBRARY[key].maxLoad).toBeUndefined();   // gömülüde kapasite yok
    expect(node.data.maxLoad).toBeUndefined();
  });

  test('gömülü katalogda uydurma kapasite YOK', () => {
    // Kaynak dokümanlarımız bu girdiler için kapasite vermiyor. Makul bir sayı
    // uydurulursa kullanıcı onu üreticinin verisi sanır.
    Object.keys(cp.VE_MOUNT_LIBRARY).forEach((k) => {
      expect(cp.VE_MOUNT_LIBRARY[k].maxLoad).toBeUndefined();
    });
  });
});

describe('F(δ) üzerinde takoz başına çalışma noktası', () => {
  // Çalışma noktası (δ, F) ÇİFTİDİR. Eskiden yalnız en çok ezilen takozun
  // δ'sını gösteren tek bir dikey çizgi vardı; öteki takozların nerede
  // çalıştığı ve her birinin taşıdığı kuvvet görünmüyordu.
  const pts = (R) => R.signals.find((d) => d.key === 'fdefl').brief.marks
    .filter((m) => m.axis === 'point');

  test('her takoz için bir nokta, koordinatlar statik çözümden', () => {
    const R = solve(null);
    const stat = R.allCases.find((c) => c.name === 'Static').res;
    const p = pts(R);
    expect(p.length).toBe(R.mounts.length);
    stat.perMount.forEach((pm, i) => {
      const hit = p.find((m) => m.label.indexOf(R.mounts[i].name) === 0);
      expect(hit).toBeTruthy();
      expect(hit.value).toBeCloseTo(pm.delta[2] * 1000, 9);   // x: mm
      expect(hit.y).toBeCloseTo(pm.f[2], 6);                  // y: N
      expect(hit.unit).toBe('N');
    });
  });

  test('nokta KENDİ eğrisine bağlı — chanId o takozun Z kanalı', () => {
    // Bağ olmasaydı altı nokta her şeritte çizilir, kullanıcı bir takozun
    // çalışma noktasını başka bir takozun eğrisi üstünde okurdu.
    const R = solve(null);
    const ds = R.signals.find((d) => d.key === 'fdefl');
    pts(R).forEach((m) => {
      const ch = ds.channels.find((c) => c.id === m.chanId);
      expect(ch).toBeTruthy();
      expect(ch.name).toContain('Z (düşey)');
      expect(m.label.indexOf(ch.name.split(' · ')[0])).toBe(0);
    });
  });

  test('nokta gerçekten EĞRİNİN ÜSTÜNDE — F(δ_çalışma) ile birebir', () => {
    // Nokta ile eğri ayrışırsa kullanıcı "bu takoz eğrisinin dışında çalışıyor"
    // diye okur. Aynı yasadan geldikleri için birebir örtüşmeleri gerekir.
    const R = solve(null);
    const ds = R.signals.find((d) => d.key === 'fdefl');
    pts(R).forEach((m) => {
      const ch = ds.channels.find((c) => c.id === m.chanId);
      const onCurve = B.interpAt(ds.x.data, ch.data, m.value);
      expect(onCurve).toBeCloseTo(m.y, 6);
    });
  });

  test('tek dikey "çalışma noktası" çizgisi KALDIRILDI', () => {
    const xm = R0.signals.find((d) => d.key === 'fdefl').brief.marks
      .filter((m) => m.axis === 'x');
    expect(xm.some((m) => /çalışma noktası/.test(m.label))).toBe(false);
    // Bant ve durdurucu çizgileri duruyor
    expect(xm.map((m) => m.value).sort((a, b) => a - b)).toEqual([-15, -10, 10, 15]);
  });
});
