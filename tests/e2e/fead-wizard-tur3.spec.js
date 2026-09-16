/**
 * fead-wizard-tur3.spec.js — SİHİRBAZ, ÜÇÜNCÜ KULLANICI TURU (gerçek tarayıcı)
 *
 * Beş maddenin dördü YERLEŞİM ya da GERÇEK ETKİLEŞİM sorusu, yani Node'da
 * ölçülemiyor:
 *   1 · Yüklenen örnek kartının gerçekten belirgin çizilmesi (hesaplanmış
 *       gölge/kenarlık — sınıf adı değil).
 *   2 · Gergi satırının diğer satırlarla aynı hizada durması.
 *   4 · Aksesuar modeli seçilince sütun genişliklerinin OYNAMAMASI
 *       (ölçülen eski kayma: açılır liste 362 → 283 px).
 *   5 · Çevrim seçilince gövdenin kaydırma konumunu KORUMASI.
 */
const { test, expect } = require('@playwright/test');

async function bootApp(page) {
  await page.goto('/index.html');
  await page.evaluate(() => {
    if (window.MFSimLoader && typeof window.MFSimLoader.start === 'function') window.MFSimLoader.start();
  });
  await page.waitForFunction(() =>
    typeof window.createNode === 'function' &&
    typeof window.veFeadOpenEditor === 'function' &&
    typeof window.veFeadWizOpen === 'function' &&
    Array.isArray(window.nodes), null, { timeout: 60000 });
  await page.evaluate(() => {
    if (typeof veSelectModuleFromOverlay === 'function') veSelectModuleFromOverlay('arac-performans');
  });
  await page.waitForFunction(() => {
    const s = document.getElementById('mfsim-loading-screen');
    return !s || s.style.display === 'none';
  }, null, { timeout: 60000 });
}

async function sihirbaz(page){
  await bootApp(page);
  await page.evaluate(() => { const n = createNode('fead-analysis', 400, 300); veFeadOpenEditor(n.id); });
  await page.waitForFunction(() => Array.isArray(window.nodes) && window.nodes.length > 0, null, { timeout: 20000 });
  await page.evaluate(() => veFeadWizOpen(window.nodes.find(n => n.type === 'fead-wizard').id));
  await page.waitForSelector('#ve-feadwiz-overlay');
}

test('tur3 — seçili kart · gergi satırı · yön · tablo hizası · kaydırma', async ({ page }) => {
  const hata = [];
  page.on('pageerror', e => hata.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') hata.push(m.text()); });
  await sihirbaz(page);

  // ── 1 · HANGİ ÖRNEĞİN YÜKLENDİĞİ YÜZEYDEN OKUNUYOR ────────────────────
  //
  // Bu blok bir dönem GENİŞ KARTLARI ölçüyordu (`.ve-fw-btn-wide`: seçili
  // kartın gölgesi, işareti, farklı kenarlığı). Kartlar yerini bir açılır
  // listeye bıraktı ve o sınıfı basan JS kalmadı — sınıf yalnız CSS'te duruyor
  // ve `.first().click()` 30 sn zaman aşımına düşüyordu. Bu spec o gün
  // sessizce öldü.
  //
  // HÜKÜM DEĞİŞMEDİ: kullanıcı hangi örneğin yüklendiğini yüzeyden okuyabilmeli.
  // Değişen taşıyıcı: seçili `<option>` + onun yanındaki DURUM SATIRI. İkisi
  // ayrı ayrı gerekli — `<select>`in "seçili"si tek başına "yüklendi" demiyor
  // (liste bir öneri de olabilirdi), durum satırı o ayrımı taşıyor.
  const sec = page.locator('#ve-fw-body select[onchange*="veFeadWizSeedPick"]');
  await expect(sec).toHaveCount(1);
  expect(await page.locator('#ve-fw-body .ve-fw-seeded').count()).toBe(0);

  // GERÇEK SEÇİM ile örnek yükle — ilk gerçek örnek anahtarı listeden alınır.
  const anahtar = await sec.evaluate((el) => {
    const o = [...el.options].find((x) => x.value && x.value !== '__');
    return o ? o.value : null;
  });
  expect(anahtar).not.toBeNull();
  await sec.selectOption(anahtar);
  await page.waitForTimeout(400);

  const yuklendi = page.locator('#ve-fw-body .ve-fw-seeded');
  await expect(yuklendi).toHaveCount(1);
  const durumAd = (await yuklendi.locator('b').innerText()).trim();
  const secAd = await sec.evaluate((el) => el.options[el.selectedIndex].textContent);
  // DURUM SATIRI İLE LİSTE AYNI KAYDI GÖSTERİYOR — ikisi ayrışsaydı kullanıcı
  // bir örneği seçip başkasının yüklendiğini okurdu.
  expect(secAd).toContain(durumAd);
  expect(await page.evaluate(() => veFeadWizState().seededFrom)).toBe(anahtar);

  // ── 2 · GERGİ SATIRI DİĞERLERİYLE AYNI ─────────────────────────────────
  await page.evaluate(() => veFeadWizGoto(1));
  await page.waitForTimeout(300);
  const satir = await page.evaluate(() => {
    const tbl = document.querySelector('.ve-fw-tbl');
    const ten = tbl.querySelector('tr.ve-fw-tr-ten');
    const ilk = tbl.querySelector('tbody tr');
    const x = (tr) => [...tr.children].map(e => Math.round(e.getBoundingClientRect().left));
    return {
      hiza: x(ten).length === x(ilk).length && x(ten).every((v, i) => Math.abs(v - x(ilk)[i]) <= 1),
      tipMetni: ten.children[1].innerText.trim(),
      // DÖRDÜNCÜ tur: hücre tek seçenekli bir <select> — diğer satırlarla aynı
      // biçim. Kilit görünümle değil SEÇENEK KÜMESİYLE kuruluyor.
      tipSelect: !!ten.children[1].querySelector('select'),
      tipSecenek: ten.children[1].querySelectorAll('option').length,
      cip: !!ten.querySelector('.ve-fw-tag'),
      yukseklikFarki: Math.abs(Math.round(ten.getBoundingClientRect().height
                              - ilk.getBoundingClientRect().height)),
      xIpucu: (ten.children[4].querySelector('input') || {}).title || ''
    };
  });
  console.log('SATIR', JSON.stringify(satir));
  expect(satir.hiza).toBe(true);
  expect(satir.tipMetni).toBe('Otomatik Gergi');
  expect(satir.tipSelect).toBe(true);
  expect(satir.tipSecenek).toBe(1);
  expect(satir.cip).toBe(false);
  expect(satir.yukseklikFarki).toBeLessThanOrEqual(2);   // satır artık şişmiyor
  expect(satir.xIpucu).toMatch(/montaj noktas/);

  // ── 3 · KAYIŞ YOLU'NDA CCW/CW YOK ──────────────────────────────────────
  await page.evaluate(() => veFeadWizGoto(1));
  await page.waitForTimeout(300);
  const yol = await page.evaluate(() => ({
    spin: document.querySelectorAll('.ve-fw-spin').length,
    cevir: !!document.querySelector('button[onclick*="veFeadWizRouteReverse"]'),
    seritYon: (document.querySelector('.ve-fw-live') || {}).innerText || ''
  }));
  console.log('YOL', JSON.stringify(yol));
  expect(yol.spin).toBe(0);
  expect(yol.cevir).toBe(true);
  expect(yol.seritYon).toMatch(/CCW|CW/);   // yön okuması KAYBOLMADI

  // ── 4 · AKSESUAR TABLOSU SEÇİMLE KAYMIYOR ──────────────────────────────
  await page.evaluate(() => veFeadWizGoto(4));
  await page.waitForTimeout(400);
  const sutun = () => page.evaluate(() => {
    const t = document.querySelector('.ve-fw-tbl-fixed');
    return { th: [...t.querySelectorAll('thead th')].map(e => Math.round(e.getBoundingClientRect().width)),
             sel: [...t.querySelectorAll('select')].map(e => Math.round(e.getBoundingClientRect().width)) };
  });
  const s0 = await sutun();
  // TEK YAZICI (2026-09-01): iki katalog tek seçicide birleşti.
  const sel = page.locator('select[onchange*="veFeadWizAccModel"]').first();
  const opts = await sel.evaluate(e => [...e.options].map(o => o.value));
  await sel.selectOption(opts[opts.length - 1]);
  await page.waitForTimeout(400);
  const s1 = await sutun();
  console.log('SÜTUN önce', JSON.stringify(s0), 'sonra', JSON.stringify(s1));
  expect(s1.th).toEqual(s0.th);       // başlık genişlikleri BİREBİR
  expect(s1.sel).toEqual(s0.sel);     // açılır liste OYNAMIYOR (eski: 362 → 283)

  // ── 5 · ÇEVRİM SEÇİNCE KAYDIRMA KORUNUYOR ──────────────────────────────
  const y0 = await page.evaluate(() => {
    const b = document.getElementById('ve-fw-body');
    b.scrollTop = Math.round((b.scrollHeight - b.clientHeight) * 0.6);
    return b.scrollTop;
  });
  expect(y0).toBeGreaterThan(50);
  await page.locator('select[onchange*="veFeadWizDutyLib"]').first().selectOption('AG00902-4');
  await page.waitForTimeout(400);
  const y1 = await page.evaluate(() => document.getElementById('ve-fw-body').scrollTop);
  console.log('KAYDIRMA', y0, '→', y1);
  expect(Math.abs(y1 - y0)).toBeLessThanOrEqual(1);

  // adım değişimi SIFIRLAR
  await page.evaluate(() => veFeadWizGoto(1));
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => document.getElementById('ve-fw-body').scrollTop)).toBe(0);

  expect(hata.filter(h => !/favicon|manifest|version\.json|Failed to load resource/i.test(h))).toEqual([]);
});
