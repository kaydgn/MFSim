/**
 * guide-mount-sahne.test.js — TAKOZ KILAVUZUNUN ŞEKİLLERİ (js/guide-mount.js)
 *
 * Kullanıcı isteği (2026-11-09): *"kullanıcı kılavuzunu baştan sona okuyan
 * birisi, programı açtığı andan itibaren ne yaptığını bilmeli … bol bol
 * görseller ile, yönlendirmeler ile, işaretler ile."*
 *
 * guide-mount.test.js kılavuzu programın pencereleri YÜKLENMEDEN üretir: orada
 * şekil yoktur. Bu dosya programın Takoz pencerelerini, başlangıç sayfasını ve
 * kılavuzun ekran görüntülerini (assets/kilavuz, derlemede gömülen künye) yükler
 * ve belgeyi kullanıcının aldığı hâliyle üretir. Hedeflenen hata sınıfı sessiz:
 *   • program değişir, işaretin öğesi kaybolur — numara boşluğa düşer;
 *   • lejant ile şeklin numaraları ayrışır;
 *   • metin olmayan bir şekle ya da işarete gönderme yapar;
 *   • sahne kullanıcının açık modelini çizer ya da onu değiştirir.
 * Baskıdaki yerleşim (rozet görünür mü, şekil sayfaya sığıyor mu) jsdom'da
 * ölçülemez: tests/e2e/mount-kilavuz-baski.spec.js.
 */
const fs = require('fs');
const path = require('path');
const KOK = path.join(__dirname, '../..');
const oku = (f) => fs.readFileSync(path.join(KOK, f), 'utf8');

const stubs = stubGlobals({ saveState: jest.fn(), showToast: jest.fn(), showNodeProperties: jest.fn() });
document.body.innerHTML = '<div id="ve-canvas"></div>';
global.window = global;
global.nodes = [];
global.connections = [];
eval(loadSource('components.js'));
global.veIsCanvasHidden = veIsCanvasHidden;
global.componentDefs = componentDefs;
global.VE_MODULES = VE_MODULES;

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
[require('../../js/cp-fead.js'), require('../../js/cp-fead-report.js')]
  .forEach((m) => Object.keys(m).forEach((k) => { if (global[k] === undefined) global[k] = m[k]; }));

const _stp = require('../../js/mount-step.js');
['veMntStpAksKatalog', 'veMntStpAks', 'VE_MNT_STP_MALZEME'].forEach((k) => { if (global[k] === undefined) global[k] = _stp[k]; });
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
const BAS = require('../../js/baslangic-sayfa.js');
Object.keys(BAS).forEach((k) => { if (global[k] === undefined) global[k] = BAS[k]; });
const BS = require('../../js/cp-mount-baslangic.js');
Object.keys(BS).forEach((k) => { if (global[k] === undefined) global[k] = BS[k]; });
global.veSayiAlanGoster = require('../../js/sayi-alan.js').veSayiAlanGoster;
// Motor penceresinin Katalog bölümü motor kataloğunu (Araç Performans'ın) okur
eval(loadSource('cp-engine.js'));
global.VE_FT_MOTOR_PRESETS = VE_FT_MOTOR_PRESETS;
eval(loadSource('shortcuts-help.js'));
global.veKisayolGruplariHTML = veKisayolGruplariHTML;

eval(loadSource('fead-report-template.js'));
const KIT = require('../../js/guide-kit.js');
Object.keys(KIT).forEach((k) => { global[k] = KIT[k]; });

// Derlemenin gömdüğü iki veri: örneğin topolojisi ve kılavuzun ekran görüntüleri.
const SIPER = 'assets/examples/siper_topoloji.json';
global.__MNT_TOPOLOGIES = { [SIPER]: JSON.parse(oku(SIPER)) };
const RESIM = require('../../tools/kilavuz-resim.js');
global.__MFSIM_KILAVUZ = RESIM.gomulecekler();

const GM = require('../../js/guide-mount.js');
Object.keys(GM).forEach((k) => { global[k] = GM[k]; });

beforeEach(() => resetStubs(stubs));

const KULLANICI_N = [{ id: 'kullanici', type: 'mnt-motor', data: { mass: 1 } }];
const KULLANICI_C = [{ id: 'baglanti' }];
global.nodes = KULLANICI_N;
global.connections = KULLANICI_C;
global._veMntLast = { kullanicinin: true };
const DOC = GM.veGuideMountHTML();
const KAYIP = GM.veGuideMountKayip();
const ISARET_KAYIP = KIT.veGuideIsaretKayip();
const D = new DOMParser().parseFromString(DOC, 'text/html');
const SEKIL = [...D.querySelectorAll('.page > figure.appfig')];

// ═══════════════════════════════════════════════════════════════════════════
describe('ŞEKİLLER — programdan, işaretli', () => {
  test('her şekil, işaret ve gönderme yerinde', () => {
    expect(KAYIP).toEqual([]);
    expect(ISARET_KAYIP).toEqual([]);
  });

  test('şekil sayısı ve sırası: numaralar boşluksuz', () => {
    // Parametrik Analiz'in iki şekli pencereyle birlikte kalktı (pencere boş — Canlı Not 1001)
    expect(SEKIL.length).toBeGreaterThanOrEqual(24);
    SEKIL.forEach((f, i) => {
      const cap = f.querySelector(':scope > figcaption');
      expect(cap.textContent).toMatch(new RegExp('^Şekil ' + (i + 1) + ' —'));
    });
  });

  test('her şeklin lejantı numaralarıyla birebir: rozet sayısı = satır sayısı, 1…n', () => {
    const sapan = [];
    SEKIL.forEach((f, i) => {
      const kutu = f.querySelector(':scope > .gk-sahne, :scope > .gk-ekran');
      const lej = f.querySelector(':scope > .gk-lejant');
      const rozet = kutu ? [...kutu.querySelectorAll('.gk-no')].map((r) => r.textContent) : [];
      const satir = lej ? [...lej.querySelectorAll('li > .gk-no')].map((r) => r.textContent) : [];
      if (rozet.join(',') !== satir.join(',') && rozet.slice().sort((a, b) => a - b).join(',') !== satir.join(','))
        sapan.push('Şekil ' + (i + 1) + ': rozet [' + rozet + '] lejant [' + satir + ']');
      satir.forEach((n, j) => { if (Number(n) !== j + 1) sapan.push('Şekil ' + (i + 1) + ': lejant sırası'); });
    });
    expect(sapan).toEqual([]);
    // İşaretsiz şekil yalnız klavye kısayolları (liste kendisi)
    const isaretsiz = SEKIL.filter((f) => !f.querySelector(':scope > .gk-lejant'));
    expect(isaretsiz.length).toBeLessThanOrEqual(1);
  });

  test('metindeki numara var olan bir rozettir (?) yok', () => {
    const metin = [...D.querySelectorAll('.gk-no--metin')].map((x) => x.textContent);
    expect(metin.length).toBeGreaterThan(60);
    expect(metin.filter((x) => !/^\d+$/.test(x))).toEqual([]);
    expect(D.body.textContent).not.toMatch(/(Şekil|Bölüm) \?/);
  });

  test('sahne programın KENDİ üreticisinden — pencerenin bölüm adları ve düğmeleri', () => {
    const sahne = SEKIL.map((f) => (f.querySelector(':scope > .gk-sahne') || { textContent: '' }).textContent);
    const hepsi = sahne.join(' ');
    ['Yük kitabı', 'Hesapla', 'Raporu oluştur ve indir',
      'Takoz tipi', 'Rijitlik', 'Güç grubundaki yeri'].forEach((ad) => {
      expect(hepsi).toContain(ad);
    });
    BS.veMntBaslangicKapilar().forEach((k) => expect(hepsi).toContain(k.ad.replace(/\\'/g, "'")));
    // Çözücü ve Rapor ÇÖZÜLMÜŞ hâlde: programın kendi notu
    expect(hepsi).toContain('son hesap güncel');
  });

  test('ekran görüntüleri künyeden; künyenin her görüntüsü kılavuzda kullanılıyor', () => {
    const kunye = JSON.parse(oku('assets/kilavuz/kunye.json')).resim;
    const src = oku('js/guide-mount.js');
    const kullanilan = new Set([...src.matchAll(/_gmEkran\('[^']+', '([^']+)'/g)].map((m) => m[1]));
    expect([...kullanilan].sort()).toEqual(Object.keys(kunye).sort());
    expect(RESIM.DURAKLAR.map((d) => d.ad).sort()).toEqual(Object.keys(kunye).sort());
    const ekran = D.querySelectorAll('.gk-ekran img');
    expect(ekran.length).toBe([...src.matchAll(/_gmEkran\('/g)].length);
    ekran.forEach((im) => expect(im.getAttribute('src')).toMatch(/^data:image\/webp;base64,/));
  });

  test('sayı alanı programdaki gibi Türkçe: ondalık nokta yok', () => {
    const nokta = [...D.querySelectorAll('.gk-sahne input[inputmode="decimal"][value]')]
      .map((a) => a.getAttribute('value')).filter((v) => /^[-−]?\d+\.\d+$/.test(v));
    expect(D.querySelectorAll('.gk-sahne input[inputmode="decimal"]').length).toBeGreaterThan(20);
    expect(nokta).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('KULLANICININ MODELİ DEĞİŞMEZ', () => {
  test('nodes · connections · son çözüm geri verildi (kimlik dâhil)', () => {
    expect(global.nodes).toBe(KULLANICI_N);
    expect(global.connections).toBe(KULLANICI_C);
    expect(global.nodes.length).toBe(1);
    expect(global._veMntLast).toEqual({ kullanicinin: true });
  });

  test('sahneler kullanıcının değil örneğin: kullanıcının düğümü çizilmedi', () => {
    expect(DOC).not.toContain('kullanici');
    expect(DOC).toContain('Sağ Ön Takoz');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Kılavuzun KENDİ metni — şeklin içi programındır (onu kendi kapıları tutar),
// lejant ve altyazı kılavuzun metnidir: aynı kurallar.
describe('kılavuzun metni (lejantlar dâhil)', () => {
  const kopya = D.cloneNode(true);
  kopya.querySelectorAll('style, .gk-sahne, .gk-ekran').forEach((e) => e.remove());
  const duz = kopya.body.textContent.replace(/\s+/g, ' ');

  test('ikinci kişi, yazılım anlatısı ve "sekme" yok', () => {
    const SIZ = /(?<![\p{L}])(?:siz|sizin|size|sizi)(?![\p{L}])|\p{L}+(?:sınız|siniz|sunuz|sünüz|ınız|iniz|unuz|ünüz)\p{L}{0,4}(?![\p{L}])/giu;
    const YASAK = /(?<![\p{L}])(bu programın|bilinçli\p{L}*|testi vardır|bayatla\p{L}*|ölçüldü|ölçülmüş\p{L}*|önerilen|kapı\p{L}*)(?![\p{L}])/giu;
    const bul = (re) => [...duz.matchAll(re)].map((m) => duz.slice(Math.max(0, m.index - 40), m.index + 40));
    expect(bul(SIZ)).toEqual([]);
    expect(bul(YASAK)).toEqual([]);
    expect(duz).not.toMatch(/sekme/i);
  });

  test('§ yalnız raporun bölümü; gönderme tek yazımla', () => {
    const para = [...duz.matchAll(/§\s?\d+(?:\.\d+)*/g)];
    expect(para.length).toBeGreaterThan(0);
    para.forEach((m) => expect(duz.slice(Math.max(0, m.index - 12), m.index)).toMatch(/raporun\s*$/));
    expect(duz).not.toMatch(/bölüm \d/);
  });

  test('lejantın adları cümle düzeninde ya da programdaki adla', () => {
    const { cumle } = require('../../tools/cumle-duzeni.js');
    const ad = [...D.querySelectorAll('.gk-lejant li b')].map((b) => b.textContent);
    expect(ad.length).toBeGreaterThan(100);
    expect(ad.filter((a) => cumle(a) !== a)).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('ekran görüntüleri ve derleme', () => {
  test('her görüntü dosyası var, boyutu sınırda; künyenin kutuları 0…1', () => {
    const kunye = JSON.parse(oku('assets/kilavuz/kunye.json')).resim;
    let toplam = 0;
    Object.keys(kunye).forEach((ad) => {
      const f = path.join(KOK, 'assets/kilavuz', ad + '.webp');
      expect(fs.existsSync(f)).toBe(true);
      const b = fs.statSync(f).size;
      toplam += b;
      expect(b).toBeLessThanOrEqual(160 * 1024);
      Object.values(kunye[ad].isaret).forEach((k) => {
        expect(k).toHaveLength(4);
        k.forEach((v) => { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1); });
        expect(k[2]).toBeGreaterThan(k[0]);
        expect(k[3]).toBeGreaterThan(k[1]);
      });
    });
    // Tek dosyanın boyutu takip edilir: kılavuzun payı küçük kalır (Canlı Not artık parçalı yayınlanıyor; sınır o değil)
    expect(toplam).toBeLessThan(700 * 1024);
  });

  test('derleme görüntüleri gömer: __MFSIM_KILAVUZ', () => {
    const b = oku('build.js');
    expect(b).toMatch(/require\('\.\/tools\/kilavuz-resim\.js'\)\.gomulecekler\(\)/);
    expect(b).toMatch(/'window\.__MFSIM_KILAVUZ = ' \+ JSON\.stringify\(KILAVUZ\)/);
    const g = RESIM.gomulecekler();
    expect(Object.keys(g).length).toBe(RESIM.DURAKLAR.length);
    Object.values(g).forEach((r) => {
      expect(r.src).toMatch(/^data:image\/webp;base64,/);
      expect(r.g).toBeGreaterThan(100);
      expect(r.y).toBeGreaterThan(100);
    });
  });

  test('görüntü yoksa kılavuz yine üretilir; eksik şekil kayıp listesinde', () => {
    const eski = global.__MFSIM_KILAVUZ;
    global.__MFSIM_KILAVUZ = undefined;
    try {
      const h = GM.veGuideMountHTML();
      expect(h).toContain('</html>');
      expect(GM.veGuideMountKayip().filter((k) => /^ekran /.test(k)).length).toBe(RESIM.DURAKLAR.length + 1);
    } finally { global.__MFSIM_KILAVUZ = eski; }
  });
});
