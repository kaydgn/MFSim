/**
 * ayri-program-yon.test.js — YÖNLENDİRME, Ölçüm Görüntüleyici ve CAN (E5, 2026-10-19)
 * ───────────────────────────────────────────────────────────────────────
 * Biçimi metin-dili.test.js ölçüyor (yön profili; CAN'da `cdbYon`, statik
 * HTML'de `data-ve-yon`). Burada: YÖNLENDİRMEDEKİ AD EKRANDA VAR — cümle
 * olmayan bir denetime göndermesin. Ad değişirse cümle eskir; kapı ikisini
 * birlikte tutar. Görüntüleyici yuvayı `viewer/js/yon.js`'ten alır (js/yon.js
 * kopyası, senkron kapısı viewer-sync.test.js) ve onu panodan ÖNCE yükler.
 */
const fs = require('fs');
const path = require('path');
const T = require('../../tools/metin-dili.js');

const KOK = path.join(__dirname, '../..');
const oku = (f) => fs.readFileSync(path.join(KOK, f), 'utf8');
const yonlar = (f) => T.metinler(f).filter((x) => x.baglam === 'yon').map((x) => x.metin);

describe('Ölçüm Görüntüleyici', () => {
  test('boş veri tablosu Veri Gezgini’ni gösteriyor; o ad ekranda', () => {
    expect(yonlar('viewer/js/board.js')).toContain('Veri Gezgini’nden sinyal seçin.');
    expect(oku('viewer/index.html')).toMatch(/<span class="mf-ico mf-ico-bar-chart"><\/span> Veri Gezgini<\/span>/);
  });
  test('yuva panodan önce yükleniyor', () => {
    const h = oku('viewer/index.html');
    const a = h.indexOf('js/yon.js'), b = h.indexOf('js/board.js');
    expect(a).toBeGreaterThan(-1);
    expect(b).toBeGreaterThan(a);
  });
});

describe('CAN Çözümleyici — Sinyal Gezgini’nin durumu', () => {
  // Varsayılan süzgeç "Kayıtta": kayıt yokken her mesaj elenir. Eskiden ağaç
  // o hâlde "Yüklü DBC'deki hiçbir mesaj kayıtta geçmiyor." diyordu — kayıt
  // hiç yokken bir uyuşmazlık söylüyordu; boş diyagram da kullanıcıyı bu ağaca
  // gönderiyor.
  eval(loadCanSource('can-dbc.js'));
  eval(loadCanSource('can-decode.js'));
  eval(loadCanSource('can-example.js'));
  var cdbState = { db: null, store: null };
  var cdbYon = (m) => m;                       // can-app.js'teki yuva: metni değiştirmez
  var cdbChartHasSignal = () => false;
  var cdbSigColor = () => '';
  eval(loadCanSource('can-tree.js'));
  const agac = () => document.getElementById('cdb-tree');
  const bos = () => { const e = agac().querySelector('.vsig-empty'); return e ? e.textContent : null; };
  beforeEach(() => {
    document.body.innerHTML = '<div id="cdb-tree"></div><span id="cdb-tree-count"></span>';
    cdbState.db = null; cdbState.store = null;
    cdbTree.filter = 'log'; cdbTree.query = '';
  });

  test('DBC yok: DBC düğmesine gönderir', () => {
    cdbRefreshTree();
    expect(bos()).toBe('DBC yüklenmedi. DBC ile .dbc dosyası açın.');
  });
  test('DBC var, kayıt yok, süzgeç Kayıtta: kayıt yok der ve Kayıt düğmesine gönderir', () => {
    cdbState.db = cdbParseDbc(CDB_EXAMPLE_DBC);
    cdbRefreshTree();
    expect(bos()).toBe('CAN kaydı yüklenmedi. Kayıt ile dosya açın.');
    cdbTree.query = 'Motor';                    // arama da kayıtsız hâli örtmez
    cdbRefreshTree();
    expect(bos()).toBe('CAN kaydı yüklenmedi. Kayıt ile dosya açın.');
  });
  test('DBC var, kayıt yok, süzgeç Tümü: DBC’nin mesajları listelenir', () => {
    cdbState.db = cdbParseDbc(CDB_EXAMPLE_DBC);
    cdbTree.filter = 'all';
    cdbRefreshTree();
    expect(bos()).toBeNull();
    expect(agac().querySelectorAll('.vsig-group').length).toBe(cdbState.db.messages.length);
  });
  test('kayıt var ama DBC’nin hiçbir mesajı kayıtta yok: uyuşmazlık, yönlendirmesiz', () => {
    cdbState.db = cdbParseDbc(CDB_EXAMPLE_DBC);
    const yabanci = cdbMsgKey(0x7ff, false);
    expect(cdbState.db.byKey[yabanci]).toBeUndefined();
    cdbState.store = { n: 3, counts: { [yabanci]: 3 } };
    cdbRefreshTree();
    expect(bos()).toBe('Yüklü DBC\'deki hiçbir mesaj kayıtta geçmiyor.');
  });
});

describe('CAN Çözümleyici — sıfır kare', () => {
  // Biçim elle yanlış seçilince kayıt sıfır kareyle açılır. İki bildirim AYNI
  // kutuya art arda yazılır: biçimi ve çözülemeyen satır sayısını söyleyen ilki
  // hiç görünmez, ekranda kalan sonuncusudur. Biçim algılaması ve çözülemeyen
  // satırların örnekleri Tanı sekmesinde.
  eval(loadCanSource('can-app.js'));
  var cdbChartFitAll = () => {};
  var cdbChartLayout = () => {};
  var cdbRefreshTree = () => {};
  var cdbRenderTab = () => {};
  var cdbThousands = (n) => String(n);
  beforeEach(() => { jest.useFakeTimers(); document.body.innerHTML = '<div id="cdb-toast"></div>'; });
  afterEach(() => { jest.useRealTimers(); });

  test('ekranda kalan bildirim Tanı sekmesine gönderir', () => {
    cdbApplyStore({ n: 0, counts: {}, skipped: 3080, timeMonotonic: true, formatName: 'candump -L' }, 'ornek.log', null);
    expect(document.getElementById('cdb-toast').textContent).toBe('Dosyada çözülen CAN karesi yok. Tanı sekmesini açın.');
  });
  test('kare varsa okunan sayı ve biçim görünür, yönlendirme yok', () => {
    cdbApplyStore({ n: 12, counts: {}, skipped: 0, timeMonotonic: true, formatName: 'candump' }, 'ornek.log', null);
    expect(document.getElementById('cdb-toast').textContent).toBe('12 kare okundu (candump).');
  });
});

describe('CAN Çözümleyici', () => {
  const html = oku('candbc/index.html');
  test('boş diyagram: tek yönlendirme, etkileşim satırı kalır', () => {
    expect(yonlar('candbc/index.html')).toContain('Sinyal Gezgini’nden bir sinyal işaretleyin.');
    expect(html).toMatch(/Tekerlek: yakınlaştır · Sürükle: kaydır/);
    expect(html).toMatch(/<span class="mf-ico mf-ico-git-branch"><\/span> Sinyal Gezgini/);
  });
  test('DBC, Kayıt ve Tanı: yönlendirmedeki adlar araç çubuğunda ve sekmede', () => {
    expect(yonlar('candbc/js/can-tree.js')).toContain('DBC ile .dbc dosyası açın.');
    expect(yonlar('candbc/js/can-app.js')).toEqual(expect.arrayContaining(
      ['Kayıt ile dosya açın.', 'Tanı sekmesini açın.', 'Sinyal Gezgini’nden sinyal işaretleyin.']));
    expect(html).toMatch(/onclick="cdbPickDbc\(\)"[^>]*>\s*<span class="mf-ico mf-ico-file-text"><\/span> DBC\s*</);
    expect(html).toMatch(/onclick="cdbPickLog\(\)"[^>]*>\s*<span class="mf-ico mf-ico-upload"><\/span> Kayıt\s*</);
    expect(html).toMatch(/data-tab="diag"[^>]*>Tanı</);
  });
});
