#!/usr/bin/env node
/**
 * karsilama-aday-secici.js — ADAY kareler için seçim sayfası üretir
 *
 *   node tools/karsilama-aday-secici.js --adaylar <dizin> [--cikti <yol>]
 *
 * `tools/karsilama-bul.js`'in indirdiği adaylardan tek HTML sayfası kurar:
 * her aday numaralı, gruplanmış, büyütülebilir; tıklanan kare "eklenecek"
 * işareti alır ve seçim Artifact `db`'sine (`aday/secim`) yazılır — Claude
 * oradan okuyup `tools/karsilama-webp.js` ile klasöre ekler.
 *
 * KURULU KARE SEÇİCİSİYLE KARIŞTIRILMASIN (`karsilama-secici.*`): orası
 * klasörde OLAN kareden hangisinin KALKACAĞINI soruyor (kırmızı damga), burası
 * klasörde OLMAYAN adaydan hangisinin GİRECEĞİNİ (yeşil damga). Ayrı şablon,
 * ayrı db dokümanı, aynı tasarım sistemi.
 *
 * BU SAYFANIN KENDİNE ÖZGÜ BİLGİSİ KÜNYE: her kartta lisans, eserin sahibi ve
 * Commons dosya adı yazılı. Kullanıcı kararı (2026-09-11) lisansı bir kapı
 * olmaktan çıkardı ama bilgiyi ATMADI — karta yazılmazsa bir daha bulunamaz.
 *
 * BOYUT TAHMİN EDİLMEZ, ÖLÇÜLÜR: üreteç her adayı klasöre girecek kalitede
 * (`--webp-kalite`, varsayılan 0,85) webp'ye çevirip GERÇEK baytı karta yazar.
 * Bir katsayıyla tahmin etmek denendi ve bırakıldı — Commons'ın 1920 px'lik
 * türevleri mevcut karelerden ağır ve oran 0,48 ile 0,87 arasında geziyor, yani
 * tahmin kare başına 560 KB kapısının hangi tarafında durduğunu söyleyemiyor.
 * Sayfa bu yüzden kare başına tavanı AŞAN adayı da işaretliyor.
 */

const fs = require('fs');
const path = require('path');

const KOK = path.join(__dirname, '..');
const KLASOR = path.join(KOK, 'assets/karsilama');
const SABLON = path.join(__dirname, 'karsilama-aday-secici.html');
const CHROMIUM = process.env.MFSIM_CHROMIUM || undefined;

const CAPA_VERI = '/*__VERI__*/[]';
const CAPA_DURUM = '/*__DURUM__*/{ klasorKb: 0, kareSayisi: 0, tavanKb: 0, kareTavanKb: 0 }';
// İkisi de tests/unit/karsilama-slayt.test.js'teki tavanlarla aynı olmak zorunda.
const TAVAN_KB = 7.3 * 1024;
const KARE_TAVAN_KB = 560;

function ayristir(argv) {
  const o = {
    adaylar: path.join(KOK, '.karsilama-adaylar'),
    cikti: path.join(KOK, 'karsilama-aday-secici-uretilen.html'),
    genislik: 1024,
    kalite: 0.74,
    webpKalite: 0.85
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--adaylar') o.adaylar = path.resolve(argv[++i]);
    else if (a === '--cikti') o.cikti = path.resolve(argv[++i]);
    else if (a === '--genislik') o.genislik = parseInt(argv[++i], 10);
    else if (a === '--kalite') o.kalite = parseFloat(argv[++i]);
    else if (a === '--webp-kalite') o.webpKalite = parseFloat(argv[++i]);
    else if (a === '--help' || a === '-h') o.yardim = true;
    else throw new Error('bilinmeyen bayrak: ' + a);
  }
  return o;
}

async function main() {
  const o = ayristir(process.argv.slice(2));
  if (o.yardim) {
    console.log('Kullanım: node tools/karsilama-aday-secici.js --adaylar <dizin> [--cikti <yol>]');
    return;
  }

  // Üreteç `secilen.json`'u tercih eder (ayıklanmış küme); yoksa ham künye.
  const secilenYol = path.join(o.adaylar, 'secilen.json');
  const kunyeYol = path.join(o.adaylar, 'kunye.json');
  let liste;
  if (fs.existsSync(secilenYol)) {
    liste = JSON.parse(fs.readFileSync(secilenYol, 'utf8'));
  } else if (fs.existsSync(kunyeYol)) {
    liste = JSON.parse(fs.readFileSync(kunyeYol, 'utf8')).adaylar;
  } else {
    throw new Error('aday künyesi yok: ' + o.adaylar + ' (önce tools/karsilama-bul.js koş)');
  }
  if (!liste.length) throw new Error('aday listesi boş');

  const eksik = liste.filter((a) => !a.no || !a.grup || !a.baslik_tr);
  if (eksik.length) {
    throw new Error(eksik.length + ' adayda no/grup/baslik_tr eksik — ' +
                    'ayıklama adımı bunları yazmalı');
  }

  const { chromium } = require('playwright');
  const tarayici = await chromium.launch(CHROMIUM ? { executablePath: CHROMIUM } : {});
  const sayfa = await tarayici.newPage();
  await sayfa.goto('about:blank');

  const veri = [];
  try {
    for (const a of liste) {
      const yol = path.join(o.adaylar, a.dosya);
      if (!fs.existsSync(yol)) throw new Error('aday dosyası yok: ' + a.dosya);
      const b64 = fs.readFileSync(yol).toString('base64');
      const r = await sayfa.evaluate(async ({ b64, genislik, kalite, webpKalite }) => {
        const img = new Image();
        img.src = 'data:image/jpeg;base64,' + b64;
        await img.decode();
        const oku = (enBoy, tur, kal) => {
          const s = Math.min(1, enBoy / img.naturalWidth);
          const c = document.createElement('canvas');
          c.width = Math.round(img.naturalWidth * s);
          c.height = Math.round(img.naturalHeight * s);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          return { url: c.toDataURL(tur, kal), w: c.width, h: c.height };
        };
        const onizleme = oku(genislik, 'image/jpeg', kalite);
        // Klasöre girecek hâli: uzun kenar 1920 tavanı + webp (karsilama-webp.js
        // ile AYNI ayar) — boyut tahmin edilmesin, ölçülsün.
        const gercek = oku(1920, 'image/webp', webpKalite);
        return {
          onizleme: onizleme.url,
          webpKb: Math.round(gercek.url.split(',')[1].length * 0.75 / 1024),
          webpW: gercek.w, webpH: gercek.h,
          webpTamam: gercek.url.startsWith('data:image/webp')
        };
      }, { b64, genislik: o.genislik, kalite: o.kalite, webpKalite: o.webpKalite });
      if (!r.webpTamam) throw new Error('tarayıcı webp kodlamadı: ' + a.dosya);

      veri.push({
        no: a.no, grup: a.grup, baslik: a.baslik_tr,
        w: r.webpW, h: r.webpH, kb: r.webpKb,
        kaynakW: a.w, kaynakH: a.h,
        lisans: a.lisans || 'bilinmiyor',
        sahip: a.sahip || '—',
        commons: a.baslik,                 // Commons dosya adı
        sayfa: a.sayfa || '',
        src: r.onizleme
      });
    }
  } finally {
    await tarayici.close();
  }

  const kareler = fs.readdirSync(KLASOR).filter((f) => f.endsWith('.webp'));
  const klasorKb = Math.round(
    kareler.reduce((t, f) => t + fs.statSync(path.join(KLASOR, f)).size, 0) / 1024);

  let s = fs.readFileSync(SABLON, 'utf8');
  if (!s.includes(CAPA_VERI)) throw new Error('şablonda veri çapası yok');
  if (!s.includes(CAPA_DURUM)) throw new Error('şablonda durum çapası yok');
  s = s.replace(CAPA_VERI, JSON.stringify(veri));
  s = s.replace(CAPA_DURUM, JSON.stringify({
    klasorKb, kareSayisi: kareler.length,
    tavanKb: Math.round(TAVAN_KB), kareTavanKb: KARE_TAVAN_KB
  }));
  fs.writeFileSync(o.cikti, s);

  const gruplar = ['gemi', 'toren', 'yelken']
    .map((g) => g + '=' + veri.filter((v) => v.grup === g).length)
    .filter((x) => !/=0$/.test(x)).join(' · ');
  console.log(`${veri.length} aday · ${gruplar}`);
  console.log(`klasör ${kareler.length} kare / ${(klasorKb / 1024).toFixed(2)} MB · ` +
              `tavan ${(TAVAN_KB / 1024).toFixed(1)} MB`);
  const agir = veri.filter((v) => v.kb > KARE_TAVAN_KB);
  console.log(`webp ölçüsü: ${Math.min(...veri.map((v) => v.kb))}–` +
              `${Math.max(...veri.map((v) => v.kb))} KB` +
              (agir.length ? ` · ${agir.length} aday kare tavanını (${KARE_TAVAN_KB} KB) AŞIYOR: ` +
                agir.map((v) => v.no).join(' ') : ' · hepsi kare tavanının altında'));
  console.log(`${o.cikti} · ${(fs.statSync(o.cikti).size / 1024 / 1024).toFixed(2)} MB`);
}

main().catch((e) => { console.error('HATA:', e.message); process.exit(1); });
