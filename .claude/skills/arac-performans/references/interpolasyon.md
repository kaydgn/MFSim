# Interpolasyon çekirdekleri — üç kopya, bir kapı

## Harita

Aynı Fritsch–Carlson monoton kübik Hermite (PCHIP) matematiği depoda **üç ayrı
yerde** yazılı ve hiçbiri diğerini çağırmıyor:

| # | Dosya | Fonksiyon | Kim besleniyor |
|---|-------|-----------|----------------|
| **A** | `js/numerics.js` | `veBuildPchipSpline` · `veEvalPchip` · `veEvalPchipDeriv` | Motor Freni modu (`simulation-engine.js` — tork eğrisi ve dT/dRPM), Takoz kütüphane kartı kuvvet-sehim grafiği (`cp-mount.js`) |
| **B** | `js/ft-performance.js` | `pchipCreate` · `_pchipEndSlope` · `pchipEval` | Tam Gaz modu: motor torku, konvertör K-faktörü ve τ |
| **C** | `js/mount-core.js` | `buildMonotoneCubic` | Takoz Newton çözücüsü, modal frekanslar, `fdefl` sinyal kanalı |

Kapı: **`tests/unit/pchip-uc-kopya.test.js`**. `assets/examples`'taki her
sayısal tabloyu üç kopyada 200 noktada karşılaştırıyor (tolerans `1e-9`; gerçek
verideki ölçülen max ayrışma `7,1e-13`, yani ~1400× pay).

## Uç eğim kelepçesi — bir kez kaçtı

Uç düğüm türevi MATLAB/SLATEC `pchipend` ile aynı: üç noktalı merkezsiz
karesel, ardından şekil koruma kısıtı. Referans testi `sign(d) ≠ sign(del1)` ve
**`sign(0) = 0`** olduğu için uç aralık DÜZ iken (`del1 == 0`, `d ≠ 0`) ateşler.

`ft-performance.js` bunu uzun süre `d * del1 < 0` diye yazıyordu. Kesin `<`,
çarpım tam sıfır olduğu için o durumu **kaçırıyordu**: düz plato ile başlayan ya
da biten her tabloda uç eğim sıfırlanmıyor, eğri platonun altına sarkıyor ve
PCHIP'in var oluş sebebi olan şekil koruma garantisi bozuluyordu.

Ölçüm — 400.000 rastgele `(h1, h2, δ1, δ2)` girdisinde referanstan sapma:

| Kopya | Kelepçe | Sapma |
|---|---|---|
| A `numerics.js` | `d · δ₁ ≤ 0` | **0** |
| C `mount-core.js` | `d · δ₁ ≤ 0` | **0** |
| B `ft-performance.js` | `d · δ₁ < 0` | **58.797** — hepsi `δ_uç == 0` iken |

Sevk edilen veride canlıydı: `ap_isb340_tc411` konvertörünün τ(SR) tablosunun
son aralığı düz (`0,975–0,99`'da τ = 0,985) → uç eğim `0,015` yerine `0`
olmalıydı. Oradaki etki `−3,3e-5`; ama gerçekçi bir düz platolu tork
tablosunda **7–35 N·m**.

`_pchipEndSlope`'un ikinci dalındaki `del1 * del2 < 0` kapısı **davranışsal
olarak ölüdür** ve o yüzden A/C'deki kapısız yazımla uyuşur: `δ1·δ2 > 0` iken
`d/δ1 = (2h1 + h2 − h1·(δ2/δ1))/(h1+h2) < 2 < 3`, yani kelepçe ateşleyemez;
`d/δ1 < −3` durumu zaten ilk dala düşer. 400.000 örnekte ayrışma: 0. Üç yazım
da aynı sonucu verdiği için olduğu gibi bırakıldı — **eşitlemeye çalışma.**

## Kapının BİLEREK ayrık tuttuğu üç nokta

Bunlar hata değil; kapı onları eşitlemez, ayrı olduklarını **iddia eder** — ki
biri sessizce "düzeltilirse" test konuşsun.

| Ayrışma | Kural ve gerekçe |
|---|---|
| **Tablo dışı** | A ve B uç değere yapışır (düz); C **doğrusal** uzatır. Zorunlu: düz uzantı Newton çözücüsünde teğet rijitliği tekilleştirip çözümü çökertiyor (gerekçe `mount-core.js:301-304`). |
| **n = 2** | A `null` döndürür ve `veEvalPchip(null, x)` sessizce **`0`** verir. Çağıranlar bunu `n >= 3` ile koruyor (`simulation-engine.js`, `cp-mount.js`); koruma unutulursa tork her yerde sıfır olur ve hiçbir uyarı çıkmaz. B ve C aynı durumda doğrusal. |
| **Geçersiz girdi** | Tek gerçek girdi doğrulaması **B**'de: yinelenen ya da azalan x'te adresli hata atar. A ve C sessizce saçma spline üretir. |

## Governor droop politikası

Allison eğrilerinde tablonun son noktası genelde "No Load Governed" (tork = 0),
bir öncekisi "Governed", **arada hiç veri yok.** PCHIP o tek geniş aralıkta
kirişin belirgin biçimde üstüne şişiyor.

Ölçülen taşma (aralık ortasında, PCHIP − kiriş; yüzde **son gerçek veri
noktasına** bölünerek):

| Motor | Son aralık | Taşma |
|---|---|---|
| ISG12 460 hp (`ap_bmc10ton_460`) | 1930–2100 | **+311 N·m** (%18,5) |
| ISG12 430 hp (`ap_isg430_4000sp`) | 1900–2100 | **+269 N·m** (%16,9) |
| Duramax (`ap_duramax`) | 3400–3600 | +39 N·m |

Sonuç: motor governed'ı aştığı bölgede tekerlek gücü fazla çıkıyor ve araç düz
yolda **olması gerekenden yüksek hızda** dengeye oturuyor. iSCAAN bu bandı
doğrusal geçiyor (raporun kendi motor eğrisiyle doğrulandı).

### Neden "yalnız son aralık" — üç seçenek ölçüldü

| | Kiriş taşması | Gerçek veri noktasından sapma |
|---|---|---|
| **A** saf PCHIP | +311 / +269 / +39 N·m | — |
| **B** yalnız son aralık doğrusal · **BUGÜNKÜ** | 0 | — |
| **C** tüm droop bandı doğrusal | 0 | ISG460'ta **−212 N·m @ 1930**, Duramax'ta **−235 N·m @ 3400** |

C, droop bandının içinde **gerçek veri noktası olan** motorları eziyor
(Duramax 3200/3400, ISB4.5 2530/2600, ve ISG460'ın 1930'u). B ikisinde de temiz
olan tek sütun. Karar 2026-09-07'de kullanıcıyla yeniden gözden geçirildi ve
**B kaldı**.

Kapı: `droopRunout` — tablonun son noktası tepe torkun %2'sinin altındaysa ve
bir öncekisi üstündeyse açılır. Sentetik droop ise ayrı bir kural ve YALNIZCA
tablo governor bölgesini kapsamıyorsa uygulanır (`tableMaxRpm < noLoadGoverned`);
aksi halde çift droop olurdu.

## Dokunacaksan

1. Üç kopyanın hangisine dokunduğunu bil ve diğer ikisini de aç.
2. `npx jest tests/unit/pchip-uc-kopya.test.js` — kapı yeşil mi?
3. `npx jest tests/unit/arac-example-calibration.test.js` — 13 araç, 81 geçiş.
4. Çözücünün sayısı değiştiyse büyüklüğünü ÖLÇ ve yaz. Altın çıpayı sessizce
   güncelleme.
