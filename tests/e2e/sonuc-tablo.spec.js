/**
 * sonuc-tablo.spec.js — Sonuçlar › Tablo kipi: FÖY, GERÇEK tarayıcıda
 *
 * Kullanıcı seçimi (2026-09-28, tasarım tuvali "C · Föy"). Node'da hiç
 * koşmayan halkalar burada ölçülür:
 *   • sayıların HESAPLANAN rengi ve karşıtlığı (eski: sinyal renginde,
 *     1,62–3,47:1; metin eşiği 4,5)
 *   • tablonun bölmeye yayılmaması (eski: 1920 genişlikte 1.480 px, tek
 *     sinyalde devir ile değeri arası 784 px)
 *   • araç çubuğunun kipe göre değişmesi (tabloda log/yakınlaştırma/şerit
 *     hiçbir şey yapmıyordu)
 *   • uzun tabloda başlık ile özetin YAPIŞIKLIĞI, alt satırlar arasında
 *     boşluk kalmaması, kaydırılan satırların kenarlardan sızmaması
 *   • yorum şeridinin tablo kipinde görünmesi (eski: gizlenen grafik kabının
 *     içindeydi, görünmüyordu)
 *   • CSV'nin indirilen içeriği ve Kopyala'nın panoya yazdığı metin
 *
 * Veri: AG00976_GATES_2025 örneğinin FEAD çözümü — kullanıcının ekranındaki
 * tablo (FAN → AVA1 · gerginlik, 880 d/dk'da 1.380,8 N).
 */
const { test, expect } = require('@playwright/test');
const { motorluOrnekler } = require('./helpers/fead-motor');
const fs = require('fs');

test.setTimeout(180000);

const CEVRIM = ['k.surucu_kasnak_fan.T', 'k.klima_kompresoru.T', 'pkw', 'sfmin'];

async function feadTablo(page, kume, kanallar) {
  const hatalar = [];
  page.on('pageerror', (e) => hatalar.push(e.message));
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/index.html');
  await page.evaluate(() => { if (window.MFSimLoader && MFSimLoader.start) MFSimLoader.start(); });
  await page.waitForFunction(() =>
    typeof window.createNode === 'function' && typeof window.veFeadOpenEditor === 'function' &&
    typeof window.veRenderTable === 'function' && Array.isArray(window.nodes), null, { timeout: 120000 });
  await page.evaluate(() => { veSelectModuleFromOverlay('arac-performans'); });
  await page.waitForFunction(() => {
    const s = document.getElementById('mfsim-loading-screen');
    return !s || s.style.display === 'none';
  }, null, { timeout: 120000 });
  // Gates örnekleri motorun devirlerini taşımıyor; işletme hesabı onlarsız
  // yapılmaz (FEAD kural 46) — katalog kaydının devir sınırları yazılır.
  await motorluOrnekler(page);
  await page.evaluate(() => { const n = createNode('fead-analysis', 400, 300); veFeadOpenEditor(n.id); });
  await page.waitForTimeout(300);
  await page.evaluate(() => { if (typeof veFeadWizClose === 'function') veFeadWizClose(false); });
  await page.evaluate(() => veFeadLoadExample('AG00976_GATES_2025'));
  await page.waitForTimeout(900);
  await page.evaluate(() => { const s = nodes.find((n) => n.type === 'fead-solver'); veFeadSolve(s.id); });
  await page.evaluate(() => { veSubTabDegistir('sonuclar'); });
  await page.waitForTimeout(400);
  await page.evaluate(([k, ch]) => {
    veSwitchSolverTab('fead');
    ch.forEach((id) => veAddSignalToSlot(0, '~fead-' + k, id));
  }, [kume, kanallar]);
  await page.click('#ve-trace-toolbar [data-mode="table"]');
  await expect(page.locator('#ve-table-0')).toBeVisible();
  return hatalar;
}

// Hesaplanan rengin, ALTINDAKİ opak zeminle harmanlanmış zemine karşıtlığı
const KARSITLIK = `
  window.__karsitlik = (el) => {
    const L = (c) => {
      const s = c.map((v) => v / 255).map((v) => v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
      return 0.2126 * s[0] + 0.7152 * s[1] + 0.0722 * s[2];
    };
    const rgba = (t) => (t.match(/[\\d.]+/g) || []).map(Number);
    const kat = [];
    for (let e = el; e; e = e.parentElement) {
      const m = rgba(getComputedStyle(e).backgroundColor);
      const a = m.length > 3 ? m[3] : 1;
      if (m.length < 3 || a === 0) continue;
      kat.push([m[0], m[1], m[2], a]);
      if (a >= 1) break;
    }
    let z = [255, 255, 255];
    for (let i = kat.length - 1; i >= 0; i--) {
      const [r, g, b, a] = kat[i];
      z = [r * a + z[0] * (1 - a), g * a + z[1] * (1 - a), b * a + z[2] * (1 - a)];
    }
    const x = L(rgba(getComputedStyle(el).color).slice(0, 3)), y = L(z);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  };`;

test('FÖY: sayı mürekkepte, tablo içeriği kadar geniş, araçlar tablonun', async ({ page }) => {
  const hatalar = await feadTablo(page, 'cevrim', CEVRIM);
  await page.addScriptTag({ content: KARSITLIK });
  const o = await page.evaluate(() => {
    const tbl = document.getElementById('ve-table-0');
    const tds = [...document.querySelectorAll('#ve-table-body-0 td')];
    const k = tds.map((td) => window.__karsitlik(td));
    const govde = getComputedStyle(document.body).color;
    return {
      bolme: document.getElementById('ve-rslot-body-0').getBoundingClientRect().width,
      tablo: tbl.getBoundingClientRect().width,
      kMin: Math.min(...k),
      renkler: [...new Set(tds.slice(0, 5).map((td) => getComputedStyle(td).color))],
      dikey: [...new Set(tds.map((td) => getComputedStyle(td).borderRightWidth))],
      zebra: [...new Set([...document.querySelectorAll('#ve-table-body-0 tr')].slice(0, 4)
        .map((tr) => getComputedStyle(tr.children[1]).backgroundColor))].length,
      hiza: [...new Set([...tbl.querySelectorAll('thead th, tbody td')].map((c) => getComputedStyle(c).textAlign))],
      ilk: [...document.querySelector('#ve-table-body-0 tr').children].map((td) => td.innerText.trim()),
      ozet: [...tbl.querySelectorAll('tfoot tr.ve-foy-ozet')].map((tr) => [...tr.children].map((c) => c.innerText.trim())),
      araclar: [...document.querySelectorAll('#ve-trace-toolbar [data-act]')].map((b) => b.getAttribute('data-act')),
      govde
    };
  });
  // Tablo bölmeye YAYILMAZ (eski: 1.480 / 1.480 px)
  expect(o.tablo).toBeLessThan(o.bolme * 0.6);
  // Sayı mürekkepte: tek renk, metin eşiğinin üstünde (eski 1,62–3,47:1)
  expect(o.renkler).toHaveLength(1);
  expect(o.kMin).toBeGreaterThanOrEqual(4.5);
  // Ortak tablo kuralı: dikey çizgi ve zebra yok, sayı başlığıyla sağda
  expect(o.dikey).toEqual(['0px']);
  expect(o.zebra).toBe(1);
  expect(o.hiza).toEqual(['right']);
  // Ekrandaki tabloyla birebir, "#" sütunu yok, devir 0 hane (eski 880,000).
  // KAYMA SÜTUNU TASARIM YÜKÜNDE (2026-09-29, FEAD kural 48): örnek kaydı
  // c₂ = 1,3 taşıyor ve servis faktörü artık bir yük katsayısı — gerçek
  // yükteki değerler 4,58 · 4,50 / 5,11 / 6,16 idi. Gerginlik ve güç
  // sütunları gerçek yükte kaldı, değişmedi.
  expect(o.ilk).toEqual(['880', '1.380,8', '1.023,1', '6,34', '3,88']);
  expect(o.ozet).toEqual([
    ['En düşük', '1.027,6', '714,5', '6,34', '3,81'],
    ['Ortalama', '1.248,9', '854,6', '9,27', '4,38'],
    ['En yüksek', '1.404,7', '1.023,1', '11,45', '5,40']
  ]);
  // Tabloda hiçbir şey yapmayan iz araçları YOK; tablonun kendi iki eylemi var
  expect(o.araclar).toEqual(expect.arrayContaining(['tablo-kopyala', 'tablo-csv', 'xaxis', 'clear']));
  ['xlog', 'ylog', 'fit', 'zoom-in', 'zoom-out', 'split-all', 'merge-all'].forEach((a) =>
    expect(o.araclar).not.toContain(a));

  // İz kipine dönüş: iz araçları geri gelir, tablonunkiler gider
  await page.click('#ve-trace-toolbar [data-mode="line"]');
  const iz = await page.evaluate(() =>
    [...document.querySelectorAll('#ve-trace-toolbar [data-act]')].map((b) => b.getAttribute('data-act')));
  expect(iz).toEqual(expect.arrayContaining(['fit', 'zoom-in', 'split-all']));
  expect(iz).not.toContain('tablo-csv');
  expect(hatalar).toEqual([]);
});

test('UZUN TABLO: başlık üstte, özet + not altta YAPIŞIK, boşluksuz, sızıntısız; yorum görünür', async ({ page }) => {
  const hatalar = await feadTablo(page, 'senaryo', ['rpm', 'k.surucu_kasnak_fan.T', 'k.klima_kompresoru.T', 'tmin']);
  const olc = () => page.evaluate(() => {
    const z = document.querySelector('.ve-foy-zemin');
    const zr = z.getBoundingClientRect();
    const alt = [...document.querySelectorAll('#ve-table-0 tfoot tr')].map((tr) => tr.firstElementChild.getBoundingClientRect());
    const not = document.getElementById('ve-trace-note');
    return {
      satir: document.querySelectorAll('#ve-table-body-0 tr').length,
      zUst: zr.top, zAlt: zr.top + z.clientHeight,
      baslik: document.querySelector('#ve-table-0 thead th').getBoundingClientRect().top,
      alt: alt.map((r) => [r.top, r.bottom]),
      yorum: !!(not && not.offsetParent && not.innerText.trim().length)
    };
  });
  // Ortadan: başlık kabın ÜST kenarında, dört alt satır ALT kenarda ve bitişik
  await page.evaluate(() => { const z = document.querySelector('.ve-foy-zemin'); z.scrollTop = (z.scrollHeight - z.clientHeight) / 2; });
  await page.waitForTimeout(150);
  const o = await olc();
  expect(o.satir).toBe(149);
  expect(Math.abs(o.baslik - o.zUst)).toBeLessThanOrEqual(1);          // eski payla 20 px aşağıda kalıyordu
  expect(Math.abs(o.alt[3][1] - o.zAlt)).toBeLessThanOrEqual(1);       // eski payla 28 px yukarıda
  for (let i = 1; i < 4; i++) expect(Math.abs(o.alt[i][0] - o.alt[i - 1][1])).toBeLessThanOrEqual(0.5);   // eski: 2 px boşluk
  // Tablo kipinde de yorum okunur (veTrApplyMode'un sözü)
  expect(o.yorum).toBe(true);
  expect(hatalar).toEqual([]);
});

test('CSV ve Kopyala: TÜM örnekler — CSV noktalı ve ";" ayraçlı, pano virgüllü ve sekmeli', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const hatalar = await feadTablo(page, 'cevrim', CEVRIM);

  const [indir] = await Promise.all([
    page.waitForEvent('download'),
    page.click('#ve-trace-toolbar [data-act="tablo-csv"]')
  ]);
  expect(indir.suggestedFilename()).toMatch(/^MFSim_Tablo_Calisma_cevrimi_\d{8}_\d{4}\.csv$/);
  const csv = fs.readFileSync(await indir.path(), 'utf8');
  expect(csv.charCodeAt(0)).toBe(0xFEFF);   // Excel UTF-8'i BOM'la tanır
  const c = csv.slice(1).trim().split('\r\n');
  expect(c.length).toBe(1 + 12);
  expect(c[0]).toBe('Motor devri [d/dk];FAN → AVA1 · gerginlik [N];KK → AVA2 · gerginlik [N];' +
                    'Sürücü gücü (FAN) [kW];En düşük kayma emniyeti [×]');
  expect(c[1]).toMatch(/^880;1380\.8\d+;1023\.08\d+;6\.34;3\.87\d+$/);   // kayma c₂ = 1,3'te

  await page.click('#ve-trace-toolbar [data-act="tablo-kopyala"]');
  await page.waitForTimeout(300);
  const pano = (await page.evaluate(() => navigator.clipboard.readText())).trim().split('\r\n');
  expect(pano.length).toBe(1 + 12);
  expect(pano[1]).toMatch(/^880\t1380,8\d+\t1023,08\d+\t6,34\t3,87\d+$/);
  expect(pano[1]).not.toMatch(/\d\.\d/);   // noktalı ondalık Türkçe Excel'de binlik okunur
  expect(hatalar).toEqual([]);
});
