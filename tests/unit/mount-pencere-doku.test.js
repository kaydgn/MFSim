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

// Kullanıcı kararı S3·B (2026-10-15). Eski hâl: pencere önce bir PNG ekran
// görüntüsünü deniyordu (koyu temada ~5 px yazı, tek dosyada hiç yüklenmiyor),
// şema yalnız onerror yedeğiydi.
describe('Örnek penceresi her zaman şema (S3·B)', () => {
  test.each(['tulga', 'siper', 'asfat'])('%s: kayıtta görsel yok, pencerede <img> yok, klasörde PNG yok', (k) => {
    const ex = cp._mntExampleReg(k);
    expect(ex.image).toBeUndefined();
    const d = div(cp.getMntExamplePropertiesHTML({ id: 'e', type: 'mnt-example', data: { exampleKey: k } }));
    expect(d.querySelectorAll('img').length).toBe(0);
    expect(d.querySelectorAll('.ve-mnt-ex-sema > svg').length).toBe(1);
    expect(fs.existsSync(path.join(KOK, 'assets/examples', k + '.png'))).toBe(false);
  });
});

describe('Takoz arayüz dosyalarında düz çift tırnakla sözcük yok', () => {
  // Öznitelik değeri (`="…"`) değil, METİN içinde tırnaklanmış sözcük.
  const DOSYA = ['js/cp-mount.js', 'js/cp-mount-wizard.js', 'js/cp-mount-baslangic.js', 'js/cp-mount-viewer.js', 'js/cp-mount-3b.js', 'js/cp-mount-report.js'];
  test('tipografik tırnak (“…”)', () => {
    const bul = [];
    DOSYA.forEach((f) => fs.readFileSync(path.join(KOK, f), 'utf8').split('\n').forEach((l, i) => {
      if (/^\s*(\/\/|\*)/.test(l)) return;
      if (/'[^'\n]*[\s(]"[^"<>=\n]{2,40}"[\s).,;:][^'\n]*'/.test(l)) bul.push(f + ':' + (i + 1));
    }));
    expect(bul).toEqual([]);
  });
});

// Kullanıcı kararları S1·C ve S2·C (2026-10-15). Eski hâl: ağırlık merkezi üç
// adla geçiyordu — pencereler ve 2D sütunu "AM" (46 yer), sihirbaz, 2D tam
// ekran ve kılavuz "CG", sihirbaz masasının lejantı "ağırlık merkezi"; takozun
// yer değiştirmesi (δ) pencerelerde ve raporda "çökme" (93 yer), kütüphane
// grafiğinde ve raporun kuram bölümünde "sehim", Sonuçlar grubunda
// "deformasyon" (9 yer). Modülün özel adı (Takoz Çökme-Titreşim) kalır.
describe('Takoz terimleri tek: CG ve sehim (S1·C · S2·C)', () => {
  const KAYNAK = fs.readdirSync(path.join(KOK, 'js'))
    .filter((f) => /^(cp-mount|mount-).*\.js$|^guide-mount\.js$/.test(f))
    .map((f) => 'js/' + f).concat(['tools/report-assets/theory-source.html']);
  const tara = (re) => {
    const bul = [];
    KAYNAK.forEach((f) => fs.readFileSync(path.join(KOK, f), 'utf8').split('\n').forEach((l, i) => {
      const temiz = l.replace(/Çökme[-–]Titreşim|çökme[-–]titreşim/g, '');
      if (re.test(temiz)) bul.push(f + ':' + (i + 1));
    }));
    return bul;
  };
  const H = 'A-Za-zÇĞİÖŞÜçğıöşü';
  test('kısaltma "AM" yok — ağırlık merkezi CG', () => {
    expect(KAYNAK.length).toBeGreaterThan(10);
    expect(tara(new RegExp('(^|[^' + H + '])AM([^' + H + ']|$)'))).toEqual([]);
  });
  test('δ "çökme" ya da "deformasyon" değil — sehim (modülün özel adı hariç)', () => {
    expect(tara(new RegExp('(^|[^' + H + '])[Çç]ökme', 'u'))).toEqual([]);
    expect(tara(/deformasyon/i)).toEqual([]);
  });
  test('kısa etiketler CG: sihirbaz masasının lejantı, STEP tablosu, 2D ipucu', () => {
    const w = fs.readFileSync(path.join(KOK, 'js/cp-mount-wizard.js'), 'utf8');
    expect(w).toContain('</i>Gövde CG</span>');
    expect(w).toContain('</i>Birleşik CG</span>');
    expect(fs.readFileSync(path.join(KOK, 'js/cp-mount-3b.js'), 'utf8')).toContain('<th>CG<em>mm</em></th>');
    const veri = {
      comps: [{ name: 'Motor', x: 100, y: -50, z: 500, mass: 400 }],
      mounts: [{ name: 'Sağ', x: 400, y: 350, z: 480 }, { name: 'Sol', x: 400, y: -350, z: 480 }],
      cg: { x: 100, y: -50, z: 500, m: 400 },
    };
    const t = cp._mnt2DViewSVG(veri, 1200);
    expect(t).toContain('Birleşik CG');
    expect(t).not.toMatch(/Ağırlık merkezi\s+\(/);
  });
});

