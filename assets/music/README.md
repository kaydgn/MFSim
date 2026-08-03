# Müzik dosyaları

Bu klasördeki ses dosyaları CI deploy ile GitHub Pages'e aynı yolla kopyalanır
(`.github/workflows/ci-deploy.yml`), yani yayınlanan sürümde de erişilebilir.

## `acilis.mp3` — "Gobble Glitch"

Bu parça artık **program açılışında otomatik ÇALMAZ**. Bunun yerine radyo /
müzik çaların **"Kütüphanem"** sekmesine gömülü bir parça olarak hazır durur;
kullanıcı isterse oradan çalar (bkz. `js/radio.js` → `LIBRARY_BUILTIN`).

- Radyoyu aç (üst bardaki 📻) → **Kütüphanem** sekmesi → **Gobble Glitch**
  ("Açılış müziği") parçasına tıkla.
- Dosya yoksa uygulama normal çalışır; parça listede kalır ama çalınamaz.
- Farklı dosya adı/format için `js/radio.js` içindeki `LIBRARY_BUILTIN` dizisini
  düzenle (tarayıcı desteği: mp3 en güvenlisi; m4a/aac ve ogg de çoğu tarayıcıda
  çalışır).

> Tarih notu: Eskiden splash (yükleme) ekranında otomatik çalan bir "açılış
> müziği" mini çaları vardı (`js/splash-music.js`). Kullanıcı isteğiyle otomatik
> çalma kaldırıldı ve parça Kütüphanem'e taşındı.
