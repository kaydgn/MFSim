/**
 * Ayarlar → Görünüm → Kimlik bloğu — js/settings.js + css/styles.css
 * ──────────────────────────────────────────────────────────────────
 * Bloğun üç sınıfının (ve-set-kimlik · ve-set-kimlik-av · ve-set-not) CSS
 * kuralı HİÇ yazılmamıştı. Ölçüldü (gerçek tarayıcı, ad girilmiş): baş
 * harfler avatar dairesi yerine 16 px çıplak metin olarak ayrı satıra
 * düşüyor, not tarayıcının varsayılan 16 px'i ve koyu mürekkebiyle
 * yazılıyordu; hemen altındaki kardeş açıklama 12 px ve soluktu.
 * Hiçbir test kırmızıya dönmedi, çünkü tanımsız bir sınıf sessizdir.
 */
const fs = require('fs');
const path = require('path');

const settings = loadSource('settings.js');
const css = fs.readFileSync(path.join(__dirname, '../../css/styles.css'), 'utf8');

describe('Ayarlar penceresinin yazdığı her ve-set-* sınıfının CSS kuralı var', () => {
  const siniflar = [...new Set((settings.match(/\bve-set-[a-z-]+/g) || [])
    .filter((s) => !/-ad$/.test(s)))];               // ve-set-kimlik-ad bir kimlik (id), sınıf değil

  test('sınıf listesi boş değil (kapı kendini boşa çıkarmasın)', () => {
    expect(siniflar.length).toBeGreaterThanOrEqual(3);
  });

  siniflar.forEach((s) => {
    test(s, () => {
      expect(css).toMatch(new RegExp('\\.' + s.replace(/-/g, '\\-') + '\\s*[{,.:\\s]'));
    });
  });
});

describe('Kimlik bloğunun görünümü', () => {
  test('avatar hesap menüsündeki dairenin KENDİSİ (tek kaynak, boş hâli dâhil)', () => {
    expect(settings).toMatch(/class="ve-avatar-menu-av ve-set-kimlik-av' \+ \(_kBh \? '' : ' bos'\)/);
    expect(css).toMatch(/\.ve-avatar-menu-av\{[^}]*border-radius:50%/);
    expect(css).toMatch(/\.ve-avatar-menu-av\.bos\{/);
  });

  test('not kardeş açıklamanın ölçüsünde: gövde basamağı ve soluk renk', () => {
    const kural = (css.match(/\.ve-set-not\s*\{([^}]*)\}/) || [])[1] || '';
    expect(kural).toMatch(/font-size:\s*var\(--fs-body\)/);
    expect(kural).toMatch(/color:\s*var\(--text-muted\)/);
  });

  test('Görünüm sayfasında iki büyük başlık üst üste yok; Kimlik ve Tema ara başlık', () => {
    const bas = settings.slice(settings.indexOf("'<h3 class=\"ve-settings-section-title\">Görünüm</h3>'"));
    const blok = bas.slice(0, bas.indexOf('ve-settings-theme-grid'));
    expect((blok.match(/ve-settings-section-title/g) || []).length).toBe(1);
    expect(blok).toMatch(/<h4 class="ve-settings-subhead">Kimlik<\/h4>/);
    expect(blok).toMatch(/<h4 class="ve-settings-subhead">Tema<\/h4>/);
  });
});
