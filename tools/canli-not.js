#!/usr/bin/env node
'use strict';
/**
 * canli-not.js — CANLI NOT: programın üstüne çizilen değişiklik notları (2026-11-04)
 * ───────────────────────────────────────────────────────────────────────────
 * Kullanıcı isteği: *"programı bir arayüze alalım, açalım. Oraya buraya
 * girelim ve ben çizerek, yuvarlak içine alarak istediğim değişiklikleri canlı
 * olarak yazayım. Sen de bunları sırası ile uygula."*
 *
 *   node tools/canli-not.js hazirla [--cikti .canli-not/yayin] [--dokum .canli-not/dokum] [--dal]
 *       Karesiz tek dosya (MFSIM_KARSILAMA=yok) + köprü <meta charset>'ın
 *       arkasında → mfsim.html; program PARÇALARA ayrılır (parca/*.txt +
 *       yayin-plan.json); sayfa (canli-not.html) çekirdek ve künyeyle.
 *       YALNIZ ANA DALDAN: HEAD origin/main değilse ya da commit edilmemiş
 *       değişiklik varsa DURUR (--dal: yerel deneme, YAYINLANMAZ).
 *       PARÇALI YAYIN: 512 KiB'tan uzun her satır (build.js gömülü veriyi tek
 *       satıra yazar) kendi yuvasına çıkar, kalan iskelet (kod) yuva 0'dır;
 *       sıkışan yuva gzip → taban64 saklanır, 12 MiB'ı aşan bölünür. Önceki
 *       yayının dökümü varsa (ArtifactData get yayin son, out_dir) yerinde
 *       duran yuvalar söylenir: yalnız DEĞİŞEN yuva yüklenir.
 *
 *   node tools/canli-not.js sayfa [--cikti .canli-not/yayin] [--dal]
 *       SAYFANIN YAYINI — yalnız sayfa (tools/canli-not*) değiştiyse. Sayfa
 *       program GÖMMEZ: program hep kayıttaki yayından (yayin/son) yüklenir.
 *       Publish `files`'sız. Yalnız ana daldan.
 *
 *   node tools/canli-not.js duman [--cikti .canli-not/yayin]
 *       AÇILIŞ DENEMESİ — hazırlanan sayfa ve parçalar gerçek tarayıcıda:
 *       sahte kayıt planı gösterir, parçalar diskten gelir; sayfa onları indirir,
 *       açar, birleştirir, program çerçevede başlar. Sayfa hatası ya da açılmayan
 *       program DURDURUR. Yayından ÖNCE koşulur.
 *
 *   node tools/canli-not.js yayin [--parca <özet[.n]>=<varlık kimliği> …] [--notlar 6,8-21]
 *                           [--dokum .canli-not/dokum] [--oturum <adres>] [--ilk] [--cikti <json>]
 *       PROGRAMIN GÜNCELLEMESİ — sayfa yeniden YAYINLANMAZ (kullanıcı
 *       2026-11-05: "artifaktı otomatik olarak yenileme … güncelleme
 *       geldiğinde uyarı popup çıkar"). `hazirla`nın YÜKLE dediği parçalar varlık
 *       deposuna yüklenir; bu komut kaydın `yayin/son` belgesini kurar (künye ·
 *       parçalar · uygulanan notlar): yerinde duran yuva önceki yayının varlığını
 *       taşır. İKİ KAPI (kullanıcı 2026-11-11, karışma): TEK YAZAR — yalnız
 *       `oturum/aktif`in gösterdiği oturum yayınlar; SIRA — yayındaki sürüm bu
 *       derlemeden yeniyse yayın yazılmaz. İkisi de dökümden (`--dokum`:
 *       yayin/son.json · oturum/aktif.json) okunur. Açık sayfa sorar, Güncelle yükler.
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
 *   node tools/canli-not.js sonuc <N> [--modul takoz|fead|arac] [--ornek <anahtar>] [--odak <ad>]
 *                           [--hazirlik <betik.js>] [--secici <css> | --alan x,y,g,y] [--pay 12]
 *                           [--ekran 1440x900] [--dosya MFSim_Code.html] [--cikti <png>]
 *       Uygulanan notun SONUÇ görüntüsü (2×): tek dosya (npm run build), file://,
 *       ağsız. Giriş, karşılama ve modüle giriş kendiliğinden; --ornek Takoz
 *       örneğini kurar; --odak odaklı sayfanın açtığı yeri kurar (köprünün tarifi);
 *       --hazirlik sayfada koşan async gövde (yüzeyi açar,
 *       `bekle(ms)` hazır); --secici o öğenin kutusu (+pay), --alan ekranın
 *       bir bölgesi (CSS px), ikisi de yoksa ekranın tamamı. Çıktı
 *       .canli-not/sonuc/not-N.png; CSS px ölçüsü `sonuc {g, y}` için.
 *
 *   --odak <ad>  (hazirla · sayfa · duman · yayin · sonuc)
 *       ODAKLI SAYFA — bir bileşene ayrılmış Canlı Not (kullanıcı 2026-11-11; odaklar
 *       çekirdekte: CN.ODAKLAR). Ayrı Artifact: kendi kaydı, varlık deposu ve sahibi;
 *       yerel dizinleri .canli-not/<ad>/yayin · .canli-not/<ad>/dokum. Sayfa programı
 *       her açılışta o bileşende açar; notları kendi aralığında numaralar.
 *       BELGE ODAĞI (`belge`, örn. param-html): çerçevede programın ÜRETTİĞİ belge —
 *       hazirla programı derler, belgeyi gerçek tarayıcıda programın kendi yolundan üretir
 *       (BELGE_URET), künye ve köprü belgeye girer; sonuc o belgeyi açar.
 *
 * Protokol (açılış, yayın, sıra, durum, yanıt): skill `canli-not`.
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const CN = require('./canli-not-cekirdek.js');

const KOK = path.join(__dirname, '..');
const SABLON = path.join(__dirname, 'canli-not.html');
const CEKIRDEK = path.join(__dirname, 'canli-not-cekirdek.js');
const KOPRU = path.join(__dirname, 'canli-not-kopru.js');
const CEKIRDEK_CAPA = '/*__CEKIRDEK__*/';
const AYAR_CAPA = '/*__AYAR__*/null';
// PARÇALI YAYIN (kullanıcı 2026-11-11: boyut sınırı). Program tek metin varlığıydı
// (sınırı 20 MiB) ve sayfanın gömdüğü kopya 16 MB'a sığmıyordu; ölçüldü: 17,2 MiB,
// bir haftada 5,3 MiB görsel. Program artık parçalar hâlinde durur, sayfa program gömmez.
//   ESIK           bu boydan uzun SATIR kendi yuvasına çıkar (karakter)
//   PARCA_SINIRI   bir varlığın saklanan metni; aşan yuva bölünür
//   VARLIK_SINIRI  deponun metin varlığı sınırı — PARCA_SINIRI onun altında durur
const ESIK = 512 * 1024;
const PARCA_SINIRI = 12 * 1024 * 1024;
const VARLIK_SINIRI = 20 * 1024 * 1024;
const VARSAYILAN_CIKTI = path.join(KOK, '.canli-not', 'yayin');
const VARSAYILAN_DOKUM = path.join(KOK, '.canli-not', 'dokum');

function ayristir(argv) {
  const ilk = argv[0] && !argv[0].startsWith('-') ? argv[0] : undefined;
  const o = { komut: ilk, konum: [] };
  for (let i = ilk ? 1 : 0; i < argv.length; i++) {
    const a = argv[i];
    const deger = () => { if (i + 1 >= argv.length) throw new Error(a + ' bir değer ister'); return argv[++i]; };
    if (a === '--cikti') o.cikti = path.resolve(deger());
    else if (a === '--program') o.program = deger();
    else if (a === '--parca') parcaAyristir(deger(), o.parca = o.parca || {});
    else if (a === '--dokum') o.dokum = path.resolve(deger());
    else if (a === '--oturum') o.oturum = deger();
    else if (a === '--ilk') o.ilk = true;
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
    else if (a === '--odak') o.odak = deger();
    else if (a === '--help' || a === '-h') o.yardim = true;
    else if (a.startsWith('--')) throw new Error('bilinmeyen bayrak: ' + a);
    else o.konum.push(a);
  }
  if (o.olcek !== undefined && !(o.olcek >= 1 && o.olcek <= 3)) throw new Error('--olcek 1–3 olmalı');
  if (o.modul !== undefined && !MODUL_GIRIS[o.modul]) throw new Error('--modul: ' + Object.keys(MODUL_GIRIS).join(' · '));
  if (o.ornek !== undefined && o.modul !== 'takoz') throw new Error('--ornek yalnız --modul takoz ile (Takoz örneği)');
  if (o.pay !== undefined && !(o.pay >= 0 && o.pay <= 200)) throw new Error('--pay 0–200 px olmalı');
  if (o.alan && o.secici) throw new Error('--alan ile --secici birlikte olmaz');
  if (o.odak !== undefined && !CN.odakBul(o.odak)) throw new Error('--odak: ' + Object.keys(CN.ODAKLAR).join(' · '));
  if (o.odak && (o.modul || o.ornek)) throw new Error('--odak modülünü ve örneğini kendi kurar: --modul/--ornek ile birlikte olmaz');
  return o;
}

// ODAKLI SAYFA (kullanıcı 2026-11-11: bileşene ayrılmış Canlı Not — çekirdek → ODAKLAR):
// ayrı bir Artifact, yani ayrı kayıt ve ayrı yayın. Yerel dizinleri de ayrı:
// .canli-not/<odak>/yayin · .canli-not/<odak>/dokum — iki sayfanın dökümü karışmasın.
function yayinDizini(o) {
  return o && o.odak ? path.join(KOK, '.canli-not', o.odak, 'yayin') : VARSAYILAN_CIKTI;
}
function dokumDizini(o) {
  return o && o.odak ? path.join(KOK, '.canli-not', o.odak, 'dokum') : VARSAYILAN_DOKUM;
}

// "--parca <özet[.n]>=<varlık kimliği>": yüklenen parçanın kimliği, parçanın anahtarıyla.
function parcaAyristir(s, hedef) {
  const m = /^([0-9a-f]{16}(?:\.\d+)?)=([0-9a-f]{32})$/.exec(String(s).trim());
  if (!m) throw new Error('--parca <özet[.n]>=<varlık kimliği> olmalı ("' + s + '" okunamadı)');
  hedef[m[1]] = m[2];
  return hedef;
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

// BELGE ODAĞI: belgeye programın künyesi (kunyeOku okur — denetim ve yayın programınkiyle
// aynı yoldan) ve belge işareti (köprünün programDurumu: kayıt işlevi yok, yüklenince hazır).
function belgeKunyele(html, kunye) {
  const kapa = html.indexOf('</head>');
  if (kapa < 0) throw new Error('belge: </head> yok');
  const etiket = '<script>window.__MFSIM_BUILD = ' + JSON.stringify(kunye).replace(/</g, '\\u003c') + ';\n' +
    'window.__cnBelge = true;\n</script>\n';
  return html.slice(0, kapa) + etiket + html.slice(kapa);
}

// Odaklı sayfanın adı kendi başlığı (galeride ve sekmede iki Canlı Not ayrılsın);
// `odak` verilmezse ayarınki.
const BASLIK_CAPA = '<title>MFSim Canlı Not</title>';
function sayfaKur(sablon, cekirdek, ayar, odak) {
  if (sablon.indexOf(CEKIRDEK_CAPA) < 0) throw new Error('şablonda çekirdek çapası yok: ' + CEKIRDEK_CAPA);
  if (sablon.indexOf(AYAR_CAPA) < 0) throw new Error('şablonda ayar çapası yok: ' + AYAR_CAPA);
  const o = CN.odakBul(odak !== undefined ? odak : ayar && ayar.odak);
  if (o && sablon.indexOf(BASLIK_CAPA) < 0) throw new Error('şablonda başlık yok: ' + BASLIK_CAPA);
  const json = JSON.stringify(ayar).replace(/</g, '\\u003c');
  // Fonksiyon replacer: dizgedeki '$&' gibi diziler genişletilmesin (build.js ile aynı tuzak).
  return sablon
    .replace(BASLIK_CAPA, () => (o ? '<title>' + o.baslik + '</title>' : BASLIK_CAPA))
    .replace(CEKIRDEK_CAPA, () => cekirdek.replace(/<\/script/gi, '<\\/script'))
    .replace(AYAR_CAPA, () => json);
}

// ── güncellik ──────────────────────────────────────────────────────────────
// Yayınlanan program ANA DALIN kendisidir (kullanıcı 2026-11-05: "güncelliğinden
// emin olalım, öyle devam edelim"): kullanıcı programı Canlı Not'ta kullanıyor,
// eski kopyanın üstüne yazılan not boşa gider. Programın girdileri build.js'in
// okuduğu her yol + programa giren Canlı Not dosyaları (paketleyici ve köprü);
// karşılama kareleri bu yayında yok. Sayfanın dosyaları (şablon, çekirdek) programa
// GİRMEZ — onların güncelliği sayfanın denetimi (`denetle <index.html>`); burada
// olsalardı sayfa değişikliği 18 MB'lık program yayını isterdi. Liste build.js'e
// karşı testte bağlı (canli-not.test.js → GÜNCELLİK).
const GIRDILER = [
  'index.html', 'js', 'css', 'vendor', 'pwa/icon.svg', 'assets/examples', 'assets/degisiklik', 'assets/belge', 'assets/kilavuz',
  'assets/takoz',
  'programlar/kayit.json', 'build.js', 'build-shield.js', 'tools/version-info.js', 'tools/degisiklik-resim.js',
  'tools/karsilama-webp.js', 'tools/kilavuz-resim.js',
  'tools/canli-not.js', 'tools/canli-not-kopru.js'
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

// ── parçalı yayın ──────────────────────────────────────────────────────────
// build.js gömülü her veri globalini TEK satıra yazar (window.__MFSIM_TAKOZ = {…};),
// kütüphaneler de tek satırdır: satır doğal kesim yeridir. ESIK'ten uzun satır kendi
// yuvasına çıkar, iskelette yerinde imi kalır (CN.yuvaImi); geri kurma CN.programBirlestir.
function ozetle(metin) {
  return crypto.createHash('sha256').update(metin, 'utf8').digest('hex').slice(0, 16);
}
function yuvaAdi(satir) {
  const m = /window\.__(?:MFSIM_)?([A-Z][A-Z0-9_]*)\s*=/.exec(satir.slice(0, 160));
  return m ? m[1].toLowerCase().replace(/_/g, '-') : 'satir';
}
function parcala(html, esik) {
  if (html.indexOf('@@CN-YUVA:') >= 0) throw new Error('programda yuva imi geçiyor (@@CN-YUVA:): ayrılamaz');
  const yuvalar = [{ ad: 'kod', metin: '' }];
  yuvalar[0].metin = html.split('\n').map((satir) => {
    if (satir.length < (esik || ESIK)) return satir;
    yuvalar.push({ ad: yuvaAdi(satir), metin: satir });
    return CN.yuvaImi(yuvalar.length - 1);
  }).join('\n');
  return yuvalar;
}
// Saklanan biçim: sıkışan yuva gzip → taban64; sıkışmayan (taban64 görsel) olduğu gibi.
// ASCII olmayan metin hep gzip'lenir: saklanan metnin karakteri = baytı kalsın (bölme sınırı).
function paketle(metin) {
  const gz = zlib.gzipSync(Buffer.from(metin, 'utf8'), { level: 9 }).toString('base64');
  // eslint-disable-next-line no-control-regex
  if (gz.length < metin.length * 0.9 || /[^\x00-\x7f]/.test(metin)) return { sik: 'gzip', veri: gz };
  return { sik: 'yok', veri: metin };
}
function paketAc(sik, veri) {
  if (sik === 'gzip') return zlib.gunzipSync(Buffer.from(veri, 'base64')).toString('utf8');
  if (sik === 'yok') return veri;
  throw new Error('bilinmeyen sıkıştırma: ' + sik);
}
function bol(veri, sinir) {
  const p = [];
  for (let i = 0; i < veri.length; i += sinir) p.push(veri.slice(i, i + sinir));
  return p.length ? p : [''];
}
// Plan: yuvalar sırayla; `ozet` yuvanın İÇERİĞİNİN özeti (sıkıştırmanın değil — aynı içerik
// başka zlib sürümünde başka bayt üretse de aynı yuvadır), `parcalar` saklanan metinler.
function planKur(html, kunye, secenek) {
  secenek = secenek || {};
  kunye = kunye || {};
  return {
    surum: kunye.shortSha || '', sha: kunye.sha || '', pr: kunye.prNumber || '',
    boyut: Buffer.byteLength(html), uzunluk: html.length,
    yuvalar: parcala(html, secenek.esik).map((y, n) => {
      const p = paketle(y.metin);
      return { yuva: n, ad: y.ad, ozet: ozetle(y.metin), sik: p.sik, uzunluk: y.metin.length, parcalar: bol(p.veri, secenek.sinir || PARCA_SINIRI) };
    })
  };
}
// Planı geri kurar: `oku(parça)` saklanan metni verir (bellekteki dizge ya da dosya).
function planBirlestir(plan, oku) {
  oku = oku || ((p) => p);
  return CN.programBirlestir(plan.yuvalar.map((y) => paketAc(y.sik, y.parcalar.map(oku).join(''))));
}
// Parçanın anahtarı: yuvanın özeti; yuva bölünmüşse sıra numarasıyla (özet.2).
function parcaAnahtari(y, i) {
  return y.ozet + (y.parcalar.length > 1 ? '.' + (i + 1) : '');
}
// Önceki yayının yuvaları özetleriyle: { özet: [parça kayıtları…] } — yalnız parçalı kayıtta.
function oncekiYuvalar(yayin) {
  const out = {};
  const p = yayin && yayin.program && yayin.program.parcalar;
  if (!Array.isArray(p) || CN.yayinDogrula(yayin).length) return out;
  CN.yuvaPlani(p).forEach((yuva) => {
    const oz = yuva[0] && yuva[0].ozet;
    if (oz && yuva.every((x) => x.ozet === oz)) out[oz] = yuva;
  });
  return out;
}
// Yerinde duran yuva yeniden YÜKLENMEZ: önceki yayında aynı özetle (aynı içerik) duruyor.
function planKarsilastir(plan, onceki) {
  const eski = oncekiYuvalar(onceki);
  return plan.yuvalar.map((y) => ({ yuva: y.yuva, ad: y.ad, ozet: y.ozet, yerinde: !!eski[y.ozet],
    boyut: y.parcalar.reduce((t, p) => t + (p.boyut || 0), 0), parcalar: y.parcalar }));
}
// Bir yayının tuttuğu varlıklar (eski biçimde tek kimlik).
function yayinVarliklari(yayin) {
  const p = yayin && yayin.program;
  if (!p) return [];
  if (Array.isArray(p.parcalar)) return p.parcalar.map((x) => x.id).filter((id, i, a) => id && a.indexOf(id) === i);
  return p.id ? [p.id] : [];
}
// Kaydın parça listesi: yeni yüklenenin kimliği `verilen`den, yerinde duranınki önceki
// yayından. Yuva ya BÜTÜN parçalarıyla yeni yüklenmiştir ya da önceki yayının parçalarını
// OLDUĞU GİBI taşır (saklanan metin aynı içeriğin başka bölünüşü olabilir: yarım eşleşme
// kurulmaz). Kimliksiz parça `eksik`te adıyla döner — yarım kayıt yazılmaz. `artik`:
// önceki yayının, yeni kayıtta kalmayan varlıkları (yazımdan SONRA silinir).
function yayinKur(plan, onceki, verilen) {
  verilen = verilen || {};
  const eski = oncekiYuvalar(onceki), parcalar = [], eksik = [];
  let yeni = 0;
  plan.yuvalar.forEach((y) => {
    const anahtarlar = y.parcalar.map((p, i) => parcaAnahtari(y, i)), e = eski[y.ozet];
    if (!anahtarlar.some((a) => verilen[a]) && e) {
      e.forEach((x) => parcalar.push({ yuva: y.yuva, id: x.id, ozet: y.ozet, boyut: x.boyut || 0, sik: x.sik, ad: y.ad }));
      return;
    }
    y.parcalar.forEach((p, i) => {
      const anahtar = anahtarlar[i];
      if (verilen[anahtar]) { yeni++; parcalar.push({ yuva: y.yuva, id: verilen[anahtar], ozet: y.ozet, boyut: p.boyut || 0, sik: y.sik, ad: y.ad }); }
      else eksik.push({ anahtar: anahtar, dosya: p.dosya || '', ad: y.ad });
    });
  });
  const kullanilan = {};
  parcalar.forEach((p) => { kullanilan[p.id] = true; });
  return { parcalar: parcalar, eksik: eksik, yeni: yeni, artik: yayinVarliklari(onceki).filter((id) => !kullanilan[id]) };
}

// ── iki kapı: tek yazar · sıra ─────────────────────────────────────────────
// Kullanıcı 2026-11-11: *"diğer sessionlardan gelen güncellemelerle de bazen
// karışabiliyor"*. Ölçüldü: her oturum her birleşmeden sonra Canlı Not'taki programı
// da yeniliyordu (üç günde 57 birleşme; yayın kaydı 6 günde 74 kez yazıldı) ve kaydın
// sırası denetlenmiyordu — son yazan kazanıyor, eski sürüm yenisinin üstüne yazabiliyordu.
//   TEK YAZAR  yayını yalnız `oturum/aktif`in gösterdiği oturum yapar
//   SIRA       yayındaki sürüm bu derlemeden yeniyse yayın yazılmaz
function oturumKimligi(s) {
  const m = /(?:session_|cse_)([0-9A-Za-z]{16,})/.exec(String(s || ''));
  return m ? m[1] : '';
}
// Bu oturumun adresi: --oturum, yoksa ortamdan (bulut oturumunun kimliği).
function oturumAdresi(o, ortam) {
  ortam = ortam || process.env;
  const k = oturumKimligi((o && o.oturum) || ortam.MFSIM_OTURUM || ortam.CLAUDE_CODE_REMOTE_SDK_URL);
  return k ? 'https://claude.ai/code/session_' + k : '';
}
function sahipHukmu(aktif, ben) {
  const s = oturumKimligi(aktif && aktif.oturum), b = oturumKimligi(ben);
  if (!b) return { sahip: false, sebep: 'bu oturumun adresi bilinmiyor (--oturum <adres>)' };
  if (!s) return { sahip: false, sebep: 'sahiplik kaydı okunmadı (ArtifactData get collection:oturum doc_id:aktif out_dir:.canli-not/dokum)' };
  return s === b ? { sahip: true } : { sahip: false, sebep: 'Canlı Not şu oturumda: https://claude.ai/code/session_' + s };
}
// `ata(a, b)`: a, b'nin atası mı — true · false · null (commit yerelde yok). Yalnız KESİN
// geri gidiş durdurur: sığ klonda bilinmeyen sıra yayını engellemez.
function siraHukmu(yayindaki, yeni, ata) {
  if (!yayindaki || !yeni || yayindaki === yeni) return { durum: 'ayni', yayinla: true };
  if (ata(yayindaki, yeni) === true) return { durum: 'ileri', yayinla: true };
  if (ata(yeni, yayindaki) === true) return { durum: 'geri', yayinla: false };
  return { durum: 'bilinmiyor', yayinla: true };
}
function ataMi(a, b) {
  const r = spawnSync('git', ['merge-base', '--is-ancestor', a, b], { cwd: KOK, encoding: 'utf8' });
  return r.status === 0 ? true : (r.status === 1 ? false : null);
}
// ArtifactData dökümü: {id, version, data} sarmalı ya da çıplak belge; dosya yoksa null.
function dokumOku(dosya) {
  if (!fs.existsSync(dosya)) return null;
  const j = JSON.parse(fs.readFileSync(dosya, 'utf8'));
  return j && j.data && typeof j.data === 'object' && !Array.isArray(j.data) ? { data: j.data, version: j.version } : { data: j };
}

// ── yayın kaydı (yayin/son) ────────────────────────────────────────────────
// Sayfa ile araç aynı doğrulamayı okur (CN.yayinDogrula): bozuk kayıt sayfada
// güncelleme sayılmaz, burada yazılmaz. `oturum` yayınlayanın adresi (bilgi).
function yayinKaydi(kunye, program, notlar, zaman, oturum) {
  const p = program || {};
  const y = {
    surum: kunye.shortSha || '', sha: kunye.sha || '', pr: kunye.prNumber || '',
    zaman: zaman || new Date().toISOString(),
    program: Array.isArray(p.parcalar)
      ? { boyut: p.boyut || 0, uzunluk: p.uzunluk || 0, parcalar: p.parcalar }
      : { id: String(p.id || ''), boyut: p.boyut || 0 },
    notlar: notlar || []
  };
  if (oturum) y.oturum = oturum;
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

const MiB = (n) => (n / 1048576).toFixed(2).replace('.', ',') + ' MiB';
const goreli = (p) => path.relative(KOK, p) || p;

function yayin(o) {
  if (o.program) {
    throw new Error('--program kalktı: program parçalı yayınlanır. `hazirla`nın YÜKLE dediği her dosyayı yükle, ' +
      'sonra: node tools/canli-not.js yayin --parca <özet>=<id> … (skill canli-not §1)');
  }
  const planYol = o.kaynak || path.join(yayinDizini(o), 'yayin-plan.json');
  if (!fs.existsSync(planYol)) throw new Error(goreli(planYol) + ' yok — önce: node tools/canli-not.js hazirla' + (o.odak ? ' --odak ' + o.odak : ''));
  const plan = JSON.parse(fs.readFileSync(planYol, 'utf8'));
  if (plan.dal) throw new Error('bu plan bir DAL KURULUMU (hazirla --dal): yayınlanmaz');
  const dokum = o.dokum || dokumDizini(o);
  const ben = oturumAdresi(o);
  const aktif = dokumOku(path.join(dokum, 'oturum', 'aktif.json'));
  const sahip = sahipHukmu(aktif && aktif.data, ben);
  if (!sahip.sahip) {
    throw new Error('TEK YAZAR: programı yalnız Canlı Not\'un sahibi oturum yayınlar. ' + sahip.sebep +
      '\n  Başka oturumun birleşmesi sayfaya "Programı güncelle" ile gelir; devralmak için skill canli-not §0 · 3.');
  }
  const onceki = dokumOku(path.join(dokum, 'yayin', 'son.json'));
  if (!onceki && !o.ilk) {
    throw new Error('önceki yayın okunmadı: ArtifactData get collection:yayin doc_id:son out_dir:' + goreli(dokum) +
      ' (kayıt hiç yoksa --ilk)');
  }
  const eski = onceki ? onceki.data : null;
  const sira = siraHukmu(eski && (eski.sha || eski.surum), plan.sha || plan.surum, ataMi);
  if (!sira.yayinla) {
    throw new Error('SIRA: yayındaki sürüm (' + eski.surum + (eski.pr ? ' · PR #' + eski.pr : '') + ') bu derlemeden (' +
      plan.surum + ') YENİ — yayın geri gitmez. git fetch origin main && git checkout -B main origin/main, sonra hazirla.');
  }
  const kur = yayinKur(plan, eski, o.parca);
  if (kur.eksik.length) {
    throw new Error('yüklenmemiş parça var — Artifact publish url:<adres> asset:true file_path:<dosya>, sonra kimliğiyle:\n' +
      kur.eksik.map((e) => '  --parca ' + e.anahtar + '=<id>   ' + path.join(goreli(path.dirname(planYol)), e.dosya)).join('\n'));
  }
  const y = yayinKaydi({ shortSha: plan.surum, sha: plan.sha, prNumber: plan.pr },
    { boyut: plan.boyut, uzunluk: plan.uzunluk, parcalar: kur.parcalar }, o.notlar || [], null, ben);
  const cikti = o.cikti || path.join(path.dirname(planYol), 'yayin-son.json');
  fs.writeFileSync(cikti, JSON.stringify(y, null, 2) + '\n');
  console.log('yayin/son · ' + y.surum + (y.pr ? ' · PR #' + y.pr : '') + ' · ' + kur.parcalar.length + ' parça (' + kur.yeni + ' yeni)' +
    (y.notlar.length ? ' · Not ' + CN.noAraligi(y.notlar) : ''));
  console.log('  sıra: ' + (eski ? eski.surum + ' → ' + y.surum + ' (' + sira.durum + ')' : 'ilk yayın'));
  console.log('\n1. Notların sonucu ve cevabı ÖNCE yazılır (skill §2 · 6–7).');
  console.log('2. ArtifactData set collection:yayin doc_id:son file_path:' + goreli(cikti) +
    (onceki && onceki.version !== undefined ? ' if_version:' + onceki.version
      : onceki ? ' if_version:<ArtifactData get\'in gösterdiği sürüm; döküm sürümü taşımıyor>' : ''));
  console.log('   Sürüm çakışırsa araya başka bir yayın girmiştir: yayin/son\'u yeniden oku, bu komutu yeniden çalıştır.');
  if (kur.artik.length) {
    console.log('3. Yazım BAŞARILI olduktan sonra artık kullanılmayan varlıklar silinir:');
    kur.artik.forEach((id) => console.log('   Artifact delete url:<adres> path:' + id));
  }
  return { kayit: y, artik: kur.artik, yeni: kur.yeni, sira: sira, surum: onceki ? onceki.version : undefined };
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
  const kur = sayfaKur(sablon, cekirdek, SAYFA_AYAR_YERI, (ayar && ayar.odak) || ''), j = kur.indexOf('"' + SAYFA_AYAR_YERI + '"');
  const on = kur.slice(0, j), arka = kur.slice(j + SAYFA_AYAR_YERI.length + 2);
  const a = metin.indexOf(on), b = a < 0 ? -1 : metin.indexOf(arka, a + on.length);
  let guncel = a >= 0 && b >= 0;
  if (guncel) { try { JSON.parse(metin.slice(a + on.length, b)); } catch (e) { guncel = false; } }
  return { guncel: guncel, ayar: ayar };
}

function denetle(o) {
  if (!o.konum[0]) throw new Error('yayin/son belgesi, yayındaki mfsim.html ya da yayındaki sayfa gerekli');
  const dosya = path.resolve(o.konum[0]), metin = fs.readFileSync(dosya, 'utf8');
  if (/<title>[^<]*Canlı Not[^<]*<\/title>/.test(metin) && metin.indexOf('window.__MFSIM_BUILD') < 0) {
    const h = sayfaHukmu(metin, fs.readFileSync(SABLON, 'utf8'), fs.readFileSync(CEKIRDEK, 'utf8'));
    const odak = CN.odakBul(h.ayar && h.ayar.odak);
    const kunye = (h.ayar && h.ayar.surum ? h.ayar.surum + (h.ayar.pr ? ' · PR #' + h.ayar.pr : '') : '?') + (odak ? ' · odak ' + odak.ad : '');
    console.log(h.guncel ? 'Sayfa güncel · yayındaki sayfa bugünkü kaynakla aynı (yayın ' + kunye + ')'
      : 'Sayfa ESKİ · yayındaki sayfa (' + kunye + ') bugünkü kaynaktan farklı → sayfayı yeniden yayınla (skill §1' +
        (odak ? ', --odak ' + h.ayar.odak : '') + ')');
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
    if (h.yayinla) console.log('Yayını yalnız Canlı Not\'un sahibi oturum yapar (tek yazar — skill canli-not §1).');
  }
  return h;
}

// Yayın ana dalın kendisidir: HEAD origin/main ve çalışma ağacı temiz.
function anaDalKapisi(env) {
  const ana = anaDal(), head = git(['rev-parse', 'HEAD']);
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

// Sayfa: şablon + çekirdek + ayar (sayfanın KENDİ künyesi; odaklı sayfada odağın adı).
// Program gömülmez.
function sayfaYaz(cikti, env, odak) {
  const kunye = require('./version-info.js').collect({ cwd: KOK, source: 'embedded', env: env });
  const ayar = { surum: kunye.shortSha || '', pr: kunye.prNumber || '', zaman: new Date().toISOString() };
  if (odak) ayar.odak = odak;
  const sayfa = sayfaKur(fs.readFileSync(SABLON, 'utf8'), fs.readFileSync(CEKIRDEK, 'utf8'), ayar);
  const yol = path.join(cikti, 'canli-not.html');
  fs.mkdirSync(cikti, { recursive: true });
  fs.writeFileSync(yol, sayfa);
  return { yol: yol, ayar: ayar, kunye: kunye, boyut: Buffer.byteLength(sayfa) };
}

async function hazirla(o) {
  const cikti = o.cikti || yayinDizini(o);
  const mfsim = path.join(cikti, 'mfsim.html'), odak = CN.odakBul(o.odak), belge = !!(odak && odak.belge);
  // Belge odağında program kendi dosyasına derlenir; çerçeveye giden (mfsim.html) onun ürettiği belge.
  const env = Object.assign({}, process.env, { MFSIM_BUILD_OUT: belge ? path.join(cikti, 'kaynak.html') : mfsim, MFSIM_KARSILAMA: 'yok' });
  if (!o.dal) anaDalKapisi(env);
  fs.mkdirSync(cikti, { recursive: true });
  const r = spawnSync(process.execPath, [path.join(KOK, 'build.js')], { cwd: KOK, encoding: 'utf8', env: env });
  if (r.status !== 0) throw new Error('build.js durdu:\n' + ((r.stdout || '') + (r.stderr || '')).slice(-3000));
  let html = fs.readFileSync(env.MFSIM_BUILD_OUT, 'utf8');
  if (belge) html = belgeKunyele(await belgeUret(o.odak, env.MFSIM_BUILD_OUT), kunyeOku(html));
  html = kopruGom(html, fs.readFileSync(KOPRU, 'utf8'));
  fs.writeFileSync(mfsim, html);
  const s = sayfaYaz(cikti, env, o.odak);

  // Parçalar diske: parca/<ad>-<özet>[.n].txt — eskileri silinir.
  const plan = planKur(html, s.kunye);
  const parcaDizin = path.join(cikti, 'parca'), tutulan = {};
  fs.mkdirSync(parcaDizin, { recursive: true });
  plan.yuvalar.forEach((y) => {
    const sayi = y.parcalar.length;
    y.parcalar = y.parcalar.map((veri, i) => {
      const ad = y.ad + '-' + y.ozet + (sayi > 1 ? '.' + (i + 1) : '') + '.txt', boyut = Buffer.byteLength(veri);
      if (boyut > VARLIK_SINIRI) throw new Error('parça ' + ad + ' ' + MiB(boyut) + ' — varlık sınırı ' + MiB(VARLIK_SINIRI));
      fs.writeFileSync(path.join(parcaDizin, ad), veri);
      tutulan[ad] = true;
      return { dosya: 'parca/' + ad, boyut: boyut };
    });
  });
  fs.readdirSync(parcaDizin).filter((f) => !tutulan[f]).forEach((f) => fs.unlinkSync(path.join(parcaDizin, f)));
  fs.readdirSync(cikti).filter((f) => /^mfsim-[0-9a-f]+\.txt$/.test(f)).forEach((f) => fs.unlinkSync(path.join(cikti, f)));
  // Geri kurma: parçalar DİSKTEN okunur, açılır, birleşir — programın kendisi çıkmalı.
  if (planBirlestir(plan, (p) => fs.readFileSync(path.join(cikti, p.dosya), 'utf8')) !== html) {
    throw new Error('parçalar programı geri kurmuyor (ayırma hatası) — yayınlanmaz');
  }
  if (o.dal) plan.dal = true;
  const planYol = path.join(cikti, 'yayin-plan.json');
  fs.writeFileSync(planYol, JSON.stringify(plan, null, 2) + '\n');

  const dokum = o.dokum || dokumDizini(o);
  const onceki = dokumOku(path.join(dokum, 'yayin', 'son.json'));
  const durum = planKarsilastir(plan, onceki && onceki.data);
  const yukle = durum.filter((y) => !y.yerinde), yerinde = durum.filter((y) => y.yerinde);
  const topla = (l) => l.reduce((t, y) => t + y.boyut, 0);
  const odakEki = o.odak ? ' --odak ' + o.odak : '';
  console.log('Canlı Not yayını hazır · ' + (plan.surum || '(git yok)') + (plan.pr ? ' · PR #' + plan.pr : '') +
    (o.dal ? ' · DAL KURULUMU — YAYINLANMAZ' : ' · ana dal') + (o.odak ? ' · odak ' + CN.odakBul(o.odak).ad : ''));
  console.log('  program  ' + goreli(mfsim) + ' · ' + MiB(plan.boyut) + ' → ' + plan.yuvalar.length + ' yuva · saklanan ' + MiB(topla(durum)));
  console.log('  sayfa    ' + goreli(s.yol) + ' (' + (s.boyut / 1024).toFixed(1) + ' KB)');
  if (!onceki) console.log('  ! önceki yayın okunmadı (ArtifactData get collection:yayin doc_id:son out_dir:' + goreli(dokum) + '): bütün parçalar YÜKLE sayıldı');
  if (yerinde.length) console.log('  yerinde  ' + yerinde.length + ' yuva · ' + MiB(topla(yerinde)) + ' — yüklenmez (' + yerinde.map((y) => y.ad).join(' · ') + ')');
  console.log('  YÜKLE    ' + yukle.reduce((t, y) => t + y.parcalar.length, 0) + ' parça · ' + MiB(topla(yukle)));
  yukle.forEach((y) => y.parcalar.forEach((p, i) => {
    console.log('    ' + parcaAnahtari(y, i).padEnd(19) + ' ' + y.ad.padEnd(10) + ' ' + MiB(p.boyut).padStart(10) + '  ' + goreli(path.join(cikti, p.dosya)));
  }));
  console.log('\nProgramın güncellemesi — YALNIZ Canlı Not\'un sahibi oturum (skill canli-not §1); sayfa yenilenmez:' +
    '\n  1. node tools/canli-not.js duman' + odakEki +
    '\n  2. Her YÜKLE dosyası ayrı çağrıda: Artifact publish url:<adres> asset:true file_path:<dosya>  → id' +
    '\n  3. node tools/canli-not.js yayin' + odakEki + ' --parca <özet>=<id> [--parca …] [--notlar <…>]  → yazımı ve silinecekleri söyler');
  console.log('Sayfanın yayını (yalnız tools/canli-not* değiştiyse): Artifact publish url:<adres> file_path=' + goreli(s.yol) + '   (files YOK)');
  return { sayfa: s.yol, mfsim: mfsim, plan: plan, planYol: planYol, boyut: plan.boyut, ayar: s.ayar, durum: durum };
}

// SAYFANIN YAYINI — yalnız sayfa. Program gömülmediği için derlenmez; sayfa ana dalın
// şablonu ve çekirdeğiyle kurulur, program kayıttaki yayından (yayin/son) yüklenir.
function sayfaYayini(o) {
  const env = Object.assign({}, process.env);
  if (!o.dal) anaDalKapisi(env);
  const s = sayfaYaz(o.cikti || yayinDizini(o), env, o.odak);
  console.log('Sayfa hazır · ' + (s.ayar.surum || '(git yok)') + (s.ayar.pr ? ' · PR #' + s.ayar.pr : '') + (o.dal ? ' · DAL KURULUMU — YAYINLANMAZ' : ''));
  console.log('  Artifact publish url:<adres> file_path=' + goreli(s.yol) + '   (files YOK; program kayıttaki yayından yüklenir)');
  return { sayfa: s.yol, ayar: s.ayar, boyut: s.boyut };
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
// BELGE ODAĞI (çekirdek → ODAKLAR, `belge`): çerçeveye giden belge programın ÜRETTİĞİDİR —
// derlenmiş program (file://, ağsız) gerçek tarayıcıda açılır, belge programın kendi yolundan
// alınır; elle kurulmaz. Üretici odağın adıyla.
const BELGE_URET = {
  // Parametrik Analiz'in HTML raporu (js/mount-param-html.js): Tulga örneği (Parametrik
  // Analiz'in odaklı sayfasıyla aynı), varsayılan adaylar, tarama; indirme düğmesinin yolu
  // (veMntParamHtmlIndir) — dosya indirilmez, belge döner.
  'param-html': async (sayfa) => {
    await sayfa.evaluate(() => { const n = createNode('mount-analysis', 400, 300); veMntOpenEditor(n.id); });
    await sayfa.waitForTimeout(500);
    await sayfa.evaluate(() => veMntOrnekYukle('tulga'));
    await sayfa.waitForFunction(() => nodes.filter((n) => n.type === 'mnt-mount').length >= 3, null, { timeout: 30000 });
    const id = await sayfa.evaluate(() => createNode('mnt-parametric', 1200, 120).id);
    await sayfa.evaluate((i) => veMntParamTara(i), id);
    await sayfa.waitForFunction((i) => !_MNT_PARAM_IS && !!_MNT_PARAM_SONUC[i], id, { timeout: 600000 });
    return sayfa.evaluate((i) => { window._mntParamDosyaIndir = function () {}; return veMntParamHtmlIndir(i); }, id);
  }
};
async function belgeUret(ad, programYolu) {
  if (!BELGE_URET[ad]) throw new Error('belge üreticisi yok: ' + ad);
  const { chromium } = require('playwright');
  const tarayici = await chromium.launch(tarayiciYolu() ? { executablePath: tarayiciYolu() } : {});
  const hatalar = [];
  try {
    const sayfa = await tarayici.newPage({ viewport: { width: 1440, height: 900 } });
    sayfa.on('pageerror', (e) => hatalar.push(String(e && e.message ? e.message : e)));
    await sayfa.route(/^https?:/, (r) => r.abort());
    await sayfa.addInitScript((a) => { try { localStorage.setItem('mfsim_auth_token', a); } catch (e) { /* özel pencere */ } }, girisAnahtari());
    await sayfa.goto('file://' + programYolu);
    await girisGec(sayfa);
    const html = await BELGE_URET[ad](sayfa);
    if (hatalar.length) throw new Error('belge üretilirken sayfa hatası: ' + hatalar.slice(0, 3).join(' | '));
    if (typeof html !== 'string' || !/^<!doctype html>/i.test(html)) throw new Error('belge üretilmedi: ' + ad);
    return html;
  } finally {
    await tarayici.close();
  }
}

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

// Programın girişi: giriş anahtarı initScript'te; karşılama geçilir, açılış perdesi beklenir.
async function girisGec(sayfa) {
  await sayfa.waitForFunction(() => typeof window.createNode === 'function', null, { timeout: 120000 });
  await sayfa.evaluate(() => { if (typeof veSelectModuleFromOverlay === 'function') veSelectModuleFromOverlay('arac-performans'); });
  await sayfa.waitForFunction(() => { const e = document.getElementById('mfsim-loading-screen'); return !e || e.style.display === 'none'; }, null, { timeout: 120000 });
}

async function sonuc(o) {
  const no = Number(o.konum[0]);
  if (!(Number.isInteger(no) && no > 0)) throw new Error('not numarası gerekli (örnek: sonuc 36)');
  // Belge odağının notu belgenin kendisinde: hazirla'nın ürettiği (köprü üst pencere yokken kurulmaz).
  const odak = CN.odakBul(o.odak), belge = !!(odak && odak.belge);
  const dosya = o.dosya || (belge ? path.join(yayinDizini(o), 'mfsim.html') : path.join(KOK, 'MFSim_Code.html'));
  if (!fs.existsSync(dosya)) {
    throw new Error((path.relative(KOK, dosya) || dosya) + ' yok — önce ' + (belge ? 'node tools/canli-not.js hazirla --dal --odak ' + o.odak : 'npm run build'));
  }
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
    if (belge) await sayfa.waitForFunction(() => window.__cnBelge === true, null, { timeout: 120000 });
    else await girisGec(sayfa);
    if (o.modul) {
      await sayfa.evaluate((g) => { const n = createNode(g.tip, 400, 300); window[g.ac](n.id); }, MODUL_GIRIS[o.modul]);
      await sayfa.waitForTimeout(700);
    }
    if (o.ornek) {
      await sayfa.evaluate((k) => veMntOrnekYukle(k), o.ornek);
      await sayfa.waitForTimeout(900);
    }
    // Odaklı sayfanın notu: sayfanın açtığı yerin AYNISI — köprünün tarifi metin olarak.
    if (o.odak && !belge) {
      await sayfa.evaluate('(' + require('./canli-not-kopru.js').ODAKLAR[o.odak].toString() + ')(window)');
      await sayfa.waitForTimeout(400);
    }
    if (hazirlik) await sayfa.evaluate('(async () => { const bekle = (ms) => new Promise((r) => setTimeout(r, ms));\n' + hazirlik + '\n})()');
    // Bildirim görüntüye girmez (Not 1001'in ilk görüntüsünde "Örnek yüklendi" pencereyi örttü,
    // görüntü yeniden alındı): sönmesi beklenir — bildirim 2,5 sn yaşar, en çok 6 sn.
    await sayfa.waitForFunction(() => !document.querySelector('.ve-toast'), null, { timeout: 6000 }).catch(() => {});
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

// ── duman: açılış denemesi ─────────────────────────────────────────────────
// Yayından ÖNCE: hazırlanan sayfa ile parçalar gerçek tarayıcıda. Sahte kayıt planı
// gösterir (kimlikler özetten), parçalar diskten gelir; sayfa indirir, açar (gzip —
// tarayıcının DecompressionStream'i), birleştirir ve çerçeveye koyar. Node'daki geri
// kurma denetimi tarayıcının yolunu koşmaz: sıkıştırmayı açan kod yalnız burada çalışır.
const DUMAN_KOK = 'https://canli-not.test/';
function dumanKaydi(plan) {
  const dosya = {}, parcalar = [];
  plan.yuvalar.forEach((y) => y.parcalar.forEach((p, i) => {
    const id = (y.ozet + String(i).padStart(2, '0') + '0'.repeat(32)).slice(0, 32);
    dosya[id] = p.dosya;
    parcalar.push({ yuva: y.yuva, id: id, ozet: y.ozet, boyut: p.boyut || 0, sik: y.sik });
  }));
  const kayit = yayinKaydi({ shortSha: plan.surum || '0000000', sha: plan.sha || '', prNumber: plan.pr || '' },
    { boyut: plan.boyut, uzunluk: plan.uzunluk, parcalar: parcalar }, [], '2026-01-01T00:00:00.000Z');
  return { kayit: kayit, dosya: dosya };
}

async function duman(o) {
  const cikti = o.cikti || yayinDizini(o);
  const planYol = path.join(cikti, 'yayin-plan.json'), sayfaYol = path.join(cikti, 'canli-not.html');
  if (!fs.existsSync(planYol) || !fs.existsSync(sayfaYol)) throw new Error('yayın hazır değil — önce: node tools/canli-not.js hazirla' + (o.odak ? ' --odak ' + o.odak : ''));
  const plan = JSON.parse(fs.readFileSync(planYol, 'utf8'));
  const d = dumanKaydi(plan);
  const sayfaMetni = fs.readFileSync(sayfaYol, 'utf8');
  const belge = '<!doctype html><html><head><meta charset="utf-8"></head><body>' + sayfaMetni + '</body></html>';
  // Odaklı sayfa: program açılınca bileşenin penceresi de açılmalı (sayfanın kendi ayarından).
  const ayarM = /var AYAR = (\{[^\n]*?\}) \|\| \{\};/.exec(sayfaMetni);
  const odak = CN.odakBul(ayarM ? JSON.parse(ayarM[1]).odak : '');
  let odakDurum = '';
  const { chromium } = require('playwright');
  const tarayici = await chromium.launch(tarayiciYolu() ? { executablePath: tarayiciYolu() } : {});
  const hatalar = [], ag = [];
  let sure = 0, surum = '', indirilen = 0, kare = 0, yoklama = 0;
  try {
    const sayfa = await tarayici.newPage({ viewport: { width: 1440, height: 900 } });
    sayfa.on('pageerror', (e) => hatalar.push(String(e && e.message ? e.message : e)));
    await sayfa.route('**/*', (r) => {
      const u = r.request().url();
      if (u === DUMAN_KOK) return r.fulfill({ contentType: 'text/html; charset=utf-8', body: belge });
      const m = /^https:\/\/canli-not\.test\/_blob\/([0-9a-f]{32})$/.exec(u);
      if (m && d.dosya[m[1]]) { indirilen++; return r.fulfill({ contentType: 'text/plain; charset=utf-8', body: fs.readFileSync(path.join(cikti, d.dosya[m[1]])) }); }
      if (/^(data|blob|about):/.test(u)) return r.continue();
      // Sayılmayan üç istek: sayfanın yazı tipi; karesiz yayında programın aradığı karşılama
      // karesi; programın kendi sürüm yoklaması (js/deploy-status.js — file:// dışında açılıştan
      // 2 sn sonra: version.json, olmazsa GitHub'ın koşu listesi; odaklı sayfanın dumanı o kadar sürer).
      if (/^https:\/\/canli-not\.test\/assets\/karsilama\//.test(u)) kare++;
      else if (/^https:\/\/canli-not\.test\/version\.json\?t=\d+$|^https:\/\/api\.github\.com\/repos\/[\w.-]+\/[\w.-]+\/actions\/runs\?per_page=1$/.test(u)) yoklama++;
      else if (!/^https:\/\/fonts\.(googleapis|gstatic)\.com\//.test(u)) ag.push(u);
      return r.abort();
    });
    await sayfa.addInitScript((v) => {
      try { localStorage.setItem('mfsim_auth_token', v.anahtar); } catch (e) { /* özel pencere */ }
      if (window.top !== window) return;                       // sahte kayıt yalnız sayfada
      const db = {
        collection: () => ({ orderBy: () => ({ onSnapshot: (f) => { setTimeout(() => f({ docs: [] }), 0); return () => {}; } }) }),
        doc: (p) => ({
          onSnapshot: (f) => { if (p === 'yayin/son') setTimeout(() => f({ exists: true, data: () => v.kayit }), 0); return () => {}; },
          set: () => Promise.resolve(), update: () => Promise.resolve()
        })
      };
      window.claude = { use: (ad) => Promise.resolve(ad === 'db' ? db : null) };
    }, { kayit: d.kayit, anahtar: girisAnahtari() });
    const t0 = Date.now();
    await sayfa.goto(DUMAN_KOK);
    // köprünün 'basladi' olayı açılış perdesini kaldırır: program parçalardan kuruldu ve çalışıyor
    await sayfa.waitForFunction(() => { const e = document.getElementById('cn-acilis'); return e && e.hidden; }, null, { timeout: 120000 });
    const cerceve = sayfa.frames().find((f) => f !== sayfa.mainFrame());
    if (!cerceve) throw new Error('program çerçevesi yok');
    const belgeOdak = !!(odak && odak.belge);
    if (belgeOdak) await cerceve.waitForFunction(() => window.__cnBelge === true && !!window.veRapor, null, { timeout: 120000 });
    else await cerceve.waitForFunction(() => typeof window.createNode === 'function', null, { timeout: 120000 });
    sure = Date.now() - t0;
    surum = await sayfa.evaluate(() => document.getElementById('cn-surum').textContent);
    const uzunluk = await sayfa.evaluate(() => (document.getElementById('cn-program').getAttribute('srcdoc') || '').length);
    if (uzunluk !== plan.uzunluk) hatalar.push('çerçevedeki program ' + uzunluk + ' karakter, plan ' + plan.uzunluk);
    if (odak) {
      await sayfa.waitForFunction(() => /^(tamam|hata)$/.test(document.getElementById('cn').getAttribute('data-odak') || ''), null, { timeout: 120000 });
      odakDurum = await sayfa.evaluate(() => document.getElementById('cn').getAttribute('data-odak'));
      // Bileşen odağında penceresi açık mı; belge odağında belge çizildi mi (Özet'in satırları).
      const acik = belgeOdak
        ? await cerceve.evaluate(() => document.querySelectorAll('#ve-ozet tbody tr').length > 0)
        : await cerceve.evaluate((tip) => {
          const k = typeof veMufettisKonusu === 'function' ? veMufettisKonusu() : null;
          return !!(k && k.type === tip && document.querySelector('.ve-properties-content [data-mnt-pencere="' + k.id + '"]'));
        }, odak.tip);
      if (odakDurum !== 'tamam' || !acik) hatalar.push('odak: ' + odak.ad + (belgeOdak ? ' açılmadı' : ' penceresi açılmadı') + ' (' + odakDurum + ')');
    }
  } finally {
    await tarayici.close();
  }
  console.log('Duman · ' + (surum || '?') + ' · ' + indirilen + ' parça indirildi · açılış ' + (sure / 1000).toFixed(1).replace('.', ',') + ' sn · ' +
    hatalar.length + ' hata · ' + ag.length + ' ağ isteği' + (kare ? ' (karşılama karesi ' + kare + ': bu yayında kare yok)' : '') +
    (yoklama ? ' (sürüm yoklaması ' + yoklama + ': programın kendisi)' : '') +
    (odak ? ' · odak ' + odak.ad + ': ' + (odakDurum === 'tamam' ? 'açıldı' : odakDurum || 'yok') : ''));
  hatalar.slice(0, 5).forEach((h) => console.log('  ! ' + h));
  ag.slice(0, 5).forEach((u) => console.log('  ağ: ' + u));
  if (hatalar.length) throw new Error('duman: sayfa hatası — yayınlama');
  return { sure: sure, surum: surum, indirilen: indirilen, hatalar: hatalar, ag: ag, odak: odakDurum };
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
  if (o.komut === 'sayfa') return sayfaYayini(o);
  if (o.komut === 'duman') return duman(o);
  if (o.komut === 'denetle') return denetle(o);
  if (o.komut === 'yayin') return yayin(o);
  if (o.komut === 'liste') return liste(o);
  if (o.komut === 'goruntu') return goruntu(o);
  if (o.komut === 'sonuc') return sonuc(o);
  throw new Error('bilinmeyen komut: ' + o.komut + ' (hazirla · sayfa · duman · yayin · denetle · liste · goruntu · sonuc)');
}

if (require.main === module) {
  ana(process.argv.slice(2)).catch((e) => { console.error('✗ ' + (e && e.message ? e.message : e)); process.exit(1); });
}

module.exports = { ayristir, notlarAyristir, parcaAyristir, kopruGom, sayfaKur, sayfaYayini, govde, notlariOku, listeSatiri, fotoAc, kunyeOku,
  yayinKaydi, yayinOku, guncellikHukmu, sayfaHukmu, girisAnahtari, ekranAyristir, alanAyristir, MODUL_GIRIS, GIRDILER, CEKIRDEK_CAPA, AYAR_CAPA,
  ESIK, PARCA_SINIRI, VARLIK_SINIRI, ozetle, parcala, paketle, paketAc, bol, planKur, planBirlestir, parcaAnahtari, planKarsilastir, yayinKur,
  yayinVarliklari, oturumKimligi, oturumAdresi, sahipHukmu, siraHukmu, dokumOku, dumanKaydi, yayin, denetle,
  BASLIK_CAPA, yayinDizini, dokumDizini, belgeKunyele, BELGE_URET };
