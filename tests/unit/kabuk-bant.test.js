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
  //
  // ALT ÇUBUK (2026-09-26): bir pencerenin alt çubuğu başlığıyla AYNI bantta
  // durur (sihirbaz: "orantısız" bildirimi, 2026-08-31) ve jetonu o yüzden
  // kullanır; çizgisi içeriğe bakan kenarında, ÜSTTE. Üst çizgi yalnız bu açık
  // listede aranır, üst bantlar için kapı gevşemedi.
  const ALT_CUBUKLAR = ['.ve-fw-foot'];
  test('jetonu kullanan her kural zemini ve alt çizgiyi de taşıyor', () => {
    const re = /(?:^|\n)([^{}\n]+)\{([^}]*min-height:\s*var\(--bant-h\)[^}]*)\}/g;
    const eksik = []; let say = 0; let m;
    while ((m = re.exec(CSS))) {
      say++;
      const s = m[1].trim(), k = m[2];
      if (!/background:\s*var\(--bant-zemin\)/.test(k)) eksik.push(s + ': zemin');
      if (ALT_CUBUKLAR.includes(s)) {
        if (!/border-top:\s*1px solid var\(--border-color\)/.test(k)) eksik.push(s + ': üst çizgi');
      } else if (!/border-bottom:\s*1px solid var\(--border-color\)|box-shadow:\s*inset 0 -1px 0 var\(--border-color\)/.test(k)) {
        eksik.push(s + ': alt çizgi');
      }
    }
    expect(say).toBeGreaterThanOrEqual(BANTLAR.length);     // BOŞA ÇALIŞMIYOR
    expect(eksik).toEqual([]);
  });

  // BANT İNCE. Kullanıcı: 36 px "gereksiz kalın" (2026-09-24), 30 px "hâlâ
  // boyuna geniş" (2026-09-26). Bant 26 px: içindeki düğmeler 22 px, altında
  // ve üstünde 2 px. Ölçü Segoe UI'ın satırıyla alındı (kullanıcının yazısı;
  // Inter'inkinden 1 px uzun) — en yüksek içerik 25 px.
  // Çizimin kendisi (içerik bandı büyütmüyor): kabuk-sutun.spec.js → "BANT İNCE".
  test('bant İNCE — ölçüsü içerikten: 26 px', () => {
    const px = Number(CSS.match(/--bant-h:\s*(\d+)px;/)[1]);
    expect(px).toBeLessThanOrEqual(26);
    expect(px).toBeGreaterThanOrEqual(25);
    // Araç çubuğunun dikey payı 1 px: 22 + 2·1 + 1 = 25 ≤ bant. 2 px'le 27'ye
    // çıkıp komşusundan uzun kalırdı.
    expect(kural('.ve-trace-toolbar')).toMatch(/padding:\s*1px \d+px;/);
  });

  // Bantta yan yana duran denetimler TEK boyda: segmentin dış boyu (iç düğme +
  // kabın iki çizgisi) tek başına duran düğmeninkine eşit. Segment 24 ↔ düğme
  // 22 iken çubuk iki ayrı boyda okunuyordu ve bandı segment belirliyordu.
  test('bant düğmeleri tek boyda — segment = düğme = İçe Aktar = 22 px', () => {
    const boy = (s) => Number((kural(s).match(/(?:^|;)\s*height:\s*(\d+)px/) || [])[1]);
    const dugme = boy('.ve-trace-btn');
    expect(dugme).toBe(22);
    expect(boy('.ve-trace-seg button') + 2).toBe(dugme);
    expect(boy('.ve-imp-tool')).toBe(dugme);
    expect(kural('.ve-imp-tool')).toMatch(/box-sizing:\s*border-box/);
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

// ŞERİT BANDI — "FEAD" yazan en üst satır (#ve-rb-strip). 38 px'ti; en yüksek
// öğesi 28 px'lik ▼ düğmesiydi, kalanı 24 px (arama · Çöz · avatar).
// Kullanıcı (2026-09-26, bu satırın ekran görüntüsüyle): "hâlâ boyuna geniş,
// çok yer kaplıyor." Çizim: tests/e2e/ust-bant.spec.js.
describe('ŞERİT BANDI İNCE — 32 px, gövde aynı boyda', () => {
  const jeton = (ad) => Number(CSS.match(new RegExp('--' + ad + ':\\s*(\\d+)px;'))[1]);

  test('bant 32 px; en yüksek denetimi komşularıyla aynı boyda', () => {
    const serit = jeton('ribbon-strip-h');
    expect(serit).toBeLessThanOrEqual(32);
    expect(serit).toBeGreaterThanOrEqual(30);
    // ▼ düğmesi arama kutusundan uzun olamaz: tek başına bandın kalınlığını
    // belirleyen öğe oydu.
    const boy = (s) => Number((kural(s).match(/(?:^|;)\s*height:\s*(\d+)px/) || [])[1]);
    expect(boy('.ve-rb-expand')).toBeLessThanOrEqual(boy('.ve-bant-ara'));
    // Denetimlerin altında ve üstünde en az 3 px: bant ince ama sıkışık değil.
    expect(serit - boy('.ve-bant-ara')).toBeGreaterThanOrEqual(6);
  });

  test('şerit AÇIKKEN gövde aynı boyda — bant kısalınca açık hâl de kısalır', () => {
    // Gövde = açık yükseklik − bant. Yalnız bant küçülseydi gövde sessizce
    // büyürdü (gruplar 94 px'e göre dizili).
    expect(jeton('ribbon-expanded-h') - jeton('ribbon-strip-h')).toBe(94);
  });
});
