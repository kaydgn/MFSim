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
 *   · örnek listesi kayıt defterinin KENDİSİ; küçük resimlerin hiçbiri
 *     "çizilemedi" değil;
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
const AK = require('../../js/mount-akso.js');
global.veMntAkso = AK;
const cp = require('../../js/cp-mount.js');
global.veMntAksoOrnekModel = cp.veMntAksoOrnekModel;
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
  // karonun ipucu gövde adlarını (VERİ) taşır, "— yükle" komutunu değil.
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
    const liste = BS.veMntBaslangicOrnekler();
    d.querySelectorAll('.ve-bas-karo').forEach((b) => {
      const o = liste.find((x) => x.key === b.getAttribute('data-v'));
      expect(b.getAttribute('title')).toBe(o.ad + ' — ' + o.govdeAdlari.join(' · '));
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
  test('örnek karoları kayıt defterinin KENDİSİ; hiçbiri "çizilemedi" değil', () => {
    const liste = core.getMountExampleList();
    const karo = html.match(/class="ve-bas-karo" data-ey="ornek" data-v="[^"]+"/g) || [];
    const sira = liste.filter((e) => !e.kurgu).concat(liste.filter((e) => e.kurgu)).map((e) => e.id);
    expect(karo.map((k) => k.match(/data-v="([^"]+)"/)[1])).toEqual(sira);
    expect(html).not.toContain('ve-bas-resim-yok');
  });
  // Kurgu doğrulama modelleri gerçek araçlarla karışmaz: ayrı bölüm, başlığı ve
  // her karonun künyesi "kurgu" der (kullanıcı isteği 2026-10-16).
  test('iki bölüm: gerçek araçlar · "Doğrulama örnekleri — kurgu"; kurgu karosu işaretli', () => {
    const liste = core.getMountExampleList();
    const bas = html.match(/<div class="ve-bas-baslik"><h2>[^<]+<\/h2>/g).map((b) => b.replace(/.*<h2>|<\/h2>/g, ''));
    expect(bas).toEqual(['Örnek modellerden başla', 'Doğrulama örnekleri — kurgu']);
    const [gercek, kurgu] = html.split('Doğrulama örnekleri — kurgu');
    liste.forEach((e) => {
      const yer = e.kurgu ? kurgu : gercek, oteki = e.kurgu ? gercek : kurgu;
      expect(yer).toContain('data-v="' + e.id + '"');
      expect(oteki).not.toContain('data-v="' + e.id + '"');
    });
    expect((kurgu.match(/<i>kurgu<\/i>/g) || []).length).toBe(liste.filter((e) => e.kurgu).length);
    expect(gercek).not.toContain('<i>kurgu</i>');
  });
});

// Kullanıcı seçimi (2026-10-15): Görünümler'in (eski 2D Görünüm) çizimi aksonometri;
// karo aynı resmi gösterir. "Aynı" = TEK çizici ve TEK kurucu — karo kendi
// modelini kurarsa (eski kip kendi kütle-ağırlıklı CG'sini hesaplıyordu)
// pencere ile karo sessizce ayrışır.
describe('KÜÇÜK RESİM — Görünümler\'in aksonometrisi, örneğin kendi modelinden', () => {
  const W = BS.VE_MNT_BAS_RESIM.w, H = BS.VE_MNT_BAS_RESIM.h;
  test('her örnek: pencerenin çizicisi ve kurucusu; takoz sayısı örneğinki; karoda yazı yok', () => {
    core.getMountExampleList().forEach((ex) => {
      const svg = BS.veMntBaslangicResim(ex.id);
      expect(svg).toBe(AK.ciz(cp.veMntAksoOrnekModel(ex.model), { W, H, sade: true }).svg);
      expect(svg).toMatch(/^<svg class="ve-mnt2d-akso"/);
      expect((svg.match(/class="ve-ak-t"/g) || []).length).toBe(ex.model.mounts.length);
      expect(svg).toContain('class="ve-ak-gam"');           // G
      expect(svg).toContain('class="ve-ak-gol"');           // Z = 0 gölgesi hep açık
      expect(svg).not.toContain('<text');                    // künye karonun altında
    });
  });
  test('kurucu pencereninki: G çözücünün birleştirmesi, kutu çekirdeğin eşdeğer kutusu, çözüm yok', () => {
    core.getMountExampleList().forEach((ex) => {
      const m = cp.veMntAksoOrnekModel(ex.model);
      const si = ex.model.components.map((c) => ({ mass: c.mass, cg: c.cg.map((v) => v / 1000), pointMass: !!c.pointMass,
        I: [[c.Ixx, c.Ixy || 0, c.Ixz || 0], [c.Ixy || 0, c.Iyy, c.Iyz || 0], [c.Ixz || 0, c.Iyz || 0, c.Izz]] }));
      const mp = core.combineMassProps(si);
      expect(m.G.x).toBeCloseTo(mp.cg[0] * 1000, 6);
      expect(m.G.y).toBeCloseTo(mp.cg[1] * 1000, 6);
      expect(m.G.z).toBeCloseTo(mp.cg[2] * 1000, 6);
      ex.model.components.forEach((c, i) => {
        const kutu = core.equivalentBox(c.mass, [[c.Ixx, 0, 0], [0, c.Iyy, 0], [0, 0, c.Izz]], !!c.pointMass);
        expect(m.govde[i].kutu).toEqual(kutu ? kutu.map((v) => v * 1000) : null);
      });
      expect(m.takoz.map((t) => [t.x, t.y, t.z])).toEqual(ex.model.mounts.map((t) => t.pos));
      expect(m.cozum).toBe('yok');
      expect(m.modlar).toBeNull();
      expect(m.takoz.every((t) => t.f === null)).toBe(true);
    });
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
  test('sihirbaz → veMntWizAc · step → veMntWizAcStep', () => {
    casus('veMntWizAc', () => true, (f) => {
      expect(BS.veMntBaslangicEylem('sihirbaz')).toBe(true);
      expect(f).toHaveBeenCalledTimes(1);
    });
    casus('veMntWizAcStep', () => true, (f) => {
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
      bolumler: [{ baslik: 'Bölüm', not: 'BÖLÜMNOTU', karolar: [{ ey: 'k', v: '1', kod: 'K1' }] }] });
    ['ÜSTSATIR', 'SAYFABAŞLIĞI', 'ALTMETİN', 'DİPNOT', 'KAPINOTU', 'ROZET', 'BÖLÜMNOTU']
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
    // Karo ipucu yalnız verilirse ve komut eki olmadan.
    expect(h).not.toContain('title=');
    const karo = K.veBasKaroHTML({ ey: 'k', v: '1', baslik: 'Motor · Şanzıman' });
    expect(karo).toContain('title="Motor · Şanzıman"');
    expect(karo).not.toMatch(/yükle"/);
  });
});
