// ============================================================================
//  TAKOZ SİHİRBAZI — STEP'İN 3B GÖRÜNTÜLEYİCİSİ
// ============================================================================
// Kullanıcı isteği (2026-10-14): Takoz'a "STEP dosyadan başlama" — FEAD'in
// akışının aynısı: STEP'in tamamı okunur → parçalar 3B'de ELLE seçilir ("neyin
// ne olduğunu": motor, şanzıman, braket, takoz…) → bir düğmeyle gövdelerin
// ağırlık merkezleri ve takozların konumları çıkar.
//   · parça başına bir ağ (js/step-ucgen.js), role göre renk
//   · tıklanan parça seçilir; kartta yolu (kök › alt montaj › parça). Rol bir
//     ALT MONTAJA da verilir: yolda üst düğüme tıklanır (motor çoğu zaman blok
//     · kafa · karter diye ayrı parçalarla gelir)
//   · "Konumları hesapla" kartın AYNI işlevidir (veMntWizStpHesapla); sonuç
//     3B'de işaret + etiket, kartta ağırlık merkezi ve konum tablosu olarak
//
// BÜYÜK MONTAJ (2026-10-20, Takoz adım 3 — 420 MB'lık deneme montajı ölçüldü):
//   · Ağları sihirbazın ORTAK İŞİ üretir (veMntWizStpAgTum · js/mount-step.js →
//     veMntStpAgIs): bağlam parça başına bırakılır — yığının tepesi 3,2 GB'tı.
//   · Montaj kurulurken GÖRÜNÜR: biten parça çizime eklenir; kamera kullanıcı
//     dokunana dek büyüyen montaja sığar (yalnız ilk parçaya sığdırmak modeli
//     ekrana yapıştırıyordu — FEAD'de ölçüldü). Sol üstte çubuk ve Durdur ·
//     Devam; durdurulan montajın kalanı, hesabın istediği parçalar dışında,
//     üretilmez.
//   · ÇİZİM KÜMELERDE: parçalar birkaç büyük ağa (VE_MW_3B_KUME) eklenir; rol
//     rengi köşe renginde, seçim · fare · soluk köşe durumunda (gölgelendirici
//     eki). Parça başına iki nesne 23.388 çizim çağrısıydı ve döndürmenin her
//     karesi 190 ms sürüyordu. Parçanın ağı (s.ag) kümenin dizilerine bakan
//     bir görünümdür — veri iki kez tutulmaz.
//   · Fareyle seçim önce parçaların KUTUSUNDAN süzülür, sonra üçgenlere bakılır.
//
// DURUM KARTLA ORTAK (_mwStp, veMntWizStp() ile okunur): rol ve kütle burada
// da kartta da aynı nesneye yazılır. Tazeleme veMntWizRender'ın sonundan
// geçer — pencerenin ayrı bir kopyası olsaydı kartla sessizce ayrışırdı.
//
// GÖRÜNÜM FEAD'İN 3B PENCERESİNİN (`.ve-fw-3b*`, js/cp-fead-3b.js): tuval
// önde, sağda yüzen kart, altta rol dizisi. Takoz'a özgü olan yalnız roller,
// renkleri ve sonucun biçimi (halka değil nokta). İKİ YERİ VAR (VE_MW_3B_YER):
// sihirbazın İÇİNDE bir kaplama (#ve-mw-3b; sihirbaz kapanınca o da gider) ve
// 3D Görüntüleyici penceresinden açılınca kendi perdesi (#ve-mnt-3b-overlay,
// 2026-10-20, Takoz adım 4). Görüntüleyici tek: biri açılınca öteki kapanır,
// WebGL bağlamı bırakılır. "Sihirbaza aktar" yalnız sihirbazın içinde.
// THREE yoksa (Node testi) açılmaz. Çizim İSTEK ÜZERİNE, sürekli döngü yok.
//
// TAKOZ NOKTASI (2026-10-20, Takoz adım 5): takoz seçiliyken "Daireden nokta"
// kipinde fare dairesel kenarın üstüne gelince halka çizilir, tıklayınca
// takozun noktası o dairenin MERKEZİ olur — CATIA'daki ölçümün aynısı. Merkez
// ağdan değil dosyadan (js/mount-step.js → veMntStpKenarDaire): ağ yalnız hangi
// kenarın tıklandığını söyler (`daire` dizini, js/step-ucgen.js). Aday kenar
// ekranda farenin VE_MW_3B_DAIRE.px yakınında ve tıklanan yüzün arkasında
// değil. Hesaptan sonra her takozun dairesi halka olarak çizilir (öneri de
// seçilen de).
// ============================================================================

var _mw3b = null;

// Rol → tema jetonu. TEK KAYNAK: 3B malzeme de karttaki renk noktası da buradan.
// Takoz yeşil (Görünümler'in takoz işaretinin rengi), motor vurgu.
var VE_MW_3B_ROL_RENK = {
  'mnt-motor': '--accent-primary', 'mnt-gearbox': '--seri-1', 'mnt-transfer': '--seri-2',
  'mnt-bracket': '--seri-3', 'mnt-mount': '--accent-success', 'mnt-shaft': '--seri-4',
  'mnt-pto': '--accent-warning', 'mnt-pump': '--accent-danger', 'mnt-pto-group': '--ink-accent'
};
// Sığdırmanın dizi için ayırdığı en az pay (px) — FEAD'inkiyle aynı gerekçe
var VE_MW_3B_ALT_PAY = 124;
// Açılışta hazır ağları çizime ekleyen dilimin bütçesi (ms)
var VE_MW_3B_BUTCE = 10;
// AÇILIŞ BAKIŞI: önden-sağdan-yukarıdan (araç ekseni: x arkaya, y sağa, z yukarı)
var VE_MW_3B_ACILIS = { theta: 0.75 * Math.PI, phi: 0.42, doluluk: 0.8 };
// ÇİZİM KÜMESİ: köşe ve çizgi köşesi kapasitesi; daha büyük parça kendi kümesini alır
var VE_MW_3B_KUME = { uc: 1 << 20, ucgen: 1 << 21, cizgi: 1 << 20 };
// Kurulum sürerken kare aralığı: en az VE_MW_3B_KURULUM_KARE ms, ve karenin
// kendi süresinin (çizim + sunum, ana iş parçacığında ölçülür) KARE_PAY katı —
// çizim zamanın en çok onda birini alır. Ekran kartı olmayan makinede kare
// montajla büyüyor (ölçüldü: 420 MB'lık montajda 8 sn'ye) ve sık çizim üretimi
// aç bırakıyordu. Kullanıcının hamlesi beklemez; sığdırma en sık
// VE_MW_3B_SIGDIR_ARA'da bir.
var VE_MW_3B_KURULUM_KARE = 200, VE_MW_3B_KARE_PAY = 9, VE_MW_3B_SIGDIR_ARA = 500;
// Köşe durumu bitleri (gölgelendirici eki aynı değerleri okur)
var VE_MW_3B_SOLUK = 1, VE_MW_3B_SECIK = 2, VE_MW_3B_FARE = 4;
// Çizgi saydamlığı (0–255): olağan · soluk
var VE_MW_3B_CIZGI_A = [82, 15];
// Daireden nokta: farenin kenara en büyük uzaklığı (px), bakılan en çok parça,
// kenarın tıklanan yüzün arkasında sayılmadığı derinlik payı (mm)
var VE_MW_3B_DAIRE = { px: 10, aday: 40, derinlik: 1 };
// Hesap noktalarının ekrandaki yarıçapı (px): takoz · gövde
var VE_MW_3B_ISARET = { takoz: 6, govde: 8 };

// ── 1 · SAF YARDIMCILAR (testli) ──────────────────────────────────────────
// Parçanın birimi: rollü ata (parçanın kendisi dâhil) — yoksa -1.
function veMntWiz3bBirim(s, parca){
  if(!s || !s.sonuc || !s.sonuc.parcalar[parca]) return -1;
  for(var a = s.sonuc.parcalar[parca].dugum; a >= 0; a = s.sonuc.agac[a].ebeveyn) if(s.roller[a]) return a;
  return -1;
}
function veMntWiz3bYol(s, dugum){
  var yol = [];
  for(var a = dugum; a >= 0; a = s.sonuc.agac[a].ebeveyn) yol.unshift(a);
  return yol;
}
function veMntWiz3bParcalar(s, dugum){
  var d = s && s.sonuc && s.sonuc.agac[dugum];
  return d ? d.parcalar.slice() : [];
}
function veMntWiz3bRolJeton(tip){ return VE_MW_3B_ROL_RENK[tip] || '--text-muted'; }
function _mw3bRenkNokta(tip){
  return '<span class="ve-fw-3b-renk" style="--renk:var(' + veMntWiz3bRolJeton(tip) + ')"></span>';
}
// Seçili düğümün birimi: düğüm ya da en yakın rollü atası
function _mw3bSeciliBirim(s, secili){
  if(!s || !s.sonuc || !(secili >= 0)) return -1;
  for(var d = secili; d >= 0; d = s.sonuc.agac[d].ebeveyn) if(s.roller[d]) return d;
  return -1;
}

// ── 2 · AÇ / KAPAT ────────────────────────────────────────────────────────
// Yer → kap (görüntüleyicinin kurulduğu öğe) ve perde (pencerenin kendisi ise)
var VE_MW_3B_YER = { sihirbaz: { kap: 've-mw-3b', perde: null }, pencere: { kap: 've-mnt-3b', perde: 've-mnt-3b-overlay' } };
function veMntWiz3bAcik(){ return !!_mw3b; }
function veMntWiz3bYer(){ return _mw3b ? _mw3b.yer : null; }
// `yer`: 'sihirbaz' | 'pencere' — verilmezse sihirbaz açıksa sihirbaz
function veMntWiz3bAc(yer){
  if(typeof document === 'undefined' || typeof THREE === 'undefined') return false;
  var s = typeof veMntWizStp === 'function' ? veMntWizStp() : null;
  if(!s || s.durum !== 'hazir' || !s.sonuc || !s.sonuc._model) return false;
  if(!VE_MW_3B_YER[yer]) yer = (typeof veMntWizAcik === 'function' && veMntWizAcik()) ? 'sihirbaz' : 'pencere';
  var Y = VE_MW_3B_YER[yer], ov = document.getElementById(Y.kap), perde = Y.perde ? document.getElementById(Y.perde) : null;
  if(!ov || (Y.perde && !perde)) return false;
  if(_mw3b) veMntWiz3bKapat();
  if(perde) perde.style.display = 'flex';
  ov.style.display = 'flex';
  if(yer === 'sihirbaz') _mw3bGenis(true);
  ov.innerHTML = '<div class="ve-settings-header ve-fw-3b-bas">'
    + '<span><span class="mf-ico mf-ico-box"></span> 3B görüntüleyici <span class="ve-fw-dim" id="ve-mw-3b-dosya"></span></span>'
    + '<button type="button" class="ve-fw-mini ve-fw-3b-metin" onclick="veMntWiz3bSigdir()" title="Bütün montajı sığdır">Sığdır</button>'
    + '<button type="button" class="ve-settings-close" onclick="veMntWiz3bKapat()" title="Kapat (Esc)" aria-label="Kapat">'
      + '<span class="mf-ico mf-ico-x"></span></button>'
    + '</div><div class="ve-fw-3b-govde">'
    + '<div class="ve-fw-3b-tuval" id="ve-mw-3b-tuval" data-durum="kuruluyor">'
      + '<svg class="ve-fw-3b-etiket-cizgi" id="ve-mw-3b-etiket-cizgi" aria-hidden="true"></svg>'
      + '<div class="ve-fw-3b-etiketler" id="ve-mw-3b-etiket"></div>'
      + '<div class="ve-mw-3b-kur" id="ve-mw-3b-kur" hidden></div>'
      + '<div class="ve-fw-3b-ipucu" id="ve-mw-3b-ipucu" hidden></div></div>'
    + '<aside class="ve-fw-3b-yan" id="ve-mw-3b-yan" aria-label="Gövdeler ve takozlar"></aside>'
    + '<div class="ve-fw-3b-alt" id="ve-mw-3b-alt"></div></div>';
  var kap = document.getElementById('ve-mw-3b-tuval');
  var V = { kap: kap, s: s, yer: yer, ov: ov, perde: perde, kume: [], ckume: [], parca: [], ekli: [], kutular: [], islenen: 0, yuz: 0, toplam: 0, yuzToplam: 0,
            sokucu: [], secili: -1, fare: -1, nokta: -1, aday: null, halka: null, cizIstek: 0, cizZaman: 0, sonCiz: 0, sonIl: 0, sonSig: 0, sigKutu: null,
            kutu: null, sonucGrubu: null, kuruluyor: true, durdu: false, eldegdi: false, solukVar: false, kareMs: 0 };
  var w = Math.max(1, kap.clientWidth), h = Math.max(1, kap.clientHeight);
  try {
    V.renderer = _mw3bCizici(V);
  } catch(e){
    kap.setAttribute('data-durum', 'hata');
    kap.insertAdjacentHTML('afterbegin', '<p class="ve-fw-3b-yok">3B çizim açılamadı (WebGL yok).</p>');
    _mw3b = V;
    _mw3bEsc(V);
    _mw3bPanel();
    return true;
  }
  V.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  V.renderer.setSize(w, h, false);
  kap.insertBefore(V.renderer.domElement, kap.firstChild);
  V.scene = new THREE.Scene();
  V.scene.background = _mw3bRenk('--bg-secondary', '#faf8f4');
  V.camera = new THREE.PerspectiveCamera(35, w / h, 0.5, 100000);
  V.camera.up.set(0, 0, 1);
  V.scene.add(new THREE.HemisphereLight(0xffffff, 0x807868, 0.75));
  V.isik = new THREE.DirectionalLight(0xffffff, 0.75);
  V.scene.add(V.isik); V.scene.add(V.isik.target);
  V.malzeme = { opak: _mw3bMalzeme(false), soluk: _mw3bMalzeme(true),
                cizgi: new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, color: _mw3bRenk('--text-primary', '#26241f') }) };
  V.grup = new THREE.Group();
  V.scene.add(V.grup);
  V.ctrl = { theta: VE_MW_3B_ACILIS.theta, phi: VE_MW_3B_ACILIS.phi, r: 1000, hedef: new THREE.Vector3() };
  V.ray = new THREE.Raycaster();
  _mw3b = V;
  _mw3bEsc(V);
  _mw3bDinle(V);
  if(typeof ResizeObserver !== 'undefined'){
    try { V.ro = new ResizeObserver(function(){ _mw3bBoyut(); }); V.ro.observe(kap); } catch(e2){}
  }
  var dosya = document.getElementById('ve-mw-3b-dosya');
  if(dosya) dosya.textContent = s.dosya + ' · ' + s.sonuc.parcalar.length + ' parça';
  _mw3bPanel();
  _mw3bAgKur();
  return true;
}
// ÇİZİCİ: ekran kartında kenar yumuşatmalı; yazılımsal GL'de (ekran kartı yok,
// uzak masaüstü) yumuşatmasız — orada kareyi 2,3–3,3 kat pahalılaştırıyordu
// (ölçüldü, 859 parçalık montaj). Yazılımsal olduğu çizicinin adından anlaşılır.
var VE_MW_3B_YAZILIM = /SwiftShader|llvmpipe|softpipe|Basic Render|Software/i;
function _mw3bYazilimMi(r){
  try {
    var gl = r.getContext(), ri = gl.getExtension('WEBGL_debug_renderer_info');
    return VE_MW_3B_YAZILIM.test(String(gl.getParameter(ri ? ri.UNMASKED_RENDERER_WEBGL : gl.RENDERER)));
  } catch(e){ return false; }
}
function _mw3bCizici(V){
  var r = new THREE.WebGLRenderer({ antialias: true });
  if(!_mw3bYazilimMi(r)) return r;
  V.yazilim = true;
  r.dispose();
  if(r.forceContextLoss) try { r.forceContextLoss(); } catch(e){}
  return new THREE.WebGLRenderer({ antialias: false });
}
function veMntWiz3bKapat(){
  var V = _mw3b;
  _mw3b = null;
  if(typeof document !== 'undefined'){
    var ov = V ? V.ov : document.getElementById('ve-mw-3b');
    if(ov){ ov.style.display = 'none'; ov.innerHTML = ''; }
    if(V && V.perde) V.perde.style.display = 'none';
    if(!V || V.yer === 'sihirbaz') _mw3bGenis(false);
  }
  if(!V) return;
  // Görüntüleyicinin montaj isteği düşer (hesabın isteği sürer); üretilen ağlar kalır
  if(typeof veMntWizStpAgTum === 'function' && typeof veMntWizStp === 'function' && veMntWizStp() === V.s) veMntWizStpAgTum(false);
  if(V.cizZaman) clearTimeout(V.cizZaman);
  if(V.cizIstek && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(V.cizIstek);
  V.sokucu.forEach(function(f){ try { f(); } catch(e){} });
  if(V.ro) try { V.ro.disconnect(); } catch(e3){}
  if(V.scene) V.scene.traverse(function(o){
    if(o.geometry) o.geometry.dispose();
    if(o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(function(m){ m.dispose(); });
  });
  if(V.renderer){ V.renderer.dispose(); if(V.renderer.forceContextLoss) try { V.renderer.forceContextLoss(); } catch(e4){} }
}
// KENDİ PERDESİNDE Esc görüntüleyiciyi kapatır — ve yalnız onu: yakalama
// evresinde durdurulur, altındaki bileşen penceresi açık kalır (sihirbazın
// içinde Esc'i sihirbazın dinleyicisi karşılar: veMntWizKey).
function _mw3bEsc(V){
  if(V.yer !== 'pencere' || typeof document === 'undefined') return;
  var f = function(e){
    if(e.key !== 'Escape' || _mw3b !== V) return;
    e.stopImmediatePropagation(); e.preventDefault();
    if(!veMntWiz3bNoktaBitir()) veMntWiz3bKapat();
  };
  document.addEventListener('keydown', f, true);
  V.sokucu.push(function(){ document.removeEventListener('keydown', f, true); });
}
// 3B AÇIKKEN PENCERE GENİŞLER — FEAD'in sınıfı (`.ve-fw-3b-genis`), ölçü CSS'te
function _mw3bGenis(acik){
  if(typeof document === 'undefined') return;
  var o = document.getElementById('ve-mntwiz-overlay');
  if(o && o.classList) o.classList.toggle('ve-fw-3b-genis', !!acik);
}
// Sihirbaz her çizildiğinde (veMntWizRender) — rol, hesap, kütle, aktarım
function veMntWiz3bTazele(){
  var V = _mw3b;
  if(!V) return;
  var s = typeof veMntWizStp === 'function' ? veMntWizStp() : null;
  // Dosya karttan kaldırıldı ya da başka bir dosya okundu: pencere o dosyanındı
  if(!s || s !== V.s || s.durum !== 'hazir'){ veMntWiz3bKapat(); return; }
  if(V.secili >= s.sonuc.agac.length) V.secili = -1;
  if(V.nokta >= 0 && s.roller[V.nokta] !== 'mnt-mount') _mw3bNoktaKip(-1);
  _mw3bPanel();
  if(!V.scene) return;
  _mw3bBoya();
  _mw3bSonucKur();
  _mw3bCiz(true);
}

// ── 3 · AĞLAR VE KURULUM ──────────────────────────────────────────────────
// Ağları ortak iş üretir (veMntWizStpAgTum); gelen parça veMntWiz3bParca ile
// çizime eklenir. Açılışta hazır ağlar (önceki açılış · hesap) dilim dilim
// eklenir, sonra iş kalanını üretir.
function _mw3bAgKur(){
  var V = _mw3b, s = V.s, geo = s.sonuc._geo || [], hazir = [];
  geo.forEach(function(g, i){
    if(!g || !g.yuzler || !g.yuzler.length) return;
    V.toplam++; V.yuzToplam += g.yuzler.length;
    if(s.ag[i]) hazir.push(i);
  });
  var k = 0;
  // İlk dilim de ayrı görevde: açılışın görevi (bağlam, sahne, panel) ile tek
  // görevde 50 ms'yi aşıyordu (ölçüldü).
  _mwSonraki(function ekle(){
    if(_mw3b !== V) return;
    var bitis = _mwSimdi() + VE_MW_3B_BUTCE;
    while(k < hazir.length && _mwSimdi() < bitis) _mw3bParcaEkle(hazir[k++]);
    if(k < hazir.length){ veMntWiz3bIlerle(false); _mwSonraki(ekle); return; }
    if(!V.durdu && typeof veMntWizStpAgTum === 'function') veMntWizStpAgTum(true);
    veMntWiz3bIlerle(false);
  });
}
// Ortak işin bildirimi: parça i'nin ağı üretildi
function veMntWiz3bParca(i){
  var V = _mw3b;
  if(!V || !V.scene || typeof veMntWizStp !== 'function' || veMntWizStp() !== V.s) return;
  _mw3bParcaEkle(i);
}
// Ortak işin her diliminden sonra (bos: iş boşaldı) — çubuk, sığdırma, kare
function veMntWiz3bIlerle(bos){
  var V = _mw3b;
  if(!V || !V.scene) return;
  if(V.islenen >= V.toplam){ if(V.kuruluyor || V.durdu) _mw3bBitti(); return; }
  var t = _mwSimdi();
  if(bos || t - V.sonIl >= 100){ V.sonIl = t; _mw3bKurYaz(); }
  _mw3bOtoSigdir();
  _mw3bCiz();
}
function _mw3bBitti(){
  var V = _mw3b;
  V.kuruluyor = false; V.durdu = false;
  V.kap.setAttribute('data-durum', 'hazir');
  _mw3bKurYaz();
  if(!V.eldegdi) _mw3bSigdir(V.kutu, _mw3bOrnekNoktalar());
  _mw3bSonucKur();
  _mw3bCiz(true);
}
// DURDUR: görüntüleyicinin isteği düşer; çizilen kısım kalır, seçilir, hesaplanır
function veMntWiz3bDurdur(){
  var V = _mw3b;
  if(!V || !V.scene || !V.kuruluyor) return false;
  V.kuruluyor = false; V.durdu = true;
  if(typeof veMntWizStpAgTum === 'function') veMntWizStpAgTum(false);
  V.kap.setAttribute('data-durum', 'durdu');
  _mw3bKurYaz();
  if(!V.eldegdi && V.kutu) _mw3bSigdir(V.kutu, _mw3bOrnekNoktalar());
  _mw3bCiz(true);
  return true;
}
function veMntWiz3bDevam(){
  var V = _mw3b;
  if(!V || !V.scene || !V.durdu) return false;
  V.durdu = false; V.kuruluyor = true;
  V.kap.setAttribute('data-durum', 'kuruluyor');
  _mw3bKurYaz();
  if(typeof veMntWizStpAgTum === 'function') veMntWizStpAgTum(true);
  return true;
}
// Kurulumun kutusu (tuvalin sol üstü): çubuk + Durdur, durunca durum + Devam
function _mw3bKurVeri(V){
  return { ad: '3B kurulumu', metin: 'Parça ' + veSayi(V.islenen, 0) + ' / ' + veSayi(V.toplam, 0),
           oran: V.yuzToplam ? V.yuz / V.yuzToplam : 0 };
}
function _mw3bKurYaz(){
  var V = _mw3b, el = typeof document !== 'undefined' && document.getElementById('ve-mw-3b-kur');
  if(!V || !el) return;
  if(!V.kuruluyor && !V.durdu){ el.innerHTML = ''; el.hidden = true; return; }
  el.hidden = false;
  if(V.durdu){
    var not = 'Durduruldu · ' + veSayi(V.islenen, 0) + ' / ' + veSayi(V.toplam, 0) + ' parça';
    var n = document.getElementById('ve-mw-3b-kur-not');
    if(n && document.getElementById('ve-mw-3b-devam')){ if(n.textContent !== not) n.textContent = not; return; }
    el.innerHTML = vePencereEylem('<button type="button" class="ve-fp-solve" id="ve-mw-3b-devam" onclick="veMntWiz3bDevam()">'
      + _mwIkon('play') + ' Devam</button>', '<span class="ve-fp-durum-not" id="ve-mw-3b-kur-not">' + _mwEsc(not) + '</span>');
    return;
  }
  if(document.getElementById('ve-mw-3b-durdur')){ vePencereIlerleme('ve-mw-3b-durdur', _mw3bKurVeri(V)); return; }
  el.innerHTML = vePencereEylem('<button type="button" class="ve-fp-solve" data-durdur id="ve-mw-3b-durdur" onclick="veMntWiz3bDurdur()">'
    + _mwIkon('square') + ' Durdur</button>', '', _mw3bKurVeri(V));
}

// ── 4 · ÇİZİM KÜMELERİ, RENK VE SEÇİM ─────────────────────────────────────
// Küme: büyük bir ağ (konum · normal · renk · durum · üçgen) ve aynı geometriyi
// çizen iki nesne — opak (soluk olmayan köşeler) ve soluk (seçimin dışı,
// saydam, derinlik yazmaz). Kapasite VE_MW_3B_KUME'ye kadar katlanarak büyür:
// küçük montaja büyük dizi ayrılmaz. Eklenen aralık ve değişen renk/durum
// GPU'ya yalnız o aralıkla yüklenir (updateRange).
function _mw3bMalzeme(soluk){
  var m = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.05, roughness: 0.6, side: THREE.DoubleSide,
    polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
  if(soluk){ m.transparent = true; m.opacity = 0.22; m.depthWrite = false; }
  var vurgu = _mw3bRenk('--accent-primary', '#a8502b');
  m.onBeforeCompile = function(sh){
    sh.uniforms.uVurgu = { value: vurgu };
    sh.vertexShader = 'attribute float durum;\nvarying float vDurum;\n'
      + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n\tvDurum = durum;');
    sh.fragmentShader = 'varying float vDurum;\nuniform vec3 uVurgu;\n'
      + sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n'
      + '\tfloat dD = floor(vDurum + 0.5);\n'
      + '\tif(mod(dD, 2.0) ' + (soluk ? '<' : '>') + ' 0.5) discard;\n'
      + '\ttotalEmissiveRadiance += mod(floor(dD / 2.0), 2.0) > 0.5 ? uVurgu * 0.28 : (dD > 3.5 ? diffuseColor.rgb * 0.22 : vec3(0.0));');
  };
  m.customProgramCacheKey = function(){ return soluk ? 'mw3b-soluk' : 'mw3b-opak'; };
  return m;
}
function _mw3bOz(dizi, boyut, normal){
  var a = new THREE.BufferAttribute(dizi, boyut, !!normal);
  a.setUsage(THREE.DynamicDrawUsage);
  return a;
}
// Parçanın sığdığı küme (yoksa yenisi)
function _mw3bKume(nv, ni){
  var V = _mw3b, K = V.kume[V.kume.length - 1];
  if(K && K.n + nv <= K.kapUc && K.m + ni <= K.kapIdx) return K;
  var kap = Math.min(VE_MW_3B_KUME.uc, K ? K.kapUc * 2 : 65536);
  var kapUc = Math.max(kap, nv), kapIdx = Math.max(Math.round(kap * VE_MW_3B_KUME.ucgen / VE_MW_3B_KUME.uc) * 3, ni);
  K = { no: V.kume.length, kapUc: kapUc, kapIdx: kapIdx, n: 0, m: 0, kirli: {},
        poz: new Float32Array(kapUc * 3), nor: new Float32Array(kapUc * 3), renk: new Uint8Array(kapUc * 3),
        durum: new Uint8Array(kapUc), idx: new Uint32Array(kapIdx) };
  K.a = { poz: _mw3bOz(K.poz, 3), nor: _mw3bOz(K.nor, 3), renk: _mw3bOz(K.renk, 3, true), durum: _mw3bOz(K.durum, 1), idx: _mw3bOz(K.idx, 1) };
  var g = K.geo = new THREE.BufferGeometry();
  g.setAttribute('position', K.a.poz); g.setAttribute('normal', K.a.nor);
  g.setAttribute('color', K.a.renk); g.setAttribute('durum', K.a.durum);
  g.setIndex(K.a.idx);
  g.setDrawRange(0, 0);
  K.opak = new THREE.Mesh(g, V.malzeme.opak);
  K.soluk = new THREE.Mesh(g, V.malzeme.soluk);
  K.soluk.visible = V.solukVar;
  [K.opak, K.soluk].forEach(function(o){ o.frustumCulled = false; o.matrixAutoUpdate = false; V.grup.add(o); });
  V.kume.push(K);
  return K;
}
function _mw3bCizgiKume(nl){
  var V = _mw3b, C = V.ckume[V.ckume.length - 1];
  if(C && C.n + nl <= C.kap) return C;
  var kap = Math.max(Math.min(VE_MW_3B_KUME.cizgi, C ? C.kap * 2 : 65536), nl);
  C = { no: V.ckume.length, kap: kap, n: 0, kirli: {}, poz: new Float32Array(kap * 3), renk: new Uint8Array(kap * 4) };
  C.a = { poz: _mw3bOz(C.poz, 3), renk: _mw3bOz(C.renk, 4, true) };
  var g = C.geo = new THREE.BufferGeometry();
  g.setAttribute('position', C.a.poz); g.setAttribute('color', C.a.renk);
  g.setDrawRange(0, 0);
  C.cizgi = new THREE.LineSegments(g, V.malzeme.cizgi);
  C.cizgi.frustumCulled = false; C.cizgi.matrixAutoUpdate = false;
  V.grup.add(C.cizgi);
  V.ckume.push(C);
  return C;
}
function _mw3bKirli(K, ad, a, b){
  var r = K.kirli[ad];
  if(!r) K.kirli[ad] = [a, b];
  else { if(a < r[0]) r[0] = a; if(b > r[1]) r[1] = b; }
}
function _mw3bAralik(oz, r, boyut){
  oz.updateRange.offset = r[0] * boyut;
  oz.updateRange.count = (r[1] - r[0]) * boyut;
  oz.needsUpdate = true;
}
// Karenin hemen öncesinde: kirli aralıklar GPU'ya, çizim aralığı kümenin dolu kısmı
function _mw3bYukle(){
  var V = _mw3b;
  V.kume.forEach(function(K){
    var k = K.kirli;
    if(k.uc){ _mw3bAralik(K.a.poz, k.uc, 3); _mw3bAralik(K.a.nor, k.uc, 3); }
    if(k.renk) _mw3bAralik(K.a.renk, k.renk, 3);
    if(k.durum) _mw3bAralik(K.a.durum, k.durum, 1);
    if(k.idx) _mw3bAralik(K.a.idx, k.idx, 1);
    K.kirli = {};
    K.geo.setDrawRange(0, K.m);
  });
  V.ckume.forEach(function(C){
    var k = C.kirli;
    if(k.uc) _mw3bAralik(C.a.poz, k.uc, 3);
    if(k.renk) _mw3bAralik(C.a.renk, k.renk, 4);
    C.kirli = {};
    C.geo.setDrawRange(0, C.n);
  });
}
// Parça i'nin ağı kümeye kopyalanır; ağın dizileri kümeye bakan görünüme döner
function _mw3bParcaEkle(i){
  var V = _mw3b, a = V.s.ag[i];
  if(!a || V.parca[i]) return;
  var g = V.s.sonuc._geo[i];
  V.islenen++; V.yuz += (g && g.yuzler) ? g.yuzler.length : 0;
  if(!a.ucgen || !a.ucgen.length){ V.parca[i] = { b: -1 }; return; }
  var nv = a.uc.length / 3, ni = a.ucgen.length, nl = a.cizgi ? a.cizgi.length / 3 : 0;
  var K = _mw3bKume(nv, ni), o = K.n, m0 = K.m, q;
  K.poz.set(a.uc, o * 3); K.nor.set(a.normal, o * 3);
  for(q = 0; q < ni; q++) K.idx[m0 + q] = a.ucgen[q] + o;
  K.n += nv; K.m += ni;
  a.uc = K.poz.subarray(o * 3, (o + nv) * 3);
  a.normal = K.nor.subarray(o * 3, (o + nv) * 3);
  _mw3bKirli(K, 'uc', o, o + nv); _mw3bKirli(K, 'idx', m0, m0 + ni);
  var P = { b: K.no, o: o, n: nv, renk: -1, durum: -1, lb: -1, lo: 0, ln: 0 };
  if(nl){
    var C = _mw3bCizgiKume(nl), lo = C.n;
    C.poz.set(a.cizgi, lo * 3);
    C.n += nl;
    a.cizgi = C.poz.subarray(lo * 3, (lo + nl) * 3);
    for(q = lo * 4; q < (lo + nl) * 4; q += 4){ C.renk[q] = 255; C.renk[q + 1] = 255; C.renk[q + 2] = 255; }
    _mw3bKirli(C, 'uc', lo, lo + nl); _mw3bKirli(C, 'renk', lo, lo + nl);
    P.lb = C.no; P.lo = lo; P.ln = nl;
  }
  V.parca[i] = P;
  V.ekli.push(i);
  var k = a.kutu, e = 1e-3;
  V.kutular.push(k[0] - e, k[1] - e, k[2] - e, k[3] + e, k[4] + e, k[5] + e);
  if(isFinite(k[0])){
    var b = new THREE.Box3(new THREE.Vector3(k[0], k[1], k[2]), new THREE.Vector3(k[3], k[4], k[5]));
    if(!V.kutu) V.kutu = b; else V.kutu.union(b);
  }
  _mw3bParcaBoya(i, _mw3bBoyaBaglam());
}
function _mw3bJeton(ad, yedek){
  try { var v = getComputedStyle(document.documentElement).getPropertyValue(ad).trim(); return v || yedek; }
  catch(e){ return yedek; }
}
function _mw3bRenk(ad, yedek){
  try { return new THREE.Color(_mw3bJeton(ad, yedek)); } catch(e){ return new THREE.Color(yedek); }
}
function _mw3bBayt(c){ return [Math.round(c.r * 255), Math.round(c.g * 255), Math.round(c.b * 255)]; }
// Boyamanın bağlamı: rol renkleri (bayt), seçimin parçaları, farenin birimi.
// Seçili düğüm varken dışındaki parçalar SOLAR: seçimin hangi parçaları
// kapsadığı (bir alt montajın bütün parçaları) böyle okunur. Bağlam her
// boyamada bir kez kurulur (tema jetonları getComputedStyle'dan); kurulum
// sürerken eklenen parçalar aynı bağlamla boyanır.
function _mw3bBoyaBaglam(){
  var V = _mw3b, s = V.s, sec = null;
  if(V.baglam && V.baglam.surum === V.boyaSurum) return V.baglam;
  if(V.secili >= 0){ sec = {}; veMntWiz3bParcalar(s, V.secili).forEach(function(p){ sec[p] = 1; }); }
  var rol = {};
  Object.keys(VE_MW_3B_ROL_RENK).forEach(function(t){ rol[t] = _mw3bBayt(_mw3bRenk(veMntWiz3bRolJeton(t), '#888888')); });
  V.baglam = { surum: V.boyaSurum, sec: sec, rol: rol,
    bos: _mw3bBayt(_mw3bRenk('--text-muted', '#676055').lerp(_mw3bRenk('--bg-secondary', '#faf8f4'), 0.4)),
    fareBirim: V.fare >= 0 ? veMntWiz3bBirim(s, V.fare) : -1 };
  return V.baglam;
}
function _mw3bParcaBoya(i, R){
  var V = _mw3b, P = V.parca[i];
  if(!P || P.b < 0) return;
  var b = veMntWiz3bBirim(V.s, i), c = b >= 0 ? (R.rol[V.s.roller[b]] || R.bos) : R.bos;
  var d = 0;
  if(R.sec) d |= R.sec[i] ? VE_MW_3B_SECIK : VE_MW_3B_SOLUK;
  if(V.fare === i || (R.fareBirim >= 0 && R.fareBirim === b)) d |= VE_MW_3B_FARE;
  var K = V.kume[P.b], q, rk = (c[0] << 16) | (c[1] << 8) | c[2];
  if(P.renk !== rk){
    for(q = P.o * 3; q < (P.o + P.n) * 3; q += 3){ K.renk[q] = c[0]; K.renk[q + 1] = c[1]; K.renk[q + 2] = c[2]; }
    P.renk = rk;
    _mw3bKirli(K, 'renk', P.o, P.o + P.n);
  }
  if(P.durum !== d){
    var solukDegisti = P.durum < 0 || ((P.durum ^ d) & VE_MW_3B_SOLUK);
    K.durum.fill(d, P.o, P.o + P.n);
    P.durum = d;
    _mw3bKirli(K, 'durum', P.o, P.o + P.n);
    if(solukDegisti && P.lb >= 0){
      var C = V.ckume[P.lb], al = VE_MW_3B_CIZGI_A[d & VE_MW_3B_SOLUK ? 1 : 0];
      for(q = P.lo * 4 + 3; q < (P.lo + P.ln) * 4; q += 4) C.renk[q] = al;
      _mw3bKirli(C, 'renk', P.lo, P.lo + P.ln);
    }
  }
}
// Bütün parçalar (rol · seçim · fare değişince): yalnız değişen aralık yazılır
function _mw3bBoya(){
  var V = _mw3b;
  if(!V || !V.scene) return;
  V.boyaSurum = (V.boyaSurum || 0) + 1;
  var R = _mw3bBoyaBaglam();
  for(var k = 0; k < V.ekli.length; k++) _mw3bParcaBoya(V.ekli[k], R);
  V.solukVar = !!R.sec;
  V.kume.forEach(function(K){ K.soluk.visible = V.solukVar; });
}
function veMntWiz3bSec(dugum){
  var V = _mw3b;
  if(!V) return false;
  V.secili = (dugum >= 0 && dugum < V.s.sonuc.agac.length) ? dugum : -1;
  if(V.nokta >= 0 && _mw3bSeciliBirim(V.s, V.secili) !== V.nokta) _mw3bNoktaKip(-1);
  _mw3bPanel(); _mw3bBoya(); _mw3bCiz(true);
  return true;
}
function veMntWiz3bRol(tip){
  var V = _mw3b;
  if(!V || V.secili < 0 || typeof veMntWizStpRol !== 'function') return false;
  veMntWizStpRol(V.secili, tip || '');       // kartın işlevi: ata/torun rolü düşer, sonuç rolleri izler
  return true;
}

// ── 5 · YAN KART VE ALT DİZİ ──────────────────────────────────────────────
function _mw3bPanel(){
  var V = _mw3b;
  var yan = typeof document !== 'undefined' && document.getElementById('ve-mw-3b-yan');
  if(!V || !yan) return;
  // Yazılan kütle alanının odağı korunur: kart yeniden basılırken alan söküldüğü
  // için odak (ve imleç) aynı alanın yenisine geri verilir.
  var aktif = document.activeElement, odak = aktif && aktif.getAttribute && aktif.getAttribute('data-mw-stp-kutle');
  var imlec = (odak !== null && odak !== undefined && aktif.selectionStart !== undefined) ? aktif.selectionStart : null;
  yan.innerHTML = veMntWiz3bPanelHTML(V.s, V.secili);
  if(odak !== null && odak !== undefined && yan.contains && !yan.contains(aktif)){
    var yeni = yan.querySelector('input[data-mw-stp-kutle="' + odak + '"]');
    if(yeni){ yeni.focus(); if(imlec !== null) try { yeni.setSelectionRange(imlec, imlec); } catch(e){} }
  }
  var alt = document.getElementById('ve-mw-3b-alt');
  if(alt) alt.innerHTML = veMntWiz3bAltHTML(V.s, V.secili, { aktar: V.yer === 'sihirbaz', nokta: V.nokta >= 0 });
}
// Saf: durum + seçili düğüm → sağdaki yüzen KART (testli). Sıra: ölçülen
// birimler (gövdeler kütle alanıyla · takozlar) · seçili yol · rol verilenler.
function veMntWiz3bPanelHTML(s, secili){
  var so = s.sonuc, h = '', coz = s.coz;
  var birimSec = _mw3bSeciliBirim(s, secili);
  h += '<section class="ve-fw-3b-bolum" data-ve-3b-sonuc="1"><div class="ve-fw-3b-kbas"><h4>Ölçülen birimler</h4>'
    + '<span class="ve-fw-3b-hdurum" data-ve-3b-hesap-durum="1" data-ok="' + (coz ? (coz.ok ? '1' : '0') : '') + '">'
    + (coz ? (coz.ok ? _mwIkon('check') + ' ' + _mwStpSayim(coz) : _mwIkon('x') + ' ölçülemedi') : 'hesaplanmadı') + '</span></div>';
  if(coz && coz.ok){
    var gs = _mwStpGovdeler(s), ts = _mwStpTakozlar(s);
    var ad = function(b){
      return _mw3bRenkNokta(b.tip) + '<button type="button" class="ve-fw-3b-yolb" onclick="veMntWiz3bSec(' + b.dugum + ')"'
        + ' title="' + _mwEsc(_mwAd(b.tip)) + (b.kaynak === 'kutu' ? ' — ağ kapalı değil, kutunun merkezi' : '') + '">'
        + _mwEsc(b.ad) + '</button>';
    };
    if(gs.length){
      // Kütle: elle → alan; malzeme ya da dosya → türetilen değer + "S" (kaynak
      // sütunu kartta ve pencerede, js/cp-mount-wizard.js → _mwStpKutleHTML)
      var yd = _mwStpYogDurum(s);
      h += '<table class="ve-fw-tbl ve-fw-tbl-fixed ve-fw-3b-tbl ve-mw-3b-tbl" data-ve-3b-govdeler="1"><thead><tr>'
        + '<th>Gövde</th><th>CG<em>mm</em></th><th' + (yd ? ' title="' + _mwEsc(yd) + '"' : '') + '>Kütle<em>kg</em></th>'
        + '</tr></thead><tbody>';
      gs.forEach(function(b){
        h += '<tr data-ve-3b-birim="' + b.dugum + '"' + (b.dugum === birimSec ? ' class="on"' : '')
          + (veMntWizStpKonumUyari(b) ? ' data-uyari="1"' : '') + '><td>' + ad(b) + '</td>'
          + '<td class="ve-fw-num">' + _mwStpKonum(b.konum) + '</td>'
          + '<td>' + _mwStpKutleHucre(s, b, _mwStpKutleK(s, b), true) + '</td></tr>';
      });
      h += '</tbody></table>';
    }
    if(ts.length){
      h += '<table class="ve-fw-tbl ve-fw-tbl-fixed ve-fw-3b-tbl ve-mw-3b-tbl ve-mw-3b-tbl-takoz" data-ve-3b-takozlar="1"><thead><tr>'
        + '<th>Takoz</th><th>Konum<em>mm</em></th><th>Nokta</th></tr></thead><tbody>';
      ts.forEach(function(b){
        var nk = veMntWizStpNoktaKaynak(b);
        h += '<tr data-ve-3b-birim="' + b.dugum + '" data-ve-3b-nokta="' + _mwEsc(b.kaynak) + '"' + (b.dugum === birimSec ? ' class="on"' : '')
          + (veMntWizStpKonumUyari(b) ? ' data-uyari="1"' : '') + '><td>' + ad(b) + '</td>'
          + '<td class="ve-fw-num">' + _mwStpKonum(b.konum, 3) + '</td><td title="' + _mwEsc(nk) + '">' + _mwEsc(nk) + '</td></tr>';
      });
      h += '</tbody></table>';
    }
  } else {
    var rollu = s.roller.filter(function(r){ return !!r; }).length;
    h += '<p class="ve-fw-dim">' + (rollu ? rollu + ' rollü birim' : 'Rol verilmedi') + '</p>';
  }
  var d = typeof veMntWizStpDenetim === 'function' ? veMntWizStpDenetim(s) : { engel: [], uyari: [] };
  var sorun = (coz ? d.engel : []).concat(d.uyari);
  if(sorun.length){
    h += '<div class="ve-fw-issues">';
    sorun.forEach(function(m){ h += '<div class="ve-fw-issue ve-fw-issue-warn">' + _mwIkon('alert-triangle') + ' ' + _mwEsc(m) + '</div>'; });
    h += '</div>';
  }
  h += '</section>';
  // ── SEÇİLİ: yol (alt montaja rol yoldan verilir) ──
  if(secili >= 0){
    var yol = veMntWiz3bYol(s, secili), kok = so.agac[yol[0]];
    var kokGizli = kok.ebeveyn < 0 && kok.cocuklar.length && yol.length > 1;
    h += '<section class="ve-fw-3b-bolum" data-ve-3b-secili="1"><h4>Seçili</h4><div class="ve-fw-3b-yol">';
    yol.forEach(function(dg, k){
      if(k === 0 && kokGizli) h += '<span class="ve-fw-dim" title="Bütün montaja rol verilmez">' + _mwEsc(so.agac[dg].ad) + '</span>';
      else if(dg === secili) h += '<b data-ve-3b-yol="' + dg + '">' + _mwEsc(so.agac[dg].ad) + '</b>';
      else h += '<button type="button" class="ve-fw-3b-yolb" data-ve-3b-yol="' + dg + '" onclick="veMntWiz3bSec(' + dg + ')">'
        + _mwEsc(so.agac[dg].ad) + '</button>';
      if(k < yol.length - 1) h += veIkon('chevron-right', 've-fw-dim ve-fw-3b-ayrac');
    });
    h += '</div>';
    var ata = -1;
    for(var e = so.agac[secili].ebeveyn; e >= 0; e = so.agac[e].ebeveyn) if(s.roller[e]){ ata = e; break; }
    var n = so.agac[secili].parcalar.length;
    h += '<p class="ve-fw-dim">' + n + ' parça' + (ata >= 0 ? ' · ' + _mwEsc(so.agac[ata].ad) + ' biriminin içinde ('
      + _mwEsc(_mwAd(s.roller[ata])) + ')' : '') + '</p></section>';
  }
  // ── ROL VERİLENLER ──
  var atanan = so.agac.filter(function(dg){ return !!s.roller[dg.i]; });
  h += '<section class="ve-fw-3b-bolum"><h4>Rol verilenler <span class="ve-fw-dim">' + atanan.length + '</span></h4>';
  if(!atanan.length) h += '<p class="ve-fw-dim">Henüz yok.</p>';
  else {
    h += '<ul class="ve-fw-3b-atanan">';
    atanan.forEach(function(dg){
      h += '<li' + (dg.i === secili ? ' class="on"' : '') + '>' + _mw3bRenkNokta(s.roller[dg.i])
        + '<button type="button" class="ve-fw-3b-yolb" onclick="veMntWiz3bSec(' + dg.i + ')" title="' + _mwEsc(dg.ornek || dg.id || '') + '">'
        + _mwEsc(dg.ad) + '</button><span class="ve-fw-dim">' + _mwEsc(_mwAd(s.roller[dg.i])) + '</span>'
        + '<button type="button" class="ve-fw-mini" title="Rolü kaldır" aria-label="Rolü kaldır" onclick="veMntWizStpRol(' + dg.i + ', \'\')">'
        + _mwIkon('x') + '</button></li>';
    });
    h += '</ul>';
  }
  return h + '</section>';
}
// Saf: alttaki YÜZEN DİZİ (testli). Üst sıra seçilinin ROL ÇİPLERİ (sık
// olanlar) + "Diğer" listesi; alt sıra TEK hesap düğmesi ve aktarım.
// Liste TEK kaynaktan (VE_MNT_STP_ROLLER); bölme yalnız sunum.
// `opt.aktar === false`: aktarım düğmesi yok (3D Görüntüleyici'den açılan 3B).
function veMntWiz3bAltHTML(s, secili, opt){
  var so = s.sonuc, h = '<div class="ve-fw-3b-dizi" data-ve-3b-roller="1">';
  if(secili >= 0){
    var rol = s.roller[secili] || '';
    h += '<div class="ve-fw-3b-roller" role="group" aria-label="Rol — ' + _mwEsc(so.agac[secili].ad) + '">';
    var cip = VE_MNT_STP_CIP.filter(function(t){ return VE_MNT_STP_ROLLER.indexOf(t) >= 0; });
    var diger = VE_MNT_STP_ROLLER.filter(function(t){ return cip.indexOf(t) < 0; });
    cip.forEach(function(t){
      h += '<button type="button" class="ve-fw-3b-rol" data-ve-3b-rol="' + t + '" aria-pressed="' + (rol === t ? 'true' : 'false')
        + '" onclick="veMntWiz3bRol(\'' + t + '\')">' + _mw3bRenkNokta(t) + _mwEsc(_mwAd(t)) + '</button>';
    });
    if(diger.length){
      var dSec = diger.indexOf(rol) >= 0;
      h += '<select class="ve-fw-3b-rol ve-fw-3b-diger" data-ve-3b-diger="1" aria-label="Diğer roller"' + (dSec ? ' aria-pressed="true"' : '')
        + ' onchange="veMntWiz3bRol(this.value === \'-\' ? \'\' : this.value)"><option value="" disabled' + (dSec ? '' : ' selected') + '>Diğer…</option>'
        + diger.map(function(t){ return '<option value="' + t + '" data-ve-3b-rol="' + t + '"' + (rol === t ? ' selected' : '') + '>' + _mwEsc(_mwAd(t)) + '</option>'; }).join('')
        + '<option value="-" data-ve-3b-rol=""' + (rol ? '' : ' disabled') + '>Rolü kaldır</option></select>';
    }
    h += '</div>';
    // Takozun noktası: seçili düğümün birimi takozsa — daireden seçim kipi ve öneriye dönüş
    var birim = _mw3bSeciliBirim(s, secili);
    if(birim >= 0 && s.roller[birim] === 'mnt-mount'){
      var kip = !!(opt && opt.nokta);
      h += '<div class="ve-fw-3b-roller ve-mw-3b-nokta" role="group" aria-label="Takoz noktası — ' + _mwEsc(so.agac[birim].ad) + '">'
        + '<button type="button" class="ve-fw-3b-rol" id="ve-mw-3b-nokta" aria-pressed="' + (kip ? 'true' : 'false') + '"'
        + ' onclick="veMntWiz3bNoktaSec()">' + _mwIkon('crosshair') + ' Daireden nokta</button>';
      if(s.nokta && s.nokta[birim])
        h += '<button type="button" class="ve-fw-3b-rol" id="ve-mw-3b-nokta-oneri" onclick="veMntWizStpNokta(' + birim + ', null)">'
          + _mwIkon('rotate-ccw') + ' Öneriye dön</button>';
      if(kip) h += '<span class="ve-fw-3b-dizi-ad ve-fw-dim">' + veYon('Takozun dairesel kenarını seçin.') + '</span>';
      h += '</div>';
    }
  } else h += '<span class="ve-fw-3b-dizi-ad ve-fw-dim">Seçili parça yok. ' + veYon('Modelde bir parça seçin.') + '</span>';
  h += '</div>';
  var coz = s.coz, rolEngel = typeof _mwStpRolDenetim === 'function' ? _mwStpRolDenetim(s) : [];
  // Bekleyen hesap (parçaların ağı hazırlanıyor): düğme kapalı, sebebi ipucunda
  var bekle = !!s.hesapBekliyor, kapali = bekle ? 'Parçaların ağı hazırlanıyor.' : rolEngel[0];
  h += '<div class="ve-fw-3b-eylem" data-ve-3b-hesapbar="1">'
    + '<button type="button" class="ve-fw-3b-hap" id="ve-mw-3b-hesapla"' + (kapali ? ' disabled title="' + _mwEsc(kapali) + '"' : '')
    + (bekle ? ' aria-busy="true"' : '') + ' onclick="veMntWiz3bHesapla()">' + _mwIkon('play') + ' '
    + (bekle ? 'Hesaplanıyor…' : coz ? 'Yeniden hesapla' : 'Konumları hesapla') + '</button>';
  if(coz && coz.ok && !(opt && opt.aktar === false))
    h += '<button type="button" class="ve-fw-3b-hap ve-fw-3b-hap-vurgu" id="ve-mw-3b-aktar" onclick="veMntWiz3bAktar()">'
      + (s.aktarim ? 'Yeniden aktar' : 'Sihirbaza aktar') + ' ' + _mwIkon('arrow-right') + '</button>';
  return h + '</div>';
}
// Hesap kartın işlevidir; seçim kalkar — seçim öteki parçaları soldururdu ve
// sonuç (işaretler) bütün birimlerde okunur olmalı
function veMntWiz3bHesapla(){
  if(typeof veMntWizStpHesapla !== 'function') return null;
  if(_mw3b) _mw3b.secili = -1;
  return veMntWizStpHesapla();
}
// Aktarım kartın işlevidir; başarılıysa pencere kapanır — sıradaki iş
// sihirbazın adımlarında
function veMntWiz3bAktar(){
  if(typeof veMntWizStpAktar !== 'function') return null;
  var k = veMntWizStpAktar();
  if(k) veMntWiz3bKapat();
  return k;
}

// ── 6 · HESAP SONUCU 3B'DE ────────────────────────────────────────────────
// Birim başına bir NOKTA (takozun konumu · gövdenin ağırlık merkezi), başlık
// tonunda ve derinlik sınaması kapalı: parçanın İÇİNDE kalan nokta (ağırlık
// merkezi hep içeride) görünmezdi. Yazısı etiket katmanında (_mw3bEtiketle).
// Nokta EKRANDA sabit boyda (VE_MW_3B_ISARET px, her karede _mw3bIsaretOlcek):
// montaja göre boyutlanan küre takoza yakınlaşınca dairesini örtüyordu.
function _mw3bSonucKur(){
  var V = _mw3b;
  if(!V || !V.scene) return;
  if(V.sonucGrubu){
    V.scene.remove(V.sonucGrubu);
    V.sonucGrubu.traverse(function(o){ if(o.geometry) o.geometry.dispose(); if(o.material) o.material.dispose(); });
    V.sonucGrubu = null;
  }
  var coz = V.s.coz, G = new THREE.Group();
  G.userData.nokta = 0; G.userData.halka = 0;
  var takozRenk = _mw3bRenk(veMntWiz3bRolJeton('mnt-mount'), '#2f7d4f');
  if(coz && coz.ok){
    var renk = _mw3bRenk('--text-heading', '#1b1a17');
    coz.birimler.forEach(function(b){
      if(!b.konum) return;
      var takoz = b.tip === 'mnt-mount';
      var geo = takoz ? new THREE.SphereGeometry(1, 16, 12) : new THREE.OctahedronGeometry(1);
      var m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: renk, depthTest: false, transparent: true, opacity: 0.92 }));
      m.position.set(b.konum[0], b.konum[1], b.konum[2]);
      m.userData.px = takoz ? VE_MW_3B_ISARET.takoz : VE_MW_3B_ISARET.govde;
      m.renderOrder = 10;
      G.add(m);
      G.userData.nokta++;
      if(takoz && b.nokta){ G.add(_mw3bHalka(b.nokta, takozRenk)); G.userData.halka++; }
    });
  } else Object.keys(V.s.nokta || {}).forEach(function(d){
    // Hesaptan önce seçilen daireler (yönü bilinenler)
    var n = V.s.nokta[d];
    if(n && n.n){ G.add(_mw3bHalka(n, takozRenk)); G.userData.halka++; }
  });
  if(!G.children.length) return;
  V.sonucGrubu = G;
  V.scene.add(G);
}
// Noktalar her karede ekranda sabit boya ölçeklenir (kameranın uzaklığından)
function _mw3bIsaretOlcek(){
  var V = _mw3b, G = V.sonucGrubu;
  if(!G || !V.camera) return;
  var h = V.kap.clientHeight || 1, tan = Math.tan(V.camera.fov * Math.PI / 360), cp = V.camera.position;
  G.children.forEach(function(m){
    if(!m.userData.px) return;
    var k = m.userData.px * 2 * cp.distanceTo(m.position) * tan / h;
    m.scale.set(k, k, k);
  });
}
// HALKA: dairenin çevresinde ince bir simit (çizgi WebGL'de 1 px — görünmüyordu);
// kalınlığı dairenin yarıçapıyla, derinlik sınaması kapalı
function _mw3bHalka(d, renk){
  var tup = Math.max(0.25, Math.min(3, d.r * 0.035));
  var g = new THREE.TorusGeometry(d.r, tup, 8, 96);
  var m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: renk, depthTest: false, transparent: true, opacity: 0.95 }));
  var n = new THREE.Vector3(d.n[0], d.n[1], d.n[2]).normalize();
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
  m.position.set(d.c[0], d.c[1], d.c[2]);
  m.renderOrder = 11;
  return m;
}

// ── 6b · TAKOZ NOKTASI: DAİREDEN SEÇİM ───────────────────────────────────
// Kip bir TAKOZ BİRİMİNE açılır (seçili düğümün birimi); kapanır: daire
// tıklanınca, Esc, seçim başka birime geçince, birimin rolü düşünce. Açılınca
// seçim birimin kendisi olur (kalan parçalar SOLAR) ve kamera birime sığar:
// takoz montajın içinde küçük ve çoğu bakışta motorun arkasında. Aday kenar
// ve onu örten yüz yalnız birimin parçalarından — soluk parça görünmüyor.
function veMntWiz3bNoktaSec(){
  var V = _mw3b;
  if(!V || !V.scene) return false;
  var b = _mw3bSeciliBirim(V.s, V.secili);
  if(b < 0 || V.s.roller[b] !== 'mnt-mount') return false;
  var ac = V.nokta !== b;
  _mw3bNoktaKip(ac ? b : -1);
  if(ac){ V.secili = b; _mw3bBoya(); _mw3bOdakla(b); }
  _mw3bPanel();
  _mw3bCiz(true);
  return true;
}
// Kamera düğümün parçalarına sığar (bakış yönü kalır)
function _mw3bOdakla(dugum){
  var V = _mw3b, kutu = null, pts = [];
  veMntWiz3bParcalar(V.s, dugum).forEach(function(i){
    var a = V.s.ag[i];
    if(!a || !a.kutu || !isFinite(a.kutu[0]) || !V.parca[i]) return;
    var k = a.kutu, b = new THREE.Box3(new THREE.Vector3(k[0], k[1], k[2]), new THREE.Vector3(k[3], k[4], k[5]));
    if(!kutu) kutu = b; else kutu.union(b);
    var n = a.uc.length / 3, adim = Math.max(1, Math.floor(n / 500));
    for(var q = 0; q < n; q += adim) pts.push(new THREE.Vector3(a.uc[q * 3], a.uc[q * 3 + 1], a.uc[q * 3 + 2]));
  });
  if(!kutu) return false;
  V.eldegdi = true;
  _mw3bSigdir(kutu, pts);
  return true;
}
// Kip açıksa kapatır (Esc) — döner: kapattı mı
function veMntWiz3bNoktaBitir(){
  var V = _mw3b;
  if(!V || V.nokta < 0) return false;
  _mw3bNoktaKip(-1);
  _mw3bPanel();
  _mw3bCiz(true);
  return true;
}
function _mw3bNoktaKip(b){
  var V = _mw3b;
  V.nokta = b;
  V.aday = null;
  _mw3bAdayHalka(null);
  if(V.kap && V.kap.classList) V.kap.classList.toggle('ve-mw-3b-nokta-kip', b >= 0);
  if(typeof document !== 'undefined') _mw3bIpucu(null);
}
function _mw3bAdayHalka(daire){
  var V = _mw3b;
  if(!V || !V.scene) return;
  if(V.halka){
    V.scene.remove(V.halka);
    V.halka.geometry.dispose(); V.halka.material.dispose();
    V.halka = null;
  }
  if(daire){ V.halka = _mw3bHalka(daire, _mw3bRenk('--accent-primary', '#a8502b')); V.scene.add(V.halka); }
}
// Dünya noktası → ekran (kabın pikseli); kameranın arkasındaysa null
function _mw3bEkran(e, x, y, z, w, h){
  var cw = e[3] * x + e[7] * y + e[11] * z + e[15];
  if(!(cw > 1e-9)) return null;
  return [((e[0] * x + e[4] * y + e[8] * z + e[12]) / cw + 1) / 2 * w, (1 - (e[1] * x + e[5] * y + e[9] * z + e[13]) / cw) / 2 * h];
}
// Farenin altındaki dairesel kenar: kutusu fareyi px payıyla kesen parçaların
// çember parçaları ekranda sorulur; tıklanan yüzün arkasındaki kenar sayılmaz.
// Döner: { parca, kenar, daire: { yol, c, n, r } } | null
function _mw3bDaireAra(cx, cy){
  var V = _mw3b, D = VE_MW_3B_DAIRE;
  if(!V || !V.camera || !V.ekli.length || typeof veMntStpKenarDaire !== 'function') return null;
  var R = V.renderer.domElement.getBoundingClientRect(), w = R.width || 1, h = R.height || 1;
  var mx = cx - R.left, my = cy - R.top;
  V.camera.updateMatrixWorld();
  V.ray.setFromCamera(new THREE.Vector2(mx / w * 2 - 1, -(my / h) * 2 + 1), V.camera);
  var birim = null;
  if(V.nokta >= 0){ birim = {}; veMntWiz3bParcalar(V.s, V.nokta).forEach(function(i){ birim[i] = 1; }); }
  var o = V.ray.ray.origin, d = V.ray.ray.direction, vur = _mw3bIsabetIsin(o, d, birim);
  var tol = isFinite(vur.t) ? Math.max(2 * D.derinlik, vur.t * 0.003) : Infinity;
  var tan = Math.tan(V.camera.fov * Math.PI / 360), cp = V.camera.position, K = V.kutular, aday = [];
  for(var e = 0; e < V.ekli.length; e++){
    var a = V.s.ag[V.ekli[e]], j = e * 6;
    if(!a || !a.daire || !a.daire.length || (birim && !birim[V.ekli[e]])) continue;
    var uz = Math.sqrt(Math.pow((K[j] + K[j + 3]) / 2 - cp.x, 2) + Math.pow((K[j + 1] + K[j + 4]) / 2 - cp.y, 2) + Math.pow((K[j + 2] + K[j + 5]) / 2 - cp.z, 2));
    var pay = D.px * 2 * uz * tan / h, t = _mw3bKutuKes(o, d, K, j, pay);
    if(t < 0 || t > vur.t + tol + pay) continue;
    aday.push([t, V.ekli[e]]);
  }
  aday.sort(function(x, y){ return x[0] - y[0]; });
  var PM = new THREE.Matrix4().multiplyMatrices(V.camera.projectionMatrix, V.camera.matrixWorldInverse).elements, en = null;
  for(var c = 0; c < aday.length && c < D.aday; c++){
    var i = aday[c][1], ag = V.s.ag[i], L = ag.cizgi, Dz = ag.daire;
    for(var q = 0; q < Dz.length; q += 3){
      for(var sg = Dz[q + 1], son = Dz[q + 1] + Dz[q + 2]; sg < son; sg++){
        var k = sg * 6, p = _mw3bEkran(PM, L[k], L[k + 1], L[k + 2], w, h), r2 = _mw3bEkran(PM, L[k + 3], L[k + 4], L[k + 5], w, h);
        if(!p || !r2) continue;
        var dx = r2[0] - p[0], dy = r2[1] - p[1], l2 = dx * dx + dy * dy;
        var u = l2 > 0 ? Math.max(0, Math.min(1, ((mx - p[0]) * dx + (my - p[1]) * dy) / l2)) : 0;
        var ex = p[0] + u * dx - mx, ey = p[1] + u * dy - my, dd = Math.sqrt(ex * ex + ey * ey);
        if(dd > D.px) continue;
        var der = (L[k] + u * (L[k + 3] - L[k]) - o.x) * d.x + (L[k + 1] + u * (L[k + 4] - L[k + 1]) - o.y) * d.y
          + (L[k + 2] + u * (L[k + 5] - L[k + 2]) - o.z) * d.z;
        if(der > vur.t + tol) continue;                          // tıklanan yüzün arkasında
        if(!en || dd < en.dd - 1.5 || (Math.abs(dd - en.dd) <= 1.5 && der < en.der)) en = { parca: i, kenar: Dz[q], dd: dd, der: der };
      }
    }
  }
  if(!en) return null;
  var daire = veMntStpKenarDaire(V.s.sonuc, en.parca, en.kenar);
  return daire ? { parca: en.parca, kenar: en.kenar, daire: daire } : null;
}
function _mw3bDaireFare(e){
  var V = _mw3b;
  V.fareSon = e;
  if(V.fareIstek) return;
  V.fareIstek = requestAnimationFrame(function(){
    V.fareIstek = 0;
    if(_mw3b !== V || V.nokta < 0) return;
    var ev = V.fareSon, a = _mw3bDaireAra(ev.clientX, ev.clientY);
    if(!(a && V.aday && a.parca === V.aday.parca && a.kenar === V.aday.kenar)){
      V.aday = a;
      _mw3bAdayHalka(a ? a.daire : null);
      _mw3bCiz(true);
    }
    _mw3bDaireIpucu(ev, a, false);
  });
}
// Tık: daire bulunduysa takozun noktası olur ve kip kapanır; bulunmadıysa sebep
function _mw3bDaireTik(e){
  var V = _mw3b, a = _mw3bDaireAra(e.clientX, e.clientY);
  if(!a){ _mw3bDaireIpucu(e, null, true); return false; }
  var b = V.nokta;
  _mw3bNoktaKip(-1);
  veMntWizStpNokta(b, a.daire);
  return true;
}
function _mw3bDaireIpucu(e, a, yok){
  var V = _mw3b, el = typeof document !== 'undefined' && document.getElementById('ve-mw-3b-ipucu');
  if(!el) return;
  if(!a && !yok){ el.hidden = true; return; }
  el.textContent = a ? 'Ø ' + _mwSayi(2 * a.daire.r, 1) + ' mm · ' + _mwStpKonum(a.daire.c, 3) : 'Dairesel kenar yok.';
  var r = V.kap.getBoundingClientRect();
  el.style.left = Math.min(r.width - 12, e.clientX - r.left + 14) + 'px';
  el.style.top = Math.max(4, e.clientY - r.top - 28) + 'px';
  el.hidden = false;
}

// ── 7 · KAMERA ────────────────────────────────────────────────────────────
// Yörünge dünya eksenlerinde (z yukarı): Takoz'un koordinatı aracın ekseni,
// FEAD'in kayış düzlemi gibi ayrı bir bakış düzlemi yok.
function _mw3bKamera(){
  var V = _mw3b, c = V.ctrl, cp = Math.cos(c.phi);
  V.camera.position.set(c.hedef.x + c.r * cp * Math.cos(c.theta), c.hedef.y + c.r * cp * Math.sin(c.theta),
    c.hedef.z + c.r * Math.sin(c.phi));
  V.camera.up.set(0, 0, 1);
  V.camera.lookAt(c.hedef);
  V.isik.position.copy(V.camera.position);
  V.isik.target.position.copy(c.hedef);
  V.camera.near = Math.max(0.1, c.r / 500); V.camera.far = c.r * 50;
  V.camera.updateProjectionMatrix();
}
function _mw3bOrnekNoktalar(){
  var V = _mw3b, out = [], ag = V.s.ag || [], top = 0;
  V.ekli.forEach(function(i){ var a = ag[i]; if(a && a.uc) top += a.uc.length / 3; });
  var adim = Math.max(1, Math.floor(top / 3000));
  V.ekli.forEach(function(i){
    var a = ag[i];
    if(!a || !a.uc) return;
    for(var k = 0; k < a.uc.length / 3; k += adim) out.push(new THREE.Vector3(a.uc[k * 3], a.uc[k * 3 + 1], a.uc[k * 3 + 2]));
  });
  return out;
}
// Kartın ve alttaki dizinin ÖRTTÜĞÜ şerit (px) — sığdırma geri kalan alana oturur.
function _mw3bSerbest(){
  var V = _mw3b, out = { sag: 0, alt: 0 };
  if(!V || typeof document === 'undefined') return out;
  var r = V.kap.getBoundingClientRect(), yan = document.getElementById('ve-mw-3b-yan'), alt = document.getElementById('ve-mw-3b-alt');
  if(yan && yan.offsetWidth){ var y = yan.getBoundingClientRect(); var sg = r.right - y.left; if(sg > 0 && sg < r.width * 0.5) out.sag = sg; }
  if(alt && alt.offsetHeight){ var a = alt.getBoundingClientRect(); var ak = Math.max(VE_MW_3B_ALT_PAY, r.bottom - a.top); if(ak < r.height * 0.4) out.alt = ak; }
  return out;
}
function _mw3bKaydir(dx, dy){
  var V = _mw3b, h = V.kap.clientHeight || 1;
  var olcek = 2 * V.ctrl.r * Math.tan(V.camera.fov * Math.PI / 360) / h;
  var sag = new THREE.Vector3().setFromMatrixColumn(V.camera.matrixWorld, 0);
  var yuk = new THREE.Vector3().setFromMatrixColumn(V.camera.matrixWorld, 1);
  V.ctrl.hedef.addScaledVector(sag, -dx * olcek).addScaledVector(yuk, dy * olcek);
}
// Montajın KENDİ noktaları serbest alanın %80'ine oturana kadar (kutunun
// köşeleriyle sığdırmak eğik bakışta modeli küçültüyordu — FEAD'de ölçüldü).
function _mw3bSigdir(kutu, noktalar, bekle){
  var V = _mw3b;
  if(!V || !V.camera || !kutu) return;
  var m = kutu.getCenter(new THREE.Vector3()), R = kutu.getSize(new THREE.Vector3()).length() / 2 || 100;
  var pts = noktalar && noktalar.length ? noktalar : null;
  if(!pts){
    pts = [];
    for(var c = 0; c < 8; c++) pts.push(new THREE.Vector3(c & 1 ? kutu.max.x : kutu.min.x, c & 2 ? kutu.max.y : kutu.min.y, c & 4 ? kutu.max.z : kutu.min.z));
  }
  V.ctrl.hedef.copy(m);
  V.ctrl.r = R / Math.sin(V.camera.fov * Math.PI / 360);
  V.sigKutu = { c: m.clone(), d: 2 * R };
  V.sonSig = _mwSimdi();
  for(var k = 0; k < 5; k++){
    _mw3bKamera();
    V.camera.updateMatrixWorld();
    var x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    pts.forEach(function(q){
      var p = q.clone().project(V.camera);
      if(p.x < x0) x0 = p.x; if(p.x > x1) x1 = p.x; if(p.y < y0) y0 = p.y; if(p.y > y1) y1 = p.y;
    });
    if(!isFinite(x0)) break;
    var h = V.kap.clientHeight || 1, w = V.kap.clientWidth || 1, F = _mw3bSerbest();
    var ax = (w - F.sag) / w, ay = (h - F.alt) / h, cx = -F.sag / w, cy = F.alt / h;
    _mw3bKaydir(-((x0 + x1) / 2 - cx) * w / 2, ((y0 + y1) / 2 - cy) * h / 2);
    var en = Math.max((x1 - x0) / 2 / ax, (y1 - y0) / 2 / ay);
    if(!(en > 0)) break;
    V.ctrl.r *= Math.max(0.5, Math.min(2, en / VE_MW_3B_ACILIS.doluluk));
  }
  _mw3bKamera();
  _mw3bCiz(!bekle);
}
// Kurulurken kamera BÜYÜYEN montaja sığar — kullanıcı tuvale dokunana dek;
// kutu %10'dan çok büyüyünce ya da kayınca, en sık VE_MW_3B_SIGDIR_ARA'da bir
function _mw3bOtoSigdir(){
  var V = _mw3b;
  if(!V || V.eldegdi || !V.kutu) return;
  if(V.sigKutu && _mwSimdi() - V.sonSig < VE_MW_3B_SIGDIR_ARA) return;
  var c = V.kutu.getCenter(new THREE.Vector3()), d = V.kutu.getSize(new THREE.Vector3()).length();
  if(V.sigKutu && d <= V.sigKutu.d * 1.1 && c.distanceTo(V.sigKutu.c) <= 0.1 * Math.max(V.sigKutu.d, 1e-9)) return;
  _mw3bSigdir(V.kutu, null, true);
}
// "Sığdır": bakış açılışınki; kurulum sürüyorsa kamera yine büyüyen montaja sığar
function veMntWiz3bSigdir(){
  var V = _mw3b;
  if(!V || !V.kutu) return false;
  V.ctrl.theta = VE_MW_3B_ACILIS.theta; V.ctrl.phi = VE_MW_3B_ACILIS.phi;
  V.eldegdi = false;
  _mw3bSigdir(V.kutu, _mw3bOrnekNoktalar());
  return true;
}

// ── 8 · ETKİLEŞİM ─────────────────────────────────────────────────────────
function _mw3bDinle(V){
  var cv = V.renderer.domElement, bas = null;
  function dinle(el, ad, f, o){ el.addEventListener(ad, f, o); V.sokucu.push(function(){ el.removeEventListener(ad, f, o); }); }
  dinle(cv, 'contextmenu', function(e){ e.preventDefault(); });
  dinle(cv, 'pointerdown', function(e){
    bas = { x: e.clientX, y: e.clientY, tus: e.button, kay: e.button !== 0 || e.shiftKey, oynadi: false };
    try { cv.setPointerCapture(e.pointerId); } catch(x){}
  });
  dinle(cv, 'pointermove', function(e){
    if(bas){
      var dx = e.clientX - bas.x, dy = e.clientY - bas.y;
      if(!bas.oynadi && Math.abs(dx) + Math.abs(dy) < 4) return;
      bas.oynadi = true;
      V.eldegdi = true;
      V.kap.classList.add('surukle');
      if(bas.kay) _mw3bKaydir(dx, dy);
      else { V.ctrl.theta -= dx * 0.008; V.ctrl.phi = Math.max(-1.5, Math.min(1.5, V.ctrl.phi + dy * 0.008)); }
      bas.x = e.clientX; bas.y = e.clientY;
      _mw3bKamera(); _mw3bCiz(true);
      return;
    }
    if(V.nokta >= 0) _mw3bDaireFare(e); else _mw3bFare(e);
  });
  dinle(cv, 'pointerup', function(e){
    var b = bas;
    bas = null;
    V.kap.classList.remove('surukle');
    if(b && !b.oynadi && b.tus === 0){
      if(V.nokta >= 0){ _mw3bDaireTik(e); return; }
      var i = _mw3bIsabet(e.clientX, e.clientY);
      veMntWiz3bSec(i >= 0 ? V.s.sonuc.parcalar[i].dugum : -1);
    }
  });
  dinle(cv, 'pointerleave', function(){
    if(V.aday){ V.aday = null; _mw3bAdayHalka(null); _mw3bIpucu(null); _mw3bCiz(true); }
    if(V.fare >= 0){ V.fare = -1; _mw3bIpucu(null); _mw3bBoya(); _mw3bCiz(true); }
  });
  dinle(cv, 'wheel', function(e){
    e.preventDefault();
    V.eldegdi = true;
    V.ctrl.r = Math.max(1, Math.min(1e6, V.ctrl.r * Math.exp(e.deltaY * 0.0012)));
    _mw3bKamera(); _mw3bCiz(true);
  }, { passive: false });
}
// İSABET: ışın önce parçaların kutusuyla kesilir (giriş uzaklığına göre sıralı),
// sonra yalnız o parçaların üçgenleri sorulur; daha yakın bir isabet bulununca
// kutusu ondan uzak kalan parçalara bakılmaz. Döner: parça indisi ya da -1.
function _mw3bIsabet(cx, cy){
  var V = _mw3b;
  if(!V || !V.camera || !V.ekli.length) return -1;
  var r = V.renderer.domElement.getBoundingClientRect();
  var nd = new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
  V.ray.setFromCamera(nd, V.camera);
  return _mw3bIsabetIsin(V.ray.ray.origin, V.ray.ray.direction).i;
}
// Işının ilk çarptığı parça ve uzaklığı: { i, t } (çarpmazsa i = -1, t = ∞).
// `kume` ({parça: 1}) verilirse yalnız onun parçaları
function _mw3bIsabetIsin(o, d, kume){
  var V = _mw3b, K = V.kutular, aday = [];
  for(var e = 0; e < V.ekli.length; e++){
    if(kume && !kume[V.ekli[e]]) continue;
    var t = _mw3bKutuKes(o, d, K, e * 6);
    if(t >= 0) aday.push([t, V.ekli[e]]);
  }
  aday.sort(function(a, b){ return a[0] - b[0]; });
  var en = Infinity, enI = -1;
  for(var c = 0; c < aday.length && aday[c][0] <= en; c++){
    var t2 = _mw3bUcgenKes(o, d, V.s.ag[aday[c][1]], en);
    if(t2 < en){ en = t2; enI = aday[c][1]; }
  }
  return { i: enI, t: en };
}
// Işın ↔ kutu (dilim yöntemi): giriş uzaklığı (≥ 0) ya da -1. `pay`: kutu her
// yönde o kadar büyütülür (daireden seçimin piksel payı)
function _mw3bKutuKes(o, d, K, j, pay){
  var t0 = 0, t1 = Infinity, ox = [o.x, o.y, o.z], dx = [d.x, d.y, d.z], p = pay > 0 ? pay : 0;
  for(var a = 0; a < 3; a++){
    var lo = K[j + a] - p, hi = K[j + 3 + a] + p;
    if(Math.abs(dx[a]) < 1e-12){ if(ox[a] < lo || ox[a] > hi) return -1; continue; }
    var ta = (lo - ox[a]) / dx[a], tb = (hi - ox[a]) / dx[a];
    if(ta > tb){ var x = ta; ta = tb; tb = x; }
    if(ta > t0) t0 = ta;
    if(tb < t1) t1 = tb;
    if(t1 < t0) return -1;
  }
  return t0;
}
// Işın ↔ parçanın üçgenleri (Möller–Trumbore, iki yüzlü): en yakın t < sinir
function _mw3bUcgenKes(o, d, a, sinir){
  if(!a || !a.ucgen) return Infinity;
  var u = a.uc, T = a.ucgen, en = sinir, ox = o.x, oy = o.y, oz = o.z, dx = d.x, dy = d.y, dz = d.z;
  for(var k = 0; k < T.length; k += 3){
    var i0 = T[k] * 3, i1 = T[k + 1] * 3, i2 = T[k + 2] * 3;
    var e1x = u[i1] - u[i0], e1y = u[i1 + 1] - u[i0 + 1], e1z = u[i1 + 2] - u[i0 + 2];
    var e2x = u[i2] - u[i0], e2y = u[i2 + 1] - u[i0 + 1], e2z = u[i2 + 2] - u[i0 + 2];
    var px = dy * e2z - dz * e2y, py = dz * e2x - dx * e2z, pz = dx * e2y - dy * e2x;
    var det = e1x * px + e1y * py + e1z * pz;
    if(Math.abs(det) < 1e-12) continue;
    var inv = 1 / det, sx = ox - u[i0], sy = oy - u[i0 + 1], sz = oz - u[i0 + 2];
    var uu = (sx * px + sy * py + sz * pz) * inv;
    if(uu < 0 || uu > 1) continue;
    var qx = sy * e1z - sz * e1y, qy = sz * e1x - sx * e1z, qz = sx * e1y - sy * e1x;
    var vv = (dx * qx + dy * qy + dz * qz) * inv;
    if(vv < 0 || uu + vv > 1) continue;
    var t = (e2x * qx + e2y * qy + e2z * qz) * inv;
    if(t > 1e-6 && t < en) en = t;
  }
  return en;
}
function _mw3bFare(e){
  var V = _mw3b;
  if(V.fareIstek){ V.fareSon = e; return; }
  V.fareSon = e;
  V.fareIstek = requestAnimationFrame(function(){
    V.fareIstek = 0;
    if(_mw3b !== V) return;
    var ev = V.fareSon, i = _mw3bIsabet(ev.clientX, ev.clientY);
    if(i !== V.fare){ V.fare = i; _mw3bBoya(); _mw3bCiz(true); }
    _mw3bIpucu(i >= 0 ? ev : null, i);
  });
}
function _mw3bIpucu(e, i){
  var V = _mw3b, el = document.getElementById('ve-mw-3b-ipucu');
  if(!el) return;
  if(!e || i < 0){ el.hidden = true; return; }
  var s = V.s, p = s.sonuc.parcalar[i], b = veMntWiz3bBirim(s, i);
  el.textContent = p.ad + (b >= 0 ? ' · ' + _mwAd(s.roller[b]) + (b !== p.dugum ? ' (' + s.sonuc.agac[b].ad + ')' : '') : '');
  var r = V.kap.getBoundingClientRect();
  el.style.left = Math.min(r.width - 12, e.clientX - r.left + 14) + 'px';
  el.style.top = Math.max(4, e.clientY - r.top - 28) + 'px';
  el.hidden = false;
}
function _mw3bBoyut(){
  var V = _mw3b;
  if(!V || !V.renderer) return;
  var w = Math.max(1, V.kap.clientWidth), h = Math.max(1, V.kap.clientHeight);
  V.renderer.setSize(w, h, false);
  V.camera.aspect = w / h;
  V.camera.updateProjectionMatrix();
  _mw3bCiz(true);
}
// Çizim İSTEK ÜZERİNE. Kurulum sürerken kare en sık VE_MW_3B_KURULUM_KARE'de bir
// (eklenen parçalar); kullanıcının hamlesi (`hemen`) beklemez.
function _mw3bCiz(hemen){
  var V = _mw3b;
  if(!V || !V.renderer || !V.scene || V.cizIstek) return;
  if(!hemen && V.kuruluyor){
    var bekle = V.sonCiz + Math.max(VE_MW_3B_KURULUM_KARE, VE_MW_3B_KARE_PAY * V.kareMs) - _mwSimdi();
    if(bekle > 0){
      if(!V.cizZaman) V.cizZaman = setTimeout(function(){ V.cizZaman = 0; if(_mw3b === V) _mw3bCiz(true); }, bekle);
      return;
    }
  }
  V.cizIstek = requestAnimationFrame(function(){
    V.cizIstek = 0;
    if(_mw3b !== V) return;
    var t0 = _mwSimdi();
    _mw3bYukle();
    _mw3bIsaretOlcek();
    V.renderer.render(V.scene, V.camera);
    V.sonCiz = t0;
    _mw3bEtiketle();
    // Karenin süresi: sunum (kare çizildikten sonra) dâhil — sıradaki görevde ölçülür
    _mwSonraki(function(){ var t = _mwSimdi(); V.kareMs = t - t0; V.sonCiz = t; });
  });
}
// ETİKETLER: hesaptan sonra her birimin yanında adı ve konumu (gövdede ağırlık
// merkezi); kılavuz çizgisi noktadan. Konum her karede kameranın izdüşümünden
// — sayı kartın tablosuyla aynı kaynaktan (çözüm). Etiket montajın merkezinden
// DIŞARI açılır; montajın arkasında kalan nokta etiketlenmez.
function _mw3bEtiketle(){
  var V = _mw3b, kat = document.getElementById('ve-mw-3b-etiket'), cz = document.getElementById('ve-mw-3b-etiket-cizgi');
  if(!V || !kat || !cz) return;
  var coz = V.s.coz;
  if(!coz || !coz.ok || !V.grup.visible){ kat.innerHTML = ''; cz.innerHTML = ''; return; }
  var w = V.kap.clientWidth || 1, h = V.kap.clientHeight || 1;
  V.camera.updateMatrixWorld();
  var B = coz.birimler.filter(function(b){ return !!b.konum; }).map(function(b){
    var p = new THREE.Vector3(b.konum[0], b.konum[1], b.konum[2]).project(V.camera);
    return { b: b, x: (p.x + 1) / 2 * w, y: (1 - p.y) / 2 * h, on: p.z < 1 };
  });
  var ox = 0, oy = 0;
  B.forEach(function(q){ ox += q.x / B.length; oy += q.y / B.length; });
  var hs = '', cs = '';
  B.forEach(function(q, i){
    if(!q.on) return;
    var sagda = q.x >= ox, yx = sagda ? 1 : -1, yy = q.y >= oy ? 1 : -1;
    var lx = q.x + yx * 34, ly = q.y + yy * 14;
    cs += '<line x1="' + q.x.toFixed(1) + '" y1="' + q.y.toFixed(1) + '" x2="' + lx.toFixed(1) + '" y2="' + ly.toFixed(1) + '"/>';   // makine: SVG yol verisi
    hs += '<div class="ve-fw-3b-etk' + (sagda ? '' : ' sol') + '" data-ve-3b-etiket="' + i + '" style="left:' + lx.toFixed(1) + 'px;top:' + ly.toFixed(1) + 'px">'   // makine: CSS konumu
      + '<b>' + _mwEsc(q.b.ad) + '</b><span>' + (q.b.tip === 'mnt-mount' ? _mwStpKonum(q.b.konum, 3) : 'CG ' + _mwStpKonum(q.b.konum)) + '</span></div>';
  });
  cz.innerHTML = cs; kat.innerHTML = hs;
}

// ── 9 · TEST KANCASI ──────────────────────────────────────────────────────
// Gerçek tarayıcı testi parçaya ekranda TIKLAR: parçanın bir üçgeninin
// ağırlık merkezi, ışın o noktada ilk o parçaya çarpıyorsa döner.
function veMntWiz3bIsabetNoktasi(i){
  var V = _mw3b, a = V && V.s.ag && V.s.ag[i];
  if(!a || !V.camera) return null;
  V.camera.updateMatrixWorld();
  var r = V.renderer.domElement.getBoundingClientRect(), n = a.ucgen.length / 3, adim = Math.max(1, Math.floor(n / 400));
  for(var t = 0; t < n; t += adim){
    var p = new THREE.Vector3();
    for(var j = 0; j < 3; j++){ var v = a.ucgen[t * 3 + j] * 3; p.x += a.uc[v] / 3; p.y += a.uc[v + 1] / 3; p.z += a.uc[v + 2] / 3; }
    p.project(V.camera);
    if(Math.abs(p.x) > 0.95 || Math.abs(p.y) > 0.95 || p.z > 1) continue;
    var x = r.left + (p.x + 1) / 2 * r.width, y = r.top + (1 - p.y) / 2 * r.height;
    if(_mw3bIsabet(x, y) === i) return { x: x, y: y };
  }
  return null;
}
// Daireye TIKLAMAK için: parçanın yarıçapı r olan çember kenarının bir
// noktası — tuval orada görünür (kart örtmüyor) ve daireden seçim orada o
// kenarı buluyorsa.
function veMntWiz3bDaireNoktasi(i, r){
  var V = _mw3b, a = V && V.s.ag && V.s.ag[i];
  if(!a || !a.daire || !V.camera) return null;
  V.camera.updateMatrixWorld();
  var R = V.renderer.domElement.getBoundingClientRect();
  var PM = new THREE.Matrix4().multiplyMatrices(V.camera.projectionMatrix, V.camera.matrixWorldInverse).elements;
  for(var q = 0; q < a.daire.length; q += 3){
    var d = veMntStpKenarDaire(V.s.sonuc, i, a.daire[q]);
    if(!d || Math.abs(d.r - r) > 1e-6 * Math.max(1, r)) continue;
    for(var sg = a.daire[q + 1]; sg < a.daire[q + 1] + a.daire[q + 2]; sg++){
      var k = sg * 6, L = a.cizgi;
      var p = _mw3bEkran(PM, (L[k] + L[k + 3]) / 2, (L[k + 1] + L[k + 4]) / 2, (L[k + 2] + L[k + 5]) / 2, R.width, R.height);
      if(!p) continue;
      var x = R.left + p[0], y = R.top + p[1];
      if(document.elementFromPoint(x, y) !== V.renderer.domElement) continue;
      var b = _mw3bDaireAra(x, y);
      if(b && b.parca === i && b.kenar === a.daire[q]) return { x: x, y: y };
    }
  }
  return null;
}
function veMntWiz3bDurum(){
  var V = _mw3b;
  if(!V) return null;
  return { durum: V.kap.getAttribute('data-durum'), parca: V.ekli.length, islenen: V.islenen, toplam: V.toplam,
    kume: V.kume.length, cizgiKume: V.ckume.length, cagri: V.renderer && V.renderer.info ? V.renderer.info.render.calls : 0,
    etiket: document.querySelectorAll('#ve-mw-3b-etiket [data-ve-3b-etiket]').length,
    nokta: V.sonucGrubu ? V.sonucGrubu.userData.nokta : 0, halka: V.sonucGrubu ? V.sonucGrubu.userData.halka : 0,
    secili: V.secili, fare: V.fare, kip: V.nokta, aday: V.aday ? { parca: V.aday.parca, r: V.aday.daire.r } : null, adayHalka: !!V.halka };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    VE_MW_3B_ROL_RENK: VE_MW_3B_ROL_RENK, VE_MW_3B_ACILIS: VE_MW_3B_ACILIS,
    veMntWiz3bBirim: veMntWiz3bBirim, veMntWiz3bYol: veMntWiz3bYol, veMntWiz3bParcalar: veMntWiz3bParcalar,
    veMntWiz3bRolJeton: veMntWiz3bRolJeton, veMntWiz3bPanelHTML: veMntWiz3bPanelHTML,
    veMntWiz3bAltHTML: veMntWiz3bAltHTML, _mw3bSeciliBirim: _mw3bSeciliBirim, veMntWiz3bTazele: veMntWiz3bTazele,
    _mw3bKutuKes: _mw3bKutuKes, _mw3bUcgenKes: _mw3bUcgenKes, _mw3bKurVeri: _mw3bKurVeri,
    VE_MW_3B_YER: VE_MW_3B_YER, veMntWiz3bYer: veMntWiz3bYer, veMntWiz3bAcik: veMntWiz3bAcik,
    VE_MW_3B_DAIRE: VE_MW_3B_DAIRE, _mw3bEkran: _mw3bEkran, veMntWiz3bNoktaBitir: veMntWiz3bNoktaBitir
  };
}
