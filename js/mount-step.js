// ════════════════════════════════════════════════════════════════════════════
//  TAKOZ — STEP'TEN GÖVDE VE TAKOZ (DOM'suz)
// ════════════════════════════════════════════════════════════════════════════
//
// Kullanıcı isteği (2026-10-14): Takoz modülüne "STEP dosyadan başlama" —
// FEAD'in "STEP'ten başla" kapısının aynısı.
//
// ZİNCİR: metin → veStepP21Agac (js/step-p21.js: ağaç + yüzler, ANLAMSIZ) →
// kullanıcı düğümlere rol verir (Motor · Şanzıman · … · Takoz) → veMntStpCoz
// (yalnız rollü birimler) → veMntStpKayit (sihirbazın düğüm listesi) →
// sihirbaz onu örnek gibi yükler (veMntWizFromNodes — ikinci bir kurulum yolu
// açılmaz).
//
// KURALLAR:
//  • ÖNCE ROL, SONRA ANALİZ (FEAD kural 34'ün kuralı): ad hiçbir şeye karar
//    vermez, rol geometriden tahmin edilmez. Rol bir DÜĞÜME verilir (parça ya
//    da alt montaj); bir parça en yakın rollü atasının birimidir.
//  • ÖLÇÜLEN ŞEY GEOMETRİ: takozun konumu biriminin hacim merkezi; gövdenin
//    hacim merkezi ağırlık merkezi diye ÖNERİLİR (homojen yoğunluk varsayımı).
//    Kütle STEP'te YOK: kullanıcı yazarsa atalet aynı varsayımla türetilir,
//    yazmazsa atalet de yazılmaz — uydurulmuş bir kütleden türemiş atalet
//    sessizce yanlış olurdu. Geometriden gelen her alan sihirbazda "S" işareti
//    taşır; ölçülen değer yazılınca düşer.
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

function _mstOkuyucu(){
  if(typeof veStepP21Agac === 'function')
    return { Agac: veStepP21Agac };
  if(typeof require === 'function'){ try { var m = require('./step-p21.js'); return { Agac: m.veStepP21Agac }; } catch(e){ return null; } }
  return null;
}
function _mstUcgen(){
  if(typeof veStepUcgenBaglam === 'function') return { Baglam: veStepUcgenBaglam, Parca: veStepUcgenParca };
  if(typeof require === 'function'){ try { var m = require('./step-ucgen.js'); return { Baglam: m.veStepUcgenBaglam, Parca: m.veStepUcgenParca }; } catch(e){ return null; } }
  return null;
}

function veMntStpOku(metin){
  var P = _mstOkuyucu();
  if(!P || !P.Agac) return { ok: false, hatalar: ['STEP okuyucusu yüklenmemiş.'], uyarilar: [], agac: [], parcalar: [] };
  return P.Agac(metin);
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
function _mstAcikKenar(a){
  var u = a.uc, t = a.ucgen, q = 1e-6, harita = {}, id = [], n = 0, say = {}, acik = 0;
  for(var i = 0; i < u.length; i += 3){
    var k = Math.round(u[i] / q) + ',' + Math.round(u[i + 1] / q) + ',' + Math.round(u[i + 2] / q);
    if(harita[k] === undefined) harita[k] = n++;
    id.push(harita[k]);
  }
  for(var j = 0; j < t.length; j += 3){
    var A = id[t[j]], B = id[t[j + 1]], C = id[t[j + 2]];
    if(A === B || B === C || A === C) continue;
    [[A, B], [B, C], [C, A]].forEach(function(e){
      var key = Math.min(e[0], e[1]) + ':' + Math.max(e[0], e[1]);
      say[key] = (say[key] || 0) + 1;
    });
  }
  for(var key in say) if(say[key] === 1) acik++;
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

// Bir parçanın görüntü ağı — üçgenleyici (önbellek çağıranın: opt.ag).
function veMntStpParcaAgi(sonuc, pi, baglam){
  var U = _mstUcgen(), g = sonuc && sonuc._geo && sonuc._geo[pi];
  if(!U || !g || !g.yuzler || !g.yuzler.length) return null;
  var B = baglam || U.Baglam(sonuc._model, VE_MNT_STP_UCGEN);
  return U.Parca(B, g.yuzler, g.M, g.birim);
}

// ── ÇÖZÜM — yalnız rol verilen birimler ───────────────────────────────────
// opt.ag(pi) → parçanın ağı ya da null (3B görüntüleyicinin önbelleği);
// verilmezse ağ burada üçgenlenir. Döner (asla fırlatmaz):
//   { ok, hatalar[], uyarilar[], birimler:[{ dugum, tip, ad, V, c, J, kutu, kapali, konum, kaynak }] }
// `konum` takozun/gövdenin noktası: kapalı ağda hacim merkezi, değilse kutunun
// merkezi (`kaynak`: 'hacim' | 'kutu').
function veMntStpCoz(sonuc, roller, opt){
  opt = opt || {};
  var out = { ok: false, hatalar: [], uyarilar: [], birimler: [] };
  if(!sonuc || !sonuc.ok){ out.hatalar.push('STEP dosyası okunmadı.'); return out; }
  var birimler = veMntStpBirimler(sonuc, roller || []);
  if(!birimler.length){ out.hatalar.push('Rol verilmiş parça yok.'); return out; }
  var U = _mstUcgen(), B = null;
  var agAl = function(pi){
    var a = (typeof opt.ag === 'function') ? opt.ag(pi) : null;
    if(a) return a;
    if(!U) return null;
    if(!B) B = U.Baglam(sonuc._model, VE_MNT_STP_UCGEN);
    return veMntStpParcaAgi(sonuc, pi, B);
  };
  birimler.forEach(function(b){
    var agler = b.parcalar.map(agAl).filter(Boolean);
    var oz = veMntStpAgOzellik(agler);
    var r = { dugum: b.dugum, tip: b.tip, ad: b.ad, V: oz.V, c: oz.c, J: oz.J, kutu: oz.kutu,
              kapali: oz.kapali, kenarYuz: oz.kenarYuz, acik: oz.acik, ucgen: oz.ucgen };
    if(oz.kapali && oz.c){ r.konum = oz.c.slice(); r.kaynak = 'hacim'; }
    else if(oz.kutu){
      r.konum = [(oz.kutu[0] + oz.kutu[3]) / 2, (oz.kutu[1] + oz.kutu[4]) / 2, (oz.kutu[2] + oz.kutu[5]) / 2];
      r.kaynak = 'kutu';
      out.uyarilar.push('"' + b.ad + '": ağ kapalı değil (' + (oz.kenarYuz ? oz.kenarYuz + ' yüz üçgenlenemedi' : oz.acik + ' açık kenar')
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

// ── KAYIT — sihirbazın düğüm listesi ──────────────────────────────────────
// kutle: { dugum: kg } (kullanıcının yazdığı). Kayıt µm'ye ve 0,0001 kg·m²'ye
// yuvarlanır — dönüşüm gürültüsü alanlara yazılmasın (FEAD'in kuralı).
// Döner: { liste:[{type, customName, data}], kaynak:[{ cg, I, mass, konum }] } —
// kaynak dizisi listeyle aynı sırada (sihirbaz "S" işaretini buradan alır).
function _mstYuv(x, k){ return Math.round(x * k) / k + 0; }
function veMntStpKayit(coz, kutle){
  kutle = kutle || {};
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
    var iz = { cg: true };
    var m = Number(typeof kutle[b.dugum] === 'string' ? String(kutle[b.dugum]).replace(',', '.') : kutle[b.dugum]);
    if(m > 0){
      d.mass = m;
      if(b.kapali && b.J && b.V > 0){
        // I = ρ·J, ρ = m / V [kg/mm³]; kg·mm² → kg·m²
        var k = m / b.V * 1e-6;
        d.Ixx = _mstYuv(b.J[0][0] * k, 1e4); d.Iyy = _mstYuv(b.J[1][1] * k, 1e4); d.Izz = _mstYuv(b.J[2][2] * k, 1e4);
        d.Ixy = _mstYuv(b.J[0][1] * k, 1e4); d.Ixz = _mstYuv(b.J[0][2] * k, 1e4); d.Iyz = _mstYuv(b.J[1][2] * k, 1e4);
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
    VE_MNT_STP_ROLLER: VE_MNT_STP_ROLLER, VE_MNT_STP_CIP: VE_MNT_STP_CIP,
    veMntStpOku: veMntStpOku, veMntStpBirimler: veMntStpBirimler, veMntStpAgOzellik: veMntStpAgOzellik,
    veMntStpParcaAgi: veMntStpParcaAgi, veMntStpCoz: veMntStpCoz, veMntStpKayit: veMntStpKayit
  };
}
