// YOKLAMA HEDEFİ — veri dosyası değil.
//
// "programlar/ klasörü bu kopyanın yanında mı?" sorusunun cevabı ÖLÇÜLÜR,
// varsayılmaz (js/cp-programlar.js). Ölçüm `file://` üzerinde de çalışmak
// zorunda ve orada `fetch` var/yok ayrımı YAPMIYOR — dosya olsa da olmasa da
// TypeError atıyor (Chromium'da ölçüldü). `<script>` etiketi ayrımı yapıyor:
// dosya varsa `onload`, yoksa `onerror`. Bu dosya o etiketin hedefi.
//
// İÇERİĞİ BÜYÜMEZ. Katalog burada DEĞİL (programlar/kayit.json); veri buraya
// da yazılsaydı iki kopya ayrışırdı. Buranın tek işi var olmak.
window.__MFSIM_ARSIV_VAR = true;
