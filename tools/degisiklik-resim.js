// ============================================================================
// tools/degisiklik-resim.js — SON DEĞİŞİKLİKLERİN GÖRSELİ
// ────────────────────────────────────────────────────────────────────────────
// Kullanıcı 2026-11-05 (Canlı Not 27): *"Son değişiklikler kısmına görsel
// ekleyebiliyor muyuz? Her son değişikliği görselli olarak görmek istiyorum."*
// → *"Olur uygula. Elinde olan görüntüleri eklersin."*
//
//   node tools/degisiklik-resim.js <not-N.png ...> [--kuru]
//       Canlı Not'un sonuç görüntüsü (2×, deviceScaleFactor 2) → assets/degisiklik/not-N.webp
//       (kalite 0,85, en çok EN_GENIS px: gösterimin 2×'i). Numara dosya adından.
//
// Görsel NOTA bağlıdır: commit'in konusu "Canlı not N: …" (ya da "Canlı not 9 · 10 ·
// 16: …") notun numarasını söyler (tools/version-info.js → `notlar`). Program onu
// derlemede gömer (build.js → __MFSIM_DEGISIKLIK), YALNIZ künyenin modül
// listesindeki commit'lerin notları için — liste 12 birleşme, boyut sınırlı.
// Gösterim ölçüsü pikselin yarısı (webp 2×).
// ============================================================================

const fs = require('fs');
const path = require('path');
const { webpOlcu } = require('./karsilama-webp.js');

const KOK = path.join(__dirname, '..');
const KLASOR = path.join(KOK, 'assets', 'degisiklik');
const EN_GENIS = 1120;          // px — gösterim en çok 560 CSS px, 2×
const KALITE = 0.85;
const RESIM_TAVAN = 200 * 1024; // tek görsel; Not 23'ün en büyüğü 140 KB
const CHROMIUM = process.env.MFSIM_CHROMIUM || '';

// Künyedeki notların görselleri: { N: { src, g, y } } — g · y gösterim ölçüsü (CSS px)
function gomulecekler(info, klasor) {
  const k = klasor || KLASOR, out = {};
  const moduller = (info && info.moduller) || {};
  Object.keys(moduller).forEach((m) => (moduller[m] || []).forEach((kayit) => (kayit.ayrinti || []).forEach((c) => {
    (c.notlar || []).forEach((n) => {
      if (out[n]) return;
      const f = path.join(k, 'not-' + n + '.webp');
      if (!fs.existsSync(f)) return;
      const buf = fs.readFileSync(f), o = webpOlcu(buf);
      if (!o) return;
      out[n] = { src: 'data:image/webp;base64,' + buf.toString('base64'), g: Math.round(o[0] / 2), y: Math.round(o[1] / 2) };
    });
  })));
  return out;
}

async function cevir(dosyalar, kuru) {
  const { chromium } = require('playwright');
  const tarayici = await chromium.launch(CHROMIUM ? { executablePath: CHROMIUM } : {});
  const sayfa = await tarayici.newPage();
  await sayfa.goto('about:blank');
  const yazilan = [];
  try {
    for (const d of dosyalar) {
      const m = /not-(\d+)\.png$/i.exec(d);
      if (!m) throw new Error('ad not-N.png olmalı: ' + d);
      const r = await sayfa.evaluate(async ({ b64, enGenis, kalite }) => {
        const img = new Image();
        img.src = 'data:image/png;base64,' + b64;
        await img.decode();
        const s = Math.min(1, enGenis / img.naturalWidth);
        const c = document.createElement('canvas');
        c.width = Math.round(img.naturalWidth * s);
        c.height = Math.round(img.naturalHeight * s);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        return { w: c.width, h: c.height, url: c.toDataURL('image/webp', kalite) };
      }, { b64: fs.readFileSync(d).toString('base64'), enGenis: EN_GENIS, kalite: KALITE });
      if (!r.url.startsWith('data:image/webp')) throw new Error('tarayıcı webp kodlamadı: ' + d);
      const ham = Buffer.from(r.url.split(',')[1], 'base64'), ad = 'not-' + m[1] + '.webp';
      if (ham.length > RESIM_TAVAN) throw new Error(ad + ' tavanı aştı: ' + Math.round(ham.length / 1024) + ' KB');
      if (!kuru) { fs.mkdirSync(KLASOR, { recursive: true }); fs.writeFileSync(path.join(KLASOR, ad), ham); }
      yazilan.push(ham.length);
      console.log(path.basename(d).padEnd(14) + ' → ' + ad + '  ' + r.w + '×' + r.h + '  ' + Math.round(ham.length / 1024) + ' KB');
    }
  } finally { await tarayici.close(); }
  console.log(yazilan.length + ' görsel · ' + Math.round(yazilan.reduce((t, b) => t + b, 0) / 1024) + ' KB' + (kuru ? ' (--kuru: yazılmadı)' : ''));
}

if (require.main === module) {
  const arg = process.argv.slice(2), kuru = arg.includes('--kuru');
  const dosyalar = arg.filter((a) => a !== '--kuru');
  if (!dosyalar.length) { console.log('Kullanım: node tools/degisiklik-resim.js <not-N.png ...> [--kuru]'); process.exit(1); }
  cevir(dosyalar, kuru).catch((e) => { console.error('HATA:', e.message); process.exit(1); });
}

module.exports = { gomulecekler, KLASOR, EN_GENIS, RESIM_TAVAN };
