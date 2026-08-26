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
    expect((DOC.match(/class="idblk"/g) || []).length).toBeGreaterThanOrEqual(5);
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
      const c = hucreler(s2.slice(s2.indexOf('Kayış Tahrik Sistemi Geometrisi')), ad, 3).map(say);
      expect(Math.abs(c[0] - G[i][0])).toBeLessThan(0.1);
      expect(Math.abs(c[1] - G[i][1])).toBeLessThan(0.1);
      expect(Math.abs(c[2] - G[i][2])).toBeLessThan(0.002);
    });
  });

  test('sayfa 3: gergi konum tablosu ve take-up oranı birebir', () => {
    const s3 = SU._fsrSheet3(R, NODE);
    expect(s3).toMatch(/0,708 mm\/°/);
    const kol = hucreler(s3, 'Kol konumu', 6).map(say);
    const reb = hucreler(s3, 'Gereken efektif kayış boyu', 6).map(say);
    [16.1, 11.4, 356.3, 348.0, 339.1, 315.7].forEach((g, i) =>
      expect(Math.abs(kol[i] - g)).toBeLessThan(0.2));
    [1733.8, 1730.9, 1720.6, 1714.6, 1708.6, 1699.1].forEach((g, i) =>
      expect(Math.abs(reb[i] - g)).toBeLessThan(0.1));
  });

  test('sayfa 5: 880 d/d ortalama gerginlik ve hubload birebir', () => {
    const s5 = SU._fsrSheet5(R, NODE);
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
  // Kullanıcı bildirimi: "Her yere bu şekli koymuşsun. Gerek yok."
  // Tedarikçi çıktısında yerleşim şeması 1, 2 ve 5. sayfalarda var; 3 ve 4'te
  // sayfayı tablo ve grafik dolduruyor.
  test('yerleşim şeması YALNIZ 1, 2 ve 5. sayfalarda', () => {
    const va = (h) => h.indexOf('class="appfig fig"') >= 0;
    expect(va(SU._fsrSheet1(R, NODE))).toBe(true);
    expect(va(SU._fsrSheet2(R, NODE))).toBe(true);
    expect(va(SU._fsrSheet3(R, NODE))).toBe(false);
    expect(va(SU._fsrSheet4(R, NODE))).toBe(false);
    expect(va(SU._fsrSheet5(R, NODE))).toBe(true);
  });

  // _frTakeupFigure bir BÖLÜM üreticisidir (başlık + paragraflar + iki şekil).
  // Özet rapora onu çağırmak §8.9'un gövdesini sürüklüyordu (ölçüldü).
  test('take-up sayfasına ayrıntılı raporun METNİ sızmıyor', () => {
    const s3 = SU._fsrSheet3(R, NODE);
    expect(s3).not.toMatch(/<h3>/);
    expect(s3).not.toMatch(/8\.9 Kayış take-up/);
    expect(s3).toMatch(/data-ve="takeup-curve"/);       // grafik yine burada
  });

  test('gergi kasnağının konumu türetilmiş olarak BASILIYOR', () => {
    const s2 = SU._fsrSheet2(R, NODE);
    const mean = R.analysis.positions.filter((p) => p.position === 'Mean')[0];
    // −161,97 / 91,29 — tedarikçi sayfasının kendi değerleri
    expect(Math.abs(mean.idlerX - (-161.97))).toBeLessThan(0.2);
    const ten = R.build.sys.pulleys.filter((p) => p.tensioner)[0];
    const tbl = s2.slice(s2.indexOf('Yerleşim Verisi'));
    const hucre = hucreler(tbl, ten.name, 2).map(say);   // yardımcı etiketi zaten atlar
    expect(Math.abs(hucre[0] - mean.idlerX)).toBeLessThan(0.1);
    expect(Math.abs(hucre[1] - mean.idlerY)).toBeLessThan(0.1);
    expect(s2).toMatch(/bir girdi değildir/);
  });

  test('sayfa 1 tedarikçi sayfasının bloklarını taşıyor', () => {
    const s1 = SU._fsrSheet1(R, NODE);
    ['Kayış Verisi', 'Gergi Verisi', 'Kayış Gerginlik Kontrolü', 'Doğal Frekans Haritası',
     'Kayış Ömrü B10', 'Tepe Gerginlik ve Hubload'].forEach((b) => expect(s1).toContain(b));
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
