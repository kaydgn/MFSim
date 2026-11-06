#!/usr/bin/env node
// ============================================================================
// tools/belge-sayfa.js — ŞANZIMAN AİLESİNİN BELGESİ → sayfa görselleri + işaretli bölgeler
// ────────────────────────────────────────────────────────────────────────────
// Kullanıcı 2026-11-06 (Canlı Not 52): ailenin belgesi programın içinde açılır,
// seçenekler sayfanın üstünde işaretli bölgelerdir — "PDF ile aynı kalırız".
//
//   node tools/belge-sayfa.js [aile ...] [--resimsiz]
//
// Tanım tools/belge-tanim.js (satırın yazısı → seçtiği değerler). Bu araç:
//   1. sayfayı çizer (pdftoppm, tanımın dpi'si) → webp (Chromium'un kodlayıcısı,
//      tanımın kalitesi) → assets/belge/<aile>/sNN.webp
//   2. satırın konumunu belgenin sözcük kutularından ölçer (pdftotext -bbox-layout)
//      ve satırdaki sayıları okur (metrik değer; parantezdeki ABD birimi atılır)
//   3. js/mount-belge-veri.js'i yazar — ELLE DÜZENLENMEZ
// Gerekenler: poppler (pdftoppm · pdftotext) ve Playwright'ın Chromium'u
// (MFSIM_CHROMIUM). Kapı: tests/unit/mount-belge.test.js.
// ============================================================================
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const KOK = path.join(__dirname, '..');
const TANIM = require('./belge-tanim.js');
const CIKTI_JS = path.join(KOK, 'js', 'mount-belge-veri.js');
const CHROMIUM = process.env.MFSIM_CHROMIUM || '';

// ── Belgenin satırları (pt, sol üst köşeden) ───────────────────────────────
function _ac(s) {
  return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}
function satirlar(pdf, no) {
  const x = execFileSync('pdftotext', ['-bbox-layout', '-f', String(no), '-l', String(no), pdf, '-'], { encoding: 'utf8', maxBuffer: 64 << 20 });
  const L = [], re = /<line xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([\s\S]*?)<\/line>/g;
  let m;
  while ((m = re.exec(x))) {
    const k = [], rw = /<word xMin="([\d.]+)" yMin="[\d.]+" xMax="([\d.]+)" yMax="[\d.]+">([\s\S]*?)<\/word>/g;
    let w;
    while ((w = rw.exec(m[5]))) if (w[3].trim()) k.push({ x0: +w[1], x1: +w[2], t: _ac(w[3].trim()) });
    if (!k.length) continue;
    L.push({ x0: +m[1], y0: +m[2], x1: +m[3], y1: +m[4], t: k.map((q) => q.t).join(' '), k });
  }
  return L.sort((a, b) => (a.y0 - b.y0) || (a.x0 - b.x0));
}
function bul(L, m, tam, yBas) {
  const r = L.find((l) => l.y0 > yBas + 0.5 && (tam ? l.t === m : l.t.indexOf(m) === 0));
  if (!r) throw new Error('satır bulunamadı: "' + m + '" (y > ' + yBas.toFixed(1) + ')');
  return r;
}
// Metrik sayılar, sözcük sözcük: parantezdeki ABD birimi atılır (belgede kapanmayan
// parantez de var: "49.84 (36.76"), "–" eksidir ("– 4.80", "–1.5")
function sayilar(t) {
  const out = [];
  let eksi = false;
  t.split(/\s+/).forEach((w) => {
    if (!w || w[0] === '(' || /\)$/.test(w)) return;
    if (/^[–−-]$/.test(w)) { eksi = true; return; }
    const m = /^([–−-]?)(\d+(?:\.\d+)?)/.exec(w);
    if (!m) { eksi = false; return; }
    out.push((eksi || m[1] ? -1 : 1) * Number(m[2]));
    eksi = false;
  });
  return out;
}
const r1 = (v) => Math.round(v * 10) / 10;

function bolgeKur(sayfa, b, L) {
  const o = { k: null, s: b.s || null, ek: b.ek || null };
  if (b.alan) o.alan = b.alan;
  let kutu, d = null;
  if (b.sutun) {
    // Sütun: iki satırlık başlık ("CLOSE-RATIO" · "(CR) MODELS") → bitis satırının altı
    const bas = bul(L, b.sutun, false, -1), son = bul(L, b.bitis, false, bas.y0);
    const orta = (bas.x0 + bas.x1) / 2, bl = L.filter((l) => l.y0 >= bas.y0 - 1 && l.y0 < bas.y0 + 20 && Math.abs((l.x0 + l.x1) / 2 - orta) < 20);
    const x0 = Math.min.apply(null, bl.map((l) => l.x0)) - 12, x1 = Math.max.apply(null, bl.map((l) => l.x1)) + 12;
    kutu = [x0, bas.y0 - 1, x1, son.y1 - 1];
    d = [];
    L.filter((l) => l.y0 > bas.y1 && l.y0 <= son.y0 + 2 && (l.x0 + l.x1) / 2 > x0 && (l.x0 + l.x1) / 2 < x1)
      .forEach((l) => { d = d.concat(sayilar(l.t)); });
  } else {
    let y = -1;
    (b.sonra || []).forEach((a) => { y = bul(L, a, false, y).y0; });
    const ilk = bul(L, b.m, !!b.tam, y);
    if (b.kutuSon) {
      const son = bul(L, b.kutuSon, false, ilk.y0);
      kutu = [56, ilk.y0 - 2, 556, son.y1 + 4];
    } else {
      let last = ilk;
      for (let n = 1; n < (b.satir || 1); n++) last = L.find((l) => l.y0 > last.y0 + 1 && l.x0 < ilk.x0 + 20 && l.x0 > ilk.x0 - 5);
      kutu = [sayfa.x[0], ilk.y0 + 0.5, sayfa.x[1], last.y1 - 0.5];
      if (b.alan) {
        // Satırın sayıları: adın sağında, adın satırlarının hizasında
        const yler = [ilk.y0, last.y0];
        d = [];
        L.filter((l) => l !== ilk && l !== last && l.x0 > ilk.x1 - 1 && yler.some((q) => Math.abs(l.y0 - q) < 1.6))
          .sort((p, q) => p.x0 - q.x0).forEach((l) => { d = d.concat(sayilar(l.t)); });
      }
    }
  }
  o.k = [r1(kutu[0]), r1(kutu[1]), r1(kutu[2] - kutu[0]), r1(kutu[3] - kutu[1])];
  if (d) o.d = d;
  return o;
}

// Art arda satırların kutuları üst üste binmez (satır kutusu 14 pt, adım 12–13 pt):
// binişin ortasından bölünür — tık hangi satırın olduğunu bilsin
function ayir(B) {
  const S = B.slice().sort((a, b) => a.k[1] - b.k[1]);
  for (let i = 0; i < S.length; i++) for (let j = i + 1; j < S.length; j++) {
    const a = S[i].k, b = S[j].k;
    const yatay = a[0] < b[0] + b[2] && b[0] < a[0] + a[2], aAlt = a[1] + a[3];
    if (!yatay || aAlt <= b[1] || b[1] < a[1]) continue;
    const orta = r1((aAlt + b[1]) / 2);
    a[3] = r1(orta - a[1]);
    b[3] = r1(b[1] + b[3] - orta); b[1] = orta;
  }
  return B;
}

// ── Sayfa görseli: pdftoppm → PNG → webp (Chromium) ─────────────────────────
async function resimler(aile, T, pdf) {
  const { chromium } = require('playwright');
  const dir = path.join(KOK, 'assets', 'belge', aile), gec = fs.mkdtempSync(path.join(os.tmpdir(), 'mfsim-belge-'));
  fs.mkdirSync(dir, { recursive: true });
  const tarayici = await chromium.launch(CHROMIUM ? { executablePath: CHROMIUM } : {});
  const p = await tarayici.newPage();
  const out = {};
  try {
    for (const s of T.sayfalar) {
      const kok = path.join(gec, 's' + s.no);
      execFileSync('pdftoppm', ['-f', String(s.no), '-l', String(s.no), '-r', String(T.dpi), '-png', '-singlefile', pdf, kok]);
      const b64 = fs.readFileSync(kok + '.png').toString('base64');
      const r = await p.evaluate(async ({ b64, q }) => {
        const im = new Image(); im.src = 'data:image/png;base64,' + b64; await im.decode();
        const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
        c.getContext('2d').drawImage(im, 0, 0);
        return { g: c.width, y: c.height, url: c.toDataURL('image/webp', q) };
      }, { b64, q: T.kalite });
      if (!r.url.startsWith('data:image/webp')) throw new Error('tarayıcı webp kodlamadı');
      const ad = 's' + String(s.no).padStart(2, '0') + '.webp', buf = Buffer.from(r.url.split(',')[1], 'base64');
      fs.writeFileSync(path.join(dir, ad), buf);
      out[s.no] = { ad, g: r.g, y: r.y, bayt: buf.length };
    }
  } finally {
    await tarayici.close();
    fs.rmSync(gec, { recursive: true, force: true });
  }
  return out;
}
function mevcutResim(aile, no) {
  const ad = 's' + String(no).padStart(2, '0') + '.webp', f = path.join(KOK, 'assets', 'belge', aile, ad);
  if (!fs.existsSync(f)) throw new Error('görsel yok (--resimsiz): ' + f);
  const { webpOlcu } = require('./karsilama-webp.js');
  const buf = fs.readFileSync(f), o = webpOlcu(buf);
  return { ad, g: o[0], y: o[1], bayt: buf.length };
}

async function main() {
  const arg = process.argv.slice(2), resimsiz = arg.includes('--resimsiz');
  const aileler = arg.filter((a) => !a.startsWith('--'));
  const secili = aileler.length ? aileler : Object.keys(TANIM);
  const veri = {};
  for (const aile of Object.keys(TANIM)) {
    const T = TANIM[aile], pdf = path.join(KOK, T.pdf);
    if (!fs.existsSync(pdf)) throw new Error('belge yok: ' + T.pdf);
    const R = (secili.includes(aile) && !resimsiz) ? await resimler(aile, T, pdf) : null;
    const sayfalar = T.sayfalar.map((s) => {
      const L = satirlar(pdf, s.no), r = R ? R[s.no] : mevcutResim(aile, s.no);
      return { no: s.no, bas: s.bas, resim: 'belge/' + aile + '/' + r.ad, g: r.g, y: r.y, bolge: ayir(s.bolge.map((b) => bolgeKur(s, b, L))) };
    });
    // Sayfanın ölçüsü (pt): görselin pikseli / (dpi / 72)
    veri[aile] = { ad: T.ad, kod: T.kod, tarih: T.tarih, olcu: [r1(sayfalar[0].g * 72 / T.dpi), r1(sayfalar[0].y * 72 / T.dpi)], sayfalar };
    const top = sayfalar.reduce((t, s) => t + fs.statSync(path.join(KOK, 'assets', s.resim)).size, 0);
    console.log(aile + ': ' + sayfalar.length + ' sayfa · ' + sayfalar.reduce((t, s) => t + s.bolge.length, 0) + ' bölge · ' + (top / 1024).toFixed(0) + ' KB');
  }
  const govde = '// ============================================================================\n'
    + '// js/mount-belge-veri.js — ÜRETİLDİ, ELLE DÜZENLENMEZ: node tools/belge-sayfa.js\n'
    + '// (tanım tools/belge-tanim.js). Şanzıman ailesinin belgesi: sayfalar (görsel\n'
    + '// assets/belge/…) ve işaretli bölgeler — k: [x, y, g, y] pt, sayfanın sol üstünden;\n'
    + '// s: tıkın yazdığı seçenekler; ek: seçili sayılma koşulu; d: satırın belgedeki\n'
    + '// sayıları (metrik), alan: programdaki karşılığı. Kapı: tests/unit/mount-belge.test.js.\n'
    + '// ============================================================================\n'
    + 'var VE_MNT_BELGE = ' + JSON.stringify(veri, null, 1).replace(/\n\s*/g, ' ').replace(/\{ "no"/g, '\n  { "no"').replace(/\{ "k"/g, '\n    { "k"') + ';\n'
    + "if(typeof module !== 'undefined' && module.exports) module.exports = { VE_MNT_BELGE: VE_MNT_BELGE };\n";
  fs.writeFileSync(CIKTI_JS, govde);
  console.log('→ ' + path.relative(KOK, CIKTI_JS));
}

if (require.main === module) main().catch((e) => { console.error(e.message || e); process.exit(1); });
module.exports = { satirlar, sayilar, bolgeKur };
