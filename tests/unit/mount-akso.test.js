/**
 * mount-akso.test.js — TAKOZ 2D GÖRÜNÜM · AKSONOMETRİK SEKME (2026-10-15)
 * ─────────────────────────────────────────────────────────────────────────
 * Kullanıcı seçimi (tasarım sayfası "Aksonometrik 2B Görünüm"): pencerenin
 * İLK sekmesi aksonometri — dimetrik (ISO 5456-3) varsayılan, izometrik
 * seçicide; sekiz bakış; gölge hep açık; direk, kuvvet, mod ve rijitlik
 * düğmeyle; üç duvar tam ekranda. Çizici js/mount-akso.js (DOM'suz), model
 * ve pencere js/cp-mount.js. Kapılar:
 *
 *   · KAMERA — eksen oranı ISO 5456-3'ün 1 : ½ : 1'i (0,94 : 0,47 : 0,94) ve
 *     izometrinin 0,82'si; önden-soldan-yukarıdan +X sağa, +Z yukarı; her
 *     bakışta kutunun ÜÇ yüzü görünür
 *   · MODEL ÇEKİRDEKTEN — kutu equivalentBox (köşegen atalet, raporun mod
 *     şekli çizimiyle aynı çağrı), ana gövde raporun %10 eşiği, G 2D
 *     görünüşlerinkiyle aynı, asal eksenler özvektör; kuvvet / statik denge /
 *     mod YALNIZ güncel çözümde (bayat bir ok ölçüm gibi durur)
 *   · FİZİK — tepkilerin düşey toplamı ağırlık; mod şekli raporun §8.16
 *     formülü (Δ = 1000·u + θ × r); ölçek sınırları %10 açıklık / 6°
 *   · YAZI — üç örnek × iki izdüşüm × sekiz bakış × altı katman, sütun ve tam
 *     ekran genişliğinde: yazı ≥ 10 px, iki yazı üst üste değil (çizicinin
 *     kendi kutu tahmini — gerçek kutular yerlesim.spec'te), BÜTÜN çizgiler
 *     yazılardan önce (hâle çizgiyi örter, çipin yazısını çipin dolgusu)
 *   · PENCERE — ilk sekme Aksonometrik, düz görünüşlerin adı kısa; denetim
 *     modeli değiştirmez (saveState yok, düğüm verisi aynı) ve tarayıcıya
 *     yazar; çözüm yokken / bayatken kuvvet ve mod kapalı, sebebi yazılı
 */
const fs = require('fs');
const path = require('path');
const core = require('../../js/mount-core.js');
global.veMountCore = core;

const stubs = stubGlobals({ saveState: jest.fn(), showToast: jest.fn(), showNodeProperties: jest.fn() });
eval(fs.readFileSync(path.join(__dirname, '../../js/components.js'), 'utf8'));
global.componentDefs = componentDefs;
global.veMntBrief = require('../../js/mount-brief.js');
const AK = require('../../js/mount-akso.js');
global.veMntAkso = AK;
const cp = require('../../js/cp-mount.js');
const rep = require('../../js/cp-mount-report.js');
['veMntUygunluk', 'veMntRaporOpts', '_mntRepCaseTr', '_mntRepIsolation', '_mntRepEngine', '_mntRepZeta']
  .forEach((k) => { global[k] = rep[k]; });

const KOK = path.join(__dirname, '../..');
const ORNEK = { tulga: 'tulga_topoloji.json', siper: 'siper_topoloji.json', asfat: 'asfat_topoloji.json' };
const JSONLAR = {};
Object.keys(ORNEK).forEach((k) => { JSONLAR[k] = JSON.parse(fs.readFileSync(path.join(KOK, 'assets/examples', ORNEK[k]), 'utf8')); });
function yukle(k) {
  global.nodes = JSON.parse(JSON.stringify(JSONLAR[k].nodes)).map((n) => Object.assign(n, { def: componentDefs[n.type] }));
  cp._mntForgetResults();
  return global.nodes;
}
const coz = () => cp._mntComputeResults(global.nodes.find((n) => n.type === 'mnt-solver').id);
const FS = { k: 10, b: 11 };
const BAKIS = [];
[-1, 1].forEach((x) => [-1, 1].forEach((y) => [1, -1].forEach((z) => BAKIS.push({ x, y, z }))));

beforeEach(() => { resetStubs(stubs); });

describe('KAMERA — izdüşümün oranı ve yönü', () => {
  test('dimetrik ISO 5456-3: X : Y : Z = 1 : ½ : 1 (0,943 : 0,471 : 0,943); izometrik 0,816 üçünde', () => {
    const d = AK.kamera('dim', { x: -1, y: -1, z: 1 }).oran;
    expect(d[0]).toBeCloseTo(Math.sqrt(8 / 9), 9);
    expect(d[1]).toBeCloseTo(Math.sqrt(2 / 9), 9);
    expect(d[2]).toBeCloseTo(Math.sqrt(8 / 9), 9);
    expect(d[1] / d[0]).toBeCloseTo(0.5, 9);
    AK.kamera('iso', { x: 1, y: -1, z: -1 }).oran.forEach((v) => expect(v).toBeCloseTo(Math.sqrt(2 / 3), 9));
  });

  test('önden-soldan-yukarıdan: +X sağa (arka), +Z yukarı; sekiz bakışın her birinde kutunun ÜÇ yüzü', () => {
    const K = AK.kamera('dim', { x: -1, y: -1, z: 1 });
    expect(K.P([1, 0, 0])[0]).toBeGreaterThan(0.9);
    expect(K.P([0, 0, 1])[1]).toBeLessThan(-0.9);
    expect(K.P([0, 1, 0])[0]).toBeLessThan(0);                  // +Y (sağ) derinliğe, sola
    BAKIS.forEach((b) => ['dim', 'iso'].forEach((iz) => {
      const K2 = AK.kamera(iz, b);
      const gor = AK.yuzler([0, 0, 0], [1, 2, 3]).filter((f) => K2.gorunur(f.n));
      expect({ b, iz, n: gor.length }).toEqual({ b, iz, n: 3 });
      // görünen üst/alt yüz bakışın yüksekliğiyle tutarlı
      expect(gor.some((f) => f.eks === 2 && f.s === b.z)).toBe(true);
    }));
    expect(AK.bakisAdi({ x: -1, y: -1, z: 1 })).toBe('önden-soldan-yukarıdan');
    expect(AK.bakisAdi({ x: 1, y: 1, z: -1 })).toBe('arkadan-sağdan-alttan');
  });
});

describe('MODEL ÇEKİRDEKTEN — pencere hesaplamaz, okur', () => {
  test('kutu equivalentBox (köşegen atalet), ana gövde raporun eşiği, G 2D görünüşlerinki', () => {
    Object.keys(ORNEK).forEach((k) => {
      yukle(k);
      const P = cp._mnt2DPencereVeri(), m = cp._mntAksoModel(P);
      expect(m.govde.length).toBe(P.M.g.components.length);
      P.M.g.components.forEach((c, i) => {
        const n = (v) => Number(v) || 0;
        const kb = core.equivalentBox(n(c.mass), [[n(c.Ixx), 0, 0], [0, n(c.Iyy), 0], [0, 0, n(c.Izz)]], !!c.pointMass);
        expect({ k, i, kutu: m.govde[i].kutu }).toEqual({ k, i, kutu: kb ? kb.map((v) => v * 1000) : null });
      });
      const mTop = m.govde.reduce((a, g) => a + g.m, 0);
      const ana = m.govde.filter((g) => g.m / mTop >= 0.10);
      expect(m.govde.filter((g) => g.ana).map((g) => g.ad)).toEqual((ana.length >= 2 ? ana : m.govde.slice().sort((a, b) => b.m - a.m).slice(0, 2)).map((g) => g.ad));
      expect([m.G.x, m.G.y, m.G.z]).toEqual([P.veri.cg.x, P.veri.cg.y, P.veri.cg.z]);
    });
    // Tulga: Motor, Şanzıman, Transfer Kutusu ana; braketler nokta kütle
    yukle('tulga');
    const t = cp._mntAksoModel();
    expect(t.govde.filter((g) => g.ana).map((g) => g.ad)).toEqual(['Motor', 'Şanzıman', 'Transfer Kutusu']);
    expect(t.govde.filter((g) => !g.kutu).length).toBe(5);
  });

  // Üç örnekte %5–10 arasında gövde yok: eşik başka bir sayıya kaysa örnekler
  // bunu göremezdi. Bir braketin payı eşiğin iki yanına taşınır.
  test('ana gövde eşiği tam %10: payı %7 olan gövde ana DEĞİL, %11 olan ana', () => {
    yukle('tulga');
    const braket = global.nodes.find((n) => n.type === 'mnt-bracket');
    const digerleri = cp._mntAksoModel().govde.reduce((a, g) => a + g.m, 0) - Number(braket.data.mass);
    const pay = (p) => { braket.data.mass = Math.round(p * digerleri / (1 - p) * 10) / 10; return cp._mntAksoModel().govde.find((g) => g.ad === 'Braket' && g.m === braket.data.mass); };
    expect(pay(0.07).ana).toBe(false);
    expect(pay(0.11).ana).toBe(true);
  });

  test('asal eksenler birleşik I_G\'nin ÖZVEKTÖRÜ (artık ≈ 0); eşdeğer kutu aynı kütle ve ataleti verir', () => {
    Object.keys(ORNEK).forEach((k) => {
      yukle(k);
      const M = cp._mntCanliModel(), m = cp._mntAksoModel();
      const I = M.mp.I_G;
      m.asal.eksenler.forEach((e, i) => {
        const Ie = I.map((r) => r[0] * e[0] + r[1] * e[1] + r[2] * e[2]);
        const art = Math.hypot(...Ie.map((v, j) => v - m.asal.degerler[i] * e[j]));
        expect({ k, i, art: art < 1e-9 * m.asal.degerler[2] }).toEqual({ k, i, art: true });
      });
      // kutunun asal ataleti: m(b²+c²)/12 … = I₁, I₂, I₃
      const [a, b, c] = m.asal.kutu.map((v) => v / 1000), mm = M.mp.m;
      expect(mm * (b * b + c * c) / 12).toBeCloseTo(m.asal.degerler[0], 6);
      expect(mm * (a * a + c * c) / 12).toBeCloseTo(m.asal.degerler[1], 6);
      expect(mm * (a * a + b * b) / 12).toBeCloseTo(m.asal.degerler[2], 6);
    });
  });

  test('kuvvet, statik denge ve mod YALNIZ güncel çözümde; model değişince düşer', () => {
    yukle('tulga');
    let m = cp._mntAksoModel();
    expect([m.cozum, m.q, m.modlar, m.takoz.some((t) => t.f)]).toEqual(['yok', null, null, false]);
    coz();
    m = cp._mntAksoModel();
    expect(m.cozum).toBe('guncel');
    expect(m.modlar.length).toBe(6);
    expect(m.takoz.every((t) => t.f && t.yukKg > 0)).toBe(true);
    // mod adı raporun kısa Türkçesi
    expect(m.modlar.map((q) => q.ad)[0]).toBe('yanal+yalpalama');
    global.nodes.find((n) => n.type === 'mnt-mount').data.kzs = 999;
    m = cp._mntAksoModel();
    expect([m.cozum, m.q, m.modlar, m.takoz.some((t) => t.f)]).toEqual(['bayat', null, null, false]);
  });
});

describe('FİZİK — serbest cisim ve mod şekli', () => {
  test('takoz tepkilerinin düşey toplamı ağırlık (statik denge, üç örnek)', () => {
    Object.keys(ORNEK).forEach((k) => {
      yukle(k); coz();
      const m = cp._mntAksoModel();
      const tepki = m.takoz.reduce((a, t) => a - t.f[2], 0);
      expect({ k, oran: Math.round(tepki / (m.G.m * 9.81) * 1000) / 1000 }).toEqual({ k, oran: 1 });
    });
  });

  test('mod şekli raporun §8.16 formülü: Δ = 1000·u + θ × (p − c)', () => {
    const phi = [0.0012, -0.0007, 0.0004, 0.015, -0.022, 0.009], c = [120, -30, 410], p = [900, 250, 80];
    const r = [p[0] - c[0], p[1] - c[1], p[2] - c[2]], t = phi.slice(3);
    const capraz = [t[1] * r[2] - t[2] * r[1], t[2] * r[0] - t[0] * r[2], t[0] * r[1] - t[1] * r[0]];
    const d = AK.modDelta(phi, c, p, 2.5);
    [0, 1, 2].forEach((i) => expect(d[i]).toBeCloseTo(2.5 * (phi[i] * 1000 + capraz[i]), 9));
  });

  test('ölçek sınırları: en büyük öteleme açıklığın %10\'u, en büyük dönme 6°', () => {
    yukle('tulga'); coz();
    const m = cp._mntAksoModel();
    const xs = [];
    m.govde.forEach((g) => { const h = g.kutu ? g.kutu[0] / 2 : 0; xs.push(g.x - h, g.x + h); });
    m.takoz.forEach((t) => xs.push(t.x));
    const span = Math.max(...xs) - Math.min(...xs);
    m.modlar.forEach((md, i) => {
      const s = AK.modOlcek(m, md.phi);
      const donme = Math.max(...md.phi.slice(3).map(Math.abs)) * s * 180 / Math.PI;
      let oteleme = 0;
      m.govde.forEach((g) => {
        const h = g.kutu ? g.kutu.map((v) => v / 2) : [0, 0, 0];
        [-1, 1].forEach((a) => [-1, 1].forEach((b) => [-1, 1].forEach((c) => {
          const d = AK.modDelta(md.phi, m.cgR, [g.x + a * h[0], g.y + b * h[1], g.z + c * h[2]], s);
          oteleme = Math.max(oteleme, ...d.map(Math.abs));
        })));
      });
      m.takoz.forEach((t) => { oteleme = Math.max(oteleme, ...AK.modDelta(md.phi, m.cgR, [t.x, t.y, t.z], s).map(Math.abs)); });
      expect({ i, ok: donme <= 6 + 1e-9 && oteleme <= span * 0.10 + 1e-6 }).toEqual({ i, ok: true });
      expect({ i, sinirda: Math.abs(donme - 6) < 1e-6 || Math.abs(oteleme - span * 0.10) < 1e-6 }).toEqual({ i, sinirda: true });
    });
  });
});

describe('YAZI — okunur, çakışmaz, çizgi altında', () => {
  // <text …>içerik</text> → çizicinin kutu tahmini (yerleştiricinin ölçüsüyle aynı)
  function yazilar(svg) {
    const out = [];
    const re = /<text([^>]*)>([^<]*)<\/text>/g;
    let mt;
    while ((mt = re.exec(svg))) {
      const a = (n) => { const q = new RegExp(' ' + n + '="([^"]*)"').exec(mt[1]); return q ? q[1] : null; };
      const px = Number(a('font-size')), x = Number(a('x')), y = Number(a('y')), an = a('text-anchor') || 'start';
      const t = mt[2].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
      const w = AK.tahmin(t, px, a('font-weight') === '600');
      const l = an === 'middle' ? x - w / 2 : (an === 'end' ? x - w : x);
      out.push({ t, px, k: { l, r: l + w, t: y - px * 0.82, b: y + px * 0.26 } });
    }
    return out;
  }
  const kesis = (a, b) => Math.min(a.r, b.r) - Math.max(a.l, b.l) > 0.5 && Math.min(a.b, b.b) - Math.max(a.t, b.t) > 0.5;
  const KATLAR = [
    ['temel', {}, 'golge'],
    ['direk', { direk: true }, 'xray'],
    ['kuvvet', { kuvvet: true, cokme: true }, 'golge'],
    ['rijit', { rijit: true, asal: true }, 'xray'],
    ['mod', {}, 'golge', true],
  ];

  test('üç örnek × iki izdüşüm × sekiz bakış × katmanlar (sütun 338/354, tam ekran 1200 + üç duvar)', () => {
    const kucuk = [], binen = [], sira = [], bozuk = [];
    Object.keys(ORNEK).forEach((k) => {
      yukle(k); coz();
      const m = cp._mntAksoModel();
      const md = m.modlar[1];
      ['dim', 'iso'].forEach((iz) => BAKIS.forEach((b) => {
        const durumlar = [];
        [338, 354].forEach((W) => KATLAR.forEach(([ad, kat, stil, mod]) => durumlar.push({ ad: W + '/' + ad, W, kat, stil, mod, etiket: 'ad' })));
        durumlar.push({ ad: 'tam/duvar', W: 1200, kat: { duvar: true }, stil: 'xray', etiket: 'genis' });
        durumlar.push({ ad: 'tam/cetvel', W: 1200, kat: { cetvel: true }, stil: 'golge', etiket: 'genis' });
        durumlar.forEach((d) => {
          const o = { W: d.W, iz, b, stil: d.stil, kat: Object.assign({ golge: true }, d.kat), etiket: d.etiket, fs: FS };
          if (d.mod) o.mod = { phi: md.phi, s: AK.modOlcek(m, md.phi), faz: 1 };
          const svg = AK.ciz(m, o).svg, yer = `${k}/${iz}/${AK.bakisAdi(b)}/${d.ad}`;
          if (/NaN|undefined|Infinity/.test(svg)) bozuk.push(yer);
          const y = yazilar(svg);
          y.forEach((a) => { if (a.px < 10) kucuk.push(`${yer}: ${a.t} ${a.px}`); });
          for (let i = 0; i < y.length; i++) for (let j = i + 1; j < y.length; j++)
            if (kesis(y[i].k, y[j].k)) binen.push(`${yer}: "${y[i].t}" ↔ "${y[j].t}"`);
          // ilk yazıdan sonra çizgi yok: yalnız yazı, grup ve çipin dolgulu zemini
          const sonra = svg.slice(svg.indexOf('<text'));
          const cizgi = (sonra.match(/<(line|path|polyline|polygon|circle|ellipse)\b/g) || []);
          if (cizgi.length) sira.push(`${yer}: ${cizgi.length} çizgi yazıdan sonra`);
        });
      }));
    });
    expect(bozuk).toEqual([]);
    expect(kucuk).toEqual([]);
    expect(binen.slice(0, 10)).toEqual([]);
    expect(sira.slice(0, 10)).toEqual([]);
  });

  test('her yazı zeminin renginde hâle taşır ya da dolgulu çipin içinde', () => {
    yukle('asfat'); coz();
    const m = cp._mntAksoModel();
    const svg = AK.ciz(m, { W: 354, iz: 'dim', b: { x: -1, y: -1, z: 1 }, kat: { golge: true, kuvvet: true, rijit: true, asal: true, cetvel: true }, stil: 'xray', fs: FS }).svg;
    const css = fs.readFileSync(path.join(KOK, 'css/styles.css'), 'utf8');
    const hale = css.match(/\.ve-ak-yz, \.ve-ak-cvy, \.ve-ak-cvad\{([^}]*)\}/);
    expect(hale && /paint-order:stroke/.test(hale[1]) && /stroke:var\(--bg-input\)/.test(hale[1])).toBe(true);
    expect(css).toMatch(/\.ve-ak-zem\{ fill:var\(--bg-input\); \}/);         // hâle ile zemin aynı jeton
    const metinler = [...svg.matchAll(/<g class="ve-ak-cip[^"]*"[^>]*><rect[^>]*\/>((?:<text[^>]*>[^<]*<\/text>)+)<\/g>|<text class="([^"]*)"/g)];
    expect(metinler.length).toBeGreaterThan(10);
    metinler.forEach((x) => { if (x[2] !== undefined) expect(x[2]).toMatch(/ve-ak-(yz|cvy|cvad)/); });
  });

  // Alttan bakışta Z = 0 düzlemi göz ile gövdeler ARASINDA: gölge o düzlemin
  // öbür yüzüne düşer (çizilmez), zemin camdan ve gövdelerin ÜSTÜNDE çizilir.
  test('alttan bakış: gölge yok, zemin camdan ve gövdelerin üstünde; yukarıdan bakışta tersi', () => {
    yukle('tulga');
    const m = cp._mntAksoModel();
    const ciz = (z) => AK.ciz(m, { W: 354, iz: 'dim', b: { x: -1, y: -1, z }, kat: { golge: true }, fs: FS }).svg;
    const ust = ciz(1), alt = ciz(-1);
    expect((ust.match(/class="ve-ak-gol"/g) || []).length).toBe(3);         // üç kutulu gövdenin izi
    expect(ust).not.toMatch(/ve-ak-izg cam/);
    expect(ust.indexOf('class="ve-ak-izg"')).toBeLessThan(ust.indexOf('ve-ak-hareket'));
    expect(alt).not.toMatch(/class="ve-ak-gol"/);
    expect(alt.indexOf('ve-ak-izg cam')).toBeGreaterThan(alt.indexOf('<!--hs-->'));
  });

  test('canlandırmanın karesi çizilenle AYNI sığdırmada: faz 0 karesi çizimin hareket katmanıdır', () => {
    yukle('siper'); coz();
    const m = cp._mntAksoModel(), md = m.modlar[2];
    const o = { W: 354, iz: 'dim', b: { x: -1, y: -1, z: 1 }, kat: { golge: true }, fs: FS, mod: { phi: md.phi, s: AK.modOlcek(m, md.phi), faz: 0 } };
    const r = AK.ciz(m, o);
    const kare = AK.ciz(m, Object.assign({}, o, { F: r.F, yalnizHareket: true })).hareket;
    expect(kare).toBe(AK.hareketIci(r.svg));
    const uc = AK.ciz(m, Object.assign({}, o, { F: r.F, yalnizHareket: true, mod: Object.assign({}, o.mod, { faz: 1 }) })).hareket;
    expect(uc).not.toBe(kare);
  });
});

describe('PENCERE — ilk sekme, denetim, tercih modelde değil', () => {
  function pencere() { return cp.getMnt2DViewPropertiesHTML({ id: 'd2', type: 'mnt-2dview', data: {} }); }
  const tg = (h, ad) => {
    const mt = h.match(new RegExp('<button type="button" class="mnt-vwr-toggle[^"]*" aria-pressed="(true|false)"([^>]*)>' + ad + '</button>'));
    return mt ? { basili: mt[1] === 'true', kapali: /aria-disabled="true"/.test(mt[2]), baslik: (mt[2].match(/title="([^"]*)"/) || [])[1] } : null;
  };

  test('ilk sekme Aksonometrik; düz görünüşlerin adı kısa (eksen çifti kutunun başlığında)', () => {
    yukle('tulga');
    const h = pencere();
    const sekme = [...h.matchAll(/class="ve-fp-tab"[^>]*data-k="(\w+)"[^>]*aria-selected="(true|false)"[\s\S]*?<span class="ve-fp-tab-ad">([^<]*)<\/span>/g)].map((x) => [x[1], x[2], x[3]]);
    expect(sekme).toEqual([['akso', 'true', 'Aksonometrik'], ['ust', 'false', 'Üstten'], ['yan', 'false', 'Yandan'], ['on', 'false', 'Önden']]);
    expect((h.match(/<svg class="ve-mnt2d-akso ve-mnt2d-fig"/g) || []).length).toBe(1);
    expect(h).toContain('<b>Dimetrik</b><em>önden-soldan-yukarıdan</em>');
    expect(h).toMatch(/<b>Üstten görünüş<\/b><em>X–Y · gerçek ölçek<\/em>/);
  });

  test('çözüm yokken ve bayatken kuvvet ile mod kapalı ve sebebini söyler; güncel çözümde açık', () => {
    yukle('tulga');
    let h = pencere();
    expect(tg(h, 'Kuvvet')).toEqual({ basili: false, kapali: true, baslik: 'Kuvvet: Henüz çözüm yok — Çözücü\'de Hesapla.' });
    expect(tg(h, 'Mod').kapali).toBe(true);
    expect(tg(h, 'Direk').kapali).toBe(false);
    coz();
    h = pencere();
    expect(tg(h, 'Kuvvet').kapali).toBe(false);
    expect(tg(h, 'Mod').kapali).toBe(false);
    global.nodes.find((n) => n.type === 'mnt-motor').data.mass = 500;
    h = pencere();
    expect(tg(h, 'Kuvvet').baslik).toBe('Kuvvet: Model son hesaptan sonra değişti — Çözücü\'de Hesapla.');
  });

  test('denetim modeli değiştirmez, tarayıcıya yazar; katman ve mod listesi pencereye gelir', () => {
    yukle('tulga'); coz();
    localStorage.removeItem('ve-mnt-akso');
    const kap = document.createElement('div');
    kap.id = 've-mnt-akso-d9';
    Object.defineProperty(kap, 'clientWidth', { value: 356 });
    document.body.appendChild(kap);
    kap.innerHTML = pencere();
    const once = JSON.stringify(global.nodes.map((n) => n.data));
    const A = cp.VE_MNT_AKSO;
    const yedek = JSON.parse(JSON.stringify(A));
    try {
      expect(cp.veMntAksoAyar('ve-mnt-akso-d9', 'kat', 'kuvvet')).toBe(true);
      expect(kap.innerHTML).toContain('ağırlık 788 kg');
      expect(tg(kap.innerHTML, 'Kuvvet').basili).toBe(true);
      cp.veMntAksoAyar('ve-mnt-akso-d9', 'kat', 'mod');
      const mod = [...kap.querySelectorAll('.ve-mnt-ak-mod button')].map((b) => b.textContent);
      expect(mod.length).toBe(6);
      expect(mod[0]).toMatch(/^1 6,51 Hzyanal\+yalpalama$/);
      cp.veMntAksoAyar('ve-mnt-akso-d9', 'iz', 'iso');
      cp.veMntAksoAyar('ve-mnt-akso-d9', 'bz', -1);
      expect(kap.innerHTML).toContain('<b>İzometrik</b><em>önden-soldan-alttan</em>');
      expect(stubs.saveState).not.toHaveBeenCalled();
      expect(JSON.stringify(global.nodes.map((n) => n.data))).toBe(once);
      const yaz = JSON.parse(localStorage.getItem('ve-mnt-akso'));
      expect([yaz.iz, yaz.bz, yaz.kuvvet, yaz.mod]).toEqual(['iso', -1, true, true]);
    } finally {
      Object.assign(A, yedek);
      kap.remove();
    }
  });
});

// Adım 2 (2026-10-16): raporun §8'i aynı resmi TEKNİK İLLÜSTRASYON olarak
// taşır. "Aynı" = TEK çizici ve TEK kurucu, ÇÖZÜMÜN girdisinden (rapor çözülen
// modeli anlatır); görünüş SABİT (belge tarayıcıdaki pencere tercihine bağlı
// olamaz); belge kendi renklerini taşır — kuralsız bir sınıf SVG'nin
// varsayılanıyla, siyah dolguyla çizilirdi.
describe('RAPOR — §8\'in teknik illüstrasyonu', () => {
  global.veMntAksoCozumModel = cp.veMntAksoCozumModel;
  const sekil = (s8) => {
    const a = s8.indexOf('<figure class="rp-akso">');
    return a < 0 ? '' : s8.slice(a, s8.indexOf('</figure>', a));
  };
  const rapor = () => { const R = cp.veMntSonucDurumu().R; global._veMntLast = R; return rep._mntRepSection8(R); };

  test('pencerenin çizicisi ve kurucusu, çözümün girdisinden; Şekil 2, düz görünüşler 3 ve 4', () => {
    yukle('tulga'); coz();
    const s8 = rapor(), R = cp.veMntSonucDurumu().R;
    expect(sekil(s8)).toContain(AK.ciz(cp.veMntAksoCozumModel(R), rep._MNT_REP_AKSO_O).svg);
    expect(sekil(s8)).toMatch(/<b>Şekil 2 —<\/b> Güç grubunun aksonometrisi: dimetrik izdüşüm \(ISO 5456-3; eksen oranı X : Y : Z = 0,94 : 0,47 : 0,94\)/);
    expect(s8).toMatch(/<b>Şekil 3 —<\/b> Üstten görünüş/);
    expect(s8).toMatch(/<b>Şekil 4 —<\/b> Yandan görünüş/);
    // x-ışını teknik illüstrasyon: gizli kenar, gövde CG'si, direk ve adlar
    ['k-gizli', 've-ak-amk', 've-ak-direk', '>Motor<', '>T1 Ön Takoz<'].forEach((s) => expect(sekil(s8)).toContain(s));
  });

  test('görünüş sabit: pencerenin tercihi (izometrik, arkadan-alttan, katmanlar) raporu değiştirmez', () => {
    yukle('siper'); coz();
    const once = sekil(rapor());
    // Tarayıcıda pencerenin tercihi bir GLOBAL — rapor onu görebilir; Node'da
    // da görsün ki kapı ölçsün.
    const A = global.VE_MNT_AKSO = cp.VE_MNT_AKSO, yedek = Object.assign({}, A);
    Object.assign(A, { iz: 'iso', bx: 1, bz: -1, rijit: true, kuvvet: true, mod: true });
    try { expect(sekil(rapor())).toBe(once); } finally { Object.assign(A, yedek); delete global.VE_MNT_AKSO; }
    expect(once).toContain('aria-label="Dimetrik · önden-soldan-yukarıdan"');
  });

  test('rapor ÇÖZÜLEN modeli çizer: çözümden sonra kanvasta yapılan değişiklik şekle girmez', () => {
    yukle('tulga'); coz();
    const once = sekil(rapor());
    global.nodes.find((n) => n.type === 'mnt-motor').data.cgz = 2000;
    expect(sekil(rapor())).toBe(once);
  });

  test('belge renkleri: çizimdeki her sınıfın raporun stilinde bir kuralı var', () => {
    const yapisal = ['rp-akso', 've-mnt2d-akso', 've-ak-hareket', 'xray'];
    Object.keys(ORNEK).forEach((k) => {
      yukle(k); coz();
      const siniflar = new Set();
      (sekil(rapor()).match(/class="[^"]+"/g) || []).forEach((c) => c.slice(7, -1).split(/\s+/).forEach((s) => siniflar.add(s)));
      const eksik = [...siniflar].filter((s) => !yapisal.includes(s) && rep._MNT_REP_AKSO_CSS.indexOf('.' + s) < 0);
      expect({ k, eksik }).toEqual({ k, eksik: [] });
    });
  });

  // Elle kurulmuş bir çözümde (rapor testlerinin kalıbı) takozun kimliği yok:
  // undefined === undefined her takozu İLK takozun sonucuna bağlıyordu.
  test('kimliksiz girdide takoz sırayla eşlenir', () => {
    yukle('tulga'); coz();
    const R = cp.veMntSonucDurumu().R;
    const kimliksiz = Object.assign({}, R, {
      gather: Object.assign({}, R.gather, { mounts: R.gather.mounts.map((t) => Object.assign({}, t, { id: undefined })) }),
      mounts: R.mounts.map((t) => Object.assign({}, t, { id: undefined })) });
    const a = cp.veMntAksoCozumModel(R).takoz.map((t) => t.f), b = cp.veMntAksoCozumModel(kimliksiz).takoz.map((t) => t.f);
    expect(b).toEqual(a);
    expect(new Set(b.map((f) => f[2])).size).toBeGreaterThan(1);
  });
});

// Gövdenin CG işareti (x-ışını) bir VERİ işaretidir: yazı onu örtmez. Ölçüldü
// (raporun çizimi, ASFAT): "G · z 798" motorun CG işaretinin üstüne düşüyordu
// — işaret yerleştiricinin engel listesinde yoktu.
describe('YAZI — x-ışınında gövdenin CG işaretini yazı örtmez', () => {
  test('üç örnek × iki izdüşüm × sekiz bakış × iki genişlik', () => {
    const ihlal = [];
    Object.keys(ORNEK).forEach((k) => {
      yukle(k);
      const m = cp._mntAksoModel();
      ['dim', 'iso'].forEach((iz) => BAKIS.forEach((b) => [[354, 'ad'], [820, 'genis']].forEach(([W, etiket]) => {
        const r = AK.ciz(m, { W, iz, b, stil: 'xray', kat: { golge: true, direk: true }, etiket, fs: FS });
        const isaret = [...r.svg.matchAll(/<g class="ve-ak-amk"[^>]*><circle cx="([\d.-]+)" cy="([\d.-]+)"/g)].map((q) => [+q[1], +q[2]]);
        r.etiket.forEach((e) => isaret.forEach(([x, y]) => {
          const b2 = e.kutu;
          if (b2.l < x + 4.5 && b2.r > x - 4.5 && b2.t < y + 4.5 && b2.b > y - 4.5) ihlal.push(k + ' ' + iz + ' ' + JSON.stringify(b) + ' ' + W + ' ' + e.m1);
        }));
      })));
    });
    expect(ihlal).toEqual([]);
  });
});
