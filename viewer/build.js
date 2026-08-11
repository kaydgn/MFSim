#!/usr/bin/env node
/**
 * MFSim Ölçüm Görüntüleyici — Build
 *
 * viewer/index.html + ../css/*.css + viewer/js/*.js
 *   → MFSim_Olcum_Goruntuleyici.html   (depo kökünde, tek dosya)
 *
 * Kullanım: npm run build:viewer
 *
 * Kök build.js ile aynı mantık, üç farkla:
 *   • CSS depo kökünden okunur (../css) — görüntüleyici stilleri MFSim ile
 *     paylaşıyor, kopyalamıyor.
 *   • Örnek topoloji gömme yok — görüntüleyicide topoloji kavramı yok.
 *   • Loader/defer yok: script'ler düz <script> olarak gömülür ve sırayla
 *     çalışır. Splash ekranı ve giriş kapısı bilerek dışarıda.
 *
 * Çıktı file:// üzerinde çalışır: fetch / Worker / dinamik import kullanan
 * hiçbir modül yok, xlsx çözümü saf JS. Dosya çift tıklanınca açılır.
 */

var fs = require('fs');
var path = require('path');
var vm = require('vm');
var SHIELD = require('../build-shield.js');

var VIEWER = __dirname;
var ROOT = path.join(VIEWER, '..');
var INDEX = path.join(VIEWER, 'index.html');
var OUTPUT = path.join(ROOT, 'MFSim_Olcum_Goruntuleyici.html');

// ── 0) Syntax kontrolü: bozuk bir modül tek dosyaya gömülmesin ────────────
// Kök build.js'teki kapının aynısı. Görüntüleyicinin kendi js/ klasörü
// taranır; MFSim'in js/ klasörü kök build'in sorumluluğunda.
var jsDir = path.join(VIEWER, 'js');
var jsFiles = fs.readdirSync(jsDir).filter(function(f) { return f.endsWith('.js'); });
var syntaxErrors = [];

jsFiles.forEach(function(file) {
  var code = fs.readFileSync(path.join(jsDir, file), 'utf8');
  try {
    new vm.Script(code, { filename: file });
  } catch(e) {
    syntaxErrors.push({ file: 'viewer/js/' + file, error: e.message });
  }
});

if(syntaxErrors.length > 0) {
  console.error('\n✗ Syntax hatası bulundu! Build iptal edildi.\n');
  syntaxErrors.forEach(function(err) {
    console.error('  ' + err.file + ': ' + err.error);
  });
  console.error('');
  process.exit(1);
}
console.log('  Syntax kontrolü: ' + jsFiles.length + ' JS dosyası OK');

var html = fs.readFileSync(INDEX, 'utf8');

// ── 1) CSS inline ─────────────────────────────────────────────────────────
// href="../css/..." → <style>. Yol viewer/ klasörüne göre çözülür.
html = html.replace(
  /<link\s+rel="stylesheet"\s+href="(\.\.\/css\/[^"]+)"\s*\/?>/g,
  function(match, cssPath) {
    var fullPath = path.join(VIEWER, cssPath);
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
// Sıra index.html'deki sırayla korunur (replace soldan sağa ilerler).
var inlined = 0;
html = html.replace(
  /<script\s+src="(js\/[^"]+)"\s*>\s*<\/script>/g,
  function(match, jsPath) {
    var fullPath = path.join(VIEWER, jsPath);
    if(!fs.existsSync(fullPath)) {
      console.error('HATA: JS dosyası bulunamadı:', fullPath);
      process.exit(1);
    }
    var js = fs.readFileSync(fullPath, 'utf8');
    console.log('  JS inline:', jsPath, '(' + js.length + ' karakter)');
    inlined++;
    // Gömme kalkanı — bkz. build-shield.js. Görüntüleyici git'e DAHİL ve
    // kullanıcılar bu tek dosyayı indiriyor; erken kapanan bir script bloğu
    // doğrudan indirilen üründe patlar.
    try {
      var r = SHIELD.shieldScriptEnd(js, 'viewer/' + jsPath);
      if(r.escaped) console.log('    ↳ kalkan: ' + jsPath + ' içinde ' + r.escaped + ' adet ham "</script" kaçırıldı');
      js = r.code;
    } catch(e) {
      console.error('\n✗ ' + e.message + '\n');
      process.exit(1);
    }
    return '<script>\n' + js + '\n</script>';
  }
);

// Sessiz eksik gömme, çalışmayan bir dosya üretir: sayıyı DOĞRULA.
if(inlined !== jsFiles.length) {
  console.error('\n✗ viewer/js altında ' + jsFiles.length + ' dosya var ama ' + inlined +
                ' tanesi gömüldü.\n  index.html\'deki <script src="js/..."> listesi eksik ya da fazla.\n');
  process.exit(1);
}

// Gömülmemiş bir kaynak kaldıysa çıktı file:// üzerinde 404 verir ve program
// sessizce yarım açılır. Kalan her src/href bir hatadır.
var leftovers = html.match(/(?:src|href)="(?!data:|#|https?:)[^"]+\.(?:js|css)"/g);
if(leftovers) {
  console.error('\n✗ Gömülmemiş kaynak kaldı:', leftovers.join(', '), '\n');
  process.exit(1);
}

// Yapısal doğrulama: erken kapanan bir script bloğu, indirilen tek dosyayı
// ham kod dökülen ve tıklanamayan bir sayfaya çevirir (bkz. build-shield.js).
// Kalkan girdi tarafını koruyor; bu adım çıktıyı ölçüyor.
var viewerDoc = SHIELD.scanDocument(fs.readFileSync(INDEX, 'utf8'));
var intendedScripts = viewerDoc.scripts;
var intendedStyles = viewerDoc.styles +
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
console.log('\n✓ MFSim_Olcum_Goruntuleyici.html oluşturuldu (' +
            html.split('\n').length + ' satır, ' + (stats.size / 1024).toFixed(0) + ' KB)');
