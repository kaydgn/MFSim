/**
 * mount-pencere-doku.test.js — TAKOZ PENCERELERİNİN DOKUSU (Tur 6, 2026-10-15)
 * ─────────────────────────────────────────────────────────────────────────
 * Node'da düşebilen halkalar; yerleşim, CSS ve WebGL tarayıcıda:
 * tests/e2e/mount-pencere.spec.js. Ölçülen eski hâl:
 *   · kütüphanenin kuvvet ekseni "10k · 0 · −10k", başlığı "kuvvet f [N]"
 *   · 2D tam ekranda koordinat üçlüsü "(582,5 · 21,5 · 422,8) mm" (kural 7·C: "; ";
 *     düz görünüşler 2026-10-16'da kalktı — kural Görünümler'in işaret bilgisinde)
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

// 2026-10-16: düz görünüşler kalktı; koordinat üçlüsü artık Görünümler'in
// işaret bilgisinde (fare üstü) ve İşaretler föyünde.
const IKI_GOVDE = () => [
  { id: 'a', type: 'mnt-motor', def: componentDefs['mnt-motor'], customName: 'Motor', data: { mass: 400, cgx: 100, cgy: -50, cgz: 500 } },
  { id: 'b', type: 'mnt-gearbox', def: componentDefs['mnt-gearbox'], customName: 'Şanzıman', data: { mass: 160, cgx: 800, cgy: 40, cgz: 360 } },
  { id: 't', type: 'mnt-mount', def: componentDefs['mnt-mount'], customName: 'Sol', data: { x: 400, y: -350, z: 480 } },
];
describe('Görünümler: koordinat ayracı "; ", gerçek eksi', () => {
  test('işaretlerin bilgisi (G, gövde CG\'si, takoz konumu)', () => {
    global.nodes = IKI_GOVDE();
    try {
      const m = cp._mntAksoModel();
      expect(m.G.bilgi[1]).toBe('(300,0; −24,3; 460,0) mm');          // (400·100 + 160·800) / 560 …
      expect(m.govde[0].bilgi[2]).toBe('CG (100; −50; 500) mm');
      expect(m.takoz[0].bilgi[1]).toBe('Konum (400; −350; 480) mm');
      const t = m.govde.concat(m.takoz).concat([m.G]).map((x) => x.bilgi.join('\n')).join('\n');
      expect(t).not.toMatch(/\d · [−-]?\d/);
      expect(t).not.toMatch(/-\d/);                                       // gerçek eksi
    } finally { global.nodes = []; }
  });
});

describe('Örnek şeması: ad görünür yazı değil, <title>', () => {
  test.each(['tulga', 'siper', 'asfat'])('%s', (k) => {
    const ex = cp._mntExampleReg(k);
    const d = div(cp._mntExampleDiagramSVG(ex.model, ex.tools));
    expect(d.querySelectorAll('text').length).toBe(0);
    expect(d.querySelectorAll('g > title').length).toBeGreaterThan(5);
  });
  // Araç adı elle YAZILMAZ: "2D Görünüm" → "Görünümler" yeniden adlandırmasında
  // kayıttaki kopyalardan üçü eski adda kaldı ve hiçbir kapı görmedi; "Örnek"
  // de kanvasa kurulan düğümün adı değildi. Şema adı componentDefs'ten okur.
  test('araçların adı bileşenin kendi adı (componentDefs) — kayıtta ad kopyası yok', () => {
    const liste = require('../../js/mount-core.js').getMountExampleList();
    expect(liste.length).toBeGreaterThanOrEqual(6);
    liste.forEach((ex) => {
      expect(ex.tools.length).toBeGreaterThan(0);
      ex.tools.forEach((t) => expect(`${ex.id} ${t.type}: ${t.name}`).toBe(`${ex.id} ${t.type}: undefined`));
      const adlar = [...div(cp._mntExampleDiagramSVG(ex.model, ex.tools)).querySelectorAll('g > title')].map((x) => x.textContent);
      ex.tools.forEach((t) => expect(adlar).toContain(componentDefs[t.type].name));
    });
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
  test('kısa etiketler CG: sihirbaz masasının lejantı, STEP tablosu, Görünümler\'in işareti ve göstergesi', () => {
    const w = fs.readFileSync(path.join(KOK, 'js/cp-mount-wizard.js'), 'utf8');
    expect(w).toContain('</i>Gövde CG</span>');
    expect(w).toContain('</i>Birleşik CG</span>');
    expect(fs.readFileSync(path.join(KOK, 'js/cp-mount-3b.js'), 'utf8')).toContain('<th>CG<em>mm</em></th>');
    global.nodes = IKI_GOVDE();
    global.veMntAkso = require('../../js/mount-akso.js');
    try {
      expect(cp._mntAksoModel().G.bilgi[0]).toBe('Birleşik CG');
      const t = cp._mntAksoHTML(cp._mnt2DPencereVeri(), 354, false, 've-mnt-akso3b-x');
      expect(t).toContain('G · birleşik CG');
      expect(t).toContain('data-mnt-info="Birleşik CG');
      expect(t).not.toMatch(/Ağırlık merkezi\s+\(/);
    } finally { global.nodes = []; delete global.veMntAkso; }
  });
});

