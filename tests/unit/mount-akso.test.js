/**
 * mount-akso.test.js — TAKOZ GÖRÜNÜMLER · AKSONOMETRİ (2026-10-15 · 10-16)
 * ─────────────────────────────────────────────────────────────────────────
 * Kullanıcı seçimi (tasarım sayfası "Aksonometrik 2B Görünüm"): aksonometri —
 * dimetrik (ISO 5456-3) varsayılan, izometrik seçicide; gölge hep açık;
 * direk, kuvvet, mod ve rijitlik düğmeyle; üç duvar tam ekranda. 2026-10-16:
 * döndürülebilir hâli 3D Görüntüleyici'den Görünümler'e (eski 2D Görünüm)
 * taşındı ve pencerenin TEK çizimi oldu — düz görünüşler kalktı, işaretler
 * büyüdü. Çizici js/mount-akso.js (DOM'suz), model ve pencere
 * js/cp-mount.js. Kapılar:
 *
 *   · KAMERA — eksen oranı ISO 5456-3'ün 1 : ½ : 1'i (0,94 : 0,47 : 0,94) ve
 *     izometrinin 0,82'si; önden-soldan-yukarıdan +X sağa, +Z yukarı; her
 *     bakışta kutunun ÜÇ yüzü görünür
 *   · MODEL ÇEKİRDEKTEN — kutu equivalentBox (köşegen atalet, raporun mod
 *     şekli çizimiyle aynı çağrı), ana gövde raporun %10 eşiği, G 2D
 *     görünüşlerinkiyle aynı, asal eksenler özvektör; pencerenin modeli
 *     çözüm OKUMAZ — kuvvet / statik denge / mod YALNIZ raporun modelinde
 *     (veMntAksoCozumModel; kullanıcı kararı 2026-10-16: sonuç yalnız raporda)
 *   · FİZİK — tepkilerin düşey toplamı ağırlık; mod şekli raporun §8.16
 *     formülü (Δ = 1000·u + θ × r); ölçek sınırları %10 açıklık / 6°
 *   · YAZI — üç örnek × iki izdüşüm × sekiz bakış × altı katman, sütun ve tam
 *     ekran genişliğinde: yazı ≥ 10 px, iki yazı üst üste değil (çizicinin
 *     kendi kutu tahmini — gerçek kutular yerlesim.spec'te), BÜTÜN çizgiler
 *     yazılardan önce (hâle çizgiyi örter, çipin yazısını çipin dolgusu)
 *   · PENCERE — Görünümler TEK görünüm (2026-10-16, ikinci tur): çizim,
 *     gösterge ve işaretlerin föyü; açı yazısı, Görünüş, Katmanlar, Uygunluk
 *     ve Etkileşim yok; görünüm düğmeleri ve tam ekran çizimin başlığında;
 *     çizim sonuç göstermez; denetim modeli değiştirmez (saveState yok, düğüm
 *     verisi aynı) ve tarayıcıya yalnız açıyı yazar
 *   · İŞARET BOYU — takoz, G, gövde CG'si ve nokta kütle pencerede ×1,5,
 *     geniş çizimde √2 kata dek daha, yakınlaştırmayla √yakın (0,75–1,75);
 *     ölçü olan (kuvvet okunun boyu) büyümez; rapor ve karolar birebir eski
 *   · KLASİK 3B — 3D Görüntüleyici yer tutucu: tek kategori, tipin beyan ettiği
 *     not; tuval, düğme ve çizim yok, tazeleyicisi yok (2026-10-16)
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

  // Kullanıcı kararı (2026-10-16): pencere sonuç göstermez — "kullanıcı
  // sadece detaylı sonuç raporu ile yetinecek". Pencerenin modeli çözümü
  // OKUMAZ; kuvvet, statik denge ve mod yalnız raporun modelinde.
  test('pencerenin modeli çözüm okumaz; kuvvet, statik denge ve mod YALNIZ raporun modelinde', () => {
    yukle('tulga');
    const sonucsuz = (m) => [m.cozum, m.q, m.modlar, m.takoz.some((t) => t.f || t.yukKg != null), m.takoz.some((t) => t.bilgi.length > 3)];
    expect(sonucsuz(cp._mntAksoModel())).toEqual(['yok', null, null, false, false]);
    const R = coz();
    expect(sonucsuz(cp._mntAksoModel())).toEqual(['yok', null, null, false, false]);
    const r = cp.veMntAksoCozumModel(R);
    expect(r.cozum).toBe('guncel');
    expect(r.modlar.length).toBe(6);
    expect(r.takoz.every((t) => t.f && t.yukKg > 0)).toBe(true);
    expect(r.modlar.map((q) => q.ad)[0]).toBe('yanal+yalpalama');      // mod adı raporun kısa Türkçesi
  });
});

describe('FİZİK — serbest cisim ve mod şekli', () => {
  test('takoz tepkilerinin düşey toplamı ağırlık (statik denge, üç örnek)', () => {
    Object.keys(ORNEK).forEach((k) => {
      yukle(k);
      const m = cp.veMntAksoCozumModel(coz());
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
    yukle('tulga');
    const m = cp.veMntAksoCozumModel(coz());
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
      yukle(k);
      const m = cp.veMntAksoCozumModel(coz());
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
    yukle('asfat');
    const m = cp.veMntAksoCozumModel(coz());
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
    yukle('siper');
    const m = cp.veMntAksoCozumModel(coz()), md = m.modlar[2];
    const o = { W: 354, iz: 'dim', b: { x: -1, y: -1, z: 1 }, kat: { golge: true }, fs: FS, mod: { phi: md.phi, s: AK.modOlcek(m, md.phi), faz: 0 } };
    const r = AK.ciz(m, o);
    const kare = AK.ciz(m, Object.assign({}, o, { F: r.F, yalnizHareket: true })).hareket;
    expect(kare).toBe(AK.hareketIci(r.svg));
    const uc = AK.ciz(m, Object.assign({}, o, { F: r.F, yalnizHareket: true, mod: Object.assign({}, o.mod, { faz: 1 }) })).hareket;
    expect(uc).not.toBe(kare);
  });
});

describe('PENCERE — Görünümler: tek görünüm, başlıkta görünüm düğmeleri, tercih modelde değil', () => {
  function pencere() { return cp.getMnt2DViewPropertiesHTML({ id: 'd2', type: 'mnt-2dview', data: {} }); }
  const dom = (h) => { const d = document.createElement('div'); d.innerHTML = h; return d; };
  const IPUCU = 'Sol tık + sürükle: döndür · Sağ tık + sürükle: kaydır · Tekerlek: yakınlaştır · Çift tık: sıfırla';

  // Kullanıcı (2026-10-16, ikinci tur): "'Aksonometrik' ve 'İşaretler' gibi
  // iki kısıma ayırmışsın. Onları birleştirelim … 'Serbest Bakış' kısmının
  // yanında 'Yükseliş' 'Azimut' değerleri yazıyor. Onları kaldıralım …
  // Görünüş, Katmanlar, Uygunluk ve Etkileşim kısımlarına gerek yok … Tam
  // ekran butonunu uygun bir yere alalım." Ölçülen önce (main 35b98c8): iki
  // sekme, açı yazısı, dört bölüm (Görünüş · Katmanlar · Uygunluk ·
  // Etkileşim), tam ekran çizimin altında ayrı eylem satırında.
  test('tek kategori: çizim + gösterge + işaretlerin föyü; açı yazısı, bölümler ve sağ sütun yok', () => {
    yukle('tulga');
    const d = dom(pencere());
    expect([...d.querySelectorAll('#ve-fp-panes-d2 > .ve-fp-kat')].map((x) => x.getAttribute('aria-label'))).toEqual(['Aksonometrik']);
    expect(d.querySelector('.ve-fp-tab')).toBeNull();
    expect(d.querySelector('.ve-fp-side')).toBeNull();
    expect(d.querySelector('.ve-fp-split.ve-fp-split--tek')).not.toBeNull();
    const p = d.querySelector('#ve-fp-panes-d2 > [data-k="akso"]');
    expect(p.querySelectorAll('svg.ve-mnt2d-akso').length).toBe(1);
    expect(p.querySelector('#ve-mnt-akso3b-d2')).not.toBeNull();        // serbest kameranın kabı
    expect(p.querySelector('.ve-mnt-ak-lej')).not.toBeNull();
    expect([...d.querySelectorAll('.ve-fp-sect b')].map((b) => b.textContent)).toEqual(['İşaretler']);
    expect([...p.querySelectorAll('tbody tr td:first-child')].map((t) => t.textContent))
      .toEqual(['G', '1', '2', '3', '4', '5', '6', '7', '8', 'T1', 'T2', 'T3', 'T4', 'T5']);
    // başlık: bakışın adı, açısı değil; etkileşimin dili adın ipucunda
    const ad = p.querySelector('[data-ak3b-ad]');
    expect([ad.textContent, ad.getAttribute('title')]).toEqual(['Dimetrik', IPUCU]);
    expect(p.querySelector('[data-ak3b-aci]')).toBeNull();
    expect(d.textContent).not.toMatch(/yükseliş|azimut/i);
    // eski denetimler: hazır bakış ve katman düğmeleri, mod listesi, ipucu ve eylem satırı
    ['.mnt-vwr-toggle', '.ve-mnt-ak-gor', '.ve-mnt-ak-mod', '.ve-mnt-ak-alt', '.ve-mnt-ak-ipucu', '.ve-mnt-ipucu', '.ve-fp-eylem']
      .forEach((x) => expect({ x, n: d.querySelectorAll(x).length }).toEqual({ x, n: 0 }));
    expect(d.innerHTML).not.toMatch(/veMntAksoAyar\('[^']*','(on|kat|mod|oynat)'/);
  });

  test('tam ekran düğmesi çizimin başlığında, görünüm düğmelerinin yanında; tam ekranın kendisinde yok', () => {
    yukle('tulga');
    const d = dom(pencere());
    const dg = [...d.querySelectorAll('.ve-mnt-akso3b > .ve-mnt-kroki-bas .ve-mnt2d-zoomctl button')];
    expect(dg.map((b) => b.getAttribute('aria-label'))).toEqual(['Yakınlaştır', 'Uzaklaştır', 'Sıfırla — dimetrik bakış', 'Tam ekran']);
    expect(dg[3].getAttribute('onclick')).toBe('veMntAkso3BTamEkran()');
    const tam = dom(cp._mntAksoHTML(cp._mnt2DPencereVeri(), 1200, true, 've-mnt-akso3b-fs'));
    expect([...tam.querySelectorAll('.ve-mnt2d-zoomctl button')].map((b) => b.getAttribute('aria-label')))
      .toEqual(['Yakınlaştır', 'Uzaklaştır', 'Sıfırla — dimetrik bakış']);
    expect(tam.querySelectorAll('.mnt-vwr-toggle, .ve-mnt-ak-bar, .ve-mnt-ak-ipucu, .ve-fp-not').length).toBe(0);
  });

  // "TÜM BİLEŞENLERİN İÇİNDE sonuç ile alakalı bir bilgi … olmayacak": çizim
  // çözümden sonra birebir aynı; sonuç katmanlarının hiçbir sınıfı yok.
  test('çizim sonuç göstermez: çözümden önce ve sonra birebir aynı; tercih yalnız açı', () => {
    yukle('tulga');
    const once = pencere();
    coz();
    expect(pencere()).toBe(once);
    ['ve-ak-kv-', 've-ak-cokme', 've-ak-hayalet', 've-ak-rj', 've-ak-as-', 've-ak-direk', 've-ak-d-', 'Statik yük', 'sehim']
      .forEach((x) => expect({ x, var: once.includes(x) }).toEqual({ x, var: false }));
    expect(Object.keys(cp.VE_MNT_AKSO3B).sort()).toEqual(['az', 'el']);
  });

  test('denetim modeli değiştirmez, tarayıcıya yalnız açıyı yazar; Sıfırla dimetrik bakışa ve yakınlığa döner', () => {
    yukle('tulga');
    localStorage.removeItem('ve-mnt-akso3b');
    const kap = document.createElement('div');
    kap.id = 've-mnt-akso3b-d9';
    Object.defineProperty(kap, 'clientWidth', { value: 356 });
    document.body.appendChild(kap);
    const A = cp.VE_MNT_AKSO3B, yedek = JSON.parse(JSON.stringify(A));
    const once = JSON.stringify(global.nodes.map((n) => n.data));
    const svg = () => kap.querySelector('svg.ve-mnt2d-akso').outerHTML;
    try {
      expect(cp.veMntAksoAyar(kap.id, 'sifirla')).toBe(true);
      const dim = svg();
      cp.veMntAksoAyar(kap.id, 'yakin', 'in');
      expect(svg()).not.toBe(dim);
      cp.veMntAksoAyar(kap.id, 'on', 'iso');
      expect(kap.querySelector('[data-ak3b-ad]').textContent).toBe('İzometrik');
      expect(kap.textContent).not.toMatch(/yükseliş|azimut/i);
      cp.veMntAksoAyar(kap.id, 'sifirla');
      expect(svg()).toBe(dim);
      expect(kap.querySelector('[data-ak3b-ad]').textContent).toBe('Dimetrik');
      expect(stubs.saveState).not.toHaveBeenCalled();
      expect(JSON.stringify(global.nodes.map((n) => n.data))).toBe(once);
      expect(Object.keys(JSON.parse(localStorage.getItem('ve-mnt-akso3b'))).sort()).toEqual(['az', 'el']);
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

  test('görünüş sabit: pencerenin tercihi (arkadan-alttan açı, katmanlar) raporu değiştirmez', () => {
    yukle('siper'); coz();
    const once = sekil(rapor());
    // Tarayıcıda pencerenin tercihi bir GLOBAL — rapor onu görebilir; Node'da
    // da görsün ki kapı ölçsün.
    const A = global.VE_MNT_AKSO3B = cp.VE_MNT_AKSO3B, yedek = Object.assign({}, A);
    Object.assign(A, { az: 45, el: -30, rijit: true, kuvvet: true, mod: true, duvar: true });
    try { expect(sekil(rapor())).toBe(once); } finally { Object.assign(A, yedek); delete global.VE_MNT_AKSO3B; }
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

// Adım 3 (2026-10-16): aynı çizicinin SERBEST kamerası — kullanıcı: "bunu 3B
// tarzında da yapacağız, o zaman 3B görüntüleyiciye gerek kalmayacak"; aynı
// gün Görünümler'in TEK çizimi oldu. Kapılar: hazır bakışın açısı o
// izdüşümün kendisi; sığdırma dönmeden bağımsız (döndürürken çizim büyüyüp
// küçülmez); tekerlek imlecin altındaki noktayı tutar; model eli izler;
// her açıda yazı kuralları (pencerenin işaret boyuyla).
describe('SERBEST KAMERA — Görünümler', () => {
  const sayilar = (svg) => (svg.replace(/aria-label="[^"]*"/, '').match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
  test('hazır bakışın açısı o izdüşümün kendisi: iki izdüşüm × sekiz bakışta aynı çizim', () => {
    yukle('tulga');
    const m = cp._mntAksoModel();
    ['dim', 'iso'].forEach((iz) => BAKIS.forEach((b) => {
      const a = AK.kamAci(iz, b);
      const s1 = sayilar(AK.ciz(m, { W: 354, iz, b, kat: { golge: true }, fs: FS }).svg);
      const s2 = sayilar(AK.ciz(m, { W: 354, kam: a, kat: { golge: true }, fs: FS }).svg);
      expect(s2.length).toBe(s1.length);
      const fark = Math.max(...s1.map((v, i) => Math.abs(v - s2[i])));
      expect({ iz, b, fark: fark < 0.02 }).toEqual({ iz, b, fark: true });
    }));
    // dimetrik önden-soldan-yukarıdan = az 249,3° · yükseliş 19,5°
    const d = AK.kamAci('dim', { x: -1, y: -1, z: 1 });
    expect([+d.az.toFixed(1), +d.el.toFixed(2)]).toEqual([249.3, 19.47]);   // makine: test karşılaştırması
  });

  test('küre sığdırması dönmeden bağımsız: ölçek her açıda aynı, modelin merkezi çizimin ortasında', () => {
    Object.keys(ORNEK).forEach((k) => {
      yukle(k);
      const m = cp._mntAksoModel(), sc = [], mrk = [];
      for (let az = 0; az < 360; az += 30) [-60, -20, 0, 20, 60, 88].forEach((el) => {
        const r = AK.ciz(m, { W: 354, H: 326, kam: { az, el }, kure: true, kat: { golge: true }, fs: FS });
        sc.push(r.sc); mrk.push(r.F.kure.join(','));
      });
      expect({ k, oran: Math.max(...sc) / Math.min(...sc) - 1 < 1e-12 }).toEqual({ k, oran: true });
      expect(new Set(mrk).size).toBe(1);
    });
  });

  test('yakınlık ölçeği çarpar, kaydırma çizimi kaydırır; tekerlek imlecin altındaki noktayı tutar', () => {
    yukle('asfat');
    const m = cp._mntAksoModel(), kam = { az: 230, el: 25 };
    const o = (y, kay) => ({ W: 354, H: 326, kam, kure: true, yakin: y, kay, kat: { golge: true }, fs: FS });
    const K = AK.kamera('dim', { x: -1, y: -1, z: 1 }, AK.kamYon(kam));
    const ekran = (F, p) => { const q = K.P(p); return [F.ox + q[0] * F.sc, F.oy + q[1] * F.sc]; };
    const G = [m.G.x, m.G.y, m.G.z];
    const F1 = AK.ciz(m, o(1, [0, 0])).F, F2 = AK.ciz(m, o(2, [10, -5])).F;
    expect(F2.sc / F1.sc).toBeCloseTo(2, 12);
    const g1 = ekran(F1, G), g2 = ekran(F2, G), c = F1.kure;
    expect(g2[0] - (c[0] + 10)).toBeCloseTo(2 * (g1[0] - c[0]), 9);
    expect(g2[1] - (c[1] - 5)).toBeCloseTo(2 * (g1[1] - c[1]), 9);
    // tekerlek: imleç bir takozun üstünde; üç tık sonra takoz aynı yerde
    const t = m.takoz[2], p = [t.x, t.y, t.z];
    let Gs = { yakin: 1, kay: [0, 0] }, F = F1;
    const imlec = ekran(F1, p);
    for (let i = 0; i < 3; i++) { Gs = cp._mntAkso3bYakinlas(Gs, 1.15, imlec, F.kure); F = AK.ciz(m, o(Gs.yakin, Gs.kay)).F; }
    expect(Gs.yakin).toBeCloseTo(Math.pow(1.15, 3), 12);
    const son = ekran(F, p);
    expect(Math.hypot(son[0] - imlec[0], son[1] - imlec[1])).toBeLessThan(1e-9);
  });

  // Ölçüldü (gerçek tarayıcı): yazısız karede üst pay 14, yazılıda 34 px'ti —
  // bırakınca çizim 10 px zıplıyor, tekerleğin merkezi kayıyordu (3 tıkta 3 px).
  test('yazısız kare (sürüklerken) yazılı kareyle aynı yerde: serbest kamerada pay yazıdan bağımsız', () => {
    yukle('tulga');
    const m = cp._mntAksoModel(), o = { W: 354, H: 326, kam: { az: 230, el: 25 }, kure: true, kat: { golge: true }, fs: FS };
    const F1 = AK.ciz(m, Object.assign({}, o, { etiket: 'ad' })).F, F2 = AK.ciz(m, Object.assign({}, o, { etiket: 'yok' })).F;
    expect([F2.sc, F2.ox, F2.oy, F2.kure]).toEqual([F1.sc, F1.ox, F1.oy, F1.kure]);
  });

  test('model eli izler: sağa çekmek azimutu azaltır, aşağı çekmek yükselişi artırır; ±88° ve 360° sınırı', () => {
    const d = cp._mntAkso3bDondur({ az: 249.3, el: 19.5 }, 80, 0);
    expect([d.az, d.el]).toEqual([expect.closeTo(209.3, 9), 19.5]);
    expect(cp._mntAkso3bDondur({ az: 10, el: 80 }, 40, 40)).toEqual({ az: 350, el: 88 });
    expect(cp._mntAkso3bDondur({ az: 350, el: -80 }, -40, -40)).toEqual({ az: 10, el: -88 });
    // sağa çekince modelin önü (−X yüzü) izleyiciye döner: önden bakış yaklaşır
    const once = AK.kamYon({ az: 249.3, el: 19.5 }), sonra = AK.kamYon(cp._mntAkso3bDondur({ az: 249.3, el: 19.5 }, 80, 0));
    expect(sonra[0]).toBeLessThan(once[0]);
  });

  test('yakınlaşmış çizimde dışarıda kalan işaretin yazısı basılmaz', () => {
    yukle('siper');
    const m = cp._mntAksoModel();
    const r = AK.ciz(m, { W: 354, H: 326, kam: { az: 249.3, el: 19.5 }, kure: true, yakin: 5, kay: [140, 0], kat: { golge: true }, fs: FS });
    expect(r.etiket.length).toBeGreaterThan(0);
    r.etiket.forEach((e) => { expect(e.x >= 0 && e.x <= 354 && e.y >= 0 && e.y <= r.H).toBe(true); });
    const tumu = AK.ciz(m, { W: 354, H: 326, kam: { az: 249.3, el: 19.5 }, kure: true, kat: { golge: true }, fs: FS });
    expect(r.etiket.length).toBeLessThan(tumu.etiket.length);
  });

  test('her açıda yazı kuralları: üç örnek × sekiz azimut × dört yükseliş × dört katman (pencerenin işaret boyuyla)', () => {
    const yazilar = (svg) => [...svg.matchAll(/<text([^>]*)>([^<]*)<\/text>/g)].map((mt) => {
      const a = (n) => { const q = new RegExp(' ' + n + '="([^"]*)"').exec(mt[1]); return q ? q[1] : null; };
      const px = Number(a('font-size')), x = Number(a('x')), y = Number(a('y')), an = a('text-anchor') || 'start';
      const w = AK.tahmin(mt[2], px, a('font-weight') === '600'), l = an === 'middle' ? x - w / 2 : (an === 'end' ? x - w : x);
      return { t: mt[2], px, k: { l, r: l + w, t: y - px * 0.82, b: y + px * 0.26 } };
    });
    const kesis = (a, b) => Math.min(a.r, b.r) - Math.max(a.l, b.l) > 0.5 && Math.min(a.b, b.b) - Math.max(a.t, b.t) > 0.5;
    const sorun = [];
    Object.keys(ORNEK).forEach((k) => {
      yukle(k);
      const m = cp.veMntAksoCozumModel(coz());
      for (let az = 0; az < 360; az += 45) [-35, 10, 35, 70].forEach((el) => [
        ['temel', {}, 'golge'], ['direk', { direk: true }, 'xray'], ['kuvvet', { kuvvet: true, cokme: true }, 'golge'], ['rijit', { rijit: true, asal: true }, 'xray'],
      ].forEach(([ad, kat, stil]) => {
        const svg = AK.ciz(m, { W: 354, H: 326, kam: { az, el }, kure: true, isaret: cp._mntAksoIsaret(354), stil, kat: Object.assign({ golge: true }, kat), fs: FS }).svg;
        const yer = `${k}/${az}/${el}/${ad}`;
        if (/NaN|undefined|Infinity/.test(svg)) sorun.push(yer + ' bozuk');
        const y = yazilar(svg);
        y.forEach((a) => { if (a.px < 10) sorun.push(`${yer}: küçük ${a.t}`); });
        for (let i = 0; i < y.length; i++) for (let j = i + 1; j < y.length; j++) if (kesis(y[i].k, y[j].k)) sorun.push(`${yer}: "${y[i].t}" ↔ "${y[j].t}"`);
        const sonra = svg.slice(svg.indexOf('<text'));
        if (/<(line|path|polyline|polygon|circle|ellipse)\b/.test(sonra)) sorun.push(yer + ': çizgi yazıdan sonra');
      }));
    });
    expect(sorun.slice(0, 10)).toEqual([]);
  });

  test('pencere: Görünümler\'in kabı serbest kamera; tercih tek, tarayıcıda ve modelde değil', () => {
    yukle('tulga'); coz();
    const h = cp.getMnt2DViewPropertiesHTML({ id: 'v3', type: 'mnt-2dview', data: {} });
    expect(h).toContain('id="ve-mnt-akso3b-v3"');
    expect(h).not.toContain('ve-mnt-inline-viewer-canvas');           // three.js sahnesi yok
    expect(h).toMatch(/<b data-ak3b-ad title="[^"]*">Dimetrik<\/b>/);
    // sabit bakışın tercihi emekli: ne dışa açılıyor ne okunuyor
    expect(cp.VE_MNT_AKSO).toBeUndefined();
    localStorage.removeItem('ve-mnt-akso3b');
    localStorage.removeItem('ve-mnt-akso');
    const kap = document.createElement('div');
    kap.id = 've-mnt-akso3b-v9';
    Object.defineProperty(kap, 'clientWidth', { value: 356 });
    document.body.appendChild(kap);
    const A3 = cp.VE_MNT_AKSO3B, y3 = JSON.parse(JSON.stringify(A3));
    const once = JSON.stringify(global.nodes.map((n) => n.data));
    try {
      expect(cp.veMntAksoAyar('ve-mnt-akso3b-v9', 'on', 'ust')).toBe(true);
      expect([A3.az, A3.el]).toEqual([270, 88]);
      expect(kap.innerHTML).toMatch(/<b data-ak3b-ad(="")?[^>]*>Üstten<\/b>/);
      expect(kap.innerHTML).toMatch(/<svg class="ve-mnt2d-akso" viewBox="0 0 354 \d+"[^>]*aria-label="Serbest bakış · /);
      expect(stubs.saveState).not.toHaveBeenCalled();
      expect(JSON.stringify(global.nodes.map((n) => n.data))).toBe(once);
      expect(JSON.parse(localStorage.getItem('ve-mnt-akso3b'))).toEqual({ az: 270, el: 88 });
      expect(localStorage.getItem('ve-mnt-akso')).toBeNull();
    } finally {
      Object.assign(A3, y3);
      kap.remove();
    }
  });
});

// İŞARET BOYU (kullanıcı 2026-10-16: "takoz ve bileşenlerin ağırlık
// merkezlerinin görünümü biraz ufak olmuş. Onları da büyültelim."). Ölçülen
// önce (pencere 354 px): takoz küpü 12 px, G 13 px, nokta kütle 4,8 px,
// gövde CG'si 9 px — işaret yazının boyundaydı. Kural: pencerede ×1,5; geniş
// çizimde √(W/354) ile en çok √2 kat daha; serbest kamerada √yakın
// (0,75–1,75). Ölçü olan büyümez; rapor ve karolar katsız.
describe('İŞARET BOYU — takoz, G, gövde CG\'si ve nokta kütle büyür; ölçü büyümez', () => {
  const olc = (svg) => {
    const d = document.createElement('div'); d.innerHTML = svg;
    const r = (el) => (el ? +el.getAttribute('r') : null);
    const gen = (g) => {
      if (!g) return null;
      const xs = [...g.querySelectorAll('path')].flatMap((p) => [...p.getAttribute('d').matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)].map((q) => +q[1]));
      return Math.max(...xs) - Math.min(...xs);
    };
    return { G: r(d.querySelector('.ve-ak-gam circle')), nokta: r(d.querySelector('circle.ve-ak-nokta')),
             amk: r(d.querySelector('.ve-ak-amk circle')), takoz: gen(d.querySelector('g.ve-ak-t')) };
  };
  const yakin = (a, b, k) => Math.abs(b / a - k) < 0.02 * k;

  test('katsayı: pencere (354 px) ×1,5; geniş çizimde √(W/354), en çok √2 kat daha; dar sütunda küçülmez', () => {
    expect(cp._mntAksoIsaret(354)).toBe(1.5);
    expect(cp._mntAksoIsaret(280)).toBe(1.5);
    expect(cp._mntAksoIsaret(500)).toBeCloseTo(1.5 * Math.sqrt(500 / 354), 12);
    expect(cp._mntAksoIsaret(708)).toBeCloseTo(1.5 * Math.SQRT2, 12);
    expect(cp._mntAksoIsaret(1700)).toBeCloseTo(1.5 * Math.SQRT2, 12);
  });

  test('dört işaret katla birlikte büyür (Tulga, x-ışını): G, nokta kütle, gövde CG\'si, takoz küpü', () => {
    yukle('tulga');
    const m = cp._mntAksoModel();
    const o = { W: 354, H: 326, kam: { az: 249.3, el: 19.5 }, kure: true, stil: 'xray', kat: { golge: true, direk: true }, fs: FS };
    const a = olc(AK.ciz(m, o).svg);
    expect([a.G, a.nokta, a.amk]).toEqual([6.5, 2.4, 2.6]);            // katsız: eski boy
    [1.5, cp._mntAksoIsaret(1200)].forEach((k) => {
      const b = olc(AK.ciz(m, Object.assign({}, o, { isaret: k })).svg);
      ['G', 'nokta', 'amk', 'takoz'].forEach((ad) => expect({ k, ad, oran: yakin(a[ad], b[ad], k) }).toEqual({ k, ad, oran: true }));
    });
  });

  test('yakınlaştırma √yakın kadar büyütür (0,75–1,75); sabit bakışta yakınlık işarete dokunmaz', () => {
    yukle('siper');
    const m = cp._mntAksoModel();
    const G = (o) => olc(AK.ciz(m, Object.assign({ W: 354, H: 326, kat: { golge: true }, fs: FS, isaret: 1.5 }, o)).svg).G;
    const kam = { kam: { az: 249.3, el: 19.5 }, kure: true };
    expect(G(Object.assign({ yakin: 1 }, kam))).toBe(9.8);             // 6,5 · 1,5
    expect(G(Object.assign({ yakin: 2 }, kam))).toBe(13.8);            // 6,5 · 1,5 · √2 = 13,79
    expect(G(Object.assign({ yakin: 8 }, kam))).toBe(17.1);            // tavan 1,75
    expect(G(Object.assign({ yakin: 0.4 }, kam))).toBe(7.3);           // taban 0,75
    expect(G({ iz: 'dim', b: { x: -1, y: -1, z: 1 }, yakin: 4 })).toBe(9.8);
  });

  test('ölçü büyümez: ağırlık ve tepki oklarının ekrandaki boyu katla aynı (aynı px/N)', () => {
    yukle('tulga');
    const m = cp.veMntAksoCozumModel(coz());
    const oklar = (k) => {
      const d = document.createElement('div');
      d.innerHTML = AK.ciz(m, { W: 354, H: 326, kam: { az: 249.3, el: 19.5 }, kure: true, isaret: k, kat: { golge: true, kuvvet: true }, fs: FS }).svg;
      return [...d.querySelectorAll('.ve-ak-kv-w line, .ve-ak-kv-r line')].map((l) => Math.hypot(l.getAttribute('x2') - l.getAttribute('x1'), l.getAttribute('y2') - l.getAttribute('y1')));
    };
    const a = oklar(1), b = oklar(2.2);
    expect(a.length).toBe(1 + m.takoz.length);
    a.forEach((v, i) => expect({ i, fark: Math.abs(v - b[i]) < 0.2 }).toEqual({ i, fark: true }));
  });

  test('rapor ve karolar katsız: çizimleri eski boyda (G r = 6,5)', () => {
    yukle('tulga'); coz();
    const R = cp.veMntSonucDurumu().R;
    expect(olc(AK.ciz(cp.veMntAksoCozumModel(R), rep._MNT_REP_AKSO_O).svg).G).toBe(6.5);
    expect(rep._MNT_REP_AKSO_O.isaret).toBeUndefined();
    const ex = core.getMountExampleList()[0];
    expect(olc(AK.ciz(cp.veMntAksoOrnekModel(ex.model), { W: 300, H: 200, sade: true }).svg).G).toBe(6.5);
  });

  test('büyüyen işaretle de yazı onları örtmez: takoz, G ve gövde CG\'si (üç örnek × dört açı × iki genişlik)', () => {
    const ihlal = [];
    Object.keys(ORNEK).forEach((k) => {
      yukle(k);
      const m = cp._mntAksoModel();
      [[230, 25], [300, 35], [160, 15], [249.3, 19.5]].forEach(([az, el]) => [[354, 'ad', 326], [1200, 'genis', 640]].forEach(([W, etiket, H]) => {
        const ik = cp._mntAksoIsaret(W);
        const r = AK.ciz(m, { W, H, kam: { az, el }, kure: true, isaret: ik, stil: 'xray', kat: { golge: true, direk: true }, etiket, fs: FS });
        const d = document.createElement('div'); d.innerHTML = r.svg;
        const isaret = [];
        d.querySelectorAll('.ve-ak-gam circle').forEach((c) => isaret.push([+c.getAttribute('cx'), +c.getAttribute('cy'), 6.5 * ik, 'G']));
        d.querySelectorAll('.ve-ak-amk circle').forEach((c) => isaret.push([+c.getAttribute('cx'), +c.getAttribute('cy'), 4.5 * ik, 'CG']));
        m.takoz.forEach((t) => { const g = d.querySelector('g.ve-ak-t[data-ak="' + t.k + '"]'); if (!g) return;
          const xy = [...g.innerHTML.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)].map((q) => [+q[1], +q[2]]);
          const xs = xy.map((p) => p[0]), ys = xy.map((p) => p[1]);
          isaret.push([(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2, (Math.max(...xs) - Math.min(...xs)) / 2, t.no]); });
        r.etiket.forEach((e) => isaret.forEach(([x, y, h, ad]) => {
          const b = e.kutu;
          if (b.l < x + h && b.r > x - h && b.t < y + h && b.b > y - h) ihlal.push(`${k} ${az}/${el} ${W}: "${e.m1}" ↔ ${ad}`);
        }));
      }));
    });
    expect(ihlal).toEqual([]);
  });
});

// KLASİK 3B YALNIZ AD (kullanıcı kararı 2026-10-16: "Klasik 3B'yi kaldıralım …
// sadece isim olarak kalabilir, ama içeriğini kaldıralım" — ilerleyen zamanda
// gerçek CAD dosyasıyla işlenecek). Ölçüldü (main 2f43cda): pencere açılınca
// 1 WebGL bağlamı kuruluyordu, her tazelemede bir yenisi; pencerede 1 tuval + 6
// düğme + gösterge vardı. Aynı gün aksonometri Görünümler'e taşındı: 3D
// YAPIŞKAN YER (kullanıcı 2026-10-16: "'Görünümler' bileşeninde aksonometrik
// görüntüyü oynatırken görüntünün üzerindeki yazılar kayboluyor … kaybolmasın.
// Beraber dönsünler."). Sürüklerken hızlı kare YAZISIZ çiziliyordu (Tulga'da
// 15 yazının 12'si yoktu). Yazılı karede her kare yeniden yerleşince yazı
// kareden kareye sıçrıyordu: 2°'lik adımda yazıların %7–15'i 10 px'ten çok
// (en çok 320 px). Yazı bir önceki karenin yerini, yeri kapanmadıkça korur.
describe('YAPIŞKAN YER — döndürürken yazılar işaretiyle yürür', () => {
  const tur = (m, W, yapis) => {
    const o = { W, H: W > 600 ? 760 : 326, stil: 'golge', kat: { golge: true }, etiket: W > 600 ? 'genis' : 'ad', fs: FS, kure: true, isaret: cp._mntAksoIsaret(W) };
    let onceki = null, yer = null, n = 0, sicra = 0, binen = 0, disari = 0;
    for (let az = 0; az <= 180; az += 2) {
      const r = AK.ciz(m, Object.assign({}, o, { kam: { az, el: 20 }, yer: yapis ? yer : null }));
      yer = r.yer;
      const simdi = {};
      r.etiket.forEach((e) => { simdi[e.k + '|' + (e.sinif || '')] = [(e.kutu.l + e.kutu.r) / 2 - e.x, (e.kutu.t + e.kutu.b) / 2 - e.y]; });
      if (onceki) Object.keys(simdi).forEach((k) => { if (!onceki[k]) return; n++; if (Math.hypot(simdi[k][0] - onceki[k][0], simdi[k][1] - onceki[k][1]) > 10) sicra++; });
      onceki = simdi;
      const K = r.etiket.map((e) => e.kutu);
      K.forEach((a) => { if (a.l < 2.5 || a.t < 2.5 || a.r > W - 2.5 || a.b > r.H - 2.5) disari++; });
      for (let i = 0; i < K.length; i++) for (let j = i + 1; j < K.length; j++)
        if (Math.min(K[i].r, K[j].r) - Math.max(K[i].l, K[j].l) > 0.5 && Math.min(K[i].b, K[j].b) - Math.max(K[i].t, K[j].t) > 0.5) binen++;
    }
    return { oran: sicra / n, binen, disari };
  };
  test('üç örnek, pencere ve tam ekran genişliği: sıçrama en az yarıya iner ve %4\'ün altında; yazı yazıya binmez', () => {
    const sorun = [];
    Object.keys(ORNEK).forEach((k) => {
      yukle(k);
      const m = cp._mntAksoModel();
      [354, 1500].forEach((W) => {
        const a = tur(m, W, false), b = tur(m, W, true), yer = k + '@' + W;
        if (!(b.oran <= 0.04)) sorun.push(`${yer}: yapışkan %${(b.oran * 100).toFixed(1)}`);
        if (!(b.oran <= a.oran / 2)) sorun.push(`${yer}: %${(a.oran * 100).toFixed(1)} → %${(b.oran * 100).toFixed(1)} (yarısı değil)`);
        if (b.binen > a.binen) sorun.push(`${yer}: binen ${a.binen} → ${b.binen}`);
        if (b.disari) sorun.push(`${yer}: çizimin dışında ${b.disari}`);
      });
    });
    expect(sorun).toEqual([]);
  });
  test('verilmezse birebir eski: yer verilmeyen çizim yer:null ile aynı; çizici her çizimde yazıların yerini döndürür', () => {
    yukle('tulga');
    const m = cp._mntAksoModel(), o = { W: 354, H: 326, kam: { az: 230, el: 25 }, kure: true, kat: { golge: true }, fs: FS };
    const r = AK.ciz(m, o);
    expect(AK.ciz(m, Object.assign({}, o, { yer: null })).svg).toBe(r.svg);
    expect(Object.keys(r.yer).length).toBe(r.etiket.length);
    // aynı kamerada kendi yeriyle çizilen kare birebir aynı (bırakınca zıplamaz)
    expect(AK.ciz(m, Object.assign({}, o, { yer: r.yer })).svg).toBe(r.svg);
  });
});

// PERDE (kullanıcı 2026-10-16): föyün satırı — "o parçaya geldiğimde aydınlık
// olsun, diğer parçalar gölgeye düşsün" — ve bileşen pencerelerinin "Güç
// grubundaki yeri" — "Bileşene göre parçayı belirgin gösterecek". Model,
// yazıları ve kılavuzları perdenin ALTINDA; seçilinin gövdesi, halkası ve adı
// ÜSTÜNDE. Üstte çizilen kenar ve halka hiçbir yazının içinden geçmez.
describe('PERDE — parça aydınlık, kalan model gölgede', () => {
  const ac = (m) => [...m.govde.map((g) => g.k), ...m.takoz.map((t) => t.k), 'G'];
  const parca = (svg) => {
    const a = svg.indexOf('<rect class="ve-ak-perde"'), b = svg.indexOf('<g class="ve-ak-odak">');
    return { alt: svg.slice(0, a), odak: b >= 0 ? svg.slice(b) : '', a, b };
  };
  test('perde seçiliden hemen önce, odak en üstte; odakta YALNIZ seçilinin gövdesi, halkası ve adı', () => {
    const sorun = [];
    Object.keys(ORNEK).forEach((k) => {
      yukle(k);
      const m = cp._mntAksoModel();
      ac(m).forEach((sec) => {
        const svg = AK.ciz(m, { W: 296, H: 280, kam: { az: 249.3, el: 19.5 }, kure: true, kat: { golge: true }, fs: FS, etiket: 'ad', secili: sec, perde: true }).svg;
        const p = parca(svg), yer = k + '/' + sec;
        if (p.a < 0 || p.b < 0) { sorun.push(yer + ': perde ya da odak yok'); return; }
        if (!/^<rect class="ve-ak-perde"[^>]*\/><g class="ve-ak-odak">/.test(svg.slice(p.a))) sorun.push(yer + ': odak perdenin hemen ardında değil');
        if (!p.odak.endsWith('</g></svg>')) sorun.push(yer + ': odak en üstte değil');
        const odakAk = new Set([...p.odak.matchAll(/data-ak="([^"]+)"/g)].map((x) => x[1]));
        if (odakAk.size !== 1 || !odakAk.has(sec)) sorun.push(yer + ': odakta ' + [...odakAk].join(','));
        if (!/ve-ak-sec-hale/.test(p.odak) && (sec[0] === 'T' || sec === 'G' || !m.govde.find((g) => g.k === sec).kutu)) sorun.push(yer + ': halka yok');
        if (sec !== 'G' && !/sec-cip/.test(p.odak)) sorun.push(yer + ': adı çipte değil');
        if (/ve-ak-kilavuz/.test(p.odak)) sorun.push(yer + ': kılavuz perdenin üstünde');
        if (/ve-ak-gol"/.test(p.odak)) sorun.push(yer + ': zemindeki iz perdenin üstünde');
      });
    });
    expect(sorun).toEqual([]);
  });
  test('perde yokken (o.secili tek başına) çizim eskisi gibi: halka hareket katmanında, perde ve odak grubu yok', () => {
    yukle('tulga');
    const m = cp._mntAksoModel();
    const svg = AK.ciz(m, { W: 296, iz: 'dim', b: { x: -1, y: -1, z: 1 }, kat: { golge: true }, fs: FS, etiket: 'secili', secili: 'T1' }).svg;
    expect(svg).not.toMatch(/ve-ak-perde|ve-ak-odak/);
    expect(svg).toMatch(/<circle class="ve-ak-sec-hale"[^>]*\/><!--hs--><\/g>/);
  });
  test('üstte çizilen kenar ve halka hiçbir yazının içinden geçmez: üç örnek × her işaret × altı açı × iki genişlik', () => {
    const yazilar = (svg) => [...svg.matchAll(/<text([^>]*)>([^<]*)<\/text>/g)].map((mt) => {
      const a = (n) => { const q = new RegExp(' ' + n + '="([^"]*)"').exec(mt[1]); return q ? q[1] : null; };
      const px = Number(a('font-size')), x = Number(a('x')), y = Number(a('y')), an = a('text-anchor') || 'start';
      const w = AK.tahmin(mt[2], px, a('font-weight') === '600'), l = an === 'middle' ? x - w / 2 : (an === 'end' ? x - w : x);
      return { t: mt[2], l, r: l + w, ust: y - px * 0.82, alt: y + px * 0.26 };
    });
    // odaktaki çizgilerin kutusu: yolların noktaları ve halkanın çemberi (dolgulu çip hariç)
    const kutu = (odak) => {
      const sekil = odak.replace(/<g class="ve-ak-cip[\s\S]*?<\/g>/g, '');
      const pts = [];
      // yol: M/L çift, H x, V y, A yedi sayı (son ikisi uç; yarıçap kadar pay)
      [...sekil.matchAll(/ d="([^"]+)"/g)].forEach((d) => {
        const tk = d[1].match(/[MLHVAZ]|-?[\d.]+/g); let c = '', x = 0, y = 0;
        for (let i = 0; i < tk.length;) {
          if (/[MLHVAZ]/.test(tk[i])) { c = tk[i++]; continue; }
          if (c === 'H') { x = +tk[i++]; pts.push([x, y]); } else if (c === 'V') { y = +tk[i++]; pts.push([x, y]); } else if (c === 'A') {
            const r = Math.max(+tk[i], +tk[i + 1]); x = +tk[i + 5]; y = +tk[i + 6]; i += 7; pts.push([x - r, y - r], [x + r, y + r]);
          } else { x = +tk[i]; y = +tk[i + 1]; i += 2; pts.push([x, y]); }
        }
      });
      [...sekil.matchAll(/<line[^>]* x1="([\d.-]+)" y1="([\d.-]+)" x2="([\d.-]+)" y2="([\d.-]+)"/g)].forEach((l) => pts.push([+l[1], +l[2]], [+l[3], +l[4]]));
      [...sekil.matchAll(/<circle[^>]* cx="([\d.-]+)" cy="([\d.-]+)" r="([\d.]+)"/g)].forEach((c) => { const x = +c[1], y = +c[2], r = +c[3] + 1; pts.push([x - r, y - r], [x + r, y + r]); });
      return { l: Math.min(...pts.map((p) => p[0])), r: Math.max(...pts.map((p) => p[0])), ust: Math.min(...pts.map((p) => p[1])), alt: Math.max(...pts.map((p) => p[1])) };
    };
    const sorun = [];
    Object.keys(ORNEK).forEach((k) => {
      yukle(k);
      const m = cp._mntAksoModel();
      ac(m).forEach((sec) => [[249.3, 19.5], [200, 30], [300, 10], [120, 45], [30, -20], [270, 88]].forEach(([az, el]) => [296, 354].forEach((W) => {
        const svg = AK.ciz(m, { W, H: Math.round(Math.max(280, Math.min(460, W * 0.92))), kam: { az, el }, kure: true, isaret: cp._mntAksoIsaret(W), kat: { golge: true }, fs: FS, etiket: 'ad', secili: sec, perde: true }).svg;
        const p = parca(svg), K = kutu(p.odak);
        yazilar(p.alt).forEach((y) => {
          const x = Math.min(y.r, K.r) - Math.max(y.l, K.l), h = Math.min(y.alt, K.alt) - Math.max(y.ust, K.ust);
          if (x > 0.5 && h > 0.5) sorun.push(`${k}/${sec}/${az}/${el}/${W}: "${y.t}"`);
        });
      })));
    });
    expect(sorun.slice(0, 10)).toEqual([]);
  });
  test('perde altında çizimin yazıları AA (4,5:1): iki temada, perdenin koyuluğu CSS\'ten', () => {
    const css = fs.readFileSync(path.join(KOK, 'css/styles.css'), 'utf8');
    const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
    const lum = (c) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
    const oran = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
    const scrim = /--scrim:\s*rgba\(0,\s*0,\s*0,\s*([\d.]+)\)/.exec(css);
    const pay = /\.ve-ak-perde\{\s*fill:color-mix\(in srgb, var\(--scrim\) (\d+)%, transparent\)/.exec(css);
    expect(scrim && pay).toBeTruthy();
    const alfa = Number(scrim[1]) * Number(pay[1]) / 100, kar = (c) => c.map((v) => v * (1 - alfa));
    // çizimin yazı renkleri: ad ve çip yazısı, ikincil (kütle, eksen adı); zemin çizimin zemini (hâle, çip)
    expect(css).toMatch(/\.ve-ak-yz\{ fill:var\(--text-primary\); \}/);
    expect(css).toMatch(/\.ve-ak-yz\.ikincil, \.ve-ak-yz\.ve-ak-eksy\{ fill:var\(--text-secondary\); \}/);
    expect(css).toMatch(/\.ve-ak-cip text\{ fill:var\(--text-heading\); \}/);
    const sorun = [];
    [['acik', /:root, \[data-theme="acik"\]\s*\{([^}]*)\}/], ['koyu', /\[data-theme="koyu"\]\s*\{([^}]*)\}/]].forEach(([ad, re]) => {
      const blok = re.exec(css)[1], v = (n) => hex(new RegExp('--' + n + ':\\s*(#[0-9a-fA-F]{6})').exec(blok)[1]);
      const zem = kar(v('bg-input'));
      ['text-primary', 'text-secondary', 'text-heading'].forEach((t) => {
        const o = oran(kar(v(t)), zem);
        if (o < 4.5) sorun.push(`${ad}: ${t} ${o.toFixed(2)}:1`);
      });
    });
    expect(sorun).toEqual([]);
  });
  test('her kipte seçili ADIYLA, vurgu kenarlı çipte — ana olmayan gövde (braket) de; adın düz yazısı yok', () => {
    yukle('tulga');
    const m = cp._mntAksoModel(), br = m.govde.find((g) => !g.ana && !g.kutu);
    ['ad', 'genis'].forEach((etiket) => {
      const W = etiket === 'genis' ? 1200 : 354;
      const r = AK.ciz(m, { W, H: 326, kam: { az: 249.3, el: 19.5 }, kure: true, kat: { golge: true }, fs: FS, etiket, secili: br.k, perde: true });
      const e = r.etiket.filter((x) => x.k === br.k);
      expect(e.map((x) => [x.sinif, x.m1])).toEqual([['sec-cip', 'Braket']]);
      const t1 = AK.ciz(m, { W, H: 326, kam: { az: 249.3, el: 19.5 }, kure: true, kat: { golge: true }, fs: FS, etiket, secili: 'T1', perde: true });
      expect(t1.etiket.filter((x) => x.k === 'T1').map((x) => x.sinif)).toEqual(['t-cip sec-cip']);
    });
  });
});

// AYDINLIK (kullanıcı 2026-10-18: "isim aydınlık fakat parça da aydınlık
// olmalı"): seçili parçanın HER yüzü perdenin altındaki zeminden ve gölgedeki
// aynı tür parçanın her yüzünden açık — iki temada, renkler CSS'ten. Takozun
// kendi yeşili (en koyu yüz L 0,065) ve nokta kütlenin kahvesi (0,158)
// gölgedeki zeminden (0,408) koyuydu; gövde yalnız kendi tonuyla geçiyordu.
// Gerçek tarayıcıdaki hesaplanmış renk: mount-pencere.spec.js → Güç grubundaki yeri.
describe('AYDINLIK — seçili parça gölgedeki zeminden ve aynı tür parçadan açık', () => {
  const css = fs.readFileSync(path.join(KOK, 'css/styles.css'), 'utf8');
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const lum = (c) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
  const kural = (secici, oz) => {
    const m = new RegExp('(?:^|\\n)' + secici.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\{([^}]*)\\}').exec(css);
    if (!m) throw new Error('kural yok: ' + secici);
    const d = new RegExp('(?:^|[;\\s])' + oz + ':([^;]+);').exec(m[1]);
    if (!d) throw new Error(secici + ' → ' + oz + ' yok');
    return d[1].trim();
  };
  const renk = (blok, ifade) => {
    let m = /^var\(--([\w-]+)\)$/.exec(ifade);
    if (m) {
      const h = new RegExp('--' + m[1] + ':\\s*(#[0-9a-fA-F]{6})').exec(blok);
      if (!h) throw new Error('jeton yok: --' + m[1]);
      return hex(h[1]);
    }
    m = /^color-mix\(in srgb, (.+?) (\d+)%, (.+)\)$/.exec(ifade);
    if (m) { const a = renk(blok, m[1]), b = renk(blok, m[3]), p = Number(m[2]) / 100; return a.map((v, i) => v * p + b[i] * (1 - p)); }
    throw new Error('çözülemeyen renk: ' + ifade);
  };
  const scrim = /--scrim:\s*rgba\(0,\s*0,\s*0,\s*([\d.]+)\)/.exec(css);
  const pay = /\.ve-ak-perde\{\s*fill:color-mix\(in srgb, var\(--scrim\) (\d+)%, transparent\)/.exec(css);
  const alfa = Number(scrim[1]) * Number(pay[1]) / 100, kar = (c) => c.map((v) => v * (1 - alfa));
  const TUR = {
    'gövde': ['.ve-ak-g', ['.f-ust', '.f-y', '.f-x', '.f-alt']],
    'takoz': ['.ve-ak-t', ['.t-z', '.t-y', '.t-x']],
    'nokta kütle': ['.ve-ak-nokta', ['']],
  };
  test('iki temada her tür: seçilinin en koyu yüzü > gölgedeki zemin ve aynı türün en açık yüzü', () => {
    const sorun = [], olcu = [];
    [['acik', /:root, \[data-theme="acik"\]\s*\{([^}]*)\}/], ['koyu', /\[data-theme="koyu"\]\s*\{([^}]*)\}/]].forEach(([ad, re]) => {
      const blok = re.exec(css)[1];
      const zemin = lum(kar(renk(blok, kural('.ve-mnt-2d', 'background'))));
      Object.entries(TUR).forEach(([tur, [kok, yuzler]]) => {
        const isik = yuzler.map((y) => lum(renk(blok, kural(y ? kok + '[data-sec] ' + y : kok + '[data-sec]', 'fill'))));
        const golge = yuzler.map((y) => lum(kar(renk(blok, kural(y ? kok + ' ' + y : kok, 'fill')))));
        const esik = Math.max(zemin, ...golge), en = Math.min(...isik);
        olcu.push(`${ad}/${tur}: ${en.toFixed(3)} > ${esik.toFixed(3)}`);
        if (!(en > esik)) sorun.push(`${ad}/${tur}: en koyu yüz L ${en.toFixed(3)} ≤ gölgede ${esik.toFixed(3)}`);
      });
    });
    expect(olcu.length).toBe(6);
    expect(sorun).toEqual([]);
  });
  test('CSS\'in seçicisi çizimin işaretlemesine oturuyor: odakta seçili gövde, takoz ve nokta kütle data-sec ve yüz sınıflarıyla', () => {
    yukle('tulga');
    const m = cp._mntAksoModel(), br = m.govde.find((g) => !g.ana && !g.kutu), ana = m.govde.find((g) => g.ana);
    const odak = (k) => {
      const r = AK.ciz(m, { W: 354, H: 326, kam: { az: 249.3, el: 19.5 }, kure: true, kat: { golge: true }, fs: FS, etiket: 'ad', secili: k, perde: true });
      document.body.innerHTML = r.svg;
      return document.querySelector('.ve-ak-odak');
    };
    const g = odak(ana.k).querySelector('g.ve-ak-g[data-sec]');
    expect(g && [...g.querySelectorAll('path')].every((p) => /^f-(ust|alt|x|y)$/.test(p.getAttribute('class')))).toBe(true);
    const t = odak('T1').querySelector('g.ve-ak-t[data-sec]');
    expect(t && [...t.querySelectorAll('path')].map((p) => p.getAttribute('class')).sort()).toEqual(['t-x', 't-y', 't-z']);
    const n = odak(br.k).querySelector('circle.ve-ak-nokta[data-sec]');
    expect(n).toBeTruthy();
    // seçili nokta kütle büyük: aydınlık dolgusu vurgu kenarının içinde görünür
    const oteki = document.querySelector('circle.ve-ak-nokta:not([data-sec])');
    expect(Number(n.getAttribute('r'))).toBeGreaterThan(1.4 * Number(oteki.getAttribute('r')));
    document.body.innerHTML = '';
  });
});

// PENCERE (jsdom): sürüklerken çizilen kare YAZILI ve yapışkan; föyün satırı
// çizimdeki parçayı perdenin üstüne alır, satırdan çıkınca son çizim AYNEN
// geri gelir. Gerçek fare ve tam ekranın ölçüsü mount-pencere.spec.js'te.
describe('PENCERE — sürüklerken yazılı kare; föyün satırı çizimdeki parçayı aydınlatır', () => {
  const kur = (id) => {
    document.body.innerHTML = '<div class="ve-properties-content">' + cp.getMnt2DViewPropertiesHTML({ id, type: 'mnt-2dview', data: {} }) + '</div>';
    const kap = document.getElementById('ve-mnt-akso3b-' + id);
    Object.defineProperty(kap, 'clientWidth', { value: 356 });    // jsdom'da yerleşim yok: müfettiş sütunu
    return kap;
  };
  const yazi = (kap) => [...kap.querySelectorAll('svg.ve-mnt2d-akso text')].map((t) => t.textContent);
  afterEach(() => { cp.veMntAksoAyar('yok', 'sifirla'); document.body.innerHTML = ''; });

  test('Sıfırla yapışkan yerleri siler: tam tur sürüklendikten sonra çizim ilk açılıştakiyle BİREBİR', () => {
    yukle('tulga');
    const kap = kur('h0'), A = cp.VE_MNT_AKSO3B, sv = () => kap.querySelector('svg.ve-mnt2d-akso').outerHTML;
    cp.veMntAksoAyar(kap.id, 'sifirla');
    const ilk = sv(), az0 = A.az;
    for (let d = 4; d <= 360; d += 4) { A.az = (az0 + d) % 360; cp._mntAkso3bHizli(kap.id); }   // tam tur, yapışkan kareler
    const tur = sv();
    cp.veMntAksoAyar(kap.id, 'sifirla');
    expect(sv()).toBe(ilk);
    // tur yazıların yerini gerçekten değiştirmişti (yoksa kapı boşa ölçerdi)
    expect(tur).not.toBe(ilk);
  });

  test('hızlı kare tam çizimin yazılarını taşır (önce yalnız eksen adları kalıyordu); yazılar yapışkan', () => {
    yukle('tulga');
    const kap = kur('h1'), A = cp.VE_MNT_AKSO3B;
    const dinlenme = yazi(kap);
    expect(dinlenme.length).toBeGreaterThanOrEqual(15);
    A.az = (A.az + 6) % 360;                                       // 12 px sürükleme
    expect(cp._mntAkso3bHizli(kap.id)).toBe(true);
    expect(yazi(kap).sort()).toEqual(dinlenme.slice().sort());
    expect(kap.querySelector('svg.ve-mnt2d-akso').getAttribute('tabindex')).toBe('0');
    // bırakınca tam çizim aynı yerleri kullanır: zıplamaz
    const hizli = kap.querySelector('svg.ve-mnt2d-akso').outerHTML;
    expect(cp._mntAksoKur(kap.id, 354)).toBe(true);
    expect(kap.querySelector('svg.ve-mnt2d-akso').outerHTML).toBe(hizli);
  });

  test('föyün her satırı çizimdeki bir işaretin anahtarını taşır (G · gövdeler · takozlar)', () => {
    yukle('tulga');
    const kap = kur('h2');
    const satir = [...document.querySelectorAll('.ve-mnt-foy-odak tr[data-ak]')].map((tr) => tr.getAttribute('data-ak'));
    const m = cp._mntAksoModel();
    expect(satir).toEqual(['G', ...m.govde.map((g) => g.k), ...m.takoz.map((t) => t.k)]);
    satir.forEach((k) => expect({ k, var: !!kap.querySelector('svg [data-ak="' + k + '"]') }).toEqual({ k, var: true }));
  });

  test('satırın üstünde: parça perdenin üstünde, öteki işaretler altında; satırdan çıkınca son çizim AYNEN', () => {
    yukle('tulga');
    const kap = kur('h3'), sv = () => kap.querySelector('svg.ve-mnt2d-akso');
    const once = sv().outerHTML;
    const foy = document.querySelector('.ve-mnt-foy-odak'), tr = foy.querySelector('tr[data-ak="T3"]');
    cp._mntFoyOdak({ target: tr.querySelector('td:nth-child(2)') }, kap.id);
    const odak = sv().querySelector(':scope > g.ve-ak-odak');
    expect(sv().querySelector(':scope > rect.ve-ak-perde')).not.toBeNull();
    expect(new Set([...odak.querySelectorAll('[data-ak]')].map((e) => e.getAttribute('data-ak')))).toEqual(new Set(['T3']));
    expect(odak.querySelector('.sec-cip').textContent).toBe('T3 Sağ Arka Takoz');
    // aynı satırda gezinmek yeniden çizmez; başka satır başka parça
    const t3 = sv();
    cp._mntFoyOdak({ target: tr }, kap.id);
    expect(sv()).toBe(t3);
    cp._mntFoyOdak({ target: foy.querySelector('tr[data-ak="g2"] td') }, kap.id);
    expect(sv().querySelector('.ve-ak-odak .ve-ak-g[data-sec]').getAttribute('data-ak')).toBe('g2');
    // başlık satırı (anahtarsız) ve föyden çıkış: çizim birebir eski
    cp._mntFoyOdak({ target: foy.querySelector('thead th') }, kap.id);
    expect(sv().outerHTML).toBe(once);
    cp._mntAksoOdak(kap.id, 'G');
    cp._mntAksoOdak(kap.id, null);
    expect(sv().outerHTML).toBe(once);
    expect(stubs.saveState).not.toHaveBeenCalled();
  });
});

// Görüntüleyici bir YER TUTUCU — tek kategori, notu tipin beyanından.
describe('KLASİK 3B — 3D Görüntüleyici yer tutucu', () => {
  test('tek kategori "Klasik 3B"; gövdede tuval, düğme ve çizim yok, yalnız tipin notu', () => {
    yukle('tulga'); coz();
    const d = document.createElement('div');
    d.innerHTML = cp.getMntViewerPropertiesHTML({ id: 'v5', type: 'mnt-viewer', data: {} });
    expect([...d.querySelectorAll('#ve-fp-panes-v5 > .ve-fp-kat')].map((x) => x.getAttribute('aria-label'))).toEqual(['Klasik 3B']);
    const p = d.querySelector('#ve-fp-panes-v5 > [data-k="sahne"]');
    expect({ tuval: d.querySelectorAll('canvas').length, dugme: p.querySelectorAll('button').length, svg: d.querySelectorAll('svg').length })
      .toEqual({ tuval: 0, dugme: 0, svg: 0 });
    expect(p.textContent).toBe(componentDefs['mnt-viewer'].yerTutucu);
    expect(p.textContent).toMatch(/gerçek CAD dosyasıyla/i);
    expect(p.textContent).not.toMatch(/Görünümler|Bu bileşen/);    // durum söyler; yönlendirme ve kendini anlatma yok
    expect(d.innerHTML).not.toMatch(/veMountViewer|veMntViewerFullscreen|Sahne göstergesi|ve-mnt-akso|veMntAkso3BTamEkran/);
  });

  test('tazeleyicisi yok: açılışta hiçbir şey kurulmaz; Görünümler\'in tazelemesi three.js sahnesi kurmaz', () => {
    expect(cp.veMntViewerRefresh).toBeUndefined();
    const CORE = fs.readFileSync(path.join(KOK, 'js/cp-core.js'), 'utf8');
    expect(CORE).not.toMatch(/if\(node\.type === 'mnt-viewer'\) \{\s*setTimeout/);
    const init = jest.fn(), guncelle = jest.fn();
    global.veMountViewerInit = init; global.veMountViewerUpdate = guncelle;
    try {
      yukle('tulga'); coz();
      cp.veMnt2DViewRefresh();
      expect([init.mock.calls.length, guncelle.mock.calls.length]).toEqual([0, 0]);
    } finally {
      delete global.veMountViewerInit; delete global.veMountViewerUpdate;
    }
  });
});
