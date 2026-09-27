/**
 * sayi-alan.js — TÜRKÇE SAYI ALANI (kullanıcı kararı 7·C, 2026-09-27)
 * ───────────────────────────────────────────────────────────────────────────
 * Sayı girilen alan `type="text" inputmode="decimal"` yazılır, `type="number"`
 * DEĞİL. Bu dosya o alanı Türkçe gösterir (1716,25) ve `.value`'sunu MAKİNE
 * biçiminde geri verir ("1716.25"): alanı okuyan işleyiciler
 * (`parseFloat(el.value)`) hiç değişmez. Tarayıcının sayı alanı aynı işi
 * yalnız arayüz dili virgüllüyse yapıyor.
 *
 * Neden: `type="number"` virgülü tanımıyor — ölçüldü (Chromium, tr-TR yerel
 * ayarında da): "63,5" yazınca değer "635", "1.716,2" yazınca "1.7162"; iki
 * hata da sessiz. Ekran virgülle yazınca kullanıcı da virgülle yazar.
 *
 * Sözleşme:
 *   · Kaynak alanın değerini MAKİNE biçiminde yazar (`// makine: sayı alanının
 *     değeri`); görünümü bu dosya Türkçeleştirir, rakamlara dokunmadan
 *     ("3.510" → "3,510" — dişli oranının üç hanesi kaybolmaz).
 *   · `.value` okunurken veSayiMakine'nin kuralı (js/sayi.js): virgül varsa
 *     Türkçe, yoksa nokta ondalık; sayı değilse '' (eski alan da öyleydi).
 *   · Yapıştırılan sayı alanın biçimine çevrilir ("1.716,2 mm" → 1716,2).
 *     GRUPLU TAM SAYI ("1.800") iki türlü okunabilir: ondalık okunur, alan
 *     işaretlenir ve bildirim çıkar — sessiz kalmaz.
 *   · `step` taşıyan alanda ↑/↓ eski sayı alanı gibi adım atar.
 *
 * Kapı: tests/unit/sayi-alan.test.js + tests/e2e/sayi-alan.spec.js.
 * Ölçüm Görüntüleyici'de BİREBİR kopya (viewer/sync.js).
 */

var VE_SAYI_ALAN_SECICI = 'input[inputmode="decimal"]';
var _VE_SA_MAKINE = /^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i;
var _VE_SA_GRUPLU_TAM = /^[-+−]?\d{1,3}(\.\d{3})+$/;
var _VE_SA_HARF = /^[0-9.,+\-eE−]*$/;
// Sayı + isteğe bağlı birim: ekrandan kopyalanan "1.714,6 mm" de sayıdır.
var _VE_SA_YAPISTIR = /^\s*([-+−]?(?:\d[\d.,]*|[.,]\d+)(?:[eE][-+]?\d+)?)\s*(?:[^\d\s.,][^\d]*)?$/;

// Makine metni → alanda görünen: rakamlar aynen, ondalık nokta virgül olur.
// Makine biçiminde olmayan metin (kullanıcının yazdığı) dokunulmadan döner.
function veSayiAlanGoster(v) {
  var s = (v === null || v === undefined) ? '' : String(v);
  var t = s.trim();
  return _VE_SA_MAKINE.test(t) ? t.replace('.', ',') : s;
}

function _veSaHane(x) {
  var s = String(x), i = s.indexOf('.');
  if(/e-/i.test(s)) return 12;
  return i < 0 ? 0 : s.length - i - 1;
}

// ↑/↓ adımı — HTML'in sayı alanı kuralı: adım tabanı `min`, yoksa alanın
// yazıldığı değer, yoksa 0; hizasız değer bir sonraki hizalı değere gider;
// `step="any"` 1 atar. o: { step, min, max, taban } (metin; eksik olabilir).
function veSayiAlanAdim(v, yukari, o) {
  o = o || {};
  var st = parseFloat(o.step), serbest = !(st > 0);
  if(serbest) st = 1;
  var min = veSayiOku(o.min), max = veSayiOku(o.max), tb = veSayiOku(o.taban);
  var taban = isFinite(min) ? min : (isFinite(tb) ? tb : 0);
  if(!isFinite(v)) v = 0;
  var n;
  if(serbest) n = v + (yukari ? 1 : -1);
  else {
    var k = (v - taban) / st;
    n = taban + (yukari ? Math.floor(k + 1e-9) + 1 : Math.ceil(k - 1e-9) - 1) * st;
  }
  if(isFinite(max) && n > max) n = max;
  if(isFinite(min) && n < min) n = min;
  var hane = Math.min(12, Math.max(_veSaHane(st), _veSaHane(taban), serbest ? _veSaHane(v) : 0));
  return +n.toFixed(hane);   // makine: kayan nokta artığını atan yuvarlama
}

var _veSaYerli = (typeof HTMLInputElement !== 'undefined')
  ? Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value') : null;

// Alanı Türkçe sayı alanına çevirir; ikinci çağrı bir şey yapmaz.
function veSayiAlanKur(el) {
  if(!el || el.__veSayiAlan || !_veSaYerli) return el;
  el.__veSayiAlan = true;
  Object.defineProperty(el, 'value', {
    configurable: true,
    get: function() { return veSayiMakine(_veSaYerli.get.call(this)); },
    set: function(v) { _veSaYerli.set.call(this, veSayiAlanGoster(v)); }
  });
  var ham = _veSaYerli.get.call(el), gos = veSayiAlanGoster(ham);
  if(gos !== ham) _veSaYerli.set.call(el, gos);
  var ph = el.getAttribute('placeholder');
  if(ph && /\d\.\d/.test(ph)) el.setAttribute('placeholder', ph.replace(/(\d)\.(\d)/g, '$1,$2'));
  return el;
}

function _veSaTara(kok) {
  if(!kok || kok.nodeType !== 1) return;
  if(kok.matches && kok.matches(VE_SAYI_ALAN_SECICI)) veSayiAlanKur(kok);
  var l = kok.querySelectorAll ? kok.querySelectorAll(VE_SAYI_ALAN_SECICI) : [];
  for(var i = 0; i < l.length; i++) veSayiAlanKur(l[i]);
}

function _veSaAlan(e) {
  var el = e && e.target;
  return (el && el.__veSayiAlan && !el.readOnly && !el.disabled) ? el : null;
}

function _veSaBildir(metin) {
  if(typeof showToast === 'function') showToast(metin, 'warning');
}

// Harf yazılmaz — eski sayı alanı da yazdırmıyordu.
function _veSaYazim(e) {
  var el = _veSaAlan(e);
  if(el && e.inputType === 'insertText' && e.data && !_VE_SA_HARF.test(e.data)) e.preventDefault();
}

// Seçimin yerine metin koyar ve yazılmış gibi `input` ateşler (geri-al
// yığınına da girsin diye önce tarayıcının kendi komutu denenir).
function _veSaKoy(el, metin) {
  var ok = false;
  try {
    ok = document.activeElement === el && typeof document.execCommand === 'function'
      && document.execCommand('insertText', false, metin);
  } catch(x) { ok = false; }
  if(ok) return;
  var a = el.selectionStart, b = el.selectionEnd, ham = _veSaYerli.get.call(el);
  if(a == null) { a = 0; b = ham.length; }
  _veSaYerli.set.call(el, ham.slice(0, a) + metin + ham.slice(b));
  try { el.setSelectionRange(a + metin.length, a + metin.length); } catch(x) { /* odak yok */ }
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

function _veSaYapistir(e) {
  var el = _veSaAlan(e);
  if(!el) return;
  var dt = e.clipboardData;
  var ham = dt ? String(dt.getData('text/plain') || dt.getData('text') || '') : '';
  e.preventDefault();
  var m = _VE_SA_YAPISTIR.exec(ham), makine = m ? veSayiMakine(m[1]) : '';
  if(!makine) {
    _veSaBildir('Yapıştırılan metin bir sayı değil: “' + ham.trim().slice(0, 24) + '”');
    return;
  }
  el.classList.remove('ve-sayi-belirsiz');
  _veSaKoy(el, veSayiAlanGoster(makine));
  var yazi = m[1].replace('−', '-');
  if(_VE_SA_GRUPLU_TAM.test(yazi)) {
    el.classList.add('ve-sayi-belirsiz');
    _veSaBildir('“' + yazi + '” ' + veSayi(parseFloat(makine)) + ' okundu. '
      + 'Nokta binlik ayırıcıysa noktasız yazın: ' + yazi.replace(/\./g, ''));
  }
}

function _veSaAdimTus(e) {
  if(e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
  if(e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || e.isComposing) return;
  var el = _veSaAlan(e);
  if(!el || !el.hasAttribute('step')) return;   // hep metin alanı olan alanda ok imleci taşır
  e.preventDefault();
  el.value = String(veSayiAlanAdim(parseFloat(el.value), e.key === 'ArrowUp', {
    step: el.getAttribute('step'), min: el.getAttribute('min'),
    max: el.getAttribute('max'), taban: el.getAttribute('value')
  }));
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

// İşaret bir sonraki yazımda kalkar (yapıştırmanın kendi `input`u işaretten
// ÖNCE ateşleniyor: _veSaKoy eşzamanlı).
function _veSaGirdi(e) {
  var el = e && e.target;
  if(el && el.__veSayiAlan) el.classList.remove('ve-sayi-belirsiz');
}

if(typeof document !== 'undefined' && document.addEventListener && _veSaYerli) {
  document.addEventListener('beforeinput', _veSaYazim, true);
  document.addEventListener('paste', _veSaYapistir, true);
  document.addEventListener('keydown', _veSaAdimTus, true);
  document.addEventListener('input', _veSaGirdi, true);
  if(typeof MutationObserver !== 'undefined') {
    new MutationObserver(function(kayit) {
      for(var i = 0; i < kayit.length; i++) {
        var a = kayit[i].addedNodes;
        for(var j = 0; j < a.length; j++) _veSaTara(a[j]);
      }
    }).observe(document.documentElement, { childList: true, subtree: true });
  }
  _veSaTara(document.documentElement);
}

if(typeof module !== 'undefined' && module.exports) {
  module.exports = { veSayiAlanGoster: veSayiAlanGoster, veSayiAlanKur: veSayiAlanKur,
    veSayiAlanAdim: veSayiAlanAdim, VE_SAYI_ALAN_SECICI: VE_SAYI_ALAN_SECICI };
}
