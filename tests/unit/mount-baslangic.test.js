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
    expect(d.querySelector('p, .ve-bas-ust, .ve-bas-alt, .ve-bas-not, .ve-bas-kapi-t > span:not(.ve-bas-kapi-k), .ve-bas-kapi-t b i, .ve-bas-baslik span, .ve-bas-yetenek'))
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
  // Örnekler panelde SEKMELİ (Canlı Not 6): bir sekmede bir bölümün satırları.
  test('örnek satırları kayıt defterinin KENDİSİ (gerçek, sonra kurgu); her satırın Yükle\'si örneğin eylemi', () => {
    const K = require('../../js/baslangic-sayfa.js');
    const liste = core.getMountExampleList();
    const sira = liste.filter((e) => !e.kurgu).concat(liste.filter((e) => e.kurgu)).map((e) => e.id);
    const bas = (sk) => { const d = document.createElement('div'); d.innerHTML = K.veBasSayfaHTML(BS.veMntBaslangicSayfa(), undefined, sk); return d; };
    const sekme = (d) => [...d.querySelectorAll('.ve-bas-satir')].map((r) => r.getAttribute('data-v'));
    expect(sekme(bas(0)).concat(sekme(bas(1)))).toEqual(sira);
    expect(sekme(bas())).toEqual(sekme(bas(0)));                 // varsayılan: açık satırın sekmesi (ilk satır)
    [0, 1].forEach((sk) => expect([...bas(sk).querySelectorAll('.ve-bas-satir-yukle')].map((b) => [b.getAttribute('data-ey'), b.getAttribute('data-v')]))
      .toEqual(sekme(bas(sk)).map((k) => ['ornek', k])));
    expect(sekme(bas(undefined)).length).toBeGreaterThan(0);
  });
  // Kurgu doğrulama modelleri gerçek araçlarla karışmaz: ayrı bölüm, adı
  // "kurgu" der (kullanıcı isteği 2026-10-16). Bölüm bir SEKME (Canlı Not 6):
  // sekmenin adı ve satır sayısı; bölümün tam adı sekme panelinin adı.
  test('iki sekme: Araçlar · Kurgu — sayısıyla; kurgu satırı yalnız Kurgu\'da', () => {
    const K = require('../../js/baslangic-sayfa.js');
    const liste = core.getMountExampleList();
    const gercek = liste.filter((e) => !e.kurgu), kurgu = liste.filter((e) => e.kurgu);
    const d = document.createElement('div');
    d.innerHTML = html;
    expect([...d.querySelectorAll('.ve-bas-ornek-bas h2')].map((h) => h.textContent)).toEqual(['Örnekler']);
    expect([...d.querySelectorAll('.ve-bas-sekme')].map((b) => [b.firstChild.nodeValue, b.querySelector('span').textContent, b.getAttribute('aria-selected')]))
      .toEqual([['Araçlar', String(gercek.length), 'true'], ['Kurgu', String(kurgu.length), 'false']]);
    expect(d.querySelector('[role="tabpanel"]').getAttribute('aria-label')).toBe('Araç örnekleri');
    const k = document.createElement('div');
    k.innerHTML = K.veBasSayfaHTML(BS.veMntBaslangicSayfa(), undefined, 1);
    expect(k.querySelector('[role="tabpanel"]').getAttribute('aria-label')).toBe('Doğrulama örnekleri — kurgu');
    liste.forEach((e) => {
      const [yer, oteki] = e.kurgu ? [k, d] : [d, k];
      expect(yer.querySelector('.ve-bas-satir[data-v="' + e.id + '"]')).not.toBeNull();
      expect(oteki.querySelector('.ve-bas-satir[data-v="' + e.id + '"]')).toBeNull();
    });
    // Tek bölümlü sayfada sekme yok; başlık bölümün adı.
    const t = K.veBasSayfaHTML({ bolumler: [{ baslik: 'Tek', satirlar: [{ ey: 'k', v: '1', ad: 'A' }] }] });
    expect(t).not.toContain('ve-bas-sekme');
    expect(t).toContain('<h2>Tek</h2>');
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
// hepsinin bir kaynağı var: analizin adı programın kendi adı, kapının künyesi
// sihirbazın adımları ve dosya seçicinin kabul listesi. Uydurulmuş bir analiz
// adı programda karşılığı olmayan bir vaat olurdu. Sayı bandı (Takoz tipi ·
// Kuvvet–sehim yasası · Gövde tipi · Örnek model · Serbestlik derecesi) YOK:
// kullanıcı 2026-11-05 (Canlı Not 5) *"Bu açıklamalara gerek yok. Kaldıralım."*
describe('KİMLİK VE VERİ — adlar programdan, künye kaynağından; sayı bandı yok', () => {
  const W = require('../../js/cp-mount-wizard.js');
  const n = (x) => veSayi(x, 0);
  // Kullanıcı 2026-11-05 (Canlı Not 4): "Yazılar sütunun en tepesine kadar
  // çıkmalı." Kimlik ikonsuz, kit masada ikon verilse de basmaz (sütun basar).
  // Analizlerin adı YOK (Canlı Not 19: *"alttaki açıklamalara da gerek yok"*).
  test('kimlik: modülün componentDefs adı; ikon yok, analizlerin adı yok', () => {
    const k = BS.veMntBaslangicKimlik();
    expect(k.ad).toBe(componentDefs['mount-analysis'].name);
    expect(k.ikon).toBeUndefined();
    expect(k.yetenekler).toBeUndefined();
    expect(BS.VE_MNT_BAS_YETENEK).toBeUndefined();
    expect(BS.veMntBaslangicHTML()).not.toContain('ve-bas-yetenek');
    const K = require('../../js/baslangic-sayfa.js');
    const kim = { ad: 'Modül', ikon: '<svg id="IKON"></svg>', yetenekler: ['Analiz'] };
    expect(K.veBasSayfaHTML({ kimlik: kim })).not.toContain('ve-bas-kimlik-ik');
    expect(K.veBasSayfaHTML({ duzen: 'sutun', kimlik: kim })).toContain('<span class="ve-bas-kimlik-ik" aria-hidden="true"><svg id="IKON"></svg></span>');
  });
  test('SAYI BANDI YOK — sayfada veri satırı yok, Kılavuz panelin dibinde', () => {
    expect(BS.veMntBaslangicSayfa().veriler).toBeUndefined();
    expect(BS.veMntBaslangicVeri).toBeUndefined();
    expect(BS.VE_MNT_BAS_SD).toBeUndefined();
    const d = document.createElement('div');
    d.innerHTML = BS.veMntBaslangicHTML();
    expect(d.querySelector('.ve-bas-veri')).toBeNull();
    expect(CSS).toMatch(/\.ve-bas-dip\{ margin-top:auto;/);
  });
  // Tarayıcıda sabit `window[ad]`dan okunur. `const`/`let` ile bildirilmiş
  // üst seviye ad pencereye yazılmaz; Node'da `require` yolu çalıştığı için
  // birim testi bunu görmezdi ve bant o satırı SESSİZCE düşürürdü.
  test('okunan her sabit tarayıcıda da var: üst seviye `var` ya da `function`', () => {
    const okunan = [...loadSource('cp-mount-baslangic.js').matchAll(/_mntBasG\('([A-Za-z_]+)', '\.\/([a-z0-9-]+\.js)'\)/g)];
    expect(okunan.length).toBeGreaterThanOrEqual(4);
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
// başlangıç sayfası" · 1; 2026-11-05 Canlı Not 6, tasarım tuvali "Takoz
// başlangıç ekranı seçenekleri" · 2): solda panel — kimlik · kapılar · ÖRNEKLER
// (sekmeli dizin) · altta dönüş ve Kılavuz; sağda masa — modülün SON
// DEĞİŞİKLİKLERİ. Satırın Yükle'si TEK TIKLA kurar; adı ayrıntıyı açar. Açık
// satır ve açık sekme görünüm durumu (modelde değil); açıp kapamak sayfayı
// yeniden basmaz.
describe('ÇALIŞMA MASASI — panel · masa', () => {
  const el = () => document.getElementById(BS.VE_MNT_BAS_ID);
  const K = require('../../js/baslangic-sayfa.js');
  const satir = (v) => el().querySelector('.ve-bas-satir[data-v="' + v + '"]');
  const acik = () => [...el().querySelectorAll('.ve-bas-satir')].filter((r) => r.classList.contains('acik')).map((r) => r.getAttribute('data-v'));
  beforeEach(() => K._veBasSifirla());
  test('panel: kimlik · kapılar · örnekler · dip (dönüş); masa: derlemenin künyesi yoksa boş', () => {
    const d = document.createElement('div');
    d.innerHTML = BS.veMntBaslangicHTML();
    const panel = d.querySelector('.ve-bas-ic.ve-bas-ic--masa > aside.ve-bas-panel');
    const masa = d.querySelector('.ve-bas-ic > .ve-bas-masa');
    expect([...panel.children].map((c) => c.className))
      .toEqual(['ve-bas-kimlik', 've-bas-kapilar', 've-bas-ornek', 've-bas-dip']);   // Kılavuz yüklü değil; sayı bandı yok
    expect([...panel.querySelectorAll('.ve-bas-dip > button')].map((b) => [b.className, b.getAttribute('data-ey'), b.textContent]))
      .toEqual([['ve-bas-donus', 'donus', 'Ana topoloji']]);
    expect(panel.querySelector('.ve-bas-donus').getAttribute('aria-label')).toBe('Ana topolojiye dön');
    expect(panel.querySelector('.ve-bas-donus .mf-ico-chevrons-left')).not.toBeNull();
    expect(d.querySelector('.ve-bas-dizin-bas, .ve-bas-baslik')).toBeNull();      // sütun başlıkları emekli
    expect(masa.children.length).toBe(0);                                          // künye yok → liste yok
  });
  // SON DEĞİŞİKLİKLER (Canlı Not 6, kullanıcı 2026-11-05: *"takoz çökme ve
  // titreşim modülü için yapılan güncellemeleri … sadece takoz çökme ve titreşim
  // özelinde"*): derlemenin künyesinden — Takoz'un dosyalarına dokunan birleşmeler.
  test('son değişiklikler: künyenin Takoz listesi — tarih · PR başlığı (dış metin) · numara', () => {
    const K = { moduller: { takoz: [
      { sha: 'aaaaaaa', prNumber: 1242, date: '2026-11-05T11:05:45+03:00', title: 'Canlı notlar 1–5 · 7: karşılama',
        ayrinti: [{ konu: 'Canlı not 1: cetvel kalktı', govde: ['Vurgu sol başta.', '- ikinci paragraf'] }, { konu: 'Canlı not 2', govde: [] }] },
      { sha: 'bbbbbbb', prNumber: 1239, date: '2026-11-04T18:00:15+03:00', title: 'Takoz başlangıç sayfası: örnek dizini' }] } };
    const g = BS.veMntBaslangicDegisiklik(K);
    expect(g.baslik).toBe('Son değişiklikler');
    expect(g.kayitlar.map((k) => [k.tarih, k.baslik, k.pr, k.ayrinti.length])).toEqual([
      ['05.11.2026', 'Canlı notlar 1–5 · 7: karşılama', 1242, 2], ['04.11.2026', 'Takoz başlangıç sayfası: örnek dizini', 1239, 0]]);
    expect(BS.veMntBaslangicDegisiklik({}).kayitlar).toEqual([]);
    const eski = global.window.__MFSIM_BUILD;
    global.window.__MFSIM_BUILD = K;
    try {
      const d = document.createElement('div');
      d.innerHTML = BS.veMntBaslangicHTML();
      const ol = d.querySelector('.ve-bas-masa > section.ve-bas-degisiklik > ol');
      expect(d.querySelector('.ve-bas-degisiklik h2').textContent).toBe('Son değişiklikler');
      const bas = (li) => [...li.querySelector('.ve-bas-degisiklik-bas').querySelectorAll('span:not(.mf-ico)')].map((c) => c.className + '=' + c.textContent);
      expect([...ol.children].map(bas)).toEqual([
        ['ve-bas-degisiklik-t=05.11.2026', 've-bas-degisiklik-ad=Canlı notlar 1–5 · 7: karşılama', 've-bas-degisiklik-pr=#1242'],
        ['ve-bas-degisiklik-t=04.11.2026', 've-bas-degisiklik-ad=Takoz başlangıç sayfası: örnek dizini', 've-bas-degisiklik-pr=#1239']]);
      ol.querySelectorAll('.ve-bas-degisiklik-ad').forEach((x) => expect(x.hasAttribute('data-ve-dis-metin')).toBe(true));
      // Canlı Not 23: ayrıntısı olan satır DÜĞME, kapalı; ayrıntısız satır düz
      const [ilk, ikinci] = ol.children;
      const b = ilk.querySelector('button.ve-bas-degisiklik-bas');
      expect([b.getAttribute('data-ey'), b.getAttribute('aria-expanded')]).toEqual(['degisiklik', 'false']);
      expect(ikinci.querySelector('button')).toBeNull();
      const ay = ilk.querySelector('.ve-bas-degisiklik-ayrinti');
      expect(ay.hidden).toBe(true);
      expect(ay.hasAttribute('data-ve-dis-metin')).toBe(true);
      expect([...ay.querySelectorAll(':scope > ol > li')].map((li) => [li.querySelector('b').textContent,
        [...li.querySelectorAll('.ve-bas-degisiklik-p')].map((x) => x.textContent)]))
        .toEqual([['Canlı not 1: cetvel kalktı', ['Vurgu sol başta.', '- ikinci paragraf']], ['Canlı not 2', []]]);
    } finally { if (eski === undefined) delete global.window.__MFSIM_BUILD; else global.window.__MFSIM_BUILD = eski; }
  });
  // Canlı Not 23 (kullanıcı 2026-11-05: "Son değişikliklere tıkladığım zaman detaylarını
  // okuyabilmem lazım … Tıklamıyor zaten."): tık satırı açar, ikinci tık kapatır;
  // sayfa yeniden basılmaz, eylem çağrılmaz, öteki satır etkilenmez.
  test('son değişikliğin satırı tıkla açılır, yeniden tıkla kapanır; sayfa yeniden basılmaz', () => {
    const K = { moduller: { takoz: [
      { prNumber: 2, date: '2026-11-05T10:00:00Z', title: 'İki', ayrinti: [{ konu: 'a', govde: ['x'] }] },
      { prNumber: 1, date: '2026-11-04T10:00:00Z', title: 'Bir', ayrinti: [{ konu: 'b', govde: [] }] }] } };
    const eski = global.window.__MFSIM_BUILD;
    global.window.__MFSIM_BUILD = K;
    try {
      BS.veMntBaslangicKapsam('mount-analysis');
      const sayfa = document.getElementById(BS.VE_MNT_BAS_ID);
      const li = () => [...sayfa.querySelectorAll('.ve-bas-degisiklik-s')];
      const [l0, l1] = li();
      casus('veMntOrnekYukle', () => true, (f) => {
        l0.querySelector('.ve-bas-degisiklik-bas').click();
        expect(l0.classList.contains('acik')).toBe(true);
        expect(l0.querySelector('.ve-bas-degisiklik-bas').getAttribute('aria-expanded')).toBe('true');
        expect(l0.querySelector('.ve-bas-degisiklik-ayrinti').hidden).toBe(false);
        expect(l1.querySelector('.ve-bas-degisiklik-ayrinti').hidden).toBe(true);
        expect(li()[0]).toBe(l0);                                   // yeniden basılmadı
        l1.querySelector('.ve-bas-degisiklik-bas').click();          // ikisi birden açık kalabilir
        expect(li().filter((x) => x.classList.contains('acik')).length).toBe(2);
        l0.querySelector('.ve-bas-degisiklik-bas').click();
        expect(l0.querySelector('.ve-bas-degisiklik-ayrinti').hidden).toBe(true);
        expect(f).not.toHaveBeenCalled();
      });
      expect(global.nodes).toEqual([]);
    } finally { if (eski === undefined) delete global.window.__MFSIM_BUILD; else global.window.__MFSIM_BUILD = eski; }
  });
  // Canlı Not 27 (kullanıcı 2026-11-05: "Her son değişikliği görselli olarak görmek
  // istiyorum" → "Olur uygula. Elinde olan görüntüleri eklersin."): commit'in notunun
  // sonuç görüntüsü ayrıntıda konunun altında; not birleşmede bir kez (ilk commit'inde),
  // boyu en çok 360 px; görseli olmayan not görselsiz.
  test('son değişikliğin görseli: notun sonuç görüntüsü konunun altında, bir kez, boyu sınırlı', () => {
    const K = { moduller: { takoz: [
      { prNumber: 3, date: '2026-11-05T10:00:00Z', title: 'Üç', ayrinti: [
        { konu: 'Canlı not 22: palet', govde: ['p'], notlar: [22] },
        { konu: 'Canlı not 9 · 19: iki', govde: [], notlar: [9, 19] },
        { konu: 'Canlı not 22: test', govde: [], notlar: [22] },
        { konu: 'Ölçüm Görüntüleyici yeniden üretildi', govde: [], notlar: [] }] }] } };
    const R = { 22: { src: 'data:image/webp;base64,AAAA', g: 560, y: 350 }, 19: { src: 'data:image/webp;base64,BBBB', g: 341, y: 818 } };
    const a = BS.veMntBaslangicDegisiklik(K, R).kayitlar[0].ayrinti;
    expect(a.map((x) => x.resimler.map((r) => [r.no, r.g, r.y]))).toEqual([
      [[22, 560, 350]], [[19, 150, 360]], [], []]);                    // 22 bir kez; 9'un görseli yok; 19 boyu 360'a
    expect(BS.veMntBaslangicDegisiklik(K, {}).kayitlar[0].ayrinti.every((x) => x.resimler.length === 0)).toBe(true);
    const d = document.createElement('div');
    d.innerHTML = require('../../js/baslangic-sayfa.js').veBasDegisiklikHTML(BS.veMntBaslangicDegisiklik(K, R));
    const li = [...d.querySelectorAll('.ve-bas-degisiklik-ayrinti > ol > li')];
    const img = li[0].querySelector('img.ve-bas-degisiklik-resim');
    expect([img.getAttribute('src'), img.getAttribute('width'), img.getAttribute('height'), img.alt, img.getAttribute('loading')])
      .toEqual(['data:image/webp;base64,AAAA', '560', '350', 'Not 22 sonucu', 'lazy']);
    expect(img.previousElementSibling.className).toBe('ve-bas-degisiklik-p');      // paragrafların altında
    expect(li.map((x) => x.querySelectorAll('img').length)).toEqual([1, 1, 0, 0]);
    // görsel sütundan taşmaz, köşe keskin, gölge yok
    const css = require('fs').readFileSync(require('path').join(__dirname, '../../css/styles.css'), 'utf8');
    const k = css.slice(css.indexOf('\n.ve-bas-degisiklik-resim{') + 1).split('}')[0];
    expect(k).toMatch(/max-width:100%; height:auto/);
    expect(k).not.toMatch(/border-radius|box-shadow/);
  });
  test('derlemenin listesi: birleşme Takoz\'un dosyasına dokunuyorsa girer', () => {
    const V = require('../../tools/version-info.js');
    const D = V.MODUL_DESEN.takoz;
    ['js/cp-mount.js', 'js/cp-mount-3b-menu.js', 'js/mount-core.js', 'js/guide-mount.js'].forEach((f) => expect(D.test(f)).toBe(true));
    ['js/cp-fead.js', 'css/styles.css', 'tests/unit/mount-core.test.js', 'js/components.js'].forEach((f) => expect(D.test(f)).toBe(false));
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
      satir('asfat').querySelector('.ve-bas-satir-yukle').click();    // kapalı satırın Yükle'si de kurar
      expect(f).toHaveBeenCalledTimes(1);
      expect(f).toHaveBeenCalledWith('asfat');
      r.querySelector('.ve-bas-satir-ac').click();                    // aynı ad kapatır
      expect(acik()).toEqual([]);
    });
  });
  // SEKME (Canlı Not 6): yalnız örneklerin bölümü yeniden basılır — kimlik ve
  // kapılar yerinde; açık sekme görünüm durumu, sayfa yeniden açılınca yerinde.
  test('sekme: Kurgu satırları gelir, kapılar yerinde; açık sekme görünüm durumu', () => {
    BS.veMntBaslangicKapsam('mount-analysis');
    const kapi = el().querySelector('.ve-bas-kapi');
    const sek = (i) => el().querySelectorAll('.ve-bas-sekme')[i];
    const satirlar = () => [...el().querySelectorAll('.ve-bas-satir')].map((r) => r.getAttribute('data-v'));
    expect(satirlar()).toEqual(['siper', 'tulga', 'asfat']);
    sek(1).click();
    expect(satirlar()).toEqual(['kutu', 'hafif', 'kamyon']);
    expect(sek(1).getAttribute('aria-selected')).toBe('true');
    expect(sek(0).getAttribute('aria-selected')).toBe('false');
    expect(el().querySelector('.ve-bas-kapi')).toBe(kapi);           // kimlik ve kapılar yeniden BASILMADI
    expect(document.activeElement).toBe(sek(1));
    casus('veMntOrnekYukle', () => true, (f) => {
      satir('kamyon').querySelector('.ve-bas-satir-yukle').click();
      expect(f).toHaveBeenCalledWith('kamyon');
    });
    expect(global.nodes).toEqual([]);
    expect(stubs.saveState).not.toHaveBeenCalled();
    global.nodes = [dugum('mnt-motor')];
    BS.veMntBaslangicTazele();
    global.nodes = [];
    BS.veMntBaslangicTazele();
    expect(satirlar()).toEqual(['kutu', 'hafif', 'kamyon']);
    expect(acik()).toEqual([]);                                       // açık satır (siper) öteki sekmede
    sek(0).click();
    expect(acik()).toEqual(['siper']);
  });
  // DÖNÜŞ (Canlı Not 19, kullanıcı 2026-11-05: *"Geri butonunu alt taraflara uygun
  // bir yere taşıyalım"*): panelin altında; köşedeki düğmenin işi (veMntCloseEditor).
  test('dönüş: panelin altındaki düğme ana topolojiye döner', () => {
    BS.veMntBaslangicKapsam('mount-analysis');
    casus('veMntCloseEditor', () => {}, (f) => {
      el().querySelector('.ve-bas-dip .ve-bas-donus').click();
      expect(f).toHaveBeenCalledTimes(1);
      expect(f).toHaveBeenCalledWith();
    });
    expect(BS.veMntBaslangicEylem('donus')).toBe(false);             // işlev yoksa sessiz
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
  // Dönüşü panelin altında taşıyan sayfa açıkken köşedeki dönüş düğmesi gizli
  // (Canlı Not 19); öteki sayfada (Sonuçlar) köşe yine dönüş yolu.
  test('dönüşü taşıyan sayfa açıkken kabın sınıfı; CSS köşedeki düğmeyi gizler', () => {
    document.body.innerHTML = '<div id="sayfa2-content"><div id="ve-canvas-wrapper"><div id="ve-canvas"></div></div></div>';
    const kab = document.getElementById('sayfa2-content');
    BS.veMntBaslangicKapsam('mount-analysis');
    expect(document.getElementById(BS.VE_MNT_BAS_ID).getAttribute('data-donus')).toBe('1');
    expect(kab.classList.contains('ve-bas-donus-acik')).toBe(true);
    global.nodes = [dugum('mnt-solver')];
    BS.veMntBaslangicTazele();
    expect(kab.classList.contains('ve-bas-donus-acik')).toBe(false);
    expect(CSS).toMatch(/html:not\(\.ve-sayfa-diger\) #sayfa2-content\.ve-bas-donus-acik \.ve-arac-breadcrumb\{ display:none; \}/);
  });
  // Kullanıcı 2026-11-04: "iki sembol var. Onları kaldıralım. Sadece geriye
  // gelme kalsın … Arada çirkin bir boşluk var." Paletin açma sekmesi sayfa
  // açıkken gizli (satır içi display'i JS yazar — kural !important). Kullanıcı
  // 2026-11-05 (Canlı Not 4): "Yazılar sütunun en tepesine kadar çıkmalı."
  // Dönüş panelin altında (Canlı Not 19): başlık sütunun tepesinde, girintisiz.
  test('CSS: paletin açma sekmesi sayfa açıkken gizli; başlık sütunun tepesinde, girintisiz', () => {
    expect(CSS).toMatch(/html:not\(\.ve-sayfa-diger\) #sayfa2-content\.ve-bas-acik \.ve-sidebar-reveal\{ display:none !important; \}/);
    // Paletin kendisi de (Canlı Not 22: "Seçeneklerden kararımızı verdikten sonra ilerlememiz gerekiyor")
    expect(CSS).toMatch(/html:not\(\.ve-sayfa-diger\) #sayfa2-content\.ve-bas-acik \.ve-sidebar,\n/);
    expect(CSS).toMatch(/\.ve-bas-panel\{[^}]*padding:18px 20px 16px;/);
    expect(CSS).not.toMatch(/\.ve-bas-kimlik h1\{ padding-left/);
    expect(CSS).not.toMatch(/\.ve-bas-panel\{[^}]*padding:48px/);
    expect(CSS).not.toMatch(/\.ve-bas-panel\{[^}]*padding-top:84px/);
    expect(CSS).not.toMatch(/ve-sidebar-reveal\.visible\) \.ve-bas-panel/);
    expect(CSS).not.toMatch(/\.ve-bas-ic--masa \.ve-bas-kimlik-ik/);
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
