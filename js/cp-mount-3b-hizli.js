// ============================================================================
// cp-mount-3b-hizli.js — TAKOZ 3B: HIZLI ATAMA
// ────────────────────────────────────────────────────────────────────────────
// Kullanıcı 2026-11-09, Canlı Not 94: *"STEP dosyası yüklendiği anda, program
// kullanıcıya hızlı hızlı sorsun, kullanıcı da tık tık hemen seçsin. Hata yaptıysa
// sağ taraftan gitsin düzeltsin. Böyle tık tık çok zor oluyor. Yani parçaya tıkla,
// sonra git role tıkla …"*
//
// Önce bir rol İKİ ADIMDI: parçayı seç, Özellikler'in Rol listesini aç, rolü seç.
// Hızlı atamada tuvalin üstündeki kart sıradaki rolü SORAR (Motor → Şanzıman →
// Transfer Kutusu → Takoz → Braket) ve tek tık o rolü verir:
//   · tek rol (gövde): tık rolü tıklanan düğüme verir, başka düğümdeki aynı rol
//     düşer; kart sıradaki role geçer
//   · çoklu rol (takoz, braket): her tık bir tane daha ekler, aynı birime ikinci
//     tık rolü kaldırır; Sonraki ile geçilir
// Tık 3B'de (parçanın düğümü) ya da Ürün ağacında (satırın düğümü). Ctrl'li tık
// eskisi gibi seçimdir. Düzeltme Özellikler'in Rol listesinden — kart orada kalır.
// Kart, görüntüleyici açıldığında ana rollerin HİÇBİRİ verilmemişse kendiliğinden
// açılır; boşluğa sağ tık menüsündeki Hızlı atama ile yeniden açılır. Esc kapatır.
// Kapı: tests/unit/mount-3b.test.js → *HIZLI ATAMA* + tests/e2e/mount-3b.spec.js.
// ============================================================================

var VE_MW_3B_HIZLI = [
  { tip: 'mnt-motor' },
  { tip: 'mnt-gearbox' },
  { tip: 'mnt-transfer' },
  { tip: 'mnt-mount', cok: true },
  { tip: 'mnt-bracket', cok: true }
];

function _mw3bHizliV(){ return (typeof _mw3b !== 'undefined') ? _mw3b : null; }
// Rolü taşıyan düğüm sayısı
function _mw3bHizliSay(s, tip){
  var n = 0;
  (s && s.roller || []).forEach(function(r){ if(r === tip) n++; });
  return n;
}
// Başlanacak adım: verilmemiş ilk tek rol; tek rollerin hepsi verildiyse ilk çoklu rol
function _mw3bHizliIlk(s){
  for(var k = 0; k < VE_MW_3B_HIZLI.length; k++){
    var a = VE_MW_3B_HIZLI[k];
    if(a.cok || !_mw3bHizliSay(s, a.tip)) return k;
  }
  return -1;
}

// Kart açık mı (testler ve tık yolları)
function veMntWiz3bHizliAcik(){ var V = _mw3bHizliV(); return !!(V && V.hizli); }
function veMntWiz3bHizliBasla(){
  var V = _mw3bHizliV();
  if(!V || !V.s || V.okuma || V.s.durum !== 'hazir') return false;
  var k = _mw3bHizliIlk(V.s);
  if(k < 0) return false;
  V.hizli = { i: k };
  _mw3bHizliYaz();
  return true;
}
// Görüntüleyici açılınca: ana rollerin hiçbiri verilmemişse kart kendiliğinden açılır
function veMntWiz3bHizliOto(){
  var V = _mw3bHizliV();
  if(!V || !V.s || V.okuma || V.s.durum !== 'hazir') return false;
  if(VE_MW_3B_HIZLI.some(function(a){ return _mw3bHizliSay(V.s, a.tip) > 0; })) return false;
  return veMntWiz3bHizliBasla();
}
function veMntWiz3bHizliBitir(){
  var V = _mw3bHizliV();
  if(!V || !V.hizli) return false;
  V.hizli = null;
  _mw3bHizliYaz();
  return true;
}
// Geri (−1) · Atla / Sonraki (+1); sonuncudan ileri kartı kapatır
function veMntWiz3bHizliAdim(yon){
  var V = _mw3bHizliV();
  if(!V || !V.hizli) return false;
  var j = V.hizli.i + (yon < 0 ? -1 : 1);
  if(j < 0) return false;
  if(j >= VE_MW_3B_HIZLI.length) return veMntWiz3bHizliBitir();
  V.hizli.i = j;
  _mw3bHizliYaz();
  return true;
}
// TIK — 3B'de ya da ağaçta tıklanan düğüm sıradaki rolü alır
function veMntWiz3bHizliTik(dugum){
  var V = _mw3bHizliV();
  if(!V || !V.hizli || !V.s || V.s.durum !== 'hazir') return false;
  var s = V.s, a = VE_MW_3B_HIZLI[V.hizli.i];
  if(!(dugum >= 0 && dugum < s.roller.length)){
    if(typeof veMntWiz3bSec === 'function') veMntWiz3bSec(-1);
    return false;
  }
  if(typeof veMntWiz3bSec === 'function') veMntWiz3bSec(dugum, false);
  if(a.cok){
    // aynı birime ikinci tık rolü kaldırır (birim: en yakın rollü ata)
    var b = (typeof _mw3bSeciliBirim === 'function') ? _mw3bSeciliBirim(s, dugum) : (s.roller[dugum] ? dugum : -1);
    if(b >= 0 && s.roller[b] === a.tip) veMntWizStpRol(b, null);
    else veMntWizStpRol(dugum, a.tip);
  } else {
    // tek rol: başka düğümdeki aynı rol düşer (kayıt ve hesap aşağıdaki tek çağrıda)
    s.roller.forEach(function(r, d){ if(r === a.tip && d !== dugum) veMntStpRolVer(s.sonuc, s.roller, d, null); });
    veMntWizStpRol(dugum, a.tip);
    // kart sonraki role geçer (veMntWizStpRol tazelerken yeniden çizilmiş olabilir)
    if(V.hizli){
      if(V.hizli.i + 1 >= VE_MW_3B_HIZLI.length) V.hizli = null;
      else V.hizli.i++;
    }
  }
  _mw3bHizliYaz();
  return true;
}

// Yönlendirme — rol başına TEK cümle (yuvası: gizli etkileşim, tuvalde tık)
function _mw3bHizliYon(tip){
  if(tip === 'mnt-motor') return veYon('Modelde ya da ağaçta motoru seçin.');
  if(tip === 'mnt-gearbox') return veYon('Modelde ya da ağaçta şanzımanı seçin.');
  if(tip === 'mnt-transfer') return veYon('Modelde ya da ağaçta transfer kutusunu seçin.');
  if(tip === 'mnt-mount') return veYon('Takozları modelde ya da ağaçta tek tek seçin.');
  return veYon('Braketleri modelde ya da ağaçta tek tek seçin.');
}
function _mw3bHizliHTML(V){
  var a = VE_MW_3B_HIZLI[V.hizli.i], n = _mw3bHizliSay(V.s, a.tip);
  var ad = (typeof _mwAd === 'function') ? _mwAd(a.tip) : a.tip;
  var h = '<div class="ve-mw-3b-hizli-bas"><span class="ve-mw-3b-hizli-sira">' + (V.hizli.i + 1) + ' / ' + VE_MW_3B_HIZLI.length + '</span>'
    + '<b class="ve-mw-3b-hizli-rol">' + _mwEsc(ad) + '</b>'
    + (a.cok ? '<span class="ve-mw-3b-hizli-say">' + n + ' seçili</span>' : '') + '</div>'
    + '<p class="ve-mw-3b-hizli-yon">' + _mw3bHizliYon(a.tip) + '</p>'
    + '<div class="ve-mw-3b-hizli-d">';
  if(V.hizli.i > 0) h += '<button type="button" class="ve-mw-3b-hap" data-hizli="geri" onclick="veMntWiz3bHizliAdim(-1)">' + _mwIkon('arrow-left') + ' Geri</button>';
  h += '<button type="button" class="ve-mw-3b-hap' + (a.cok && n ? ' ve-mw-3b-hap-ana' : '') + '" data-hizli="ileri" onclick="veMntWiz3bHizliAdim(1)">'
    + (a.cok && n ? 'Sonraki' : 'Atla') + '</button>'
    + '<button type="button" class="ve-mw-3b-hap" data-hizli="bitir" onclick="veMntWiz3bHizliBitir()">Bitir</button>';
  return h + '</div>';
}
function _mw3bHizliYaz(){
  if(typeof document === 'undefined') return;
  var el = document.getElementById('ve-mw-3b-hizli');
  if(!el) return;
  var V = _mw3bHizliV();
  if(!V || !V.hizli){ el.hidden = true; el.innerHTML = ''; return; }
  el.hidden = false;
  el.innerHTML = _mw3bHizliHTML(V);
}
