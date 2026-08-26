/**
 * Tipografi ölçeği bekçisi — css/ + js/ + index.html
 * ─────────────────────────────────────────────────
 * Bu proje bir tipografi ölçeğine (--fs-*) geçirildi. Geçiş öncesinde 1110
 * font-size bildiriminde 61 FARKLI değer vardı; yalnız 9–16px arasında 24 ayrı
 * boyut. 10,24px ile 10,40px arasındaki farkı kimse görmez — yalnız programı
 * bakımsız gösterir.
 *
 * Ölçek "eriyen" bir kuraldır: bir sonraki değişiklikte biri `font-size:0.67rem`
 * yazar, kimse fark etmez, altı ay sonra yine 40 boyut olur. Bu test tam olarak
 * o erimeyi engelliyor. Bir bildirim eklerken --fs-* basamaklarından birini
 * seçmek zorunlu.
 *
 * MUAF olanlar açıkça listelenmiştir (aşağıya bak) — hepsi tasarım jetonu
 * DEĞİL, ya kullanıcı ayarı ya da CSS olmayan bir bağlam.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../../');

// Ölçek basamakları — css/styles.css :root bloğundan okunur, elle yazılmaz.
const cssSrc = fs.readFileSync(path.join(ROOT, 'css/styles.css'), 'utf8');

const OLCEK = (() => {
  const m = {};
  for (const x of cssSrc.matchAll(/--fs-([a-z0-9]+):\s*([\d.]+)rem/g)) {
    m['--fs-' + x[1]] = Math.round(parseFloat(x[2]) * 16 * 100) / 100;
  }
  return m;
})();

// Taranan dosyalar
const DOSYALAR = [
  'css/styles.css',
  'index.html',
  ...fs.readdirSync(path.join(ROOT, 'js')).filter((f) => f.endsWith('.js')).map((f) => 'js/' + f),
];

// MUAFİYETLER — her biri gerekçeli:
//   annotations.js     : kullanıcı tuval notunu +/- ile büyütür; boyut bir
//                        KULLANICI AYARI, tasarım jetonu değil.
//   cp-mount-report.js : MFSim arayüzüne değil, İNDİRİLEN BAĞIMSIZ bir HTML
//   cp-fead-report.js    rapor dosyasına yazıyor (Blob → a.download). O belgenin
//   cp-fead-summary.js   kendi tipografisi var ve --fs-* jetonlarına erişimi
//                        YOK; em-göreli ölçüler orada doğru olan. Üçü de
//                        belgenin KENDİ ölçeğini kendi :root'unda taşıyor.
//                        cp-fead-summary.js ayrıca A4 YATAY basılan bir belge:
//                        punto seçimi arayüz ölçeğine değil, sayfaya sığmaya
//                        bağlı (Sonuçlar penceresindeki TXT raporlarıyla aynı
//                        gerekçe).
const MUAF = ['js/annotations.js', 'js/cp-mount-report.js', 'js/cp-fead-report.js',
              'js/cp-fead-summary.js'];

// Serbest (jetona bağlanmamış) font-size bildirimi arar.
// `font-size:var(--fs-...)` biçimi geçerli; `font-size:12px` / `0.7rem` değil.
const SERBEST = /font-size:\s*(\d*\.?\d+)(rem|px|em|%)/g;

describe('tipografi ölçeği tanımı', () => {
  test('--fs-* jetonları tanımlı', () => {
    expect(Object.keys(OLCEK).length).toBeGreaterThanOrEqual(8);
  });

  test('ölçekte 9px altı basamak yok (okunabilirlik tabanı)', () => {
    const kucuk = Object.entries(OLCEK).filter(([, px]) => px < 9);
    expect(kucuk).toEqual([]);
  });

  test('arayüz aralığında (9–16px) basamaklar en az 1px ayrık', () => {
    const ui = Object.values(OLCEK).filter((px) => px >= 9 && px <= 16).sort((a, b) => a - b);
    const yakin = [];
    for (let i = 1; i < ui.length; i++) {
      if (ui[i] - ui[i - 1] < 1) yakin.push(ui[i - 1] + '/' + ui[i]);
    }
    expect(yakin).toEqual([]);
  });

  test('ölü --text-* ölçeği kaldırıldı (iki rakip sistem olmasın)', () => {
    expect(cssSrc).not.toMatch(/^\s*--text-(xs|sm|base|md|lg|xl|2xl):/m);
  });
});

describe('ölçek erimesin — serbest font-size bildirimi yok', () => {
  const bulgular = [];
  DOSYALAR.forEach((rel) => {
    if (MUAF.includes(rel)) return;
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    src.split('\n').forEach((line, i) => {
      for (const m of line.matchAll(SERBEST)) {
        bulgular.push(`${rel}:${i + 1}  ${m[0]}`);
      }
    });
  });

  test('hiçbir dosyada jetona bağlanmamış font-size yok', () => {
    // Hata mesajı doğrudan dosya:satır verir — nereyi düzelteceğin belli.
    expect(bulgular).toEqual([]);
  });

  test('taranan dosya sayısı beklenen büyüklükte (tarama sessizce boşalmasın)', () => {
    // Bu test, DOSYALAR listesi bir gün boşalırsa yukarıdaki testin sahte
    // yeşil vermesini engeller.
    expect(DOSYALAR.length).toBeGreaterThan(30);
  });

  test('ölçek gerçekten KULLANILIYOR (yalnız tanımlı değil)', () => {
    let kullanim = 0;
    DOSYALAR.forEach((rel) => {
      const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
      kullanim += (src.match(/font-size:var\(--fs-/g) || []).length;
    });
    expect(kullanim).toBeGreaterThan(900);
  });
});

describe('muafiyetler gerekçeli kalsın', () => {
  test('muaf dosya gerçekten kullanıcı ayarı kullanıyor', () => {
    const src = fs.readFileSync(path.join(ROOT, 'js/annotations.js'), 'utf8');
    // Muafiyetin sebebi: boyut kullanıcı tarafından değiştirilebiliyor.
    expect(src).toMatch(/annot\.fontSize/);
  });

  test.each(['js/cp-mount-report.js', 'js/cp-fead-report.js'])(
    '%s gerçekten bağımsız belge üretiyor', (f) => {
      const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
      // Muafiyetin sebebi: çıktı canlı arayüze değil, indirilen bir dosyaya gidiyor.
      expect(src).toMatch(/new Blob\(/);
      expect(src).toMatch(/\.download\s*=/);
    });

  // Özet rapor indirmeyi KENDİ yapmıyor (cp-fead-report.js'in _frDownload'ı
  // indiriyor); bağımsızlığının kanıtı, TAM bir belge ve kendi sayfa ölçeğini
  // üretmesi. Blob araması burada yanlış ölçüt olurdu.
  test('js/cp-fead-summary.js gerçekten bağımsız belge üretiyor', () => {
    const src = fs.readFileSync(path.join(ROOT, 'js/cp-fead-summary.js'), 'utf8');
    expect(src).toMatch(/<!DOCTYPE html>/);
    expect(src).toMatch(/@page\{size:A4 landscape/);
    expect(src).toMatch(/':root\{/);
  });

  test('muafiyet listesi büyümedi', () => {
    // Yeni muafiyet eklemek bilinçli bir karar olmalı; sessizce büyümesin.
    expect(MUAF).toEqual(['js/annotations.js', 'js/cp-mount-report.js',
                          'js/cp-fead-report.js', 'js/cp-fead-summary.js']);
  });
});
