# Kalibrasyon kapısı — 13 araç, iSCAAN raporlarına sabitlenmiş

`tests/unit/arac-example-calibration.test.js`

Örnek JSON'ları gerçek `veGetPowertrainChain` yoluyla yükleyip
`veFTRunSimulationEngine` ile koşturuyor. `arac-example.test.js` örneklerin
**yapısını** koruyor (kayıt defteri ↔ disk, zincir tamlığı); bu kapı ise
örneklerin **çalıştırıldığında hâlâ iSCAAN raporlarındaki sayıları verdiğini**
tutuyor. Çözücüdeki bir değişiklik on beş örneği birden sessizce kaydırabilir
ve "makul ama yanlış" sonuç üretebilir — gözle yakalanmaz.

## İki çıpa ve KAYNAKLARI

**1 · Stall motor devri** — duran araçtaki konvertör denge noktası.
Kaynak: raporun `Gear F1 (Ratio = …) - Converter Mode` tablosunun **SR = 0.000**
satırındaki Engine Speed.

**2 · Azami hız** — düz yolda denge hızı.
Kaynak: `Vehicle Performance Summary` → `Maximum Speed on Grade | 0.0 | <hız> |
<vites> | Road Load`, bloğun başındaki **`Engine Fan | On`** ile birlikte.

### Bu referans İKİ KEZ yanlış seçildi — tekrarlama

**(a) Hızlanma tablosunun son satırı tavan hız DEĞİLDİR.** O tablo tam mph
ızgarasında basılıyor ve son satırda ivme hâlâ pozitif olabiliyor
(`bmc10ton_380_32t` aux 1.536: 53,1 km/h, a = 0,096 m/s²).

**(b) fan-On..fan-Off ARALIĞI kabul bandı DEĞİLDİR.** Örnekler fan **açık**
koşuyor (kavramalı fan, N³); fan-Off ayrı bir senaryo. O bant `tta2`'de %6,9
genişti ve gerçek sapmayı gizliyordu.

Doğru referans **fan-On** değeridir ve bant **±%0,8**'e daraltıldı.

## pumpTorqueDrop türetme kuralı

```
drop    = [motor eğrisinin DOĞRUSAL net-fan-on değeri @stall] − T_pompa
T_pompa = T_türbin / τ        (eşleme tablosunun SR=0 satırından)
```

MFSim net torku **eğriden** üretiyor (brüt − aksesuar modeli), bu yüzden drop da
eğri-net ile tutarlı olmalı.

Neden bu kural var: on iki örnekte raporun eşleme tablosundaki net tork ile
eğri-net **çakışıyor**, o yüzden fark görünmüyordu. `ypa4x4`'te iSCAAN
48,4 N·m'yi eşleme tablosunun net torkuna gömmüş ve çıkarıcı **21,4** üretmişti;
doğrusu **69,8**. Kural on üç örneğin hepsinde ±0,5 N·m içinde tutuyor.

## Kapı kırmızıya dönerse

Bu kapı, çözücünün ürettiği sayıyı değiştiren her düzenlemede **beklenen
sonuçtur**. Sıra:

1. **Altın değeri sessizce güncelleme.** Çıpa kaydın kendisidir; onu
   değiştirmek kaydı silmektir.
2. Ayır: değişiklik bir **düzeltme** mi (eski sayı yanlıştı) yoksa bir
   **regresyon** mu (yeni sayı yanlış)? Ayıramıyorsan kullanıcıya sor —
   bu ayrımı tahminle yapmak, filoyu bir yalana sabitlemek demek.
3. Düzeltmeyse: sapmanın büyüklüğünü ÖLÇ, hangi örnekte ne kadar kaydığını yaz,
   ve yeni değerin kaynağını (rapor, sayfa, tablo) kaydet.

Örnek: PCHIP uç eğim düzeltmesi (2026-09-07) çözücünün sayısını değiştirdi ama
ölçülen sapma `3,3e-5` olduğu için ±%0,8 bandının çok altında kaldı ve kapı
yeşil kaldı. Bu ölçülerek gösterildi, varsayılmadı.

## Yanındaki kapılar

| Dosya | Ne tutuyor |
|---|---|
| `arac-example-data.test.js` | Girdi bütünlüğü: kütle, alan, Cd, aks, Crr, vites, transfer, governed, aksesuar, `pumpTorqueDrop` — iSCAAN raporlarıyla doğrulanmış değerlere sabit |
| `arac-performans-shift-4500sp` · `-2957sp` · `-governed` · `-hunt` | Vites eşikleri ve avlanma bekçisi |
| `arac-performans-turan-calibration` · `-rev3-calibration` | Ayrı araç kalibrasyonları |
| `gear-efficiency.test.js` | Şanzıman bazlı ölçülmüş verim katsayıları, vites başına tablo, stall kaybı, geri viteste NaN yok |
| `matching-selection.test.js` | "Hangi şanzıman/konvertör seçili?" çözümü + örneklerin preset anahtarı sayılarla tutarlı |
