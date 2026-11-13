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
  test('yalnız Başlangıç Sihirbazı bileşenini taşıyan topoloji BOŞ sayılır', () => {
    // Sihirbazı açan düğüm bir model değildir; kalkan "Başlangıç ve Örnekler" bileşeni
    // (mnt-example) açılışta tanımsız tip olarak düşer (Canlı Not 110).
    expect(componentDefs['mnt-wizard'].isMountWizard).toBe(true);
    expect(componentDefs['mnt-example']).toBeUndefined();
    expect(BS.veMntBaslangicGerekli([dugum('mnt-wizard')])).toBe(true);
  });
  test('araç düğümü de bir yol seçildi demektir (Boş kanvas onu kurar)', () => {
    expect(BS.veMntBaslangicGerekli([dugum('mnt-solver')])).toBe(false);
    expect(BS.veMntBaslangicGerekli([dugum('mnt-wizard'), dugum('mnt-motor')])).toBe(false);
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
  // satırda ipucu yalnız künyede — iki satırda kısalan metnin TAMAMI.
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
    expect(d.querySelectorAll('.ve-bas-kapi-k')).toHaveLength(0);                // kapıda künye yok (Canlı Not 84)
    // Künye ve bandın adları VERİ: kısa ad, cümle noktalaması yok (uzantı dışında).
    const kisa = (t) => { expect(t).toMatch(/^(\.[a-z0-9]+|[^.!?:;…]+)$/); expect(t.split(/\s+/).length).toBeLessThanOrEqual(4); };
    d.querySelectorAll('.ve-bas-kapi-k > span').forEach((k) => kisa(k.textContent));
    d.querySelectorAll('.ve-bas-veri dt, .ve-bas-yetenek li').forEach((x) => kisa(x.textContent));
    d.querySelectorAll('.ve-bas-dizin [title]').forEach((x) => {
      expect(x.classList.contains('ve-bas-satir-kunye')).toBe(true);
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
    expect(sekme(bas())).toEqual(sekme(bas(0)));                 // varsayılan: açık satır yok → ilk sekme
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
      const aski = (ex.model.askilar || []).length;                     // askı yayı varsa sayısı (10 Ton TTA askılı)
      expect([r.v, r.ad, r.sayi, r.kutle]).toEqual([ex.id, ex.vehicle,
        n(ex.model.components.length) + ' gövde · ' + n(ex.model.mounts.length) + ' takoz' + (aski ? ' · ' + n(aski) + ' askı' : ''), n(top) + ' kg']);
    });
  });
  test('ayrıntı: gövdeler kütleleriyle (tek ondalık), takozların adı', () => {
    satirlar().forEach((r) => {
      const ex = core.getMountExample(r.v);
      expect(r.detay.map((d) => d.baslik)).toEqual(['Gövdeler', 'Takozlar'].concat((ex.model.askilar || []).length ? ['Askı yayları'] : []));
      const kodsuz = (x) => x.replace(/\s*[·—–-]?\s*\b\d{2}[A-Z]{2}\d{6}\b/g, '').trim();   // Canlı Not 29: parça numarası düşer
      expect(r.detay[0].ogeler).toEqual(ex.model.components.map((c) => ({ ad: kodsuz(c.name), deger: n(c.mass, 1) + ' kg' })));
      expect(r.detay[1].ogeler).toEqual(ex.model.mounts.map((m) => ({ ad: kodsuz(m.name) })));
    });
  });
  // KÜNYE (kullanıcı 2026-11-05, Canlı Not 28: "'Catia Atalet Ölçümü' gibi gereksiz
  // şeyler yazmayalım" · Canlı Not 29: "'BMC-ASR-SR' falan yazıyor. Kaldır bunları.").
  // Önce: satır kaynağı yazıyordu (CATIA atalet ölçümü · ADAMS doğrulaması · TULGA
  // proje kaydı · BMC ASR-SR-116 · 04.08.2021). Şimdi güç grubunun künyesi, kurgu
  // örneklerin biçiminde (motor · aktarma · askı); sayılar modelden; parça numarası düşer.
  test('künye: güç grubu (motor · aktarma · askı), modelden; kaynak, rapor kodu ve parça numarası yok', () => {
    const S = satirlar(), k = Object.fromEntries(S.map((r) => [r.v, r.kunye]));
    expect(k.siper).toBe('6 silindir · 3.000 N·m · cradle askı');
    expect(k.tulga).toBe('4 silindir · 760 N·m · transfer kutusu');
    expect(k.asfat).toBe('Cummins 6 silindir · Allison 4700 + retarder · 2 PTO');
    const ex = Object.fromEntries(core.getMountExampleList().map((e) => [e.id, e]));
    // iddialar modelle tutarlı
    ['siper', 'tulga'].forEach((id) => {
      const T = ex[id].model.torque;
      expect(k[id].startsWith(T.cylinders + ' silindir · ' + veSayi(T.Te) + ' N·m')).toBe(true);
    });
    const ad = ex.asfat.model.components.map((c) => c.name);
    expect(ad.some((a) => /Cummins/.test(a)) && ad.some((a) => /Allison 4700/.test(a) && /Retarder/.test(a))).toBe(true);
    expect(ad.filter((a) => /PTO/.test(a)).length).toBe(2);
    expect((ex.asfat.specs.find((x) => /^Rölanti/.test(x[0])) || [])[1]).toMatch(/· 6 →/);
    // kaynak, rapor kodu, parça numarası satırın hiçbir yerinde yok; ASFAT'ın Kaynak satırı kalktı
    const kod = /Kaynak|CATIA|ADAMS|ASR-SR|proje kaydı|\b\d{2}[A-Z]{2}\d{6}\b/;
    S.forEach((r) => {
      expect([r.v, r.kunye]).toEqual([r.v, expect.not.stringMatching(kod)]);
      r.detay.forEach((b) => b.ogeler.forEach((o) => expect(o.ad).not.toMatch(kod)));
    });
    expect(ex.asfat.specs.some((x) => x[0] === 'Kaynak' || /ASR-SR/.test(x[1]))).toBe(false);
    expect(ex.asfat.model.mounts.map((m) => m.name)[0]).toMatch(/57RS313774/);          // model adı yerinde
    expect(S.find((r) => r.v === 'asfat').detay[1].ogeler.map((o) => o.ad).slice(0, 2)).toEqual(['Ön Sol', 'Ön Sağ']);
    expect(S.find((r) => r.v === 'asfat').detay[0].ogeler[0].ad).toBe('Motor — Cummins');
    // kurgu örneklerin künyesi aynı kalır
    expect([k.kutu, k.hafif, k.kamyon]).toEqual(['Kapalı form kıyas modeli', '2,2 L dizel · 6 ileri manuel · 3 noktalı askı',
      '7,7 L dizel · 6 ileri manuel · nonlineer takoz']);
  });
  test('resim YOK: kapılarda ve örneklerin dizininde çizim, resim kutusu ve karo yok; görsel yalnız son değişikliğin ayrıntısında', () => {
    const h = BS.veMntBaslangicHTML();
    expect(h).not.toMatch(/ve-mnt2d-akso|ve-bas-resim|ve-bas-karo|ve-bas-oniz|<svg class="ve-ak/);
    const eski = [global.window.__MFSIM_BUILD, global.window.__MFSIM_DEGISIKLIK];
    global.window.__MFSIM_BUILD = { moduller: { takoz: [{ prNumber: 1, date: '2026-11-05T10:00:00Z', title: 'Bir',
      ayrinti: [{ konu: 'Canlı not 22: palet', govde: [], notlar: [22] }] }] } };
    global.window.__MFSIM_DEGISIKLIK = { 22: { src: 'data:image/webp;base64,AAAA', g: 560, y: 350 } };
    try {
      const d = document.createElement('div');
      d.innerHTML = BS.veMntBaslangicHTML();
      const img = [...d.querySelectorAll('img')];
      expect(img.length).toBe(1);
      expect(img.every((x) => !!x.closest('.ve-bas-degisiklik-ayrinti'))).toBe(true);
    } finally {
      ['__MFSIM_BUILD', '__MFSIM_DEGISIKLIK'].forEach((k, i) => { if (eski[i] === undefined) delete global.window[k]; else global.window[k] = eski[i]; });
    }
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
    expect(okunan.length).toBeGreaterThanOrEqual(3);          // sihirbazın adımları kapıda okunmuyor (Canlı Not 84)
    okunan.forEach(([, ad, dosya]) => {
      expect(loadSource(dosya)).toMatch(new RegExp('^(var|function) ' + ad + '\\b', 'm'));
    });
  });
  // KAPIDA KÜNYE YOK (kullanıcı 2026-11-09, Canlı Not 84: "Gereksiz açıklamaları kaldıralım."):
  // önce adın altında sihirbazın adımları (4), STEP'in biçimi (5) ve "6 araç" yazıyordu.
  test('KAPIDA KÜNYE YOK: kapı simge ve ad; boş kanvasın araçları yalnız title\'da', () => {
    const K = BS.veMntBaslangicKapilar();
    expect(K.map((k) => [k.ey, k.ad, k.kunye])).toEqual([['sihirbaz', 'Sihirbazla kur', undefined],
      ['step', 'STEP\'ten başla', undefined], ['bos', 'Boş kanvas', undefined]]);
    expect(K[2].title).toBe(cp.VE_MNT_ARAC_TIPLERI.map((t) => componentDefs[t].name).join(' · '));
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

// Canlı Not 38 (kullanıcı 2026-11-05): *"Örnek yüklediğim zaman hala
// 'bileşenler' sütunu açık geliyor. Kapalı gelsin"*. SIRA kapıdır: sütun
// GEÇİŞSİZ ve SIĞDIRMADAN ÖNCE daralır — sonra daralsaydı kadraj 220 px dar
// tuvalde kurulur, model sola kayık kalırdı. Gerçek kadraj
// tests/e2e/mount-baslangic.spec.js → ÖRNEK SATIRI.
describe('ÖRNEK — Bileşenler sütunu kapalı gelir', () => {
  const ornek = core.getMountExample('tulga');
  const json = JSON.parse(fs.readFileSync(path.join(__dirname, '../..', ornek.topology), 'utf8'));
  let iz;
  const sb = () => document.getElementById('ve-sidebar');
  beforeEach(() => {
    document.body.innerHTML = '<aside id="ve-sidebar" class="ve-sidebar"></aside>'
      + '<div id="ve-canvas-wrapper"><div id="ve-canvas"></div></div>';
    window.__MNT_TOPOLOGIES = { [ornek.topology]: json };
    iz = [];
  });
  afterEach(() => { delete window.__MNT_TOPOLOGIES; });
  // Başlangıç sayfasının Yükle'si → modülün kurucusu; daraltma ve sığdırma izlenir.
  const yukle = (anahtar) => casus('veMntOrnekYukle', cp.veMntOrnekYukle, () =>
    casus('veToggleSidebar', (f) => {
      iz.push(['daralt', f, sb().classList.contains('ve-sb-no-anim')]);
      sb().classList.toggle('ve-sb-collapsed', f);
    }, () => casus('veFitViewToContent', () => {
      iz.push(['sigdir', sb().classList.contains('ve-sb-collapsed')]);
    }, () => casus('veLoadTabState', (o) => { global.nodes = o.state.nodes; },
      () => BS.veMntBaslangicEylem('ornek', anahtar)))));

  test('Yükle → sütun geçişsiz daralır, kadraj daralmış tuvalde kurulur', () => {
    expect(yukle('tulga')).toBe(true);
    expect(global.nodes.some((n) => n.type === 'mnt-mount')).toBe(true);
    expect(iz).toEqual([['daralt', true, true], ['sigdir', true]]);
    expect(sb().className).toBe('ve-sidebar ve-sb-collapsed');   // geçiş sınıfı geri alındı
  });
  test('sütun zaten kapalıysa yeniden daraltılmaz', () => {
    sb().classList.add('ve-sb-collapsed');
    yukle('tulga');
    expect(iz).toEqual([['sigdir', true]]);
  });
  test('vazgeçilen ya da yüklenemeyen örnek sütunu daraltmaz', () => {
    global.nodes = [dugum('mnt-motor')];
    casus('confirm', () => false, () => yukle('tulga'));
    expect(iz).toEqual([]);
    global.nodes = [];
    window.__MNT_TOPOLOGIES = { [ornek.topology]: { nodes: [] } };
    yukle('tulga');
    expect(iz).toEqual([]);
    expect(sb().classList.contains('ve-sb-collapsed')).toBe(false);
  });
});

// Canlı Not 62 (kullanıcı 2026-11-06): *"Hala takoz çökme ve titreşim modülünü
// açtığımda, solda bileşenler penceresi otomatik açık olarak geliyor. Gelmesin dedik
// ya"*. Önce yalnız örnek yüklenince kapanıyordu (Canlı Not 38): Boş kanvas, STEP ve
// sihirbaz sütunu tercihe göre açık bırakıyordu. Gerçek tarayıcı:
// tests/e2e/mount-baslangic.spec.js → BOŞ KANVAS.
describe('TAKOZ\'A GİRİŞ — Bileşenler sütunu kapalı açılır, tercih yazılmaz', () => {
  const sb = () => document.getElementById('ve-sidebar');
  const ANAHTAR = 'mf-sidebar-collapsed';
  let iz;
  beforeEach(() => {
    document.body.innerHTML = '<aside id="ve-sidebar" class="ve-sidebar"></aside>';
    BS._mntBasSifirla(); cp._mntPaletSifirla();
    global.veMntPaletKapat = cp.veMntPaletKapat; global.veMntPaletGeriAc = cp.veMntPaletGeriAc;
    iz = [];
    // gerçeğinin aynısı (js/results.js): sınıfı çevirir, tercihi yazar
    global.veToggleSidebar = (f) => {
      const c = typeof f === 'boolean' ? f : !sb().classList.contains('ve-sb-collapsed');
      iz.push([c, sb().classList.contains('ve-sb-no-anim')]);
      sb().classList.toggle('ve-sb-collapsed', c);
      localStorage.setItem(ANAHTAR, c ? '1' : '0');
    };
  });
  afterEach(() => { delete global.veToggleSidebar; delete global.veMntPaletKapat; delete global.veMntPaletGeriAc; localStorage.removeItem(ANAHTAR); });
  test('girişte geçişsiz daralır, tercih yazılmaz; çıkışta tercih geri gelir', () => {
    localStorage.setItem(ANAHTAR, '0');
    BS.veMntBaslangicKapsam('mount-analysis');
    expect(sb().className).toBe('ve-sidebar ve-sb-collapsed');
    expect(iz).toEqual([[true, true]]);
    expect(localStorage.getItem(ANAHTAR)).toBe('0');                 // Araç Performans'ın tercihi
    BS.veMntBaslangicKapsam('mount-analysis');                        // kapsam tazelemesi: yeniden değil
    expect(iz.length).toBe(1);
    BS.veMntBaslangicKapsam('top');
    expect(sb().classList.contains('ve-sb-collapsed')).toBe(false);
    expect(localStorage.getItem(ANAHTAR)).toBe('0');
  });
  test('tercih yoksa da yazılmaz; tercih kapalıysa çıkışta kapalı kalır', () => {
    BS.veMntBaslangicKapsam('mount-analysis');
    expect(localStorage.getItem(ANAHTAR)).toBe(null);
    BS.veMntBaslangicKapsam('top');
    expect(sb().classList.contains('ve-sb-collapsed')).toBe(false);
    localStorage.setItem(ANAHTAR, '1'); sb().classList.add('ve-sb-collapsed'); iz = [];
    BS.veMntBaslangicKapsam('mount-analysis');
    BS.veMntBaslangicKapsam('top');
    expect(iz).toEqual([]);
    expect(sb().classList.contains('ve-sb-collapsed')).toBe(true);
  });
  test('kullanıcı Takoz\'da açarsa açık kalır ve tercih yazılır; çıkış dokunmaz', () => {
    localStorage.setItem(ANAHTAR, '0');
    BS.veMntBaslangicKapsam('mount-analysis');
    global.veToggleSidebar(false);                                     // açma düğmesi
    expect(localStorage.getItem(ANAHTAR)).toBe('0');
    iz = [];
    BS.veMntBaslangicKapsam('top');
    expect(iz).toEqual([]);
    expect(sb().classList.contains('ve-sb-collapsed')).toBe(false);
  });
  test('bağlantı: modülün açılışı kadrajı kurmadan önce daraltır', () => {
    const k = fs.readFileSync(path.join(__dirname, '../../js/cp-mount.js'), 'utf8');
    const ac = k.slice(k.indexOf('function veMntOpenEditor('), k.indexOf('function veMntCloseEditor('));
    expect(ac.indexOf('veMntPaletKapat();')).toBeGreaterThan(0);
    expect(ac.indexOf('veMntPaletKapat();')).toBeLessThan(ac.indexOf('veLoadTabState('));
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
  // KAPI KOMPAKT (kullanıcı 2026-11-10, Canlı Not 102: *"Şu butonlar da çok büyük.
  // Bunları da küçültelim."* → 62 → 40 px; Canlı Not 115: *"bir tık büyültelim"* →
  // 48 px): masanın panelinde kapı 48 px, ikon 28 px, ad 14 px; sütun düzeninin (FEAD)
  // kapısına dokunulmaz.
  test('KAPI KOMPAKT — masada kapı 48 px, ikon 28 px, ad 14 px; sütun düzeninin kapısı değişmez', () => {
    // Kural satırın başında aranır: ".ve-bas-kapi-ik" masanın ".ve-bas-ic--masa .ve-bas-kapi-ik"ine takılmasın.
    const kural = (sel) => (CSS.match(new RegExp('(?:^|\\n)' + sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{([^}]*)\\}')) || [])[1] || '';
    expect(kural('.ve-bas-ic--masa .ve-bas-kapi')).toMatch(/min-height:\s*48px/);
    expect(kural('.ve-bas-ic--masa .ve-bas-kapi-ik')).toMatch(/width:\s*28px[^}]*height:\s*28px/);
    expect(kural('.ve-bas-ic--masa .ve-bas-kapi-t b')).toMatch(/font-size:\s*var\(--fs-lg\)/);
    // Sütun düzeni (FEAD) taban kuralında: 64 px kapı, 36 px ikon.
    expect(kural('.ve-bas-kapi')).toMatch(/min-height:\s*64px/);
    expect(kural('.ve-bas-kapi-ik')).toMatch(/width:\s*36px[^}]*height:\s*36px/);
  });
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
    expect(img.parentElement.matches('button.ve-bas-degisiklik-resim-b[data-ey="resim"]')).toBe(true);   // Canlı Not 53
    expect(img.parentElement.previousElementSibling.className).toBe('ve-bas-degisiklik-p');      // paragrafların altında
    expect(li.map((x) => x.querySelectorAll('img').length)).toEqual([1, 1, 0, 0]);
    // görsel sütundan taşmaz, köşe keskin, gölge yok
    const css = require('fs').readFileSync(require('path').join(__dirname, '../../css/styles.css'), 'utf8');
    const k = css.slice(css.indexOf('\n.ve-bas-degisiklik-resim{') + 1).split('}')[0];
    expect(k).toMatch(/max-width:100%; height:auto/);
    expect(k).not.toMatch(/border-radius|box-shadow/);
  });
  // Canlı Not 53 (kullanıcı 2026-11-06: "Resimlere tıklanınca büyütülebilmesini istiyorum."):
  // küçük görsel düğme; tık pencere ailesinin penceresinde dosyanın ölçüsünde açar (küçük
  // görsel 560 × 350, pencerede 1120 × 700). Kapatan Esc · ✕ · perde; odak küçük görsele döner.
  test('GÖRSELİN BÜYÜĞÜ: tık pencerede açar, dosyanın ölçüsünde; Esc · ✕ · perde kapatır, odak geri döner', () => {
    const BSK = require('../../js/baslangic-sayfa.js');
    const K = { moduller: { takoz: [{ prNumber: 3, date: '2026-11-05T10:00:00Z', title: 'Üç', ayrinti: [
      { konu: 'Canlı not 22: palet', govde: ['p'], notlar: [22] }] }] } };
    const R = { 22: { src: 'data:image/webp;base64,AAAA', g: 560, y: 350 } };
    const kap = document.createElement('div');
    kap.innerHTML = BSK.veBasDegisiklikHTML(BS.veMntBaslangicDegisiklik(K, R));
    document.body.appendChild(kap);
    try {
      const b = kap.querySelector('.ve-bas-degisiklik-resim-b');
      expect(b.tagName).toBe('BUTTON');
      expect(BSK.veBasResimAc(b)).toBe(true);
      const perde = document.getElementById('ve-bas-buyuk-perde');
      expect(perde).not.toBeNull();
      const pen = perde.querySelector('.ve-bas-buyuk-pencere[role="dialog"][aria-modal="true"]');
      expect(pen.querySelector('.ve-settings-header .mf-ico-image')).not.toBeNull();
      expect(pen.querySelector('#ve-bas-buyuk-baslik').textContent).toBe('Not 22 sonucu');
      const kapat = pen.querySelector('.ve-settings-close');
      expect([kapat.getAttribute('aria-label'), kapat.querySelector('.mf-ico-x') !== null]).toEqual(['Kapat', true]);
      const im = pen.querySelector('.ve-bas-buyuk-govde img');
      expect([im.getAttribute('src'), im.getAttribute('width'), im.getAttribute('height')]).toEqual(['data:image/webp;base64,AAAA', '1120', '700']);
      expect(pen.hasAttribute('data-azami')).toBe(false);   // üst sınır yok (teknik resmin sınırı onun çağıranında — Canlı Not 154)
      expect(document.activeElement).toBe(kapat);
      // Esc yalnız pencereyi kapatır (yakalama evresinde, alttaki katman görmez)
      const alt = jest.fn();
      document.addEventListener('keydown', alt);
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      document.removeEventListener('keydown', alt);
      expect(document.getElementById('ve-bas-buyuk-perde')).toBeNull();
      expect(document.activeElement).toBe(b);
      // ✕ ve perdeye basmak da kapatır; pencerenin içine basmak kapatmaz
      BSK.veBasResimAc(b);
      document.querySelector('#ve-bas-buyuk-perde .ve-settings-close').click();
      expect(document.getElementById('ve-bas-buyuk-perde')).toBeNull();
      BSK.veBasResimAc(b);
      const p2 = document.getElementById('ve-bas-buyuk-perde');
      p2.querySelector('img').dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      expect(document.getElementById('ve-bas-buyuk-perde')).not.toBeNull();
      p2.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      expect(document.getElementById('ve-bas-buyuk-perde')).toBeNull();
      // ikinci açılış birincisinin yerine geçer: tek pencere
      BSK.veBasResimAc(b); BSK.veBasResimAc(b);
      expect(document.querySelectorAll('#ve-bas-buyuk-perde').length).toBe(1);
      BSK.veBasResimKapat();
    } finally { kap.remove(); }
    const css = fs.readFileSync(path.join(__dirname, '../../css/styles.css'), 'utf8');
    const kural = (sec) => { const i = css.indexOf('\n' + sec + '{'); return i < 0 ? '' : css.slice(i + 1, css.indexOf('}', i)).replace(/\s+/g, ' '); };
    expect(kural('.ve-bas-degisiklik-resim-b')).toMatch(/cursor:zoom-in/);
    expect(kural('.ve-bas-buyuk-perde')).toMatch(/position:fixed; inset:0; .*background:var\(--scrim\)/);
    expect(kural('.ve-bas-buyuk-pencere')).toMatch(/border-radius:var\(--radius-lg\); box-shadow:var\(--shadow-xl\)/);
    expect(kural('.ve-bas-buyuk-govde img')).toMatch(/width:auto; height:auto;.*max-width:calc\(100vw - 74px\); max-height:calc\(100vh - 74px - var\(--bant-h\)\)/);
  });
  // Canlı Not 34 ("pencerenin soluna yaslanmış gibi. Ortalayalım mı?") · 35 ("yazı mı,
  // başlık mı belli olmuyor"): bölüm masada ortada; satırın başlığı bir boy büyük, kalın,
  // başlık renginde — ayrıntının paragrafı soluk.
  test('son değişiklikler masada ortada; satırın başlığı başlık gibi', () => {
    const css = fs.readFileSync(path.join(__dirname, '../../css/styles.css'), 'utf8');
    const kural = (sec) => { const i = css.indexOf('\n' + sec + '{'); return i < 0 ? '' : css.slice(i + 1, css.indexOf('}', i)); };
    expect(kural('.ve-bas-degisiklik')).toMatch(/max-width:760px; margin:0 auto/);
    expect(kural('.ve-bas-degisiklik-ad')).toMatch(/font-size:var\(--fs-md\); font-weight:600;.*color:var\(--text-heading\)/);
    expect(kural('.ve-bas-degisiklik-p')).toMatch(/color:var\(--text-secondary\)/);
  });
  // Kullanıcı 2026-11-06 (Canlı Not 47): "Değişikliklerde aşağıya inerken, sol taraftaki
  // sütundaki yazılar … tepede kalıyor. Aşağıya indikçe solda sabit olarak gelsin." Önce:
  // panel masayla birlikte uzuyordu, 600 px kaydırınca kimlik −582 px'teydi (ekran dışı).
  test('PANEL YERİNDE: yan yana düzende panel görünen yükseklik kadar ve tepeye yapışık; dar tuvalde değil', () => {
    const css = fs.readFileSync(path.join(__dirname, '../../css/styles.css'), 'utf8');
    const kural = (sec) => { const i = css.indexOf('\n' + sec + '{'); return i < 0 ? '' : css.slice(i + 1, css.indexOf('}', i)); };
    expect(kural('.ve-bas')).toMatch(/container:vebas \/ size;/);
    const i = css.indexOf('@container vebas (min-width: 900px){');
    expect(i).toBeGreaterThan(0);
    expect(css.slice(i, css.indexOf('}', i))).toMatch(/\.ve-bas-ic--masa > \.ve-bas-panel\{ position:sticky; top:0; height:100cqh; overflow-y:auto;/);
    // kabın adı tek: adsız kap sorgusu yok (yeni kap onları yakalamasın)
    expect(css).not.toMatch(/@container \(/);
  });
  test('derlemenin listesi: birleşme Takoz\'un dosyasına dokunuyorsa girer', () => {
    const V = require('../../tools/version-info.js');
    const D = V.MODUL_DESEN.takoz;
    ['js/cp-mount.js', 'js/cp-mount-3b-menu.js', 'js/mount-core.js', 'js/guide-mount.js'].forEach((f) => expect(D.test(f)).toBe(true));
    ['js/cp-fead.js', 'css/styles.css', 'tests/unit/mount-core.test.js', 'js/components.js'].forEach((f) => expect(D.test(f)).toBe(false));
  });
  // ÖRNEKLER KAPALI GELİR (kullanıcı 2026-11-09, Canlı Not 85: "Örneklerden biri açık geliyor.
  // Kapalı gelsin"): önce ilk satır (BMC Siper) açık gelirdi.
  test('ilk açılışta hiçbir satır açık değil; ad tıklanınca ayrıntı açılır', () => {
    BS.veMntBaslangicKapsam('mount-analysis');
    expect(acik()).toEqual([]);
    ['siper', 'tulga'].forEach((v) => {
      expect(satir(v).querySelector('.ve-bas-satir-ac').getAttribute('aria-expanded')).toBe('false');
      expect(satir(v).querySelector('.ve-bas-satir-detay').hidden).toBe(true);
    });
    satir('siper').querySelector('.ve-bas-satir-ac').click();
    expect(acik()).toEqual(['siper']);
    expect(satir('siper').querySelector('.ve-bas-satir-detay').hidden).toBe(false);
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
    satir('siper').querySelector('.ve-bas-satir-ac').click();          // açık satır sekmeler arasında korunur
    const kapi = el().querySelector('.ve-bas-kapi');
    const sek = (i) => el().querySelectorAll('.ve-bas-sekme')[i];
    const satirlar = () => [...el().querySelectorAll('.ve-bas-satir')].map((r) => r.getAttribute('data-v'));
    expect(satirlar()).toEqual(['siper', 'tulga', 'asfat', 'tta10', 'tta10askili']);
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

// YÜKLEME EKRANI (kullanıcı 2026-11-11, Canlı Not 128: *"Örnek yüklediğimiz zaman direkt
// topolojiyi ekrana veriyor. Böyle bir yükleme ekranı gibi bir şey olsun, biraz geç
// yüklensin … Tık diye açılıyor."*): Yükle → kart (ad · künye · kademeli çubuk); kurucu
// süre dolmadan ÇAĞRILMAZ, sonra kartın arkasında çağrılır, kart söner. Otomasyonda ve
// jsdom'da gecikmesiz — öteki testler ve ürün turu eşzamanlı kurucuyu görür.
describe('YÜKLEME EKRANI — örnek kartın arkasında kurulur', () => {
  beforeEach(() => { document.body.innerHTML = '<div id="ve-page-topoloji" class="ve-main"></div>'; jest.useFakeTimers(); });
  afterEach(() => { jest.useRealTimers(); document.body.innerHTML = ''; });
  const tulga = () => BS.veMntBaslangicOrnekler().find((o) => o.key === 'tulga');

  test('jsdom ve otomasyon gecikmesiz: kurucu eşzamanlı, kart yok', () => {
    expect(BS._mntYuklemeGecikmesiz()).toBe(true);
    casus('veMntOrnekYukle', () => true, (f) => {
      expect(BS.veMntBaslangicEylem('ornek', 'tulga')).toBe(true);
      expect(f).toHaveBeenCalledWith('tulga');
      expect(document.getElementById('ve-mnt-yukleme')).toBeNull();
    });
  });

  test('kart: ad, künye, çubuk; kurucu süre dolmadan çağrılmaz, sonra çağrılır, çubuk dolar, kart söner', () => {
    casus('veMntOrnekYukle', () => true, (f) => {
      expect(BS.veMntOrnekYuklemeli('tulga', { zorla: true, ms: 1000 })).toBe(true);
      const k = document.getElementById('ve-mnt-yukleme');
      const o = tulga();
      expect(k.querySelector('.ve-mnt-yukleme-bas b').textContent).toBe(o.arac);   // satırdaki ad
      expect(k.querySelector('.ve-mnt-yukleme-kunye').textContent)
        .toBe(veSayi(o.govde, 0) + ' gövde · ' + veSayi(o.takoz, 0) + ' takoz · ' + veSayi(o.kutle, 0) + ' kg');
      const cubuk = k.querySelector('[role="progressbar"]');
      jest.advanceTimersByTime(600);
      expect(f).not.toHaveBeenCalled();                                         // kart görünürken model yok
      expect(Number(cubuk.getAttribute('aria-valuenow'))).toBeGreaterThan(0);   // çubuk ilerliyor
      jest.advanceTimersByTime(100);
      expect(f).toHaveBeenCalledWith('tulga');
      expect(cubuk.getAttribute('aria-valuenow')).toBe('100');
      expect(document.getElementById('ve-mnt-yukleme')).not.toBeNull();         // söner, hemen kopmaz
      jest.advanceTimersByTime(500);
      expect(document.getElementById('ve-mnt-yukleme')).toBeNull();
    });
  });

  // Canlı Not 131: *"biraz daha uzun sürebilir yükleme ekranı. Kısa olmuş."* (1,4 sn idi)
  test('süre sabiti 2,4–3,5 sn: kart okunur, bekletmez', () => {
    expect(BS.VE_MNT_YUKLEME_MS).toBeGreaterThanOrEqual(2400);
    expect(BS.VE_MNT_YUKLEME_MS).toBeLessThanOrEqual(3500);
  });

  // SİHİRBAZIN YÜKLEME EKRANI (kullanıcı 2026-11-11, Canlı Not 146: *"Başlangıç sihirbazı açılırken
  // yine bir yükleme ekranı olsun, daha profesyonel görünür."*): sihirbazın penceresinin üstünde
  // örneğin kartının aynısı (sihirli asa, ad, künye, çubuk); süre örneğinki; jsdom'da kart yok.
  test('SİHİRBAZIN YÜKLEME EKRANI: pencerenin üstünde kart, çubuk dolar, kart söner; gecikmesiz ortamda yok', () => {
    document.body.innerHTML += '<div id="ve-mntwiz-overlay"><div class="ve-settings-modal ve-fw-modal"></div></div>';
    expect(BS.veMntSihirbazYukleme('Tulga · 8 gövde · 5 takoz')).toBeNull();          // jsdom: kart yok
    const k = BS.veMntSihirbazYukleme('Tulga · 8 gövde · 5 takoz', { zorla: true, ms: 1000 });
    expect(k.parentNode.classList.contains('ve-fw-modal')).toBe(true);
    expect(k.id).toBe(BS.VE_MW_YUKLEME_ID);
    expect(k.querySelector('.ve-mnt-yukleme-bas b').textContent).toBe('Takoz Başlangıç Sihirbazı');
    expect(k.querySelector('.ve-mnt-yukleme-ico').classList.contains('mf-ico-wand')).toBe(true);
    expect(k.querySelector('.ve-mnt-yukleme-kunye').textContent).toBe('Tulga · 8 gövde · 5 takoz');
    const cubuk = k.querySelector('[role="progressbar"]');
    jest.advanceTimersByTime(700);
    expect(cubuk.getAttribute('aria-valuenow')).toBe('100');
    jest.advanceTimersByTime(500);
    expect(document.getElementById(BS.VE_MW_YUKLEME_ID)).toBeNull();
    const css = fs.readFileSync(path.join(__dirname, '../../css/styles.css'), 'utf8');
    expect(css).toMatch(/\.ve-mw-yukleme\{ z-index:60; \}/);
    expect(css).toMatch(/\.ve-mw-yukleme \.ve-mnt-yukleme-ico\{ animation:none; \}/);
  });

  test('çubuk bekleyişin tamamında dolar: geçişi süreden, kurulumda son adım kısa', () => {
    casus('veMntOrnekYukle', () => true, () => {
      BS.veMntOrnekYuklemeli('tulga', { zorla: true, ms: 2600 });
      const k = document.getElementById('ve-mnt-yukleme');
      expect(k.style.getPropertyValue('--ve-mnt-yukleme-adim')).toBe('1612ms');   // 0,62 · ms
      jest.advanceTimersByTime(1768);                                              // 0,68 · ms: kurulum
      expect(k.style.getPropertyValue('--ve-mnt-yukleme-adim')).toBe('240ms');
    });
    const css = fs.readFileSync(path.join(__dirname, '../../css/styles.css'), 'utf8');
    expect(css).toMatch(/\.ve-mnt-yukleme-cubuk > i\{[^}]*transition:width var\(--ve-mnt-yukleme-adim/);
  });
});
