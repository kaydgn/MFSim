// ============================================================================
//  STEP (ISO 10303-21) OKUYUCUSU — DOM'suz, saf JS
// ============================================================================
// Bir STEP dosyasını METİN olarak okur, varlıkları kimliğiyle tutar ve yalnız
// sorulanı çözer. Montaj ağacını, parçaların montajdaki konumunu ve bir yüzün
// analitik tanımını (eksen · yarıçap · sınır çemberleri) verir. Anlam
// yüklemez: "bu parça kasnak mı" sorusunun yeri js/fead-step.js.
//
// ── NEDEN OCCT DEĞİL ──────────────────────────────────────────────────────
// Yapısal Analiz döneminde STEP OpenCascade ile okunuyordu ve iki bedeli
// vardı: (1) BOYUT — hafif sürümü bile gömülü 3,96 MB, tam çekirdek 17,5 MB;
// tek dosya bugün gönderim sınırının ~2,7 MiB altında. (2) ÜÇGEN — o okuyucu
// STEP'i üçgene çevirip veriyordu; dosyada TAM SAYI olarak yazan yarıçap
// (`CYLINDRICAL_SURFACE(yerleşim, 73.5)`) kayboluyor, üçgenlerden geri tahmin
// edilmesi gerekiyordu. Kasnak bir torna parçası; yüzleri silindir, koni, tor
// ve düzlem. Ölçülecek her sayı dosyada zaten yazılı — okumak yeterli.
//
// ── TEMBEL ÇÖZÜM ─────────────────────────────────────────────────────────
// Kayıtlar ham metin olarak tutulur, argümanlar ilk sorulduğunda ayrıştırılıp
// önbelleğe alınır. Büyük dosyanın gövdesi B-spline kontrol noktalarıdır;
// FEAD onlara hiç dokunmaz.
//
// ── BİRİM TAHMİN EDİLMEZ ─────────────────────────────────────────────────
// Uzunluk ve düzlem açısı birimi temsilin kendi bağlamından
// (GLOBAL_UNIT_ASSIGNED_CONTEXT) okunur. Aynı dosyada birden çok birim tanımı
// olabiliyor (NIST'in CATIA çıktısında mm ile inch yan yana duruyor); "ilk
// bulunan" birimi almak sessizce yanlış ölçek demekti. Çıktı her zaman
// mm ve DERECE'dir.
//
// ── MONTAJ: CDSR + RRWT + IDT ────────────────────────────────────────────
// Parçanın konumu CAx-IF'in önerdiği kalıptan okunur:
//   NEXT_ASSEMBLY_USAGE_OCCURRENCE (ebeveyn PD → çocuk PD)
//   → PRODUCT_DEFINITION_SHAPE → CONTEXT_DEPENDENT_SHAPE_REPRESENTATION
//   → REPRESENTATION_RELATIONSHIP_WITH_TRANSFORMATION → ITEM_DEFINED_TRANSFORMATION
// CATIA V5 ve 3DEXPERIENCE bu kalıbı yazıyor. MAPPED_ITEM ile konumlandırılmış
// montaj DESTEKLENMİYOR ve bu SESSİZ geçilmez: uyarı listesine yazılır.
// ============================================================================

var VE_STEP_P21_SURUM = '1.0.0';

// ── 1 · KAYITLAR ──────────────────────────────────────────────────────────
// Metni ';' ile biten ifadelere böler; dize ('...') ve yorum (/* */) içindeki
// karakterler ayırıcı sayılmaz. HEADER ifadeleri adıyla, DATA kayıtları
// kimliğiyle tutulur.
function veStepP21Oku(metin){
  var s = String(metin == null ? '' : metin);
  var model = { kayit: {}, onbellek: {}, baslik: {}, adet: 0, enBuyukId: 0, hatalar: [] };
  if(s.indexOf('ISO-10303-21') < 0){
    model.hatalar.push('Dosya bir STEP dosyası değil (ISO-10303-21 başlığı yok).');
    return model;
  }
  var n = s.length, i = 0, parcaBas = 0, parcalar = [], dize = false, bolum = '';
  while(i < n){
    var c = s.charCodeAt(i);
    if(dize){
      if(c === 39){ if(s.charCodeAt(i + 1) === 39){ i += 2; continue; } dize = false; }
      i++; continue;
    }
    if(c === 39){ dize = true; i++; continue; }
    if(c === 47 && s.charCodeAt(i + 1) === 42){               // /* yorum */
      parcalar.push(s.slice(parcaBas, i));
      var son = s.indexOf('*/', i + 2);
      i = son < 0 ? n : son + 2;
      parcaBas = i;
      continue;
    }
    if(c === 59){                                             // ;
      parcalar.push(s.slice(parcaBas, i));
      var ifade = (parcalar.length === 1 ? parcalar[0] : parcalar.join('')).trim();
      parcalar = [];
      parcaBas = i + 1;
      bolum = _stpIfade(model, ifade, bolum);
    }
    i++;
  }
  return model;
}

function _stpIfade(model, ifade, bolum){
  if(!ifade) return bolum;
  if(ifade === 'HEADER') return 'baslik';
  if(ifade === 'ENDSEC') return '';
  if(ifade === 'DATA' || ifade.indexOf('DATA(') === 0) return 'veri';
  if(bolum === 'veri'){
    if(ifade.charCodeAt(0) !== 35) return bolum;              // # ile başlamayan
    var esit = ifade.indexOf('=');
    if(esit < 0) return bolum;
    var id = +ifade.slice(1, esit);
    if(!(id > 0)) return bolum;
    model.kayit[id] = ifade.slice(esit + 1).trim();
    model.adet++;
    if(id > model.enBuyukId) model.enBuyukId = id;
    return bolum;
  }
  if(bolum === 'baslik'){
    var p = ifade.indexOf('(');
    if(p > 0){
      var ad = ifade.slice(0, p).trim().toUpperCase();
      try { model.baslik[ad] = _stpArgumanlar(ifade.slice(p)); } catch(e) { model.baslik[ad] = null; }
    }
  }
  return bolum;
}

// ── 2 · ARGÜMANLAR ─────────────────────────────────────────────────────────
// Dönen biçim: sayı · {s: dize} · {ref: kimlik} · {e: numaralandırma} ·
// {tip: 'LENGTH_MEASURE', a: [...]} (tipli parametre) · [liste] · null ($ ve *)
function _stpArgumanlar(src){
  var i = 0, n = src.length;
  function bosluk(){
    while(i < n){ var c = src.charCodeAt(i); if(c === 32 || c === 9 || c === 10 || c === 13) i++; else break; }
  }
  function deger(){
    bosluk();
    var c = src.charCodeAt(i), j;
    if(c === 40){                                             // (
      i++;
      var liste = [];
      bosluk();
      if(src.charCodeAt(i) === 41){ i++; return liste; }
      for(;;){
        liste.push(deger());
        bosluk();
        var d = src.charCodeAt(i);
        if(d === 44){ i++; continue; }
        if(d === 41){ i++; return liste; }
        throw new Error('STEP: listede beklenmeyen karakter "' + src.charAt(i) + '"');
      }
    }
    if(c === 39){                                             // '...'
      var ham = '';
      j = i + 1;
      for(;;){
        var k = src.indexOf("'", j);
        if(k < 0) throw new Error('STEP: kapanmayan dize');
        ham += src.slice(j, k);
        if(src.charCodeAt(k + 1) === 39){ ham += "'"; j = k + 2; continue; }
        i = k + 1;
        break;
      }
      return { s: veStepP21Coz(ham) };
    }
    if(c === 35){                                             // #kimlik
      j = i + 1;
      while(j < n){ var q = src.charCodeAt(j); if(q >= 48 && q <= 57) j++; else break; }
      var ref = +src.slice(i + 1, j);
      i = j;
      return { ref: ref };
    }
    if(c === 46){                                             // .ENUM.
      j = src.indexOf('.', i + 1);
      var e = src.slice(i + 1, j);
      i = j + 1;
      return { e: e.toUpperCase() };
    }
    if(c === 36 || c === 42){ i++; return null; }             // $ ve *
    if(c === 34){                                             // "ikili"
      j = src.indexOf('"', i + 1);
      var b = src.slice(i + 1, j);
      i = j + 1;
      return { b: b };
    }
    if(c === 45 || c === 43 || (c >= 48 && c <= 57)){        // sayı
      j = i + 1;
      while(j < n){
        var r = src.charCodeAt(j);
        if((r >= 48 && r <= 57) || r === 46 || r === 69 || r === 101 || r === 45 || r === 43) j++; else break;
      }
      var v = parseFloat(src.slice(i, j));
      i = j;
      return v;
    }
    if((c >= 65 && c <= 90) || (c >= 97 && c <= 122) || c === 95){   // TİP(...)
      j = i;
      while(j < n){
        var t = src.charCodeAt(j);
        if((t >= 65 && t <= 90) || (t >= 97 && t <= 122) || (t >= 48 && t <= 57) || t === 95) j++; else break;
      }
      var tip = src.slice(i, j).toUpperCase();
      i = j;
      bosluk();
      if(src.charCodeAt(i) === 40) return { tip: tip, a: deger() };
      return { tip: tip, a: null };
    }
    throw new Error('STEP: beklenmeyen karakter "' + src.charAt(i) + '"');
  }
  return deger();
}

// Karmaşık varlık: (A(...) B(...) C()) → [{t, a}, ...]
function _stpKarmasik(ham){
  var parcalar = [], i = 1, n = ham.length;
  while(i < n){
    while(i < n && /[\s)]/.test(ham.charAt(i))) i++;
    if(i >= n) break;
    var p = ham.indexOf('(', i);
    if(p < 0) break;
    var ad = ham.slice(i, p).trim().toUpperCase();
    // eşleşen kapanışı bul (dize duyarlı)
    var derinlik = 0, j = p, dize = false;
    for(; j < n; j++){
      var c = ham.charCodeAt(j);
      if(dize){ if(c === 39){ if(ham.charCodeAt(j + 1) === 39) j++; else dize = false; } continue; }
      if(c === 39){ dize = true; continue; }
      if(c === 40) derinlik++;
      else if(c === 41){ derinlik--; if(derinlik === 0) break; }
    }
    parcalar.push({ t: ad, a: _stpArgumanlar(ham.slice(p, j + 1)) });
    i = j + 1;
  }
  return parcalar;
}

// ── 3 · DİZE ÇÖZÜCÜ ─────────────────────────────────────────────────────
// \X2\hhhh…\X0\ (UTF-16) · \X4\hhhhhhhh…\X0\ (UCS-4) · \X\hh (ISO 8859-1) ·
// \S\c (c + 128) · \P?\ (kod sayfası — yok sayılır) · \\ (ters bölü).
// CATIA/3DEXPERIENCE Türkçe harfleri ve "Ø"yu \X2\ ile yazıyor
// ("KRANK KASNAK-\X2\00D8\X0\147"). Dizenin içindeki fiziksel satır sonu
// değerin parçası DEĞİLDİR (dosya uzun satırı bölebilir).
function veStepP21Coz(ham){
  var s = String(ham == null ? '' : ham).replace(/[\r\n]/g, '');
  if(s.indexOf('\\') < 0) return s;
  var out = '', i = 0, n = s.length;
  while(i < n){
    var c = s.charAt(i);
    if(c === '\\'){
      var bas = s.substr(i, 4).toUpperCase();
      if(bas === '\\X2\\' || bas === '\\X4\\'){
        var son = s.toUpperCase().indexOf('\\X0\\', i + 4);
        if(son < 0) son = n;
        var hex = s.slice(i + 4, son), adim = bas === '\\X2\\' ? 4 : 8;
        for(var k = 0; k + adim <= hex.length; k += adim){
          var kod = parseInt(hex.substr(k, adim), 16);
          if(kod > 0xFFFF){ kod -= 0x10000; out += String.fromCharCode(0xD800 + (kod >> 10), 0xDC00 + (kod & 0x3FF)); }
          else out += String.fromCharCode(kod);
        }
        i = son + 4;
        continue;
      }
      var uc = s.substr(i, 3).toUpperCase();
      if(uc === '\\X\\'){ out += String.fromCharCode(parseInt(s.substr(i + 3, 2), 16)); i += 5; continue; }
      if(uc === '\\S\\'){ out += String.fromCharCode(s.charCodeAt(i + 3) + 128); i += 4; continue; }
      if(s.charAt(i + 1).toUpperCase() === 'P' && s.charAt(i + 3) === '\\'){ i += 4; continue; }
      if(s.charAt(i + 1) === '\\'){ out += '\\'; i += 2; continue; }
    }
    out += c;
    i++;
  }
  return out;
}

// ── 4 · VARLIK ERİŞİMİ ────────────────────────────────────────────────────
function veStepP21Tip(model, id){
  var r = model.kayit[id];
  if(r === undefined) return null;
  if(r.charCodeAt(0) === 40) return 'COMPLEX';
  var p = r.indexOf('(');
  return (p < 0 ? r : r.slice(0, p)).trim().toUpperCase();
}

// {t, a} — karmaşık varlıkta {t:'COMPLEX', parca:[{t, a}, ...]}
function veStepP21Varlik(model, id){
  var v = model.onbellek[id];
  if(v !== undefined) return v;
  var r = model.kayit[id];
  if(r === undefined) return null;
  if(r.charCodeAt(0) === 40) v = { t: 'COMPLEX', parca: _stpKarmasik(r) };
  else {
    var p = r.indexOf('(');
    v = { t: r.slice(0, p).trim().toUpperCase(), a: _stpArgumanlar(r.slice(p)) };
  }
  model.onbellek[id] = v;
  return v;
}

// Karmaşık varlığın adıyla istenen parçası
function veStepP21Parca(model, id, ad){
  var v = veStepP21Varlik(model, id);
  if(!v) return null;
  if(v.t !== 'COMPLEX') return v.t === ad ? v : null;
  for(var i = 0; i < v.parca.length; i++) if(v.parca[i].t === ad) return v.parca[i];
  return null;
}

function _stpRefler(a){
  var out = [];
  (Array.isArray(a) ? a : [a]).forEach(function(x){ if(x && x.ref) out.push(x.ref); });
  return out;
}

// ── 5 · BİRİMLER ─────────────────────────────────────────────────────────
// Temsil bağlamından: { mm: uzunluk → mm çarpanı, derece: açı → derece çarpanı }
var _STP_ONEK = { EXA: 1e18, PETA: 1e15, TERA: 1e12, GIGA: 1e9, MEGA: 1e6, KILO: 1e3,
  HECTO: 1e2, DECA: 1e1, DECI: 1e-1, CENTI: 1e-2, MILLI: 1e-3, MICRO: 1e-6, NANO: 1e-9 };

function veStepP21Birim(model, baglamId){
  var out = { mm: NaN, derece: NaN };
  var g = veStepP21Parca(model, baglamId, 'GLOBAL_UNIT_ASSIGNED_CONTEXT');
  if(!g) return out;
  _stpRefler(g.a[0]).forEach(function(u){
    var tur = _stpBirimTuru(model, u);
    if(tur === 'uzunluk') out.mm = _stpBirimCarpan(model, u, 'uzunluk');
    else if(tur === 'aci') out.derece = _stpBirimCarpan(model, u, 'aci');
  });
  return out;
}

function _stpBirimTuru(model, u){
  if(veStepP21Parca(model, u, 'LENGTH_UNIT')) return 'uzunluk';
  if(veStepP21Parca(model, u, 'PLANE_ANGLE_UNIT')) return 'aci';
  var v = veStepP21Varlik(model, u);
  if(v && v.t === 'LENGTH_UNIT') return 'uzunluk';
  if(v && v.t === 'PLANE_ANGLE_UNIT') return 'aci';
  return null;
}

// SI_UNIT(önek, ad) ya da CONVERSION_BASED_UNIT(ad, ölçü_ile_birim)
function _stpBirimCarpan(model, u, tur, derinlik){
  if((derinlik || 0) > 4) return NaN;
  var si = veStepP21Parca(model, u, 'SI_UNIT');
  if(si){
    var onek = si.a[0] && si.a[0].e ? (_STP_ONEK[si.a[0].e] || 1) : 1;
    var ad = si.a[1] && si.a[1].e;
    if(tur === 'uzunluk' && ad === 'METRE') return onek * 1000;
    if(tur === 'aci' && ad === 'RADIAN') return onek * 180 / Math.PI;
    return NaN;
  }
  var cb = veStepP21Parca(model, u, 'CONVERSION_BASED_UNIT');
  if(cb && cb.a[1] && cb.a[1].ref){
    var mwu = veStepP21Varlik(model, cb.a[1].ref);
    var govde = mwu.t === 'COMPLEX' ? veStepP21Parca(model, cb.a[1].ref, 'MEASURE_WITH_UNIT') : mwu;
    if(!govde || !govde.a) return NaN;
    var olcu = govde.a[0], deger = (olcu && olcu.tip) ? olcu.a[0] : olcu;
    var taban = govde.a[1] && govde.a[1].ref ? _stpBirimCarpan(model, govde.a[1].ref, tur, (derinlik || 0) + 1) : NaN;
    return deger * taban;
  }
  return NaN;
}

// ── 6 · ÇERÇEVE VE DÖNÜŞÜM ───────────────────────────────────────────────
// Dönüşüm {R: 3×3 satırlar, t: öteleme}; p' = R·p + t. Uzunluklar mm'ye
// `olcek` ile çevrilir (çerçevenin konumu dosya biriminde yazılı).
function veStepP21Cerceve(model, id, olcek){
  var k = olcek > 0 ? olcek : 1;
  var a = veStepP21Varlik(model, id).a;               // AXIS2_PLACEMENT_3D(ad, konum, eksen, ref)
  var o = veStepP21Varlik(model, a[1].ref).a[1];
  var z = a[2] && a[2].ref ? _stpBirimVek(veStepP21Varlik(model, a[2].ref).a[1]) : [0, 0, 1];
  var x;
  if(a[3] && a[3].ref) x = veStepP21Varlik(model, a[3].ref).a[1];
  else x = Math.abs(z[0]) < 1 - 1e-12 ? [1, 0, 0] : [0, 0, 1];     // ISO 10303-42 first_proj_axis
  x = _stpBirimVek(_stpCikar(x, _stpCarpS(z, _stpNokta(x, z))));
  var y = _stpVektorel(z, x);
  return { o: [o[0] * k, o[1] * k, (o.length > 2 ? o[2] : 0) * k], x: x, y: y, z: z };
}

function veStepP21Donusum(cerceve){
  var f = cerceve;
  return { R: [[f.x[0], f.y[0], f.z[0]], [f.x[1], f.y[1], f.z[1]], [f.x[2], f.y[2], f.z[2]]], t: f.o.slice() };
}
var VE_STEP_P21_BIRIM = { R: [[1, 0, 0], [0, 1, 0], [0, 0, 1]], t: [0, 0, 0] };

function veStepP21Bilesik(a, b){                          // a ∘ b
  var R = [0, 1, 2].map(function(i){ return [0, 1, 2].map(function(j){
    return a.R[i][0] * b.R[0][j] + a.R[i][1] * b.R[1][j] + a.R[i][2] * b.R[2][j]; }); });
  return { R: R, t: _stpTopla(_stpUygulaR(a.R, b.t), a.t) };
}
function veStepP21Ters(m){
  var Rt = [[m.R[0][0], m.R[1][0], m.R[2][0]], [m.R[0][1], m.R[1][1], m.R[2][1]], [m.R[0][2], m.R[1][2], m.R[2][2]]];
  return { R: Rt, t: _stpCarpS(_stpUygulaR(Rt, m.t), -1) };
}
function veStepP21NoktaUygula(m, p){ return _stpTopla(_stpUygulaR(m.R, p), m.t); }
function veStepP21YonUygula(m, d){ return _stpUygulaR(m.R, d); }

function _stpUygulaR(R, v){ return [R[0][0] * v[0] + R[0][1] * v[1] + R[0][2] * v[2],
  R[1][0] * v[0] + R[1][1] * v[1] + R[1][2] * v[2], R[2][0] * v[0] + R[2][1] * v[1] + R[2][2] * v[2]]; }
function _stpTopla(a, b){ return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
function _stpCikar(a, b){ return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function _stpCarpS(a, s){ return [a[0] * s, a[1] * s, a[2] * s]; }
function _stpNokta(a, b){ return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function _stpVektorel(a, b){ return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function _stpBirimVek(a){ var L = Math.sqrt(_stpNokta(a, a)); return L > 0 ? _stpCarpS(a, 1 / L) : a.slice(); }

// ── 7 · MONTAJ AĞACI ─────────────────────────────────────────────────────
// Her parça ÖRNEĞİ ayrı döner: aynı parça iki kez takılıysa iki kayıt, iki
// ayrı dünya dönüşümü. Döner:
//   { parcalar: [{ pd, urun:{id, ad, aciklama}, ornek, yol, M, sr, birim,
//                  yuzler:[kimlik], egriler:[kimlik] }], uyarilar: [] }
function veStepP21Montaj(model){
  var out = { parcalar: [], uyarilar: [] };
  var pdUrun = {}, pdSr = {}, cocuklar = {}, cocukMu = {}, nauoCdsr = {}, srrKomsu = {};
  var tipler = {};
  Object.keys(model.kayit).forEach(function(k){
    var id = +k, t = veStepP21Tip(model, id);
    if(t === 'PRODUCT_DEFINITION') pdUrun[id] = 1;
    else if(t === 'NEXT_ASSEMBLY_USAGE_OCCURRENCE' || t === 'ASSEMBLY_COMPONENT_USAGE'){
      var a = veStepP21Varlik(model, id).a;
      var ebeveyn = a[3].ref, cocuk = a[4].ref;
      (cocuklar[ebeveyn] = cocuklar[ebeveyn] || []).push({ nauo: id, pd: cocuk, ad: a[0] && a[0].s });
      cocukMu[cocuk] = 1;
    }
    else if(t === 'SHAPE_DEFINITION_REPRESENTATION'){
      var sd = veStepP21Varlik(model, id).a;
      var pds = veStepP21Varlik(model, sd[0].ref);
      if(pds && pds.a[2] && veStepP21Tip(model, pds.a[2].ref) === 'PRODUCT_DEFINITION')
        pdSr[pds.a[2].ref] = sd[1].ref;
    }
    else if(t === 'CONTEXT_DEPENDENT_SHAPE_REPRESENTATION'){
      var cd = veStepP21Varlik(model, id).a;
      var pds2 = veStepP21Varlik(model, cd[1].ref);
      if(pds2 && pds2.a[2]) nauoCdsr[pds2.a[2].ref] = cd[0].ref;
    }
    else if(t === 'SHAPE_REPRESENTATION_RELATIONSHIP'){
      var rr = veStepP21Varlik(model, id).a;
      (srrKomsu[rr[2].ref] = srrKomsu[rr[2].ref] || []).push(rr[3].ref);
      (srrKomsu[rr[3].ref] = srrKomsu[rr[3].ref] || []).push(rr[2].ref);
    }
    else if(t === 'MAPPED_ITEM') tipler.MAPPED_ITEM = (tipler.MAPPED_ITEM || 0) + 1;
  });
  if(tipler.MAPPED_ITEM)
    out.uyarilar.push('Dosyada ' + tipler.MAPPED_ITEM + ' MAPPED_ITEM var; bu kalıpla konumlandırılmış '
      + 'parçalar OKUNMAZ. Montajı CATIA\'dan tek dosya olarak yeniden dışa aktarın.');

  var kokler = Object.keys(pdUrun).map(Number).filter(function(pd){ return !cocukMu[pd]; });
  var ziyaret = 0;
  // `atalar`: kökten bu parçaya kadar alt montajların ürünleri. Tedarikçi
  // gergiyi çoğu zaman alt montaj olarak verir (kol · gövde · kasnak ayrı
  // parça); "bu parça gergiye ait" bilgisi o zaman yalnız atanın adında durur.
  function gez(pd, M, yol, atalar){
    if(++ziyaret > 100000) return;
    var sr = pdSr[pd];
    var geo = sr ? _stpGeometri(model, sr, srrKomsu, out.uyarilar) : { yuzler: [], egriler: [] };
    var cc = cocuklar[pd] || [];
    var urun = _stpUrun(model, pd);
    if(geo.yuzler.length || geo.egriler.length || !cc.length){
      out.parcalar.push({ pd: pd, urun: urun, ornek: yol.length ? yol[yol.length - 1] : urun.id,
        yol: yol.slice(), atalar: atalar.slice(), M: M, sr: sr || null,
        birim: sr ? _stpSrBirim(model, sr) : { mm: NaN, derece: NaN },
        yuzler: geo.yuzler, egriler: geo.egriler, altMontaj: cc.length > 0 });
    }
    cc.forEach(function(c){
      var rrwt = nauoCdsr[c.nauo];
      var yerel = rrwt ? _stpYerelDonusum(model, rrwt, pdSr[c.pd], out.uyarilar) : null;
      if(!yerel){
        out.uyarilar.push('"' + (c.ad || ('#' + c.nauo)) + '" örneğinin konumu okunamadı; parça atlandı.');
        return;
      }
      gez(c.pd, veStepP21Bilesik(M, yerel), yol.concat([c.ad || ('#' + c.nauo)]), atalar.concat([urun]));
    });
  }
  kokler.forEach(function(pd){ gez(pd, VE_STEP_P21_BIRIM, [], []); });
  return out;
}

function _stpUrun(model, pd){
  var a = veStepP21Varlik(model, pd).a;                    // PRODUCT_DEFINITION(id, açıklama, pdf, bağlam)
  var pdf = veStepP21Varlik(model, a[2].ref).a;            // PDF(id, açıklama, ürün, ...)
  var u = veStepP21Varlik(model, pdf[2].ref).a;            // PRODUCT(id, ad, açıklama, bağlamlar)
  return { id: (u[0] && u[0].s) || '', ad: (u[1] && u[1].s) || '', aciklama: (u[2] && u[2].s) || '' };
}

function _stpSrBirim(model, sr){
  var v = veStepP21Varlik(model, sr);
  var govde = v.t === 'COMPLEX' ? null : v;
  if(!govde || !govde.a[2] || !govde.a[2].ref) return { mm: NaN, derece: NaN };
  return veStepP21Birim(model, govde.a[2].ref);
}

// RRWT → yerel dönüşüm (çocuk temsili → ebeveyn temsili). CAx-IF kalıbında
// rep_1 çocuk, rep_2 ebeveyndir; bazı yazıcılar TERS yazar — çocuğun temsili
// hangisiyse ona göre çevrilir.
function _stpYerelDonusum(model, rrwtId, cocukSr, uyarilar){
  var rr = veStepP21Parca(model, rrwtId, 'REPRESENTATION_RELATIONSHIP');
  var wt = veStepP21Parca(model, rrwtId, 'REPRESENTATION_RELATIONSHIP_WITH_TRANSFORMATION');
  if(!rr || !wt || !wt.a[0] || !wt.a[0].ref) return null;
  var idt = veStepP21Varlik(model, wt.a[0].ref);
  if(!idt || idt.t !== 'ITEM_DEFINED_TRANSFORMATION') {
    uyarilar.push('Montaj dönüşümü ITEM_DEFINED_TRANSFORMATION değil (' + (idt && idt.t) + '); desteklenmiyor.');
    return null;
  }
  var rep1 = rr.a[2].ref, rep2 = rr.a[3].ref;
  var k1 = _stpSrOlcek(model, rep1), k2 = _stpSrOlcek(model, rep2);
  var F1 = veStepP21Donusum(veStepP21Cerceve(model, idt.a[2].ref, k1));
  var F2 = veStepP21Donusum(veStepP21Cerceve(model, idt.a[3].ref, k2));
  if(cocukSr && rep2 === cocukSr && rep1 !== cocukSr) return veStepP21Bilesik(F1, veStepP21Ters(F2));
  return veStepP21Bilesik(F2, veStepP21Ters(F1));
}

function _stpSrOlcek(model, sr){
  var b = _stpSrBirim(model, sr);
  return b.mm > 0 ? b.mm : 1;
}

// Temsilin geometrisi: yüzler ve (geometrik setlerdeki) eğriler. Dönüşümsüz
// SHAPE_REPRESENTATION_RELATIONSHIP ile bağlı temsiller de dahil (CATIA V5
// geometriyi ayrı bir ADVANCED_BREP_SHAPE_REPRESENTATION'a koyar).
function _stpGeometri(model, sr, srrKomsu, uyarilar){
  var yuzler = [], egriler = [], gor = {}, temsilGor = {};
  function oge(id){
    if(gor[id]) return;
    gor[id] = 1;
    var t = veStepP21Tip(model, id);
    if(t === 'ADVANCED_FACE' || t === 'FACE_SURFACE'){ yuzler.push(id); return; }
    if(t === 'COMPOSITE_CURVE' || t === 'TRIMMED_CURVE' || t === 'CIRCLE' || t === 'LINE'
       || t === 'POLYLINE' || t === 'B_SPLINE_CURVE_WITH_KNOTS'){ egriler.push(id); return; }
    var a = t === 'COMPLEX' ? null : veStepP21Varlik(model, id).a;
    if(!a) return;
    if(t === 'SHELL_BASED_SURFACE_MODEL' || t === 'GEOMETRIC_SET' || t === 'GEOMETRIC_CURVE_SET'
       || t === 'OPEN_SHELL' || t === 'CLOSED_SHELL' || t === 'CONNECTED_FACE_SET'){ _stpRefler(a[1]).forEach(oge); return; }
    if(t === 'ORIENTED_CLOSED_SHELL' || t === 'ORIENTED_OPEN_SHELL'){ if(a[2] && a[2].ref) oge(a[2].ref); return; }
    if(t === 'MANIFOLD_SOLID_BREP' || t === 'FACETED_BREP'){ if(a[1] && a[1].ref) oge(a[1].ref); return; }
    if(t === 'BREP_WITH_VOIDS'){ if(a[1] && a[1].ref) oge(a[1].ref); _stpRefler(a[2]).forEach(oge); return; }
    if(t === 'MAPPED_ITEM') return;                       // Montaj'da topluca uyarıldı
  }
  function temsil(r){
    if(temsilGor[r]) return;
    temsilGor[r] = 1;
    var v = veStepP21Varlik(model, r);
    if(v && v.t !== 'COMPLEX' && v.a && Array.isArray(v.a[1])) _stpRefler(v.a[1]).forEach(oge);
    (srrKomsu[r] || []).forEach(temsil);
  }
  temsil(sr);
  return { yuzler: yuzler, egriler: egriler };
}

// ── 8 · YÜZ ─────────────────────────────────────────────────────────────
// Bir yüzün dünya koordinatında analitik tanımı ve sınır çemberleri. Yalnız
// FEAD'in ihtiyaç duyduğu yüzey tipleri çözülür; diğerleri tipiyle döner.
//   { id, tip, o, z, r, yariAci, R, rk, cemberler: [{c, n, r}] }
function veStepP21Yuz(model, yuzId, M, birim){
  var k = birim && birim.mm > 0 ? birim.mm : 1;
  var dk = birim && birim.derece > 0 ? birim.derece : 180 / Math.PI;
  var a = veStepP21Varlik(model, yuzId).a;              // ADVANCED_FACE(ad, sınırlar, yüzey, aynı_yön)
  var sid = a[2].ref, st = veStepP21Tip(model, sid);
  var out = { id: yuzId, tip: st, cemberler: [] };
  if(st === 'CYLINDRICAL_SURFACE' || st === 'CONICAL_SURFACE' || st === 'TOROIDAL_SURFACE'
     || st === 'SPHERICAL_SURFACE' || st === 'PLANE'){
    var s = veStepP21Varlik(model, sid).a;
    var f = veStepP21Cerceve(model, s[1].ref, k);
    out.o = veStepP21NoktaUygula(M, f.o);
    out.z = _stpBirimVek(veStepP21YonUygula(M, f.z));
    if(st === 'CYLINDRICAL_SURFACE' || st === 'SPHERICAL_SURFACE') out.r = s[2] * k;
    if(st === 'CONICAL_SURFACE'){ out.r = s[2] * k; out.yariAci = s[3] * dk; }
    if(st === 'TOROIDAL_SURFACE'){ out.R = s[2] * k; out.rk = s[3] * k; }
  }
  _stpRefler(a[1]).forEach(function(b){
    var fb = veStepP21Varlik(model, b);
    if(!fb || !fb.a[1]) return;
    var dongu = veStepP21Varlik(model, fb.a[1].ref);
    if(!dongu || dongu.t !== 'EDGE_LOOP') return;
    _stpRefler(dongu.a[1]).forEach(function(oe){
      var kenar = veStepP21Varlik(model, oe).a[3];           // ORIENTED_EDGE(ad, *, *, kenar, yön)
      var c = kenar && kenar.ref ? _stpKenarCemberi(model, kenar.ref, M, k) : null;
      if(c) out.cemberler.push(c);
    });
  });
  return out;
}

function _stpKenarCemberi(model, kenarId, M, k){
  var e = veStepP21Varlik(model, kenarId);
  if(!e || e.t !== 'EDGE_CURVE') return null;
  var g = e.a[3].ref, t = veStepP21Tip(model, g);
  if(t === 'SURFACE_CURVE' || t === 'SEAM_CURVE' || t === 'INTERSECTION_CURVE'){
    g = veStepP21Varlik(model, g).a[1].ref;
    t = veStepP21Tip(model, g);
  }
  if(t !== 'CIRCLE') return null;
  var c = veStepP21Varlik(model, g).a;                        // CIRCLE(ad, yerleşim, yarıçap)
  var f = veStepP21Cerceve(model, c[1].ref, k);
  return { c: veStepP21NoktaUygula(M, f.o), n: _stpBirimVek(veStepP21YonUygula(M, f.z)), r: c[2] * k };
}

// ── 9 · BAŞLIK ────────────────────────────────────────────────────────────
function veStepP21Baslik(model){
  var fn = model.baslik.FILE_NAME || [], fs = model.baslik.FILE_SCHEMA || [];
  var dz = function(v){ return v && v.s !== undefined ? v.s : ''; };
  var sema = Array.isArray(fs[0]) ? fs[0].map(dz).join(', ') : '';
  return { dosya: dz(fn[0]), tarih: dz(fn[1]), onisleyici: dz(fn[4]), sistem: dz(fn[5]), sema: sema };
}

// ── 10 · BAYT → METİN (.stp · .step · .stpZ) ───────────────────────────────
// Dosya seçicisinden gelen baytlar. Kap UZANTIDAN değil İMZADAN tanınır —
// aynı `.stpZ` uzantısıyla gzip de zip de yazılıyor:
//   1F 8B        gzip (RFC 1952)
//   50 4B 03 04  zip; içindeki ilk .stp/.step/.p21 girişi (yoksa ilk giriş)
//   diğer        düz metin
// Açıcı ölçüm içe aktarmanın saf JS inflate'i (js/xlsx-read.js): tarayıcının
// DecompressionStream'i asenkron ve jsdom'da yok — iki ayrı kod yolu olurdu.
//
// KODLAMA: Part 21'in temel alfabesi ASCII, ASCII dışı karakter \X2\ ile
// kaçışlanır (3DEXPERIENCE böyle yazıyor). Standarda uymayan bir yazıcının
// bıraktığı ham bayt önce UTF-8 (geçerliyse), değilse ISO 8859-1 okunur;
// ikisinde de ASCII kısım birebir aynı kalır.
function _stpAcici(){
  if(typeof veXlsInflateRaw === 'function')
    return { inflate: veXlsInflateRaw, zip: (typeof veXlsZipRead === 'function') ? veXlsZipRead : null };
  if(typeof require === 'function'){
    try { var x = require('./xlsx-read.js'); return { inflate: x.veXlsInflateRaw, zip: x.veXlsZipRead }; }
    catch(e){ return null; }
  }
  return null;
}

function _stpUtf8(b){
  var out = [], parca = '', i = 0, n = b.length;
  while(i < n){
    var c = b[i], cp, ek;
    if(c < 0x80){ cp = c; ek = 0; }
    else if(c >= 0xC2 && c < 0xE0){ cp = c & 0x1F; ek = 1; }
    else if(c >= 0xE0 && c < 0xF0){ cp = c & 0x0F; ek = 2; }
    else if(c >= 0xF0 && c < 0xF5){ cp = c & 0x07; ek = 3; }
    else return null;                                          // geçersiz başlangıç baytı
    if(ek && i + ek >= n) return null;                          // yarım dizi
    for(var k = 1; k <= ek; k++){
      var d = b[i + k];
      if((d & 0xC0) !== 0x80) return null;
      cp = (cp << 6) | (d & 0x3F);
    }
    if((ek === 2 && cp < 0x800) || (ek === 3 && (cp < 0x10000 || cp > 0x10FFFF))) return null;
    i += ek + 1;
    if(cp > 0xFFFF){ cp -= 0x10000; out.push(0xD800 + (cp >> 10), 0xDC00 + (cp & 0x3FF)); }
    else out.push(cp);
    if(out.length >= 8192){ parca += String.fromCharCode.apply(null, out); out.length = 0; }
  }
  return parca + String.fromCharCode.apply(null, out);
}

function _stpLatin1(b){
  var s = '';
  for(var i = 0; i < b.length; i += 8192)
    s += String.fromCharCode.apply(null, b.subarray(i, Math.min(b.length, i + 8192)));
  return s;
}

function _stpBaytMetin(b){
  var i = 0;
  while(i < b.length && b[i] < 0x80) i++;
  if(i === b.length) return _stpLatin1(b);                     // saf ASCII: hızlı yol
  var u = _stpUtf8(b);
  return u === null ? _stpLatin1(b) : u;
}

// `bayt`: Uint8Array ya da ArrayBuffer. Döner: { metin, kap: 'duz'|'gzip'|'zip',
// icerik? } — açılamayan kap ADRESLİ bir hata atar (sessiz boş metin değil).
function veStepP21Metin(bayt){
  var b = (bayt instanceof Uint8Array) ? bayt : new Uint8Array(bayt || []);
  var ac;
  if(b.length >= 2 && b[0] === 0x1F && b[1] === 0x8B){
    if(b.length < 18 || b[2] !== 8) throw new Error('gzip: desteklenmeyen sıkıştırma yöntemi ya da yarım dosya.');
    var flg = b[3], p = 10;
    if(flg & 4) p += 2 + (b[p] | (b[p + 1] << 8));              // FEXTRA
    if(flg & 8){ while(p < b.length && b[p] !== 0) p++; p++; }   // FNAME
    if(flg & 16){ while(p < b.length && b[p] !== 0) p++; p++; }  // FCOMMENT
    if(flg & 2) p += 2;                                          // FHCRC
    ac = _stpAcici();
    if(!ac || !ac.inflate) throw new Error('Sıkıştırılmış STEP açılamadı: açıcı (js/xlsx-read.js) yüklenmemiş.');
    return { metin: _stpBaytMetin(ac.inflate(b.subarray(p))), kap: 'gzip' };
  }
  if(b.length >= 4 && b[0] === 0x50 && b[1] === 0x4B && b[2] === 0x03 && b[3] === 0x04){
    ac = _stpAcici();
    if(!ac || !ac.zip) throw new Error('Sıkıştırılmış STEP açılamadı: açıcı (js/xlsx-read.js) yüklenmemiş.');
    var zip = ac.zip(b);
    var adlar = zip.names.filter(function(a){ return !/\/$/.test(a); });
    var ad = adlar.filter(function(a){ return /\.(stp|step|p21)$/i.test(a); })[0] || adlar[0];
    if(!ad) throw new Error('zip: arşivde dosya yok.');
    return { metin: _stpBaytMetin(zip.read(ad)), kap: 'zip', icerik: ad };
  }
  return { metin: _stpBaytMetin(b), kap: 'duz' };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    VE_STEP_P21_SURUM: VE_STEP_P21_SURUM,
    veStepP21Metin: veStepP21Metin,
    VE_STEP_P21_BIRIM: VE_STEP_P21_BIRIM,
    veStepP21Oku: veStepP21Oku,
    veStepP21Coz: veStepP21Coz,
    veStepP21Tip: veStepP21Tip,
    veStepP21Varlik: veStepP21Varlik,
    veStepP21Parca: veStepP21Parca,
    veStepP21Birim: veStepP21Birim,
    veStepP21Cerceve: veStepP21Cerceve,
    veStepP21Donusum: veStepP21Donusum,
    veStepP21Bilesik: veStepP21Bilesik,
    veStepP21Ters: veStepP21Ters,
    veStepP21NoktaUygula: veStepP21NoktaUygula,
    veStepP21YonUygula: veStepP21YonUygula,
    veStepP21Montaj: veStepP21Montaj,
    veStepP21Yuz: veStepP21Yuz,
    veStepP21Baslik: veStepP21Baslik
  };
}
