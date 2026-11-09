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
// Bölgenin adı: yazdığı değerler, ailenin sırasıyla ("Retarder: Var · Soğutucu: Remote");
// koşulu da olan seçenekte koşulun değerleri ("Vites konfigürasyonu: Close Ratio (CR) / Wide Ratio (WR)")
function veMntBelgeEtiket(A, b){
  if(!A || !b || !b.s) return '';
  var ek = b.ek || {};
  return A.secenek.filter(function(o){ return o.k in b.s; }).map(function(o){
    var d = o.k in ek ? ek[o.k] : [b.s[o.k]];
    return o.ad + ': ' + d.map(function(v){ return _veBelgeDegerAd(A, o.k, v).ad; }).join(' / ');
  }).join(' · ');
}
// Seçili: koşul (ek) ve yazılan değerler (s) seçimde; ikisinde de olan seçenekte koşul
// belirler — "Close Ratio and Wide Ratio Models" CR yazar, CR ya da WR seçiliyken seçili
// (Canlı Not 74)
function _veBelgeSecili(s, b){
  var ek = b.ek || {}, sec = b.s || {};
  return Object.keys(ek).every(function(k){ return ek[k].indexOf(s[k]) >= 0; })
    && Object.keys(sec).every(function(k){ return (k in ek) || s[k] === sec[k]; });
}
// SEÇİMİN KALDIRILMASI (kullanıcı 2026-11-06, Canlı Not 56: *"Seçtiklerimizi geri
// kaldıramıyoruz. Yani seçim oluyor ama iptal edemiyoruz."*): işaretli bölgenin tıkı
// seçimini kaldırır — bölgenin yazdığı seçenekler EN ÖZELİNDEN (ailenin sırasının
// sonundan) başlayarak, bölge seçimden düşene dek birer birer varsayılana döner:
// akümülatörü kaldırmak retarderi kaldırmaz, retarderli soğutucuyu kaldırmak soğutucuyu
// Remote'a döndürür (retarder kalır). Bağdaşmayan öteki seçenek ilk izinli değerine
// (veMntVsSecenekYaz). Bölgenin seçimi varsayılanın kendisiyse null (kaldırılacak bir şey yok).
function veMntBelgeKaldir(A, vs, b){
  if(!A || !vs || !vs.k || !b || !b.s || typeof veMntVsSecenekYaz !== 'function' || typeof veMntVeriSayfasi !== 'function') return null;
  var k = vs.k, sira = A.secenek.filter(function(o){ return o.d && (o.k in b.s); }).reverse();
  for(var i = 0; i < sira.length; i++){
    var o = sira[i], v0 = o.d[0][0], P = veMntVeriSayfasi(k);
    if(!P || P.secenek[o.k] === v0) continue;
    var y = veMntVsSecenekYaz(k, o.k, v0), Y = y ? veMntVeriSayfasi(y) : null;
    if(!Y) continue;
    k = y;
    if(!_veBelgeSecili(Y.secenek, b)) return k;
  }
  return null;
}
// Durum: { secili, tik, anahtar, neden, kaldir, radyo }
//   secili   seçim bölgenin değerlerini (s) ve koşulunu (ek) taşıyor
//   tik      bölge tıklanır (değer yazar); anahtar tıkın yazacağı kayıt
//   neden    tık geçersizse bağdaşmayan seçeneğin adı ve değeri
//   kaldir   işaretli bölgenin tıkının yazacağı kayıt (seçimin kaldırılması) | null
//   radyo    birbirini dışlayan satırlardan (grup — Canlı Not 73 · 74): seçili satırın tıkı
//            seçimi kaldırmaz (kaldir null), öteki satır seçilir
function veMntBelgeDurum(A, vs, b){
  var s = (vs && vs.secenek) || {}, ek = b.ek || {}, sec = b.s || {};
  var ekUyar = function(S){ return Object.keys(ek).every(function(k){ return ek[k].indexOf(S[k]) >= 0; }); };
  var secili = _veBelgeSecili(s, b);
  var radyo = !!b.grup;
  if(!b.s || !A || typeof veMntVsSecenekYaz !== 'function') return { secili: secili, tik: false, anahtar: null, neden: '', kaldir: null, radyo: radyo };
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
  return { secili: secili, tik: !!k, anahtar: k || null, neden: k ? '' : neden,
           kaldir: secili && !radyo ? veMntBelgeKaldir(A, vs, b) : null, radyo: radyo };
}
// ÖN İZLEME (kullanıcı 2026-11-09, Canlı Not 73: *"Diğer maddelerde de var böyle şeyler"*):
// tık birden çok satırı birlikte değiştirir (akümülatör retarderi, soğutucusunu ve
// solenoidi; Remote-Mount Provision arka braketi seçer). Fare üstündeki bölgenin tıkıyla
// seçime girecek (ekle) ve seçimden düşecek (cikar) öteki bölgeler, "sayfa-bölge" kimliğiyle.
function veMntBelgeOnizleme(A, vs, B, si, bi){
  var r = { ekle: [], cikar: [] };
  var b = B && B.sayfalar && B.sayfalar[si] ? B.sayfalar[si].bolge[bi] : null;
  if(!A || !vs || !b || typeof veMntVeriSayfasi !== 'function') return r;
  var d = veMntBelgeDurum(A, vs, b), k = d.secili ? d.kaldir : d.anahtar;
  var P = k && k !== vs.k ? veMntVeriSayfasi(k) : null;
  if(!P) return r;
  var s0 = vs.secenek || {};
  B.sayfalar.forEach(function(S, i){
    S.bolge.forEach(function(x, j){
      if(i === si && j === bi) return;
      var once = _veBelgeSecili(s0, x), sonra = _veBelgeSecili(P.secenek, x);
      if(once !== sonra) (sonra ? r.ekle : r.cikar).push(i + '-' + j);
    });
  });
  return r;
}
// Sayfanın görseli: derleme gömer (build.js → __MFSIM_BELGE), modüler kopyada dosya
function veMntBelgeResim(rel){
  var G = (typeof window !== 'undefined' && window.__MFSIM_BELGE) || null;
  return (G && G[rel]) || ('assets/' + rel);
}

if(typeof module !== 'undefined' && module.exports){
  module.exports = { veMntBelge: veMntBelge, veMntBelgeDurum: veMntBelgeDurum, veMntBelgeEtiket: veMntBelgeEtiket, veMntBelgeResim: veMntBelgeResim,
    veMntBelgeKaldir: veMntBelgeKaldir, veMntBelgeOnizleme: veMntBelgeOnizleme };
}
