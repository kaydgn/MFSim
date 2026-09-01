---
name: fead
description: MFSim FEAD (kayış-kasnak / accessory belt drive) modülünün karar kaydı ve dokunulmazlıkları. js/fead-core.js, js/fead-model.js, js/fead-belts.js, js/fead-duty.js, js/fead-tensioners.js, js/cp-fead.js, js/cp-fead-report.js, js/cp-fead-summary.js, js/cp-fead-wizard.js, js/guide-fead.js dosyalarından birine ya da FEAD testlerine (tests/unit/fead-*, cp-fead*, gates-archive, guide-fead, tests/e2e/fead-*) dokunmadan ÖNCE çağır. Çekirdeğin birebir durma kuralı, 2095 referans değerlik doğrulama kapısı, kanvas = kayış düzlemi eşlemesi, gergi tanımı, katalog ve rapor kuralları buradadır.
---

# FEAD modülü — dokunmadan önce

Bu modülün hata sınıfı **sessizdir**: sayı yanlış çıkar, model yine çözülür,
uyarı verilmez. Aşağısı o sınıfa karşı kurulmuş kapılardır.

## Önce şunu bil: gergi tanımı OYNAK bir alan

**Gerginin nasıl tanımlandığı 2026-08-25 → 09-01 arasında DÖRT KEZ yön
değiştirdi** (kasnak merkezi girdi → pivot girdi + zarf → tek koordinat →
avara merkezi girdi + kol açısı girdi). Bu yüzden **bu dosya o alanın kuralını
yeniden yazmaz** — burada yazılı bir özet, bir sonraki dönüşte sessizce yanlış
olurdu.

> Gergi tanımına, kol açısına ya da kayış boyu kipine dokunacaksan
> **`references/cozum-ornekler-ve-ankraj.md`'yi aç ve *"AVARA MERKEZİ GİRDİ,
> MONTAJ KONUMU ÇIKTI"* bölümünü oku.** Ondan sonraki bölümler kendi
> başlıklarında AŞILDI diye işaretlidir ve yalnız ÖLÇÜMLERİ için duruyorlar;
> sırayla oku, atlama. Kodun kendisi (`js/cp-fead.js` gergi kartı,
> `js/fead-model.js`) belgeden daha günceldir — ikisi ayrışıyorsa kod kazanır
> ve kaydı düzeltmek işin parçasıdır.

## Dokunulmazlar

1. **`js/fead-core.js` DIŞARIDAN GELDİ, BİREBİR DURUR.** MFSim stiline
   ÇEVRİLMEZ — `const`/arrow/template literal kullanır, proje `var` kullanır,
   fark bilerek duruyor. Güncellemesi de dışarıdan gelir. Uyarlanacak olan
   çekirdeğin ÇEVRESİDİR (`js/cp-fead.js`), çekirdeğin kendisi değil.
2. **Üç katman.** `fead-core.js` (hesap) → `fead-model.js` (köprü, DOM'suz) →
   `cp-fead.js` (sunum; **kendi geometrisini hesaplamaz**). Yükleme sırası
   `index.html`'de: `fead-model.js` → `fead-core.js` → `cp-fead.js`.
3. **Doğrulama kapısı 17 Gates raporu / 2095 değer**, artı Gates arşivine
   doğrudan bağlı testler. Eşikler `references/uc-katman-ve-cekirdek.md`'de
   yazılı; **kanonik olan `tests/unit/fead-core.test.js`'in kendisidir.**
   Mutlak B10 ömrü kapı DIŞINDA — yalnız belgelenmiş çap penceresinde geçerli.
4. **Kanvas = kayış düzlemi.** 1 px = 1 mm, orijin **sürücü kasnak** (rol, tip
   değil), Y ekseni kanvasta aşağı / mm'de yukarı. mm → px tam sayıya
   YUVARLANMAZ — 1 mm'lik kayma ölçülebilir bir gerginlik farkı demektir.
5. **Konum Bağı (`fead-coordlink`) bunu kapatabilir.** Düğüm YOKSA bağ AÇIK —
   geriye dönük uyum tam bu satırda. Bağımsızlık SİMETRİK: hem kanvas→mm hem
   mm→kanvas kapatılır. Kapı SAF dönüşüm fonksiyonlarının İÇİNDE değildir.
6. **Sürücülük ROL** (`node.data.driver`), tip değil. **Temas tarafı
   (grooved/back) gerçek alandır** — ters verilirse çekirdek hata VERMEZ,
   geçerli ama başka bir güzergâh çözer. **Çap = DIŞ ÇAP (`od`)**.
7. **Panel ile kanvas AYNI alanı okur.** Kol konumu, kayış kipi, yön gülü,
   konum bağı, dönüş yönü — ikinci bir ayar tutmak iki yüzeyin sessizce
   ayrışması demektir.
8. **Geçerlilik sınırı sonucun İÇİNDE taşınır.** Tepe yük `KALİBRE DEĞİL`
   damgasıyla, B10 çap penceresiyle, türetilen boy kökeniyle basılır. Sayı
   gizlenmez; sınırı yanında yazılır.
9. **Tazeleme tek noktadan.** Kayış Yolu kartı `saveState()`'ten; port DOM'u ve
   kart imzası `updateAllConnections`'tan. Yirmi ayrı yere çağrı serpmek
   birinin unutulması demektir.
10. **Negatif kapı: `veFeadApplyBadge` kasnak kutusuna kesikli çember ÇİZMEZ.**
    Gerçek çap hayaleti kullanıcı isteğiyle kaldırıldı; kapı sınıf adına değil
    biçime de bakıyor (`border-radius:50%` + `dashed`).
11. **Katalog bir KISIT değil, bir ÖNERİ.** Ara boy ısmarlanabildiği için panel
    elle girişi engellemez.
12. Oturumluk sonuç globali **`window.veFeadResults` proje değişince
    temizlenmeli** (`_feadForgetResults`) — yoksa yeni projede önceki projenin
    tabloları durur.

## Referans dosyaları

Değiştireceğin alanın dosyasını **oku**; hepsini birden okuma.

| Dosya | Ne var |
|---|---|
| `references/uc-katman-ve-cekirdek.md` | Üç katman kuralı · doğrulama kapısı ve eşikleri · burulma modeli ve iki sessiz girdisi · üç yapısal kural |
| `references/kayis-kipi-ve-katalog.md` | Kayış boyu kipleri · nominal kol açısı · kenetlenen kol · hoşgörülü geometri · `js/fead-belts.js` kataloğu ve iki kümesi |
| `references/kanvas-ve-kart.md` | Kanvas = kayış düzlemi · Konum Bağı · **Dönüş Yönü (`fead-spin`)** · port kenarı/yön oku/şeritler · `veFeadArrangeByCoords` · Kayış Yolu kartı · animasyon · yön gülü |
| `references/raporlar.md` | Ayrıntılı ve özet HTML rapor · §8 alt bölümleri · şekil çizicileri · kozmetik ve denetim turları · tepe zinciri çevrim kapanışı · kayma eşiği |
| `references/cozum-ornekler-ve-ankraj.md` | **Gergi tanımı (TEK KOORDİNAT — önce bunu oku)** · duty tablosu ve `js/fead-duty.js` çevrim kütüphanesi · gergi künye kütüphanesi (`js/fead-tensioners.js`) · ankrajın türetilmesi · Başlangıç Sihirbazı · örnekler |
| `references/testler.md` | FEAD test dosyalarının kapsamı |
| `references/emekli-yonler.md` | **ARŞİV** — kodda olmayan yönler (`fead-graph.js`, dairesel kasnak düğümü) |

## Bu modülü belgelerken

Bir turun **ölçüm anlatısı** bu dosyalara yazılmaz; hüküm + tek satır gerekçe +
kapının testi yazılır. Ölçüm tabloları PR gövdesinde ve test dosyasında kalır.
Bu modülün kaydı bir kez 2.835 satıra, sonra 4.300'e çıktı ve kökteki
`CLAUDE.md`'nin %63'ünü yiyordu — kural onun tekrarını önlemek içindir.
Ayrıntısı kökteki "Belgeleme kuralı" bölümünde.
