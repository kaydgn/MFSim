/**
 * mount-param-ciz.test.js — Parametrik Analiz · diyagramların DOM'suz çizicisi
 * ─────────────────────────────────────────────────────────────────────────
 * Kullanıcı kararı (2026-10-18): taramanın diyagramları Parametrik Analiz
 * penceresinin Sonuç kategorisinde (js/mount-param-ciz.js). Kapılar:
 *
 *   · YAZI — her diyagram, pencerenin (300 · 357 · 640 px) ve tam ekranın
 *     (1400 px) genişliğinde: bütün yazılar şekillerden SONRA ve hâleli
 *     (`.ve-pd-y`), boyu ≥ 9,5 px (alt simge hariç), tahmini kutularıyla iki
 *     yazı üst üste değil ve çizimin içinde; gövdede NaN · undefined ·
 *     Infinity yok. (Gerçek kutular: yerlesim.spec.js'in yüzey turu.)
 *   · BASAMAK — sınır duyarlılığının çizgisi her noktada sayımın kendisi
 *     (≤ üst sınır · ≥ alt sınır, eşitlik sağlıyor)
 *   · SINIR — kesit haritasının sınır çizgisi tam olarak hükmü ayrışan komşu
 *     hücrelerin arasında
 *   · 3B — dönerken ölçek değişmez (kübü çevreleyen küreden sığdırma): her
 *     açıda bütün köşeler ve noktalar çizimin içinde
 *   · SADE GRAFİKLER — Sonuç'un modlar şeridi ve statik sehim–iletilebilirlik
 *     çizimi: kırmızı çentik görünüm modelinin bayrağı, ok mevcuttan öneriye
 * Gerçek taramayla pencere: mount-param.test.js → SONUÇ.
 */
global.veSayi = require('../../js/sayi.js').veSayi;
global.veMntAkso = require('../../js/mount-akso.js');
const C = require('../../js/mount-param-ciz.js');

const FS = { k: 10, o: 11 };
const svgDom = (svg) => {
  const d = new DOMParser().parseFromString(svg, 'image/svg+xml');
  expect(d.querySelector('parsererror')).toBeNull();
  return d.documentElement;
};
// Kapının ölçüsü: çizicinin kendi kutu tahmini (gerçek kutu tarayıcıda).
function denetle(svg, W, ad) {
  const s = svgDom(svg), out = [];
  expect(svg).not.toMatch(/NaN|undefined|Infinity/);
  const hepsi = [...s.querySelectorAll('text, line, path, polyline, polygon, circle, ellipse, rect')];
  const ilkYazi = hepsi.findIndex((e) => e.tagName === 'text');
  const sonSekil = hepsi.map((e) => e.tagName).lastIndexOf(hepsi.filter((e) => e.tagName !== 'text').pop().tagName);
  if (ilkYazi >= 0 && hepsi.slice(ilkYazi).some((e) => e.tagName !== 'text')) out.push(ad + ': yazıdan sonra şekil');
  const H = Number(s.getAttribute('height'));
  const kutu = [];
  s.querySelectorAll('text').forEach((t) => {
    if (!/\bve-pd-y\b/.test(t.getAttribute('class') || '')) out.push(ad + ': hâlesiz yazı ' + t.textContent);
    const px = Number(t.getAttribute('font-size'));
    if (!(px >= 9.5)) out.push(ad + ': küçük yazı ' + px + ' ' + t.textContent);
    const ham = [...t.childNodes].map((n) => (n.nodeType === 3 ? n.nodeValue : '_' + n.textContent)).join('');
    const k = C.kutu(Number(t.getAttribute('x')), Number(t.getAttribute('y')), ham, px, t.getAttribute('text-anchor'), t.getAttribute('font-weight') === '600');
    if (k.l < 0 || k.r > W || k.t < 0 || k.b > H + 0.5) out.push(ad + ': çizim dışında ' + t.textContent);
    kutu.forEach((q) => { if (C.kesis(k, q.k)) out.push(ad + ': üst üste "' + t.textContent + '" ↔ "' + q.t + '"'); });
    kutu.push({ k, t: t.textContent });
  });
  expect(sonSekil).toBeGreaterThanOrEqual(0);
  return out;
}

// ── Sentetik görünüm modelleri (pencerenin kurduğu biçimde) ────────────────
let tohum = 11;
const rnd = () => { tohum = (tohum * 16807) % 2147483647; return tohum / 2147483647; };
const V11 = () => {
  const nokta = [];
  for (let i = 0; i < 900; i++) nokta.push({ x: 1 + 13 * rnd(), y: 4 + 60 * rnd() * rnd(), s: ['k', 'e', 'u'][i % 3], i });
  return { nokta, cephe: [{ x: 3.1, y: 15, i: 1 }, { x: 4.2, y: 11, i: 2 }, { x: 5.6, y: 8, i: 3 }],
    uzlasi: { x: 4.2, y: 11, i: 2, ad: 'Uzlaşı' }, mevcut: { x: 2, y: 22, ip: 'Mevcut tasarım' },
    biyik: [{ a: [4.6, 9.8], b: [3.8, 12.4], i: 2 }], e1: 3, e2: 5, k2: 50, xMax: 15, yMax: 70, dis: 4 };
};
const V7 = () => ({ satir: [
  { ad: 'Mevcut', f: [5.4, 6.6, 7.1, 9.9, 13.3, 19.2], dik: [false, false, true, true, false, false], ip: ['a', 'b', 'c', 'd', 'e', 'f'], kose: null },
  { ad: 'Uzlaşı', vurgu: true, f: [5.19, 7.87, 10.03, 10.83, 13.99, 14.6], dik: [false, true, false, false, false, true], ip: ['1', '2', '3', '4', '5', '6'],
    kose: { a: [4.79, 7.3, 9.3, 10, 13, 13.5], b: [5.6, 8.4, 10.7, 11.6, 15, 15.65] } },
  { ad: 'Yakın 1 · E3 · K1a …', f: [4.9, 5.2, 7.9, 10.2, 13.6, 14.7], dik: [false, true, false, false, false, true], ip: [], kose: null }],
  e3: 5, bant: [8, 10], k1: 15, k1a: 0.5, xMax: 21 });
const V9 = () => ({ kisit: [['K1', 'Modal bant', 18718, 792], ['K1a', 'Modlar arası ayrıklık', 7331, 7], ['K1b', 'Yaylandırılmamış kütle bandı', 14494, 14],
  ['K2', 'Rölanti iletilebilirliği', 220, 0], ['E1', 'Statik sehim, alt sınır', 2688, 0], ['E2', 'Statik sehim, üst sınır', 6121, 1],
  ['E8', 'Çekme', 10212, 0]].map((q) => ({ no: q[0], ad: q[1], red: q[2], tek: q[3], ip: q[0] })) });
const V10 = () => ({ panel: [
  { no: 'E1', ad: 'Statik sehim, alt sınır [mm]', kisa: 'δ_s alt [mm]', yon: 'alt', deger: [2.2, 3.4, 4.905], na: 0, sinir: 3, xMin: 1.7, xMax: 8.2 },
  { no: 'E2', ad: 'Statik sehim, üst sınır [mm]', kisa: 'δ_s üst [mm]', yon: 'ust', deger: [4.905, 5.06], na: 0, sinir: 5, xMin: 2.8, xMax: 8.2 },
  { no: 'E4', ad: 'Taşıma kapasitesi [%]', kisa: 'Kapasite [%]', yon: 'ust', deger: [62, 81, 99.5], na: 3, sinir: 100, xMin: 58, xMax: 165 }] });
const V8 = () => {
  const tip = [192, 300, 450, 640, 720, 800, 1150, 1150, 1280, 1350, 1530, 1900, 2300, 2500].map((kz) => ({ kz }));
  const seri = [1, 2, 3].map((no, j) => ({ no, ad: 'Grup ' + no, T: tip.map((t, i) => 8 + j * 5 + 30 * Math.exp(-i) + i * 0.6),
    d: tip.map((t, i) => 12 / (1 + i * 0.5) + j * 0.4), ok: tip.map((t, i) => i === 6 + j), i: tip.map((t, i) => i * 10 + j), uz: 6 + j }));
  return { tip, seri, k2: 50, e1: 3, e2: 5 };
};
const kesitV = (n) => {
  const kz = Array.from({ length: n }, (_, i) => 150 + i * 90);
  const gec = (f) => Uint8Array.from({ length: n * n }, (_, q) => (q % 17 === 0 ? 2 : f(q % n, Math.floor(q / n)) ? 1 : 0));
  return {
    n, kz, ix: Int32Array.from({ length: n * n }, (_, q) => q), uz: [Math.floor(n * 0.8), 2],
    panel: [{ ad: 'K1', say: 19, gec: gec((i, j) => i + j < 6) }, { ad: 'E2', say: 568, gec: gec((i) => i !== 3) },
      { ad: 'Hepsi', say: 1, gec: gec((i, j) => i === Math.floor(n * 0.8) && j === 2), hepsi: true }],
    T: Float64Array.from({ length: n * n }, (_, q) => (q % 17 === 0 ? NaN : 6 + (q % n) * 1.5 + Math.floor(q / n))),
    sinir: [{ ad: 'K1', s: 've-pd-b1', gec: gec((i, j) => i + j < 6) }, { ad: 'E2', s: 've-pd-b3', gec: gec((i) => i !== 3) }],
    kesin: gec((i, j) => i + j < 6), uygun: gec((i, j) => i === Math.floor(n * 0.8) && j === 2), xAd: '1 · k_z [N/mm]', yAd: '3 · k_z [N/mm]'
  };
};
// Sonuç'un iki sade grafiği (kullanıcı kararı 2026-10-18: "Tablo + iki sade grafik")
const VM = () => ({ satir: [
  { ad: 'Mevcut', f: [5.9, 6.6, 7.3, 11.3, 13.3, 19.2], kotu: [false, false, false, false, false, true], ip: ['a', 'b', 'c', 'd', 'e', 'f'], kose: null },
  { ad: 'Öneri', vurgu: true, f: [5.2, 7.87, 10.4, 10.8, 13.99, 14.6], kotu: [false, false, true, true, false, false], ip: [],
    kose: { a: [4.8, 7.3, 9.7, 10, 13, 13.5], b: [5.6, 8.4, 11.1, 11.6, 15, 15.65] } }],
  bolge: [[0, 5], [15, Infinity]], bant: [8, 10], k1a: 0.5, ozel: [15, 5], xMax: 21 });
const VD = () => ({ mevcut: { x: 2, y: 21.9, ip: 'Mevcut' }, oneri: { x: 4.9, y: 14.1, i: 3, ad: 'Öneri' },
  yakin: [{ x: 4.79, y: 13.4, i: 4 }, { x: 4.92, y: 13.3, i: 5 }, { x: 5.06, y: 13.9, i: 6 }, { x: 4.28, y: 14.8, i: 7 }, { x: 4.64, y: 14.1, i: 8 }],
  e1: 3, e2: 5, k2: 50 });
const V3B = (az, el) => {
  const nokta = [];
  for (let i = 0; i < 400; i++) nokta.push({ p: [1 + 12 * rnd(), 8 + 30 * rnd(), 60 * rnd()], s: 've-pd-n1', r: 2, i });
  return { ad: 'Kısıt penceresi', kam: { az, el }, nokta,
    eks: [{ ad: 'δ_s [mm]', min: 0, max: 14, I: C.isaretler(0, 14, 4) }, { ad: 'f_maks [Hz]', min: 8, max: 38, I: C.isaretler(8, 38, 4) },
      { ad: 'T [%]', min: 0, max: 60, I: C.isaretler(0, 60, 4) }],
    kutu: { a: [3, 8, 0], b: [5, 15, 50] }, duzlem: { z: 50 },
    isaret: [{ p: [4.9, 14.6, 14], s: 've-pd-uz', ad: 'Uzlaşı', r: 7, i: 3 }, { p: [2, 19.2, 22], s: 've-pd-mev', ad: 'Mevcut', r: 6.5, ip: 'Mevcut' }] };
};

describe('YAZI — her diyagram pencerede ve tam ekranda', () => {
  const W = [300, 357, 640, 1400];
  const ciz = {
    'Pareto cephesi': (o) => C.pareto(V11(), o), 'Mod yerleşimi': (o) => C.modlar(V7(), o),
    'Bağlayıcı kısıtlar': (o) => C.baglayici(V9(), o), 'Sınır duyarlılığı': (o) => C.duyarlilik(V10(), o),
    'Ana etkiler': (o) => C.anaEtki(V8(), o), 'Kısıt haritaları': (o) => C.haritalar(kesitV(27), o),
    'İletilebilirlik haritası': (o) => C.tHaritasi(kesitV(27), o), 'Kısıt penceresi': (o) => C.uc(V3B(235, 24), o),
    'Sonuç · Modlar': (o) => C.modSerit(VM(), o), 'Sonuç · Statik sehim ve iletilebilirlik': (o) => C.sehimT(VD(), o)
  };
  Object.keys(ciz).forEach((ad) => {
    test(ad, () => {
      const out = [];
      W.forEach((w) => {
        const r = ciz[ad]({ W: w, fs: w > 1000 ? { k: 11, o: 12 } : FS, H: w > 1000 ? 700 : undefined });
        expect(r.h).toBeGreaterThan(80);
        out.push(...denetle(r.svg, w, ad + ' @' + w));
      });
      expect(out).toEqual([]);
    });
  });

  test('alt simge SVG yazısında tspan (HTML öğesi değil); metindeki "_" kalmaz', () => {
    const svg = C.pareto(V11(), { W: 640, fs: FS }).svg;
    expect(svg).toContain('δ<tspan baseline-shift="sub" font-size="8">s</tspan> [mm]');
    expect(svg).not.toMatch(/<(sub|span|div)[ >]/);
    expect(svgDom(svg).textContent).not.toContain('_');
  });

  // Yazı katmanı çakışan yazıyı DÜŞÜRÜR: eksenin ve panelin adı düşmemeli
  // (alt simgeli x başlığı çizimin dibini 0,2 px aşıp düşüyordu).
  test('eksen ve panel adları her genişlikte çiziliyor', () => {
    const yazi = (svg) => [...svgDom(svg).querySelectorAll('text')].map((t) => t.textContent);
    [300, 357, 640, 1400].forEach((w) => {
      const o = { W: w, fs: FS };
      expect(yazi(C.pareto(V11(), o).svg)).toEqual(expect.arrayContaining(['T [%]', 'δs [mm]', 'E1', 'E2', 'K2', 'Uzlaşı', 'Mevcut']));
      expect(yazi(C.modlar(V7(), o).svg)).toEqual(expect.arrayContaining(['f [Hz]', 'Mevcut', 'Uzlaşı', 'E3', '1b', 'K1']));
      expect(yazi(C.baglayici(V9(), o).svg)).toEqual(expect.arrayContaining(w < 340 ? ['İhlal', 'Yalnız bu'] : ['İhlal eden', 'Yalnız bunu ihlal eden']));
      expect(yazi(C.anaEtki(V8(), o).svg).filter((t) => t === 'kz [N/mm]').length).toBe(2);
      expect(yazi(C.duyarlilik(V10(), o).svg).filter((t) => /^E\d · /.test(t)).length).toBe(3);
      expect(yazi(C.tHaritasi(kesitV(27), o).svg)).toEqual(expect.arrayContaining(['1 · kz [N/mm]', '3 · kz [N/mm]']));
      expect(yazi(C.uc(V3B(235, 24), o).svg)).toEqual(expect.arrayContaining(['δs [mm]', 'fmaks [Hz]', 'T [%]']));
      expect(yazi(C.modSerit(VM(), o).svg)).toEqual(expect.arrayContaining(['Frekans [Hz]', 'Mevcut', 'Öneri', '8–10']));
      expect(yazi(C.sehimT(VD(), o).svg)).toEqual(expect.arrayContaining(['Statik sehim [mm]', 'İletilebilirlik [%]', 'Mevcut', 'Öneri']));
    });
  });
});

describe('SADE GRAFİKLER — Sonuç\'un modlar şeridi ile statik sehim–iletilebilirlik çizimi', () => {
  // Kırmızı çentik görünüm modelinin bayrağının kendisi (hükmü pencere kurar:
  // mount-param.test.js → MODLAR); çentik frekansın yerinde, köprü 0,5 Hz'ten
  // yakın iki modun altında.
  test('modlar: çentik başına bir mod, sınıfı bayrağından; sıra frekansla; köprü yakın çiftin altında', () => {
    [300, 357, 640].forEach((W) => {
      const V = VM(), s = svgDom(C.modSerit(V, { W, fs: FS }).svg);
      const tik = [...s.querySelectorAll('line')].filter((l) => /\bve-pd-tik\b/.test(l.getAttribute('class')));
      expect(tik.length).toBe(V.satir[0].f.length + V.satir[1].f.length);
      const bayrak = V.satir.flatMap((r) => r.kotu);
      expect(tik.map((l) => /\bk\b/.test(l.getAttribute('class')))).toEqual(bayrak);
      V.satir.forEach((r, j) => {
        const x = tik.slice(j * 6, j * 6 + 6).map((l) => Number(l.getAttribute('x1')));
        const sira = r.f.map((f, i) => [f, x[i]]).sort((p, q) => p[0] - q[0]);
        sira.forEach((p, i) => { if (i) expect(p[1]).toBeGreaterThan(sira[i - 1][1]); });
      });
      expect(s.querySelectorAll('line.ve-pd-yakin').length).toBe(1);        // 10,4 ↔ 10,8 Hz
      expect(s.querySelectorAll('line.ve-pd-kose').length).toBe(6);         // önerinin tolerans bıyıkları
      expect(s.querySelectorAll('rect.ve-pd-hit[data-ip]').length).toBe(6); // mevcudun ipuçları
    });
  });
  // Ok mevcuttan öneriye; işaretler verinin yerinde (öneri daha büyük sehim,
  // daha küçük T); bant statik sehim sınırlarının arası.
  test('statik sehim ve iletilebilirlik: ok mevcuttan öneriye, bant sınırların arası, yakın seçenek başına bir halka', () => {
    [300, 357, 640].forEach((W) => {
      const V = VD(), s = svgDom(C.sehimT(V, { W, fs: FS }).svg);
      const karo = s.querySelector('path.ve-pd-mev'), uz = s.querySelector('circle.ve-pd-uz');
      const km = karo.getAttribute('d').match(/-?[\d.]+/g).map(Number), m = [km[0], km[1] + 6.5], u = [Number(uz.getAttribute('cx')), Number(uz.getAttribute('cy'))];
      expect(u[0]).toBeGreaterThan(m[0]);                                     // 4,9 mm > 2 mm
      expect(u[1]).toBeGreaterThan(m[1]);                                     // %14,1 < %21,9 (aşağıda)
      const ok = s.querySelector('line.ve-pd-ok'), a = [Number(ok.getAttribute('x1')), Number(ok.getAttribute('y1'))], b = [Number(ok.getAttribute('x2')), Number(ok.getAttribute('y2'))];
      const uz2 = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);
      expect(uz2(a, m)).toBeLessThan(uz2(a, u));
      expect(uz2(b, u)).toBeLessThan(uz2(b, m));
      expect(s.querySelector('path.ve-pd-ok-uc')).not.toBeNull();
      const bant = s.querySelector('rect.ve-pd-kabul'), bx = Number(bant.getAttribute('x')), bw = Number(bant.getAttribute('width'));
      expect(u[0] > bx && u[0] < bx + bw).toBe(true);                         // 3 ≤ 4,9 ≤ 5
      expect(m[0] < bx).toBe(true);                                           // 2 < 3
      expect(s.querySelectorAll('circle.ve-pd-yk[data-i]').length).toBe(V.yakin.length);
    });
    // mevcut ile öneri üst üste: ok çizilmez
    const V = VD(); V.oneri.x = 2.02; V.oneri.y = 21.8;
    expect(svgDom(C.sehimT(V, { W: 357, fs: FS }).svg).querySelector('line.ve-pd-ok')).toBeNull();
  });
});

describe('BASAMAK — sınır duyarlılığının çizgisi sayımın kendisi', () => {
  const say = (P, L) => P.na + P.deger.filter((v) => (P.yon === 'ust' ? v <= L : v >= L)).length;
  test('rastgele ölçülerde her köşe ve her ara noktada sayım; eşitlik sağlıyor', () => {
    for (let k = 0; k < 40; k++) {
      const n = 1 + Math.floor(rnd() * 30);
      const deger = Array.from({ length: n }, () => Math.round(rnd() * 40) / 4).sort((a, b) => a - b);
      ['ust', 'alt'].forEach((yon) => {
        const P = { yon, deger, na: k % 3, xMin: -1, xMax: 11 };
        const pts = C.basamak(P);
        expect(pts[0]).toEqual([P.xMin, say(P, P.xMin)]);
        expect(pts[pts.length - 1]).toEqual([P.xMax, say(P, P.xMax)]);
        for (let i = 1; i < pts.length; i++) {
          expect(pts[i][0]).toBeGreaterThanOrEqual(pts[i - 1][0]);
          if (pts[i][0] > pts[i - 1][0]) {
            const orta = (pts[i][0] + pts[i - 1][0]) / 2;
            expect(pts[i - 1][1]).toBe(say(P, orta));                       // yatay parça sayımın kendisi
            expect(pts[i][1]).toBe(pts[i - 1][1]);                          // ve gerçekten yatay (köşegen değil)
          }
        }
        deger.forEach((v) => {                                             // ölçünün üstündeki sınır: eşitlik sağlıyor
          const q = pts.filter((p) => p[0] === v);
          if (v > P.xMin && v < P.xMax) expect(q[q.length - 1][1]).toBe(say(P, v + 1e-12) + (yon === 'alt' ? 0 : 0));
          if (v > P.xMin && v < P.xMax) expect(q.some((p) => p[1] === say(P, v))).toBe(true);
        });
      });
    }
  });
});

describe('SINIR — kesit haritasının sınırı ayrışan komşuların arasında', () => {
  test('kenar sayısı kaba kuvvetle; her kenar ızgaranın tam piksel çizgisinde', () => {
    for (let k = 0; k < 20; k++) {
      const n = 3 + Math.floor(rnd() * 25), gec = Uint8Array.from({ length: n * n }, () => (rnd() < 0.45 ? 1 : 0));
      let hakem = 0;
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
        if (i + 1 < n && (gec[j * n + i] === 1) !== (gec[j * n + i + 1] === 1)) hakem++;
        if (j + 1 < n && (gec[j * n + i] === 1) !== (gec[(j + 1) * n + i] === 1)) hakem++;
      }
      const d = C.sinirYolu(n, gec, 10.3, 20.7, 233 / n);
      expect((d.match(/M/g) || []).length).toBe(hakem);
      (d.match(/-?\d+(\.\d+)?/g) || []).forEach((v) => expect(Number(v) % 1).toBe(0));
    }
  });
});

describe('3B — dönerken ölçek sabit, çizim kabın içinde', () => {
  test('az 0–360°, yükseliş 4–88°: kübün bütün köşeleri ve noktalar çizimin içinde; yükseliş sınırlanır', () => {
    for (let az = 0; az < 360; az += 30) {
      [4, 30, 60, 88].forEach((el) => {
        const W = 357, r = C.uc(V3B(az, el), { W, fs: FS }), s = svgDom(r.svg);
        s.querySelectorAll('circle').forEach((c) => {
          const x = Number(c.getAttribute('cx')), y = Number(c.getAttribute('cy'));
          expect(x > 0 && x < W && y > 0 && y < r.h).toBe(true);
        });
        expect(denetle(r.svg, W, 'az ' + az + ' el ' + el)).toEqual([]);
      });
    }
    expect(C.ucKamera({ az: -30, el: 120 })).toEqual({ az: 330, el: 88 });
    expect(C.ucKamera({ az: 400, el: -20 })).toEqual({ az: 40, el: 4 });
  });
});

describe('GÖSTERGE — çizimin sınıflarıyla, sayılar Türkçe', () => {
  test('örnek işaretin sınıfı ve sayı', () => {
    const h = C.gosterge([{ s: 've-pd-n2', ad: 'Uygun', n: 19618 }, { s: 've-pd-cephe', sekil: 'cizgi', ad: 'Pareto cephesi' }]);
    expect(h).toContain('<circle class="ve-pd-n2"');
    expect(h).toContain('<line class="ve-pd-cephe"');
    expect(h).toContain('Uygun · 19.618');
  });
});
