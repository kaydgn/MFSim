/**
 * ust-bant.spec.js — ATÖLYE ÜST BANDI
 * ────────────────────────────────────
 *
 * Bant artık komut dizmiyor: NEREDEYİM (marka · modül adı) + hesap + komutların
 * düğmesi. Şeridin GÖVDESİ YOK (kullanıcı 2026-11-06, Canlı Not 59): komutlar
 * bandın sağ ucundaki düğmenin açtığı küçük pencerede, sayfa aşağı itilmez.
 *
 * Gövdesizliğin meşruiyeti TEK bir koşula bağlı ve o koşul Node'da kapılı
 * (`tests/unit/komut-kapsami.test.js`): şeritteki her komut palette de var.
 * Burada ölçülen şey YERLEŞİM ve CANLI BAĞ — ikisi de jsdom'da ölçülemez.
 */
const { test, expect } = require('@playwright/test');
const { kontrastKur, kontrastOzet } = require('../helpers/kontrast-olcu.js');
const { yerlesimKur, yerlesimOzet } = require('../helpers/yerlesim-olcu.js');
const path = require('path');
const fs = require('fs');

const BUILD = path.join(__dirname, '../..', 'MFSim_Code.html');

test.beforeAll(() => {
  if (!fs.existsSync(BUILD)) throw new Error('MFSim_Code.html yok. Önce: npm run build');
});

async function ac(page, modul) {
  await page.goto('file://' + BUILD);
  await page.fill('#mfsim-login-password', 'mfsim2024');
  await page.press('#mfsim-login-password', 'Enter');
  await page.waitForFunction(() => Array.isArray(window.nodes), null, { timeout: 90000 });
  await page.waitForSelector('#mfsim-loading-screen', { state: 'hidden', timeout: 90000 });
  if (modul) {
    await page.click('.ve-module-card[data-module="' + modul + '"]');
    // MODÜL YÜKLEME PERDESİ çekilene kadar bekle. Ölçüldü: karta basıldıktan
    // ~1,5 sn sonra bile `#mfsim-module-loading` bandın ÜSTÜNDE duruyor.
    // `page.click` hedef tıklanabilir olana dek beklediği için bu yarışı
    // gizler; koordinata basan `mouse.click` gizlemez — ve perdeye basar.
    await page.waitForSelector('#mfsim-module-loading', { state: 'hidden', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(300);
    // FEAD boş topolojiyi SİHİRBAZLA karşılar (modülün kuralı) ve modal bandı
    // ÖRTER. Ölçüm örtüden geçer (`getBoundingClientRect` katman bilmez) ama
    // TIK geçmez — kapıyı yazarken bu fark ölçüldü.
    await page.evaluate(() => { if (typeof veFeadWizClose === 'function') veFeadWizClose(false); });
    await page.waitForTimeout(300);
  }
}

const olc = () => {
  const g = (s) => {
    const e = document.querySelector(s);
    if (!e) return null;
    const b = e.getBoundingClientRect();
    return { y: Math.round(b.y), h: Math.round(b.height), w: Math.round(b.width),
             gorunur: b.width > 0 && b.height > 0 };
  };
  const m = document.querySelector('#ve-bant-modul');
  return {
    bant: g('#ve-rb-strip'), serit: g('#ve-ribbon'),
    ara: g('.ve-bant-ara'), coz: g('.ve-bant-ana'), tuval: g('#ve-split-container'),
    modul: m ? m.textContent.trim() : null,
    katli: !!document.querySelector('#ve-ribbon.is-collapsed'),
  };
};

test('şeridin gövdesi YOK — bant tek satır', async ({ page }) => {
  await ac(page, 'fead-analysis');
  const r = await page.evaluate(olc);
  expect(r.katli).toBe(true);
  // Şeridin tamamı bandın kendisi kadar: gövde gerçekten kapalı
  expect(r.serit.h).toBe(r.bant.h);
  // BANDIN ÖLÇÜSÜ İKİ UÇLU. Üst sınır: kalın değil — ilk yazım 44 px'ti
  // ("çok kalın olmuş"), 38 px de "hâlâ boyuna geniş, çok yer kaplıyor"
  // (2026-09-26). Alt sınır: 24 px'lik denetimlerin (arama · Çöz · avatar)
  // üstünde ve altında pay kalır — bant ince ama sıkışık değil. İki sınır
  // arasında bir aralık, tek bir sayıyı çivilemekten dürüst.
  expect(r.bant.h).toBeGreaterThanOrEqual(30);
  expect(r.bant.h).toBeLessThanOrEqual(32);
  // Hiçbir denetim bandın kalınlığını tek başına belirlemiyor: en yükseğinin
  // de üstünde ve altında ≥ 3 px var. 28 px'lik ▼ düğmesi 38 px'lik bandı
  // tek başına tutuyordu.
  const enYuksek = await page.evaluate(() => Math.max(...[...document.querySelectorAll('#ve-rb-strip > *')]
    .filter((e) => e.offsetWidth).map((e) => e.getBoundingClientRect().height)));
  expect(enYuksek).toBeGreaterThan(20);                  // BOŞA ÇALIŞMIYOR
  expect(r.bant.h - enYuksek).toBeGreaterThanOrEqual(6);
});

test('MODÜL ADI canlı — modülün içinde yazılı, kökte BOŞ', async ({ page }) => {
  await ac(page, null);
  expect((await page.evaluate(olc)).modul).toBe('');   // karşılama: gidilecek modül yok
  await page.click('.ve-module-card[data-module="fead-analysis"]');
  await page.waitForTimeout(1200);
  expect((await page.evaluate(olc)).modul).toBe('FEAD');
});

// KOMUT ARA YOK (kullanıcı 2026-11-05, Canlı Not 24: "komut ara ve çözücü
// kısmına gerek yok. Kullanılmıyor zaten"): bantta arama kutusu ve Çözücü yok;
// komut paleti klavyeden (Ctrl+K) açılıyor, Çözücü şeritte.
test('KOMUT ARA YOK — bantta arama ve Çözücü yok; palet Ctrl+K ile açılıyor', async ({ page }) => {
  await ac(page, 'fead-analysis');
  const r = await page.evaluate(() => ({
    ara: document.querySelectorAll('#ve-rb-strip .ve-bant-ara, #ve-rb-strip [data-qat="veCmdkOpen"]').length,
    coz: document.querySelectorAll('#ve-rb-strip .ve-bant-ana, #ve-rb-strip [data-qat="veSolverRun"]').length,
    metin: document.getElementById('ve-rb-strip').innerText }));
  expect(r).toMatchObject({ ara: 0, coz: 0 });
  expect(r.metin).not.toMatch(/Komut ara|Çözücü/);
  await expect(page.locator('#ve-cmdk-input')).toBeHidden();
  await page.locator('#ve-canvas-wrapper').click({ position: { x: 40, y: 300 } });
  await page.keyboard.press('Control+k');
  await expect(page.locator('#ve-cmdk-input')).toBeVisible();
});

// DOLU DÜĞME YOK: bandın tek dolu düğmesi Çözücü'ydü ve kalktı (Canlı Not 24);
// aksan zeminli bir düğme "asıl iş" diye okunur. Ölçüt renk adı değil ZEMİN.
test('bantta dolu düğme yok', async ({ page }) => {
  await ac(page, 'fead-analysis');
  const n = await page.evaluate(() => {
    const aksan = getComputedStyle(document.documentElement)
      .getPropertyValue('--accent-primary').trim();
    const d = document.createElement('div'); d.style.color = aksan;
    document.body.appendChild(d); const hedef = getComputedStyle(d).color; d.remove();
    let say = 0;
    document.querySelectorAll('#ve-rb-strip button').forEach((b) => {
      if (getComputedStyle(b).backgroundColor === hedef) say++;
    });
    return say;
  });
  expect(n).toBe(0);
});

// KOMUTLARIN PENCERESİ (kullanıcı 2026-11-06, Canlı Not 59: *"Şu kısmın programdan
// tamamen kalkmasını istiyorum. Buradaki özelliklerin ise, böyle kenarda açılır bir
// ufak pencere şeklinde belirmesini istiyorum. Programı daraltıyor"*): açık gövde
// sayfayı 94 px aşağı itiyordu. Pencere bandın sağ ucunda YÜZER: tuval oynamaz.
const pencereOlc = () => {
  const k = (s) => { const e = document.querySelector(s); if (!e) return null;
    const b = e.getBoundingClientRect();
    return { x: Math.round(b.x), y: Math.round(b.y), r: Math.round(b.right), b: Math.round(b.bottom),
             w: Math.round(b.width), h: Math.round(b.height), gorunur: b.width > 0 && b.height > 0 }; };
  const sat = [...document.querySelectorAll('#ve-rb-body .ve-rb-btn')];
  return {
    pencere: k('#ve-rb-dock'), dugme: k('#ve-rb-expand'), bant: k('#ve-rb-strip'),
    tuval: k('#ve-split-container'), sayfa: k('#sayfa2'),
    acik: document.getElementById('ve-ribbon').classList.contains('is-peek'),
    aria: document.getElementById('ve-rb-expand').getAttribute('aria-expanded'),
    sekme: [...document.querySelectorAll('#ve-rb-dock .ve-rb-tab')].map((t) => t.textContent.trim()),
    aktif: (document.querySelector('#ve-rb-tabs .ve-rb-tab.active') || {}).textContent,
    odak: document.activeElement ? (document.activeElement.id || document.activeElement.textContent.trim()) : null,
    satir: sat.length,
    // her komut TEK SATIR (ikon + ad) ve adı kesilmiyor
    yuksek: Math.max(0, ...sat.map((b) => b.getBoundingClientRect().height)),
    kesik: sat.filter((b) => { const l = b.querySelector('.ve-rb-lbl'); return l.scrollWidth > l.clientWidth + 0.5; })
      .map((b) => b.textContent.trim()),
    grup: [...document.querySelectorAll('#ve-rb-body .ve-rb-group-label')].map((g) => g.textContent.trim()),
  };
};

test('KOMUTLARIN PENCERESİ — bandın sağ ucunda yüzer, sayfa ve tuval OYNAMAZ', async ({ page }) => {
  await ac(page, 'fead-analysis');
  const once = await page.evaluate(pencereOlc);
  expect(once.acik).toBe(false);
  expect(once.pencere.gorunur).toBe(false);
  expect(once.aria).toBe('false');
  await page.click('#ve-rb-expand');
  await page.waitForTimeout(250);
  const r = await page.evaluate(pencereOlc);
  expect(r.acik).toBe(true);
  expect(r.aria).toBe('true');
  expect(r.pencere.gorunur).toBe(true);
  // sayfa ve tuval yerinde: pencere yüzüyor, itmiyor
  expect(r.sayfa.y).toBe(once.sayfa.y);
  expect(r.tuval).toEqual(once.tuval);
  // KENARDA, KÜÇÜK: bandın altında, sağ kenarı düğmenin sağ kenarında
  expect(r.pencere.y).toBeGreaterThanOrEqual(r.bant.b);
  expect(r.pencere.y - r.bant.b).toBeLessThanOrEqual(6);
  expect(Math.abs(r.pencere.r - r.dugme.r)).toBeLessThanOrEqual(1);
  expect(r.pencere.w).toBeLessThanOrEqual(320);                 // Canlı Not 88: 352 → 312 px
  // sekmeler pencerenin başında; açılınca odak seçili sekmede
  expect(r.sekme).toEqual(expect.arrayContaining(['Giriş', 'Görünüm', 'Araçlar']));
  expect(r.aktif).toBe('Giriş');
  expect(r.odak).toBe('Giriş');
  expect(r.grup.length).toBeGreaterThan(2);
  expect(r.satir).toBeGreaterThan(8);
  expect(r.yuksek).toBeLessThanOrEqual(24);                     // Canlı Not 88: satır 28 + 2 → 24 px
  expect(r.kesik).toEqual([]);
  // İKİ TEMADA okunur ve yazı kutusuna sığar (ortak ölçüler)
  await kontrastKur(page);
  await yerlesimKur(page);
  const kotu = [];
  for (const tema of ['acik', 'koyu']) {
    await page.evaluate((t) => changeTheme(t), tema);
    for (const sekme of ['giris', 'gorunum', 'araclar']) {
      await page.click(`#ve-rb-tabs [data-rb-tab="${sekme}"]`);
      await page.waitForTimeout(120);
      const k = await page.evaluate(() => window.__kontrast('#ve-rb-dock'));
      expect(k.olculen).toBeGreaterThan(8);
      kontrastOzet(k.kotu).forEach((x) => kotu.push(`${tema}/${sekme} · ${x}`));
      const y = await page.evaluate(() => window.__yerlesim('#ve-rb-dock'));
      yerlesimOzet(y, `${tema}/${sekme}`).forEach((x) => kotu.push(x));
    }
  }
  expect(kotu).toEqual([]);
});

test('KOMUTLARIN PENCERESİ — sekme değişir; komut, Esc ve dışarı tık kapatır', async ({ page }) => {
  await ac(page, 'fead-analysis');
  await page.click('#ve-rb-expand');
  await page.click('#ve-rb-tabs [data-rb-tab="gorunum"]');
  let r = await page.evaluate(pencereOlc);
  expect(r.acik).toBe(true);                 // sekme değişti, pencere açık
  expect(r.aktif).toBe('Görünüm');
  expect(r.grup).toContain('Izgara');
  // Esc kapatır, odak düğmeye döner
  await page.keyboard.press('Escape');
  r = await page.evaluate(pencereOlc);
  expect(r.acik).toBe(false);
  expect(r.odak).toBe('ve-rb-expand');
  // dışarı tık kapatır
  await page.click('#ve-rb-expand');
  expect((await page.evaluate(pencereOlc)).acik).toBe(true);
  await page.mouse.click(600, 500);
  expect((await page.evaluate(pencereOlc)).acik).toBe(false);
  // komut çalışır ve pencere kapanır
  await page.click('#ve-rb-expand');
  const izgara = await page.evaluate(() => typeof veGridVisible !== 'undefined' && veGridVisible);
  await page.click('#ve-rb-body .ve-rb-btn[title="Izgara"]');
  r = await page.evaluate(pencereOlc);
  expect(r.acik).toBe(false);
  expect(await page.evaluate(() => typeof veGridVisible !== 'undefined' && veGridVisible)).toBe(!izgara);
  // yeniden açılınca son sekme yerinde
  await page.click('#ve-rb-expand');
  expect((await page.evaluate(pencereOlc)).aktif).toBe('Görünüm');
});

// ── BANT ESKİ ŞERİT DEĞİL (kullanıcı bildirimi: "eskisiyle aynı olmuş") ────
// Bandın eski okunmasının sebebi renk değil ENVANTERDİ: içinde hâlâ şerit
// sekmeleri ve kaydet/geri/ileri ikonları duruyordu. Maket ikisini de
// taşımıyor. Kapı ENVANTERİ tutuyor, görünümü değil.
test('bantta şerit sekmesi ve QAT ikonu YOK', async ({ page }) => {
  await ac(page, 'fead-analysis');
  const r = await page.evaluate(() => {
    const bant = document.querySelector('#ve-rb-strip');
    const sekme = document.querySelector('#ve-rb-tabs');
    return {
      qatKabi: !!document.querySelector('#ve-qat'),
      bantSekmesi: !!(sekme && bant.contains(sekme)),
      pencereSekmesi: !!(sekme && document.getElementById('ve-rb-dock').contains(sekme)),
      // sekmeler pencereye ait: pencere kapalıyken görünmezler
      sekmeGorunur: !!(sekme && sekme.getBoundingClientRect().height > 0),
      markaIkonu: (() => {
        const m = document.querySelector('.ve-rb-strip .ve-brand-mark');
        return !!(m && m.getBoundingClientRect().width > 0);
      })(),
      bantY: Math.round(bant.getBoundingClientRect().height),
    };
  });
  expect(r.qatKabi).toBe(false);        // kaydet/geri/ileri ikonları banttan kalktı
  // SEKMELER KOMUTLARIN PENCERESİNDE (Canlı Not 59): bantta hep görünürken üst
  // satır eski şeridin aynısı okunuyordu; pencere kapalıyken çizilmezler.
  expect(r.bantSekmesi).toBe(false);
  expect(r.pencereSekmesi).toBe(true);
  expect(r.sekmeGorunur).toBe(false);
  expect(r.markaIkonu).toBe(false);     // maket yalnız SÖZCÜK markasını gösteriyor
  expect(r.bantY).toBeLessThanOrEqual(32);   // "çok kalın olmuş" — 44 → 38 → 32
});

// ── AVATAR ────────────────────────────────────────────────────────────────
// Kimlik UYDURULMADI, AÇILDI. Ad yokken sahte baş harf basılmaz.
test('avatar: ad yokken BOŞ, ad girilince baş harf', async ({ page }) => {
  await ac(page, 'fead-analysis');
  const bos = await page.evaluate(() => {
    const a = document.querySelector('#ve-bant-avatar');
    return { metin: a.textContent.trim(), bosSinif: a.classList.contains('ve-bant-avatar--bos') };
  });
  expect(bos.metin).toBe('');
  expect(bos.bosSinif).toBe(true);

  const dolu = await page.evaluate(() => {
    veKimlikAdYaz('Kerem Aydoğan');
    const a = document.querySelector('#ve-bant-avatar');
    return { metin: a.textContent.trim(), bosSinif: a.classList.contains('ve-bant-avatar--bos') };
  });
  expect(dolu.metin).toBe('KA');
  expect(dolu.bosSinif).toBe(false);
});

// ── HESAP MENÜSÜ OKUNUR BİR YÜZEY Mİ ─────────────────────────────────────
// Bu halkanın İLK hâli `toBeVisible()` ölçüyordu ve menü SAYDAMKEN geçti:
// Playwright'ın "görünür"ü boyutu olan her kutu demek. Menü zeminsiz,
// kenarlıksız, `z-index`siz bir metin yığınıydı ve şeridin, sütundaki
// müfettişin ARKASINDA doğuyordu (kullanıcı bildirimi: "hiç güzel bir yapı
// gelmiyor"). Kapı artık VAR OLMAYI değil OKUNMAYI ölçer: opak zemin,
// kenarlık, gölge, ve menünün üç noktasında en üstteki eleman menünün kendisi.
const menuOlc = () => {
  const m = document.querySelector('.ve-avatar-menu');
  if (!m) return null;
  const cs = getComputedStyle(m), r = m.getBoundingClientRect();
  const a = document.getElementById('ve-bant-avatar').getBoundingClientRect();
  const nok = [[r.left + 12, r.top + 12], [r.left + r.width / 2, r.top + r.height / 2], [r.right - 12, r.bottom - 12]];
  return {
    saydam: /rgba\([^)]*,\s*0\)$/.test(cs.backgroundColor) || cs.backgroundColor === 'transparent',
    kenar: cs.borderTopWidth, golge: cs.boxShadow !== 'none',
    ustte: nok.every(([x, y]) => { const u = document.elementFromPoint(x, y); return !!(u && m.contains(u)); }),
    // + 0: fark (−0,5; 0) aralığındayken Math.round −0 verir ve toBe(0) onu
    // Object.is ile ayırır — yarım pikselin içinde yaslı menü "kaymış" sayılıyordu.
    sagHiza: Math.round(r.right - a.right) + 0, ekranda: r.left >= 0 && r.right <= innerWidth,
  };
};

test('hesap menüsü OKUNUR bir yüzey — opak, kenarlıklı, en üstte', async ({ page }) => {
  await ac(page, 'fead-analysis');
  await page.click('#ve-bant-avatar');
  const r = await page.evaluate(menuOlc);
  expect(r).not.toBeNull();
  expect(r.saydam).toBe(false);
  expect(r.kenar).toBe('1px');
  expect(r.golge).toBe(true);
  expect(r.ustte).toBe(true);
  expect(r.sagHiza).toBe(0);           // avatarın sağ kenarına yaslı
  expect(r.ekranda).toBe(true);
});

// SÜTUNDA KALAN bir pencere aç. İki halka önce ARAÇ penceresini açıyordu;
// araç ölçümle `VE_SUTUNA_SIGMAYAN`a girince halkalar sütunu değil MODALI
// açmaya başladı. Öncül açık bir iddia: tip listeye girerse sebebiyle düşer.
const sutundaPencereAc = () => {
  const t = 'differential';
  if (VE_SUTUNA_SIGMAYAN.indexOf(t) >= 0)
    throw new Error(t + ' modal açılıyor (VE_SUTUNA_SIGMAYAN) — sütunda kalan bir tip seçin');
  const n = createNode(t, 500, 300); clearSelection(); addToSelection(n);
};

test('hesap menüsü sütundaki müfettişin ÜSTÜNDE açılıyor', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await ac(page, 'arac-performans');
  await page.evaluate(sutundaPencereAc);
  await page.waitForTimeout(400);
  await page.evaluate(() => veTogglePropertiesPanel(true));
  await page.waitForTimeout(600);
  await page.click('#ve-bant-avatar');
  const r = await page.evaluate(menuOlc);
  // Sütun eskiden PENCERE katmanındaydı (4000) — bandın menüsü (2000) onun
  // arkasında doğuyordu. Sütun artık `--z-dock`ta.
  expect(r.ustte).toBe(true);
});

test('TEK ESC TEK KATMAN — menüyü kapatan tuş alttaki paneli sökmüyor', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await ac(page, 'arac-performans');
  await page.evaluate(sutundaPencereAc);
  await page.waitForTimeout(400);
  await page.evaluate(() => veTogglePropertiesPanel(true));
  await page.waitForTimeout(600);
  await page.click('#ve-bant-avatar');
  await expect(page.locator('.ve-avatar-menu')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(page.locator('.ve-avatar-menu')).toHaveCount(0);
  // Ölçülen kusur: aynı ESC map.js'in dinleyicisine de ulaşıp paneli kapatıyordu.
  const panelAcik = await page.evaluate(() =>
    document.getElementById('ve-properties-overlay').classList.contains('visible'));
  expect(panelAcik).toBe(true);
});

test('ad menüden, YERİNDE değişiyor — tarayıcı `prompt`u yok', async ({ page }) => {
  await ac(page, 'fead-analysis');
  let diyalog = 0;
  page.on('dialog', (d) => { diyalog++; d.dismiss(); });
  await page.click('#ve-bant-avatar');
  await page.click('.ve-avatar-menu [data-ve-avatar="ad"]');
  await expect(page.locator('.ve-avatar-menu-ad input')).toBeFocused();
  await page.keyboard.type('İlker Şahin');
  await page.keyboard.press('Enter');
  const r = await page.evaluate(() => ({
    avatar: document.getElementById('ve-bant-avatar').textContent,
    menuAd: document.querySelector('.ve-avatar-menu-kim b').textContent,
  }));
  expect(diyalog).toBe(0);
  expect(r.avatar).toBe('İŞ');         // Türkçe büyütme: 'i' → 'İ'
  expect(r.menuAd).toBe('İlker Şahin');
});

// AÇILIŞTA AVATAR TAZELENİR. `veAvatarYaz` eskiden yalnız ad YAZILDIĞI anda
// çağrılıyordu: ad saklı olduğu hâlde yeniden açılışta avatar boş kalıyordu.
test('kayıtlı ad AÇILIŞTA avatara geliyor', async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.setItem('mf-kullanici-ad', 'Kerem Aydoğan'); } catch (e) {} });
  await ac(page, 'fead-analysis');
  const r = await page.evaluate(() => {
    const a = document.getElementById('ve-bant-avatar');
    return { metin: a.textContent.trim(), bos: a.classList.contains('ve-bant-avatar--bos') };
  });
  expect(r).toEqual({ metin: 'KA', bos: false });
});

// KOMUTLARIN DÜĞMESİ YERİNDE DURUR. Eskiden yalnız katlıyken vardı: basınca
// kayboluyor, sağ küme 26 px kayıyor ve tıklanan noktaya AVATAR oturuyordu —
// ikinci tık şerit yerine hesap menüsünü açıyordu (ölçüldü).
test('şerit düğmesine basınca sağ küme KAYMIYOR ve düğme hâlâ altında', async ({ page }) => {
  await ac(page, 'fead-analysis');
  const x = () => page.evaluate(() => ['#ve-bant-avatar', '#ve-rb-expand']
    .map((s) => Math.round(document.querySelector(s).getBoundingClientRect().left)));
  const nokta = await page.evaluate(() => { const r = document.getElementById('ve-rb-expand').getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  const once = await x();
  await page.mouse.click(nokta.x, nokta.y);
  await page.waitForTimeout(300);
  const sonra = await x();
  expect(sonra).toEqual(once);
  const r = await page.evaluate(({ x, y }) => ({
    acik: document.getElementById('ve-ribbon').classList.contains('is-peek'),
    aria: document.getElementById('ve-rb-expand').getAttribute('aria-expanded'),
    altindaki: (document.elementFromPoint(x, y) || {}).closest ? document.elementFromPoint(x, y).closest('button').id : null,
  }), nokta);
  expect(r.acik).toBe(true);
  expect(r.aria).toBe('true');
  expect(r.altindaki).toBe('ve-rb-expand');   // ikinci tık yine düğmeye gider
  await page.mouse.click(nokta.x, nokta.y);
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => document.getElementById('ve-ribbon').classList.contains('is-peek'))).toBe(false);
});

// KALDIRILAN DÜĞMENİN YOLU AÇIK KALIR. Kaydet ikonu banttan kalktı ve
// `veSaveTopology` HİÇBİR TUŞA BAĞLI DEĞİLDİ (ölçüldü) — Ctrl+S o turda
// eklendi. Düğmeyi klavye yolu açmadan kaldırmak, sık kullanılan bir eylemi
// yalnız palete mahkûm etmekti.
test('Ctrl+S kaydetmeye bağlı', async ({ page }) => {
  await ac(page, 'fead-analysis');
  const cagrildi = await page.evaluate(async () => {
    let n = 0;
    const eski = window.veSaveTopology;
    window.veSaveTopology = function () { n++; };
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true }));
    await new Promise((r) => setTimeout(r, 100));
    window.veSaveTopology = eski;
    return n;
  });
  expect(cagrildi).toBe(1);
});
