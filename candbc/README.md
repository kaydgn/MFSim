# CAN Çözümleyici

CAN veri yolu kayıtlarını **DBC** sinyal veritabanına göre çözer ve seçilen
sinyalleri diyagrama döker. **MFSim'den bağımsız, tek başına çalışan bir
programdır**; arayüz dilini MFSim'den alır, kodunu almaz.

    candbc/index.html + ../css/*.css + candbc/js/*.js
      → MFSim_CAN_Cozumleyici.html      (depo kökünde, tek dosya)

```bash
npm run build:can      # tek dosyayı üret
```

Üretilen dosya **çift tıklanarak** açılır: `file://` üzerinde çalışır, **sıfır
ağ isteği** yapar, yanına hiçbir şey kopyalanmaz. Yüklenen kayıt ve DBC
bilgisayardan çıkmaz — çözümleme tarayıcıda koşar.

---

## Neden ayrı bir program?

Ölçüm Görüntüleyici (`viewer/`) Excel/CSV ölçüm dosyalarını okur; oradaki
kanallar zaten sayıdır. CAN kaydında ise sayı **yoktur**: 8 baytlık ham bir
çerçeve vardır ve o baytların hangi bitinin hangi fiziksel büyüklük olduğunu
yalnız DBC söyler. Aradaki iş — bit çıkarma, ölçekleme, çoklama, değer
tabloları — ölçüm görüntüleyicisinin veri modelinde karşılığı olmayan bir
katmandır.

Bu yüzden `candbc/` **hiçbir dosyayı `js/` ya da `viewer/js/` ile
paylaşmaz.** Paylaşsaydı depoda senkron tutulması gereken üçüncü bir kopya
kümesi olur ve `viewer/sync.js`'in koruduğu kapıya yeni bir kenar eklenirdi.
Ortak olan tek şey **CSS'tir** (`../css`), o da kopyalanmıyor: build sırasında
gömülüyor.

> **`css/styles.css`'e dokunursan bu dosya da bayatlar.** `MFSim_CAN_Cozumleyici.html`
> git'e dâhil; commit'ten önce `npm run build:can` koş ve çıktıyı commit'e kat.
> CI'daki tazelik kapısı yeniden üretip `git diff --exit-code` bakıyor.

---

## Katmanlar

| Dosya | İş | DOM? |
|-------|-----|------|
| `js/can-dbc.js` | DBC ayrıştırıcı: `BO_`, `SG_`, `VAL_`, `CM_`, `BA_`, `SIG_VALTYPE_`, `SG_MUL_VAL_` | hayır |
| `js/can-log.js` | Kayıt biçimleri + kare deposu (tipli diziler) | hayır |
| `js/can-decode.js` | Bit çıkarma, işaret, IEEE float, çoklama, seri kurma | hayır |
| `js/can-chart.js` | Şerit grafiği (canvas), seyreltme, imleç | evet |
| `js/can-tree.js` | Sinyal gezgini (`vsig-*`) | evet |
| `js/can-app.js` | Dosya yükleme, sekmeler, durum çubuğu, dışa aktarma | evet |
| `js/can-example.js` | Üretilmiş gösteri veritabanı + kaydı | hayır |
| `js/can-theme.js` | Tema (Sistem/Açık/Koyu) | evet |

İlk üçü ve `can-example.js` saf: testleri Node'da doğrudan koşuyor.

---

## Dokunulmazlıklar

Bunlar tercih değil, **ölçülmüş hata sınıflarının kapısıdır.**

### 1. Bit düzeni tek yerde tanımlıdır

`cdbRawBits` (can-decode.js). Motorola (`@0`) sinyalinde adım kuralı: **bit 0'da
+15, değilse −1.** İkisini tek döngüde `startBit + i` ile yazmak Motorola'yı
sessizce bozar; program çalışmaya devam eder, sayı yanlış çıkar. Referans
değerler `tests/unit/can-decode.test.js`'te **elle hesaplandı** ve yorumda
gösteriliyor — "kodun bugün ürettiği değer" altın kabul edilmedi.

### 2. Değer tablosu HAM değere göre aranır

`VAL_` tanımları ham sayıya bağlıdır. Fiziksel değerle aramak, çarpanı 1
olmayan her sinyalde sessizce boş döner.

### 3. Kare bir sinyali taşımıyorsa ATLANIR, 0 çizilmez

Kısa DLC ya da çoklama uyuşmazlığında örnek seriye **girmez**. Sıfır yazmak
"ölçüldü ve sıfırdı" demek olurdu; atlananların sayısı `series.skipped`'ta
duruyor.

### 4. Eksik alan `null`

Bildirilmemiş `GenMsgCycleTime` → `null`. Sıfır yazmak "0 ms'de bir
gönderiliyor" iddiasıdır.

### 5. Biçim algılaması SESSİZ kalmaz

Kayıt biçimi yarıştırılarak seçilir (`cdbDetectLogFormat`); kazanan biçim,
çözülen/çözülemeyen satır sayısı ve atlanan satır örnekleri **Tanı sekmesinde**
yazılıdır. Kayıt %60 çözülüp gerisi atılırsa grafik "makul ama eksik" çıkar ve
bunu gözle kimse yakalayamaz.

### 6. DBC'de tanımı olmayan kimlikler LİSTELENİR

Ağacın altındaki "Tanımsız kimlikler" bölümü, yanlış DBC yüklemekle boş kayıt
yüklemeyi ayırt eden tek işarettir.

### 7. Zaman ekseni saniyedir

Depoda zaman **daima saniye**; dönüşüm biçim tanımındaki `timeScale` ile
yapılır (PCAN ms, BusMaster ss:dd:sn:ms). Zaman damgası olmayan kayıtta kare
sırası eksen olur ve bu durum `store.noTime` ile işaretlenip söylenir.

### 8. Sinyal BASAMAKLIDIR — ara değerlenmez

İmleç iki kare arasında **önceki** değerde kalır (`cdbSampleAt`). 20 ms'de bir
gelen bir mesajın kareleri arasında değer değişmez; ara değerlemek uydurmadır.

### 9. Seyreltme tepe değerleri KORUR

Piksel sütunu başına en küçük/en büyük çizilir. "Her N'inci örneği al"
seyreltmesi bir gerilim sıçramasını sessizce siler.

### 10. Grafik ölçüleri Ölçüm Görüntüleyici'yle AYNI

`CDB_TR` sabitleri `js/trace-view.js`'teki `VE_TR` ile aynı değerleri taşır
(şerit boşluğu 7, taban yükseklik 54, oluk 62, eksen 30, ad kutucuğu 7×5…).
İki program yan yana açıldığında aynı aletin iki penceresi gibi dursun diye.
Ad bloğu **olukta**, çizim alanının dışındadır: içeri konan yatay lejant
eğrilerin üstüne biniyor (orada ölçülmüş).

---

## Desteklenen kayıt biçimleri

| Biçim | Örnek satır | Zaman |
|-------|-------------|-------|
| candump (`ID#VERİ`) | `(1656664830.024244) can0 123#DEADBEEF` | s |
| candump (okunur) | `can0 123 [8] DE AD BE EF 00 11 22 33` | s |
| Vector ASC | `0.000000 1 100 Rx d 8 01 02 …` (+ CAN FD) | s |
| PEAK PCAN-Trace | `1) 1000.0 0018 8 01 02 …` (v1.x ve v2.x) | ms |
| BusMaster | `20:16:19:0246 Rx 1 0x18fef100 x 8 01 02 …` | ss:dd:sn:ms |

Otomatik algılama yanılırsa üst banttaki **Biçim** listesinden elle seçilir.
Yeni bir biçim eklemek: `CDB_LOG_FORMATS`'a bir eşleyici + `tests/unit/can-log.test.js`'e
gerçek bir örnek satır. Kapı orada: **her örnek YALNIZ kendi biçiminde
çözülmeli** — bir eşleyici başkasının satırını çözerse kimlik ve veri yer
değiştirir.

## Testler

| Dosya | Kapsam |
|-------|--------|
| `tests/unit/can-dbc.test.js` | DBC söz dizimi: çoklama, `VAL_`, tırnak içindeki `;`, çok satırlı `CM_`, bozuk girdide uyarı |
| `tests/unit/can-decode.test.js` | **Bit düzeni** (Intel/Motorola, elle hesaplanmış referanslar), işaret, IEEE float, çoklama, kısa kare |
| `tests/unit/can-log.test.js` | Beş biçim + biçim yarışı + kare deposu + çözülemeyen satır sayacı |
| `tests/unit/can-chart.test.js` | Eksen adımı, imleç örneklemesi, ondalık türetme + **gidiş-dönüş** (üret → yaz → ayrıştır → çöz → karşılaştır) |
| `tests/unit/source-hygiene.test.js` | `candbc/js/` üst-seviye ad çakışması ve kontrol karakteri |
