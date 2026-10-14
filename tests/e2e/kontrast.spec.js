/**
 * kontrast.spec.js — EKRANDAKİ YAZI ZEMİNİNE KARŞI OKUNUR MU? (WCAG 2.1 AA)
 * ───────────────────────────────────────────────────────────────────────
 *
 * `theme-contrast.test.js` PALETİ sınar. Ekrandaki yazı ise rengini başka
 * yollardan da alıyordu ve palet testi onları göremez:
 *   · sabit renk     çözücü günlüğü #c88a20 · #2e9e44 (2,27 · 2,65:1); motor
 *                    ızgarası, konvertör lejantı #5b95fb · #e0725f · #4aa3ff ·
 *                    #ff6b6b (2,26–2,94:1) — lejant çizginin rengini de
 *                    TUTMUYORDU (çizgi --seri-1, lejant #4aa3ff)
 *   · ham vurgu      --accent-* METİN olarak (3,73–4,38:1)
 *   · opaklık        jetonla yazılıp `opacity:.5–.85` ile soldurulan yazı
 *                    (2,13–4,36:1) — renk doğru, ekrandaki sonuç değil
 * Ölçüt tests/helpers/kontrast-olcu.js'te (CAN Çözümleyici ve Ölçüm
 * Görüntüleyici aynısını kullanıyor). Node'da koşamaz: jsdom kaskadı,
 * opaklığı ve yerleşimi hesaplamaz.
 */
const { test, expect } = require('@playwright/test');
const { kontrastKur, kontrastOzet } = require('../helpers/kontrast-olcu.js');
const { motorluOrnekler } = require('./helpers/fead-motor');

test.describe.configure({ timeout: 240000 });

async function bootApp(page, { modul = 'arac-performans', karsilama, tema = 'acik' } = {}) {
  await page.setViewportSize({ width: 1600, height: 1000 });
  page.on('dialog', (d) => d.accept());
  await page.goto('/index.html');
  await page.evaluate(() => { if (window.MFSimLoader && MFSimLoader.start) MFSimLoader.start(); });
  await page.waitForFunction(() =>
    typeof window.createNode === 'function' && typeof window.veFeadOpenEditor === 'function' &&
    Array.isArray(window.nodes), null, { timeout: 90000 });
  await kontrastKur(page);
  await page.evaluate((t) => changeTheme(t), tema);
  if (karsilama) await karsilama();
  await page.evaluate((m) => { if (typeof veSelectModuleFromOverlay === 'function') veSelectModuleFromOverlay(m); }, modul);
  await page.waitForFunction(() => {
    const s = document.getElementById('mfsim-loading-screen');
    return !s || s.style.display === 'none';
  }, null, { timeout: 90000 });
  await page.waitForTimeout(400);
}

// Bir kökü ölç; kapalı <details>'ları önce aç (içindeki tablo da yazıdır).
async function olc(page, kok, yer, liste) {
  const r = await page.evaluate((k) => {
    const el = document.querySelector(k);
    if (el) el.querySelectorAll('details:not([open])').forEach((d) => { d.open = true; });
    return window.__kontrast(k);
  }, kok);
  r.kotu.forEach((x) => liste.push(Object.assign({ yer }, x)));
  return r;
}

// Modeldeki her bileşen tipinin penceresi, her sekmesiyle.
const SEKME = '[role="tab"]:not(.ve-fp-tab), .ve-tab-btn, .ve-panel-tab, .ve-mnt-tab';
async function pencereler(page, liste, yalniz) {
  const tipler = yalniz || await page.evaluate(() =>
    [...new Set(nodes.filter((n) => !(componentDefs[n.type] || {}).isSubsystem).map((n) => n.type))]);
  let olculen = 0;
  for (const tip of tipler) {
    const sekme = await page.evaluate(async ([tp, S]) => {
      const n = nodes.find((x) => x.type === tp);
      clearSelection(); addToSelection(n); veTogglePropertiesPanel(true);
      await new Promise((r) => setTimeout(r, 450));
      const ic = document.querySelector('.ve-properties-content');
      if (!ic) return { id: n.id, fead: [], diger: 0 };
      return {
        id: n.id,
        fead: [...ic.querySelectorAll('.ve-fp-tab')].map((t) => t.getAttribute('data-k')),
        diger: ic.querySelectorAll(S).length,
      };
    }, [tip, SEKME]);
    olculen += (await olc(page, '#ve-properties', tip, liste)).olculen;
    for (const k of sekme.fead.slice(1)) {
      await page.evaluate(([id, kk]) => veFeadPanelTab(id, kk), [sekme.id, k]);
      await page.waitForTimeout(100);
      olculen += (await olc(page, '#ve-properties', tip + '/' + k, liste)).olculen;
    }
    for (let i = 1; i < sekme.diger; i++) {
      await page.evaluate(([j, S]) => {
        const l = document.querySelector('.ve-properties-content').querySelectorAll(S);
        if (l[j]) l[j].click();
      }, [i, SEKME]);
      await page.waitForTimeout(250);
      olculen += (await olc(page, '#ve-properties', tip + '/' + (i + 1), liste)).olculen;
    }
    await page.evaluate(() => veTogglePropertiesPanel(false));
    await page.waitForTimeout(120);
  }
  return { tip: tipler.length, olculen };
}

// PALETİN GERİ KALANI: örnek modelde olmayan her tipten bir düğüm kurulur ve
// penceresi açılır. "Bütün pencereler" yalnız örneğin tiplerini açıyordu —
// sensör sihirbazı, yavaşlama sihirbazı, yol, aksesuarlar hiç ölçülmedi ve
// orada %40–60 opaklıkla soldurulmuş yazı 1,23–2,67:1 kaldı.
async function paletiTamamla(page, modul) {
  const yeni = await page.evaluate((m) => {
    const tipler = [];
    document.querySelectorAll('.ve-category').forEach((cat) => {
      if ((cat.getAttribute('data-ve-scope') || 'arac-performans') !== m) return;
      cat.querySelectorAll('.ve-component[data-type]').forEach((el) => tipler.push(el.getAttribute('data-type')));
    });
    // FEAD paletsiz (kasnaklar çizimden eklenir): tipleri tanımlarından
    if (m === 'fead-analysis') Object.keys(componentDefs).forEach((t) => { if (componentDefs[t].isFeadPulley) tipler.push(t); });
    const var_ = new Set(nodes.map((n) => n.type));
    const yeni = [...new Set(tipler)].filter((t) => componentDefs[t] && !componentDefs[t].isSubsystem && !var_.has(t) && !/example$/.test(t));
    yeni.forEach((t, i) => createNode(t, 200 + (i % 6) * 140, 900 + Math.floor(i / 6) * 120));
    return yeni;
  }, modul);
  await page.waitForTimeout(1200);                    // kurulumun ertelenmiş işleri pencereyi kapatmasın
  return yeni;
}

// İkincil pencere: aç, kökünü ölç, kapat. Kök ölçülemiyorsa pencere AÇILMAMIŞ
// demektir (veri isteyen pencere yalnız bildirim basar) — sessiz geçmesin.
// Geçişler bitmeden ölçülmez: yarı saydam an 1:1 okunur.
async function ikincil(page, yer, ac, kok, liste, arg) {
  await page.evaluate(ac, arg);
  await page.waitForSelector(kok, { state: 'visible', timeout: 5000 });
  await page.mouse.move(2, 2);                        // fare altı vurgusu ölçüme karışmasın
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'), null, { timeout: 5000 }).catch(() => {});
  const r = await olc(page, kok, yer, liste);
  expect(`${yer}: ${r.olculen > 0}`).toBe(`${yer}: true`);
  await page.keyboard.press('Escape'); await page.waitForTimeout(250);
  return r.olculen;
}

// Sonuçlar: Veri Gezgini (işaretli + işaretsiz satır) ve pano.
async function sonuclar(page, liste, yer, sinyalSec) {
  await page.evaluate(() => veSubTabDegistir('sonuclar'));
  await page.waitForTimeout(700);
  await olc(page, '#ve-results-browser', yer + ' · gezgin', liste);
  await olc(page, '#ve-results-grid', yer + ' · boş pano', liste);
  if (sinyalSec) {
    await page.evaluate(sinyalSec);
    await page.waitForTimeout(900);
    await olc(page, '#ve-results-browser', yer + ' · gezgin (seçili)', liste);
    await olc(page, '#ve-results-grid', yer + ' · pano', liste);
  }
}

// İki tema: koyu temada --on-* (vurgu üstünde yazı) koyudur — sabit beyaz
// yazı orada 3,18:1 kalıyordu; açık temada ise ham vurgu ve soluk jeton.
for (const tema of ['acik', 'koyu']) {
  test(`kabuk: karşılama, Program Arşivi, Program Durumu, komut paleti, Ayarlar AA · ${tema}`, async ({ page }) => {
    const kotu = [];
    await bootApp(page, { tema,
      karsilama: async () => {
        // Karşılamanın giriş animasyonu BİTTİKTEN sonra (yazı opaklıktan gelir)
        await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'), null, { timeout: 15000 }).catch(() => {});
        await olc(page, '#ve-module-overlay', 'karşılama', kotu);
      },
    });
    await page.evaluate(() => veProgramArsiviOpen()); await page.waitForTimeout(500);
    await olc(page, '#ve-programlar', 'arşiv', kotu);
    await page.evaluate(() => veProgramArsiviClose());
    await page.evaluate(() => veOpenStatusModal()); await page.waitForTimeout(500);
    await olc(page, '#ve-status-overlay', 'program durumu', kotu);
    await page.keyboard.press('Escape'); await page.waitForTimeout(200);
    await page.evaluate(() => veCmdkOpen()); await page.waitForTimeout(400);
    await olc(page, '#ve-cmdk', 'komut paleti', kotu);
    await page.evaluate(() => veCmdkClose());
    await ikincil(page, 'klavye kısayolları', () => veShortcutsHelpOpen(), '#ve-help', kotu);
    await ikincil(page, 'ölçüm içe aktarma', () => veImpOpenModal(), '#ve-import-overlay', kotu);
    await page.evaluate(() => veOpenSettings()); await page.waitForTimeout(300);
    const bolumler = await page.evaluate(() => [...document.querySelectorAll('.ve-settings-nav-item')].map((b) => b.getAttribute('data-section')));
    expect(bolumler.length).toBeGreaterThanOrEqual(5);
    for (const b of bolumler) {
      await page.evaluate((s) => veSettingsShowSection(s), b);
      await page.waitForTimeout(150);
      await olc(page, '#ve-settings-overlay', 'ayarlar/' + b, kotu);
    }
    expect(kontrastOzet(kotu)).toEqual([]);
  });

  test(`Araç Performans: bütün pencereler, çözücü günlüğü, rapor penceresi, Sonuçlar AA · ${tema}`, async ({ page }) => {
    const kotu = [];
    await bootApp(page, { tema });
    await page.evaluate(() => {
      let ex = nodes.find((x) => x.type === 'ap-example'); if (!ex) ex = createNode('ap-example', 300, 200);
      ex.data = ex.data || {}; ex.data.exampleKey = 'isb340_tc411'; veApLoadExample(ex.id);
    });
    await page.waitForFunction(() => nodes.some((n) => n.type === 'shift-controller'), null, { timeout: 20000 });
    await page.waitForTimeout(800);
    const p = await pencereler(page, kotu);
    expect(p.tip).toBeGreaterThan(8);
    expect(p.olculen).toBeGreaterThan(800);                 // tarama gerçekten ölçüyor
    await page.evaluate(() => veSolverRunProfessional());
    await page.waitForFunction(() => { const b = document.getElementById('ve-solver-modal-close'); return b && b.style.display !== 'none'; }, null, { timeout: 120000 });
    const g = await olc(page, '#ve-solver-modal-overlay', 'çözücü', kotu);
    expect(g.olculen).toBeGreaterThan(30);
    await page.evaluate(() => document.getElementById('ve-solver-modal-close').click());
    await page.evaluate(() => veShowRaporModal()); await page.waitForTimeout(300);
    await olc(page, '#ve-rapor-modal-overlay', 'rapor penceresi', kotu);
    await page.evaluate(() => veCloseRaporModal());
    await sonuclar(page, kotu, 'sonuçlar', () => {
      let n = 0;
      for (const c of document.querySelectorAll('#ve-results-tree .vsig-row .vsig-ck')) { if (n >= 4) break; c.click(); n++; }
    });
    // Çözümden SONRA: bağlanmamış ek düğümler çözücüyü etkilemesin
    await page.evaluate(() => veSubTabDegistir('arac-performans'));
    const ek = await paletiTamamla(page, 'arac-performans');
    expect(ek).toEqual(expect.arrayContaining(['sensor-wizard', 'coast-down', 'road', 'acc-alternator']));
    expect((await pencereler(page, kotu, ek)).olculen).toBeGreaterThan(300);
    let ik = 0;
    ik += await ikincil(page, 'eşleştirme büyük diyagram', () => ecmExpandChart(nodes.find((n) => n.type === 'ec-matching').id),
      '#ecm-chart-modal-overlay', kotu);
    ik += await ikincil(page, 'yavaşlama sihirbazı', async () => {
      veOpenCoastDownWizard(nodes.find((n) => n.type === 'coast-down').id);
      await new Promise((r) => setTimeout(r, 400));
      cdwLoadExample(); cdwComputeCrr();
    }, '#ve-cd-wizard-overlay', kotu);
    // Yol: elle segment girilince açılan tablo, özet ve büyük profil
    const yol = await page.evaluate(() => {
      const n = nodes.find((x) => x.type === 'road');
      [['down', 6, 1000], ['up', 4, 800], ['flat', 0, 500]].forEach(([y, g, m]) => {
        veManualSegAdd(n.id);
        Object.assign(n.data.manualSegments[n.data.manualSegments.length - 1], { direction: y, gradePct: g, distance: m });
      });
      return n.id;
    });
    await pencereler(page, kotu, ['road']);
    ik += await ikincil(page, 'yol profili büyük', (id) => veManualSegExpandProfile(id), '#ve-mseg-profile-overlay', kotu, yol);
    ik += await ikincil(page, 'uyarılar paneli', () => veOpenWarningsPanel(), '#ve-warnings-panel', kotu);
    await page.evaluate(() => veSetWarningsOpen(false));
    expect(ik).toBeGreaterThan(100);
    expect(kontrastOzet(kotu)).toEqual([]);
  });

  test(`Takoz: bütün pencereler, çözüm sonrası, Sonuçlar AA · ${tema}`, async ({ page }) => {
    const kotu = [];
    await bootApp(page, { modul: 'mount-analysis', tema });
    await page.evaluate(() => {
      let ex = nodes.find((x) => x.type === 'mnt-example'); if (!ex) ex = createNode('mnt-example', 300, 200);
      ex.data = ex.data || {}; ex.data.exampleKey = 'tulga'; veMntLoadExample(ex.id);
    });
    await page.waitForFunction(() => nodes.some((n) => n.type === 'mnt-solver'), null, { timeout: 20000 });
    await page.waitForTimeout(800);
    await page.evaluate(async () => { const s = nodes.find((n) => n.type === 'mnt-solver'); await veMntSolverCompute(s.id); });
    await page.waitForFunction(() => typeof veMntSets === 'function' && veMntSets().length > 0, null, { timeout: 180000 });
    const p = await pencereler(page, kotu);
    expect(p.olculen).toBeGreaterThan(300);
    await sonuclar(page, kotu, 'sonuçlar', () => {
      if (typeof veSwitchSolverTab === 'function') veSwitchSolverTab('mount');
      veUpdateResultsTree();
      let n = 0;
      for (const c of document.querySelectorAll('#ve-results-tree .vsig-row .vsig-ck')) { if (n >= 3) break; c.click(); n++; }
    });
    await page.evaluate(() => veSubTabDegistir('arac-performans'));
    const ek = await paletiTamamla(page, 'mount-analysis');
    expect(ek.length).toBeGreaterThan(0);
    await pencereler(page, kotu, ek);
    expect(kontrastOzet(kotu)).toEqual([]);
  });

  test(`FEAD: pencereler, kanvas, araçlar, sihirbaz, Sonuçlar ve özet AA · ${tema}`, async ({ page }) => {
    const kotu = [];
    await bootApp(page, { tema });
    // Gates örnekleri motor devirlerini taşımıyor; işletme hesabı onlarsız koşmaz (FEAD kural 46).
    await motorluOrnekler(page);
    await page.evaluate(() => { const n = createNode('fead-analysis', 400, 300); veFeadOpenEditor(n.id); });
    await page.waitForTimeout(400);
    await olc(page, '#ve-canvas-wrapper', 'başlangıç', kotu);
    await page.evaluate(() => { if (typeof veFeadWizClose === 'function') veFeadWizClose(false); });
    await page.evaluate(() => veFeadLoadExample('AG00976_GATES_2025'));
    await page.waitForFunction(() => window.nodes.filter((n) => n.type === 'fead-layout').length === 2, null, { timeout: 20000 });
    await page.waitForTimeout(600);
    const p = await pencereler(page, kotu);
    expect(p.olculen).toBeGreaterThan(1000);
    await olc(page, '#ve-canvas', 'kanvas', kotu);
    await olc(page, '.ve-fead-arac', 'araçlar', kotu);

    // Sihirbaz: örnekle doldurulmuş, her adım
    const adim = await page.evaluate(() => { veFeadWizOpenAny(); veFeadWizSeed('AG00976_GATES_2025'); return VE_FW_STEPS.length; });
    for (let i = 0; i < adim; i++) {
      await page.evaluate((j) => veFeadWizGoto(j), i);
      await page.waitForTimeout(450);
      await olc(page, '#ve-feadwiz-overlay', 'sihirbaz/' + (i + 1), kotu);
    }
    await page.evaluate(() => veFeadWizClose(false));

    // Çözüm → Sonuçlar: gezgin, hazır diyagramlar (yorum notu açık), özet
    await page.evaluate(() => { const s = nodes.find((n) => n.type === 'fead-solver'); veFeadSolve(s.id); });
    await page.waitForFunction(() => window.veFeadResults && (window.veFeadResults.ok || window.veFeadResults.error), null, { timeout: 90000 });
    await page.evaluate(() => veFeadOpenResults()); await page.waitForTimeout(1200);
    await olc(page, '#ve-results-browser', 'sonuçlar · gezgin', kotu);
    const hazir = await page.evaluate(() => veFeadSignals.presets(window.veFeadResults.signals).map((x) => x.k));
    expect(hazir.length).toBeGreaterThan(2);
    for (const k of hazir) {
      await page.evaluate((kk) => veFeadResPreset(kk), k);
      await page.waitForTimeout(800);
      await page.evaluate(() => { document.querySelectorAll('.ve-trace-note:not(.open) [data-act="note-toggle"]').forEach((b) => b.click()); });
      await page.waitForTimeout(150);
      await olc(page, '#ve-results-grid', 'sonuçlar/' + k, kotu);
      await olc(page, '#ve-results-browser', 'sonuçlar/' + k + ' · gezgin', kotu);
    }
    await page.evaluate(() => veFeadResSummaryOpen()); await page.waitForTimeout(700);
    await olc(page, '#ve-report-overlay', 'sonuç özeti', kotu);
    await page.keyboard.press('Escape');
    await page.evaluate(() => veSubTabDegistir('arac-performans'));
    const ek = await paletiTamamla(page, 'fead-analysis');
    expect(ek.length).toBeGreaterThan(0);
    await pencereler(page, kotu, ek);
    expect(kontrastOzet(kotu)).toEqual([]);
  });
}
