/**
 * Katman düzeni bekçisi — css/styles.css + js/
 * ───────────────────────────────────────────
 * Krom bandı ile pencereler arasındaki sıra bir KULLANICI HATASI olarak
 * bildirildi: radyo paneli, komut paleti ve yardım penceresi kromun ARKASINDA
 * kalıyordu. Sebep sistemsizlikti — 52 z-index bildiriminde 27 farklı değer
 * vardı; krom 99998'de, o pencereler 9998–10000 arasındaydı.
 *
 * Artık dokuz adlandırılmış bant var (--z-canvas-ui … --z-boot). Bu test iki
 * şeyi güvenceye alıyor:
 *
 *   1. Bantlar TANIMLI ve KESİN ARTAN. Sıra bozulursa (ör. --z-widget
 *      --z-modal'ın üstüne çıkarsa) radyo pencerelerin önüne geçer.
 *   2. Yeni bir katman SAYI UYDURARAK eklenemez. Asıl hata buradan geldi:
 *      biri `z-index:10000` yazdı, o gün çalıştı, krom yükselince arkada kaldı.
 *
 * Ayrıca JS'te oluşturulan TAM EKRAN örtülerin kromun üstünde olduğu
 * doğrulanıyor — kullanıcının bildirdiği hata sınıfı tam olarak bu.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../../');
const cssSrc = fs.readFileSync(path.join(ROOT, 'css/styles.css'), 'utf8');

// Bantları :root'tan oku (elle yazma — kaynak tek).
const BANT = (() => {
  const m = {};
  for (const x of cssSrc.matchAll(/--z-([a-z-]+):\s*(\d+)\s*;/g)) m[x[1]] = parseInt(x[2], 10);
  return m;
})();

const SIRA = ['canvas-ui', 'float', 'overlay', 'chrome', 'menu', 'widget', 'modal', 'toast', 'boot'];

describe('katman bantları', () => {
  test('dokuz bandın hepsi tanımlı', () => {
    expect(SIRA.filter((k) => BANT[k] === undefined)).toEqual([]);
  });

  test('bantlar KESİN ARTAN', () => {
    const bozuk = [];
    for (let i = 1; i < SIRA.length; i++) {
      if (!(BANT[SIRA[i]] > BANT[SIRA[i - 1]])) {
        bozuk.push(`${SIRA[i - 1]}(${BANT[SIRA[i - 1]]}) → ${SIRA[i]}(${BANT[SIRA[i]]})`);
      }
    }
    expect(bozuk).toEqual([]);
  });

  test('bandın anlamı korunuyor: krom < menü < araç < pencere < bildirim', () => {
    // Kullanıcının bildirdiği hatanın tam tersi: pencere kromun ÜSTÜNDE olmalı.
    expect(BANT.chrome).toBeLessThan(BANT.menu);
    expect(BANT.menu).toBeLessThan(BANT.widget);
    expect(BANT.widget).toBeLessThan(BANT.modal);
    expect(BANT.modal).toBeLessThan(BANT.toast);
    expect(BANT.toast).toBeLessThan(BANT.boot);
  });

  test('bantlar arasında sıralama payı var (aynı bantta +1/+2 yapılabilsin)', () => {
    for (let i = 1; i < SIRA.length; i++) {
      expect(BANT[SIRA[i]] - BANT[SIRA[i - 1]]).toBeGreaterThanOrEqual(100);
    }
  });
});

describe('CSS: küresel katmanlar sayı uydurarak yazılamaz', () => {
  // Tuval içi katmanlar (≤150) kendi yığın bağlamlarında kalır ve küresel
  // sıraya karışmaz — onlar serbest. Bunun üstündeki her değer küresel bir
  // iddiadır ve bir banda bağlanmalıdır.
  const ESIK = 150;
  const ciplak = [];
  cssSrc.split('\n').forEach((line, i) => {
    for (const m of line.matchAll(/z-index:\s*(\d+)/g)) {
      const v = parseInt(m[1], 10);
      if (v > ESIK) ciplak.push(`css/styles.css:${i + 1}  z-index:${v}`);
    }
  });

  test(`${ESIK}px üstünde çıplak z-index yok`, () => {
    expect(ciplak).toEqual([]);
  });

  test('bantlar gerçekten kullanılıyor', () => {
    const kullanim = (cssSrc.match(/z-index:\s*(?:var\(--z-|calc\(var\(--z-)/g) || []).length;
    expect(kullanim).toBeGreaterThanOrEqual(14);
  });
});

describe('JS: tam ekran örtüler kromun ÜSTÜNDE', () => {
  // Kullanıcının bildirdiği hata sınıfı: JS'te oluşturulan bir pencere
  // kromun altında kalıyor. Tam ekran örtüyü şuradan tanıyoruz: position:fixed
  // + (inset:0 | top:0 ... left:0) aynı stil dizesinde.
  const jsFiles = fs.readdirSync(path.join(ROOT, 'js')).filter((f) => f.endsWith('.js'));
  const dusuk = [];
  jsFiles.forEach((f) => {
    const src = fs.readFileSync(path.join(ROOT, 'js', f), 'utf8');
    src.split('\n').forEach((line, i) => {
      if (!/position:\s*fixed/.test(line)) return;
      const tamEkran = /inset:\s*0/.test(line) ||
        (/top:\s*0/.test(line) && /left:\s*0/.test(line) &&
         (/right:\s*0/.test(line) || /width:\s*100(vw|%)/.test(line)));
      if (!tamEkran) return;
      const z = line.match(/z-index:\s*(\d+)/);
      if (!z) return;                       // jetonla ya da sınıfla yazılmış
      if (parseInt(z[1], 10) <= BANT.chrome) {
        dusuk.push(`js/${f}:${i + 1}  z-index:${z[1]} (krom ${BANT.chrome})`);
      }
    });
  });

  test('hiçbir tam ekran örtü kromun altında değil', () => {
    // Hata mesajı dosya:satır verir — o örtü açıldığında kromun arkasında kalır.
    expect(dusuk).toEqual([]);
  });

  test('tarama gerçekten örtü buluyor (sessizce boşalmasın)', () => {
    let bulunan = 0;
    jsFiles.forEach((f) => {
      const src = fs.readFileSync(path.join(ROOT, 'js', f), 'utf8');
      bulunan += (src.match(/position:\s*fixed[^'"`]*inset:\s*0/g) || []).length;
    });
    expect(bulunan).toBeGreaterThan(5);
  });
});

describe('krom bandı tek satır', () => {
  test('--titlebar-h kaldırıldı (iki bant geri gelmesin)', () => {
    expect(cssSrc).not.toMatch(/--titlebar-h\s*:/);
  });

  test('--chrome-h doğrudan şeridin yüksekliği', () => {
    expect(cssSrc).toMatch(/--chrome-h:\s*var\(--ribbon-h\)/);
  });

  test('#tab-bar kuralı kalmadı', () => {
    expect(cssSrc).not.toMatch(/^#tab-bar\s*\{/m);
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    expect(html).not.toMatch(/id="tab-bar"/);
  });

  test('krom bandı --z-chrome kullanıyor', () => {
    expect(cssSrc).toMatch(/#ve-ribbon\{[\s\S]{0,200}z-index:var\(--z-chrome\)/);
  });
});
