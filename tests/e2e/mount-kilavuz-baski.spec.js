/**
 * mount-kilavuz-baski.spec.js — TAKOZ KILAVUZU A4 BASKIDA, İŞARETLER GÖRÜNÜR
 *
 * Kullanıcı isteği (2026-11-09): kılavuz "bol bol görseller ile, yönlendirmeler
 * ile, işaretler ile" — ve kılavuz çıktı alınıp okunuyor (2026-09-21). Şekillerin
 * numaralı işaretleri yerleşime bağlı: rozet hedefinin köşesinde, kap onu
 * kırpabilir, iki rozet üst üste binebilir. Hiçbiri jsdom'da ölçülemez
 * (guide-mount-sahne.test.js işaretin hedefini bulduğunu ölçer, görünürlüğünü
 * değil). Bu dosya belgeyi programın kendi üreticisinden alır ve A4 genişliğinde,
 * BASKI kipinde ölçer:
 *   1. hiçbir şekil sağdan taşmıyor, sayfadan uzun değil, çökmüş değil;
 *   2. şekil ölü (fare ve klavye ulaşmaz);
 *   3. her rozet görünür: kendi şeklinin içinde ve üstünde başka bir şey yok;
 *   4. bir şeklin iki rozeti üst üste binmiyor;
 *   5. ekran görüntüleri yüklü.
 * Ölçülen kaçaklar (kapı kurulmadan önce): Görünümler'in çiziminin kabı
 * (`overflow:hidden`) iki rozeti siliyordu; Parametrik Analiz şekli 1.677 px,
 * Görünümler 1.145 px ile sayfadan uzundu; 3B görüntüsünde bir rozet 8 px taşıyordu.
 */
const { test, expect } = require('@playwright/test');
test.setTimeout(180000);

const A4_EN = 794;
const SAYFA_BOY = 1050;
const EN_KISA = 40;
const PAY = 4;

test('Takoz kılavuzu A4 baskıda temiz; her işaret görünür', async ({ page }) => {
  await page.setViewportSize({ width: A4_EN, height: 1123 });
  await page.goto('/index.html');
  await page.evaluate(() => { if (window.MFSimLoader && MFSimLoader.start) MFSimLoader.start(); });
  await page.waitForFunction(() => typeof window.veGuideMountHTML === 'function'
    && typeof window.getMntSolverPropertiesHTML === 'function' && typeof window.veBasSayfaHTML === 'function'
    && typeof window.veKisayolGruplariHTML === 'function', null, { timeout: 90000 });
  await page.waitForFunction(() => {
    const s = document.getElementById('mfsim-loading-screen');
    return !s || s.style.display === 'none';
  }, null, { timeout: 90000 });

  // Derlemenin gömdüğünü (örneğin topolojisi, kılavuzun ekran görüntüleri) modüler
  // kopya sunucudan okur — tek dosyadaki hâlin aynısı.
  const html = await page.evaluate(async () => {
    const yol = veMountCore.getMountExample('siper').topology;
    window.__MNT_TOPOLOGIES = Object.assign({}, window.__MNT_TOPOLOGIES,
      { [yol]: await (await fetch('/' + yol)).json() });
    const k = await (await fetch('/assets/kilavuz/kunye.json')).json();
    window.__MFSIM_KILAVUZ = {};
    Object.keys(k.resim).forEach((ad) => {
      window.__MFSIM_KILAVUZ[ad] = Object.assign({ src: location.origin + '/assets/kilavuz/' + ad + '.webp' }, k.resim[ad]);
    });
    await new Promise((ok) => {
      if (window.FEAD_REPORT_TEMPLATE_B64 && window.MNT_REPORT_ASSETS) return ok();
      window.veGuideEnsureAssets ? window.veGuideEnsureAssets(ok) : ok();
    });
    const h = window.veGuideMountHTML();
    return { h, kayip: veGuideMountKayip(), isaret: veGuideIsaretKayip() };
  });
  expect(html.kayip).toEqual([]);
  expect(html.isaret).toEqual([]);

  const sayfa = await page.context().newPage();
  await sayfa.setViewportSize({ width: A4_EN, height: 1123 });
  await sayfa.setContent(html.h, { waitUntil: 'load' });
  await sayfa.emulateMedia({ media: 'print' });
  await sayfa.waitForTimeout(600);

  const olcum = await sayfa.evaluate((SINIR) => {
    const out = { sekil: 0, tasan: [], uzun: [], kisa: [], canli: 0, odaklanir: 0,
      gizli: [], ust: [], resim: [], rozet: 0 };
    // ROZETİ KIRPAN ATA: taşanı kırpan (`overflow` ≠ visible) bir atanın kutusunun
    // dışına düşen rozet basılmaz — Görünümler'in çiziminin kabı iki rozeti böyle siliyordu.
    // (Belge baskı kipinde kaydırılamıyor: `elementFromPoint` ilk ekranın altını görmez.)
    const kirpan = (r, kap) => {
      const b = r.getBoundingClientRect();
      for (let a = r.parentElement; a && a !== kap.parentElement; a = a.parentElement) {
        const st = getComputedStyle(a);
        if (st.overflowX === 'visible' && st.overflowY === 'visible') continue;
        const ab = a.getBoundingClientRect();
        if (b.left < ab.left - 1 || b.right > ab.right + 1 || b.top < ab.top - 1 || b.bottom > ab.bottom + 1)
          return a.tagName.toLowerCase() + '.' + String(a.className || '').split(' ')[0];
      }
      return null;
    };
    document.querySelectorAll('.page > figure.appfig').forEach((f, i) => {
      out.sekil++;
      const no = i + 1;
      const kap = f.querySelector(':scope > .gk-sahne, :scope > .gk-ekran');
      const k = kap.getBoundingClientRect();
      const cs = getComputedStyle(kap);
      const sag = k.right - parseFloat(cs.paddingRight) - parseFloat(cs.borderRightWidth);
      let tas = 0;
      kap.querySelectorAll('*').forEach((e) => {
        if (e.classList.contains('gk-no')) return;
        const r = e.getBoundingClientRect();
        if (r.width > 0 && r.right > sag) tas = Math.max(tas, Math.round(r.right - sag));
      });
      if (tas > 0) out.tasan.push({ no, px: tas });
      if (k.height > SINIR.boy) out.uzun.push({ no, px: Math.round(k.height) });
      if (k.height < SINIR.kisa) out.kisa.push({ no, px: Math.round(k.height) });
      if (kap.classList.contains('gk-sahne')) {
        if (cs.pointerEvents !== 'none') out.canli++;
        kap.querySelectorAll('input,select,button,textarea,a').forEach((e) => {
          if (e.getAttribute('tabindex') !== '-1') out.odaklanir++;
        });
      }
      kap.querySelectorAll('img').forEach((im) => { if (!(im.naturalWidth > 0)) out.resim.push(no); });
      // ROZET: şeklin kutusunun içinde, görünür ve üstünde başka öğe yok
      const merkez = [];
      kap.querySelectorAll('.gk-no').forEach((r) => {
        out.rozet++;
        const b = r.getBoundingClientRect(), kk = kap.getBoundingClientRect();
        const cx = b.left + b.width / 2, cy = b.top + b.height / 2;
        const icinde = b.width >= 14 && b.left >= kk.left - 1 && b.right <= kk.right + 1
          && b.top >= kk.top - 1 && b.bottom <= kk.bottom + 1;
        const kesen = kirpan(r, kap);
        if (!icinde) out.gizli.push({ no, rozet: r.textContent, neden: 'kutunun dışında' });
        else if (kesen) out.gizli.push({ no, rozet: r.textContent, neden: 'kırpan ' + kesen });
        else if (getComputedStyle(r).visibility !== 'visible' || r.offsetWidth === 0)
          out.gizli.push({ no, rozet: r.textContent, neden: 'görünmez' });
        merkez.push({ r: r.textContent, x: cx, y: cy });
      });
      for (let a = 0; a < merkez.length; a++) for (let c = a + 1; c < merkez.length; c++) {
        if (Math.hypot(merkez[a].x - merkez[c].x, merkez[a].y - merkez[c].y) < 15)
          out.ust.push({ no, rozet: merkez[a].r + '·' + merkez[c].r });
      }
    });
    return out;
  }, { boy: SAYFA_BOY, kisa: EN_KISA });

  expect(olcum.sekil).toBeGreaterThanOrEqual(24);   // Parametrik Analiz'in iki şekli pencereyle kalktı (Canlı Not 1001)
  expect(olcum.rozet).toBeGreaterThan(120);
  expect(olcum.tasan.filter((t) => t.px > PAY)).toEqual([]);
  expect(olcum.uzun).toEqual([]);
  expect(olcum.kisa).toEqual([]);
  expect(olcum.canli).toBe(0);
  expect(olcum.odaklanir).toBe(0);
  expect(olcum.resim).toEqual([]);
  expect(olcum.gizli).toEqual([]);
  expect(olcum.ust).toEqual([]);
  await sayfa.close();
});
