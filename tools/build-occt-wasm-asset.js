#!/usr/bin/env node
/**
 * build-occt-wasm-asset.js — OCCT çekirdeğinin .wasm'ını UYGULAMAYA GÖMER
 *
 *   vendor/opencascade.wasm.gz  →  js/structural-occt-wasm.js   (base64)
 *
 * NEDEN GÖMÜYORUZ (kullanıcı kararı, 2026-08-22)
 * ----------------------------------------------
 * MFSim tek dosya olarak indirilip kullanılıyor; yanında `vendor/` klasörü
 * olmayan bir kurulumda çalışma anında çekilen her varlık YOK demektir. Bu bir
 * incelik değil, özelliğin hiç olmaması demek.
 *
 * NEDEN KAYNAK ZATEN GZİPLİ (2026-08-25)
 * --------------------------------------
 * Çekirdek occt-import-js'ten (7,6 MB, salt okuyucu) opencascade.js'e geçti
 * (62,8 MB, boolean dahil) — çünkü çok gövdeli CAD dosyalarını TEK KATIYA
 * indirmek B-Rep seviyesinde birleştirme istiyor ve okuyucuda o yok.
 *
 * 62,8 MB'lık ham .wasm depoya konmaz; `vendor/` altında **gzip'li** duruyor
 * (13,7 MB). Bu hem LGPL-2.1'in "kütüphane değiştirilebilir olmalı" koşulunu
 * karşılıyor (dosya orada, `gunzip` ile değiştirilebilir) hem de bu üretecin
 * işini base64'e indiriyor — gzip zaten yapılmış.
 *
 * ÜRETİLEN DOSYA GİT'E DAHİL DEĞİL (18,3 MB). Her `npm run build` onu yeniden
 * üretiyor; böylece "vendor güncellendi ama varlık üretilmedi" diye bir bayat
 * durum HİÇ oluşamıyor — eskiden bunu bir test kapısı kolluyordu, artık sınıf
 * ortadan kalktı.
 *
 * Kullanım: node tools/build-occt-wasm-asset.js
 */
var fs = require('fs');
var path = require('path');
var zlib = require('zlib');

var ROOT = path.join(__dirname, '..');
var SRC = path.join(ROOT, 'vendor', 'opencascade.wasm.gz');
var OUT = path.join(ROOT, 'js', 'structural-occt-wasm.js');

if (!fs.existsSync(SRC)) {
  console.error('HATA: ' + SRC + ' bulunamadı.');
  process.exit(1);
}

var gz = fs.readFileSync(SRC);

// İmza denetimi AÇILMIŞ içerik üzerinde: yanlış bir dosya gömülürse tarayıcıda
// ancak ilk içe aktarmada, anlaşılmaz bir hatayla ortaya çıkardı.
var raw = zlib.gunzipSync(gz);
if (!(raw[0] === 0x00 && raw[1] === 0x61 && raw[2] === 0x73 && raw[3] === 0x6d)) {
  console.error('HATA: ' + SRC + ' açıldığında WebAssembly ikilisi çıkmıyor (imza tutmuyor).');
  process.exit(1);
}

var b64 = gz.toString('base64');

var out =
'// ============================================================================\n' +
'//  OCCT ÇEKİRDEĞİ — GÖMÜLÜ .wasm (opencascade.js / OpenCascade)\n' +
'// ============================================================================\n' +
'// ÜRETİLEN DOSYA — ELLE DÜZENLENMEZ, GİT\'E DAHİL DEĞİL.\n' +
'//   kaynak : vendor/opencascade.wasm.gz\n' +
'//   üretim : npm run build:occt-wasm  (tools/build-occt-wasm-asset.js)\n' +
'//\n' +
'// gzip -9 + base64. Ham base64 ' + (Math.round(raw.length * 4 / 3 / 1048576 * 100) / 100) + ' MB olurdu;\n' +
'// sıkıştırılmış hâli ' + (Math.round(b64.length / 1048576 * 100) / 100) + ' MB. Tarayıcıda\n' +
'// DecompressionStream ile WORKER içinde açılır (js/structural-model.js).\n' +
'//\n' +
'// AÇILIŞTA YÜKLENMEZ: index.html\'de type="text/x-mfsim-asset" ile işaretli,\n' +
'// ilk STEP içe aktarmasında talep üzerine çalıştırılır.\n' +
'//\n' +
'// Açılmış boyut : ' + raw.length + ' bayt\n' +
'// Sıkıştırılmış : ' + gz.length + ' bayt\n' +
'// Lisans        : LGPL-2.1 — vendor/license.occt.txt, vendor/license.opencascade-js.txt\n' +
'// ----------------------------------------------------------------------------\n' +
'window.VE_STR_OCCT_WASM_BYTES_EMBEDDED = ' + raw.length + ';\n' +
'window.VE_STR_OCCT_WASM_GZ_B64 = "' + b64 + '";\n';

fs.writeFileSync(OUT, out, 'utf8');

function mb(n) { return (n / 1048576).toFixed(2) + ' MB'; }
console.log('  kaynak      : vendor/opencascade.wasm.gz  (' + mb(gz.length) + ', açılmış ' + mb(raw.length) + ')');
console.log('  base64      : ' + mb(b64.length) + '  (ham base64 olsaydı ' + mb(raw.length * 4 / 3) + ')');
console.log('');
console.log('✓ js/structural-occt-wasm.js üretildi (' + mb(out.length) + ')');
