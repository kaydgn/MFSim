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
