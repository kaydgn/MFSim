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
global.componentDefs = componentDefs;
global.FEADCore = F;
const BL = require('../../js/fead-belts.js');
Object.keys(BL).forEach((k) => { global[k] = BL[k]; });
Object.keys(M).forEach((k) => { global[k] = M[k]; });
const CP = require('../../js/cp-fead.js');
Object.keys(CP).forEach((k) => { if (global[k] === undefined) global[k] = CP[k]; });
Object.keys(RP).forEach((k) => { global[k] = RP[k]; });
const KIT = require('../../js/guide-kit.js');
Object.keys(KIT).forEach((k) => { global[k] = KIT[k]; });
const GF = require('../../js/guide-fead.js');
Object.keys(GF).forEach((k) => { global[k] = GF[k]; });

beforeEach(() => resetStubs(stubs));

// Belge bir kez üretilir; testlerin çoğu aynı çıktıyı tarıyor.
const DOC = GF.veGuideFeadHTML();

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
    const figsiz = DOC.replace(/<figure class="appfig">[\s\S]*?<\/figure>/g, '');
    ['var(--fs-', 'var(--bg-', 'var(--text-', 'var(--accent-', 'var(--radius-']
      .forEach((j) => { expect(figsiz).not.toContain(j); });
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
    const hucreler = DOC.match(/<td[^>]*>[\s\S]*?<\/td>/g) || [];
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
    expect(DOC).toContain('<figure class="appfig">');
    const fig = (DOC.match(/<figure class="appfig">[\s\S]*?<\/figure>/) || [''])[0];
    expect(fig).toContain('<svg');
    expect(fig).toContain('<figcaption>');
  });

  test('şeklin kullandığı her jeton belgenin CSS’inde tanımlı', () => {
    const fig = (DOC.match(/<figure class="appfig">[\s\S]*?<\/figure>/) || [''])[0];
    const jetonlar = [...new Set((fig.match(/var\((--[a-z0-9-]+)/g) || []).map((s) => s.slice(4)))];
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

  test('zarf kipinde çözülüyor — pivot girdi, boy çıktı', () => {
    const O = GF._gfOrnekCoz();
    expect(O.gergi.data.cenX).toBeUndefined();
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
    // Kılavuz örneği zarf kipine alıyor. `veFeadExampleNodes` `data`yı derin
    // kopyalıyor, ama ham kayda yazılsaydı fead-example-ag00976.test.js'in
    // tabanı (kol 28,0750° · L 1714,60 · T 544,05) SESSİZCE kayardı.
    GF.veGuideFeadHTML();
    const ham = veFeadExampleOf('AG00976_GATES_2025');
    const g = ham.pulleys.filter((p) => p.type === 'fead-tensioner')[0];
    expect(g.data.pivotX).toBeDefined();
    expect(g.data.cenX).toBeUndefined();
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

  test('beş kasnak "kasnak merkezi", gergi "montaj konumu" der', () => {
    const govde = satirlar.slice(1);
    expect(govde.length).toBe(6);
    const merkez = govde.filter((r) => /kasnak merkezi/.test(r));
    const montaj = govde.filter((r) => /montaj konumu/.test(r));
    expect(merkez).toHaveLength(5);
    expect(montaj).toHaveLength(1);
    expect(montaj[0]).toMatch(/Gergi/i);
  });

  test('gergi satırı PİVOT koordinatını basar — Layout Data satırını DEĞİL', () => {
    // İkisi 90 mm apayrı; yanlışını basmak sessizce başka bir sistemi anlatırdı.
    const g = (tablo.match(/<tr>(?:(?!<\/tr>)[\s\S])*montaj konumu[\s\S]*?<\/tr>/) || [''])[0];
    const P = GF.VE_GUIDE_FEAD_GATES.pivot;
    expect(g).toContain(RP._frF(P[0], 2));
    expect(g).toContain(RP._frF(P[1], 2));
    // Layout Data'daki çalışma merkezi bu satırda GEÇMEMELİ.
    expect(g).not.toContain(RP._frF(GF.VE_GUIDE_FEAD_GATES.tenXY[0], 2));
  });

  test('X hücresine sıkıştırılmış "pivot" etiketi KALMADI', () => {
    expect(tablo).not.toContain('<em>pivot');
  });

  test('rol sütunu gergiyi ADLANDIRIR — adı değişse de ayırt edilsin', () => {
    // Bir dönem yalnız `driver`a bakıyordu ve gergi satırında '—' yazıyordu;
    // o satırı ayırt eden tek şey kasnağın ADIYDI.
    const g = (tablo.match(/<tr>(?:(?!<\/tr>)[\s\S])*montaj konumu[\s\S]*?<\/tr>/) || [''])[0];
    expect(g).toMatch(/>gergi</);
    expect(tablo).toContain('>avara<');
    expect(tablo).toContain('>aksesuar<');
  });

  test('ayrım UYARI kutusuyla ve ölçülmüş bedeliyle yazılı', () => {
    expect(DOC).toContain('Gergi satırı diğerlerinden BAŞKA bir noktadır');
    expect(DOC).toContain('Pivot Point');
    expect(DOC).toContain('Layout Data');
    expect(DOC).toContain('−%47,9');       // yanlış nokta girilirse gerginlik
    expect(DOC).toContain('0,0054 mm');    // iki noktanın kol boyu özdeşliği
  });

  test('14.2 kasnak merkezinin TÜREYEN olduğunu sayıyla kapatıyor', () => {
    // Girilen nokta gerçekten pivot olarak kullanılıyorsa, ondan türeyen
    // kasnak merkezi raporun KENDİ Layout Data satırına oturmalı.
    const O = GF._gfOrnekCoz();
    const a = Number(O.gergi.data.armLen);
    const th = O.build.armAbsDeg * Math.PI / 180;
    const cx = Number(O.gergi.data.pivotX) + a * Math.cos(th);
    const cy = Number(O.gergi.data.pivotY) + a * Math.sin(th);
    const G = GF.VE_GUIDE_FEAD_GATES;
    const d = Math.sqrt(Math.pow(cx - G.tenXY[0], 2) + Math.pow(cy - G.tenXY[1], 2));
    expect(d).toBeLessThan(5);                       // raporun satırına oturuyor
    expect(DOC).toContain('Gergi kasnağının merkezi');
    expect(DOC).toContain(RP._frFs(d, 2) + ' mm');
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
    expect(DOC).toContain('−%48,6');
    expect(DOC).toContain('+27,9°');
  });

  test('kayma emniyetinin yük taşıyan ayrımı anlatılıyor', () => {
    // Panel ham en küçüğü basıyor, rapor yalnız yük taşıyanların en küçüğünü.
    // Kılavuz bu ayrımı yazmazsa iki belge birbiriyle çelişir.
    expect(DOC).toContain('kapasitesi');
    expect(DOC).toMatch(/gerginlik oranı/i);
  });

  test('pivot ile kasnak merkezi ayrımı yazılı', () => {
    expect(DOC).toContain('Buraya kasnak merkezi yazılmaz');
  });

  test('Başlangıç Sihirbazı açılış yolu olarak anlatılıyor', () => {
    // Modül açılışında İKİ kutu geliyor; kılavuz tek kutu derse ilk ekran
    // yalanlanmış olur ve kullanıcı sihirbazı hiç bulmaz.
    expect(DOC).toContain('Başlangıç Sihirbazı');
    expect(DOC).toContain('iki açılış kutusu');
    expect(DOC).toContain('Sihirbaz adımları');
    // Yedi adımın yedisi de bölümlerle eşlenmiş olmalı.
    ['Kasnaklar', 'Kayış Yolu', 'Otomatik Gergi', 'Motor ve Çevrim', 'Özet ve Kurulum']
      .forEach((a) => { expect(DOC).toContain(a); });
  });

  test('hızlı başvuru eki alan → panel eşlemesi veriyor', () => {
    expect(DOC).toContain('Alan → Panel Hızlı Başvurusu');
    expect(DOC).toContain('Gergi Künye Kütüphanesi');
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
    const eskiN = global.nodes;
    const eskiC = global.connections;
    global.nodes = pack.nodes;
    global.connections = pack.connections;
    try {
      return {
        Gergi: getFeadTensionerPropertiesHTML(ten),
        'Kayış Özellikleri': getFeadBeltPropertiesHTML(belt),
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
      if (!panel) return;                     // Kasnak/Çözücü/Rapor bu kapının dışında
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
  });

  test('kaldırılan yüzeyler NE panelde NE kılavuzda geçiyor', () => {
    // PR #831 gergiden şunları kaldırdı: kip seçicisi (zarf/montaj merkezi/
    // serbest açı), ikincil "Ölçülmüş Pivot" alanları ve karşılıklı doğrulama
    // kartı. Kılavuz bunları anlatmaya devam ederse kullanıcı olmayan bir
    // düğmeyi arar — programın kendi içinde ölçülmüş "ULAŞILAMAZ ÇARE" sınıfı.
    const kalkti = ['Ölçülmüş Pivot', 'verifyCenX', 'verifyCenY', 've-fead-cenX',
      'freeAngleDeg', 'angleMode'];
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
    // Doğrulama artık tek yerden okunuyor: Avara Hareketi kartının türeyen
    // kasnak merkezi satırı. Kılavuz o satırı adıyla gösteriyor; ad panelde
    // değişirse kullanıcı ekranda arayacağı şeyi bulamaz.
    expect(PANEL.Gergi).toContain('Avara Hareketi');
    expect(DOC).toContain('Avara Hareketi');
    expect(DOC).toContain('kasnak merkezi (türedi)');
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
    const govde = DOC
      .replace(/<style>[\s\S]*?<\/style>/g, '')
      .replace(/<[^>]+>/g, ' ');
    const kacak = (govde.match(/[Pp]ivot(?!\s*Point)\w*/g) || []);
    expect(kacak).toEqual([]);
    // ...ve raporun alan adı GERÇEKTEN duruyor (kapı boş bir belgeyle de yeşil kalmasın)
    expect(govde).toContain('Pivot Point');
  });

  test('§14.2.1 iki kol açısını YAN YANA ölçüyor', () => {
    // Örnek kolun açısını raporundan BİLİYOR (armPinned). Kılavuzun anlattığı
    // akış ise zarfın SEÇTİĞİ hâl. İkisi de koşmazsa belge "zarf seçti" derken
    // aslında girdiyi okur — bu bölümün var olma sebebi o ayrımı ölçmek.
    // (Bir mutasyon ikinci çözümü düşürdüğünde HİÇBİR kapı kırmızıya dönmedi:
    // kapı ÜRETİLEN YÜZEYE bakmalı, üreticiye değil.)
    expect(DOC).toContain('Açıyı zarf seçerse ↔ açı biliniyorsa');
    const t = (DOC.match(/<caption>Tablo [^<]*Aynı yerleşim, iki kol açısı<\/caption>[\s\S]*?<\/table>/) || [''])[0];
    expect(t.length).toBeGreaterThan(300);

    // Türkçe biçim: binlik nokta, ondalık virgül, GERÇEK eksi (U+2212).
    // YALNIZ İLK sayı alınır — hücreler '1715,39 mm  (+%0,05)' gibi İKİ
    // sayı taşıyor ve hepsini birleştiren bir ayrıştırıcı çöp üretir.
    const say = (x) => {
      const m = String(x).match(/\u2212?-?\d[\d.]*(?:,\d+)?/);
      return m ? Number(m[0].replace(/\./g, '').replace(',', '.').replace('\u2212', '-')) : NaN;
    };
    const aci = (t.match(/<tr>(?:(?!<\/tr>)[\s\S])*Kol çalışma açısı[\s\S]*?<\/tr>/) || [''])[0];
    const h = (aci.match(/<td[^>]*>([\s\S]*?)<\/td>/g) || []).map((c) => c.replace(/<[^>]+>/g, '').trim());
    const secilen = say(h[1]);
    const sabit = say(h[2]);
    expect(Number.isFinite(secilen)).toBe(true);
    expect(Number.isFinite(sabit)).toBe(true);
    // İKİSİ AYNI OLMAMALI: aynıysa ya zarf koşmuyor ya sabitleme okunmuyor.
    expect(Math.abs(secilen - sabit)).toBeGreaterThan(0.2);
    // ...ama ölçütün ölçülmüş isabet bandının içinde (14 sistem medyanı 4,5°).
    expect(Math.abs(secilen - sabit)).toBeLessThan(6);

    // RAPORDAN GELEN AÇI RAPORU DAHA İYİ ÜRETMELİ. Tersi çıkıyorsa ya sütunlar
    // yer değiştirmiştir ya da sabitleme çözüme hiç geçmiyordur.
    const boy = (t.match(/<tr>(?:(?!<\/tr>)[\s\S])*Kayış efektif boyu[\s\S]*?<\/tr>/) || [''])[0];
    const bh = (boy.match(/<td[^>]*>([\s\S]*?)<\/td>/g) || []).map((c) => c.replace(/<[^>]+>/g, '').trim());
    const G = GF.VE_GUIDE_FEAD_GATES.belt;
    expect(Math.abs(say(bh[2]) - G)).toBeLessThan(Math.abs(say(bh[1]) - G));
  });

  test('kayış boyu alanı zarf kipinde YOK — kılavuz da girmeyi söylemiyor', () => {
    // Kayış boyu bir ÇIKTI; panel o alanı hiç açmıyor. Bir dönem §14.7
    // "efektif boy alanını boşaltın" diyordu — boşaltılacak alan yok.
    expect(PANEL['Kayış Özellikleri']).not.toContain('ve-fead-effLength-');
    expect(DOC).not.toContain('efektif boy alanını boşaltın');
  });
});
