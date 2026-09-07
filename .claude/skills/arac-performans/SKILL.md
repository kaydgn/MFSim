---
name: arac-performans
description: MFSim Araç Performans (tam gaz hızlanma / güç aktarma) modülünün karar kaydı ve dokunulmazlıkları. js/ft-performance.js, js/simulation-engine.js, js/numerics.js, js/cp-arac-performans.js, js/cp-engine.js, js/cp-gearbox.js, js/cp-torque-converter.js, js/cp-matching.js, js/ft-obstacle.js, js/ft-segment-drive.js, js/cp-arac-example.js dosyalarından birine, assets/examples/ap_*.json örneklerine ya da Araç Performans testlerine (tests/unit/arac-*, gear-*, matching-selection, simulation-engine-grade, pchip-uc-kopya, tests/e2e/arac-performans) dokunmadan ÖNCE çağır. Interpolasyon çekirdeklerinin uyum kuralı, governor droop politikası, 13 araçlık kalibrasyon kapısı ve bilinen açık ayrışmalar buradadır.
---

# Araç Performans modülü — dokunmadan önce

Bu modülün hata sınıfı **sessizdir**: sayı yanlış çıkar, simülasyon yine
koşar, uyarı verilmez. Araç düz yolda olması gerekenden yüksek hızda dengeye
oturur ve bunu gösteren hiçbir istisna yoktur. Aşağısı o sınıfa karşı kurulmuş
kapılardır.

Modül 27 birim test dosyası taşıyor; asıl ağırlık **kalibrasyon kapısında**
(13 gerçek araç, 81 vites geçiş noktası). Bir değişiklik "testten geçti" diye
doğru değildir — hangi kapının onu gördüğünü bilerek değiştir.

## Sarsılmaz olan: kalibrasyon kapısı

`tests/unit/arac-example-calibration.test.js` 13 gerçek aracı uçtan uca
koşturuyor ve altın çıpalara sabitliyor (stall devri, tavan hız, 0-20/40/60/80,
81 vites geçiş noktası, avlanma bekçisi). Bu sayılar iSCAAN raporlarından
geldi, uydurulmadı.

**Çözücünün ürettiği sayıyı değiştiren her düzenlemede bu kapı beklenen
sonuçtur.** Kırmızıya dönerse:

- Altın değeri **sessizce güncelleme.** Çıpa kaydın kendisidir; onu değiştirmek
  kaydı silmektir.
- Önce şunu ayır: değişiklik bir **düzeltme** mi (eski sayı yanlıştı) yoksa bir
  **regresyon** mu (yeni sayı yanlış)? Ayıramıyorsan kullanıcıya sor.
- Düzeltmeyse: değişimin büyüklüğünü ÖLÇ ve gerekçeyle birlikte yaz. Ölçmeden
  güncellenen bir çıpa, bir sonraki turda kimsenin sorgulamayacağı bir yalan
  olur.

Ayrıntı: **`references/kalibrasyon.md`**

## Interpolasyon: aynı matematik ÜÇ yerde yazılı

PCHIP (Fritsch–Carlson monoton kübik Hermite) `js/numerics.js`,
`js/ft-performance.js` ve `js/mount-core.js`'te **ayrı ayrı** yazılı.
Aralarında `tests/unit/pchip-uc-kopya.test.js` kapısı var ve üçünün de tablo
içinde aynı eğriyi verdiğini tutuyor.

Bunlardan birine dokunacaksan **üçüne birden dokun** — ya da kapının bilerek
ayrık tuttuğu üç noktadan birine girdiğini kanıtla.

> Uç eğim kelepçesi `d * del1 <= 0` yazılır, `< 0` DEĞİL. Kesin `<`, çarpım tam
> sıfır olduğu için düz uç aralığını kaçırır ve eğri platonun altına sarkar.
> Bu bir kez kaçtı ve sevk edilen veride canlıydı.

Ayrıntı: **`references/interpolasyon.md`** — üç kopyanın haritası, bilerek
ayrık üç nokta, governor droop politikası ve neden B seçildiği.

## Governor droop: tablonun son aralığı

Allison eğrilerinde tablonun son noktası genelde "No Load Governed" (tork = 0),
bir öncekisi "Governed" ve **ikisinin arasında hiç veri yoktur.** PCHIP o tek
geniş aralıkta kirişin üstüne şişer.

Bugünkü kural: **yalnız SON aralık doğrusal geçilir** (`droopRunout` kapısı).
Bandın tamamını doğrusallaştırmak, droop bölgesinde gerçek veri noktası olan
motorları eziyor — ölçüldü ve reddedildi. Gerekçe ve sayılar
`references/interpolasyon.md` içinde.

## Testte modül nasıl yüklenir

`FT_SOLVER` bir IIFE ve `ft-performance.js` `module.exports` guard'ı taşımıyor;
tek başına `require` edilemez. Depodaki bütün FT testleri aynı diziyi kullanıyor:

```js
const stubs = stubGlobals();
global.veActiveModule = 'full-throttle';
global.COMPONENT_SIGNALS = {};
eval(loadSource('numerics.js'));
eval(loadSource('cp-engine.js'));
eval(loadSource('cp-gearbox.js'));
eval(loadSource('ft-performance.js'));
```

`js/cp-arac-performans.js` ve `js/mount-core.js` guard taşıyor → doğrudan
`require`. Ayrıntı `references/testler.md`.

## Bilinen açık ayrışmalar — yeni iş açmadan önce oku

Modülde bugün duran, kapatılmamış üç tutarsızlık var (RK45'in iki kopyası,
eşleştirme panelinin lineer okuması, takoz kütüphane kartının ayrı çekirdeği).
Bunlardan birine yakın bir iş yapıyorsan **önce oku** — yoksa aynı bulguyu
üçüncü kez keşfedersin.

Ayrıntı: **`references/acik-ayrismalar.md`**

## Örnek dosyaları veri, dekor değil

`assets/examples/ap_*.json` (15 örnek) girdileri iSCAAN raporlarıyla
doğrulanmış değerlere sabitlendi ve `arac-example-data.test.js` onları tutuyor.
Bir örneğin kütlesini, alanını, aks oranını ya da vites profilini "daha güzel
sonuç versin diye" değiştirmek, kalibrasyonun altındaki zemini kaydırmaktır.
Yerleşimleri de kapılı (`arac-example-layout.test.js`): şaft ekseni yatay,
zincir `curve`, dal `stepped`, teller ad üstünden geçmez.
