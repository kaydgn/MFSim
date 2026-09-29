/**
 * fead-sihirbaz-masa.spec.js — SİHİRBAZIN ÇİZİM MASASI, gerçek tarayıcı
 *
 * Kullanıcı bildirimi (2026-09-29), üç madde:
 *   1 · *"ortadaki … kanvas çok dar olmuş … Başlangıç sihirbazı penceresini
 *       genişletelim … kanvas hareket etmiyor. Yakınlaştırma-uzaklaştırma sağa
 *       sola pan … Tutup hareket etmeyi de kaldıralım."*
 *   2 · (Node'da: "Sıra ve yön" bloğu kalktı — fead-wizard.test.js.)
 *   3 · *"'Tahrik' kısmı çalışmıyor … ne değer girersek girelim, tahrik oranı
 *       hep 1"* + *"ortadaki iki kocaman diyagram çok gereksiz"*.
 *
 * Bu halkalar Node'da koşamaz: jsdom yerleşim ölçmez (pencere eni), gerçek
 * fare olayı üretmez (tekerlek, sürükleme eşiği) ve yazı kutusu (getBBox)
 * hesaplamaz.
 */
const { test, expect } = require('@playwright/test');

async function sihirbaz(page, ornek, adim){
  await page.goto('/index.html');
  await page.evaluate(() => {
    if (window.MFSimLoader && typeof window.MFSimLoader.start === 'function') window.MFSimLoader.start();
  });
  await page.waitForFunction(() => typeof window.veStartModule === 'function'
    && typeof window.veFeadWizOpen === 'function', null, { timeout: 60000 });
  await page.waitForFunction(() => {
    const s = document.getElementById('mfsim-loading-screen');
    return !s || s.style.display === 'none';
  }, null, { timeout: 60000 });
  await page.evaluate(() => veStartModule('fead-analysis'));
  await page.waitForTimeout(800);
  await page.evaluate(([o, a]) => { veFeadWizOpenAny(); veFeadWizSeed(o); veFeadWizGoto(a); }, [ornek, adim]);
  await page.waitForTimeout(500);
}

// ── 1 · PENCERE GENİŞ, MASA BÜYÜK ─────────────────────────────────────────
// Ölçülen önce: 1440×900'de pencere 1180 px, Kasnaklar masası 582 px.
test('PENCERE GENİŞ: 1440×900\'de pencere ≥ 1380 px, masa ≥ 780 px; ray ve sütun aynı', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await sihirbaz(page, 'AG00976_GATES_2025', 1);
  const r = await page.evaluate(() => {
    const w = (s) => Math.round(document.querySelector(s).getBoundingClientRect().width);
    return { modal: w('#ve-feadwiz-overlay .ve-fw-modal'), masa: w('#ve-fw-masa'), ray: w('#ve-fw-nav'), yan: w('#ve-fw-yan'),
             yatay: document.getElementById('ve-fw-body').scrollWidth - document.getElementById('ve-fw-body').clientWidth };
  });
  console.log('PENCERE', JSON.stringify(r));
  expect(r.modal).toBeGreaterThanOrEqual(1380);
  expect(r.masa).toBeGreaterThanOrEqual(780);
  expect(r.ray).toBe(238);
  expect(r.yan).toBe(316);
  expect(r.yatay).toBe(0);
});

// ── 1 · MASA BİR GÖRÜNTÜLEYİCİ ────────────────────────────────────────────
test('GEZİNME gerçek fareyle: tekerlek imleçteki mm\'yi tutar, sürükleme kaydırır, kasnak TAŞINMAZ, tık seçer', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await sihirbaz(page, 'AG00976_GATES_2025', 1);
  const koord = () => page.evaluate(() => JSON.stringify(veFeadWizState().pulleys.map((p) => [p.x, p.y])
    .concat([[veFeadWizState().ten.cenX, veFeadWizState().ten.cenY]])));
  const k0 = await koord();
  const m = await page.locator('#ve-fw-masa-cizim').boundingBox();
  const px = m.x + m.width * 0.45, py = m.y + m.height * 0.55;
  // Yakınlaşmanın merkezi İMLEÇ: her isabet halkasının imlece uzaklığı aynı
  // oranda büyümeli (imleçteki mm yerinde kalıyorsa tam olarak böyle olur).
  const halka = () => page.evaluate(() => [...document.querySelectorAll('#ve-fw-masa .ve-fw-hit')].map((c) => {
    const r = c.getBoundingClientRect(); return { k: c.getAttribute('data-fw-k'), x: r.x + r.width / 2, y: r.y + r.height / 2, r: r.width / 2 };
  }));
  const h0 = await halka();
  await page.mouse.move(px, py);
  await page.mouse.wheel(0, -500);
  await page.waitForTimeout(250);
  const h1 = await halka();
  // Yakınlaşma imleç merkezli: her halkanın imlece uzaklığı AYNI oranda büyür.
  const oranlar = h0.map((a, i) => Math.hypot(h1[i].x - px, h1[i].y - py) / Math.hypot(a.x - px, a.y - py));
  console.log('TEKER', oranlar.map((x) => x.toFixed(3)).join(' '));
  oranlar.forEach((o) => expect(Math.abs(o - oranlar[0])).toBeLessThan(0.02));
  expect(oranlar[0]).toBeGreaterThan(1.3);
  // Sürükle: kasnağın ÜSTÜNDEN başla — görünüm kayar, kasnak yerinde kalır.
  const a = h1[0];
  await page.mouse.move(a.x, a.y); await page.mouse.down();
  for (let i = 1; i <= 8; i++) { await page.mouse.move(a.x + i * 10, a.y + i * 5); await page.waitForTimeout(16); }
  await page.mouse.up(); await page.waitForTimeout(250);
  const h2 = await halka();
  expect(h2[0].x - h1[0].x).toBeCloseTo(80, 0);
  expect(h2[0].y - h1[0].y).toBeCloseTo(40, 0);
  expect(await koord()).toBe(k0);                     // HİÇBİR koordinat değişmedi
  // Sığdır → tık: masanın içindeki her halka kendi kasnağını seçer.
  await page.locator('.ve-fw-masa-gezin button[title="Sığdır"]').click();
  await page.waitForTimeout(250);
  const mr = await page.locator('#ve-fw-masa').boundingBox();
  const ic = (await halka()).filter((q) => q.x > mr.x + 20 && q.x < mr.x + mr.width - 60 && q.y > mr.y + 50 && q.y < mr.y + mr.height - 50);
  expect(ic.length).toBeGreaterThanOrEqual(3);
  for (const q of ic) {
    await page.mouse.click(q.x, q.y); await page.waitForTimeout(200);
    expect(await page.evaluate(() => document.querySelector('#ve-fw-ed').getAttribute('data-fw-k'))).toBe(q.k);
  }
  expect(await koord()).toBe(k0);
});

// ── 3 · TAHRİK ORANI YAZARKEN GÜNCELLENİR ──────────────────────────────────
// Ölçülen önce (AG00686, gerçek klavye): 179,62 yazıldığında model 0,8685 ile
// çözüyordu, kart "1,0000 · elle girildi" diyordu.
test('TAHRİK: ara kademe + gerçek klavye — ekran oranı modelin oranı, eksik çap "çözülemedi"', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await sihirbaz(page, 'AG00686_1475_GATES_2023', 4);
  const kart = page.locator('#ve-fw-yan .ve-fw-card').filter({ hasText: /^Tahrik/ });
  const oku = () => page.evaluate(() => {
    const r = [...document.querySelectorAll('#ve-fw-tahrik-oku .ve-fw-read')];
    const al = (ad) => { const x = r.find((q) => q.textContent.trim().startsWith(ad)); return x ? x.querySelector('b').textContent.trim() : null; };
    return { oran: al('Tahrik oranı'), kaynak: al('Kaynak'), model: veFeadWizBuild().drive };
  });
  expect((await oku()).kaynak).toMatch(/krank kasnağı doğrudan/);   // örnek: elle oran DEĞİL
  await kart.locator('select').selectOption('derive');
  await page.waitForTimeout(300);
  let r = await oku();
  expect(r.oran).toBe('—');
  expect(r.kaynak).toMatch(/çözülemedi/);
  await kart.locator('input').nth(0).click();
  await page.keyboard.type('156');
  await kart.locator('input').nth(1).click();
  await page.keyboard.type('179,62');
  await page.waitForTimeout(500);                     // canlı yama (220 ms)
  r = await oku();
  console.log('TAHRİK', JSON.stringify(r));
  expect(r.model.ok).toBe(true);
  expect(r.oran).toBe(await page.evaluate(() => veSayi(156 / 179.62, 4)));
  expect(r.kaynak).toMatch(/çaplardan türetildi/);
});

// ── 2 · STEP SIRASININ ONAYI LİSTE KARTINDA, TEK SATIR ─────────────────────
// Ölçülen önce: `> span { flex:1 }` ikonun span'ini de yakalıyordu — ikon 84 px,
// metin 84 px'e sıkışıp üç satıra kırılıyor, satır 52 px.
test('STEP ONAYI: "Kasnaklar — kayış sırasıyla" kartında tek satır; metin ikondan geniş', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await sihirbaz(page, 'AG00976_GATES_2025', 1);
  await page.evaluate(() => { veFeadWizState().siraKaynagi = 'agac'; veFeadWizGoto(1); });
  await page.waitForTimeout(300);
  const r = await page.evaluate(() => {
    const row = document.querySelector('.ve-fw-kl-onay');
    const h = (e) => Math.round(e.getBoundingClientRect().height), w = (e) => Math.round(e.getBoundingClientRect().width);
    const y = row.querySelector('.ve-fw-kl-onay-y'), ik = row.querySelector('.mf-ico');
    return { satir: h(row), dugme: h(row.querySelector('button')), metin: w(y), ikon: w(ik), metinH: h(y),
             kartta: !!row.closest('.ve-fw-card').querySelector('#ve-fw-kl-liste') };
  });
  console.log('ONAY', JSON.stringify(r));
  expect(r.kartta).toBe(true);
  expect(r.ikon).toBeLessThanOrEqual(16);
  expect(r.metin).toBeGreaterThan(r.ikon * 4);
  expect(r.metinH).toBeLessThan(r.dugme);            // metin tek satır (düğmeden alçak)
  expect(r.satir).toBeLessThanOrEqual(r.dugme + 12);  // satır = düğme + dolgu
});

// ── 3 · YENİ DİYAGRAMLAR ÇAKIŞMASIZ ────────────────────────────────────────
// Bütün örnekler, iki ekran: sınır yazıları (eksen içi · sağ uç · kritik) aynı
// satırda yarışıyor ve bir kez çakıştı (AG00894, uç yazısı üst çizgideyken).
for (const [W, H] of [[1440, 900], [1366, 768]]) test('5. ADIM ' + W + ': tahrik zinciri + devir pencereleri — yazı kutuları çakışmıyor, taşmıyor (bütün örnekler)', async ({ page }) => {
  await page.setViewportSize({ width: W, height: H });
  await sihirbaz(page, 'AG00976_GATES_2025', 4);
  const kusur = [];
  const ornekler = await page.evaluate(() => veFeadExampleKeysAll());
  expect(ornekler.length).toBeGreaterThanOrEqual(12);
  for (const o of ornekler) {
    await page.evaluate((o) => { veFeadWizSeed(o); veFeadWizGoto(4); }, o);
    await page.waitForTimeout(400);
    const r = await page.evaluate(() => {
      const out = [];
      const svgs = [...document.querySelectorAll('#ve-fw-masa svg')];
      if (svgs.length !== 2) out.push('svg sayısı ' + svgs.length);
      svgs.forEach((svg) => {
        const sr = svg.getBoundingClientRect();
        const k = [...svg.querySelectorAll('text')].map((t) => { const q = t.getBoundingClientRect(); return { t: t.textContent, x: q.x, y: q.y, w: q.width, h: q.height }; })
          .filter((q) => q.w > 0);
        k.forEach((a, i) => {
          if (a.x < sr.x - 1 || a.x + a.w > sr.right + 1 || a.y < sr.y - 1 || a.y + a.h > sr.bottom + 1) out.push('taşıyor: ' + a.t);
          for (let j = i + 1; j < k.length; j++) {
            const c = k[j];
            const ox = Math.min(a.x + a.w, c.x + c.w) - Math.max(a.x, c.x), oy = Math.min(a.y + a.h, c.y + c.h) - Math.max(a.y, c.y);
            if (ox > 1 && oy > 1) out.push(a.t + ' ⟂ ' + c.t);
          }
        });
      });
      const masa = document.getElementById('ve-fw-masa').getBoundingClientRect();
      [...document.querySelectorAll('#ve-fw-masa .ve-fw-graf')].forEach((g) => {
        if (g.getBoundingClientRect().bottom > masa.bottom + 1) out.push('kutu masadan taşıyor');
      });
      return out;
    });
    r.forEach((x) => kusur.push(o + ': ' + x));
  }
  console.log('DİYAGRAM kusur', kusur.length, kusur.slice(0, 6).join(' | '));
  expect(kusur).toEqual([]);
});
