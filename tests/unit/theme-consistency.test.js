/**
 * Tema tutarlılık testi — İKİ ZEMİN, ÜÇ KİP
 * ─────────────────────────────────────────
 * Burada bir zamanlar ondokuz tema vardı ve bu dosya onların üç kaynakta
 * (theme.js `valid` · settings.js menüsü · styles.css blokları) senkron
 * kalmasını koruyordu. Temalar kaldırıldı; korunacak senkron DEĞİŞTİ ama
 * kaybolmadı — yalnız artık KİP ile KİMLİK ayrı iki şey:
 *
 *   KİP    (acik · koyu · sistem)  kullanıcının seçtiği şey; localStorage'da durur
 *   KİMLİK (acik · koyu)           `data-theme`a yazılan; CSS bloğu olan şey
 *
 * 'sistem' bir kimlik DEĞİLDİR ve CSS'te bloğu yoktur; yazılsaydı belge
 * sessizce :root'a düşerdi. Bu dosyanın asıl işi o ayrımın her yerde
 * korunduğunu ölçmek.
 */
const fs = require('fs');
const path = require('path');
const read = (f) => fs.readFileSync(path.join(__dirname, '../../', f), 'utf8');

const css = read('css/styles.css');
const themeJs = read('js/theme.js');
const settingsJs = read('js/settings.js');
const loaderJs = read('js/loader.js');
const indexHtml = read('index.html');

const uniqSort = (arr) => Array.from(new Set(arr)).sort();

// theme.js: var MF_KIPLER = ['acik', 'koyu', 'sistem'];
const kipler = uniqSort(
  ((themeJs.match(/var MF_KIPLER = \[([^\]]+)\]/) || [])[1] || '')
    .match(/'([^']+)'/g).map((s) => s.replace(/'/g, ''))
);

// settings.js: { id: 'x', name: '...' } — bu kalıbı yalnız kip listesi kullanır
const menuIds = uniqSort(
  [...settingsJs.matchAll(/\{\s*id:\s*'([^']+)',\s*name:/g)].map((m) => m[1])
);

// styles.css'te bir kimliğin DEĞİŞKEN bloğunu döndürür (yoksa '').
const temaBlogu = (id) => {
  const re = new RegExp('\\[data-theme="' + id + '"\\][^{]*\\{([^}]*)\\}', 'g');
  for (const m of css.matchAll(re)) {
    if (/--bg-primary\s*:/.test(m[1])) return m[1];
  }
  return '';
};

// Kimlikler = CSS bloğu OLAN kipler.
const kimlikler = kipler.filter((k) => temaBlogu(k));

describe('kip ↔ kimlik ↔ blok senkron', () => {
  test('en az bir kip bulundu (regex kayması erken yakalansın)', () => {
    expect(kipler.length).toBeGreaterThan(0);
    expect(menuIds.length).toBeGreaterThan(0);
  });

  test('theme.js kipleri == Ayarlar > Görünüm menüsü', () => {
    expect(kipler).toEqual(menuIds);
  });

  // Üç kipin İKİSİ kimliktir. 'sistem' bilerek bloksuzdur; blok kazanırsa
  // kullanıcı işletim sistemini izlediğini sanırken sabit bir palete düşer.
  test('tam iki kimlik var ve sistem onlardan biri DEĞİL', () => {
    expect(kimlikler).toEqual(['acik', 'koyu']);
    expect(temaBlogu('sistem')).toBe('');
  });

  // Attribute'suz ya da eskimiş kimlikli belgede palet BOŞ kalmasın diye
  // açık blok `:root` ile virgüllü bildirilmek zorunda. Sessiz: sayfa yine
  // açılır, yalnız yirmi dört jeton tanımsızdır.
  test('açık blok :root ile ORTAK bildiriliyor', () => {
    expect(css).toMatch(/:root,\s*\[data-theme="acik"\]\s*\{/);
  });

  test('her kimliğin bloğu color-scheme bildiriyor', () => {
    const eksik = kimlikler.filter((id) => !/color-scheme\s*:\s*(dark|light)/.test(temaBlogu(id)));
    expect(eksik).toEqual([]);
  });

  /* Hover/seçim vurguları aktif aksandan türemeli. Sabit mavi tonlar,
     aksanı turuncu/kırmızı olan bir palette mavi leke olarak kalır. */
  test('styles.css içinde sabit-mavi vurgu tonu kalmadı', () => {
    const rules = css.replace(/\/\*[\s\S]*?\*\//g, ''); // yorumlar hariç
    expect(rules).not.toMatch(/rgba\(\s*59\s*,\s*130\s*,\s*246/);
  });

  /* Ayarlar penceresindeki önizleme pulu, o kimliğin styles.css'teki GERÇEK
     --bg-primary / --bg-tertiary / --accent-primary değerlerini göstermeli;
     palet değişip pul eskiyse kullanıcı yanlış rengi görerek seçim yapar.
     'sistem'in pulu iki zemini yan yana gösterir, tek bloğa bağlanamaz —
     bu yüzden yalnız kimlikler denetlenir. */
  test('kip pulu renkleri styles.css paletiyle aynı', () => {
    const pullar = [...settingsJs.matchAll(
      /\{\s*id:\s*'([^']+)',\s*name:\s*'[^']*',\s*swatch:\s*\[([^\]]+)\]/g
    )].map((m) => [m[1], m[2].match(/'([^']+)'/g).map((c) => c.replace(/'/g, ''))]);

    expect(pullar.length).toBe(kipler.length);

    const sapan = pullar.filter(([id, renkler]) => {
      const blok = temaBlogu(id);
      if (!blok) return false;                       // 'sistem' — bloğu yok
      const deger = (ad) => (blok.match(new RegExp('--' + ad + ':\\s*([^;]+);')) || [])[1];
      return deger('bg-primary').trim() !== renkler[0] ||
             deger('bg-tertiary').trim() !== renkler[1] ||
             deger('accent-primary').trim() !== renkler[2];
    });
    expect(sapan.map(([id]) => id)).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// VARSAYILAN — TEK DEĞER, TEK YER
// Eskiden dört ayrı düşüş noktası vardı (theme.js'te üç, settings.js'te bir)
// ve ayrışmıştı: program 'pearl' açılıyor, Ayarlar 'Midnight' işaretli
// gösteriyordu. Kopyayı kapıyla korumak yerine KOPYA KALDIRILDI — settings.js
// artık kendi varsayılanını tutmuyor, theme.js'in okuyucusunu çağırıyor.
describe('Varsayılan kip', () => {
  test('theme.js varsayılanı TEK sabitte', () => {
    expect(themeJs).toMatch(/var MF_VARSAYILAN = MF_ACIK;/);
  });

  test('Ayarlar penceresi KENDİ varsayılanını tutmuyor', () => {
    const govde = settingsJs.slice(
      settingsJs.indexOf('function _veSettingsRenderAppearance'),
      settingsJs.indexOf('─── OTOMATİK KAYDET')
    );
    expect(govde).toContain('veThemeStoredKip');
    // localStorage'dan kendi başına okuyup kendi yedeğini yazmıyor
    expect(govde).not.toMatch(/localStorage\.getItem\('mf-theme'\)/);
  });

  test('varsayılan AÇIK (kullanıcı kararı 2026-09-09) ve belge onunla açılıyor', () => {
    expect(temaBlogu('acik')).toMatch(/color-scheme:\s*light/);
    expect(indexHtml).toMatch(/<html[^>]*data-theme="acik"/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// İKİ İLK-KARE YOLU — TEK KARAR
//
// Kayıtlı kip, hiçbir şey çizilmeden önce İKİ ayrı yerde çözülüyor:
//   index.html   → <head> içindeki satır içi betik (ilk koşan)
//   js/loader.js → applyStoredTheme()
// İkisi ayrışırsa loader'ın ölçüp kapattığı açılış renk sıçraması geri gelir
// ve bunu yalnız gerçek tarayıcıda kullanıcı görür — hiçbir test görmezdi.
//
// Eski kapı yalnız "süzgeç her kimliği kabul ediyor mu" diye bakıyordu; artık
// ortada süzgeç değil bir ÇÖZÜCÜ var (kip → kimlik) ve doğru soru şu: iki
// çözücü aynı girdiye aynı kimliği mi veriyor? İkisi de çıkarılıp koşuluyor.
describe('iki ilk-kare yolu AYNI kimliği çözüyor', () => {
  const satirIci = (indexHtml.match(/<script>(try\{var v=localStorage[\s\S]*?)<\/script>/) || [])[1];
  const loaderGovde = (loaderJs.match(/function applyStoredTheme\(\) \{([\s\S]*?)\n  \}/) || [])[1];

  function cozucu(kod) {
    return (deger, osKoyu) => {
      let yazilan = null;
      const belge = { documentElement: { setAttribute: (k, v) => { if (k === 'data-theme') yazilan = v; } } };
      const mm = () => ({ matches: osKoyu });
      const pencere = { matchMedia: mm };
      // eslint-disable-next-line no-new-func
      new Function('window', 'localStorage', 'matchMedia', 'document', kod)(
        pencere, { getItem: () => deger }, mm, belge
      );
      return yazilan;
    };
  }

  test('iki betik de çıkarılabildi (regex kayması erken yakalansın)', () => {
    expect(satirIci).toBeTruthy();
    expect(loaderGovde).toBeTruthy();
  });

  // Girdi matrisi: yeni sözlük · kayıt yok · ondokuz temadan kalan eski
  // kimlikler (iki aileden de) · tamamen bozuk değer.
  const GIRDILER = [
    'acik', 'koyu', 'sistem', null, '',
    'pearl', 'steel', 'solidworks', 'paper', 'zinc',      // eski AÇIK aile
    'slate', 'navy', 'amber', 'scope', 'graphite',        // eski KOYU aile
    'bozuk-deger', 'SLATE', '../x'
  ];

  [true, false].forEach((osKoyu) => {
    GIRDILER.forEach((g) => {
      test(`"${g}" · OS ${osKoyu ? 'koyu' : 'açık'} → iki yol aynı`, () => {
        const a = cozucu(satirIci)(g, osKoyu);
        const b = cozucu(loaderGovde)(g, osKoyu);
        expect(`${g}/${osKoyu}: ${a}`).toBe(`${g}/${osKoyu}: ${b}`);
        // Ve çözülen şey HER ZAMAN bloğu olan bir kimlik olmalı
        expect(kimlikler).toContain(a);
      });
    });
  });

  // Eski kimliklerin göçü aileyi korumak zorunda: koyu tema seçmiş bir
  // kullanıcı açık zeminde uyanmamalı.
  test('eski AÇIK aile acik, eski KOYU aile koyu çözülüyor', () => {
    const c = cozucu(satirIci);
    ['pearl', 'steel', 'solidworks', 'paper', 'zinc'].forEach((g) => {
      expect(`${g}: ${c(g, true)}`).toBe(`${g}: acik`);
    });
    ['slate', 'cream', 'claude', 'ansys', 'fusion', 'vscode', 'navy', 'graphite',
      'ink', 'basalt', 'mono', 'contrast', 'amber', 'scope'].forEach((g) => {
      expect(`${g}: ${c(g, false)}`).toBe(`${g}: koyu`);
    });
  });

  // ── ÜÇ GÖÇ YOLU ──────────────────────────────────────────────────────────
  // Eski kimlik listesi ÜÇ yerde duruyor: index.html'in satır içi betiği,
  // js/loader.js ve js/theme.js'in MF_ESKI_KIMLIK tablosu. Kopya bilinçli ve
  // GEÇİCİ — satır içi ikisi göçü ilk karede yapmak zorunda (yoksa koyu tema
  // seçmiş kullanıcı açılışı açık zeminde görür), theme.js ise kaydı kalıcı
  // olarak yeni sözlüğe yazan yer. Kayıtlar döndükçe üçü birlikte silinebilir.
  // Korunacak şey "kopya yok" değil, ÜÇÜNÜN AYNI AİLEYE DÜŞMESİ.
  test('üç göç yolu ondokuz eski kimlikte de aynı aileye düşüyor', () => {
    const t = require('../../js/theme.js');
    const eski = Object.keys(t.MF_ESKI_KIMLIK);
    expect(eski).toHaveLength(19);

    const a = cozucu(satirIci);
    const b = cozucu(loaderGovde);
    eski.forEach((id) => {
      const modul = t.MF_ESKI_KIMLIK[id];
      expect(kimlikler).toContain(modul);
      // OS durumu göçü etkilememeli: eski kimlik açık bir seçimdi.
      expect(`${id}: ${a(id, true)}/${b(id, false)}`).toBe(`${id}: ${modul}/${modul}`);
    });
  });

  test('theme.js kip çözümü: eski · bozuk · sistem', () => {
    const t = require('../../js/theme.js');
    expect(t.veThemeKip('navy')).toBe('koyu');
    expect(t.veThemeKip('paper')).toBe('acik');
    expect(t.veThemeKip('bozuk')).toBe('acik');   // tanınmayan → VARSAYILAN
    expect(t.veThemeKip(null)).toBe('acik');
    expect(t.veThemeKip('sistem')).toBe('sistem'); // kip, kimlik değil
  });
});
