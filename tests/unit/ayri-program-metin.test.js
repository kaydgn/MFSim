/**
 * ayri-program-metin.test.js — ARAYÜZ ANLATMAZ, ayrı iki program (aşama 15)
 * ───────────────────────────────────────────────────────────────────────
 * Ölçüm Görüntüleyici (`viewer/`) ve CAN Çözümleyici (`candbc/`). Cırcır
 * (`tools/metin-dili.js`) sözlüğün işaretlediğini tutar; bu dosya sözlüğün
 * görmediği sınıfları:
 *   · üst bantta açıklama cümlesi ("Excel / CSV ölçüm dosyalarını okur ve
 *     diyagrama döker", "Dosyayı buraya sürükleyip bırakabilirsiniz · …")
 *   · sözcüğe yapışık büyük harf vurgusu ("Bu sinyal mesajın ÇOKLAYICISIdır")
 *     ve başa konan vurgu sözcüğü ("HAYIR — damgalar geriye atlıyor")
 *   · kendini anlatma ("Bu kayıtta hiç geçmiyor", "Bu kareler okundu ama …")
 *   · geliştirme dili ("Biçim yarışı", örnek veritabanında "bit duzeni kapisi")
 *   · tekrar: örnek bildirimi, künyenin zaten yazdığı "üretilmiş" bilgisini
 *     ikinci kez söylüyordu
 * Etkileşim ipucu kısayol penceresinin dilindedir ("Tekerlek: yakınlaştır").
 */
const fs = require('fs');
const path = require('path');
const MD = require('../../tools/metin-dili.js');

const ROOT = path.join(__dirname, '../..');
const oku = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const JS = ['candbc/js/can-app.js', 'candbc/js/can-tree.js', 'candbc/js/can-dbc.js',
  'candbc/js/can-log.js', 'candbc/js/can-chart.js', 'candbc/js/can-theme.js',
  'candbc/js/can-example.js', 'viewer/js/board.js', 'viewer/js/theme.js', 'viewer/js/app.js'];
const HTML = ['viewer/index.html', 'candbc/index.html'];
const DIZGE = [...JS, ...HTML].flatMap((f) => MD.metinler(f).map((m) => ({ f, ...m })));

test('taranan metin var (kapı boş girdiyle yeşil kalmasın)', () => {
  expect(DIZGE.length).toBeGreaterThan(250);
});

// Program, biçim ve standart adları — sözcüğe yapışık büyük harf değil, adın kendisi
const AD = /^(?:MFSim|CANalyzer|CANoe|SocketCAN|BusMaster|PCAN|IEEE|DBC|CSV|PNG|ASC|DLC|PGN)$/;

describe('sözlüğün görmediği sınıflar', () => {
  const bul = (re, suz) => DIZGE.filter((d) => (suz ? suz(d) : true))
    .flatMap((d) => [...d.metin.matchAll(re)].filter((m) => !AD.test(m[0].replace(/[^\p{L}]/gu, '')))
      .map(() => d.f + ':' + d.satir + ' ' + d.metin.slice(0, 90)));

  test('sözcüğe yapışık ya da başa konan büyük harf vurgusu yok', () => {
    // eski: "Bu sinyal mesajın ÇOKLAYICISIdır", "HAYIR — damgalar geriye atlıyor",
    // "Zaman damgaları artan sırada DEĞİL."
    expect(bul(/(?<![\p{L}#_])[A-ZÇĞİÖŞÜ]{3,}\p{Ll}+/gu)).toEqual([]);
    expect(bul(/^[A-ZÇĞİÖŞÜ]{4,} — /gu)).toEqual([]);
    expect(bul(/(?<![\p{L}#_])(?:DEĞİL|HAYIR|ASLA|DİKKAT)(?![\p{L}])/gu)).toEqual([]);
  });

  test('kendini anlatma yok: "Bu kayıtta / Bu mesaj / Bu kareler …"', () => {
    expect(bul(/(?<![\p{L}])Bu (?:kayıt|mesaj|sinyal|kare|dosya|DBC)\p{L}*/gu)).toEqual([]);
  });

  test('geliştirme dili yok: yarış, kapı (örnek veritabanı dahil)', () => {
    // eski: "Biçim yarışı (ilk 400 satır üzerinde)", 'CM_ … "… bit duzeni kapisi"'
    expect(bul(/(?<![\p{L}])(?:yarış\p{L}*|kapı\p{L}*|kapisi)(?![\p{L}])/giu)).toEqual([]);
  });

  test('kapı düşebiliyor: eski metinler yakalanır', () => {
    const eski = ['Bu sinyal mesajın ÇOKLAYICISIdır', 'HAYIR — damgalar geriye atlıyor',
      'Zaman damgaları artan sırada DEĞİL.', 'Bu kayıtta hiç geçmiyor',
      'Biçim yarışı (ilk 400 satır üzerinde)', 'Motorola (@0) duzenli, isaretli sinyal — bit duzeni kapisi'];
    const re = [/(?<![\p{L}#_])[A-ZÇĞİÖŞÜ]{3,}\p{Ll}+/u, /^[A-ZÇĞİÖŞÜ]{4,} — /u,
      /(?<![\p{L}#_])(?:DEĞİL|HAYIR|ASLA|DİKKAT)(?![\p{L}])/u, /(?<![\p{L}])Bu (?:kayıt|mesaj|sinyal|kare|dosya|DBC)\p{L}*/u,
      /(?<![\p{L}])(?:yarış\p{L}*|kapı\p{L}*|kapisi)(?![\p{L}])/iu];
    eski.forEach((m) => expect([m, re.some((r) => r.test(m))]).toEqual([m, true]));
    // ad ve biçim adları vurgu sayılmaz
    const yapisik = (m) => [...m.matchAll(/(?<![\p{L}#_])[A-ZÇĞİÖŞÜ]{3,}\p{Ll}+/gu)]
      .filter((x) => !AD.test(x[0].replace(/[^\p{L}]/gu, ''))).length;
    ['Vector ASC (CANalyzer/CANoe)', "Yüklü DBC'deki hiçbir mesaj kayıtta geçmiyor.", 'IEEE double',
     'candump (SocketCAN, ID#VERİ)'].forEach((m) => expect([m, yapisik(m)]).toEqual([m, 0]));
  });
});

describe('üst bant ad ve durum taşır, açıklama cümlesi taşımaz', () => {
  // Bantların metin düğümleri: yorum ve <style> düşer, etiketler ayraç olur.
  const bant = (f, id) => {
    const h = oku(f);
    const m = new RegExp('<header id="' + id + '">([\\s\\S]*?)</header>').exec(h);
    return (m ? m[1] : '').replace(/<!--[\s\S]*?-->/g, ' ').split(/<[^>]+>/)
      .map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
  };

  test.each([['viewer/index.html', 'mfv-topbar'], ['candbc/index.html', 'cdb-topbar']])('%s', (f, id) => {
    const metin = bant(f, id);
    expect(metin.length).toBeGreaterThan(2);
    // eski: "Excel / CSV ölçüm dosyalarını okur ve diyagrama döker" (7 sözcük),
    // "Dosyayı buraya sürükleyip bırakabilirsiniz · veri bilgisayarınızdan çıkmaz"
    expect(metin.filter((s) => MD.sozcukSay(s) >= 4)).toEqual([]);
  });

  test('görüntüleyicinin alt başlığı programın tanımlayıcı adıdır', () => {
    expect(oku('viewer/index.html')).toContain('<span class="mfv-sub">Ölçüm Görüntüleyici</span>');
  });
});

test('CAN boş diyagramının ipucu kısayol penceresinin dilinde ("Ad: eylem · …")', () => {
  const m = /<div class="ve-trace-empty-sub">([\s\S]*?)<\/div>/.exec(oku('candbc/index.html'));
  const ipucu = m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  const parca = ipucu.split(' · ');
  expect(parca.length).toBeGreaterThanOrEqual(4);
  parca.forEach((p) => expect(p).toMatch(/^[A-ZÇĞİÖŞÜ][^:]*: \p{Ll}/u));
  expect(ipucu).toContain('Tekerlek: yakınlaştır');
});

test('örnek bildirimi künyeyi tekrar etmez: "üretilmiş" bilgisi yüklü dosyanın adında', () => {
  const src = oku('candbc/js/can-app.js');
  const f = /function cdbLoadExample\(\) \{[\s\S]*?\n\}/.exec(src)[0];
  expect(f).toMatch(/cdbApplyDbc\(cdbParseDbc\(dbc\), '[^']*üretilmiş[^']*'\)/);
  const bildirim = [...f.matchAll(/cdbToast\('([^']*)'/g)].map((x) => x[1]);
  expect(bildirim).toEqual(['Örnek yüklendi.']);
});

test('görüntüleyicinin boş ölçüm penceresi tarif taşımaz (viewer/sync.js yerel farkı)', () => {
  // eski: "Bir Excel (.xlsx) ya da CSV ölçüm dosyası açın — sütunları seçin, her sinyal
  // kendi şeridinde çizilsin." Biçimler düğmenin ipucunda veri olarak durur.
  const src = oku('viewer/sync.js');      // betik çalıştırılmaz: require senkronu koşturur
  const blok = /ad: 'boş durum metni[\s\S]*?\n  \},/.exec(src)[0];
  expect(blok).not.toContain('ve-trace-empty-sub');
  expect(blok).toContain('Henüz ölçüm yok');
  expect(blok).toContain('title=\\"Excel · CSV\\"');
});
