#!/usr/bin/env node
// scripts/sync-occt-full.js — Full OpenCASCADE WASM'ı (opencascade.js, ~65MB)
// node_modules'tan vendor/opencascade-full/'a kopyalar. OPT-IN: occt-import-js'ten
// (hafif import) farklı olarak bu, gerçek BREP topolojisi (TopoDS, BRepAdaptor,
// Euler) sunar. Git'e commit EDİLMEZ (.gitignore) — deploy'da self-host gerekir.
//
// Kullanım:
//   npm install opencascade.js   (büyük bağımlılık, opsiyonel)
//   npm run occt:full            (bu script)
//
// Sonuç: vendor/opencascade-full/{opencascade.wasm.js, opencascade.wasm.wasm}

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT, 'node_modules/opencascade.js/dist');
const DST_DIR = path.join(ROOT, 'vendor/opencascade-full');

const files = ['opencascade.wasm.js', 'opencascade.wasm.wasm'];

console.log('occt:full sync başlıyor...');

if (!fs.existsSync(SRC_DIR)) {
  console.error('  ✗ opencascade.js kurulu değil. Önce: npm install opencascade.js');
  console.error('    (Bu ~65MB bir bağımlılıktır ve git\'e commit edilmez.)');
  process.exit(1);
}

fs.mkdirSync(DST_DIR, { recursive: true });
let ok = 0;
files.forEach(function(f) {
  const src = path.join(SRC_DIR, f);
  const dst = path.join(DST_DIR, f);
  if (!fs.existsSync(src)) {
    console.warn('  ✗ kaynak yok:', f);
    return;
  }
  fs.copyFileSync(src, dst);
  const sizeMB = (fs.statSync(dst).size / 1048576).toFixed(1);
  console.log('  ✓', 'vendor/opencascade-full/' + f, '(' + sizeMB + ' MB)');
  ok++;
});

console.log('occt:full sync tamamlandı (' + ok + '/' + files.length + ' dosya).');
console.log('NOT: Bu dosyalar git\'e commit edilmez; deploy\'da self-host edilmeli.');
