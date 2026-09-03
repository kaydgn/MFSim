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
| `js/can-j1939.js` | 29 bitlik kimlik → PGN / kaynak / hedef adresi | hayır |
| `js/can-log.js` | Kayıt biçimleri + kare deposu (tipli diziler) | hayır |
| `js/can-match.js` | **Kanal çözümlemesi**: kayıttaki kimlik ↔ DBC mesajı | hayır |
| `js/can-decode.js` | Bit çıkarma, işaret, IEEE float, çoklama, seri kurma | hayır |
| `js/can-chart.js` | Şerit grafiği (canvas), seyreltme, imleç | evet |
| `js/can-tree.js` | Sinyal gezgini (`vsig-*`) | evet |
| `js/can-app.js` | Dosya yükleme, sekmeler, durum çubuğu, dışa aktarma | evet |
| `js/can-example.js` | Üretilmiş gösteri veritabanı + kaydı | hayır |
| `js/can-theme.js` | Tema (Sistem/Açık/Koyu) | evet |

İlk beşi ve `can-example.js` saf: testleri Node'da doğrudan koşuyor.

---

## Dokunulmazlıklar

Bunlar tercih değil, **ölçülmüş hata sınıflarının kapısıdır.**

### 1. Bit düzeni tek yerde tanımlıdır

`cdbRawBits` (can-decode.js). Motorola (`@0`) sinyalinde adım kuralı: **bit 0'da
+15, değilse −1.** İkisini tek döngüde `startBit + i` ile yazmak Motorola'yı
sessizce bozar; program çalışmaya devam eder, sayı yanlış çıkar. Referans
değerler `tests/unit/can-decode.test.js`'te **elle hesaplandı** ve yorumda
gösteriliyor — "kodun bugün ürettiği değer" altın kabul edilmedi.

### 1b. Eşleştirme J1939'da PGN ÜZERİNDENDİR — ve bu SÖYLENİR

Bir J1939 DBC'sindeki mesaj kimliği **kaynak adresi içerir** ve o adres,
veritabanını yazanın seçtiği rastgele bir değerdir. Gerçek otobüste aynı mesaj
başka bir adresten gelir. Kullanıcının veritabanı (950 mesaj) ve gerçek araç
kaydı (81 ayrı kimlik) karşılaştırıldığında **ölçüldü**:

| Eşleştirme | Sonuç |
|-----------|-------|
| Tam kimlik | **1 / 81** |
| J1939 PGN (kaynak adresi yok sayılarak) | **66 / 81** |
| Hiç eşleşmeyen | 14 / 81 (hepsi üretici tanımlı PGN) |

Yani kimliği bire bir karşılaştıran bir çözümleyici gerçek bir J1939 kaydında
pratikte **hiçbir şey çözemez** — ve patlamaz da, sadece boş bir ağaç gösterir.

Dolayısıyla: tam eşleşme yoksa, 29 bitlik çerçevelerde kaynak adresi (PDU1'de
hedef adresi de) yok sayılıp PGN eşleştirilir. Ama bu bir **varsayımdır** ve
körü körüne yapılmaz:

* ağaçta satırın kendisinde **PGN** rozeti durur,
* kaynak adresi kanalın **adının parçasıdır** (`EEC1 · SA 0x00`),
* Tanı sekmesi kaç tanesinin hangi yolla eşleştiğini sayar,
* üst banttaki **J1939 PGN** düğmesiyle kapatılabilir.

**PDU1/PDU2 ayrımı atlanamaz:** PF < 240 ise PS alanı *hedef adrestir* ve
PGN'e girmez. Atlanırsa TSC1 gibi adresli mesajlar her hedef için ayrı bir
PGN'e düşer ve hiçbiri bulunamaz.

`VECTOR__INDEPENDENT_SIG_MSG` eşleştirmeye **girmez**: CANdb++'ın sahipsiz
sinyalleri topladığı kaptır, kimliği `0xC0000000` → PGN 0, ve eşleştirmeye
sokulursa gerçek TSC1'i gölgeler.

### 1c. Aynı mesajı iki kaynak gönderiyorsa BİRLEŞTİRİLMEZ

Ölçüldü: kullanıcının kaydında TSC1 **yedi ayrı kaynak adresinden** geliyor.
Tek bir "TSC1" satırında toplamak yedi ECU'nun isteğini tek eğriye karıştırmak
olurdu — makul görünen, yanlış bir eğri. Her kaynak kendi satırında durur ve
adresiyle etiketlenir. Bu yüzden programın çalışma birimi DBC mesajı değil
**kanaldır**: kayıtta gerçekten geçen bir kimlik + çözüldüğü tanım.

Aynı sebeple **ağaç DBC'den değil kayıttan sürülür.** 950 mesajlı bir
veritabanında kayıtta 81 kimlik geçiyor; ağacı DBC'den sürmek 869 satırı
boşuna göstermek demek.

### 1d. Aynı PGN'i birden fazla tanım paylaşıyorsa seçim GÖRÜNÜR

Ölçüldü: kullanıcının veritabanında 7 PGN'i birden fazla mesaj paylaşıyor
(`CCVS1` / `CCVS1_J3` / `CCVS1_Trip_Recorder`). Seçim öncelik, DLC, adın kopya
olup olmaması ve ad uzunluğuna göre puanlanır; **adaylar ve seçilen** Tanı
sekmesinde yazılır. Orada asıl soru da cevaplanır: adayların sinyal yerleşimi
birebir aynı mı? Kullanıcının dosyasında 13 belirsizliğin **13'ü de aynıydı**
— yani seçim sayıyı değiştirmiyordu, ve bunu söylemek "belirsizlik var"
demekten çok daha kullanışlı.

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
| BusMaster | `20:16:19:0246 Rx 1 0x18fef100 x 8 01 02 …` | ss:dd:sn:**kesir** |

> **BusMaster'ın zaman kesri milisaniye DEĞİLDİR.** Alan sabit genişliktedir ve
> kullanıcının kaydında ölçüldü: dört haneli, en büyük değeri 9999, saniye tam
> ondan sonra artıyor (`0:0:0:9998` → `0:0:1:0004`). Yani birim saniyenin on
> binde biri. 1000'e bölen bir okuma ekseni on kat uzatır **ve** her saniye
> sınırında zamanı geriye atar. Bölen bu yüzden alanın **yazılı
> genişliğinden** türetiliyor, sabit yazılmıyor.

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
| `tests/unit/can-j1939.test.js` | PDU1/PDU2 ayrımı, PGN çıkarma, eşleştirme sırası (tam → PGN → yok), Vector kabının dışlanması, belirsizlik puanlaması, aynı mesajın iki kaynağının BİRLEŞTİRİLMEMESİ |
| `tests/unit/source-hygiene.test.js` | `candbc/js/` üst-seviye ad çakışması ve kontrol karakteri |
