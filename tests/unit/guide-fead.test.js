/**
 * guide-fead.test.js — FEAD KULLANIM KILAVUZU (js/guide-fead.js)
 *
 * Kılavuz, "Detaylı FEAD raporu" ile BİREBİR aynı kozmetikte üretilen ama
 * çözülmüş model GEREKTİRMEYEN bir öğreti belgesidir. İki hata sınıfı hedefte:
 *
 *   1) BELGE ÜRETİLİR AMA RAPORDAN BAŞKA GÖRÜNÜR. Kozmetik gömülü şablondan
 *      çalışma anında çıkarıldığı için sınıf gerçek. Kapılar ÜRETİLEN BELGEYİ
 *      tarıyor — üreticiyi doğrudan çağırmak, o üreticinin belgeden
 *      DÜŞÜRÜLMESİNİ göremez (bu depoda en az dört kez çıkmış ders).
 *
 *   2) SAYILAR SESSİZCE BAYATLAR. §14'ün işlenmiş örneği elle yazılmış sayı
 *      taşımamalı: gerçek zincir (veFeadBuildSystem → FEADCore → veFeadAnalyze)
 *      üretim anında koşmalı. Kapı zinciri CASUSLA tutuyor — sabit basan bir
 *      sürüm değerleri doğru gösterse bile çağrıyı yapmadığı için kırmızı olur.
 */
const fs = require('fs');
const path = require('path');
const io_read = (r) => fs.readFileSync(path.join(__dirname, '../../', r), 'utf8');
const M = require('../../js/fead-model.js');
const F = require('../../js/fead-core.js');
const RP = require('../../js/cp-fead-report.js');

const stubs = stubGlobals();
document.body.innerHTML = '<div id="ve-canvas"></div>';
global.window = global;
global.nodes = [];
global.connections = [];

// Rapor varlıkları — kozmetik şablondan, fontlar Takoz raporundan (ortak).
eval(loadSource('fead-report-template.js'));
eval(loadSource('mount-report-assets.js'));

eval(loadSource('components.js'));
// components.js'teki yüklem GLOBAL'e yazılır: cp-fead.js / state.js require ile
// yükleniyor, dolayısıyla çıplak `veIsCanvasHidden` referansı bu dosyanın
// kapsamını DEĞİL global'i arar. Yazılmazsa kutusuz düğüm kapısı sessizce
// atlanır ve testler kutuların hâlâ kurulduğu bir dünyayı ölçer.
global.veIsCanvasHidden = veIsCanvasHidden;
global.componentDefs = componentDefs;
global.FEADCore = F;
const BL = require('../../js/fead-belts.js');
Object.keys(BL).forEach((k) => { global[k] = BL[k]; });
// Aksesuar kataloğu — "Devir Sınırları" ve "Katalog Modeli" kartları buna
// bağlı; yüklenmezse o kartlar hiç çizilmez ve Ek A kapısı onları sessizce
// atlardı.
const AC = require('../../js/fead-accessories.js');
Object.keys(AC).forEach((k) => { global[k] = AC[k]; });
// Uygunluk kapıları — §11.4'ün sahnesi bu modüle bağlı. Yüklenmezse kart
// "Kapılar yüklenmedi" der ve sahne üç kuralı hiç basmaz.
const CK = require('../../js/fead-checks.js');
Object.keys(CK).forEach((k) => { global[k] = CK[k]; });
// Gergi künye kütüphanesi — §7'nin sahnesi buna bağlı. Yüklenmezse kart
// "Kütüphane yüklenmedi" yazar ve o cümle KULLANICI KILAVUZUNA girer.
const TN = require('../../js/fead-tensioners.js');
Object.keys(TN).forEach((k) => { global[k] = TN[k]; });
// Çevrim kütüphanesi ve motor kataloğu — §9'un sahnesi ikisini de çiziyor.
const DT = require('../../js/fead-duty.js');
Object.keys(DT).forEach((k) => { global[k] = DT[k]; });
const EN = require('../../js/fead-engines.js');
Object.keys(EN).forEach((k) => { global[k] = EN[k]; });
// "Katalog Modeli" kartı, Araç Performans ile ORTAK preset kütüphanesine bağlı
// (veFeadPresetLib → VE_ALTERNATOR_PRESETS / VE_AC_PRESETS). Yüklenmezse kart
// hiç çizilmez ve Ek A'nın o satırı sessizce atlanırdı.
eval(loadSource('cp-accessories.js'));
global.VE_ALTERNATOR_PRESETS = VE_ALTERNATOR_PRESETS;
global.VE_AC_PRESETS = VE_AC_PRESETS;
global.VE_AIRCOMP_PRESETS = VE_AIRCOMP_PRESETS;
Object.keys(M).forEach((k) => { global[k] = M[k]; });
const CP = require('../../js/cp-fead.js');
Object.keys(CP).forEach((k) => { if (global[k] === undefined) global[k] = CP[k]; });
Object.keys(RP).forEach((k) => { global[k] = RP[k]; });
const KIT = require('../../js/guide-kit.js');
Object.keys(KIT).forEach((k) => { global[k] = KIT[k]; });
// SAHNELER İÇİN: şerit üreticisi ve uygulamanın CSS'i.
//
// `_gkStyleText` CSS'i ÇALIŞAN SAYFADAN okuyor; jsdom'da öyle bir sayfa yok,
// o yüzden gerçek css/styles.css bir <style> etiketine konuyor. Kapı böylece
// sökümün KENDİSİNİ ölçüyor — sahte bir dizeyle değil.
const RB = require('../../js/ribbon.js');
Object.keys(RB).forEach((k) => { global[k] = RB[k]; });
['css/styles.css', 'css/icons.css'].forEach((r) => {
  const st = document.createElement('style');
  st.textContent = io_read(r);
  document.head.appendChild(st);
});
const GF = require('../../js/guide-fead.js');
Object.keys(GF).forEach((k) => { global[k] = GF[k]; });
// Sihirbaz adım listesi KAYNAKTAN okunur — kılavuzun adım tablosu ona karşı
// ölçülüyor (aşağıdaki "sihirbaz adım tablosu" kapısı).
const WZ = require('../../js/cp-fead-wizard.js');

beforeEach(() => resetStubs(stubs));

// Belge bir kez üretilir; testlerin çoğu aynı çıktıyı tarıyor.
const DOC = GF.veGuideFeadHTML();

// BELGENİN KENDİ GÖVDESİ — uygulamadan gelen her şey çıkarılmış hâli.
//
// Kılavuz artık programın gerçek bileşenlerini `<figure class="appfig">`
// içinde sahneliyor (js/guide-kit.js → `veGuideScene`). O bileşenlerin HTML'i
// ve `.appfig` kapsamlı kuralları raporun kendi sözleşmesine tabidir; kılavuzun
// KENDİ yazdığı içeriği ölçen kapılar onları görmemeli, yoksa uygulamanın
// kurallarını kılavuzun ihlali sayarlar. Ayrım tek yerde tanımlı.
// Belgedeki bütün uygulama şekilleri, ve içlerinden ŞEMA olan.
const SEKILLER = DOC.match(/<figure class="appfig">[\s\S]*?<\/figure>/g) || [];
const SAHNELER = SEKILLER.filter((f) => f.indexOf('data-gk-sahne') >= 0);
const SEMA = SEKILLER.filter((f) => f.indexOf('<svg') >= 0 && f.indexOf('data-gk-sahne') < 0)[0] || '';

const KENDI = DOC
  .replace(/<figure class="appfig">[\s\S]*?<\/figure>/g, '')
  .replace(/\.appfig[^{]*\{[^}]*\}/g, '');

// ═══════════════════════════════════════════════════════════════════════════
describe('belge iskeleti', () => {
  test('tam bir HTML belgesi', () => {
    expect(DOC.startsWith('<!DOCTYPE html>')).toBe(true);
    expect(DOC.trim().endsWith('</html>')).toBe(true);
    expect(DOC).toContain('<title>MFSim — FEAD Modelleme Kılavuzu</title>');
    expect(DOC).toContain('<div class="page">');
  });

  test('raporun antet yapısı — TAM 5 alan', () => {
    // Şablon CSS'i .antet .fields'ı `grid-template-columns:repeat(5,1fr)` ile
    // kuruyor; alan sayısı beşten farklı olursa ızgara boş sütun bırakır ya da
    // satır kaydırır. Rapor da beş alan basıyor.
    expect(DOC).toContain('class="antet"');
    expect(DOC).toContain('class="band"');
    expect((DOC.match(/<div class="f">/g) || []).length).toBe(5);
  });

  test('bütün bölümler ve içindekiler tek kaynaktan', () => {
    GF.VE_GUIDE_FEAD_SECTIONS.forEach((s) => {
      expect(DOC).toContain('<h2 id="' + s[0] + '"><span class="no">' + s[1] + '</span>' + s[2]);
      expect(DOC).toContain('href="#' + s[0] + '"');
    });
    expect((DOC.match(/<h2 /g) || []).length).toBe(GF.VE_GUIDE_FEAD_SECTIONS.length);
  });

  test('içindekilerde ölü bağlantı yok', () => {
    const toc = (DOC.match(/class="toc"[\s\S]*?<\/div>/) || [''])[0];
    const hedefler = (toc.match(/href="#([^"]+)"/g) || []).map((s) => s.slice(7, -1));
    expect(hedefler.length).toBeGreaterThan(10);
    hedefler.forEach((id) => { expect(DOC).toContain('id="' + id + '"'); });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('kozmetik raporla aynı', () => {
  test('raporun palet jetonları belgede tanımlı', () => {
    ['--prusya', '--ink', '--paper', '--line', '--check', '--warn']
      .forEach((j) => { expect(DOC).toContain(j + ':'); });
  });

  test('kullanılan HER var(--…) aynı belgede tanımlı', () => {
    // Tanımsız bir var() "invalid at computed-value time"dır ve kalıtılan
    // `stroke` için sonuç `none` demektir: çizim SESSİZCE kaybolur, konsol
    // temiz kalır. Raporda ölçülmüş kusur sınıfı.
    const kullanilan = [...new Set((DOC.match(/var\((--[a-z0-9-]+)/g) || [])
      .map((s) => s.slice(4)))];
    const eksik = kullanilan.filter((j) => !DOC.includes(j + ':'));
    expect(eksik).toEqual([]);
  });

  test('ARAYÜZ jetonları yalnız .appfig İÇİNDE — dışarıda sızıntı yok', () => {
    // Uygulamanın jetonları (--fs-… --bg-… --text-…) rapor belgesinde tanımlı
    // DEĞİLDİR; şablon onları yalnız `.appfig` altında baskı paletine bağlar.
    // Kanvas çizicisinin şekli o sınıfın içinde olduğu için orada meşrudurlar;
    // dışarıda bir tanesi bile "invalid at computed-value time" demek.
    // Kapsam iki yerden gelebilir ve İKİSİ DE meşru: şeklin İÇİ (rapor
    // şablonunun kuralı) ve `.appfig ...` diye kapsanmış CSS kuralları
    // (kılavuzun sahneleri — js/guide-kit.js `_gkScopeRule`). Kapsanmamış tek
    // bir kullanım "invalid at computed-value time" demek.
    ['var(--fs-', 'var(--bg-', 'var(--text-', 'var(--accent-', 'var(--radius-']
      .forEach((j) => { expect(KENDI).not.toContain(j); });
    // Ve şeklin İÇİNDE kullandıkları gerçekten .appfig altında tanımlı olmalı —
    // bunu bir üstteki "her var(--…) tanımlı" kapısı zaten tutuyor.
  });

  test('çevrimdışı — harici URL yok', () => {
    const dis = DOC.replace(/https?:\/\/www\.w3\.org\/[^"')\s]*/g, '')
      .match(/https?:\/\/[^"')\s]+/g) || [];
    expect(dis).toEqual([]);
  });

  test('KAÇIŞLANMIŞ MARKUP sızmıyor — başlıklar kaçışlanır, içlerine etiket yazılmaz', () => {
    // `_gfTablo` başlıkları güvenli varsayılan olarak KAÇIŞLAR. İçine <sub>
    // yazmak sayfada harfi harfine "k&lt;sub&gt;stat&lt;/sub&gt;" basar: belge
    // üretilir, hata çıkmaz, yalnız BAŞLIK ÇÖP GÖRÜNÜR. Takoz kılavuzunda
    // gerçekten oldu (24 kaçak). Kapı üç kılavuzda da aynı.
    const kacak = (DOC.match(/&lt;\/?[a-z]+[^&]{0,20}&gt;/g) || []);
    expect([...new Set(kacak)]).toEqual([]);
  });

  test('sızıntı yok', () => {
    ['undefined', 'NaN', '[object', '@@'].forEach((z) => {
      expect(DOC).not.toContain(z);
    });
  });

  test('belgede çalıştırılabilir kod yok', () => {
    expect(DOC).not.toMatch(/<script/i);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('tablo sözleşmesi', () => {
  // Raporun `td` VARSAYILANI BİR SAYIDIR: mono, sağa dayalı, `white-space:nowrap`.
  // Cümle taşıyan hücre `class="l"` almalı. Alınmazsa tablo sayfayı taşırır —
  // gerçek tarayıcıda ölçüldü: tek bir hücre yüzünden 393 px taşma, yatay
  // kaydırma çubuğu, ve hiçbir hata mesajı.
  test('uzun metin taşıyan her hücre class="l" almış', () => {
    // Sahnedeki hücreler UYGULAMANIN tablosuna ait (`.ve-fead-tbl`) ve kendi
    // hizalama sınıflarını taşır; kılavuzun `td.l` sözleşmesi onları bağlamaz.
    const hucreler = KENDI.match(/<td[^>]*>[\s\S]*?<\/td>/g) || [];
    expect(hucreler.length).toBeGreaterThan(100);
    const sucLu = [];
    hucreler.forEach((h) => {
      if (/<td class="l"/.test(h)) return;
      const metin = h.replace(/<[^>]+>/g, '').replace(/&[a-z]+;/g, ' ').trim();
      if (metin.length > 28) sucLu.push(metin.slice(0, 50));
    });
    expect(sucLu).toEqual([]);
  });

  test('her tablonun künyesi var ve numaralar boşluksuz', () => {
    const nolar = (DOC.match(/<caption>Tablo (\d+) —/g) || [])
      .map((s) => Number(s.match(/\d+/)[0]));
    expect(nolar.length).toBeGreaterThan(15);
    nolar.forEach((n, i) => { expect(n).toBe(i + 1); });
  });

  test('numaralar her üretimde sıfırlanır', () => {
    const ikinci = GF.veGuideFeadHTML();
    expect((ikinci.match(/<caption>Tablo 1 —/g) || []).length).toBe(1);
    expect((DOC.match(/<caption>Tablo 1 —/g) || []).length).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('kayış yolu şeması', () => {
  test('şema .appfig sınıfı İÇİNDE', () => {
    // Sınıf düşerse çizici uygulamanın jetonlarını çözemez ve kayış,
    // kasnaklar, sarım yayları GÖRÜNMEZ olur — sayfa hatasız, konsol temiz.
    //
    // BELGEDE ARTIK BİRDEN ÇOK appfig ŞEKLİ VAR (kılavuz programın kartlarını
    // da sahneliyor); şema onlardan BİRİ. "İlk şekli al" demek, sahne sırası
    // değişince sessizce başka bir şekli ölçmek olurdu.
    expect(DOC).toContain('<figure class="appfig">');
    expect(SEMA).not.toBe('');
    expect(SEMA).toContain('<figcaption>');
  });

  test('ŞEMA KİMLİKTEN seçiliyor, konumdan değil', () => {
    // Bir kez ısırdı: Kayış Tablosunun ad hücresi düğmeye dönünce içine bir SVG
    // ikon girdi ve "ilk svg'li şekil" artık TABLOYU gösteriyordu; aşağıdaki
    // jeton kapısı 0 jeton ölçüp düşüyordu. Sahneler `data-gk-sahne` taşır,
    // kılavuzun KENDİ çizdiği şema taşımaz — çıpa bu.
    expect(SAHNELER.length).toBeGreaterThan(0);
    expect(SEMA).not.toBe('');
    expect(SEMA).not.toContain('data-gk-sahne');
    // Sahnelerin arasında SVG taşıyan biri VAR; olmasaydı bu kapı boşa düşerdi.
    expect(SAHNELER.some((f) => f.indexOf('<svg') >= 0)).toBe(true);
  });

  test('şeklin kullandığı her jeton belgenin CSS’inde tanımlı', () => {
    const jetonlar = [...new Set((SEMA.match(/var\((--[a-z0-9-]+)/g) || []).map((x) => x.slice(4)))];
    expect(jetonlar.length).toBeGreaterThan(3);
    jetonlar.forEach((j) => { expect(DOC).toContain(j + ':'); });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('işlenmiş örnek CANLI hesaplanır', () => {
  test('belge üretimi gerçek çözüm zincirini koşturuyor', () => {
    // ASIL KAPI. Sabit sayı basan bir sürüm, değerler tesadüfen doğru olsa
    // bile çağrıyı yapmadığı için burada kırmızıya döner.
    const asil = global.veFeadBuildSystem;
    let cagri = 0;
    global.veFeadBuildSystem = function () { cagri++; return asil.apply(null, arguments); };
    try { GF.veGuideFeadHTML(); } finally { global.veFeadBuildSystem = asil; }
    expect(cagri).toBeGreaterThan(0);
  });

  test('basılan kayış boyu zincirin verdiği sayının ta kendisi', () => {
    const O = GF._gfOrnekCoz();
    expect(O).not.toBeNull();
    expect(O.build.ok).toBe(true);
    expect(Number.isFinite(O.build.beltLengthMm)).toBe(true);
    expect(DOC).toContain(RP._frFs(O.build.beltLengthMm, 2) + ' mm');
    expect(DOC).toContain(RP._frFs(O.build.springTensionN, 2) + ' N');
  });

  test('çözülüyor — avara merkezi girdi, boy çıktı', () => {
    const O = GF._gfOrnekCoz();
    expect(O.gergi.data.pivotX).toBeUndefined();
    expect(Number.isFinite(O.gergi.data.cenX)).toBe(true);
    expect(O.kayis.data.effLength).toBeUndefined();
    expect(Number.isFinite(O.build.armAbsDeg)).toBe(true);
  });

  test('tedarikçi raporuna yakınsıyor', () => {
    // Kılavuzun kendi iddiası bu: program kayışı HİÇ görmeden tedarikçinin
    // kayışını geri veriyor. Eşik gevşek — burada ölçülen şey modelin
    // doğruluğu değil (onun kapısı fead-example-ag00976.test.js), kılavuzun
    // DOĞRU ÖRNEĞİ kurduğu.
    const O = GF._gfOrnekCoz();
    const G = GF.VE_GUIDE_FEAD_GATES;
    const boySapma = Math.abs(O.build.beltLengthMm - G.belt) / G.belt * 100;
    const gerSapma = Math.abs(O.build.springTensionN - G.design) / G.design * 100;
    expect(boySapma).toBeLessThan(1);
    expect(gerSapma).toBeLessThan(2);
  });

  test('örnek KAYIT DEFTERİ bozulmuyor', () => {
    // Kılavuz örneğin kayış boyunu siliyor. `veFeadExampleNodes` `data`yı
    // derin kopyalıyor, ama ham kayda yazılsaydı fead-example-ag00976
    // tabanı SESSİZCE kayardı.
    GF.veGuideFeadHTML();
    const ham = veFeadExampleOf('AG00976_GATES_2025');
    const g = ham.pulleys.filter((p) => p.type === 'fead-tensioner')[0];
    expect(g.data.cenX).toBeDefined();
    expect(g.data.pivotX).toBeUndefined();
    const kayis = ham.belt;
    expect(kayis.effLength).toBeDefined();
  });

  test('sapma yüzdesi işaretli ve Türkçe biçimde', () => {
    expect(GF._gfSapma(101, 100)).toBe('+1,00%');
    expect(GF._gfSapma(99, 100)).toBe('−1,00%');
    expect(GF._gfSapma(NaN, 100)).toBe('—');
    expect(GF._gfSapma(1, 0)).toBe('—');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('14.1 — gergi satırı diğerlerinden AYRIŞIR', () => {
  // KULLANICI BİLDİRİMİ (2026-08-29): "Bu 'otomatik gergi' kısmı hatalı. Oraya
  // X ve Y olarak 'pivot' değerleri girilmiş. Halbuki oraya montaj referans
  // noktası girilecek."
  //
  // Ölçüldü: DEĞER doğruydu (Gates'in Pivot Point satırı, −250/110 — ve
  // raporlarda "mounting reference point" diye ayrı bir alan YOK), kusur
  // SUNUMDAYDI. Tek bir "X [mm]/Y [mm]" sütunu iki farklı noktayı taşıyordu:
  // beş satırda kasnak merkezi, gergi satırında montaj referans noktası — ve
  // aradaki fark rastgele değil, TAM KOL BOYU (90 mm). Ayrım X hücresine
  // sıkıştırılmış "pivot" kelimesiyle anlatılıyordu; Y hücresinde hiçbir işaret
  // yoktu. Artık koordinatın NE OLDUĞU kendi sütununda.
  const tablo = (DOC.match(/<caption>Tablo \d+ — Kasnak künyeleri[\s\S]*?<\/table>/) || [''])[0];
  const satirlar = tablo.match(/<tr>[\s\S]*?<\/tr>/g) || [];

  test('tablo bulunuyor ve yedi sütunlu', () => {
    expect(tablo.length).toBeGreaterThan(200);
    expect(tablo).toContain('Koordinat neyi gösteriyor');
    expect((satirlar[0].match(/<th>/g) || []).length).toBe(7);
  });

  test('altı satırın altısı da "kasnak merkezi" der', () => {
    const govde = satirlar.slice(1);
    expect(govde.length).toBe(6);
    expect(govde.filter((r) => /kasnak merkezi/.test(r))).toHaveLength(5);
    expect(govde.filter((r) => /avara kasnağının merkezi/i.test(r))).toHaveLength(1);
  });

  test('gergi satırı LAYOUT DATA koordinatını basar — Pivot Point\'i DEĞİL', () => {
    // İkisi 90 mm apayrı; yanlışını basmak sessizce başka bir sistemi anlatırdı.
    const g = (tablo.match(/<tr>(?:(?!<\/tr>)[\s\S])*avara kasnağının merkezi[\s\S]*?<\/tr>/i) || [''])[0];
    const C = GF.VE_GUIDE_FEAD_GATES.tenXY;
    expect(g).toContain(RP._frF(C[0], 2));
    expect(g).toContain(RP._frF(C[1], 2));
    // Tensioner Data'daki montaj konumu bu satırda GEÇMEMELİ.
    expect(g).not.toContain(RP._frF(GF.VE_GUIDE_FEAD_GATES.pivot[0], 2));
  });

  test('X hücresine sıkıştırılmış "pivot" etiketi KALMADI', () => {
    expect(tablo).not.toContain('<em>pivot');
  });

  test('rol sütunu gergiyi ADLANDIRIR — adı değişse de ayırt edilsin', () => {
    // Bir dönem yalnız `driver`a bakıyordu ve gergi satırında '—' yazıyordu;
    // o satırı ayırt eden tek şey kasnağın ADIYDI.
    const g = (tablo.match(/<tr>(?:(?!<\/tr>)[\s\S])*avara kasnağının merkezi[\s\S]*?<\/tr>/i) || [''])[0];
    expect(g).toMatch(/>gergi</);
    expect(tablo).toContain('>avara<');
    expect(tablo).toContain('>aksesuar<');
  });

  test('ayrım kutuyla ve ölçülmüş bedeliyle yazılı', () => {
    expect(DOC).toContain('Gergi satırı da bir KASNAK MERKEZİDİR');
    expect(DOC).toContain('Pivot Point');
    expect(DOC).toContain('Layout Data');
    expect(DOC).toContain('+%1526');       // yanlış nokta girilirse gerginlik
    expect(DOC).toContain('0,065 mm');     // iki noktanın kol boyu özdeşliği
  });

  test('14.2 montaj konumunun TÜREYEN olduğunu sayıyla kapatıyor', () => {
    // Girilen nokta gerçekten avara merkezi olarak kullanılıyorsa, ondan
    // türeyen montaj konumu raporun KENDİ Tensioner Data satırına oturmalı.
    // O satır modele HİÇ girmiyor — bağımsız ölçü, kapı değil.
    const O = GF._gfOrnekCoz();
    const p = M.veFeadTensionerPivot(O.gergi.data);
    const G = GF.VE_GUIDE_FEAD_GATES;
    const d = Math.sqrt(Math.pow(p[0] - G.pivot[0], 2) + Math.pow(p[1] - G.pivot[1], 2));
    expect(d).toBeLessThan(0.05);                    // raporun satırına oturuyor
    expect(DOC).toContain('Gövdenin montaj konumu');
    expect(DOC).toContain(RP._frFs(d, 3) + ' mm');
  });

  test('iki koordinat arasındaki mesafe TAM KOL BOYU (çıpa)', () => {
    const G = GF.VE_GUIDE_FEAD_GATES;
    const d = Math.sqrt(Math.pow(G.tenXY[0] - G.pivot[0], 2)
                      + Math.pow(G.tenXY[1] - G.pivot[1], 2));
    expect(Math.abs(d - G.arm)).toBeLessThan(0.01);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('içerik yönlendirici', () => {
  test('adım listeleri var — kılavuz “şunu yap” diyor', () => {
    expect((DOC.match(/<ol>/g) || []).length).toBeGreaterThan(6);
  });

  test('sessiz tuzaklar bölümü ölçülmüş bedelleri yazıyor', () => {
    expect(DOC).toContain('Temas tarafı');
    expect(DOC).toContain('+%1526');
    // ...ve karışıklığın SESSİZ kalabildiği yazılı: sayı büyük ama uyarı yok.
    expect(DOC).toContain('5/14 sistemde uyarı YOK');
  });

  test('kayma emniyetinin yük taşıyan ayrımı anlatılıyor', () => {
    // Panel ham en küçüğü basıyor, rapor yalnız yük taşıyanların en küçüğünü.
    // Kılavuz bu ayrımı yazmazsa iki belge birbiriyle çelişir.
    expect(DOC).toContain('kapasitesi');
    expect(DOC).toMatch(/gerginlik oranı/i);
  });

  test('montaj konumu ile avara merkezi ayrımı yazılı', () => {
    expect(DOC).toContain('Buraya montaj konumu yazılmaz');
  });

  test('Başlangıç Sihirbazı açılış yolu olarak anlatılıyor', () => {
    expect(DOC).toContain('Başlangıç Sihirbazı');
    expect(DOC).toContain('Sihirbaz adımları');
    // Boş modül SİHİRBAZLA karşılıyor (2026-09-09); kılavuz bunu yazmazsa
    // kullanıcı kendiliğinden açılan pencereyi bir hata sanar.
    expect(DOC).toMatch(/Sihirbaz(ı)? ile karşılar/);
  });

  // AÇILIŞ KARTLARI PROGRAMDAN OKUNUR — kılavuza sayı yazılmaz.
  //
  // Bu liste iki kez değişti: önce "Başlangıç ve Örnekler" eklendi, sonra
  // KALDIRILDI (sunduğu iki şey sihirbazın 1. adımında zaten vardı). Kılavuz
  // her ikisinde de eski sayıyı yazmaya devam etti ve hiçbir kapı görmedi.
  test('kılavuz açılışta gelen kartları doğru sayıyor', () => {
    const src = io_read('js/cp-fead.js');
    const m = /\[([^\]]*)\]\.forEach\(function\(tip, k\)/.exec(src);
    expect(m).toBeTruthy();
    const tipler = (m[1].match(/'([^']+)'/g) || []).map((x) => x.slice(1, -1));
    expect(tipler.length).toBeGreaterThan(0);
    // Kılavuz her kartı ADIYLA anmalı...
    tipler.forEach((t) => { expect(DOC).toContain(componentDefs[t].name); });
    // ...ve KALDIRILMIŞ kartı anmamalı.
    expect(componentDefs['fead-example']).toBeUndefined();
    expect(DOC).not.toContain('Başlangıç ve Örnekler');
  });

  // SİHİRBAZ ADIMLARI PROGRAMDAN OKUNUR — kılavuza kopyalanmaz.
  //
  // Eski kapı beş adım adını sabit bir listeden kontrol ediyordu ve içinde
  // 'Kayış Yolu' vardı. O adım 2026-09-04'te KALKTI (sıra artık kasnak
  // tablosunun kendisi), ama kapı yeşil kaldı: "Kayış Yolu" belgede araç
  // kartının ADI olarak da geçiyor, yani kapı adımı değil kelimeyi ölçüyordu.
  // Şimdi kaynak VE_FW_STEPS'in kendisi.
  test('sihirbaz adım tablosu programdaki adımlarla birebir', () => {
    const adimlar = WZ.VE_FW_STEPS.map((x) => x.ad);
    expect(adimlar.length).toBeGreaterThan(3);
    adimlar.forEach((ad, i) => {
      // Tablo satırı "<n> · <ad>" biçiminde: hem ad hem SIRA doğru olmalı.
      expect(DOC).toContain((i + 1) + ' · ' + ad);
    });
    // ...ve kalkan adım geri gelmiş gibi anlatılmıyor.
    expect(DOC).not.toContain('3 · Kayış Yolu');
    expect(DOC).toContain('Ayrı bir “Kayış Yolu” adımı yok');
  });

  test('hızlı başvuru eki alan → panel eşlemesi veriyor', () => {
    expect(DOC).toContain('Alan → Panel Hızlı Başvurusu');
    expect(DOC).toContain('Gergi Künye Kütüphanesi');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  SAHNELER — "şu düğmeye bas" derken düğmenin KENDİSİ
// ═══════════════════════════════════════════════════════════════════════════
//
// Kılavuz artık programın gerçek bileşenlerini belgeye gömüyor (guide-kit.js →
// `veGuideScene`). Buradaki kapıların tamamı TEK bir soruyu soruyor: sahnedeki
// şey gerçekten ÜRETİCİDEN mi geldi? Elle yazılmış bir kopya da aynı görünür,
// ve tam o yüzden ölçülmesi gereken şey görüntü değil KÖKEN.
describe('sahneler programın kendi bileşeni', () => {
  const sahneler = SEKILLER.filter((f) => f.indexOf('data-gk-sahne=') >= 0);

  // SAYI KAYNAKTAN. Üretici patlarsa `_gfSahneHTML` boş dönüyor ve sahne HİÇ
  // çizilmiyor — sayının düşmesi sessiz bir kayıp. Elle yazılmış bir sayı ise
  // her yeni sahnede kapıyı kırar ve "güncelle geç" alışkanlığı doğurur;
  // bu yüzden beklenen sayı `_gfSahne*` çağrılarından okunuyor.
  test('kaynaktaki her sahne çağrısı belgede karşılığını buldu', () => {
    const src = io_read('js/guide-fead.js');
    const cagri = (src.match(/h \+= _gfSahne\w+\(/g) || []).length;
    expect(cagri).toBeGreaterThan(3);
    expect(sahneler.length).toBe(cagri);
    // Numaralar 1..N ve tekrarsız: sayaç elle yazılsaydı araya bir sahne
    // girince kayardı (raporun tablo sayacındaki ders).
    const no = sahneler.map((f) => Number((f.match(/data-gk-sahne="(\d+)"/) || [])[1]));
    expect(no).toEqual(no.map((_, i) => i + 1));
    sahneler.forEach((f, i) => { expect(f).toContain('Şekil ' + (i + 1) + ' —'); });
  });

  test('her ANA yüzeyin bir sahnesi var', () => {
    // Kullanıcı kılavuzunun sözü: "gerektiği yerde resim". Bu liste o sözün
    // kendisi — bir yüzey sessizce resimsiz kalırsa burada görünür.
    // Her satır: yüzeyin adı → o yüzeyde OLAN, başka yüzeyde OLMAYAN bir işaret.
    const gerek = {
      'Kayış Tablosu': 've-fead-tbl',
      'şerit düğmesi': 've-rb-btn',
      'kasnak paneli': 'Devir Sınırları',
      'gergi paneli': 'Avara Kasnağının Merkezi',
      'kayış paneli': 'Kayış Tipine Bağlı Çıktılar',
      'çözücü paneli': 'Algılanan Model',
      'rapor paneli': 'Detaylı Raporu',
      'dönüş yönü': 'Kayış Dönüş Yönü'
    };
    const eksik = Object.keys(gerek)
      .filter((k) => !sahneler.some((f) => f.indexOf(gerek[k]) >= 0));
    // İKİ TUVAL KARTI AYRI AYRI ARANIR ve işaret `<svg` DEĞİL.
    // İkisi de aynı çiziciden geçtiği için ikisinde de svg var; dahası gergi
    // panelinin T(θ) grafiği de bir svg. "Svg taşıyan bir sahne olsun" demek,
    // DONUK şemayı silen bir değişikliği kaçırıyordu (ölçüldü). İşaret kayış
    // yolunun kendi çizgisi; ayrım da seçicide: donuk kart devir okumaz.
    const yol = sahneler.filter((f) => f.indexOf('data-ve="belt"') >= 0);
    if (!yol.some((f) => f.indexOf('Senaryo — motor çevrimi') < 0))
      eksik.push('kayış yolu şeması (donuk)');
    if (!yol.some((f) => f.indexOf('Senaryo — motor çevrimi') >= 0))
      eksik.push('çalışma noktası (canlı)');
    // UYGUNLUK KAPILARI KENDİ BAŞINA. Kart, Çözücü panelinin de parçası
    // olduğu için "Uygunluk Kapıları geçiyor mu" demek §11.4'ün ayrı sahnesini
    // silen değişikliği kaçırıyordu (ölçüldü — çözücü sahnesi kapıyı tek
    // başına yeşil tutuyordu). Ayrım: tek başına duran sahnede panelin geri
    // kalanı YOK.
    if (!sahneler.some((f) => f.indexOf('Uygunluk Kapıları') >= 0
                           && f.indexOf('Algılanan Model') < 0))
      eksik.push('uygunluk kapıları (tek başına)');
    expect(eksik).toEqual([]);
  });

  test('Kayış Tablosu sahnesi ÜRETİCİNİN çıktısı', () => {
    const f = sahneler.filter((x) => x.indexOf('ve-fead-tbl') >= 0)[0] || '';
    expect(f).not.toBe('');
    // Sütun başlıkları tablonun KENDİ sütun listesinden gelmeli.
    VE_FEAD_TABLE_COLS.map((c) => c.t).filter((t) => t && t !== '#')
      .forEach((t) => { expect(f).toContain(t); });
    // ...ve satırlar örnek modelin GERÇEK kasnaklarını taşımalı: sahne canlı
    // çözülmüş bir modelin üstünde duruyor, boş bir iskelet değil.
    expect(f).toContain('Alternatör');
    expect(f).toContain('Σsarım');
    // Çözümden gelen sayı: kapanan çevrimin işareti.
    expect(f).toMatch(/360[.,]00/);
  });

  test('şerit düğmesi sahnesi ŞERİT KAYIT DEFTERİNDEN', () => {
    const f = sahneler.filter((x) => x.indexOf('ve-rb-btn') >= 0)[0] || '';
    expect(f).not.toBe('');
    // Düğme kayıt defterindeki ögenin ta kendisi olmalı — adı ve ikonu
    // oradan gelir. Elle yazılmış bir düğme bu üçünü de taklit edebilirdi,
    // o yüzden ÜRETİCİNİN çıktısıyla birebir karşılaştırılıyor.
    const item = (() => {
      let bulunan = null;
      RB.VE_RIBBON_TABS.forEach((t) => (t.groups || []).forEach((g) =>
        (g.items || []).forEach((it) => { if (it.run === 'veTidyLayout') bulunan = it; })));
      return bulunan;
    })();
    expect(item).toBeTruthy();
    expect(f).toContain('mf-ico-' + item.icon);
    expect(f).toContain(item.label);
    // ...VE ETKİN ÇİZİLMİŞ. Pasif bir düğme kullanıcıya "bu kullanılamaz" der;
    // anlatılan şeyin tam tersi. `_gfSeritEtkin` bozulursa burada görülür.
    expect(f).not.toContain('is-disabled');
    expect(f).not.toContain('aria-disabled');
  });

  test('kasnak paneli sahnesi AKSESUAR kasnağını gösteriyor', () => {
    // Sürücü kasnak seçilseydi "Katalog Modeli" ve "Devir Sınırları" kartları
    // hiç çizilmezdi ve altyazı olmayan bir şeyi anlatırdı (kart-adı kapısında
    // ölçülmüş sınıf).
    const f = sahneler.filter((x) => x.indexOf('Devir Sınırları') >= 0)[0] || '';
    expect(f).not.toBe('');
    expect(f).toContain('Temas Tarafı');
    // AYIRT EDİCİ: aksesuar künye seçicisi YALNIZ `VE_FEAD_ACC_TYPE`'ta karşılığı
    // olan tiplerde çizilir (alternatör · klima). "Katalog Modeli" bu işi
    // GÖRMÜYOR — sürücü kasnakla ölçüldü, o kart orada da çıkıyor ve mutasyon
    // kapıdan geçiyordu.
    expect(f).toContain('BMC künyesi');
    const tipler = Object.keys(VE_FEAD_ACC_TYPE);
    expect(tipler.length).toBeGreaterThan(0);
    // Sahnedeki düğüm gerçekten o tiplerden birine ait olmalı.
    const id = (f.match(/ve-fead-od-([\w-]+)/) || [])[1] || '';
    const dugum = (global.nodes || []).concat(GF._gfOrnekCoz().pack.nodes)
      .filter((n) => n.id === id)[0];
    expect(dugum).toBeTruthy();
    expect(tipler).toContain(dugum.type);
  });

  test('uygunluk kapıları sahnesi ÜÇ KURALI da basıyor', () => {
    const f = sahneler.filter((x) => x.indexOf('Uygunluk Kapıları') >= 0)[0] || '';
    expect(f).not.toBe('');
    ['Kasnak merkez mesafesi', 'Çevrim oranı penceresi', 'Aksesuar devir sınırı']
      .forEach((k) => { expect(f).toContain(k); });
  });

  test('sahne CSS’i UYGULAMADAN söküldü ve .appfig altına kapsandı', () => {
    const css = (DOC.match(/<style>[\s\S]*?<\/style>/g) || []).join('\n');
    // Kural gerçekten söküldü mü — kaynak css/styles.css'teki tablo kuralları.
    expect(css).toContain('.appfig .ve-fead-tbl');
    expect(css).toContain('.appfig .ve-rb-btn');
    // ...ve KAPSANMAMIŞ bir uygulama kuralı yok: `_gkScopeRule` atlanırsa
    // uygulamanın kuralları belgenin kendi gövdesine de uygulanırdı.
    const kapsamsiz = (css.match(/(^|\n)\s*\.(ve-fead-tbl|ve-rb-btn|mf-ico)[^{]*\{/g) || []);
    expect(kapsamsiz).toEqual([]);
  });

  test('söküm EKSİKSİZ — kaynaktaki her sınıf belgede karşılıklı', () => {
    // ÖLÇÜLDÜ VE ISIRDI: söküm tarayıcısı CSS yorumlarını silmezse, süslü
    // parantez taşıyan bir yorum (bu depoda beş tane var) parantez sayacını
    // kaydırıyor ve ONDAN SONRAKİ kurallar sessizce düşüyor — 58 seçicinin
    // 20'si kayboldu, künye şeridi bitişik, birim satırları yan yana çizildi.
    // Belge yine üretildi, hata çıkmadı.
    //
    // Kapı BAĞIMSIZ SAYIYOR: sökücünün kendi çıktısını sökücüye sordurmak,
    // bozuk bir sökücünün kendisiyle tutarlı kalması demekti.
    const kaynak = io_read('css/styles.css').replace(/\/\*[\s\S]*?\*\//g, '');
    const belgeCss = (DOC.match(/<style>[\s\S]*?<\/style>/g) || []).join('\n');
    // İKİ YÜZEY BİRDEN: `@media`'ya girmeyi kapatan mutasyon kuralı SIZDIRMIYOR,
    // parantez sayacını kaydırıp SONRAKİLERİ düşürüyor — ve yalnız tablo
    // sınıflarına bakan bir kapı o kaymayı ıskalayabiliyordu (ölçüldü).
    const sinif = [...new Set([
      ...(kaynak.match(/\.ve-fead-tbl[\w-]*/g) || []),
      ...(kaynak.match(/\.ve-rb-btn[\w-]*/g) || []),
      ...(kaynak.match(/\.ve-rb-(?:ico|lbl)[\w-]*/g) || [])
    ])];
    expect(sinif.length).toBeGreaterThan(18);
    const eksik = sinif.filter((c) => belgeCss.indexOf('.appfig ' + c) < 0
                                   && belgeCss.indexOf(c + ' ') < 0
                                   && belgeCss.indexOf(c + '{') < 0
                                   && belgeCss.indexOf(c + ',') < 0
                                   && belgeCss.indexOf(c + ':') < 0);
    expect(eksik).toEqual([]);
  });

  test('geniş sahne SAYFAYA SIĞDIRILDI', () => {
    // Kayış Tablosu doğal hâlinde sayfadan geniş. Ölçeklenmezse yatay kaydırma
    // ekranda çare olur ama BASKIDA sağdaki sütunlar kaybolur — belge A4.
    const f = sahneler.filter((x) => x.indexOf('ve-fead-tbl') >= 0)[0] || '';
    const z = /zoom:([\d.]+)/.exec(f);
    expect(z).toBeTruthy();
    const oran = Number(z[1]);
    expect(oran).toBeGreaterThan(0.5);
    expect(oran).toBeLessThan(1);
    // ...ve ölçek GERÇEKTEN yetiyor: doğal genişlik × oran ≤ sayfa.
    const dogal = KIT._gkNaturalWidth(f);
    const sayfa = KIT._gkPageWidth();
    expect(dogal).toBeGreaterThan(sayfa);
    expect(dogal * oran).toBeLessThanOrEqual(sayfa);
  });

  // SÖKÜCÜNÜN KENDİSİ — belge üzerinden ölçülemeyen iki kural.
  //
  // Bugünkü css/styles.css bu iki hatayı AYIRT ETMİYOR: `@media` içine girmeyi
  // kapatan bir değişiklik aynı 84 kuralı üretiyor (ölçüldü). Yani belge
  // üzerinden kurulan bir kapı boş yere yeşil kalırdı — kaynak bugün öyle
  // dizildiği için, kural doğru olduğu için değil. Girdi burada sentetik ve
  // hatayı görünür kılıyor.
  describe('sökücünün kuralları', () => {
    test('@media içindeki kural ÜST SEVİYE sayılmaz', () => {
      const css = '.ve-fead-tbl{color:red}'
        + '@media (max-width:900px){.ve-fead-tbl{color:blue}}'
        + '.ve-fead-tbl-head{color:green}';
      const r = KIT._gkTopRules(css, ['.ve-fead-tbl']);
      const govde = r.map((x) => x.body).join(';');
      expect(govde).toContain('red');
      expect(govde).toContain('green');
      // Dar ekran kuralı sızarsa düğme her ekranda o biçimde çizilir.
      expect(govde).not.toContain('blue');
      // ...ve @media'dan SONRAKİ kural düşmemeli: parantez sayacı kayarsa
      // asıl hasar sızıntı değil, sessiz KAYIP olur.
      expect(r.length).toBe(2);
    });

    test('süslü parantez taşıyan YORUM sayacı kaydırmaz', () => {
      const css = '.ve-fead-tbl{color:red}'
        + '/* örnek: [hidden]{display:none} kuralını yener */'
        + '.ve-fead-tbl-head{color:green}';
      const r = KIT._gkTopRules(css, ['.ve-fead-tbl']);
      expect(r.length).toBe(2);
      expect(r.map((x) => x.body).join(';')).toContain('green');
    });

    test('kaynaktaki gerçek dar-ekran bildirimi belgede yok', () => {
      // Kaynakta `@media (max-width:900px){ .ve-rb-btn--lg{min-height:54px} }`
      // var; belgede o bildirim hiç geçmemeli.
      const belge = (DOC.match(/<style>[\s\S]*?<\/style>/g) || []).join('\n')
        .replace(/\s+/g, '');
      expect(io_read('css/styles.css').replace(/\s+/g, ''))
        .toContain('.ve-rb-btn--lg{min-height:54px;}');
      expect(belge).not.toContain('.ve-rb-btn--lg{min-height:54px;}');
    });
  });

  test('hiçbir sahne "yüklenmedi/bulunamadı" yazmıyor', () => {
    // ÖLÇÜLDÜ VE GÖRÜLDÜ: gergi künye kütüphanesi yüklü değilken sahne
    // "Kütüphane yüklenmedi (js/fead-tensioners.js)." yazıyordu — bir geliştirici
    // mesajı, kullanıcı kılavuzunun ortasında. Sahne bir bileşenin GERÇEK hâlini
    // göstermeli; eksik bir bağımlılıkla çizilmiş hâlini değil.
    const kotu = [];
    sahneler.forEach((f, i) => {
      const metin = f.replace(/<[^>]+>/g, ' ');
      [/yüklenmedi/i, /bulunamadı/i, /çizilemedi/i].forEach((re) => {
        const m = re.exec(metin);
        if (m) kotu.push('sahne ' + (i + 1) + ': ' + m[0]);
      });
    });
    expect(kotu).toEqual([]);
  });

  test('sahnenin istediği her jeton karşılıklı — eksik yok', () => {
    // Eksik bir jeton belgeyi ÜRETMEYİ engellemez, yalnız o kuralı çöpe atar:
    // soluk bir renk, kayıp bir çerçeve. Gürültü burada çıkar.
    expect(KIT.veGuideSceneMissingTokens()).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  KILAVUZ ↔ PROGRAM — panel adları GERÇEKTEN programdaki başlıklar mı
// ═══════════════════════════════════════════════════════════════════════════
//
// KAPI BOŞLUĞUYDU VE ISIRDI. Kılavuz Ek A'da şunu YAZIYOR: "Panel adları
// programdaki başlıklarla birebir aynıdır." Bu bir iddiadır ve bir dönem
// YANLIŞTI: gergi panelinden kip seçicisi, "Ölçülmüş Pivot" alanları ve
// "Doğrulama" kartı kaldırıldığında kılavuzun §7'si onları anlatmaya devam
// etti — 62 kapının hiçbiri kırmızıya dönmedi, çünkü hepsi belgeyi kendi
// içinde tarıyordu. Belge tutarlıydı; anlattığı program yoktu.
//
// Kapı bu yüzden İKİ YÜZEYİ birbirine bağlıyor: Ek A'nın kart adları
// GERÇEKTEN render edilen panelde geçmeli. Ek A'yı ayrı bir sabit listeye
// kopyalamak ikinci bir kaynak olurdu (bu deponun tekrar eden hatası);
// kapı adları belgenin KENDİ tablosundan söküyor.
describe('kılavuz ↔ program: kart adları', () => {
  // Panel HTML'i BURADA bir kez alınır ve global'ler GERİ VERİLİR: zarf
  // okuması veFeadBuildFromCanvas() üzerinden `nodes`/`connections`'ı okuyor,
  // ama onları kalıcı olarak değiştirmek bu dosyadaki diğer kapıların
  // gördüğü dünyayı sessizce değiştirirdi.
  const PANEL = (() => {
    const pack = veFeadExampleNodes('AG00976_GATES_2025');
    pack.nodes.forEach((n) => { n.def = componentDefs[n.type]; });
    let ten = null;
    let belt = null;
    pack.nodes.forEach((n) => {
      const d = componentDefs[n.type] || {};
      if (d.isFeadTensioner) ten = n;
      if (d.isFeadBelt) belt = n;
    });
    // KAPI GERGİ VE KAYIŞLA SINIRLIYDI — VE BU BİR BOŞLUKTU. Kasnakların
    // kanvas kutuları kalkıp veri girişi Kayış Tablosu'na taşındığında
    // kılavuzun §4/§5'i, Ek A'nın "Konum Bağı" satırı ve §11.2'nin "K/S
    // rozeti" tablosu olmayan bir programı anlatmaya devam etti; 43 kapının
    // hiçbiri kırmızıya dönmedi çünkü hiçbiri KASNAK, ÇÖZÜCÜ ya da TABLO
    // yüzeyine bakmıyordu. Zarf artık dördünü birden alıyor.
    // KASNAK PANELİ TİPE GÖRE DEĞİŞİYOR: "Katalog Modeli" ve "Devir Sınırları"
    // yalnız aksesuar kasnaklarında (alternatör · klima · hava kompresörü)
    // çiziliyor, sürücü kasnakta çizilmiyor. Ek A "Kasnak paneli" derken
    // ikisini birden kastediyor, o yüzden zarf da ikisinin BİRLEŞİMİ.
    let surucu = null;
    let aks = null;
    let sol = null;
    pack.nodes.forEach((n) => {
      const d = componentDefs[n.type] || {};
      if (d.isFeadSolver) sol = n;
      if (!d.isFeadPulley || d.isFeadTensioner) return;
      if (n.data && n.data.driver && !surucu) surucu = n;
      else if (VE_FEAD_ACC_TYPE && VE_FEAD_ACC_TYPE[n.type] && !aks) aks = n;
    });
    const tbl = { id: 'tbl-1', type: 'fead-table', data: {} };
    const eskiN = global.nodes;
    const eskiC = global.connections;
    global.nodes = pack.nodes;
    global.connections = pack.connections;
    try {
      return {
        Gergi: getFeadTensionerPropertiesHTML(ten),
        'Kayış Özellikleri': getFeadBeltPropertiesHTML(belt),
        Kasnak: getFeadPulleyPropertiesHTML(surucu)
              + (aks ? getFeadPulleyPropertiesHTML(aks) : ''),
        'Çözücü': sol ? getFeadSolverPropertiesHTML(sol) : '',
        // Kayış Tablosu bir PANEL değil bir KANVAS KARTI: Ek A onu kart
        // adıyla değil sütun adlarıyla anlatıyor, kapısı da aşağıda ayrı.
        'Kayış Tablosu': veFeadTableCardHTML(tbl),
      };
    } finally {
      global.nodes = eskiN;
      global.connections = eskiC;
    }
  })();

  // Ek A tablosunun satırları: [aradığınız, panel, kart]
  const ekA = (DOC.match(/<caption>Tablo [^<]*Alan → panel eşlemesi<\/caption>[\s\S]*?<\/table>/) || [''])[0];
  const satir = (ekA.match(/<tr>[\s\S]*?<\/tr>/g) || []).slice(1);
  const duz = (x) => x
    .replace(/<[^>]+>/g, '')
    .replace(/\([^)]*\)/g, '')       // "(ya da tuvaldeki rozet)" bir kart adı değil
    .replace(/&[a-z]+;/g, ' ')
    .trim();

  test('Ek A tablosu sökülebiliyor', () => {
    expect(ekA.length).toBeGreaterThan(400);
    expect(satir.length).toBeGreaterThan(15);
  });

  test('Ek A\'nın adlandırdığı her kart gerçekten o panelde var', () => {
    const bakilan = [];
    satir.forEach((r) => {
      const h = (r.match(/<td[^>]*>([\s\S]*?)<\/td>/g) || []).map(duz);
      if (h.length < 3) return;
      const panel = PANEL[h[1]];
      if (!panel) return;                     // Rapor ve "—" bu kapının dışında
      // Kayış Tablosu satırlarının üçüncü hücresi SÜTUN adı taşıyor (kart
      // değil); onların kapısı aşağıdaki ayrı testte, sütun listesine karşı.
      if (h[1] === 'Kayış Tablosu') return;
      duz(h[2]).split('·').forEach((ad) => {
        const t = ad.trim();
        if (!t || t === '—') return;
        bakilan.push(h[1] + ' / ' + t);
        expect(panel).toContain(t);
      });
    });
    // Kapının GERÇEKTEN bir şey taradığının kanıtı: boş bir listeyle de yeşil
    // kalırdı (bu depoda "üreticiyi çağıran ama yüzeyi ölçmeyen kapı" dersi).
    expect(bakilan.length).toBeGreaterThanOrEqual(9);
    // Zarf gerçekten dört paneli birden taradı mı — biri boş dönseydi o
    // paneldeki her satır sessizce atlanırdı.
    ['Gergi', 'Kayış Özellikleri', 'Kasnak', 'Çözücü'].forEach((ad) => {
      expect(PANEL[ad].length).toBeGreaterThan(400);
      expect(bakilan.some((x) => x.indexOf(ad + ' / ') === 0)).toBe(true);
    });
  });

  // ── KAYIŞ TABLOSU: kılavuzun anlattığı sütunlar GERÇEKTEN o tabloda mı ──
  //
  // §4 tablonun sütunlarını tek tek anlatıyor. O liste kılavuza kopyalanmış
  // bir metin olduğu için, bir sütun adı programda değişirse kılavuz sessizce
  // eskirdi — kasnak kutuları kalktığında olan tam olarak buydu.
  test('§4 tablonun sütunlarını programdaki adlarla anlatıyor', () => {
    const adlar = VE_FEAD_TABLE_COLS.map((c) => c.t).filter((t) => t && t !== '#');
    expect(adlar.length).toBeGreaterThan(6);
    adlar.forEach((t) => { expect(DOC).toContain(t); });
    // ...ve tablonun KENDİSİ o başlıkları basıyor (kapı tek yüzeyi ölçmesin).
    adlar.forEach((t) => { expect(PANEL['Kayış Tablosu']).toContain(t); });
  });

  test('§4 ekleme/silme yüzeyini tablonun bastığı adla anlatıyor', () => {
    // Kasnak eklemenin GÖRÜNÜR tek yolu bu; kılavuz paleti gösterirse
    // kullanıcı hiçbir şey olmayan bir sürükleme yapar (ölçülmüş sınıf).
    expect(PANEL['Kayış Tablosu']).toContain('Kasnak ekle');
    expect(DOC).toContain('Kasnak ekle');
    expect(DOC).toContain('kayış sırasının <strong>sonuna</strong>');
    // ...VE PALET YOLUNU TARİF ETMİYOR. Yalnız "Kasnak ekle geçiyor mu" diye
    // bakmak yetmiyor: o ifade Ek A'da ve §4.3'te de var, dolayısıyla §4'ün
    // ADIMI palete geri dönse bile kapı yeşil kalırdı (ölçüldü). Kasnağı
    // paletten sürüklemek kanvasta HİÇBİR İZ bırakmıyor — kılavuz o yolu bir
    // yöntem gibi anlatırsa kullanıcı hiçbir şey olmadığını sanır.
    expect(DOC).toContain('Kasnağı paletten sürüklemeyin');
    // ...VE §4'ÜN ADIM LİSTESİ PALETİ TARİF ETMİYOR. Yalnız "Kasnak ekle
    // geçiyor mu" diye bakmak yetmiyor: o ifade Ek A'da ve §4.3'te de var,
    // dolayısıyla §4'ün ADIMI palete geri dönse bile kapı yeşil kalırdı
    // (ölçüldü). Ölçülen yer bu yüzden adımın kendisi.
    const s4 = DOC.slice(DOC.indexOf('id="g4"'), DOC.indexOf('id="g5"'));
    const ilkAdim = (s4.match(/<ol>[\s\S]*?<\/ol>/) || [''])[0];
    expect(ilkAdim).toContain('Kasnak ekle');
    expect(ilkAdim).not.toMatch(/palet/i);
  });

  test('KUTUSUZLUK kılavuzda da yazılı — kablolama ve Konum Bağı geçmiyor', () => {
    // Bu satırların hepsi bir dönem kılavuzdaydı ve programda karşılıkları
    // kalmadı. Metin yeniden yazıldığında geri sızmasınlar.
    ['Konum Bağı', 'çıkış portuna', 'giriş portuna', 'Tel kurulur',
      'kayış yolu kablolan', 'kablolamayı bu belirler'].forEach((k) => {
      expect(DOC).not.toContain(k);
    });
    // ...ve yerine geçen kural açıkça yazılı.
    expect(DOC).toContain('kanvasta kutusu');
    expect(DOC).toContain('graf değil, bir listedir');
  });

  test('kaldırılan yüzeyler NE panelde NE kılavuzda geçiyor', () => {
    // PR #831 gergiden şunları kaldırdı: kip seçicisi (zarf/montaj merkezi/
    // serbest açı), ikincil "Ölçülmüş Pivot" alanları ve karşılıklı doğrulama
    // kartı. Kılavuz bunları anlatmaya devam ederse kullanıcı olmayan bir
    // düğmeyi arar — programın kendi içinde ölçülmüş "ULAŞILAMAZ ÇARE" sınıfı.
    const kalkti = ['Ölçülmüş Pivot', 'verifyCenX', 'verifyCenY', 've-fead-pivotX',
      'freeAngleDeg', 'angleMode', 'armPinned'];
    kalkti.forEach((k) => {
      expect(PANEL.Gergi).not.toContain(k);
      expect(DOC).not.toContain(k);
    });
    // "Doğrulama kartı" ve "montaj referans noktası" kılavuzdan da çıktı.
    expect(DOC).not.toContain('Doğrulama</strong> kartı');
    expect(DOC).not.toContain('Kasnak merkezi (doğrulama)');
    expect(DOC).not.toContain('montaj referans noktası');
  });

  test('§7.1 denetim satırını PANELİN gerçekten bastığı adla anlatıyor', () => {
    // Denetim tek yerden okunuyor: Kol Künyesi kartındaki türeyen montaj
    // konumu satırı. Kılavuz o satırı adıyla gösteriyor; ad panelde
    // değişirse kullanıcı ekranda arayacağı şeyi bulamaz.
    expect(PANEL.Gergi).toContain('Avara Hareketi');
    expect(DOC).toContain('Avara Hareketi');
    expect(PANEL.Gergi).toContain('montaj konumu (türedi)');
    expect(DOC).toContain('montaj konumu (türedi)');
  });

  test('"pivot" yalnız raporun KENDİ alan adı olarak geçiyor', () => {
    // PR #831 terminolojiyi emekli etti: programda artık "otomatik gergi montaj
    // konumu" var. Ama tedarikçi raporunun alanı hâlâ "Pivot Point" adını
    // taşıyor ve kullanıcı belgeyi elinde tutarken o adı arıyor — dolayısıyla
    // kelime tümden yasaklanamaz. Kapı ayrımı tutuyor: İngilizce alan adının
    // dışında kalan her "pivot" bir terminoloji kaçağıdır.
    // ETİKETLER SOYULUR, çünkü ölçülen şey KULLANICININ OKUDUĞU metin:
    // şema SVG'si parçalarını `data-ve="pivot"` ile adlandırıyor ve o bir
    // çizim kimliği, bir terim değil.
    // KILAVUZUN KENDİ METNİ ölçülür. Gergi paneli artık belgeye SAHNE olarak
    // gömülüyor ve programın kendi etiketi hâlâ "merkezden pivota" diyor —
    // o bir uygulama metni, kılavuzun terminoloji kaçağı değil. (Uygulamanın
    // kendi etiketi ayrı bir iş; kılavuz onu aynen göstermek zorunda.)
    const govde = KENDI
      .replace(/<style>[\s\S]*?<\/style>/g, '')
      .replace(/<[^>]+>/g, ' ');
    const kacak = (govde.match(/[Pp]ivot(?!\s*Point)\w*/g) || []);
    expect(kacak).toEqual([]);
    // ...ve raporun alan adı GERÇEKTEN duruyor (kapı boş bir belgeyle de yeşil kalmasın)
    expect(govde).toContain('Pivot Point');   // raporun alan adı kılavuzun kendi metninde
  });

  // §14.2.1 KALKTI (2026-09-01): iki kol açısını yan yana ölçüyordu — biri
  // zarfın seçtiği, biri rapordan sabitlenen. Girdi avara merkezine dönünce
  // zarf seçici olmaktan çıktı ve kol açısı TEK bir GİRDİ oldu; yan yana
  // konacak ikinci bir sütun kalmadı. Yerine geçen kapı: §14.2'nin türeyen
  // montaj konumunu raporun kendi satırıyla SAYIYLA kapatması (yukarıda).
  test('kol açısının bir GİRDİ olduğu ve seçilmediği yazılı', () => {
    expect(DOC).not.toContain('Açıyı zarf seçerse');
    expect(DOC).toContain('Kol çalışma açısını program SEÇMEZ');
    // Gerekçe SAYIYLA duruyor — "öylesine bir tercih" gibi okunmasın.
    expect(DOC).toContain('2/14');
    expect(DOC).toContain('20,7');
    expect(DOC).toContain('24,1');
  });

  test('kayış boyu alanı YOK — kılavuz da girmeyi söylemiyor', () => {
    // Kayış boyu bir ÇIKTI; panel o alanı hiç açmıyor. Bir dönem §14.7
    // "efektif boy alanını boşaltın" diyordu — boşaltılacak alan yok.
    expect(PANEL['Kayış Özellikleri']).not.toContain('ve-fead-effLength-');
    expect(DOC).not.toContain('efektif boy alanını boşaltın');
  });
});
