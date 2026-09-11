/**
 * fead-katman.test.js — KART NE ÇİZECEĞİNE KENDİ KARAR VERİR
 *
 * Kullanıcı isteği (2026-09-11): *"Kanvaslar üzerinde görülen şeyler şu anda
 * sabit duruyor… Böylelikle kullanıcı istediği kanvasları oluşturur."*
 *
 * Çizicinin katmanları zaten vardı; eksik olan seçimin SAHİBİYDİ. Bayraklar
 * kartı kuran yerde sabit yazılıydı (`shortNames: true`, `wrapLabels:
 * !calisma`, gül/kol/ok hep açık), yani ikinci bir kart açmak aynı resmi
 * ikinci kez çizmekti.
 *
 * BU DOSYANIN TUTTUĞU SESSİZ HATA SINIFI: bir katman panelde görünüp çizimde
 * hiçbir şey yapmaz. Kutucuk tıklanır, sayaç değişir, resim aynı kalır ve
 * hiçbir yerde uyarı çıkmaz.
 */
const fead = require('../../js/cp-fead.js');
const M = require('../../js/fead-model.js');
const F = require('../../js/fead-core.js');
const fs = require('fs');
const path = require('path');

const stubs = stubGlobals();
document.body.innerHTML = '<div id="ve-canvas"></div>';
global.nodes = [];
global.connections = [];
eval(loadSource('components.js'));
global.veIsCanvasHidden = veIsCanvasHidden;
global.componentDefs = componentDefs;
eval(loadSource('fead-belts.js'));
global.FEADCore = F;
Object.keys(M).forEach((k) => { global[k] = M[k]; });

const SRC = fs.readFileSync(path.join(__dirname, '../../js/cp-fead.js'), 'utf8');

beforeEach(() => {
  resetStubs(stubs);
  global.nodes = []; global.connections = [];
  document.body.innerHTML = '<div id="ve-canvas"></div>';
  fead.veFeadKatmanToggle(null);            // panel kapalı başlasın
});

function kurOrnek(key) {
  const pack = M.veFeadExampleNodes(key || 'AG00976_GATES_2025');
  const ns = pack.nodes.map((n) => {
    const d = componentDefs[n.type] || {};
    return { id: n.id, type: n.type, customName: n.customName || null, def: d,
             x: 0, y: 0, width: d.defaultWidth || 65, height: d.defaultHeight || 60,
             data: JSON.parse(JSON.stringify(n.data || {})) };
  });
  global.nodes = ns; global.connections = [];
  return { ns, build: M.veFeadBuildSystem(ns) };
}

// Karta karşılık gelen düğümü kur ve DOM'a as (kart gerçekten kurulsun).
function kart(type, id) {
  const d = componentDefs[type];
  const n = { id: id, type: type, def: d, x: 0, y: 0,
              width: d.defaultWidth, height: d.defaultHeight, data: {} };
  global.nodes.push(n);
  const el = document.createElement('div');
  el.id = id;
  el.innerHTML = '<div class="ve-node-box"></div>';
  document.body.appendChild(el);
  return n;
}

// ═══════════════════════════════════════════════════════════════════════════
describe('katman listesi TEK KAYNAK', () => {
  // Kutucuklar, varsayılanlar ve çiziciye giden seçenek adı aynı satırdan
  // gelmek zorunda. İkinci bir liste tutmak, yeni bir katmanın panelde
  // görünüp çizimde hiçbir şey yapmaması demekti — ve bu sessiz olurdu.
  test('her katmanın çiziciye giden bir seçeneği VAR ve çizici onu OKUYOR', () => {
    const L = fead.VE_FEAD_KATMANLAR;
    expect(L.length).toBeGreaterThanOrEqual(8);
    const ciz = SRC.slice(SRC.indexOf('function veFeadLayoutSVG'),
                          SRC.indexOf('function veFeadPosModeNode'));
    expect(ciz.length).toBeGreaterThan(2000);        // doğru dilimi aldık
    L.forEach((K) => {
      expect(typeof K.k).toBe('string');
      expect(typeof K.svg).toBe('string');
      expect(typeof K.t).toBe('string');
      // ÇİZİCİ O SEÇENEĞİ GERÇEKTEN OKUYOR. Yalnız listeye satır eklemek
      // paneli büyütür, resmi değiştirmez.
      expect(ciz).toContain('opts.' + K.svg);
    });
    // Anahtarlar tekil.
    expect(new Set(L.map((K) => K.k)).size).toBe(L.length);
    expect(new Set(L.map((K) => K.svg)).size).toBe(L.length);
  });

  test('KART KURUCUSU her katmanı çiziciye GEÇİYOR', () => {
    // Öteki uç: liste ile çizici anlaşıyor ama kart kurucusu bayrağı hiç
    // yollamıyor olabilir — o zaman kutucuk yine sessizce ölü kalır.
    const i = SRC.indexOf('var kat = veFeadKatmanlar(node);');
    expect(i).toBeGreaterThan(0);
    const govde = SRC.slice(i, SRC.indexOf('veFeadKatmanPanelHTML(node, kat', i));
    fead.VE_FEAD_KATMANLAR.forEach((K) => {
      expect(govde).toContain(K.svg + ': kat.' + K.k);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('varsayılanlar — eski kayıt bugünkü görünümünü KORUR', () => {
  test('iki kartın varsayılanı FARKLI ve bölünmeden önceki hâlin aynısı', () => {
    const sema = fead.veFeadKatmanVarsayilan(false);
    const cal  = fead.veFeadKatmanVarsayilan(true);
    // Kart bölünürken konan kural: sarım açıları GEOMETRİ kartında, açıklık
    // gerilmeleri ÇALIŞMA kartında (ikisi aynı çizimde kalabalık yapıyordu).
    expect(sema.sarim).toBe(true);
    expect(sema.spanEt).toBe(false);
    expect(cal.sarim).toBe(false);
    expect(cal.spanEt).toBe(true);
    // Geri kalanı iki kartta da açık: kart bölünmeden önce hepsi sabit açıktı.
    ['ad', 'adKisa', 'ok', 'gul', 'kol'].forEach((k) => {
      expect(sema[k]).toBe(true);
      expect(cal[k]).toBe(true);
    });
  });

  test('EKSİK ANAHTAR VARSAYILANA düşer, kapalıya DEĞİL', () => {
    // Eski bir kayıtta `kat` alanı hiç yok. "Yazılmamış = kapalı" deseydik
    // kaydedilmiş her proje çıplak bir şemayla açılırdı.
    const n = { type: 'fead-layout', def: componentDefs['fead-layout'], data: {} };
    expect(fead.veFeadKatmanlar(n)).toEqual(fead.veFeadKatmanVarsayilan(false));
    // Kısmi kayıt: yalnız yazılan anahtar değişir.
    n.data.kat = { sarim: false };
    const k = fead.veFeadKatmanlar(n);
    expect(k.sarim).toBe(false);
    expect(k.ad).toBe(true);
    expect(k.gul).toBe(true);
  });

  test('BAĞLI KATMAN: adlar kapalıyken "adı kısalt" da kapalı', () => {
    const n = { type: 'fead-layout', def: componentDefs['fead-layout'],
                data: { kat: { ad: false, adKisa: true } } };
    // Kullanıcı ikisini de açık bırakmış olabilir; ad çizilmezken kısaltmanın
    // karşılığı yok ve çözülmüş küme bunu söylemeli.
    expect(fead.veFeadKatmanlar(n).adKisa).toBe(false);
    n.data.kat.ad = true;
    expect(fead.veFeadKatmanlar(n).adKisa).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('seçim KART BAŞINA — kişiselleştirmenin kendisi', () => {
  test('bir kartın katmanı ÖTEKİNİ etkilemiyor', () => {
    kurOrnek();
    const a = kart('fead-layout', 'kartA');
    const b = kart('fead-layout', 'kartB');
    expect(fead.veFeadKatmanSet('kartA', 'sarim', false)).toBe(true);
    expect(fead.veFeadKatmanlar(a).sarim).toBe(false);
    expect(fead.veFeadKatmanlar(b).sarim).toBe(true);     // öteki dokunulmadı
    expect(b.data.kat).toBeUndefined();                   // alanı bile açılmadı
  });

  test('yazma GERİ ALINABİLİR ve mutasyondan ÖNCE kaydediyor', () => {
    kurOrnek();
    const a = kart('fead-layout', 'kartA');
    stubs.saveState.mockClear();
    let anlik = null;
    stubs.saveState.mockImplementation(() => {
      anlik = a.data.kat ? JSON.parse(JSON.stringify(a.data.kat)) : null;
    });
    fead.veFeadKatmanSet('kartA', 'gul', false);
    expect(stubs.saveState).toHaveBeenCalledTimes(1);
    // ÖNCE kaydedilmezse geri-al DEĞİŞMİŞ hâli saklar ve Ctrl+Z hiçbir şey
    // yapmaz — sessiz, çünkü yığında bir adım gerçekten duruyor.
    expect(anlik).toBeNull();
    expect(a.data.kat.gul).toBe(false);
  });

  test('bilinmeyen anahtar yazılmıyor', () => {
    kurOrnek();
    const a = kart('fead-layout', 'kartA');
    expect(fead.veFeadKatmanSet('kartA', 'uydurma', true)).toBe(false);
    expect(fead.veFeadKatmanSet('yok-boyle-dugum', 'gul', true)).toBe(false);
    expect(a.data.kat).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('üç işlem', () => {
  test('Tümü / Hiçbiri hepsini yazıyor', () => {
    kurOrnek();
    const a = kart('fead-run', 'kartA');
    expect(fead.veFeadKatmanIslem('kartA', 'tumu')).toBe(true);
    const hepsi = fead.veFeadKatmanlar(a);
    fead.VE_FEAD_KATMANLAR.forEach((K) => expect(hepsi[K.k]).toBe(true));
    expect(fead.veFeadKatmanIslem('kartA', 'hicbiri')).toBe(true);
    const hic = fead.veFeadKatmanlar(a);
    fead.VE_FEAD_KATMANLAR.forEach((K) => expect(hic[K.k]).toBe(false));
  });

  test('VARSAYILAN alanı SİLER — bugünün varsayılanını dondurmaz', () => {
    kurOrnek();
    const a = kart('fead-layout', 'kartA');
    fead.veFeadKatmanIslem('kartA', 'hicbiri');
    expect(a.data.kat).toBeTruthy();
    fead.veFeadKatmanIslem('kartA', 'varsayilan');
    // Silinmiş bir alan varsayılanı İZLEMEYE DEVAM eder; sıfırlarla
    // doldurulmuş bir alan bugünün varsayılanını dondurup yarınki
    // değişikliği sessizce kaçırırdı.
    expect(a.data.kat).toBeUndefined();
    expect(fead.veFeadKatmanlar(a)).toEqual(fead.veFeadKatmanVarsayilan(false));
    expect(fead.veFeadKatmanIslem('kartA', 'uydurma')).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('panel', () => {
  test('YALNIZ AÇIK KART için basılıyor ve açıklık MODELDE değil', () => {
    kurOrnek();
    const a = kart('fead-layout', 'kartA');
    const b = kart('fead-layout', 'kartB');
    const kat = fead.veFeadKatmanlar(a);
    expect(fead.veFeadKatmanPanelHTML(a, kat, false, false)).toBe('');
    fead.veFeadKatmanToggle('kartA');
    expect(fead.veFeadKatmanPanelHTML(a, kat, false, false)).toContain('ve-fead-kat-liste');
    expect(fead.veFeadKatmanPanelHTML(b, kat, false, false)).toBe('');
    // Panelin AÇIK olması bir görünüm durumu: kaydedilmemeli, geri-al
    // yığınına yazılmamalı, ikinci bir oturuma taşınmamalı.
    expect(a.data.katAcik).toBeUndefined();
    expect(JSON.stringify(a.data)).not.toMatch(/acik/i);
    // İkinci karta geçince birincisi kapanır (iki panel açıkken hangi kartın
    // ayarına baktığın okunmuyor).
    fead.veFeadKatmanToggle('kartB');
    expect(fead.veFeadKatmanPanelHTML(a, kat, false, false)).toBe('');
    expect(fead.veFeadKatmanPanelHTML(b, kat, false, false)).not.toBe('');
    // Aynı karta ikinci tıklama kapatır.
    expect(fead.veFeadKatmanToggle('kartB')).toBeNull();
  });

  test('panelde HER katman için bir kutucuk ve ÜÇ işlem var', () => {
    kurOrnek();
    const a = kart('fead-layout', 'kartA');
    fead.veFeadKatmanToggle('kartA');
    const h = fead.veFeadKatmanPanelHTML(a, fead.veFeadKatmanlar(a), false, false);
    const kap = document.createElement('div');
    kap.innerHTML = h;
    expect(kap.querySelectorAll('input[type="checkbox"]'))
      .toHaveLength(fead.VE_FEAD_KATMANLAR.length);
    expect(kap.querySelectorAll('.ve-fead-kat-islem button')).toHaveLength(3);
    fead.VE_FEAD_KATMANLAR.forEach((K) => expect(h).toContain(K.t));
    // Kişiselleştirmenin ne olduğu panelde YAZILI — yoksa kullanıcı ayarın
    // bütün kartları mı yoksa bu kartı mı bağladığını deneyerek öğrenirdi.
    expect(h).toMatch(/yalnız bu karta/i);
  });

  test('AÇIK ama o an ÇİZİLMEYEN katman sebebini söylüyor', () => {
    kurOrnek();
    const a = kart('fead-run', 'kartA');
    fead.veFeadKatmanToggle('kartA');
    const kat = fead.veFeadKatmanlar(a);
    expect(kat.spanEt).toBe(true);
    // Gerilme haritası yoksa (devir seçilmemiş) kutucuk açık ama çizimde
    // karşılığı yok. Sessiz bırakmak kullanıcıya kendi seçimini sorgulatırdı.
    expect(fead.veFeadKatmanPanelHTML(a, kat, true, false)).toContain('devir seçili değil');
    expect(fead.veFeadKatmanPanelHTML(a, kat, true, true)).not.toContain('devir seçili değil');
  });

  test('şerit düğmesi AÇIK KATMAN SAYISINI yazıyor', () => {
    kurOrnek();
    const a = kart('fead-layout', 'kartA');
    const N = fead.VE_FEAD_KATMANLAR.length;
    expect(fead.veFeadKatmanDugmeHTML(a, fead.veFeadKatmanlar(a)))
      .toContain('>' + (N - 1) + '/' + N + '<');            // sema: spanEt kapalı
    fead.veFeadKatmanIslem('kartA', 'hicbiri');
    expect(fead.veFeadKatmanDugmeHTML(a, fead.veFeadKatmanlar(a))).toContain('>0/' + N + '<');
    // Simge ÇİZİM, yazı karakteri değil (eksik bir glif afordansı yok eder).
    expect(fead.veFeadKatmanDugmeHTML(a, fead.veFeadKatmanlar(a))).toContain('<svg class="ac"');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('çizici katmanı GERÇEKTEN uyguluyor', () => {
  test('adlar kapalıyken metin YOK ve DAR KARTTA yer de AYRILMIYOR', () => {
    const { build } = kurOrnek();
    const say = (h) => (h.match(/data-ve="name"/g) || []).length;
    expect(say(fead.veFeadLayoutSVG(build, 420, 300, { nameLabels: true }))).toBe(6);
    expect(say(fead.veFeadLayoutSVG(build, 420, 300, { nameLabels: false }))).toBe(0);

    // BOŞ METİN BASMAK YETMEZ: ad kapalıyken kenar payı da ad için yer
    // ayırmamalı, yoksa şema aynı ölçekte kalır ve "adları kapattım ama
    // resim büyümedi" olur.
    //
    // ÖLÇÜ DAR KARTTA: geniş kartta adlar ölçeği zaten BAĞLAMIYOR (420×300'de
    // fark 0,00 px — sınırlayan şey kasnakların kendi yayılımı). Kapıyı geniş
    // karta bağlamak, kuralı hiç ölçmeden yeşil kalmak olurdu. 240×180'de
    // adlar gerçekten bağlıyor ve fark ölçülebilir.
    const r = /<circle[^>]*r="([\d.]+)"/g;
    const enBuyuk = (h) => { const o = []; let m; while((m = r.exec(h))) o.push(+m[1]);
                             return Math.max.apply(null, o); };
    const rA = enBuyuk(fead.veFeadLayoutSVG(build, 240, 180, { nameLabels: true }));
    const rK = enBuyuk(fead.veFeadLayoutSVG(build, 240, 180, { nameLabels: false }));
    expect(rA).toBeCloseTo(16.99, 1);
    expect(rK).toBeCloseTo(24.98, 1);          // ölçüldü: %47 daha büyük şema
    expect(rK).toBeGreaterThan(rA * 1.3);
  });

  test('her katman bayrağı çizimi DEĞİŞTİRİYOR', () => {
    const { build } = kurOrnek();
    // Kapı bir liste değil bir KURAL: listedeki her katman için "açık" ve
    // "kapalı" çizimler FARKLI olmak zorunda. Bir bayrak çiziciye ulaşmıyorsa
    // iki çizim birebir aynı çıkar ve panelde ölü bir kutucuk kalır.
    const tam = {};
    fead.VE_FEAD_KATMANLAR.forEach((K) => { tam[K.svg] = true; });
    // Gerilme etiketleri yalnız harita varken çiziliyor — bayrağı ölçmek için
    // haritayı ver.
    tam.tension = M.veFeadSpanTensionMap(build, 0, 1500);
    tam.posMode = 'all';                      // hayalet etiketleri de sahnede
    const temel = fead.veFeadLayoutSVG(build, 420, 300, tam);
    expect(temel).toBeTruthy();
    fead.VE_FEAD_KATMANLAR.forEach((K) => {
      const o = Object.assign({}, tam);
      o[K.svg] = false;
      const v = fead.veFeadLayoutSVG(build, 420, 300, o);
      expect(typeof v).toBe('string');
      expect(v === temel ? K.k + ' ÇİZİMİ DEĞİŞTİRMEDİ' : 'ok').toBe('ok');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('görünüm CSS\'te, satır içinde değil', () => {
  const CSS = fs.readFileSync(path.join(__dirname, '../../css/styles.css'), 'utf8');

  test('panel HTML\'i satır içi RENK / ÇERÇEVE yazmıyor', () => {
    kurOrnek();
    const a = kart('fead-layout', 'kartA');
    fead.veFeadKatmanToggle('kartA');
    const h = fead.veFeadKatmanPanelHTML(a, fead.veFeadKatmanlar(a), false, false)
            + fead.veFeadKatmanDugmeHTML(a, fead.veFeadKatmanlar(a));
    expect(h).not.toMatch(/style="[^"]*(color|background|border|font-size)/);
    expect(h).not.toMatch(/#[0-9a-fA-F]{3,6}\b/);
  });

  test('DURUM KURALLARI CSS\'te: fare · işaretli · odak · pasif', () => {
    // Dördü de satır içi CSS'te YAZILAMAZ ve dördü birden olmadan bir
    // kutucuk listesi hangi satırın açık olduğunu söyleyemez.
    expect(CSS).toMatch(/\.ve-fead-kat-sat:hover\{/);
    expect(CSS).toMatch(/\.ve-fead-kat-sat:has\(input:checked\)/);
    expect(CSS).toMatch(/\.ve-fead-kat-sat:focus-within\{/);
    expect(CSS).toMatch(/\.ve-fead-kat-sat\.pasif\{/);
    expect(CSS).toMatch(/\.ve-fead-kat-dugme\.is-acik\{/);
    // PANEL ÇİZİMİN ÜSTÜNE BİNER, şeridi itmez: akışa girseydi panel
    // açılınca şema yeniden ölçeklenir, kullanıcı "neyi değiştirdim"
    // sorusunu bir de kayan resimle çözerdi.
    const blok = CSS.slice(CSS.indexOf('.ve-fead-kat{'), CSS.indexOf('.ve-fead-kat-bas{'));
    expect(blok).toMatch(/position:absolute/);
    expect(blok).toMatch(/z-index:/);
    // Vurgular jetondan, sabit renkten değil.
    const tum = CSS.slice(CSS.indexOf('.ve-fead-kat-dugme{'), CSS.indexOf('.ve-fead-table-card{'));
    expect(tum).toMatch(/var\(--accent-tint-/);
    expect(tum).toMatch(/var\(--focus-ring\)/);
    expect(tum).not.toMatch(/#[0-9a-fA-F]{6}/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('çok kart', () => {
  test('iki kart tipi de SINIRSIZ — ikinci kart artık kopyanın kopyası değil', () => {
    // `fead-run` bir zamanlar `maxInstances: 1`di: tek kart varken makuldü,
    // ama katmanlar kart başına seçilebilir olunca ikinci kart rölantiyi ve
    // 2000 dev/dk'yı yan yana görmenin tek yolu.
    expect(componentDefs['fead-run'].maxInstances).toBeUndefined();
    expect(componentDefs['fead-layout'].maxInstances).toBeUndefined();
  });

  test('GEOMETRİ kartı KENDİ kol konumunu çizer, ÇALIŞMA kartı devralır', () => {
    // Eskiden ikisi de `veFeadPosModeShared`ten okuyordu. Tek kart varken
    // doğruydu; ikinci bir Kayış Yolu kartı kendi seçicisini yazıyor ama
    // BİRİNCİ kartın konumunu çiziyordu — seçicide bir konum, resimde başka.
    const i = SRC.indexOf('var kat = veFeadKatmanlar(node);');
    const satir = SRC.slice(i, SRC.indexOf('\n', SRC.indexOf('var mode =', i)));
    expect(satir).toContain('calisma ? veFeadPosModeShared(node) : veFeadPosMode(node)');
  });
});
