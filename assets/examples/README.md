# Örnek Varlıkları (görseller + JSON topolojiler)

İki modülün örnekleri burada durur:

| Önek | Modül | Kayıt defteri |
|---|---|---|
| `siper` / `tulga` / `asfat` | Takoz Çökme–Titreşim | `js/mount-core.js` → `MOUNT_EXAMPLES` |
| `ap_*` | **Araç Performans** | `js/cp-arac-example.js` → `AP_EXAMPLES` |


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
3. Dosyayı bu klasöre koy, örn. `siper.json`. Doğrudan **proje kaydı**
   (`{tabs:[{state:{…}}]}`) de kabul edilir — yükleyici aktif/ilk dolu sekmenin
   durumunu alır; ama örnek dosyası biçimi (`{format:'mfsim-mount-example',…}`)
   tercih edilir: uçucu alanlar (undo/redo, simResults) taşınmaz.
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
   | `tulga`                | `tulga.png` |
   | `asfat`                | `asfat.png` |

   Ekran görüntüsünü elle almak zorunda değilsin: örneği "Örneği Aktar" ile kur,
   kenar çubuğu/şerit/durum çubuğunu gizle ve kanvası düğümlerin + `.ve-boundary-rect`
   sınır kutusuna kırparak kaydet — `siper.png`/`tulga.png` böyle üretildi.
   `asfat.png` Playwright ile `#ve-canvas-wrapper` elemanı kırpılarak alındı; o
   akışta ayrıca şunlar gizlenir: seçim halkaları, iç-topoloji breadcrumb çipi
   (`#ve-mnt-breadcrumb`), minimap (`.ve-minimap*`) ve ses oynatıcı
   (`#mf-splash-player`). Bunlar görselde durursa örnek kartı "uygulamanın
   ekran görüntüsü" gibi değil, "topoloji şeması" gibi görünmez.

3. Kayıt defterinde (`js/mount-core.js` → `MOUNT_EXAMPLES`) ilgili örneğin
   `image` alanını bu yola ayarla:

   ```js
   image: 'assets/examples/siper.png',
   ```

   `image` boş (`''`) bırakılırsa panel modelden **otomatik şema** üretir.
   Dosya yolu verildiğinde resim yüklenemezse (henüz eklenmemişse) panel yine
   otomatik şemaya düşer — kırık resim gösterilmez.

## Notlar

- **Çerçeveler ve notlar da taşınır.** Dışa aktarma `annotations` alanını yazar,
  yükleyici (`_mntTopoState`) geri kurar. Kullanıcının kurduğu gruplama
  çerçeveleri (örn. "ŞASİ", "Araçlar", "Görselleştirici") örneğin parçasıdır.
- Görsel harici dosya olduğu için `MFSim_Code.html` boyutunu şişirmez.
- Makul boyut (< ~500 KB) sayfa yükleme hızını korur.
- Yol **göreli** olmalı (`assets/examples/…`), başında `/` olmadan — hem alt
  yol hem kök dağıtımda çalışsın diye.


---

## Araç Performans örnekleri (`ap_*`)

Kayıt defteri: `js/cp-arac-example.js` → `AP_EXAMPLES`. Panel bileşeni `ap-example`
("Başlangıç ve Örnekler"), Araç Performans **alt topolojisinin** kenar çubuğunda.

Her girdi iki dosyaya işaret eder:

```
assets/examples/ap_<id>_topoloji.json    ← iç topoloji (format: 'mfsim-arac-example')
assets/examples/ap_<id>.png              ← panel önizlemesi
```

Örneklerin tamamı gerçek **Allison iSCAAN Bundled Report** dosyalarından kuruldu.
Rapordan doğrudan okunmayan büyüklükler türetildi:

| Büyüklük | Nereden |
|---|---|
| K-faktörü tablosu | `Engine-Converter Match` → `K = N_motor / √(T_türbin/τ)` |
| Pompa tork düşümü | aynı tablo, stall satırı: `T_net_motor − T_türbin/τ` |
| Vites verimleri | `Transmission Output Performance Summary` → `T_çıkış / (T_türbin × oran)` |
| Yuvarlanma katsayısı (Crr) | `Vehicle Wheel Power Requirements`, %0 eğim sütununa en küçük kareler |

Motor eğrisi **BRÜT** (`Gross Torque`) girilir, `Net Torque Fan On` değil — MFSim
aksesuar kaybını kendi modeliyle düşer, net girilirse kayıp iki kez sayılır.

### Yeni örnek eklemek

1. Araç Performans alt topolojisini kur (ya da bir örneği "Örneği Aktar" ile getirip düzenle).
2. Panelde **"↓ İç Topolojiyi JSON Dışa Aktar"** → `ap_<id>_topoloji.json` olarak buraya koy.
3. Ekran görüntüsünü `ap_<id>.png` olarak koy (seçim halkası, minimap ve breadcrumb gizli olsun).
4. `js/cp-arac-example.js` → `AP_EXAMPLES` dizisine girdiyi ekle:

```js
{
  id: 'ornek', name: 'Panel listesinde görünen ad',
  vehicle: 'Araç adı', subtitle: '4×4 · 13 t · 3000 SP',
  description: 'Kısa açıklama + iSCAAN başvuru numarası.',
  warning: 'Varsa çekince (doğrulanmadı / vites profili yok …). Alan yoksa uyarı bloğu çıkmaz.',
  specs: [['Motor','…'], ['Şanzıman','…']],
  image: 'assets/examples/ap_ornek.png',
  topology: 'assets/examples/ap_ornek_topoloji.json'
}
```

`tests/unit/arac-example.test.js` bu üçlüyü birbirine bağlar: kayıt defterindeki
her yol diskte olmalı, diskteki her `ap_*.json` kayıt defterinde olmalı (öksüz
dosya yok), ve her topoloji çalışır bir güç aktarma zinciri içermeli.

### Uyarılı örnekler

`warning` alanı olan girdiler panelde sarı bir uyarı bloğu ve listede `⚠` gösterir.
Şu an üç tanesi işaretli: `ypa4x4` (2957 SP'nin vites geçiş profili programda yok),
`jmma` ve `bmc4x4_25t` (kaynak rapor yalnız *Input Summary* — TK eğrisi ve vites
oranları aynı donanımlı başka rapordan alındı, doğrulanmadı).
