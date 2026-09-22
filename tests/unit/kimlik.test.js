/**
 * kimlik.test.js — BAŞ HARF TÜRETİMİ
 * ───────────────────────────────────
 * Avatarın arkasındaki ad UYDURULMADI, AÇILDI: kullanıcı bir kez yazar.
 * Türetilen tek şey baş harfler — ve orada Türkçe'ye özgü bir tuzak var.
 */
const { veKimlikBasHarf } = require('../../js/kimlik.js');

describe('baş harf türetimi', () => {
  test('iki parçalı ad → ilk + son', () => {
    expect(veKimlikBasHarf('Kerem Aydoğan')).toBe('KA');
    expect(veKimlikBasHarf('Ayşe Nur Öztürk')).toBe('AÖ');   // orta ad atlanır
  });

  test('tek parçalı ad → TEK harf', () => {
    // İki harf üretmek için soyadı uydurmak gerekirdi.
    expect(veKimlikBasHarf('ahmet')).toBe('A');
  });

  // TÜRKÇE BÜYÜTME: `'i'.toUpperCase()` → `'I'`, oysa Türkçe'de `'İ'`.
  // "İlker" → "I" YANLIŞ baş harftir ve hata sessizdir: avatar dolu görünür.
  test('büyütme TÜRKÇE — noktalı i korunuyor', () => {
    expect(veKimlikBasHarf('İlker Şahin')).toBe('İŞ');
    expect(veKimlikBasHarf('irem yılmaz')).toBe('İY');
    expect('ilker'.charAt(0).toUpperCase()).toBe('I');   // tuzağın kendisi
  });

  test('boş / tanımsız → BOŞ, sahte harf YOK', () => {
    ['', '   ', null, undefined].forEach((x) => expect(veKimlikBasHarf(x)).toBe(''));
  });

  test('fazla boşluk ve tek harfli parçalar', () => {
    expect(veKimlikBasHarf('  a   b  ')).toBe('AB');
  });
});
