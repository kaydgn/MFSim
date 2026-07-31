/**
 * Takoz kütüphanesi — aynı parça kodu, farklı takoz
 * ─────────────────────────────────────────────────
 * 57RS313773 / 57RS313774 kodları iki ayrı kaynakta iki AYRI takoz için geçiyor:
 *
 *   A26        (powerpack_mount_analysis_A26.html)  — modülün türetildiği araç
 *   ASR-SR-116 (BMC ASFAT 8x8 Obüs, 04.08.2021)     — Tablo 9
 *
 * Kullanıcı kararı: ikisi de ayrı girdi olarak tutulur. Bu testler
 *   (1) iki kaynağın değerlerinin BİRBİRİNE KARIŞMADIĞINI,
 *   (2) kayıtlı projelerin bağını koparmayacak şekilde eski anahtarların
 *       KORUNDUĞUNU,
 *   (3) ASR-SR-116 satırlarının o dokümanın KENDİ sonuçlarını (Tablo 8 çökme,
 *       Tablo 11 sönüm) yeniden ürettiğini
 * kalıcı olarak kilitler. Bir hane kayarsa sonuçlar sessizce "makul ama yanlış"
 * çıkar — kritik olan da bu.
 */

const core = require('../../js/mount-core.js');
global.veMountCore = core;

const stubs = stubGlobals({ saveState: jest.fn(), showToast: jest.fn(), showNodeProperties: jest.fn() });
const fs = require('fs');
const path = require('path');
eval(fs.readFileSync(path.join(__dirname, '../../js/components.js'), 'utf8'));
global.componentDefs = componentDefs;
const cp = require('../../js/cp-mount.js');

beforeEach(() => { resetStubs(stubs); global.nodes = []; });

// ── ASR-SR-116 Tablo 9 (kaynağa karşı altın referans) ────────────────────────
const SR116 = {
  '57RS313773-sr116': { etiket: 'ARKA', s: [462, 462, 2200],    d: [630, 630, 3000] },
  '57RS313774-sr116': { etiket: 'ÖN',   s: [1045, 1045, 1800],  d: [1045, 1045, 1800] },
};
// ── A26 (mevcut, dokunulmadı) ────────────────────────────────────────────────
const A26 = {
  '57RS313773': { etiket: 'ÖN',   s: [334, 334, 2300],    d: [435, 435, 3000] },
  '57RS313774': { etiket: 'ARKA', s: [1200, 1200, 2400],  d: [950, 950, 1900] },
};

describe('İki kaynak ayrı girdi olarak duruyor', () => {
  test('dört girdi de kütüphanede ve anahtarları farklı', () => {
    const L = cp.VE_MOUNT_LIBRARY;
    Object.keys(A26).concat(Object.keys(SR116)).forEach((k) => expect(L[k]).toBeDefined());
    expect(new Set(Object.keys(L)).size).toBe(Object.keys(L).length);
  });

  test('ASR-SR-116 değerleri Tablo 9 ile birebir', () => {
    Object.entries(SR116).forEach(([k, v]) => {
      const e = cp.VE_MOUNT_LIBRARY[k];
      expect([e.sx, e.sy, e.sz]).toEqual(v.s);
      expect([e.dx, e.dy, e.dz]).toEqual(v.d);
    });
  });

  test('A26 değerleri DEĞİŞMEDİ (regresyon)', () => {
    Object.entries(A26).forEach(([k, v]) => {
      const e = cp.VE_MOUNT_LIBRARY[k];
      expect([e.sx, e.sy, e.sz]).toEqual(v.s);
      expect([e.dx, e.dy, e.dz]).toEqual(v.d);
    });
  });

  test('ad yalnız KOD + KAYNAK taşır; konum etiketi (ÖN/ARKA) YOK', () => {
    const L = cp.VE_MOUNT_LIBRARY;
    ['57RS313773', '57RS313774', '57RS313773-sr116', '57RS313774-sr116'].forEach((k) => {
      // ön/arka takozun değil, monte edildiği yerin özelliğidir → adda geçmemeli
      expect(L[k].name).not.toMatch(/ÖN|ARKA|Ön|Arka/);
    });
    expect(L['57RS313773'].name).toBe('57RS313773 (A26)');
    expect(L['57RS313774'].name).toBe('57RS313774 (A26)');
    expect(L['57RS313773-sr116'].name).toBe('57RS313773 (ASR-SR-116)');
    expect(L['57RS313774-sr116'].name).toBe('57RS313774 (ASR-SR-116)');
  });

  test('aynı kodun iki sürümü adından ayırt edilebiliyor', () => {
    const L = cp.VE_MOUNT_LIBRARY;
    expect(L['57RS313773'].name).not.toBe(L['57RS313773-sr116'].name);
    expect(L['57RS313774'].name).not.toBe(L['57RS313774-sr116'].name);
    // tüm gömülü adlar tekil olmalı (listede aynı satır iki kez görünmesin)
    const names = Object.values(L).map((e) => e.name);
    expect(new Set(names).size).toBe(names.length);
  });

  test('iki kaynağın değerleri birbirine karışmıyor', () => {
    const L = cp.VE_MOUNT_LIBRARY;
    expect(L['57RS313773'].sz).not.toBe(L['57RS313773-sr116'].sz);
    expect(L['57RS313774'].dz).not.toBe(L['57RS313774-sr116'].dz);
  });
});

describe('Geriye uyum — kayıtlı projeler kopmuyor', () => {
  test('eski libKey hâlâ çözülüyor ve A26 değerlerini uyguluyor', () => {
    const n = { id: 'm1', type: 'mnt-mount', def: componentDefs['mnt-mount'],
                data: { libKey: '57RS313773' } };
    global.nodes = [n];
    expect(cp.veMntGetLibraryMap()['57RS313773']).toBeDefined();
    cp.veMntApplyLib('m1', '57RS313773');
    expect([n.data.kxs, n.data.kys, n.data.kzs]).toEqual(A26['57RS313773'].s);
    expect([n.data.kxd, n.data.kyd, n.data.kzd]).toEqual(A26['57RS313773'].d);
  });

  test('yeni kaynak uygulanınca ASR-SR-116 değerleri gelir', () => {
    const n = { id: 'm1', type: 'mnt-mount', def: componentDefs['mnt-mount'], data: {} };
    global.nodes = [n];
    cp.veMntApplyLib('m1', '57RS313774-sr116');
    expect([n.data.kxs, n.data.kys, n.data.kzs]).toEqual(SR116['57RS313774-sr116'].s);
    expect([n.data.kxd, n.data.kyd, n.data.kzd]).toEqual(SR116['57RS313774-sr116'].d);
    expect(n.data.libKey).toBe('57RS313774-sr116');
  });

  test('dördü de takoz panelinin açılır listesinde görünüyor', () => {
    const html = cp.getMntMountPropertiesHTML({ id: 'm1', type: 'mnt-mount', def: {}, data: {} });
    ['57RS313773', '57RS313774', '57RS313773-sr116', '57RS313774-sr116']
      .forEach((k) => expect(html).toContain('value="' + k + '"'));
  });
});

describe('ASR-SR-116 girdileri dokümanın KENDİ sonuçlarını üretiyor', () => {
  // ASFAT 8x8 Obüs: 3 gövde (Tablo 5) + 6 takoz (Tablo 6). Şaft CG'si dokümanda
  // verilmediğinden moment dengesinden kestirilir — bu yüzden karşılaştırma
  // toleransı 0,05 mm (haneler değil, mertebe ve dağılım kilitleniyor).
  const mm = (v) => v / 1000;
  const COMPS = [
    { name: 'Motor',    mass: 1600, cg: [-314.94, -0.127, 857.56].map(mm),
      I: [[110.7, 0, 0], [0, 260.2, 0], [0, 0, 205.9]], pointMass: false },
    { name: 'Şanzıman', mass: 839,  cg: [932.365, -13.003, 700.632].map(mm),
      I: [[44.6, 0, 0], [0, 97.8, 0], [0, 0, 94.6]], pointMass: false },
    { name: 'Şaft',     mass: 16,   cg: [2263, 0, 0].map(mm),
      I: [[0.042, 0, 0], [0, 1.16, 0], [0, 0, 1.16]], pointMass: false },
  ];
  const HP = [['Ön Sol', -953.45, -50.67, 367, 'ÖN'], ['Ön Sağ', -953.45, 50.67, 367, 'ÖN'],
              ['Sol Ön', 535.31, -347.1, 615.77, 'ARKA'], ['Sağ Ön', 535.31, 347.1, 615.77, 'ARKA'],
              ['Sol Arka', 636.8, -347.1, 615.77, 'ARKA'], ['Sağ Arka', 636.8, 347.1, 615.77, 'ARKA']];

  // Rolüne göre ASR-SR-116 girdisini seç (ÖN → 774-sr116, ARKA → 773-sr116)
  const byRole = {};
  Object.entries(SR116).forEach(([k, v]) => { byRole[v.etiket] = cp.VE_MOUNT_LIBRARY[k]; });

  const solve = () => {
    const mounts = HP.map((h) => { const e = byRole[h[4]];
      return { name: h[0], pos: [h[1], h[2], h[3]].map(mm),
               kstat: [e.sx, e.sy, e.sz].map((v) => v * 1000),
               kdyn:  [e.dx, e.dy, e.dz].map((v) => v * 1000) }; });
    const mp = core.combineMassProps(COMPS);
    const res = core.solveCase(core.buildK(mounts, mp.cg, false), mounts, mp.cg, mp.m, 9.81,
                               { name: 'Static', n: [0, 0, -1], T: [0, 0, 0] });
    return { mounts, mp, res };
  };

  test('toplam kütle dokümanla aynı (2455 kg)', () => {
    expect(core.combineMassProps(COMPS).m).toBeCloseTo(2455, 6);
  });

  test('Tablo 8 çökmeleri yeniden üretiliyor', () => {
    const { res } = solve();
    const PDF = [-1.993, -1.985, -1.952, -1.897, -1.947, -1.893];   // Ön Sol…Sağ Arka
    res.perMount.forEach((pm, i) => {
      expect(pm.delta[2] * 1000).toBeCloseTo(PDF[i], 1);            // ±0,05 mm
    });
    expect(res.checks.tensionCount).toBe(0);                        // hepsi basıda
  });

  test('Tablo 11 sönüm katsayıları yeniden üretiliyor (ζ=0,02)', () => {
    const { mounts, res } = solve();
    const shares = core.mountLoadShares(res, 9.81);
    const d = core.mountDamping(mounts, shares, 0.02);
    const PDFcz = [1.03, 1.02, 1.45, 1.43, 1.45, 1.43];             // Ön Sol…Sağ Arka
    const PDFcx = [0.78, 0.78, 0.66, 0.65, 0.66, 0.65];
    d.forEach((e, i) => {
      expect(e.c[2] / 1000).toBeCloseTo(PDFcz[i], 1);
      expect(e.c[0] / 1000).toBeCloseTo(PDFcx[i], 1);
    });
  });

  test('A26 girdileriyle çözüm BELİRGİN ŞEKİLDE farklı (karışırsa fark edilir)', () => {
    const a26 = HP.map((h) => { const e = cp.VE_MOUNT_LIBRARY[h[4] === 'ÖN' ? '57RS313773' : '57RS313774'];
      return { name: h[0], pos: [h[1], h[2], h[3]].map(mm),
               kstat: [e.sx, e.sy, e.sz].map((v) => v * 1000),
               kdyn:  [e.dx, e.dy, e.dz].map((v) => v * 1000) }; });
    const mp = core.combineMassProps(COMPS);
    const resA = core.solveCase(core.buildK(a26, mp.cg, false), a26, mp.cg, mp.m, 9.81,
                                { name: 'Static', n: [0, 0, -1], T: [0, 0, 0] });
    const { res: resS } = solve();
    // en az bir takozda 0,2 mm'den büyük fark olmalı — iki kaynak eşdeğer değil
    const maxDiff = Math.max(...resA.perMount.map((p, i) =>
      Math.abs(p.delta[2] - resS.perMount[i].delta[2]) * 1000));
    expect(maxDiff).toBeGreaterThan(0.2);
  });
});
