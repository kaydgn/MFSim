#!/usr/bin/env node
/**
 * build-display-font.js — css/fonts-display.css ÜRETECİ (ağ GEREKTİRMEZ).
 * ─────────────────────────────────────────────────────────────────────────
 * Atölye'nin başlık yüzü Source Serif 4. Font DEPODA ZATEN VAR: takoz
 * raporunun gömülü varlıklarının içinde (js/mount-report-assets.js →
 * fontsCssB64, woff2 data-URI). Bu üreteç oradan YALNIZ arayüzün ihtiyacı
 * olan yüzleri çıkarıp ayrı bir stil sayfasına yazar.
 *
 * NEDEN AYRI DOSYA — rapor varlıkları açılışta YÜKLENMEZ
 * index.html onları `type="text/x-mfsim-report"` ile işaretliyor; ilk rapor
 * üretilene kadar 1 MB'lık dosya hiç okunmuyor. Başlık yüzünü oradan almak,
 * o 1 MB'ı açılışa taşımak demekti — `published.spec.js` → "rapor varlıkları
 * İLK çağrıda yükleniyor" kapısı da bunu tutuyor.
 *
 * NEDEN SADECE 600 — Atölye'de serif YALNIZ BAŞLIK yüzü (gövde Inter kalır)
 * ve başlıkların hepsi 600. 400 ve italik yüzleri de taşımak maliyeti üçe
 * katlardı; ölçüldü: 600 çifti 81 KB, altı yüzün tamamı 195 KB.
 *
 * NEDEN İKİ YÜZ — `latin` Türkçe'nin ı'sını (U+0131) taşıyor, `latin-ext`
 * ğ/ş/İ/Ğ/Ş'yi (U+0100-02BA). Biri eksik olursa eksik harf SESSİZCE yedek
 * yüze düşer: "Çözücü" ekranda iki ayrı yazı tipiyle yazılır.
 *
 * `font-weight:600 700` BİLEREK ARALIK: yüz statik 600, ama arayüzde 700
 * isteyen başlıklar var. Tek bir 600 bildirilseydi tarayıcı 700'ü SENTETİK
 * kalınlaştırırdı (bulanık kenar). Aralık, 600-700 aralığının tamamını bu
 * yüzün karşıladığını söyler — CSS Fonts 4, statik yüzler için de geçerli.
 *
 * Çalıştırma:  node tools/build-display-font.js
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const KAYNAK = path.join(ROOT, 'js/mount-report-assets.js');
const HEDEF = path.join(ROOT, 'css/fonts-display.css');

const AILE = 'Source Serif 4';
const AGIRLIK = '600';

const src = fs.readFileSync(KAYNAK, 'utf8');
const m = /fontsCssB64\s*:\s*"([^"]*)"/.exec(src);
if (!m) { console.error('✗ fontsCssB64 bulunamadı — kaynak dosyanın biçimi değişmiş.'); process.exit(1); }
const css = Buffer.from(m[1], 'base64').toString('utf8');

const yuzler = (css.match(/@font-face\s*\{[^}]*\}/g) || []).filter((b) => {
  const a = (/font-family:\s*['"]?([^;'"]+)/.exec(b) || [])[1];
  const w = (/font-weight:\s*([^;}]+)/.exec(b) || [])[1];
  const s = (/font-style:\s*([^;}]+)/.exec(b) || [])[1] || 'normal';
  return a && a.trim() === AILE && (w || '').trim() === AGIRLIK && s.trim() === 'normal';
});

if (yuzler.length !== 2) {
  console.error('✗ Beklenen 2 yüz (latin + latin-ext), bulunan: ' + yuzler.length);
  console.error('  Rapor varlıkları yeniden üretildiyse alt küme değişmiş olabilir.');
  process.exit(1);
}

// Ağırlığı aralığa çevir + font-display ekle (yüz gelene kadar yedek yüz çizilsin).
const govde = yuzler.map((b) => b
  .replace(/font-weight:\s*600/, 'font-weight:600 700')
  .replace(/@font-face\s*\{/, '@font-face{font-display:swap;')
).join('\n');

const bayt = Buffer.byteLength(govde, 'utf8');
const out = '/* ' + '='.repeat(74) + '\n'
  + '   MFSim — Atölye BAŞLIK yüzü: ' + AILE + ' ' + AGIRLIK + ' (latin + latin-ext)\n'
  + '   Kaynak: js/mount-report-assets.js (rapor varlıklarından çıkarıldı, ağ YOK)\n'
  + '   Gerekçe ve alt küme kararı: tools/build-display-font.js\n'
  + '   ÖNEMLİ: Bu dosya otomatik üretilmiştir, elle düzenlenmez.\n'
  + '   Yeniden üret: node tools/build-display-font.js\n'
  + '   ' + '='.repeat(74) + ' */\n'
  + govde + '\n';

if (process.env.MFSIM_DISPLAY_FONT_OUT) {
  fs.writeFileSync(process.env.MFSIM_DISPLAY_FONT_OUT, out);
} else {
  fs.writeFileSync(HEDEF, out);
}
console.log('✓ css/fonts-display.css — ' + yuzler.length + ' yüz, ' + (bayt / 1024).toFixed(0) + ' KB');
