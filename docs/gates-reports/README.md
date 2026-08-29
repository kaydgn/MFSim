# Gates FEAD Raporları — arşiv ve künye indeksi

Tedarikçiden (Gates) dönen **Accessory Belt Drive System** raporlarının ham
PDF'leri ve künyeleri. Amaç: bir raporu **bir kez** depoya koymak, sonraki her
oturumun onu yeniden yüklemeye gerek kalmadan bulup okuyabilmesi.

## Bu klasör hiçbir şeye dokunmuyor

Ölçüldü: `build.js` yalnız `js/` ve `assets/examples/` klasörlerini tarıyor,
`source-hygiene` kapısı `js/ · viewer/js/ · css/ · index.html`'e bakıyor, CI'ın
Pages adımı ise adı açıkça yazılı dosyaları kopyalıyor
(`MFSim_Code.html` · `pwa/` · `sw.js` · `assets/` · üç vendor dosyası).
`docs/` bunların hiçbirinde yok → buraya dosya koymak build'i, testleri ve
yayını **etkilemez**.

> **Klasör seçimi bilinçli: `assets/` DEĞİL.** CI'da
> `if [ -d assets ]; then cp -r assets _site/assets; fi` satırı var; oraya konan
> her dosya Pages'te doğrudan indirilebilir bir URL olur. Buradaki dosyalar
> yayınlanmaz — ama **depo herkese açık** (`kaydgn/MFSim`, public), yani
> github.com üzerinden erişilebilirler. Git geçmişi kalıcıdır: sonradan silmek
> dosyayı geçmişten çıkarmaz.

## Dosya adı kuralı

```
pdf/<rapor>_<kayış>_<ayırt edici>_<tarih>.pdf
    AG00976_8PK1715HD_Ten-250-110_2025-06-05.pdf     ← ayırt edici: gergi konumu
    AG0868_8PK1020HD_E9843-22.5Nm_2022-12-27.pdf     ← ayırt edici: yay momenti
```

**Ayırt edici alan rapordan rapora değişir** ve revizyonları birbirinden ayıran
şey ne ise odur: AG00976'da gergi pivotu, AG0868'de yay momenti, AG00902'de
kayış boyu. Sabit bir alan seçmek revizyonların adını çakıştırırdı.

Aynı sistemin birden çok revizyonu varsa **ayrı dosya** olur; revizyonlar
birbirinin üzerine yazılmaz. Kayış boyu veya gergi pivotu değişen her rapor
başka bir sistemdir (bkz. `CLAUDE.md` → *"Gates Belt Data BMC'ye KONMAZ"*).

## PDF'i okurken (sonraki oturumlar için)

CLI PDF araçları (`pdftotext`, `qpdf`, `mutool`) bu ortamda **kurulu değil**.
Çalışan yol ölçüldü:

```bash
pip3 install --quiet pymupdf     # kuruluyor (ölçüldü)
```

- **Metin ve tablo** için `page.get_text()` — ucuz, tercih edilen yol.
- **Yerleşim** için sayfayı görüntüye çevir (`page.get_pixmap(dpi=...)`).
  Gates çıktısında metin koordinatları döndürülmüş geliyor; AG00976'nın sayfa
  düzeni tam bu yüzden görüntüden okundu. Pahalıdır, ancak gerektiğinde.

**Sayfa haritasını aşağıdaki tabloya yaz.** İndeksin asıl değeri bu: doğru
raporun doğru sayfası, on iki sayfa açmadan bulunur.

## Rapordan çıkan sayı NEREYE gider

| Ne | Nereye | Neden |
|----|--------|-------|
| Referans değerler (span, sarım, gerginlik, hubload, konum tablosu) | `tests/fixtures/fead-validation.js` | Doğrulama kapısı orada koşuyor (bugün 2095 değer) |
| Kanvasa kurulabilir örnek | `js/fead-model.js` → `VE_FEAD_EXAMPLES` | Tek tıkla model |
| Ham belge | bu klasör | Kanıt / denetim izi |

PDF **kaynak**, fixture **çalışma kopyası**. Bir oturumun her seferinde PDF
okuması pahalı; fixture okuması bedava ve testli.

## İndeks

`durum` sütunu: **PDF** = ham belge burada · **veri** = sayıları fixture'da,
PDF henüz yok.

| Rapor | Gates | Kasnak | L_eff | Sistem | Durum | PDF | Kapsam |
|-------|-------|-------:|------:|--------|-------|-----|--------|
| AG0868-4PK | 9.37 | 3 | 1013 | BMC-Otomotif 6 sil. · ikincil klima (SD7H15) · E9843 @16 Nm | **PDF** | `AG0868_4PK1013HD_E9843-16Nm_2022-12-27.pdf` | **TAM** 11/11 |
| AG0868-6PK | 9.37 | 3 | 1018 | aynı sistem · 6PK · E9843 @19 Nm | **PDF** | `AG0868_6PK1018HD_E9843-19Nm_2022-12-27.pdf` | **TAM** 11/11 |
| AG0868 | 9.37 | 3 | 1020 | aynı sistem · 8PK · E9843 @22.5 Nm | **PDF** | `AG0868_8PK1020HD_E9843-22.5Nm_2022-12-27.pdf` | **TAM** 11/11 |
| AG00810 | 4.32 | 4 | 1214 | BMC Otomotiv TTA-6x6 · 250 A alternatör · T38519 · 16.09.2021 | **PDF** | `AG00810_10PK1215HD_T38519-v8_2021-09-16.pdf` | **TAM** 11/11 |
| AG00879 | 9.40 | 5 | 1392 | Anadolu Isuzu 6x6 Cummins · ikincil alternatör · T38665 @31 Nm · 17.05.2023 | **PDF** | `AG00879_8PK1392HD_T38665-31Nm_2023-05-17.pdf` | **TAM** 12/12 |
| AG00686 | 9.40 | 4 | 1475 | BMC 6 sil. · CRK ø160 / A_C ø127 · T38624 @24.6 Nm CW · 07.09.2023 | **PDF** | `AG00686_8PK1475HD_T38624-24.6Nm_2023-09-07.pdf` | **TAM** 11/11 |
| AG00686-1520 | 9.40 | 4 | 1520 | aynı gergi · CRK ø172 / A_C ø137 · @22.2 Nm · 07.09.2023 | **PDF** | `AG00686_8PK1520HD_T38624-22.2Nm_2023-09-07.pdf` | **TAM** 11/11 |
| AG00902-1275 | 9.55 | 4 | 1275 | BMC Otomotiv Valeo TM21 · ø127 · 08.12.2023 | **PDF** | `AG00902_8PK1275HD_E9843-22Nm_2023-12-08.pdf` | alıntı 5/11 |
| AG00902-1300 | 10.01 | 4 | 1302 | aynı sistem · TM21 · farklı kasnak çapları · 30.11.2023 | **PDF** | `AG00902_8PK1300HD_E9843-22Nm_2023-11-30.pdf` | alıntı 5/11 |
| AG00894 | 9.40 | 6 | 1739 | BMC Otomotiv · İKİ klima (TM31 + SD7H15) · alternatör YOK · 18.09.2023 | **PDF** | `AG00894_8PK1738HD_E9843-23Nm_2023-09-18.pdf` | alıntı **6/12** |
| AG00976 1668@-240/115 | 13.02 | 6 | 1667 | BMC Otomotif FEAD 5 · Cummins ikincil tahrik | veri | — | — |
| AG00976 1655@-250/104 | 13.02 | 6 | 1656 | aynı sistem · revizyon | veri | — | — |
| AG00976 1705@-250/110 | 13.02 | 6 | 1705 | aynı sistem · revizyon | veri | — | — |
| AG00976 1715@-250/110 | 13.02 | 6 | 1715 | aynı sistem · **Corrected-IDR1** · 05.06.2025 | veri | — | — |

### Sayfa düzeni — TEK aile, iki varyant

> **DÜZELTME.** Bu bölüm bir tur önce *"Gates çıktısı iki düzende geliyor
> (A: 11 sayfa, B: 5 sayfa)"* diyordu. **İki örnekten yapılmış bir genellemeydi
> ve yanlıştı**: 5 sayfalık belgeler ayrı bir düzen değil, tam raporun
> ALINTISI (aşağıya bakınız).

Tam rapor tek bir düzene sahip; tek değişkeni `Belt Slip / Tension Analysis`
bölümünün bir mi iki sayfa mı olduğu:

| s | 11 sayfalık varyant | | s | 12 sayfalık varyant |
|--:|---------------------|-|--:|---------------------|
| 1 | Summary of Results | | 1 | Summary of Results |
| 2 | Geometric Analysis 1/2 | | 2 | Geometric Analysis 1/2 |
| 3 | Geometric Analysis 2/2 | | 3 | Geometric Analysis 2/2 |
| 4 | Pulley Alignment Sensitivity | | 4 | Pulley Alignment Sensitivity |
| 5 | Belt Slip / Tension | | 5 | Belt Slip / Tension **1/2** |
| 6 | Pulley Hubload (**Peak**) | | 6 | Belt Slip / Tension **2/2** |
| 7 | Pulley Hubload (Mean) | | 7 | Pulley Hubload (**Peak**) |
| 8 | Belt Rib Fatigue 1/2 | | 8 | Pulley Hubload (Mean) |
| 9 | Belt Rib Fatigue 2/2 | | 9 | Belt Rib Fatigue 1/2 |
| 10 | System Vibration | | 10 | Belt Rib Fatigue 2/2 |
| 11 | Design Notes | | 11 | System Vibration |
| | | | 12 | Design Notes |

**İki sütun da ÖLÇÜLDÜ.** Sol sütun altı tam raporda (AG00686 ×2 · AG00810 ·
AG0868 ×3), sağ sütun AG00879'da — o rapor on iki sayfasının tamamını taşıyor
(bkz. bir sonraki bölüm). Bir tur önce sağ sütun *"çıkarım"* diye işaretliydi;
artık değil.

### ÜÇ PDF TAM RAPOR DEĞİL — ALINTI

> **DÜZELTME.** Bu bölüm bir tur önce *"DÖRT PDF"* diyor ve AG00879'u da
> alıntı sayıyordu. **YANLIŞTI**: AG00879'un sayfa AĞACI beş sayfa gösteriyor
> (pymupdf de öyle sayıyor) ama on iki sayfanın tamamı dosyanın İÇİNDE ve
> hepsi aynı tasarıma ait — on ikisinin de `Design:` alanı `AG00879_ANADOLU`.
> Depodaki okuyucu (`tests/helpers/gates-pdf.js`) nesneleri doğrudan
> gezdiği için onları görüyor.

Kolay kaçırılan ve pahalı bir tuzak: bir bölümü PDF'te bulamamak, o bölümün
**raporda olmadığı** anlamına gelmiyor. Altbilgideki `Page N of M` bunu ele
veriyor.

| Rapor | Okunan | Gerçek | Eksik sayfalar |
|-------|-------:|-------:|----------------|
| AG00686 ×2 · AG00810 · AG0868 ×3 | 11 | 11 | **TAM** |
| AG00879 | 12 | 12 | **TAM** (sayfa ağacı 5 gösteriyor) |
| AG00894 | 6 | 12 | 4, 7, 9, 10, 11, 12 |
| AG00902-1275 | 5 | 11 | 4, 6, 8, 9, 10, 11 |
| AG00902-1300 | 5 | 11 | 4, 6, 7, 9, 10, 11 |

Üçünde **tepe yük, yorulma, titreşim ve hizalama sayfaları yok**.

Bu denetim artık **testli** (`tests/unit/gates-archive.test.js`) — yeni bir PDF
eklendiğinde elle koşturulacak bir betik değil, `npm test`'in bir parçası.

> **Altbilgi tek satırdır ve parçaları BİRLEŞİK** — ölçüldü:
> `…18:30:03Page 1 of 119.37.0.0North America`. Yani sayfa toplamı (11) Gates
> sürümüne (9.37.0.0) yapışıyor ve düz bir kalıp **119** okuyor: rapor
> "eksik sayfalı" görünür, oysa tamdır. `pageMarker` bunu çözüyor.

### Fixture kaynağına karşı DOĞRULANDI

Arşive giren on rapor `tests/fixtures/fead-validation.js`'te zaten kayıtlıydı,
ama çıkarma elle yapılmıştı ve hiç doğrulanmamıştı. PDF'ler gelince programatik
olarak karşılaştırıldı:

```
karşılaştırılan değer : 290   (X · Y · pitch · effective · span · wrap
uyuşmazlık            :   0    + tasarım gerginliği · kol boyu · yay momenti
                               · yay oranı · boy toleransı)
```

Elle çıkarılmış veri kaynağına **sadık**. Bu denetim yalnız PDF depoda olduğu
için mümkün oldu — arşivin ilk somut karşılığı.

Denetim `Geometric Analysis, Sheet 1 of 2` sayfasını **başlıktan** buluyor,
sayfa numarasından değil: alıntılarda o bölüm 2. sayfada ama tam raporlarda da
2. sayfada olsa bile numaraya güvenmek kırılgan olurdu.

**Ölçülen boşluk:** `CLAUDE.md` doğrulama kapısını *"17 Gates raporu"* diye
tarif ediyor; fixture'dan sayılan kayıt **14** (yedi aile). Aradaki üç rapor ya
kısmen çıkarılmış ya da hiç girmemiş. Elindeki PDF'ler geldiğinde bu fark
kendiliğinden görünür olacak — indeksin ikinci işi bu.

## Arşiv KAPI oldu — testler kaynağı okuyor

Arşivin asıl karşılığı "PDF'ler duruyor" değil: **testler artık raporları
doğrudan okuyor.** İkinci bir kopya yok, dolayısıyla ayrışma da yok.

| Dosya | Ne yapar |
|-------|----------|
| `tests/helpers/gates-pdf.js` | Gates PDF'inden metin okur (saf Node + `zlib`, yeni bağımlılık yok) |
| `tests/helpers/gates-vibration.js` | "System Vibration Analysis" sayfasındaki girdileri okur |
| `tests/unit/gates-archive.test.js` | Fixture'ı ve okuyucuyu arşive bağlayan kapı |

Okuyucu **doğrulandı**: fixture'ın 284 statik değeri (X · Y · pitch · effective
· span · wrap · gergi künyesi) on raporun tamamında **0 uyuşmazlıkla** geri
üretiliyor — ve aynı sonuç ayrıca `pymupdf` ile de alındı.

Üç ayrıntı çözülmek zorunda kaldı, üçü de sessiz kusur üretiyordu:

| Ayrıntı | Kaçırılırsa |
|---------|-------------|
| Font başına ToUnicode (birleştirme YASAK) | Dört raporda çöp metin — glif 44 → `space`/`A`/`#`/`@`/`G` |
| Eksi işareti AYRI çizim çağrısı (`["-","72.00"]`) | Koordinat mutlak değeriyle okunur → kasnak aynalanır |
| Nesne akışları (ObjStm) | AG00894'te tek font bile bulunamıyor |

## Ölçülen üç düzeltme — burulma kalibrasyonu

Titreşim sayfası testin **tahmin ettiği** ya da *"bilinmiyor"* dediği şeyleri
açıkça yazıyor. Üçü de düzeltildi:

| # | Neydi | Kaynak ne diyor |
|---|-------|-----------------|
| 1 | Krank mili ataleti beş sistem için **0.7'ye sabit** | Sistem başına **0.15 / 0.5 / 0.7** — 0.7 yalnız takımın DIŞINDAKİ AG00810'da doğru. Fixture doğru değeri iki sistemde zaten taşıyordu, test okumuyordu |
| 2 | AG00810'un gergi kasnak kütlesi **"BİLİNMİYOR"** | Raporun kendi sayfası: **0.80 kg** |
| 3 | NF referanslarının üçü kaynağıyla uyuşmuyor | `11.87 ↔ 12.61` · `13.35 ↔ 12.61` · `13.29 ↔ 15.05`. Gates SÜRÜM farkı DEĞİL — damgalar birebir aynı (9.37 / 9.40 / 4.32) |

**KALİBRASYON TAKIMI DEĞİŞMEDİ** ve bu önemli: aynı beş sistem, RMS %5.26 →
**%6.13**, en kötü %9.73 → **%9.47** (kapı `<8` / `<10`). Yani bu bir köken
düzeltmesi, model düzeltmesi değil.

**AG00810'un gerekçesi DEĞİŞTİ.** Gerçek kütleyle 20.3 → **17.55 Hz**
(Gates 15.05, +%16.6). Hâlâ bandın dışında ama artık *"veri eksik"* değil,
**gerçek model sapması**. AG00879 de arşivle ölçülebildi (fixture'da atalet
verisi HİÇ yoktu): **25.06 ↔ 22.11 Hz**, +%13.4 — o da dışarıda.

Kapı **altı mutasyonla** ölçüldü, altısı da kırmızı: krank ataletini yine 0.7'ye
sabitleme, NF'i yine fixture'dan alma, kasnak kütlesini geçmeme, eksi işaretini
yutma, ObjStm genişletmesini kapatma, sayfa altbilgisi düzeltmesini geri alma.

## Hâlâ açık duran iki kapı

**1 · Tepe yük tablosu — yedi tam rapor.** `CLAUDE.md` özet raporun tepe yük
tablosunu `KALİBRE DEĞİL` diye damgalıyor; gerekçesi *"kümede tek bir tepe
değeri yok"*. Tam raporun 6. sayfası (12 sayfalıkta 7.) tam o tablo ve
**yedisinde de dolu**: AG0868 ×3 (4/6/8 kaburga · 258/301/356 N), AG00686 ×2
(766 / 609 N), AG00810 (10 kaburga · 759 N), AG00879 (476 N). AG00976'nınkiyle
sekiz eder. AG0868'in üçü ayrıca **kontrollü bir deney** — aynı kasnaklar, aynı
duty, aynı sıcaklık; değişen yalnız kaburga ve gerginlik.

**2 · `Pulley Alignment Sensitivity`** — tam raporun 4. sayfası, modelde hiç
yok. `CLAUDE.md`: *"`alignmentAllowance` VAR ama düz kasnakların açısal
kaçıklığını (ψ) GİRDİ olarak istiyor ve MFSim o alanı sormuyor."* Rapor ψ'yi
veriyor (AG00686: fleeting 0.90° · IDR 0.33° · TEN 1.20° · izin verilen eksenel
offset 3.93 / 1.49 mm).

İkisi de henüz yapılmadı; arşivin gerekçesi olarak burada duruyor.

## ARŞİVDE OLMAYAN BİR KAYNAK — E9843 parça çizimi

Kullanıcı 2026-08-29'da bir gergi **parça çizimi** gönderdi (*"Genelde hemen
hemen tüm otomatik gergilerin görünümü böyle. Yani teknik resimleri bu."*).
Çizim `js/fead-tensioners.js` → `VE_FEAD_TEN_PIN` ve `CLAUDE.md` → *"KOL
AÇISININ İMALAT KARŞILIĞI — KONUM PİMİ"* bölümünün kaynağıdır.

> **GÖRSEL DEPODA DEĞİL.** Sohbete yapıştırılmış bir resimdi; dosya olarak
> elimize geçmedi ve `pdf/` altına konmadı. Bu bölüm o yüzden var: çıkarılan
> sayılar burada yazılı olmasa kökenleri hiçbir yerde durmayacaktı.
> **Çizim yeniden elde edilirse `pdf/` altına konmalı** (ad önerisi:
> `E9843_parca-cizimi.pdf`) ve bu bölüm indekse taşınmalı.

Çizimin yazısı (aynen):

```
E9843 PIN POSITION FOR THE 344° MEAN ANGLE AND 22.5 Nm SPRING TORQUE
@ 28° FREEARM-MEAN ROTATION
```

Basılı ölçüler: **19,51** ve **24,09 mm** (dik iki ölçü), **51°**, **16°**.

| Çıkarılan | Nasıl | Çizimin yazdığı | Fark |
|---|---|---|---|
| pim yarıçapı `r` | `√(19,51² + 24,09²)` = 30,9995 | — | — |
| pim açısı (gövdeye göre) | `atan(24,09 / 19,51)` = 50,9967° | **51°** | 0,003° |
| kol çalışma açısı | `360 − 16` | **344°** | birebir |
| pim mutlak (3. bölge) | `180 + 51` = 231,00° | — | — |
| **ofset `Δ_parça`** | `231 − 344` | — | **−113,00°** |

**İKİ BAĞIMSIZ ÇAPRAZ DOĞRULAMA — ikisi de tutuyor:**

1. Çizimin *"28° FREEARM-MEAN ROTATION"* satırı ↔ **bu arşivin** yay
   künyesinden hesaplanan `(22,07 − 8,60)/0,480 = 28,0625°` → **0,06°**.
   Çizimdeki 22,5 Nm nominal, raporun künyesi 22,07.
2. Gövdenin merkezî bağlantı deliği kolun dönme ekseniyle **eşmerkezli** →
   MFSim'in *"girilen montaj koordinatı = pivot"* varsayımı ölçüldü
   (`CLAUDE.md`'de bir tur önce **ÖLÇÜLMEDİ** diye işaretliydi).

**SAYI PARÇAYA AİT, MEKANİZMA GENEL.** Kullanıcının *"hepsi böyle görünür"*
sözü mekanizma içindir (tek merkezî cıvata + saati belirleyen konum pimi);
yarıçap ve ofset parçaya özgüdür. Arşivin diğer üç parça kodunda
(`T38624` · `T38665` · `T38519`) çizim YOK ve sayı **uydurulmadı** — model
`ok:false` döndürüp sebebini yazıyor.

## Tedarikçi dosya adı GÖVDEYLE ÇELİŞEBİLİR — AG00810

`AG00810`'un tedarikçiden gelen dosya adı ve raporun `Design:` alanı
**`12PK1215-Version-8`** diyor. Raporun gövdesi ise iki ayrı yerde 10 diyor:

```
s2  # of Ribs / Cord Material : 10 / polyester
s1  Drive Notes               : 10PK1215HD MT610 Polyester
```

Fixture da 10 taşıyor, yani **doğru**. Arşiv dosyası gövdeye göre adlandırıldı
(`AG00810_10PK1215HD_…`); `12PK1215` yalnız burada, arama yapan biri bulsun
diye kayıtlı. Ders: ad dizgisi bir VERİ KAYNAĞI değil, etikettir.

## Yeni rapor eklerken

1. PDF'i `pdf/` altına, ad kuralına uyarak koy.
2. Yukarıdaki tabloya satırını ekle (`durum` → **PDF**), sayfa haritasını yaz.
3. Sayıları çıkarmak gerekiyorsa `tests/fixtures/fead-validation.js`'e ekle —
   **birebir**, yorumlamadan. Doğrulama kapısı büyür.
4. Fixture'a giren her rapor için `npm test` yeşil kalmalı: yeni bir referans
   değer takımı çekirdeği kırıyorsa bu bir bulgudur, gizlenmez.
