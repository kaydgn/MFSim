#!/usr/bin/env node
/**
 * karsilama-secici.js — karşılama karelerinin SEÇİM TAHTASINI üretir
 *
 *   node tools/karsilama-secici.js [--cikti <yol>] [--genislik 1024] [--kalite 0.74]
 *
 * NİYE VAR: dosya adı ('karsilama-17.webp') hangi resmin hangisi olduğunu
 * söylemiyor. Kullanıcı bildirimi (2026-09-09): "hangi resim hangisi karar
 * ayırt edemiyorum." Üretilen tek HTML sayfası 28 kareyi numaralı, gruplanmış
 * ve büyütülebilir gösterir; tıklanan kare "kaldırılacak" işareti alır ve karar
 * sayfanın kendi deposuna (Artifact `db`) yazılır — Claude oradan okur.
 *
 * ÜRETİLEN SAYFA GİT'E DÂHİL DEĞİL: içine 28 kare gömülüyor (~3,5 MB) ve
 * klasör her değiştiğinde bayatlıyor. Kaynak üç parça — bu betik, yanındaki
 * `karsilama-secici.html` şablonu ve `karsilama-kunye.json` künyesi — git'te.
 *
 * NEDEN CHROMIUM: depoda webp ÇÖZÜCÜSÜ olan başka bir şey yok (ImageMagick,
 * sharp, PIL kurulu değil). Playwright'ın Chromium'u zaten E2E için gerekiyor.
 *
 * KÜNYE KAPISI: künyesi olmayan kare için betik DURUR. Sessizce boş başlıklı
 * bir kart üretmek, sayfanın tek işini (hangisi hangisi) bozardı.
 */

const fs = require('fs');
const path = require('path');

const KOK = path.join(__dirname, '..');
const KLASOR = path.join(KOK, 'assets/karsilama');
const KUNYE = path.join(__dirname, 'karsilama-kunye.json');
const SABLON = path.join(__dirname, 'karsilama-secici.html');
const CHROMIUM = process.env.MFSIM_CHROMIUM || undefined;

const CAPA = '/*__VERI__*/[]';   // şablondaki veri yuvası

function ayristir(argv) {
  const o = {
    cikti: path.join(KOK, 'karsilama-secici-uretilen.html'),
    genislik: 1024,
    kalite: 0.74
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--cikti') o.cikti = path.resolve(argv[++i]);
    else if (a === '--genislik') o.genislik = parseInt(argv[++i], 10);
    else if (a === '--kalite') o.kalite = parseFloat(argv[++i]);
    else if (a === '--help' || a === '-h') o.yardim = true;
    else throw new Error('bilinmeyen bayrak: ' + a);
  }
  if (!(o.genislik >= 320)) throw new Error('--genislik en az 320 olmalı');
  if (!(o.kalite > 0 && o.kalite <= 1)) throw new Error('--kalite 0–1 arası olmalı');
  return o;
}

async function main() {
  const o = ayristir(process.argv.slice(2));
  if (o.yardim) {
    console.log('Kullanım: node tools/karsilama-secici.js ' +
                '[--cikti <yol>] [--genislik 1024] [--kalite 0.74]');
    return;
  }

  const kunye = JSON.parse(fs.readFileSync(KUNYE, 'utf8')).kareler;
  const dosyalar = fs.readdirSync(KLASOR).filter((f) => f.endsWith('.webp')).sort();
  if (!dosyalar.length) throw new Error('assets/karsilama/ boş');

  const eksik = dosyalar.filter((f) => !kunye[/(\d+)/.exec(f)[1]]);
  if (eksik.length) {
    throw new Error('künyesi olmayan kare: ' + eksik.join(', ') +
                    '\n  → tools/karsilama-kunye.json içine başlık + grup yaz');
  }

  const { chromium } = require('playwright');
  const tarayici = await chromium.launch(CHROMIUM ? { executablePath: CHROMIUM } : {});
  const sayfa = await tarayici.newPage();
  await sayfa.goto('about:blank');

  const veri = [];
  try {
    for (const f of dosyalar) {
      const no = /(\d+)/.exec(f)[1];
      const b64 = fs.readFileSync(path.join(KLASOR, f)).toString('base64');
      const r = await sayfa.evaluate(async ({ b64, genislik, kalite }) => {
        const img = new Image();
        img.src = 'data:image/webp;base64,' + b64;
        await img.decode();
        const s = Math.min(1, genislik / img.naturalWidth);
        const c = document.createElement('canvas');
        c.width = Math.round(img.naturalWidth * s);
        c.height = Math.round(img.naturalHeight * s);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        return {
          w: img.naturalWidth, h: img.naturalHeight,
          url: c.toDataURL('image/jpeg', kalite)
        };
      }, { b64, genislik: o.genislik, kalite: o.kalite });

      veri.push({
        no, ad: f,
        grup: kunye[no].grup,
        baslik: kunye[no].baslik,
        es: kunye[no].es || '',
        w: r.w, h: r.h,
        kb: Math.round(fs.statSync(path.join(KLASOR, f)).size / 1024),
        src: r.url
      });
    }
  } finally {
    await tarayici.close();
  }

  const sablon = fs.readFileSync(SABLON, 'utf8');
  if (!sablon.includes(CAPA)) throw new Error('şablonda veri çapası yok: ' + CAPA);
  fs.writeFileSync(o.cikti, sablon.replace(CAPA, JSON.stringify(veri)));

  const gruplar = ['yelken', 'gemi', 'toren']
    .map((g) => g + '=' + veri.filter((v) => v.grup === g).length).join(' · ');
  console.log(`${veri.length} kare · ${gruplar}`);
  console.log(`${o.cikti} · ${(fs.statSync(o.cikti).size / 1024 / 1024).toFixed(2)} MB`);
}

main().catch((e) => { console.error('HATA:', e.message); process.exit(1); });
