/**
 * kullanim-masa.test.js — kullanım masası (tools/kullanim.js) ve karar tahtası
 * (tools/kullanim-tahta.*) — skill `kullanim`.
 *
 *   · bilinmeyen komut ve bayrak SESSİZCE yutulmaz (yanlış yüzeyin görüntüsü)
 *   · ekrandaki Türkçe sayı okunur: 1.716,25 → 1716,25 · −7 → −7
 *   · sayfanın ham ölçüleri adım özetine doğru çevrilir
 *   · tahta kanıtsız, kimliği tekrar eden, türü bilinmeyen bulguyu REDDEDER —
 *     karar `karar/<id>`'ye bağlı; yarım tahta kararı başka bulguya kaydırır
 *   · şablonun iki çapası var ve sayfa tek tema, açık (kullanıcı kararı)
 */
const fs = require('fs');
const path = require('path');
const M = require('../../tools/kullanim.js');
const T = require('../../tools/kullanim-tahta.js');

describe('masa: ayrıştırma', () => {
  test('bilinmeyen komut ve bayrak hata verir', () => {
    expect(() => M.ayristir(['basla'])).toThrow(/bilinmeyen komut/);
    expect(() => M.ayristir(['foto', '--secic', 'x'])).toThrow(/bilinmeyen bayrak --secic/);
    expect(() => M.ayristir(['baslat', '--ekran', 'genis'])).toThrow(/--ekran/);
    expect(() => M.ayristir(['adim', 'yalniz-ad'])).toThrow(/adim "<ad>"/);
  });

  test('ekran ön ayarı ve elle ölçü', () => {
    const o = M.ayristir(['baslat']);
    expect(o.ekranAyar).toMatchObject({ genislik: 1920, yukseklik: 945, dpr: 1 });
    expect(o.port).toBe(47321);
    const d = M.ayristir(['baslat', '--ekran', 'dizustu', '--yukseklik', '800']);
    expect(d.ekranAyar).toMatchObject({ genislik: 1536, yukseklik: 800, dpr: 1.25 });
    expect(d.ekranAyar.ad).toBe('1536×800 · %125');
    expect(() => M.ayristir(['baslat', '--dpr', '9'])).toThrow(/--dpr/);
  });

  test('adım ve büyüteç', () => {
    expect(M.ayristir(['adim', 'Hesapla', '-', '--secici', '.x'])).toMatchObject({ ad: 'Hesapla', kod: '-', secici: '.x', zaman: 60000 });
    expect(M.ayristir(['buyut', '--kutu', '1,2,30,40']).kutu).toEqual({ x: 1, y: 2, width: 30, height: 40 });
    expect(() => M.ayristir(['buyut'])).toThrow(/--kutu/);
    expect(() => M.ayristir(['buyut', '--kutu', '1,2,0,4'])).toThrow(/--kutu/);
  });
});

describe('masa: okuma ve özet', () => {
  test('Türkçe sayı', () => {
    expect(M.sayiOku('1.716,25 mm')).toBe(1716.25);
    expect(M.sayiOku('−7')).toBe(-7);
    expect(M.sayiOku('%97,0')).toBe(97);
    expect(M.sayiOku('(12,5; 34)')).toBe(12.5);
    expect(M.sayiOku('1.5')).toBe(1.5);
    expect(Number.isNaN(M.sayiOku('yok'))).toBe(true);
  });

  test('ham ölçü → özet', () => {
    const o = M.ozetle({
      uzun: [[0, 120], [500, 80.4]],
      olay: [[10, 240, 'click', 2, 200], [600, 40, 'keydown', 1, 30]],
      kare: { n: 30, sure: 500, enUzun: 120 },
      bellek: 64 * 1048576
    });
    expect(o.donma).toEqual({ adet: 2, enUzun: 120, toplam: 200 });
    expect(o.etkilesim.enYavas[0]).toEqual({ tur: 'click', sure: 240 });
    expect(o.etkilesim.yavas).toBe(1);
    expect(o.kare).toEqual({ adet: 30, fps: 60, enUzunAra: 120 });
    expect(o.bellekMB).toBe(64);
  });

  test('dosya adı ve kısaltma', () => {
    expect(M.kisaAd('Kayış boyunu 1.716 mm yap')).toBe('kayis-boyunu-1-716-mm-yap');
    expect(M.kisaAd('')).toBe('adim');
    expect(M.kisalt('x'.repeat(10), 4)).toBe('xxxx… (+6 karakter)');
  });
});

describe('tahta: doğrulama', () => {
  const gecerli = () => ({
    modul: 'FEAD', tarih: '02.11.2026', surum: '7c94ad5 · PR #1206', ekran: '1920×1080',
    bulgular: [{
      id: 'F01', baslik: 'b', tur: 'konfor', onem: 'orta', yuzey: 'Kayış Tablosu',
      gozlem: 'g', beklenti: 'e', gorseller: [{ yol: 'a.png', kirp: [0, 0, 10, 10], isaret: [[1, 1, 2, 2]] }]
    }]
  });
  const var_ = () => true;

  test('geçerli bulgu geçer', () => {
    expect(T.dogrula(gecerli(), var_)).toEqual([]);
  });

  test('kanıtsız bulgu reddedilir; ölçüm kanıt sayılır', () => {
    const v = gecerli();
    delete v.bulgular[0].gorseller;
    expect(T.dogrula(v, var_).join()).toMatch(/kanıt yok/);
    v.bulgular[0].olcum = '2,4 sn donma';
    expect(T.dogrula(v, var_)).toEqual([]);
  });

  test('tekrar eden kimlik, bilinmeyen tür ve önem, olmayan dosya', () => {
    const v = gecerli();
    v.bulgular.push(Object.assign({}, v.bulgular[0], { tur: 'hiz', onem: 'kritik' }));
    const h = T.dogrula(v, (y) => y !== 'a.png').join('\n');
    expect(h).toMatch(/kimlik tekrar ediyor/);
    expect(h).toMatch(/tür konfor \| kalite \| estetik \| dogruluk/);
    expect(h).toMatch(/önem yuksek \| orta \| dusuk/);
    expect(h).toMatch(/dosya yok: a\.png/);
  });

  test('SONRA: düzeltilen bulgu önce/sonra taşır — ölçümü şart, görselleri aynı kurala', () => {
    const v = gecerli();
    v.bulgular[0].sonra = { olcum: '2 → 0 çakışma', gorseller: [{ yol: 'b.png', kirp: [0, 0, 5, 5] }] };
    expect(T.dogrula(v, var_)).toEqual([]);
    v.bulgular[0].sonra = { gorseller: [{ yol: 'b.png', kirp: [0, 0, -1, 5] }] };
    const h = T.dogrula(v, var_).join('\n');
    expect(h).toMatch(/sonra\.olcum eksik/);
    expect(h).toMatch(/sonra görsel 1: kirp/);
    v.bulgular[0].sonra = 'düzeldi';
    expect(T.dogrula(v, var_).join()).toMatch(/sonra bir nesne olmalı/);
  });

  test('bozuk kırpma ve eksik üst alan', () => {
    const v = gecerli();
    v.bulgular[0].gorseller[0].kirp = [0, 0, -1, 4];
    delete v.surum;
    const h = T.dogrula(v, var_).join('\n');
    expect(h).toMatch(/kirp/);
    expect(h).toMatch(/üst alan eksik: surum/);
  });
});

describe('tahta: şablon', () => {
  const sablon = fs.readFileSync(path.join(__dirname, '../../tools/kullanim-tahta.html'), 'utf8');

  test('veri ve başlık çapaları', () => {
    expect(sablon).toContain('/*__VERI__*/null');
    expect(sablon.startsWith('<title>__BASLIK__</title>')).toBe(true);
  });

  test('tek tema, açık: koyu blok yok', () => {
    expect(sablon).not.toMatch(/prefers-color-scheme:\s*dark|data-theme="dark"/);
    expect(sablon).toMatch(/color-scheme:\s*light/);
  });

  test('karar yolu ve üç karar', () => {
    expect(sablon).toContain("db.doc('karar/' + id).set(");
    expect(sablon).toContain("collection('karar').onSnapshot(");
    expect(sablon).toMatch(/duzelt: 'Düzelt', kalsin: 'Kalsın', sonra: 'Sonra'/);
    // önce/sonra: "Sonra" bölümü ve büyüteci (data-s) aynı karttan
    expect(sablon).toContain('<section class="sonra"><h3>Sonra</h3>');
    expect(sablon).toContain("bb.hasAttribute('data-s')");
  });
});
