# Takoz Raporu — Varlık & Şablon Üreteçleri

`mnt-report` bileşeni (bkz. `js/cp-mount-report.js`), Çözücü'nün 6 SD sonuçlarını
**tamamen çevrimdışı / self-contained** bir HTML rapora döker. Rapor, referans
teori raporunun estetiğindedir; matematik (KaTeX) ve fontlar dosyaya **gömülüdür**,
böylece internet olmadan her yerde açılır ve yazdırılabilir.

Bu klasör, iki **runtime** dosyasını üreten tek-seferlik araçları içerir. Runtime
dosyaları `js/` altında **commit edilir** (elle düzenlenmez):

| Runtime dosyası | Ne içerir | Üreten |
|---|---|---|
| `js/mount-report-assets.js` | KaTeX (css+js) + 3 metin fontu, tümü woff2 data-URI gömülü (~1 MB) | `build-report-assets.js` |
| `js/mount-report-template.js` | Teori şablonu (§1–7, 9, 10, Ek A) base64, `@@…@@` token'lı | `build-report-template.js` |

Her ikisi de `index.html`'de `type="text/x-mfsim-report"` ile işaretlidir →
uygulama açılışında **yüklenmez**; ilk rapor üretiminde `cp-mount-report.js`
talep üzerine çeker (açılış performansını etkilemez). `build.js` monolitik
derlemede içeriği inline eder → indirilmiş tek dosyada da çalışır.

## Ne zaman yeniden üretilir?

- **KaTeX sürümü** güncellenecekse → `build-report-assets.js` içindeki URL'yi
  değiştir, yeniden çalıştır.
- **Fontlar / alt küme** değişecekse (ör. yeni bir dil) → `SUBSET` aralığını
  düzenle, yeniden çalıştır.
- **Teori metni / denklemler / şekiller** değişecekse → `theory-source.html`'i
  düzenle, `build-report-template.js`'i yeniden çalıştır.

> `theory-source.html`, raporun **sabit teori** kısmının kanonik kaynağıdır
> (Fable ile hazırlanan "Güç Grubu 6 SD Takoz Modeli" yöntem raporu). Şablon
> üreteci bundan CDN bağımlılıklarını çıkarır, örnek/doğrulama (Adams) metnini
> genelleştirir ve dinamik bölümler için token yerleştirir.

## Çalıştırma

```bash
# Gereksinimler: node, curl (proxy'yi kullanır), python3
pip install fonttools brotli      # font subset + değişken-font instancing için

node tools/report-assets/build-report-assets.js      # → js/mount-report-assets.js  (~30 sn, ağ gerektirir)
node tools/report-assets/build-report-template.js    # → js/mount-report-template.js (anında, ağsız)
```

Sonra her zamanki döngü: `npm test` (birim testler `tests/unit/cp-mount-report.test.js`
gömülü şablonun `$$` sınırlayıcı sağlamlığını da denetler) ve `npm run build`.

## Dinamik token'lar (runtime'da doldurulur)

`cp-mount-report.js._mntBuildReportHTML` şablondaki şu token'ları **fonksiyon-replacer**
ile doldurur (dinamik HTML'deki `$$` desenleri `String.replace`'in `$$→$`
kısaltmasıyla bozulmasın diye):

| Token | Doldurulan |
|---|---|
| `@@ASSETS_CSS@@` | `fontsCss` + `katexCss` (gömülü) |
| `@@KATEX_JS@@` | `katexJs` (gömülü; `</script>` kaçışlı) |
| `@@ANTET@@` | Dinamik başlık bloğu (bileşen/takoz sayısı, toplam kütle, tarih) |
| `@@SECTION8@@` | §8 "Sayısal Örnek" — bu modelin gerçek çözümü (tablolar, şekiller, adımlar) |
