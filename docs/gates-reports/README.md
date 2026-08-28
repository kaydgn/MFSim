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
pdf/<ISLEMRAPORU>_<kayış>_<gergi konumu>_<tarih>.pdf
    AG00976_8PK1715HD_Ten-250-110_2025-06-05.pdf
```

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
| AG0868-4PK | 9.37 | 3 | 1013 | BMC 6 sil. · CRK A_C TEN · 4PK | veri | — | — |
| AG0868-6PK | 9.37 | 3 | 1018 | aynı sistem · 6PK | veri | — | — |
| AG0868 | 9.37 | 3 | 1020 | aynı sistem · 8PK | veri | — | — |
| AG00810 | 4.32 | 4 | 1214 | BMC TTA-6x6 · 250 A alternatör · 10PK1215HD | veri | — | — |
| AG00879 | 9.40 | 5 | 1392 | Anadolu Isuzu 6x6 Cummins · 8PK1392HD · gergi T38665 | veri | — | — |
| AG00686 | 9.40 | 4 | 1475 | BMC 6 sil. · 8PK1475HD · gergi T38624 CW | veri | — | — |
| AG00686-1520 | 9.40 | 4 | 1520 | aynı gergi · CRK ø172 / A_C ø137 | veri | — | — |
| AG00902-1275 | 9.55 | 4 | 1275 | BMC Otomotiv Valeo TM21 · 8PK1275 | veri | — | — |
| AG00902-1300 | 10.01 | 4 | 1302 | aynı sistem · 8PK1300 · farklı kasnak çapları | veri | — | — |
| AG00894 | 9.40 | 6 | 1739 | BMC 6 sil. · İKİ klima (TM31 + SD7H15) · alternatör YOK | veri | — | — |
| AG00976 1668@-240/115 | 13.02 | 6 | 1667 | BMC Otomotif FEAD 5 · Cummins ikincil tahrik | veri | — | — |
| AG00976 1655@-250/104 | 13.02 | 6 | 1656 | aynı sistem · revizyon | veri | — | — |
| AG00976 1705@-250/110 | 13.02 | 6 | 1705 | aynı sistem · revizyon | veri | — | — |
| AG00976 1715@-250/110 | 13.02 | 6 | 1715 | aynı sistem · **Corrected-IDR1** · 05.06.2025 | veri | — | — |

**Ölçülen boşluk:** `CLAUDE.md` doğrulama kapısını *"17 Gates raporu"* diye
tarif ediyor; fixture'dan sayılan kayıt **14** (yedi aile). Aradaki üç rapor ya
kısmen çıkarılmış ya da hiç girmemiş. Elindeki PDF'ler geldiğinde bu fark
kendiliğinden görünür olacak — indeksin ikinci işi bu.

## Yeni rapor eklerken

1. PDF'i `pdf/` altına, ad kuralına uyarak koy.
2. Yukarıdaki tabloya satırını ekle (`durum` → **PDF**), sayfa haritasını yaz.
3. Sayıları çıkarmak gerekiyorsa `tests/fixtures/fead-validation.js`'e ekle —
   **birebir**, yorumlamadan. Doğrulama kapısı büyür.
4. Fixture'a giren her rapor için `npm test` yeşil kalmalı: yeni bir referans
   değer takımı çekirdeği kırıyorsa bu bir bulgudur, gizlenmez.
