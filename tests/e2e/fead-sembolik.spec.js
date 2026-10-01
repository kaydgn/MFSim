/**
 * fead-sembolik.spec.js — ÇÖZÜLMEYEN MODEL, gerçek tarayıcı
 *
 * Kullanıcı bildirimi (2026-10-01): *"ortadaki kanvasta çizim çok büyük ve
 * içinde geliyor. Onu biraz uzaklaştıralım. Ayrıca, 3B modelde ve manuel
 * olarak kasnak tanımlamaya başladığım zaman, özellikle 3B model kullanarak
 * tanımladıktan sonra … sistemi kurmuyor. Kanvasta çizim göstermiyor. … En
 * azından sembolik bir çizim olsun, eksikler yine belirtilsin."*
 *
 * Node'da HİÇ koşmayan halkalar: gerçek STEP dosyası → aktarım → masanın
 * dört adımı; "Modeli kur"a gerçek tık; kartta eksik şeridinin GERÇEK
 * kutusunun çizime ve rozete binmemesi; adların gerçek yazı genişliğiyle
 * çakışmaması; şeritteki konumsuz kasnağın gerçek fareyle çizime
 * sürüklenmesi (ters köprü + SVG noktası); masanın sığdırma nefesi gerçek
 * düğme ve çip kutularına karşı. Kuralların birim kapısı:
 * tests/unit/fead-sembolik.test.js.
 */
const { test, expect } = require('@playwright/test');
const zlib = require('zlib');
const O = require('../helpers/step-ornek.js');
test.setTimeout(180000);

function stpZ(metin) {
  const govde = zlib.deflateRawSync(Buffer.from(metin, 'latin1'));
  return Buffer.concat([Buffer.from([0x1f, 0x8b, 8, 8, 0, 0, 0, 0, 0, 3]),
    Buffer.from('AG00686.stp\0', 'latin1'), govde, Buffer.alloc(8)]);
}

async function feadAc(page) {
  await page.goto('/index.html');
  await page.evaluate(() => { if (window.MFSimLoader && MFSimLoader.start) MFSimLoader.start(); });
  await page.waitForFunction(() => typeof window.veFeadOpenEditor === 'function', null, { timeout: 90000 });
  await page.evaluate(() => {
    if (typeof veSelectModuleFromOverlay === 'function') veSelectModuleFromOverlay('arac-performans');
  });
  await page.waitForFunction(() => {
    const s = document.getElementById('mfsim-loading-screen');
    return !s || s.style.display === 'none';
  }, null, { timeout: 90000 });
  await page.evaluate(() => { const n = createNode('fead-analysis', 400, 300); veFeadOpenEditor(n.id); });
  await page.waitForTimeout(500);
  // Bildirimler ölçülen kutuların üstüne düşmesin.
  await page.addStyleTag({ content: '.ve-toast{ display:none !important; }' });
}

// Kutular arası kesişim (ekran px, 0,5 px tolerans).
const KESIS = `(a, b) => !(a.right <= b.left + 0.5 || b.right <= a.left + 0.5
  || a.bottom <= b.top + 0.5 || b.bottom <= a.top + 0.5)`;

// ── 1 · STEP → MASA → MODELİ KUR → KART ───────────────────────────────────
// Ölçülen önce: dört çizim adımının dördü de cümle basıyordu, "Modeli kur"
// kapalıydı (b.ok istiyordu), kart "Şema çizilemiyor" diyordu.
for (const [W, H] of [[1366, 768], [1440, 900]]) {
  test(`STEP künyesiz gergi (${W}×${H}): masa 4/4 çizer, Modeli kur kurar, kart sembolik çizer ve şerit hiçbir şeyi örtmez`, async ({ page }) => {
    const hatalar = [];
    page.on('pageerror', (e) => hatalar.push(String(e)));
    await page.setViewportSize({ width: W, height: H });
    await feadAc(page);
    await page.locator('#ve-fead-baslangic .ve-fead-bas-kapi[data-ey="sihirbaz"]').click();
    await expect(page.locator('#ve-feadwiz-overlay')).toBeVisible({ timeout: 20000 });
    await page.locator('.ve-fw-stp-file').setInputFiles({
      name: 'AG00686.stpZ', mimeType: 'application/octet-stream', buffer: stpZ(O.ag00686Step()),
    });
    await page.waitForSelector('#ve-fw-3b-tuval[data-durum="hazir"]', { timeout: 30000 });
    // Roller (3B tıklaması fead-step.spec.js'te; burada konu çözülmeyen model).
    await page.evaluate(() => {
      const s = veFeadWizStp();
      s.sonuc.agac.forEach((d, i) => {
        const t = /KRANK/.test(d.ad) ? 'fead-crank' : /KL[İI]MA/.test(d.ad) ? 'fead-ac'
          : /AVARA/.test(d.ad) ? 'fead-idler' : null;
        if (t) veFeadWizStpRol(i, t);
      });
    });
    await page.locator('#ve-fw-3b-hesapla').click();
    await page.waitForTimeout(400);
    await page.locator('#ve-fw-3b-aktar').click();
    await page.waitForTimeout(400);
    const durum = await page.evaluate(() => {
      const b = veFeadWizBuild();
      return { ok: b.ok, hata: b.errors.length, gergi: !!veFeadWizState().ten.armLen };
    });
    expect(durum).toEqual({ ok: false, hata: 3, gergi: true });   // yalnız yay verisi eksik

    for (const key of ['kasnak', 'gergi', 'kayis', 'ozet']) {
      await page.evaluate((k) => veFeadWizGoto(VE_FW_STEPS.findIndex((s) => s.key === k)), key);
      await page.waitForTimeout(250);
      const m = await page.evaluate((kes) => {
        const K = eval(kes);
        const masa = document.getElementById('ve-fw-masa');
        const svg = masa.querySelector('#ve-fw-masa-cizim svg[data-sembolik="1"]');
        const r = (e) => e.getBoundingClientRect();
        const adlar = svg ? [...svg.querySelectorAll('[data-ve="sem-ad"]')].map(r) : [];
        const cem = svg ? [...svg.querySelectorAll('circle[data-ve="sem-kasnak"]')].map(r) : [];
        let adAd = 0, adCem = 0;
        adlar.forEach((a, i) => {
          adlar.forEach((b, j) => { if (j > i && K(a, b)) adAd++; });
          cem.forEach((c) => {
            // Daireyi kutusuyla değil merkez-yarıçapla: köşedeki boşluk çakışma değil.
            const cx = (c.left + c.right) / 2, cy = (c.top + c.bottom) / 2, R = c.width / 2;
            const nx = Math.max(a.left, Math.min(cx, a.right)), ny = Math.max(a.top, Math.min(cy, a.bottom));
            if ((cx - nx) ** 2 + (cy - ny) ** 2 < (R - 1) ** 2) adCem++;
          });
        });
        // Köşedeki birim ile X ekseninin yazıları
        const ey = [...masa.querySelectorAll('.ve-fw-eksen-yazi text')];
        const mm = ey.find((t) => t.textContent === 'mm');
        const mmCak = mm ? ey.filter((t) => t !== mm && K(r(mm), r(t))).length : 0;
        // Aynı satırdaki (X ekseni) yazılarla boşluk — değmek de çakışmaktır.
        const mmB = mm ? Math.min(...ey.filter((t) => t !== mm && Math.abs(r(t).top - r(mm).top) < 2)
          .map((t) => r(t).left - r(mm).right)) : 99;
        return { svg: !!svg, bos: !!masa.querySelector('.ve-fw-masa-bos'), adAd, adCem, mmCak,
                 mmB: Math.round(mmB * 10) / 10, ad: adlar.length };
      }, KESIS);
      console.log('MASA', W, key, JSON.stringify(m));
      expect([key, m.svg, m.bos]).toEqual([key, true, false]);
      expect([key, m.adAd, m.adCem, m.mmCak]).toEqual([key, 0, 0, 0]);
      expect([key, m.mmB >= 4]).toEqual([key, true]);
    }

    // ── Modeli kur: AÇIK ve çözümsüz işaretli ──
    await page.evaluate(() => veFeadWizGoto(VE_FW_STEPS.length - 1));
    await page.waitForTimeout(250);
    const dugme = page.locator('#ve-fw-create');
    await expect(dugme).toBeEnabled();
    await expect(dugme).toHaveAttribute('data-cozumsuz', '1');
    await dugme.click();
    await expect(page.locator('#ve-feadwiz-overlay')).toBeHidden();
    await page.waitForTimeout(600);

    const kart = await page.evaluate((kes) => {
      const K = eval(kes);
      const r = (e) => e.getBoundingClientRect();
      return [...document.querySelectorAll('.ve-fead-layout-card')].map((c) => {
        const svg = c.querySelector('.ve-fead-kanvas svg[data-sembolik="1"]');
        const serit = c.querySelector('.ve-fead-kan-bos.sembolik');
        const roz = c.querySelector('.ve-fead-kan-durum');
        const isler = svg ? [...svg.querySelectorAll('circle[data-ve="sem-kasnak"], [data-ve="sem-ad"], [data-ve="sem-sira"], [data-ve="pivot"]')] : [];
        const sr = serit && r(serit);
        const adlar = svg ? [...svg.querySelectorAll('[data-ve="sem-ad"]')].map(r) : [];
        const cem = svg ? [...svg.querySelectorAll('circle[data-ve="sem-kasnak"]')].map(r) : [];
        let adAd = 0, adCem = 0;
        adlar.forEach((a, i) => {
          adlar.forEach((b, j) => { if (j > i && K(a, b)) adAd++; });
          cem.forEach((c) => {
            const cx = (c.left + c.right) / 2, cy = (c.top + c.bottom) / 2, R = c.width / 2;
            const nx = Math.max(a.left, Math.min(cx, a.right)), ny = Math.max(a.top, Math.min(cy, a.bottom));
            if ((cx - nx) ** 2 + (cy - ny) ** 2 < (R - 1) ** 2) adCem++;
          });
        });
        const ciz = c.querySelector('.ve-fead-kanvas > .ciz');
        return {
          svg: !!svg, serit: !!serit, kasnak: svg ? svg.querySelectorAll('circle[data-ve="sem-kasnak"]').length : 0,
          seritCizim: sr ? isler.filter((e) => K(sr, r(e))).length : -1,
          seritRozet: (sr && roz) ? K(sr, r(roz)) : null,
          seritTasma: sr ? (sr.right > r(ciz).right + 0.5 || sr.bottom > r(ciz).bottom + 0.5) : null,
          adAd, adCem, metin: serit && serit.textContent,
        };
      });
    }, KESIS);
    console.log('KART', W, JSON.stringify(kart));
    expect(kart.length).toBeGreaterThanOrEqual(1);
    kart.forEach((k) => {
      expect(k.svg).toBe(true);
      expect(k.serit).toBe(true);
      expect(k.kasnak).toBe(4);
      expect(k.seritCizim).toBe(0);        // şerit çizimi örtmüyor
      expect(k.seritRozet).toBe(false);    // rozete binmiyor
      expect(k.seritTasma).toBe(false);
      expect(k.adAd).toBe(0);
      expect(k.adCem).toBe(0);             // ad komşu kasnağın çemberine binmiyor
      expect(k.metin).toContain('Gergi yay ön yük momenti girilmedi.');
    });

    // ── Çizimde kasnağa GERÇEK tık → penceresi açılır (Çizim Masası) ──
    const hit = page.locator('.ve-fead-layout-card .ve-fead-hit').first();
    const hk = await hit.getAttribute('data-fead-k');
    const bb = await hit.boundingBox();
    await page.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2);
    await page.waitForTimeout(300);
    const tik = await page.evaluate(() => ({
      panel: document.getElementById('ve-properties-overlay').classList.contains('visible'),
      secili: selectedNodes.length === 1 ? selectedNodes[0].id : null,
    }));
    expect(tik).toEqual({ panel: true, secili: hk });
    expect(hatalar).toEqual([]);
  });
}

// ── 2 · ŞERİTTEN ÇİZİME — konumsuz kasnak gerçek fareyle konum alır ───────
test('ŞERİTTEN ÇİZİME: konumsuz kasnak sürüklenince bırakıldığı mm\'yi alır; Ctrl+Z tek adım; tık yalnız pencereyi açar', async ({ page }) => {
  const hatalar = [];
  page.on('pageerror', (e) => hatalar.push(String(e)));
  await page.setViewportSize({ width: 1440, height: 900 });
  await feadAc(page);
  await page.locator('#ve-fead-baslangic .ve-fead-bas-kapi[data-ey="bos"]').click();
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    veStateBatch(() => { veFeadTableAdd('fead-crank'); veFeadTableAdd('fead-alternator'); veFeadTableAdd('fead-idler'); });
  });
  await page.waitForTimeout(500);
  const kart = page.locator('.ve-fead-layout-card').first();
  await expect(kart.locator('svg[data-sembolik="1"]')).toHaveCount(1);
  await expect(kart.locator('circle[data-ve="sem-kasnak"][data-yok]')).toHaveCount(3);
  await expect(kart.locator('[data-ve="sem-bekleyen"] text').first()).toHaveText('konum yok — çizime sürükle');

  // Tık: yalnız pencere açılır, konum YAZILMAZ.
  const ilk = kart.locator('.ve-fead-hit[data-yok]').first();
  const id = await ilk.getAttribute('data-fead-k');
  let b = await ilk.boundingBox();
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  await page.waitForTimeout(300);
  expect(await page.evaluate((i) => {
    const n = nodes.find((x) => x.id === i);
    return [document.getElementById('ve-properties-overlay').classList.contains('visible'),
            Number.isFinite(parseFloat(n.data.x))];
  }, id)).toEqual([true, false]);
  await page.evaluate(() => veTogglePropertiesPanel(false));

  // Sürükle: şeritten çizimin içine.
  b = await kart.locator('.ve-fead-hit[data-fead-k="' + id + '"]').boundingBox();
  const s = await kart.locator('.ve-fead-kanvas svg[data-fead-xf]').boundingBox();
  // Tam piksel: fare olayı istemcide tam sayıya iner; kesirli hedefle beklenen
  // mm bir pikselin karşılığı kadar (bu ölçekte ~2,6 mm) kayardı.
  const hedef = { x: Math.round(s.x + s.width * 0.6), y: Math.round(s.y + s.height * 0.4) };
  const beklenen = await page.evaluate(([k, hx, hy]) => {
    const svg = _feadKartSvg(k), xf = _feadCizimXf(svg);
    return _feadCizimMm(xf, _feadSvgPoint(svg, { clientX: hx, clientY: hy }));
  }, [await page.evaluate(() => nodes.find((n) => n.type === 'fead-layout').id), hedef.x, hedef.y]);
  await page.mouse.move(Math.round(b.x + b.width / 2), Math.round(b.y + b.height / 2));
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) {
    await page.mouse.move(Math.round(b.x + b.width / 2 + (hedef.x - b.x - b.width / 2) * i / 12),
                          Math.round(b.y + b.height / 2 + (hedef.y - b.y - b.height / 2) * i / 12));
    await page.waitForTimeout(16);
  }
  await page.mouse.up();
  await page.waitForTimeout(400);
  const sonra = await page.evaluate((i) => {
    const n = nodes.find((x) => x.id === i);
    return [parseFloat(n.data.x), parseFloat(n.data.y)];
  }, id);
  console.log('SÜRÜKLE', JSON.stringify({ beklenen, sonra }));
  expect(Math.abs(sonra[0] - beklenen[0])).toBeLessThan(0.11);
  expect(Math.abs(sonra[1] - beklenen[1])).toBeLessThan(0.11);
  await expect(kart.locator('circle[data-ve="sem-kasnak"][data-yok]')).toHaveCount(2);

  // Ctrl+Z: tek adımda konumsuz hâle döner.
  await page.evaluate(() => { if (document.activeElement) document.activeElement.blur(); });
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(400);
  expect(await page.evaluate((i) => Number.isFinite(parseFloat(nodes.find((x) => x.id === i).data.x)), id))
    .toBe(false);
  await expect(page.locator('.ve-fead-layout-card').first()
    .locator('circle[data-ve="sem-kasnak"][data-yok]')).toHaveCount(3);
  expect(hatalar).toEqual([]);
});

// ── 3 · MASANIN SIĞDIRMA NEFESİ — gerçek düğme, çip ve lejant kutuları ────
// Ölçülen önce (1440×900): kasnaklar masanın %88'i, sağ boşluk 29 px —
// yakınlaştırma düğmeleri kasnakların üstüne biniyordu.
test('MASA NEFESİ: 12 örnekte kasnaklar düğmelerin, çipin ve lejantın ALTINDA kalmıyor (1440 · 1366)', async ({ page }) => {
  for (const [W, H] of [[1440, 900], [1366, 768]]) {
    await page.setViewportSize({ width: W, height: H });
    if (W === 1440) {
      await feadAc(page);
      await page.evaluate(() => veFeadWizOpenAny());
      await expect(page.locator('#ve-feadwiz-overlay')).toBeVisible();
    }
    const anahtarlar = await page.evaluate(() => veFeadExampleKeys());
    for (const k of anahtarlar) {
      await page.evaluate((o) => { veFeadWizSeed(o); veFeadWizGoto(1); }, k);
      await page.waitForTimeout(150);
      const m = await page.evaluate((kes) => {
        const K = eval(kes);
        const masa = document.getElementById('ve-fw-masa');
        const r = (e) => e.getBoundingClientRect();
        const cem = [...masa.querySelectorAll('circle[data-ve="pulley"]')].map(r);
        const engel = ['.ve-fw-masa-gezin', '.ve-fw-masa-ust', '#ve-fw-masa-lejant']
          .map((s) => masa.querySelector(s)).filter((e) => e && r(e).width > 0).map(r);
        const mr = r(masa);
        const x1 = Math.max(...cem.map((c) => c.right));
        // Köşedeki birim ("mm") X ekseninin yazılarına binmiyor.
        const ey = [...masa.querySelectorAll('.ve-fw-eksen-yazi text')];
        const mm = ey.find((t) => t.textContent === 'mm');
        const mmB = mm ? Math.min(...ey.filter((t) => t !== mm && Math.abs(r(t).top - r(mm).top) < 2)
          .map((t) => r(t).left - r(mm).right)) : 99;
        return { cak: cem.filter((c) => engel.some((e) => K(c, e))).length,
                 mmCak: mm ? ey.filter((t) => t !== mm && K(r(mm), r(t))).length : -1, mmB,
                 sag: Math.round(mr.right - x1), dol: +((x1 - Math.min(...cem.map((c) => c.left))) / mr.width).toFixed(3) };
      }, KESIS);
      expect([W, k, m.cak, m.mmCak, m.mmB >= 4]).toEqual([W, k, 0, 0, true]);
      expect(m.dol).toBeLessThan(0.86);
    }
  }
});
