/**
 * fead-coordlink.test.js — KONUM BAĞI (kanvas ↔ mm)
 *
 * Kullanıcı isteği (2026-08-28): *"topoloji üzerindeki bileşenleri
 * kaydırdığımızda, gerçekten koordinatları da değişiyordu. Şu an default
 * olarak öyle. Bunu açılır kapanır bir özellik haline getirmek istiyorum…
 * ufak, böyle açılıp kapanabilen bir bileşen… Onu topolojiye çekip açtığımız
 * kapattığımız zaman, yukarıda bahsettiğim özellik devreye girsin veya
 * devreden çıksın."*
 *
 * Bu dosyanın kilitlediği dört şey:
 *
 *   1. GERİYE DÖNÜK UYUM. Düğüm YOKKEN davranış BİREBİR eski — bugüne kadar
 *      kaydedilmiş her projede bu düğüm yok. Taban ölçüldü ve buraya çıpa
 *      olarak yazıldı; kapı bir sayı değil, DEĞİŞMEMEYİ tutuyor.
 *   2. KAPI TEK NOKTADA, VE SAF FONKSİYONUN İÇİNDE DEĞİL.
 *      `veFeadSyncMmFromCanvas` doğrudan çağrıldığında bağdan bağımsız
 *      çalışmaya devam eder; kapı `veFeadSyncDrag` üzerinde.
 *   3. BAĞIMSIZLIK SİMETRİK. Yalnız kanvas→mm yönü kesilseydi özellik
 *      ÇALIŞMAZDI: alt topoloji her açılışta (`veFeadPlaceFromCoords`)
 *      kutuları koordinatına geri çeker ve kullanıcının dizilişi kaybolurdu.
 *   4. AÇARKEN KUTU KOORDİNATA DÖNER, KOORDİNAT KUTUYA YAZILMAZ. Tersi,
 *      kullanıcının bağı kapatma sebebini (modeli değiştirmeden dizmek) tek
 *      tıkla ve SESSİZCE geri alırdı.
 */
const fead = require('../../js/cp-fead.js');
const M = require('../../js/fead-model.js');
const F = require('../../js/fead-core.js');

const stubs = stubGlobals();
document.body.innerHTML = '<div id="ve-canvas"></div>';
global.nodes = [];
global.connections = [];
eval(loadSource('components.js'));
global.componentDefs = componentDefs;
eval(loadSource('fead-belts.js'));
global.FEADCore = F;
Object.keys(M).forEach((k) => { global[k] = M[k]; });
Object.keys(fead).forEach((k) => { if (global[k] === undefined) global[k] = fead[k]; });

beforeEach(() => {
  resetStubs(stubs);
  global.nodes = [];
  global.connections = [];
});

// ── BMC örneğini kanvas düğümü olarak kur ──────────────────────────────────
// Örnek kimlikleri (`ex-*`) korunur: gerçek yükleyicinin kimlik göçü burada
// sınanmıyor (o `cp-fead.test.js`'in işi), sınanan şey koordinat bağı.
function kur() {
  const pack = M.veFeadExampleNodes('BMC_FEAD_2026');
  const ns = pack.nodes.map((n) => {
    const d = componentDefs[n.type] || {};
    return {
      id: n.id, type: n.type, customName: n.customName || null,
      def: d, x: 0, y: 0,
      width: d.defaultWidth || 65, height: d.defaultHeight || 60,
      data: JSON.parse(JSON.stringify(n.data || {})),
    };
  });
  global.nodes = ns;
  const org = M.veFeadOriginNode(ns);
  org.x = 3000; org.y = 3000;
  M.veFeadSyncCanvasFromMm(ns, { origin: org });
  return {
    nodes: ns, org,
    alt: ns.find((n) => n.type === 'fead-alternator'),
    ten: ns.find((n) => n.type === 'fead-tensioner'),
  };
}

const bag = (linked) => {
  const d = componentDefs['fead-coordlink'];
  const n = {
    id: 'link1', type: 'fead-coordlink', def: d, x: 0, y: 0,
    width: d.defaultWidth, height: d.defaultHeight, data: {},
  };
  if (linked !== undefined) n.data.linked = linked;
  return n;
};

// ─────────────────────────────────────────────────────────────────────────────
describe('okuma — tek nokta, düğüm yoksa AÇIK', () => {
  test('düğüm yoksa bağ AÇIK (geriye dönük uyumun kendisi)', () => {
    expect(M.veFeadCoordLinkOn([])).toBe(true);
    expect(M.veFeadCoordLinkOn(null)).toBe(true);
    expect(M.veFeadCoordLinkOn(kur().nodes)).toBe(true);
  });

  test('düğüm var ama "linked" yazılı değil → AÇIK', () => {
    // Paletten sürükleyip bırakmak tek başına modeli değiştirmemeli.
    expect(M.veFeadCoordLinkOn([bag()])).toBe(true);
  });

  test('linked:false → KAPALI, linked:true → AÇIK', () => {
    expect(M.veFeadCoordLinkOn([bag(false)])).toBe(false);
    expect(M.veFeadCoordLinkOn([bag(true)])).toBe(true);
  });

  test('iki kopyada KAPALI kazanır', () => {
    // maxInstances:1 ikinciyi zaten engelliyor, ama elle düzenlenmiş bir
    // dosya taşıyabilir. Açıkça KAPALI diyen bir düğümü yok saymak
    // kullanıcının talimatını sessizce çöpe atmak olurdu.
    const a = bag(true), b = bag(false); b.id = 'link2';
    expect(M.veFeadCoordLinkOn([a, b])).toBe(false);
    expect(M.veFeadCoordLinkOn([b, a])).toBe(false);
    expect(M.veFeadCoordLinkNode([a, b])).toBe(b);
  });

  test('kasnak/araç düğümleri bağ düğümü sayılmaz', () => {
    expect(M.veFeadCoordLinkNode(kur().nodes)).toBe(null);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('sürükleme kapısı — veFeadSyncDrag', () => {
  test('TABAN: bağ düğümü YOKKEN sürükleme mm\'yi birebir eskisi gibi taşır', () => {
    const s = kur();
    expect(s.alt.data.x).toBeCloseTo(-281, 6);
    expect(s.alt.data.y).toBeCloseTo(259.46, 6);

    s.alt.x += 40; s.alt.y -= 25;
    expect(fead.veFeadSyncDrag()).toBe(1);
    expect(s.alt.data.x).toBeCloseTo(-241, 6);   // +40 px = +40 mm
    expect(s.alt.data.y).toBeCloseTo(284.46, 6); // −25 px (aşağı) = +25 mm (yukarı)

    // Gergi: taşınan şey MONTAJ MERKEZİ (+ pivot, rijit)
    s.ten.x -= 15; s.ten.y += 10;
    expect(fead.veFeadSyncDrag()).toBe(1);
    expect(s.ten.data.cenX).toBeCloseTo(-185.08, 6);
    expect(s.ten.data.cenY).toBeCloseTo(89.16, 6);

    // ORİJİNİ sürüklemek diğer HERKESİ karşı yönde kaydırır
    s.org.x += 30;
    expect(fead.veFeadSyncDrag()).toBe(5);
    expect(s.alt.data.x).toBeCloseTo(-271, 6);
  });

  test('bağ KAPALIYKEN sürükleme mm\'yi HİÇ değiştirmez', () => {
    const s = kur();
    global.nodes.push(bag(false));
    const once = JSON.stringify([s.alt.data.x, s.alt.data.y, s.ten.data.cenX, s.ten.data.cenY]);

    s.alt.x += 40; s.alt.y -= 25;
    s.ten.x -= 15; s.ten.y += 10;
    s.org.x += 30;
    expect(fead.veFeadSyncDrag()).toBe(0);

    expect(JSON.stringify([s.alt.data.x, s.alt.data.y, s.ten.data.cenX, s.ten.data.cenY]))
      .toBe(once);
    // Kutu GERÇEKTEN taşındı — kapatılan şey yazma, hareket değil.
    expect(s.alt.x).toBeCloseTo(2764, 6);
  });

  test('bağ AÇIK yazılı bir düğümle davranış tabanla AYNI', () => {
    const s = kur();
    global.nodes.push(bag(true));
    s.alt.x += 40; s.alt.y -= 25;
    expect(fead.veFeadSyncDrag()).toBe(1);
    expect(s.alt.data.x).toBeCloseTo(-241, 6);
  });

  test('kapı SAF fonksiyonun içinde DEĞİL: veFeadSyncMmFromCanvas doğrudan çalışır', () => {
    // Kapı `veFeadSyncMmFromCanvas`'a konsaydı, bağdan bağımsız olarak
    // koordinat yazması gereken her çağıran (göç, örnek kurucu, toplu işlem)
    // sessizce engellenirdi.
    const s = kur();
    global.nodes.push(bag(false));
    s.alt.x += 40;
    expect(M.veFeadSyncMmFromCanvas(global.nodes, { origin: s.org })).toBe(1);
    expect(s.alt.data.x).toBeCloseTo(-241, 6);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('bağımsızlık SİMETRİK — veFeadPlaceFromCoords', () => {
  test('bağ AÇIKKEN kutular koordinata oturur', () => {
    const s = kur();
    s.alt.x += 40; s.alt.y -= 25;
    expect(fead.veFeadPlaceFromCoords()).toBeGreaterThan(0);
    expect(s.alt.x).toBeCloseTo(2724, 6);   // kur()'daki yerine döndü
    expect(s.alt.y).toBeCloseTo(2744.54, 6);
  });

  test('bağ KAPALIYKEN kutular YERİNDE kalır', () => {
    // Bu kapı olmasaydı özellik ÇALIŞMAZDI: alt topoloji her açılışında
    // (cp-fead.js ~satır 286) kullanıcının dizilişi koordinata geri çekilirdi.
    const s = kur();
    global.nodes.push(bag(false));
    s.alt.x += 40; s.alt.y -= 25;
    expect(fead.veFeadPlaceFromCoords()).toBe(0);
    expect(s.alt.x).toBeCloseTo(2764, 6);
    expect(s.alt.y).toBeCloseTo(2719.54, 6);
  });

  test('panelden koordinat yazmak da kutuyu KAPALIYKEN oynatmaz', () => {
    // veFeadSet → VE_FEAD_COORD_KEYS → veFeadPlaceFromCoords yolu.
    const s = kur();
    global.nodes.push(bag(false));
    const yerdeydi = s.alt.x;
    fead.veFeadSet(s.alt.id, 'x', -250);
    expect(s.alt.data.x).toBe(-250);     // model DEĞİŞİR
    expect(s.alt.x).toBeCloseTo(yerdeydi, 6);  // kutu değişmez
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('rozeti çevirmek', () => {
  test('kapatmak: linked=false, kutulara DOKUNULMAZ, saveState çağrılır', () => {
    const s = kur();
    const b = bag(); global.nodes.push(b);
    const px = [s.alt.x, s.alt.y];
    expect(fead.veFeadToggleCoordLink(b.id)).toBe(false);
    expect(b.data.linked).toBe(false);
    expect([s.alt.x, s.alt.y]).toEqual(px);
    expect(stubs.saveState).toHaveBeenCalled();
  });

  test('açmak: kutular koordinata DÖNER — koordinat kutuya yazılmaz', () => {
    const s = kur();
    const b = bag(false); global.nodes.push(b);
    // Kapalıyken serbestçe diz
    s.alt.x += 40; s.alt.y -= 25;
    const mmOnce = [s.alt.data.x, s.alt.data.y];

    expect(fead.veFeadToggleCoordLink(b.id)).toBe(true);
    expect([s.alt.data.x, s.alt.data.y]).toEqual(mmOnce);  // MODEL değişmedi
    expect(s.alt.x).toBeCloseTo(2724, 6);                  // kutu geri oturdu
    expect(s.alt.y).toBeCloseTo(2744.54, 6);
  });

  test('yanlış tipte sessizce çıkar', () => {
    const s = kur();
    expect(fead.veFeadToggleCoordLink(s.alt.id)).toBe(null);
    expect(fead.veFeadToggleCoordLink('yok')).toBe(null);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('düğümü SİLMEK bağı açar — ve uzlaştırır', () => {
  // ÖLÇÜLDÜ (bu kapı YOKKEN, BMC, bağ kapalıyken alternatör 80 px sağa /
  // 50 px yukarı dizilmiş, sonra düğüm silinmiş):
  //     silmeden hemen sonra   alternatör mm −281.00 · kol 28.4271°
  //     ve 1 px SÜRÜKLENİNCE   alternatör mm −200.00 · kol 28.0625°
  // Bir pikselin karşılığı 81 mm — uyarısız, hatasız. `veFeadSyncMmFromCanvas`
  // mm'yi MUTLAK hesapladığı için birikmiş kayma tek karede modele giriyor.
  test('kapalı düğüm silinince kutular koordinata oturur', () => {
    const s = kur();
    const b = bag(false);
    global.nodes.push(b);
    s.alt.x += 80; s.alt.y -= 50;                 // kapalıyken serbestçe diz
    expect(fead.veFeadSyncDrag()).toBe(0);

    const silinen = [b];
    global.nodes = global.nodes.filter((n) => n.id !== b.id);
    expect(M.veFeadCoordLinkOn(global.nodes)).toBe(true);   // bağ AÇILDI

    expect(fead.veFeadCoordLinkAfterDelete(silinen)).toBeGreaterThan(0);
    expect(s.alt.x).toBeCloseTo(2724, 6);         // kutu koordinatına oturdu
    expect(s.alt.y).toBeCloseTo(2744.54, 6);
    expect(s.alt.data.x).toBeCloseTo(-281, 6);    // model hiç değişmedi
  });

  test('uzlaştırmadan SONRA 1 px sürükleme 1 mm eder (81 mm DEĞİL)', () => {
    const s = kur();
    const b = bag(false);
    global.nodes.push(b);
    s.alt.x += 80; s.alt.y -= 50;
    const silinen = [b];
    global.nodes = global.nodes.filter((n) => n.id !== b.id);
    fead.veFeadCoordLinkAfterDelete(silinen);

    s.alt.x += 1;
    fead.veFeadSyncDrag();
    expect(s.alt.data.x).toBeCloseTo(-280, 6);    // −281 + 1
  });

  test('AÇIK düğümü silmek bir şey oynatmaz (kutu ile mm zaten uyuşuyor)', () => {
    const s = kur();
    const b = bag(true);
    global.nodes.push(b);
    global.nodes = global.nodes.filter((n) => n.id !== b.id);
    expect(fead.veFeadCoordLinkAfterDelete([b])).toBe(0);
  });

  test('geriye KAPALI bir kopya kalırsa uzlaştırma YAPILMAZ', () => {
    const s = kur();
    const a = bag(false), c = bag(false); c.id = 'link2';
    global.nodes.push(a, c);
    s.alt.x += 80;
    global.nodes = global.nodes.filter((n) => n.id !== a.id);
    expect(fead.veFeadCoordLinkAfterDelete([a])).toBe(0);
    expect(s.alt.x).toBeCloseTo(2804, 6);         // kutu yerinde kaldı
  });

  test('bağ düğümü OLMAYAN bir silme bedavadır', () => {
    const s = kur();
    s.alt.x += 80;
    expect(fead.veFeadCoordLinkAfterDelete([s.ten])).toBe(0);
    expect(fead.veFeadCoordLinkAfterDelete([])).toBe(0);
    expect(s.alt.x).toBeCloseTo(2804, 6);
  });

  test('silme yolu bu kancayı GERÇEKTEN çağırıyor (js/map.js)', () => {
    // Kanca yalnız `deleteSelectedNodes`'tan geçiyor (tek silme noktası) ve
    // orada `selectedNodes` mutasyondan önce kopyalanmak ZORUNDA — fonksiyon
    // onu boşaltıyor.
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '../../js/map.js'), 'utf8');
    const i = src.indexOf('function deleteSelectedNodes');
    const blok = src.slice(i, i + 3000);
    expect(blok).toContain('veFeadCoordLinkAfterDelete');
    expect(blok.indexOf('var _silinen = selectedNodes.slice()'))
      .toBeLessThan(blok.indexOf('selectedNodes = []'));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('rozet — kanvas yüzeyi', () => {
  const el = () => {
    const d = document.createElement('div');
    const box = document.createElement('div');
    box.className = 've-node-box';
    d.appendChild(box);
    return d;
  };

  test('AÇIK amber, KAPALI mavi — ikisi de SATURE (soluk gri değil)', () => {
    // Bu modülün en pahalı sessiz hatası kullanıcının bağın KAPALI olduğunu
    // fark etmemesi olurdu; soluk bir rozet tam olarak onu davet ederdi.
    const s = kur();
    const b = bag(); global.nodes.push(b);

    const a = el();
    expect(fead.veFeadApplyBadge(a, b)).toBe(true);
    let r = a.querySelector('.ve-fead-badge');
    expect(r.textContent).toBe('AÇIK');
    expect(r.style.cssText).toContain('--accent-warning');

    b.data.linked = false;
    const k = el();
    fead.veFeadApplyBadge(k, b);
    r = k.querySelector('.ve-fead-badge');
    expect(r.textContent).toBe('KAPALI');
    expect(r.style.cssText).toContain('--accent-primary');
  });

  test('rozet mousedown\'ı DURDURUR (yoksa sürükleme başlar, tık hiç gelmez)', () => {
    const s = kur();
    const b = bag(); global.nodes.push(b);
    const a = el();
    fead.veFeadApplyBadge(a, b);
    const r = a.querySelector('.ve-fead-badge');
    let durdu = false;
    r.onmousedown({ stopPropagation: () => { durdu = true; } });
    expect(durdu).toBe(true);
  });

  test('rozet tıklaması bağı gerçekten çevirir', () => {
    const s = kur();
    const b = bag(); global.nodes.push(b);
    const a = el();
    fead.veFeadApplyBadge(a, b);
    a.querySelector('.ve-fead-badge')
      .onclick({ stopPropagation() {}, preventDefault() {} });
    expect(b.data.linked).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('panel — kanvasla AYNI alanı okur', () => {
  test('iki durumda da üretilir ve durumu YAZAR', () => {
    const s = kur();
    const b = bag(); global.nodes.push(b);

    let h = fead.getFeadCoordLinkPropertiesHTML(b);
    expect(h).toContain('AÇIK');
    expect(h).toContain('veFeadToggleCoordLink(\'' + b.id + '\')');
    expect(h).toContain('Kanvas = kayış düzlemi');

    b.data.linked = false;
    h = fead.getFeadCoordLinkPropertiesHTML(b);
    expect(h).toContain('KAPALI');
    expect(h).toContain('bağımsız');
    expect(h).not.toMatch(/undefined|NaN|\[object/);
  });

  test('künye ölçeği ve ORİJİNİ adıyla yazar (orijin bir ROL)', () => {
    const s = kur();
    const b = bag(); global.nodes.push(b);
    const h = fead.getFeadCoordLinkPropertiesHTML(b);
    expect(h).toContain('1 px = 1.00 mm');
    expect(h).toContain('Sürücü Kasnak');   // BMC'de krank rolü
    expect(h).toContain('6 kasnak');   // BMC: altı kasnak
  });

  test('KASNAK paneli bağ kapalıyken kutunun oynamayacağını YAZAR', () => {
    // Bu üç alan normalde kutuyu da taşıyor; kapalıyken taşımıyor. Sessiz
    // bırakılsaydı kullanıcı sayıyı yazar, kutu yerinde kalır ve alanın
    // bozuk olduğunu sanardı — oysa model DEĞİŞTİ.
    const s = kur();
    let h = fead.getFeadPulleyPropertiesHTML(s.alt);
    expect(h).not.toContain('Konum Bağı KAPALI');   // sağlıklıda yanlış alarm YOK

    global.nodes.push(bag(false));
    h = fead.getFeadPulleyPropertiesHTML(s.alt);
    expect(h).toContain('Konum Bağı KAPALI');
    expect(h).toContain('kutu yerinden oynamaz');
  });

  test('panel düğüme HİÇ yazmaz (salt okuma)', () => {
    const s = kur();
    const b = bag(); global.nodes.push(b);
    const once = JSON.stringify(b.data);
    fead.getFeadCoordLinkPropertiesHTML(b);
    expect(JSON.stringify(b.data)).toBe(once);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('bileşen sözleşmesi', () => {
  test('bağlanamaz bir ARAÇ düğümü: 0 giriş / 0 çıkış, tek kopya', () => {
    const d = componentDefs['fead-coordlink'];
    expect(d).toBeTruthy();
    expect(d.inputs).toBe(0);
    expect(d.outputs).toBe(0);
    expect(d.isFeadCoordLink).toBe(true);
    expect(d.maxInstances).toBe(1);
  });

  test('"ufak": kutusu FEAD araç düğümlerinin hepsinden küçük', () => {
    // Kullanıcı isteğinin kendi kelimesi. Ölçüt bir sayı değil, SIRALAMA:
    // sabit bir 54×48 yazmak, başka bir kutu küçüldüğünde sessizce eskirdi.
    const d = componentDefs['fead-coordlink'];
    const alan = (t) => (componentDefs[t].defaultWidth || 65)
                      * (componentDefs[t].defaultHeight || 60);
    ['fead-belt', 'fead-report', 'fead-example'].forEach((t) => {
      expect(alan('fead-coordlink')).toBeLessThan(alan(t));
    });
    expect(d.defaultWidth).toBeGreaterThan(40);   // rozet + ad sığsın
  });

  test('sidebar kapsamı ve palet girdisi var', () => {
    const fs = require('fs');
    const path = require('path');
    const root = path.join(__dirname, '../..');
    const idx = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    expect(idx).toContain('data-type="fead-coordlink"');
    // Palet girdisi FEAD kapsamında olmalı — yoksa başka modüllerde görünür.
    // Palet girdisi FEAD ARAÇLARI kategorisinde olmalı — yoksa başka
    // modüllerin paletinde görünür ya da kasnaklarla karışır.
    const i0 = idx.indexOf('FEAD Araçları');
    expect(i0).toBeGreaterThan(0);
    const kat = idx.slice(i0, idx.indexOf('</div>\n\n', i0));
    expect(kat).toContain('data-type="fead-coordlink"');
    // Kayıt defteri tek: VE_MODULES['full-throttle'].components. Buraya
    // yazılmayan tip paletten sürüklenebilse bile bazı yollarda tanınmaz.
    expect(VE_MODULES['full-throttle'].components).toContain('fead-coordlink');

    // Panel dağıtımı: tip cp-core.js'te bağlı olmalı, yoksa çift tık boş panel açar.
    const core = fs.readFileSync(path.join(root, 'js/cp-core.js'), 'utf8');
    expect(core).toContain("node.type === 'fead-coordlink'");
    expect(core).toContain('getFeadCoordLinkPropertiesHTML(node)');
  });

  test('KENETLEME İSTİSNASI BAĞA BAĞLI (js/ui-core.js)', () => {
    // Kasnak sürüklenirken hizalama kenetlemesi kapalı, çünkü kutu KENARLARINI
    // yapıştırmak koordinatı sessizce yutuyordu (ölçüldü: 24.514 mm istenirken
    // 3.940 mm). Bağ kapalıyken o gerekçe yok — kutu salt görsel. Gerçek
    // ölçüm E2E'de (tests/e2e/fead-canvas-drag.spec.js); burada yalnız
    // koşulun bağa BAĞLI OLDUĞU tutuluyor.
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '../../js/ui-core.js'), 'utf8');
    const i = src.indexOf('var _feadDrag');
    expect(i).toBeGreaterThan(0);
    expect(src.slice(i, i + 400)).toContain('veFeadCoordLinkOn');
  });
});
