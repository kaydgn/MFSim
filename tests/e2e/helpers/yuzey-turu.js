/**
 * yuzey-turu.js (e2e) — EKRANIN TAMAMINI GEZEN TEK TUR
 * ─────────────────────────────────────────────────────────────────────────
 * Kontrast ve yerleşim kapıları AYNI yüzeyleri ölçer. Hangi pencerenin hangi
 * veriyle açılacağı BURADA; neyin ölçüleceği çağıranın `olc(kök, yer)`unda.
 * İki ayrı liste iki ayrı yüzey kümesi demekti — kontrast kapısı bir dönem
 * yalnız örnek modelin tiplerini açıyordu ve paletin geri kalanında 66 ölçüm
 * AA altında kalmıştı.
 *
 * `olc(kök, yer)` → { olculen } döner; kök ölçülemiyorsa olculen 0.
 */
const { expect } = require('@playwright/test');
const { motorluOrnekler } = require('./fead-motor');

async function bootApp(page, { modul = 'arac-performans', tema = 'acik', kur, karsilama, w = 1600, h = 1000 } = {}) {
  await page.setViewportSize({ width: w, height: h });
  page.on('dialog', (d) => d.accept());
  await page.goto('/index.html');
  await page.evaluate(() => { if (window.MFSimLoader && MFSimLoader.start) MFSimLoader.start(); });
  await page.waitForFunction(() =>
    typeof window.createNode === 'function' && typeof window.veFeadOpenEditor === 'function' &&
    Array.isArray(window.nodes), null, { timeout: 90000 });
  if (kur) await kur(page);
  await page.evaluate((t) => changeTheme(t), tema);
  if (karsilama) {
    // Karşılamanın giriş animasyonu BİTTİKTEN sonra (yazı opaklıktan gelir)
    await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'), null, { timeout: 15000 }).catch(() => {});
    await karsilama();
  }
  await page.evaluate((m) => { if (typeof veSelectModuleFromOverlay === 'function') veSelectModuleFromOverlay(m); }, modul);
  await page.waitForFunction(() => {
    const s = document.getElementById('mfsim-loading-screen');
    return !s || s.style.display === 'none';
  }, null, { timeout: 90000 });
  await page.waitForTimeout(400);
}

// Modeldeki her bileşen tipinin penceresi, her sekmesiyle (`yalniz`: yalnız bu tipler).
const SEKME = '[role="tab"]:not(.ve-fp-tab), .ve-tab-btn, .ve-panel-tab, .ve-mnt-tab';
async function pencereler(page, olc, yalniz) {
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
    olculen += (await olc('#ve-properties', tip)).olculen;
    for (const k of sekme.fead.slice(1)) {
      await page.evaluate(([id, kk]) => veFeadPanelTab(id, kk), [sekme.id, k]);
      await page.waitForTimeout(100);
      olculen += (await olc('#ve-properties', tip + '/' + k)).olculen;
    }
    for (let i = 1; i < sekme.diger; i++) {
      await page.evaluate(([j, S]) => {
        const l = document.querySelector('.ve-properties-content').querySelectorAll(S);
        if (l[j]) l[j].click();
      }, [i, SEKME]);
      await page.waitForTimeout(250);
      olculen += (await olc('#ve-properties', tip + '/' + (i + 1))).olculen;
    }
    await page.evaluate(() => veTogglePropertiesPanel(false));
    await page.waitForTimeout(120);
  }
  return { tip: tipler.length, olculen };
}

// PALETİN GERİ KALANI: örnek modelde olmayan her tipten bir düğüm kurulur.
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
async function ikincil(page, olc, yer, ac, kok, arg) {
  await page.evaluate(ac, arg);
  await page.waitForSelector(kok, { state: 'visible', timeout: 5000 });
  await page.mouse.move(2, 2);                        // fare altı vurgusu ölçüme karışmasın
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'), null, { timeout: 5000 }).catch(() => {});
  const r = await olc(kok, yer);
  expect(`${yer}: ${r.olculen > 0}`).toBe(`${yer}: true`);
  await page.keyboard.press('Escape'); await page.waitForTimeout(250);
  return r.olculen;
}

// Sonuçlar: Veri Gezgini (işaretli + işaretsiz satır) ve pano.
async function sonuclar(page, olc, yer, sinyalSec) {
  await page.evaluate(() => veSubTabDegistir('sonuclar'));
  await page.waitForTimeout(700);
  await olc('#ve-results-browser', yer + ' · gezgin');
  await olc('#ve-results-grid', yer + ' · boş pano');
  if (sinyalSec) {
    await page.evaluate(sinyalSec);
    await page.waitForTimeout(900);
    await olc('#ve-results-browser', yer + ' · gezgin (seçili)');
    await olc('#ve-results-grid', yer + ' · pano');
  }
}

// ── TURLAR ───────────────────────────────────────────────────────────────
async function kabukTuru(page, olc) {
  await page.evaluate(() => veProgramArsiviOpen()); await page.waitForTimeout(500);
  await olc('#ve-programlar', 'arşiv');
  await page.evaluate(() => veProgramArsiviClose());
  await page.evaluate(() => veOpenStatusModal()); await page.waitForTimeout(500);
  await olc('#ve-status-overlay', 'program durumu');
  await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  await page.evaluate(() => veCmdkOpen()); await page.waitForTimeout(400);
  await olc('#ve-cmdk', 'komut paleti');
  await page.evaluate(() => veCmdkClose());
  await ikincil(page, olc, 'klavye kısayolları', () => veShortcutsHelpOpen(), '#ve-help');
  await ikincil(page, olc, 'ölçüm içe aktarma', () => veImpOpenModal(), '#ve-import-overlay');
  await page.evaluate(() => veOpenSettings()); await page.waitForTimeout(300);
  const bolumler = await page.evaluate(() => [...document.querySelectorAll('.ve-settings-nav-item')].map((b) => b.getAttribute('data-section')));
  expect(bolumler.length).toBeGreaterThanOrEqual(5);
  for (const b of bolumler) {
    await page.evaluate((s) => veSettingsShowSection(s), b);
    await page.waitForTimeout(150);
    await olc('#ve-settings-overlay', 'ayarlar/' + b);
  }
  await page.keyboard.press('Escape');
}

async function apTuru(page, olc) {
  await page.evaluate(() => {
    let ex = nodes.find((x) => x.type === 'ap-example'); if (!ex) ex = createNode('ap-example', 300, 200);
    ex.data = ex.data || {}; ex.data.exampleKey = 'isb340_tc411'; veApLoadExample(ex.id);
  });
  await page.waitForFunction(() => nodes.some((n) => n.type === 'shift-controller'), null, { timeout: 20000 });
  await page.waitForTimeout(800);
  await olc('#ve-canvas', 'topoloji');                     // düğüm adları (yapışık ad)
  const p = await pencereler(page, olc);
  expect(p.tip).toBeGreaterThan(8);
  expect(p.olculen).toBeGreaterThan(500);                 // tarama gerçekten ölçüyor
  await page.evaluate(() => veSolverRunProfessional());
  await page.waitForFunction(() => { const b = document.getElementById('ve-solver-modal-close'); return b && b.style.display !== 'none'; }, null, { timeout: 120000 });
  const g = await olc('#ve-solver-modal-overlay', 'çözücü');
  expect(g.olculen).toBeGreaterThan(30);
  await page.evaluate(() => document.getElementById('ve-solver-modal-close').click());
  await page.evaluate(() => veShowRaporModal()); await page.waitForTimeout(300);
  await olc('#ve-rapor-modal-overlay', 'rapor penceresi');
  await page.evaluate(() => veCloseRaporModal());
  await sonuclar(page, olc, 'sonuçlar', () => {
    let n = 0;
    for (const c of document.querySelectorAll('#ve-results-tree .vsig-row .vsig-ck')) { if (n >= 4) break; c.click(); n++; }
  });
  // Çözümden SONRA: bağlanmamış ek düğümler çözücüyü etkilemesin
  await page.evaluate(() => veSubTabDegistir('arac-performans'));
  const ek = await paletiTamamla(page, 'arac-performans');
  expect(ek).toEqual(expect.arrayContaining(['sensor-wizard', 'coast-down', 'road', 'acc-alternator']));
  expect((await pencereler(page, olc, ek)).olculen).toBeGreaterThan(300);
  let ik = 0;
  ik += await ikincil(page, olc, 'eşleştirme büyük diyagram', () => ecmExpandChart(nodes.find((n) => n.type === 'ec-matching').id),
    '#ecm-chart-modal-overlay');
  ik += await ikincil(page, olc, 'yavaşlama sihirbazı', async () => {
    veOpenCoastDownWizard(nodes.find((n) => n.type === 'coast-down').id);
    await new Promise((r) => setTimeout(r, 400));
    cdwLoadExample(); cdwComputeCrr();
  }, '#ve-cd-wizard-overlay');
  // Yol: elle segment girilince açılan tablo, özet ve büyük profil
  const yol = await page.evaluate(() => {
    const n = nodes.find((x) => x.type === 'road');
    [['down', 6, 1000], ['up', 4, 800], ['flat', 0, 500]].forEach(([y, g, m]) => {
      veManualSegAdd(n.id);
      Object.assign(n.data.manualSegments[n.data.manualSegments.length - 1], { direction: y, gradePct: g, distance: m });
    });
    return n.id;
  });
  await pencereler(page, olc, ['road']);
  ik += await ikincil(page, olc, 'yol profili büyük', (id) => veManualSegExpandProfile(id), '#ve-mseg-profile-overlay', yol);
  ik += await ikincil(page, olc, 'uyarılar paneli', () => veOpenWarningsPanel(), '#ve-warnings-panel');
  await page.evaluate(() => veSetWarningsOpen(false));
  expect(ik).toBeGreaterThan(100);
}

// SİHİRBAZ RAYI FARE ALTINDA: dinlenme ölçüsü durumu görmez — etkin olmayan
// adımın zemini fare altında vurgu tonuna döner ve ipucu orada okunmalı
// (ölçüldü: soluk jeton 4,43:1 açık · 4,23:1 koyu).
async function rayFareAlti(page, olc, kok, yer) {
  const adim = page.locator(kok + ' .ve-fw-step:not(.on)').first();
  if (!(await adim.count())) return;
  await adim.hover();
  await page.waitForTimeout(200);   // zemin geçişi (.12 s)
  await olc(kok + ' .ve-fw-steps', yer + '/ray (fare altı)');
  await page.mouse.move(0, 0);
}

async function takozTuru(page, olc) {
  // Boş Takoz topolojisini başlangıç sayfası karşılar (FEAD'inkiyle aynı kit).
  // Tur kök topolojide geziyor: sayfa için modüle girilir, ölçülür, çıkılır ve
  // kart silinir — turun geri kalanı birebir eskisi.
  await page.evaluate(() => { const n = createNode('mount-analysis', 400, 300); veMntOpenEditor(n.id); });
  await page.waitForFunction(() => veMntBaslangicAcik(), null, { timeout: 15000 });
  await page.waitForTimeout(400);   // modüle giriş geçişi (FEAD turuyla aynı bekleyiş)
  await olc('#ve-canvas-wrapper', 'başlangıç');
  // BOŞ SİHİRBAZ (başlangıç sayfasının "Sihirbazla kur"u): masanın boş hâli
  // turda yoktu — yönergesi koyu temada ızgara çizgisine karşı 4,23:1'di.
  const bosAdim = await page.evaluate(() => { veMntWizAc(); return VE_MW_STEPS.length; });
  for (let i = 0; i < bosAdim; i++) {
    await page.evaluate((j) => veMntWizGoto(j), i);
    await page.waitForTimeout(300);
    await olc('#ve-mntwiz-overlay', 'sihirbaz (boş)/' + (i + 1));
  }
  await page.evaluate(() => veMntWizKapat(false));
  await page.evaluate(() => {
    veMntCloseEditor(true);
    const m = nodes.find((x) => x.type === 'mount-analysis');
    if (m) { clearSelection(); addToSelection(m); deleteSelectedNodes(); }
  });
  await page.waitForFunction(() => !nodes.some((x) => x.type === 'mount-analysis'), null, { timeout: 5000 });
  await page.evaluate(() => {
    let ex = nodes.find((x) => x.type === 'mnt-example'); if (!ex) ex = createNode('mnt-example', 300, 200);
    ex.data = ex.data || {}; ex.data.exampleKey = 'tulga'; veMntLoadExample(ex.id);
  });
  await page.waitForFunction(() => nodes.some((n) => n.type === 'mnt-solver'), null, { timeout: 20000 });
  await page.waitForTimeout(800);
  await olc('#ve-canvas', 'topoloji');                     // düğüm adları (yapışık ad)
  await page.evaluate(async () => { const s = nodes.find((n) => n.type === 'mnt-solver'); await veMntSolverCompute(s.id); });
  await page.waitForFunction(() => typeof veMntSets === 'function' && veMntSets().length > 0, null, { timeout: 180000 });
  // Sihirbaz: tuvaldeki modelle (Tulga) tohumlanır, her adım — FEAD turuyla
  // aynı kalıp. Turda yoktu ve iki kapı da onu görmüyordu (C2: "f₁" hapı).
  const adim = await page.evaluate(() => { veMntWizAc(); return VE_MW_STEPS.length; });
  for (let i = 0; i < adim; i++) {
    await page.evaluate((j) => veMntWizGoto(j), i);
    await page.waitForTimeout(450);
    await olc('#ve-mntwiz-overlay', 'sihirbaz/' + (i + 1));
  }
  await rayFareAlti(page, olc, '#ve-mntwiz-overlay', 'sihirbaz');
  await page.evaluate(() => veMntWizKapat(false));
  const p = await pencereler(page, olc);
  expect(p.olculen).toBeGreaterThan(300);
  await sonuclar(page, olc, 'sonuçlar', () => {
    if (typeof veSwitchSolverTab === 'function') veSwitchSolverTab('mount');
    veUpdateResultsTree();
    let n = 0;
    for (const c of document.querySelectorAll('#ve-results-tree .vsig-row .vsig-ck')) { if (n >= 3) break; c.click(); n++; }
  });
  await page.evaluate(() => veSubTabDegistir('arac-performans'));
  const ek = await paletiTamamla(page, 'mount-analysis');
  expect(ek.length).toBeGreaterThan(0);
  await pencereler(page, olc, ek);
}

async function feadTuru(page, olc) {
  // Gates örnekleri motor devirlerini taşımıyor; işletme hesabı onlarsız koşmaz (FEAD kural 46).
  await motorluOrnekler(page);
  await page.evaluate(() => { const n = createNode('fead-analysis', 400, 300); veFeadOpenEditor(n.id); });
  await page.waitForTimeout(400);
  await olc('#ve-canvas-wrapper', 'başlangıç');
  await page.evaluate(() => { if (typeof veFeadWizClose === 'function') veFeadWizClose(false); });
  await page.evaluate(() => veFeadLoadExample('AG00976_GATES_2025'));
  await page.waitForFunction(() => window.nodes.filter((n) => n.type === 'fead-layout').length === 2, null, { timeout: 20000 });
  await page.waitForTimeout(600);
  const p = await pencereler(page, olc);
  expect(p.olculen).toBeGreaterThan(1000);
  await olc('#ve-canvas', 'kanvas');
  await olc('.ve-fead-arac', 'araçlar');
  // Sihirbaz: örnekle doldurulmuş, her adım
  const adim = await page.evaluate(() => { veFeadWizOpenAny(); veFeadWizSeed('AG00976_GATES_2025'); return VE_FW_STEPS.length; });
  for (let i = 0; i < adim; i++) {
    await page.evaluate((j) => veFeadWizGoto(j), i);
    await page.waitForTimeout(450);
    await olc('#ve-feadwiz-overlay', 'sihirbaz/' + (i + 1));
  }
  await rayFareAlti(page, olc, '#ve-feadwiz-overlay', 'sihirbaz');
  await page.evaluate(() => veFeadWizClose(false));
  // Çözüm → Sonuçlar: gezgin, hazır diyagramlar (yorum notu açık), özet
  await page.evaluate(() => { const s = nodes.find((n) => n.type === 'fead-solver'); veFeadSolve(s.id); });
  await page.waitForFunction(() => window.veFeadResults && (window.veFeadResults.ok || window.veFeadResults.error), null, { timeout: 90000 });
  await page.evaluate(() => veFeadOpenResults()); await page.waitForTimeout(1200);
  await olc('#ve-results-browser', 'sonuçlar · gezgin');
  const hazir = await page.evaluate(() => veFeadSignals.presets(window.veFeadResults.signals).map((x) => x.k));
  expect(hazir.length).toBeGreaterThan(2);
  for (const k of hazir) {
    await page.evaluate((kk) => veFeadResPreset(kk), k);
    await page.waitForTimeout(800);
    await page.evaluate(() => { document.querySelectorAll('.ve-trace-note:not(.open) [data-act="note-toggle"]').forEach((b) => b.click()); });
    await page.waitForTimeout(150);
    await olc('#ve-results-grid', 'sonuçlar/' + k);
    await olc('#ve-results-browser', 'sonuçlar/' + k + ' · gezgin');
  }
  await page.evaluate(() => veFeadResSummaryOpen()); await page.waitForTimeout(700);
  await olc('#ve-report-overlay', 'sonuç özeti');
  await page.keyboard.press('Escape');
  await page.evaluate(() => veSubTabDegistir('arac-performans'));
  const ek = await paletiTamamla(page, 'fead-analysis');
  expect(ek.length).toBeGreaterThan(0);
  await pencereler(page, olc, ek);
}

module.exports = { bootApp, pencereler, paletiTamamla, ikincil, sonuclar, kabukTuru, apTuru, takozTuru, feadTuru };
