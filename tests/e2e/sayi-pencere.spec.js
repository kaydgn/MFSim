/**
 * sayi-pencere.spec.js — PENCERELERDE TÜRKÇE SAYI (karar 7·C, aşama 2c)
 * ─────────────────────────────────────────────────────────────────────
 *
 * ÖLÇÜLEN KUSUR (2026-09-27): üç modülün 55 penceresinde görünen yazı,
 * `title` ve tuvale çizilen yazı içinde 311 noktalı ondalık ("0.5361 × ESL",
 * "r=0.37m") ve 246 gruplanmamış 4+ haneli sayı ("1100 Nm @ 1400") vardı.
 * `toFixed` tarayıcısı (sayi-dili.test.js) bunların bir kısmını görür;
 * DOĞRUDAN birleştirilen sayı ("+ preset.maxOutputSpeed +") ve elle yazılmış
 * özet metni hiçbir kaynak taramasına görünmez. Bu halka ekranı ölçer.
 *
 * Bu tarama 2b yapısında 371 bulguyla düşüyor (araç 311 · FEAD 41 · takoz
 * 19), 2c'de 0 — ölçüldü, MFSIM_OLCUM_HTML ile eski yapı verilerek.
 *
 * AD OLAN SAYI KALIR ve sınıflandırılır: şanzıman modeli (Allison 3200 SP),
 * parça numarası (AMC 137963, 57RS…), ön ayar adı (Duramax 6.6L, Wabco
 * 250cc @8.5bar), formül sabiti (P × 9550 / n), standart (ISO 9981), tarih,
 * bölüm numarası. Sınıfa girmeyen her eşleşme düşürür ve penceresiyle birlikte
 * adıyla söylenir; muaf tutulanlar da çevresiyle basılır.
 *
 * Node'da koşamaz: pencereler gerçek veriyle ve tuvalleriyle kuruluyor.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const BUILD = process.env.MFSIM_OLCUM_HTML || path.join(__dirname, '../..', 'MFSim_Code.html');
test.beforeAll(() => {
  if (!fs.existsSync(BUILD)) throw new Error('MFSim_Code.html yok. Önce: npm run build');
});
test.setTimeout(240000);

const MODULLER = {
  'arac-performans': {
    ornek: "let ex = nodes.find((x) => x.type === 'ap-example'); if (!ex) ex = createNode('ap-example', 300, 200);"
         + " ex.data = ex.data || {}; ex.data.exampleKey = 'isb340_tc411'; veApLoadExample(ex.id);",
    tip: "(t) => !/^(mnt-|fead-)/.test(t)",
  },
  'mount-analysis': {
    ornek: "let ex = nodes.find((x) => x.type === 'mnt-example'); if (!ex) ex = createNode('mnt-example', 300, 200);"
         + " ex.data = ex.data || {}; ex.data.exampleKey = 'tulga'; veMntLoadExample(ex.id);",
    tip: "(t) => /^mnt-/.test(t)",
  },
  'fead-analysis': {
    ornek: "if (typeof veFeadWizClose === 'function') veFeadWizClose(false); veFeadLoadExample('AG00976_GATES_2025');",
    tip: "(t) => /^fead-/.test(t)",
  },
};

// Ölçüt tek yerde: tests/helpers/sayi-olcu.js (belge taraması da onu kullanır).
// Ekrandaki sondaki yüzde ('97,0%') ayrı aşamada çevrilecek; burada henüz ölçülmüyor.
const { NOKTA, GRUPSUZ, sinifla } = require('../helpers/sayi-olcu.js');

for (const [modul, M] of Object.entries(MODULLER)) {
  test(`${modul}: pencerelerde noktalı ondalık ve gruplanmamış sayı YOK (adlar hariç)`, async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1032 });
    await page.addInitScript(() => {
      const f = CanvasRenderingContext2D.prototype.fillText;
      CanvasRenderingContext2D.prototype.fillText = function (t) {
        if (window.__olcKayit) window.__olcFill.push(String(t));
        return f.apply(this, arguments);
      };
    });
    page.on('dialog', (d) => d.accept());
    await page.goto('file://' + BUILD);
    await page.fill('#mfsim-login-password', 'mfsim2024');
    await page.press('#mfsim-login-password', 'Enter');
    await page.waitForSelector('#mfsim-loading-screen', { state: 'hidden', timeout: 90000 });
    await page.click(`.ve-module-card[data-module="${modul}"]`);
    await page.waitForSelector('#mfsim-module-loading', { state: 'hidden', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(800);
    await page.evaluate(M.ornek);
    await page.waitForTimeout(3500);

    const tipler = await page.evaluate(`(() => { const on = ${M.tip};
      Object.keys(componentDefs).filter((t) => on(t) && !componentDefs[t].isSubsystem && !/wizard$/.test(t))
        .forEach((t, i) => { if (!nodes.some((n) => n.type === t)) { try { createNode(t, 200 + (i % 8) * 90, 700 + Math.floor(i / 8) * 90); } catch (e) {} } });
      return [...new Set(nodes.map((n) => n.type))]; })()`);
    expect(tipler.length).toBeGreaterThan(8);          // tarama gerçekten bir şey açtı

    const sorun = [], adlar = {};
    let taranan = 0;
    for (const tip of tipler) {
      const metin = await page.evaluate(async (tip) => {
        const n = nodes.find((x) => x.type === tip);
        window.__olcFill = []; window.__olcKayit = true;
        clearSelection(); addToSelection(n); veTogglePropertiesPanel(true);
        await new Promise((r) => setTimeout(r, 500));
        const ic = document.querySelector('.ve-properties-content');
        const sekmeler = [...ic.querySelectorAll('.ve-fp-tab')].map((t) => t.getAttribute('data-k'));
        const parca = [], gor = new Set();
        const ekle = (a) => { if (a && !gor.has(a)) { gor.add(a); parca.push(a); } };
        for (const k of (sekmeler.length ? sekmeler : [null])) {
          if (k) { veFeadPanelTab(n.id, k); await new Promise((r) => setTimeout(r, 80)); }
          const tw = document.createTreeWalker(ic, NodeFilter.SHOW_TEXT);
          let t; while ((t = tw.nextNode())) { const p = t.parentElement; if (p && !p.closest('script,style')) ekle(t.nodeValue); }
          ic.querySelectorAll('[title]').forEach((e) => ekle(e.getAttribute('title')));
        }
        window.__olcKayit = false;
        window.__olcFill.forEach(ekle);
        veTogglePropertiesPanel(false); await new Promise((r) => setTimeout(r, 200));
        return parca.join('\n');
      }, tip);
      taranan += metin.length;
      for (const re of [NOKTA, GRUPSUZ]) {
        re.lastIndex = 0;
        let m;
        while ((m = re.exec(metin))) {
          const bag = metin.slice(Math.max(0, m.index - 30), m.index + m[0].length + 20).replace(/\s+/g, ' ');
          const ad = sinifla(m[0], bag);
          if (ad) (adlar[ad] = adlar[ad] || new Set()).add(bag.trim());
          else sorun.push(`${tip}: "${m[0]}" ⟨${bag.trim()}⟩`);
        }
      }
    }
    // Muaf tutulan her eşleşme çevresiyle basılır: sınıf listesi bir kaçış
    // kapısı olmasın, neyin ad sayıldığı koşuda okunabilsin.
    console.log(modul, 'taranan', taranan, 'karakter · ad olarak kalan:');
    for (const [ad, s] of Object.entries(adlar)) console.log('  ' + ad + ' (' + s.size + '): ' + [...s].join(' ‖ '));
    expect(taranan).toBeGreaterThan(5000);
    expect(sorun).toEqual([]);
  });
}
