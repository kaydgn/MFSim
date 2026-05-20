#!/usr/bin/env node
// scripts/build-tetgen-wasm.js — TetGen (AGPL-3.0) WASM derleyicisi.
// MFSim FEA wasm'dan AYRI: lisans izolasyonu için ayrı modül, opt-in build.
// Çıktı: vendor/tetgen/tetgen-wasm.{js,wasm}
//
// Gereksinim: emscripten (emcc) PATH'te olmalı.
//   apt install emscripten  (Debian/Ubuntu)
//   veya: https://emscripten.org/docs/getting_started/downloads.html
//
// NOT: predicates.cxx Shewchuk'un exact-arithmetic kodudur ve IEEE 754
// floating-point rounding'ine bağlıdır. -O0 ile derlenmelidir (agresif
// optimizasyon exact predicates'i kırar). Bu script bu kuralı zorlar.
//
// LİSANS UYARISI:
// TetGen AGPL-3.0 lisansındadır. Bu wasm modülü dağıtıldığında MFSim ile
// birlikte AGPL yükümlülükleri (kaynak açıklama, copyleft) tetiklenir.
// Ticari kullanım için WIAS Berlin'den lisans alın:
//   tetgen at wias-berlin.de
// Detay: vendor/tetgen/NOTICE.md

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT, 'src', 'fea', 'tetgen');
const OUT_DIR = path.join(ROOT, 'vendor', 'tetgen');
const OUT_JS  = path.join(OUT_DIR, 'tetgen-wasm.js');
const OUT_WASM = path.join(OUT_DIR, 'tetgen-wasm.wasm');
const PREDICATES_OBJ = path.join(OUT_DIR, '.predicates.o');

const PREDICATES_SRC = path.join(SRC_DIR, 'predicates.cxx');
const TETGEN_SRC     = path.join(SRC_DIR, 'tetgen.cxx');
const WRAPPER_SRC    = path.join(SRC_DIR, 'tetgen_wasm.cpp');

if (!fs.existsSync(PREDICATES_SRC) || !fs.existsSync(TETGEN_SRC) || !fs.existsSync(WRAPPER_SRC)) {
  console.error('✗ TetGen kaynak dosyaları eksik (src/fea/tetgen/). Beklenen:');
  console.error('  - tetgen.h, tetgen.cxx, predicates.cxx, tetgen_wasm.cpp');
  process.exit(1);
}

fs.mkdirSync(OUT_DIR, { recursive: true });

const exportedFunctions = [
  '_tetgen_tetrahedralize',
  '_tetgen_out_point_count',
  '_tetgen_out_tet_count',
  '_tetgen_out_points',
  '_tetgen_out_tets',
  '_tetgen_out_nodes_per_tet',
  '_tetgen_last_error',
  '_tetgen_free',
  '_tetgen_version',
  '_malloc',
  '_free'
];

const exportedRuntimeMethods = [
  'ccall', 'cwrap', 'getValue', 'setValue', 'UTF8ToString',
  'HEAPF64', 'HEAP32', 'HEAPU8'
];

// ── 1) predicates.cxx → -O0 ile object dosyasına derle.
//      Shewchuk exact predicates: agresif optimizasyon IEEE 754 davranışını
//      bozar → "exact" testler "almost exact" olur → degenerate input'ta crash.
function compilePredicates() {
  console.log('\n[1/2] predicates.cxx → -O0 (Shewchuk exact arithmetic)');
  const args = [
    '-O0',
    '-std=c++17',
    '-I', SRC_DIR,
    '-DTETLIBRARY',
    '-c', PREDICATES_SRC,
    '-o', PREDICATES_OBJ
  ];
  const r = spawnSync('emcc', args, { stdio: 'inherit', cwd: ROOT });
  if (r.error && r.error.code === 'ENOENT') {
    console.error('\n✗ emcc bulunamadı. Kurulum:');
    console.error('  Ubuntu/Debian:  sudo apt install emscripten');
    console.error('  Diğer:          https://emscripten.org/docs/getting_started/downloads.html');
    process.exit(1);
  }
  if (r.status !== 0) {
    console.error('\n✗ predicates.cxx derleme başarısız (exit ' + r.status + ')');
    process.exit(r.status || 1);
  }
}

// ── 2) tetgen.cxx + wrapper.cpp → -O2 ile derle + predicates.o ile link et.
//      EXIT_RUNTIME=0: TetGen exit() çağırabilir; yine de wasm yaşamalı.
//      ALLOW_MEMORY_GROWTH: büyük mesh için bellek dinamik büyüsün.
//      DISABLE_EXCEPTION_CATCHING=0: TetGen throw int code; bizim wrapper yakalar.
function linkAll() {
  console.log('\n[2/2] tetgen.cxx + tetgen_wasm.cpp → -O2, link + predicates.o');
  const args = [
    TETGEN_SRC,
    WRAPPER_SRC,
    PREDICATES_OBJ,
    '-O2',
    '-std=c++17',
    '-I', SRC_DIR,
    '-DTETLIBRARY',
    '-s', 'WASM=1',
    '-s', 'MODULARIZE=1',
    '-s', "EXPORT_NAME='TetgenWasmModule'",
    '-s', "EXPORTED_FUNCTIONS=" + JSON.stringify(exportedFunctions),
    '-s', "EXPORTED_RUNTIME_METHODS=" + JSON.stringify(exportedRuntimeMethods),
    '-s', 'ALLOW_MEMORY_GROWTH=1',
    '-s', 'INITIAL_MEMORY=67108864',  // 64 MB başlangıç (TetGen mesh büyük olabilir)
    '-s', 'MAXIMUM_MEMORY=1073741824', // 1 GB tavan
    '-s', "ENVIRONMENT='web,worker,node'",
    '-s', 'SINGLE_FILE=0',
    '-s', 'DISABLE_EXCEPTION_CATCHING=0', // throw int code yakalanabilmeli
    '-s', "EXIT_RUNTIME=0",              // exit() runtime'ı düşürmesin
    '-o', OUT_JS
  ];
  const r = spawnSync('emcc', args, { stdio: 'inherit', cwd: ROOT });
  if (r.status !== 0) {
    console.error('\n✗ Link başarısız (exit ' + r.status + ')');
    process.exit(r.status || 1);
  }
}

console.log('build:wasm:tetgen başlıyor (TetGen 1.6.0, AGPL-3.0)');
compilePredicates();
linkAll();

// Geçici predicates object'i sil
try { fs.unlinkSync(PREDICATES_OBJ); } catch (_) { /* ignore */ }

const jsSize = fs.statSync(OUT_JS).size;
const wasmSize = fs.statSync(OUT_WASM).size;
console.log('\n✓ TetGen WASM derlendi');
console.log('  ' + path.relative(ROOT, OUT_JS)   + '  (' + (jsSize / 1024).toFixed(1)  + ' KB)');
console.log('  ' + path.relative(ROOT, OUT_WASM) + '  (' + (wasmSize / 1024).toFixed(1) + ' KB)');
console.log('\nLİSANS HATIRLATMA: TetGen AGPL-3.0. vendor/tetgen/NOTICE.md okuyun.');
