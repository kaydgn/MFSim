/**
 * results-txt-page.test.js — TXT raporunun SONUÇLAR PENCERESİNDEKİ görünümü
 * ────────────────────────────────────────────────────────────────────────
 * KULLANICI ŞİKÂYETİ (2026-08-25, ekran görüntüsüyle): "sonuçlar penceresi
 * üzerinde TXT raporları sanki bir fiş gibi duruyor… Burası normal bir A4
 * boyutunda olsun. … Ayrıca başlığın yazdığı header, 'Veri Gezgini' headeri
 * ile aynı doğrultuda ve boyutta değil."
 *
 * TARAYICIDA ÖLÇÜLEN (1600×950, gerçek Tam Gaz raporu):
 *
 *   1) FİŞ — metin boş-satır bloklarına ayrılıp her blok AYRI ortalanıyordu.
 *      Raporun iki sütun genişliği var (dar bölümler ~80, geniş tablolar 119
 *      karakter), dolayısıyla bloklar birbirine göre kayıyordu:
 *      43 <pre> bloğu, 10 ayrı sol kenar, 222px yayılım. Sütun hizası blok
 *      İÇİNDE korunuyor ama bloklar ARASINDA bozuluyordu — yani ortalamanın
 *      kazandırdığı hiçbir şey yoktu.
 *
 *   2) HEADER — rapor bandı 48px, soldaki "Veri Gezgini" bandı 36px; alt
 *      çizgiler 12px kayık, çizgi 2px'e karşı 1px, başlık 13px'e karşı 12px.
 *      Bu, 2026-08-17'de .ve-results-head ↔ .ve-trace-toolbar arasında
 *      kapatılan kırılmanın aynısıydı; rapor overlay'i o düzeltmeye dahil
 *      edilmemişti (bkz. results-panel-chrome.test.js).
 *
 * Buradaki testler piksel değil, o piksellerin DAYANDIĞI kararları tutar:
 * ölçünün tek kaynaktan gelmesi, sayfanın A4 olması, metnin tek blok kalması
 * ve font ölçüsünün sayfaya SIĞMAKTAN türemesi. Gerçek ölçüm E2E'de
 * (tests/e2e/results-txt-page.spec.js).
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../../');
const css = fs.readFileSync(path.join(ROOT, 'css/styles.css'), 'utf8');
const src = fs.readFileSync(path.join(ROOT, 'js/results.js'), 'utf8');

// Bir CSS kuralının gövdesini çek (ilk eşleşme).
function kural(secici) {
  const i = css.indexOf(secici + '{');
  if (i < 0) return null;
  return css.slice(i + secici.length + 1, css.indexOf('}', i));
}
// :root'taki bir değişkenin değeri. Yorumlar önce sıyrılır — bu dosyadaki
// jetonların gerekçesi yorumda anlatılıyor ve orada da "--rep-ch:" geçiyor.
const cssKod = css.replace(/\/\*[\s\S]*?\*\//g, '');
function jeton(ad) {
  const m = cssKod.match(new RegExp('\\' + ad + ':\\s*([^;]+);'));
  return m && m[1].trim();
}

const stubs = stubGlobals();
global.COMPONENT_SIGNALS = {};
global.componentDefs = {};
global.connections = [];
global.nodes = [];
global.veTabs = [{ id: 't1', name: 'T1', state: { simResults: null, nodes: [], connections: [] } }];
global.veActiveTabIdx = 0;
global.canvasOffset = { x: 0, y: 0 };
global.canvasZoom = 1;
global.compCounter = 0;
global.veProjectName = 'Test';
global.SENSOR_PACKAGES = [];

eval(loadSource('measure-core.js'));
eval(loadSource('signal-tree.js'));
eval(loadSource('trace-view.js'));
eval(loadSource('results.js'));

// ─────────────────────────────────────────────────────────────────────────
describe('üst bant — soldaki "Veri Gezgini" bandıyla TEK ölçü kaynağı', () => {
  test('.ve-rep-head yüksekliğini --results-bar-h\'tan alır', () => {
    const k = kural('.ve-rep-head');
    expect(k).not.toBeNull();
    expect(k).toContain('min-height:var(--results-bar-h)');
  });

  test('sol yarı (.ve-results-head) da aynı değişkeni kullanır', () => {
    // İkisi ayrı sayı tutarsa bant panel ayırıcısında yine kırılır.
    expect(kural('.ve-results-head')).toContain('min-height:var(--results-bar-h)');
  });

  test('alt çizgi iki bantta da 1px (rapor bandı 2px çiziyordu)', () => {
    expect(kural('.ve-rep-head')).toContain('border-bottom:1px solid var(--border-color)');
    expect(kural('.ve-results-head')).toContain('border-bottom:1px solid var(--border-color)');
  });

  test('başlık ölçüsü iki bantta da --fs-md', () => {
    expect(kural('.ve-rep-head-title')).toContain('font-size:var(--fs-md)');
    expect(kural('.ve-results-head-title')).toContain('font-size:var(--fs-md)');
  });

  test('zemin de aynı (bant tek parça görünsün)', () => {
    const g = /background:linear-gradient\(180deg, var\(--bg-tertiary\), var\(--bg-secondary\)\)/;
    expect(kural('.ve-rep-head')).toMatch(g);
    expect(kural('.ve-results-head')).toMatch(g);
  });

  test('düğmeler ölçüm penceresi araç çubuğunun düğmesini PAYLAŞIR', () => {
    // İkinci bir düğme stili tutmanın karşılığı yok: aynı bandın iki yarısı.
    const yuzey = veTxtPreviewHTML('X', 'abc');
    const dugmeler = yuzey.split('<button').slice(1).map((b) => b.split('>')[0]);
    expect(dugmeler.length).toBeGreaterThanOrEqual(4);
    dugmeler.forEach((d) => expect(d).toMatch(/class="ve-trace-btn/));
    // Kapat düğmesi tehlike rengini de aynı sınıf ailesinden alır.
    expect(yuzey).toContain('class="ve-trace-btn danger"');
  });

  test('bandı kuran TEK yer var — satır içi kopya kalmadı', () => {
    // Beş panel (dört TXT + Detaylı Rapor) bandı satır içi stille
    // kopyalıyordu; biri düzeltilince diğer dördü sessizce ayrışıyordu.
    expect(src).not.toContain('padding:10px 16px; background:var(--bg-secondary)');
    expect((src.match(/class="ve-rep-head"/g) || []).length).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe('sayfa A4 — fiş değil', () => {
  test('sayfa ölçüsü 210×297 mm @96dpi', () => {
    expect(jeton('--rep-page-w')).toBe('794px');   // 210 mm
    expect(jeton('--rep-page-h')).toBe('1123px');  // 297 mm
  });

  test('.ve-rep-page ölçüsünü o jetonlardan alır, içeriğe göre BÜYÜMEZ', () => {
    const k = kural('.ve-rep-page');
    expect(k).toContain('width:var(--rep-page-w)');
    expect(k).toContain('min-height:var(--rep-page-h)');
    // "fiş"in kaynağı: kutu içeriğe göre daralıyordu.
    expect(k).not.toContain('width:fit-content');
  });

  test('metinle zemin arasındaki gölge farkı korunur (kullanıcı istedi)', () => {
    const k = kural('.ve-rep-page');
    expect(k).toMatch(/box-shadow:[^;]+/);
    expect(k).toContain('background:var(--bg-secondary)');
    expect(kural('.ve-rep-doc')).toContain('background:var(--bg-primary)');
  });

  test('gövde TEK <pre> — blok blok ortalama yok', () => {
    const metin = 'BASLIK\n\n  a : 1\n  b : 2\n\n\nDAHA GENIS BIR TABLO SATIRI |  x\n';
    const html = veRenderTXTBody(metin);
    expect((html.match(/<pre/g) || []).length).toBe(1);
    expect(html).not.toContain('margin:0 auto');
    expect(html).not.toContain('fit-content');
  });

  test('metin bire bir korunur (boş satırlar dahil) ve kaçışlanır', () => {
    const metin = 'A\n\n\nB < C & D\n';
    const html = veRenderTXTBody(metin);
    const govde = html.slice(html.indexOf('>') + 1, html.lastIndexOf('</pre>'));
    expect(govde).toBe('A\n\n\nB &lt; C &amp; D\n');
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe('font ölçüsü sayfaya SIĞMAKTAN türer', () => {
  test('veTxtCols en uzun satırı verir (kutu-çizimi karakterleri dahil)', () => {
    expect(veTxtCols('abc\n  ┌────────┐\nx')).toBe(12);
    expect(veTxtCols('')).toBe(1);        // sıfıra bölme olmasın
    expect(veTxtCols(null)).toBe(1);
  });

  test('sayfa değişkenleri sütun sayısını ve karakter oranını taşır', () => {
    const v = veTxtPageVars('kisa\nbu satir daha uzun');   // 18 karakter
    expect(v).toContain('--rep-cols:18');
    expect(v).toMatch(/--rep-ch:[\d.]+/);
  });

  test('karakter oranı ölçülemezse GÜVENLİ varsayılana düşer', () => {
    // Güvenli taraf = büyük oran = küçük font = taşma yerine boşluk.
    delete window._veTxtChRatio;
    const gercek = document.body.appendChild;
    document.body.appendChild = () => { throw new Error('DOM yok'); };
    try {
      expect(veTxtCharRatio()).toBeCloseTo(0.62, 3);
    } finally {
      document.body.appendChild = gercek;
      delete window._veTxtChRatio;
    }
  });

  test('CSS ölçüyü sayfa genişliğinden hesaplar ve OKUNUR bir tavana bağlar', () => {
    const k = kural('.ve-rep-page pre');
    expect(k).toContain('min(var(--rep-fs-max)');
    expect(k).toContain('var(--rep-page-w) - 2 * var(--rep-page-pad)');
    expect(k).toContain('var(--rep-cols');
    expect(k).toContain('var(--rep-ch)');
    // Tavan olmasaydı 80 sütunluk kısa raporlar dev puntoyla açılırdı.
    expect(jeton('--rep-fs-max')).toBe('11px');
  });

  test('119 sütunluk gerçek rapor A4 içerik alanına SIĞAR', () => {
    // Ölçülen gerçek genişlik: Tam Gaz raporunda en uzun satır 119 karakter.
    const w = parseFloat(jeton('--rep-page-w'));
    const pad = parseFloat(jeton('--rep-page-pad'));
    const tavan = parseFloat(jeton('--rep-fs-max'));
    const ch = parseFloat(jeton('--rep-ch'));          // güvenli varsayılan
    const fs = Math.min(tavan, (w - 2 * pad) / 119 / ch);
    expect(119 * fs * ch).toBeLessThanOrEqual(w - 2 * pad + 0.01);
    expect(fs).toBeGreaterThan(8);                      // okunabilirlik tabanı
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe('indirilen HTML de aynı sayfayı açar', () => {
  const fn = src.slice(src.indexOf('function veBuildReportHTML('));
  const govde = fn.slice(0, fn.indexOf('\n}\n'));

  test('A4 ölçüsü ve kenar boşluğu belgeye gömülü', () => {
    expect(govde).toContain('--rp-w:794px');
    expect(govde).toContain('min-height:1123px');
  });

  test('font kuralı önizlemedekiyle aynı biçimde türer', () => {
    expect(govde).toContain('min(var(--rp-fs-max)');
    expect(govde).toContain('--rp-cols:');
    expect(govde).toContain('--rp-ch:');
  });

  test('baskıda gerçekten A4 sayfaya basar', () => {
    expect(govde).toMatch(/@page\{size:A4;margin:\d+mm;\}/);
  });

  test('gövde tek <pre> üreticisinden gelir (ikinci kopya yok)', () => {
    expect(govde).toContain('veRenderTXTBody(content)');
  });
});
