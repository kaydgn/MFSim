#!/usr/bin/env node
// scripts/sync-vendor.js — node_modules'tan vendor/'a ihtiyacımız olan
// runtime dosyalarını kopyalar. npm postinstall ve manuel "npm run vendor:sync"
// ile çağrılır. Sonuç dosyalar git'e commit edilir (offline / PWA için).

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const items = [
  // Three.js — FEA viewer
  ['node_modules/three/build/three.min.js', 'vendor/three.min.js'],

  // occt-import-js — STEP/IGES import (OpenCascade WebAssembly)
  ['node_modules/occt-import-js/dist/occt-import-js.js',           'vendor/opencascade/occt-import-js.js'],
  ['node_modules/occt-import-js/dist/occt-import-js.wasm',         'vendor/opencascade/occt-import-js.wasm'],
  ['node_modules/occt-import-js/dist/license.occt.txt',            'vendor/opencascade/license.occt.txt'],
  ['node_modules/occt-import-js/dist/license.occt-import-js.txt',  'vendor/opencascade/license.occt-import-js.txt']
];

console.log('vendor:sync başlıyor...');
let ok = 0, skipped = 0;
items.forEach(function(item) {
  const src = path.join(ROOT, item[0]);
  const dst = path.join(ROOT, item[1]);
  if (!fs.existsSync(src)) {
    console.warn('  ✗ kaynak yok (atlandi):', item[0]);
    skipped++;
    return;
  }
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
  const sizeKB = (fs.statSync(dst).size / 1024).toFixed(0);
  console.log('  ✓', item[1], '(' + sizeKB + ' KB)');
  ok++;
});
console.log('vendor:sync tamamlandi (' + ok + ' kopyalandi, ' + skipped + ' atlandi)');
