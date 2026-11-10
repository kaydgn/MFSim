#!/usr/bin/env node
/**
 * takoz-gorsel.js — AMC Mecanocaucho® konik takozlarının GÖRSELLERİ
 *
 *   node tools/takoz-gorsel.js            # indir (önbellek) + üret
 *   node tools/takoz-gorsel.js --kuru     # yalnız listeyi ve hedefleri yaz
 *
 * Kaynak üreticinin sitesi (mecanocaucho.com → cdn.amcsa.es, 2026-11-10): tipin
 * ÖLÇÜLÜ ÇİZİMİ (SVG) ve ailenin ürün/uygulama fotoğrafları (JPG/PNG). Hidrolik
 * konilerin sitede çizimi yok; çizimleri AMC genel kataloğunun (cauchometal_en.pdf)
 * 35. sayfasından kırpılır (pdftoppm gerekir; yoksa o kalem atlanır, eldeki dosya
 * korunur).
 *
 * Çıktı `assets/takoz/amc/<ad>.webp` + `assets/takoz/amc/kunye.json` (ad → kaynak,
 * ölçü, bayt). Klasör ELLE DÜZENLENMEZ; derleme gömer (build.js → __MFSIM_TAKOZ),
 * modüler kopya dosyayı yoldan açar (js/mount-amc.js → veMntAmcGorsel).
 *
 * NEDEN CHROMIUM: SVG çizimin içindeki gömülü görüntüler ve yazı tipleriyle aynı
 * çizilsin, webp kodlayıcısı da onun içinde (tools/karsilama-webp.js'in yolu).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const KOK = path.join(__dirname, '..');
const HEDEF = path.join(KOK, 'assets', 'takoz', 'amc');
const ONBELLEK = path.join(KOK, '.takoz-gorsel');
const CDN = 'https://cdn.amcsa.es/images/families/';
const KATALOG = 'https://cdn.amcsa.es/downloads/catalog/cauchometal_en.pdf';
const CHROMIUM = process.env.MFSIM_CHROMIUM || undefined;

// Çizim: tipin anahtarı (js/mount-amc.js → TIP[].cizim) → sitedeki dosya.
const CIZIM = {
  '00': 'cono_tipo_00', '01': 'cono_tipo_01', '02': 'cono_tipo_02', '10': 'cono_tipo_10', '11': 'cono_tipo_11',
  '12': 'cono_tipo_12', '13': 'cono_tipo_13', '14-2': 'cono_tipo_14_2', '14-4': 'cono_tipo_14_4', '17': 'cono_tipo_17',
  '20': 'cono_tipo_20', '21-2': 'cono_tipo_21_2', '21-4': 'cono_tipo_21_4', '27': 'cono_tipo_27', '30': 'cono_tipo_30',
  '31': 'cono_tipo_31', '33': 'cono_tipo_33', '35': 'cono_tipo_35', '36': 'cono_tipo_36', '38': 'cono_tipo_38',
  '39': 'cono_tipo_39', '40': 'cono_tipo_40', '45': 'cono_tipo_45', '60': 'cono_tipo_60', '62': 'cono_tipo_62',
  '65': 'cono_tipo_65', '67': 'cono_tipo_67', '68': 'cono_tipo_68', '70': 'cono_tipo_70', '75': 'cono_tipo_75',
  '120-np': 'cono_tipo_120_NP', '121-ng': 'cono_tipo_121_ng', '121-np': 'cono_tipo_121_np', '141': 'cono_tipo_141',
  '50-m16x2': 'cono_tipo_50_2', '50-m16x15': 'cono_tipo_50_15', '51-m16x2': 'cono_tipo_51_2', '51-m16x15': 'cono_tipo_51_15',
  '100': 'cono_tipo_100', '200': 'cono_tipo_200', 'dsm-22': 'dsm_22', 'dsm-83': 'dsm_83', 'dsm-141': 'dsm_141'
};
// Hidrolik koniler — katalog s.35 (PDF'in 37. sayfası), panelin gövdesi [x0, üst, x1, alt] pt.
const HIDROLIK = {
  'hid-31': [43, 91, 291, 210], 'hid-32': [291, 91, 539, 210], 'hid-70': [43, 230, 291, 349],
  'hid-71': [291, 230, 539, 349], 'hid-72': [43, 369, 291, 488]
};
// Fotoğraf: ailenin ürün fotoğrafı (beyaz zemin) + uygulama fotoğrafları (araçta).
const FOTO = {
  'urun-masif': 'small/conos_solidos.jpg', 'urun-kesikli': 'small/Conos_con_alveolos.jpg',
  'urun-flansli': 'small/Cono_Base_Fijacion.jpg', 'urun-hidrolik': 'small/conos_hidraulicos.jpg',
  'urun-dsm': 'small/DSM_small.jpg',
  'uyg-masif-1': 'more/cono_solido1.jpg', 'uyg-masif-2': 'more/cono_solido2.jpg', 'uyg-masif-3': 'more/cono_solido3.jpg',
  'uyg-masif-4': 'more/cono_31.jpg', 'uyg-masif-5': 'more/cono31_02.jpg', 'uyg-masif-6': 'more/cono_33.jpg',
  'uyg-masif-7': 'more/cono_70.jpg', 'uyg-masif-8': 'more/Cono_mount0.jpg', 'uyg-masif-9': 'more/Cono_mount10.jpg',
  'uyg-kesikli-1': 'more/Cono_38.jpg', 'uyg-kesikli-2': 'more/Mount2.2.jpg', 'uyg-kesikli-3': 'more/alveol1.jpg',
  'uyg-kesikli-4': 'more/alveol2.jpg', 'uyg-kesikli-5': 'more/conos_alveolos_1.jpg', 'uyg-kesikli-6': 'more/conos_con_alveolos_1.jpg',
  'uyg-flansli-1': 'more/cono_con_base_fijacion.jpg', 'uyg-flansli-2': 'more/cono_con_base_fijacion2.jpg',
  'uyg-flansli-3': 'more/cono_con_base_fijacion3.jpg', 'uyg-flansli-4': 'more/cono_con_base_fijacion4.jpg',
  'uyg-flansli-5': 'more/cono_con_base_fijacion5.jpg', 'uyg-flansli-6': 'more/f10_be75e6c4-dc1e-40fb-bb9a-8b8cdb1a3d01.jpg'
};
const CIZIM_EN = 640;          // çizimin genişliği (px)
const FOTO_EN = 800;           // fotoğrafın uzun kenarı (px)
const KALITE = 0.82;

function listesi() {
  const L = [];
  Object.keys(CIZIM).forEach((k) => L.push({ ad: 'cizim-' + k, url: CDN + 'drawings/' + CIZIM[k] + '.svg', tur: 'svg', en: CIZIM_EN }));
  Object.keys(HIDROLIK).forEach((k) => L.push({ ad: 'cizim-' + k, url: KATALOG, tur: 'pdf', sayfa: 37, kutu: HIDROLIK[k], en: CIZIM_EN }));
  Object.keys(FOTO).forEach((k) => L.push({ ad: k, url: CDN + FOTO[k], tur: 'foto', en: FOTO_EN }));
  return L;
}

function indir(url) {
  fs.mkdirSync(ONBELLEK, { recursive: true });
  const yerel = path.join(ONBELLEK, url.replace(/^https?:\/\//, '').replace(/[^\w.-]+/g, '_'));
  if (!fs.existsSync(yerel)) execFileSync('curl', ['-sS', '-f', '--max-time', '180', '-L', '-o', yerel, url]);
  return yerel;
}

async function main() {
  const argv = process.argv.slice(2);
  const kuru = argv.includes('--kuru');
  const L = listesi();
  if (kuru) { L.forEach((x) => console.log(x.ad.padEnd(22), x.url)); return; }
  fs.mkdirSync(HEDEF, { recursive: true });
  const kunyeYol = path.join(HEDEF, 'kunye.json');
  const kunye = fs.existsSync(kunyeYol) ? JSON.parse(fs.readFileSync(kunyeYol, 'utf8')) : {};
  const { chromium } = require('playwright');
  const tarayici = await chromium.launch(CHROMIUM ? { executablePath: CHROMIUM } : {});
  const sayfa = await tarayici.newPage();
  await sayfa.setContent('<html><body style="margin:0"></body></html>');
  let yazilan = 0, atlanan = 0;
  for (const x of L) {
    let kaynakDosya, mime;
    try {
      if (x.tur === 'pdf') {
        const pdf = indir(x.url);
        const dpi = Math.round(x.en / ((x.kutu[2] - x.kutu[0]) / 72));
        const sc = dpi / 72, onek = path.join(ONBELLEK, x.ad);
        execFileSync('pdftoppm', ['-f', String(x.sayfa), '-l', String(x.sayfa), '-r', String(dpi),
          '-x', String(Math.round(x.kutu[0] * sc)), '-y', String(Math.round(x.kutu[1] * sc)),
          '-W', String(Math.round((x.kutu[2] - x.kutu[0]) * sc)), '-H', String(Math.round((x.kutu[3] - x.kutu[1]) * sc)),
          '-png', '-singlefile', pdf, onek]);
        kaynakDosya = onek + '.png'; mime = 'image/png';
      } else {
        kaynakDosya = indir(x.url);
        mime = x.tur === 'svg' ? 'image/svg+xml' : (/\.png$/i.test(x.url) ? 'image/png' : 'image/jpeg');
      }
    } catch (e) {
      console.warn('  atlandı ' + x.ad + ': ' + String(e.message).split('\n')[0]); atlanan++; continue;
    }
    const b64 = fs.readFileSync(kaynakDosya).toString('base64');
    const sonuc = await sayfa.evaluate(async ({ b64, mime, tur, en, kalite }) => {
      const im = new Image();
      im.src = 'data:' + mime + ';base64,' + b64;
      await im.decode();
      let w = im.naturalWidth, h = im.naturalHeight;
      if (tur === 'foto') { const s = Math.min(1, en / Math.max(w, h)); w = Math.round(w * s); h = Math.round(h * s); }
      else { const s = en / w; w = en; h = Math.round(h * s); }
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const g = c.getContext('2d');
      g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);                // sabit renk: çizimin kâğıdı (şeffaf SVG)
      g.drawImage(im, 0, 0, w, h);
      return { w, h, url: c.toDataURL('image/webp', kalite) };
    }, { b64, mime, tur: x.tur, en: x.en, kalite: KALITE });
    const buf = Buffer.from(sonuc.url.split(',')[1], 'base64');
    fs.writeFileSync(path.join(HEDEF, x.ad + '.webp'), buf);
    kunye[x.ad] = { kaynak: x.url + (x.tur === 'pdf' ? '#page=' + x.sayfa : ''), en: sonuc.w, boy: sonuc.h, bayt: buf.length };
    yazilan++;
  }
  await tarayici.close();
  const sirali = {};
  Object.keys(kunye).sort().forEach((k) => { sirali[k] = kunye[k]; });
  fs.writeFileSync(kunyeYol, JSON.stringify(sirali, null, 1) + '\n');
  const toplam = Object.values(sirali).reduce((t, k) => t + k.bayt, 0);
  console.log('yazılan ' + yazilan + ' · atlanan ' + atlanan + ' · klasör ' + (toplam / 1024).toFixed(0) + ' KB');
}

if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });
module.exports = { listesi, CIZIM, HIDROLIK, FOTO };
