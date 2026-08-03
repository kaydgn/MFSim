/**
 * LMT-1433-00 — BMC güç grubu FEA raporlarına karşı altın referans
 * ────────────────────────────────────────────────────────────────
 * Kaynak: BMC R&D FEA raporları — "BMC Engine Mount (8x8 Ttar)" (Onur GÖR,
 * 02.10.2018, V00) ve "(4x4 Tatar)" (12.02.2019, V01). "Design Proposal
 * (Standard Part)" tablosu takoz BAŞINA rijitliği 40/55/70 ShA için veriyor;
 * V01 sunumu parça adını açıkça LMT-1433-00 yazıyor.
 *
 * Bu takozun kütüphanedeki tabanı TEKTİR (sx = dx): kaynak statik/dinamik
 * ayrımı yapmıyor. Uydurma bir cdyn/cstat oranı yazılmadı — testin ilk işi
 * bunun KASITLI olduğunu ve sessizce "düzeltilmediğini" kilitlemek.
 *
 * İkinci ve asıl iş: değerlerin raporun KENDİ modal sonucunu ürettiğini
 * göstermek. Takoz konumları raporlarda yok (yalnız CAD görsellerinde), o yüzden
 * 6 SD modeli kurulamıyor — ama DÜŞEY (bounce) modu konumdan bağımsızdır:
 *     f = (1/2π)·√(Σk_z / m)
 * Konsept 2 yerleşimi (3 konum × 2 adet + Z'de 110 N/mm yay) üç farklı
 * kütle/sertlik kombinasyonunda raporlanmış; üçü de bu bağıntıyla tutuyor.
 * Rijitlik bir hane kayarsa bu üç karşılaştırma birden bozulur.
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

// Raporun "Design Proposal (Standard Part)" satırı — takoz BAŞINA, [X, Y, Z] N/mm
const TABLE = {
  'lmt1433-00-40sh': { sh: 40, name: 'LMT-1433-00 40 ShA', k: [900, 900, 450] },
  'lmt1433-00-55sh': { sh: 55, name: 'LMT-1433-00 55 ShA', k: [1500, 1500, 750] },
  'lmt1433-00-70sh': { sh: 70, name: 'LMT-1433-00 70 ShA', k: [2500, 2500, 1150] },
};

describe('LMT-1433-00 kütüphane girdileri', () => {
  test('üç sertlik de kütüphanede, değerleri raporun tablosuyla birebir', () => {
    Object.entries(TABLE).forEach(([key, v]) => {
      const e = cp.VE_MOUNT_LIBRARY[key];
      expect(e).toBeDefined();
      expect(e.name).toBe(v.name);
      expect([e.sx, e.sy, e.sz]).toEqual(v.k);
    });
  });

  test('TEK taban: sx = dx — kaynak statik/dinamik ayırmıyor, oran UYDURULMADI', () => {
    Object.keys(TABLE).forEach((key) => {
      const e = cp.VE_MOUNT_LIBRARY[key];
      expect([e.dx, e.dy, e.dz]).toEqual([e.sx, e.sy, e.sz]);
    });
  });

  test('radyal izotropik (X = Y), eksenel yaklaşık yarısı', () => {
    Object.keys(TABLE).forEach((key) => {
      const e = cp.VE_MOUNT_LIBRARY[key];
      expect(e.sx).toBe(e.sy);
      expect(e.sz / e.sx).toBeGreaterThan(0.4);
      expect(e.sz / e.sx).toBeLessThan(0.55);
    });
  });

  test('sertlik arttıkça rijitlik artıyor (monoton)', () => {
    const keys = Object.keys(TABLE).sort((a, b) => TABLE[a].sh - TABLE[b].sh);
    for (let i = 1; i < keys.length; i++) {
      const p = cp.VE_MOUNT_LIBRARY[keys[i - 1]], c = cp.VE_MOUNT_LIBRARY[keys[i]];
      expect(c.sx).toBeGreaterThan(p.sx);
      expect(c.sz).toBeGreaterThan(p.sz);
    }
  });

  test('kütüphane listesinde ve Takoz panelinde görünüyor', () => {
    const html = cp.getMntMountPropertiesHTML({ id: 'm1', type: 'mnt-mount', def: {}, data: {} });
    Object.keys(TABLE).forEach((k) => expect(html).toContain('value="' + k + '"'));
  });

  test('kütüphaneden uygulanınca Takoz düğümüne yazılıyor', () => {
    const n = { id: 'm1', type: 'mnt-mount', def: componentDefs['mnt-mount'], data: {} };
    global.nodes = [n];
    cp.veMntApplyLib('m1', 'lmt1433-00-55sh');
    expect([n.data.kxs, n.data.kys, n.data.kzs]).toEqual([1500, 1500, 750]);
    expect([n.data.kxd, n.data.kyd, n.data.kzd]).toEqual([1500, 1500, 750]);
  });
});

describe('Değerler FEA raporunun KENDİ modal sonucunu üretiyor', () => {
  // Konsept 2 yerleşimi: 3 konum (ön · arka sol · arka sağ) × 2 adet LMT-1433-00,
  // ayrıca şanzıman ile motor arasında Z yönünde 110 N/mm yay.
  const N_POS = 3, PER_POS = 2, SPRING_KZ = 110;

  // 40→55→70 tablosu 55–70 arasında doğrusal ara değerlenir (rapor 65 ShA'yı
  // ayrıca vermiyor; V01 sunumu 65 ShA sonucunu veriyor).
  const kzAt = (sh) => {
    const a = TABLE['lmt1433-00-55sh'].k[2], b = TABLE['lmt1433-00-70sh'].k[2];
    return (sh === 55) ? a : a + ((sh - 55) / (70 - 55)) * (b - a);
  };

  // Raporlanan doğal frekanslar (V01 sunumu, "Natural Frequency Results")
  const CASES = [
    { id: 'C2 65 ShA · motor 1602 kg', sh: 65, m: 1602 + 700, tol: 0.5,
      f: [6.320, 8.250, 9.045, 12.44, 13.58, 24.72] },
    { id: 'C2 55 ShA · motor 1602 kg', sh: 55, m: 1602 + 700, tol: 2.5,
      f: [5.06236, 6.75686, 7.28111, 9.64095, 10.5906, 19.2456] },
    { id: 'C2 55 ShA · motor 1266 kg', sh: 55, m: 1266 + 700, tol: 5.0,
      f: [5.4434, 7.11555, 8.08964, 10.1616, 11.4475, 19.6478] },
  ];

  const buildMounts = (sh) => {
    const kz = kzAt(sh);
    const list = [];
    for (let i = 0; i < N_POS * PER_POS; i++) {
      list.push({ name: 'LMT#' + i, pos: [0, 0, 0], kstat: [0, 0, kz * 1000], kdyn: [0, 0, kz * 1000] });
    }
    // Z yayı ayrı bir eleman olarak eklenir (raporun modelinde de öyle)
    list.push({ name: 'Spring', pos: [0, 0, 0], kstat: [0, 0, SPRING_KZ * 1000], kdyn: [0, 0, SPRING_KZ * 1000] });
    return list;
  };

  test.each(CASES.map((C) => [C.id, C]))('%s — bounce modu tutuyor', (_id, C) => {
    const fB = core.bounceFrequency(buildMounts(C.sh), C.m);
    // rapordaki modlardan bounce'a en yakın olanı
    const nearest = C.f.reduce((a, b) => (Math.abs(b - fB) < Math.abs(a - fB) ? b : a));
    const errPct = 100 * Math.abs(fB - nearest) / nearest;
    expect(errPct).toBeLessThanOrEqual(C.tol);
  });

  test('en temiz vaka (65 ShA) %0,5 içinde — tablo modal rijitliktir', () => {
    const C = CASES[0];
    const fB = core.bounceFrequency(buildMounts(C.sh), C.m);
    expect(fB).toBeCloseTo(8.25, 1);                 // ölçülen: 8,266 Hz ↔ 8,250 Hz
  });

  test('rijitlik %10 kaydırılırsa en temiz vaka BOZULUR (test kör değil)', () => {
    const C = CASES[0];
    const bad = buildMounts(C.sh).map((m) => ({ ...m, kdyn: [0, 0, m.kdyn[2] * 1.1] }));
    const fB = core.bounceFrequency(bad, C.m);
    expect(100 * Math.abs(fB - 8.25) / 8.25).toBeGreaterThan(C.tol);
  });
});

describe('Kaynak sınırları kayıt altında', () => {
  test('LMT-1433-20 ve adsız "Mount 1" kütüphaneye GİRMEDİ (verisi yok)', () => {
    const keys = Object.keys(cp.VE_MOUNT_LIBRARY);
    expect(keys.some((k) => /1433-20/.test(k))).toBe(false);
    const names = Object.values(cp.VE_MOUNT_LIBRARY).map((e) => e.name);
    expect(names.some((n) => /^Mount 1$/i.test(n))).toBe(false);
  });

  test('mevcut girdiler DEĞİŞMEDİ (regresyon)', () => {
    const L = cp.VE_MOUNT_LIBRARY;
    expect([L['amc55sha'].sx, L['amc55sha'].sy, L['amc55sha'].sz]).toEqual([1252, 1252, 640]);
    expect([L['amc137963'].sx, L['amc137963'].sy, L['amc137963'].sz]).toEqual([1800, 1210, 1150]);
    expect(L['amc137963-calc'].sx).toBe(2670);
  });

  test('anahtar ve adlar hâlâ tekil', () => {
    const L = cp.VE_MOUNT_LIBRARY;
    const names = Object.values(L).map((e) => e.name);
    expect(new Set(names).size).toBe(names.length);
    expect(new Set(Object.keys(L)).size).toBe(Object.keys(L).length);
  });
});
