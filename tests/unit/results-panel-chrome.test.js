/**
 * results-panel-chrome.test.js — Sonuçlar ekranının ÜST KROMU
 *
 * KULLANICI ŞİKÂYETİ (2026-08-17, ekran görüntüsüyle): "kırmızı ile çizdiğim
 * yer yanı ile denk gelmiyor, yani pencere yapısı biraz kaymış orada. Yeşil
 * olarak çizdiğim yerde de 'Ölçüm Penceresi' yazıyor. Ona da gerek yok.
 * Altındaki yapı da biraz karışık zaten."
 *
 * TARAYICIDA ÖLÇÜLEN:
 *   • Sol panel başlığı 116–156 (40px), sağdaki ölçüm penceresi araç çubuğu
 *     116–151 (35px) → ekranın tepesinden geçen tek yatay çizgi panel
 *     ayırıcısında 5px kırılıyordu.
 *   • Sol panelin üstü ağaca gelene kadar ÜÇ çubuğa bölünüyordu:
 *     başlık / arama / iki satırlık filtre — üstelik filtrenin üst satırı
 *     yalnız "ÖLÇÜM PENCERESİ" başlığını taşıyordu (aynı ad şeritteki grupta
 *     ve sağdaki panoda zaten var).
 *
 * Buradaki testler görsel ayrıntıyı değil, o ayrıntıların DAYANDIĞI yapısal
 * kararları tutar: ölçünün tek kaynaktan gelmesi ve bilginin (şerit sayısı)
 * kaybolmamış olması.
 */

const fs = require('fs');
const path = require('path');

const css = fs.readFileSync(path.join(__dirname, '../../css/styles.css'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '../../index.html'), 'utf8');

// Bir CSS kuralının gövdesini çek (ilk eşleşme).
function kural(secici) {
  const i = css.indexOf(secici + '{');
  if (i < 0) return null;
  return css.slice(i + secici.length + 1, css.indexOf('}', i));
}

describe('üst bant — iki yarı TEK ölçü kaynağından beslenir', () => {
  test('--results-bar-h tanımlı', () => {
    expect(css).toMatch(/--results-bar-h:\s*\d+px/);
  });

  test('sol yarı (.ve-results-head) yüksekliğini o değişkenden alır', () => {
    const k = kural('.ve-results-head');
    expect(k).not.toBeNull();
    expect(k).toContain('min-height:var(--results-bar-h)');
  });

  test('sağ yarı (.ve-trace-toolbar) da aynı değişkeni kullanır', () => {
    const k = kural('.ve-trace-toolbar');
    expect(k).not.toBeNull();
    expect(k).toContain('min-height:var(--results-bar-h)');
  });

  // Sabit height olsaydı dar pencerede sarılan düğmeler bandın dışına taşardı.
  test('ikisi de min-height kullanır, sabit height DEĞİL', () => {
    expect(kural('.ve-results-head')).not.toMatch(/(^|;)\s*height:/);
    expect(kural('.ve-trace-toolbar')).not.toMatch(/(^|;)\s*height:/);
  });

  // ANTİ-AYRIŞMA: başlık ölçüsünü index.html'de satır-içi tutarsa, CSS'teki
  // ortak değişken değişince sol yarı yerinde kalır ve bant yine kırılır —
  // arıza tam olarak böyle doğmuştu.
  test('index.html başlığı kendi ölçüsünü satır-içi yazmaz', () => {
    const m = html.match(/<div class="ve-results-head"[^>]*>/);
    expect(m).not.toBeNull();
    expect(m[0]).not.toMatch(/padding|height/);
  });
});

describe('sinyal listesi araç çubuğu — tek satır, bilgi korunur', () => {
  const src = fs.readFileSync(path.join(__dirname, '../../js/signal-tree.js'), 'utf8');
  const govde = src.slice(src.indexOf('function veSigToolbarHTML'),
                          src.indexOf('function veSigCollapseAll'));

  test('"Ölçüm penceresi" başlığı üretilmiyor', () => {
    expect(govde).not.toContain('vsig-tl-label');
  });

  test('tek satır kalıyor (iki .vsig-tl-row açılmıyor)', () => {
    expect((govde.match(/class="vsig-tl-row"/g) || []).length).toBe(1);
  });

  // Başlık gitti, BİLGİ gitmedi: şerit sayısı ve üç filtre düğmesi duruyor.
  test('şerit sayacı ve filtre düğmeleri hâlâ üretiliyor', () => {
    expect(govde).toContain('vsig-tl-count');
    expect(govde).toContain("['all', 'Tümü']");
    expect(govde).toContain('collapse-all');
  });

  // İkisinde birden margin-left:auto olsaydı boşluğu paylaşır, sayaç satırın
  // ortasına düşerdi.
  test('sağa itmeyi YALNIZ sayaç yapar', () => {
    expect(kural('.vsig-tl-count')).toContain('margin-left:auto');
    expect(kural('.vsig-mini')).not.toContain('margin-left:auto');
  });
});

describe('ağaç satırı — ok sütunu oksuz satırlarda da yer tutar', () => {
  test('oksuz satırın simgesi ok genişliği kadar içeri alınır', () => {
    expect(kural('.ve-tree-row > .icon:first-child')).toContain('margin-left:18px');
  });

  // 18 = ok genişliği + satır boşluğu. Ayrışırsa hiza yine bozulur.
  test('girinti, ok genişliği + boşluk toplamına eşit', () => {
    const okW = parseInt((kural('.ve-tree-row .arrow').match(/width:(\d+)px/) || [])[1], 10);
    const bosluk = parseInt((kural('.ve-tree-row').match(/gap:(\d+)px/) || [])[1], 10);
    const girinti = parseInt((kural('.ve-tree-row > .icon:first-child').match(/margin-left:(\d+)px/) || [])[1], 10);
    expect(okW + bosluk).toBe(girinti);
  });

  // Sabit height'ken sarılan etiketin ikinci satırı alttaki satırın üstüne
  // biniyordu (panel daraltılınca hep olur).
  test('satır sabit yükseklikte değil — uzun etiket çakışmaz', () => {
    const k = kural('.ve-tree-row');
    expect(k).toContain('min-height:var(--vsig-row)');
    expect(k).not.toMatch(/(^|;)\s*height:var\(--vsig-row\)/);
  });
});
