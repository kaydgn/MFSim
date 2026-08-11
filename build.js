#!/usr/bin/env node
/**
 * MFSim Build Script
 *
 * index.html + css/styles.css + js/*.js → MFSim_Code.html
 *
 * Modüler dosyaları okuyup tek bir monolitik HTML dosyası üretir.
 * Kullanım: node build.js
 */

var fs = require('fs');
var path = require('path');
var vm = require('vm');
var SHIELD = require('./build-shield.js');

var ROOT = __dirname;
var INDEX = path.join(ROOT, 'index.html');
var OUTPUT = path.join(ROOT, 'MFSim_Code.html');

// ── 0) Syntax kontrolü: tüm JS dosyalarını derle, hata varsa dur
var jsDir = path.join(ROOT, 'js');
var jsFiles = fs.readdirSync(jsDir).filter(function(f) { return f.endsWith('.js'); });
var syntaxErrors = [];

jsFiles.forEach(function(file) {
  var fullPath = path.join(jsDir, file);
  var code = fs.readFileSync(fullPath, 'utf8');
  try {
    new vm.Script(code, { filename: file });
  } catch(e) {
    syntaxErrors.push({ file: 'js/' + file, error: e.message });
  }
});

if (syntaxErrors.length > 0) {
  console.error('\n✗ Syntax hatası bulundu! Build iptal edildi.\n');
  syntaxErrors.forEach(function(err) {
    console.error('  ' + err.file + ': ' + err.error);
  });
  console.error('');
  process.exit(1);
}
console.log('  Syntax kontrolü: ' + jsFiles.length + ' JS dosyası OK');

// index.html oku
var html = fs.readFileSync(INDEX, 'utf8');

// ── 1) CSS: <link rel="stylesheet" href="css/..."> → <style>içerik</style>
// css/ ve vendor/ altindaki stylesheet'ler inline edilir. vendor/ dahil olmali:
// deploy yalnizca MFSim_Code.html'i yayinliyor (bkz. .github/workflows/ci-deploy.yml),
// vendor/ klasoru _site'a kopyalanmiyor → inline edilmeyen vendor CSS 404 olurdu.
html = html.replace(
  /<link\s+rel="stylesheet"\s+href="((?:css|vendor)\/[^"]+)"\s*\/?>/g,
  function(match, cssPath) {
    var fullPath = path.join(ROOT, cssPath);
    if (!fs.existsSync(fullPath)) {
      console.error('HATA: CSS dosyası bulunamadı:', fullPath);
      process.exit(1);
    }
    var css = fs.readFileSync(fullPath, 'utf8');
    console.log('  CSS inline:', cssPath, '(' + css.length + ' karakter)');
    // <style> bloğu da ham metin kipindedir: CSS içindeki "</style" bloğu erken
    // kapatır ve stilin kalanı sayfaya METİN olarak dökülür (script'teki tuzağın
    // aynısı). Bugün hiçbir CSS'te yok; kalkan yarınki için.
    var sc = SHIELD.shieldStyleEnd(css);
    if (sc.escaped) console.log('    ↳ kalkan: ' + cssPath + ' içinde ' + sc.escaped + ' adet ham "</style" kaçırıldı');
    return '<style>\n' + sc.code + '\n</style>';
  }
);

// Yardimci: <script> tag'inin src disindaki attribute'larini koruyarak
// inline ederken kullanir. type="text/x-mfsim-defer" / data-mfsim-label gibi
// attribute'lar monolitik build'de de korunur — loader.js bunlari arar.
function extractAttrs(rawAttrs) {
  if (!rawAttrs) return '';
  var trimmed = rawAttrs.trim();
  return trimmed.length ? ' ' + trimmed : '';
}

// ── Gömme kalkanı ─────────────────────────────────────────────────────────
// Mantık build-shield.js'te; viewer/build.js ve tests/unit/build-shield.test.js
// AYNI modülü kullanır. Gerekçesi ve "neden güvenli" tartışması orada.
function shield(js, label) {
  try {
    var r = SHIELD.shieldScriptEnd(js, label);
    if (r.escaped) {
      console.log('    ↳ kalkan: ' + label + ' içinde ' + r.escaped +
        ' adet ham "</script" kaçırıldı');
    }
    return r.code;
  } catch (e) {
    console.error('\n✗ ' + e.message + '\n');
    process.exit(1);
  }
}

// ── 2a) Vendor JS: <script ... src="vendor/..." ...></script> → inline.
// Three.js (Takoz 3D görüntüleyici için) gibi 3. parti kütüphaneler. js/
// deseninden ÖNCE işlenir; sıralama korunur.
html = html.replace(
  /<script\b([^>]*?)\s+src="(vendor\/[^"]+)"([^>]*?)\s*>\s*<\/script>/g,
  function(match, beforeAttrs, vendorPath, afterAttrs) {
    var fullPath = path.join(ROOT, vendorPath);
    if (!fs.existsSync(fullPath)) {
      console.error('HATA: Vendor dosyası bulunamadı:', fullPath);
      process.exit(1);
    }
    var js = fs.readFileSync(fullPath, 'utf8');
    console.log('  Vendor inline:', vendorPath, '(' + js.length + ' karakter)');
    js = shield(js, vendorPath);
    var attrs = extractAttrs(beforeAttrs) + extractAttrs(afterAttrs);
    return '<script' + attrs + '>\n' + js + '\n</script>';
  }
);

// ── 2b) JS: <script ... src="js/..." ...></script> → inline.
html = html.replace(
  /<script\b([^>]*?)\s+src="(js\/[^"]+)"([^>]*?)\s*>\s*<\/script>/g,
  function(match, beforeAttrs, jsPath, afterAttrs) {
    var fullPath = path.join(ROOT, jsPath);
    if (!fs.existsSync(fullPath)) {
      console.error('HATA: JS dosyası bulunamadı:', fullPath);
      process.exit(1);
    }
    var js = fs.readFileSync(fullPath, 'utf8');
    // Workflow run ID'sini deploy-status.js'e göm (GITHUB_RUN_ID env var)
    if (jsPath === 'js/deploy-status.js' && process.env.GITHUB_RUN_ID) {
      js = js.replace('__DEPLOY_RUN_ID__', process.env.GITHUB_RUN_ID);
    }
    console.log('  JS inline:', jsPath, '(' + js.length + ' karakter)');
    js = shield(js, jsPath);
    var attrs = extractAttrs(beforeAttrs) + extractAttrs(afterAttrs);
    return '<script' + attrs + '>\n' + js + '\n</script>';
  }
);

// ── 2c) Örnek topolojileri (assets/examples/*.json) tek dosyaya göm.
// Tarayıcı fetch'i file:// üzerinde engellenir; gömme sayesinde indirilmiş
// tek dosyada da örnekler çalışır. Geliştirmede (index.html) bu betik yok →
// çalışma zamanı fetch'e düşer. Enjeksiyon: <body> hemen ardına script.
var examplesDir = path.join(ROOT, 'assets', 'examples');
var embedded = {};
if (fs.existsSync(examplesDir)) {
  fs.readdirSync(examplesDir).filter(function(f) { return f.endsWith('.json'); }).forEach(function(f) {
    var rel = 'assets/examples/' + f;
    try {
      embedded[rel] = JSON.parse(fs.readFileSync(path.join(examplesDir, f), 'utf8'));
      console.log('  Örnek topoloji göm:', rel);
    } catch(e) {
      console.error('HATA: Geçersiz JSON:', rel, '—', e.message);
      process.exit(1);
    }
  });
}
// '<' → <: JSON içindeki olası "</script>" script tag'ini kırmasın.
var embedScript = '<script>window.__MNT_TOPOLOGIES = ' + JSON.stringify(embedded).replace(/</g, '\\u003c') + ';</script>';
// FONKSİYON replacer ŞART: String.replace'in İKİNCİ argümanı dizge olursa
// içindeki '$1'..'$9', '$&', "$'", '$`' ve '$$' ÖZEL DİZİ sayılıp genişletilir.
// Örnek topolojilerinde '$' geçen herhangi bir metin (customName, not metni,
// takoz adı) sessizce bozulurdu — ölçüldü: "Motor $1 Takoz" → "Motor  class=…
// Takoz", "A$&B" → "A<body …>B", "C$$D" → "C$D". Fonksiyon replacer'da bu
// genişletme HİÇ yapılmaz; dönen dizge olduğu gibi konur.
html = html.replace(/<body([^>]*)>/, function (m, attrs) {
  return '<body' + attrs + '>\n' + embedScript;
});

// ── 2d) YAPISAL DOĞRULAMA: üretilen dosyada script blokları erken kapanmasın
//
// Kalkan (shieldScriptEnd) girdi tarafını koruyor; bu adım ÇIKTI tarafını
// ölçüyor — kaçış bir şekilde atlanırsa build burada durur, bozuk dosya
// yayınlanmaz. Ölçüt: tarayıcının GÖRECEĞİ <script> eleman sayısı, bizim
// KASTEN yazdığımız sayıya eşit olmalı. Erken kapanan tek bir blok bile bu
// sayıyı kaydırır (index.html'in kendi script'leri + gömülen topoloji betiği).
//
// KASTEDİLEN sayı kaynağın kendisinden okunur: index.html'deki script elemanları
// + gömülen topoloji betiği (1). Aynı sayaç iki tarafta da kullanılır, yoksa
// kıyas elmayla armut olur.
var indexDoc = SHIELD.scanDocument(fs.readFileSync(INDEX, 'utf8'));
var intendedScripts = indexDoc.scripts + 1;   // + gömülen topoloji betiği
// index.html'deki <style> blokları + inline edilen her stylesheet
var intendedStyles = indexDoc.styles +
  (fs.readFileSync(INDEX, 'utf8').match(/<link\s+rel="stylesheet"\s+href="(?:css|vendor)\//g) || []).length;
var blockError = SHIELD.verifyScriptBlocks(html, intendedScripts, intendedStyles);
if (blockError) {
  console.error('\n✗ ' + blockError + '\n');
  process.exit(1);
}
console.log('  Yapısal doğrulama: ' + intendedScripts + ' script + ' + intendedStyles +
  ' style bloğu, hepsi kendi yerinde kapanıyor');

// ── 2e) GÖMÜLMEMİŞ KAYNAK KALDI MI ────────────────────────────────────────
// Deploy _site'a YALNIZCA index.html (=MFSim_Code.html), pwa/ ve assets/
// kopyalar (bkz. .github/workflows/ci-deploy.yml). Bunların dışında kalan
// göreli her başvuru Pages'te 404 verir ve program sessizce yarım açılır.
var IZINLI_DIS_KAYNAK = [
  'pwa/manifest.json',   // _site/pwa/manifest.json olarak kopyalanır
  'pwa/icon.svg'         // _site/pwa/icon.svg
];
var kalan = SHIELD.leftoverRefs(html, IZINLI_DIS_KAYNAK);
if (kalan.attrs.length || kalan.cssUrls.length) {
  console.error('\n✗ Gömülmemiş kaynak kaldı — yayında 404 verir:');
  kalan.attrs.forEach(function (v) { console.error('    öznitelik: ' + v); });
  kalan.cssUrls.forEach(function (v) { console.error('    CSS url(): ' + v); });
  console.error('  Ya tek dosyaya gömün ya da deploy adımında _site\'a kopyalayıp');
  console.error('  build.js\'teki IZINLI_DIS_KAYNAK listesine ekleyin.\n');
  process.exit(1);
}
console.log('  Kaynak bütünlüğü: gömülmemiş başvuru yok (izinli ' +
  IZINLI_DIS_KAYNAK.length + ' dış dosya)');

// ── 3) Yaz
fs.writeFileSync(OUTPUT, html, 'utf8');

var stats = fs.statSync(OUTPUT);
var lines = html.split('\n').length;
console.log('\n✓ MFSim_Code.html oluşturuldu (' + lines + ' satır, ' + (stats.size / 1024).toFixed(0) + ' KB)');
