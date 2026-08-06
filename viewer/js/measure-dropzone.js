// ═══════════════════════════════════════════════════════════════════════════
// ÖLÇÜM SÜRÜKLE-BIRAK — dosyayı pencereye bırakınca sihirbaz açılır
// ═══════════════════════════════════════════════════════════════════════════
//
// ORTAK DOSYA: MFSim ve Ölçüm Görüntüleyici (CACIK) aynı kaynağı kullanıyor,
// viewer/js/ altındaki kopya BİREBİR aynı (bkz. viewer/README.md).
//
// Sinyal sürükleme ile çakışmaz: şeride sinyal bırakma mousedown/mousemove
// üzerinden yürüyor (js/results.js veTrDragSession), buradaki ise HTML5
// dosya sürükleme olayları. İkisi ayrı olay ailesi.
//
// TARAYICI VARSAYILANI TEHLİKELİ: dragover VE drop üzerinde preventDefault
// çağrılmazsa tarayıcı bırakılan dosyaya GİDER — sekme .xlsx'i indirmeye ya da
// göstermeye kalkar, program kapanır ve o ana kadar açılmış ölçüm kaybolur.
// Bu yüzden aşağıdaki dinleyiciler dosya kabul edilmediğinde bile varsayılanı
// engeller; "yanlış dosya" durumunda bile program AYAKTA kalmalı.
//
// Bırakma yolu "Gözat" ile AYNI kapıya bağlanır (veImpLoadFile): sihirbaz,
// sütun taraması, X ekseni önerisi, hata ekranı — hepsi ortak. İkinci bir
// okuma yolu açmak iki davranışın zamanla ayrışması demekti.

// Kabul edilen uzantılar — veImpOpenPicker'ın accept listesiyle aynı.
//
// NEDEN UZANTI SÜZGECİ VAR: veImpIngest ZIP imzası görmezse dosyayı METİN
// kabul edip CSV olarak çözüyor. Bir .png bırakılırsa bu yol patlamaz —
// ikili çöpten "sütunlar" üretir. Kullanıcı makul görünen ama tamamen
// anlamsız bir tabloya bakar. Sessiz yanlış çıktı, açık bir retten çok daha
// kötü; kapı burada kapanıyor.
var VE_IMP_DROP_EXT = /\.(xlsx|xlsm|csv|tsv|txt)$/i;

// ── Kaplama ───────────────────────────────────────────────────────────────

// dragenter/dragleave ALT ÖĞELERDE DE tetiklenir: fare kaplamanın üstünden
// bir düğmenin üstüne geçerken önce leave, sonra enter gelir. Tek bir bayrakla
// izlenirse kaplama sürükleme sırasında yanıp söner. Sayaç bunu çözer:
// yalnızca sıfıra düşünce gizlenir.
var _veImpDragDepth = 0;

function veImpDropShow(on) {
  var el = document.getElementById('ve-imp-drop');
  if(!el) return;
  el.classList.toggle('on', !!on);
  el.setAttribute('aria-hidden', on ? 'false' : 'true');
}

// Sürüklenen şey DOSYA mı? Başka bir sayfadan metin ya da resim sürükleyen
// kullanıcıya "ölçüm dosyasını bırakın" demek yanıltıcı olurdu.
function veImpDragHasFiles(e) {
  var dt = e.dataTransfer;
  if(!dt || !dt.types) return false;
  for(var i = 0; i < dt.types.length; i++) {
    if(dt.types[i] === 'Files') return true;
  }
  return false;
}

// ── Bırakma ───────────────────────────────────────────────────────────────

function veImpAcceptDropped(files) {
  var all = Array.prototype.slice.call(files || []);
  if(all.length === 0) return null;

  var ok = all.filter(function(f) { return VE_IMP_DROP_EXT.test(f.name || ''); });

  if(ok.length === 0) {
    if(typeof showToast === 'function') {
      showToast('"' + (all[0].name || 'Dosya') + '" okunamaz — yalnızca ' +
                '.xlsx, .xlsm, .csv, .tsv ve .txt açılabilir.', 'warning');
    }
    return null;
  }

  // Birden çok dosya: sihirbaz dosya BAŞINA sütun seçimi istiyor, bu yüzden
  // sıraya dizmek modal üstüne modal olurdu. İlki açılır — ama sessizce değil,
  // kullanıcı diğerlerinin ne olduğunu bilmeli.
  if(all.length > 1 && typeof showToast === 'function') {
    showToast(all.length + ' dosya bırakıldı, ilki açılıyor: ' + ok[0].name +
              '. Diğerlerini tek tek bırakabilirsiniz.', 'info');
  }
  return ok[0];
}

function veImpOnDrop(e) {
  // Kabul etsek de etmesek de varsayılan engellenir (bkz. dosya başı).
  e.preventDefault();
  _veImpDragDepth = 0;
  veImpDropShow(false);

  if(!veImpDragHasFiles(e)) return;
  var file = veImpAcceptDropped(e.dataTransfer.files);
  if(file && typeof veImpLoadFile === 'function') veImpLoadFile(file);
}

// ── Bağlama ───────────────────────────────────────────────────────────────

function veImpBindDropzone() {
  document.addEventListener('dragenter', function(e) {
    e.preventDefault();
    if(!veImpDragHasFiles(e)) return;
    _veImpDragDepth++;
    veImpDropShow(true);
  });

  // dragover'da preventDefault ŞART: çağrılmazsa tarayıcı bırakmayı hiç kabul
  // etmez ve drop olayı gelmez — kaplama açılır, dosya bırakılır, hiçbir şey
  // olmaz.
  document.addEventListener('dragover', function(e) {
    e.preventDefault();
    if(veImpDragHasFiles(e) && e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
  });

  document.addEventListener('dragleave', function(e) {
    if(!veImpDragHasFiles(e)) return;
    _veImpDragDepth = Math.max(0, _veImpDragDepth - 1);
    if(_veImpDragDepth === 0) veImpDropShow(false);
  });

  document.addEventListener('drop', veImpOnDrop);

  // Sürükleme pencere dışında biterse (kullanıcı vazgeçip masaüstüne bıraktı)
  // dragleave gelmeyebilir ve kaplama ekranda ASILI kalırdı — program
  // kilitlenmiş gibi görünür. İki kaçış kapısı:
  window.addEventListener('dragend', function() { _veImpDragDepth = 0; veImpDropShow(false); });
  window.addEventListener('blur', function() { _veImpDragDepth = 0; veImpDropShow(false); });
}

if(document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', veImpBindDropzone, { once: true });
} else {
  veImpBindDropzone();
}

// Jest: saf yardımcılar doğrudan test edilebilsin
if(typeof module !== 'undefined' && module.exports) {
  module.exports = {
    VE_IMP_DROP_EXT: VE_IMP_DROP_EXT,
    veImpAcceptDropped: veImpAcceptDropped
  };
}
