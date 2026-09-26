/**
 * fead-step.spec.js — SİHİRBAZDA "STEP'TEN BAŞLA" (gerçek tarayıcı)
 *
 * Kullanıcı isteği (2026-09-26): CATIA/3DEXPERIENCE montajı programa atılır,
 * parçaları kullanıcı ELLE seçer, bir düğmeyle çaplar ve merkezler hesaplanır
 * ve kayış düzlemi hemen çizilir.
 *
 * Node'da HİÇ koşmayan halkalar:
 *   · dosya girişinin gerçek File nesnesi (arrayBuffer) ve bir kare sonraki
 *     ayrıştırma — .stpZ (başlık alanlı gzip) tarayıcıda açılıyor mu
 *   · kartın gerçek tıklamaları: rol listeleri, "Çap ve merkezleri hesapla",
 *     "Sihirbaza aktar", "Sıra doğru"
 *   · çizim gerçekten görünür bir boyutta ve rengi temadan çözülüyor
 *   · BIRAKMA: kartın üstüne bırakılan dosya okunur ve ölçüm içe aktarma
 *     kaplaması/sihirbazı AÇILMAZ (`data-ve-dropzone` sözleşmesi)
 *   · tablo kartın içinde kalıyor — yatay kaydırma yok
 *   · künye seçilince model gerçekten çözülüyor ve "Modeli Kur" 4 kasnak kuruyor
 * Sentetik dosya Gates AG00686 düzeni (tests/helpers/step-ornek.js) — birim
 * testiyle AYNI dosya.
 */
const { test, expect } = require('@playwright/test');
const zlib = require('zlib');
const O = require('../helpers/step-ornek.js');
test.setTimeout(180000);

function stpZ(metin) {
  // CATIA'nın .stpZ'si gzip; başlıkta dosya adı taşıyabiliyor (FNAME)
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
  // Boş FEAD topolojisi sihirbazla karşılar (FEAD kural 5)
  await expect(page.locator('#ve-feadwiz-overlay')).toBeVisible({ timeout: 20000 });
}

test('STEP\'ten başla: .stpZ seç → rolleri ver → hesapla (çizim) → aktar → künye → Modeli Kur', async ({ page }) => {
  const hatalar = [];
  page.on('pageerror', (e) => hatalar.push(String(e)));
  await page.setViewportSize({ width: 1366, height: 768 });
  await feadAc(page);

  // ── 1) DOSYA SEÇ (gerçek File nesnesi, gzip) ────────────────────────────
  const kart = page.locator('.ve-fw-stp');
  await expect(kart).toBeVisible();
  await page.locator('.ve-fw-stp-file').setInputFiles({
    name: 'AG00686.stpZ', mimeType: 'application/octet-stream', buffer: stpZ(O.ag00686Step()),
  });
  const satir = page.locator('.ve-fw-tbl-stp tr[data-ve-stp]');
  // Ağacın bütün parçaları (kayış dâhil) listede, HİÇBİRİ rol almamış
  await expect(satir).toHaveCount(5, { timeout: 20000 });
  await expect(page.locator('.ve-fw-stp .ve-fw-seeded')).toContainText('sıkıştırılmış (gzip)');
  expect(await satir.locator('select').evaluateAll((l) => l.map((s) => s.value))).toEqual(['', '', '', '', '']);
  await expect(page.locator('#ve-fw-stp-hesapla')).toBeDisabled();
  await expect(page.locator('.ve-fw-stp-svg')).toHaveCount(0);

  // Tablo kartın içinde: yatay kaydırma yok (1366 × 768)
  const tasma = await page.evaluate(() => {
    const w = document.querySelector('.ve-fw-tbl-stp').closest('.ve-fw-tblwrap');
    const g = document.getElementById('ve-fw-body');
    return { tablo: w.scrollWidth - w.clientWidth, govde: g.scrollWidth - g.clientWidth };
  });
  expect(tasma.tablo).toBeLessThanOrEqual(1);
  expect(tasma.govde).toBeLessThanOrEqual(1);

  // ── 2) ROLLERİ ELLE VER (gerçek seçim), sonra HESAPLA ───────────────────
  // Satır ADIN HÜCRESİNDEN bulunur: düz metin süzgeci büyük/küçük harfe
  // duyarsız ve her satırın rol listesinde "Krank Kasnağı" seçeneği var.
  const adSatiri = (ad) => satir.filter({ has: page.locator('td:first-child', { hasText: new RegExp(ad) }) });
  const rolVer = async (ad, tip) => { await adSatiri(ad).locator('select').selectOption(tip); };
  await rolVer('KRANK', 'fead-crank');
  await rolVer('AVARA', 'fead-idler');
  await rolVer('KLİMA', 'fead-ac');
  await rolVer('GERGİ', 'fead-tensioner');
  await expect(page.locator('.ve-fw-stp-svg')).toHaveCount(0);        // rol vermek hesaplamaz
  await page.locator('#ve-fw-stp-hesapla').click();
  // Kayış düzlemi çizimi: dört kasnak, gergi kolu; krank orijinde
  await expect(page.locator('.ve-fw-stp-svg [data-ve-stp-kasnak]')).toHaveCount(4);
  await expect(page.locator('.ve-fw-stp-svg .ve-fw-stp-kol')).toHaveCount(1);
  await expect(adSatiri('KRANK')).toContainText('8 × PK');
  // Çizim görünür bir boyutta ve renkleri temadan (stroke çözülmüş)
  const cizim = await page.evaluate(() => {
    const svg = document.querySelector('.ve-fw-stp-svg');
    const c = svg.querySelector('[data-ve-stp-kasnak] circle');
    const r = svg.getBoundingClientRect();
    return { w: r.width, h: r.height, stroke: getComputedStyle(c).stroke };
  });
  expect(cizim.w).toBeGreaterThan(300);
  expect(cizim.h).toBeGreaterThan(200);
  expect(cizim.stroke).not.toBe('none');
  // Rol değişince sonuç düşer — yeniden hesaplanır
  await rolVer('KLİMA', 'fead-alternator');
  await expect(page.locator('.ve-fw-stp-svg')).toHaveCount(0);
  await rolVer('KLİMA', 'fead-ac');
  await page.locator('#ve-fw-stp-hesapla').click();
  await expect(page.locator('.ve-fw-stp-svg [data-ve-stp-kasnak]')).toHaveCount(4);

  // ── 3) AKTAR ────────────────────────────────────────────────────────────
  await page.locator('#ve-fw-stp-aktar').click();
  await expect(page.locator('.ve-fw-stp')).toContainText('4 kasnak sihirbaza aktarıldı');
  const st = await page.evaluate(() => {
    const s = veFeadWizState();
    return { tipler: s.pulleys.map((p) => p.type).sort(), ten: s.ten, belt: s.belt, sira: s.siraKaynagi };
  });
  expect(st.tipler).toEqual(['fead-ac', 'fead-crank', 'fead-idler']);
  expect(st.ten.tenPart).toBe('T38624');
  expect(st.ten.armLen).toBe(90);
  expect(st.belt).toEqual({ profile: 'PK', brand: 'GATES', ribs: 8 });   // kayışa dokunulmadı
  expect(st.sira).toBe('agac');

  // ── 4) KASNAKLAR: sıra uyarısı ve onayı ─────────────────────────────────
  await page.locator('.ve-fw-steps li').nth(1).click();
  await expect(page.locator('#ve-fw-issue')).toContainText('STEP ağacından');
  await expect(page.locator('.ve-fw-steps li').nth(1)).toHaveClass(/ve-fw-st-(warn|err)/);
  await page.locator('#ve-fw-sira-onay').click();
  await expect(page.locator('#ve-fw-issue')).not.toContainText('STEP ağacından');
  await expect(page.locator('#ve-fw-sira-onay')).toHaveCount(0);

  // ── 5) GERGİ: künye seç → model çözülür ─────────────────────────────────
  await page.locator('.ve-fw-steps li').nth(2).click();
  await page.locator('.ve-fw-card select').first().selectOption('AG00686');
  await expect(page.locator('.ve-fw-pill-ok')).toBeVisible({ timeout: 10000 });
  const b = await page.evaluate(() => {
    const r = veFeadWizBuild();
    return { ok: r.ok, spin: r.spin, n: r.order.length };
  });
  expect(b).toEqual({ ok: true, spin: -1, n: 4 });

  // ── 6) MODELİ KUR ───────────────────────────────────────────────────────
  await page.locator('.ve-fw-steps li').nth(5).click();
  await page.locator('#ve-fw-create').click();
  await page.waitForFunction(() =>
    window.nodes.filter((n) => (componentDefs[n.type] || {}).isFeadPulley).length === 4,
    null, { timeout: 20000 });
  const kur = await page.evaluate(() => veFeadBeltOrder(window.nodes).map((n) => n.type));
  expect(kur).toEqual(['fead-crank', 'fead-idler', 'fead-ac', 'fead-tensioner']);

  expect(hatalar).toEqual([]);
});

test('kartın üstüne BIRAKILAN dosya okunur; ölçüm içe aktarma açılmaz', async ({ page }) => {
  const hatalar = [];
  page.on('pageerror', (e) => hatalar.push(String(e)));
  await feadAc(page);
  const metin = O.ag00686Step();
  await page.evaluate(async (m) => {
    const dt = new DataTransfer();
    dt.items.add(new File([m], 'AG00686.stp', { type: 'application/octet-stream' }));
    const el = document.querySelector('.ve-fw-stp');
    // Belgenin kendi dinleyicileri de koşar (kabarcık): kaplama sayacı + drop
    for (const tip of ['dragenter', 'dragover', 'drop']) {
      el.dispatchEvent(new DragEvent(tip, { bubbles: true, cancelable: true, dataTransfer: dt }));
    }
  }, metin);
  await expect(page.locator('.ve-fw-tbl-stp tr[data-ve-stp]')).toHaveCount(5, { timeout: 20000 });
  const durum = await page.evaluate(() => ({
    kaplama: document.getElementById('ve-imp-drop').classList.contains('on'),
    isaret: document.querySelector('.ve-fw-stp').classList.contains('ve-fw-stp-on'),
    olcumSihirbazi: [...document.querySelectorAll('.ve-settings-overlay')]
      .filter((o) => o.id !== 've-feadwiz-overlay' && getComputedStyle(o).display !== 'none').length,
    // Ölçüm bırakma alanının uzantı süzgeci .stp'yi REDDEDER ve "okunamaz —
    // yalnızca .xlsx…" der: yerel alan sözleşmesi olmasa sihirbaz yine açılmaz
    // ama kullanıcı dosyasının okunduğu anda "okunamaz" yazısını görürdü.
    // Kapının asıl ölçtüğü şey bu yanıltıcı iletinin YOKLUĞU.
    okunamaz: [...document.querySelectorAll('.ve-toast')]
      .filter((t) => /okunamaz/.test(t.textContent)).length,
  }));
  expect(durum).toEqual({ kaplama: false, isaret: false, olcumSihirbazi: 0, okunamaz: 0 });
  expect(hatalar).toEqual([]);
});
