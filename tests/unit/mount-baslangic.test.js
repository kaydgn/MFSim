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
const WIZ = require('../../js/cp-mount-wizard.js');
global.VE_MW_STEPS = WIZ.VE_MW_STEPS;
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
    expect(html).toContain('Nereden başlayalım?');
  });
  test('sihirbaz kapısı adımları RAYIN kendi adlarıyla sayar (elle yazılmış liste yok)', () => {
    WIZ.VE_MW_STEPS.slice(1).forEach((s) => expect(html).toContain(s.ad));
  });
  test('örnek karoları kayıt defterinin KENDİSİ; hiçbiri "çizilemedi" değil', () => {
    const liste = core.getMountExampleList();
    const karo = html.match(/class="ve-bas-karo" data-ey="ornek" data-v="[^"]+"/g) || [];
    expect(karo.map((k) => k.match(/data-v="([^"]+)"/)[1])).toEqual(liste.map((e) => e.id));
    expect(html).not.toContain('ve-bas-resim-yok');
  });
});

// Kullanıcı seçimi (2026-10-15): 2D Görünüm'ün ilk sekmesi aksonometri;
// karo aynı resmi gösterir. "Aynı" = TEK çizici ve TEK kurucu — karo kendi
// modelini kurarsa (eski kip kendi kütle-ağırlıklı CG'sini hesaplıyordu)
// pencere ile karo sessizce ayrışır.
describe('KÜÇÜK RESİM — 2D Görünüm\'ün aksonometrisi, örneğin kendi modelinden', () => {
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
});
