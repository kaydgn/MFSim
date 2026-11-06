// ============================================================================
//  TAKOZ — VERİ SAYFASI KATALOĞU (motor · şanzıman ailesi)
// ============================================================================
// Gövdenin kütlesi, ağırlık merkezi ve ataleti üreticinin veri sayfasından
// (kullanıcı, 2026-11-02): veri sayfası ağırlık merkezini bir REFERANSTAN
// uzaklık olarak verir — motorda bloğun ön (X12'de arka) yüzünden ve krank
// ekseninin üstüne. Referans STEP'in 3B'sinde seçilir, ağırlık merkezi oradan
// hesaplanır (js/mount-step.js → veMntStpVeriKonum). DOM'suz saf veri: buraya
// hiçbir şey yazılmaz.
//
// Değerler programın içinde (kullanıcı kararı, 2026-11-02 — belgelerin gizlilik
// damgası soruldu). Sayılar veri sayfasındaki metrik değerler, yuvarlanmadan;
// kapı tests/unit/mount-veri-sayfasi.test.js → KATALOG.
//
// Alanlar:
//   k        anahtar — projenin rol kaydına yazılır, DEĞİŞMEZ
//   tip      rol (mnt-motor · mnt-gearbox)
//   ad       veri sayfasındaki model adı
//   uretici · konfig · kaynak   künye
//   kutle    { kuru, islak } kg — veri sayfası kuru kütleyi vermiyorsa kuru null
//   cg       { boy, yukari, yan } mm — boy: referans yüzünden birimin içine,
//            eksen boyunca; yukari: eksenden yukarı, eksene dik düşey düzlemde;
//            yan: eksenin düşey düzleminden, + motorun sağı ÖNDEN bakınca
//            (X12'nin tanımı). Veri sayfası yanal kaçıklık vermiyorsa yan yok:
//            ağırlık merkezi eksenin düşey düzleminde
//   atalet   { x, y, z } kg·m² — ağırlık merkezinde, birimin eksenlerinde:
//            x eksen boyunca (roll) · y yanal (pitch) · z düşey (yaw)
//   ref      { yuz, eksen, arka } — referansların veri sayfasındaki adı (3B'nin
//            seçim düğmeleri); arka: referans yüzü birimin ARKA yüzü — motorun
//            önü boy yönünde (yanın yönü buna bağlı)

var _VE_MNT_ON = { yuz: 'Bloğun ön yüzü', eksen: 'Krank ekseni' };

var VE_MNT_VERI_SAYFASI = [
  { k: 'cummins-isb45e5', tip: 'mnt-motor', ad: 'ISB4.5E5', uretici: 'Cummins', konfig: 'D323018BX03',
    kaynak: 'Cummins Base Engine Data Sheet · Rev. 2 (04.03.2013)',
    kutle: { kuru: 366, islak: 385 }, cg: { boy: 271, yukari: 158 }, atalet: { x: 14.7, y: 25, z: 19.1 },
    ref: _VE_MNT_ON },
  { k: 'cummins-isb67e3', tip: 'mnt-motor', ad: 'ISB6.7E3', uretici: 'Cummins', konfig: 'D313023BX03-E3',
    kaynak: 'Cummins Base Engine Data Sheet · Rev. 0 (18.09.2014)',
    kutle: { kuru: 485, islak: 512 }, cg: { boy: 402, yukari: 144 }, atalet: { x: 19.2, y: 49.6, z: 42.9 },
    ref: _VE_MNT_ON },
  { k: 'cummins-isb67-360', tip: 'mnt-motor', ad: 'ISB6.7 360', uretici: 'Cummins', konfig: 'D313003BX03',
    kaynak: 'Cummins Base Engine Data Sheet · Rev. 2 (03.11.2011)',
    kutle: { kuru: 485, islak: 512 }, cg: { boy: 402, yukari: 144 }, atalet: { x: 19.2, y: 49.6, z: 42.9 },
    ref: _VE_MNT_ON },
  // Ailenin adı sayfada boş; 6 silindir, 8,9 L, 114 × 145 mm: L9
  { k: 'cummins-l9', tip: 'mnt-motor', ad: 'L9', uretici: 'Cummins', konfig: 'D563020BX03',
    kaynak: 'Cummins Engine Family Datasheet · 24.10.2025',
    kutle: { kuru: 774, islak: 804 }, cg: { boy: 427, yukari: 212 }, atalet: { x: 29.8, y: 76.8, z: 66.9 },
    ref: _VE_MNT_ON },
  { k: 'cummins-ism11', tip: 'mnt-motor', ad: 'ISM11', uretici: 'Cummins', konfig: 'D353029BX03',
    kaynak: 'Cummins Engine Family Datasheet · 22.08.2025',
    kutle: { kuru: 940, islak: 990 }, cg: { boy: 450, yukari: 191 }, atalet: { x: 80.9, y: 164.9, z: 122.6 },
    ref: _VE_MNT_ON },
  // Ağırlık merkezi bloğun ARKA yüzünden; yalnız ıslak kütle
  { k: 'cummins-x12', tip: 'mnt-motor', ad: 'X12', uretici: 'Cummins', konfig: 'D0S3002CX03',
    kaynak: 'Cummins Engine Family Datasheet · 05.09.2024',
    kutle: { kuru: null, islak: 860 }, cg: { boy: 477, yukari: 195, yan: 0 }, atalet: { x: 51.3, y: 149, z: 123 },
    ref: { yuz: 'Bloğun arka yüzü', eksen: 'Krank ekseni', arka: true } },
  { k: 'cummins-x15', tip: 'mnt-motor', ad: 'X15', uretici: 'Cummins', konfig: 'D103018BX03',
    kaynak: 'Cummins Engine Family Datasheet · 22.08.2025',
    kutle: { kuru: 1327, islak: 1401 }, cg: { boy: 455, yukari: 244 }, atalet: { x: 110.7, y: 260.2, z: 205.9 },
    ref: _VE_MNT_ON }
];

// ── ŞANZIMAN AİLESİ — seçenekli TEK kayıt (2026-11-06) ─────────────────────
// Allison 4000 (4000 Product Family Transmission Data · 15.10.2020): ailenin
// bütün modelleri tek belgede, seçenekleriyle. Listede TEK satır; seçenekler
// anahtarda — `allison-4000?dizi=7&bag=d&pto=1&ret=1&sog=r&kar=derin&aku=1&flans=8&yag=0.85`.
// Anahtar projeye yazılır: seçeneklerin adı, değerleri, sırası ve varsayılanı
// DEĞİŞMEZ (kullanıcı kararları 2026-11-06).
//  • Kütle TOPLANIR (§8): temel + PTO + retarder + soğutucu + akümülatör (ve
//    solenoidi) + uzak bağlama (6 vitesliye arka braket) + çıkış flanşı
//    (kullanıcının; belge 5–12 kg) = kuru; + yağ = ıslak. Yağ ağırlık merkezinde,
//    hacmi §13'ün ilk dolumu, yoğunluğu seçenek. Uzak soğutucu şasidedir:
//    kütlesi ve yağı gövdeye girmez.
//  • Ağırlık merkezi (§9) ve atalet (§11) seçeneklerin SATIRINDAN, toplanmaz:
//    satırlar ölçülmüş (PTO provizyonunun kaydırması kütlesinin yerinden
//    çıkmıyor). 7 vitesli tablo soğutucuyu, atalet tablosu bağlamayı ve
//    retardersiz soğutucuyu ayırmıyor: o seçenek satırı değiştirmez.
//  • Allison'un sistemi: X konvertör muhafazasının ön yüzünden arkaya, Y eksenin
//    ALTINA, Z sağa (sağ el; üstten bakışın + oku) → boy = X, yukari = −Y,
//    yan = −Z (programın yanı önden bakanın sağı: aracın solu).
//  • §9.1'in "doğrudan · retarder yok · PTO yok · standart soğutucu" satırında
//    Y 40,8 mm, inç değeri 1,89 (48,0 mm): katalog metrik değeri taşır (belgenin
//    notu: inç yalnız başvuru).
// Kapı: tests/unit/mount-veri-sayfasi.test.js → AİLE.
var VE_MNT_A4K = {
  k: 'allison-4000', tip: 'mnt-gearbox', ad: 'Allison 4000', uretici: 'Allison', aile: true,
  kaynak: 'Allison 4000 Product Family Transmission Data · 15.10.2020',
  ref: { yuz: 'Konvertör muhafazasının ön yüzü', eksen: 'Şanzıman ekseni' },
  egilme: 3500,                          // §10 statik eğilme momenti sınırı, N·m — bütün modeller
  // Seçenekler: sayısız seçeneğin varsayılanı ilk değeri; `kosul`: başka
  // seçeneğin değerine göre izinli değerler
  // Vites konfigürasyonu (kullanıcı 2026-11-06, Canlı Not 50: *"'dişli düzeni' yerine
  // 'vites konfigürasyonu' … seçtiğimizde vites oranları görünsün … Türkçeleri değil
  // İngilizceleri olsun"*): adlar belgenin adları; `oran`: seçilince oranları altında
  secenek: [
    { k: 'dizi', ad: 'Vites konfigürasyonu', oran: true, d: [['cr', 'Close Ratio (CR)'], ['wr', 'Wide Ratio (WR)'], ['7', '7-Speed']] },
    // Terimler İngilizce (kullanıcı 2026-11-06, Canlı Not 51: *"'uzak' soğutucu ne demek?
    // Bunların ingilizcesini kullanalım. Uzak yerine genelde remote derler"*); değerler değişmez
    { k: 'bag', ad: 'Bağlama', d: [['d', 'Direct mount'], ['u', 'Remote mount']] },
    { k: 'pto', ad: 'PTO provizyonu', d: [['0', 'Yok'], ['1', 'Var']] },
    { k: 'ret', ad: 'Retarder', d: [['0', 'Yok'], ['1', 'Var']] },
    // üçüncü öğe: kütle kaleminin ve künyenin adı
    { k: 'sog', ad: 'Soğutucu', d: [['u', 'Remote', 'Remote cooler'], ['s', 'Direct · standard capacity', 'Direct cooler · standard capacity'],
      ['y', 'Direct · high capacity', 'Direct cooler · high capacity'], ['r', 'Direct · retarder/sump', 'Retarder/sump cooler']],
      kosul: { ret: { '0': ['u', 's', 'y'], '1': ['u', 'r'] } } },
    { k: 'kar', ad: 'Karter', d: [['derin', 'Deep'], ['sig', 'Shallow']], kosul: { dizi: { '7': ['derin'] } } },
    { k: 'aku', ad: 'Akümülatör', d: [['0', 'Yok'], ['1', 'Var']], kosul: { ret: { '0': ['0'] } } },
    { k: 'flans', ad: 'Çıkış flanşı', birim: 'kg', min: 0, max: 30, vars: 8 },
    { k: 'yag', ad: 'Yağ yoğunluğu', birim: 'kg/L', min: 0.6, max: 1.2, vars: 0.85 }
  ],
  // §8 kuru kütleler, kg (temel: PTO'suz, retardersiz)
  kutle: { temel: { cr: 377, wr: 377, '7': 493 }, pto: 28, ret: 34, sog: { u: 0, s: 16, y: 23, r: 33 },
           aku: 4.5, akuSol: 0.6, uzak: 52, uzakArka6: 17 },
  // §9 ağırlık merkezi [X, Y, Z] mm: bağlama → retarder + PTO ('10': retarder var, PTO yok) → soğutucu
  cg: {
    '6': { d: { '00': { u: [342.7, 40.2, 3.6], s: [357.9, 40.8, 3.6], y: [367.5, 51.3, 3.6] },
                '01': { u: [387.7, 36.3, 0.6], s: [402.8, 43.7, 0.6], y: [412.5, 47.0, 0.6] },
                '10': { u: [367.5, 45.7, 7.1], r: [407.9, 56.4, 6.1] },
                '11': { u: [404.6, 37.6, 5.3], r: [445.2, 46.5, 4.8] } },
           u: { '00': { u: [288.7, 35.2, 3.6], s: [304.0, 42.1, 3.6], y: [313.7, 45.2, 3.6] },
                '01': { u: [331.9, 32.0, 0.6], s: [348.2, 38.9, 0.6], y: [357.6, 41.7, 0.6] },
                '10': { u: [314.7, 40.4, 7.1], r: [354.0, 50.4, 6.1] },
                '11': { u: [350.9, 33.5, 5.3], r: [391.8, 41.8, 4.8] } } },
    '7': { d: { '00': [414.0, 38.4, -1.5], '01': [489.5, 33.8, 2.8], '10': [465.8, 42.7, 0.8], '11': [525.5, 39.9, 5.6] },
           u: { '00': [364.7, 34.6, -1.5], '01': [435.8, 30.6, 2.8], '10': [414.8, 38.7, 0.8], '11': [471.7, 36.4, 5.6] } }
  },
  // §11 atalet [roll, pitch, yaw] kg·m² — çıkış flanşı dâhil
  atalet: {
    '6': { '00': [11.93, 28.35, 26.44], '01': [12.08, 33.65, 31.50],
           '10': { u: [13.02, 32.59, 30.44], r: [15.28, 44.66, 41.70] },
           '11': { u: [14.18, 41.01, 37.87], r: [15.55, 54.06, 49.84] } },
    '7': { '00': [15.34, 53.10, 48.82], '01': [15.27, 62.02, 57.79], '10': [15.34, 59.16, 54.13], '11': [16.43, 68.15, 64.91] }
  },
  // §13 ilk dolum, L — karter: [PTO'suz, PTO'lu]; soğutucu ve akümülatör ek dolum
  yag: { '6': { derin: [45, 48], sig: [38, 41] }, '7': { derin: [48, 51] }, sog: { u: 0, s: 1.0, y: 2.1, r: 2.5 }, aku: 0.6 },
  // §12 dişli oranları (yedi vitesli: 1. vites LO) ve §6 konvertörler (stall tork
  // oranı, K faktörü d/dk/√N·m)
  oran: { cr: [3.51, 1.91, 1.43, 1.00, 0.74, 0.64], wr: [4.70, 2.21, 1.53, 1.00, 0.76, 0.67],
          '7': [7.63, 3.51, 1.91, 1.43, 1.00, 0.74, 0.64] },
  geri: { cr: -4.80, wr: -5.55, '7': -4.80 },
  // vitesin belgedeki adı (yoksa sırası): yedi vitesli düzenin ilki LO
  vitesAd: { '7': ['LO', '1', '2', '3', '4', '5', '6'] },
  konvertor: [{ k: 'TC-521', stall: 2.42, K: 50.7 }, { k: 'TC-531', stall: 2.34, K: 44.8 }, { k: 'TC-541', stall: 1.90, K: 39.7 },
              { k: 'TC-551', stall: 1.79, K: 38.2 }, { k: 'TC-561', stall: 1.58, K: 35.4 }, { k: 'TC-571', stall: 1.62, K: 32.5 }]
};
var VE_MNT_VS_AILE = [VE_MNT_A4K];
function _veVsYuv(x){ return Math.round(x * 1e6) / 1e6 + 0; }
function _veVsSecDeger(o, v){ return o.d ? String(v) : String(+v); }   // anahtarın yazımı: makine biçimi
// Seçeneğin değeri öteki seçeneklerin değeriyle bağdaşıyor mu
function veMntVsGecerli(A, s, k, v){
  var o = null;
  for(var i = 0; i < A.secenek.length; i++) if(A.secenek[i].k === k) o = A.secenek[i];
  if(!o) return false;
  if(!o.d){ var x = +v; return Number.isFinite(x) && x >= o.min && x <= o.max; }
  if(!o.d.some(function(e){ return e[0] === String(v); })) return false;
  var kos = o.kosul || {};
  return Object.keys(kos).every(function(b){ var izin = kos[b][s[b]]; return !izin || izin.indexOf(String(v)) >= 0; });
}
function _veVsVarsayilan(A){
  var s = {};
  A.secenek.forEach(function(o){ s[o.k] = o.d ? o.d[0][0] : o.vars; });
  return s;
}
// Anahtarın ailesi ve seçenekleri: { A, s } | null (bilinmeyen aile, ad ya da
// değer; bağdaşmayan seçenek). Eksik seçenek varsayılandır.
function _veVsAyristir(k){
  if(typeof k !== 'string') return null;
  var q = k.indexOf('?'), taban = q < 0 ? k : k.slice(0, q), A = null;
  VE_MNT_VS_AILE.forEach(function(a){ if(a.k === taban) A = a; });
  if(!A) return null;
  var s = _veVsVarsayilan(A), gor = {};
  var parca = q < 0 || q === k.length - 1 ? [] : k.slice(q + 1).split('&');
  for(var i = 0; i < parca.length; i++){
    var e = parca[i].indexOf('='), ad = e > 0 ? parca[i].slice(0, e) : '', v = e > 0 ? parca[i].slice(e + 1) : '';
    if(!ad || gor[ad] || !A.secenek.some(function(o){ return o.k === ad; })) return null;
    gor[ad] = 1;
    var o = A.secenek.filter(function(x){ return x.k === ad; })[0];
    if(v === '') return null;
    s[ad] = o.d ? v : +v;
  }
  for(var j = 0; j < A.secenek.length; j++) if(!veMntVsGecerli(A, s, A.secenek[j].k, s[A.secenek[j].k])) return null;
  return { A: A, s: s };
}
function veMntVsAnahtar(A, s){
  return A.k + '?' + A.secenek.map(function(o){ return o.k + '=' + _veVsSecDeger(o, s[o.k]); }).join('&');
}
// Bir seçeneği değiştirir: yeni (kanonik) anahtar | null. Değişiklik ötekini
// geçersiz kılarsa öteki ilk izinli değerine döner (retarder kalkınca retarder
// soğutucusu "Uzak"a, akümülatör "Yok"a; yedi vitesli derin karter).
function veMntVsSecenekYaz(k, ad, v){
  var P = _veVsAyristir(k);
  if(!P) return null;
  var s = Object.assign({}, P.s), A = P.A, o = A.secenek.filter(function(x){ return x.k === ad; })[0];
  if(!o) return null;
  s[ad] = o.d ? String(v) : +v;
  if(!o.d ? !veMntVsGecerli(A, s, ad, s[ad]) : !o.d.some(function(e){ return e[0] === s[ad]; })) return null;
  A.secenek.forEach(function(x){
    if(x.k === ad || veMntVsGecerli(A, s, x.k, s[x.k])) return;
    var ilk = x.d && x.d.filter(function(e){ return veMntVsGecerli(A, s, x.k, e[0]); })[0];
    if(ilk) s[x.k] = ilk[0];
  });
  for(var j = 0; j < A.secenek.length; j++) if(!veMntVsGecerli(A, s, A.secenek[j].k, s[A.secenek[j].k])) return null;
  return veMntVsAnahtar(A, s);
}
// Allison 4000'in kaydı: seçeneklerden kütle (toplam), ağırlık merkezi ve atalet (satır)
function _veA4kKayit(A, s){
  var alti = s.dizi !== '7', dz = alti ? '6' : '7', rp = s.ret + s.pto, K = A.kutle, kal = [];
  var ekle = function(ad, kg){ if(kg > 0) kal.push({ ad: ad, kg: kg }); };
  var sogAd = A.secenek.filter(function(o){ return o.k === 'sog'; })[0].d.filter(function(e){ return e[0] === s.sog; })[0][2];
  ekle('Şanzıman', K.temel[s.dizi]);
  if(s.pto === '1') ekle('PTO provizyonu', K.pto);
  if(s.ret === '1') ekle('Retarder', K.ret);
  ekle(sogAd, K.sog[s.sog]);
  if(s.aku === '1'){ ekle('Retarder akümülatörü', K.aku); ekle('Akümülatör solenoidi', K.akuSol); }
  if(s.bag === 'u'){ ekle('Uzak bağlama provizyonu', K.uzak); if(alti) ekle('Arka bağlama braketi', K.uzakArka6); }
  ekle('Çıkış flanşı', +s.flans);
  var kuru = _veVsYuv(kal.reduce(function(t, x){ return t + x.kg; }, 0));
  var L = _veVsYuv(A.yag[dz][s.kar][+s.pto] + A.yag.sog[s.sog] + (s.aku === '1' ? A.yag.aku : 0)), yagKg = _veVsYuv(L * s.yag);
  var cg = A.cg[dz][s.bag][rp]; if(alti) cg = cg[s.sog];
  var I = A.atalet[dz][rp]; if(!Array.isArray(I)) I = I[s.sog];
  var dizi = A.secenek[0].d.filter(function(e){ return e[0] === s.dizi; })[0][1];
  var konfig = [dizi, s.bag === 'd' ? 'direct mount' : 'remote mount', s.pto === '1' ? 'PTO' : '', s.ret === '1' ? 'retarder' : '',
    sogAd.charAt(0).toLowerCase() + sogAd.slice(1), s.kar === 'derin' ? 'deep sump' : 'shallow sump', s.aku === '1' ? 'accumulator' : '']
    .filter(Boolean).join(', ');
  var v = { k: veMntVsAnahtar(A, s), aile: A.k, tip: A.tip, ad: A.ad, uretici: A.uretici, konfig: konfig, kaynak: A.kaynak,
    secenek: s, kalem: kal, yag: { L: L, rho: +s.yag, kg: yagKg },
    kutle: { kuru: kuru, islak: _veVsYuv(kuru + yagKg) },
    cg: { boy: cg[0], yukari: -cg[1], yan: -cg[2] + 0 }, atalet: { x: I[0], y: I[1], z: I[2] }, ref: A.ref,
    oran: { ileri: A.oran[s.dizi].slice(), geri: A.geri[s.dizi] } };
  if(s.bag === 'd') v.sinir = { egilme: A.egilme };
  return v;
}
// Anahtar → kayıt (salt okunur): motor sayfası birebir; aile anahtarı
// seçenekleriyle çözülür (yalnız ailenin adı: varsayılan seçenekler) — aynı
// anahtar aynı nesne
var _VE_VS_COZULEN = {};
function veMntVeriSayfasi(k){
  for(var i = 0; i < VE_MNT_VERI_SAYFASI.length; i++) if(VE_MNT_VERI_SAYFASI[i].k === k) return VE_MNT_VERI_SAYFASI[i];
  if(typeof k !== 'string') return null;
  if(Object.prototype.hasOwnProperty.call(_VE_VS_COZULEN, k)) return _VE_VS_COZULEN[k];
  var P = _veVsAyristir(k);
  return (_VE_VS_COZULEN[k] = P ? _veA4kKayit(P.A, P.s) : null);
}
// Rolün modelleri (kütle kaynağı listesi): sayfalar ve aileler — ailenin
// satırı ailenin kendisi (`aile: true`, anahtarı seçeneksiz)
function veMntVeriSayfalari(tip){
  return VE_MNT_VERI_SAYFASI.filter(function(v){ return v.tip === tip; })
    .concat(VE_MNT_VS_AILE.filter(function(a){ return a.tip === tip; }));
}
// Kaydın listedeki satırı: ailenin üyesi ailenin satırında
function veMntVsSatir(v){ return v ? (v.aile && v.aile !== true ? v.aile : v.k) : ''; }
function veMntVsAile(k){ var P = _veVsAyristir(k); return P ? P.A : null; }
// Şanzıman penceresinin doldurucuları: vites konfigürasyonları ve konvertörler
// (anahtar `aile:değer`, düğümün alanına yazılır)
function veMntVsDisliDuzenleri(){
  var out = [];
  VE_MNT_VS_AILE.forEach(function(A){
    if(!A.oran) return;
    A.secenek[0].d.forEach(function(e){
      out.push({ k: A.k + ':' + e[0], ad: A.ad + ' · ' + e[1], etiket: e[1], aile: A.ad, ileri: A.oran[e[0]].slice(), geri: A.geri[e[0]] });
    });
  });
  return out;
}
// Seçilen vites konfigürasyonunun oranları, belgenin vites adlarıyla: [{ ad, v }] —
// ileri vitesler, sonda geri (R)
function veMntVsOranlar(A, deger){
  var ileri = A && A.oran && A.oran[deger];
  if(!ileri) return [];
  var adlar = (A.vitesAd && A.vitesAd[deger]) || null;
  return ileri.map(function(v, i){ return { ad: adlar ? adlar[i] : String(i + 1), v: v }; })
    .concat(A.geri && A.geri[deger] != null ? [{ ad: 'R', v: A.geri[deger] }] : []);
}
function veMntVsKonvertorler(){
  var out = [];
  VE_MNT_VS_AILE.forEach(function(A){
    (A.konvertor || []).forEach(function(c){ out.push({ k: A.k + ':' + c.k, ad: c.k, aile: A.ad, stall: c.stall, K: c.K }); });
  });
  return out;
}
// Listenin adı rolün modeli (kullanıcı 2026-11-06, Canlı Not 42: *"'Veri sayfası' ne
// demek? 'Motor modeli' falan yazsak çok daha doğru olmaz mı?"*): seçilen şey motorun
// (şanzımanın) modeli; veri sayfası onun kaynağı
// Şanzımanda AİLE (kullanıcı 2026-11-06, Canlı Not 51: *"'şanzıman modeli' değil, 'şanzıman
// ailesi' olacak. Bir sürü model var 4000 serisinde"*)
var VE_MNT_MODEL_AD = { 'mnt-motor': 'Motor modeli', 'mnt-gearbox': 'Şanzıman ailesi' };
function veMntModelAd(tip){ return VE_MNT_MODEL_AD[tip] || 'Model'; }

if(typeof module !== 'undefined' && module.exports){
  module.exports = { VE_MNT_VERI_SAYFASI: VE_MNT_VERI_SAYFASI, veMntVeriSayfasi: veMntVeriSayfasi, veMntVeriSayfalari: veMntVeriSayfalari,
    VE_MNT_MODEL_AD: VE_MNT_MODEL_AD, veMntModelAd: veMntModelAd, VE_MNT_A4K: VE_MNT_A4K, VE_MNT_VS_AILE: VE_MNT_VS_AILE,
    veMntVsGecerli: veMntVsGecerli, veMntVsAnahtar: veMntVsAnahtar, veMntVsSecenekYaz: veMntVsSecenekYaz, veMntVsSatir: veMntVsSatir,
    veMntVsAile: veMntVsAile, veMntVsDisliDuzenleri: veMntVsDisliDuzenleri, veMntVsKonvertorler: veMntVsKonvertorler,
    veMntVsOranlar: veMntVsOranlar };
}
