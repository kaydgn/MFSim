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
// DURUM KARTLA ORTAK (_mwStp, veMntWizStp() ile okunur): rol ve kütle burada
// da kartta da aynı nesneye yazılır. Tazeleme veMntWizRender'ın sonundan
// geçer — pencerenin ayrı bir kopyası olsaydı kartla sessizce ayrışırdı.
//
// GÖRÜNÜM FEAD'İN 3B PENCERESİNİN (`.ve-fw-3b*`, js/cp-fead-3b.js): tuval
// önde, sağda yüzen kart, altta rol dizisi. Takoz'a özgü olan yalnız roller,
// renkleri ve sonucun biçimi (halka değil nokta). Sihirbazın İÇİNDE bir
// kaplama (#ve-mw-3b): sihirbaz kapanınca o da gider, WebGL bağlamı bırakılır.
// THREE yoksa (Node testi) açılmaz. Çizim İSTEK ÜZERİNE, sürekli döngü yok.
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
// Görüntüleyicinin iş bütçesi: bir karede en çok bu kadar üçgenleme (ms)
var VE_MW_3B_BUTCE = 24;
// AÇILIŞ BAKIŞI: önden-sağdan-yukarıdan (araç ekseni: x arkaya, y sağa, z yukarı)
var VE_MW_3B_ACILIS = { theta: 0.75 * Math.PI, phi: 0.42, doluluk: 0.8 };

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
function veMntWiz3bAcik(){ return !!_mw3b; }
function veMntWiz3bAc(){
  if(typeof document === 'undefined' || typeof THREE === 'undefined') return false;
  var s = typeof veMntWizStp === 'function' ? veMntWizStp() : null;
  if(!s || s.durum !== 'hazir' || !s.sonuc || !s.sonuc._model) return false;
  var ov = document.getElementById('ve-mw-3b');
  if(!ov) return false;
  if(_mw3b) veMntWiz3bKapat();
  ov.style.display = 'flex';
  _mw3bGenis(true);
  ov.innerHTML = '<div class="ve-settings-header ve-fw-3b-bas">'
    + '<span><span class="mf-ico mf-ico-box"></span> 3B görüntüleyici <span class="ve-fw-dim" id="ve-mw-3b-dosya"></span></span>'
    + '<button type="button" class="ve-fw-mini ve-fw-3b-metin" onclick="veMntWiz3bSigdir()" title="Bütün montajı sığdır">Sığdır</button>'
    + '<button type="button" class="ve-settings-close" onclick="veMntWiz3bKapat()" title="Kapat (Esc)" aria-label="Kapat">'
      + '<span class="mf-ico mf-ico-x"></span></button>'
    + '</div><div class="ve-fw-3b-govde">'
    + '<div class="ve-fw-3b-tuval" id="ve-mw-3b-tuval" data-durum="kuruluyor">'
      + '<svg class="ve-fw-3b-etiket-cizgi" id="ve-mw-3b-etiket-cizgi" aria-hidden="true"></svg>'
      + '<div class="ve-fw-3b-etiketler" id="ve-mw-3b-etiket"></div>'
      + '<div class="ve-fw-3b-ilerleme" id="ve-mw-3b-ilerleme"></div>'
      + '<div class="ve-fw-3b-ipucu" id="ve-mw-3b-ipucu" hidden></div></div>'
    + '<aside class="ve-fw-3b-yan" id="ve-mw-3b-yan" aria-label="Gövdeler ve takozlar"></aside>'
    + '<div class="ve-fw-3b-alt" id="ve-mw-3b-alt"></div></div>';
  var kap = document.getElementById('ve-mw-3b-tuval');
  var V = { kap: kap, s: s, meshler: [], cizgiler: [], sokucu: [], secili: -1, fare: -1, cizIstek: 0,
            kutu: null, sonucGrubu: null, kuyruk: null };
  var w = Math.max(1, kap.clientWidth), h = Math.max(1, kap.clientHeight);
  try {
    V.renderer = new THREE.WebGLRenderer({ antialias: true });
  } catch(e){
    kap.setAttribute('data-durum', 'hata');
    kap.insertAdjacentHTML('afterbegin', '<p class="ve-fw-3b-yok">3B çizim açılamadı (WebGL yok).</p>');
    _mw3b = V;
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
  V.grup = new THREE.Group();
  // Montaj KURULURKEN görünmez: parça parça gelen ağı ilk parçaya sığdırmak
  // açılışta modeli ekrana yapıştırırdı (FEAD'de ölçüldü).
  V.grup.visible = false;
  V.scene.add(V.grup);
  V.ctrl = { theta: VE_MW_3B_ACILIS.theta, phi: VE_MW_3B_ACILIS.phi, r: 1000, hedef: new THREE.Vector3() };
  V.ray = new THREE.Raycaster();
  _mw3b = V;
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
function veMntWiz3bKapat(){
  var V = _mw3b;
  _mw3b = null;
  if(typeof document !== 'undefined'){
    var ov = document.getElementById('ve-mw-3b');
    if(ov){ ov.style.display = 'none'; ov.innerHTML = ''; }
    _mw3bGenis(false);
  }
  if(!V) return;
  if(V.kuyrukZaman) clearTimeout(V.kuyrukZaman);
  if(V.cizIstek && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(V.cizIstek);
  V.sokucu.forEach(function(f){ try { f(); } catch(e){} });
  if(V.ro) try { V.ro.disconnect(); } catch(e3){}
  if(V.scene) V.scene.traverse(function(o){
    if(o.geometry) o.geometry.dispose();
    if(o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(function(m){ m.dispose(); });
  });
  if(V.renderer){ V.renderer.dispose(); if(V.renderer.forceContextLoss) try { V.renderer.forceContextLoss(); } catch(e4){} }
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
  _mw3bPanel();
  _mw3bRenkle();
  _mw3bSonucKur();
  _mw3bCiz();
}

// ── 3 · AĞLAR ─────────────────────────────────────────────────────────────
// Parça parça ve kare kare (bütçe 24 ms): tek seferde koşsa arayüz donardı.
// Üçgenler kartın önbelleğinde (s.ag) — hesap da onları kullanır.
function _mw3bAgKur(){
  var V = _mw3b, s = V.s, geo = s.sonuc._geo || [];
  if(!s.ag) s.ag = [];
  var q = V.kuyruk = { i: 0, j: 0, topla: null, B: null, yuz: 0, toplam: 0 };
  geo.forEach(function(g){ q.toplam += (g && g.yuzler) ? g.yuzler.length : 0; });
  function adim(){
    if(_mw3b !== V) return;
    var t0 = Date.now();
    while(q.i < geo.length && Date.now() - t0 < VE_MW_3B_BUTCE){
      var g = geo[q.i];
      if(!g || !g.yuzler || !g.yuzler.length){ q.i++; continue; }
      if(s.ag[q.i]){ _mw3bParcaEkle(q.i, s.ag[q.i]); q.yuz += g.yuzler.length; q.i++; continue; }
      if(!q.B) q.B = veStepUcgenBaglam(s.sonuc._model, VE_MNT_STP_UCGEN);
      if(!q.topla){ q.topla = veStepUcgenTopla(q.B, g.M, g.birim); q.j = 0; }
      while(q.j < g.yuzler.length && Date.now() - t0 < VE_MW_3B_BUTCE){ q.topla.ekle(g.yuzler[q.j]); q.j++; q.yuz++; }
      if(q.j >= g.yuzler.length){
        s.ag[q.i] = q.topla.bitir();
        q.topla = null;
        _mw3bParcaEkle(q.i, s.ag[q.i]);
        q.i++;
      }
    }
    var il = document.getElementById('ve-mw-3b-ilerleme');
    if(q.i < geo.length){
      if(il) il.textContent = 'Yüzler hazırlanıyor… ' + veSayi(q.yuz, 0) + ' / ' + veSayi(q.toplam, 0);
      V.kuyrukZaman = setTimeout(adim, 0);
      return;
    }
    q.B = null;
    V.kuyruk = null;
    if(il) il.textContent = '';
    V.kap.setAttribute('data-durum', 'hazir');
    V.grup.visible = true;
    _mw3bSigdir(V.kutu, _mw3bOrnekNoktalar());
    _mw3bSonucKur();
    _mw3bCiz();
  }
  // İlk dilim de ayrı görevde: açılışın görevi (bağlam, sahne, panel) ile tek
  // görevde 50 ms'yi aşıyordu (ölçüldü).
  V.kuyrukZaman = setTimeout(adim, 0);
}
function _mw3bParcaEkle(i, a){
  var V = _mw3b;
  if(!a || !a.ucgen || !a.ucgen.length) return;
  var g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(a.uc, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(a.normal, 3));
  g.setIndex(new THREE.BufferAttribute(a.ucgen, 1));
  g.computeBoundingSphere();
  var mat = new THREE.MeshStandardMaterial({ metalness: 0.05, roughness: 0.6, side: THREE.DoubleSide,
    polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
  var mesh = new THREE.Mesh(g, mat);
  mesh.userData.parca = i;
  var lg = new THREE.BufferGeometry();
  lg.setAttribute('position', new THREE.BufferAttribute(a.cizgi, 3));
  var cz = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ transparent: true }));
  V.grup.add(mesh); V.grup.add(cz);
  V.meshler[i] = mesh; V.cizgiler[i] = cz;
  var k = a.kutu;
  if(isFinite(k[0])){
    var b = new THREE.Box3(new THREE.Vector3(k[0], k[1], k[2]), new THREE.Vector3(k[3], k[4], k[5]));
    if(!V.kutu) V.kutu = b; else V.kutu.union(b);
  }
  _mw3bRenkle(i);
  _mw3bCiz();
}

// ── 4 · RENK VE SEÇİM ─────────────────────────────────────────────────────
function _mw3bJeton(ad, yedek){
  try { var v = getComputedStyle(document.documentElement).getPropertyValue(ad).trim(); return v || yedek; }
  catch(e){ return yedek; }
}
function _mw3bRenk(ad, yedek){
  try { return new THREE.Color(_mw3bJeton(ad, yedek)); } catch(e){ return new THREE.Color(yedek); }
}
// Seçili düğüm varken dışındaki parçalar SOLAR: seçimin hangi parçaları
// kapsadığı (bir alt montajın bütün parçaları) böyle okunur.
function _mw3bRenkle(tek){
  var V = _mw3b;
  if(!V || !V.scene) return;
  var s = V.s, secSet = null;
  if(V.secili >= 0){ secSet = {}; veMntWiz3bParcalar(s, V.secili).forEach(function(p){ secSet[p] = 1; }); }
  var bos = _mw3bRenk('--text-muted', '#676055').lerp(_mw3bRenk('--bg-secondary', '#faf8f4'), 0.4);
  var kenar = _mw3bRenk('--text-primary', '#26241f');
  var vurgu = _mw3bRenk('--accent-primary', '#a8502b');
  var fareBirimi = V.fare >= 0 ? veMntWiz3bBirim(s, V.fare) : -1;
  V.meshler.forEach(function(mesh, i){
    if(!mesh || (tek !== undefined && tek !== i)) return;
    var b = veMntWiz3bBirim(s, i), m = mesh.material;
    m.color.copy(b >= 0 ? _mw3bRenk(veMntWiz3bRolJeton(s.roller[b]), '#888888') : bos);
    var secik = secSet && secSet[i], soluk = secSet && !secik;
    var fare = V.fare === i || (fareBirimi >= 0 && fareBirimi === b);
    m.emissive.copy(secik ? vurgu : m.color).multiplyScalar(secik ? 0.28 : (fare ? 0.22 : 0));
    m.transparent = !!soluk; m.opacity = soluk ? 0.22 : 1; m.depthWrite = !soluk;
    m.needsUpdate = true;
    var cz = V.cizgiler[i];
    if(cz){ cz.material.color.copy(kenar); cz.material.opacity = soluk ? 0.06 : 0.32; }
  });
}
function veMntWiz3bSec(dugum){
  var V = _mw3b;
  if(!V) return false;
  V.secili = (dugum >= 0 && dugum < V.s.sonuc.agac.length) ? dugum : -1;
  _mw3bPanel(); _mw3bRenkle(); _mw3bCiz();
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
  if(alt) alt.innerHTML = veMntWiz3bAltHTML(V.s, V.secili);
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
        + ' title="' + _mwEsc(_mwAd(b.tip)) + (b.kaynak !== 'hacim' ? ' — ağ kapalı değil, kutunun merkezi' : '') + '">'
        + _mwEsc(b.ad) + '</button>';
    };
    if(gs.length){
      h += '<table class="ve-fw-tbl ve-fw-tbl-fixed ve-fw-3b-tbl ve-mw-3b-tbl" data-ve-3b-govdeler="1"><thead><tr>'
        + '<th>Gövde</th><th>CG<em>mm</em></th><th title="' + _mwEsc(VE_MW_STP_KUTLE_NOT) + '">Kütle<em>kg</em></th>'
        + '</tr></thead><tbody>';
      gs.forEach(function(b){
        var m = s.kutle[b.dugum];
        h += '<tr data-ve-3b-birim="' + b.dugum + '"' + (b.dugum === birimSec ? ' class="on"' : '')
          + (b.kaynak !== 'hacim' ? ' data-uyari="1"' : '') + '><td>' + ad(b) + '</td>'
          + '<td class="ve-fw-num">' + _mwStpKonum(b.konum) + '</td>'
          + '<td><input type="text" inputmode="decimal" class="ve-fw-inp" data-mw-stp-kutle="' + b.dugum + '"'
          + ' value="' + (m !== undefined ? _mwEsc(m) : '') + '" aria-label="Kütle — ' + _mwEsc(b.ad) + '"'
          + ' oninput="veMntWizStpKutle(' + b.dugum + ', this.value)"></td></tr>';
      });
      h += '</tbody></table>';
    }
    if(ts.length){
      h += '<table class="ve-fw-tbl ve-fw-tbl-fixed ve-fw-3b-tbl ve-mw-3b-tbl ve-mw-3b-tbl-takoz" data-ve-3b-takozlar="1"><thead><tr>'
        + '<th>Takoz</th><th>Konum<em>mm</em></th></tr></thead><tbody>';
      ts.forEach(function(b){
        h += '<tr data-ve-3b-birim="' + b.dugum + '"' + (b.dugum === birimSec ? ' class="on"' : '')
          + (b.kaynak !== 'hacim' ? ' data-uyari="1"' : '') + '><td>' + ad(b) + '</td>'
          + '<td class="ve-fw-num">' + _mwStpKonum(b.konum) + '</td></tr>';
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
function veMntWiz3bAltHTML(s, secili){
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
  } else h += '<span class="ve-fw-3b-dizi-ad ve-fw-dim">Seçili parça yok. ' + veYon('Modelde bir parça seçin.') + '</span>';
  h += '</div>';
  var coz = s.coz, rolEngel = typeof _mwStpRolDenetim === 'function' ? _mwStpRolDenetim(s) : [];
  h += '<div class="ve-fw-3b-eylem" data-ve-3b-hesapbar="1">'
    + '<button type="button" class="ve-fw-3b-hap" id="ve-mw-3b-hesapla"' + (rolEngel.length ? ' disabled title="' + _mwEsc(rolEngel[0]) + '"' : '')
    + ' onclick="veMntWiz3bHesapla()">' + _mwIkon('play') + ' ' + (coz ? 'Yeniden hesapla' : 'Konumları hesapla') + '</button>';
  if(coz && coz.ok)
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
function _mw3bSonucKur(){
  var V = _mw3b;
  if(!V || !V.scene) return;
  if(V.sonucGrubu){
    V.scene.remove(V.sonucGrubu);
    V.sonucGrubu.traverse(function(o){ if(o.geometry) o.geometry.dispose(); if(o.material) o.material.dispose(); });
    V.sonucGrubu = null;
  }
  var coz = V.s.coz;
  if(!coz || !coz.ok) return;
  var G = new THREE.Group();
  G.userData.nokta = 0;
  var R = V.kutu ? V.kutu.getSize(new THREE.Vector3()).length() : 1000;
  var renk = _mw3bRenk('--text-heading', '#1b1a17');
  coz.birimler.forEach(function(b){
    if(!b.konum) return;
    var takoz = b.tip === 'mnt-mount';
    var geo = takoz ? new THREE.SphereGeometry(Math.max(2, R * 0.006), 16, 12)
                    : new THREE.OctahedronGeometry(Math.max(3, R * 0.009));
    var m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: renk, depthTest: false, transparent: true, opacity: 0.92 }));
    m.position.set(b.konum[0], b.konum[1], b.konum[2]);
    m.renderOrder = 10;
    G.add(m);
    G.userData.nokta++;
  });
  V.sonucGrubu = G;
  V.scene.add(G);
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
  ag.forEach(function(a){ if(a && a.uc) top += a.uc.length / 3; });
  var adim = Math.max(1, Math.floor(top / 3000));
  ag.forEach(function(a){
    if(!a || !a.uc) return;
    for(var i = 0; i < a.uc.length / 3; i += adim) out.push(new THREE.Vector3(a.uc[i * 3], a.uc[i * 3 + 1], a.uc[i * 3 + 2]));
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
function _mw3bSigdir(kutu, noktalar){
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
  _mw3bCiz();
}
function veMntWiz3bSigdir(){
  var V = _mw3b;
  if(!V || !V.kutu) return false;
  V.ctrl.theta = VE_MW_3B_ACILIS.theta; V.ctrl.phi = VE_MW_3B_ACILIS.phi;
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
      V.kap.classList.add('surukle');
      if(bas.kay) _mw3bKaydir(dx, dy);
      else { V.ctrl.theta -= dx * 0.008; V.ctrl.phi = Math.max(-1.5, Math.min(1.5, V.ctrl.phi + dy * 0.008)); }
      bas.x = e.clientX; bas.y = e.clientY;
      _mw3bKamera(); _mw3bCiz();
      return;
    }
    _mw3bFare(e);
  });
  dinle(cv, 'pointerup', function(e){
    var b = bas;
    bas = null;
    V.kap.classList.remove('surukle');
    if(b && !b.oynadi && b.tus === 0){
      var i = _mw3bIsabet(e.clientX, e.clientY);
      veMntWiz3bSec(i >= 0 ? V.s.sonuc.parcalar[i].dugum : -1);
    }
  });
  dinle(cv, 'pointerleave', function(){ if(V.fare >= 0){ V.fare = -1; _mw3bIpucu(null); _mw3bRenkle(); _mw3bCiz(); } });
  dinle(cv, 'wheel', function(e){
    e.preventDefault();
    V.ctrl.r = Math.max(1, Math.min(1e6, V.ctrl.r * Math.exp(e.deltaY * 0.0012)));
    _mw3bKamera(); _mw3bCiz();
  }, { passive: false });
}
function _mw3bIsabet(cx, cy){
  var V = _mw3b;
  if(!V || !V.camera || !V.grup.visible) return -1;
  var r = V.renderer.domElement.getBoundingClientRect();
  var nd = new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
  V.ray.setFromCamera(nd, V.camera);
  var hit = V.ray.intersectObjects(V.meshler.filter(Boolean), false);
  return hit.length ? hit[0].object.userData.parca : -1;
}
function _mw3bFare(e){
  var V = _mw3b;
  if(V.fareIstek){ V.fareSon = e; return; }
  V.fareSon = e;
  V.fareIstek = requestAnimationFrame(function(){
    V.fareIstek = 0;
    if(_mw3b !== V) return;
    var ev = V.fareSon, i = _mw3bIsabet(ev.clientX, ev.clientY);
    if(i !== V.fare){ V.fare = i; _mw3bRenkle(); _mw3bCiz(); }
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
  _mw3bCiz();
}
function _mw3bCiz(){
  var V = _mw3b;
  if(!V || !V.renderer || V.cizIstek) return;
  V.cizIstek = requestAnimationFrame(function(){
    V.cizIstek = 0;
    if(_mw3b !== V) return;
    V.renderer.render(V.scene, V.camera);
    _mw3bEtiketle();
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
      + '<b>' + _mwEsc(q.b.ad) + '</b><span>' + (q.b.tip === 'mnt-mount' ? '' : 'CG ') + _mwStpKonum(q.b.konum) + '</span></div>';
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
function veMntWiz3bDurum(){
  var V = _mw3b;
  if(!V) return null;
  return { durum: V.kap.getAttribute('data-durum'), parca: V.meshler.filter(Boolean).length,
    etiket: document.querySelectorAll('#ve-mw-3b-etiket [data-ve-3b-etiket]').length,
    nokta: V.sonucGrubu ? V.sonucGrubu.userData.nokta : 0, secili: V.secili, fare: V.fare };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    VE_MW_3B_ROL_RENK: VE_MW_3B_ROL_RENK, VE_MW_3B_ACILIS: VE_MW_3B_ACILIS,
    veMntWiz3bBirim: veMntWiz3bBirim, veMntWiz3bYol: veMntWiz3bYol, veMntWiz3bParcalar: veMntWiz3bParcalar,
    veMntWiz3bRolJeton: veMntWiz3bRolJeton, veMntWiz3bPanelHTML: veMntWiz3bPanelHTML,
    veMntWiz3bAltHTML: veMntWiz3bAltHTML, _mw3bSeciliBirim: _mw3bSeciliBirim, veMntWiz3bTazele: veMntWiz3bTazele
  };
}
