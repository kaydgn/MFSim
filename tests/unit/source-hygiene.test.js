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

