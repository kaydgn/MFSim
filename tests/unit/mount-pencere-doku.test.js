/**
 * mount-pencere-doku.test.js — TAKOZ PENCERELERİNİN DOKUSU (Tur 6, 2026-10-15)
 * ─────────────────────────────────────────────────────────────────────────
 * Node'da düşebilen halkalar; yerleşim, CSS ve WebGL tarayıcıda:
 * tests/e2e/mount-pencere.spec.js. Ölçülen eski hâl:
 *   · kütüphanenin kuvvet ekseni "10k · 0 · −10k", başlığı "kuvvet f [N]"
 *   · 2D tam ekranda koordinat üçlüsü "(582,5 · 21,5 · 422,8) mm" (kural 7·C: "; ")
 *   · Örnek şemasında 17 ad, sütunda 4,8 px'e iniyordu
 *   · kütüphane notunda düz tırnak ("Fabrika")
 */
const fs = require('fs');
const path = require('path');

const stubs = stubGlobals();
global.nodes = [];
global.connections = [];
eval(loadSource('components.js'));
global.componentDefs = componentDefs;
const core = require('../../js/mount-core.js');
global.veMountCore = core;
const cp = require('../../js/cp-mount.js');
beforeEach(() => resetStubs(stubs));

const div = (html) => { const d = document.createElement('div'); d.innerHTML = html; return d; };
const KOK = path.join(__dirname, '../..');

describe('kütüphane: kuvvet ekseninin birimi başlıkta, değerde sonek yok', () => {
  test('bin newtonu aşan eksen kN yazar; küçüğü N', () => {
    const buyuk = div(cp._mntLibForceChart({ sz: 640, dz: 977 }, 'z')).textContent;
    expect(buyuk).toContain('kuvvet f [kN]');
    expect(buyuk).not.toMatch(/\d+k\b/);
    const kucuk = div(cp._mntLibForceChart({ sz: 20, dz: 30 }, 'z')).textContent;
    expect(kucuk).toContain('kuvvet f [N]');
    expect(kucuk).not.toMatch(/\d+k\b/);
  });
});

describe('2D tam ekran: koordinat ayracı "; ", gerçek eksi', () => {
  test('künye şeridi ve G etiketleri', () => {
    const veri = {
      comps: [{ name: 'Motor', x: 100, y: -50, z: 500, mass: 400 }, { name: 'Şanzıman', x: 800, y: 40, z: 360, mass: 160 }],
      mounts: [{ name: 'Sağ', x: 400, y: 350, z: 480 }, { name: 'Sol', x: 400, y: -350, z: 480 }, { name: 'Arka', x: 1300, y: 0, z: 40 }],
      cg: { x: 316.7, y: -24.3, z: 461.4, m: 560 },
    };
    const t = div(cp._mnt2DViewSVG(veri, 1200)).textContent;
    expect(t).toContain('(316,7; −24,3; 461,4) mm');
    expect(t).toContain('G (316,7; −24,3)');
    expect(t).not.toMatch(/\d · [−-]?\d/);
  });
});

describe('Örnek şeması: ad görünür yazı değil, <title>', () => {
  test.each(['tulga', 'siper', 'asfat'])('%s', (k) => {
    const ex = cp._mntExampleReg(k);
    const d = div(cp._mntExampleDiagramSVG(ex.model, ex.tools));
    expect(d.querySelectorAll('text').length).toBe(0);
    expect(d.querySelectorAll('g > title').length).toBeGreaterThan(5);
  });
  test('CSS: yalnız şemanın kendisi kabın eninde (iç ikon svg\'leri değil)', () => {
    const css = fs.readFileSync(path.join(KOK, 'css/styles.css'), 'utf8');
    expect(css).not.toMatch(/\.ve-mnt-ex-sema svg\s*[{,]/);
    expect(css).toMatch(/\.ve-mnt-ex-sema > svg/);
  });
});

describe('Takoz arayüz dosyalarında düz çift tırnakla sözcük yok', () => {
  // Öznitelik değeri (`="…"`) değil, METİN içinde tırnaklanmış sözcük.
  const DOSYA = ['js/cp-mount.js', 'js/cp-mount-wizard.js', 'js/cp-mount-baslangic.js', 'js/cp-mount-viewer.js', 'js/cp-mount-3b.js'];
  test('tipografik tırnak (“…”)', () => {
    const bul = [];
    DOSYA.forEach((f) => fs.readFileSync(path.join(KOK, f), 'utf8').split('\n').forEach((l, i) => {
      if (/^\s*(\/\/|\*)/.test(l)) return;
      if (/'[^'\n]*[\s(]"[^"<>=\n]{2,40}"[\s).,;:][^'\n]*'/.test(l)) bul.push(f + ':' + (i + 1));
    }));
    expect(bul).toEqual([]);
  });
});
