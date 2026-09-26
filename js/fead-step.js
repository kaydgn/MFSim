// ============================================================================
//  FEAD — STEP MONTAJINDAN KASNAK GEOMETRİSİ (DOM'suz)
// ============================================================================
// js/step-p21.js dosyayı OKUR; bu dosya okunana ANLAM verir: hangi parçada
// kasnak var, dış çapı ne, kaç kanalı var, gerginin pivotu nerede, kasnaklar
// hangi düzlemde duruyor. Çıktı, programdaki FEAD ÖRNEK KAYITLARIYLA aynı
// biçimdedir (`{name, pulleys:[{key, type, name, data}], route}`): sihirbaz
// onu bir örnek gibi yükler, ikinci bir kurulum yolu açılmaz.
//
// ── DIŞ ÇAP = KABURGA TEPESİ, EN BÜYÜK ÇAP DEĞİL ────────────────────────
// Kaburgalı kasnağın iki yanında çoğu zaman kanaldan büyük bir omuz ya da
// kavrama çemberi durur. Ölçülen ilk gerçek dosyada krank omzu Ø150,5,
// klimanın kanal yanındaki çember Ø151; kanal tepeleri Ø147 ve Ø137.
// "En büyük çap" diyen bir kural ikisini de sessizce yanlış okurdu. Tepe,
// İKİ KANAL TABANI ARASINDAKİ yüzlerin en büyük yarıçapıdır; kaburga tepesi
// bir tor ise tepe noktası yüzün İÇİNDEDİR (sınır çemberinde değil) ve
// R + r olarak hesaplanır.
//
// ── KANAL = İKİ YANAKLI V + DÜZENLİ ADIM ────────────────────────────────
// 40°'lik kaburga kanalının yanakları eksenle 70° yarı açı yapan konilerdir.
// Bir kanal, İNEN bir yanağın hemen ardından ÇIKAN bir yanakla kurulur;
// tek başına bir 70° koni (kenar omzuna çıkan yanak) kanal değildir —
// gevşek kural aynı dosyada klimayı 9 kanallı okuyordu. Kanal adımı
// profili verir (PH 1,60 · PJ 2,34 · PK 3,56 · PL 4,70 · PM 9,40).
//
// ── ROL ADDAN ÖNERİLİR, GEOMETRİDEN TAHMİN EDİLMEZ ───────────────────────
// "En büyük kanallı kasnak kranktır" gibi bir sezgi sessizce yanlış bir
// sürücü seçerdi. Rol yalnız ürün ağacındaki adlardan ÖNERİLİR; kullanıcı
// onaylar ya da değiştirir.
//
// ── BAKIŞ YÖNÜ GÖRÜNÜR BİR VARSAYILANDIR ────────────────────────────────
// 3B'den 2B'ye geçerken düzleme hangi taraftan bakıldığı dosyada yazmaz; iki
// yön de çözülür ve aynı boyları verir, tek fark krankın dönüş yönüdür.
// Varsayılan: motor (modelin orijini) kayış düzleminin ARKASINDA kabul
// edilir. Orijin düzlemin üstündeyse varsayım yapılamaz ve bu `bakis.kaynak`
// alanında yazılı döner — arayüz her iki durumda da onay ister.
//
// ── KAYIŞA DOKUNULMAZ ───────────────────────────────────────────────────
// Kullanıcı kararı: kayış elle doldurulur. Sıra ağaç sırasıdır (sürücü başta,
// gergi sonda) ve `siraKaynagi: 'agac'` olarak işaretlenir.
// ============================================================================

var VE_FEAD_STP_SURUM = '1.0.0';

// ISO 9982 kaburga adımları (mm) ve kabul payı
var VE_FEAD_STP_PROFILLER = [
  { ad: 'PH', adim: 1.60 }, { ad: 'PJ', adim: 2.34 }, { ad: 'PK', adim: 3.56 },
  { ad: 'PL', adim: 4.70 }, { ad: 'PM', adim: 9.40 }
];
var VE_FEAD_STP_TOL = {
  yanakDer: 70, yanakPay: 0.75,     // kanal yanağı: yarı açı 70° ± 0,75°
  adimPay: 0.08,                    // profil eşleşmesi (mm)
  eksenAci: 0.05,                   // aynı eksen: yön farkı (derece)
  eksenMesafe: 0.01,                // aynı eksen: doğrular arası (mm)
  duzlemAci: 1.0,                   // ortak düzleme paralel sayılma (derece)
  duzGenislik: 5, duzYaricap: 10,   // düz kasnak yüzeyi: en az genişlik ve yarıçap (mm)
  pivotMin: 15, pivotMaks: 250      // gergi kolu aralığı (mm)
};

// ── ROL ÖNERİSİ ───────────────────────────────────────────────────────────
// Türkçe harfler katlanır; kurallar sırayla denenir (gergi önce: "GERGİ
// AVARASI" bir avara değil gerginin kasnağıdır).
var VE_FEAD_STP_ROL_KURAL = [
  { re: /\bGERGI|TENSION|SPANNER|TENDEUR/, tip: 'fead-tensioner' },
  { re: /\bKAYIS\b|\bBELT\b|\bRIEMEN\b|\b\d{1,2}\s*P[HJKLM]\s*\d{3,5}\b/, tip: 'kayis' },
  { re: /\bKRANK|\bCRANK|\bDAMPER|\bKURBEL/, tip: 'fead-crank' },
  { re: /\bKLIMA|\bA\/C\b|\bAIR\s*CON|\bKALTE/, tip: 'fead-ac' },
  { re: /\bHAVA\s*KOMPRES|\bAIR\s*COMPRES|\bLUFTPRESS/, tip: 'fead-aircomp' },
  { re: /\bALTERNAT|\bALT\b|\bGENERATOR|\bSARJ\s*DINAMO|\bLICHTMASCH/, tip: 'fead-alternator' },
  { re: /\bSU\s*POMPA|\bDEVIRDAIM|\bWATER\s*PUMP|\bW\/P\b|\bWASSERPUMP/, tip: 'fead-waterpump' },
  { re: /\bDIREKSIYON|\bHIDROLIK\s*POMPA|\bPOWER\s*STEER|\bP\/S\b|\bSERVO/, tip: 'fead-ps' },
  { re: /\bFAN\b|\bVISKOZ|\bVISCOUS|\bLUFTER/, tip: 'fead-fan' },
  { re: /\bAVARA|\bIDLER|\bUMLENK|\bROLLE\b/, tip: 'fead-idler' }
];

function _fstKatla(s){
  return String(s == null ? '' : s)
    .replace(/[İIı]/g, 'I').replace(/[Şş]/g, 'S').replace(/[Ğğ]/g, 'G').replace(/[Üü]/g, 'U')
    .replace(/[Öö]/g, 'O').replace(/[Çç]/g, 'C').toUpperCase().replace(/[^A-Z0-9\/]+/g, ' ');
}

function veFeadStpRol(metin){
  var k = ' ' + _fstKatla(metin) + ' ';
  for(var i = 0; i < VE_FEAD_STP_ROL_KURAL.length; i++)
    if(VE_FEAD_STP_ROL_KURAL[i].re.test(k)) return VE_FEAD_STP_ROL_KURAL[i].tip;
  return null;
}

// Parçanın rolü: kendi açıklaması → adı → numarası → en yakın atanın adları
function _fstParcaRol(p){
  var adaylar = [p.urun.aciklama, p.urun.ad, p.urun.id, p.ornek];
  for(var i = 0; i < adaylar.length; i++){ var r = veFeadStpRol(adaylar[i]); if(r) return { tip: r, kaynak: 'ad' }; }
  for(var j = (p.atalar || []).length - 1; j >= 0; j--){
    var a = p.atalar[j];
    var r2 = veFeadStpRol(a.aciklama) || veFeadStpRol(a.ad) || veFeadStpRol(a.id);
    if(r2) return { tip: r2, kaynak: 'ata' };
  }
  return { tip: null, kaynak: null };
}

// ── VEKTÖR ────────────────────────────────────────────────────────────────
function _fstNokta(a, b){ return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function _fstCikar(a, b){ return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function _fstTopla(a, b){ return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
function _fstCarp(a, s){ return [a[0] * s, a[1] * s, a[2] * s]; }
function _fstVek(a, b){ return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function _fstBoy(a){ return Math.sqrt(_fstNokta(a, a)); }
function _fstBirim(a){ var L = _fstBoy(a); return L > 0 ? _fstCarp(a, 1 / L) : a.slice(); }
// Yönü kararlı bir işarete çevir: en büyük bileşen artı
function _fstKanonik(d){
  var i = 0;
  if(Math.abs(d[1]) > Math.abs(d[i])) i = 1;
  if(Math.abs(d[2]) > Math.abs(d[i])) i = 2;
  return d[i] < 0 ? _fstCarp(d, -1) : d.slice();
}
// Noktanın eksen doğrusuna uzaklığı
function _fstDogruMesafe(p, o, d){
  var w = _fstCikar(p, o);
  return _fstBoy(_fstCikar(w, _fstCarp(d, _fstNokta(w, d))));
}
function _fstAciDer(a, b){
  var c = Math.min(1, Math.abs(_fstNokta(a, b)));
  return Math.acos(c) * 180 / Math.PI;
}

// ── 1 · EKSEN KÜMELERİ ────────────────────────────────────────────────────
// Parçanın eşeksenli yüzleri (silindir · koni · tor) aynı dönme eksenine göre
// toplanır. Düzlemler eksen taşımaz; profile ayrıca, çemberleriyle girer.
function _fstEksenler(yuzler){
  var G = [], cosT = Math.cos(VE_FEAD_STP_TOL.eksenAci * Math.PI / 180);
  yuzler.forEach(function(f){
    if(!f.z || (f.tip !== 'CYLINDRICAL_SURFACE' && f.tip !== 'CONICAL_SURFACE' && f.tip !== 'TOROIDAL_SURFACE')) return;
    var g = null;
    for(var i = 0; i < G.length; i++){
      if(Math.abs(_fstNokta(G[i].d, f.z)) >= cosT && _fstDogruMesafe(f.o, G[i].o, G[i].d) <= VE_FEAD_STP_TOL.eksenMesafe){ g = G[i]; break; }
    }
    if(!g){ g = { o: f.o, d: _fstKanonik(f.z), yuzler: [] }; G.push(g); }
    g.yuzler.push(f);
  });
  return G.sort(function(a, b){ return b.yuzler.length - a.yuzler.length; });
}

// ── 2 · PROFİL ────────────────────────────────────────────────────────────
// Kümenin eksenine göre her yüz: eksenel aralık [s0, s1] ve yarıçap aralığı.
// Sınırlar eşeksenli sınır çemberlerinden; torun tepesi/çukuru yüzün İÇİNDE
// kalıyorsa analitik (R ± r). Aynı aralığı taşıyan yarım yüzler tekilleşir.
function _fstProfil(yuzler, g){
  var cosT = Math.cos(VE_FEAD_STP_TOL.eksenAci * Math.PI / 180), tol = VE_FEAD_STP_TOL.eksenMesafe;
  var satir = {};
  yuzler.forEach(function(f){
    if(f.tip === 'PLANE'){ if(!f.z || Math.abs(_fstNokta(f.z, g.d)) < cosT) return; }
    else if(!f.z || Math.abs(_fstNokta(f.z, g.d)) < cosT || _fstDogruMesafe(f.o, g.o, g.d) > tol) return;
    var pts = [];
    f.cemberler.forEach(function(c){
      if(Math.abs(_fstNokta(c.n, g.d)) < cosT || _fstDogruMesafe(c.c, g.o, g.d) > tol) return;
      pts.push({ s: _fstNokta(_fstCikar(c.c, g.o), g.d), r: c.r });
    });
    if(!pts.length) return;
    var s0 = Infinity, s1 = -Infinity;
    pts.forEach(function(q){ if(q.s < s0) s0 = q.s; if(q.s > s1) s1 = q.s; });
    var rA = -Infinity, rB = -Infinity, rMin = Infinity, rMax = -Infinity;
    pts.forEach(function(q){
      if(Math.abs(q.s - s0) < 1e-6 && q.r > rA) rA = q.r;
      if(Math.abs(q.s - s1) < 1e-6 && q.r > rB) rB = q.r;
      if(q.r < rMin) rMin = q.r;
      if(q.r > rMax) rMax = q.r;
    });
    if(f.tip === 'TOROIDAL_SURFACE' && f.R > 0){
      var sc = _fstNokta(_fstCikar(f.o, g.o), g.d);
      if(sc > s0 - 1e-6 && sc < s1 + 1e-6){
        if(f.R + f.rk > rMax && rMax > f.R - 1e-6) rMax = f.R + f.rk;       // dış tepe
        if(f.R - f.rk < rMin && rMin < f.R + 1e-6) rMin = f.R - f.rk;       // iç çukur
      }
    }
    var r = { tip: f.tip, s0: s0, s1: s1, rA: rA, rB: rB, rMin: rMin, rMax: rMax, yariAci: f.yariAci, yuz: f.id };
    var k = [f.tip, s0.toFixed(4), s1.toFixed(4), rMin.toFixed(4), rMax.toFixed(4)].join('|');
    if(!satir[k]) satir[k] = r;
  });
  return Object.keys(satir).map(function(k){ return satir[k]; }).sort(function(a, b){ return a.s0 - b.s0 || a.rMin - b.rMin; });
}

// ── 3 · KANAL BÖLGELERİ ───────────────────────────────────────────────────
function _fstKanallar(profil){
  var T = VE_FEAD_STP_TOL;
  var yanak = profil.filter(function(r){
    return r.tip === 'CONICAL_SURFACE' && Math.abs(r.yariAci - T.yanakDer) <= T.yanakPay && r.s1 - r.s0 > 1e-6;
  }).sort(function(a, b){ return a.s0 - b.s0; });
  var V = [];
  for(var i = 0; i + 1 < yanak.length; i++){
    var a = yanak[i], b = yanak[i + 1];
    if(a.rB < a.rA && b.rB > b.rA && b.s0 - a.s1 >= -1e-6 && b.s0 - a.s1 <= 3){
      var taban = Math.min(a.rB, b.rA);
      profil.forEach(function(r){ if(r.s0 >= a.s1 - 1e-6 && r.s1 <= b.s0 + 1e-6 && r.rMin < taban) taban = r.rMin; });
      V.push({ s: (a.s1 + b.s0) / 2, taban: taban });
    }
  }
  if(V.length < 2) return [];
  // Düzenli adımla bölgelere ayır (iki ayrı kayış izi olabilir)
  var farklar = [];
  for(var j = 1; j < V.length; j++) farklar.push(V[j].s - V[j - 1].s);
  var sirali = farklar.slice().sort(function(x, y){ return x - y; });
  var adim = sirali[Math.floor(sirali.length / 2)];
  var bolgeler = [], cur = [V[0]];
  for(var k = 1; k < V.length; k++){
    if(Math.abs(V[k].s - V[k - 1].s - adim) <= 0.1) cur.push(V[k]);
    else { bolgeler.push(cur); cur = [V[k]]; }
  }
  bolgeler.push(cur);
  return bolgeler.filter(function(b){ return b.length >= 2; }).map(function(b){
    var s0 = b[0].s, s1 = b[b.length - 1].s, n = b.length;
    var ort = (s1 - s0) / (n - 1), sapma = 0;
    for(var q = 1; q < n; q++) sapma = Math.max(sapma, Math.abs(b[q].s - b[q - 1].s - ort));
    var tepe = -Infinity;
    profil.forEach(function(r){ if(r.tip !== 'PLANE' && r.s0 >= s0 - 1e-6 && r.s1 <= s1 + 1e-6 && r.rMax > tepe) tepe = r.rMax; });
    var prof = null;
    VE_FEAD_STP_PROFILLER.forEach(function(p){ if(Math.abs(p.adim - ort) <= T.adimPay) prof = p.ad; });
    return { n: n, adim: ort, adimSapma: sapma, profil: prof, s: (s0 + s1) / 2,
             od: 2 * tepe, taban: 2 * Math.min.apply(null, b.map(function(v){ return v.taban; })) };
  });
}

// ── 4 · DÜZ KASNAK ────────────────────────────────────────────────────────
// Kayışın oturduğu yüzey: en büyük yarıçaplı, yeterince GENİŞ silindir.
// Ondan büyük ama dar bir yüzey flanştır (en büyük çap olarak raporlanır,
// dış çap sayılmaz).
function _fstDuz(profil){
  var T = VE_FEAD_STP_TOL;
  var sil = profil.filter(function(r){ return r.tip === 'CYLINDRICAL_SURFACE'; });
  if(!sil.length) return null;
  var genis = sil.filter(function(r){ return r.s1 - r.s0 >= T.duzGenislik && r.rMax >= T.duzYaricap; });
  if(!genis.length) return null;
  var rk = Math.max.apply(null, genis.map(function(r){ return r.rMax; }));
  // Aynı yarıçaptaki silindirler, aralarında ÇIKINTI yoksa tek yüzeydir:
  // ortası boşaltılmış (iki basamaklı) bir avarada kayış iki basamağın
  // üstünden birden geçer. Aradaki bir yüz rk'dan büyükse (orta flanş)
  // yüzey bölünür ve en geniş parça alınır.
  var kosu = sil.filter(function(r){ return Math.abs(r.rMax - rk) < 1e-6; }).sort(function(a, b){ return a.s0 - b.s0; });
  var parcalar = [], cur = null;
  kosu.forEach(function(r){
    var cikinti = cur && profil.some(function(q){
      return q.tip !== 'PLANE' && q.rMax > rk + 1e-6 && q.s1 > cur.s1 + 1e-6 && q.s0 < r.s0 - 1e-6;
    });
    if(cur && !cikinti) cur.s1 = Math.max(cur.s1, r.s1);
    else { cur = { s0: r.s0, s1: r.s1 }; parcalar.push(cur); }
  });
  var enIyi = null;
  parcalar.forEach(function(p){ if(!enIyi || p.s1 - p.s0 > enIyi.s1 - enIyi.s0) enIyi = p; });
  if(!enIyi || enIyi.s1 - enIyi.s0 < T.duzGenislik) return null;
  return { od: 2 * rk, s: (enIyi.s0 + enIyi.s1) / 2, genislik: enIyi.s1 - enIyi.s0 };
}

// ── 5 · ANA OKUMA ─────────────────────────────────────────────────────────
// Döner (asla fırlatmaz):
//   { ok, hatalar[], uyarilar[], baslik, sureMs, parcalar[], kasnaklar[],
//     gergiler[], duzlem, bakis }
function veFeadStpOku(metin, opt){
  opt = opt || {};
  // Tarayıcıda okuyucu global (index.html'de bu dosyadan ÖNCE); Node'da modül.
  var P = null;
  if(typeof veStepP21Oku === 'function')
    P = { veStepP21Oku: veStepP21Oku, veStepP21Montaj: veStepP21Montaj, veStepP21Yuz: veStepP21Yuz, veStepP21Baslik: veStepP21Baslik };
  else if(typeof require === 'function'){ try { P = require('./step-p21.js'); } catch(e0){ P = null; } }
  var out = { ok: false, hatalar: [], uyarilar: [], baslik: null, sureMs: {}, parcalar: [], kasnaklar: [],
              gergiler: [], duzlem: null, bakis: null };
  if(!P){ out.hatalar.push('STEP okuyucusu (js/step-p21.js) yüklenmemiş.'); return out; }
  var oku = P.veStepP21Oku, montajF = P.veStepP21Montaj, yuzF = P.veStepP21Yuz, baslikF = P.veStepP21Baslik;
  var t0 = Date.now();
  var model;
  try { model = oku(metin); } catch(e){ out.hatalar.push('Dosya okunamadı: ' + e.message); return out; }
  if(model.hatalar.length){ out.hatalar = model.hatalar.slice(); return out; }
  out.baslik = baslikF(model);
  out.sureMs.oku = Date.now() - t0;
  var t1 = Date.now(), mt;
  try { mt = montajF(model); } catch(e2){ out.hatalar.push('Montaj ağacı okunamadı: ' + e2.message); return out; }
  out.uyarilar = out.uyarilar.concat(mt.uyarilar);
  out.sureMs.montaj = Date.now() - t1;
  var t2 = Date.now();
  var toplamYuz = 0;
  var gruplar = [];            // parça başına eksen kümeleri (gergi pivotu için)
  var duzAdaylar = [];         // düz kasnak adayları (seçim düzlemden sonra)
  mt.parcalar.forEach(function(p, pi){
    var rol = _fstParcaRol(p);
    var ad = (p.urun.aciklama || p.urun.ad || p.urun.id || p.ornek || '').replace(/\s*\n\s*/g, ' ').trim();
    var birim = p.birim;
    if(p.yuzler.length && !(birim.mm > 0)){
      out.uyarilar.push('"' + ad + '" parçasının uzunluk birimi okunamadı; mm varsayılmadı, parça atlandı.');
      gruplar.push([]);
      out.parcalar.push({ i: pi, ad: ad, id: p.urun.id, ornek: p.ornek, rolOneri: rol.tip, rolKaynagi: rol.kaynak,
        yuzSayisi: p.yuzler.length, kasnaklar: [] });
      return;
    }
    var yuzler = [];
    try { p.yuzler.forEach(function(f){ yuzler.push(yuzF(model, f, p.M, birim)); }); }
    catch(e3){ out.uyarilar.push('"' + ad + '" parçasının yüzleri okunamadı: ' + e3.message); }
    toplamYuz += yuzler.length;
    var G = _fstEksenler(yuzler);
    gruplar.push(G.map(function(g){ return { o: g.o, d: g.d, n: g.yuzler.length, profil: null, yuzler: yuzler }; }));
    var parca = { i: pi, ad: ad, id: p.urun.id, ornek: p.ornek, rolOneri: rol.tip, rolKaynagi: rol.kaynak,
                  yuzSayisi: yuzler.length, kasnaklar: [] };
    out.parcalar.push(parca);
    if(rol.tip === 'kayis') return;                // kayışa dokunulmaz
    // kanallı adaylar: bütün eksenlerde
    var kanalli = [];
    G.forEach(function(g, gi){
      var pr = _fstProfil(yuzler, g);
      gruplar[pi][gi].profil = pr;
      _fstKanallar(pr).forEach(function(b){
        var kenar = -Infinity;
        pr.forEach(function(r){ if(r.tip !== 'PLANE' && r.rMax > kenar) kenar = r.rMax; });
        kanalli.push({ tur: 'kanalli', parca: pi, grup: gi, od: b.od, kanal: b.n, adim: b.adim, adimSapma: b.adimSapma,
          profil: b.profil, tabanCap: b.taban, enBuyukCap: 2 * kenar,
          merkez: _fstTopla(g.o, _fstCarp(g.d, b.s)), eksen: g.d });
      });
    });
    if(kanalli.length){ kanalli.forEach(function(k){ out.kasnaklar.push(k); }); return; }
    // Düz adaylar: eksen başına biri. SEÇİM DÜZLEM BULUNDUKTAN SONRA — "en çok
    // yüzü olan eksen" gibi bir kural, gövdesi avarasından karmaşık bir
    // gergide gövdeyi kasnak sanardı.
    G.forEach(function(g, gi){
      var pr = gruplar[pi][gi].profil;
      var d = _fstDuz(pr);
      if(!d) return;
      var kenar = -Infinity;
      pr.forEach(function(r){ if(r.tip !== 'PLANE' && r.rMax > kenar) kenar = r.rMax; });
      duzAdaylar.push({ tur: 'duz', parca: pi, grup: gi, od: d.od, genislik: d.genislik, enBuyukCap: 2 * kenar,
                        merkez: _fstTopla(g.o, _fstCarp(g.d, d.s)), eksen: g.d, grupYuz: g.yuzler.length });
    });
  });

  // ── ORTAK DÜZLEM ───────────────────────────────────────────────────────
  var kaynak = out.kasnaklar.length ? out.kasnaklar : duzAdaylar;
  if(!kaynak.length){
    out.hatalar.push(toplamYuz ? 'Dosyada kasnak bulunamadı: hiçbir parçada kaburga kanalı ya da düz kasnak yüzeyi yok.'
                               : 'Dosyada okunabilir yüz yok. Dosya yalnız üçgen (tessellated) geometri taşıyor olabilir; CATIA’dan katı geometri olarak dışa aktarın.');
    out.sureMs.analiz = Date.now() - t2;
    return out;
  }
  var n = _fstYonCogunluk(kaynak.map(function(k){ return k.eksen; }));
  var konumlar = kaynak.map(function(k){ return _fstNokta(k.merkez, n); }).sort(function(a, b){ return a - b; });
  var p0 = konumlar[Math.floor(konumlar.length / 2)];
  // Düz kasnak = KAYIŞI TAŞIYAN yüzey: ekseni düzleme dik, genişliği kayışı
  // kapsıyor ve kayış düzleminde ortalanmış. Kayış genişliği kanallı
  // kasnaklardan (kanal × adım); kanallı kasnak yoksa 10 mm.
  var kg = 0;
  out.kasnaklar.forEach(function(k){ kg = Math.max(kg, k.kanal * k.adim); });
  if(!(kg > 0)) kg = 10;
  var parcaDuz = {};
  duzAdaylar.forEach(function(a){
    if(_fstAciDer(a.eksen, n) > VE_FEAD_STP_TOL.duzlemAci) return;
    var kay = Math.abs(_fstNokta(a.merkez, n) - p0);
    var kapsar = a.genislik >= kg - 1 && kay <= (a.genislik - kg) / 2 + 1;
    var kesiyor = kay <= a.genislik / 2 + 2;
    if(!kesiyor) return;
    a.puan = (kapsar ? 0 : 1000) + kay - a.grupYuz * 1e-6;
    var o = parcaDuz[a.parca];
    if(!o || a.puan < o.puan) parcaDuz[a.parca] = a;
  });
  Object.keys(parcaDuz).forEach(function(pi){ var a = parcaDuz[pi]; delete a.puan; delete a.grupYuz; out.kasnaklar.push(a); });
  out.kasnaklar.sort(function(a, b){ return a.parca - b.parca; });
  out.kasnaklar.forEach(function(k, i){ k.i = i; out.parcalar[k.parca].kasnaklar.push(i); k.rolOneri = out.parcalar[k.parca].rolOneri; });
  var sapmalar = out.kasnaklar.map(function(k){
    return { kasnak: k.i, eksenel: _fstNokta(k.merkez, n) - p0, aci: _fstAciDer(k.eksen, n) };
  });
  var eks = sapmalar.map(function(s){ return s.eksenel; });
  out.duzlem = { n: n, konum: p0, yayilim: eks.length ? Math.max.apply(null, eks) - Math.min.apply(null, eks) : 0,
                 enBuyukAci: Math.max.apply(null, sapmalar.map(function(s){ return s.aci; }).concat([0])), sapmalar: sapmalar };

  // ── GERGİ: pivot ekseni ────────────────────────────────────────────────
  out.kasnaklar.forEach(function(k){
    if(k.tur !== 'duz' || out.parcalar[k.parca].rolOneri !== 'fead-tensioner') return;
    var g = _fstPivot(out, gruplar, k);
    if(g) out.gergiler.push(g);
  });

  // ── BAKIŞ YÖNÜ ─────────────────────────────────────────────────────────
  var orijinTaraf = -p0;                       // orijinin düzleme göre eksenel konumu
  if(Math.abs(orijinTaraf) > 1) out.bakis = { d: _fstCarp(n, orijinTaraf > 0 ? 1 : -1), kaynak: 'orijin' };
  else out.bakis = { d: n.slice(), kaynak: 'varsayilan' };

  // ── UYARILAR ───────────────────────────────────────────────────────────
  var profiller = {};
  out.kasnaklar.forEach(function(k){ if(k.tur === 'kanalli') profiller[k.profil || ('adım ' + k.adim.toFixed(2))] = 1; });
  if(Object.keys(profiller).length > 1)
    out.uyarilar.push('Kanallı kasnakların profili farklı: ' + Object.keys(profiller).join(', ') + '.');
  out.kasnaklar.forEach(function(k){
    if(k.tur === 'kanalli' && !k.profil)
      out.uyarilar.push('"' + out.parcalar[k.parca].ad + '": kanal adımı ' + k.adim.toFixed(3) + ' mm hiçbir ISO 9982 profiline uymuyor.');
  });
  sapmalar.forEach(function(s){
    if(Math.abs(s.eksenel) > 0.5 || s.aci > 0.1)
      out.uyarilar.push('"' + out.parcalar[out.kasnaklar[s.kasnak].parca].ad + '" ortak düzlemden '
        + s.eksenel.toFixed(2) + ' mm eksenel, ' + s.aci.toFixed(2) + '° açısal kaçık.');
  });
  if(out.bakis.kaynak === 'varsayilan')
    out.uyarilar.push('Bakış yönü dosyadan çıkarılamadı (modelin orijini kayış düzleminde). Önden bakışı onaylayın.');
  out.sureMs.analiz = Date.now() - t2;
  out.ok = out.kasnaklar.length > 0;
  return out;
}

// Eksen yönlerinin çoğunluğu (±1°): kanonik işaretle
function _fstYonCogunluk(dirs){
  var cosT = Math.cos(VE_FEAD_STP_TOL.duzlemAci * Math.PI / 180), enIyi = null, enCok = -1;
  dirs.forEach(function(d){
    var say = 0, top = [0, 0, 0];
    dirs.forEach(function(e){ var c = _fstNokta(d, e); if(Math.abs(c) >= cosT){ say++; top = _fstTopla(top, _fstCarp(e, c < 0 ? -1 : 1)); } });
    if(say > enCok){ enCok = say; enIyi = _fstKanonik(_fstBirim(top)); }
  });
  return enIyi;
}

// Gerginin pivotu: aynı parçada (ya da aynı gergi atasına bağlı parçalarda)
// avara eksenine PARALEL, eşeksenli OLMAYAN, en çok yüzü olan eksen.
function _fstPivot(out, gruplar, k){
  var T = VE_FEAD_STP_TOL, cosT = Math.cos(0.5 * Math.PI / 180);
  var adaylar = [];
  out.parcalar.forEach(function(pp, pi){
    if(pp.rolOneri !== 'fead-tensioner') return;
    (gruplar[pi] || []).forEach(function(g){
      if(Math.abs(_fstNokta(g.d, k.eksen)) < cosT) return;
      var dist = _fstDogruMesafe(g.o, k.merkez, k.eksen);
      if(dist < T.pivotMin || dist > T.pivotMaks) return;
      adaylar.push({ o: g.o, d: g.d, yuz: g.n, kol: dist, parca: pi });
    });
  });
  if(!adaylar.length) return null;
  adaylar.sort(function(a, b){ return b.yuz - a.yuz; });
  var n = out.duzlem.n, p0 = out.duzlem.konum;
  var dz = function(a){ var t = (p0 - _fstNokta(a.o, n)) / _fstNokta(a.d, n); return _fstTopla(a.o, _fstCarp(a.d, t)); };
  var sec = adaylar[0];
  return { parca: k.parca, kasnak: k.i, pivot: dz(sec), kolBoy: sec.kol, pivotYuz: sec.yuz,
           adaylar: adaylar.slice(0, 6).map(function(a){ return { nokta: dz(a), kol: a.kol, yuz: a.yuz }; }) };
}

// ── 6 · 2B KOORDİNAT ─────────────────────────────────────────────────────
// MFSim düzlemi: x sağ, y yukarı, önden bakış. `opt.ayna` bakış yönünü çevirir,
// `opt.merkez` orijin alınacak kasnağın sırası (varsayılan: krank önerilen
// ilk kasnak, yoksa ilk kasnak).
function veFeadStp2B(sonuc, opt){
  opt = opt || {};
  var n = sonuc.duzlem.n;
  var d = sonuc.bakis.d.slice();
  if(opt.ayna) d = _fstCarp(d, -1);
  var z = [0, 0, 1], y = [0, 1, 0], x = [1, 0, 0];
  var yukari = Math.abs(_fstNokta(z, n)) < 0.95 ? z : (Math.abs(_fstNokta(y, n)) < 0.95 ? y : x);
  yukari = _fstBirim(_fstCikar(yukari, _fstCarp(n, _fstNokta(yukari, n))));
  var sag = _fstBirim(_fstVek(d, yukari));
  var mi = opt.merkez;
  if(mi == null){
    mi = 0;
    for(var i = 0; i < sonuc.kasnaklar.length; i++) if(sonuc.kasnaklar[i].rolOneri === 'fead-crank'){ mi = i; break; }
  }
  var O = sonuc.kasnaklar.length ? sonuc.kasnaklar[mi].merkez : [0, 0, 0];
  var yansit = function(p){ var w = _fstCikar(p, O); return { x: _fstNokta(w, sag), y: _fstNokta(w, yukari) }; };
  return {
    sag: sag, yukari: yukari, d: d, merkez: mi,
    kasnaklar: sonuc.kasnaklar.map(function(k){ return yansit(k.merkez); }),
    gergiler: sonuc.gergiler.map(function(g){
      var c = yansit(sonuc.kasnaklar[g.kasnak].merkez), p = yansit(g.pivot);
      var aci = Math.atan2(c.y - p.y, c.x - p.x) * 180 / Math.PI;
      if(aci < 0) aci += 360;
      return { merkez: c, pivot: p, kolAci: aci };
    })
  };
}

// ── 7 · ÖRNEK KAYDI ──────────────────────────────────────────────────────
// `secim.roller[i]`: i. kasnağın tipi (null → atlanır). Verilmezse ad önerisi.
// Sıra AĞAÇ sırasıdır: sürücü başta, gergi sonda (Gates tablo sırası).
//
// SAYILAR µm'YE YUVARLANIR (açı 0,0001°): montaj dönüşümünün kayan nokta
// gürültüsü (gerçek dosyada avara x = 190,0000163) sihirbazın alanlarına
// öyle yazılıyordu. 1 µm anlamlı her toleransın çok altında.
//
// GERGİ TEKİL: model tek gergi taşır; ikinci gergi rolü ötekinin üstüne
// sessizce yazılırdı — aktarılmaz ve söylenir.
function _fstAd(s){ return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }
function _fstYuv(x, k){ return Math.round(x * k) / k + 0; }

function veFeadStpKayit(sonuc, secim){
  secim = secim || {};
  var iki = veFeadStp2B(sonuc, { ayna: !!secim.ayna, merkez: secim.merkez });
  var uyarilar = [], pulleys = [], gergiKey = null, surucu = null;
  var katalog = secim.gergiKatalog || (typeof VE_FEAD_TENSIONER_DB !== 'undefined' ? VE_FEAD_TENSIONER_DB : []);
  var MM = 1000, DER = 10000;
  sonuc.kasnaklar.forEach(function(k, i){
    var tip = secim.roller && secim.roller[i] !== undefined ? secim.roller[i] : k.rolOneri;
    var parca = sonuc.parcalar[k.parca];
    var ad = _fstAd(parca.ad);
    if(!tip || tip === 'kayis'){ if(!tip) uyarilar.push('"' + ad + '" için rol seçilmedi; kasnak aktarılmadı.'); return; }
    if(tip === 'fead-tensioner' && gergiKey){
      uyarilar.push('"' + ad + '" ikinci gergi rolü; model tek gergi taşır, aktarılmadı.');
      return;
    }
    var key = 'S' + (i + 1);
    var xy = iki.kasnaklar[i];
    var data = { od: _fstYuv(k.od, MM), contact: k.tur === 'kanalli' ? 'grooved' : 'back' };
    if(tip === 'fead-tensioner'){
      var gi = -1;
      sonuc.gergiler.forEach(function(g, j){ if(g.kasnak === i) gi = j; });
      if(gi < 0){
        uyarilar.push('"' + ad + '": gerginin pivot ekseni bulunamadı; kol boyu ve açısı elle girilmeli.');
        data.cenX = _fstYuv(xy.x, MM); data.cenY = _fstYuv(xy.y, MM);
      } else {
        var gg = iki.gergiler[gi];
        data.cenX = _fstYuv(gg.merkez.x, MM); data.cenY = _fstYuv(gg.merkez.y, MM);
        data.armLen = _fstYuv(sonuc.gergiler[gi].kolBoy, MM);
        data.armMeanDeg = _fstYuv(gg.kolAci, DER);
      }
      var metin = _fstKatla([parca.ad, parca.id].join(' '));
      var kodlar = {};
      katalog.forEach(function(r){ if(r.part && metin.indexOf(_fstKatla(r.part).trim()) >= 0) kodlar[r.part] = 1; });
      var kk = Object.keys(kodlar);
      if(kk.length === 1) data.tenPart = kk[0];
      gergiKey = key;
    } else {
      data.x = _fstYuv(xy.x, MM); data.y = _fstYuv(xy.y, MM);
      if(tip === 'fead-crank' && !surucu){ data.driver = true; surucu = key; }
      if(k.tur === 'duz' && tip !== 'fead-idler')
        uyarilar.push('"' + ad + '" düz yüzeyli ama rolü ' + tip + '; temas tarafı sırt (back) yazıldı, kontrol edin.');
    }
    pulleys.push({ key: key, type: tip, name: ad, data: data });
  });
  if(!surucu) uyarilar.push('Sürücü (krank) kasnağı seçilmedi.');
  if(!gergiKey) uyarilar.push('Gergi seçilmedi.');
  var route = [];
  if(surucu) route.push(surucu);
  pulleys.forEach(function(p){ if(p.key !== surucu && p.key !== gergiKey) route.push(p.key); });
  if(gergiKey) route.push(gergiKey);
  uyarilar.push('Kayış sırası dosyadan okunmadı; ağaç sırasıyla dizildi. Sırayı Kasnaklar adımında verin.');
  return {
    name: secim.ad || (sonuc.baslik && sonuc.baslik.dosya ? sonuc.baslik.dosya.replace(/^.*[\\\/]/, '').replace(/\.[^.]*$/, '') : 'STEP'),
    pulleys: pulleys, route: route, siraKaynagi: 'agac',
    bakis: { ayna: !!secim.ayna, kaynak: sonuc.bakis.kaynak },
    uyarilar: uyarilar
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    VE_FEAD_STP_SURUM: VE_FEAD_STP_SURUM,
    VE_FEAD_STP_PROFILLER: VE_FEAD_STP_PROFILLER,
    VE_FEAD_STP_TOL: VE_FEAD_STP_TOL,
    veFeadStpRol: veFeadStpRol,
    veFeadStpOku: veFeadStpOku,
    veFeadStp2B: veFeadStp2B,
    veFeadStpKayit: veFeadStpKayit
  };
}
