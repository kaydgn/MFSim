/**
 * mount-sihirbaz.spec.js — TAKOZ SİHİRBAZININ YERLEŞİMİ (gerçek tarayıcı)
 * ─────────────────────────────────────────────────────────────────────────
 * Tur 6 (2026-10-15) ölçümü, Tulga ile tohumlanmış sihirbaz, 1920×952:
 *   · özet adımında görünüş düğmeleri (Üstten · Yandan · Önden) yüzen panelin
 *     ALTINDAYDI — aynı köşe, aynı katman; üçü de tıklanamıyordu
 *   · özet masasının çizimi panelin altına giriyordu (Transfer Kutusu, Sağ Arka
 *     Takoz, bir braket)
 *   · takoz editöründe "Konum [mm]", "Statik [N/mm]", "Dinamik [N/mm]" iki
 *     satıra kırılıyordu (66 px'lik etiket sütunu, en uzunu 91 px)
 *   · motor kataloğunun yer tutucusu kutusuna sığmıyordu ("seç …")
 *   · özet başlığı "STATİK DENGE · 1 G" — yer çekimi ivmesi g, G oluyordu
 * Node'da koşamaz: yerleşim, `elementFromPoint`, `text-transform` ve seçicinin
 * yazısı ancak tarayıcıda ölçülür. Mantık tarafı:
 * tests/unit/mount-sihirbaz-doku.test.js.
 */
const { test, expect } = require('@playwright/test');
test.setTimeout(180000);

async function bootApp(page) {
  await page.setViewportSize({ width: 1920, height: 952 });
  await page.goto('/index.html');
  await page.evaluate(() => { if (window.MFSimLoader && MFSimLoader.start) MFSimLoader.start(); });
  await page.waitForFunction(() =>
    typeof window.createNode === 'function' && typeof window.veMntWizAc === 'function' &&
    typeof window.veMntOrnekYukle === 'function' && Array.isArray(window.nodes), null, { timeout: 90000 });
  await page.evaluate(() => { if (typeof veSelectModuleFromOverlay === 'function') veSelectModuleFromOverlay('arac-performans'); });
  await page.waitForFunction(() => {
    const s = document.getElementById('mfsim-loading-screen');
    return !s || s.style.display === 'none';
  }, null, { timeout: 90000 });
}

// Seçicinin GÖRÜNEN yazısı (seçili seçenek) kutusunun iç enine sığıyor mu
const SECICI = (kok) => {
  const cv = document.createElement('canvas').getContext('2d');
  return [...document.querySelectorAll(kok + ' select:not([multiple])')].filter((el) => el.offsetWidth).map((el) => {
    const cs = getComputedStyle(el), o = el.options[el.selectedIndex];
    cv.font = cs.fontStyle + ' ' + cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
    const w = cv.measureText(o ? o.textContent.trim() : '').width;
    const ic = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    return { metin: o ? o.textContent.trim() : '', tasma: Math.round((w - ic) * 10) / 10 };
  });
};

test('Takoz sihirbazı: etiket tek satır, özet düğmeleri ve çizimi panelin dışında, seçici yazısı sığıyor', async ({ page }) => {
  const hatalar = [];
  page.on('pageerror', (e) => hatalar.push(String(e)));
  await bootApp(page);
  await page.evaluate(() => {
    veMntOrnekYukle('tulga');
  });
  await page.waitForFunction(() => nodes.some((n) => n.type === 'mnt-solver'), null, { timeout: 20000 });
  const adimlar = await page.evaluate(() => { veMntWizAc(); return VE_MW_STEPS.map((s) => s.key); });

  const kirik = [], secici = [];
  for (let i = 0; i < adimlar.length; i++) {
    await page.evaluate((j) => veMntWizGoto(j), i);
    await page.waitForTimeout(400);
    // EDİTÖR ETİKETİ TEK SATIR: tek satırlık kopyasıyla aynı boyda
    (await page.evaluate(() => [...document.querySelectorAll('#ve-mw-yan .ve-fw-ed-alan > span:first-child')]
      .filter((sp) => sp.offsetWidth).map((sp) => {
        const c = sp.cloneNode(true);
        c.style.cssText = 'position:absolute; white-space:nowrap; visibility:hidden;';
        sp.parentNode.appendChild(c);
        const tek = c.getBoundingClientRect().height; c.remove();
        return { et: sp.textContent.trim(), h: sp.getBoundingClientRect().height, tek };
      }))).forEach((x) => { if (x.h > x.tek + 2) kirik.push(adimlar[i] + ': ' + x.et); });
    (await page.evaluate(SECICI, '#ve-mntwiz-overlay')).forEach((x) => {
      if (x.tasma > 0.5) secici.push(adimlar[i] + ': "' + x.metin + '" ' + x.tasma + ' px');
    });
  }
  expect.soft(kirik).toEqual([]);
  expect.soft(secici).toEqual([]);

  // ÖZET: düğmeler ve işaretler yüzen panelin DIŞINDA
  await page.evaluate((j) => veMntWizGoto(j), adimlar.indexOf('ozet'));
  await page.waitForTimeout(500);
  const oz = await page.evaluate(() => {
    const panel = document.getElementById('ve-mw-yan').getBoundingClientRect();
    const ortulen = [...document.querySelectorAll('#ve-mntwiz-overlay .ve-fw-masa-arac button, #ve-mntwiz-overlay .ve-fw-masa-gezin button')]
      .filter((b) => b.offsetWidth).filter((b) => {
        const r = b.getBoundingClientRect();
        const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return !(e === b || b.contains(e));
      }).map((b) => (b.textContent || b.getAttribute('aria-label')).trim());
    // işaretler: 3B'de (varsayılan, Canlı Not 37) çizimin parçaları, düz görünüşte seçilebilir işaretler
    const isaret = [...document.querySelectorAll('#ve-mw-masa-cizim [data-mnt-sec], #ve-mw-masa-cizim svg.ve-mnt2d-akso .ve-ak-hareket > g[data-ak]')];
    const altinda = isaret.filter((e) => {
      const r = e.getBoundingClientRect();
      return r.right > panel.left && r.left < panel.right && r.bottom > panel.top && r.top < panel.bottom;
    }).length;
    const bas = [...document.querySelectorAll('#ve-mw-yan .ve-fw-card-h span')].map((s) => s.innerText);
    return { ortulen, isaret: isaret.length, altinda, bas };
  });
  expect.soft(oz.ortulen).toEqual([]);
  expect(oz.isaret).toBeGreaterThan(5);
  expect.soft(oz.altinda).toBe(0);
  // Özet SONUÇ GÖSTERMEZ (2026-10-16): statik denge ve doğal frekans kartları yok
  expect.soft(oz.bas.map((x) => x.toLocaleLowerCase('tr'))).toEqual(['kurulacaklar', 'model']);
  // Görünüş düğmesi gerçekten çalışıyor (örtülmüş düğmenin tıklaması panele gidiyordu)
  await page.locator('#ve-mntwiz-overlay .ve-fw-masa-arac button', { hasText: 'Yandan' }).click();
  await expect(page.locator('#ve-mntwiz-overlay .ve-fw-masa-arac button', { hasText: 'Yandan' })).toHaveAttribute('aria-pressed', 'true');
  // 3B'ye dönüş: sürükleme döndürür (çizim değişir), kımıldamadan tık takozun satırını seçer
  await page.locator('#ve-mntwiz-overlay .ve-fw-masa-arac button', { hasText: '3B' }).click();
  await expect(page.locator('#ve-mw-akso svg.ve-mnt2d-akso')).toBeVisible();
  const once = await page.evaluate(() => document.querySelector('#ve-mw-akso svg.ve-mnt2d-akso').innerHTML.length + ':' + VE_MNT_AKSO3B.az);
  const sv = await page.locator('#ve-mw-akso svg.ve-mnt2d-akso').boundingBox();
  await page.mouse.move(sv.x + sv.width * 0.3, sv.y + sv.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(sv.x + sv.width * 0.3 + 120, sv.y + sv.height * 0.5 + 30, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => document.querySelector('#ve-mw-akso svg.ve-mnt2d-akso').innerHTML.length + ':' + VE_MNT_AKSO3B.az)).not.toBe(once);
  // görünen bir takoz (gövdenin ardındaki takozun ortasında gövde var: tık gövdeyi seçer)
  const tk = await page.evaluate(() => [...document.querySelectorAll('#ve-mw-akso svg.ve-mnt2d-akso g.ve-ak-t[data-ak]')].map((e) => {
    const r = e.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2, u = document.elementFromPoint(x, y);
    return { ak: e.getAttribute('data-ak'), x, y, gorunur: !!(u && e.contains(u)) };
  }).find((t) => t.gorunur));
  expect(tk).toBeTruthy();
  await page.mouse.click(tk.x, tk.y);
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => VE_MW_STEPS[_mwStep].key)).toBe('takoz');
  expect(await page.evaluate((ak) => !!document.querySelector('#ve-mw-akso svg.ve-mnt2d-akso g.ve-ak-t[data-sec][data-ak="' + ak + '"]'), tk.ak)).toBe(true);
  expect(hatalar).toEqual([]);
});

// 3B DÜZENİ (kullanıcı 2026-11-05, Canlı Not 40: *"Yazılar falan kayıyor,
// kutular birbirinin içine giriyor"*; 2026-11-06, Canlı Not 41: *"uzayan
// çubuklar … tüm yazılar çerçeveli değil"*). Node'da koşmayan halkalar: GERÇEK yazı
// kutuları (tarayıcının ölçtüğü genişlik), masanın şeridi ve düğmeleri (DOM'dan
// ölçülen örtü), tarayıcının boyadığı gövde (elementFromPoint) — ışın kâhini
// her noktada özgün kutuların en yakınını söyler. Birim tarafı:
// tests/unit/mount-akso.test.js → İÇ İÇE KUTU · RESSAM SIRASI · DIŞ YAZI.
// EYLEM ŞERİDİ (kullanıcı 2026-11-06, Canlı Not 58: *"ileri geri butonları çok gizli kalmış. Ayrıca
// çirkin duruyor. Onları güzel bir yere taşıyalım mı? Boyutlarını da ona göre ayarlayalım."*). Önce:
// 22 px'lik Kapat · Geri · İleri pencerenin dibindeki durum çubuğunun sağ köşesindeydi. Node'da
// koşmayan halkalar: şeridin sütunun dibine oturması (kısa sütunda) ve kaydırılırken görünür
// kalması (uzun sütunda), düğmelerin boyu, gerçek tıkla gezinme, özetin yüzen panelinde kurulum.
test('EYLEM ŞERİDİ: Geri · İleri girdilerin sütununun dibinde, 32 px; kısa sütunda dipte, uzun sütunda yapışık; özette Modeli kur', async ({ page }) => {
  const hatalar = [];
  page.on('pageerror', (e) => hatalar.push(String(e)));
  await bootApp(page);
  await page.evaluate(() => { veMntWizAc(); veMntWizOrnek('tulga'); });
  await page.waitForFunction(() => document.querySelector('#ve-mw-yan #ve-mw-eylem'), null, { timeout: 20000 });
  const olc = () => page.evaluate(() => {
    const y = document.getElementById('ve-mw-yan'), e = document.getElementById('ve-mw-eylem'), Y = y.getBoundingClientRect(), E = e.getBoundingClientRect();
    return { son: y.lastElementChild === e, alt: Math.round(Y.bottom - E.bottom), ust: E.top >= Y.top - 1,
      dugme: [...e.querySelectorAll('button')].map((b) => [b.textContent.trim(), Math.round(b.getBoundingClientRect().height)]),
      foot: !!document.getElementById('ve-mw-foot'), adim: document.querySelector('#ve-mw-nav .ve-fw-step.on .ve-fw-step-no').textContent };
  });
  // Canlı Not 78: Örnekten doldur'un gezinmesi listenin satırında (önce bir satır altta, 26 px)
  const gez = await page.evaluate(() => {
    const s = document.querySelector('#ve-mw-yan select[aria-label="Örnek"]').getBoundingClientRect();
    const n = document.querySelector('#ve-mw-yan .ve-fw-seednav').getBoundingClientRect();
    return { dikey: Math.round((n.top + n.bottom) / 2 - (s.top + s.bottom) / 2), sagda: n.left >= s.right };
  });
  expect(gez).toEqual({ dikey: 0, sagda: true });
  // Başlangıç: Geri yok, İleri satırın tamamı; şerit sütunun dibinde; alt çubuk yok
  let o = await olc();
  expect(o).toMatchObject({ son: true, ust: true, foot: false, adim: '1' });
  expect(Math.abs(o.alt)).toBeLessThanOrEqual(1);
  expect(o.dugme).toEqual([['İleri', 32]]);
  await page.click('#ve-mw-eylem .ve-mw-eylem-ileri');
  o = await olc();
  expect(o.adim).toBe('2');
  expect(o.dugme).toEqual([['Geri', 32], ['İleri', 32]]);
  // uzun sütun: kaydırılınca şerit görünür kalır (dipte, yapışık)
  await page.evaluate(() => veMntWizGoto(VE_MW_STEPS.findIndex((s) => s.key === 'takoz')));
  const uzun = await page.evaluate(() => {
    const y = document.getElementById('ve-mw-yan');
    y.scrollTop = 0;
    const once = [y.scrollHeight - y.clientHeight];
    const e = document.getElementById('ve-mw-eylem');
    const a = [Math.round(y.getBoundingClientRect().bottom - e.getBoundingClientRect().bottom)];
    y.scrollTop = 99999;
    a.push(Math.round(y.getBoundingClientRect().bottom - e.getBoundingClientRect().bottom));
    return { kay: once[0], alt: a };
  });
  expect(uzun.alt.every((v) => Math.abs(v) <= 1)).toBe(true);
  await page.click('#ve-mw-eylem .ve-mw-eylem-geri');
  expect((await olc()).adim).toBe('2');
  // Özet: yüzen panelin dibinde Geri · Modeli kur
  await page.evaluate(() => veMntWizGoto(VE_MW_STEPS.findIndex((s) => s.key === 'ozet')));
  o = await olc();
  expect(o.dugme).toEqual([['Geri', 32], ['Modeli kur', 32]]);
  expect(o.alt).toBe(5);                                              // yüzen panelin iç boşluğu (4 px) + çerçeve
  // Alt+→ ve Esc eskisi gibi
  await page.keyboard.press('Alt+ArrowLeft');
  expect((await olc()).adim).toBe('4');
  expect(hatalar).toEqual([]);
});

// Canlı Not 81 · 82 · 83 (kullanıcı 2026-11-09): "Arada bir boşluk var. Fazla satırlı bir boşluk
// o." · "Açıklamayı yana alalım." · "Açıklamaları düzeltelim, gereksiz açıklamaları kaldıralım."
// Önce (10 Ton TTA, 1920×952): Seçilen örnek'te künye ile tablonun arası 20 px (kartın aralığı
// 10 px, künyenin alt payı onu ikiye katlıyordu); STEP kartının yönlendirmesi düğmenin altında,
// ayrı satırda; adımların satırı 62 px (ad + iki satırlık açıklama).
// Canlı Not 96 (kullanıcı 2026-11-09: *"bu başlıklarda neler girildiği yazılsın. Böylesi de çok
// sade olmuş."*): adın altında adımda girilenlerin adları geri geldi — kısa ad listesi, satır
// en çok iki satırlık (adım ≤ 64 px), sözcük bölünmez.
test('BAŞLANGIÇ SÜTUNU: künye ile tablo arası kartın aralığı; yönlendirme düğmenin yanında; adımda ad ve girilenler', async ({ page }) => {
  const hatalar = [];
  page.on('pageerror', (e) => hatalar.push(String(e)));
  await bootApp(page);
  await page.evaluate(() => { veMntWizAc(); veMntWizOrnek('tta10'); });
  await page.waitForFunction(() => document.querySelector('#ve-mw-yan .ve-fw-exspec'), null, { timeout: 20000 });
  const o = await page.evaluate(() => {
    const r = (el) => el.getBoundingClientRect();
    const not = r(document.querySelector('#ve-mw-yan .ve-fw-exnote')), tab = r(document.querySelector('#ve-mw-yan .ve-fw-exspec'));
    const kart = r(document.querySelector('#ve-mw-yan .ve-fw-exspec').closest('.ve-fw-card'));
    const btn = r(document.querySelector('#ve-mw-yan .ve-fw-stp-sec')), yon = r(document.querySelector('#ve-mw-yan .ve-fw-stp-yon'));
    const stp = r(document.querySelector('#ve-mw-yan .ve-fw-stp').closest('.ve-fw-card'));
    return {
      arasi: Math.round(tab.top - not.bottom), dip: Math.round(kart.bottom - tab.bottom),
      yonYanda: yon.left >= btn.right && yon.top < btn.bottom && yon.bottom > btn.top,
      yonOrtasi: Math.round((yon.top + yon.bottom) / 2 - (btn.top + btn.bottom) / 2),
      stpKart: Math.round(stp.height),
      girdi: [...document.querySelectorAll('#ve-mw-nav .ve-fw-step-t em')].map((e) => Math.round(r(e).height / parseFloat(getComputedStyle(e).lineHeight))),
      adimBoy: [...document.querySelectorAll('#ve-mw-nav .ve-fw-step')].map((li) => Math.round(r(li).height)),
    };
  });
  expect(o.arasi).toBe(10);
  expect(o.yonYanda).toBe(true);
  expect(Math.abs(o.yonOrtasi)).toBeLessThanOrEqual(1);
  expect(o.girdi.length).toBe(5);                                     // beş adımın beşinde
  expect(o.girdi.every((n) => n >= 1 && n <= 2)).toBe(true);          // en çok iki satır
  expect(o.adimBoy.every((h) => h <= 64)).toBe(true);
  expect(hatalar).toEqual([]);
});

test('3B DÜZENİ: Asfat, üç bakış — her yazı çip; çip çipe ve örtüye binmez; kılavuz kısa, kesişmez; boyanan gövde ışının en yakını', async ({ page }) => {
  await bootApp(page);
  await page.setViewportSize({ width: 1500, height: 856 });
  await page.evaluate(() => { const n = createNode('mount-analysis', 400, 300); veMntOpenEditor(n.id); veMntWizAc(); });
  await page.waitForTimeout(300);
  await page.evaluate(() => veMntWizOrnek('asfat'));
  await page.waitForTimeout(800);
  for (const kam of [null, { az: 135, el: 30 }, { az: 270, el: 25 }]) {
    const s = await page.evaluate((kam) => {
      if (kam) { VE_MNT_AKSO3B.az = kam.az; VE_MNT_AKSO3B.el = kam.el; veMntWizRender(); }
      const sv = document.querySelector('#ve-mw-akso svg.ve-mnt2d-akso'), sb = sv.getBoundingClientRect();
      const C = _mntAksoCizim['ve-mw-akso'];
      const kutu = (r) => ({ l: r.left - sb.left, t: r.top - sb.top, r: r.right - sb.left, b: r.bottom - sb.top });
      const kes = (a, b) => Math.min(a.r, b.r) - Math.max(a.l, b.l) > 0.5 && Math.min(a.b, b.b) - Math.max(a.t, b.t) > 0.5;
      const icte = (q, P) => { let a = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, yi] = P[i], [xj, yj] = P[j]; if (((yi > q[1]) !== (yj > q[1])) && (q[0] < (xj - xi) * (q[1] - yi) / (yj - yi) + xi)) a = !a; } return a; };
      const segKes = (s, q) => { const d = (p0, p1, p2) => (p1[0] - p0[0]) * (p2[1] - p0[1]) - (p1[1] - p0[1]) * (p2[0] - p0[0]); const a = [s[0], s[1]], b = [s[2], s[3]], c = [q[0], q[1]], e = [q[2], q[3]]; return d(c, e, a) * d(c, e, b) < -1e-6 && d(a, b, c) * d(a, b, e) < -1e-6; };
      const icinden = (s, k) => { for (let i = 1; i < 30; i++) { const x = s[0] + (s[2] - s[0]) * i / 30, y = s[1] + (s[3] - s[1]) * i / 30; if (x > k.l + 1 && x < k.r - 1 && y > k.t + 1 && y < k.b - 1) return true; } return false; };
      // gövdelerin çokgenleri (SVG koordinatı = sayfa px, çizim 1:1)
      const pol = {};
      sv.querySelectorAll('.ve-ak-hareket g.ve-ak-g').forEach((g) => { g.querySelectorAll('path').forEach((pa) => { const v = pa.getAttribute('d').replace(/[MLZ]/g, ' ').trim().split(/\s+/).map(Number), o = []; for (let i = 0; i + 1 < v.length; i += 2) o.push([v[i], v[i + 1]]); (pol[g.getAttribute('data-ak')] = pol[g.getAttribute('data-ak')] || []).push(o); }); });
      // yazılar: gövde ve takoz yazısı (G ve eksen üçlüsü hariç), gerçek kutusuyla
      const yazi = [...sv.querySelectorAll(':scope > g[data-ak]')].filter((g) => g.querySelector('text') && g.getAttribute('data-ak') !== 'G')
        .map((g) => ({ k: g.getAttribute('data-ak'), b: kutu(g.getBoundingClientRect()) }));
      // kılavuz kırık çizgi (path) — parçalarına ayrılır
      const kil = [];
      sv.querySelectorAll('path.ve-ak-kilavuz, line.ve-ak-kilavuz').forEach((l) => {
        const k = l.getAttribute('data-ak'), v = l.tagName === 'line' ? ['x1', 'y1', 'x2', 'y2'].map((a) => +l.getAttribute(a)) : l.getAttribute('d').replace(/[ML]/g, ' ').trim().split(/\s+/).map(Number);
        for (let i = 0; i + 3 < v.length; i += 2) kil.push({ k, s: [v[i], v[i + 1], v[i + 2], v[i + 3]] });
      });
      const masa = document.getElementById('ve-mw-masa');
      const ortu = [...masa.querySelectorAll('.ve-fw-masa-ust > *, .ve-fw-masa-arac, .ve-fw-masa-gezin')].map((e) => kutu(e.getBoundingClientRect()));
      const t = { yazi: yazi.length, cercevesiz: 0, kilEn: 0, yaziYazi: 0, ortu: 0, kesisen: 0, icinden: 0, piksel: 0, yanlis: 0 };
      sv.querySelectorAll(':scope > g[data-ak]').forEach((g) => { if (g.querySelector('text') && !g.classList.contains('ve-ak-cip')) t.cercevesiz++; });
      const boy = {}; kil.forEach((a) => { boy[a.k] = (boy[a.k] || 0) + Math.hypot(a.s[2] - a.s[0], a.s[3] - a.s[1]); });
      t.kilEn = Math.max(0, ...Object.values(boy));
      yazi.forEach((e, i) => {
        if (ortu.some((o) => kes(e.b, o))) t.ortu++;
        yazi.forEach((f, j) => { if (j > i && kes(e.b, f.b)) t.yaziYazi++; });
      });
      kil.forEach((a, i) => {
        kil.forEach((b, j) => { if (j > i && segKes(a.s, b.s)) t.kesisen++; });
        yazi.forEach((f) => { if (f.k !== a.k && icinden(a.s, f.b)) t.icinden++; });
      });
      // boyanan gövde: yalnız gövde grupları görünür kalır — yazının kırık kılavuzu (path, Canlı Not 41)
      // da gizlenir: gövdenin üstünden geçen kılavuz "yanlış boyama" sayılıyordu
      sv.querySelectorAll('text, line, circle, rect, .ve-ak-kilavuz, .ve-ak-t, .ve-ak-gam, .ve-ak-izg, .ve-ak-gol, .ve-ak-gdus, .ve-ak-giz, .ve-ak-sim').forEach((e) => { e.style.visibility = 'hidden'; });
      const yon = veMntAkso.kamYon(C.o.kam), d = [-yon[0], -yon[1], -yon[2]], l = Math.hypot(d[0], d[1]);
      const rr = [d[1] / l, -d[0] / l, 0], uu = [rr[1] * d[2] - rr[2] * d[1], rr[2] * d[0] - rr[0] * d[2], rr[0] * d[1] - rr[1] * d[0]], F = C.F;
      const K0 = C.m.govde.filter((g) => g.kutu).map((g) => ({ k: g.k, lo: [g.x - g.kutu[0] / 2, g.y - g.kutu[1] / 2, g.z - g.kutu[2] / 2], hi: [g.x + g.kutu[0] / 2, g.y + g.kutu[1] / 2, g.z + g.kutu[2] / 2] }));
      const kahin = (X, Y) => { const a = (X - F.ox) / F.sc, b = -(Y - F.oy) / F.sc, p0 = [0, 1, 2].map((i) => rr[i] * a + uu[i] * b); let en = null, et = Infinity;
        K0.forEach((q) => { let t0 = -Infinity, t1 = Infinity; for (let i = 0; i < 3; i++) { if (Math.abs(d[i]) < 1e-12) { if (p0[i] < q.lo[i] || p0[i] > q.hi[i]) t0 = Infinity; continue; } let x = (q.lo[i] - p0[i]) / d[i], y = (q.hi[i] - p0[i]) / d[i]; if (x > y) [x, y] = [y, x]; t0 = Math.max(t0, x); t1 = Math.min(t1, y); } if (t1 > t0 && t0 < et) { et = t0; en = q.k; } });
        return en; };
      for (let Y = 4; Y < sb.height - 4; Y += 5) for (let X = 4; X < sb.width - 4; X += 5) {
        const k = kahin(X, Y); if (!k) continue;
        if ([[-3, 0], [3, 0], [0, -3], [0, 3]].some(([dx, dy]) => kahin(X + dx, Y + dy) !== k)) continue;
        t.piksel++;
        const u = document.elementFromPoint(sb.left + X, sb.top + Y), g = u && u.closest ? u.closest('g.ve-ak-g') : null;
        if (!g || g.getAttribute('data-ak') !== k) t.yanlis++;
      }
      veMntWizRender();
      return t;
    }, kam);
    expect({ kam, cercevesiz: s.cercevesiz, yaziYazi: s.yaziYazi, ortu: s.ortu, kesisen: s.kesisen, icinden: s.icinden })
      .toEqual({ kam, cercevesiz: 0, yaziYazi: 0, ortu: 0, kesisen: 0, icinden: 0 });
    expect(s.kilEn).toBeLessThan(170);                                // kısa kırık kılavuz (eski: 238 px)
    expect(s.yazi).toBeGreaterThanOrEqual(7);
    expect(s.piksel).toBeGreaterThan(800);
    expect(s.yanlis / s.piksel).toBeLessThan(0.0015);                 // atılan 8 mm'lik dilim payı
  }
});
