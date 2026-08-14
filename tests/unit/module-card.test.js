/**
 * module-card.test.js — ana topolojideki ALT-SİSTEM (modül) kartı
 *
 * KULLANICI ŞİKÂYETİ (2026-08-14): "yan yana iki ana topoloji … biraz sade
 * olmuş. 'Ana' topoloji olduğu için biraz daha güzel durması lazım."
 *
 * Tarayıcıda ölçülen SOMUT arızalar (yalnız zevk meselesi değildi):
 *   • Ad kutunun ALTINDA yüzen etiketti → yan yana iki modülde "Araç
 *     Performans" ile "Takoz Çökme-Titreşim" dikdörtgenleri KESİŞİYORDU.
 *   • İçeride ne olduğu hiç görünmüyordu: boş modül ile 17 bileşenlik modül
 *     ekranda birebir aynı 80×66 kutuydu.
 *   • Çift tıkla girildiğini söyleyen tek bir işaret yoktu.
 *
 * Buradaki testler kartın ÇEKİRDEĞİNİ tutar (özet matematiği, ölçü kuralı,
 * ad elemanının taşınma sözleşmesi) — HTML dizgisi/etiket metni değil.
 * CLAUDE.md test politikası: sunum fonksiyonlarına toContain testi açılmaz.
 */

const stubs = stubGlobals();

document.body.innerHTML = '<div id="ve-canvas"></div>';
global.nodes = [];
global.connections = [];

eval(loadSource('components.js'));

const modulDugum = (over) =>
  Object.assign({ id: 'm1', type: 'arac-performans', x: 0, y: 0,
                  width: VE_MODULE_CARD_W, height: VE_MODULE_CARD_H, data: {} }, over);

// Kart, DOM'u createNode/restoreState'in kurduğu SIRAYLA bekler: kutu içinde
// sembol, kutunun DIŞINDA .ve-node-label. Bu iskelet iki yolun da ortak çıktısı.
function iskelet(ad) {
  const el = document.createElement('div');
  el.className = 've-node';
  el.innerHTML =
    '<div class="ve-node-box"><svg data-rol="sembol"></svg></div>' +
    '<div class="ve-node-label">' + (ad || 'Araç Performans') + '</div>';
  return el;
}

beforeEach(() => resetStubs(stubs));

describe('veIsModuleNode — ölçüt tek: tip tanımındaki isSubsystem', () => {
  test('iki modül tipi de modüldür', () => {
    expect(veIsModuleNode({ type: 'arac-performans' })).toBe(true);
    expect(veIsModuleNode({ type: 'mount-analysis' })).toBe(true);
  });

  test('sıradan bileşen modül değildir', () => {
    expect(veIsModuleNode({ type: 'engine' })).toBe(false);
    expect(veIsModuleNode({ type: 'gearbox' })).toBe(false);
    expect(veIsModuleNode({ type: 'sensor-wizard' })).toBe(false);
  });

  test('bilinmeyen tip / boş girdi patlamaz', () => {
    expect(veIsModuleNode({ type: 'boyle-bir-tip-yok' })).toBe(false);
    expect(veIsModuleNode(null)).toBe(false);
    expect(veIsModuleNode({})).toBe(false);
  });
});

describe('veModuleSummary — kartın canlı özeti alt topolojiden okunur', () => {
  test('alt topoloji yoksa boş sayılır', () => {
    expect(veModuleSummary(modulDugum())).toEqual({ nodes: 0, connections: 0, initialized: false });
  });

  test('düğüm ve bağlantı adedi node.data.subTopology üzerinden sayılır', () => {
    const n = modulDugum({ data: { subTopology: { nodes: new Array(17), connections: new Array(11) } } });
    expect(veModuleSummary(n)).toEqual({ nodes: 17, connections: 11, initialized: true });
  });

  test('bağlantısı olmayan dolu topoloji yine "dolu"dur', () => {
    const n = modulDugum({ data: { subTopology: { nodes: [{}], connections: [] } } });
    expect(veModuleSummary(n)).toEqual({ nodes: 1, connections: 0, initialized: true });
  });

  test('bozuk/yarım subTopology sıfıra düşer, istisna atmaz', () => {
    expect(veModuleSummary(modulDugum({ data: { subTopology: {} } })).initialized).toBe(false);
    expect(veModuleSummary(modulDugum({ data: { subTopology: null } })).initialized).toBe(false);
    expect(veModuleSummary({}).initialized).toBe(false);
  });
});

describe('veModuleSummaryText — boş ile dolu ayrışır', () => {
  test('boş modül kullanıcıya ne yapacağını söyler', () => {
    expect(veModuleSummaryText(modulDugum())).toBe('Boş — çift tıklayın');
  });

  test('dolu modül sayıları gösterir', () => {
    const n = modulDugum({ data: { subTopology: { nodes: new Array(17), connections: new Array(11) } } });
    expect(veModuleSummaryText(n)).toBe('17 bileşen · 11 bağlantı');
  });
});

// Kart ölçüsü İKİ yerde tutulsaydı (sabit + tip tanımı) biri sessizce eskirdi:
// tuval kartı 214px çizerken createNode 80px'lik düğüm üretirdi.
describe('kart ölçüsü tek kaynaktan gelir', () => {
  test('tip tanımları sabitle birebir aynı ölçüyü bildirir', () => {
    ['arac-performans', 'mount-analysis'].forEach((t) => {
      expect(componentDefs[t].defaultWidth).toBe(VE_MODULE_CARD_W);
      expect(componentDefs[t].defaultHeight).toBe(VE_MODULE_CARD_H);
    });
  });

  test('veNodeDefaultSize de aynı ölçüyü döndürür', () => {
    expect(veNodeDefaultSize('arac-performans')).toEqual({ w: VE_MODULE_CARD_W, h: VE_MODULE_CARD_H });
    expect(veNodeDefaultSize('mount-analysis')).toEqual({ w: VE_MODULE_CARD_W, h: VE_MODULE_CARD_H });
  });

  test('kart, kart-öncesi ölçüden gerçekten BÜYÜK (modül bileşenden ayrışsın)', () => {
    expect(VE_MODULE_CARD_W).toBeGreaterThan(VE_MODULE_LEGACY_W);
    expect(VE_MODULE_CARD_H).toBeGreaterThan(VE_MODULE_LEGACY_H);
  });
});

// Şema sürüm kapısı (veApplyLegacyMigrations) YALNIZ sürümsüz dosyaları
// geçirir; oysa 80×66 modül düğümü GÜNCEL sürümle kaydedilmiş projelerde de
// var. Bu yüzden kural sürümden bağımsız ve DAR: yalnız birebir eski
// varsayılan yükseltilir.
describe('veModuleSizeFor / veNormalizeModuleSize — eski kayıt yükseltmesi', () => {
  test('kart öncesi varsayılan (80×66) kart ölçüsüne yükselir', () => {
    const n = modulDugum({ width: VE_MODULE_LEGACY_W, height: VE_MODULE_LEGACY_H });
    expect(veModuleSizeFor(n)).toEqual({ w: VE_MODULE_CARD_W, h: VE_MODULE_CARD_H, changed: true });
    expect(veNormalizeModuleSize(n)).toBe(true);
    expect([n.width, n.height]).toEqual([VE_MODULE_CARD_W, VE_MODULE_CARD_H]);
  });

  test('kullanıcının BİLEREK verdiği ölçü korunur', () => {
    const n = modulDugum({ width: 300, height: 120 });
    expect(veNormalizeModuleSize(n)).toBe(false);
    expect([n.width, n.height]).toEqual([300, 120]);
  });

  test('eski varsayılanın yalnız BİR boyutu tutuyorsa dokunulmaz', () => {
    const n = modulDugum({ width: VE_MODULE_LEGACY_W, height: 90 });
    expect(veNormalizeModuleSize(n)).toBe(false);
    expect([n.width, n.height]).toEqual([VE_MODULE_LEGACY_W, 90]);
  });

  test('80×66 ölçüsündeki SIRADAN bileşen yükselmez (kural modüle özgü)', () => {
    const n = { id: 'e1', type: 'engine', width: VE_MODULE_LEGACY_W, height: VE_MODULE_LEGACY_H, data: {} };
    expect(veNormalizeModuleSize(n)).toBe(false);
    expect([n.width, n.height]).toEqual([VE_MODULE_LEGACY_W, VE_MODULE_LEGACY_H]);
  });

  test('ölçüsü hiç yazılmamış düğümde eski varsayılan kuralı tetiklenmez', () => {
    const n = { id: 'm2', type: 'arac-performans', data: {} };
    expect(veModuleSizeFor(n)).toEqual({ w: 65, h: 60, changed: false });
  });
});

// SÖZLEŞME: kart adı için YENİ eleman üretmez, mevcut .ve-node-label'ı taşır.
// Kopyalasaydı arıza sessiz olurdu — yeniden adlandırma (özellik paneli,
// cp-mount takoz adı, sensör otomatik adı) hep .ve-node-label'a yazıyor;
// kart eski adı göstermeye devam ederdi ve kimse fark etmezdi.
describe('veApplyModuleCard — ad elemanı TAŞINIR, kopyalanmaz', () => {
  test('kart kurulur, düğüm modül sınıfını alır', () => {
    const el = iskelet();
    expect(veApplyModuleCard(el, modulDugum())).toBe(true);
    expect(el.classList.contains('ve-node--module')).toBe(true);
    expect(el.querySelectorAll('.ve-mod-card')).toHaveLength(1);
  });

  test('sayfadaki tek .ve-node-label kartın İÇİNDEDİR (kopya yok)', () => {
    const el = iskelet('Araç Performans');
    const oncekiEtiket = el.querySelector('.ve-node-label');
    veApplyModuleCard(el, modulDugum());

    const etiketler = el.querySelectorAll('.ve-node-label');
    expect(etiketler).toHaveLength(1);
    expect(etiketler[0]).toBe(oncekiEtiket);                       // AYNI eleman
    expect(el.querySelector('.ve-mod-card').contains(oncekiEtiket)).toBe(true);
  });

  test('yeniden adlandırma yolu (etikete yazmak) kart başlığını değiştirir', () => {
    const el = iskelet('Araç Performans');
    veApplyModuleCard(el, modulDugum());
    // Uygulamanın gerçek yolu: cp-core.js applyName → label.textContent = ...
    el.querySelector('.ve-node-label').textContent = 'Kamyon Zinciri';
    expect(el.querySelector('.ve-mod-card').textContent).toContain('Kamyon Zinciri');
  });

  test('tipin kendi sembolü kartın içine taşınır (ikinci kopya üretilmez)', () => {
    const el = iskelet();
    veApplyModuleCard(el, modulDugum());
    expect(el.querySelectorAll('svg')).toHaveLength(1);
    expect(el.querySelector('.ve-mod-ico svg')).toBeTruthy();
  });

  test('dolu modül is-filled sınıfını alır, boş modül almaz', () => {
    const bos = iskelet();
    veApplyModuleCard(bos, modulDugum());
    expect(bos.querySelector('.ve-mod-card').classList.contains('is-filled')).toBe(false);

    const dolu = iskelet();
    veApplyModuleCard(dolu, modulDugum({ data: { subTopology: { nodes: [{}, {}], connections: [{}] } } }));
    expect(dolu.querySelector('.ve-mod-card').classList.contains('is-filled')).toBe(true);
    expect(dolu.querySelector('.ve-mod-stat').textContent).toBe('2 bileşen · 1 bağlantı');
  });

  test('iki kez çağrılınca ikinci kart kurulmaz (idempotent)', () => {
    const el = iskelet();
    veApplyModuleCard(el, modulDugum());
    expect(veApplyModuleCard(el, modulDugum())).toBe(true);
    expect(el.querySelectorAll('.ve-mod-card')).toHaveLength(1);
    expect(el.querySelectorAll('.ve-node-label')).toHaveLength(1);
  });

  test('sıradan bileşende kart kurulmaz — kutu olduğu gibi kalır', () => {
    const el = iskelet('Motor');
    expect(veApplyModuleCard(el, { id: 'e1', type: 'engine', data: {} })).toBe(false);
    expect(el.classList.contains('ve-node--module')).toBe(false);
    expect(el.querySelector('.ve-mod-card')).toBeNull();
    // Ad hâlâ kutunun DIŞINDA (yüzen etiket) — sıradan bileşenin davranışı
    expect(el.querySelector('.ve-node-box').querySelector('.ve-node-label')).toBeNull();
  });

  test('kutusu olmayan/boş girdide sessizce false döner', () => {
    expect(veApplyModuleCard(null, modulDugum())).toBe(false);
    const bosEl = document.createElement('div');
    expect(veApplyModuleCard(bosEl, modulDugum())).toBe(false);
  });
});
