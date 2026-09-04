/**
 * fead-wizard-tablo.spec.js — KASNAK TABLOSU SIĞAR (gerçek tarayıcı)
 *
 * Kullanıcı bildirimi (2026-09-02): *"kasnakları tablo halinde girdiğimiz
 * yerin tablosu böyle yana kaydırmalı olmuş… Bazı sütunlar çok geniş olmuş.
 * Onları düzelterek, bu tablonun fit olmasını sağlayalım."*
 *
 * ÖLÇÜLDÜ (düzeltmeden önce, 1280×900, AG00976 örneği): kapsayıcı 873 px,
 * tablo 1058 px → 185 px taşma. Sütunlar 46 · 132 · 134 · 134 · 134 · 134 ·
 * 132 · 134 · 78. Yani genişlik İÇERİKLE İLGİSİZDİ: "263" yazan X ile
 * "Klima Kompresörü" yazan Ad ikisi de 134 px alıyordu.
 *
 * Birim testin tuttuğu şey YAPISAL koşul (sabit yerleşim + %100 toplam);
 * jsdom düzen hesaplamadığı için TAŞMANIN KENDİSİ ancak burada ölçülebilir.
 * `table-layout:fixed` CSS'ten düşerse birim test bunu göremez — bu dosya görür.
 */
const { test, expect } = require('@playwright/test');

test.setTimeout(180000);

async function kasnakAdimi(page, genislik) {
  await page.setViewportSize({ width: genislik, height: 900 });
  await page.goto('/index.html');
  await page.evaluate(() => { if (window.MFSimLoader && window.MFSimLoader.start) window.MFSimLoader.start(); });
  await page.waitForFunction(() => typeof window.createNode === 'function' &&
    typeof window.veFeadOpenEditor === 'function' && typeof window.veFeadWizOpen === 'function',
    null, { timeout: 60000 });
  await page.evaluate(() => { if (typeof veSelectModuleFromOverlay === 'function') veSelectModuleFromOverlay('arac-performans'); });
  await page.waitForFunction(() => { const s = document.getElementById('mfsim-loading-screen'); return !s || s.style.display === 'none'; },
    null, { timeout: 60000 });
  await page.evaluate(() => { const n = createNode('fead-analysis', 400, 300); veFeadOpenEditor(n.id); });
  await page.waitForFunction(() => window.nodes.some((n) => n.type === 'fead-wizard'), null, { timeout: 20000 });
  await page.evaluate(() => {
    const w = window.nodes.find((n) => n.type === 'fead-wizard');
    veFeadWizOpen(w.id);
    veFeadWizSeed('AG00976_GATES_2025');    // altı kasnak + gergi satırı
    veFeadWizGoto(1);                        // 0-tabanlı: "2. Kasnaklar"
  });
  return page.evaluate(() => {
    const tbl = [...document.querySelectorAll('#ve-feadwiz-overlay .ve-fw-tbl')]
      .find((t) => /Sürücü/.test(t.querySelector('thead').textContent));
    const wrap = tbl.closest('.ve-fw-tblwrap');
    const ths = [...tbl.querySelectorAll('thead th')];
    return {
      kapsayici: Math.round(wrap.clientWidth),
      tablo: Math.round(tbl.getBoundingClientRect().width),
      tasma: wrap.scrollWidth - wrap.clientWidth,
      satir: tbl.querySelectorAll('tbody tr').length,
      // nowrap + sabit genişlik: sığmayan başlık SESSİZCE kırpılırdı.
      kirpik: ths.filter((th) => th.scrollWidth > th.clientWidth + 1).map((th) => th.textContent.trim()),
      sutun: ths.map((th) => ({ ad: th.textContent.trim() || '(ops)', px: Math.round(th.getBoundingClientRect().width) }))
    };
  });
}

// Üç genişlik: kullanıcının resmindeki (1280), modalın tavana dayandığı
// (1600 — kapsayıcı büyümez, modal max-width 1180) ve dar bir dizüstü (1100).
for (const w of [1280, 1600, 1100]) {
  test(w + 'px görünümde tablo SIĞIYOR — yatay kaydırma yok', async ({ page }) => {
    const r = await kasnakAdimi(page, w);
    console.log(w + 'px → ' + JSON.stringify(r));

    expect(r.satir).toBeGreaterThan(1);            // kasnaklar + gergi satırı
    expect(r.tasma).toBe(0);                       // ASIL KAPI
    expect(r.tablo).toBeLessThanOrEqual(r.kapsayici);
    expect(r.kirpik).toEqual([]);                  // hiçbir başlık kesilmiyor
    // Sayı sütunları metin sütunlarından DAR olmalı — eski kusur tam da
    // hepsinin eşitlenmesiydi.
    const px = (ad) => r.sutun.find((s) => s.ad === ad).px;
    expect(px('X [mm]')).toBeLessThan(px('Ad'));
    expect(px('Y [mm]')).toBeLessThan(px('Tip'));
    expect(px('Sürücü')).toBeLessThan(px('Ø OD [mm]'));
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// KOL OKU İKİ YÜZEYDE DE AYNI DİL (gerçek tarayıcı)
//
// Kullanıcı bildirimi (2026-09-04): *"'özet ve kurulum' kısmındaki diyagramda
// belirlediğimiz nokta görünmüyor."* ÖLÇÜLDÜ: nokta çiziliyordu, ama
//   seçici : 3 px düz çizgi + dolu üçgen uç
//   şema   : 1,6 px KESİKLİ, %85 saydam, OK UCU YOK
// 56 öğelik bir şemada ikincisi tanınmıyordu. Kapı, iki yüzeyin AYNI
// üreticiden (`veFeadArmArrowSVG`) geçtiğini HESAPLANMIŞ renk ve dolu uçla
// ölçüyor — sınıf adıyla değil.
async function sahne(page) {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/index.html');
  await page.evaluate(() => { if (window.MFSimLoader && window.MFSimLoader.start) window.MFSimLoader.start(); });
  await page.waitForFunction(() => typeof window.createNode === 'function' &&
    typeof window.veFeadOpenEditor === 'function' && typeof window.veFeadWizOpen === 'function',
    null, { timeout: 60000 });
  await page.evaluate(() => { if (typeof veSelectModuleFromOverlay === 'function') veSelectModuleFromOverlay('arac-performans'); });
  await page.waitForFunction(() => { const s = document.getElementById('mfsim-loading-screen'); return !s || s.style.display === 'none'; },
    null, { timeout: 60000 });
  await page.evaluate(() => { const n = createNode('fead-analysis', 400, 300); veFeadOpenEditor(n.id); });
  await page.waitForFunction(() => window.nodes.some((n) => n.type === 'fead-wizard'), null, { timeout: 20000 });
  return page.evaluate(() => {
    const out = {};
    const w = window.nodes.find((n) => n.type === 'fead-wizard');
    veFeadWizOpen(w.id); veFeadWizSeed('AG00976_GATES_2025');
    const stil = (e) => { const cs = getComputedStyle(e); return { stroke: cs.stroke, fill: cs.fill, w: parseFloat(cs.strokeWidth) }; };

    veFeadWizGoto(3); veFeadWizAngOpen(); veFeadWizAngRender();
    const a = document.getElementById('ve-fw-ang').querySelector('svg');
    out.secici = {
      govde: [...a.querySelectorAll('[data-ve="arm"]')].map(stil),
      uc:    [...a.querySelectorAll('[data-ve="arm-head"]')].map(stil),
      bant:  a.querySelectorAll('[data-ve="band-arc"]').length,
      // BANDIN YERİ de ölçülüyor, sayısı değil: örnekler MUTLAK açı taşıyor,
      // gösterim nispi. Çeviri atlanırsa bant yine 53 yay çizer ama YANLIŞ
      // yarıya oturur — yalnız SAYAN bir kapı bunu görmez (ölçüldü: sayan
      // kapı bu mutasyondan sağ çıktı, çünkü 265°'lik bir bantta "en yakın
      // yay" her yönde birkaç derece uzakta).
      //
      // Bu yüzden karşılaştırma KÜME karşılaştırması: köprünün kendi
      // örneklerinden beklenen EKRAN açıları ile çizilen yayların başlangıç
      // açıları. Test çeviriyi kendisi yapıyor — bağımsız tanık.
      ...(function(){
        const kol = a.querySelector('[data-ve="arm"]');
        const cx = +kol.getAttribute('x1'), cy = +kol.getAttribute('y1');
        const norm = (d) => ((d % 360) + 360) % 360;
        const ac = (x, y) => norm(Math.atan2(cy - y, x - cx) * 180 / Math.PI);

        const cizilen = [...a.querySelectorAll('[data-ve="band-arc"]')].map((pth) => {
          const m = /^M([-\d.]+) ([-\d.]+)/.exec(pth.getAttribute('d'));
          return m ? ac(+m[1], +m[2]) : null;
        }).filter((x) => x !== null).sort((p, q) => p - q);

        const b = veFeadWizBuild();
        const bant = veFeadArmBand(b);
        const mir = +a.getAttribute('data-mir');
        const beklenen = bant.samples.filter((x) => x.ok).map((x) => {
          const d0 = veFeadArmShownDeg(x.deg);
          return norm(mir < 0 ? (180 - d0) : d0);
        }).sort((p, q) => p - q);

        const esles = (u, v) => u.length === v.length
          && u.every((x, n) => Math.abs(((x - v[n] + 540) % 360) - 180) < 0.75);
        return { cizilenAdet: cizilen.length, beklenenAdet: beklenen.length,
                 kumeAyni: esles(cizilen, beklenen),
                 ilkFark: cizilen.length && beklenen.length
                   ? +Math.abs(((cizilen[0] - beklenen[0] + 540) % 360) - 180).toFixed(2) : null };
      })()
    };
    veFeadWizAngClose();

    veFeadWizGoto(6);
    const s2 = document.getElementById('ve-fw-body').querySelector('svg');
    out.ozet = {
      govde: [...s2.querySelectorAll('[data-ve="arm"]')].map(stil),
      uc:    [...s2.querySelectorAll('[data-ve="arm-head"]')].map(stil),
      pivot: s2.querySelectorAll('[data-ve="pivot"]').length
    };
    return out;
  });
}

test('kol oku: seçici ve özet AYNI dili konuşuyor', async ({ page }) => {
  const r = await sahne(page);
  console.log('OK ' + JSON.stringify(r));

  // İKİ YÜZEYDE DE: gövde + DOLU uç, ikisi de aynı yeşil.
  for (const y of ['secici', 'ozet']) {
    expect(r[y].govde.length).toBe(1);
    expect(r[y].uc.length).toBe(1);                       // eski şemada 0'dı
    expect(r[y].govde[0].stroke).toBe('rgb(22, 163, 74)');
    expect(r[y].uc[0].fill).toBe('rgb(22, 163, 74)');     // uç DOLU
    expect(r[y].govde[0].w).toBeGreaterThanOrEqual(2);    // eski şemada 1.6'ydı
  }
  expect(r.ozet.pivot).toBe(1);
});

test('künyenin erişebildiği açı bandı seçicide çiziliyor', async ({ page }) => {
  const r = await sahne(page);
  // Bant künyenin KENDİ verisinden (kol boyu + yay) türüyor ve köprüden
  // (`veFeadArmBand`) geliyor. Sıfır yay = ya bant hiç hesaplanmadı ya da
  // hiçbir açı olanaklı değil; ikisi de bu örnekte YANLIŞ.
  expect(r.secici.bant).toBeGreaterThan(10);
  // 360°'nin tamamı olanaklı OLAMAZ — kayışın kendisi bir kısmını kapatıyor.
  expect(r.secici.bant).toBeLessThan(360 / 5);

  // ÇİZİLEN YAYLAR ↔ KÖPRÜNÜN ÖRNEKLERİ: küme olarak aynı olmalı.
  expect(r.secici.beklenenAdet).toBe(r.secici.cizilenAdet);
  expect(r.secici.kumeAyni).toBe(true);
  expect(r.secici.ilkFark).toBeLessThan(0.75);
});

// ─────────────────────────────────────────────────────────────────────────────
// AÇI SEÇİCİSİ: HAYALET ↔ SEÇİM AYRIMI (gerçek tarayıcı)
//
// Kullanıcı bildirimi (2026-09-04): *"diyagram üzerinde bir yere tıkladığımda
// ok hayalet şekilde görülmüyor"* ve *"açı değerini girip tamam dediğimde
// pencere otomatik kapanıyor. Kapanmasın."*
//
// KÖK NEDEN ölçülerek bulundu: `veFeadWizAngHover` SEÇİMİ (`shown`) doğrudan
// yazıyordu. İki sonucu vardı — (1) ok zaten farenin peşinde olduğu için
// tıklamanın izi kalmıyordu, (2) kutuya yazılan değer fare düzlemin üstünden
// geçer geçmez siliniyordu. Kullanıcının resmi ikisini birden gösteriyor:
// ok 35,80° iken kutu 48,74.
//
// Bu halkalar Node'da HİÇ koşmuyor: gerçek `mousemove`/`click` gerekiyor.
test('açı seçici: fare HAYALETİ oynatır, seçimi EZMEZ', async ({ page }) => {
  await sahneAng(page);
  const kutu = await page.locator('#ve-fw-ang-plot svg').boundingBox();

  await page.mouse.move(kutu.x + kutu.width * 0.78, kutu.y + kutu.height * 0.30);
  const gez = await page.evaluate(() => ({
    hayalet: document.querySelectorAll('#ve-fw-ang-plot [data-ve="arm-ghost"]').length,
    shown: VE_FW_ANG.shown, hover: VE_FW_ANG.hover
  }));
  console.log('GEZ ' + JSON.stringify(gez));
  expect(gez.hayalet).toBe(1);                       // aday görünür
  expect(gez.hover).not.toBeNull();
  expect(gez.shown).not.toBeCloseTo(gez.hover, 1);   // SEÇİM DEĞİŞMEDİ

  // TIK seçimi sabitler ve kutuya yazar.
  await page.mouse.click(kutu.x + kutu.width * 0.78, kutu.y + kutu.height * 0.30);
  const tik = await page.evaluate(() => ({
    shown: VE_FW_ANG.shown, kutu: document.getElementById('ve-fw-ang-in').value }));
  expect(tik.shown).toBeCloseTo(gez.hover, 2);
  expect(parseFloat(tik.kutu)).toBeCloseTo(gez.hover, 2);

  // SONRA FARE OYNASA DA seçim ve kutu yerinde kalır — eski kusur buydu.
  await page.mouse.move(kutu.x + kutu.width * 0.30, kutu.y + kutu.height * 0.70);
  const sonra = await page.evaluate(() => ({
    shown: VE_FW_ANG.shown, hover: VE_FW_ANG.hover,
    kutu: document.getElementById('ve-fw-ang-in').value }));
  console.log('SONRA ' + JSON.stringify(sonra));
  expect(sonra.shown).toBeCloseTo(tik.shown, 4);
  expect(sonra.kutu).toBe(tik.kutu);
  expect(sonra.hover).not.toBeCloseTo(sonra.shown, 1);   // hayalet ayrı yerde

  // Fare düzlemden çıkınca hayalet gider. TEK sıçrayışta değil, ARADAN
  // geçerek: tarayıcı enter/leave'i konum DEĞİŞİMİNDEN türetiyor ve tek
  // adımda ışınlanan fare kenarı hiç kesmeyebiliyor (ölçüldü — `hover`
  // −98,99'da kalmıştı).
  await page.mouse.move(kutu.x + 5, kutu.y + 5);
  await page.mouse.move(kutu.x - 30, kutu.y - 30, { steps: 8 });
  await page.waitForFunction(() => VE_FW_ANG && VE_FW_ANG.hover === null, null, { timeout: 3000 });
  const cikis = await page.evaluate(() => ({
    hover: VE_FW_ANG.hover,
    hayalet: document.querySelectorAll('#ve-fw-ang-plot [data-ve="arm-ghost"]').length }));
  expect(cikis.hover).toBeNull();
  expect(cikis.hayalet).toBe(0);
});

test('"Uygula" pencereyi KAPATMIYOR ve uygulandığını okutuyor', async ({ page }) => {
  await sahneAng(page);
  const r = await page.evaluate(() => {
    veFeadWizAngType('-30');
    const ok = veFeadWizAngOk();
    const ov = document.getElementById('ve-fw-ang');
    return { ok, acik: !!(ov && ov.style.display !== 'none'),
             shown: VE_FW_ANG && VE_FW_ANG.shown,
             okumalar: [...document.querySelectorAll('#ve-fw-ang .ve-fw-reads > *')]
               .map((e) => e.textContent.trim()) };
  });
  console.log('UYGULA ' + JSON.stringify(r));
  expect(r.ok).toBe(true);
  expect(r.acik).toBe(true);                 // ESKİDEN kapanıyordu
  expect(r.shown).toBeCloseTo(-30, 4);       // seçim de unutulmadı
  // "İşledi mi?" sorusunun ekranda cevabı var: modele yazılan açı okunuyor.
  expect(r.okumalar.join(' | ')).toMatch(/Modele işlenen açı✓\s*-30\.00°/);
});

async function sahneAng(page) {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/index.html');
  await page.evaluate(() => { if (window.MFSimLoader && window.MFSimLoader.start) window.MFSimLoader.start(); });
  await page.waitForFunction(() => typeof window.createNode === 'function' &&
    typeof window.veFeadOpenEditor === 'function' && typeof window.veFeadWizOpen === 'function',
    null, { timeout: 60000 });
  await page.evaluate(() => { if (typeof veSelectModuleFromOverlay === 'function') veSelectModuleFromOverlay('arac-performans'); });
  await page.waitForFunction(() => { const s = document.getElementById('mfsim-loading-screen'); return !s || s.style.display === 'none'; },
    null, { timeout: 60000 });
  await page.evaluate(() => { const n = createNode('fead-analysis', 400, 300); veFeadOpenEditor(n.id); });
  await page.waitForFunction(() => window.nodes.some((n) => n.type === 'fead-wizard'), null, { timeout: 20000 });
  await page.evaluate(() => {
    const w = window.nodes.find((n) => n.type === 'fead-wizard');
    veFeadWizOpen(w.id); veFeadWizSeed('AG00976_GATES_2025'); veFeadWizGoto(3);
    veFeadWizAngOpen(); veFeadWizAngRender();
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// DENKLEM KaTeX İLE DİZİLİYOR — ve varlık gelmeden de OKUNUR
//
// Kullanıcı isteği (2026-09-04): *"'gövdenin montaj konumu' kısmında … denklem
// KaTeX formatında olsun."* KaTeX programın içinde gömülü ama TALEP ÜZERİNE
// açılıyor (~1 MB, raporla ortak). Node'da hiç koşmayan halka bu: varlığın
// yüklenmesi, betiğin çalışması ve yerinde dizgi.
test('montaj konumu denklemi KaTeX ile diziliyor', async ({ page }) => {
  await sahneAng(page);
  await page.evaluate(() => veFeadWizAngClose());

  // Yedek metin ÖNCE orada: varlık hiç gelmese bile denklem okunur kalmalı.
  const once = await page.evaluate(() => {
    const el = document.querySelector('#ve-fw-body .ve-fw-tex');
    return { var: !!el, tex: el && el.getAttribute('data-tex'),
             dizildi: el ? el.hasAttribute('data-tex-ok') : null };
  });
  expect(once.var).toBe(true);
  expect(once.tex).toMatch(/\\vec\{p\}/);

  // Varlık yüklenince yerinde dizilir.
  const sonra = await page.evaluate(async () => {
    const bek = (ms) => new Promise((r) => setTimeout(r, ms));
    for (let i = 0; i < 40 && typeof katex === 'undefined'; i++) { veFeadWizTeXPaint(); await bek(250); }
    veFeadWizTeXPaint(); await bek(400); veFeadWizTeXPaint(); await bek(300);
    const el = document.querySelector('#ve-fw-body .ve-fw-tex');
    return { katex: typeof katex !== 'undefined', dizildi: el.hasAttribute('data-tex-ok'),
             mathml: /class="katex"/.test(el.innerHTML) };
  });
  console.log('KATEX ' + JSON.stringify(sonra));
  expect(sonra.katex).toBe(true);
  expect(sonra.dizildi).toBe(true);
  expect(sonra.mathml).toBe(true);
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. ADIM SADELEŞTİ — ölçülen yerleşim
test('motor künyesi sayfadan pencereye taşındı, satır aralığı açıldı', async ({ page }) => {
  await sahneAng(page);
  await page.evaluate(() => { veFeadWizAngClose(); veFeadWizGoto(5); });
  const r = await page.evaluate(() => {
    const body = document.getElementById('ve-fw-body');
    const gs = [...body.querySelectorAll('.ve-fw-grid')];
    let ara = null;
    for (let i = 1; i < gs.length; i++) {
      if (gs[i - 1].parentElement !== gs[i].parentElement) continue;
      ara = Math.round(gs[i].getBoundingClientRect().top - gs[i - 1].getBoundingClientRect().bottom);
      break;
    }
    const kart = [...body.querySelectorAll('.ve-fw-card')].find((c) => /Motor Künyesi/.test(c.textContent));
    const tb = [...body.querySelectorAll('.ve-fw-tbl')].find((t) => /Devir \[RPM\]/.test(t.textContent));
    veFeadWizEngOpen();
    const ov = document.getElementById('ve-fw-eng');
    const p = { acik: ov.style.display !== 'none', girdi: ov.querySelectorAll('input').length };
    veFeadWizEngClose();
    return {
      izgaraArasi: ara,
      kartGirdi: kart ? kart.querySelectorAll('input').length : -1,
      dugme: kart ? /Künye alanlarını düzenle/.test(kart.textContent) : false,
      dutyBaslik: tb ? [...tb.querySelectorAll('thead th')].map((x) => x.textContent.trim()) : null,
      sicaklik: /Motor odası sıcaklığı/.test(body.textContent),
      pencere: p
    };
  });
  console.log('SADELEŞME ' + JSON.stringify(r));
  expect(r.izgaraArasi).toBeGreaterThanOrEqual(10);   // ESKİDEN 0 px
  expect(r.kartGirdi).toBe(0);                        // ESKİDEN 10 girdi
  expect(r.dugme).toBe(true);
  expect(r.pencere.acik).toBe(true);
  expect(r.pencere.girdi).toBe(10);                   // hepsi pencerede
  expect(r.dutyBaslik).not.toContain('°C');           // sütun kalktı
  expect(r.sicaklik).toBe(true);                      // tek alan üstte
});
