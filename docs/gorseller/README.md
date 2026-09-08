# Görseller

Referans görsellerinin klasörü: ekran görüntüleri, taranmış sayfalar, fotoğraflar,
tasarım örnekleri — programın konusuyla ilgili olan ama programın **içine girmeyen**
resimler.

> **Karşılama slaytı buradan besleniyor.** Bu klasördeki kareler
> `assets/karsilama/` altına **bayt bayt aynı** kopyalanır (yalnız adları
> düzenlenir) ve build onları gömer. Küçültme denendi, geri alındı: 1280 px'e
> indirmek görünür biçimde bulanıklaştırıyordu, yeniden kodlamak ise ikinci bir
> kayıp olurdu — bu dosyalar zaten WebP %82.

## Kurallar

- **Pages'e de tek dosyaya da girmez.** CI deploy yalnızca `index.html`, `pwa/`,
  `assets/` ve seçili `vendor/` dosyalarını `_site`e kopyalar
  (`.github/workflows/ci-deploy.yml`); `docs/` dışarıda kalır. Buraya konan bir
  resim `MFSim_Code.html`'i büyütmez.
- **Programın İÇİNDE görünecek bir resim buraya konmaz.** O `assets/` altına girer
  ve build'de gömülür — önce `CLAUDE.md` › "AĞIR VARLIKLAR GÖMÜLÜR" başlığındaki
  beş soru yanıtlanır (gzip sonrası boyut, tek dosyanın toplamı, açılışta yüklenmemesi,
  açmanın worker'da olması, kaynağın depoda kalması).
- **Depoya giren her bayt kalıcıdır** — git geçmişi silinmez. Koymadan önce küçült:
  ekran görüntüsü için PNG, fotoğraf için JPEG/WebP.
- **Dosya adı ne olduğunu söylesin:** `karsilama-ekrani-2026-09.png`,
  `tulga-takoz-raporu-s3.jpg` gibi. Tarih ve konu adda dursun; klasör bir yığın
  değil bir dizin olsun.

## Buraya resim yüklemek (GitHub üzerinden)

Klasörü aç → **Add file → Upload files** → sürükle-bırak → **Commit changes**.
Doğrudan bağlantı:
<https://github.com/kaydgn/MFSim/upload/main/docs/gorseller>
