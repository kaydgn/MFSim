/**
 * fead-wizard-tur2.spec.js — SİHİRBAZ, İKİNCİ KULLANICI TURU (gerçek tarayıcı)
 *
 * Kullanıcı sekiz madde bildirdi (2026-08-31); buradaki beşi Node'da EKSİK
 * ölçülüyor, çünkü hepsinin kanıtı YERLEŞİM ya da GERÇEK ETKİLEŞİM:
 *
 *   1 · Gergi satırının TİP sütununda "Otomatik Gergi" yazması — ve sütun
 *       hizasının bozulmaması (kullanıcının "garip yapı" dediği kusur bir
 *       CSS `display` kaçağıydı; hizayı ancak tarayıcı ölçer).
 *   2 · Dönüş yönü düğmesine GERÇEK tık: sıranın çevrilmesi, yönün dönmesi ve
 *       kayış boyunun BİREBİR sabit kalması (cebirsel özdeşlik).
 *   4 · Künye seçilince alanların readonly OLMASI, "elle gir" seçilince
 *       kilidin açılıp DEĞERİN KORUNMASI — `readOnly` DOM özelliği.
 *   6 · Kayış adımında Künye/Malzeme/kip seçicisinin ekranda GÖRÜNMEMESİ.
 *   7 · Aksesuar modeli seçilince duty tablosundaki kW okumasının DEĞİŞMESİ,
 *       ve o tablonun başlık↔gövde hizasının tutması.
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

test('tur2 — gergi satırı · yön · kilit · kayış · kW', async ({ page }) => {
  const hata = [];
  page.on('pageerror', e => hata.push(String(e)));
  page.on('console', m => { if(m.type()==='error') hata.push(m.text()); });
  await sihirbaz(page);
  await page.evaluate(() => { veFeadWizSeed('AG00976_GATES_2025'); veFeadWizRender(); });
  await page.waitForTimeout(300);

  // ── 2. ADIM: gergi satırı + yön ──────────────────────────────────────
  await page.evaluate(() => veFeadWizGoto(1));
  await page.waitForTimeout(250);

  const satir = await page.evaluate(() => {
    const tr = document.querySelector('tr.ve-fw-tr-ten');
    const tip = tr.children[1];
    return {
      ad: (tip.querySelector('.ve-fw-tip-ten') || {}).textContent,
      // Künye seçicisi ÜÇÜNCÜ turda satırdan 4. adıma taşındı (kullanıcı
      // isteği: *"Otomatik gergi tipini 'otomatik gergi' kısmında seçeriz"*).
      kunye: !!tip.querySelector('select'),
      gorunen: tip.innerText.trim().split('\n')[0],
      surucu: tr.querySelector('input[type=radio]').disabled,
      sil: tr.querySelector('button.ve-fw-x').disabled,
      // sütun hizası: başlık ile hücre aynı x'te mi
      hiza: (() => {
        const tbl = tr.closest('table');
        const th = [...tbl.querySelectorAll('thead th')].map(e => Math.round(e.getBoundingClientRect().left));
        const td = [...tr.children].map(e => Math.round(e.getBoundingClientRect().left));
        return th.length === td.length && th.every((x, i) => Math.abs(x - td[i]) <= 1);
      })()
    };
  });
  console.log('SATIR', JSON.stringify(satir));
  expect(satir.ad).toBe('Otomatik Gergi');
  expect(satir.kunye).toBe(false);
  expect(satir.gorunen).toBe('Otomatik Gergi');
  expect(satir.surucu).toBe(true);
  expect(satir.sil).toBe(true);
  expect(satir.hiza).toBe(true);

  const yon0 = await page.evaluate(() => {
    const b = document.querySelectorAll('.ve-fw-spin');
    return { adet: b.length, secili: [...b].map(x => x.classList.contains('ve-fw-spin-on')),
             metin: [...b].map(x => x.textContent.trim()),
             spin: veFeadWizBuild().spin, L: veFeadWizBuild().beltLengthMm };
  });
  console.log('YÖN0', JSON.stringify(yon0));
  expect(yon0.adet).toBe(2);
  expect(yon0.secili.filter(Boolean).length).toBe(1);

  // GERÇEK TIK ile ters yön
  await page.click('.ve-fw-spin:not(.ve-fw-spin-on)');
  await page.waitForTimeout(350);
  const yon1 = await page.evaluate(() => {
    const b = veFeadWizBuild();
    return { spin: b.spin, L: b.beltLengthMm,
             secili: [...document.querySelectorAll('.ve-fw-spin')].map(x => x.classList.contains('ve-fw-spin-on')) };
  });
  console.log('YÖN1', JSON.stringify(yon1));
  expect(yon1.spin).toBe(-yon0.spin);
  expect(Math.abs(yon1.L - yon0.L)).toBeLessThan(1e-6);   // GEOMETRİ DEĞİŞMEZ
  expect(yon1.secili).not.toEqual(yon0.secili);
  // geri
  await page.click('.ve-fw-spin:not(.ve-fw-spin-on)');
  await page.waitForTimeout(350);
  expect(await page.evaluate(() => veFeadWizBuild().spin)).toBe(yon0.spin);

  // ── 4. ADIM: künye kilidi ────────────────────────────────────────────
  await page.evaluate(() => veFeadWizGoto(3));
  await page.waitForTimeout(250);
  // Künye seçicisi ARTIK YALNIZ BURADA — satırdan kalktı.
  expect(await page.locator('select[onchange*="veFeadWizTenLib"]').count()).toBe(1);
  const acik = await page.evaluate(() => ({
    ro: [...document.querySelectorAll('.ve-fw-inp')].filter(e => e.readOnly).length,
    kilit: document.querySelectorAll('.ve-fw-lock').length
  }));
  await page.selectOption('select[onchange*="veFeadWizTenLib"]', 'AG00879');
  await page.waitForTimeout(350);
  const kilitli = await page.evaluate(() => {
    const g = (yol) => [...document.querySelectorAll('input')].find(e => (e.getAttribute('oninput')||'').includes(yol));
    return {
      kilit: document.querySelectorAll('.ve-fw-lock').length,
      armLen: { v: g('ten.armLen').value, ro: g('ten.armLen').readOnly },
      pivotX: { v: g('ten.pivotX').value, ro: g('ten.pivotX').readOnly }
    };
  });
  console.log('KİLİT açık:', JSON.stringify(acik), 'sonra:', JSON.stringify(kilitli));
  expect(acik.kilit).toBe(0);
  expect(kilitli.kilit).toBeGreaterThan(4);
  expect(kilitli.armLen.v).toBe('56');
  expect(kilitli.armLen.ro).toBe(true);
  expect(kilitli.pivotX.ro).toBe(false);      // montaj konumu motorun verisi

  // "elle gir" → kilit açılır, DEĞER KORUNUR
  await page.selectOption('select[onchange*="veFeadWizTenLib"]', '');
  await page.waitForTimeout(350);
  const elle = await page.evaluate(() => {
    const g = (yol) => [...document.querySelectorAll('input')].find(e => (e.getAttribute('oninput')||'').includes(yol));
    return { kilit: document.querySelectorAll('.ve-fw-lock').length,
             armLen: g('ten.armLen').value, ro: g('ten.armLen').readOnly };
  });
  console.log('ELLE GİR', JSON.stringify(elle));
  expect(elle.kilit).toBe(0);
  expect(elle.armLen).toBe('56');             // önceki künyenin değeri KORUNDU
  expect(elle.ro).toBe(false);

  // ── 5. ADIM: kayış ───────────────────────────────────────────────────
  await page.evaluate(() => veFeadWizGoto(4));
  await page.waitForTimeout(250);
  const kayis = await page.evaluate(() => {
    const g = document.getElementById('ve-fw-body').innerText;
    return { profil: /Profil ve Marka/.test(g), kunye: /\bKünye\b/.test(g),
             malzeme: /\bMalzeme\b/.test(g), kip: /sabitleriyle hesapla/.test(g),
             boy: /Gereken boy/.test(g), kapali: /KAPALI/.test(g) };
  });
  console.log('KAYIŞ', JSON.stringify(kayis));
  expect(kayis.profil).toBe(true);
  expect(kayis.kunye).toBe(false);
  expect(kayis.malzeme).toBe(false);
  expect(kayis.kip).toBe(false);
  expect(kayis.boy).toBe(true);
  expect(kayis.kapali).toBe(true);

  // ── 6. ADIM: aksesuar modeli → kW hücreleri ──────────────────────────
  await page.evaluate(() => veFeadWizGoto(5));
  await page.waitForTimeout(300);
  const oku = () => page.evaluate(() => {
    const tbl = [...document.querySelectorAll('.ve-fw-tbl')].pop();
    const th = [...tbl.querySelectorAll('thead th')].map(e => Math.round(e.getBoundingClientRect().left));
    const tr = tbl.querySelector('tbody tr');
    const td = [...tr.children].map(e => Math.round(e.getBoundingClientRect().left));
    return { hiza: th.length === td.length && th.every((x, i) => Math.abs(x - td[i]) <= 1),
             sutun: th.length,
             kw: [...tr.querySelectorAll('td.ve-fw-ro')].map(e => e.textContent.trim()),
             kaynak: [...document.querySelectorAll('.ve-fw-tbl')][0].innerText };
  });
  const k0 = await oku();
  console.log('ÇEVRİM0 hiza', k0.hiza, 'sütun', k0.sutun, 'kW', JSON.stringify(k0.kw));
  expect(k0.hiza).toBe(true);

  await page.selectOption('select[onchange*="veFeadWizAccPreset"]', { index: 1 });
  await page.waitForTimeout(400);
  const k1 = await oku();
  console.log('ÇEVRİM1 kW', JSON.stringify(k1.kw));
  expect(k1.kw.join('|')).not.toBe(k0.kw.join('|'));
  expect(k1.kaynak).toMatch(/katalog/);

  expect(hata.filter(h => !/favicon|manifest|version\.json|Failed to load resource/i.test(h))).toEqual([]);
});
