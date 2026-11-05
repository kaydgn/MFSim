// ============================================================================
//  TAKOZ 3B — SAĞ TIK MENÜSÜ (3DEXPERIENCE'in bağlam menüsü gibi)
// ============================================================================
// Kullanıcı isteği (2026-11-05, Canlı Not 8): "3D görüntüleyicinin içine 'sağ
// klik' özelliğini getirelim. Sağ klik yaptığımızda 3D Experience programının
// CAD modülündeki özellikler gelsin. İşte parçayı hide yapma, seçilen parçayı
// ürün ağacında gösterme vs."
//   · Tuvalde parçaya ya da ürün ağacının satırına SAĞ TIK: tıklanan düğüm
//     seçimde değilse seçim ona iner (CAD gibi); menü seçimin HEPSİNE uygular.
//     Boşluğa sağ tık: görünümün komutları. Sağ tuşla SÜRÜKLEMEK yine kaydırır
//     — menü yalnız oynamayan tıkta açılır (js/cp-mount-3b.js → _mw3bDinle).
//   · GİZLE görünüm durumudur (V.gizli: parça → 1): modele ve kayda girmez,
//     dosya yeniden açılınca her parça görünür. Gizli parça çizilmez
//     (köşe durumunun VE_MW_3B_GIZLI biti — gölgelendirici atar), seçilmez,
//     sığdırmaya girmez; ağaçta satırı soluk.
//   · Malzeme yalnız kütlesi malzemeden gelebilen düğüme (Canlı Not 9 ve 16:
//     "Sadece istediğimiz parçalara malzeme tanımlayacağız" · "motor için bir
//     malzeme girdimiz olmayacak"): takoz, motor ve şanzıman birimleri dışında.
//   · Menünün satırları TEK üreticiden (veMntWiz3bMenuOgeleri — saf, testli).
//     Esc, dışarıya tık, tekerlek ve 3B'nin kapanması menüyü kapatır; ok tuşları
//     gezer, sağ ok alt menüyü açar, Enter uygular.
// ============================================================================

// Rol grupları ve malzemenin uygunluğu Özellikler'le ORTAK: js/cp-mount-3b.js
// (VE_MW_3B_ROL_GRUP · veMntWiz3bRolGruplari · veMntWiz3bMalzemeAlir).

// Seçimin parçaları (saf): düğümlerin parça indisleri, tekrarsız
function _mw3bMenuParcalar(s, secim){
  var p = {};
  (secim || []).forEach(function(d){ veMntWiz3bParcalar(s, d).forEach(function(i){ p[i] = 1; }); });
  return Object.keys(p).map(Number);
}
// BOŞLUĞUN MENÜSÜ (Canlı Not 20: "parça dışında boş bir yere … sağ klik yaptığında,
// tema seçme özelliği orada olsun. Farklı şeyler de olsun"): görünümün komutları —
// Tümünü göster · Tümünü sığdır · Bakış · Görünüş · Arka plan; seçim varsa
// Seçimi temizle. `opt`: { gorunus, zemin } (geçerli seçimler işaretli).
function _mw3bBosMenu(sec, gizliVar, opt){
  opt = opt || {};
  var L = [{ k: 'tumu', ad: 'Tümünü göster', ikon: 'eye', kapali: !gizliVar }, { k: 'sigdir', ad: 'Tümünü sığdır', ikon: 'maximize' }, '-'];
  if(typeof VE_MW_3B_BAKIS !== 'undefined')
    L.push({ k: 'bakis', ad: 'Bakış', ikon: 'box', alt: VE_MW_3B_BAKIS.map(function(b){ return { k: 'bakis:' + b.k, ad: b.ad }; }) });
  if(typeof VE_MW_3B_GORUNUS !== 'undefined')
    L.push({ k: 'gorunus', ad: 'Görünüş', ikon: 'contrast', alt: VE_MW_3B_GORUNUS.map(function(g){
      return { k: 'gorunus:' + g.k, ad: g.ad, secili: (opt.gorunus || 'kenar') === g.k }; }) });
  if(typeof VE_MW_3B_ZEMIN !== 'undefined')
    L.push({ k: 'zemin', ad: 'Arka plan', ikon: 'image', alt: VE_MW_3B_ZEMIN.map(function(z){
      return { k: 'zemin:' + z.k, ad: z.ad, secili: (opt.zemin || 'studyo') === z.k }; }) });
  if(sec.length){ L.push('-'); L.push({ k: 'temizle', ad: 'Seçimi temizle', ikon: 'x' }); }
  return L;
}
// MENÜNÜN SATIRLARI (saf, testli). `secim`: düğümler · `gizli`: { parça: 1 } ·
// `opt.bos`: boşluğa sağ tık (görünümün menüsü, _mw3bBosMenu).
// Döner: [{ k, ad, ikon, kapali?, alt?: [...] } | '-'] — '-' ayraç.
function veMntWiz3bMenuOgeleri(s, secim, gizli, opt){
  gizli = gizli || {};
  var L = [], sec = (secim || []).filter(function(d){ return d >= 0; }), cok = sec.length > 1;
  var P = _mw3bMenuParcalar(s, sec), gizliVar = Object.keys(gizli).some(function(k){ return gizli[k]; });
  if(opt && opt.bos) return _mw3bBosMenu(sec, gizliVar, opt);
  if(sec.length){
    var hepsiGizli = P.length > 0 && P.every(function(i){ return gizli[i]; });
    L.push(hepsiGizli ? { k: 'goster', ad: 'Göster', ikon: 'eye' } : { k: 'gizle', ad: 'Gizle', ikon: 'eye-off' });
    L.push({ k: 'yalniz', ad: cok ? 'Yalnız seçimi göster' : 'Yalnız bunu göster', ikon: 'target' });
  }
  L.push({ k: 'tumu', ad: 'Tümünü göster', ikon: 'eye', kapali: !gizliVar });
  L.push('-');
  if(sec.length){
    L.push({ k: 'agac', ad: 'Ağaçta göster', ikon: 'git-branch' });
    L.push({ k: 'odak', ad: 'Seçime yakınlaştır', ikon: 'zoom-in' });
  }
  L.push({ k: 'sigdir', ad: 'Tümünü sığdır', ikon: 'maximize' });
  if(!sec.length) return L;
  L.push('-');
  var rs = sec.map(function(d){ return s.roller[d] || ''; }), rol = rs.every(function(r){ return r === rs[0]; }) ? rs[0] : null;
  var alt = [];
  veMntWiz3bRolGruplari().forEach(function(g, gi){
    if(gi) alt.push('-');
    g.roller.forEach(function(t){ alt.push({ k: 'rol:' + t, ad: _mwAd(t), rol: t, secili: rol === t }); });
  });
  alt.push('-');
  alt.push({ k: 'rol:', ad: 'Rolü kaldır', ikon: 'x', kapali: !rs.some(function(r){ return !!r; }) });
  L.push({ k: 'rol', ad: 'Rol', ikon: 'box', alt: alt });
  if(typeof VE_MNT_STP_MALZEME !== 'undefined' && sec.every(function(d){ return veMntWiz3bMalzemeAlir(s, d); })){
    var ms = sec.map(function(d){ return typeof veMntWizStpMalzemeDurum === 'function' ? veMntWizStpMalzemeDurum(s, d).k : ((s.malzeme || {})[d] || ''); });
    var mk = ms.every(function(m){ return m === ms[0]; }) ? ms[0] : null;
    var malt = VE_MNT_STP_MALZEME.map(function(m){ return { k: 'malzeme:' + m.k, ad: m.ad, secili: mk === m.k }; });
    malt.push('-');
    malt.push({ k: 'malzeme:', ad: 'Malzemeyi kaldır', ikon: 'x', kapali: !ms.some(function(m){ return !!m; }) });
    L.push({ k: 'malzeme', ad: 'Malzeme', ikon: 'palette', alt: malt });
  }
  L.push('-');
  L.push({ k: 'temizle', ad: 'Seçimi temizle', ikon: 'x' });
  return L;
}

// ── HTML ──────────────────────────────────────────────────────────────────
function _mw3bMenuSatirHTML(o){
  if(o === '-') return '<div class="ve-mw-3b-menu-ayrac" role="separator"></div>';
  var nokta = o.rol ? '<span class="ve-mw-3b-menu-renk" style="--renk:var(' + veMntWiz3bRolJeton(o.rol) + ')" aria-hidden="true"></span>'
    : (o.ikon ? _mwIkon(o.ikon) : '<span class="ve-mw-3b-menu-bos" aria-hidden="true"></span>');
  var b = '<button type="button" class="ve-mw-3b-menu-o" role="menuitem' + (o.secili !== undefined ? 'radio' : '') + '" data-k="' + _mwEsc(o.k) + '"'
    + (o.secili !== undefined ? ' aria-checked="' + (o.secili ? 'true' : 'false') + '"' : '')
    + (o.kapali ? ' disabled' : '') + (o.alt ? ' aria-haspopup="menu" aria-expanded="false"' : '') + ' tabindex="-1">'
    + nokta + '<span class="ve-mw-3b-menu-ad">' + _mwEsc(o.ad) + '</span>'
    + (o.alt ? _mwIkon('chevron-right') : (o.secili ? _mwIkon('check') : '')) + '</button>';
  if(!o.alt) return b;
  return '<div class="ve-mw-3b-menu-kap">' + b + '<div class="ve-mw-3b-menu ve-mw-3b-menu-alt" role="menu" aria-label="' + _mwEsc(o.ad) + '">'
    + o.alt.map(_mw3bMenuSatirHTML).join('') + '</div></div>';
}
function veMntWiz3bMenuHTML(L){
  return '<div class="ve-mw-3b-menu" id="ve-mw-3b-menu" role="menu" aria-label="Bağlam menüsü">' + L.map(_mw3bMenuSatirHTML).join('') + '</div>';
}

// ── AÇ / KAPAT ────────────────────────────────────────────────────────────
// `dugum`: tıklanan düğüm (-1: boşluk). Seçimde değilse seçim ona iner.
function veMntWiz3bMenuAc(x, y, dugum, kaynak){
  var V = typeof _mw3b !== 'undefined' ? _mw3b : null;
  if(!V || V.okuma || typeof document === 'undefined') return false;
  veMntWiz3bMenuKapat();
  if(dugum >= 0 && V.secim.indexOf(dugum) < 0) veMntWiz3bSec(dugum, false, kaynak === 'agac' ? 'agac' : undefined);
  var el = document.createElement('div');
  el.className = 've-mw-3b-menu-katman';
  var bos = dugum < 0 && kaynak !== 'agac';
  el.innerHTML = veMntWiz3bMenuHTML(veMntWiz3bMenuOgeleri(V.s, V.secim, V.gizli, { bos: bos, gorunus: V.gorunus, zemin: V.zemin }));
  // Katman görüntüleyicinin içinde (kapanınca onunla gider); konum kabın köşesine
  // göre — kap kapsayıcı sorgusunun kabı, sabit konum onun içinde göreli olurdu
  var kap = V.ov || document.body, r = kap.getBoundingClientRect ? kap.getBoundingClientRect() : { left: 0, top: 0, width: 1280, height: 800 };
  kap.appendChild(el);
  var m = el.firstChild, w = m.offsetWidth || 220, h = m.offsetHeight || 300;
  var W = r.width || window.innerWidth || 1280, H = r.height || window.innerHeight || 800, lx = x - r.left, ly = y - r.top;
  m.style.left = Math.max(4, Math.min(lx, W - w - 4)) + 'px';
  m.style.top = Math.max(4, Math.min(ly, H - h - 4)) + 'px';
  if(lx + w + 200 > W) m.classList.add('sola');              // alt menü sola açılır
  V.menu = { el: el, dugum: dugum };
  var tik = function(e){
    var o = e.target && e.target.closest ? e.target.closest('.ve-mw-3b-menu-o') : null;
    if(!o || o.disabled) return;
    if(o.getAttribute('aria-haspopup')){ _mw3bMenuAltAc(o, true); return; }
    veMntWiz3bMenuUygula(o.getAttribute('data-k'));
  };
  var disari = function(e){ if(V.menu && !V.menu.el.contains(e.target)) veMntWiz3bMenuKapat(); };
  var tus = function(e){ _mw3bMenuTus(e); };
  m.addEventListener('click', tik);
  m.addEventListener('pointerover', function(e){
    var o = e.target && e.target.closest ? e.target.closest('.ve-mw-3b-menu-o') : null;
    if(o && !o.disabled) o.focus();
  });
  // Pencerenin YAKALAMA evresinde: 3B'nin Esc'i (belgenin yakalaması) menü açıkken
  // görüntüleyiciyi kapatmasın — önce menü kapanır
  window.addEventListener('pointerdown', disari, true);
  window.addEventListener('keydown', tus, true);
  window.addEventListener('blur', veMntWiz3bMenuKapat);
  V.menu.sok = function(){
    window.removeEventListener('pointerdown', disari, true);
    window.removeEventListener('keydown', tus, true);
    window.removeEventListener('blur', veMntWiz3bMenuKapat);
  };
  var ilk = m.querySelector('.ve-mw-3b-menu-o:not([disabled])');
  if(ilk) ilk.focus();
  return true;
}
function veMntWiz3bMenuKapat(){
  var V = typeof _mw3b !== 'undefined' ? _mw3b : null;
  if(!V || !V.menu) return false;
  if(V.menu.sok) V.menu.sok();
  if(V.menu.el && V.menu.el.parentNode) V.menu.el.parentNode.removeChild(V.menu.el);
  V.menu = null;
  return true;
}
function veMntWiz3bMenuAcik(){ var V = typeof _mw3b !== 'undefined' ? _mw3b : null; return !!(V && V.menu); }
function _mw3bMenuAltAc(o, odak){
  o.setAttribute('aria-expanded', 'true');
  var alt = o.parentNode.querySelector('.ve-mw-3b-menu-alt');
  if(odak && alt){ var ilk = alt.querySelector('.ve-mw-3b-menu-o:not([disabled])'); if(ilk) ilk.focus(); }
}
// Klavye: ↑ ↓ gezer, → alt menüyü açar, ← kapatır, Enter · boşluk uygular, Esc kapatır
function _mw3bMenuTus(e){
  var V = _mw3b;
  if(!V || !V.menu) return;
  var o = document.activeElement && document.activeElement.closest ? document.activeElement.closest('.ve-mw-3b-menu-o') : null;
  if(e.key === 'Escape'){ e.preventDefault(); e.stopImmediatePropagation(); veMntWiz3bMenuKapat(); return; }
  if(!o || !V.menu.el.contains(o)) return;
  var liste = o.parentNode.classList.contains('ve-mw-3b-menu-kap') ? o.parentNode.parentNode : o.parentNode;
  var oge = Array.prototype.filter.call(liste.querySelectorAll(':scope > .ve-mw-3b-menu-o, :scope > .ve-mw-3b-menu-kap > .ve-mw-3b-menu-o'),
    function(b){ return !b.disabled; });
  var i = oge.indexOf(o);
  if(e.key === 'ArrowDown' || e.key === 'ArrowUp'){
    e.preventDefault(); e.stopPropagation();
    var n = oge[(i + (e.key === 'ArrowDown' ? 1 : -1) + oge.length) % oge.length];
    if(n) n.focus();
  } else if(e.key === 'ArrowRight' && o.getAttribute('aria-haspopup')){
    e.preventDefault(); e.stopPropagation(); _mw3bMenuAltAc(o, true);
  } else if(e.key === 'ArrowLeft' && liste.classList.contains('ve-mw-3b-menu-alt')){
    e.preventDefault(); e.stopPropagation();
    var ust = liste.parentNode.querySelector(':scope > .ve-mw-3b-menu-o');
    if(ust){ ust.setAttribute('aria-expanded', 'false'); ust.focus(); }
  } else if(e.key === 'Enter' || e.key === ' '){
    e.preventDefault(); e.stopPropagation();
    if(o.getAttribute('aria-haspopup')) _mw3bMenuAltAc(o, true); else veMntWiz3bMenuUygula(o.getAttribute('data-k'));
  }
}

// ── KOMUTLAR ──────────────────────────────────────────────────────────────
function veMntWiz3bMenuUygula(k){
  var V = typeof _mw3b !== 'undefined' ? _mw3b : null;
  if(!V) return false;
  veMntWiz3bMenuKapat();
  k = String(k || '');
  if(k.indexOf('rol:') === 0) return veMntWiz3bRol(k.slice(4));
  if(k.indexOf('bakis:') === 0) return typeof veMntWiz3bBakis === 'function' ? veMntWiz3bBakis(k.slice(6)) : false;
  if(k.indexOf('gorunus:') === 0){
    var g = veMntWiz3bGorunusSec(k.slice(8));
    if(typeof _mw3bAracYaz === 'function') _mw3bAracYaz();                   // çubuğun Görünüş listesi
    return g;
  }
  if(k.indexOf('zemin:') === 0) return veMntWiz3bZeminSec(k.slice(6));
  if(k.indexOf('malzeme:') === 0) return veMntWiz3bMalzeme(k.slice(8));
  if(k === 'gizle' || k === 'goster' || k === 'yalniz' || k === 'tumu') return veMntWiz3bGizle(k);
  if(k === 'agac') return veMntWiz3bAgactaGoster(V.secili);
  if(k === 'odak') return _mw3bSecimeSigdir();
  if(k === 'sigdir') return veMntWiz3bSigdir();
  if(k === 'temizle') return veMntWiz3bSec(-1);
  return false;
}
// GİZLE · GÖSTER (saf çekirdek, testli): seçimin parçaları üstünde yeni gizli kümesi
function veMntWiz3bGizliKume(s, secim, gizli, k){
  var G = {}, P = _mw3bMenuParcalar(s, secim);
  Object.keys(gizli || {}).forEach(function(i){ if(gizli[i]) G[i] = 1; });
  if(k === 'tumu') return {};
  if(k === 'gizle') P.forEach(function(i){ G[i] = 1; });
  else if(k === 'goster') P.forEach(function(i){ delete G[i]; });
  else if(k === 'yalniz'){
    var sec = {}; P.forEach(function(i){ sec[i] = 1; });
    G = {};
    s.sonuc.parcalar.forEach(function(p, i){ if(!sec[i]) G[i] = 1; });
  }
  return G;
}
function veMntWiz3bGizle(k){
  var V = typeof _mw3b !== 'undefined' ? _mw3b : null;
  if(!V || !V.s || !V.s.sonuc) return false;
  V.gizli = veMntWiz3bGizliKume(V.s, V.secim, V.gizli, k);
  if(V.fare >= 0 && V.gizli[V.fare]) V.fare = -1;
  _mw3bBoya(); _mw3bCiz(true);
  if(typeof _mw3bAgac === 'function') _mw3bAgac(-1);
  return true;
}
// Düğüm gizli mi (saf, testli): bütün parçaları gizliyse
function veMntWiz3bDugumGizli(s, d, gizli){
  if(!gizli) return false;
  var P = veMntWiz3bParcalar(s, d);
  return P.length > 0 && P.every(function(i){ return gizli[i]; });
}
// AĞAÇTA GÖSTER: arama temizlenir, dal açılır, satır görünür olur ve kısa vurgu alır
function veMntWiz3bAgactaGoster(d){
  var V = typeof _mw3b !== 'undefined' ? _mw3b : null;
  if(!V || !(d >= 0)) return false;
  if(V.ara){
    V.ara = '';
    var a = typeof document !== 'undefined' && document.getElementById('ve-mw-3b-ara');
    if(a) a.value = '';
  }
  if(typeof _mw3bAgac === 'function') _mw3bAgac(d);
  var el = typeof document !== 'undefined' && document.querySelector('#ve-mw-3b-agac-l [data-ve-3b-agac="' + d + '"]');
  if(el){
    if(el.scrollIntoView) el.scrollIntoView({ block: 'center' });
    el.classList.remove('isik'); void el.offsetWidth; el.classList.add('isik');
  }
  return !!el;
}
// SEÇİME YAKINLAŞTIR: seçimin görünen parçalarının kutusuna sığar (bakış yönü kalır)
function _mw3bSecimeSigdir(){
  var V = typeof _mw3b !== 'undefined' ? _mw3b : null;
  if(!V || !V.camera || !V.secim.length) return false;
  if(V.secim.length === 1 && typeof _mw3bOdakla === 'function' && !(V.gizli && Object.keys(V.gizli).length)) return _mw3bOdakla(V.secim[0]);
  var b = _mw3bParcaKutusu(_mw3bMenuParcalar(V.s, V.secim));
  if(!b) return false;
  V.eldegdi = true;
  _mw3bSigdir(b, null);
  return true;
}
// Parçaların (görünenlerin) kutusu: THREE.Box3 ya da null
function _mw3bParcaKutusu(P){
  var V = _mw3b, b = null, set = null;
  if(P){ set = {}; P.forEach(function(i){ set[i] = 1; }); }
  for(var e = 0; e < V.ekli.length; e++){
    var i = V.ekli[e], j = e * 6, K = V.kutular;
    if((set && !set[i]) || (V.gizli && V.gizli[i]) || !isFinite(K[j])) continue;
    var k = new THREE.Box3(new THREE.Vector3(K[j], K[j + 1], K[j + 2]), new THREE.Vector3(K[j + 3], K[j + 4], K[j + 5]));
    if(!b) b = k; else b.union(k);
  }
  return b;
}
// Ağacın satırına sağ tık (satırın olayı — js/cp-mount-3b-agac.js)
function veMntWiz3bAgacMenu(d, e){
  if(e && e.preventDefault) e.preventDefault();
  return veMntWiz3bMenuAc(e ? e.clientX : 0, e ? e.clientY : 0, d, 'agac');
}

if(typeof module !== 'undefined' && module.exports){
  module.exports = {
    veMntWiz3bMenuOgeleri: veMntWiz3bMenuOgeleri, veMntWiz3bMenuHTML: veMntWiz3bMenuHTML,
    veMntWiz3bGizliKume: veMntWiz3bGizliKume, veMntWiz3bDugumGizli: veMntWiz3bDugumGizli
  };
}
