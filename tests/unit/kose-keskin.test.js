/**
 * kose-keskin.test.js — KÖŞE KESKİN, GÖLGE YALNIZ YÜZENDE
 * ─────────────────────────────────────────────────────────────────────────
 * Kullanıcı kararı (2026-11-04): "köşeler keskin değil, program hiç
 * profesyonel durmuyor." Programın gerçek ekranları Edge koşulunda üç biçimde
 * karşılaştırıldı (bugün · keskin · keskin + sade); seçilen: keskin + sade,
 * düğmede 2 px.
 *
 * Ölçek iki kez el değiştirdi — 0·2·2·3·3 (ölçüm yazılımı keskinliği) →
 * 3·5·7·10·14 (Atölye, 2026-09-22) → bugünkü. Bir sonraki oturum eski bir
 * yorumu okuyup ölçeği sessizce geri çevirmesin diye DEĞERİ bu kapı tutar.
 * Ölçeğe bağlı olmayan sabit yarıçapın kapısı ayrıdır: source-hygiene.test.js
 * (bölüm 4 · 5).
 */
const fs = require('fs');
const path = require('path');

const KOK = path.join(__dirname, '..', '..');
const CSS = fs.readFileSync(path.join(KOK, 'css', 'styles.css'), 'utf8');
const YORUMSUZ = CSS.replace(/\/\*[\s\S]*?\*\//g, '');

function jeton(ad) {
  const m = YORUMSUZ.match(new RegExp('--' + ad + ':\\s*([^;]+);'));
  return m ? m[1].trim() : null;
}

describe('köşe ölçeği keskin: çerçeve 0, el değen denetim 2 px', () => {
  test('basamakların değeri', () => {
    expect({
      xs: jeton('radius-xs'), sm: jeton('radius-sm'),
      md: jeton('radius-md'), lg: jeton('radius-lg'), xl: jeton('radius-xl'),
      pill: jeton('radius-pill'),
    }).toEqual({ xs: '2px', sm: '2px', md: '0', lg: '0', xl: '0', pill: '999px' });
  });

  // Hap jetonu tam yuvarlaktır: yalnız ANLAMI DAİRE olan taşır (radyo düğmesi,
  // numara balonu — çizimdeki kasnak numarasıyla aynı — ve adım durumu).
  // Sayaç, çip, ilerleme ve kaydırma çubuğu denetimdir: hapa geri dönen her
  // yeni kural burada adıyla kırmızıya döner.
  test('hap jetonu yalnız anlamı daire olanda', () => {
    const kullanan = [...YORUMSUZ.matchAll(/([^{}]+)\{[^{}]*var\(--radius-pill\)[^{}]*\}/g)]
      .map((m) => m[1].trim().replace(/\s+/g, ' '));
    expect(kullanan.sort()).toEqual([
      '.ve-fw-kl-no', '.ve-fw-radio', '.ve-fw-step-n', '.ve-fw-step-no',
    ]);
  });

  test('JS satır içi stilde hap jetonu yok', () => {
    const bulunan = [];
    fs.readdirSync(path.join(KOK, 'js')).filter((f) => f.endsWith('.js')).forEach((f) => {
      fs.readFileSync(path.join(KOK, 'js', f), 'utf8').split('\n').forEach((s, i) => {
        if (/border-radius:\s*var\(--radius-pill\)/.test(s)) bulunan.push(f + ':' + (i + 1));
      });
    });
    expect(bulunan).toEqual([]);
  });
});

describe('gölge sade: yerinde duran yüzey düz, yüzen katman ince', () => {
  test('yerinde duran yüzeyin gölgesi saydam (none DEĞİL — liste içinde kullanılıyor)', () => {
    expect(jeton('shadow-sm')).toBe('0 0 0 0 transparent');
  });

  test('yüzen katmanın gölgesi temadan ve bulanıklığı en çok 14 px', () => {
    const olcu = {};
    ['md', 'lg', 'xl'].forEach((k) => {
      const v = jeton('shadow-' + k);
      expect(v).toMatch(/var\(--shadow-color\)\s*$/);
      const px = v.replace(/var\(--shadow-color\)/, '').trim().split(/\s+/).map(parseFloat);
      olcu[k] = px[2];
    });
    expect(Math.max(olcu.md, olcu.lg, olcu.xl)).toBeLessThanOrEqual(14);
    expect(olcu.md).toBeLessThanOrEqual(olcu.lg);
    expect(olcu.lg).toBeLessThanOrEqual(olcu.xl);
  });

  test('üst bandın zemini düz ton (degrade yok)', () => {
    expect(jeton('bant-zemin')).not.toMatch(/gradient/);
  });
});
