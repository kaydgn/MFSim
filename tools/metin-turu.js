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
  // pointer-events:none öğeyi atlar — sınama süresince açılır.
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
          const t = document.querySelector('#mfsim-loading-bolum .mfsim-sinema-bolum-ad');
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
        await p.waitForSelector('#ve-modload-stages li.is-done', { timeout: 20000 });
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
      // Boş tuvalin ipucu 2026-10-16'da kalktı (aşama 1 kararı): yüzey boş
      // tuvalin kendisi, ipucu yoksa sıfır metin sayılır. Kabuğun öteki
      // metinleri (minimap, araç çubuğu) aşama 2'nin yüzeyi.
      { ad: 'Boş tuval', kok: '#ve-canvas-wrapper', ac: async (p) => {
        await p.evaluate(() => {
          if (typeof veMntCloseEditor === 'function') veMntCloseEditor(true);
          clearSelection();
          nodes.slice().forEach((n) => addToSelection(n));
          deleteSelectedNodes();
        });
        await p.waitForFunction(() => Array.isArray(window.nodes) && nodes.length === 0, null, { timeout: 15000 });
        await bekle(p, 800);
      }, bildirim: true, yalniz: '#ve-empty-hint', yalnizYoksaBos: true }
    ]
  },
  2: {
    ad: 'Kabuk',
    yuzeyler: [
      { ad: 'Şerit · Giriş', kok: '#ve-ribbon', ac: async (p) => {
        await kabugaGir(p);
        await p.evaluate(() => veRibbonSelectTab('giris'));
        await bekle(p, 300);
      }, bildirim: true },
      { ad: 'Şerit · Görünüm', kok: '#ve-ribbon', ac: async (p) => { await p.evaluate(() => veRibbonSelectTab('gorunum')); await bekle(p, 300); } },
      { ad: 'Şerit · Araçlar', kok: '#ve-ribbon', ac: async (p) => { await p.evaluate(() => veRibbonSelectTab('araclar')); await bekle(p, 300); } },
      // Kök topoloji: ray, Bileşenler (Modüller), sekme bandı, modül kartı,
      // durum şeridi, genel görünüm.
      { ad: 'Ana topoloji', kok: '#sayfa2', ac: async (p) => { await p.evaluate(() => veRibbonSelectTab('giris')); await bekle(p, 300); } },
      { ad: 'Araç Performans iç topolojisi', kok: '#sayfa2', ac: async (p) => {
        await p.evaluate(() => veAracOpenEditor(nodes.find((n) => n.type === 'arac-performans').id));
        await bekle(p, 800);
        await p.evaluate(() => {
          const ex = nodes.find((n) => n.type === 'ap-example') || createNode('ap-example', 3000, 3000);
          veApLoadExample(ex.id);
        });
        await p.waitForFunction(() => nodes.some((n) => n.type === 'engine'), null, { timeout: 30000 });
        await bekle(p, 1200);
        await p.evaluate(() => veFitViewToContent());
        await bekle(p, 600);
      }, bildirim: true },
      { ad: 'Uyarılar paneli', kok: '#ve-warnings-panel', ac: async (p) => { await p.evaluate(() => veSetWarningsOpen(true)); await bekle(p, 400); } },
      { ad: 'Çoklu seçim penceresi', kok: '#ve-properties', ac: async (p) => {
        await p.evaluate(() => {
          veSetWarningsOpen(false);
          clearSelection();
          nodes.filter((n) => ['engine', 'gearbox', 'differential'].includes(n.type)).forEach((n) => addToSelection(n));
          showMultipleSelection();
          veTogglePropertiesPanel(true);
        });
        await bekle(p, 600);
      } },
      // Sağ tık menüleri olaydan yalnız konumu okur; olay sahte, menü gerçek.
      { ad: 'Bileşen bağlam menüsü', kok: '#ve-node-context-menu', ac: async (p) => {
        await p.evaluate(() => {
          veTogglePropertiesPanel(false); clearSelection();
          showNodeContextMenu({ preventDefault() {}, stopPropagation() {}, clientX: 420, clientY: 260 }, nodes.find((n) => n.type === 'engine'));
        });
        await bekle(p, 300);
      } },
      { ad: 'Port bağlam menüsü', kok: '#ve-port-context-menu', ac: async (p) => {
        await p.evaluate(() => {
          hideNodeContextMenu();
          const n = nodes.find((x) => x.type === 'gearbox');
          const port = document.querySelector('#' + CSS.escape(n.id) + ' .ve-node-port');
          showPortContextMenu({ preventDefault() {}, stopPropagation() {}, clientX: 420, clientY: 260 }, port, n, 'output');
        });
        await bekle(p, 300);
      } },
      { ad: 'Ad bağlam menüsü', kok: '#ve-label-context-menu', ac: async (p) => {
        await p.evaluate(() => {
          hidePortContextMenu();
          const n = nodes.find((x) => x.type === 'engine');
          showLabelContextMenu({ preventDefault() {}, stopPropagation() {}, clientX: 420, clientY: 260 }, n, document.querySelector('#' + CSS.escape(n.id) + ' .ve-node-label'));
        });
        await bekle(p, 300);
      } },
      { ad: 'Bağlantı bağlam menüsü', kok: '#ve-connection-context-menu', ac: async (p) => {
        await p.evaluate(() => {
          hideLabelContextMenu();
          showConnectionContextMenu({ preventDefault() {}, stopPropagation() {}, clientX: 420, clientY: 260 }, connections[0].id);
        });
        await bekle(p, 300);
      } },
      { ad: 'Sekme bağlam menüsü', kok: '#ve-tab-context-menu', ac: async (p) => {
        await p.evaluate(() => {
          hideConnectionContextMenu();
          veShowTabMenu({ preventDefault() {}, stopPropagation() {}, clientX: 420, clientY: 260 }, 0);
        });
        await bekle(p, 300);
      } },
      { ad: 'Takoz iç topolojisi', kok: '#sayfa2', ac: async (p) => {
        await p.evaluate(() => {
          const m = document.getElementById('ve-tab-context-menu'); if (m) m.remove();
          veAracCloseEditor(true);
        });
        await bekle(p, 600);
        await p.evaluate(() => { const n = createNode('mount-analysis', 900, 300); veMntOpenEditor(n.id); });
        await bekle(p, 800);
        await p.evaluate(() => veMntOrnekYukle('siper'));
        await p.waitForFunction(() => nodes.some((n) => n.type === 'mnt-mount'), null, { timeout: 30000 });
        await bekle(p, 1200);
      }, bildirim: true },
      { ad: 'Şerit · Sonuç araçları', kok: '#ve-ribbon', ac: async (p) => {
        await p.evaluate(() => { veMntCloseEditor(true); veSubTabDegistir('sonuclar'); });
        await bekle(p, 800);
        await p.evaluate(() => veRibbonSelectTab('sonuc'));
        await bekle(p, 300);
      } },
      { ad: 'Hesap menüsü', kok: '.ve-avatar-menu', ac: async (p) => {
        await p.evaluate(() => { veSubTabDegistir('arac-performans'); });
        await bekle(p, 500);
        await p.evaluate(() => veAvatarMenuAc());
        await bekle(p, 300);
      } },
      { ad: 'Komut paleti', kok: '#ve-cmdk .ve-cmdk-panel', ac: async (p) => { await p.evaluate(() => { veAvatarMenuKapat(); veCmdkOpen(); }); await bekle(p, 400); } },
      { ad: 'Klavye kısayolları', kok: '#ve-help .ve-help-panel', ac: async (p) => { await p.evaluate(() => { veCmdkClose(); veShortcutsHelpOpen(); }); await bekle(p, 400); } },
      ...['appearance', 'autosave', 'shortcuts', 'data', 'about'].map((b, i) => ({
        ad: 'Ayarlar · ' + ['Görünüm', 'Otomatik kaydet', 'Kısayollar', 'Veri', 'Hakkında'][i], kok: '#ve-settings-overlay .ve-settings-modal',
        ac: async (p) => { await p.evaluate((bol) => { veShortcutsHelpClose(); veOpenSettings(); veSettingsShowSection(bol); }, b); await bekle(p, 400); }
      })),
      { ad: 'Program Durumu', kok: '#ve-status-overlay .ve-settings-modal', ac: async (p) => { await p.evaluate(() => { veCloseSettings(); veOpenStatusModal(); }); await bekle(p, 800); } },
      { ad: 'Program Arşivi', kok: '#ve-programlar .ve-help-panel', ac: async (p) => { await p.evaluate(() => { veCloseStatusModal(); veProgramArsiviOpen(); }); await bekle(p, 1200); } },
      { ad: 'Komuta · giriş', kok: '#ve-komuta-overlay .ve-settings-modal', ac: async (p) => { await p.evaluate(() => { veProgramArsiviClose(); veKomutaAc(); }); await bekle(p, 600); } },
      // İçerik: tur sayfanın kendi anahtarıyla oturumu yetkili sayar (şifre
      // sayfada sha-256 olarak duruyor; kapı bir erişim denetimi değil).
      { ad: 'Komuta · tezgâh', kok: '#ve-komuta-overlay .ve-settings-modal', ac: async (p) => {
        await p.evaluate(() => { sessionStorage.setItem(VE_KOMUTA_KEY, VE_KOMUTA_HASH); veKomutaKapat(); veKomutaAc(); });
        await bekle(p, 1200);
      } },
      { ad: 'Radyo', kok: '#mf-radio', ac: async (p) => { await p.evaluate(() => { veKomutaKapat(); veToggleRadio(); }); await bekle(p, 600); } },
      { ad: '2048', kok: '#mf2048 .mf2048-panel', ac: async (p) => { await p.evaluate(() => { veToggleRadio(); veGame2048Open(); }); await bekle(p, 600); } },
      { ad: 'Deniz Harp Okulu', kok: '#mf-dho .mf-dho-panel', ac: async (p) => { await p.evaluate(() => { veGame2048Close(); veDenizHarpOpen(); }); await bekle(p, 800); } }
    ]
  }
};

// Aşama 2'nin girişi: şifre atlanır, yükleyici otomasyonda süssüz koşar,
// karşılamadan Araç Performans seçilir (kök topolojiye modül kartı düşer) ve
// şeridin gövdesi açılır.
async function kabugaGir(p) {
  await p.waitForSelector('#mfsim-login-overlay', { state: 'visible', timeout: 60000 });
  await p.evaluate(() => { if (window.MFSimLoader && MFSimLoader.start) MFSimLoader.start(); });
  await p.waitForFunction(() => typeof window.createNode === 'function' && Array.isArray(window.nodes), null, { timeout: 180000 });
  await p.waitForFunction(() => { const s = document.getElementById('mfsim-loading-screen'); return !s || s.style.display === 'none'; }, null, { timeout: 180000 });
  await p.evaluate(() => veStartModule('arac-performans'));
  await bekle(p, 1500);
  await p.evaluate(() => { if (veRibbonCollapsed) veRibbonToggleCollapse(); });
  await bekle(p, 300);
}

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
  // Kullanıcının ağı GitHub'a çıkamıyor (kök CLAUDE.md); tur da çıkmaz —
  // Program Durumu ve sürüm noktası kullanıcının gördüğü çevrimdışı hâlde.
  await sayfa.route(/github\.com|github\.io/, (r) => r.abort());
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
    let sec = y.yalniz || y.kok;
    if (y.yalniz && y.yalnizYoksaBos && !(await sayfa.$(y.yalniz))) sec = null;
    const v = sec ? await sayfa.evaluate(topla, sec) : { ogeler: [] };
    iz('metin toplandı');
    if (!v) { console.log('YOK  ' + y.ad + ' (' + sec + ')'); continue; }
    const dosya = y.ad.toLocaleLowerCase('tr').replace(/[^a-z0-9çğıöşü]+/g, '-').replace(/^-|-$/g, '') + '.jpg';
    await sayfa.locator(y.kok).first().screenshot({ path: path.join(cikti, dosya), type: 'jpeg', quality: 80, animations: 'disabled', timeout: 60000 });
    iz('görüntü alındı');
    const kutu = await sayfa.evaluate(([a, b]) => {
      const ka = document.querySelector(a).getBoundingClientRect(), kb = document.querySelector(b).getBoundingClientRect();
      return { x: kb.left - ka.left, y: kb.top - ka.top };
    }, [y.kok, sec || y.kok]);
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
