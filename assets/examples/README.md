# Örnek Topoloji Görselleri

Bu klasör, "Takoz Çökme–Titreşim" modülündeki **Örnek** panelinde gösterilen
topoloji ekran görüntülerini tutar. Görseller uygulamaya **gömülmez** (harici
dosya olarak kalır); build tek dosyayı üretir, deploy bu klasörü Pages'e
`assets/examples/` altına kopyalar. Böylece hem `index.html` (geliştirme) hem
`MFSim_Code.html` (yayın) aynı göreli yolla resmi bulur.

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
