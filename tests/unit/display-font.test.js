/**
 * display-font.test.js
 * ────────────────────
 * ATÖLYE'NİN BAŞLIK YÜZÜ — üç sessiz hata sınıfına karşı.
 *
 * 1) EKSİK ALT KÜME. Yüz iki parça hâlinde geliyor: `latin` Türkçe'nin ı'sını
 *    (U+0131) taşıyor, `latin-ext` ğ/ş/İ/Ğ/Ş'yi (U+0100-02BA). Biri eksik
 *    olursa hata GÖRÜNÜR ama SESSİZDİR: "Çözücü" başlığı ekranda iki ayrı
 *    yazı tipiyle yazılır ve hiçbir şey patlamaz.
 *
 * 2) BAYAT DOSYA. `css/fonts-display.css` ÜRETİLİYOR (elle düzenlenmez);
 *    kaynağı `js/mount-report-assets.js`. Rapor varlıkları yeniden üretilirse
 *    (yeni KaTeX, yeni alt küme) bu dosya sessizce geride kalır.
 *
 * 3) YANLIŞ YÜZEYE BAĞLAMA. Serif bir BAŞLIK yüzüdür, bir boyut basamağı
 *    değil. `--fs-h2` aynı anda pencere başlığında, `✕` kapatma düğmesinde ve
 *    FEAD'in "1. elastik mod" SAYISINDA geçiyor — boyuta göre bağlanan bir
 *    kural serifi bir çarpı işaretine yazardı.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '../..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

const FONT = read('css/fonts-display.css');
const STYLES = read('css/styles.css');

const YUZLER = FONT.match(/@font-face\s*\{[^}]*\}/g) || [];

describe('Atölye başlık yüzü — dosyanın kendisi', () => {
  test('tam İKİ yüz var ve ikisi de Source Serif 4', () => {
    expect(YUZLER).toHaveLength(2);
    YUZLER.forEach((b) => {
      expect(b).toMatch(/font-family:\s*['"]?Source Serif 4/);
      expect(b).toMatch(/font-style:\s*normal/);
    });
  });

  // Yüz statik 600; arayüzde 700 isteyen başlıklar var. Tek bir 600
  // bildirilseydi tarayıcı 700'ü SENTETİK kalınlaştırırdı (bulanık kenar).
  test('ağırlık 600-700 ARALIĞI — sentetik kalınlaştırma kapalı', () => {
    YUZLER.forEach((b) => expect(b).toMatch(/font-weight:\s*600\s+700/));
  });

  test('yüz yüklenene kadar yedek çizilir (font-display:swap)', () => {
    YUZLER.forEach((b) => expect(b).toMatch(/font-display:\s*swap/));
  });

  test('gömülü woff2 — açılışta ağ isteği YOK', () => {
    YUZLER.forEach((b) => expect(b).toMatch(/src:\s*url\(data:font\/woff2;base64,/));
  });

  // TÜRKÇE KAPISI: iki alt kümenin BİRLİKTE kapsadığı küme ölçülür.
  test('iki alt küme birlikte Türkçe alfabeyi kapsıyor', () => {
    const araliklar = [];
    YUZLER.forEach((b) => {
      const ur = (/unicode-range:\s*([^;}]+)/.exec(b) || [])[1] || '';
      ur.split(',').forEach((p) => {
        const m = /U\+([0-9A-Fa-f]+)(?:-([0-9A-Fa-f]+))?/.exec(p.trim());
        if (m) araliklar.push([parseInt(m[1], 16), parseInt(m[2] || m[1], 16)]);
      });
    });
    expect(araliklar.length).toBeGreaterThan(4);
    const kapsar = (cp) => araliklar.some(([a, b]) => cp >= a && cp <= b);
    const eksik = [...'çğıöşüÇĞİÖŞÜ'].filter((h) => !kapsar(h.codePointAt(0)));
    expect(eksik).toEqual([]);
  });

  test('üreteçten BİREBİR yeniden üretiliyor (bayat değil)', () => {
    const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mfsim-font-')), 'fonts-display.css');
    execFileSync(process.execPath, [path.join(ROOT, 'tools/build-display-font.js')], {
      cwd: ROOT, env: Object.assign({}, process.env, { MFSIM_DISPLAY_FONT_OUT: tmp }),
    });
    expect(fs.readFileSync(tmp, 'utf8')).toBe(FONT);
  }, 30000);
});

describe('Atölye başlık yüzü — nereye bağlandı', () => {
  test('--font-display tanımlı ve yedeği SERİF', () => {
    const m = /--font-display:\s*([^;]+);/.exec(STYLES);
    expect(m).not.toBeNull();
    expect(m[1]).toMatch(/Source Serif 4/);
    // Yedek sans olsaydı yüz yüklenemediğinde başlık ile gövde arasındaki
    // ayrım SESSİZCE kaybolurdu.
    expect(m[1].trim()).toMatch(/serif\s*$/);
    expect(m[1]).not.toMatch(/sans-serif/);
  });

  // Yorumlar ÖNCE düşer: kuralın hemen üstündeki gerekçe bloğu da `{`'ten
  // önce duruyor ve seçici sanılırdı (ilk yazımda tam olarak bu oldu —
  // kapı kendi ölçtüğü metnin yarısını yorumdan okuyordu).
  function baglamaKurali() {
    const temiz = STYLES.replace(/\/\*[\s\S]*?\*\//g, '');
    const m = /([^{}]*)\{\s*font-family:\s*var\(--font-display\)/.exec(temiz);
    return m ? m[1] : '';
  }

  test('başlık ELEMANLARI bağlı (JS 116 sınıfsız <h3> üretiyor)', () => {
    const sec = baglamaKurali();
    ['h1', 'h2', 'h3', 'h4'].forEach((h) => {
      expect(sec.split(',').map((x) => x.trim())).toContain(h);
    });
  });

  // NEGATİF KAPI — ölçüldü: `--fs-*` başlık boyutlarını kullanan 18 CSS
  // kuralının 9'u İKON, arama girdisi ya da `+` düğmesi. Boyuta göre
  // bağlayan bir kural bunları da serife çevirirdi.
  test('ikon · arama girdisi · sayı YÜZEYLERİ bağlı DEĞİL', () => {
    const sec = baglamaKurali();
    ['.mf-ico', '.ve-cmdk-search-ico', '#ve-cmdk-input', '.ve-tab-add',
      '.ve-prop-empty-icon', '.ve-trace-empty-ico', '.ve-imp-drop-ico'].forEach((s) => {
      expect(sec).not.toContain(s);
    });
  });

  test('gövde hâlâ sans — serif YALNIZ başlıkta', () => {
    expect(STYLES).toMatch(/body\s*\{[^}]*font-family:\s*var\(--font-sans\)/);
  });

  test('üç ürün de yüzü yüklüyor', () => {
    [['index.html', 'css/fonts-display.css'],
      ['viewer/index.html', '../css/fonts-display.css'],
      ['candbc/index.html', '../css/fonts-display.css']].forEach(([f, yol]) => {
      expect(read(f)).toContain('href="' + yol + '"');
    });
  });
});
