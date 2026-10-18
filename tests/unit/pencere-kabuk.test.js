/**
 * pencere-kabuk.test.js — TÜM PROGRAMDA TEK TİP BİLEŞEN PENCERESİ (FEAD · Takoz)
 * ─────────────────────────────────────────────────────────────────────────
 * Kullanıcı isteği (2026-10-16): *"Takoz çökme ve titreşim modülündeki pencere
 * başlık genişliklerinin, pencere yapılarının vs FEAD modülü ile aynı
 * olmadığını görüyorum biraz. Tüm programda tek tip bir kozmetik yapımız
 * olacak."*
 *
 * Ölçülen önce (main 2f43cda, gerçek tarayıcı, Tulga + AG00976, 1920 × 952 ve
 * 1200 × 800):
 *   · kabuk İKİ üreticideydi (FEAD `veFeadPanelShell` · Takoz `_mntPencereKabuk`)
 *   · Takoz'un 13 penceresinden 6'sında sekmelerin ÜSTÜNDE içerik (kroki ×5,
 *     Takoz Özellikleri'nin seçicisi ×1) — FEAD'in 11'inde 0
 *   · 4 Takoz penceresinde sekme şeridi YOK (Örnek, Braket, Rapor, Koordinat)
 *     — FEAD'in her penceresi ≥ 2 kategori
 *   · durum notları ikonlu renkli kutu (`.ve-mnt-not`, Tulga'da 8 pencerede
 *     13 kutu) —
 *     FEAD'de soluk satır, kutu yalnız pencerenin cevabı (`.ve-fp-durum`)
 *   · 6 pencerenin sağ sütununda Uygunluk yok (modül kartı, Örnek, Takoz
 *     Özellikleri, 2D, 3D Görüntüleyici, Koordinat)
 *   (2026-10-16: 2D Görünüm'ün adı Görünümler; 3D Görüntüleyici tek sekmeli
 *   YER TUTUCU — bağışı tipin beyanından, aşağıdaki `yerTutucu`.)
 *
 * PENCERE SONUÇ GÖSTERMEZ (kullanıcı kararı 2026-10-16, Takoz): *"TÜM
 * BİLEŞENLERİN İÇİNDE sonuç ile alakalı bir bilgi, bir sonuç vs olmayacak …
 * kullanıcı sadece detaylı sonuç raporu ile yetinecek."* Ölçülen önce (main
 * 35b98c8, Tulga, Node): 17 Takoz penceresinin 17'si sağ sütununda Uygunluk
 * taşıyordu ve 17'si çözümden sonra değişiyordu (eylemin hazırlık satırları
 * hariç). Sonra: 0 · 0. Takoz'da Uygunluk YASAK, sağ sütun içeriği varsa
 * var (yoksa kabuk tek sütun); FEAD'in kuralı değişmedi.
 *   · dar ekranın modalında Rapor 980 px (Takoz) ↔ 560 px (FEAD)
 *
 * TEK GÖVDE (kullanıcı kararı 2026-10-16, akşam): *"bir bileşen özelinde tek
 * bir pencerede tamamı sığacak içerikleri genel olarak iki pencereye
 * ayırmışız … Tek bir pencerede hepsi sığar … Tüm bileşenler için bunu
 * uygulayalım. Kullanışlı ve kompakt bir tasarım olsun."* Ölçülen önce (main
 * 8a88b49, gerçek tarayıcı, Tulga + AG00976, 379 × 974 px müfettiş sütunu,
 * pencere showNodeProperties ile açılıp sahibi kimlikten doğrulanarak): 33
 * pencerenin 31'i 2–4 sekmeye bölünmüş (88 sekme; iki pencerede tek sekmeli
 * şerit), aynı anda 57 kategori gizli; sonra sekme 0, gizli kategori 0, 14
 * pencere kaydırmasız sığıyor. Kategori VERİ olarak kalır (ad · durum · bant);
 * bölümü kartın başlığı adlandırır, her kategori başlıklı bir bölüm taşır
 * (yer tutucu hariç).
 *
 * EYLEM SATIRI (kullanıcı 2026-10-18: *"butonu çok geniş ve büyük. Onu da
 * estetik hale getirelim"*): eylem sütunun tam eninde 40 px'lik bir şeritti
 * (379 px'lik sütunda 359 × 40) ve durum notu ALTINDA, dar kapta kaydırma
 * alanının sonunda kalıyordu — tarama sürerken ilerleme 830 px aşağıdaydı.
 * Şimdi sağ sütunun SONU kitin satırı (`vePencereEylem`): solda durum ya da
 * süren işin çubuğu (`vePencereIlerleme`), sağda kompakt düğme; dar kapta
 * satır bütünüyle yapışır. Geometri gerçek tarayıcıda:
 * tests/e2e/mount-param-sonuc.spec.js → *EYLEM SATIRI*.
 *
 * Kapı bir LİSTE değil bir KURAL: tipler `componentDefs`ten, her tipin
 * penceresini kuran işlev `cp-core.js`'in panel dağıtımından OKUNUR (FEAD'in
 * aile kapısının, fead-pencere-ailesi.test.js, kalıbı). Yeni bir FEAD ya da
 * Takoz tipi gelir de penceresi ailenin dışında kalırsa bu dosya onu ADIYLA
 * söyler.
 */
const fs = require('fs');
const path = require('path');
const KOK = path.join(__dirname, '../..');
const oku = (f) => fs.readFileSync(path.join(KOK, f), 'utf8');

const stubs = stubGlobals({ saveState: jest.fn(), showToast: jest.fn(), showNodeProperties: jest.fn() });
document.body.innerHTML = '<div id="ve-canvas"></div>';
global.nodes = [];
global.connections = [];
eval(loadSource('components.js'));
global.veIsCanvasHidden = veIsCanvasHidden;
global.componentDefs = componentDefs;
global.VE_MODULES = VE_MODULES;

// ── FEAD (fead-pencere-ailesi.test.js'in kurulumu) ──
eval(loadSource('cp-accessories.js'));
global.VE_ALTERNATOR_PRESETS = VE_ALTERNATOR_PRESETS;
global.VE_AC_PRESETS = VE_AC_PRESETS;
global.VE_AIRCOMP_PRESETS = VE_AIRCOMP_PRESETS;
global.veAccInterpCurve = veAccInterpCurve;
[require('../../js/fead-duty.js'), require('../../js/fead-belts.js'),
 require('../../js/fead-tensioners.js'), require('../../js/fead-accessories.js'),
 require('../../js/fead-engines.js')].forEach((lib) => {
  Object.keys(lib).forEach((k) => { global[k] = lib[k]; });
});
const FM = require('../../js/fead-model.js');
global.FEADCore = require('../../js/fead-core.js');
Object.keys(FM).forEach((k) => { global[k] = FM[k]; });
const FK = require('../../js/fead-checks.js');
Object.keys(FK).forEach((k) => { global[k] = FK[k]; });
[require('../../js/cp-fead.js'), require('../../js/cp-fead-report.js'), require('../../js/cp-fead-wizard.js')]
  .forEach((m) => Object.keys(m).forEach((k) => { if (global[k] === undefined) global[k] = m[k]; }));

// ── Takoz (mount-sutun.test.js'in kurulumu) ──
global.veMountCore = require('../../js/mount-core.js');
global.veMntBrief = require('../../js/mount-brief.js');
global.veMntAkso = require('../../js/mount-akso.js');
const cp = require('../../js/cp-mount.js');
const rep = require('../../js/cp-mount-report.js');
['veMntUygunluk', 'veMntRaporOpts', '_mntRepCaseTr', '_mntRepIsolation', '_mntRepEngine', '_mntRepZeta']
  .forEach((k) => { global[k] = rep[k]; });
Object.keys(cp).forEach((k) => { if (global[k] === undefined) global[k] = cp[k]; });
global.veMntKatalog = require('../../js/mount-katalog.js');
const pa = require('../../js/cp-mount-param.js');
Object.keys(pa).forEach((k) => { if (global[k] === undefined) global[k] = pa[k]; });
global.veMntParamCiz = require('../../js/mount-param-ciz.js');
const ps = require('../../js/cp-mount-param-sonuc.js');
Object.keys(ps).forEach((k) => { if (global[k] === undefined) global[k] = ps[k]; });

const PK = require('../../js/pencere-kabuk.js');

beforeEach(() => { resetStubs(stubs); cp._mntForgetResults(); global.veFeadResults = null; });

// cp-core.js'in panel dağıtımından tip → kurucu (kaynaktan okunur).
const CORE = oku('js/cp-core.js');
function dagitim() {
  const harita = {};
  const re = /else if\(([^{]*?)\)\s*\{\s*(?:\/\/[^\n]*\n\s*)*html \+= (\w+)\(node\);/g;
  let m;
  while ((m = re.exec(CORE))) {
    (m[1].match(/'(?:fead|mnt|mount)-[a-z0-9-]+'/g) || []).forEach((t) => { harita[t.slice(1, -1)] = m[2]; });
  }
  return harita;
}
const KURUCU = dagitim();
const FEAD_TIP = Object.keys(componentDefs).filter((t) => /^fead-/.test(t));
const TAKOZ_TIP = Object.keys(componentDefs).filter((t) => /^mnt-/.test(t) && !/wizard$/.test(t)).concat(['mount-analysis']);

function dom(html) { const d = document.createElement('div'); d.innerHTML = html; return d; }

// AİLE DENETİMİ — iki modüle AYNI soru. Döner: bulgu listesi (boşsa ailede).
// TEK GÖVDE: gövdenin üstünde eksik bandından başka bir şey yok, sekme şeridi
// ve gizli kategori yok. Her kategori BAŞLIKLI bir bölüm taşır — tek gövdede
// başlıksız kategori sahipsiz bir not olurdu (sekme adı bunu örtüyordu);
// bunu yalnız tipin BEYANI bağışlar: YER TUTUCU (componentDefs[t].yerTutucu =
// notun metni; 3D Görüntüleyici — "Klasik 3B" gerçek CAD dosyasına ayrıldı).
// `bagis` false: beyan yok sayılır (bağışın gerçekten beyandan geldiğini
// ölçmek için).
// SAĞ SÜTUN: FEAD'de Uygunluk taşır; Takoz'da Uygunluk YASAK (sonuç yalnız
// raporda) ve sütun içeriği varsa çizilir — yoksa kabuk tek sütun.
const yerTutucu = (t) => !!(t && componentDefs[t] && componentDefs[t].yerTutucu);
const takozTipi = (t) => !!t && (/^mnt-/.test(t) || t === 'mount-analysis');
const uygunlukVar = (el) => [...el.querySelectorAll('.ve-fp-sect b')].some((x) => x.textContent.trim() === 'Uygunluk');
function aile(d, t, bagis = true) {
  const b = [];
  const fp = d.querySelector('.ve-fp');
  if (!fp) return ['kabuk yok'];
  if (!fp.firstElementChild || !fp.firstElementChild.classList.contains('ve-fp-split')) b.push('kabuktan önce şerit');
  const ana = fp.querySelector('.ve-fp-split > .ve-fp-main');
  const cocuk = ana ? [...ana.children] : [];
  const govde = cocuk.filter((c) => c.classList.contains('ve-fp-govde'));
  if (govde.length !== 1) b.push('gövde ' + govde.length);
  cocuk.filter((c) => !c.classList.contains('ve-fp-govde') && !c.classList.contains('ve-fp-eksik'))
    .forEach((c) => b.push('gövdenin ÜSTÜNDE: ' + (c.className || c.tagName)));
  if (fp.querySelector('.ve-fp-tabs, .ve-fp-tab, [role="tablist"], [role="tabpanel"]')) b.push('sekme şeridi');
  const kat = govde.length ? [...govde[0].children] : [];
  if (!kat.length) b.push('kategori yok');
  kat.filter((k) => !k.classList.contains('ve-fp-kat')).forEach((k) => b.push('kategorisiz gövde öğesi ' + (k.className || k.tagName)));
  kat.filter((k) => k.hidden).forEach((k) => b.push('gizli kategori ' + k.getAttribute('data-k')));
  if (!(bagis && yerTutucu(t))) {
    kat.filter((k) => !k.querySelector('.ve-fp-sect > b')).forEach((k) => b.push('başlıksız kategori ' + k.getAttribute('data-k')));
  }
  const yan = fp.querySelector('.ve-fp-split > .ve-fp-side');
  if (takozTipi(t)) {
    if (uygunlukVar(d)) b.push('Uygunluk (sonuç) pencerede');
    if (!yan && !fp.querySelector('.ve-fp-split.ve-fp-split--tek')) b.push('sağ sütun yok ama kabuk tek sütun değil');
    if (yan && !yan.innerHTML.trim()) b.push('boş sağ sütun');
  } else if (!yan) b.push('sağ sütun yok');
  else if (!uygunlukVar(yan)) b.push('sağ sütunda Uygunluk yok');
  if (d.querySelector('.ve-mnt-not')) b.push('eski not kutusu (.ve-mnt-not)');
  // EYLEM SATIRI: tek eylem, sağ sütunun SONUNDAKİ satırda (dar kapta o satır
  // yapışır — gövdeye ya da sütunun ortasına düşen eylem uzun pencerede aranır).
  const eylem = d.querySelectorAll('.ve-fp-solve').length, satir = d.querySelectorAll('.ve-fp-yurut');
  if (eylem > 1 || eylem !== d.querySelectorAll('.ve-fp-side > .ve-fp-yurut > .ve-fp-solve').length) b.push('eylem sağ sütunun eylem satırında ve tek değil');
  if (satir.length !== eylem || (eylem && yan.lastElementChild !== satir[0])) b.push('eylem satırı sağ sütunun sonunda değil');
  if (d.querySelectorAll('.ve-fp-durum').length !== d.querySelectorAll('.ve-fp-side .ve-fp-durum').length) b.push('cevap kutusu sağ sütunda değil');
  return b;
}

// ── MODELLER ───────────────────────────────────────────────────────────────
function feadKur() {
  const pack = FM.veFeadExampleNodes('AG00976_GATES_2025');
  global.nodes = pack.nodes.map((n) => {
    const d = componentDefs[n.type] || {};
    return { id: n.id, type: n.type, customName: n.customName || null, def: d,
             x: 0, y: 0, width: d.defaultWidth || 65, height: d.defaultHeight || 60,
             data: JSON.parse(JSON.stringify(n.data || {})) };
  });
}
function feadPencere(t) {
  let n = global.nodes.find((x) => x.type === t);
  if (!n && t === 'fead-analysis') {
    n = { id: 'mod-1', type: t, def: componentDefs[t], data: { subTopology: { nodes: JSON.parse(JSON.stringify(global.nodes)) } } };
  }
  if (!n) n = { id: 'yeni-' + t, type: t, def: componentDefs[t], data: {} };
  return dom(global[KURUCU[t]](n));
}
const TULGA = JSON.parse(oku('assets/examples/tulga_topoloji.json'));
function takozKur() {
  global.nodes = JSON.parse(JSON.stringify(TULGA.nodes)).map((n) => Object.assign(n, { def: componentDefs[n.type] }));
}
function takozPencere(t) {
  let n = global.nodes.find((x) => x.type === t);
  if (!n && t === 'mount-analysis') {
    n = { id: 'kart', type: t, data: { subTopology: { nodes: JSON.parse(JSON.stringify(TULGA.nodes)), connections: [] } } };
  }
  if (!n) { n = { id: t + '-t', type: t, def: componentDefs[t], data: {} }; global.nodes.push(n); }
  return dom(global[KURUCU[t]](n));
}
function coz() {
  const s = global.nodes.find((n) => n.type === 'mnt-solver');
  global._veMntLast = cp._mntComputeResults(s.id);
}

describe('TEK ÜRETİCİ — iki modülün kabuğu ortak kitten', () => {
  test('dağıtım iki modülün her tipini bir kurucuya bağlıyor (tarama gerçekten tarıyor)', () => {
    expect(FEAD_TIP.length).toBeGreaterThanOrEqual(15);
    expect(TAKOZ_TIP.length).toBe(18);
    expect(FEAD_TIP.concat(TAKOZ_TIP).filter((t) => typeof global[KURUCU[t]] !== 'function')).toEqual([]);
  });

  // Kabuğun işaretlemesi (bölünmüş gövde · gövde · kategori) yalnız kitte.
  // Bir modül onu yeniden yazarsa ikinci bir üretici doğar ve ilk rötuşta
  // ayrışır (2026-10-14'teki ikinci yazım iki istisna biriktirmişti).
  test('bölünmüş gövde, gövde ve kategori YALNIZ js/pencere-kabuk.js\'te basılıyor', () => {
    const bas = fs.readdirSync(path.join(KOK, 'js')).filter((f) => /\.js$/.test(f)).filter((f) => {
      const s = oku('js/' + f).split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
      return /class="ve-fp-govde"|class="ve-fp-split"|class="ve-fp-kat"/.test(s);
    });
    expect(bas).toEqual(['pencere-kabuk.js']);
  });

  // SEKME 2026-10-16'DA KALKTI: şerit, hafıza ve işleyici kitte de modüllerde
  // de yok — geri gelen bir sekme işleyicisi bu satırları kırmızıya çevirir.
  test('FEAD ve Takoz kurucuları kite gidiyor; sekme hafızası ve işleyicisi YOK', () => {
    expect(oku('js/cp-fead.js')).toMatch(/return vePencereKabuk\(node,/);
    expect(oku('js/cp-mount.js')).toMatch(/return vePencereKabuk\(node, kategoriler, yan, \{/);
    const fead = require('../../js/cp-fead.js');
    expect([PK.VE_PENCERE_SEKME, PK.vePencereSekme, PK.vePencereSekmeOf, cp.VE_MNT_PENCERE_SEKME,
      cp.veMntPencereSekme, fead.veFeadPanelTab, fead.veFeadPanelTabState]).toEqual(Array(7).fill(undefined));
    expect(oku('js/cp-fead.js') + oku('js/cp-mount.js') + oku('js/pencere-kabuk.js')).not.toMatch(/ve-fp-tabs-|\.ve-fp-tab\b/);
  });

  // EYLEM SATIRI da kitin işaretlemesi: elle yazılan bir satır (ya da çubuk)
  // durum yuvasını, yapışkanlığı ve ilerlemenin `data-is` sözleşmesini atlardı.
  test('eylem satırı ve ilerleme çubuğu YALNIZ js/pencere-kabuk.js\'te basılıyor', () => {
    const bas = fs.readdirSync(path.join(KOK, 'js')).filter((f) => /\.js$/.test(f)).filter((f) => {
      const s = oku('js/' + f).split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
      return /class="ve-fp-yurut|class="ve-fp-ilerleme/.test(s);
    });
    expect(bas).toEqual(['pencere-kabuk.js']);
  });

  test('tarayıcıda kit iki modülden ÖNCE yükleniyor', () => {
    const html = oku('index.html');
    const yer = (f) => html.indexOf('src="js/' + f + '"');
    expect(yer('pencere-kabuk.js')).toBeGreaterThan(0);
    expect(yer('pencere-kabuk.js')).toBeLessThan(yer('cp-mount.js'));
    expect(yer('pencere-kabuk.js')).toBeLessThan(yer('cp-fead.js'));
  });
});

describe('AİLE — iki modülün bütün pencereleri AYNI iskelet', () => {
  test('FEAD: her pencere ailede (referans — kural bu modülden)', () => {
    feadKur();
    const disarida = [];
    FEAD_TIP.forEach((t) => { const b = aile(feadPencere(t), t); if (b.length) disarida.push(t + ': ' + b.join(' · ')); });
    expect(disarida).toEqual([]);
  });

  // DEPO YOKKEN DE AİLE (garanti bozulmuş eski kayıt): sürücünün ve kayışın
  // işletme kategorileri `_feadDepoYok`un BAŞLIKLI kartına iner — tek gövdede
  // başlıksız bir not hangi bölümün yerinde durduğunu söylemezdi (sekme adı
  // bunu örtüyordu). Örnek modelde depo hep var, yani bu yol başka hiçbir
  // testte çizilmiyor.
  test('FEAD: Çözücü düğümü YOKKEN de sürücü ve kayış pencereleri ailede', () => {
    feadKur();
    global.nodes = global.nodes.filter((n) => n.type !== 'fead-solver');
    const surucu = global.nodes.find((n) => n.data && n.data.driver);
    const kayis = global.nodes.find((n) => n.type === 'fead-belt');
    expect(surucu && kayis).toBeTruthy();
    const ds = dom(global[KURUCU[surucu.type]](surucu)), dk = dom(global[KURUCU['fead-belt']](kayis));
    expect(aile(ds, surucu.type)).toEqual([]);
    expect(aile(dk, 'fead-belt')).toEqual([]);
    const olu = (d) => [...d.querySelectorAll('.ve-fp-olu')].map((x) => x.closest('.ve-fp-kat').getAttribute('data-k'));
    expect(olu(ds)).toEqual(['mot', 'cev']);                         // iki işletme kategorisi depo bekliyor
    expect(olu(dk)).toEqual(['tas']);
  });

  test.each([['çözümsüz', false], ['çözümlü', true]])('Takoz (%s): her pencere ailede', (_, cozulu) => {
    takozKur();
    if (cozulu) coz();
    const disarida = [];
    TAKOZ_TIP.forEach((t) => { const b = aile(takozPencere(t), t); if (b.length) disarida.push(t + ': ' + b.join(' · ')); });
    expect(disarida).toEqual([]);
  });

  // Bağış kural değil İSTİSNA: başlıksız kategoriyi yalnız YER TUTUCU beyanı
  // bağışlar (pencerenin tek içeriği tipin notu); beyansız okunursa aynı
  // pencere ailenin dışında kalır.
  test('başlıksız kategoriyi yalnız tipin YER TUTUCU beyanı bağışlar; Görünümler çizim + işaretleri tek kategoride', () => {
    takozKur();
    expect(FEAD_TIP.concat(TAKOZ_TIP).filter(yerTutucu)).toEqual(['mnt-viewer']);
    expect(Object.keys(componentDefs).filter((t) => componentDefs[t].tekSekme)).toEqual([]);   // tek sekme beyanı kalktı
    const v = takozPencere('mnt-viewer');
    expect(aile(v, 'mnt-viewer', false)).toEqual(['başlıksız kategori sahne']);   // beyansız okunursa ailenin dışında
    expect(v.querySelector('.ve-fp-govde > .ve-fp-kat').textContent.trim()).toBe(componentDefs['mnt-viewer'].yerTutucu);
    const g = takozPencere('mnt-2dview').querySelector('.ve-fp-govde > .ve-fp-kat');
    expect(g.querySelector('.ve-mnt-akso-kap svg.ve-mnt2d-akso')).not.toBeNull();
    expect([...g.querySelectorAll('.ve-fp-sect b')].map((x) => x.textContent)).toEqual(['İşaretler']);
  });

  // Kroki sekmeden bağımsız bağlamdır → FEAD'in bağlam sütunu (sağ sütunun
  // başı); sekmelerin üstünde değil. 2026-10-16'dan beri AKSONOMETRİK
  // (kullanıcı: "'Güç grubundaki yeri' kısmında aksonometrik görünümün
  // görünmesini istiyorum") ve bu bileşen çizimde işaretli.
  test('Takoz: "Güç grubundaki yeri" kütle ve takoz pencerelerinde sağ sütunun İLK bölümü, aksonometrik, bileşen işaretli', () => {
    takozKur();
    const tipler = TAKOZ_TIP.filter((t) => componentDefs[t] && (componentDefs[t].isMountBody || componentDefs[t].isMount));
    expect(tipler.length).toBeGreaterThanOrEqual(9);
    const yanlis = [];
    tipler.forEach((t) => {
      const yan = takozPencere(t).querySelector('.ve-fp-side');
      const ilk = yan && yan.firstElementChild;
      if (!ilk || ilk.id.indexOf('ve-mnt-kroki-') !== 0) { yanlis.push(t + ': ' + (ilk ? ilk.id || ilk.className : 'yok')); return; }
      if (!ilk.querySelector('svg.ve-mnt2d-akso')) yanlis.push(t + ': aksonometri yok');
      else if (!ilk.querySelector('svg.ve-mnt2d-akso [data-sec]')) yanlis.push(t + ': bileşen işaretli değil');
    });
    expect(yanlis).toEqual([]);
  });

  test('Takoz: not satırı FEAD\'in dili — soluk satır, hüküm kalın sözcükte', () => {
    takozKur();
    const h = takozPencere('mnt-mount').innerHTML;
    expect(h).toMatch(/<div class="ve-fp-not"><b>TK050 \(57RS326612M\)<\/b> ile 6\/6 değer aynı/);
    expect(cp._mntNot('Ateşleme frekansı yok', 'warn')).toBe('<div class="ve-fp-not" data-d="warn"><b>Ateşleme frekansı yok</b></div>');
    const css = oku('css/styles.css');
    expect(css).toMatch(/\.ve-fp-not, \.ve-fead-not\{/);           // FEAD'in satırıyla TEK kural
    expect(css).not.toMatch(/\.ve-mnt-not\s*[{,]/);
  });
});

// PENCERE SONUÇ GÖSTERMEZ (kullanıcı kararı 2026-10-16) — KURAL, liste değil:
// tipler componentDefs'ten, kurucular dağıtımdan. Model önce TAM kurulur
// (Tulga'da olmayan tipler geçerli bir nokta kütleyle): pencere açılırken
// eklenen boş düğüm modeli değiştirir, çözücü onu reddeder ve kapı boşa
// ölçerdi (çözümsüz önce = çözümsüz sonra).
// KILAVUZ BAŞLIKLA KONUŞUR (2026-10-16). Sekme kalkınca kılavuzun "Sekme →
// bölüm" haritası (Takoz kılavuzu, Ek A) ölü bir yolu tarif ediyordu; üstelik
// "Tip ve rijitlik → Kuvvet–sehim yasası" gibi programda hiç olmayan bir
// bölümü de adlandırıyordu. Kural: Ek A'nın Bölüm sütununda KALIN yazılan her
// ad Takoz pencerelerinden birinin bölüm başlığıdır. Başlıklar pencerelerin
// kendisinden toplanır (nokta kütlenin "Atalet"i dâhil), liste tutulmaz.
describe('KILAVUZ — Takoz kılavuzunun alan haritası programın bölüm başlıklarıyla', () => {
  test('Ek A\'nın kalın bölüm adlarının hepsi gerçek bir pencere başlığı', () => {
    takozKur();
    const basliklar = new Set();
    const topla = (d) => d.querySelectorAll('.ve-fp-sect > b').forEach((b) => basliklar.add(b.textContent.trim()));
    TAKOZ_TIP.forEach((t) => topla(takozPencere(t)));
    const govde = global.nodes.find((n) => n.type === 'mnt-motor');
    const nk = govde.data.pointMass; govde.data.pointMass = true; topla(takozPencere('mnt-motor')); govde.data.pointMass = nk;
    // Parametrik Analiz'in Sonuç bölümleri yalnız taramadan sonra: ASFAT, üç
    // grup × dört aday (64 kombinasyon) — uzlaşı ve on diyagram.
    global.nodes = JSON.parse(oku('assets/examples/asfat_topoloji.json')).nodes.map((n) => Object.assign(n, { def: componentDefs[n.type] }));
    const tutulan = ['57RS313773', 'amc137731', 'bmc-mount1-55sh', '57RS313773-sr116'];
    const pn = { id: 'pa-k', type: 'mnt-parametric', data: { haric: Object.keys(cp.veMntGetLibraryMap()).filter((k) => tutulan.indexOf(k) < 0) } };
    global.nodes.push(pn);
    const Hz = pa._mntParamHazirlik(pn), O = pa._mntParamOlcucu(Hz.M, global.veMntKatalog.baglam(Hz.ctx));
    const it = global.veMntKatalog.tarayici({ G: Hz.M.G, adaylar: Hz.aday, sabit: Hz.sabit, ctx: Hz.ctx, olc1: O.olc1, olc2: O.olc2, tam: true });
    it.adim(Infinity);
    ps._mntParamSonucKaydet(pn.id, Hz, O, it.depo());
    const sonuc = dom(getMntParamPropertiesHTML(pn));
    expect(sonuc.querySelectorAll('.ve-fp-kat[data-k="sonuc"] .ve-fp-sect > b').length).toBe(11);
    topla(sonuc);
    expect(basliklar.size).toBeGreaterThan(40);                       // tarama gerçekten taradı

    const src = oku('js/guide-mount.js');
    const ekA = src.slice(src.indexOf('function _gmEkA('), src.indexOf('BELGE MONTAJI'));
    const satir = [...ekA.matchAll(/\[\s*'([^']*)',\s*'([^']*)',\s*'((?:[^'\\]|\\.)*)'/g)];
    expect(satir.length).toBeGreaterThanOrEqual(15);
    const adlar = satir.flatMap((m) => [...m[3].matchAll(/<strong>([^<]+)<\/strong>/g)].map((x) => x[1]));
    expect(adlar.length).toBeGreaterThanOrEqual(20);
    expect(adlar.filter((a) => !basliklar.has(a))).toEqual([]);
  });
});

describe('ÇÖZÜMDEN BAĞIMSIZ — Takoz penceresi sonuç göstermez', () => {
  const HAZIRLIK = '[data-cozum-durumu]';
  const sade = (d) => { const k = d.cloneNode(true); k.querySelectorAll(HAZIRLIK).forEach((e) => e.remove()); return k.innerHTML; };
  function tamKur() {
    takozKur();
    TAKOZ_TIP.forEach((t) => {
      if (t === 'mount-analysis' || global.nodes.some((n) => n.type === t)) return;
      const d = componentDefs[t] || {};
      global.nodes.push({ id: t + '-t', type: t, def: d, data: d.isMountBody ? { mass: 10, cgx: 100, cgy: 0, cgz: 300, pointMass: true } : {} });
    });
  }

  test('her pencere çözümden önce ve sonra AYNI — değişen yalnız eylemin hazırlığı', () => {
    tamKur();
    const once = {};
    TAKOZ_TIP.forEach((t) => { once[t] = takozPencere(t); });
    coz();
    expect(global._veMntLast && !global._veMntLast.error).toBe(true);    // gerçekten çözüldü — kapı boşa ölçmüyor
    const sonra = {};
    TAKOZ_TIP.forEach((t) => { sonra[t] = takozPencere(t); });
    expect(TAKOZ_TIP.filter((t) => sade(once[t]) !== sade(sonra[t]))).toEqual([]);
    // Hazırlık işareti yalnız eylemi çözüme bağlı iki pencerede ve çözümle
    // gerçekten değişiyor (işaret her şeyi bağışlayan bir kaçış değil).
    const isaretli = TAKOZ_TIP.filter((t) => sonra[t].querySelector(HAZIRLIK));
    expect(isaretli.sort()).toEqual(['mnt-report', 'mnt-solver']);
    isaretli.forEach((t) => expect(once[t].innerHTML).not.toBe(sonra[t].innerHTML));
  });

  test('hazırlık sonuç taşımaz: Çözücü\'nün notu modelin büyüklüğü ve son hesabın durumu', () => {
    tamKur();
    const not = () => takozPencere('mnt-solver').querySelector(HAZIRLIK).textContent;
    expect(not()).toMatch(/ kg · \d+ kütle · \d+ takoz · hesaplanmadı$/);
    coz();
    expect(not()).toMatch(/ kg · \d+ kütle · \d+ takoz · son hesap güncel$/);
  });
});

describe('KİT — kabuğun davranışı', () => {
  const kategoriler = () => [
    { k: 'a', ad: 'Bir', govde: '<i id="ga">a</i><input id="f-a" value=""><input id="f-a2" value="">', durum: { d: 'eksik', yazi: 'eksik', neden: 'A boş', hedef: 'f-a2' } },
    { k: 'b', ad: 'İki', govde: '<i id="gb">b</i>', durum: { d: 'eksik', yazi: 'çekme', neden: '', bant: false } },
    { k: 'c', ad: 'Üç', govde: '<i>c</i>', sonuc: true, durum: { d: 'eksik', yazi: 'bayat', neden: 'Bayat' } }];

  test('bant ve gövde: bulgu banda girmez, sonuç kategorisi "Göster", hiçbir kategori gizli değil', () => {
    const d = dom(PK.vePencereKabuk({ id: 'n1' }, kategoriler(), '<b>yan</b>', { git: 'fG', sinif: 'x', nitelik: ' data-z="1"' }));
    expect(d.querySelector('.ve-fp.x[data-z="1"]')).not.toBeNull();
    expect(d.querySelector('.ve-fp-tab, .ve-fp-tabs')).toBeNull();
    const bant = [...d.querySelectorAll('#ve-fp-eksik-n1 button')].map((b) => [b.getAttribute('onclick'), b.textContent.trim()]);
    expect(bant).toEqual([["fG('n1','a','f-a2')", 'Doldur'], ["fG('n1','c')", 'Göster']]);
    expect(d.querySelector('#ve-fp-eksik-n1').nextElementSibling.id).toBe('ve-fp-panes-n1');
    const kat = [...d.querySelectorAll('#ve-fp-panes-n1 > .ve-fp-kat')];
    expect(kat.map((p) => [p.getAttribute('data-k'), p.getAttribute('data-d'), p.getAttribute('aria-label'), p.hidden]))
      .toEqual([['a', 'eksik', 'Bir', false], ['b', 'eksik', 'İki', false], ['c', 'eksik', 'Üç', false]]);
    expect(d.querySelector('.ve-fp-side').innerHTML).toBe('<b>yan</b>');
  });

  // Takoz pencereleri sonuç taşımıyor: bağlamı ya da eylemi olmayan pencere
  // (Görünümler, 3D Görüntüleyici, Koordinat Düzlemi) iki sütunlu modalda
  // 296 px'lik boş bir sütun bırakıyordu.
  test('boş sağ sütun çizilmez: kabuk tek sütuna iner', () => {
    const d = dom(PK.vePencereKabuk({ id: 'n3' }, kategoriler(), '', {}));
    expect(d.querySelector('.ve-fp-side')).toBeNull();
    expect(d.querySelector('.ve-fp-split').classList.contains('ve-fp-split--tek')).toBe(true);
    expect(dom(PK.vePencereKabuk({ id: 'n4' }, kategoriler(), '  \n ', {})).querySelector('.ve-fp-side')).toBeNull();
    expect(dom(PK.vePencereKabuk({ id: 'n5' }, kategoriler(), '<b>yan</b>', {})).querySelector('.ve-fp-split--tek')).toBeNull();
    expect(oku('css/styles.css')).toMatch(/\.ve-fp-split--tek\{ grid-template-columns:minmax\(0,1fr\); \}/);
  });

  test('kategoriye gitmek pencereyi KURMAZ; bandın bağlantısı hedefe, yoksa ilk boşa, yoksa kaba odaklanır', () => {
    document.body.innerHTML = PK.vePencereKabuk({ id: 'n2' }, kategoriler(), '', {});
    const ga = document.getElementById('ga');
    expect(PK.vePencereKategoriGit('n2', 'b')).toBe(true);
    expect(document.getElementById('ga')).toBe(ga);                   // aynı elemanlar
    expect(PK.vePencereKategoriGit('n2', 'yok')).toBe(false);
    expect(PK.vePencereKategoriGit('yok', 'a')).toBe(false);
    expect(PK.vePencereEksikGit('n2', 'a', 'f-a2')).toBe(true);
    expect(document.activeElement.id).toBe('f-a2');                   // durumun hedefi
    expect(PK.vePencereEksikGit('n2', 'a')).toBe(true);
    expect(document.activeElement.id).toBe('f-a');                    // hedefsiz: ilk BOŞ girdi
    expect(PK.vePencereEksikGit('n2', 'c')).toBe(true);
    expect(document.activeElement).toBe(document.querySelector('.ve-fp-kat[data-k="c"]'));   // boş girdi yok: kap
  });

  test('eylem satırı: solda durum yuvası, sağda düğme; süren iş satırı işaretler ve çubuğu yuvanın başına koyar', () => {
    const d = dom(PK.vePencereEylem('<button class="ve-fp-solve">Hesapla</button>', '<div class="ve-fp-durum-not">not</div>'));
    const satir = d.querySelector('.ve-fp-yurut');
    expect([...satir.children].map((e) => e.className)).toEqual(['ve-fp-yurut-d', 've-fp-solve']);
    expect(satir.hasAttribute('data-is')).toBe(false);
    expect(satir.querySelector('.ve-fp-yurut-d').textContent).toBe('not');
    expect(dom(PK.vePencereEylem('<button class="ve-fp-solve">A</button>')).querySelector('.ve-fp-yurut-d').innerHTML).toBe('');
    const is = dom(PK.vePencereEylem('<button class="ve-fp-solve">D</button>', '<div class="ve-fp-durum-not"></div>',
      { ad: 'Tarama', metin: 'Kombinasyon 3 / 8', oran: 3 / 8 })).querySelector('.ve-fp-yurut');
    expect(is.getAttribute('data-is')).toBe('1');
    expect([...is.querySelector('.ve-fp-yurut-d').children].map((e) => e.className)).toEqual(['ve-fp-ilerleme', 've-fp-durum-not']);
  });

  test('ilerleme çubuğu: oran VERİ (aria · --ilerleme), yüzde aşağı yuvarlanır ve sınırlı; aynı öğe tazelenir, null kaldırır', () => {
    global.veIkon = global.veIkon || (() => '');
    document.body.innerHTML = PK.vePencereEylem('<button class="ve-fp-solve" id="b">Hesapla</button>', '<div class="ve-fp-durum-not">not</div>');
    const b = document.getElementById('b');
    const il = PK.vePencereIlerleme(b, { ad: 'Hesap', metin: '1 / 3 · Statik', oran: 1 / 3 });
    const satir = document.querySelector('.ve-fp-yurut');
    expect(satir.getAttribute('data-is')).toBe('1');
    expect([il.getAttribute('role'), il.getAttribute('aria-label'), il.getAttribute('aria-valuenow')]).toEqual(['progressbar', 'Hesap', '33']);
    expect(il.style.getPropertyValue('--ilerleme')).toBe('33%');
    expect(il.querySelector('.ve-fp-ilerleme-y').textContent).toBe('1 / 3 · Statik%33');
    // Kimlikle de bulur ve AYNI öğeyi tazeler (genişlik geçişi kesilmez).
    expect(PK.vePencereIlerleme('b', { ad: 'Hesap', metin: '2 / 3 · Fren', oran: 0.999 })).toBe(il);
    expect([il.getAttribute('aria-valuenow'), il.querySelector('b').textContent]).toEqual(['99', '%99']);    // %100 yalnız iş bitince
    expect(il.querySelector('span').getAttribute('title')).toBe('2 / 3 · Fren');
    PK.vePencereIlerleme(b, { metin: 'x', oran: 7 });
    expect(il.getAttribute('aria-valuenow')).toBe('100');
    PK.vePencereIlerleme(b, { metin: 'x', oran: -1 });
    expect(il.getAttribute('aria-valuenow')).toBe('0');
    expect(document.querySelectorAll('.ve-fp-ilerleme').length).toBe(1);
    expect(PK.vePencereIlerleme(b, null)).toBeNull();
    expect(document.querySelector('.ve-fp-ilerleme')).toBeNull();
    expect(satir.hasAttribute('data-is')).toBe(false);
    expect(document.querySelector('.ve-fp-durum-not').textContent).toBe('not');                  // not yerinde
    expect(PK.vePencereIlerleme('yok', { oran: 0.5 })).toBeNull();                                // satırsız öğe
    expect(PK.vePencereIlerlemeHTML({ ad: 'a"<', metin: '<b>', oran: 0.5 })).not.toMatch(/<b>&|"<"/);
  });

  // Görünüm CSS'te — sözleşme satırları (geometri: e2e → EYLEM SATIRI).
  test('CSS: iş sürerken yalnız çubuk; dar kapta YAPIŞAN satırdır (düğme değil); düğme sütunun eninde değil', () => {
    const css = oku('css/styles.css');
    expect(css).toMatch(/\.ve-fp-yurut\[data-is\] \.ve-fp-yurut-d > :not\(\.ve-fp-ilerleme\)\{ display:none; \}/);
    const dar = css.slice(css.indexOf('@container vepanel (max-width:640px){'));
    expect(dar).toMatch(/\.ve-fp-side > \.ve-fp-yurut\{\s*position:sticky; bottom:-10px;/);
    expect(css).not.toMatch(/\.ve-fp-side > \.ve-fp-solve\{[^}]*sticky/);
    const dugme = css.match(/\n\.ve-fp-solve\{[^}]*\}/)[0];
    expect(dugme).not.toMatch(/width:100%/);
    expect(dugme).toMatch(/flex:none/);
    expect(css).toMatch(/\.ve-fp-ilerleme-c::before\{[^}]*width:var\(--ilerleme, 0%\)/);
  });

  test('durum YERİNDE tazelenir: kabın data-d\'si ve bant; girdiler aynı nesne, söylenmeyen durum yerinde', () => {
    document.body.innerHTML = PK.vePencereKabuk({ id: 'n6' }, kategoriler(), '', { git: 'fG' });
    const girdi = document.getElementById('f-a');
    const tamam = { d: 'ok', yazi: 'tamam' };
    expect(PK.vePencereDurumTazele('n6', [{ k: 'a', ad: 'Bir', durum: tamam }, { k: 'b', ad: 'İki', durum: undefined },
      { k: 'c', ad: 'Üç', durum: tamam, sonuc: true }], 'fG')).toBeGreaterThan(0);
    expect([...document.querySelectorAll('.ve-fp-kat')].map((k) => k.getAttribute('data-d'))).toEqual(['ok', 'eksik', 'ok']);
    expect(document.getElementById('ve-fp-eksik-n6')).toBeNull();
    expect(document.getElementById('f-a')).toBe(girdi);
    PK.vePencereDurumTazele('n6', kategoriler(), 'fG');               // ters yön: bant geri, gövdenin üstüne
    expect(document.getElementById('ve-fp-eksik-n6').nextElementSibling.id).toBe('ve-fp-panes-n6');
    expect(PK.vePencereDurumTazele('n6', kategoriler(), 'fG')).toBe(0);   // değişmeyen hiçbir şeye dokunmaz
  });
});
