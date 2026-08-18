# MFSim - Claude Code Talimatları

## Proje Yapısı
Tarayıcı tabanlı Motor Fren Simülasyonu uygulaması (saf HTML/CSS/JS, framework yok).

- `index.html` — Ana sayfa (modüler versiyon, js/ klasöründen script yükler)
- `MFSim_Code.html` — Tek dosya versiyonu (otomatik üretilir, elle düzenlenmez, **git'e dahil değil** — `npm run build` üretir, CI deploy Pages'e yayınlar)
- `js/` — Modüler JavaScript dosyaları
- `css/` — Stiller
- `build.js` — Build script (`index.html` + `js/` + `css/` → `MFSim_Code.html`)
- `tools/shot.js` — Ekran görüntüsü aracı (İSTEĞE BAĞLI — yalnız kullanıcı isteyince; `npm run shot -- --help`)
- `tests/unit/` — Jest birim testleri
- `tests/e2e/` — Playwright E2E testleri
- `viewer/` — **Ölçüm Görüntüleyici** (ayrı program, bkz. `viewer/README.md`)
- `MFSim_Olcum_Goruntuleyici.html` — Görüntüleyicinin tek dosya çıktısı (`npm run build:viewer` üretir; MFSim_Code.html'in aksine **git'e dahil** — dağıtımı bu dosyanın indirilmesiyle oluyor)

**ÖNEMLİ:** Kod değişiklikleri **yalnızca** `js/` ve `css/` klasörlerindeki modüler dosyalara ve `index.html`'e yapılır. `MFSim_Code.html` dosyası **elle düzenlenmez** — `npm run build` ile otomatik üretilir.

### Üç ana modül (alt-sistem kartı → kendi iç topolojisi)

Karşılama ekranındaki her kart, ana tuvale tek bir **alt-sistem kartı** bırakır;
çift tıklayınca kartın kendi iç topolojisi açılır. Üçü de **aynı nested kalıbı**
paylaşır (stack + `node.data.subTopology` + breadcrumb çipi + sidebar kapsamı):

| Modül | Tip anahtarı | Sidebar kapsamı | Ana dosya | Bağlantının anlamı |
|-------|--------------|-----------------|-----------|--------------------|
| Araç Performans | `arac-performans` | `arac-performans` | `js/cp-arac-performans.js` | Güç akışı |
| Takoz Çökme-Titreşim | `mount-analysis` | `mount-analysis` | `js/cp-mount.js` | Salt görsel (çözücü tipe göre toplar) |
| FEAD (kayış-kasnak) | `fead-analysis` | `fead-analysis` | `js/cp-fead.js` | **Kayış yolu** — serpantin sırası (Krank çıkışı → … → Krank girişi) |

Yeni bir modül eklerken dokunulan yerler: `js/components.js` (`componentDefs`
tanımı + `isSubsystem` + `VE_MODULES.components` + `veSyncSidebarScope`),
`js/cp-core.js` (panel dağıtımı + panel genişlik listeleri), `js/ui-core.js`
(çift tık), `js/topology.js` (busy bayrağı, köke çökme, gezinme yakala/geri yükle,
`veResetSubtopoNav`), `index.html` (script etiketi, Modüller satırı, palet
kategorileri, karşılama kartı).

#### FEAD hesap çekirdeği — `js/fead-core.js` (DIŞARIDAN GELDİ, BİREBİR DURUR)

`js/fead-core.js` MFSim içinde yazılmadı: 17 Gates raporundan çıkarılmış **2095
referans değerle** kalibre edilmiş, doğrulanmış bir çekirdek olarak dışarıdan
alındı (v2.0, UMD, bağımlılıksız → `window.FEADCore`).

**BU DOSYA MFSim STİLİNE ÇEVRİLMEZ.** `const`/arrow/template literal kullanıyor,
projenin geri kalanı `var` kullanıyor — fark bilerek duruyor. Dosyanın tek
değeri o 2095 değeri birebir üretmesi; stil uyarlaması sırasındaki bir işaret
hatası "testten geçen ama yanlış" bir çekirdek üretir. Uyarlanacak olan
çekirdeğin ÇEVRESİ (`js/cp-fead.js`), çekirdeğin kendisi değil. Sütun-0'da
üst-seviye bildirimi yok (IIFE sarmalı) → hijyen kapısına takılmaz; içindeki
`</script` dizisini build kalkanı (`shieldScriptEnd`) zaten kapsıyor.

Doğrulama verisi + koşucu `tests/fixtures/fead-validation.js` içinde, kaynağıyla
**birebir** (tek yerel fark: `require` yolu — dosyanın başında yazılı).
`tests/unit/fead-core.test.js` onu koşturup eşiklere bakar. `tests/` altında
olduğu için build'e girmez. Eşikler (harness'ın kendi ölçütleri):

| Ölçüt | Eşik | Neden |
|-------|------|-------|
| Çalışma konumları | %0.5 | deterministik fizik |
| Load dahil | %1.5 | Load bir MEKANİK STOP; sarım sıfıra yaklaşınca gerginlik tekilleşir, 0.1° yuvarlama %1.4–2.3 fark yaratır |
| Kol açıları | 0.2° | sıfıra yakın açıda yüzde hatası anlamsız |
| Kaburga yorulma dağılımı | 1.5 yüzde puanı | kalibre model |

Kapı **ısırıyor** — dört mutasyonla ölçüldü: `hb` 1.2→1.25 (2 test kırmızı),
gergi dengesinde `2sin(φ/2)`→`sin(φ)` (3), sarım değişmezi kontrolünü kaldırma
(suit çöker), gerilme işaretini ters çevirme (4).

**Mutlak B10 ömrü ve doğal frekans KAPI DIŞINDA** — spesifikasyonun geçerlilik
sınırları: doğal frekans çok serbestlik dereceli bir burulma modu (çekirdek
yalnız kol modu verir, raporla karşılaştırılamaz); mutlak ömür yalnız tüm
çaplar 79.6–176 mm iken geçerli, dışında sistematik 0.55×.

#### Üç katman — hangi dosya neyi yapar

| Dosya | Katman | Kural |
|-------|--------|-------|
| `js/fead-core.js` | Hesap çekirdeği | Dışarıdan geldi, **birebir** durur, dokunulmaz |
| `js/fead-model.js` | Köprü (DOM'suz) | Kanvas düğümü → `FEADCore.makeSystem()`; temas/sürücü/çap çözümü, hata çevirisi |
| `js/cp-fead.js` | Sunum | Yalnız HTML kurar; **kendi geometrisini hesaplamaz** |

Yükleme sırası (index.html): `fead-model.js` → `fead-core.js` → `cp-fead.js`.
Model katmanı, `cp-fead.js`'in de kullandığı saf yardımcıları (`_feadNum`,
`_feadDefOf`, `_feadIsPulley`, `veFeadContactOf`, `veFeadOD`,
`veFeadRouteOrder`…) bildirir — aynı adı iki dosyada bildirmek üst-seviye
çakışması olurdu (`source-hygiene` kapısı).

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
| Telin ortasında **gidiş yönü oku** | `veConnDirMark` (connections.js), `.ve-conn-dir` | Aynı halka iki yönde de gezilebilir ve **sarım açıları buna göre değişir**; yön topolojiden okunamıyordu |

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
yolunun üstüne düşüyordu (Klima ↔ Avara 1 açıklığı oradan geçiyor).

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

#### İKİ YÜZEY — graf GİRDİ, kart ÇIKTI (`js/fead-graph.js`)

FEAD iç topolojisi artık serbest bir blok diyagramı değil: kasnaklar
**girilen mm koordinatlarına** oturur (kanvasta **1 px = 1 mm**), düğüm
**girilen çapında bir DAİRE**dir, portlar kayış sırasındaki **komşuya bakar**.
Ölçülen kazanç: BMC örneğinde tel kesişimi **3 → 0**.

Bunu yapmayan bir yerleşim üç ayrı sebeple karışıyordu ve üçü de kapatıldı:
konum keyfîydi (kasnağın mm koordinatı ekranda hiçbir şey ifade etmiyordu),
port sabitti (giriş SOLDA / çıkış SAĞDA → kayış sağdan sola dönerken tel
düğümün üstünden geri geçiyordu), biçim dikdörtgendi (çap ekranda yoktu).

**Graf, Kayış Yolu kartının yerine GEÇMEZ — bölüşüm görüntüye göre değil
YETENEĞE göre:**

| | Graf = **girdi** yüzeyi | Kart = **çıktı** yüzeyi |
|---|---|---|
| Ne gösterir | çözücü **olmadan** çizilebilen her şey | yalnız **çözücünün** söyleyebildiği şey |
| İçerik | merkez, çap, temas tarafı, sürücü rolü, serpantin sırası, pivot | sarım açıları, span, L_eff, `Σsarım=360` kapısı, gerginlik, take-up |
| Yarım modelde | **çalışır** (3 kasnak, kayış kapanmamış) | "kapanmıyor — temas tarafına bak" der |
| Etkileşim | düzenlenebilir | salt okunur gösterge |

Ölçüldü: doğru kurulmuş BMC modelinde girilen gergi montaj merkezi
(−170.08, 99.16) ile çözücünün bulduğu çalışma merkezi (−170.12, 98.46)
arasında **0.70 mm ≈ 0.21 px** var. Yani model doğruyken iki resim ayırt
edilemez — bu gereksizlik değil, **doğrulamanın kendisi**; ayrıldıklarında
(ters temas tarafı, ters pivot, işareti yanlış koordinat) fark teşhis olur.
Yapısal olarak grafın **asla** yapamayacağı şey ise şu: grafta bir kasnak =
bir düğüm, düğümün tek konumu var; gergi kasnağının ise BMC'de **4 ayrı
konumu, 59.9 mm'lik bir zarfı ve 374…876 N aralığı** var — kart TÜMÜ kipinde
dördünü üst üste çizebiliyor. Bu yüzden "kenar = çözülmüş kayış" (etüt 1'in E
alternatifi) **yapılmadı**.

**Biçim üç kanal taşıyor** (`css .ve-node--fead-pulley`): çeper ÇAPI → dış çap,
çeper DOKUSU → temas tarafı (düz = kaburgalı, kesikli = sırt), çeper RENGİ →
rol (sürücü amber · aksesuar mavi · avara nötr · gergi yeşil — kartın pivot
rengiyle aynı). Tip kimliği ortadaki sembolde kalır.

**Ölçek SABİT (1 px = 1 mm), "görünüme sığdıran" değil:** sığdıran ölçek daha
şık dururdu ama iki kasnağın ekrandaki oranı topolojiden topolojiye değişirdi.
Alt/üst sınıra çarpan kasnak ölçekli DEĞİLDİR ve işaretlenir. Çapı GİRİLMEMİŞ
kasnak nötr ölçüde (`VE_FEAD_NODIA_DIA = 64`, `componentDefs` varsayılanıyla
aynı sayı — testi var) ve noktalı çizilir: tipe göre uydurulmuş bir çapı
(krank 180 mm) ölçekli göstermek, biçimin taşıdığı tek bilgiyi yalan yapardı.

**Port artık AÇI** (`portPositions[pid] = {side:'angle', deg}`). `deg` EKRAN
düzleminde ölçülür: 0° = +X, 90° = **aşağı** — yani doğrudan
`atan2(Δy_ekran, Δx_ekran)`. Tek geometri kaynağı yine `vePortOffset`
(components.js): port DOM'u, bağlantı ucu ve pano üçü de oradan okuyor.
Teğet noktası DEĞİL merkez doğrultusu kullanılıyor — teğet için çözücü gerekir,
graf ise çözücüsüz de çalışmak zorunda.

**"Otomatik Düzenle" FEAD'de kendi yerleştiricisine gider** (`veTidyLayout` →
`veFeadArrangeGraph`). Genel yerleştirici katmanlı bir DAG düzeni kurar; FEAD
bir ÇEVRİM, katmanlamak onu keyfî bir yerden kırar ve dönüş kenarını her şeyin
üstünden geçirir. Kasnak biçimi/ölçüsü ise **`saveState()`'ten** tazelenir —
Kayış Yolu kartıyla aynı tek nokta.

Kayış bağlantısı **düz çizgi ve amber** (`.ve-connection-fead-belt`): kayışın
kasnaklar arası parçası fizikte zaten bir doğru, ve bu tel "iki bileşen
ilişkili" demiyor, "kayış buradan geçiyor" diyor. Dışa aktarma (SVG/PNG) da
kasnağı daire + kesikli çeperle çiziyor — ekranda daire olanın çıktıda kutu
çıkması `node.data.labelPos` hatasının aynı sınıfıydı.

#### Kanvasta CANLI kayış yolu kartı (`fead-layout`)

"Kayış Yolu" düğümü bir düğme değil: tuvalin üstünde, topolojinin **yanında**
duran ölçekli bir şema (420×340). Girdi değiştikçe yeniden çizilir, yani
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

#### Çevrimdışı HTML rapor (`js/cp-fead-report.js`)

Tedarikçi (Gates) "Accessory Belt Drive System" çıktısının 11 sayfası, Takoz
raporuyla **AYNI görsel dilde** tek dosyalık çevrimdışı bir HTML'e dökülüyor.
Kalıp birebir Takoz'unki: sabit **teori şablonu** (§1–7, 9, 10, Ek A) +
çözümden üretilen **§8** + **Uygunluk hükmü**.

| Dosya | Sorumluluk |
|-------|-----------|
| `tools/report-assets/fead-theory-source.html` | Teori metni (elle yazılır) — tokenlar ZATEN içinde |
| `tools/report-assets/build-fead-report-template.js` | Doğrula → KaTeX önyükleyiciyi ekle → base64 (`npm run build:fead-report`) |
| `js/fead-report-template.js` | Üretilen şablon (`window.FEAD_REPORT_TEMPLATE_B64`) — **elle düzenlenmez** |
| `js/cp-fead-report.js` | Panel · giriş · antet · §8 (18 alt bölüm) · Uygunluk · 6 SVG şekli |

Takoz şablonundan **tek yapısal farkı**: orada derleyici harici bir referans
belgeyi regex ameliyatıyla token'lıyordu; burada kaynak zaten token'lı yazıldı,
derleyici yalnız **doğruluyor**. Regex ameliyatı, kaynak metin bir kelime
değiştiğinde sessizce yanlış yere token koyabilecek tek yerdi.

**KaTeX ve fontlar Takoz raporuyla ORTAK** (`window.MNT_REPORT_ASSETS`, ~1 MB).
İkinci bir kopyanın karşılığı yok; `js/results.js` de aynısını yapıyor. Varlık
yükleyicideki **sayaç döngüden ÖNCE kurulur** — Takoz'daki tuzağın aynısı:
artışı döngü içine koymak tek dosya build'inde her oturumun ilk rapor denemesini
kırıyor, `index.html`'de görünmüyor.

Ad öneki **`_fr…`** (`cp-mount-report.js` `_r…`, `cp-fead.js` `_fead…`
kullanıyor) — aynı adı iki dosyada üst-seviye bildirmek `source-hygiene`
kapısına takılır. `getFeadReportPropertiesHTML` bu yüzden `cp-fead.js`'ten
**silinip** buraya taşındı.

##### Uydurulmayan şeyler — raporun kendi §9'unda yazılı

| Gates sayfası | Neden yok |
|---|---|
| Natural Frequency / System Resonance | Çok serbestlik dereceli **burulma** modu; çekirdek yalnız gergi kol modu verir (ölçüldü: %19 fark) |
| Pulley Alignment Sensitivity | Geometri tek düzlemde çözülüyor; fleeting açısı ve eksenel offset modelde yok |
| Belt Slip Sensitivity taraması | "En kritik ivme + yük kombinasyonu" araması ve ters çözüm çekirdekte yok |
| Weibull / incidents per 1000 | İstatistiksel dağılım modeli yok |
| Peak Torque eğrisi | Ayrı büyüklük; §8.13 açıkça **"ortalama"** diyor |

##### İki sessiz birim tuzağı (ikisi de testli)

`wearPct` çekirdekte **ORAN** (0,007), tedarikçi sayfasında **%0,70** — ham
basılsaydı okuyan kişi payı yüz kat küçük sanırdı. `Number(null) === 0` ise
girilmemiş bir alanı "0 ölçüldü" gibi gösterirdi; `_frNum` null/undefined/''
değerlerini NaN'a çeviriyor ve rapor `—` basıyor.

##### Grafik ölçeği — tekillik kesilir

Belt Tension Control grafiğinde kol açısı çözüm aralığının ucuna yaklaşırken
gerginlik **tekilleşiyor** (T milyarlara çıkıyor). Ham veriye göre ölçeklenen
eksen grafiği okunmaz yapıyordu: çalışma noktaları x ekseninin üstüne yapışıyor,
y etiketleri 9 haneli sayıya dönüyordu (ölçüldü). Eksen çalışma konumlarının
gerginliğine göre sınırlanıyor ve eğri orada kesiliyor — Gates çıktısı da öyle.
Tolerans/aşınma 0 iken dört konum aynı açıya oturduğu için etiketler **tek
çizgide birleştiriliyor**.

##### Biçim: devir SATIR, kasnak SÜTUN

§8.11 ve §8.17 devir başına ayrı tablo basıyordu; aynı span boyları dokuz kez
tekrarlanıyor ve belge 41 000 px'e çıkıyordu (ölçüldü). Matris biçiminde bir
sütunu yukarıdan aşağı okumak, o kasnağın devirle nasıl değiştiğini doğrudan
gösteriyor — tedarikçi sayfasının biçimi de bu.

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
| **Tasarım gerginliği** ↔ **yay dengesi** | bütün gerilme ve hubloadlar 250 N kayar | kayma emniyeti bir ORAN, değişmiyor |

Birincisi: sayfa serbest açıyı VERMİYOR, gergi kasnağının **montaj merkezini**
veriyor. Serbest açı `veFeadFreeAngleFrom` ile türetilir
(`montajAçı − sense × (Mean−Pre)/Rate`); `sense`i çekirdek bulduğu için
`veFeadBuildSystem` **iki geçiş** yapıyor. `|montaj merkezi − pivot|` ile
girilen kol boyu 0.5 mm'den fazla ayrılırsa çözüm DURUR — iki sayı da sayfada
yazar, uyuşmazlık okuma hatasıdır. Panel varsayılanı VERİDEN çözülür
(`veFeadAngleMode`): eski kayıtlar yalnız `freeAngleDeg` taşıdığı için koşulsuz
`mount` varsayılanı onları açılışta çözülemez yapardı.

İkincisi `veFeadBuildSystem` sonundaki uyarı: `designTensionN` gergi yay
dengesinden %2'den fazla ayrılırsa kaymanın kaç newton olduğu yazılıyor.

Servis faktörü (sayfada 1.3) kayma emniyetinin istenen alt sınırı olarak sonuç
tablosunda hüküm veriyor — eşik eskiden 1.3'te SABİTTİ, artık kullanıcının
girdiği değer.

**Sırada:** Sonuçlar sayfasında FEAD çözüm sekmesi (kanal yayını).

### Ölçüm Görüntüleyici (`viewer/`)

MFSim'in içe aktarma + diyagram özelliğinin tek başına çalışan sürümü; tek HTML
dosyası olarak dağıtılıyor. `viewer/js/` altındaki YEDİ dosya `js/`'ten
**birebir kopya** (`trace-view.js`'te iki işaretli fark hariç). Bu yüzden:

**İçe aktarma / şerit diyagramı tarafında bir düzeltme yaparsan
(`xlsx-read.js`, `measure-import*.js`, `measure-core.js`, `signal-tree.js`,
`trace-view.js`, `measure-dropzone.js`), düzeltmeyi `viewer/js/` altına da taşı:**

```bash
npm run sync:viewer && npm run build:viewer
```

Elle `cp` YAPMA — `trace-view.js`'in iki yerel farkı var ve elle uzlaştırma bir
kez yanlış yapıldı (görüntüleyici açılışta hata veriyordu). Farkların metni
`viewer/sync.js` içinde; çapa tutmazsa script durur, sessizce yanlış dosya
üretmez. `npm test` senkron bozulunca kırmızıya döner
(`tests/unit/viewer-sync.test.js`). Ayrıntı: `viewer/README.md`.

`viewer/js/theme.js`, `board.js`, `app.js` görüntüleyiciye özgüdür, kopya
değildir — MFSim'den taşınmaz.

**`css/` DE GÖRÜNTÜLEYİCİYE GİRİYOR — kolay kaçırılan kapı.** `viewer/build.js`
`../css/*.css` dosyalarını da inline ediyor. Yani `css/styles.css`'te yapılan
HERHANGİ bir değişiklik `MFSim_Olcum_Goruntuleyici.html`'i BAYATLATIR; dosya
git'e dahil olduğu için CI'daki "Dağıtım dosyası taze mi" kapısı
(`build:viewer` + `git diff --exit-code`) kırmızıya döner. `viewer/js/` hiç
değişmediğinden `sync:viewer --check` bunu YAKALAMAZ ve `npm test` de yeşil
kalır — bir kez tam olarak böyle kaçtı. Kural:

```bash
# css/ VEYA viewer/js/ dokunulduysa, commit'ten önce:
npm run build:viewer     # ve üretilen HTML'i commit'e dahil et
```

## Çalışma Akışı (hızlı döngü)

Amaç: her küçük değişikliği build+tüm-test töreni yapmadan geliştirmek.
Önemli gerçek: **birim testler build'e ihtiyaç duymaz** — testler doğrudan
`js/` dosyalarını yükler, `MFSim_Code.html`'e dokunmaz. Build yalnızca
E2E ve deploy için gerekir.

### Geliştirirken: watch modu (döngünün merkezi)
```bash
npm run test:watch      # arka planda açık kalsın; kaydettikçe İLGİLİ testler <1s'de koşar
```
Bu terminali açık bırak. Dosyayı kaydet → sadece değişimden etkilenen testler
otomatik koşar. Elle `npm run build` / `npm test` döngüsü YOK.

Watch modu yoksa, yalnızca değişen dosyalara bağlı testler:
```bash
npm run test:changed    # jest -o — git'te değişen dosyalarla ilgili testler
```

### Commit'ten HEMEN ÖNCE (tek sefer)
```bash
npm run build           # MFSim_Code.html üret
npm test                # tüm birim testleri (sessiz)
```
İkisi de yeşilse commit et (build çıktısı dahil). Yani build ve tam test
her düzenlemede değil, **commit başına bir kez** çalışır.

### E2E (opsiyonel, yalnızca UI akışını etkileyen değişikliklerde)
```bash
npm run test:e2e        # Chromium gerekir: npx playwright install chromium
```

## Test Politikası — hangi değişikliğe test yazılır?

Amaç: "her fonksiyona test" değil, **değer başına test**. Kırılgan testler
her UI rötuşunda kırılıp süreci uzatır.

**Test YAZ (yüksek değer):** mantık, matematik, sayısal çekirdek, veri
dönüşümü, durum yönetimi. Örnek: `numerics` (RK45/PCHIP), `mount-core`,
`solver`, `state` (undo/redo), kaydetme/serileştirme, topoloji tarama.
Bunlarda sessiz bir regresyon "makul ama yanlış" sonuç üretir; gözle
yakalanmaz — testin karşılığı burada.

**Test YAZMA (düşük değer / kırılgan):** yalnızca HTML string üreten sunum
fonksiyonları için `expect(html).toContain('...etiket/id...')` testleri.
Bunlar bir etiketi değiştirince kırılır, davranışı değil detayı test eder.
Gerekiyorsa panel başına **tek** bir "üretiliyor mu / patlamıyor mu" smoke
testi yeter; her alan/etiket için ayrı assertion açma.

### Yeni birim testi yazma şablonu

Ortak boilerplate `tests/helpers/setup.js`'te merkezi (jest `setupFiles`):
`loadSource()`, `stubGlobals()`, `resetStubs()` her test dosyasında hazır.

```js
// module.exports guard'ı olan modül → doğrudan require:
const core = require('../../js/mount-core.js');

// Üst-seviye (global) fonksiyon bildiren modül → stub + eval:
const stubs = stubGlobals();            // showToast/saveState/... = jest.fn()
eval(loadSource('sensors.js'));         // üst-seviye fonksiyonlar test kapsamına gelir
beforeEach(() => resetStubs(stubs));
```

Referans örnek: `tests/unit/sensors.test.js`.

## Test Dosyaları

| Dosya | Test Edilen Modül | Kapsam |
|-------|-------------------|--------|
| `tests/unit/signal-tree.test.js` | `js/signal-tree.js` | Arama katlaması, üç-durumlu grup, istatistik, mini eğri, kanal toplama |
| `tests/unit/trace-view.test.js` | `js/trace-view.js` | Şerit uzlaştırma, ayrık/metin kanal tespiti, Y aralığı, şerit yerleşimi, tutamak isabeti, logaritmik X ve Y ekseni, **birleşik şeritte sinyal başına Y ekseni**, açılır pencere kapatıcısının GECİKMESİZ bağlanması |
| `tests/unit/measure-core.test.js` | `js/measure-core.js` | Örnek kilitleme, pencerenin tek X ekseni kuralı |
| `tests/unit/numerics.test.js` | `js/numerics.js` | PCHIP spline, RK45 solver, enerji dengesi |
| `tests/unit/mount-signals.test.js` | `js/mount-signals.js` | Takoz kanalları: FRF ızgarası, Campbell mertebe/mod çizgileri, F(δ) yasası, ivme süpürmesi, kanal kimliği, diyagram yorumu |
| `tests/unit/mount-brief.test.js` | `js/mount-brief.js` | Yorumun sayısal çekirdeği: tepe bulma, izolasyon başlangıcı, ilk çekme, ara değerleme, Campbell kesişim devri |
| `tests/unit/mount-capacity.test.js` | `js/cp-mount.js` + `js/mount-brief.js` + `js/cp-mount-report.js` | Taşıma kapasitesi: kg→N dönüşümü, kapasite çizgisi, % kullanım, Rapor sütunu |
| `tests/unit/mount-isolation-3dir.test.js` | `js/cp-mount-report.js` | Ateşleme frekansında X/Y/Z izolasyon yüzdesi (tam 6 SD), tedarikçi raporuyla karşılaştırma |
| `tests/unit/mount-shock.test.js` | `js/mount-core.js` şok + `js/mount-signals.js` | Newmark-β geçici rejim: yarı-statik limit, sönümsüz enerji korunumu, modal salınım frekansı, durdurucu uyarısı |
| `tests/unit/arac-example.test.js` | `js/cp-arac-example.js` + `assets/examples/ap_*` | Araç Performans örnek kartları: kayıt defteri ↔ disk tutarlılığı, öksüz dosya yok, her örnekte çalışır güç aktarma zinciri |
| `tests/unit/node-label-anchor.test.js` | `js/components.js` `veNodeLabelAnchor` + `js/export-topology.js` + `js/topology.js` | Düğüm ADININ çizim çıpası tek kaynaktan: `node.data.labelPos` (üst/sol/sağ/alt) yalnız canlı kanvasta okunuyordu; dışa aktarılan SVG/PNG ve şerit paneli adı hep kutunun ALTINA çiziyordu — ekranda tellerden kaçırılan ad çıktıda yine şeritteydi |
| `tests/unit/arac-example-layout.test.js` | `assets/examples/ap_*` + `js/cp-arac-performans.js` | **Kanonik yerleşim kapısı**: şaft ekseni (zincirin dört bağlantısı tam yatay), fan simetrisi, dik açılı telin ne bileşenin ne de bir ADIN üstünden geçmesi, kutu çakışmaması, `lineType` sözleşmesi (zincir `curve` / dal `stepped`), bütün örneklerin AYNI sütunlarda olması, `VE_ARAC_PERFORMANS_LAYOUT` ile birebir uyum (6×6'da fan dışı + fan sütunları), "Örneği Aktar"ın eklediği `ap-example` düğümünün boş köşeye düşmesi |
| `tests/unit/arac-performans-shift-4500sp.test.js` | `js/cp-gearbox.js` | Allison 4500 SP S1–S4 vites eşikleri; 2C→2L avlanma bekçisi + bütün profillerde yapısal kapı |
| `tests/unit/matching-selection.test.js` | `js/cp-gearbox.js` + `js/cp-torque-converter.js` + `assets/examples/ap_*` | "Hangi şanzıman/konvertör seçili?" çözümü (anahtar → ad → oran/eğri eşleşmesi) + örneklerin preset anahtarı sayılarla tutarlı |
| `tests/unit/arac-example-data.test.js` | `assets/examples/ap_*` | **Girdi bütünlüğü**: kütle/alan/Cd/aks/Crr/vites/transfer/governed/aksesuar/pumpTorqueDrop iSCAAN raporlarıyla doğrulanmış değerlere sabitlendi |
| `tests/unit/arac-example-calibration.test.js` | `js/ft-performance.js` + `assets/examples/ap_*` | **Filo kalibrasyon kapısı**: 13 örnek gerçek zincirle koşuyor — stall devri, tavan hız (iSCAAN Performance Summary bandı), 0-20/40/60/80 altın çıpaları, **81 vites geçiş noktası** + avlanma bekçisi |
| `tests/unit/arac-performans-shift-2957sp.test.js` | `js/cp-gearbox.js` | Allison 2957 SP Wide DynActive: dokuz geçişin de N_motor 2400'e oturması, a = 1/i kuralı |
| `tests/unit/arac-performans-transfer-roles.test.js` | `js/ft-performance.js` | Transfer kademe rolü orandan çözülüyor (dizi konumundan değil) |
| `tests/unit/gear-efficiency.test.js` | `js/ft-performance.js` + `js/cp-gearbox.js` | Dişli verimi: şanzıman bazlı ölçülmüş katsayılar, vites başına tablo (2957 SP), stall kaybı, geri viteste NaN yok |
| `tests/unit/mount-example-names.test.js` | `js/mount-core.js` örnekleri + `assets/examples/*.json` | Örnek modellerde ad ↔ konum tutarlılığı (Sağ/Sol ↔ Y işareti), tekrarlı ad, iki kopyanın ayrışmaması |
| `tests/unit/mount-results-tab.test.js` | `js/results.js` + `js/graphics.js` | Takoz çözüm sekmesi, tek X ekseni kuralı, pano uzlaştırma |
| `tests/unit/mount-results-publish.test.js` | `js/cp-mount.js` | Çözümün panoya yayını; alt-topoloji çökertme regresyonu |
| `tests/unit/fead-core.test.js` | `js/fead-core.js` + `tests/fixtures/fead-validation.js` | **FEAD çekirdeğinin doğrulama kapısı**: 17 Gates raporu / 2095 değer (çalışma %0.5, Load dahil %1.5, kol açısı 0.2°), 8 koruma mekanizması, SPEC §9 yapısal özdeşlikleri (sarım değişmezi, `L_pitch−L_eff=2π·hb`, çevrim kapanışı, sürücü gücü), UMD tarayıcı köprüsü |
| `tests/unit/fead-model.test.js` | `js/fead-model.js` | **Köprü kapısı**: AG00686 MFSim KANVAS DÜĞÜMÜ olarak kurulup Gates sayılarını üretiyor mu (span %0.5, sarım 0.2°, Mean kol açısı 0.2°); temas tarafı üç katmanlı çözümü, sürücü rolü, `dia→od` göçü, ad tekilleştirme, hata çevirisi. Ayrıca **ters temas tarafının hata VERMEDİĞİNİ** belgeler (rozetin varlık nedeni). **Duty kapısı**: AG00686 duty tablosunun çıkış gerilmeleri ve hubload'ları %0.5 içinde; kW'ın kimlikle anahtarlanması (yeniden adlandırmada kaybolmuyor), sürücü gücünün toplamdan hesaplanması, ateşleme frekansı, yorulma dağılımının çapa bağlı olması, katalog oranının ÇAPTAN hesaplanması |
| `tests/unit/cp-fead.test.js` | `js/cp-fead.js` + `js/components.js` | FEAD sunum katmanı: kanvas rozeti, `feadContact` varsayılanları, panel smoke testleri, alt-sistem sözleşmesi, `fead-*` tip tanımları; panelin HANGİ ALANLARI sorduğu (montaj merkezi ↔ serbest açı), servis faktörü hükmü; **kayışın kaburgalı yüzü** (diş yönü + aynalanmış çevrim) ve **telin komşuya bakan kenarı** (oran kuralı, elle taşınan portun kazanması) |
| `tests/unit/cp-fead-report.test.js` | `js/cp-fead-report.js` + `tools/report-assets/fead-theory-source.html` | **Rapor içeriği**: Türkçe sayı biçimi (gerçek eksi, `—` ≠ 0), `wearPct` oran→yüzde çevrimi, sarım açılarının DERECE basılması, Σsarım=360 ve `L_pitch−L_eff=2πh_b` denetimlerinin belgede görünmesi, sürücü kW sütununun duty tablosunda OLMAMASI, çözülemeyen konumun `Err.` ile işaretlenmesi, `undefined`/`NaN`/`[object` sızmaması, "ortalama tork ≠ peak", sistem burulma modunun yokluğunun yazılması, uygunluk hükmünün servis faktörünü kullanması, şekil/tablo numaralarının boşluksuz ve her üretimde sıfırlanması, şablon tokenlarının tek kez geçmesi, içindekiler id'lerinin üreteçle aynı olması |
| `tests/unit/fead-example.test.js` | `js/fead-model.js` örnekleri + FEAD_INFORMATION | **Tedarikçi sayfası çıpası** (Gates'ten bağımsız ikinci doğrulama): kayış boyu 1715 mm, kol boyu 90.0 mm, Spring Mean Load 22.07 Nm, tahrik oranı 1.1; sayfanın devir→kW tabloları; **iki sessiz kanalın** ölçülmüş belgesi (montaj merkezi ↔ serbest açı 2.6×, tasarım gerginliği ↔ yay dengesi 250 N) |
| `tests/unit/canvas-space.test.js` | `js/canvas-space.js` | Sonsuz ızgara deseni, "ev" kamerası, topoloji ortalama |
| `tests/unit/module-start-center.test.js` | `js/components.js` `veStartModule` | Karşılama kartından gelen modül bloğu görünümün TAM ortasına düşer (kabuk senkronu ölçümden önce) |
| `tests/unit/port-geometry.test.js` | `js/components.js` port geometrisi + `js/connections.js` | Bağlantı ucu ile port dairesi aynı noktada — dört kenar, çok port, aynalama; **gidiş yönü oku** (Bézier t=0.5, 46 px eşiği, ters yön) |
| `tests/unit/module-card.test.js` | `js/components.js` alt-sistem kartı + sidebar modül satırı | Modül kartı: içerik özeti (alt topolojiden), kart ölçüsünün tek kaynağı, eski 80×66 kaydın yükselmesi, **ad elemanının taşınması** (kopyalansaydı yeniden adlandırma sessizce eskirdi); palet sembolü `componentDefs`'ten (index.html'de ikinci kopya tutulmadığına dair kapı) |
| `tests/unit/example-topology-center.test.js` | `js/cp-mount.js` + `assets/examples/` | Örnek JSON'ları kanvas merkezine açar |
| `tests/unit/state.test.js` | `js/state.js` | Undo/redo stack yönetimi |
| `tests/unit/toolbar-save.test.js` | `js/toolbar.js` | Proje kaydetme, JSON serileştirme, showSaveFilePicker |
| `tests/unit/viewer-board.test.js` | `viewer/js/board.js` | Görüntüleyici panosu: bir panoda tek ölçüm dosyası kuralı, X ekseni seçenekleri, veri kapısı |
| `tests/unit/viewer-sync.test.js` | `viewer/sync.js` | Görüntüleyici kopyaları `js/`'ten geride kaldıysa kırmızı — sessiz ayrışmaya karşı kapı |
| `tests/unit/measure-dropzone.test.js` | `js/measure-dropzone.js` | Sürükle-bırak uzantı süzgeci (sessiz yanlış çıktıya karşı) |
| `tests/unit/simulation-engine-grade.test.js` | `js/simulation-engine.js` | Yol eğimi işaret konvansiyonu (harita ↔ fizik çevirisi) + dinamiğin değişmediğini bağlayan altın değerler |
| `tests/unit/shot-tool.test.js` | `tools/shot.js` | Ekran görüntüsü aracının ayrıştırma çekirdeği: bilinmeyen bayrağın SESSİZCE yutulmaması (yanlış ekranın görüntüsü alınırdı), hedef takma adları, PNG ölçüsü, karşılaştırmanın İKİ GÖRÜNTÜYÜ TEK ÖLÇEKLE küçültmesi |
| `tests/unit/source-hygiene.test.js` | `js/`, `viewer/js/`, `css/`, `index.html` | **Yapısal kapılar**: üst-seviye bildirim çakışması yok, kaynakta kontrol karakteri yok |
| `tests/unit/results-txt-preview-download.test.js` | `js/results.js` | TXT önizlemesinin "HTML İndir" yolu — iki rapor üreticisinin ayrı kaldığı ve düğme kablolaması |
| `tests/e2e/app.spec.js` | Tüm uygulama | Sayfa yükleme, menüler, bileşen ekleme, kaydetme |
| `tests/e2e/measure-import.spec.js` | İçe aktarma sihirbazı | Gerçek .xlsx → sütun tarama → X/Y seçimi → şeritler |
| `tests/e2e/viewer.spec.js` | `MFSim_Olcum_Goruntuleyici.html` | **Üretilen tek dosya**, `file://` üzerinden: açılış, içe aktarma, sürükle-bırak, birleştirme, tema, sıfır ağ isteği |
| `tests/e2e/measure-merge-drop.spec.js` | `js/measure-dropzone.js` + `js/trace-view.js` | MFSim'de sürükle-bırak ve çok eksenli birleştirme — araç performans VE takoz sekmesi |

## Sık Kullanılan Komutlar

```bash
npm run test:watch          # ★ geliştirme döngüsü — kaydettikçe ilgili testler koşar
npm run test:changed        # git'te değişen dosyalarla ilgili testler (jest -o)
npm test                    # tüm birim testleri (sessiz) — commit öncesi
npm run test:ci             # tüm birim testleri (--verbose --ci) — CI logları için
npm run build               # MFSim_Code.html üret (modüler → monolitik) — commit/deploy öncesi
npm run sync:viewer         # js/ → viewer/js/ (yedi kopya + iki yerel fark)
npm run build:viewer        # MFSim_Olcum_Goruntuleyici.html üret (Ölçüm Görüntüleyici)
npm run build:all           # ikisi birden
npm run shot -- --help      # ekran görüntüsü — İSTEĞE BAĞLI, yalnız kullanıcı isteyince
npm run test:e2e            # E2E testleri (Chromium gerekli)
npm run test:all            # birim + E2E
```

## Teslim Akışı — PR + merge OTOMATİK

Kullanıcı talimatı (2026-07-31): **her güncellemeden sonra PR aç ve merge et.**
Ayrıca sorma, ayrıca onay bekleme.

Sıra — her adım bir öncekine KAPI:

```bash
npm run build     # MFSim_Code.html üret
npm test          # tüm birim testleri
```

1. `npm run build` + `npm test` **ikisi de yeşil** olmadan commit YOK.
2. Commit → `git push -u origin <dal>`
3. PR aç (gövdede: sorun, kök neden, ölçüm, test, doğrulama)
4. **Merge et** (`merge` yöntemi — depo geçmişi merge commit'i kullanıyor)
5. CI'ı izle ve sonucu kullanıcıya bildir. CI artık **PR'da da koşar** (yalnız
   `test` job'u; `build`/`deploy` PR'da atlanır) — yani kırık kod merge'den ÖNCE
   yakalanır. `main`'e push'ta üç job da koşar ve Pages'e yayınlar.
   `test` job'u ayrıca iki kapı içerir: görüntüleyici senkronu
   (`npm run sync:viewer -- --check`) ve `MFSim_Olcum_Goruntuleyici.html`'in
   kaynaklarla taze olması (yeniden üretip `git diff --exit-code`).

**Kapı kuralı:** testler kırmızıysa ya da build patlıyorsa merge etme —
durumu kullanıcıya söyle. "Otomatik merge" testleri atlamak demek değil;
tören kısaltılıyor, doğrulama kısaltılmıyor.

Yeşil testler tek başına "düzeldi" demek değildir: kullanıcının bildirdiği
senaryo birebir yeniden üretilip ESKİ kodda kırıldığı, YENİ kodda geçtiği
ölçülmeden sonuç kesin dille sunulmaz.
