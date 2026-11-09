// ============================================================================
// js/cp-mount-3b-belge.js — Takoz 3B: ŞANZIMAN AİLESİNİN BELGESİ (tuvalin üstünde)
// ────────────────────────────────────────────────────────────────────────────
// Kullanıcı 2026-11-06 (Canlı Not 52): *"Önce şanzıman ailesi seçeriz, ardından o
// seçtiğimiz şanzıman ailesine ait PDF açılır ve o PDF üzerinden işaretlemeli
// şekilde şanzımanın özelliklerini seçeriz. Ama PDF ile aynı kalırız. Yani
// kullanıcı oradan hem görselleri görür, hem seçeneklerini seçer."*
//
// Aile listeden İLK kez seçilince açılır (veMntWiz3bVeriSec); Özellikler'in Belge
// satırı yeniden açar. Sayfa belgenin kendisi (görsel, js/mount-belge-veri.js);
// bölgeler üstünde: tık seçeneği yazar, işaretli bölgenin tıkı seçimini kaldırır; her
// bölgenin solunda onay kutusu (Canlı Not 56), bağdaşmayan bölge kapalı (sebebi
// title'da). Özellikler yanda canlı; belgenin kaydırması korunur.
// Bölüm dizini yok (Canlı Not 75). Başka birimin seçimi, Esc ve Kapat tuvale döner. Durum (yakınlık) görünümün,
// kaydedilmez. Kapı: tests/unit/mount-belge.test.js + tests/e2e/mount-belge.spec.js.
// ============================================================================

var VE_MW_3B_BELGE_YAKIN = [0.6, 0.75, 1, 1.25, 1.5, 2];   // sığdırmanın katı
var VE_MW_3B_BELGE_BOSLUK = 24;                            // sayfanın yanları, px
var VE_MW_3B_BELGE_SATIR = 30;                             // pt: bundan yüksek bölge alan (çizim) — kutu üst hizada

function _mw3bBelgeVs(V, birim){
  var s = V && V.s;
  if(!s || !(birim >= 0) || typeof veMntStpVs !== 'function') return null;
  var vs = veMntStpVs((s.yogunluk || {})[birim], s.roller[birim]);
  return vs && typeof vs.aile === 'string' ? vs : null;
}
// Özellikler'in Belge satırı: ailenin belgesi varsa (js/cp-mount-3b.js → veMntWiz3bAltHTML)
function veMntWiz3bBelgeSatirHTML(birim, vs){
  var B = vs && typeof veMntBelge === 'function' ? veMntBelge(vs.aile) : null;
  if(!B) return '';
  var V = typeof _mw3b !== 'undefined' ? _mw3b : null, acik = !!(V && V.belge && V.belge.birim === birim);
  return _mw3bOzSatir('ve-mw-3b-belge-s', 'Belge',
    '<button type="button" class="ve-fw-3b-rol" id="ve-mw-3b-belge-ac" aria-pressed="' + (acik ? 'true' : 'false') + '"'
      + ' title="' + _mwEsc(B.ad + ' · ' + B.tarih) + '" onclick="veMntWiz3bBelgeAc(' + birim + ')">'
      + _mwIkon('file-text') + ' Transmission Data</button>',
    'Belge — ' + _mwEsc(B.ad));
}
// Listenin seçimi: aile İLK kez seçilince belgesi açılır
function veMntWiz3bVeriSec(birim, k){
  var V = typeof _mw3b !== 'undefined' ? _mw3b : null;
  var once = _mw3bBelgeVs(V, birim);
  var r = typeof veMntWizStpYogunluk === 'function' ? veMntWizStpYogunluk(birim, k) : false;
  var vs = _mw3bBelgeVs(V, birim);
  if(vs && (!once || once.aile !== vs.aile) && typeof veMntBelge === 'function' && veMntBelge(vs.aile)) veMntWiz3bBelgeAc(birim);
  return r;
}

// ── AÇ / KAPAT ────────────────────────────────────────────────────────────
function veMntWiz3bBelgeAc(birim){
  var V = typeof _mw3b !== 'undefined' ? _mw3b : null;
  if(!V || V.okuma || typeof document === 'undefined') return false;
  var vs = _mw3bBelgeVs(V, birim), B = vs ? veMntBelge(vs.aile) : null, tuval = document.getElementById('ve-mw-3b-tuval');
  if(!B || !tuval) return false;
  if(V.belge){
    if(V.belge.birim === birim) return true;
    veMntWiz3bBelgeKapat();
  }
  if(typeof veMntWiz3bMenuKapat === 'function') veMntWiz3bMenuKapat();
  var el = document.createElement('section');
  el.className = 've-mw-3b-belge';
  el.id = 've-mw-3b-belge';
  el.setAttribute('aria-label', B.ad);
  el.innerHTML = veMntWiz3bBelgeHTML(B);
  tuval.appendChild(el);
  V.belge = { birim: birim, aile: vs.aile, B: B, el: el, yakin: 1 };
  var kay = el.querySelector('.ve-mw-3b-belge-kay');
  el.addEventListener('click', function(e){
    var b = e.target && e.target.closest ? e.target.closest('[data-belge-b]') : null;
    if(b && !b.disabled){ var p = b.getAttribute('data-belge-b').split('-'); veMntWiz3bBelgeSec(+p[0], +p[1]); }
  });
  // Ctrl + tekerlek yakınlaştırır (kaydırma tekerleğin kendi işi)
  kay.addEventListener('wheel', function(e){
    if(!e.ctrlKey) return;
    e.preventDefault();
    veMntWiz3bBelgeYakin(e.deltaY < 0 ? 1 : -1);
  }, { passive: false });
  // Esc belgeyi kapatır, yalnız onu (pencerenin yakalaması 3B'ninkinden önce)
  var tus = function(e){
    if(e.key !== 'Escape' || !V.belge || typeof _mw3b === 'undefined' || _mw3b !== V) return;
    if(typeof veMntWiz3bMenuAcik === 'function' && veMntWiz3bMenuAcik()) return;
    e.preventDefault(); e.stopImmediatePropagation();
    veMntWiz3bBelgeKapat();
  };
  window.addEventListener('keydown', tus, true);
  var ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(function(){ _mw3bBelgeOlc(); }) : null;
  if(ro) ro.observe(kay);
  V.belge.sok = function(){ window.removeEventListener('keydown', tus, true); if(ro) try { ro.disconnect(); } catch(e2){} };
  V.sokucu.push(function(){ if(V.belge && V.belge.sok) V.belge.sok(); });
  _mw3bBelgeOlc();
  _mw3bBelgeTazele();
  var ilk = el.querySelector('.ve-mw-3b-belge-kapat');
  if(ilk && ilk.focus) try { ilk.focus({ preventScroll: true }); } catch(e3){ ilk.focus(); }
  return true;
}
function veMntWiz3bBelgeKapat(){
  var V = typeof _mw3b !== 'undefined' ? _mw3b : null;
  if(!V || !V.belge) return false;
  if(V.belge.sok) V.belge.sok();
  if(V.belge.el && V.belge.el.parentNode) V.belge.el.parentNode.removeChild(V.belge.el);
  V.belge = null;
  var b = typeof document !== 'undefined' && document.getElementById('ve-mw-3b-belge-ac');
  if(b) b.setAttribute('aria-pressed', 'false');
  return true;
}
function veMntWiz3bBelgeAcik(){ var V = typeof _mw3b !== 'undefined' ? _mw3b : null; return !!(V && V.belge); }

// ── HTML (saf, testli) ────────────────────────────────────────────────────
function veMntWiz3bBelgeHTML(B){
  var olcu = B.olcu || [612, 792];
  var sayfalar = B.sayfalar.map(function(s, si){
    return '<div class="ve-mw-3b-belge-s" data-belge-sayfa="' + s.no + '" style="aspect-ratio:' + s.g + ' / ' + s.y + ';">'
      + '<img src="' + _mwEsc(veMntBelgeResim(s.resim)) + '" alt="Page ' + s.no + '" width="' + s.g + '" height="' + s.y + '" loading="lazy" decoding="async" draggable="false">'
      + s.bolge.map(function(b, bi){
          var st = 'left:' + _mw3bBelgeYuz(b.k[0], olcu[0]) + '%;top:' + _mw3bBelgeYuz(b.k[1], olcu[1]) + '%;width:'
            + _mw3bBelgeYuz(b.k[2], olcu[0]) + '%;height:' + _mw3bBelgeYuz(b.k[3], olcu[1]) + '%';
          if(!b.s) return '<span class="ve-mw-3b-belge-b ve-mw-3b-belge-yalniz" data-belge-y="' + si + '-' + bi + '" style="' + st + '" aria-hidden="true"></span>';
          // Onay kutusu (Canlı Not 56): satırın solunda; sütunda tanımın yerinde (`t`, pt — kutunun içi)
          var t = b.t ? ' style="left:' + _mw3bBelgeYuz(b.t[0] - b.k[0], b.k[2]) + '%;top:' + _mw3bBelgeYuz(b.t[1] - b.k[1], b.k[3]) + '%"' : '';
          var tur = b.t ? ' ve-mw-3b-belge-b--ic' : (b.k[3] > VE_MW_3B_BELGE_SATIR ? ' ve-mw-3b-belge-b--alan' : '');
          return '<button type="button" class="ve-mw-3b-belge-b' + tur + '" data-belge-b="' + si + '-' + bi + '" style="' + st + '" aria-pressed="false">'
            + '<span class="ve-mw-3b-belge-t"' + t + ' aria-hidden="true">' + _mwIkon('check') + '</span></button>';
        }).join('')
      + '</div>';
  }).join('');
  return '<div class="ve-mw-3b-belge-bas">'
      + '<h3 class="ve-mw-3b-belge-ad">' + _mwIkon('file-text') + '<b>' + _mwEsc(B.ad) + '</b><span class="ve-fw-dim">' + _mwEsc(B.tarih) + '</span></h3>'
      + '<div class="ve-mw-3b-belge-arac">'
        + '<button type="button" class="ve-mw-3b-hap" data-belge-yakin="-1" aria-label="Uzaklaştır" title="Uzaklaştır" onclick="veMntWiz3bBelgeYakin(-1)">' + _mwIkon('zoom-out') + '</button>'
        + '<span class="ve-mw-3b-belge-yuzde" id="ve-mw-3b-belge-yuzde"></span>'
        + '<button type="button" class="ve-mw-3b-hap" data-belge-yakin="1" aria-label="Yakınlaştır" title="Yakınlaştır" onclick="veMntWiz3bBelgeYakin(1)">' + _mwIkon('zoom-in') + '</button>'
        + '<button type="button" class="ve-mw-3b-hap" data-belge-yakin="0" aria-label="Sığdır" title="Sığdır" onclick="veMntWiz3bBelgeYakin(0)">' + _mwIkon('maximize') + '</button>'
        + '<button type="button" class="ve-mw-3b-hap ve-mw-3b-belge-kapat" onclick="veMntWiz3bBelgeKapat()">' + _mwIkon('x') + ' Kapat</button>'
      + '</div></div>'
    // BÖLÜMLER YOK (kullanıcı 2026-11-09, Canlı Not 75: *"Bu kısımlara gerek yok. Kullanıcıya
    // sunmayalım"*): sayfalar kaydırılır. Kapı: mount-belge.test.js → *BÖLÜMLER YOK*.
    + '<div class="ve-mw-3b-belge-govde">'
      + '<div class="ve-mw-3b-belge-kay" tabindex="-1"><div class="ve-mw-3b-belge-sayfalar">' + sayfalar + '</div></div>'
    + '</div>';
}
function _mw3bBelgeYuz(v, t){ return Math.round(v / t * 100000) / 1000; }  // makine: CSS yüzde

// ── DURUM: bölgeler seçimden; birim değişince kapanır ──────────────────────
function _mw3bBelgeTazele(){
  var V = typeof _mw3b !== 'undefined' ? _mw3b : null;
  if(!V || !V.belge || typeof document === 'undefined') return;
  var K = V.belge, vs = _mw3bBelgeVs(V, K.birim);
  var birim = typeof _mw3bSeciliBirim === 'function' ? _mw3bSeciliBirim(V.s, V.secili) : K.birim;
  // Başka bir birim seçildi ya da aile kalktı: belge o birimindi
  if(birim !== K.birim || !vs || vs.aile !== K.aile){ veMntWiz3bBelgeKapat(); return; }
  var A = typeof veMntVsAile === 'function' ? veMntVsAile(vs.k) : null, el = K.el;
  K.B.sayfalar.forEach(function(s, si){
    s.bolge.forEach(function(b, bi){
      var d = veMntBelgeDurum(A, vs, b), id = si + '-' + bi;
      if(!b.s){
        var y = el.querySelector('[data-belge-y="' + id + '"]');
        if(y) y.classList.toggle('secili', d.secili);
        return;
      }
      var n = el.querySelector('[data-belge-b="' + id + '"]');
      if(!n) return;
      // işaretli bölgenin seçimi kaldırılır; varsayılanın kendisi kaldırılmaz (kilitli)
      var ad = veMntBelgeEtiket(A, b), kilit = d.secili && !d.kaldir;
      n.setAttribute('aria-pressed', d.secili ? 'true' : 'false');
      n.setAttribute('aria-label', ad);
      n.disabled = !d.secili && !d.tik;
      if(kilit) n.setAttribute('aria-disabled', 'true'); else n.removeAttribute('aria-disabled');
      n.title = n.disabled ? d.neden : (kilit ? 'Varsayılan.' : ad);
    });
  });
  var ac = document.getElementById('ve-mw-3b-belge-ac');
  if(ac) ac.setAttribute('aria-pressed', 'true');
}
// Bölgenin tıkı: seçenekleri yazar (kütle kaynağının anahtarı — Özellikler'in listeleri gibi);
// işaretli bölgenin tıkı seçimini kaldırır (Canlı Not 56 — js/mount-belge.js → veMntBelgeKaldir)
function veMntWiz3bBelgeSec(si, bi){
  var V = typeof _mw3b !== 'undefined' ? _mw3b : null;
  if(!V || !V.belge) return false;
  var K = V.belge, s = K.B.sayfalar[si], b = s && s.bolge[bi], vs = _mw3bBelgeVs(V, K.birim);
  if(!b || !vs) return false;
  var d = veMntBelgeDurum(veMntVsAile(vs.k), vs, b), k = d.secili ? d.kaldir : d.anahtar;
  if(!k || k === vs.k) return false;
  return veMntWizStpYogunluk(K.birim, k);
}

// ── YAKINLIK ────────────────────────────────────────────────────
// Sayfanın genişliği: kaydırma alanına sığan genişliğin katı (sığdırma en çok %100)
function _mw3bBelgeOlc(){
  var V = typeof _mw3b !== 'undefined' ? _mw3b : null;
  if(!V || !V.belge) return;
  var el = V.belge.el, kay = el.querySelector('.ve-mw-3b-belge-kay'), L = el.querySelector('.ve-mw-3b-belge-sayfalar');
  if(!kay || !L) return;
  var dogal = (V.belge.B.olcu[0] || 612) * 96 / 72;                // %100: 1 pt = 1/72 inç
  var sig = Math.max(240, Math.min(dogal, (kay.clientWidth || 800) - 2 * VE_MW_3B_BELGE_BOSLUK));
  var g = Math.round(sig * V.belge.yakin);
  L.style.width = g + 'px';
  var y = document.getElementById('ve-mw-3b-belge-yuzde');
  if(y) y.textContent = '%' + veSayi(Math.round(g / dogal * 100), 0);
  var i = VE_MW_3B_BELGE_YAKIN.indexOf(V.belge.yakin);
  Array.prototype.forEach.call(el.querySelectorAll('[data-belge-yakin]'), function(b){
    var y2 = +b.getAttribute('data-belge-yakin');
    b.disabled = y2 < 0 ? i <= 0 : (y2 > 0 ? i >= VE_MW_3B_BELGE_YAKIN.length - 1 : V.belge.yakin === 1);
  });
}
function veMntWiz3bBelgeYakin(yon){
  var V = typeof _mw3b !== 'undefined' ? _mw3b : null;
  if(!V || !V.belge) return false;
  var L = VE_MW_3B_BELGE_YAKIN, i = L.indexOf(V.belge.yakin), yeni = yon === 0 ? 1 : L[Math.max(0, Math.min(L.length - 1, i + (yon > 0 ? 1 : -1)))];
  if(yeni === V.belge.yakin) return false;
  // görünen sayfanın oranı korunur
  var kay = V.belge.el.querySelector('.ve-mw-3b-belge-kay'), oran = kay && kay.scrollHeight ? kay.scrollTop / kay.scrollHeight : 0;
  V.belge.yakin = yeni;
  _mw3bBelgeOlc();
  if(kay) kay.scrollTop = oran * kay.scrollHeight;
  return true;
}
if(typeof module !== 'undefined' && module.exports){
  module.exports = { veMntWiz3bBelgeHTML: veMntWiz3bBelgeHTML, veMntWiz3bBelgeSatirHTML: veMntWiz3bBelgeSatirHTML, veMntWiz3bVeriSec: veMntWiz3bVeriSec,
    veMntWiz3bBelgeAc: veMntWiz3bBelgeAc, veMntWiz3bBelgeKapat: veMntWiz3bBelgeKapat, veMntWiz3bBelgeSec: veMntWiz3bBelgeSec,
    veMntWiz3bBelgeYakin: veMntWiz3bBelgeYakin, veMntWiz3bBelgeAcik: veMntWiz3bBelgeAcik, VE_MW_3B_BELGE_YAKIN: VE_MW_3B_BELGE_YAKIN,
    VE_MW_3B_BELGE_SATIR: VE_MW_3B_BELGE_SATIR };
}
