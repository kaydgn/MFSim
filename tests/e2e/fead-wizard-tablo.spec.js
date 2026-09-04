/**
 * fead-wizard-tablo.spec.js — KASNAK TABLOSU SIĞAR (gerçek tarayıcı)
 *
 * Kullanıcı bildirimi (2026-09-02): *"kasnakları tablo halinde girdiğimiz
 * yerin tablosu böyle yana kaydırmalı olmuş… Bazı sütunlar çok geniş olmuş.
 * Onları düzelterek, bu tablonun fit olmasını sağlayalım."*
 *
 * ÖLÇÜLDÜ (düzeltmeden önce, 1280×900, AG00976 örneği): kapsayıcı 873 px,
 * tablo 1058 px → 185 px taşma. Sütunlar 46 · 132 · 134 · 134 · 134 · 134 ·
 * 132 · 134 · 78. Yani genişlik İÇERİKLE İLGİSİZDİ: "263" yazan X ile
 * "Klima Kompresörü" yazan Ad ikisi de 134 px alıyordu.
 *
 * Birim testin tuttuğu şey YAPISAL koşul (sabit yerleşim + %100 toplam);
 * jsdom düzen hesaplamadığı için TAŞMANIN KENDİSİ ancak burada ölçülebilir.
 * `table-layout:fixed` CSS'ten düşerse birim test bunu göremez — bu dosya görür.
 */
const { test, expect } = require('@playwright/test');

test.setTimeout(180000);

async function kasnakAdimi(page, genislik) {
  await page.setViewportSize({ width: genislik, height: 900 });
  await page.goto('/index.html');
  await page.evaluate(() => { if (window.MFSimLoader && window.MFSimLoader.start) window.MFSimLoader.start(); });
  await page.waitForFunction(() => typeof window.createNode === 'function' &&
    typeof window.veFeadOpenEditor === 'function' && typeof window.veFeadWizOpen === 'function',
    null, { timeout: 60000 });
  await page.evaluate(() => { if (typeof veSelectModuleFromOverlay === 'function') veSelectModuleFromOverlay('arac-performans'); });
  await page.waitForFunction(() => { const s = document.getElementById('mfsim-loading-screen'); return !s || s.style.display === 'none'; },
    null, { timeout: 60000 });
  await page.evaluate(() => { const n = createNode('fead-analysis', 400, 300); veFeadOpenEditor(n.id); });
  await page.waitForFunction(() => window.nodes.some((n) => n.type === 'fead-wizard'), null, { timeout: 20000 });
  await page.evaluate(() => {
    const w = window.nodes.find((n) => n.type === 'fead-wizard');
    veFeadWizOpen(w.id);
    veFeadWizSeed('AG00976_GATES_2025');    // altı kasnak + gergi satırı
    veFeadWizGoto(1);                        // 0-tabanlı: "2. Kasnaklar"
  });
  return page.evaluate(() => {
    const tbl = [...document.querySelectorAll('#ve-feadwiz-overlay .ve-fw-tbl')]
      .find((t) => /Sürücü/.test(t.querySelector('thead').textContent));
    const wrap = tbl.closest('.ve-fw-tblwrap');
    const ths = [...tbl.querySelectorAll('thead th')];
    return {
      kapsayici: Math.round(wrap.clientWidth),
      tablo: Math.round(tbl.getBoundingClientRect().width),
      tasma: wrap.scrollWidth - wrap.clientWidth,
      satir: tbl.querySelectorAll('tbody tr').length,
      // nowrap + sabit genişlik: sığmayan başlık SESSİZCE kırpılırdı.
      kirpik: ths.filter((th) => th.scrollWidth > th.clientWidth + 1).map((th) => th.textContent.trim()),
      sutun: ths.map((th) => ({ ad: th.textContent.trim() || '(ops)', px: Math.round(th.getBoundingClientRect().width) }))
    };
  });
}

// Üç genişlik: kullanıcının resmindeki (1280), modalın tavana dayandığı
// (1600 — kapsayıcı büyümez, modal max-width 1180) ve dar bir dizüstü (1100).
for (const w of [1280, 1600, 1100]) {
  test(w + 'px görünümde tablo SIĞIYOR — yatay kaydırma yok', async ({ page }) => {
    const r = await kasnakAdimi(page, w);
    console.log(w + 'px → ' + JSON.stringify(r));

    expect(r.satir).toBeGreaterThan(1);            // kasnaklar + gergi satırı
    expect(r.tasma).toBe(0);                       // ASIL KAPI
    expect(r.tablo).toBeLessThanOrEqual(r.kapsayici);
    expect(r.kirpik).toEqual([]);                  // hiçbir başlık kesilmiyor
    // Sayı sütunları metin sütunlarından DAR olmalı — eski kusur tam da
    // hepsinin eşitlenmesiydi.
    const px = (ad) => r.sutun.find((s) => s.ad === ad).px;
    expect(px('X [mm]')).toBeLessThan(px('Ad'));
    expect(px('Y [mm]')).toBeLessThan(px('Tip'));
    expect(px('Sürücü')).toBeLessThan(px('Ø OD [mm]'));
  });
}
