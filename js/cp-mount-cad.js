// ============================================================================
//  TAKOZ — 3D GÖRÜNTÜLEYİCİ: CAD'İN EVİ (2026-10-20, Takoz adım 4)
// ============================================================================
// Yer tutucu kalktı (kullanıcı kararı 2026-10-16: "Klasik 3B ilerleyen
// zamanda gerçek CAD dosyasıyla işlenecek"). Pencere modülün STEP OTURUMUNU
// gösterir — sihirbazın "STEP'ten başla" kartıyla AYNI oturum
// (js/cp-mount-wizard.js → _mwStp): dosya burada da orada da açılır, rol
// birinde verilince ötekinde görünür, 3B görüntüleyici aynıdır
// (js/cp-mount-3b.js; buradan açılınca kendi perdesinde). Bölümlerin içeriği
// kartın üreticileridir (_mwStpKunyeHTML · _mwStpAgacHTML · _mwStpHesapHTML ·
// _mwStpKutleHTML); pencere onları kitin bölümlerine koyar ve TEK eylemi sağ
// sütunun eylem satırındadır: dosya yokken "STEP dosyası seç…", okunurken ya
// da hesap ağı beklerken çubuk + Vazgeç, dosya hazırken "3B'de aç".
//
// ROLLER PROJEYLE, DOSYA DEĞİL: bileşenin verisi `data.cad` rol verilen
// düğümlerin örnek yolunu, rolünü ve kütlesini taşır (js/mount-step.js →
// veMntStpRolKaydi; oturum her değişimde yazar). Dosya açık değilken pencere
// kaydı "Kayıtlı roller" föyünde gösterir; aynı dosya okununca roller yoldan
// geri gelir. Tip tek kopya (`maxInstances: 1`): modülün CAD'i tek.
//
// SONUÇ GÖSTERMEZ (Takoz kuralı): konumlar ve hacimler CAD'den ÖLÇÜLEN
// girdilerdir; sehim, yük, mod yok — pencere çözümden bağımsız.
// ============================================================================

function _mntCadEsc(s){
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function _mntCadIkon(ad){ return (typeof veIkon === 'function') ? veIkon(ad) : ''; }
function _mntCadAd(tip){ return ((typeof componentDefs !== 'undefined' && componentDefs[tip]) || {}).name || tip; }
// Bu modülün STEP oturumu (yoksa null)
function _mntCadOturum(){ return (typeof veMntWizStpBurada === 'function') ? veMntWizStpBurada() : null; }

// ── DOSYA SEÇİCİ VE BIRAKMA ALANI ─────────────────────────────────────────
// Seçici bir DÜĞME: tıklanınca anlık bir dosya girdisi kurulur (projeyi
// açmanın kalıbı, js/toolbar.js → veLoadTopology) — pencerede gizli girdi
// durmaz (1 px'lik gizli girdi pencere ölçücüsünde okunmaz bir alandı).
// `sinif` birincil eylemde `.ve-fp-solve`, bölümde `.ve-fw-btn`.
var VE_MNT_CAD_UZANTI = '.stp,.step,.stpz,.p21';
function _mntCadSecici(sinif, metin, ikon, id){
  return '<button type="button" class="' + sinif + '" id="' + id + '" onclick="veMntCadSec()"'
    + ' title=".stp · .step · .stpZ (AP214 / AP242)">' + (ikon ? _mntCadIkon(ikon) + ' ' : '') + metin + '</button>';
}
function veMntCadSec(){
  if(typeof document === 'undefined' || typeof veMntWizStpDosya !== 'function') return false;
  var g = document.createElement('input');
  g.type = 'file';
  g.accept = VE_MNT_CAD_UZANTI;
  g.addEventListener('change', function(){
    var f = g.files && g.files[0];
    if(f) veMntWizStpDosya(f, 'pencere');
  });
  g.click();
  return true;
}
function veMntCadDrop(e){
  if(!e) return false;
  if(e.preventDefault) e.preventDefault();
  var el = e.currentTarget;
  if(el && el.classList){ el.setAttribute('data-surukle', '0'); el.classList.remove('ve-fw-stp-on'); }
  var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
  if(!f || typeof veMntWizStpDosya !== 'function') return false;
  veMntWizStpDosya(f, 'pencere');
  return true;
}
function _mntCadBirakmaAc(){
  return '<div class="ve-fw-stp ve-mnt-cad-alan" data-ve-dropzone="step"'
    + ' ondragenter="veMntWizStpSurukle(this, true)" ondragleave="veMntWizStpSurukle(this, false)"'
    + ' ondragover="event.preventDefault()" ondrop="veMntCadDrop(event)">';
}

// ── BÖLÜMLER ─────────────────────────────────────────────────────────────
// Kaydın künyesi (dosya açık değilken): dosya · parça · rol
function _mntCadKayitKunye(k){
  var bilgi = [k.parca ? veSayi(k.parca, 0) + ' parça' : '', veSayi(k.roller.length, 0) + ' rol',
               k.bayt > 0 ? veSayi(k.bayt / 1048576, k.bayt < 10485760 ? 1 : 0) + ' MB' : ''].filter(Boolean).join(' · ');
  return '<div class="ve-fw-seeded" data-mnt-cad-kayit="1">' + _mntCadIkon('file-text') + ' <b>'
    + _mntCadEsc(k.dosya || 'STEP') + '</b> <em>' + _mntCadEsc(bilgi) + '</em></div>';
}
function _mntCadDosyaHTML(s, k){
  var h = _mntCadBirakmaAc();
  if(!s){
    if(k && k.roller.length) h += _mntCadKayitKunye(k);
    h += '<p class="ve-fw-dim ve-fw-stp-yon">' + (k && k.roller.length
      ? veYon('Rollerin STEP dosyasını seçin ya da buraya bırakın.')
      : veYon('STEP dosyasını seçin ya da buraya bırakın.')) + '</p>';
    return h + '</div>';
  }
  if(s.durum === 'okunuyor')
    return h + '<div class="ve-fw-seeded ve-fw-stp-wait">' + _mntCadIkon('clock') + ' <b>' + _mntCadEsc(s.dosya) + '</b> okunuyor…</div></div>';
  if(s.durum === 'hata')
    return h + '<div class="ve-fw-issues"><div class="ve-fw-issue ve-fw-issue-err">' + _mntCadIkon('x') + ' <b>'
      + _mntCadEsc(s.dosya) + '</b> — ' + _mntCadEsc(s.hata) + '</div></div></div>';
  h += _mwStpKunyeHTML(s)
    + '<div class="ve-fw-rowbtns">' + _mntCadSecici('ve-fw-btn', 'Başka dosya seç…', '', 've-mnt-cad-baska')
    + '<button type="button" class="ve-fw-mini" title="Dosyayı kaldır" aria-label="Dosyayı kaldır"'
    + ' onclick="veMntWizStpKapat()">' + _mntCadIkon('x') + '</button></div>';
  return h + '</div>';
}
// Kayıtlı roller — dosya açık değilken: parça, rolü, kütlesi
function _mntCadKayitHTML(k){
  var t = _mntFoyAc([{ b:'Parça', gen:'50%' }, { b:'Rol', gen:'32%', sinif:'sol' }, { b:'Kütle <u>[kg]</u>', gen:'18%' }], 'Kayıtlı roller', 've-mnt-cad-kayit');
  k.roller.forEach(function(r){
    var yol = Array.isArray(r.yol) ? r.yol.join(' › ') : '';
    t += '<tr><td title="' + _mntCadEsc(yol) + '">' + _mntCadEsc(r.ad || (r.yol && r.yol[r.yol.length - 1]) || '—') + '</td>'
      + '<td class="sol">' + _mntCadEsc(_mntCadAd(r.rol)) + '</td>'
      + '<td>' + (+r.kg > 0 ? veSayi(+r.kg, 1) : '—') + '</td></tr>';
  });
  return t + _MNT_FOY_KAPA;
}
// EYLEM SATIRI — pencerenin TEK eylemi, oturumun durumuna göre
function _mntCadEylem(s){
  if(typeof vePencereEylem !== 'function') return '';
  if(s && s.durum === 'okunuyor') return _mwStpIlerlemeHTML(s, 've-mnt-cad-vazgec');
  if(s && s.durum === 'hazir' && s.hesapBekliyor)
    return vePencereEylem('<button type="button" class="ve-fp-solve" data-durdur data-mw-stp-hesap-vazgec id="ve-mnt-cad-hesap-vazgec"'
      + ' onclick="veMntWizStpHesapVazgec()">' + _mntCadIkon('x') + ' Vazgeç</button>', '', _mwStpHesapVeri(s));
  if(s && s.durum === 'hazir')
    return vePencereEylem('<button type="button" class="ve-fp-solve" id="ve-mnt-cad-3b" onclick="veMntCad3bAc()">'
      + _mntCadIkon('box') + ' 3B\'de aç</button>');
  return vePencereEylem(_mntCadSecici('ve-fp-solve', 'STEP dosyası seç…', 'folder-open', 've-mnt-cad-sec'));
}

// ── PENCERE ──────────────────────────────────────────────────────────────
function getMntViewerPropertiesHTML(node){
  if(!node.data) node.data = {};
  var s = _mntCadOturum();
  var k = (node.data.cad && Array.isArray(node.data.cad.roller)) ? node.data.cad : null;
  var kat = [{ k:'dosya', ad:'STEP dosyası', govde:_mntBolum('STEP dosyası', '', _mntCadDosyaHTML(s, k)) }];
  if(s && s.durum === 'hazir'){
    var rollu = s.roller.filter(function(r){ return !!r; }).length;
    var d = (typeof veMntWizStpDenetim === 'function') ? veMntWizStpDenetim(s) : { engel:[], uyari:[] };
    kat.push({ k:'parca', ad:'Parçalar', govde:_mntBolum('Parçalar', veSayi(rollu, 0) + ' rol',
      _mwStpAgacHTML(s) + _mwStpHesapHTML(s, true) + _mwStpSorunHTML(d)) });
    if(s.coz && s.coz.ok) kat.push({ k:'kutle', ad:'Kütle', govde:_mntBolum('Kütle', '', _mwStpKutleHTML(s)) });
  } else if(k && k.roller.length){
    kat.push({ k:'kayit', ad:'Kayıtlı roller', govde:_mntBolum('Kayıtlı roller', veSayi(k.roller.length, 0) + ' rol', _mntCadKayitHTML(k)) });
  }
  return _mntPencereKabuk(node, kat, _mntCadEylem(s));
}

// Pencere bu modülün 3D Görüntüleyici'sini mi gösteriyor
function veMntCadPencereAcik(){
  if(typeof veMufettisAcik !== 'function' || !veMufettisAcik() || typeof veMufettisKonusu !== 'function') return false;
  var k = veMufettisKonusu();
  return !!(k && k.type === 'mnt-viewer');
}
// Oturum değişince (js/cp-mount-wizard.js → _mwStpTazele): aynı bileşen
// yeniden kurulur — kaydırma yerinde kalır (showNodeProperties)
function veMntCadPencereTazele(){
  if(!veMntCadPencereAcik() || typeof showNodeProperties !== 'function') return false;
  showNodeProperties(veMufettisKonusu());
  return true;
}
function veMntCad3bAc(){
  return (typeof veMntWiz3bAc === 'function') ? veMntWiz3bAc('pencere') : false;
}

if(typeof module !== 'undefined' && module.exports){
  module.exports = {
    getMntViewerPropertiesHTML: getMntViewerPropertiesHTML, veMntCadPencereAcik: veMntCadPencereAcik,
    veMntCadPencereTazele: veMntCadPencereTazele, veMntCad3bAc: veMntCad3bAc, veMntCadDrop: veMntCadDrop,
    veMntCadSec: veMntCadSec, VE_MNT_CAD_UZANTI: VE_MNT_CAD_UZANTI,
    _mntCadKayitHTML: _mntCadKayitHTML, _mntCadEylem: _mntCadEylem, _mntCadDosyaHTML: _mntCadDosyaHTML
  };
}
