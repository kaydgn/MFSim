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

// delaunay-triangulate (MIT, Mikola Lysenko) — robust adaptive predicates
// kullanan 3D Delaunay (incremental Bowyer-Watson). CommonJS modülünü tarayıcı
// için IIFE bundle'ına çevir. esbuild ile minify.
try {
  const esbuild = require('esbuild');
  const entryPath = path.join(ROOT, '.tmp-delaunay-entry.js');
  // Hem main thread (window) hem worker (self/globalThis) için: globalThis
  // tüm modern ortamlarda mevcut. delaunay-triangulate fonksiyonunu global'a yaz.
  fs.writeFileSync(entryPath,
    "var _veFEADelaunay = require('delaunay-triangulate');\n" +
    "(typeof globalThis !== 'undefined' ? globalThis :\n" +
    " typeof window !== 'undefined' ? window :\n" +
    " typeof self !== 'undefined' ? self : this).veFEADelaunayTriangulate = _veFEADelaunay;\n");
  const outPath = path.join(ROOT, 'vendor/delaunay/delaunay-bundle.js');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  esbuild.buildSync({
    entryPoints: [entryPath],
    bundle: true,
    minify: true,
    format: 'iife',
    target: 'es2017',
    outfile: outPath,
    logLevel: 'silent'
  });
  fs.unlinkSync(entryPath);
  const sizeKB = (fs.statSync(outPath).size / 1024).toFixed(1);
  console.log('  ✓ vendor/delaunay/delaunay-bundle.js (' + sizeKB + ' KB, bundle)');
  ok++;
} catch (e) {
  console.warn('  ✗ delaunay bundle başarısız (atlandi):', e.message);
  skipped++;
}

// manifold-3d (Apache-2.0, Emmett Lalish / Google) — topolojik açıdan robust
// 3D boolean ops kütüphanesi. ES module'u esbuild ile IIFE'ye çevir; loader'ı
// globalThis.veCADManifoldLoader olarak expose et. WASM ayrı dosya kalır
// (~480 KB), runtime'da fetch edilir veya monolitik build'de base64 inline'lanır.
try {
  const esbuild = require('esbuild');
  const entryPath = path.join(ROOT, '.tmp-manifold-entry.js');
  fs.writeFileSync(entryPath,
    "import Module from 'manifold-3d';\n" +
    "(typeof globalThis !== 'undefined' ? globalThis :\n" +
    " typeof window !== 'undefined' ? window :\n" +
    " typeof self !== 'undefined' ? self : this).veCADManifoldLoader = Module;\n");
  const outPath = path.join(ROOT, 'vendor/manifold/manifold-bundle.js');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  esbuild.buildSync({
    entryPoints: [entryPath],
    bundle: true,
    minify: true,
    format: 'iife',
    platform: 'browser',
    target: 'es2020',
    outfile: outPath,
    // manifold.js'de runtime'da gate'lenen `import("node:module")` var; tarayıcı
    // platformunda asla çalışmaz — external olarak işaretle ki esbuild "missing"
    // hatası vermesin.
    external: ['node:module', 'node:fs', 'node:path', 'node:url'],
    logLevel: 'silent'
  });
  fs.unlinkSync(entryPath);
  const sizeKB = (fs.statSync(outPath).size / 1024).toFixed(1);
  console.log('  ✓ vendor/manifold/manifold-bundle.js (' + sizeKB + ' KB, bundle)');

  // WASM dosyasını kopyala (ayrı dosya — dev mode'da fetch, monolitik'te base64)
  const wasmSrc = path.join(ROOT, 'node_modules/manifold-3d/manifold.wasm');
  const wasmDst = path.join(ROOT, 'vendor/manifold/manifold.wasm');
  if (fs.existsSync(wasmSrc)) {
    fs.copyFileSync(wasmSrc, wasmDst);
    const wKB = (fs.statSync(wasmDst).size / 1024).toFixed(0);
    console.log('  ✓ vendor/manifold/manifold.wasm (' + wKB + ' KB)');
    ok += 2;
  } else {
    console.warn('  ✗ manifold.wasm kaynak yok (atlandi)');
    skipped++;
  }

  // Lisans dosyasını da taşı (Apache-2.0)
  const licSrc = path.join(ROOT, 'node_modules/manifold-3d/LICENSE');
  if (fs.existsSync(licSrc)) {
    fs.copyFileSync(licSrc, path.join(ROOT, 'vendor/manifold/LICENSE'));
  }
} catch (e) {
  console.warn('  ✗ manifold bundle başarısız (atlandi):', e.message);
  skipped++;
}

console.log('vendor:sync tamamlandi (' + ok + ' kopyalandi, ' + skipped + ' atlandi)');
