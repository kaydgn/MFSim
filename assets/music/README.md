# Açılış Müziği

Yükleme (splash) ekranı göründüğü anda otomatik çalacak şarkı bu klasöre
konur. Beklenen dosya adı:

```
assets/music/acilis.mp3
```

- Dosya yoksa uygulama normal çalışır, sadece müzik çalmaz (sessizce atlanır).
- Farklı bir dosya adı/format kullanmak için `js/splash-music.js` içindeki
  `TRACK_SRC` sabitini değiştirin (tarayıcı desteği: mp3 en güvenlisi;
  m4a/aac ve ogg de çoğu tarayıcıda çalışır).
- Ses seviyesi ve döngü ayarı da aynı dosyanın başındaki `VOLUME` / `LOOP`
  sabitlerinden değiştirilir.

Tarayıcı otomatik çalma politikası notu: normal girişte "Giriş Yap"
tıklaması kullanıcı jesti sayılır ve müzik splash ile birlikte başlar.
"Beni hatırla" ile açılan oturumda tarayıcı sesli otomatik çalmayı
engelleyebilir; bu durumda müzik sayfadaki ilk tıklama/tuş basımında başlar.

Bu klasördeki ses dosyaları CI deploy ile GitHub Pages'e aynı yolla
kopyalanır (`.github/workflows/ci-deploy.yml`), yani yayınlanan sürümde de
çalışır.
