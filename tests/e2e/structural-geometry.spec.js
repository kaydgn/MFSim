/**
 * structural-geometry.spec.js — YAPISAL ANALİZ / Geometri: STEP içe aktarma
 *
 * GERÇEK TARAYICI kapısı. Birim testler köprüyü (js/structural-model.js) Node
 * altında sınıyor; buradaki soru başka: ZİNCİR uçtan uca ayakta mı?
 *
 *   gömülü .wasm varlığı → worker'da gunzip + OCCT derlemesi → panel →
 *   THREE sahnesi → CAD yüzü vurgusu
 *
 * Bu zincirin halkaları Node'da HİÇ koşmuyor: talep üzerine çalıştırılan gömülü
 * varlık, Blob worker, `DecompressionStream`, WebGL bağlamı ve fare ile yüz
 * seçimi. Biri kırılırsa panel yine açılır, düğme yine görünür — ve basınca
 * hiçbir şey olmaz. Sessiz kırılma tam olarak burada yakalanır.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

const CUBE = path.join(__dirname, '../fixtures/step/cube-mm.step');
const ROUNDED = path.join(__dirname, '../fixtures/step/rounded-cube.step');
const ASSEMBLY = path.join(__dirname, '../fixtures/step/as1-tu-203.stp');

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

    // İlk içe aktarma: gömülü okuyucu bir kez açılıp derleniyor → cömert süre
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
    // Okuyucu UYGULAMANIN İÇİNDEN geldi — ağdan değil. Çevrimdışı kapısı
    // tests/e2e/published.spec.js'te (dağıtılan tek dosya, ağ kesik).
    expect(g.wasm).toBe('(gömülü)');

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

  // ── ASIL KAPI: ARAYÜZ DONMUYOR ──────────────────────────────────────────
  // STEP çözümlemesi worker'a taşındı. Ölçüt "hızlı mı" değil — toplam süre
  // zaten benzer; ölçüt ARAYÜZÜN YAŞIYOR OLMASI. Bunu tek dürüst biçimde
  // ölçmenin yolu içe aktarma boyunca ÇİZİLEN KARE SAYISI.
  //
  // ÖLÇÜLDÜ (as1-tu-203.stp, linearDeflection 0.000004 → 45 240 üçgen):
  //   ana iş parçacığı : 1665 ms —  1 kare  (tam donma)
  //   worker           : 1497 ms — 91 kare  (en uzun boşluk 19 ms)
  //
  // Okuyucu ÖNCE ISITILIYOR: yoksa ölçüm 7,3 MB indirmeyi ve WASM derlemesini
  // de sayar, oysa sorulan soru ÇÖZÜMLEMENİN ana iş parçacığını kilitleyip
  // kilitlemediği.
  test('içe aktarma sırasında arayüz YAŞIYOR — worker ana iş parçacığını kilitlemiyor', async ({ page }) => {
    await bootApp(page);

    const olc = async (noWorker) => page.evaluate(async (nw) => {
      const bytes = new Uint8Array(await (await fetch('/tests/fixtures/step/as1-tu-203.stp')).arrayBuffer());
      const opt = { noWorker: nw, onProgress: function(){} };
      const meta = (d) => ({ fileName: 'as1.stp', fileSize: bytes.length,
        deflection: { type: 'bounding_box_ratio', linear: d, angular: 0.5 } });
      // ISIT: okuyucu önbelleğe girsin (kaba ağ, hızlı).
      await veStrImportStep(bytes, meta(0.01), opt);

      let frames = 0, running = true;
      (function tick(){ if(!running) return; frames++; requestAnimationFrame(tick); })();
      const t0 = performance.now();
      const g = await veStrImportStep(bytes, meta(0.000004), opt);
      const ms = performance.now() - t0;
      running = false;
      return { ok: g.ok, worker: g.worker, tri: g.stats && g.stats.triCount, ms: Math.round(ms), frames };
    }, noWorker);

    const ana = await olc(true);
    await page.evaluate(() => veStrOcctForget());
    const wrk = await olc(false);

    // İkisi de AYNI geometriyi üretmeli — yoksa kare sayısı kıyaslanamaz.
    expect(ana.ok).toBe(true);
    expect(wrk.ok).toBe(true);
    expect(wrk.tri).toBe(ana.tri);
    expect(wrk.tri).toBeGreaterThan(20000);      // ölçüm anlamlı olacak kadar büyük
    expect(ana.worker).toBe(false);
    expect(wrk.worker).toBe(true);

    // Ana iş parçacığı yolu DONUYOR: saniyelerce süren işte birkaç kare.
    expect(ana.frames).toBeLessThanOrEqual(3);
    // Worker yolu AKIYOR: en az 20 kare (ölçümde 91 idi; eşik cömert tutuldu
    // ki yavaş bir CI makinesinde kırılgan olmasın).
    expect(wrk.frames).toBeGreaterThan(20);
    // Ve worker toplam süreyi kötüleştirmiyor (transfer kopyayı da eliyor).
    expect(wrk.ms).toBeLessThan(ana.ms * 2);
  });

  test('gerçek panelde içe aktarma worker\'da koşuyor ve ilerleme bildiriliyor', async ({ page }) => {
    await bootApp(page);
    await openGeometryPanel(page);

    // İlerleme kartını yakalamak için hızlı yokla — ilk içe aktarmada 7,3 MB
    // iniyor, kart birkaç yüz ms görünür.
    const kareler = [];
    const poll = setInterval(async () => {
      try {
        const s = await page.evaluate(() => {
          const p = document.querySelector('.ve-str-prog');
          if (!p) return null;
          return { stage: p.querySelector('[data-ve="stage"]').textContent,
                   detail: p.querySelector('[data-ve="detail"]').textContent,
                   indet: p.querySelector('[data-ve="fill"]').className === 'indet' };
        });
        if (s) kareler.push(s);
      } catch (e) { /* sayfa gezinirken yoklama düşebilir */ }
    }, 25);

    await page.locator('#ve-str-geom-file').setInputFiles(ASSEMBLY);
    await page.waitForFunction(
      () => window.veStrGeometryCache && Object.keys(window.veStrGeometryCache).length > 0,
      null, { timeout: 120000 }
    );
    clearInterval(poll);

    const g = await page.evaluate(() => {
      const k = Object.keys(window.veStrGeometryCache)[0];
      return window.veStrGeometryCache[k];
    });
    expect(g.worker).toBe(true);                 // panel gerçekten worker'a gidiyor
    expect(g.stats.faceCount).toBe(160);         // montaj: 160 CAD yüzü

    // İlerleme kartı GERÇEKTEN göründü ve aşama adı değişti (donmuş tek bir
    // etiket değil, akan bir anlatı).
    expect(kareler.length).toBeGreaterThan(0);
    const asamalar = Array.from(new Set(kareler.map((k) => k.stage)));
    expect(asamalar.length).toBeGreaterThan(1);
    expect(asamalar.join('|')).toMatch(/indiriliyor|hazırlanıyor|çözümleniyor/);

    // İndirme aşamasında BELİRLİ yüzde var (bayt sayılıyor); çözümlemede YOK
    // (uydurma yüzde göstermiyoruz).
    const indirme = kareler.filter((k) => /indiriliyor/.test(k.stage) && k.detail);
    if (indirme.length) expect(indirme.some((k) => !k.indet)).toBe(true);
    const cozum = kareler.filter((k) => /çözümleniyor/.test(k.stage));
    if (cozum.length) expect(cozum.every((k) => k.indet)).toBe(true);

    // Kart iş bitince KAPANIYOR — ekranda asılı kalmıyor.
    await expect(page.locator('.ve-str-prog')).toHaveCount(0);
    await expect(page.locator('#ve-str-geom-status')).toContainText('İçe aktarıldı');
  });

  // ── OKUYUCU BİR KEZ HAZIRLANIR ─────────────────────────────────────────
  // .wasm artık uygulamanın İÇİNDE (js/structural-occt-wasm.js, gzip+base64) →
  // ikinci içe aktarma HİÇ ağ isteği çıkarmaz. Bu, hem "her içe aktarmada 7 MB
  // inmiyor" hem de "okuyucu yeniden derlenmiyor" demek.
  //
  // ÇEVRİMDIŞI kapısı BURADA DEĞİL: bu spec index.html'i (modüler kurulum)
  // açıyor ve orada varlık AYRI bir dosyadır, yani ilk kullanımda doğal olarak
  // ağdan gelir. Çevrimdışı garantisi DAĞITILAN TEK DOSYANIN özelliğidir ve
  // kapısı tests/e2e/published.spec.js'te — ürünün kendisi orada açılıyor.
  test('okuyucu bir kez hazırlanır — ikinci içe aktarma AĞ İSTEĞİ ÇIKARMIYOR', async ({ page }) => {
    await bootApp(page);
    await openGeometryPanel(page);

    // 1. içe aktarma: okuyucu hazırlanır.
    await page.locator('#ve-str-geom-file').setInputFiles(ROUNDED);
    await page.waitForFunction(
      () => window.veStrGeometryCache && Object.keys(window.veStrGeometryCache).length > 0,
      null, { timeout: 120000 }
    );
    const ilk = await page.evaluate(() => {
      const k = Object.keys(window.veStrGeometryCache)[0];
      return window.veStrGeometryCache[k].wasmUrl;
    });
    expect(ilk).toBe('(gömülü)');            // ağdan indirilen bir .wasm YOK

    // 2. içe aktarma: buradan sonra çıkan her GERÇEK istek bir gerilemedir.
    const istekler = [];
    page.on('request', (r) => istekler.push(r.url()));
    await page.locator('#ve-str-geom-file').setInputFiles(CUBE);
    await page.waitForFunction(
      () => {
        const k = Object.keys(window.veStrGeometryCache)[0];
        return window.veStrGeometryCache[k].fileName === 'cube-mm.step';
      }, null, { timeout: 60000 }
    );
    const r = await page.evaluate(() => {
      const k = Object.keys(window.veStrGeometryCache)[0];
      const x = window.veStrGeometryCache[k];
      return { wasm: x.wasmUrl, tri: x.stats.triCount };
    });
    expect(r.wasm).toBe('(gömülü)');
    expect(r.tri).toBe(12);

    // blob: worker URL'i ağ değildir; onun dışında hiçbir şey çıkmamalı.
    expect(istekler.filter((u) => !/^blob:/.test(u))).toEqual([]);
  });

  // ── KANVAS ROZETİ ───────────────────────────────────────────────────────
  // Zincirin ilk halkası boşsa gerisi de boştur; ama Geometri kutusu kanvasta
  // dolu ile boş arasında hiç fark göstermiyordu — kullanıcı panelini açmadan
  // bilemiyordu.
  test('kanvas rozeti parçanın yüklü olup olmadığını söylüyor', async ({ page }) => {
    await bootApp(page);
    await openGeometryPanel(page);

    const rozet = () => page.evaluate(() => {
      const n = nodes.find((x) => x.type === 'str-geometry');
      const b = document.getElementById(n.id).querySelector('.ve-str-badge');
      return b ? { metin: b.textContent, baslik: b.title } : null;
    });

    const bos = await rozet();
    expect(bos).not.toBeNull();                     // boşken de rozet VAR:
    expect(bos.metin).toBe('STEP');                 // "rozet yok" ile "parça yok" ayırt edilemezdi
    expect(bos.baslik).toMatch(/içe aktarılmadı/);

    await page.locator('#ve-str-geom-file').setInputFiles(ASSEMBLY);
    await page.waitForFunction(
      () => window.veStrGeometryCache && Object.keys(window.veStrGeometryCache).length > 0,
      null, { timeout: 120000 }
    );
    const dolu = await rozet();
    expect(dolu.metin).toBe('⬡160');                // CAD yüz sayısı — BC'nin bağlanacağı sayı
    expect(dolu.baslik).toContain('as1-tu-203.stp');
    expect(dolu.baslik).toContain('CAD yüzü');
  });

  // ── CAD YÜZ LİSTESİ — Sınır Koşullarının hazırlığı ──────────────────────
  // Liste ve 3B TEK bir seçimi paylaşıyor. İki ayrı seçim tutulsaydı kullanıcı
  // "hangi yüzü seçtim" sorusuna iki farklı cevap görürdü.
  test('yüz listesi ile 3B görünüm TEK seçimi paylaşıyor', async ({ page }) => {
    await bootApp(page);
    await openGeometryPanel(page);
    await page.locator('#ve-str-geom-file').setInputFiles(ASSEMBLY);
    await page.waitForFunction(
      () => window.veStrGeometryCache && Object.keys(window.veStrGeometryCache).length > 0,
      null, { timeout: 120000 }
    );
    await expect(page.locator('#ve-str-geom-canvas')).toBeVisible();

    // Liste, künyedeki her CAD yüzü için bir satır taşıyor
    await expect(page.locator('#ve-str-face-list .ve-str-face')).toHaveCount(160);

    // LİSTEDEN TIK → 3B'de seçilir
    await page.locator('.ve-str-face[data-face="m3/f5"]').click();
    let d = await page.evaluate(() => ({
      viewer: (veStrViewerSelectedFace() || {}).id || null,
      sel3B: !!(window._veStrViewer && window._veStrViewer.sel),
      satir: (document.querySelector('.ve-str-face.on') || {}).dataset?.face || null,
    }));
    expect(d.viewer).toBe('m3/f5');
    expect(d.sel3B).toBe(true);                      // parçada gerçekten bir vurgu var
    expect(d.satir).toBe('m3/f5');
    await expect(page.locator('#ve-str-face-sel')).toContainText('m3/f5');

    // AYNI satıra ikinci tık → seçim KALKAR (seçimden çıkmanın başka yolu yok)
    await page.locator('.ve-str-face[data-face="m3/f5"]').click();
    d = await page.evaluate(() => ({
      viewer: (veStrViewerSelectedFace() || {}).id || null,
      satir: !!document.querySelector('.ve-str-face.on'),
    }));
    expect(d.viewer).toBeNull();
    expect(d.satir).toBe(false);

    // 3B'DE GEZİN → listede aynı satır işaretlenir.
    //
    // MERKEZ PİKSELE GÜVENİLMİYOR: montajda parçalar arasında boşluk var ve
    // kanvas ölçüsü görünüm penceresine göre değişiyor — merkez ıskalayabilir
    // (ölçüldü: 1600×1000'de isabet, 1280×720'de ıska). Parçaya isabet eden
    // bir nokta ARANIYOR; testin konusu "merkez tutar mı" değil, gezinme ile
    // listenin aynı yüzü göstermesi.
    const box = await page.locator('#ve-str-geom-canvas').boundingBox();
    let nokta = null;
    for (const [fx, fy] of [[0.5, 0.5], [0.45, 0.45], [0.55, 0.55], [0.4, 0.5],
                            [0.6, 0.5], [0.5, 0.4], [0.5, 0.6], [0.35, 0.6], [0.65, 0.4]]) {
      const x = box.x + box.width * fx, y = box.y + box.height * fy;
      await page.mouse.move(x, y, { steps: 4 });
      const vuruldu = await page.evaluate(
        () => !!(window._veStrViewer && window._veStrViewer.hoverFace));
      if (vuruldu) { nokta = { x, y }; break; }
    }
    expect(nokta).not.toBeNull();                    // parçaya hiç isabet edilemedi

    d = await page.evaluate(() => ({
      hover3B: window._veStrViewer.hoverFace.id,
      satir: (document.querySelector('.ve-str-face.hover') || {}).dataset?.face || null,
    }));
    expect(d.satir).toBe(d.hover3B);

    // 3B'DE TIKLA → listede seçilir
    await page.mouse.down();
    await page.mouse.up();
    d = await page.evaluate(() => ({
      viewer: (veStrViewerSelectedFace() || {}).id || null,
      satir: (document.querySelector('.ve-str-face.on') || {}).dataset?.face || null,
    }));
    expect(d.viewer).toBe(d.satir);
    expect(d.viewer).not.toBeNull();

    // DÖNDÜRME seçimi DEĞİŞTİRMEZ — eşik olmasaydı her döndürme sonunda
    // seçim kayardı ve kullanıcı sebebini anlayamazdı.
    const once = d.viewer;
    await page.mouse.move(nokta.x, nokta.y);
    await page.mouse.down();
    await page.mouse.move(nokta.x + 60, nokta.y + 40, { steps: 8 });
    await page.mouse.up();
    expect(await page.evaluate(() => (veStrViewerSelectedFace() || {}).id || null)).toBe(once);
  });

  // ── STEP KAYNAĞI node.data'DA DURMUYOR ──────────────────────────────────
  // ÖLÇÜLDÜ (140 KB'lık dosya): kaynak künyedeyken saveState 0,03 → 2,17 ms ve
  // 20 adımlık undo yığını 22 KB → 3,14 MB oluyordu; ayrıca otomatik
  // localStorage yedeği (kota ~5-10 MB) aynı yoldan geçiyor. Kaynak yalnız
  // proje DOSYASINA yazılır.
  test('kaynak yalnız proje DOSYASINA yazılıyor — künyeye ve yedeğe değil', async ({ page }) => {
    await bootApp(page);
    await openGeometryPanel(page);
    await page.locator('#ve-str-geom-file').setInputFiles(ASSEMBLY);
    await page.waitForFunction(
      () => window.veStrGeometryCache && Object.keys(window.veStrGeometryCache).length > 0,
      null, { timeout: 120000 }
    );
    await page.waitForTimeout(800);      // arka plandaki gzip bitsin

    const r = await page.evaluate(() => {
      const g = nodes.find((n) => n.type === 'str-geometry');
      const kunye = JSON.stringify(g.data.geometry);

      if (typeof veSaveActiveTabStateKeepView === 'function') veSaveActiveTabStateKeepView();
      const tabs = veTabs.map((t) => ({ id: t.id, name: t.name, state: veBuildCleanTabState(t.state) }));
      const dosyaOnce = JSON.stringify(tabs).length;
      const enjekte = veStrSrcAttach(tabs);
      const dosyaSonra = JSON.stringify(tabs).length;

      // Otomatik yedek yolu (js/settings.js ile AYNI çağrı)
      const yedek = JSON.stringify(veTabs.map((t) => veBuildCleanTabState(t.state, { stripResults: true })));
      return { kunyedeKaynak: /"source(Gz)?"/.test(kunye), kunyeBayt: kunye.length,
               enjekte: enjekte, dosyaArtisi: dosyaSonra - dosyaOnce,
               yedekteKaynak: /"source(Gz)?"/.test(yedek) };
    });

    expect(r.kunyedeKaynak).toBe(false);          // node.data HAFİF → undo yığını hafif
    expect(r.kunyeBayt).toBeLessThan(20000);
    expect(r.enjekte).toBe(1);                    // DOSYAYA enjekte edildi
    expect(r.dosyaArtisi).toBeGreaterThan(10000); // gerçekten yazıldı (gzip+base64)
    // BU KAPI GERÇEK BİR HATADAN DOĞDU: attach yerinde yazıyordu ve
    // veSanitizeNodesSubtopology değişiklik yoksa AYNI diziyi döndürdüğü için
    // kaynak canlı state'e, oradan da otomatik yedeğe sızıyordu.
    expect(r.yedekteKaynak).toBe(false);
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
