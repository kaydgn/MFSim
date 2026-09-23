#!/usr/bin/env node
// ============================================================================
// Takoz raporu gömülü varlıkları — TEK SEFERLİK, KENDİ-İNDİREN üreteç
// ============================================================================
// Çıktı: js/mount-report-assets.js  →  window.MNT_REPORT_ASSETS
//        { katexCss, katexJs }  (KaTeX yazı tipleri woff2 data-URI gömülü)
// Sonuç: rapor TAMAMEN ÇEVRİMDIŞI / self-contained render eder.
//
// Gereksinimler: node, curl (proxy'yi kullanır).
// Çalıştırma:    node tools/report-assets/build-report-assets.js
//                node tools/report-assets/build-report-assets.js --mevcut-katex
//                  (AĞSIZ: KaTeX'i mevcut çıktıdan okur, yalnız dosyayı yeniden yazar)
//
// METİN YÜZÜ BU PAKETTE DEĞİL (2026-09-23). Raporlar eskiden kendi üç yüzünü
// (Archivo · Source Serif 4 · IBM Plex Mono, ~390 KB base64) buradan alıyordu;
// aynı program ekranda bir, kâğıtta üç aileyle yazıyordu. Belgeler artık
// arayüzün yüzünü (Inter) arayüzün KENDİ @font-face kurallarından gömüyor
// (js/theme.js → veThemeFontFaceCss) — ikinci bir kopya tutulmuyor.
'use strict';
const fs = require('fs');
const os = require('os');
const cp = require('child_process');
const path = require('path');

const OUT = path.join(__dirname, '..', '..', 'js', 'mount-report-assets.js');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'mnt-assets-'));
const KATEX = 'https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
// Denklemlerimizin kullandığı KaTeX font aileleri (dekoratifler elenir).
const KEEP = new Set(['KaTeX_Main-Regular','KaTeX_Main-Bold','KaTeX_Main-Italic','KaTeX_Main-BoldItalic',
  'KaTeX_Math-Italic','KaTeX_Math-BoldItalic','KaTeX_Size1-Regular','KaTeX_Size2-Regular',
  'KaTeX_Size3-Regular','KaTeX_Size4-Regular','KaTeX_AMS-Regular']);

function curl(url, out, ua){ cp.execSync('curl -sS ' + (ua?('-A '+JSON.stringify(UA)+' '):'') + JSON.stringify(url) + ' -o ' + JSON.stringify(out), {stdio:'pipe'}); }
function curlBuf(url){ return cp.execSync('curl -sS -A ' + JSON.stringify(UA) + ' ' + JSON.stringify(url), {maxBuffer:2e8}); }
function dataUri(buf){ return 'data:font/woff2;base64,' + buf.toString('base64'); }

console.log('tmp:', TMP);

// ── 1) KaTeX css/js + kullanılan woff2 → data-URI'li css ────────────────────
const MEVCUT = process.argv.includes('--mevcut-katex');
let katexCss, katexJs;
if(MEVCUT){
  // AĞSIZ KİP: KaTeX mevcut çıktıdan — sürüm değişmiyorsa indirmenin anlamı yok.
  const eski = fs.readFileSync(OUT, 'utf8');
  const oku = (ad) => {
    const m = eski.match(new RegExp(ad + ': (\"[A-Za-z0-9+/=]*\")'));
    if(!m) throw new Error(ad + ' mevcut çıktıda bulunamadı');
    return Buffer.from(JSON.parse(m[1]), 'base64').toString('utf8');
  };
  katexCss = oku('katexCssB64');
  katexJs  = oku('katexJsB64');
  console.log('KaTeX: mevcut çıktıdan okundu (ağsız)');
} else {
curl(KATEX+'/katex.min.css', path.join(TMP,'katex.css'));
curl(KATEX+'/katex.min.js', path.join(TMP,'katex.js'));
curl(KATEX+'/contrib/auto-render.min.js', path.join(TMP,'auto.js'));
katexCss = fs.readFileSync(path.join(TMP,'katex.css'),'utf8');
katexCss = katexCss.replace(/src:\s*url\(fonts\/(KaTeX_[\w-]+)\.woff2\)[^;]*;/g, (m,name)=>{
  if(!KEEP.has(name)) return "src:local('MFSimNoFont');";
  const woff2 = curlBuf(KATEX+'/fonts/'+name+'.woff2');
  return 'src:url(' + dataUri(woff2) + ') format("woff2");';
});
if(/url\(fonts\//.test(katexCss)) throw new Error('KaTeX css hâlâ dış font referansı içeriyor');
katexJs = fs.readFileSync(path.join(TMP,'katex.js'),'utf8') + '\n' + fs.readFileSync(path.join(TMP,'auto.js'),'utf8');
console.log('KaTeX: css+fonts inline, js', (katexJs.length/1024|0)+'KB');
}

// ── 2) Metin yüzü YOK — arayüzün @font-face kurallarından gömülür (başlık notu).

// ── 3) js/mount-report-assets.js yaz (base64-sarmalı → kaçış sorunu yok) ─────
const b64 = s => Buffer.from(s,'utf8').toString('base64');
const js = '// AUTO-GENERATED — tools/report-assets/build-report-assets.js (tek seferlik, ağ gerektirir).\n'
  + '// Raporlar için gömülü KaTeX (yazı tipleri woff2 data-URI). Metin yüzü BURADA DEĞİL —\n'
  + '// arayüzün kendi @font-face kuralları (js/theme.js → veThemeFontFaceCss). ELLE DÜZENLEME.\n'
  + 'window.MNT_REPORT_ASSETS = (function(){\n'
  + '  function d(b){ return decodeURIComponent(escape(atob(b))); }\n'
  + '  return {\n'
  + '    katexCssB64: ' + JSON.stringify(b64(katexCss)) + ',\n'
  + '    katexJsB64: '  + JSON.stringify(b64(katexJs))  + ',\n'
  + '    get katexCss(){ return d(this.katexCssB64); },\n'
  + '    get katexJs(){ return d(this.katexJsB64); }\n'
  + '  };\n})();\n';
fs.writeFileSync(OUT, js, 'utf8');
fs.rmSync(TMP, {recursive:true, force:true});
console.log('\nWROTE', OUT, '('+(fs.statSync(OUT).size/1024|0)+'KB)');
