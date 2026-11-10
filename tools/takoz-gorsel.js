#!/usr/bin/env node
/**
 * takoz-gorsel.js — takoz veritabanlarının GÖRSELLERİ (AMC Mecanocaucho® · Angst+Pfister APSOvib®)
 *
 *   node tools/takoz-gorsel.js            # indir (önbellek) + üret, iki üretici
 *   node tools/takoz-gorsel.js --ap       # yalnız Angst+Pfister (--amc: yalnız AMC)
 *   node tools/takoz-gorsel.js --kuru     # yalnız listeyi ve hedefleri yaz
 *
 * ANGST+PFISTER (2026-11-10): tipin e-mağaza fotoğrafı (apsoparts.com, 500 px) ve
 * ölçülü çizimi — konik yatak, marine ve jeneratör yatağı genel katalogun (2017)
 * sayfasından kırpılır (çizimin vektör nesnelerinin kutusu + 6 pt pay), H-takozun
 * üç şekli föyün (2018) 2. sayfasındaki görüntülerden. Çıktı assets/takoz/ap/.
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
const HEDEF_AP = path.join(KOK, 'assets', 'takoz', 'ap');
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
// ── Angst+Pfister ──────────────────────────────────────────────────────────
const AP_KATALOG = 'https://www.angst-pfister.com/dam/jcr:30dd96db-9069-46e5-a91e-42e6c9991de9/APSOvib-Antivibration-Technology-General-Catalogue-EN_comp1.pdf';
const AP_HFOY = 'https://www.apsoparts.com/media/downloads/asset//std.lang.all/s_/en/APSOvib%20H-Mounts_EN.pdf';
// Çizim (js/mount-ap.js → TIP[].çizim): katalog sayfası (s), kutu (k: x0, üst, x1, alt pt) — çizimin
// vektör nesneleri + ölçü yazıları (F etiketleri dâhil), sayfa çizgisi hariç, 6 pt pay — ve kutuya
// düşen metin bloğu sözcüklerinin örtüsü (m, beyaz). H-takoz: föyün 2. sayfasındaki şekil görüntüleri.
const AP_CIZIM = {
  'k-021': { s: 8, k: [51, 428, 318, 811], m: [[243.9, 428.1, 275.2, 436.1], [274.9, 428.1, 292.8, 436.1], [292.7, 428.1, 311.5, 436.1], [311.4, 428.1, 333.9, 436.1]] },
  'k-021-s1': { s: 9, k: [59, 475, 339, 812], m: [[132.5, 484.9, 137.8, 494.6], [243.9, 484.5, 275.2, 492.5], [274.9, 484.5, 292.8, 492.5], [292.7, 484.5, 311.5, 492.5], [311.4, 484.5, 333.9, 492.5], [243.9, 475.8, 272, 483.8], [272.2, 475.8, 281.5, 483.8]] },
  'k-025': { s: 10, k: [51, 430, 309, 812], m: [[243.9, 428.1, 275.2, 436.1], [274.9, 428.1, 292.8, 436.1], [292.7, 428.1, 311.5, 436.1]] },
  'k-025-s1': { s: 11, k: [62, 475, 317, 812], m: [[243.9, 475.8, 272, 483.8], [272.2, 475.8, 281.5, 483.8], [243.9, 484.5, 275.2, 492.5], [274.9, 484.5, 292.8, 492.5], [292.7, 484.5, 311.5, 492.5], [311.4, 484.5, 333.9, 492.5]] },
  'k-026-s1': { s: 12, k: [52, 459, 339, 809], m: [[243.9, 456.2, 272, 464.2], [272.2, 456.2, 281.5, 464.2], [243.9, 464.9, 275.2, 472.9], [274.9, 464.9, 292.8, 472.9], [292.7, 464.9, 311.5, 472.9], [311.4, 464.9, 333.9, 472.9]] },
  'k-026-s3': { s: 13, k: [49, 475, 339, 811], m: [[243.9, 475.8, 272, 483.8], [272.2, 475.8, 281.5, 483.8], [243.9, 484.5, 275.2, 492.5], [274.9, 484.5, 292.8, 492.5], [292.7, 484.5, 311.5, 492.5], [311.4, 484.5, 333.9, 492.5], [136.3, 485.3, 141.6, 495.2]] },
  'k-027-s5': { s: 14, k: [47, 427, 318, 812], m: [[243.9, 428.1, 275.2, 436.1], [274.9, 428.1, 292.8, 436.1], [292.7, 428.1, 311.5, 436.1], [311.4, 428.1, 333.9, 436.1]] },
  'k-030': { s: 15, k: [45, 430, 326, 810], m: [[243.9, 428.1, 275.2, 436.1], [274.9, 428.1, 292.8, 436.1], [292.7, 428.1, 311.5, 436.1], [311.4, 428.1, 333.9, 436.1]] },
  'k-05719': { s: 16, k: [39, 426, 315, 812], m: [[243.9, 419.4, 272, 427.4], [272.2, 419.4, 281.5, 427.4], [243.9, 428.1, 275.2, 436.1], [274.9, 428.1, 292.8, 436.1], [292.7, 428.1, 311.5, 436.1], [311.4, 428.1, 333.9, 436.1]] },
  'k-hd-1': { s: 17, k: [56, 466, 326, 807], m: [[243.9, 466.1, 273.3, 474.1], [273, 466.1, 276.9, 474.1], [276.6, 466.1, 294.5, 474.1], [294.4, 466.1, 313.2, 474.1], [313.1, 466.1, 335.6, 474.1]] },
  'k-hd-2': { s: 18, k: [52, 428, 326, 801], m: [[243.9, 428.1, 273.3, 436.1], [273, 428.1, 276.9, 436.1], [276.6, 428.1, 294.5, 436.1], [294.4, 428.1, 313.2, 436.1], [313.1, 428.1, 335.6, 436.1]] },
  'm-1': { s: 20, k: [40, 446, 230, 670] },
  'm-2': { s: 21, k: [40, 466, 230, 676] },
  'm-3': { s: 22, k: [40, 446, 230, 669] },
  'g-1': { s: 23, k: [39, 452, 230, 743] },
  'g-2': { s: 24, k: [40, 451, 230, 711] },
  'h-1': { b: AP_HFOY, s: 2, k: [45, 451, 177, 589], en: 300 }, 'h-2': { b: AP_HFOY, s: 2, k: [204, 451, 338, 589], en: 300 },
  'h-3': { b: AP_HFOY, s: 2, k: [365, 451, 483, 589], en: 300 }
};
// Fotoğraf: tip → e-mağazanın görsel numarası (js/mount-ap.js → TIP[].foto).
function apFotoUrl(no) { return 'https://www.apsoparts.com/media/catalog/product/std.lang.all/' + no.slice(2, 4) + '/' + no.slice(4, 6) + '/' + no + '.jpg'; }
function listesiAp() {
  const P = require('../js/mount-ap.js'), L = [];
  const ciz = new Set(Object.keys(P.TIP).map((t) => P.TIP[t][3]));
  [...ciz].forEach((c) => { const z = AP_CIZIM[c]; L.push({ ad: 'cizim-' + c, url: z.b || AP_KATALOG, tur: 'pdf', sayfa: z.s, kutu: z.k, maske: z.m || [], en: z.en || CIZIM_EN, hedef: HEDEF_AP }); });
  Object.keys(P.TIP).forEach((t) => L.push({ ad: 'urun-' + t, url: apFotoUrl(P.TIP[t][4]), tur: 'foto', en: FOTO_EN, hedef: HEDEF_AP }));
  return L;
}
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
  const L = (argv.includes('--ap') ? [] : listesi().map((x) => Object.assign({ hedef: HEDEF }, x)))
    .concat(argv.includes('--amc') ? [] : listesiAp());
  if (kuru) { L.forEach((x) => console.log(x.ad.padEnd(22), x.url)); return; }
  const kunyeler = {};
  const kunyeAl = (h) => {
    if (!kunyeler[h]) { fs.mkdirSync(h, { recursive: true }); const y = path.join(h, 'kunye.json'); kunyeler[h] = fs.existsSync(y) ? JSON.parse(fs.readFileSync(y, 'utf8')) : {}; }
    return kunyeler[h];
  };
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
    const sonuc = await sayfa.evaluate(async ({ b64, mime, tur, en, kalite, kutu, maske }) => {
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
      if (kutu && maske && maske.length) {                         // metin bloğunun kutuya düşen sözcükleri
        const f = w / (kutu[2] - kutu[0]);
        g.fillStyle = '#fff';                                       // sabit renk: çizimin kâğıdı
        maske.forEach((r) => g.fillRect((r[0] - kutu[0]) * f, (r[1] - kutu[1]) * f, (r[2] - r[0]) * f, (r[3] - r[1]) * f));
      }
      return { w, h, url: c.toDataURL('image/webp', kalite) };
    }, { b64, mime, tur: x.tur, en: x.en, kalite: KALITE, kutu: x.kutu || null, maske: x.maske || null });
    const buf = Buffer.from(sonuc.url.split(',')[1], 'base64');
    const ku = kunyeAl(x.hedef);
    fs.writeFileSync(path.join(x.hedef, x.ad + '.webp'), buf);
    ku[x.ad] = { kaynak: x.url + (x.tur === 'pdf' ? '#page=' + x.sayfa : ''), en: sonuc.w, boy: sonuc.h, bayt: buf.length };
    yazilan++;
  }
  await tarayici.close();
  Object.keys(kunyeler).forEach((h) => {
    const kunye = kunyeler[h], sirali = {};
    Object.keys(kunye).sort().forEach((k) => { sirali[k] = kunye[k]; });
    fs.writeFileSync(path.join(h, 'kunye.json'), JSON.stringify(sirali, null, 1) + '\n');
    const toplam = Object.values(sirali).reduce((t, k) => t + k.bayt, 0);
    console.log(path.relative(KOK, h) + ': klasör ' + (toplam / 1024).toFixed(0) + ' KB');
  });
  console.log('yazılan ' + yazilan + ' · atlanan ' + atlanan);
}

if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });
module.exports = { listesi, listesiAp, CIZIM, HIDROLIK, FOTO, AP_CIZIM };
