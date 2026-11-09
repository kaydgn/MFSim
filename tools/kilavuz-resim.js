// ============================================================================
// tools/kilavuz-resim.js — KILAVUZUN EKRAN GÖRÜNTÜLERİ
// ────────────────────────────────────────────────────────────────────────────
// Kullanıcı 2026-11-09: *"kullanıcı kılavuzunu baştan sona okuyan birisi,
// programı açtığı andan itibaren ne yaptığını bilmeli … bol bol görseller ile,
// yönlendirmeler ile, işaretler ile kullanıcı hep bilgilendirilmeli."*
//
// Kılavuzun şekillerinin çoğu programın KENDİ üreticisinden çizilir (pencereler,
// başlangıç sayfası — js/guide-kit.js → veGuideScene): eskimez, boyut tutmaz.
// HTML olarak çizilemeyen yüzeyler — karşılama, tuval, bileşen penceresinin
// ekrandaki yeri, sihirbazın masası, 3B görüntüleyici — buradan gelir:
//
//   node tools/kilavuz-resim.js [ad ...] [--kuru]
//       programı (tek dosya, karşılama karesiz) gerçek tarayıcıda DURAKLAR
//       sırasıyla gezer; her durakta ekranın görüntüsü (webp) ve işaretlenecek
//       öğelerin kutuları — DOM'dan ölçülür, resmin oranı (0…1) —
//       → assets/kilavuz/<ad>.webp + assets/kilavuz/kunye.json
//
// Program bunları derlemede gömer (build.js → __MFSIM_KILAVUZ, `gomulecekler`).
// İşaretin kutusu elle yazılmaz: kılavuz numarayı anahtardan koyar.
//
// ESKİMEZ: tests/e2e/kilavuz-resim.spec.js aynı turu görüntüsüz yürür ve
// kutuları künyeyle karşılaştırır — program değişip öğe kayınca kapı kırmızı,
// çare bu araç. Görüntü yalnız bu araçla yenilenir (kullanıcı onaylı iş:
// kılavuzun görseli — tools/shot.js'in "yalnız istenince" kuralı onun için).
// ============================================================================
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const KOK = path.join(__dirname, '..');
const KLASOR = path.join(KOK, 'assets', 'kilavuz');
const KUNYE = path.join(KLASOR, 'kunye.json');
const EKRAN = { width: 1280, height: 800 };
const KALITE = 0.86;
const RESIM_TAVAN = 160 * 1024;    // tek görüntü; Canlı Not'un 16 MB sınırı ortak
const CHROMIUM = process.env.MFSIM_CHROMIUM || '';

// ── DERLEMEDE GÖMÜLECEKLER ────────────────────────────────────────────────
// { ad: { src, g, y, isaret } } — künyede olup dosyası olmayan atlanır.
function gomulecekler(klasor) {
  const k = klasor || KLASOR, f = path.join(k, 'kunye.json'), out = {};
  if (!fs.existsSync(f)) return out;
  const kunye = JSON.parse(fs.readFileSync(f, 'utf8'));
  Object.keys(kunye.resim || {}).forEach((ad) => {
    const d = path.join(k, ad + '.webp');
    if (!fs.existsSync(d)) return;
    const r = kunye.resim[ad];
    out[ad] = { src: 'data:image/webp;base64,' + fs.readFileSync(d).toString('base64'), g: r.g, y: r.y, isaret: r.isaret };
  });
  return out;
}

// ── SAYFANIN İÇİNDE: işaretin kutusu ──────────────────────────────────────
// Tanım: 'css seçici' | { s, metin, ust } (yazısı tam bu olan en derin öğe;
// `ust` verilirse onun o seçiciye uyan atası) | { hepsi: 'seçici' } (eşleşenlerin
// birleşimi). Görünmeyen öğe null.
function _sayfaOlc(tanimlar, kirp) {
  const gorunur = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 ? r : null; };
  const metinle = (kok, metin) => {
    let bul = null;
    kok.querySelectorAll('*').forEach((e) => {
      if ((e.textContent || '').replace(/\s+/g, ' ').trim() === metin && gorunur(e)) bul = e;
    });
    return bul;
  };
  const kutu = (t) => {
    if (typeof t === 'string') { const e = [...document.querySelectorAll(t)].find(gorunur); return e ? gorunur(e) : null; }
    if (t.hepsi) {
      const L = [...document.querySelectorAll(t.hepsi)].map(gorunur).filter(Boolean);
      if (!L.length) return null;
      return { left: Math.min(...L.map((r) => r.left)), top: Math.min(...L.map((r) => r.top)),
        right: Math.max(...L.map((r) => r.right)), bottom: Math.max(...L.map((r) => r.bottom)) };
    }
    const kapsam = t.s ? [...document.querySelectorAll(t.s)].find(gorunur) : document.body;
    if (!kapsam) return null;
    let e = t.metin ? metinle(kapsam, t.metin) : kapsam;
    if (e && t.ust) e = e.closest(t.ust) || e;
    return e ? gorunur(e) : null;
  };
  const K = kirp || { x: 0, y: 0, w: innerWidth, h: innerHeight };
  const out = {}, yok = [];
  Object.keys(tanimlar).forEach((k) => {
    const r = kutu(tanimlar[k]);
    if (!r) { yok.push(k); return; }
    const sinir = (v, a) => Math.max(0, Math.min(1, v / a));
    out[k] = [sinir(r.left - K.x, K.w), sinir(r.top - K.y, K.h), sinir(r.right - K.x, K.w), sinir(r.bottom - K.y, K.h)]
      .map((v) => Math.round(v * 10000) / 10000);
  });
  return { isaret: out, yok: yok };
}

// Kırpma: `s` ilk görünen öğe, `hepsi` görünen öğelerin birleşimi; `pay` dört
// yanda, `y` boyun tavanı (üstten).
function _sayfaKirp(o) {
  const tanim = o && (o.s || o.hepsi), pay = o && o.pay;
  if (!tanim) return null;
  const L = [...document.querySelectorAll(tanim)].map((x) => x.getBoundingClientRect()).filter((x) => x.width > 0);
  if (!L.length) return null;
  const r = o.hepsi ? { left: Math.min(...L.map((x) => x.left)), top: Math.min(...L.map((x) => x.top)),
    right: Math.max(...L.map((x) => x.right)), bottom: Math.max(...L.map((x) => x.bottom)) } : L[0];
  const p = pay || 0;
  const x = Math.max(0, Math.floor(r.left - p)), y = Math.max(0, Math.floor(r.top - p));
  const h = Math.min(innerHeight, Math.ceil(r.bottom + p)) - y;
  return { x: x, y: y, w: Math.min(innerWidth, Math.ceil(r.right + p)) - x, h: o.y ? Math.min(h, o.y) : h };
}

// ── YARDIMCILAR ───────────────────────────────────────────────────────────
const bekle = (p, ms) => p.waitForTimeout(ms);
async function sus(p) {
  // Bildirimler ve seçim görüntüye girmesin; imleç tuvalden çekilir.
  await p.evaluate(() => {
    document.querySelectorAll('.ve-toast').forEach((t) => t.remove());
    if (typeof clearSelection === 'function') clearSelection();
  });
  await p.mouse.move(2, EKRAN.height - 2);
}
async function dugumKimlik(p, tip) {
  return p.evaluate((t) => { const n = (window.nodes || []).find((x) => x.type === t); return n ? n.id : null; }, tip);
}

// ── DURAKLAR — sıra durumu taşır (karşılama → Takoz → sihirbaz → örnek …) ──
// `isaret`: anahtar → tanım (yukarıda). Anahtar kılavuzda numaraya döner.
const DURAKLAR = [
  {
    ad: 'karsilama',
    kirp: { s: '.ve-kesik-ic', pay: 28 },
    isaret: {
      takoz: '.ve-module-card[data-module="mount-analysis"]',
      moduller: '.ve-module-overlay-grid',
      proje: '.ve-welcome-open',
      kilavuzlar: { s: '.ve-welcome-links', metin: 'Kılavuzlar' },
    },
    async kur() {},
  },
  {
    ad: 'sihirbaz',
    isaret: {
      adimlar: '#ve-mw-nav .ve-fw-steps',
      masa: '#ve-mw-masa',
      durum: '#ve-mw-live',
      gorunus: '#ve-mw-masa .ve-fw-masa-arac',
      step: '#ve-mw-yan .ve-fw-stp',
      ornek: '#ve-mw-yan .ve-mw-ornek',
      ileri: '#ve-mw-eylem .ve-fw-btn-primary',
      kapat: '#ve-mw-title ~ .ve-settings-close',
      talimat: '#ve-mw-nav .ve-mw-talimat > h3:nth-of-type(1)',
      eksikler: '#ve-mw-nav .ve-mw-talimat > h3:nth-of-type(2)',
    },
    async kur(p) {
      await p.click('.ve-module-card[data-module="mount-analysis"]');
      await p.locator('#ve-mnt-baslangic').waitFor();
      await p.click('#ve-mnt-baslangic .ve-bas-kapi[data-ey="sihirbaz"]');
      await p.locator('#ve-mw-nav').waitFor();
      await p.selectOption('#ve-mw-yan .ve-mw-ornek select', 'siper');
      await bekle(p, 1200);
    },
    async son(p) {
      await p.keyboard.press('Escape');
      await bekle(p, 500);
    },
  },
  {
    ad: 'tuval',
    isaret: {
      komutlar: '#ve-rb-expand',
      bilesenler: '#ve-sidebar-reveal',
      topoloji: '.ve-nav-item[data-subtab="arac-performans"]',
      sonuclar: '.ve-nav-item[data-subtab="sonuclar"]',
      geri: '#ve-mnt-breadcrumb button',
      motor: { hepsi: '[data-type="mnt-motor"] .ve-node-box' },
      takoz: { hepsi: '[data-type="mnt-mount"] .ve-node-box' },
      cozucu: { hepsi: '[data-type="mnt-solver"] .ve-node-box' },
      baslangic: { hepsi: '[data-type="mnt-example"] .ve-node-box' },
      rapor: { hepsi: '[data-type="mnt-report"] .ve-node-box' },
      gorunumler: { hepsi: '[data-type="mnt-2dview"] .ve-node-box' },
      goruntuleyici: { hepsi: '[data-type="mnt-viewer"] .ve-node-box' },
      uyarilar: '#ve-warnings-chip',
      sayac: '#ve-status-counts',
      yakinlik: '#ve-status-zoom',
      harita: '#ve-minimap',
    },
    async kur(p) {
      await p.locator('#ve-mnt-baslangic .ve-bas-satir').filter({ hasText: 'Siper' })
        .locator('button', { hasText: 'Yükle' }).first().click();
      await p.waitForFunction(() => (window.nodes || []).some((n) => n.type === 'mnt-motor'));
      await bekle(p, 900);
      await sus(p);
      await bekle(p, 300);
    },
  },
  {
    ad: 'palet',
    isaret: {
      palet: '#ve-sidebar',
      daralt: '#ve-sidebar .ve-sidebar-header button',
      grup: '#ve-sidebar .ve-category[data-ve-scope="mount-analysis"] .ve-category-title',
      motor: '#ve-sidebar .ve-component[data-type="mnt-motor"]',
      takoz: '#ve-sidebar .ve-component[data-type="mnt-mount"]',
      ozellik: '#ve-sidebar .ve-component[data-type="mnt-library"]',
      parametrik: '#ve-sidebar .ve-component[data-type="mnt-parametric"]',
      tuval: '#ve-canvas-wrapper',
    },
    async kur(p) {
      await p.evaluate(() => { if (typeof veMufettisKapat === 'function') veMufettisKapat(); });
      await p.click('#ve-sidebar-reveal');
      await bekle(p, 700);
      await sus(p);
      await bekle(p, 200);
    },
    async son(p) {
      await p.click('#ve-sidebar .ve-sidebar-header button');
      await bekle(p, 600);
    },
  },
  {
    ad: 'pencere',
    isaret: {
      pencere: '#ve-properties',
      baslik: '#ve-properties-title',
      kapat: '#ve-properties .ve-properties-close',
      kimlik: '#ve-properties .ve-prop-identity',
      adlandir: '#ve-properties .ve-prop-nameedit',
      sil: '#ve-properties .ve-prop-del',
      ilkbolum: { hepsi: '#ve-properties .ve-fp-kat:first-of-type' },
      konu: { hepsi: '[data-type="mnt-motor"] .ve-node-box' },
    },
    async kur(p) {
      const id = await dugumKimlik(p, 'mnt-motor');
      await p.dblclick('#' + id + ' .ve-node-box');
      await p.locator('#ve-properties').waitFor();
      await bekle(p, 700);
      await p.evaluate(() => document.querySelectorAll('.ve-toast').forEach((t) => t.remove()));
      await p.mouse.move(2, EKRAN.height - 2);
      await bekle(p, 200);
    },
  },
  {
    ad: 'pencere-ust',
    kirp: { s: '#ve-properties', pay: 0, y: 300 },
    isaret: {
      baslik: '#ve-properties-title',
      kapat: '#ve-properties .ve-properties-close',
      kimlik: '#ve-properties .ve-prop-identity',
      adlandir: '#ve-properties .ve-prop-nameedit',
      sil: '#ve-properties .ve-prop-del',
      ilkbolum: { hepsi: '#ve-properties .ve-fp-kat:first-of-type' },
    },
  },
  {
    ad: 'komutlar',
    kirp: { s: '#ve-rb-dock', pay: 40 },
    isaret: {
      dugme: '#ve-rb-expand',
      yeni: { s: '#ve-rb-dock', metin: 'Yeni proje', ust: 'button' },
      ac: { s: '#ve-rb-dock', metin: 'Proje aç', ust: 'button' },
      kaydet: { s: '#ve-rb-dock', metin: 'Kaydet', ust: 'button' },
      geri: { s: '#ve-rb-dock', metin: 'Geri al', ust: 'button' },
      ileri: { s: '#ve-rb-dock', metin: 'İleri al', ust: 'button' },
      duzenle: { s: '#ve-rb-dock', metin: 'Otomatik düzenle', ust: 'button' },
    },
    async kur(p) {
      await p.evaluate(() => { if (typeof veMufettisKapat === 'function') veMufettisKapat(); });
      await p.click('#ve-rb-expand');
      await p.locator('#ve-rb-dock').waitFor();
      await bekle(p, 500);
    },
    async son(p) {
      await p.keyboard.press('Escape');
      await bekle(p, 400);
    },
  },
  {
    ad: 'sonuclar',
    isaret: {
      ray: '.ve-nav-item[data-subtab="sonuclar"]',
      gezgin: '#ve-results-browser',
      ara: '#ve-results-search',
      durum: '#ve-results-browser .ve-fr-chip',
      grup: '#ve-results-browser .vsig-group[data-grp="mnt:frf"] > .vsig-ghead',
      sinyal: '#ve-results-browser .vsig-row[data-sig="~mnt-frf"][data-sid="T_2"]',
      eksen: '#ve-trace-toolbar [data-act="xaxis"]',
      gorunum: '#ve-trace-toolbar .ve-trace-seg',
      cizim: '#ve-trace-scroll',
      yorum: { hepsi: '.ve-trace-note-head, .ve-trace-note-body' },
    },
    async kur(p) {
      const id = await dugumKimlik(p, 'mnt-solver');
      await p.dblclick('#' + id + ' .ve-node-box');
      await p.locator('#ve-properties').getByRole('button', { name: 'Hesapla' }).click();
      await p.waitForFunction(() => window._veMntLast && !window._veMntLast.error, null, { timeout: 60000 });
      await bekle(p, 800);
      await p.evaluate(() => { if (typeof veMufettisKapat === 'function') veMufettisKapat(); });
      await p.click('.ve-nav-item[data-subtab="sonuclar"]');
      await p.locator('#ve-results-browser .vsig-row[data-sid="T_2"]').first().waitFor();
      await p.locator('#ve-results-browser .vsig-row[data-sid="T_2"] .vsig-ck[data-act="toggle"]').first().click();
      await bekle(p, 1200);
      await sus(p);
      await bekle(p, 300);
    },
    async son(p) {
      await p.click('.ve-nav-item[data-subtab="arac-performans"]');
      await bekle(p, 800);
    },
  },
  {
    // HIZLI ATAMA (Canlı Not 94): dosya okununca ana roller verilmemişse kart sorar;
    // satırlar GERÇEK tıkla seçilir (kartın yolu), Takoz adımında iki takoz seçili.
    ad: '3b-hizli',
    kirp: { hepsi: '#ve-mw-3b-agac, #ve-mw-3b-hizli', pay: 14, y: 300 },
    isaret: {
      kart: '#ve-mw-3b-hizli',
      rol: '#ve-mw-3b-hizli .ve-mw-3b-hizli-rol',
      say: '#ve-mw-3b-hizli .ve-mw-3b-hizli-say',
      geri: '#ve-mw-3b-hizli [data-hizli="geri"]',
      ileri: '#ve-mw-3b-hizli [data-hizli="ileri"]',
      bitir: '#ve-mw-3b-hizli [data-hizli="bitir"]',
      agacrol: { s: '#ve-mw-3b-agac', metin: 'Motor', ust: '.ve-mw-3b-agac-rol' },
    },
    async kur(p, ctx) {
      // Örnekli tuvalden: 3D Görüntüleyici'nin penceresi dosyayı okur, 3B açılır
      await p.evaluate(() => { if (typeof veMufettisKapat === 'function') veMufettisKapat(); });
      const id = await dugumKimlik(p, 'mnt-viewer');
      await p.dblclick('#' + id + ' .ve-node-box');
      await p.locator('#ve-properties').waitFor();
      const [fc] = await Promise.all([
        p.waitForEvent('filechooser', { timeout: 8000 }),
        p.locator('#ve-properties').getByText('STEP dosyası seç…').first().click(),
      ]);
      await fc.setFiles(ctx.step);
      await p.waitForFunction(() => { const k = document.getElementById('ve-mw-3b-tuval'); return k && k.getAttribute('data-durum') === 'hazir'; }, null, { timeout: 120000 });
      await p.locator('#ve-mw-3b-hizli:not([hidden])').waitFor({ timeout: 10000 });
      const satir = (ad) => p.locator('#ve-mw-3b-agac .ve-mw-3b-agac-ad').filter({ hasText: new RegExp('^' + ad + '$') }).first();
      for (const ad of ['Motor bloğu', 'Şanzıman gövdesi', 'Transfer gövdesi', 'Ön takoz', 'Sağ ön takoz']) {
        await satir(ad).click();
        await bekle(p, 250);
      }
      await p.evaluate(() => document.querySelectorAll('.ve-toast').forEach((t) => t.remove()));
      await p.mouse.move(EKRAN.width / 2, EKRAN.height - 4);
      await bekle(p, 400);
    },
  },
  {
    ad: '3b',
    isaret: {
      agac: '#ve-mw-3b-agac',
      dosya: '#ve-mw-3b-agac .ve-mw-3b-dock-bas',
      ara: '.ve-mw-3b-ara',
      tuval: '#ve-mw-3b-tuval',
      kapat: '#ve-mw-3b-kapat',
      eksen: '#ve-mw-3b-eksen',
      ozellikler: '#ve-mw-3b-yan',
      rol: '#ve-mw-3b-rol',
      birimler: '#ve-mw-3b-birimler',
      eylem: '#ve-mw-3b-eylem',
      durum: '#ve-mw-3b-durum',
    },
    async kur(p) {
      // Hızlı atamanın kartı Bitir'le kapanır; kalan takozlar ve hesap
      await p.click('#ve-mw-3b-hizli [data-hizli="bitir"]');
      await p.locator('#ve-mw-3b-hizli').waitFor({ state: 'hidden' });
      await p.evaluate(() => {
        const s = veMntWizStp(), A = s.sonuc.agac;
        A.forEach((d, i) => { if (/ takoz$/.test(d.ad) && s.roller[i] !== 'mnt-mount') veMntWizStpRol(i, 'mnt-mount'); });
        veMntWizStpHesapla();
      });
      await p.waitForFunction(() => { const s = veMntWizStp(); return s && s.coz && !s.hesapBekliyor; }, null, { timeout: 120000 });
      await p.locator('#ve-mw-3b-agac .ve-mw-3b-agac-ad', { hasText: /^Motor bloğu$/ }).first().click();
      await bekle(p, 900);
      await p.evaluate(() => document.querySelectorAll('.ve-toast').forEach((t) => t.remove()));
      await p.mouse.move(EKRAN.width / 2, EKRAN.height - 4);
      await bekle(p, 300);
    },
  },
  {
    ad: '3b-menu',
    kirp: { s: '#ve-mw-3b-menu', pay: 36 },
    isaret: {
      tumu: '#ve-mw-3b-menu [data-k="tumu"]',
      sigdir: '#ve-mw-3b-menu [data-k="sigdir"]',
      bakis: '#ve-mw-3b-menu [data-k="bakis"]',
      gorunus: '#ve-mw-3b-menu [data-k="gorunus"]',
      zemin: '#ve-mw-3b-menu [data-k="zemin"]',
      suzgec: '#ve-mw-3b-menu [data-k="suzgec"]',
      olcu: '#ve-mw-3b-menu [data-k="olcu"]',
      kesit: '#ve-mw-3b-menu [data-k="kesit"]',
      hizli: '#ve-mw-3b-menu [data-k="hizli"]',
    },
    async kur(p) {
      const bos = await p.evaluate(() => {
        const V = window._mw3b, cv = V.renderer.domElement, r = cv.getBoundingClientRect();
        for (let y = r.top + 60; y < r.bottom - 60; y += 23)
          for (let x = r.left + 60; x < r.right - 60; x += 29)
            if (document.elementFromPoint(x, y) === cv && _mw3bIsabet(x, y) < 0) return { x, y };
        return null;
      });
      await p.mouse.click(bos.x, bos.y, { button: 'right' });
      await p.locator('#ve-mw-3b-menu').waitFor();
      await bekle(p, 300);
    },
  },
  {
    ad: 'rapor',
    isaret: {
      antet: '.antet',
      icindekiler: '.toc',
      uygunluk: '.toc a[href="#uygunluk"]',
      bolum: 'h2',
    },
    // Rapor programın kendi üreticisinden, sonuçlar durağının çözümüyle; ayrı
    // sayfada açılır (indirilen belge nasıl açılıyorsa).
    async sayfa(p, ctx) {
      await p.keyboard.press('Escape');
      const html = await p.evaluate(() => new Promise((ok) => {
        const id = nodes.find((n) => n.type === 'mnt-report').id;
        _mntReportEnsureAssets(() => ok(_mntBuildReportHTML(_veMntLast, veMntRaporOpts(id))));
      }));
      const r = await p.context().newPage();
      await r.setViewportSize(EKRAN);
      await r.setContent(html, { waitUntil: 'load' });
      await r.mouse.move(2, 2);
      await r.waitForTimeout(800);
      ctx.kapat = r;
      return r;
    },
  },
];

// ── TUR ───────────────────────────────────────────────────────────────────
// `o.resim`: görüntü de alınır (yoksa yalnız ölçülür — e2e kapısı).
// Döner: { ad: { g, y, isaret, yok, png? } }.
async function tur(sayfa, o) {
  const ctx = o || {};
  const out = {};
  for (const d of DURAKLAR) {
    // `yalniz` verilse de bütün duraklar kurulur (durum zinciri), görüntü yalnız onlarda
    if (d.kur) await d.kur(sayfa, ctx);
    const s = d.sayfa ? await d.sayfa(sayfa, ctx) : sayfa;
    const kirp = d.kirp ? await s.evaluate(_sayfaKirp, d.kirp) : null;
    const K = kirp || { x: 0, y: 0, w: EKRAN.width, h: EKRAN.height };
    const olc = await s.evaluate(([t, k]) => (0, eval)('(' + t + ')')(...k), [_sayfaOlc.toString(), [d.isaret, K]]);
    const kayit = { g: K.w, y: K.h, isaret: olc.isaret, yok: olc.yok };
    if (ctx.resim && (!ctx.yalniz || ctx.yalniz.indexOf(d.ad) >= 0)) {
      kayit.png = await s.screenshot({ clip: { x: K.x, y: K.y, width: K.w, height: K.h } });
    }
    out[d.ad] = kayit;
    if (d.son) await d.son(sayfa, ctx);
    if (ctx.kapat) { await ctx.kapat.close(); ctx.kapat = null; }
  }
  return out;
}

// Programı açar (karşılama görünür). `adres`: file:// ya da http.
async function programiAc(sayfa, adres) {
  await sayfa.setViewportSize(EKRAN);
  await sayfa.goto(adres);
  await sayfa.evaluate(() => { if (window.MFSimLoader && MFSimLoader.start) MFSimLoader.start(); });
  await sayfa.waitForFunction(() => typeof window.createNode === 'function' && typeof window.veMntWizStpRol === 'function'
    && typeof window.veMntWiz3bSec === 'function' && typeof window.veMntBaslangicHTML === 'function'
    && typeof window.THREE !== 'undefined', null, { timeout: 120000 });
  await sayfa.waitForFunction(() => { const s = document.getElementById('mfsim-loading-screen'); return !s || s.style.display === 'none'; }, null, { timeout: 120000 });
  // 3B'nin Özellikler'i açık (kapalı başlar — Canlı Not 26); açık tema
  await sayfa.evaluate(() => { try { localStorage.setItem(VE_MW_3B_YAN_ANAHTAR, 'acik'); } catch (e) {} });
  await sayfa.mouse.move(2, EKRAN.height - 2);
  await sayfa.waitForTimeout(600);
}

// Turun STEP dosyası: Tulga sunusunun kalıbında sentetik güç grubu — motor
// bloğu, krank kasnağı, şanzıman ve transfer gövdesi, beş takoz (flanş · kauçuk ·
// üst plaka · saplama · pul · somun). Takoz testlerinin yazıcısı
// (tests/helpers/step-takoz.js): adları ve noktaları testlerde ölçülü.
function denemeStep(dizin) {
  const f = path.join(dizin, 'guc-grubu.stp');
  const STEP = require(path.join(KOK, 'tests', 'helpers', 'step-takoz.js'));
  fs.writeFileSync(f, STEP.tulgaKalibi({ krank: true, varyant: 'somun', civata: true }));
  return f;
}

// Künye: kutular tek satırda (fark okunur kalsın)
function kunyeYaz(k) {
  return JSON.stringify(k, null, 1).replace(/\[\s+([-\d.,\s]+?)\s+\]/g,
    (m, x) => '[' + x.split(/,\s*/).map((v) => v.trim()).join(', ') + ']') + '\n';
}

// PNG → webp (tarayıcının kodlayıcısıyla; karşılama ve değişiklik görselleriyle aynı yol)
async function webpYap(tarayici, png) {
  const s = await tarayici.newPage();
  try {
    await s.goto('about:blank');
    const b64 = await s.evaluate(async ({ b64, q }) => {
      const img = new Image();
      img.src = 'data:image/png;base64,' + b64;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      c.getContext('2d').drawImage(img, 0, 0);
      return c.toDataURL('image/webp', q).split(',')[1];
    }, { b64: png.toString('base64'), q: KALITE });
    return Buffer.from(b64, 'base64');
  } finally { await s.close(); }
}

async function main(argv) {
  const kuru = argv.indexOf('--kuru') >= 0;
  const yalniz = argv.filter((a) => !/^--/.test(a));
  const bilinmeyen = yalniz.filter((a) => !DURAKLAR.some((d) => d.ad === a));
  if (bilinmeyen.length) throw new Error('bilinmeyen durak: ' + bilinmeyen.join(', ') + ' (duraklar: ' + DURAKLAR.map((d) => d.ad).join(' · ') + ')');
  const dizin = fs.mkdtempSync(path.join(os.tmpdir(), 'mfsim-kilavuz-'));
  try {
    const prog = path.join(dizin, 'mfsim.html');
    execFileSync(process.execPath, [path.join(KOK, 'build.js')], { stdio: 'ignore',
      env: Object.assign({}, process.env, { MFSIM_BUILD_OUT: prog, MFSIM_KARSILAMA: 'yok' }) });
    const step = denemeStep(dizin);
    const { chromium } = require('playwright');
    const tarayici = await chromium.launch(CHROMIUM ? { executablePath: CHROMIUM } : {});
    try {
      const baglam = await tarayici.newContext({ viewport: EKRAN, deviceScaleFactor: 1 });
      const sayfa = await baglam.newPage();
      const hata = [];
      sayfa.on('pageerror', (e) => hata.push(String(e)));
      await programiAc(sayfa, 'file://' + prog);
      const sonuc = await tur(sayfa, { resim: true, step: step, yalniz: yalniz.length ? yalniz : null });
      if (hata.length) throw new Error('programda hata: ' + hata.slice(0, 3).join(' | '));
      const kunye = fs.existsSync(KUNYE) ? JSON.parse(fs.readFileSync(KUNYE, 'utf8')) : { resim: {} };
      kunye.ekran = EKRAN;
      for (const ad of Object.keys(sonuc)) {
        const r = sonuc[ad];
        if (!r.png) continue;
        if (r.yok.length) throw new Error(ad + ': işaretin öğesi yok — ' + r.yok.join(', '));
        const webp = await webpYap(tarayici, r.png);
        if (webp.length > RESIM_TAVAN) throw new Error(ad + ': ' + Math.round(webp.length / 1024) + ' KB > ' + RESIM_TAVAN / 1024 + ' KB');
        kunye.resim[ad] = { g: r.g, y: r.y, isaret: r.isaret };
        console.log('  ' + ad + '.webp  ' + r.g + '×' + r.y + '  ' + Math.round(webp.length / 1024) + ' KB  · '
          + Object.keys(r.isaret).length + ' işaret');
        if (!kuru) fs.writeFileSync(path.join(KLASOR, ad + '.webp'), webp);
      }
      if (!kuru) {
        fs.mkdirSync(KLASOR, { recursive: true });
        fs.writeFileSync(KUNYE, kunyeYaz(kunye));
      }
    } finally { await tarayici.close(); }
  } finally { fs.rmSync(dizin, { recursive: true, force: true }); }
}

if (require.main === module) {
  main(process.argv.slice(2)).catch((e) => { console.error(e.message || e); process.exit(1); });
}

module.exports = { gomulecekler, DURAKLAR, tur, programiAc, denemeStep, EKRAN, KLASOR, KUNYE, _sayfaOlc };
