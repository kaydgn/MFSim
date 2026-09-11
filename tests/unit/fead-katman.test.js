/**
 * fead-katman.test.js — KART NE ÇİZECEĞİNE KENDİ KARAR VERİR
 *
 * Kullanıcı isteği (2026-09-11): *"Kanvaslar üzerinde görülen şeyler şu anda
 * sabit duruyor… Böylelikle kullanıcı istediği kanvasları oluşturur."*
 *
 * Çizicinin katmanları zaten vardı; eksik olan seçimin SAHİBİYDİ. Bayraklar
 * kartı kuran yerde sabit yazılıydı (`shortNames: true`, sarım açıları kart
 * TİPİNDEN), yani ikinci bir kart açmak aynı resmi ikinci kez çizmekti.
 *
 * İKİNCİ TUR (2026-09-11): *"iki kanvas var, ikisinin de özellikleri falan
 * farklı… Tek kanvas olacak, açılır açılmaz iki kanvas gelsin fakat tipoloji
 * tek olacak."* İki kart TİPİ teke indi; aralarındaki fark ÖN AYAR oldu
 * (`data.katOn`: geometri / işletme).
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
function kart(type, id, veri) {
  const d = componentDefs[type];
  const n = { id: id, type: type, def: d, x: 0, y: 0,
              width: d.defaultWidth, height: d.defaultHeight,
              data: Object.assign({}, veri || {}) };
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
                          SRC.indexOf('var VE_FEAD_CARD_CLASS'));
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
  test('iki ÖN AYARIN varsayılanı FARKLI ve tip döneminin aynısı', () => {
    const sema = fead.veFeadKatmanVarsayilan('geometri');
    const cal  = fead.veFeadKatmanVarsayilan('isletme');
    // Kart bölünürken konan kural: sarım açıları GEOMETRİ kartında, açıklık
    // gerilmeleri İŞLETME kartında (ikisi aynı çizimde kalabalık yapıyordu).
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
    expect(fead.veFeadKatmanlar(n)).toEqual(fead.veFeadKatmanVarsayilan('geometri'));
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
describe('işlemler — iki ön ayar + iki toptan', () => {
  test('Tümü / Hiçbiri hepsini yazıyor', () => {
    kurOrnek();
    const a = kart('fead-layout', 'kartA', { katOn: 'isletme' });
    expect(fead.veFeadKatmanIslem('kartA', 'tumu')).toBe(true);
    const hepsi = fead.veFeadKatmanlar(a);
    fead.VE_FEAD_KATMANLAR.forEach((K) => expect(hepsi[K.k]).toBe(true));
    expect(fead.veFeadKatmanIslem('kartA', 'hicbiri')).toBe(true);
    const hic = fead.veFeadKatmanlar(a);
    fead.VE_FEAD_KATMANLAR.forEach((K) => expect(hic[K.k]).toBe(false));
  });

  test('ÖN AYAR alanı SİLER — bugünün varsayılanını dondurmaz', () => {
    kurOrnek();
    const a = kart('fead-layout', 'kartA');
    fead.veFeadKatmanIslem('kartA', 'hicbiri');
    expect(a.data.kat).toBeTruthy();
    fead.veFeadKatmanIslem('kartA', 'geometri');
    // Silinmiş bir alan ön ayarı İZLEMEYE DEVAM eder; sıfırlarla doldurulmuş
    // bir alan bugünün ön ayarını dondurup yarınki değişikliği sessizce
    // kaçırırdı. VARSAYILAN ön ayar `katOn`u da siler — yazsaydı "geometri"
    // adı kayıtta donar ve varsayılanın kendisi değişince kart geride kalırdı.
    expect(a.data.kat).toBeUndefined();
    expect(a.data.katOn).toBeUndefined();
    expect(fead.veFeadKatmanlar(a)).toEqual(fead.veFeadKatmanVarsayilan('geometri'));
    expect(fead.veFeadKatmanIslem('kartA', 'uydurma')).toBe(false);
  });

  // ── ÖN AYAR ADIYLA TAŞINIR, KOPYASIYLA DEĞİL ─────────────────────────────
  // Kopyalansaydı ön ayarın yarınki hâli o kartı hiç bulamazdı; dahası köprü
  // katmanı (DOM'suz `fead-model.js`) sekiz bayrağın İKİNCİ bir listesini
  // tutmak zorunda kalır ve iki liste sessizce ayrışırdı.
  test('İŞLETME ön ayarı ADIYLA yazılır ve elle seçimleri temizler', () => {
    kurOrnek();
    const a = kart('fead-layout', 'kartA');
    fead.veFeadKatmanSet('kartA', 'gul', false);
    expect(a.data.kat).toBeTruthy();
    expect(fead.veFeadKatmanIslem('kartA', 'isletme')).toBe(true);
    expect(a.data.katOn).toBe('isletme');
    expect(a.data.kat).toBeUndefined();               // elle seçim temizlendi
    expect(fead.veFeadKatmanlar(a)).toEqual(fead.veFeadKatmanVarsayilan('isletme'));
    // Sekiz bayrağın kopyası DEĞİL: kayıtta yalnız bir ad duruyor.
    expect(Object.keys(a.data)).toEqual(['katOn']);
  });

  // ÖN AYAR DEVİR DE SEÇER. Geometri kartının donukluğu bir zamanlar TİPİN
  // içindeydi; tip kalkınca buraya taşındı. Taşınmasaydı açılıştaki iki
  // kanvasın İKİSİ de animasyonlu gelirdi.
  test('ön ayar DEVRİ de belirler; kullanıcı seçimi ön ayarı SUSTURUR', () => {
    kurOrnek();
    const a = kart('fead-layout', 'kartA');
    expect(fead.veFeadOnAyarDevir(a)).toBe('off');                 // geometri donuk
    fead.veFeadKatmanIslem('kartA', 'isletme');
    expect(fead.veFeadOnAyarDevir(a)).toBeNull();                  // işletme: çözüm koşsun
    fead.veFeadKatmanIslem('kartA', 'geometri');
    // YAZILI ALAN ÖN AYARI SUSTURUR — ve ölçüt ön ayarın SÖZ SÖYLEDİĞİ hâlde
    // alınır (geometri, `devir:'off'`). İşletmede ölçmek hiçbir şey demezdi:
    // orada ön ayarın zaten söyleyecek bir şeyi yok, ikisi de `null` döner.
    a.data.animRpm = 2000;
    expect(fead.veFeadOnAyarDevir(a)).toBeNull();
    // VE SONUCU ÇİZİMDE: elle devir seçilmiş bir geometri kartı CANLI olur.
    expect(fead.veFeadLayoutCardHTML(a)).toMatch(/data-fead-anim/);
    delete a.data.animRpm;
    expect(fead.veFeadLayoutCardHTML(a)).not.toMatch(/data-fead-anim/);
    a.data.animRpm = 2000;
    fead.veFeadKatmanIslem('kartA', 'geometri');
    expect(a.data.animRpm).toBeUndefined();      // ön ayar söz söylediği alanı temizler
    expect(fead.veFeadOnAyarDevir(a)).toBe('off');
    // ÖN AYARIN SÖZ SÖYLEMEDİĞİ alana DOKUNULMAZ.
    a.data.vibMode = 'span'; a.data.posMode = 'min';
    fead.veFeadKatmanIslem('kartA', 'isletme');
    expect(a.data.vibMode).toBe('span');
    expect(a.data.posMode).toBe('min');
  });

  test('tanınmayan ön ayar adı VARSAYILANA düşer — kart çıplak kalmaz', () => {
    const n = { type: 'fead-layout', def: componentDefs['fead-layout'],
                data: { katOn: 'uydurma' } };
    expect(fead.veFeadKatmanOnAyar(n)).toBe(fead.VE_FEAD_KAT_VARSAYILAN);
    expect(fead.veFeadKatmanlar(n)).toEqual(fead.veFeadKatmanVarsayilan('geometri'));
    expect(fead.veFeadKatmanVarsayilan('uydurma'))
      .toEqual(fead.veFeadKatmanVarsayilan(fead.VE_FEAD_KAT_VARSAYILAN));
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('panel', () => {
  test('YALNIZ AÇIK KART için basılıyor ve açıklık MODELDE değil', () => {
    kurOrnek();
    const a = kart('fead-layout', 'kartA');
    const b = kart('fead-layout', 'kartB');
    const kat = fead.veFeadKatmanlar(a);
    expect(fead.veFeadKatmanPanelHTML(a, kat, false)).toBe('');
    fead.veFeadKatmanToggle('kartA');
    expect(fead.veFeadKatmanPanelHTML(a, kat, false)).toContain('ve-fead-kat-liste');
    expect(fead.veFeadKatmanPanelHTML(b, kat, false)).toBe('');
    // Panelin AÇIK olması bir görünüm durumu: kaydedilmemeli, geri-al
    // yığınına yazılmamalı, ikinci bir oturuma taşınmamalı.
    expect(a.data.katAcik).toBeUndefined();
    expect(JSON.stringify(a.data)).not.toMatch(/acik/i);
    // İkinci karta geçince birincisi kapanır (iki panel açıkken hangi kartın
    // ayarına baktığın okunmuyor).
    fead.veFeadKatmanToggle('kartB');
    expect(fead.veFeadKatmanPanelHTML(a, kat, false)).toBe('');
    expect(fead.veFeadKatmanPanelHTML(b, kat, false)).not.toBe('');
    // Aynı karta ikinci tıklama kapatır.
    expect(fead.veFeadKatmanToggle('kartB')).toBeNull();
  });

  test('panelde HER katman için bir kutucuk, HER ön ayar için bir düğme', () => {
    kurOrnek();
    const a = kart('fead-layout', 'kartA');
    fead.veFeadKatmanToggle('kartA');
    const h = fead.veFeadKatmanPanelHTML(a, fead.veFeadKatmanlar(a), false);
    const kap = document.createElement('div');
    kap.innerHTML = h;
    expect(kap.querySelectorAll('input[type="checkbox"]'))
      .toHaveLength(fead.VE_FEAD_KATMANLAR.length);
    // ÖN AYARLAR KENDİ SATIRINDA ve listeden TÜRÜYOR: sabit bir sayı yazmak,
    // üçüncü bir ön ayarın panelde hiç görünmemesi demekti.
    const on = kap.querySelectorAll('.ve-fead-kat-islem.onayar button');
    expect(on).toHaveLength(fead.VE_FEAD_ON_AYARLAR.length);
    fead.VE_FEAD_ON_AYARLAR.forEach((O) => expect(h).toContain('>' + O.t + '<'));
    // AÇIK ÖN AYAR BASILI: kartın hangi görünümde olduğunu söyleyen tek yüzey.
    expect([...on].filter((b) => b.classList.contains('is-acik')).map((b) => b.textContent))
      .toEqual(['Geometri']);
    expect(kap.querySelectorAll('.ve-fead-kat-islem:not(.onayar) button')).toHaveLength(2);

    // ELLE BİR KUTUCUK OYNATILINCA HİÇBİR ÖN AYAR BASILI KALMAZ: kart artık
    // o ön ayar değil, ondan TÜREMİŞ bir küme. Basılı bırakmak, kullanıcıya
    // olmayan bir şeyi söylerdi — ve o hâlde "Geometri"ye basmak resmi
    // değiştirir, oysa düğme zaten basılı görünürdü.
    fead.veFeadKatmanSet('kartA', 'gul', false);
    const kap2 = document.createElement('div');
    kap2.innerHTML = fead.veFeadKatmanPanelHTML(a, fead.veFeadKatmanlar(a), false);
    expect(kap2.querySelectorAll('.ve-fead-kat-islem.onayar button.is-acik')).toHaveLength(0);
    // Ön ayara dönünce işaret geri gelir.
    fead.veFeadKatmanIslem('kartA', 'geometri');
    const kap3 = document.createElement('div');
    kap3.innerHTML = fead.veFeadKatmanPanelHTML(a, fead.veFeadKatmanlar(a), false);
    expect([...kap3.querySelectorAll('.ve-fead-kat-islem.onayar button.is-acik')]
      .map((b) => b.textContent)).toEqual(['Geometri']);
    fead.VE_FEAD_KATMANLAR.forEach((K) => expect(h).toContain(K.t));
    // Kişiselleştirmenin ne olduğu panelde YAZILI — yoksa kullanıcı ayarın
    // bütün kartları mı yoksa bu kartı mı bağladığını deneyerek öğrenirdi.
    expect(h).toMatch(/yalnız bu karta/i);
  });

  test('AÇIK ama o an ÇİZİLMEYEN katman sebebini söylüyor', () => {
    kurOrnek();
    const a = kart('fead-layout', 'kartA', { katOn: 'isletme' });
    fead.veFeadKatmanToggle('kartA');
    const kat = fead.veFeadKatmanlar(a);
    expect(kat.spanEt).toBe(true);
    // Gerilme haritası yoksa (devir seçilmemiş) kutucuk açık ama çizimde
    // karşılığı yok. Sessiz bırakmak kullanıcıya kendi seçimini sorgulatırdı.
    expect(fead.veFeadKatmanPanelHTML(a, kat, false)).toContain('devir seçili değil');
    expect(fead.veFeadKatmanPanelHTML(a, kat, true)).not.toContain('devir seçili değil');
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
    const h = fead.veFeadKatmanPanelHTML(a, fead.veFeadKatmanlar(a), false)
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
describe('çok kart — TEK TİP', () => {
  test('kanvas tipi TEK ve SINIRSIZ; `fead-run` diye bir tip YOK', () => {
    // `fead-run` bir zamanlar ayrı bir tipti (ve `maxInstances: 1`di). Tek
    // kart varken makuldü; katmanlar kart başına seçilebilir olunca hem sınır
    // hem TİP konusuz kaldı — ikinci kart rölantiyi ve 2000 dev/dk'yı yan yana
    // görmenin tek yolu ve ayrımı kullanıcı seçiyor.
    expect(componentDefs['fead-run']).toBeUndefined();
    expect(componentDefs['fead-layout'].maxInstances).toBeUndefined();
    // Palet, modül listesi ve panel dağıtımı da eski tipi taşımamalı: kalan
    // bir kayıt paletten kurulup TANIMSIZ bir düğüm üretirdi.
    const HTML = fs.readFileSync(path.join(__dirname, '../../index.html'), 'utf8');
    expect(HTML).not.toContain('fead-run');
    expect(fs.readFileSync(path.join(__dirname, '../../js/components.js'), 'utf8')
      .split('\n').filter((l) => l.indexOf('fead-run') >= 0
                               && l.trim().indexOf('//') !== 0)).toEqual([]);
  });

  test('HER KART KENDİ kol konumunu çizer — devralma YOK', () => {
    // Eskiden çalışma kartı `veFeadPosModeShared`ten okuyordu: tek kart varken
    // doğruydu, ikinci kart kendi seçicisini yazıp BİRİNCİ kartın konumunu
    // çiziyordu. Tek tip kalınca devralınacak bir "öteki" de yok — ve yardımcı
    // KALDIRILDI, yoksa bir sonraki düzenlemede sessizce geri gelirdi.
    const i = SRC.indexOf('var kat = veFeadKatmanlar(node);');
    const j = SRC.indexOf('var mode =', i);
    const satir = SRC.slice(j, SRC.indexOf('\n', j));      // KOD satırı, yorum değil
    expect(satir).toBe('var mode = veFeadPosMode(node);');
    expect(SRC).not.toContain('function veFeadPosModeShared');
    expect(fead.veFeadPosModeShared).toBeUndefined();
  });

  test('iki kart, iki ön ayar, İKİ AYRI RESİM — aynı tipten', () => {
    kurOrnek();
    const a = kart('fead-layout', 'kartA');
    const b = kart('fead-layout', 'kartB', { katOn: 'isletme' });
    const ha = fead.veFeadLayoutCardHTML(a), hb = fead.veFeadLayoutCardHTML(b);
    expect(a.type).toBe(b.type);
    expect(ha).not.toBe(hb);
    // Geometri donuk (animasyon yükü yok), işletme canlı.
    expect(ha).not.toMatch(/data-fead-anim/);
    expect(hb).toMatch(/data-fead-anim/);
    // Sarım açıları geometride, açıklık gerilmeleri işletmede.
    expect(ha).toMatch(/data-ve="belt"/);
    expect(hb).toMatch(/data-ve="belt-tension"/);
    expect(ha).not.toMatch(/data-ve="belt-tension"/);
  });
});
