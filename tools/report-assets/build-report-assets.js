#!/usr/bin/env node
// ============================================================================
// Takoz raporu gömülü varlıkları — TEK SEFERLİK, KENDİ-İNDİREN üreteç
// ============================================================================
// Çıktı: js/mount-report-assets.js  →  window.MNT_REPORT_ASSETS
//        { katexCss, katexJs, fontsCss }  (tümü woff2 data-URI gömülü)
// Sonuç: rapor TAMAMEN ÇEVRİMDIŞI / self-contained render eder (KaTeX + fontlar).
//
// Gereksinimler: node, curl (proxy'yi kullanır), python3 + `pip install fonttools brotli`.
// Çalıştırma:    node tools/report-assets/build-report-assets.js
//
// Neden gerekli: KaTeX (matematik) ile 3 metin fontunu (Archivo/Source Serif 4/
// IBM Plex Mono) rapora gömeriz. Fontlar Türkçe için latin+latin-ext alt kümesine
// indirgenir; Archivo değişken genişlik ekseni 87%'ye sabitlenir (kondens görünüm).
'use strict';
const fs = require('fs');
const os = require('os');
const cp = require('child_process');
const path = require('path');

const OUT = path.join(__dirname, '..', '..', 'js', 'mount-report-assets.js');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'mnt-assets-'));
const KATEX = 'https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
// Türkçe + noktalama + ok/matematik + Yunan (metin içi δ,θ,ω,φ,Σ) kapsar.
const SUBSET = 'U+0000-00FF,U+0100-017F,U+0131,U+0152-0153,U+2000-206F,U+2070-209F,'
  + 'U+2190-21FF,U+2200-22FF,U+0370-03FF,U+2212,U+00D7,U+00B7,U+2264-2265';
// Denklemlerimizin kullandığı KaTeX font aileleri (dekoratifler elenir).
const KEEP = new Set(['KaTeX_Main-Regular','KaTeX_Main-Bold','KaTeX_Main-Italic','KaTeX_Main-BoldItalic',
  'KaTeX_Math-Italic','KaTeX_Math-BoldItalic','KaTeX_Size1-Regular','KaTeX_Size2-Regular',
  'KaTeX_Size3-Regular','KaTeX_Size4-Regular','KaTeX_AMS-Regular']);

function curl(url, out, ua){ cp.execSync('curl -sS ' + (ua?('-A '+JSON.stringify(UA)+' '):'') + JSON.stringify(url) + ' -o ' + JSON.stringify(out), {stdio:'pipe'}); }
function curlBuf(url){ return cp.execSync('curl -sS -A ' + JSON.stringify(UA) + ' ' + JSON.stringify(url), {maxBuffer:2e8}); }
function dataUri(buf){ return 'data:font/woff2;base64,' + buf.toString('base64'); }

console.log('tmp:', TMP);

// ── 1) KaTeX css/js + kullanılan woff2 → data-URI'li css ────────────────────
curl(KATEX+'/katex.min.css', path.join(TMP,'katex.css'));
curl(KATEX+'/katex.min.js', path.join(TMP,'katex.js'));
curl(KATEX+'/contrib/auto-render.min.js', path.join(TMP,'auto.js'));
let katexCss = fs.readFileSync(path.join(TMP,'katex.css'),'utf8');
katexCss = katexCss.replace(/src:\s*url\(fonts\/(KaTeX_[\w-]+)\.woff2\)[^;]*;/g, (m,name)=>{
  if(!KEEP.has(name)) return "src:local('MFSimNoFont');";
  const woff2 = curlBuf(KATEX+'/fonts/'+name+'.woff2');
  return 'src:url(' + dataUri(woff2) + ') format("woff2");';
});
if(/url\(fonts\//.test(katexCss)) throw new Error('KaTeX css hâlâ dış font referansı içeriyor');
const katexJs = fs.readFileSync(path.join(TMP,'katex.js'),'utf8') + '\n' + fs.readFileSync(path.join(TMP,'auto.js'),'utf8');
console.log('KaTeX: css+fonts inline, js', (katexJs.length/1024|0)+'KB');

// ── 2) Metin fontları: latin+latin-ext, subset (+ Archivo wdth=87 instance) ──
let _t=0;
function processWoff2(buf, pinWdth){
  const inF=path.join(TMP,'i'+_t+'.woff2'), midF=path.join(TMP,'m'+_t+'.woff2'), outF=path.join(TMP,'o'+(_t++)+'.woff2');
  fs.writeFileSync(inF, buf);
  let src=inF;
  if(pinWdth){ cp.execSync('python3 -m fontTools.varLib.instancer '+JSON.stringify(inF)+' wdth='+pinWdth+' -o '+JSON.stringify(midF),{stdio:'pipe'}); src=midF; }
  cp.execSync('pyftsubset '+JSON.stringify(src)+' --output-file='+JSON.stringify(outF)+' --flavor=woff2 --unicodes='+SUBSET+" --layout-features='kern,liga,calt' --no-hinting --desubroutinize",{stdio:'pipe'});
  const sub=fs.readFileSync(outF); [inF,midF,outF].forEach(f=>{ if(fs.existsSync(f)) fs.unlinkSync(f); });
  return sub;
}
function inlineFamily(cssUrl, pinWdth){
  const raw = curlBuf(cssUrl).toString('utf8');
  const out=[];
  for(const seg of raw.split('/* ')){
    const mm=seg.match(/^([a-z-]+) \*\//); if(!mm) continue;
    if(mm[1]!=='latin' && mm[1]!=='latin-ext') continue;
    const u=seg.match(/url\((https:\/\/[^)]+\.woff2)\)/); if(!u) continue;
    let block=('/* '+seg).trim().replace(u[1], dataUri(processWoff2(curlBuf(u[1]), pinWdth)));
    if(pinWdth) block=block.replace(/font-stretch:[^;]+;/, 'font-stretch: 87%;');
    out.push(block);
  }
  return out;
}
const FAMS = [
  ['https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62.5..125,400..700&display=swap', 87],
  ['https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,wght@0,400;0,600;1,400&display=swap', null],
  ['https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&display=swap', null],
];
let fontsCss='';
for(const [url,pin] of FAMS){ const b=inlineFamily(url,pin); console.log('  font faces:', b.length, pin?('(wdth='+pin+')'):''); fontsCss += b.join('\n')+'\n'; }
if(/https:\/\//.test(fontsCss)) throw new Error('metin fontları css hâlâ dış referans içeriyor');

// ── 3) js/mount-report-assets.js yaz (base64-sarmalı → kaçış sorunu yok) ─────
const b64 = s => Buffer.from(s,'utf8').toString('base64');
const js = '// AUTO-GENERATED — tools/report-assets/build-report-assets.js (tek seferlik, ağ gerektirir).\n'
  + '// Takoz raporu için gömülü KaTeX + fontlar (tümü woff2 data-URI). ELLE DÜZENLEME.\n'
  + 'window.MNT_REPORT_ASSETS = (function(){\n'
  + '  function d(b){ return decodeURIComponent(escape(atob(b))); }\n'
  + '  return {\n'
  + '    katexCssB64: ' + JSON.stringify(b64(katexCss)) + ',\n'
  + '    katexJsB64: '  + JSON.stringify(b64(katexJs))  + ',\n'
  + '    fontsCssB64: ' + JSON.stringify(b64(fontsCss)) + ',\n'
  + '    get katexCss(){ return d(this.katexCssB64); },\n'
  + '    get katexJs(){ return d(this.katexJsB64); },\n'
  + '    get fontsCss(){ return d(this.fontsCssB64); }\n'
  + '  };\n})();\n';
fs.writeFileSync(OUT, js, 'utf8');
fs.rmSync(TMP, {recursive:true, force:true});
console.log('\nWROTE', OUT, '('+(fs.statSync(OUT).size/1024|0)+'KB)');
