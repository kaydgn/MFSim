/**
 * Takoz doğrulama yardımcısı — kurgu modeller ve BAĞIMSIZ hakem hesapları
 * ─────────────────────────────────────────────────────────────────────
 * Takoz modülünün referans belgesi olmayan doğrulaması bunun üstüne kurulur
 * (tests/unit/mount-dogrulama-*.test.js). Belge yerine hakem fiziğin kendisidir:
 *   • kapalı-form çözüm (el hesabı),
 *   • değişmezlik (öteleme, ayna, sıra, bölme, ölçek),
 *   • bağımsız türetim (sonlu dönmeli potansiyel enerjiden rijitlik).
 *
 * BAĞIMSIZLIK KURALI: bu dosyadaki hakem hesapları js/mount-core.js'in HİÇBİR
 * fonksiyonunu çağırmaz. Kinematik (δ = u + θ×d), paralel eksen teoremi, matris
 * kurulumu, karmaşık çözüm ve özdeğer denetimi burada AYRICA yazılıdır. Çekirdeği
 * çağıran tek yol coz()'dur — o da ölçülen taraftır, hakem değil. Hakem çekirdeğin
 * fonksiyonunu kullansaydı, ikisinde ortak bir hata kıyasta görünmezdi.
 *
 * Modeller UI birimiyle kurulur (mm, kg, kg·m², N/mm) ve uygulamanın KENDİ hesap
 * hattından geçer (cp-mount.js _mntComputeResults): birim dönüşümü, toplayıcı ve
 * yük durumu kurulumu da kıyasın içindedir.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const G = 9.81;
const JS = path.join(__dirname, '../../js');

// ═══════════════════ Uygulama hattı (ölçülen taraf) ═══════════════════

let _kurulu = null;
// Jest ortamında çekirdek + kabuk + rapor katmanını bir kez kurar.
// tests/unit/mount-adams-tulga.test.js ile aynı kurulum.
function kur() {
  if (_kurulu) return _kurulu;
  const core = require(path.join(JS, 'mount-core.js'));
  global.veMountCore = core;
  global.veMntSignals = require(path.join(JS, 'mount-signals.js'));
  global.veMntBrief = require(path.join(JS, 'mount-brief.js'));
  if (typeof stubGlobals === 'function') {
    stubGlobals({ saveState: () => {}, showToast: () => {}, showNodeProperties: () => {} });
  }
  global.veUpdateResultsTree = () => {};
  (0, eval)(fs.readFileSync(path.join(JS, 'components.js'), 'utf8'));   // dolaylı eval → global kapsam
  global.componentDefs = (0, eval)('componentDefs');
  const cp = require(path.join(JS, 'cp-mount.js'));
  const rp = require(path.join(JS, 'cp-mount-report.js'));
  _kurulu = { core, cp, rp };
  return _kurulu;
}

// Topoloji ({nodes, connections}) → çözüm R. Model KOPYADA çözülür.
// opt.sinyal: Sonuçlar kanallarını da üret (3 şok simülasyonu + 3 ivme süpürmesi +
// FRF ızgaraları — çözüm başına ~250 ms). Varsayılan KAPALI: hesap yolunun kendisi
// kanallardan bağımsızdır (_mntAssembleR kanalı try/catch'le ayrı kurar), ve
// değişmezlik bataryası tek modelde sekiz kez yeniden çözer.
function coz(topo, opt) {
  const { cp } = kur();
  const t = JSON.parse(JSON.stringify(topo));
  global.nodes = t.nodes;
  global.connections = t.connections || [];
  const solver = t.nodes.find((n) => n.type === 'mnt-solver');
  if (!solver) throw new Error('topolojide mnt-solver yok');
  const sinyal = global.veMntSignals;
  if (!(opt && opt.sinyal)) global.veMntSignals = null;
  try { return cp._mntComputeResults(solver.id); }
  finally { global.veMntSignals = sinyal; }
}

// Depodaki örnek topolojisi (siper | tulga | asfat).
function ornek(ad) {
  return JSON.parse(fs.readFileSync(
    path.join(__dirname, '../../assets/examples', ad + '_topoloji.json'), 'utf8'));
}

// ═══════════════════ Kurgu model kurucusu (UI birimleri) ═══════════════════
//
// spec = {
//   govdeler: [{ ad, tip?, m [kg], cg:[mm], I?:3×3 tensör [kg·m²] | kutu?:[a,b,c] mm,
//                nokta?:bool, veri?:{…} }],
//   takozlar: [{ ad, p:[mm], ks:[N/mm]×3, kd:[N/mm]×3, fit?:{x,y,z}, egri?:{x,y,z}, maxLoad? }],
//   motor?:   { idleRpm, cylinders, Te, Rstall, g1…g6, gR, iTransfer, phiFwd, phiRev, derate },
//   cozucu?:  { zeta, solveMode, shockG, shockMs }
// }
// motor alanları İLK gövdenin verisine yazılır (toplayıcı ilk dolu alanı okur).
function kurguModel(spec) {
  const nodes = [];
  (spec.govdeler || []).forEach((g, i) => {
    const I = g.I || (g.kutu ? kutuAtalet(g.m, g.kutu) : [[0, 0, 0], [0, 0, 0], [0, 0, 0]]);
    const data = Object.assign({
      mass: g.m, cgx: g.cg[0], cgy: g.cg[1], cgz: g.cg[2],
      Ixx: I[0][0], Iyy: I[1][1], Izz: I[2][2], Ixy: I[0][1], Ixz: I[0][2], Iyz: I[1][2],
      pointMass: !!g.nokta
    }, g.veri || {});
    if (i === 0 && spec.motor) Object.assign(data, spec.motor);
    nodes.push({ id: 'g' + (i + 1), type: g.tip || 'mnt-motor', customName: g.ad || ('Gövde ' + (i + 1)), data });
  });
  (spec.takozlar || []).forEach((t, i) => {
    const data = { x: t.p[0], y: t.p[1], z: t.p[2],
      kxs: t.ks[0], kys: t.ks[1], kzs: t.ks[2], kxd: t.kd[0], kyd: t.kd[1], kzd: t.kd[2] };
    if (t.maxLoad != null) data.maxLoad = t.maxLoad;
    ['x', 'y', 'z'].forEach((a) => {
      const A = a.toUpperCase();
      if (t.fit && t.fit[a]) data['fit' + A] = t.fit[a];
      if (t.egri && t.egri[a]) data['curve' + A] = t.egri[a];
    });
    nodes.push({ id: 't' + (i + 1), type: 'mnt-mount', customName: t.ad || ('Takoz ' + (i + 1)), data });
  });
  nodes.push({ id: 'cozucu', type: 'mnt-solver', customName: 'Çözücü', data: Object.assign({}, spec.cozucu || {}) });
  return { nodes, connections: [] };
}

// Düzgün yoğunluklu dikdörtgen prizma — kendi ağırlık merkezinde, eksenlere hizalı.
// a, b, c [mm] x/y/z kenarları; dönüş kg·m² tensör.
function kutuAtalet(m, abc) {
  const a = abc[0] / 1000, b = abc[1] / 1000, c = abc[2] / 1000;
  return [[m * (b * b + c * c) / 12, 0, 0], [0, m * (a * a + c * c) / 12, 0], [0, 0, m * (a * a + b * b) / 12]];
}

// Simetrik dörtlü: ±Lx, ±Ly köşelerinde dört özdeş takoz, AM'nin h [mm] altında.
// Adlar depo sözleşmesine uyar: +X araç arkası (ön = −X), +Y sağ.
function dortluTakoz(cg, Lx, Ly, h, ks, kd, ek) {
  return [['Sağ Ön', -1, 1], ['Sol Ön', -1, -1], ['Sağ Arka', 1, 1], ['Sol Arka', 1, -1]].map((q) =>
    Object.assign({ ad: q[0] + ' Takoz', p: [cg[0] + q[1] * Lx, cg[1] + q[2] * Ly, cg[2] - (h || 0)],
                    ks: ks.slice(), kd: kd.slice() }, ek || {}));
}

// ═══════════════════ Bağımsız kinematik ve kütle ═══════════════════

// δ = u + θ×d satırları (d = r_takoz − c_G, SI). Kodun A matrisi KULLANILMAZ:
//   θ×d = (θy·dz − θz·dy, θz·dx − θx·dz, θx·dy − θy·dx)
function Arows(d) {
  return [[1, 0, 0, 0, d[2], -d[1]],
          [0, 1, 0, -d[2], 0, d[0]],
          [0, 0, 1, d[1], -d[0], 0]];
}

// Bileşenler (SI: mass, cg[m], I[kg·m²], pointMass) → { m, cg, I } — paralel eksen
// teoremi tensör bileşeniyle: I_G = Σ [I_j + m_j((d·d)E − d dᵀ)].
function birlesikKutle(components) {
  let m = 0; const s = [0, 0, 0];
  components.forEach((c) => { m += c.mass; for (let i = 0; i < 3; i++) s[i] += c.mass * c.cg[i]; });
  const cg = s.map((v) => v / m);
  const I = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  components.forEach((c) => {
    const d = [0, 1, 2].map((i) => c.cg[i] - cg[i]);
    const dd = d[0] * d[0] + d[1] * d[1] + d[2] * d[2];
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
      const own = c.pointMass ? 0 : c.I[i][j];
      I[i][j] += own + c.mass * ((i === j ? dd : 0) - d[i] * d[j]);
    }
  });
  return { m, cg, I };
}

function M6of(m, I) {
  const M = sifir(6, 6);
  M[0][0] = M[1][1] = M[2][2] = m;
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) M[3 + i][3 + j] = I[i][j];
  return M;
}

// Takoz başına eksen değerleri (k ya da c) → 6×6: Σ Aᵢᵀ diag(vᵢ) Aᵢ.
function topla6(mounts, cg, perMount) {
  const K = sifir(6, 6);
  mounts.forEach((mt, i) => {
    const A = Arows([0, 1, 2].map((j) => mt.pos[j] - cg[j]));
    const v = perMount[i];
    for (let ax = 0; ax < 3; ax++) for (let a = 0; a < 6; a++) for (let b = 0; b < 6; b++) {
      K[a][b] += v[ax] * A[ax][a] * A[ax][b];
    }
  });
  return K;
}

// Takozun ilettiği kuvvetlerin genelleştirilmiş toplamı Σ Aᵢᵀ fᵢ (kuvvet + G'ye göre moment).
function genelKuvvet(mounts, cg, fList) {
  const s = [0, 0, 0, 0, 0, 0];
  mounts.forEach((mt, i) => {
    const A = Arows([0, 1, 2].map((j) => mt.pos[j] - cg[j]));
    for (let r = 0; r < 3; r++) for (let c = 0; c < 6; c++) s[c] += A[r][c] * fList[i][r];
  });
  return s;
}

// ═══════════════════ Sonlu dönmeli potansiyel enerji ═══════════════════
//
// V(q) = ½ Σᵢ Σₐ kᵢₐ·δᵢₐ(q)²,  δᵢ(q) = u + (R(θ) − E)·dᵢ — dönme TAM (Rodrigues),
// küçük-dönme doğrusallaştırması YOK. Hessian'ı q = 0'da Σ Aᵀ k A'ya eşittir; bu
// eşitlik kodun A matrisinin işaret sözleşmesini (skew) hiç kullanmadan sınar.
function rodrigues(th) {
  const p2 = th[0] * th[0] + th[1] * th[1] + th[2] * th[2], p = Math.sqrt(p2);
  const S = [[0, -th[2], th[1]], [th[2], 0, -th[0]], [-th[1], th[0], 0]];
  const a = p > 1e-8 ? Math.sin(p) / p : 1 - p2 / 6;
  const b = p > 1e-8 ? (1 - Math.cos(p)) / p2 : 0.5 - p2 / 24;
  const S2 = matCarp(S, S);
  return [0, 1, 2].map((i) => [0, 1, 2].map((j) => (i === j ? 1 : 0) + a * S[i][j] + b * S2[i][j]));
}
function sehimSonlu(q, d) {
  const R = rodrigues([q[3], q[4], q[5]]);
  return [0, 1, 2].map((i) => q[i] + R[i][0] * d[0] + R[i][1] * d[1] + R[i][2] * d[2] - d[i]);
}
function potansiyel(mounts, cg, kList, q) {
  let V = 0;
  mounts.forEach((mt, i) => {
    const dl = sehimSonlu(q, [0, 1, 2].map((j) => mt.pos[j] - cg[j]));
    for (let a = 0; a < 3; a++) V += 0.5 * kList[i][a] * dl[a] * dl[a];
  });
  return V;
}
// Merkezî farkla Hessian (4 noktalı karma türev; kübik terimleri tam iptal eder).
function sayisalHessian(fn, q0, h) {
  h = h || 1e-4;
  const n = q0.length, H = sifir(n, n);
  const at = (da, db, sa, sb) => { const q = q0.slice(); q[da] += sa * h; q[db] += sb * h; return fn(q); };
  for (let a = 0; a < n; a++) for (let b = a; b < n; b++) {
    const v = (at(a, b, 1, 1) - at(a, b, 1, -1) - at(a, b, -1, 1) + at(a, b, -1, -1)) / (4 * h * h);
    H[a][b] = H[b][a] = v;
  }
  return H;
}
function sayisalGradyan(fn, q0, h) {
  h = h || 1e-6;
  return q0.map((_, a) => { const qp = q0.slice(), qm = q0.slice(); qp[a] += h; qm[a] -= h; return (fn(qp) - fn(qm)) / (2 * h); });
}

// ═══════════════════ Doğrusal cebir (bağımsız) ═══════════════════

function sifir(r, c) { return Array.from({ length: r }, () => Array(c).fill(0)); }
function matCarp(A, B) {
  return A.map((row) => B[0].map((_, j) => row.reduce((s, v, k) => s + v * B[k][j], 0)));
}
function matVek(A, x) { return A.map((row) => row.reduce((s, v, j) => s + v * x[j], 0)); }
function noktaCarp(a, b) { return a.reduce((s, v, i) => s + v * b[i], 0); }
function norm(a) { return Math.sqrt(noktaCarp(a, a)); }
function maksMutlak(A) { return Math.max(...A.map((r) => Math.max(...r.map(Math.abs)))); }

// Kısmi pivotlu GERÇEL çözüm (hakem için; çekirdeğin solveLinear'ından ayrı yazım).
function coz6(Ain, bin) {
  const n = Ain.length, A = Ain.map((r) => r.slice()), b = bin.slice();
  for (let k = 0; k < n; k++) {
    let p = k;
    for (let i = k + 1; i < n; i++) if (Math.abs(A[i][k]) > Math.abs(A[p][k])) p = i;
    [A[k], A[p]] = [A[p], A[k]]; [b[k], b[p]] = [b[p], b[k]];
    for (let i = k + 1; i < n; i++) {
      const f = A[i][k] / A[k][k];
      for (let j = k; j < n; j++) A[i][j] -= f * A[k][j];
      b[i] -= f * b[k];
    }
  }
  const x = Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let s = b[i];
    for (let j = i + 1; j < n; j++) s -= A[i][j] * x[j];
    x[i] = s / A[i][i];
  }
  return x;
}

// KARMAŞIK çözüm — çekirdek karmaşık sistemi 12×12 gerçel sisteme açıyor; hakem
// karmaşık aritmetikle DOĞRUDAN çözer. Sayı = [re, im].
const cAdd = (a, b) => [a[0] + b[0], a[1] + b[1]];
const cSub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const cMul = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
const cDiv = (a, b) => { const d = b[0] * b[0] + b[1] * b[1]; return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d]; };
const cAbs = (a) => Math.hypot(a[0], a[1]);
function cCoz(Ain, bin) {
  const n = Ain.length, A = Ain.map((r) => r.map((v) => v.slice())), b = bin.map((v) => v.slice());
  for (let k = 0; k < n; k++) {
    let p = k;
    for (let i = k + 1; i < n; i++) if (cAbs(A[i][k]) > cAbs(A[p][k])) p = i;
    [A[k], A[p]] = [A[p], A[k]]; [b[k], b[p]] = [b[p], b[k]];
    for (let i = k + 1; i < n; i++) {
      const f = cDiv(A[i][k], A[k][k]);
      for (let j = k; j < n; j++) A[i][j] = cSub(A[i][j], cMul(f, A[k][j]));
      b[i] = cSub(b[i], cMul(f, b[k]));
    }
  }
  const x = Array.from({ length: n }, () => [0, 0]);
  for (let i = n - 1; i >= 0; i--) {
    let s = b[i];
    for (let j = i + 1; j < n; j++) s = cSub(s, cMul(A[i][j], x[j]));
    x[i] = cDiv(s, A[i][i]);
  }
  return x;
}

// Hakem FRF: birim kuvvet (yön dir) altında takozların o yönde ilettiği kuvvetin
// KARMAŞIK toplamının genliği. K, C, M bağımsız kurulmuş olmalı; kList/cList takoz başına.
function frfHakem(mounts, cg, M, K, C, kList, cList, f, dir) {
  const w = 2 * Math.PI * f;
  const S = M.map((row, i) => row.map((_, j) => [K[i][j] - w * w * M[i][j], w * C[i][j]]));
  const rhs = Array.from({ length: 6 }, (_, i) => [i === dir ? 1 : 0, 0]);
  const Q = cCoz(S, rhs);
  let tot = [0, 0];
  mounts.forEach((mt, i) => {
    const A = Arows([0, 1, 2].map((j) => mt.pos[j] - cg[j]));
    let dl = [0, 0];
    for (let j = 0; j < 6; j++) dl = cAdd(dl, [A[dir][j] * Q[j][0], A[dir][j] * Q[j][1]]);
    tot = cAdd(tot, cMul([kList[i][dir], w * cList[i][dir]], dl));
  });
  return cAbs(tot);
}

// ═══════════════════ Kapalı formlar ═══════════════════

const fHz = (w2) => Math.sqrt(w2) / (2 * Math.PI);
// 2 serbestlikli genelleştirilmiş özdeğer: det(K − ω²·diag(m1, m2)) = 0 → [ω²_alt, ω²_üst].
function ozdeger2(K11, K12, K22, m1, m2) {
  const a = m1 * m2, b = -(K11 * m2 + K22 * m1), c = K11 * K22 - K12 * K12;
  const disk = Math.sqrt(b * b - 4 * a * c);
  return [(-b - disk) / (2 * a), (-b + disk) / (2 * a)];
}
// Tek serbestlikli iletilebilirlik — çekirdeğin transmissibility'sinden AYRI yazım.
function sdofT(f, fn, zeta) {
  const r = f / fn, a = 2 * zeta * r;
  return Math.sqrt((1 + a * a) / ((1 - r * r) * (1 - r * r) + a * a));
}
// Kübik k0·x + c3·x³ = F (k0, c3 > 0) — tek gerçel kök (Cardano).
function kubikKok(k0, c3, F) {
  const p = k0 / c3, q = -F / c3;                 // x³ + p·x + q = 0
  const D = Math.sqrt(q * q / 4 + p * p * p / 27);
  return Math.cbrt(-q / 2 + D) + Math.cbrt(-q / 2 - D);
}
// Z ekseni etrafında döndürme matrisi (ψ, rad).
function rotZ(psi) {
  const c = Math.cos(psi), s = Math.sin(psi);
  return [[c, -s, 0], [s, c, 0], [0, 0, 1]];
}
function rotX(a) {
  const c = Math.cos(a), s = Math.sin(a);
  return [[1, 0, 0], [0, c, -s], [0, s, c]];
}
// R·I·Rᵀ — tensörün döndürülmüş çerçevedeki bileşenleri.
function tensorDondur(R, I) { return matCarp(matCarp(R, I), [0, 1, 2].map((i) => [0, 1, 2].map((j) => R[j][i]))); }

// Göreli fark (b ölçek); b ≈ 0 ise mutlak.
function bagil(a, b) { return Math.abs(a - b) / Math.max(Math.abs(b), 1e-300); }

// LU ile determinant (bağımsız yazım).
function det(Ain) {
  const n = Ain.length, A = Ain.map((r) => r.slice());
  let d = 1;
  for (let k = 0; k < n; k++) {
    let p = k;
    for (let i = k + 1; i < n; i++) if (Math.abs(A[i][k]) > Math.abs(A[p][k])) p = i;
    if (p !== k) { [A[k], A[p]] = [A[p], A[k]]; d = -d; }
    d *= A[k][k];
    for (let i = k + 1; i < n; i++) {
      const f = A[i][k] / A[k][k];
      for (let j = k; j < n; j++) A[i][j] -= f * A[k][j];
    }
  }
  return d;
}

// ═══════════════════ Nonlineer yasaların bağımsız yazımı ═══════════════════
// Analitik fit biçimleri (mm → N), çekirdeğin makeAxisLaw'ından AYRI yazım:
//   poly : F = k0·x + c3·x³ + c5·x⁵
//   asym : x < 0 → comp.k0·x/(1 + x/xmax) (payda 0,02'de kırpılır), x ≥ 0 → ext.k0·x + ext.c3·x³
function fitKuvvet(fit, x) {
  if (fit.form === 'poly') return (fit.k0 || 0) * x + (fit.c3 || 0) * x ** 3 + (fit.c5 || 0) * x ** 5;
  if (x >= 0) return (fit.ext.k0 || 0) * x + (fit.ext.c3 || 0) * x ** 3;
  const u = Math.max(1 + x / fit.comp.xmax, 0.02);
  return fit.comp.k0 * x / u;
}
// Merkezî farkla tanjant [N/mm].
function fitTanjant(fit, x) { const h = 1e-6; return (fitKuvvet(fit, x + h) - fitKuvvet(fit, x - h)) / (2 * h); }

// ═══════════════════ Genel kurgu model ═══════════════════
// İki gövde (çarpım terimli tam tensör), beş takoz, farklı yükseklikler, simetri yok.
//   radyalIzotrop → kx = ky (z etrafında döndürmeye karşı değişmez takoz)
//   nonlineer     → öz-tutarlı yasalar: orijin eğimi = k_stat; z basmada rasyonel
//                   sertleşme (asimptot 18 mm), radyalde kübik sertleşme
function genelModel(opt) {
  opt = opt || {};
  const Ia = tensorDondur(rotZ(0.4), [[40, 0, 0], [0, 110, 0], [0, 0, 95]]);
  const Ib = tensorDondur(matCarp(rotZ(-0.7), rotX(0.3)), [[6, 0, 0], [0, 18, 0], [0, 0, 16]]);
  const k = (x, y, z) => opt.radyalIzotrop ? [x, x, z] : [x, y, z];
  const takoz = (ad, p, ks, kd) => {
    const t = { ad, p, ks, kd };
    if (opt.nonlineer) {
      t.fit = { x: { form: 'poly', k0: ks[0], c3: 0.5, c5: 0 },
                y: { form: 'poly', k0: ks[1], c3: 0.4, c5: 0 },
                z: { form: 'asym', comp: { k0: ks[2], xmax: 18 }, ext: { k0: ks[2], c3: 0.3 } } };
    }
    return t;
  };
  return {
    govdeler: [{ ad: 'Motor', m: 820, cg: [-150, 25, 640], I: Ia },
               { ad: 'Şanzıman', tip: 'mnt-gearbox', m: 310, cg: [720, -15, 520], I: Ib }],
    takozlar: [takoz('Sağ Ön Takoz', [-620, 330, 430], k(900, 600, 520), k(1300, 850, 760)),
               takoz('Sol Ön Takoz', [-600, -350, 455], k(850, 650, 500), k(1250, 900, 730)),
               takoz('Orta Takoz', [150, 10, 300], k(700, 500, 420), k(950, 700, 600)),
               takoz('Sağ Arka Takoz', [880, 290, 380], k(600, 450, 380), k(800, 600, 520)),
               takoz('Sol Arka Takoz', [900, -260, 395], k(620, 430, 400), k(820, 580, 540))],
    motor: opt.motor,
    cozucu: { zeta: 0.03 }
  };
}

// ═══════════════════ Topoloji dönüşümleri (değişmezlik testleri) ═══════════════════
// Hepsi KOPYA döndürür; JSON örneklerindeki metin sayıları ("124.96") sayıya çevrilir.
const _kopya = (t) => JSON.parse(JSON.stringify(t));
const _govde = (n) => n.data && n.data.mass != null && n.type !== 'mnt-mount';
const _takoz = (n) => n.type === 'mnt-mount';
const _sayi = (v) => (v === '' || v == null) ? 0 : Number(v);

// Bütün konumları s [mm] kadar kaydır.
function otele(topo, s) {
  const t = _kopya(topo);
  t.nodes.forEach((n) => {
    if (_govde(n)) { n.data.cgx = _sayi(n.data.cgx) + s[0]; n.data.cgy = _sayi(n.data.cgy) + s[1]; n.data.cgz = _sayi(n.data.cgz) + s[2]; }
    if (_takoz(n)) { n.data.x = _sayi(n.data.x) + s[0]; n.data.y = _sayi(n.data.y) + s[1]; n.data.z = _sayi(n.data.z) + s[2]; }
  });
  return t;
}
// y → −y aynası. Tensörde Ixy ve Iyz işaret değiştirir. y ekseni yasası tek
// (odd) fonksiyon olmalı (lineer / poly); nokta tablosu (−δ, −F) ile ters çevrilir.
function aynala(topo) {
  const t = _kopya(topo);
  t.nodes.forEach((n) => {
    if (_govde(n)) {
      n.data.cgy = -_sayi(n.data.cgy);
      n.data.Ixy = -_sayi(n.data.Ixy); n.data.Iyz = -_sayi(n.data.Iyz);
    }
    if (_takoz(n)) {
      n.data.y = -_sayi(n.data.y);
      if (n.data.fitY && n.data.fitY.form !== 'poly') throw new Error('aynala: y yasası tek fonksiyon değil');
      if (Array.isArray(n.data.curveY)) n.data.curveY = n.data.curveY.map((p) => [-p[0], -p[1]]).reverse();
    }
  });
  return t;
}
// Takozların sırasını ters çevir (gövdeler ve araçlar yerinde kalır).
function takozSirasiTers(topo) {
  const t = _kopya(topo);
  const tk = t.nodes.filter(_takoz).reverse();
  let k = 0;
  t.nodes = t.nodes.map((n) => (_takoz(n) ? tk[k++] : n));
  return t;
}
// Gövdeyi iki parçaya böl: toplam kütle, AM ve AM'ye göre tensör AYNI kalır.
// m1 = 0,4m (AM + 0,6Δ), m2 = 0,6m (AM − 0,4Δ); kendi tensörleri (I − P)/2.
function govdeBol(topo, nodeId, delta) {
  const t = _kopya(topo);
  const i = t.nodes.findIndex((n) => n.id === nodeId), n = t.nodes[i], d = n.data;
  const m = _sayi(d.mass), c = [_sayi(d.cgx), _sayi(d.cgy), _sayi(d.cgz)];
  const I = [[_sayi(d.Ixx), _sayi(d.Ixy), _sayi(d.Ixz)], [_sayi(d.Ixy), _sayi(d.Iyy), _sayi(d.Iyz)], [_sayi(d.Ixz), _sayi(d.Iyz), _sayi(d.Izz)]];
  const D = delta.map((v) => v / 1000), d1 = D.map((v) => 0.6 * v), d2 = D.map((v) => -0.4 * v);
  const P = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  [[0.4 * m, d1], [0.6 * m, d2]].forEach(([mm, dv]) => {
    const dd = dv[0] * dv[0] + dv[1] * dv[1] + dv[2] * dv[2];
    for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) P[a][b] += mm * ((a === b ? dd : 0) - dv[a] * dv[b]);
  });
  const Is = I.map((r, a) => r.map((v, b) => (v - P[a][b]) / 2));
  if (!(Is[0][0] > 0 && det([[Is[0][0], Is[0][1]], [Is[1][0], Is[1][1]]]) > 0 && det(Is) > 0)) {
    throw new Error('govdeBol: parça tensörü pozitif tanımlı değil — Δ küçültülmeli');
  }
  const yaz = (dt, mm, cc) => Object.assign(dt, { mass: mm, cgx: cc[0], cgy: cc[1], cgz: cc[2], pointMass: false,
    Ixx: Is[0][0], Iyy: Is[1][1], Izz: Is[2][2], Ixy: Is[0][1], Ixz: Is[0][2], Iyz: Is[1][2] });
  yaz(d, 0.4 * m, c.map((v, a) => v + 0.6 * delta[a]));
  const n2 = { id: n.id + '-b', type: n.type, customName: (n.customName || 'Gövde') + ' (parça 2)', data: yaz({}, 0.6 * m, c.map((v, a) => v - 0.4 * delta[a])) };
  t.nodes.splice(i + 1, 0, n2);
  return t;
}
// Takozu aynı noktada iki YARIM takoza böl (rijitlik, yasa ve kapasite yarıya).
function _yarimFit(f) {
  if (!f) return f;
  if (f.form === 'poly') return { form: 'poly', k0: f.k0 / 2, c3: (f.c3 || 0) / 2, c5: (f.c5 || 0) / 2 };
  return { form: 'asym', comp: { k0: f.comp.k0 / 2, xmax: f.comp.xmax }, ext: { k0: f.ext.k0 / 2, c3: (f.ext.c3 || 0) / 2 } };
}
function takozBol(topo, nodeId) {
  const t = _kopya(topo);
  const i = t.nodes.findIndex((n) => n.id === nodeId), n = t.nodes[i], d = n.data;
  ['kxs', 'kys', 'kzs', 'kxd', 'kyd', 'kzd'].forEach((k) => { d[k] = _sayi(d[k]) / 2; });
  if (d.maxLoad != null && d.maxLoad !== '') d.maxLoad = _sayi(d.maxLoad) / 2;
  ['X', 'Y', 'Z'].forEach((A) => {
    if (d['fit' + A]) d['fit' + A] = _yarimFit(d['fit' + A]);
    if (Array.isArray(d['curve' + A])) d['curve' + A] = d['curve' + A].map((p) => [_sayi(p[0]), _sayi(p[1]) / 2]);
  });
  t.nodes.splice(i + 1, 0, { id: n.id + '-b', type: n.type, customName: (n.customName || 'Takoz') + ' (yarım)', data: _kopya(d) });
  return t;
}
// Bütün kütle ve atalet × α.
function kutleOlcek(topo, a) {
  const t = _kopya(topo);
  t.nodes.filter(_govde).forEach((n) => {
    ['mass', 'Ixx', 'Iyy', 'Izz', 'Ixy', 'Ixz', 'Iyz'].forEach((k) => { if (n.data[k] != null && n.data[k] !== '') n.data[k] = _sayi(n.data[k]) * a; });
  });
  return t;
}
// Bütün takoz rijitlikleri × β (yalnız lineer takozlar — yasa ölçeklenmez).
function rijitlikOlcek(topo, b) {
  const t = _kopya(topo);
  t.nodes.filter(_takoz).forEach((n) => {
    if (n.data.fitX || n.data.fitY || n.data.fitZ || n.data.curveX || n.data.curveY || n.data.curveZ) {
      throw new Error('rijitlikOlcek: nonlineer takozda ölçek yasası tanımsız');
    }
    ['kxs', 'kys', 'kzs', 'kxd', 'kyd', 'kzd'].forEach((k) => { n.data[k] = _sayi(n.data[k]) * b; });
  });
  return t;
}
// Kütüphanedeki nonlineer yasaları (fits) k_stat üçlüsü eşleşen takozlara tak.
function yasaTak(topo, kutuphane) {
  const t = _kopya(topo);
  t.nodes.filter(_takoz).forEach((n) => {
    const k = [_sayi(n.data.kxs), _sayi(n.data.kys), _sayi(n.data.kzs)];
    const key = Object.keys(kutuphane).find((kk) => {
      const e = kutuphane[kk];
      return e.fits && e.sx === k[0] && e.sy === k[1] && e.sz === k[2];
    });
    if (!key) return;
    const f = kutuphane[key].fits;
    n.data.fitX = f.x; n.data.fitY = f.y; n.data.fitZ = f.z;
  });
  return t;
}

module.exports = {
  G, kur, coz, ornek, kurguModel, kutuAtalet, dortluTakoz, genelModel,
  Arows, birlesikKutle, M6of, topla6, genelKuvvet,
  rodrigues, sehimSonlu, potansiyel, sayisalHessian, sayisalGradyan,
  sifir, matCarp, matVek, noktaCarp, norm, maksMutlak, coz6, det,
  cCoz, cAbs, frfHakem, fitKuvvet, fitTanjant,
  fHz, ozdeger2, sdofT, kubikKok, rotZ, rotX, tensorDondur, bagil,
  otele, aynala, takozSirasiTers, govdeBol, takozBol, kutleOlcek, rijitlikOlcek, yasaTak
};
