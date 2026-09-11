#!/usr/bin/env node
/**
 * karsilama-webp.js — karşılama slaytına yeni kare ekleme aracı
 *
 * JPEG/PNG dosyalarını `assets/karsilama/` altına `karsilama-NN.webp` olarak
 * çevirir ve `js/karsilama-gorseller.js` listesine yazar.
 *
 *   node tools/karsilama-webp.js <dosya...> [--kalite 0.85] [--kuru]
 *
 * NEDEN CHROMIUM: depoda ImageMagick/sharp/PIL yok, Playwright'ın Chromium'u
 * var ve webp kodlayıcısı onun içinde. Bir kodlayıcı bağımlılığı eklemektense
 * zaten kurulu olanı kullanıyoruz (test/E2E için gereken tarayıcının aynısı).
 *
 * NUMARA VERİLMEZ, DEVAM EDİLİR: klasördeki en büyük numaranın ardından
 * sayılır. Silinen karelerin numarası BOŞ KALIR — 24 dosyayı yeniden
 * adlandırmak, kullanıcının ekranda öğrendiği numaraları geçersiz kılardı.
 *
 * UZUN KENAR TAVANI 1920 px: klasördeki kareler 1015–1920 px arasında duruyor.
 * Küçültme bir kez denendi (1280 px) ve GERİ ALINDI — görünür biçimde
 * bulanıklaştı; kullanıcı boyut için kaliteden ödün vermeme kararını verdi.
 * Bu yüzden tavan yalnız DAHA BÜYÜK dosyaları kırpar, küçüğü büyütmez.
 */

const fs = require('fs');
const path = require('path');

const KOK = path.join(__dirname, '..');
const KLASOR = path.join(KOK, 'assets/karsilama');
const LISTE = path.join(KOK, 'js/karsilama-gorseller.js');
const CHROMIUM = process.env.MFSIM_CHROMIUM || undefined;

const EN_BOY = 1920;            // uzun kenar tavanı
// İkisi de tests/unit/karsilama-slayt.test.js'teki tavanların KOPYASI; sayılar
// tests/unit/karsilama-secici.test.js ile bağlı (kopya sessizce ayrışmıştı:
// tavan 6,5 → 7,3 MB olurken bu dosya 6,5'te kalıp boşuna uyarıyordu).
const KARE_TAVAN = 1024 * 1024;
const TOPLAM_TAVAN = 14 * 1024 * 1024;

function ayristir(argv) {
  const o = { dosyalar: [], kalite: 0.85, kuru: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--kalite') o.kalite = parseFloat(argv[++i]);
    else if (a === '--kuru') o.kuru = true;
    else if (a === '--help' || a === '-h') o.yardim = true;
    else if (a.startsWith('--')) throw new Error('bilinmeyen bayrak: ' + a);
    else o.dosyalar.push(a);
  }
  if (!(o.kalite > 0 && o.kalite <= 1)) throw new Error('--kalite 0–1 arası olmalı');
  return o;
}

function sonrakiNumara() {
  const nolar = fs.readdirSync(KLASOR)
    .map((f) => /^karsilama-(\d+)\.webp$/.exec(f))
    .filter(Boolean)
    .map((m) => parseInt(m[1], 10));
  return (nolar.length ? Math.max(...nolar) : 0) + 1;
}

/** Listeyi klasörden YENİDEN üretir — elle sıralama tutulmaz, sıra zaten
 *  çalışma anında karıştırılıyor. */
function listeyiYaz(adlar) {
  const kaynak = fs.readFileSync(LISTE, 'utf8');
  const govde = adlar.map((a) => "  '" + a + "'").join(',\n');
  const yeni = kaynak.replace(
    /(var VE_KARSILAMA_GORSELLER = \[)[\s\S]*?(\n\];)/,
    (m, bas, son) => bas + '\n' + govde + son
  );
  if (yeni === kaynak) throw new Error('liste çapası tutmadı: ' + LISTE);
  fs.writeFileSync(LISTE, yeni);
}

async function main() {
  const o = ayristir(process.argv.slice(2));
  if (o.yardim || !o.dosyalar.length) {
    console.log('Kullanım: node tools/karsilama-webp.js <dosya...> [--kalite 0.85] [--kuru]');
    process.exit(o.yardim ? 0 : 1);
  }
  for (const d of o.dosyalar) {
    if (!fs.existsSync(d)) throw new Error('dosya yok: ' + d);
  }

  const { chromium } = require('playwright');
  const tarayici = await chromium.launch(CHROMIUM ? { executablePath: CHROMIUM } : {});
  const sayfa = await tarayici.newPage();
  await sayfa.goto('about:blank');

  let no = sonrakiNumara();
  const eklenen = [];
  try {
    for (const d of o.dosyalar) {
      const b64 = fs.readFileSync(d).toString('base64');
      const tur = /\.png$/i.test(d) ? 'image/png' : 'image/jpeg';
      const r = await sayfa.evaluate(async ({ b64, tur, kalite, enBoy }) => {
        const img = new Image();
        img.src = 'data:' + tur + ';base64,' + b64;
        await img.decode();
        const s = Math.min(1, enBoy / Math.max(img.naturalWidth, img.naturalHeight));
        const c = document.createElement('canvas');
        c.width = Math.round(img.naturalWidth * s);
        c.height = Math.round(img.naturalHeight * s);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        const url = c.toDataURL('image/webp', kalite);
        return { w: c.width, h: c.height, url, webp: url.startsWith('data:image/webp') };
      }, { b64, tur, kalite: o.kalite, enBoy: EN_BOY });

      if (!r.webp) throw new Error('tarayıcı webp kodlamadı: ' + d);

      const ad = 'karsilama-' + String(no).padStart(2, '0') + '.webp';
      const ham = Buffer.from(r.url.split(',')[1], 'base64');
      if (ham.length > KARE_TAVAN) {
        throw new Error(ad + ' kare tavanını aştı: ' +
          Math.round(ham.length / 1024) + ' KB > ' + KARE_TAVAN / 1024 + ' KB' +
          ' (--kalite ile düşür)');
      }
      if (!o.kuru) fs.writeFileSync(path.join(KLASOR, ad), ham);
      eklenen.push(ad);
      console.log(`${path.basename(d).padEnd(38)} → ${ad}  ${r.w}×${r.h}  ` +
                  `${Math.round(ham.length / 1024)} KB`);
      no++;
    }
  } finally {
    await tarayici.close();
  }

  if (o.kuru) { console.log('\n--kuru: hiçbir şey yazılmadı'); return; }

  const adlar = fs.readdirSync(KLASOR).filter((f) => f.endsWith('.webp')).sort();
  listeyiYaz(adlar);

  const toplam = adlar.reduce((t, a) => t + fs.statSync(path.join(KLASOR, a)).size, 0);
  console.log(`\n${eklenen.length} kare eklendi · klasör ${adlar.length} kare · ` +
              `${(toplam / 1024 / 1024).toFixed(2)} MB / ${TOPLAM_TAVAN / 1024 / 1024} MB tavan`);
  if (toplam > TOPLAM_TAVAN) {
    console.error('UYARI: klasör toplam tavanını aştı — npm test kırmızıya döner');
    process.exitCode = 1;
  }
}

main().catch((e) => { console.error('HATA:', e.message); process.exit(1); });
