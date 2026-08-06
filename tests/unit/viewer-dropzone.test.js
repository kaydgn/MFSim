/**
 * CACIK — sürükle-bırak dosya süzgeci (viewer/js/dropzone.js)
 *
 * Sürükle-bırakın olay/DOM tarafı uçtan uca sınanıyor (tests/e2e/viewer.spec.js);
 * burada tek bir SAF karar test ediliyor: bırakılan dosyalardan hangisi açılır.
 *
 * Neden bu karar test edilmeye değer: js/measure-import-ui.js bir dosyada ZIP
 * imzası görmezse onu METİN kabul edip CSV olarak çözüyor. Uzantı süzgeci
 * olmasa bırakılan bir .png ikili çöpten "sütunlar" üretirdi — patlamaz,
 * kullanıcı makul görünen ama tamamen anlamsız bir tabloya bakardı. Sessiz
 * yanlış çıktı, açık bir retten çok daha kötü.
 */

const stubs = stubGlobals();
eval(loadViewerSource('dropzone.js'));

// Fonksiyon dosyanın yalnızca .name alanını okuyor; gerçek File nesnesi
// kurmak testi File/Blob ayrıntılarına bağlardı, karşılığı yok.
const f = (name) => ({ name });

beforeEach(() => resetStubs(stubs));

describe('mfvAcceptDropped', () => {
  test('desteklenen uzantıları kabul eder', () => {
    ['o.xlsx', 'o.xlsm', 'o.csv', 'o.tsv', 'o.txt'].forEach((n) => {
      expect(mfvAcceptDropped([f(n)])).toEqual(f(n));
    });
  });

  test('uzantı büyük harfli olsa da kabul eder', () => {
    // Windows'tan gelen dosyalarda sık: "OLCUM.XLSX"
    expect(mfvAcceptDropped([f('OLCUM.XLSX')])).toEqual(f('OLCUM.XLSX'));
  });

  test('desteklenmeyen dosyayı REDDEDER ve sebebini söyler', () => {
    expect(mfvAcceptDropped([f('resim.png')])).toBeNull();
    expect(stubs.showToast).toHaveBeenCalledTimes(1);
    // Ret sessiz olamaz: kullanıcı hangi dosyanın neden açılmadığını görmeli.
    expect(stubs.showToast.mock.calls[0][0]).toContain('resim.png');
    expect(stubs.showToast.mock.calls[0][0]).toContain('.xlsx');
  });

  test('uzantısız dosyayı reddeder', () => {
    // Klasör bırakıldığında da bu yoldan geçilir.
    expect(mfvAcceptDropped([f('Belgeler')])).toBeNull();
  });

  test('adın içinde geçen uzantıya kanmaz — SONA bakar', () => {
    // "rapor.xlsx.exe" saldırgan bir ad değil ama kazara da oluşabiliyor;
    // gevşek bir arama (indexOf) bunu kabul ederdi.
    expect(mfvAcceptDropped([f('rapor.xlsx.exe')])).toBeNull();
    expect(mfvAcceptDropped([f('rapor.csv.zip')])).toBeNull();
  });

  test('boş bırakmada sessiz kalır', () => {
    expect(mfvAcceptDropped([])).toBeNull();
    expect(mfvAcceptDropped(null)).toBeNull();
    expect(stubs.showToast).not.toHaveBeenCalled();
  });

  test('birden çok dosyada İLK GEÇERLİYİ açar ve durumu bildirir', () => {
    const picked = mfvAcceptDropped([f('a.xlsx'), f('b.csv')]);
    expect(picked).toEqual(f('a.xlsx'));
    // Sessizce tek dosya açmak "diğerleri de yüklendi" sanısına yol açardı.
    expect(stubs.showToast).toHaveBeenCalledTimes(1);
    expect(stubs.showToast.mock.calls[0][0]).toContain('a.xlsx');
  });

  test('karışık bırakmada geçersizleri atlar, geçerliyi bulur', () => {
    expect(mfvAcceptDropped([f('resim.png'), f('olcum.csv')])).toEqual(f('olcum.csv'));
  });

  test('hiçbiri geçerli değilse İLK dosyanın adıyla açıklar', () => {
    // "Bir şeyler yanlış" demek yetmez; kullanıcı hangi dosyayı bıraktığını
    // ekranda görmeli.
    expect(mfvAcceptDropped([f('a.png'), f('b.gif')])).toBeNull();
    expect(stubs.showToast.mock.calls[0][0]).toContain('a.png');
  });
});
