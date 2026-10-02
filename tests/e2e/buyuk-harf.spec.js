/**
 * buyuk-harf.spec.js — BÜYÜK HARF DÖNÜŞÜMÜ BİRİMİ, SİMGEYİ VE ÖZEL ADI BOZMAZ
 * ─────────────────────────────────────────────────────────────────────────
 *
 * ÖLÇÜLEN KUSUR (Tur 5, 2026-10-02): `text-transform:uppercase` taşıyan
 * etiketler içlerindeki HER harfi çeviriyordu ve belge `lang="tr"`:
 *   · birim   "[Nm]" → "[NM]", "[d/dk]" → "[D/DK]", "[kg·m²]" → "[KG·M²]"
 *   · simge   "Oluklu μ" → "OLUKLU Μ" (Yunan büyük mü — Latin M gibi okunur)
 *   · özel ad "MFSim" → "MFSİM", "Artifact" → "ARTİFACT", "Shift" → "SHİFT"
 *
 * Node'da koşamaz: jsdom `text-transform`u uygulamaz; `innerText` ise
 * gerçek tarayıcıda dönüşümü YANSITIR — ölçü odur. Üreticinin kuralı
 * (`_feadEtiket`) `tests/unit/fead-panel-dili.test.js` → *"BÜYÜK HARF"*.
 */
const { test, expect } = require('@playwright/test');

async function bootApp(page) {
  await page.goto('/index.html');
  await page.evaluate(() => { if (window.MFSimLoader && MFSimLoader.start) MFSimLoader.start(); });
  await page.waitForFunction(() =>
    typeof window.createNode === 'function' && typeof window.veFeadOpenEditor === 'function' &&
    Array.isArray(window.nodes), null, { timeout: 90000 });
  await page.evaluate(() => {
    if (typeof veSelectModuleFromOverlay === 'function') veSelectModuleFromOverlay('arac-performans');
  });
  await page.waitForFunction(() => {
    const s = document.getElementById('mfsim-loading-screen');
    return !s || s.style.display === 'none';
  }, null, { timeout: 90000 });
}

// Etiketin metnindeki her köşeli parantezli birim ve her Yunan harfi,
// EKRANDA (innerText) aynı harflerle durmalı.
const BOZULAN = () => {
  const out = [];
  document.querySelectorAll('.ve-fp-l').forEach((l) => {
    if (!l.offsetWidth) return;
    const ham = l.textContent, gorunen = l.innerText;
    (ham.match(/\[[^\]]+\]/g) || []).forEach((b) => { if (gorunen.indexOf(b) < 0) out.push(gorunen.trim()); });
    (ham.match(/[µͰ-Ͽ]/g) || []).forEach((g) => { if (gorunen.indexOf(g) < 0) out.push(gorunen.trim()); });
  });
  return out;
};

test('FEAD pencereleri: birim ve Yunan harfi büyük harfe dönmüyor — bütün tipler, bütün sekmeler', async ({ page }) => {
  test.setTimeout(120000);
  await bootApp(page);
  await page.evaluate(() => { const n = createNode('fead-analysis', 400, 300); veFeadOpenEditor(n.id); });
  await page.waitForTimeout(300);
  await page.evaluate(() => { if (typeof veFeadWizClose === 'function') veFeadWizClose(false); });
  await page.evaluate(() => veFeadLoadExample('AG00976_GATES_2025'));
  await page.waitForFunction(() => window.nodes.filter((n) => n.type === 'fead-layout').length === 2,
    null, { timeout: 20000 });

  const r = await page.evaluate(async (BZ) => {
    const bozulan = new Function('return (' + BZ + ')()');
    const gor = new Set(), out = []; let etiket = 0, birim = 0;
    for (const n of nodes) {
      const k = n.type + (n.data && n.data.driver ? ':s' : '');
      if (gor.has(k) || (componentDefs[n.type] || {}).isSubsystem) continue;
      gor.add(k);
      clearSelection(); addToSelection(n); veTogglePropertiesPanel(true);
      await new Promise((r) => setTimeout(r, 300));
      const ic = document.querySelector('.ve-properties-content');
      const sek = ic ? [...ic.querySelectorAll('.ve-fp-tab')].map((t) => t.getAttribute('data-k')) : [];
      for (const s of (sek.length ? sek : [null])) {
        if (s) { veFeadPanelTab(n.id, s); await new Promise((r) => setTimeout(r, 80)); }
        etiket += [...document.querySelectorAll('.ve-fp-l')].filter((l) => l.offsetWidth).length;
        birim += [...document.querySelectorAll('.ve-fp-l u')].filter((l) => l.offsetWidth).length;
        bozulan().forEach((b) => out.push(n.type + ': ' + b));
      }
      veTogglePropertiesPanel(false);
      await new Promise((r) => setTimeout(r, 150));
    }
    return { out: [...new Set(out)], etiket, birim };
  }, BOZULAN.toString());
  expect(r.out).toEqual([]);
  expect(r.etiket).toBeGreaterThan(100);        // süpürme gerçekten ölçüyor
  expect(r.birim).toBeGreaterThan(20);

  // Sihirbazın Kayış adımı sürtünme kartını basar: "Oluklu μ" · "Sırt μ".
  const s = await page.evaluate(async (BZ) => {
    veFeadWizOpenAny(); veFeadWizSeed('AG00976_GATES_2025');
    await new Promise((r) => setTimeout(r, 600));
    veFeadWizGoto(VE_FW_STEPS.findIndex((x) => x.key === 'kayis'));
    await new Promise((r) => setTimeout(r, 600));
    const mu = [...document.querySelectorAll('#ve-feadwiz-overlay .ve-fp-l')].map((l) => l.innerText.trim());
    return { bozulan: new Function('return (' + BZ + ')()')(), mu };
  }, BOZULAN.toString());
  expect(s.bozulan).toEqual([]);
  expect(s.mu.filter((t) => /μ/.test(t)).length).toBe(2);
});

test('özel ad kendi dilinde büyür: MFSim · Artifact · Shift', async ({ page }) => {
  test.setTimeout(120000);
  await bootApp(page);
  // Program Arşivi küme başlıkları
  await page.evaluate(() => veProgramArsiviOpen());
  await page.waitForTimeout(500);
  const arsiv = await page.evaluate(() => document.getElementById('ve-programlar').innerText);
  expect(arsiv).not.toMatch(/MFSİM|ARTİFACT/);
  expect(arsiv).toMatch(/MFSIM ÜRÜNLERİ/);
  await page.evaluate(() => veProgramArsiviClose());

  // Araç Performans: çözücü rozeti ve Şanzıman Kontrol başlığı
  await page.evaluate(() => {
    window.confirm = () => true;
    let ex = nodes.find((x) => x.type === 'ap-example'); if (!ex) ex = createNode('ap-example', 300, 200);
    ex.data = ex.data || {}; ex.data.exampleKey = 'isb340_tc411'; veApLoadExample(ex.id);
  });
  await page.waitForFunction(() => nodes.some((n) => n.type === 'shift-controller'), null, { timeout: 20000 });
  const metin = async (tip) => page.evaluate(async (t) => {
    const n = nodes.find((x) => x.type === t);
    clearSelection(); addToSelection(n); veTogglePropertiesPanel(true);
    await new Promise((r) => setTimeout(r, 400));
    const s = document.querySelector('.ve-properties-content').innerText;
    veTogglePropertiesPanel(false);
    return s;
  }, tip);
  const vites = await metin('shift-controller');
  expect(vites).not.toMatch(/SHİFT/);
  expect(vites).toMatch(/SHIFT SCHEDULE/);
  const cozucu = await metin('solver');
  expect(cozucu).not.toMatch(/MFSİM/);
});
