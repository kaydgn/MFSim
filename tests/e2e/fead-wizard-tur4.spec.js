/**
 * fead-wizard-tur4.spec.js — SİHİRBAZ, DÖRDÜNCÜ KULLANICI TURU (gerçek tarayıcı)
 *
 * Node'da ölçülemeyen halkalar:
 *   1 · Gergi satırının diğer satırlarla AYNI yükseklikte/hizada durması.
 *   2 · ↑ ↓ düğmelerine GERÇEK tık ile satırın yer değiştirmesi.
 *   3 · VİRGÜLLE yazmanın gerçekten çalışması — `type="number"` alanında
 *       tarayıcı virgülü yutuyordu ve bunu yalnız gerçek klavye gösterir.
 *   5 · Açı seçici penceresi: fare hareketiyle kolun dönmesi, tıkta kutunun
 *       dolması, "Uygula"nın alana yazması.
 *   9 · Alanın NİSPİ değeri göstermesi (344 mutlak → 164).
 */
const { test, expect } = require('@playwright/test');

async function bootApp(page) {
  await page.goto('/index.html');
  await page.evaluate(() => {
    if (window.MFSimLoader && typeof window.MFSimLoader.start === 'function') window.MFSimLoader.start();
  });
  await page.waitForFunction(() =>
    typeof window.createNode === 'function' && typeof window.veFeadWizOpen === 'function'
    && Array.isArray(window.nodes), null, { timeout: 60000 });
  await page.evaluate(() => {
    if (typeof veSelectModuleFromOverlay === 'function') veSelectModuleFromOverlay('arac-performans');
  });
  await page.waitForFunction(() => {
    const s = document.getElementById('mfsim-loading-screen');
    return !s || s.style.display === 'none';
  }, null, { timeout: 60000 });
}

async function sihirbaz(page){
  await bootApp(page);
  await page.evaluate(() => { const n = createNode('fead-analysis', 400, 300); veFeadOpenEditor(n.id); });
  await page.waitForFunction(() => window.nodes.length > 0, null, { timeout: 20000 });
  await page.evaluate(() => veFeadWizOpen(window.nodes.find(n => n.type === 'fead-wizard').id));
  await page.waitForSelector('#ve-feadwiz-overlay');
  await page.evaluate(() => { veFeadWizSeed('BMC_FEAD_2026'); veFeadWizRender(); });
  await page.waitForTimeout(350);
}

test('tur4 — gergi satırı · taşıma · virgül · açı seçici · nispi açı', async ({ page }) => {
  const hata = [];
  page.on('pageerror', e => hata.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') hata.push(m.text()); });
  await sihirbaz(page);
  await page.evaluate(() => veFeadWizGoto(1));
  await page.waitForTimeout(300);

  // ── 1 · GERGİ EDİTÖRÜ KASNAKLARINKİYLE AYNI ────────────────────────────
  // ÇİZİM MASASI (2026-09-29): tablo satırı yerine seçili satırın EDİTÖRÜ.
  // Ölçülen şeyler aynı: hiza, satır boyu, denetim biçimi, zemin.
  const sec = (k) => page.locator('#ve-fw-kl-liste .ve-fw-kl[data-fw-k="' + k + '"]').click();
  const sira = () => page.evaluate(() =>
    [...document.querySelectorAll('#ve-fw-kl-liste .ve-fw-kl')].map((b) => b.getAttribute('data-fw-k')));
  const edOlc = () => page.evaluate(() => {
    const al = [...document.querySelectorAll('#ve-fw-ed .ve-fw-ed-alan')];
    return {
      x: al.map((a) => Math.round(a.lastElementChild.getBoundingClientRect().left)),
      h: al.map((a) => Math.round(a.getBoundingClientRect().height)),
      bicim: al.map((a) => { const c = a.querySelector('input,select,.ve-fw-seg'); return c ? c.tagName : '-'; }),
      zemin: al.map((a) => getComputedStyle(a).backgroundColor)
    };
  });
  const s0 = await sira();
  await sec(s0[0]);
  const ilk = await edOlc();
  await sec('__ten__');
  const ten = await edOlc();
  const satir = {
    hiza: ten.x.length === ilk.x.length && ten.x.every((v, i) => Math.abs(v - ilk.x[i]) <= 1),
    dhFark: Math.max(...ten.h.map((v, i) => Math.abs(v - ilk.h[i]))),
    bicimAyni: JSON.stringify(ten.bicim) === JSON.stringify(ilk.bicim),
    zemin: JSON.stringify(ten.zemin) === JSON.stringify(ilk.zemin),
    ...(await page.evaluate(() => ({
      // AÇIKLAMA YÜZEYİ YOK (kullanıcı isteği, 2026-09-02).
      hint: document.querySelectorAll('.ve-fw-hint').length,
      gozKirpma: [...document.querySelectorAll('.ve-fw-card-h em')].length
    })))
  };
  console.log('SATIR', JSON.stringify(satir));
  expect(satir.hiza).toBe(true);
  expect(satir.dhFark).toBeLessThanOrEqual(2);
  expect(satir.bicimAyni).toBe(true);
  expect(satir.zemin).toBe(true);
  expect(satir.hint).toBe(0);
  expect(satir.gozKirpma).toBe(0);

  // ── 2 · SATIR TAŞIMA — GERÇEK TIK ──────────────────────────────────────
  //
  // ÖLÇÜLEN ŞEY BİR KOMŞULUK: "Sırada öne" satırı KAYIŞ SIRASINDA bir yukarı
  // alır, yani TAM ÜSTÜNDEKİ satırla yer değiştirir. Düğme EYLEMİNDEN
  // seçiliyor, yazısından değil (yazı kozmetik, `onclick` davranışın kendisi).
  // Oklar SEÇİLİ satırın editöründe.
  const a0 = await sira();
  const yukari = async (n) => { await sec(a0[n - 1]);
    return page.locator('#ve-fw-ed button[onclick*="PulleyMove"][onclick*=",-1)"]'); };
  await (await yukari(3)).click();         // 3. SATIR — üstündekiyle takas
  await page.waitForTimeout(300);
  const a1 = await sira();
  console.log('TAŞIMA', JSON.stringify(a0), '→', JSON.stringify(a1));
  expect(a1.length).toBe(a0.length);
  expect(a1[1]).toBe(a0[2]);               // komşuluk: 3 ↔ 2
  expect(a1[2]).toBe(a0[1]);
  expect(a1[0]).toBe(a0[0]);               // krank yerinde
  expect(a1.slice(3)).toEqual(a0.slice(3));// gerisi kıpırdamadı
  // İlk satırın "Sırada öne"si kapalı — sürücü kasnak kayış sırasının başıdır.
  expect(await (await yukari(1)).isDisabled()).toBe(true);

  // ── 3 · VİRGÜL — GERÇEK KLAVYE ─────────────────────────────────────────
  // Sürücünün editöründeki Merkez X alanı.
  const surucu = a1[0];
  await sec(surucu);
  const xAlan = page.locator('#ve-fw-ed input[aria-label="Merkez X"]');
  await xAlan.fill('');
  await xAlan.type('123,45');
  await page.waitForTimeout(250);
  const virgul = await page.evaluate((k) => {
    const st = veFeadWizState();
    const pack = veFeadWizNodes(st);
    const alan = document.querySelector('#ve-fw-ed input[aria-label="Merkez X"]');
    return { alanTipi: alan.type,
             gorunen: Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').get.call(alan),
             durum: st.pulleys.find((p) => p.key === k).x,
             modele: pack.nodes.find((n) => n.id === 'wz-' + k).data.x };
  }, surucu);
  console.log('VİRGÜL', JSON.stringify(virgul));
  expect(virgul.alanTipi).toBe('text');            // number OLSAYDI virgül yutulurdu
  expect(virgul.gorunen).toBe('123,45');           // alan virgülü GÖRDÜ ve gösteriyor
  // Durum makine biçiminde: js/sayi-alan.js alanın `.value`'sunu çeviriyor (7·C).
  expect(String(virgul.durum)).toBe('123.45');
  expect(virgul.modele).toBeCloseTo(123.45, 9);    // model DOĞRU sayıyı aldı

  // ── 9 · NİSPİ AÇI ──────────────────────────────────────────────────────
  await page.evaluate(() => { veFeadWizState().ten.armMeanDeg = 344; veFeadWizGoto(2); });
  await page.waitForTimeout(300);
  const alanDeg = await page.evaluate(() =>
    [...document.querySelectorAll('input')].find(e =>
      (e.getAttribute('oninput') || '').includes('veFeadWizArmShown')).value);
  console.log('AÇI ALANI (344 mutlak →)', alanDeg);
  expect(Number(alanDeg)).toBeCloseTo(164, 6);

  // ── 5 · AÇI SEÇİCİ ─────────────────────────────────────────────────────
  await page.locator('button.ve-fw-ang-btn').click();
  await page.waitForTimeout(300);
  const acik = await page.evaluate(() => {
    const ov = document.getElementById('ve-fw-ang');
    const svg = ov.querySelector('svg');
    return { gorunur: getComputedStyle(ov).display !== 'none', svg: !!svg,
             eksen: (ov.textContent.match(/-?\d+°/g) || []).slice(0, 6),
             kutu: !!document.getElementById('ve-fw-ang-in'),
             baslangic: document.getElementById('ve-fw-ang-in').value };
  });
  console.log('SEÇİCİ', JSON.stringify(acik));
  expect(acik.gorunur).toBe(true);
  // KAYIŞ + YEŞİL OK + YAKINLAŞTIRMA (kullanıcı isteği, 2026-09-02)
  const cizim = await page.evaluate(() => {
    const s = document.querySelector('#ve-fw-ang-plot svg');
    const yol = [...s.querySelectorAll('path')]
      .find(p => (p.getAttribute('stroke') || '').includes('accent-warning'));
    const ok = [...s.querySelectorAll('line')]
      .find(l => (l.getAttribute('stroke') || '').includes('accent-success'));
    const uc = [...s.querySelectorAll('path')]
      .find(p => (p.getAttribute('fill') || '').includes('accent-success'));
    return { kayis: !!yol, kayisUzunluk: yol ? Math.round(yol.getTotalLength()) : 0,
             yesilOk: !!ok, okUcu: !!uc,
             okRengi: ok ? getComputedStyle(ok).stroke : '',
             yazi: [...s.querySelectorAll('text')].map(t => t.textContent),
             zoomDugme: document.querySelectorAll('.ve-fw-ang-zoom button').length,
             k: +s.getAttribute('data-k') };
  });
  console.log('ÇİZİM', JSON.stringify(cizim));
  expect(cizim.kayis).toBe(true);
  expect(cizim.kayisUzunluk).toBeGreaterThan(300);      // gerçek bir yol
  expect(cizim.yesilOk).toBe(true);
  expect(cizim.okUcu).toBe(true);
  expect(cizim.okRengi).not.toBe('');
  // Kasnak ADI yok — yalnız eksen etiketleri ve açı sayısı.
  cizim.yazi.forEach(t => expect(t).toMatch(/^-?\d+(,\d+)?°$/));   // Türkçe sayı (7·C)
  expect(cizim.zoomDugme).toBe(3);

  // YAKINLAŞTIRMA gerçek tıkla ölçeği büyütüyor
  await page.locator('.ve-fw-ang-zoom button[title="Yakınlaş"]').click();
  await page.waitForTimeout(250);
  const k2 = await page.evaluate(() => +document.querySelector('#ve-fw-ang-plot svg').getAttribute('data-k'));
  console.log('ZOOM', cizim.k, '→', k2);
  expect(k2).toBeGreaterThan(cizim.k);
  await page.locator('.ve-fw-ang-zoom button[title="Sığdır"]').click();
  await page.waitForTimeout(250);
  expect(await page.evaluate(() => +document.querySelector('#ve-fw-ang-plot svg').getAttribute('data-k')))
    .toBeCloseTo(cizim.k, 5);
  expect(acik.svg).toBe(true);
  expect(acik.kutu).toBe(true);
  expect(Number(acik.baslangic)).toBeCloseTo(164, 3);

  // FARE: düzlemin sağ ortasına git → açı 0'a yaklaşmalı
  const kutu = await page.locator('#ve-fw-ang-plot svg').boundingBox();
  const merkez = await page.evaluate(() => {
    const s = document.querySelector('#ve-fw-ang-plot svg');
    const vb = s.getAttribute('viewBox').split(/\s+/);
    const r = s.getBoundingClientRect();
    const k = +s.getAttribute('data-k'), ox = +s.getAttribute('data-ox'), oy = +s.getAttribute('data-oy');
    const cx = +s.getAttribute('data-cx'), cy = +s.getAttribute('data-cy');
    return { sx: r.left + (ox + cx * k) * r.width / +vb[2],
             sy: r.top + (oy - cy * k) * r.height / +vb[3],
             pxPerMm: k * r.width / +vb[2] };
  });
  // FARE HAYALETİ OYNATIR, SEÇİMİ EZMEZ. Bu satır bir dönem `shown`ı okuyordu
  // ve o, DÜZELTİLEN HATANIN KENDİSİYDİ: `veFeadWizAngHover` seçimi doğrudan
  // yazınca tıklamanın izi kalmıyor, kutuya girilen değer fare düzlemden geçer
  // geçmez siliniyordu (kullanıcı bildirimi 2026-09-04: *"ok hayalet şekilde
  // görülmüyor"*). Ayrım o gün geldi; bu blok hiç koşmadığı için eski dünyayı
  // savunmaya devam etti. Hayalet `hover`da, seçim `shown`da.
  const oncekiSecim = await page.evaluate(() => VE_FW_ANG.shown);
  await page.mouse.move(merkez.sx + merkez.pxPerMm * 85, merkez.sy);
  await page.waitForTimeout(200);
  const gez = await page.evaluate(() => ({ hover: VE_FW_ANG.hover, shown: VE_FW_ANG.shown }));
  console.log('FARE sağda → hayalet', gez.hover, '· seçim', gez.shown);
  expect(gez.hover).not.toBeNull();
  expect(Math.abs(gez.hover)).toBeLessThan(2);      // sağ orta = 0°
  expect(gez.shown).toBe(oncekiSecim);              // SEÇİM KIPIRDAMADI

  // TIK: kutuya yazılmalı
  await page.mouse.click(merkez.sx, merkez.sy - merkez.pxPerMm * 85);
  await page.waitForTimeout(250);
  const tik = await page.evaluate(() => ({
    kutu: document.getElementById('ve-fw-ang-in').value,
    durum: VE_FW_ANG.shown }));
  console.log('TIK üstte →', JSON.stringify(tik));
  // Tolerans 2°: ekran koordinatı piksele yuvarlanıyor ve yarıçap küçük —
  // ölçülen şey "tık kutuyu doğru yönle dolduruyor mu", ondalık değil.
  expect(Math.abs(Number(tik.kutu) - 90)).toBeLessThan(2);
  expect(Number(tik.kutu)).toBe(tik.durum);

  // UYGULA: alana yazılmalı
  await page.locator('#ve-fw-ang-in').fill('-30');
  await page.locator('#ve-fw-ang button.ve-fw-btn-primary').click();
  await page.waitForTimeout(350);
  const son = await page.evaluate(() => ({
    kapandi: getComputedStyle(document.getElementById('ve-fw-ang')).display === 'none',
    saklanan: veFeadWizState().ten.armMeanDeg,
    alan: [...document.querySelectorAll('input')].find(e =>
      (e.getAttribute('oninput') || '').includes('veFeadWizArmShown')).value }));
  console.log('UYGULA', JSON.stringify(son));
  // PENCERE KAPANMAZ — kullanıcı isteği (2026-09-04): *"açı değerini girip
  // tamam dediğimde pencere otomatik kapanıyor. Kapanmasın."* Bu satır
  // kapanmayı ŞART KOŞUYORDU, yani kaldırılan davranışı geri çağırıyordu;
  // blok hiç koşmadığı için fark edilmedi. Uygulamanın gerçekten işlediği
  // aşağıdaki iki satırda okunuyor — pencerenin kapanması hiçbir zaman
  // "uygulandı"nın kanıtı değildi.
  expect(son.kapandi).toBe(false);
  expect(son.saklanan).toBeCloseTo(150, 3);        // −30 nispi → 150 mutlak
  expect(Number(son.alan)).toBeCloseTo(-30, 3);

  expect(hata.filter(h => !/favicon|manifest|version\.json|Failed to load resource/i.test(h))).toEqual([]);
});
