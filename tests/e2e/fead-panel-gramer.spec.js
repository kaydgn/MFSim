/**
 * fead-panel-gramer.spec.js — PANEL İLE TABLO AYNI GRAMERİ KONUŞUYOR MU?
 * ──────────────────────────────────────────────────────────────────────
 *
 * ÖLÇÜLEN KUSUR (2026-09-22): aynı modülün iki yüzeyi iki ayrı alan grameri
 * konuşuyordu — ve kullanıcı panele TABLODAN geçiyor (satırdaki ad düğmesi):
 *
 *            Kayış Tablosu          Kasnak paneli
 *   etiket   ÜSTTE                  SOLDA
 *   türetilen OYUK zemin            YÜKSELEN zemin   ← ters işaret
 *   ayrım    zemin                  saç teli ızgara  ← "hesap sayfası"
 *
 * Üçüncüsü sessiz bir TERS İŞARETTİ: okunur değer, yazılabilir olandan daha
 * ÖNDE duruyordu; ayrımın tek taşıyıcısı zemin olduğu için bunu hiçbir şey
 * söylemiyordu.
 *
 * Bu halkalar Node'da koşamaz: jsdom kaskaddan `background-color` hesaplamaz,
 * `:has()` değerlendirmez ve `scrollWidth`i hep 0 döndürür.
 */
const { test, expect } = require('@playwright/test');

// Kurulum FEAD spec'lerinin kanıtlanmış yolunu izler (`fead-tablo.spec.js`):
// dev sunucusu + `MFSimLoader.start()` + modül seçimi. Kart kanvasta olduğu
// için düğümü doğrudan kurmak, karşılama akışını taklit etmekten sağlam.
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

// Kasnağın panelini KULLANICININ yolundan açar: Kayış Tablosu'ndaki ad
// düğmesi. İkinci bir yol yok — kasnakların kanvasta kutusu da yok.
async function kasnakPaneliAc(page) {
  await bootApp(page);
  await page.evaluate(() => { const n = createNode('fead-analysis', 400, 300); veFeadOpenEditor(n.id); });
  await page.waitForTimeout(300);
  await page.evaluate(() => { if (typeof veFeadWizClose === 'function') veFeadWizClose(false); });
  await page.waitForTimeout(200);
  await page.evaluate(() => veFeadLoadExample('AG00976_GATES_2025'));
  await page.waitForFunction(() => window.nodes.some((n) => n.type === 'fead-table'),
    null, { timeout: 20000 });
  const kart = page.locator('.ve-fead-table-card').first();
  await expect(kart.locator('.ve-fead-krt[data-ve-node]')).toHaveCount(6);
  await kart.locator('.ve-fead-tbl-name').first().click();
  await expect(page.locator('#ve-properties-overlay')).toBeVisible();
  await page.waitForTimeout(400);
}

test('panel alanı ile tablo alanı AYNI gramer — etiket üstte, aynı tipografi', async ({ page }) => {
  await kasnakPaneliAc(page);
  const r = await page.evaluate(() => {
    const oku = (el) => {
      if (!el) return null;
      const cs = getComputedStyle(el);
      return { yon: cs.flexDirection, font: cs.fontFamily, punto: cs.fontSize,
               buyuk: cs.textTransform, renk: cs.color };
    };
    const pf = document.querySelector('.ve-fp-f');
    const pl = pf && pf.querySelector('.ve-fp-l');
    const tf = document.querySelector('.ve-fead-krt-fld');
    const tl = tf && tf.querySelector('i');
    return { panelAlan: oku(pf), panelEtiket: oku(pl), tabloAlan: oku(tf), tabloEtiket: oku(tl) };
  });

  expect(r.panelAlan).not.toBeNull();
  expect(r.tabloAlan).not.toBeNull();
  // ETİKET ÜSTTE: ikisi de sütun akışı
  expect(r.panelAlan.yon).toBe('column');
  expect(r.tabloAlan.yon).toBe('column');
  // AYNI TİPOGRAFİ: iki yüzey arasında geçen kullanıcı aynı dili okur
  expect(r.panelEtiket.font).toBe(r.tabloEtiket.font);
  expect(r.panelEtiket.punto).toBe(r.tabloEtiket.punto);
  expect(r.panelEtiket.buyuk).toBe(r.tabloEtiket.buyuk);
  expect(r.panelEtiket.renk).toBe(r.tabloEtiket.renk);
});

test('TÜRETİLEN değer OYUK zeminde — tablonun çözüm bölgesiyle aynı yüzey', async ({ page }) => {
  await kasnakPaneliAc(page);
  const r = await page.evaluate(() => {
    const jeton = (ad) => getComputedStyle(document.documentElement).getPropertyValue(ad).trim();
    const ro = document.querySelector('.ve-fp-inp[readonly]');
    const yaz = document.querySelector('.ve-fp-inp:not([readonly])');
    const coz = document.querySelector('.ve-fead-krt > .coz');
    const hex = (h) => { h = h.trim(); return h; };
    const rgb = (c) => {
      const d = document.createElement('div'); d.style.color = c;
      document.body.appendChild(d); const v = getComputedStyle(d).color; d.remove(); return v;
    };
    return {
      turetilen: ro ? getComputedStyle(ro).backgroundColor : null,
      yazilabilir: yaz ? getComputedStyle(yaz).backgroundColor : null,
      tabloCoz: coz ? getComputedStyle(coz).backgroundColor : null,
      oyukJeton: rgb(hex(jeton('--bg-tertiary'))),
      yukselenJeton: rgb(hex(jeton('--bg-secondary'))),
    };
  });

  expect(r.turetilen).not.toBeNull();
  // Panelin türetilen değeri = tablonun çözüm bölgesi = OYUK jeton
  expect(r.turetilen).toBe(r.oyukJeton);
  expect(r.tabloCoz).toBe(r.oyukJeton);
  // ve YÜKSELEN zemin DEĞİL — kapatılan ters işaret bu
  expect(r.turetilen).not.toBe(r.yukselenJeton);
  // yazılabilir alandan da ayrışıyor
  expect(r.turetilen).not.toBe(r.yazilabilir);
});

test('etiket, denetiminin yaslandığı KENARA yaslanıyor', async ({ page }) => {
  await kasnakPaneliAc(page);
  const r = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('.ve-fp-f').forEach((f) => {
      const l = f.querySelector('.ve-fp-l');
      const d = f.querySelector('.ve-fp-inp, .ve-fp-sel');
      if (!l || !d) return;
      const hiza = getComputedStyle(d).textAlign;
      const yasla = getComputedStyle(l).justifyContent;
      const bekle = (hiza === 'right') ? 'flex-end' : 'flex-start';
      if (yasla !== bekle) out.push(`${l.textContent.trim().slice(0, 18)} → denetim ${hiza}, etiket ${yasla}`);
    });
    return out;
  });
  expect(r).toEqual([]);
});

// AÇILIR LİSTE KIRPILMIYOR — kural CSS metninden buraya taşındı. Eskiden
// "taban + esneme + tavan"lı bir sütun oranıyla çözülüyordu çünkü etiket aynı
// satırda yer istiyordu; etiket üste çıkınca liste alanın tamamını alıyor.
// Ölçülen şey oran değil KIRPILMANIN KENDİSİ.
test('açılır listenin metni kırpılmıyor', async ({ page }) => {
  await kasnakPaneliAc(page);
  const kirpik = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('.ve-fp-sel').forEach((s) => {
      // seçili seçeneğin metnini ölç: kabın içine sığıyor mu
      const ol = document.createElement('span');
      const cs = getComputedStyle(s);
      ol.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;'
        + 'font:' + cs.font;
      ol.textContent = s.options[s.selectedIndex] ? s.options[s.selectedIndex].text : '';
      document.body.appendChild(ol);
      const gerek = ol.getBoundingClientRect().width;
      ol.remove();
      const alan = s.getBoundingClientRect().width
        - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - 18; // ok payı
      if (gerek > alan) out.push(`"${ol.textContent}" gerek ${Math.round(gerek)} / alan ${Math.round(alan)}`);
    });
    return out;
  });
  expect(kirpik).toEqual([]);
});
