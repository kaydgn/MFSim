// ============================================================================
//  TAKOZ 3B — ÜRÜN AĞACI (solda, 3DEXPERIENCE gibi) VE ÇOKLU SEÇİM
// ============================================================================
// Çalışma masasında (2026-11-03) ağaç tuvalin solundaki PANEL (yüzen kart değil),
// başında arama alanı (veMntWiz3bAra).
// Kullanıcı isteği (2026-11-02): "Ürün ağacının tıpkı 3D Experience programı
// gibi sol tarafta gösterilmesini istiyorum." · "Modelde birden fazla braket,
// birden fazla takoz olduğu için tek tek seçmek yerine CTRL tuşunu aktif edelim."
//   · AÇIKLIK KARTLA ORTAK: ağaç sihirbaz kartının açıklık durumunu okur
//     (s.acik · js/cp-mount-wizard.js → _mwStpSatirlar): dal birinde açılınca
//     ötekinde de açık; açılışta yalnız kökün çocukları, dallar kapalı
//     (Canlı Not 7), dal sayfa sayfa (VE_MW_STP_SAYFA) — 11.694 satır kartı
//     6,6 sn donduruyordu.
//   · Satır: dal düğmesi · simge (alt montaj · parça) · ad · atanan malzeme ·
//     rol çipi. Rollü birimin içindeki düğüm birimin rengini soluk noktayla taşır.
//   · Tık seçer; Ctrl (Mac'te ⌘) + tık seçime ekler ya da çıkarır — 3B'de de.
//     Rol alttaki diziden SEÇİMİN HEPSİNE verilir: tek tazeleme, tek hesap
//     (veMntWizStpRolCok).
//   · 3B'de tıklanan parçanın dalı açılır, satırı görünür olur.
//   · Satırın üstüne gelmek 3B'de düğümün parçalarını vurgular.
//   · Satıra SAĞ TIK bağlam menüsünü açar (js/cp-mount-3b-menu.js, Canlı Not 8);
//     gizli düğümün satırı soluk ve sonunda gizli simgesi.
// Durumu js/cp-mount-3b.js tutar (_mw3b.secim); bu dosya yalnız ağacın
// HTML'ini kurar ve satırın olaylarını oraya iletir.
// ============================================================================

// Ağacın satırları (saf, testli). `secim`: seçili düğümler · `gizli`: { parça: 1 }
// (sağ tık menüsünün gizledikleri). Döner: HTML.
function veMntWiz3bAgacHTML(s, secim, gizli){
  var so = s.sonuc, satirlar = _mwStpSatirlar(s), taban = satirlar.length ? satirlar[0].derinlik : 0, sec = {};
  (secim || []).forEach(function(i){ sec[i] = 1; });
  var h = '';
  satirlar.forEach(function(d){
    if(d.daha){
      h += '<div class="ve-mw-3b-agac-r ve-mw-3b-agac-daha" style="--d:' + Math.max(0, d.derinlik - taban) + '">'
        + '<button type="button" class="ve-mw-3b-agac-dahab" onclick="veMntWizStpDaha(' + d.ebeveyn + ')">'
        + _mwIkon('chevron-down') + ' ' + veSayi(d.kalan, 0) + ' düğüm daha</button></div>';
      return;
    }
    var rol = s.roller[d.i] || '', ata = -1;
    // Rolsüz düğümün kendi malzemesi (birimin malzemesi kartın kaynak sütununda)
    var mz = !rol && s.malzeme && typeof veMntStpMalzeme === 'function' ? veMntStpMalzeme(s.malzeme[d.i]) : null;
    if(!rol) for(var e = d.ebeveyn; e >= 0; e = so.agac[e].ebeveyn) if(s.roller[e]){ ata = e; break; }
    var acik = !!(s.acik ? s.acik[d.i] : d.cocuklar.length), dal = d.cocuklar.length && s.acik;
    var gz = !!(gizli && typeof veMntWiz3bDugumGizli === 'function' && veMntWiz3bDugumGizli(s, d.i, gizli));
    h += '<div class="ve-mw-3b-agac-r' + (sec[d.i] ? ' on' : '') + (ata >= 0 ? ' ic' : '') + (gz ? ' gizli' : '') + '" role="treeitem"'
      + ' aria-level="' + (d.derinlik - taban + 1) + '" aria-selected="' + (sec[d.i] ? 'true' : 'false') + '"'
      + (d.cocuklar.length ? ' aria-expanded="' + acik + '"' : '') + ' data-ve-3b-agac="' + d.i + '"'
      + ' style="--d:' + Math.max(0, d.derinlik - taban) + '">'
      + (dal ? '<button type="button" class="ve-mw-3b-agac-dal" tabindex="-1" aria-label="' + (acik ? 'Kapat' : 'Aç') + ' — ' + _mwEsc(d.ad)
               + '" onclick="veMntWizStpAc(' + d.i + ')">' + _mwIkon(acik ? 'chevron-down' : 'chevron-right') + '</button>'
             : '<span class="ve-mw-3b-agac-dal"></span>')
      + _mwIkon(d.cocuklar.length ? 'package' : 'box')
      + '<button type="button" class="ve-mw-3b-agac-ad" title="' + _mwEsc(d.ad + (d.ornek && d.ornek !== d.ad ? ' · ' + d.ornek : '')) + '"'
      + ' onclick="veMntWiz3bAgacTik(' + d.i + ', event)" ondblclick="veMntWiz3bAgacOdak(' + d.i + ')"'
      + ' oncontextmenu="veMntWiz3bAgacMenu(' + d.i + ', event)"'
      + ' onpointerenter="veMntWiz3bAgacFare(' + d.i + ')" onpointerleave="veMntWiz3bAgacFare(-1)">' + _mwEsc(d.ad) + '</button>'
      + (gz ? '<span class="ve-mw-3b-agac-gz" title="Gizli">' + _mwIkon('eye-off') + '</span>' : '')
      + (mz ? '<span class="ve-mw-3b-agac-mz" title="' + _mwEsc(mz.ad + ' · ' + mz.sinif + ' · ' + veSayi(mz.rho, 0) + ' kg/m³') + '">'
             + _mwEsc(mz.ad) + '</span>' : '')
      + (rol ? '<span class="ve-mw-3b-agac-rol" style="--renk:var(' + veMntWiz3bRolJeton(rol) + ')">' + _mwEsc(_mwAd(rol)) + '</span>'
             : ata >= 0 ? '<span class="ve-mw-3b-agac-ata" title="' + _mwEsc(so.agac[ata].ad) + '" style="--renk:var(' + veMntWiz3bRolJeton(s.roller[ata]) + ')"></span>' : '')
      + '</div>';
  });
  return h;
}
// AĞAÇTA ARA (çalışma masası, 2026-11-03): adı ya da örnek adı aranan metni taşıyan
// düğümler — BÜTÜN ağaçta (açık dallarla sınırlı değil), ağacın sırasıyla; en çok
// VE_MW_3B_ARA_EN satır, fazlası "… sonuç daha" satırı. Büyük-küçük harf Türkçe
// eşdeğer (İ ↔ i, I ↔ ı). Satır ağacın satırının olaylarını taşır (tık seçer, Ctrl
// ekler, çift tık sığdırır), adın altında atasının adı. Esc aramayı temizler
// (js/cp-mount-3b-arac.js → veMntWiz3bAracBitir).
var VE_MW_3B_ARA_EN = 200;
function _mw3bKucuk(t){ return String(t || '').toLocaleLowerCase('tr'); }
// Eşleşen düğümler (saf, testli): ağacın sırasıyla indisler. Küçük harfli adlar
// sonucun yanında bir kez kurulur (her tuşta 11.694 dönüşüm yapılmasın).
function veMntWiz3bAraBul(s, q){
  var so = s && s.sonuc, a = so && so.agac, k = _mw3bKucuk(q).trim(), out = [];
  if(!a || !k) return out;
  if(!so._araAd || so._araAd.length !== a.length)
    so._araAd = a.map(function(d){ return _mw3bKucuk(d.ad) + (d.ornek && d.ornek !== d.ad ? '\n' + _mw3bKucuk(d.ornek) : ''); });
  for(var i = 0; i < a.length; i++) if(so._araAd[i].indexOf(k) >= 0) out.push(i);
  return out;
}
function veMntWiz3bAraHTML(s, q, secim){
  var so = s.sonuc, L = veMntWiz3bAraBul(s, q), sec = {}, h = '';
  (secim || []).forEach(function(i){ sec[i] = 1; });
  if(!L.length) return '<p class="ve-mw-3b-ara-yok">Sonuç yok.</p>';
  L.slice(0, VE_MW_3B_ARA_EN).forEach(function(i){
    var d = so.agac[i], rol = s.roller[i] || '', e = d.ebeveyn;
    h += '<div class="ve-mw-3b-agac-r ve-mw-3b-ara-r' + (sec[i] ? ' on' : '') + '" role="treeitem" aria-level="1"'
      + ' aria-selected="' + (sec[i] ? 'true' : 'false') + '" data-ve-3b-agac="' + i + '">'
      + _mwIkon(d.cocuklar.length ? 'package' : 'box')
      + '<button type="button" class="ve-mw-3b-agac-ad" title="' + _mwEsc(d.ad + (d.ornek && d.ornek !== d.ad ? ' · ' + d.ornek : '')) + '"'
      + ' onclick="veMntWiz3bAgacTik(' + i + ', event)" ondblclick="veMntWiz3bAgacOdak(' + i + ')"'
      + ' oncontextmenu="veMntWiz3bAgacMenu(' + i + ', event)"'
      + ' onpointerenter="veMntWiz3bAgacFare(' + i + ')" onpointerleave="veMntWiz3bAgacFare(-1)"><span>' + _mwEsc(d.ad) + '</span>'
      + (e >= 0 ? '<span class="ve-mw-3b-ara-yol">' + _mwEsc(so.agac[e].ad) + '</span>' : '') + '</button>'
      + (rol ? '<span class="ve-mw-3b-agac-rol" style="--renk:var(' + veMntWiz3bRolJeton(rol) + ')">' + _mwEsc(_mwAd(rol)) + '</span>' : '')
      + '</div>';
  });
  if(L.length > VE_MW_3B_ARA_EN)
    h += '<div class="ve-mw-3b-agac-r ve-mw-3b-agac-daha"><span class="ve-mw-3b-ara-daha">' + veSayi(L.length - VE_MW_3B_ARA_EN, 0) + ' sonuç daha</span></div>';
  return h;
}
// Aramanın alanı (oninput): metin değişince ağaç ya da sonuçlar; arama boşalınca
// seçili düğümün dalı açılır ve satırı görünür
function veMntWiz3bAra(q){
  var V = typeof _mw3b !== 'undefined' ? _mw3b : null;
  if(!V || V.okuma) return false;
  var eski = V.ara;
  V.ara = String(q || '');
  if(eski === V.ara) return false;
  _mw3bAgac(!V.ara.trim() && V.secili >= 0 ? V.secili : -1);
  return true;
}
// Düğümün ağaçta görünmesi için açılacak dallar (saf, testli): ataların her
// biri, yoldaki çocuğun sayfasına kadar. Döner: { ata: sayfa } (değişenler).
function veMntWiz3bAgacAcilacak(s, dugum){
  var a = s.sonuc.agac, ac = s.acik || {}, out = {};
  if(!s.acik || !a[dugum]) return out;
  for(var c = dugum, e = a[dugum].ebeveyn; e >= 0; c = e, e = a[e].ebeveyn){
    var k = a[e].cocuklar.indexOf(c), gerek = Math.min(a[e].cocuklar.length, Math.ceil((k + 1) / VE_MW_STP_SAYFA) * VE_MW_STP_SAYFA);
    if(!(ac[e] >= gerek)) out[e] = gerek;
  }
  return out;
}

// ── OLAYLAR ───────────────────────────────────────────────────────────────
// Tık: seçer; Ctrl/⌘ ile seçime ekler ya da çıkarır
function veMntWiz3bAgacTik(i, e){
  var ek = !!(e && (e.ctrlKey || e.metaKey));
  // HIZLI ATAMA (Canlı Not 94): kart açıkken satırın tıkı sıradaki rolü verir
  if(!ek && typeof veMntWiz3bHizliAcik === 'function' && veMntWiz3bHizliAcik()) return veMntWiz3bHizliTik(i);
  return typeof veMntWiz3bSec === 'function' ? veMntWiz3bSec(i, ek, 'agac') : false;
}
// Çift tık: kamera düğümün parçalarına sığar (bakış yönü kalır)
function veMntWiz3bAgacOdak(i){
  var V = typeof _mw3b !== 'undefined' ? _mw3b : null;
  if(!V || !V.scene || typeof _mw3bOdakla !== 'function') return false;
  return _mw3bOdakla(i);
}
// Satırın üstü: 3B'de düğümün parçaları fare altındaki gibi
function veMntWiz3bAgacFare(i){
  var V = typeof _mw3b !== 'undefined' ? _mw3b : null;
  if(!V || !V.scene) return false;
  var d = i >= 0 ? i : -1;
  if(V.fareDugum === d) return false;
  V.fareDugum = d;
  _mw3bBoya(); _mw3bCiz(true);
  return true;
}
// Ağacı kurar; `goster`: satırı görünür olacak düğüm (3B'de seçilen). Arama
// açıkken ağacın yerinde sonuçlar, başlıkta sonuç sayısı.
function _mw3bAgac(goster){
  var V = _mw3b, el = typeof document !== 'undefined' && document.getElementById('ve-mw-3b-agac-l');
  if(!V || !el) return;
  var s = V.s, ara = (V.ara || '').trim();
  var say = document.getElementById('ve-mw-3b-agac-say');
  if(ara){
    var ustA = el.scrollTop;
    el.innerHTML = veMntWiz3bAraHTML(s, ara, V.secim);
    el.scrollTop = ustA;
    if(say) say.textContent = veSayi(veMntWiz3bAraBul(s, ara).length, 0) + ' sonuç';
    return;
  }
  if(goster >= 0){
    var ac = veMntWiz3bAgacAcilacak(s, goster);
    Object.keys(ac).forEach(function(k){ s.acik[k] = ac[k]; });
  }
  var ust = el.scrollTop;
  el.innerHTML = veMntWiz3bAgacHTML(s, V.secim, V.gizli);
  el.scrollTop = ust;
  if(say) say.textContent = veSayi(s.sonuc.parcalar.length, 0) + ' parça';
  if(goster >= 0){
    var r = el.querySelector('[data-ve-3b-agac="' + goster + '"]');
    if(r && r.scrollIntoView) try { r.scrollIntoView({ block: 'nearest' }); } catch(e){}
  }
}

if(typeof module !== 'undefined' && module.exports){
  module.exports = {
    veMntWiz3bAgacHTML: veMntWiz3bAgacHTML, veMntWiz3bAgacAcilacak: veMntWiz3bAgacAcilacak,
    veMntWiz3bAgacTik: veMntWiz3bAgacTik, veMntWiz3bAgacFare: veMntWiz3bAgacFare, veMntWiz3bAgacOdak: veMntWiz3bAgacOdak,
    veMntWiz3bAraBul: veMntWiz3bAraBul, veMntWiz3bAraHTML: veMntWiz3bAraHTML, veMntWiz3bAra: veMntWiz3bAra, VE_MW_3B_ARA_EN: VE_MW_3B_ARA_EN
  };
}
