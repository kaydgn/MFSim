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

// Kabuğun ÜST BANTLARI — soldan sağa: Topoloji (kenar çubuğu başlığı · müfettiş
// başlığı) ve Sonuçlar (Veri Gezgini · araç çubuğu · rapor bandı). Rayın köşe hücresi
// (Canlı Not 89) ve sekme bandı (Canlı Not 87) yok.
const BANTLAR = ['.ve-sidebar-header',
  '.ve-properties-header', '.ve-results-head', '.ve-trace-toolbar', '.ve-rep-head'];

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

  // TEK TOPOLOJİ (Canlı Not 87): sekme bandı ve onun kuralları yok; RAY TAM BOY (Canlı
  // Not 89): köşe hücresinin zemini ve alt çizgisi yok, rayın çizgisi tepeden iner.
  test('sekme bandı yok; ray tam boy — köşe hücresi bant değil', () => {
    const HTML = fs.readFileSync(path.join(KOK, 'index.html'), 'utf8');
    expect(HTML).not.toMatch(/id="ve-tab-bar"|id="ve-doc-dock"/);
    expect(CSS).not.toMatch(/\.ve-tab-bar|\.ve-doc-dock|\.ve-split-resizer|\.ve-snapshot-pane/);
    const once = kural('.ve-nav-rail::before');
    expect(once).not.toMatch(/background|border-bottom|min-height/);
    expect(once).toMatch(/(^|;)\s*height:\s*var\(--bant-h\)/);
    expect(kural('.ve-nav-rail::after')).toMatch(/top:\s*0;/);
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
describe('ŞERİT BANDI İNCE — 32 px, gövde yok', () => {
  const jeton = (ad) => Number(CSS.match(new RegExp('--' + ad + ':\\s*(\\d+)px;'))[1]);

  test('bant 32 px; en yüksek denetimi komşularıyla aynı boyda', () => {
    const serit = jeton('ribbon-strip-h');
    expect(serit).toBeLessThanOrEqual(32);
    expect(serit).toBeGreaterThanOrEqual(30);
    // ▼ düğmesi avatardan uzun olamaz: tek başına bandın kalınlığını belirleyen
    // öğe oydu. (Komut ara bantta yok — Canlı Not 24; ölçü bandın kalan denetimi.)
    const boy = (s) => Number((kural(s).match(/(?:^|;)\s*height:\s*(\d+)px/) || [])[1]);
    expect(boy('.ve-bant-avatar')).toBeGreaterThan(0);
    expect(boy('.ve-rb-expand')).toBeLessThanOrEqual(boy('.ve-bant-avatar'));
    // Denetimlerin altında ve üstünde en az 3 px: bant ince ama sıkışık değil.
    expect(serit - boy('.ve-bant-avatar')).toBeGreaterThanOrEqual(6);
  });

  // GÖVDE YOK (kullanıcı 2026-11-06, Canlı Not 59: *"Şu kısmın programdan tamamen
  // kalkmasını istiyorum … kenarda açılır bir ufak pencere … Programı daraltıyor"*):
  // açık şeridin gövdesi sayfayı 94 px aşağı itiyordu. Krom hep bandın boyu;
  // komutların penceresi bandın üstünde YÜZER. Çizim: ust-bant.spec.js →
  // *KOMUTLARIN PENCERESİ*.
  test('krom hep bandın boyu — açık gövde jetonu yok, pencere yüzer', () => {
    expect(CSS).toMatch(/--ribbon-h:\s*var\(--ribbon-strip-h\)/);
    expect(CSS).not.toMatch(/--ribbon-expanded-h/);
    const RB = fs.readFileSync(path.join(KOK, 'js/ribbon.js'), 'utf8');
    expect(RB).not.toMatch(/ribbon-expanded-h/);
    const dock = kural('.ve-rb-dock');
    expect(dock).toMatch(/position:\s*absolute/);
    const HTML = fs.readFileSync(path.join(KOK, 'index.html'), 'utf8');
    expect(HTML).not.toMatch(/id="ve-rb-collapse"/);
    // sekmeler pencerenin içinde, bantta değil
    const serit = HTML.slice(HTML.indexOf('id="ve-rb-strip"'), HTML.indexOf('id="ve-rb-dock"'));
    expect(serit).not.toMatch(/id="ve-rb-tabs"/);
    const pencere = HTML.slice(HTML.indexOf('id="ve-rb-dock"'));
    expect(pencere.slice(0, 400)).toMatch(/id="ve-rb-tabs"/);
  });
});

// RAY KENDİ SÜTUNU (2026-09-28). Kullanıcı: rayla "Bileşenler" sütununun
// "arası garip duruyor, bir çerçevesi yok." Atölye turunda aradaki çizgi tuval
// sayfasında saydam yapılmıştı (`html.ve-sayfa-tuval .ve-nav-rail`) ve paletin
// bandı rayın kenarında havada başlıyordu. Çizimin kendisi:
// kabuk-sutun.spec.js → "RAY ÇERÇEVELİ".
// 2026-11-09 (Canlı Not 89): RAY TAM BOY — köşe hücresi kalktı, çizgi (rayın
// kenarlığı değil, `::after`) tepeden iner.
describe('RAY KENDİ SÜTUNU — palet ile arasında TEK çizgi', () => {
  test('rayın sağında çizgi var, tepeden dibe; hiçbir kural onu kaldırmıyor', () => {
    const c = kural('.ve-nav-rail::after');
    expect(c).toMatch(/content:\s*""/);
    expect(c).toMatch(/right:\s*0/);
    expect(c).toMatch(/top:\s*0;/);
    expect(c).toMatch(/bottom:\s*0/);
    expect(c).toMatch(/width:\s*1px/);
    expect(c).toMatch(/background:\s*var\(--border-color\)/);
    expect(kural('.ve-nav-rail')).toMatch(/position:\s*relative/);
    // Kenarlık çizgisi yok (bant satırını keserdi); çizgiyi kaldıran kural da yok.
    expect(kural('.ve-nav-rail')).not.toMatch(/border-right:/);
    expect(CSS).not.toMatch(/\.ve-nav-rail::after\s*\{[^}]*(?:display:\s*none|background:\s*(?:transparent|none))/);
    // Çizgi TEK: paletin sol kenarı yok.
    expect(kural('.ve-sidebar')).not.toMatch(/border-left:/);
  });

  test('rayın başındaki aralık bandın boyunda ama bant DEĞİL (zemin ve çizgi yok)', () => {
    const k = kural('.ve-nav-rail::before');
    expect(k).toMatch(/content:\s*""/);
    expect(k).not.toMatch(/border-bottom|background/);
    // Rayın ÜST dolgusu yok (aralık şeridin altına yapışır); yan dolguyu
    // aralık geri alır ki dikey çizgiye kadar uzansın.
    const pay = kural('.ve-nav-rail').match(/padding:\s*0 (\d+)px \d+px;/);
    expect(pay).not.toBeNull();
    expect(k).toMatch(new RegExp('margin:\\s*0 -' + pay[1] + 'px'));
  });

  // Kullanıcı 2026-11-10 (Canlı Not 98): "Şu 'topoloji' butonunun üstü boş duruyor."
  // Aralık paletin bandıyla hizanın ve açma düğmesinin yeri; paletsiz kapsamda ikisi
  // de yok, aralık kapanır. Çizimin kendisi: kabuk-sutun.spec.js → "PALETSİZ KAPSAM".
  test('paletsiz kapsamda (FEAD) rayın başında aralık yok', () => {
    expect(kural('#sayfa2-content.ve-paletsiz .ve-nav-rail::before')).toMatch(/height:\s*0;/);
  });
});
