# FEAD — çalışma çevrimi, gergi tanımı, ankraj ve örnekler

> Kök `CLAUDE.md`'den taşındı. Metin birebir korunmuştur.

> **Bu dosyanın gergi bölümü ÜÇ KEZ tersine çevrildi (2026-08-28 · 08-29 ·
> 09-01).** Güncel kural *"AVARA MERKEZİ GİRDİ, MONTAJ KONUMU ÇIKTI"*
> bölümündedir; ondan önceki bölümler kendi başlıklarında AŞILDI diye
> işaretlidir ve ÖLÇÜMLERİ için duruyorlar. Sırayla oku, atlama.

#### Çalışma çevrimi ve çözüm

Duty satırları Çözücü düğümünde durur ve **kW sözlüğü DÜĞÜM KİMLİĞİYLE
anahtarlanır, adla değil** — kullanıcı kasnağı yeniden adlandırınca girdiği güç
kaybolmasın (çekirdeğe geçerken ada çevrilir):

```js
node.data.duty = [ { rpm, dcPct, degC, kw: { <düğüm id>: kW } } ]
```

**Sürücü sütunu tabloda YOK.** Gücü çekirdek diğerlerinin toplamı olarak
hesaplar; çevrim ancak böyle kapanır. Elle girilirse çekirdek reddeder.

**Aksesuar kW'ı katalogdan gelebilir** — MFSim'in mevcut `VE_ALTERNATOR_PRESETS`
/ `VE_AC_PRESETS` / `VE_AIRCOMP_PRESETS` eğrileri (Araç Performans'la AYNI
kaynak, ikinci kopya yok). Aksesuar devri **kasnak pitch çaplarından**
hesaplanır, preset'in kendi `driveRatio`'su KULLANILMAZ: spesifikasyon §2.3'e
göre Excel'in en ciddi hatası elle yazılmış hız oranlarıydı ve bütün
gerilmeleri %17 düşürüyordu. Testi bu ayrımı kilitliyor.

Sonuç oturumluk bir global: `window.veFeadResults`. Takoz'un `veMountResults`'ı
ile aynı kalıp **ve aynı tuzak** — proje değişince temizlenmeli, yoksa yeni
projede önceki projenin tabloları durur (`_feadForgetResults`, `topology.js`
`veResetSubtopoNav`'dan çağrılıyor).

**ÖLÇÜLDÜ (gerçek tarayıcı, AG00686 duty tablosu):** çıkış gerilmeleri
`800: 1210/1208/767/766 · 1250: 1238/1237/767/766 · 2000: 1249/1248/766/766`,
hubload `1911/557/1938/350 · 1939/571/1966/349 · 1949/576/1977/349` —
**hepsi Gates raporuyla birebir.** Yorulma dağılımı `CRK 2.8 · IDR 43.5 ·
A_C 10.2 · TEN 43.5` (rapor 2.6/43.3/10.8/43.3 → 0.6 yüzde puanı içinde).

Gerilme, hubload, kayma ve frekans **HEP ÇALIŞMA (Mean) KONUMUNDA** hesaplanır
(`FEADCore.analyze` → `meanRel`), oysa Geometri tablosu kullanıcının seçtiği kol
konumunu gösterebiliyor. Sarım açısı konumla değiştiği için hubload da değişir;
bu yüzden iki sonuç kartının künyesinde konum **yazılı** — yoksa yan yana okuyan
kullanıcı Min konumun geometrisiyle Mean konumun hubload'unu eşleştirirdi.

##### ÇALIŞMA ÇEVRİMİ BOŞ AÇILMAZ — `js/fead-duty.js` (2026-08-31)

Kullanıcı bildirimi: *"Motor ve Çevrim kısmında aksesuar seçtiğimizde çalışma
çevrimini otomatik olarak hesaplamıyor. El ile girmek gerekiyor. Bu olmamalı.
Programın içinde aksesuarların devirlere göre güç değerleri mevcut olmalı.
Çalışma çevrimi sabit zaten, ona göre tabloyu program otomatik olarak
çıkarmalı."*

**Bildirimin bir yarısı TUTTU, öbür yarısı ÖLÇÜMLE DÜŞTÜ.**

| İddia | Hüküm |
|-------|-------|
| *"tabloyu el ile girmek gerekiyor"* | **DOĞRU** — ÖLÇÜLDÜ: taze sihirbazda **0 devir noktası**; aksesuar modeli seçilse bile doldurulacak satır yok. Panel de aynı: `duty: []` ve *"Henüz devir noktası yok."* |
| *"aksesuar güç değerleri programda mevcut olmalı"* | **ZATEN VAR** — `VE_ALTERNATOR_PRESETS` / `VE_AC_PRESETS` / `VE_AIRCOMP_PRESETS` (Araç Performans'la ORTAK). Eksik olan güç değil, o gücün yazılacağı SATIRDI |
| *"çalışma çevrimi sabit zaten"* | **TUTMADI** — arşivdeki 14 sistemde **ALTI ayrı** devir/%zaman deseni var |

###### TEK BİR "STANDART" ÇEVRİM YOK — ölçüldü

`tests/fixtures/fead-validation.js` taranınca:

| desen | sistem | devir bandı | %zaman |
|-------|-------:|-------------|--------|
| 12 nokta (AG00976) | 4 | 800–2750 | 25·4·4,5·5·5,5·6·7,5·9·0,5·12·16·5 |
| 6 nokta (AG00686 / AG0868) | **5** | 800–2000 | 27·10·13·18·19·13 |
| 10 nokta, ara noktalar sıfır (AG00810) | 1 | 600–2000 | 27·0·10·13·0·18·0·19·0·13 |
| 10 nokta, düşük devir (AG00894) | 1 | 519–2077 | 26,6·10·13·17·18·8·4·3·0,3·0,1 |
| 5 nokta (AG00879) | 1 | 600–2200 | 5·35·35·20·5 |
| 4 nokta (AG00902) | 2 | 700–3000 | 35·45·19·1 |

Yedincisi tedarikçiye GİDEN sayfada (`BMC_FEAD_2026`): 9 nokta, 800–2750.

Yani çevrim **motorun/aracın verisidir**, evrensel bir sabit değil. Tek bir
deseni "standart" diye gömmek, arşivin gösterdiği altı deseni yok saymak
olurdu — bu deponun `sayı UYDURULMAZ` kuralının tam karşılığı. Kütüphane bu
yüzden bir **liste**: yedi ölçülmüş kayıt, her biri kaynağıyla adlandırılmış.

###### VARSAYILAN BİR İDDİA DEĞİL, BİR BAŞLANGIÇ

`VE_FEAD_DUTY_DEFAULT = 'AG00686-6'` ve gerekçesi arşivden: 14 sistemin
**5'i** (en çoğu) bu çevrimi paylaşıyor, bandı (800–2000) ağır ticari bir
motorun rölanti–anma aralığı, ve altı satır gözle denetlenebilecek kadar kısa.
Seçici hemen üstünde duruyor ve kart hangi kaydın yüklü olduğunu **kaynağıyla**
yazıyor — yani "bu senin motorunun çevrimi" iddiası hiçbir yerde yok.

###### İKİ YÜZEY, TEK KÜTÜPHANE

| Yüzey | Nerede |
|-------|--------|
| Sihirbaz 6. adım — *"Çalışma Çevrimi Kaydı"* kartı | `_fwStepCevrim` → `veFeadWizDutyLib` |
| Çözücü paneli — *"Çevrim kaydı"* seçicisi | `veFeadDutyEditor` → `veFeadDutyLib` |

Etiket **tek üreticiden** (`veFeadDutyLabel`): iki yüzey aynı listeyi farklı
adlandırsaydı kullanıcı sihirbazda seçtiği çevrimi panelde bulamazdı (gergi
künyesi turunda ölçülmüş sınıf).

**"ÖZEL" BİR SEÇENEK DEĞİL, BİR OKUMA.** Kullanıcı satırları elle düzenlerse
tablo hiçbir kayda uymaz (`veFeadDutyMatch` → `null`) ve seçici bunu söyler.
Sessizce en yakın kaydı göstermek, düzenlenmiş bir tabloyu katalog kaydı gibi
okutmak olurdu. Eşleme **kW'a BAKMAZ**: güç girilmiş olması çevrimi değiştirmez.

###### TOHUM TEK SEFERLİK VE YALNIZ BOŞ TABLOYA

`veFeadDutySeed` bir `dutySeeded` bayrağı yazıyor. Bayrak olmasaydı, kullanıcı
satırları **bilerek** sildiğinde tablo her panel açılışında geri gelirdi. Dolu
bir tabloya hiç dokunulmuyor → **kaydedilmiş her proje birebir eski davranışını
sürdürüyor** (testli: kendi çevrimi olan bir düğüm ezilmiyor, örneklerin 12 ve
9 satırı korunuyor).

Tohum **panel kurulurken** atılıyor, eylem yolunda değil: yalnız
`_feadSolverNode`'a bağlansaydı tablo İLK açılışta yine boş görünür, ancak
kullanıcı bir düğmeye bastıktan sonra dolardı.

###### ÇEVRİM DEĞİŞİNCE kW TAŞINIR

Devri tutan satırların kayıtlı ölçümü korunuyor; ortak olmayan devirde kW
**uydurulmuyor** (boş kalıp katalogdan hesaplanıyor). Taşınmasaydı çevrim
değiştirmek AG00976'nın rapordan gelen güç tablosunu sessizce silerdi.

###### AYNI TURDA ÇIKAN SESSİZ KUSUR — "güç yok" ile "model yok" aynı etiketti

`_fwKwEff` iki bambaşka durumu tek `yok` etiketine katıyordu:

| durum | doğru anlamı |
|-------|--------------|
| model henüz **çözülmüyor** | güç **hesaplanamaz** — aksesuar devri kasnak pitch çaplarından gelir, yarım modelde bilinemez |
| model çözülüyor, katalog/eğri yok | gerçekten **0 kW ile koşar** |

Yarım modelde kart bütün aksesuarları *"güç yok"* diye uyarıyordu; oysa eksik
olan güç değil MODELDİ. Ayrı etiket: `cozumsuz` → *"model çözülmüyor"*.

###### ÖLÇÜLDÜ — uçtan uca

| | önce | sonra |
|---|---:|---:|
| taze sihirbaz duty satırı | **0** | **6** (`AG00686-6`) |
| çözücü paneli duty satırı | **0** + *"Henüz devir noktası yok."* | **6** + çevrim seçicisi |
| aksesuar modeli seçilince ALT kW (12 nokta) | elle | **7,62 … 15,13 kW** (katalog) |
| çevrim `AG00902-4`'e çevrilince | — | devir 700·1200·2000·3000, kW **4,99 · 10,74 · 13,68 · 15,40** |

Son satır asıl kazanç: çevrim değişince kW **yeni devir noktalarında yeniden
hesaplanıyor** — hiçbir yerde elle giriş yok.

**GERÇEK TARAYICI:** sihirbaz taze açılışta 6 satır · açılır pencereden gerçek
seçim `700·1200·2000·3000` veriyor · kW hücreleri `kayıtlı ölçüm` / `2.70` /
`3.61` basıyor; panel 6 satır ve seçiciyle açılıyor, *"Henüz devir noktası
yok."* mesajı **yok**; konsol temiz.

Kapı **on üç mutasyonla** ölçüldü, on üçü de kırmızı: sihirbazı yine boş
tabloyla açma, panel tohumunu kaldırma, tohumun dolu tabloyu da ezmesi,
tek-seferlik bayrağını kaldırma, kW taşımayı iki yüzeyden tek tek düşürme,
kütüphaneye uydurma bir "standart" çevrim ekleme, bir kaydın %zamanını
kaynaktan kaydırma, listeyi referansla döndürme, eşlemenin kW'a bakması,
`cozumsuz`u yine `yok` yapma, çevrim seçicisini iki yüzeyden tek tek düşürme.

##### Duty sıcaklığı: satır başına °C → çekirdeğin istediği TEK °C

Çekirdeğin `beltLifeB10`'u sıcaklığı **toplam geçiş sayısını çarpan tek bir sayı**
olarak alıyor (`D = geometri · Σ geçiş · 2^((T−80)/23)`), duty tablosu ise
sıcaklığı **satır başına** soruyor. İndirgeme köprüde (`veFeadDutyDegC`) ve iki
kez yanlıştı:

| Ne yanlıştı | Sonuç | Neden sessiz |
|-------------|-------|--------------|
| `d.dcPct \|\| 100/n` — açıkça **0** girilen yüzde "girilmemiş" sayılıyordu, payda ise 0 sayıyordu | ağırlıklar 1'e toplanmıyordu | hata yok, yalnız sayı kayıyor |
| sıcaklıkların **aritmetik** ortalaması | ömür hep **uzun**, hep aynı yöne | tek sıcaklıklı tabloda fark yok |

**ÖLÇÜLDÜ (BMC örneği):** bütün yüzdeler boşken degC 90 yerine **1000 °C**;
sayfadaki gibi TEK bir satır %0 girilince (3000 rpm satırı) 90 yerine 99 °C ve
B10 **992 → 756 saat (−%24)**; satırlar 70…110 °C'ye dağılınca aritmetik
ortalama 89.4 °C → 1010 saat, doğrusu 96.7 °C → **810 saat** (ömür 1.25× uzun
görünüyordu). Çekirdek aynı yeri doğru yapıyor (`u.dcPct != null ? …`).

Doğrusu **yaklaşıklık değil, cebirsel özdeşlik**: satır başına hasarı toplayıp
geri çözünce

```
degC_eş = 80 + ΔT · log2( Σ wᵢ · 2^((Tᵢ − 80)/ΔT) ),   wᵢ = geçiş payı = dcᵢ·vᵢ/L
```

çıkıyor. Tek sıcaklıklı tabloda `log2(2^x) = x` → tam o sıcaklık, yani
doğrulanmış Gates sonuçları **kaymıyor**. Ağırlık `dc` değil **geçiş sayısı**
(`dc·v`): çekirdek `passes` toplamını da böyle kuruyor, yüksek devirde kayış
birim zamanda daha çok geçiyor. Beş mutasyonla ölçüldü (eşdeğer→aritmetik 3
test, `dc·v`→`dc` 2, sıfırı yine "girilmemiş" sayma 1, uyuşmazlık uyarısını
susturma 1, ΔT 23→30 1) — hepsi kırmızı.

##### Yorulma modeli seçimi mutlak ömre GEÇEMEZ — ve bunu söylüyor

Panel iki yorulma modeli sunuyor (`PK-2_2p-MT3` m=5.6 ↔ `PK-2_2a-MT3` m=4.05)
ve seçim **dağılıma** geçiyor. Mutlak ömre geçemez: `beltLifeB10`'un `C` sabiti
`Σ w·d^(−m)` ölçeğini soğuruyor, üs değişince ömür yüzlerce kat kayar
(**ÖLÇÜLDÜ:** BMC 992 → **1.1 saat**). Doğrulama koşucusu B10'u yalnız 5.6
takımıyla ölçüyor; tek PK-2_2a sistemi olan AG00810 ayrıca çap aralığının da
dışında. Eskiden panel, m=4.05 ile hesaplanmış bir dağılım tablosunun hemen
altına m=5.6 ile hesaplanmış bir ömür basıyordu — **sessizce**. Artık ömür kartı
hangi sabitlere göre olduğunu yazıyor (`VE_FEAD_LIFE_FATIGUE_MODEL`); sayı
gizlenmiyor, çünkü bu modülün kuralı geçerlilik sınırını sonucun **içinde**
taşımak.

#### Tedarikçi sayfası (FEAD_INFORMATION) — panellerin girdi biçimi

Paneller **tedarikçiye gönderilen sayfanın biçimini** soruyor: kasnak merkez
koordinatları, çaplar, gergi konumu, aksesuar devir/güç tabloları, motor duty
cycle, otomatik gergi künyesi. Sayfanın kendisi `js/fead-model.js` içinde
`VE_FEAD_EXAMPLES['BMC_FEAD_2026']` olarak yaşıyor ve tek tıkla iç topolojiye
kuruluyor (`veFeadLoadExample`). Bu aynı zamanda **ikinci, bağımsız doğrulama**:
Gates raporlarıyla ortak hiçbir sayı yok, `tests/unit/fead-example.test.js`
dört bağımsız çıpaya bakıyor — kayış boyu **1715 mm**, kol boyu **90.0 mm**,
Spring Mean Load **22.07 Nm**, tahrik oranı **197.32/179.62 = 1.1** — ve dördü
de tutuyor.

**İKİ SESSİZ KANAL — ikisi de ölçüldü, ikisi de testli:**

| Karışan şey | Sonuç | Neden sessiz |
|-------------|-------|--------------|
| Gergi **montaj merkezi** ↔ **serbest kol açısı** | gerginlik 650 N yerine **251 N** (2.6× düşük) | geometri kusursuz çözülür, hata verilmez |
| ~~**Tasarım gerginliği** ↔ **yay dengesi**~~ | ~~bütün gerilme ve hubloadlar 250 N kayar~~ | **KAPANDI** — alan kaldırıldı, ankraj türetiliyor |

Birincisi: sayfa serbest açıyı VERMİYOR, gergi kasnağının **montaj merkezini**
veriyor. Serbest açı `veFeadFreeAngleFrom` ile türetilir
(`montajAçı − sense × (Mean−Pre)/Rate`); `sense`i çekirdek bulduğu için
`veFeadBuildSystem` **iki geçiş** yapıyor. `|montaj merkezi − pivot|` ile
girilen kol boyu 0.5 mm'den fazla ayrılırsa çözüm DURUR — iki sayı da sayfada
yazar, uyuşmazlık okuma hatasıdır. Panel varsayılanı VERİDEN çözülür
(`veFeadAngleMode`): eski kayıtlar yalnız `freeAngleDeg` taşıdığı için koşulsuz
`mount` varsayılanı onları açılışta çözülemez yapardı.

İkincisi ARTIK YOK: tasarım gerginliği sorulmuyor, türetiliyor — aşağıdaki
"Tasarım gerginliği bir GİRDİ DEĞİL" bölümüne bakınız.

Servis faktörü (sayfada 1.3) kayma emniyetinin istenen alt sınırı olarak sonuç
tablosunda hüküm veriyor — eşik eskiden 1.3'te SABİTTİ, artık kullanıcının
girdiği değer.

##### Tedarikçiden DÖNEN rapor da bir örnek — `AG00976_GATES_2025` (2026-08-25)

Yukarıdaki `BMC_FEAD_2026` tedarikçiye **giden** sayfadır (FEAD_INFORMATION,
26.05.2025). Artık ondan **dönen** rapor da kayıt defterinde: *"AG00976 BMC
Otomotif FEAD 5 · Cummins Eng.Scndr ALT&AC Drive · Gates 8PK1715HD-Fleetrunner ·
Ten@-250/110 · Corrected-IDR1 · 05.06.2025"*, Gates v13.02. Aynı araç, aynı altı
kasnak — ama **aynı sayılar değil**, ve ikisinin birden durmasının sebebi bu.

Bu rapor `tests/fixtures/fead-validation.js` içinde **zaten** vardı
(`AG00976['1715@-250/110']`, 2095 değerlik kapının parçası); eksik olan onu
kanvasa **kurulabilir** yapmaktı. Referans değerler ikinci kez yazılmadı —
`tests/unit/fead-example-ag00976.test.js` fixture'dan okuyor.

###### Uçtan uca ÖLÇÜLDÜ — örnek raporu geri üretiyor

Doğrulama harness'ı `makeSystem()`i doğrudan çağırıyor, yani **köprüyü atlıyor**.
Bu örnek zincirin tamamını koşturuyor (örnek tanımı → düğüm dizisi →
`veFeadBuildSystem` → çekirdek):

| Ne | Kaç değer | En kötü sapma |
|----|----------:|---------------|
| span + sarım | 12 | **0.039** (derece/mm) |
| gergi konum tablosu (kol · X · Y · β · sarım · EDL · REBL) | 6 × 7 | kol **0.063°** |
| konum gerginliği / hubload | 6 × 2 | **%0.13** / **%0.09** |
| duty gerilme + hubload | 12 × 6 × 2 | **%0.09** / **%0.15** |
| sürücü kW | 12 | **birebir** (6.34) |
| take-up · yay momenti | 2 | **%0.03** / %0.09 |
| **tasarım gerginliği (TÜRETİLEN)** | 1 | **birebir** (544 N) |
| **serbest kol açısı (TÜRETİLEN)** | 1 | **0.04°** (16.06 ↔ 16.1) |

Son iki satır bedava değil, **bağımsız doğrulama**: ikisi de örnekte YAZILI
DEĞİL, geometri + yay künyesinden çıkıyor, ve rapor ikisini de ayrıca basıyor.

###### EFEKTİF BOY 1714.6 — raporun başlığı değil, REBL sütunu

Rapor başlığı `Effective Belt Length (ISO 9981) 1715` diyor. Ama kendi
*Tensioner Geometry* tablosunun REBL sütunu dört konumun **dördünde de tam
0.4 mm aşağıda**: 1730.9 / 1720.6 / 1714.6 / 1708.6. Aradaki **adımlar** birebir
tutuyor (tol 6.0 ve `wear·L` = 0.006 × 1715 = 10.29), yani kayan şey adım değil
nominal boyun **kendisi** — "1715" yuvarlanmış katalog adı (8PK**1715**HD).

**ÖLÇÜLDÜ:**

| efektif boy | en kötü kol | en kötü gerginlik | 12 span/sarım |
|---|---|---|---|
| 1715.0 (katalog adı) | 0.62° | **%2.28** | 2'si kayık |
| **1714.6** (REBL sütunu) | **0.08°** | **%0.29** | **12/12 birebir** |

0.4 mm'lik bir okuma farkı kolu 0.56° döndürüyor ve gerginliği %1.5 kaydırıyor.

###### DEVİR SÜTUNU MOTOR DEVRİ DEĞİL

Rapor FAN kasnağını krank kabul ediyor (`Speed Ratio (Ref. Engine) FAN = 1.000`)
ve duty tablosunun "Engine RPM" sütunu **o kasnağın** devri. Sayfanın kendi ilk
satırı bunu doğruluyor: motor 800 × 1.1 = **880**. Bu yüzden örnek
`driveRatio: 1` ile kurulu — raporu geri üretmek için gereken tanım budur.
Gerçek motor devri isteniyorsa `ratioMode:'derive'` + krank/fan çapları
(`BMC_FEAD_2026` öyle).

###### Sayfanın elle yazdığı hız oranı ÇAPLA çelişiyor

Sayfa alternatör oranını **dış çaplarla** yazmış: `162/57 = 2,842`. Raporun ve
modelin değeri **2.768** (pitch: 164.4/59.4). **%2.7 fark**, ve bu sayı aksesuar
devrini belirlediği için doğrudan güç eğrisi okumasına giriyor. Spesifikasyon
§2.3'ün *"Excel'in en ciddi hatası elle yazılmış hız oranlarıydı"* maddesinin
bu veri setindeki karşılığı; oran her zaman **pitch çapından** hesaplanıyor
(`veFeadAutoKw`) ve test bunu ayırt ediyor.

###### SAYFADA OLMAYIP RAPORDA OLAN ÜÇ ŞEY — ve %19.5'lik fark

| Alan | Sayfa | Rapor |
|------|-------|-------|
| gergi **PİVOTU** | **yok** — yalnız kasnağın *"öngörülen merkezi montaj pozisyonu"* | **(−250.00, 110.00)**, dosya adında da yazılı |
| kayış **toleransı** | yok | **±6.00 mm** |
| **aşınma payı** | yok | **%0.60** |

`BMC_FEAD_2026` pivotu **veriden TÜRETMİŞTİ** (`|merkez − pivot| = kol boyu`
olacak şekilde: −259.94, 104.15). Rapor gerçek pivotu yazınca ayrışma
ölçülebilir oldu: iki pivot **11.5 mm** apayrı.

**İZOLASYON — ÖLÇÜLDÜ** (Mean konumu, rapor 543.9 N):

| adım | kol | gerginlik | sapma |
|------|-----|-----------|-------|
| 0 · sayfa olduğu gibi | 28.51° | 650.0 N | **+%19.5** |
| 1 · + gerçek pivot | — | — | **ÇÖZÜLMEZ** ↓ |
| 2 · gerçek pivot + serbest açı 16.1° | 29.77° | 571.5 N | +%5.1 |
| 3 · + tolerans/aşınma | 29.77° | 571.5 N | +%5.1 |
| 4 · + `lengthOffset` 1.6 | 27.50° | 534.8 N | −%1.7 |
| 5 · + efektif boy 1714.6 | 28.06° | 543.5 N | **−%0.1** |

**1. adım bir hata değil, kapının ısırması:** sayfanın montaj merkezi raporun
gerçek pivotundan 90 değil **80.65 mm** uzakta, ve `veFeadArmCheck` çözümü
durdurup farkı adıyla yazıyor (*"fark −9.35 mm; ikisi de sayfada yazar, biri
yanlış okunmuş"*). İki belge körlemesine birleştirilemiyor — tam olarak
istenen davranış.

**3. adım tolerans/aşınmanın Mean'i etkilemediğini gösteriyor** ve bu doğru:
o iki alan çalışma noktasını değil **zarfı** açar. Sıfır bırakılınca
`Replace = Max = Mean = Min` oluyor, yani kolun gezinme aralığı hiç görünmüyor —
hata da alınmıyor. Örneğin o iki alanı taşıması bu yüzden veri değil **özellik**.

###### İki sapma kaldı, ikisinin de sebebi MODELİN KENDİ İLAN ETTİĞİ SINIR

| Büyüklük | MFSim | Gates | Sapma | Neden |
|---|---|---|---|---|
| B10 (ham) | 1403 s | 2670 s | **−%47** | ALT **Ø57 mm**, geçerlilik aralığı 79.6–176 mm. Model bunu `inValidRange:false` + `outOfRange:["…(d=57.0 mm)"]` ile **kendisi söylüyor** ve 0.55× sistematiği belgeli |
| B10 (düzeltilmiş) | 2551 s | 2670 s | **−%4.5** | ampirik düzeltme uygulanmış hâli |
| Burulma 1. mod | 12.95 Hz | 12.52 Hz | **+%3.4** | bu sistem burulma **kalibrasyon takımında DEĞİL** (takım: AG00686 ×2 + AG0868 ailesi) → kalibre edilmemiş bir sisteme karşı bağımsız ölçüm, modelin kendi ±%8 bandının içinde |

Burulmada **krank MİLİ ataleti** yine ısırdı: geçilmezse 12.95 → **16.76 Hz**
(+%29). Testi ikisini de koşturup farkı belgeliyor.

###### kW örnekte KASNAK ANAHTARIYLA durur, çekirdeğe DÜĞÜM KİMLİĞİYLE gider

Duty satırlarının kW sözlüğü çekirdeğe **düğüm kimliğiyle** gidiyor
(`veFeadDutyToCore` → `r.kw[n.id]`), ama örnek tanımına kimlik yazmak örneği
düğüm kurma ayrıntısına bağlardı. Örnek `kwByKey:{ A_C:2.70, … }` yazıyor,
çeviri `veFeadExampleNodes`'ta **tek yerde**. Ayrışırsa hata **SESSİZ**:
eşleşmeyen kimlik "kW girilmemiş" sayılır ve o aksesuar **0 kW** ile koşar —
çözüm yine üretilir, yalnız gerilmeler düşer. Kapı bunu iki uçtan tutuyor
(çeviri oldu mu · olmazsa sonuç gerçekten değişiyor mu).

###### Panel kartı iki örneği AYIRT EDİYOR

Kart *"birinci kademe: `<crankOD>` / `<fanOD>` mm"* satırını ham basıyordu;
Gates örneğinde o iki alan YOK (`ratioMode:'direct'`) → **"undefined / undefined
mm"** çıkıyordu ve bir sayı gibi okunuyordu. Satır artık kipe göre yazılıyor,
ve karta **kayış satırı** eklendi (`8PK1715HD · 1714.6 mm · tolerans ±6 mm ·
aşınma %0.60` ↔ `8PK 1715 · 1715 mm · tolerans YOK · aşınma YOK`) — iki örneğin
farkı listede görünsün diye. Aksesuar gücü iki yoldan gelebildiği için
(kasnağın kendi eğrisi ↔ duty satırındaki kW) kart ikisini ayrı ayrı sayıyor;
yalnız eğriyi saysaydı raporlu örnek "0 aksesuar" der ve boş görünürdü.

**Kapı sekiz mutasyonla ölçüldü, sekizi de kırmızı:** efektif boy 1714.6 → 1715
(6 test), pivot → sayfanınki (19), gergi teması back → grooved (10), tolerans
6 → 0 (2), kimlik çevirisini kaldırma (3), tahrik oranı 1 → 1.0985 (3), ALT
çapı 57 → 59.4 (8), kart düzeltmesini geri alma (1).

##### Rapor incelemesi — bir SESSİZ girdi kaybı ve beş bayat yüzey (2026-08-25)

Kullanıcı, `AG00976_GATES_2025` örneğinden üretilmiş bir raporu inceletti:
*"Raporda yanlış yerler var. Eksik yerler de var."* Haklıydı ve çıkan kusurlar
iki ayrı sınıftandı.

###### KÖK NEDEN: duty kW'ı çözüme HİÇ ULAŞMIYORDU

Raporun §8.10 tablosunda bütün kW'lar **0,00**, §8.11'de bütün açıklık
gerginlikleri **544 N** (yani tasarım gerginliğine düzleşmiş), hubload'lar
`1065/484/1074/579/1066/323`. **Hiçbir hata mesajı yoktu.**

Sebep: duty satırlarının kW sözlüğü **düğüm kimliğiyle** anahtarlanır
(`veFeadDutyToCore` → `r.kw[n.id]`), ama `veFeadLoadExample` her düğümü
**yeni bir kimlikle** kuruyor (`createNode` kendi kimliğini üretir) ve
`data`'yı birebir kopyalıyor. Sözlük `ex-A_C` anahtarlarıyla kalıyor, kanvas
düğümü `canvas-3` oluyor → hiçbir aksesuar eşleşmiyor → hepsi 0 kW.

`idMap` zaten vardı ama **yalnız bağlantılar için** kullanılıyordu. Göç artık
`veFeadRemapDutyKw` ile (fead-model.js, DOM'suz) ve döngü BİTTİKTEN sonra
yapılıyor — çözücü düğümü de aynı döngüde kurulduğu için harita ancak orada
tamamlanıyor. Eşleşmeyen anahtar **silinmiyor**, olduğu gibi taşınıyor:
kullanıcının kanvasta zaten düzenlediği bir satırın anahtarı haritada olmaz.

**ÖLÇÜLDÜ (gerçek yükleyici, düzeltmeden önce ↔ sonra):**

| 880 d/d | önce | sonra | Gates |
|---|---|---|---|
| sürücü kW | 0,00 | **6,34** | 6,34 |
| gerilme | `544·6` | **1381/1380/1023/1022/545/544** | 1381/1380/1023/1022/545/544 |
| hubload | `1065/484/1074/579/1066/323` | **1892/1228/2373/1089/1539/324** | 1891/1228/2372/1088/1539/324 |

**MEVCUT TESTLER BU SINIFI GÖREMİYORDU** ve sebebi öğretici: hepsi
`veFeadExampleNodes`'u DOĞRUDAN kullanıyor, yani kimlikler `ex-*` olarak
kalıyor ve eşleşme **tesadüfen** tutuyor. Kapı bu yüzden gerçek yükleyiciyi
(`createNode` sözleşmesi taklit edilerek) koşturmak zorunda.

###### KAYMA HÜKMÜ KAYMASI İMKÂNSIZ BİR KASNAKTAN GELİYORDU

Rapor *"En düşük kayma emniyeti 1,24 ✗"* deyip **"tasarım onaylanmamalıdır"**
hükmü veriyor ve çaresini *"tasarım gerginliğini yükseltin"* diye yazıyordu.
Ama raporun **kendi §8.7'si** şunu söylüyor: *"yük çekmeyen kasnaklarda
gerginlik oranı 1'dir ve SF hiç değişmez."* Yani önerilen çare, hükmü veren
kasnakta **ölçülebilir bir etki yapmıyor**. Belge kendi kendisiyle çelişiyordu.

**ÖLÇÜLDÜ (AG00976, 880 d/d):**

| | oran | kapasite | SF |
|---|---|---|---|
| Sürücü · Klima · Alternatör (**yük taşıyan**) | 1,348–2,538 | 11,6–22,6 | **4,58–16,73** |
| Avara 1 · Avara 2 · Gergi (**yük taşımayan**) | 1,0010–1,0024 | 1,24–1,48 | **1,232–1,479** |

SF = kapasite / oran. Oran ~1,00 iken SF bir **MARJ değil, KAPASİTEDİR** — o
sarım açısının taşıyabileceği azami oran. Servis faktörü ise TALEBİN üzerine
konan bir marjdır; talep yokken anlamsızdır. İki küme arasında **iki mertebe**
fark var, yani ayrımın eşiği (`VE_FR_SLIP_LOADED_RATIO` = 1,01) kritik değil.

Gates de aynı sistem için hemfikir: *"Belt Slip Sensitivity"* sayfasının
*"Required Increase Tension or Wrap Angle"* sütunu **altı kasnağın hiçbirinde
dolu değil**.

**Tablo GİZLENMİYOR** — altı kasnağın altı sayısı da basılmaya devam ediyor;
değişen yalnız HÜKMÜ verenin hangisi olduğu, ve yük taşımayanlar kapasiteleriyle
ayrıca yazılıyor.

###### Dört bayat yüzey — model değişti, metin kalmıştı

| Yer | Neydi | Neden yanlış |
|-----|-------|--------------|
| §8.1 | `Kayış efektif boyu: 1716,2 mm · gereken 1714,6 mm` | 1716,2 **TAHRİK** boyudur (Gates *Effective Drive Length*), kayış künyesindeki efektif boy değil. §8.8 ikisini zaten ayrı adlandırıyordu, özet ayırmıyordu |
| Antet | `8 kaburga · 1715 mm` | `_frF(effLength, 0)` — tam sayıya yuvarlama katalog adını gerçek boyun yerine koyuyordu; aradaki 0,4 mm kolu 0,56° döndürüyor |
| §8.7 giriş | *"biri kullanıcının girdiği ankraj… ikisinin karşılaştırması verilir"* | Tasarım gerginliği alanı KALDIRILDI (ankraj türetiliyor); okuyucu panelde olmayan bir alanı arıyordu |
| Uygunluk #6 | `Tasarım gerginliği ↔ yay dengesi · sapma ≤ %2 · ✓` | **TOTOLOJİ**: ankraj artık yay dengesinin ta kendisi, sapma yapısal olarak sıfır. Geçen bir kriter gibi görünüp hiçbir şey denetlemiyordu → artık *"türetilebildi mi"* soruyor ve sayıyı yazıyor |

###### İki eksik yüzey

**§8.3'te gergi kasnağının X/Y'si `—` basılıyordu** — oysa konum bilinmiyor
değil, **türetilmiş**: çözülmüş çalışma merkezi. Artık basılıyor (eğik + †
ile türev olduğu işaretli). Dipnot ayrıca **§8.7'ye** yolluyordu; orada X/Y
YOK (kol açısı, sarım, β, take-up, moment, gerginlik, hubload var), konum
tablosu **§8.8**'de.

**§8.13 hiçbir aksesuara güç girilmemişse tek sütunlu ve bomboş** çıkıyordu:
on iki devir satırı, hiçbir sayı, hiçbir açıklama. Okuyucu bunu *"tork
hesaplanamadı"* diye okuyordu; sebep girdinin kendisiydi. Artık boş tablo hiç
basılmıyor, yerine sebep yazılıyor.

**Kapı sekiz mutasyonla ölçüldü, sekizi de kırmızı:** kW göçünü kaldırma (2 test),
göçün eşleşmeyeni silmesi (1), §8.1 eski etiket (1), antet yuvarlaması (1),
§8.7 bayat metin (1), uygunluk #6 totolojisi (1), §8.13 kapısı (1), kayma
hükmünü global en düşüğe çevirme (1).

> Sekizincisi **ilk turda YEŞİL kaldı**: kapı hükmün ETİKETİNE bakıyordu,
> SAYISINA değil. Yalnız başlığı denetleyen bir test, `_frMinSF`'i global en
> düşüğe geri çeviren mutasyonu geçiriyordu. Kapı artık iki kümenin ayrıştığını
> ve hükmü verenin yük taşıyanların en düşüğü olduğunu SAYIYLA tutuyor.


##### GERGİ KÜNYESİ RAPORDAN, PİVOT BİR TASARIM ÇIKTISI (2026-08-25)

> **BU BÖLÜM AŞILDI — anlatılan yapılandırma kodda YOK.** `BMC_FEAD_2026` bir
> sonraki bölümde pivotu GİRMEYİ bıraktı; bugün kasnak merkezi sayfanın kendi
> koordinatı (−170,080 / 99,160) ve pivot ondan TÜRÜYOR. Aşağıdaki tablonun
> son satırı (Gates pivotu + Gates merkezi → 571,1 N) ve *"kalan %5 kayıştan,
> kanıtı serbest kipte 543,7 N"* çıkarımı **o yapılandırmaya aittir**; serbest
> kip bugün 525,6 N veriyor ve o çıkarım artık tutmuyor (bkz. bir sonraki
> bölüm). Burası, aynı yol yeniden denenirse nelerin ölçülmüş olduğunu bilmek
> için duruyor. Pivotun kayış yoluna bağlı OLMAMASI ve tautoloji dersi ise
> bugün de geçerli.

Kullanıcı kararı: *"Tedarikçiye ne gönderdik kısmını geçelim, sen Gates
raporundaki 'Tensioner Data' kısmını baz alarak hesaplamalarını yap."* Ardından
asıl noktayı koydu: *"Tensioner pivot noktası tedarikçiye girdi olarak
gitmeyecek. İlk önce bu hesabın nasıl yapıldığını verelim."*

`BMC_FEAD_2026`'nın gergisi artık raporun **Tensioner Data** bloğundan
(pivot −250,00 / 110,00 · merkez −161,97 / 91,29). Sayfanın *"öngörülen merkezi
montaj pozisyonu"* tahmininden türetilmiş pivot (−259,94 / 104,15) **terk
edildi** — gerçeğinden 11,5 mm sapıyordu.

**ÖLÇÜLDÜ:**

| | serbest açı | Mean kol | T | Gates 544 N'a |
|---|---|---|---|---|
| türetilmiş pivot (eski) | 24,88° | 28,51° | 650,0 N | **+%19,5** |
| Gates pivotu + sayfa merkezi | — | — | — | **ÇÖZÜLMEZ** (kol boyu −9,35 mm) |
| **Gates pivotu + Gates merkezi** | 16,06° | 29,73° | **571,1 N** | **+%5,0** |

Kalan %5 **gergiden değil kayıştan**: bu örnek kayış künyesini hâlâ sayfadan
alıyor (1715 · tolerans 0 · aşınma 0 · lengthOffset 0). Kanıtı: **serbest
kipte** — kol nominal yay açısına oturduğu, yani sayfanın kayışı denklemden
düştüğü zaman — T **543,7 N** çıkıyor, Gates'in Design Tension'ı **544 N**.

İki örnek artık **aynı gergiyi, farklı kayışı** anlatıyor ve testi bunu
kilitliyor.

###### PİVOT BAĞIMSIZ DEĞİL — ama denetlenebilir de değil

Rapora §8.7'ye *"Gergi pivotu nereden geliyor"* bloğu girdi. Dayandığı iki
gözlem:

1. **Kayış yolu pivota HİÇ bağlı değil.** Geometri yalnız gergi *kasnağının
   merkezine* bakar (teğet çözümü merkez farklarından kurulur). Pivotu
   kaydırmak sarımları, açıklıkları, kayış boyunu değiştirmez.
2. **Pivotun tek etkisi kolun hangi yönde hareket ettiğidir** — yani β, yani
   take-up, yani gerginlik. Pivot ile tasarım gerginliği **aynı denklemin iki
   yüzü**: `pivot → β → dL/dθ → T` (analiz) ↔ `T* → dL/dθ → β → pivot` (tasarım).

Tasarım yönü kapalı formda: `sinβ = (M/T*)/(a·2sin(φ/2))`, `θ_kol = θ_hub + s·β`,
`p = c + a·(cos θ_kol, sin θ_kol)`. **ÖLÇÜLDÜ:** AG00976 için Gates'in bastığı
pivotu **0,01 mm**, β'yı **0,006°** ile geri veriyor.

**TAUTOLOJİ TUZAĞINA İLK SÜRÜMDE DÜŞÜLDÜ.** Blok önce *"türetilen pivot ↔
girilen pivot sapması"*nı bir **DENETİM** diye basıyordu. Sapma iki örnekte de
**0,000 mm** çıktı ve çıkmak **ZORUNDAYDI**: tasarım gerginliği zaten pivottan
türüyor, onu denkleme geri beslemek aynı β'yı ve aynı pivotu verir. Geçen bir
denetim gibi görünüp hiçbir şey ölçmüyordu — uygunluk kriteri #6'da düzeltilen
hatanın birebir aynısı, aynı oturumda ikinci kez.

Doğrusu denklemi **duyarlılık** olarak vermek: hedef gerginlik SEÇİLİR (bağımsız
bir mühendislik kararıdır), pivot ondan çıkar. Tablo o eşlemeyi veriyor ve
**gerçekten ayrışıyor** — AG00976'da %15 düşük gerginlik pivotu **21,7 mm**
kaydırıyor. Belge ayrıca *"Bu bir DENETİM değildir"* diye **yazıyor** ve
vurgulu satırın neden modelin kendi pivotunu vermek zorunda olduğunu açıklıyor.

**Pivotun BAĞIMSIZ doğrulanması ancak ölçülmüş bir pivotla** (tedarikçi raporu,
montaj resmi) mümkün — model kendi kendini doğrulayamaz ve rapor bunu söylüyor.


##### PİVOT BİR GİRDİ DEĞİL — parça künyesinden TÜRER (2026-08-25)

> **BU BÖLÜM AŞILDI (2026-08-28) — yön TERSİNE çevrildi.** Kullanıcı kararı:
> *"Kullanıcı ilk olarak KIRMIZI NOKTA olarak OTOMATİK GERGİ MONTAJ
> KOORDİNATLARInı verecek."* Bugün pivot bir GİRDİ, kasnak merkezi bir ÇIKTI
> ve kol açısı bir ZARFTAN seçiliyor (bkz. *"PİVOT GİRDİ, KOL AÇISI ZARFTAN"*).
> Aşağıdaki türetme `angleMode:'mount'` kipinde **aynen duruyor** — kaydedilmiş
> her proje onu kullanıyor ve tabanı birebir korunuyor. Tautoloji dersi ve
> "kayış yolu pivota bağlı değil" ölçümü bugün de geçerli; **ölçülen bedeli**
> ise yeni bölümde: türetilen pivot Gates'in ölçtüğünden 15,45 mm sapıyor ve
> gerginliği **%7,1** kaydırıyor.

Bir önceki bölüm pivotu Gates raporundan almıştı. Kullanıcı asıl noktayı
sonra koydu ve **haklıydı**:

> *"Otomatik gergi bileşeninde kol ve pivot kısmına kullanıcı girdi
> girmeyecek. Kullanıcının girdiği koordinat gergi KASNAĞININ merkezi;
> pivot noktası sonra hesaplanıyor."*

**KOORDİNAT TABLOSU KASNAK MERKEZİ VERİR, GÖVDE DEĞİL** — ve bunun kanıtı
tablonun kendi **ALT satırı**: alternatör gövdesi kocaman (render'da bordo
silindir) ama tabloya giren Ø57'lik **kasnağın** merkezi. Gergi satırı da
(Ø75 flat) aynı şeydir.

Kapanışı gerginin **parça çizimi** veriyor:

> `E9843 PIN POSITION FOR THE 344° MEAN ANGLE AND 22.5 Nm SPRING TORQUE
> @ 28° FREEARM-MEAN ROTATION`

yani kolun **çalışma (Mean) konumundaki mutlak açısı**, parçanın konum
pimiyle birlikte **okunan** bir değerdir — türetilmiyor. Kol boyu da künyede.
Pivot kolun öbür ucudur:

```
pivot = c − a·(cos θ_kol , sin θ_kol)
```

**ÖLÇÜLDÜ — bağıntı raporun kendi pivotunu geri veriyor:** AG00976'nın altı
kol konumunun **altısında da**, raporun bastığı kasnak merkezi + raporun
bastığı kol açısı, raporun bastığı pivotu **0,11 mm** içinde veriyor.

###### ÜÇ HİPOTEZ ÇÖZDÜRÜLDÜ — koordinat KASNAK, pivot DEĞİL

> **TERMİNOLOJİ AŞILDI (2026-08-29):** bu bölümdeki *"pivot"*, bugün
> **otomatik gergi montaj konumu** olarak adlandırılıyor ve gerginin TEK
> koordinatıdır. Ölçümler geçerli.


| hipotez | sarım | T | Gates 543,9 N'a |
|---|---|---|---|
| koordinat = kasnak · θ=**344°** (parça çizimi) | 33,0° | **532,1 N** | **−%2,2** |
| koordinat = kasnak · θ=348° (Gates'in kol açısı) | 33,0° | 561,1 N | +%3,2 |
| koordinat = **PİVOT** (zarf kipi) | 59,7° | **279,4 N** | **−%48,6** |

> **ÜÇÜNCÜ SATIRIN GEREKÇESİ DEĞİŞTİ (2026-08-28).** Bu satır bir dönem
> *"ÇÖZÜLMÜYOR — kasnak sürücünün içine düşüyor (merkez mesafesi 111,6 mm)"*
> diyordu ve o eleme kol açısını **344°'de sabit** tutuyordu, yani bir MODEL
> sınırıydı, geometrik bir imkânsızlık değil. Zarf kipinde kol açısı serbest ve
> model **çözülüyor**: 360 açının **280'i** geçerli geometri veriyor. Eleme
> artık sayısal ve daha güçlü — üstelik **360°'in tamamı tarandı** ve boyu ile
> gerginliği BİRLİKTE tutan açı yok: boyu en iyi tutan θ=134° gerginliği %28,
> gerginliği en iyi tutan θ=0° boyu %4,6 ıskalıyor; gevşek pencerede (L ±%0,5
> ve T ±%5) kalan **2 açıda** (141–142°) sarım RMS 6,0–6,3° ile çöküyor.
>
> **En doğrudan kanıt ise ayrı:** mount kipinde ÇÖZÜLEN çalışma merkezi
> (−170,240 / 98,610) sayfanın koordinatına yalnız **0,57 mm** uzakta.
> Koordinat pivot olsaydı kasnak merkezi ondan tam kol boyu (90 mm) uzakta
> olurdu — nitekim hipotez satırında öyle çıkıyor.

Üçüncüsü koordinatın pivot **olmadığını** eliyor. Birincisi ise
şunu gösteriyor: pivot **hiç girilmeden**, yalnız müşterinin koordinatı +
parça künyesiyle tedarikçinin cevabına **%2,2** içinde varılıyor.

**KALAN %2,2'NİN KAYNAĞI ÖLÇÜLDÜ — ve KAYIŞ DEĞİL.** Bir önceki bölüm
(Gates pivotu girilirken) kalan %5'i kayışa bağlıyor ve kanıtını *serbest
kipte* buluyordu: kol nominal yay açısına oturunca, yani sayfanın kayışı
denklemden düşünce, T 543,7 N çıkıyordu. **O kanıt artık geçerli değil** —
türetilmiş pivotla serbest kip **525,6 N** veriyor, yani sabit kipten (532,1)
Gates'e **daha uzak**. Kayış denklemden düştüğünde fark kapanmıyorsa fark
kayıştan gelmiyor demektir.

Geriye kalan tek serbest büyüklük **pivot**, ve iki belge onu farklı yere
koyuyor: türetilen (−256,59 / 123,97) ile Gates'in ölçtüğü (−250,00 / 110,00)
arasında **15,445 mm** var (aynı belgede bir dönem 11,5 yazılıydı — o sayı
TERK EDİLMİŞ −259,94/104,15 pivotuna aitti). Duyarlılığı da ölçülü: aynı kasnak merkezinde kol
açısını 344° → 348° almak T'yi **532,1 → 561,1 N** yapıyor, yani **4° ≈ %5,4**.

İlk iki satırın **sarımı aynı** (33,0°): kasnak merkezi ikisinde de aynı,
değişen yalnız β — yani take-up, yani gerginlik.

**MUTLAK AÇI SALT PARÇAYA AİT DEĞİL, MONTAJA DA BAĞLI.** Aynı E9843 Gates
raporunda **347,99°**'de duruyor. Parçanın kendi değişmezi **bağıl** dönme —
*"28° FREEARM-MEAN"* ↔ yay künyesinden türeyen `(22,07 − 8,60)/0,480 =
28,06°` — ve iki örnek de onu doğruluyor (BMC **28,43°**, AG00976
**28,08°**). Bu yüzden iki örnek farklı mutlak açı taşır ve biri
"düzeltilerek" öbürüne eşitlenmemelidir.

###### RAPORUN BELT DATA BLOĞU BMC'YE KONMAZ — ölçüldü, TERSİ çıktı

Açık duran bir soru vardı: *"AG00976 raporunun Belt Data bloğu (1714,6 · ±6 ·
%0,60 · offset 1,6) `BMC_FEAD_2026`'ya da konsun mu?"* Pivot **raporundan
girilirken** cevap evetti — kalan %5'i kapatıyordu. Türetilmiş pivotla
**ÖLÇÜLDÜ ve cevap hayır**:

| BMC | bağıl kol | M | nominalden | T | Gates 543,9 N'a |
|---|---|---|---|---|---|
| sayfa kayışı (bugün) | 28,43° | 22,245 Nm | **%0,79** | **532,1 N** | **−%2,2** |
| + Gates Belt Data | 26,80° | 21,463 Nm | %2,75 | 503,7 N | **−%7,4** |

Sapma **üç katına** çıkıyor. Sebep basit: gergi koordinatı sayfadan, kayış
künyesi rapordan gelirse model **iki farklı sistemi** anlatır. İki künye tek
kaynaktan gelmeli — `AG00976_GATES_2025` ikisini de rapordan alıyor ve aynı
büyüklük orada **%0,09**.

Kapı bu kararı kilitliyor (`fead-example.test.js`, *"Gates Belt Data BMC'ye
KONMAZ"*): istenmeyen alternatif de koşturuluyor, çünkü karıştırma **sessiz** —
model yine çözülür, uyarı çıkmaz, yalnız sonuç uzaklaşır. İki mutasyonla
ölçüldü (BMC kayışını Gates'inkiyle değiştirme → 4 test kırmızı; kol açısını
344 → 348 → 5 test kırmızı).

###### İKİ DURUM, İKİ ANLAM — ve karıştırmak TOTOLOJİ üretir

| | pivot TÜRETİLDİ (`BMC_FEAD_2026`) | pivot GİRİLDİ (`AG00976_GATES_2025`) |
|---|---|---|
| Kaynak | kasnak merkezi + parça künyesi | tedarikçi raporunda **ölçülü** |
| Kol boyu çapraz kontrolü | **TOTOLOJİK** — pivot zaten kol boyu kadar uzağa konuyor | **GERÇEK DENETİM** — iki bağımsız sayı |
| Rapor ne der | *"Bu bir denetim değildir"* | *"kol boyu tutmak zorundadır"* |

`veFeadArmCheck` bunu `tautological` bayrağıyla taşıyor. Bayrak olmasaydı
yapısal olarak sıfır çıkan bir fark "geçen kriter" diye basılırdı — bu
oturumda **üçüncü kez** aynı tuzak (uygunluk #6, ilk pivot bloğu).

###### SÜRÜKLEME PİVOTU DONDURMAMALI — kapı boşluğuydu

`veFeadDragTensioner` merkezi ve pivotu birlikte taşıyordu. Türetilmiş
pivotta `pivotX/pivotY` yazmak onu sessizce **girilmiş** pivota çevirir:
ilk sürükleme parça künyesini dondurur, kullanıcı kol açısını bir daha
değiştiremez. Artık türetilmiş pivotta yalnız merkez taşınıyor; pivot
kendiliğinden takip ediyor. Mutasyonla ölçüldü — kapı **yoktu**, eklendi.

###### Panel ve rapor

Panelde **"Kol Künyesi"** kartı kol boyu + kol açısını soruyor ve türetilen
pivotu **yazıyor**; pivot alanları *"Ölçülmüş Pivot — opsiyonel"* başlığı
altında ikincil kaldı. Rapor §8.7'nin pivot bloğu artık gerçek kuruluşu
anlatıyor ve iki durumu ayırıyor.

**Kayış yolunun pivota bağlı olmaması** zincirin ayrılabilmesinin sebebi ve
raporda yazılı: geometri yalnız kasnak merkezine bakar; pivot yalnız β'yı,
yani take-up'ı, yani gerginliği belirler. Testi bunu ÖLÇÜYOR — pivot kolun
etrafında döndürülünce sarım `<0,001°` değişiyor ama β `>1°` ve gerginlik
`>%1` değişiyor.

**Kapı altı mutasyonla ölçüldü, altısı da kırmızı:** türetmeyi kaldırma
(103 test), türetmede işareti çevirme (14), örnekte kol açısı 344 → 348 (8),
totoloji bayrağını sabitleme (1), sürüklemede pivotu yine yazma (1), raporun
totoloji uyarısını basmaması (1).

##### AVARA MERKEZİ GİRDİ, MONTAJ KONUMU ÇIKTI — yön yeniden çevrildi (2026-09-01)

Kullanıcı kararı: *"biz otomatik gergi için normalde 'otomatik gerginin montaj
noktasını' veriyorduk. Bu daha mantıklı oluyordu fakat şimdi 'otomatik gergi
avarasının orta noktasını' vereceğiz. Matematiği buna göre kurgulayalım,
değişiklikleri yapalım, 'başlangıç sihirbazı' kısmında değişiklikleri yapalım,
rapor kısmında değişiklikleri yapalım."*

Bir önceki karar (2026-08-29, *"TEK KOORDİNAT"*) yürürlükte kalıyor — tek
girdi, doğrulama yok — değişen yalnız o tek koordinatın HANGİSİ olduğu.

| | eski (2026-08-28…09-01) | **bugün** |
|---|---|---|
| Kullanıcı verir | gövdenin **montaj konumu** (pivot) | **avara kasnağının merkezi** (`cenX/cenY`) |
| Program türer | kasnak merkezi | **gövdenin montaj konumu** `p = c − a·(cos θ, sin θ)` |
| Kol çalışma açısı | montaj zarfından **SEÇİLİR** | bir **GİRDİ** (`armMeanDeg`) |
| Kayış boyu | ÇIKTI | ÇIKTI (değişmedi) |

**GEREKÇE KULLANICININ İŞ AKIŞI:** tedarikçiye GİDEN FEAD bilgi sayfası bütün
kasnaklar için AYNI sütunda merkez koordinatı veriyor — gergi satırı dahil.
Montaj konumu yalnız tedarikçiden DÖNEN raporda (*Tensioner Data → Pivot
Point*) bulunuyor. Yani bugünkü girdi, tasarımcının elinde gerçekten olan
sayı.

###### ÇEVİRME CEBİRSEL OLARAK TAM — ÖLÇÜLDÜ

`p = c − a·(cos θ, sin θ)` ile `c = p + a·(cos θ, sin θ)` aynı denklemin iki
yüzü. 14 Gates sisteminde merkez + kol açısından montaj konumu geri üretilip
sistem yeniden kuruldu:

| | en büyük |
|---|---|
| \|Δp\| | **4,263e−14 mm** |
| ΔL_eff | 1,137e−13 mm |
| ΔT | 1,494e−13 % |
| Δsarım | 5,684e−14° |

Yani yön değişikliği bir yaklaşıklık değil; doğrulama kümesi hiç kaymıyor.

###### KAYIŞ YOLU KOL AÇISINDAN TAM BAĞIMSIZ OLDU — ve bu ölçütü ÖLDÜRDÜ

Merkez sabitken çalışma (Mean) konumundaki kayış yolunun tamamı — kasnak
başına sarım, altı açıklık, L_eff, Σsarım — kol açısından bağımsız.
**ÖLÇÜLDÜ (6 Gates sistemi × 548 kol açısı):** en büyük fark **4,55e−13 mm** /
**1,71e−13°**, yani makine hassasiyeti (1716 mm'de çift duyarlıklı ULP ≈
2,3e−13 mm). Aynı ızgarada MONTAJ KONUMU girdiyken L_eff **122–294 mm**
oynuyordu — **15 büyüklük mertebesi**.

Bunun bedeli montaj zarfı oldu. Ölçüt (`max_θ min_rel dL/dθ`) pivot girdiyken
çalışıyordu çünkü θ'yı değiştirmek YERLEŞİMİ değiştiriyordu. Merkez sabitken
değiştirmiyor; geriye ölçütün tutunacağı yalnız sinβ ve servis bandının
ucundaki sarım kaybı kalıyor.

**ÖLÇÜLDÜ (aynı 14 sistem, aynı harness):**

| | pivot girdi | **merkez girdi** |
|---|---:|---:|
| medyan \|Δθ\| | 4,0° | **20,7°** |
| ±5° içinde | 8/14 | **2/14** |
| ±10° içinde | — | **2/14** ← ara bant YOK |
| ölçüt eğrisinin %1 platosu | 2,1° | **24,1°** (11,5 kat) |
| >90° sapan sistem | 1 | **4** |

**GEREKÇE "β 90°'ye ÇAKILIYOR" DEĞİL** ve bu ayrım ölçüldü: seçilen β'nın
medyanı **63,2°** (tam dejenerasyon kontrol koşusu 90,0° veriyor). Ölçüt
yanlış bir yeri seçmiyor — **hiçbir yeri seçemiyor**, çünkü eğri düz. Sekiz
aday ölçüt tarandı (tepe gerginlik, T_max/T_min, hubload tepesi, ortalama T,
en küçük sarım …); en iyisi yine 2/14.

Bu bir ÖLÇÜT sorunu değil **SERBESTLİK DERECESİ** sorunu: merkez verildikten
sonra pivotun nereye düştüğü bir PAKETLEME kararıdır (gövde motor bloğunda
nereye cıvatalanıyor) ve kayış fiziğinden çıkarılamaz.

**KOL ÇALIŞMA AÇISI ARTIK BİR GİRDİ** — kol boyu, yay ön yükü ve yay
katsayısıyla aynı sınıftan, gerginin parça/montaj çiziminden okunuyor
(E9843: *"344° MEAN ANGLE"*). Girilmezse model **çözülmez** ve sebebini adıyla
yazar; β = 90° gibi "makul ama yanlış" bir varsayılan gerginliği ölçülebilir
biçimde kaydırıp SESSİZ kalırdı.

**MUTLAK AÇI KÜNYE KÜTÜPHANESİNE YAZILMAZ:** aynı E9843 bir araçta 344°,
başka birinde 348°. Parçanın kendi değişmezi BAĞIL dönme (28,06° ↔ yay
künyesinden `(22,07−8,60)/0,480`).

###### İKİ ÖRNEĞİN TABANI — belgelerin kendi satırlarına oturdu

Örnekler artık ikinci el sayı taşımıyor:

| | girdi (merkez) | türeyen montaj konumu | belgenin yazdığı |
|---|---|---|---|
| `BMC_FEAD_2026` | −170,080 / 99,160 (bilgi sayfası) | −256,594 / 123,967 | — (sayfa taşımıyor) |
| `AG00976_GATES_2025` | −161,97 / 91,29 (Layout Data) | **−250,0035 / 110,0008** | **−250,00 / 110,00** (Tensioner Data) |

İkincisi **bağımsız bir ölçü**: raporun *Tensioner Data* satırı modele HİÇ
girmiyor ve türev ona **0,0035 mm** uzakta. Program bu karşılaştırmayı
YAPMIYOR — sayı basılıyor ki okuyucu denetimi kendisi yapabilsin.

Taban kayması ihmal edilebilir (örnekler artık sayfanın kendi koordinatını
taşıdığı için 0,004 mm'lik bir yuvarlama farkı):

| | önce | sonra |
|---|---:|---:|
| BMC · L | 1715,2692 | **1715,2666** |
| BMC · T | 525,511 | **525,554** (+%0,008) |
| AG00976 · L | 1714,6088 | **1714,6075** |
| AG00976 · T | 543,853 | **543,875** (+%0,004) |

###### KARIŞTIRMANIN BEDELİ BÜYÜDÜ VE SESSİZLEŞTİ — ölçüldü

Montaj konumunu merkez alanına yazmak:

| | eski yön | **bugün** |
|---|---|---|
| model çözülüyor mu | 5/14 (9'unda duruyordu) | **14/14** |
| gerginlik sapması | −%48,6 | **medyan +%1526**, en kötü +%4518 |
| hiçbir uyarı çıkmayan | — | **5/14** |

Sayı artık çok daha gürültülü ama **uyarı daha sessiz**. Bu yüzden türeyen
montaj konumu bir OKUMA olarak dört yüzeyde birden basılıyor ve bu bir süs
değil, tek teşhis yüzeyi:

| Yüzey | Nerede |
|-------|--------|
| Panel · Kol Künyesi kartı | `veFeadMountReadout` — **SAF**, çözüme hiç bakmaz |
| Panel · Avara Hareketi kartı | `veFeadArmReadout` — yalnız model çözülünce |
| Sihirbaz · 4. adım | `Gövdenin Montaj Konumu` kartı |
| Rapor · §8.7 · özet s1 | `_frPivotBlock` · `_fsrSheet1` |

Birinci ile ikincisi AYNI ŞEY DEĞİL ve mutasyon bunu ölçtü: Kol Künyesi'ndeki
okuma yalnız üç alandan hesaplanıyor, dolayısıyla **kayış yolu çözülemese de**
duruyor — ki ters koordinat girişinin en olası sonucu tam olarak odur.

###### AÇIYI SEÇMİYORUZ AMA YALNIZ DA BIRAKMIYORUZ — BANT + T(θ)

Kullanıcı sordu: *"Açıyı bilmiyoruz ama otomatik gerginin geometrisinden bir
açı tayin edemiyor muyuz? … Sanırım programın açıyı seçmesinin sebebi Gates
raporları değil mi? Bunu raporlardan bağımsız bir metod haline getirmemiz
gerekiyor."* Haklıydı ve cevabı **hayır** — ama gerekçesi ölçülerek bulundu.

**GEOMETRİ θ'YI VEREMEZ, CEBİRSEL OLARAK.** Merkez sabitken bileşke kuvvet
**f** de sabit, dolayısıyla

    T(θ) = M_mean / (a · 2sin(φ/2) · |sin(θ − θ_f)|)

Bunu en küçük yapmak **β = 90°** verir — ders kitabı kuralı — ve Gates bunu
HİÇ yapmıyor (42,5…60,1°). Parça da montaj ekseni etrafında serbest: aynı
E9843 bir motorda 344°, başkasında 348°. **θ bir BLOK özelliği, gergi özelliği
değil.**

**DEĞİŞMEZ ARANDI, BULUNAMADI.** 14 sistemde Gates'in noktasında sabit olan
büyüklük yok: gerginlik CV %33 · gerginlik/kanal %25 · take-up %26 · sarım %41
· hub/T %38. En sıkısı **β: CV %9,6** (42,5…60,1°) ve o bile ±%10'luk bir
bant — kural değil, alışkanlık. Kayma emniyeti de sürücü DEĞİL: gerginlik duty
yüküyle gitmiyor (AG00686 8,2 kW → 944 N; AG00879 14,8 kW → 478 N).

**RAPORDAN BAĞIMSIZ OLAN ŞEY BİR BANT, BİR SAYI DEĞİL.** `veFeadArmBand` tek
soru soruyor — *kol, kayışın servis aralığının iki ucuna da ulaşabiliyor mu* —
ve girdilerin tamamı kullanıcının kendi verisi. **ÖLÇÜLDÜ (bu kodun kendisiyle,
14 sistem):**

| | |
|---|---|
| Gates'in noktası bandın içinde | **14/14** ← yanlış red YOK |
| bandın genişliği | **96…218°**, medyan 189° |
| bandın ortasını seçseydik | medyan hata **96°** |

Yani ölçüt **doğru ama daraltmıyor**. Eski montaj zarfının 4,0°'lik isabetinin
~%98'i Gates kalibrasyonundan geliyordu, ~%2'si fizikten.

**LOAD STOP VE SARIM İÇİN AYRI KAPI YOK** ve bu bilinçli: çekirdeğin erişim
sınırı (`feasibleRelMax`) ikisini de zaten kapsıyor. Bir dönem burada iki `if`
daha vardı; **mutasyon ikisini de sessizce geçirdi** (kaldırılınca hiçbir test
kırılmadı) ve sebebi buydu — ölü daldılar. Ölçüldü: load stop 60,4° → 32°
yapılınca olanaklı örnek 107 → 0 ve reddi **çekirdek** veriyor.

**T(θ) EĞRİSİ SÜS DEĞİL:** ölçülen sistemlerde ±20°'lik bir bantta %47…101
oynuyor. Kullanıcı montaj saatinin bedelini okuyabiliyor.

**TEK ÜRETİCİ, İKİ ÇAĞRI YERİ:** `veFeadBandSVG` (cp-fead.js) hem paneli hem
raporu çiziyor (`opt.print` paleti değiştiriyor) — `veFeadLayoutSVG`'de kurulan
kalıbın aynısı. Bant hesabı `veFeadArmBand`'de tek yerde.

**SICAK YOLDA ÇAĞRILMAZ:** tarama 90 örnek × (makeSystem + positionTable) ≈
350 ms; kanvas kare bütçesi 2,2 ms. Panel ve rapor çağırıyor,
`veFeadLayoutCardHTML` çağırmıyor. **Tek girişlik memo** ikinci çağrıyı 4 ms'ye
indiriyor ve anahtarında `armAbsDeg` YOK — bant açıdan bağımsız, kullanıcının
noktası memodan sonra ayrıca örnekleniyor.

> **ARAÇ UYARISI.** Mutasyon betiği zaman aşımıyla öldürülünce `.bak` geri
> yüklenmedi ve mutasyon (memo anahtarından `build.center` düşmesi) KAYNAKTA
> KALDI. Betik artık bir `.bak` varsa hiç başlamıyor; bir tur sonra `ls
> js/*.bak` bakmak da alışkanlık olmalı.

###### KALKAN YÜZEYLER

| Kalkan | Yerine |
|--------|--------|
| `veFeadArmEnvelope` · `veFeadEnvelopeOf` · `_feadEnvSample` · `VE_FEAD_ENV_*` | — (kol açısı bir girdi) |
| `veFeadEnvelopeReadout` · `veFeadSetPinArm` · `veFeadReselectArm` | `veFeadArmReadout` + `veFeadMountReadout` |
| `_frEnvelopeBlock` · `_frEnvelopeFigure` · `_frEnvCen` · `_frEnvMult` · `VE_FR_ENV_CRITERIA` | — (rapordan Tablo 9 ve zarf haritası kalktı) |
| `armPinned` · `armAuto` · `opt.selectArm` | — (seçilecek bir şey yok) |
| teori §4.5'in montaj zarfı ve (4.7) `argmax` ölçütü | (4.7) artık `p = c − a·u(θ)` |
| `tests/unit/fead-arm-envelope.test.js` | `tests/unit/fead-arm-input.test.js` + `tests/unit/fead-arm-band.test.js` |

**GÖÇ TERSİNE ÇEVRİLDİ ve üç yazımı birden indiriyor:** ① `cenX/cenY`
(+ `angleMode:'mount'`, 2026-08-29 öncesi) → bugünkü biçimin kendisi,
alan olduğu gibi kalıyor; ② `pivotX/pivotY` + `armMeanDeg` (zarf kipi) →
merkez TÜRETİLİYOR; ③ yalnız `freeAngleDeg` → çevrilecek koordinat yok, model
sebebini yazıyor. **İkisi birden varsa MERKEZ kazanır** (girdi odur).
`armPinned`/`armAuto` da siliniyor: kol açısı artık her zaman bir girdi.

**ORİJİN GÖÇÜ ESKİ `pivotX/pivotY`Yİ DE ÖTELEMEYE DEVAM EDİYOR** ve bu ölü kod
DEĞİL: `veFeadNormalizeOrigin` alt topoloji açılışında `veFeadMigrateTensioner`
DEN ÖNCE koşabiliyor. Ötelenmemiş bir montaj konumundan türetilen merkez
krankın ofseti kadar yanlış yere düşerdi — sessiz, çünkü model yine çözülür.

**Kapı 24 mutasyonla ölçüldü, 24'ü de kırmızı.** Üçü ilk turda YEŞİL kaldı ve
üçü de aynı dersi tekrarladı — *kapı ÜRETİLEN YÜZEYE bakmalı, üreticiye
değil*: panelin montaj okumasını Kol Künyesi kartından düşürme (`veFeadArmReadout`
aynı metni bastığı için görünmüyordu), `_frPivotBlock`'u §8'den düşürme (kapı
bloğu doğrudan çağırıyordu), özet raporun merkez satırına pivotu yazma (özet
raporun gergi künyesinin hiç kapısı yoktu).

> **AYNI TURDA ÇIKAN İKİ YAN İŞ.** (a) `\;` LaTeX kaçışı yeni pivot
> denkleminde bir kez daha yutuldu (JS dizgisinde tek ters bölü) — kapı
> (`fead-pin.test.js`) artık §8.7'nin İKİ alt bloğunu birden tarıyor, çünkü
> yalnız pim bloğuna bakan hâli bunu SESSİZCE geçiriyordu. (b) `tests/e2e/
> fead-canvas-drag.spec.js`'in kayış rozeti testi **taban commit'te de
> kırmızıydı**: kilit PR #831'de gelmişti ama test hâlâ `SABİT → SERBEST`
> geçişini bekliyordu. Bugün kilidin kendisini tutuyor.

##### TEK KOORDİNAT — "PİVOT" TERMİNOLOJİSİ VE KARŞILIKLI DOĞRULAMA KALKTI (2026-08-29)

> **KISMEN AŞILDI (2026-09-01).** *"Tek girdi, doğrulama yok"* kuralı
> yürürlükte; değişen o tek girdinin HANGİSİ olduğu — bugün **avara merkezi**,
> montaj konumu değil (bkz. bir üstteki bölüm). Aşağıdaki `p`↔`c` yönü,
> `armPinned` göçü ve zarf gerekçeleri o tarihin hâlini anlatıyor.

Kullanıcı kararı: *"Programda hâlâ garip bir ikilik var… Sanırım programda
hâlâ karşılıklı doğrulama gibi bir kıstas var. ASLA OLMAYACAK. Herhangi bir
doğrulama gibi bir olay söz konusu değil. Önceki 'pivot nokta' değeri girdi
olmayacak asla. O terminoloji kalkacak. Artık sadece 'otomatik gergi montaj
konumu' var. Buradan otomatik gerginin avara kısmının hareketi tanımlanacak
sadece."*

**İKİLİK GERÇEKTİ ve üç yüzeydeydi:**

| Nerede | Ne vardı |
|--------|----------|
| Panel | `angleMode` seçicisi (zarf / montaj merkezi / serbest açı) + ikincil *"Ölçülmüş Pivot"* alanları + *"Doğrulama"* kartı (`verifyCenX/Y`) |
| Sihirbaz | *"Gergiyi nasıl tanımlayacaksınız?"* adımı — aynı üç kip |
| Köprü | `veFeadArmCheck` (üç bantlı `\|merkez − pivot\|` ↔ kol boyu hükmü) + zarf kipinde iki koordinat varsa uyarı basan blok |

**HEPSİ KALKTI.** Bugün gergi için girilen tek şey **Otomatik Gergi Montaj
Konumu**; avara kasnağının merkezi ondan ve kol açısından TÜRER
(`c = p + a·(cos θ, sin θ)`), ve program hiçbir şeyi hiçbir şeyle
karşılaştırmıyor.

| Kalkan | Yerine |
|--------|--------|
| `veFeadAngleMode` · `veFeadArmCheck` · `veFeadTensionerMount` · `veFeadFreeAngleFrom` · `veFeadPivotFromArm` | `veFeadSpringSetup` (salt yay künyesi) + `veFeadMigrateTensioner` (tek seferlik göç) |
| `veFeadVerifyCard` · `veFeadSetVerifyCen` · `veFeadMountReadout` | — |
| `cenX/cenY` · `angleMode` · `freeAngleDeg` · `verifyCenX/Y` | `pivotX/pivotY` (montaj konumu) |

**`veFeadTensionerMount` İKİ İŞ YAPIYORDU** ve ayrılması şarttı: yay
kurulmasını (`rel_mean = (M_mean − M₀)/k`, geometriye HİÇ bakmaz) hesaplamak
VE iki koordinat arasındaki geometriyi çözmek. Birincisi zarf ölçütünün
girdisi olduğu için kalmak zorundaydı; ikincisi kalktı.

###### GÖÇ TEK NOKTADAN, VE KOLU SABİTLİYOR

`veFeadMigrateTensioner` eski kaydı bir KEZ çeviriyor: montaj konumu yazılıysa
o kazanır, yoksa kasnak merkezi + kol boyu + kol açısından çıkarılır. Sonra
eski alanlar **silinir**.

**KOL SABİTLENİYOR** (`armPinned`) ve bu göçün asıl işi: eski kayıt kolun
nerede durduğunu BİLİYORDU (montaj merkezi onu söylüyordu). Sabitlenmezse zarf
kendi açısını seçer ve kullanıcının kaydettiği model sessizce başka bir yere
oturur.

**GÖÇ KÖPRÜDE KOŞUYOR**, yalnız panelde değil: kart · rapor · sürükleme hepsi
`veFeadBuildSystem`'den geçiyor. Panele bağlansaydı, paneli hiç açmadan
çözülen bir modelde eski alanlar canlı kalırdı.

**İKİNCİ KOORDİNAT TÜRETİLEMESE BİLE SİLİNİR.** Bu, *"kasnak merkezi montaj
konumu yerine geçemez"* kapısının dayandığı özellik: bırakılsaydı köprüde ona
düşen bir yedek yol doğabilirdi ve o yolun bedeli ÖLÇÜLÜ — gerginlik
**−%48,6**, sarım en kötü **+27,9°**.

###### ÖLÇÜLEN BEDEL — iki örneğin tabanı kaydı

Eski `mount` kipi kayış boyunu GİRDİ alıp kolu ona oturtuyordu; bugün kayış
boyu bir ÇIKTI ve kol nominal yay açısında duruyor.

| | eski (mount) | yeni (tek koordinat) | fark |
|---|---:|---:|---|
| AG00976 · kol | −11,9992° | −11,9992° (sabitlendi) | — |
| AG00976 · L | 1714,6000 (girdi) | **1714,6088** (çıktı) | +0,009 mm |
| AG00976 · T | 544,0497 | **543,8534** | **−%0,036** |
| BMC · rel | 28,4271° | **28,0625°** (nominal) | −0,36° |
| BMC · L | 1715,0000 (girdi) | **1715,2692** (çıktı) | +0,27 mm |
| BMC · T | 532,142 | **525,511** | **−%1,24** |

AG00976 neredeyse hiç kaymıyor çünkü kayışının gerçek efektif boyunu (1714,6)
taşıyor. BMC'nin **%1,24**'ü ise kayıştan: *"1715"* YUVARLANMIŞ bir katalog
adı ve girdi olarak kolu nominalin 0,36° ötesine itiyordu. Bu fark zaten
belgeliydi (*"İki kip yakınsıyor ama ÖZDEŞ DEĞİL"*); tek kip kalınca
nominal olan kazandı.

###### İKİ TEHLİKE SINIFI YAPISAL OLARAK YOK OLDU

| Eski sınıf | Neden artık yok |
|---|---|
| *"Gates Belt Data BMC'ye KONMAZ"* — iki belgenin kayış verisini karıştırmak gerginliği %2,2'den %7,4'e taşıyordu | Kayış künyesi çözüme HİÇ girmiyor; karıştırmak sonucu **birebir** değiştirmiyor (testli) |
| *"Erişilemeyen kayış boyu"* — kolun ulaşamadığı hedef, kenetlenme, önerilen boy | Boy bir girdi değil; ne yazılırsa yazılsın çalışma noktası aynı (testli, 4 farklı boy) |

**KAYIŞ VERİSİ VARSAYILANI `none`.** Katalog sabitlerine bağlı çıktılar (B10 ·
kaburga yorulması · açıklık frekansları) artık varsayılan olarak KAPALI, çünkü
kayış boyu bir sonuç ve kayış henüz seçilmemiş. Kullanıcı seçtikten sonra
panelden açıyor; testler de açıkça açıyor.

###### AYNI TURDA ÇIKAN DAVRANIŞ İYİLEŞMELERİ

| Ne | Eskiden | Bugün |
|----|---------|-------|
| Yay künyesi eksik | Kol gezinme aralığının ORTASINA düşüyor, panel yine *"tedarikçiye verilecek boy budur"* diyordu | Model çözülmüyor ve *"Spring Mean Load girilmedi"* diyor — nominal açı salt künyeden geldiği için seçilecek nokta YOK |
| Ölü yay | `build.ok` TRUE kalıyor, gerilme istenince çekirdek patlıyordu | Adı konmuş durdurma |

Kapı **on bir mutasyonla** ölçüldü, on biri de kırmızı: kip seçicisini panele
geri koyma, ikinci koordinat alanını geri koyma, göçün merkezi silmemesi, göçün
kolu sabitlememesi, göçün köprüde hiç koşmaması, montaj konumundan pivot
türetme, kayış boyu kilidini kaldırma, raporda *"gerçek denetim"* dalını geri
getirme, sihirbaza kip sorusunu geri koyma, pim planını kurmama, ikinci
koordinatı türetilemediğinde bırakma.

> Bir mutasyon (*"montaj konumundan pivot türetme"*) **semantik olarak
> eşdeğer**: göç `cenX/cenY`yi her durumda sildiği için köprüde o alanlara
> düşecek bir yol kalmıyor. Onun dayandığı özellik ayrı bir kapıyla tutuluyor.

##### PİVOT GİRDİ, KOL AÇISI ZARFTAN SEÇİLİR — yön tersine çevrildi (2026-08-28)

> **BU BÖLÜM AŞILDI (2026-08-29).** Anlatılan üç kipli yapı ve `veFeadArmCheck`
> çapraz kontrolü kodda YOK — bkz. bir üstteki *"TEK KOORDİNAT"* bölümü. Zarf
> ölçütü, kalibrasyonu ve *"paketleme modelde yok"* sınırı bugün de geçerli;
> değişen şey, zarfın artık TEK kip olması ve karşılaştırılacak ikinci bir
> koordinatın kalmaması.

Kullanıcı isteği: *"Kullanıcı ilk olarak KIRMIZI NOKTA olarak OTOMATİK GERGİ
MONTAJ KOORDİNATLARInı verecek. Daha sonra program OTOMATİK GERGİ ÖZELLİKLERİ
baz alınarak bir PİVOT NOKTASI ZARFI oluşturacak … bu sonsuz noktalar içinden
en uygun noktayı seçecek. Bunu Gates'in nasıl yaptığını daha bilmiyoruz.
Amacımız bunu bulmak zaten."* Ve: *"kayış boyu KESİNLİKLE BİR SONUÇ OLACAK."*

**İkisi TEK değişiklik.** Gergi kasnağının merkezi girdi olmaktan çıkınca kol
açısını pinleyen şey de kalkıyor; geriye kalan tek serbestlik derecesi zarftan
seçiliyor ve kayış boyu **yapısal olarak** o seçimin sonucu oluyor.

| | eski (`mount`) | yeni (`envelope`) |
|---|---|---|
| Kullanıcı verir | gergi **KASNAĞININ** merkezi (YEŞİL) | gergi **GÖVDESİNİN** montaj noktası = pivot (KIRMIZI) |
| Program türetir | pivot | kasnak merkezi **ve kayış boyu** |
| Kayış boyu | GİRDİ (`fixed`) ya da seçilebilir | **her zaman ÇIKTI** — kip kilitli |

###### YÖN DEĞİŞİKLİĞİ BİR KOLAYLIK DEĞİL, ÖLÇÜLMÜŞ BİR HATANIN DÜZELTMESİ

Montajda SABİT olan pivottur; kasnak merkezi kolun o anki açısıyla değişen bir
konumdur. Eskiden **değişken olanı sorup sabit olanı türetiyorduk**.

**ÖLÇÜLDÜ** (AG00976 · Gates 8PK1715HD raporu, aynı araç):

| | pivot | Gates'e sapma | gerginlik |
|---|---|---|---|
| Gates'in ölçtüğü | (−250,00 · 110,00) | — | 544,3 N |
| BMC örneğinin merkezden **türettiği** | (−256,59 · 123,97) | **15,45 mm** | **505,8 N (−%7,1)** |

Ve bunu **hiçbir şey yakalamıyordu**: `veFeadArmCheck` pivot türetilmişken
TOTOLOJİK (fark yapısal olarak sıfır) — kodun kendi notu bunu yazıyor.

###### SEÇİM ÖLÇÜTÜ TAHMİN EDİLMEDİ, 14 GATES SİSTEMİNDEN GERİYE ÇÖZÜLDÜ

Altı aday ölçüt, her sistemde zarf 0,25° adımla taranarak Gates'in gerçek
çalışma açısıyla karşılaştırıldı (**aci farkinin medyani**):

| ölçüt | medyan | ±5° içinde |
|---|---:|---:|
| **min take-up EN BÜYÜK** | **4,5°** | **9 / 14** |
| ortalama konumdaki T en küçük | 10,3° | 2 / 14 |
| T tepe değeri en küçük | 20,3° | 0 / 14 |
| T_max / T_min en küçük | 23,5° | 1 / 14 |
| hubload tepesi en küçük | 30,8° | 0 / 14 |
| en küçük sarım en büyük | 53,1° | 0 / 14 |

```
ÖLÇÜT:  max over θ  of  min over rel ∈ [0, 1,5·rel_nom]  of  dL/dθ(θ, rel)
```

**FİZİKSEL ANLAMI:** `T = M/(dL/dθ)` olduğu için take-up'ın en KÜÇÜK olduğu yer
gerginliğin en BÜYÜK olduğu yerdir. Ölçüt, kayışın servis zarfı boyunca (yeni/
uzun kayıştan yıpranmış/kısa kayışa) görülen **tepe gerginliği en küçük** yapan
montaj saatini seçiyor — klasik gergi yerleşim kuralı.

**β = 90° DEĞİL** (klasik ders kitabı kuralı) ve bu ölçüldü: Gates'in çalışma
noktalarında β **42,7…59,5°**. sin β büyürken sarım çöküyor, çarpım orta bir
açıda tepe yapıyor.

**TEPE DÜZ DEĞİL — isabet gerçek.** %1 platosu ortalama **4,9°** (çoğu sistemde
1,0–2,8°), yani "±5° içinde" ucuz bir isabet olmuyor. Gates'in noktasındaki
ölçüt cezası medyan **%4,0**, iki sistemde tam **%0,0**.

**1,5 ÇARPANI UYDURULMADI:** 1,0…2,0 tarandı, **1,2–1,6 bir PLATO** (medyan
3,5–4,5°, 8–9/14 sistem ±5°); 1,0'da 6,5°, 2,0'de 11,5°'e bozuluyor. 1,5
platonun ortasında ve fiziksel karşılığı var: çalışma açısı + %50 pay.

###### BAĞIMSIZ DOĞRULAMA — KAYIŞ BOYU KAYIŞA HİÇ BAKMADAN GERİ ÜRETİLİYOR

Ölçüt kayış verisine girmiyor (gezinme aralığı yay künyesinden:
`rel_nom = (M_mean − M₀)/k`). Ölçüldü: kayıştan türeyen aralık (Replace…MinBelt)
ile künyeden türeyen `[0, 1,5·nom]` **aynı** sonucu veriyor (medyan 4,5° ↔ 4,5°).
Bu, kayış boyunun çıktı olabilmesinin ön koşulu — yoksa döngü kurulurdu.

Sonuç: program kayışı **hiç görmeden** Gates'in kayışını geri veriyor.

| | sapma |
|---|---|
| 11 / 14 sistem | **±%0,35 içinde** |
| medyan | **%0,21** |
| en kötü (AG0868-4PK) | %1,98 |

**UÇTAN UCA** (gerçek örnek düğümleri → köprü → çekirdek, AG00976): seçilen kol
açısı −10,90°, **kayış boyu 1715,39 mm** (Gates REBL 1714,6 → **+%0,05**),
gerginlik 540,1 N (Gates 544 → −%0,7), sarımlar `156,6 · 52,8 · 198,4 · 64,3 ·
157,6 · 35,4` (Gates `156,2 · 52,8 · 198,4 · 64,3 · 157,1 · 34,6`, en kötü 0,8°).

###### SINIR: PAKETLEME MODELDE YOK — ve sonuç bunu SÖYLÜYOR

Zarfın hangi yayının motor bloğunda kullanılabilir olduğunu model bilmiyor.
14 sistemin 13'ünde en iyi nokta Gates'inkine komşu; **AG00879'da 153° uzakta**
ve orası motorun öteki yanı. Bu yüzden sonuç bir **ÖNERİ**: kullanıcı açıyı
sabitleyebiliyor (`armPinned`) ve zarf o zaman bir seçici değil bir **TEŞHİS**
yüzeyi oluyor. Sınır panelde ve raporda **yazılı** — modülün kendi kuralı
(B10 çap penceresi, tepe yükün *"KALİBRE DEĞİL"* damgası ile aynı gerekçe).

###### KİP ÜÇLÜ, VARSAYILAN GERİYE DÖNÜK

`veFeadAngleMode`: açık seçim kazanır; yoksa `cenX/cenY` → `mount`,
`freeAngleDeg` → `direct`, `pivotX/pivotY` → **`envelope`**, hiçbiri yoksa
**`envelope`** (yeni akış). **Geriye dönük etkisi YOK ve ölçüldü:** kaydedilmiş
her projede bu üç alandan en az biri yazılı, dolayısıyla değişen tek şey
paletten YENİ konan bir gerginin hangi soruyla açıldığı. Taban birebir
korunuyor — AG00976 `kol 28,0750° · L 1714,60 · T 544,05`, BMC
`kol 28,4271° · L 1715,00 · T 532,14`.

**ZARF KİPİNDE PİVOT TÜRETİLMEZ.** Montaj merkezi + kol açısı girilse bile
köprü onları kullanmıyor ve sebebini adıyla yazıyor. Türetmeye izin verilseydi
kullanıcı montaj merkezini girip pivotu "girdi" sanabilirdi — düzeltilen sessiz
hata sınıfının ta kendisi, üstelik ölçülmüş bedeliyle.

**KAYIŞ KİPİ KİLİTLİ ve kilit ÜÇ YÜZEYDE birden.** Zarf kipinde kayış boyu
yapısal olarak bir çıktı; panel seçici yerine *"SERBEST (kilitli)"* yazıyor,
kanvas rozeti tıklamayı reddediyor, `veFeadToggleBeltMode` de. Tek yerde
tutulsaydı panel bir kipi, rozet başkasını gösterirdi — bu modülün tekrar eden
kuralı (*"panel ile kart AYNI alanı okur"*).

###### KADEMELİ TAZELEME — ÖLÇÜLDÜ

| yol | ne yapar | süre |
|---|---|---:|
| genel zarf taraması (360°, kaba 2° + ince 0,1°) | ilk çözüm | **84 ms** |
| tohumlu **yerel** arama (±6°, 0,5°) | bırakma / yeniden çözüm | **6 ms** |
| saklanan açı (`selectArm:false`) | **her sürükleme karesi** | **0 ms** |

Kart bütçesi 2,2 ms, yani genel tarama 38 kat aşardı. Sürükleme yolunda kol
açısı **donuyor** — ve bu yalnız bir hız kararı değil, fiziksel olarak doğrusu:
kullanıcı alternatörü sürüklerken gerginin montajdaki saati değişmiyor, değişen
kayış boyu ve gerginlik. Bırakınca `veFeadReselectArm` yeniden iyileştiriyor.

Seçilen açı düğüme **memo** olarak yazılıyor (`armMeanDeg` + `armAuto`) ama
**`saveState` çağrılmıyor**: bu bir kullanıcı kararı değil, hesabın ara sonucu —
geri-al yığınına binmesi kartın her tazelenmesinde bir adım eklemek olurdu (yön
gülü konumundaki kuralın aynısı).

**Kapı 17 mutasyonla ölçüldü, 16'sı kırmızı:** ölçütü ortalamaya çevirme (4
test), çarpanı 2,6 yapma (5), kayış kipi kilidini kaldırma (3), pivotu yine
türetme (1), memoyu yazmama (2), sabitlenmiş açıyı yok sayma (1), zarfın üçte
birini tarama (19), ince taramayı kapatma (3), yeni gerginin varsayılanını mount
yapma (1), panel kilidini kaldırma (1), rozeti kilitte SABİT yazdırma (1),
`selectArm:false`'u yutma (2), kart yolunu her karede taratma (1), boşuna
tazeleme (1), raporda boyu yine GİRDİ tarafına koyma (1), rapordan kol açısını
düşürme (1), panelden zarf okumasını düşürme (1). On yedincisi (bırakma
yolundaki `armPinned` kontrolü) **semantik olarak eşdeğer** — köprü katmanı
sabitlenmiş açıyı zaten aynen döndürüyor, dolayısıyla gözlenebilir bir fark yok.

> İki mutasyon **ilk turda YEŞİL kaldı** ve ikisi de aynı dersi tekrarladı:
> kapı ÜRETİLEN YÜZEYE bakmalı, üreticiye değil. Rozet tıkı `veFeadToggleBeltMode`
> üzerinden sınanıyordu (rozetin kendi `onclick` kapısını görmüyordu) ve zarf
> okuması `veFeadEnvelopeReadout` doğrudan çağrılıyordu (panelden düşürülmesini
> görmüyordu). Şekil 1'deki *"yay SAYISINA bakan test"* dersinin aynısı.

##### MONTAJ KOORDİNATI ↔ KASNAK MERKEZİ — arşivden ölçüldü (2026-08-28)

> **KISMEN AŞILDI (2026-08-29).** Ölçümler (iki nokta tam kol boyu kadar
> ayrı, merkez gezer pivot gezmez, raporun kendi tanımı) bugün de geçerli ve
> tek koordinat kararının dayanağı. Ama artık MFSim iki koordinatı bir arada
> KABUL ETMİYOR: `veFeadArmCheck`'in üç bantlı hükmü kalktı, çünkü
> karşılaştırılacak ikinci bir sayı yok. Bkz. *"TEK KOORDİNAT"*.


Kullanıcı bildirimi: *"Otomatik gergilerde kasnak merkezi montaj civatasının
koordinatı olacak. Yani kasnak merkezi ile montaj koordinatı aynı otomatik
gergide."* Ve daha önce yazılmış bir cümle düzeltildi: *"BMC örneği zarf kipine
geçemiyor… tedarikçiye giden sayfa kasnak merkezini veriyor, montaj cıvatasının
koordinatını vermiyor."*

İki ayrı iddia var ve **ölçüm ikisini de ayırdı**. `docs/gates-reports/pdf/`
arşivindeki 10 gerçek Gates raporu + fixture'ın 14 sistemi / 81 konumu okundu.

###### İKİ NOKTA AYNI DEĞİL — dört bağımsız kanıt

| kanıt | ölçüm |
|---|---|
| Mesafe **tam kol boyu** | 14/14 sistem, 81 konum: `\|merkez − pivot\| ↔ arm` en büyük sapma **0,0645 mm**, RMS 0,0248 — basım yuvarlama bütçesi (√2·0,05 = 0,0707) **içinde** |
| Merkez **geziyor**, pivot **gezmiyor** | FreeArm→Load arası merkez yolu **37,4…98,7 mm**; pivot altı konumda da tek sayı çifti. Bir montaj cıvatası kolun konumuyla gezemez |
| Raporun **kendi tanımı** (s.4) | *"arm direction is from **pulley center to pivot**"*, `pt = Tensioner pivot point` — kol ikisinin arasındaki doğrudur |
| `Layout Data` tablosunun gergi satırı | Mean **konumuna** 0,014–0,058 mm, pivota **90 mm** — o satır pivot değil çalışma merkezi |

Raporlarda `mounting` / `bolt` / `boss` / `attachment` diye **ayrı bir gergi
koordinatı YOK** (3/3 tarama). Gerginin tek sabit noktası
`Pivot Point {X, Y Coordinates} mm` satırıdır ve **yalnız DÖNEN raporda** basılır.

###### İDDİANIN HAKLI YARISI — ve bir belge farkı

Kullanıcının kastettiği "montaj koordinatı" gerçekten bir GİRDİ olarak vardır;
adı **Pivot Point**'tir. Ama tedarikçiye **giden** FEAD bilgi sayfası o satırı
**hiç taşımaz** — oradaki gergi satırı diğer kasnaklarla aynı şeydir. Yani iki
belge farklı şeyleri adlandırmıyor: **biri bir alanı hiç taşımıyor.**

**BMC sayfasının (−170,080 / 99,160) koordinatı KASNAK MERKEZİDİR** ve bu ayrıca
ölçüldü:

| ölçüm | sayı |
|---|---|
| mount kipinde ÇÖZÜLEN çalışma merkezi ↔ sayfa koordinatı | **0,57 mm** |
| koordinat pivot sayılsaydı merkez oradan | **90,00 mm** (tanım gereği) |
| pivot sayılınca T (zarfın seçtiği θ=114,6°) | **279,4 N** ↔ Gates 544 = **−%48,6** |
| aynı hipotezde kayış boyu | +%1,36 · sarım RMS **15,4°**, en kötü **+27,9°** |

###### AMA MFSim'DE KOORDİNAT ARTIK MONTAJ CIVATASIDIR — ve bu bir kapı boşluğuydu

Kullanıcının kararı MFSim'in kendi yüzeyine dair ve uygulandı: **gergi
bileşeninin koordinatı, diğer bütün kasnaklardan farklı olarak, kasnağın
merkezi değil gövdenin motora bağlandığı noktadır.** Zarf kipinde zaten tek
girdi odur.

Bu kapatılana kadar zarf kipinde **kanvas↔mm zincirinin İKİ UCU DA gergiyi
atlıyordu** ve ikisi de sessizdi: `veFeadSyncCanvasFromMm` 6 kasnaklı AG00976'da
4 düğüme dokunup gergiyi bırakıyor (kutu kayış düzleminden **kopuk**),
`veFeadDragTensioner` ise `mount.ok=false`'ta erken çıkıp gergi kutusunun
sürüklenmesini **hiç modele yansıtmıyordu**. İkisi de artık pivotu okuyor/yazıyor;
**mount kipi birebir eski.**

###### KAPI BEDAVA: iki koordinat birlikte varsa mesafe hüküm veriyor

`|c − p|` üç banda ayrılıyor: **≈0** → *"aynı nokta girilmiş"*, **≈kol boyu** →
tutarlı, **başka** → *"biri yanlış okunmuş"* (BMC koordinatı ↔ Gates pivotu:
**80,652 mm**, kol 90). Panel de pivot alanının etiketinde ölçülen bedeli
(**−%48,6**) yazıyor.

Kapı sekiz mutasyonla ölçüldü, sekizi de kırmızı.

###### RAPOR VE TEORİ BELGESİ DE ÇEVRİLDİ

Detaylı raporun `_frPivotBlock`'u bugünkü akışın **TERSİNİ** yazıyordu
(*"Pivot… bulunmaz ve kullanıcıdan istenmez"*) ve bu belge tedarikçiye gidiyor.
Blok kipe göre ikiye ayrıldı; mount dalı birebir eski. Zarf dalı pivotun bir
GİRDİ olduğunu, iki noktanın ayrımını **ölçüsüyle** ve denklemi ters yönde
(`c = p + a(cosθ, sinθ)`) yazıyor.

**§8.7 içine `<h4>` "Kol açısı zarftan nasıl seçiliyor" girdi** — yeni bir
§8.x AÇILMADI ve sebebi ölçüldü: belgede **elle yazılmış 32 tane §8.x çapraz
atfı** var; 8.8–8.19 kaydırılsa on ikisi **sessizce** yanlış bölüme yollardı.

Teori belgesinde §4.3 iki yönü de anlatıyor ((4.4) kök bulma ↔ (4.5) boy bir
çıktı), yeni **§4.5 Montaj zarfı** bölümü ölçütü (4.6)/(4.7) ile veriyor, ve
bir **AD ÇAKIŞMASI** kapandı: §4.4'ün *servis zarfı* (pivot sabit, kol kayış
boyuyla gezer) ile §4.5'in *montaj zarfı* (kol saati serbest) artık ayrı
adlandırılıyor.

Rapor tarafında üç sessiz kusur daha kapandı: zarf kipinde *"gerçek bir
denetimdir"* dalı basılıyor ve `armFromCoords` NaN olduğu için **"(— mm)"**
yazıyordu (aynı sınıfın **dördüncü** tekrarı); §8.2 türetilen efektif boya
*"girdi"* derken §8.7 envanteri aynı sayıya *"türev"* diyordu; uygunluk kriteri
*"montaj merkezi girilmedi"* basıyordu — girilmedi değil, **sorulmuyor**.

Kapı dokuz mutasyonla ölçüldü, dokuzu da kırmızı.

###### ~~ÖLÇÜLMEDİ~~ → ÖLÇÜLDÜ (2026-08-29, parça çizimi)

> Bu madde şunu diyordu: *"Gergi gövde cıvatasının ekseni ile kol dönme
> ekseninin eşeksenli olup olmadığı — parça çizimi depoda yok."* Kullanıcı
> çizimi gönderdi (*"Genelde hemen hemen tüm otomatik gergilerin görünümü
> böyle. Yani teknik resimleri bu."*) ve varsayım **ölçüldü**: gövdenin
> merkezî bağlantı deliği kolun dönme ekseniyle **eşmerkezli**. Yani
> "girilen montaj koordinatı = pivot" bir varsayım değil artık, okunmuş bir
> ölçü. Eksantrik gövdeli bir gergide ikisi ayrılırdı; bugün elde öyle bir
> parça YOK ve model onları bir saymaya devam ediyor.

##### KOL AÇISININ İMALAT KARŞILIĞI — KONUM PİMİ (2026-08-29)

Aynı çizim ikinci bir şey getirdi ve o **yeni bir sonuç**: zarf bir açı
SEÇİYOR (θ*), ama atölyeye gidecek talimat *"gövdeyi 236,1°'ye kur"* değildir.
Gövdeyi **merkezî cıvata TUTAR — saatini BELİRLEMEZ**; saati gövdeden bloğa
giren bir **konum pimi** sabitler. Seçimin imalat karşılığı pim deliğinin
yeridir.

```
pim açısı = θ* + Δ_parça          (E9843: Δ = −113,00°, r = 31,00 mm)
```

**ÖLÇÜLDÜ — çizimin kendi aritmetiği tastamam kapanıyor:**

| ne | hesap | çizimin yazdığı | fark |
|----|-------|-----------------|------|
| pim yarıçapı | `√(19,51² + 24,09²)` = 30,9995 | — | — |
| pim açısı (gövdeye göre) | `atan(24,09/19,51)` = 50,9967° | **51°** | 0,003° |
| kol çalışma açısı | 360 − 16 | **344°** (MEAN ANGLE) | birebir |
| pim mutlak (3. bölge) | 180 + 51 | — | — |
| **Δ_parça** | 231 − 344 | — | **−113,00°** |

**OFSET NEDEN PARÇA SABİTİ:** pim deliği GÖVDEDE, kolun gövdeye göre çalışma
konumu ise yayla sabitlenmiş. Gövdeyi döndürmek ikisini **birlikte** döndürür
→ aradaki açı gövdenin saatinden bağımsız.

**ÇİZİM KÜNYENİN KENDİSİNİ DE DOĞRULUYOR — bağımsız kaynak.** Çizim
*"28° FREEARM-MEAN ROTATION"* yazıyor; **aynı sayı** tedarikçi raporunun yay
künyesinden `(22,07 − 8,60)/0,480 = 28,0625°` çıkıyor — **0,06°**. İki
bağımsız belge (parça çizimi ↔ Gates raporu), tek sayı.

**SAYI PARÇAYA AİT, MEKANİZMA GENEL.** Kullanıcının *"hepsi böyle görünür"*
sözü MEKANİZMA için geçerli (tek merkezî cıvata + saati belirleyen konum
pimi); yarıçap ve ofset PARÇAYA aittir. Kütüphanenin kendi kuralı burada da
geçerli: çizimi olmayan parçaya sayı **UYDURULMAZ** — `veFeadPinPlan`
`ok:false` döner ve sebebi adıyla yazar (`T38624 için parça çizimi yok`).
Kodu hiç olmayan dört AG00976 kaydında sebep başka: *"parça kodu yok"*.

| Yüzey | Ne | Nerede |
|-------|-----|--------|
| Köprü | `veFeadPinPlan(td, armAbsDeg)` — tek üretici | `fead-model.js` |
| Kütüphane | `VE_FEAD_TEN_PIN` · `veFeadTenPin` · `veFeadTenPinAngle` | `fead-tensioners.js` |
| Panel | zarf **ve** montaj okumasında iki satır + gerekçe notu | `veFeadPinRows` / `veFeadPinNote` |
| Rapor | §8.7 içinde `<h4>` + (4.8) + Tablo C satırları | `_frPinBlock` |
| Teori | §4.5'in son paragrafı + (4.8) + §10'da iki sembol | `fead-theory-source.html` |

**PİM İKİ KİPTE DE KURULUYOR** ve bu bir genişletme değil bir zorunluluk:
montaj kipinde de kol çalışma açısı bir ÇIKTIDIR (`montajDeg` = pivot →
girilen merkez). Yalnız zarf kipinde kurulsaydı montaj kipinde hesaplanan
sayı hiçbir yerden okunmayan **ölü veri** olurdu — bu deponun tekrar eden
hata sınıfı.

**PARÇA KODU KAYDA KOPYALANIR VE KODSUZ KÜNYEDE SİLİNİR** (`td.tenPart`).
Silinmeseydi bir künyeden diğerine geçince yeni gerginin pimi ESKİ parçanın
çizimiyle hesaplanırdı — sayı çıkar, uyarı çıkmaz. Kopya olması ise
kütüphanenin kendi kuralı (`structural-materials.js` kalıbı): katalog sürümü
değişse de kaydedilmiş proje kendiliğinden değişmez.

###### AYNI TURDA ÇIKAN SESSİZ KUSUR — LaTeX kaçışı JS'te YUTULUYOR

Pim denklemi yazılırken çıktı ve **önceden de vardı**: rapor üreteci
denklemleri JS dizgisi olarak kuruyor, orada `'\;'` **tek** ters bölü ile
yazılırsa JS onu yiyip düz `;` bırakıyor. Belge yine üretiliyor, hata
çıkmıyor — yalnız denklem **yalan söylüyor**:

| JS kaynağında yazan | KaTeX'in gördüğü | ekranda |
|---|---|---|
| `\;` (çift) | `\;` | ince boşluk ✓ |
| `\;` (tek) | `;` | **noktalı virgül** ✗ |
| `\\theta` (çift) | `\theta` | θ ✓ |
| `\theta` (tek) | SEKME + `heta` | **çöp** ✗ |

**ÖLÇÜLDÜ: 21 yerde** (§8.7'nin pivot ve zarf denklemleri). Aynı sınıfın daha
sert hâli `'	heta'` → **SEKME + "heta"**. Kapı ÜRETİLEN METNE bakıyor
(`fead-pin.test.js`): her `$$…$$` ve `\(…\)` bloğunda ters bölüsüz `;`,
sekme ve çıplak komut gövdesi (`theta`, `text`, `Delta`, `frac`, `circ`,
`big`, `sin`, `cos`) aranıyor. İki mutasyonla ölçüldü — bir `\;`'yi geri
`\;` yapmak ve pim denkleminin `\theta`'sını tekilleştirmek — ikisi de
kırmızı.

Kapı **on üç mutasyonla** ölçüldü, on üçü de kırmızı: ofsetin işaretini
çevirme, yarıçapı kaydırma, kodsuz künyede eski kodu bırakma, kodu hiç
kopyalamama, çizimi olmayan parçaya E9843'ün sayısını verme, `build.pin`'i
hiç kurmama, yalnız zarf kipinde kurma, panelin iki okumasından pim satırını
tek tek düşürme, künye yokken paneli susturma, raporun pim bloğunu düşürme,
eşmerkezlilik notunu silme, künye yokken rapora sayı uydurtma.

> Bir mutasyon (künye yokken paneli susturma) **ilk turda YEŞİL kaldı** ve
> aynı dersi tekrarladı: satır ile açıklama notunun İKİSİ de *"Konum pimi"*
> yazıyor, dolayısıyla yalnız metne bakan kapı satırın düşürülmesini
> geçiriyordu. Kapı artık satırın kendi işaretine bakıyor.

###### AYNI SINIFTAN İKİ OKUYUCU DAHA — ikisi de sessizdi (2026-08-29)

Kullanıcı akışı sordu (*"bir sistem ADIM ADIM nasıl kuruluyor?"*), zincir uçtan
uca koşturuldu ve zarf kipinde **`cenX/cenY` okuyan iki yüzey daha** çıktı. İkisi
de hesaba dokunmuyor — o yüzden hiçbir test kırılmıyordu — ama **kullanıcının
gördüğü şey yanlıştı**:

| Nerede | Belirti | Ölçüm (AG00976, zarf kipi) |
|--------|---------|----------------------------|
| `veFeadNaturalSense` | "Dönüş Yönü" rozeti ve paneli **çözülmüş** modelde bile `— (okunamadı)` | `sense` **1 yerine 0** |
| `veFeadArrangeByCoords` | "Otomatik Düzenle" gergiyi *"koordinatı yok"* sayıp kümenin ALTINA diziyor + uyarı toast'ı | kutu **2857,4/3039,0 yerine 2971,0/3277,3** |

İkincisi bir **AYRIŞMAYDI**: alt topoloji açılışındaki yol
(`veFeadSyncCanvasFromMm`) gergiyi zaten doğru şekilde pivota oturtuyordu, yani
kullanıcı düzenleyip kapatıp açınca kutu yerinden **zıplıyordu**.

**İKİ NOKTA, İKİ OKUYUCU — birleştirilemez.** Kural artık tek yerde ama
fonksiyon **iki tane**, çünkü iki yüzey iki farklı noktayı istiyor:

| Okuyucu | Ne döndürür | Kim kullanır |
|---------|-------------|--------------|
| `veFeadTensionerBoxMm` | **kutunun gösterdiği** nokta — zarf kipinde PİVOT, aksi hâlde montaj merkezi | `veFeadSyncCanvasFromMm` · `veFeadArrangeByCoords` · örnek kurucusu |
| `veFeadTensionerCenter` | **kasnak merkezi** — zarf kipinde `c = p + a·(cos θ, sin θ)` ile TÜRER | `veFeadNaturalSense` (loopSense) · zarf okuması |

Tek fonksiyona indirgemek yönü **kol boyu kadar kaymış** bir çokgenden okumak
olurdu (90 mm).

**ÜÇ BAĞIMSIZ DOĞRULAMA — hepsi ölçüldü:**

| Ne | Sonuç |
|----|-------|
| Türetilen merkez ↔ çekirdeğin ÇALIŞMA merkezi | `−161,624 / 92,981` ↔ `−161,624 / 92,981` — **birebir** (yaklaşıklık değil: memo, zarfın seçtiği çalışma açısının kendisi) |
| Rozet yönü ↔ `geometryAt(...).sense` | **1 ↔ 1** |
| "Otomatik Düzenle" → sonra `veFeadSyncCanvasFromMm` | taşınan düğüm **0**, en büyük sapma **0,0000 px** (iki yol artık aynı yere koyuyor) |

**`build.spin` BİR ÇÖZÜM GERİDE KALIYORDU** ve düzeltmesi sıra meselesi: yön rota
kurulur kurulmaz okunuyor, ama zarf kipinde gergi kasnağının merkezi o an HENÜZ
YOK (kol açısı aynı fonksiyonun ilerisinde seçiliyor). Zarf bloğundan sonra
tazeleniyor.

**MOUNT KİPİNDE TÜRETMEYE DÜŞÜLMEZ** ve bu bilinçli: orada girdi montaj
merkezidir, yoksa model zaten *"montaj merkezi girilmedi"* diye duruyor —
türetilmiş bir sayı basmak çözülemeyen bir modele yön uydurmak olurdu. Zarf
kipinde ise **bayat `cenX/cenY` okunmaz** (mount'tan geçmiş bir kayıtta yazılı
kalabilir); köprü de onları girdi saymıyor, olsa olsa uyarı konusu ediyor.

**Kapı yedi mutasyonla ölçüldü, yedisi de kırmızı:** `naturalSense`i yine
`cenX/cenY`ye bağlama, merkez yerine pivot döndürme, zarf sonrası spin
tazelemesini kaldırma, "Otomatik Düzenle"yi yine `cenX/cenY`ye bağlama, kutu
okuyucusunu zarf kipinde de montaj merkezine bağlama, bayat `cenX/cenY`yi
kazandırma, türetmede işareti çevirme.

> **Sentetik kapı ŞART ÇIKTI.** İki gerçek örnekte pivot ile merkez **AYNI**
> dolanım işaretini veriyor (ölçüldü), yani yalnız onlara bakan bir test
> *"merkez yerine pivot"* mutasyonundan sağ çıkardı. Kapı bu yüzden merkezin
> doğrunun ÜSTÜNDE, pivotun ALTINDA olduğu üç kasnaklı sentetik bir düzen de
> koşuyor: orada işaret **çevriliyor** (+1 ↔ −1).

##### GERGİ KÜNYE KÜTÜPHANESİ — `js/fead-tensioners.js` (14 kayıt, 2 aile)

Kullanıcı isteği: *"Bu otomatik gergi özelliklerini de Gates raporlarından
kalibre ederek çekeceğiz."* Kalıp `fead-belts.js` ile aynı: DOM'suz saf veri,
panel yalnız okur.

**PARÇA NUMARASI UYDURULMADI** ve kayıtlar **kaynak raporla** adlandırıldı;
anahtar hangi ölçümden geldiğini söyler.

> **DÜZELTME — parça numarası RAPORDA VAR.** Bu paragraf bir dönem *"Gates
> raporları gerginin parça numarasını yazmıyor; tek bilinen `E9843` ve o da tek
> bir aracın montaj çiziminden geliyor"* diyordu. `docs/gates-reports/pdf/`
> arşivi kurulunca ÖLÇÜLDÜ ve tutmadı: **on raporun onunda da** kod raporun
> kendi **Drive Notes** alanında yazıyor, üstelik **dört ayrı kod**:
>
> ```
> Tensioner T38624; CW; 24.6Nm          E9843, 22Nm@27°, CCW@115/260
> Tensioner Gates T38665; 31Nm          T38519 (29.5Nm): CCW@-303/7
> ```
>
> Kodlar artık `part` alanında. Arşivde PDF'i olmayan **dört AG00976 kaydı
> `part` TAŞIMIYOR** — doğrulanamayan bir kod yazmak tam da kaçınılmak istenen
> şey olurdu; kapı bunu ayrıca tutuyor.

Aynı alan bir şey daha ele verdi: Drive Notes **bağıl açıyı** da yazıyor
(`E9843/16Nm@15°` · `/19Nm@21°` · `/22.5Nm@28°`) ve bunlar künyeden hesaplanan
`(mean−pre)/rate` ile birebir tutuyor (`15.07 · 20.99 · 27.96`) — künyenin iç
tutarlılığının **kaynaktan bağımsız** kanıtı.

###### İKİ VERİ KUSURU — arşive karşı ölçülünce çıktı

| Kusur | Neydi | Rapor ne diyor |
|-------|-------|----------------|
| `AG00810.ribs` | **8** | **10** (`10PK1215HD`). Alanın kendi tanımı *"künyenin ölçüldüğü kayış genişliği — `meanNm` bunun için geçerli"*, yani yanlış genişlik yanlış çalışma momenti demek |
| `AG00810.preloadNm` | `11.561`, notu yalnız *"bandın üstünde"* | Raporda **HİÇ YOK** — fixture'ın kendi künyesinde *"mean torktan türetildi"* yazılı. Artık `preloadDerived:true` ile işaretli; işaretsiz hâlinde okuyan kişi onu raporun sayısı sanırdı |

**`ribs` kusuru BUGÜN ÇIKTIYI DEĞİŞTİRMİYOR ve bunu söylemek önemli:** bant
hesabı (`relNom8PK`) `ribs === 8` süzgecinden sonra bir de `rel < 30` kesiyor
ve AG00810'un 37.1°'si zaten oradan eleniyor — düzeltmeden önce ve sonra bant
birebir `27.10–29.62`. Yani `<30` kesmesi, `ribs` alanının yapması gereken işi
yapıyordu.

###### Kütüphane ARŞİVE bağlı (`tests/unit/gates-archive.test.js`)

Künyeler `tests/fixtures/fead-validation.js`'ten çıkarılmıştı; arşiv kurulunca
onu da **asıl raporuna** karşı ölçmek mümkün oldu. Kütüphanenin kendi testi iç
tutarlılığa bakar, bu kapı **kaynağa**: on kaydın kol/oran/moment değerleri
(30 sayı) birebir, ön yükün dokuzu birebir ve onuncusu türetilmiş diye
işaretli, kaburga sayısı raporun künyesiyle aynı, parça kodu Drive Notes'ta
gerçekten geçiyor.

Kapı **altı mutasyonla** ölçüldü, altısı da kırmızı: `ribs`'i 8'e geri alma,
türetilmiş ön yük işaretini kaldırma, bir parça kodunu yanlış yazma,
doğrulanamayan kayda kod uydurma, bir yay oranını kaydırma, okuyucudaki
tire-bölünmesi düzeltmesini kaldırma.

###### HANGİ ALAN PARÇANIN, HANGİSİ MONTAJIN — ÖLÇÜLDÜ

Ayrım tahmin değil: **AG0868 ailesi AYNI gergiyi üç kayış genişliğiyle**
kullanıyor ve yalnız bir alan değişiyor.

| | ön yük | katsayı | çalışma momenti | nominal dönme |
|---|---:|---:|---:|---:|
| 8PK | 8,56 | 0,501 | **22,57** | **27,96°** |
| 6PK | 8,65 | 0,495 | **19,04** | **20,99°** |
| 4PK | 8,46 | 0,505 | **16,07** | **15,07°** |

Ön yük ve katsayı **%2 içinde sabit** (aynı yay), çalışma momenti kayış
genişliğiyle ölçekleniyor. Yani:

| | alanlar |
|---|---|
| **PARÇA** | kol boyu · ön yük · yay katsayısı · kasnak çapı · temas tarafı |
| **MONTAJ** | çalışma momenti — kolun ne kadar kurulduğu, bir TASARIM AYARI |

Künye uygulamak **pivot ve kol açısını YAZMAZ** (testli): ikisi de motorun
verisi, parçanın değil. Künye pivotu da taşısaydı kullanıcı bir kataloğun
koordinatını kendi motoruna uygulamış olurdu.

###### İKİ AİLE, VE ~28°'nin RASTLANTI OLMADIĞI

14 kaydın 13'ü tek gövde ailesinden: kol **90 mm**, kasnak **Ø77,2**, sırttan
temas, katsayı **0,475–0,505** Nm/° (±%3). Tek istisna **AG00879**: kol 56 mm,
Ø76,2, katsayı 0,409, ön yük 20,05 — belirgin şekilde başka bir parça.

Kol-90 ailesinin tam genişlikli (8PK) **dokuz** kaydında
`(M_mean − M₀)/k = 27,10 … 29,62°`. Kullanıcının gönderdiği E9843 montaj
çizimi aynı sayıyı yazıyor: *"PIN POSITION FOR THE 344° MEAN ANGLE AND 22.5 Nm
SPRING TORQUE @ **28° FREEARM-MEAN ROTATION**"*. Parçanın kendi değişmezi
**bağıl** dönmedir; mutlak açı montaja aittir ve zarftan seçilir.

###### BANT KAYITLARDAN TÜRETİLİR, ELLE YAZILMAZ

İlk sürüm yuvarlanmış sınırlar taşıyordu ve **kapı bunu yakaladı**:
`(16,07 − 8,46)/0,505 = 15,0693…`, elle yazılan alt sınır ise `15,07` — yani
kütüphane **kendi kaydını** "bandın dışında" ilan ediyordu. Elle yazılmış bir
sınır ayrıca yeni bir kayıt eklendiğinde sessizce eskir (kart ölçüsündeki
"ikinci kopya" dersinin aynısı).

**Bant bir HÜKÜM değil bir KARŞILAŞTIRMA:** kullanıcının gergisi bu 14 raporun
dışından olabilir ve bu bir hata değildir. Ama **bir ondalık kayması tam
buradan görünür** — `rate 0,480 → 0,048` hem katsayı bandını hem nominal
dönmeyi (280°) düşürüyor, yani iki bağımsız işaret veriyor.

**KAYIT KOPYA OLARAK GİDER:** kütüphane sürümü değişip bir değer düzeltilse
bile kaydedilmiş proje kendiliğinden değişmez (`tenLib`/`tenLibVer` yalnız İZ
bırakıyor) — `structural-materials.js`'in kendi kuralı, bu projenin en çok
kaçındığı hata sınıfı.

**EN KRİTİK KAPI:** kütüphanedeki her sayı `tests/fixtures/fead-validation.js`
içindeki raporlardan çıkarıldı, yani **ikinci bir kopya**. Ayrışırsa hata
SESSİZ olur — kullanıcı künye seçer, model çözülür, uyarı çıkmaz, yalnız
sayılar raporunkinden başkadır. Test 14 kaydın 14'ünü de fixture'la **birebir**
karşılaştırıyor ve nominal dönmeyi raporun kendi Mean satırıyla (0,2° içinde)
tutuyor.

Kapı **dokuz mutasyonla** ölçüldü, dokuzu da kırmızı: bir künyeyi fixture'dan
kaydırma, uygulamada kasnak çapını atlama, bant denetimini boşaltma, listeyi
referansla döndürme, künyeden pivota yazma, Türkçe katlamayı kaldırma, bandı
elle yazılmış sınıra döndürme, paneli künye kartını basmaz yapma, seçilen
künyeyi uygulamama.

> Türkçe katlama kapısı **ilk turda YEŞİL kaldı**: test `AG00976` / `KASNAK`
> gibi sorgularla koşuyordu ve ikisi de `toLowerCase()` ile de bulunuyor. Kapı
> artık `DIŞINDA` / `dışında` / `DISINDA` dörtlüsünü koşuyor — JS'te
> `'I'.toLowerCase() === 'i'` (Türkçe'de `'ı'` olmalı), yani ancak katlamayla
> bulunuyor.

##### KAYIŞ TİPİNE BAĞLI ÇIKTILAR — ŞİMDİLİK KAPALI (2026-08-28)

Kullanıcı isteği: *"'kayış boyu' kullanılarak yapılan hesaplamalar, diyagramlar
vb şeyler, yani 'kayış tipi' özelinde gelen profil sabitleri ile hesaplanan
şeyler olmayacak. ŞİMDİLİK. İlerleyen zamanlarda BELKİ kayış tipi sabit kabul
ederek bir hesaplama yapabiliriz."*

Zarf kipinde kayış boyu bir ÇIKTI, yani tasarım aşamasında kayış **henüz
seçilmemiştir**. O aşamada katalog sabitleriyle hesap yapmak olmayan bir seçimi
varsaymak olurdu — ve bu modülde en pahalı hata sınıfı "makul ama yanlış"
sayıdır: tablolar dolu görünür, hüküm verilir, okuyucu neyin varsayıldığını
bilmez.

| kapatılan çıktı | kayış katalogundan gelen |
|---|---|
| B10 kayış ömrü | `effLength` · `massPerRibKgM × ribs` · yorulma sabitleri |
| Kaburga yorulma dağılımı | yorulma sabitleri (PK-2_2p-MT3 / PK-2_2a-MT3) |
| Açıklık doğal frekansları + çırpınma | birim kütle (`massPerRibKgM × ribs`) |
| Kol konum tablosunun zarfı | `tolerance` · `wearPct` |

**KAPATILAMAYAN TEK ŞEY: `hb` / `hr`.** Pitch yarıçapı `OD/2 + hb` (kaburgalı)
ya da `OD/2 + hr` (sırttan); ikisi de profil sabiti. PK'da `hb = 1,2 mm`, yani
merkez mesafelerinde 2,4 mm'lik fark. Bunlar olmadan **teğet geometrisi
yoktur** — kapatmak "kayışsız kayış tahriki" demek olurdu. Panel ve rapor bunu
açıkça yazıyor: kapatılan şey profil değil, profilin **katalog sonuçları**.

**VARSAYILAN VERİDEN ÇÖZÜLÜR** (`veFeadBeltDataMode`): zarf kipinde `none`,
diğer kiplerde `full` — yani bugüne kadarki her kayıt davranışını birebir
koruyor (testli). Kullanıcının açık seçimi ikisini de ezer.

**SESSİZ DEĞİL:** kapatılanlar `beltDataOff` olarak sonuca giriyor, panel
listeliyor, rapor §8'in başında *"Kayış tipine bağlı çıktılar bu belgede YER
ALMIYOR"* kutusunu basıyor. Bir özet belgenin en pahalı sessiz hatası,
İÇERMEDİĞİ bir kontrolün yapıldığı izlenimini bırakmasıdır.

Kapı **altı mutasyonla** ölçüldü, altısı da kırmızı: zarf kipinde yine `full`
verme, kapalıyken ömür/yorulmayı yine üretme, frekansları bırakma, kapatılanlar
listesini boşaltma, panel anahtarını başlıksız bırakma, rapordan kutuyu düşürme.

> Altıncısı **ilk turda YEŞİL kaldı** — kapı `_frBeltDataBox`'ı doğrudan
> çağırıyordu, `_frSection8`'in onu BASTIĞINI ölçmüyordu. Aynı oturumda
> **üçüncü kez** aynı ders: kapı ÜRETİLEN YÜZEYE bakmalı, üreticiye değil.

##### BAŞLANGIÇ SİHİRBAZI — `js/cp-fead-wizard.js` (7 adım, 2026-08-29)

Kullanıcı isteği: *"Bir 'Başlangıç Sihirbazı' bileşeni kuracağız. Bu bileşene
tıkladığımızda adım adım bir modeli kurmak için gereken tüm girdileri
gireceğiz. İlk sayfada sihirbaz kullanıcıya kasnak koordinatlarını soracak,
diğer sayfada diğer girdileri…"*

Çözdüğü şey bir eksiklik DEĞİL bir **SIRA** sorunu: bütün girdiler zaten
panellerdeydi, ama hangi sırayla girileceğini ve hangi alanın hangi belgeden
okunduğunu ancak modülü bilen biri biliyordu. Boş bir iç topolojide kullanıcı
"önce ne koyayım" sorusuyla baş başaydı.

| Adım | Ne sorar |
|------|----------|
| 1 Başlangıç | sistem adı · örnekten doldur |
| 2 Kasnaklar | tip · ad · Ø OD · X/Y · temas tarafı · sürücü rolü · atalet — **gergi de burada** (künye + montaj konumu) |
| 3 Kayış Yolu | serpantin sırası (↑↓) · yönü çevir · dönüş yönü okuması |
| 4 Otomatik Gergi | künye kütüphanesi · montaj konumu · kol · yay künyesi · titreşim girdileri |
| 5 Kayış | profil/marka/kanal · kayış tipine bağlı çıktılar (boy bir ÇIKTI) |
| 6 Motor ve Çevrim | tahrik oranı · motor künyesi · **aksesuar modelleri** · duty tablosu (devir · %zaman · °C · aksesuar kW **okuması**) |
| 7 Özet ve Kurulum | canlı çözüm kartları · **kayış yolu şeması** · uyarılar · Modeli Kur |

###### ÜÇ KURAL — üçü de bu modülün kendi derslerinden

1. **SİHİRBAZ KENDİ MODELİNİ KURMAZ.** Durum → `veFeadWizNodes` → köprünün
   düğüm biçimi (`veFeadExampleNodes` ile AYNI sözleşme). **Önizleme de kurulum
   da aynı listeden** geçiyor; ikinci bir kurucu yazmak, önizlemenin kanvasta
   çıkan modelden sessizce ayrışması demekti.
2. **DOĞRULAMA DA KÖPRÜDEN.** Her adımda `veFeadBuildSystem` koşuyor ve onun
   `errors/warnings` listesi adıma süzülüp gösteriliyor (`VE_FW_ERR_STEP`).
   İkinci bir zorunlu-alan listesi, köprü değişince sessizce eskiyen bir kapı
   olurdu. Köprü hiçbir durumda istisna atmadığı için sihirbaz İLK adımdan
   itibaren canlı çalışıyor.
3. **DURUM OTURUMLUK, KURULUM KALICI.** Kırk alanlık bir formda her tuş vuruşu
   `saveState()` çağırsaydı geri-al yığını kullanılamaz hale gelirdi (panel
   alanlarının kuralı burada geçerli DEĞİL: orada bir alan = bir karar). Taslak
   KAPANIŞTA `node.data.wiz`e yazılıyor; `saveState` yalnız kapanışta ve
   kurulumda.

###### EN SIKI KAPI BİR EŞİTLİK — sihirbaz iki örneği de BİREBİR geri üretiyor

Sihirbazın durumu bambaşka bir biçim (form satırları, kasnak anahtarları,
`kwByKey` yerine `kw`) ama çözüm **aynı sayı** olmak zorunda. **ÖLÇÜLDÜ:**

| | sihirbaz | örnek kurucusu |
|---|---|---|
| AG00976 | L **1714,6000** · T **544,0497** · rel **28,0750** · spin 1 | birebir aynı |
| BMC | L **1715,0000** · T **532,1423** · rel **28,4271** · spin 1 | birebir aynı |

Çeviride bir alan düşse (temas tarafı, sürücü rolü, kip, yay künyesi, duty kW)
sonuç sessizce kayardı — model yine çözülür, yalnız başka bir sistemi anlatır.

###### GERGİ TEK KOORDİNAT TAŞIR — ve ötekiler TAŞINMAZ

`angleMode` **açıkça** yazılıyor (köprü veriden de çözebiliyor ama açık seçim
her zaman kazanır): yarım doldurulmuş bir formda kip, kullanıcının seçtiğinden
BAŞKA çıkabilirdi. Kasnak merkezi **yazılmıyor** — yazılsaydı köprünün "iki
koordinat da var" uyarısı, kullanıcının GİRMEDİĞİ bir alandan gelirdi; merkez
zaten montaj konumu + kol açısından TÜREYEN bir çıktı. Kayış boy kipi de
yazılmıyor: boy yapısal olarak bir çıktı ve köprü kipi zaten kilitliyor.

###### KURULUM: mevcut model SESSİZCE silinmez

Kanvasta kasnak varken kurulum **kapalı** ve sebebi yazılı: üstüne kurmak bir
kasnaktan iki tel çıkması demekti (çatal → çözüm reddedilir). Açık onay
kutusu işaretlenince siliniyor ve **geri alınabilir**. Araç düğümleri
(kayış · çözücü · kart · rapor) silinmiyor, **yeniden kullanılıyor**:
`fead-belt` zaten `maxInstances:1` ve kullanıcının kart ölçüsü / rapor türü
gibi tercihlerini çöpe atmanın karşılığı yok.

**SİHİRBAZ DÜĞÜMÜ KURULUMDAN SONRA KALIR** — `fead-example`'ın tersine, ve
ayrım kullanıcı verisinde: sihirbaz düğümü kullanıcının kendi formunu taşıyor
(silmek onu çöpe atmak olurdu), örnek düğümü hiçbir şey taşımıyor.

###### İki UI kararı, ikisi de ölçülmüş bir kusurun karşılığı

| Karar | Neyi kapatıyor |
|-------|----------------|
| Canlı şerit **yama**, tam yeniden çizim değil (220 ms gecikmeli) | Her tuş vuruşunda panel yeniden kurulsaydı **ODAK düşerdi** — malzeme kütüphanesi aramasında ölçülmüş sınıf. Ayrıca zarf kipinin ilk taraması 84 ms; kol açısı memosu duruma yazıldığı için sonraki çözümler 6 ms |
| Adım rayı **tıklanabilir** ve rozeti o adımın **hata sayısını** taşıyor | Sihirbaz bir kilit değil bir sıra önerisi; kullanıcı 5. adımda bir kasnağı düzeltmek için 2'ye dönebilmeli ve hangi adıma döneceğini son adımı beklemeden görmeli |

Boş topoloji artık **iki** açılış yüzeyiyle geliyor (sihirbaz + örnekler): ikisi
farklı soruya cevap veriyor — *"kendi motorumun verisini nasıl gireceğim"* ile
*"çalışan bir model neye benziyor"*.

###### ÖLÇÜLDÜ — gerçek tarayıcı (6 E2E, ilk turda yeşil)

Çift tık sihirbazı açıyor · yedi adım rayda · örnekten doldurunca şerit
`✓ model çözülüyor · L 1715.0 mm · T 532.1 N · ↺ CCW` ve **hata rozeti 0** ·
gerçek klavye girişinde değer modele işliyor ve **odak alanda kalıyor** ·
özet adımında şema **6 kasnak çemberiyle** çiziliyor · "Modeli Kur" **6 kasnak
+ 6 tel** kuruyor, önizleme ile kurulan model **1e-6 içinde aynı**, sihirbaz
düğümü kalıyor, örnek düğümü gidiyor · modal ekrana sığıyor ve gövde **yatay
kaydırmıyor** (tablo kendi kabında kayıyor) · konsol hatası **yok**.

Kozmetik tur ekran görüntüsüyle yapıldı ve dört düzeltme çıkardı: duty kW yer
tutucusu `0` gerçek bir değer gibi okunuyordu (boş hücre "kasnağın kendi
eğrisinden gelsin" demek) → tire; özet kartı **mount kipinde olmayan** mutlak
kol açısını `—` basıyordu → kipe göre *"Kol açısı (mutlak)"* ↔ *"Kol dönmesi
(göreli)"*; şema 520 px'de etiketleri kayış yolunun üstüne bindiriyordu →
700×440 (kabı aşmadan); tablo sütunları tip/ad adlarını kırpıyordu → sütun
alt genişlikleri.

**Kapı on mutasyonla ölçüldü, onu da kırmızı:** duty kW çevirisini kaldırma,
zarf kipinde montaj merkezini de yazma, kipi veriden çözdürme, zarf kipinde
kayış boy kipini yazma, kasnak silinince duty sütununu bırakma, kurulum
kapısını kaldırma, sihirbaz düğümünü de silme, başlangıçta yalnız örnek
kutusu koyma, `maxInstances`ı kaldırma, form içi düzenlemede `saveState`
çağırma.

> Onuncusu **ilk turda YEŞİL kaldı**: kapı yalnız satır EKLEME yolunu
> yokluyordu, oysa asıl risk alan YAZMA yolunda (`_fwSet`). Kapı artık üç
> yolu birden koşuyor.

###### BEŞ DÜZELTME — kullanıcı turu (2026-08-31)

Kullanıcı sihirbazı kullanıp beş madde bildirdi. Üçü eksiltme, ikisi ekleme; ama
ikisinin altından **sessiz birer kusur** çıktı.

| # | İstek | Ne yapıldı |
|---|-------|------------|
| 1 | *"'Kasnaklar' kısmında otomatik gergi eklenmiyor/çıkarılmıyor… koordinatları oraya el ile girelim, bu sayfadan gerginin tipini seçelim"* | Gergi 2. adımda **sanal satır** olarak duruyor (`_fwTenRow`) |
| 2 | *"Otomatik gergi tiplerinde Gates raporları yazıyor… sadece kol uzunluğu ve çalışma momenti yazsın"* | `veFeadTenLabel` — **tek üretici**, panel de onu kullanıyor |
| 3 | *"Sihirbaz içinde 'Katalog Önerisi' kısmı var. Onu kaldıralım."* | Blok kalktı, yerine Kayış Özellikleri paneline yönlendiren tek satır |
| 4 | *"Kullanıcı alternatör ve klima kompresörü tipini tıpkı bileşenindeki gibi açılır pencere ile seçecek… El ile değer girmeyeceğiz."* | **Aksesuar Modelleri** kartı + duty kW hücreleri **salt okuma** |
| 5 | *"Sonuçlar kısmından 'kol açısı' açıklamasını kaldıralım."* | Özet 6 → **5 künye** |

###### 1 · GERGİ SATIRI SANAL — silinemez, sürücü olamaz, koordinatı KİPE bağlı

Gergi bir kasnak listesi ögesi değil (`st.ten` ayrı bir alan, `st.pulleys`
dizisinde yeri yok) ve öyle KALIYOR: onu diziye almak sürücü seçimi, silme,
sıralama ve duty sütunu yollarının hepsine "ama gergi hariç" istisnası eklemek
olurdu. Satır **sanal**: tabloya çiziliyor, yazdığı yer `st.ten`.

| Ne | Karar |
|----|-------|
| Sürücü radyosu | **kapalı** — gergi güç çekmez, çeviremez |
| Silme düğmesi | **kapalı** — gergi zincirin yapısal parçası, sıraya kendiliğinden giriyor |
| Koordinat alanları | **montaj konumu** (`pivotX/pivotY`) — kasnak merkezine ASLA yazmaz |
| Hangi nokta olduğu | Satırın kendi **amber çipinde** yazılı: `X/Y = montaj noktası` |

Çip bir süs değil: bu modülün **ölçülmüş en pahalı karışıklığı** tam bu iki
noktanın karıştırılması (montaj noktası sanılan kasnak merkezi → T **−%48,6**,
en kötü sarım **+%27,9**, model yine çözülür ve uyarı çıkmaz). Diğer beş satırın
X/Y'si her zaman kasnak merkezi olduğu için gergi satırı bunu **söylemek
zorunda** — ve kapı yalnız doğru alana yazdığını değil, `cenX/cenY`'ye
yazMADIĞINI da tutuyor (o alana yazmak kullanıcının sayısını 90 mm ötedeki bir
noktaya koymak olurdu).

> Alan adı `pivotX/pivotY` olarak KALDI (veri biçimi), yüzeydeki ad ise
> **montaj konumu** — PR #831'in terminoloji kararı. İkisini tek yerde
> (`veFeadWizTenCoordKeys` / `veFeadWizTenCoordLabel`) tutmak, satırın ve 4.
> adımın aynı alanı yazmasının garantisi.

**AYNI DURUM, İKİ YÜZEY.** `veFeadWizTenSet` doğrudan `st.ten`'e yazıyor — 4.
adımın okuduğu alanın ta kendisi. İkinci bir kopya tutulsaydı iki sayfa sessizce
ayrışırdı (bu modülün tekrar eden kuralı: *"panel ile kart AYNI alanı okur"*).
Aynı gerekçeyle 2. adımdaki künye seçicisi de 4. adımdakiyle **aynı fonksiyona**
(`veFeadWizTenLib`) gidiyor.

Kart alt başlığı da düzeldi: `6 kasnak (gergi dahil)` — eskiden 5 diyordu ve
kullanıcının bildirdiği *"gergi eklenmiyor"* algısını besliyordu.

###### 2 · ETİKET TEK ÜRETİCİDEN — ve 14 kayıt 14 AYRI etiket veriyor

```js
veFeadTenLabel(rec)  →  'kol 90 mm · 22.07 Nm'
```

Eski etiket kayıt anahtarını (`AG00976-1715`) ve raporun adını taşıyordu; o
anahtar künyenin **hangi ölçümden çıkarıldığını** söyler, kullanıcıya ise
parçanın ne olduğunu söylemez.

**TEKİLLİK ÖLÇÜLDÜ: 14 kayıt → 14 ayrı etiket.** Kol boyu ikiye ayırıyor
(90 mm ×13, 56 mm ×1), çalışma momenti geri kalanı: `16,07 · 19,04 · 22,07 ·
22,15 · 22,20 · 22,21 · 22,43 · 22,54 · 22,57 · 22,66 · 23,00 · 24,54 · 29,48 ·
31,14`. Yani sadeleşme bir **çakışma** üretmiyor — üretseydi kullanıcı iki
farklı künyeyi ayırt edemezdi.

Üretici `js/fead-tensioners.js`'te ve **panel de onu kullanıyor**
(`veFeadTensionerLibCard`): iki yüzey aynı listeyi farklı adlandırsaydı
kullanıcı sihirbazda seçtiği künyeyi panelde bulamazdı.

**BEDELİ YAZILI:** etiket artık parça kimliğini taşımıyor. Parça kodu kayıtların
**10'unda var** (`E9843` ×6, `T38624` ×2, `T38665`, `T38519`) ve istenirse
etikete eklenebilir; bugün kullanıcının açık isteği *"diğer açıklamalara gerek
yok"* olduğu için eklenmedi. Sihirbazın gergi kartı da geçerlilik satırını
(*"kütüphane bir sertifika değil"*) artık basmıyor; panel basmaya devam ediyor.

###### KÜNYE UYGULAMASINDA SESSİZ KUSUR — beyaz liste `tenPart`'ı YUTUYORDU

Kapıyı yazarken çıktı. Sihirbaz künyeyi kendi **beyaz listesiyle** kopyalıyordu
(kol · ön yük · katsayı · moment · çap · temas) ve iki alan listede yoktu:
`tenPart` (parça kodu) ile `inertia`. Üstelik kodu OLMAYAN bir künyeye
geçildiğinde eski kod **silinmiyordu** — yani bir sonraki gerginin pimi ESKİ
parçanın çizimiyle hesaplanırdı; `veFeadTensionerApply`'ın kendi kuralı tam
olarak bunu yasaklıyor.

**ÖLÇÜLDÜ** (AG00976 durumuna kütüphaneden künye uygulanınca):

| uygulanan kayıt | `tenPart` | `build.pin` |
|---|---|---|
| beyaz liste (eski) | **yok** | `ok:false` · *"Gergi parça kodu yok"* — **yanlış sebep** |
| AG00894 (E9843) | `E9843` | `ok:true` · **235,00°** · r 31 mm · ofset −113° |
| AG00686 (T38624) | `T38624` | `ok:false` · *"T38624 için parça çizimi yok"* — **doğru sebep** |

Yani kullanıcı kodu olan bir künye seçiyor, sihirbaz *"kod yok"* diyordu.
Düzeltme yeni bir kural değil, **ikinci kopyanın kaldırılması**: satır artık
doğrudan `veFeadTensionerApply(st.ten, rec)` çağırıyor — panelin kullandığı
yolun ta kendisi.

###### 4 · AKSESUAR MODELİ SEÇİLİR, kW ELLE GİRİLMEZ

Duty tablosunun kW hücreleri **girdi olmaktan çıktı**, okuma oldu
(`.ve-fw-ro`). Değer nereden gelirse gelsin aynı hücrede görünüyor ve **kaynağı
ayrı bir sütunda yazılı** (`katalog` · `kasnak eğrisi` · `kayıtlı ölçüm` ·
`güç yok`).

**ÖNCELİK KÖPRÜDEN KOPYALANMADI, AYNADI.** `_fwKwEff` köprünün
(`veFeadDutyToCore` → `veFeadAutoKw`) sırasını birebir izliyor: duty kW →
kasnağın kendi `pwrCurve`'ü → `accPreset` kataloğu → 0. Ayrışsaydı sihirbaz bir
sayı gösterir, çözüm başkasıyla koşardı.

**MODEL SEÇMEK KAYITLI kW'ı TEMİZLER** ve bu, isteğin çalışabilmesinin şartı:
`AG00976_GATES_2025`'in gücü **yalnız duty kW'ında** yazılı, yani temizlenmezse
kayıtlı sayı katalogu her zaman yener ve açılır pencere hiçbir şey yapmamış
görünürdü.

**ÖLÇÜLDÜ (alternatör, 880 → 2750 d/dk):**

| kaynak | kW |
|---|---|
| kayıtlı ölçüm (Gates AG00976, 155 A) | 3,61 · 3,78 · … · 4,02 |
| katalog `tepas_350a` seçilince | **7,62 · 9,08 · … · 15,13** |

880 d/dk'da **2,1 kat** — çünkü katalogun en küçük alternatörü **180 A**, raporun
alternatörü 155 A. Seçim kozmetik değil; fark da uydurma değil, katalogun kendi
eğrisi. Katalog **Araç Performans modülüyle ORTAK** (`VE_ALTERNATOR_PRESETS` /
`VE_AC_PRESETS` / `VE_AIRCOMP_PRESETS`) — ikinci bir kopya yok — ve aksesuar
devri her zaman **kasnak pitch çaplarından** hesaplanıyor, preset'in kendi
`driveRatio`'sundan değil (spesifikasyon §2.3'ün *"Excel'in en ciddi hatası elle
yazılmış hız oranlarıydı"* maddesi).

**SESSİZ SIFIR ARANIYOR:** yük taşıyabilecek bir aksesuarın ne modeli ne kayıtlı
ölçümü varsa kart onu **adıyla** listeliyor. Sessiz bırakılsaydı o aksesuar
0 kW ile koşar, gerilmeler tasarım gerginliğine düzleşirdi — bu deponun
belgelenmiş `544·6` sınıfı (bkz. *"KÖK NEDEN: duty kW'ı çözüme HİÇ
ULAŞMIYORDU"*).

Avara ve gergi satırları tabloda **duruyor** (`katalog yok` yazıyor): AG00976'da
onların da kayıtlı 0,01 kW'ı var; satırı gizlemek o ölçümü görünmez yapardı.
Sürücü kasnak listede YOK — gücü diğerlerinin toplamı, elle girilirse çekirdek
zaten reddediyor.

###### 5 · ÖZETTEN KOL AÇISI KALKTI — geriye BEŞ künye kaldı

`Durum · Kasnak · Kayış boyu · Tasarım gerginliği · Dönüş yönü`. Kol açısı
kaldırıldı; sayı kaybolmuyor, 4. adımın kendi kartında ve raporda duruyor.

###### Kapı **on beş mutasyonla** ölçüldü, on beşi de kırmızı

Gergi satırını tablodan düşürme · sürücü radyosunu açma · silme düğmesini açma ·
satırı kasnak merkezine yazdırma · X/Y çipini düşürme · `veFeadWizTenSet`'i
ayrı bir kopyaya yazdırma · etiketi yine anahtarla basma · panelin kendi etiket
kopyasını tutması · `tenPart`'ı yine beyaz listeyle yutma · kodsuz künyede eski
kodu bırakma · katalog önerisi bloğunu geri koyma · duty kW hücresini yine girdi
yapma · `_fwKwEff` önceliğini köprüden ayırma · model seçince kayıtlı kW'ı
bırakma · özete kol açısı künyesini geri koyma.

**ÖLÇÜLDÜ — gerçek tarayıcı (8 E2E):** 2. adımda gergi satırı altıncı sırada,
künye açılır penceresi ve amber çip yerinde, sürücü radyosu ile silme düğmesi
`disabled`; koordinat alanına gerçek klavye girişi **odağı düşürmeden** modele
işliyor ve 4. adımda aynı sayı görünüyor; 6. adımda alternatör modeli seçilince
duty hücreleri katalog sayısına dönüyor ve kaynak sütunu `katalog` yazıyor;
7. adımda beş künye var, `kol açısı` **yok**.

###### KOZMETİK TUR — alt çubuk ve adım rayı (2026-08-31)

Aynı gün iki bildirim daha geldi ve ikisinin de cevabı **ölçümden** çıktı.

**1 · ALT ÇUBUK KENDİ BAŞLIĞINDAN KALINDI.** *"Yeşil ile çizdiğim yer çok geniş
olmuş. Oradaki butonlar falan da çok geniş duruyor… orantısız duruyor."*
Sayı seçilmedi, **modalın kendi üst çubuğundan okundu**:

| | önce | sonra | çıpa |
|---|---:|---:|---|
| alt çubuk | **48 px** | **40 px** | `.ve-settings-header` = **39 px** |
| düğme | 29 px | **25 px** | uygulamanın `.ve-trace-btn`'ü 22 px |
| düğme genişliği | 62 · 67 · 104 | **56 · 61 · 98** | — |
| gövdeye kalan yer | — | **+8 px** | — |

Yani çubuk keyfî olarak küçültülmedi: **aynı diyaloğun iki çubuğu artık aynı
bantta**. Orantısızlığın kaynağı da buydu — alt çubuk üst çubuğundan 9 px
kalındı.

**2 · ADIM RAYI ÜÇ DURUM YAKIYOR.** *"Eksik girdi olduğunda kırmızı, girdiler
tam olduğunda ise belirgin bir yeşil… Şu anda kullanıcı yeteri kadar
bilgilenemiyor."* Eksiklik yapısaldı ve **iki katmanlıydı**:

| Eski davranış | Neden yetersiz |
|---|---|
| Tek işaret **hata rozeti** idi (yalnız hata varken çiziliyor) | *"sorun yok"* ile *"buraya hiç bakılmadı"* AYIRT EDİLEMİYORDU |
| `done` sınıfı **konumu** anlatıyordu (`i < _fwStep`) | Üstünden geçilmiş ama EKSİK bir adım yeşil halkalı görünüyordu — ray **yanlış bilgi** veriyordu |

Durum `veFeadWizStepState(b, step)` ile **tek yerden** üretiliyor ve kaynağı
köprünün kendi listesi (`b.errors` / `b.warnings`); ikinci bir doğrulama
listesi, köprü değişince sessizce eskiyen bir kapı olurdu — sihirbazın kuruluş
kuralının ta kendisi.

**ÜÇ DURUM, İKİ DEĞİL:** bu modülde *"çözülüyor ama uyarı taşıyor"* gerçek ve
sık bir hâl (kalibrasyon dışı çap, türetilemeyen ankraj, kenetlenmiş kol). Onu
yeşile katmak *"her şey tamam"* demek, kırmızıya katmak çözülen bir modeli
bozuk göstermek olurdu.

**İKİ KANAL, ÇAKIŞMADAN** — ve bu bir incelik değil, eski `done`un düştüğü
tuzağın kapatılması:

| Kanal | Ne söylüyor |
|-------|-------------|
| Zemin tinti + kalın başlık + kalın şerit | **HANGİ** adımdayız (`.on`) |
| Renk (sol şerit · numara dairesi · rozet) | O adımın **DURUMU** (`.ve-fw-st-*`) |

Tek kanala bindirilseydi **seçili adımın durumu görünmezdi** — oysa
kullanıcının en çok baktığı adım tam olarak o. Seçili adımda daire *dolar*
(aynı renk, ters kontrast), yani "buradasın" okunurken durum kaybolmuyor.

**ÖLÇÜLDÜ (gerçek tarayıcı, hesaplanmış RENK — sınıf adı değil):**

| durum | Başlangıç | Kasnaklar | Kayış Yolu | Otomatik Gergi | Kayış | Motor | Özet |
|---|---|---|---|---|---|---|---|
| boş sihirbaz | ✓ yeşil | **1 kırmızı** | **1 kırmızı** | **4 kırmızı** | ✓ | ✓ | ✓ |
| AG00976 örneği | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| bir kasnağın çapı silinince | ✓ | **1 amber** | ✓ | ✓ | ✓ | ✓ | ✓ |

Üçüncü satır üç durumun da ayrı ayrı yandığının kanıtı: eksik çap köprüde bir
UYARI (varsayılana düşüyor), hata değil — amber onu doğru anlatıyor.

**Kapı yedi mutasyonla ölçüldü, yedisi de kırmızı:** uyarıyı yeşile katma,
rozeti yalnız hata varken basma, durum sınıfını hiç basmama, konumsal `done`a
geri dönme, CSS'ten `st-ok` kuralını silme, alt çubuk dolgusunu 9 px'e geri
alma, düğme dolgusunu `6px 13px`'e geri alma.

Beşincisi **yalnız E2E'den** görünüyor ve sebebi öğretici: sınıf basılmaya
devam ediyor, yalnız kuralı yok — ray yine sessiz kalıyor. Bu yüzden gerçek
tarayıcı kapısı sınıf ADINA değil **hesaplanmış renge** bakıyor (şerit ile
rozetin aynı renkte olması, kırmızıda R'nin G'den ≥60 baskın olması, yeşilde
tersi).

###### SEKİZ DÜZELTME — ikinci kullanıcı turu (2026-08-31)

Kullanıcı sihirbazı yeniden kullanıp sekiz madde bildirdi. Beşi eksiltme, üçü
düzeltme; ama üçünün altından **birer sessiz kusur** çıktı.

| # | İstek | Ne yapıldı |
|---|-------|------------|
| 1 | *"otomatik gerginin satırında 'elle gir' gibi bir şey var. O olmayacak, orada normal 'Otomatik Gergi' yazacak."* | TİP sütunu **adı** basıyor, künye seçici onun ALTINDA (`.ve-fw-tip-ten`) |
| 2 | *"'Kasnaklar' kısmına 'dönüş yönü' seçmeyi de eklememiz gerekiyor."* | İki durumlu seçici — **durum tutmaz**, sırayı çevirir |
| 3 | *"Uyarılar kısmı… koordinat girmemize rağmen hemen güncellemiyor."* | Canlı yama uyarı kutusunu ve adım rayını da tazeliyor |
| 4 | *"'elle gir' haricinde… değerler değiştirilmemeli"* | Künye seçiliyken parça alanları `readonly` |
| 5 | *"'Bu künyeden çıkanlar' kısmına gerek yok."* | Kart ve onu üreten blok kalktı |
| 6 | *"'Künye' ve 'Malzeme' kısımlarına gerek yok… SADECE VE SADECE kayış boyunu çıktı olarak verecek"* | Üç kart kalktı, `beltDataMode` her zaman `none` |
| 7 | *"aksesuarların tiplerini seçtiğimde değerler hala gelmiyor. Garip bir yapı var"* | İki ayrı kusur — aşağıda |
| 8 | *"girdilerin topolojideki bileşenlere doğru aktarıldığından emin olalım"* | Uçtan uca ölçüldü, kapı kondu |

###### 1 · SİHİRBAZIN GERGİ ADI TEK ÜRETİCİDEN — ve palet adı DEĞİL

Palet adı **"Gergi"** (`componentDefs['fead-tensioner'].name`), sihirbaz ise
baştan beri **"Otomatik Gergi"** diyor: 4. adımın başlığı, kayış yolu listesi
ve kurulan düğümün `customName` yedeği üçü de o. Kullanıcı satırda da onu
istedi; ilk uygulama palet adını basınca gerçek tarayıcıda **"Gergi"** çıktı.

Üretici bu yüzden `_fwTenAd()` ve **dört yüzeyi birden** besliyor. Kapı yalnız
metne bakmıyor: satırın **yer tutucusu ile kurulan düğümün adı AYNI olmak
zorunda** — ad boş bırakıldığında kanvasa yazılacak şey odur.

**AD HÜCRESİ DE DİĞERLERİYLE BİREBİR OLDU** (*"Ad kısmı da diğerleri gibi
olacak"*): oradaki amber çip (`X/Y = montaj noktası`) **silinmedi** —
karıştırmanın ölçülmüş bedeli gerginlikte **−%48,6** — **uyardığı sütuna**,
yani X sütununun altına taşındı. Uyarıyı komşu sütunda tutmak zaten yanlış
yerdeydi.

###### 2 · YÖN SEÇİMİ DURUM TUTMAZ — `fead-spin` kuralının aynısı

Duruma bir `dir` alanı koymak ikinci bir gerçek kaynak yaratırdı ve üç yerden
ısırırdı (3. adımın sıra listesi yalan söyler · kurulan kanvasın gidiş okları
bayrakla çelişir · bayrak silinince yön sessizce döner). Seçim yalnız şunu
yapıyor: **istenen yön bugünkünden farklıysa sırayı çevir.**

**AYNI YÖNÜ SEÇMEK HİÇBİR ŞEY YAPMAZ** — yoksa aynı düğmeye ikinci tık sırayı
geri çevirir ve seçici bir aç/kapa gibi davranırdı.

**ÖLÇÜLDÜ (gerçek tarayıcı, AG00976, düğmeye gerçek tık):** `↺ CCW → ↻ CW`,
`spin +1 → −1`, kayış boyu `1714.608847610321 ↔ 1714.6088476103205` — yani
**13 basamak birebir**. Geometrinin değişmemesi bir yaklaşıklık değil cebirsel
özdeşlik; kapı bunu ölçüyor ki bir gün "yönü çevirmek boyu da değiştirsin"
diye bir düzeltme sessizce girmesin.

**RENK HÜKÜM TAŞIMAZ:** CW ile CCW'nin ikisi de eşit meşru (kanvastaki
`fead-spin` rozetinin kuralı) — seçili olan vurgulanır, öteki nötr kalır.
Yön okunamıyorsa iki düğme de kapalı: hüküm uydurulmuyor.

###### 2b · İKİ SIRA DOLAŞIYORDU — yön seçicisi bunu ORTAYA ÇIKARDI

Yön seçicisi `veFeadWizRouteReverse`'e gidiyor ve o fonksiyonda **ölçülmüş bir
kusur** vardı. Gergi `st.pulleys` dizisinde değil `st.ten`de duruyor;
`'__ten__'` anahtarını sıraya `veFeadWizRoute` **anlık** olarak ekliyor ve
`_fwState.route`'a YAZMIYORDU. Yani iki farklı sıra vardı: **OKUNAN** (gergi
dahil) ve **YAZILAN** (gergi hariç) — taşıma ile çevirme yazılan sırada
çalışıyordu.

| Kusur | Belirti |
|-------|---------|
| Çevirme çevrimi ters yürütmüyor, gerginin halkadaki **YERİNİ** değiştiriyordu | okunan sıra `p1>p2>p3>p4>p5>__ten__` → `p1>p5>p4>p3>p2>__ten__`, gergi **SONDA kaldı** |
| `veFeadWizRouteMove('__ten__', ±1)` `indexOf < 0` ile **erken dönüyordu** | 3. adımdaki gerginin ok düğmeleri etkin görünüp hiçbir şey yapmıyordu |

**ÖLÇÜLDÜ** (AG00976, elle kurulmuş — yani sırasında `'__ten__'` olmayan
model): kayış boyu `1714,61 → 2459,29 mm` (+%43,4), gerginlik
`543,85 → 323,41 N` (−%40,5). Model **yine "çözülüyor"**du; kapanma ve
temizlik ihlalleri hoşgörülü kipte UYARI olarak düşüyor, hata olarak değil.

Örnek kurucusundan gelen modellerde sıra `'__ten__'` taşıdığı için bu kusur
**görünmüyordu** — yalnız kullanıcının elle kurduğu modelde ısırıyordu.

Çözüm iki sırayı **birleştirmek**: iki işlem de OKUNAN sırayı alıp geri
yazıyor. `veFeadWizRoute` yalnız eksikse eklediği için bu yazma **birim
işlemdir** ve seedlenmiş durumu değiştirmiyor (testli). Düzeltmeden sonra
elle kurulmuş modelde de `L` ve `T` **6 hane birebir** sabit, `warnings` boş.

> **BİR İDDİA ÖLÇÜLDÜ VE ÇÜRÜTÜLDÜ.** Aynı turda *"sihirbaz `veFeadAnalyze`'ı
> hiç çağırmadığı için ters yönde gerilme zinciri çöküyor ama yedi adım da
> yeşil kalıyor"* diye bir bulgu çıktı. Ölçüldü: iki örnek × iki yön =
> **dört kombinasyonun dördünde de** `tensionerSide` `{ok:true}` ve
> `build.warnings` boş. Yani bastırılan bir hüküm YOK. Sihirbaz `veFeadAnalyze`'ı
> gerçekten çağırmıyor ve bu bilinçli: çağrı başına 5–13 ms, canlı yolun
> bütçesi ise 6 ms (zarfın genel taraması zaten 84 ms olduğu için memo var).
> Gergi tarafı hükmü kurulmuş modelde Kayış Yolu kartından ve Çözücü
> panelinden veriliyor; sihirbaz yalnız kuralı **yazıyor** ("otomatik gergi
> kayışın gevşek tarafında olmalıdır — 14 Gates sisteminin 14'ünde de öyle").

###### 4 · KİLİT `readonly`, `disabled` DEĞİL

Kullanıcı *"değerler değiştirilmemeli"* dedi, *"görünmesin"* değil. `disabled`
bir alan gri boşluk gibi okunur ve içindeki SAYI kaybolmuş görünür; `readonly`
sayıyı okunur bırakıp yalnız yazmayı reddediyor.

**İSTEĞİN İKİNCİ YARISI BEDAVA** (*"'elle gir'e tıklayınca önceki seçtiği
gergi değerleri gelmeli"*): "elle gir" künyeyi UYGULAMIYOR, yalnız `tenLib`i
boşaltıyor — son seçilen künyenin yazdığı sayılar olduğu gibi kalıyor.
Alanları temizlemek isteğin tam tersi olurdu ve mutasyonla kilitlendi.

**KİLİTLENEN KÜME `veFeadTensionerApply`'ın YAZDIĞI kümedir**, ikinci bir liste
değil: künye bir alan daha yazmaya başlarsa o alan sessizce açık kalmasın.
**MONTAJ KONUMU ASLA KİLİTLENMEZ** — motorun verisi, parçanın değil.

**ÖLÇÜLDÜ (gerçek tarayıcı):** künye yokken kilitli alan **0**; `AG00879`
seçilince **6** ve `armLen` `56` **readonly**, `pivotX` readonly DEĞİL;
"elle gir" seçilince kilit **0** ve `armLen` yine **56**.

###### 6 · KAYIŞ ADIMI TEK ÇIKTI — ama SORULMAYAN ≠ TAŞINMAYAN

| Kalkan | Neden |
|--------|-------|
| Künye (tip/kod · tolerans · aşınma) | üçü de kayış SEÇİLDİKTEN sonra anlamlı; Kayış Özellikleri panelinde aynen duruyor |
| Malzeme (kaburga başına kütle) | yalnız açıklık frekansı için — o da kayış tipine bağlı bir çıktı, yani zaten kapalı |
| "Kayış Tipine Bağlı Çıktılar" seçicisi | iki seçenekli bir kip DEĞİL artık: kayış boyu tek çıktı, katalog sabitleri KAPALI |

`veFeadWizNodes` artık **koşulsuz** `beltDataMode: 'none'` yazıyor: seçenek
sunulmuyorsa kurulan model kipi açık bırakamaz (eski bir taslakta `full`
yazılı kalmışsa sessizce taşınırdı).

**VERİ KAYBOLMUYOR ve bu ayrı bir kapı:** örnekten gelen `beltType` ·
`tolerance` · `wearPct` · `massPerRibKgM` kayış düğümüne **taşınmaya devam
ediyor** — kullanıcının *"otomatik olarak gelsin"* isteği tam olarak bu.
Sorulmayan alan ile taşınmayan alan ayrı şeyler; ikincisi kullanıcının
verisini sessizce yutardı.

###### 7 · İKİ SESSİZ KUSUR — biri hizada, biri kapıda

**(a) SÜTUNLAR KAYIYORDU** ve sebebi tek bir CSS satırıydı: `.ve-fw-ro`
sınıfı `display:inline-block` taşıyordu ve sınıf hem `<span>` hem `<td>`
üzerinde kullanılıyor. Bir `<td>`'yi `inline-block` yapmak onu tablo
düzeninden **ÇIKARIR** — tarayıcı anonim hücre kurar, sütunlar çöker.
**ÖLÇÜLDÜ** (çalışma çevrimi tablosu, 7 sütun): başlık genişlikleri
`196·196·196·69·113·88·14` iken gövde `196·196·196·14·14·14·113` çıkıyor, yani
üç kW hücresi tek sütuna sıkışıyor ve satır silme ✕'i **"Klima Kompresörü"
başlığının altına** düşüyordu. Kullanıcının bildirdiği *"Klima kompresörü
sütununun altında satırları silen çarpılar"* tam olarak buydu. `display`
kuralı `span.ve-fw-ro`'ya daraltıldı; ölçüldü, sekiz sütunun sekizinde de
başlık↔gövde farkı **≤1 px**.

**(b) GÜÇ KAPISI YANLIŞ KAPIYDI.** `_fwKwEff` çözülmüş bir `sys` istiyordu,
yani **bütün koordinatlar girilmeden** aksesuar modeli seçmek tabloyu
değiştirmiyordu. Oysa aksesuar devri geometriye BAĞLI DEĞİL — çekirdeğin kendi
tanımı:

```
oran(i) = driveRatio · rPitch(sürücü) / rPitch(i)
```

Üç sayının üçü de ÇAPTAN ve kayış profilinden geliyor; teğet noktası, sarım
açısı, kol açısı hiçbiri girmiyor.

Köprüye `veFeadRatioSys` girdi: **oran için yeterli, geometri için yetersiz**
bir sistem. `FEADCore.accessoryRpm`'in okuduğu ÜÇ alanı taşır (`driveRatio` ·
`pulleys[i].rPitch` · `_crkIdx`) ve başka hiçbir şeyi. **FİZİK
KOPYALANMIYOR:** yarıçapı çekirdeğin kendi `beltProps` + `radiiFromOD`'si
veriyor, devri yine çekirdeğin `accessoryRpm`'i okuyor. Çap ya da profil
eksikse `null` döner — uydurulmuş bir yarıçap, uydurulmuş bir devir ve
uydurulmuş bir kW demekti.

**`out.sys` VARSA `ratioSys` ONA EŞİTLENİR:** çözülmüş model tek bir gerçek
kaynak taşımalı, yoksa iki yol sessizce ayrışırdı.

**PANEL DE AYNI YOLDAN GEÇİYOR** (`veFeadDutyEditor`): kapı orada da
`build.ok` idi ve yarım modelde tabloda **hiç kW sütunu** olmuyordu.

**İKİ "değer yok" TEK ETİKETE KATILMAZ:** oran kurulamıyorsa `cozumsuz`, oran
kurulu ama katalog/eğri yoksa `yok` — ikincisi gerçekten 0 kW ile koşacağını
söylüyor.

**ÖLÇÜLDÜ:** koordinatsız iki kasnaklı modelde `prestolite_180a` seçilince
`1000 d/dk → 5.79 kW` (model çözülmüyor, `b.ok === false`); gerçek tarayıcıda
klima modeli seçilince duty okuması `2.70 → 1.74 kW`.

###### 8 · GİRDİLER TOPOLOJİYE ULAŞIYOR — uçtan uca ölçüldü

Kullanıcı *"aksesuar tiplerini seçtikten sonra, topoloji üzerindeki bileşen
üzerinden bu aksesuarın tipini vs göreyim"* dedi. Zincir gerçek `createNode`
sözleşmesiyle koşturuldu: **10 bileşen · 6 tel**, `accPreset` düğüme yazılıyor
**ve bileşenin kendi panelindeki "Katalog Modeli" kartında `selected`
görünüyor**; gergi TEK koordinat taşıyor (`cenX/cenY` **yok**); duty kW
sözlüğü `wz-*` → kanvas kimliğine göçüyor (kalıntı bir anahtar SESSİZ 0 kW
demekti); kurulan modelin çözümü önizlemeyle **birebir** (`L` ve `T` 6 hane).

Çevrim kaydının izi (`dutyLib`) de artık taşınıyor — hesaba girmiyor, ama
kullanıcının hangi ölçülmüş kaydı seçtiğini söyleyen tek yer o
(`structural-materials.js`'in `lib`/`libVer` izinin aynı gerekçesi).

Kapı **27 mutasyonla** ölçüldü, 27'si de kırmızı: yön seçimini bayrağa çevirme ·
aynı yönü seçmeyi de çevirtme · 2. adımın yön kartını düşürme · yön
okunamazken düğmeleri açma · CW'yi amber yapma · satırda tipi yine künye
seçicisi yapma · ad yer tutucusunu sabitleme · kilidi kaldırma · "elle gir"e
değerleri sildirme · montaj konumunu da kilitleme · kayış kipini yine seçim
yapma · Künye kartını geri koyma · kayış künyesini düğüme taşımama · kW'ı yine
`build.ok`'a bağlama · `ratioSys`i hiç kurmama · `ratioSys`i çözülmüş
sistemden ayırma · bilinmeyen profilde yarıçap uydurma · `accPreset`i düğüme
taşımama · üç CSS sınıfını tek tek düşürme · çevirmeyi ve taşımayı yine HAM
sıraya bağlama · çevirmede ilk ögeyi de çevirme · çipi AD hücresinde bırakma ·
çipi tamamen silme · gergi adını palet adına döndürme.

###### BEŞ DÜZELTME — üçüncü kullanıcı turu (2026-08-31)

Kozmetik istekler; ama ikisinin altından **ölçülmüş birer kusur** çıktı ve
biri de bu turda üretilmiş bayat bir CSS kuralıydı.

| # | İstek | Ne yapıldı |
|---|-------|------------|
| 1 | *"'örnekten doldur'… seçtiğimiz seçeneğin belirgin olmasını istiyorum"* | Yüklenen kart **gölge + sol şerit + "✓ yüklendi"** |
| 2 | *"'otomatik gergi' olmamış… diğerleri gibi yapalım… 'X/Y = montaj noktası' gibi garip belirteçlere gerek yok"* | Künye seçicisi 4. adıma taşındı, çip kalktı, satır diğerleriyle **birebir** |
| 3 | *"'kayış yolu' kısmında CCW ve CW butonlarına gerek yok"* | Kalktı; "⇄ Yönü çevir" ve canlı şeritteki yön okuması duruyor |
| 4 | *"alternatör tiplerini seçtiğimde tablo… yana çekiliyor"* | Sabit sütun düzeni |
| 5 | *"'çevrim' seçtiğim zaman sayfa en tepeye atıyor"* | Kaydırma konumu aynı adımda korunuyor |

###### 1 · KART "YÜKLENDİ" DER, "SEÇİLİ" DEMEZ

Kart bir seçim kutusu değil bir **EYLEM** düğmesi: formu dolduruyor ve
kullanıcı sonra her alanı değiştirebiliyor. *"Seçili"* demek formun hâlâ o
örneğe EŞİT olduğunu iddia etmek olurdu — kütüphane bunu bilmiyor (duty
seçicisindeki *"özel"* okumasının aynı gerekçesi).

**RENK YERİNE GÖLGE + ŞERİT:** üç kart da eşit meşru, dolu bir vurgu rengi
birini *"birincil eylem"* gibi gösterirdi. İz `st.seededFrom`'da ve **çözüme
girmiyor** — düğüm verisinde hiçbir yerde geçmiyor (testli). *"Boş başla"* da
bir seçimdir ve işaretleniyor.

###### 2 · SATIR DİĞERLERİYLE BİREBİR — ve bilgi KAYBOLMADI

Künye seçicisi satırdan kalktı, 4. adımda AYNEN duruyor: aynı kaydı yazan bir
kontrolü iki yüzeyde birden sunmanın karşılığı yoktu. Amber çip de kalktı.

**AMA UYARI KALDIRILMADI, YER DEĞİŞTİRDİ.** Kasnak merkezi ↔ montaj noktası
karışması bu modülün en pahalı sessiz hatası (gerginlik **−%48,6**, sarım en
kötü **+%27,9**, model YİNE çözülür ve uyarı çıkmaz). Bilgi iki yerde:
X/Y alanlarının kendi `title` ipucunda ve tablonun altındaki kartta, ölçülmüş
bedeliyle birlikte. Kapı ikisini birden arıyor — yoksa bir gün
*"sadeleştirme"* diye tamamen silinirdi.

**ÖLÇÜLDÜ (gerçek tarayıcı):** satırın sütun hizası tutuyor ve **yükseklik
farkı 0 px** — iki katmanlı tip hücresi + çip satırı şişiriyordu.

###### 4 · SÜTUNLAR İÇERİKTEN DEĞİL ORANDAN

**ÖLÇÜLDÜ:** aksesuar modeli seçilince açılır listenin genişliği
**362 → 283 px**. Sebep `table-layout` varsayılanının **auto** olması:
*"Güç kaynağı"* hücresi `kayıtlı ölçüm` iken kısa, `katalog modeli · Valeo
TM31` iken uzun ve aradaki farkı Model sütunundan çalıyor. Tablo bir seçimle
yeniden bölüşüyordu — kullanıcının gördüğü *"yana çekilme"* buydu.

`table-layout:fixed` + oranlı `colgroup` bunu yapısal olarak kapatıyor.
Açılır listenin kendi `min-width`'i sabit düzeni ezeceği için sıfırlanıyor.
**ÖLÇÜLDÜ (sonra):** başlık genişlikleri `297·314·262` ve açılır liste
`306 px` — seçimden önce ve sonra **birebir aynı**.

###### 5 · KAYDIRMA AYNI ADIMDA KORUNUR, ADIM DEĞİŞİNCE SIFIRLANIR

`veFeadWizRender` içindeki `body.scrollTop = 0` **KOŞULSUZDU**. O satır adım
değişiminde doğru — yeni adım baştan okunur — ama aynı adımı yerinde yeniden
çizerken (çevrim seçmek, aksesuar modeli seçmek, temas tarafını değiştirmek)
kullanıcıyı bulunduğu yerden koparıyordu. **ÖLÇÜLDÜ:** `scrollTop` 900 → **0**;
düzeltmeden sonra gerçek tarayıcıda **548 → 548**, adım değişiminde **0**.

**KONUM SAKLANMIYOR, OKUNUYOR.** İlk yazımda adım başına bir bellek
(`_fwScroll`) tutuluyordu ve mutasyon onu **yeşil geçirdi**: yazılıyor, hiçbir
yerden okunmuyordu — bu deponun kendi adıyla andığı **ölü veri** sınıfı.
Gövde elemanı yeniden çizimler arasında aynı kaldığı için `scrollTop`'u
kendisi taşıyor. **Kırpma şart:** içerik kısaldıysa (satır silindi, kart
kalktı) eski konum artık yok ve tarayıcı sessizce dibe yapıştırır.

###### AYNI TURDA ÇIKAN BAYAT KURAL

`.ve-fw-tip-ten` **iki kez** tanımlıydı: bir önceki turun iki katmanlı hücresi
için yazılmış `display:flex` kuralı, satır düz metne dönünce geride kalmıştı.
Aynı sınıfa iki farklı düzen dayatan bir kural sessiz kalır — hücre hizasız
görünür, hata çıkmaz. Kullanılmayan `.ve-fw-sub` ile birlikte silindi ve kapı
artık kuralın **tek kez** tanımlı olmasını arıyor.

Kapı **20 mutasyonla** ölçüldü, 20'si de kırmızı: kaydırmayı yine koşulsuz
sıfırlama, adım değişiminde konumu koruma, kırpmayı kaldırma, seçili kart
işaretini düşürme, işareti her karta verme, seed izini yazmama, "Boş başla"
izini yazmama, izi düğüm verisine sızdırma, sabit tablo düzenini kaldırma,
colgroup oranlarını 100'den kaydırma, satıra künye seçicisini geri koyma,
X/Y ipucunu düşürme, kart ipucundan ölçülmüş bedeli silme, Kayış Yolu'na
CCW/CW'yi geri koyma, beş CSS kuralını tek tek düşürme.

###### DOKUZ DÜZELTME — dördüncü kullanıcı turu (2026-09-01)

| # | İstek | Ne yapıldı |
|---|-------|------------|
| 1 | *"'otomatik gergi' kısmı diğer satırlar gibi olmamış"* | Satır biçimi birebir aynı; **zorunluluk üst karta**, renk konturuna taşındı |
| 2 | *"kasnakları tutup yukarı, aşağı çekelim"* | Satır başına ↑ ↓ — **tablo düzeni, kayış yolu DEĞİL** |
| 3 | *"Virgülü de tanısın"* | Sayı alanları `type="number"` olmaktan çıktı |
| 4 | *"gergileri tekrardan kalibre edelim… 56mm gergiler de var"* | Veri DOĞRU çıktı; kusur **etiketteydi** |
| 5 | *"ufak bir koordinat düzlemi… fareyle açı tayin edecek"* | Açı seçici penceresi |
| 6 | *"oran sadece kasnak çaplarından türeyecek"* | Kip seçicisi ve oran alanı kalktı |
| 7 | *"motor devirleri RPM olarak görünsün"* | `d/dk` → `RPM` |
| 8 | *"alternatör ve kompresör seçenekleri eksik gibi duruyor"* | İki katalog **tek seçicide birleşti** |
| 9 | *"Mutlak değil, nispi bir açı değeri tanımı olsun"* | Kol yönü işaretli ve merkezden pivota |

###### 3 · VİRGÜL OKUYUCUDA DEĞİL ALANDA TAKILIYORDU

`_fwNum` virgülü **zaten** çeviriyordu. Kusur `<input type="number">`'daydı:
tarayıcı belgesi ondalık ayırıcı olarak yalnız noktayı kabul ediyor, virgül
yazılınca alan GEÇERSİZ oluyor ve `input.value` **boş string** dönüyor. Yani
program virgülü tanımıyor değildi, virgülü hiç **görmüyordu**.

Alanlar `type="text" inputmode="decimal"` oldu (telefonda sayı tuş takımı yine
açılıyor). Ok tuşlarıyla artırma gitti — kabul edilen bedel, çünkü virgül
yazamamak bir sayının HİÇ girilememesi demekti.

###### 4 · KÜTÜPHANE DOĞRU, ETİKET EKSİKTİ

Arşivdeki **on raporun onu da** kapıdan geçiyor: dokuzu 90 mm, biri (AG00879 ·
T38665) 56 mm ve kayıtlar birebir öyle. *"Bir sürü 90 mm"* bir veri hatası
değil, **arşivin kendisi**.

Kusur şuydu: on dört kaydın on üçü *"kol 90 mm · … Nm"* diye okunuyor ve on
dört ayrı gergi varmış gibi görünüyordu. Oysa **dört parça** var — E9843 altı
sistemde, T38624 ikisinde, T38519 ve T38665 birer — ve kayıtları ayıran şey
parça değil **montaj ayarı** (yay çalışma momenti). Etiket artık parça
numarasıyla başlıyor; doğrulanamayan dört AG00976 kaydı `?` taşıyor.

###### 8 · SEÇENEKLER EKSİK DEĞİL, GÖRÜNMÜYORDU

İki katalog vardı ve **aynı aksesuarın modeli iki ayrı kartta seçiliyordu**:

| Katalog | Alternatör | Klima | Nerede sunuluyordu |
|---|---:|---:|---|
| Araç Performans (`veFeadPresetLib`) | 2 | 2 | "Aksesuar Modelleri" |
| BMC defteri (`veFeadAccList`) | **10** | **4** | "Aksesuar Devir Sınırları" |

Tek seçici kaldı ve listesi **birleşim**; değer ön ekli (`bmc:` / `ap:`) çünkü
iki katalog ayrı anahtar uzayları kullanıyor. Sınır kartı artık künyeyi
**okuyor**, seçmiyor.

**AYNI TURDA ÇIKAN SESSİZ KUSUR:** BMC künyesinden başka bir katalog modeline
geçince güç **hâlâ eski künyenin eğrisinden** geliyordu — öncelik
`duty kW > düğümün kendi eğrisi > katalog` ve künyenin yazdığı eğri "düğümün
kendi eğrisi" sayılıyor. `veFeadAccUnlink` bilerek alanları bırakıyor (o yol
*"elle gir"*dir), o yüzden ayrı bir üretici kondu: `veFeadAccClearWritten`
yalnız künyenin yazdığıyla **hâlâ birebir aynı** olan alanı siliyor —
kullanıcının elle değiştirdiği tek bir sayı varsa tablo korunuyor.

###### 5 + 9 · KOL YÖNÜ: NİSPİ DİL VE GÖRSEL SEÇİCİ

İki ayrı şey karışıyordu. **Saklanan** `armMeanDeg` kolun yönü, *pivottan
avara merkezine*, 0–360 mutlak (Gates çizimi böyle yazıyor) — çekirdek, rapor
ve doğrulama kümesi buna dayanıyor ve **değişmedi**. **Gösterilen** ise ters
yön: kullanıcının elinde avara merkezi var ve pivotun ona göre nerede olduğunu
seçiyor. Mutlak 344° bu yüzden *"parçanın solunda bir sıfır ekseni"* gibi
okunuyordu.

Gösterim artık **işaretli** ve (−180, +180]: 344 → **164**. Aralık kozmetik
değil — 0–360'ta küçük bir negatif dönme 359 gibi görünür. Çevirici tek yerde
(`veFeadArmShownDeg` / `veFeadArmFromShown`) ve **panel de aynı çeviriden
geçiyor**; ikinci bir çevirici iki yüzeyin sessizce ayrışması demekti.

Seçici penceresi avara merkezini orijin alıp yön gülünün dilini konuşuyor
(0 sağda, CCW artı) ve **montaj konumunu canlı okutuyor** — kullanıcının
*"muhtemel bir pivot noktası belirlemiş olacak"* dediği şey bu. Çözülmüş model
İSTEMİYOR: kullanıcı açıyı tam da model yarımken arıyor.

**NEDEN GÜVENLİ:** kol yönü, avara merkezi girildikten sonra kalan tek
serbestlik derecesi ve kayış yolunu hiç değiştirmiyor (ölçüldü: 6 sistem × 548
açı, en büyük fark 4,55e−13 mm). Doğru cevabı hesap veremez; bir paketleme
kararıdır.

**ÖLÇÜLDÜ (gerçek tarayıcı):** fare merkezin sağında → `0,09°`; tık kutuyu
`90,61°` ile dolduruyor; "Uygula" `−30` yazınca saklanan alan `150` oluyor ve
alan `−30` gösteriyor. **Aynı turda çıkan kusur:** "Uygula" yazıyor ama
pencere KAPANMIYORDU — `veFeadWizRender` kaplamanın durumunu izlemiyordu;
artık her çizimde izliyor.

Kapı **27 mutasyonla** ölçüldü, 27'si de kırmızı. Bir mutasyon önce yeşil
geçti (*"Uygula'yı yazmadan kapat"*) ve kapının **totolojik** olduğunu ortaya
çıkardı: seçilen açı örneğin zaten taşıdığı 344° ile aynıydı.

**Sırada:** kullanıcı kayışı seçtikten sonra katalog sonuçlarını geri almanın
akışı (bugün Kayış Özellikleri panelinden elle yapılıyor); ve zarf çözümünün
Sonuçlar sayfasında kanal olarak yayını.



**Sırada:** Sonuçlar sayfasında FEAD çözüm sekmesi (kanal yayını).

