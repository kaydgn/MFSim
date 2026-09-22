/**
 * source-hygiene.test.js
 * ───────────────────────
 * Kaynak dosyaların YAPISAL bütünlük kapıları. Davranış değil, dosyanın
 * kendisi test edilir — çünkü bu incelemede bulunan iki hata da tam olarak
 * buradan sızmıştı ve hiçbir davranış testi onları göremezdi.
 *
 * 1) ÜST-SEVİYE BİLDİRİM ÇAKIŞMASI
 *    js/ modülleri tarayıcıda ayrı <script> olarak yüklenir ve TEK global
 *    kapsamı paylaşır. Aynı adla ikinci bir üst-seviye bildirim, birincisini
 *    sessizce ezer. js/results.js'te tam olarak bu olmuştu: aynı dosyada iki
 *    `veDownloadReportHTML` vardı, dört TXT önizleme düğmesi yanlış üreticiye
 *    gidiyordu ve 1229 fonksiyon içinde kimse fark etmemişti.
 *
 * 2) KONTROL KARAKTERİ
 *    js/trace-view.js:584'te bir dizgenin içinde NUL (0x00) baytı duruyordu.
 *    Görünür bir yanlış çıktı üretmiyordu ama dosyayı grep/diff için İKİLİ
 *    yapıyordu: 3454 satırlık dosya kod aramalarında sessizce atlanıyordu.
 *    Bayt, viewer/js/ kopyasına ve kullanıcıların indirdiği
 *    MFSim_Olcum_Goruntuleyici.html dosyasına da taşınmıştı.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');
const JS_DIR = path.join(ROOT, 'js');
const VIEWER_JS_DIR = path.join(ROOT, 'viewer/js');
const CAN_JS_DIR = path.join(ROOT, 'candbc/js');
const CSS_DIR = path.join(ROOT, 'css');

function jsFiles(dir) {
  return fs.readdirSync(dir).filter(f => f.endsWith('.js')).sort()
    .map(f => ({ rel: path.relative(ROOT, path.join(dir, f)), abs: path.join(dir, f) }));
}

// Yalnızca SÜTUN 0'daki bildirimler üst-seviyedir. İç içe fonksiyonlar
// girintili olduğu için doğal olarak elenir; kapı bu yüzden gürültüsüz.
const PATTERNS = [
  { kind: 'function', re: /^function\s+([A-Za-z_$][\w$]*)/ },
  { kind: 'var', re: /^var\s+([A-Za-z_$][\w$]*)\s*=/ },
  { kind: 'let/const', re: /^(?:let|const)\s+([A-Za-z_$][\w$]*)\s*=/ },
];

function collectDeclarations(files) {
  const seen = new Map(); // ad -> [{ kind, where }]
  for (const f of files) {
    const lines = fs.readFileSync(f.abs, 'utf8').split('\n');
    lines.forEach((line, i) => {
      for (const p of PATTERNS) {
        const m = p.re.exec(line);
        if (m) {
          const name = m[1];
          if (!seen.has(name)) seen.set(name, []);
          seen.get(name).push({ kind: p.kind, where: `${f.rel}:${i + 1}` });
          break;
        }
      }
    });
  }
  return seen;
}

function duplicateReport(seen) {
  const dups = [...seen.entries()].filter(([, v]) => v.length > 1);
  return dups.map(([name, list]) =>
    `  ${name} — ${list.map(d => `${d.where} (${d.kind})`).join('  ve  ')}`).join('\n');
}

describe('üst-seviye bildirim çakışması yok', () => {
  test('js/ — 67 modül tek global kapsamı paylaşıyor, ad çakışması yok', () => {
    const report = duplicateReport(collectDeclarations(jsFiles(JS_DIR)));
    expect(report).toBe('');
  });

  test('viewer/js/ — Ölçüm Görüntüleyici kendi kapsamında çakışmasız', () => {
    const report = duplicateReport(collectDeclarations(jsFiles(VIEWER_JS_DIR)));
    expect(report).toBe('');
  });

  // CAN Çözümleyici de tek dosyaya gömülen ayrı bir programdır ve modülleri
  // aynı global kapsamı paylaşır; kapı burada da geçerli.
  test('candbc/js/ — CAN Çözümleyici kendi kapsamında çakışmasız', () => {
    const report = duplicateReport(collectDeclarations(jsFiles(CAN_JS_DIR)));
    expect(report).toBe('');
  });
});

describe('kaynak dosyalarda kontrol karakteri yok', () => {
  // İzin verilenler: \t (0x09), \n (0x0A), \r (0x0D). Diğer C0 kontrol
  // karakterleri ve DEL (0x7F) kaynağa girmemeli.
  const FORBIDDEN = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/;

  const targets = [
    ...jsFiles(JS_DIR),
    ...jsFiles(VIEWER_JS_DIR),
    ...jsFiles(CAN_JS_DIR),
    ...fs.readdirSync(CSS_DIR).filter(f => f.endsWith('.css')).sort()
      .map(f => ({ rel: path.relative(ROOT, path.join(CSS_DIR, f)), abs: path.join(CSS_DIR, f) })),
    { rel: 'index.html', abs: path.join(ROOT, 'index.html') },
    { rel: 'candbc/index.html', abs: path.join(ROOT, 'candbc/index.html') },
  ];

  test.each(targets.map(t => [t.rel, t.abs]))('%s temiz', (rel, abs) => {
    const src = fs.readFileSync(abs, 'utf8');
    const m = FORBIDDEN.exec(src);
    if (m) {
      const line = src.slice(0, m.index).split('\n').length;
      const code = '0x' + src.charCodeAt(m.index).toString(16).padStart(2, '0');
      throw new Error(
        `${rel}:${line} içinde kontrol karakteri ${code} var.\n` +
        `Bağlam: ${JSON.stringify(src.slice(Math.max(0, m.index - 60), m.index + 60))}`);
    }
    expect(m).toBeNull();
  });
});


/* ═══════════════════════════════════════════════════════════════════════════
 * YER TUTUCU RENGİ JETONDAN GELİR
 * ═══════════════════════════════════════════════════════════════════════════
 * Tarayıcının varsayılan `::placeholder` grisi TEMAYA BAKMAZ: Chromium her
 * temada rgb(117,117,117) çiziyor, değerin rengi ise jetondan geliyor. ÖLÇÜLDÜ
 * (19 tema, gerçek tarayıcı, özellik panelindeki devir sınırı alanı): on
 * dördünde kontrast 4,5:1'in altında, `vscode`'da 2,39:1 — 3:1'in de altında.
 * `--text-muted` ile on dokuzun en kötüsü 4,59:1.
 *
 * BU KAPI NEDEN METİN OKUYOR: renk temaya göre çözülüyor, yani "doğru renk mi"
 * sorusunun cevabı ancak gerçek tarayıcıda ve tema tema alınır — jsdom
 * `::placeholder`ı hiç hesaplamaz. Node'da tutulabilecek olan şey KURALIN
 * VARLIĞI ve sabit renk YAZILMAMIŞ olması; ikisi de sessizce kaybolabilir
 * (kural silinirse UA grisine düşer, sabit yazılırsa tek temada doğru olur).
 * ═══════════════════════════════════════════════════════════════════════════ */
describe('yer tutucu rengi jetondan', () => {
  const css = fs.readFileSync(path.join(CSS_DIR, 'styles.css'), 'utf8');

  // `input::placeholder{...}` gövdelerini topla (seçici listesinde input geçen).
  const bloklar = [];
  const re = /([^{}]*::placeholder[^{}]*)\{([^}]*)\}/g;
  let m;
  while ((m = re.exec(css))) bloklar.push({ sec: m[1].trim(), gov: m[2] });

  test('input/textarea için ::placeholder kuralı VAR', () => {
    const genel = bloklar.filter(b => /(^|,|\s)(input|textarea)::placeholder/.test(b.sec));
    expect(genel.length).toBeGreaterThan(0);
  });

  test('her ::placeholder kuralı rengi JETONDAN alıyor — sabit renk yok', () => {
    const sabit = /color\s*:\s*(#[0-9a-f]{3,8}|rgba?\(|hsla?\()/i;
    bloklar.forEach((b) => {
      if (!/color\s*:/i.test(b.gov)) return;          // renk yazmıyorsa konu dışı
      if (sabit.test(b.gov))
        throw new Error(`"${b.sec}" yer tutucuya SABİT renk yazıyor: ${b.gov.trim()}\n` +
          'Renk var(--text-muted) gibi bir jetondan gelmeli — yoksa tek temada doğru olur.');
      expect(b.gov).toMatch(/color\s*:\s*var\(--/);
    });
  });

  test('genel kural Firefox için opacity:1 veriyor', () => {
    // Firefox yer tutucuya varsayılan bir saydamlık uygular; rengi jetona
    // bağlamak tek başına orada YETMEZ.
    const genel = bloklar.filter(b => /(^|,|\s)(input|textarea)::placeholder/.test(b.sec));
    genel.forEach((b) => expect(b.gov).toMatch(/opacity\s*:\s*1/));
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  JETON ROLÜ — `--accent-*` DOLGU, `--ink-*` METİN
// ═══════════════════════════════════════════════════════════════════════════
//
// Yer tutucu kapısıyla (yukarıda) AYNI SINIF, ikinci kez: doğru aileden
// YANLIŞ jetonu almak. Depoda iki aile var ve ikisi de her temada tanımlı:
//
//   --accent-danger/warning/success → DOLGU rolü (çerçeve, zemin, şerit)
//   --ink-danger/warning/success    → METİN rolü (zemine karşı okunur)
//
// FEAD Başlangıç Sihirbazı metin rengini `--accent-*`'tan alıyordu. ÖLÇÜLDÜ:
// 19 tema × 3 rol = 57 çiftin **33'ü** WCAG AA'nın (4,5:1) altında; `--ink-*`
// ile **0**. En kötüsü sihirbazın en çok okunan metniydi — eksik girdi
// listesi: pearl temasında uyarı satırı **2,33:1**.
//
// Kapı ROLE bakıyor, listeye değil: `.ve-fw-*` seçicilerinde `color:` ASLA
// dolgu jetonu almaz. Çerçeve ve zemin serbesttir — orada doğru aile odur.
describe('sihirbaz jeton rolü: metin --ink-*, dolgu --accent-*', () => {
  const css = fs.readFileSync(path.join(CSS_DIR, 'styles.css'), 'utf8');
  const satir = css.split('\n');

  // Seçiciyi satır satır taşı: bir kural gövdesi birden çok satıra yayılıyor.
  const bul = () => {
    const cikan = [];
    let sec = '';
    satir.forEach((l, i) => {
      const m = l.match(/^\s*([.#][\w\-.,:>()[\]="'\s]+)\{/);
      if (m) sec = m[1];
      const c = l.match(/(?<![a-z-])color\s*:\s*var\(--accent-(danger|warning|success)\)/);
      if (c && /ve-fw/.test(m ? m[1] : sec)) cikan.push({ n: i + 1, sec: (m ? m[1] : sec).trim(), l: l.trim() });
    });
    return cikan;
  };

  test('--ink-* ailesi gerçekten tanımlı (kapının dayandığı zemin)', () => {
    ['danger', 'warning', 'success'].forEach((r) => {
      expect(css).toMatch(new RegExp('--ink-' + r + '\\s*:'));
    });
  });

  test('sihirbaz metin rengini DOLGU jetonundan almıyor', () => {
    const suclu = bul();
    if (suclu.length) {
      throw new Error(
        suclu.map((x) => `  css/styles.css:${x.n}  ${x.l}`).join('\n') +
        '\n\n`color:` METİN rolüdür → var(--ink-danger|warning|success) kullanın.\n' +
        '`--accent-*` dolgu rolüdür; metin olarak 19 temanın çoğunda AA altında kalır.');
    }
    expect(suclu).toEqual([]);
  });

  test('sihirbaz ÇERÇEVEYİ hâlâ dolgu jetonundan alıyor', () => {
    // Ters yön: `--ink-*`'ı her yere yaymak da yanlış olurdu — durum şeridi
    // ve çerçeve rengi dolgu rolüdür ve orada `--accent-*` DOĞRU jetondur.
    const n = (css.match(/\.ve-fw-[^{]*\{[^}]*border(?:-left)?-color\s*:\s*var\(--accent-(danger|warning|success)\)/g) || []).length;
    expect(n).toBeGreaterThanOrEqual(3);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  FEAD PANEL KOZMETİĞİ — üç ölçülmüş kusurun kapısı
// ═══════════════════════════════════════════════════════════════════════════
//
// Gerçek tarayıcıda yedi FEAD paneli süpürüldü (2026-09-14) ve üç şey çıktı:
//
//   başlık yüksekliği   92 px ↔ 44 px   kasnak/çözücü varsayılan (ortalı-simge)
//                                       kimliğe düşüyordu, gergi/kayış kompakta
//   kırpılan denetim    3                "…çapından türet" 169 px gerek / 120 alan
//   satır uzunluğu      207 karaktere    okunur bant 65–75
//
// Üçü de SESSİZ: hiçbiri hata vermiyor, hiçbiri testten düşmüyordu.
describe('FEAD panel kozmetiği', () => {
  const css = fs.readFileSync(path.join(CSS_DIR, 'styles.css'), 'utf8');
  const src = fs.readFileSync(path.join(JS_DIR, 'cp-fead.js'), 'utf8');
  const core = fs.readFileSync(path.join(JS_DIR, 'cp-core.js'), 'utf8');

  // Kasnak tipleri componentDefs'ten okunur — listeye elle yazmak, yeni bir
  // kasnak tipi eklendiğinde kapının onu sessizce atlaması demekti.
  const KASNAK = [...new Set([...fs.readFileSync(path.join(JS_DIR, 'components.js'), 'utf8')
    .matchAll(/'(fead-(?:crank|alternator|ac|waterpump|ps|aircomp|fan|idler))'\s*:/g)]
    .map((m) => m[1]))];

  test('kasnak tipleri gerçekten bulunuyor (kapının dayandığı zemin)', () => {
    expect(KASNAK.length).toBeGreaterThanOrEqual(7);
  });

  test('HER FEAD paneli aynı kimlik satırını alıyor', () => {
    // İkisinden birinde olmak yeter: --wide ve --compact aynı kompakt-sol
    // kimliği veriyor, fark yalnız pencere genişliğinde.
    const liste = (ad) => {
      const m = new RegExp('var ' + ad + '\\s*=\\s*\\[([\\s\\S]*?)\\];').exec(core);
      return m ? [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]) : [];
    };
    const hepsi = new Set([...liste('VE_WIDE_PANEL_TYPES'), ...liste('VE_COMPACT_PANEL_TYPES')]);
    const disarda = [...KASNAK, 'fead-solver', 'fead-tensioner', 'fead-belt']
      .filter((t) => !hepsi.has(t));
    expect(disarda).toEqual([]);
  });

  test('açıklama satırı CSS sınıfından, satır içi stilden DEĞİL', () => {
    expect(src).toMatch(/function _feadHint\(text\)\{\s*\n\s*return '<div class="ve-fead-not">/);
    expect(css).toMatch(/\.ve-fead-not\{/);
  });

  test('açıklama satırının ÖLÇÜ SINIRI var — satır 207 karaktere çıkmasın', () => {
    const blok = (/\.ve-fead-not\{([^}]*)\}/.exec(css) || [, ''])[1];
    const m = /max-width\s*:\s*(\d+)ch/.exec(blok);
    expect(m).not.toBeNull();
    // Okunur bant 65–75; tavan 80'i geçerse sınır bir işe yaramaz.
    expect(+m[1]).toBeGreaterThanOrEqual(60);
    expect(+m[1]).toBeLessThanOrEqual(80);
  });

  test('açılır liste SABİT piksel değil — yatay yarış BİTTİ', () => {
    // Ölçülmüş kusur: en uzun seçenek 169 px istiyor, sabit genişlik 120 px
    // veriyordu ve metin kırpılıyordu. O günkü çare "taban + esneme + tavan"lı
    // bir SÜTUN ORANIYDI, çünkü etiket aynı satırda yer istiyordu.
    //
    // Etiket üste çıkınca liste alanın TAMAMINI alıyor: kırpılma sebebi
    // ortadan kalktı, oran kuralına gerek yok. Kural emekli DEĞİL, YERİ
    // değişti — artık CSS metninde değil GERÇEK TARAYICIDA ölçülüyor
    // (tests/e2e/fead-panel-gramer.spec.js), yani kırpılmanın kendisi.
    //
    // Burada kalan şey NEGATİF kapı: sabit piksel geri gelmesin.
    expect(src).not.toMatch(/<select[^>]*style="width:\d+px/);
    expect(src).not.toMatch(/_FEAD_SEL|_FEAD_INP/);
    expect(css).not.toMatch(/\.ve-fp-sel\{[^}]*width:\s*\d+px/);
  });

  test('PANEL DİLİ CSS\'te — satır içi stil DURUM ifade edemez', () => {
    // P5'in kapısı. JS sınıf basıyor; CSS o sınıflara durum kuralı veriyor.
    // Tek başına hiçbiri bir şey ifade etmez: sınıf basılıp CSS bloğu silinse
    // bütün JS kapıları yeşil kalırdı (kural 14'ün çift kapı gerekçesi).
    ['ve-fp-sect', 've-fp-grid', 've-fp-f', 've-fp-l', 've-fp-inp', 've-fp-sel', 've-fp-chk']
      .forEach((c) => {
        expect(src).toContain(c);
        expect(css).toContain('.' + c);
      });
    // Durum kuralları GERÇEKTEN var.
    expect(css).toMatch(/\.ve-fp-inp:hover/);
    expect(css).toMatch(/\.ve-fp-inp:focus/);
    expect(css).toMatch(/\.ve-fp-sel:focus/);
    expect(css).toMatch(/\.ve-fp-chk:hover/);
  });

  test('ETİKET ile GİRİŞ aynı KENARA yaslı — P3', () => {
    // Ölçülen kusur: `_feadGrid` etiketi `text-align:center`, `_FEAD_INP` ise
    // `text-align:right` yazıyordu. Etiket sayının üstünde ortalanıyor, değer
    // sağa yapışıyordu.
    //
    // O gün çare "ikisini aynı satıra koy" olmuştu. Atölye grameri etiketi
    // üste aldı (Kayış Tablosu'nun kalıbı) ve aynı kusur yeniden açılabilirdi;
    // hüküm bu yüzden KENARA taşındı: etiket, denetiminin yaslandığı kenara
    // yaslanır. Bir liste değil bir KURAL — yeni bir alan tipi kendi hizasını
    // getirdiğinde etiket onu izler.
    expect(src).not.toMatch(/text-align:center[^']*'\s*\+\s*c\.label/);

    const f = (/\.ve-fp-f\{([^}]*)\}/.exec(css) || [, ''])[1];
    expect(f).toMatch(/flex-direction:\s*column/);      // etiket ÜSTTE

    const l = (/\.ve-fp-l\{([^}]*)\}/.exec(css) || [, ''])[1];
    expect(l).toMatch(/justify-content:\s*flex-end/);   // sayı alanı: sağ kenar
    // ve sola yaslı denetimler etiketi de sola çeker
    expect(css).toMatch(/\.ve-fp-f:has\(\.ve-fp-sel\)[^{]*\{[^}]*flex-start/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3) PALET KATMANI DIŞINDA ÇIPLAK RENK YOK
//
// ÖLÇÜLEN KUSUR (2026-09-22): css/styles.css'te tema bloklarının dışında
// 63 çıplak renk vardı — hiçbiri temayı izlemiyordu ve hiçbirinin kapısı
// yoktu. Tek kapı theme-consistency'deki "sabit-mavi vurgu tonu" halkasıydı
// ve o da YALNIZ rgba(59,130,246) desenini arıyordu; 63'ün hiçbiri o desene
// uymuyordu.
//
// En pahalıları sessizdi: `.dr-chart-tooltip` KOYU bir kutuydu
// (rgba(30,36,48,0.92) + #e0e4ec), yani açık zeminde kâğıdın üstünde koyu bir
// leke olarak kalırdı. `.sw-*` durum paneli ve deploy noktaları sabit 2024
// yeşili/kırmızısı yazıyordu. Hiçbiri programı durdurmaz; yalnız yanlış
// görünür.
//
// MEŞRU DÖRT İSTİSNA — bunlar renk değil:
//   • iki `mask-image` gradyanındaki #000 (maske eşiği, boya değil)
//   • bir color-mix() karartıcısındaki #000 (işlem parametresi)
//   • --scrim (tema-nötr siyah perde) üstündeki #fff
const STYLES = fs.readFileSync(path.join(CSS_DIR, 'styles.css'), 'utf8');

describe('palet katmanı dışında çıplak renk yok', () => {
  // Tema bloklarının bittiği yer: ikinci üst-seviye `}` kapanışı.
  const paletSonu = (() => {
    const satirlar = STYLES.split('\n');
    let kapanis = 0;
    for (let i = 0; i < satirlar.length; i++) {
      if (/^ {4}\}\s*$/.test(satirlar[i]) && ++kapanis === 2) return i + 1;
    }
    return 0;
  })();

  test('palet katmanının sınırı bulunabildi (regex kayması erken yakalansın)', () => {
    expect(paletSonu).toBeGreaterThan(20);
    expect(paletSonu).toBeLessThan(400);
  });

  test('gövdede palete-bağlı çıplak renk kalmadı', () => {
    // Yorumlar boşlukla doldurulur — satır numaraları kaysın istemiyoruz.
    const govde = STYLES
      .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
      .split('\n').slice(paletSonu);

    // Tema-NÖTR sayılanlar: saf siyah, saf beyaz ve saf gri. Bunlar bir
    // paletin değil bir işlemin (perde, maske, karartma) parçası.
    const notr = /rgba?\(\s*(0,\s*0,\s*0|255,\s*255,\s*255|128,\s*128,\s*128)/;
    const MESRU = 4;

    const bulunan = [];
    govde.forEach((satir, i) => {
      const m = satir.match(/#[0-9a-fA-F]{3,8}\b|rgba?\([0-9][^)]*\)/g);
      if (!m) return;
      m.forEach((r) => {
        if (notr.test(r)) return;
        bulunan.push(`${paletSonu + i + 1}: ${r} — ${satir.trim().slice(0, 70)}`);
      });
    });

    // Sayı YALNIZ AŞAĞI iner. Yeni bir çıplak renk eklenirse bu kapı adıyla,
    // satırıyla ve bağlamıyla söyler.
    expect(bulunan.length).toBeLessThanOrEqual(MESRU);
  });

  // Ölü var() yedeği: css/styles.css'te yedek HİÇ devreye girmez, çünkü :root
  // yirmi dört jetonun hepsini koşulsuz bildiriyor. Yedekler eski paletin
  // donmuş kopyasıydı — ör. --accent-tint-6'nın yedeği 2024 mavisiydi ve
  // jeton yeniden adlandırılsa o mavi sessizce geri gelirdi.
  test('stil sayfasında ölü var() renk yedeği yok', () => {
    const olu = STYLES.match(/var\(\s*--[a-z0-9-]+\s*,\s*(?:#[0-9a-fA-F]{3,8}|rgba?\([^()]*\))\s*\)/g) || [];
    expect(olu).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4) ŞEKİL ÖLÇEĞİ DIŞINDA SABİT YARIÇAP YOK
//
// ÖLÇÜLEN KUSUR (2026-09-22): --radius-* jetonu 197 yerde kullanılıyordu ama
// 61 nokta ondan bağımsız sabit yazıyordu. Jetonun değerini değiştirmek o 61
// noktanın hiçbirini oynatmaz: sonuç yarısı yuvarlak yarısı keskin bir arayüz
// olurdu ve hiçbir test bunu ölçmezdi.
//
// İKİ ŞEY ÖLÇEĞİN PARÇASI DEĞİLDİR ve jetona ÇEVRİLMEZ:
//   • `border-radius: 50%` — bu bir DAİRE (nokta, avatar, gösterge), yarıçap
//     basamağı değil. Jetona bağlanırsa daire elips olur.
//   • `border-radius: 0` — bilinçli köşeleme (sıfırlama, bitişik hücre).
//     Ölçekten bir basamak seçmek onu sessizce yuvarlardı.
describe('şekil ölçeği dışında sabit yarıçap yok', () => {
  const jetonBlokSonu = STYLES.indexOf('--shadow-inset:');

  test('şekil jetonları bulunabildi (regex kayması erken yakalansın)', () => {
    expect(jetonBlokSonu).toBeGreaterThan(0);
    ['xs', 'sm', 'md', 'lg', 'xl', 'pill'].forEach((r) => {
      expect(STYLES).toMatch(new RegExp('--radius-' + r + ':\\s*[0-9]'));
    });
  });

  // Ölçüt JETONDAN SONRA KALANDIR, bildirimin ilk karakteri değil: köşe başına
  // yazılan `0 var(--radius-sm) var(--radius-sm) 0` tamamen ölçeğe bağlıdır
  // ama rakamla başlar. İlk yazımı o bildirimi kusur sayıyordu — kapı kendi
  // ölçtüğü şeyi yanlış tarif ediyordu.
  test('gövdede ölçek dışı sabit yarıçap kalmadı', () => {
    const govde = STYLES.slice(jetonBlokSonu)
      .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
    const sabit = [];
    (govde.match(/border-radius:\s*[^;}]+/g) || []).forEach((bildirim) => {
      const ham = bildirim.replace(/border-radius:\s*/, '').trim();
      ham
        .replace(/var\(\s*--[a-z0-9-]+\s*\)/g, ' ')   // jetona bağlı parça düşer
        .split(/[\s/]+/)
        .filter(Boolean)
        .filter((v) => /[0-9]/.test(v) && v !== '50%' && v !== '0')
        .forEach(() => sabit.push(ham));
    });
    expect([...new Set(sabit)]).toEqual([]);
  });

  // Gölge jetonlarına `none` YAZILMAZ — bu kural emekli değil. Bazı
  // bildirimler onları liste içinde kullanıyor (`0 0 0 1px accent,
  // var(--shadow-sm)`) ve `none` orada tüm bildirimi geçersiz kılıp odak
  // halkasını sessizce düşürürdü.
  test('gölge jetonları geçerli sözdizimi taşıyor, none değil', () => {
    ['sm', 'md', 'lg', 'xl', 'inset'].forEach((k) => {
      const m = STYLES.match(new RegExp('--shadow-' + k + ':\\s*([^;]+);'));
      expect(m).not.toBeNull();
      expect(m[1].trim()).not.toBe('none');
      expect(m[1]).toMatch(/\d/);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 5) JS SATIR İÇİ YARIÇAPI DA ÖLÇEĞE BAĞLI
//
// Bölüm 4 yalnız `css/styles.css`'i ölçüyor. Arayüzün büyük bölümü ise satır
// içi `style="..."` dizeleriyle JS'ten kuruluyor: ÖLÇÜLDÜ (2026-09-22) — 96
// nokta, jetondan bağımsız. Yani ölçeği değiştirmek panelleri oynatıyor ama
// çözücü kartlarını, takoz künyelerini ve sihirbaz düğmelerini OLDUĞU YERDE
// bırakıyordu. Hata sessiz: her ekran kendi başına tutarlı görünür.
//
// SINIFLANDIRMA SAYIYA DEĞİL ROLE GÖRE. Aynı `1px` iki ayrı işte geçiyordu:
// 22×22 kapatma düğmesinde (KAP — ölçeğe bağlanır) ve 14×3 lejant çubuğunda
// (ÇİZGİ ÖRNEĞİ — diyagram dilinin parçası, bağlanmaz). Sayıya göre
// çevirmek ikincisini kapsüle döndürürdü.
//
// ÇİZGİ ÖRNEĞİ KURALLA ELENİR, LİSTEYLE DEĞİL: aynı bildirimde kendi kutusunu
// ≤3px ilan eden bir eleman çizgidir. Böylece yarın eklenen bir lejant çubuğu
// kendiliğinden geçer, yarın eklenen bir düğme geçmez.
describe('JS satır içi yarıçapı ölçeğe bağlı', () => {
  // BELGE ÜRETEN yüzeyler kapsam dışı: indirilen rapor kendi stil sayfasını
  // taşır ve `var(--radius-*)` orada TANIMSIZDIR — bağlamak yarıçapı sessizce
  // 0 yapardı. 2048 tahtası da kendi geometrisi (kendi paleti gibi).
  // Sayılar TAM eşleşir: bir satır silinince boşalan yer yeni bir sapmaya
  // açılmasın.
  const KAPSAM_DISI = {
    'js/results.js': 3,          // rapor BELGESİ stil sayfası (--prusya/--paper)
    'js/cp-mount-report.js': 1,  // rapor belgesinde lejant kutusu
    'js/game-2048.js': 4,        // 2048'in kendi tahtası: tahta · göz · taş · örtü
  };

  function sabitler() {
    const bulunan = {};
    jsFiles(JS_DIR).forEach(({ rel, abs }) => {
      fs.readFileSync(abs, 'utf8').split('\n').forEach((sat, i) => {
        const re = /border-radius:\s*([^;"'`}]+)/g;
        let m;
        while ((m = re.exec(sat)) !== null) {
          const ham = m[1].trim();
          if (/var\(\s*--radius/.test(ham)) continue;
          if (ham === '50%' || ham === '0' || ham === 'inherit') continue;  // daire · bilinçli köşe
          // Kendi kutusunu ≤3px ilan eden eleman bir ÇİZGİ ÖRNEĞİDİR.
          const bas = Math.max(sat.lastIndexOf('style="', m.index), sat.lastIndexOf('{', m.index), 0);
          const kap = sat.slice(bas, m.index);
          const w = /width:\s*([0-9.]+)px/.exec(kap);
          const h = /height:\s*([0-9.]+)px/.exec(kap);
          if ((w && parseFloat(w[1]) <= 3) || (h && parseFloat(h[1]) <= 3)) continue;
          (bulunan[rel] = bulunan[rel] || []).push(`${rel}:${i + 1} → ${ham}`);
        }
      });
    });
    return bulunan;
  }

  test('kapsam dışı olmayan hiçbir dosyada ölçek dışı yarıçap yok', () => {
    const b = sabitler();
    const sapan = Object.keys(b).filter((f) => !KAPSAM_DISI[f])
      .reduce((a, f) => a.concat(b[f]), []);
    expect(sapan).toEqual([]);
  });

  test('kapsam dışı sayılar TAM eşleşiyor (boşalan yer yeni sapmaya açılmasın)', () => {
    const b = sabitler();
    const olculen = {};
    Object.keys(KAPSAM_DISI).forEach((f) => { olculen[f] = (b[f] || []).length; });
    expect(olculen).toEqual(KAPSAM_DISI);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 6) TANIMSIZ JETONA BAŞVURU YOK
//
// ÖLÇÜLEN KUSUR (2026-09-22): `--bg-hover` BEŞ yerden çağrılıyordu (dört
// `:hover` kuralı + 2048'in düğmesi) ve HİÇBİR YERDE bildirilmemişti. Yani o
// dört yüzeyde fare üstündeyken hiçbir şey olmuyordu.
//
// Hata sınıfı tam olarak bu deponun korktuğu sınıf: CSS'te çözülemeyen bir
// özel özellik bildirimi SESSİZCE geçersiz kılar — konsola hiçbir şey düşmez,
// hiçbir test kırılmaz, yalnız beklenen şey olmaz. Beş yıl durabilirdi.
//
// Kapı `css/` ve `js/` içindeki HER `var(--x)` başvurusunu `css/`'te bildirilen
// jeton kümesiyle karşılaştırır.
describe('tanımsız jetona başvuru yok', () => {
  const cssDosyalari = fs.readdirSync(CSS_DIR).filter((f) => f.endsWith('.css'))
    .map((f) => fs.readFileSync(path.join(CSS_DIR, f), 'utf8'));
  const tumCss = cssDosyalari.join('\n');

  // Bildirilen jeton: `--ad:` biçiminde YAZILAN her şey (tema blokları dahil).
  const tanimli = new Set(
    [...tumCss.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1])
  );

  // Belge üreticileri KENDİ jetonlarını kendi stil sayfalarında bildiriyor
  // (rapor: --ink/--warn/--line/--vurgu/--paper…, kılavuz: kendi kümesi).
  // Onlar `css/` altında yok ve olmamalı — ürünün stilini şişirirlerdi.
  const BELGE_URETEN = new Set([
    'cp-mount-report.js', 'cp-fead-report.js', 'mount-report-template.js',
    'mount-report-assets.js', 'guide-kit.js', 'guide-fead.js', 'results.js',
    'cp-fead-summary.js',
  ]);

  test('jeton kümesi okunabildi (regex kayması erken yakalansın)', () => {
    expect(tanimli.size).toBeGreaterThan(100);
    expect(tanimli.has('--bg-primary')).toBe(true);
  });

  test('css/ içinde tanımsız jetona başvuru yok', () => {
    const eksik = [];
    fs.readdirSync(CSS_DIR).filter((f) => f.endsWith('.css')).forEach((f) => {
      fs.readFileSync(path.join(CSS_DIR, f), 'utf8').split('\n').forEach((sat, i) => {
        [...sat.matchAll(/var\(\s*(--[\w-]+)\s*\)/g)].forEach((m) => {
          if (!tanimli.has(m[1])) eksik.push(`css/${f}:${i + 1} → ${m[1]}`);
        });
      });
    });
    expect(eksik).toEqual([]);
  });

  test('js/ içinde tanımsız jetona başvuru yok (belge üreticileri hariç)', () => {
    const eksik = [];
    jsFiles(JS_DIR).forEach(({ rel, abs }) => {
      if (BELGE_URETEN.has(path.basename(abs))) return;
      fs.readFileSync(abs, 'utf8').split('\n').forEach((sat, i) => {
        [...sat.matchAll(/var\(\s*(--[\w-]+)\s*\)/g)].forEach((m) => {
          if (!tanimli.has(m[1])) eksik.push(`${rel}:${i + 1} → ${m[1]}`);
        });
      });
    });
    expect(eksik).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 7) KANVAS ÇİZİMİ TEMA KÖPRÜSÜNDEN GEÇER
//
// Canvas API `var(--x)` ÇÖZEMEZ: `ctx.fillStyle = 'var(--seri-1)'` sessizce
// hiçbir şey yapmaz (geçersiz renk, önceki değer kalır). Köprü bu yüzden var
// (`veThemeRgba`, js/theme.js) — jetonu okur, `rgba()` döndürür.
//
// ÖLÇÜLEN KUSUR (2026-09-22): 65 `ctx.fillStyle/strokeStyle` ataması köprüyü
// ATLAYIP sabit hex yazıyordu. Hata bir temada görünmez, ötekinde okunmaz:
//
//     #8f3636 (seri kırmızısı)  koyu zeminde 2,45   ✗
//     #a78bfa (seri moru)       beyazda      2,72   ✗
//     #666    (eksen yazısı)    koyu zeminde         ✗
//
// Yani diyagramların yarısı bir kimlikte, yarısı ötekinde kayboluyordu.
describe('kanvas çizimi tema köprüsünden geçer', () => {
  const CIZIM = jsFiles(JS_DIR).filter(({ abs }) =>
    /\.(fillStyle|strokeStyle)\s*=/.test(fs.readFileSync(abs, 'utf8')));

  test('çizim yapan dosyalar bulundu (kapının dayandığı zemin)', () => {
    expect(CIZIM.length).toBeGreaterThan(3);
  });

  test('hiçbir ctx renk ataması SABİT hex yazmıyor', () => {
    const sabit = [];
    CIZIM.forEach(({ rel, abs }) => {
      fs.readFileSync(abs, 'utf8').split('\n').forEach((sat, i) => {
        const m = sat.match(/\.(?:fillStyle|strokeStyle)\s*=\s*['"]#[0-9a-fA-F]{3,8}['"]/g);
        if (m) m.forEach((x) => sabit.push(`${rel}:${i + 1} → ${x.trim()}`));
      });
    });
    expect(sabit).toEqual([]);
  });

  // KÖPRÜ `var()` DİZESİ ALMAZ. Bir gün biri `ctx.fillStyle='var(--x)'`
  // yazarsa hiçbir şey patlamaz — çizim önceki rengiyle sürer.
  test("ctx'e `var(--…)` dizesi verilmiyor", () => {
    const hatali = [];
    CIZIM.forEach(({ rel, abs }) => {
      fs.readFileSync(abs, 'utf8').split('\n').forEach((sat, i) => {
        if (/\.(?:fillStyle|strokeStyle)\s*=\s*['"]var\(/.test(sat)) hatali.push(`${rel}:${i + 1}`);
      });
    });
    expect(hatali).toEqual([]);
  });

  // SERİ PALETİ TEMA BAŞINA TANIMLI ve her biri KENDİ zeminlerinde ≥3:1.
  // Tek bir palet iki kimliğe yetmiyordu — ölçümü yukarıda.
  test('seri paleti iki kimlikte de tanımlı ve okunur', () => {
    const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    const lin = (c) => { const x = c / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
    const lum = (c) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
    const oran = (a, b) => {
      const L1 = lum(hex(a)); const L2 = lum(hex(b));
      return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    };
    const blok = (id) => {
      const re = new RegExp('\\[data-theme="' + id + '"\\][^{]*\\{([^}]*)\\}', 'g');
      for (const m of STYLES.matchAll(re)) if (/--bg-primary\s*:/.test(m[1])) return m[1];
      return '';
    };
    const jet = (b) => {
      const o = {}; let m;
      const re = /--([\w-]+):\s*([^;]+);/g;
      while ((m = re.exec(b)) !== null) o[m[1]] = m[2].trim();
      return o;
    };
    [['acik', ['bg-input', 'bg-secondary', 'bg-primary']],
      ['koyu', ['bg-input', 'bg-secondary', 'bg-primary']]].forEach(([id, zeminler]) => {
      const t = jet(blok(id));
      const dusen = [];
      [1, 2, 3, 4].forEach((n) => {
        const c = t['seri-' + n];
        expect(c).toMatch(/^#[0-9a-f]{6}$/i);
        const en = Math.min(...zeminler.map((z) => oran(c, t[z])));
        if (en < 3) dusen.push(`${id}/--seri-${n}: ${en.toFixed(2)}`);
      });
      expect(dusen).toEqual([]);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 8) DOLU DÜĞMENİN HOVER'I JETONDAN, PARLAKLIK FİLTRESİNDEN DEĞİL
//
// ÖLÇÜLEN KUSUR (2026-09-22): 11 `:hover` kuralı `filter:brightness(...)`
// kullanıyordu. Filtre tema-KÖRDÜR ve iki kimlikte TERS yönde hareket eder:
//
//     açık  #a8502b + brightness(1.1) → beyaz metin 5,46 → 4,67  (AA tabanı 4,5)
//     koyu  #d9763f + brightness(1.1) → koyu metin  5,71 → 6,86
//
// Yani aynı jest açık kimlikte okunurluğu DÜŞÜRÜYOR, koyuda yükseltiyor.
// `--ink-*` jetonları zaten "aksanı metin gücünde kullan" için ölçülmüş
// değerler: açıkta daha koyu, koyuda daha açık — hover her iki kimlikte de
// kontrastı ARTIRAN yöne gidiyor.
describe('hover parlaklık filtresi kullanmıyor', () => {
  test('css/ içinde `filter:brightness` kuralı yok', () => {
    const govde = STYLES.replace(/\/\*[\s\S]*?\*\//g, '');   // yorumlar hariç
    const kalan = [];
    govde.split('\n').forEach((sat, i) => {
      if (/filter\s*:\s*brightness/.test(sat)) kalan.push(`${i + 1}: ${sat.trim().slice(0, 70)}`);
    });
    expect(kalan).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 9) PANEL ALAN BORCU — YALNIZ AŞAĞI İNER
//
// FEAD paneli Atölye alan gramerine geçti (etiket üstte · birim yanında ·
// türetilen oyuk blokta) ve görünümü CSS'e taşındı. Kalan paneller hâlâ
// satır içi `style=` ile alan kuruyor — ve satır içi CSS DURUM İFADE EDEMEZ
// (`:hover`, `:focus`, `:invalid` yazılamaz), yani o paneller donuk.
//
// Bu sayı bir hedef değil BORÇTUR: modül modül iner. Tek başına bir kapı
// değil bir SAYAÇ — ama artmasını engelliyor, ve bu deponun öğrendiği şey
// tam olarak sayılmayan borcun sessizce büyüdüğü.
describe('panel alan borcu yalnız aşağı iner', () => {
  const PANEL = ['cp-engine.js', 'cp-gearbox.js', 'cp-torque-converter.js',
    'cp-drivetrain.js', 'cp-matching.js', 'cp-mount.js', 'cp-accessories.js',
    'cp-solver.js', 'sensors.js', 'solver-pro.js'];
  const TAVAN = 1081;   // ölçüldü 2026-09-22 — TAM sayı, pay YOK (1170 → 1081)

  test('satır içi `style=` sayısı tavanı geçmiyor', () => {
    let n = 0;
    const dagilim = {};
    PANEL.forEach((f) => {
      const p = path.join(JS_DIR, f);
      if (!fs.existsSync(p)) return;
      const k = (fs.readFileSync(p, 'utf8').match(/style="/g) || []).length;
      dagilim[f] = k; n += k;
    });
    // Dağılımı hata mesajına taşı: hangi modülün borcu büyüdü, adıyla görünsün
    expect({ toplam: n, tavan: TAVAN, dagilim: n > TAVAN ? dagilim : undefined })
      .toEqual({ toplam: n, tavan: TAVAN, dagilim: undefined });
    expect(n).toBeLessThanOrEqual(TAVAN);
  });

  test('panel veri tablosu borçtan ÇIKTI — sunum sınıftan', () => {
    // 31 tablo `.ve-pnl-tbl`ye taşındı. Asıl kazanç sayı değil YETENEK:
    // satır içi CSS `:hover` yazamaz, yani "hangi satırdayım" sorusunun
    // cevabı YOKTU. Sayı 1170 → 1081; taşınan 397+48+22 BİLDİRİM, ki
    // yukarıdaki sayaç onu göremez (o `style=` ÖZNİTELİĞİ sayıyor,
    // içindeki bildirimi değil).
    expect(STYLES).toMatch(/\.ve-pnl-tbl tbody tr:hover\{[^}]*background/);
    expect(STYLES).toMatch(/\.ve-pnl-tbl thead th\{[^}]*position:\s*sticky/);
    const kullanan = ['cp-engine.js', 'cp-gearbox.js', 'cp-torque-converter.js',
      'cp-drivetrain.js', 'cp-matching.js', 'cp-mount.js', 'cp-solver.js'];
    let n = 0;
    kullanan.forEach((f) => {
      n += (fs.readFileSync(path.join(JS_DIR, f), 'utf8').match(/ve-pnl-tbl/g) || []).length;
    });
    expect(n).toBeGreaterThanOrEqual(31);
  });

  test('FEAD paneli borçtan ÇIKTI — gramerin referansı', () => {
    const fead = fs.readFileSync(path.join(JS_DIR, 'cp-fead.js'), 'utf8');
    // Alanlar CSS sınıfından: `ve-fp-f` / `ve-fp-l` / `ve-fp-inp`
    expect(fead).toMatch(/class="ve-fp-f"/);
    expect(STYLES).toMatch(/\.ve-fp-f\{[^}]*flex-direction:\s*column/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 10) HER `:hover` GERÇEKTEN BİR ŞEY DEĞİŞTİRİR
//
// 8. bölüm `filter:brightness`in GİTTİĞİNİ ölçüyor — yerine konanın İŞE
// YARADIĞINI değil. Aradaki fark ölçüldü ve sessizdi: `.ve-settings-btn-primary`
// kuralında yeni `background:var(--ink-accent)` bildiriminden SONRA eski
// `background:var(--accent-primary)` duruyordu; art arda yazılan iki bildirimde
// SONUNCUSU kazanır, yani hover dinlenme durumunun aynısını boyuyordu.
// `filter` eskiden bildirim sırasından BAĞIMSIZ çalıştığı için aynı kural
// yıllarca doğru görünmüştü. `.dr-hdr`de de aynı şey oldu: taban zaten
// `--bg-tertiary` idi ve hover ona aynı değeri yazıyordu.
//
// İkisi de testten geçiyordu. Kaldırmayı ölçen bir kapı, yerine konanın ölü
// olmasını göremez — kapı VARIŞI ölçmek zorunda.
//
// NÖTRLEYİCİ bir istisnadır, ölü değildir: `.ve-fp-inp[readonly]:hover` tabanı
// ile aynı değeri yazar ama işi DAHA GENİŞ bir hover'ı (`.ve-fp-inp:hover`)
// iptal etmektir — salt-okunur alan fareye tepki VERMEMELİ. İşareti, nitelik/
// sınıf niteleyicileri soyulunca ortaya çıkan daha genel bir `:hover`
// kuralının aynı özelliği yazıyor olmasıdır.
describe('her :hover gerçekten bir şey değiştirir', () => {
  // Eşleşen süslü parantezle kural tarayıcı; @media/@supports gövdelerine iner
  function kurallariTara(metin) {
    const out = []; let i = 0;
    while (i < metin.length) {
      const ac = metin.indexOf('{', i);
      if (ac < 0) break;
      const sec = metin.slice(i, ac).split(/[;}]/).pop().trim();
      let d = 1, j = ac + 1;
      while (j < metin.length && d > 0) { if (metin[j] === '{') d++; else if (metin[j] === '}') d--; j++; }
      const govde = metin.slice(ac + 1, j - 1);
      if (sec.startsWith('@')) out.push(...kurallariTara(govde));
      else if (sec) out.push({ sec, govde, sat: metin.slice(0, ac).split('\n').length });
      i = j;
    }
    return out;
  }
  // Bir gövdenin KAZANAN bildirimleri — art arda yazılanda sonuncusu kazanır
  function kazananlar(govde) {
    const m = {};
    govde.split(';').forEach((d) => {
      const k = d.indexOf(':');
      if (k < 0) return;
      const ad = d.slice(0, k).trim().toLowerCase();
      if (!ad || !/^[-a-z]+$/.test(ad)) return;
      m[ad] = d.slice(k + 1).trim().replace(/\s+/g, ' ');
    });
    return m;
  }

  test('taban durumunun aynısını boyayan `:hover` kuralı yok', () => {
    const govde = STYLES.replace(/\/\*[\s\S]*?\*\//g, '');
    const kurallar = kurallariTara(govde);

    // Taban: `:hover/:focus/:active` TAŞIMAYAN kuralların birikmiş bildirimleri
    const taban = {};
    kurallar.forEach((r) => {
      if (/:(hover|focus|active)/.test(r.sec)) return;
      r.sec.split(',').forEach((s) => {
        const k = s.trim();
        taban[k] = Object.assign(taban[k] || {}, kazananlar(r.govde));
      });
    });
    // Hover haritası: nötrleyici tespiti için "hangi seçici hangi özelliği yazıyor"
    const hover = {};
    kurallar.forEach((r) => {
      if (!r.sec.includes(':hover')) return;
      r.sec.split(',').forEach((s) => {
        const k = s.trim();
        hover[k] = Object.assign(hover[k] || {}, kazananlar(r.govde));
      });
    });

    const olu = [];
    kurallar.forEach((r) => {
      if (!r.sec.includes(':hover')) return;
      r.sec.split(',').forEach((secim) => {
        const sec = secim.trim();
        if (!sec.includes(':hover')) return;
        const temel = sec.replace(/:hover(\([^)]*\))?/g, '').replace(/:not\([^)]*\)/g, '').trim();
        const t = taban[temel];
        if (!t) return;                       // tabanı olmayan hover'ı ölçemeyiz
        const h = kazananlar(r.govde);
        const adlar = Object.keys(h);
        if (!adlar.length) return;
        // Tabandan FARKLI tek bir bildirim yeter
        if (adlar.some((a) => t[a] === undefined || t[a] !== h[a])) return;
        // NÖTRLEYİCİ Mİ? Niteleyicileri soyunca daha genel bir hover aynı
        // özelliği yazıyorsa bu kural onu iptal etmek için var
        const genel = temel.replace(/\[[^\]]*\]/g, '').trim() + ':hover';
        const g = hover[genel];
        if (g && genel !== sec && adlar.some((a) => g[a] !== undefined)) return;
        olu.push(`${r.sat}: ${sec} → ${adlar.map((a) => `${a}:${h[a]}`).join('; ')}`);
      });
    });

    expect(olu).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 11) PENCERE KABUKLARI JETON KONUŞUR
//
// Kaplamalar ve pencereler yarı yarıya jeton, yarı yarıya sabit değer
// yazıyordu — ve iki taraf AYNI şeyi söylemiyordu:
//
//   perde   `--scrim` = rgba(0,0,0,0.62)  ↔  iki kaplama `rgba(0,0,0,0.6)`
//   gölge   `--shadow-xl` = 0 12px 32px var(--shadow-color)
//                                        ↔  iki pencere `0 24px 70px rgba(0,0,0,.42)`
//   z       `--z-overlay: 300` (yorumu modül kaplamasını ADIYLA sayıyor)
//                                        ↔  `.ve-module-overlay` `z-index:100`
//
// Gölge farkı görünür bir kusurdu: `--shadow-color` TEMA FARKINDADIR (açıkta
// rgba(38,36,31,0.10), koyuda rgba(0,0,0,0.55)); sabit `rgba(0,0,0,.42)` açık
// kimlikte jetonun 4,2 KATI donuk siyah bir leke bırakıyordu. Perde farkı
// gözle ayırt edilmez (0,60 ↔ 0,62) ama jetonu değiştiren bir tur pencerelerin
// YARISINI hareket ettirirdi. z farkı `.ve-split-dropzone` ile aynı sayıya
// oturuyordu — aynı kapta buluşsalar sıra kaynak sırasına kalırdı.
//
// `.ve-chart-legend-overlay` MUAF: `position:absolute` ile bir grafiğin İÇİNDE
// duran künye rozeti, pencere kabuğu değil; z'si o grafiğin yerel yığınına ait.
describe('pencere kabukları jeton konuşur', () => {
  const MUAF = ['.ve-chart-legend-overlay'];
  // Kabuk = kuralın ÖZNESİ bir overlay/modal/panel olan kural.
  //
  // "Adında geçen" YETMEZ ve ölçüldü: `.ve-properties-content .ve-eng-sheet th`
  // yapışkan bir tablo başlığı ve `z-index:1` onun YEREL kaldırması — pencere
  // kabuğunun yığın katmanı değil. Özne, seçicinin SON bileşik parçasıdır;
  // torunlar kapının dışında kalır.
  const KABUK_ADI = /\.[\w-]*(overlay|modal|panel|properties)[\w-]*/i;
  function kabuklar(metin) {
    const out = [];
    const bas = /(?:^|[}\s;])([^{};@]*\{)/g;
    let m;
    while ((m = bas.exec(metin))) {
      const ham = m[1].slice(0, -1).trim();
      if (!ham || ham.startsWith('@')) continue;
      let d = 1, j = bas.lastIndex;
      while (j < metin.length && d > 0) { if (metin[j] === '{') d++; else if (metin[j] === '}') d--; j++; }
      const govde = metin.slice(bas.lastIndex, j - 1);
      // Her seçici dalında ÖZNE (son bileşik) kabuk mu?
      const ozne = ham.split(',').some((dal) => {
        const son = dal.trim().split(/[\s>+~]+/).filter(Boolean).pop() || '';
        return KABUK_ADI.test(son);
      });
      if (ozne) out.push({ sel: ham, govde, sat: metin.slice(0, m.index).split('\n').length });
      bas.lastIndex = j;
    }
    return out;
  }

  test('perde · gölge · z-index sabit değerden değil jetondan gelir', () => {
    const govde = STYLES.replace(/\/\*[\s\S]*?\*\//g, '');
    const kalan = [];
    kabuklar(govde).forEach((r) => {
      if (MUAF.some((m) => r.sel.includes(m))) return;
      r.govde.split(';').forEach((dec) => {
        const k = dec.indexOf(':');
        if (k < 0) return;
        const ad = dec.slice(0, k).trim().toLowerCase();
        const val = dec.slice(k + 1).trim().replace(/\s+/g, ' ');
        if (val.includes('var(')) return;                    // jetondan geliyor
        if (ad === 'background' && /rgba?\(/.test(val)) kalan.push(`${r.sat}: ${r.sel} → perde ${val}`);
        if (ad === 'box-shadow' && /rgba?\(/.test(val)) kalan.push(`${r.sat}: ${r.sel} → gölge ${val}`);
        if (ad === 'z-index' && /^\d+$/.test(val)) kalan.push(`${r.sat}: ${r.sel} → z ${val}`);
      });
    });
    expect(kalan).toEqual([]);
  });

  test('jetonların kendisi duruyor — kapı boşa taranmıyor', () => {
    // Kapı ancak taradığı kabukları GERÇEKTEN bulursa bir şey ifade eder.
    const govde = STYLES.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(kabuklar(govde).length).toBeGreaterThan(20);
    expect(STYLES).toMatch(/--scrim:\s*rgba/);
    expect(STYLES).toMatch(/--shadow-xl:\s*[^;]*var\(--shadow-color\)/);
    expect(STYLES).toMatch(/--z-overlay:\s*\d+/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 12) DISPLAY YÜZÜNE BAĞLI ELEMAN KENDİ TRACKING'İNİ YAZMAZ
//
// Ölçülen kusur: "MFSim" açılış ekranında -0,2px, karşılama ekranında +0,5px
// tracking ile çiziliyordu — aynı yüz, aynı boy, saniyeler arayla.
//
// Sebep KASKAD: display bağlaması (`h1..h4, .mfsim-loading-logo,
// .ve-welcome-logo { font-family:var(--font-display); letter-spacing:-0.01em }`)
// ile elemanın kendi `letter-spacing:0.5px` bildirimi AYNI özgüllükte. İkisinde
// bağlama SONRA geliyordu (bildirim ölüydü), `.ve-welcome-logo` ise bağlamadan
// sonra tanımlı olduğu için KAZANIYORDU. `0.5px` eski SANS markadan kalmaydı.
//
// Yani aynı bildirim, aynı dosyada, üç elemandan ikisinde ölü birinde canlıydı
// ve farkı yalnız SIRA belirliyordu. Kapı sırayı değil KURALI tutar: bağlamaya
// giren bir eleman tracking'ini bağlamadan alır.
//
// Gerçek tarayıcı karşılığı: `tests/e2e/marka-tutarli.spec.js`.
describe('display yüzüne bağlı eleman kendi tracking’ini yazmaz', () => {
  test('bağlama listesindeki hiçbir sınıf letter-spacing bildirmiyor', () => {
    const govde = STYLES.replace(/\/\*[\s\S]*?\*\//g, '');
    // Bağlama kuralını BUL — listesi elle kopyalanmaz, kaynaktan okunur.
    const m = govde.match(/([^{}]*)\{[^{}]*font-family:\s*var\(--font-display\)[^{}]*\}/);
    expect(m).not.toBeNull();
    const bagli = m[1].split(',').map((s) => s.trim()).filter((s) => s.startsWith('.'));
    expect(bagli.length).toBeGreaterThanOrEqual(4);   // liste gerçekten okundu

    const kalan = [];
    const bas = /(?:^|[}\s;])([^{};@]*)\{/g;
    let r;
    while ((r = bas.exec(govde))) {
      const sel = r[1].trim();
      let d = 1, j = bas.lastIndex;
      while (j < govde.length && d > 0) { if (govde[j] === '{') d++; else if (govde[j] === '}') d--; j++; }
      const blok = govde.slice(bas.lastIndex, j - 1);
      bas.lastIndex = j;
      if (!sel || sel.startsWith('@')) continue;
      if (/font-family:\s*var\(--font-display\)/.test(blok)) continue;   // bağlamanın kendisi
      sel.split(',').forEach((dal) => {
        if (!bagli.includes(dal.trim())) return;
        blok.split(';').forEach((dec) => {
          const k = dec.indexOf(':');
          if (k < 0) return;
          if (dec.slice(0, k).trim().toLowerCase() !== 'letter-spacing') return;
          kalan.push(`${govde.slice(0, r.index).split('\n').length}: ${dal.trim()} → ${dec.slice(k + 1).trim()}`);
        });
      });
    }
    expect(kalan).toEqual([]);
  });
});
