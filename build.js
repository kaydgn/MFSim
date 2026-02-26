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

var ROOT = __dirname;
var INDEX = path.join(ROOT, 'index.html');
var OUTPUT = path.join(ROOT, 'MFSim_Code.html');

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

// ── 2) JS: <script src="js/..."></script> → <script>içerik</script>
html = html.replace(
  /<script\s+src="(js\/[^"]+)"\s*><\/script>/g,
  function(match, jsPath) {
    var fullPath = path.join(ROOT, jsPath);
    if (!fs.existsSync(fullPath)) {
      console.error('HATA: JS dosyası bulunamadı:', fullPath);
      process.exit(1);
    }
    var js = fs.readFileSync(fullPath, 'utf8');
    console.log('  JS inline:', jsPath, '(' + js.length + ' karakter)');
    return '<script>\n' + js + '\n</script>';
  }
);

// ── 3) Yaz
fs.writeFileSync(OUTPUT, html, 'utf8');

var stats = fs.statSync(OUTPUT);
var lines = html.split('\n').length;
console.log('\n✓ MFSim_Code.html oluşturuldu (' + lines + ' satır, ' + (stats.size / 1024).toFixed(0) + ' KB)');
