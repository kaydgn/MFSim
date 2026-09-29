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
// düğmesi. Tablo 2026-09-26'dan beri Kayış Yolu kartının KATMANI (Pafta):
// geometri ön ayarlı kartta çizimin altında hep açık, düğmeye basmak gerekmez.
// (Öbür yol çizimdeki kasnağa tıklamak — `fead-cizim-masasi.spec.js`.)
async function kasnakPaneliAc(page) {
  await bootApp(page);
  await page.evaluate(() => { const n = createNode('fead-analysis', 400, 300); veFeadOpenEditor(n.id); });
  await page.waitForTimeout(300);
  await page.evaluate(() => { if (typeof veFeadWizClose === 'function') veFeadWizClose(false); });
  await page.waitForTimeout(200);
  await page.evaluate(() => veFeadLoadExample('AG00976_GATES_2025'));
  await page.waitForFunction(() => window.nodes.filter((n) => n.type === 'fead-layout').length === 2,
    null, { timeout: 20000 });
  const tablo = page.locator('.ve-fead-pafta');
  await expect(tablo.locator('tr[data-ve-node]')).toHaveCount(6);
  await tablo.locator('.ve-fead-tbl-name').first().click();
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
    // Tablonun etiketi SÜTUN BAŞI: değerin üstünde, sütun başına bir kez.
    const tl = document.querySelector('.ve-fead-pafta th.k-x');
    const td = document.querySelector('.ve-fead-pafta tr[data-ve-node] td.k-x');
    const ust = tl && td ? { baslikAlt: tl.getBoundingClientRect().bottom,
                             degerUst: td.getBoundingClientRect().top } : null;
    return { panelAlan: oku(pf), panelEtiket: oku(pl), tabloEtiket: oku(tl), ust };
  });

  expect(r.panelAlan).not.toBeNull();
  expect(r.tabloEtiket).not.toBeNull();
  // ETİKET ÜSTTE: panelde sütun akışı, tabloda başlık satırı değerin üstünde
  expect(r.panelAlan.yon).toBe('column');
  expect(r.ust.baslikAlt).toBeLessThanOrEqual(r.ust.degerUst + 0.5);
  // AYNI TİPOGRAFİ: iki yüzey arasında geçen kullanıcı aynı dili okur
  expect(r.panelEtiket.font).toBe(r.tabloEtiket.font);
  expect(r.panelEtiket.punto).toBe(r.tabloEtiket.punto);
  expect(r.panelEtiket.buyuk).toBe(r.tabloEtiket.buyuk);
  expect(r.panelEtiket.renk).toBe(r.tabloEtiket.renk);
});

test('TÜRETİLEN değer OYUK zeminde — tablonun çözüm sütunlarıyla aynı yüzey', async ({ page }) => {
  await kasnakPaneliAc(page);
  const r = await page.evaluate(() => {
    const jeton = (ad) => getComputedStyle(document.documentElement).getPropertyValue(ad).trim();
    const ro = document.querySelector('.ve-fp-inp[readonly]');
    const yaz = document.querySelector('.ve-fp-inp:not([readonly])');
    const coz = document.querySelector('.ve-fead-pafta tr[data-ve-node] td.cz');
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
  // Panelin türetilen değeri = tablonun çözüm sütunu = OYUK jeton
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
  // HER SEKME GEZİLİR, YALNIZ GÖRÜNEN LİSTE ÖLÇÜLÜR: gizli sekmedeki listenin
  // genişliği 0 ve "alan −41" diye kırpık SAYILIYORDU (ölçüldü: sürücünün
  // Motor ve Çevrim sekmeleri 2026-09-28'de gelince üç sahte bulgu). Açılış
  // sekmesini ölçmek de yetmezdi — yeni sekmelerin listeleri hiç ölçülmezdi.
  const r = await page.evaluate(async () => {
    const out = [];
    let olculen = 0;
    const kap = document.querySelector('#ve-properties-overlay .ve-fp-tabs[id^="ve-fp-tabs-"]');
    const id = kap.id.slice('ve-fp-tabs-'.length);
    const sekmeler = [...kap.querySelectorAll('.ve-fp-tab')].map((t) => t.getAttribute('data-k'));
    for (const k of sekmeler) {
      veFeadPanelTab(id, k);
      await new Promise((ok) => setTimeout(ok, 60));
      document.querySelectorAll('#ve-properties-overlay .ve-fp-sel').forEach((s) => {
        if (!s.offsetWidth) return;
        olculen++;
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
        if (gerek > alan) out.push(`${k}: "${ol.textContent}" gerek ${Math.round(gerek)} / alan ${Math.round(alan)}`);
      });
    }
    return { out, olculen, sekme: sekmeler.length };
  });
  expect(r.sekme).toBe(4);                        // sürücü: Geometri · Rol · Motor · Çevrim
  expect(r.olculen).toBeGreaterThanOrEqual(4);    // temas · motor · düzen · çevrim kaydı
  expect(r.out).toEqual([]);
});

// ═══════════════════════════════════════════════════════════════════════════
// PENCERE DÜZENİ (2026-09-23) — kullanıcı: "Hizalamalar, şekiller şukullar
// hep kaymış." İki halka da jsdom'da koşamaz: metnin gerçek sol kenarı
// (`Range.getBoundingClientRect`) ve bir yazının kayış çizgisinin ÜSTÜNDE
// olup olmadığı (`isPointInStroke`) yalnız yerleşim motorunda var.
// (Üçüncü halka özet şeridinin çiplerini ölçüyordu; şerit aynı gün kullanıcı
// kararıyla KALKTI — yokluğunun kapısı fead-pencere-ailesi.test.js.)
// ═══════════════════════════════════════════════════════════════════════════

test('TEK SOL KENAR — bütün sekmelerde etiket denetiminin sol kenarında başlıyor', async ({ page }) => {
  await kasnakPaneliAc(page);
  const r = await page.evaluate(() => {
    const out = []; let olculen = 0;
    const kok = document.querySelector('#ve-properties-overlay');
    const sekmeler = [...kok.querySelectorAll('.ve-fp-tab')];
    const id = (kok.querySelector('[id^="ve-fp-tabs-"]') || { id: '' }).id.replace('ve-fp-tabs-', '');
    sekmeler.forEach((b) => {
      veFeadPanelTab(id, b.getAttribute('data-k'));
      kok.querySelectorAll('.ve-fp-f').forEach((f) => {
        if (f.closest('[hidden]')) return;
        const l = f.querySelector('.ve-fp-l'), d = f.querySelector('.ve-fp-inp, .ve-fp-sel');
        if (!l || !d) return;
        const rg = document.createRange(); rg.selectNodeContents(l);
        const m = rg.getBoundingClientRect();
        if (!m.width) return;
        olculen++;
        const dx = m.left - d.getBoundingClientRect().left;
        if (Math.abs(dx) > 1.5) out.push(l.textContent.trim().slice(0, 20) + ' ' + Math.round(dx) + ' px');
      });
    });
    return { out, olculen, sekme: sekmeler.length };
  });
  expect(r.sekme).toBeGreaterThanOrEqual(2);
  expect(r.olculen).toBeGreaterThan(10);          // BOŞA ÇALIŞMIYOR
  // Eski hâl: sayı alanlarının etiketi SAĞA yaslıydı — "Dış çap (OD) 52 px".
  expect(r.out).toEqual([]);
});

// "KAYIŞ YOLUNDAKİ YERİ" KÜÇÜK RESMİ KALKTI (2026-09-28, kullanıcı isteği:
// *"her bileşende bulunan 'Kayış Yolundaki Yeri' kısmını da kaldıralım"*).
// Onu ölçen halka (vurgu · ad çakışması · kayışa binme) konusuz kaldı;
// yokluğunun kapısı fead-pencere-ailesi.test.js.

// SERVİS FAKTÖRÜ c₂ TABLOSU İKİ YÜZEYDE AYNI ÇİZİLİYOR (2026-09-29, kural 48).
// Kayış penceresi (Tasarım) ile sihirbazın Kayış adımı aynı üreticiyi basıyor
// (`veFeadServisTabloHTML`), ama pencerenin genel tablo kuralları tabloya da
// giriyordu: `.ve-properties-content th, td { padding:5px 8px !important }` ile
// daha özgül `table th` (zemin, sola yaslama, sağ kenarlık). Ölçülen hâl:
// pencerede 44 px'lik sütunda saat başlığına 28 px kalıyor ve "10–16" iki
// satıra kırılıyordu, başlıklar gri ve sola yaslıydı, hücre düğmesi 16 px
// daralıyordu; sihirbazda hiçbiri yoktu. Ölçü: aynı öğe sınıfının hesaplanan
// biçimi iki yüzeyde aynı, başlık tek satır, düğme hücreyi dolduruyor.
test('c₂ tablosu kayış penceresinde ve sihirbazda AYNI çiziliyor', async ({ page }) => {
  page.on('dialog', (d) => d.accept());
  await kasnakPaneliAc(page);
  await page.evaluate(() => {
    window.__c2Olc = (kok) => {
      const t = kok && kok.querySelector('[data-ve="servis-tablo"] table');
      if (!t || !t.offsetWidth) return null;
      const TH = ['paddingLeft', 'paddingRight', 'backgroundColor', 'textAlign', 'fontWeight', 'borderRightWidth', 'textTransform'];
      const TD = ['paddingLeft', 'paddingRight', 'paddingTop', 'paddingBottom'];
      const imza = {};
      const ekle = (ad, sec, alan) => t.querySelectorAll(sec).forEach((e) => {
        const c = getComputedStyle(e);
        (imza[ad] = imza[ad] || new Set()).add(alan.map((k) => c[k]).join(' '));
      });
      ekle('köşe', 'th.ve-fead-c2-kose', TH);
      ekle('grup', 'th.ve-fead-c2-grup', TH);
      ekle('saat', 'th.ve-fead-c2-saat', TH);
      ekle('yük', 'tbody th', TH);
      ekle('hücre', 'td', TD);
      const satir = (e) => { const rg = document.createRange(); rg.selectNodeContents(e);
        return new Set([...rg.getClientRects()].filter((x) => x.width > 1).map((x) => Math.round(x.top))).size; };
      const out = {}; Object.keys(imza).forEach((k) => { out[k] = [...imza[k]]; });
      return {
        imza: out,
        kirik: [...t.querySelectorAll('th.ve-fead-c2-saat')].filter((e) => satir(e) > 1).map((e) => e.textContent),
        bosluk: Math.max(...[...t.querySelectorAll('td')].map((td) => td.clientWidth - td.querySelector('button').offsetWidth)),
        hucre: t.querySelectorAll('td button').length,
      };
    };
  });
  const pencere = await page.evaluate(async () => {
    veFeadKayisAc();
    await new Promise((r) => setTimeout(r, 400));
    veFeadPanelTab(nodes.find((n) => n.type === 'fead-belt').id, 'tas');
    await new Promise((r) => setTimeout(r, 150));
    return window.__c2Olc(document.querySelector('#ve-properties-overlay'));
  });
  const sihirbaz = await page.evaluate(async () => {
    veTogglePropertiesPanel(false);
    await new Promise((r) => setTimeout(r, 300));
    const wz = nodes.find((n) => n.type === 'fead-wizard');
    veFeadWizOpen(wz ? wz.id : null);
    veFeadWizSeed('AG00976_GATES_2025');
    veFeadWizGoto(VE_FW_STEPS.findIndex((s) => s.key === 'kayis'));
    await new Promise((r) => setTimeout(r, 500));
    return window.__c2Olc(document.querySelector('#ve-feadwiz-overlay'));
  });
  expect(pencere && pencere.hucre).toBe(24);
  expect(sihirbaz && sihirbaz.hucre).toBe(24);
  expect(pencere.kirik).toEqual([]);
  expect(sihirbaz.kirik).toEqual([]);
  expect(pencere.bosluk).toBeLessThanOrEqual(1);
  expect(sihirbaz.bosluk).toBeLessThanOrEqual(1);
  expect(pencere.imza).toEqual(sihirbaz.imza);
});
