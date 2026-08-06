# MFSim Ölçüm Görüntüleyici

MFSim'in **Excel/CSV içe aktarma + diyagram** özelliğinin tek başına çalışan
sürümü. Çıktı **tek bir HTML dosyası**: çift tıkla, açılır. Kurulum yok,
sunucu yok, internet yok, parola yok — veri bilgisayardan çıkmaz.

```
npm run build:viewer      →  MFSim_Olcum_Goruntuleyici.html   (depo kökü, ~915 KB)
```

## Ne yapar

- `.xlsx` / `.xlsm` / `.csv` / `.tsv` ölçüm dosyası açar (Vector CANoe çıktısı
  ve benzerleri) — **İçe Aktar** düğmesiyle ya da dosyayı pencereye
  **sürükleyip bırakarak**
- Başlık satırını, birimleri, mesaj adlarını (`EngineData::EngSpeed [1/min]`)
  ve ondalık ayırıcıyı (`1.234,56` ↔ `1,234.56`) kendi çözer
- X eksenini önerir (genelde zaman), kullanıcı değiştirebilir
- Seçilen sütunları CANoe tarzı **şerit diyagramına** döker: her sinyal kendi
  şeridinde, kendi Y ekseniyle, hepsi tek X ekseninde
- Ayrık kanalları basamak, metin kanallarını (`1C` / `2L`) durum şeridi olarak
  çizer; seyrek CAN sinyallerinde örnekle-ve-tut uygular
- İmleç, yakınlaştırma, şerit ayırma/birleştirme, logaritmik eksen, tablo kipi
- **Tema işletim sistemini izler** (açık/koyu); sağ üstteki düğme
  Sistem → Açık → Koyu → Sistem döngüsünü yürütür ve seçim hatırlanır

## Ne yapmaz

Simülasyon yok. Topoloji, çözücü, motor/vites/takoz modülleri, harita, rapor —
hiçbiri burada değil. Bu program bir **ölçüm okuyucu**dur.

3B dağılım kipi de yok: Three.js gerektiriyordu ve tek dosyaya ~600 KB
ekliyordu. Kodu duruyor, yalnızca kip düğmesi listede değil.

## Dosyalar

| Dosya | Durum |
|---|---|
| `js/xlsx-read.js` | **MFSim'den birebir kopya** |
| `js/measure-core.js` | **birebir kopya** |
| `js/measure-import.js` | **birebir kopya** |
| `js/measure-import-ui.js` | **birebir kopya** |
| `js/signal-tree.js` | **birebir kopya** |
| `js/trace-view.js` | kopya + **iki yerel fark** (aşağıda) |
| `js/theme.js` | yalnızca burada — iki tema, işletim sistemini izler |
| `js/dropzone.js` | yalnızca burada — sürükle-bırak |
| `js/board.js` | yalnızca burada — pano katmanı |
| `js/app.js` | yalnızca burada — açılış |
| `index.html` | yalnızca burada — kabuk |
| `build.js` | yalnızca burada — tek dosya üretimi |
| CSS | **kopyalanmadı**, `../css` ile ortak |

## MFSim'den düzeltme taşıma

Kopyalar bilerek **birebir** tutuldu; taşımak düz bir `cp`:

```bash
# Fark var mı?
for f in xlsx-read measure-core measure-import measure-import-ui signal-tree; do
  diff -q js/$f.js viewer/js/$f.js
done
diff js/trace-view.js viewer/js/trace-view.js    # iki bilinen fark çıkmalı

# Taşı
cp js/xlsx-read.js viewer/js/xlsx-read.js
npm run build:viewer && npm test
```

`trace-view.js`'in **bilinen iki farkı** (ikisi de `VIEWER FARKI` yorumuyla
işaretli, elle uzlaştırılır):

1. Görünüm kipi listesinden `scatter3d` çıkarıldı.
2. Boş durum metni: MFSim "Çözüm sonucu yok / Çözücüyü Aç" der; burada çözücü
   yok, "Henüz ölçüm yok / Ölçüm Verisi İçe Aktar" denir. Ayrım `veSolverRun`
   varlığına bakarak yapılıyor, dalın kendisi duruyor.

`theme.js` **birebir kopya değil**, görüntüleyiciye ait. MFSim'de tema Ayarlar
panelinden seçilen bir tercih ve on altı seçenek var; burada tek başına, günün
her saatinde açık duran bir program söz konusu, o yüzden varsayılan işletim
sisteminin kendisi. MFSim'in `js/theme.js`'inden yalnızca `veThemeRgba` birebir
alındı (canvas'ın CSS değişkeni çözememesinin köprüsü) — o fonksiyon upstream'de
değişirse elle taşınır.

`board.js` MFSim'deki `js/results.js` + `js/graphics.js`'in yalnızca panoyla
ilgili yüzeyini karşılar. Oralarda pano mantığı değişirse **elle** taşınması
gereken tek dosya budur — dosyanın başındaki yorum hangi fonksiyonun nereden
geldiğini satır numarasıyla söyler.

## Testler

```bash
npm test                                          # birim (viewer-board dahil)
npx playwright test tests/e2e/viewer.spec.js      # uçtan uca, file:// üzerinden
```

- `tests/unit/viewer-board.test.js` — panonun tek kuralı: **bir panoda tek
  ölçüm dosyası**. İki dosyanın sütunları karışırsa seriler indeks hizasıyla
  çizilir; grafik makul görünür, veri yanlış olur.
- `tests/e2e/viewer.spec.js` — **üretilen tek dosyayı** `file://` üzerinden
  test eder (modüler kaynağı değil): gerçek `.xlsx` baytları → gerçek şeritler,
  tuvale gerçekten çizim, sıfır ağ isteği.

Fixture MFSim'in içe aktarma testiyle ortak: `tests/e2e/helpers/canoe-xlsx.js`.
