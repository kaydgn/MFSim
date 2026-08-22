#!/usr/bin/env node
/**
 * build-occt-wasm-asset.js — STEP okuyucusunun .wasm'ını UYGULAMAYA GÖMER
 *
 *   vendor/occt-import-js.wasm  →  js/structural-occt-wasm.js
 *
 * NEDEN GÖMÜYORUZ (kullanıcı kararı, 2026-08-22)
 * ----------------------------------------------
 * Önceki tasarımda .wasm çalışma anında `vendor/` yolundan çekiliyordu ve
 * panel "STEP okuyucusu indiriliyor" diyordu. İki sorunu vardı:
 *
 *   1) ÇEVRİMDIŞI ÇALIŞMIYORDU. MFSim tek dosya olarak indirilip kullanılıyor;
 *      yanında `vendor/` klasörü olmayan bir kurulumda STEP hiç açılmıyordu.
 *   2) KULLANICIYA YANLIŞ ŞEYİ ANLATIYORDU. Yükleme göstergesi PARÇANIN
 *      işlendiğini söylemeli; kütüphanenin indiğini değil. O bir uygulama
 *      ayrıntısı, kullanıcının işi değil.
 *
 * BOYUT — GZIP ŞART
 * -----------------
 * Ham base64 7,60 MB'ı 10,14 MB'a çıkarırdı. `gzip -9` ile 3,09 MB → base64
 * 4,12 MB; yani gömmenin maliyeti üçte bire iniyor. Tarayıcı tarafında
 * `DecompressionStream('gzip')` ile açılıyor (Chrome 80+, Safari 16.4+,
 * Firefox 113+); olmayan tarayıcıda köprü `vendor/occt-import-js.wasm`
 * yedeğine düşüyor — bu yüzden vendor dosyası depoda KALIYOR (LGPL-2.1'in
 * "kütüphane değiştirilebilir olmalı" koşulu da aynı dosyayla karşılanıyor).
 *
 * Üretilen dosya `js/mount-report-assets.js` ve `js/fead-report-template.js`
 * ile AYNI sınıftan: elle düzenlenmez, `npm run build:occt-wasm` üretir ve
 * git'e dahildir. index.html'de `type="text/x-mfsim-asset"` ile işaretlidir →
 * AÇILIŞTA yüklenmez, ilk içe aktarmada talep üzerine çalıştırılır.
 *
 * Kullanım: node tools/build-occt-wasm-asset.js
 */
var fs = require('fs');
var path = require('path');
var zlib = require('zlib');

var ROOT = path.join(__dirname, '..');
var SRC = path.join(ROOT, 'vendor', 'occt-import-js.wasm');
var OUT = path.join(ROOT, 'js', 'structural-occt-wasm.js');

if (!fs.existsSync(SRC)) {
  console.error('HATA: ' + SRC + ' bulunamadı. Önce vendor/ altına occt-import-js.wasm koyun.');
  process.exit(1);
}

var raw = fs.readFileSync(SRC);

// WASM imzası: 0x00 61 73 6D ("\0asm"). Yanlış bir dosya gömülürse tarayıcıda
// ancak ilk içe aktarmada, anlaşılmaz bir hatayla ortaya çıkardı.
if (!(raw[0] === 0x00 && raw[1] === 0x61 && raw[2] === 0x73 && raw[3] === 0x6d)) {
  console.error('HATA: ' + SRC + ' bir WebAssembly ikilisi değil (imza tutmuyor).');
  process.exit(1);
}

var gz = zlib.gzipSync(raw, { level: 9 });
var b64 = gz.toString('base64');

// Base64 alfabesi (A-Za-z0-9+/=) `<` içermez → `</script` kalkanına gerek yok;
// build.js'in gömme kalkanı yine de dosyanın üstünden geçer.
var out =
'// ============================================================================\n' +
'//  STEP OKUYUCUSU — GÖMÜLÜ .wasm (OpenCascade / occt-import-js)\n' +
'// ============================================================================\n' +
'// ÜRETİLEN DOSYA — ELLE DÜZENLENMEZ.\n' +
'//   kaynak : vendor/occt-import-js.wasm\n' +
'//   üretim : npm run build:occt-wasm  (tools/build-occt-wasm-asset.js)\n' +
'//\n' +
'// gzip -9 + base64. Ham base64 ' + (Math.round(raw.length * 4 / 3 / 1048576 * 100) / 100) + ' MB olurdu;\n' +
'// sıkıştırılmış hâli ' + (Math.round(b64.length / 1048576 * 100) / 100) + ' MB. Tarayıcıda DecompressionStream\n' +
'// ile açılır (js/structural-model.js _sgEmbeddedWasm).\n' +
'//\n' +
'// AÇILIŞTA YÜKLENMEZ: index.html\'de type="text/x-mfsim-asset" ile işaretli,\n' +
'// ilk STEP içe aktarmasında talep üzerine çalıştırılır.\n' +
'//\n' +
'// Açılmış boyut : ' + raw.length + ' bayt\n' +
'// Sıkıştırılmış : ' + gz.length + ' bayt\n' +
'// Lisans        : LGPL-2.1 — vendor/license.occt.txt, vendor/license.occt-import-js.txt\n' +
'// ----------------------------------------------------------------------------\n' +
'window.VE_STR_OCCT_WASM_BYTES_EMBEDDED = ' + raw.length + ';\n' +
'window.VE_STR_OCCT_WASM_GZ_B64 = "' + b64 + '";\n';

fs.writeFileSync(OUT, out, 'utf8');

function mb(n) { return (n / 1048576).toFixed(2) + ' MB'; }
console.log('  kaynak      : vendor/occt-import-js.wasm  (' + mb(raw.length) + ')');
console.log('  gzip -9     : ' + mb(gz.length) + '  (%' + (100 - Math.round(gz.length / raw.length * 100)) + ' küçüldü)');
console.log('  base64      : ' + mb(b64.length) + '  (ham base64 olsaydı ' + mb(raw.length * 4 / 3) + ')');
console.log('');
console.log('✓ js/structural-occt-wasm.js üretildi (' + mb(out.length) + ')');
