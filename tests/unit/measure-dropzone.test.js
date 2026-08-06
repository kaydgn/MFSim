/**
 * Ölçüm dosyası sürükle-bırak süzgeci (js/measure-dropzone.js)
 *
 * MFSim ve Ölçüm Görüntüleyici (CACIK) bu modülü ORTAK kullanıyor.
 * Olay/DOM tarafı uçtan uca sınanıyor (tests/e2e/viewer.spec.js);
 * burada tek bir SAF karar test ediliyor: bırakılan dosyalardan hangisi açılır.
 *
 * Neden bu karar test edilmeye değer: js/measure-import-ui.js bir dosyada ZIP
 * imzası görmezse onu METİN kabul edip CSV olarak çözüyor. Uzantı süzgeci
 * olmasa bırakılan bir .png ikili çöpten "sütunlar" üretirdi — patlamaz,
 * kullanıcı makul görünen ama tamamen anlamsız bir tabloya bakardı. Sessiz
 * yanlış çıktı, açık bir retten çok daha kötü.
 */

const stubs = stubGlobals();
eval(loadSource('measure-dropzone.js'));

// Fonksiyon dosyanın yalnızca .name alanını okuyor; gerçek File nesnesi
// kurmak testi File/Blob ayrıntılarına bağlardı, karşılığı yok.
const f = (name) => ({ name });

beforeEach(() => resetStubs(stubs));

describe('veImpAcceptDropped', () => {
  test('desteklenen uzantıları kabul eder', () => {
    ['o.xlsx', 'o.xlsm', 'o.csv', 'o.tsv', 'o.txt'].forEach((n) => {
      expect(veImpAcceptDropped([f(n)])).toEqual(f(n));
    });
  });

  test('uzantı büyük harfli olsa da kabul eder', () => {
    // Windows'tan gelen dosyalarda sık: "OLCUM.XLSX"
    expect(veImpAcceptDropped([f('OLCUM.XLSX')])).toEqual(f('OLCUM.XLSX'));
  });

  test('desteklenmeyen dosyayı REDDEDER ve sebebini söyler', () => {
    expect(veImpAcceptDropped([f('resim.png')])).toBeNull();
    expect(stubs.showToast).toHaveBeenCalledTimes(1);
    // Ret sessiz olamaz: kullanıcı hangi dosyanın neden açılmadığını görmeli.
    expect(stubs.showToast.mock.calls[0][0]).toContain('resim.png');
    expect(stubs.showToast.mock.calls[0][0]).toContain('.xlsx');
  });

  test('uzantısız dosyayı reddeder', () => {
    // Klasör bırakıldığında da bu yoldan geçilir.
    expect(veImpAcceptDropped([f('Belgeler')])).toBeNull();
  });

  test('adın içinde geçen uzantıya kanmaz — SONA bakar', () => {
    // "rapor.xlsx.exe" saldırgan bir ad değil ama kazara da oluşabiliyor;
    // gevşek bir arama (indexOf) bunu kabul ederdi.
    expect(veImpAcceptDropped([f('rapor.xlsx.exe')])).toBeNull();
    expect(veImpAcceptDropped([f('rapor.csv.zip')])).toBeNull();
  });

  test('boş bırakmada sessiz kalır', () => {
    expect(veImpAcceptDropped([])).toBeNull();
    expect(veImpAcceptDropped(null)).toBeNull();
    expect(stubs.showToast).not.toHaveBeenCalled();
  });

  test('birden çok dosyada İLK GEÇERLİYİ açar ve durumu bildirir', () => {
    const picked = veImpAcceptDropped([f('a.xlsx'), f('b.csv')]);
    expect(picked).toEqual(f('a.xlsx'));
    // Sessizce tek dosya açmak "diğerleri de yüklendi" sanısına yol açardı.
    expect(stubs.showToast).toHaveBeenCalledTimes(1);
    expect(stubs.showToast.mock.calls[0][0]).toContain('a.xlsx');
  });

  test('karışık bırakmada geçersizleri atlar, geçerliyi bulur', () => {
    expect(veImpAcceptDropped([f('resim.png'), f('olcum.csv')])).toEqual(f('olcum.csv'));
  });

  test('hiçbiri geçerli değilse İLK dosyanın adıyla açıklar', () => {
    // "Bir şeyler yanlış" demek yetmez; kullanıcı hangi dosyayı bıraktığını
    // ekranda görmeli.
    expect(veImpAcceptDropped([f('a.png'), f('b.gif')])).toBeNull();
    expect(stubs.showToast.mock.calls[0][0]).toContain('a.png');
  });
});
