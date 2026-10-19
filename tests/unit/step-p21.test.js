/**
 * step-p21.test.js — STEP OKUYUCUSU: BAYT DİZİNİ VE DİLİMLİ OKUMA
 * (js/step-p21.js — FEAD ile Takoz'un ortak okuyucusu)
 *
 * Takoz'un STEP'i bütün güç grubu (analize hazır geometri ~400 MB). Eski
 * okuyucu dosyayı tek bir metin olarak tutuyordu ve okumayı tek görevde
 * yapıyordu; ölçüldü (420 MB'lık deneme montajı, tools/step-olcum.js):
 * arayüz 34 sn donuyor, okumadan sonra JS yığını 1,7 GB; 576 MiB'lık dosya
 * "Invalid string length" ile hiç açılmıyordu. Kapılar:
 *   BAYT ↔ METİN  — metinle ve baytla okunan dosya birebir aynı ağaç
 *   DİLİMLİ      — her döngü saati sorar: dilim başına iş sınırlı, sonuç senkronla birebir
 *   SAYI         — hızlı yol parseFloat'ın verdiği sayının aynısı
 *   KODLAMA      — dosya başına; yalnız DİZE baytları karar verir
 *   KİMLİK       — seyrek kimlik, tekrar eden kimlik, montaj sırası kimlikten
 *   ÖNBELLEK     — iki nesil, sınırlı
 *   KAP          — senkron ve dilimli açma aynı baytları verir; bozuk kap adresli hata
 *   VAZGEÇ       — bırakılan okuma null döner, ilerleme durur
 *   METNE ÇEVRİLMEZ — dilimli yolda dosyanın tamamı metne çevrilmez
 */
const zlib = require('zlib');
const P = require('../../js/step-p21.js');
const T = require('../helpers/step-takoz.js');
const O = require('../helpers/step-ornek.js');

// 400 parça, dört alt montaj (~2,4 MB): dilimlerin birden çok olması için
function buyukMontaj(n = 400) {
  const alt = ['A', 'B', 'C', 'D'].map((k, i) => ({ id: 'ALT_' + k, ad: 'Alt montaj ' + k, konum: [i * 1000, 0, 0] }));
  const p = [];
  for (let i = 0; i < n; i++) {
    p.push({ id: 'P' + i, ad: 'Parça ' + i, sekil: i % 3 ? 'kutu' : 'silindir', olcu: i % 3 ? [50, 40, 30] : [20, 60],
      konum: [(i % 10) * 60, Math.floor(i / 10) * 60, 0], alt: alt[i % 4].id });
  }
  return T.guçGrubuStep(p, { altMontajlar: alt });
}
const BUYUK = buyukMontaj();
const ALANLAR = ['ok', 'hatalar', 'uyarilar', 'baslik', 'agac', 'parcalar', '_yuz', '_geo'];
const ayni = (a, b) => ALANLAR.forEach((f) => expect([f, a[f]]).toEqual([f, b[f]]));
const metin = (t) => ['ISO-10303-21;', 'HEADER;', "FILE_NAME('x.stp','t',(''),(''),'','SIS','');", 'ENDSEC;', 'DATA;']
  .concat(t, ['ENDSEC;', 'END-ISO-10303-21;']).join('\n');

describe('BAYT ↔ METİN — aynı dosya iki girdiyle birebir', () => {
  test.each([['güç grubu', T.gucGrubu()], ['AG00686', O.ag00686Step()], ['400 parça', BUYUK]])('%s', (ad, m) => {
    const a = P.veStepP21Agac(m), b = P.veStepP21Agac(Buffer.from(m, 'utf8'));
    expect(a.ok).toBe(true);
    ayni(a, b);
    // ArrayBuffer da bir girdi (dosya seçicinin verdiği)
    const ab = Uint8Array.from(Buffer.from(m, 'utf8')).buffer;
    ayni(a, P.veStepP21Agac(ab));
  });
  test('Takoz yolu yüz tanımı çıkarmaz; ağaç, parçalar ve üçgenleyicinin girdisi aynı', () => {
    const a = P.veStepP21Agac(BUYUK), t = P.veStepP21Agac(BUYUK, { yuz: false });
    ['ok', 'hatalar', 'uyarilar', 'baslik', 'agac', 'parcalar', '_geo'].forEach((f) => expect(t[f]).toEqual(a[f]));
    expect(a._yuz.length).toBe(a.parcalar.length);
    expect(t._yuz).toEqual([]);
  });
});

// Saat her okumada 1 ms ilerler: bir adım (10 ms bütçe) en çok ~10 saat
// okuması yapar. Saati sormayan bir döngü evresinin tamamını TEK adımda
// bitirirdi — dilimli okuma tek görevlik okumaya dönerdi.
describe('DİLİMLİ — her döngü saati sorar, sonuç senkronla birebir', () => {
  afterEach(() => jest.restoreAllMocks());
  test('400 parça: bütçe başına sınırlı iş, çok sayıda adım, sonuç senkronla aynı', () => {
    let t = 0, okuma = 0;
    jest.spyOn(performance, 'now').mockImplementation(() => { okuma++; return (t += 1); });
    const bayt = Buffer.from(BUYUK, 'utf8');
    const is = P.veStepP21AgacIs(bayt, { yuz: false });
    const adimlar = [];
    let once = is.ilerleme();
    for (let g = 0; g < 100000; g++) {
      okuma = 0;
      const bitti = is.adim(10);
      const o = is.ilerleme();
      adimlar.push({ okuma, evre: once.evre, bayt: o.bayt - once.bayt, parca: o.parca - once.parca, oran: o.oran - once.oran });
      once = o;
      if (bitti) break;
    }
    expect(is.bitti).toBe(true);
    // ~10 okuma bütçe + evre başına üç (adımda en çok üç evre geçilir)
    expect(Math.max(...adimlar.map((a) => a.okuma))).toBeLessThanOrEqual(20);
    // tarama: adım başına en çok ~11 parça × 256 KB
    expect(Math.max(...adimlar.filter((a) => a.evre === 'tara').map((a) => a.bayt))).toBeLessThanOrEqual(11 * 262144);
    expect(Math.max(...adimlar.filter((a) => a.evre === 'agac').map((a) => a.parca))).toBeLessThanOrEqual(12);
    expect(adimlar.filter((a) => a.evre === 'montaj').length).toBeGreaterThanOrEqual(10);
    expect(adimlar.filter((a) => a.evre === 'agac').length).toBeGreaterThanOrEqual(30);
    // ilerleme geri gitmez ve 1'de biter
    expect(adimlar.every((a) => a.oran >= 0)).toBe(true);
    expect(is.ilerleme().oran).toBe(1);
    jest.restoreAllMocks();
    const s = P.veStepP21Agac(bayt, { yuz: false });
    ['ok', 'hatalar', 'uyarilar', 'baslik', 'agac', 'parcalar', '_geo'].forEach((f) => expect(is.sonuc[f]).toEqual(s[f]));
  });
  test('sıfır bütçe de her adımda ilerler (sonsuz döngü yok)', () => {
    const is = P.veStepP21AgacIs(T.gucGrubu());
    let g = 0;
    while (!is.adim(0) && g < 100000) g++;
    expect(is.sonuc.ok).toBe(true);
    ayni(is.sonuc, P.veStepP21Agac(T.gucGrubu()));
  });
  test('hata adımda FIRLATILMAZ, sonuca yazılır', () => {
    const is = P.veStepP21AgacIs('bu bir STEP dosyası değil');
    expect(is.adim(10)).toBe(true);
    expect(is.sonuc.ok).toBe(false);
    expect(is.sonuc.hatalar[0]).toMatch(/ISO-10303-21/);
    const m = P.veStepP21AgacIs(metin(["#1=NEXT_ASSEMBLY_USAGE_OCCURRENCE('a','b','',#9,$,$);"]));
    while (!m.adim(10));
    expect(m.sonuc.hatalar[0]).toMatch(/^Montaj ağacı okunamadı/);
  });
});

// Eski okuyucu sayıyı parseFloat ile okuyordu; yeni hızlı yol mantisi tam
// sayı olarak biriktiriyor. Kesinlik koşulu (≤ 2^53, |üs| ≤ 22) dışındaki her
// biçim parseFloat'a düşer — iki yolun bir bit bile ayrışmaması gerekir.
describe('SAYI — hızlı yol parseFloat ile birebir', () => {
  test('20.000 sayı, STEP\'in bütün biçimleri (−0 dâhil)', () => {
    let tohum = 7;
    const r = () => { tohum = (tohum * 1103515245 + 12345) % 2147483648; return tohum / 2147483648; };
    const sabit = ['0.', '-0.', '1.', '-1.', '1.E-05', '1.e+05', '7.5E3', '+2.', '0.10000000000000001', '123456789012345678.',
      '9007199254740993.', '1E400', '-1E-400', '4.9E-324', '1.7976931348623157E308', '0.000000000000000000000001',
      '00012.500', '1.2.3', '1-2', '5', '-7', '1E', '1.E+', '2E-22', '2E22', '2E23', '3.141592653589793238'];
    const sayilar = sabit.slice();
    while (sayilar.length < 20000) {
      const v = (r() - 0.5) * Math.pow(10, Math.floor(r() * 40) - 20);
      const k = r();
      sayilar.push(k < 0.3 ? v.toPrecision(1 + Math.floor(r() * 17)) : k < 0.6 ? v.toExponential(Math.floor(r() * 17)).toUpperCase()
        : k < 0.8 ? v.toFixed(Math.floor(r() * 12)) : String(Math.round(v)) + '.');
    }
    const satir = [];
    for (let i = 0; i < sayilar.length; i += 500) satir.push('#' + (i / 500 + 1) + "=CARTESIAN_POINT('',(" + sayilar.slice(i, i + 500).join(',') + '));');
    const m = P.veStepP21Oku(metin(satir));
    expect(m.hatalar).toEqual([]);
    let fark = 0, ilk = null;
    for (let i = 0; i < sayilar.length; i += 500) {
      const a = P.veStepP21Varlik(m, i / 500 + 1).a[1];
      a.forEach((v, j) => {
        const beklenen = parseFloat(sayilar[i + j]);
        if (!Object.is(v, beklenen)) { fark++; if (!ilk) ilk = [sayilar[i + j], v, beklenen]; }
      });
    }
    expect([fark, ilk]).toEqual([0, null]);
  });
});

describe('KODLAMA — dosya başına; yalnız DİZE baytları karar verir', () => {
  const urun = (ad) => metin(["#1=PRODUCT('P','" + ad + "','',());"]);
  const oku = (bayt) => P.veStepP21Varlik(P.veStepP21Oku(bayt), 1).a[1].s;
  test('dizeler geçerli UTF-8 → UTF-8', () => {
    expect(oku(Buffer.from(urun('KAYIŞ Ø147 ⌀ 😀'), 'utf8'))).toBe('KAYIŞ Ø147 ⌀ 😀');
  });
  test('bir dizede geçersiz UTF-8 → bütün dizeler ISO 8859-1 (eski okuyucunun kuralı)', () => {
    const m = P.veStepP21Oku(Buffer.concat([Buffer.from(metin(["#1=PRODUCT('P','KAYIŞ','',());"]).split('ENDSEC;\nEND')[0], 'utf8'),
      Buffer.from("#2=PRODUCT('P','KRANK \xD8147','',());\nENDSEC;\nEND-ISO-10303-21;", 'latin1')]));
    expect(P.veStepP21Varlik(m, 2).a[1].s).toBe('KRANK Ø147');
    expect(P.veStepP21Varlik(m, 1).a[1].s).toBe('KAYIÅ\u009e');          // UTF-8 baytları tek tek
  });
  // Eski okuyucu YORUMDAKİ bir ISO 8859-1 baytı yüzünden bütün dosyayı ISO
  // 8859-1 okuyordu ve geçerli UTF-8 adları bozuyordu ("değil" → "deÄil").
  test('yorumdaki ISO 8859-1 baytı dizeleri bozmaz', () => {
    const b = Buffer.concat([Buffer.from(urun('KAYIŞ'), 'utf8'), Buffer.from('\n/* \xE7 */\n', 'latin1')]);
    expect(oku(b)).toBe('KAYIŞ');
  });
});

describe('KİMLİK DİZİNİ — seyrek kimlik, tekrar, montajın sırası', () => {
  test('seyrek kimlik (düz dizi yerine Map) ve tekrar eden kimlikte sonuncusu', () => {
    const m = P.veStepP21Oku(metin(["#1=CARTESIAN_POINT('a',(1.,2.,3.));", "#1000000000=DIRECTION('b',(0.,0.,1.));",
      "#7=CARTESIAN_POINT('eski',(0.,0.,0.));", "#7=CARTESIAN_POINT('yeni',(9.,9.,9.));"]));
    expect(m.yer).toBeNull();
    expect(m.adet).toBe(4);
    expect(m.enBuyukId).toBe(1000000000);
    expect(P.veStepP21Tip(m, 1000000000)).toBe('DIRECTION');
    expect(P.veStepP21Varlik(m, 1000000000).a[1]).toEqual([0, 0, 1]);
    expect(P.veStepP21Varlik(m, 7).a[0].s).toBe('yeni');
    expect(P.veStepP21Varlik(m, 8)).toBeNull();
    expect(P.veStepP21Tip(m, 8)).toBeNull();
    // sıkışık kimlikler (düz dizi) de sonuncusunu alır
    const d = P.veStepP21Oku(metin(["#1=CARTESIAN_POINT('a',(1.,2.,3.));", "#2=CARTESIAN_POINT('eski',(0.,0.,0.));",
      "#2=CARTESIAN_POINT('yeni',(9.,9.,9.));", "#3=DIRECTION('b',(0.,0.,1.));"]));
    expect(d.yer).not.toBeNull();
    expect(d.adet).toBe(4);
    expect(P.veStepP21Varlik(d, 2).a[0].s).toBe('yeni');
  });
  // Eski okuyucu kayıtları nesne anahtarı sırasıyla (kimlik sırası) geziyordu:
  // çocukların ve parçaların sırası dosyadaki satır sırasından değil kimlikten.
  test('dosyadaki satır sırası ters olsa da montajın sırası kimlikten', () => {
    const m = T.gucGrubu();
    const ters = m.split('DATA;')[0] + 'DATA;\n' + m.split('DATA;')[1].split('ENDSEC;')[0].trim().split('\n').reverse().join('\n')
      + '\nENDSEC;\nEND-ISO-10303-21;';
    const a = P.veStepP21Agac(m), b = P.veStepP21Agac(ters);
    expect(b.ok).toBe(true);
    expect(b.agac.map((d) => d.ad)).toEqual(a.agac.map((d) => d.ad));
    expect(b.parcalar.map((p) => p.ornek)).toEqual(a.parcalar.map((p) => p.ornek));
  });
});

describe('ÖNBELLEK — iki nesil, sınırlı', () => {
  test('140.000 varlık sorulunca önbellek iki nesli aşmaz; değer yeniden ayrıştırılanla aynı', () => {
    const N = 140000, satir = [];
    for (let i = 1; i <= N; i++) satir.push('#' + i + "=CARTESIAN_POINT('',(" + i + '.,' + (i / 4) + ',-1.5));');
    const m = P.veStepP21Oku(metin(satir));
    for (let i = 1; i <= N; i++) P.veStepP21Varlik(m, i);
    const say = m._ob1.size + (m._ob2 ? m._ob2.size : 0);
    expect(say).toBeLessThanOrEqual(2 * P.VE_STEP_P21_ONBELLEK);
    expect(say).toBeGreaterThan(P.VE_STEP_P21_ONBELLEK);
    expect(P.veStepP21Varlik(m, 1)).toEqual({ t: 'CARTESIAN_POINT', a: [{ s: '' }, [1, 0.25, -1.5]] });
    const v = P.veStepP21Varlik(m, N);
    expect(P.veStepP21Varlik(m, N)).toBe(v);                     // önbellekteyken aynı nesne
  });
});

// gzip BAŞLIK ALANLARIYLA (FEXTRA · FNAME · FCOMMENT · FHCRC) ve sıfır kuyrukla —
// tarayıcının açıcısına kuyruksuz ham deflate verildiği için sağlama aranmaz
function gzipBaslikli(veri) {
  const ek = Buffer.from([0x41, 0x42, 2, 0, 0x01, 0x02]);
  const xlen = Buffer.alloc(2); xlen.writeUInt16LE(ek.length, 0);
  return Buffer.concat([Buffer.from([0x1f, 0x8b, 8, 4 | 8 | 16 | 2, 0, 0, 0, 0, 0, 3]), xlen, ek,
    Buffer.from('X.stp\0', 'latin1'), Buffer.from('CATIA\0', 'latin1'), Buffer.from([0, 0]), zlib.deflateRawSync(veri), Buffer.alloc(8)]);
}
function zipYap(ad, veri, yontem) {
  const adB = Buffer.from(ad, 'utf8'), g = yontem === 0 ? veri : zlib.deflateRawSync(veri);
  const lh = Buffer.alloc(30);
  lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(yontem, 8);
  lh.writeUInt32LE(g.length, 18); lh.writeUInt32LE(veri.length, 22); lh.writeUInt16LE(adB.length, 26);
  const ch = Buffer.alloc(46);
  ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(yontem, 10);
  ch.writeUInt32LE(g.length, 20); ch.writeUInt32LE(veri.length, 24); ch.writeUInt16LE(adB.length, 28); ch.writeUInt32LE(0, 42);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(1, 8); eocd.writeUInt16LE(1, 10);
  eocd.writeUInt32LE(46 + adB.length, 12); eocd.writeUInt32LE(30 + adB.length + g.length, 16);
  return Buffer.concat([lh, adB, g, ch, adB, eocd]);
}

describe('KAP — senkron ve dilimli açma aynı baytları verir', () => {
  const ham = Buffer.from(T.gucGrubu(), 'utf8');
  test.each([
    ['düz', ham, 'duz', undefined],
    ['gzip', zlib.gzipSync(ham), 'gzip', undefined],
    ['başlık alanlı gzip', gzipBaslikli(ham), 'gzip', undefined],
    ['zip (deflate)', zipYap('alt/GUC.STP', ham, 8), 'zip', 'alt/GUC.STP'],
    ['zip (saklı)', zipYap('GUC.stp', ham, 0), 'zip', 'GUC.stp'],
  ])('%s', async (ad, bayt, kap, icerik) => {
    const a = P.veStepP21Ac(new Uint8Array(bayt));
    expect(Buffer.from(a.bayt).equals(ham)).toBe(true);
    expect(a.kap).toBe(kap);
    expect(a.icerik).toBe(icerik);
    const s = await P.veStepP21AgacDilimli(new Uint8Array(bayt), { yuz: false }).sonuc;
    expect(s.kap).toBe(kap);
    expect(s.icerik).toBe(icerik);
    expect(s.sureMs.toplam).toBeGreaterThanOrEqual(0);
    ['ok', 'agac', 'parcalar', '_geo'].forEach((f) => expect(s[f]).toEqual(P.veStepP21Agac(ham, { yuz: false })[f]));
  });
  // Tarayıcının akış açıcısı (Node'un aynısı, stream/web) kaydediciyle sarılır:
  // girdi tek parça verilince 403 MB tek görevde açılıyordu (ölçüldü: 1,2 sn).
  test('akış açıcısına girdi ≤ 256 KB\'lık parçalarla verilir; saf JS açıcı çağrılmaz', async () => {
    const W = require('stream/web');
    const X = require('../../js/xlsx-read.js');
    const parca = [], asilInflate = X.veXlsInflateRaw;
    let inflate = 0;
    X.veXlsInflateRaw = function () { inflate++; return asilInflate.apply(this, arguments); };
    class Kayitli {
      constructor(f) {
        const ds = new W.DecompressionStream(f);
        const ts = new W.TransformStream({ transform(c, k) { parca.push(c.byteLength); k.enqueue(c); } });
        ts.readable.pipeTo(ds.writable);
        this.writable = ts.writable;
        this.readable = ds.readable;
      }
    }
    global.ReadableStream = W.ReadableStream;
    global.DecompressionStream = Kayitli;
    try {
      const buyuk = Buffer.from(buyukMontaj(1600), 'utf8');
      const gz = zlib.gzipSync(buyuk, { level: 1 });
      expect(gz.length).toBeGreaterThan(3 * 262144);
      const s = await P.veStepP21AgacDilimli(new Uint8Array(gz), { yuz: false }).sonuc;
      expect(s.ok).toBe(true);
      expect(s.kap).toBe('gzip');
      expect(parca.length).toBeGreaterThanOrEqual(4);
      expect(Math.max(...parca)).toBeLessThanOrEqual(262144);
      expect(inflate).toBe(0);
      expect(s.agac).toEqual(P.veStepP21Agac(buyuk, { yuz: false }).agac);
    } finally {
      delete global.ReadableStream; delete global.DecompressionStream;
      X.veXlsInflateRaw = asilInflate;
    }
  });
  test('bozuk gzip: dilimli okuma ADRESLİ hatayla reddedilir', async () => {
    const z = zlib.gzipSync(ham);
    await expect(P.veStepP21AgacDilimli(new Uint8Array(z.subarray(0, 40))).sonuc).rejects.toThrow(/deflate|gzip/);
  });
  test('STEP olmayan dosya: sonuç hatalı döner, reddedilmez', async () => {
    const s = await P.veStepP21AgacDilimli(Buffer.from('merhaba', 'utf8')).sonuc;
    expect(s.ok).toBe(false);
    expect(s.hatalar[0]).toMatch(/ISO-10303-21/);
  });
});

describe('VAZGEÇ — bırakılan okuma null döner, ilerleme durur', () => {
  test('ilk ilerlemeden sonra vazgeç', async () => {
    let n = 0, sonra = 0, is = null;
    is = P.veStepP21AgacDilimli(Buffer.from(BUYUK, 'utf8'), { yuz: false, ilerleme: () => {
      n++;
      if (n === 1) is.vazgec(); else sonra++;
    } });
    expect(await is.sonuc).toBeNull();
    expect(n).toBe(1);
    expect(sonra).toBe(0);
  });
  test('ilerleme oranı artar ve 1\'de biter; evreler sırayla', async () => {
    const o = [];
    const s = await P.veStepP21AgacDilimli(Buffer.from(BUYUK, 'utf8'), { yuz: false, ilerleme: (x) => o.push(x) }).sonuc;
    expect(s.ok).toBe(true);
    expect(o.length).toBeGreaterThan(1);
    expect(o.every((x, i) => i === 0 || x.oran >= o[i - 1].oran)).toBe(true);
    expect(o[o.length - 1].oran).toBe(1);
    const evre = o.map((x) => x.evre).filter((e, i, a) => i === 0 || e !== a[i - 1]);
    expect(evre).toEqual(['tara', 'montaj', 'agac']);
  });
});

// Dosyanın TAMAMI metne çevrilmez: V8'in tek metin sınırı (~512 MiB) daha
// büyük dosyayı açtırmıyordu. Metne çeviren tek yol FEAD'in küçük dosya yolu
// (veStepP21Metin); okuma işi baytları alır.
describe('METNE ÇEVRİLMEZ — dilimli yolda dosyanın tamamı metne çevrilmez', () => {
  const src = require('fs').readFileSync(require('path').join(__dirname, '../../js/step-p21.js'), 'utf8');
  const govde = (ad) => { const i = src.indexOf('function ' + ad + '('); return src.slice(i, src.indexOf('\n}\n', i)); };
  test('baytı metne çeviren işlev yalnız veStepP21Metin\'de çağrılır', () => {
    const cagri = src.split('\n').filter((l) => /_stpBaytMetin\(/.test(l) && !/^function _stpBaytMetin/.test(l));
    expect(cagri).toHaveLength(1);
    expect(govde('veStepP21Metin')).toMatch(/_stpBaytMetin\(/);
    ['veStepP21AgacIs', 'veStepP21AgacDilimli', '_stpAcDilimli', 'veStepP21Ac'].forEach((f) => {
      expect([f, /_stpBaytMetin|_stpLatin1|_stpUtf8\(|veStepP21Metin/.test(govde(f))]).toEqual([f, false]);
    });
  });
});
