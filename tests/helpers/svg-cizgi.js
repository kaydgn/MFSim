/**
 * svg-cizgi.js — ÇİZİMİN ÇİZGİLERİNİ PARÇALARA AYIRIR (birim testler için)
 * ───────────────────────────────────────────────────────────────────────────
 * Kayış yolu (`data-ve="belt"`: M · L açıklıklar · A sarım yayları) ve çember
 * doğru parçalarına; parça ↔ kutu kesişimi. FEAD kartının ve sihirbaz
 * masasının "yazı kayışın/kolun üstüne düşmez" kapıları aynı ölçütü kullansın
 * diye tek yerde. Gerçek tarayıcıdaki karşılığı: tests/helpers/yerlesim-olcu.js
 * → "cizgi".
 */

// SVG yay komutunu (rx = ry, dönüşsüz) uç noktalarından merkeze çevirip örnekler.
function yayParcalari(x1, y1, r0, fa, fs, x2, y2, n) {
  const out = [];
  const hx = (x1 - x2) / 2, hy = (y1 - y2) / 2, d2 = hx * hx + hy * hy, r = Math.max(r0, Math.sqrt(d2));
  const q = Math.sqrt(Math.max(0, (r * r - d2) / (d2 || 1))) * (fa === fs ? -1 : 1);
  const ox = q * hy + (x1 + x2) / 2, oy = -q * hx + (y1 + y2) / 2;
  const t1 = Math.atan2(y1 - oy, x1 - ox);
  let dt = Math.atan2(y2 - oy, x2 - ox) - t1;
  if (fs === 1 && dt < 0) dt += 2 * Math.PI;
  if (fs === 0 && dt > 0) dt -= 2 * Math.PI;
  let px = x1, py = y1;
  for (let k = 1; k <= (n || 24); k++) {
    const t = t1 + dt * k / (n || 24), nx = ox + r * Math.cos(t), ny = oy + r * Math.sin(t);
    out.push([px, py, nx, ny]); px = nx; py = ny;
  }
  return out;
}

// Kayışın yolu → [[x1, y1, x2, y2], …] (açıklıklar + örneklenmiş yaylar)
function kayisParcalari(svg) {
  const m = String(svg).match(/<path data-ve="belt"[^>]* d="([^"]+)"/);
  if (!m) return [];
  const tok = m[1].match(/[MLAZ]|-?[\d.]+(?:e-?\d+)?/g), out = [];
  let i = 0, cx = 0, cy = 0;
  while (i < tok.length) {
    const c = tok[i++];
    if (c === 'M') { cx = +tok[i++]; cy = +tok[i++]; }
    else if (c === 'L') { const x = +tok[i++], y = +tok[i++]; out.push([cx, cy, x, y]); cx = x; cy = y; }
    else if (c === 'A') {
      const r0 = +tok[i++]; i += 2;
      const fa = +tok[i++], fs = +tok[i++], x2 = +tok[i++], y2 = +tok[i++];
      yayParcalari(cx, cy, r0, fa, fs, x2, y2).forEach((p) => out.push(p));
      cx = x2; cy = y2;
    }
  }
  return out;
}

// Çember → parçalar
function cemberParcalari(cx, cy, r, n) {
  const out = [], N = n || 32;
  for (let i = 0; i < N; i++) {
    const a0 = i / N * 2 * Math.PI, a1 = (i + 1) / N * 2 * Math.PI;
    out.push([cx + r * Math.cos(a0), cy + r * Math.sin(a0), cx + r * Math.cos(a1), cy + r * Math.sin(a1)]);
  }
  return out;
}

// Parça ↔ kutu {x0, x1, y0, y1}
function parcaKutu(g, r) {
  const x1 = g[0], y1 = g[1], x2 = g[2], y2 = g[3];
  if (Math.max(x1, x2) < r.x0 || Math.min(x1, x2) > r.x1) return false;
  if (Math.max(y1, y2) < r.y0 || Math.min(y1, y2) > r.y1) return false;
  if ((x1 >= r.x0 && x1 <= r.x1 && y1 >= r.y0 && y1 <= r.y1) || (x2 >= r.x0 && x2 <= r.x1 && y2 >= r.y0 && y2 <= r.y1)) return true;
  const dx = x2 - x1, dy = y2 - y1, yan = (x, y) => dx * (y - y1) - dy * (x - x1);
  const a = yan(r.x0, r.y0), b = yan(r.x1, r.y0), c = yan(r.x1, r.y1), d = yan(r.x0, r.y1);
  return !((a > 0 && b > 0 && c > 0 && d > 0) || (a < 0 && b < 0 && c < 0 && d < 0));
}

// Çizicinin ad ve açı yazıları → kutu (etW = 0,6 × punto; 1 px içeriden).
// Kırpılmış adın <title>'ı atlanır.
function yaziKutulari(svg, ve, fs) {
  return [...String(svg).matchAll(new RegExp('<text data-ve="' + ve
    + '" x="([-\\d.]+)" y="([-\\d.]+)" text-anchor="(\\w+)" font-size="' + fs + '"[^>]*>(?:<title>[^<]*</title>)?([^<]*)<', 'g'))]
    .map((m) => {
      const x = +m[1], y = +m[2], w = m[4].length * fs * 0.6;
      const x0 = m[3] === 'middle' ? x - w / 2 : m[3] === 'start' ? x : x - w;
      return { t: m[4], x0: x0 + 1, x1: x0 + w - 1, y0: y - fs + 2, y1: y + 1 };
    });
}

module.exports = { yayParcalari, kayisParcalari, cemberParcalari, parcaKutu, yaziKutulari };
