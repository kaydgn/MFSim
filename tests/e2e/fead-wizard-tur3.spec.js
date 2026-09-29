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
  // ÇİZİM MASASI (2026-09-29): tablo satırı yerine seçili satırın EDİTÖRÜ;
  // gerginin editörü kasnaklarınkiyle aynı ızgarada, aynı satır boyunda.
  const edOlc = () => page.evaluate(() => {
    const ed = document.getElementById('ve-fw-ed');
    const al = [...ed.querySelectorAll('.ve-fw-ed-alan')];
    return { x: al.map((a) => Math.round(a.lastElementChild.getBoundingClientRect().left)),
             h: al.map((a) => Math.round(a.getBoundingClientRect().height)) };
  });
  const ilkKey = await page.evaluate(() =>
    document.querySelector('#ve-fw-kl-liste .ve-fw-kl').getAttribute('data-fw-k'));
  await page.locator('#ve-fw-kl-liste .ve-fw-kl[data-fw-k="' + ilkKey + '"]').click();
  const kasnakEd = await edOlc();
  await page.locator('#ve-fw-kl-liste .ve-fw-kl[data-fw-k="__ten__"]').click();
  const gergiEd = await edOlc();
  const satir = await page.evaluate(() => {
    const ed = document.getElementById('ve-fw-ed');
    const tipAlan = [...ed.querySelectorAll('.ve-fw-ed-alan')].find((a) => /^Tip/.test(a.textContent));
    const sel = tipAlan.querySelector('select');
    return {
      tipMetni: sel ? sel.options[sel.selectedIndex].textContent.trim() : '',
      // Tek seçenekli bir <select> — kasnakların editörüyle aynı biçim. Kilit
      // görünümle değil SEÇENEK KÜMESİYLE kuruluyor.
      tipSelect: !!sel,
      tipSecenek: sel ? sel.querySelectorAll('option').length : 0,
      cip: !!ed.querySelector('.ve-fw-tag'),
      xIpucu: (ed.querySelector('input[aria-label="Merkez X"]') || {}).title || ''
    };
  });
  satir.hiza = gergiEd.x.length === kasnakEd.x.length && gergiEd.x.every((v, i) => Math.abs(v - kasnakEd.x[i]) <= 1);
  satir.yukseklikFarki = Math.max(...gergiEd.h.map((v, i) => Math.abs(v - kasnakEd.h[i])));
  console.log('SATIR', JSON.stringify(satir));
  expect(satir.hiza).toBe(true);
  expect(satir.tipMetni).toBe('Otomatik Gergi');
  expect(satir.tipSelect).toBe(true);
  expect(satir.tipSecenek).toBe(1);
  expect(satir.cip).toBe(false);
  expect(satir.yukseklikFarki).toBeLessThanOrEqual(2);   // satır artık şişmiyor
  expect(satir.xIpucu).toMatch(/montaj noktas/);

  // ── 3 · CCW/CW SEÇİCİSİ VAR ve TEK ÜRETİCİDEN ─────────────────────────
  //
  // Bu blok bir dönem seçicinin YOKLUĞUNU çiviliyordu (`spin === 0`). Seçici
  // kullanıcı isteğiyle geri geldi (2026-08-31: *"'Kasnaklar' kısmına 'dönüş
  // yönü' seçmeyi de eklememiz gerekiyor"*) ve kapı o gün sessizce ölmüş bir
  // dönemin durumunu savunur hâle geldi.
  //
  // BUGÜNKÜ HÜKÜM DAHA GÜÇLÜ: yüzey TEK ÜRETİCİDEN geliyor
  // (`veFeadWizSpinHTML`) ve hem 2. hem 3. adım onu basıyor. İki kopya
  // tutulsaydı biri düzeltilince öbürü sessizce eskirdi.
  const spinOku = () => page.evaluate(() => ({
    adet: document.querySelectorAll('.ve-fw-spin').length,
    acik: document.querySelectorAll('.ve-fw-spin-on').length,
    glif: [...document.querySelectorAll('.ve-fw-spin')].map((b) => b.textContent.trim()).join('|')
  }));
  await page.evaluate(() => veFeadWizGoto(1));
  await page.waitForTimeout(300);
  // "Kayış yönünü çevir" düğmesi KALKTI (2026-09-29): CCW/CW seçicisiyle aynı
  // işlemi yapıyordu; seçici sıranın kendi kartında.
  const yol = await page.evaluate(() => ({
    cevir: !!document.querySelector('button[onclick*="veFeadWizRouteReverse"]'),
    kartta: !!document.querySelector('#ve-fw-yan .ve-fw-kl-arac .ve-fw-spinbox'),
    seritYon: (document.querySelector('.ve-fw-live') || {}).innerText || ''
  }));
  const s3 = await spinOku();
  console.log('YOL', JSON.stringify(yol), JSON.stringify(s3));
  expect(s3.adet).toBe(2);                  // CCW + CW
  expect(s3.acik).toBe(1);                  // biri BASILI — yön okunuyor
  expect(yol.cevir).toBe(false);
  expect(yol.kartta).toBe(true);
  expect(yol.seritYon).toMatch(/CCW|CW/);   // yön okuması KAYBOLMADI

  // AYNI KONTROL 2. ADIMDA DA, BİREBİR: tek üretici kuralının kapısı.
  await page.evaluate(() => veFeadWizGoto(0));
  await page.waitForTimeout(300);
  await page.evaluate(() => veFeadWizGoto(1));
  await page.waitForTimeout(300);
  expect(await spinOku()).toEqual(s3);

  // ── 4 · AKSESUAR SATIRI SEÇİMLE KAYMIYOR ───────────────────────────────
  // Çizim masasında aksesuar bir tablo değil bir SATIR: seçici kendi
  // satırında ve tam genişlik; kapı aynı — seçim genişlikleri oynatmaz.
  await page.evaluate(() => veFeadWizGoto(4));
  await page.waitForTimeout(400);
  const sutun = () => page.evaluate(() => {
    const a = [...document.querySelectorAll('#ve-fw-yan .ve-fw-acc')];
    return { th: a.map(e => Math.round(e.getBoundingClientRect().width)),
             sel: a.map(e => Math.round(e.querySelector('select').getBoundingClientRect().width)) };
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
  // Çizim masasında gövde KAYMAZ; kayan denetim SÜTUNU (#ve-fw-yan).
  const y0 = await page.evaluate(() => {
    const b = document.getElementById('ve-fw-yan');
    b.scrollTop = Math.round((b.scrollHeight - b.clientHeight) * 0.6);
    return b.scrollTop;
  });
  expect(y0).toBeGreaterThan(50);
  await page.locator('select[onchange*="veFeadWizDutyLib"]').first().selectOption('AG00902-4');
  await page.waitForTimeout(400);
  const y1 = await page.evaluate(() => document.getElementById('ve-fw-yan').scrollTop);
  console.log('KAYDIRMA', y0, '→', y1);
  expect(Math.abs(y1 - y0)).toBeLessThanOrEqual(1);

  // adım değişimi SIFIRLAR
  await page.evaluate(() => veFeadWizGoto(1));
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => document.getElementById('ve-fw-yan').scrollTop)).toBe(0);

  expect(hata.filter(h => !/favicon|manifest|version\.json|Failed to load resource/i.test(h))).toEqual([]);
});

// ── YAY DOĞRUSU: ETİKET DOĞRUYU KESMEZ (gerçek yazı kutusu) ─────────────────
// Sabit ofsetli ilk yerleşimde 12 örnek × 14 künyenin 180 durumunun 180'inde
// doğru en az bir etiketi kesiyordu (AG00976'da üçünü de); eksen köşesinde
// "0" ile "0°" üst üste biniyordu. Node kapısı kutuyu karakterden tahmin
// eder (fead-sihirbaz-masa.test.js); burada tarayıcının kendi kutusu (getBBox).
test('YAY DOĞRUSU: etiketler doğruyu ve y eksenini kesmez, üst üste binmez — 14 künye', async ({ page }) => {
  const hata = [];
  page.on('pageerror', (e) => hata.push(e.message));
  await page.setViewportSize({ width: 1440, height: 900 });
  await sihirbaz(page);
  await page.evaluate(() => { veFeadWizSeed('AG00976_GATES_2025'); veFeadWizGoto(2); });
  const keys = await page.evaluate(() => VE_FEAD_TENSIONER_DB.map((r) => r.key));
  expect(keys.length).toBe(14);
  const kusur = [];
  for (const key of keys) {
    await page.evaluate((k) => veFeadWizTenLib(k), key);
    const r = await page.evaluate(() => {
      const svg = document.querySelector('#ve-fw-yan svg.ve-fw-yay');
      if (!svg) return null;
      const ln = svg.querySelector('.ve-fw-yay-dogru');
      const [x1, y1, x2, y2] = ['x1', 'y1', 'x2', 'y2'].map((a) => +ln.getAttribute(a));
      const dy = (x) => y1 + (y2 - y1) * (Math.min(Math.max(x, x1), x2) - x1) / (x2 - x1);
      const kut = [...svg.querySelectorAll('.ve-fw-yay-yazi text')].map((t) => {
        const q = t.getBBox(); return { t: t.textContent, x: q.x, y: q.y, w: q.width, h: q.height };
      });
      const out = [];
      // Çizim alanındaki etiketler: x ekseninin ÜSTÜNDE başlayan (eksen yazıları altında,
      // y ekseninin yazıları solunda). Eşik eksenin kendisi — doğruya bağlı bir eşik
      // ön yükü farklı künyede "ön yük" etiketini denetimin dışına düşürüyordu.
      const eksenY = +svg.querySelector('.ve-fw-yay-eksen line').getAttribute('y1');
      const ic = kut.filter((k) => k.x + k.w > x1 && k.y < eksenY);
      if (ic.length < 3) out.push('çizim alanında ' + ic.length + ' etiket');
      ic.forEach((k) => {
        const alt = dy(k.x), ust = dy(k.x + k.w);
        if (!(alt < k.y || ust > k.y + k.h)) out.push('doğru ⟂ ' + k.t);
        if (k.x < x1) out.push('y ekseni ⟂ ' + k.t);
      });
      for (let i = 0; i < kut.length; i++) for (let j = i + 1; j < kut.length; j++) {
        const a = kut[i], c = kut[j];
        if (a.x < c.x + c.w && c.x < a.x + a.w && a.y < c.y + c.h && c.y < a.y + a.h) out.push(a.t + ' ⟂ ' + c.t);
      }
      const vb = svg.viewBox.baseVal;
      kut.filter((k) => k.x < 0 || k.y < 0 || k.x + k.w > vb.width || k.y + k.h > vb.height).forEach((k) => out.push('dışarı: ' + k.t));
      return out;
    });
    expect(r).not.toBeNull();
    r.forEach((x) => kusur.push(key + ': ' + x));
  }
  console.log('YAY', keys.length, 'künye, kusur', kusur.length);
  expect(kusur).toEqual([]);
  expect(hata).toEqual([]);
});
