# FEAD — çalışma çevrimi, ankraj türetimi ve örnekler

> Kök `CLAUDE.md`'den taşındı. Metin birebir korunmuştur.

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

| hipotez | sarım | T | Gates 543,9 N'a |
|---|---|---|---|
| koordinat = kasnak · θ=**344°** (parça çizimi) | 33,0° | **532,1 N** | **−%2,2** |
| koordinat = kasnak · θ=348° (Gates'in kol açısı) | 33,0° | 561,1 N | +%3,2 |
| koordinat = **PİVOT** | — | **ÇÖZÜLMÜYOR** | — |

Üçüncüsü koordinatın pivot **olmadığını** kesin olarak eliyor ve elemeyi bir
sayı değil **geometri** yapıyor: kasnak sürücünün içine düşüyor (merkez
mesafesi 111,6 mm, gereken >120,8 mm), teğet hiç çözülemiyor. Birincisi ise
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
arasında **11,5 mm** var. Duyarlılığı da ölçülü: aynı kasnak merkezinde kol
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


**Sırada:** Sonuçlar sayfasında FEAD çözüm sekmesi (kanal yayını).

