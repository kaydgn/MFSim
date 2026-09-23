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
 * Seçilen pencere tasarımı (kullanıcı, 2026-09-21): **B + C** — sekmeler
 * panelin UZUNLUĞUNU çözüyor, sabit sağ sütun sekmenin ALDIĞI BAĞLAMI geri
 * veriyor. CSS tarafının kapısı `source-hygiene.test.js` → *"PANEL DİLİ"*.
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
describe('SEKMELER — panelin uzunluğunu çözüyor', () => {
  test('kasnakta dört sekme, AVARADA iki', () => {
    const k = ciz(getFeadPulleyPropertiesHTML(kasnak()));
    expect([...k.querySelectorAll('.ve-fp-tab')].map((t) => t.getAttribute('data-k')))
      .toEqual(['geo', 'rol', 'dev', 'egr']);
    // Avara kayıştan güç ÇEKMEZ: devir sınırı da güç eğrisi de ona sorulmuyor
    // (kural 25 — sorulan her alanın bir tüketicisi olmak zorunda).
    const a = ciz(getFeadPulleyPropertiesHTML(kasnak({ id: 'a1', type: 'fead-idler' })));
    expect([...a.querySelectorAll('.ve-fp-tab')].map((t) => t.getAttribute('data-k')))
      .toEqual(['geo', 'rol']);
  });

  test('yalnız AÇIK sekmenin gövdesi görünür', () => {
    const kap = ciz(getFeadPulleyPropertiesHTML(kasnak()));
    const gov = kap.querySelector('#ve-fp-panes-k1');
    const acik = [...gov.children].filter((c) => !c.hasAttribute('hidden'));
    expect(acik.length).toBe(1);
    expect(acik[0].getAttribute('data-k')).toBe('geo');
    expect(kap.querySelector('.ve-fp-tab[aria-selected="true"]').getAttribute('data-k')).toBe('geo');
  });

  test('SEKME DURUMU MODELDE DEĞİL — Ctrl+Z sekme gezdirmesin', () => {
    // Kural 15'in (`VE_FEAD_KAT_ACIK`) birebir aynı gerekçesi.
    const n = kasnak();
    // ÇİZİMİN KENDİSİ de yazmamalı: ölçüldü, yalnız `veFeadPanelTab`i ölçen
    // bir kapı, sekmeyi panel kurulurken `node.data`ya yazan bir kodu
    // GÖRMÜYORDU (ve `SRC` düzenli ifadesi yazımı değiştirince atlanıyor —
    // davranış ölçülmeden metin aramak kapı değildir).
    const cizimOnce = JSON.stringify(n.data);
    document.body.innerHTML = getFeadPulleyPropertiesHTML(n);
    expect(JSON.stringify(n.data)).toBe(cizimOnce);
    const once = JSON.stringify(n.data);
    expect(fead.veFeadPanelTab('k1', 'rol')).toBe(true);
    expect(JSON.stringify(n.data)).toBe(once);       // düğüm verisi DEĞİŞMEDİ
    expect(stubs.saveState).not.toHaveBeenCalled();  // yığına adım YAZILMADI
    expect(SRC).not.toMatch(/node\.data\.panelTab|data\.sekme/);
  });

  test('ama durum bir yerde DURUYOR — panel yeniden kurulunca aynı sekme', () => {
    // Hiçbir yerde durmasaydı panel her seçim değişiminde ilk sekmeye dönerdi.
    document.body.innerHTML = getFeadPulleyPropertiesHTML(kasnak());
    fead.veFeadPanelTab('k1', 'dev');
    const kap = ciz(getFeadPulleyPropertiesHTML(kasnak()));
    expect(kap.querySelector('.ve-fp-tab[aria-selected="true"]').getAttribute('data-k')).toBe('dev');
  });

  test('tanınmayan/geçersiz sekme İLK sekmeye düşer', () => {
    // Avarada 'egr' yok: kayıtlı sekme o tipte geçersizse panel boş açılmamalı.
    document.body.innerHTML = getFeadPulleyPropertiesHTML(kasnak({ id: 'a2', type: 'fead-crank' }));
    fead.veFeadPanelTab('a2', 'egr');
    const a = ciz(getFeadPulleyPropertiesHTML(kasnak({ id: 'a2', type: 'fead-idler' })));
    expect(a.querySelector('.ve-fp-tab[aria-selected="true"]').getAttribute('data-k')).toBe('geo');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('SAĞ SÜTUN — sekmeden BAĞIMSIZ (tasarımın iddiası)', () => {
  test('sekme değişince sağ sütun YENİDEN KURULMUYOR — aynı eleman kalıyor', () => {
    // Tasarımın bütün iddiası bu. Panel yeniden kurulsaydı (a) düzenlenen
    // alanın odağı düşerdi, (b) sağ sütundaki şema her tıklamada yanıp sönerdi
    // — üstelik orada bir çözüm koşuyor.
    document.body.innerHTML = getFeadPulleyPropertiesHTML(kasnak());
    const yan = document.querySelector('.ve-fp-side');
    const thumb = document.querySelector('.ve-fp-thumb');
    expect(yan).toBeTruthy();
    fead.veFeadPanelTab('k1', 'rol');
    expect(document.querySelector('.ve-fp-side')).toBe(yan);     // AYNI nesne
    expect(document.querySelector('.ve-fp-thumb')).toBe(thumb);
    // "AYNI NESNE" TEK BAŞINA YETMEZ — ölçüldü: sağ sütunu bir sekme
    // gövdesinin içine koyup `hidden` vermek de aynı nesneyi bırakıyor, ama
    // C'nin panele kattığı şeyi (sekme ne olursa olsun duran bağlam) tamamen
    // yok ediyordu. Bu yüzden İKİ şey ayrıca ölçülür: sütun gövdelerin
    // DIŞINDA ve hiçbir sekmeye bağlı DEĞİL.
    expect(document.querySelector('#ve-fp-panes-k1').contains(yan)).toBe(false);
    expect(yan.hasAttribute('hidden')).toBe(false);
    expect(yan.hasAttribute('data-k')).toBe(false);
    // Ve sekme gerçekten değişti.
    const acik = [...document.querySelector('#ve-fp-panes-k1').children]
      .filter((c) => !c.hasAttribute('hidden'));
    expect(acik.length).toBe(1);
    expect(acik[0].getAttribute('data-k')).toBe('rol');
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

  test('çözüm yokken sağ sütun SESSİZCE BOŞ değil — sebebini yazıyor', () => {
    const kap = ciz(getFeadPulleyPropertiesHTML(kasnak()));
    const bos = kap.querySelector('.ve-fp-thumb-bos');
    expect(bos).toBeTruthy();
    expect(bos.textContent).toMatch(/çözülemedi/i);
    // Türetilenler de '—' gösteriyor, boş kalmıyor.
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

    expect(oku('Efektif \u00e7ap')).toBe(satir.effDiaMm.toFixed(1) + ' mm');
    expect(oku('Sar\u0131m a\u00e7\u0131s\u0131')).toBe(satir.wrapDeg.toFixed(1) + '\u00b0');
    expect(oku('D\u00f6n\u00fc\u015f y\u00f6n\u00fc')).toBe(satir.spin);
    expect(oku('Kay\u0131\u015f s\u0131ras\u0131')).toBe(satir.index + ' / ' + T.rows.length);

    // NEGATİF KAPI: panel dış çapı efektif çap sansaydı yukarıdaki biçim yine
    // tutardı. İkisi bu kasnakta ayrışıyor (57,0 ↔ 59,4 mm), yani ölçüm
    // gerçekten TÜRETİLMİŞ sayıyı görüyor.
    expect(Number(hedef.data.od).toFixed(1) + ' mm').not.toBe(oku('Efektif \u00e7ap'));

    // Çevrim kapanışı da tablodan: işaretli toplamın MUTLAK değeri.
    expect(yan.textContent).toContain('\u03a3 ' + Math.abs(T.signedWrapDeg).toFixed(1) + '\u00b0');
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

  test('DÖRT PANELİN DÖRDÜ DE sekmeli ve sağ sütunlu — kapsamlı (kullanıcı isteği)', () => {
    // Kullanıcı (2026-09-21): *"Diğer bileşenlerin pencereleri için de aynı
    // değişiklikleri kapsamlı olarak yapmamız gerekiyor."* Yalnız ortak ALAN
    // SATIRINI paylaşmak bunu karşılamıyordu: gergi 8 bölüm / 15 alan, çözücü
    // 7 bölüm / 12 alan ile tek sürgüde duruyordu ve kullanıcının şikâyet
    // ettiği uzunluk aynen yerindeydi.
    Object.keys(panel).forEach((ad) => {
      const kap = ciz(panel[ad]());
      const sek = [...kap.querySelectorAll('.ve-fp-tab')];
      expect(sek.length).toBeGreaterThanOrEqual(2);              // sekme VAR
      expect(sek.filter((b) => b.getAttribute('aria-selected') === 'true').length).toBe(1);
      const yan = kap.querySelector('.ve-fp-side');
      expect(yan).toBeTruthy();                                  // sağ sütun VAR
      // Ve sütun sekmenin İÇİNDE değil — yoksa sekme değişince kaybolurdu.
      const gov = kap.querySelector('[id^="ve-fp-panes-"]');
      expect(gov.contains(yan)).toBe(false);
      // Her panelde kapılar aynı tek çağrıdan geliyor.
      expect(kap.querySelectorAll('.ve-fp-gate').length).toBe(4);
      // Açık gövde TEK.
      expect([...gov.children].filter((c) => !c.hasAttribute('hidden')).length).toBe(1);
    });
  });

  test('ÇÖZÜCÜNÜN EYLEMİ sekmeye girmiyor — sağ sütunda duruyor', () => {
    // Pencerenin tek eylemi "Hesapla". Bir sekmenin içine girseydi kullanıcı
    // çevrimi düzenlerken düğmeyi göremez, üç sekme gezip geri dönerdi.
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
    [['gergi', 'Ölçülmüş künye'], ['cozucu', 'BMC motor kataloğu']].forEach(([ad, etiket]) => {
      const kap = ciz(panel[ad]());
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
    // gövdeleri sekmelere BÖLÜNDÜ. Bölerken bir `</div>` fazla kalsaydı
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

  test('küçük resim pencerenin KASNAĞINI vurguluyor — tek kasnak, adı kalın, açı yok', () => {
    const dugumler = ornekKur('AG00976_GATES_2025');
    const hedef = dugumler.filter((x) => x.id === 'ex-ALT')[0];
    const th = ciz(getFeadPulleyPropertiesHTML(hedef)).querySelector('.ve-fp-thumb');
    const vurgu = th.querySelectorAll('[data-ve="pulley-hl"]');
    expect(vurgu.length).toBe(1);
    // Vurgu DOĞRU kasnakta: zeminin merkezi, adı kalın yazılan kasnağın çemberi.
    const kalin = [...th.querySelectorAll('text[data-ve="name"]')]
      .filter((t) => t.getAttribute('font-weight') === '700');
    expect(kalin.length).toBe(1);
    expect(kalin[0].textContent).toBe(veFeadShortName(hedef.customName));
    const hl = vurgu[0];
    const cember = [...th.querySelectorAll('circle[data-ve="pulley"]')]
      .filter((c) => c.getAttribute('cx') === hl.getAttribute('cx')
                  && c.getAttribute('cy') === hl.getAttribute('cy'))[0];
    expect(cember).toBeTruthy();
    expect(cember.getAttribute('stroke-width')).toBe('3');
    // Sarım açıları küçük resimde YOK — pencerenin açısı "Türetilenler"de.
    expect(th.querySelectorAll('text[data-ve="wrap"]').length).toBe(0);
    // Çerçeveyi kap çiziyor: SVG'nin kendi kenarlığı yok (çift çerçeve).
    expect(th.querySelector('svg').getAttribute('style')).not.toMatch(/border/);
    // Kasnak OLMAYAN pencerede (çözücü) küçük resim HİÇ YOK — vurgulanacak
    // bir kasnak yok ve resim o pencerenin sorusuna bir şey katmıyor
    // (kullanıcı, 2026-09-23). Bütün tipler için kural: fead-pencere-ailesi.
    const coz = dugumler.filter((x) => x.type === 'fead-solver')[0];
    expect(ciz(getFeadSolverPropertiesHTML(coz)).querySelector('.ve-fp-thumb')).toBeNull();
  });

  test('küçük resimde adlar birbirine BİNMİYOR — bütün örnekler × bütün kasnaklar', () => {
    // Kutu, yerleştiricinin kendi genişlik kuralıyla (9 px × 0,6 em; kalın
    // ad %10 geniş) yeniden kurulur. Eski küçük resim AG00879'da her
    // pencerede "Sürücü Kasnak (FAN)" ile "Otomatik Gergi (T38665)"u üst
    // üste basıyordu.
    let cizim = 0, ad = 0, cakisma = 0;
    Object.keys(M.VE_FEAD_EXAMPLES).forEach((anahtar) => {
      let dugumler;
      try { dugumler = ornekKur(anahtar); } catch (e) { return; }
      dugumler.filter((n) => componentDefs[n.type] && componentDefs[n.type].isFeadPulley)
        .forEach((n) => {
          const th = ciz(getFeadPulleyPropertiesHTML(n)).querySelector('.ve-fp-thumb svg');
          if (!th) return;
          cizim++;
          const kutu = [...th.querySelectorAll('text[data-ve="name"]')].map((t) => {
            const x = +t.getAttribute('x'), y = +t.getAttribute('y');
            const w = t.textContent.length * 9 * 0.6 * (t.getAttribute('font-weight') === '700' ? 1.1 : 1);
            const an = t.getAttribute('text-anchor');
            const x0 = an === 'start' ? x : an === 'end' ? x - w : x - w / 2;
            return { x0, x1: x0 + w, y0: y - 8, y1: y + 2 };
          });
          ad += kutu.length;
          for (let i = 0; i < kutu.length; i++) for (let j = i + 1; j < kutu.length; j++) {
            const a = kutu[i], b = kutu[j];
            if (a.x1 > b.x0 + 0.5 && b.x1 > a.x0 + 0.5 && a.y1 > b.y0 + 0.5 && b.y1 > a.y0 + 0.5) cakisma++;
          }
        });
    });
    expect(cizim).toBeGreaterThan(40);          // süpürme gerçekten ölçüyor
    expect(ad).toBeGreaterThan(200);
    expect(cakisma).toBe(0);
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
      getFeadPulleyPropertiesHTML(d.filter((n) => n.type === 'fead-ac')[0]),
    ];
    let tablo = 0;
    paneller.forEach((html) => {
      ciz(html).querySelectorAll('.ve-fp-duty').forEach((t) => {
        tablo++;
        expect(t.closest('[data-ve-tablo]')).toBeTruthy();
      });
    });
    expect(tablo).toBe(2);                 // çevrim + güç eğrisi
  });

  test('çevrim birimi: satır EKLEYEN düğme ve %zaman uyarısı birimin içinde, özet sayıları doğru', () => {
    const d = ornek();
    const coz = d.filter((n) => n.type === 'fead-solver')[0];
    // %zaman toplamı 100'den saptırılır: uyarı pencerede de görünmeli.
    coz.data.duty[0].dcPct = Number(coz.data.duty[0].dcPct) + 7;
    const kap = ciz(getFeadSolverPropertiesHTML(coz));
    const birim = kap.querySelector('[data-ve-tablo^="fead-duty:"]');
    expect(birim).toBeTruthy();
    expect(birim.getAttribute('data-ve-tablo')).toBe('fead-duty:' + coz.id);
    expect(birim.querySelector('button[onclick^="veFeadDutyAdd("]')).toBeTruthy();
    expect(birim.textContent).toMatch(/%zaman toplamı/);
    // Özet modelden: satır sayısı ve devir aralığı.
    const ozet = birim.getAttribute('data-ve-tablo-ozet');
    const devir = coz.data.duty.map((r) => Number(r.rpm));
    expect(ozet).toContain(coz.data.duty.length + ' devir noktası');
    expect(ozet).toContain(Math.min(...devir) + '–' + Math.max(...devir) + ' d/dk');
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
    [getFeadSolverPropertiesHTML(d.filter((n) => n.type === 'fead-solver')[0]),
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
