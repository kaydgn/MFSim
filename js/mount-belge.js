// ============================================================================
// js/mount-belge.js — ŞANZIMAN AİLESİNİN BELGESİ: bölgenin durumu (DOM'suz)
// ────────────────────────────────────────────────────────────────────────────
// Kullanıcı 2026-11-06 (Canlı Not 52): *"Önce şanzıman ailesi seçeriz, ardından o
// seçtiğimiz şanzıman ailesine ait PDF açılır ve o PDF üzerinden işaretlemeli
// şekilde şanzımanın özelliklerini seçeriz. Ama PDF ile aynı kalırız."*
//
// Sayfalar ve bölgeler belgeden ÜRETİLİR (js/mount-belge-veri.js ← tools/belge-sayfa.js).
// Burada: bölge seçili mi (seçim onun değerlerini taşıyor mu), tık geçerli mi ve
// hangi anahtarı yazar (js/mount-veri-sayfasi.js → veMntVsSecenekYaz, ailenin
// sırasıyla — koşulu yazan seçenek önce), geçersizse sebebi (bağdaşmayan seçeneğin
// adı ve değeri, kapalı listedeki sebebin dili). Kapı: tests/unit/mount-belge.test.js.
// ============================================================================

function veMntBelge(aile){
  return (typeof VE_MNT_BELGE !== 'undefined' && aile && VE_MNT_BELGE[aile]) || null;
}
// Seçeneğin değerinin adı (listede görünen)
function _veBelgeDegerAd(A, k, v){
  var o = A.secenek.filter(function(x){ return x.k === k; })[0];
  var e = o && o.d ? o.d.filter(function(x){ return x[0] === v; })[0] : null;
  return { o: o, ad: e ? e[1] : String(v) };
}
function _veBelgeSebep(A, k, s){
  var r = _veBelgeDegerAd(A, k, s[k]);
  return r.o ? r.o.ad + ': ' + r.ad + '.' : '';
}
// Bölgenin adı: yazdığı değerler, ailenin sırasıyla ("Retarder: Var · Soğutucu: Remote")
function veMntBelgeEtiket(A, b){
  if(!A || !b || !b.s) return '';
  return A.secenek.filter(function(o){ return o.k in b.s; }).map(function(o){
    return o.ad + ': ' + _veBelgeDegerAd(A, o.k, b.s[o.k]).ad;
  }).join(' · ');
}
// Durum: { secili, tik, anahtar, neden }
//   secili   seçim bölgenin değerlerini (s) ve koşulunu (ek) taşıyor
//   tik      bölge tıklanır (değer yazar); anahtar tıkın yazacağı kayıt
//   neden    tık geçersizse bağdaşmayan seçeneğin adı ve değeri
function veMntBelgeDurum(A, vs, b){
  var s = (vs && vs.secenek) || {}, ek = b.ek || {}, sec = b.s || {};
  var ekUyar = function(S){ return Object.keys(ek).every(function(k){ return ek[k].indexOf(S[k]) >= 0; }); };
  var secili = ekUyar(s) && Object.keys(sec).every(function(k){ return s[k] === sec[k]; });
  if(!b.s || !A || typeof veMntVsSecenekYaz !== 'function') return { secili: secili, tik: false, anahtar: null, neden: '' };
  var k = vs.k, neden = '', cur = s;
  A.secenek.forEach(function(o){
    if(!k || !(o.k in sec)) return;
    var y = veMntVsSecenekYaz(k, o.k, sec[o.k]);
    if(!y){
      // bağdaşmayan: değeri izin vermeyen koşulun seçeneği (o anki seçimde)
      Object.keys(o.kosul || {}).forEach(function(bk){
        var izin = o.kosul[bk][cur[bk]];
        if(!neden && izin && izin.indexOf(sec[o.k]) < 0) neden = _veBelgeSebep(A, bk, cur);
      });
      if(!neden) neden = _veBelgeSebep(A, o.k, cur);
    } else if(typeof veMntVeriSayfasi === 'function'){
      var P0 = veMntVeriSayfasi(y);
      if(P0) cur = P0.secenek;
    }
    k = y;
  });
  if(k){
    // koşul yazılan sonuçta da sağlanmalı (altı vitesin tablosu yedi vitesliyi seçmez)
    var P = typeof veMntVeriSayfasi === 'function' ? veMntVeriSayfasi(k) : null;
    if(P && !ekUyar(P.secenek)){
      Object.keys(ek).forEach(function(bk){ if(!neden && ek[bk].indexOf(P.secenek[bk]) < 0) neden = _veBelgeSebep(A, bk, P.secenek); });
      k = null;
    }
  }
  return { secili: secili, tik: !!k, anahtar: k || null, neden: k ? '' : neden };
}
// Sayfanın görseli: derleme gömer (build.js → __MFSIM_BELGE), modüler kopyada dosya
function veMntBelgeResim(rel){
  var G = (typeof window !== 'undefined' && window.__MFSIM_BELGE) || null;
  return (G && G[rel]) || ('assets/' + rel);
}

if(typeof module !== 'undefined' && module.exports){
  module.exports = { veMntBelge: veMntBelge, veMntBelgeDurum: veMntBelgeDurum, veMntBelgeEtiket: veMntBelgeEtiket, veMntBelgeResim: veMntBelgeResim };
}
