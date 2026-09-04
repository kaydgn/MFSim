#!/usr/bin/env node
/**
 * CAN Çözümleyici — Build
 *
 * candbc/index.html + ../css/*.css + candbc/js/*.js
 *   → MFSim_CAN_Cozumleyici.html   (depo kökünde, tek dosya)
 *
 * Kullanım: npm run build:can
 *
 * viewer/build.js ile aynı mantık ve aynı kapılar. Ayrı bir dosya olmasının
 * sebebi tek: kaynak klasörü ve çıktı adı farklı. Kapılar (syntax denetimi,
 * gömülmemiş kaynak taraması, script bloğu doğrulaması) aynı ortak modülden
 * (build-shield.js) geliyor, kopyalanmıyor.
 *
 * Çıktı file:// üzerinde çalışır: fetch / Worker / dinamik import kullanan
 * hiçbir modül yok. Dosya çift tıklanınca açılır ve SIFIR ağ isteği yapar.
 */

var fs = require('fs');
var path = require('path');
var vm = require('vm');
var SHIELD = require('../build-shield.js');

var DIR = __dirname;
var ROOT = path.join(DIR, '..');
var INDEX = path.join(DIR, 'index.html');
// Çıktı yolu ezilebilir — gerekçe viewer/build.js'teki ile aynı.
var OUTPUT = process.env.MFSIM_BUILD_OUT || path.join(ROOT, 'MFSim_CAN_Cozumleyici.html');

// ── 0) Syntax kontrolü: bozuk bir modül tek dosyaya gömülmesin ────────────
var jsDir = path.join(DIR, 'js');
var jsFiles = fs.readdirSync(jsDir).filter(function(f) { return f.endsWith('.js'); });
var syntaxErrors = [];

jsFiles.forEach(function(file) {
  var code = fs.readFileSync(path.join(jsDir, file), 'utf8');
  try {
    new vm.Script(code, { filename: file });
  } catch(e) {
    syntaxErrors.push({ file: 'candbc/js/' + file, error: e.message });
  }
});

if(syntaxErrors.length > 0) {
  console.error('\n✗ Syntax hatası bulundu! Build iptal edildi.\n');
  syntaxErrors.forEach(function(err) { console.error('  ' + err.file + ': ' + err.error); });
  console.error('');
  process.exit(1);
}
console.log('  Syntax kontrolü: ' + jsFiles.length + ' JS dosyası OK');

var html = fs.readFileSync(INDEX, 'utf8');

// ── 1) CSS inline ─────────────────────────────────────────────────────────
html = html.replace(
  /<link\s+rel="stylesheet"\s+href="(\.\.\/css\/[^"]+)"\s*\/?>/g,
  function(match, cssPath) {
    var fullPath = path.join(DIR, cssPath);
    if(!fs.existsSync(fullPath)) {
      console.error('HATA: CSS dosyası bulunamadı:', fullPath);
      process.exit(1);
    }
    var css = fs.readFileSync(fullPath, 'utf8');
    console.log('  CSS inline:', cssPath, '(' + css.length + ' karakter)');
    var sc = SHIELD.shieldStyleEnd(css);
    if(sc.escaped) console.log('    ↳ kalkan: ' + cssPath + ' içinde ' + sc.escaped + ' adet ham "</style" kaçırıldı');
    return '<style>\n' + sc.code + '\n</style>';
  }
);

// ── 2) JS inline ──────────────────────────────────────────────────────────
var inlined = 0;
html = html.replace(
  /<script\s+src="(js\/[^"]+)"\s*>\s*<\/script>/g,
  function(match, jsPath) {
    var fullPath = path.join(DIR, jsPath);
    if(!fs.existsSync(fullPath)) {
      console.error('HATA: JS dosyası bulunamadı:', fullPath);
      process.exit(1);
    }
    var js = fs.readFileSync(fullPath, 'utf8');
    console.log('  JS inline:', jsPath, '(' + js.length + ' karakter)');
    inlined++;
    // Gömme kalkanı — bkz. build-shield.js. Dosya git'e DÂHİL ve kullanıcı
    // bunu indiriyor; erken kapanan bir script bloğu doğrudan üründe patlar.
    try {
      var r = SHIELD.shieldScriptEnd(js, 'candbc/' + jsPath);
      if(r.escaped) console.log('    ↳ kalkan: ' + jsPath + ' içinde ' + r.escaped + ' adet ham "</script" kaçırıldı');
      js = r.code;
    } catch(e) {
      console.error('\n✗ ' + e.message + '\n');
      process.exit(1);
    }
    return '<script>\n' + js + '\n</script>';
  }
);

// Sessiz eksik gömme çalışmayan bir dosya üretir: sayıyı DOĞRULA.
if(inlined !== jsFiles.length) {
  console.error('\n✗ candbc/js altında ' + jsFiles.length + ' dosya var ama ' + inlined +
                ' tanesi gömüldü.\n  index.html\'deki <script src="js/..."> listesi eksik ya da fazla.\n');
  process.exit(1);
}

// Gömülmemiş bir kaynak kaldıysa çıktı file:// üzerinde 404 verir ve program
// sessizce yarım açılır. Tek dosya olarak dağıtıldığı için izinli dış kaynak YOK.
var kalan = SHIELD.leftoverRefs(html, []);
if(kalan.attrs.length || kalan.cssUrls.length) {
  console.error('\n✗ Gömülmemiş kaynak kaldı — indirilen dosyada 404 verir:');
  kalan.attrs.forEach(function(v) { console.error('    öznitelik: ' + v); });
  kalan.cssUrls.forEach(function(v) { console.error('    CSS url(): ' + v); });
  console.error('');
  process.exit(1);
}

// Yapısal doğrulama: erken kapanan bir script bloğu, indirilen tek dosyayı
// ham kod dökülen ve tıklanamayan bir sayfaya çevirir.
var srcDoc = SHIELD.scanDocument(fs.readFileSync(INDEX, 'utf8'));
var intendedScripts = srcDoc.scripts;
var intendedStyles = srcDoc.styles +
  (fs.readFileSync(INDEX, 'utf8').match(/<link\s+rel="stylesheet"\s+href="\.\.\/css\//g) || []).length;
var blockError = SHIELD.verifyScriptBlocks(html, intendedScripts, intendedStyles);
if(blockError) {
  console.error('\n✗ ' + blockError + '\n');
  process.exit(1);
}
console.log('  Yapısal doğrulama: ' + intendedScripts + ' script + ' + intendedStyles +
  ' style bloğu, hepsi kendi yerinde kapanıyor');

// ── 3) Yaz ────────────────────────────────────────────────────────────────
fs.writeFileSync(OUTPUT, html, 'utf8');

var stats = fs.statSync(OUTPUT);
console.log('\n✓ MFSim_CAN_Cozumleyici.html oluşturuldu (' +
            html.split('\n').length + ' satır, ' + (stats.size / 1024).toFixed(0) + ' KB)');
