/**
 * fead-panel-dili.test.js — FEAD PENCERELERİNİN ORTAK DİLİ (.ve-fp-*)
 *
 * Kullanıcı bildirimi (2026-09-21, ekran görüntüsüyle): *"çok karışık ve kötü
 * duruyor. Yazılar kaymış, girdiler yanlış konumlanmış falan filan."* ve
 * ardından: *"Diğer bileşenlerin pencereleri için de aynı değişiklikleri
 * kapsamlı olarak yapmamız gerekiyor."*
 *
 * Beş kusur ölçüldü; dördü YAPISALDI:
 *
 *   P1 Pencere GENİŞ (kasnaklar `VE_WIDE_PANEL_TYPES`'ta, gerçek tarayıcıda
 *      1040 px) ama içerik tek sütundu ve `_feadSelect`in etiketi `flex:1` ile
 *      bütün boşluğu yiyip kontrolü sağ uca fırlatıyordu.
 *   P2 Aynı pencerede İKİ etiket modeli: `_feadSelect` sol-sağ, `_feadGrid`
 *      üst-alt. Göz sabit bir sütun kenarı bulamıyordu.
 *   P3 Etiket `text-align:center`, giriş `text-align:right`. "Yazılar kaymış"
 *      denen şey tam olarak bu iki kelimelik uyuşmazlıktı.
 *   P4 Neredeyse her alanın altında paragraf.
 *   P5 Görünüm satır içi `style=` dizelerinde (240 tane) — satır içi CSS DURUM
 *      İFADE EDEMEZ, yani hiçbir FEAD panelinde `:hover`/`:focus` yoktu.
 *
 * KALDIRAÇ YARDIMCILARDA: 44 kart / 18 ızgara / 13 liste / 74 açıklama hepsi
 * altı yardımcıdan geçiyor. İmzalar korunarak yalnız ÜRETTİKLERİ işaretleme
 * sınıf tabanlı yapıldı — yani BÜTÜN FEAD panelleri tek yerden düzeldi.
 *
 * Pencere tasarımı: sabit sağ sütun (kullanıcı, 2026-09-21 · C) ve TEK GÖVDE
 * (2026-10-16 — kategoriler sekme değil, alt alta: *"Tek bir pencerede hepsi
 * sığar"*; 09-21'in B'si, sekmeler, emekli). CSS tarafının kapısı
 * `source-hygiene.test.js` → *"PANEL DİLİ"*.
 */
const fs = require('fs');
const path = require('path');

const stubs = stubGlobals();
document.body.innerHTML = '<div id="ve-canvas"></div>';
global.nodes = [];
global.connections = [];
eval(loadSource('components.js'));
global.veIsCanvasHidden = veIsCanvasHidden;
global.componentDefs = componentDefs;
global.VE_MODULES = VE_MODULES;

const M = require('../../js/fead-model.js');
Object.keys(M).forEach((k) => { if (global[k] === undefined) global[k] = M[k]; });
// ÇEKİRDEK `global.FEADCore` OLARAK YAZILIR: `fead-model.js` köprüsü onu
// global'den arıyor; yalnız `require` etmek "Hesap çekirdeği yüklenmedi"
// diyen, HİÇ ÇÖZÜLMEYEN bir dünya ölçtürürdü.
global.FEADCore = require('../../js/fead-core.js');
// KATALOGLAR DA YÜKLENİR: yüklenmezlerse gergi künyesi ve motor kataloğu
// satırları "kütüphane yüklenmedi" ipucuna düşüyor (doğru davranış) — ama o
// dünyada ölçülen şey satırın HİÇ OLMAMASI olurdu, hizası değil.
const TL = require('../../js/fead-tensioners.js');
Object.keys(TL).forEach((k) => { if (global[k] === undefined) global[k] = TL[k]; });
const EN = require('../../js/fead-engines.js');
Object.keys(EN).forEach((k) => { if (global[k] === undefined) global[k] = EN[k]; });
const CH = require('../../js/fead-checks.js');
Object.keys(CH).forEach((k) => { if (global[k] === undefined) global[k] = CH[k]; });
// Aksesuar künyesi de: TEK model seçicisinin listesi (`veFeadAccModelOpts`)
// yüklenmezse boş döner ve kart hiç çizilmez.
const AC = require('../../js/fead-accessories.js');
Object.keys(AC).forEach((k) => { if (global[k] === undefined) global[k] = AC[k]; });
const fead = require('../../js/cp-fead.js');
Object.keys(fead).forEach((k) => { if (global[k] === undefined) global[k] = fead[k]; });

const SRC = fs.readFileSync(path.join(__dirname, '../../js/cp-fead.js'), 'utf8');

beforeEach(() => {
  resetStubs(stubs);
  global.nodes = [];
  global.connections = [];
  document.body.innerHTML = '<div id="ve-canvas"></div>';
});

const kasnak = (over) => Object.assign(
  { id: 'k1', type: 'fead-crank', data: { od: 250, x: 0, y: 0, driver: true } }, over || {});

// Üretilen HTML'i GERÇEK DOM'a koyup ölçer — dize aramak hizayı ölçemez.
const ciz = (html) => {
  const kap = document.createElement('div');
  kap.innerHTML = html;
  return kap;
};

// ═══════════════════════════════════════════════════════════════════════════
describe('ALAN SATIRI — etiket SOLDA, değer SAĞDA (P2 · P3)', () => {
  test('her alan tek bir satırda: .ve-fp-l + giriş, AYNI kapta', () => {
    const kap = ciz(fead._feadGridHTML
      ? fead._feadGridHTML(kasnak(), [{ key: 'od', label: 'Dış çap (OD)' }], 1)
      : getFeadPulleyPropertiesHTML(kasnak()));
    const f = kap.querySelector('.ve-fp-f');
    expect(f).toBeTruthy();
    // İKİSİ DE AYNI SATIRIN ÇOCUĞU — eski hâlde etiket üstte ayrı bir
    // <span>, giriş altta ayrı bir satırdı.
    expect(f.querySelector('.ve-fp-l')).toBeTruthy();
    expect(f.querySelector('.ve-fp-inp, .ve-fp-sel')).toBeTruthy();
    expect(f.querySelector('.ve-fp-l').parentElement).toBe(f);
    expect(f.querySelector('.ve-fp-inp, .ve-fp-sel').parentElement).toBe(f);
  });

  test('SÜTUN SAYISI HÜCRE SAYISINI AŞMIYOR — boş ızgara gözü kalmasın', () => {
    // Ölçülen kusur: gergi panelinde `_feadGrid(node, [tek hücre], 2)`
    // "Kol boyu"nun sağında yarım satırlık boş göz bırakıyordu; saç teli
    // zemini yüzünden o göz artık GÖRÜNÜR.
    const html = getFeadTensionerPropertiesHTML({
      id: 't1', type: 'fead-tensioner',
      data: { od: 75, cenX: -170, cenY: 99, armLen: 90, contact: 'back' } });
    const kap = ciz(html);
    [...kap.querySelectorAll('.ve-fp-grid')].forEach((g) => {
      const k = Number((g.getAttribute('style') || '').replace(/[^\d]/g, ''));
      expect(k).toBeGreaterThanOrEqual(1);
      expect(k).toBeLessThanOrEqual(g.querySelectorAll('.ve-fp-f').length);
    });
  });

  test('üretilen panel satır içi HİZA/RENK yazmıyor — görünüm CSS\'te (P5)', () => {
    const kap = ciz(getFeadPulleyPropertiesHTML(kasnak()));
    [...kap.querySelectorAll('.ve-fp-f, .ve-fp-l, .ve-fp-inp, .ve-fp-sel, .ve-fp-sect')]
      .forEach((el) => {
        const st = el.getAttribute('style') || '';
        expect(st).not.toMatch(/text-align/);
        expect(st).not.toMatch(/color\s*:/);
        expect(st).not.toMatch(/background/);
      });
    // Satır içinde kalan tek şey VERİ: sütun sayısı (`--fp-k`), tıpkı
    // Kayış Tablosu'nun `<colgroup>` genişlikleri gibi (kural 14).
    [...kap.querySelectorAll('.ve-fp-grid[style]')].forEach((g) => {
      expect(g.getAttribute('style')).toMatch(/^--fp-k:\d+;$/);
    });
  });

  test('BİRİM etikette, değerin içinde DEĞİL', () => {
    const kap = ciz(getFeadTensionerPropertiesHTML({
      id: 't1', type: 'fead-tensioner',
      data: { od: 75, cenX: -170, cenY: 99, armLen: 90, contact: 'back' } }));
    const u = kap.querySelector('.ve-fp-l u');
    expect(u).toBeTruthy();
    expect(u.textContent).toMatch(/\[/);          // "[°]" · "[mm]" biçimi
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('TEK GÖVDE — kategoriler alt alta, hiçbiri gizli değil', () => {
  // Kullanıcı (2026-10-16): *"bir bileşen özelinde tek bir pencerede tamamı
  // sığacak içerikleri genel olarak iki pencereye ayırmışız … Tüm bileşenler
  // için bunu uygulayalım."* Kategoriler VERİ olarak kalır (ad · durum · bant),
  // sekme şeridi ve gizli gövde yok.
  const kategoriler = (k) => [...k.querySelectorAll('.ve-fp-govde > .ve-fp-kat')].map((t) => t.getAttribute('data-k'));
  test('SÜRÜCÜDE dört kategori (Motor · Çevrim), aksesuarda dört, AVARADA iki', () => {
    // Sürücü motoru taşır (2026-09-28): Motor (motor · devir sınırları · güç
    // eğrisi · FEAD tahriki) ve Çevrim — Çözücü'den geldiler.
    const k = ciz(getFeadPulleyPropertiesHTML(kasnak()));
    expect(kategoriler(k)).toEqual(['geo', 'rol', 'mot', 'cev']);
    const ac = ciz(getFeadPulleyPropertiesHTML(kasnak({ id: 'c1', type: 'fead-ac',
      data: { od: 120, x: 0, y: 0 } })));
    expect(kategoriler(ac)).toEqual(['geo', 'rol', 'dev', 'egr']);
    // Avara kayıştan güç ÇEKMEZ: devir sınırı da güç eğrisi de ona sorulmuyor
    // (kural 25 — sorulan her alanın bir tüketicisi olmak zorunda).
    const a = ciz(getFeadPulleyPropertiesHTML(kasnak({ id: 'a1', type: 'fead-idler',
      data: { od: 75, x: 0, y: 0 } })));
    expect(kategoriler(a)).toEqual(['geo', 'rol']);
  });

  test('bütün kategoriler GÖRÜNÜR, sekme şeridi YOK — bölümü kartın başlığı adlandırır', () => {
    const kap = ciz(getFeadPulleyPropertiesHTML(kasnak()));
    const gov = kap.querySelector('#ve-fp-panes-k1');
    expect([...gov.children].filter((c) => c.hasAttribute('hidden') || c.getAttribute('role') === 'tabpanel')).toEqual([]);
    expect(kap.querySelector('.ve-fp-tabs, .ve-fp-tab, [role="tablist"]')).toBeNull();
    // Her kategori en az bir başlıklı kart taşır: başlık katmanı kartın kendisi.
    [...gov.children].forEach((kat) => expect({ k: kat.getAttribute('data-k'), baslik: !!kat.querySelector('.ve-fp-sect > b') })
      .toEqual({ k: kat.getAttribute('data-k'), baslik: true }));
  });

  test('GÖRÜNÜM DURUMU MODELDE YOK — çizmek ve kategoriye gitmek düğümü değiştirmez', () => {
    // Kural 15'in (`VE_FEAD_KAT_ACIK`) birebir aynı gerekçesi: Ctrl+Z görünüm
    // gezdirmesin. ÇİZİMİN KENDİSİ de yazmamalı — davranış ölçülmeden metin
    // aramak kapı değildir.
    const n = kasnak();
    const cizimOnce = JSON.stringify(n.data);
    document.body.innerHTML = getFeadPulleyPropertiesHTML(n);
    expect(JSON.stringify(n.data)).toBe(cizimOnce);
    expect(vePencereKategoriGit('k1', 'rol')).toBe(true);
    expect(fead.veFeadEksikGit('k1', 'cev')).toBe(true);
    expect(JSON.stringify(n.data)).toBe(cizimOnce);     // düğüm verisi DEĞİŞMEDİ
    expect(stubs.saveState).not.toHaveBeenCalled();     // yığına adım YAZILMADI
    expect(SRC).not.toMatch(/node\.data\.panelTab|data\.sekme/);
    expect(vePencereKategoriGit('k1', 'yok')).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('SAĞ SÜTUN — gövdeden BAĞIMSIZ (tasarımın iddiası)', () => {
  test('kategoriye gitmek pencereyi KURMAZ — sağ sütun aynı eleman, gövdenin DIŞINDA', () => {
    // Pencere yeniden kurulsaydı (a) düzenlenen alanın odağı düşerdi, (b) sağ
    // sütundaki çözüm her tıklamada yeniden koşardı.
    document.body.innerHTML = getFeadPulleyPropertiesHTML(kasnak());
    const yan = document.querySelector('.ve-fp-side');
    const gov = document.querySelector('#ve-fp-panes-k1');
    expect(yan).toBeTruthy();
    fead.veFeadEksikGit('k1', 'rol');
    expect(document.querySelector('.ve-fp-side')).toBe(yan);     // AYNI nesne
    expect(document.querySelector('#ve-fp-panes-k1')).toBe(gov);
    // Sütun gövdenin DIŞINDA ve hiçbir kategoriye bağlı DEĞİL.
    expect(gov.contains(yan)).toBe(false);
    expect(yan.hasAttribute('hidden')).toBe(false);
    expect(yan.hasAttribute('data-k')).toBe(false);
  });

  test('kapılar TEK ÇAĞRIDAN — veFeadChecks (kural 16)', () => {
    const eski = global.veFeadChecks;
    let cagri = 0;
    global.veFeadChecks = () => {
      cagri++;
      return { centerDistance: { durum: 'warn', note: 'pay 3 mm' },
               ratioWindow: { durum: 'ok', note: '' },
               speedLimit: { durum: 'wait', note: 'governed yok' } };
    };
    try {
      const kap = ciz(getFeadPulleyPropertiesHTML(kasnak()));
      expect(cagri).toBe(1);                        // panel başına TEK çağrı
      const g = [...kap.querySelectorAll('.ve-fp-gate')];
      const d = g.map((x) => x.getAttribute('data-d'));
      expect(d).toContain('warn');
      expect(d).toContain('ok');
      expect(d).toContain('wait');
      // Sebep gizlenmiyor, ipucuna taşınıyor (kural 10: sınır yanında yazılır).
      expect(g.some((x) => (x.getAttribute('title') || '').includes('pay 3 mm'))).toBe(true);
    } finally { global.veFeadChecks = eski; }
  });

  test('çözüm yokken sağ sütun SESSİZCE BOŞ değil', () => {
    const kap = ciz(getFeadPulleyPropertiesHTML(kasnak()));
    // Kapılar "değerlendirilemedi" diyor, Türetilenler '—' gösteriyor.
    expect(kap.querySelector('.ve-fp-side .ve-fp-gate[data-d="wait"]')).toBeTruthy();
    const ro = [...kap.querySelectorAll('.ve-fp-side .ve-fp-inp[readonly]')];
    expect(ro.length).toBeGreaterThanOrEqual(4);
    expect(ro.every((i) => i.getAttribute('value') !== '')).toBe(true);
  });

  test('TÜRETİLEN SAYILAR tablonun satırından — ikinci bir hesap YOK (kural 9)', () => {
    // BU HALKA STUB'LANAMAZ ve bir kez öyle DENENDİ: `veFeadTableRows`
    // cp-fead.js'in KENDİ modül kapsamında tanımlı, yani panelin çıplak
    // çağrısı `global`e HİÇ bakmaz — `global.veFeadTableRows = ...` yazan bir
    // sahte tablo sessizce görmezden gelinir ve test kodun değil fikstürün
    // ölçümü olur. Bu yüzden burada GERÇEK bir model çözülüyor: beklenen
    // sayılar tablonun kendi satırından okunup panelin bastığıyla
    // KARŞILAŞTIRILIYOR. İkinci bir hesap (dış çapı efektif çap sanmak,
    // işaretsiz sarım yazmak, başka basamağa yuvarlamak) eşitliği bozar.
    const pack = veFeadExampleNodes('AG00976_GATES_2025');
    global.nodes = pack.nodes.map((n) => ({
      id: n.id, type: n.type, def: componentDefs[n.type],
      customName: n.customName, data: JSON.parse(JSON.stringify(n.data)) }));

    const build = veFeadBuildFromCanvas();
    expect(build.ok).toBe(true);                    // fikstür gerçekten çözülüyor
    const T = veFeadTableRows(build);
    expect(T.ok).toBe(true);

    // Sürücü OLMAYAN, ORTADAKİ bir kasnak: asıl risk bir satırın kaymasıdır;
    // 1. satır kaymayı gizler (indis de sürücü rozeti de kendi başına doğru
    // görünür).
    const hedef = global.nodes.filter((n) => n.id === 'ex-ALT')[0];
    const satir = T.rows.filter((r) => r.id === hedef.id)[0];
    expect(satir).toBeTruthy();

    const kap = ciz(getFeadPulleyPropertiesHTML(hedef));
    const yan = kap.querySelector('.ve-fp-side');
    // Türetilen değer okunur GİRİŞTE durur (`readonly`), metin düğümünde
    // değil — `textContent` onları HİÇ görmez.
    const oku = (etiket) => {
      const f = [...yan.querySelectorAll('.ve-fp-f')]
        .filter((x) => (x.querySelector('.ve-fp-l') || {}).textContent === etiket)[0];
      return f ? f.querySelector('.ve-fp-inp').getAttribute('value') : null;
    };

    expect(oku('Efektif \u00e7ap')).toBe(veSayi(satir.effDiaMm, 1) + ' mm');
    expect(oku('Sar\u0131m a\u00e7\u0131s\u0131')).toBe(veSayi(satir.wrapDeg, 1) + '\u00b0');
    expect(oku('D\u00f6n\u00fc\u015f y\u00f6n\u00fc')).toBe(satir.spin);
    expect(oku('Kay\u0131\u015f s\u0131ras\u0131')).toBe(satir.index + ' / ' + T.rows.length);

    // NEGATİF KAPI: panel dış çapı efektif çap sansaydı yukarıdaki biçim yine
    // tutardı. İkisi bu kasnakta ayrışıyor (57,0 ↔ 59,4 mm), yani ölçüm
    // gerçekten TÜRETİLMİŞ sayıyı görüyor.
    expect(Number(hedef.data.od).toFixed(1) + ' mm').not.toBe(oku('Efektif \u00e7ap'));

    // Çevrim kapanışı da tablodan: işaretli toplamın MUTLAK değeri.
    expect(yan.textContent).toContain('\u03a3 ' + veSayi(Math.abs(T.signedWrapDeg), 1) + '\u00b0');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('KAPSAM — yalnız kasnak değil, BÜTÜN FEAD panelleri', () => {
  const panel = {
    kasnak: () => getFeadPulleyPropertiesHTML(kasnak()),
    gergi: () => getFeadTensionerPropertiesHTML({ id: 't1', type: 'fead-tensioner',
      data: { od: 75, cenX: -170, cenY: 99, armLen: 90, contact: 'back' } }),
    kayis: () => getFeadBeltPropertiesHTML({ id: 'b1', type: 'fead-belt',
      data: { profile: 'PK', ribs: 8 } }),
    cozucu: () => getFeadSolverPropertiesHTML({ id: 's1', type: 'fead-solver', data: {} }),
  };

  Object.keys(panel).forEach((ad) => {
    test(ad + ' paneli ortak dili kullanıyor', () => {
      const kap = ciz(panel[ad]());
      // Bölüm başlığı + en az bir hizalı alan satırı.
      expect(kap.querySelectorAll('.ve-fp-sect').length).toBeGreaterThan(0);
      expect(kap.querySelectorAll('.ve-fp-f').length).toBeGreaterThan(0);
      // Ve hiçbir alan satırı satır içi hiza yazmıyor.
      [...kap.querySelectorAll('.ve-fp-l')].forEach((l) => {
        expect(l.getAttribute('style') || '').not.toMatch(/text-align/);
      });
    });
  });

  test('DÖRT PANELİN DÖRDÜ DE kategorili TEK gövde ve sağ sütunlu — kapsamlı (kullanıcı isteği)', () => {
    // Kullanıcı (2026-09-21): *"Diğer bileşenlerin pencereleri için de aynı
    // değişiklikleri kapsamlı olarak yapmamız gerekiyor."* — ve 2026-10-16:
    // *"Tüm bileşenler için bunu uygulayalım"* (kategoriler tek gövdede).
    Object.keys(panel).forEach((ad) => {
      const kap = ciz(panel[ad]());
      const gov = kap.querySelector('[id^="ve-fp-panes-"]');
      const kat = [...gov.children];
      expect(kat.length).toBeGreaterThanOrEqual(2);              // kategoriler VAR
      expect(kat.every((c) => c.classList.contains('ve-fp-kat') && !c.hasAttribute('hidden'))).toBe(true);
      expect(kap.querySelector('.ve-fp-tab')).toBeNull();         // sekme YOK
      const yan = kap.querySelector('.ve-fp-side');
      expect(yan).toBeTruthy();                                  // sağ sütun VAR
      // Ve sütun gövdenin İÇİNDE değil.
      expect(gov.contains(yan)).toBe(false);
      // Her panelde kapılar aynı tek çağrıdan geliyor.
      expect(kap.querySelectorAll('.ve-fp-gate').length).toBe(4);
    });
  });

  test('ÇÖZÜCÜNÜN EYLEMİ gövdeye girmiyor — sağ sütunda duruyor', () => {
    // Pencerenin tek eylemi "Hesapla". Gövdeye girseydi kullanıcı çevrimi
    // düzenlerken düğmeyi aramak için gövdenin dibine inerdi; sağ sütunda dar
    // kapta da kaydırma alanının dibine yapışır.
    const kap = ciz(panel.cozucu());
    const dugme = kap.querySelector('.ve-fp-solve');
    expect(dugme).toBeTruthy();
    expect(kap.querySelector('.ve-fp-side').contains(dugme)).toBe(true);
    expect(kap.querySelector('[id^="ve-fp-panes-"]').contains(dugme)).toBe(false);
    // Model de çevrim de yokken KAPALI ve sebebi YAZILI — sessiz bir kapalı
    // düğme, kullanıcıya neyi eksik bıraktığını söylemiyordu.
    expect(dugme.hasAttribute('disabled')).toBe(true);
    expect(kap.querySelector('.ve-fp-solve-not').textContent).toMatch(/eksik|boş/i);
  });

  test('KATALOG SEÇİCİLERİ de ortak satırda — P1\'in son iki kopyası', () => {
    // Gergi künyesi ve BMC motor kataloğu kendi `display:flex` satırlarını
    // kuruyordu: `flex:1` etiket bütün boşluğu yiyip seçiciyi sağ uca
    // fırlatıyor, etiket ise üç satıra sarıyordu ("BMC / motor / kataloğu").
    // Motor kataloğu 2026-09-28'den beri sürücünün Motor kategorisinde; aksesuarın
    // TEK model seçicisi de aynı satırda.
    const secPanel = {
      gergi: panel.gergi,
      motor: () => fead.veFeadEngineCard({ id: 's1', type: 'fead-solver', data: {} }),
      model: () => fead.veFeadAccModelCard({ id: 'c1', type: 'fead-alternator', data: {} }),
    };
    [['gergi', 'Ölçülmüş künye'], ['motor', 'BMC motor kataloğu'], ['model', 'Model']].forEach(([ad, etiket]) => {
      const kap = ciz(secPanel[ad]());
      const l = [...kap.querySelectorAll('.ve-fp-l')]
        .filter((x) => x.textContent === etiket)[0];
      expect(l).toBeTruthy();                                    // ortak etiket sınıfı
      const satir = l.closest('.ve-fp-f');
      expect(satir.classList.contains('ve-fp-f--sel')).toBe(true);
      expect(satir.querySelector('select.ve-fp-sel')).toBeTruthy();
    });
    // Ve eski kalıptan geriye HİÇ kopya kalmadı.
    expect(SRC).not.toMatch(/flex:1; font-size:var\(--fs-body\); font-weight:600/);
  });

  test('KABUK DENGELİ — tek kök, kapanmamış <div> yok', () => {
    // Dört panelin dördü de kabuğunu artık `veFeadPanelShell`den alıyor ve
    // gövdeleri kategorilere BÖLÜNDÜ. Bölerken bir `</div>` fazla kalsaydı
    // `sw-panel` erken kapanır, sağ sütun modalın DIŞINA düşerdi — ve bu
    // sessizdir: tarayıcı açılmamış etiketi onarır, jsdom de öyle.
    Object.keys(panel).forEach((ad) => {
      const html = panel[ad]();
      expect((html.match(/<div\b/g) || []).length)
        .toBe((html.match(/<\/div>/g) || []).length);
      const kap = ciz(html);
      expect(kap.children.length).toBe(1);
      expect(kap.firstElementChild.className).toContain('ve-fp');
    });
  });

  test('eski satır içi stil dizeleri KALDIRILDI (kural 26)', () => {
    // Kaldırılan bir yapının dili de kaldırılır: `_FEAD_INP`/`_FEAD_SEL`
    // tanımları gitti, geride ASKIDA başvuru kalmamalı (bir kez kaldı ve
    // paneller `style="undefined"` basıyordu).
    expect(SRC).not.toMatch(/_FEAD_INP|_FEAD_SEL/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PENCERE DÜZENİ (2026-09-23) — kullanıcı bildirimi, kasnak penceresinin
// ekran görüntüsüyle: *"Şuradaki yapı biraz karışık. Düzen vs yok.
// Hizalamalar, şekiller şukullar hep kaymış."* Gerçek tarayıcıda ölçüldü
// (5 örnek × bütün pencere/sekmeler): etiketlerin denetiminden kayması
// 149 → 0, özet şeridinde asılı ayraç 4 → 0, bölüm çizgisi rengi 5 → 2,
// küçük resimde ad × ad çakışması 30 → 0, ad × kayış 90 → 0 (AG00879).
// Hizanın kendisi gerçek tarayıcıda ölçülür (fead-panel-gramer.spec.js);
// burada KURULUŞ kapılı.
// ═══════════════════════════════════════════════════════════════════════════
describe('PENCERE DÜZENİ — notlar, türetilenler, küçük resim', () => {
  // Gerçek bir örnek: küçük resim ancak çözülen bir modelde çizilir.
  const ornekKur = (anahtar) => {
    const pack = veFeadExampleNodes(anahtar);
    global.nodes = pack.nodes.map((n) => ({
      id: n.id, type: n.type, def: componentDefs[n.type],
      customName: n.customName, data: JSON.parse(JSON.stringify(n.data)) }));
    global.connections = [];
    return global.nodes;
  };

  // (Özet şeridi 2026-09-23'te kullanıcı kararıyla KALKTI — çiplerinin
  // kuralı onunla gitti; yokluğunun kapısı fead-pencere-ailesi.test.js.)

  test('bölüm notları KULLANICI dilinde — kodun iç adı basılmıyor', () => {
    // Uygunluk bölümünün sağında işlevin adı yazıyordu: `veFeadChecks`.
    const kodAdi = /^ve[A-Z]\w*$|^_?[a-z]+[A-Z]\w*$|\(\)/;
    [getFeadPulleyPropertiesHTML(kasnak()),
     getFeadSolverPropertiesHTML({ id: 's1', type: 'fead-solver', data: {} }),
     getFeadBeltPropertiesHTML({ id: 'b1', type: 'fead-belt', data: { profile: 'PK', ribs: 8 } })]
      .forEach((html) => {
        [...ciz(html).querySelectorAll('.ve-fp-sect em')].forEach((em) => {
          expect(em.textContent.trim()).not.toMatch(kodAdi);
        });
      });
    // Kaynakta da: hiçbir bölüm notu bir `ve…` adı taşımıyor.
    expect(SRC).not.toMatch(/<em>ve[A-Z]\w*<\/em>/);
  });

  test('türetilenler İKİ sütunda — dört okuma dört tam genişlik satır değil', () => {
    const n = ornekKur('AG00879_GATES_2023').filter((x) => x.data && x.data.driver)[0];
    const yan = ciz(getFeadPulleyPropertiesHTML(n)).querySelector('.ve-fp-side');
    const izg = [...yan.querySelectorAll('.ve-fp-grid')]
      .filter((g) => g.querySelector('.ve-fp-inp[readonly]'))[0];
    expect(izg).toBeTruthy();
    expect(izg.getAttribute('style')).toBe('--fp-k:2;');
    expect(izg.querySelectorAll('.ve-fp-f').length).toBe(4);
  });

  // "KAYIŞ YOLUNDAKİ YERİ" KALKTI (2026-09-28, kullanıcı isteği: *"her
  // bileşende bulunan 'Kayış Yolundaki Yeri' kısmını da kaldıralım"*). KURAL,
  // liste değil: bütün örneklerin bütün kasnak pencerelerinde ve araç
  // pencerelerinde küçük resim yok; yalnız ona hizmet eden yerleşim
  // seçenekleri (`nameSmart` · `highlightId`) de kaynaktan gitti (kural 26).
  test('hiçbir pencerede küçük resim yok — bütün örnekler × bütün kasnaklar', () => {
    let pencere = 0;
    Object.keys(M.VE_FEAD_EXAMPLES).forEach((anahtar) => {
      let dugumler;
      try { dugumler = ornekKur(anahtar); } catch (e) { return; }
      dugumler.forEach((n) => {
        const d = componentDefs[n.type] || {};
        const html = d.isFeadTensioner ? getFeadTensionerPropertiesHTML(n)
          : d.isFeadPulley ? getFeadPulleyPropertiesHTML(n)
          : d.isFeadSolver ? getFeadSolverPropertiesHTML(n)
          : d.isFeadBelt ? getFeadBeltPropertiesHTML(n) : null;
        if (html === null) return;
        pencere++;
        const kap = ciz(html);
        expect(kap.querySelector('.ve-fp-thumb')).toBeNull();
        expect(kap.querySelector('[data-ve="pulley-hl"]')).toBeNull();
        expect(kap.textContent).not.toMatch(/Kayış Yolundaki yeri/i);
      });
    });
    expect(pencere).toBeGreaterThan(60);           // süpürme gerçekten ölçüyor
    expect(SRC).not.toMatch(/_feadSideThumb|opts\.nameSmart|opts\.highlightId/);
    expect(fs.readFileSync(path.join(__dirname, '../../css/styles.css'), 'utf8'))
      .not.toMatch(/\.ve-fp-thumb/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// GENİŞ TABLO BİRİMDE (2026-09-23) — kullanıcı: "geniş tablolar bileşen
// pencerelerine sığmıyor. Bu pencereleri açılır ufak pencereler şeklinde
// yapmamız gerekiyor." Katlama kararı ölçümden (js/tablo-pencere.js); burada
// kapılı olan, FEAD'in veri tablolarının o mekanizmaya BAĞLI olması.
// ═══════════════════════════════════════════════════════════════════════════
describe('FEAD veri tabloları açılır pencere BİRİMİNDE', () => {
  // Çevrim KÜTÜPHANESİ de yüklenir: yüklenmezse panel çevrim seçicisini hiç
  // basmıyor (doğru davranış) — ama o dünyada ölçülen şey seçicinin YOKLUĞU
  // olurdu, birimin dışında durup durmadığı değil.
  const DU = require('../../js/fead-duty.js');
  Object.keys(DU).forEach((k) => { if (global[k] === undefined) global[k] = DU[k]; });
  const ornek = () => {
    const pack = veFeadExampleNodes('AG00976_GATES_2025');
    global.nodes = pack.nodes.map((n) => ({
      id: n.id, type: n.type, def: componentDefs[n.type],
      customName: n.customName, data: JSON.parse(JSON.stringify(n.data)) }));
    return global.nodes;
  };

  test('her FEAD veri tablosu (.ve-fp-duty) bir birimin İÇİNDE — kural, liste değil', () => {
    const d = ornek();
    const paneller = [
      getFeadSolverPropertiesHTML(d.filter((n) => n.type === 'fead-solver')[0]),
      getFeadPulleyPropertiesHTML(d.filter((n) => n.data && n.data.driver)[0]),
      getFeadPulleyPropertiesHTML(d.filter((n) => n.type === 'fead-ac')[0]),
    ];
    let tablo = 0;
    paneller.forEach((html) => {
      ciz(html).querySelectorAll('.ve-fp-duty').forEach((t) => {
        tablo++;
        expect(t.closest('[data-ve-tablo]')).toBeTruthy();
      });
    });
    // yöntemler + gergi konumu (çözücü) + çevrim (sürücü) + güç eğrisi. Konum
    // tablosu birimsiz çıplak bir <table>dı: bu tarama onu görmüyordu ve 380 px
    // sütunda 6 px yatay kayıyordu (yerlesim.spec.js gördü).
    expect(tablo).toBe(4);
  });

  test('çevrim birimi: satır EKLEYEN düğme ve %zaman uyarısı birimin içinde, özet sayıları doğru', () => {
    const d = ornek();
    const coz = d.filter((n) => n.type === 'fead-solver')[0];
    // %zaman toplamı 100'den saptırılır: uyarı pencerede de görünmeli.
    coz.data.duty[0].dcPct = Number(coz.data.duty[0].dcPct) + 7;
    // Çevrim SÜRÜCÜNÜN penceresinde; birimin kimliği DEPONUNKİ (veri orada).
    const kap = ciz(getFeadPulleyPropertiesHTML(d.filter((n) => n.data && n.data.driver)[0]));
    const birim = kap.querySelector('[data-ve-tablo^="fead-duty:"]');
    expect(birim).toBeTruthy();
    expect(birim.getAttribute('data-ve-tablo')).toBe('fead-duty:' + coz.id);
    expect(birim.querySelector('button[onclick^="veFeadDutyAdd("]')).toBeTruthy();
    expect(birim.textContent).toMatch(/%zaman toplamı/);
    // Özet modelden: satır sayısı ve devir aralığı.
    const ozet = birim.getAttribute('data-ve-tablo-ozet');
    const devir = coz.data.duty.map((r) => Number(r.rpm));
    expect(ozet).toContain(coz.data.duty.length + ' devir noktası');
    expect(ozet).toContain(veSayi(Math.min(...devir)) + '–' + veSayi(Math.max(...devir)) + ' d/dk');
    // Çevrim seçici birimin DIŞINDA: sütuna sığıyor, katlanmamalı.
    const sec = [...kap.querySelectorAll('select')].filter((s) => /veFeadDutyLib/.test(s.getAttribute('onchange') || ''))[0];
    expect(sec).toBeTruthy();
    expect(birim.contains(sec)).toBe(false);
    // ...ve pencerenin alan dilini konuşuyor (kendi satır içi etiketi değil).
    expect(sec.closest('.ve-fp-f')).toBeTruthy();
  });

  test('tablo düğmeleri sınıftan — satır içi stil DURUM ifade edemez', () => {
    const d = ornek();
    let dugme = 0;
    [getFeadPulleyPropertiesHTML(d.filter((n) => n.data && n.data.driver)[0]),
     getFeadPulleyPropertiesHTML(d.filter((n) => n.type === 'fead-ac')[0])].forEach((html) => {
      ciz(html).querySelectorAll('[data-ve-tablo] button').forEach((b) => {
        dugme++;
        expect(b.getAttribute('style') || '').toBe('');
      });
    });
    // BOŞA ÇALIŞMIYOR: ekle + katalogdan doldur + satır silenler.
    expect(dugme).toBeGreaterThanOrEqual(4);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// BÜYÜK HARF — BİRİM VE SİMGE KENDİ YAZIMINDA (Tur 5, 2026-10-02)
//
// `.ve-fp-l` etiketi büyük harf yazıyor ve İÇİNDEKİ HER HARFİ çeviriyordu:
// "[Nm]" → "[NM]" (nanometre gibi), "[d/dk]" → "[D/DK]", "[kg·m²]" →
// "[KG·M²]", "Oluklu μ" → "OLUKLU Μ" (Yunan büyük mü — Latin M gibi okunur).
// Ölçüldü (gerçek tarayıcı, örnek yüklü): 18 etiket birimini, sürtünme
// kartının iki etiketi simgesini bozuyordu. Birim etiketin düz metnindeydi —
// CSS onu ayıramazdı. Kural ÜRETİCİDE (`_feadEtiket`) ve CSS'te birlikte.
// Gerçek tarayıcıdaki ölçü `tests/e2e/buyuk-harf.spec.js`.
// ═══════════════════════════════════════════════════════════════════════════
describe('BÜYÜK HARF — birim ve simge kendi yazımında', () => {
  const ornekKur = (anahtar) => {
    const pack = veFeadExampleNodes(anahtar);
    global.nodes = pack.nodes.map((n) => ({
      id: n.id, type: n.type, def: componentDefs[n.type],
      customName: n.customName, data: JSON.parse(JSON.stringify(n.data)) }));
    global.connections = [];
    return global.nodes;
  };
  // Etiketin KENDİ metni: birim (`u`) ve simge (`.ve-fp-sym`) dışarıda.
  const ozMetin = (l) => {
    const k = l.cloneNode(true);
    k.querySelectorAll('u, .ve-fp-sym').forEach((e) => e.remove());
    return k.textContent;
  };

  test('üretici: sondaki birim <u>, Yunan harfi .ve-fp-sym — gerisi aynen', () => {
    expect(_feadEtiket('Optimum [d/dk]')).toBe('Optimum <u>[d/dk]</u>');
    expect(_feadEtiket('Ön yük — Pre-Load [Nm]')).toBe('Ön yük — Pre-Load <u>[Nm]</u>');
    expect(_feadEtiket('Oluklu μ')).toBe('Oluklu <i class="ve-fp-sym">μ</i>');
    expect(_feadEtiket('Kol ataleti')).toBe('Kol ataleti');
    // Biçim etiketinin içine girmez, köşeli parantez ORTADA ise birim sayılmaz.
    expect(_feadEtiket('θ<sub>kol</sub> açı [°]'))
      .toBe('<i class="ve-fp-sym">θ</i><sub>kol</sub> açı <u>[°]</u>');
    expect(_feadEtiket('[a] ile b')).toBe('[a] ile b');
  });

  test('bütün örnekler × bütün FEAD pencereleri: etiketin kendi metninde birim ve Yunan harfi YOK', () => {
    let etiket = 0, birim = 0;
    const kacak = [];
    Object.keys(M.VE_FEAD_EXAMPLES).forEach((anahtar) => {
      let dugumler;
      try { dugumler = ornekKur(anahtar); } catch (e) { return; }
      dugumler.forEach((n) => {
        const d = componentDefs[n.type] || {};
        const html = d.isFeadTensioner ? getFeadTensionerPropertiesHTML(n)
          : d.isFeadPulley ? getFeadPulleyPropertiesHTML(n)
          : d.isFeadSolver ? getFeadSolverPropertiesHTML(n)
          : d.isFeadBelt ? getFeadBeltPropertiesHTML(n) : null;
        if (html === null) return;
        const kap = ciz(html);
        kap.querySelectorAll('.ve-fp-l').forEach((l) => {
          etiket++;
          birim += l.querySelectorAll('u').length;
          const t = ozMetin(l);
          if (/\[|[µͰ-Ͽ]/.test(t)) kacak.push(n.type + ': ' + t.trim());
        });
      });
    });
    expect([...new Set(kacak)]).toEqual([]);
    expect(etiket).toBeGreaterThan(500);       // süpürme gerçekten ölçüyor
    expect(birim).toBeGreaterThan(100);
  });

  test('sürtünme kartının μ etiketleri simgeyi ayırıyor (sihirbaz da bu kartı basar)', () => {
    const kap = ciz(veFeadSurtunmeHTML({}, () => 'void 0'));
    const sym = [...kap.querySelectorAll('.ve-fp-l .ve-fp-sym')].map((e) => e.textContent);
    expect(sym).toEqual(['μ', 'μ']);
    kap.querySelectorAll('.ve-fp-l').forEach((l) => { expect(ozMetin(l)).not.toMatch(/[\u0370-\u03FF]/); });
  });

  test('CSS: birim ve simge büyük harfe DÖNMEZ', () => {
    const css = fs.readFileSync(path.join(__dirname, '../../css/styles.css'), 'utf8');
    const kural = (sec) => { const i = css.indexOf(sec + '{'); expect(i).toBeGreaterThan(0); return css.slice(i, css.indexOf('}', i)); };
    expect(kural('.ve-fp-l u')).toMatch(/text-transform:\s*none/);
    expect(kural('.ve-fp-l .ve-fp-sym')).toMatch(/text-transform:\s*none/);
  });
});
