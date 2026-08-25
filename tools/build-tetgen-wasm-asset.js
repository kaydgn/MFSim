#!/usr/bin/env node
/**
 * build-tetgen-wasm-asset.js — TetGen ağ üreticisinin .wasm'ını UYGULAMAYA GÖMER
 *
 *   vendor/tetgen-wasm.wasm  →  js/structural-tetgen-wasm.js
 *
 * build-occt-wasm-asset.js ile AYNI kalıp, aynı gerekçe (bkz. o dosyanın
 * başlığı ve CLAUDE.md): MFSim tek dosya olarak indirilip kullanılıyor,
 * yanında vendor/ olmayan bir kurulumda ağ üreteci hiç çalışmazdı; ilerleme
 * göstergesi de PARÇANIN işlendiğini söylemeli, kütüphanenin indiğini değil.
 *
 * gzip -9 + base64. vendor/tetgen-wasm.wasm zaten occt'ninkinden çok küçük
 * (~737 KB ham — OCCT'nin 7.6 MB'ının onda biri, TetGen odaklı ve küçük bir
 * kütüphane), gömme maliyeti orantılı olarak da küçük kalıyor.
 *
 * Kullanım: node tools/build-tetgen-wasm-asset.js
 */
var fs = require('fs');
var path = require('path');
var zlib = require('zlib');

var ROOT = path.join(__dirname, '..');
var SRC = path.join(ROOT, 'vendor', 'tetgen-wasm.wasm');
var OUT = path.join(ROOT, 'js', 'structural-tetgen-wasm.js');

if (!fs.existsSync(SRC)) {
  console.error('HATA: ' + SRC + ' bulunamadı. Önce: node tools/build-tetgen-wasm.js');
  process.exit(1);
}

var raw = fs.readFileSync(SRC);

// WASM imzası: 0x00 61 73 6D ("\0asm"). Yanlış bir dosya gömülürse tarayıcıda
// ancak ilk ağ oluşturmada, anlaşılmaz bir hatayla ortaya çıkardı.
if (!(raw[0] === 0x00 && raw[1] === 0x61 && raw[2] === 0x73 && raw[3] === 0x6d)) {
  console.error('HATA: ' + SRC + ' bir WebAssembly ikilisi değil (imza tutmuyor).');
  process.exit(1);
}

var gz = zlib.gzipSync(raw, { level: 9 });
var b64 = gz.toString('base64');

var out =
'// ============================================================================\n' +
'//  TETGEN AĞ ÜRETECİ — GÖMÜLÜ .wasm\n' +
'// ============================================================================\n' +
'// ÜRETİLEN DOSYA — ELLE DÜZENLENMEZ.\n' +
'//   kaynak : vendor/tetgen-wasm.wasm  (vendor/tetgen-src/ + tools/tetgen-wasm-src/\n' +
'//            derlenerek üretildi — bkz. tools/build-tetgen-wasm.js)\n' +
'//   üretim : npm run build:tetgen-wasm-asset\n' +
'//\n' +
'// gzip -9 + base64. Ham base64 ' + (Math.round(raw.length * 4 / 3 / 1048576 * 100) / 100) + ' MB olurdu;\n' +
'// sıkıştırılmış hâli ' + (Math.round(b64.length / 1048576 * 100) / 100) + ' MB. Tarayıcıda DecompressionStream\n' +
'// ile açılır (js/structural-mesh-model.js).\n' +
'//\n' +
'// AÇILIŞTA YÜKLENMEZ: index.html\'de type="text/x-mfsim-asset" ile işaretli,\n' +
'// ilk ağ oluşturmasında talep üzerine çalıştırılır.\n' +
'//\n' +
'// Açılmış boyut : ' + raw.length + ' bayt\n' +
'// Sıkıştırılmış : ' + gz.length + ' bayt\n' +
'// Lisans        : AGPL-3 (TetGen çekirdeği) — vendor/license.tetgen.txt.\n' +
'//                 Köprü (tools/tetgen-wasm-src/tetgen-glue.cpp) MFSim\'in kendi\n' +
'//                 kaynağı, MIT. Dağıtılan bu tek dosya bütünüyle AGPL-3 koşullarını\n' +
'//                 taşır (CLAUDE.md — "kaynak MIT kalır, dağıtılan build AGPL-3").\n' +
'// ----------------------------------------------------------------------------\n' +
'window.VE_STR_TETGEN_WASM_BYTES_EMBEDDED = ' + raw.length + ';\n' +
'window.VE_STR_TETGEN_WASM_GZ_B64 = "' + b64 + '";\n';

fs.writeFileSync(OUT, out, 'utf8');

function mb(n) { return (n / 1048576).toFixed(2) + ' MB'; }
console.log('  kaynak      : vendor/tetgen-wasm.wasm  (' + mb(raw.length) + ')');
console.log('  gzip -9     : ' + mb(gz.length) + '  (%' + (100 - Math.round(gz.length / raw.length * 100)) + ' küçüldü)');
console.log('  base64      : ' + mb(b64.length) + '  (ham base64 olsaydı ' + mb(raw.length * 4 / 3) + ')');
console.log('');
console.log('✓ js/structural-tetgen-wasm.js üretildi (' + mb(out.length) + ')');
