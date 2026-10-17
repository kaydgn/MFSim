/**
 * fead-sekme-durum.spec.js — KATEGORİ DURUMU VE EKSİK BANDI, GERÇEK TARAYICIDA
 *
 * Pencereler tek gövde (2026-10-16): kategoriler sekme değil, alt alta. Durum
 * kategorinin kabında (`data-d`), eksiğin sonucu gövdenin üstündeki bantta.
 * Birim testleri kuralları ve köprüyle ANLAŞMAYI tutuyor
 * (tests/unit/fead-sekme-durum.test.js). Burada Node'da hiç koşmayan halkalar:
 *
 *   • GERÇEK KLAVYE: sayı yazıp Sekme'ye basmak `onchange` → `veFeadSet` →
 *     `saveState` → `veFeadSekmeTazele` zincirini koşturuyor mu — ve pencere
 *     yeniden KURULMADAN (kurulsaydı Sekme ile geçilen alan sökülür, ikinci
 *     sayı yazılamazdı).
 *   • Bandın bağlantısı uzun gövdede alanı GÖRÜŞ ALANINA alıyor mu.
 *   • KAYDIRMA: başka bileşen baştan açılır, aynı bileşenin yeniden kurulması
 *     yerinde kalır (cp-core.js `showNodeProperties`).
 *   • Bandın yazısı iki temada okunur; eksik kategorinin kenar çizgisi içerik
 *     hizasını oynatmaz, kaydırma kabının içinde kalır.
 */
const { test, expect } = require('@playwright/test');
const { motorluOrnekler } = require('./helpers/fead-motor');
const { kontrastKur, kontrastOzet } = require('../helpers/kontrast-olcu.js');
test.setTimeout(180000);

async function bootApp(page, motor = true) {
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
  // Gates örnekleri motorun devirlerini taşımıyor; işletme hesabı onlarsız
  // yapılmaz (FEAD kural 46) — katalog kaydının devir sınırları yazılır.
  // Devirleri KULLANICININ yazdığını ölçen test yardımcıyı atlar.
  if (motor) await motorluOrnekler(page);
}

async function ornekYukle(page) {
  await page.evaluate(() => { const n = createNode('fead-analysis', 400, 300); veFeadOpenEditor(n.id); });
  await page.waitForTimeout(400);
  await page.evaluate(() => { if (typeof veFeadWizClose === 'function') veFeadWizClose(false); });
  await page.evaluate(() => veFeadLoadExample('AG00976_GATES_2025'));
  await page.waitForFunction(() => window.nodes.some((n) => n.type === 'fead-ac'), null, { timeout: 20000 });
  await page.waitForTimeout(500);
}

const pencereAc = (page, tip) => page.evaluate((t) => {
  const n = window.nodes.filter((x) => x.type === t)[0];
  veFeadTableOpen(n.id);
  return n.id;
}, tip);

// Kategorilerin kimliği ve durumu, gövdedeki sırayla ("dev:eksik").
const durumlar = (page, id) => page.evaluate((i) =>
  [...document.querySelectorAll('#ve-fp-panes-' + i + ' > .ve-fp-kat')]
    .map((k) => k.getAttribute('data-k') + ':' + (k.getAttribute('data-d') || '')), id);

// Odaktaki öğe kaydırma kabının görünen dilimi içinde mi?
const odak = (page) => page.evaluate(() => {
  const a = document.activeElement, kap = document.querySelector('.ve-properties-content');
  if (!a || !kap) return { id: '', gorunur: false };
  const r = a.getBoundingClientRect(), k = kap.getBoundingClientRect();
  return { id: a.id, gorunur: r.top >= k.top - 1 && r.bottom <= k.bottom + 1 };
});

test('eksik görünür, bağlantı götürür, klavyeyle doldurunca durum "ok" — pencere kurulmadan', async ({ page }) => {
  const hatalar = [];
  page.on('pageerror', (e) => hatalar.push(String(e)));
  await bootApp(page);
  await ornekYukle(page);
  const id = await pencereAc(page, 'fead-ac');
  await page.waitForSelector('#ve-fp-panes-' + id);

  // Dört kategori TEK gövdede, hiçbiri gizli değil; sekme şeridi yok.
  expect(await durumlar(page, id)).toEqual(['geo:ok', 'rol:ok', 'dev:eksik', 'egr:bos']);
  const govde = await page.evaluate((i) => {
    const kok = document.querySelector('.ve-properties-content');
    return {
      gizli: [...document.querySelectorAll('#ve-fp-panes-' + i + ' > .ve-fp-kat')]
        .filter((k) => k.hidden || !k.getBoundingClientRect().height).length,
      sekme: kok.querySelectorAll('[role="tab"], [role="tablist"], .ve-fp-tabs').length,
      bant: (document.getElementById('ve-fp-eksik-' + i) || { textContent: '' }).textContent,
    };
  }, id);
  expect(govde.gizli).toBe(0);
  expect(govde.sekme).toBe(0);
  expect(govde.bant).toMatch(/Devir sınırları/);

  // GERÇEK TIKLAMA: bant kategoriye gider ve imleci ilk boş alana koyar.
  await page.click('#ve-fp-eksik-' + id + ' button');
  expect(await odak(page)).toEqual({ id: 've-fead-optimumRpm-' + id, gorunur: true });

  // Girişlere iz: pencere yeniden kurulursa iz kaybolur.
  await page.evaluate((i) => {
    ['optimumRpm', 'maxContRpm', 'maxPeakRpm'].forEach((k) => {
      document.getElementById('ve-fead-' + k + '-' + i).dataset.iz = '1';
    });
  }, id);
  await page.keyboard.type('6000'); await page.keyboard.press('Tab');
  await page.keyboard.type('8000'); await page.keyboard.press('Tab');
  await page.keyboard.type('12000'); await page.keyboard.press('Tab');

  const sonra = await page.evaluate((i) => {
    const node = window.nodes.filter((n) => n.id === i)[0];
    return {
      bant: !!document.getElementById('ve-fp-eksik-' + i),
      iz: ['optimumRpm', 'maxContRpm', 'maxPeakRpm'].map((k) =>
        (document.getElementById('ve-fead-' + k + '-' + i) || { dataset: {} }).dataset.iz || ''),
      veri: [node.data.optimumRpm, node.data.maxContRpm, node.data.maxPeakRpm].map(String),
    };
  }, id);
  expect(sonra.veri).toEqual(['6000', '8000', '12000']);          // üç sayı da YAZILDI
  expect(await durumlar(page, id)).toEqual(['geo:ok', 'rol:ok', 'dev:ok', 'egr:bos']);
  expect(sonra.bant).toBe(false);
  expect(sonra.iz).toEqual(['1', '1', '1']);                      // pencere KURULMADI
  expect(hatalar).toEqual([]);
});

// SÜRÜCÜ MOTORU TAŞIR (2026-09-28): motor, devir sınırları, tam yük eğrisi ve
// çalışma çevrimi Çözücü'den sürücü kasnağın penceresine geldi; veri çözücü
// düğümünde (işletme deposu). Node'da koşmayan halka: GERÇEK klavyeyle
// yazılan sayının pencerenin düğümüne değil DEPOYA gitmesi ve sürücünün
// durumunun pencere kurulmadan tazelenmesi.
test('sürücüde dört kategori; devir sınırları klavyeyle DEPOYA yazılır — pencere kurulmadan', async ({ page }) => {
  const hatalar = [];
  page.on('pageerror', (e) => hatalar.push(String(e)));
  await bootApp(page, false);                                     // motorsuz örnek
  await ornekYukle(page);
  const id = await pencereAc(page, 'fead-fan');
  await page.waitForSelector('#ve-fp-panes-' + id);
  expect(await durumlar(page, id)).toEqual(['geo:ok', 'rol:ok', 'mot:eksik', 'cev:ok']);

  const sv = await page.evaluate(() => window.nodes.find((n) => n.type === 'fead-solver').id);
  // "Doldur" rölantiye gider — Motor bölümünün ilk boş alanına (servis
  // faktörü, isteğe bağlı) değil — ve uzun gövdede onu görüş alanına alır.
  await page.click('#ve-fp-eksik-' + id + ' button');
  expect(await odak(page)).toEqual({ id: 've-fead-idleRpm-' + sv, gorunur: true });
  const K = ['idleRpm', 'governedRpm', 'overspeedRpm'];
  await page.evaluate(([s, k]) => k.forEach((a) => {
    document.getElementById('ve-fead-' + a + '-' + s).dataset.iz = '1'; }), [sv, K]);
  await page.keyboard.type('700'); await page.keyboard.press('Tab');
  await page.keyboard.type('2100'); await page.keyboard.press('Tab');
  await page.keyboard.type('2900'); await page.keyboard.press('Tab');

  const sonra = await page.evaluate(([s, i, k]) => {
    const d = window.nodes.find((n) => n.id === s).data;
    const drv = window.nodes.find((n) => n.id === i).data;
    return { depo: k.map((a) => String(d[a])), kasnak: k.filter((a) => a in drv),
             iz: k.map((a) => (document.getElementById('ve-fead-' + a + '-' + s) || { dataset: {} }).dataset.iz || '') };
  }, [sv, id, K]);
  expect(sonra.depo).toEqual(['700', '2100', '2900']);           // depoya yazıldı
  expect(sonra.kasnak).toEqual([]);                               // kasnağa DEĞİL
  expect(sonra.iz).toEqual(['1', '1', '1']);                      // pencere KURULMADI
  expect((await durumlar(page, id))[2]).toBe('mot:ok');
  expect(hatalar).toEqual([]);
});

// KAYDIRMA — tek gövde uzun (Kayış penceresi ~1170 px kayıyor) ve kap,
// içeriği değişince kaydırmasını TUTUYOR: Kayış'ta 700 px aşağıdayken
// Çözücü'ye geçen kullanıcı onu 700 px aşağıdan açıyordu (ölçüldü). Aynı
// bileşenin yeniden kurulması ise yerinde kalmalı (katalog seçimi, onay kutusu).
test('KAYDIRMA — başka bileşen baştan açılır, aynı bileşenin yeniden kurulması yerinde kalır', async ({ page }) => {
  await bootApp(page);
  await ornekYukle(page);
  const belt = await pencereAc(page, 'fead-belt');
  await page.waitForSelector('#ve-fp-panes-' + belt);
  await page.waitForTimeout(250);
  const r = await page.evaluate(async (b) => {
    const kap = document.querySelector('.ve-properties-content');
    const bekle = (ms) => new Promise((x) => setTimeout(x, ms));
    const maks = kap.scrollHeight - kap.clientHeight;
    kap.scrollTop = Math.round(maks * 0.6);
    await bekle(50);
    const once = kap.scrollTop;
    // Aynı bileşen: gövdeye iz koy — yeniden KURULDUĞU ölçülsün (kurulmasaydı
    // kaydırmanın korunması kendiliğinden olurdu, kapı boş geçerdi).
    document.getElementById('ve-fp-panes-' + b).dataset.iz = '1';
    showNodeProperties(window.nodes.find((n) => n.id === b));
    await bekle(100);
    const ayni = { ust: kap.scrollTop, kuruldu: !document.getElementById('ve-fp-panes-' + b).dataset.iz };
    // Başka bileşen — çizimdeki tıklamanın yolu.
    const sv = window.nodes.find((n) => n.type === 'fead-solver');
    veFeadTableOpen(sv.id);
    await bekle(100);
    return { maks, once, ayni, baska: kap.scrollTop, baskaMaks: kap.scrollHeight - kap.clientHeight,
             acik: !!document.getElementById('ve-fp-panes-' + sv.id) };
  }, belt);
  expect(r.maks).toBeGreaterThan(300);                            // gerçekten uzun
  expect(r.once).toBeGreaterThan(200);
  expect(r.ayni.kuruldu).toBe(true);
  expect(Math.abs(r.ayni.ust - r.once)).toBeLessThanOrEqual(1);   // yerinde kaldı
  expect(r.acik).toBe(true);
  expect(r.baskaMaks).toBeGreaterThan(r.once);                    // devralabilirdi…
  expect(r.baska).toBe(0);                                        // …ama baştan açıldı
});

test('bant iki temada okunur; eksik kategorinin çizgisi hizayı oynatmaz ve kabın içinde', async ({ page }) => {
  await bootApp(page, false);                                     // motorsuz: sürücüde eksik var
  await ornekYukle(page);
  await kontrastKur(page);
  const kotu = [];
  for (const tema of ['acik', 'koyu']) {
    await page.evaluate((t) => changeTheme(t), tema);
    const id = await pencereAc(page, 'fead-fan');
    await page.waitForSelector('#ve-fp-eksik-' + id);
    await page.waitForTimeout(250);
    const k = await page.evaluate((i) => window.__kontrast('#ve-fp-eksik-' + i), id);
    expect(k.olculen).toBeGreaterThanOrEqual(2);                  // ad + sonuç + bağlantı
    k.kotu.forEach((x) => kotu.push(Object.assign({ yer: tema }, x)));

    const m = await page.evaluate((i) => {
      const kap = document.querySelector('.ve-properties-content');
      const kats = [...document.querySelectorAll('#ve-fp-panes-' + i + ' > .ve-fp-kat')];
      const sol = (kat) => {
        const s = kat.querySelector('.ve-fp-sect');
        return s ? s.getBoundingClientRect().left : NaN;
      };
      const eks = kats.find((x) => x.getAttribute('data-d') === 'eksik');
      const ok = kats.find((x) => x.getAttribute('data-d') === 'ok');
      const cs = getComputedStyle(eks);
      return {
        cizgi: cs.borderLeftStyle + ' ' + cs.borderLeftWidth,
        kayma: Math.abs(sol(eks) - sol(ok)),                      // kart sol kenarı aynı
        icinde: eks.getBoundingClientRect().left >= kap.getBoundingClientRect().left - 0.5,
        tasma: kap.scrollWidth - kap.clientWidth,
      };
    }, id);
    expect(m.cizgi).toBe('solid 2px');
    expect(m.kayma).toBeLessThanOrEqual(0.5);
    expect(m.icinde).toBe(true);
    expect(m.tasma).toBeLessThanOrEqual(1);
  }
  expect(kontrastOzet(kotu)).toEqual([]);
});
