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
function _mstAcikKenar(a){
  var u = a.uc, t = a.ucgen, q = 1e-6, nu = u.length / 3;
  var boy = 16; while(boy < nu * 2) boy *= 2;
  var maske = boy - 1, yuva = new Int32Array(boy).fill(-1), Q = new Float64Array(nu * 3), id = new Int32Array(nu), n = 0;
  for(var v = 0; v < nu; v++){
    var x = Math.round(u[v * 3] / q), y = Math.round(u[v * 3 + 1] / q), z = Math.round(u[v * 3 + 2] / q);
    var h = (Math.imul(x | 0, 73856093) ^ Math.imul(y | 0, 19349663) ^ Math.imul(z | 0, 83492791)) & maske;
    for(;;){
      var s = yuva[h];
      if(s < 0){ yuva[h] = n; Q[n * 3] = x; Q[n * 3 + 1] = y; Q[n * 3 + 2] = z; id[v] = n++; break; }
      if(Q[s * 3] === x && Q[s * 3 + 1] === y && Q[s * 3 + 2] === z){ id[v] = s; break; }
      h = (h + 1) & maske;
    }
  }
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
function veMntStpAgOzellik(agler){
  var kutu = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity], kenarYuz = 0, ucgenSay = 0, acik = 0;
  (agler || []).forEach(function(a){
    if(!a) return;
    for(var i = 0; i < 3; i++){ kutu[i] = Math.min(kutu[i], a.kutu[i]); kutu[i + 3] = Math.max(kutu[i + 3], a.kutu[i + 3]); }
    kenarYuz += a.kenarYuz || 0;
    if(a.uc && a.ucgen) acik += _mstAcikKenar(a);
  });
  if(!(kutu[3] >= kutu[0])) return { V: 0, c: null, J: null, kutu: null, kapali: false, kenarYuz: kenarYuz, acik: acik, ucgen: 0 };
  var o = [(kutu[0] + kutu[3]) / 2, (kutu[1] + kutu[4]) / 2, (kutu[2] + kutu[5]) / 2];
  var V = 0, sx = 0, sy = 0, sz = 0, xx = 0, yy = 0, zz = 0, xy = 0, xz = 0, yz = 0;
  (agler || []).forEach(function(a){
    if(!a || !a.ucgen) return;
    var u = a.uc, t = a.ucgen;
    for(var k = 0; k < t.length; k += 3){
      var i = t[k] * 3, j = t[k + 1] * 3, m = t[k + 2] * 3;
      var ax = u[i] - o[0], ay = u[i + 1] - o[1], az = u[i + 2] - o[2];
      var bx = u[j] - o[0], by = u[j + 1] - o[1], bz = u[j + 2] - o[2];
      var cx = u[m] - o[0], cy = u[m + 1] - o[1], cz = u[m + 2] - o[2];
      var v = (ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)) / 6;
      V += v;
      sx += v * (ax + bx + cx) / 4; sy += v * (ay + by + cy) / 4; sz += v * (az + bz + cz) / 4;
      // ∫ xᵢxⱼ dV = v/20 · [Σ aᵢaⱼ + (Σ aᵢ)(Σ aⱼ)] — köşeler O', a, b, c
      var Sx = ax + bx + cx, Sy = ay + by + cy, Sz = az + bz + cz;
      xx += v / 20 * (ax * ax + bx * bx + cx * cx + Sx * Sx);
      yy += v / 20 * (ay * ay + by * by + cy * cy + Sy * Sy);
      zz += v / 20 * (az * az + bz * bz + cz * cz + Sz * Sz);
      xy += v / 20 * (ax * ay + bx * by + cx * cy + Sx * Sy);
      xz += v / 20 * (ax * az + bx * bz + cx * cz + Sx * Sz);
      yz += v / 20 * (ay * az + by * bz + cy * cz + Sy * Sz);
      ucgenSay++;
    }
  });
  // Yön: kapalı ve doğru yönlü ağda V > 0. Ters yönlüde bütün integraller
  // birlikte işaret değiştirir — ölçek işaretle düzeltilir.
  var isaret = V < 0 ? -1 : 1;
  V *= isaret; sx *= isaret; sy *= isaret; sz *= isaret;
  xx *= isaret; yy *= isaret; zz *= isaret; xy *= isaret; xz *= isaret; yz *= isaret;
  var kapali = (kenarYuz === 0) && (acik === 0) && V > 1e-9;
  if(!(V > 1e-9)) return { V: V, c: null, J: null, kutu: kutu, kapali: false, kenarYuz: kenarYuz, acik: acik, ucgen: ucgenSay };
  var cl = [sx / V, sy / V, sz / V];
  // Merkez etrafında (paralel eksen): ∫ xᵢxⱼ − V cᵢcⱼ
  var Mxx = xx - V * cl[0] * cl[0], Myy = yy - V * cl[1] * cl[1], Mzz = zz - V * cl[2] * cl[2];
  var Mxy = xy - V * cl[0] * cl[1], Mxz = xz - V * cl[0] * cl[2], Myz = yz - V * cl[1] * cl[2];
  var J = [[Myy + Mzz, -Mxy, -Mxz], [-Mxy, Mxx + Mzz, -Myz], [-Mxz, -Myz, Mxx + Myy]];
  return { V: V, c: [cl[0] + o[0], cl[1] + o[1], cl[2] + o[2]], J: J, kutu: kutu, kapali: kapali,
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
function _mstAgAlan(a){
  if(!a || !a.uc || !a.ucgen) return 0;
  var u = a.uc, t = a.ucgen, A = 0;
  for(var k = 0; k < t.length; k += 3){
    var i = t[k] * 3, j = t[k + 1] * 3, m = t[k + 2] * 3;
    var ax = u[j] - u[i], ay = u[j + 1] - u[i + 1], az = u[j + 2] - u[i + 2];
    var bx = u[m] - u[i], by = u[m + 1] - u[i + 1], bz = u[m + 2] - u[i + 2];
    var cx = ay * bz - az * by, cy = az * bx - ax * bz, cz = ax * by - ay * bx;
    A += Math.sqrt(cx * cx + cy * cy + cz * cz) / 2;
  }
  return A;
}
// Parçanın kütle özelliği, birim yoğunlukla: { pi, ad, V, c, J (kendi merkezi
// etrafında, mm⁵), alan, kutu, kaynak: 'ag' | 'dosya' | 'acik', nokta (hacim
// dosyadan, ağı açık: tensörü yok), rho?, malzeme?, sapma?: { c (mm), V (oran) }
// — dosyanın hacmi/merkezi ile kapalı ağınki }
function veMntStpParcaOzellik(sonuc, pi, ag){
  var oz = veMntStpAgOzellik(ag ? [ag] : []);
  var g = sonuc._geo && sonuc._geo[pi], f = g && g.pd ? veMntStpDosyaOzellik(sonuc)[g.pd] : null;
  var r = { pi: pi, ad: sonuc.parcalar[pi].ad, V: 0, c: null, J: null, alan: _mstAgAlan(ag), kutu: oz.kutu, kaynak: 'acik',
            acikKenar: oz.acik, kenarYuz: oz.kenarYuz, ucgen: oz.ucgen };
  if(oz.kapali){ r.kaynak = 'ag'; r.V = oz.V; r.c = oz.c; r.J = oz.J; }
  if(f && f.hacim > 0 && f.merkez && g.M){
    var R = g.M.R, t = g.M.t, q = f.merkez;
    var cw = [0, 1, 2].map(function(i){ return R[i][0] * q[0] + R[i][1] * q[1] + R[i][2] * q[2] + t[i]; });
    if(oz.kapali) r.sapma = { c: _mstUz(oz.c, cw), V: Math.abs(oz.V - f.hacim) / f.hacim };
    else r.nokta = true;
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
  return U.Parca(B, g.yuzler, g.M, g.birim);
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
  J.eksik = function(liste){
    var n = 0;
    (liste || []).forEach(function(i){ if(!J.ag[i] && _mstYuzlu(geo[i])) n++; });
    return n;
  };
  // Sıradaki parça: önce istenenler, sonra (bütün montaj isteniyorsa) ağaç sırası
  J.sonraki = function(){
    var i;
    while(J.oi < J.oncelik.length){
      i = J.oncelik[J.oi++];
      if(!J.ag[i] && _mstYuzlu(geo[i])) return i;
    }
    if(J.oi) { J.oncelik = []; J.oi = 0; }
    if(!J.tum) return -1;
    while(J.imlec < geo.length){
      i = J.imlec++;
      if(!J.ag[i] && _mstYuzlu(geo[i])) return i;
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
  // Parçanın kütle özelliği ağıyla AYNI dilimde (secenek.oz — hesabın önbelleği):
  // hesap ağlar bitince yalnız toplar (420 MB'lık denemede ilk hesap 961 ms'ydi)
  if(J.oz && !J.oz[i]) J.oz[i] = veMntStpParcaOzellik(J.sonuc, i, a);
  if(J.bitti) J.bitti(i, a);
}
function _mstAgAdim(J, bitis){
  var geo = J.sonuc._geo, U = J.U;
  if(!U) return true;
  for(;;){
    if(!J.cur){
      var i = J.sonraki();
      if(i < 0) return true;
      var g = geo[i], key = _mstSekil(g);
      if(key && J.paylas[key]){                    // aynı şeklin örneği: taşınır
        _mstAgKoy(J, i, U.Tasi(J.paylas[key], g.M), key);
        if(_mstSimdi() > bitis) return false;
        continue;
      }
      if(!J.B) J.B = U.Baglam(J.sonuc._model, VE_MNT_STP_UCGEN);
      J.cur = { i: i, key: key, topla: U.Topla(J.B, g.M, g.birim), j: 0 };
    }
    var c = J.cur, yz = geo[c.i].yuzler;
    while(c.j < yz.length){
      c.topla.ekle(yz[c.j++]);
      if(c.j < yz.length && _mstSimdi() > bitis) return false;
    }
    var tut = !!(c.key && J.kalan[c.key] > 1);
    var a = c.topla.bitir({ yerel: tut });
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
// Düğümün atalarının ve torunlarının rolü düşer (motor alt montajına rol
// verilince parçalarının ayrı rolü kalmaz). Oturumun rolü ve kaydın geri
// gelişi aynı kuralla (aşağıda). `roller` yerinde değişir; döner: true.
function veMntStpRolVer(sonuc, roller, i, tip){
  var a = sonuc && sonuc.agac;
  if(!a || !(i >= 0 && i < a.length) || (tip && VE_MNT_STP_ROLLER.indexOf(tip) < 0)) return false;
  if(tip){
    for(var e = a[i].ebeveyn; e >= 0; e = a[e].ebeveyn) roller[e] = null;
    (function sil(d){ a[d].cocuklar.forEach(function(c){ roller[c] = null; sil(c); }); })(i);
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
// olan) — açık parçalar adıyla ve yüzey payıyla ayrı
function _mstBirim(b, P){
  var kutu = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity], alan = 0, acikAlan = 0;
  var r = { dugum: b.dugum, tip: b.tip, ad: b.ad, V: 0, c: null, J: null, kutu: null, kapali: false,
            say: { ag: 0, dosya: 0, nokta: 0, acik: 0 }, yogSay: 0, acikParca: [], acikPay: 0, acik: 0, kenarYuz: 0, ucgen: 0 };
  var dahil = [], sapma = null;
  P.forEach(function(p){
    if(p.kutu) for(var i = 0; i < 3; i++){ kutu[i] = Math.min(kutu[i], p.kutu[i]); kutu[i + 3] = Math.max(kutu[i + 3], p.kutu[i + 3]); }
    alan += p.alan; r.acik += p.acikKenar || 0; r.kenarYuz += p.kenarYuz || 0; r.ucgen += p.ucgen || 0;
    if(p.kaynak === 'acik'){ r.say.acik++; r.acikParca.push({ pi: p.pi, ad: p.ad }); acikAlan += p.alan; return; }
    if(p.nokta) r.say.nokta++; else r.say[p.kaynak]++;
    dahil.push(p);
    if(p.sapma) sapma = { c: Math.max(sapma ? sapma.c : 0, p.sapma.c), V: Math.max(sapma ? sapma.V : 0, p.sapma.V) };
  });
  if(kutu[3] >= kutu[0]) r.kutu = kutu;
  r.acikPay = alan > 0 ? acikAlan / alan : 0;
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
      if(r.acikParca.length)
        out.uyarilar.push('"' + b.ad + '": ' + r.acikParca.length + ' parça kapalı değil, hacme katılmadı ('
          + r.acikParca.slice(0, 3).map(function(x){ return x.ad; }).join(', ') + (r.acikParca.length > 3 ? ', …' : '')
          + '); yüzey payı %' + _mstSayi(r.acikPay * 100, 1) + '.');
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
// Döner: { liste:[{type, customName, data}], kaynak:[{ cg, I, mass, konum, not }] } —
// kaynak dizisi listeyle aynı sırada (sihirbaz "S" işaretini buradan alır;
// `mass` yalnız kütle geometriden türediyse — malzeme ya da dosya).
function _mstYuv(x, k){ return Math.round(x * k) / k + 0; }
function veMntStpKayit(coz, kutle, yogunluk){
  kutle = kutle || {}; yogunluk = yogunluk || {};
  var liste = [], kaynak = [];
  ((coz && coz.birimler) || []).forEach(function(b){
    if(!b.konum) return;
    var p = b.konum.map(function(v){ return _mstYuv(v, 1000); });
    if(b.tip === 'mnt-mount'){
      liste.push({ type: 'mnt-mount', customName: b.ad, data: { x: p[0], y: p[1], z: p[2] } });
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
    liste.push({ type: b.tip, customName: b.ad, data: d });
    kaynak.push(iz);
  });
  return { liste: liste, kaynak: kaynak };
}

if(typeof module !== 'undefined' && module.exports){
  module.exports = {
    VE_MNT_STP_SURUM: VE_MNT_STP_SURUM, VE_MNT_STP_UCGEN: VE_MNT_STP_UCGEN,
    VE_MNT_STP_ROLLER: VE_MNT_STP_ROLLER, VE_MNT_STP_CIP: VE_MNT_STP_CIP, VE_MNT_STP_OKUMA: VE_MNT_STP_OKUMA,
    veMntStpOku: veMntStpOku, veMntStpOkuDilimli: veMntStpOkuDilimli,
    veMntStpBirimler: veMntStpBirimler, veMntStpAgOzellik: veMntStpAgOzellik,
    veMntStpParcaAgi: veMntStpParcaAgi, veMntStpAgIs: veMntStpAgIs, veMntStpAgUret: veMntStpAgUret,
    veMntStpCoz: veMntStpCoz, veMntStpKayit: veMntStpKayit,
    veMntStpRolVer: veMntStpRolVer, VE_MNT_STP_KAYIT_SURUM: VE_MNT_STP_KAYIT_SURUM,
    veMntStpYol: veMntStpYol, veMntStpImza: veMntStpImza,
    veMntStpRolKaydi: veMntStpRolKaydi, veMntStpRolKaydiUygula: veMntStpRolKaydiUygula,
    VE_MNT_STP_NOKTA: VE_MNT_STP_NOKTA, veMntStpYuzler: veMntStpYuzler, veMntStpTakozNoktasi: veMntStpTakozNoktasi,
    VE_MNT_STP_MALZEME: VE_MNT_STP_MALZEME, veMntStpMalzeme: veMntStpMalzeme, veMntStpKutle: veMntStpKutle,
    veMntStpDosyaOzellik: veMntStpDosyaOzellik, veMntStpParcaOzellik: veMntStpParcaOzellik,
    veMntStpDaireBul: veMntStpDaireBul, veMntStpKenarDaire: veMntStpKenarDaire
  };
}
