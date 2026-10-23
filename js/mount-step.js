// ════════════════════════════════════════════════════════════════════════════
//  TAKOZ — STEP'TEN GÖVDE VE TAKOZ (DOM'suz)
// ════════════════════════════════════════════════════════════════════════════
//
// Kullanıcı isteği (2026-10-14): Takoz modülüne "STEP dosyadan başlama" —
// FEAD'in "STEP'ten başla" kapısının aynısı.
//
// ZİNCİR: baytlar → veStepP21AgacDilimli (js/step-p21.js: ağaç, ANLAMSIZ;
// tarayıcıda dilim dilim) →
// kullanıcı düğümlere rol verir (Motor · Şanzıman · … · Takoz) → veMntStpCoz
// (yalnız rollü birimler) → veMntStpKayit (sihirbazın düğüm listesi) →
// sihirbaz onu örnek gibi yükler (veMntWizFromNodes — ikinci bir kurulum yolu
// açılmaz).
//
// KURALLAR:
//  • ÖNCE ROL, SONRA ANALİZ (FEAD kural 34'ün kuralı): ad hiçbir şeye karar
//    vermez, rol geometriden tahmin edilmez. Rol bir DÜĞÜME verilir (parça ya
//    da alt montaj); bir parça en yakın rollü atasının birimidir.
//  • ÖLÇÜLEN ŞEY GEOMETRİ: takozun noktası ÜST BAĞLANTI YÜZEYİNİN MERKEZİ
//    (aşağıda, TAKOZ NOKTASI); gövdenin hacim merkezi ağırlık merkezi diye
//    ÖNERİLİR (homojen yoğunluk varsayımı).
//    Kütle STEP'te YOK: kullanıcı yazarsa atalet aynı varsayımla türetilir,
//    yazmazsa atalet de yazılmaz — uydurulmuş bir kütleden türemiş atalet
//    sessizce yanlış olurdu. Geometriden gelen her alan sihirbazda "S" işareti
//    taşır; ölçülen değer yazılınca düşer.
//  • KÜTLE KAYNAĞI (2026-10-20, Takoz adım 6): elle (varsayılan) · malzeme
//    (VE_MNT_STP_MALZEME: kütle = yoğunluk × hacim) · dosyadan (parçaların
//    dosyadaki yoğunlukları — ağırlık merkezi ve atalet KÜTLEYLE ağırlıklı).
//  • PARÇA PARÇA (veMntStpParcaOzellik): hacim, merkez ve tensör her parça
//    için ayrı; birim onların toplamı. Ağı kapalı olmayan parça hacme KATILMAZ
//    ve adıyla, yüzey payıyla söylenir — eskiden tek açık parça bütün birimi
//    kutunun merkezine düşürüyordu (ölçüldü: 7 parçalı motorda 45 mm).
//    Dosya parçanın hacmini ve merkezini yazıyorsa (CAx-IF doğrulama
//    özellikleri, js/step-p21.js → veStepP21Ozellikler) o sayılar ağınkinin
//    yerine geçer: CATIA'nın kendi hesabı; ağı açık parça da böyle katılır
//    (tensörü yok — nokta kütle).
//  • HACİM ÜÇGEN AĞINDAN (diverjans teoremi; ağ js/step-ucgen.js'in): ağ su
//    geçirmez ve yüzün bayrağıyla yönlü ("KAPALI KATI", step-ucgen.test.js),
//    kiriş payı 0,1 mm. KAPALILIK ÖLÇÜLÜR, varsayılmaz: üçgenlenemeyen yüz
//    yoksa da ağın her kenarı iki üçgende olmalı — açık bir yüzey modelinde
//    diverjans toplamı başlangıç noktasına bağlı bir sayı verir ve "hacim
//    merkezi" sessizce uydurulmuş olurdu (mount-step.test.js'te ölçüldü: beş
//    yüzlü kutu kapalı sayılıyordu). Kapalı değilse hacim yerine kutunun
//    merkezi kullanılır, atalet yazılmaz ve uyarı söylenir.
//    FEAD'in "üçgen yalnız görüntü içindir" kuralı kasnak ÇAPI içindi (dosyada
//    yazılı tam sayı); bir motorun hacim merkezi dosyada yazılı değil — tek
//    kaynak katının kendisi.
//  • KOORDİNAT DOSYANINKİ (mm, montajın ekseni) — taşınmaz, döndürülmez.

var VE_MNT_STP_SURUM = '1.0.0';
// ÜÇGEN İNCELİĞİ — TEK YER: 3B görüntüleyici, sihirbazın hesabı ve bu dosyanın
// kendi üçgenlemesi bunu okur (iki incelik iki ayrı ağırlık merkezi verirdi).
// Takoz'un STEP'i bütün güç grubudur: 0,1 mm'lik FEAD inceliği 400 MB'lık
// analiz geometrisinde tarayıcı sekmesinin 4 GB'lık sınırını aşıyor; 0,5 mm'de
// motor, şanzıman ve transferin ağırlık merkezi 0,1 mm'lik ağdan 0,2 mm'den az
// ayrışıyor (ölçüldü — 10 mm'lik CG hatası sehimi 0,16 mm değiştiriyor).
var VE_MNT_STP_UCGEN = { kiris: 0.5, aci: 20 };
// Rol verilebilen tipler — kütle gövdeleri ve takoz. Sık olanlar ÇİP, kalanı
// "Diğer" listesinde (3B görüntüleyici); ikisinin birleşimi TEK liste.
var VE_MNT_STP_ROLLER = ['mnt-motor', 'mnt-gearbox', 'mnt-transfer', 'mnt-bracket', 'mnt-mount',
                         'mnt-shaft', 'mnt-pto', 'mnt-pump', 'mnt-pto-group'];
var VE_MNT_STP_CIP = ['mnt-motor', 'mnt-gearbox', 'mnt-transfer', 'mnt-bracket', 'mnt-mount'];
// MALZEMELER — kütleyi hacimden türetmek için (yoğunluk kg/m³; el kitabı
// değerleri: çelik · EN-GJL · EN-GJS · alüminyum döküm · magnezyum döküm).
// Sıra seçicinin sırası; anahtar kayda yazılır.
var VE_MNT_STP_MALZEME = [
  { k: 'celik', ad: 'Çelik', rho: 7850 },
  { k: 'dokme', ad: 'Dökme demir', rho: 7200 },
  { k: 'sfero', ad: 'Sfero döküm', rho: 7100 },
  { k: 'aluminyum', ad: 'Alüminyum', rho: 2700 },
  { k: 'magnezyum', ad: 'Magnezyum', rho: 1800 }
];
function veMntStpMalzeme(k){
  for(var i = 0; i < VE_MNT_STP_MALZEME.length; i++) if(VE_MNT_STP_MALZEME[i].k === k) return VE_MNT_STP_MALZEME[i];
  return null;
}
// Ekrana giden sayı tek yazıcıdan (js/sayi.js, karar 7·C)
function _mstSayi(x, d){
  if(typeof veSayi === 'function') return veSayi(x, d);
  if(typeof require === 'function'){ try { return require('./sayi.js').veSayi(x, d); } catch(e){} }
  return String(x);
}

function _mstOkuyucu(){
  if(typeof veStepP21Agac === 'function')
    return { Agac: veStepP21Agac, Dilimli: (typeof veStepP21AgacDilimli === 'function') ? veStepP21AgacDilimli : null,
             Yuz: (typeof veStepP21Yuz === 'function') ? veStepP21Yuz : null,
             Kenar: (typeof veStepP21KenarCemberi === 'function') ? veStepP21KenarCemberi : null,
             Ozellik: (typeof veStepP21Ozellikler === 'function') ? veStepP21Ozellikler : null };
  if(typeof require === 'function'){
    try {
      var m = require('./step-p21.js');
      return { Agac: m.veStepP21Agac, Dilimli: m.veStepP21AgacDilimli, Yuz: m.veStepP21Yuz, Kenar: m.veStepP21KenarCemberi,
               Ozellik: m.veStepP21Ozellikler };
    } catch(e){ return null; }
  }
  return null;
}
function _mstUcgen(){
  if(typeof veStepUcgenBaglam === 'function')
    return { Baglam: veStepUcgenBaglam, Parca: veStepUcgenParca, Topla: veStepUcgenTopla, Tasi: veStepUcgenTasi, Birak: veStepUcgenBirak };
  if(typeof require === 'function'){
    try {
      var m = require('./step-ucgen.js');
      return { Baglam: m.veStepUcgenBaglam, Parca: m.veStepUcgenParca, Topla: m.veStepUcgenTopla, Tasi: m.veStepUcgenTasi, Birak: m.veStepUcgenBirak };
    } catch(e){ return null; }
  }
  return null;
}
function _mstSimdi(){
  return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
}

// OKUMA YÜZ TANIMI ÇIKARMAZ (`yuz: false`): Takoz parçayı üçgen ağından
// ölçer, analitik yüz tanımlarını okumuyor — 420 MB'ta okumanın en uzun
// evresiydi (7,4 sn). Girdi metin ya da bayt.
var VE_MNT_STP_OKUMA = { yuz: false };
function veMntStpOku(girdi){
  var P = _mstOkuyucu();
  if(!P || !P.Agac) return { ok: false, hatalar: ['STEP okuyucusu yüklenmemiş.'], uyarilar: [], agac: [], parcalar: [] };
  return P.Agac(girdi, VE_MNT_STP_OKUMA);
}
// Tarayıcıda, arayüzü kilitlemeden (js/step-p21.js → veStepP21AgacDilimli):
// baytlar (düz ya da sıkıştırılmış) → { sonuc: Promise<sonuç | null>, vazgec() };
// `ilerleme(o)` her dilimden sonra. Dilimli okuyucu yoksa null.
function veMntStpOkuDilimli(bayt, ilerleme){
  var P = _mstOkuyucu();
  if(!P || !P.Dilimli) return null;
  return P.Dilimli(bayt, { yuz: VE_MNT_STP_OKUMA.yuz, ilerleme: ilerleme });
}

// ── BİRİMLER — rollü düğümler; parça en yakın rollü ataya ait ─────────────
// Döner: [{ dugum, tip, ad, parcalar:[parça indisi] }] — ağaç sırasıyla.
function veMntStpBirimler(sonuc, roller){
  var out = [];
  if(!sonuc || !sonuc.agac) return out;
  var ag = sonuc.agac;
  var sahip = function(pi){
    for(var a = sonuc.parcalar[pi].dugum; a >= 0; a = ag[a].ebeveyn) if(roller[a]) return a;
    return -1;
  };
  ag.forEach(function(d){
    if(!roller[d.i]) return;
    out.push({ dugum: d.i, tip: roller[d.i], ad: d.ad,
               parcalar: d.parcalar.filter(function(pi){ return sahip(pi) === d.i; }) });
  });
  return out;
}

// ── KÜTLE ÖZELLİĞİ — kapalı üçgen ağından ─────────────────────────────────
// agler: [{ uc:Float32Array, ucgen:Uint32Array, kutu:[6], kenarYuz }]
// Tetrahedron (O', a, b, c) toplamı; O' = kutunun merkezi (büyük koordinatta
// kayan nokta kaybı olmasın). Döner:
//   { V [mm³], c [mm], J [mm⁵, merkez etrafında, tensör: Jxx=∫(y²+z²), Jxy=−∫xy],
//     kutu, kapali (üçgenlenemeyen yüz yok, açık kenar yok ve V > 0), kenarYuz, acik, ucgen }
// Açık kenar: köşeler konumdan kaynaştırılır (paylaşılan kenarın noktaları
// üçgenleyicide bit bit aynı — "KAPALI KATI"), bir kez kullanılan kenar sayılır.
// Köşe ve kenar sayısal karma tablolarda (açık adresleme): metin anahtarlı
// eşleme 420 MB'lık denemenin 4,5 milyon üçgeninde 8,5 sn sürüyordu.
function _mstKaynak(u){
  var q = 1e-6, nu = u.length / 3;
  var boy = 16; while(boy < nu * 2) boy *= 2;
  var maske = boy - 1, yuva = new Int32Array(boy).fill(-1), Q = new Float64Array(nu * 3), id = new Int32Array(nu), ilk = new Int32Array(nu), n = 0;
  for(var v = 0; v < nu; v++){
    var x = Math.round(u[v * 3] / q), y = Math.round(u[v * 3 + 1] / q), z = Math.round(u[v * 3 + 2] / q);
    var h = (Math.imul(x | 0, 73856093) ^ Math.imul(y | 0, 19349663) ^ Math.imul(z | 0, 83492791)) & maske;
    for(;;){
      var s = yuva[h];
      if(s < 0){ yuva[h] = n; Q[n * 3] = x; Q[n * 3 + 1] = y; Q[n * 3 + 2] = z; ilk[n] = v; id[v] = n++; break; }
      if(Q[s * 3] === x && Q[s * 3 + 1] === y && Q[s * 3 + 2] === z){ id[v] = s; break; }
      h = (h + 1) & maske;
    }
  }
  return { id: id, n: n, ilk: ilk };              // ilk: kaynaşan köşenin ilk örneği (konumu)
}
function _mstAcikSay(K, t){
  var id = K.id, n = K.n;
  var eb = 16; while(eb < t.length * 2) eb *= 2;
  var em = eb - 1, anahtar = new Float64Array(eb).fill(-1), say = new Uint32Array(eb);
  for(var j = 0; j < t.length; j += 3){
    var A = id[t[j]], B = id[t[j + 1]], C = id[t[j + 2]];
    if(A === B || B === C || A === C) continue;
    for(var e = 0; e < 3; e++){
      var p = e === 0 ? A : (e === 1 ? B : C), r = e === 0 ? B : (e === 1 ? C : A);
      var mn = p < r ? p : r, mx = p < r ? r : p, k = mn * n + mx;
      var g = (Math.imul(mn, 0x9E3779B1) ^ mx) & em;
      for(;;){
        var w = anahtar[g];
        if(w === -1){ anahtar[g] = k; say[g] = 1; break; }
        if(w === k){ say[g]++; break; }
        g = (g + 1) & em;
      }
    }
  }
  var acik = 0;
  for(var i = 0; i < eb; i++) if(say[i] === 1) acik++;
  return acik;
}
function _mstAcikKenar(a){ return _mstAcikSay(_mstKaynak(a.uc), a.ucgen); }
// Tetrahedron toplamı S'ye (O' etrafında): [V, Sx, Sy, Sz, xx, yy, zz, xy, xz, yz]
// — köşeler O', a, b, c (O'ya göre)
function _mstTetra(S, ax, ay, az, bx, by, bz, cx, cy, cz){
  var v = (ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)) / 6;
  S[0] += v;
  S[1] += v * (ax + bx + cx) / 4; S[2] += v * (ay + by + cy) / 4; S[3] += v * (az + bz + cz) / 4;
  // ∫ xᵢxⱼ dV = v/20 · [Σ aᵢaⱼ + (Σ aᵢ)(Σ aⱼ)]
  var Sx = ax + bx + cx, Sy = ay + by + cy, Sz = az + bz + cz;
  S[4] += v / 20 * (ax * ax + bx * bx + cx * cx + Sx * Sx);
  S[5] += v / 20 * (ay * ay + by * by + cy * cy + Sy * Sy);
  S[6] += v / 20 * (az * az + bz * bz + cz * cz + Sz * Sz);
  S[7] += v / 20 * (ax * ay + bx * by + cx * cy + Sx * Sy);
  S[8] += v / 20 * (ax * az + bx * bz + cx * cz + Sx * Sz);
  S[9] += v / 20 * (ay * az + by * bz + cy * cz + Sy * Sz);
}
function _mstIntegral(u, t, o, S){
  for(var k = 0; k < t.length; k += 3){
    var i = t[k] * 3, j = t[k + 1] * 3, m = t[k + 2] * 3;
    _mstTetra(S, u[i] - o[0], u[i + 1] - o[1], u[i + 2] - o[2], u[j] - o[0], u[j + 1] - o[1], u[j + 2] - o[2],
              u[m] - o[0], u[m + 1] - o[1], u[m + 2] - o[2]);
  }
  return S;
}
// Yön: kapalı ve doğru yönlü ağda V > 0. Ters yönlüde bütün integraller
// birlikte işaret değiştirir — ölçek işaretle düzeltilir. Döner { V, c, J } (V ≤ 0: c, J null)
function _mstHacimSonuc(S, o){
  var isaret = S[0] < 0 ? -1 : 1, V = S[0] * isaret;
  if(!(V > 1e-9)) return { V: V, c: null, J: null };
  var cl = [S[1] * isaret / V, S[2] * isaret / V, S[3] * isaret / V];
  var xx = S[4] * isaret, yy = S[5] * isaret, zz = S[6] * isaret, xy = S[7] * isaret, xz = S[8] * isaret, yz = S[9] * isaret;
  // Merkez etrafında (paralel eksen): ∫ xᵢxⱼ − V cᵢcⱼ
  var Mxx = xx - V * cl[0] * cl[0], Myy = yy - V * cl[1] * cl[1], Mzz = zz - V * cl[2] * cl[2];
  var Mxy = xy - V * cl[0] * cl[1], Mxz = xz - V * cl[0] * cl[2], Myz = yz - V * cl[1] * cl[2];
  return { V: V, c: [cl[0] + o[0], cl[1] + o[1], cl[2] + o[2]],
           J: [[Myy + Mzz, -Mxy, -Mxz], [-Mxy, Mxx + Mzz, -Myz], [-Mxz, -Myz, Mxx + Myy]] };
}
function veMntStpAgOzellik(agler){
  var kutu = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity], kenarYuz = 0, ucgenSay = 0, acik = 0;
  (agler || []).forEach(function(a){
    if(!a) return;
    for(var i = 0; i < 3; i++){ kutu[i] = Math.min(kutu[i], a.kutu[i]); kutu[i + 3] = Math.max(kutu[i + 3], a.kutu[i + 3]); }
    kenarYuz += a.kenarYuz || 0;
    if(a.uc && a.ucgen) acik += _mstAcikKenar(a);
  });
  if(!(kutu[3] >= kutu[0])) return { V: 0, c: null, J: null, kutu: null, kapali: false, kenarYuz: kenarYuz, acik: acik, ucgen: 0 };
  var o = [(kutu[0] + kutu[3]) / 2, (kutu[1] + kutu[4]) / 2, (kutu[2] + kutu[5]) / 2], S = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  (agler || []).forEach(function(a){
    if(!a || !a.ucgen) return;
    _mstIntegral(a.uc, a.ucgen, o, S);
    ucgenSay += a.ucgen.length / 3;
  });
  var H = _mstHacimSonuc(S, o);
  return { V: H.V, c: H.c, J: H.J, kutu: kutu, kapali: (kenarYuz === 0) && (acik === 0) && !!H.c,
           kenarYuz: kenarYuz, acik: acik, ucgen: ucgenSay };
}

// ── PARÇA PARÇA — kütle özelliği ve birimin toplamı (Takoz adım 6) ────────
// Dosyanın parça özellikleri (doğrulama · yoğunluk · malzeme): bir kez, sonuçta saklı
function veMntStpDosyaOzellik(sonuc){
  if(sonuc && sonuc._ozellik) return sonuc._ozellik;
  var P = _mstOkuyucu(), o = {};
  if(P && P.Ozellik && sonuc && sonuc._model){ try { o = P.Ozellik(sonuc._model) || {}; } catch(e){ o = {}; } }
  if(sonuc && sonuc.ok) sonuc._ozellik = o;
  return o;
}
function _mstAlan(u, t){
  var A = 0;
  for(var k = 0; k < t.length; k += 3){
    var i = t[k] * 3, j = t[k + 1] * 3, m = t[k + 2] * 3;
    var ax = u[j] - u[i], ay = u[j + 1] - u[i + 1], az = u[j + 2] - u[i + 2];
    var bx = u[m] - u[i], by = u[m + 1] - u[i + 1], bz = u[m + 2] - u[i + 2];
    var cx = ay * bz - az * by, cy = az * bx - ax * bz, cz = ax * by - ay * bx;
    A += Math.sqrt(cx * cx + cy * cy + cz * cz) / 2;
  }
  return A;
}
function _mstAgAlan(a){ return (a && a.uc && a.ucgen) ? _mstAlan(a.uc, a.ucgen) : 0; }
// GÖVDE GÖVDE: parçanın katı gövdeleri ayrı ölçülür (okuyucunun `govde`si ·
// toplayıcının `yuzUcgen`i); yüzey gövdesi (−1) hacme ve paya girmez. Gerçek
// dosyada motor, şanzıman ve transfer TEK parçada yüzlerce katı ve açık
// yüzey kabuğu: tek çatlak bütün parçayı düşürüyordu. Açık katı gövde
// YAMALANIR (_mstYamaKur) ve yamanın alanı gövde alanının VE_MNT_STP_YAMA
// payını aşmıyorsa hacme katılır; aşan gövde dışarıda, alanıyla. Katısız
// parçada (gövde bilgisi yok) bütün ağ tek gövde, yamasız.
// Eşik: dosyada 240 yüz üçgen vermiyor, 215'inin kutusu 10 mm'den küçük (çoğu
// sıfır alanlı döngü) — yama onları birebir kapatır; gövdeyi dışarıda bırakmak
// hacminin tamamını kaybetmektir. Yaması kendi yüzeyinin %10'unu aşan gövde
// (ters çevrilemeyen hortum yüzeyi: %85–%490) dışarıda.
var VE_MNT_STP_YAMA = 0.1;
// Yama: katı gövde dosyada KAPALIDIR, ağındaki açıklık üçgenlemenin kusuru
// (çatlak · üçgen vermeyen yüz). Kenarların NET yönlü sayısı ağın sınırıdır
// ve her köşede giren = çıkan (üçgen kümesinin sınırı bir döngüdür): sınır,
// yama yönünde ve çokluğuyla `kenar`da ([s, d, s, d, …]); halkalara dizilir,
// her halka ağırlık merkezinden yelpazeyle kapatılır ve S'ye eklenir.
// Döner: yamanın alanı.
function _mstYamaKur(u, K, kenar, o, S){
  var cik = new Map(), alan = 0, i;
  for(i = 0; i < kenar.length; i += 2) (cik.get(kenar[i]) || cik.set(kenar[i], []).get(kenar[i])).push(kenar[i + 1]);
  var P = function(v){ var j = K.ilk[v] * 3; return [u[j] - o[0], u[j + 1] - o[1], u[j + 2] - o[2]]; };
  cik.forEach(function(l, bas){
    while(l.length){
      var halka = [bas], v = l.pop();
      while(v !== bas){ halka.push(v); var l2 = cik.get(v); if(!l2 || !l2.length) break; v = l2.pop(); }
      var c = [0, 0, 0], pts = halka.map(P);
      pts.forEach(function(p){ c[0] += p[0] / pts.length; c[1] += p[1] / pts.length; c[2] += p[2] / pts.length; });
      for(var k = 0; k < pts.length; k++){
        var p = pts[k], q = pts[(k + 1) % pts.length];
        _mstTetra(S, c[0], c[1], c[2], p[0], p[1], p[2], q[0], q[1], q[2]);
        var ux = p[0] - c[0], uy = p[1] - c[1], uz = p[2] - c[2], wx = q[0] - c[0], wy = q[1] - c[1], wz = q[2] - c[2];
        var nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
        alan += Math.sqrt(nx * nx + ny * ny + nz * nz) / 2;
      }
    }
  });
  return alan;
}

// ── PARÇANIN KÜTLE ÖZELLİĞİ — DİLİMLİ İŞ ─────────────────────────────────
// UZUN İŞ ARAYÜZÜ KİLİTLEMEZ: ağ işinin diliminde koşar (veMntStpAgIs). Gerçek
// dosyada tek parça 915 bin üçgen (şanzıman) ve gövde gövde hesap tek seferde
// 846 ms sürüyordu. Evreler: köşe kaynağı → gövde gövde (integral · alan · net
// yönlü kenar) → sınırın taranması ve yama → toplam. adim(bitis): saat
// bitis'i geçince döner; iş bitince true (sonuç is.sonuc). adimBoy: saatin
// sorulma aralığı (üçgen · köşe; varsayılan VE_MNT_STP_OZ_ADIM) — her çağrı en
// az o kadar öğe işler, saat geçmiş olsa da (yoksa iş ilerlemez).
var VE_MNT_STP_OZ_ADIM = 2048;
function veMntStpParcaOzellikIs(sonuc, pi, ag, adimBoy){
  var is = { pi: pi, sonuc: null }, ADIM = adimBoy > 0 ? adimBoy : VE_MNT_STP_OZ_ADIM;
  var g = sonuc._geo && sonuc._geo[pi], u = ag && ag.uc, t = ag && ag.ucgen;
  if(!u || !t || !ag.kutu){
    is.adim = function(){ is.sonuc = _mstParcaSonuc(sonuc, pi, ag, null, null); return true; };
    return is;
  }
  var G = g && g.govde, Y = ag.yuzUcgen, n = 0, f, b;
  var govdeli = !!(G && Y && Y.length === G.length + 1);
  if(govdeli){ for(f = 0; f < G.length; f++) if(G[f] + 1 > n) n = G[f] + 1; govdeli = n > 0; }
  // Gövdenin yüzleri (katısızda tek gövde: bütün üçgenler, yüz listesi yok)
  var yuz = [], tri = [], bos = [];
  if(govdeli){
    var say = new Int32Array(n);
    for(f = 0; f < G.length; f++) if(G[f] >= 0) say[G[f]]++;
    for(b = 0; b < n; b++){ yuz.push(new Int32Array(say[b])); tri.push(0); bos.push(0); say[b] = 0; }
    for(f = 0; f < G.length; f++){
      if((b = G[f]) < 0) continue;
      yuz[b][say[b]++] = f;
      tri[b] += Y[f + 1] - Y[f];
      if(Y[f + 1] === Y[f]) bos[b]++;                     // üçgen vermeyen yüz
    }
  } else { n = 1; tri.push(t.length / 3); bos.push(ag.kenarYuz || 0); }
  var k = ag.kutu, o = [(k[0] + k[3]) / 2, (k[1] + k[4]) / 2, (k[2] + k[5]) / 2];
  var nu = u.length / 3, boy = 16; while(boy < nu * 2) boy *= 2;
  var K = { id: new Int32Array(nu), ilk: new Int32Array(nu), n: 0 };
  var kyuva = new Int32Array(boy).fill(-1), kQ = new Float64Array(nu * 3), kmaske = boy - 1, kv = 0;
  var evre = 'kaynak', sonuclar = [], B = null;
  function govdeBasla(b){
    var eb = 16; while(eb < tri[b] * 3) eb *= 2;
    B = { b: b, S: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], alan: 0, yi: 0, ti: 0, te: 0,
          anahtar: new Float64Array(eb).fill(-1), net: new Int32Array(eb), maske: eb - 1, tara: 0, kenar: [] };
    if(!govdeli){ B.ti = 0; B.te = t.length; }
  }
  function kenarEkle(a, c){
    if(a === c) return;
    var mn = a < c ? a : c, mx = a < c ? c : a, key = mn * K.n + mx, h = (Math.imul(mn, 0x9E3779B1) ^ mx) & B.maske;
    for(;;){
      var w = B.anahtar[h];
      if(w === -1){ B.anahtar[h] = key; B.net[h] = a < c ? 1 : -1; return; }
      if(w === key){ B.net[h] += a < c ? 1 : -1; return; }
      h = (h + 1) & B.maske;
    }
  }
  is.adim = function(bitis){
    var q = 1e-6, sayac = 0, i;
    for(;;){
      if(evre === 'kaynak'){
        for(; kv < nu; kv++){
          if(sayac++ >= ADIM){ sayac = 1; if(_mstSimdi() > bitis) return false; }
          var x = Math.round(u[kv * 3] / q), y = Math.round(u[kv * 3 + 1] / q), z = Math.round(u[kv * 3 + 2] / q);
          var h = (Math.imul(x | 0, 73856093) ^ Math.imul(y | 0, 19349663) ^ Math.imul(z | 0, 83492791)) & kmaske;
          for(;;){
            var s0 = kyuva[h];
            if(s0 < 0){ kyuva[h] = K.n; kQ[K.n * 3] = x; kQ[K.n * 3 + 1] = y; kQ[K.n * 3 + 2] = z; K.ilk[K.n] = kv; K.id[kv] = K.n++; break; }
            if(kQ[s0 * 3] === x && kQ[s0 * 3 + 1] === y && kQ[s0 * 3 + 2] === z){ K.id[kv] = s0; break; }
            h = (h + 1) & kmaske;
          }
        }
        kyuva = kQ = null;
        evre = 'govde';
        govdeBasla(0);
      }
      if(evre === 'govde'){
        // gövdenin üçgenleri: integral, alan, net yönlü kenar
        for(;;){
          if(B.ti >= B.te){
            if(!govdeli || B.yi >= yuz[B.b].length) break;
            f = yuz[B.b][B.yi++];
            B.ti = Y[f] * 3; B.te = Y[f + 1] * 3;
            continue;
          }
          if(sayac++ >= ADIM){ sayac = 1; if(_mstSimdi() > bitis) return false; }
          var i0 = t[B.ti], i1 = t[B.ti + 1], i2 = t[B.ti + 2];
          B.ti += 3;
          var a0 = i0 * 3, a1 = i1 * 3, a2 = i2 * 3;
          var ax = u[a0] - o[0], ay = u[a0 + 1] - o[1], az = u[a0 + 2] - o[2];
          var bx = u[a1] - o[0], by = u[a1 + 1] - o[1], bz = u[a1 + 2] - o[2];
          var cx = u[a2] - o[0], cy = u[a2 + 1] - o[1], cz = u[a2 + 2] - o[2];
          _mstTetra(B.S, ax, ay, az, bx, by, bz, cx, cy, cz);
          var ex = bx - ax, ey = by - ay, ez = bz - az, fx = cx - ax, fy = cy - ay, fz = cz - az;
          var nx = ey * fz - ez * fy, ny = ez * fx - ex * fz, nz = ex * fy - ey * fx;
          B.alan += Math.sqrt(nx * nx + ny * ny + nz * nz) / 2;
          var k0 = K.id[i0], k1 = K.id[i1], k2 = K.id[i2];
          kenarEkle(k0, k1); kenarEkle(k1, k2); kenarEkle(k2, k0);
        }
        evre = 'tara';
      }
      if(evre === 'tara'){
        // sınır: net ≠ 0 kenarlar, yama yönünde (üçgeninkinin tersi) ve çokluğuyla
        for(; B.tara < B.anahtar.length; B.tara++){
          if(sayac++ >= ADIM * 8){ sayac = 1; if(_mstSimdi() > bitis) return false; }
          var m = B.net[B.tara];
          if(!m || B.anahtar[B.tara] === -1) continue;
          var key = B.anahtar[B.tara], mn = Math.floor(key / K.n), mx = key - mn * K.n;
          for(var c2 = Math.abs(m); c2 > 0; c2--){ if(m > 0) B.kenar.push(mx, mn); else B.kenar.push(mn, mx); }
        }
        var yama = 0;
        if(govdeli && (B.kenar.length || bos[B.b])) yama = _mstYamaKur(u, K, B.kenar, o, B.S);
        var H = _mstHacimSonuc(B.S, o);
        var r = { V: H.V, c: H.c, J: H.J, acik: B.kenar.length / 2, kenarYuz: bos[B.b], alan: B.alan, yama: yama };
        r.kapali = !r.kenarYuz && !r.acik && !!H.c;
        r.dahil = !!H.c && (r.kapali || (govdeli && r.yama <= VE_MNT_STP_YAMA * r.alan));
        sonuclar.push(r);
        if(B.b + 1 < n){ govdeBasla(B.b + 1); evre = 'govde'; continue; }
        B = null;
        is.sonuc = _mstParcaSonuc(sonuc, pi, ag, sonuclar, govdeli);
        return true;
      }
    }
  };
  return is;
}
// Parçanın kütle özelliği, birim yoğunlukla: { pi, ad, V, c, J (kendi merkezi
// etrafında, mm⁵), alan, kutu, kaynak: 'ag' | 'dosya' | 'acik', nokta (hacim
// dosyadan, ağı açık: tensörü yok), rho?, malzeme?, sapma?: { c (mm), V (oran) }
// — dosyanın hacmi/merkezi ile kapalı ağınki; gövdeli parçada govde (katı
// sayısı), acikGovde · acikAlan (hacme katılmayan gövdeler ve alanları; `alan`
// katılarınki), yamaGovde · yamaAlan (yamayla katılanlar) }. Dilimli işin
// (veMntStpParcaOzellikIs) tek çağrıda koşusu.
function veMntStpParcaOzellik(sonuc, pi, ag){
  var is = veMntStpParcaOzellikIs(sonuc, pi, ag);
  while(!is.adim(Infinity));
  return is.sonuc;
}
// G: gövdelerin sonuçları (katısızda tek gövde) ya da null (ağ yok)
function _mstParcaSonuc(sonuc, pi, ag, G, govdeli){
  var g = sonuc._geo && sonuc._geo[pi], f = g && g.pd ? veMntStpDosyaOzellik(sonuc)[g.pd] : null;
  var r = { pi: pi, ad: sonuc.parcalar[pi].ad, V: 0, c: null, J: null, kutu: (ag && ag.kutu) || null, kaynak: 'acik',
            alan: 0, acikKenar: 0, kenarYuz: (ag && ag.kenarYuz) || 0, ucgen: ag && ag.ucgen ? ag.ucgen.length / 3 : 0 };
  var kapali = false, oz = null;
  if(G){
    var dahil = G.filter(function(x){ return x.dahil; }), H = _mstTopla(dahil, function(){ return 1; });
    kapali = !!H && G.every(function(x){ return x.kapali; });
    r.alan = G.reduce(function(s, x){ return s + x.alan; }, 0);
    r.acikKenar = G.reduce(function(s, x){ return s + x.acik; }, 0);
    r.kenarYuz = G.reduce(function(s, x){ return s + x.kenarYuz; }, 0);
    if(govdeli){
      r.govde = G.length;
      r.acikGovde = G.filter(function(x){ return !x.dahil; }).length;
      r.acikAlan = G.reduce(function(s, x){ return s + (x.dahil ? 0 : x.alan); }, 0);
      r.yamaGovde = G.filter(function(x){ return x.dahil && !x.kapali; }).length;
      r.yamaAlan = G.reduce(function(s, x){ return s + (x.dahil ? x.yama : 0); }, 0);
    }
    if(H){ r.kaynak = 'ag'; r.V = H.W; r.c = H.c; r.J = H.T; oz = H; }
  }
  if(f && f.hacim > 0 && f.merkez && g.M){
    var R = g.M.R, t = g.M.t, q = f.merkez;
    var cw = [0, 1, 2].map(function(i){ return R[i][0] * q[0] + R[i][1] * q[1] + R[i][2] * q[2] + t[i]; });
    if(kapali) r.sapma = { c: _mstUz(oz.c, cw), V: Math.abs(oz.W - f.hacim) / f.hacim };
    else { r.nokta = true; r.J = null; }                  // açık gövdeli ağın tensörü dosyanın hacmini tutmaz
    r.kaynak = 'dosya'; r.V = f.hacim; r.c = cw;
  }
  if(f && f.yogunluk > 0) r.rho = f.yogunluk;
  if(f && f.malzeme) r.malzeme = f.malzeme;
  return r;
}
// Parçaların toplamı (ağırlık w = ρ·V): merkez Σw·c / Σw, tensör
// Σρ·(J + V·(|d|²·E − d·dᵀ)), d = c − merkez — J'nin işaret kuralıyla
// (Ixy = −∫xy). ρ = 1: hacim (mm³), hacim merkezi, birim yoğunluk tensörü
// (mm⁵); ρ kg/mm³: kütle (kg), kütle merkezi, tensör (kg·mm²).
function _mstTopla(parcalar, rho){
  var W = 0, s = [0, 0, 0];
  parcalar.forEach(function(p){
    if(!(p.V > 0)) return;
    var w = rho(p) * p.V;
    W += w; s[0] += w * p.c[0]; s[1] += w * p.c[1]; s[2] += w * p.c[2];
  });
  if(!(W > 0)) return null;
  var c = [s[0] / W, s[1] / W, s[2] / W], T = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  parcalar.forEach(function(p){
    if(!(p.V > 0)) return;
    var q = rho(p), d = [p.c[0] - c[0], p.c[1] - c[1], p.c[2] - c[2]], dd = _mstNok(d, d);
    for(var i = 0; i < 3; i++) for(var j = 0; j < 3; j++)
      T[i][j] += q * ((p.J ? p.J[i][j] : 0) + p.V * ((i === j ? dd : 0) - d[i] * d[j]));
  });
  return { W: W, c: c, T: T };
}

// Bir parçanın görüntü ağı — üçgenleyici (önbellek çağıranın: opt.ag).
function veMntStpParcaAgi(sonuc, pi, baglam){
  var U = _mstUcgen(), g = sonuc && sonuc._geo && sonuc._geo[pi];
  if(!U || !g || !g.yuzler || !g.yuzler.length) return null;
  var B = baglam || U.Baglam(sonuc._model, VE_MNT_STP_UCGEN);
  return U.Parca(B, g.yuzler, g.M, g.birim, g.ters);
}

// ── AĞ İŞİ — parçaların görüntü ağı, parça parça ─────────────────────────
// TEK ÜRETİCİ: 3B görüntüleyici bütün montajı (`tum`), hesap rol verilen
// birimlerin parçalarını (`iste`, öne alınır) ister; ikisi de aynı önbelleğe
// (`ag` — sihirbazın s.ag'si) yazar. İş yüz yüze ilerler ve her yüzden sonra
// saati sorar: `adim(bitis)` saat `bitis`i geçince döner (true: istenen kalmadı).
//  • Bağlamın ara verisi PARÇA BİTİNCE bırakılır (veStepUcgenBirak): tek bağlam
//    bütün montajda birikince 420 MB'lık dosyada yığın 3,2 GB'a çıkıyordu.
//  • Aynı temsilin (`sr`) birden çok örneği varsa yerel ağı BİR KEZ üçgenlenir,
//    kalan örneklere taşınır (bit bit aynı) ve son örnekle bırakılır.
//  • `bitti(i, a)` her parça bitince (görüntüleyici çizimine ekler); `oz`
//    verilirse parçanın kütle özelliği de (veMntStpParcaOzellik) aynı dilimde.
// İş: { iste(liste), uret(liste), tum (bool), adim(bitis), eksik(liste), say, sonraki() }
function _mstSekil(g){
  return g && g.sr ? g.sr + '@' + g.birim.mm + '@' + g.birim.derece : null;
}
function _mstYuzlu(g){ return !!(g && g.yuzler && g.yuzler.length && g.birim && g.birim.mm > 0); }
function veMntStpAgIs(sonuc, ag, secenek){
  var U = _mstUcgen(), geo = (sonuc && sonuc._geo) || [];
  var J = { sonuc: sonuc, ag: ag, U: U, B: null, tum: false, imlec: 0, oncelik: [], oi: 0, cur: null,
            paylas: {}, kalan: {}, bitti: (secenek && secenek.bitti) || null, oz: (secenek && secenek.oz) || null,
            say: { parca: 0, yuz: 0, ucgen: 0, parcaToplam: 0, yuzToplam: 0 } };
  geo.forEach(function(g, i){
    if(!_mstYuzlu(g)) return;
    J.say.parcaToplam++; J.say.yuzToplam += g.yuzler.length;
    if(ag[i]){ J.say.parca++; J.say.yuz += g.yuzler.length; return; }
    var key = _mstSekil(g);
    if(key) J.kalan[key] = (J.kalan[key] || 0) + 1;
  });
  // Öncelikli istek (hesap) — öncekinin yerine geçer; [] isteği düşürür
  J.iste = function(liste){ J.oncelik = (liste || []).slice(); J.oi = 0; };
  // Listedeki eksik ağları EŞZAMANLI üretir; süren istekler (bütün montaj,
  // öncelikli liste) sonra kaldığı yerden sürer
  J.uret = function(liste){
    var tum = J.tum, onc = J.oncelik, oi = J.oi;
    J.tum = false; J.oncelik = (liste || []).slice(); J.oi = 0;
    while(!_mstAgAdim(J, Infinity));
    J.tum = tum; J.oncelik = onc; J.oi = oi;
  };
  // Eksik: ağı ya da (istenmişse) kütle özelliği henüz olmayan parça
  var lazim = function(i){ return _mstYuzlu(geo[i]) && (!J.ag[i] || (J.oz && !J.oz[i])); };
  J.eksik = function(liste){
    var n = 0;
    (liste || []).forEach(function(i){ if(lazim(i)) n++; });
    return n;
  };
  // Sıradaki parça: önce istenenler, sonra (bütün montaj isteniyorsa) ağaç sırası
  J.sonraki = function(){
    var i;
    while(J.oi < J.oncelik.length){
      i = J.oncelik[J.oi++];
      if(lazim(i)) return i;
    }
    if(J.oi) { J.oncelik = []; J.oi = 0; }
    if(!J.tum) return -1;
    while(J.imlec < geo.length){
      i = J.imlec++;
      if(lazim(i)) return i;
    }
    return -1;
  };
  J.adim = function(bitis){ return _mstAgAdim(J, bitis); };
  return J;
}
function _mstAgKoy(J, i, a, key){
  var g = J.sonuc._geo[i];
  J.ag[i] = a;
  if(key && J.kalan[key] !== undefined && --J.kalan[key] <= 0){ delete J.kalan[key]; delete J.paylas[key]; }
  J.say.parca++; J.say.yuz += g.yuzler.length; J.say.ucgen += a.ucgen.length / 3;
  // Parçanın kütle özelliği ağıyla AYNI işte, dilim dilim (secenek.oz — hesabın
  // önbelleği): hesap ağlar bitince yalnız toplar (420 MB'lık denemede ilk hesap
  // 961 ms'ydi); ağ önce 3B'ye gider
  if(J.oz && !J.oz[i]) J.ozIs = veMntStpParcaOzellikIs(J.sonuc, i, a);
  if(J.bitti) J.bitti(i, a);
}
function _mstAgAdim(J, bitis){
  var geo = J.sonuc._geo, U = J.U;
  if(!U) return true;
  for(;;){
    if(J.ozIs){
      if(!J.ozIs.adim(bitis)) return false;
      J.oz[J.ozIs.pi] = J.ozIs.sonuc;
      J.ozIs = null;
      if(_mstSimdi() > bitis) return false;
      continue;
    }
    if(!J.cur){
      var i = J.sonraki();
      if(i < 0) return true;
      if(J.ag[i]){ J.ozIs = veMntStpParcaOzellikIs(J.sonuc, i, J.ag[i]); continue; }   // ağı var, özelliği yok
      var g = geo[i], key = _mstSekil(g);
      if(key && J.paylas[key]){                    // aynı şeklin örneği: taşınır
        _mstAgKoy(J, i, U.Tasi(J.paylas[key], g.M), key);
        if(_mstSimdi() > bitis) return false;
        continue;
      }
      if(!J.B) J.B = U.Baglam(J.sonuc._model, VE_MNT_STP_UCGEN);
      J.cur = { i: i, key: key, topla: U.Topla(J.B, g.M, g.birim), j: 0, ters: null };
      if(g.ters){ J.cur.ters = new Uint8Array(g.yuzler.length); g.ters.forEach(function(k){ J.cur.ters[k] = 1; }); }
    }
    var c = J.cur, yz = geo[c.i].yuzler;
    while(c.j < yz.length){
      // Yüz de, parçanın sonu da dilim dilim (ekleAdim · bitirAdim): yarım
      // kalan iş sonraki dilimde sürer — tek yüz bir dilimi 0,8 sn tutuyordu
      if(!c.topla.ekleAdim(yz[c.j], !!(c.ters && c.ters[c.j]), bitis)) return false;
      c.j++;
      if(c.j < yz.length && _mstSimdi() > bitis) return false;
    }
    var tut = !!(c.key && J.kalan[c.key] > 1);
    var a = c.topla.bitirAdim(bitis, { yerel: tut });
    if(!a) return false;
    if(tut) J.paylas[c.key] = a.yerel;
    delete a.yerel;
    U.Birak(J.B);
    J.cur = null;
    _mstAgKoy(J, c.i, a, c.key);
    if(_mstSimdi() > bitis) return false;
  }
}
// Eksik ağları EŞZAMANLI üretir (dilimsiz yol: küçük montaj, testler) — aynı
// iş, ayrı örnek: bağlam parça başına bırakılır, şekil paylaşılır.
function veMntStpAgUret(sonuc, ag, liste){
  veMntStpAgIs(sonuc, ag).uret(liste);
  return ag;
}

// ── ROL VERMEK — rol bir DÜĞÜME verilir, parça TEK birime aittir ──────────
// Roller iç içe olabilir: parça EN YAKIN rollü atasının birimindedir
// (veMntStpBirimler) — gerçek dosyada takozlar ve transfer braketleri motor
// alt montajının içinde. AYNI rol iç içe olmaz: düğümün atalarındaki ve
// torunlarındaki aynı rol düşer (motor alt montajına motor verilince
// parçasının ayrı motor rolü kalmaz). Oturumun rolü ve kaydın geri gelişi
// aynı kuralla (aşağıda). `roller` yerinde değişir; döner: true.
function veMntStpRolVer(sonuc, roller, i, tip){
  var a = sonuc && sonuc.agac;
  if(!a || !(i >= 0 && i < a.length) || (tip && VE_MNT_STP_ROLLER.indexOf(tip) < 0)) return false;
  if(tip){
    for(var e = a[i].ebeveyn; e >= 0; e = a[e].ebeveyn) if(roller[e] === tip) roller[e] = null;
    (function sil(d){ a[d].cocuklar.forEach(function(c){ if(roller[c] === tip) roller[c] = null; sil(c); }); })(i);
  }
  roller[i] = tip || null;
  return true;
}

// ── ROL KAYDI — roller projeyle, STEP'siz (2026-10-20, Takoz adım 4) ─────
// Proje STEP'i TAŞIMAZ (gerçek dosya 400 MB): 3D Görüntüleyici'nin verisine
// yalnız rol verilen düğümlerin ÖRNEK YOLU (kökten düğüme örnek adları —
// CATIA'nın "Motor.1"leri), rolü, adı ve kütlesi yazılır. Aynı dosya
// açılınca roller YOLDAN geri gelir: indis değil yol, çünkü yeniden dışa
// aktarılan dosyada varlık kimlikleri ve sıra değişir, örnek adları kalır.
// İMZA ağacın biçimidir (örnek adı · ürün kimliği · ebeveyn · parça sayısı):
// aynı imza aynı montaj.
var VE_MNT_STP_KAYIT_SURUM = 1;
function veMntStpYol(sonuc, i){
  var a = sonuc.agac, yol = [];
  for(var d = i; d >= 0 && a[d]; d = a[d].ebeveyn) if(a[d].derinlik > 0) yol.unshift(a[d].ornek);
  return yol;
}
// Düğüm başına yol anahtarı (kökten aşağı; okuyucunun anahtarıyla aynı ayraç)
function _mstYolAnahtarlari(sonuc){
  var a = sonuc.agac, k = new Array(a.length);
  for(var i = 0; i < a.length; i++){
    var d = a[i];
    k[i] = d.ebeveyn >= 0 ? (a[d.ebeveyn].derinlik > 0 ? k[d.ebeveyn] + '\u0001' : '') + d.ornek : (d.derinlik > 0 ? d.ornek : '');
  }
  return k;
}
// Yol → düğüm dizini (ilk eşleşen); okumanın ağacı değişmez, sonuçta saklanır
function _mstYolDizin(sonuc){
  if(sonuc && sonuc._yolDizin) return sonuc._yolDizin;
  var anahtar = _mstYolAnahtarlari(sonuc), dizin = {};
  for(var i = 0; i < anahtar.length; i++) if(dizin[anahtar[i]] === undefined) dizin[anahtar[i]] = i;
  if(sonuc && sonuc.ok) sonuc._yolDizin = dizin;
  return dizin;
}
function _mstFnv(s, h){
  for(var i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h >>> 0;
}
// Okumanın ağacı değişmez: imza sonuca bir kez yazılır (kayıt her rol
// değişiminde yazılıyor — imza her seferinde bütün ağacı dolaşmasın).
function veMntStpImza(sonuc){
  if(sonuc && sonuc._imza) return sonuc._imza;
  var a = (sonuc && sonuc.agac) || [], h = 0x811c9dc5;
  for(var i = 0; i < a.length; i++)
    h = _mstFnv(a[i].ornek + '\u0001' + a[i].id + '\u0001' + a[i].ebeveyn + '\u0001' + a[i].parcalar.length + '\u0002', h);
  var imza = ('0000000' + h.toString(16)).slice(-8) + '-' + a.length + '-' + ((sonuc && sonuc.parcalar) || []).length;
  if(sonuc && sonuc.ok) sonuc._imza = imza;
  return imza;
}
// Kayıt: { surum, dosya, bayt, imza, parca, roller:[{ yol, rol, ad, kg?, yog?, nokta? }] } — ağaç sırasıyla.
// `yog` (gövde): kütle kaynağı — 'dosya' ya da malzeme anahtarı (elle: yok).
// `nokta` (takoz): 3B'de seçilen daire — parçasının örnek yolu, merkezi, yarıçapı.
function veMntStpRolKaydi(sonuc, roller, kutle, kunye, nokta, yogunluk){
  kunye = kunye || {}; kutle = kutle || {}; nokta = nokta || {}; yogunluk = yogunluk || {};
  var out = { surum: VE_MNT_STP_KAYIT_SURUM, dosya: kunye.dosya || '', bayt: kunye.bayt > 0 ? kunye.bayt : null,
              imza: veMntStpImza(sonuc), parca: ((sonuc && sonuc.parcalar) || []).length, roller: [] };
  ((sonuc && sonuc.agac) || []).forEach(function(d){
    var tip = roller[d.i];
    if(!tip) return;
    var r = { yol: veMntStpYol(sonuc, d.i), rol: tip, ad: d.ad };
    if(+kutle[d.i] > 0) r.kg = +kutle[d.i];
    if(tip !== 'mnt-mount' && _mstYogGecerli(yogunluk[d.i])) r.yog = yogunluk[d.i];
    var n = tip === 'mnt-mount' ? _mstNoktaGecerli(nokta[d.i]) : null;
    if(n) r.nokta = n;
    out.roller.push(r);
  });
  return out;
}
function _mstYogGecerli(y){ return y === 'dosya' || !!veMntStpMalzeme(y); }
// Seçilen dairenin kaydı: { yol:[örnek adları], c:[3], r } ya da null (bozuk)
function _mstNoktaGecerli(n){
  if(!n || !Array.isArray(n.yol) || !Array.isArray(n.c) || n.c.length !== 3) return null;
  var c = n.c.map(Number), r = +n.r;
  if(!c.every(isFinite) || !(r > 0)) return null;
  return { yol: n.yol.map(String), c: c, r: r };
}
// Kaydı bu dosyaya uygular. Döner: { roller (ağaç boyu), kutle:{düğüm: kg},
// yogunluk:{düğüm: kaynak}, nokta:{düğüm: seçilen daire}, eslesen, toplam,
// eksik:[bulunamayan kayıt satırı], ayni (imza aynı) }. Rol veriliş kuralı oturumunki (veMntStpRolVer)
// — kayıt sırası ağaç sırası. Dairenin bu dosyada olup olmadığına hesap bakar
// (veMntStpCoz → veMntStpDaireBul).
function veMntStpRolKaydiUygula(sonuc, kayit){
  var a = (sonuc && sonuc.agac) || [], roller = a.map(function(){ return null; }), kutle = {}, nokta = {}, yog = {};
  var out = { roller: roller, kutle: kutle, yogunluk: yog, nokta: nokta, eslesen: 0, toplam: 0, eksik: [], ayni: false };
  if(!kayit || !Array.isArray(kayit.roller)) return out;
  out.toplam = kayit.roller.length;
  out.ayni = kayit.imza === veMntStpImza(sonuc);
  var dizin = _mstYolDizin(sonuc);
  kayit.roller.forEach(function(r){
    var d = (r && Array.isArray(r.yol)) ? dizin[r.yol.join('\u0001')] : undefined;
    if(d === undefined || !veMntStpRolVer(sonuc, roller, d, r.rol)){ out.eksik.push(r); return; }
    if(+r.kg > 0) kutle[d] = +r.kg;
    if(r.rol !== 'mnt-mount' && _mstYogGecerli(r.yog)) yog[d] = r.yog;
    var n = r.rol === 'mnt-mount' ? _mstNoktaGecerli(r.nokta) : null;
    if(n) nokta[d] = n;
  });
  // rolü sonra düşen düğümün kütlesi, kaynağı ve noktası gider
  Object.keys(kutle).forEach(function(d){ if(!roller[d]) delete kutle[d]; });
  Object.keys(yog).forEach(function(d){ if(!roller[d] || roller[d] === 'mnt-mount') delete yog[d]; });
  Object.keys(nokta).forEach(function(d){ if(roller[d] !== 'mnt-mount') delete nokta[d]; });
  out.eslesen = roller.filter(Boolean).length;
  return out;
}

// ── TAKOZ NOKTASI — üst bağlantı yüzeyinin merkezi (2026-10-20, Takoz adım 5) ──
// Kural (kullanıcının onayı): takozun noktası ÜST BAĞLANTI YÜZEYİNİN MERKEZİ —
// analizcinin CATIA'da ölçtüğü dairenin merkezi. Nokta DOSYADA YAZILI SAYIDIR
// (dairenin CIRCLE kaydı, js/step-p21.js), ağdan değil — FEAD'in "ölçüm
// analitik" kuralı. Hacim merkezi bu noktanın ~38 mm altına düşüyordu ve Tulga
// modelinde statik sehimi 1,15 mm değiştiriyordu (ölçüldü).
//  • ÖNERİ (veMntStpTakozNoktasi): EKSEN birimin dairelerinin çoğunun ortak
//    ekseni, dosyanın +z'sine yönlü; ADAY eksene dik ve sınırında eksen
//    üstünde bir daire taşıyan düzlem yüz. Bağlantı yüzü BOYNUN TABANI:
//    üstündeki dilimde (bir sonraki dik düzleme kadar) yalnız saplama/cıvata
//    var (en geniş yarıçap yüzünkinin `boyun` katı ve cıvata boyunda) ya da
//    dilim boş ve üstünde pul/somun var. Boyun yoksa en üstteki aday.
//    Saplamanın, pulun ve somunun üst yüzü böylece seçilmez; konik takozun
//    göbeği (kauçuğun üstünde 20 mm yarıçaplı sütun) saplama sayılmaz.
//  • SEÇİLEN (3B'de dairesel kenar, veStepP21KenarCemberi): kayıtta parçanın
//    örnek yolu, merkezi ve yarıçapı; dosya yeniden okununca aynı parçada aynı
//    daire aranır (veMntStpDaireBul) — yoksa öneriye düşülür ve söylenir.
// aci: normal paralelliği (derece) · eksen: merkezin eksen doğrusuna uzaklığı
// (mm) · boyun: boyundaki en geniş yarıçap / yüzün yarıçapı (pulun dış
// yarıçapı saplamanınkinin 2 katı: 0,5 pulun üstündeki saplamayı boyun sayardı)
// · civata: boyundaki en geniş yarıçapın üst sınırı (mm; M24 saplama 12 —
// oran tek başına konik takozun göbeğini, 20 / 50 = 0,4, saplama sayıyordu)
// · dusey: eksenin düşeyle en büyük açısı (derece) · dilim: dilimin kenar payı (mm)
var VE_MNT_STP_NOKTA = { aci: 0.5, eksen: 0.05, boyun: 0.45, civata: 12.5, dusey: 45, dilim: 0.01 };
function _mstNok(a, b){ return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function _mstUz(a, b){ var x = a[0] - b[0], y = a[1] - b[1], z = a[2] - b[2]; return Math.sqrt(x * x + y * y + z * z); }
// Bir parçanın analitik yüzleri (dünya, mm); düzlemde dışa bakan normal `nd`.
// Okuma yüz tanımı çıkarmıyor (VE_MNT_STP_OKUMA): yüzler istenince modelden.
function veMntStpYuzler(sonuc, pi){
  var P = _mstOkuyucu(), g = sonuc && sonuc._geo && sonuc._geo[pi];
  if(!P || !P.Yuz || !sonuc._model || !g || !g.yuzler || !g.yuzler.length || !(g.birim && g.birim.mm > 0)) return [];
  var out = [];
  g.yuzler.forEach(function(f){
    var y;
    try { y = P.Yuz(sonuc._model, f, g.M, g.birim); } catch(e){ return; }
    if(y.tip === 'PLANE' && y.z) y.nd = y.ayni ? y.z.slice() : [-y.z[0], -y.z[1], -y.z[2]];
    y.parca = pi;
    out.push(y);
  });
  return out;
}
// Eksen: dairelerin (geometriye göre tekil) normal kümelerinin en kalabalığı,
// eksen doğrusu o kümenin merkez izlerinin en kalabalığı. Döner: { a, p } | null
function _mstEksen(daireler){
  var T = VE_MNT_STP_NOKTA, cosT = Math.cos(T.aci * Math.PI / 180), gor = {}, tekil = [];
  daireler.forEach(function(d){
    var k = Math.round(d.r * 1e4) + ':' + d.c.map(function(v){ return Math.round(v * 1e4); }).join(',');
    if(gor[k]) return;
    gor[k] = 1; tekil.push(d);
  });
  var kume = [];
  tekil.forEach(function(d){
    for(var i = 0; i < kume.length; i++) if(Math.abs(_mstNok(kume[i].n, d.n)) >= cosT){ kume[i].l.push(d); kume[i].top += d.r; return; }
    kume.push({ n: d.n, l: [d], top: d.r });
  });
  kume.sort(function(x, y){ return y.l.length - x.l.length || y.top - x.top; });
  if(!kume.length) return null;
  var a = kume[0].n.slice();
  if(a[2] < 0 || (a[2] === 0 && (a[0] < 0 || (a[0] === 0 && a[1] < 0)))) a = [-a[0], -a[1], -a[2]];
  var hat = [];
  kume[0].l.forEach(function(d){
    var h = _mstNok(d.c, a), q = [d.c[0] - h * a[0], d.c[1] - h * a[1], d.c[2] - h * a[2]];
    for(var i = 0; i < hat.length; i++) if(_mstUz(hat[i].q, q) <= T.eksen){ hat[i].l.push(q); hat[i].en = Math.max(hat[i].en, d.r); return; }
    hat.push({ q: q, l: [q], en: d.r });
  });
  hat.sort(function(x, y){ return y.l.length - x.l.length || y.en - x.en; });
  var p = [0, 0, 0];
  hat[0].l.forEach(function(q){ for(var j = 0; j < 3; j++) p[j] += q[j] / hat[0].l.length; });
  return { a: a, p: p };
}
// Noktanın eksen doğrusuna uzaklığı
function _mstEksenUz(E, c){
  var v = [c[0] - E.p[0], c[1] - E.p[1], c[2] - E.p[2]], h = _mstNok(v, E.a);
  return Math.sqrt(Math.max(0, _mstNok(v, v) - h * h));
}
// Öneri. parcalar: birimin parça indisleri; agler: aynı parçaların ağları.
// Döner: { ok, c, n, r, parca, kenar, yuz, h, eksen } | { ok:false, neden }
function veMntStpTakozNoktasi(sonuc, parcalar, agler){
  var T = VE_MNT_STP_NOKTA, cosT = Math.cos(T.aci * Math.PI / 180);
  var yuzler = [];
  (parcalar || []).forEach(function(pi){ yuzler = yuzler.concat(veMntStpYuzler(sonuc, pi)); });
  var daireler = [];
  yuzler.forEach(function(y){ y.cemberler.forEach(function(c){ daireler.push(c); }); });
  if(!daireler.length) return { ok: false, neden: 'dairesel kenar yok' };
  var E = _mstEksen(daireler);
  if(!E || E.a[2] < Math.cos(T.dusey * Math.PI / 180)) return { ok: false, neden: 'eksen düşey değil' };
  // Adaylar ve dik düzlemlerin yükseklikleri. Aşağı bakan yüz ayıklanmaz: katısı
  // onun ÜSTÜNDE — ne en üstte ne boyun tabanında olabilir (dilimi katının kendisi)
  var aday = [], duzlem = [];
  yuzler.forEach(function(y){
    if(!y.nd || Math.abs(_mstNok(y.nd, E.a)) < cosT) return;
    duzlem.push(_mstNok(y.o, E.a));
    var en = null;
    y.cemberler.forEach(function(c){
      if(Math.abs(_mstNok(c.n, E.a)) < cosT || _mstEksenUz(E, c.c) > T.eksen) return;
      if(!en || c.r > en.r) en = c;
    });
    if(en) aday.push({ h: _mstNok(en.c, E.a), R: en.r, d: en, parca: y.parca, yuz: y.id });
  });
  if(!aday.length) return { ok: false, neden: 'üst yüz yok' };
  // Ağın üçgenleri: yükseklik aralığı ve eksenden en büyük uzaklık
  var U = [], tepe = -Infinity;
  (agler || []).forEach(function(ag){
    if(!ag || !ag.uc || !ag.ucgen) return;
    var u = ag.uc, t = ag.ucgen;
    for(var k = 0; k < t.length; k += 3){
      var h0 = Infinity, h1 = -Infinity, r = 0;
      for(var j = 0; j < 3; j++){
        var q = [u[t[k + j] * 3], u[t[k + j] * 3 + 1], u[t[k + j] * 3 + 2]], h = _mstNok(q, E.a);
        if(h < h0) h0 = h; if(h > h1) h1 = h;
        var rq = _mstEksenUz(E, q); if(rq > r) r = rq;
      }
      U.push(h0, h1, r);
      if(h1 > tepe) tepe = h1;
    }
  });
  duzlem.sort(function(x, y){ return x - y; });
  var boyun = function(g){
    var e = T.dilim, hn = Infinity;
    for(var i = 0; i < duzlem.length; i++) if(duzlem[i] > g.h + e){ hn = duzlem[i]; break; }
    if(hn === Infinity) hn = tepe;
    if(!(hn > g.h + e)) return false;                         // üstünde bir şey yok
    var n = 0, r = 0;
    for(var k = 0; k < U.length; k += 3){
      if(U[k + 1] <= g.h + e || U[k] >= hn - e) continue;
      n++; if(U[k + 2] > r) r = U[k + 2];
    }
    return n ? r <= Math.min(T.boyun * g.R, T.civata) : tepe > hn + e;   // boş dilim: üstünde pul/somun varsa
  };
  var sec = function(l){ return l.reduce(function(x, y){ return (y.h > x.h + T.dilim || (Math.abs(y.h - x.h) <= T.dilim && y.R > x.R)) ? y : x; }); };
  var boyunlu = aday.filter(boyun), g = sec(boyunlu.length ? boyunlu : aday);
  return { ok: true, c: g.d.c.slice(), n: E.a.slice(), r: g.d.r, parca: g.parca, kenar: g.d.kenar, yuz: g.yuz, h: g.h, eksen: E };
}
// Seçilen dairenin bu dosyadaki karşılığı: örnek yolundaki düğümün parçalarında
// aynı yarıçap (1e-6) ve aynı merkez (1 µm). Döner: { c, n, r, parca, kenar } | null
function veMntStpDaireBul(sonuc, yol, c, r){
  var d = Array.isArray(yol) ? _mstYolDizin(sonuc)[yol.join('\u0001')] : undefined;
  if(d === undefined || !Array.isArray(c) || !(r > 0)) return null;
  var en = null, enU = Infinity;
  sonuc.agac[d].parcalar.forEach(function(pi){
    veMntStpYuzler(sonuc, pi).forEach(function(y){
      y.cemberler.forEach(function(cm){
        if(Math.abs(cm.r - r) > 1e-6 * Math.max(1, r)) return;
        var u = _mstUz(cm.c, c);
        if(u < enU){ enU = u; en = { c: cm.c.slice(), n: cm.n.slice(), r: cm.r, parca: pi, kenar: cm.kenar }; }
      });
    });
  });
  return en && enU <= 1e-3 ? en : null;
}
// 3B'de tıklanan kenar → seçim kaydı: { yol, c, n, r, parca, kenar } | null (çember değil)
function veMntStpKenarDaire(sonuc, pi, kenar){
  var P = _mstOkuyucu(), g = sonuc && sonuc._geo && sonuc._geo[pi];
  if(!P || !P.Kenar || !g || !sonuc._model) return null;
  var c = null;
  try { c = P.Kenar(sonuc._model, kenar, g.M, g.birim); } catch(e){ c = null; }
  if(!c) return null;
  return { yol: veMntStpYol(sonuc, sonuc.parcalar[pi].dugum), c: c.c, n: c.n, r: c.r, parca: pi, kenar: kenar };
}

// ── ÇÖZÜM — yalnız rol verilen birimler ───────────────────────────────────
// opt.ag(pi) → parçanın ağı ya da null (3B görüntüleyicinin önbelleği);
// verilmezse ağ burada üçgenlenir. opt.nokta: { takozun düğümü: seçilen daire
// ({ yol, c, r }) }. opt.yogunluk: { düğüm: 'dosya' | malzeme anahtarı } —
// 'dosya' ağırlık merkezini kütleyle ağırlıklar. opt.oz: parça özelliklerinin
// önbelleği ({ parça: veMntStpParcaOzellik }, çağıranın). Döner (fırlatmaz):
//   { ok, hatalar[], uyarilar[], birimler:[{ dugum, tip, ad, V, c, J, kutu, kapali,
//     konum, kaynak, nokta?, say, yogSay, acikParca, acikPay, dosya?, sapma? }] }
// V · c · J: hacme katılan parçaların toplamı (birim yoğunluk); `kapali`: hacmi
// ölçülen en az bir parça var. `say`: { ag, dosya, nokta, acik } parça sayısı;
// `yogSay`: hacme katılan parçalardan yoğunluğu dosyada yazılı olanlar.
// `dosya`: bütün katılan parçaların dosyada yoğunluğu varsa { m (kg), c,
// I (kg·mm²), malzeme[] }. `sapma`: dosyanın merkezi/hacmi ile kapalı ağınki
// arasındaki en büyük fark { c (mm), V (oran) }.
// `konum` gövdenin noktası: hacim merkezi ('dosya' seçiliyse kütle merkezi);
// hiçbir parçanın hacmi yoksa kutunun merkezi (`kaynak`: 'hacim' | 'kutu').
// Takozun noktası üst bağlantı yüzeyinin merkezi: seçilen daire ('kenar') ya
// da öneri ('eksen'); ikisi de yoksa gövdeninki gibi. `nokta`: noktanın
// dairesi { c, n, r } (3B halkası).
// Birimin toplamı: hacme katılan parçalar (ağı kapalı ya da dosyada hacmi
// olan) — açık parçalar ve açık gövdeler (acikGovde: parça başına sayı)
// adıyla ve yüzey payıyla ayrı
function _mstBirim(b, P){
  var kutu = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity], alan = 0, acikAlan = 0;
  var r = { dugum: b.dugum, tip: b.tip, ad: b.ad, V: 0, c: null, J: null, kutu: null, kapali: false,
            say: { ag: 0, dosya: 0, nokta: 0, acik: 0 }, yogSay: 0, acikParca: [], acikGovde: [], acikPay: 0, acik: 0, kenarYuz: 0, ucgen: 0,
            yamaGovde: 0, yamaPay: 0 };
  var yamaAlan = 0;
  var dahil = [], sapma = null;
  P.forEach(function(p){
    if(p.kaynak === 'acik' && !p.kutu) return;             // geometrisiz parça (dosyada yalnız ürün: yağ, etiket)
    if(p.kutu) for(var i = 0; i < 3; i++){ kutu[i] = Math.min(kutu[i], p.kutu[i]); kutu[i + 3] = Math.max(kutu[i + 3], p.kutu[i + 3]); }
    alan += p.alan; r.acik += p.acikKenar || 0; r.kenarYuz += p.kenarYuz || 0; r.ucgen += p.ucgen || 0;
    if(p.kaynak === 'acik'){ r.say.acik++; r.acikParca.push({ pi: p.pi, ad: p.ad }); acikAlan += p.alan; return; }
    if(p.kaynak === 'ag' && p.acikGovde){ r.acikGovde.push({ pi: p.pi, ad: p.ad, n: p.acikGovde, govde: p.govde }); acikAlan += p.acikAlan; }
    if(p.kaynak === 'ag' && p.yamaGovde){ r.yamaGovde += p.yamaGovde; yamaAlan += p.yamaAlan; }
    if(p.nokta) r.say.nokta++; else r.say[p.kaynak]++;
    dahil.push(p);
    if(p.sapma) sapma = { c: Math.max(sapma ? sapma.c : 0, p.sapma.c), V: Math.max(sapma ? sapma.V : 0, p.sapma.V) };
  });
  if(kutu[3] >= kutu[0]) r.kutu = kutu;
  r.acikPay = alan > 0 ? acikAlan / alan : 0;
  r.yamaPay = alan > 0 ? yamaAlan / alan : 0;
  if(sapma) r.sapma = sapma;
  r.yogSay = dahil.filter(function(p){ return p.rho > 0; }).length;
  var H = _mstTopla(dahil, function(){ return 1; });
  if(!H) return r;
  r.V = H.W; r.c = H.c; r.J = H.T; r.kapali = true;
  if(r.yogSay === dahil.length){
    var D = _mstTopla(dahil, function(p){ return p.rho * 1e-9; }), ad = {};
    dahil.forEach(function(p){ if(p.malzeme) ad[p.malzeme] = 1; });
    r.dosya = { m: D.W, c: D.c, I: D.T, malzeme: Object.keys(ad) };
  }
  return r;
}
function veMntStpCoz(sonuc, roller, opt){
  opt = opt || {};
  var out = { ok: false, hatalar: [], uyarilar: [], birimler: [] };
  if(!sonuc || !sonuc.ok){ out.hatalar.push('STEP dosyası okunmadı.'); return out; }
  var birimler = veMntStpBirimler(sonuc, roller || []);
  if(!birimler.length){ out.hatalar.push('Rol verilmiş parça yok.'); return out; }
  var U = _mstUcgen(), B = null;
  // Önbellek yoksa (testler) parça burada üçgenlenir — bağlam parça başına bırakılır
  var agAl = function(pi){
    var a = (typeof opt.ag === 'function') ? opt.ag(pi) : null;
    if(a) return a;
    if(!U) return null;
    if(!B) B = U.Baglam(sonuc._model, VE_MNT_STP_UCGEN);
    a = veMntStpParcaAgi(sonuc, pi, B);
    U.Birak(B);
    return a;
  };
  var onb = opt.oz || null, yog = opt.yogunluk || {};
  birimler.forEach(function(b){
    var agler = [], P = [];
    b.parcalar.forEach(function(pi){
      var a = agAl(pi);
      if(a) agler.push(a);
      var p = onb && onb[pi];
      if(!p){ p = veMntStpParcaOzellik(sonuc, pi, a); if(onb && a) onb[pi] = p; }
      P.push(p);
    });
    var r = _mstBirim(b, P);
    var oz = { kapali: r.kapali, c: r.c, kutu: r.kutu };
    if(b.tip === 'mnt-mount' && oz.kutu){
      var sec = opt.nokta && opt.nokta[b.dugum], d = null, neden = '';
      if(sec){
        d = veMntStpDaireBul(sonuc, sec.yol, sec.c, sec.r);
        if(d){ r.kaynak = 'kenar'; }
        else out.uyarilar.push('"' + b.ad + '": seçilen daire bu dosyada yok; öneri kullanıldı.');
      }
      if(!d){
        d = veMntStpTakozNoktasi(sonuc, b.parcalar, agler);
        if(d.ok) r.kaynak = 'eksen'; else { neden = d.neden; d = null; }
      }
      if(d){
        r.konum = d.c.slice(); r.nokta = { c: d.c.slice(), n: d.n.slice(), r: d.r };
        out.birimler.push(r);
        return;
      }
      out.uyarilar.push('"' + b.ad + '": takoz ekseni bulunamadı (' + neden + '); nokta ' + (oz.kapali && oz.c ? 'hacim' : 'kutu') + ' merkezi.');
    }
    if(oz.kapali && oz.c){
      r.konum = (yog[b.dugum] === 'dosya' && r.dosya ? r.dosya.c : oz.c).slice();
      r.kaynak = 'hacim';
      var kisim = [], adlar = r.acikParca.concat(r.acikGovde).map(function(x){ return x.ad; });
      var ng = r.acikGovde.reduce(function(t, x){ return t + x.n; }, 0);
      if(r.acikParca.length) kisim.push(r.acikParca.length + ' parça');
      if(ng) kisim.push(ng + ' gövde');
      if(kisim.length)
        out.uyarilar.push('"' + b.ad + '": ' + kisim.join(' ve ') + ' kapalı değil, hacme katılmadı ('
          + adlar.slice(0, 3).join(', ') + (adlar.length > 3 ? ', …' : '')
          + '); yüzey payı %' + _mstSayi(r.acikPay * 100, 1) + '.');
      if(r.yamaGovde)
        out.uyarilar.push('"' + b.ad + '": ' + r.yamaGovde + ' gövdenin açıklığı kapatıldı; yüzey payı %'
          + _mstSayi(r.yamaPay * 100, r.yamaPay < 0.001 ? 3 : 2) + '.');
    } else if(oz.kutu){
      r.konum = [(oz.kutu[0] + oz.kutu[3]) / 2, (oz.kutu[1] + oz.kutu[4]) / 2, (oz.kutu[2] + oz.kutu[5]) / 2];
      r.kaynak = 'kutu';
      out.uyarilar.push('"' + b.ad + '": ağ kapalı değil (' + (r.kenarYuz ? r.kenarYuz + ' yüz üçgenlenemedi' : r.acik + ' açık kenar')
        + '): kutu merkezi, atalet yok.');
    } else {
      out.uyarilar.push('"' + b.ad + '": çizilebilir yüz yok, birim atlandı.');
      return;
    }
    out.birimler.push(r);
  });
  out.ok = out.birimler.length > 0;
  if(!out.ok && !out.hatalar.length) out.hatalar.push('Rol verilen birimlerin hiçbirinde ölçülebilir geometri yok.');
  return out;
}

// ── KÜTLE — birimin kütlesi ve tensörü, kaynağıyla ────────────────────────
// kg: elle yazılan kütle; yog: 'dosya' | malzeme anahtarı | yok (elle).
// Döner: { m (kg) | NaN, I (kg·m², tensör) | null, kaynak: 'elle' | 'malzeme' |
//   'dosya', not } — `not` "S" işaretinin ipucu (kütlenin ve tensörün dayanağı).
// Elle ve malzemede yoğunluk HOMOJEN (I = ρ·J); dosyada parça parça.
function veMntStpKutle(b, kg, yog){
  var out = { m: NaN, I: null, kaynak: 'elle', not: 'homojen yoğunluk' };
  if(!b) return out;
  var tensor = function(T, k){ return T ? T.map(function(sat){ return sat.map(function(v){ return v * k; }); }) : null; };
  if(yog === 'dosya' && b.dosya){
    out.kaynak = 'dosya'; out.m = b.dosya.m; out.I = tensor(b.dosya.I, 1e-6);   // kg·mm² → kg·m²
    out.not = 'dosyanın yoğunlukları' + (b.dosya.malzeme.length ? ' (' + b.dosya.malzeme.join(', ') + ')' : '');
    return out;
  }
  var mz = veMntStpMalzeme(yog);
  if(mz && b.kapali && b.V > 0){
    out.kaynak = 'malzeme'; out.m = mz.rho * b.V * 1e-9;
    out.not = mz.ad + ' · ' + _mstSayi(mz.rho, 0) + ' kg/m³';
  } else {
    var m = Number(typeof kg === 'string' ? String(kg).replace(',', '.') : kg);
    out.m = m > 0 ? m : NaN;
  }
  // I = ρ·J, ρ = m / V [kg/mm³]; kg·mm² → kg·m²
  if(out.m > 0 && b.kapali && b.J && b.V > 0) out.I = tensor(b.J, out.m / b.V * 1e-6);
  return out;
}

// ── KAYIT — sihirbazın düğüm listesi ──────────────────────────────────────
// kutle: { dugum: kg } (kullanıcının yazdığı) · yogunluk: { dugum: kaynak }
// (veMntStpKutle). Kayıt µm'ye, gramına ve 0,0001 kg·m²'ye yuvarlanır —
// dönüşüm gürültüsü alanlara yazılmasın (FEAD'in kuralı).
// Döner: { liste:[{type, customName, data, dugum}], kaynak:[{ cg, I, mass, konum, not }] } —
// kaynak dizisi listeyle aynı sırada (sihirbaz "S" işaretini buradan alır;
// `mass` yalnız kütle geometriden türediyse — malzeme ya da dosya). `T`:
// öteleme (dosya − model, veMntStpKarsilastir) — konumlar modelin sistemine.
function _mstYuv(x, k){ return Math.round(x * k) / k + 0; }
function veMntStpKayit(coz, kutle, yogunluk, T){
  kutle = kutle || {}; yogunluk = yogunluk || {}; T = T || [0, 0, 0];
  var liste = [], kaynak = [];
  ((coz && coz.birimler) || []).forEach(function(b){
    if(!b.konum) return;
    var p = b.konum.map(function(v, i){ return _mstYuv(v - T[i], 1000); });
    if(b.tip === 'mnt-mount'){
      liste.push({ type: 'mnt-mount', customName: b.ad, data: { x: p[0], y: p[1], z: p[2] }, dugum: b.dugum });
      kaynak.push({ konum: true });
      return;
    }
    var d = { cgx: p[0], cgy: p[1], cgz: p[2] };
    var K = veMntStpKutle(b, kutle[b.dugum], yogunluk[b.dugum]);
    var iz = { cg: true, not: K.not };
    if(K.m > 0){
      d.mass = K.kaynak === 'elle' ? K.m : _mstYuv(K.m, 1000);
      if(K.kaynak !== 'elle') iz.mass = true;
      if(K.I){
        d.Ixx = _mstYuv(K.I[0][0], 1e4); d.Iyy = _mstYuv(K.I[1][1], 1e4); d.Izz = _mstYuv(K.I[2][2], 1e4);
        d.Ixy = _mstYuv(K.I[0][1], 1e4); d.Ixz = _mstYuv(K.I[0][2], 1e4); d.Iyz = _mstYuv(K.I[1][2], 1e4);
        d.pointMass = false;
        iz.I = true;
      }
    }
    liste.push({ type: b.tip, customName: b.ad, data: d, dugum: b.dugum });
    kaynak.push(iz);
  });
  return { liste: liste, kaynak: kaynak };
}

// ── KARŞILAŞTIRMA — CAD birimleri ↔ modelin bileşenleri (Takoz adım 7) ────
// `model`: [{ id, tip, ad, p: [x, y, z] | null, m: kg }] — tuvalin ya da
// sihirbazın satırları (çağıran kurar). ÖTELEME T = dosya − model: modelin
// takozları dosyanınkilerden aynı ötelemeyle ayrılabilir — gerçek Tulga'da
// sunu başka bir referansla ölçülmüş, beş takozun dördü (0; 39,976; 28,596)
// ile 0,001 mm'de oturuyor. Aday her (CAD takozu, model takozu) farkı ve sıfır;
// en çok takozu `pay` içinde oturtan aday, eşitlikte sıfır; T uyuşan çiftlerin
// ortancası. `en` takozdan azı uyuşursa T sıfır. Eşleme tip içinde, T altında
// en yakın çift önce, iki taraf da bir kez.
// Döner: { T, uyusan, takoz, satirlar: [{ dugum, tip, ad, cad, id, modelAd, model,
// fark, mModel }] } — satır birim sırasında; eşi olmayanın `id`si null.
var VE_MNT_STP_ESLE = { pay: 0.5, en: 2 };
function veMntStpKarsilastir(birimler, model){
  birimler = (birimler || []).filter(function(b){ return b && b.konum; });
  model = (model || []).filter(function(o){ return o && o.id != null; });
  var fark = function(a, b){ return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; };
  var P = birimler.filter(function(b){ return b.tip === 'mnt-mount'; }).map(function(b){ return b.konum; });
  var Q = model.filter(function(o){ return o.tip === 'mnt-mount' && o.p; }).map(function(o){ return o.p; });
  var oturan = function(T){
    var ciftler = [];
    P.forEach(function(p){
      var en = null, d = VE_MNT_STP_ESLE.pay;
      Q.forEach(function(q){ var u = _mstUz(fark(p, T), q); if(u <= d){ d = u; en = q; } });
      if(en) ciftler.push(fark(p, en));
    });
    return ciftler;
  };
  var T = [0, 0, 0], C = oturan(T);
  P.forEach(function(p){
    Q.forEach(function(q){
      var t = fark(p, q), c = oturan(t);
      if(c.length > C.length){ T = t; C = c; }
    });
  });
  if(C.length < VE_MNT_STP_ESLE.en) C = oturan(T = [0, 0, 0]);
  else if(T[0] || T[1] || T[2]){
    T = [0, 1, 2].map(function(k){                     // µm'ye: konumlar da µm'de yazılıyor
      var a = C.map(function(f){ return f[k]; }).sort(function(x, y){ return x - y; }), m = a.length >> 1;
      return _mstYuv(a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2, 1000);
    });
  }
  var es = {}, kul = {};
  birimler.map(function(b){ return b.tip; }).filter(function(t, i, a){ return a.indexOf(t) === i; }).forEach(function(tip){
    var ciftler = [];
    birimler.forEach(function(b){
      if(b.tip !== tip) return;
      model.forEach(function(o){
        if(o.tip === tip) ciftler.push({ b: b, o: o, d: o.p ? _mstUz(fark(b.konum, T), o.p) : Infinity });
      });
    });
    ciftler.sort(function(x, y){ return x.d - y.d; });
    ciftler.forEach(function(x){
      if(es[x.b.dugum] || kul[x.o.id]) return;
      es[x.b.dugum] = x; kul[x.o.id] = 1;
    });
  });
  return { T: T, uyusan: C.length, takoz: P.length, satirlar: birimler.map(function(b){
    var x = es[b.dugum];
    return { dugum: b.dugum, tip: b.tip, ad: b.ad, cad: b.konum.slice(), id: x ? x.o.id : null, modelAd: x ? x.o.ad || '' : '',
             model: x && x.o.p ? x.o.p.slice() : null, fark: x && isFinite(x.d) ? x.d : null, mModel: x ? x.o.m : NaN };
  }) };
}

if(typeof module !== 'undefined' && module.exports){
  module.exports = {
    VE_MNT_STP_SURUM: VE_MNT_STP_SURUM, VE_MNT_STP_UCGEN: VE_MNT_STP_UCGEN,
    VE_MNT_STP_ROLLER: VE_MNT_STP_ROLLER, VE_MNT_STP_CIP: VE_MNT_STP_CIP, VE_MNT_STP_OKUMA: VE_MNT_STP_OKUMA,
    veMntStpOku: veMntStpOku, veMntStpOkuDilimli: veMntStpOkuDilimli,
    veMntStpBirimler: veMntStpBirimler, veMntStpAgOzellik: veMntStpAgOzellik,
    veMntStpParcaAgi: veMntStpParcaAgi, veMntStpAgIs: veMntStpAgIs, veMntStpAgUret: veMntStpAgUret,
    veMntStpCoz: veMntStpCoz, veMntStpKayit: veMntStpKayit,
    VE_MNT_STP_ESLE: VE_MNT_STP_ESLE, veMntStpKarsilastir: veMntStpKarsilastir,
    veMntStpRolVer: veMntStpRolVer, VE_MNT_STP_KAYIT_SURUM: VE_MNT_STP_KAYIT_SURUM,
    veMntStpYol: veMntStpYol, veMntStpImza: veMntStpImza,
    veMntStpRolKaydi: veMntStpRolKaydi, veMntStpRolKaydiUygula: veMntStpRolKaydiUygula,
    VE_MNT_STP_NOKTA: VE_MNT_STP_NOKTA, veMntStpYuzler: veMntStpYuzler, veMntStpTakozNoktasi: veMntStpTakozNoktasi,
    VE_MNT_STP_MALZEME: VE_MNT_STP_MALZEME, VE_MNT_STP_YAMA: VE_MNT_STP_YAMA, veMntStpMalzeme: veMntStpMalzeme, veMntStpKutle: veMntStpKutle,
    veMntStpDosyaOzellik: veMntStpDosyaOzellik, veMntStpParcaOzellik: veMntStpParcaOzellik, veMntStpParcaOzellikIs: veMntStpParcaOzellikIs,
    veMntStpDaireBul: veMntStpDaireBul, veMntStpKenarDaire: veMntStpKenarDaire
  };
}
