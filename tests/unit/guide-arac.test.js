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
    expect(DOC).toContain('<title>MFSim — Araç Performans Kılavuzu</title>');
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
    expect(DOC).toContain('--prusya');
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
    expect(DOC).not.toContain('sayılar üretilemedi');
    expect(DOC).not.toContain('koşturulamadı');
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
    const sapma = (t.match(/[+−-]\d+,\d+%/g) || [])
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
