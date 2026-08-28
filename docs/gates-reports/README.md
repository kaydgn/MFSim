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

| Rapor | Gates | Kasnak | L_eff | Sistem | Durum | PDF | Sayfa haritası |
|-------|-------|-------:|------:|--------|-------|-----|----------------|
| AG0868-4PK | 9.37 | 3 | 1013 | BMC-Otomotif 6 sil. · ikincil klima (SD7H15) · E9843 @16 Nm | **PDF** | `AG0868_4PK1013HD_E9843-16Nm_2022-12-27.pdf` | 11 sayfa · A |
| AG0868-6PK | 9.37 | 3 | 1018 | aynı sistem · 6PK · E9843 @19 Nm | **PDF** | `AG0868_6PK1018HD_E9843-19Nm_2022-12-27.pdf` | 11 sayfa · A |
| AG0868 | 9.37 | 3 | 1020 | aynı sistem · 8PK · E9843 @22.5 Nm | **PDF** | `AG0868_8PK1020HD_E9843-22.5Nm_2022-12-27.pdf` | 11 sayfa · A |
| AG00810 | 4.32 | 4 | 1214 | BMC TTA-6x6 · 250 A alternatör · 10PK1215HD | veri | — | — |
| AG00879 | 9.40 | 5 | 1392 | Anadolu Isuzu 6x6 Cummins · 8PK1392HD · gergi T38665 | veri | — | — |
| AG00686 | 9.40 | 4 | 1475 | BMC 6 sil. · 8PK1475HD · gergi T38624 CW | veri | — | — |
| AG00686-1520 | 9.40 | 4 | 1520 | aynı gergi · CRK ø172 / A_C ø137 | veri | — | — |
| AG00902-1275 | 9.55 | 4 | 1275 | BMC Otomotiv Valeo TM21 · ø127 · 08.12.2023 | **PDF** | `AG00902_8PK1275HD_E9843-22Nm_2023-12-08.pdf` | 5 sayfa · B |
| AG00902-1300 | 10.01 | 4 | 1302 | aynı sistem · TM21 · farklı kasnak çapları · 30.11.2023 | **PDF** | `AG00902_8PK1300HD_E9843-22Nm_2023-11-30.pdf` | 5 sayfa · B |
| AG00894 | 9.40 | 6 | 1739 | BMC 6 sil. · İKİ klima (TM31 + SD7H15) · alternatör YOK | veri | — | — |
| AG00976 1668@-240/115 | 13.02 | 6 | 1667 | BMC Otomotif FEAD 5 · Cummins ikincil tahrik | veri | — | — |
| AG00976 1655@-250/104 | 13.02 | 6 | 1656 | aynı sistem · revizyon | veri | — | — |
| AG00976 1705@-250/110 | 13.02 | 6 | 1705 | aynı sistem · revizyon | veri | — | — |
| AG00976 1715@-250/110 | 13.02 | 6 | 1715 | aynı sistem · **Corrected-IDR1** · 05.06.2025 | veri | — | — |

### Sayfa haritaları

Gates çıktısı iki farklı düzende geliyor. Sayfa numaraları **düzene** bağlı,
rapora değil — aynı harfi taşıyan her rapor aynı haritayı kullanır.

**Düzen A — 11 sayfa** (AG0868 ailesi, Gates 9.37)

| s | Bölüm | s | Bölüm |
|--:|-------|--:|-------|
| 1 | Summary of Results | 7 | Pulley Hubload Analysis (**Mean**) |
| 2 | Geometric Analysis 1/2 — yerleşim · kayış · gergi künyesi · span/sarım/oran | 8 | Belt Rib Fatigue 1/2 |
| 3 | Geometric Analysis 2/2 — gergi zarfı · take-up · boy eğrisi | 9 | Belt Rib Fatigue 2/2 |
| 4 | Pulley Alignment Sensitivity | 10 | System Vibration Analysis |
| 5 | Belt Slip / Tension Analysis | 11 | Design Notes |
| 6 | Pulley Hubload Analysis (**Peak**) | | |

**Düzen B — 5 sayfa** (AG00902 ailesi, Gates 9.55 / 10.01)

| s | Bölüm |
|--:|-------|
| 1 | Summary of Results |
| 2 | Geometric Analysis 1/2 |
| 3 | Geometric Analysis 2/2 |
| 4 | Belt Slip / Tension Analysis |
| 5 | Pulley Hubload Analysis (**Mean**) |

Düzen B'de **tepe yük ve titreşim sayfaları YOK**; kısa sürüm yalnız ortalama
yükleri veriyor.

### Fixture kaynağına karşı DOĞRULANDI

Arşive giren beş rapor `tests/fixtures/fead-validation.js`'te zaten kayıtlıydı.
PDF'ler geldiğinde çıkarılmış veri kaynağına karşı programatik olarak ölçüldü:

```
karşılaştırılan değer : 127   (X · Y · pitch · effective · span · wrap
uyuşmazlık            :   0    + tasarım gerginliği · kol boyu · yay momenti
                               · yay oranı · boy toleransı)
```

Yani elle çıkarılmış fixture, kaynak belgelerine **sadık**. Bu denetim yalnız
PDF depoya girdiği için mümkün oldu — arşivin ilk somut karşılığı.

**Ölçülen boşluk:** `CLAUDE.md` doğrulama kapısını *"17 Gates raporu"* diye
tarif ediyor; fixture'dan sayılan kayıt **14** (yedi aile). Aradaki üç rapor ya
kısmen çıkarılmış ya da hiç girmemiş. Elindeki PDF'ler geldiğinde bu fark
kendiliğinden görünür olacak — indeksin ikinci işi bu.

## Arşivin açtığı kapılar (ölçüldü)

**Tepe yük tablosu artık TEK rapora bağlı değil.** `CLAUDE.md` özet raporun tepe
yük tablosunu `KALİBRE DEĞİL` diye damgalıyor ve gerekçesi şu:
*"17 rapordan çıkarılmış 2095 değerlik kümede tek bir tepe değeri yok"* ·
*"Damganın kalkması için birden çok raporun tepe tablosu gerekir."*

Düzen A'nın **6. sayfası** tam olarak o tablo — ve AG0868'in üç varyantında da
dolu. Örnek (8PK1020HD, s6):

```
              CRK      A_C      TEN
Tension  N    724      362      356
Hubload  N    997.2   1078.1    373.6
Direction     354/228  194/195  84/63      (yön / sarım °)
Accel.        1000 RPM/s  (decel de 1000)
```

Üç varyant **kontrollü bir deney**: aynı kasnaklar, aynı duty, aynı sıcaklık;
değişen yalnız kaburga sayısı ve tasarım gerginliği. Yani tepe zincirini
gerginlik ekseninde sınayan üç bağımsız nokta. AG00976'nınkiyle birlikte **dört**
eder — damgayı kaldırmaya yetip yetmediği ölçülmeli.

**Düzen A'nın 4. sayfası `Pulley Alignment Sensitivity`** — bugün modelde hiç
yok (`CLAUDE.md`: *"Geometri tek düzlemde çözülüyor; fleeting açısı ve eksenel
offset modelde yok"*). Sayfa fleeting açısını ve yatak oturma açısını veriyor.

İkisi de **bu oturumda yapılmadı**; arşivin gerekçesi olarak buraya yazıldı.

## Yeni rapor eklerken

1. PDF'i `pdf/` altına, ad kuralına uyarak koy.
2. Yukarıdaki tabloya satırını ekle (`durum` → **PDF**), sayfa haritasını yaz.
3. Sayıları çıkarmak gerekiyorsa `tests/fixtures/fead-validation.js`'e ekle —
   **birebir**, yorumlamadan. Doğrulama kapısı büyür.
4. Fixture'a giren her rapor için `npm test` yeşil kalmalı: yeni bir referans
   değer takımı çekirdeği kırıyorsa bu bir bulgudur, gizlenmez.
