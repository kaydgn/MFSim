#!/usr/bin/env node
'use strict';
/**
 * canli-not.js — CANLI NOT: programın üstüne çizilen değişiklik notları (2026-11-04)
 * ───────────────────────────────────────────────────────────────────────────
 * Kullanıcı isteği: *"programı bir arayüze alalım, açalım. Oraya buraya
 * girelim ve ben çizerek, yuvarlak içine alarak istediğim değişiklikleri canlı
 * olarak yazayım. Sen de bunları sırası ile uygula."*
 *
 *   node tools/canli-not.js hazirla [--cikti .canli-not/yayin] [--dal]
 *       Karesiz tek dosya (MFSIM_KARSILAMA=yok) + köprü <meta charset>'ın
 *       arkasında → mfsim.html; sayfa (canli-not.html) çekirdek ve künyeyle.
 *       YALNIZ ANA DALDAN: HEAD origin/main değilse ya da commit edilmemiş
 *       değişiklik varsa DURUR (--dal: yerel deneme, YAYINLANMAZ).
 *       İKİ SINIR: programın güncellemesi (varlık) 20 MB'a kadar gider; sayfanın
 *       gömdüğü kopya (sayfa yayını) 16 MB'a. Program 16 MB'ı aşarsa varlık yine
 *       hazırlanır, sayfa yayını UYARIYLA kapalı söylenir; 20 MB'ı aşarsa DURUR.
 *
 *   node tools/canli-not.js yayin --program <varlık kimliği> [--notlar 6,8-21]
 *                           [--kaynak <mfsim.html>] [--cikti <json>]
 *       PROGRAMIN GÜNCELLEMESİ — sayfa yeniden YAYINLANMAZ (kullanıcı
 *       2026-11-05: "artifaktı otomatik olarak yenileme … güncelleme
 *       geldiğinde uyarı popup çıkar"). `hazirla`nın mfsim-<sha>.txt'si varlık
 *       deposuna yüklenir; bu komut kaydın `yayin/son` belgesini yazar (künye ·
 *       varlık · uygulanan notlar). Açık sayfa sorar, Güncelle yükler.
 *
 *   node tools/canli-not.js denetle <yayin-son.json | yayındaki mfsim.html | yayındaki sayfa>
 *       Yayındaki programın künyesi ↔ origin/main: güncel · geride (kaç
 *       birleşme, programın girdileri değişti mi). Belge ArtifactData'dan
 *       (`get yayin son`, out_dir); belge yoksa sayfanın dosyası
 *       (`Artifact read url:<adres> path:mfsim.html`). SAYFANIN kendisi
 *       (`Artifact read url:<adres>`'in kaydettiği dosya) verilirse: bugünkü
 *       şablon ve çekirdekle aynı mı (ayar satırı hariç) — değilse sayfayı yayınla.
 *
 *   node tools/canli-not.js liste <döküm> [--hepsi]
 *       ArtifactData `list notlar` (out_dir) dökümündeki notlar sırayla;
 *       varsayılan yalnız işi kalanlar (bekliyor · uygulaniyor).
 *
 *   node tools/canli-not.js goruntu <not.json> [--foto <foto.json>]
 *                           [--cikti <png>] [--olcek 1] [--kirp] [--ogeler]
 *       Notun ekranı (DOM fotoğrafı) notun ekran ölçüsünde yeniden çizilir,
 *       kullanıcının çizimi kırmızı olarak üstüne konur. --kirp çizimin
 *       çevresini, --ogeler seçilen öğelerin kutularını (mavi kesikli) verir.
 *
 *   node tools/canli-not.js sonuc <N> [--modul takoz|fead|arac] [--ornek <anahtar>]
 *                           [--hazirlik <betik.js>] [--secici <css> | --alan x,y,g,y] [--pay 12]
 *                           [--ekran 1440x900] [--dosya MFSim_Code.html] [--cikti <png>]
 *       Uygulanan notun SONUÇ görüntüsü (2×): tek dosya (npm run build), file://,
 *       ağsız. Giriş, karşılama ve modüle giriş kendiliğinden; --ornek Takoz
 *       örneğini kurar; --hazirlik sayfada koşan async gövde (yüzeyi açar,
 *       `bekle(ms)` hazır); --secici o öğenin kutusu (+pay), --alan ekranın
 *       bir bölgesi (CSS px), ikisi de yoksa ekranın tamamı. Çıktı
 *       .canli-not/sonuc/not-N.png; CSS px ölçüsü `sonuc {g, y}` için.
 *
 * Protokol (açılış, yayın, sıra, durum, yanıt): skill `canli-not`.
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { spawnSync } = require('child_process');
const CN = require('./canli-not-cekirdek.js');

const KOK = path.join(__dirname, '..');
const SABLON = path.join(__dirname, 'canli-not.html');
const CEKIRDEK = path.join(__dirname, 'canli-not-cekirdek.js');
const KOPRU = path.join(__dirname, 'canli-not-kopru.js');
const CEKIRDEK_CAPA = '/*__CEKIRDEK__*/';
const AYAR_CAPA = '/*__AYAR__*/null';
// Artifact'in iki sınırı BİRBİRİNDEN BAĞIMSIZ (Canlı Not 103–110 sonrası: AMC görselleri
// programı 14,5 → 17,8 MB yaptı; tek 16 MB denetimi programın güncellemesini de durdurdu,
// oysa güncelleme varlık olarak gidiyor ve 17,8 MiB'lık metin varlığı kabul edildi):
//   SINIR          sayfa yayını — sayfanın `files` ile gömdüğü mfsim.html (sayfa ve her metin dosyası)
//   VARLIK_SINIRI  programın güncellemesi — varlık deposundaki metin kopyası
const SINIR = 16 * 1024 * 1024;
const VARLIK_SINIRI = 20 * 1024 * 1024;
// Boyutun hükmü: varlık yüklenebilir mi, sayfa gömebilir mi. SAF — hazirla'nın kararı ve testi.
function sinirHukmu(boyut) {
  return { varlik: boyut <= VARLIK_SINIRI, sayfa: boyut <= SINIR };
}
const VARSAYILAN_CIKTI = path.join(KOK, '.canli-not', 'yayin');

function ayristir(argv) {
  const ilk = argv[0] && !argv[0].startsWith('-') ? argv[0] : undefined;
  const o = { komut: ilk, konum: [] };
  for (let i = ilk ? 1 : 0; i < argv.length; i++) {
    const a = argv[i];
    const deger = () => { if (i + 1 >= argv.length) throw new Error(a + ' bir değer ister'); return argv[++i]; };
    if (a === '--cikti') o.cikti = path.resolve(deger());
    else if (a === '--program') o.program = deger();
    else if (a === '--notlar') o.notlar = notlarAyristir(deger());
    else if (a === '--kaynak') o.kaynak = path.resolve(deger());
    else if (a === '--foto') o.foto = path.resolve(deger());
    else if (a === '--olcek') o.olcek = Number(deger());
    else if (a === '--kirp') o.kirp = true;
    else if (a === '--ogeler') o.ogeler = true;
    else if (a === '--hepsi') o.hepsi = true;
    else if (a === '--dal') o.dal = true;
    else if (a === '--dosya') o.dosya = path.resolve(deger());
    else if (a === '--modul') o.modul = deger();
    else if (a === '--ornek') o.ornek = deger();
    else if (a === '--hazirlik') o.hazirlik = path.resolve(deger());
    else if (a === '--secici') o.secici = deger();
    else if (a === '--pay') o.pay = Number(deger());
    else if (a === '--ekran') o.ekran = ekranAyristir(deger());
    else if (a === '--alan') o.alan = alanAyristir(deger());
    else if (a === '--help' || a === '-h') o.yardim = true;
    else if (a.startsWith('--')) throw new Error('bilinmeyen bayrak: ' + a);
    else o.konum.push(a);
  }
  if (o.olcek !== undefined && !(o.olcek >= 1 && o.olcek <= 3)) throw new Error('--olcek 1–3 olmalı');
  if (o.modul !== undefined && !MODUL_GIRIS[o.modul]) throw new Error('--modul: ' + Object.keys(MODUL_GIRIS).join(' · '));
  if (o.ornek !== undefined && o.modul !== 'takoz') throw new Error('--ornek yalnız --modul takoz ile (Takoz örneği)');
  if (o.pay !== undefined && !(o.pay >= 0 && o.pay <= 200)) throw new Error('--pay 0–200 px olmalı');
  if (o.alan && o.secici) throw new Error('--alan ile --secici birlikte olmaz');
  return o;
}

function alanAyristir(s) {
  const p = String(s).split(',').map((x) => Number(x.trim()));
  if (p.length !== 4 || p.some((v) => !Number.isFinite(v)) || p[0] < 0 || p[1] < 0 || !(p[2] > 0 && p[3] > 0)) {
    throw new Error('--alan x,y,g,y olmalı (CSS px; örnek 0,0,520,220)');
  }
  return { x: p[0], y: p[1], width: p[2], height: p[3] };
}

function ekranAyristir(s) {
  const m = /^(\d{3,4})x(\d{3,4})$/.exec(String(s));
  if (!m) throw new Error('--ekran GxY olmalı (örnek 1440x900)');
  return { width: Number(m[1]), height: Number(m[2]) };
}

// Modüle giriş: kart tipi + açıcı (programın kendi işlevleri — adları
// canli-not.test.js → SONUÇ kaynağa karşı tutar).
const MODUL_GIRIS = {
  takoz: { tip: 'mount-analysis', ac: 'veMntOpenEditor' },
  fead: { tip: 'fead-analysis', ac: 'veFeadOpenEditor' },
  arac: { tip: 'arac-performans', ac: 'veAracOpenEditor' }
};

// "6,8-21" → [6, 8, 9, …, 21]; bozuk parça SESSİZCE düşmez.
function notlarAyristir(s) {
  const out = [];
  String(s).split(',').map((x) => x.trim()).filter(Boolean).forEach((p) => {
    const m = /^(\d+)(?:\s*[-–]\s*(\d+))?$/.exec(p);
    if (!m) throw new Error('--notlar: "' + p + '" okunamadı (örnek 6,8-21)');
    const a = Number(m[1]), b = m[2] ? Number(m[2]) : a;
    if (!(a > 0 && b >= a)) throw new Error('--notlar: "' + p + '" aralığı bozuk');
    for (let i = a; i <= b; i++) if (out.indexOf(i) < 0) out.push(i);
  });
  return out.sort((x, y) => x - y);
}

// ── yayın ──────────────────────────────────────────────────────────────────
// Köprü <meta charset>'ın ARKASINA girer: tarayıcı kodlamayı belgenin ilk
// 1024 baytında arar; önüne giren 15 KB'lık betik onu kör ediyordu (ölçüldü:
// "MFSim aÃ§Ä±lÄ±yor"). confirm/prompt çağrı anında arandığı için köprünün
// programın betiklerinden sonra kurulması bir şey kaybettirmez.
function kopruGom(html, kopru) {
  const bas = /<head(?:\s[^>]*)?>/i.exec(html);
  if (!bas) throw new Error('mfsim.html: <head> yok');
  const kapanis = html.indexOf('</head>', bas.index);
  const govdeHead = html.slice(bas.index, kapanis < 0 ? undefined : kapanis);
  const cs = /<meta\s+charset=["']?[\w-]+["']?\s*\/?>/i.exec(govdeHead);
  if (!cs) throw new Error('mfsim.html: <head> içinde <meta charset> yok');
  const yer = bas.index + cs.index + cs[0].length;
  if (yer > 1024) throw new Error('mfsim.html: <meta charset> ilk 1024 baytın dışında (' + yer + ')');
  const etiket = '<script>/* canli-not köprüsü */\n' + kopru.replace(/<\/script/gi, '<\\/script') + '\n</script>';
  return html.slice(0, yer) + etiket + html.slice(yer);
}

function sayfaKur(sablon, cekirdek, ayar) {
  if (sablon.indexOf(CEKIRDEK_CAPA) < 0) throw new Error('şablonda çekirdek çapası yok: ' + CEKIRDEK_CAPA);
  if (sablon.indexOf(AYAR_CAPA) < 0) throw new Error('şablonda ayar çapası yok: ' + AYAR_CAPA);
  const json = JSON.stringify(ayar).replace(/</g, '\\u003c');
  // Fonksiyon replacer: dizgedeki '$&' gibi diziler genişletilmesin (build.js ile aynı tuzak).
  return sablon
    .replace(CEKIRDEK_CAPA, () => cekirdek.replace(/<\/script/gi, '<\\/script'))
    .replace(AYAR_CAPA, () => json);
}

// ── güncellik ──────────────────────────────────────────────────────────────
// Yayınlanan program ANA DALIN kendisidir (kullanıcı 2026-11-05: "güncelliğinden
// emin olalım, öyle devam edelim"): kullanıcı programı Canlı Not'ta kullanıyor,
// eski kopyanın üstüne yazılan not boşa gider. Paketin girdileri build.js'in
// okuduğu her yol + Canlı Not'un kendi dosyaları; karşılama kareleri bu yayında
// yok. Liste build.js'e karşı testte bağlı (canli-not.test.js → GÜNCELLİK).
const GIRDILER = [
  'index.html', 'js', 'css', 'vendor', 'pwa/icon.svg', 'assets/examples', 'assets/degisiklik', 'assets/belge', 'assets/kilavuz',
  'assets/takoz',
  'programlar/kayit.json', 'build.js', 'build-shield.js', 'tools/version-info.js', 'tools/degisiklik-resim.js',
  'tools/karsilama-webp.js', 'tools/kilavuz-resim.js',
  'tools/canli-not.js', 'tools/canli-not.html', 'tools/canli-not-kopru.js', 'tools/canli-not-cekirdek.js'
];

function git(args) {
  const r = spawnSync('git', args, { cwd: KOK, encoding: 'utf8' });
  if (r.status !== 0) throw new Error('git ' + args.join(' ') + ': ' + String(r.stderr || '').trim());
  return String(r.stdout || '').trim();
}

// Ağ yoksa yereldeki origin/main'le sürer ve bunu söyler.
function anaDal() {
  const f = spawnSync('git', ['fetch', '-q', 'origin', 'main'], { cwd: KOK, encoding: 'utf8' });
  return { sha: git(['rev-parse', 'origin/main']), uyari: f.status === 0 ? '' : 'origin/main çekilemedi; yerel kopyayla karşılaştırıldı' };
}

function kunyeOku(html) {
  const m = /window\.__MFSIM_BUILD = (\{.*?\});\n/.exec(html);
  if (!m) throw new Error('dosyada sürüm künyesi yok (window.__MFSIM_BUILD)');
  return JSON.parse(m[1]);
}

// ── yayın kaydı (yayin/son) ────────────────────────────────────────────────
// Sayfa ile araç aynı doğrulamayı okur (CN.yayinDogrula): bozuk kayıt sayfada
// güncelleme sayılmaz, burada yazılmaz.
function yayinKaydi(kunye, program, notlar, zaman) {
  const y = {
    surum: kunye.shortSha || '', sha: kunye.sha || '', pr: kunye.prNumber || '',
    zaman: zaman || new Date().toISOString(),
    program: { id: String(program && program.id || ''), boyut: (program && program.boyut) || 0 },
    notlar: notlar || []
  };
  const h = CN.yayinDogrula(y);
  if (h.length) throw new Error('yayın kaydı bozuk: ' + h.join(' · '));
  return y;
}

// ArtifactData dökümü ({id, version, data}) ya da çıplak belge.
function yayinOku(j) {
  const d = j && j.data && typeof j.data === 'object' && 'surum' in j.data ? j.data : j;
  if (!d || typeof d.surum !== 'string') throw new Error('yayın belgesi değil (surum yok)');
  return { sha: d.sha || d.surum, shortSha: d.surum, prNumber: d.pr || '' };
}

function yayin(o) {
  if (!o.program) throw new Error('--program <varlık kimliği> gerekli (Artifact asset yüklemesinin id\'si)');
  const kaynak = o.kaynak || path.join(VARSAYILAN_CIKTI, 'mfsim.html');
  const kunye = kunyeOku(fs.readFileSync(kaynak, 'utf8'));
  const y = yayinKaydi(kunye, { id: o.program, boyut: fs.statSync(kaynak).size }, o.notlar || []);
  const cikti = o.cikti || path.join(path.dirname(kaynak), 'yayin-son.json');
  fs.writeFileSync(cikti, JSON.stringify(y, null, 2) + '\n');
  console.log('yayin/son · ' + y.surum + (y.pr ? ' · PR #' + y.pr : '') + ' · program ' + y.program.id +
    (y.notlar.length ? ' · Not ' + CN.noAraligi(y.notlar) : ''));
  console.log('  ' + (path.relative(KOK, cikti) || cikti));
  console.log('\nArtifactData set: collection=yayin doc_id=son data=<dosyanın içeriği>');
  return y;
}

// Saf hüküm: yayındaki sha ↔ ana dal, aradaki birleşmeler, değişen girdiler.
// degisen null = yayındaki commit yerel geçmişte yok (sığ klon) → yeniden yayınla.
function guncellikHukmu(yayin, anaSha, birlesmeler, degisen) {
  if (yayin === anaSha) return { durum: 'guncel', yayinla: false };
  if (degisen === null) return { durum: 'bilinmiyor', yayinla: true, birlesmeler: birlesmeler || [] };
  return { durum: degisen.length ? 'program' : 'kunye', yayinla: degisen.length > 0, birlesmeler: birlesmeler, degisen: degisen };
}

// Yayındaki SAYFA bugünkü kaynaktan mı: şablon + çekirdek, ayar satırı (sürüm ·
// zaman · boyut) hariç bayt bayt. Sayfanın kendi künyesi ayardan okunur.
const SAYFA_AYAR_YERI = '__CANLI_NOT_AYAR__';
function sayfaHukmu(metin, sablon, cekirdek) {
  const m = /var AYAR = (\{[^\n]*?\}) \|\| \{\};/.exec(metin);
  let ayar = null;
  try { ayar = m ? JSON.parse(m[1]) : null; } catch (e) { ayar = null; }
  const kur = sayfaKur(sablon, cekirdek, SAYFA_AYAR_YERI), j = kur.indexOf('"' + SAYFA_AYAR_YERI + '"');
  const on = kur.slice(0, j), arka = kur.slice(j + SAYFA_AYAR_YERI.length + 2);
  const a = metin.indexOf(on), b = a < 0 ? -1 : metin.indexOf(arka, a + on.length);
  let guncel = a >= 0 && b >= 0;
  if (guncel) { try { JSON.parse(metin.slice(a + on.length, b)); } catch (e) { guncel = false; } }
  return { guncel: guncel, ayar: ayar };
}

function denetle(o) {
  if (!o.konum[0]) throw new Error('yayin/son belgesi, yayındaki mfsim.html ya da yayındaki sayfa gerekli');
  const dosya = path.resolve(o.konum[0]), metin = fs.readFileSync(dosya, 'utf8');
  if (/<title>MFSim Canlı Not<\/title>/.test(metin) && metin.indexOf('window.__MFSIM_BUILD') < 0) {
    const h = sayfaHukmu(metin, fs.readFileSync(SABLON, 'utf8'), fs.readFileSync(CEKIRDEK, 'utf8'));
    const kunye = h.ayar && h.ayar.surum ? h.ayar.surum + (h.ayar.pr ? ' · PR #' + h.ayar.pr : '') : '?';
    console.log(h.guncel ? 'Sayfa güncel · yayındaki sayfa bugünkü kaynakla aynı (yayın ' + kunye + ')'
      : 'Sayfa ESKİ · yayındaki sayfa (' + kunye + ') bugünkü kaynaktan farklı → sayfayı yeniden yayınla (skill §1)');
    return h;
  }
  const k = /\.json$/i.test(dosya) ? yayinOku(JSON.parse(metin)) : kunyeOku(metin);
  const ana = anaDal();
  let birlesmeler = [], degisen = null;
  try {
    birlesmeler = git(['log', '--first-parent', '--format=%h %s', k.sha + '..' + ana.sha]).split('\n').filter(Boolean);
    degisen = git(['diff', '--name-only', k.sha, ana.sha, '--'].concat(GIRDILER)).split('\n').filter(Boolean);
  } catch (e) { degisen = null; }
  const h = guncellikHukmu(k.sha, ana.sha, birlesmeler, degisen);
  const yayinda = k.shortSha + (k.prNumber ? ' · PR #' + k.prNumber : '');
  if (ana.uyari) console.log('! ' + ana.uyari);
  if (h.durum === 'guncel') console.log('Güncel · yayında ' + yayinda + ' = origin/main');
  else {
    console.log('ESKİ · yayında ' + yayinda + ', origin/main ' + ana.sha.slice(0, 7) + ' · ' + h.birlesmeler.length + ' commit geride');
    h.birlesmeler.slice(0, 12).forEach((b) => console.log('    ' + b));
    if (h.durum === 'bilinmiyor') console.log('Yayındaki commit yerel geçmişte yok → programı güncelle.');
    else if (h.durum === 'program') console.log('Programın girdileri değişti (' + h.degisen.length + ' dosya) → programı güncelle.');
    else console.log('Programın girdileri aynı; yalnız künye eski.');
  }
  return h;
}

function hazirla(o) {
  const cikti = o.cikti || VARSAYILAN_CIKTI;
  const env = Object.assign({}, process.env, { MFSIM_BUILD_OUT: path.join(cikti, 'mfsim.html'), MFSIM_KARSILAMA: 'yok' });
  if (!o.dal) {
    const ana = anaDal();
    const head = git(['rev-parse', 'HEAD']);
    if (head !== ana.sha) {
      throw new Error('HEAD ' + head.slice(0, 7) + ' ana dal değil (origin/main ' + ana.sha.slice(0, 7) + '). ' +
        'Yayın ana dalın kendisidir:\n  git fetch origin main && git checkout -B main origin/main');
    }
    if (git(['status', '--porcelain', '--untracked-files=no'])) {
      throw new Error('commit edilmemiş değişiklik var; yayın commit edilmiş ana daldan kurulur');
    }
    if (ana.uyari) console.log('! ' + ana.uyari);
    env.GITHUB_REF_NAME = 'main';   // künyenin dalı: HEAD origin/main'in kendisi
  }
  fs.mkdirSync(cikti, { recursive: true });
  const mfsim = env.MFSIM_BUILD_OUT;
  const r = spawnSync(process.execPath, [path.join(KOK, 'build.js')], { cwd: KOK, encoding: 'utf8', env: env });
  if (r.status !== 0) throw new Error('build.js durdu:\n' + ((r.stdout || '') + (r.stderr || '')).slice(-3000));
  const html = kopruGom(fs.readFileSync(mfsim, 'utf8'), fs.readFileSync(KOPRU, 'utf8'));
  fs.writeFileSync(mfsim, html);
  const boyut = Buffer.byteLength(html);
  const hukum = sinirHukmu(boyut);
  if (!hukum.varlik) {
    throw new Error('mfsim.html ' + (boyut / 1048576).toFixed(2) + ' MB — Artifact metin varlığı sınırı 20 MB. ' +
      'Büyüyen parçayı bulun (build çıktısı gömülenleri sayıyor).');
  }
  const kunye = require('./version-info.js').collect({ cwd: KOK, source: 'embedded', env: env });
  const ayar = { surum: kunye.shortSha || '', pr: kunye.prNumber || '', zaman: new Date().toISOString(), boyut: boyut };
  // Varlık deposunun kopyası: metin (text/plain) — depo HTML belgesi almaz,
  // sayfa metni okuyup çerçeveye koyar. Eski kopyalar silinir.
  fs.readdirSync(cikti).filter((f) => /^mfsim-[0-9a-f]+\.txt$/.test(f)).forEach((f) => fs.unlinkSync(path.join(cikti, f)));
  const varlik = path.join(cikti, 'mfsim-' + (ayar.surum || 'yerel') + '.txt');
  fs.writeFileSync(varlik, html);
  const sayfa = sayfaKur(fs.readFileSync(SABLON, 'utf8'), fs.readFileSync(CEKIRDEK, 'utf8'), ayar);
  const sayfaYol = path.join(cikti, 'canli-not.html');
  fs.writeFileSync(sayfaYol, sayfa);
  const goreli = (p) => path.relative(KOK, p) || p;
  console.log('Canlı Not yayını hazır · ' + (ayar.surum || '(git yok)') + (ayar.pr ? ' · PR #' + ayar.pr : '') +
    (o.dal ? ' · DAL KURULUMU — YAYINLANMAZ' : ' · ana dal'));
  console.log('  sayfa   ' + goreli(sayfaYol) + ' (' + (Buffer.byteLength(sayfa) / 1024).toFixed(1) + ' KB)');
  console.log('  program ' + goreli(mfsim) + ' (' + (boyut / 1048576).toFixed(2) + ' MB · sayfa sınırı 16 MB' +
    (hukum.sayfa ? '' : ' AŞILDI') + ' · varlık sınırı 20 MB)');
  console.log('  varlık  ' + goreli(varlik));
  if (!hukum.sayfa) {
    console.log('! Program 16 MB\'ı aşıyor: sayfa bu programı gömemez. Yalnız programın güncellemesi (varlık) ' +
      'yapılır; sayfa değişirse gömülü kopya küçültülmeden sayfa yayınlanamaz.');
  }
  console.log('\nProgramın güncellemesi (sayfa yenilenmez): Artifact publish url:<adres> asset:true file_path=' + goreli(varlik) +
    '\n  → node tools/canli-not.js yayin --program <id> --notlar <…>  → ArtifactData set yayin/son');
  console.log('Sayfanın yayını (yalnız sayfa değiştiyse): ' + (hukum.sayfa
    ? 'file_path=' + goreli(sayfaYol) + '  files={"mfsim.html": "' + goreli(mfsim) + '"}'
    : 'YAPILAMAZ (program 16 MB\'ı aşıyor)'));
  return { sayfa: sayfaYol, mfsim: mfsim, varlik: varlik, boyut: boyut, ayar: ayar, hukum: hukum };
}

// ── notlar ─────────────────────────────────────────────────────────────────
// ArtifactData'nın out_dir dökümü belgeyi {id, version, data} sarmalıyla ya da
// çıplak yazabilir; ikisi de okunur.
function govde(j) {
  if (j && j.data && typeof j.data === 'object' && !Array.isArray(j.data) && ('metin' in j.data || 'no' in j.data)) {
    const d = Object.assign({}, j.data);
    if (j.id && !d.id) d.id = j.id;
    if (j.version !== undefined) d.__surum = j.version;
    return d;
  }
  return j;
}

function notlariOku(dizin) {
  const yer = fs.existsSync(path.join(dizin, 'notlar')) ? path.join(dizin, 'notlar') : dizin;
  return fs.readdirSync(yer).filter((f) => f.endsWith('.json')).map((f) => {
    const d = govde(JSON.parse(fs.readFileSync(path.join(yer, f), 'utf8')));
    if (!d.id) d.id = path.basename(f, '.json');
    d.__dosya = path.join(yer, f);
    return d;
  });
}

function listeSatiri(n) {
  const ilk = String(n.metin || '').split('\n')[0];
  const foto = n.foto && n.foto.id ? 'foto ' + n.foto.id : 'foto ' + (n.fotoDurum || 'yok');
  return '#' + n.no + '  ' + (CN.DURUMLAR[n.durum] || n.durum) + '  ' + (n.yer || '—') + '\n' +
    '    ' + (ilk.length > 100 ? ilk.slice(0, 99) + '…' : ilk) + (n.yanit ? '\n    yanıt: ' + n.yanit : '') + '\n' +
    '    ' + n.id + ' · ' + foto + (n.sonuc && n.sonuc.foto ? ' · sonuç ' + n.sonuc.foto : '') +
    (n.konu ? ' · konu ' + n.konu : '') + (n.__surum !== undefined ? ' · v' + n.__surum : '');
}

function liste(o) {
  if (!o.konum[0]) throw new Error('döküm dizini gerekli');
  const hepsi = CN.siraliNotlar(notlariOku(path.resolve(o.konum[0])));
  const secili = o.hepsi ? hepsi : hepsi.filter((n) => n.durum === 'bekliyor' || n.durum === 'uygulaniyor');
  if (!secili.length) { console.log(o.hepsi ? 'Not yok.' : 'Bekleyen not yok.'); return secili; }
  secili.forEach((n) => console.log(listeSatiri(n)));
  return secili;
}

// ── görüntü ────────────────────────────────────────────────────────────────
// tools/kullanim.js ile aynı sözleşme: MFSIM_CHROMIUM, yoksa konteynerin kurulu
// tarayıcısı (projenin playwright sürümü kendi indirmesini arıyor).
function tarayiciYolu() {
  if (process.env.MFSIM_CHROMIUM) return process.env.MFSIM_CHROMIUM;
  const kurulu = '/opt/pw-browsers/chromium';
  return fs.existsSync(kurulu) ? kurulu : undefined;
}

function fotoAc(dosya) {
  const p = JSON.parse(fs.readFileSync(dosya, 'utf8'));
  if (!p || typeof p.veri !== 'string') throw new Error('fotoğraf paketi bozuk: veri yok');
  if (p.sikistirma === 'gzip') return zlib.gunzipSync(Buffer.from(p.veri, 'base64')).toString('utf8');
  if (p.sikistirma === 'yok') return p.veri;
  throw new Error('bilinmeyen sıkıştırma: ' + p.sikistirma);
}

async function goruntu(o) {
  if (!o.konum[0]) throw new Error('not.json gerekli');
  const not = govde(JSON.parse(fs.readFileSync(path.resolve(o.konum[0]), 'utf8')));
  const hatalar = CN.notDogrula(not);
  if (hatalar.length) throw new Error('not bozuk:\n  ' + hatalar.join('\n  '));
  const html = o.foto ? fotoAc(o.foto) : '<!doctype html><html><body style="margin:0;background:#fff"></body></html>';
  const cikti = o.cikti || path.join(KOK, '.canli-not', 'goruntu', 'not-' + not.no + (o.kirp ? '-yakin' : '') + '.png');
  fs.mkdirSync(path.dirname(cikti), { recursive: true });
  const { chromium } = require('playwright');
  const tarayici = await chromium.launch(tarayiciYolu() ? { executablePath: tarayiciYolu() } : {});
  try {
    const sayfa = await tarayici.newPage({
      viewport: { width: not.cizim.g, height: not.cizim.y },
      deviceScaleFactor: o.olcek || (o.kirp ? 2 : 1)
    });
    // Fotoğraf kendi içinde tamam; dışarıya hiçbir istek gitmez.
    await sayfa.route('**/*', (r) => (r.request().url().startsWith('data:') ? r.continue() : r.abort()));
    await sayfa.setContent(html, { waitUntil: 'load' });
    const kutular = [];
    if (o.ogeler && not.secim) {
      (not.secim.ic || []).forEach((k) => { if (k.kutu) kutular.push({ k: k.kutu, r: '#2a568a' }); });   // sabit renk: araç çıktısı
      (not.secim.ok || []).forEach((k) => { if (k.kutu) kutular.push({ k: k.kutu, r: '#276a45' }); });   // sabit renk: araç çıktısı
      if (not.secim.kap && not.secim.kap.kutu) kutular.push({ k: not.secim.kap.kutu, r: '#9f9b91' });    // sabit renk: araç çıktısı
    }
    await sayfa.evaluate(({ sekiller, kutular }) => {
      document.querySelectorAll('[data-cn-kaydir]').forEach((el) => {
        const [x, y] = el.getAttribute('data-cn-kaydir').split(',').map(Number);
        el.scrollLeft = x; el.scrollTop = y;
      });
      const p = document.documentElement.getAttribute('data-cn-pencere');
      if (p) { const [x, y] = p.split(',').map(Number); window.scrollTo(x, y); }
      const st = document.createElement('style');
      st.textContent = '*,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;transition:none!important;caret-color:transparent!important}';
      document.head.appendChild(st);
      const ns = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(ns, 'svg');
      svg.setAttribute('style', 'position:fixed;left:0;top:0;width:100vw;height:100vh;pointer-events:none;z-index:2147483647');
      kutular.forEach(({ k, r }) => {
        const e = document.createElementNS(ns, 'rect');
        e.setAttribute('x', k[0]); e.setAttribute('y', k[1]); e.setAttribute('width', k[2]); e.setAttribute('height', k[3]);
        e.setAttribute('fill', 'none'); e.setAttribute('stroke', r); e.setAttribute('stroke-width', '1.5'); e.setAttribute('stroke-dasharray', '5 4');
        svg.appendChild(e);
      });
      sekiller.forEach((s) => {
        const e = document.createElementNS(ns, 'path');
        e.setAttribute('d', s.d);
        e.setAttribute('fill', 'none'); e.setAttribute('stroke', '#c22b22'); e.setAttribute('stroke-width', '3');
        e.setAttribute('stroke-linecap', 'round'); e.setAttribute('stroke-linejoin', 'round');
        svg.appendChild(e);
      });
      document.documentElement.appendChild(svg);
    }, { sekiller: not.cizim.sekiller, kutular });
    const secenek = { path: cikti };
    if (o.kirp) {
      const k = not.cizim.kutu || CN.kutuBirlesim(not.cizim.sekiller);
      const pay = 160;
      const x = Math.max(0, k[0] - pay), y = Math.max(0, k[1] - pay);
      secenek.clip = { x, y, width: Math.min(not.cizim.g - x, k[2] + 2 * pay), height: Math.min(not.cizim.y - y, k[3] + 2 * pay) };
    }
    await sayfa.screenshot(secenek);
  } finally {
    await tarayici.close();
  }
  console.log('Not ' + not.no + ' → ' + (path.relative(KOK, cikti) || cikti) + (o.foto ? '' : ' (fotoğrafsız: yalnız çizim)'));
  return cikti;
}

// ── sonuç ──────────────────────────────────────────────────────────────────
// Uygulanan notun görüntüsü (skill §2 · 6) — her oturumun elle yazdığı
// Playwright kalıbının yerine (kullanıcı 2026-11-05: "aynı bu yapıda, aynı bu
// şekilde, değişmeden canlı not özelliğinin o sessiona gelmesini istiyorum").
// Giriş js/auth.js'in özetiyle (sabit yazılmaz), yükleyici otomasyonda beklemez.
function girisAnahtari() {
  const m = /MFSIM_AUTH_HASH\s*=\s*'([0-9a-f]{64})'/.exec(fs.readFileSync(path.join(KOK, 'js', 'auth.js'), 'utf8'));
  if (!m) throw new Error('js/auth.js: MFSIM_AUTH_HASH okunamadı');
  return m[1];
}

async function sonuc(o) {
  const no = Number(o.konum[0]);
  if (!(Number.isInteger(no) && no > 0)) throw new Error('not numarası gerekli (örnek: sonuc 36)');
  const dosya = o.dosya || path.join(KOK, 'MFSim_Code.html');
  if (!fs.existsSync(dosya)) throw new Error((path.relative(KOK, dosya) || dosya) + ' yok — önce npm run build');
  const hazirlik = o.hazirlik ? fs.readFileSync(o.hazirlik, 'utf8') : '';
  const cikti = o.cikti || path.join(KOK, '.canli-not', 'sonuc', 'not-' + no + '.png');
  fs.mkdirSync(path.dirname(cikti), { recursive: true });
  const { chromium } = require('playwright');
  const tarayici = await chromium.launch(tarayiciYolu() ? { executablePath: tarayiciYolu() } : {});
  const hatalar = [];
  let olcu = null;
  try {
    const sayfa = await tarayici.newPage({ viewport: o.ekran || { width: 1440, height: 900 }, deviceScaleFactor: 2 });
    sayfa.on('pageerror', (e) => hatalar.push(String(e && e.message ? e.message : e)));
    sayfa.on('dialog', (d) => d.accept());
    await sayfa.route(/^https?:/, (r) => r.abort());
    await sayfa.addInitScript((a) => { try { localStorage.setItem('mfsim_auth_token', a); } catch (e) { /* özel pencere */ } }, girisAnahtari());
    await sayfa.goto('file://' + dosya);
    await sayfa.waitForFunction(() => typeof window.createNode === 'function', null, { timeout: 120000 });
    await sayfa.evaluate(() => { if (typeof veSelectModuleFromOverlay === 'function') veSelectModuleFromOverlay('arac-performans'); });
    await sayfa.waitForFunction(() => { const e = document.getElementById('mfsim-loading-screen'); return !e || e.style.display === 'none'; }, null, { timeout: 120000 });
    if (o.modul) {
      await sayfa.evaluate((g) => { const n = createNode(g.tip, 400, 300); window[g.ac](n.id); }, MODUL_GIRIS[o.modul]);
      await sayfa.waitForTimeout(700);
    }
    if (o.ornek) {
      await sayfa.evaluate((k) => veMntOrnekYukle(k), o.ornek);
      await sayfa.waitForTimeout(900);
    }
    if (hazirlik) await sayfa.evaluate('(async () => { const bekle = (ms) => new Promise((r) => setTimeout(r, ms));\n' + hazirlik + '\n})()');
    await sayfa.waitForTimeout(600);
    const secenek = { path: cikti };
    if (o.alan) secenek.clip = o.alan;
    if (o.secici) {
      const k = await sayfa.evaluate((sc) => { const e = document.querySelector(sc); if (!e) return null; const r = e.getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; }, o.secici);
      if (!k || !(k[2] > 0 && k[3] > 0)) throw new Error('--secici görünür öğe bulmadı: ' + o.secici);
      const pay = o.pay !== undefined ? o.pay : 12, vp = sayfa.viewportSize();
      const x = Math.max(0, k[0] - pay), y = Math.max(0, k[1] - pay);
      secenek.clip = { x: x, y: y, width: Math.min(vp.width - x, k[2] + 2 * pay), height: Math.min(vp.height - y, k[3] + 2 * pay) };
    }
    await sayfa.screenshot(secenek);
    const c = secenek.clip || sayfa.viewportSize();
    olcu = { g: Math.round(c.width), y: Math.round(c.height) };
  } finally {
    await tarayici.close();
  }
  console.log('Not ' + no + ' sonucu → ' + (path.relative(KOK, cikti) || cikti) + ' · ' + olcu.g + ' × ' + olcu.y +
    ' CSS px (sonuc: { g: ' + olcu.g + ', y: ' + olcu.y + ' })');
  if (hatalar.length) console.log('! sayfa hatası: ' + hatalar.slice(0, 3).join(' | '));
  return { cikti: cikti, olcu: olcu, hatalar: hatalar };
}

// Yardım, dosyanın baş yorumunun kendisi (yorum büyüyünce kesilmesin).
const YARDIM = (() => {
  const s = fs.readFileSync(__filename, 'utf8'), a = s.indexOf('/**'), b = s.indexOf('*/', a);
  return s.slice(a + 3, b).split('\n').map((x) => x.replace(/^ \* ?/, '')).join('\n').trim();
})();

async function ana(argv) {
  const o = ayristir(argv);
  if (o.yardim || !o.komut) { console.log(YARDIM); return; }
  if (o.komut === 'hazirla') return hazirla(o);
  if (o.komut === 'denetle') return denetle(o);
  if (o.komut === 'yayin') return yayin(o);
  if (o.komut === 'liste') return liste(o);
  if (o.komut === 'goruntu') return goruntu(o);
  if (o.komut === 'sonuc') return sonuc(o);
  throw new Error('bilinmeyen komut: ' + o.komut + ' (hazirla · yayin · denetle · liste · goruntu · sonuc)');
}

if (require.main === module) {
  ana(process.argv.slice(2)).catch((e) => { console.error('✗ ' + (e && e.message ? e.message : e)); process.exit(1); });
}

module.exports = { ayristir, notlarAyristir, kopruGom, sayfaKur, govde, notlariOku, listeSatiri, fotoAc, kunyeOku,
  yayinKaydi, yayinOku, guncellikHukmu, sayfaHukmu, girisAnahtari, ekranAyristir, alanAyristir, MODUL_GIRIS, GIRDILER, CEKIRDEK_CAPA, AYAR_CAPA, SINIR, VARLIK_SINIRI, sinirHukmu };
