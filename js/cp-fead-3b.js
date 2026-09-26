// ============================================================================
//  FEAD SİHİRBAZI — STEP'İN 3B GÖRÜNTÜLEYİCİSİ
// ============================================================================
// Kullanıcı akışı (2026-09-26): STEP'in tamamı aktarılır → parçalar 3B'de ELLE
// seçilir ("neyin ne olduğunu") → bir düğmeyle çap ve merkezler çıkar. Bu
// pencere o ikinci adımın yüzeyidir:
//   · parça başına bir ağ (js/step-ucgen.js — YALNIZ görüntü), role göre renk
//   · tıklanan parça seçilir; yan panelde yolu (kök › alt montaj › parça) ve
//     rol düğmeleri. Rol bir ALT MONTAJA da verilir: yolda üst düğüme tıklanır
//     (tedarikçi gergiyi kol · gövde · kasnak diye ayrı parçalarla verir)
//   · "Çap ve merkezleri hesapla" kartın AYNI işlevidir (veFeadWizStpHesapla);
//     sonuç 3B'de halka olarak, yan panelde çap ve merkezlerin tablosu olarak görünür
//
// DURUM KARTLA ORTAK (_fwStp, veFeadWizStp() ile okunur): rol burada da
// kartta da aynı diziye yazılır.
// Tazeleme veFeadWizRender'ın sonundan geçer — pencerenin ayrı bir kopyası
// olsaydı kartla sessizce ayrışırdı.
//
// Sihirbazın İÇİNDE bir kaplama (#ve-fw-3b), açı seçicisi ve motor künyesiyle
// aynı gerekçe: sihirbaz kapanınca o da gider, ayrı z düzeni yok. THREE yoksa
// (Node testi) açılmaz. Çizim İSTEK ÜZERİNE: sahne durağan, sürekli döngü yok.
// ============================================================================

var _fw3b = null;

// Rol → tema jetonu. TEK KAYNAK: 3B malzeme de paneldeki renk noktası da buradan.
var VE_FW_3B_ROL_RENK = {
  'fead-crank': '--accent-primary', 'fead-tensioner': '--accent-warning', 'fead-idler': '--seri-1',
  'fead-alternator': '--seri-2', 'fead-ac': '--seri-3', 'fead-waterpump': '--seri-4',
  'fead-ps': '--accent-success', 'fead-aircomp': '--accent-danger', 'fead-fan': '--ink-accent'
};
// Görüntüleyicinin iş bütçesi: bir karede en çok bu kadar üçgenleme (ms)
var VE_FW_3B_BUTCE = 24;

// ── 1 · SAF YARDIMCILAR (testli) ──────────────────────────────────────────
// Parçanın ait olduğu birim: rollü ata (parçanın kendisi dâhil) — -1 yoksa. Bir
// yolda en çok BİR rol var: kartın rol işlevi ata ve torun rollerini düşürür.
function veFeadWiz3bBirim(s, parca){
  if(!s || !s.sonuc || !s.sonuc.parcalar[parca]) return -1;
  for(var a = s.sonuc.parcalar[parca].dugum; a >= 0; a = s.sonuc.agac[a].ebeveyn) if(s.roller[a]) return a;
  return -1;
}
// Kökten düğüme yol (düğüm indisleri)
function veFeadWiz3bYol(s, dugum){
  var yol = [];
  for(var a = dugum; a >= 0; a = s.sonuc.agac[a].ebeveyn) yol.unshift(a);
  return yol;
}
// Düğümün altındaki parçalar
function veFeadWiz3bParcalar(s, dugum){
  var d = s && s.sonuc && s.sonuc.agac[dugum];
  return d ? d.parcalar.slice() : [];
}
function veFeadWiz3bRolJeton(tip){ return VE_FW_3B_ROL_RENK[tip] || '--text-muted'; }

// ── 2 · AÇ / KAPAT ────────────────────────────────────────────────────────
function veFeadWiz3bAcik(){ return !!_fw3b; }
function veFeadWiz3bAc(){
  if(typeof document === 'undefined' || typeof THREE === 'undefined') return false;
  var s = typeof veFeadWizStp === 'function' ? veFeadWizStp() : null;
  if(!s || s.durum !== 'hazir' || !s.sonuc || !s.sonuc._model) return false;
  var ov = document.getElementById('ve-fw-3b');
  if(!ov) return false;
  if(_fw3b) veFeadWiz3bKapat();
  ov.style.display = 'flex';
  // Başlık pencere ailesinin ortak bileşeni: kaplama sihirbazın başlığını da
  // örttüğü için pencerenin başlığı artık bu (bant, yazı, 22 px çizgi kapat).
  ov.innerHTML = '<div class="ve-settings-header ve-fw-3b-bas">'
    + '<span><span class="mf-ico mf-ico-box"></span> 3B görüntüleyici <span class="ve-fw-dim" id="ve-fw-3b-dosya"></span></span>'
    + '<button type="button" class="ve-fw-mini ve-fw-3b-metin" id="ve-fw-3b-onden" onclick="veFeadWiz3bOnden()" disabled'
      + ' title="Kayış düzlemine önden bak — hesaptan sonra">Önden bak</button>'
    + '<button type="button" class="ve-fw-mini ve-fw-3b-metin" onclick="veFeadWiz3bSigdir()" title="Bütün montajı sığdır">Sığdır</button>'
    + '<button type="button" class="ve-settings-close" onclick="veFeadWiz3bKapat()" title="Kapat (Esc)" aria-label="Kapat">'
      + '<span class="mf-ico mf-ico-x"></span></button>'
    + '</div><div class="ve-fw-3b-govde">'
    + '<div class="ve-fw-3b-tuval" id="ve-fw-3b-tuval" data-durum="kuruluyor">'
      + '<div class="ve-fw-3b-ilerleme" id="ve-fw-3b-ilerleme"></div>'
      + '<div class="ve-fw-3b-ipucu" id="ve-fw-3b-ipucu" hidden></div></div>'
    + '<div class="ve-fw-3b-yan" id="ve-fw-3b-yan"></div></div>';
  var kap = document.getElementById('ve-fw-3b-tuval');
  var V = { kap: kap, s: s, meshler: [], cizgiler: [], sokucu: [], secili: -1, fare: -1, cizIstek: 0,
            kutu: null, elle: false, sonucGrubu: null, kuyruk: null };
  var w = Math.max(1, kap.clientWidth), h = Math.max(1, kap.clientHeight);
  try {
    V.renderer = new THREE.WebGLRenderer({ antialias: true });
  } catch(e){
    ov.style.display = 'flex';
    kap.setAttribute('data-durum', 'hata');
    kap.insertAdjacentHTML('afterbegin', '<p class="ve-fw-3b-yok">3B çizim bu tarayıcıda açılamadı (WebGL yok). '
      + 'Rolleri kartın tablosundan verebilirsiniz.</p>');
    _fw3b = V;
    _fw3bPanel();
    return true;
  }
  V.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  V.renderer.setSize(w, h, false);
  kap.insertBefore(V.renderer.domElement, kap.firstChild);
  V.scene = new THREE.Scene();
  V.scene.background = _fw3bRenk('--bg-secondary', '#faf8f4');
  V.camera = new THREE.PerspectiveCamera(35, w / h, 0.5, 100000);
  V.camera.up.set(0, 0, 1);
  V.scene.add(new THREE.HemisphereLight(0xffffff, 0x807868, 0.75));
  V.isik = new THREE.DirectionalLight(0xffffff, 0.75);
  V.scene.add(V.isik); V.scene.add(V.isik.target);
  V.grup = new THREE.Group();
  V.scene.add(V.grup);
  V.ctrl = { theta: -Math.PI * 0.6, phi: Math.PI / 5, r: 1000, hedef: new THREE.Vector3() };
  V.ray = new THREE.Raycaster();
  _fw3b = V;
  _fw3bDinle(V);
  if(typeof ResizeObserver !== 'undefined'){
    try { V.ro = new ResizeObserver(function(){ _fw3bBoyut(); }); V.ro.observe(kap); } catch(e2){}
  }
  var dosya = document.getElementById('ve-fw-3b-dosya');
  if(dosya) dosya.textContent = s.dosya + ' · ' + s.sonuc.parcalar.length + ' parça';
  _fw3bPanel();
  _fw3bAgKur();
  return true;
}
function veFeadWiz3bKapat(){
  var V = _fw3b;
  _fw3b = null;
  if(typeof document !== 'undefined'){
    var ov = document.getElementById('ve-fw-3b');
    if(ov){ ov.style.display = 'none'; ov.innerHTML = ''; }
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

// Sihirbaz her çizildiğinde (veFeadWizRender) — rol, hesap, bakış, aktarım
function veFeadWiz3bTazele(){
  var V = _fw3b;
  if(!V) return;
  var s = typeof veFeadWizStp === 'function' ? veFeadWizStp() : null;
  // Dosya karttan kaldırıldı ya da başka bir dosya okundu: pencere o dosyanındı
  if(!s || s !== V.s || s.durum !== 'hazir'){ veFeadWiz3bKapat(); return; }
  if(V.secili >= s.sonuc.agac.length) V.secili = -1;
  _fw3bPanel();
  _fw3bRenkle();
  _fw3bSonucKur();
  _fw3bCiz();
}

// ── 3 · AĞLAR ─────────────────────────────────────────────────────────────
// Parça parça ve kare kare: dosyanızda bütün montaj 1,5 sn — tek seferde
// koşsa arayüz o süre donardı. Üçgenler dosyanın kartında saklanır (s.ag):
// pencere yeniden açılınca üçgenleme tekrarlanmaz.
function _fw3bAgKur(){
  var V = _fw3b, s = V.s, geo = s.sonuc._geo || [];
  if(!s.ag) s.ag = [];
  var q = V.kuyruk = { i: 0, j: 0, topla: null, B: null, yuz: 0, toplam: 0 };
  geo.forEach(function(g){ q.toplam += g.yuzler.length; });
  function adim(){
    if(_fw3b !== V) return;
    var t0 = Date.now();
    while(q.i < geo.length && Date.now() - t0 < VE_FW_3B_BUTCE){
      if(s.ag[q.i]){ _fw3bParcaEkle(q.i, s.ag[q.i]); q.yuz += geo[q.i].yuzler.length; q.i++; continue; }
      var g = geo[q.i];
      if(!q.B) q.B = veStepUcgenBaglam(s.sonuc._model);
      if(!q.topla){ q.topla = veStepUcgenTopla(q.B, g.M, g.birim); q.j = 0; }
      while(q.j < g.yuzler.length && Date.now() - t0 < VE_FW_3B_BUTCE){ q.topla.ekle(g.yuzler[q.j]); q.j++; q.yuz++; }
      if(q.j >= g.yuzler.length){
        s.ag[q.i] = q.topla.bitir();
        q.topla = null;
        _fw3bParcaEkle(q.i, s.ag[q.i]);
        q.i++;
      }
    }
    var il = document.getElementById('ve-fw-3b-ilerleme');
    if(q.i < geo.length){
      if(il) il.textContent = 'Yüzler hazırlanıyor… ' + q.yuz.toLocaleString('tr-TR') + ' / ' + q.toplam.toLocaleString('tr-TR');
      V.kuyrukZaman = setTimeout(adim, 0);
      return;
    }
    q.B = null;
    V.kuyruk = null;
    if(il) il.textContent = '';
    V.kap.setAttribute('data-durum', 'hazir');
    if(!V.elle) _fw3bSigdir(V.kutu, _fw3bOrnekNoktalar());
    _fw3bSonucKur();
    _fw3bCiz();
  }
  adim();
}
function _fw3bParcaEkle(i, a){
  var V = _fw3b;
  var g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(a.uc, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(a.normal, 3));
  g.setIndex(new THREE.BufferAttribute(a.ucgen, 1));
  g.computeBoundingSphere();
  // Çift yüz: sarım yüzün kendi normaline uyar (üçgenleyicinin sözü); açık
  // kabuklu (yüzey modeli) parçaların içi de görünsün.
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
    if(!V.kutu) V.kutu = new THREE.Box3(new THREE.Vector3(k[0], k[1], k[2]), new THREE.Vector3(k[3], k[4], k[5]));
    else V.kutu.union(new THREE.Box3(new THREE.Vector3(k[0], k[1], k[2]), new THREE.Vector3(k[3], k[4], k[5])));
    if(!V.elle && !V.ilkSigdir){ V.ilkSigdir = true; _fw3bSigdir(V.kutu); }
  }
  _fw3bRenkle(i);
  _fw3bCiz();
}

// ── 4 · RENK VE SEÇİM ─────────────────────────────────────────────────────
function _fw3bJeton(ad, yedek){
  try { var v = getComputedStyle(document.documentElement).getPropertyValue(ad).trim(); return v || yedek; }
  catch(e){ return yedek; }
}
function _fw3bRenk(ad, yedek){
  try { return new THREE.Color(_fw3bJeton(ad, yedek)); } catch(e){ return new THREE.Color(yedek); }
}
// Seçili düğüm varken dışındaki parçalar SOLAR: seçimin hangi parçaları
// kapsadığı (bir alt montajın bütün parçaları) böyle okunur.
function _fw3bRenkle(tek){
  var V = _fw3b;
  if(!V || !V.scene) return;
  var s = V.s, secSet = null;
  if(V.secili >= 0){ secSet = {}; veFeadWiz3bParcalar(s, V.secili).forEach(function(p){ secSet[p] = 1; }); }
  // Rolsüz parça: soluk metin tonunun zeminle karışımı — rol renkleri onun
  // üstünde öne çıksın; iki temada da zeminden ayrışır
  var bos = _fw3bRenk('--text-muted', '#676055').lerp(_fw3bRenk('--bg-secondary', '#faf8f4'), 0.4);
  var kenar = _fw3bRenk('--text-primary', '#26241f');
  var vurgu = _fw3bRenk('--accent-primary', '#a8502b');
  var fareBirimi = V.fare >= 0 ? veFeadWiz3bBirim(s, V.fare) : -1;
  V.meshler.forEach(function(mesh, i){
    if(!mesh || (tek !== undefined && tek !== i)) return;
    var b = veFeadWiz3bBirim(s, i), m = mesh.material;
    m.color.copy(b >= 0 ? _fw3bRenk(veFeadWiz3bRolJeton(s.roller[b]), '#888888') : bos);
    var secik = secSet && secSet[i], soluk = secSet && !secik;
    var fare = V.fare === i || (fareBirimi >= 0 && fareBirimi === b);
    m.emissive.copy(secik ? vurgu : m.color).multiplyScalar(secik ? 0.28 : (fare ? 0.22 : 0));
    m.transparent = !!soluk; m.opacity = soluk ? 0.22 : 1; m.depthWrite = !soluk;
    m.needsUpdate = true;
    var cz = V.cizgiler[i];
    if(cz){ cz.material.color.copy(kenar); cz.material.opacity = soluk ? 0.06 : 0.32; }
  });
}
function veFeadWiz3bSec(dugum){
  var V = _fw3b;
  if(!V) return false;
  V.secili = (dugum >= 0 && dugum < V.s.sonuc.agac.length) ? dugum : -1;
  _fw3bPanel(); _fw3bRenkle(); _fw3bCiz();
  return true;
}
function veFeadWiz3bRol(tip){
  var V = _fw3b;
  if(!V || V.secili < 0 || typeof veFeadWizStpRol !== 'function') return false;
  veFeadWizStpRol(V.secili, tip || '');       // kartın işlevi: ata/torun rolü düşer, sonuç düşer
  return true;
}

// ── 5 · YAN PANEL ─────────────────────────────────────────────────────────
function _fw3bPanel(){
  var V = _fw3b;
  var yan = typeof document !== 'undefined' && document.getElementById('ve-fw-3b-yan');
  if(!V || !yan) return;
  yan.innerHTML = veFeadWiz3bPanelHTML(V.s, V.secili);
  var od = document.getElementById('ve-fw-3b-onden');
  if(od) od.disabled = !(V.s.coz && V.s.coz.ok);
}
// Saf: durum + seçili düğüm → panel HTML'i (testli)
function veFeadWiz3bPanelHTML(s, secili){
  var so = s.sonuc, h = '';
  var tipler = VE_FW_PULLEY_TYPES.concat(['fead-tensioner']);
  var renk = function(tip){ return '<span class="ve-fw-3b-renk" style="--renk:var(' + veFeadWiz3bRolJeton(tip) + ')"></span>'; };
  // ── SEÇİLİ ──
  h += '<section class="ve-fw-3b-bolum"><h4>Seçili</h4>';
  if(secili < 0){
    h += '<p class="ve-fw-dim">Modelde bir parçaya tıklayın.</p>';
  } else {
    var yol = veFeadWiz3bYol(s, secili), kok = so.agac[yol[0]];
    var kokGizli = kok.ebeveyn < 0 && kok.cocuklar.length && yol.length > 1;
    h += '<div class="ve-fw-3b-yol">';
    yol.forEach(function(d, k){
      if(k === 0 && kokGizli){ h += '<span class="ve-fw-dim" title="Bütün montaja rol verilmez">' + _fwEsc(so.agac[d].ad) + '</span>'; }
      else if(d === secili) h += '<b data-ve-3b-yol="' + d + '">' + _fwEsc(so.agac[d].ad) + '</b>';
      else h += '<button type="button" class="ve-fw-3b-yolb" data-ve-3b-yol="' + d + '" onclick="veFeadWiz3bSec(' + d + ')">'
        + _fwEsc(so.agac[d].ad) + '</button>';
      if(k < yol.length - 1) h += '<span class="ve-fw-dim">›</span>';
    });
    h += '</div>';
    var ata = -1;
    for(var e = so.agac[secili].ebeveyn; e >= 0; e = so.agac[e].ebeveyn) if(s.roller[e]){ ata = e; break; }
    var n = so.agac[secili].parcalar.length;
    h += '<p class="ve-fw-dim">' + n + ' parça' + (ata >= 0 ? ' · ' + _fwEsc(so.agac[ata].ad) + ' biriminin içinde ('
      + _fwEsc(_fwStpRolAd(s.roller[ata])) + ') — rol verirseniz birimin rolü kalkar' : '') + '</p>';
    var rol = s.roller[secili] || '';
    h += '<div class="ve-fw-3b-roller" role="group" aria-label="Rol">'
      + '<button type="button" class="ve-fw-3b-rol" data-ve-3b-rol="" aria-pressed="' + (rol ? 'false' : 'true')
        + '" onclick="veFeadWiz3bRol(\'\')">Rol yok</button>';
    tipler.forEach(function(t){
      h += '<button type="button" class="ve-fw-3b-rol" data-ve-3b-rol="' + t + '" aria-pressed="' + (rol === t ? 'true' : 'false')
        + '" onclick="veFeadWiz3bRol(\'' + t + '\')">' + renk(t) + _fwEsc(_fwStpRolAd(t)) + '</button>';
    });
    h += '</div>';
  }
  h += '</section>';
  // ── ROL VERİLENLER ──
  var atanan = so.agac.filter(function(d){ return !!s.roller[d.i]; });
  h += '<section class="ve-fw-3b-bolum"><h4>Rol verilenler <span class="ve-fw-dim">' + atanan.length + '</span></h4>';
  if(!atanan.length) h += '<p class="ve-fw-dim">Henüz yok.</p>';
  else {
    h += '<ul class="ve-fw-3b-atanan">';
    atanan.forEach(function(d){
      h += '<li' + (d.i === secili ? ' class="on"' : '') + '>' + renk(s.roller[d.i])
        + '<button type="button" class="ve-fw-3b-yolb" onclick="veFeadWiz3bSec(' + d.i + ')" title="' + _fwEsc(d.ornek || d.id || '') + '">'
        + _fwEsc(d.ad) + '</button><span class="ve-fw-dim">' + _fwEsc(_fwStpRolAd(s.roller[d.i])) + '</span>'
        + '<button type="button" class="ve-fw-mini" title="Rolü kaldır" onclick="veFeadWizStpRol(' + d.i + ', \'\')">✕</button></li>';
    });
    h += '</ul>';
  }
  h += '</section>';
  // ── HESAP ──
  var coz = s.coz, rolEngel = typeof _fwStpRolDenetim === 'function' ? _fwStpRolDenetim(s) : [];
  h += '<section class="ve-fw-3b-bolum"><h4>Hesap</h4><div class="ve-fw-rowbtns">'
    + '<button type="button" class="ve-fw-btn" id="ve-fw-3b-hesapla"' + (rolEngel.length ? ' disabled' : '')
    + ' onclick="veFeadWiz3bHesapla()">' + (coz ? 'Yeniden hesapla' : 'Çap ve merkezleri hesapla') + '</button></div>'
    + '<p class="ve-fw-dim">' + (coz ? (coz.ok ? '✓ ' + coz.kasnaklar.length + ' kasnak' + (coz.duzlem ? ' · düzlem sapması '
      + _fwFmt(coz.duzlem.yayilim, 3) + ' mm' : '') : '✗ kasnak bulunamadı') : 'hesaplanmadı') + '</p>';
  var sorun = rolEngel.filter(function(m){ return m !== 'Hiçbir parçaya rol verilmedi.'; })
    .concat(coz ? coz.hatalar.concat(coz.uyarilar) : []);
  if(sorun.length){
    h += '<div class="ve-fw-issues">';
    sorun.forEach(function(m){ h += '<div class="ve-fw-issue ve-fw-issue-warn">! ' + _fwEsc(m) + '</div>'; });
    h += '</div>';
  }
  if(coz && coz.ok){
    // Çizimin kendisi 3B'nin önden görünümü; panelde onun SAYILARI (kartın
    // 2B çizimi 320 px'lik panelde okunmayacak kadar küçülüyordu)
    var iki = veFeadStp2B(coz, _fwStpSecim(s)), kol = {};
    coz.gergiler.forEach(function(g){ kol[g.kasnak] = g.kolBoy; });
    h += '<div class="ve-fw-spinbox">'
      + '<button type="button" class="ve-fw-spin' + (s.ayna ? '' : ' ve-fw-spin-on') + '" onclick="veFeadWizStpAyna(false)">Önden</button>'
      + '<button type="button" class="ve-fw-spin' + (s.ayna ? ' ve-fw-spin-on' : '') + '" onclick="veFeadWizStpAyna(true)">Arkadan</button></div>'
      + '<table class="ve-fw-tbl ve-fw-3b-tbl"><thead><tr><th>Kasnak</th><th>Ø [mm]</th><th>X</th><th>Y</th></tr></thead><tbody>';
    coz.kasnaklar.forEach(function(k, i){
      h += '<tr data-ve-3b-kasnak="' + i + '"><td>' + renk(k.tip) + _fwEsc(_fwStpRolAd(k.tip))
        + (kol[i] !== undefined ? ' <span class="ve-fw-dim">· kol ' + _fwFmt(kol[i], 1) + '</span>' : '') + '</td>'
        + '<td class="ve-fw-num">' + _fwFmt(k.od, 1) + '</td><td class="ve-fw-num">' + _fwFmt(iki.kasnaklar[i].x, 1)
        + '</td><td class="ve-fw-num">' + _fwFmt(iki.kasnaklar[i].y, 1) + '</td></tr>';
    });
    h += '</tbody></table>'
      + '<div class="ve-fw-rowbtns"><button type="button" class="ve-fw-btn" id="ve-fw-3b-aktar" onclick="veFeadWiz3bAktar()">'
      + (s.aktarim ? 'Yeniden aktar' : 'Sihirbaza aktar') + '</button></div>';
  }
  return h + '</section>';
}
// Hesap kartın işlevidir; başarılıysa seçim kalkar — seçim öteki parçaları
// soldururdu ve sonuç (halkalar) bütün kasnaklarda okunur olmalı
function veFeadWiz3bHesapla(){
  if(typeof veFeadWizStpHesapla !== 'function') return null;
  var V = _fw3b;
  if(V) V.secili = -1;
  var c = veFeadWizStpHesapla();
  return c;
}
// Aktarım kartın işlevidir; başarılıysa pencere kapanır — sıradaki iş
// sihirbazın adımlarında
function veFeadWiz3bAktar(){
  if(typeof veFeadWizStpAktar !== 'function') return null;
  var k = veFeadWizStpAktar();
  if(k) veFeadWiz3bKapat();
  return k;
}

// ── 6 · HESAP SONUCU 3B'DE ────────────────────────────────────────────────
// Kasnak başına dış çap halkası, gergide pivot ve kol — başlık tonunda: parça
// zaten rol renginde, halka o renkte çizilince içinde kayboluyordu. Derinlik
// sınaması KAPALI: halka kasnak yüzeyinin tam üstünde duruyor ve yüzeyin
// içinde kaybolmasın diye her zaman üstte çizilir.
function _fw3bSonucKur(){
  var V = _fw3b;
  if(!V || !V.scene) return;
  if(V.sonucGrubu){
    V.scene.remove(V.sonucGrubu);
    V.sonucGrubu.traverse(function(o){ if(o.geometry) o.geometry.dispose(); if(o.material) o.material.dispose(); });
    V.sonucGrubu = null;
  }
  var coz = V.s.coz;
  if(!coz || !coz.ok) return;
  var G = new THREE.Group(), z = new THREE.Vector3(0, 0, 1);
  G.userData.halka = 0;
  coz.kasnaklar.forEach(function(k){
    var r = k.od / 2;
    var geo = new THREE.TorusGeometry(r, Math.max(0.35, r * 0.012), 6, 96);
    var mat = new THREE.MeshBasicMaterial({ color: _fw3bRenk('--text-heading', '#1b1a17'), depthTest: false, transparent: true, opacity: 0.9 });
    var m = new THREE.Mesh(geo, mat);
    m.position.set(k.merkez[0], k.merkez[1], k.merkez[2]);
    m.quaternion.setFromUnitVectors(z, new THREE.Vector3(k.eksen[0], k.eksen[1], k.eksen[2]).normalize());
    m.renderOrder = 10;
    G.add(m);
    G.userData.halka++;
  });
  coz.gergiler.forEach(function(g){
    var k = coz.kasnaklar[g.kasnak], renk = _fw3bRenk('--text-heading', '#1b1a17');
    var cg = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(g.pivot[0], g.pivot[1], g.pivot[2]),
      new THREE.Vector3(k.merkez[0], k.merkez[1], k.merkez[2])]);
    var cizgi = new THREE.Line(cg, new THREE.LineBasicMaterial({ color: renk, depthTest: false, transparent: true }));
    cizgi.renderOrder = 10;
    var top = new THREE.Mesh(new THREE.SphereGeometry(Math.max(1.5, k.od * 0.03), 16, 12),
      new THREE.MeshBasicMaterial({ color: renk, depthTest: false, transparent: true }));
    top.position.set(g.pivot[0], g.pivot[1], g.pivot[2]);
    top.renderOrder = 10;
    G.add(cizgi); G.add(top);
  });
  V.sonucGrubu = G;
  V.scene.add(G);
}

// ── 7 · KAMERA ────────────────────────────────────────────────────────────
function _fw3bKamera(){
  var V = _fw3b, c = V.ctrl, cp = Math.cos(c.phi);
  V.camera.position.set(c.hedef.x + c.r * cp * Math.cos(c.theta), c.hedef.y + c.r * cp * Math.sin(c.theta), c.hedef.z + c.r * Math.sin(c.phi));
  if(V.yukari) V.camera.up.copy(V.yukari); else V.camera.up.set(0, 0, 1);
  V.camera.lookAt(c.hedef);
  V.isik.position.copy(V.camera.position);
  V.isik.target.position.copy(c.hedef);
  V.camera.near = Math.max(0.1, c.r / 500); V.camera.far = c.r * 50;
  V.camera.updateProjectionMatrix();
}
// Montajın KENDİ noktaları (parça başına örneklenmiş köşeler) ekranın %85'ine
// oturana kadar; hedef izdüşümün ortasına kayar. Eksene hizalı kutunun
// köşeleriyle sığdırmak eğik bakışta modeli tuvalin üçte birine küçültüyordu
// (ölçüldü: kutu %85, model %29).
function _fw3bOrnekNoktalar(){
  var V = _fw3b, out = [], ag = V.s.ag || [], top = 0;
  ag.forEach(function(a){ if(a) top += a.uc.length / 3; });
  var adim = Math.max(1, Math.floor(top / 3000));
  ag.forEach(function(a){
    if(!a) return;
    for(var i = 0; i < a.uc.length / 3; i += adim) out.push(new THREE.Vector3(a.uc[i * 3], a.uc[i * 3 + 1], a.uc[i * 3 + 2]));
  });
  return out;
}
function _fw3bSigdir(kutu, noktalar){
  var V = _fw3b;
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
    _fw3bKamera();
    V.camera.updateMatrixWorld();
    var x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    pts.forEach(function(q){
      var p = q.clone().project(V.camera);
      if(p.x < x0) x0 = p.x; if(p.x > x1) x1 = p.x; if(p.y < y0) y0 = p.y; if(p.y > y1) y1 = p.y;
    });
    if(!isFinite(x0)) break;
    // İzdüşümün ortasını hedefe al (ekran düzleminde kaydır), sonra ölçekle
    var h = V.kap.clientHeight || 1, w = V.kap.clientWidth || 1;
    _fw3bKaydir(-(x0 + x1) / 2 * w / 2, (y0 + y1) / 2 * h / 2);
    var en = Math.max((x1 - x0) / 2, (y1 - y0) / 2);
    if(!(en > 0)) break;
    V.ctrl.r *= Math.max(0.5, Math.min(2, en / 0.85));
  }
  _fw3bKamera();
  _fw3bCiz();
}
function veFeadWiz3bSigdir(){
  var V = _fw3b;
  if(!V || !V.kutu) return false;
  V.yukari = null;
  _fw3bSigdir(V.kutu, _fw3bOrnekNoktalar());
  return true;
}
// Kayış düzlemine önden: kamera 2B çizimle AYNI eksenlerde (sağ · yukarı ·
// bakış yönü veFeadStp2B'den) — 3B ile kartın 2B çizimi aynı resmi gösterir.
function veFeadWiz3bOnden(){
  var V = _fw3b;
  if(!V || !V.camera || !V.s.coz || !V.s.coz.ok || typeof veFeadStp2B !== 'function') return false;
  var iki = veFeadStp2B(V.s.coz, _fwStpSecim(V.s));
  var kutu = new THREE.Box3();
  V.s.coz.kasnaklar.forEach(function(k){
    var r = k.od / 2;
    kutu.expandByPoint(new THREE.Vector3(k.merkez[0] - r, k.merkez[1] - r, k.merkez[2] - r));
    kutu.expandByPoint(new THREE.Vector3(k.merkez[0] + r, k.merkez[1] + r, k.merkez[2] + r));
  });
  var m = kutu.getCenter(new THREE.Vector3()), R = kutu.getSize(new THREE.Vector3()).length() / 2;
  var d = new THREE.Vector3(iki.d[0], iki.d[1], iki.d[2]).normalize();
  // Küresel kontrol: konum = hedef − d·r → theta/phi d'nin tersinden
  V.ctrl.hedef.copy(m);
  V.ctrl.r = R / Math.sin(V.camera.fov * Math.PI / 360) * 1.02;
  V.ctrl.theta = Math.atan2(-d.y, -d.x);
  V.ctrl.phi = Math.asin(Math.max(-1, Math.min(1, -d.z)));
  V.yukari = new THREE.Vector3(iki.yukari[0], iki.yukari[1], iki.yukari[2]);
  V.elle = true;
  _fw3bKamera();
  _fw3bCiz();
  return true;
}

// ── 8 · ETKİLEŞİM ─────────────────────────────────────────────────────────
function _fw3bDinle(V){
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
      bas.oynadi = true; V.elle = true;
      V.kap.classList.add('surukle');
      if(bas.kay) _fw3bKaydir(dx, dy);
      else { V.ctrl.theta -= dx * 0.008; V.ctrl.phi = Math.max(-1.5, Math.min(1.5, V.ctrl.phi + dy * 0.008)); V.yukari = null; }
      bas.x = e.clientX; bas.y = e.clientY;
      _fw3bKamera(); _fw3bCiz();
      return;
    }
    _fw3bFare(e);
  });
  dinle(cv, 'pointerup', function(e){
    var b = bas;
    bas = null;
    V.kap.classList.remove('surukle');
    if(b && !b.oynadi && b.tus === 0){
      var i = _fw3bIsabet(e.clientX, e.clientY);
      veFeadWiz3bSec(i >= 0 ? V.s.sonuc.parcalar[i].dugum : -1);
    }
  });
  dinle(cv, 'pointerleave', function(){ if(V.fare >= 0){ V.fare = -1; _fw3bIpucu(null); _fw3bRenkle(); _fw3bCiz(); } });
  dinle(cv, 'wheel', function(e){
    e.preventDefault();
    V.elle = true;
    V.ctrl.r = Math.max(1, Math.min(1e6, V.ctrl.r * Math.exp(e.deltaY * 0.0012)));
    _fw3bKamera(); _fw3bCiz();
  }, { passive: false });
}
function _fw3bKaydir(dx, dy){
  var V = _fw3b, h = V.kap.clientHeight || 1;
  var olcek = 2 * V.ctrl.r * Math.tan(V.camera.fov * Math.PI / 360) / h;
  var sag = new THREE.Vector3().setFromMatrixColumn(V.camera.matrixWorld, 0);
  var yuk = new THREE.Vector3().setFromMatrixColumn(V.camera.matrixWorld, 1);
  V.ctrl.hedef.addScaledVector(sag, -dx * olcek).addScaledVector(yuk, dy * olcek);
}
function _fw3bIsabet(cx, cy){
  var V = _fw3b;
  if(!V || !V.camera) return -1;
  var r = V.renderer.domElement.getBoundingClientRect();
  var nd = new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
  V.ray.setFromCamera(nd, V.camera);
  // Seçim varken SOLUK parçalar da tıklanır: başka bir parçaya geçmek serbest
  var hit = V.ray.intersectObjects(V.meshler.filter(Boolean), false);
  return hit.length ? hit[0].object.userData.parca : -1;
}
function _fw3bFare(e){
  var V = _fw3b;
  if(V.fareIstek) { V.fareSon = e; return; }
  V.fareSon = e;
  V.fareIstek = requestAnimationFrame(function(){
    V.fareIstek = 0;
    if(_fw3b !== V) return;
    var ev = V.fareSon, i = _fw3bIsabet(ev.clientX, ev.clientY);
    if(i !== V.fare){ V.fare = i; _fw3bRenkle(); _fw3bCiz(); }
    _fw3bIpucu(i >= 0 ? ev : null, i);
  });
}
function _fw3bIpucu(e, i){
  var V = _fw3b, el = document.getElementById('ve-fw-3b-ipucu');
  if(!el) return;
  if(!e || i < 0){ el.hidden = true; return; }
  var s = V.s, p = s.sonuc.parcalar[i], b = veFeadWiz3bBirim(s, i);
  el.textContent = p.ad + (b >= 0 ? ' · ' + _fwStpRolAd(s.roller[b]) + (b !== p.dugum ? ' (' + s.sonuc.agac[b].ad + ')' : '') : '');
  var r = V.kap.getBoundingClientRect();
  el.style.left = Math.min(r.width - 12, e.clientX - r.left + 14) + 'px';
  el.style.top = Math.max(4, e.clientY - r.top - 28) + 'px';
  el.hidden = false;
}
function _fw3bBoyut(){
  var V = _fw3b;
  if(!V || !V.renderer) return;
  var w = Math.max(1, V.kap.clientWidth), h = Math.max(1, V.kap.clientHeight);
  V.renderer.setSize(w, h, false);
  V.camera.aspect = w / h;
  V.camera.updateProjectionMatrix();
  _fw3bCiz();
}
function _fw3bCiz(){
  var V = _fw3b;
  if(!V || !V.renderer || V.cizIstek) return;
  V.cizIstek = requestAnimationFrame(function(){
    V.cizIstek = 0;
    if(_fw3b !== V) return;
    V.renderer.render(V.scene, V.camera);
  });
}

// ── 9 · TEST KANCASI ──────────────────────────────────────────────────────
// Gerçek tarayıcı testi parçaya ekranda TIKLAR: parçanın bir üçgeninin
// ağırlık merkezi, ışın o noktada ilk o parçaya çarpıyorsa döner.
function veFeadWiz3bIsabetNoktasi(i){
  var V = _fw3b, a = V && V.s.ag && V.s.ag[i];
  if(!a || !V.camera) return null;
  V.camera.updateMatrixWorld();
  var r = V.renderer.domElement.getBoundingClientRect(), n = a.ucgen.length / 3, adim = Math.max(1, Math.floor(n / 400));
  for(var t = 0; t < n; t += adim){
    var p = new THREE.Vector3();
    for(var j = 0; j < 3; j++){ var v = a.ucgen[t * 3 + j] * 3; p.x += a.uc[v] / 3; p.y += a.uc[v + 1] / 3; p.z += a.uc[v + 2] / 3; }
    p.project(V.camera);
    if(Math.abs(p.x) > 0.95 || Math.abs(p.y) > 0.95 || p.z > 1) continue;
    var x = r.left + (p.x + 1) / 2 * r.width, y = r.top + (1 - p.y) / 2 * r.height;
    if(_fw3bIsabet(x, y) === i) return { x: x, y: y };
  }
  return null;
}
function veFeadWiz3bDurum(){
  var V = _fw3b;
  if(!V) return null;
  return { durum: V.kap.getAttribute('data-durum'), parca: V.meshler.filter(Boolean).length,
    halka: V.sonucGrubu ? V.sonucGrubu.userData.halka : 0, secili: V.secili, fare: V.fare };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    VE_FW_3B_ROL_RENK: VE_FW_3B_ROL_RENK,
    veFeadWiz3bBirim: veFeadWiz3bBirim,
    veFeadWiz3bYol: veFeadWiz3bYol,
    veFeadWiz3bParcalar: veFeadWiz3bParcalar,
    veFeadWiz3bRolJeton: veFeadWiz3bRolJeton,
    veFeadWiz3bPanelHTML: veFeadWiz3bPanelHTML,
    veFeadWiz3bTazele: veFeadWiz3bTazele
  };
}
