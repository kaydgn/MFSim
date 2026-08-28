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
| AG00879 | 9.40 | 5 | 1392 | Anadolu Isuzu 6x6 Cummins · ikincil alternatör · T38665 @31 Nm · 17.05.2023 | **PDF** | `AG00879_8PK1392HD_T38665-31Nm_2023-05-17.pdf` | alıntı **5/12** |
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

Sol sütun **ölçüldü** (altı tam rapor, başlık dizisi birebir aynı). Sağ sütunun
4 · 7 · 9–12. satırları **çıkarım**: o sayfalar elimizdeki alıntılarda yok, ama
alıntıların taşıdığı sayfa numaraları (`5→Belt Slip 1/2`, `6→Belt Slip 2/2`,
`8→Hubload Mean`) iki bağımsız raporda da bu haritayla tutarlı.

### DÖRT PDF TAM RAPOR DEĞİL — ALINTI

Kolay kaçırılan ve pahalı bir tuzak: bir bölümü PDF'te bulamamak, o bölümün
**raporda olmadığı** anlamına gelmiyor. Altbilgideki `Page N of M` bunu ele
veriyor — dosyadaki sayfa sayısı ile `M` tutmuyorsa belge kırpılmış.

| Rapor | PDF | Gerçek | Eksik sayfalar |
|-------|----:|-------:|----------------|
| AG00686 ×2 · AG00810 · AG0868 ×3 | 11 | 11 | **TAM** |
| AG00879 | 5 | 12 | 4, 5, 7, 9, 10, 11, 12 |
| AG00894 | 6 | 12 | 4, 7, 9, 10, 11, 12 |
| AG00902-1275 | 5 | 11 | 4, 6, 8, 9, 10, 11 |
| AG00902-1300 | 5 | 11 | 4, 6, 7, 9, 10, 11 |

Dördünde de **tepe yük, yorulma, titreşim ve hizalama sayfaları yok**. Bir
sonraki oturum bu tabloya bakmadan *"AG00879'da tepe tablosu yokmuş"* diye
yazarsa yanlış bir şey söylemiş olur — eksik olan rapor değil, elimizdeki kopya.

Yeni bir PDF eklendiğinde bu denetim koşulmalı:

```bash
python3 - <<'EOF'
import pymupdf, glob, os, re
for f in sorted(glob.glob("docs/gates-reports/pdf/*.pdf")):
    d=pymupdf.open(f); nums=[]; total=None
    for pg in d:
        m=re.search(r"Page (\d+) of (\d+)", pg.get_text())
        if m: nums.append(int(m.group(1))); total=int(m.group(2))
    eksik=[i for i in range(1,(total or 0)+1) if i not in nums]
    print(os.path.basename(f), d.page_count, "/", total, "eksik:", eksik or "yok")
EOF
```

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

## Arşivin açtığı kapılar (ölçüldü)

### 1 · Tepe yük tablosu artık TEK rapora bağlı değil

`CLAUDE.md` özet raporun tepe yük tablosunu `KALİBRE DEĞİL` diye damgalıyor:

> *"doğrulama kümesinde hâlâ tek bir tepe değeri yok, yani tablo TEK bir rapora
> karşı ölçülebiliyor"* · *"Damganın kalkması için birden çok raporun tepe
> tablosu gerekir."*

Tam raporun 6. sayfası (12 sayfalıkta 7.) `Pulley Hubload Analysis (Peak)` ve
**altı tam raporun altısında da dolu**:

| Rapor | Kaburga | Tasarım gerginliği |
|-------|--------:|-------------------:|
| AG0868-4PK | 4 | 258 N |
| AG0868-6PK | 6 | 301 N |
| AG0868 | 8 | 356 N |
| AG00686 | 8 | 766 N |
| AG00686-1520 | 8 | 609 N |
| AG00810 | 10 | 759 N |

Örnek (AG0868 8PK1020HD, s6):

```
              CRK      A_C      TEN
Tension  N    724      362      356
Hubload  N    997.2   1078.1    373.6
Direction     354/228  194/195  84/63      (yön / sarım °)
Accel.        1000 RPM/s  (decel de 1000)
```

Altısı birden 258–766 N gerginlik ve 4–10 kaburga aralığını tarıyor; AG0868'in
üçü ayrıca **kontrollü bir deney** (aynı kasnaklar, aynı duty, aynı sıcaklık,
değişen yalnız kaburga ve gerginlik). AG00976'nınkiyle **yedi** eder.

**Alıntı dördünde tepe sayfası YOK** — yani kalibrasyon takımı bu altı raporla
sınırlı, on rapor değil.

### 2 · `Pulley Alignment Sensitivity` — modelde hiç yok

Tam raporun 4. sayfası. `CLAUDE.md`: *"Geometri tek düzlemde çözülüyor;
fleeting açısı ve eksenel offset modelde yok."* Sayfa yatak oturma açısını ve
fleeting açısını veriyor. Yine yalnız altı tam raporda.

İkisi de **bu oturumda yapılmadı**; arşivin gerekçesi olarak buraya yazıldı.

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
