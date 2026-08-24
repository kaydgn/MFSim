#!/usr/bin/env node
/**
 * build-tetgen-wasm.js — TetGen'i WASM'a derler
 *
 *   vendor/tetgen-src/*.{h,cxx}         (AGPL-3, dışarıdan geldi, dokunulmadı)
 *   + tools/tetgen-wasm-src/tetgen-glue.cpp   (MFSim'in kendi köprüsü, MIT)
 *   →  vendor/tetgen-wasm.js + vendor/tetgen-wasm.wasm
 *
 * NEDEN BU SCRIPT AYRI (build-occt-wasm-asset.js'ten farklı olarak)
 * ------------------------------------------------------------------
 * occt-import-js npm'den HAZIR .wasm olarak geldi — MFSim onu derlemedi,
 * yalnız gömdü (bkz. build-occt-wasm-asset.js). TetGen için hazır bir WASM
 * paketi YOK (npm/CDN'de arandı, bulunamadı — CLAUDE.md). Bu script o eksik
 * halkayı dolduruyor: gerçek TetGen 1.6 kaynağını (PyPI'daki `tetgen` Python
 * paketinin vendored kopyası, WIAS'ın kendi sitesiyle aynı sürüm) emscripten
 * ile derliyor.
 *
 * BU SCRIPT NADİREN ÇALIŞIR — emscripten (em++) gerektirir, çoğu geliştirme
 * ortamında YOK. Çıktı (vendor/tetgen-wasm.{js,wasm}) depoya COMMIT edilir;
 * günlük akış (npm run build / test) bu script'e hiç dokunmaz. Yalnız
 * vendor/tetgen-src/ güncellenirse (TetGen yeni sürüm) yeniden çalıştırılır.
 *
 * ── predicates.cxx MUTLAKA -O0 ──────────────────────────────────────────────
 * Shewchuk'un kesin (exact) aritmetiği IEEE 754 yuvarlamasının TAM sırasına
 * dayanır. -O0 dışında bir optimizasyon (özellikle Clang'ın varsayılan
 * fp-contract davranışı) ifadeleri yeniden sıralayıp/birleştirip predikati
 * SESSİZCE yanlış yapabilir — TetGen'in kendi resmi Makefile'ı da bunu
 * ayrı bir kuralla zorunlu kılıyor. tetgen.cxx'in geri kalanı -O3 (link-time
 * boyut/hız için), predicates.cxx TEK BAŞINA -O0.
 *
 * ── WASM `wasmBinary` İLE VERİLİR, glue kendi başına .wasm ÇEKMEZ ──────────
 * MODULARIZE çıktısı js/structural-model.js'teki occt köprüsüyle AYNI kalıbı
 * izler: worker, .wasm baytlarını KENDİSİ okuyup `factory({wasmBinary})` ile
 * geçer. Node v22'de glue'nun kendi dosya-yükleme yolu (global `fetch`
 * varlığından ötürü) "Failed to parse URL" hatası veriyor — ÖLÇÜLDÜ, bu
 * yüzden production kodu o yolu hiç kullanmıyor.
 *
 * Kullanım: node tools/build-tetgen-wasm.js  (PATH'te em++ olmalı)
 */
var fs = require('fs');
var path = require('path');
var { execFileSync } = require('child_process');

var ROOT = path.join(__dirname, '..');
var SRC_DIR = path.join(ROOT, 'vendor', 'tetgen-src');
var GLUE_CPP = path.join(__dirname, 'tetgen-wasm-src', 'tetgen-glue.cpp');
var OUT_DIR = path.join(ROOT, 'vendor');
var TMP = path.join(OUT_DIR, '.tetgen-wasm-build-tmp');

function run(cmd, args) {
  console.log('  $ ' + cmd + ' ' + args.join(' '));
  execFileSync(cmd, args, { stdio: 'inherit' });
}

try {
  execFileSync('em++', ['--version'], { stdio: 'ignore' });
} catch (e) {
  console.error('\nHATA: em++ (emscripten) bulunamadı. Bu script yalnız TetGen kaynağı');
  console.error('güncellendiğinde çalışır ve emscripten gerektirir. Kurulum: apt-get install');
  console.error('emscripten (Debian/Ubuntu) veya https://emscripten.org/docs/getting_started/\n');
  process.exit(1);
}

fs.rmSync(TMP, { recursive: true, force: true });
fs.mkdirSync(TMP, { recursive: true });

var predO = path.join(TMP, 'predicates.o');
var tetO = path.join(TMP, 'tetgen.o');
var glueO = path.join(TMP, 'glue.o');
var outJs = path.join(OUT_DIR, 'tetgen-wasm.js');

console.log('1/4  predicates.cxx  (-O0 — ZORUNLU, yukarıdaki not)');
run('em++', ['-c', '-O0', '-DTETLIBRARY', path.join(SRC_DIR, 'predicates.cxx'), '-o', predO]);

console.log('2/4  tetgen.cxx  (-O3)');
run('em++', ['-c', '-O3', '-DTETLIBRARY', path.join(SRC_DIR, 'tetgen.cxx'), '-o', tetO]);

console.log('3/4  tetgen-glue.cpp  (MFSim köprüsü, -O3)');
run('em++', ['-c', '-O3', '-DTETLIBRARY', '-I' + SRC_DIR, GLUE_CPP, '-o', glueO]);

console.log('4/4  link → vendor/tetgen-wasm.{js,wasm}');
run('em++', [
  predO, tetO, glueO, '-O3', '--bind',
  '-s', 'MODULARIZE=1',
  '-s', 'EXPORT_NAME=VeTetGenModule',
  '-s', 'ALLOW_MEMORY_GROWTH=1',
  '-s', 'NO_EXIT_RUNTIME=1',
  '-s', 'ASSERTIONS=0',
  '-o', outJs
]);

fs.rmSync(TMP, { recursive: true, force: true });

var wasmPath = path.join(OUT_DIR, 'tetgen-wasm.wasm');
var jsSize = fs.statSync(outJs).size;
var wasmSize = fs.statSync(wasmPath).size;
console.log('\n✓ vendor/tetgen-wasm.js    (' + (jsSize / 1024).toFixed(1) + ' KB)');
console.log('✓ vendor/tetgen-wasm.wasm  (' + (wasmSize / 1024).toFixed(1) + ' KB)');
console.log('\nSonraki adım: npm run build:tetgen-wasm-asset  (gzip+base64 göm)');
