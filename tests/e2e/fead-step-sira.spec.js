/**
 * fead-step-sira.spec.js — STEP'TEN KAYIŞ SIRASI (gerçek tarayıcı)
 *
 * Kullanıcı bildirimi (2026-10-02): *"3D görselleştirici ile kasnakları
 * sırayla modelledikten sonra, topolojiye aktarırken, 1-2 kasnağın sırasını
 * yanlış aktarıyor."* Ağaçta klima avaradan ÖNCE duruyor (kullanıcının
 * montajı gibi: ağaç kayışın sırası değil); kullanıcı 3B'de kasnaklara
 * KAYIŞ SIRASIYLA rol veriyor ve kayışa da rol veriyor — sıra kayışın
 * eskizinden okunur.
 *
 * Node'da HİÇ koşmayan halkalar:
 *   · gerçek 3B tıklamalarıyla verilen roller — sıranın rol verme sırasından
 *     DEĞİL dosyadan geldiği (rol sırası ağaçtan da tablodan da farklı)
 *   · numaralar aktarmadan ÖNCE görünür: 3B tablosu, 3B etiketleri, kartın çizimi
 *   · aktarımdan sonra Kasnaklar listesi ve "Modeli kur"un Kayış Tablosu
 *     (Pafta) AYNI sırada; durum satırı onay istemiyor
 *   · 1366 × 768'de numaralar tabloları taşırmıyor
 * Sentetik dosya Gates AG00686 düzeni (tests/helpers/step-ornek.js →
 * duzenStep) — birim testiyle AYNI yardımcı.
 */
const { test, expect } = require('@playwright/test');
const O = require('../helpers/step-ornek.js');
test.setTimeout(180000);

const DUZEN = O.ornekDuzen('AG00686_1475_GATES_2023');
const DOGRU = DUZEN.map((k) => k.ad);   // KRANK KASNAĞI · AVARA · KLİMA KOMPRESÖRÜ · OTOMATİK GERGİ T38624
// Ağaç: klima avaradan önce — eski aktarım [krank, klima, avara, gergi] kuruyordu
const AGAC = ['KRANK KASNAĞI', 'KLİMA KOMPRESÖRÜ', 'AVARA', 'OTOMATİK GERGİ T38624', 'KAYIS'];
const METIN = O.duzenStep(DUZEN, AGAC, { kayisAd: 'KAYIŞ - 8PK1475' });

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
  await page.locator('#ve-fead-baslangic .ve-fead-bas-kapi[data-ey="sihirbaz"]').click();
  await expect(page.locator('#ve-feadwiz-overlay')).toBeVisible({ timeout: 20000 });
}

test('3B\'de sırayla rol → hesapla (numaralar) → aktar → Modeli kur: Kayış Tablosu kayışın sırasında', async ({ page }) => {
  const hatalar = [];
  page.on('pageerror', (e) => hatalar.push(String(e)));
  await page.setViewportSize({ width: 1366, height: 768 });
  await feadAc(page);

  await page.locator('.ve-fw-stp-file').setInputFiles({
    name: 'AG00686_SIRA.stp', mimeType: 'application/octet-stream', buffer: Buffer.from(METIN, 'latin1'),
  });
  await expect(page.locator('#ve-fw-3b-tuval')).toHaveAttribute('data-durum', 'hazir', { timeout: 30000 });

  // ── 3B'de KAYIŞ SIRASIYLA rol (kullanıcının yaptığı gibi) + kayış ──────
  const adlar = await page.evaluate(() => veFeadWizStp().sonuc.parcalar.map((p) => p.ad));
  const ROL = { 'KRANK KASNAĞI': 'fead-crank', AVARA: 'fead-idler', 'KLİMA KOMPRESÖRÜ': 'fead-ac',
    'OTOMATİK GERGİ T38624': 'fead-tensioner', 'KAYIŞ - 8PK1475': 'fead-belt' };
  for (const ad of DOGRU.concat('KAYIŞ - 8PK1475')) {
    const n = await page.evaluate((j) => veFeadWiz3bIsabetNoktasi(j), adlar.indexOf(ad));
    expect(n).not.toBeNull();
    await page.mouse.click(n.x, n.y);
    await expect(page.locator('#ve-fw-3b-yan .ve-fw-3b-yol b')).toHaveText(ad);
    await page.locator('#ve-fw-3b-alt .ve-fw-3b-rol[data-ve-3b-rol="' + ROL[ad] + '"]').click();
  }
  await expect(page.locator('#ve-fw-3b-yan')).toContainText('Rol verilenler 5');

  // ── HESAPLA: aktarılacak sıra 3B'de görünür ─────────────────────────────
  await page.locator('#ve-fw-3b-hesapla').click();
  const yan = page.locator('#ve-fw-3b-yan');
  await expect(yan).toContainText('4 kasnak');
  const tablo = await yan.locator('tr[data-ve-3b-kasnak]').evaluateAll((l) => l.map((r) => ({
    no: r.querySelector('[data-ve-3b-sira]').textContent,
    ad: veFeadWizStp().coz.kasnaklar[+r.getAttribute('data-ve-3b-kasnak')].ad,
  })));
  expect(tablo).toEqual(DOGRU.map((ad, i) => ({ no: String(i + 1), ad })));
  await expect(yan.locator('[data-ve-3b-sira-kaynak="kayis"]')).toHaveText(/Sıra kayışın eskizinden/);
  // 3B etiketleri numarayla ve rolün adıyla — "1 · Krank Kasnağı"
  const roller = await page.evaluate(() => veFeadWizStp().coz.kasnaklar.map((k) => [k.ad, _fwStpRolAd(k.tip)]));
  const rolAd = Object.fromEntries(roller);
  await expect.poll(async () => (await page.locator('#ve-fw-3b-etiket [data-ve-3b-etiket] b').allInnerTexts()).sort())
    .toEqual(DOGRU.map((ad, i) => (i + 1) + ' · ' + rolAd[ad]).sort());
  // Panel 1366'da yatay taşmıyor
  expect(await yan.evaluate((y) => y.scrollWidth - y.clientWidth)).toBeLessThanOrEqual(1);

  // ── Kartın çizimi ve ağacı (3B kapalı) aynı numaraları basıyor ──────────
  await page.keyboard.press('Escape');
  await expect(page.locator('#ve-fw-3b')).toBeHidden();
  const cizim = await page.locator('.ve-fw-stp-svg g[data-ve-stp-kasnak]').evaluateAll((l) => l.map((g) =>
    veFeadWizStp().coz.kasnaklar[+g.getAttribute('data-ve-stp-kasnak')].ad + '=' + g.querySelector('[data-ve-stp-sira]').textContent.trim()));
  expect(cizim.sort()).toEqual(DOGRU.map((ad, i) => ad + '=' + (i + 1) + ' ·').sort());
  const agac = await page.locator('.ve-fw-tbl-stp tr[data-ve-stp]').evaluateAll((l) => l
    .filter((r) => r.querySelector('[data-ve-stp-sira]'))
    .map((r) => r.querySelector('td').textContent.trim() + '=' + r.querySelector('[data-ve-stp-sira]').textContent));
  expect(agac).toEqual(AGAC.slice(0, 4).map((ad) => ad + '=' + (DOGRU.indexOf(ad) + 1)));
  const tasma = await page.evaluate(() => {
    const w = document.querySelector('.ve-fw-tbl-stp').closest('.ve-fw-tblwrap');
    return w.scrollWidth - w.clientWidth;
  });
  expect(tasma).toBeLessThanOrEqual(1);

  // ── AKTAR → Kasnaklar listesi kayışın sırasında, onay İSTENMİYOR ────────
  await page.locator('#ve-fw-stp-aktar').click();
  await page.locator('.ve-fw-steps li').nth(1).click();
  const liste = await page.locator('.ve-fw-kl[data-fw-k] .ve-fw-kl-ad > span').allInnerTexts();
  expect(liste).toEqual(DOGRU);
  await expect(page.locator('.ve-fw-kl-onay[data-kaynak="kayis"]')).toHaveText(/Sıra kayışın eskizinden okundu/);
  await expect(page.locator('#ve-fw-sira-onay')).toHaveCount(0);

  // ── Künye → MODELİ KUR → Kayış Tablosu (Pafta) aynı sırada ──────────────
  await page.locator('.ve-fw-steps li').nth(2).click();
  await page.locator('.ve-fw-card select').first().selectOption('AG00686');
  await expect(page.locator('#ve-fw-live .ve-fw-damga[data-model="ok"]')).toBeVisible({ timeout: 10000 });
  await page.locator('.ve-fw-steps li').nth(5).click();
  await page.locator('#ve-fw-create').click();
  await page.waitForFunction(() =>
    window.nodes.filter((n) => (componentDefs[n.type] || {}).isFeadPulley).length === 4, null, { timeout: 20000 });
  expect(await page.evaluate(() => veFeadBeltOrder(window.nodes).map((n) => n.customName))).toEqual(DOGRU);
  await expect(page.locator('tr.ve-fead-pf-satir .ve-fead-tbl-name .ad').first()).toBeVisible({ timeout: 10000 });
  expect(await page.locator('tr.ve-fead-pf-satir .ve-fead-tbl-name .ad').allInnerTexts()).toEqual(DOGRU);

  expect(hatalar).toEqual([]);
});
