/**
 * fead-step.test.js — STEP MONTAJINDAN FEAD GEOMETRİSİ
 * (js/step-p21.js okuyucu + js/fead-step.js tanıyıcı)
 *
 * Kapıların hepsi gerçek bir 3DEXPERIENCE montajında (kullanıcının FEAD
 * geometrisi) ölçülmüş bir olguya dayanıyor; dosyanın kendisi şimdilik depoda
 * değil, yapısı tests/helpers/step-yaz.js ile taklit ediliyor:
 *   · kanaldan BÜYÜK omuz (krank Ø150,5 · klima Ø151) — "en büyük çap" dış çap değil
 *   · kaburga tepesi tor ve tepe noktası yüzün İÇİNDE — sınır çemberinden okunan tepe 0,46 mm eksik
 *   · omuza çıkan tek 70° yanak — gevşek kural klimayı 9 kanallı okuyordu
 *   · dönel yüzler iki yarım yüz — sayım iki katına çıkmasın
 *   · gergi gövdesi avarasından çok yüzlü olabilir — kasnak "en çok yüzlü eksen" değil
 * En değerli kapı en altta: Gates AG00686 düzeni STEP olarak yazılıp içe
 * aktarılıyor ve MFSim köprüsü raporun açıklık boylarını ve sarımlarını
 * veriyor — yani dosyadan modele giden zincirin tamamı sınanıyor.
 */
const P = require('../../js/step-p21.js');
const S = require('../../js/fead-step.js');
const Y = require('../helpers/step-yaz.js');
const M = require('../../js/fead-model.js');
const F = require('../../js/fead-core.js');
const TEN = require('../../js/fead-tensioners.js');

const stubs = stubGlobals();
document.body.innerHTML = '<div id="ve-canvas"></div>';
global.nodes = [];
global.connections = [];
eval(loadSource('components.js'));
global.veIsCanvasHidden = veIsCanvasHidden;
global.FEADCore = F;
Object.keys(M).forEach((k) => { global[k] = M[k]; });
beforeEach(() => { resetStubs(stubs); });

// Sentetik montajlar ortak yardımcıda: sihirbazın aktarım testi ve gerçek
// tarayıcı testi AYNI dosyayı kullanıyor (tests/helpers/step-ornek.js).
const { feadStep, AG, AG_REF, gergiParcasi, ag00686Step, D } = require('../helpers/step-ornek.js');

// ═════════════════════════════════════════════════════════════════════════
describe('okuyucu (step-p21): ayrıştırma', () => {
  test('Türkçe adlar ve "Ø" \\X2\\ ile çözülür; fiziksel satır sonu değere girmez', () => {
    expect(P.veStepP21Coz('KRANK KASNAK-\\X2\\00D8\\X0\\147\\X2\\000A\\X0\\ 8PK')).toBe('KRANK KASNAK-Ø147\n 8PK');
    expect(P.veStepP21Coz('GERG\\X2\\0130\\X0\\ / Alternat\\X2\\00F6\\X0\\r')).toBe('GERGİ / Alternatör');
    expect(P.veStepP21Coz('\\X\\E9t\\X\\E9')).toBe('été');
    expect(P.veStepP21Coz('a\\\\b')).toBe('a\\b');
    expect(P.veStepP21Coz('\\X4\\0001F600\\X0\\')).toBe('\u{1F600}');
    expect(P.veStepP21Coz('uzun\r\nsatir')).toBe('uzunsatir');
  });

  test('dize içindeki ";" ve "/*", yorum, karmaşık varlık, tipli parametre, $ ve *', () => {
    const metin = ['ISO-10303-21;', 'HEADER;', "FILE_NAME('x;y','t',(''),(''),'','SIS','');", 'ENDSEC;', 'DATA;',
      "#1=PRODUCT('A;B /* değil */','it''s','',(#2)) ;",
      '/* bir yorum; noktalı virgüllü */',
      "#2=(LENGTH_UNIT()NAMED_UNIT(*)SI_UNIT(.MILLI.,.METRE.));",
      "#3=LENGTH_MEASURE_WITH_UNIT(LENGTH_MEASURE(25.4),#2)\r\n ;",
      "#4=CARTESIAN_POINT('',(1.,-2.5E-1,3));",
      'ENDSEC;', 'END-ISO-10303-21;'].join('\n');
    const m = P.veStepP21Oku(metin);
    expect(m.hatalar).toEqual([]);
    expect(m.adet).toBe(4);
    expect(P.veStepP21Varlik(m, 1).a[0]).toEqual({ s: 'A;B /* değil */' });
    expect(P.veStepP21Varlik(m, 1).a[1]).toEqual({ s: "it's" });
    expect(P.veStepP21Tip(m, 2)).toBe('COMPLEX');
    expect(P.veStepP21Parca(m, 2, 'SI_UNIT').a).toEqual([{ e: 'MILLI' }, { e: 'METRE' }]);
    expect(P.veStepP21Parca(m, 2, 'NAMED_UNIT').a).toEqual([null]);
    expect(P.veStepP21Varlik(m, 3).a[0]).toEqual({ tip: 'LENGTH_MEASURE', a: [25.4] });
    expect(P.veStepP21Varlik(m, 4).a[1]).toEqual([1, -0.25, 3]);
    expect(P.veStepP21Baslik(m).dosya).toBe('x;y');
    expect(P.veStepP21Baslik(m).sistem).toBe('SIS');
  });

  test('STEP olmayan metin hata döner, istisna atmaz', () => {
    expect(P.veStepP21Oku('merhaba').hatalar[0]).toMatch(/STEP dosyası değil/);
    const r = S.veFeadStpOku('merhaba');
    expect(r.ok).toBe(false);
    expect(r.hatalar[0]).toMatch(/STEP dosyası değil/);
  });
});

describe('okuyucu (step-p21): birim tahmin edilmez', () => {
  const birim = (opt) => {
    const yz = new Y.StepYaz(opt);
    const m = P.veStepP21Oku(yz.metin());
    return P.veStepP21Birim(m, yz.baglam);
  };
  test('mm + radyan', () => {
    const b = birim({});
    expect(b.mm).toBe(1);
    expect(b.derece).toBeCloseTo(180 / Math.PI, 12);
  });
  test('inch (CONVERSION_BASED_UNIT) ve derece', () => {
    const b = birim({ uzunluk: 'inch', aci: 'derece' });
    expect(b.mm).toBeCloseTo(25.4, 12);
    expect(b.derece).toBeCloseTo(1, 12);
  });
});

describe('okuyucu (step-p21): montaj dönüşümleri', () => {
  // Kök → alt montaj (dönük) → parça (dönük), ve aynı parça iki kez takılı
  function ic() {
    const yz = new Y.StepYaz();
    const kok = yz.urun('KOK', 'kök');
    const alt = yz.urun('ALT', 'alt montaj');
    const par = yz.urun('PARCA', 'parça');
    const eks = Y.eksen([0, 0, 0]);
    yz.govde(par, Y.profilYuzleri(yz, eks, Y.duzProfil({ od: 60 })));
    yz.temsil(par);
    const t1 = yz.tak(alt, par, 'PARCA.1', [10, 0, 0], [0, 0, 1], [1, 0, 0]);
    const t2 = yz.tak(alt, par, 'PARCA.2', [0, 50, 0], [1, 0, 0], [0, 1, 0], { ters: true });
    yz.temsil(alt);
    const t3 = yz.tak(kok, alt, 'ALT.1', [100, 200, 300], [0, 1, 0], [0, 0, 1]);
    yz.temsil(kok);
    [t1, t2, t3].forEach((t) => yz.bagla(t));
    return P.veStepP21Montaj(P.veStepP21Oku(yz.metin()));
  }
  test('iç içe dönüşümler bileşir, aynı parçanın iki örneği iki ayrı konum alır', () => {
    const mt = ic();
    expect(mt.uyarilar).toEqual([]);
    expect(mt.parcalar.map((p) => p.ornek).sort()).toEqual(['PARCA.1', 'PARCA.2']);
    const bul = (o) => mt.parcalar.find((p) => p.ornek === o);
    // ALT çerçevesi: z = +Y, x = +Z → y = z × x = +X; öteleme (100,200,300)
    // PARCA.1 alt içinde (10,0,0) → dünya: 100 + 10·x_alt = (100,200,310)
    const p1 = bul('PARCA.1').M;
    expect(p1.t.map((v) => +v.toFixed(9))).toEqual([100, 200, 310]);
    // PARCA.1'in yerel z'si alt'ın z'si = dünya +Y
    expect(P.veStepP21YonUygula(p1, [0, 0, 1]).map((v) => +v.toFixed(12))).toEqual([0, 1, 0]);
    // PARCA.2 (IDT ters sırada yazıldı, rep_1 ebeveyn): alt içinde (0,50,0), z = alt'ın x'i
    const p2 = bul('PARCA.2').M;
    expect(p2.t.map((v) => +v.toFixed(9))).toEqual([150, 200, 300]);
    expect(P.veStepP21YonUygula(p2, [0, 0, 1]).map((v) => +v.toFixed(12))).toEqual([0, 0, 1]);
    expect(bul('PARCA.2').atalar.map((a) => a.id)).toEqual(['KOK', 'ALT']);
  });

  test('MAPPED_ITEM ile konumlandırma SESSİZ geçilmez: uyarı', () => {
    const yz = new Y.StepYaz();
    const u = yz.urun('P', 'p');
    yz.ekle("MAPPED_ITEM('',#1,#2)");
    yz.temsil(u);
    const mt = P.veStepP21Montaj(P.veStepP21Oku(yz.metin()));
    expect(mt.uyarilar.join(' ')).toMatch(/MAPPED_ITEM/);
  });
});

// ═════════════════════════════════════════════════════════════════════════
describe('tanıyıcı: kaburgalı kasnak', () => {
  const tek = (profil, opt = {}) => S.veFeadStpOku(feadStep([{ id: 'K', ad: 'KRANK KASNAK', x: 0, y: 0, geometri: [{ profil }] }], opt));

  test('dış çap KABURGA TEPESİDİR, en büyük çap değil (omuz Ø150,5)', () => {
    const r = tek(Y.kanalliProfil({ od: 147, n: 8, omuz: 150.5 }));
    expect(r.ok).toBe(true);
    const k = r.kasnaklar[0];
    expect(k.tur).toBe('kanalli');
    expect(k.od).toBeCloseTo(147, 9);
    expect(k.enBuyukCap).toBeCloseTo(150.5, 9);
    expect(k.kanal).toBe(8);
    expect(k.adim).toBeCloseTo(3.56, 9);
    expect(k.profil).toBe('PK');
  });

  test('kaburga tepesi torun İÇİNDE: sınır çemberi 73,27, tepe 73,50 — analitik okunur', () => {
    // Sınır çemberinden okunan tepe 146,54 olurdu (ilk kuralın ölçülmüş hatası)
    const r = tek(Y.kanalliProfil({ od: 147, n: 8, omuz: 147 }));
    expect(r.kasnaklar[0].od).toBeCloseTo(147, 9);
  });

  test('tepesi bölünmüş tor + omuza çıkan tek 70° yanak: 8 kanal, 9 DEĞİL', () => {
    const r = tek(Y.kanalliProfil({ od: 137, n: 8, omuz: 151, tepeBol: true, kenarYanak: true, tepeR: 0.25 }));
    const k = r.kasnaklar[0];
    expect(k.kanal).toBe(8);
    expect(k.od).toBeCloseTo(137, 9);
    expect(k.enBuyukCap).toBeCloseTo(151, 9);
  });

  test('yarım yüzler sayımı iki katına çıkarmaz; kanal sayısı ve profil adımdan', () => {
    for (const [ad, adim, n] of [['PJ', 2.34, 6], ['PK', 3.56, 4], ['PL', 4.7, 5]]) {
      const r = tek(Y.kanalliProfil({ od: 120, n, adim }));
      expect({ ad, n: r.kasnaklar[0].kanal, profil: r.kasnaklar[0].profil }).toEqual({ ad, n, profil: ad });
    }
  });

  test('inch ve derece birimli dosya aynı sayıları verir', () => {
    const r = tek(Y.kanalliProfil({ od: 147, n: 8, omuz: 150.5 }), { uzunluk: 'inch', aci: 'derece' });
    expect(r.kasnaklar[0].od).toBeCloseTo(147, 6);
    expect(r.kasnaklar[0].kanal).toBe(8);
    expect(r.kasnaklar[0].adim).toBeCloseTo(3.56, 6);
  });
});

describe('tanıyıcı: düz kasnak ve gergi', () => {
  test('düz avara: kayış yüzeyi silindiri, genişliği ve temas tarafı', () => {
    const r = S.veFeadStpOku(ag00686Step());
    const avara = r.kasnaklar.find((k) => r.parcalar[k.parca].rolOneri === 'fead-idler');
    expect(avara.tur).toBe('duz');
    expect(avara.od).toBeCloseTo(75, 9);
    expect(avara.genislik).toBeCloseTo(31.48, 9);
  });

  test('gergi gövdesi avarasından ÇOK YÜZLÜ olsa da kasnak avaradır; pivot bulunur', () => {
    // pivot ekseninde 9 dönel parça = 18 yarım yüz; avara ekseninde 6 yüz
    const r = S.veFeadStpOku(ag00686Step());
    expect(r.gergiler).toHaveLength(1);
    const g = r.gergiler[0];
    expect(r.kasnaklar[g.kasnak].od).toBeCloseTo(75, 9);
    expect(g.kolBoy).toBeCloseTo(90, 9);
    expect(g.pivotYuz).toBe(18);
  });

  test('alt montajlı gergi: rol ATADAN gelir, pivot başka parçada aranır', () => {
    const yz = new Y.StepYaz();
    const kok = yz.urun('ROOT', 'kök');
    const grg = yz.urun('GERGI-ASSY', 'OTOMATİK GERGİ');
    const kas = yz.urun('P1', 'KASNAK');
    const kol = yz.urun('P2', 'KOL');
    yz.govde(kas, Y.profilYuzleri(yz, Y.eksen(), Y.duzProfil({ od: 75 })));
    yz.govde(kol, Y.profilYuzleri(yz, Y.eksen([90, 0, 0]), Y.pivotProfil()));
    yz.temsil(kas); yz.temsil(kol);
    const t1 = yz.tak(grg, kas, 'P1.1', [0, 0, 0]);
    const t2 = yz.tak(grg, kol, 'P2.1', [0, 0, 0]);
    yz.temsil(grg);
    const krk = yz.urun('K', 'KRANK KASNAK');
    yz.govde(krk, Y.profilYuzleri(yz, Y.eksen(), Y.kanalliProfil({ od: 150, n: 6 })));
    yz.temsil(krk);
    const t3 = yz.tak(kok, grg, 'GERGI-ASSY.1', [0, 120, 0]);
    const t4 = yz.tak(kok, krk, 'K.1', [0, 0, 0]);
    yz.temsil(kok);
    [t1, t2, t3, t4].forEach((t) => yz.bagla(t));
    const r = S.veFeadStpOku(yz.metin());
    const avara = r.kasnaklar.find((k) => k.tur === 'duz');
    expect(r.parcalar[avara.parca].rolOneri).toBe('fead-tensioner');
    expect(r.parcalar[avara.parca].rolKaynagi).toBe('ata');
    expect(r.gergiler).toHaveLength(1);
    expect(r.gergiler[0].kolBoy).toBeCloseTo(90, 9);
  });

  test('ortası boşaltılmış avara: iki basamak TEK yüzeydir (kayış ikisinin üstünden geçer)', () => {
    const R = 37.5;
    const profil = [
      { tip: 'dogru', s0: -15, r0: R, s1: -3, r1: R },
      { tip: 'dogru', s0: -3, r0: R, s1: -3, r1: R - 2 },
      { tip: 'dogru', s0: -3, r0: R - 2, s1: 3, r1: R - 2 },
      { tip: 'dogru', s0: 3, r0: R - 2, s1: 3, r1: R },
      { tip: 'dogru', s0: 3, r0: R, s1: 15, r1: R },
      { tip: 'dogru', s0: -15, r0: 8.5, s1: 15, r1: 8.5 },
    ];
    const r = S.veFeadStpOku(feadStep([
      { id: 'K', ad: 'KRANK KASNAK', x: 0, y: 0, geometri: [{ profil: Y.kanalliProfil({ od: 150, n: 8 }) }] },
      { id: 'A', ad: 'AVARA', x: 120, y: 60, geometri: [{ profil }] },
    ]));
    const avara = r.kasnaklar.find((k) => k.tur === 'duz');
    expect(avara.od).toBeCloseTo(75, 9);
    expect(avara.genislik).toBeCloseTo(30, 9);
  });

  test('orta FLANŞ yüzeyi böler: en geniş basamak alınır', () => {
    const R = 37.5;
    const profil = [
      { tip: 'dogru', s0: -15, r0: R, s1: 7, r1: R },
      { tip: 'dogru', s0: 7, r0: R, s1: 7, r1: R + 3 },
      { tip: 'dogru', s0: 7, r0: R + 3, s1: 9, r1: R + 3 },
      { tip: 'dogru', s0: 9, r0: R + 3, s1: 9, r1: R },
      { tip: 'dogru', s0: 9, r0: R, s1: 15, r1: R },
    ];
    const r = S.veFeadStpOku(feadStep([
      { id: 'K', ad: 'KRANK KASNAK', x: 0, y: 0, geometri: [{ profil: Y.kanalliProfil({ od: 150, n: 6 }) }] },
      { id: 'A', ad: 'AVARA', x: 120, y: 60, geometri: [{ profil }] },
    ]));
    const avara = r.kasnaklar.find((k) => k.tur === 'duz');
    expect(avara.od).toBeCloseTo(75, 9);
    expect(avara.genislik).toBeCloseTo(22, 9);
  });

  test('yalnız üçgenli (tessellated) dosya: yüz yok, sebebi yazılı', () => {
    const yz = new Y.StepYaz();
    const u = yz.urun('P', 'KRANK');
    u.ogeler.push(yz.ekle("TESSELLATED_SHELL('',(),$)"));
    yz.temsil(u);
    const r = S.veFeadStpOku(yz.metin());
    expect(r.ok).toBe(false);
    expect(r.hatalar[0]).toMatch(/üçgen/);
  });
});

describe('tanıyıcı: bakış yönü görünür bir varsayılan', () => {
  test('orijin düzlemin arkasında → önden bakış; x ekseni doğru tarafta', () => {
    const r = S.veFeadStpOku(ag00686Step());
    expect(r.bakis.kaynak).toBe('orijin');
    const iki = S.veFeadStp2B(r);
    const ac = r.kasnaklar.findIndex((k) => r.parcalar[k.parca].rolOneri === 'fead-ac');
    expect(iki.kasnaklar[ac].x).toBeCloseTo(AG.ac.x, 9);
    expect(iki.kasnaklar[ac].y).toBeCloseTo(AG.ac.y, 9);
  });

  test('motor düzlemin ÖBÜR yanında: bakış çevrilir, aynı 2B düzen çıkar', () => {
    const r = S.veFeadStpOku(ag00686Step({ motor: '-X' }));
    expect(r.bakis.kaynak).toBe('orijin');
    const iki = S.veFeadStp2B(r);
    const bul = (tip) => iki.kasnaklar[r.kasnaklar.findIndex((k) => r.parcalar[k.parca].rolOneri === tip)];
    expect(bul('fead-ac').x).toBeCloseTo(AG.ac.x, 9);
    expect(bul('fead-idler').x).toBeCloseTo(AG.idr.x, 9);
    expect(iki.gergiler[0].kolAci).toBeCloseTo(AG.aci, 9);
  });

  test('ayna: x işaret değiştirir, y aynı kalır', () => {
    const r = S.veFeadStpOku(ag00686Step());
    const a = S.veFeadStp2B(r), b = S.veFeadStp2B(r, { ayna: true });
    a.kasnaklar.forEach((p, i) => {
      expect(b.kasnaklar[i].x).toBeCloseTo(-p.x, 9);
      expect(b.kasnaklar[i].y).toBeCloseTo(p.y, 9);
    });
  });

  test('orijin düzlemin ÜSTÜNDE: varsayım yapılmaz, uyarı yazılır', () => {
    const r = S.veFeadStpOku(ag00686Step({ duzlem: 0 }));
    expect(r.bakis.kaynak).toBe('varsayilan');
    expect(r.uyarilar.join(' ')).toMatch(/Bakış yönü dosyadan çıkarılamadı/);
  });
});

describe('tanıyıcı: rol ADDAN önerilir', () => {
  test('krank klimadan KÜÇÜK olsa da krank addan bulunur (geometriden tahmin yok)', () => {
    const r = S.veFeadStpOku(feadStep([
      { id: 'A', ad: 'KLİMA KOMPRESÖRÜ', x: 250, y: 200, geometri: [{ profil: Y.kanalliProfil({ od: 160, n: 8 }) }] },
      { id: 'K', ad: 'KRANK KASNAK', x: 0, y: 0, geometri: [{ profil: Y.kanalliProfil({ od: 130, n: 8 }) }] },
    ]));
    const rol = (od) => r.kasnaklar.find((k) => Math.abs(k.od - od) < 1e-6).rolOneri;
    expect(rol(130)).toBe('fead-crank');
    expect(rol(160)).toBe('fead-ac');
    const kay = S.veFeadStpKayit(r, { gergiKatalog: [] });
    expect(kay.pulleys.find((p) => p.data.driver).data.od).toBeCloseTo(130, 9);
  });

  test.each([
    ['KRANK KASNAK-Ø147 8PK', 'fead-crank'],
    ['ACE21 KLIMA KOMPRESORU-Ø137-8PK-24V', 'fead-ac'],
    ['KLİMA KOMPRESÖRÜ', 'fead-ac'],
    ['AVARA KASNAK-E9839A4F1540-A_Ø75x32,5', 'fead-idler'],
    ['OTOMATIK GERGI-E9843A1F3200A', 'fead-tensioner'],
    ['GERGİ AVARASI', 'fead-tensioner'],
    ['KAYIS - 8PK1410', 'kayis'],
    ['Alternatör 28V 150A', 'fead-alternator'],
    ['SU POMPASI', 'fead-waterpump'],
    ['DİREKSİYON POMPASI', 'fead-ps'],
    ['HAVA KOMPRESÖRÜ', 'fead-aircomp'],
    ['FAN KAVRAMASI', 'fead-fan'],
    ['KOMPRESÖR', null],
    ['147KASNAK', null],
  ])('%s → %s', (ad, tip) => { expect(S.veFeadStpRol(ad)).toBe(tip); });
});

// ═════════════════════════════════════════════════════════════════════════
/**
 * UÇTAN UCA: Gates AG00686 düzeni STEP olarak yazılıp içe aktarılınca MFSim
 * köprüsü raporun kendi sayılarını veriyor mu? Referans ve eşikler
 * tests/unit/fead-model.test.js ile AYNI — orada düğümler elle kuruluyor,
 * burada STEP'ten.
 */
describe('uçtan uca: STEP → örnek kaydı → köprü → Gates AG00686', () => {
  const REF = AG_REF;
  const TIP_AD = { 'fead-crank': 'CRK', 'fead-idler': 'IDR', 'fead-ac': 'A_C', 'fead-tensioner': 'TEN' };

  function kur() {
    const sonuc = S.veFeadStpOku(ag00686Step());
    const kayit = S.veFeadStpKayit(sonuc, { gergiKatalog: TEN.VE_FEAD_TENSIONER_DB, ad: 'AG00686 STEP' });
    const dugum = kayit.pulleys.map((p) => ({ id: 'st-' + p.key, type: p.type, customName: TIP_AD[p.type],
      def: componentDefs[p.type], data: JSON.parse(JSON.stringify(p.data)) }));
    const ten = dugum.find((n) => n.type === 'fead-tensioner');
    // Yay verisi STEP'te yok — kullanıcı sihirbazın gergi adımında girer
    Object.assign(ten.data, AG_REF.yay);
    kayit.route.forEach((k, i) => { dugum.find((n) => n.id === 'st-' + k).data.beltIndex = i + 1; });
    dugum.push({ id: 'st-belt', type: 'fead-belt', def: componentDefs['fead-belt'],
      data: { profile: 'PK', brand: 'GATES', ribs: 8, effLength: 1475, tolerance: 6, wearPct: 0.007, beltDataMode: 'full' } });
    dugum.push({ id: 'st-solver', type: 'fead-solver', def: componentDefs['fead-solver'],
      data: { designTensionN: 765.7, driveRatio: 1, lengthOffsetMm: 3.5 } });
    return { sonuc, kayit, dugum };
  }

  test('kayıt örnek biçiminde; koordinat, çap, kol ve parça kodu birebir', () => {
    const { sonuc, kayit } = kur();
    expect(sonuc.ok).toBe(true);
    const by = {};
    kayit.pulleys.forEach((p) => { by[p.type] = p; });
    expect(by['fead-crank'].data).toMatchObject({ od: 160, contact: 'grooved', driver: true });
    expect(by['fead-crank'].data.x).toBeCloseTo(0, 9);
    expect(by['fead-idler'].data.x).toBeCloseTo(AG.idr.x, 9);
    expect(by['fead-idler'].data.y).toBeCloseTo(AG.idr.y, 9);
    expect(by['fead-idler'].data.contact).toBe('back');
    expect(by['fead-ac'].data.od).toBeCloseTo(127, 9);
    expect(by['fead-ac'].data.x).toBeCloseTo(AG.ac.x, 9);
    const t = by['fead-tensioner'].data;
    // Kayıt µm'ye yuvarlanır (dönüşüm gürültüsü sihirbazın alanına yazılmasın)
    expect(t.cenX).toBe(Math.round(AG.ten.x * 1000) / 1000);
    expect(t.cenY).toBe(Math.round(AG.ten.y * 1000) / 1000);
    expect(t.armLen).toBeCloseTo(90, 9);
    expect(t.armMeanDeg).toBeCloseTo(AG.aci, 9);
    expect(t.tenPart).toBe('T38624');
    // kayış parçası kasnak olarak GELMEZ (dosyada kayış düzlemi ortalayan
    // geniş bir silindir olarak duruyor — düz kasnak kuralına uyuyor); sıra
    // ağaç sırası ve öyle işaretli
    expect(sonuc.kasnaklar.map((k) => sonuc.parcalar[k.parca].rolOneri)).not.toContain('kayis');
    expect(kayit.pulleys.map((p) => p.type)).not.toContain('kayis');
    expect(kayit.siraKaynagi).toBe('agac');
    expect(kayit.route.map((k) => by[Object.keys(by).find((tp) => by[tp].key === k)].type))
      .toEqual(['fead-crank', 'fead-idler', 'fead-ac', 'fead-tensioner']);
    expect(kayit.uyarilar.join(' ')).toMatch(/Kayış sırası dosyadan okunmadı/);
    // Dört kasnak aynı düzlemde, eksenler paralel
    expect(sonuc.duzlem.yayilim).toBeLessThan(1e-9);
    expect(sonuc.duzlem.enBuyukAci).toBeLessThan(1e-9);
  });

  test('köprü modeli hatasız kurar; açıklık boyları raporla %0,5, sarımlar 0,2° içinde', () => {
    const { dugum } = kur();
    const r = veFeadBuildSystem(dugum);
    expect(r.errors).toEqual([]);
    expect(r.ok).toBe(true);
    expect(r.names).toEqual(['CRK', 'IDR', 'A_C', 'TEN']);
    const g = F.tensionerState(r.sys, REF.relMean).geom;
    g.names.forEach((nm, i) => {
      const hata = Math.abs(g.exitSpanLen(i) - REF.span[nm]) / REF.span[nm] * 100;
      expect({ kasnak: nm, hataPct: +hata.toFixed(3), ok: hata < 0.5 }).toMatchObject({ kasnak: nm, ok: true });
      expect(Math.abs(g.wrapDeg(i) - REF.wrap[nm])).toBeLessThan(0.2);
    });
  });

  test('AYNA kayıt modeli çözer ama krankın dönüş yönü TERSİNE döner (sessiz sınıf)', () => {
    const { sonuc } = kur();
    const kur2 = (ayna) => {
      const kayit = S.veFeadStpKayit(sonuc, { ayna, gergiKatalog: [] });
      const dugum = kayit.pulleys.map((p) => ({ id: 'st-' + p.key, type: p.type, customName: TIP_AD[p.type],
        def: componentDefs[p.type], data: Object.assign({ preload: 8.59, kArm: 0.482, meanLoad: 24.5442 }, p.data) }));
      kayit.route.forEach((k, i) => { dugum.find((n) => n.id === 'st-' + k).data.beltIndex = i + 1; });
      dugum.push({ id: 'b', type: 'fead-belt', def: componentDefs['fead-belt'], data: { profile: 'PK', brand: 'GATES', ribs: 8, beltDataMode: 'none' } });
      dugum.push({ id: 's', type: 'fead-solver', def: componentDefs['fead-solver'], data: { ratioMode: 'crankDirect' } });
      return veFeadBuildSystem(dugum);
    };
    const a = kur2(false), b = kur2(true);
    expect(a.ok && b.ok).toBe(true);
    expect(a.spin).toBe(-1);              // krank saat yönü (Gates AG00686)
    expect(b.spin).toBe(1);               // aynalanmış: ters — iki model de "çözülüyor"
  });
});
