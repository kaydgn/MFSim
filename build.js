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

// Yardimci: <script> tag'inin src disindaki attribute'larini koruyarak
// inline ederken kullanir. type="text/x-mfsim-defer" / data-mfsim-label gibi
// attribute'lar monolitik build'de de korunur — loader.js bunlari arar.
function extractAttrs(rawAttrs) {
  if (!rawAttrs) return '';
  var trimmed = rawAttrs.trim();
  return trimmed.length ? ' ' + trimmed : '';
}

// ── 2a) Vendor JS: <script ... src="vendor/..." ...></script> → inline.
// Three.js gibi 3. parti kütüphaneler için ayrı eşleştirme. js/ deseninden ÖNCE
// işlenir; sıralama korunur. Regex src'den onceki/sonraki attribute'lari yakalar.
html = html.replace(
  /<script\b([^>]*?)\s+src="(vendor\/[^"]+)"([^>]*?)\s*>\s*<\/script>/g,
  function(match, beforeAttrs, vendorPath, afterAttrs) {
    var fullPath = path.join(ROOT, vendorPath);
    if (!fs.existsSync(fullPath)) {
      console.error('HATA: Vendor dosyası bulunamadı:', fullPath);
      console.error('  İpucu: "npm run vendor:sync" çalıştırın.');
      process.exit(1);
    }
    var js = fs.readFileSync(fullPath, 'utf8');
    console.log('  Vendor inline:', vendorPath, '(' + js.length + ' karakter)');
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
    var attrs = extractAttrs(beforeAttrs) + extractAttrs(afterAttrs);
    return '<script' + attrs + '>\n' + js + '\n</script>';
  }
);

// ── 2c) Inline-resource placeholder'lari: <!-- INLINE_FILE: path [as kind] -->
// Monolitik HTML'in tek-dosya olmasi gerektigi icin WASM/JS dosyalarini
// HTML icine kaydirmamiz lazim. WASM binary base64, JS metin olarak somutlanir.
//
// Kullanim ornekleri:
//   <!-- INLINE_FILE: vendor/opencascade/occt-import-js.js as occtScript -->
//   <!-- INLINE_FILE: vendor/opencascade/occt-import-js.wasm as occtWasm -->
//
// Dev modunda (index.html'de) placeholder'lar HTML icinde durur; tarayici
// onlari yorum olarak gorur, fea-step.js dosyalardan dinamik yukler.
// Build sirasinda placeholder yerine window.__feaInline[kind] = <icerik>
// atayan bir <script> blogu konur.
html = html.replace(
  /<!--\s*INLINE_FILE:\s*([^\s]+)\s+as\s+(\w+)\s*-->/g,
  function(match, filePath, kind) {
    var fullPath = path.join(ROOT, filePath);
    if (!fs.existsSync(fullPath)) {
      // Doğru build komutunu öner (vendor:sync paketleri ve wasm modülleri ayrı)
      var hint;
      if (filePath.indexOf('vendor/tetgen/') === 0) {
        hint = '"npm run build:wasm:tetgen" calistirin (emscripten gerekli, AGPL-3.0); ' +
               'build edilmezse TetGen atlanir, Delaunay/voxel devreye girer';
      } else if (filePath.indexOf('vendor/mfsim-fea/') === 0) {
        hint = '"npm run build:wasm" calistirin (emscripten gerekli)';
      } else {
        hint = '"npm run vendor:sync" calistirin';
      }
      console.warn('  Inline atlandi (kaynak yok): ' + filePath + ' — ' + hint + '.');
      return '<!-- INLINE_FILE skipped: ' + filePath + ' -->';
    }
    var isBinary = /\.(wasm|bin)$/i.test(filePath);
    var content = fs.readFileSync(fullPath);
    var script;
    if (isBinary) {
      var b64 = content.toString('base64');
      script = '<script>(window.__feaInline=window.__feaInline||{}).' + kind +
               '=' + JSON.stringify(b64) + ';</script>';
      console.log('  Inline (base64):', filePath, '(' + (b64.length / 1024).toFixed(0) + ' KB)');
    } else {
      var text = content.toString('utf8');
      script = '<script>(window.__feaInline=window.__feaInline||{}).' + kind +
               '=' + JSON.stringify(text) + ';</script>';
      console.log('  Inline (text):', filePath, '(' + (text.length / 1024).toFixed(0) + ' KB)');
    }
    return script;
  }
);

// ── 3) Yaz
fs.writeFileSync(OUTPUT, html, 'utf8');

var stats = fs.statSync(OUTPUT);
var lines = html.split('\n').length;
console.log('\n✓ MFSim_Code.html oluşturuldu (' + lines + ' satır, ' + (stats.size / 1024).toFixed(0) + ' KB)');
