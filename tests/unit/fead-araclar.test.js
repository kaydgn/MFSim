/**
 * fead-araclar.test.js — FEAD ARAÇLARI PENCERESİ (js/cp-fead-araclar.js)
 *
 * Kullanıcı kararı (2026-09-28, tasarım tezgâhı IV · A): *"A güzel. A'yı çok
 * beğendim. Onu yapalım."* Sihirbaz, Çözücü, Rapor ve Dönüş Yönü topolojide
 * kutu olmaktan çıktı; eylemleri tuvalin sol üstündeki yüzen pencerede.
 *
 * Kapıların sorduğu şey: pencere modülün KENDİ çağrılarına mı gidiyor, kendi
 * ayarını tutuyor mu (tutmamalı), durumu tek kaynaktan mı okuyor, yeri ve
 * katlılığı modele sızıyor mu (sızmamalı), kapsam dışında görünüyor mu
 * (görünmemeli). Yön bölümünün kapıları fead-spin.test.js'te ("Yön yüzeyi");
 * gerçek fare (taşıma, yuva, sığdırma) → tests/e2e/fead-araclar.spec.js.
 */
const fs = require('fs');
const path = require('path');
const KOK = path.join(__dirname, '../..');
const oku = (f) => fs.readFileSync(path.join(KOK, f), 'utf8');

const stubs = stubGlobals();
document.body.innerHTML = '<div id="ve-canvas-wrapper"><div id="ve-canvas"></div></div>';
global.nodes = [];
global.connections = [];
eval(loadSource('components.js'));
// components.js'teki yüklem GLOBAL'e yazılır: cp-fead.js require ile
// yükleniyor ve çıplak adları global'de arıyor.
global.veIsCanvasHidden = veIsCanvasHidden;
global.componentDefs = componentDefs;
eval(loadSource('fead-belts.js'));
const F = require('../../js/fead-core.js');
const M = require('../../js/fead-model.js');
global.FEADCore = F;
Object.keys(M).forEach((k) => { global[k] = M[k]; });
// ÖRNEKLER MOTORLU: bu dosya örnekleri ÇÖZÜYOR ve Gates örnekleri motorun devir
// sınırlarını taşımıyor — işletme hesabı onlarsız yapılmaz (tests/helpers/fead-motor.js).
require('../helpers/fead-motor').motorluOrnekler(M);
const fead = require('../../js/cp-fead.js');
Object.keys(fead).forEach((k) => { if (global[k] === undefined) global[k] = fead[k]; });
// Özet kartları ve çip SONUÇ sekmesinin üreticilerinden — tek kaynak.
global.veFeadSignals = require('../../js/fead-signals.js');
const RS = require('../../js/cp-fead-results.js');
Object.keys(RS).forEach((k) => { if (global[k] === undefined) global[k] = RS[k]; });
const RP = require('../../js/cp-fead-report.js');
Object.keys(RP).forEach((k) => { if (global[k] === undefined) global[k] = RP[k]; });
const AR = require('../../js/cp-fead-araclar.js');

beforeEach(() => {
  resetStubs(stubs);
  global.nodes = [];
  global.connections = [];
  global.veFeadResults = null;
  try { localStorage.clear(); } catch (e) { /* jsdom */ }
  AR._feadAracSifirla();
  document.body.innerHTML = '<div id="ve-canvas-wrapper"><div id="ve-canvas"></div></div>';
});

// Örnek modeli (araçlarıyla) tuvale kur — fead-spin.test.js'teki kurucunun aynısı.
function kur(key) {
  const pack = M.veFeadExampleNodes(key || 'AG00976_GATES_2025');
  const ns = pack.nodes.map((n) => {
    const d = componentDefs[n.type] || {};
    return { id: n.id, type: n.type, customName: n.customName || null, def: d,
             x: 0, y: 0, width: d.defaultWidth || 65, height: d.defaultHeight || 60,
             data: JSON.parse(JSON.stringify(n.data || {})) };
  });
  ns.push({ id: 'ex-wiz', type: 'fead-wizard', def: componentDefs['fead-wizard'], data: {} });
  global.nodes = ns;
  global.connections = [];
  return ns;
}
const tip = (t) => global.nodes.find((n) => n.type === t);
const govde = () => {
  const d = document.createElement('div');
  d.innerHTML = AR.veFeadAraclarGovdeHTML(AR.veFeadAraclarDurum());
  return d;
};
// Çıplak adla çağrılan global'i bir casusla değiştir, sonra geri koy.
function casus(ad, fn) {
  const eski = global[ad];
  const c = jest.fn(fn || (() => true));
  global[ad] = c;
  return { c, geri: () => { global[ad] = eski; } };
}

// ─────────────────────────────────────────────────────────────────────────────
describe('bileşen sözleşmesi — araçlar KUTUSUZ, pencere onlara BAĞLANIR', () => {
  test('çözücü · rapor · sihirbaz: kutusuz, silinmez, tek kopya; Dönüş Yönü tipi yok', () => {
    ['fead-solver', 'fead-report', 'fead-wizard'].forEach((t) => {
      const d = componentDefs[t];
      expect({ t, kutusuz: d.noCanvasBox, sebep: /FEAD araçları/.test(d.noDelete || '') })
        .toEqual({ t, kutusuz: true, sebep: true });
      expect({ t, tek: d.maxInstances }).toEqual({ t, tek: 1 });
    });
    expect(componentDefs['fead-spin']).toBeUndefined();
    // Liste TEK KAYNAK: açılış yüzeyi de eski kaydın tamamlanması da buradan.
    expect(fead.VE_FEAD_ARAC_TIPLERI).toEqual(['fead-belt', 'fead-solver', 'fead-report', 'fead-wizard']);
  });

  // PALETSİZ (2026-09-28, kullanıcı kararı: *"FEAD modülünde bu 'Bileşenler'
  // sütununu kaldıralım, zaten ekleyeceğimiz bileşenlerin hepsini 'kanvaslar'
  // üzerinden ekleyebiliyoruz."*). Modül beyan ediyor; index.html'de FEAD
  // kapsamlı kategori yok — konsa görünmez, ölü olurdu. Sütunun FEAD'deki
  // işlerinin karşılığı tuvalde: kasnak kartın listesi, Kayış Yolu pencerenin
  // Kanvas'ı, not araçları pencerenin Not bölümü (aşağıda). Kökteki MODÜL
  // satırı duruyor (kökün paleti var).
  test('PALETSİZ — modül beyan ediyor; index.html\'de FEAD kategorisi ve FEAD tipi yok', () => {
    expect(componentDefs['fead-analysis'].noPalette).toBe(true);
    const idx = oku('index.html');
    expect(idx).not.toMatch(/data-ve-scope="fead-analysis"/);
    const tipler = Object.keys(componentDefs).filter((t) => /^fead-/.test(t) && t !== 'fead-analysis');
    expect(tipler.length).toBeGreaterThan(10);
    tipler.forEach((t) => {
      expect({ t, palette: idx.includes('data-type="' + t + '"') }).toEqual({ t, palette: false });
    });
    expect(idx).toMatch(/data-type="fead-analysis"/);
  });

  test('betik yükleniyor — okuduğu üreticilerden SONRA', () => {
    const idx = oku('index.html');
    const i = idx.indexOf('src="js/cp-fead-araclar.js"');
    expect(i).toBeGreaterThan(0);
    ['js/cp-fead.js', 'js/cp-fead-report.js', 'js/cp-fead-results.js'].forEach((f) => {
      expect({ f, once: idx.indexOf('src="' + f + '"') < i }).toEqual({ f, once: true });
    });
  });

  test('garanti yalnız EKSİĞİ kurar; ikinci çağrı hiçbir şey kurmaz', () => {
    let k = 0;
    global.createNode = (t) => {
      const n = { id: 'g' + ++k, type: t, def: componentDefs[t], data: {} };
      global.nodes.push(n);
      return n;
    };
    global.clearSelection = jest.fn();
    try {
      global.nodes = [{ id: 'r0', type: 'fead-report', data: { reportKind: 'summary' } }];
      const yeni = fead.veFeadAraclarGaranti();
      expect(yeni.map((n) => n.type)).toEqual(['fead-belt', 'fead-solver', 'fead-wizard']);
      // Var olana DOKUNULMADI.
      expect(tip('fead-report').data).toEqual({ reportKind: 'summary' });
      // Kurulan araç seçili KALMAZ — panel bir aracın penceresiyle açılmasın.
      expect(global.clearSelection).toHaveBeenCalled();
      expect(fead.veFeadAraclarGaranti()).toEqual([]);
      expect(global.nodes).toHaveLength(4);
    } finally { delete global.createNode; delete global.clearSelection; }
  });

  // KURAL 26: kaldırılan yapının DİLİ de kalkar. Kutular giderken toast'lar,
  // pencere metinleri ve kılavuz hâlâ "Çözücü → ▶ Hesapla", "kutusuna çift
  // tıklayın", "Dönüş Yönü kartı" diyordu — tıklanacak bir kutu yokken.
  test('kaldırılan kutuların DİLİ de kalktı (kural 26)', () => {
    const dosyalar = ['js/cp-fead.js', 'js/cp-fead-report.js', 'js/cp-fead-results.js',
      'js/cp-fead-wizard.js', 'js/fead-model.js', 'js/guide-fead.js', 'js/results.js'];
    const kalip = [/Çözücü → ▶/, /Önce Çözücü/, /(Çözücü|Rapor|Sihirbaz[ıi]?)<\/strong> (kutusuna|kartına) çift tıkla/,
      /(Çözücü|Rapor) kutusuna çift/, /Dönüş Yönü kart/, /Rapor bileşeni/, /Düğüme <b>çift tıklamak/];
    const sapan = [];
    dosyalar.forEach((f) => {
      const s = oku(f);
      kalip.forEach((re) => { if (re.test(s)) sapan.push(f + ' ← ' + re); });
    });
    expect(sapan).toEqual([]);
  });

  // KURAL 26 · 39: kaldırılan SÜTUNUN dili de kalkar. Sütun giderken kılavuz
  // altı yerde "paletten sürükleyin / sol paletin FEAD kasnakları kategorisi"
  // diyordu ve köprünün hata metni "Sol paletten bir Gergi ekleyin" diyordu —
  // FEAD'de sütun yokken.
  test('kaldırılan SÜTUNUN dili de kalktı (kural 26 · 39)', () => {
    const sapan = [];
    if (/palet/i.test(oku('js/guide-fead.js'))) sapan.push('guide-fead.js ← palet');
    ['js/fead-model.js', 'js/cp-fead-araclar.js', 'js/cp-fead-wizard.js'].forEach((f) => {
      if (/[Ss]ol palet|[Pp]aletten (ekle|sürük|bırak)/.test(oku(f))) sapan.push(f + ' ← sol palet');
    });
    expect(sapan).toEqual([]);
    // Gergisiz modelin hatası YENİ yolu söylüyor — iki kullanım tek sabitten.
    const ns = M.veFeadExampleNodes('AG00976_GATES_2025').nodes
      .filter((n) => !(componentDefs[n.type] || {}).isFeadTensioner)
      .map((n) => Object.assign({ def: componentDefs[n.type] || {} }, JSON.parse(JSON.stringify(n))));
    const hata = M.veFeadBuildSystem(ns).errors.join(' ');
    expect(hata).toMatch(/Gergi yok/);
    expect(hata).toMatch(/＋ Kasnak ekle/);
    expect(hata).not.toMatch(/palet/i);
  });

  // KAPSAM SIĞDIRMADAN ÖNCE (kural 41): FEAD'e girerken "Bileşenler" sütunu
  // kalkıyor ve tuval 220 px genişliyor. Senkron sığdırmadan sonra koşsaydı
  // kadraj dar tuvalle kurulur, içerik sola kayık kalırdı. Ölçüm gerçek
  // tarayıcıda (fead-araclar.spec.js → "SÜTUNSUZ AÇILIŞ"); bu, sıranın kapısı.
  test('KAPSAM SIĞDIRMADAN ÖNCE — veFeadOpenEditor önce kabuğu eşitler', () => {
    const src = oku('js/cp-fead.js');
    const i = src.indexOf('function veFeadOpenEditor');
    const govde = src.slice(i, src.indexOf('\nfunction ', i + 10));
    const esitle = govde.indexOf('veSyncSidebarScope();');
    const sigdir = govde.indexOf('veFitViewToContent();');
    expect(esitle).toBeGreaterThan(0);
    expect(sigdir).toBeGreaterThan(0);
    expect(esitle).toBeLessThan(sigdir);
    // ve sığdırmadan SONRA ikinci bir eşitleme yok (o da kadrajı kaydırırdı).
    expect(govde.indexOf('veSyncSidebarScope()', sigdir)).toBe(-1);
  });

  test('kapsam kancası TEK noktada — veSyncSidebarScope', () => {
    const src = oku('js/components.js');
    const i = src.indexOf('function veSyncSidebarScope');
    const son = src.indexOf('\nfunction ', i + 10);
    expect(src.slice(i, son)).toContain('veFeadAraclarKapsam(scope)');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('durum — pencere hesaplamaz, modülün çağrılarından okur', () => {
  test('boş topoloji: Hesapla PASİF ve sebebini söylüyor; Sihirbaz birincil', () => {
    global.nodes = ['fead-belt', 'fead-solver', 'fead-report', 'fead-wizard']
      .map((t, i) => ({ id: 'b' + i, type: t, def: componentDefs[t], data: {} }));
    const d = AR.veFeadAraclarDurum();
    expect(d.hazir).toBe(false);
    expect(d.neden).toMatch(/Henüz kasnak yok/);
    const g = govde();
    const h = g.querySelector('[data-bol="cozum"] [data-ey="hesapla"]');
    // `disabled` DEĞİL: devre dışı düğme ipucunu göstermez, sebep okunamazdı.
    expect(h.getAttribute('aria-disabled')).toBe('true');
    expect(h.hasAttribute('disabled')).toBe(false);
    expect(h.getAttribute('title')).toBe(d.neden);
    expect(g.querySelector('[data-bol="model"] [data-ey="sihirbaz"]').classList.contains('birincil')).toBe(true);
    expect(g.querySelector('[data-ey="indir"]').getAttribute('aria-disabled')).toBe('true');
    // Sonuç yok → özet kartı da, gergi hükmü de YOK (uydurulmaz).
    expect(g.querySelector('.ve-fead-arac-kpi')).toBeNull();
    expect(g.querySelector('.ve-fead-arac-huk')).toBeNull();
  });

  test('örnekte Hesapla ETKİN; çözünce çip Güncel ve dört özet kartı — Sonuçlar’ın özetinden', () => {
    kur();
    let d = AR.veFeadAraclarDurum();
    expect(d.hazir).toBe(true);
    expect(d.kasnak).toBe(6);
    expect(govde().querySelector('[data-ey="hesapla"]').hasAttribute('aria-disabled')).toBe(false);
    fead.veFeadSolve(tip('fead-solver').id);
    d = AR.veFeadAraclarDurum();
    expect(d.durum.k).toBe('guncel');
    const g = govde();
    // ÇİP TEK ÜRETİCİDEN — Sonuçlar sekmesiyle aynı cümle.
    expect(g.querySelector('[data-bol="cozum"] h4 .ve-fr-chip').outerHTML)
      .toBe(RS.veFeadResChipHTML(d.durum));
    // KARTLAR SONUÇLAR'IN ÖZETİNDEN, pencerenin sırasıyla — değer birebir.
    const ozet = global.veFeadSignals.summary(global.veFeadResults);
    const kartlar = [...g.querySelectorAll('.ve-fead-arac-kpi > div')];
    expect(kartlar).toHaveLength(AR.VE_FEAD_ARAC_KPI.length);
    AR.VE_FEAD_ARAC_KPI.forEach((k, i) => {
      const s = ozet.find((x) => x.k === k);
      expect({ k, ad: kartlar[i].querySelector('span').textContent })
        .toEqual({ k, ad: s.ad });
      expect(kartlar[i].querySelector('b').textContent).toContain(String(s.deger));
    });
    expect(g.querySelector('[data-ey="indir"]').hasAttribute('aria-disabled')).toBe(false);
  });

  test('model değişince BAYAT — sayı gizlenmez, soluk durur; gergi hükmü DÜŞER', () => {
    kur();
    fead.veFeadSolve(tip('fead-solver').id);
    expect(govde().querySelector('.ve-fead-arac-huk')).not.toBeNull();
    const alt = global.nodes.find((n) => n.type === 'fead-alternator');
    alt.data.od = Number(alt.data.od) + 3;
    const d = AR.veFeadAraclarDurum();
    expect(d.durum.k).toBe('bayat');
    const g = govde();
    expect(g.querySelector('.ve-fead-arac-kpi').classList.contains('bayat')).toBe(true);
    expect(g.querySelectorAll('.ve-fead-arac-kpi > div')).toHaveLength(4);
    // Bayat sonucun hükmü başka bir modelin hükmü olabilir — gösterilmez.
    expect(g.querySelector('[data-bol="yon"] .ve-fead-arac-huk')).toBeNull();
  });

  test('çözüm hatasının SEBEBİ pencerede — yalnız toast’ta kalmaz', () => {
    kur();
    global.veFeadResults = { ok: false, error: 'Kayış kasnağın İÇİNDEN geçiyor.',
                             solvedNodeId: tip('fead-solver').id };
    const d = AR.veFeadAraclarDurum();
    expect(d.durum.k).toBe('hata');
    const h = govde().querySelector('[data-bol="cozum"] .ve-fead-arac-huk[data-d="no"]');
    expect(h).not.toBeNull();
    expect(h.textContent).toContain('Kayış kasnağın İÇİNDEN geçiyor.');
  });

  test('uygunluk: çözücü penceresinin sağ sütunuyla AYNI üretici (kural 16)', () => {
    kur();
    const d = AR.veFeadAraclarDurum();
    const bek = fead._feadSideGates(d.build, fead.veFeadTableRows(d.build));
    expect(govde().querySelector('.ve-fead-arac-kapi').innerHTML)
      .toBe((() => { const x = document.createElement('div'); x.innerHTML = bek; return x.innerHTML; })());
  });

  test('rapor türü raporun ALANINDAN okunur — pencere tutmaz', () => {
    kur();
    tip('fead-report').data.reportKind = 'summary';
    const g = govde();
    expect(g.querySelector('[data-ey="tur"][data-v="summary"]').getAttribute('aria-checked')).toBe('true');
    expect(g.querySelector('[data-ey="tur"][data-v="detailed"]').getAttribute('aria-checked')).toBe('false');
    delete tip('fead-report').data.reportKind;           // alan yoksa Detaylı
    expect(govde().querySelector('[data-ey="tur"][data-v="detailed"]').getAttribute('aria-checked')).toBe('true');
  });

  test('künye bağlantıları: kayış künyesi ve raporun Künye’si pencere AÇAR', () => {
    kur();
    const g = govde();
    const kayis = g.querySelector('[data-bol="model"] [data-ey="kayis"]');
    expect(kayis).not.toBeNull();
    expect(kayis.textContent).toContain(tip('fead-belt').data.beltType || 'PK');
    // Rapor kutusu kalktı: belgenin antetine akan alanlara giden TEK yol.
    expect(g.querySelector('[data-bol="rapor"] [data-ey="rapor"]')).not.toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('eylemler — hepsi modülün var olan çağrılarına gider', () => {
  test('Hesapla: hazırsa veFeadSolve(çözücü), değilse SEBEP ve çağrı YOK', () => {
    kur();
    const s = casus('veFeadSolve');
    try {
      expect(AR.veFeadAracEylem('hesapla')).toBe(true);
      expect(s.c).toHaveBeenCalledWith(tip('fead-solver').id);
      s.c.mockClear();
      global.nodes = global.nodes.filter((n) => !(componentDefs[n.type] || {}).isFeadPulley);
      expect(AR.veFeadAracEylem('hesapla')).toBe(false);
      expect(s.c).not.toHaveBeenCalled();
      expect(stubs.showToast).toHaveBeenCalledWith(expect.stringMatching(/kasnak/), 'warning');
    } finally { s.geri(); }
  });

  test('Ayarlar → çözücünün, Künye → raporun penceresi; kayış → Kayış Özellikleri', () => {
    kur();
    const t = casus('veFeadTableOpen');
    const k = casus('veFeadKayisAc');
    try {
      expect(AR.veFeadAracEylem('ayarlar')).toBe(true);
      expect(t.c).toHaveBeenLastCalledWith(tip('fead-solver').id);
      expect(AR.veFeadAracEylem('rapor')).toBe(true);
      expect(t.c).toHaveBeenLastCalledWith(tip('fead-report').id);
      expect(AR.veFeadAracEylem('kayis')).toBe(true);
      expect(k.c).toHaveBeenCalled();
    } finally { t.geri(); k.geri(); }
  });

  test('Sihirbaz → düğümün kendisi; düğüm yoksa veFeadWizOpenAny', () => {
    kur();
    const w = casus('veFeadWizOpen');
    const a = casus('veFeadWizOpenAny');
    try {
      expect(AR.veFeadAracEylem('sihirbaz')).toBe(true);
      expect(w.c).toHaveBeenCalledWith(tip('fead-wizard').id);
      global.nodes = global.nodes.filter((n) => n.type !== 'fead-wizard');
      AR.veFeadAracEylem('sihirbaz');
      expect(a.c).toHaveBeenCalled();
    } finally { w.geri(); a.geri(); }
  });

  test('rapor türü: ALANA yazar + tek geri-al adımı; aynı seçim hiçbir şey yazmaz', () => {
    kur();
    expect(AR.veFeadAracEylem('tur', 'detailed')).toBe(false);     // alan yok = Detaylı
    expect(stubs.saveState).not.toHaveBeenCalled();
    expect(AR.veFeadAracEylem('tur', 'summary')).toBe(true);
    expect(tip('fead-report').data.reportKind).toBe('summary');
    expect(stubs.saveState).toHaveBeenCalledTimes(1);
    expect(AR.veFeadAracEylem('tur', 'bozuk')).toBe(false);
  });

  test('İndir: sonuç yoksa SEBEP; varsa raporun kendi üreticisi', () => {
    kur();
    const r = casus('veFeadGenerateReport');
    try {
      expect(AR.veFeadAracEylem('indir')).toBe(false);
      expect(r.c).not.toHaveBeenCalled();
      expect(stubs.showToast).toHaveBeenCalledWith(expect.stringMatching(/önce modeli hesaplayın/), 'warning');
      global.veFeadResults = { ok: true, solvedNodeId: tip('fead-solver').id };
      expect(AR.veFeadAracEylem('indir')).toBe(true);
      expect(r.c).toHaveBeenCalledWith(tip('fead-report').id);
    } finally { r.geri(); }
  });

  test('bilinmeyen eylem hiçbir şey yapmaz', () => {
    kur();
    expect(AR.veFeadAracEylem('yok-boyle')).toBe(false);
    expect(stubs.saveState).not.toHaveBeenCalled();
  });

  // KANVAS — "Bileşenler" sütununun Kayış Yolu satırının yeri (2026-09-28).
  test('Kanvas: Model bölümünde bir düğme ve modülün kurucusuna gider', () => {
    kur();
    const b = govde().querySelector('[data-bol="model"] [data-ey="kanvas"]');
    expect(b).toBeTruthy();
    expect(b.getAttribute('title')).toMatch(/Kayış Yolu kanvası/);
    const k = casus('veFeadKanvasEkle', () => ({ id: 'yeni' }));
    try {
      expect(AR.veFeadAracEylem('kanvas')).toBe(true);
      expect(k.c).toHaveBeenCalledTimes(1);
    } finally { k.geri(); }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// YENİ KANVAS — veFeadKanvasEkle (cp-fead.js). Sütun kartı farenin bıraktığı
// yere koyuyordu; düğmenin faresi yok, yer KURALDAN: sıranın sağı, en üstteki
// kartla aynı hiza (kural 22 — kanvaslar tek sıra). Bir eylem = bir geri-al adımı.
describe('YENİ KANVAS — sıranın sağına, tek geri-al adımı', () => {
  const kart = (id, x, y, w) => ({ id, type: 'fead-layout', def: componentDefs['fead-layout'], x, y, width: w, height: 500, data: {} });
  function kurucu() {
    const kurulan = [];
    global.createNode = jest.fn((t, x, y) => {
      const n = { id: 'y' + kurulan.length, type: t, def: componentDefs[t], x, y, width: 440, height: 500, data: {} };
      kurulan.push(n); global.nodes.push(n); return n;
    });
    return kurulan;
  }

  test('sıranın SAĞINA, en üstteki kartla aynı hizaya; toplu kurulum + kadraj', () => {
    kurucu();
    const batch = casus('veStateBatch', (fn) => fn());
    const fit = casus('veFitViewToContent');
    try {
      global.nodes = [kart('a', 3000, 2800, 640), kart('b', 3664, 2760, 440),
        // kutusuz kasnak yer hesabına GİRMEZ (konumu mm, kanvas değil)
        { id: 'k', type: 'fead-crank', def: componentDefs['fead-crank'], data: { x: 9000, y: 0 } }];
      const n = fead.veFeadKanvasEkle();
      expect(n.type).toBe('fead-layout');
      expect(global.createNode).toHaveBeenCalledWith('fead-layout', 3664 + 440 + 24, 2760);
      expect(batch.c).toHaveBeenCalledTimes(1);
      expect(fit.c).toHaveBeenCalledTimes(1);
      expect(stubs.showToast).toHaveBeenCalledWith(expect.stringMatching(/Kayış Yolu kanvası eklendi/), 'success');
    } finally { batch.geri(); fit.geri(); delete global.createNode; }
  });

  test('hiç kart yoksa açılış yüzeyinin YUVASI (aynı kaynak: veFeadFallbackSlots)', () => {
    kurucu();
    const taban = casus('veArrangeModuleBase', () => ({ x: 2500, y: 2600 }));
    try {
      global.nodes = [];
      fead.veFeadKanvasEkle();
      const yuva = fead.veFeadFallbackSlots(['fead-layout'])[0];
      expect(global.createNode).toHaveBeenCalledWith('fead-layout', 2500 + yuva.lx, 2600 + yuva.ly);
    } finally { taban.geri(); delete global.createNode; }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// NOT ARAÇLARI (kullanıcı, 2026-09-28: *"Not araçlarını da FEAD araçları
// penceresine ekleyelim"*). FEAD'de sütun yok; sütunun "Araçlar" kategorisi
// (gruplama çerçevesi · yazı etiketi) pencerenin Not bölümünde. Açıklama modülü
// değişmedi — pencere onun kurucusuna ve taşıyıcısına bağlanır.
describe('NOT ARAÇLARI — pencerede; tık görünür yere, sürükleme annotations.js yolundan', () => {
  const CS = require('../../js/canvas-space.js');
  const kart = (id, x, y, w, h) => ({ id, type: 'fead-layout', def: componentDefs['fead-layout'],
    x, y, width: w, height: h, data: {} });
  // Örneğin modeli + YALNIZ verilen kartlar (örneğin kendi kartları kurucuda
  // (0,0)'da duruyor — hedef kutusunu bozardı).
  const kurKartlarla = (...k) => {
    kur();
    global.nodes = global.nodes.filter((n) => n.type !== 'fead-layout').concat(k);
    return k;
  };

  test('iki araç — tipleri sütunun (index.html) tipleriyle AYNI; sürüklenir, klavyeyle ulaşılır', () => {
    kur();
    const oge = [...govde().querySelectorAll('[data-bol="not"] [data-ey="not"]')];
    expect(oge.map((b) => b.getAttribute('data-v'))).toEqual(['frame', 'text']);
    // Diğer modüllerin sütunundaki araçlar hâlâ orada: ikinci bir tip adı yok.
    const sutun = [...oku('index.html').matchAll(/data-annotation-type="([a-z]+)"/g)].map((m) => m[1]);
    expect(AR.VE_FEAD_ARAC_NOT.map((n) => n.tip)).toEqual(sutun);
    oge.forEach((b) => {
      expect({ v: b.getAttribute('data-v'), s: b.getAttribute('draggable'), r: b.getAttribute('role'), t: b.getAttribute('tabindex') })
        .toEqual({ v: b.getAttribute('data-v'), s: 'true', r: 'button', t: '0' });
      expect(b.getAttribute('title')).toMatch(/sürükle: .* tıkla: /);
    });
  });

  test('YER — çerçeve hedef kartları ÇEVRELER; aynı çerçeve varsa İÇ İÇE (16 px dışarı)', () => {
    const P = AR.VE_FEAD_NOT_PAY;
    const kutu = { x: 1000, y: 800, w: 640, h: 500 };
    const r1 = AR.veFeadNotYeri('frame', kutu, []);
    expect(r1).toEqual({ x: 1000 - P, y: 800 - P, width: 640 + 2 * P, height: 500 + 2 * P });
    const r2 = AR.veFeadNotYeri('frame', kutu, [Object.assign({ type: 'frame' }, r1)]);
    expect(r2).toEqual({ x: r1.x - 16, y: r1.y - 16, width: r1.width + 32, height: r1.height + 32 });
    // Başka yerdeki çerçeve iç içe gerektirmez.
    expect(AR.veFeadNotYeri('frame', kutu, [{ type: 'frame', x: 0, y: 0, width: 250, height: 150 }])).toEqual(r1);
    // Kart yoksa görünür alanın ortası.
    expect(AR.veFeadNotYeri('frame', null, [], { x: 3200, y: 3100 }))
      .toEqual({ x: 3200 - 125, y: 3100 - 75, width: 250, height: 150 });
  });

  test('YER — yazı kartların ÜSTÜNE; çerçevenin üst kenarına ve başka yazıya binmez, onların üstüne çıkar', () => {
    const kutu = { x: 1000, y: 800, w: 640, h: 500 };
    const ust = (r, a) => r.x < a.x + (a.width || 120) && r.x + r.width > a.x;
    const y0 = 800 - 30 - 12;
    expect(AR.veFeadNotYeri('text', kutu, [])).toEqual({ x: 1000, y: y0, width: 120, height: 30 });
    const cer = Object.assign({ type: 'frame' }, AR.veFeadNotYeri('frame', kutu, []));
    const t1 = AR.veFeadNotYeri('text', kutu, [cer]);
    expect(t1.y + t1.height).toBeLessThanOrEqual(cer.y - 12);           // etiket bandının üstünde
    expect(ust(t1, cer)).toBe(true);
    const t2 = AR.veFeadNotYeri('text', kutu, [cer, Object.assign({ type: 'text' }, t1)]);
    expect(t2.y + t2.height).toBeLessThanOrEqual(t1.y);                 // bir öncekinin üstüne dizilir
    // Yatayda örtüşmeyen çerçeve yazıyı itmez.
    expect(AR.veFeadNotYeri('text', kutu, [{ type: 'frame', x: 5000, y: 770, width: 300, height: 200 }]).y).toBe(y0);
  });

  test('KAMERA — görünen not için OYNAMAZ; görünmeyene en az kayar; büyükse sol üstü görünür', () => {
    const g = { sol: 0, w: 1000, h: 800 };
    const r = (x, y, w, h) => ({ x: 3000 + x, y: 3000 + y, width: w, height: h });
    expect(AR.veFeadNotKaydir(r(100, 100, 100, 50), 1, { x: 0, y: 0 }, g)).toEqual({ dx: 0, dy: 0 });
    expect(AR.veFeadNotKaydir(r(950, 100, 100, 50), 1, { x: 0, y: 0 }, g)).toEqual({ dx: 1000 - 16 - 1050, dy: 0 });
    // Örtünün (yuvadaki pencere) altı görünür sayılmaz.
    expect(AR.veFeadNotKaydir(r(100, 100, 100, 50), 1, { x: 0, y: 0 }, { sol: 248, w: 1000, h: 800 }))
      .toEqual({ dx: 248 + 16 - 100, dy: 0 });
    // Görünümden büyük: sol üst köşe (etiket) kenardan 16 px içeride.
    expect(AR.veFeadNotKaydir(r(100, -40, 2000, 1500), 1, { x: 0, y: 0 }, g)).toEqual({ dx: 16 - 100, dy: 16 + 40 });
    // Yakınlaştırma ölçeği: zoom 2'de kanvas px iki ekran px.
    expect(AR.veFeadNotKaydir(r(-10, 100, 50, 20), 2, { x: 0, y: 0 }, g)).toEqual({ dx: 16 + 20, dy: 0 });
  });

  function ortam() {
    const kurulan = [];
    global.createAnnotation = jest.fn((t, x, y, o) => {
      const a = Object.assign({ id: 'annot-' + (kurulan.length + 1), type: t, x, y,
        width: t === 'frame' ? 250 : 120, height: t === 'frame' ? 150 : 30 }, o || {});
      kurulan.push(a); stubs.saveState(); return a;
    });
    global.annotations = kurulan;
    global.clearSelection = jest.fn();
    global.clearAnnotationSelection = jest.fn();
    global.selectAnnotation = jest.fn();
    global.veBoundaryBox = CS.veBoundaryBox;
    global.canvasZoom = 1;
    global.canvasOffset = { x: -2500, y: -2400 };
    global.updateCanvasTransform = jest.fn();
    return {
      kurulan,
      geri: () => ['createAnnotation', 'annotations', 'clearSelection', 'clearAnnotationSelection', 'selectAnnotation',
        'veBoundaryBox', 'canvasZoom', 'canvasOffset', 'updateCanvasTransform', 'selectedNodes']
        .forEach((k) => { delete global[k]; })
    };
  }

  test('TIK — annotations.js’in kurucusu, TEK kayıt; kartların HEPSİ (seçim daraltmaz); seçim yalnız yeni notta', () => {
    const o = ortam();
    try {
      const [a, b] = kurKartlarla(kart('ka', 3000, 2800, 640, 500), kart('kb', 3664, 2800, 440, 500));
      // SEÇİM HEDEFİ DARALTMAZ: örnek kurucusu son kartı seçili bırakıyor
      // (ölçüldü) — seçime bakan kural kullanıcının seçmediği kartı çerçevelerdi.
      global.selectedNodes = [b];
      // Kutulu kartların HEPSİ (kasnaklar kutusuz, hesaba girmez).
      // Alt pay: sınır çerçevesinin ad payı (VE_NODE_LABEL_H) — ölçer yoksa 20.
      const P = AR.VE_FEAD_NOT_PAY, alt = CS.VE_NODE_LABEL_H;
      expect(AR.veFeadAracEylem('not', 'frame')).toBe(true);
      expect(global.createAnnotation).toHaveBeenCalledTimes(1);
      expect(global.createAnnotation).toHaveBeenCalledWith('frame', a.x - P, a.y - P,
        { width: b.x + b.width - a.x + 2 * P, height: 500 + alt + 2 * P });
      expect(stubs.saveState).toHaveBeenCalledTimes(1);                 // bir eylem = bir geri-al adımı
      // Seçim YALNIZ yeni notta: Delete seçili kartı da silerdi (ui-core.js).
      expect(global.clearSelection).toHaveBeenCalled();
      expect(global.clearAnnotationSelection).toHaveBeenCalled();
      expect(global.selectAnnotation).toHaveBeenCalledWith(o.kurulan[0]);
      expect(stubs.showToast).toHaveBeenCalledWith(expect.stringMatching(/Gruplama çerçevesi eklendi/), 'success');
      // Yazı kartların sol üstünün ÜSTÜNE; az önceki çerçevenin üst bandı
      // (etiketi) altında kalır: y = (çerçeve.y − 12) − 30 − 12.
      AR.veFeadAracEylem('not', 'text');
      expect(global.createAnnotation).toHaveBeenLastCalledWith('text', a.x, (a.y - P) - 12 - 30 - 12, undefined);
      // Bilinmeyen tip kurulmaz.
      expect(AR.veFeadAracEylem('not', 'note')).toBe(false);
      expect(global.createAnnotation).toHaveBeenCalledTimes(2);
    } finally { o.geri(); }
  });

  test('TIK — görünmeyen not görünür kılınır (kamera kayar); görünen için kamera OYNAMAZ', () => {
    const o = ortam();
    try {
      kurKartlarla(kart('ka', 3000, 2800, 640, 500));
      global.selectedNodes = [];
      const kap = document.getElementById('ve-canvas-wrapper');
      Object.defineProperty(kap, 'clientWidth', { configurable: true, value: 1200 });
      Object.defineProperty(kap, 'clientHeight', { configurable: true, value: 800 });
      // Kart ekranda (x 200…840, y 200…700): çerçeve görünür → kamera sabit.
      global.canvasOffset = { x: 200, y: 400 };
      AR.veFeadNotEkle('frame');
      expect(global.updateCanvasTransform).not.toHaveBeenCalled();
      expect(global.canvasOffset).toEqual({ x: 200, y: 400 });
      // Kart ekranın solunda ve üstünde dışarıda: kamera yazıyı 16 px içeri alır.
      global.canvasOffset = { x: -500, y: -300 };
      const t = AR.veFeadNotEkle('text');
      expect(global.updateCanvasTransform).toHaveBeenCalledTimes(1);
      expect((t.x - 3000) + global.canvasOffset.x).toBe(16);
      expect((t.y - 3000) + global.canvasOffset.y).toBe(16);
    } finally { o.geri(); }
  });

  test('pencere DOM: tık ve Enter/Boşluk eylemi çağırır; sürükleme annotations.js’in TAŞIYICISINI yazar', () => {
    const o = ortam();
    try {
      kur();
      AR.veFeadAraclarKapsam('fead-analysis');
      const pen = document.getElementById('ve-fead-araclar');
      const oge = (v) => pen.querySelector('[data-ey="not"][data-v="' + v + '"]');
      oge('frame').click();
      expect(global.createAnnotation).toHaveBeenLastCalledWith('frame', expect.any(Number), expect.any(Number), expect.any(Object));
      const tus = (v, key) => oge(v).dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
      tus('text', 'Enter');
      tus('text', ' ');
      tus('text', 'a');
      expect(global.createAnnotation.mock.calls.map((c) => c[0])).toEqual(['frame', 'text', 'text']);
      // Sürükleme: jsdom DataTransfer üretmez — taşıyıcı elle takılır.
      const ev = new Event('dragstart', { bubbles: true });
      ev.dataTransfer = { setData: jest.fn(), effectAllowed: 'all' };
      oge('text').dispatchEvent(ev);
      expect(ev.dataTransfer.setData).toHaveBeenCalledWith('annotation-type', 'text');
      expect(ev.dataTransfer.effectAllowed).toBe('copy');
    } finally { o.geri(); }
  });

  test('pencere BIRAKMA HEDEFİ DEĞİL — not sürüklemesini reddeder, olay yine kabarır; başka sürüklemeye dokunmaz', () => {
    kur();
    AR.veFeadAraclarKapsam('fead-analysis');
    const kap = document.getElementById('ve-canvas-wrapper');
    const duyan = jest.fn();
    kap.addEventListener('dragover', duyan);
    const bas = (types) => {
      const ev = new Event('dragover', { bubbles: true, cancelable: true });
      ev.dataTransfer = { types, dropEffect: 'copy' };
      document.querySelector('#ve-fead-araclar .ve-fead-arac-govde').dispatchEvent(ev);
      return ev.dataTransfer.dropEffect;
    };
    expect(bas(['annotation-type'])).toBe('none');
    expect(bas(['Files'])).toBe('copy');                                // dosya sürüklemesi (ölçüm içe aktarma)
    expect(bas(['component-type'])).toBe('copy');                       // kasnak listesi: davranışı değişmedi
    expect(duyan).toHaveBeenCalledTimes(3);                             // belge/kap dinleyicileri körleşmez
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('görünüm durumu MODELDE DEĞİL — tarayıcıda', () => {
  test('katla: localStorage’a yazar, geri-al yığınına YAZMAZ, modele sızmaz', () => {
    kur();
    const once = JSON.stringify(global.nodes);
    expect(AR.veFeadAraclarKatla()).toBe(true);
    expect(JSON.parse(localStorage.getItem(AR.VE_FEAD_ARAC_ANAHTAR)).katli).toBe(true);
    expect(stubs.saveState).not.toHaveBeenCalled();
    expect(JSON.stringify(global.nodes)).toBe(once);
    expect(AR.veFeadAraclarKatla()).toBe(false);
  });

  test('bozuk kayıt varsayılana düşer: yuvada, açık', () => {
    localStorage.setItem(AR.VE_FEAD_ARAC_ANAHTAR, '{bozuk');
    expect(AR.veFeadAraclarYer()).toEqual({ yuva: true, x: AR.VE_FEAD_ARAC_YUVA.x,
                                            y: AR.VE_FEAD_ARAC_YUVA.y, katli: false });
  });

  test('depolama patlarsa pencere çalışmaya devam eder — yalnız oturumda kalır', () => {
    const al = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('engelli'); });
    const yaz = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('engelli'); });
    try {
      expect(AR.veFeadAraclarYer().yuva).toBe(true);
      expect(() => AR.veFeadAraclarKatla()).not.toThrow();
      expect(AR.veFeadAraclarYer().katli).toBe(true);
    } finally { al.mockRestore(); yaz.mockRestore(); }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('DOM — kapsam, yuva, olay, tazeleme', () => {
  const el = () => document.getElementById('ve-fead-araclar');

  test('yalnız FEAD kapsamında görünür; dışarıda tazelenmez', () => {
    kur();
    expect(AR.veFeadAraclarKapsam('fead-analysis')).toBe(true);
    expect(el().hidden).toBe(false);
    expect(el().querySelector('.ve-settings-header')).not.toBeNull();   // pencere ailesi
    expect(AR.veFeadAraclarKapsam('arac-performans')).toBe(false);
    expect(el().hidden).toBe(true);
    expect(AR.veFeadAraclarTazele()).toBe(false);
    expect(AR.veFeadAraclarKapsam(null)).toBe(false);
  });

  test('YUVADAKİ pencere tuvali örttüğünü SÖYLER; serbest pencere söylemez', () => {
    kur();
    AR.veFeadAraclarKapsam('fead-analysis');
    expect(el().getAttribute('data-ve-ortu')).toBe('sol');
    expect(el().getAttribute('data-yuva')).toBe('1');
    document.body.innerHTML = '<div id="ve-canvas-wrapper"><div id="ve-canvas"></div></div>';
    AR._feadAracSifirla();
    localStorage.setItem(AR.VE_FEAD_ARAC_ANAHTAR, JSON.stringify({ yuva: false, x: 400, y: 90 }));
    AR.veFeadAraclarKapsam('fead-analysis');
    expect(el().hasAttribute('data-ve-ortu')).toBe(false);
    expect(el().getAttribute('data-yuva')).toBe('0');
    expect([el().style.left, el().style.top]).toEqual(['400px', '90px']);
  });

  test('katlı pencere şeridini gösterir ve yuvadaysa örtüsünü korur', () => {
    kur();
    AR.veFeadAraclarKapsam('fead-analysis');
    AR.veFeadAraclarKatla();
    expect(el().classList.contains('katli')).toBe(true);
    expect(el().getAttribute('data-ve-ortu')).toBe('sol');
    const k = el().querySelector('.ve-fead-arac-katla');
    expect(k.getAttribute('aria-expanded')).toBe('false');
    // Şerit ikinci bir eylem kümesi DEĞİL — aynı eylem anahtarları.
    expect([...el().querySelectorAll('.ve-fead-arac-ray [data-ey]')].map((b) => b.getAttribute('data-ey')))
      .toEqual(['hesapla', 'indir', 'yon', 'sihirbaz']);
  });

  test('tuvale olay SIZDIRMAZ — tık, basma, tekerlek, çift tık', () => {
    kur();
    AR.veFeadAraclarKapsam('fead-analysis');
    const kap = document.getElementById('ve-canvas-wrapper');
    const duyulan = [];
    ['mousedown', 'pointerdown', 'dblclick', 'contextmenu', 'wheel', 'click'].forEach((t) => {
      kap.addEventListener(t, () => duyulan.push(t));
      el().querySelector('.ve-fead-arac-govde').dispatchEvent(new Event(t, { bubbles: true }));
    });
    expect(duyulan).toEqual([]);
  });

  test('PASİF düğme eylemi çağırmaz — Hesapla ve İndir sebebini söyler', () => {
    global.nodes = ['fead-belt', 'fead-solver', 'fead-report', 'fead-wizard']
      .map((t, i) => ({ id: 'b' + i, type: t, def: componentDefs[t], data: {} }));
    AR.veFeadAraclarKapsam('fead-analysis');
    const t = casus('veFeadToggleSpin');
    try {
      el().querySelector('.ve-fead-arac-govde [data-ey="yon"]').click();   // yön yok → pasif
      expect(t.c).not.toHaveBeenCalled();
      el().querySelector('.ve-fead-arac-govde [data-ey="hesapla"]').click();
      expect(stubs.showToast).toHaveBeenCalledWith(expect.stringMatching(/kasnak/), 'warning');
    } finally { t.geri(); }
  });

  test('tazeleme ODAĞI eylem anahtarıyla geri verir', () => {
    kur();
    AR.veFeadAraclarKapsam('fead-analysis');
    el().querySelector('.ve-fead-arac-govde [data-ey="ayarlar"]').focus();
    const eski = document.activeElement;
    expect(AR.veFeadAraclarTazele()).toBe(true);
    expect(document.activeElement).not.toBe(eski);                     // yeniden kuruldu…
    expect(document.activeElement.getAttribute('data-ey')).toBe('ayarlar');  // …odak yerinde
  });

  test('tazeleme ÜÇ noktadan: kart tazelemesi · çözüm · sonucu unutma', () => {
    const src = oku('js/cp-fead.js');
    const govdesi = (ad) => {
      const i = src.indexOf('function ' + ad + '(');
      expect({ ad, var: i >= 0 }).toEqual({ ad, var: true });
      return src.slice(i, src.indexOf('\n}\n', i));
    };
    ['veFeadRefreshLayoutCards', 'veFeadSolve', '_feadForgetResults'].forEach((ad) => {
      expect({ ad, tazeler: govdesi(ad).includes('veFeadAraclarTazele()') }).toEqual({ ad, tazeler: true });
    });
    // Sonucu unutmak pencereyi GERÇEKTEN boşaltıyor (çağrı değil sonuç).
    kur();
    AR.veFeadAraclarKapsam('fead-analysis');
    global.veFeadAraclarTazele = AR.veFeadAraclarTazele;
    try {
      fead.veFeadSolve(tip('fead-solver').id);
      expect(el().querySelector('.ve-fead-arac-kpi')).not.toBeNull();
      fead._feadForgetResults();
      expect(el().querySelector('.ve-fead-arac-kpi')).toBeNull();
    } finally { delete global.veFeadAraclarTazele; }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('görünüm CSS’te — ölçü sabitleri birebir', () => {
  const CSS = oku('css/styles.css');
  const kural = (sec) => {
    const kac = sec.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const m = CSS.match(new RegExp('(?:^|\\n)' + kac + '\\{([^}]*)\\}'));
    return m ? m[1] : '';
  };

  test('pencerenin eni JS’teki sabitle AYNI (kılavuz sahnesi onu okuyor)', () => {
    expect(kural('.ve-fead-arac')).toMatch(new RegExp('width:' + AR.VE_FEAD_ARAC_EN + 'px'));
  });

  test('satır içi RENK yazılmıyor — durum kuralları jetondan', () => {
    const src = oku('js/cp-fead-araclar.js');
    expect(src).not.toMatch(/style="[^"]*(color|background)/);
    // Birincil eylem çözücü penceresindeki Hesapla ile AYNI aile.
    expect(kural('.ve-fead-arac-btn.birincil')).toMatch(/--accent-warning/);
    expect(kural('.ve-fead-arac-kpi.bayat > div')).toMatch(/opacity/);
    expect(kural('.ve-fead-arac-yuva.yakin')).toMatch(/opacity:1/);
  });

  // `hidden` NİTELİĞİ TEK BAŞINA GİZLEMEZ: `.ve-fead-arac{display:flex}`
  // tarayıcının [hidden] kuralını eziyor ve kapsam dışındaki pencere ana
  // topolojide görünür kalıyordu. jsdom CSS uygulamadığı için yukarıdaki
  // kapsam testi niteliği görüp geçiyordu; gerçek tarayıcı kapısı
  // fead-araclar.spec.js → "KAPSAM".
  test('hidden nitelikli pencere CSS’te de gizli — display kuralı onu ezmiyor', () => {
    expect(kural('.ve-fead-arac[hidden]')).toMatch(/display:\s*none/);
  });

  test('kılavuz sahnesi pencereyi AKIŞTA çizer (tuvalde mutlak)', () => {
    expect(kural('.ve-fead-arac')).toMatch(/position:absolute/);
    expect(kural('.ve-fead-arac.ve-fead-arac-sahne')).toMatch(/position:relative/);
  });
});
