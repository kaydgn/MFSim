/**
 * fead-sonuclar.spec.js — FEAD SONUÇLAR SEKMESİ (gerçek tarayıcı)
 *
 * Node'da HİÇ koşmayan halkalar:
 *
 *   • BOŞ PANO SAYFA BOYU. Hiç çizilmemiş eksen tuvali (#ve-trace-axis)
 *     tarayıcının varsayılan 300×150 oranıyla genişliğe ölçekleniyordu —
 *     ölçüldü: 1160 px genişlikte 580 px, boş panonun alanı 932 → 332 px.
 *     Ortalı tek satırlık boş durum bunu gizliyordu; FEAD'in sayfa boyu
 *     başlangıç kartı kırpılınca göründü. jsdom yerleşim yapmaz.
 *   • `:has()` kuralı başlangıç kartını üstten akıtıyor (jsdom hesaplamaz).
 *   • Hazır diyagram GERÇEKTEN çiziyor: yüzey açılıyor, tuvalin boyu var,
 *     yorum şeridi görünür.
 *   • Çözücü penceresindeki "Sonuçlar'da aç" sayfayı değiştirip FEAD
 *     sekmesini açıyor ve müfettişi kapatıyor (açık kalsaydı panonun sağını
 *     örterdi — ölçüldü: 1600 px ekranda 380 px).
 */
const { test, expect } = require('@playwright/test');
test.setTimeout(180000);

async function feadCoz(page, boy) {
  const hatalar = [];
  page.on('pageerror', (e) => hatalar.push(e.message));
  await page.setViewportSize(boy || { width: 1600, height: 1000 });
  await page.goto('/index.html');
  await page.evaluate(() => { if (window.MFSimLoader && MFSimLoader.start) MFSimLoader.start(); });
  await page.waitForFunction(() =>
    typeof window.createNode === 'function' && typeof window.veFeadOpenEditor === 'function' &&
    typeof window.veFeadResPreset === 'function' && Array.isArray(window.nodes), null, { timeout: 120000 });
  await page.evaluate(() => {
    if (typeof veSelectModuleFromOverlay === 'function') veSelectModuleFromOverlay('arac-performans');
  });
  await page.waitForFunction(() => {
    const s = document.getElementById('mfsim-loading-screen');
    return !s || s.style.display === 'none';
  }, null, { timeout: 120000 });
  await page.evaluate(() => { const n = createNode('fead-analysis', 400, 300); veFeadOpenEditor(n.id); });
  await page.waitForTimeout(300);
  await page.evaluate(() => { if (typeof veFeadWizClose === 'function') veFeadWizClose(false); });
  await page.evaluate(() => veFeadLoadExample('AG00976_GATES_2025'));
  await page.waitForTimeout(900);
  const sv = await page.evaluate(() => {
    const s = nodes.find((n) => n.type === 'fead-solver');
    veFeadSolve(s.id);
    return s.id;
  });
  return { hatalar, sv };
}

test('çözücü penceresi → "Sonuçlar\'da aç" → FEAD sekmesi, başlangıç kartı sayfa boyu', async ({ page }) => {
  const { hatalar, sv } = await feadCoz(page);
  // Çözücü penceresini aç ve Sonuç sekmesine geç
  await page.evaluate((id) => {
    if (typeof clearSelection === 'function') clearSelection();
    addToSelection(nodes.find((n) => n.id === id));
    veTogglePropertiesPanel(true);
  }, sv);
  await page.waitForTimeout(250);
  await page.evaluate(() => {
    // Sekme ADI kendi öğesinde: sekme 2026-09-26'dan beri adının altında
    // DURUMUNU da taşıyor, tüm metin artık yalnız "Sonuç" değil.
    const ad = (x) => (x.querySelector('.ve-fp-tab-ad') || x).textContent;
    const b = [...document.querySelectorAll('button, [role=tab]')].find((x) => /^\s*Sonuç\s*$/.test(ad(x)));
    if (b) b.click();
  });
  const ac = page.locator('.ve-fr-ac');
  await expect(ac).toBeVisible();
  await expect(page.locator('.ve-properties-content .ve-fr-kpi')).toHaveCount(10);
  await ac.click();
  await page.waitForTimeout(600);

  const olc = await page.evaluate(() => {
    const e = document.getElementById('ve-trace-empty');
    const ov = document.getElementById('ve-properties-overlay');
    return {
      sekme: veActiveSolverTabId,
      bosH: e.getBoundingClientRect().height,
      akis: getComputedStyle(e).justifyContent,
      kart: !!e.querySelector('.ve-fr-start'),
      kpi: e.querySelectorAll('.ve-fr-kpi').length,
      hazir: e.querySelectorAll('.ve-fr-preset').length,
      mufettis: ov ? getComputedStyle(ov).display : 'yok',
      eksenH: document.getElementById('ve-trace-axis').getBoundingClientRect().height
    };
  });
  expect(olc.sekme).toBe('fead');
  expect(olc.kart).toBe(true);
  expect(olc.kpi).toBe(10);
  expect(olc.hazir).toBe(6);
  // EKSEN TUVALİ YER YUTMAZ: 1000 px ekranda boş pano 800 px'ten büyük
  // (eski: 332 px — eksen tuvali 580 px'e ölçekleniyordu).
  expect(olc.eksenH).toBeLessThanOrEqual(40);
  expect(olc.bosH).toBeGreaterThan(800);
  // :has() kuralı: kart üstten akar
  expect(olc.akis).toBe('flex-start');
  expect(olc.mufettis).toBe('none');
  expect(hatalar).toEqual([]);
});

test('hazır diyagram GERÇEKTEN çizer; özet penceresi açılır ve kapanır', async ({ page }) => {
  const { hatalar } = await feadCoz(page);
  await page.evaluate(() => veFeadOpenResults());
  await page.waitForTimeout(500);
  await page.locator('.ve-fr-preset', { hasText: 'Campbell diyagramı' }).click();
  await page.waitForTimeout(400);
  const cizim = await page.evaluate(() => ({
    yuzey: getComputedStyle(document.getElementById('ve-trace-surface')).display,
    tuvalH: document.getElementById('ve-trace-canvas').getBoundingClientRect().height,
    bos: getComputedStyle(document.getElementById('ve-trace-empty')).display,
    not: getComputedStyle(document.getElementById('ve-trace-note')).display,
    notMetin: document.getElementById('ve-trace-note').innerText,
    eksen: veResultSlots[0].xAxis && veResultSlots[0].xAxis.id
  }));
  expect(cizim.yuzey).toBe('block');
  expect(cizim.tuvalH).toBeGreaterThan(300);
  expect(cizim.bos).toBe('none');
  expect(cizim.not).not.toBe('none');
  expect(cizim.notMetin).toMatch(/Campbell diyagramı/);
  expect(cizim.eksen).toBe('~fead-campbell:rpm');

  // Veri Gezgini: durum satırı ve özet kısayolu
  await expect(page.locator('#ve-results-tree .ve-fr-chip', { hasText: 'Güncel' })).toBeVisible();
  await page.locator('#ve-results-tree .ve-fr-tree-link', { hasText: 'FEAD Sonuç Özeti' }).click();
  const ov = page.locator('#ve-report-overlay');
  await expect(ov).toBeVisible();
  await expect(ov.locator('.ve-rep-head')).toHaveCount(1);
  await expect(ov.locator('.ve-fr-sec')).toHaveCount(await ov.locator('.ve-fr-sec').count());
  expect(await ov.locator('.ve-fr-sec').count()).toBeGreaterThanOrEqual(9);
  // Özet yatay taşmaz: geniş tablolar kendi kabında kayar
  const tasma = await page.evaluate(() => {
    const d = document.querySelector('.ve-fr-doc');
    return d.scrollWidth - d.clientWidth;
  });
  expect(tasma).toBeLessThanOrEqual(1);
  await ov.getByRole('button', { name: /Kapat/ }).click();
  await expect(ov).toBeHidden();
  expect(hatalar).toEqual([]);
});

// SUNUM KUSURLARI (2026-09-28) — kullanıcının ekranı (1.920 × 952) ve dar ekran.
// Hepsi YERLEŞİME bağlı, jsdom ölçemez; ölçülen önceki sayılar yanlarında.
for (const boy of [{ width: 1920, height: 952 }, { width: 1366, height: 768 }]) {
  test(`sunum ${boy.width}×${boy.height}: kırpılan yazı, bölünen sayı, bozuk lejant, bitişik hücre YOK`, async ({ page }) => {
    const { hatalar } = await feadCoz(page, boy);
    await page.evaluate(() => veFeadOpenResults());
    await page.waitForTimeout(600);
    const kart = await page.evaluate(() => {
      const kok = document.querySelector('.ve-fr-start');
      const kesik = [];
      kok.querySelectorAll('*').forEach((el) => {
        if (getComputedStyle(el).textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth + 0.5)
          kesik.push(el.textContent.trim());
      });
      // Satır sonunda bölünen sayı öbeği: öbeğin kutuları İKİ satıra düşüyor mu
      const RX = /\d[\d.,]*(?:–\d[\d.,]*)?\s?(?:Hz|N|mm|d\/dk|kW|Nm|saat|°)(?![\p{L}])|\d[\d.,]*–\d[\d.,]*/gu;
      const kirik = [];
      kok.querySelectorAll('.ve-fr-kpi-not').forEach((el) => {
        const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        let metin = '', dugum = [];
        while (w.nextNode()) { dugum.push([w.currentNode, metin.length]); metin += w.currentNode.textContent; }
        let m;
        while ((m = RX.exec(metin))) {
          const rg = document.createRange();
          const bul = (i) => { let d = dugum[0]; dugum.forEach((x) => { if (x[1] <= i) d = x; }); return [d[0], i - d[1]]; };
          const a = bul(m.index), b = bul(m.index + m[0].length - 1);
          rg.setStart(a[0], a[1]); rg.setEnd(b[0], b[1] + 1);
          const ust = new Set([...rg.getClientRects()].map((q) => Math.round(q.top)));
          if (ust.size > 1) kirik.push(m[0]);
        }
      });
      return { kesik, kirik };
    });
    // önce: 1.920'de 2 kırpık karo ("…en düşük kay…"), 1 bölünmüş öbek ("44–" | "138 Hz")
    expect(kart).toEqual({ kesik: [], kirik: [] });

    // Lejant: modül kanalının adı bölünmez ('::' yok), kırpılmaz, birim tekrarlanmaz
    const hazir = await page.evaluate(() => veFeadSignals.presets(window.veFeadResults.signals).map((x) => x.k));
    for (const k of hazir) {
      await page.evaluate((k) => veFeadResPreset(k), k);
      await page.waitForTimeout(300);
      const bozuk = await page.evaluate(() => {
        const geo = veTrState.geo, out = [];
        const c = document.createElement('canvas').getContext('2d');
        c.font = veThemeFont('micro', 600);
        geo.lanes.forEach((lane) => {
          if (!(lane._nameW > 0)) return;
          veTrNameRows(lane).forEach((r) => {
            const gor = veTrFitTitle(c, r.text, lane._nameW - VE_TR.NAME_DOT - VE_TR.NAME_DOT_GAP);
            if (gor !== r.text || /::/.test(gor) || /\s(\S+) \[\1\]$/.test(gor)) out.push(gor);
          });
        });
        return out;
      });
      // önce (Campbell): 11 satırın 11'i — "1. mertebe::dönme", "202,9 Hz [Hz]"
      expect({ hazir: k, bozuk }).toEqual({ hazir: k, bozuk: [] });
    }

    // Sonuç Özeti: sağa yaslı sayıyı izleyen sola yaslı metin en az 20 px açıkta
    await page.evaluate(() => veFeadResSummaryOpen());
    await page.waitForTimeout(400);
    const bitisik = await page.evaluate(() => {
      const out = [];
      document.querySelectorAll('.ve-fr-doc table').forEach((t) => {
        const r = t.tBodies[0] && t.tBodies[0].rows[0];
        if (!r) return;
        for (let i = 0; i + 1 < r.cells.length; i++) {
          const a = r.cells[i], b = r.cells[i + 1];
          if (getComputedStyle(a).textAlign !== 'right' || getComputedStyle(b).textAlign !== 'left') continue;
          const ra = document.createRange(); ra.selectNodeContents(a);
          const rb = document.createRange(); rb.selectNodeContents(b);
          const bosluk = rb.getBoundingClientRect().left - ra.getBoundingClientRect().right;
          if (bosluk < 20) out.push(t.tHead.rows[0].cells[i].textContent + ' → ' + Math.round(bosluk) + ' px');
        }
      });
      return out;
    });
    // önce: "Tepe gerginlik [N] → Durum" ve "f [Hz] → Baskın" 12 px
    expect(bitisik).toEqual([]);
    expect(hatalar).toEqual([]);
  });
}
