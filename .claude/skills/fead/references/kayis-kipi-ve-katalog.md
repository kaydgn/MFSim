# FEAD — kayış boyu kipleri ve katalog

> Kök `CLAUDE.md`'den taşındı. Metin birebir korunmuştur.

#### KAYIŞ BOYU SABİT DEĞİL — iki kip, ve "çözülemez" kümesinin kaldırılması

Kullanıcı bildirimi (2026-08-25): *"Biz tasarımı yaptıktan sonra tasarıma göre
tedarikçi ile iletişime geçip, tasarıma uygun bir kayış tedarik ediyoruz. O
yüzden kayışımız sabit değil… Ayrıca modelin çözülemez olduğu bir küme olmaması
gerekiyor. Çözülür, ama belki hatalı, belki sınırda çıkar."*

Haklıydı ve **ölçüldü**: alternatörü **1 mm** kaydırmak gergi kolunu −3.0°
döndürüyor, gerginliği −38.6 N (−%5.9) değiştiriyor; **10 mm**'de model
çözülemez oluyordu. Ama sebep geometri DEĞİL — o noktada geometri kusursuz
çözülüyor (Σsarım = 360.00°, altı span geçerli). Çöken tek şey şuydu:

```
kol 0°     → kayış yolu 1711.3 mm
kol 64.5°  → kayış yolu 1684.4 mm     (kolun TÜM gezinme aralığı)
istenen    → 1715.0 mm                ← 3.7 mm YUKARIDA, kuşatılamıyor
```

Yani duvar `solveArmForBeltLength`'in kök kuşatamamasıydı: **kısıtı biz
dayatıyorduk.**

##### Kol açısı ile kayış boyu TEK serbestlik derecesini paylaşır

Hangisinin GİRDİ olduğu seçilmek zorunda; `veFeadBeltMode` (kayış düğümünde
`data.lengthMode`) bunu söyler:

| Kip | Kol nereye oturur | ÇIKTI | Hangi soruya cevap |
|-----|-------------------|-------|--------------------|
| `fixed` | `solveArmForBeltLength(effLength)` | gerginlik | "Bu kayış bu düzene uyar mı?" |
| `free` | **nominal yay yükü açısı** `(M_mean − M₀)/k` | **kayış boyu** | "Bu düzen için hangi kayışı ısmarlamalıyım?" |

**SERBEST KİPİN ANKRAJI GERGİNLİK OLAMAZ.** Tasarım gerginliği artık bir girdi
değil, yay dengesinden TÜRÜYOR (bkz. *"ANKRAJ TÜRETİLİYOR"*). Hedef alınsaydı
döngü kurulurdu: gerginlik açıdan çıkıyor, açı gerginlikten. Nominal kol açısı
ise **salt yay künyesinden** geliyor — tedarikçi sayfasındaki *"Spring Mean
Load"* (BMC: 22.07 Nm) ve yay künyesi (M₀, k) yeter, geometriye hiç bakmaz.
Fizik de bunu söylüyor: gergi kolu yayı nominal momentine kurulmuş halde
çalışsın diye seçilir; kayış boyu da onu oraya oturtan boydur.

Serbest kip **"boyu hesaplanmış sabit kip"e indirgeniyor**: türetilen boy
`sys.belt.effLength`'e geri yazılıyor, böylece `positionTable`, `meanRel`,
`ribFatigueDistribution` ve `beltLifeB10` kipten haberdar olmak zorunda değil.

**GERİYE DÖNÜK:** kip yazılı değilse `effLength`'i olan proje `fixed` sayılır →
bugüne kadar kaydedilmiş her proje birebir eski davranışını korur. **ÖLÇÜLDÜ:**
dokunulmamış BMC sabit kipte `kol 28.4271° · L 1715.0000 · T 532.142 N ·
hub 302.125 N` — değişiklikten öncekiyle birebir aynı.

> Bu dört sayı bir dönem `28.5090° / 649.986 N / 369.064 N` olarak yazılıydı ve
> öyle KALDI: gergi pivotu bir GİRDİ olmaktan çıkıp parça künyesinden türemeye
> başlayınca (`aa8ddf7`) taban kaydı, ama yalnız o değişikliğin kendi bölümü
> güncellendi. Testler doğru çıpayı taşıyordu
> (`fead-belt-mode.test.js` → `TABAN`), yani kanonik kayıt kendi test dosyasını
> yanlış tarif ediyordu. Ölçülüp düzeltildi. **Regresyon değil**: 532.1 N,
> Gates'in 543.9 N'ına −%2.2 ve pivot bölümünde belgeli.

**BAĞIMSIZ DOĞRULAMA — ÖLÇÜLDÜ.** Serbest kip kayış boyunu HİÇ görmeden
hesaplıyor (girdi: kasnak koordinatları, çaplar, gergi künyesi) ve tedarikçi
sayfasının kendi kayışını geri veriyor: **1715.27 ↔ 1715 mm (%0.016)**.

**ÖLÇÜLDÜ (serbest kip, alternatör sürüklenirken):** −200…+60 mm boyunca çözüm
KOPMUYOR ve **hiç kenetlenme olmuyor**; kol 28.0625°'de duruyor, gereken boy
2095.4 → 1612.0 mm, gerginlik 358.8 → 1253.6 N.

**Gerginlik sürüklerken SABİT DEĞİL ve bu fizik:** aynı yay açısında moment
aynı (`M = M₀ + k·θ`) ama take-up geometriyle değişiyor
(`dL/dθ = a·sinβ·2sin(φ/2)`), dolayısıyla `T = M/(dL/dθ)` da değişiyor —
sürükleme aralığında **3.5 kat**.

**İki kip yakınsıyor ama ÖZDEŞ DEĞİL** ve fark anlamlı: sabit kip
`kol 28.4271° · L 1715.0000 (girdi) · T 532.14 N`, serbest kip
`kol 28.0625° · L 1715.2666 (çıktı) · T 525.55 N`. 0.36°'lik açı farkı 1715'in
**yuvarlanmış bir katalog boyu** olmasından. Özdeş olmalarını beklemek katalog
yuvarlamasını yok saymak olurdu.

> **BU BÖLÜM TARİHÎ (2026-08-26).** Anlattığı üç kipli yapı (`angleMode`
> mount/direct/envelope) kodda YOK — bkz. `cozum-ornekler-ve-ankraj.md`'nin
> *"AVARA MERKEZİ GİRDİ, MONTAJ KONUMU ÇIKTI"* bölümü. Bugün tek kip var ve
> nominal kol açısı zaten salt yay künyesinden geliyor. Ölçümleri, aynı hata
> sınıfı yeniden doğarsa tanınsın diye duruyor.

##### İŞLEVSEL DENETİM — iki sessiz kusur (2026-08-26)

Kullanıcı sordu: *"Kayış ya sabit oluyordu… veya serbest oluyordu… Bu programda
işlevsel olarak çalışıyor mu?"* Zincir uçtan uca ölçüldü ve **ana yolda
çalışıyor**: sabit kipte ±10 mm boy değişimi gerginliği `1101 → 356 N` aralığında
3.09 kat oynatıyor, serbest kipte boy alanına yazılan hiçbir değer
(`null/1500/1715/1900`) sonucu değiştirmiyor, −200…+60 mm taramasında 27/27 nokta
çözülüyor, kip proje kaydına giriyor ve gidiş-dönüşte korunuyor, geriye dönük
göç birebir (`lengthMode` yoksa + boy varsa → `fixed`, kol 28.4271°).

Ama **iki sessiz kusur** çıktı ve ikisi de aynı sınıftan: *panel, kolun nominal
açıda oturmadığı durumlarda çıkan boyu, oturmuş gibi basıyordu.*

**1 · NOMİNAL KOL AÇISI GEOMETRİ KAPISININ ALTINDAYDI.**
`rel_mean = (M_mean − M₀)/k` — üç sayı da salt yay künyesinden gelir, montaj
merkezi bu hesaba HİÇ girmez. Buna rağmen `veFeadTensionerMount` onu geometri
kapılarının altında hesaplıyor ve `cenX/cenY` yoksa erken dönüşte kaybediyordu.

Panelin **birinci sınıf** seçeneği (*"Serbest kol açısını elle gir"*,
`angleMode='direct'`) montaj merkezini SORMUYOR. **ÖLÇÜLDÜ** (BMC, künye
tastamam: 8.60 · 0.480 · 22.07 → 28.0625°):

| | kol | L | nominalRel | fallback | hata | uyarı |
|---|---|---|---|---|---|---|
| mount | 28.0625° | 1715.27 | 28.0625 | false | 0 | 0 |
| direct (eski) | **38.1174°** | 1717.32 | **NaN** | **true** | 0 | 0 |
| direct (yeni) | **28.0625°** | — | **28.0625** | **false** | 0 | 0 |

Yani kullanıcı hatasız ve uyarısız **yanlış boy ısmarlıyordu**. Hesap artık
bütün geometri kapılarının ÜSTÜNDE.

**2 · `nominalFallback` YAZILIYOR AMA HİÇ OKUNMUYORDU.**
Bayrak `js/` içinde tek bir yerden okunmuyordu; panel yine *"gergi künyesinden
hesaplandı… Tedarikçiye verilecek boy budur"* diyordu. Aynı sessizlik
KENETLENMİŞ çözümde de vardı: köprü sebebi adıyla yazıyor
(*"nominal çalışma açısı (280.6°) … aralığın dışında"*) ama Kayış Özellikleri
paneli `build.warnings`'i HİÇ basmıyordu — `veFeadWarningBox` yalnız Kayış Yolu
ve Çözücü panellerindeydi. **ÖLÇÜLDÜ** (`kArm` 0.480 → 0.048, gerçekçi bir
ondalık kayması): `L = 1754.94 mm`, nominalden **+39.7 mm**, panelde kenetlenme
izi **yok**.

Panel artık üç hâli ayırıyor ve sağlıklı modelde metin **birebir eskisi**
(yanlış alarm yok):

| durum | ne diyor | sayı |
|-------|----------|------|
| kol nominalde | *"Tedarikçiye verilecek boy budur"* | amber |
| künye eksik | *"…gezinme aralığının ORTASINDAN… tedarikçiye verilecek boy DEĞİLDİR"* | **kırmızı + ?** |
| kol kenetlendi | *"Kol nominal açısına oturamadı… bu boy ısmarlanmamalıdır"* | **kırmızı + ?** |

ve boyun OKUNDUĞU panel artık sebebi de basıyor. Bu, modülün kendi kuralının
uygulanması: **geçerlilik sınırı sonucun İÇİNDE taşınır** (B10 çap penceresi ve
tepe yükün *"KALİBRE DEĞİL"* damgasıyla aynı gerekçe).

Beş mutasyonla ölçüldü, beşi de kırmızı: nominal açıyı yine geometrinin altına
alma, panelin köken ayrımını kapatma, yalnız kenetlenme dalını kapatma, kayış
panelinden uyarı kutusunu kaldırma, şüpheli sayıyı işaretlememe.

##### Kipin TOPOLOJİ YÜZEYİ — kayış düğümünde tıklanabilir rozet

Kullanıcı isteği: *"Topoloji üzerinden çok basit bir şekilde 'kayış boyu sabit'
veya 'kayış boyu değişken' seçeneği olsun."*

Kip `node.data.lengthMode`'da ve **panel ile kanvas AYNI alanı okuyor**
(`veFeadBeltMode`) — Kayış Yolu kartındaki kol konumu seçicisinin kuralının
aynısı: iki ayrı ayar tutulsa panel bir kipi, rozet başkasını gösterirdi.

| Yüzey | Ne | Nerede |
|-------|-----|--------|
| Kanvas | Tıklanabilir rozet `SABİT` ↔ `SERBEST` | `veFeadApplyBeltModeBadge` |
| Panel | Açılır seçici + kipe göre değişen künye | `getFeadBeltPropertiesHTML` |

**Rozet salt gösterge değil, SEÇİM YÜZEYİ.** 60×54'lük kayış kutusuna açılır
liste sığmıyor, iki durumlu bir anahtar sığıyor. Renk kipin anlamını taşıyor:
`SABİT` mavi (bir GİRDİ), `SERBEST` amber (bir ÇIKTI — kayışın kendi rengi ve
bu modülde "hesaplanmış" demek).

**Rozet `mousedown`'ı DURDURMAK ZORUNDA:** düğüm sürüklemesi orada başlıyor
(`veAttachNodeDrag`), durdurulmazsa tık hiç gelmiyor — yön gülünde ölçülmüş
"hareketsiz tık kayboluyor" sınıfının aynısı.

**Serbest kipte "Efektif boy" bir ALAN DEĞİL, bir OKUMA.** Alan kaldırılıp
yerine hiçbir şey konmasaydı kullanıcı "boy nereden geldi" sorusuyla baş başa
kalırdı; `veFeadDerivedLengthHTML` türetilen boyu ve hangi kol açısından
geldiğini basıyor (tasarım gerginliğinin "Algılanan Model" tablosunda
görünmesiyle aynı gerekçe). Çözülemeyen modelde sayı UYDURULMUYOR — `—` ve sebep.

**Geçiş `saveState` çağırır** (geri alınabilir): kip bir görünüm tercihi değil,
çözümü değiştiren bir karar. Kol konumu ve yön gülü konumu bunun tersi ve
bilerek öyle.

Altı mutasyonla ölçüldü, altısı da kırmızı.

##### KATALOG BOYU = EFEKTİF BOY — depodaki veriyle kanıtlandı

Üreticiler aynı sayıya farklı ad veriyor: Gates *"effective length"*, Optibelt
ve ContiTech *"reference length L_b"*. Hangisi olduğu MFSim için kritik, çünkü
`belt.effLength` ISO 9981 efektif boyunu bekliyor ve `L_pitch − L_eff = 2π·h_b`
(Gates PK'da **7.54 mm**) — karıştırmak sessiz bir %0.44 kayması olurdu.

Cevap tahminle değil **ölçümle** verildi: BMC tedarikçi sayfası hem kasnak
koordinatlarını hem kayış adını (`8PK 1715`) veriyor. Serbest kip boyu HİÇ
görmeden hesaplıyor:

| hipotez | sapma |
|---|---|
| "1715" **efektif** boy | **0.267 mm · %0.0156** |
| "1715" pitch boy | 7.807 mm · %0.4552 |

Efektif hipotezi **29 kat** daha iyi uyuyor. Katalog adındaki sayı doğrudan
`effLength`'e yazılır, çevrim YOK.

##### "Çözülemez" yerine "sınırda" — kenetlenen kol çözümü

`FEADCore.bisect` kök kuşatılmamışsa açık hata veriyor ve bu **doğru bir
çekirdek davranışı** (sessizce uç nokta döndürmek "makul ama yanlış" cevap
üretirdi — çekirdeğin kendi notu: *"v1'de bu kontrol yoktu"*). Ama kasnak
konumu kanvastan sürüklenebildiği için kullanıcı çözüm uzayına **dışarıdan**
giriyor; her ara karede istisna kullanılamaz bir yüzey olurdu.

`veFeadSolveArmClamped` ayrımı koruyor: hedef kuşatılmışsa **çekirdeğin kendi
çözümü** döner (birebir, toleransı dahil); kuşatılmamışsa en yakın uca
kenetlenir ve sebebi `atLimit` ile taşınır.

**Kenetleme tek başına yetmedi ve sebebi fizikte.** Kolun uç konumu take-up
tekilliğine komşu (`T = M/(dL/dθ)`, `dL/dθ → 0`); oraya kenetlenince
**ÖLÇÜLDÜ: 4.15e10 N** gerginlik çıkıyor ve gerilme/hubload/ömür tablolarına
sızıyordu. Doğal çıkış noktası **keyfî bir eşik değil**: gerginin künyesi kolun
nominal çalışma açısını zaten söylüyor. Sığmayan kayışta anlamlı tek çalışma
noktası odur — serbest kipin bulduğu açının aynısı — ve oradaki
`requiredBeltMm` doğrudan *"hangi kayışı ısmarlamalıyım"* sorusunun cevabı:

> *"Seçilen kayış (1715.0 mm) bu yerleşime 1.6 mm KISA. … Çalışma noktası,
> gerginin nominal kol açısına alındı; bu yerleşim için gereken kayış
> **1733.3 mm**."*

**ÖLÇÜLDÜ:** 1000 mm'lik (700 mm kısa) bir kayışla bile model çözülüyor, ankraj
türetiliyor (643.2 N) ve önerilen boy **1715.3 mm** — yani sayfanın kendi
kayışı. Eskiden bu durum ankrajsız kalıyor, gerilme hiç hesaplanamıyordu.

Önerilen boyun, serbest kipin aynı yerleşimde bulduğu boyla **aynı** olması
testli — iki yol tek cevaba varmazsa biri sessizce yanlış demektir.

##### Geometri ihlalleri İSTİSNA değil, taşınan ihlal (`solveGeometry` hoşgörülü kipi)

Çekirdeğe **eklemeli** bir seçenek girdi: `solveGeometry(resolved, {tolerant:true})`
kapanma (Σsarım ≠ 360) ve temizlik (kayış kasnağın içinden geçiyor) ihlallerini
atmak yerine `geom.violations` olarak döndürüyor. Gerekçe: o iki durumda sayılar
**zaten hesaplanabiliyor** (teğet noktaları, spanlar, sarımlar); geçersiz olan
YOL, aritmetik değil. **VARSAYILAN KAPALI** → 2095 referans değerli doğrulama
kapısı değişmiyor (127 test, birebir yeşil).

**Kasnak çakışması bunun dışında:** orada ortak teğet YOKTUR, üretilecek sayı da
yoktur. Tek gerçek durdurucu odur ve hangi kasnak çifti olduğunu söyler.

Kart artık geçersiz yolu **çiziyor** ve sebebi durum şeridinde adıyla yazıyor
(`✗ Kayış yolu KAPANMIYOR · …`). Çizimi gizlemek teşhisi de gizliyordu — hangi
kasnağın ters sarıldığı ancak ona bakınca görünür.

##### ÜÇ SESSİZ HATA — üçü de geliştirme sırasında oldu, üçü de testli

| Hata | Belirtisi | Ölçüm |
|------|-----------|-------|
| Hoşgörü `feasibleRelMax`'ı bozdu | O fonksiyon kolun fiziksel sınırını **"istisna atıyor mu"** diye arıyordu; hiçbir şey atmayınca sınır **66.5° → 89°** çıktı, kayış hedefi kuşatılmamış sayıldı | BMC `L_eff` 1715.0 yerine **1730.2 mm** (+%0.89) |
| `_geomOpt` `makeSystem`'in SONUNDA atanıyordu | `sense` otomatik bulma probu daha önce ve `geometryAtRaw` **try/catch DIŞINDA** geometri çözüyor | Hoşgörü orada etkisiz, model **kurulmadan** atıyor |
| Dejenerelik ölçütü "sarım" sanıldı | Tekillik `sin(β)`'dan geliyor, sarımdan değil | Ters temasta kenetlenme noktasında sarım **360.00°** (kocaman) ama take-up **1.7e-8 mm/°**, T **3.2e10 N** |

Birincisinin düzeltmesi ince: ölçüt **"geçerli geometri veriyor mu"** oldu, ama
yol BAŞTAN geçersizse (yanlış kasnak sırası) bu ölçüt bütün aralığı elerdi ve
model yine cevapsız kalırdı → o durumda matematiksel alana geri düşülüyor.
Hoşgörü **kapalıyken** iki ölçüt aynı şey (ihlal zaten atar), yani doğrulanmış
davranışa etkisi YOK.

**Kapı altı mutasyonla ölçüldü, beşi kırmızı.** Altıncısı (kuşatma
ön-kontrolünü kaldırmak) **semantik olarak eşdeğer** — `try/catch` zaten aynı
kenetlemeye düşüyor; ön-kontrol sıcak yolda istisna kurmayı önleyen bir hızlı
yol, bağımsız gözlenebilir bir davranış değil.

##### Katalog — `js/fead-belts.js` (5 profil, 244 stok boy + otomotiv ızgarası)

`BELT_DB` (çekirdek) yalnız profil SABİTLERİNİ taşıyor (hb/hr/kütle); standart
BOYLAR ayrı bir katalog katmanında ve DOM'suz (`structural-materials.js` kalıbı).

**KATALOG BİR KISIT DEĞİL, BİR ÖNERİ.** Kullanıcının akışı tasarımdan tedariğe
gidiyor ve Optibelt kataloğu da bunu yazıyor: *"Further dimensions and minimum
order quantities on request"* + ayrı bir *"Intermediate lengths"* satırı. Ara
boy ısmarlanabiliyor, dolayısıyla panel elle girişi engellemiyor.

**İKİ KÜME AYRI ve karıştırılmıyor:**

| Küme | Ne | Nereden |
|------|-----|---------|
| `VE_FEAD_BELT_STOCK` | ISO 9982 / DIN 7867 endüstriyel boylar (PH 37 · PJ 71 · PK 62 · PL 47 · PM 27) | Optibelt "product range" kataloğunun RB bölümü, `profile and Lb (mm)` tablolarından birebir |
| `VE_FEAD_BELT_GRID` | Otomotiv pratiği — bir **KURAL** (5 mm adım), liste değil | piyasa taraması (1700·1705·1706·1707·1710·1714·1715·1720·1725) |

**AYRIMIN SEBEBİ ÖLÇÜLDÜ:** BMC'nin kendi kayışı **8PK 1715 endüstriyel stok
listesinde YOK** — komşuları 1690 ve 1755, yani **65 mm'lik boşluk**. Yalnız
stok listesi katalog sayılsaydı kullanıcının elindeki kayış "katalogda yok"
görünürdü. Izgara ise onu **tam** veriyor.

Izgara neden liste değil: 5 mm adım ölçülmüş bir PRATİK, gerçek üretim yer yer
daha ince (1706, 1707, 1714). 460 satırlık bir liste yazmak olmayan bir
kesinlik iddia etmek olurdu.

**KATALOGUN DEĞERİ LİSTE DEĞİL, SONUÇ.** `veFeadBeltFit` bir aday boyu çözüp
kolun nereye oturacağını ve gerginliği veriyor; "1690 mı 1755 mi" sorusu ancak
böyle cevaplanıyor. **Sığmayan aday bir sayı değil, bir HÜKÜM:** kenetlenme
take-up tekilliğine komşu olduğu için 1690 mm denenince **4.05e10 N** çıkıyor —
o sayı tabloya basılmıyor, `fits:false` ve "sığmıyor" yazılıyor.

**ÜÇ BAĞIMSIZ YOL TEK NOKTADA BULUŞUYOR** (testli): serbest kip geometriden
`1715.27 mm` diyor → katalog ızgarası `8PK1715` öneriyor → o boy seçilince
çözüm sabit kip tabanına (`kol 28.4271° · T 532.142 N · hub 302.125 N`)
**birebir** oturuyor.

Kaburga sayısı yalnız **PK** için yazılı (3–12, ContiTech otomotiv); endüstriyel
kayışlar kaburgalı rulodan kesildiği için diğerlerinde sayı UYDURULMADI —
`veFeadBeltRibsCheck` orada `null` döner, "geçersiz" demez.

Katalogdan boy seçmek **kipi de SABİTLER** (`veFeadPickBelt`): seçilen boy bir
girdi, serbest kipte kalmak kullanıcının seçimini sessizce yok saymak olurdu.

Kapı yedi mutasyonla ölçüldü, yedisi de kırmızı.

