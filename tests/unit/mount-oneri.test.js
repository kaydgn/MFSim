/**
 * mount-oneri.test.js — Takoz Özellikleri › ÖNERİ: konfigürasyondan kaba ön seçim
 * ──────────────────────────────────────────────────────────────────────
 * Kullanıcı 2026-11-11, Canlı Not 126: *"Takoz tipleri arasından, kabaca, bizim
 * konfigürasyona göre, tavsiye verebilecek bir hale getirebilir miyiz? Örneğin
 * sistemin kütlesi olabilir, başka şeyler olabilir."*
 *
 * Çözücü değil, ön boyutlandırma: rijit gövde, bütün takozlar aynı tip; takoz başına
 * statik yük kütleden ve konumlardan (eşit rijitlikte düzlemsel dağılım), dikey
 * frekans √(n·k_z,din/M)/2π. Ölçütler Parametrik Analiz'in varsayılan sınırları:
 * E4 kapasite ≤ 1, E1–E2 statik sehim 3–5 mm, E3 ≥ 5 Hz, Kriter 1 ≤ ½·f_ateş.
 */
const fs = require('fs');
const path = require('path');
const core = require('../../js/mount-core.js');
global.veMountCore = core;
const stubs = stubGlobals({ saveState: jest.fn(), showToast: jest.fn(), showNodeProperties: jest.fn() });
eval(fs.readFileSync(path.join(__dirname, '../../js/components.js'), 'utf8'));
global.componentDefs = componentDefs;
const cp = require('../../js/cp-mount.js');

const KOK = path.join(__dirname, '../..');
const yukle = (k) => {
  const j = JSON.parse(fs.readFileSync(path.join(KOK, 'assets/examples', k + '_topoloji.json'), 'utf8'));
  global.nodes = j.nodes.map((n) => Object.assign(n, { def: componentDefs[n.type] }));
  return global.nodes;
};
beforeEach(() => resetStubs(stubs));
afterEach(() => { delete global.nodes; });

describe('YÜK DAĞILIMI — eşit rijitlikte düzlemsel', () => {
  const dort = [{ x: 0, y: -400 }, { x: 0, y: 400 }, { x: 1000, y: -400 }, { x: 1000, y: 400 }];
  test('ağırlık merkezi ortada → eşit pay', () => {
    expect(cp._mntOneriYukler(dort, { x: 500, y: 0 }, 400)).toEqual([100, 100, 100, 100]);
  });
  test('kuvvet ve moment dengesi: ΣF = W, ΣF·x = W·x_G, ΣF·y = W·y_G', () => {
    const G = { x: 300, y: 120 }, W = 800, F = cp._mntOneriYukler(dort, G, W);
    const top = (f) => F.reduce((a, v, i) => a + v * f(dort[i]), 0);
    expect(top(() => 1)).toBeCloseTo(W, 9);
    expect(top((m) => m.x)).toBeCloseTo(W * G.x, 6);
    expect(top((m) => m.y)).toBeCloseTo(W * G.y, 6);
    expect(F[0]).toBeGreaterThan(F[3]);                      // G öne (x = 0) yakın: öndeki takoz arkadakinden yüklü
  });
  test('tek doğru üstündeki takozlar (iki takoz) da dengeli', () => {
    const F = cp._mntOneriYukler([{ x: 0, y: 0 }, { x: 1000, y: 0 }], { x: 250, y: 0 }, 100);
    expect(F.map((v) => Math.round(v))).toEqual([75, 25]);
  });
});

describe('ÖNERİ — örnek modellerde', () => {
  const O = cp.VE_MNT_ONERI;
  test.each(['tulga', 'siper', 'asfat', 'tta10'])('%s: her önerilen tip sınırların içinde, sehim ortaya yakından', (k) => {
    yukle(k);
    const R = cp._mntLibOneri(cp.veMntGetLibraryList().filter((e) => e.builtin));
    expect(R.eksik).toBeUndefined();
    expect(R.satir.length).toBeGreaterThan(0);
    expect(R.satir.length).toBeLessThanOrEqual(O.adet);
    R.satir.forEach((r) => {
      expect(r.u).toBeLessThanOrEqual(1);
      expect(r.d).toBeGreaterThanOrEqual(O.sehimAlt);
      expect(r.d).toBeLessThanOrEqual(O.sehimUst);
      expect(r.f).toBeGreaterThanOrEqual(O.altMod);
      if (Number.isFinite(R.fAtes)) expect(r.f).toBeLessThanOrEqual(0.5 * R.fAtes);
    });
    const uzak = R.satir.map((r) => Math.abs(r.d - O.sehimOrta));
    expect(uzak).toEqual(uzak.slice().sort((a, b) => a - b));
  });
  test('pencerede: Öneri bölümü, satır tipi seçer; seçili tip kalın', () => {
    yukle('tulga');
    const lib = global.nodes.find((n) => n.type === 'mnt-library');
    const d = document.createElement('div');
    d.innerHTML = cp.getMntLibraryPropertiesHTML(lib);
    const kat = d.querySelector('.ve-fp-kat[data-k="oneri"]');
    expect(kat).not.toBeNull();
    const sat = [...kat.querySelectorAll('tr.ve-mnt-oneri-sat')];
    expect(sat.length).toBeGreaterThan(0);
    expect(sat[0].getAttribute('onclick')).toBe("veMntLibSelect('" + lib.id + "','" + sat[0].getAttribute('data-k') + "')");
    expect(kat.querySelector('.ve-fp-sect em').textContent).toMatch(/^\d[\d.]* kg · \d+ takoz/);
  });
  test('kütle ya da takoz yoksa durum ve yönlendirme', () => {
    global.nodes = [{ id: 'l', type: 'mnt-library', def: componentDefs['mnt-library'], data: { mounts: [] } }];
    expect(cp._mntLibOneri([]).eksik).toBe(true);
    const h = cp._mntLibOneriHTML(global.nodes[0], { girdiler: [] }, null);
    expect(h).toContain('Kütle ve takoz konumu yok.');
  });
});
