/**
 * Gruplama Çerçevesi / Yazı Etiketi — kaydet → aç dayanıklılığı (E2E)
 *
 * Kullanıcı raporu: "Topolojide Gruplama Çerçevesi açtım, projeyi öyle
 * kaydettim; kayıtlı projeyi açtığımda çerçeve gelmiyor."
 *
 * Buradaki senaryolar gerçek tarayıcıda, gerçek kaydet/aç kod yollarından
 * (veSaveTopology → veShowSaveDialog blob'u · veLoadTopology → FileReader)
 * geçer. Birim testler serileştirme sözleşmesini kilitler; bu dosya sözleşmenin
 * canlı uygulamada da tuttuğunu doğrular.
 *
 * Çalıştırmak için: npm run test:e2e  (npx playwright install chromium)
 */
const { test, expect } = require('@playwright/test');

async function bootApp(page) {
  await page.goto('/index.html');
  // Uygulama şifre korumalı; modül yüklemesini login sonrası akışı taklit ederek başlat
  await page.evaluate(() => {
    if (window.MFSimLoader && typeof window.MFSimLoader.start === 'function') window.MFSimLoader.start();
  });
  await page.waitForFunction(() =>
    typeof window.createNode === 'function' &&
    typeof window.createAnnotation === 'function' &&
    typeof window.veSaveTopology === 'function' &&
    Array.isArray(window.nodes) && window.veTabs && window.veTabs.length > 0,
    null, { timeout: 90000 });
  await page.waitForFunction(() => {
    const s = document.getElementById('mfsim-loading-screen');
    return !s || s.style.display === 'none';
  }, null, { timeout: 90000 });
}

// "Kaydet" komutunun ürettiği proje JSON'unu diyaloğu açmadan yakala
async function saveProject(page) {
  return await page.evaluate(async () => {
    let blob = null;
    const orig = window.veShowSaveDialog;
    window.veShowSaveDialog = (name, b) => { blob = b; };
    veSaveTopology();
    window.veShowSaveDialog = orig;
    return await blob.text();
  });
}

// "Proje Aç" komutunu gerçek dosya girdisiyle sür (native diyalog açılmadan)
async function openProject(page, json) {
  await page.evaluate(async (txt) => {
    HTMLInputElement.prototype.click = function () {};
    let input = null;
    const origCreate = document.createElement.bind(document);
    document.createElement = function (tag) {
      const el = origCreate(tag);
      if (String(tag).toLowerCase() === 'input') input = el;
      return el;
    };
    veLoadTopology();
    document.createElement = origCreate;

    const dt = new DataTransfer();
    dt.items.add(new File([txt], 'proje.json', { type: 'application/json' }));
    input.files = dt.files;
    input.dispatchEvent(new Event('change'));
    await new Promise((r) => setTimeout(r, 1500));
  }, json);
}

test.describe('Gruplama çerçevesi kayıtta hayatta kalır', () => {
  test.setTimeout(180000);

  test('kök topolojideki çerçeve kaydet → aç sonrası geri gelir', async ({ page }) => {
    await bootApp(page);
    await page.evaluate(() => {
      veSelectModuleFromOverlay('full-throttle');
      createNode('engine', 3100, 3100);
      createAnnotation('frame', 3050, 3050, { text: 'GÜÇ GRUBU' });
    });
    await expect(page.locator('.ve-annotation-frame')).toHaveCount(1);

    const json = await saveProject(page);
    expect(JSON.parse(json).tabs[0].state.annotations.map((a) => a.text)).toEqual(['GÜÇ GRUBU']);

    await bootApp(page);
    await openProject(page, json);

    await expect(page.locator('.ve-annotation-frame')).toHaveCount(1);
    await expect(page.locator('.ve-annotation-frame .ve-annotation-label')).toHaveText('GÜÇ GRUBU');
  });

  test('alt-topolojideki (Araç Performans) çerçeve kaydet → aç sonrası geri gelir', async ({ page }) => {
    await bootApp(page);
    await page.evaluate(async () => {
      veSelectModuleFromOverlay('full-throttle');
      createNode('arac-performans', 3200, 3200);
      veAracOpenEditor(nodes[0].id);
      await new Promise((r) => setTimeout(r, 400));
      createAnnotation('frame', 100, 100, { text: 'AKTARMA ORGANLARI' });
      veAracCloseEditor();
      await new Promise((r) => setTimeout(r, 400));
    });

    const json = await saveProject(page);
    const sub = JSON.parse(json).tabs[0].state.nodes[0].data.subTopology;
    expect(sub.annotations.map((a) => a.text)).toEqual(['AKTARMA ORGANLARI']);

    await bootApp(page);
    await openProject(page, json);
    const texts = await page.evaluate(async () => {
      veAracOpenEditor(nodes.find((n) => n.type === 'arac-performans').id);
      await new Promise((r) => setTimeout(r, 500));
      return annotations.map((a) => a.text);
    });
    expect(texts).toEqual(['AKTARMA ORGANLARI']);
    await expect(page.locator('.ve-annotation-frame')).toHaveCount(1);
  });

  test('alt-topolojinin İÇİNDEYKEN proje açmak, açılan projeyi ezmez', async ({ page }) => {
    // Regresyon: veLoadTopology alt-sistem gezinme yolunu (veAracStack) sıfırlamıyordu.
    // İlk arka-plan kaydı veAracCollapseToRoot ile ÖNCEKİ projenin parentState'ini
    // canlı duruma geri yazıyor, yeni açılan projenin düğümleri ve çerçeveleri
    // sessizce kayboluyordu.
    await bootApp(page);
    await page.evaluate(async () => {
      veSelectModuleFromOverlay('full-throttle');
      createNode('arac-performans', 3200, 3200);
      createAnnotation('frame', 300, 300, { text: 'A-KÖK' });
    });
    const json = await saveProject(page);

    // Başka bir oturum: farklı topoloji kur, alt-topolojiye GİR, sonra projeyi aç
    await bootApp(page);
    await page.evaluate(async () => {
      veSelectModuleFromOverlay('full-throttle');
      createNode('arac-performans', 3200, 3200);
      createNode('engine', 3600, 3200);
      createNode('wheel', 3900, 3200);
      createAnnotation('frame', 50, 50, { text: 'B-KÖK' });
      veAracOpenEditor(nodes[0].id);
      await new Promise((r) => setTimeout(r, 400));
    });

    await openProject(page, json);

    const after = await page.evaluate(async () => {
      veSaveActiveTabStateKeepView();      // otomatik yedek / sonuç ağacı yenileme bunu çağırır
      await new Promise((r) => setTimeout(r, 600));
      return {
        stack: veAracStack.length,
        canvasAnnots: annotations.map((a) => a.text),
        tabNodeCount: veTabs[veActiveTabIdx].state.nodes.length,
        tabAnnots: (veTabs[veActiveTabIdx].state.annotations || []).map((a) => a.text),
      };
    });

    expect(after.stack).toBe(0);              // gezinme yolu sıfırlandı
    expect(after.canvasAnnots).toEqual(['A-KÖK']);
    expect(after.tabNodeCount).toBe(1);       // B projesinin 3 düğümü GERİ GELMEDİ
    expect(after.tabAnnots).toEqual(['A-KÖK']);
  });

  test('Takoz iç topolojisi: JSON dışa aktar → örneği aktar çerçeveyi korur', async ({ page }) => {
    await bootApp(page);
    const r = await page.evaluate(async () => {
      veSelectModuleFromOverlay('full-throttle');
      createNode('mount-analysis', 3200, 3200);
      veMntOpenEditor(nodes[0].id);
      await new Promise((res) => setTimeout(res, 500));
      createAnnotation('frame', 100, 100, { text: 'TAKOZ GRUBU' });

      let blob = null;
      const orig = window.veShowSaveDialog;
      window.veShowSaveDialog = (n, b) => { blob = b; };
      veMntExportTopology();
      window.veShowSaveDialog = orig;
      const parsed = JSON.parse(await blob.text());

      window.confirm = () => true;
      _mntLoadExampleFromJSON(parsed, { vehicle: 'test' });
      await new Promise((res) => setTimeout(res, 800));

      return {
        exported: (parsed.annotations || []).map((a) => a.text),
        after: annotations.map((a) => a.text),
      };
    });

    expect(r.exported).toEqual(['TAKOZ GRUBU']);
    expect(r.after).toEqual(['TAKOZ GRUBU']);
    await expect(page.locator('.ve-annotation-frame')).toHaveCount(1);
  });
});
