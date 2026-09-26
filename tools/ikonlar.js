'use strict';
/**
 * ikonlar.js — css/icons.css ÜRETECİ
 * ───────────────────────────────────────────────────────────────────────────
 * Kaynak `tools/ikonlar.json`: ikon adı → SVG gövdesi. Kabuğu (viewBox 24,
 * çizgi 2, yuvarlak uç ve köşe) burada TEK yerde yazılı; her ikon bir CSS
 * maskesi olur ve rengini currentColor'dan alır — hangi tema, hangi durum
 * rengi olursa olsun aynı çizim.
 *
 * Dosyanın başlığı yıllarca "otomatik üretilmiştir (gen-icons)" dedi, ama
 * üreteç depoda yoktu ve dosya iki bölüm boyunca elle büyüdü (iki farklı URL
 * kodlaması yan yana duruyordu). Kaynak artık depoda; ikon eklemek bir satır.
 *
 * Kullanım: node tools/ikonlar.js            → css/icons.css yazar
 *           node tools/ikonlar.js --denetle  → dosya bayatsa çıkış 1
 *
 * css/ ÜÇ ürüne birden giriyor: ikon ekleyince `npm run build:viewer` ve
 * `npm run build:can` de koşulur (tests/unit/build-freshness.test.js).
 */
const fs = require('fs');
const path = require('path');

const KOK = path.join(__dirname, '..');
const KAYNAK = path.join(__dirname, 'ikonlar.json');
const HEDEF = path.join(KOK, 'css', 'icons.css');

const KABUK_AC = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black'"
  + " stroke-width='2' stroke-linecap='round' stroke-linejoin='round'>";

const BASLIK = [
  '/* ============================================================================',
  '   MFSim — SVG ikon sistemi (çizim dili Feather/Lucide, MIT/ISC)',
  '   CSS mask tabanlı: renk currentColor\'dan gelir → tüm temalarla uyumlu, keskin.',
  '   Kullanım: <span class="mf-ico mf-ico-save"></span> — JS\'te veIkon(\'save\') (js/ikon.js).',
  '   ÜRETİLİR: node tools/ikonlar.js (kaynak tools/ikonlar.json) — elle düzenlenmez.',
  '   ============================================================================ */',
  '.mf-ico{',
  '  display:inline-block;',
  '  width:1.1em;',
  '  height:1.1em;',
  '  vertical-align:-0.18em;',
  '  background-color:currentColor;',
  '  -webkit-mask-repeat:no-repeat;',
  '  mask-repeat:no-repeat;',
  '  -webkit-mask-position:center;',
  '  mask-position:center;',
  '  -webkit-mask-size:contain;',
  '  mask-size:contain;',
  '  flex-shrink:0;',
  '}'
];

function kaynak() {
  return JSON.parse(fs.readFileSync(KAYNAK, 'utf8'));
}

// Ad → SVG gövdesi (bölümler düzleştirilmiş). Aynı ad iki kez yazılamaz.
function ikonlar(k) {
  const out = {};
  (k || kaynak()).bolumler.forEach((b) => {
    Object.keys(b.ikonlar).forEach((ad) => {
      if (out[ad] !== undefined) throw new Error('ikon iki kez tanımlı: ' + ad);
      out[ad] = b.ikonlar[ad];
    });
  });
  return out;
}

function svg(govde) {
  return KABUK_AC + govde + '</svg>';
}

function kural(ad, govde) {
  const url = 'url("data:image/svg+xml,' + encodeURIComponent(svg(govde)) + '")';
  return '.mf-ico-' + ad + '{-webkit-mask-image:' + url + ';mask-image:' + url + ';}';
}

function uret(k) {
  k = k || kaynak();
  ikonlar(k);                                   // çift tanımı yakala
  const satir = BASLIK.slice();
  k.bolumler.forEach((b) => {
    if (b.baslik) satir.push('', '/* ' + b.baslik + ' */');
    Object.keys(b.ikonlar).forEach((ad) => {
      if (!/^[a-z0-9-]+$/.test(ad)) throw new Error('ikon adı yalnız küçük harf, rakam ve tire: ' + ad);
      satir.push(kural(ad, b.ikonlar[ad]));
    });
  });
  return satir.join('\n') + '\n';
}

module.exports = { uret, ikonlar, svg, kaynak, HEDEF };

if (require.main === module) {
  const css = uret();
  if (process.argv.includes('--denetle')) {
    const eski = fs.existsSync(HEDEF) ? fs.readFileSync(HEDEF, 'utf8') : '';
    if (eski !== css) {
      console.error('css/icons.css BAYAT — çalıştır: node tools/ikonlar.js');
      process.exitCode = 1;
    } else console.log('css/icons.css güncel (' + Object.keys(ikonlar()).length + ' ikon)');
  } else {
    fs.writeFileSync(HEDEF, css);
    console.log('css/icons.css yazıldı: ' + Object.keys(ikonlar()).length + ' ikon, ' + css.length + ' karakter');
  }
}
