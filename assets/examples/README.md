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

### Kanonik yerleşim — hepsi AYNI ızgarada

Örneklerin `x`/`y` değerleri elle konmaz: tek kaynak
`js/cp-arac-performans.js` → **`VE_ARAC_PERFORMANS_LAYOUT`**. Izgara PORT
GEOMETRİSİNDEN türetildi (`js/components.js` → `vePortOffset`: sağ kenarda K
port varsa r'inci port `h·(r+1)/(K+1)`'de durur), çünkü yerleşim bunu saymazsa
bağlantı çizgisi eğik çıkar:

| Kural | Değer | Neden |
|---|---|---|
| Zincir sütun adımı | 130 px (65 kutu + 65 açıklık) | düzenli ızgara |
| Dal sütun adımı | 200 px (65 + 135) | dik açılı telin dikey bacağı iki sütunun ORTASINDAN geçer; 130 px'te o kanal düğüm ADININ içine düşüyordu (ölçüldü: en geniş ad 6.77 px/karakter) |
| Şaft ekseni | `ly 150 + 30` | 65×60 kutuların tek portu %50'de |
| Motor `ly` | **142**, 190 değil | motor 66×76 ve çıkışı `ly+38`'de — 142+38 ekseni verir |
| Diferansiyel | eksenden ∓100 px, beslediği ÇİFTİN ortasında | transfer çıkışları eksenin ±10 px'inde → iki dal EŞİT ve ZIT sapar |
| Tekerlek adımı | 100 px (60 kutu + 40 açıklık) | tekerlek ADI kutunun altında; 80 px adımda alttaki kutuya değiyordu |
| Bağlantı biçimi | zincir `curve`, dallar `stepped` | eşit y'de `curve` düz yatay çizgiye çöker; dallar dik açı ister |
| `data.labelPos` | motor + transfer `top`, iki eşleştirme aracı `right` | adları kutudan çok geniş; ortada dururken tellerin şeridine oturuyorlardı |

**Bileşen kümesi** referans topolojiyle aynı: Çözücü, Şanzıman Kontrol, Araç,
Motor, Tork Konvertörü, Şanzıman, Propşaft, Transfer, Motor-Konvertör
Eşleştirme, **Motor-Şanzıman Eşleştirme**. Diferansiyel ve tekerlek SAYISI
projeye göre değişir (4×4 → 2/4, 6×6 → 3/6) — orada genelleme yok.
"Başlangıç ve Örnekler" (`ap-example`) topolojiye GÖMÜLMEZ; yükleyici onu
yerleşimin sol üst köşesine geri koyar (bu yüzden o köşe boş bırakılır).

Her iki eşleştirme aracı da motorun AYNI çıkış portundan beslendiği için ikisi
de Konvertör sütununda, alt alta durur: dik açılı telin İLK ayağı şaft ekseninde
yatay ilerliyor, hedef daha sağda olsa o ayak Konvertör kutusunun içinden
geçerdi.

`tests/unit/arac-example-layout.test.js` kodu ve veriyi birbirine bağlar:
örnekler yerleşim sabitinden sapamaz (6×6'da fan dışı her şey + fan sütunları),
zincir yatay olmaktan çıkamaz, fan simetrisini kaybedemez, hiçbir tel bir
bileşenin ya da bir ADIN üstünden geçemez, "Örneği Aktar"ın eklediği düğüm
boş köşeye düşer.

**Yerleşim değişirse önizlemeler BAYATLAR** — `ap_*.png` topolojinin ekran
görüntüsüdür. Yeniden üretme akışı yukarıda ("Yeni görsel eklemek"): örneği
kur, seçim halkası + tutamaklar + minimap + breadcrumb gizli, `#ve-canvas-wrapper`
kırpılır (1600×950 görünüm → 1316×805). Dosyalar uygulamanın kendi dışa
aktarma biçiminde (`JSON.stringify(…, null, 2)`) yazılır.

### Uyarılı örnekler

`warning` alanı olan girdiler panelde sarı bir uyarı bloğu ve listede `⚠` gösterir.
Şu an üç tanesi işaretli: `ypa4x4` (2957 SP'nin vites geçiş profili programda yok),
`jmma` ve `bmc4x4_25t` (kaynak rapor yalnız *Input Summary* — TK eğrisi ve vites
oranları aynı donanımlı başka rapordan alındı, doğrulanmadı).
