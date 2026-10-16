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
// TEK SEKMEYİ yalnız tipin BEYANI bağışlar: YER TUTUCU (componentDefs[t]
// .yerTutucu = notun metni; 3D Görüntüleyici — "Klasik 3B" gerçek CAD
// dosyasına ayrıldı) ya da TEK SEKME (.tekSekme = sebep; Görünümler — çizim
// ve işaretleri tek görünümde, kullanıcı kararı 2026-10-16). `bagis` false:
// beyan yok sayılır (bağışın gerçekten beyandan geldiğini ölçmek için).
// SAĞ SÜTUN: FEAD'de Uygunluk taşır; Takoz'da Uygunluk YASAK (sonuç yalnız
// raporda) ve sütun içeriği varsa çizilir — yoksa kabuk tek sütun.
const yerTutucu = (t) => !!(t && componentDefs[t] && componentDefs[t].yerTutucu);
const tekSekme = (t) => !!(t && componentDefs[t] && (componentDefs[t].yerTutucu || componentDefs[t].tekSekme));
const takozTipi = (t) => !!t && (/^mnt-/.test(t) || t === 'mount-analysis');
const uygunlukVar = (el) => [...el.querySelectorAll('.ve-fp-sect b')].some((x) => x.textContent.trim() === 'Uygunluk');
function aile(d, t, bagis = true) {
  const b = [];
  const fp = d.querySelector('.ve-fp');
  if (!fp) return ['kabuk yok'];
  if (!fp.firstElementChild || !fp.firstElementChild.classList.contains('ve-fp-split')) b.push('kabuktan önce şerit');
  const ana = fp.querySelector('.ve-fp-split > .ve-fp-main');
  const ilk = ana && ana.firstElementChild;
  if (!ilk || !ilk.classList.contains('ve-fp-tabs')) b.push('sekmelerin ÜSTÜNDE: ' + (ilk ? ilk.className || ilk.tagName : 'boş'));
  if (fp.querySelectorAll('.ve-fp-tabs .ve-fp-tab').length < (bagis && tekSekme(t) ? 1 : 2)) b.push('kategori sekmesi < 2');
  const yan = fp.querySelector('.ve-fp-split > .ve-fp-side');
  if (takozTipi(t)) {
    if (uygunlukVar(d)) b.push('Uygunluk (sonuç) pencerede');
    if (!yan && !fp.querySelector('.ve-fp-split.ve-fp-split--tek')) b.push('sağ sütun yok ama kabuk tek sütun değil');
    if (yan && !yan.innerHTML.trim()) b.push('boş sağ sütun');
  } else if (!yan) b.push('sağ sütun yok');
  else if (!uygunlukVar(yan)) b.push('sağ sütunda Uygunluk yok');
  if (d.querySelector('.ve-mnt-not')) b.push('eski not kutusu (.ve-mnt-not)');
  const eylem = d.querySelectorAll('.ve-fp-solve').length;
  if (eylem > 1 || eylem !== d.querySelectorAll('.ve-fp-side > .ve-fp-solve').length) b.push('eylem sağ sütunda ve tek değil');
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

  // Kabuğun işaretlemesi (şerit · sekme · bölünmüş gövde) yalnız kitte. Bir
  // modül onu yeniden yazarsa ikinci bir üretici doğar ve ilk rötuşta ayrışır
  // (2026-10-14'teki ikinci yazım iki istisna biriktirmişti).
  test('şerit ve bölünmüş gövde YALNIZ js/pencere-kabuk.js\'te basılıyor', () => {
    const bas = fs.readdirSync(path.join(KOK, 'js')).filter((f) => /\.js$/.test(f)).filter((f) => {
      const s = oku('js/' + f).split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
      return /class="ve-fp-tabs"|class="ve-fp-split"|class="ve-fp-tab"/.test(s);
    });
    expect(bas).toEqual(['pencere-kabuk.js']);
  });

  test('FEAD ve Takoz kurucuları kite gidiyor; sekme hafızası tek', () => {
    expect(oku('js/cp-fead.js')).toMatch(/return vePencereKabuk\(node,/);
    expect(oku('js/cp-mount.js')).toMatch(/return vePencereKabuk\(node, sekmeler, yan, \{/);
    expect(cp.VE_MNT_PENCERE_SEKME).toBe(PK.VE_PENCERE_SEKME);
    expect(require('../../js/cp-fead.js').veFeadPanelTabState()).toBe(PK.VE_PENCERE_SEKME);
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

  test.each([['çözümsüz', false], ['çözümlü', true]])('Takoz (%s): her pencere ailede', (_, cozulu) => {
    takozKur();
    if (cozulu) coz();
    const disarida = [];
    TAKOZ_TIP.forEach((t) => { const b = aile(takozPencere(t), t); if (b.length) disarida.push(t + ': ' + b.join(' · ')); });
    expect(disarida).toEqual([]);
  });

  // Bağış kural değil İSTİSNA: beyanı olan tip tek sekme taşır; beyanı
  // olmayan tek sekmeli pencere ailenin dışında kalır.
  test('tek sekmeyi yalnız tipin BEYANI bağışlar: yer tutucu notunu, Görünümler çizim + işaretleri gösterir', () => {
    takozKur();
    const beyanli = FEAD_TIP.concat(TAKOZ_TIP).filter(tekSekme);
    expect(beyanli.sort()).toEqual(['mnt-2dview', 'mnt-viewer']);
    expect(FEAD_TIP.concat(TAKOZ_TIP).filter(yerTutucu)).toEqual(['mnt-viewer']);
    beyanli.forEach((t) => {
      const d = takozPencere(t);
      expect(d.querySelectorAll('.ve-fp-tabs .ve-fp-tab').length).toBe(1);
      expect(aile(d, t, false)).toEqual(['kategori sekmesi < 2']);      // beyansız okunursa ailenin dışında
    });
    expect(takozPencere('mnt-viewer').querySelector('.ve-fp-main [role="tabpanel"]').textContent.trim()).toBe(componentDefs['mnt-viewer'].yerTutucu);
    const g = takozPencere('mnt-2dview').querySelector('.ve-fp-main [role="tabpanel"]');
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
  const sekmeler = () => [
    { k: 'a', ad: 'Bir', govde: '<i id="ga">a</i>', durum: { d: 'eksik', yazi: 'eksik', neden: 'A boş', hedef: 'f-a' } },
    { k: 'b', ad: 'İki', govde: '<i id="gb">b</i>', durum: { d: 'eksik', yazi: 'çekme', neden: '', bant: false } },
    { k: 'c', ad: 'Üç', govde: '<i>c</i>', sonuc: true, durum: { d: 'eksik', yazi: 'bayat', neden: 'Bayat' } }];

  test('şerit, bant, gövdeler: bulgu banda girmez, sonuç sekmesi "Aç", gizli gövde `hidden`', () => {
    const d = dom(PK.vePencereKabuk({ id: 'n1' }, sekmeler(), '<b>yan</b>', { sekmeFn: 'fS', git: 'fG', sinif: 'x', nitelik: ' data-z="1"' }));
    expect(d.querySelector('.ve-fp.x[data-z="1"]')).not.toBeNull();
    expect([...d.querySelectorAll('.ve-fp-tab')].map((t) => t.getAttribute('onclick'))).toEqual(["fS('n1','a')", "fS('n1','b')", "fS('n1','c')"]);
    const bant = [...d.querySelectorAll('#ve-fp-eksik-n1 button')].map((b) => [b.getAttribute('onclick'), b.textContent.trim()]);
    expect(bant).toEqual([["fG('n1','a','f-a')", 'Doldur'], ["fG('n1','c')", 'Aç']]);
    expect([...d.querySelectorAll('#ve-fp-panes-n1 > [role="tabpanel"]')].map((p) => p.hidden)).toEqual([false, true, true]);
    expect(d.querySelector('.ve-fp-side').innerHTML).toBe('<b>yan</b>');
  });

  // Takoz pencereleri sonuç taşımıyor: bağlamı ya da eylemi olmayan pencere
  // (Görünümler, 3D Görüntüleyici, Koordinat Düzlemi) iki sütunlu modalda
  // 296 px'lik boş bir sütun bırakıyordu.
  test('boş sağ sütun çizilmez: kabuk tek sütuna iner', () => {
    const d = dom(PK.vePencereKabuk({ id: 'n3' }, sekmeler(), '', {}));
    expect(d.querySelector('.ve-fp-side')).toBeNull();
    expect(d.querySelector('.ve-fp-split').classList.contains('ve-fp-split--tek')).toBe(true);
    expect(dom(PK.vePencereKabuk({ id: 'n4' }, sekmeler(), '  \n ', {})).querySelector('.ve-fp-side')).toBeNull();
    expect(dom(PK.vePencereKabuk({ id: 'n5' }, sekmeler(), '<b>yan</b>', {})).querySelector('.ve-fp-split--tek')).toBeNull();
    expect(oku('css/styles.css')).toMatch(/\.ve-fp-split--tek\{ grid-template-columns:minmax\(0,1fr\); \}/);
  });

  test('sekme değişince pencere KURULMAZ: aynı elemanlar, hafıza açılan sekmede', () => {
    document.body.innerHTML = PK.vePencereKabuk({ id: 'n2' }, sekmeler(), '', {});
    const ga = document.getElementById('ga');
    expect(PK.vePencereSekme('n2', 'b')).toBe(true);
    expect(document.getElementById('ga')).toBe(ga);
    expect(document.querySelector('[data-k="b"][role="tab"]').getAttribute('aria-selected')).toBe('true');
    expect(document.querySelector('#ve-fp-panes-n2 > [data-k="a"]').hidden).toBe(true);
    expect(PK.vePencereSekmeOf('n2', ['a', 'b', 'c'])).toBe('b');
    expect(PK.vePencereSekmeOf('n2', ['a', 'c'])).toBe('a');          // bu pencerede yoksa ilki
    expect(PK.vePencereSekme('yok', 'a')).toBe(false);
  });
});
