/**
 * structural-geometry.spec.js — YAPISAL ANALİZ / Geometri: STEP içe aktarma
 *
 * GERÇEK TARAYICI kapısı. Birim testler köprüyü (js/structural-model.js) Node
 * altında sınıyor; buradaki soru başka: ZİNCİR uçtan uca ayakta mı?
 *
 *   vendor script → 7.3 MB .wasm'ın FETCH'i → OCCT derlemesi → panel →
 *   THREE sahnesi → CAD yüzü vurgusu
 *
 * Bu zincirin dört halkası Node'da HİÇ koşmuyor: .wasm'ın göreli yoldan
 * çekilmesi, `document.currentScript.src` olmadan çalışması, WebGL bağlamı ve
 * fare ile yüz seçimi. Biri kırılırsa panel yine açılır, düğme yine görünür —
 * ve basınca hiçbir şey olmaz. Sessiz kırılma tam olarak burada yakalanır.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

const CUBE = path.join(__dirname, '../fixtures/step/cube-mm.step');
const ROUNDED = path.join(__dirname, '../fixtures/step/rounded-cube.step');

async function bootApp(page) {
  await page.goto('/index.html');
  await page.evaluate(() => {
    if (window.MFSimLoader && typeof window.MFSimLoader.start === 'function') window.MFSimLoader.start();
  });
  await page.waitForFunction(() =>
    typeof window.createNode === 'function' &&
    typeof window.veStrOpenEditor === 'function' &&
    typeof window.veStrImportStep === 'function' &&
    Array.isArray(window.nodes),
    null, { timeout: 60000 });
  await page.evaluate(() => {
    if (typeof veSelectModuleFromOverlay === 'function') veSelectModuleFromOverlay('arac-performans');
  });
  await page.waitForFunction(() => {
    const s = document.getElementById('mfsim-loading-screen');
    return !s || s.style.display === 'none';
  }, null, { timeout: 60000 });
}

// Modülü kur → iç topolojiye gir → Geometri panelini aç.
//
// GEZİNME `evaluate` İLE, BİLEREK. Kanvas düğümüne `locator.dblclick()`
// Playwright'ın "stable" beklemesine takılıyor (modül kartı seçim/hover
// geçişleri sürerken kutu kıpırdıyor) — ve bu, ölçmek istediğimiz şeyle
// ilgisiz bir kırılganlık. Çağrılan fonksiyonlar ui-core.js'in çift tıkta
// çağırdığı fonksiyonların TA KENDİSİ; gezinme kablolamasının kapısı zaten
// tests/unit/cp-structural.test.js'te.
//
// Asıl sınanan şey — dosya seçme, incelik düğmesi, fareyle yüz seçimi —
// GERÇEK DOM etkileşimiyle yapılıyor; orada taklit yok.
async function openGeometryPanel(page) {
  await page.evaluate(() => { createNode('structural-analysis', 3200, 3200); });
  await page.evaluate(() => {
    const n = nodes.find((x) => x.type === 'structural-analysis');
    veStrOpenEditor(n.id);
  });
  await page.waitForFunction(() => window.veStrStack.length === 1, null, { timeout: 15000 });
  await page.evaluate(() => {
    const g = nodes.find((x) => x.type === 'str-geometry');
    showNodeProperties(g);
    // Modal OTOMATİK AÇILMAZ (bkz. cp-core.js) — açılmazsa panel sarmalayıcısı
    // sıfır boyutlu kalır, 3B kanvas 1×1 kurulur ve "görünmez" sayılır.
    veTogglePropertiesPanel(true);
  });
  await expect(page.locator('#ve-str-geom-file')).toBeAttached({ timeout: 10000 });
}

test.describe('Yapısal Analiz — Geometri: STEP içe aktarma', () => {
  test.setTimeout(180000);

  test('STEP seçilince parça okunur, künye dolar ve 3B görüntüleyici açılır', async ({ page }) => {
    await bootApp(page);
    await openGeometryPanel(page);

    // Başlangıç: kanvas YOK (boş WebGL bağlamı açılmıyor)
    await expect(page.locator('#ve-str-geom-canvas')).toHaveCount(0);

    await page.locator('#ve-str-geom-file').setInputFiles(CUBE);

    // .wasm ilk kez indiriliyor (7.3 MB) → cömert süre
    await page.waitForFunction(
      () => window.veStrGeometryCache && Object.keys(window.veStrGeometryCache).length > 0,
      null, { timeout: 120000 }
    );

    const g = await page.evaluate(() => {
      const k = Object.keys(window.veStrGeometryCache)[0];
      const x = window.veStrGeometryCache[k];
      return { ok: x.ok, tri: x.stats.triCount, faces: x.stats.faceCount, size: x.bbox.size, wasm: x.wasmUrl };
    });
    expect(g.ok).toBe(true);
    expect(g.tri).toBe(12);            // küp: 6 yüz × 2 üçgen
    expect(g.faces).toBe(6);
    g.size.forEach((s) => expect(s).toBeCloseTo(1000, 2));   // mm'ye çevrildi
    // .wasm GERÇEKTEN ağdan geldi (gömülü değil) — tek dosya sürümündeki
    // kırılganlığın kaynağı da bu, o yüzden hangi yolun tuttuğu ölçülüyor.
    expect(g.wasm).toContain('occt-import-js.wasm');

    // 3B görüntüleyici GERÇEKTEN kuruldu: WebGL bağlamı + sahnede katı var.
    await expect(page.locator('#ve-str-geom-canvas')).toBeVisible();
    const v = await page.evaluate(() => ({
      var: !!window._veStrViewer,
      solids: window._veStrViewer ? window._veStrViewer.solids.length : 0,
      w: document.getElementById('ve-str-geom-canvas').width
    }));
    expect(v.var).toBe(true);
    expect(v.solids).toBe(1);
    expect(v.w).toBeGreaterThan(0);

    // Künye panelde yazılı
    const panel = await page.locator('.ve-properties-content').innerText();
    expect(panel).toContain('cube-mm.step');
    expect(panel).toContain('1.000');            // 1000 mm, tr-TR binlik ayracı
  });

  test('fare parçanın üstünde: vurgulanan şey ÜÇGEN değil CAD YÜZÜ', async ({ page }) => {
    await bootApp(page);
    await openGeometryPanel(page);
    await page.locator('#ve-str-geom-file').setInputFiles(ROUNDED);
    await page.waitForFunction(
      () => window.veStrGeometryCache && Object.keys(window.veStrGeometryCache).length > 0,
      null, { timeout: 120000 }
    );
    await expect(page.locator('#ve-str-geom-canvas')).toBeVisible();

    // Kanvasın ortasına gel — kamera parçayı çerçeveliyor, orta piksel katıyı vurur.
    const box = await page.locator('#ve-str-geom-canvas').boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForFunction(() => window._veStrViewer && window._veStrViewer.hoverFace,
      null, { timeout: 10000 });

    const h = await page.evaluate(() => {
      const f = window._veStrViewer.hoverFace;
      return { id: f.id, tri: f.triCount, first: f.first, last: f.last, hl: !!window._veStrViewer.hl };
    });
    // Kimlik `m<mesh>/f<yüz>` — sınır koşulunun bağlanacağı dizginin ta kendisi.
    expect(h.id).toMatch(/^m\d+\/f\d+$/);
    // Vurgu bir ÜÇGEN değil: yüzün BÜTÜN üçgenleri.
    expect(h.tri).toBe(h.last - h.first + 1);
    expect(h.hl).toBe(true);

    // Tooltip kullanıcıya yüzü SÖYLÜYOR
    await expect(page.locator('.ve-str-vwr-tip')).toBeVisible();
    expect(await page.locator('.ve-str-vwr-tip').innerText()).toContain('CAD yüzü');
  });

  test('ağ inceliği değişince ÜÇGEN değişir, CAD yüz kimlikleri DEĞİŞMEZ', async ({ page }) => {
    await bootApp(page);
    await openGeometryPanel(page);
    await page.locator('#ve-str-geom-file').setInputFiles(ROUNDED);
    await page.waitForFunction(
      () => window.veStrGeometryCache && Object.keys(window.veStrGeometryCache).length > 0,
      null, { timeout: 120000 }
    );

    const oku = () => page.evaluate(() => {
      const k = Object.keys(window.veStrGeometryCache)[0];
      const x = window.veStrGeometryCache[k];
      return { tri: x.stats.triCount, ids: x.faces.map((f) => f.id).join(',') };
    });
    const orta = await oku();

    // "Kaba" kademesine geç (panelde gerçek düğme)
    await page.locator('.ve-str-seg-btn', { hasText: 'Kaba' }).first().click();
    await page.waitForFunction(
      (t) => {
        const k = Object.keys(window.veStrGeometryCache)[0];
        return window.veStrGeometryCache[k].stats.triCount !== t;
      }, orta.tri, { timeout: 60000 }
    );
    const kaba = await oku();

    expect(kaba.tri).toBeLessThan(orta.tri);   // ağ GERÇEKTEN değişti
    expect(kaba.ids).toBe(orta.ids);           // kimlikler AYNI ← sınır koşulları ayakta kalır
  });

  // Bu kapı GERÇEK bir hatadan doğdu ve ölçüldü. js/measure-dropzone.js
  // dinleyicileri `document` üzerinde ve BUBBLE evresinde; Geometri'nin bırakma
  // alanı stopPropagation çağırınca oradaki `drop` işleyicisi HİÇ çalışmıyor →
  // `veImpDropShow(false)` çağrılmıyor → ölçüm kaplaması ekranda ASILI kalıyor.
  //
  // ÖLÇÜLDÜ (gerçek tarayıcı, düzeltme öncesi/sonrası):
  //   alan üzerindeyken kaplama açık: ESKİ true → YENİ false
  //   bıraktıktan SONRA kaplama açık: ESKİ true → YENİ false
  //
  // Birim testi bunu YAKALAYAMAZ: orada dinleyiciler hiç bağlanmıyor.
  test('STEP alanına sürüklerken ölçüm kaplaması çekiliyor ve ASILI KALMIYOR', async ({ page }) => {
    await bootApp(page);
    await openGeometryPanel(page);

    const r = await page.evaluate(() => {
      const dt = () => {
        const d = new DataTransfer();
        d.items.add(new File(['ISO-10303-21;'], 'a.step', { type: 'application/octet-stream' }));
        return d;
      };
      const fire = (el, t) => el.dispatchEvent(new DragEvent(t, { bubbles: true, cancelable: true, dataTransfer: dt() }));
      const ov = () => { const o = document.getElementById('ve-imp-drop'); return !!(o && o.classList.contains('on')); };
      const zone = document.querySelector('.ve-str-drop');

      fire(document.getElementById('ve-canvas'), 'dragenter');
      const disarida = ov();                      // genel davranış KORUNMALI
      fire(zone, 'dragenter'); fire(zone, 'dragover');
      const uzerinde = ov();                      // alan üstünde ÇEKİLMELİ
      const isaretli = zone.classList.contains('on');

      let acildi = 0;
      const orig = window.veImpLoadFile;
      window.veImpLoadFile = () => { acildi++; };
      fire(zone, 'drop');
      window.veImpLoadFile = orig;
      return { disarida, uzerinde, isaretli, sonra: ov(), acildi };
    });

    expect(r.disarida).toBe(true);    // ölçüm kaplaması genel olarak hâlâ çalışıyor
    expect(r.uzerinde).toBe(false);   // STEP alanının üstünde YANLIŞ hedefi göstermiyor
    expect(r.isaretli).toBe(true);    // doğru hedef kendini işaretliyor
    expect(r.sonra).toBe(false);      // ← ASIL KAPI: kaplama asılı kalmıyor
    expect(r.acildi).toBe(0);         // ölçüm sihirbazı açılmıyor
  });

  test('STEP olmayan dosya SESSİZCE yutulmuyor — sebep yazılıyor', async ({ page }) => {
    await bootApp(page);
    await openGeometryPanel(page);
    await page.locator('#ve-str-geom-file').setInputFiles({
      name: 'resim.png', mimeType: 'image/png', buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47])
    });
    await expect(page.locator('#ve-str-geom-status')).toContainText('STEP dosyası değil', { timeout: 10000 });
    // Ve geometri kurulmadı
    expect(await page.evaluate(() => Object.keys(window.veStrGeometryCache || {}).length)).toBe(0);
  });
});
