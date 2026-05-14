#!/usr/bin/env node
// scripts/build-wasm.js — MFSim FEA C++ kaynaklarını WebAssembly'ye derler.
// Çıktı: vendor/mfsim-fea/mfsim-fea.{js,wasm}
// Gereksinim: emscripten (emcc) PATH'te olmalı. apt install emscripten ya da emsdk.

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT, 'src', 'fea');
const OUT_DIR = path.join(ROOT, 'vendor', 'mfsim-fea');
const OUT_JS  = path.join(OUT_DIR, 'mfsim-fea.js');
const OUT_WASM = path.join(OUT_DIR, 'mfsim-fea.wasm');

const sources = ['bar1d.cpp'].map(function(f) { return path.join(SRC_DIR, f); });

const exportedFunctions = [
  '_solve_bar_1d',
  '_mfsim_fea_version',
  '_malloc',
  '_free'
];

const exportedRuntimeMethods = [
  'ccall',
  'cwrap',
  'getValue',
  'setValue',
  'UTF8ToString',
  'HEAPF64'
];

const args = [
  ...sources,
  '-O2',
  '-s', 'WASM=1',
  '-s', 'MODULARIZE=1',
  '-s', "EXPORT_NAME='MFSimFEAModule'",
  '-s', "EXPORTED_FUNCTIONS=" + JSON.stringify(exportedFunctions),
  '-s', "EXPORTED_RUNTIME_METHODS=" + JSON.stringify(exportedRuntimeMethods),
  '-s', 'ALLOW_MEMORY_GROWTH=1',
  '-s', "ENVIRONMENT='web,worker,node'",
  '-s', 'SINGLE_FILE=0',
  '-o', OUT_JS
];

fs.mkdirSync(OUT_DIR, { recursive: true });

console.log('build:wasm → emcc ' + sources.map(function(s) { return path.relative(ROOT, s); }).join(' '));
const result = spawnSync('emcc', args, { stdio: 'inherit', cwd: ROOT });

if (result.error && result.error.code === 'ENOENT') {
  console.error('\n✗ emcc bulunamadı. Kurulum:');
  console.error('  Ubuntu/Debian:  sudo apt install emscripten');
  console.error('  Diğer:          https://emscripten.org/docs/getting_started/downloads.html');
  process.exit(1);
}
if (result.status !== 0) {
  console.error('\n✗ emcc derleme başarısız (exit ' + result.status + ')');
  process.exit(result.status || 1);
}

const jsSize = fs.statSync(OUT_JS).size;
const wasmSize = fs.statSync(OUT_WASM).size;
console.log('\n✓ MFSim FEA WASM derlendi');
console.log('  ' + path.relative(ROOT, OUT_JS)   + '  (' + (jsSize / 1024).toFixed(1)  + ' KB)');
console.log('  ' + path.relative(ROOT, OUT_WASM) + '  (' + (wasmSize / 1024).toFixed(1) + ' KB)');
