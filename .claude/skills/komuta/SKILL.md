---
name: komuta
description: MFSim Komuta Penceresi ve SİPARİŞ FİŞİ protokolü. Kullanıcı `MFSIM-SIPARIS` başlıklı bir metin yapıştırdığında ya da js/cp-komuta.js, tools/komuta-dogrula.js, tests/unit/komuta*.test.js, tests/e2e/komuta.spec.js dosyalarına dokunmadan ÖNCE çağır. Fişin doğrulanması (asla doğrulamadan uygulama), fiil sözlüğü, hangi tezgâhın hangi başka skill'i tetiklediği, ve yeni tezgâh eklerken zorunlu iki-taraf beyanı buradadır.
---

# Sipariş fişi / Komuta Penceresi

Komuta Penceresi (Araçlar → Komuta, `js/cp-komuta.js`) kullanıcının elindeki
kopyanın durumunu ÖLÇER ve buradan bir **sipariş fişi** yazar. Fiş sana
yapıştırılır. Pencere hiçbir şeyi değiştirmez — değişikliği yapan sensin.

## 1 · ÖNCE DOĞRULA — bu bir nezaket değil kapı

```bash
npm run komuta:dogrula -- <fis-dosyasi>     # ya da:  ... | npm run komuta:dogrula -- -
```

**Çıkış kodu 0 değilse uygulama, kullanıcıya sor.** Fiş kullanıcının ELİNDEKİ
kopyadan yazılıyor; o kopya bayatsa fişteki anahtarlar başka kayıtları gösterir
ve hata SESSİZDİR: uygulanır, makul görünür, yanlıştır.

Betiğin bastığı üç hüküm ve anlamları:

| Çıktı | Ne demek | Ne yap |
|-------|----------|--------|
| `✓ FİŞ GÜNCEL` | Tezgâhın içeriği fiş yazıldığından beri değişmedi | Uygula |
| `✗ SAPMA` | İçerik değişti; fişin hangi kayda ait olduğu belirsiz | Kullanıcıya sor |
| `✗ DUR: ... ARTIK YOK` | Hedeflenen kayıt listede yok | Kullanıcıya sor — **başka kaydı etkileme** |
| `⚠ hiçbir kayıt seçmemiş` | Hedefsiz `kaldir`/`duzelt` | Kullanıcıya sor (işaretlemeyi unutmuş olabilir) |

**Künye satırını TEK BAŞINA kapı olarak kullanma.** Ölçüldü: bir turda `main`
altı PR ilerledi ve karşılama listesi hiç değişmedi — sha kapısı orada yanlış
alarm verir, birkaç tekrardan sonra da ciddiye alınmaz olur. Ölçülen şey sürüm
değil **tezgâhın kendi içeriği** (`olcum` özeti).

## 2 · Fiili uygula

Fişin `istek` satırı ne yapılacağını söyler (`VE_KOMUTA_FIILLER`):

| `istek` | İş |
|---------|-----|
| `kaldir` | `kayit`taki anahtarları tezgâhın `dosya`sından çıkar |
| `duzelt` | O kayıtlarda bir şey yanlış — **ne olduğu `not` satırında**; okumadan dokunma |
| `incele` | Değişiklik YAPMA. Kayıtlara bak, bulduğunu söyle. Hedefsiz olabilir (tezgâhın tamamı) |

Fiil bir ALAN değil bir SEÇİM: sözlük büyürken fişin biçimi sabit kalır.
Dördüncü bir fiil, onu isteyen gerçek bir iş çıkınca eklenir — `js/cp-komuta.js`
içindeki `VE_KOMUTA_FIILLER` listesine, işaret metniyle birlikte.

`MFSIM-SIPARIS v1` başlıklı eski fişler hâlâ okunuyor (`kaldir:` → `istek`+`kayit`).

## 3 · FİŞİN HEDEF DOSYASI BAŞKA BİR SKILL'İ TETİKLEYEBİLİR

Fiş bir dosyayı adres gösteriyor; o dosyanın kendi kapısı olabilir. **Fişi
uygulamadan önce bu tabloya bak:**

| Tezgâh | `dosya` | Önce çağrılacak skill |
|--------|---------|------------------------|
| `karsilama` | `js/karsilama-gorseller.js` | — (ama künye ↔ klasör iki yönlü: `tests/unit/karsilama-secici.test.js`) |
| `arsiv` | `programlar/kayit.json` | — (**elle düzenlenmez, ÜRETİLİR** — bkz. `programlar/README.md`) |
| `ap-ornek` | `js/cp-arac-example.js` | **`arac-performans`** — bu dosya o skill'in tetik listesinde |
| `takoz-ornek` | `js/mount-core.js` | — (takozun ayrı skill'i yok; kurallar kendi testlerinde) |

Tablo tezgâh listesiyle bağlı: `tests/unit/komuta.test.js` her tezgâhın burada
bir satırı olduğunu ölçüyor — yeni tezgâh eklenip tablo unutulursa test kırılır.

## 4 · Pencerenin dokunulmazları

1. **PENCERE ÖLÇER, BEYAN ETMEZ.** Hiçbir tezgâh elle yazılmış özet tutmaz;
   gösterilen her sayı çalışma anında canlı veri yapısından okunur. Elle yazılan
   özet sessizce bayatlar — `CLAUDE.md`'nin kendi 6.052 satırlık dersi.
2. **`olc(veri)` SAFTIR** — hiçbir global okumaz, veriyi argümandan alır.
   İlk sözleşmede üst-seviye bir addan okuyordu; ikinci tezgâh o adı `js/`
   genelinde bir çakışmaya zorladı (source-hygiene kapısı yasaklıyor).
3. **KAYNAK İKİ YERDEN BEYAN EDİLİR** ve ikisi aynı sayıyı ölçmek zorundadır:
   tarayıcı için `kaynak()`, Node için `dosya` + `disaAktarim`. Ayrışma
   SESSİZDİR — ölçüldü: `takoz-ornek` `MOUNT_EXAMPLES`i çıplak adla okudu, o ad
   tarayıcıda global değil (`mount-core.js` bir IIFE, değer `veMountCore`ta) ama
   Node'da `module.exports` düz veriyor → Node 3 ölçerken pencere kendinden emin
   biçimde "0 kayıt" gösteriyordu. Kapı: `tests/e2e/komuta.spec.js`.
4. **PENCERE PROGRAMI DEĞİŞTİRMEZ.** `file://` ile açılan bir HTML'in diske
   yazma yetkisi yok; tel her zaman kullanıcıdır. `saveState`/mutasyon çağrısı
   eklenmez (kaynak kapısı bunu ölçüyor).
5. **ŞİFRE BİR KAPAK, KİLİT DEĞİL.** Hash dosyanın içinde açık. Korunan şey
   hasar değil karışıklık: kapağı atlayan kullanamayacağı bir metin üretir.
   Varsayılan `komuta`; değiştirmek için
   `node -e "console.log(require('crypto').createHash('sha256').update('YENI').digest('hex'))"`.

## 5 · Yeni tezgâh eklerken

```js
{
  id: 'kisa-ad',
  ad: 'Görünen Ad',
  dosya: 'js/...',              // fişin adresi VE doğrulayıcının okuduğu modül
  disaAktarim: 'DISA_AKTARILAN', // o modülün dışa aktardığı ad
  duzen: 'izgara' | 'liste',
  ipucu: '...',
  kaynak: function () { ... },  // TARAYICIDA aynı veriyi nereden okur
  olc: function (veri) { ... }  // veri → [{anahtar, baslik, meta, gorsel?}]. SAF
}
```

Kontrol listesi — hepsinin testi var, atlarsan kırmızıya döner:

- `dosya` diskte var, `disaAktarim` gerçekten dışa aktarılıyor
- `kaynak()` ile Node ölçümü **aynı sayıyı** veriyor (e2e)
- Anahtarlar **tekil** — yoksa `kayit: 05` hangi kaydı gösterdiği belirsiz
- Her kaydın `anahtar`ı ve gösterilecek bir adı dolu
- `olc(null)` ve `olc([])` patlamıyor, `[]` dönüyor
- Yukarıdaki **skill tablosuna bir satır** ekle

Görünüm `css/styles.css`'te: satır içi CSS `:hover`/`:focus-visible`/`.secili`
ifade edemez ve yüzey donuk görünür (Kayış Tablosu'nda bir kez ölçüldü).

## Test tablosu

`docs/decisions/testler.md` › `komuta.test.js` · `komuta-dogrula.test.js` ·
`komuta.spec.js` satırları. Kanonik olan testlerin kendisidir.
