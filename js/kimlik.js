// ============================================================================
// KİMLİK — üst bandın avatarı ve arkasındaki ad
// ============================================================================
// Program bir KULLANICI KAVRAMI TAŞIMIYORDU: tek ortak parola var, kim
// girdiğini kimse bilmiyor. Atölye maketindeki avatar bu yüzden ilk turda
// YAPILMADI — baş harf basmak olmayan bir kimliği iddia etmek olurdu.
//
// Bu dosya o kimliği UYDURMUYOR, AÇIYOR: kullanıcı adını bir kez yazar
// (Ayarlar → Görünüm → Kimlik), avatar onu gösterir. Ad yazılmamışken avatar
// sahte baş harf basmaz — nötr bir simge gösterir ve menüsü adı yazmaya
// çağırır. "Bilinmiyor"u "biliniyormuş gibi" göstermemek bu deponun kuralı.
//
// SAKLAMA YERELDİR ve öyle kalmalı: ad tarayıcıda durur, projeye yazılmaz,
// hiçbir yere gönderilmez. Proje dosyasına girseydi, dosyayı paylaşan herkes
// onu da paylaşırdı.
// ============================================================================

var VE_KIMLIK_KEY = 'mf-kullanici-ad';

// Yazılmış ad — yoksa boş dize. Asla `null` dönmez: çağıranların hepsi
// dizeyle çalışıyor ve bir `null` sessizce "null" yazdırırdı.
function veKimlikAd() {
  try { return (localStorage.getItem(VE_KIMLIK_KEY) || '').trim(); }
  catch(e) { return ''; }
}

function veKimlikAdYaz(ad) {
  var t = String(ad == null ? '' : ad).trim().slice(0, 40);
  try {
    if(t) localStorage.setItem(VE_KIMLIK_KEY, t);
    else localStorage.removeItem(VE_KIMLIK_KEY);
  } catch(e) {}
  veAvatarYaz();
}

// BAŞ HARF — en çok İKİ harf: üç harf bir avatarda okunmuyor, tek harf ayırt
// etmiyor. Büyütme TÜRKÇE yapılır (`toLocaleUpperCase('tr')`): `'i'` varsayılan
// büyütmede `'I'` olur, oysa Türkçe'de `'İ'`. "İlker" → "I" yanlış baş harftir.
function veKimlikBasHarf(ad) {
  var parcalar = String(ad || '').trim().split(/\s+/).filter(Boolean);
  if(!parcalar.length) return '';
  var ilk = parcalar[0].charAt(0);
  var son = parcalar.length > 1 ? parcalar[parcalar.length - 1].charAt(0) : '';
  return (ilk + son).toLocaleUpperCase('tr');
}

// Avatarı tazele. Ad yoksa nötr simge — sahte baş harf YOK.
function veAvatarYaz() {
  var el = document.getElementById('ve-bant-avatar');
  if(!el) return;
  var ad = veKimlikAd();
  var bh = veKimlikBasHarf(ad);
  el.textContent = bh;
  el.classList.toggle('ve-bant-avatar--bos', !bh);
  el.setAttribute('title', ad ? (ad + ' — hesap menüsü') : 'Adını gir — hesap menüsü');
  el.setAttribute('aria-label', ad || 'Hesap menüsü');
}

// ── HESAP MENÜSÜ ───────────────────────────────────────────────────────────
// Yüzeyi `.ve-context-menu`den alır — projenin menü dili ARTIK o sınıfın
// kendisi. İlk sürüm aynı sınıfı "dil" diye devralmıştı ama dil sınıfta
// değil dört menünün SATIR İÇİ `cssText`indeydi: sonuç saydam zeminli,
// kenarlıksız, `z-index`siz bir metin yığınıydı ve şeridin, sütundaki
// müfettişin ARKASINDA doğuyordu (ölçüldü). Görünür sanılan kapı da onu
// yakalamadı: `toBeVisible()` boyutu olan her kutuya "görünür" der.
var _veAvatarMenu = null;

function veAvatarMenuKapat() {
  if(_veAvatarMenu && _veAvatarMenu.parentNode) _veAvatarMenu.parentNode.removeChild(_veAvatarMenu);
  _veAvatarMenu = null;
  var btn = document.getElementById('ve-bant-avatar');
  if(btn) btn.setAttribute('aria-expanded', 'false');
  document.removeEventListener('mousedown', _veAvatarDisTik, true);
  document.removeEventListener('keydown', _veAvatarEsc, true);
}
function _veAvatarDisTik(e) {
  if(_veAvatarMenu && !_veAvatarMenu.contains(e.target)
     && !(e.target.closest && e.target.closest('#ve-bant-avatar'))) veAvatarMenuKapat();
}
// TEK ESC = TEK KATMAN. Dinleyici belgenin YAKALAMA evresinde duruyor ve
// eskiden olayı yayılmaya bırakıyordu: aynı ESC, map.js'in dinleyicisine de
// ulaşıp sütundaki müfettişi KAPATIYORDU (ölçüldü — menüyü kapatmak için
// basılan tuş, alttaki paneli de söküyordu).
function _veAvatarEsc(e) {
  if(e.key !== 'Escape' || !_veAvatarMenu) return;
  e.stopPropagation();
  e.preventDefault();
  var alan = _veAvatarMenu.querySelector('.ve-avatar-menu-ad');
  if(alan && !alan.hidden) { _veAvatarAdKapat(false); return; }   // önce yerinde düzenleme
  veAvatarMenuKapat();
  var btn = document.getElementById('ve-bant-avatar');
  if(btn) btn.focus();
}

// Menünün içi. Künye yalnız tek dosya sürümünde var (build gömüyor);
// modüler kopyada yoksa satır SAYI GÖSTERMEZ — boş bir çip "sürümü
// bilmiyorum"u sürüm gibi gösterirdi.
function _veAvatarMenuHTML() {
  var ad = veKimlikAd();
  var bh = veKimlikBasHarf(ad);
  var b = (typeof window !== 'undefined') ? window.__MFSIM_BUILD : null;
  var kunye = (b && b.shortSha) ? '<span class="ve-avatar-menu-kunye">' + _veKimlikEsc(b.shortSha) + '</span>' : '';
  var h = '';
  h += '<div class="ve-avatar-menu-bas">'
     +   '<span class="ve-avatar-menu-av' + (bh ? '' : ' bos') + '" aria-hidden="true">' + _veKimlikEsc(bh) + '</span>'
     +   '<div class="ve-avatar-menu-kim">'
     +     (ad ? '<b>' + _veKimlikEsc(ad) + '</b>' : '<b class="bos">Ad girilmedi</b>')
     +     '<span>Bu tarayıcıda saklanır · projeye yazılmaz</span>'
     +   '</div>'
     + '</div>';
  h += '<form class="ve-avatar-menu-ad" hidden>'
     +   '<input class="ve-fp-inp ve-fp-inp--text" type="text" maxlength="40"'
     +   ' placeholder="Adın ve soyadın" aria-label="Ad" value="' + _veKimlikEsc(ad) + '">'
     +   '<button type="submit" title="Kaydet" aria-label="Kaydet"><span class="mf-ico mf-ico-check-circle" aria-hidden="true"></span></button>'
     + '</form>';
  h += '<div class="ve-context-divider"></div>';
  h += '<div class="ve-context-item" role="menuitem" tabindex="-1" data-ve-avatar="ad">'
     +   '<span class="mf-ico mf-ico-edit" aria-hidden="true"></span>' + (ad ? 'Adı değiştir' : 'Adını gir') + '</div>';
  h += '<div class="ve-context-item" role="menuitem" tabindex="-1" data-ve-avatar="ayarlar">'
     +   '<span class="mf-ico mf-ico-settings" aria-hidden="true"></span>Ayarlar</div>';
  h += '<div class="ve-context-item" role="menuitem" tabindex="-1" data-ve-avatar="durum">'
     +   '<span class="mf-ico mf-ico-activity" aria-hidden="true"></span>Program durumu' + kunye + '</div>';
  h += '<div class="ve-context-divider"></div>';
  h += '<div class="ve-context-item ve-context-danger" role="menuitem" tabindex="-1" data-ve-avatar="cikis">'
     +   '<span class="mf-ico mf-ico-log-out" aria-hidden="true"></span>Çıkış yap</div>';
  return h;
}

// Sağa yaslı, avatarın 6 px altında; ekrandan TAŞMAZ.
function _veAvatarMenuKonum(btn, m) {
  var r = btn.getBoundingClientRect();
  var w = m.offsetWidth || 248;
  var sol = Math.round(r.right - w);
  m.style.top = Math.round(r.bottom + 6) + 'px';
  m.style.left = Math.max(8, Math.min(sol, window.innerWidth - w - 8)) + 'px';
}

function _veAvatarOgeler() {
  return _veAvatarMenu ? [].slice.call(_veAvatarMenu.querySelectorAll('[data-ve-avatar]')) : [];
}

// Yerinde ad alanı: başlığın YERİNİ alır (menüden çıkılmaz).
function _veAvatarAdAc() {
  if(!_veAvatarMenu) return;
  var bas = _veAvatarMenu.querySelector('.ve-avatar-menu-bas');
  var alan = _veAvatarMenu.querySelector('.ve-avatar-menu-ad');
  if(!bas || !alan) return;
  bas.hidden = true; alan.hidden = false;
  var inp = alan.querySelector('input');
  if(inp) { inp.focus(); inp.select(); }
}
function _veAvatarAdKapat(kaydet) {
  if(!_veAvatarMenu) return;
  var alan = _veAvatarMenu.querySelector('.ve-avatar-menu-ad');
  if(kaydet && alan) {
    var inp = alan.querySelector('input');
    veKimlikAdYaz(inp ? inp.value : '');
    if(typeof veSettingsShowSection === 'function'
       && document.getElementById('ve-set-kimlik-ad')) veSettingsShowSection('appearance');
  }
  // İçi yeniden kurulur: başlık yeni adı, eylem "Adı değiştir"i göstersin.
  _veAvatarMenu.innerHTML = _veAvatarMenuHTML();
  var ilk = _veAvatarOgeler()[0];
  if(ilk) ilk.focus();
}

function veAvatarMenuAc() {
  if(_veAvatarMenu) { veAvatarMenuKapat(); return; }
  var btn = document.getElementById('ve-bant-avatar');
  if(!btn) return;

  var m = document.createElement('div');
  m.className = 've-context-menu ve-avatar-menu';
  m.setAttribute('role', 'menu');
  m.setAttribute('aria-label', 'Hesap menüsü');
  m.innerHTML = _veAvatarMenuHTML();
  document.body.appendChild(m);
  _veAvatarMenu = m;
  _veAvatarMenuKonum(btn, m);
  btn.setAttribute('aria-expanded', 'true');

  m.addEventListener('click', function(e) {
    var it = e.target.closest('[data-ve-avatar]');
    if(!it) return;
    var is = it.getAttribute('data-ve-avatar');
    if(is === 'ad') { _veAvatarAdAc(); return; }                       // menü AÇIK kalır
    veAvatarMenuKapat();
    if(is === 'ayarlar' && typeof veOpenSettings === 'function') veOpenSettings();
    else if(is === 'durum' && typeof veOpenStatusModal === 'function') veOpenStatusModal();
    else if(is === 'cikis' && typeof mfsimLogout === 'function') mfsimLogout();
  });
  m.addEventListener('submit', function(e) { e.preventDefault(); _veAvatarAdKapat(true); });
  // Menü klavyeyle gezilir: ↑/↓ öğeler arasında, Enter/Boşluk seçer.
  m.addEventListener('keydown', function(e) {
    if(e.target.tagName === 'INPUT') return;
    var ogeler = _veAvatarOgeler();
    var i = ogeler.indexOf(document.activeElement);
    if(e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      var n = ogeler.length;
      var j = e.key === 'ArrowDown' ? (i + 1) % n : (i - 1 + n) % n;
      if(ogeler[j]) ogeler[j].focus();
    } else if((e.key === 'Enter' || e.key === ' ') && i >= 0) {
      e.preventDefault();
      ogeler[i].click();
    }
  });
  setTimeout(function() {
    document.addEventListener('mousedown', _veAvatarDisTik, true);
    document.addEventListener('keydown', _veAvatarEsc, true);
  }, 0);
}

// AÇILIŞTA AVATAR TAZELENİR. Eskiden yalnız ad YAZILDIĞI anda çağrılıyordu:
// ad tarayıcıda saklı olduğu hâlde sayfa yeniden açılınca avatar boş dairede
// kalıyordu — kayıtlı kimlik, bandın gösterdiğiyle sessizce ayrışıyordu.
if(typeof document !== 'undefined') {
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', veAvatarYaz);
  else veAvatarYaz();
}

function _veKimlikEsc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
                  .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

if(typeof module !== 'undefined' && module.exports) {
  module.exports = { veKimlikBasHarf: veKimlikBasHarf };
}
