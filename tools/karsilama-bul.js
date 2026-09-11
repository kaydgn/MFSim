#!/usr/bin/env node
/**
 * karsilama-bul.js — karşılama slaytı için ADAY KARE TARAYICISI
 *
 *   node tools/karsilama-bul.js [--limit 8] [--en-az-genislik 1600] [--cikti <dizin>]
 *
 * NEDEN COMMONS — sebep TEKNİK, lisans değil (lisans kararı aşağıda):
 * indirilebilir tek toplu kaynak burası. Arama motorundan gelen sonuçların
 * çoğu haber sitesine bakıyor ve oralar bot isteğini ya engelliyor ya da
 * sıcak bağlantıyı kesiyor; ölçü ve künye de sayfadan kazınmak zorunda
 * kalıyor. Commons ise her dosyanın ÖLÇÜSÜNÜ, türünü ve künyesini makine
 * okunur veriyle (`extmetadata`) veriyor ve 1920 px'lik türevi hazır sunuyor —
 * yani çözünürlük süzgeci indirmeden ÖNCE uygulanabiliyor.
 *
 * LİSANS VARSAYILAN OLARAK SÜZGEÇ DEĞİL, KÜNYEDİR. Kullanıcı kararı
 * (2026-09-11): "Lisans problemini dert etme, GitHub Pages'te yayınlanmıyor ve
 * sadece ben kullanıyorum." Bu yüzden her adayın lisansı, sahibi ve kaynak
 * sayfası KAYDEDİLİR ama eleme yapmaz — bilgi kaybolmaz, karar kullanıcıda.
 * Dağıtım bir gün yeniden yayına dönerse `--lisans-suzgeci` bayrağı eski
 * davranışı geri getirir (yalnız yeniden yayına + türeve izin verenler geçer).
 *
 * ÇÖZÜNÜRLÜK SÜZGECİ: varsayılan en az 1600 px. Slayt 1920 px'lik ekranda tam
 * ekran oynuyor; daha küçük kare büyütülerek gösterilir ve yumuşak durur
 * (ölçüldü: klasörün en yumuşak kareleri 1015–1024 px'lik olanlar, ×1,88).
 *
 * ÇIKTI: `<dizin>/<kimlik>.jpg` (Commons'ın 1920 px'lik türevi) + `kunye.json`.
 * Depoya HİÇBİR ŞEY yazmaz — seçimi kullanıcı yapar, ekleme
 * `tools/karsilama-webp.js` ile ayrı bir adımdır.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const API = 'https://commons.wikimedia.org/w/api.php';
// Wikimedia politikası tanımlanabilir bir User-Agent istiyor.
const UA = 'MFSim-karsilama-scout/1.0 (https://github.com/kaydgn/MFSim)';

// Aramalar — klasördeki karelerin konusuyla aynı: donanma, harp okulu, tören.
const ARAMALAR = [
  // Donanma — gemi ve seyir
  'Turkish Naval Forces', 'Turkish Navy ship', 'Turkish Navy frigate',
  'Turkish Navy corvette', 'Turkish Navy submarine', 'TCG Anadolu',
  'TCG Istanbul frigate', 'Ada class corvette', 'Turkish Navy destroyer',
  'Turkish Navy fleet review', 'Istanbul Bosphorus warship',
  'Turkish Navy replenishment ship', 'Reis class submarine',
  // Harp okulu · tören · geçit
  'Turkish Naval Academy', 'Turkish Military Academy cadets',
  'Turkish Armed Forces parade', 'Turkish Army ceremony',
  'Turkish military graduation ceremony', 'Turkish Air Force Academy',
  'Republic Day parade Turkey', 'Turkish military band',
  'Turkish naval officers uniform', 'Turkish Navy honour guard',
  // Yelken (klasördeki altı kare bu konuda)
  'sailing regatta Bosphorus', 'Turkey sailing yacht race',
];

// İzinli lisanslar. Yalnız YENİDEN YAYINA ve TÜREVE izin verenler.
const IZINLI = /^(public domain|cc0|cc[ -]by([ -]sa)?([ -]\d(\.\d)?)?|attribution)/i;
// Açık redler — ad içinde geçmesi yeterli.
const YASAK = /(\bnc\b|noncommercial|non-commercial|\bnd\b|noderiv|fair use|non-free|copyright)/i;

function istek(url) {
  return new Promise((coz, red) => {
    https.get(url, { headers: { 'User-Agent': UA } }, (r) => {
      if (r.statusCode !== 200) { r.resume(); return red(new Error('HTTP ' + r.statusCode)); }
      const p = [];
      r.on('data', (c) => p.push(c));
      r.on('end', () => coz(Buffer.concat(p)));
    }).on('error', red);
  });
}

const bekle = (ms) => new Promise((r) => setTimeout(r, ms));

function ayristir(argv) {
  const o = {
    limit: 8,                       // arama başına aday
    enAzGenislik: 1600,
    cikti: path.join(__dirname, '..', '.karsilama-adaylar'),
    lisansSuzgeci: false          // bkz. üstteki lisans notu
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--limit') o.limit = parseInt(argv[++i], 10);
    else if (a === '--en-az-genislik') o.enAzGenislik = parseInt(argv[++i], 10);
    else if (a === '--cikti') o.cikti = path.resolve(argv[++i]);
    else if (a === '--lisans-suzgeci') o.lisansSuzgeci = true;
    else if (a === '--help' || a === '-h') o.yardim = true;
    else throw new Error('bilinmeyen bayrak: ' + a);
  }
  return o;
}

function lisansTemiz(em) {
  const al = (k) => ((em[k] || {}).value || '').toString();
  const kisa = al('LicenseShortName');
  const uzun = al('UsageTerms');
  const birlesik = kisa + ' ' + uzun + ' ' + al('License');
  if (!kisa.trim()) return { tamam: false, sebep: 'lisans boş' };
  if (YASAK.test(birlesik)) return { tamam: false, sebep: 'NC/ND/serbest değil: ' + kisa };
  if (!IZINLI.test(kisa.trim())) return { tamam: false, sebep: 'tanınmayan lisans: ' + kisa };
  return { tamam: true, kisa: kisa.trim() };
}

// extmetadata alanları HTML taşıyabiliyor (Artist bir <div>'in içinde gelir).
function metin(em, k) {
  const v = ((em[k] || {}).value || '').toString();
  return v.replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"')
          .replace(/&#0?39;/g, "'").replace(/\s+/g, ' ').trim();
}

async function main() {
  const o = ayristir(process.argv.slice(2));
  if (o.yardim) {
    console.log('Kullanım: node tools/karsilama-bul.js ' +
                '[--limit 8] [--en-az-genislik 1600] [--cikti <dizin>]');
    return;
  }
  fs.mkdirSync(o.cikti, { recursive: true });

  const gorulen = new Set();
  const adaylar = [];
  const red = { lisans: 0, olcu: 0, tur: 0 };

  for (const arama of ARAMALAR) {
    const url = API + '?action=query&format=json&generator=search' +
      '&gsrsearch=' + encodeURIComponent(arama) +
      '&gsrnamespace=6&gsrlimit=' + o.limit +
      '&prop=imageinfo&iiprop=url%7Csize%7Cmime%7Cextmetadata&iiurlwidth=1920';
    let d;
    try { d = JSON.parse((await istek(url)).toString()); }
    catch (e) { console.error(`  ! "${arama}" sorgusu başarısız: ${e.message}`); continue; }

    const sayfalar = Object.values((d.query || {}).pages || {});
    let kabul = 0;
    for (const s of sayfalar) {
      const ii = (s.imageinfo || [])[0];
      if (!ii) continue;
      if (!/^image\/(jpeg|png)$/.test(ii.mime)) { red.tur++; continue; }
      if (ii.width < o.enAzGenislik) { red.olcu++; continue; }

      const em = ii.extmetadata || {};
      const lis = lisansTemiz(em);
      if (o.lisansSuzgeci && !lis.tamam) { red.lisans++; continue; }

      const kimlik = s.title.replace(/^File:/, '').replace(/\.[^.]+$/, '')
        .replace(/[^A-Za-z0-9]+/g, '-').slice(0, 60).replace(/^-|-$/g, '').toLowerCase();
      if (gorulen.has(kimlik)) continue;
      gorulen.add(kimlik);

      adaylar.push({
        kimlik, arama,
        baslik: s.title.replace(/^File:/, ''),
        w: ii.width, h: ii.height,
        indirmeUrl: ii.thumburl || ii.url,
        thumbW: ii.thumbwidth || ii.width,
        thumbH: ii.thumbheight || ii.height,
        sayfa: ii.descriptionurl,
        lisans: lis.kisa || metin(em, 'LicenseShortName') || 'bilinmiyor',
        lisansSerbest: lis.tamam,          // yeniden yayına + türeve izin veriyor mu
        lisansNot: lis.tamam ? '' : lis.sebep,
        sahip: metin(em, 'Artist') || '—',
        kaynak: metin(em, 'Credit') || '—',
        kisitlama: metin(em, 'Restrictions') || '',
        aciklama: metin(em, 'ImageDescription').slice(0, 300) || ''
      });
      kabul++;
    }
    console.log(`"${arama}" → ${kabul}/${sayfalar.length} aday`);
    await bekle(350);                       // Commons'a nazik ol
  }

  console.log(`\n${adaylar.length} aday · red: lisans ${red.lisans} · ` +
              `ölçü<${o.enAzGenislik}px ${red.olcu} · tür ${red.tur}`);

  let indi = 0;
  for (const a of adaylar) {
    const hedef = path.join(o.cikti, a.kimlik + '.jpg');
    try {
      const b = await istek(a.indirmeUrl);
      fs.writeFileSync(hedef, b);
      a.dosya = path.basename(hedef);
      a.kb = Math.round(b.length / 1024);
      indi++;
    } catch (e) {
      a.hata = e.message;
      console.error(`  ! ${a.kimlik} indirilemedi: ${e.message}`);
    }
    await bekle(120);
  }

  const kunye = adaylar.filter((a) => a.dosya);
  fs.writeFileSync(path.join(o.cikti, 'kunye.json'),
                   JSON.stringify({ tarandi: new Date().toISOString(), adaylar: kunye }, null, 1));
  console.log(`${indi} dosya indi → ${o.cikti}`);
  console.log('Lisans dağılımı: ' + Object.entries(
    kunye.reduce((t, a) => (t[a.lisans] = (t[a.lisans] || 0) + 1, t), {})
  ).map(([k, v]) => `${k}=${v}`).join(' · '));
}

main().catch((e) => { console.error('HATA:', e.message); process.exit(1); });
