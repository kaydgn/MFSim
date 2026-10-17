/**
 * mufettis-sutun.spec.js — ÖZELLİK PENCERESİ GENİŞ EKRANDA SÜTUN MU?
 * ──────────────────────────────────────────────────────────────────
 *
 * ÖLÇÜLEN KUSUR (2026-09-22): bileşen özellikleri ekranın ORTASINDA, %60
 * karartmalı bir perdenin üstünde açılıyordu. Bir sayı girmek modeli gözden
 * kaybettiriyor, girilen sayının modeli nasıl değiştirdiğini görmek pencereyi
 * KAPATMAYI gerektiriyordu. Atölye kalıbında müfettiş tuvalin YANINDADIR.
 *
 * Bu halkaların hiçbiri Node'da koşamaz: jsdom `@media` sorgusunu
 * değerlendirmez, `:has()` hesaplamaz, `getBoundingClientRect` hep 0 döner ve
 * `pointer-events`in tıklamayı gerçekten geçirdiği ancak gerçek bir tıklamayla
 * ölçülür.
 */
const { test, expect } = require('@playwright/test');

const GENIS = 1600;   // sütun kipi
const DAR = 1100;     // modal kipi (eşik 1280)

async function bootApp(page, w) {
  await page.setViewportSize({ width: w, height: 900 });
  await page.goto('/index.html');
  await page.evaluate(() => { if (window.MFSimLoader && MFSimLoader.start) MFSimLoader.start(); });
  await page.waitForFunction(() =>
    typeof window.createNode === 'function' && typeof window.veTogglePropertiesPanel === 'function' &&
    Array.isArray(window.nodes), null, { timeout: 90000 });
  await page.evaluate(() => {
    if (typeof veSelectModuleFromOverlay === 'function') veSelectModuleFromOverlay('arac-performans');
  });
  // Ertelenmiş modüller yüklenene kadar bekle — `createNode` içeriden
  // `updateNodeHandles`i çağırıyor ve o daha geç geliyor.
  await page.waitForFunction(() =>
    typeof window.updateNodeHandles === 'function' && typeof window.addToSelection === 'function',
  null, { timeout: 90000 });
  // AÇILIŞ EKRANI ÇEKİLENE KADAR BEKLE. Ölçüldü: perdesi hâlâ üstteyken
  // `elementFromPoint` tuvalin merkezinde `#mfsim-loading-photo` döndürüyor —
  // "tıklama tuvale geçiyor mu" sorusunu ölçen halka açılış ekranını ölçer.
  await page.waitForFunction(() => {
    const s = document.getElementById('mfsim-loading-screen');
    return !s || s.style.display === 'none' || getComputedStyle(s).display === 'none';
  }, null, { timeout: 90000 });
  await page.waitForTimeout(400);
}

// Paneli KULLANICININ yolundan açar: kanvasta bir bileşen seç.
// SÜTUNDA KALAN bir pencere. Bu yardımcı AYNI tuzağa iki kez düştü: önce
// MOTOR'u açıyordu (boş penceresini ölçüyordu — veriyle dolu motor 380 px'e
// 185 px sığmıyor), sonra ARAÇ'ı. İkisi de ölçümle `VE_SUTUNA_SIGMAYAN`a girdi
// ve halka sütunu değil MODALI ölçmeye başladı — ölçülen: perde
// rgba(0,0,0,.62). Öncül artık açık bir iddia: tip listeye girerse test
// sebebini söyleyerek düşer, perde renginden bulmaca çıkmaz.
const SUTUN_TIPI = 'differential';
async function panelAc(page, tip) {
  await page.evaluate((tip) => {
    if (VE_SUTUNA_SIGMAYAN.indexOf(tip) >= 0)
      throw new Error(tip + ' modal açılıyor (VE_SUTUNA_SIGMAYAN) — sütunda kalan bir tip seçin');
    const n = createNode(tip, 400, 300);
    clearSelection(); addToSelection(n);
  }, tip || SUTUN_TIPI);
  // Seçim ile AÇMA arasına nefes: modülün açılış yüzeyi yerleşiyor.
  await page.waitForTimeout(500);
  await page.evaluate(() => veTogglePropertiesPanel(true));
  await page.waitForFunction(() =>
    document.getElementById('ve-properties-overlay').classList.contains('visible'),
  null, { timeout: 10000 });
  await page.waitForTimeout(350);
}

test('GENİŞ ekranda müfettiş bir SÜTUN — perde yok, tuval daralıyor, örtmüyor', async ({ page }) => {
  await bootApp(page, GENIS);
  // ÇİZİM YÜZEYİ `.ve-split-container` — `.ve-canvas-area`nın `clientWidth`i
  // DOLGUYU İÇERİR, yani `padding-right` ile daralmayı HİÇ göstermez (ölçüldü:
  // müfettiş açıkken de kapalıyken de 1316). Yanlış ölçü, çalışan bir düzeni
  // "bozuk" gösterdi.
  const kapali = await page.evaluate(() =>
    Math.round(document.getElementById('ve-split-container').getBoundingClientRect().width));
  await panelAc(page);

  const r = await page.evaluate(() => {
    const ov = document.getElementById('ve-properties-overlay');
    const pn = document.querySelector('.ve-properties');
    const ar = document.querySelector('.ve-canvas-area');
    const cs = getComputedStyle(ov);
    const pr = pn.getBoundingClientRect();
    return {
      perde: cs.backgroundColor,
      tiklamaGecer: cs.pointerEvents,
      panelTiklanir: getComputedStyle(pn).pointerEvents,
      sag: Math.round(pr.right), genislik: Math.round(pr.width), ust: Math.round(pr.top),
      tuvalAcik: Math.round(document.getElementById('ve-split-container').getBoundingClientRect().width),
      tuvalSagKenar: Math.round(document.getElementById('ve-split-container').getBoundingClientRect().right),
      bandAlti: Math.round(document.getElementById('ve-ribbon').getBoundingClientRect().bottom),
      ekran: window.innerWidth,
    };
  });

  // PERDE YOK — model görünür kalır
  expect(r.perde).toMatch(/rgba\(0,\s*0,\s*0,\s*0\)|transparent/);
  // Tıklama tuvale geçer, panelin kendisi tıklanabilir kalır
  expect(r.tiklamaGecer).toBe('none');
  expect(r.panelTiklanir).toBe('auto');
  // Sağ kenara yaslı, tam boy, bandın ALTINDAN başlıyor
  expect(r.sag).toBe(r.ekran);
  expect(r.genislik).toBe(380);
  expect(Math.abs(r.ust - r.bandAlti)).toBeLessThanOrEqual(1);
  // TUVAL DARALDI — sütun modeli ÖRTMÜYOR. İkisi de aynı jetondan.
  expect(kapali - r.tuvalAcik).toBe(380);
  expect(r.tuvalSagKenar).toBeLessThanOrEqual(r.sag - r.genislik + 1);
});

test('GENİŞ ekranda müfettiş açıkken TUVAL hâlâ tıklanabilir', async ({ page }) => {
  await bootApp(page, GENIS);
  await panelAc(page);

  // PERDELİ modalde bu noktanın sahibi overlay'in KENDİSİYDİ (inset:0 ile
  // ekranın tamamını kaplıyordu) ve oraya yapılan tıklama pencereyi kapatırdı.
  const sahip = await page.evaluate(() => {
    const k = document.getElementById('ve-split-container').getBoundingClientRect();
    const el = document.elementFromPoint(Math.round(k.left + k.width / 2), Math.round(k.top + k.height / 2));
    return {
      overlayMi: !!(el && el.closest('#ve-properties-overlay')),
      tuvaldeMi: !!(el && el.closest('.ve-canvas-area')),
    };
  });
  expect(sahip.overlayMi).toBe(false);
  expect(sahip.tuvaldeMi).toBe(true);

  // Ve GERÇEK bir tıklama tuvale İŞ YAPTIRIYOR. İki dünyayı ayıran ölçü bu:
  // perdeli modalde aynı tıklama perdenin `onmousedown`una düşer, pencere
  // kapanır ve SEÇİM OLDUĞU GİBİ KALIR. Sütun kipinde tıklama tuvale ulaşır ve
  // seçimi boşaltır; pencere AÇIK KALIR (aşağıdaki *KALIR* halkası).
  const oncesi = await page.evaluate(() => selectedNodes.length);
  const k = await page.evaluate(() => {
    const r = document.getElementById('ve-split-container').getBoundingClientRect();
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
  });
  await page.mouse.click(k.x, k.y);
  await page.waitForTimeout(400);
  const sonrasi = await page.evaluate(() => selectedNodes.length);
  expect(oncesi).toBe(1);
  expect(sonrasi).toBe(0);
});

// ══ PENCERE AÇIK KALIR — kapatma ✕ ve Esc'te (kullanıcı isteği 2026-10-16) ══
// "Bileşen pencerelerine çift tıklayınca yanda açılan pencere kalsın, boşluğa
// veya başka bir yere tıklayınca gitmesin. Başka bir bileşene tıklayınca da
// onun penceresi gelecek." Ölçülen eski hâl (AP örneği, 1920×952): boş alana
// tık, başka bileşene tek tık (sütun ya da modal tipi) ve Ctrl+Z pencereyi
// kapatıyor, tuval 1.256 → 1.636 px zıplıyordu. Halka GERÇEK fareyle yürür;
// mekanizması tests/unit/mufettis-kalir.test.js'te.
test('KALIR — boş alana ve başka bileşene tık pencereyi kapatmaz, içerik yerinde değişir', async ({ page }) => {
  await bootApp(page, GENIS);
  const kim = await page.evaluate(() => {
    const a = createNode('differential', 400, 260), b = createNode('propshaft', 620, 260), m = createNode('engine', 400, 460);
    clearSelection();
    if (typeof veFitViewToContent === 'function') veFitViewToContent({ maxZoom: 1 });
    return { a: a.id, b: b.id, m: m.id };
  });
  await page.waitForTimeout(600);
  const merkez = (id) => page.evaluate((id) => {
    const r = document.getElementById(id).getBoundingClientRect();
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
  }, id);
  const durum = () => page.evaluate(() => {
    const ov = document.getElementById('ve-properties-overlay');
    return {
      acik: ov.classList.contains('visible') && getComputedStyle(ov).display !== 'none',
      baslik: document.getElementById('ve-properties-title').textContent.trim(),
      modal: document.getElementById('ve-properties').classList.contains('ve-properties--modal'),
      kart: !!document.querySelector('.ve-properties-content .ve-prop-genis'),
      perde: getComputedStyle(ov).backgroundColor,
      secili: selectedNodes.length,
      tuvalW: Math.round(document.getElementById('ve-split-container').getBoundingClientRect().width),
      kapanis: window.__kapanis || 0,
    };
  });
  const bosNokta = () => page.evaluate(() => {
    const k = document.getElementById('ve-split-container').getBoundingClientRect();
    for (let fy = 0.1; fy < 0.95; fy += 0.05) for (let fx = 0.05; fx < 0.95; fx += 0.05) {
      const x = k.left + k.width * fx, y = k.top + k.height * fy, el = document.elementFromPoint(x, y);
      if (el && el.closest('.ve-canvas-area') && !el.closest('.ve-node, button, .ve-minimap, [class*="minimap"]')) return { x: Math.round(x), y: Math.round(y) };
    }
    return null;
  });
  const tik = async (id, cift) => {
    const m = await merkez(id);
    if (cift) await page.mouse.dblclick(m.x, m.y); else await page.mouse.click(m.x, m.y);
    await page.waitForTimeout(450);
  };

  await tik(kim.a, true);
  const ilk = await durum();
  expect(ilk.acik).toBe(true);
  expect(ilk.baslik).toContain('Diferansiyel');
  // Bundan sonra pencerenin bir kez bile kapanması sayılır.
  await page.evaluate(() => {
    window.__kapanis = 0;
    const ov = document.getElementById('ve-properties-overlay');
    new MutationObserver(() => { if (!ov.classList.contains('visible')) window.__kapanis++; })
      .observe(ov, { attributes: true, attributeFilter: ['class'] });
  });

  // 1 · boş alana tık: seçim boşalır, pencere ve tuval yerinde, konu işaretli
  const b = await bosNokta();
  expect(b).not.toBeNull();
  await page.mouse.click(b.x, b.y);
  await page.waitForTimeout(450);
  const bos = await durum();
  expect(bos).toMatchObject({ acik: true, secili: 0, tuvalW: ilk.tuvalW, kapanis: 0 });
  expect(bos.baslik).toContain('Diferansiyel');
  expect(await page.evaluate((id) => document.getElementById(id).classList.contains('ve-node--mufettis'), kim.a)).toBe(true);

  // 2 · başka bileşene tek tık: içerik yerinde değişir
  await tik(kim.b);
  const baska = await durum();
  expect(baska).toMatchObject({ acik: true, kapanis: 0, tuvalW: ilk.tuvalW });
  expect(baska.baslik).toContain('Propşaft');

  // 3 · yazılmış ama onaylanmamış değer, başka bileşene geçince KAYBOLMAZ
  const alan = await page.evaluate(() => {
    const g = [...document.querySelectorAll('.ve-properties-content input[inputmode="decimal"]')]
      .find((x) => x.offsetParent && !x.readOnly && !x.disabled && x.id && x.getAttribute('onchange'));
    if (!g) return null;
    g.scrollIntoView({ block: 'center' });
    const r = g.getBoundingClientRect();
    return { id: g.id, x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
  });
  expect(alan).not.toBeNull();
  await page.mouse.click(alan.x, alan.y);
  await page.keyboard.press('Control+a');
  await page.keyboard.type('7,25');
  await tik(kim.a);
  expect((await durum()).baslik).toContain('Diferansiyel');
  await tik(kim.b);
  expect(await page.evaluate((id) => document.getElementById(id).value, alan.id)).toBe('7.25');

  // 4 · sütuna sığmayan bileşen (motor): tek tık sütunda KART — perde yok, tuval yerinde
  await tik(kim.m);
  const kart = await durum();
  expect(kart).toMatchObject({ acik: true, kart: true, modal: false, tuvalW: ilk.tuvalW, kapanis: 0 });
  // çift tık geniş pencereyi açar, Esc sütuna (karta) döner, ikinci Esc kapatır
  await tik(kim.m, true);
  const genis = await durum();
  expect(genis).toMatchObject({ acik: true, modal: true, kart: false });
  expect(genis.perde).not.toMatch(/rgba\(0,\s*0,\s*0,\s*0\)|transparent/);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  expect(await durum()).toMatchObject({ acik: true, modal: false, kart: true });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  expect((await durum()).acik).toBe(false);

  // 5 · Ctrl+Z pencereyi kapatmaz
  await tik(kim.a, true);
  await page.mouse.click(b.x, b.y);
  await page.waitForTimeout(300);
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(500);
  expect((await durum()).acik).toBe(true);

  // 6 · başka sayfada gizli, dönünce yerinde
  await page.evaluate(() => veSubTabDegistir('sonuclar'));
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => getComputedStyle(document.getElementById('ve-properties-overlay')).display)).toBe('none');
  await page.evaluate(() => veSubTabDegistir('arac-performans'));
  await page.waitForTimeout(500);
  expect((await durum()).acik).toBe(true);
});

// ══ KONU KENDİ PENCERESİNİN ALTINDA KALMAZ ══
// Sütun tuvali sağdan daraltır, kamera yerinde durur. Ölçülen eski hâl (AP
// örneği isb340_tc411): sütun açılınca 1366×768'de 17 bileşenin 6'sı, 1920×952'de
// 4'ü onun altına düşüyordu — sağdaki tekerleğe çift tık tekerleği kendi
// penceresinin altına sokuyordu. Mekanizma: tests/unit/mufettis-kalir.test.js.
test('KADRAJ — sütun açılınca konusu onun altında kalmaz, ölçek değişmez', async ({ page }) => {
  await bootApp(page, GENIS);
  const kim = await page.evaluate(() => {
    const a = createNode('differential', 400, 260), b = createNode('propshaft', 620, 260);
    clearSelection();
    if (typeof veFitViewToContent === 'function') veFitViewToContent({ maxZoom: 1 });
    // b tuvalin sağ kenarına: sütun kapalıyken tam görünür
    const w = document.getElementById('ve-canvas-wrapper').getBoundingClientRect();
    canvasOffset.x += (w.right - 40) - document.getElementById(b.id).getBoundingClientRect().right;
    updateCanvasTransform();
    return { a: a.id, b: b.id };
  });
  await page.waitForTimeout(300);
  const olc = (id) => page.evaluate((id) => {
    const r = document.getElementById(id).getBoundingClientRect(), w = document.getElementById('ve-canvas-wrapper').getBoundingClientRect();
    return { sol: r.left, sag: r.right, kapSol: w.left, kapSag: w.right, zoom: canvasZoom, x: canvasOffset.x, y: canvasOffset.y };
  }, id);
  const once = await olc(kim.b);
  expect(once.sag).toBeLessThanOrEqual(once.kapSag);
  const m = { x: Math.round((once.sol + once.sag) / 2), y: await page.evaluate((id) => {
    const r = document.getElementById(id).getBoundingClientRect(); return Math.round(r.top + r.height / 2); }, kim.b) };
  await page.mouse.dblclick(m.x, m.y);
  await page.waitForTimeout(450);
  const sonra = await olc(kim.b);
  expect(await page.evaluate(() => document.documentElement.classList.contains('ve-mufettis-acik'))).toBe(true);
  expect(sonra.kapSag).toBeLessThan(once.kapSag - 300);          // tuval gerçekten daraldı
  expect(sonra.sag).toBeLessThanOrEqual(sonra.kapSag);           // konu görünür alanda
  expect(sonra.sol).toBeGreaterThanOrEqual(sonra.kapSol);
  expect(Math.abs(sonra.kapSag - 24 - sonra.sag)).toBeLessThan(1.5);   // yalnız gereken kadar
  expect(sonra.zoom).toBe(once.zoom);
  expect(sonra.y).toBe(once.y);
  // Kapanış kamerayı geri oynatmaz; görünen konuya çift tık kamerayı oynatmaz.
  await page.keyboard.press('Escape');
  await page.waitForTimeout(350);
  const kapali = await olc(kim.a);
  expect(kapali.x).toBe(sonra.x);
  const a = await page.evaluate((id) => { const r = document.getElementById(id).getBoundingClientRect();
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; }, kim.a);
  await page.mouse.dblclick(a.x, a.y);
  await page.waitForTimeout(450);
  expect((await olc(kim.a)).x).toBe(sonra.x);
});

test('DAR ekranda modal davranış BİREBİR duruyor', async ({ page }) => {
  await bootApp(page, DAR);
  const kapali = await page.evaluate(() =>
    Math.round(document.getElementById('ve-split-container').getBoundingClientRect().width));
  await panelAc(page);
  const r = await page.evaluate(() => {
    const ov = document.getElementById('ve-properties-overlay');
    const pn = document.querySelector('.ve-properties').getBoundingClientRect();
    return {
      perde: getComputedStyle(ov).backgroundColor,
      tiklama: getComputedStyle(ov).pointerEvents,
      ortaliMi: Math.abs((pn.left + pn.right) / 2 - window.innerWidth / 2) <= 2,
      tuvalAcik: Math.round(document.getElementById('ve-split-container').getBoundingClientRect().width),
    };
  });
  expect(r.perde).not.toMatch(/rgba\(0,\s*0,\s*0,\s*0\)|transparent/);   // PERDE VAR
  expect(r.tiklama).not.toBe('none');
  expect(r.ortaliMi).toBe(true);                                          // ORTADA duruyor
  expect(r.tuvalAcik).toBe(kapali);                                       // tuval DARALMADI
});
