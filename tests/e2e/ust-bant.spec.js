/**
 * ust-bant.spec.js — ATÖLYE ÜST BANDI
 * ────────────────────────────────────
 *
 * Bant artık komut dizmiyor: NEREDEYİM (marka · modül adı) + NE ARIYORUM
 * (komut arama) + TEK ANA EYLEM (Çöz). Şerit gövdesi varsayılan katlı.
 *
 * O varsayılanın meşruiyeti TEK bir koşula bağlı ve o koşul Node'da kapılı
 * (`tests/unit/komut-kapsami.test.js`): şeritteki her komut palette de var.
 * Burada ölçülen şey YERLEŞİM ve CANLI BAĞ — ikisi de jsdom'da ölçülemez.
 */
const { test, expect } = require('@playwright/test');
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

test('şerit gövdesi VARSAYILAN katlı — bant tek satır', async ({ page }) => {
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

test('komut arama düğmesi paleti AÇIYOR', async ({ page }) => {
  await ac(page, 'fead-analysis');
  await expect(page.locator('#ve-cmdk-input')).toBeHidden();
  await page.click('.ve-bant-ara');
  await expect(page.locator('#ve-cmdk-input')).toBeVisible();
});

// BANDIN TEK DOLU DÜĞMESİ: ikinci bir dolu düğme "asıl iş hangisi" sorusunu
// geri getirirdi. Ölçüt renk adı değil ZEMİN — aksan jetonuyla boyanmış kaç
// düğme var.
test('bantta TEK dolu düğme var', async ({ page }) => {
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
  expect(n).toBe(1);
});

test('gövde kapalı olunca tuval KAZANIYOR', async ({ page }) => {
  await ac(page, 'fead-analysis');
  const katli = await page.evaluate(olc);
  await page.evaluate(() => veRibbonToggleCollapse());   // gövdeyi AÇ
  await page.waitForTimeout(500);
  const acik = await page.evaluate(olc);
  expect(acik.katli).toBe(false);
  expect(katli.tuval.h - acik.tuval.h).toBeGreaterThan(60);
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
      // sekmeler gövdeye ait: gövde katlıyken görünmezler
      sekmeGorunur: !!(sekme && sekme.getBoundingClientRect().height > 0),
      markaIkonu: (() => {
        const m = document.querySelector('.ve-rb-strip .ve-brand-mark');
        return !!(m && m.getBoundingClientRect().width > 0);
      })(),
      bantY: Math.round(bant.getBoundingClientRect().height),
    };
  });
  expect(r.qatKabi).toBe(false);        // kaydet/geri/ileri ikonları banttan kalktı
  // SEKMELER BANDIN İÇİNDE (markanın yanında) ama KATLIYKEN GÖRÜNMEZ.
  // İki uç da ölçüldü ve ikisi de yanlıştı: hep görünürken üst satır eski
  // şeridin aynısı okunuyordu; gövdeye taşınınca da açılışta bandın
  // çizgisinin ALTINDA ikinci bir başlık satırı doğuyordu.
  expect(r.bantSekmesi).toBe(true);     // kabı BANT
  expect(r.sekmeGorunur).toBe(false);   // ama katlıyken çizilmiyor
  expect(r.markaIkonu).toBe(false);     // maket yalnız SÖZCÜK markasını gösteriyor
  expect(r.bantY).toBeLessThanOrEqual(32);   // "çok kalın olmuş" — 44 → 38 → 32
});

// Gövde açılınca sekmeler MARKANIN YANINDA belirir — ALTINDA değil.
// Kullanıcı bildirimi: "başlıklar üstteki çizginin altına geliyor; yanına
// gelsin, MFSim yazan kısmın yanında olsun."
test('gövde açılınca sekmeler MARKANIN YANINDA, bandın İÇİNDE', async ({ page }) => {
  await ac(page, 'fead-analysis');
  await page.evaluate(() => veRibbonToggleCollapse());
  await page.waitForTimeout(500);
  const r = await page.evaluate(() => {
    const t = document.querySelector('#ve-rb-tabs');
    const bant = document.querySelector('#ve-rb-strip');
    const marka = document.querySelector('#ve-project-name-btn');
    const tb = t.getBoundingClientRect(); const bb = bant.getBoundingClientRect();
    const mb = marka.getBoundingClientRect();
    return {
      gorunur: tb.height > 0, sekmeSayi: t.children.length,
      // AYNI SATIR: sekmelerin dikey orta noktası bandın içinde
      ayniSatir: (tb.y + tb.height / 2) > bb.y && (tb.y + tb.height / 2) < (bb.y + bb.height),
      markaninSaginda: tb.x > mb.x,
      // ve bandın ALTINA taşmıyor — ikinci bir başlık satırı yok
      cizginiAsmiyor: (tb.y + tb.height) <= (bb.y + bb.height) + 1,
    };
  });
  expect(r.gorunur).toBe(true);
  expect(r.sekmeSayi).toBeGreaterThan(1);
  expect(r.ayniSatir).toBe(true);
  expect(r.markaninSaginda).toBe(true);
  expect(r.cizginiAsmiyor).toBe(true);
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
    sagHiza: Math.round(r.right - a.right), ekranda: r.left >= 0 && r.right <= innerWidth,
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

// ŞERİDİ AÇ/DARALT DÜĞMESİ YERİNDE DURUR. Eskiden yalnız katlıyken vardı:
// basınca kayboluyor, sağ küme 26 px kayıyor ve tıklanan noktaya AVATAR
// oturuyordu — ikinci tık şerit yerine hesap menüsünü açıyordu (ölçüldü).
test('şerit düğmesine basınca sağ küme KAYMIYOR ve düğme hâlâ altında', async ({ page }) => {
  await ac(page, 'fead-analysis');
  const x = () => page.evaluate(() => ['.ve-bant-ara', '.ve-bant-ana', '#ve-bant-avatar', '#ve-rb-expand']
    .map((s) => Math.round(document.querySelector(s).getBoundingClientRect().left)));
  const nokta = await page.evaluate(() => { const r = document.getElementById('ve-rb-expand').getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  const once = await x();
  await page.mouse.click(nokta.x, nokta.y);
  await page.waitForTimeout(300);
  const sonra = await x();
  expect(sonra).toEqual(once);
  const r = await page.evaluate(({ x, y }) => ({
    katli: document.getElementById('ve-ribbon').classList.contains('is-collapsed'),
    aria: document.getElementById('ve-rb-expand').getAttribute('aria-expanded'),
    altindaki: (document.elementFromPoint(x, y) || {}).closest ? document.elementFromPoint(x, y).closest('button').id : null,
  }), nokta);
  expect(r.katli).toBe(false);
  expect(r.aria).toBe('true');
  expect(r.altindaki).toBe('ve-rb-expand');   // ikinci tık yine şeride gider
  await page.mouse.click(nokta.x, nokta.y);
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => document.getElementById('ve-ribbon').classList.contains('is-collapsed'))).toBe(true);
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
