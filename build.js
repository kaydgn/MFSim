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
html = html.replace(
  /<link\s+rel="stylesheet"\s+href="(css\/[^"]+)"\s*\/?>/g,
  function(match, cssPath) {
    var fullPath = path.join(ROOT, cssPath);
    if (!fs.existsSync(fullPath)) {
      console.error('HATA: CSS dosyası bulunamadı:', fullPath);
      process.exit(1);
    }
    var css = fs.readFileSync(fullPath, 'utf8');
    console.log('  CSS inline:', cssPath, '(' + css.length + ' karakter)');
    return '<style>\n' + css + '\n</style>';
  }
);

// ── 2a) Vendor JS: <script src="vendor/..."></script> → <script>içerik</script>
// Three.js gibi 3. parti kütüphaneler için ayrı eşleştirme. js/ deseninden ÖNCE
// işlenir; sıralama korunur.
html = html.replace(
  /<script\s+src="(vendor\/[^"]+)"\s*><\/script>/g,
  function(match, vendorPath) {
    var fullPath = path.join(ROOT, vendorPath);
    if (!fs.existsSync(fullPath)) {
      console.error('HATA: Vendor dosyası bulunamadı:', fullPath);
      console.error('  İpucu: "npm run vendor:sync" çalıştırın.');
      process.exit(1);
    }
    var js = fs.readFileSync(fullPath, 'utf8');
    console.log('  Vendor inline:', vendorPath, '(' + js.length + ' karakter)');
    return '<script>\n' + js + '\n</script>';
  }
);

// ── 2b) JS: <script src="js/..."></script> → <script>içerik</script>
html = html.replace(
  /<script\s+src="(js\/[^"]+)"\s*><\/script>/g,
  function(match, jsPath) {
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
    return '<script>\n' + js + '\n</script>';
  }
);

// ── 3) Yaz
fs.writeFileSync(OUTPUT, html, 'utf8');

var stats = fs.statSync(OUTPUT);
var lines = html.split('\n').length;
console.log('\n✓ MFSim_Code.html oluşturuldu (' + lines + ' satır, ' + (stats.size / 1024).toFixed(0) + ' KB)');
