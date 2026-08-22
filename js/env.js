// ============================================================================
// ÇALIŞMA ORTAMI — programın nerede koştuğunu tek yerden söyler
// ============================================================================
// MFSim üç yerde koşuyor ve üçünün AĞ İMKÂNI farklı:
//
//   1. index.html (geliştirme)      — her şey açık
//   2. MFSim_Code.html (Pages)      — her şey açık
//   3. Artifact (claude.ai önizleme) — DIŞ HOSTA İSTEK YOK (katı CSP)
//
// Üçüncüsü kullanıcının GitHub'a erişemediği ağlar için var: program
// claude.ai üzerinden yayınlanıyor, çünkü açılışta sıfır ağ isteği yapıyor
// (ölçüldü: 0 istek, 0 konsol hatası). Ama sayfanın CSP'si dış hostları
// engellediği için ağa BAĞLI özellikler orada çalışamaz.
//
// Bayrağı tools/build-artifact.js gövdenin en başına yazar. index.html'de ve
// MFSim_Code.html'de bayrak YOKTUR → veArtifactEnv() false → davranış hiç
// değişmez. Yani bu dosya Pages sürümüne sıfır risk taşır.
//
// NEDEN BAYRAK, NEDEN SNIFFING DEĞİL: "fetch patlıyorsa demek ki artifact'teyiz"
// çıkarımı kurumsal güvenlik duvarının arkasındaki Pages kullanıcısını da
// artifact sanardı ve ona "bu ortamda kapalı" derdi — oysa onun ağı düzelince
// özellik geri gelmeli. Ortam derleme zamanında BİLİNİYOR; tahmin etmeye gerek yok.
// ============================================================================

// Artifact (claude.ai) önizlemesinde miyiz?
function veArtifactEnv() {
  return typeof window !== 'undefined' && window.MFSIM_ENV === 'artifact';
}

// Dış hosta istek atılabilir mi? Bugün tek engel artifact ortamı; ayrı isim
// tutuluyor ki çağrı yerleri NİYETİ yazsın ("ağ var mı"), ortamı değil.
function veNetworkAllowed() {
  return !veArtifactEnv();
}

// Ağ isteyen bir özelliğin kapalı olduğunu anlatan TEK metin. Dört çağrı yeri
// kendi cümlesini yazsaydı kullanıcı aynı kısıtı dört farklı ifadeyle görürdü.
function veOfflineNote(ozellik) {
  return (ozellik ? ozellik + ': ' : '') +
    'bu önizleme claude.ai üzerinde yayınlandığı için dış bağlantı kurulamıyor. ' +
    'Özellik yayınlanan sürümde (GitHub Pages) veya indirilen tek dosyada çalışır.';
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { veArtifactEnv: veArtifactEnv, veNetworkAllowed: veNetworkAllowed, veOfflineNote: veOfflineNote };
}
