/**
 * cp-mount-viewer.js — 3D görüntüleyici işaret renkleri (tema uyumu)
 * ──────────────────────────────────────────────────────────────────
 * Takoz/bileşen/birleşik-CG işaretleri artık sabit parlak renkler yerine
 * temanın semantik accent değişkenlerini (--accent-success/-warning/-danger)
 * kullanır. Açık temada bu renkler koyulaşır VE emissive parıltı kapanır →
 * işaretler beyaz zemine karşı solmadan okunur. Bu "tema → renk" mantığı
 * gözle yakalanması zor sessiz regresyona açıktır (yanlış değişken, açık
 * temada açık kalan emissive), o yüzden test edilir.
 *
 * jsdom ortamı; THREE ve getComputedStyle hafifçe stub'lanır (WebGL yok).
 */

// ─── Minimal THREE stub'ı: Color (hex çöz + klon/çarp) + MeshPhongMaterial ───
function Color(v){ this.r = 1; this.g = 1; this.b = 1; if (typeof v === 'string') this.setStyle(v); }
Color.prototype.setStyle = function (s) {
  s = String(s || '').trim();
  var m = /^#([0-9a-fA-F]{6})$/.exec(s);
  if (m) { var n = parseInt(m[1], 16); this.r = ((n >> 16) & 255) / 255; this.g = ((n >> 8) & 255) / 255; this.b = (n & 255) / 255; }
  return this;
};
Color.prototype.clone = function () { var c = new Color(); c.r = this.r; c.g = this.g; c.b = this.b; return c; };
Color.prototype.multiplyScalar = function (s) { this.r *= s; this.g *= s; this.b *= s; return this; };
global.THREE = { Color: Color, MeshPhongMaterial: function (o) { Object.assign(this, o || {}); } };

// ─── Tema CSS değişkenlerini kontrol eden getComputedStyle stub'ı ────────────
let _cssVars = {};
global.getComputedStyle = function () {
  return { getPropertyValue: function (name) { return _cssVars[name] !== undefined ? _cssVars[name] : ''; } };
};
function setTheme(vars) { _cssVars = vars; }

eval(loadSource('cp-mount-viewer.js'));

// yardımcılar: hex → [r,g,b] (0..1) ve yaklaşık karşılaştırma
const HEX = (h) => { const n = parseInt(h, 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };
const near = (a, b) => Math.abs(a - b) < 1e-6;
const colorIs = (c, hex) => { const [r, g, b] = HEX(hex); return near(c.r, r) && near(c.g, g) && near(c.b, b); };

describe('cp-mount-viewer: işaret renkleri temaya uyar', () => {
  test('açık tema: accent değişkenini kullanır, emissive parıltı KAPALI (beyaza karşı solmaz)', () => {
    setTheme({ '--bg-primary': '#fafbfc', '--accent-success': '#1a9a50' });
    const mat = _mntViewerMarkerMat('--accent-success', '#22c55e', 30);
    expect(colorIs(mat.color, '1a9a50')).toBe(true);          // sabit yeşil değil, temanın yeşili
    expect(mat.emissive.r).toBe(0);                            // açık zeminde parıltı yok
    expect(mat.emissive.g).toBe(0);
    expect(mat.emissive.b).toBe(0);
    expect(mat.shininess).toBe(30);
  });

  test('koyu tema: accent değişkeni + hafif emissive parıltı (0.3 × taban)', () => {
    setTheme({ '--bg-primary': '#0a0c10', '--accent-success': '#16a34a' });
    const mat = _mntViewerMarkerMat('--accent-success', '#22c55e', 30);
    expect(colorIs(mat.color, '16a34a')).toBe(true);
    const [r, g, b] = HEX('16a34a');
    expect(near(mat.emissive.r, r * 0.3)).toBe(true);          // parıltı = tabanın 0.3 katı
    expect(near(mat.emissive.g, g * 0.3)).toBe(true);
    expect(near(mat.emissive.b, b * 0.3)).toBe(true);
    expect(mat.emissive.r + mat.emissive.g + mat.emissive.b).toBeGreaterThan(0);
  });

  test('değişken tanımsızsa yedek renge düşer (çökme yok)', () => {
    setTheme({ '--bg-primary': '#0a0c10' });                   // accent tanımsız
    const mat = _mntViewerMarkerMat('--accent-warning', '#f59e0b', 20);
    expect(colorIs(mat.color, 'f59e0b')).toBe(true);
  });

  test('rol → accent eşlemesi: birleşik CG = danger (kırmızı), shininess korunur', () => {
    setTheme({ '--bg-primary': '#fafbfc', '--accent-danger': '#d43d3d' });
    const mat = _mntViewerMarkerMat('--accent-danger', '#ef4444', 80);
    expect(colorIs(mat.color, 'd43d3d')).toBe(true);
    expect(mat.shininess).toBe(80);
  });
});
