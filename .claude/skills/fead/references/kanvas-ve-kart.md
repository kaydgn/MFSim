# FEAD — kanvas, bağlantı görünüşü ve Kayış Yolu kartı

> Kök `CLAUDE.md`'den taşındı. Metin birebir korunmuştur.
> Emekli `fead-graph` yönü `emekli-yonler.md` dosyasına alındı.

#### Kayış BAĞLANTISININ görünüşü — düğüme dokunmadan

**Kasnak kutusu MFSim'in klasik dörtgeni olarak kalır.** Bir denemede kasnaklar
gerçek çapına ölçekli DAİREYE çevrilmiş ve düğümler mm koordinatlarına
dizilmişti; iki sonuç da istenmedi (kutu kimliği kayboldu, topoloji kanvastaki
Kayış Yolu kartının kopyasına döndü) ve **tamamen geri alındı**. Değişen tek
şey TEL:

| Ne | Nerede | Neden |
|----|--------|-------|
| Port KOMŞUYA BAKAN kenardan çıkar | `veFeadPortSideFor` (cp-fead.js) → `defaultPortSide` (components.js) | Klasik kural (giriş solda / çıkış sağda) bir ÇEVRİMDE yolun yarısında ters düşüyor: kayış sağdan sola dönerken tel düğümün ÜSTÜNDEN geri geçiyordu |
| Kontrol kolu uzunluğun **%42**'si (26–96 px) | `connections.js` `curve` dalı, yalnız kayış bağlantısında | Sabit 40 px kısa açıklıkta kutunun dibinde kıvrım, uzun açıklıkta ortada köşelenme veriyordu |
| Amber, 2.5 px | `.ve-connection-fead-belt` | Bu tel "iki bileşen ilişkili" demiyor, "kayış buradan geçiyor" diyor |
| Telin ortasında **gidiş yönü oku** | `veConnDirMark` (connections.js), `.ve-conn-dir` | Aynı halka iki yönde de gezilebilir ve **hangi açıklığın GERGİN olduğu buna göre değişir**; yön topolojiden okunamıyordu |

##### Port DAİRESİ de aynı karede tazelenir (`veSyncPortDom`)

Kenar kuralı `defaultPortSide`'ı **dinamik** yaptı: cevap artık komşunun nerede
olduğuna bakıyor, yani **bir bağlantı kurulunca ya da düğüm sürüklenince
değişiyor**. Telin ucu bunu görüyordu (`getPortPosition` her tazelemede yeniden
hesaplıyor); port DAİRESİ görmüyordu — DOM'a yazan iki yol (`ui-core.js`
`createNode`, `state.js` `restoreState`) yalnız `def.portLayout ||
node.data.portPositions` varsa yazıyor, FEAD kasnağında **ikisi de yok**. Daire,
düğüm kurulurken hesaplanan klasik kenarda (giriş solda / çıkış sağda) çakılı
kalıyordu.

**ÖLÇÜLDÜ (gerçek tarayıcı, elle bağlanan 5 kasnaklı halka):** on uçtan altısı
`36.8 · 42.4 · 48.8 · 54 · 72 px` sapmıştı — yalnız komşusu tesadüfen sağda
kaldığı için klasik kuralla çakışan iki uç 0'daydı. Kullanıcının bildirdiği
"bağlantı portları denk gelmiyor" tam olarak buydu. Düzeltmeden sonra on ucun
onu da **0.00 px**; sürükledikten sonra da, elle taşınmış bir portta da 0.

Tazeleme **TEK NOKTADAN**: `updateAllConnections` (connections.js) her
mutasyondan zaten geçiyor (35 çağrı yeri) ve daire ile tel aynı saf fonksiyondan
(`vePortBoxStyle` / `vePortOffset`) besleniyor. Klasik topolojilerde kenar hiç
değişmediği için tek bir DOM yazması bile olmuyor (ölçüldü: 17 düğüm / 12
bağlantılı Araç Performans örneğinde bütün kenarlar left/right, bütün sapmalar
0). Beş mutasyonla ölçüldü — çağrıyı kaldırma, `portPositions`'ı yok sayma,
yalnız `left` yazma, kenarlık+yarıçap düzeltmesini atlama, değişmese de yazma —
beşi de kırmızı.

**Hesaplara dokunmuyor.** Çözücü mm koordinatlarını panelden okuyor, kanvas
yerleşiminden değil. Ölçüldü: AG00686 **karışık sırayla** elle bağlanınca
(ortadaki telden başlayarak) kayış sırası yine `CRK→IDR→A_C→TEN`, sarım
`210.2 · 26.7 · 202.9 · 26.4`, span `249.2 · 212.6 · 248.9 · 212.6`, Mean kol
açısı `33.1°` — hepsi Gates raporuyla birebir.

##### Port kenarı, yön oku ve araç şeritleri (eski `veFeadArrangeRing` bölümü)

> **HALKA DÜZENİ EMEKLİ.** Bu bölüm "Otomatik Düzenle FEAD'de HALKA kurar"
> başlığıyla yazılmıştı ve halka **konum hiçbir şey ifade etmezken** doğruydu.
> Kanvas kayış düzlemi olduktan sonra halkaya dizmek kullanıcının girdiği bütün
> mm koordinatlarını silmek olurdu; yerini `veFeadArrangeByCoords` aldı (bkz.
> *"KANVAS = KAYIŞ DÜZLEMİ"*). Aşağıdaki halka gerekçesi, aynı yön yeniden
> denenirse nelerin ölçülmüş olduğunu bilmek için duruyor; **port kenarı, yön
> oku ve araç şeritleri** ise bugün de geçerli ve halkadan bağımsız.

Genel yerleştirici (`tidy-layout.js`) katmanlı bir **DAG** düzeni kuruyor:
kenarları soldan sağa sıralı katmanlara bölüyor. FEAD ise kapalı bir **ÇEVRİM** —
katmanlama onu keyfî bir yerden kırıp dönüş telini bütün kümenin üstünden
geçiriyor. **ÖLÇÜLDÜ (BMC örneği, 6 kasnak):** örnek kurulduğunda kesişen tel
çifti 0; "Otomatik Düzenle" sonrası altı kasnak tek bir YATAY sıraya diziliyor ve
`Sürücü Kasnak → Avara 1` dönüş teli hepsinin üstünden geri geçerek 1 kesişim
üretiyordu.

Halka düzeninde kesişim **yapısal olarak** sıfır: kasnaklar kayış sırasında
çember üzerine dizilince her tel yalnız komşusuna gidiyor (ölçüldü: 0). Sürücü
tepede, sıra saat yönünde. Yarıçap kutu köşegeninden **türer** (kiriş
`2R·sin(π/N)`) — sabit yarıçap N büyüdükçe kutuları üst üste bindirirdi. Araç
düğümleri halkanın DIŞINDA: künyeler sol, Kayış Yolu kartı sağ
şeritte — `veFeadLoadExample` ile aynı bölüşüm, yoksa kart halkanın içine düşüp
tellerin altında kalırdı.

**Kutu, sembol ve ölçü DEĞİŞMİYOR** — yalnız konum. mm koordinatı
KULLANILMIYOR: o, kanvastaki Kayış Yolu kartının işi.

Kenar seçimi kutunun **ORANINA** göre (`|dx|·h ≥ |dy|·w`), sabit 45° köşegenle
değil — 72×66'lık krank ile 54×50'lik avarada fark ediyor. Ve bu bir
**VARSAYILAN**: kullanıcı bir portu sağ tıkla taşıdıysa (`node.data.portPositions`)
onun seçimi kazanmaya devam eder.

Yön oku eğride **Bézier'in t = 0.5 noktasından** çıkar
(`B(0.5) = (P0 + 3C1 + 3C2 + P3)/8`); "iki ucun ortası" kontrol kolları eğriyi
bir yana çektiği için telin üstünden kayardı. 46 px'den kısa açıklıkta ok hiç
çizilmez. Dört mutasyonla ölçüldü (Bézier ortası → uç ortası, eşiği kaldırma,
oran → 45°, giriş/çıkış komşusunu takas): dördü de kırmızı.

Örnek yüklenirken araç düğümleri (Kayış Özellikleri · Çözücü · Başlangıç ve
Örnekler · Rapor) **sol şeride** alınır — eskiden kümenin üstüne diziliyorlardı
ve alt topoloji açılışında konan "Başlangıç ve Örnekler" kutusu tam kayış
yolunun üstüne düşüyordu (Klima ↔ Avara 1 açıklığı oradan geçiyor). Bu bölüşüm
**korundu** ama artık kurucunun kendi işi değil: `veFeadArrangeByCoords` bütün
araç düğümlerini kümenin dışındaki iki şeride koyuyor ve örnek kurucusu ona
devrediyor (bkz. *"örnek kurucusu kutuyu koordinatın SÖYLEMEDİĞİ yere
koyuyordu"*).

#### ÇİZİMLER ÖN GÖRÜNÜŞ — veri Gates düzleminde KALIR (2026-08-28)

Kullanıcı kararı: *"MFSim için de kayışın dönüş yönünü default olarak saat
yönünde yapacağız."*

**ÖLÇÜLDÜ** (`docs/gates-reports/README.md` → *"Dönüş yönü konvansiyonu"*): on
Gates raporunun ONUNDA DA kayış, raporun kendi çizim düzleminde **CCW**
dolanıyor (`Σ işaretli sarım = +360`, hiç `−360` yok). Motorlar ön taraftan
bakıldığında CW döndüğü için o düzlem **ön görünüşün AYNASI** gibi davranıyor.

**YALNIZ ÇİZİM AYNALANIR.** Saklanan mm, çözücü ve bütün sayısal çıktılar Gates
düzleminde kalır — arşivle satır satır karşılaştırılabilirlik bu modülün en
değerli özelliği ve bir görünüm tercihi için feda edilmez. Aynalama **X**
ekseninde: karşı taraftan bakınca sol-sağ yer değiştirir, YUKARI yukarı kalır.

| Ne | Nerede |
|----|--------|
| Bayrak | `VE_FEAD_VIEW_FRONT` (varsayılan `true`) · `js/fead-model.js` |
| Aynalama | `veFeadMirrorGeomX(geom)` — DOM'suz, SAF (girdiyi değiştirmez) |
| Bağlandığı TEK nokta | `veFeadLayoutSVG` → `geomAt()` |

**TEK NOKTA ŞART:** çizimin okuduğu her geometri (ana konum + hayalet konumlar)
oradan geçiyor, dolayısıyla sarım yayları · kaburga dişleri · dönüş okları · kol
çizimi birlikte dönüyor. Yirmi ayrı yere serpiştirmek, biri unutulduğunda yalnız
O ögenin ters kalması demekti. Pivot ayrıca çevriliyor (`build.sys`'ten okunuyor,
geometriden değil).

**`d` İŞARETİ DE ÇEVRİLİR.** Aynalama el yönünü ters çevirir; `d` çevrilmezse
sarım yayları kasnağın İÇİNDEN geçer — kartta bir kez ölçülmüş *"sweep
bayrağı"* hatasının aynı sınıfı. Aynalama **tam simetri**: `L_eff`, sarımlar,
gerginlikler BİREBİR aynı kalır (testli).

**YÖN GÜLÜ DE TAKİP EDER.** Aynalı çizimde veri düzleminin `0°`'si ekranda
**SOLA** bakar; gül eski yerinde bırakılsaydı resim aynalı, açı okuması aynalı
DEĞİL olurdu — kullanıcı `0°`'yi yanlış tarafta arardı. Gülün `0/180` etiketleri
ve artış yayı bayrakla birlikte dönüyor, başlığı da durumu yazıyor.

##### YÖN ETİKETLERİ DE AYNALANIR — yoksa kart ile rozet ters düşer

Aynalama bir sessiz kusur DOĞURDU ve kapı onu yakaladı: `out.spin`
(`FEADCore.loopSense`) **veri düzleminde** ölçülür, ama altı yüzey onu
*"motora önden bakışta CCW"* diye basıyordu. Çizim aynalandığı için ekranda
görülen yön onun **tersi**; çevrilmeden basılan etiket kartla çelişiyordu —
sessiz, çünkü ikisi de ayrı ayrı makul görünür.

Çeviri **tek üreticiden** (`js/fead-model.js`):

| Ne | Sözleşme |
|----|----------|
| `veFeadSpinToFront(spin)` | veri ↔ ön görünüş. **İnvolusyon** (kendi tersi) → seçim de aynı fonksiyondan geçer |
| `veFeadSpinLabel(spin)` | `{sense, glif, kisa, uzun}` — rozet · panel · toast · sihirbazın üç yüzeyi aynı metni okur |

**SEÇİCİ DE BU BOUNDARY'DEN GEÇER.** Sihirbazın yön düğmeleri artık ön
görünüşte konuşuyor; `veFeadWizSpinSet` gelen değeri veri düzlemine çeviriyor.
Çevrilmeseydi *"CW"* düğmesi kartta CCW'ye giden bir model kurardı.

**ÖLÇÜLDÜ:** AG00976 ve BMC, veri düzleminde `spin = +1` (CCW — Gates'in kendi
düzlemi, on raporun onunda da öyle), **ön görünüşte `−1` (CW)** — yani
kullanıcının istediği varsayılan, hiçbir veriye dokunmadan.

##### AÇI SEÇİCİSİ DE AYNALANIR — yoksa aynı sihirbazın iki resmi ters

Aynalamanın **ikinci** sessiz kusuru: sihirbazın kol açısı seçicisi (6. adım)
kendi çizicisiyle ve mm düzleminde çiziyordu, yani hemen altındaki *"Kayış
Yolu"* kartıyla **birbirinin aynası** oluyordu. İkisi de ayrı ayrı makul
görünür; hata ancak yan yana konunca fark edilir.

| Ne | Karar |
|----|-------|
| Sahne | aynalanır (`_fwMir()` → `veFeadSpinToFront(1)`) |
| Kayış | kartın kullandığı **aynı** `veFeadMirrorGeomX` — `d` de çevrildiği için sarım yayları kasnağın içinden geçmiyor |
| Saklanan açı | **veri düzleminde KALIR** — çözücü orayı okuyor |
| Ayna faktörü | `data-mir` ile DOM'a yazılır; ters çevirici onu okuyup ekran açısını veri düzlemine geri çevirir |
| `0/180` etiketleri | takas edilir — resim aynalı, okuma aynalı değilse kullanıcı `0°`'yi yanlış tarafta arar |

**ASIL KAPI GİDİŞ-DÖNÜŞ:** altı veri açısı ekrana konup geri okunuyor. Tek
yönü ölçen bir kapı, iki yönde birden yapılmış bir işaret hatasını göremez.

**NORMALLEŞTİRME KAYAN NOKTAYA DAYANIKLI:** `if(a > 180) a -= 360` biçimi,
ekranın tam sağındaki bir noktada `atan2`'nin `−1e−17` döndürmesiyle sonucu
`180 ↔ −180` arasında zıplatıyordu — aynı yön, ama saklanan sayı kareden kareye
değişir. Yerine `a − 360·floor((a+180)/360)`.

Dört mutasyonla ölçüldü, dördü de kırmızı: sahneyi aynalamama, `data-mir`'i
yazmama, ters çevirmede aynayı yok sayma, `0/180` takasını kaldırma.

##### Gergi serpantinde SON SIRADA — UYARI, zorlama değil

On raporun onunda da sıra gergiyle bitip sürücüyle başlıyor: gergi, kayışın
sürücüye **dönüş açıklığındadır**, yani GEVŞEK tarafta (AG00686'da ölçüldü:
`T = 1209.95 · 1208.48 · 767.47 · TEN 766.00` — en düşük, ankrajın kendisi).

**AMA MATEMATİK BU KONUMDAN BAĞIMSIZ.** Gerilme zinciri `T[t] = ankraj` ile
başlayıp `(t+j) % n` ile dolaşıyor. ÖLÇÜLDÜ — AG00686 çevrimsel olarak dört
konuma da döndürüldü: `ΔT = 0.0e+0 · ΔH = 0.0e+0 · L_eff birebir aynı`.

Bu yüzden kural bir **uyarı** (`veFeadBuildSystem` → `out.warnings` +
`out.tensionerOrder`): yanlış yere kablolanmış bir gergi doğru sonuç üretmeye
devam eder, yalnız yerleşim tedarikçi konvansiyonuna uymaz. Çözümü durdurmak,
DOĞRU bir modeli reddetmek olurdu.

**`veFeadTensionerSide` HÜKMÜNÜN İKİNCİ KOPYASI DEĞİL** — iki AYRI soru, ve
ölçüldü ki gerçekten ayrışıyorlar:

| | `tensionerSide` (analiz) | `tensionerOrder` (kurulum) |
|---|---|---|
| Sorduğu | span gerilmesi ankrajın ALTINA iniyor mu | sıra tedarikçi konvansiyonuna uyuyor mu |
| Kanıtı | duty satırlarının gerilmeleri | `out.order` içindeki konum |
| Yanlışsa | model **fiziksel olarak geçersiz** | model geçerli, yalnız arşivle satır satır karşılaştırılamaz |

**ÖLÇÜLDÜ:** sihirbazın *"⇄ Yönü çevir"*i AG00976'yı `p1>ten>p5>p4>p3>p2`
yapıyor → `tensionerOrder.last = false` (uyarı düşüyor) ama
`tensionerSide.ok = true`, `beltLengthMm` ve `springTensionN` **altı ondalığa
kadar birebir aynı**. Biri ötekinin kopyası olsaydı ayrışamazlardı.

**ÇEVİRME GERGİYİ KAÇINILMAZ OLARAK TAŞIR** ve sıra döndürülerek
düzeltilemez: halkada gerginin komşusu iki yanda da sürücüdür, ters yürütünce
*"sürücüden ÖNCE"* olan *"sürücüden SONRA"* olur. Gergiyi sona almak sürücüyü
baştan düşürür — ikisi aynı anda sağlanamaz. Bu yüzden uyarı *"şunu yap"*
demiyor, **farkın ne olduğunu** söylüyor.

**HÜKÜM SIRANIN YANINDA DURUR** (sihirbaz 3. adım, `_fwStepYol`): kullanıcının
elindeki iki kaldıraç da o kartta (satır okları ve *"⇄ Yönü çevir"*). Genel
uyarı kutusuna bırakılsaydı sebep adımın tepesinde, çare adımın içinde kalırdı.
Alan **iki yönde de yazılır** (`last: true` da) ki *"denetlendi ve uygun"* ile
*"hiç denetlenmedi"* ayırt edilebilsin.

#### KANVAS = KAYIŞ DÜZLEMİ — konum artık FİZİKSEL

Kullanıcı isteği (2026-08-25): *"Krank kasnağına koordinatları girdiğimiz zaman,
bu koordinatların 0,0 noktası olması ve topoloji üzerinde bileşenleri hareket
ettirdiğimde, örneğin alternatör kasnağını, kanvas üzerinde de hareket etmesi ve
hesapların buna göre anında güncellenmesi."*

Eskiden kanvastaki konum **hiçbir şey ifade etmiyordu** — çözücü mm
koordinatlarını yalnız panelden okuyordu. Artık ikisi TEK BİR ŞEY.

| Ne | Karar | Nerede |
|----|-------|--------|
| Orijin | **Sürücü kasnak** (rol, tip değil) | `veFeadOriginNode` |
| Ölçek | **1 px = 1 mm**, hassasiyet zoom'dan | `VE_FEAD_PX_PER_MM` |
| Y ekseni | Kanvasta aşağı, mm'de **yukarı** | `veFeadCanvasToMm` |
| Gergi sürüklemesi | **Avara merkezi** taşınır, gövdenin montaj konumu rijit takip eder (kol boyu ve açısı dokunulmadığı için türev aynı kadar ötelenir) | `veFeadDragTensioner` |
| "Otomatik Düzenle" | Halka değil, **koordinata yerleştir** | `veFeadArrangeByCoords` |

**ÖTELEME BEDAVA — ÖLÇÜLDÜ.** Bütün geometri merkez FARKLARINDAN kuruluyor
(`tangent`: `w = c_j − c_i`), dolayısıyla krankı orijine almak ücretsiz. BMC'nin
altı kasnağı + gerginin avara merkezi birlikte `(+500, −300)` ötelenince
`ΔL_eff = 0.00e+0`, altı sarım açısında `Δ = 0.00e+0`, gerginlik
`532.142 → 532.142 N` — kayan nokta hassasiyetinde **birebir**. Eski projeler bu
yüzden sessizce göç edebiliyor (`veFeadNormalizeOrigin`, alt topoloji açılışında).

##### Üç sessiz kırılma noktası — üçü de testli

| Nokta | Yanlış yapılırsa | Neden sessiz |
|-------|------------------|--------------|
| **Y ekseni** | Bütün topoloji aynalanır | TAM ayna bütün skalerleri BİREBİR aynı bırakıyor (fizik ayna simetrik); hata sayılardan görünmez, yalnız çizimden |
| **Kutu merkezi** | Her kasnağa kendi kutu yarısı kadar kayma | Kutu ölçüleri 54…72 px arasında değiştiği için kayma kasnaktan kasnağa farklı — tek bir ofsetle yakalanamaz |
| **Gergi** | Koordinatı bayat kalır, gergi yanlış yerde çözülür | Kol boyu TUTAR (türev merkezi rijit takip ediyor), yalnız yerleşim yanlış |

Üçüncüsü **kapı boşluğuydu**: gergi senkrondan çıkarılınca hiçbir test
kırılmıyordu. Orijin sürüklendiğinde krank-göreli HER koordinat aynı karede
tazelenmeli — gergininki ayrı bir geçişe bırakılamaz.

##### mm → px TAM SAYIYA YUVARLANMAZ

1 px = 1 mm olduğu için tam sayı yuvarlaması koordinatı **1 mm'ye kuantalardı**
ve bu sessiz bir kayıp: ölçüldü, alternatörün 1 mm'si gerginliği **38.6 N (%5.9)**
değiştiriyor, gergi kol boyu kapısının toleransı ise 0.5 mm. Yuvarlama 0.01 mm
— her iki eşiğin de çok altında ve gidiş-dönüş kayıpsız.

##### İmza: kasnak konumu girer, araç düğümü GİRMEZ

`veFeadTopoSignature` konumu bilerek dışlıyordu (ölçüldü: 30 sürükleme karesinde
0 yeniden kurulum). Artık konum fiziksel olduğu için kasnak koordinatı imzaya
**giriyor** — bu bilinçli bir geri adım. Ama imzaya giren şey **kanvas pikseli
değil mm koordinatı**: 440×500'lük Kayış Yolu kartını kendi kutusundan tutup
taşımak çözücüyü koşturmuyor.

##### Kademeli tazeleme — ÖLÇÜLDÜ

| Ne | Süre | Ne zaman |
|----|-----:|----------|
| `veFeadSyncMmFromCanvas` (6 kasnak) | 0.025 ms | her karede |
| `veFeadBuildSystem` + geometri (kart) | 2.245 ms | her karede |
| `veFeadAnalyze` (duty + ömür + burulma) | 7.013 ms | **bırakınca** |

Karede koşan toplam **2.27 ms** → 60 fps bütçesinde **7.4× pay**, kare tavanı
441 fps. Tam çözüm sürükleme yolunda HİÇ koşmuyor.

##### BAĞ AÇILIP KAPANABİLİR — `fead-coordlink` "Konum Bağı" (2026-08-28)

Kullanıcı isteği: *"topoloji üzerindeki bileşenleri kaydırdığımızda, gerçekten
koordinatları da değişiyordu. Şu an default olarak öyle. Bunu açılır kapanır bir
özellik haline getirmek istiyorum… ufak, böyle açılıp kapanabilen bir bileşen…
Onu topolojiye çekip açtığımız kapattığımız zaman, yukarıda bahsettiğim özellik
devreye girsin veya devreden çıksın."*

Bağ açıkken kanvas bir BLOK DİYAGRAMI olmaktan çıkıyor: kutular fiziksel
yerlerinde durmak zorunda, yani okunurluk için kaydırılamıyorlar. Yeni düğüm o
bağı kapatılabilir yapıyor — kapalıyken kutu salt görsel, koordinat salt panel
girdisi.

| Ne | Karar | Nerede |
|----|-------|--------|
| Ad / tip | **Konum Bağı** · `fead-coordlink` · 54×48 · 0 giriş / 0 çıkış · `maxInstances:1` | `components.js` |
| Bayrak | `node.data.linked` — yalnız `=== false` anlamlı | `veFeadCoordLinkOn` |
| Okuma | **TEK NOKTA** (kanvas · panel · rozet üçü de aynı fonksiyon) | `fead-model.js` |
| Rozet | `AÇIK` **amber** ↔ `KAPALI` **mavi**, tıklanabilir | `veFeadApplyCoordLinkBadge` |

**DÜĞÜM YOKSA BAĞ AÇIK** — geriye dönük uyum tam bu satırda: bugüne kadar
kaydedilmiş hiçbir projede bu düğüm yok, hepsi birebir eski davranışını
sürdürüyor. Düğüm var ama `linked` yazılı değilse de AÇIK: paletten bırakmak tek
başına modeli değiştirmemeli. **ÇOK KOPYADA KAPALI KAZANIR** (`maxInstances`
ikinciyi engelliyor ama elle düzenlenmiş bir dosya taşıyabilir; açıkça KAPALI
diyen bir düğümü yok saymak kullanıcının talimatını çöpe atmak olurdu).

**RENK ANLAM TAŞIR** ve modülün kendi dilinden geliyor (kayış kipi rozetiyle
aynı): amber = TÜREYEN, mavi = GİRDİ. Bağ açıkken mm kanvastan türüyor,
kapalıyken salt panel girdisi. **Soluk gri REDDEDİLDİ** — bu özelliğin en pahalı
sessiz hatası kullanıcının bağın kapalı olduğunu FARK ETMEMESİ; soluk bir rozet
tam olarak onu davet ederdi. `BAĞLI/SERBEST` de reddedildi: kayış kipi rozeti
aynı kanvasta `SERBEST` yazıyor, 60 px yan yana iki farklı anlam olurdu.

###### BAĞIMSIZLIK SİMETRİK — tek yön kapatmak özelliği ÇALIŞMAZ yapardı

Kapı iki yönde de var ve ikincisi bir incelik değil, özelliğin var olma şartı:

| Yön | Kapı | Kapatılmasaydı |
|-----|------|----------------|
| kanvas → mm | `veFeadSyncDrag` | — (istenen davranış zaten bu) |
| mm → kanvas | `veFeadPlaceFromCoords` | Alt topoloji her açılışta kutuları koordinata GERİ ÇEKER; kullanıcının dizilişi kaybolur. Panele tek bir sayı yazmak da (`veFeadSet` → `VE_FEAD_COORD_KEYS`) o kutuyu tek başına yerine oturtup dizilişi bozar |

**KAPI SAF FONKSİYONUN İÇİNDE DEĞİL.** `veFeadSyncMmFromCanvas` /
`veFeadSyncCanvasFromMm` DOM'suz saf dönüşümler ve öyle kalıyor: kapı oraya
konsaydı bağdan bağımsız olarak koordinat yazması gereken çağıranlar (göç, örnek
kurucu, ileride bir toplu işlem) sessizce engellenirdi. Testi bu ayrımı ayrıca
tutuyor.

**"Otomatik Düzenle" KAPININ DIŞINDA** — açık bir kullanıcı eylemi ve kapalı
bağda tek yönlü uzlaştırma yolu odur. Örnek yükleme de öyle (ona devrediyor).
`veFeadNormalizeOrigin` mm→mm bir öteleme, tek kutuya dokunmuyor → etkilenmiyor.

**Kart tazeleme için ek kapı YOK ve gerekmiyor:** `veFeadTopoSignature` mm
okuyor, piksel değil. Bağ kapalıyken mm değişmiyor → imza sabit → kart yeniden
kurulmuyor. Doğru davranış kendiliğinden çıkıyor.

###### AÇARKEN KUTU KOORDİNATA DÖNER — koordinat kutuya YAZILMAZ

Üç seçenek vardı ve ikisi tehlikeli:

| | Ne yapar | Hüküm |
|---|---|---|
| **(a) kutular mm'ye döner** | model doğrudur, diziliş geçicidir | **SEÇİLEN** |
| (b) mm kutulardan yeniden yazılır | Kullanıcının bağı kapatma SEBEBİNİ (modeli değiştirmeden dizmek) tek tıkla ve sessizce tersine çevirir | RED |
| (c) hiçbir şey | (b)'nin gecikmiş ve daha kötü hâli — aşağıya bak | RED |

(a) ayrıca sistemin kendi davranışıyla tutarlı: alt topoloji her açılışında
`veFeadPlaceFromCoords` zaten kutuları koordinata oturtuyor. Geçiş `saveState`
çağırıyor (geri alınabilir) ve toast kaç kutunun oturduğunu yazıyor — 0 ise
kullanıcı hiçbir şeyin değişmediğini görür.

###### DÜĞÜMÜ SİLMEK = BAĞI AÇMAK — ölçülmüş bir sessiz patlama

Bu, ilk uygulamada **kaçırılan** kusurdu ve (c) seçeneğinin neden reddedildiğini
de açıklıyor. Düğüm silinince bağ AÇILIYOR ("düğüm yoksa AÇIK" varsayılanı),
ama kutular hâlâ serbest yerlerinde. Ayrışma sessiz kalmıyor, **PATLIYOR**:
`veFeadSyncMmFromCanvas` mm'yi **MUTLAK** hesaplıyor (delta değil), dolayısıyla
sonraki İLK sürükleme birikmiş kaymanın tamamını tek karede modele yazıyor.

**ÖLÇÜLDÜ** (BMC, bağ kapalıyken alternatör 80 px sağa / 50 px yukarı dizilmiş,
sonra bağ düğümü silinmiş):

| | alternatör mm | kol |
|---|---|---|
| silmeden hemen sonra | −281.00 | 28.4271° |
| **ve 1 px SÜRÜKLENİNCE** | **−200.00** | **28.0625°** |

Bir pikselin karşılığı **81 mm** — uyarısız, hatasız. Bu, modülün belgelenmiş
38.108 mm sınıfının aynısı. `veFeadCoordLinkAfterDelete` (silme yolundan,
`map.js` `deleteSelectedNodes`) silmeyi rozeti AÇIK'a çevirmekle aynı şey
sayıyor: kutular koordinata döner. Geriye KAPALI bir kopya kaldıysa uzlaştırma
YAPILMAZ.

###### İki yan etki, ikisi de bilinçli

**KENETLEME GERİ GELİR.** Kasnak sürüklenirken hizalama kenetlemesi kapalıydı,
çünkü kutu KENARLARINI yapıştırmak koordinatı sessizce yutuyordu (ölçüldü:
24.514 mm istenirken 3.940 mm). Bağ kapalıyken o gerekçe yok — kutu salt görsel,
kenetleme klasik topolojilerdeki anlamına dönüyor ve yutacak bir mm yok.

**KASNAK PANELİ SEBEBİ YAZIYOR.** Konum X/Y alanları normalde kutuyu da taşıyor;
kapalıyken taşımıyor. Sessiz bırakılsaydı kullanıcı sayıyı yazar, kutu yerinde
kalır ve **alanın bozuk olduğunu sanardı** — oysa model DEĞİŞTİ. Sağlıklı (bağ
açık) durumda metin birebir eskisi: yanlış alarm yok.

**ÖLÇÜLDÜ (gerçek tarayıcı, tek dosya `file://`, BMC):** palet girdisi "FEAD
Araçları" kategorisinde ve `fead-analysis` kapsamında; düğüm 54×48, rozet
`AÇIK` amber; kapatınca hiçbir şey oynamıyor; kapalıyken alternatör kutusu
2736.41 → 2826.41 px (DOM dahil) giderken mm **−281 sabit**; yeniden açınca kutu
2736.41'e dönüyor ve mm yine −281. Konsolda bu özelliğe ait hata yok.

Kapı **on mutasyonla** ölçüldü, onu da kırmızı: sürükleme kapısını silme,
varsayılanı ters çevirme (11 test), ters yön kapısını silme, `saveState`'i
kaldırma, açarken mm←kutu yazma, KAPALI rozetini soluk griye çevirme,
kenetlemeyi bağdan koparma, silme kancasını kaldırma, kasnak paneli uyarısını
yutma, çok kopyada İLKİNİ kazandırma.

##### DÖNÜŞ YÖNÜ — `fead-spin` "Dönüş Yönü" (2026-08-28)

Kullanıcı sorusu: *"kayışın dönüş yönü neye göre belirleniyor? Bu dönüş yönünü
de CW veya CCW olacak şekilde ayarlayacak bir bileşen kuralım yine bir önceki
gibi. Buna göre de matematiği ayarlayalım (eğer değişiyorsa)."*

**YÖN BİR AYAR DEĞİL, ROTA SIRASININ SONUCU.** `FEADCore.loopSense`
(fead-core.js) kasnak merkezlerinin kayış gidiş sırasındaki **ayakkabı bağı
(shoelace) işaretli alanına** bakıyor: `+1` = CCW, `−1` = CW — **motora ÖNDEN
bakışta**. Yani kabloları hangi sırada çektiysen yön odur; `solveGeometry`
onu okuyup her kasnağa `d = (grooved ? s : −s)` veriyor.

###### MATEMATİK: GEOMETRİ DEĞİŞMEZ, GERİLME DEĞİŞİR

| | İleri | Ters | Fark |
|---|---|---|---|
| kasnak başına sarım | — | — | **2,5e−14 °** |
| L_eff (AG00976) | 1716,200 | 1716,200 | **0,000000000 mm** |
| Σ işaretli sarım | 360,00 | 360,00 | 0 |
| kol açısı (meanRel) | 28,075036° | 28,075036° | 0 |
| **span gerilmeleri** | 1381,0 · 1379,7 · 1023,3 · 1021,9 · 545,4 · **544,0** | 545,4 · 544,0 · 67,5 · 66,2 · **−290,3** · **−291,6** | **NEGATİF** |

Geometrinin değişmemesi bir yaklaşıklık değil **cebirsel özdeşlik**: ters
yürütmek hem `s`yi (dolayısıyla her `d`yi) hem de giriş/çıkış teğetlerini
takas ediyor, `(−d)·(θ_giriş − θ_çıkış) = d·(θ_çıkış − θ_giriş)` — iki işaret
birbirini götürüyor. **Hesap katmanına tek satır dokunulmadı.**

Gerilmenin değişmesi de fizik: `spanTensions` ankrajı gergiye yazıp
(`T[gergi] = designTensionN`) kayış gidiş yönünde yürüyor — sürücüde `+P/v`,
aksesuarlarda `−P/v`.

###### GERGİ GEVŞEK TARAFTA OLMALI — 14 Gates sisteminin 14'ünde de öyle

Ters yönde gergi krankın **GERGİN** tarafına düşüyor ve spanlar ankrajın
altına iniyor. Bu bir modelleme kusuru değil, gerçek bir tasarım kuralı:
otomatik gergi gevşek tarafa konur, gergin tarafta tahrik gerginliğinin
tamamını yayla karşılamak zorunda kalır ve durdurucusuna dayanır.

**ÖLÇÜLDÜ:** doğrulama fixture'ındaki 14 kurulabilir sistemin **14'ünde de**
ankraj GLOBAL MİNİMUM, üstelik gergi sıranın SON kasnağı. İstisna yok.

Ölçüt **EŞİKSİZ** (`veFeadTensionerSide`): *"ankrajın altına inen span var
mı"*. Negatif sayı ARAMAZ — negatiflik o durumun yalnız uç hâli.
*"Gergi kranka komşu olmalı"* gibi bir KONUM kuralı yanlış olurdu: aralarında
güç çekmeyen bir avara bulunabilir ve bu geçerlidir (sentetik olarak ölçüldü).
Sayılan şey komşuluk değil, **GÜÇ**.

###### ÜÇ SESSİZ KUSUR — üçü de bu turda çıktı

| Kusur | Belirti | Kök neden |
|-------|---------|-----------|
| **Ters kablolama sessizce kabul ediliyordu** | `route.ok`, `build.ok`, `build.warnings = []`; Kayış Yolu kartı **YEŞİL** (Σ=360, L geçerli) — ve gerilmeler negatif | Gerginin hangi tarafta olduğunu soran tek satır yoktu |
| **Panel ULAŞILAMAZ bir çare gösteriyordu** | *"kayış gevşiyor: tasarım gerginliği yetersiz"* + *"Tasarım gerginliğini yükseltin"* | O alan 2026-08-25'te **girdi olmaktan çıktı** (yay dengesinden türüyor). `grep designTension js/cp-fead.js` → **sıfır eşleşme**. Aritmetik olarak işe yarardı (544 → 900 N negatifleri kaldırıyor) ama basılacak düğme yok |
| **Uyarı raporlara HİÇ ULAŞMIYORDU** | 12 duty satırının 10'u uyarı taşırken `R.warnings = null`; iki raporun da "Çözümün taşıdığı uyarılar" kutusu **BOŞ** | Çekirdeğin uyarısı `analysis.duty[i].warnings` içindeydi; `_frWarnBox` / `_fsrWarnBox` yalnız üst seviyeye bakıyor |

**KAYMA HÜKMÜ DE BASTIRILDI.** `slipSafety` gevşek tarafı `1e-9`'a
kenetliyor, dolayısıyla çöken bir zincirde `SF = −0,00` çıkıyor ve panel onu
`✗ KALDI` diye basıyordu. Negatif bir emniyet faktörü fiziksel olarak
anlamsız — o sayı kayma değil, çöken gerilme zincirinin sayısal gölgesi.
Ters yerleşimde kayma hükmü artık **verilmiyor** ve bu yazılı.

###### BİLEŞEN DURUM TUTMUYOR — KABLOLARI ÇEVİRİYOR

| Ne | Karar | Nerede |
|----|-------|--------|
| Ad / tip | **Dönüş Yönü** · `fead-spin` · 54×48 · 0/0 · `maxInstances:1` | `components.js` |
| Durum | **YOK** — yön kabloların kendisinde | `veFeadReverseRoute` |
| Okuma | **TEK NOKTA** `veFeadCurrentSpin` (rozet + panel) | `cp-fead.js` |
| Rozet | `↺ CCW` ↔ `↻ CW` — **glif durumu, RENK hükmü taşır** | `veFeadApplySpinBadge` |

Düğüme `data.dir` gibi bir alan koymak ikinci bir gerçek kaynağı yaratırdı ve
**üç yerden ısırırdı**:

1. Kanvastaki gidiş oku (`veConnDirMark`) telin from→to yönünü çiziyor —
   bayrakla ok **yalan söylerdi**.
2. `veFeadTopoSignature` tel uçlarını okuyor ama araç düğümlerinin `data`'sını
   **OKUMUYOR** (ölçüldü). Bayrak imzaya girmezdi → rozete tıklayınca kart
   doğrudan çağrıyla tazelenir ama **GERİ AL sonrası bayat kalırdı**.
3. Bayrak silinince yön sessizce dönerdi → ayrı bir silme kancası gerekirdi.

Kabloyu çevirmek üçünü birden yok ediyor. **ÖLÇÜLDÜ:** kablo çevirmenin
verdiği sıra, *"krank sabit + kalanı ters"* kuralının verdiği sırayla birebir
aynı — yani bayrak yolunun tek iddia edilen üstünlüğü (kabloya dokunmamak)
karşılıksız. Takas **YERİNDE**: `createConnection` kimliği `'conn-' +
Date.now()` ile ürettiği için altı teli yeniden kurmak altı ÖZDEŞ kimlik
verirdi.

**RENK ÜÇÜNCÜ BİR EKSEN.** Aynı kanvasta iki rozet daha var (`SABİT/SERBEST`,
`AÇIK/KAPALI`) ve ikisinde de renk *"mavi = GİRDİ, amber = TÜRETİLEN"* demek.
CW ile CCW'nin **ikisi de eşit meşru**; birine amber vermek *"bu yön
hesaplanmış, öbürü girilmiş"* derdi ve yalan olurdu. Durumu **ok** taşıyor,
renk ise bu yönün **çalışıp çalışmadığını**: yeşil = gergi gevşek tarafta,
kırmızı = gergin tarafta, nötr = henüz çözüm yok (hüküm uydurulmaz).

###### İKİ ÖLÇÜLMÜŞ KUSUR — ikisi de kapı yazılırken çıktı

**1 · YÖN DÜĞÜM DİZİSİ SIRASINDAN OKUNUYORDU.** Rozet
`nodes.filter(isPulley)` sırasını `loopSense`'e veriyordu. O sıra kayış yolunu
anlatmıyor: örnek yüklenirken tesadüfen örtüşüyor, ama **kablolar çevrilince
dizi değişmiyor** — rozet çevirdikten sonra da eski yönü gösteriyordu. Okuma
artık `veFeadRouteOrder`'dan.

**2 · ROZET BİR ÇÖZÜM GERİDE KALIYORDU.** Rozetin RENGİ hükmü taşıyor ve hüküm
ancak çözümle biliniyor; `veFeadSolve` rozetleri tazelemiyordu. **ÖLÇÜLDÜ
(gerçek tarayıcı):** ileri yönde nötr, ters yönde **YEŞİL**, geri dönünce
**KIRMIZI** — renk her seferinde bir önceki modelin hükmünü gösteriyordu.

**ÖLÇÜLDÜ (gerçek tarayıcı, tek dosya `file://`, AG00976):**

| | rozet | renk | yön | gergi | min T |
|---|---|---|---|---|---|
| ileri | `↺ CCW` | yeşil | +1 | gevşek ✓ | **544,0 N** |
| ters | `↻ CW` | **kırmızı** | −1 | **gergin ✗** | **−291,6 N** |
| geri | `↺ CCW` | yeşil | +1 | gevşek ✓ | 544,0 N |

Gidiş-dönüş birebir (`1381 · 1379,7 · 1023,3 · 1021,9 · 545,4 · 544`), konsol
hatası yok.

Kapı **on bir mutasyonla** ölçüldü, on biri de kırmızı: doğal yön işaretini
çevirme, gergide `cenX` yerine `x` kullanma, araç tellerini de çevirme, yönü
düğüm dizisinden okuma, hükmü yalnız negatif sayıya bağlama, uyarıyı üst
seviyeye yükseltmeme, panelde eski yanlış teşhise dönme, CW/CCW'yi farklı
renklendirme, çevirmede `saveState`'i kaldırma, port yazmayı atlama, çözüm
sonrası rozet tazelemesini kaldırma.

##### Gerçek çap hayaleti — KALDIRILDI (2026-08-26)

> **EMEKLİ.** Kullanıcı bildirimi: *"topolojide bu bileşenlerin etrafına böyle
> sanal bir çizgili daireler çizmişsin. Onları kaldıralım, gerek yok."*
> `veFeadApplyDiaGhost` / `veFeadRefreshDiaGhosts` / `.ve-fead-dia` tamamen
> silindi. Aşağısı, aynı yön yeniden önerilirse nelerin ölçülmüş olduğunu
> bilmek için duruyor — çünkü hayaletin ÇÖZDÜĞÜ sorun hâlâ yerinde.

Kutu 54–72 px, gerçek kasnaklar 57–162 mm; birebir ölçekte kutu krankı **2.25 kat
küçük** gösteriyor. Konum fiziksel olduğu için bu yanıltıcı: **çakışmayan iki
kutu, çakışan iki kasnak** olabilir — ve çekirdek onu "kayış kasnağın içinden
geçiyor" diye reddeder. Hayalet o çarpışmayı hata çıkmadan ÖNCE görünür yapıyordu.
Kasnaklar daireye çevrilmiyor: `c48fe17`'de denendi ve kullanıcının isteğiyle
geri alındı.

**Kaldırırken ölçülen bir BOŞLUK:** özelliğin tamamı silindiği hâlde 5918
birim testinin hiçbiri kırılmadı — hayaletin hiç kapısı YOKTU. Bugün o
çarpışmayı gösteren tek yüzey, çözüm anında çekirdeğin verdiği hata.

Kaldırma bir NEGATİF KAPIYLA kilitlendi (Geometri panelindeki *"incelik
seçicisi ve 'Kenarlar' kutusu YOK"* kalıbının aynısı): `veFeadApplyBadge`
kasnak kutusuna kesikli çember çizmiyor, ve üretici/tazeleyici dışa
açılmıyor. Kapı sınıf adına DEĞİL biçime de bakıyor (`border-radius:50%` +
`dashed`), yoksa başka adla geri gelebilirdi. Ölçüldü: çağrıyı geri koyan
mutasyon kırmızı.

Silinince iki temizlik daha gerekti (ikisi de yapıldı): rozet gerekçesi kendi
fonksiyonundan kopup `veFeadSyncDrag`'in yorumuna kaynamıştı, ve `veFeadSet`
içindeki `if` tek ifadeyi sarar hâle gelmişti.

##### "Otomatik Düzenle" artık koordinata yerleştiriyor

Halka düzeni doğruydu — **konum hiçbir şey ifade etmezken**. Artık halkaya
dizmek kullanıcının girdiği bütün mm koordinatlarını SİLMEK olurdu, yani
"düzenle" düğmesi modeli bozardı. Yeni anlamı: kanvas konumlarını mm'den yeniden
kur. Koordinatı olmayan kasnak gizlenmiyor, kümenin altına diziliyor (sessizce
(0,0)'a koymak iki kasnağı üst üste bindirirdi).

Kapı **sekiz mutasyonla** ölçüldü, sekizi de kırmızı.

##### GERÇEK TARAYICI iki sessiz kaymayı daha çıkardı

Birim testler koordinat katmanını Node'da doğruluyor; zincirin yarısı orada
HİÇ koşmuyor (gerçek `mousedown/mousemove/mouseup`, `canvasZoom` bölmesi,
DOM'a yazılan `style.left`, kartın `innerHTML` ile yeniden kurulması).
`tests/e2e/fead-canvas-drag.spec.js` onu koşturdu ve **iki ayrı kayma** çıktı.
Ortak imzaları: kutu doğru yerde duruyor, panel doğru sayıyı gösteriyor, hiçbir
hata çıkmıyor — yalnız model kullanıcının koymadığı bir koordinatla çözülüyor.

**1 · Örnek kurucusu kutuyu koordinatın SÖYLEMEDİĞİ yere koyuyordu.**
`veFeadLoadExample` kümeyi 520×400'lük bir kutuya sığdıran **kendi ölçeğini**
kullanıyordu (BMC'de ×1.1178) ve kutuları köşe koordinatıyla diziyordu — kanvas
kayış düzlemi OLMADAN önce doğru olan, sonra yalan olan bir yerleşim.

**ÖLÇÜLDÜ (gerçek tarayıcı, BMC, HİÇ SÜRÜKLEMEDEN):**

```
alternatör kutu merkezi − krank kutu merkezi = −319.108 px
alternatör mm koordinatı                     = −281.000 mm   → 38.108 mm FARK
```

Fark iki parçalı: ölçek payı (`−281 × 0.1178 = −33.11`) + kutu genişliği payı
(`(54−72)/2 = −5.00`). Sessizliğin sebebi **hatanın ilk sürüklemeye kadar
görünmemesi**: `veFeadSyncMmFromCanvas` kanvası okuyup mm'yi tazelediği için o
38.108 mm koordinatın üstüne biniyor — kullanıcı 60 px sürüklüyor, model 98 mm
oynuyor. Düzeltme yeni bir hesap değil, **ikinci bir hesabın kaldırılması**:
kurucu artık `veFeadArrangeByCoords({silent:true})`'a devrediyor, yani panel
düzenlemesinin ve "Otomatik Düzenle"nin kullandığı yolun ta kendisine.

| | eski | yeni |
|---|---:|---:|
| altı kasnağın en büyük sapması | **38.108 mm** | **0.0000 mm** |
| 60 px sürüklemenin karşılığı (zoom 0.653) | −98.1 mm | **−91.926 mm** (= istenen) |

**2 · Hizalama kenetlemesi koordinatı yiyordu.** `checkAlignment` kutu
KENARLARINI yapıştırır ve bunu yaparken **bütün** düğümler için sabit 65 px
genişlik varsayar; kasnak kutuları 54…72 px olduğu için hizalanan şey ne merkez
ne kenar. Varsayılan KAPALI (`SNAP_ENABLED`), yani ancak kullanıcı açtığında ya
da Q basılı tutulduğunda ateşleniyor — bu yüzden ilk ölçümde **hiç
görünmedi** ve ancak açıkça açılarak yakalandı.

**ÖLÇÜLDÜ** (BMC, alternatör Avara 2'nin satırına doğru 16 ekran px yukarı,
zoom 0.653 — Avara 2 mm'de 7.94 mm yukarıda, yani 8 px eşiğinin tam içinde):

| | istendi | oldu |
|---|---:|---:|
| kenetleme FEAD'de **açık** | 24.514 mm | **3.940 mm** |
| kenetleme FEAD'de **kapalı** (bugünkü hâl) | 24.514 mm | **24.514 mm** |

20.6 mm sessizce yutuluyordu. Kenetleme artık FEAD kasnağı sürüklenirken
devre dışı (`js/ui-core.js`); klasik topolojilerde aynen çalışıyor.

Üç mutasyonla ölçüldü (eski ölçekli yerleşimi geri getirme, `silent` bayrağını
yutma, kutu konumunu yine tam sayıya yuvarlama) — üçü de kırmızı; kenetleme
kapısı ayrıca E2E'de (Node'da hiç koşmuyor).

##### Örnek KULLANIMA HAZIR gelir — başlangıç kutusu gider, Rapor kalır (2026-08-26)

Kullanıcı isteği: *"'Başlangıç ve Örnekler' bileşeni silinmiş ve 'Çözücü'
bileşeninin altına 'Rapor' bileşeni gelmiş"* olsun.

| Ne | Neden |
|----|-------|
| `fead-example` örnek yüklenince **SİLİNİR** | O düğüm bir AÇILIŞ yüzeyi (`veFeadPopulateStarter` onu alt topoloji BOŞKEN koyuyor) ve tek işi örnek listesini sunmak. Örnek kurulduktan sonra sol şeritte yer kaplıyor ve "buradan devam et" diyen bir düğme gibi duruyordu — oysa devam edilecek yer kurulmuş modelin kendisi |
| `fead-report` örneğe **EKLENİR** | `ex-layout` ile aynı gerekçe: örnek "çözülebilir bir model" değil, KULLANIMA HAZIR bir model. Kullanıcı raporu almak için bileşeni paletten ayrıca aramak zorunda kalıyordu |

**SİLME `deleteSelectedNodes` DEĞİL.** `fead-example` girişsiz/çıkışsız, yani
bağlantısı yok; silmek diziden ve DOM'dan çıkarmakla bitiyor. O fonksiyon ise
sensör/parametrik referanslarını da tarıyor ve `selectedNodes` global'ini
TÜKETİYOR — burada seçim kullanıcınındır.

**SPLICE, YENİDEN ATAMA DEĞİL:** `nodes = nodes.filter(...)` global'i yeni bir
diziye bağlar; tarayıcıda çalışır (bütün betikler aynı global'i paylaşıyor) ama
Node testinde `global.nodes` bayat kalır.

**SIRASI YERLEŞTİRİCİDEN ÖNCE.** Sonra silinseydi sol şeritte ona ayrılmış boş
bir sıra kalır (kutu 56 px + 24 boşluk), kalan üç kutu 40 px yukarıda ve kümeye
göre ortalanmamış dururdu.

**ŞERİT SIRASI PUSH SIRASIDIR.** `veFeadArrangeByCoords`'un `serit()`'i araç
düğümlerini `nodes` dizisi sırasına göre diziyor ve o dizi
`veFeadExampleNodes`'un push sırasından geliyor: `ex-belt → ex-solver →
ex-layout → ex-report`, layout sağ şeride ayrıldığı için sol şerit
**Kayış Özellikleri → Çözücü → Rapor**. Rapor solver'dan önce push edilseydi
şeritte de onun üstünde çıkardı.

**BEDELİ:** örnek bir kez yüklendikten sonra `veFeadPopulateStarter` bir daha
koşmuyor (yalnız alt topoloji BOŞKEN koşuyor), yani başka bir örnek yüklemek
için `fead-example` paletten geri sürüklenmeli. Palette duruyor ("FEAD
Araçları"). Zaten dolu bir kanvasa ikinci örnek kurmak kasnakları üst üste
bindirirdi; silme bu yüzden akışla tutarlı.

##### Kart 420×340 → 440×500, ve AŞILMIŞ VARSAYILANLAR bir LİSTE

Kullanıcı isteği: *"Kanvas biraz boyuna geniş [olsun]"*. Eski ölçü bir ALT
SINIRDI, hedef değil: 420×340, FEAD_INFORMATION oranı (465×315 mm) ve okunabilir
en küçük kasnak adı için hesaplanmıştı.

**ÖLÇÜLDÜ** (BMC, 420×340): şemaya kalan alan 330×262 px ve kayış yolu
316.3×262 ile YÜKSEKLİĞE dayanıyordu. 440×500'de (şerit de koşullu olunca) aynı
içerik **404 × 334.7** px'e çıkıyor. Kazanç TEK BİR ÖLÇEK ÇARPANI, altı kasnakta
da aynı: **1.277, yani +%27.7** — yarıçaplar `45.5→58.0 · 42.7→54.5 · 21.3→27.3
(×3) · 16.4→21.0` (alternatör Ø57, en küçüğü). Sabit şeritlerin (SER 20 + SEC 22)
yüksekliğe maliyeti de **%12.4 → %8.4**.

> Bu paragraf bir kez YANLIŞ yazıldı ("alternatör 24.9 → 34.5 px, %38") ve
> çapraz denetim yakaladı: 24.9 bir yarıçap değil, kayış yolunun x ofsetiydi.
> Doğrusu 16.4 → 21.0 px, +%27.7. "Makul ama yanlış" sınıfı, kanonik kayıtta.

`VE_FEAD_LAYOUT_LEGACY` artık **LİSTE** (`[{60,56}, {420,340}]`), tek çift değil:
60×56 kart-öncesi (Aşama 0–3) ölçüydü, 420×340 kartın ilk varsayılanı. İkincisi
listeye alınmasaydı bugüne kadar kaydedilmiş HER proje eski küçük kartla açılır
ve aynı sürümde iki farklı kart ölçüsü dolaşırdı. Kapı ayrıca listedeki hiçbir
çiftin GÜNCEL ölçü olamayacağını arıyor — olsaydı göç kendini sonsuza kadar
"değişti" sayıp her açılışta `saveState`'i kirletirdi.

Kapı yalnız alt sınırlara bakmıyor: **`H > W`** de aranıyor. İki alt sınır
(`W > 300`, `H > 240`) tutulsaydı 500×440 — yani YATAY bir kart — da geçerdi ve
"boyuna geniş" isteği sessizce geri alınabilirdi. "Bilerek verilen ölçü korunur"
testi de artık ne güncel ne aşılmış hiçbir çiftle örtüşmeyen bir ölçü kullanıyor
(640×420); eskisi 640×**500** idi ve 500 yeni `VE_FEAD_LAYOUT_H`'in ta kendisi
olmuştu, yani test doğru sebepten değil tesadüfen geçiyordu.

`veFeadLayoutCardHTML`'deki `|| 420` / `|| 340` yedeği de kaldırıldı: kart
ölçüsünün İKİNCİ KOPYASIYDI ve büyüme sırasında sessizce eskimişti
(`components.js`'in kendi kuralı: *"ölçü tip tanımlarına BURADAN yazılır, defs
içinde ayrıca sayı tutulmaz"*).

#### Üç yapısal kural (iskeletten farkı, hepsi testli)

1. **Sürücülük ROL, tip değil** (`node.data.driver`). Gates AG00976'da sürücü
   kasnak FAN'dır; tipe bağlamak o topolojiyi kurulamaz yapardı.
2. **Temas tarafı (grooved/back) GERÇEK ALAN.** Ters verilirse çekirdek
   **geçerli ama başka** bir güzergâh çözer — kapalı çevrim ve sarım değişmezi
   TUTAR, hata verilmez. Bu yüzden üç katman: tip varsayılanı
   (`componentDefs.feadContact`) → panelde açık aç/kapa → **kanvasta rozet**
   (K/S, sürücüde ►). Testi bu sessizliği belgeliyor.
3. **Çap = DIŞ ÇAP (`od`).** Yarıçapları çekirdek `hb`/`hr` ile türetir. Eski
   `dia` alanı `veFeadMigrateNode` ile sessizce göç eder.

#### Kanvasta tel çekmek — çizim KURULAN topolojiyi gösterir

Kullanıcı bildirimi (2026-08-21): *"bağlantıyı kopardığımda kanvastaki görüntü
gitmiyor, tekrar bağlamaya çalıştığımda da bağlanmıyor; araya bileşen
ekleyemiyorum. Bu da programın çözeceği problemlerin ezbere olabileceği
kanısına vardırıyor."* Üretildi ve **üç ayrı sessizlik** çıktı.

**1 · Güzergâh çözücüsü kopuk kasnağı sessizce kayışa katıyordu.**
`veFeadRouteOrder`'ın son satırı şuydu:

```js
pulleys.forEach(function(p){ if(!seen[p.id]) order.push(p); });   // ESKİ
```

Yani zincire bağlı OLMAYAN kasnak sıraya ekleniyordu; çekirdek de pekâlâ
"geçerli" bir kapalı çevrim çözüyordu. **ÖLÇÜLDÜ (gerçek tarayıcı, BMC):**
"Avara 2"nin iki teli de silindikten sonra kart hâlâ `✓ 6 kasnak · L 1715.0 mm`
diyordu. Çizim, kurulan TOPOLOJİYİ değil bileşen LİSTESİNİ gösteriyordu — yani
kullanıcının "ezbere" sezgisi bu satırda haklıydı.

Artık `veFeadRouteDiagnose` sırayı üretirken geçerliliği de taşıyor: çevrim
kapalı mı, kopuk kasnak var mı, bir kasnaktan iki tel mi çıkıyor. `build`
bunlara bakıp **çözmeyi reddediyor ve sebebini adıyla yazıyor**
("Kayış yoluna bağlı olmayan kasnak var: Avara 2"). Sıra yine BÜTÜN kasnakları
taşır — yerleştirici (`veFeadArrangeByCoords`) ve rozetler kopuk kasnağı da görmeli;
ayrılan şey sıra değil, GEÇERLİLİK.

> Bu değişiklik bir testi kırdı ve kırdığı için değerliydi: `fead-model.test.js`
> içindeki uçtan uca AG00686 testi `veFeadBuildSystem(kur().list, kur().conns)`
> yazıyordu. `kur()` her çağrıda YENİ kimlikler ürettiği için bağlantılar başka
> bir düğüm kümesini gösteriyordu — yani test kabloları hiç sınamıyordu, eski
> "kopuğu sıraya ekle" davranışı sayesinde dizi sırası tesadüfen doğru yolu
> veriyordu.

**2 · Kart bağlantı değişince hiç tazelenmiyordu.** Kartın tek tazeleme noktası
`saveState()`'ti; ama `saveState` mutasyondan **ÖNCE** çağrılıyor (geri-al
yığınına ön durumu koymak için, bkz. `handleConnectionContextAction`). Tel
silindikten sonra kartı yenileyen hiçbir şey yoktu. Tazeleme artık
`updateAllConnections`'ta — her mutasyondan geçen tek nokta, port DOM senkronu
da aynı gerekçeyle oraya bağlıydı — ama **topoloji imzasına** bağlı:
`veFeadTopoSignature` düğüm kimlikleri ve tel uçlarından üretiliyor, KONUM
girmiyor. **ÖLÇÜLDÜ:** 30 sürükleme karesinde kart yeniden kurulumu **0**
(kurmak çözücüyü koşturmak demek).

**3 · Geçersiz port çifti sessizce yutuluyordu.** İki çıkışa arka arkaya
tıklamak hiçbir şey yapmıyor, hiçbir mesaj çıkmıyordu. FEAD'de bu özellikle
yanıltıcı: port kenarı komşuya bakacak şekilde DİNAMİK (`veFeadPortSideFor`),
yani "giriş solda / çıkış sağda" ipucu yok — kullanıcı hangisinin ne olduğunu
konumdan okuyamıyor. Karar tek yerde toplandı (`veTryConnectPorts`, ui-core.js;
`state.js`'teki ikinci kopya ona devretti) ve sebep yazılıyor. İki kopya
kalsaydı geri-al/yükle sonrası kurulan portlar o mesajı vermezdi.

**Ayrıca:** kurulum geçerli olup da geometri çözülemediğinde kart yalnız
"Kayış yolu henüz kurulamadı" diyordu; çekirdeğin sebebi (`build.geomError`)
artık kartta ve panelde basılıyor.

**Kural:** kanvasta çizilen tel HER ZAMAN görünür ve HER ZAMAN çözüme girer.
Model tutarsızsa şema yerine SEBEP yazılır — tel gizlenmez, bağlantı
reddedilmez. **ÖLÇÜLDÜ (çözümün modele bağlı olduğunun kanıtı, BMC):** iki
avarayı kayış sırasında takas etmek, alternatörü 20 mm oynatmak ve bir temas
tarafını çevirmek — üçü de çözücüyü reddettiriyor ve sebebini yazıyor; geri
alınca sarım açıları birebir geri geliyor (`154.3 · 52.8 · 198.4 · 64.3 ·
157.4 · 33.0`).

#### Kanvasta CANLI kayış yolu kartı (`fead-layout`)

"Kayış Yolu" düğümü bir düğme değil: tuvalin üstünde, topolojinin **yanında**
duran ölçekli bir şema (440×500). Girdi değiştikçe yeniden çizilir, yani
kullanıcı modelinin tutarlı olup olmadığını **panel açmadan** görür. Topoloji
grafiği kayışın SIRASINI gösteriyor ama ŞEKLİNİ göstermiyor; üst üste binen iki
kasnak, ters temas tarafı ya da işareti yanlış bir koordinat orada fark
edilmiyor — kart o boşluğu kapatıyor.

Şema düğümlerin KANVASTAKİ yerinden değil, kasnakların kayış düzlemindeki (mm)
koordinatlarından çizilir; düğümü sürüklemek şemayı değiştirmez. Parçalar
`data-ve` ile adlandırılı (`belt`, `pulley`, `spin`, `pivot`, `arm`, `compass`)
— ham "A" sayarak yay saymak kırılgandı, oklar ve yön gülü de yay çiziyor.

| İşaret | Ne söylüyor |
|--------|-------------|
| Turuncu yol | çekirdeğin teğet noktaları + işaretli sarım yayları |
| Yol üstündeki **dişler** | kayışın **kaburgalı yüzü** — kaburgalı temas edende kasnağın İÇİNE, sırttan temas edende DIŞARI bakar |
| Kesikli çember | kayış o kasnağa **sırttan** değiyor |
| Kasnak içi ok | dönüş yönü (sırttan temas edende ters döner) |
| Yeşil artı + kesikli çizgi | gergi **pivotu** ve kolu — ters pivot burada gözle görünür |
| Yön gülü (0/90/180/270) | açı konvansiyonu; "montaj açısı −3.18°" onsuz okunamıyor |
| Soluk gri yollar | **diğer kol konumları** (TÜMÜ kipi) — kolun gezdiği aralık |
| Üst künye | çizilen konumun adı · kol açısı · gerginlik |
| Alt şerit | ✓/✗ · kasnak sayısı · L_eff · **Σsarım** (360° olmak ZORUNDA) |

##### Gergi kol konumu seçicisi

Gergi kolu yay dengesinde duruyor: kayış uzayıp kısaldıkça (tolerans + aşınma)
kol dönüyor, gergi kasnağının merkezi kayıyor ve **kayış yolu her konumda başka
bir eğri** oluyor. Kartın altındaki kutu konumu seçiyor; seçim
`node.data.posMode` (varsayılan `mean`) ve **panel ile kart AYNI alanı okur** —
iki ayrı ayar tutulsa panel bir konumu, kanvastaki kart başkasını gösterirdi.
Şema, geometri tablosu ve durum şeridi hepsi seçili konumu anlatır.

Konumlar `FEADCore.positionTable`'dan (`FreeArm · Replace · MaxBelt · Mean ·
MinBelt · Load`); `TÜMÜ` kipi Mean'i önde, geri kalanları soluk çizer.
İki tuzak testli: (a) **tolerans/aşınma 0 iken dört orta konum aynı açıya
oturuyor** — tekilleştirilmezse dört özdeş eğri üst üste biner ve çizim hatası
gibi görünür; (b) çözülemeyen bir konum (BMC'de `Replace`, kayış çözüm
aralığının dışına çıkıyor) listede yok, seçiliyse şema boş kalmaz — Mean'e düşer
ve sebep yazılır. Hayalet etiketleri **pivottan dışa doğru** yerleşir; sabit
"solda" yerleşimde üç etiket üst üste biniyordu (gergi bu düzende ~25 px yol
alıyor).

##### Kaburgalı yüz kayışın ÜSTÜNDE çizilir (`data-ve="rib"`)

Temas tarafını şimdiye kadar yalnız kasnağın kesikli çemberi söylüyordu — bir
**uzlaşım**, yani öğrenilmesi gereken bir kod. Oysa fark gerçek ve çizilebilir:
kayışın bir yüzü kaburgalı, öbürü düz sırt. Yol boyunca dizilen kısa dişler o
yüzü işaretliyor; **kaburgalı temas eden kasnakta dişler kasnağın İÇİNE,
sırttan temas edende DIŞARI bakıyor.** Kullanıcı artık kodu değil parçayı
görüyor — ve bu modülün en pahalı sessiz hatası (ters temas tarafı) şekil
olarak yanlış görünüyor.

Yön TEK BİR KURALDAN çıkar ve yol boyunca sabittir (kayış kendi yüzlerini
değiştiremez): mm düzleminde ilerleme yönü `u` iken kaburgalı yüz normali
`rot90ccw(u) / sense`. Türetme: kaburgalı kasnakta `d = +sense` ve teğet
`u = d·(−sinθ, cosθ)` olduğundan `rot90ccw(u) = d·(−cosθ, −sinθ)` = `d ×`
merkeze doğru; sırttan temas edende `d = −sense` olduğu için aynı normal
kasnaktan uzağa bakar. **`sense`i yok sayıp sabit bir yön yazmak bu topolojide
doğru, AYNASINDA yanlış** çizerdi — testi bu yüzden aynalanmış bir çevrimi de
koşuyor. Üç mutasyonla ölçüldü: normali ters çevirme, `sense`i sabitleme,
sarım yönünü (`p.d`) sabitleme — üçü de kırmızı.

**ÖLÇÜLDÜ (gerçek tarayıcı, BMC örneği):** üç kaburgalı kasnakta dişlerin
%100'ü içeri (20 / 24 / 8 diş), üç sırttan temas eden kasnakta %100'ü dışarı
(5 / 5 / 4 diş).

##### Sarım yayının sweep bayrağı — bir kez yanlış yazıldı

`ty(y) = offY + (maxY − y)·s` ölçeklemesi mm düzlemini **ekranda aynı yönde**
gösterir (yönelim korunur). SVG'nin açı sistemi ise y-aşağı: pozitif açı yönü
görsel olarak saat yönü. Dolayısıyla mm düzleminde CCW olan (`p.d > 0`) ekranda
da CCW görünür ve SVG'de **negatif** yöndür → `sweep = 0`.

Eskiden `sweep = (d > 0 ? 1 : 0)` yazıyordu. Yarıçap ve teğet uçları DOĞRU
olduğu için yay yine iki uca değiyordu ama **aynalanmış çemberin** üzerinde
kalıyor, yani kasnağın İÇİNDEN geçiyordu — ekranda "kaymış, bükülmüş kayış".
Eski test yay SAYISINA baktığı için yeşil kalmıştı. ÖLÇÜLDÜ (BMC, 420×320): yay
merkezleri kasnak merkezlerinden **6.7–42.7 px** sapıyordu; düzeltmeyle altı
kasnakta da **0.008 px**. Dönüş oku aynı ters konvansiyondaydı (kasnağın gerçek
dönüşünün tersini gösteriyordu), o da düzeltildi.

Yeni kapı bu sınıfı kilitliyor: **her yayın örtük merkezi, o kasnağın merkezi
olmak zorunda** (SVG uç→merkez dönüşümü, spec F.6.5) — hayalet yollar dahil.

Çözülemeyen modelde kart boş kalmaz, **sebebi yazar** — kullanıcı "çizim gitti"
değil "kayış yolu kapanmıyor, temas tarafına bak" mesajını görür.

**TAZELEME TEK NOKTADAN: `saveState()`.** Her mutasyon (alan değişti, bağlantı
kuruldu/silindi, düğüm eklendi/silindi) zaten oradan geçiyor; yirmi ayrı yere
çağrı serpiştirmek biri unutulduğunda şemanın sessizce eski geometriyi
göstermesi olurdu. `try/catch` şart — bir çözüm hatası undo yığınını bozmamalı.

Ölçü tek kaynak: `VE_FEAD_LAYOUT_W/H` (components.js) → `componentDefs`. Eski
60×56 kayıtlar `veFeadNormalizeLayoutSize` ile yükselir, elle boyutlandırılan
her ölçü korunur. `veArrangeModuleBase` artık öge başına ölçü kabul ediyor
(`{lx, ly, w, h}`) — herkese 65×60 sayılınca 420 px'lik kart grubu yanlış
ortalayıp görünür alanın sağından taşıyordu (ölçüldü).

**`veFeadBeltPath` EMEKLİ.** İskeletin kendi çizimi bütün kasnakları dış teğet
sayıyordu → sırttan temas edenlerde sarım YANLIŞTI (AG00686: CRK 207.7 ↔ 172.2,
−35.5°). Kendi içinde tutarlı olduğu için (Σ=360) gözle yakalanmıyordu. Şema
artık `FEADCore.solveGeometry`'nin teğet noktaları + işaretli sarım yayları.

**ÖLÇÜLDÜ (gerçek tarayıcı):** AG00686 kanvasa kurulunca sarım
`CRK 210.2 · IDR 26.7 · A_C 202.9 · TEN 26.4`, span
`249.2 · 212.6 · 248.9 · 212.6`, Mean kol açısı `33.1°`, take-up `0.559 mm/°`
— **hepsi Gates raporuyla birebir.**

##### Kart ÇALIŞIR — kayış gider, kasnaklar döner (`veFeadAnimTick`)

Şema doğru ama DONMUŞ bir kesitti. Anlattığı üç şey — hangi kasnak ne kadar
hızlı döner, hangisi **ters** döner, kayış ne kadar hızlı gider — yalnız
tabloda sayı olarak duruyordu; artık hareketin kendisi.

**Yeni fizik yok:** üçü de çekirdekte hazırdı (`beltSpeed`, `speedRatio`,
`geom.pulleys[i].d`). Yapılan iş o sayıları ekranda okunur bir hıza indirmek.

**GERÇEK ZAMAN OLMAZ — ÖLÇÜLDÜ** (BMC, o zamanki 420×340 kart, 0.553 px/mm;
kart 440×500 olunca ölçek 1.277× büyüdü, aşağıdaki px/s sayıları da o kadar —
ama tavan DEVİR tabanlı olduğu için gerekçe değişmiyor):

| motor | kayış | ekranda | diş/s | alternatör |
|---|---|---|---|---|
| 800 dev/dk | 7.56 m/s | 4182 px/s | 597 | 40.5 tur/s |
| 2750 dev/dk | 26.00 m/s | 14377 px/s | 2054 | 139.4 tur/s |

60 Hz ekranda **en yavaş** satırda bile kayış kare başına 70 px (10 diş adımı)
atlıyor → diş sırası strob; alternatör kare başına 0.68 tur → wagon-wheel, yani
gerçek yönünün **tersine** dönüyor görünür. Bu yüzden ağır çekim — oranlar
birebir. Tavan (`VE_FEAD_ANIM_TARGET_REV_S` = 1 tur/s) örnekleme sınırından:
en küçük kasnakta diş açı adımı 24.5°, 1 tur/s'de kare başına 6°, yani adımın
yarısının altında → yön tek anlamlı.

**Katsayı SEÇİLİ devre değil REFERANS devre (listenin en yükseği) bağlanır.**
Seçili devre göre normalize edilseydi her devirde ekrandaki hız AYNI çıkar ve
devir seçicisi hiçbir şey değiştirmezdi; testi bu istenmeyen alternatifi de
koşturup belgeliyor. BMC'de katsayı `×1/139`: 800 dev/dk'da alternatör
0.29 tur/s, kayış 30 px/s; 2750'de 103 px/s.

**Diş sırası ve kollar TEK FAZDAN** (`_feadBeltWalk` → `_feadTeethPath` /
`_feadSpokePath`): kayış zinciri boyunca kümülatif yay uzunluğu. Kol açısı
`θ = a0 + d·faz/r` olduğundan `ω = d·v/r` **kendiliğinden** çıkıyor — kayışın
kasnak üzerinde kaymadığı yapısal olarak garanti. İki ayrı sayaçtan sürülseydi
zamanla ayrışır ve V kaburgalı bir tahrikte **olmayan** bir kayma gösterirdi.

**Çepere diş değil KOL çizilir.** V kaburgalı kayış sürtünmeyle çalışır,
kasnak oluğu **çevreseldir**; çepere radyal diş koymak senkron (dişli) kayış
resmi olurdu — yanlış bir mekanizma öğretirdi. Kol bir yüzey iddiası değil,
nirengi işareti. Animasyon açıkken dönüş oku çizilmez (aynı şeyi ikinci kez
söyler ve 0.55R'de kollarla çakışırdı); `Durgun` seçilince geri gelir.

**Diş adımı çevreyi TAM BÖLER** (`_feadToothStep`): 7 px hedefi çevreye tam
oturmuyor ve kapanış artığı, akan kayışın üstünde sabit bir noktada duran tek
bir tökezleme olurdu (BMC: 1722.5 mm → 136 diş → 12.67 mm). Parça sınırı da
epsilonla kapanır ve sayaç katla ilerletilir: **ÖLÇÜLDÜ**, kayan noktada tam
sınıra düşen diş 12 fazın birinde iki parçaya birden yazılıyordu (141 ↔ 140
diş) — çevrimde bir kez yanıp sönen bir diş.

**Animatör DOM'da DURUM TUTMAZ.** Kart her `saveState()`'te innerHTML ile
baştan kuruluyor; kurulum/temizlik çiftine dayanan bir animasyon o yeniden
kurulmayı her seferinde yakalamak zorunda kalırdı (unutulan tek yol → sızıntı
ya da donmuş kart). Tek rAF döngüsü her karede `svg[data-fead-anim]` arar,
bulduğuna fazı uygular, kart kalmayınca **kendini durdurur**. Faz **düğüm
kimliğiyle** saklanır (öğeyle değil): öğede dursaydı kayış her tuş vuruşunda
başa sarardı. Sekme gizliyken rAF zaten durur, `dt` 0.1 s'ye kırpılır (bir
dakikalık gizlilikten sonra kayış fırlamasın), `prefers-reduced-motion` açıksa
animasyon hiç başlamaz. Kare başına iş: bir diş yolu + kasnak başına bir kol
yolu, hepsi attribute yazımı.

**Devir seçicisi kol konumuyla AYNI satırda** (ikinci bir şerit çizimden 22 px
alırdı; iki şeritle alternatör dairesi 13 px'in altına iniyordu). Seçenekler
duty tablosundan gelir, `Durgun` ilk sıradadır, varsayılan **baskın** duty
satırıdır (en büyük yüzde). Duty tablosu boşsa tek bir varsayılan devir
(1000) gelir ve etiketinde bunu **yazar**: oranlar salt geometriden geldiği
için animasyon yine doğrudur, uydurma olan yalnız mutlak devirdir. Ağır çekim
katsayısı da künyede yazılıdır — gizlenseydi kullanıcı ekrandan devir okumaya
kalkardı.

**ÖLÇÜLDÜ (gerçek tarayıcı, BMC, 800 dev/dk):** altı kasnağın altısı da
beklenen hızda dönüyor — `Sürücü 0.105 · Klima 0.112 · Alternatör 0.291 ·
üç sırt kasnağı −0.224 tur/s` — sapma **%0.0**, işaretler doğru (sırttan temas
edenler ters yönde), diş sayısı faz boyunca sabit (136).

Animasyon **yalnız kanvas kartında**: panel, HTML rapor §8.5 ve SVG/PNG dışa
aktarma aynı çiziciyi kullanıyor ama `animate` geçirmiyor → statik kalıyorlar.

##### Titreşim animasyonu — çırpma ve mod şekli (2026-09-02)

Kart iki titreşimi de oynatabiliyor; kaynak **çekirdek**, dokunulmadı
(`spanFrequencies` + `torsionalModel`). Hükümler:

- **Genlik BİR SONUÇ DEĞİLDİR** — ikisi de özdeğer problemi; mutlak genlik için
  krank torkunun harmonik içeriği ve kayış sönümü gerekir, ikisi de MFSim'de
  yok. Ekrandaki genlik ilan edilmiş bir **gösterim kazancıdır** (kullanıcı
  kaydırıcısı) ve künyede `KALİBRE DEĞİL` ile yazılır. Zaten zorunlu: kartta
  ölçek ~0,71 px/mm, gerçek 3 mm'lik sapma ekranda 2 piksel.
- **İki animasyonun zaman tabanı AYRIDIR ve bu bir ölçümdür.** Çırpma
  kinematiğin ağır çekim katsayısını paylaşır (oran birebir kalsın); mod şeklinin
  **zaman tabanı yoktur** — aynı katsayıyla 12 Hz'lik 1. mod ekranda çevrim
  başına 11,6 saniye sürerdi, yani salınım değil sürüklenme.
- **Açıklık şekli v=0 yaklaşımıdır**: frekans eksenel hızı içeriyor
  (`(c²−v²)/2Lc`), çizilen yarım sinüs duran telin şeklidir.
- **Kayış kasnakta KAYMAZ.** Mod şeklinde yay üstündeki her nokta kasnakla
  birlikte döner, açıklık iki ucunun kaymasını doğrusal taşır. Yalnız kolları
  döndürüp kayışı yerinde bırakmak, V kaburgalı sürtünmeli bir tahrikte
  **olmayan** bir şeyi öğretirdi.
- **Donuk kare, animasyonun İLK KARESİDİR** (`vibDef` t=0 ile çizilir): çırpmada
  açıklıklar arası faz kayması var; deformasyonsuz çizilseydi animasyon
  başlarken kayış sıçrardı ve `prefers-reduced-motion` açık kullanıcı titreşimi
  hiç görmezdi.
- **Üç çizici (kayış yolu · dişler · kollar) TEK deformasyon nesnesini paylaşır**
  (`_feadVibDef` → `disp`/`spin`). Ayrı olsalardı dişler kayıştan kopardı.
- **Burulma modeli çözülemezse `null`** — sessizce sıfır şekil göstermek, iki
  sessiz girdisi olan (gergi kasnak kütlesi +%32, krank mili ataleti +%40) bir
  modelde kendinden emin biçimde yanlış bir frekans göstermek olurdu. Kart
  sebebini yazar.
- **Kazanç şeridi yalnız titreşim AÇIKKEN belirir** — kapalıyken kart bugünkü
  hâlinin birebir aynısı; 22 px'i isteyen öder.

##### Motor çevrimi senaryosu — geçici rejim (2026-09-02)

`js/fead-transient.js`. Kart tek bir çalışma noktası yerine bütün çevrimi
oynatabiliyor: durgun → marş → ateşleme → rölanti → hızlanma → tepe →
yavaşlama → stop. Hükümler:

- **Devir geçmişi DAYATILIR, SİMÜLE EDİLMEZ.** `J·dω/dt = T_motor − T_yük`
  kurulamaz çünkü J yok: modeldeki "Krank ataleti" **burulma modelinin**
  ataletidir (BMC 0,70 kg·m²), volan değil. Onunla integre etmek 15.000 d/dk/s
  verirdi; gerçeği 1000–2000. Rampa bu yüzden MFSim'in **zaten sorduğu**
  `accelRpmS`/`decelRpmS` alanlarından gelir — `peakEstimate`'in kullandığı
  aynı sayı, yani animasyon ile tepe yük tablosu aynı şeyi anlatır.
- **TÜRETİLEN yalnız rampanın ŞEKLİ**: α(N) ∝ T_motor(N) − T_aksesuar(N),
  **mutlak Nm** olarak. İlk yazımda oran (`(Tm−Tacc)/Tm`) kullanılmıştı ve
  sessizce etkisizdi — ölçüldü, faz içi α oranı 1,00 idi; mutlak torkla 1,46.
  Eğri yoksa rampa doğrusal ve kart bunu yazar.
- **Gerilme ivmede TAM doğrusal** (`T(N,α) = A(N) + α·B(N)`, ölçülen sapma
  0,00 N). Dayanağı: animatörün kare başına çözücü koşturması yasak. İki devir
  ızgarası yüke konur, animatör herhangi bir α için gerilmeyi yeniden kurar.
- **Rölanti altında aksesuar yükü (N/N_rölanti)² ile ölçeklenir** (T ∝ N ⇒
  kuvvet ∝ N). Üç aday ölçüldü: sabit güç kuvveti sonsuza götürüyor (41.927 N),
  sabit tork duran motorda 1350 N iddia ediyor, seçilen kural sıfır devirde
  sıfır veriyor. Izgaranın altında gerilme tasarım gerginliğine harmanlanır.
- **İki hız, tek saat.** Senaryo saati gerçek saniyedir (12,7 s çevrim 12,7 s
  oynar); dönüş ve titreşim mevcut ağır çekimde kalır (×1/139). Künye ikisini
  de yazar.
- **Çırpma senaryoda CANLIDIR**: frekans ve genlik o andaki gerginlikten. Donmuş
  bir yük süpürmede geçilen rezonansları gösteremezdi — oysa görülecek olay o.
  **Uyarma yoksa titreşim de yok** (durgun kayış çırpmaz).
- **Animasyon yükü artık METİN taşıyor**, dolayısıyla attribute çift tırnak +
  `_feadEsc` ile kaçışlanır. Eski tek tırnaklı biçimin dayandığı "yalnız sayı
  taşır" varsayımı senaryoyla YANLIŞ hâle geldi ve ölçüldü: `MFSim'de`
  içindeki kesme işareti attribute'ü 7573. karakterde kapatıyor, `JSON.parse`
  patlıyor ve animasyon **sessizce hiç kurulmuyor**. `notlar` yüke girmez.

Kapı: `tests/unit/fead-transient.test.js` (26 test; altı mutasyonla ölçüldü) +
`tests/unit/fead-anim.test.js`'in yük sözleşmesi.

Kapı: `tests/unit/fead-vibration.test.js` (30 test; dört mutasyonla ölçüldü —
çırpma normalini açıklık yönüne çevirmek, kol kaymasını düşürmek, açıklık ucu
rampasını ters çevirmek, çözülemeyen modeli sıfır şekle çevirmek).

##### Yön gülünün ŞERİDİ artık ÖLÇÜLMÜŞ bir çarpışmaya bağlı (2026-08-26)

Gül varsayılan yerinde (sağ alt) dururken şemadan **54 px'lik bir sağ şerit**
KOŞULSUZ ayrılıyordu: 420 px'lik kartın sekizde biri, yalnız dört sayı için.
Gül sürüklenebiliyordu (`veFeadCompassDragStart`) ve **taşındığı anda şerit
ayrılmıyordu** — yer açma sorumluluğu kullanıcıya geçtiği için. Yani kazanç
kullanıcının gülü elle taşımasına bağlıydı.

Kullanıcı isteği (2026-08-26): *"kanvasın sağ altındaki koordinat sembolü ana
şekle daha yakın [olsun]"*. Çözüm gülü oynatmak DEĞİL, şeridi kaldırıp şeklin
ona doğru büyümesini sağlamak oldu — çünkü şerit çoğu yerleşimde **gereksiz**:
gül sağ ALT köşede duruyor, kayış yolunun sağ alt köşesi ise sıklıkla BOŞ
(BMC'de krank sağda değil, ORTA-ALTTA).

Yeni kural bir ÖLÇÜM (`_roseCarpti`): önce şerit ayrılmadan ölçeklenir, sonra
gülün kutusu **gerçekten çizilen şeylere** — kasnak çemberleri (+ad payı), kayış
açıklıkları, hayalet konumların açıklıkları, gergi kolu ve pivotu — çarpıyor mu
diye bakılır. Çarpmıyorsa şerit hiç ayrılmaz.

**ÖLÇÜT SINIR KUTUSU DEĞİL, ÇİZİLEN ŞEYİN KENDİSİ.** Sınır kutusu kullanılsaydı
BMC'de de çarpardı (kutunun sağ alt köşesi güle 0.5 px kalıyor) ve şerit hiç
kazanılmazdı — oysa orası boş.

**ÖLÇÜLDÜ** (BMC, en büyük kasnak yarıçapı px):

| kart | eski (koşulsuz) | yeni | kazanç |
|---|---:|---:|---|
| **440×458** (yeni varsayılan) | 50.29 | **58.05** | **+%15.4** |
| 420×298 (eski varsayılan) | 45.45 | 45.45 | %0.0 — ölçek zaten yüksekliğe bağlıydı |
| 380×298 | 41.67 | 45.45 | +%9.1 |
| 340×298 | 35.92 | 43.68 | **+%21.6** |
| 300×240 | 30.17 | 35.39 | +%17.3 |
| 260×200 | 23.50 | 28.45 | +%21.1 |
| 220×180 | 16.68 | 16.68 | %0 — **ÇARPIŞMA VAR, şerit ayrılıyor** |
| 180×140 | 9.86 | 9.86 | %0 — çarpışma var |

Yani kazanç yer VARKEN doğuyor, yer YOKKEN davranış birebir eskisi. Gülü elle
taşımak artık çoğu kartta hiçbir şey kazandırmıyor — çünkü kazanç ZATEN
varsayılanda geliyor.

**KUTU KOŞULSUZ, ŞERİT KOŞULLU — iki ayrı soru.** İlk yazımda ikisi tek bayrağa
(`!moved`) bağlanmıştı ve bu sessiz bir kusurdu: `compassPos` verilir verilmez
gül **etiket engeli olmaktan çıkıyordu**, yani tam da kullanıcı gülü şemanın
içine sürüklediğinde koruma kapanıyordu. **ÖLÇÜLDÜ** (BMC, 440×458, gülün 16×16
kesir ızgarası = 256 konum): engel varken çakışan konum **3**, engel yokken
**61**. Kalan 3 konum yerleştiricinin kendi ilan ettiği geri düşüşü (dört adayın
hiçbiri temiz değilse etiket üste döner ve çakışır — kaybolmaz).

Etiket ölçütü **çapa noktası değil KUTU**: ilk kapı çapaya bakıyordu ve
mutasyondan GEÇTİ — `middle` çapası çakışmanın 43 px solunda duruyor, kutu ise
sağa taşıyor.

Konum **kesir** olarak saklanır (`node.data.compassPos = {fx, fy}`), piksel
olarak değil: kart yeniden boyutlandırılınca gül aynı bağıl yerde kalır. Piksel
saklansaydı daraltma anında çerçevenin dışında kalırdı — ki kullanıcının yapmak
istediği tam olarak daraltmak. Kenetleme sürükleme SIRASINDA uygulanıyor (sınır
çekilirken görünsün), ve gülden küçük bir kartta gül merkeze oturuyor: yarısı
dışarıda bir gül hiçbir şey demez.

**HAREKETSİZ TIK HİÇBİR ŞEY YAZMAZ** — gerçek tarayıcıda ölçülen bir hata:
her `mouseup`'ta `saveState` çağrılınca kart `innerHTML` ile yeniden kuruluyor
ve **çift tık olayı ulaşacağı öğeyi bulamadan** ateşlenmiyordu, yani "çift tıkla
varsayılana dön" sessizce çalışmıyordu. İkinci kazanç: gülün üstüne yapılan her
tık undo yığınına boş bir adım koymuyor artık.

Fare noktası `getScreenCTM` ile çözülür, kutu oranı yalnız yedektir: kart ile
viewBox aynı en-boy oranında olsa da **tuval zoom'lu olabiliyor** ve onu yalnız
CTM kapsıyor.

Panel de aynı alanı okuyor ve aynı kancayı kuruyor (kol konumundaki kuralın
aynısı: iki ayrı ayar tutulsa panel bir yeri, kart başka bir yeri gösterirdi).
Rapor ve SVG/PNG dışa aktarma düğüm kimliği almadığı için **sürüklenmez** —
orada gül varsayılan yerinde kalır.

