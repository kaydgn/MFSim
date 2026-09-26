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
// ── ÖNCE ROL, SONRA ANALİZ ───────────────────────────────────────────────
// Kullanıcı kararı (2026-09-26): *"program biz seçtikten sonra çıkaracak;
// yoksa farklı dosyalarda problem yaşayabiliriz."* Dosya bütünüyle
// TARANMAZ: `veFeadStpOku` yalnız ürün ağacını ve yüzleri çıkarır; kasnak,
// kayış düzlemi ve gergi ANCAK kullanıcı bir düğüme rol verdikten sonra ve
// YALNIZ o düğümün parçalarında aranır (`veFeadStpCoz`). Ad hiçbir şeye
// karar vermez (başka bir dosyada "ALT" başka bir şey olabilir) ve rol
// geometriden tahmin edilmez ("en büyük kanallı kasnak kranktır" sessizce
// yanlış bir sürücü seçerdi). Rol YÜZEYİ SEÇMEZ: düzlemdeki bir kanal
// bölgesi kasnağı kaburgalı yapar (kaburgalı avara da vardır), yoksa kayışı
// taşıyan düz yüzey alınır. Rol, modelde parçanın NE olduğunu söyler:
// sürücü, gergi ve gerginin pivotu.
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

var VE_FEAD_STP_SURUM = '2.0.0';

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

// Türkçe harf katlama: gerginin parça kodunu katalogda aramak için (ad bir
// şeye KARAR vermez; yalnız kod eşleşmesi).
function _fstKatla(s){
  return String(s == null ? '' : s)
    .replace(/[İIı]/g, 'I').replace(/[Şş]/g, 'S').replace(/[Ğğ]/g, 'G').replace(/[Üü]/g, 'U')
    .replace(/[Öö]/g, 'O').replace(/[Çç]/g, 'C').toUpperCase().replace(/[^A-Z0-9\/]+/g, ' ');
}
function _fstAd(s){ return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }

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

// ── 5 · OKUMA: ağaç ve yüzler (analiz YOK) ───────────────────────────────
// Döner (asla fırlatmaz):
//   { ok, hatalar[], uyarilar[], baslik, sureMs,
//     agac[]     — { i, ad, id, ornek, derinlik, ebeveyn, cocuklar[], parcalar[] }
//                  `parcalar`: düğümün ALTINDAKİ bütün geometrili parçalar
//     parcalar[] — { i, ad, id, ornek, dugum, yuzSayisi }
//     _yuz[]     — parça başına analitik yüzler (dünya koordinatı, mm) }
// Kasnak ARANMAZ: kullanıcı rol verene kadar hiçbir parça "kasnak" sayılmaz.
function veFeadStpOku(metin){
  // Tarayıcıda okuyucu global (index.html'de bu dosyadan ÖNCE); Node'da modül.
  var P = null;
  if(typeof veStepP21Oku === 'function')
    P = { veStepP21Oku: veStepP21Oku, veStepP21Montaj: veStepP21Montaj, veStepP21Yuz: veStepP21Yuz, veStepP21Baslik: veStepP21Baslik };
  else if(typeof require === 'function'){ try { P = require('./step-p21.js'); } catch(e0){ P = null; } }
  var out = { ok: false, hatalar: [], uyarilar: [], baslik: null, sureMs: {}, agac: [], parcalar: [], _yuz: [] };
  if(!P){ out.hatalar.push('STEP okuyucusu (js/step-p21.js) yüklenmemiş.'); return out; }
  var t0 = Date.now(), model, mt;
  try { model = P.veStepP21Oku(metin); } catch(e){ out.hatalar.push('Dosya okunamadı: ' + e.message); return out; }
  if(model.hatalar.length){ out.hatalar = model.hatalar.slice(); return out; }
  out.baslik = P.veStepP21Baslik(model);
  out.sureMs.oku = Date.now() - t0;
  var t1 = Date.now();
  try { mt = P.veStepP21Montaj(model); } catch(e2){ out.hatalar.push('Montaj ağacı okunamadı: ' + e2.message); return out; }
  out.uyarilar = out.uyarilar.concat(mt.uyarilar);
  out.sureMs.montaj = Date.now() - t1;

  // ── AĞAÇ: örnek yolunun her öneki bir düğüm (kök · alt montaj · parça) ──
  var anahtar = {};
  function dugum(yol, urun, ebeveyn){
    var k = yol.join('\u0001');
    if(anahtar[k] !== undefined) return anahtar[k];
    var i = out.agac.length;
    out.agac.push({ i: i, ad: _fstAd(urun.aciklama || urun.ad || urun.id || yol[yol.length - 1] || ''),
      id: urun.id || '', ornek: yol.length ? yol[yol.length - 1] : '', derinlik: yol.length,
      ebeveyn: ebeveyn, cocuklar: [], parcalar: [] });
    anahtar[k] = i;
    if(ebeveyn >= 0) out.agac[ebeveyn].cocuklar.push(i);
    return i;
  }
  var t2 = Date.now(), toplamYuz = 0;
  mt.parcalar.forEach(function(p){
    var e = -1;
    for(var k = 0; k < p.yol.length; k++)
      e = dugum(p.yol.slice(0, k), p.atalar[k] || { id: '', ad: '', aciklama: '' }, e);
    var d = dugum(p.yol, p.urun, e);
    var ad = out.agac[d].ad;
    var yuzler = [];
    if(p.yuzler.length && !(p.birim.mm > 0))
      out.uyarilar.push('"' + ad + '" parçasının uzunluk birimi okunamadı; mm varsayılmadı, parça atlandı.');
    else {
      try { p.yuzler.forEach(function(f){ yuzler.push(P.veStepP21Yuz(model, f, p.M, p.birim)); }); }
      catch(e3){ out.uyarilar.push('"' + ad + '" parçasının yüzleri okunamadı: ' + e3.message); }
    }
    toplamYuz += yuzler.length;
    var pi = out.parcalar.length;
    out.parcalar.push({ i: pi, ad: ad, id: p.urun.id, ornek: p.ornek, dugum: d, yuzSayisi: yuzler.length });
    out._yuz.push(yuzler);
    for(var a = d; a >= 0; a = out.agac[a].ebeveyn) out.agac[a].parcalar.push(pi);
  });
  out.sureMs.yuz = Date.now() - t2;
  if(!toplamYuz){
    out.hatalar.push('Dosyada okunabilir yüz yok. Dosya yalnız üçgen (tessellated) geometri taşıyor olabilir; CATIA’dan katı geometri olarak dışa aktarın.');
    return out;
  }
  out.ok = true;
  return out;
}

// ── 5b · ÇÖZÜM: yalnız ROL VERİLEN düğümler ───────────────────────────────
// `roller[dugumIndisi]` = kasnak tipi ('fead-crank' · 'fead-idler' ·
// 'fead-tensioner' …). Rol verilen düğüm bir BİRİMDİR: altındaki bütün
// parçalar tek kasnak (gergide: kasnak + pivot) olarak incelenir — tedarikçi
// gergiyi çoğu zaman alt montaj olarak verir (kol · gövde · kasnak ayrı
// parça). Bir parça tek birime aittir: rollü iki ata varsa EN YAKINI alır.
// Döner (asla fırlatmaz):
//   { ok, hatalar[], uyarilar[], baslik, birimler[], kasnaklar[], gergiler[], duzlem, bakis }
//
// KAYIŞ DÜZLEMİ EN ÇOK BİRİMİ OTURTAN KONUMDUR, ortanca değil: iki izli bir
// krank damperi ya da seçilmiş bir parçadaki ikinci kanal bölgesi ortancayı
// kaydırırdı. Konum adayları kanallı bölgelerden (yoksa düz yüzeylerden)
// gelir; her birim düzleme oturan adaylarından BİRİYLE temsil edilir.
function veFeadStpCoz(sonuc, roller){
  var T = VE_FEAD_STP_TOL;
  var out = { ok: false, hatalar: [], uyarilar: [], baslik: sonuc && sonuc.baslik, birimler: [],
              kasnaklar: [], gergiler: [], duzlem: null, bakis: null };
  if(!sonuc || !sonuc.ok){ out.hatalar.push('Okunmuş bir STEP dosyası yok.'); return out; }
  roller = roller || [];
  // ── BİRİMLER ───────────────────────────────────────────────────────────
  var birimDugum = {};
  sonuc.agac.forEach(function(d){
    if(!roller[d.i]) return;
    birimDugum[d.i] = out.birimler.length;
    out.birimler.push({ i: out.birimler.length, dugum: d.i, tip: roller[d.i], ad: d.ad, parcalar: [], adaylar: [], _G: [] });
  });
  if(!out.birimler.length){ out.hatalar.push('Hiçbir parçaya rol verilmedi.'); return out; }
  sonuc.parcalar.forEach(function(p){
    for(var a = p.dugum; a >= 0; a = sonuc.agac[a].ebeveyn)
      if(birimDugum[a] !== undefined){ out.birimler[birimDugum[a]].parcalar.push(p.i); return; }
  });
  // Parça kodu aramasının metni: birimin parçalarının adları ve kimlikleri
  out.birimler.forEach(function(b){
    b.kimlikler = b.parcalar.map(function(pi){ var q = sonuc.parcalar[pi]; return q.ad + ' ' + (q.id || ''); });
  });
  // ── ADAYLAR: birimin eksen kümelerinde kanal bölgeleri ve düz yüzeyler ──
  var tum = [];
  out.birimler.forEach(function(b){
    var yuzler = [];
    b.parcalar.forEach(function(pi){ yuzler = yuzler.concat(sonuc._yuz[pi] || []); });
    _fstEksenler(yuzler).forEach(function(g, gi){
      var pr = _fstProfil(yuzler, g), kenar = -Infinity;
      pr.forEach(function(r){ if(r.tip !== 'PLANE' && r.rMax > kenar) kenar = r.rMax; });
      b._G.push({ o: g.o, d: g.d, n: g.yuzler.length });
      _fstKanallar(pr).forEach(function(z){
        b.adaylar.push({ tur: 'kanalli', birim: b.i, grup: gi, od: z.od, kanal: z.n, adim: z.adim,
          adimSapma: z.adimSapma, profil: z.profil, tabanCap: z.taban, enBuyukCap: 2 * kenar,
          genislik: z.n * z.adim, merkez: _fstTopla(g.o, _fstCarp(g.d, z.s)), eksen: g.d });
      });
      var dz = _fstDuz(pr);
      if(dz) b.adaylar.push({ tur: 'duz', birim: b.i, grup: gi, od: dz.od, genislik: dz.genislik,
        enBuyukCap: 2 * kenar, merkez: _fstTopla(g.o, _fstCarp(g.d, dz.s)), eksen: g.d, grupYuz: g.yuzler.length });
    });
    b.adaylar.forEach(function(a){ tum.push(a); });
    if(!b.adaylar.length) out.uyarilar.push('"' + b.ad + '": kasnak yüzeyi (kaburga kanalı ya da düz yüzey) bulunamadı; aktarılmaz.');
  });
  if(!tum.length){ out.hatalar.push('Rol verilen parçalarda kasnak yüzeyi bulunamadı.'); return out; }

  // ── ORTAK DÜZLEM ───────────────────────────────────────────────────────
  var kanalliVar = tum.some(function(a){ return a.tur === 'kanalli'; });
  var n = _fstYonCogunluk(tum.filter(function(a){ return !kanalliVar || a.tur === 'kanalli'; }).map(function(a){ return a.eksen; }));
  var paralel = function(a){ return _fstAciDer(a.eksen, n) <= T.duzlemAci; };
  var kay = function(a, p){ return Math.abs(_fstNokta(a.merkez, n) - p); };
  var oturur = function(a, p){ return a.tur === 'kanalli' ? kay(a, p) <= 2 : kay(a, p) <= a.genislik / 2 + 2; };
  var enIyi = null;
  tum.forEach(function(ref){
    if(!paralel(ref) || (kanalliVar && ref.tur !== 'kanalli')) return;
    var p = _fstNokta(ref.merkez, n), birimSay = 0, kanalliSay = 0;
    out.birimler.forEach(function(b){
      var ot = b.adaylar.filter(function(a){ return paralel(a) && oturur(a, p); });
      if(ot.length) birimSay++;
      if(ot.some(function(a){ return a.tur === 'kanalli'; })) kanalliSay++;
    });
    var puan = birimSay * 1000 + kanalliSay;
    if(!enIyi || puan > enIyi.puan) enIyi = { p: p, puan: puan };
  });
  // Oturan kanallı bölgelerin ortancası: referans bölgenin kendi küçük
  // kaçıklığı düzleme taşınmasın.
  var ref = tum.filter(function(a){ return paralel(a) && (!kanalliVar || a.tur === 'kanalli') && oturur(a, enIyi.p); })
    .map(function(a){ return _fstNokta(a.merkez, n); }).sort(function(a, b){ return a - b; });
  var p0 = ref.length ? ref[Math.floor(ref.length / 2)] : enIyi.p;

  // ── BİRİM BAŞINA SEÇİM ─────────────────────────────────────────────────
  // Düz yüzey = KAYIŞI TAŞIYAN yüzey: genişliği kayışı (kanal × adım)
  // kapsıyor ve düzlemde ortalanmış; kapsamıyorsa yine de düzlemi kesmeli.
  var kg = 0;
  tum.forEach(function(a){ if(a.tur === 'kanalli' && paralel(a) && kay(a, p0) <= 2) kg = Math.max(kg, a.genislik); });
  if(!(kg > 0)) kg = 10;
  out.birimler.forEach(function(b){
    var kanalli = b.adaylar.filter(function(a){ return a.tur === 'kanalli' && paralel(a) && kay(a, p0) <= 2; })
      .sort(function(x, y){ return kay(x, p0) - kay(y, p0); })[0] || null;
    var duz = null;
    b.adaylar.forEach(function(a){
      if(a.tur !== 'duz' || !paralel(a)) return;
      var k = kay(a, p0);
      if(k > a.genislik / 2 + 2) return;
      var kapsar = a.genislik >= kg - 1 && k <= (a.genislik - kg) / 2 + 1;
      var puan = (kapsar ? 0 : 1000) + k - a.grupYuz * 1e-6;
      if(!duz || puan < duz.puan) duz = { a: a, puan: puan };
    });
    duz = duz && duz.a;
    // KANAL VARSA KABURGALI, rol ne olursa olsun: kaburgalı kasnağın kanal
    // tepeleri arasındaki silindirler de birleşip kayışı "kapsayan" bir düz
    // aday kurar — "avarada önce düz" diyen bir kural kaburgalı avarayı
    // sırttan temaslı okurdu.
    var sec = kanalli || duz;
    if(!sec){
      if(b.adaylar.length) out.uyarilar.push('"' + b.ad + '": kasnak yüzeyi kayış düzleminde değil; aktarılmaz.');
      return;
    }
    var k = { i: out.kasnaklar.length, birim: b.i, dugum: b.dugum, tip: b.tip, ad: b.ad, tur: sec.tur,
              od: sec.od, genislik: sec.genislik, enBuyukCap: sec.enBuyukCap, merkez: sec.merkez, eksen: sec.eksen };
    if(sec.tur === 'kanalli'){ k.kanal = sec.kanal; k.adim = sec.adim; k.adimSapma = sec.adimSapma; k.profil = sec.profil; k.tabanCap = sec.tabanCap; }
    b.kasnak = k.i;
    out.kasnaklar.push(k);
  });
  var sapmalar = out.kasnaklar.map(function(k){
    return { kasnak: k.i, eksenel: _fstNokta(k.merkez, n) - p0, aci: _fstAciDer(k.eksen, n) };
  });
  var eks = sapmalar.map(function(s){ return s.eksenel; });
  out.duzlem = { n: n, konum: p0, yayilim: eks.length ? Math.max.apply(null, eks) - Math.min.apply(null, eks) : 0,
                 enBuyukAci: Math.max.apply(null, sapmalar.map(function(s){ return s.aci; }).concat([0])), sapmalar: sapmalar };

  // ── GERGİ: pivot ekseni, birimin KENDİ parçalarında ─────────────────────
  out.kasnaklar.forEach(function(k){
    if(k.tip !== 'fead-tensioner') return;
    var g = _fstPivot(out.birimler[k.birim], k, n, p0);
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
      out.uyarilar.push('"' + k.ad + '": kanal adımı ' + k.adim.toFixed(3) + ' mm hiçbir ISO 9982 profiline uymuyor.');
  });
  sapmalar.forEach(function(s){
    if(Math.abs(s.eksenel) > 0.5 || s.aci > 0.1)
      out.uyarilar.push('"' + out.kasnaklar[s.kasnak].ad + '" ortak düzlemden '
        + s.eksenel.toFixed(2) + ' mm eksenel, ' + s.aci.toFixed(2) + '° açısal kaçık.');
  });
  if(out.bakis.kaynak === 'varsayilan')
    out.uyarilar.push('Bakış yönü dosyadan çıkarılamadı (modelin orijini kayış düzleminde). Önden bakışı onaylayın.');
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

// Gerginin pivotu: gergi BİRİMİNİN eksen kümelerinde avara eksenine PARALEL,
// eşeksenli OLMAYAN (kol aralığında), en çok yüzü olan eksen.
function _fstPivot(b, k, n, p0){
  var T = VE_FEAD_STP_TOL, cosT = Math.cos(0.5 * Math.PI / 180);
  var adaylar = [];
  b._G.forEach(function(g){
    if(Math.abs(_fstNokta(g.d, k.eksen)) < cosT) return;
    var dist = _fstDogruMesafe(g.o, k.merkez, k.eksen);
    if(dist < T.pivotMin || dist > T.pivotMaks) return;
    adaylar.push({ o: g.o, d: g.d, yuz: g.n, kol: dist });
  });
  if(!adaylar.length) return null;
  adaylar.sort(function(x, y){ return y.yuz - x.yuz; });
  var dz = function(a){ var t = (p0 - _fstNokta(a.o, n)) / _fstNokta(a.d, n); return _fstTopla(a.o, _fstCarp(a.d, t)); };
  var sec = adaylar[0];
  return { birim: k.birim, kasnak: k.i, pivot: dz(sec), kolBoy: sec.kol, pivotYuz: sec.yuz,
           adaylar: adaylar.slice(0, 6).map(function(a){ return { nokta: dz(a), kol: a.kol, yuz: a.yuz }; }) };
}

// ── 6 · 2B KOORDİNAT ─────────────────────────────────────────────────────
// MFSim düzlemi: x sağ, y yukarı, önden bakış. `opt.ayna` bakış yönünü çevirir,
// `opt.merkez` orijin alınacak kasnağın sırası (varsayılan: krank rolündeki
// ilk kasnak, yoksa ilk kasnak). `sonuc` = veFeadStpCoz çıktısı.
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
    for(var i = 0; i < sonuc.kasnaklar.length; i++) if(sonuc.kasnaklar[i].tip === 'fead-crank'){ mi = i; break; }
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
// `cozum` = veFeadStpCoz çıktısı (rol kasnağın kendisinde, `tip`).
// Sıra AĞAÇ sırasıdır: sürücü başta, gergi sonda (Gates tablo sırası).
//
// SAYILAR µm'YE YUVARLANIR (açı 0,0001°): montaj dönüşümünün kayan nokta
// gürültüsü (gerçek dosyada avara x = 190,0000163) sihirbazın alanlarına
// öyle yazılıyordu. 1 µm anlamlı her toleransın çok altında.
//
// GERGİ TEKİL: model tek gergi taşır; ikinci gergi rolü ötekinin üstüne
// sessizce yazılırdı — aktarılmaz ve söylenir.
function _fstYuv(x, k){ return Math.round(x * k) / k + 0; }

function veFeadStpKayit(cozum, secim){
  secim = secim || {};
  var iki = veFeadStp2B(cozum, { ayna: !!secim.ayna, merkez: secim.merkez });
  var uyarilar = [], pulleys = [], gergiKey = null, surucu = null;
  var katalog = secim.gergiKatalog || (typeof VE_FEAD_TENSIONER_DB !== 'undefined' ? VE_FEAD_TENSIONER_DB : []);
  var MM = 1000, DER = 10000;
  cozum.kasnaklar.forEach(function(k, i){
    var tip = k.tip, ad = _fstAd(k.ad);
    if(tip === 'fead-tensioner' && gergiKey){
      uyarilar.push('"' + ad + '" ikinci gergi rolü; model tek gergi taşır, aktarılmadı.');
      return;
    }
    var key = 'S' + (i + 1);
    var xy = iki.kasnaklar[i];
    var data = { od: _fstYuv(k.od, MM), contact: k.tur === 'kanalli' ? 'grooved' : 'back' };
    if(tip === 'fead-tensioner'){
      var gi = -1;
      cozum.gergiler.forEach(function(g, j){ if(g.kasnak === i) gi = j; });
      if(gi < 0){
        uyarilar.push('"' + ad + '": gerginin pivot ekseni bulunamadı; kol boyu ve açısı elle girilmeli.');
        data.cenX = _fstYuv(xy.x, MM); data.cenY = _fstYuv(xy.y, MM);
      } else {
        var gg = iki.gergiler[gi];
        data.cenX = _fstYuv(gg.merkez.x, MM); data.cenY = _fstYuv(gg.merkez.y, MM);
        data.armLen = _fstYuv(cozum.gergiler[gi].kolBoy, MM);
        data.armMeanDeg = _fstYuv(gg.kolAci, DER);
      }
      // Parça kodu birimin adından ve kimliklerinden aranır; yalnız katalogda
      // TEK kod eşleşirse yazılır (FEAD kural 19'un gerekçesi).
      var b = cozum.birimler[k.birim] || {};
      var metin = _fstKatla([ad].concat(b.kimlikler || []).join(' '));
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
  var bas = cozum.baslik || {};
  return {
    name: secim.ad || (bas.dosya ? bas.dosya.replace(/^.*[\\\/]/, '').replace(/\.[^.]*$/, '') : 'STEP'),
    pulleys: pulleys, route: route, siraKaynagi: 'agac',
    bakis: { ayna: !!secim.ayna, kaynak: cozum.bakis.kaynak },
    uyarilar: uyarilar
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    VE_FEAD_STP_SURUM: VE_FEAD_STP_SURUM,
    VE_FEAD_STP_PROFILLER: VE_FEAD_STP_PROFILLER,
    VE_FEAD_STP_TOL: VE_FEAD_STP_TOL,
    veFeadStpOku: veFeadStpOku,
    veFeadStpCoz: veFeadStpCoz,
    veFeadStp2B: veFeadStp2B,
    veFeadStpKayit: veFeadStpKayit
  };
}
