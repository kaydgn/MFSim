/**
 * Ateşleme frekansı girdileri — rölanti devri + silindir sayısı Motor'da
 * ────────────────────────────────────────────────────────────────────────
 * f_ateş = (N/60)·(z/2) raporun Kriter 1 ve iletilebilirlik değerlendirmesinin
 * tabanıdır. N (rölanti) ve z (silindir) MOTORUN özelliğidir.
 *
 * REGRESYON ZEMİNİ: Motor panelinde bir "Rölanti [rpm]" alanı vardı ama rapor
 * onu HİÇ OKUMUYORDU — kendi panelindeki ayrı alanı istiyordu. Kullanıcı Motor'a
 * girdiği değerin kullanıldığını sanıyor, rapor sessizce §8.8'i atlıyordu.
 * Silindir sayısı ise Motor'da hiç yoktu. Buradaki testler o kopukluğu kapatır.
 */

const core = require('../../js/mount-core.js');
global.veMountCore = core;

const stubs = stubGlobals({ saveState: jest.fn(), showToast: jest.fn(), showNodeProperties: jest.fn() });
const fs = require('fs');
const path = require('path');
eval(fs.readFileSync(path.join(__dirname, '../../js/components.js'), 'utf8'));
global.componentDefs = componentDefs;

const cp = require('../../js/cp-mount.js');
const rep = require('../../js/cp-mount-report.js');

beforeEach(() => { resetStubs(stubs); global.nodes = []; global._veMntLast = null; });

const motor = (data) => ({ id: 'mo', type: 'mnt-motor', def: componentDefs['mnt-motor'],
                           customName: 'Motor', data: Object.assign({ mass: 1600 }, data) });

describe('Motor paneli', () => {
  test('silindir sayısı alanı var ve kaydediliyor', () => {
    const n = motor({});
    const html = cp.getMntMassPropertiesHTML(n);
    expect(html).toContain("'cylinders'");
    expect(html).toContain('Silindir sayısı');
    expect(html).toContain('Rölanti [rpm]');
  });

  test('ateşleme frekansı formülü panelde açıklanıyor (alan neden var)', () => {
    expect(cp.getMntMassPropertiesHTML(motor({}))).toContain('(N/60)');
  });

  test('yalnız Motor tipinde — Şanzıman/Transfer/Braket\'te yok', () => {
    ['mnt-gearbox', 'mnt-transfer', 'mnt-bracket'].forEach((t) => {
      const html = cp.getMntMassPropertiesHTML({ id: 'x', type: t, def: {}, data: {} });
      expect(html).not.toContain('Silindir sayısı');
    });
  });
});

describe('Çözücü toplaması — Motor değerleri sonuca akıyor', () => {
  test('_mntGatherTorque rölanti + silindiri toplar', () => {
    global.nodes = [motor({ idleRpm: 600, cylinders: 6, Te: 3000 })];
    const t = cp._mntGatherTorque();
    expect(Number(t.idleRpm)).toBe(600);
    expect(Number(t.cylinders)).toBe(6);
    expect(Number(t.Te)).toBe(3000);
  });

  test('Motor yoksa alanlar tanımsız kalır (uydurulmaz)', () => {
    global.nodes = [{ id: 'b', type: 'mnt-bracket', def: componentDefs['mnt-bracket'], data: { mass: 10 } }];
    const t = cp._mntGatherTorque();
    expect(t.idleRpm).toBeUndefined();
    expect(t.cylinders).toBeUndefined();
  });
});

describe('Rapor — Motor tek kaynak, Rapor düğümü yedek', () => {
  const R = (idleRpm, cylinders) => ({ gather: { torque: { idleRpm, cylinders } } });

  test('Motor değerleri Rapor düğümündekini EZER', () => {
    const e = rep._mntRepEngine(R(600, 6), { idleRpm: 900, cylinders: 4 });
    expect(e.idleRpm).toBe(600);
    expect(e.cylinders).toBe(6);
    expect(e.fromMotor).toBe(true);
  });

  test('eski projeler: Motor\'da yoksa Rapor düğümündeki değere düşer', () => {
    const e = rep._mntRepEngine(R(undefined, undefined), { idleRpm: 650, cylinders: 6 });
    expect(e.idleRpm).toBe(650);
    expect(e.cylinders).toBe(6);
    expect(e.fromMotor).toBe(false);
  });

  test('hiçbiri yoksa NaN — bölüm atlanır, sayı uydurulmaz', () => {
    const e = rep._mntRepEngine({}, {});
    expect(Number.isFinite(e.idleRpm)).toBe(false);
    expect(Number.isFinite(e.cylinders)).toBe(false);
  });

  test('sıfır/negatif değer geçersiz sayılır (0 rpm ateşleme frekansı üretmesin)', () => {
    const e = rep._mntRepEngine(R(0, 0), { idleRpm: 650, cylinders: 6 });
    expect(e.idleRpm).toBe(650);
    expect(e.cylinders).toBe(6);
  });
});

describe('Rapor §8.8 — Motor\'dan gelen değerlerle üretilir', () => {
  const baseR = (idleRpm, cylinders) => ({
    zeta: 0.02,
    gather: { torque: { idleRpm, cylinders }, components: [] },
    modes: [4, 5, 6, 8, 10, 12].map((f) => ({ f_Hz: f, phi: [1, 0, 0, 0, 0, 0], label: 'roll' })),
  });

  test('Motor 600 rpm / 6 silindir → f_ateş 30 Hz (PDF ile aynı)', () => {
    const html = rep._mntRepFreqPlacement(baseR(600, 6), {});
    expect(html).toContain('=30 \\) Hz');    // (600/60)·(6/2), _rF sondaki sıfırı kırpar
    expect(html).toContain('8.8');
  });

  test('Motor değeri yoksa §8.8 atlanır (boş döner)', () => {
    expect(rep._mntRepFreqPlacement(baseR(undefined, undefined), {})).toBe('');
  });

  test('uygunluk tablosu da Motor\'dan okur; yoksa "bekliyor" der ve Motor\'a yönlendirir', () => {
    const ok = rep._mntRepCompliance(baseR(600, 6), {});
    expect(ok).toContain('f_ateş 30 Hz');
    const wait = rep._mntRepCompliance(baseR(undefined, undefined), {});
    expect(wait).toContain('Motor bileşeni');
    expect(wait).not.toContain('Rapor paneli');   // eski yanlış yönlendirme gitmeli
  });
});

describe('Rapor paneli — artık girdi değil, kaynak göstergesi', () => {
  test('değerleri ve nereden geldiğini gösterir, girdi alanı basmaz', () => {
    global._veMntLast = { zeta: 0.02, gather: { torque: { idleRpm: 600, cylinders: 6 }, components: [] },
                          mounts: [], error: null };
    const html = rep.getMntReportPropertiesHTML({ id: 'r1', type: 'mnt-report', data: {} });
    expect(html).toContain('Motor</b> bileşeni');
    expect(html).toContain('Çözücü</b> bileşeni');
    expect(html).toContain('30 Hz</b>');                      // f_ateş türetildi
    expect(html).not.toContain("'idleRpm',this.value");       // girdi alanı kaldırıldı
    expect(html).not.toContain("'cylinders',this.value");
    expect(html).not.toContain("'zeta',this.value");
  });

  test('değer yoksa §8.8\'in atlanacağını açıkça söyler', () => {
    global._veMntLast = { zeta: 0.02, gather: { torque: {}, components: [] }, mounts: [], error: null };
    const html = rep.getMntReportPropertiesHTML({ id: 'r1', type: 'mnt-report', data: {} });
    expect(html).toContain('girilmedi');
    expect(html).toContain('§8.8 atlanır');
  });
});

describe('Uçtan uca — Motor\'a girilen değer rapora ulaşıyor', () => {
  test('kanvasa Motor kur → çöz → R.gather.torque taşır → §8.8 üretilir', () => {
    const EX = core.TTAR_EXAMPLE;
    const bodies = EX.components.map((c, i) => ({
      id: 'b' + i, type: i === 0 ? 'mnt-motor' : 'mnt-bracket',
      def: { isMountBody: true }, customName: c.name,
      data: Object.assign({ mass: c.mass, cgx: c.cg[0], cgy: c.cg[1], cgz: c.cg[2],
        Ixx: c.Ixx, Iyy: c.Iyy, Izz: c.Izz, Ixy: c.Ixy, Ixz: c.Ixz, Iyz: c.Iyz,
        pointMass: !!c.pointMass }, i === 0 ? { idleRpm: 600, cylinders: 6 } : {}) }));
    const mounts = EX.mounts.map((m, i) => ({
      id: 'm' + i, type: 'mnt-mount', def: { isMount: true }, customName: m.name,
      data: { x: m.pos[0], y: m.pos[1], z: m.pos[2],
              kxs: m.kstat[0], kys: m.kstat[1], kzs: m.kstat[2],
              kxd: m.kdyn[0], kyd: m.kdyn[1], kzd: m.kdyn[2] } }));
    global.nodes = bodies.concat(mounts, [{ id: 'sv', type: 'mnt-solver',
      def: { isMountSolver: true }, data: {} }]);

    const Rres = cp._mntComputeResults('sv');
    expect(Number(Rres.gather.torque.idleRpm)).toBe(600);
    expect(Number(Rres.gather.torque.cylinders)).toBe(6);
    // Rapor düğümünde HİÇBİR ŞEY girilmemişken §8.8 yine de üretilmeli
    const s8 = rep._mntRepFreqPlacement(Rres, {});
    expect(s8).not.toBe('');
    expect(s8).toContain('=30 \\) Hz');
  });
});
