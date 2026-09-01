---
name: fead
description: MFSim FEAD (kayış-kasnak / accessory belt drive) modülünün karar kaydı ve dokunulmazlıkları. js/fead-core.js, js/fead-model.js, js/fead-belts.js, js/cp-fead.js, js/cp-fead-report.js, js/cp-fead-summary.js dosyalarından birine ya da FEAD testlerine (tests/unit/fead-*, cp-fead*, tests/e2e/fead-*) dokunmadan ÖNCE çağır. Çekirdeğin birebir durma kuralı, 2095 referans değerlik doğrulama kapısı, kanvas = kayış düzlemi eşlemesi, kayış boyu kipleri, türetilen ankraj ve pivot, rapor kuralları buradadır.
---

# FEAD modülü — dokunmadan önce

Bu modülün hata sınıfı **sessizdir**: sayı yanlış çıkar, model yine çözülür,
uyarı verilmez. Aşağıdaki on iki madde o sınıfa karşı kurulmuş kapılardır;
gerekçeleri ve ölçümleri `references/` altındadır.

## Dokunulmazlar

1. **`js/fead-core.js` DIŞARIDAN GELDİ, BİREBİR DURUR.** MFSim stiline
   ÇEVRİLMEZ — `const`/arrow/template literal kullanır, proje `var` kullanır,
   fark bilerek duruyor. Güncellemesi de dışarıdan gelir. Uyarlanacak olan
   çekirdeğin ÇEVRESİDİR (`js/cp-fead.js`), çekirdeğin kendisi değil.
2. **Üç katman.** `fead-core.js` (hesap) → `fead-model.js` (köprü, DOM'suz) →
   `cp-fead.js` (sunum; **kendi geometrisini hesaplamaz**). Yükleme sırası
   `index.html`'de: `fead-model.js` → `fead-core.js` → `cp-fead.js`.
3. **Doğrulama kapısı 17 Gates raporu / 2095 değer.** Eşikler: çalışma
   konumları %0.5 · Load dahil %1.5 · kol açıları 0.2° · kaburga yorulma
   dağılımı 1.5 yüzde puanı. **Mutlak B10 ömrü kapı DIŞINDA** — yalnız tüm
   çaplar 79.6–176 mm iken geçerli.
4. **Kanvas = kayış düzlemi.** 1 px = 1 mm, orijin **sürücü kasnak** (rol, tip
   değil), Y ekseni kanvasta aşağı / mm'de yukarı. mm → px tam sayıya
   YUVARLANMAZ (1 mm ≈ 38.6 N).
5. **Konum Bağı (`fead-coordlink`) bunu kapatabilir.** Düğüm YOKSA bağ AÇIK —
   geriye dönük uyum tam bu satırda. Bağımsızlık SİMETRİK: hem kanvas→mm hem
   mm→kanvas kapatılır.
6. **Tasarım gerginliği bir GİRDİ DEĞİL** — yay dengesinden türer
   (`T = M/(dL/dθ)`). **Pivot da girdi değil** — kasnak merkezi + parça
   künyesinden türer. İkisini de panele geri koymak modülün belgelenmiş
   tautoloji tuzağıdır.
7. **Kayış boyu iki kipli.** `fixed` = boy girdi, gerginlik çıktı ·
   `free` = kol nominal yay açısına oturur, boy çıktı. `lengthMode` yazılı
   değilse ve boy varsa → `fixed` (eski projeler birebir korunur).
8. **Sürücülük ROL** (`node.data.driver`), tip değil. **Temas tarafı
   (grooved/back) gerçek alandır** — ters verilirse çekirdek hata VERMEZ,
   geçerli ama başka bir güzergâh çözer. **Çap = DIŞ ÇAP (`od`)**.
9. **Panel ile kanvas AYNI alanı okur.** Kol konumu (`posMode`), kayış kipi
   (`lengthMode`), yön gülü (`compassPos`), konum bağı (`linked`) — ikinci bir
   ayar tutmak iki yüzeyin sessizce ayrışması demektir.
10. **Geçerlilik sınırı sonucun İÇİNDE taşınır.** Tepe yük tablosu `KALİBRE
    DEĞİL` damgasıyla, B10 çap penceresiyle, türetilen boy kökeniyle basılır.
    Sayı gizlenmez; sınırı yanında yazılır.
11. **Tazeleme tek noktadan.** Kayış Yolu kartı `saveState()`'ten; port DOM'u
    ve kart imzası `updateAllConnections`'tan. Yirmi ayrı yere çağrı serpmek
    birinin unutulması demektir.
12. **Negatif kapı: `veFeadApplyBadge` kasnak kutusuna kesikli çember
    ÇİZMEZ.** Gerçek çap hayaleti kullanıcı isteğiyle kaldırıldı; kapı sınıf
    adına değil biçime de bakıyor (`border-radius:50%` + `dashed`).

Oturumluk sonuç globali `window.veFeadResults` proje değişince temizlenmeli
(`_feadForgetResults`) — yoksa yeni projede önceki projenin tabloları durur.

## Referans dosyaları

Değiştireceğin alanın dosyasını **oku**; hepsini birden okuma.

| Dosya | Ne var |
|---|---|
| `references/uc-katman-ve-cekirdek.md` | Üç katman kuralı · çekirdeğin doğrulama kapısı ve eşikleri · burulma modeli ve iki sessiz girdisi · üç yapısal kural (rol / temas / dış çap) |
| `references/kayis-kipi-ve-katalog.md` | Sabit ↔ serbest kip · nominal kol açısı · kenetlenen kol · hoşgörülü geometri · `js/fead-belts.js` kataloğu ve iki kümesi |
| `references/kanvas-ve-kart.md` | Kanvas = kayış düzlemi · Konum Bağı · port kenarı/yön oku/şeritler · `veFeadArrangeByCoords` · Kayış Yolu kartı · animasyon · yön gülü |
| `references/raporlar.md` | Ayrıntılı ve özet HTML rapor · §8 alt bölümleri · şekil çizicileri · kozmetik ve denetim turları · tepe zinciri çevrim kapanışı · kayma eşiği |
| `references/cozum-ornekler-ve-ankraj.md` | Duty tablosu ve sıcaklık indirgemesi · ankrajın türetilmesi · pivotun türetilmesi · `BMC_FEAD_2026` ve `AG00976_GATES_2025` örnekleri |
| `references/testler.md` | FEAD test dosyalarının kapsamı (hangi test neyi kolluyor) |
| `references/emekli-yonler.md` | **ARŞİV** — kodda olmayan yönler (`fead-graph.js`, dairesel kasnak düğümü). Aynı yön yeniden önerilirse nelerin ölçülmüş olduğu |

## Bu modülü belgelerken

Bir turun **ölçüm anlatısı** bu dosyalara yazılmaz; hüküm + tek satır gerekçe +
kapının testi yazılır. Ölçüm tabloları PR gövdesinde ve test dosyasında kalır.
Kural kökteki `CLAUDE.md`'nin "Belgeleme kuralı" bölümündedir.
