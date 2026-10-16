#!/usr/bin/env node
'use strict';
/**
 * metin-turu.js — ARAYÜZ ANLATMAZ temizliğinin EKRAN TURU (2026-10-16)
 * ───────────────────────────────────────────────────────────────────────────
 * Bir aşamanın yüzeylerini gerçek tarayıcıda açar; görünen her metni yeri,
 * bağlamı (metin · title · placeholder · aria-label) ve kaynak satırıyla
 * toplar, yüzeyin görüntüsünü alır. Kaynak taraması (tools/metin-dili.js)
 * kodda sabit yazılı olmayan metni göremez (karşılamadaki commit listesi);
 * tur görür. Görüntü, karar tahtasında cümlenin yerini göstermek içindir
 * (kullanıcı onayı, 2026-10-16) — tools/shot.js'in "yalnız istenince"
 * kuralı bu turun dışında kalır.
 *
 *   npm run build                                   # tur MFSim_Code.html'i açar
 *   node tools/metin-turu.js --asama 1 [--cikti <dizin>]
 *
 * Çıktı: <dizin>/tur.json + yüzey başına <ad>.jpg (2×).
 */
const fs = require('fs');
const path = require('path');
const T = require('./metin-dili.js');

const KOK = path.join(__dirname, '..');
const URUN = path.join(KOK, 'MFSim_Code.html');

// Tarayıcı: MFSIM_CHROMIUM (CI ve playwright.config ile aynı değişken), yoksa
// konteynerin önceden kurulu Chromium'u, o da yoksa Playwright'ın kendisi.
function tarayiciYolu() {
  if (process.env.MFSIM_CHROMIUM) return process.env.MFSIM_CHROMIUM;
  const kurulu = '/opt/pw-browsers/chromium';
  return fs.existsSync(kurulu) ? kurulu : undefined;
}

// ── TARAYICIDA: kökün altındaki görünür metin blokları ─────────────────────
// Blok: satır içi olmayan en yakın ata. Konum kökün sol üstüne göre CSS px.
function topla(kokSel) {
  const kok = document.querySelector(kokSel);
  if (!kok) return null;
  const kr = kok.getBoundingClientRect();
  const st = (el) => getComputedStyle(el);
  const blokMu = (el) => el === kok || !/^inline/.test(st(el).display);
  const gorunur = (el) => {
    for (let e = el; e && e !== document.documentElement; e = e.parentElement) {
      const s = st(e);
      if (s.visibility === 'hidden' || s.display === 'none' || +s.opacity === 0) return false;
    }
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const bloklar = new Map();
  const tw = document.createTreeWalker(kok, NodeFilter.SHOW_TEXT);
  let t;
  while ((t = tw.nextNode())) {
    if (!t.nodeValue.trim()) continue;
    const el = t.parentElement;
    if (!el || el.closest('script,style,title') || !gorunur(el)) continue;
    let b = el;
    while (b && b !== kok && !blokMu(b)) b = b.parentElement;
    if (!bloklar.has(b)) bloklar.set(b, []);
    bloklar.get(b).push(t);
  }
  // Başka bir yüzeyin altında kalan metin görünmez: ortasındaki noktada üstte
  // duran öğe bloğun kendisi (ya da içi) değilse sayılmaz. Görüş alanı
  // dışındaki nokta sınanamaz; o metin sayılır. İsabet sınaması
  // pointer-events:none öğeyi atlar (boş tuval ipucu) — sınama süresince açılır.
  const ac = document.createElement('style');
  ac.textContent = '*{pointer-events:auto!important}';
  document.head.appendChild(ac);
  const ortulu = (b, rr) => {
    const cx = rr.left + Math.min(rr.width / 2, 8), cy = rr.top + rr.height / 2;
    if (cx < 0 || cy < 0 || cx >= innerWidth || cy >= innerHeight) return false;
    const ust = document.elementFromPoint(cx, cy);
    return !!ust && !b.contains(ust) && !ust.contains(b);
  };
  const out = [];
  for (const [b, ts] of bloklar) {
    const metin = ts.map((x) => x.nodeValue).join(' ').replace(/\s+/g, ' ').trim();
    const r = document.createRange();
    r.setStartBefore(ts[0]); r.setEndAfter(ts[ts.length - 1]);
    const rr = r.getBoundingClientRect();
    if (ortulu(b, rr)) continue;
    out.push({ baglam: 'metin', metin, x: rr.left - kr.left, y: rr.top - kr.top, w: rr.width, h: rr.height,
      etiket: b.tagName.toLowerCase(), sinif: String(b.className || '').slice(0, 80) });
  }
  ac.remove();
  kok.querySelectorAll('[title],[placeholder],[aria-label]').forEach((el) => {
    if (!gorunur(el)) return;
    const r = el.getBoundingClientRect();
    ['title', 'placeholder', 'aria-label'].forEach((a) => {
      const v = el.getAttribute(a);
      if (v && v.trim()) out.push({ baglam: a, metin: v.trim(), x: r.left - kr.left, y: r.top - kr.top, w: r.width, h: r.height, etiket: el.tagName.toLowerCase() });
    });
  });
  return { w: kr.width, h: kr.height, ogeler: out };
}

// ── KAYNAK EŞLEMESİ ────────────────────────────────────────────────────────
// Ekrandaki metin, kaynaktaki metinle eşleşir: kaynak metin ‹› yerlerinden
// parçalara bölünür, parçalar ekrandaki metinde SIRAYLA aranır (düzenli ifade
// değil: ‹› başına bir boşluk deseni uzun satırda geri izlemeye boğuluyordu).
// Önce bütünüyle (ilk parça başta, son parça sonda), olmazsa parça olarak;
// en uzun kaynak metin önce.
function dizinOgesi(x) {
  if (x.sozcuk < 1) return null;
  const parca = x.metin.split('‹›').map((p) => p.trim()).filter(Boolean);
  if (!parca.length) return null;
  return { dosya: x.dosya, satir: x.satir, parca, bas: !x.metin.startsWith('‹›'), son: !x.metin.endsWith('‹›'),
    sozcuk: x.sozcuk, uzun: parca.reduce((t, p) => t + p.length, 0) };
}
function kaynakDizini(ogeler) {
  const out = [];
  for (const x of ogeler || T.kapsam().flatMap((f) => T.metinler(f))) {
    const k = dizinOgesi(x);
    if (k) out.push(k);
  }
  return out.sort((a, b) => b.uzun - a.uzun);
}
function sirali(metin, k, tam) {
  let i = 0;
  for (let n = 0; n < k.parca.length; n++) {
    const j = metin.indexOf(k.parca[n], i);
    if (j < 0) return false;
    if (tam && n === 0 && k.bas && j !== 0) return false;
    i = j + k.parca[n].length;
  }
  return !(tam && k.son && i !== metin.length);
}
// Yer tutuculu kaynak metin en az iki sözcük ve ekrandaki metnin onda biri
// kadar düz yazı taşımalı: "Takoz ‹›" her "Takoz …" satırına uyardı.
function esle(dizin, metin) {
  const yeter = (k, oran) => (k.parca.length === 1 && k.bas && k.son)
    || (k.sozcuk >= 2 && k.uzun >= metin.length * oran);
  const tam = dizin.filter((k) => yeter(k, 0.1) && sirali(metin, k, true));
  if (tam.length) return tam.slice(0, 3).map((k) => ({ dosya: k.dosya, satir: k.satir }));
  const parca = dizin.filter((k) => k.sozcuk >= 2 && k.uzun >= Math.max(6, metin.length / 2) && sirali(metin, k, false));
  return parca.slice(0, 3).map((k) => ({ dosya: k.dosya, satir: k.satir, parca: true }));
}

// ── AŞAMALAR: hangi yüzey nasıl açılır ─────────────────────────────────────
const bildirimleriSil = (p) => p.evaluate(() => document.querySelectorAll('.ve-toast').forEach((t) => t.remove()));
const bekle = (p, ms) => p.waitForTimeout(ms);

const ASAMALAR = {
  1: {
    ad: 'Başlangıç ve karşılama',
    // İnsan açılışı: otomasyonda yükleyici süslemesiz koşar; açılış ekranı ancak
    // insan hızında görünür (js/loader.js › OTOMASYON).
    insan: true,
    yuzeyler: [
      // İlk açılışta şifre sorulur (js/auth.js); tur şifreyi bilmez, yükleyiciyi
      // e2e turu gibi doğrudan başlatır.
      { ad: 'Şifre ekranı', kok: '#mfsim-login-overlay', ac: async (p) => {
        await p.waitForSelector('#mfsim-login-overlay', { state: 'visible', timeout: 60000 });
        await bekle(p, 800);
      } },
      { ad: 'Açılış ekranı', kok: '#mfsim-loading-screen', ac: async (p) => {
        await p.evaluate(() => { if (window.MFSimLoader && MFSimLoader.start) MFSimLoader.start(); });
        await p.waitForFunction(() => {
          const t = document.getElementById('mfsim-loading-tip');
          return t && t.textContent.trim().length > 0;
        }, null, { timeout: 60000 });
        await bekle(p, 600);
      } },
      { ad: 'Karşılama', kok: '#ve-module-overlay .ve-welcome-id', ac: async (p) => {
        await p.waitForFunction(() => typeof window.createNode === 'function' && Array.isArray(window.nodes), null, { timeout: 180000 });
        await p.waitForFunction(() => { const s = document.getElementById('mfsim-loading-screen'); return !s || s.style.display === 'none'; }, null, { timeout: 180000 });
        await bekle(p, 2500);
      } },
      { ad: 'Modül giriş ekranı', kok: '#mfsim-module-loading .mfsim-loading-panel', ac: async (p) => {
        await p.evaluate(() => veStartModule('fead-analysis'));
        await p.waitForFunction(() => {
          const m = document.getElementById('ve-modload-message');
          return m && m.textContent && m.textContent !== 'Hazırlanıyor…';
        }, null, { timeout: 20000 });
        await bekle(p, 250);
      }, bildirim: true },
      // Kök tuvalin kabı: sayfanın üstündeki dönüş düğmesi (ve ipucu) da girsin.
      { ad: 'FEAD başlangıç sayfası', kok: '#ve-canvas-wrapper', ac: async (p) => {
        await p.waitForFunction(() => typeof veFeadBaslangicAcik === 'function' && veFeadBaslangicAcik(), null, { timeout: 30000 });
        await bekle(p, 800);
      }, bildirim: true },
      { ad: 'Takoz başlangıç sayfası', kok: '#ve-canvas-wrapper', ac: async (p) => {
        await p.evaluate(() => { if (typeof veFeadCloseEditor === 'function') veFeadCloseEditor(true); });
        await bekle(p, 500);
        await p.evaluate(() => { const n = createNode('mount-analysis', 900, 300); veMntOpenEditor(n.id); });
        await p.waitForFunction(() => typeof veMntBaslangicAcik === 'function' && veMntBaslangicAcik(), null, { timeout: 30000 });
        await bekle(p, 800);
      }, bildirim: true },
      { ad: 'Boş tuval', kok: '#ve-canvas-wrapper', ac: async (p) => {
        await p.evaluate(() => {
          if (typeof veMntCloseEditor === 'function') veMntCloseEditor(true);
          clearSelection();
          nodes.slice().forEach((n) => addToSelection(n));
          deleteSelectedNodes();
          if (typeof veEmptyHintUpdate === 'function') veEmptyHintUpdate();
        });
        await p.waitForFunction(() => { const e = document.getElementById('ve-empty-hint'); return e && e.classList.contains('visible'); }, null, { timeout: 15000 });
        await bekle(p, 800);
      }, bildirim: true, yalniz: '#ve-empty-hint' }
    ]
  }
};

function ayristir(argv) {
  const o = { asama: null, cikti: null, genislik: 1440, yukseklik: 900 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--asama') o.asama = argv[++i];
    else if (a === '--cikti') o.cikti = path.resolve(argv[++i]);
    else if (a === '--genislik') o.genislik = parseInt(argv[++i], 10);
    else if (a === '--yukseklik') o.yukseklik = parseInt(argv[++i], 10);
    else if (a === '--help' || a === '-h') o.yardim = true;
    else throw new Error('bilinmeyen bayrak: ' + a);
  }
  return o;
}

async function main() {
  const o = ayristir(process.argv.slice(2));
  if (o.yardim || !o.asama) {
    console.log('Kullanım: node tools/metin-turu.js --asama <no> [--cikti <dizin>] [--genislik 1440] [--yukseklik 900]\n'
      + 'Aşamalar: ' + Object.keys(ASAMALAR).map((k) => k + ' (' + ASAMALAR[k].ad + ')').join(', '));
    return;
  }
  const A = ASAMALAR[o.asama];
  if (!A) throw new Error('tanımsız aşama: ' + o.asama);
  if (!fs.existsSync(URUN)) throw new Error('MFSim_Code.html yok — önce: npm run build');
  const cikti = o.cikti || path.join(KOK, 'metin-turu-' + o.asama);
  fs.mkdirSync(cikti, { recursive: true });

  const dizin = kaynakDizini();
  const { chromium } = require('playwright');
  const tarayici = await chromium.launch(tarayiciYolu() ? { executablePath: tarayiciYolu() } : {});
  const sayfa = await tarayici.newPage({ viewport: { width: o.genislik, height: o.yukseklik }, deviceScaleFactor: 2 });
  const hatalar = [];
  const bildirimler = [];
  sayfa.on('pageerror', (e) => hatalar.push(e.message));
  sayfa.on('dialog', (d) => d.accept());
  if (A.insan) await sayfa.addInitScript(() => { Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false }); });
  await sayfa.exposeFunction('__metinTuruBildirim', (m) => bildirimler.push(m));
  await sayfa.addInitScript(() => {
    const kur = () => {
      if (typeof window.showToast !== 'function' || window.showToast.__tur) return false;
      const asil = window.showToast;
      window.showToast = function (m) { try { window.__metinTuruBildirim(String(m)); } catch (e) { /* tur dışı */ } return asil.apply(this, arguments); };
      window.showToast.__tur = true;
      return true;
    };
    const sayac = setInterval(() => { if (kur()) clearInterval(sayac); }, 50);
  });
  await sayfa.goto('file://' + URUN);

  const yuzeyler = [];
  const t0 = Date.now();
  const iz = (m) => { if (process.env.METIN_TURU_IZ) console.error('[' + ((Date.now() - t0) / 1000).toFixed(1) + ' sn] ' + m); };
  for (const y of A.yuzeyler) {
    const once = bildirimler.length;
    iz(y.ad + ' açılıyor');
    await y.ac(sayfa);
    iz(y.ad + ' açıldı');
    await sayfa.mouse.move(1, 1);
    iz('fare');
    await bildirimleriSil(sayfa);
    iz('bildirimler silindi');
    await bekle(sayfa, 200);
    const sec = y.yalniz || y.kok;
    const v = await sayfa.evaluate(topla, sec);
    iz('metin toplandı');
    if (!v) { console.log('YOK  ' + y.ad + ' (' + sec + ')'); continue; }
    const dosya = y.ad.toLocaleLowerCase('tr').replace(/[^a-z0-9çğıöşü]+/g, '-').replace(/^-|-$/g, '') + '.jpg';
    await sayfa.locator(y.kok).first().screenshot({ path: path.join(cikti, dosya), type: 'jpeg', quality: 80, animations: 'disabled', timeout: 60000 });
    iz('görüntü alındı');
    const kutu = await sayfa.evaluate(([a, b]) => {
      const ka = document.querySelector(a).getBoundingClientRect(), kb = document.querySelector(b).getBoundingClientRect();
      return { x: kb.left - ka.left, y: kb.top - ka.top };
    }, [y.kok, sec]);
    v.ogeler.forEach((x) => { x.x += kutu.x; x.y += kutu.y; x.kaynak = esle(dizin, x.metin); });
    const kokBoy = await sayfa.evaluate((s) => { const r = document.querySelector(s).getBoundingClientRect(); return { w: r.width, h: r.height }; }, y.kok);
    yuzeyler.push({ ad: y.ad, kok: y.kok, resim: dosya, w: kokBoy.w, h: kokBoy.h, ogeler: v.ogeler,
      bildirimler: y.bildirim ? bildirimler.slice(once) : [] });
    console.log(y.ad.padEnd(24) + String(v.ogeler.length).padStart(4) + ' metin · '
      + v.ogeler.filter((x) => x.kaynak.length).length + ' kaynağı bulundu'
      + (y.bildirim && bildirimler.length > once ? ' · bildirim: ' + bildirimler.slice(once).join(' | ') : ''));
  }
  await tarayici.close();
  fs.writeFileSync(path.join(cikti, 'tur.json'), JSON.stringify({ asama: o.asama, ad: A.ad, yuzeyler, hatalar }, null, 1));
  console.log('sayfa hatası: ' + hatalar.length + ' · → ' + path.relative(KOK, cikti) + '/tur.json');
}

if (require.main === module) main().catch((e) => { console.error('HATA:', e.message); process.exit(1); });

module.exports = { ASAMALAR, esle, kaynakDizini, dizinOgesi, ayristir };
