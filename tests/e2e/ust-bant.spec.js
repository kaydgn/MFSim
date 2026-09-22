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
    await page.waitForTimeout(1200);
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
  // BANDIN ÖLÇÜSÜ İKİ UÇLU. Alt sınır: eski 30 px'lik araç kuşağı değil,
  // marka ve eylem taşıyan bir bant. Üst sınır: kalın da değil — ilk yazım
  // 44 px'ti ve kullanıcı "çok kalın olmuş" dedi. İki sınır arasında bir
  // aralık, tek bir sayıyı çivilemekten dürüst: yazı ölçüsü değişirse bant
  // da bir tık oynayabilmeli, ama iki uçtan da kaçamamalı.
  expect(r.bant.h).toBeGreaterThan(32);
  expect(r.bant.h).toBeLessThanOrEqual(40);
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
  expect(r.bantSekmesi).toBe(false);    // şerit sekmeleri gövdenin
  expect(r.sekmeGorunur).toBe(false);   // gövde katlıyken sekme de yok
  expect(r.markaIkonu).toBe(false);     // maket yalnız SÖZCÜK markasını gösteriyor
  expect(r.bantY).toBeLessThanOrEqual(40);   // "çok kalın olmuş" — 44 → 38
});

// Sekmeler kaybolmadı, YERİ değişti: gövde açılınca birlikte gelirler.
test('gövde açılınca şerit sekmeleri geliyor', async ({ page }) => {
  await ac(page, 'fead-analysis');
  await page.evaluate(() => veRibbonToggleCollapse());
  await page.waitForTimeout(500);
  const gorunur = await page.evaluate(() => {
    const t = document.querySelector('#ve-rb-tabs');
    return !!(t && t.getBoundingClientRect().height > 0 && t.children.length > 1);
  });
  expect(gorunur).toBe(true);
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

test('avatar menüsü açılıyor ve ESC ile kapanıyor', async ({ page }) => {
  await ac(page, 'fead-analysis');
  await page.click('#ve-bant-avatar');
  await expect(page.locator('.ve-avatar-menu')).toBeVisible();
  await expect(page.locator('.ve-avatar-menu [data-ve-avatar="cikis"]')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.ve-avatar-menu')).toHaveCount(0);
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
