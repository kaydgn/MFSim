/**
 * İndirilen HTML raporların kozmetik bütünlüğü — js/results.js
 * ────────────────────────────────────────────────────────────
 * Bu testler ETİKET/METİN denetlemez (kırılgan olurdu). Bir raporun
 * "güzel görünmesini" mümkün kılan YAPISAL koşulları denetler:
 *
 *  1. Belge kendi kendine yeter mi? İndirilen HTML `css/styles.css`'i YÜKLEMEZ.
 *     Orada tanımsız bir custom property'ye başvuran `font-size` bildirimi
 *     "invalid at computed-value time" olur; font-size kalıtımlı olduğu için
 *     değer ebeveynden MİRAS ALINIR ve bütün belge 16px'e düz olarak çöker.
 *     Tam olarak bu olmuştu: proje --fs-* ölçeğine geçirilirken
 *     cp-mount-report.js muaf tutulmuş (typography-scale.test.js MUAF listesi),
 *     ama results.js içindeki rapor CSS'i gözden kaçmış; 21 font-size bildirimi
 *     sessizce ölmüştü. Rapor "Takoz raporu kadar güzel değil"di çünkü
 *     tipografisi hiç uygulanmıyordu. Hata gözle görülür ama testle görülmezdi;
 *     bu dosya o boşluğu kapatıyor.
 *
 *  2. KaTeX gerçekten gömülü mü, ve gömülürken `</script>` kaçışlanıyor mu?
 *     KaTeX gövdesinde geçen bir `</script>` dizisi, gömüldüğü etiketi erken
 *     kapatır ve belgenin geri kalanı ham metin olarak dökülür.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../../');
const src = fs.readFileSync(path.join(ROOT, 'js/results.js'), 'utf8');

// ── Yardımcı: bir CSS metninde kullanılan/ tanımlanan custom property'ler ────
function usedVars(css) {
  return [...new Set((css.match(/var\((--[a-zA-Z0-9-]+)/g) || []).map((x) => x.slice(4)))];
}
function definedVars(css) {
  return [...new Set((css.match(/(--[a-zA-Z0-9-]+)\s*:/g) || []).map((x) => x.replace(/\s*:$/, '')))];
}

// ── Araç Performans raporunun stil bloğu ────────────────────────────────────
const REPORT_CSS = (() => {
  const m = src.match(/var _VE_REPORT_CSS = `([\s\S]*?)`;/);
  if (!m) throw new Error('_VE_REPORT_CSS bulunamadı — rapor stili taşındı mı?');
  return m[1];
})();

describe('Araç Performans raporu — bağımsız belge kendi kendine yeter', () => {
  test('kullanılan her custom property aynı belgede TANIMLI', () => {
    const eksik = usedVars(REPORT_CSS).filter((v) => !definedVars(REPORT_CSS).includes(v));
    // Hata mesajı doğrudan eksik jetonu verir.
    expect(eksik).toEqual([]);
  });

  test('arayüzün --fs-* ölçeğine hiç başvurulmuyor (o jetonlar belgede yok)', () => {
    expect(REPORT_CSS).not.toMatch(/var\(--fs-/);
  });

  test('tipografik hiyerarşi gerçekten kuruluyor (gövde < h2 < h1)', () => {
    const px = (name) => {
      const m = REPORT_CSS.match(new RegExp('--' + name + ':\\s*([\\d.]+)px'));
      return m ? parseFloat(m[1]) : null;
    };
    const govde = px('rfs-title');
    const h2 = px('rfs-h2');
    const h1 = px('rfs-h1');
    expect(govde).toBeGreaterThan(0);
    expect(h2).toBeGreaterThan(govde);
    expect(h1).toBeGreaterThan(h2);
  });

  test('ölçekte 9px altı basamak yok (okunabilirlik tabanı)', () => {
    const kucuk = [...REPORT_CSS.matchAll(/--rfs-[a-z0-9]+:\s*([\d.]+)px/g)]
      .map((m) => parseFloat(m[1]))
      .filter((v) => v < 9);
    expect(kucuk).toEqual([]);
  });

  test('rapor gövdesi Takoz raporuyla aynı üç yazı tipini kullanıyor', () => {
    expect(REPORT_CSS).toMatch(/Source Serif 4/);
    expect(REPORT_CSS).toMatch(/Archivo/);
    expect(REPORT_CSS).toMatch(/IBM Plex Mono/);
  });

  test('baskı kuralları Takoz raporuyla eşit (sayfa marjı, tablo başlığı tekrarı)', () => {
    expect(REPORT_CSS).toMatch(/@page\{margin:/);
    expect(REPORT_CSS).toMatch(/thead\{display:table-header-group\}/);
    expect(REPORT_CSS).toMatch(/orphans:3;widows:3/);
  });
});

describe('TXT önizleme sarmalayıcısı da bağımsız belge', () => {
  // veBuildReportHTML — dört TXT panelinin "HTML İndir" çıktısı. Aynı tuzak:
  // arayüz jetonuna başvurursa <pre> boyutu 16px'e çöker.
  const fn = src.slice(src.indexOf('function veBuildReportHTML('));
  const govde = fn.slice(0, fn.indexOf('\n}\n'));

  test('arayüz --fs-* jetonuna başvurmuyor', () => {
    expect(govde).not.toMatch(/var\(--fs-/);
  });

  test('kullandığı jetonu kendi :root bloğunda tanımlıyor', () => {
    const eksik = usedVars(govde).filter((v) => !definedVars(govde).includes(v));
    expect(eksik).toEqual([]);
  });
});

describe('KaTeX — Takoz raporuyla aynı gömme sözleşmesi', () => {
  const indirici = (() => {
    const i = src.indexOf('function veDownloadReportHTML(');
    expect(i).toBeGreaterThan(-1);
    return src.slice(i, i + 12000);
  })();

  test('KaTeX CSS ve JS belgeye gömülüyor (harici istek yok)', () => {
    expect(indirici).toMatch(/ASSETS\.katexCss/);
    expect(indirici).toMatch(/ASSETS\.katexJs/);
    expect(indirici).not.toMatch(/https?:\/\/[^"']*katex/i);
  });

  test('gömülen JS içindeki </script> kaçışlanıyor (belge erken kapanmasın)', () => {
    // Bu kaçış olmazsa indirilen rapor <script> ortasında biter ve
    // belgenin geri kalanı ham metin olarak dökülür.
    expect(indirici).toMatch(/katexJs[\s\S]{0,120}replace\(\/<\\\/script>\/gi/);
  });

  test('otomatik render $$…$$ ve \\(…\\) sınırlayıcılarıyla kuruluyor', () => {
    expect(indirici).toMatch(/renderMathInElement/);
    expect(indirici).toMatch(/left:"\$\$",right:"\$\$",display:true/);
    expect(indirici).toMatch(/display:false/);
  });

  test('varlıklar yüklenemezse rapor yine üretilir (KaTeX opsiyonel)', () => {
    // katexJs boşsa <script> bloğu HİÇ basılmamalı — boş <script> değil.
    expect(indirici).toMatch(/katexJs \? '<script>'/);
  });

  test('fontlar ve KaTeX Takoz raporuyla AYNI varlık paketinden geliyor', () => {
    expect(indirici).toMatch(/MNT_REPORT_ASSETS/);
    expect(indirici).toMatch(/_mntReportEnsureAssets/);
  });
});

describe('Rapor kapağı projenin TAM adını taşır', () => {
  // veSetProjectNameButton (toolbar.js) 22 karakterden uzun adı "…" ile
  // kısaltıp textContent'e öyle yazar; tam hâli title niteliğindedir.
  // textContent'ten okumak kapağa ve dosya adına KESİK isim taşıyordu —
  // "Taktik Tekerlekli Araç 8x8" → "Taktik Tekerlekli Ar". Sessiz ve
  // makul görünen yanlış çıktı: kimse raporun adının kırpıldığını fark etmez.
  const indirici = src.slice(src.indexOf('function veDownloadReportHTML('));
  const okuma = indirici.slice(0, indirici.indexOf('var now = new Date()'));

  test('ad title niteliğinden okunuyor', () => {
    expect(okuma).toMatch(/pnBtn\.getAttribute\('title'\)/);
  });

  test('textContent yalnız yedek (title yoksa) olarak kalıyor', () => {
    // '||' zinciri: önce title, sonra textContent.
    expect(okuma).toMatch(/getAttribute\('title'\)\s*\|\|\s*pnBtn\.textContent/);
  });

  test('kısaltma gerçekten toolbar.js tarafında yapılıyor (gerekçe canlı)', () => {
    const tb = fs.readFileSync(path.join(ROOT, 'js/toolbar.js'), 'utf8');
    expect(tb).toMatch(/substring\(0,\s*20\)\s*\+\s*['"]…['"]/);
    expect(tb).toMatch(/setAttribute\('title',\s*raw\)/);
  });
});

describe('Denklem yardımcısı H.eq', () => {
  const fabrika = (() => {
    const i = src.indexOf('function _veMakeReportHelpers(');
    return src.slice(i, src.indexOf('\n}\n', i));
  })();

  test('H.eq üretiliyor ve numaralı .eqno bloğu basıyor', () => {
    expect(fabrika).toMatch(/eq:\s*function/);
    expect(fabrika).toMatch(/class="eqno"/);
    expect(fabrika).toMatch(/class="tag"/);
  });

  test('denklem sayacı tablo/şekil sayaçlarıyla aynı closure’da', () => {
    expect(fabrika).toMatch(/var tblNo = 0, figNo = 0, eqNo = 0;/);
  });

  test('.eqno ve .katex-display stilleri rapor CSS’inde tanımlı', () => {
    expect(REPORT_CSS).toMatch(/\.eqno\{position:relative\}/);
    expect(REPORT_CSS).toMatch(/\.katex-display\{/);
  });
});
