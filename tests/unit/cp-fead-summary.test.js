/**
 * cp-fead-summary.test.js — FEAD ÖZET RAPORU (js/cp-fead-summary.js)
 *
 * Özet rapor, tedarikçi (Gates) çıktısının sayfa düzenini izleyen kısa
 * belgedir. Kaynağı AG00976 raporu ve o rapor ZATEN doğrulama fixture'ımızda:
 * yani bu testler "etiket var mı" değil, BASILAN SAYININ tedarikçi sayfasını
 * geri verip vermediğini ölçüyor.
 *
 * Kapsam ayrımı:
 *   cp-fead-report.test.js   ayrıntılı raporun içeriği
 *   BU DOSYA                 özet raporun sayfaları, Gates çıpaları, tür seçimi
 */
const M = require('../../js/fead-model.js');
const F = require('../../js/fead-core.js');
const RP = require('../../js/cp-fead-report.js');

const stubs = stubGlobals();
document.body.innerHTML = '<div id="ve-canvas"></div>';
global.nodes = [];
global.connections = [];
eval(loadSource('components.js'));
global.componentDefs = componentDefs;
global.FEADCore = F;
Object.keys(M).forEach((k) => { global[k] = M[k]; });
const CP = require('../../js/cp-fead.js');
Object.keys(CP).forEach((k) => { if (global[k] === undefined) global[k] = CP[k]; });
// Sayı biçimi ve kayma hükmü ayrıntılı rapordan gelir — ikinci kopya YOK.
Object.keys(RP).forEach((k) => { global[k] = RP[k]; });
const SU = require('../../js/cp-fead-summary.js');
Object.keys(SU).forEach((k) => { if (global[k] === undefined) global[k] = SU[k]; });

function coz(anahtar) {
  const pack = veFeadExampleNodes(anahtar);
  const ns = pack.nodes.map((n) => ({
    id: n.id, type: n.type, def: componentDefs[n.type],
    customName: n.customName, data: JSON.parse(JSON.stringify(n.data))
  }));
  const build = veFeadBuildSystem(ns, pack.connections);
  const solv = ns.filter((n) => componentDefs[n.type] && componentDefs[n.type].isFeadSolver)[0];
  const R = veFeadAnalyze(build, {
    rows: veFeadDutyRows(solv), cylinders: 6, fatigueModel: 'PK-2_2p-MT3'
  });
  R.build = build; R.pulleyNames = build.names;
  R.serviceFact = (solv && solv.data && Number(solv.data.serviceFact)) || 0;
  return R;
}
const NODE = { id: 'rep1', type: 'fead-report', data: { docNo: 'X-1', revision: 'A' } };

let R = null, DOC = '';
beforeAll(() => {
  R = coz('AG00976_GATES_2025');
  DOC = SU.veFeadSummaryHTML(R, NODE);
});
beforeEach(() => resetStubs(stubs));

// Metni tabloya bakmadan taramak için: etiketten sonraki N hücreyi ver.
function hucreler(html, etiket, adet) {
  const t = html.replace(/<[^>]+>/g, '|').replace(/\|+/g, '|');
  const i = t.indexOf(etiket);
  if (i < 0) return null;
  return t.slice(i).split('|').filter((s) => s.trim()).slice(1, 1 + adet).map((s) => s.trim());
}
// Türkçe biçimli sayıyı geri çevir: '−163,5' → -163.5
const say = (s) => Number(String(s).replace('−', '-').replace(/\s/g, '').replace(',', '.'));

// ═══════════════════════════════════════════════════════════════════════════
describe('belge iskeleti', () => {
  test('beş sayfa, her birinde künye bloğu ve sayfa numarası', () => {
    expect((DOC.match(/class="sheet"/g) || []).length).toBe(5);
    expect((DOC.match(/class="hdr"/g) || []).length).toBe(5);      // tedarikçi anteti
    expect((DOC.match(/class="h1"/g) || []).length).toBe(5);        // sayfa başlığı
    SU.VE_FSR_SHEETS.forEach((ad) => expect(DOC).toContain(ad));
    for (let i = 1; i <= 5; i++) expect(DOC).toContain('Sayfa ' + i + ' / 5');
  });

  test('tek dosya ve çevrimdışı — harici URL yok', () => {
    const dis = (DOC.replace(/https?:\/\/www\.w3\.org\/[^"')\s]*/g, '')
      .match(/https?:\/\/[^"')\s]+/g) || []);
    expect(dis).toEqual([]);
  });

  // Tedarikçi çıktısının sayfası DİKEY; yatay bir sayfa düzeni onun iki
  // sütunlu yerleşimini taşıyamaz.
  test('A4 DİKEY basar', () => {
    expect(SU._fsrCss()).toContain('size:A4 portrait');
  });

  test('BMC markası künye bloğunda', () => {
    expect(SU._fsrLogo()).toContain('BMC');
    expect((DOC.match(/class="hdr-logo"/g) || []).length).toBe(5);
  });

  test('hiçbir yerde undefined / NaN / [object sızmıyor', () => {
    const govde = DOC.split('<body>')[1] || '';
    expect(govde).not.toMatch(/undefined/);
    expect(govde).not.toMatch(/\bNaN\b/);
    expect(govde).not.toMatch(/\[object/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// GATES ÇIPALARI — AG00976 raporunun kendi sayfaları geri üretiliyor mu?
// Referans: 05June2025 tarihli Gates v13.02 çıktısı (fixture'daki kayıtla aynı).
describe('Gates çıpaları — tedarikçi sayfası geri üretiliyor', () => {
  // Tedarikçi sayfasında satır = KASNAK, sütun = büyüklük.
  test('sayfa 2: açıklık, sarım ve hız oranı birebir', () => {
    const s2 = SU._fsrSheet2(R, NODE);
    const G = [[148.0, 156.2, 1.000], [141.4, 52.8, 2.130], [150.8, 198.4, 1.065],
               [272.7, 64.3, 2.130], [194.4, 157.1, 2.768], [141.3, 34.6, 2.130]];
    R.pulleyNames.forEach((ad, i) => {
      // Sütunlar: açıklık · sarım · İŞARET (+/−) · hız oranı. İşaret sütunu
      // sarımın yönüdür (sırttan temas eden kasnakta eksi) ve bir sayı değil.
      const c = hucreler(s2.slice(s2.indexOf('Çözülmüş Kayış Yolu')), ad, 4);
      expect(Math.abs(say(c[0]) - G[i][0])).toBeLessThan(0.1);
      expect(Math.abs(say(c[1]) - G[i][1])).toBeLessThan(0.1);
      expect(['+', '−']).toContain(c[2]);
      expect(Math.abs(say(c[3]) - G[i][2])).toBeLessThan(0.002);
    });
  });

  test('sayfa 3: gergi konum tablosu ve take-up oranı birebir', () => {
    const s3 = SU._fsrSheet3(R, NODE);
    expect(s3).toMatch(/0,708 mm\/°/);
    // Büyüklük adının hemen ardından BİRİM hücresi geliyor (`<span class="u">`),
    // veri ondan sonra başlıyor — yedi hücre okunup ilki atılıyor.
    const kol = hucreler(s3, 'Kol konumu', 7).slice(1).map(say);
    const reb = hucreler(s3, 'Gereken efektif kayış boyu', 7).slice(1).map(say);
    [16.1, 11.4, 356.3, 348.0, 339.1, 315.7].forEach((g, i) =>
      expect(Math.abs(kol[i] - g)).toBeLessThan(0.2));
    [1733.8, 1730.9, 1720.6, 1714.6, 1708.6, 1699.1].forEach((g, i) =>
      expect(Math.abs(reb[i] - g)).toBeLessThan(0.1));
  });

  // Matrisler "Yükler" sayfasında (4): tedarikçi çıktısında ayrı sayfalardaydı,
  // burada aynı soruyu (ne kadar yükleniyor) tek sayfa cevaplıyor.
  test('sayfa 4: 880 d/d ortalama gerginlik ve hubload birebir', () => {
    const s5 = SU._fsrSheet4(R, NODE);
    function satir880(baslik) {
      const t = s5.replace(/<[^>]+>/g, '|').replace(/\|+/g, '|');
      const g = t.slice(t.indexOf(baslik)).split('|').map((x) => x.trim()).filter(Boolean);
      const k = g.indexOf('880');                       // ilk veri satırının devri
      return g.slice(k + 1, k + 7).map(say);
    }
    const ten = satir880('Ortalama Gerginlikler');
    const hub = satir880('Ortalama Hubloadlar');
    [1381, 1380, 1023, 1022, 545, 544].forEach((g, i) =>
      expect(Math.abs(ten[i] - g)).toBeLessThanOrEqual(2));
    [1891, 1228, 2372, 1088, 1539, 324].forEach((g, i) =>
      expect(Math.abs(hub[i] - g)).toBeLessThanOrEqual(2));
  });

  test('tasarım gerginliği türetilip 544 N basılıyor', () => {
    expect(SU._fsrSheet1(R, NODE)).toMatch(/544 N/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('tepe yük tablosu', () => {
  // Tepe, ORTALAMANIN ALTINA düşemez. İlk sürümde düşüyordu: kW sözlüğü ikinci
  // kez veFeadDutyToCore'dan geçiriliyor, anahtarlar tutmuyor ve BÜTÜN
  // aksesuarlar 0 kW ile koşuyordu (ölçüldü: FAN tepe 634 N, ortalaması 1381 N).
  // Sessiz sınıf — tablo yine üretiliyor, yalnız sayı küçülüyor.
  test('TEPE GERGİNLİK ORTALAMANIN ALTINDA OLAMAZ', () => {
    const pk = SU._fsrPeak(R);
    expect(pk).toBeTruthy();
    const d0 = R.analysis.duty.filter((d) => Math.round(d.engineRpm) === Math.round(pk.engineRpm))[0];
    expect(d0).toBeTruthy();
    pk.rows.forEach((r, i) => {
      const ort = d0.perPulley[i].exitTensionN;
      expect(r.tensionN).toBeGreaterThanOrEqual(ort - 1e-6);
    });
  });

  test('yükler gerçekten kullanılıyor — sıfırlanınca tepe DÜŞÜYOR', () => {
    const kopya = JSON.parse(JSON.stringify({ duty: R.duty }));
    const R2 = Object.assign({}, R, {
      duty: kopya.duty.map((r) => Object.assign({}, r, { loadsKw: {} }))
    });
    const a = SU._fsrPeak(R), b = SU._fsrPeak(R2);
    expect(a.rows[0].tensionN).toBeGreaterThan(b.rows[0].tensionN + 100);
  });

  // Tepe yük GENEL BAKIŞ sayfasında (1) — Gates de 1. sayfasında basıyor.
  test('kalibre olmadığı ve sapma bandı BELGEDE yazılı', () => {
    const s1 = SU._fsrSheet1(R, NODE);
    expect(s1).toMatch(/kalibre değil/i);
    expect(s1).toContain(SU.VE_FSR_PEAK_BAND);
    expect(s1).toMatch(/gergi kolu dinamiğini içermez/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('kanvastan gelen şekil', () => {
  // Ayrıntılı raporda ölçülen ders: o çizici UYGULAMANIN palet jetonlarını
  // kullanıyor; tanımsız var() kalıtılan `stroke` için `none` demek, yani
  // kayış ve kasnaklar GÖRÜNMEZ olur.
  test('şekil .appfig taşıyor ve kullandığı HER jeton CSS\'te tanımlı', () => {
    expect(DOC).toContain('class="appfig fig"');
    const i = DOC.indexOf('class="appfig fig"');
    const blok = DOC.slice(i, i + 60000);
    const jeton = [...new Set([...blok.matchAll(/var\((--[a-z-]+)\)/g)].map((m) => m[1]))];
    expect(jeton.length).toBeGreaterThan(3);
    const css = SU._fsrCss();
    expect(jeton.filter((j) => !new RegExp('\\' + j + '\\s*:').test(css))).toEqual([]);
  });

  test('şema tek çiziciden geliyor (kendi geometrisini yazmıyor)', () => {
    expect(DOC).toContain('data-ve="belt"');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('tedarikçi sayfa düzeni', () => {
  // ŞEKİL SAYISI DEĞİL, ŞEKİL DAĞILIMI. Kullanıcı önce "her yere bu şekli
  // koymuşsun" dedi (aynı şema üç sayfada), sonra "şekiller çok büyük", sonra
  // da "Gates raporundaki tüm şekilleri çıkar bakalım" — ve sonuncusunda
  // ölçüm onu doğruladı: tedarikçi çıktısının BEŞ şekil türünden ÜÇÜ bizde
  // yoktu. Doğru kural "tek şekil" değil: HER ŞEKİL BİR KEZ, konusuna ait
  // sayfada. Kapı dağılımı tutuyor.
  test('Gates’in beş şekli var ve her biri BİR KEZ, konusuna ait sayfada', () => {
    const sf = [1, 2, 3, 4, 5].map((n) => SU['_fsrSheet' + n](R, NODE));
    // yerleşim şeması (kanvas çizicisi) — yalnız sayfa 1
    expect(sf.map((h) => (h.match(/class="appfig fig"/g) || []).length)).toEqual([1, 0, 0, 0, 0]);
    // grafikler (`class="fig"` — şemanınki `class="appfig fig"` olduğu için
    // bu kalıba GİRMEZ): s1 doğal frekans · s3 gerginlik + take-up · s5 kayma
    expect(sf.map((h) => (h.match(/class="fig"/g) || []).length)).toEqual([1, 0, 2, 0, 1]);
    // toplam SVG: 5 logo + 1 şema + 4 grafik
    expect(DOC.match(/<svg/g).length).toBe(5 + 1 + 4);
    // her grafiğin KENDİ imzası bir kez geçiyor (ikinci kopya yok)
    [/data-ve="tension-curve"/g, /data-ve="takeup-curve"/g,
     /data-ve="span-freq"/g, /data-ve="sf-bar"/g].forEach((re) => {
      expect((DOC.match(re) || []).length).toBeGreaterThan(0);
    });
    expect((DOC.match(/data-ve="tension-curve"/g) || []).length).toBe(1);
    expect((DOC.match(/data-ve="takeup-curve"/g) || []).length).toBe(1);
  });

  // GERGİ KOL ZARFI ŞEMANIN İÇİNDE — Gates 5. sayfasında da öyle. Bedeli 0 px
  // (aynı şeklin içinde) ama sayfa 3'ün zarf tablosunun görsel karşılığı.
  test('şema altı kol konumunu üst üste çiziyor, ETİKETSİZ', () => {
    const s1 = SU._fsrSheet1(R, NODE);
    expect((s1.match(/data-ve="belt-ghost"/g) || []).length).toBe(5);      // 6 konum − çizilen 1
    expect((s1.match(/data-ve="pulley-ghost"/g) || []).length).toBe(5);
    // Etiket kapalı: 395 px'lik şemada altı ad üst üste biniyordu (ölçüldü:
    // "Serbest" ile "Değişt." 104 px² çakışma). Konumların adı sayfa 3'te.
    expect(s1).not.toContain('data-ve="ghost-label"');
  });

  // Ayrıntılı raporun ŞEKİL işlevleri ile BÖLÜM işlevleri karışabiliyor:
  // `_frTakeupFigure` bir bölüm üreticisidir (başlık + paragraflar + iki şekil)
  // ve özet rapora çağrılınca §8.9'un gövdesini sürüklüyordu (ölçüldü).
  // Kapı sayfanın içine bölüm gövdesi girmediğini tutar.
  test('sayfalara ayrıntılı raporun BÖLÜM metni sızmıyor', () => {
    [1, 2, 3, 4, 5].forEach((n) => {
      // SVG'ler ayıklanır: koordinatlarda "8.35" gibi diziler var, bölüm
      // numarası aramak onları yakalardı.
      const h = SU['_fsrSheet' + n](R, NODE).replace(/<svg[\s\S]*?<\/svg>/g, '');
      expect(h).not.toMatch(/<h3>/);
      expect(h).not.toMatch(/\b8\.\d+\s+[A-ZÇĞİÖŞÜ]/);   // "8.9 Kayış take-up…"
      expect(h).not.toMatch(/figcaption/);              // şekil numarası da sızmaz
    });
    expect(SU._fsrSheet3(R, NODE)).toMatch(/data-ve="tension-curve"/);
  });

  test('gergi kasnağının konumu türetilmiş olarak BASILIYOR', () => {
    const s2 = SU._fsrSheet2(R, NODE);
    const mean = R.analysis.positions.filter((p) => p.position === 'Mean')[0];
    // −161,97 / 91,29 — tedarikçi sayfasının kendi değerleri
    expect(Math.abs(mean.idlerX - (-161.97))).toBeLessThan(0.2);
    const ten = R.build.sys.pulleys.filter((p) => p.tensioner)[0];
    const tbl = s2.slice(s2.indexOf('Kasnak Yerleşimi'));
    const hucre = hucreler(tbl, ten.name, 2).map(say);   // yardımcı etiketi zaten atlar
    expect(Math.abs(hucre[0] - mean.idlerX)).toBeLessThan(0.1);
    expect(Math.abs(hucre[1] - mean.idlerY)).toBeLessThan(0.1);
    expect(s2).toMatch(/bir girdi değildir/);
  });

  // Sayfa 1 "nasıl duruyor + özetle nasıl" sorusunu cevaplar: şema, iki künye,
  // beş kritik sayı ve belgenin KAPSAMI. Kapsam bloğu bir süs değil — bir özet
  // raporun en pahalı sessiz hatası, İÇERMEDİĞİ bir kontrolün yapıldığı
  // izlenimini bırakmaktır.
  test('sayfa 1: şema · künyeler · kritik sayılar · kapsam', () => {
    const s1 = SU._fsrSheet1(R, NODE);
    ['Kayış', 'Otomatik gergi', 'Belgenin Kapsamı',
     'Tasarım gerginliği', 'En düşük kayma emniyeti', 'B10 kayış ömrü',
     'Kapalı çevrim', 'Çalışma çevrimi'].forEach((b) => expect(s1).toContain(b));
    expect((s1.match(/class="card[ "]/g) || []).length).toBe(5);
    expect(s1).toMatch(/Bu belgede yer ALMAZ/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('gerginlik grafiği ölçeği — Load ölçeğe GİRMEZ', () => {
  // Load bir MEKANİK DURDURUCU: orada take-up tekilleşir ve gerginlik çalışma
  // değerinin on katına çıkar (AG00976: 5257 N ↔ 544 N). Tabana katılınca y
  // ekseni 8411 N'e uzuyor ve altı çalışma konumu x ekseninin dibinde tek
  // çizgiye yapışıyordu — fonksiyonun kendi yorumunun tam tersi.
  test('y ekseni çalışma konumlarına göre, Load\'a göre DEĞİL', () => {
    const svg = RP.veFeadFigureRaw(RP._frTensionFigure, R, 820, 300);
    const sayilar = [...svg.matchAll(/>([0-9][0-9.]*)</g)].map((m) => Number(m[1]))
      .filter((v) => Number.isFinite(v));
    const enBuyuk = Math.max.apply(null, sayilar);
    const pos = R.analysis.positions.filter((p) => !p.error);
    const load = pos.filter((p) => p.position === 'Load')[0];
    const calisma = Math.max.apply(null, pos.filter((p) => p.position !== 'Load')
      .map((p) => p.tensionN));
    expect(load.tensionN).toBeGreaterThan(calisma * 3);   // fikstür gerçekten tekil
    expect(enBuyuk).toBeLessThan(load.tensionN * 0.6);    // ölçek ona uymuyor
    expect(enBuyuk).toBeGreaterThan(calisma);             // ama çalışmayı kapsıyor
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('rapor türü seçimi', () => {
  test('iki tür sunuluyor ve varsayılan DETAYLI', () => {
    expect(RP.VE_FEAD_REPORT_KINDS.map((k) => k.key)).toEqual(['detailed', 'summary']);
    expect(RP.veFeadReportKind({ data: {} })).toBe('detailed');
    expect(RP.veFeadReportKind({ data: { reportKind: 'summary' } })).toBe('summary');
    // Eski projelerde alan YOK — bugüne kadarki davranış korunmalı.
    expect(RP.veFeadReportKind({})).toBe('detailed');
  });

  test('panel her iki seçeneği de çiziyor ve seçileni işaretliyor', () => {
    const a = RP._frKindPicker({ id: 'n1', data: {} }, 'detailed');
    const b = RP._frKindPicker({ id: 'n1', data: {} }, 'summary');
    RP.VE_FEAD_REPORT_KINDS.forEach((k) => { expect(a).toContain(k.ad); expect(b).toContain(k.ad); });
    expect(a).toContain("veFeadSetChoice('n1','reportKind','summary')");
    // seçili olan farklı çerçeve alıyor → iki çıktı AYNI olamaz
    expect(a).not.toBe(b);
  });

  test('panel türe göre farklı düğme yazısı basıyor', () => {
    global.veFeadResults = R;
    const d = RP.getFeadReportPropertiesHTML({ id: 'n1', type: 'fead-report', data: {} });
    const s = RP.getFeadReportPropertiesHTML({ id: 'n1', type: 'fead-report', data: { reportKind: 'summary' } });
    expect(d).toContain('Detaylı Raporu Oluştur');
    expect(s).toContain('Özet Raporu Oluştur');
    delete global.veFeadResults;
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('sayı biçimi ayrıntılı raporla ORTAK', () => {
  test('Türkçe virgül ve GERÇEK eksi', () => {
    const s3 = SU._fsrSheet3(R, NODE);
    expect(s3).toMatch(/−16[0-9],[0-9]/);      // U+2212, ASCII '-' değil
    expect(s3).not.toMatch(/>-1[0-9][0-9],/);
  });

  test('girilmemiş değer 0 değil — em dash', () => {
    const R2 = Object.assign({}, R, { life: {} });
    expect(SU._fsrSheet1(R2, NODE)).toContain('—');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('çözülmemiş / eksik model', () => {
  test('çalışma çevrimi yoksa sayfa boş kalmıyor, SEBEP yazıyor', () => {
    const R2 = Object.assign({}, R, { analysis: Object.assign({}, R.analysis, { duty: [] }) });
    expect(SU._fsrSheet4(R2, NODE)).toMatch(/tanımlı değil/);
    expect(SU._fsrSheet5(R2, NODE)).toMatch(/tanımlı değil/);
  });

  test('şema çizilemezse yerine sebep konuyor', () => {
    const R2 = Object.assign({}, R, { build: null });
    expect(SU._fsrSheet1(R2, NODE)).toMatch(/çizilemedi/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// KOZMETİK KARARLAR — kullanıcı bildirimi (2026-08-26): "Zaten tablolar
// diyagramlar taşmış, yazılar komik bir şekilde kötü duruyor."
// ÖLÇÜLDÜ (gerçek tarayıcı, önceki sürüm): 41 yatay taşma, 17 ayrı punto,
// 8,5 px altında 651 öge, 8 SVG yazısı viewBox dışında. Aşağıdaki kapılar o
// ölçümlerin kök nedenlerini tutuyor; yerleşimin kendisi E2E'de ölçülüyor.
describe('kozmetik — okunabilirlik kararları', () => {
  // ── KISA KOD ──────────────────────────────────────────────────────────
  // Matris sütun başlığı kasnak ADIYSA tablo A4'e sığmıyor: "Otomatik Gergi
  // (E9843)" tek başına 22 karakter. Sığdırmak için punto 8,2'ye düşürülmüştü;
  // okunaksızlığın kökü buydu. Tedarikçi çıktısının FAN/IDR/A_C kullanma
  // sebebi de aynı.
  test('kasnak kodları kısa, TEKİL ve künyede karşılığı var', () => {
    const kod = SU._fsrCodes(R.build.sys);
    expect(kod.length).toBe(R.build.sys.pulleys.length);
    kod.forEach((k) => {
      expect(k.length).toBeLessThanOrEqual(5);
      expect(k).toMatch(/^[A-ZÇĞİÖŞÜ0-9_/]+$/);
    });
    expect(new Set(kod).size).toBe(kod.length);            // çakışma YOK
    const kunye = SU._fsrCodeLegend(R.build.sys);
    kod.forEach((k, i) => {
      expect(kunye).toContain(k);
      expect(kunye).toContain(R.build.sys.pulleys[i].name);
    });
  });

  test('aynı adlı iki kasnak AYRI kod alır', () => {
    const sahte = { pulleys: [{ name: 'Avara' }, { name: 'Avara' }, { name: 'Avara' }] };
    const kod = SU._fsrCodes(sahte);
    expect(new Set(kod).size).toBe(3);
  });

  // Kodu KULLANAN her sayfa künyesini de basmalı: kısaltma ancak karşılığı
  // aynı sayfada duruyorsa okunabilir (belge sayfa sayfa basılıyor).
  test('kod kullanan her sayfada kod künyesi var', () => {
    [1, 2, 4, 5].forEach((n) => {
      const h = SU['_fsrSheet' + n](R, NODE);
      expect(h).toContain('class="legend"');
    });
  });

  // ── SABİT SÜTUN ───────────────────────────────────────────────────────
  // Bütün hücreleri aynı olan sütun satır başına hiçbir şey söylemiyor ama
  // kalan sütunlardan genişlik çalıyor. Künyeye iner; BİLGİ KAYBI YOK.
  test('sabit sütun tablodan çıkar ama künyede YAZILI kalır', () => {
    const head = ['d/d', 'A', 'B', 'C'];
    const rows = [['880', '1', '9', '5'], ['1000', '2', '9', '6'], ['1100', '3', '9', '7']];
    const sbt = SU._fsrConstCols(head, rows, 1);
    expect(sbt.map((x) => x.i)).toEqual([2]);              // yalnız B sabit
    const sade = SU._fsrStripCols(head, rows, sbt);
    expect(sade.head).toEqual(['d/d', 'A', 'C']);
    expect(sade.rows[0]).toEqual(['880', '1', '5']);
    expect(SU._fsrConstNote(sbt)).toContain('B');
    expect(SU._fsrConstNote(sbt)).toContain('9');
  });

  test('iki satırlık tabloda "sabit" aranmaz — tesadüf olabilir', () => {
    expect(SU._fsrConstCols(['a', 'b'], [['1', '9'], ['2', '9']], 1)).toEqual([]);
  });

  test('sayfa 4 girdi tablosundan sabit sütunlar gerçekten düşmüş', () => {
    const s4 = SU._fsrSheet4(R, NODE);
    const blok = s4.slice(s4.indexOf('Çalışma Çevrimi Girdisi'), s4.indexOf('Ortalama Gerginlikler'));
    expect(blok).toMatch(/tablodan çıkarıldı/);
    expect(blok).not.toContain('Sıcaklık<br>[°C]');      // sabitti (90 °C)
    expect(blok).toContain('Sıcaklık');                   // ama künyede duruyor
  });

  // ── KALINLIK GÖMÜLÜ AĞIRLIKLARA BAĞLI ─────────────────────────────────
  // Yazı tipleri belgeye GÖMÜLÜ ve küme sınırlı. Olmayan bir ağırlık
  // istendiğinde tarayıcı glifleri kendisi şişiriyor (sentetik kalın); eş
  // aralıklı bir yüzde 9 px civarında harfler birbirine giriyor.
  test('istenen her font-weight gömülü kümede var', () => {
    const IZIN = { Archivo: [400, 700], 'Source Serif 4': [400, 600], 'IBM Plex Mono': [400, 500] };
    const css = SU._fsrCss();
    // Kural blokları: "<seçici>{...}" — aile ve ağırlık aynı blokta ise eşleşir
    const kotu = [];
    css.replace(/\{([^}]*)\}/g, (_, g) => {
      const aile = (g.match(/font-family:\s*'([^']+)'/) || [])[1];
      const w = (g.match(/font-weight:\s*(\d+)/) || [])[1];
      if (aile && w && IZIN[aile] && IZIN[aile].indexOf(Number(w)) < 0) kotu.push(aile + '@' + w);
      return _;
    });
    expect(kotu).toEqual([]);
    // Belgenin varsayılan <b> ağırlığı serif tavanı olan 600 olmalı
    expect(css).toMatch(/b,strong\{font-weight:600\}/);
    // Logo da gömülü ağırlıkta (800 istenirse sentetik olurdu)
    expect(SU._fsrLogo()).toMatch(/font-weight="700"/);
    expect(SU._fsrLogo()).not.toMatch(/font-weight="800"/);
  });

  // ── TEK ÖLÇEK ─────────────────────────────────────────────────────────
  // Punto SATIR İÇİNDE yazılmaz; hepsi --f-* jetonlarından gelir. Bu belgenin
  // bugüne kadarki en pahalı kozmetik hatası, blokların kendi puntolarını
  // yazmasıydı (17 ayrı punto).
  test('punto TEK ölçekten gelir — satır içi px YOK', () => {
    const css = SU._fsrCss();
    const jeton = [...new Set([...css.matchAll(/--f-(\w+):\s*([\d.]+)px/g)].map((m) => m[2]))];
    expect(jeton.length).toBeLessThanOrEqual(6);
    jeton.forEach((v) => expect(Number(v)).toBeGreaterThanOrEqual(8.5));
    const hamPunto = [...css.matchAll(/font-size:\s*([\d.]+)px/g)].map((m) => m[1]);
    expect(hamPunto).toEqual([]);                         // hepsi var(--f-*)
  });

  // ── ŞEMA ETİKETİ ──────────────────────────────────────────────────────
  // Ad koşulsuz çemberin ÜSTÜNE konuyordu; dairesel yerleşimde kasnakların
  // yarısında kayış tam oradan geçiyor. ÖLÇÜLDÜ: dört etiket kayış yolunun
  // üstündeydi. Aday sırası ÜST → ALT → SAĞ → SOL, ilk TEMİZ olan seçilir.
  test('şema kısa kod basar ve sarım açısını TEKRAR ETMEZ', () => {
    const s1 = SU._fsrSheet1(R, NODE);
    const svg = s1.slice(s1.indexOf('<svg'), s1.indexOf('</svg>'));
    SU._fsrCodes(R.build.sys).forEach((k) => expect(svg).toContain('>' + k + '</text>'));
    // Sarım açıları sayfa 2'de hizalı bir tabloda; şemada ikinci kez yok.
    expect(svg).not.toMatch(/>\d+\.\d+°</);
    R.build.sys.pulleys.forEach((p) => expect(svg).not.toContain('>' + p.name + '</text>'));
  });

  // ── EKSEN BÖLMESİ ─────────────────────────────────────────────────────
  // Eşit bölme ham veri ucundan türüyordu: 0…60,4 aralığı
  // "0 · 12,1 · 24,2 · 36,2 · 48,3 · 60,4" veriyordu — 36,2 bir bölme değil,
  // 12,08'lik adımın yuvarlama artığı.
  test('eksen bölmeleri okunur sayılara oturur', () => {
    [[0, 60.4, 6], [0, 1170, 5], [880, 2750, 6], [0, 0.9, 5]].forEach(([a, b, n]) => {
      const ax = RP._frNiceAxis(a, b, n);
      expect(ax.min).toBeLessThanOrEqual(a);              // aralık DIŞA yuvarlanır
      expect(ax.max).toBeGreaterThanOrEqual(b);
      expect(ax.ticks.length).toBeGreaterThanOrEqual(4);
      // her bölme adımın tam katı — kayan nokta artığı basılmıyor
      ax.ticks.forEach((t) => {
        const k = t / ax.step;
        expect(Math.abs(k - Math.round(k))).toBeLessThan(1e-6);
      });
      // adım 1/2/2,5/5 × 10ⁿ kümesinden
      const us = Math.pow(10, Math.floor(Math.log10(ax.step)));
      expect([1, 2, 2.5, 5]).toContainEqual(Number((ax.step / us).toFixed(6)));
    });
  });

  // Yukarıdaki kapı yalnız _frNiceAxis'i ölçüyor; GRAFİĞİN onu kullandığını
  // ölçmüyordu — `nice` kapatıldığında yeşil kalıyordu (mutasyonla ölçüldü).
  // Bu kapı basılan bölme ETİKETLERİNE bakıyor: aralarındaki fark sabit ve
  // adım okunur bir sayı olmalı.
  test('grafiğin BASTIĞI bölmeler okunur sayılar', () => {
    const s3 = SU._fsrSheet3(R, NODE);
    // Sayfada İKİ grafik var (gerginlik + take-up); kapı ilkini ölçüyor.
    const i0 = s3.indexOf('<div class="fig">');
    const svg = s3.slice(i0, s3.indexOf('</svg>', i0));
    // y ekseni etiketleri: text-anchor="end" olanlar
    const yEt = [...svg.matchAll(/text-anchor="end"[^>]*>([^<]+)<\/text>/g)]
      .map((m) => Number(m[1].replace(/\s/g, '').replace('−', '-').replace(',', '.')))
      .filter(Number.isFinite);
    expect(yEt.length).toBeGreaterThanOrEqual(4);
    const adim = [];
    for (let i = 1; i < yEt.length; i++) adim.push(Math.abs(yEt[i] - yEt[i - 1]));
    adim.forEach((a) => expect(Math.abs(a - adim[0])).toBeLessThan(1e-6));  // eşit aralık
    const us = Math.pow(10, Math.floor(Math.log10(adim[0])));
    expect([1, 2, 2.5, 5]).toContainEqual(Number((adim[0] / us).toFixed(6)));
  });

  // ── VURGU HÜKÜMLE ÇELİŞEMEZ ───────────────────────────────────────────
  // İlk sürüm SF < servis faktörü olan HER hücreyi kırmızı basıyordu; bu,
  // gerginlik oranı 1,00 olan üç sütunun (avara ×2 + gergi) 36 hücresini
  // birden kırmızıya boyuyordu. Ama sayfanın kendi hükmü "yük taşımayanlarda
  // o sayı bir marj değil KAPASİTEDİR" diyor — vurgu metnin tersini bağırdı.
  test('kırmızı yalnız hükmü VEREBİLEN kasnakta', () => {
    const s5 = SU._fsrSheet5(R, NODE);
    const blok = s5.slice(s5.indexOf('Kayma Emniyet Faktörü'), s5.indexOf('Kaburga Yorulma'));
    expect(blok).toContain('yük taşımaz');
    expect(blok).toContain('class="pas"');
    const st = RP._frSlipStats(R);
    expect(st.idle.length).toBeGreaterThan(0);            // AG00976'da üç tane
    // KAPININ ISIRDIĞI YER: yük taşımayanların en az biri servis faktörünün
    // ALTINDA (gergi: 1,23 < 1,30). Eski kural onu kırmızı basıyordu — yani
    // hükmü veremeyecek bir sayı belgeye "başarısız" diye giriyordu.
    expect(st.idle.some((x) => x.SF < R.serviceFact)).toBe(true);
    const kirmizi = (blok.match(/class="bad"/g) || []).length;
    expect(kirmizi).toBe(0);                              // yük taşıyanların hepsi geçiyor
    expect(blok).toMatch(/kapasitesidir/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// GATES'İN BEŞ ŞEKLİ — ortak çizicilerin kapıları.
// Bu beş kusurun ortak imzası: belge yine üretiliyor, hata çıkmıyor, yalnız
// şekil yanlış duruyor ya da yanlış şeyi söylüyor. Beşi de önce mutasyonla
// ölçüldü (kapısızken beşi de SAĞ KALIYORDU).
describe('şekiller — ortak çizici kapıları', () => {
  const svgOl = (s) => {
    const vb = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(s);
    return vb ? { W: Number(vb[1]), H: Number(vb[2]) } : null;
  };

  // ── Doğal frekans haritası ─────────────────────────────────────────────
  // Gösterge çizim alanının İÇİNDEYDİ: yedi girdi, en genişi 262 px, çizim
  // alanının %42'si — altı eğrinin dördünü kesiyordu.
  test('frekans göstergesi çizim alanının DIŞINDA', () => {
    const svg = RP.veFeadFigureRaw(RP._frFreqFigure, R, 780, 190);
    expect(svg).toContain('data-ve="span-freq"');
    const o = svgOl(svg);
    // düşey ızgara çizgileri = çizim alanının sağ sınırı
    const grid = [...svg.matchAll(/<line x1="([\d.]+)"[^>]*stroke="#e4e6e9"/g)].map((m) => Number(m[1]));
    expect(grid.length).toBeGreaterThan(2);
    const cizimSag = Math.max(...grid);
    const gost = [...svg.matchAll(/<text x="([\d.]+)"[^>]*font-size="9\.5"/g)].map((m) => Number(m[1]));
    expect(gost.length).toBeGreaterThanOrEqual(4);          // 6 açıklık + ateşleme
    expect(Math.min(...gost)).toBeGreaterThan(cizimSag);
    // ve göstergenin en uzun satırı viewBox'ı AŞMIYOR
    const met = [...svg.matchAll(/<text x="([\d.]+)"[^>]*font-size="9\.5"[^>]*>([^<]+)</g)];
    met.forEach(([, x, t]) => expect(Number(x) + t.length * 9.5 * 0.6).toBeLessThanOrEqual(o.W + 1));
  });

  // Boy istenen ölçüyü DİNLEMELİ: sabit H:300 yazmak _FR_H'yi sessizce
  // yutuyordu ve özet raporda sayfa taşıyordu.
  test('frekans haritası istenen boyu kullanıyor', () => {
    expect(svgOl(RP.veFeadFigureRaw(RP._frFreqFigure, R, 780, 190)).H).toBe(190);
    expect(svgOl(RP.veFeadFigureRaw(RP._frFreqFigure, R, 780, 300)).H).toBe(300);
  });

  // ── Kayma emniyeti çubuk grafiği ───────────────────────────────────────
  // Sağ pay 30 px'te SABİTTİ: "14,95" gibi bir etiket viewBox'ı 10 px aşıp
  // kırpılıyordu (ölçüldü, özet rapor sayfa 5).
  test('kayma grafiğinde değer etiketi viewBox içinde', () => {
    const svg = RP.veFeadFigureRaw(RP._frSlipFigure, R, 780, 215, R.serviceFact);
    const o = svgOl(svg);
    const et = [...svg.matchAll(/<text x="([\d.]+)"[^>]*font-size="11\.5"[^>]*>([^<]+)</g)];
    expect(et.length).toBeGreaterThanOrEqual(4);
    et.forEach(([, x, t]) => expect(Number(x) + t.length * 11.5 * 0.6).toBeLessThanOrEqual(o.W));
  });

  // VURGU HÜKÜMLE ÇELİŞEMEZ — matriste kapatılan çelişkinin GRAFİK tarafı.
  // Gerginlik oranı ~1,00 olan kasnakta SF bir marj değil KAPASİTEDİR;
  // kırmızı basmak "başarısız" demek olur ve sayfanın kendi hükmüyle çelişir.
  test('kayma grafiğinde kırmızı yalnız yük TAŞIYAN kasnakta', () => {
    const svg = RP.veFeadFigureRaw(RP._frSlipFigure, R, 780, 215, R.serviceFact);
    const st = RP._frSlipStats(R);
    expect(st.idle.length).toBeGreaterThan(0);
    expect(st.idle.some((x) => x.SF < R.serviceFact)).toBe(true);   // kapı ısırıyor
    const cubuk = [...svg.matchAll(/data-ve="sf-bar"[^>]*fill="(#[0-9a-f]{6})"/g)].map((m) => m[1]);
    expect(cubuk.length).toBe(R.build.sys.pulleys.length);
    // yük taşımayan sayısı kadar SOLUK çubuk, ve hiç kırmızı YOK
    expect(cubuk.filter((c) => c === '#9aa3ad').length).toBe(st.idle.length);
    expect(cubuk.filter((c) => c === '#a8321f').length).toBe(0);
  });

  // ── Kod üreticisi köprüde ve çıpalı ────────────────────────────────────
  test('kod üreticisi köprü katmanında ve rol kısayolları duruyor', () => {
    expect(typeof M.veFeadPulleyCodes).toBe('function');
    const kod = M.veFeadPulleyCodes(R.build.sys);
    R.build.sys.pulleys.forEach((p, i) => {
      if (p.tensioner) expect(kod[i]).toBe('TEN');
    });
    // parantez içi kısa harf dizisi bir KODDUR, parça numarası değil
    expect(M.veFeadPulleyCodes({ pulleys: [{ name: 'Sürücü Kasnak (FAN)' }] })[0]).toBe('FAN');
    expect(M.veFeadPulleyCodes({ pulleys: [{ name: 'Otomatik Gergi (E9843)', tensioner: 1 }] })[0]).toBe('TEN');
    // ve özet rapor ONU kullanıyor (ikinci kopya yok)
    expect(SU._fsrCodes(R.build.sys)).toEqual(kod);
  });
});
