/**
 * tek-yazi-tipi.spec.js — EKRANDA VE TUVALDE TEK YAZI TİPİ Mİ?
 * ─────────────────────────────────────────────────────────────
 *
 * Kullanıcı isteği (2026-09-23): *"Program içinde çok fazla yazı tipi var.
 * Tek bir yazı tipi olmasını istiyorum."* Bu turdan önce ölçüldü: ekranda
 * BEŞ aile — Inter; başlıklarda Source Serif 4; etiket ve sayılarda sistem
 * mono'su (FEAD ekranında 126–146 öğe); tuvalde `sans-serif` ve `system-ui`
 * (Windows'ta Arial ve Segoe UI).
 *
 * Bu halkalar Node'da HİÇ KOŞAMAZ: jsdom font yüklemez, `document.fonts` yok,
 * `getComputedStyle().fontFamily` yalnız bildirilen dizeyi döndürür ve tuval
 * hiç çizmez. Birim kardeşi: tests/unit/tek-yazi-tipi.test.js.
 *
 * ÖLÇÜM `measureText` İLE, `document.fonts.check` İLE DEĞİL (eski başlık yüzü
 * spec'inin dersi — ölçüldü, 2026-09-22): `check()` hiç eşleşen yüz yoksa da
 * `true` döner. Gerçek ölçüt GENİŞLİK: harf "Inter" ile ve çıplak `monospace`
 * ile çizilir; yüzde VARSA genişlikler ayrışır, yoksa ikisi de monospace'e
 * düşer ve BİREBİR aynı çıkar.
 *
 * ÜRÜNÜN KENDİSİ açılır (MFSim_Code.html): yüz base64 gömülü ve gömme yolu
 * build.js'ten geçiyor.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '../..');
const BUILD = path.join(ROOT, 'MFSim_Code.html');
const AILE = 'Inter';

test.beforeAll(() => {
  if (!fs.existsSync(BUILD)) throw new Error('MFSim_Code.html yok. Önce: npm run build');
});
test.setTimeout(180000);

async function ac(page, kayit) {
  if (kayit) {
    // Tuvale yazılan HER yüzü kaydet — ayarlayıcı sarılır, çizim değişmez.
    await page.addInitScript(() => {
      window.__tuvalYuz = {};
      const d = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, 'font');
      Object.defineProperty(CanvasRenderingContext2D.prototype, 'font', {
        configurable: true,
        get() { return d.get.call(this); },
        set(v) {
          const m = String(v).match(/\d+(?:\.\d+)?px\s+(.+)$/);
          const aile = m ? m[1].split(',')[0].replace(/["']/g, '').trim() : String(v);
          window.__tuvalYuz[aile] = (window.__tuvalYuz[aile] || 0) + 1;
          d.set.call(this, v);
        },
      });
    });
  }
  await page.setViewportSize({ width: 1600, height: 1000 });
  page.on('dialog', (d) => d.accept());
  await page.goto('file://' + BUILD);
  await page.fill('#mfsim-login-password', 'mfsim2024');
  await page.press('#mfsim-login-password', 'Enter');
  await page.waitForFunction(() => Array.isArray(window.nodes), null, { timeout: 90000 });
  await page.waitForSelector('#mfsim-loading-screen', { state: 'hidden', timeout: 90000 });
  await page.evaluate(() => document.fonts.ready);
}

// Harf harf ölçer: eksik olan HANGİSİ olduğu görünsün.
//
// ÜÇ YEDEKLE, EŞİKSİZ (2026-09-23). İlk yazım harfi `"Inter", monospace` ile
// ve çıplak `monospace` ile çizip farka 0,5 px eşik koyuyordu. CI'da kırmızıya
// döndü ve sebep yüz değil TESADÜFTÜ: Inter'in "o/ö" ilerlemesi (0,597 em)
// DejaVu Sans Mono'nunkine (0,602 em) çok yakın — yerelde fark 0,55 px (eşiği
// 0,05 px'le geçiyordu), CI'ın Chromium'unda eşiğin altına düştü ve "ö"
// eksik sayıldı. Şimdi aynı harf aynı aileyle ÜÇ AYRI yedeğe karşı çizilir:
// harf yüzde VARSA üçü de Inter'den çizilir, genişlikler BİREBİR aynıdır;
// yoksa her biri kendi yedeğine düşer ve ayrışır. Inter'in kendi genişliği
// ve bir eşik artık işin içinde değil.
async function yuzdeOlmayanHarfler(page, aile, agirlik, harfler) {
  return page.evaluate(([a, w, hs]) => {
    const c = document.createElement('canvas').getContext('2d');
    const gen = (f, t) => { c.font = f; return c.measureText(t).width; };
    return [...hs].filter((h) => {
      const g = ['monospace', 'serif', 'sans-serif'].map((y) => gen(w + ' 100px "' + a + '", ' + y, h));
      return Math.max(...g) - Math.min(...g) > 0.01;
    });
  }, [aile, agirlik, harfler]);
}

// Görünen her metin öğesinin + form denetiminin BİRİNCİL ailesi. İstisna:
// hizası boşlukla kurulmuş düz metin (TXT rapor sayfası) — bkz. birim kapısı.
async function ekrandakiAileler(page) {
  return page.evaluate(() => {
    const aykiri = {};
    let taranan = 0;
    const ilk = (s) => s.split(',')[0].replace(/["']/g, '').trim();
    const bak = (el, etiket) => {
      if (el.closest('.ve-rep-page')) return;
      const a = ilk(getComputedStyle(el).fontFamily);
      taranan++;
      if (a !== 'Inter') aykiri[a] = (aykiri[a] || []).concat(etiket).slice(0, 3);
    };
    document.querySelectorAll('body *').forEach((el) => {
      const q = el.getBoundingClientRect();
      if (q.width < 1 || q.height < 1) return;
      const metinli = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      const denetim = /^(INPUT|SELECT|TEXTAREA|BUTTON)$/.test(el.tagName);
      if (!metinli && !denetim) return;
      bak(el, el.tagName.toLowerCase() + (el.className && el.className.baseVal === undefined
        ? '.' + String(el.className).split(' ')[0] : ''));
    });
    return { taranan, aykiri };
  });
}

test('Inter GERÇEKTEN yüklendi — latin ve Türkçe, iki ağırlıkta', async ({ page }) => {
  await ac(page);
  // YÜKÜ AÇIKÇA İSTE. `latin-ext` parçası `unicode-range` ile TEMBEL iner:
  // sayfada o harflerle Inter'de metin çizilmediyse ölçüm anında henüz yoktur
  // ve halka yüzün eksik olduğunu sanır. Ölçüldü: başlıkların serif olduğu
  // eski derlemede ğ/ş/İ tam da bu yüzden "eksik" çıktı — yüz aynıydı.
  await page.evaluate(async () => {
    for (const w of ['400', '700']) await document.fonts.load(w + ' 16px Inter', 'AaÇçĞğİıÖöŞşÜü');
  });
  for (const w of ['400', '700']) {
    // ı (U+0131) `latin` alt kümesinde, ğşİĞŞ (U+0100-02BA) `latin-ext`te.
    // Biri eksikse Türkçe bir sözcük ekranda İKİ AYRI yüzle yazılır.
    expect(await yuzdeOlmayanHarfler(page, AILE, w, 'AaZz0189çğıöşüÇĞİÖŞÜ')).toEqual([]);
  }
});

// Ölçümün kendisinin boş olmadığının kanıtı: var olmayan bir aile ile AYNI
// çağrı bütün harfleri "eksik" saymalı.
test('ölçüm boş değil — var olmayan aile bütün harfleri eksik sayıyor', async ({ page }) => {
  await ac(page);
  const harfler = 'AaÇğış';
  expect(await yuzdeOlmayanHarfler(page, 'Zzz Yok Boyle Bir Aile', '400', harfler)).toEqual([...harfler]);
});

test('başlık da gövde de Inter — ayrı bir başlık yüzü YOK', async ({ page }) => {
  await ac(page);
  const olcum = await page.evaluate(() => {
    const yap = (etiket) => {
      const el = document.createElement(etiket);
      el.textContent = 'Çözücü Ayarları ğışİĞŞ';
      document.body.appendChild(el);
      const r = getComputedStyle(el).fontFamily.split(',')[0].replace(/["']/g, '').trim();
      el.remove();
      return r;
    };
    return { baslik: yap('h3'), govde: yap('div'), marka: getComputedStyle(document.querySelector('.ve-welcome-logo')).fontFamily.split(',')[0].replace(/["']/g, '').trim() };
  });
  expect(olcum).toEqual({ baslik: AILE, govde: AILE, marka: AILE });
});

test('EKRANDA ikinci aile yok — FEAD pencereleri ve AP pencereleri taranıyor', async ({ page }) => {
  await ac(page);
  const aykiri = {};
  let taranan = 0;
  const topla = async () => {
    const r = await ekrandakiAileler(page);
    taranan += r.taranan;
    Object.entries(r.aykiri).forEach(([a, ornek]) => { aykiri[a] = (aykiri[a] || []).concat(ornek).slice(0, 4); });
  };
  await topla();                                                     // karşılama
  await page.click('.ve-module-card[data-module="fead-analysis"]');
  await page.waitForSelector('#mfsim-module-loading', { state: 'hidden', timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(800);
  await page.evaluate(() => { if (typeof veFeadWizClose === 'function') veFeadWizClose(false); veFeadLoadExample('AG00976_GATES_2025'); });
  await page.waitForTimeout(2500);
  await topla();                                                     // FEAD kanvası + kartlar
  for (const tip of ['fead-fan', 'fead-tensioner', 'fead-belt', 'fead-solver', 'fead-layout']) {
    const var_ = await page.evaluate((t) => { const n = nodes.find((x) => x.type === t); if (!n) return false; clearSelection(); addToSelection(n); return true; }, tip);
    if (!var_) continue;
    await page.waitForTimeout(500);
    await page.evaluate(() => veTogglePropertiesPanel(true));
    await page.waitForTimeout(700);
    await topla();
  }
  // Kayış Tablosu artık bir PENCERE (Çizim Masası) — o da taranıyor.
  await page.evaluate(() => { veTogglePropertiesPanel(false); veFeadTabloAc(); });
  await page.waitForTimeout(500);
  await topla();
  expect(aykiri).toEqual({});
  // BOŞA ÇALIŞMIYOR: tarama gerçekten yüzlerce öğeye baktı (eskiden FEAD
  // ekranında 126–146 öğe mono'ydu).
  expect(taranan).toBeGreaterThan(500);
});

test('TUVALDE ikinci aile yok — grafikler de Inter ile yazıyor', async ({ page }) => {
  await ac(page, true);
  await page.evaluate(() => { if (typeof veStartModule === 'function') veStartModule('arac-performans'); });
  await page.waitForTimeout(1500);
  await page.evaluate(() => { const m = nodes.find((n) => n.type === 'arac-performans'); if (m) veAracOpenEditor(m.id); });
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    let ex = nodes.find((x) => x.type === 'ap-example'); if (!ex) ex = createNode('ap-example', 300, 200);
    ex.data = ex.data || {}; ex.data.exampleKey = 'isb340_tc411'; veApLoadExample(ex.id);
  });
  await page.waitForTimeout(2500);
  // Tuval çizen iki pencere: motor eğrisi ve motor-şanzıman eşleştirmesi.
  for (const tip of ['engine', 'ec-matching']) {
    const ok = await page.evaluate((t) => { const n = nodes.find((x) => x.type === t); if (!n) return false; clearSelection(); addToSelection(n); return true; }, tip);
    if (!ok) continue;
    await page.waitForTimeout(500);
    await page.evaluate(() => veTogglePropertiesPanel(true));
    await page.waitForTimeout(1500);
  }
  const yuzler = await page.evaluate(() => window.__tuvalYuz);
  // BOŞA ÇALIŞMIYOR: tuval gerçekten yazı yazdı.
  expect(Object.values(yuzler).reduce((a, b) => a + b, 0)).toBeGreaterThan(5);
  expect(Object.keys(yuzler)).toEqual([AILE]);
});

test('yüz GÖMÜLÜ — tek dosya açılırken ağ isteği yok', async ({ page }) => {
  const dis = [];
  page.on('request', (r) => { if (!r.url().startsWith('file://') && !r.url().startsWith('data:')) dis.push(r.url()); });
  await ac(page);
  expect(dis).toEqual([]);
});

// BELGE DE TEK YÜZ (2026-09-23). İndirilen raporlar kendi üç yüzünü
// taşıyordu — FEAD özetinde Archivo 133 · Source Serif 4 271 · IBM Plex Mono
// 712 öğe, ayrıntılı raporda 301 · 730 · 1311. Yüz artık arayüzün KENDİ
// @font-face kurallarından gömülüyor (veThemeFontFaceCss). Belge TEK BAŞINA
// açılır: ölçülen şey, uygulamanın dışında yüzün gerçekten yüklenmesi.
test('BELGE de tek yüz — indirilen FEAD raporları arayüzün yüzünü gömüyor', async ({ page, browser }) => {
  await ac(page);
  await page.click('.ve-module-card[data-module="fead-analysis"]');
  await page.waitForSelector('#mfsim-module-loading', { state: 'hidden', timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(800);
  await page.evaluate(() => { if (typeof veFeadWizClose === 'function') veFeadWizClose(false); veFeadLoadExample('AG00976_GATES_2025'); });
  await page.waitForTimeout(2500);
  await page.evaluate(() => { const s = nodes.find((n) => n.type === 'fead-solver'); veFeadSolve(s.id); });
  await page.waitForFunction(() => window.veFeadResults && window.veFeadResults.ok, null, { timeout: 60000 });
  const belge = await page.evaluate(() => new Promise((res) => {
    _frEnsureAssets(() => {
      const R = _frResults(); const node = _frFindReportNode();
      res({ ozet: veFeadSummaryHTML(R, node), rapor: _frBuildReportHTML(R, node) });
    });
  }));
  for (const [ad, html] of Object.entries(belge)) {
    // Gömülü: Inter'in @font-face kuralları, veri URI'siyle; eski üç yüz yok.
    const yuz = (html.match(/@font-face\s*\{[^}]*font-family:\s*["']?Inter/g) || []).length;
    expect(yuz, ad + ': gömülü Inter kuralı').toBeGreaterThanOrEqual(8);
    expect(html, ad).not.toMatch(/Archivo|Source Serif|IBM Plex/);
    const p = await browser.newPage();
    await p.route('**/*', (r) => (r.request().url().startsWith('data:') ? r.continue() : r.abort()));
    await p.setContent(html, { waitUntil: 'load' });
    const m = await p.evaluate(async () => {
      await document.fonts.ready;
      const aile = {}; let n = 0;
      document.querySelectorAll('body *').forEach((el) => {
        if (el.closest('.katex')) return;                   // formül yüzü istisna
        if (![...el.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim())) return;
        n++;
        const a = getComputedStyle(el).fontFamily.split(',')[0].replace(/["']/g, '').trim();
        aile[a] = (aile[a] || 0) + 1;
      });
      await document.fonts.load('400 16px Inter', 'AaÇğış');
      // Yukarıdaki üç yedekli ölçümün aynısı: yüz yüklüyse üçü de Inter'den.
      const c = document.createElement('canvas').getContext('2d');
      const g = ['monospace', 'serif', 'sans-serif'].map((y) => {
        c.font = '400 40px "Inter", ' + y; return c.measureText('AaÇğış0189').width; });
      return { aile, n, yuklu: Math.max(...g) - Math.min(...g) <= 0.01 };
    });
    await p.close();
    expect(m.n, ad + ': taranan öğe').toBeGreaterThan(500);
    expect(Object.keys(m.aile), ad).toEqual([AILE]);
    expect(m.yuklu, ad + ': Inter belgenin İÇİNDE yüklü (uygulama olmadan)').toBe(true);
  }
});
