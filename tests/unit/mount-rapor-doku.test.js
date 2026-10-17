/**
 * mount-rapor-doku.test.js — TAKOZ RAPORUNUN DOKUSU (Tur 6, 2026-10-15)
 * ─────────────────────────────────────────────────────────────────────────
 * İndirilen raporun Node'da düşebilen halkaları; şekillerin yerleşimi
 * (çizginin yazıyı kesmesi, üst üste binen yazı) gerçek tarayıcıda:
 * tests/e2e/mount-rapor.spec.js. Ölçülen eski hâl:
 *   · Şekil 1'de alt simgeler alt çizgiyle ("u_z", "I_G", "k_x, k_y, k_z")
 *     ve rapor metninde 40 dizede daha (δ_x, Σf_z, k_x,s, f_ateş…)
 *   · mod adları İngilizce ("lateral+roll") — Sonuçlar Türkçe
 *   · Şekil 2/3'te ad, komşu işaretin (takoz karesi, gövde dairesi) üstünde
 *   · Şekil 5'te T ekseni sabit 0,01–1.000: eğri 75 Hz'ten sonra alt sınırda
 *     düz çizgi, üst yarı boş; lejant eğrinin üstünde
 *   · Şekil 1'in kaynağı ile gömülü şablon arasında tazelik kapısı yoktu
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const core = require('../../js/mount-core.js');
global.veMountCore = core;
global.veMntBrief = require('../../js/mount-brief.js');
global.showToast = () => {};
const rep = require('../../js/cp-mount-report.js');
const KOK = path.join(__dirname, '../..');

// Bilinen, çözülmüş küçük model — cp-mount-report.test.js'teki ile aynı
function buildR() {
  const mm = 1e-3, kNmm = 1e3;
  const comps = [
    { name: 'Motor',    mass: 300, cgx: -200, cgy: 0, cgz: 400, Ixx: 20, Iyy: 40, Izz: 35, pointMass: false },
    { name: 'Şanzıman', mass: 150, cgx: 400,  cgy: 0, cgz: 300, Ixx: 8,  Iyy: 20, Izz: 18, pointMass: false },
    { name: 'Şaft payı',mass: 40,  cgx: 900,  cgy: 0, cgz: 150, pointMass: true },
  ];
  const mnts = [
    { name: 'Sağ Ön',   x: -150, y: 250,  z: 100, kxs: 800, kys: 800, kzs: 500, kxd: 1200, kyd: 1200, kzd: 800 },
    { name: 'Sol Ön',   x: -150, y: -250, z: 100, kxs: 800, kys: 800, kzs: 500, kxd: 1200, kyd: 1200, kzd: 800 },
    { name: 'Sağ Arka', x: 500,  y: 250,  z: 120, kxs: 800, kys: 800, kzs: 500, kxd: 1200, kyd: 1200, kzd: 800 },
    { name: 'Sol Arka', x: 500,  y: -250, z: 120, kxs: 800, kys: 800, kzs: 500, kxd: 1200, kyd: 1200, kzd: 800 },
  ];
  const torque = { Te: 400, Rstall: 1.8, g1: 3.5, gR: -3.2, iTransfer: 1.0, phiFwd: 1, phiRev: 1, derate: 1 };
  const compsSI = comps.map(c => ({ name: c.name, mass: c.mass, cg: [c.cgx * mm, c.cgy * mm, c.cgz * mm],
    I: [[c.Ixx || 0, 0, 0], [0, c.Iyy || 0, 0], [0, 0, c.Izz || 0]], pointMass: !!c.pointMass }));
  const mntsSI = mnts.map(m => ({ name: m.name, pos: [m.x * mm, m.y * mm, m.z * mm],
    kstat: [m.kxs * kNmm, m.kys * kNmm, m.kzs * kNmm], kdyn: [m.kxd * kNmm, m.kyd * kNmm, m.kzd * kNmm] }));
  const mp = core.combineMassProps(compsSI);
  const model = { m: mp.m, cg: mp.cg, Kstat: core.buildK(mntsSI, mp.cg, false), mounts: mntsSI, g: 9.81 };
  const AUTO = [
    { name: 'Static', n: [0, 0, -1], T: [0, 0, 0] }, { name: 'Max Bump', n: [0, 0, -3.5], T: [0, 0, 0] },
    { name: 'Braking', n: [-1, 0, -1], T: [0, 0, 0] }, { name: 'Cornering', n: [0, 0.6, -1], T: [0, 0, 0] },
    { name: 'Brake in Turn', n: [-0.4, 0.4, -1], T: [0, 0, 0] }, { name: 'Pothole Braking', n: [-3, 0, -3.5], T: [0, 0, 0] },
    { name: 'Rim Lateral Kerb Strike', n: [0, 1, -1], T: [0, 0, 0] },
  ];
  const Tfwd = core.torqueChain({ Te: torque.Te, Rstall: torque.Rstall, iGear: torque.g1, iTransfer: torque.iTransfer, phiAxle: torque.phiFwd, derate: torque.derate });
  const Trev = core.torqueChain({ Te: torque.Te, Rstall: torque.Rstall, iGear: torque.gR, iTransfer: torque.iTransfer, phiAxle: torque.phiRev, derate: torque.derate });
  const cases = AUTO.concat([{ name: 'Forward Torque', n: [0, 0, -1], T: [-Tfwd, 0, 0] },
    { name: 'Reverse Torque', n: [0, 0, -1], T: [-Trev, 0, 0] }]);
  // Kriter 3/4 verisi (üretimdeki _mntComputeResults ile aynı): vites + tasarım durumları
  const gearDefs = [
    { name: '1. Vites', gearLabel: '1. Vites', ratio: torque.g1, Tshaft: Tfwd, n: [0, 0, -1], T: [-Tfwd, 0, 0] },
    { name: 'Geri Vites', gearLabel: 'Geri', ratio: torque.gR, Tshaft: Trev, n: [0, 0, -1], T: [-Trev, 0, 0] }
  ];
  const designDefs = [
    { name: '3.5g Düşey', n: [0, 0, -3.5], T: [0, 0, 0] },
    { name: '1g Yanal', n: [0, 1, -1], T: [0, 0, 0] },
    { name: '1g Boyuna (fren)', n: [-1, 0, -1], T: [0, 0, 0] }
  ];
  return {
    mp, mounts: mntsSI,
    allCases: core.solveAllCases(model, cases),
    gearCases: core.solveAllCases(model, gearDefs, { useStop: true }),
    designCases: core.solveAllCases(model, designDefs, { useStop: true }),
    modes: core.solveModal(core.buildK(mntsSI, mp.cg, true), core.buildM6(mp.m, mp.I_G), mntsSI, mp.cg),
    gather: { components: comps, mounts: mnts, torque }, matrixMode: 'delta',
  };
}

// TeX DIŞINDAKİ metin: display ($$…$$) ve satır içi (\(…\)) matematik atılır
const texsiz = (t) => t.replace(/\$\$[\s\S]*?\$\$/g, ' ').replace(/\\\([\s\S]*?\\\)/g, ' ');
const ALT_CIZGI = /(^|[^A-Za-z0-9_])([A-Za-zΣΔθδφμζ])_([A-Za-z0-9çğıöşü]+)/;
function metinler(html) {
  const d = document.createElement('div');
  // kod listesi (<pre>) kapsam dışı: orada alt çizgi değişken adının parçası
  d.innerHTML = html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '').replace(/<pre[\s\S]*?<\/pre>/g, '');
  const out = [];
  const w = document.createTreeWalker(d, NodeFilter.SHOW_TEXT);
  let n; while ((n = w.nextNode())) out.push(n.nodeValue);
  return out;
}

describe('ŞABLON — gömülü şablon kaynağıyla taze', () => {
  test('tools/report-assets/theory-source.html → js/mount-report-template.js (üreteç belirlenimci)', () => {
    const gecici = path.join(os.tmpdir(), 'mnt-sablon-' + process.pid + '.js');
    try {
      execFileSync(process.execPath, [path.join(KOK, 'tools/report-assets/build-report-template.js'),
        path.join(KOK, 'tools/report-assets/theory-source.html'), gecici], { stdio: 'pipe' });
      const uretilen = fs.readFileSync(gecici, 'utf8');
      const depodaki = fs.readFileSync(path.join(KOK, 'js/mount-report-template.js'), 'utf8');
      // BAYATSA: node tools/report-assets/build-report-template.js
      expect(uretilen === depodaki).toBe(true);
    } finally { try { fs.unlinkSync(gecici); } catch (e) { /* yok */ } }
  });
});

describe('ALT SİMGE — alt çizgiyle değil, gerçek alt simgeyle', () => {
  test('Şekil 1 (şablonun kavramsal modeli): SVG yazısında "_" yok, alt simge tspan', () => {
    const src = fs.readFileSync(path.join(KOK, 'tools/report-assets/theory-source.html'), 'utf8');
    const svg = src.slice(src.indexOf('<svg viewBox="0 0 880 300"'), src.indexOf('</svg>', src.indexOf('<svg viewBox="0 0 880 300"')));
    const d = document.createElement('div'); d.innerHTML = svg + '</svg>';
    const yazi = [...d.querySelectorAll('text')].map((t) => t.textContent);
    expect(yazi.length).toBeGreaterThan(10);
    expect(yazi.filter((t) => /_/.test(t))).toEqual([]);
    expect(d.querySelectorAll('tspan[baseline-shift="sub"]').length).toBeGreaterThan(10);
  });

  test('raporun bütün metni (TeX dışı): alt çizgili simge yok', () => {
    require('../../js/mount-report-template.js');
    window.MNT_REPORT_ASSETS = { katexCss: '', katexJs: '' };
    const eski = global.veThemeFontFaceCss;
    global.veThemeFontFaceCss = () => '';
    let html;
    const R = buildR(); global._veMntLast = R;
    try { html = rep._mntBuildReportHTML(R); } finally { global.veThemeFontFaceCss = eski; }
    const kalan = metinler(html).map(texsiz).filter((t) => ALT_CIZGI.test(t)).map((t) => t.match(ALT_CIZGI)[0].trim());
    expect(kalan).toEqual([]);
    expect(html).toMatch(/δ<sub>z<\/sub>/);
  });
});

describe('SVG İÇİNDE HTML YOK — ayrıştırıcı SVG\'den çıkmasın', () => {
  // SVG yazısına giren bir HTML öğesi (<span>, <sub>) HTML ayrıştırıcısını
  // SVG'den çıkarır; çizimin geri kalanı HTML sayılır ve kaybolur. Bir kez
  // ölçüldü: bölünmez bileşik adımı "Üstten (X–Y)"yi <span> ile sardı, mod
  // şekillerinin kutuları ve takozları silindi — yazı ölçeri bunu görmez.
  test('raporun hiçbir SVG\'sinde HTML öğesi yok', () => {
    require('../../js/mount-report-template.js');
    window.MNT_REPORT_ASSETS = { katexCss: '', katexJs: '' };
    const eski = global.veThemeFontFaceCss;
    global.veThemeFontFaceCss = () => '';
    const R = buildR(); global._veMntLast = R;
    let html;
    try { html = rep._mntBuildReportHTML(R); } finally { global.veThemeFontFaceCss = eski; }
    const svgler = html.match(/<svg[\s\S]*?<\/svg>/g) || [];
    expect(svgler.length).toBeGreaterThan(10);
    const html_ = svgler.filter((s) => /<(span|sub|sup|div|p|b|i|em|strong|br)[\s>/]/.test(s)).map((s) => s.slice(0, 120));
    expect(html_).toEqual([]);
  });
});

describe('MOD ADI — Türkçe, Sonuçlar\'la aynı sözlükten', () => {
  test('mod şekli başlıkları ve modal tablo modeTR ile', () => {
    require('../../js/mount-report-template.js');
    window.MNT_REPORT_ASSETS = { katexCss: '', katexJs: '' };
    const eski = global.veThemeFontFaceCss;
    global.veThemeFontFaceCss = () => '';
    const R = buildR(); global._veMntLast = R;
    let html;
    try { html = rep._mntBuildReportHTML(R); } finally { global.veThemeFontFaceCss = eski; }
    expect(R.modes.length).toBe(6);
    // kısa parçalı bileşik ("baş-kıç") satır sonunda bölünmesin diye sarılı — metin aynı
    const duz = html.replace(/<span style="white-space:nowrap">([^<]*)<\/span>/g, '$1');
    R.modes.forEach((m) => {
      expect(m.label).toMatch(/^[a-z+-]+$/);                       // çekirdeğin İngilizce kısaltması
      expect(duz).not.toContain('Hz · ' + m.label + '.');           // eski başlık
      expect(duz).toContain('Hz · ' + global.veMntBrief.modeTR(m.label) + '.');
    });
  });
});

describe('BÖLÜNMEZ BİLEŞİK — kısa parçalı tireli sözcük satır sonunda bölünmez', () => {
  // Ortak kural: tirede bölünme ancak iki yan da ≥ 4 harfse kabul. Raporda
  // "Üç-|eksen", "kütle-|yay", "baş-|kıç", "(fore-|aft)" satır sonunda bölünüyordu.
  test('metinde sarılır; TeX, etiket ve uzun parçalı bileşik olduğu gibi', () => {
    const h = rep._rBolunmez('<p class="a-b">üç-eksen · Motor-Şanzıman · roll–yaw · N/60 $$ a-b $$ \\( fore-aft \\) baş-kıç</p>');
    expect(h).toContain('<span style="white-space:nowrap">üç-eksen</span>');
    expect(h).toContain('<span style="white-space:nowrap">roll–yaw</span>');
    expect(h).toContain('<span style="white-space:nowrap">N/60</span>');
    expect(h).toContain('<span style="white-space:nowrap">baş-kıç</span>');
    expect(h).toContain(' Motor-Şanzıman ');                 // iki yanı ≥ 4 harf: kabul
    expect(h).toContain('<p class="a-b">');                   // öznitelik
    expect(h).toContain('$$ a-b $$');                         // display TeX
    expect(h).toContain('\\( fore-aft \\)');                  // satır içi TeX
  });

  test('alt simgeli zincir de sarılır: "δx/δy/δz", "f ateş/f roll" — etiketler metni parçalıyordu', () => {
    // CI'da (Chrome 145) "Üç eksen (δx/δy/δz)" satır sonunda "/|δ"de bölünüyordu;
    // kırılımın yeri yazı tipine bağlı, yerelde düşmüyordu. Genişlik taraması
    // (200–900 px): sarılmadan 69 genişlikte bölünüyor, sarılınca 0.
    const h = rep._rBolunmez('<p>Üç eksen (δ<sub>x</sub>/δ<sub>y</sub>/δ<sub>z</sub>): §8.6. '
      + 'Oran (f<sub>ateş</sub>/f<sub>roll</sub>) · tek δ<sub>z</sub></p>');
    expect(h).toContain('(<span style="white-space:nowrap">δ<sub>x</sub>/δ<sub>y</sub>/δ<sub>z</sub></span>)');
    expect(h).toContain('(<span style="white-space:nowrap">f<sub>ateş</sub>/f<sub>roll</sub></span>)');
    expect(h).toContain('tek δ<sub>z</sub></p>');              // tek simge sarılmaz
  });
});

describe('ŞEKİL 2/3 — ad komşu işaretin üstüne yerleşmez', () => {
  test('ilk yer bir işaretin üstündeyse ad kayar (aynı yanda ya da öteki yanda)', () => {
    const kare = { x0: 92, y0: 66, x1: 108, y1: 82 };              // adın ilk yerinde bir takoz karesi
    const L = [{ cx: 100, ay: 100, text: 'Braket', dir: -1, fs: 10, marker: 'ci' }];
    rep._repPlaceLabels(L, 330, [kare]);
    const b = { x0: L[0].cx - L[0].w / 2, x1: L[0].cx + L[0].w / 2, y0: L[0].y - L[0].h * 0.8, y1: L[0].y + L[0].h * 0.25 };
    const carpar = b.x0 < kare.x1 && b.x1 > kare.x0 && b.y0 < kare.y1 && b.y1 > kare.y0;
    expect(carpar).toBe(false);
    // öteki yan boşken ad kendi işaretinin hemen yanında kalır (satır satır uzaklaşmaz)
    expect(Math.abs(L[0].y - L[0].ay)).toBeLessThan(25);
  });
});

describe('ŞEKİL 5 — iletilebilirlik ekseni veriden, lejant boş köşede', () => {
  // Tek serbestlikli iletilebilirlik: fn = 7 Hz; sönümlü ζ = 0,05 ve sönümsüz
  const f = [], T = [], T0 = [];
  for (let i = 0; i < 260; i++) {
    const fi = Math.pow(10, -1 + 3 * i / 259), r = fi / 7;
    const t = (z) => Math.sqrt((1 + (2 * z * r) ** 2) / ((1 - r * r) ** 2 + (2 * z * r) ** 2));
    f.push(fi); T.push(t(0.05)); T0.push(t(0));
  }
  const svg = rep._mntRepFRFChart({ f, T, T0 }, 32.5);
  const d = document.createElement('div'); d.innerHTML = svg;
  const yol = (el) => (el.getAttribute('d').match(/[ML]\s*[\d.]+\s+[\d.]+/g) || []).map((p) => p.slice(1).trim().split(/\s+/).map(Number));
  const sonumlu = [...d.querySelectorAll('path')].find((p) => p.getAttribute('stroke-width') === '2.1');
  const alan = { ust: 16, alt: 400 - 44 };

  test('sönümlü eğrinin hiçbir noktası çizim alanının kenarına KIRPILMIYOR', () => {
    const p = yol(sonumlu);
    expect(Math.min(...T)).toBeLessThan(0.01);                       // eski sabit eksenin altında
    expect(p.filter(([, y]) => Math.abs(y - alan.alt) < 0.05 || Math.abs(y - alan.ust) < 0.05)).toEqual([]);
  });

  test('eğriler çizim alanına kırpılıyor (düzleştirilmiyor)', () => {
    expect(d.querySelector('clipPath rect')).not.toBeNull();
    expect(sonumlu.parentElement.getAttribute('clip-path')).toMatch(/^url\(#/);
  });

  test('lejantın içinden eğri geçmiyor', () => {
    const g = [...d.querySelectorAll('g[transform^="translate"]')].find((e) => /sönümlü/.test(e.textContent));
    const [tx, ty] = g.getAttribute('transform').match(/[\d.]+/g).map(Number);
    const r = { x0: tx - 8, y0: ty - 13, x1: tx - 8 + 196, y1: ty - 13 + 42 };
    const ic = [...d.querySelectorAll('path')].flatMap(yol).filter(([x, y]) => x > r.x0 && x < r.x1 && y > r.y0 && y < r.y1);
    expect(ic).toEqual([]);
  });
});

describe('MOD ŞEKLİ — "G" gövde kenarının üstünde okunur', () => {
  test('G etiketi zemin hâlesi taşıyor', () => {
    const geom = { comps: [{ name: 'Motor', x: 0, y: 0, z: 400, mass: 300, Ixx: 20, Iyy: 40, Izz: 35 }], mounts: [{ name: 'Ön', x: -200, y: 0, z: 100 }] };
    const s = rep._mntRepModeFigure(geom, { x: 0, y: 0, z: 400 }, [0, 0, 1, 0, 0, 0], 'xz', 'm0b', 50, ['Motor']);
    expect(s).toMatch(/<text[^>]*paint-order="stroke"[^>]*>G<\/text>/);
  });
});
