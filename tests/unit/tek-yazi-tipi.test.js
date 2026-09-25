/**
 * tek-yazi-tipi.test.js — PROGRAMDA TEK YAZI TİPİ
 * ────────────────────────────────────────────────
 * Kullanıcı isteği (2026-09-23): *"Program içinde çok fazla yazı tipi var.
 * Tek bir yazı tipi olmasını istiyorum."* Ölçüldü (gerçek tarayıcı): ekranda
 * BEŞ aile vardı — Inter; başlıklarda Source Serif 4; etiket ve sayılarda
 * sistem mono'su (Windows'ta Consolas); grafiklerde Segoe UI ve Arial.
 *
 * YÜZ 2026-09-25'TE DEĞİŞTİ, KURAL DEĞİŞMEDİ. Kullanıcı kendi ekranında
 * (Windows · Edge · %100) beş örneği karşılaştırdı ve Segoe UI'ı seçti:
 * gömülü Inter'de ipucu talimatı yok ve Windows'ta 9–12 px'te puslu
 * çiziliyordu. Yığın: 'Segoe UI' (sistemde kurulu, gömülmez) → 'Inter'
 * (gömülü; Windows dışında ve indirilen belgelerde). Ekranda yine TEK aile:
 * her yüzey aynı `--font-sans`ı okur.
 *
 * Üç sessiz hata sınıfı:
 *
 * 1) EKSİK ALT KÜME. Inter iki parça: `latin` ı'yı (U+0131), `latin-ext`
 *    ğ/ş/İ'yi taşıyor. Biri eksik olan ağırlıkta Türkçe bir sözcük İKİ ayrı
 *    yüzle yazılır ve hiçbir şey patlamaz — ağırlık başına ölçülür.
 * 2) İKİNCİ AİLE GERİ DÖNER. CSS'te tek bir `font-family` yazmak yeter.
 *    Kural: `var(--font-sans)` ya da `inherit`. Tek istisna hizası BOŞLUKLA
 *    kurulmuş düz metin (TXT rapor sayfası) — izin listesi burada çivili.
 * 3) OLMAYAN AĞIRLIK. Gömülü set 400–800; başka bir değer tarayıcıda
 *    sessizce en yakın ağırlığa düşer (ölçüldü: bir kural 650 yazıyordu).
 *
 * Gerçek tarayıcı karşılığı — yüz GERÇEKTEN çiziliyor mu, ekranda ve tuvalde
 * ikinci bir aile kalmış mı: tests/e2e/tek-yazi-tipi.spec.js.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const FONTS = read('css/fonts.css');
const STYLES = read('css/styles.css');
const YUZLER = FONTS.match(/@font-face\s*\{[^}]*\}/g) || [];
const TURKCE = 'çğıöşüÇĞİÖŞÜ';

// Yorumları KONUMU KORUYARAK maskeler: yorumların içinde de `{}` geçiyor ve
// maskesiz bir kural ayrıştırıcısı seçiciyi yorumdan okurdu.
const maskele = (css) => css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
function kurallar(css) {
  const out = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(maskele(css)))) {
    out.push({ sec: m[1].trim().replace(/\s+/g, ' '), govde: m[2], satir: css.slice(0, m.index).split('\n').length });
  }
  return out;
}

// Düz metin istisnası — hizası BOŞLUKLA kurulmuş metin. Orantılı bir yüzde
// TXT raporunun sütunları dağılır; bu bir tercih değil zorunluluk.
const DUZ_METIN = ['.ve-rep-page pre', '.ve-rep-measure'];

describe('Inter — gömülü yüz', () => {
  test('css/fonts.css YALNIZ Inter taşıyor', () => {
    expect(YUZLER.length).toBeGreaterThanOrEqual(10);
    YUZLER.forEach((b) => expect(b).toMatch(/font-family:\s*['"]?Inter['"]?\s*;/));
  });

  test('yüz yüklenene kadar yedek çizilir (swap) ve woff2 GÖMÜLÜ — ağ isteği yok', () => {
    YUZLER.forEach((b) => {
      expect(b).toMatch(/font-display:\s*swap/);
      expect(b).toMatch(/src:\s*url\(data:font\/woff2;base64,/);
    });
  });

  // TÜRKÇE KAPISI ağırlık başına: iki alt kümenin BİRLİKTE kapsadığı küme.
  test('her ağırlıkta latin + latin-ext Türkçe alfabeyi kapsıyor', () => {
    const agirlik = {};
    YUZLER.forEach((b) => {
      const w = (/font-weight:\s*(\d+)/.exec(b) || [])[1];
      const ur = (/unicode-range:\s*([^;}]+)/.exec(b) || [])[1] || '';
      (agirlik[w] = agirlik[w] || []).push(...ur.split(',').map((p) => {
        const m = /U\+([0-9A-Fa-f]+)(?:-([0-9A-Fa-f]+))?/.exec(p.trim());
        return m ? [parseInt(m[1], 16), parseInt(m[2] || m[1], 16)] : null;
      }).filter(Boolean));
    });
    expect(Object.keys(agirlik).sort()).toEqual(['400', '500', '600', '700', '800']);
    const eksik = [];
    Object.entries(agirlik).forEach(([w, ar]) => {
      [...TURKCE].forEach((h) => {
        const cp = h.codePointAt(0);
        if (!ar.some(([a, b]) => cp >= a && cp <= b)) eksik.push(w + ':' + h);
      });
    });
    expect(eksik).toEqual([]);
  });

  test('css/ altında başka @font-face yok — başlık yüzü EMEKLİ', () => {
    const baska = fs.readdirSync(path.join(ROOT, 'css')).filter((f) => f.endsWith('.css'))
      .filter((f) => f !== 'fonts.css' && /@font-face/.test(read('css/' + f)));
    expect(baska).toEqual([]);
    expect(fs.existsSync(path.join(ROOT, 'css/fonts-display.css'))).toBe(false);
    expect(fs.existsSync(path.join(ROOT, 'tools/build-display-font.js'))).toBe(false);
  });

  test('üç ürün de yalnız Inter\'i bağlıyor', () => {
    [['index.html', 'css/fonts.css'], ['viewer/index.html', '../css/fonts.css'],
      ['candbc/index.html', '../css/fonts.css']].forEach(([f, yol]) => {
      const html = read(f);
      expect(html).toContain('href="' + yol + '"');
      expect(html).not.toContain('fonts-display.css');
    });
  });
});

describe('CSS — tek aile kuralı', () => {
  const KURAL = kurallar(STYLES);

  test('her font-family bildirimi var(--font-sans) ya da inherit — istisna yalnız düz metin', () => {
    const aykiri = [];
    KURAL.forEach(({ sec, govde, satir }) => {
      [...govde.matchAll(/font-family\s*:\s*([^;]+)/g)].forEach((m) => {
        const v = m[1].trim();
        if (/^(inherit|var\(--font-sans(,[^)]*)?\))$/.test(v)) return;
        if (DUZ_METIN.includes(sec) && /var\(--(rep|font)-mono\)/.test(v)) return;
        aykiri.push(satir + ': ' + sec.slice(0, 60) + ' → ' + v);
      });
      // `font:` kısaltması aileyi de yazabilir — yalnız inherit serbest.
      [...govde.matchAll(/(?:^|[;\s])font\s*:\s*([^;]+)/g)].forEach((m) => {
        if (m[1].trim() !== 'inherit') aykiri.push(satir + ': ' + sec.slice(0, 60) + ' → font:' + m[1].trim());
      });
    });
    expect(aykiri).toEqual([]);
  });

  // İzin listesinin kendisi BOŞA ÇALIŞMIYOR: istisna gerçekten var ve eş
  // aralıklı. Liste bir gün boşalırsa (sayfa kaldırılırsa) bu halka söyler.
  test('düz metin istisnası gerçekten eş aralıklı ve yalnız o', () => {
    const bulunan = KURAL.filter((k) => DUZ_METIN.includes(k.sec) && /font-family\s*:\s*var\(--rep-mono\)/.test(k.govde));
    expect(bulunan.map((k) => k.sec).sort()).toEqual([...DUZ_METIN].sort());
    expect(maskele(STYLES)).toMatch(/--rep-mono\s*:\s*[^;]*monospace/);
  });

  // TARAYICI VARSAYILANI: `kbd · code · samp · pre` UA stil sayfasında
  // `monospace`. Eş aralıklı bildirimler kalkınca bu öğeler Inter'i MİRAS
  // ALMADI, tarayıcıya düştü — yalnız gerçek tarayıcı taraması gördü. Bu halka
  // sıfırlamanın var olduğunu statik olarak tutar.
  test('form denetimleri ve kbd/code/samp/pre yüzü miras alıyor (UA monospace sıfırlandı)', () => {
    const r = KURAL.find((k) => /font-family:\s*inherit/.test(k.govde)
      && ['button', 'input', 'select', 'textarea', 'kbd', 'code', 'samp', 'pre']
        .every((e) => k.sec.split(',').map((x) => x.trim()).includes(e)));
    expect(r).toBeTruthy();
  });

  test('--font-display jetonu YOK — başlık gövdeyle aynı aile', () => {
    expect(maskele(STYLES)).not.toMatch(/--font-display/);
  });

  test('gövde --font-sans ve TABLO RAKAMLARI — sayı hizası yüzden değil rakamdan', () => {
    const body = KURAL.find((k) => k.sec === 'body' && /font-family/.test(k.govde));
    expect(body).toBeTruthy();
    expect(body.govde).toMatch(/font-family:\s*var\(--font-sans\)/);
    expect(body.govde).toMatch(/font-variant-numeric:\s*tabular-nums/);
  });

  // YIĞININ SIRASI BİR KARARDIR (2026-09-25). Başta kullanıcının kendi
  // ekranında seçtiği Segoe UI; hemen ardından GÖMÜLÜ yüz. Gömülü yüz ikinci
  // sıradan kayarsa Windows dışındaki makine ve indirilen belge sessizce
  // sistemin rastgele yazısına düşer — hiçbir şey patlamaz.
  test('yığın: önce Segoe UI, hemen ardından gömülü Inter', () => {
    const m = /--font-sans:\s*([^;]+);/.exec(maskele(STYLES));
    expect(m).toBeTruthy();
    const aileler = m[1].split(',').map((a) => a.replace(/["']/g, '').trim());
    expect(aileler.slice(0, 2)).toEqual(['Segoe UI', 'Inter']);
    // Gömülü olan (css/fonts.css'te @font-face'i bulunan) YALNIZ ikincisi.
    const gomulu = aileler.filter((a) => YUZLER.some((b) => new RegExp("font-family:\\s*['\"]?" + a + "['\"]?\\s*;").test(b)));
    expect(gomulu).toEqual(['Inter']);
  });

  test('kullanılan her ağırlık gömülü sette (400–800)', () => {
    const aykiri = [];
    KURAL.forEach(({ sec, govde, satir }) => {
      [...govde.matchAll(/font-weight\s*:\s*([^;]+)/g)].forEach((m) => {
        const v = m[1].trim();
        if (/^(400|500|600|700|800|normal|bold|inherit)$/.test(v)) return;
        aykiri.push(satir + ': ' + sec.slice(0, 50) + ' → ' + v);
      });
    });
    expect(aykiri).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// JS — TUVAL VE SATIR İÇİ STİL AYNI TEK YÜZDEN
//
// Ölçüldü (2026-09-23): tuvale yazan 101 atama yüzü KENDİ yazıyordu —
// 'Segoe UI' · 'Arial' · 'system-ui' · 'sans-serif' — ve Windows'ta her grafik
// arayüzden farklı bir yüzle çiziliyordu. Satır içi stillerde 50 eş aralıklı
// bildirim vardı. Canvas `var()` çözemez; tek yol köprüdür
// (`veThemeFont` / `veThemeFontFamily`, js/theme.js).
//
// BELGE ÜRETİCİLERİ bu kapının dışında ve sebebi yazılı: indirilen/basılan
// belgeler (raporlar, kılavuz, TXT rapor sayfası, bağımsız SVG dışa aktarma)
// arayüzün CSS'i olmadan açılır, yüzlerini kendileri gömer.
const BELGE = ['cp-fead-summary.js', 'cp-fead-report.js', 'cp-mount-report.js', 'mount-report-assets.js',
  'guide-kit.js', 'guide-fead.js', 'results.js', 'export-topology.js', 'theme.js'];
const JS_DIR = path.join(ROOT, 'js');
const JS = fs.readdirSync(JS_DIR).filter((f) => f.endsWith('.js'))
  .map((f) => ({ f, src: fs.readFileSync(path.join(JS_DIR, f), 'utf8') }));

describe('JS — tek aile kuralı', () => {
  test('tuvale yazan HER atama köprüden geçiyor — dizge içinde aile yok', () => {
    const aykiri = [];
    let kopru = 0;
    JS.forEach(({ f, src }) => {
      src.split('\n').forEach((sat, i) => {
        [...sat.matchAll(/\.font\s*=\s*([^;]+)/g)].forEach((m) => {
          const v = m[1].trim();
          if (/^veThemeFont\(/.test(v)) { kopru++; return; }
          if (/^prev\w*$/.test(v)) return;                   // önceki değeri geri koyma
          aykiri.push(f + ':' + (i + 1) + ' → ' + v.slice(0, 50));
        });
      });
    });
    expect(aykiri).toEqual([]);
    // BOŞA ÇALIŞMIYOR: tarama gerçekten tuval çizen kodu buldu.
    expect(kopru).toBeGreaterThanOrEqual(90);
  });

  test('arayüz modüllerinde satır içi font-family YOK (belgeler hariç, sebebiyle)', () => {
    const aykiri = [];
    JS.filter(({ f }) => !BELGE.includes(f)).forEach(({ f, src }) => {
      src.split('\n').forEach((sat, i) => {
        [...sat.matchAll(/font-family\s*[:=]\s*["']?([^;"'>]*)/g)].forEach((m) => {
          const v = m[1].trim();
          if (/^(inherit|var\(--font-sans\)|['"]?\s*\+\s*_MNT2D_YUZ)/.test(v) || v === '') return;
          aykiri.push(f + ':' + (i + 1) + ' → ' + v.slice(0, 40));
        });
      });
    });
    expect(aykiri).toEqual([]);
  });

  test('grafik kütüphanesinin yazı ayarı köprüden (family: veThemeFontFamily())', () => {
    const aykiri = [];
    JS.filter(({ f }) => !BELGE.includes(f)).forEach(({ f, src }) => {
      // `font…: { … family: '…' }` — veri alanı olan `family: '3000'`
      // (şanzıman ailesi) bir yazı ayarı değil, kapsam dışı.
      [...src.matchAll(/font\w*\s*:\s*\{[^{}]*\bfamily\s*:\s*([^,}]+)/g)].forEach((m) => {
        if (/^veThemeFontFamily\(\)/.test(m[1].trim())) return;
        aykiri.push(f + ' → family: ' + m[1].trim().slice(0, 40));
      });
    });
    expect(aykiri).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// BELGELER DE TEK YÜZ (2026-09-23)
//
// İndirilen raporlar (AP · Takoz · FEAD ayrıntılı · FEAD özet) ve kılavuz
// kendi üç yüzünü taşıyordu: Source Serif 4 gövde · Archivo başlık · IBM Plex
// Mono sayı, ~390 KB'lık ayrı bir pakette. Aynı program ekranda bir, kâğıtta
// üç aileyle yazıyordu. Belgeler artık arayüzün yüzünü arayüzün KENDİ
// @font-face kurallarından gömüyor (js/theme.js → veThemeFontFaceCss);
// ikinci bir kopya yok. İstisnalar yalnız hizası boşlukla kurulmuş TXT sayfası
// (yukarıda) ve KaTeX'in formül yüzü — matematik dizgisi kendi yüzüyle yazar.
// ═══════════════════════════════════════════════════════════════════════════
describe('belgeler de tek yüz — raporlar, özet, kılavuz', () => {
  const ESKI = /Archivo|Source Serif|IBM Plex/;
  // Yorumlar ayıklanır: eski yüzü ANLATAN bir yorum kural ihlali değil.
  const yorumsuz = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n').map((l) => l.replace(/(^|[^:'"\\])\/\/.*$/, '$1')).join('\n');

  test('eski üç yüz HİÇBİR kaynakta yok — JS, şablon kaynakları, üretilmiş şablonlar', () => {
    const kalan = [];
    JS.forEach(({ f, src }) => { if (ESKI.test(yorumsuz(src))) kalan.push('js/' + f); });
    ['theory-source.html', 'fead-theory-source.html'].forEach((f) => {
      const s = fs.readFileSync(path.join(ROOT, 'tools/report-assets', f), 'utf8');
      if (ESKI.test(yorumsuz(s.replace(/<!--[\s\S]*?-->/g, '')))) kalan.push('tools/report-assets/' + f);
    });
    // Üretilmiş şablonlar base64 — çözülüp bakılır; kaynağından yeniden
    // üretilmemiş bir şablon eski yüzü kâğıda taşımaya devam ederdi.
    [['mount-report-template.js', 'MNT'], ['fead-report-template.js', 'FEAD']].forEach(([f]) => {
      const m = fs.readFileSync(path.join(ROOT, 'js', f), 'utf8').match(/= "([A-Za-z0-9+/=]+)"/);
      const t = Buffer.from(m[1], 'base64').toString('utf8');
      if (ESKI.test(yorumsuz(t))) kalan.push('js/' + f + ' (çözülmüş)');
      expect(t).toMatch(/--yuz:'Inter'/);
    });
    expect(kalan).toEqual([]);
  });

  test('rapor paketi metin yüzü TAŞIMIYOR — belgeler yüzü arayüzün kurallarından alıyor', () => {
    const paket = fs.readFileSync(path.join(ROOT, 'js/mount-report-assets.js'), 'utf8');
    expect(paket).not.toMatch(/fontsCss/);                 // eskiden ~390 KB base64
    const kopru = JS.filter(({ src }) => /veThemeFontFaceCss\(\)/.test(src)).map(({ f }) => f);
    expect(kopru).toEqual(expect.arrayContaining(
      ['cp-fead-report.js', 'cp-fead-summary.js', 'cp-mount-report.js', 'guide-kit.js', 'results.js']));
    // Hiçbir üretici paketin kaldırılan alanını okumuyor (okusaydı sessizce
    // `undefined` gömerdi — belge yazı tipsiz açılırdı).
    expect(JS.filter(({ src }) => /\bA\.fontsCss|MNT_REPORT_ASSETS\.fontsCss/.test(src)).map(({ f }) => f)).toEqual([]);
  });
});
