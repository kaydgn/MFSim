/**
 * mount-baslangic.test.js — TAKOZ BAŞLANGIÇ SAYFASI (js/cp-mount-baslangic.js)
 * + ORTAK KİT (js/baslangic-sayfa.js)
 *
 * Kullanıcı isteği (2026-10-14): *"FEAD modülünün başlangıç ekranı çok güzel,
 * aynı onun gibi bir ekran istiyorum. Takoz modülüne de 'Başlangıç Sihirbazı',
 * 'STEP dosyadan başlama' ve 'Boş kanvas' gibi özellikler kuracağız."*
 *
 * Kapıların sorduğu şey:
 *   · "aynı" = TEK üretici: iki modül de kitin sınıflarıyla basıyor, CSS'te
 *     modüle özgü bir kopya aile kalmadı;
 *   · görünürlük MODELDEN (bayrak yok): yalnız "Başlangıç ve Örnekler"
 *     taşıyan eski kayıt boş sayılır, araç düğümü bile bir yol seçildi demektir;
 *   · kapılar modülün KENDİ çağrılarına gidiyor (sayfa düğüm kurmaz);
 *   · örnek listesi kayıt defterinin KENDİSİ; dizinin her yazısı örneğin kendi
 *     kaydından, resim yok;
 *   · kapsam dışında sayfa kurulmuyor; sayfanın faresi tuvale sızmıyor.
 * Gerçek tarayıcı (sayfanın görünmesi, kapılar, Ctrl+Z ile geri gelme)
 * tests/e2e/mount-baslangic.spec.js.
 */
const fs = require('fs');
const path = require('path');
const stubs = stubGlobals();
document.body.innerHTML = '<div id="ve-canvas-wrapper"><div id="ve-canvas"></div></div>';
global.nodes = [];
global.connections = [];
eval(loadSource('components.js'));
global.componentDefs = componentDefs;
const core = require('../../js/mount-core.js');
global.veMountCore = core;
const cp = require('../../js/cp-mount.js');
const BS = require('../../js/cp-mount-baslangic.js');

const CSS = fs.readFileSync(path.join(__dirname, '../../css/styles.css'), 'utf8');

beforeEach(() => {
  resetStubs(stubs);
  global.nodes = [];
  BS._mntBasSifirla();
  document.body.innerHTML = '<div id="ve-canvas-wrapper"><div id="ve-canvas"></div></div>';
});

const dugum = (type) => ({ id: type + '-' + Math.random().toString(36).slice(2, 7), type,
  def: componentDefs[type] || {}, x: 0, y: 0, data: {} });
// Çıplak adla çağrılan global'i bir casusla değiştir, sonra geri koy.
function casus(ad, fn, govde) {
  const eski = global[ad];
  global[ad] = jest.fn(fn);
  try { return govde(global[ad]); } finally { if (eski === undefined) delete global[ad]; else global[ad] = eski; }
}

describe('GÖRÜNÜRLÜK — modelden türer', () => {
  test('boş topoloji → sayfa', () => {
    expect(BS.veMntBaslangicGerekli([])).toBe(true);
  });
  test('yalnız "Başlangıç ve Örnekler" taşıyan eski kayıt BOŞ sayılır', () => {
    // 2026-10-14'e kadar açılış bu tek düğümü kendiliğinden kuruyordu
    expect(componentDefs['mnt-example'].isMountExample).toBe(true);
    expect(BS.veMntBaslangicGerekli([dugum('mnt-example')])).toBe(true);
  });
  test('araç düğümü de bir yol seçildi demektir (Boş kanvas onu kurar)', () => {
    expect(BS.veMntBaslangicGerekli([dugum('mnt-solver')])).toBe(false);
    expect(BS.veMntBaslangicGerekli([dugum('mnt-example'), dugum('mnt-motor')])).toBe(false);
  });
  test('liste verilmezse canlı `nodes`', () => {
    global.nodes = [dugum('mnt-mount')];
    expect(BS.veMntBaslangicGerekli()).toBe(false);
  });
});

describe('İÇERİK — kapılar ve örnekler', () => {
  const html = BS.veMntBaslangicHTML();
  test('üç kapı: sihirbaz (birincil) · STEP · boş kanvas — kitin sınıflarıyla', () => {
    const kapi = html.match(/<button type="button" class="ve-bas-kapi[^"]*" data-ey="[a-z]+"/g);
    expect(kapi.map((k) => k.match(/data-ey="([a-z]+)"/)[1])).toEqual(['sihirbaz', 'step', 'bos']);
    expect(kapi[0]).toContain('ve-bas-kapi birincil');
  });
  // ARAYÜZ ANLATMAZ (kök CLAUDE.md, aşama 1 kararı 2026-10-16): üst satır,
  // serbest başlık, alt metin, kapı notu, rozet, bölüm notları ve dipnot YOK;
  // satırda ipucu yalnız kaynakta — tek satırda kısalan metnin TAMAMI.
  // 2026-10-19 (*"çok sade olmuş … profesyonel dursun"*): eklenenler AD ve
  // VERİ — tek h1 modülün adı, kapının künyesi kısa adlar.
  test('ARAYÜZ ANLATMAZ — ad, veri ve künye; açıklama yuvası yok', () => {
    const d = document.createElement('div');
    d.innerHTML = html;
    expect(d.querySelector('p, .ve-bas-ust, .ve-bas-alt, .ve-bas-not, .ve-bas-kapi-t > span:not(.ve-bas-kapi-k), .ve-bas-kapi-t b i, .ve-bas-baslik span'))
      .toBeNull();
    expect([...d.querySelectorAll('h1')].map((h) => !!h.closest('.ve-bas-kimlik') && h.textContent))
      .toEqual([componentDefs['mount-analysis'].name]);
    expect([...d.querySelectorAll('.ve-bas-kapi b')].map((b) => b.textContent))
      .toEqual(['Sihirbazla kur', 'STEP\'ten başla', 'Boş kanvas']);
    // Künye ve bandın adları VERİ: kısa ad, cümle noktalaması yok (uzantı dışında).
    const kisa = (t) => { expect(t).toMatch(/^(\.[a-z0-9]+|[^.!?:;…]+)$/); expect(t.split(/\s+/).length).toBeLessThanOrEqual(4); };
    d.querySelectorAll('.ve-bas-kapi-k > span').forEach((k) => kisa(k.textContent));
    d.querySelectorAll('.ve-bas-veri dt, .ve-bas-yetenek li').forEach((x) => kisa(x.textContent));
    d.querySelectorAll('.ve-bas-dizin [title]').forEach((x) => {
      expect(x.classList.contains('ve-bas-satir-kaynak')).toBe(true);
      expect(x.getAttribute('title')).toBe(x.textContent);
    });
    const MD = require('../../tools/metin-dili.js');
    const tw = document.createTreeWalker(d, NodeFilter.SHOW_TEXT);
    const aday = [];
    for (let t = tw.nextNode(); t; t = tw.nextNode()) {
      // Küçük resmin içi çizicinin metni (kendi aşaması); burada sayfanın metni.
      if (t.parentElement.closest('svg')) continue;
      const m = t.nodeValue.trim();
      if (m && MD.isaretle(m, 'arayuz').length) aday.push(m);
    }
    expect(aday).toEqual([]);
  });
  test('örnek satırları kayıt defterinin KENDİSİ (gerçek, sonra kurgu); her satırın Yükle\'si örneğin eylemi', () => {
    const liste = core.getMountExampleList();
    const sira = liste.filter((e) => !e.kurgu).concat(liste.filter((e) => e.kurgu)).map((e) => e.id);
    const d = document.createElement('div');
    d.innerHTML = html;
    expect([...d.querySelectorAll('.ve-bas-satir')].map((r) => r.getAttribute('data-v'))).toEqual(sira);
    expect([...d.querySelectorAll('.ve-bas-satir-yukle')].map((b) => [b.getAttribute('data-ey'), b.getAttribute('data-v')]))
      .toEqual(sira.map((k) => ['ornek', k]));
  });
  // Kurgu doğrulama modelleri gerçek araçlarla karışmaz: ayrı bölüm, başlığı
  // "kurgu" der (kullanıcı isteği 2026-10-16).
  test('iki bölüm: gerçek araçlar · "Doğrulama örnekleri — kurgu"', () => {
    const liste = core.getMountExampleList();
    const bas = html.match(/<div class="ve-bas-baslik"><h2>[^<]+<\/h2>/g).map((b) => b.replace(/.*<h2>|<\/h2>/g, ''));
    expect(bas).toEqual(['Örnek modellerden başla', 'Doğrulama örnekleri — kurgu']);
    const dizin = html.slice(html.indexOf('class="ve-bas-dizin"'));
    const [gercek, kurgu] = dizin.split('Doğrulama örnekleri — kurgu');
    liste.forEach((e) => {
      const yer = e.kurgu ? kurgu : gercek, oteki = e.kurgu ? gercek : kurgu;
      expect(yer).toContain('data-v="' + e.id + '"');
      expect(oteki).not.toContain('data-v="' + e.id + '"');
    });
  });
});

// DİZİN (kullanıcı seçimi 2026-11-04, tasarım tuvali "sade seçenekler" · D):
// resim yok. Satırın her yazısı örneğin KENDİ kaydından — ikinci bir künye
// listesi tutulsaydı örnek değişince sessizce bayatlardı.
describe('DİZİN — satırın künyesi örneğin kendi kaydından', () => {
  const n = (x, b) => veSayi(x, b || 0);
  const satirlar = () => { const s = BS.veMntBaslangicSayfa(); return s.bolumler[0].satirlar.concat(s.bolumler[1].satirlar); };
  test('araç · gövde ve takoz sayısı · toplam kütle', () => {
    satirlar().forEach((r) => {
      const ex = core.getMountExample(r.v);
      const top = ex.model.components.reduce((t, c) => t + c.mass, 0);
      expect([r.v, r.ad, r.sayi, r.kutle]).toEqual([ex.id, ex.vehicle,
        n(ex.model.components.length) + ' gövde · ' + n(ex.model.mounts.length) + ' takoz', n(top) + ' kg']);
    });
  });
  test('ayrıntı: gövdeler kütleleriyle (tek ondalık), takozların adı', () => {
    satirlar().forEach((r) => {
      const ex = core.getMountExample(r.v);
      expect(r.detay.map((d) => d.baslik)).toEqual(['Gövdeler', 'Takozlar']);
      expect(r.detay[0].ogeler).toEqual(ex.model.components.map((c) => ({ ad: c.name, deger: n(c.mass, 1) + ' kg' })));
      expect(r.detay[1].ogeler).toEqual(ex.model.mounts.map((m) => ({ ad: m.name.trim() })));
    });
  });
  // KAYNAK: gerçek örnekte kaydın "Kaynak" satırı, yoksa açıklaması ("Kaynak: "
  // öneki düşer); kurgu örnekte açıklaması — kurgunun "Kaynak" satırı bölüm
  // başlığının söylediğini tekrar ederdi.
  test('kaynak: kaydın Kaynak satırı ya da açıklaması; kurgunun uyarısı tekrar edilmez', () => {
    const k = Object.fromEntries(satirlar().map((r) => [r.v, r.kaynak]));
    expect(k.siper).toBe('CATIA atalet ölçümü · ADAMS doğrulaması');
    expect(k.tulga).toBe('TULGA proje kaydı');
    expect(k.asfat).toBe('BMC ASR-SR-116 · 04.08.2021');
    core.getMountExampleList().forEach((ex) => {
      const sat = (ex.specs || []).find((x) => x[0] === 'Kaynak');
      const bek = (sat && !ex.kurgu) ? sat[1] : String(ex.description || '').replace(/^Kaynak:\s*/, '');
      expect([ex.id, k[ex.id]]).toEqual([ex.id, bek]);
      expect(k[ex.id]).not.toMatch(/^Kaynak:|Kurgu —/);
    });
  });
  test('resim YOK: sayfada çizim, resim kutusu ve karo yok', () => {
    const h = BS.veMntBaslangicHTML();
    expect(h).not.toMatch(/ve-mnt2d-akso|ve-bas-resim|ve-bas-karo|ve-bas-oniz|<svg class="ve-ak/);
  });
});

// KİMLİK VE VERİ (kullanıcı isteği 2026-10-19: *"çok sade olmuş … Bir şeyler
// ekleyelim … profesyonel dursun."*). Sayfaya eklenen her şey AD ya da VERİ ve
// hepsinin bir kaynağı var: analizin adı programın kendi adı, sayı kaynağından
// ölçülür, kapının künyesi sihirbazın adımları ve dosya seçicinin kabul
// listesi. Elle yazılmış bir sayı kütüphane büyüyünce sessizce bayatlardı;
// uydurulmuş bir analiz adı programda karşılığı olmayan bir vaat olurdu.
describe('KİMLİK VE VERİ — adlar programdan, sayılar kaynağından', () => {
  const W = require('../../js/cp-mount-wizard.js');
  const n = (x) => veSayi(x, 0);
  test('kimlik: modülün componentDefs adı ve ikonu', () => {
    const k = BS.veMntBaslangicKimlik();
    expect(k.ad).toBe(componentDefs['mount-analysis'].name);
    expect(k.ikon).toBe(componentDefs['mount-analysis'].svg);
    expect(k.yetenekler).toBe(BS.VE_MNT_BAS_YETENEK);
  });
  test('her analiz adı programın kendi adı: raporun adımı, Sonuçlar\'ın kümesi, Parametrik Analiz\'in bölümü', () => {
    const tr = (s) => s.toLocaleLowerCase('tr');
    const adlar = [];
    for (const m of loadSource('cp-mount-report.js').matchAll(/Adım \d+ — ([^<(]+)/g)) adlar.push(m[1].trim());
    for (const m of loadSource('mount-signals.js').matchAll(/name: '([^']+)'/g)) adlar.push(m[1]);
    for (const m of loadSource('cp-mount-param.js').matchAll(/_mntBolum\('([^']+)'/g)) adlar.push(m[1]);
    expect(adlar.length).toBeGreaterThan(10);
    expect(BS.VE_MNT_BAS_YETENEK.filter((y) => !adlar.some((a) => tr(a).includes(tr(y))))).toEqual([]);
  });
  test('bandın her sayısı kaynağından; hiçbir satır düşmez', () => {
    const lib = cp.VE_MOUNT_LIBRARY;
    const yasa = Object.keys(lib).filter((k) => lib[k].fits || lib[k].curves);
    const I3 = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
    const bek = {
      'Takoz tipi': Object.keys(lib).length,
      'Kuvvet–sehim yasası': yasa.length,
      'Gövde tipi': W.VE_MW_GOVDE_TIPLERI.length,
      'Örnek model': core.getMountExampleList().length,
      'Serbestlik derecesi': core.buildM6(1, I3).length       // kütle matrisinin boyutu
    };
    const v = BS.veMntBaslangicVeri();
    expect(v.map((x) => x.ad)).toEqual(Object.keys(bek));
    v.forEach((x) => expect(x.deger).toBe(n(bek[x.ad])));
    expect(v[1].title).toBe(yasa.map((k) => lib[k].name).join(' · '));
    expect(v[2].title).toBe(W.VE_MW_GOVDE_TIPLERI.map((t) => componentDefs[t].name).join(' · '));
    // HTML'de de: <dl> satırı başına bir değer
    const d = document.createElement('div');
    d.innerHTML = BS.veMntBaslangicHTML();
    expect([...d.querySelectorAll('.ve-bas-veri dd')].map((x) => x.textContent))
      .toEqual(Object.keys(bek).map((k) => n(bek[k])));
  });
  // Tarayıcıda sabit `window[ad]`dan okunur. `const`/`let` ile bildirilmiş
  // üst seviye ad pencereye yazılmaz; Node'da `require` yolu çalıştığı için
  // birim testi bunu görmezdi ve bant o satırı SESSİZCE düşürürdü.
  test('okunan her sabit tarayıcıda da var: üst seviye `var` ya da `function`', () => {
    const okunan = [...loadSource('cp-mount-baslangic.js').matchAll(/_mntBasG\('([A-Za-z_]+)', '\.\/([a-z0-9-]+\.js)'\)/g)];
    expect(okunan.length).toBeGreaterThanOrEqual(6);
    okunan.forEach(([, ad, dosya]) => {
      expect(loadSource(dosya)).toMatch(new RegExp('^(var|function) ' + ad + '\\b', 'm'));
    });
  });
  test('kapı künyesi: sihirbazın adımları · STEP\'in biçimi · boş kanvasın araçları', () => {
    const [sih, step, bos] = BS.veMntBaslangicKapilar();
    expect(W.VE_MW_STEPS[0].key).toBe('kaynak');              // ilk adım bu sayfanın kendisi
    expect(sih.kunye).toEqual(W.VE_MW_STEPS.slice(1).map((s) => s.ad));
    const kabul = loadSource('cp-mount-wizard.js').match(/ve-mw-stp-file" accept="([^"]+)"/)[1].split(',');
    expect(step.kunye.filter((t) => t[0] === '.')).toEqual(kabul);
    // Standardın adı okuyucunun başlık denetiminde (dosyadaki yazımı tireli).
    step.kunye.filter((t) => t[0] !== '.')
      .forEach((t) => expect(loadSource('step-p21.js')).toContain('\'' + t.replace(' ', '-') + '\''));
    expect(bos.kunye).toEqual([cp.VE_MNT_ARAC_TIPLERI.length + ' araç']);
    expect(bos.title).toBe(cp.VE_MNT_ARAC_TIPLERI.map((t) => componentDefs[t].name).join(' · '));
  });
  test('Kılavuz: üretici yüklüyse düğme basılır ve tık modülün kılavuzunu açar', () => {
    const GK = require('../../js/guide-kit.js');
    const uret = GK.veGuideKitOf('mount').uret;
    expect(BS.veMntBaslangicKimlik().kilavuz).toBe('');      // yüklü değil → düğme yok
    expect(BS.veMntBaslangicHTML()).not.toContain('ve-bas-kilavuz');
    global[uret] = () => '';
    try {
      expect(BS.veMntBaslangicKimlik().kilavuz).toBe('mount');
      BS.veMntBaslangicKapsam('mount-analysis');
      casus('veGuideOpen', () => {}, (f) => {
        document.querySelector('#' + BS.VE_MNT_BAS_ID + ' .ve-bas-kilavuz').click();
        expect(f).toHaveBeenCalledWith('mount');
      });
    } finally { delete global[uret]; }
  });
});

describe('KAPILAR — modülün kendi çağrıları', () => {
  // STEP kapısı sihirbazı AÇMAZ (kullanıcı kararı 2026-11-02): dosya 3B'nin kendi perdesinde okunur
  test('sihirbaz → veMntWizAc · step → veMntCadAcStep (sihirbaz açılmaz)', () => {
    casus('veMntWizAc', () => true, (f) => {
      expect(BS.veMntBaslangicEylem('sihirbaz')).toBe(true);
      expect(f).toHaveBeenCalledTimes(1);
    });
    casus('veMntWizAcStep', () => { throw new Error('sihirbazın kapısı'); }, () => {
      casus('veMntCadAcStep', () => true, (f) => {
        expect(BS.veMntBaslangicEylem('step')).toBe(true);
        expect(f).toHaveBeenCalledTimes(1);
      });
    });
    casus('veMntCadAcStep', () => true, (f) => {
      expect(BS.veMntBaslangicEylem('step')).toBe(true);
      expect(f).toHaveBeenCalledTimes(1);
    });
  });
  test('boş kanvas → veMntKanvasBos; örnek → veMntOrnekYukle(anahtar)', () => {
    casus('veMntKanvasBos', () => [{}], (f) => {
      expect(BS.veMntBaslangicEylem('bos')).toBe(true);
      expect(f).toHaveBeenCalledTimes(1);
    });
    casus('veMntOrnekYukle', () => true, (f) => {
      expect(BS.veMntBaslangicEylem('ornek', 'siper')).toBe(true);
      expect(f).toHaveBeenCalledWith('siper');
      expect(BS.veMntBaslangicEylem('ornek', '')).toBe(false);
    });
    expect(BS.veMntBaslangicEylem('bilinmeyen')).toBe(false);
  });
});

describe('DOM — kapsam, tazeleme, olaylar', () => {
  const el = () => document.getElementById(BS.VE_MNT_BAS_ID);
  test('Takoz kapsamında boş topoloji → sayfa kurulur ve görünür', () => {
    expect(BS.veMntBaslangicKapsam('mount-analysis')).toBe(true);
    expect(el()).not.toBeNull();
    expect(el().hidden).toBe(false);
    expect(el().className).toBe('ve-bas');
    expect(BS.veMntBaslangicAcik()).toBe(true);
  });
  test('kapsam dışında sayfa KURULMAZ', () => {
    expect(BS.veMntBaslangicKapsam('arac-performans')).toBe(false);
    expect(el()).toBeNull();
  });
  test('model kurulunca çekilir, geri alınınca (boş) geri gelir', () => {
    BS.veMntBaslangicKapsam('mount-analysis');
    global.nodes = [dugum('mnt-motor')];
    expect(BS.veMntBaslangicTazele()).toBe(false);
    expect(el().hidden).toBe(true);
    global.nodes = [];
    expect(BS.veMntBaslangicTazele()).toBe(true);
    expect(el().hidden).toBe(false);
  });
  test('sayfadaki tık kapının eylemine gider; fare olayı kaba SIZMAZ', () => {
    BS.veMntBaslangicKapsam('mount-analysis');
    const kap = document.getElementById('ve-canvas-wrapper');
    const kapDinler = jest.fn();
    kap.addEventListener('mousedown', kapDinler);
    casus('veMntKanvasBos', () => [{}], (f) => {
      const b = el().querySelector('.ve-bas-kapi[data-ey="bos"]');
      b.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      b.click();
      expect(f).toHaveBeenCalledTimes(1);
    });
    expect(kapDinler).not.toHaveBeenCalled();
  });
});

// ÇALIŞMA MASASI (kullanıcı seçimi 2026-11-04, tasarım tuvali "Takoz
// başlangıç sayfası" · 1): solda panel, sağda masa — masanın içeriği örneklerin
// DİZİNİ (aynı gün, tasarım tuvali "sade seçenekler" · D). Satırın Yükle'si TEK
// TIKLA kurar; adı ayrıntıyı açar. Açık satır TEK ve görünüm durumu (modelde
// değil); açıp kapamak sayfayı yeniden basmaz.
describe('ÇALIŞMA MASASI — panel · dizin', () => {
  const el = () => document.getElementById(BS.VE_MNT_BAS_ID);
  const K = require('../../js/baslangic-sayfa.js');
  const satir = (v) => el().querySelector('.ve-bas-satir[data-v="' + v + '"]');
  const acik = () => [...el().querySelectorAll('.ve-bas-satir')].filter((r) => r.classList.contains('acik')).map((r) => r.getAttribute('data-v'));
  beforeEach(() => K._veBasSifirla());
  test('panel: kimlik · kapılar · veri; masa: dizin — başlık satırı, iki grup', () => {
    const d = document.createElement('div');
    d.innerHTML = BS.veMntBaslangicHTML();
    const panel = d.querySelector('.ve-bas-ic.ve-bas-ic--masa > aside.ve-bas-panel');
    const masa = d.querySelector('.ve-bas-ic > .ve-bas-masa');
    expect([...panel.children].map((c) => c.className))
      .toEqual(['ve-bas-kimlik', 've-bas-kapilar', 've-bas-veri']);       // Kılavuz yüklü değil
    expect([...masa.children].map((c) => c.className)).toEqual(['ve-bas-dizin']);
    expect([...masa.querySelectorAll('.ve-bas-dizin-bas > span')].map((x) => x.textContent))
      .toEqual(['', 'Araç', 'Gövde · takoz', 'Kütle', 'Kaynak', '']);
    expect(masa.querySelectorAll('.ve-bas-dizin > .ve-bas-baslik').length).toBe(2);
  });
  test('ilk açılışta ilk satır açık: ayrıntısı görünür, Yükle\'si dolu; ötekiler kapalı', () => {
    BS.veMntBaslangicKapsam('mount-analysis');
    expect(acik()).toEqual(['siper']);
    expect(satir('siper').querySelector('.ve-bas-satir-ac').getAttribute('aria-expanded')).toBe('true');
    expect(satir('siper').querySelector('.ve-bas-satir-detay').hidden).toBe(false);
    expect(satir('tulga').querySelector('.ve-bas-satir-ac').getAttribute('aria-expanded')).toBe('false');
    expect(satir('tulga').querySelector('.ve-bas-satir-detay').hidden).toBe(true);
    expect([...satir('siper').querySelectorAll('.ve-bas-satir-blok h3')].map((h) => h.textContent)).toEqual(['Gövdeler', 'Takozlar']);
  });
  test('Yükle TEK TIKLA kurar; satırın adı yalnız açar/kapar, eylem ÇAĞRILMAZ', () => {
    BS.veMntBaslangicKapsam('mount-analysis');
    casus('veMntOrnekYukle', () => true, (f) => {
      const r = satir('tulga');
      r.querySelector('.ve-bas-satir-ac').click();
      expect(f).not.toHaveBeenCalled();
      expect(acik()).toEqual(['tulga']);                              // açık satır TEK
      expect(satir('tulga')).toBe(r);                                 // sayfa yeniden BASILMADI
      satir('kamyon').querySelector('.ve-bas-satir-yukle').click();   // kapalı satırın Yükle'si de kurar
      expect(f).toHaveBeenCalledTimes(1);
      expect(f).toHaveBeenCalledWith('kamyon');
      r.querySelector('.ve-bas-satir-ac').click();                    // aynı ad kapatır
      expect(acik()).toEqual([]);
    });
  });
  test('açık satır GÖRÜNÜM durumu: modele yazılmaz, sayfa yeniden açılınca yerinde', () => {
    BS.veMntBaslangicKapsam('mount-analysis');
    satir('asfat').querySelector('.ve-bas-satir-ac').click();
    expect(global.nodes).toEqual([]);
    expect(stubs.saveState).not.toHaveBeenCalled();
    global.nodes = [dugum('mnt-motor')];
    BS.veMntBaslangicTazele();
    global.nodes = [];
    BS.veMntBaslangicTazele();
    expect(acik()).toEqual(['asfat']);
    satir('asfat').querySelector('.ve-bas-satir-ac').click();         // hepsi kapalı da korunur
    global.nodes = [dugum('mnt-motor')];
    BS.veMntBaslangicTazele();
    global.nodes = [];
    BS.veMntBaslangicTazele();
    expect(acik()).toEqual([]);
  });
});

// RAY (kullanıcı 2026-11-04: "pencere ilk açıldığında sol tarafta 'topoloji
// ve sonuçlar' sütunu görünmesin. Gerek yok"): sayfa açıkken kabın sınıfı,
// kapanınca kalkar; CSS rayı yalnız topoloji sayfasında gizler.
describe('RAY — sayfa açıkken Topoloji · Sonuçlar rayı gizli', () => {
  test('sınıf sayfanın görünürlüğünü izler', () => {
    document.body.innerHTML = '<div id="sayfa2-content"><nav class="ve-nav-rail"></nav>'
      + '<div id="ve-canvas-wrapper"><div id="ve-canvas"></div></div></div>';
    const kab = document.getElementById('sayfa2-content');
    BS.veMntBaslangicKapsam('mount-analysis');
    expect(kab.classList.contains('ve-bas-acik')).toBe(true);
    global.nodes = [dugum('mnt-solver')];
    BS.veMntBaslangicTazele();
    expect(kab.classList.contains('ve-bas-acik')).toBe(false);
    global.nodes = [];
    BS.veMntBaslangicTazele();
    expect(kab.classList.contains('ve-bas-acik')).toBe(true);
    BS.veMntBaslangicKapsam('top');                       // ana topolojiye dönüş
    expect(kab.classList.contains('ve-bas-acik')).toBe(false);
  });
  test('CSS: ray yalnız topoloji sayfasında gizli (öteki sayfada dönüş yolu)', () => {
    expect(CSS).toMatch(/html:not\(\.ve-sayfa-diger\) #sayfa2-content\.ve-bas-acik \.ve-nav-rail\{ display:none; \}/);
  });
  // Kullanıcı 2026-11-04: "iki sembol var. Onları kaldıralım. Sadece geriye
  // gelme kalsın … Arada çirkin bir boşluk var." Paletin açma sekmesi sayfa
  // açıkken gizli (satır içi display'i JS yazar — kural !important) ve panelin
  // üst dolgusu yalnız dönüş düğmesinin köşesi: 10 + 26 + 12 = 48 px.
  test('CSS: paletin açma sekmesi sayfa açıkken gizli; panel yalnız dönüş düğmesine yer bırakır', () => {
    expect(CSS).toMatch(/html:not\(\.ve-sayfa-diger\) #sayfa2-content\.ve-bas-acik \.ve-sidebar-reveal\{ display:none !important; \}/);
    expect(CSS).toMatch(/\.ve-bas-panel\{[^}]*padding:48px 20px 18px;/);
    expect(CSS).not.toMatch(/\.ve-bas-panel\{[^}]*padding-top:84px/);
    expect(CSS).not.toMatch(/ve-sidebar-reveal\.visible\) \.ve-bas-panel/);
  });
});

describe('ORTAK KİT — "aynı" ekran TEK üreticiden', () => {
  test('FEAD sayfası da kitten basıyor; modüle özgü kopya sınıf ailesi kalmadı', () => {
    const fead = loadSource('cp-fead-baslangic.js');
    expect(fead).toMatch(/veBasSayfaHTML|_feadBasKit/);
    expect(fead).not.toMatch(/class="ve-fead-bas/);
    expect(CSS).not.toMatch(/\.ve-fead-bas/);
    expect(CSS).not.toMatch(/\.ve-mnt-bas/);
    expect(CSS).toMatch(/\.ve-bas-kapi\{/);
  });
  // KALIP AÇIKLAMA YUVASI TAŞIMAZ (kök CLAUDE.md → ARAYÜZ ANLATMAZ): kitin beş
  // yuvası iki modülde on beş açıklama üretmişti. Alan verilse de basılmaz —
  // yeni bir kullanan onu dolduramasın.
  test('KİT AÇIKLAMA YUVASI TAŞIMAZ — üst/başlık/alt/not/rozet verilse de basılmaz', () => {
    const K = require('../../js/baslangic-sayfa.js');
    const h = K.veBasSayfaHTML({ ust: 'ÜSTSATIR', baslik: 'SAYFABAŞLIĞI', alt: 'ALTMETİN', not: 'DİPNOT',
      kapilar: [{ ey: 'a', ikon: 'wand', ad: 'Kapı', not: 'KAPINOTU', rozet: 'ROZET' }],
      bolumler: [{ baslik: 'Bölüm', not: 'BÖLÜMNOTU', satirlar: [{ ey: 'k', v: '1', ad: 'K1',
        not: 'SATIRNOTU', alt: 'SATIRALT', aciklama: 'SATIRAÇIKLAMA' }] }] });
    ['ÜSTSATIR', 'SAYFABAŞLIĞI', 'ALTMETİN', 'DİPNOT', 'KAPINOTU', 'ROZET', 'BÖLÜMNOTU', 'SATIRNOTU', 'SATIRALT', 'SATIRAÇIKLAMA']
      .forEach((m) => expect(h).not.toContain(m));
    expect(h).toContain('<b>Kapı</b>');
    expect(h).toContain('<h2>Bölüm</h2>');
    // Kimlik ve veri yuvaları da yalnız ad ve veri alır (2026-10-19).
    const h2 = K.veBasSayfaHTML({
      kimlik: { ad: 'Modül', alt: 'KİMLİKALT', aciklama: 'KİMLİKAÇIKLAMA', not: 'KİMLİKNOTU', yetenekler: ['Analiz'] },
      veriler: [{ ad: 'Tip', deger: '3', not: 'VERİNOTU', alt: 'VERİALT' }, { ad: 'Boş', deger: '' }] });
    ['KİMLİKALT', 'KİMLİKAÇIKLAMA', 'KİMLİKNOTU', 'VERİNOTU', 'VERİALT', 'Boş'].forEach((m) => expect(h2).not.toContain(m));
    expect(h2).toContain('<h1>Modül</h1>');
    expect(h2).toContain('<dt>Tip</dt><dd>3</dd>');
    // Satırın ayrıntısı yalnız ad ve değer; boş öğe ve boş liste basılmaz.
    const r = K.veBasSatirHTML({ ey: 'k', v: '1', ad: 'A', detay: [
      { baslik: 'Liste', ogeler: [{ ad: 'x', deger: '1 kg', not: 'ÖĞENOTU' }, { ad: '' }] },
      { baslik: 'BOŞLİSTE', ogeler: [] }] }, true);
    expect(r).toContain('<li><span>x</span><b>1 kg</b></li>');
    expect(r.match(/<li>/g).length).toBe(1);
    ['ÖĞENOTU', 'BOŞLİSTE'].forEach((m) => expect(r).not.toContain(m));
    // Karo ipucu yalnız verilirse ve komut eki olmadan.
    expect(h).not.toContain('title=');
    const karo = K.veBasKaroHTML({ ey: 'k', v: '1', baslik: 'Motor · Şanzıman' });
    expect(karo).toContain('title="Motor · Şanzıman"');
    expect(karo).not.toMatch(/yükle"/);
  });
});
