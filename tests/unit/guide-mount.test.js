/**
 * guide-mount.test.js — TAKOZ KULLANIM KILAVUZU (js/guide-mount.js)
 *
 * FEAD ve Araç Performans kılavuzlarıyla aynı iki hata sınıfı hedefte:
 *   1) belge üretilir ama rapordan başka görünür,
 *   2) §14'ün sayıları sessizce bayatlar.
 *
 * BU MODÜLDE ÜÇÜNCÜ BİR KURAL VAR VE KAPISI AYRI: çekirdek DOM'suz ve açık
 * model kabul ediyor, yani Araç Performans kılavuzunun yapmak zorunda kaldığı
 * GLOBAL TAKASI burada GEREKMİYOR. Kılavuz kanvasa hiç dokunmamalı — dokunursa
 * gereksiz bir yan etki kalıcı hâle gelir.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const RP = require('../../js/cp-fead-report.js');
const MC = require('../../js/mount-core.js');

const stubs = stubGlobals();
document.body.innerHTML = '<div id="ve-canvas"></div>';
global.window = global;
global.nodes = [];
global.connections = [];

eval(loadSource('fead-report-template.js'));
eval(loadSource('mount-report-assets.js'));
Object.keys(RP).forEach((k) => { global[k] = RP[k]; });
global.veMountCore = MC.veMountCore || MC;

const KIT = require('../../js/guide-kit.js');
Object.keys(KIT).forEach((k) => { global[k] = KIT[k]; });
const GM = require('../../js/guide-mount.js');
Object.keys(GM).forEach((k) => { global[k] = GM[k]; });

beforeEach(() => resetStubs(stubs));

const DOC = GM.veGuideMountHTML();

// ═══════════════════════════════════════════════════════════════════════════
describe('belge iskeleti', () => {
  test('tam bir HTML belgesi', () => {
    expect(DOC.startsWith('<!DOCTYPE html>')).toBe(true);
    expect(DOC.trim().endsWith('</html>')).toBe(true);
    expect(DOC).toContain('<title>MFSim — Takoz Çökme-Titreşim Kılavuzu</title>');
    expect(DOC).toContain('<div class="page">');
  });

  test('antet TAM 5 alan', () => {
    const antet = (DOC.match(/<div class="antet">[\s\S]*?<div class="toc">/) || [''])[0];
    expect((antet.match(/<div class="f">/g) || []).length).toBe(5);
  });

  test('bütün bölümler ve içindekiler bağlantıları yerinde', () => {
    GM.VE_GUIDE_MOUNT_SECTIONS.forEach(([id, no, baslik]) => {
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
    expect(((GM.veGuideMountHTML()).match(/<caption>Tablo 1 /g) || []).length).toBe(1);
  });

test('KAÇIŞLANMIŞ MARKUP sızmıyor — başlıklar kaçışlanır, içlerine etiket yazılmaz', () => {
    // `_g*Tablo` başlıkları güvenli varsayılan olarak KAÇIŞLAR. İçine <sub>
    // yazmak, sayfada harfi harfine "k&lt;sub&gt;stat&lt;/sub&gt;" basar:
    // belge üretilir, hata çıkmaz, yalnız BAŞLIK ÇÖP GÖRÜNÜR. Takoz kılavuzunda
    // gerçekten oldu (24 kaçak). Kapı üç kılavuzda da aynı.
    const kacak = (DOC.match(/&lt;\/?[a-z]+[^&]{0,20}&gt;/g) || []);
    expect([...new Set(kacak)]).toEqual([]);
  });

    test('sızıntı yok ve dış kaynak yok', () => {
    expect(DOC).not.toContain('undefined');
    expect(DOC).not.toContain('NaN');
    expect(DOC).not.toContain('[object');
    expect(DOC).not.toMatch(/<script/i);
    expect(DOC).not.toMatch(/https?:\/\//);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('kozmetik — rapordan ÇIKARILAN CSS', () => {
  test('raporun jetonları ve sınıfları var', () => {
    expect(DOC).toContain('--prusya');
    expect(DOC).toContain('.antet');
    expect(DOC).toContain('.toc');
  });

  test('kullanılan her var(--…) belgede TANIMLI', () => {
    const kullanilan = new Set((DOC.match(/var\(--[a-z0-9-]+/g) || [])
      .map((s) => s.replace('var(', '')));
    const tanimli = new Set((DOC.match(/--[a-z0-9-]+\s*:/g) || [])
      .map((s) => s.replace(/\s*:$/, '').trim()));
    expect([...kullanilan].filter((k) => !tanimli.has(k))).toEqual([]);
  });

  test('alan tablolarının HER hücresi td.l', () => {
    const t = GM._gaAlanTablo ? null : GM._gmAlanTablo('X', [['a', 'b', 'c']]);
    expect((t.match(/<td class="l">/g) || []).length).toBe(3);
    expect(t).not.toContain('<td class="c">');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('§14 — CANLI çözüm', () => {
  test('bölüm gerçekten sayı üretti', () => {
    expect(DOC).not.toContain('sayılar üretilmedi');
  });

  test('çekirdek GERÇEKTEN çağrılıyor — casus', () => {
    const core = global.veMountCore;
    const asilSolve = core.solveAllCases;
    const asilModal = core.solveModal;
    const s1 = jest.fn(asilSolve);
    const s2 = jest.fn(asilModal);
    core.solveAllCases = s1;
    core.solveModal = s2;
    try { GM.veGuideMountHTML(); }
    finally { core.solveAllCases = asilSolve; core.solveModal = asilModal; }
    expect(s1).toHaveBeenCalled();
    expect(s2).toHaveBeenCalled();
  });

  test('KANVASA HİÇ DOKUNULMUYOR — çekirdek açık model alıyor', () => {
    // Araç Performans kılavuzu global takas etmek ZORUNDAYDI (çözücü global
    // okuyor); burada çekirdek DOM'suz, dolayısıyla takas GEREKMİYOR ve
    // yapılmamalı. Bir gün gerekirse bu kapı önce kırmızıya döner.
    const benimN = [{ id: 'x', type: 'mnt-motor', data: {} }];
    const benimC = [{ id: 'c1' }];
    global.nodes = benimN;
    global.connections = benimC;
    GM.veGuideMountHTML();
    expect(global.nodes).toBe(benimN);
    expect(global.connections).toBe(benimC);
    expect(global.nodes.length).toBe(1);
    global.nodes = [];
    global.connections = [];
  });

  test('birleşik kütle GİRİLEN kütlelerin toplamına eşit', () => {
    const core = global.veMountCore;
    const ex = core.getMountExampleList().filter((e) => e.id === 'siper')[0];
    const toplam = ex.model.components.reduce((s, c) => s + (c.mass || 0), 0);
    const t = (DOC.match(/<caption>Tablo [^<]*Birleşik kütle[^<]*<\/caption>[\s\S]*?<\/table>/) || [''])[0];
    expect(t.length).toBeGreaterThan(150);
    expect(t).toContain(RP._frFs(toplam, 1));
    // Gövde ve takoz sayıları da modelden
    expect(t).toContain('>' + ex.model.components.length + '<');
    expect(t).toContain('>' + ex.model.mounts.length + '<');
  });

  test('modal tablo ALTI modu ve etiketlerini basıyor', () => {
    const t = (DOC.match(/<caption>Tablo [^<]*Rijit gövde modları[^<]*<\/caption>[\s\S]*?<\/table>/) || [''])[0];
    expect(t.length).toBeGreaterThan(200);
    const satir = (t.match(/<tr>/g) || []).length - 1;   // başlık hariç
    expect(satir).toBe(6);
    // Frekanslar ARTAN sırada olmalı — sıralanmamış bir çözücü çıktısı
    // izolasyon yorumunu (en yüksek mod) sessizce yanlış yapar.
    const f = (t.match(/<td class="c">(\d+,\d+)<\/td>/g) || [])
      .map((s) => Number(s.replace(/[^\d,]/g, '').replace(',', '.')))
      .filter((v) => Number.isFinite(v));
    expect(f.length).toBeGreaterThanOrEqual(6);
    const ilkAlti = f.slice(0, 6);
    for (let i = 1; i < ilkAlti.length; i++) expect(ilkAlti[i]).toBeGreaterThanOrEqual(ilkAlti[i - 1]);
    // Hiçbiri sıfıra yapışmamalı — f≈0 modeli serbest demektir (bölüm 11).
    expect(ilkAlti[0]).toBeGreaterThan(0.5);
  });

  test('çökme tablosu bütün yük durumlarını taşıyor', () => {
    const core = global.veMountCore;
    const ex = core.getMountExampleList().filter((e) => e.id === 'siper')[0];
    const t = (DOC.match(/<caption>Tablo [^<]*Çökme ve çekme[^<]*<\/caption>[\s\S]*?<\/table>/) || [''])[0];
    ex.model.loadCases.forEach((lc) => { expect(t).toContain(lc.name); });
  });

  test('dinamik/statik oranı sütunu var ve 1’den büyük', () => {
    const t = (DOC.match(/<caption>Tablo [^<]*Takozlar — girilen[^<]*<\/caption>[\s\S]*?<\/table>/) || [''])[0];
    expect(t).toContain('Dinamik / statik');
    const oran = (t.match(/<td class="c">(\d,\d\d)<\/td>/g) || [])
      .map((s) => Number(s.replace(/[^\d,]/g, '').replace(',', '.')));
    expect(oran.length).toBeGreaterThanOrEqual(1);
    oran.forEach((v) => expect(v).toBeGreaterThan(1));
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('kılavuz ↔ program', () => {
  test('çekirdekteki HER örnek §3 tablosunda listeleniyor', () => {
    const liste = global.veMountCore.getMountExampleList();
    expect(liste.length).toBeGreaterThan(1);
    liste.forEach((e) => { expect(DOC).toContain(e.name); });
  });

  test('standart yük durumları çekirdekle AYNI adları taşıyor', () => {
    const liste = global.veMountCore.getMountExampleList();
    const adlar = new Set();
    liste.forEach((e) => (e.model.loadCases || []).forEach((lc) => adlar.add(lc.name)));
    ['Static', 'Max Bump', 'Acceleration', 'Braking'].forEach((n) => {
      expect(adlar.has(n)).toBe(true);
      expect(DOC).toContain(n);
    });
  });

  test('kit kayıt defteri bu üreticiyi adıyla çağırıyor', () => {
    const kayit = KIT.VE_GUIDE_KIT.filter((k) => k.id === 'mount')[0];
    expect(kayit).toBeTruthy();
    expect(kayit.uret).toBe('veGuideMountHTML');
    expect(typeof global[kayit.uret]).toBe('function');
    expect(KIT.veGuideKitReady(kayit)).toBe(true);
  });

  test('index.html kılavuzu KİTTEN SONRA yüklüyor', () => {
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const kit = html.indexOf('js/guide-kit.js');
    const mnt = html.indexOf('js/guide-mount.js');
    expect(kit).toBeGreaterThan(-1);
    expect(mnt).toBeGreaterThan(kit);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('yardımcılar', () => {
  test('_gmModelKur mm → m ve N/mm → N/m çevirisini ÇEKİRDEĞİN yardımcılarıyla yapıyor', () => {
    const core = global.veMountCore;
    const ex = core.getMountExampleList().filter((e) => e.id === 'siper')[0];
    const P = GM._gmModelKur(ex);
    expect(P).toBeTruthy();
    // İlk takozun z konumu mm cinsinden girildi; modelde m olmalı.
    expect(P.mounts[0].pos[2]).toBeCloseTo(ex.model.mounts[0].pos[2] / 1000, 9);
    // Rijitlik N/mm → N/m: 1000 kat.
    expect(P.mounts[0].kstat[2]).toBeCloseTo(ex.model.mounts[0].kstat[2] * 1000, 6);
  });

  test('_gmOrnekListe çekirdek yokken PATLAMIYOR', () => {
    const asil = global.veMountCore;
    global.veMountCore = undefined;
    try { expect(GM._gmOrnekListe()).toEqual([]); }
    finally { global.veMountCore = asil; }
  });
});
