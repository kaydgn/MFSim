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

  test('açılır liste SABİT piksel değil — taban + esneme + tavan', () => {
    // Sabit genişlik seçeneğin metnini kırpıyordu (ölçüldü: 169 px gerek /
    // 120 px alan). Kural DEĞİŞMEDİ, yalnız YERİ değişti: eskiden `_FEAD_SEL`
    // adlı satır içi stil dizesindeydi, artık panel dilinin CSS'inde —
    // çünkü satır içi stil `:hover`/`:focus` yazamıyordu (P5).
    const blok = (/\.ve-fp-f--sel\{([^}]*)\}/.exec(css) || [, ''])[1];
    expect(blok).toMatch(/grid-template-columns/);
    // minmax(TABAN, TAVAN): taban hizayı korur, tavan etiketi ezmesini engeller,
    // aradaki esneme seçeneğe göre büyümesini sağlar.
    const mm = /minmax\(\s*(\d+)px\s*,\s*(\d+)%\s*\)/.exec(blok);
    expect(mm).not.toBeNull();
    expect(+mm[1]).toBeGreaterThanOrEqual(120);   // taban: en uzun seçenek 169 px
    expect(+mm[2]).toBeLessThanOrEqual(70);       // tavan: etiket ezilmesin
    // Ve hiçbir açılır liste artık satır içi genişliğe dönmemeli.
    expect(src).not.toMatch(/<select[^>]*style="width:\d+px/);
    expect(src).not.toMatch(/_FEAD_SEL|_FEAD_INP/);
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

  test('ETİKET ile GİRİŞ artık aynı hizada — P3', () => {
    // Ölçülen kusur: `_feadGrid` etiketi `text-align:center`, `_FEAD_INP` ise
    // `text-align:right` yazıyordu. Etiket sayının üstünde ortalanıyor, değer
    // sağa yapışıyordu. Artık etiket SOLDA, değer SAĞDA, aynı satırda.
    expect(src).not.toMatch(/text-align:center[^']*'\s*\+\s*c\.label/);
    const f = (/\.ve-fp-f\{([^}]*)\}/.exec(css) || [, ''])[1];
    expect(f).toMatch(/grid-template-columns/);   // etiket | değer, tek satır
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
