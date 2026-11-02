#!/usr/bin/env node
'use strict';
/**
 * kullanim-tahta.js — kullanım notlarının KARAR TAHTASI (2026-11-02)
 * ───────────────────────────────────────────────────────────────────────────
 *   node tools/kullanim-tahta.js [--girdi .kullanim/bulgular.json]
 *                                [--cikti .kullanim/tahta.html]
 *                                [--genislik 1600] [--kalite 0.84]
 *
 * Kullanım masasının (tools/kullanim.js) bulguları → tek HTML sayfa: her
 * bulgu bir pafta (görsel · gözlem · beklenti · ölçüm · öneri), kararı
 * (Düzelt · Kalsın · Sonra + not) sayfanın Artifact deposuna `karar/<id>`
 * olarak yazılır; Claude kararları oradan okur. Yayın: capabilities {db: {}}.
 *
 * Görsel KIRPILIR, bulgunun yeri kırmızı REVİZYON BULUTUYLA işaretlenir
 * (çizim incelemesinin işareti), JPEG'e indirilir — kırpma ve işaret CSS px,
 * ekran görüntüsünün kendi koordinatında (dpr ile çarpılır).
 *
 * DOĞRULAMA KAPISI: eksik alan, bilinmeyen tür/önem, tekrar eden kimlik,
 * kanıtsız bulgu (görsel de ölçüm de yok), olmayan görsel → betik DURUR.
 * Yarım tahta sessizce yayımlanırsa kararın hangi bulguya ait olduğu kayar.
 *
 * Bulgu biçimi ve protokol: skill `kullanim`.
 */
const fs = require('fs');
const path = require('path');

const KOK = path.join(__dirname, '..');
const SABLON = path.join(__dirname, 'kullanim-tahta.html');
const CAPA = '/*__VERI__*/null';
const BASLIK_CAPA = '<title>__BASLIK__</title>';
const SINIR_MB = 15;

const TURLER = { konfor: 'Konfor', kalite: 'Kalite', estetik: 'Estetik', dogruluk: 'Doğruluk' };
const ONEMLER = { yuksek: 'Yüksek', orta: 'Orta', dusuk: 'Düşük' };

function ayristir(argv) {
  const dizin = path.resolve(process.env.KULLANIM_DIZIN || path.join(KOK, '.kullanim'));
  const o = { girdi: path.join(dizin, 'bulgular.json'), cikti: path.join(dizin, 'tahta.html'), genislik: 1600, kalite: 0.84 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const deger = () => { if (i + 1 >= argv.length) throw new Error(a + ' bir değer ister'); return argv[++i]; };
    if (a === '--girdi') o.girdi = path.resolve(deger());
    else if (a === '--cikti') o.cikti = path.resolve(deger());
    else if (a === '--genislik') o.genislik = Number(deger());
    else if (a === '--kalite') o.kalite = Number(deger());
    else if (a === '--help' || a === '-h') o.yardim = true;
    else throw new Error('bilinmeyen bayrak: ' + a);
  }
  if (!(o.genislik >= 480 && o.genislik <= 3840)) throw new Error('--genislik 480–3840 olmalı');
  if (!(o.kalite > 0 && o.kalite <= 1)) throw new Error('--kalite 0–1 arası olmalı');
  return o;
}

const metinMi = (v) => typeof v === 'string' && v.trim().length > 0;
const dortSayi = (k) => Array.isArray(k) && k.length === 4 && k.every((n) => typeof n === 'number' && Number.isFinite(n)) && k[2] > 0 && k[3] > 0;

// Saf: hata listesi döner (boşsa geçerli). varMi(yol) diskte arar.
function dogrula(v, varMi) {
  const h = [];
  if (!v || typeof v !== 'object' || Array.isArray(v)) return ['bulgular bir nesne olmalı'];
  ['modul', 'tarih', 'surum', 'ekran'].forEach((k) => { if (!metinMi(v[k])) h.push('üst alan eksik: ' + k); });
  if (v.dpr !== undefined && !(typeof v.dpr === 'number' && v.dpr >= 1 && v.dpr <= 4)) h.push('dpr 1–4 arası bir sayı olmalı');
  ['izlenim', 'kosul', 'baslik'].forEach((k) => { if (v[k] !== undefined && !metinMi(v[k])) h.push(k + ' boş olamaz (alanı kaldırın)'); });
  if (!Array.isArray(v.bulgular) || !v.bulgular.length) { h.push('bulgular boş'); return h; }
  const gorulen = new Set();
  v.bulgular.forEach((b, i) => {
    if (!b || typeof b !== 'object') { h.push('bulgu #' + (i + 1) + ': nesne olmalı'); return; }
    const yer = 'bulgu ' + (metinMi(b.id) ? b.id : '#' + (i + 1));
    ['id', 'baslik', 'tur', 'onem', 'yuzey', 'gozlem', 'beklenti'].forEach((k) => { if (!metinMi(b[k])) h.push(yer + ': ' + k + ' eksik'); });
    if (metinMi(b.id)) {
      if (!/^[A-Za-z0-9-]{1,12}$/.test(b.id)) h.push(yer + ': kimlik harf, rakam, tire olmalı (en çok 12)');
      if (gorulen.has(b.id)) h.push(yer + ': kimlik tekrar ediyor');
      gorulen.add(b.id);
    }
    if (metinMi(b.tur) && !TURLER[b.tur]) h.push(yer + ': tür ' + Object.keys(TURLER).join(' | ') + ' olmalı');
    if (metinMi(b.onem) && !ONEMLER[b.onem]) h.push(yer + ': önem ' + Object.keys(ONEMLER).join(' | ') + ' olmalı');
    ['olcum', 'oneri', 'kural'].forEach((k) => { if (b[k] !== undefined && !metinMi(b[k])) h.push(yer + ': ' + k + ' boş olamaz (alanı kaldırın)'); });
    if (b.adimlar !== undefined && !(Array.isArray(b.adimlar) && b.adimlar.length && b.adimlar.every(metinMi))) h.push(yer + ': adimlar boş olmayan metin listesi olmalı');
    const g = b.gorseller === undefined ? [] : b.gorseller;
    if (!Array.isArray(g)) { h.push(yer + ': gorseller liste olmalı'); return; }
    if (!g.length && !metinMi(b.olcum)) h.push(yer + ': kanıt yok (görsel ya da ölçüm)');
    g.forEach((x, j) => {
      const gy = yer + ' görsel ' + (j + 1);
      const yol = typeof x === 'string' ? x : x && x.yol;
      if (!metinMi(yol)) { h.push(gy + ': yol eksik'); return; }
      if (!varMi(yol)) h.push(gy + ': dosya yok: ' + yol);
      if (typeof x === 'object') {
        if (x.kirp !== undefined && !dortSayi(x.kirp)) h.push(gy + ': kirp [x, y, g, y] olmalı');
        if (x.isaret !== undefined && !(Array.isArray(x.isaret) && x.isaret.every(dortSayi))) h.push(gy + ': isaret [[x, y, g, y], …] olmalı');
        if (x.not !== undefined && !metinMi(x.not)) h.push(gy + ': not boş olamaz');
      }
    });
  });
  return h;
}

// ── TARAYICIDA: kırp, revizyon bulutu çiz, küçült, JPEG ────────────────────
async function gorselIsle({ b64, tip, kirp, isaret, dpr, genislik, kalite }) {
  const img = new Image();
  img.src = 'data:' + tip + ';base64,' + b64;
  await img.decode();
  const s = dpr || 1;
  let kx = 0, ky = 0, kw = img.naturalWidth, kh = img.naturalHeight;
  if (kirp) {
    kx = Math.max(0, Math.round(kirp[0] * s));
    ky = Math.max(0, Math.round(kirp[1] * s));
    kw = Math.min(img.naturalWidth - kx, Math.round(kirp[2] * s));
    kh = Math.min(img.naturalHeight - ky, Math.round(kirp[3] * s));
    if (kw <= 0 || kh <= 0) throw new Error('kırpma görselin dışında');
  }
  const olcek = Math.min(1, genislik / kw);
  const c = document.createElement('canvas');
  c.width = Math.round(kw * olcek);
  c.height = Math.round(kh * olcek);
  const g = c.getContext('2d');
  g.imageSmoothingQuality = 'high';
  g.drawImage(img, kx, ky, kw, kh, 0, 0, c.width, c.height);
  const KIRMIZI = '#b3302a';
  const kalin = Math.max(2, 2.6 * Math.max(olcek * s, 0.75));
  // Revizyon bulutu: dikdörtgenin her kenarı dışa bakan yaylarla çizilir.
  const bulut = (x, y, w, hh) => {
    const pay = 6 * Math.max(olcek * s, 0.75);
    x -= pay; y -= pay; w += 2 * pay; hh += 2 * pay;
    const r0 = Math.max(6, 11 * Math.max(olcek * s, 0.75));
    const kenar = (x1, y1, x2, y2, bas, son) => {
      const uz = Math.hypot(x2 - x1, y2 - y1);
      const n = Math.max(2, Math.round(uz / (2 * r0)));
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n;
        const cx = x1 + (x2 - x1) * t, cy = y1 + (y2 - y1) * t;
        g.beginPath();
        g.arc(cx, cy, uz / n / 2, bas, son, false);
        g.stroke();
      }
    };
    g.strokeStyle = KIRMIZI;
    g.lineWidth = kalin;
    g.lineCap = 'round';
    kenar(x, y, x + w, y, Math.PI, 2 * Math.PI);
    kenar(x + w, y, x + w, y + hh, -Math.PI / 2, Math.PI / 2);
    kenar(x + w, y + hh, x, y + hh, 0, Math.PI);
    kenar(x, y + hh, x, y, Math.PI / 2, 3 * Math.PI / 2);
    return { x, y };
  };
  (isaret || []).forEach((k, i) => {
    const X = (k[0] * s - kx) * olcek, Y = (k[1] * s - ky) * olcek;
    const W = k[2] * s * olcek, H = k[3] * s * olcek;
    const kose = bulut(X, Y, W, H);
    if (isaret.length > 1) {
      const r = Math.max(9, 12 * Math.max(olcek * s, 0.75));
      // Rozet görselin içinde kalır (kenara dayalı işaretin köşesi dışarıda).
      kose.x = Math.min(Math.max(kose.x, r + 2), c.width - r - 2);
      kose.y = Math.min(Math.max(kose.y, r + 2), c.height - r - 2);
      g.beginPath();
      g.arc(kose.x, kose.y, r, 0, 2 * Math.PI);
      g.fillStyle = KIRMIZI;
      g.fill();
      g.fillStyle = '#ffffff';
      g.font = '600 ' + Math.round(r * 1.2) + 'px sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(String(i + 1), kose.x, kose.y + 0.5);
    }
  });
  return { src: c.toDataURL('image/jpeg', kalite), w: c.width, h: c.height };
}

const TIPLER = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };

async function main() {
  const o = ayristir(process.argv.slice(2));
  if (o.yardim) {
    console.log('Kullanım: node tools/kullanim-tahta.js [--girdi <bulgular.json>] [--cikti <tahta.html>] [--genislik 1600] [--kalite 0.84]');
    return;
  }
  if (!fs.existsSync(o.girdi)) throw new Error('girdi yok: ' + path.relative(KOK, o.girdi));
  const veri = JSON.parse(fs.readFileSync(o.girdi, 'utf8'));
  const coz = (yol) => path.resolve(KOK, yol);
  const hatalar = dogrula(veri, (yol) => fs.existsSync(coz(yol)) && !!TIPLER[path.extname(yol).toLowerCase()]);
  if (hatalar.length) throw new Error('bulgular geçersiz (' + hatalar.length + '):\n  ' + hatalar.join('\n  '));

  const sablon = fs.readFileSync(SABLON, 'utf8');
  if (!sablon.includes(CAPA)) throw new Error('şablonda veri çapası yok: ' + CAPA);
  if (!sablon.includes(BASLIK_CAPA)) throw new Error('şablonda başlık çapası yok: ' + BASLIK_CAPA);

  const { chromium } = require('playwright');
  const exe = process.env.MFSIM_CHROMIUM || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
  const tarayici = await chromium.launch(exe ? { executablePath: exe } : {});
  const sayfa = await tarayici.newPage();
  await sayfa.goto('about:blank');
  const cikti = Object.assign({}, veri, { bulgular: [] });
  let gorselSayisi = 0;
  try {
    for (const b of veri.bulgular) {
      const yeni = Object.assign({}, b, { gorseller: [] });
      for (const x of (b.gorseller || [])) {
        const g = typeof x === 'string' ? { yol: x } : x;
        const tam = coz(g.yol);
        const r = await sayfa.evaluate(gorselIsle, {
          b64: fs.readFileSync(tam).toString('base64'), tip: TIPLER[path.extname(tam).toLowerCase()],
          kirp: g.kirp || null, isaret: g.isaret || null, dpr: veri.dpr || 1, genislik: o.genislik, kalite: o.kalite
        }).catch((e) => { throw new Error(b.id + ' · ' + g.yol + ': ' + e.message); });
        yeni.gorseller.push({ src: r.src, w: r.w, h: r.h, not: g.not || '' });
        gorselSayisi++;
      }
      cikti.bulgular.push(yeni);
    }
  } finally {
    await tarayici.close();
  }
  // Sayfaya gömülen JSON: </script> kapanışı ve satır ayırıcılar kaçışlanır.
  const json = JSON.stringify(cikti).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  const baslik = String(veri.baslik || 'MFSim kullanım notları').replace(/[<>&]/g, '');
  const html = sablon.replace(BASLIK_CAPA, '<title>' + baslik + '</title>').replace(CAPA, json);
  const mb = Buffer.byteLength(html) / 1048576;
  if (mb > SINIR_MB) throw new Error('tahta ' + mb.toFixed(1) + ' MB — sınır ' + SINIR_MB + ' MB (görselleri kırpın ya da --genislik/--kalite düşürün)');
  fs.mkdirSync(path.dirname(o.cikti), { recursive: true });
  fs.writeFileSync(o.cikti, html);
  const say = (alan, k) => veri.bulgular.filter((b) => b[alan] === k).length;
  console.log(veri.bulgular.length + ' bulgu · ' + gorselSayisi + ' görsel · ' +
    Object.keys(ONEMLER).map((k) => ONEMLER[k].toLocaleLowerCase('tr') + ' ' + say('onem', k)).join(' · '));
  console.log(path.relative(KOK, o.cikti) + ' · ' + mb.toFixed(2) + ' MB · yayın: capabilities {db: {}}');
}

if (require.main === module) main().catch((e) => { console.error('HATA: ' + e.message); process.exit(1); });

module.exports = { ayristir, dogrula, TURLER, ONEMLER };
