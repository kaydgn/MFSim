/**
 * guide-arac.test.js — ARAÇ PERFORMANS KULLANIM KILAVUZU (js/guide-arac.js)
 *
 * FEAD kılavuzuyla aynı iki hata sınıfı hedefte:
 *
 *   1) BELGE ÜRETİLİR AMA RAPORDAN BAŞKA GÖRÜNÜR. Kozmetik gömülü şablondan
 *      çalışma anında çıkarılıyor; kapılar ÜRETİLEN BELGEYİ tarıyor.
 *
 *   2) SAYILAR SESSİZCE BAYATLAR. §14 elle yazılmış MFSim sayısı taşımamalı:
 *      gerçek motor (veGetPowertrainChain → veFTRunSimulationEngine) üretim
 *      anında koşmalı. Kapı zinciri CASUSLA tutuyor.
 *
 * ÜÇÜNCÜ SINIF BU MODÜLE ÖZGÜ: çözücü GLOBAL `nodes` okuyor. Kılavuz onu
 * takas etmek zorunda ve GERİ VERMEK zorunda — vermezse kullanıcının açık
 * modeli kılavuz üretildikten sonra kaybolur. Kapı bunu ayrıca ölçüyor.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const RP = require('../../js/cp-fead-report.js');

const stubs = stubGlobals();
document.body.innerHTML = '<div id="ve-canvas"></div>';
global.window = global;
global.nodes = [];
global.connections = [];

eval(loadSource('fead-report-template.js'));
eval(loadSource('mount-report-assets.js'));
Object.keys(RP).forEach((k) => { global[k] = RP[k]; });

// Simülasyon motoru ve panel bağımlılıkları — gerçek dosyalar.
// `COMPONENT_SIGNALS` tarayıcıda components.js'ten gelir (kılavuzdan çok
// önce yüklenir); burada yalnız simülasyon motorunun ihtiyacı kadarı.
global.COMPONENT_SIGNALS = {};
eval(loadSource('numerics.js'));
eval(loadSource('cp-engine.js'));
eval(loadSource('cp-gearbox.js'));
eval(loadSource('cp-accessories.js'));
eval(loadSource('ft-performance.js'));
eval(loadSource('solver-pro.js'));
eval(loadSource('cp-arac-example.js'));

// `eval` ile yüklenen üst-seviye bildirimleri BU dosyanın kapsamında kalır;
// `guide-arac.js` ise `require` ile ayrı bir kapsamda koşuyor ve adları
// GLOBAL'den arıyor. Köprüyü kurmadan §14 örneği hiç bulamaz.
[
  'veApExampleList', 'veApExample',
  'veFTRunSimulationEngine', 'veGetPowertrainChain',
].forEach((k) => { global[k] = eval(k); });

// Gömülü topoloji tablosu — tarayıcıda build.js dolduruyor.
const TOPO_URL = 'assets/examples/ap_turan_topoloji.json';
global.window.__MNT_TOPOLOGIES = {};
global.window.__MNT_TOPOLOGIES[TOPO_URL] =
  JSON.parse(fs.readFileSync(path.join(ROOT, TOPO_URL), 'utf8'));

const KIT = require('../../js/guide-kit.js');
Object.keys(KIT).forEach((k) => { global[k] = KIT[k]; });
const GA = require('../../js/guide-arac.js');
Object.keys(GA).forEach((k) => { global[k] = GA[k]; });

beforeEach(() => resetStubs(stubs));

const DOC = GA.veGuideAracHTML();

// ═══════════════════════════════════════════════════════════════════════════
describe('belge iskeleti', () => {
  test('tam bir HTML belgesi', () => {
    expect(DOC.startsWith('<!DOCTYPE html>')).toBe(true);
    expect(DOC.trim().endsWith('</html>')).toBe(true);
    expect(DOC).toContain('<title>MFSim — Araç Performans kılavuzu</title>');
    expect(DOC).toContain('<div class="page">');
  });

  test('antet TAM 5 alan — şablon CSS’i repeat(5,1fr) ile diziyor', () => {
    const antet = (DOC.match(/<div class="antet">[\s\S]*?<div class="toc">/) || [''])[0];
    expect((antet.match(/<div class="f">/g) || []).length).toBe(5);
  });

  test('bütün bölümler ve içindekiler bağlantıları yerinde', () => {
    GA.VE_GUIDE_ARAC_SECTIONS.forEach(([id, no, baslik]) => {
      expect(DOC).toContain('id="' + id + '"');
      expect(DOC).toContain('href="#' + id + '"');
      expect(DOC).toContain(baslik);
      expect(no.length).toBeGreaterThan(0);
    });
  });

  test('tablo numaraları BOŞLUKSUZ ve her üretimde sıfırlanıyor', () => {
    const no = (DOC.match(/<caption>Tablo (\d+)/g) || [])
      .map((s) => Number(s.replace(/\D/g, '')));
    expect(no.length).toBeGreaterThan(10);
    no.forEach((n, i) => expect(n).toBe(i + 1));
    const ikinci = GA.veGuideAracHTML();
    expect((ikinci.match(/<caption>Tablo 1 /g) || []).length).toBe(1);
  });

test('KAÇIŞLANMIŞ MARKUP sızmıyor — başlıklar kaçışlanır, içlerine etiket yazılmaz', () => {
    // `_g*Tablo` başlıkları güvenli varsayılan olarak KAÇIŞLAR. İçine <sub>
    // yazmak, sayfada harfi harfine "k&lt;sub&gt;stat&lt;/sub&gt;" basar:
    // belge üretilir, hata çıkmaz, yalnız BAŞLIK ÇÖP GÖRÜNÜR. Takoz kılavuzunda
    // gerçekten oldu (24 kaçak). Kapı üç kılavuzda da aynı.
    const kacak = (DOC.match(/&lt;\/?[a-z]+[^&]{0,20}&gt;/g) || []);
    expect([...new Set(kacak)]).toEqual([]);
  });

    test('sızıntı yok — undefined / NaN / [object', () => {
    expect(DOC).not.toContain('undefined');
    expect(DOC).not.toContain('NaN');
    expect(DOC).not.toContain('[object');
  });

  test('dış kaynak yok — belge çevrimdışı açılır', () => {
    expect(DOC).not.toMatch(/<script/i);
    expect(DOC).not.toMatch(/https?:\/\//);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('kozmetik — rapordan ÇIKARILAN CSS', () => {
  test('raporun kendi jetonları ve sınıfları var', () => {
    expect(DOC).toContain('--vurgu');
    expect(DOC).toContain('.antet');
    expect(DOC).toContain('.toc');
  });

  test('kullanılan her var(--…) belgede TANIMLI', () => {
    const kullanilan = new Set((DOC.match(/var\(--[a-z0-9-]+/g) || [])
      .map((s) => s.replace('var(', '')));
    const tanimli = new Set((DOC.match(/--[a-z0-9-]+\s*:/g) || [])
      .map((s) => s.replace(/\s*:$/, '').trim()));
    const eksik = [...kullanilan].filter((k) => !tanimli.has(k));
    expect(eksik).toEqual([]);
  });

  test('alan tablolarının HER hücresi td.l — nowrap taşması sınıfı', () => {
    // Raporun `td` VARSAYILANI BİR SAYIDIR: mono, sağa dayalı, nowrap.
    // Cümle taşıyan bir hücre `td.c` ile basılırsa sayfa yatay taşar
    // (FEAD kılavuzunda gerçek tarayıcıda 393 px ölçüldü).
    const t = GA._gaAlanTablo('X', [['a', 'b', 'c']]);
    expect((t.match(/<td class="l">/g) || []).length).toBe(3);
    expect(t).not.toContain('<td class="c">');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('§14 — CANLI koşu, elle yazılmış MFSim sayısı yok', () => {
  test('bölüm gerçekten sayı üretti (örnek çözülemedi metni YOK)', () => {
    // İki geri dönüş metni de "sayılar üretilmedi" ile biter.
    expect(DOC).not.toContain('sayılar üretilmedi');
  });

  test('simülasyon motoru GERÇEKTEN çağrılıyor — casus', () => {
    // Sabit basan bir sürüm doğru sayıları gösterse bile çağrıyı yapmadığı
    // için burada kırmızı olur. Kapı ÜRETİCİYE değil ÇAĞRIYA bakıyor.
    const asil = global.veFTRunSimulationEngine;
    const casus = jest.fn(asil);
    global.veFTRunSimulationEngine = casus;
    try {
      GA.veGuideAracHTML();
    } finally {
      global.veFTRunSimulationEngine = asil;
    }
    expect(casus.mock.calls.length).toBeGreaterThanOrEqual(2); // iki kademe
  });

  test('KULLANICININ MODELİ GERİ VERİLİYOR — takas kalıcı olmamalı', () => {
    // Çözücü global `nodes` okuyor; kılavuz takas etmek zorunda. Geri
    // vermezse kullanıcının açık modeli kılavuz üretildikten sonra KAYBOLUR.
    const benimN = [{ id: 'x', type: 'engine', data: {} }];
    const benimC = [{ id: 'c1' }];
    global.nodes = benimN;
    global.connections = benimC;
    GA.veGuideAracHTML();
    expect(global.nodes).toBe(benimN);
    expect(global.connections).toBe(benimC);
    global.nodes = [];
    global.connections = [];
  });

  test('veTrResetView susturuluyor ve GERİ VERİLİYOR', () => {
    // Sessiz bir hesap kullanıcının eğri görünümünü sıfırlamamalı.
    const cagri = jest.fn();
    global.veTrResetView = cagri;
    GA.veGuideAracHTML();
    expect(cagri).not.toHaveBeenCalled();
    expect(global.veTrResetView).toBe(cagri);
    delete global.veTrResetView;
  });

  test('azami hız tablosu iSCAAN ile YAN YANA ve sapma makul', () => {
    const t = (DOC.match(/<caption>Tablo [^<]*Azami hız[^<]*<\/caption>[\s\S]*?<\/table>/) || [''])[0];
    expect(t.length).toBeGreaterThan(200);
    const G = GA.VE_GUIDE_ARAC_ISCAAN;
    // Raporun kendi sayıları belgede geçmeli (dış çıpa).
    expect(t).toContain(RP._frFs(G.vmax[1.257], 1));
    expect(t).toContain(RP._frFs(G.vmax[2.337], 1));
    // ...ve sapma sütunu %1'in altında olmalı: kalibrasyon bandı bu.
    const sapma = (t.match(/%[+−-]\d+,\d+/g) || [])   // yüzde önde (karar 7·C)
      .map((s) => Math.abs(Number(s.replace('−', '-').replace(',', '.').replace('%', ''))));
    expect(sapma.length).toBeGreaterThanOrEqual(2);
    sapma.forEach((p) => expect(p).toBeLessThan(1));
  });

  test('stall tablosu var ve iSCAAN’a %2 içinde', () => {
    const t = (DOC.match(/<caption>Tablo [^<]*Stall[^<]*<\/caption>[\s\S]*?<\/table>/) || [''])[0];
    expect(t.length).toBeGreaterThan(150);
    const say = (x) => {
      const m = String(x).match(/−?-?\d[\d.]*(?:,\d+)?/);
      return m ? Number(m[0].replace(/\./g, '').replace(',', '.').replace('−', '-')) : NaN;
    };
    const h = (t.match(/<td[^>]*>([\s\S]*?)<\/td>/g) || [])
      .map((c) => c.replace(/<[^>]+>/g, '').trim());
    const mf = say(h[1]);
    expect(Number.isFinite(mf)).toBe(true);
    const ref = GA.VE_GUIDE_ARAC_ISCAAN.stall;
    expect(Math.abs(mf - ref) / ref).toBeLessThan(0.02);
  });

  test('hızlanma tablosu dört çıpayı da taşıyor', () => {
    const t = (DOC.match(/<caption>Tablo [^<]*Hızlanma süreleri[^<]*<\/caption>[\s\S]*?<\/table>/) || [''])[0];
    expect(t).toContain('0–20 km/h');
    expect(t).toContain('0–40 km/h');
    expect(t).toContain('0–60 km/h');
    expect(t).toContain('0–80 km/h');
  });

  test('vites geçişleri iSCAAN BANDIYLA karşılaştırılıyor', () => {
    const t = (DOC.match(/<caption>Tablo [^<]*Vites geçişleri[^<]*<\/caption>[\s\S]*?<\/table>/) || [''])[0];
    expect(t.length).toBeGreaterThan(200);
    expect(t).toContain('1C → 2C');
    expect(t).toContain('iSCAAN bandı');
    // Geçişlerin çoğu bandın içinde olmalı — hepsini istemek, tablonun kendi
    // ~1,6 km/h çözünürlüğünü yok saymak olurdu.
    const icinde = (t.match(/bandın içinde/g) || []).length;
    const disinda = (t.match(/bandın dışında/g) || []).length;
    expect(icinde + disinda).toBeGreaterThanOrEqual(5);
    expect(icinde).toBeGreaterThan(disinda);
  });

  test('iSCAAN çıpaları DIŞARIDAN — hesaplanmıyor, kaynağı yazılı', () => {
    expect(GA.VE_GUIDE_ARAC_ISCAAN.rapor).toMatch(/^497-/);
    expect(DOC).toContain(GA.VE_GUIDE_ARAC_ISCAAN.rapor);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('kılavuz ↔ program', () => {
  test('kayıt defterindeki HER örnek §3 tablosunda listeleniyor', () => {
    const liste = veApExampleList();
    expect(liste.length).toBeGreaterThan(5);
    liste.forEach((e) => { expect(DOC).toContain(e.name); });
  });

  test('§3 örnek sayısını KAYIT DEFTERİNDEN yazıyor, elle değil', () => {
    expect(DOC).toContain('<strong>' + veApExampleList().length + '</strong> araç');
  });

  test('zincir tablosu gerçek topolojinin bileşen sayılarını basıyor', () => {
    const j = global.window.__MNT_TOPOLOGIES[TOPO_URL];
    const say = {};
    j.nodes.forEach((n) => { say[n.type] = (say[n.type] || 0) + 1; });
    const t = (DOC.match(/<caption>Tablo [^<]*Kurulan zincir<\/caption>[\s\S]*?<\/table>/) || [''])[0];
    const satir = (x) => {
      const r = t.match(new RegExp('<tr>(?:(?!</tr>)[\\s\\S])*<code>' + x + '</code>[\\s\\S]*?</tr>'));
      const h = r ? (r[0].match(/<td[^>]*>([\s\S]*?)<\/td>/g) || []).map((c) => c.replace(/<[^>]+>/g, '').trim()) : [];
      return h.length ? Number(h[h.length - 1]) : NaN;
    };
    expect(satir('wheel')).toBe(say.wheel);
    expect(satir('differential')).toBe(say.differential);
    expect(satir('engine')).toBe(say.engine);
  });

  test('kit kayıt defteri bu üreticiyi adıyla çağırıyor', () => {
    const kayit = KIT.VE_GUIDE_KIT.filter((k) => k.id === 'arac')[0];
    expect(kayit).toBeTruthy();
    expect(kayit.uret).toBe('veGuideAracHTML');
    expect(typeof global[kayit.uret]).toBe('function');
    expect(KIT.veGuideKitReady(kayit)).toBe(true);
  });

  test('index.html kılavuzu KİTTEN SONRA yüklüyor', () => {
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const kit = html.indexOf('js/guide-kit.js');
    const arac = html.indexOf('js/guide-arac.js');
    expect(kit).toBeGreaterThan(-1);
    expect(arac).toBeGreaterThan(kit);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('yardımcılar', () => {
  test('_gaZamanAt doğrusal ara değerleme yapıyor', () => {
    const R = { speed: [0, 10, 20], time: [0, 1, 2] };
    expect(GA._gaZamanAt(R, 0)).toBeCloseTo(0, 6);
    expect(GA._gaZamanAt(R, 15)).toBeCloseTo(1.5, 6);
    expect(GA._gaZamanAt(R, 99)).toBeNull();
  });

  test('_gaSapma işareti ve yüzdesi', () => {
    expect(GA._gaSapma(110, 100)).toContain('+');
    expect(GA._gaSapma(90, 100)).toMatch(/−|-/);
    expect(GA._gaSapma(1, 0)).toBe('—');
    expect(GA._gaSapma(NaN, 100)).toBe('—');
  });

  test('_gaKoslu hata durumunda global’leri YİNE geri veriyor', () => {
    const benimN = [{ id: 'x' }];
    global.nodes = benimN;
    const asil = global.veFTRunSimulationEngine;
    global.veFTRunSimulationEngine = () => { throw new Error('patla'); };
    try {
      const r = GA._gaKoslu({ nodes: [], connections: [] }, 'x');
      expect(r).toBeNull();
    } finally {
      global.veFTRunSimulationEngine = asil;
    }
    expect(global.nodes).toBe(benimN);
    global.nodes = [];
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('kılavuzun sesi ve yapısı (aşama 14)', () => {
  const duz = DOC.replace(/<(script|style|svg)\b[\s\S]*?<\/\1>/g, ' ').replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z#0-9]+;/g, ' ').replace(/\s+/g, ' ');
  const oku = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
  // Üreticide `' + '` ile bölünmüş dizgeler birleşik aranır.
  const SRC = oku('js/guide-arac.js').replace(/'\s*\+\s*'/g, '');
  const BILESEN = new Set([...oku('js/components.js')
    .matchAll(/^\s*'[a-z0-9-]+':\s*\{\s*\n\s*name:\s*'([^']+)'/gm)].map((m) => m[1]));
  const SERIT = new Set([...oku('js/ribbon.js').matchAll(/label:\s*'([^']+)'/g)]
    .map((m) => m[1].replace(/\\n/g, ' ')));

  test('ikinci kişi, geliştirme geçmişi ve yazılım anlatısı yok', () => {
    // eski: "Neyi siz verirsiniz", "Aceleniz varsa", "bu depoda ölçülmüş bir sınıf",
    // "bu bilinçlidir ve testi vardır", "kılavuz yapısal olarak bayatlayamaz",
    // "Ölçüldü ve tek bir atalet terimine yüklenemedi; uydurma katsayı konmadı"
    const SIZ = /(?<![\p{L}])(?:siz|sizin|size|sizi)(?![\p{L}])|\p{L}+(?:sınız|siniz|sunuz|sünüz|ınız|iniz|unuz|ünüz)\p{L}{0,4}(?![\p{L}])/giu;
    const YASAK = /(?<![\p{L}])(bu depoda|bilinçli\p{L}*|testi vardır|bayatla\p{L}*|ölçüldü|ölçülmüş|uydurma katsayı|takas eder|önerilen)(?![\p{L}])/giu;
    const bul = (re) => [...duz.matchAll(re)].map((m) => duz.slice(Math.max(0, m.index - 40), m.index + 40));
    expect(bul(SIZ)).toEqual([]);
    expect(bul(YASAK)).toEqual([]);
  });

  test('bayat anlatım yok: şeritte Çalıştır yok, δ yok, Yol ve Senaryo adları programınki', () => {
    expect(duz).not.toContain('Çalıştır');                   // şerit düğmesi "Çözücü", hesap "Hesapla"
    expect(duz).toContain('Hesapla');
    expect(duz).not.toMatch(/δ|Döner kütle faktörü/);         // çözücü δ okumaz: eşdeğer kütle ataletlerden
    expect(duz).not.toContain('Vites geçiş kontrolcüsü');     // bileşenin adı Şanzıman Kontrol
    expect(duz).not.toContain('Tek bir sabit eğim yüzdesi');  // manuel kip bir segment tablosu
    expect(duz).not.toMatch(/Enerji dengesi” seçiliyse/);      // enerji dengesi her koşuda
    expect(duz).not.toContain('Şerit → Rapor');               // raporlar Sonuçlar sayfasında
    expect(duz).not.toMatch(/Coast-Down’dan gelir|alanı kilitlidir/); // AP çözücüsü C_rr’yi Tekerlek’ten okur
  });

  test('çözücünün varsayılanları programdan: yöntem ve adım cp-solver.js’inki', () => {
    const src = oku('js/cp-solver.js');
    const yontem = /var method = d\.method \|\| '([a-z0-9]+)'/.exec(src);
    const adim = /var ftDt = d\.ftDt \|\| ([\d.]+)/.exec(src);
    expect(yontem && adim).toBeTruthy();
    expect(duz).toContain('Varsayılan ' + yontem[1].toUpperCase());
    expect(duz).toContain('Varsayılan ' + adim[1].replace('.', ','));
  });

  test('andığı bileşen ve şerit adları programda var', () => {
    const bil = [...SRC.matchAll(/<strong>([^<]+)<\/strong>\s+bileşen(?:i|ine|inde|inden|inin)(?=[\s.,;:)])/g)].map((m) => m[1]);
    const ser = [...SRC.matchAll(/[şŞ]erit(?:teki|ten)\s+<strong>([^<]+)<\/strong>/g)].map((m) => m[1]);
    expect(bil.length).toBeGreaterThan(3);
    expect(ser.length).toBeGreaterThan(3);
    expect(bil.filter((x) => !BILESEN.has(x))).toEqual([]);
    expect(ser.filter((x) => !SERIT.has(x))).toEqual([]);
  });

  test('Ek A’nın pencere ve kart adları programda var', () => {
    // Pencere sütunu bir bileşenin adı (ya da Sonuçlar sayfası); kart sütunu programın başlığı.
    const PROG = ['components.js', 'cp-engine.js', 'cp-torque-converter.js', 'cp-gearbox.js',
      'cp-drivetrain.js', 'component-extras.js', 'cp-solver.js', 'cp-matching.js',
      'cp-arac-example.js', 'results.js'].map((f) => oku('js/' + f)).join('\n');
    const t = (DOC.match(/<caption>Tablo [^<]*Alan → pencere eşlemesi<\/caption>[\s\S]*?<\/table>/) || [''])[0];
    const satir = [...t.matchAll(/<tr>((?:(?!<\/tr>)[\s\S])*)<\/tr>/g)].slice(1)
      .map((r) => [...r[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)]
        .map((c) => c[1].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').trim()));
    expect(satir.length).toBeGreaterThan(15);
    const yok = [];
    satir.forEach(([alan, pencere, kart]) => {
      pencere.split(' · ').forEach((x) => {
        if (x !== '—' && x !== 'Sonuçlar' && !BILESEN.has(x)) yok.push(alan + ' → pencere ' + x);
      });
      kart.split(' · ').forEach((x) => {
        if (x !== '—' && !PROG.includes(x)) yok.push(alan + ' → kart ' + x);
      });
    });
    expect(yok).toEqual([]);
  });

  test('alt bölüm numarası bölümünün numarasıyla başlar', () => {
    const sapan = [];
    let bolum = null, alt = 0;
    for (const m of DOC.matchAll(/<h2\b[^>]*><span class="no">([^<]+)<\/span>|<h([34])>(\d+(?:\.\d+)+)\s/g)) {
      if (m[1] !== undefined) { bolum = m[1].trim(); continue; }
      alt++;
      if (m[3].split('.')[0] !== bolum) sapan.push(bolum + ' içinde ' + m[3]);
    }
    expect(sapan).toEqual([]);
    expect(alt).toBeGreaterThan(15);
  });

  test('kılavuzun kendi bölüm göndermeleri var olan başlığa gider', () => {
    // eski: "Engel atlama → Bölüm 9" (9 engelden söz etmiyordu), "Eşleştirme → Bölüm 5 ve 6"
    const var_ = new Set();
    for (const m of DOC.matchAll(/<span class="no">(\d+)<\/span>|<h[34]>(\d+(?:\.\d+)+)\s/g)) var_.add(m[1] || m[2]);
    const yok = [];
    let bakilan = 0;
    for (const m of duz.matchAll(/(Bölüm|bölüm)\s(\d+(?:\.\d+)*)/g)) {
      bakilan++;
      if (!var_.has(m[2])) yok.push(m[0] + ' ← ' + duz.slice(Math.max(0, m.index - 40), m.index + 20));
    }
    expect(yok).toEqual([]);
    expect(bakilan).toBeGreaterThan(10);
    expect(duz).not.toMatch(/bölüm \d/);    // gönderme tek yazımla: "Bölüm N"
  });
});
