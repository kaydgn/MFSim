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
// Projede zaten bir menü dili var (`.ve-context-menu` + `.ve-menu-item`);
// ikinci bir açılır pencere biçimi kurmak aynı şeyi iki yerde tutmaktı.
var _veAvatarMenu = null;

function veAvatarMenuKapat() {
  if(_veAvatarMenu && _veAvatarMenu.parentNode) _veAvatarMenu.parentNode.removeChild(_veAvatarMenu);
  _veAvatarMenu = null;
  document.removeEventListener('mousedown', _veAvatarDisTik, true);
  document.removeEventListener('keydown', _veAvatarEsc, true);
}
function _veAvatarDisTik(e) {
  if(_veAvatarMenu && !_veAvatarMenu.contains(e.target)
     && e.target.id !== 've-bant-avatar') veAvatarMenuKapat();
}
function _veAvatarEsc(e) { if(e.key === 'Escape') veAvatarMenuKapat(); }

function veAvatarMenuAc() {
  if(_veAvatarMenu) { veAvatarMenuKapat(); return; }
  var btn = document.getElementById('ve-bant-avatar');
  if(!btn) return;
  var ad = veKimlikAd();

  var m = document.createElement('div');
  m.className = 've-context-menu ve-avatar-menu';
  var h = '';
  h += '<div class="ve-avatar-menu-bas">'
     + (ad ? '<b>' + _veKimlikEsc(ad) + '</b>' : '<b class="bos">Ad girilmedi</b>')
     + '<span>Bu tarayıcıda saklanır</span></div>';
  h += '<div class="ve-menu-divider"></div>';
  h += '<div class="ve-menu-item" data-ve-avatar="ad">'
     + (ad ? 'Adı değiştir' : 'Adını gir') + '</div>';
  h += '<div class="ve-menu-item" data-ve-avatar="ayarlar">Ayarlar</div>';
  h += '<div class="ve-menu-item" data-ve-avatar="durum">Program durumu</div>';
  h += '<div class="ve-menu-divider"></div>';
  h += '<div class="ve-menu-item ve-menu-danger" data-ve-avatar="cikis">Çıkış yap</div>';
  m.innerHTML = h;

  var r = btn.getBoundingClientRect();
  m.style.position = 'fixed';
  m.style.top = Math.round(r.bottom + 6) + 'px';
  m.style.right = Math.round(window.innerWidth - r.right) + 'px';
  m.style.left = 'auto';
  document.body.appendChild(m);
  _veAvatarMenu = m;

  m.addEventListener('click', function(e) {
    var it = e.target.closest('[data-ve-avatar]');
    if(!it) return;
    var is = it.getAttribute('data-ve-avatar');
    veAvatarMenuKapat();
    if(is === 'ad') veKimlikSor();
    else if(is === 'ayarlar' && typeof veOpenSettings === 'function') veOpenSettings();
    else if(is === 'durum' && typeof veOpenStatusModal === 'function') veOpenStatusModal();
    else if(is === 'cikis' && typeof mfsimLogout === 'function') mfsimLogout();
  });
  setTimeout(function() {
    document.addEventListener('mousedown', _veAvatarDisTik, true);
    document.addEventListener('keydown', _veAvatarEsc, true);
  }, 0);
}

// Adı sor. `prompt` bilerek: tek alanlık bir soru için modal kurmak, kapatma
// ve odak tuzağı dahil bir pencere sözleşmesi getirir — Ayarlar'daki alan
// zaten kalıcı yüzey, bu yalnız kısayol.
function veKimlikSor() {
  var mevcut = veKimlikAd();
  var yeni = window.prompt('Adın (avatarda baş harfleri görünür):', mevcut);
  if(yeni === null) return;                     // vazgeçildi — mevcut korunur
  veKimlikAdYaz(yeni);
  if(typeof veSettingsShowSection === 'function'
     && document.getElementById('ve-settings-content')) veSettingsShowSection('appearance');
}

function _veKimlikEsc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
                  .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

if(typeof module !== 'undefined' && module.exports) {
  module.exports = { veKimlikBasHarf: veKimlikBasHarf };
}
