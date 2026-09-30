/**
 * sayi-olcu.test.js — Türkçe sayı ÖLÇÜTÜNÜN kendisi (tests/helpers/sayi-olcu.js)
 *
 * Pencere ve belge taramaları bu ölçütle "0 bulgu" der; ölçüt kör olursa iki
 * tarama da sessizce yeşil kalır. Burada her kuralın gerçekten düştüğü ve
 * adları affettiği sentetik örneklerle tutuluyor.
 */
const O = require('../helpers/sayi-olcu.js');

describe('yazım taraması', () => {
  test('dört yanlış yazım yakalanır, Türkçe yazım geçer', () => {
    const turler = (t) => O.tara(t).sorun.map((s) => s.tur + ' ' + s.sayi);
    expect(turler('Cd 0.750 · 252.2 kW')).toEqual(['nokta 0.750', 'nokta 252.2']);
    expect(turler('1100 Nm @ 1400 rpm')).toEqual(['grupsuz 1100', 'grupsuz 1400']);
    expect(turler('GVW : 13 150 kg')).toEqual(['boşluklu 13 150']);
    expect(turler('Verim : 97,0% · eşik 5 %')).toEqual(['sonda % 97,0%', 'sonda % 5 %']);
    expect(turler('Cd 0,750 · 1.100 Nm @ 1.400 rpm · %97,0 · 13.150 kg')).toEqual([]);
  });
  test('üç haneli kesir sayılmaz — Türkçe binlikten ayırt edilemez', () => {
    expect(O.tara('1.090 · 2.800').sorun).toEqual([]);
  });
  test.each([
    ['Şanzıman: Allison 3200 SP', 'şanzıman modeli'],
    ['Takoz: Cone 38 60Sh (AMC 137963)', 'parça / katalog no'],
    ['Efektif boy ISO 9981 boyudur', 'standart / kayış adı'],
    ['P_motor = T_net*omega/1000 kW', 'formül sabiti'],
    ['© 2026 BMC Otomotiv', 'telif yılı'],
    ['ayrıntısı §8.18 bölümünde', 'bölüm no'],
    ['yay dengesinden (4.4) zaten belirlidir', 'denklem / bölüm no'],
    ['etkin sarım (5.7a) kadar kısalır', 'denklem / bölüm no'],
    ['kayıp ℓ = 7 mm (5.7a, yalnız kaburgalı temas)', 'denklem / bölüm no'],
    ['ayrıntısı Bölüm 9.2 içinde', 'denklem / bölüm no'],
    ['9.1 Dinamik rijitlik', 'bölüm başlığı'],
    ['bkz. 9.1 Dinamik rijitlik bölümü', 'denklem / bölüm no'],
    ['— Kong 2016, Beikmann 1996 verisi', 'kaynak yılı'],
    ['EA (Čepon 2011 · Michon 2006 · Shangguan 2013)', 'kaynak yılı'],
    ['Arch. Automot. Eng. 55(2), 2019, Tab. 3', 'kaynak yılı'],
    ['TARİH 27 Eylül 2026', 'tarih'],
    ['Q = 9549 · P ⁄ n', 'formül sabiti'],
  ])('ad olan sayı affedilir: %s → %s', (metin, sinif) => {
    const r = O.tara(metin);
    expect(r.sorun).toEqual([]);
    expect(Object.keys(r.adlar)).toEqual([sinif]);
  });
  test('satır başındaki bölüm başlığı ad sayılır, satır içindeki aynı biçim sayılmaz', () => {
    expect(O.tara('önceki paragraf.\n8.10 Mod şekilleri\nmetin').sorun).toEqual([]);
    expect(O.tara('önceki paragraf. 8.10 Mod şekilleri').sorun.map((x) => x.sayi)).toEqual(['8.10']);
    expect(O.tara('yıl 2016 değil: 2016 rpm').sorun.map((x) => x.sayi)).toEqual(['2016', '2016']);
  });
  test('alt denklem eki yalnız NUMARAYI affeder: bitişik birimli ve birimli ondalık yakalanır', () => {
    expect(O.tara('süre (0.5s) · boy (2.5m, ölçü)').sorun.map((x) => x.sayi)).toEqual(['0.5', '2.5']);
    expect(O.tara('boşluk (5.7 mm) kaldı').sorun.map((x) => x.sayi)).toEqual(['5.7']);
  });
  test('bölüm başlığı kalıbı birimi affetmez: "2.5 Nm" yine noktalı ondalık', () => {
    expect(O.tara('tork 2.5 Nm').sorun.map((x) => x.sayi)).toEqual(['2.5']);
  });
  test('ad yalnız KENDİ çevresinde aranır — satırın uzağındaki ad affetmez', () => {
    expect(O.tara('Allison 3200 SP şanzımanı · çıkış devri 2800 rpm').sorun.map((s) => s.sayi)).toEqual(['2800']);
  });
});

describe('TXT hizası', () => {
  test('kutu: sağ çizgisi kayan satır yakalanır', () => {
    expect(O.kutuIhlal('┌────┐\n│ ab │\n│ ab │\n└────┘')).toEqual([]);
    expect(O.kutuIhlal('┌────┐\n│ ab │\n│ abc │\n└────┘')).toEqual(['3: │ abc │']);
  });
  test('boşluk tablosu: sütunundan taşan sayı yakalanır, sola yaslı sütun geçer', () => {
    const tablo = (son) => '  No  Mesafe [m]  Egim\n  ----------------------\n'
      + '  1        1.200  0,00\n  2          850  4,50\n  3        1.500 -3,00\n' + son;
    expect(O.tabloIhlal(tablo(''))).toEqual([]);
    // TOPLAM satırı bir karakter sağa kaymış (dolgusu 6 harfli etiketi sığdırmıyordu)
    expect(O.tabloIhlal(tablo('  TOP       3.550   1,5\n'))).toHaveLength(1);
    // TOPLAM da iki kesik çizgi arasında durur ama verilerden SONRA — başlık sayılmaz
    expect(O.tabloIhlal(tablo('  ----------------------\n  TOPLAM    3.550\n  ----------------------\n'))).toEqual(['7:   TOPLAM    3.550']);
  });
  test('iki kesik çizgi arasındaki başlık satırı veri sayılmaz', () => {
    const t = '  KARSILASTIRMA\n  ------------------------\n  Seg   Egim   1,090 (hizli)\n  ------------------------\n'
      + '  S1    0,0          113,2\n  S2    4,5          136,2\n  S3   -3,0          128,0\n';
    expect(O.tabloIhlal(t)).toEqual([]);
  });
  test('"etiket : değer" ve formül satırları tablo sayılmaz', () => {
    const t = '  A.1 Arac\n  ----------------\n  Cd : 0,750\n  GVW : 13.150 kg\n  F = 0,5 * 1,2 = 3,1\n';
    expect(O.tabloIhlal(t)).toEqual([]);
  });
});

describe('TeX kaynağı', () => {
  test('noktalı ondalık yakalanır, {,} geçer', () => {
    expect('K_{1}=0{,}026909 \\quad g=9{,}81'.match(O.TEX_NOKTA)).toBeNull();
    expect('F=0.5\\rho'.match(O.TEX_NOKTA)).toEqual(['0.5']);
  });
  test('binlik nokta TeX\'te de ondalık sayılmaz', () => {
    expect(O.texTara('T_s=12.760{,}7 \\quad N=1.500 \\quad T_s=−18.482{,}4')).toEqual([]);
    expect(O.texTara('T_s=12760.7').map((x) => x.split(' ⟨')[0])).toEqual(['nokta "12760.7"']);
  });
  test('çıplak ondalık virgül yakalanır — KaTeX onu noktalama sayıp arkasına boşluk koyar', () => {
    expect(O.texTara('T_s=12.760,7').map((x) => x.split(' ⟨')[0])).toEqual(['çıplak virgül "0,7"']);
    expect(O.texTara('\\mathbf F=[0,0,-mg]').map((x) => x.split(' ⟨')[0])).toEqual(['çıplak virgül "0,0"']);
    expect(O.texTara('\\mathbf F=[0;0;-mg] \\quad \\big(12{,}5;\\ 34\\big)')).toEqual([]);
  });
});
