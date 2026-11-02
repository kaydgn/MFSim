#!/usr/bin/env node
'use strict';
/**
 * kullanim.js — KULLANIM MASASI (2026-11-02)
 * ───────────────────────────────────────────────────────────────────────────
 * Programı bir KULLANICI gibi kullanmak için kalıcı tarayıcı + komut kanalı.
 * shot.js tek kare çekip tarayıcıyı kapatır; masa açık kalır: girilen değer,
 * açılan pencere, geri-al yığını adımlar arasında yaşar.
 *
 * Kullanıcının koşulları taklit edilir:
 *   - aynı dosya: MFSim_Code.html, file:// ile (npm run build üretir)
 *   - çevrimdışı: her http(s) isteği kesilir ve SAYILIR
 *   - insan açılışı: navigator.webdriver=false → yükleyici süs beklemelerini
 *     yapar (js/loader.js OTOMASYON yalnız otomasyonda kısaltıyor)
 *   - tr-TR, Europe/Istanbul, işletim sistemi açık renk
 *   - kalıcı profil (.kullanim/profil): localStorage açılışlar arası yaşar
 *   - ekran: Windows'ta tam pencere tarayıcının görünür alanı (EKRANLAR)
 *
 * EYLEM GERÇEK GİRDİYLE (fare, klavye, tekerlek — tarayıcıya güvenilir olay
 * olarak gider); sayfanın içinden yalnız OKUNUR. Her adım ölçülür: süre, uzun
 * görevler (donma), etkileşim gecikmesi (Event Timing — INP'nin ham verisi),
 * kare aralığı, bildirimler, diyaloglar, konsol, ağ, indirmeler, bellek.
 *
 *   node tools/kullanim.js baslat [--ekran masaustu] [--tema acik] [--temiz]
 *   node tools/kullanim.js adim "<ad>" - <<'JS'
 *     await tikla(rol('button', 'Hesapla'));
 *   JS
 *   node tools/kullanim.js foto [<ad>] [--secici <css>]
 *   node tools/kullanim.js buyut --kutu x,y,g,y [--kat 3] | --secici <css>
 *   node tools/kullanim.js yeniden | durum | dur
 *
 * Bilinen sınırlar: Segoe UI yok (yazı tipi gömülü Inter'e düşer); işletim
 * sisteminin çizdiği öğeler (title ipucu, açık <select> listesi, sağ tık
 * menüsü, kaydet penceresi) görüntüye girmez — okunur ya da kaydedilir.
 *
 * Çıktılar .kullanim/ altında (git'e dâhil değil). Protokol: skill `kullanim`.
 */
const fs = require('fs');
const path = require('path');
const http = require('http');

const KOK = path.join(__dirname, '..');
const DIZIN = path.resolve(process.env.KULLANIM_DIZIN || path.join(KOK, '.kullanim'));
const MASA = path.join(DIZIN, 'masa.json');
const GUNLUK = path.join(DIZIN, 'gunluk.jsonl');
const VARSAYILAN_PORT = 47321;

// Windows 11, tarayıcı tam pencere: görev çubuğu (48 px) ve sekme + adres
// çubuğu (87 px) ekrandan düşülür; ölçekli ekranda ikisi de ölçekle küçülür.
// Tahmindir — gerçek ölçü biliniyorsa --genislik/--yukseklik/--dpr verilir.
const EKRANLAR = {
  masaustu: { genislik: 1920, yukseklik: 945, dpr: 1, ad: '1920×1080 · %100 · tam pencere' },
  dizustu: { genislik: 1536, yukseklik: 756, dpr: 1.25, ad: '1920×1080 · %125 · tam pencere' },
  kucuk: { genislik: 1366, yukseklik: 633, dpr: 1, ad: '1366×768 · %100 · tam pencere' },
  tam: { genislik: 1920, yukseklik: 1080, dpr: 1, ad: '1920×1080 · %100 · tam ekran' }
};
const TEMALAR = ['acik', 'koyu', 'sistem'];

const YARDIM = [
  'Kullanım masası — programı kullanıcı gibi kullanmak için kalıcı tarayıcı',
  '',
  '  baslat   [--ekran ' + Object.keys(EKRANLAR).join('|') + '] [--genislik G --yukseklik Y --dpr n]',
  '           [--tema ' + TEMALAR.join('|') + '] [--temiz] [--otomasyon] [--port n] [--dosya <html>]',
  '  adim     "<ad>" <kod | ->   [--secici <css>] [--fotosuz] [--zaman <ms>] [--json]',
  '  foto     [<ad>] [--secici <css>] [--tam]',
  '  buyut    --kutu x,y,g,y | --secici <css>   [--kat 3]',
  '  yeniden  dosyayı yeniden aç (profil korunur, açılış ölçülür)',
  '  durum    [--json]',
  '  dur',
  '',
  'Adım kodunda hazır olanlar: page ctx tikla ciftTikla sagTikla yaz bas tuslar ustune surukle',
  '  teker bekle bekleGorunur bekleKosul rol yazi etiket ipucu metin metinler mevcut gorunur kutu',
  '  odak imlec ipucuOku secenekler sec dosyaSec diyalog kaydetPenceresi sekme pdf pano',
  '  sayiOku olc foto buyut'
].join('\n');

// ── saf yardımcılar (testli) ───────────────────────────────────────────────
const KOMUTLAR = ['baslat', 'adim', 'foto', 'buyut', 'yeniden', 'durum', 'dur', 'yardim'];
const DEGERLI = {
  baslat: ['ekran', 'genislik', 'yukseklik', 'dpr', 'tema', 'port', 'dosya'],
  adim: ['secici', 'zaman'],
  foto: ['secici'],
  buyut: ['kutu', 'secici', 'kat']
};
const BAYRAK = {
  baslat: ['temiz', 'otomasyon'],
  adim: ['fotosuz', 'json', 'tam'],
  foto: ['tam', 'json'],
  durum: ['json']
};

function sayiBayrak(v, ad, alt, ust) {
  const n = Number(v);
  if (!Number.isFinite(n) || n < alt || n > ust) throw new Error('--' + ad + ' ' + alt + '–' + ust + ' arası bir sayı olmalı (gelen: ' + v + ')');
  return n;
}

// Bilinmeyen bayrak SESSİZCE yutulmaz: yanlış yazılmış "--secic" adımı
// çalıştırır ama yanlış yüzeyin görüntüsünü verir (shot.js'in dersi).
function ayristir(argv) {
  const komut = argv[0];
  if (!komut || komut === '-h' || komut === '--help') return { komut: 'yardim' };
  if (!KOMUTLAR.includes(komut)) throw new Error('bilinmeyen komut: ' + komut + '\n\n' + YARDIM);
  const o = { komut, konum: [] };
  for (let i = 1; i < argv.length; i++) {
    const a = argv[i];
    if (a.length > 2 && a.startsWith('--')) {
      const ad = a.slice(2);
      if ((DEGERLI[komut] || []).includes(ad)) {
        if (i + 1 >= argv.length) throw new Error('--' + ad + ' bir değer ister');
        o[ad] = argv[++i];
      } else if ((BAYRAK[komut] || []).includes(ad)) o[ad] = true;
      else throw new Error(komut + ': bilinmeyen bayrak --' + ad);
    } else o.konum.push(a);
  }
  if (komut === 'baslat') {
    const on = o.ekran || 'masaustu';
    if (!EKRANLAR[on]) throw new Error('--ekran ' + Object.keys(EKRANLAR).join(' | ') + ' olmalı (gelen: ' + on + ')');
    const e = Object.assign({}, EKRANLAR[on]);
    if (o.genislik !== undefined) e.genislik = sayiBayrak(o.genislik, 'genislik', 800, 3840);
    if (o.yukseklik !== undefined) e.yukseklik = sayiBayrak(o.yukseklik, 'yukseklik', 500, 2160);
    if (o.dpr !== undefined) e.dpr = sayiBayrak(o.dpr, 'dpr', 1, 3);
    if (o.genislik !== undefined || o.yukseklik !== undefined || o.dpr !== undefined) {
      e.ad = e.genislik + '×' + e.yukseklik + ' · %' + Math.round(e.dpr * 100);
    }
    o.ekranAyar = e;
    if (o.tema !== undefined && !TEMALAR.includes(o.tema)) throw new Error('--tema ' + TEMALAR.join(' | ') + ' olmalı');
    o.port = o.port !== undefined ? sayiBayrak(o.port, 'port', 1024, 65535) : VARSAYILAN_PORT;
  }
  if (komut === 'adim') {
    if (o.konum.length !== 2) throw new Error('adim "<ad>" <kod | ->  (kod "-" ise standart girdiden okunur)');
    o.ad = o.konum[0];
    o.kod = o.konum[1];
    o.zaman = o.zaman !== undefined ? sayiBayrak(o.zaman, 'zaman', 1000, 600000) : 60000;
  }
  if (komut === 'foto') o.ad = o.konum[0] || 'foto';
  if (komut === 'buyut') {
    if (!o.kutu === !o.secici) throw new Error('buyut: --kutu x,y,g,y YA DA --secici <css>');
    if (o.kutu) {
      const k = String(o.kutu).split(',').map(Number);
      if (k.length !== 4 || k.some((n) => !Number.isFinite(n)) || k[2] <= 0 || k[3] <= 0) throw new Error('--kutu x,y,genişlik,yükseklik (CSS px)');
      o.kutu = { x: k[0], y: k[1], width: k[2], height: k[3] };
    }
    o.kat = o.kat !== undefined ? sayiBayrak(o.kat, 'kat', 1, 8) : 3;
  }
  return o;
}

// Dosya adı için güvenli kısa ad (Türkçe harfler sadeleşir).
function kisaAd(s) {
  const tr = { 'ç': 'c', 'ğ': 'g', 'ı': 'i', 'ö': 'o', 'ş': 's', 'ü': 'u', 'â': 'a', 'î': 'i', 'û': 'u' };
  return String(s || '').toLocaleLowerCase('tr').replace(/[çğıöşüâîû]/g, (c) => tr[c])
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'adim';
}

// Ekrandaki Türkçe sayıyı okur: "1.716,25 mm" → 1716.25 · "−7" → -7 · "%97,0" → 97.
// Virgülsüz noktalı yazım ondalıktır ("1.5"), programın okuyucusu gibi.
function sayiOku(metin) {
  const m = /[-−+]?\s*%?\s*\d[\d.]*(,\d+)?/.exec(String(metin).replace(/ /g, ' '));
  if (!m) return NaN;
  let s = m[0].replace(/[\s%]/g, '').replace('−', '-');
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  return Number(s);
}

// Uzun bir değeri günlüğe ve çıktıya sığacak boya indirir.
function kisalt(v, sinir) {
  if (v === undefined) return undefined;
  let s;
  try { s = typeof v === 'string' ? v : JSON.stringify(v); } catch (e) { s = String(v); }
  const n = sinir || 2000;
  return s.length > n ? s.slice(0, n) + '… (+' + (s.length - n) + ' karakter)' : s;
}

// Sayfadan gelen ham ölçüleri adım özetine çevirir.
//   uzun:  [[başlangıç, süre], …]   olay: [[başlangıç, süre, tür, gecikme, işleme], …]
function ozetle(ham) {
  const uzun = ham.uzun || [];
  const olay = ham.olay || [];
  const toplam = uzun.reduce((t, x) => t + x[1], 0);
  const sirali = olay.slice().sort((a, b) => b[1] - a[1]);
  return {
    donma: { adet: uzun.length, enUzun: Math.round(uzun.reduce((m, x) => Math.max(m, x[1]), 0)), toplam: Math.round(toplam) },
    etkilesim: {
      enYavas: sirali.slice(0, 3).map((x) => ({ tur: x[2], sure: Math.round(x[1]) })),
      yavas: olay.filter((x) => x[1] >= 200).length
    },
    kare: ham.kare ? {
      adet: ham.kare.n,
      fps: ham.kare.sure > 0 ? Math.round(ham.kare.n / (ham.kare.sure / 1000)) : 0,
      enUzunAra: Math.round(ham.kare.enUzun)
    } : null,
    bellekMB: ham.bellek ? Math.round(ham.bellek / 1048576) : null
  };
}

// Adım kaydını okunur birkaç satıra çevirir (istemcinin çıktısı).
function kayitMetni(k) {
  const L = [];
  const o = k.olcu || {};
  L.push('#' + String(k.no).padStart(4, '0') + ' ' + k.ad + ' · ' + k.sure + ' ms' + (k.sakin ? ' (+' + k.sakin + ' ms sakinleşme)' : ''));
  if (k.hata) L.push('  HATA: ' + k.hata);
  if (o.donma && o.donma.adet) L.push('  donma: ' + o.donma.adet + ' uzun görev · en uzun ' + o.donma.enUzun + ' ms · toplam ' + o.donma.toplam + ' ms');
  if (o.etkilesim && o.etkilesim.enYavas.length) {
    L.push('  etkileşim: ' + o.etkilesim.enYavas.map((x) => x.tur + ' ' + x.sure + ' ms').join(' · ') +
      (o.etkilesim.yavas ? ' · ' + o.etkilesim.yavas + ' olay ≥ 200 ms' : ''));
  }
  const ey = k.eylem || {};
  // Kare hızı yalnız hareketli adımda anlamlı (sürükle, tekerlek, üstüne gel)
  // ya da bir kare 100 ms'yi aştıysa (takılma).
  const hareket = ey['sürükle'] || ey.tekerlek || ey['üstüne gel'];
  if (o.kare && o.kare.adet > 1 && (hareket || o.kare.enUzunAra > 100)) L.push('  kare: ' + o.kare.adet + ' (' + o.kare.fps + ' fps) · en uzun ara ' + o.kare.enUzunAra + ' ms');
  const eyMetin = Object.keys(ey).filter((x) => ey[x]).map((x) => x + ' ' + ey[x]).join(' · ');
  if (eyMetin) L.push('  eylem: ' + eyMetin);
  (k.olaylar || []).forEach((x) => {
    if (x.tur === 'bildirim') L.push('  bildirim [' + (x.seviye || 'bilgi') + ']: ' + x.metin);
    else if (x.tur === 'diyalog') L.push('  diyalog ' + x.tip + ': "' + x.metin + '" → ' + x.yanit);
    else if (x.tur === 'konsol') L.push('  konsol [' + x.seviye + ']: ' + x.metin);
    else if (x.tur === 'sayfaHatasi') L.push('  SAYFA HATASI: ' + x.metin);
    else if (x.tur === 'ag') L.push('  ağ isteği (kesildi): ' + x.url);
    else if (x.tur === 'indirme') L.push('  indirme: ' + x.ad + ' (' + x.boyut + ' bayt) → ' + x.yol);
    else if (x.tur === 'kaydet') L.push('  kaydet penceresi: "' + x.onerilen + '" → ' + x.yanit + (x.yol ? ' → ' + x.yol : ''));
    else if (x.tur === 'yazdir') L.push('  yazdır penceresi: ' + x.baslik);
    else if (x.tur === 'dosyaPenceresi') L.push('  dosya seçme penceresi → ' + (x.dosya || 'iptal (bekleyen dosya yok)'));
    else if (x.tur === 'yeniSayfa') L.push('  yeni sekme: ' + x.url);
  });
  if (o.bellekMB) L.push('  bellek: ' + o.bellekMB + ' MB');
  if (k.sonuc !== undefined) L.push('  sonuç: ' + k.sonuc);
  if (k.goruntu) L.push('  görüntü: ' + k.goruntu);
  return L.join('\n');
}

// ── TARAYICIDA: ölçü düzeneği (her çerçevede, açılıştan önce) ───────────────
function sayfaDuzenegi(ayar) {
  if (ayar.insan) {
    try { Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false, configurable: true }); } catch (e) { /* yok */ }
  }
  try {
    if (ayar.giris && location.protocol === 'file:') localStorage.setItem('mfsim_auth_token', ayar.giris);
    if (ayar.tema && location.protocol === 'file:') localStorage.setItem('mf-theme', ayar.tema);
  } catch (e) { /* depolama kapalı */ }

  const not = (tur, veri) => { try { window.__kullanimNot(tur, veri); } catch (e) { /* bağlanmadı */ } };
  // Yazdır: kullanıcı önizleme penceresini görür; masa kaydeder, açmaz.
  window.print = function () { not('yazdir', { baslik: document.title || '' }); };
  // Sistem kaydet penceresi: önerilen ad kabul edilir (ya da masanın yanıtı).
  if (window.showSaveFilePicker) {
    window.showSaveFilePicker = async function (o) {
      const ad = (o && o.suggestedName) || 'adsiz';
      const yanit = await window.__kullanimKaydetSor(ad);
      if (yanit === 'iptal') throw new DOMException('Kullanıcı vazgeçti', 'AbortError');
      const parca = [];
      return {
        kind: 'file', name: yanit,
        getFile: async () => new File(parca, yanit),
        createWritable: async () => ({
          write: async (d) => { parca.push(d && typeof d === 'object' && 'data' in d && d.type ? d.data : d); },
          close: async () => {
            const b = new Uint8Array(await new Blob(parca).arrayBuffer());
            let s = '';
            for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
            await window.__kullanimKaydet(yanit, btoa(s));
          }
        })
      };
    };
  }
  if (window.top !== window || window.__kullanim) return;
  const K = window.__kullanim = { uzun: [], olay: [], sonUzunBitis: 0, kare: null };
  const sinirla = (d) => { if (d.length > 5000) d.splice(0, d.length - 5000); };
  try {
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) {
        K.uzun.push([e.startTime, e.duration]);
        K.sonUzunBitis = Math.max(K.sonUzunBitis, e.startTime + e.duration);
      }
      sinirla(K.uzun);
    }).observe({ type: 'longtask', buffered: true });
  } catch (e) { /* desteklenmiyor */ }
  try {
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) K.olay.push([e.startTime, e.duration, e.name, e.processingStart - e.startTime, e.processingEnd - e.processingStart]);
      sinirla(K.olay);
    }).observe({ type: 'event', durationThreshold: 16, buffered: true });
  } catch (e) { /* desteklenmiyor */ }
  // Bildirimler: showToast tanımlanınca sarılır (metin-turu.js ile aynı yol).
  const sar = () => {
    if (typeof window.showToast !== 'function') return false;
    if (window.showToast.__kullanim) return true;
    const asil = window.showToast;
    window.showToast = function (m, tur) { not('bildirim', { metin: String(m), seviye: tur || 'bilgi' }); return asil.apply(this, arguments); };
    window.showToast.__kullanim = true;
    return true;
  };
  const sayac = setInterval(() => { if (sar()) clearInterval(sayac); }, 50);
}

// ── MASA (arka planda koşan süreç) ─────────────────────────────────────────
function tarayiciYolu() {
  if (process.env.MFSIM_CHROMIUM) return process.env.MFSIM_CHROMIUM;
  const kurulu = '/opt/pw-browsers/chromium';
  return fs.existsSync(kurulu) ? kurulu : undefined;
}

function girisOzeti() {
  try {
    const m = /MFSIM_AUTH_HASH\s*=\s*'([0-9a-f]{64})'/.exec(fs.readFileSync(path.join(KOK, 'js', 'auth.js'), 'utf8'));
    return m ? m[1] : null;
  } catch (e) { return null; }
}

// Dosyaya gömülü künye (build.js → MFSIM_BUILD): "7c94ad5 · PR #1206".
function surumKunyesi(dosya) {
  try {
    const metin = fs.readFileSync(dosya, 'utf8');
    const i = metin.indexOf('MFSIM_BUILD = {');
    if (i < 0) return null;
    const parca = metin.slice(i, i + 4000);
    const sha = /"shortSha":"([0-9a-f]+)"/.exec(parca);
    const pr = /"prNumber":(\d+)/.exec(parca);
    return sha ? sha[1] + (pr ? ' · PR #' + pr[1] : '') : null;
  } catch (e) { return null; }
}

async function baslat(o) {
  if (await masaCanli()) throw new Error('masa zaten açık — önce: node tools/kullanim.js dur');
  const dosya = path.resolve(KOK, o.dosya || 'MFSim_Code.html');
  if (!fs.existsSync(dosya)) throw new Error(path.relative(KOK, dosya) + ' yok — önce: npm run build');
  const profil = path.join(DIZIN, 'profil');
  if (o.temiz) fs.rmSync(profil, { recursive: true, force: true });
  ['goruntu', 'indirilen'].forEach((d) => fs.mkdirSync(path.join(DIZIN, d), { recursive: true }));
  const e = o.ekranAyar;
  const { chromium } = require('playwright');
  const ctx = await chromium.launchPersistentContext(profil, {
    headless: true,
    executablePath: tarayiciYolu(),
    viewport: { width: e.genislik, height: e.yukseklik },
    deviceScaleFactor: e.dpr,
    locale: 'tr-TR',
    timezoneId: 'Europe/Istanbul',
    colorScheme: 'light',
    acceptDownloads: true
  });
  ctx.setDefaultTimeout(15000);
  try { await ctx.grantPermissions(['clipboard-read', 'clipboard-write']); } catch (err) { /* desteklenmiyor */ }

  const S = {
    ctx, dosya, url: 'file://' + dosya, ekran: e, sayac: sonAdimNo(), olaylar: [], yardimci: null,
    diyalogYaniti: 'kabul', kaydetYaniti: 'kabul', bekleyenDosya: null, eylem: {}, acilis: null
  };
  S.not = (tur, veri) => { S.olaylar.push(Object.assign({ tur, t: Date.now() }, veri)); if (S.olaylar.length > 20000) S.olaylar.splice(0, 5000); };

  await ctx.exposeFunction('__kullanimNot', (tur, veri) => S.not(tur, veri || {}));
  await ctx.exposeFunction('__kullanimKaydetSor', (ad) => {
    const y = S.kaydetYaniti;
    S.kaydetYaniti = 'kabul';
    const yanit = y === 'kabul' ? ad : y;
    if (yanit === 'iptal') S.not('kaydet', { onerilen: ad, yanit: 'iptal' });
    return yanit;
  });
  await ctx.exposeFunction('__kullanimKaydet', (ad, b64) => {
    const yol = benzersizYol(path.join(DIZIN, 'indirilen'), ad);
    fs.writeFileSync(yol, Buffer.from(b64, 'base64'));
    S.not('kaydet', { onerilen: ad, yanit: 'kabul', yol: path.relative(KOK, yol) });
  });
  await ctx.addInitScript(sayfaDuzenegi, { insan: !o.otomasyon, giris: girisOzeti(), tema: o.tema || null });
  // Çevrimdışı: kullanıcının ağı GitHub'a da Pages'e de çıkamıyor (kök CLAUDE.md).
  await ctx.route(/^https?:\/\//, (r) => { S.not('ag', { url: r.request().url().slice(0, 200) }); return r.abort('internetdisconnected'); });

  const bagla = (p) => {
    p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') S.not('konsol', { seviye: m.type(), metin: m.text().slice(0, 400) }); });
    p.on('pageerror', (err) => S.not('sayfaHatasi', { metin: String(err.message).slice(0, 400), yigin: String(err.stack || '').split('\n').slice(1, 4).join(' | ') }));
    p.on('dialog', async (d) => {
      const y = S.diyalogYaniti;
      S.diyalogYaniti = 'kabul';
      S.not('diyalog', { tip: d.type(), metin: d.message().slice(0, 400), yanit: y });
      try { if (y === 'red') await d.dismiss(); else await d.accept(y === 'kabul' ? undefined : String(y)); } catch (err) { /* kapandı */ }
    });
    p.on('download', async (d) => {
      const yol = benzersizYol(path.join(DIZIN, 'indirilen'), d.suggestedFilename());
      try { await d.saveAs(yol); S.not('indirme', { ad: d.suggestedFilename(), boyut: fs.statSync(yol).size, yol: path.relative(KOK, yol) }); } catch (err) { S.not('indirme', { ad: d.suggestedFilename(), boyut: 0, yol: 'kaydedilemedi: ' + err.message }); }
    });
    p.on('filechooser', async (fc) => {
      const dosyaYolu = S.bekleyenDosya;
      S.bekleyenDosya = null;
      S.not('dosyaPenceresi', { dosya: dosyaYolu ? path.relative(KOK, dosyaYolu) : null });
      if (dosyaYolu) { try { await fc.setFiles(dosyaYolu); } catch (err) { S.not('sayfaHatasi', { metin: 'dosya verilemedi: ' + err.message }); } }
    });
  };
  ctx.on('page', (p) => {
    if (S.yardimciKuruluyor || p === S.yardimci) return;
    bagla(p);
    S.not('yeniSayfa', { url: p.url().slice(0, 200) });
  });
  S.ana = ctx.pages()[0] || await ctx.newPage();
  bagla(S.ana);
  S.aktif = S.ana;

  S.acilis = await ac(S);
  const sunucu = http.createServer((req, res) => istek(S, req, res));
  await new Promise((coz, red) => {
    sunucu.once('error', (err) => {
      if (err.code !== 'EADDRINUSE') return red(err);
      sunucu.listen(0, '127.0.0.1', coz);
    });
    sunucu.listen(o.port, '127.0.0.1', coz);
  });
  S.sunucu = sunucu;
  const bilgi = {
    port: sunucu.address().port, pid: process.pid, baslangic: new Date().toISOString(),
    dosya: path.relative(KOK, dosya), surum: surumKunyesi(dosya), ekran: e,
    insan: !o.otomasyon, profil: path.relative(KOK, profil)
  };
  fs.writeFileSync(MASA, JSON.stringify(bilgi, null, 1));
  const kapat = async () => {
    try { fs.unlinkSync(MASA); } catch (err) { /* yok */ }
    try { await ctx.close(); } catch (err) { /* kapandı */ }
    process.exit(0);
  };
  S.kapat = kapat;
  process.on('SIGINT', kapat);
  process.on('SIGTERM', kapat);
  console.log('HAZIR · port ' + bilgi.port + ' · ' + e.ad + ' · ' + (bilgi.insan ? 'insan açılışı' : 'otomasyon açılışı'));
  console.log(kayitMetni(S.acilis));
}

function benzersizYol(dizin, ad) {
  const temiz = String(ad || 'dosya').replace(/[\\/:*?"<>|]+/g, '_');
  const uz = path.extname(temiz), kok = temiz.slice(0, temiz.length - uz.length);
  let yol = path.join(dizin, temiz), i = 2;
  while (fs.existsSync(yol)) yol = path.join(dizin, kok + ' (' + (i++) + ')' + uz);
  return yol;
}

// Numara masa yeniden başlasa da sürer: günlüğün ve görüntü klasörünün en
// büyüğü (büyüteç ve PDF günlüğe yazılmaz ama numara alır).
function sonAdimNo() {
  let n = 0;
  try {
    const satirlar = fs.readFileSync(GUNLUK, 'utf8').trim().split('\n');
    n = JSON.parse(satirlar[satirlar.length - 1]).no || 0;
  } catch (e) { /* günlük yok */ }
  try {
    fs.readdirSync(path.join(DIZIN, 'goruntu')).forEach((f) => { const m = /^(\d+)-/.exec(f); if (m) n = Math.max(n, +m[1]); });
  } catch (e) { /* klasör yok */ }
  return n;
}

// Dosyayı açar ve programın kullanılabilir olmasını bekler: giriş ve açılış
// ekranı kapalı, çekirdek yüklü. Açılış da bir adım gibi ölçülür.
async function ac(S, yeniden) {
  return adimKos(S, { ad: yeniden ? 'Yeniden aç' : 'Aç', foto: true, zaman: 200000 }, async () => {
    const p = S.ana;
    if (yeniden) await p.reload({ waitUntil: 'domcontentloaded' });
    else await p.goto(S.url, { waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => {
      const gor = (id) => { const el = document.getElementById(id); return !!el && getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden'; };
      return document.readyState === 'complete' && !gor('mfsim-loading-screen') && !gor('mfsim-login-overlay') && typeof window.createNode === 'function';
    }, null, { timeout: 180000 });
    S.aktif = p;
    return null;
  }, { kareYok: true });
}

// ── adım: kod + ölçü + görüntü + günlük ────────────────────────────────────
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

function yardimcilar(S) {
  const say = (ad) => { S.eylem[ad] = (S.eylem[ad] || 0) + 1; };
  const P = () => S.aktif;
  const loc = (h) => {
    if (h && typeof h === 'object' && typeof h.click === 'function') return h;
    if (typeof h === 'string') return P().locator(h);
    throw new Error('hedef bir seçici ya da Locator olmalı');
  };
  const nokta = async (h) => {
    if (h && typeof h.x === 'number' && typeof h.y === 'number') return h;
    const k = await loc(h).boundingBox();
    if (!k) throw new Error('hedef görünür değil: ' + h);
    return { x: k.x + k.width / 2, y: k.y + k.height / 2 };
  };
  const Y = {
    rol: (r, ad, o) => P().getByRole(r, Object.assign({ name: ad, exact: true }, o || {})),
    // Kullanıcı yalnız GÖRÜNENE dokunur: gizli kopya (kapalı sütundaki ad)
    // hedefi belirsizleştirmesin.
    yazi: (m, o) => P().getByText(m, Object.assign({ exact: true }, o || {})).filter({ visible: true }),
    etiket: (m, o) => P().getByLabel(m, Object.assign({ exact: true }, o || {})).filter({ visible: true }),
    ipucu: (m, o) => P().getByTitle(m, Object.assign({ exact: true }, o || {})).filter({ visible: true }),
    tikla: async (h, o) => {
      o = o || {};
      say(o.sag ? 'sağ tık' : o.cift ? 'çift tık' : 'tık');
      if (h && typeof h.x === 'number') return P().mouse.click(h.x, h.y, { button: o.sag ? 'right' : 'left', clickCount: o.cift ? 2 : 1 });
      return loc(h).click({ button: o.sag ? 'right' : 'left', clickCount: o.cift ? 2 : 1, position: o.konum, modifiers: o.tuslar, timeout: o.zaman });
    },
    ciftTikla: (h, o) => Y.tikla(h, Object.assign({}, o, { cift: true })),
    sagTikla: (h, o) => Y.tikla(h, Object.assign({}, o, { sag: true })),
    yaz: async (h, metin, o) => {
      o = o || {};
      await Y.tikla(h);
      if (o.temizle !== false) { await P().keyboard.press('Control+A'); say('tuş'); }
      await P().keyboard.type(String(metin), { delay: o.gecikme === undefined ? 20 : o.gecikme });
      S.eylem['tuş'] = (S.eylem['tuş'] || 0) + String(metin).length;
      if (o.enter) { await P().keyboard.press('Enter'); say('tuş'); }
      if (o.tab) { await P().keyboard.press('Tab'); say('tuş'); }
    },
    bas: async (tus) => { say('tuş'); return P().keyboard.press(tus); },
    tuslar: async (metin) => { S.eylem['tuş'] = (S.eylem['tuş'] || 0) + String(metin).length; return P().keyboard.type(String(metin), { delay: 20 }); },
    ustune: async (h) => { say('üstüne gel'); const n = await nokta(h); return P().mouse.move(n.x, n.y, { steps: 6 }); },
    surukle: async (kaynak, hedef, o) => {
      o = o || {};
      say('sürükle');
      const a = await nokta(kaynak);
      const b = hedef && typeof hedef.dx === 'number' ? { x: a.x + hedef.dx, y: a.y + (hedef.dy || 0) } : await nokta(hedef);
      const m = P().mouse;
      await m.move(a.x, a.y, { steps: 4 });
      await m.down({ button: o.sag ? 'right' : 'left' });
      await m.move(b.x, b.y, { steps: o.adim || 24 });
      if (o.bekle) await new Promise((r) => setTimeout(r, o.bekle));
      await m.up({ button: o.sag ? 'right' : 'left' });
    },
    teker: async (h, dy, o) => {
      o = o || {};
      say('tekerlek');
      const n = await nokta(h);
      await P().mouse.move(n.x, n.y);
      if (o.ctrl) await P().keyboard.down('Control');
      const adim = o.adim || 1;
      for (let i = 0; i < adim; i++) await P().mouse.wheel(o.dx || 0, dy / adim);
      if (o.ctrl) await P().keyboard.up('Control');
    },
    bekle: (ms) => new Promise((r) => setTimeout(r, ms)),
    bekleGorunur: (h, zaman) => loc(h).first().waitFor({ state: 'visible', timeout: zaman || 15000 }),
    bekleKosul: (fn, arg, zaman) => P().waitForFunction(fn, arg, { timeout: zaman || 30000 }),
    metin: (h) => loc(h).first().innerText(),
    metinler: (h) => loc(h).allInnerTexts(),
    mevcut: async (h) => (await loc(h).count()) > 0,
    gorunur: (h) => loc(h).first().isVisible(),
    kutu: (h) => loc(h).first().boundingBox(),
    ipucuOku: (h) => loc(h).first().getAttribute('title'),
    secenekler: (h) => loc(h).first().evaluate((el) => Array.from(el.options || []).map((x) => ({ deger: x.value, metin: x.text, secili: x.selected }))),
    sec: async (h, deger) => { say('seçim'); return loc(h).first().selectOption(deger); },
    odak: () => P().evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      return { etiket: el.tagName.toLowerCase(), id: el.id || null, sinif: String(el.className || '').slice(0, 80), ad: el.getAttribute('aria-label') || el.getAttribute('title') || (el.innerText || el.value || '').slice(0, 60) };
    }),
    imlec: async (h) => { const n = await nokta(h); return P().evaluate(({ x, y }) => { const el = document.elementFromPoint(x, y); return el ? getComputedStyle(el).cursor : null; }, n); },
    dosyaSec: (yol) => { S.bekleyenDosya = path.resolve(KOK, yol); },
    diyalog: (yanit) => { S.diyalogYaniti = yanit; },
    kaydetPenceresi: (yanit) => { S.kaydetYaniti = yanit; },
    sekme: async (i) => {
      const sayfalar = S.ctx.pages().filter((p) => p !== S.yardimci);
      const p = i === undefined ? sayfalar[sayfalar.length - 1] : sayfalar[i];
      if (!p) throw new Error('sekme yok: ' + i + ' (' + sayfalar.length + ' sekme)');
      S.aktif = p;
      await p.bringToFront();
      return sayfalar.indexOf(p);
    },
    pdf: async (ad, o) => {
      o = o || {};
      const yol = path.join(DIZIN, 'goruntu', String(++S.sayac).padStart(4, '0') + '-' + kisaAd(ad) + '.pdf');
      await P().pdf({ path: yol, format: o.format || 'A4', landscape: !!o.yatay, printBackground: true, preferCSSPageSize: o.cssSayfa !== false });
      return path.relative(KOK, yol);
    },
    pano: () => P().evaluate(() => navigator.clipboard.readText()),
    sayiOku,
    olc: (fn, arg) => P().evaluate(fn, arg),
    foto: (ad, h) => fotoAl(S, ad, h ? { secici: h } : {}),
    buyut: (kutuYaDaSecici, kat) => buyutAl(S, typeof kutuYaDaSecici === 'string' ? { secici: kutuYaDaSecici, kat } : { kutu: kutuYaDaSecici, kat })
  };
  return Y;
}

async function sayfaOlcBasla(p) {
  return p.evaluate(() => {
    const K = window.__kullanim;
    const bas = performance.now();
    if (K) {
      K.kare = { n: 0, son: bas, enUzun: 0, bas, aktif: true };
      const dongu = (t) => { const k = K.kare; if (!k || !k.aktif) return; k.n++; k.enUzun = Math.max(k.enUzun, t - k.son); k.son = t; requestAnimationFrame(dongu); };
      requestAnimationFrame(dongu);
    }
    return bas;
  }).catch(() => null);
}

// Sakinleşme: son uzun görevin bitişinden 200 ms geçene dek ve SONLU CSS
// geçişleri bitene dek (en çok 10 sn), sonra iki kare — görüntü yarım çizimi
// ya da yarım giriş animasyonunu göstermesin (ilk denemede karşılamanın
// sol sütunu animasyonun ortasında, yarısı boş çekilmişti). Sonsuz
// animasyon (dönen gösterge, slayt) beklenmez.
async function sayfaSakin(p) {
  return p.evaluate(() => new Promise((coz) => {
    const K = window.__kullanim;
    const bas = performance.now();
    const suren = () => document.getAnimations().some((a) => {
      if (a.playState !== 'running') return false;
      const t = a.effect && a.effect.getComputedTiming ? a.effect.getComputedTiming() : null;
      return !!t && Number.isFinite(t.endTime) && t.endTime < 8000;
    });
    (function bak() {
      const son = K ? K.sonUzunBitis : 0;
      const simdi = performance.now();
      if ((simdi - Math.max(son, bas - 200) >= 200 && !suren()) || simdi - bas > 10000) {
        requestAnimationFrame(() => requestAnimationFrame(() => coz(Math.round(performance.now() - bas))));
      } else setTimeout(bak, 40);
    })();
  })).catch(() => null);
}

async function sayfaOlcBitir(p, bas) {
  return p.evaluate((b) => {
    const K = window.__kullanim;
    if (!K) return {};
    const kare = K.kare ? { n: K.kare.n, enUzun: K.kare.enUzun, sure: performance.now() - K.kare.bas } : null;
    if (K.kare) K.kare.aktif = false;
    const sinir = b === null ? -1 : b;
    return {
      uzun: K.uzun.filter((x) => x[0] + x[1] >= sinir),
      olay: K.olay.filter((x) => x[0] >= sinir),
      kare,
      bellek: performance.memory ? performance.memory.usedJSHeapSize : null
    };
  }, bas).catch(() => ({}));
}

async function adimKos(S, istek, govde, ek) {
  const no = ++S.sayac;
  const isaret = S.olaylar.length;
  S.eylem = {};
  const p0 = S.aktif;
  const bas = ek && ek.kareYok ? null : await sayfaOlcBasla(p0);
  const t0 = Date.now();
  let sonuc, hata;
  try {
    sonuc = await Promise.race([
      govde(),
      new Promise((_, red) => setTimeout(() => red(new Error('adım ' + (istek.zaman || 60000) + ' ms içinde bitmedi')), istek.zaman || 60000))
    ]);
  } catch (e) { hata = String(e && e.message || e).split('\n').slice(0, 6).join(' | '); }
  const sure = Date.now() - t0;
  const p = S.aktif;
  const sakin = await sayfaSakin(p);
  const ham = await sayfaOlcBitir(p, p === p0 ? bas : null);
  const kayit = {
    no, ad: istek.ad, zaman: new Date().toISOString(), sure, sakin,
    olcu: ozetle(ham), eylem: Object.assign({}, S.eylem),
    olaylar: S.olaylar.slice(isaret).map((x) => { const y = Object.assign({}, x); delete y.t; return y; }),
    sonuc: kisalt(sonuc), hata, kod: istek.kod
  };
  if (istek.foto !== false) {
    try { kayit.goruntu = await fotoAl(S, istek.ad, { secici: istek.secici, tam: istek.tam, no }); } catch (e) { kayit.goruntu = null; kayit.hata = (kayit.hata ? kayit.hata + ' · ' : '') + 'görüntü: ' + e.message; }
  }
  try { fs.appendFileSync(GUNLUK, JSON.stringify(kayit) + '\n'); } catch (e) { /* disk */ }
  return kayit;
}

async function fotoAl(S, ad, o) {
  o = o || {};
  const no = o.no || ++S.sayac;
  const yol = path.join(DIZIN, 'goruntu', String(no).padStart(4, '0') + '-' + kisaAd(ad) + '.png');
  if (o.secici) await S.aktif.locator(o.secici).first().screenshot({ path: yol });
  else await S.aktif.screenshot({ path: yol, fullPage: !!o.tam });
  return path.relative(KOK, yol);
}

// Büyüteç: kullanıcının ekranındaki PİKSELLER, yumuşatmasız büyütülür
// (1× ekranda bulanık kenar, kayık çizgi ancak böyle görünür).
async function buyutAl(S, o) {
  let kutu = o.kutu;
  if (o.secici) {
    kutu = await S.aktif.locator(o.secici).first().boundingBox();
    if (!kutu) throw new Error('görünür değil: ' + o.secici);
  }
  const kat = o.kat || 3;
  const ham = await S.aktif.screenshot({ clip: kutu, scale: 'device' });
  if (!S.yardimci || S.yardimci.isClosed()) {
    S.yardimciKuruluyor = true;
    try { S.yardimci = await S.ctx.newPage(); } finally { S.yardimciKuruluyor = false; }
  }
  const dpr = S.ekran.dpr || 1;
  const g = Math.round(kutu.width * kat), y = Math.round(kutu.height * kat);
  await S.yardimci.setViewportSize({ width: Math.max(200, Math.min(4000, g)), height: Math.max(100, Math.min(4000, y)) });
  await S.yardimci.setContent('<style>html,body{margin:0;background:#fff}img{display:block;image-rendering:pixelated;width:' + (g / dpr) + 'px;height:' + (y / dpr) + 'px}</style><img src="data:image/png;base64,' + ham.toString('base64') + '">');
  await S.yardimci.waitForFunction(() => document.images[0] && document.images[0].complete);
  const yol = path.join(DIZIN, 'goruntu', String(++S.sayac).padStart(4, '0') + '-buyutec.png');
  await S.yardimci.locator('img').screenshot({ path: yol });
  // Yardımcı sekme programı ÖRTER: örtülen sekmede kare 1 fps'e kısılıyor
  // (ölçüldü: 25 → 1 fps) ve sonraki her ölçüm yanlış çıkıyordu.
  await S.aktif.bringToFront().catch(() => {});
  return path.relative(KOK, yol);
}

function govdeOku(req) {
  return new Promise((coz, red) => {
    const parca = [];
    req.on('data', (c) => parca.push(c));
    req.on('end', () => { try { coz(parca.length ? JSON.parse(Buffer.concat(parca).toString('utf8')) : {}); } catch (e) { red(e); } });
    req.on('error', red);
  });
}

// Adımlar SIRAYLA koşar: iki komut aynı anda fareyi tutmasın.
let sira = Promise.resolve();
function siraya(fn) { const s = sira.then(fn, fn); sira = s.catch(() => {}); return s; }

async function istek(S, req, res) {
  const yanit = (kod, v) => { res.writeHead(kod, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(v)); };
  try {
    const g = await govdeOku(req);
    const yol = String(req.url).split('?')[0];
    if (yol === '/durum') {
      const sayfalar = S.ctx.pages().filter((p) => p !== S.yardimci);
      return yanit(200, { adim: S.sayac, aktif: sayfalar.indexOf(S.aktif), sekmeler: sayfalar.map((p) => p.url().slice(0, 160)), acilis: S.acilis && { sure: S.acilis.sure, olcu: S.acilis.olcu } });
    }
    if (yol === '/dur') { yanit(200, { tamam: true }); return setTimeout(S.kapat, 50); }
    const sonuc = await siraya(async () => {
      if (yol === '/adim') {
        const Y = yardimcilar(S);
        const adlar = ['page', 'ctx'].concat(Object.keys(Y));
        let fn;
        try { fn = new AsyncFunction(...adlar, g.kod); } catch (e) {
          return { no: 0, ad: g.ad, sure: 0, hata: 'kod derlenemedi: ' + e.message, olaylar: [], olcu: {} };
        }
        return adimKos(S, g, () => fn(S.aktif, S.ctx, ...Object.keys(Y).map((k) => Y[k])));
      }
      if (yol === '/foto') return { goruntu: await fotoAl(S, g.ad, { secici: g.secici, tam: g.tam }) };
      if (yol === '/buyut') return { goruntu: await buyutAl(S, g) };
      if (yol === '/yeniden') { const k = await ac(S, true); S.acilis = k; return k; }
      throw new Error('bilinmeyen yol: ' + yol);
    });
    return yanit(200, sonuc);
  } catch (e) {
    return yanit(500, { hata: String(e && e.message || e) });
  }
}

// ── İSTEMCİ ────────────────────────────────────────────────────────────────
function masaBilgisi() {
  try { return JSON.parse(fs.readFileSync(MASA, 'utf8')); } catch (e) { return null; }
}

function gonder(port, yol, govde) {
  return new Promise((coz, red) => {
    const veri = Buffer.from(JSON.stringify(govde || {}), 'utf8');
    const r = http.request({ host: '127.0.0.1', port, path: yol, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': veri.length } }, (res) => {
      const parca = [];
      res.on('data', (c) => parca.push(c));
      res.on('end', () => {
        let v;
        try { v = JSON.parse(Buffer.concat(parca).toString('utf8')); } catch (e) { return red(new Error('masanın yanıtı okunamadı')); }
        if (res.statusCode !== 200) return red(new Error(v.hata || ('masa ' + res.statusCode)));
        coz(v);
      });
    });
    r.on('error', red);
    r.end(veri);
  });
}

async function masaCanli() {
  const b = masaBilgisi();
  if (!b) return false;
  try { await gonder(b.port, '/durum', {}); return true; } catch (e) { return false; }
}

function stdinOku() {
  return new Promise((coz, red) => {
    const parca = [];
    process.stdin.on('data', (c) => parca.push(c));
    process.stdin.on('end', () => coz(Buffer.concat(parca).toString('utf8')));
    process.stdin.on('error', red);
  });
}

async function istemci(o) {
  const b = masaBilgisi();
  if (!b) throw new Error('masa kapalı — önce: node tools/kullanim.js baslat (arka planda)');
  if (o.komut === 'durum') {
    const d = await gonder(b.port, '/durum', {});
    if (o.json) return console.log(JSON.stringify(Object.assign({}, b, d), null, 1));
    console.log('masa açık · port ' + b.port + ' · ' + b.ekran.ad + ' · ' + (b.insan ? 'insan' : 'otomasyon') + ' açılışı');
    console.log('dosya ' + b.dosya + (b.surum ? ' · ' + b.surum : ''));
    console.log('adım ' + d.adim + ' · sekmeler: ' + d.sekmeler.map((u, i) => (i === d.aktif ? '*' : '') + u.replace(/^file:\/\/.*\//, '')).join(' | '));
    return;
  }
  if (o.komut === 'dur') { await gonder(b.port, '/dur', {}); return console.log('masa kapandı'); }
  if (o.komut === 'foto') { const r = await gonder(b.port, '/foto', { ad: o.ad, secici: o.secici, tam: !!o.tam }); return console.log(r.goruntu); }
  if (o.komut === 'buyut') { const r = await gonder(b.port, '/buyut', { kutu: o.kutu, secici: o.secici, kat: o.kat }); return console.log(r.goruntu); }
  if (o.komut === 'yeniden') { const r = await gonder(b.port, '/yeniden', {}); return console.log(kayitMetni(r)); }
  if (o.komut === 'adim') {
    const kod = o.kod === '-' ? await stdinOku() : o.kod;
    const r = await gonder(b.port, '/adim', { ad: o.ad, kod, secici: o.secici, foto: !o.fotosuz, tam: !!o.tam, zaman: o.zaman });
    console.log(o.json ? JSON.stringify(r, null, 1) : kayitMetni(r));
    if (r.hata) process.exitCode = 1;
  }
}

async function main() {
  const o = ayristir(process.argv.slice(2));
  if (o.komut === 'yardim') return console.log(YARDIM);
  fs.mkdirSync(DIZIN, { recursive: true });
  if (o.komut === 'baslat') return baslat(o);
  return istemci(o);
}

if (require.main === module) main().catch((e) => { console.error('HATA: ' + e.message); process.exit(1); });

module.exports = { ayristir, kisaAd, sayiOku, kisalt, ozetle, kayitMetni, EKRANLAR };
