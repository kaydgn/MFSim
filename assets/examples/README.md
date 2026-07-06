# Örnek Varlıkları (görseller + JSON topolojiler)

Bu klasör, "Takoz Çökme–Titreşim" modülündeki **Başlangıç ve Örnekler** panelinin
kullandığı dosyaları tutar: topoloji **ekran görüntüleri (PNG)** ve **JSON topoloji**
dosyaları. Deploy bu klasörü Pages'e `assets/examples/` altına kopyalar; build ise
JSON'ları tek dosyaya **gömer** (görseller harici kalır). Böylece hem `index.html`
(geliştirme) hem `MFSim_Code.html` (yayın/indirilmiş) çalışır.

## JSON topoloji ile örnek eklemek (önerilen)

1. Takoz modelini aç → **Başlangıç ve Örnekler** bileşenini seç → örneği kur
   (mevcut bir örneği "Örneği Aktar" ile getirip düzenle **veya** kütle/takoz/Çözücü
   ekleyip değerleri gir, bağla).
2. Panelde **"⬇ İç Topolojiyi JSON Dışa Aktar"** ile `.json` indir.
3. Dosyayı bu klasöre koy, örn. `siper.json`.
4. Kayıt defterinde (`js/mount-core.js` → `MOUNT_EXAMPLES`) ilgili örneğe **`topology`**
   alanını ekle (varsa `model`'den önceliklidir):

   ```js
   topology: 'assets/examples/siper.json',
   ```

   "Örneği Aktar" bu JSON'u iç topolojiye **birebir** kurar (konum, isim, bağlantı,
   tüm değerler). `topology` yoksa panel eski programatik `model`'i kullanır.

## Görsel (PNG) eklemek

## Yeni görsel eklemek

1. Ekran görüntüsünü **PNG** olarak al (topoloji alanını kırp; şeffaf/aydınlık
   arka plan iyidir).
2. Dosyayı bu klasöre, örneğin adıyla eşleşen adla koy:

   | Örnek (kayıt anahtarı) | Dosya adı |
   |------------------------|-----------|
   | `siper`                | `siper.png` |

3. Kayıt defterinde (`js/mount-core.js` → `MOUNT_EXAMPLES`) ilgili örneğin
   `image` alanını bu yola ayarla:

   ```js
   image: 'assets/examples/siper.png',
   ```

   `image` boş (`''`) bırakılırsa panel modelden **otomatik şema** üretir.
   Dosya yolu verildiğinde resim yüklenemezse (henüz eklenmemişse) panel yine
   otomatik şemaya düşer — kırık resim gösterilmez.

## Notlar

- Görsel harici dosya olduğu için `MFSim_Code.html` boyutunu şişirmez.
- Makul boyut (< ~500 KB) sayfa yükleme hızını korur.
- Yol **göreli** olmalı (`assets/examples/…`), başında `/` olmadan — hem alt
  yol hem kök dağıtımda çalışsın diye.
