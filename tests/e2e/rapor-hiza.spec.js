/**
 * Ayrıntılı rapor — sayı hizası ve anlam rengi (gerçek tarayıcı)
 * ───────────────────────────────────────────────────────────────
 * Kullanıcı kararı 14·B (2026-09-26): rapor tablolarında sayı SAĞA yaslı.
 * Önce 1517 sayı hücresinin 1364'ü ortalıydı, sağa yaslı hiç yoktu. Kural
 * sütun başına: tamamı sayı olan sütun hücresiyle ve başlığıyla sağa; ad,
 * metin ve işaret (✓/✗) sütunları kapsam dışı. "1C" gibi vites adı sayı
 * değil (harf taşıyor), anahtar–değer tabloları başlıksız olduğu için dışarıda.
 *
 * Aynı raporda `.dr-body table td { color:… !important }` 212 hücrenin
 * satır içi anlam rengini eziyordu: etiket/değer ayrımı, soluk notlar,
 * eşleşme noktası vurgusu ve kırmızı/turuncu uyarılar. Ezilen hücre 0 olmalı.
 *
 * Node'da koşmaz: hiza ve renk HESAPLANMIŞ stilden okunur ve rapor gerçek
 * bir çözümden kurulur. Hızlı yarısı: tests/unit/rapor-hiza.test.js.
 * ÖN KOŞUL: npm run build.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const BUILD = path.join(__dirname, '../..', 'MFSim_Code.html');

test.beforeAll(() => {
  if (!fs.existsSync(BUILD)) throw new Error('MFSim_Code.html yok. Önce: npm run build');
});

test('ayrıntılı rapor: sayı sütunu sağa yaslı, hücre rengi ezilmiyor', async ({ page }) => {
  test.setTimeout(180000);
  await page.setViewportSize({ width: 1920, height: 1032 });
  page.on('dialog', (d) => d.accept());
  await page.goto('file://' + BUILD);
  await page.fill('#mfsim-login-password', 'mfsim2024');
  await page.press('#mfsim-login-password', 'Enter');
  await page.waitForSelector('#mfsim-loading-screen', { state: 'hidden', timeout: 90000 });
  await page.click('.ve-module-card[data-module="arac-performans"]');
  await page.waitForSelector('#mfsim-module-loading', { state: 'hidden', timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    window.confirm = () => true;
    let ex = nodes.find((x) => x.type === 'ap-example');
    if (!ex) ex = createNode('ap-example', 300, 200);
    ex.data = ex.data || {}; ex.data.exampleKey = 'isb340_tc411';
    veApLoadExample(ex.id);
  });
  await page.waitForTimeout(2500);
  await page.evaluate(() => veSolverRunProfessional());
  await page.waitForFunction(() => window.veSimResults && window.veSimResults.reportSnapshot, null, { timeout: 120000 });
  await page.evaluate(() => { const o = document.getElementById('ve-solver-modal-overlay'); if (o) o.remove(); });
  // Rapor Sonuçlar sayfasının içinde kurulur
  await page.locator('#ve-nav-rail button:has-text("Sonuçlar")').first().click();
  await page.waitForTimeout(1500);
  await page.evaluate(() => veRenderDetailedReport());
  await page.waitForSelector('#ve-report-overlay .dr-hdr', { timeout: 15000 });
  // Bütün bölümler açık — kapalı bölümün tablosu ölçülmez
  await page.evaluate(() => {
    document.querySelectorAll('#ve-report-overlay .dr-hdr').forEach((h) => {
      const b = h.nextElementSibling;
      if (b && !b.classList.contains('dr-open')) h.click();
    });
  });
  await page.waitForTimeout(800);

  const r = await page.evaluate(() => {
    const kok = document.getElementById('ve-report-overlay');
    const SAYI = /^[-−+]?\d+([.,]\d+)?$/;
    let sutun = 0, hucre = 0;
    const ters = [];
    kok.querySelectorAll('table').forEach((t) => {
      if (!t.offsetWidth || !t.tHead || !t.tBodies.length) return;
      const ths = [...t.tHead.rows[t.tHead.rows.length - 1].cells];
      const satirlar = [...t.tBodies[0].rows].filter((tr) => tr.cells.length === ths.length);
      ths.forEach((th, i) => {
        const tds = satirlar.map((tr) => tr.cells[i]).filter((td) => td && (td.innerText || '').trim());
        if (tds.length < 2 || !tds.every((td) => SAYI.test(td.innerText.trim()))) return;
        sutun++; hucre += tds.length;
        const ad = th.innerText.replace(/\s+/g, ' ').trim().slice(0, 24);
        if (getComputedStyle(th).textAlign !== 'right') ters.push(`${ad}: başlık ${getComputedStyle(th).textAlign}`);
        const yanlis = tds.filter((td) => getComputedStyle(td).textAlign !== 'right').length;
        if (yanlis) ters.push(`${ad}: ${yanlis}/${tds.length} hücre sağa yaslı değil`);
      });
    });
    // Satır içi rengi CSS tarafından ezilen hücre
    const ref = document.createElement('span'); kok.appendChild(ref);
    const coz = (c) => { ref.style.color = ''; ref.style.color = c; return getComputedStyle(ref).color; };
    const metin = coz('var(--text-primary)');
    let ezilen = 0;
    kok.querySelectorAll('.dr-body table td').forEach((td) => {
      const m = /(?:^|;)\s*color:\s*([^;]+)/.exec(td.getAttribute('style') || '');
      if (!m) return;
      const istenen = coz(m[1].trim());
      if (istenen !== metin && getComputedStyle(td).color !== istenen) ezilen++;
    });
    ref.remove();
    return { sutun, hucre, ters: [...new Set(ters)].slice(0, 12), ezilen };
  });
  // Tarama gerçekten bir şey ölçtü (vites geçişi tabloları tek başına ~1000 hücre)
  expect(r.sutun).toBeGreaterThan(30);
  expect(r.hucre).toBeGreaterThan(1000);
  expect(r.ters).toEqual([]);
  expect(r.ezilen).toBe(0);
});
