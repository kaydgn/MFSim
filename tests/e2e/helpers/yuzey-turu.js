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
const { githubFikstur } = require('./github-fikstur');

async function bootApp(page, { modul = 'arac-performans', tema = 'acik', kur, karsilama, w = 1600, h = 1000 } = {}) {
  await page.setViewportSize({ width: w, height: h });
  page.on('dialog', (d) => d.accept());
  // Program Durumu'nun commit listesi canlı değil SABİT (github-fikstur.js) —
  // turun sonucu başka oturumların o an yazdığına bağlı kalmasın.
  await githubFikstur(page);
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

// Modeldeki her bileşen tipinin penceresi, BAŞTAN SONA (`yalniz`: yalnız bu tipler).
// FEAD ve Takoz pencereleri 2026-10-16'dan beri TEK GÖVDE (kategoriler sekme
// değil, alt alta): ölçerler yalnız ekrandaki yazıyı sayar, bu yüzden pencere
// SAYFA SAYFA kaydırılarak ölçülür — sekme gezmenin yerine. Kaydırmadan
// ölçülseydi uzun pencerenin (kayış · çözücü) alt yarısı sessizce ölçü dışı
// kalırdı. Öteki programların sekmeleri (görüntüleyici, motor) yine gezilir.
const SEKME = '[role="tab"], .ve-tab-btn, .ve-panel-tab, .ve-mnt-tab';
const SAYFA_BINDIRME = 40;      // px — sayfa sınırında kesilen satır iki sayfada da ölçülür
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
      if (!ic) return { id: n.id, diger: 0 };
      return { id: n.id, diger: ic.querySelectorAll(S).length };
    }, [tip, SEKME]);
    const sayfa = await page.evaluate((B) => {
      const ic = document.querySelector('.ve-properties-content');
      if (!ic) return 1;
      ic.scrollTop = 0;
      return Math.max(1, Math.ceil((ic.scrollHeight - B) / Math.max(1, ic.clientHeight - B)));
    }, SAYFA_BINDIRME);
    for (let p = 0; p < sayfa; p++) {
      if (p) {
        await page.evaluate(([pp, B]) => {
          const ic = document.querySelector('.ve-properties-content');
          ic.scrollTop = pp * (ic.clientHeight - B);
        }, [p, SAYFA_BINDIRME]);
        await page.waitForTimeout(100);
      }
      olculen += (await olc('#ve-properties', tip + (p ? ' ↓' + (p + 1) : ''))).olculen;
    }
    await page.evaluate(() => { const ic = document.querySelector('.ve-properties-content'); if (ic) ic.scrollTop = 0; });
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
    // FARE ALTINDAKİ İŞARETSİZ SATIR: soluk yazı vurgu tülünün üstünde kalır —
    // koyu temada 4,497:1'di (AA 4,5) ve durağan ölçüm onu görmüyordu.
    const satir = page.locator('#ve-results-tree .vsig-row:not(.on)').first();
    if (await satir.count()) {
      await satir.hover();
      await page.waitForTimeout(200);   // zemin geçişi (.1 s)
      await olc('#ve-results-browser', yer + ' · gezgin (fare altı)');
      await page.mouse.move(0, 0);
    }
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
  expect(ik).toBeGreaterThan(90);   // Uyarılar paneli kalktı (Canlı Not 129): 98 öğe ölçülüyor
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
    veMntOrnekYukle('tulga');
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
  // AMC KÜNYESİ (2026-11-10): Takoz Özellikleri bir AMC tipinde — veri tablosu (görsel yok,
  // Canlı Not 111) ve Tip satırının (i) düğmesinin penceresi (teknik resim); tam tip (Cone 38
  // 60 ShA), resimli tip (Cone 38 40 ShA: sönüm, Z eğrisi) ve radyali tahmini tip (Cone 38
  // 50 ShA). Varsayılan seçim (LMT-1433-37) künyesiz. A+P (2026-11-10): konik yatak ve
  // H-takoz (dinamik tahmini, tolerans satırı). LASPAR (2026-11-11): programın LMT-1433-00'ı (tip
  // künyesi, A+P eşi), katalog konik (radyal ve dinamik tahmini), mobil (X · Y boş), TK040 (model kodu).
  for (const k of ['amc137963', 'amc137961', 'amc137962', 'ap1221402503', 'ap1221470202', 'lmt1433-00-55sh',
    'lp-lmt-1433-00-tk60', 'lp-mlmt-0608-04-tk45', 'TK040']) {
    await page.evaluate((kk) => {
      const n = nodes.find((x) => x.type === 'mnt-library') || createNode('mnt-library', 500, 300);
      n.data = n.data || {}; n.data._selKey = kk;
      clearSelection(); addToSelection(n); veTogglePropertiesPanel(true); showNodeProperties(n);
    }, k);
    await page.waitForTimeout(500);
    const sayfa = await page.evaluate((B) => {
      const ic = document.querySelector('.ve-properties-content');
      return ic ? Math.max(1, Math.ceil((ic.scrollHeight - B) / Math.max(1, ic.clientHeight - B))) : 1;
    }, SAYFA_BINDIRME);
    for (let s = 0; s < sayfa; s++) {
      await page.evaluate(([ss, B]) => { const ic = document.querySelector('.ve-properties-content'); if (ic) ic.scrollTop = ss * (ic.clientHeight - B); }, [s, SAYFA_BINDIRME]);
      await page.waitForTimeout(100);
      await olc('#ve-properties', 'Takoz Özellikleri · ' + k + (s ? ' ↓' + (s + 1) : ''));
    }
    if (k === 'amc137963') {
      await page.evaluate(() => { const ic = document.querySelector('.ve-properties-content'); if (ic) ic.scrollTop = 0; });
      await page.click('#ve-properties .mntlib-bilgi');
      await page.waitForFunction(() => { const i = document.querySelector('#ve-bas-buyuk-perde img'); return i && i.complete; }, null, { timeout: 10000 });
      await olc('#ve-bas-buyuk-perde', 'Takoz Özellikleri · teknik resim');
      await page.keyboard.press('Escape');
    }
    await page.evaluate(() => veTogglePropertiesPanel(false));
  }
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
  // ÖTEKİ ÜÇ ÖRNEĞİN TOPOLOJİSİ (yapışık ad): yalnız Tulga ölçülüyordu;
  // ASFAT'ta "Motor — Cummins X15E3 600" ile "Şanzıman + Retarder — Allison
  // 4700" üst üste biniyordu (−6 px). 10 Ton TTA on bir gövdeli. ASFAT SON:
  // aşağıdaki parametrik analiz onun üç grubunu tarar.
  for (const [k, imza] of [['siper', 'cradle'], ['tta10', '4500 SP'], ['asfat', 'Orta Takoz']]) {
    await page.evaluate((kk) => {
      veMntOrnekYukle(kk);
    }, k);
    await page.waitForFunction((im) => nodes.some((n) => (n.customName || '').indexOf(im) >= 0), imza, { timeout: 20000 });
    await page.waitForTimeout(800);
    await olc('#ve-canvas', 'topoloji · ' + k);
  }
  // PARAMETRİK ANALİZ (Canlı Not 1001'den beri adım adım kuruluyor): önce varsayılan görünüm
  // (Takoz yerleşimi + Tüm kombinasyonlar), sonra Özel kombinasyon — konum başına eklenen
  // tipler ve açık arama listesi (Canlı Not 1005). Eski pencere (tarama, Sonuç, galeri)
  // parkta: gerçek tarayıcıda mount-param-sonuc.spec.js onu yerine koyarak sınar.
  await page.evaluate(() => { createNode('mnt-parametric', 900, 120); });
  await pencereler(page, olc, ['mnt-parametric']);
  const ara = await page.evaluate(async () => {
    const n = nodes.find((x) => x.type === 'mnt-parametric');
    veMntParamAdayKip(n.id, 'ozel');
    const Y = _mntParamYeni(n), S = _mntParamListeSira(Y.A), G = Y.M.G;
    [[1, G[0].tip], [1, S[0].key], [G.length, S[S.length - 1].key]].forEach(([no, k]) => { if (k) veMntParamGrupAday(n.id, no, k, true); });
    clearSelection(); addToSelection(n); veTogglePropertiesPanel(true);
    await new Promise((r) => setTimeout(r, 450));
    const kutu = document.getElementById('ve-mnt-param-ara-' + n.id + '-1');
    if (!kutu) return null;
    // boş kutuya odak: marka başlıklı tablo (Canlı Not 1010)
    kutu.focus();
    await new Promise((r) => setTimeout(r, 300));
    const T = document.querySelector('#ve-properties .ve-prm-ara-l:not([hidden])');
    const baslik = T ? T.querySelectorAll('.ve-prm-ara-m').length : 0;
    // başlıklar kapalı gelir: ilk markanın okuyla açılır, tipleri satırlanır
    const ok = T && T.querySelector('.ve-prm-ara-ok');
    if (ok) ok.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 300));
    const T2 = document.querySelector('#ve-properties .ve-prm-ara-l:not([hidden])');
    const tablo = { baslik, tip: T2 ? T2.querySelectorAll('.ve-prm-ara-o').length : 0 };
    return { tablo };
  });
  expect(ara.tablo.baslik).toBeGreaterThanOrEqual(3);
  expect(ara.tablo.tip).toBeGreaterThan(ara.tablo.baslik);
  await olc('#ve-properties', 'mnt-parametric · Özel kombinasyon · marka tablosu');
  const ara2 = await page.evaluate(async () => {
    const n = nodes.find((x) => x.type === 'mnt-parametric');
    const kutu = document.getElementById('ve-mnt-param-ara-' + n.id + '-1');
    kutu.value = 'cone'; kutu.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 300));
    const L = document.querySelector('#ve-properties .ve-prm-ara-l:not([hidden])');
    return { satir: document.querySelectorAll('#ve-properties .ve-prm-oz-t li').length,
      secenek: L ? L.querySelectorAll('.ve-prm-ara-o').length : 0 };
  });
  Object.assign(ara, ara2);
  // son örnek ASFAT: mevcut tipleri aday değil (Canlı Not 133) — eklenen iki aday tip ve açık liste
  expect(ara.satir).toBeGreaterThanOrEqual(2);
  expect(ara.secenek).toBeGreaterThan(0);
  await olc('#ve-properties', 'mnt-parametric · Özel kombinasyon');
  // BEKLENEN TAKOZ SEHİMİ (2026-11-13): Çözücü'nün çözümüyle (Hesapla'nın çağrısı) ve 3–5 mm aralıkla —
  // alanlar açık, Analiz en düşük takoz yükü ve elenen sayısıyla.
  const eleme = await page.evaluate(async () => {
    const n = nodes.find((x) => x.type === 'mnt-parametric');
    veMntParamAdayKip(n.id, 'hepsi');
    await veMntSolverCompute(nodes.find((x) => x.type === 'mnt-solver').id);
    veMntParamSehim(n.id, 'alt', '3');
    veMntParamSehim(n.id, 'ust', '5');
    clearSelection(); addToSelection(n); veTogglePropertiesPanel(true);
    await new Promise((r) => setTimeout(r, 450));
    const b = document.querySelector('#ve-properties .ve-fp-kat[data-k="sehim"]');
    if (b) b.scrollIntoView({ block: 'start' });
    await new Promise((r) => setTimeout(r, 150));
    const alt = document.getElementById('ve-mnt-param-sehim-alt-' + n.id);
    return { aktif: _mntParamYeni(n).E.aktif, acik: !!alt && !alt.disabled };
  });
  expect(eleme).toEqual({ aktif: true, acik: true });
  await olc('#ve-properties', 'mnt-parametric · Beklenen takoz sehimi');
  await page.evaluate(() => veTogglePropertiesPanel(false));
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
