/**
 * fead-sekme-durum.spec.js — DURUMLU SEKMELER, GERÇEK TARAYICIDA
 *
 * Birim testleri kuralları ve köprüyle ANLAŞMAYI tutuyor
 * (tests/unit/fead-sekme-durum.test.js). Burada Node'da hiç koşmayan halkalar:
 *
 *   • GERÇEK KLAVYE: sayı yazıp Sekme'ye basmak `onchange` → `veFeadSet` →
 *     `saveState` → `veFeadSekmeTazele` zincirini koşturuyor mu — ve panel
 *     yeniden KURULMADAN (kurulsaydı Sekme ile geçilen alan sökülür, ikinci
 *     sayı yazılamazdı).
 *   • Şeridin 380 px'lik müfettiş sütununa TEK SATIRDA sığması (yazı genişliği
 *     yalnız yerleşim motorunda var).
 *   • Durum yazısının bant zemini üstünde İKİ TEMADA da okunur olması.
 */
const { test, expect } = require('@playwright/test');
test.setTimeout(180000);

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

test('eksik görünür, bağlantı götürür, klavyeyle doldurunca durum "tamam" — panel kurulmadan', async ({ page }) => {
  const hatalar = [];
  page.on('pageerror', (e) => hatalar.push(String(e)));
  await bootApp(page);
  await ornekYukle(page);
  const id = await pencereAc(page, 'fead-ac');
  await page.waitForSelector('#ve-fp-tabs-' + id);

  const once = await page.evaluate((i) => {
    const kap = document.getElementById('ve-fp-tabs-' + i);
    return {
      yuk: Math.round(kap.getBoundingClientRect().height),
      durum: [...kap.querySelectorAll('.ve-fp-tab-d')].map((d) => d.textContent),
      bant: (document.getElementById('ve-fp-eksik-' + i) || { textContent: '' }).textContent,
    };
  }, id);
  expect(once.yuk).toBeGreaterThanOrEqual(36);                  // eskisi 29 px
  expect(once.durum).toEqual(['tamam', 'tamam', '0/3 girildi', 'isteğe bağlı']);
  expect(once.bant).toMatch(/Devir Sınırları/);

  // GERÇEK TIKLAMA: bant sekmeyi açar ve imleci ilk boş alana koyar.
  await page.click('#ve-fp-eksik-' + id + ' button');
  const odak = await page.evaluate(() => document.activeElement && document.activeElement.id);
  expect(odak).toBe('ve-fead-optimumRpm-' + id);

  // Girişlere iz: panel yeniden kurulursa iz kaybolur.
  await page.evaluate((i) => {
    ['optimumRpm', 'maxContRpm', 'maxPeakRpm'].forEach((k) => {
      document.getElementById('ve-fead-' + k + '-' + i).dataset.iz = '1';
    });
  }, id);
  await page.keyboard.type('6000'); await page.keyboard.press('Tab');
  await page.keyboard.type('8000'); await page.keyboard.press('Tab');
  await page.keyboard.type('12000'); await page.keyboard.press('Tab');

  const sonra = await page.evaluate((i) => {
    const d = document.querySelector('#ve-fp-tabs-' + i + ' .ve-fp-tab[data-k="dev"]');
    const node = window.nodes.filter((n) => n.id === i)[0];
    return {
      d: d.getAttribute('data-d'), yazi: d.querySelector('.ve-fp-tab-d').textContent,
      bant: !!document.getElementById('ve-fp-eksik-' + i),
      iz: ['optimumRpm', 'maxContRpm', 'maxPeakRpm'].map((k) =>
        (document.getElementById('ve-fead-' + k + '-' + i) || { dataset: {} }).dataset.iz || ''),
      veri: [node.data.optimumRpm, node.data.maxContRpm, node.data.maxPeakRpm].map(String),
    };
  }, id);
  expect(sonra.veri).toEqual(['6000', '8000', '12000']);          // üç sayı da YAZILDI
  expect(sonra.d).toBe('ok');
  expect(sonra.yazi).toBe('tamam');
  expect(sonra.bant).toBe(false);
  expect(sonra.iz).toEqual(['1', '1', '1']);                      // panel KURULMADI
  expect(hatalar).toEqual([]);
});

test('sürücüde iki sekme "kullanılmaz" ve alan sormuyor', async ({ page }) => {
  await bootApp(page);
  await ornekYukle(page);
  const id = await pencereAc(page, 'fead-fan');
  await page.waitForSelector('#ve-fp-tabs-' + id);
  const r = await page.evaluate((i) => {
    const kap = document.getElementById('ve-fp-tabs-' + i);
    const gov = document.getElementById('ve-fp-panes-' + i);
    return ['dev', 'egr'].map((k) => ({
      k,
      yazi: kap.querySelector('.ve-fp-tab[data-k="' + k + '"] .ve-fp-tab-d').textContent,
      alan: gov.querySelector('[data-k="' + k + '"]').querySelectorAll('input, select').length,
    }));
  }, id);
  expect(r).toEqual([{ k: 'dev', yazi: 'kullanılmaz', alan: 0 }, { k: 'egr', yazi: 'kullanılmaz', alan: 0 }]);
});

test('şerit dar müfettişte TEK SATIR, taşmıyor; durum yazısı iki temada okunur', async ({ page }) => {
  await bootApp(page);
  await ornekYukle(page);
  const olc = () => page.evaluate(() => {
    const lum = (rgb) => {
      const a = rgb.match(/[\d.]+/g).slice(0, 3).map(Number).map((v) => {
        v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
    };
    const oran = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
    const kap = document.querySelector('.ve-fp-tabs[id^="ve-fp-tabs-"]');
    const zemin = getComputedStyle(kap).backgroundColor;
    const sek = [...kap.querySelectorAll('.ve-fp-tab')];
    return {
      tasma: kap.scrollWidth - kap.clientWidth,
      satir: new Set(sek.map((b) => Math.round(b.getBoundingClientRect().top))).size,
      enDusuk: Math.min(...[...kap.querySelectorAll('.ve-fp-tab-d')]
        .map((d) => oran(getComputedStyle(d).color, zemin))),
    };
  });
  for (const tema of ['acik', 'koyu']) {
    await page.evaluate((t) => changeTheme(t), tema);
    for (const tip of ['fead-ac', 'fead-tensioner', 'fead-belt', 'fead-solver']) {
      await pencereAc(page, tip);
      await page.waitForTimeout(250);
      const m = await olc();
      expect({ tema, tip, tasma: m.tasma <= 1, satir: m.satir }).toEqual({ tema, tip, tasma: true, satir: 1 });
      expect(m.enDusuk).toBeGreaterThanOrEqual(4.5);
    }
  }
});
