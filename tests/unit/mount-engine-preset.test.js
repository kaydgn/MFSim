/**
 * Takoz Motor'u ↔ Araç Performans motor kataloğu köprüsü
 * ─────────────────────────────────────────────────────
 * Aynı motor iki modülde de kullanılabildiği için tahrik büyüklükleri katalogdan
 * gelir. Kritik olan NE GELDİĞİ kadar NE GELMEDİĞİDİR:
 *
 *   gelir  : Te · TeRpm · Pmax · PmaxRpm · idleRpm
 *   gelmez : kütle · CG · atalet tensörü · silindir sayısı
 *
 * En tehlikeli senaryo preset'teki `specs.inertia` (KRANK MİLİ döner ataleti,
 * 0,5–3 kg·m²) ile takozun rijit gövde atalet TENSÖRÜNÜN (100+ kg·m²)
 * karıştırılmasıdır — iki mertebe fark eder ve sonuç "makul ama yanlış" çıkar.
 * Buradaki testler o karışmayı kalıcı olarak yasaklar.
 */

const core = require('../../js/mount-core.js');
global.veMountCore = core;

const stubs = stubGlobals({
  saveState: jest.fn(),
  showToast: jest.fn(),
  showNodeProperties: jest.fn(),
});

const fs = require('fs');
const path = require('path');
eval(fs.readFileSync(path.join(__dirname, '../../js/components.js'), 'utf8'));
global.componentDefs = componentDefs;

// GERÇEK katalog — köprü ile katalog aynı kaynağa baksın (preset yapısı
// değişirse bu test kırılsın, sessizce boş dolum yapmasın).
const engSrc = fs.readFileSync(path.join(__dirname, '../../js/cp-engine.js'), 'utf8');
const m = engSrc.match(/var VE_FT_MOTOR_PRESETS = \{[\s\S]*?\n\};/);
eval(m[0]);
global.VE_FT_MOTOR_PRESETS = VE_FT_MOTOR_PRESETS;

const cp = require('../../js/cp-mount.js');

const mkMotor = () => ({ id: 'mo', type: 'mnt-motor', def: componentDefs['mnt-motor'], data: {} });
beforeEach(() => { resetStubs(stubs); global.nodes = []; });

describe('Katalog erişimi', () => {
  test('katalog gerçekten yüklü ve Cummins ailesi var', () => {
    const keys = Object.keys(VE_FT_MOTOR_PRESETS);
    expect(keys.length).toBeGreaterThan(30);
    expect(keys.some((k) => k.indexOf('isx15') === 0)).toBe(true);
  });
});

describe('Preset → takoz Motor alanları', () => {
  test('tepe tork / maks güç eğriden, rölanti specs\'ten okunur', () => {
    const v = cp._mntEnginePresetValues('isx15_600_fr11860');
    expect(v.idleRpm).toBe(VE_FT_MOTOR_PRESETS['isx15_600_fr11860'].specs.idleRpm);
    const rows = VE_FT_MOTOR_PRESETS['isx15_600_fr11860'].data;
    expect(v.Te).toBe(Math.max(...rows.map((r) => r.torque)));
    expect(v.Pmax).toBeCloseTo(Math.max(...rows.map((r) => r.power)), 1);
    // devirler eğrideki gerçek noktalara denk gelmeli
    expect(rows.some((r) => r.rpm === v.TeRpm && r.torque === v.Te)).toBe(true);
    expect(rows.some((r) => r.rpm === v.PmaxRpm)).toBe(true);
  });

  test('düz tork platosunda EN DÜŞÜK devir seçilir (katalog konvansiyonu)', () => {
    global.VE_FT_MOTOR_PRESETS = {
      flat: { name: 'Düz plato', specs: { idleRpm: 600 },
        data: [{ rpm: 1000, torque: 900, power: 94 }, { rpm: 1200, torque: 1000, power: 126 },
               { rpm: 1400, torque: 1000, power: 147 }, { rpm: 1600, torque: 900, power: 151 }] } };
    expect(cp._mntEnginePresetValues('flat').TeRpm).toBe(1200);   // 1400 değil
    expect(cp._mntEnginePresetValues('flat').PmaxRpm).toBe(1600);
    global.VE_FT_MOTOR_PRESETS = VE_FT_MOTOR_PRESETS;
  });

  test('tüm katalog için türetme çöküyor mu / boş mu (toplu duman testi)', () => {
    Object.keys(VE_FT_MOTOR_PRESETS).forEach((k) => {
      const v = cp._mntEnginePresetValues(k);
      expect(v).not.toBeNull();
      expect(v.Te).toBeGreaterThan(0);
      expect(v.TeRpm).toBeGreaterThan(0);
      expect(v.idleRpm).toBeGreaterThan(0);
    });
  });

  test('bilinmeyen anahtar → null', () => {
    expect(cp._mntEnginePresetValues('yok_boyle_motor')).toBeNull();
  });
});

describe('Uygulama — NE GELMEDİĞİ', () => {
  test('kütle / CG / atalet tensörü / silindir sayısı DOKUNULMAZ', () => {
    const n = mkMotor();
    // kullanıcının elle girdiği araç-entegrasyonu verisi
    Object.assign(n.data, { mass: 1600, cgx: -314.94, cgy: -0.127, cgz: 857.56,
                            Ixx: 110.7, Iyy: 260.2, Izz: 205.9, cylinders: 6 });
    global.nodes = [n];
    cp.veMntApplyEnginePreset('mo', 'isx15_600_fr11860');
    expect(n.data.mass).toBe(1600);
    expect(n.data.cgx).toBe(-314.94);
    expect(n.data.cgy).toBe(-0.127);
    expect(n.data.cgz).toBe(857.56);
    expect(n.data.Ixx).toBe(110.7);
    expect(n.data.Iyy).toBe(260.2);
    expect(n.data.Izz).toBe(205.9);
    expect(n.data.cylinders).toBe(6);
  });

  test('krank döner ataleti (specs.inertia) rijit gövde ataletine SIZMAZ', () => {
    const n = mkMotor(); global.nodes = [n];
    cp.veMntApplyEnginePreset('mo', 'isx15_600_fr11860');
    const crank = VE_FT_MOTOR_PRESETS['isx15_600_fr11860'].specs.inertia;
    expect(crank).toBeGreaterThan(0);                       // katalogda gerçekten var
    expect(n.data.Ixx).toBeUndefined();                     // ama buraya yazılmadı
    expect(n.data.Iyy).toBeUndefined();
    expect(n.data.Izz).toBeUndefined();
    expect(n.data.inertia).toBeUndefined();
    expect(Object.values(n.data)).not.toContain(crank);
  });

  test('yalnız beş tahrik alanı + bağ anahtarı yazılır', () => {
    const n = mkMotor(); global.nodes = [n];
    cp.veMntApplyEnginePreset('mo', 'isb67_fr98387');
    expect(Object.keys(n.data).sort())
      .toEqual(['Pmax', 'PmaxRpm', 'Te', 'TeRpm', 'enginePreset', 'idleRpm']);
  });
});

describe('Uygulama — davranış', () => {
  test('değerler yazılır, seçim saklanır, panel yenilenir', () => {
    const n = mkMotor(); global.nodes = [n];
    cp.veMntApplyEnginePreset('mo', 'isx15_600_fr11860');
    const v = cp._mntEnginePresetValues('isx15_600_fr11860');
    expect(n.data.Te).toBe(v.Te);
    expect(n.data.idleRpm).toBe(v.idleRpm);
    expect(n.data.enginePreset).toBe('isx15_600_fr11860');
    expect(stubs.saveState).toHaveBeenCalled();
    expect(stubs.showNodeProperties).toHaveBeenCalled();
  });

  test('seçimi kaldırmak GİRİLEN DEĞERLERİ SİLMEZ (elle rötuş korunur)', () => {
    const n = mkMotor(); global.nodes = [n];
    cp.veMntApplyEnginePreset('mo', 'isx15_600_fr11860');
    n.data.Te = 2900;                       // kullanıcı elle rötuşladı
    cp.veMntApplyEnginePreset('mo', '');
    expect(n.data.enginePreset).toBeUndefined();
    expect(n.data.Te).toBe(2900);
  });

  test('bilinmeyen anahtar hiçbir şey değiştirmez', () => {
    const n = mkMotor(); n.data.Te = 760; global.nodes = [n];
    cp.veMntApplyEnginePreset('mo', 'yok_boyle_motor');
    expect(n.data.Te).toBe(760);
    expect(n.data.enginePreset).toBeUndefined();
  });

  test('düğüm yoksa çökmez', () => {
    global.nodes = [];
    expect(() => cp.veMntApplyEnginePreset('yok', 'isb67_fr98387')).not.toThrow();
  });
});

describe('Panel', () => {
  test('Motor panelinde seçici + gruplar + uyarı metni var', () => {
    const html = cp._mntEngineSection(mkMotor());
    expect(html).toContain('veMntApplyEnginePreset');
    expect(html).toContain('Cummins ISX 15L');
    expect(html).toContain('elle girilir');            // ne gelmediği yazıyor
  });

  test('seçili preset işaretli gelir', () => {
    const n = mkMotor(); n.data.enginePreset = 'isb67_fr98387';
    expect(cp._mntEnginePresetSelect(n)).toContain('value="isb67_fr98387" selected');
  });

  test('katalog yoksa seçici hiç çizilmez (panel yine çalışır)', () => {
    const saved = global.VE_FT_MOTOR_PRESETS;
    delete global.VE_FT_MOTOR_PRESETS;
    expect(cp._mntEnginePresetSelect(mkMotor())).toBe('');
    const html = cp._mntEngineSection(mkMotor());
    expect(html).toContain('Tepe Tork');               // alanlar yerinde
    expect(html).not.toContain('veMntApplyEnginePreset');
    global.VE_FT_MOTOR_PRESETS = saved;
  });

  test('yalnız Motor tipinde çıkar — Şanzıman/Transfer etkilenmez', () => {
    const gb = { id: 'g', type: 'mnt-gearbox', def: {}, data: {} };
    const tr = { id: 't', type: 'mnt-transfer', def: {}, data: {} };
    expect(cp.getMntMassPropertiesHTML(gb)).not.toContain('veMntApplyEnginePreset');
    expect(cp.getMntMassPropertiesHTML(tr)).not.toContain('veMntApplyEnginePreset');
    expect(cp.getMntMassPropertiesHTML(mkMotor())).toContain('veMntApplyEnginePreset');
  });
});
