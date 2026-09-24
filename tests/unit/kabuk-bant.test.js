/**
 * kabuk-bant.test.js — KABUĞUN ÜST BANDI TEK ÇİZGİ, TUVAL KENARA YAPIŞIK
 *
 * Kullanıcı bildirimi (2026-09-23, "Bileşenler" başlığı ile "Topoloji 1"
 * sekmesinin ekran görüntüsüyle): *"pencere sınırları bir hizasız, tatsız,
 * güzel değil. Garip yani."*
 *
 * Gerçek tarayıcıda ölçüldü (FEAD, 1600×1000, müfettiş açık): üst kenarda yan
 * yana üç başlık üç ayrı ölçü tutuyordu — "Bileşenler" 37 px, sekme bandı
 * 29 px, müfettiş başlığı 33 px — alt çizgileri merdiven gibi y=75 · 67 · 71'de.
 * İkisi koyu, biri açık zemindeydi. Tuval de 8 px içeride, 10 px köşeli ayrı
 * bir çerçevede duruyordu: her sınır İKİ çizgiydi.
 *
 * Aynı sorun Sonuçlar ekranında 2026-08-17'de yaşanmış ve ortak bir jetonla
 * (`--results-bar-h`) çözülmüştü; kural Topoloji'ye hiç uygulanmamıştı. Jeton
 * artık KABUĞUN: `--bant-h` (ölçü) + `--bant-zemin` (zemin).
 *
 * Burada CSS METNİ kapılı — yapısal karar: bütün bantlar aynı jetondan. Çizimin
 * kendisi (bantların gerçekten aynı y'de bitmesi, tuvalin gerçekten yapışması)
 * tests/e2e/kabuk-sutun.spec.js → "KABUK TEK ÇİZGİ"; jsdom yerleşim hesaplamaz.
 */
const fs = require('fs');
const path = require('path');

const KOK = path.join(__dirname, '../..');
const CSS = fs.readFileSync(path.join(KOK, 'css/styles.css'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '');                 // yorumlar ölçülmez

// Bir kuralın gövdesi — seçici SATIR BAŞINDA. Düz `indexOf` `.ve-doc-dock{`i
// `.ve-main.ve-no-module .ve-doc-dock{` içinde de bulurdu (dosyada önce o
// geçiyor) ve kapı yanlış kuralı ölçerdi.
function kural(secici) {
  const kac = secici.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = CSS.match(new RegExp('(?:^|\\n)' + kac + '\\{([^}]*)\\}'));
  return m ? m[1].replace(/\s+/g, ' ') : null;
}

// Kabuğun ÜST BANTLARI — soldan sağa: Topoloji (kenar çubuğu başlığı ·
// sekme bandı · müfettiş başlığı) ve Sonuçlar (Veri Gezgini · araç çubuğu ·
// rapor bandı).
const BANTLAR = ['.ve-sidebar-header', '.ve-doc-dock', '.ve-properties-header',
  '.ve-results-head', '.ve-trace-toolbar', '.ve-rep-head'];

describe('KABUĞUN ÜST BANDI — tek ölçü, tek zemin', () => {
  test('jetonlar TEK yerde tanımlı; eski ad HİÇBİR kaynakta kalmadı', () => {
    expect(CSS.match(/--bant-h:\s*\d+px;/g)).toHaveLength(1);
    expect(CSS.match(/--bant-zemin:/g)).toHaveLength(1);
    // Eski ad kalan bir tüketicide SESSİZCE bozar: tanımsız `var()` ile
    // `min-height` geçersiz olur ve bant içeriği kadar büzülür, hata yok.
    // Ölçüldü: CAN Çözümleyici'nin yan paneli (candbc/index.html) eski adı
    // okuyordu. css/ üç ürüne giriyor — tarama üçünün de kaynağını kapsar.
    const kaynaklar = [];
    const tara = (dizin) => fs.readdirSync(path.join(KOK, dizin)).forEach((f) => {
      if (/\.(js|css|html)$/.test(f)) kaynaklar.push(path.join(dizin, f));
    });
    ['css', 'js', 'viewer', 'viewer/js', 'candbc', 'candbc/js'].forEach(tara);
    kaynaklar.push('index.html');
    expect(kaynaklar.length).toBeGreaterThan(50);            // BOŞA ÇALIŞMIYOR
    const eski = kaynaklar.filter((f) =>
      /--results-bar-h/.test(fs.readFileSync(path.join(KOK, f), 'utf8')));
    expect(eski).toEqual([]);
  });

  test('her bant ölçüsünü ve zeminini jetondan alıyor', () => {
    const sapan = [];
    BANTLAR.forEach((s) => {
      const k = kural(s);
      if (!k) { sapan.push(s + ': kural yok'); return; }
      if (!/min-height:\s*var\(--bant-h\)/.test(k)) sapan.push(s + ': ölçü jetondan değil');
      if (!/box-sizing:\s*border-box/.test(k)) sapan.push(s + ': çizgi ölçüye DAHİL değil');
      if (!/background:\s*var\(--bant-zemin\)/.test(k)) sapan.push(s + ': zemin jetondan değil');
      // Sabit yükseklik dar pencerede sarılan düğmeleri bandın dışına taşırırdı.
      if (/(^|;)\s*height:/.test(k)) sapan.push(s + ': sabit height');
    });
    expect(sapan).toEqual([]);
  });

  // KURAL, liste değil: bant jetonunu kullanan HER kural aynı zemini ve bir
  // alt çizgiyi taşır. Yukarıdaki liste unutulan bir bandı görmez; bu halka
  // jetonu alıp zemini unutan yeni bir bandı görür.
  test('jetonu kullanan her kural zemini ve alt çizgiyi de taşıyor', () => {
    const re = /(?:^|\n)([^{}\n]+)\{([^}]*min-height:\s*var\(--bant-h\)[^}]*)\}/g;
    const eksik = []; let say = 0; let m;
    while ((m = re.exec(CSS))) {
      say++;
      const s = m[1].trim(), k = m[2];
      if (!/background:\s*var\(--bant-zemin\)/.test(k)) eksik.push(s + ': zemin');
      if (!/border-bottom:\s*1px solid var\(--border-color\)|box-shadow:\s*inset 0 -1px 0 var\(--border-color\)/.test(k)) {
        eksik.push(s + ': alt çizgi');
      }
    }
    expect(say).toBeGreaterThanOrEqual(BANTLAR.length);     // BOŞA ÇALIŞMIYOR
    expect(eksik).toEqual([]);
  });

  // BANT İNCE (2026-09-24). Kullanıcı: 36 px "gereksiz kalın". Bantların
  // doğal yüksekliği (gerçek tarayıcı, min-height 0): 21 · 28 · 23 · 24 · 29 px;
  // ölçü içerikten türüyor ve en yükseğini (Sonuçlar araç çubuğu) sığdırıyor.
  // Çizimin kendisi (içerik bandı büyütmüyor): kabuk-sutun.spec.js → "BANT İNCE".
  test('bant İNCE — ölçüsü içerikten: 29–30 px', () => {
    const px = Number(CSS.match(/--bant-h:\s*(\d+)px;/)[1]);
    expect(px).toBeLessThanOrEqual(30);
    expect(px).toBeGreaterThanOrEqual(29);
    // Araç çubuğunun dikey payı 2 px: 24 + 2·2 + 1 = 29 ≤ bant. 4 px'le 33'e
    // çıkıp komşusundan uzun kalırdı.
    expect(kural('.ve-trace-toolbar')).toMatch(/padding:\s*2px \d+px;/);
  });

  test('Topoloji bantlarında DİKEY iç pay yok — ölçüyü min-height veriyor', () => {
    // Kenar çubuğu başlığının 8 px'lik payı onu 37 px'e çıkarıyordu; müfettiş
    // başlığının 5 px'i 33'e. Pay yatayda kalır.
    ['.ve-sidebar-header', '.ve-properties-header'].forEach((s) => {
      // "0 Xpx" ya da "0 Xpx 0 Ypx": üst ve alt 0, yatay pay serbest.
      expect(kural(s)).toMatch(/padding:\s*0 \d+px(?: 0 \d+px)?;/);
    });
  });

  // Aktif sekme bandın çizgisini ÖRTMELİ ki tuvale bağlansın. Çizgi kenarlık
  // olarak dururken sekme şeridinin `overflow-y:hidden`ı sekmenin 1 px'lik
  // kaymasını kesiyordu ve çizgi aktif sekmenin altından da geçiyordu.
  test('sekme bandının çizgisi ZEMİNİN içinde — aktif sekme onu örtebiliyor', () => {
    const dock = kural('.ve-doc-dock');
    expect(dock).toMatch(/box-shadow:\s*inset 0 -1px 0 var\(--border-color\)/);
    expect(dock).not.toMatch(/border-bottom:/);
    expect(kural('.ve-tab-bar--top')).toMatch(/align-items:\s*stretch/);
    expect(kural('.ve-tab-bar--top .ve-tab')).toMatch(/top:\s*0/);
  });
});

describe('TUVAL KENARA YAPIŞIK — her sınır TEK çizgi', () => {
  test('tuvalin kendi çerçevesi yok: kenarlık, köşe, gölge', () => {
    const w = kural('.ve-canvas-wrapper');
    expect(w).not.toBeNull();
    expect(w).not.toMatch(/border(-\w+)?:/);
    expect(w).not.toMatch(/border-radius/);
    expect(w).not.toMatch(/box-shadow/);
  });

  test('kap tuvali içeri çekmiyor: pay ve aralık yok', () => {
    const c = kural('.ve-split-container');
    expect(c).not.toBeNull();
    expect(c).not.toMatch(/(^|;)\s*padding:/);
    expect(c).not.toMatch(/(^|;)\s*gap:/);
  });
});
