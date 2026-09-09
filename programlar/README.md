# `programlar/` — tek dosyalık HTML programlar ve artifact arşivi

MFSim çevresinde üretilmiş, **tek başına açılan** HTML dosyalarının toplandığı yer.
Hepsi çift tıklayınca çalışır: harici dosya, ağ isteği, kurulum gerektirmez.

## Neden var

Bu dosyalar üç yıl boyunca sohbet üzerinden tek tek gönderildi ve **hiçbir yerde
listeli durmuyordu**. Bir kısmı yalnız Claude'un artifact galerisinde, bir kısmı
depo kökünde tek başına duruyordu. Klasörün amacı onları tek bir kapıya toplamak;
ikinci adımda program içinden bu kayda bakılarak erişilebilir yapılacak.

## Yapı

| Klasör | Ne | Git |
|--------|-----|-----|
| `artifact/` | Claude Code artifact'larının indirilmiş kopyası (47 dosya, 31 MB) | dâhil |
| `disaridan/` | MFSim'in üretmediği, dışarıdan gelen kaynak araçlar | dâhil |
| — | üretilen üç ürün depo kökünde duruyor; kayıt onlara **yol** veriyor, kopya tutulmuyor | — |

## `kayit.json` — makine tarafı

İkinci adımda program bu dosyayı okuyacak. Alanlar:

```json
{
  "dosya": "artifact/kayis-yolu-tasarim-denemeleri.html",
  "ad":    "Kayış Yolu Tasarım Denemeleri",
  "simge": "⚙️",
  "tarih": "2026-09-09",
  "boyut": 53597,
  "kume":  "artifact"
}
```

- **`dosya`** — bu klasöre (`programlar/`) **göreli** yol. Ürünler depo kökünde
  olduğu için `../` ile başlar.
- **`kume`** — `urun` · `disaridan` · `artifact`.
- **`boyut`** — yalnız **donmuş** dosyalarda var. Üretilen üç üründe **YOK**:
  boyutları her build'de değişir, kayda yazılsa ilk build'de bayatlardı.

## Üretilen üç ürün neden burada değil

`MFSim_Code.html`, `MFSim_Olcum_Goruntuleyici.html` ve `MFSim_CAN_Cozumleyici.html`
**taşınmadı**, kayıt onlara depo kökünden yol veriyor. Sebep bir tercih değil, bir
maliyet: bu üçü build hattının çıktısı ve konumları `viewer/build.js`,
`candbc/build.js`, `tests/unit/build-freshness.test.js`, `tests/e2e/*.spec.js`,
`tools/shot.js`, `.github/workflows/ci-deploy.yml` ve dört belgede — kırk civarı
yerde — sabit. Taşımak o kırk yeri de değiştirmeyi ve **indirme URL'lerinin
değişmesini** gerektirirdi. Kayıt yolu taşıdığı için ikinci adım her iki hâlde de
aynı şekilde çalışır.

## Kayıt nasıl tazelenir

`kayit.json` **elle düzenlenmez**; artifact eklenince yeniden üretilir. Bugünkü
üreteç oturum defterinden besleniyordu (tek seferlik); kalıcı bir üreteç gerekirse
`tools/` altına konur ve `npm run` betiğine bağlanır.

## Artifact kopyaları

`artifact/` altındaki dosyalar Claude Code artifact galerisinden indirilmiş
**birebir kopyalardır**. Kaynak artifact silinse bile buradaki kopya kalır — zaten
toplanma sebebi bu. Galerideki **47 artifact'ın 47'si** de indi; hepsinin `</html>`
ile kapandığı tek tek doğrulandı.

Tarih aralığı **2026-07-21 → 2026-09-09**. İçerik kabaca dört öbek:

- **Tur incelemeleri** — kozmetik/UI turlarının önce-sonra ekran görüntülü raporları
- **FEAD** — kayış yolu, kasnak, graf dili etütleri ve hesap defteri denetimleri
- **Takoz / Araç Performans** — rapor tasarımı, şok yakalama, sayı denetimleri
- **Tasarım paftaları** — tema, yerleşim, karşılama, açılış dizisi, animasyon önerileri
