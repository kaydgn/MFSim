/**
 * fead-boy-cizgisi.test.js — KAYIŞ BOYU İKİ ÇİZGİDE, NUMARA d_b'DE
 *
 * Kullanıcı kararı (2026-09-28): kayış numarası (8PK1410'daki 1410) d_b
 * çizgisinde — kanallı kasnağın dış çapında — okunur ve raporlanır; CAD
 * eskizinin ölçtüğü d_w = d_b + 2·h_b boyu yanında yazılır. Gerekçe:
 * ContiTech tablosu boyu "Effective length L_b" diye verir (alt simge b),
 * ISO 9981 ve 17 Gates raporu da aynı çizgide; d_w'yi numara saymak kolu
 * sessizce başka bir açıya oturtur (kullanıcının düzeninde 12°, 126 N).
 *
 * Kapılar:
 *   · d_w DÖNÜŞÜMÜ ÇEKİRDEĞİN GEOMETRİSİYLE AYNI — her örnekte, iki markada:
 *     veFeadBoyCizgileri(L_eff).dw = L_pitch (formül ile çekirdek ayrışamaz)
 *   · NUMARA d_b'DE OKUNUR — sabit kipte girilen boy kolu L_eff = boy
 *     konumuna oturtur; d_w okunsaydı yol 2π·h_b kısa olurdu
 *   · h_b MARKANIN — BELT_DB'nin her kaydı; tanınmayan kayda sayı uydurulmaz
 *   · KESİT FİGÜRÜ ÖLÇEKLİ — d_b çizgisi kasnağın dış çapında, kord/sırt/diş
 *     tepesi profilin sabitleriyle orantılı (BELT_DB'nin her kaydı)
 *   · KART VE SAĞ SÜTUN AYNI OKUMADAN — sabit kipte girilen numara, kilitli
 *     kipte türetilen; kilit "Boy kaynağı"nda da sayılır; etikette sembol yok
 */
const M = require('../../js/fead-model.js');
const F = require('../../js/fead-core.js');
const fead = require('../../js/cp-fead.js');

const stubs = stubGlobals();
document.body.innerHTML = '<div id="ve-canvas"></div>';
global.nodes = [];
global.connections = [];
eval(loadSource('components.js'));
global.veIsCanvasHidden = veIsCanvasHidden;
global.componentDefs = componentDefs;
global.FEADCore = F;
Object.keys(M).forEach((k) => { global[k] = M[k]; });

beforeEach(() => { resetStubs(stubs); global.nodes = []; global.connections = []; });

function kur(key, mut) {
  const pack = veFeadExampleNodes(key);
  pack.nodes.forEach((n) => { n.def = componentDefs[n.type]; });
  if (mut) mut(pack.nodes);
  return veFeadBuildSystem(pack.nodes);
}
const kayis = (nodes) => nodes.find((n) => n.type === 'fead-belt').data;
const geomOf = (b) => F.tensionerState(b.sys, F.meanRel(b.sys)).geom;

describe('d_w DÖNÜŞÜMÜ çekirdeğin geometrisiyle AYNI', () => {
  test('her örnekte ve iki markada: veFeadBoyCizgileri(L_eff).dw = L_pitch', () => {
    let n = 0;
    for (const key of Object.keys(VE_FEAD_EXAMPLES)) {
      for (const marka of ['GATES', 'CONTITECH']) {
        const b = kur(key, (nodes) => { kayis(nodes).brand = marka; });
        if (!b.ok) continue;
        const g = geomOf(b);
        const x = veFeadBoyCizgileri(g.LeffMm, b.sys.belt.profile, b.sys.belt.brand);
        expect([key, marka, Math.abs(x.db - g.LeffMm)]).toEqual([key, marka, 0]);
        expect([key, marka, Math.abs(x.dw - g.LpitchMm) < 1e-9]).toEqual([key, marka, true]);
        n++;
      }
    }
    // Döngü boşa çalışmıyor: on iki örneğin iki markası
    expect(n).toBeGreaterThanOrEqual(20);
  });
});

describe("NUMARA d_b'DE — gereken boy d_b çizgisinde raporlanır", () => {
  // Gergi olan her topolojide kayış kipi KİLİTLİ (veFeadBeltModeLocked): kol
  // nominal yay yüküne oturur ve kayış boyu o konumun ÇIKTISIDIR. Kararın
  // yüzeyi bu çıktı: çözüme yazılan boy (sys.belt.effLength) d_b çizgisindeki
  // yol — d_w değil. Numara ne olursa olsun tüketicileri (konum tablosu,
  // ömür, rapor, sonuç kartı) bu alanı okuyor.
  test('her örnekte ve iki markada: çözüme yazılan boy L_eff, L_pitch değil', () => {
    let n = 0;
    for (const key of Object.keys(VE_FEAD_EXAMPLES)) {
      for (const marka of ['GATES', 'CONTITECH']) {
        const b = kur(key, (nodes) => { kayis(nodes).brand = marka; });
        if (!b.ok) continue;
        const g = geomOf(b), off = b.sys.lengthOffsetMm || 0;
        const L = b.sys.belt.effLength;
        const hb = F.beltProps({ profile: b.sys.belt.profile, brand: marka }).hb;
        expect([key, marka, Math.abs(L - (g.LeffMm - off)) < 1e-6]).toEqual([key, marka, true]);
        expect([key, marka, Math.abs((g.LpitchMm - off) - L - 2 * Math.PI * hb) < 1e-6]).toEqual([key, marka, true]);
        n++;
      }
    }
    expect(n).toBeGreaterThanOrEqual(20);
  });
  test('aynı numara iki çizgide okunursa kol başka açıya oturur — kararın bedeli', () => {
    // AG00686: kayış numarası L. Kol L_eff = L'de (d_b okuması) ve L_pitch = L'de
    // (d_w okuması). Aradaki yol 2π·h_b; take-up kol boyunca değiştiği için
    // açı farkı bir orana indirgenmez — ölçülen ~20°.
    const b = kur('AG00686_1475_GATES_2023', (nodes) => { kayis(nodes).brand = 'CONTITECH'; });
    expect(b.ok).toBe(true);
    const L = b.sys.belt.effLength, hb = 1.5;
    const tara = [];
    for (let a = -30; a <= 80; a += 0.02) {
      try { const g = F.tensionerState(b.sys, a).geom; tara.push([a, g.LeffMm, g.LpitchMm]); } catch (e) { /* kol aralık dışı */ }
    }
    const kesis = (hedef, j) => {
      for (let i = 1; i < tara.length; i++) {
        const l0 = tara[i - 1][j], l1 = tara[i][j];
        if ((l0 - hedef) * (l1 - hedef) <= 0) return tara[i - 1][0] + (hedef - l0) / (l1 - l0) * 0.02;
      }
      return NaN;
    };
    const off = b.sys.lengthOffsetMm || 0;
    const db = kesis(L + off, 1), dw = kesis(L + off, 2);
    expect(Number.isFinite(db) && Number.isFinite(dw)).toBe(true);
    expect(Math.abs(db - dw)).toBeGreaterThan(5);
    // d_w okumasında d_b çizgisindeki yol tam 2π·h_b kısa kalır
    expect(F.tensionerState(b.sys, dw).geom.LeffMm - off).toBeCloseTo(L - 2 * Math.PI * hb, 1);
  });
});

describe('h_b MARKANIN', () => {
  test('BELT_DB\'nin her kaydında fark 2π·h_b; PK ContiTech 9,42 mm, PK Gates 7,54 mm', () => {
    let n = 0;
    for (const p of Object.keys(F.BELT_DB)) {
      for (const m of Object.keys(F.BELT_DB[p])) {
        const x = veFeadBoyCizgileri(1000, p, m);
        expect([p, m, x.fark]).toEqual([p, m, 2 * Math.PI * F.BELT_DB[p][m].hb]);
        expect([p, m, Math.abs(x.dw - x.db - x.fark) < 1e-9]).toEqual([p, m, true]);
        expect([p, m, x.hr]).toEqual([p, m, F.BELT_DB[p][m].hr]);
        n++;
      }
    }
    expect(n).toBeGreaterThanOrEqual(10);
    expect(veFeadBoyCizgileri(1410, 'PK', 'CONTITECH').dw).toBeCloseTo(1419.42, 2);
    expect(veFeadBoyCizgileri(1410, 'PK', 'GATES').dw).toBeCloseTo(1417.54, 2);
  });
  test('boy yoksa ya da kayıt tanınmıyorsa sayı UYDURULMAZ', () => {
    const bos = veFeadBoyCizgileri(null, 'PK', 'GATES');
    expect(Number.isNaN(bos.db)).toBe(true);
    expect(Number.isNaN(bos.dw)).toBe(true);
    expect(bos.hb).toBe(1.2);                     // profil sabiti yine okunur (figür için)
    const yok = veFeadBoyCizgileri(1000, 'PX', 'GATES');
    expect(Number.isNaN(yok.dw) && Number.isNaN(yok.hb)).toBe(true);
  });
});

// ── KESİT FİGÜRÜ ─────────────────────────────────────────────────────────────
const svgOf = (h) => { const d = document.createElement('div'); d.innerHTML = h; return d.querySelector('svg'); };
const yollar = (d) => (d.match(/-?\d+(?:\.\d+)?/g) || []).map(Number)
  .reduce((a, v, i, arr) => (i % 2 ? a : a.concat([[v, arr[i + 1]]])), []);
const ys = (el) => yollar(el.getAttribute('d')).map((p) => p[1]);

describe('KESİT FİGÜRÜ ölçekli — çizgiler profilin sabitlerinden', () => {
  test("BELT_DB'nin her kaydında: d_b kasnağın dış çapında, kord ve diş tepesi orantılı", () => {
    let n = 0;
    for (const p of Object.keys(F.BELT_DB)) {
      for (const m of Object.keys(F.BELT_DB[p])) {
        const k = F.BELT_DB[p][m];
        const svg = svgOf(fead.veFeadKesitSVG(p, m));
        expect([p, m, !!svg]).toEqual([p, m, true]);
        const yDb = +svg.querySelector('[data-ve="kesit-db"]').getAttribute('y1');
        const yDw = +svg.querySelector('[data-ve="kesit-dw"]').getAttribute('y1');
        const kay = ys(svg.querySelector('[data-ve="kesit-kayis"]'));
        const kas = ys(svg.querySelector('[data-ve="kesit-kasnak"]'));
        const sirt = Math.min(...kay), tepe = Math.max(...kay);
        // d_b çizgisi KASNAĞIN DIŞ ÇAPI (sırt düzlüklerinin en üstü) — 0,1 px yuvarlama
        expect([p, m, Math.abs(yDb - Math.min(...kas)) <= 0.11]).toEqual([p, m, true]);
        // kord sırttan h_r, d_b korddan h_b; diş tepesi sırttan kalınlık kadar
        const olcek = (yDb - sirt) / (k.hr + k.hb);
        expect([p, m, Math.abs((yDw - sirt) / olcek - k.hr) < 0.02 * (k.hr + k.hb)]).toEqual([p, m, true]);
        expect([p, m, Math.abs((tepe - sirt) / olcek - k.thickness) < 0.02 * k.thickness]).toEqual([p, m, true]);
        // kord daireleri kord çizgisinin ÜSTÜNDE
        const cy = [...svg.querySelectorAll('[data-ve="kesit-kord"]')].map((c) => +c.getAttribute('cy'));
        expect(cy.length).toBeGreaterThan(0);
        expect([p, m, cy.every((v) => Math.abs(v - yDw) <= 0.11)]).toEqual([p, m, true]);
        n++;
      }
    }
    expect(n).toBeGreaterThanOrEqual(10);
  });
  test('basım paletinde tema jetonu yok; tanınmayan kayda figür uydurulmaz', () => {
    expect(fead.veFeadKesitSVG('PK', 'GATES', { print: true })).not.toMatch(/var\(--/);
    expect(fead.veFeadKesitSVG('PK', 'GATES')).toMatch(/var\(--accent-primary\)/);
    expect(fead.veFeadKesitSVG('PX', 'GATES')).toBe('');
    expect(fead.veFeadKesitSVG('PJ', 'GATES')).toBe('');      // PJ'nin Gates kaydı yok
  });
});

// ── KART VE SAĞ SÜTUN ────────────────────────────────────────────────────────
describe('Boy çizgileri kartı ve sağ sütun AYNI okumadan', () => {
  const tekKayis = (data) => {
    const n = { id: 'blt1', type: 'fead-belt', def: componentDefs['fead-belt'], data };
    global.nodes = [n]; global.connections = [];
    return n;
  };
  const sutun = (n) => Object.fromEntries(fead.veFeadBeltSideRows(n).satirlar);
  const duz = (h) => h.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

  test('SABİT kip, gergi yok: numara girilen boy, kord boyu +2π·h_b (ContiTech PK)', () => {
    const n = tekKayis({ lengthMode: 'fixed', effLength: 1410, profile: 'PK', brand: 'CONTITECH' });
    const x = fead.veFeadBoyOkuma(n);
    expect(x.db).toBe(1410);
    expect(x.dw).toBeCloseTo(1410 + 3 * Math.PI, 9);
    expect(x.serbest).toBe(false);
    const k = duz(fead.veFeadBoyCizgileriHTML(n));
    expect(fead.veFeadBoyCizgileriHTML(n)).toMatch(/value="1\.410,0 mm"/);
    expect(fead.veFeadBoyCizgileriHTML(n)).toMatch(/value="1\.419,4 mm"/);
    expect(k).toMatch(/9,42 mm/);
    expect(k).toMatch(/ContiTech PK/);                 // görünen ad, anahtar değil
    const c = sutun(n);
    expect(c['Kayış numarası']).toBe('1.410,0 mm');
    expect(c['Kord boyu']).toBe('1.419,4 mm');
    expect(c['Boy kaynağı']).toBe('katalogdan seçilir');
  });

  test('KİLİTLİ kip (gergi var): numara türetilen boy — sağ sütun da "tasarımdan" der', () => {
    const pack = veFeadExampleNodes('AG00686_1475_GATES_2023');
    pack.nodes.forEach((x) => { x.def = componentDefs[x.type]; });
    const belt = pack.nodes.find((x) => x.type === 'fead-belt');
    belt.data.lengthMode = 'fixed';                    // alan 'fixed' yazsa da kilit kazanır
    global.nodes = pack.nodes; global.connections = pack.connections;
    const b = veFeadBuildFromCanvas();
    expect(b.ok).toBe(true);
    const x = fead.veFeadBoyOkuma(belt, b);
    expect(x.serbest).toBe(true);
    expect(x.db).toBe(b.beltLengthMm);                  // çözüme yazılan boy (L_eff − ofset)
    expect(x.dw - x.db).toBeCloseTo(2 * Math.PI * 1.2, 9);
    const c = sutun(belt);
    expect(c['Boy kaynağı']).toBe('tasarımdan hesaplanır');
    expect(c['Kayış numarası']).toBe(veSayi(Math.round(b.beltLengthMm * 10) / 10, 1) + ' mm');
    // kart ile sütun aynı sayıyı basıyor
    expect(fead.veFeadBoyCizgileriHTML(belt)).toContain('value="' + c['Kayış numarası'] + '"');
    expect(fead.veFeadBoyCizgileriHTML(belt)).toContain('value="' + c['Kord boyu'] + '"');
  });

  test('kol KENETLENDİYSE türetilen numara "?" taşır — kartta da sütunda da', () => {
    const pack = veFeadExampleNodes('BMC_FEAD_2026');
    pack.nodes.forEach((x) => { x.def = componentDefs[x.type]; });
    pack.nodes.find((x) => x.type === 'fead-tensioner').data.kArm = 0.048;   // ondalık kayması
    global.nodes = pack.nodes; global.connections = pack.connections;
    const belt = pack.nodes.find((x) => x.type === 'fead-belt');
    expect(fead.veFeadBoyOkuma(belt).supheli).toBe(true);
    expect(fead.veFeadBoyCizgileriHTML(belt)).toMatch(/value="[\d.,]+ mm \?"[^>]*>/);
    expect(fead.veFeadBoyCizgileriHTML(belt)).toMatch(/data-ton="danger"/);
    expect(sutun(belt)['Kayış numarası']).toMatch(/ mm \?$/);
  });

  test('SERBEST kip ve model yok: sayı UYDURULMAZ', () => {
    const n = tekKayis({ lengthMode: 'free', effLength: 1410, profile: 'PK', brand: 'GATES' });
    const h = fead.veFeadBoyCizgileriHTML(n);
    expect(h).toMatch(/value="—"/);
    expect(h).not.toMatch(/NaN|undefined/);
    expect(sutun(n)['Kayış numarası']).toBe('—');
  });

  test('büyük harfli etikette sembol YOK (d<sub>b</sub> "D B", π "Π" olurdu)', () => {
    const n = tekKayis({ lengthMode: 'fixed', effLength: 1410, profile: 'PK', brand: 'GATES' });
    const d = document.createElement('div');
    d.innerHTML = fead.getFeadBeltPropertiesHTML(n);
    const et = [...d.querySelectorAll('.ve-fp-l')].map((e) => e.innerHTML);
    expect(et.length).toBeGreaterThan(5);
    expect(et.filter((e) => /<sub>|[α-ω]/.test(e))).toEqual([]);
    // figür Boy sekmesinde
    expect(d.querySelectorAll('svg [data-ve="kesit-db"]').length).toBe(1);
  });
});

// ── DİĞER YÜZEYLER: rapor · Sonuç Özeti · sihirbaz bandı · kılavuz ───────────
// Numara d_b'de kalır; her yüzey kordu (d_w) KÖPRÜNÜN dönüşümüyle yanına yazar.
describe('iki boy öteki yüzeylerde de — aynı dönüşümle', () => {
  const RP = require('../../js/cp-fead-report.js');
  const SU = require('../../js/cp-fead-summary.js');
  const wiz = require('../../js/cp-fead-wizard.js');
  Object.keys(fead).forEach((k) => { if (global[k] === undefined) global[k] = fead[k]; });
  Object.keys(RP).forEach((k) => { if (global[k] === undefined) global[k] = RP[k]; });
  const coz = (marka) => {
    const pack = veFeadExampleNodes('BMC_FEAD_2026');
    pack.nodes.forEach((n) => { n.def = componentDefs[n.type]; });
    const b = pack.nodes.find((n) => n.type === 'fead-belt');
    if (marka) b.data.brand = marka;
    b.data.beltDataMode = 'full';
    const build = veFeadBuildSystem(pack.nodes);
    const solv = pack.nodes.find((n) => componentDefs[n.type] && componentDefs[n.type].isFeadSolver);
    const R = veFeadAnalyze(build, { rows: veFeadDutyRows(solv), cylinders: 6, fatigueModel: 'PK-2_2p-MT3' });
    R.build = build; R.pulleyNames = build.names;
    return R;
  };
  const NODE = { id: 'rep1', type: 'fead-report', data: {} };

  test('rapor §8.2: numara satırı d_b, kord satırı +2π·h_b, kesit figürü basım paletinde', () => {
    const R = coz('CONTITECH');
    const L = R.build.sys.belt.effLength;
    const h = RP._frSection8(R, NODE);
    expect(h).toMatch(/kayış numarası \(d<sub>b<\/sub> çizgisi\)/);
    const kord = new RegExp('Kord boyu \\(d<sub>w</sub> çizgisi[^<]*</td><td>' + veSayi(L + 3 * Math.PI, 1).replace('.', '\\.'));
    expect(h).toMatch(kord);
    const i = h.indexOf('data-ve="kesit-db"');
    expect(i).toBeGreaterThan(0);
    const fig = h.slice(h.lastIndexOf('<figure>', i), h.indexOf('</figure>', i));
    expect(fig).not.toMatch(/var\(--/);                 // belge temasız da okunur
    expect(fig).toMatch(/<b>Şekil \d+ —<\/b>/);
  });

  test('Sonuç Özeti: efektif boy satırı kordu yanında taşır (ayrı satır yok)', () => {
    const R = coz('GATES');
    const L = R.build.sys.belt.effLength;
    const s1 = SU._fsrSheet1(R, NODE);
    expect(s1).toContain('Efektif boy (ISO 9981)');
    expect(s1).toContain(veSayi(L, 1) + ' mm · kord ' + veSayi(L + 2.4 * Math.PI, 1));
  });

  test('sihirbaz bandı: L_b çözümün boyu, d_w köprünün dönüşümü', () => {
    const R = coz('CONTITECH');
    const b = R.build;
    const h = wiz.veFeadWizLiveHTML(b);
    expect(h).toContain('L<sub>b</sub> <b>' + veSayi(b.beltLengthMm, 1) + ' mm</b>');
    expect(h).toContain('d<sub>w</sub> ' + veSayi(b.beltLengthMm + 3 * Math.PI, 1));
    expect(h).not.toMatch(/L<sub>eff<\/sub>/);
  });

  test('kılavuz §8.5 iki çizgiyi anlatır ve kartı sahnede gösterir', () => {
    const src = require('fs').readFileSync(require('path').join(__dirname, '../../js/guide-fead.js'), 'utf8');
    expect(src).toMatch(/8\.5 Kayış numarası hangi çizgide/);
    expect(src).toMatch(/_gfSahneKart2\('getFeadBeltPropertiesHTML', 'Boy çizgileri'/);
    // kartın başlığı gerçekten bu — sahne adıyla arıyor, ad kayarsa sahne boşalır
    const n = { id: 'blt1', type: 'fead-belt', def: componentDefs['fead-belt'],
                data: { lengthMode: 'fixed', effLength: 1410 } };
    global.nodes = [n];
    expect(fead.getFeadBeltPropertiesHTML(n)).toMatch(/<b>Boy çizgileri<\/b>/);
  });
});
