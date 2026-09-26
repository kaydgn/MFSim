/**
 * step-ucgen.test.js — STEP YÜZ ÜÇGENLEYİCİSİ (js/step-ucgen.js)
 *
 * Üçgen YALNIZ GÖRÜNTÜ içindir; çap ve merkez analitik kalır. Kapılar:
 *   · KAPLAMA — her yüzün üçgenleri parametre uzayında alanını TAM kaplar
 *     (çift kaplama da boşluk da alanı değiştirir) ve döngünün her kenarı tam
 *     bir üçgende durur
 *   · ALAN — ağ alanı analitik alana kiriş payıyla yakınsar
 *   · HACİM + YÖN — kapalı katının imzalı hacmi πr²h; same_sense ters → eksi
 *   · SU GEÇİRMEZLİK — paylaşılan kenar iki yüzde AYNI noktalarla
 *   · Kullanıcının dosyasında ölçülen kusurların kapıları: kutup payı, yelpaze,
 *     dejenere son üçgen, ince halka, B-spline ters çevirme, eğrilik ölçeği
 *
 * Geometri tests/helpers/step-yaz.js ile ya da onun temel parçalarıyla elle
 * yazılır — kullanıcının dosyası depoda değil.
 */
const P = require('../../js/step-p21.js');
const U = require('../../js/step-ucgen.js');
const Y = require('../helpers/step-yaz.js');

const PI = Math.PI;

// Tek parçalı dosya → bağlam + parça ağı (B.iz: yüz başına halka ve uv)
function ucgenle(yz, yuzler, secenek = {}, tur = 'kabuk') {
  const u = yz.urun('P', 'PARCA');
  yz.govde(u, yuzler, tur);
  yz.temsil(u);
  const m = P.veStepP21Oku(yz.metin());
  const mt = P.veStepP21Montaj(m);
  const B = U.veStepUcgenBaglam(m, secenek);
  B.iz = true;
  const p = mt.parcalar[0];
  const r = U.veStepUcgenParca(B, p.yuzler, p.M, p.birim);
  const yuz = (f) => U._suYuz(B, f, p.birim.mm, p.birim.derece);
  return { B, r, p, yuz, alan: U.veStepUcgenAlan(r.uc, r.ucgen) };
}

// Parametre uzayında kaplama: Σ|üçgen| = |dış| − Σ|delik|, üçgenlerin hepsi
// aynı yönde; döngünün her kenarı tam bir üçgende.
function kaplama(y) {
  const [uu, vv] = y._uv;
  const alan2 = (h) => { let A = 0; for (let i = 0; i < h.length; i++) { const a = h[i], b = h[(i + 1) % h.length]; A += uu[a] * vv[b] - uu[b] * vv[a]; } return Math.abs(A) / 2; };
  const alan = alan2(y._halkalar[0]) - y._halkalar.slice(1).reduce((s, h) => s + alan2(h), 0);
  let kapla = 0, arti = 0, eksi = 0;
  const say = new Map();
  for (let t = 0; t < y.ucg.length; t += 3) {
    const a = y.ucg[t], b = y.ucg[t + 1], c = y.ucg[t + 2];
    const s = (uu[b] - uu[a]) * (vv[c] - vv[a]) - (vv[b] - vv[a]) * (uu[c] - uu[a]);
    kapla += Math.abs(s) / 2;
    if (s > 0) arti++; else if (s < 0) eksi++;
    for (const [x, z] of [[a, b], [b, c], [c, a]]) { const k = Math.min(x, z) + ':' + Math.max(x, z); say.set(k, (say.get(k) || 0) + 1); }
  }
  let sinirEksik = 0;
  y._halkalar.forEach((h) => { for (let i = 0; i < h.length; i++) { const a = h[i], b = h[(i + 1) % h.length]; if (say.get(Math.min(a, b) + ':' + Math.max(a, b)) !== 1) sinirEksik++; } });
  return { alan, kapla, tekYon: Math.min(arti, eksi), sinirEksik };
}

// Köşeler konumla birleşince: kenar başına üçgen sayısı; imzalı hacim
function suGecirmez(r, q = 1e-6) {
  const harita = new Map(), id = [];
  for (let i = 0; i < r.uc.length; i += 3) {
    const k = Math.round(r.uc[i] / q) + ',' + Math.round(r.uc[i + 1] / q) + ',' + Math.round(r.uc[i + 2] / q);
    if (!harita.has(k)) harita.set(k, harita.size);
    id.push(harita.get(k));
  }
  const say = new Map();
  let V = 0;
  for (let t = 0; t < r.ucgen.length; t += 3) {
    const [a, b, c] = [r.ucgen[t], r.ucgen[t + 1], r.ucgen[t + 2]];
    const A = r.uc.slice(a * 3, a * 3 + 3), Bv = r.uc.slice(b * 3, b * 3 + 3), C = r.uc.slice(c * 3, c * 3 + 3);
    V += (A[0] * (Bv[1] * C[2] - Bv[2] * C[1]) - A[1] * (Bv[0] * C[2] - Bv[2] * C[0]) + A[2] * (Bv[0] * C[1] - Bv[1] * C[0])) / 6;
    const [ia, ib, ic] = [id[a], id[b], id[c]];
    if (ia === ib || ib === ic || ia === ic) continue;
    for (const [x, z] of [[ia, ib], [ib, ic], [ic, ia]]) { const k = Math.min(x, z) + ':' + Math.max(x, z); say.set(k, (say.get(k) || 0) + 1); }
  }
  let acik = 0, cok = 0;
  say.forEach((n) => { if (n === 1) acik++; else if (n > 2) cok++; });
  return { V, acik, cok };
}

// Profil parçasının dönel yüzey alanı (analitik)
function parcaAlani(p) {
  if (p.tip === 'yay') {
    const v0 = Math.atan2(p.s0 - p.sm, p.r0 - p.R), v1 = Math.atan2(p.s1 - p.sm, p.r1 - p.R);
    let d = v1 - v0;
    while (d > PI) d -= 2 * PI;
    while (d <= -PI) d += 2 * PI;
    const a = Math.min(v0, v0 + d), b = Math.max(v0, v0 + d);
    return 2 * PI * p.rk * (p.R * (b - a) + p.rk * (Math.sin(b) - Math.sin(a)));
  }
  if (Math.abs(p.s1 - p.s0) < 1e-12) return PI * Math.abs(p.r1 * p.r1 - p.r0 * p.r0);
  return PI * (p.r0 + p.r1) * Math.hypot(p.s1 - p.s0, p.r1 - p.r0);
}

// Tam çember kenarı (başı sonu aynı köşe)
function cemberKenar(yz, merkez, z, x, r) {
  const c = yz.ekle("CIRCLE('',#" + yz.cerceve(merkez, z, x) + ',' + r + ')');
  const p = [0, 1, 2].map((i) => merkez[i] + r * x[i]);
  const v = yz.tepe(p);
  return yz.kenarEgri(v, v, c);
}
const yuzey = (yz, tip, merkez, z, x, ...sayilar) =>
  yz.ekle(tip + "('',#" + yz.cerceve(merkez, z, x) + (sayilar.length ? ',' + sayilar.join(',') : '') + ')');

describe('KAPLAMA ve ALAN: kaburgalı kasnak profili', () => {
  const profil = Y.kanalliProfil({ od: 150, n: 8 });
  const cikti = (kiris) => {
    const yz = new Y.StepYaz();
    // eksen dünyada eğik: dönüşümlerin hepsi yoldan geçsin
    return ucgenle(yz, Y.profilYuzleri(yz, Y.eksen([10, 20, 30], [0, 0.6, 0.8], [1, 0, 0]), profil), { kiris });
  };
  const analitik = profil.reduce((s, p) => s + parcaAlani(p), 0);
  const kaba = cikti(0.1), ince = cikti(0.01);

  test('her yüz parametre alanını TAM kaplıyor, tek yönde, sınır kenarları eksiksiz', () => {
    expect(kaba.r.kenarYuz).toBe(0);
    for (const f of kaba.p.yuzler) {
      const k = kaplama(kaba.yuz(f));
      expect(Math.abs(k.kapla - k.alan) / k.alan).toBeLessThan(1e-9);
      expect(k.tekYon).toBe(0);
      expect(k.sinirEksik).toBe(0);
    }
  });
  test('ağ alanı analitik alana yakınsıyor', () => {
    const f1 = (kaba.alan - analitik) / analitik, f2 = (ince.alan - analitik) / analitik;
    expect(Math.abs(f1)).toBeLessThan(0.01);
    expect(Math.abs(f2)).toBeLessThan(0.002);
    expect(Math.abs(f2)).toBeLessThan(Math.abs(f1));
  });
});

describe('KAPALI KATI: hacim, yön ve su geçirmezlik', () => {
  // Silindir: iki yarım yan yüz + iki disk; çember kenarları 0° ve 180°'de bölünür
  // ve yüzler arasında PAYLAŞILIR (gerçek B-rep gibi).
  function silindirKati(r, h, ayni = true) {
    const yz = new Y.StepYaz();
    const z = [0, 0, 1], x = [1, 0, 0];
    const P3 = (a, s) => [r * Math.cos(a), r * Math.sin(a), s];
    const c0 = yz.ekle("CIRCLE('',#" + yz.cerceve([0, 0, 0], z, x) + ',' + r + ')');
    const c1 = yz.ekle("CIRCLE('',#" + yz.cerceve([0, 0, h], z, x) + ',' + r + ')');
    const v00 = yz.tepe(P3(0, 0)), v0p = yz.tepe(P3(PI, 0)), v10 = yz.tepe(P3(0, h)), v1p = yz.tepe(P3(PI, h));
    const alt1 = yz.kenarEgri(v00, v0p, c0), alt2 = yz.kenarEgri(v0p, v00, c0);
    const ust1 = yz.kenarEgri(v10, v1p, c1), ust2 = yz.kenarEgri(v1p, v10, c1);
    const y0 = yz.kenarEgri(v00, v10, yz._cizgi(P3(0, 0), P3(0, h))), yp = yz.kenarEgri(v0p, v1p, yz._cizgi(P3(PI, 0), P3(PI, h)));
    const o = (e, d) => yz.yonlu(e, d);
    const cyl = yuzey(yz, 'CYLINDRICAL_SURFACE', [0, 0, 0], z, x, r);
    const yuzler = [
      yz.yuz(cyl, [o(alt1, true), o(yp, true), o(ust1, false), o(y0, false)], [], ayni),
      yz.yuz(cyl, [o(alt2, true), o(y0, true), o(ust2, false), o(yp, false)], [], ayni),
      // üst disk: normal +z, döngü +z çevresinde saat yönünün tersine
      yz.yuz(yuzey(yz, 'PLANE', [0, 0, h], z, x), [o(ust1, true), o(ust2, true)], [], ayni),
      // alt disk: yüzey normali +z ama yüz normali −z (same_sense .F.) → döngü ters
      yz.yuz(yuzey(yz, 'PLANE', [0, 0, 0], z, x), [o(alt2, false), o(alt1, false)], [], !ayni)
    ];
    return ucgenle(yz, yuzler, { kiris: 0.01 }, 'kati');
  }
  test('imzalı hacim πr²h, açık kenar YOK, üç yüzlü kenar YOK', () => {
    const { r } = silindirKati(20, 30);
    const s = suGecirmez(r);
    expect(s.acik).toBe(0);
    expect(s.cok).toBe(0);
    expect(Math.abs(s.V - PI * 400 * 30) / (PI * 400 * 30)).toBeLessThan(2e-3);
  });
  test('same_sense bütün yüzlerde ters çevrilince hacim EKSİ — yön yüzün bayrağından', () => {
    const s = suGecirmez(silindirKati(20, 30, false).r);
    expect(s.V).toBeLessThan(-0.99 * PI * 400 * 30);
  });
  test('normal üçgenin sarımıyla aynı yöne bakar (çift yüzlü malzeme ışığı buna göre çevirir)', () => {
    const { r } = silindirKati(20, 30);
    let ters = 0;
    for (let t = 0; t < r.ucgen.length; t += 3) {
      const [a, b, c] = [r.ucgen[t], r.ucgen[t + 1], r.ucgen[t + 2]];
      const A = r.uc.slice(a * 3, a * 3 + 3), Bv = r.uc.slice(b * 3, b * 3 + 3), C = r.uc.slice(c * 3, c * 3 + 3);
      const e1 = Bv.map((v, i) => v - A[i]), e2 = C.map((v, i) => v - A[i]);
      const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
      const vn = [0, 1, 2].map((i) => r.normal[a * 3 + i] + r.normal[b * 3 + i] + r.normal[c * 3 + i]);
      if (n[0] * vn[0] + n[1] * vn[1] + n[2] * vn[2] <= 0) ters++;
    }
    expect(ters).toBe(0);
  });
});

describe('SARAN DÖNGÜ: bant, kapak, tepe', () => {
  test('dikişsiz tam silindir (iki kapalı çember arasında bant) → 2πrh', () => {
    const yz = new Y.StepYaz(), z = [0, 0, 1], x = [1, 0, 0];
    const e0 = cemberKenar(yz, [0, 0, 0], z, x, 15), e1 = cemberKenar(yz, [0, 0, 40], z, x, 15);
    const f = yz.yuz(yuzey(yz, 'CYLINDRICAL_SURFACE', [0, 0, 0], z, x, 15), [yz.yonlu(e0, true)], [[yz.yonlu(e1, false)]]);
    const o = ucgenle(yz, [f], { kiris: 0.01 });
    expect(o.r.kenarYuz).toBe(0);
    expect(Math.abs(o.alan - 2 * PI * 15 * 40) / (2 * PI * 15 * 40)).toBeLessThan(1e-3);
    const k = kaplama(o.yuz(f));
    expect(Math.abs(k.kapla - k.alan) / k.alan).toBeLessThan(1e-9);
  });
  test('tam tor bandı → 2π·rk·[R·Δv + rk·(sin v1 − sin v0)]', () => {
    const yz = new Y.StepYaz(), z = [0, 0, 1], x = [1, 0, 0], R = 60, rk = 4, v0 = -1, v1 = 0.7;
    const e0 = cemberKenar(yz, [0, 0, rk * Math.sin(v0)], z, x, R + rk * Math.cos(v0));
    const e1 = cemberKenar(yz, [0, 0, rk * Math.sin(v1)], z, x, R + rk * Math.cos(v1));
    const f = yz.yuz(yuzey(yz, 'TOROIDAL_SURFACE', [0, 0, 0], z, x, R, rk), [yz.yonlu(e0, true)], [[yz.yonlu(e1, false)]]);
    const o = ucgenle(yz, [f], { kiris: 0.01 });
    const A = 2 * PI * rk * (R * (v1 - v0) + rk * (Math.sin(v1) - Math.sin(v0)));
    expect(Math.abs(o.alan - A) / A).toBeLessThan(2e-3);
  });
  test('küre kapağı (tek saran döngü): yüz döngünün SOLUNDA — ters döngü öbür tarafı verir', () => {
    // 30° enleminde çember. +u yönünde dolaşan döngünün solu (dışarıdan bakınca)
    // kuzey kapaktır: πR². Döngü ters çevrilince güney: 3πR².
    const kapak = (yon) => {
      const yz = new Y.StepYaz(), z = [0, 0, 1], x = [1, 0, 0], R = 10;
      const e = cemberKenar(yz, [0, 0, R * 0.5], z, x, R * Math.cos(PI / 6));
      const f = yz.yuz(yuzey(yz, 'SPHERICAL_SURFACE', [0, 0, 0], z, x, R), [yz.yonlu(e, yon)]);
      return ucgenle(yz, [f], { kiris: 0.01 });
    };
    const kuzey = kapak(true), guney = kapak(false);
    expect(Math.abs(kuzey.alan - PI * 100) / (PI * 100)).toBeLessThan(2e-3);
    expect(Math.abs(guney.alan - 3 * PI * 100) / (3 * PI * 100)).toBeLessThan(2e-3);
  });
  test('koni tepesi: tek döngü + tepe → yan alan π·r·l (yön ne olursa olsun, tek kutup)', () => {
    for (const yon of [true, false]) {
      const yz = new Y.StepYaz(), z = [0, 0, 1], x = [1, 0, 0], r = 12, al = 25 * PI / 180;
      const e = cemberKenar(yz, [0, 0, 0], z, x, r);
      const f = yz.yuz(yuzey(yz, 'CONICAL_SURFACE', [0, 0, 0], z, x, r, al), [yz.yonlu(e, yon)]);
      const o = ucgenle(yz, [f], { kiris: 0.01 });
      const A = PI * r * (r / Math.sin(al));
      expect(Math.abs(o.alan - A) / A).toBeLessThan(2e-3);
    }
  });
});

describe('KUTUP PAYI: kutup köşesi eksenden 1,6·10⁻⁴ mm uzakta', () => {
  // Kullanıcının dosyasında kutup köşeleri eksene 1,6·10⁻⁴ mm'ye kadar uzak
  // yazılı (R = 1 mm). 10⁻⁹ eşiğiyle o nokta rastgele bir u alıyor, döngü sahte
  // bir sarım kazanıyor ve yüz bozuluyordu.
  test('sekizde bir küre dilimi (ekvator + iki meridyen kutupta buluşuyor) → πR²/2', () => {
    // Ofset 200° yönünde: 10⁻⁹ eşiğiyle N'nin u'su 3,49 rad olur (hiçbir meridyende değil)
    const yz = new Y.StepYaz(), R = 1, d = 1.6e-4, Rz = Math.sqrt(R * R - d * d), aci = 200 * PI / 180;
    const A = yz.tepe([R, 0, 0]), Bv = yz.tepe([0, R, 0]), N = yz.tepe([d * Math.cos(aci), d * Math.sin(aci), Rz]);
    const ekv = yz.ekle("CIRCLE('',#" + yz.cerceve([0, 0, 0], [0, 0, 1], [1, 0, 0]) + ',' + R + ')');
    const m90 = yz.ekle("CIRCLE('',#" + yz.cerceve([0, 0, 0], [1, 0, 0], [0, 1, 0]) + ',' + R + ')');
    const m0 = yz.ekle("CIRCLE('',#" + yz.cerceve([0, 0, 0], [0, -1, 0], [1, 0, 0]) + ',' + R + ')');
    const k1 = yz.kenarEgri(A, Bv, ekv), k2 = yz.kenarEgri(Bv, N, m90), k3 = yz.kenarEgri(A, N, m0);
    const f = yz.yuz(yuzey(yz, 'SPHERICAL_SURFACE', [0, 0, 0], [0, 0, 1], [1, 0, 0], R), [yz.yonlu(k1, true), yz.yonlu(k2, true), yz.yonlu(k3, false)]);
    const o = ucgenle(yz, [f], { kiris: 0.001 });
    expect(o.r.kenarYuz).toBe(0);
    expect(Math.abs(o.alan - PI / 2) / (PI / 2)).toBeLessThan(5e-3);
    expect(kaplama(o.yuz(f)).sinirEksik).toBe(0);
  });
});

describe('B-SPLINE, DÖNEL VE SÜPÜRME YÜZEY', () => {
  test('çift doğrusal B-spline yama → dikdörtgenin alanı (eğik dikdörtgen)', () => {
    const yz = new Y.StepYaz();
    const c = [5, -3, 2], e1 = [0.6, 0.8, 0], e2 = [0, 0, 1];
    const Q = (a, b) => [0, 1, 2].map((i) => c[i] + a * 10 * e1[i] + b * 20 * e2[i]);
    const nk = (a, b) => yz.nokta(Q(a, b));
    const s = yz.ekle("B_SPLINE_SURFACE_WITH_KNOTS('',1,1,((#" + nk(0, 0) + ',#' + nk(0, 1) + '),(#' + nk(1, 0) + ',#' + nk(1, 1)
      + ")),.UNSPECIFIED.,.F.,.F.,.F.,(2,2),(2,2),(0.,1.),(0.,1.),.UNSPECIFIED.)");
    const V = [[0, 0], [1, 0], [1, 1], [0, 1]].map(([a, b]) => yz.tepe(Q(a, b)));
    const kenar = (i, j) => yz.yonlu(yz.kenarEgri(V[i], V[j], yz._cizgi(Q(...[[0, 0], [1, 0], [1, 1], [0, 1]][i]), Q(...[[0, 0], [1, 0], [1, 1], [0, 1]][j]))), true);
    const f = yz.yuz(s, [kenar(0, 1), kenar(1, 2), kenar(2, 3), kenar(3, 0)]);
    const o = ucgenle(yz, [f], { kiris: 0.01 });
    expect(o.r.kenarYuz).toBe(0);
    expect(o.alan).toBeCloseTo(200, 6);
  });
  test('RASYONEL B-spline çeyrek silindir → (π/2)·R·h (ağırlıklar okunuyor)', () => {
    const yz = new Y.StepYaz(), R = 25, h = 18, w = Math.SQRT1_2;
    const nk = (p) => yz.nokta(p);
    const s = yz.ekle('(BOUNDED_SURFACE()B_SPLINE_SURFACE(2,1,((#' + nk([R, 0, 0]) + ',#' + nk([R, 0, h]) + '),(#' + nk([R, R, 0]) + ',#' + nk([R, R, h])
      + '),(#' + nk([0, R, 0]) + ',#' + nk([0, R, h]) + ')),.UNSPECIFIED.,.F.,.F.,.F.)B_SPLINE_SURFACE_WITH_KNOTS((3,3),(2,2),(0.,1.),(0.,1.),.UNSPECIFIED.)'
      + "GEOMETRIC_REPRESENTATION_ITEM()RATIONAL_B_SPLINE_SURFACE(((1.,1.),(" + w + ',' + w + "),(1.,1.)))REPRESENTATION_ITEM('')SURFACE())");
    const a0 = yz.tepe([R, 0, 0]), a1 = yz.tepe([0, R, 0]), b0 = yz.tepe([R, 0, h]), b1 = yz.tepe([0, R, h]);
    const c0 = yz.ekle("CIRCLE('',#" + yz.cerceve([0, 0, 0], [0, 0, 1], [1, 0, 0]) + ',' + R + ')');
    const c1 = yz.ekle("CIRCLE('',#" + yz.cerceve([0, 0, h], [0, 0, 1], [1, 0, 0]) + ',' + R + ')');
    const o2 = (e, d) => yz.yonlu(e, d);
    const f = yz.yuz(s, [o2(yz.kenarEgri(a0, a1, c0), true), o2(yz.kenarEgri(a1, b1, yz._cizgi([0, R, 0], [0, R, h])), true),
      o2(yz.kenarEgri(b0, b1, c1), false), o2(yz.kenarEgri(a0, b0, yz._cizgi([R, 0, 0], [R, 0, h])), false)]);
    const o = ucgenle(yz, [f], { kiris: 0.01 });
    expect(o.r.kenarYuz).toBe(0);
    expect(Math.abs(o.alan - PI / 2 * R * h) / (PI / 2 * R * h)).toBeLessThan(2e-3);
  });
  test('dönel yüzey (B-spline profil) → 2πrh; doğrusal süpürme (çember yayı) → yay boyu × h', () => {
    // Dönel: z ekseni etrafında r = 10'daki düz profil, iki yarım yüz
    const yz = new Y.StepYaz(), r = 10, h = 20;
    const prof = yz.ekle("B_SPLINE_CURVE_WITH_KNOTS('',1,(#" + yz.nokta([r, 0, 0]) + ',#' + yz.nokta([r, 0, h]) + '),.UNSPECIFIED.,.F.,.F.,(2,2),(0.,1.),.UNSPECIFIED.)');
    const eks = yz.ekle("AXIS1_PLACEMENT('',#" + yz.nokta([0, 0, 0]) + ',#' + yz.yon([0, 0, 1]) + ')');
    const sor = yz.ekle("SURFACE_OF_REVOLUTION('',#" + prof + ',#' + eks + ')');
    const P3 = (a, s) => [r * Math.cos(a), r * Math.sin(a), s];
    const c0 = yz.ekle("CIRCLE('',#" + yz.cerceve([0, 0, 0], [0, 0, 1], [1, 0, 0]) + ',' + r + ')');
    const c1 = yz.ekle("CIRCLE('',#" + yz.cerceve([0, 0, h], [0, 0, 1], [1, 0, 0]) + ',' + r + ')');
    const v00 = yz.tepe(P3(0, 0)), v0p = yz.tepe(P3(PI, 0)), v10 = yz.tepe(P3(0, h)), v1p = yz.tepe(P3(PI, h));
    const y0 = yz.kenarEgri(v00, v10, prof), yp = yz.kenarEgri(v0p, v1p, yz._cizgi(P3(PI, 0), P3(PI, h)));
    const o2 = (e, d) => yz.yonlu(e, d);
    const f1 = yz.yuz(sor, [o2(yz.kenarEgri(v00, v0p, c0), true), o2(yp, true), o2(yz.kenarEgri(v10, v1p, c1), false), o2(y0, false)]);
    const f2 = yz.yuz(sor, [o2(yz.kenarEgri(v0p, v00, c0), true), o2(y0, true), o2(yz.kenarEgri(v1p, v10, c1), false), o2(yp, false)]);
    // Süpürme: çeyrek çember (R = 8, 90°) z boyunca 12
    const R = 8, H = 12;
    const yon = yz.ekle("VECTOR('',#" + yz.yon([0, 0, 1]) + ',' + H + ')');
    const cs = yz.ekle("CIRCLE('',#" + yz.cerceve([50, 0, 0], [0, 0, 1], [1, 0, 0]) + ',' + R + ')');
    const sup = yz.ekle("SURFACE_OF_LINEAR_EXTRUSION('',#" + cs + ',#' + yon + ')');
    const Q = (a, s) => [50 + R * Math.cos(a), R * Math.sin(a), s];
    const cs1 = yz.ekle("CIRCLE('',#" + yz.cerceve([50, 0, H], [0, 0, 1], [1, 0, 0]) + ',' + R + ')');
    const q00 = yz.tepe(Q(0, 0)), q01 = yz.tepe(Q(PI / 2, 0)), q10 = yz.tepe(Q(0, H)), q11 = yz.tepe(Q(PI / 2, H));
    const f3 = yz.yuz(sup, [o2(yz.kenarEgri(q00, q01, cs), true), o2(yz.kenarEgri(q01, q11, yz._cizgi(Q(PI / 2, 0), Q(PI / 2, H))), true),
      o2(yz.kenarEgri(q10, q11, cs1), false), o2(yz.kenarEgri(q00, q10, yz._cizgi(Q(0, 0), Q(0, H))), false)]);
    const o = ucgenle(yz, [f1, f2, f3], { kiris: 0.01 });
    expect(o.r.kenarYuz).toBe(0);
    const Ad = U.veStepUcgenAlan(...[f1, f2].map((f) => o.yuz(f)).reduce((acc, y) => {
      const taban = acc[0].length / 3; return [acc[0].concat(y.uc), acc[1].concat(y.ucg.map((i) => i + taban))];
    }, [[], []]));
    const As = U.veStepUcgenAlan(o.yuz(f3).uc, o.yuz(f3).ucg);
    expect(Math.abs(Ad - 2 * PI * r * h) / (2 * PI * r * h)).toBeLessThan(2e-3);
    expect(Math.abs(As - PI / 2 * R * H) / (PI / 2 * R * H)).toBeLessThan(2e-3);
  });
});

describe('ÖLÇÜLMÜŞ KUSURLARIN KAPILARI (kullanıcının dosyası)', () => {
  // Yelpaze: kulak kırpma dikdörtgen bir şeritte tek köşeden yelpaze kurar ve
  // yelpazenin uzun kenarları inceltmeyi patlatıyordu (dosyada 3,78 milyon
  // üçgen, 16 sn; 82 köşeli bir tor şeridi 5.120 köşe). Kapı DELAUNAY
  // çevirmesi: kırpmanın çıktısı ne olursa olsun şeridi zikzağa çevirir.
  test('kulak kırpma + Delaunay: şerit zikzak, yelpaze yok', () => {
    const n = 31, X = [], Y2 = [];
    for (let i = 0; i < n; i++) { X.push(100 * i / (n - 1)); Y2.push(1); }       // üst sıra
    for (let i = 0; i < n; i++) { X.push(100 * i / (n - 1)); Y2.push(0); }       // alt sıra
    const ust = [...Array(n).keys()].reverse(), alt = [...Array(n).keys()].map((i) => n + i);
    const halka = alt.concat(ust);                                                 // saat yönünün tersine
    const enUzun = (T) => { let e = 0; T.forEach((t) => { for (let j = 0; j < 3; j++) e = Math.max(e, Math.abs(X[t[j]] - X[t[(j + 1) % 3]])); }); return e; };
    const T = U._suKulak(X, Y2, halka, [], { zorla: 0 });
    expect(T).toHaveLength(2 * n - 2);
    expect(enUzun(T)).toBeGreaterThan(50);                                         // kırpma yelpaze kurdu
    U._suAg({ u: [], v: [], p: [], s: [] }, X, Y2, T).delaunay();
    expect(T).toHaveLength(2 * n - 2);
    expect(enUzun(T)).toBeLessThan(100 / (n - 1) + 1e-9);                          // komşu sütunlar arası
    expect(U._suGecerli([halka], T)).toBe(true);
  });
  // Dejenere son üçgen: parametre uzayında bir doğru üstündeki üç köşe üçgen
  // olarak yazılmıyordu; eğri yüzeyde o doğru bir YAY ve sınır kenarı üçgensiz
  // kalıyordu (dosyada 42 köşeli bir silindir yüzü).
  // Dosyada kayan nokta gürültüsüyle oluşuyordu; en küçük biçimi: kırpmanın
  // sonunda kalan üç köşe bir doğru üstünde.
  test('bir doğru üstünde biten kırpma sınır kenarını düşürmez', () => {
    const X = [0, 1, 2], Y2 = [0, 0, 0];
    const T = U._suKulak(X, Y2, [0, 1, 2], [], { zorla: 0 });
    expect(T).toHaveLength(1);
    expect(U._suGecerli([[0, 1, 2]], T)).toBe(true);
  });
  // Yelpaze + ikiye bölme: kırpmanın uzun kenarları çevrilmeden bölünürse her
  // bölme iki yeni uzun kenar doğurur. Dosyadaki yüz yeniden kuruldu (tor
  // R 73,15 · r 0,35, v ±1,2217, döngü üst kenardan ters başlıyor): hiç çevirme
  // yokken 3.508–4.925 köşe (dosyada 5.120), yalnız baştaki Delaunay'la 157,
  // bölme sonrası yasallaştırmayla 119.
  test('dosyadaki kaburga tepesi yarım yüzü: çevirmeli inceltme < 140 köşe', () => {
    const R = 73.15, rk = 0.35, vt = 1.2217, z = [0, 0, 1], x = [1, 0, 0];
    const Q = (u, v) => [(R + rk * Math.cos(v)) * Math.cos(u), (R + rk * Math.cos(v)) * Math.sin(u), rk * Math.sin(v)];
    for (let don = 0; don < 4; don++) {
      const yz = new Y.StepYaz();
      const tor = yuzey(yz, 'TOROIDAL_SURFACE', [0, 0, 0], z, x, R, rk);
      const cem = (v) => yz.ekle("CIRCLE('',#" + yz.cerceve([0, 0, rk * Math.sin(v)], z, x) + ',' + (R + rk * Math.cos(v)) + ')');
      const kucuk = (u) => { const er = [Math.cos(u), Math.sin(u), 0], et = [-Math.sin(u), Math.cos(u), 0];
        return yz.ekle("CIRCLE('',#" + yz.cerceve([R * er[0], R * er[1], 0], et.map((q) => -q), er) + ',' + rk + ')'); };
      const a = yz.tepe(Q(0, -vt)), b = yz.tepe(Q(PI, -vt)), c = yz.tepe(Q(PI, vt)), d = yz.tepe(Q(0, vt));
      const dongu = [yz.yonlu(yz.kenarEgri(a, b, cem(-vt)), true), yz.yonlu(yz.kenarEgri(b, c, kucuk(PI)), true),
        yz.yonlu(yz.kenarEgri(d, c, cem(vt)), false), yz.yonlu(yz.kenarEgri(a, d, kucuk(0)), false)];
      const f = yz.yuz(tor, dongu.slice(don).concat(dongu.slice(0, don)));
      const o = ucgenle(yz, [f], { kiris: 0.1 });
      expect(o.yuz(f).uc.length / 3).toBeLessThan(140);
      expect(kaplama(o.yuz(f)).sinirEksik).toBe(0);
    }
  });
  // İnce halka: 0,017 mm genişliğindeki düzlem halkada iki çemberin 0,1 mm
  // kirişli çokgenleri birbirini kesiyor; kulak kırpma 36 kenar düşürüyordu.
  test('kiriş payından ince halka fermuarla örülür, sınır eksiksiz', () => {
    const yz = new Y.StepYaz(), z = [0, 0, 1], x = [1, 0, 0];
    // iç çemberin başlangıç köşesi 2,5° kaymış: örnekler ARA açılarda (dosyadaki gibi)
    const x2 = [Math.cos(2.5 * PI / 180), Math.sin(2.5 * PI / 180), 0];
    const e0 = cemberKenar(yz, [0, 0, 0], z, x, 25), e1 = cemberKenar(yz, [0, 0, 0], z, x2, 24.983);
    const f = yz.yuz(yuzey(yz, 'PLANE', [0, 0, 0], z, x), [yz.yonlu(e0, true)], [[yz.yonlu(e1, false)]]);
    const o = ucgenle(yz, [f], { kiris: 0.1 });
    expect(o.r.kenarYuz).toBe(0);
    expect(kaplama(o.yuz(f)).sinirEksik).toBe(0);
    expect(o.B.sayac.fermuar).toBe(1);
    // Hiçbir üçgen deliği kesmiyor: ağırlık merkezleri kiriş payıyla genişlemiş
    // bantta. (Alan ölçüt DEĞİL: kesişen iki çokgen arasındaki şerit kendi üstüne
    // katlanır — kiriş payından ince halkada kaçınılmaz ve 0,1 mm'lik bantta görünmez.)
    const { uc, ucgen } = o.r;
    for (let t = 0; t < ucgen.length; t += 3) {
      const m = [0, 1, 2].map((i) => (uc[ucgen[t] * 3 + i] + uc[ucgen[t + 1] * 3 + i] + uc[ucgen[t + 2] * 3 + i]) / 3);
      const rho = Math.hypot(m[0], m[1]);
      expect(rho).toBeGreaterThan(24.983 - 0.1);
      expect(rho).toBeLessThan(25 + 1e-9);
    }
  });
  // Eğrilik ölçeği: eşyönlü Delaunay en sıkı yöne göre küçülüyordu — yarım bir
  // kaburga tepesi torunda (R 74,65 · r 0,35) 4.779 köşe, alan +%0,86.
  test('tepe torunda köşe sayısı eğriliğe göre: yarım yüz < 2.500 köşe', () => {
    const p = { tip: 'yay', s0: -11.009, r0: 74.77, s1: -10.351, r1: 74.77, sm: -10.68, R: 74.65, rk: 0.35 };
    const yz = new Y.StepYaz(), yuzler = [];
    yz.donel(Y.eksen(), p, yuzler);
    const o = ucgenle(yz, yuzler, { kiris: 0.01 });
    const y = o.yuz(yuzler[0]);
    expect(y.uc.length / 3).toBeLessThan(2500);
    expect(Math.abs(o.alan - parcaAlani(p)) / parcaAlani(p)).toBeLessThan(0.006);
  });
  // B-spline ters çevirme: sabit 40×40 ızgara, u aralığı geniş ve kendine
  // yaklaşan bir yüzeyde ilk noktayı yanlış yerel en küçüğe indiriyordu; iki
  // yüz "ters çevrilemedi" diye düşüyor ve komşularında 441 açık kenar kalıyordu.
  test('üç tur sarmal şerit (180 düğüm aralığı, turlar arası 2 mm) üçgenlenir', () => {
    // Yüzün köşeleri düğüm aralarında (u = 7,3 ve 170,1): sabit 40×40 ızgaranın
    // düğümleri 4,5 aralıkta bir — köşeye en yakın düğüm bir ÜST turda kalıyor.
    const yz = new Y.StepYaz(), N = 180, tur = 3, adim = 2, ri = 18, ro = 22, uA = 7.3, uB = 170.1;
    const H = (r, i) => { const a = 2 * PI * tur * i / N; return [r * Math.cos(a), r * Math.sin(a), adim * tur * i / N]; };
    const Hc = (r, t) => { const i = Math.floor(t), f = t - i, p = H(r, i), q = H(r, i + 1); return p.map((v, j) => v + f * (q[j] - v)); };
    const ic = [], dis = [];
    for (let i = 0; i <= N; i++) { ic.push(yz.nokta(H(ri, i))); dis.push(yz.nokta(H(ro, i))); }
    const dug = [...Array(N + 1).keys()].map((i) => i + '.').join(','), kat = [2].concat(Array(N - 1).fill(1), [2]).join(',');
    const s = yz.ekle("B_SPLINE_SURFACE_WITH_KNOTS('',1,1,(" + ic.map((a, i) => '(#' + a + ',#' + dis[i] + ')').join(',')
      + "),.UNSPECIFIED.,.F.,.F.,.F.,(" + kat + '),(2,2),(' + dug + '),(0.,1.),.UNSPECIFIED.)');
    const egri = (dz) => yz.ekle("B_SPLINE_CURVE_WITH_KNOTS('',1,(" + dz.map((a) => '#' + a).join(',') + '),.UNSPECIFIED.,.F.,.F.,(' + kat + '),(' + dug + '),.UNSPECIFIED.)');
    const a0 = yz.tepe(Hc(ri, uA)), a1 = yz.tepe(Hc(ri, uB)), b0 = yz.tepe(Hc(ro, uA)), b1 = yz.tepe(Hc(ro, uB));
    const o2 = (e, d) => yz.yonlu(e, d);
    const f = yz.yuz(s, [o2(yz.kenarEgri(a0, a1, egri(ic)), true), o2(yz.kenarEgri(a1, b1, yz._cizgi(Hc(ri, uB), Hc(ro, uB))), true),
      o2(yz.kenarEgri(b0, b1, egri(dis)), false), o2(yz.kenarEgri(a0, b0, yz._cizgi(Hc(ri, uA), Hc(ro, uA))), false)]);
    const o = ucgenle(yz, [f], { kiris: 0.1 });
    expect(o.B.sayac.nedenler).toEqual({});
    expect(o.r.kenarYuz).toBe(0);
    const k = kaplama(o.yuz(f));
    expect(Math.abs(k.kapla - k.alan) / k.alan).toBeLessThan(1e-9);
  });
});

describe('BAŞTAKİ DELAUNAY: kırpmanın çıktısı çevrilir', () => {
  // Düzlem yüz inceltilmez; üçgenleri kırpmanın ve baştaki çevirmenin çıktısı.
  // Eğri yüzde bölme sonrası yasallaştırma kısmen telafi ediyor ama tamamen
  // değil: kullanıcının dosyasında çevirme kalkınca 161.311 → 181.367 üçgen.
  // Kapı çevirmenin sözleşmesi: dışbükey dörtgenin her iç kenarı yerel
  // Delaunay (karşı köşe çemberin dışında) — eşçemberli dörtgen payla.
  test('düz halka yüzünde her iç kenar yerel Delaunay', () => {
    const yz = new Y.StepYaz(), z = [0, 0, 1], x = [1, 0, 0];
    const dis = [yz.yonlu(cemberKenar(yz, [0, 0, 0], z, x, 50), true)];
    const delik = [yz.yonlu(cemberKenar(yz, [0, 0, 0], z, x, 40), false)];
    const f = yz.yuz(yuzey(yz, 'PLANE', [0, 0, 0], z, x), dis, [delik]);
    const y = ucgenle(yz, [f], { kiris: 0.05 }).yuz(f);
    const [X, V] = y._uv;
    const karsi = new Map();
    for (let t = 0; t < y.ucg.length; t += 3) {
      const u = [y.ucg[t], y.ucg[t + 1], y.ucg[t + 2]];
      for (let j = 0; j < 3; j++) {
        const a = u[j], b = u[(j + 1) % 3], k = Math.min(a, b) + ':' + Math.max(a, b);
        if (!karsi.has(k)) karsi.set(k, []);
        karsi.get(k).push([a, b, u[(j + 2) % 3]]);
      }
    }
    let ic = 0, ihlal = 0;
    karsi.forEach((l) => {
      if (l.length !== 2) return;
      ic++;
      const [A, Bv, c] = l[0], d = l[1][2];
      const [ax, ay, bx, by, cx, cy] = [X[A] - X[d], V[A] - V[d], X[Bv] - X[d], V[Bv] - V[d], X[c] - X[d], V[c] - V[d]];
      const det = (ax * ax + ay * ay) * (bx * cy - cx * by) - (bx * bx + by * by) * (ax * cy - cx * ay) + (cx * cx + cy * cy) * (ax * by - bx * ay);
      const olcu = ax * ax + ay * ay + bx * bx + by * by + cx * cx + cy * cy;
      if (det > 1e-9 * olcu * olcu) ihlal++;
    });
    expect(ic).toBeGreaterThan(100);
    expect(ihlal).toBe(0);
    const k = kaplama(y);
    expect(k.sinirEksik).toBe(0);
    expect(Math.abs(k.kapla - k.alan) / k.alan).toBeLessThan(1e-9);
  });
});

describe('PERİYODİK YÜZEYDE DELİK', () => {
  // Yarım silindir u ∈ [π/2, 3π/2] — atan2'nin ±π dikişini KESİYOR. Deliğin
  // noktaları −π yakınında çevriliyor (−2,94), dış döngü süreklilikle 3,34'e
  // açılıyor: delik bir periyot kaydırılmazsa dış döngünün dışında kalır.
  test('dikişi kesen yüzdeki delik dış döngünün içine kaydırılır', () => {
    const yz = new Y.StepYaz(), z = [0, 0, 1], x = [1, 0, 0], r = 20, h = 30;
    const P3 = (a, s) => [r * Math.cos(a), r * Math.sin(a), s];
    const cem = (s) => yz.ekle("CIRCLE('',#" + yz.cerceve([0, 0, s], z, x) + ',' + r + ')');
    const c0 = cem(0), c1 = cem(h), d0 = cem(10), d1 = cem(20);
    const o2 = (e, d) => yz.yonlu(e, d);
    const V = (a, s) => yz.tepe(P3(a, s));
    const a0 = V(PI / 2, 0), a1 = V(3 * PI / 2, 0), b0 = V(PI / 2, h), b1 = V(3 * PI / 2, h);
    const dis = [o2(yz.kenarEgri(a0, a1, c0), true), o2(yz.kenarEgri(a1, b1, yz._cizgi(P3(3 * PI / 2, 0), P3(3 * PI / 2, h))), true),
      o2(yz.kenarEgri(b0, b1, c1), false), o2(yz.kenarEgri(a0, b0, yz._cizgi(P3(PI / 2, 0), P3(PI / 2, h))), false)];
    const u1 = PI + 0.2, u2 = PI + 0.5;                                      // delik: u ∈ [π+0,2, π+0,5], s ∈ [10, 20]
    const e0 = V(u1, 10), e1 = V(u2, 10), g0 = V(u1, 20), g1 = V(u2, 20);
    const delik = [o2(yz.kenarEgri(e0, g0, yz._cizgi(P3(u1, 10), P3(u1, 20))), true), o2(yz.kenarEgri(g0, g1, d1), true),
      o2(yz.kenarEgri(e1, g1, yz._cizgi(P3(u2, 10), P3(u2, 20))), false), o2(yz.kenarEgri(e0, e1, d0), false)];
    const f = yz.yuz(yuzey(yz, 'CYLINDRICAL_SURFACE', [0, 0, 0], z, x, r), dis, [delik]);
    const o = ucgenle(yz, [f], { kiris: 0.01 });
    const k = kaplama(o.yuz(f));
    expect(k.sinirEksik).toBe(0);
    expect(Math.abs(k.kapla - k.alan) / k.alan).toBeLessThan(1e-9);
    const A = PI * r * h - 0.3 * r * 10;
    expect(Math.abs(o.alan - A) / A).toBeLessThan(2e-3);
  });
});

describe('SINIR YÜZEYDEN AYRIK: inceltme yine yakınsar', () => {
  // CAD kenarı yüzeyin üstünde model toleransıyla durur. Kiriş hatası çizilen
  // sınır noktasıyla ölçülseydi o ayrılık hiçbir bölmeyle küçülmez, inceltme
  // tavana (yüz başına 40.000 köşe) kadar koşardı.
  test('yarıçapı 0,05 mm büyük sınır yaylarıyla yarım silindir: köşe sayısı sınırlı, alan doğru', () => {
    const yz = new Y.StepYaz(), z = [0, 0, 1], x = [1, 0, 0], r = 20, h = 30, rs = 20.05;
    const P3 = (a, s, rr) => [rr * Math.cos(a), rr * Math.sin(a), s];
    const c0 = yz.ekle("CIRCLE('',#" + yz.cerceve([0, 0, 0], z, x) + ',' + rs + ')');
    const c1 = yz.ekle("CIRCLE('',#" + yz.cerceve([0, 0, h], z, x) + ',' + rs + ')');
    const v00 = yz.tepe(P3(0, 0, rs)), v0p = yz.tepe(P3(PI, 0, rs)), v10 = yz.tepe(P3(0, h, rs)), v1p = yz.tepe(P3(PI, h, rs));
    const o2 = (e, d) => yz.yonlu(e, d);
    const f = yz.yuz(yuzey(yz, 'CYLINDRICAL_SURFACE', [0, 0, 0], z, x, r), [o2(yz.kenarEgri(v00, v0p, c0), true),
      o2(yz.kenarEgri(v0p, v1p, yz._cizgi(P3(PI, 0, rs), P3(PI, h, rs))), true), o2(yz.kenarEgri(v10, v1p, c1), false),
      o2(yz.kenarEgri(v00, v10, yz._cizgi(P3(0, 0, rs), P3(0, h, rs))), false)]);
    const o = ucgenle(yz, [f], { kiris: 0.01 });
    expect(o.yuz(f).uc.length / 3).toBeLessThan(3000);
    expect(Math.abs(o.alan - PI * r * h) / (PI * r * h)).toBeLessThan(5e-3);
  });
});

describe('PARÇA TOPLAYICISI', () => {
  test('toplayıcı yüz yüze beslenince tek çağrıyla AYNI ağ; aynı parçanın ikinci örneği yüzleri yeniden üçgenlemez', () => {
    const yz = new Y.StepYaz();
    const yuzler = Y.profilYuzleri(yz, Y.eksen(), Y.duzProfil({ od: 75 }));
    const o = ucgenle(yz, yuzler, { kiris: 0.1 });
    const M = { R: [[0, -1, 0], [1, 0, 0], [0, 0, 1]], t: [100, 0, 0] };
    const once = Object.keys(o.B.yuz).length;
    const t = U.veStepUcgenTopla(o.B, M, o.p.birim);
    o.p.yuzler.forEach(t.ekle);
    const r2 = t.bitir();
    expect(Object.keys(o.B.yuz).length).toBe(once);
    expect(r2.ucgen).toEqual(o.r.ucgen);
    // dönüşüm uygulanmış: ilk köşe R·p + t
    const p0 = [o.r.uc[0], o.r.uc[1], o.r.uc[2]];
    expect(r2.uc[0]).toBeCloseTo(-p0[1] + 100, 4);
    expect(r2.uc[1]).toBeCloseTo(p0[0], 4);
  });
});
