'use strict';
/**
 * sayi-dili.js — TEK SAYI YAZICISI (kullanıcı kararı 7·C, 2026-09-26)
 * ───────────────────────────────────────────────────────────────────────────
 * Ekrana, tuvale, günlüğe ve belgeye giden sayı js/sayi.js'ten (veSayi)
 * geçer: ondalık virgül, binlik nokta — 1.716,2. `toFixed` · `toExponential`
 * · `toLocaleString` yalnız MAKİNE biçiminde kalır ve satır
 * `// makine: <sebep>` taşır: sayı alanının değeri, CSV, JSON, SVG yol
 * verisi, yuvarlama (`Number(x.toFixed(4))`). Sebep yazılır; yoksa işaret bir
 * susturucu olur.
 *
 * Kullanım: node tools/sayi-dili.js <dosya...>   → işaretsiz çağrıları listeler
 */
const fs = require('fs');
const path = require('path');
const { yorumsuzJs } = require('./ikon-dili.js');

const KOK = path.join(__dirname, '..');
const CAGRI = /\.(?:toFixed|toExponential|toLocaleString)\(/;
const MAKINE = /\/\/\s*makine:\s*\S/;

// Metni tarar: yorum ve dizge içi değil, KOD içindeki çağrılar sayılır.
function tara(ham, f) {
  const s = yorumsuzJs(ham).split('\n'), h = ham.split('\n'), out = [];
  s.forEach((l, i) => {
    if (!CAGRI.test(l) || MAKINE.test(h[i])) return;
    out.push({ dosya: f, satir: i + 1, metin: l.trim().slice(0, 140) });
  });
  return out;
}
function sapmalar(f) {
  return tara(fs.readFileSync(path.join(KOK, f), 'utf8'), f);
}

module.exports = { tara, sapmalar, CAGRI, MAKINE };

if (require.main === module) {
  let n = 0;
  process.argv.slice(2).forEach((f) => sapmalar(f).forEach((x) => { n++; console.log(x.dosya + ':' + x.satir + ' ' + x.metin); }));
  console.log(n ? n + ' sapma' : 'sapma yok');
  process.exitCode = n ? 1 : 0;
}
