---
name: fead
description: MFSim FEAD (kayış-kasnak / accessory belt drive) modülünün karar kaydı ve dokunulmazlıkları. js/fead-core.js, js/fead-model.js, js/fead-belts.js, js/fead-duty.js, js/fead-tensioners.js, js/cp-fead.js, js/cp-fead-report.js, js/cp-fead-summary.js, js/cp-fead-wizard.js, js/guide-fead.js, js/fead-step.js, js/step-p21.js dosyalarından birine ya da FEAD testlerine (tests/unit/fead-*, cp-fead*, gates-archive, guide-fead, tests/e2e/fead-*) dokunmadan ÖNCE çağır. Çekirdeğin birebir durma kuralı, 2095 referans değerlik doğrulama kapısı, kasnakların kanvasta KUTUSU OLMAMASI (giriş Kayış Yolu çiziminden — Çizim Masası; kesin sayı Kayış Tablosu çekmecesinde), gergi tanımı, katalog ve rapor kuralları buradadır.
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
4. **KASNAKLARIN KANVASTA KUTUSU YOK** (2026-09-09, kullanıcı isteği).
   Kasnaklar MODELDE düğüm olarak durur — panel dağıtımı, geri-al,
   kaydetme/yükleme, şema göçü ve `veFeadSet` hepsi düğüm kimliğinden çalışır —
   ama kanvasa kutu ÇİZİLMEZ (`componentDefs.noCanvasBox` → `veIsCanvasHidden`,
   components.js). Kasnak **Kayış Yolu çiziminde** seçilir, taşınır ve eklenir
   (kural 32); kesin sayı **Kayış Tablosu çekmecesinde**. Detay panele
   çizimdeki kasnağa ya da tablodaki ADA tıklanarak gidilir.
   **Kapı ALTI yerde** ve hepsi kutunun varlığını varsayan süpürmeler: DOM
   kuran iki yol (`createNode` · `restoreState`) ve kutu sınırı okuyan dört yol
   (`veBoundaryBox` · `veFitViewToContent` · minimap bbox · SVG/PNG dışa
   aktarma). Biri atlanırsa hata sessizdir: çerçeve boş alanı sarar, "içeriğe
   sığdır" hiçbir şeyin olmadığı yere kaçar.
   **Kanvas ↔ mm köprüsü ve `fead-coordlink` bileşeni bununla birlikte KALKTI**
   (`veFeadPlaceFromCoords`, `veFeadSyncDrag`, `veFeadCanvasToMm`,
   `veFeadMmToCanvas`, `veFeadSyncMmFromCanvas`, `veFeadSyncCanvasFromMm`,
   `veFeadNodeCenter`, `veFeadDragTensioner`, `veFeadCoordLinkOn`). Kapı:
   `cp-fead.test.js` → *"kasnak KUTULARI ve kanvas↔mm köprüsü KALDIRILDI"*.
5. **BOŞ BİR FEAD TOPOLOJİSİ SİHİRBAZLA KARŞILAR** (2026-09-09, kullanıcı
   isteği). `veFeadOpenEditor` KAYITSIZ bir alt topoloji kurduğunda
   (`_yeniTopoloji` bayrağı) `veFeadWizOpenAny()` çağrılır; kurulmuş bir modele
   dönerken ve `_silent` geri-girişte AÇILMAZ — her girişte kapatılması gereken
   bir pencere karşılamayı engele çevirirdi. Açılış yüzeyi yine kurulur:
   sihirbaz + BOŞ Kayış Yolu kartı (2026-09-23; önce Kayış Tablosu kartıydı),
   boş hâli iki yolu söyler ("Sihirbazla kur" · "Tabloyu aç"). **Örnek ve
   sihirbaz o kartı geometri kartı olarak DEVRALIR ve yuvasını alır** —
   devralmasalar kanvasta üç çizim olurdu (ölçüldü). Kapılar:
   `cp-fead.test.js` → *"YEDEK YERLEŞİM"*, `fead-wizard.test.js` → *"BOŞ
   KAYIŞ YOLU varken"*. **"Başlangıç ve Örnekler" (`fead-example`)
   KALDIRILDI**: sunduğu iki şey (sihirbaz düğmesi + örnek listesi) sihirbazın
   1. adımında zaten vardı. Örnek KURUCUSU (`veFeadLoadExample`) duruyor.
   Kapılar: `cp-fead.test.js` → *"FEAD editörü açılışı"* ve *"Başlangıç ve
   Örnekler bileşeni kaldırıldı"*, `fead-sihirbaz-tablo.spec.js`.
6. **"Otomatik Düzenle" artık yalnız ARAÇ KARTLARINI dizer** — dizilecek kasnak
   yok. Kanvaslar sağda tek sıra, künyeler solda.
   **Dikey adım KUTUYU DEĞİL, kutu+ADI sayar** (`veFeadArrangeByCoords` →
   `adPayi`): ad kutunun ALTINDA duruyor, adım onu saymayınca araç kartlarında
   adın altında 2 px kalıyor ve komşunun dekorasyonu (seçim tutamağı ~5 px
   dışarı taşar, kayış kipi rozeti üst kenara oturur) adın üstüne biniyordu.
   Ölçü sınır çerçevesiyle AYNI kaynaktan (`veMeasureNodeLabel` +
   `veNodeLabelOverflow`); ölçülemezse pay 0 ve davranış birebir eski hâli.
   Kapı: `cp-fead.test.js` → *"ad KUTUNUN ALTINDA duruyor"*.
   **YERLEŞİM: kanvaslar YAN YANA** (kullanıcı isteği, 2026-09-14: *"Alt alta
   hiç estetik durmuyor"*) ve kurucuların YEDEK sırası da aynı şekli kurar
   (`veFeadFallbackSlots` — tek kaynak). Yedek yol Node'da
   ölçülemiyor (yerleştirici stub'lanamıyor, koordinatın üstüne yazıyor);
   kapısı `tests/e2e/fead-yerlesim.spec.js`. Ayrıntı:
   `references/kanvas-ve-kart.md` → *"YEDEK SIRA DA AYNI ŞEKLİ KURAR"*.
7. **KASNAKLAR BAĞLANMAZ — SIRA TABLODA** (2026-09-09). Kayış yolu bir graf
   değil bir liste: sıra `node.data.beltIndex` alanında, Kayış Tablosu'nun
   satır sırası. `beltIndex` **Gates TABLO sırasını** taşır (kayışın gidişinin
   TERSİ) ve `build.order`'ın kendisidir — çevirme yok; gidiş sırası isteyen
   `veFeadRouteFlip`'ten geçer. **Sıra SÜRÜCÜDEN başlar** (`veFeadBeltOrder`
   listeyi döndürür): "krank sabit, kalanı ters" kuralı, gergi konumu hükmü ve
   17 Gates raporunun tamamı buna dayanıyor. Kapı: `fead-table.test.js`,
   `fead-model.test.js` → *"kayış sırası — indisten, sürücüden başlayarak"*,
   `fead-wire-order-migration.test.js` (şema 3 → 4).
8. **Sürücülük ROL** (`node.data.driver`), tip değil. **Temas tarafı
   (grooved/back) gerçek alandır** — ters verilirse çekirdek hata VERMEZ,
   geçerli ama başka bir güzergâh çözer. Bu yüzden değer üç yüzeyde birden
   görünür: tip varsayılanı (`componentDefs.feadContact`) → kasnak paneli →
   **Kayış Tablosu'nun "Kasnak Dönüş Yönü" sütunu** (Sağ/Sol açılır listesi,
   `contact` alanını yazar). Kanvas rozeti (K/S) kutularla birlikte kalktı.
   **Çap = DIŞ ÇAP (`od`)**.
9. **Panel, tablo ve kart AYNI alanı okur.** Kol konumu, kayış kipi, yön gülü,
   dönüş yönü — ikinci bir ayar tutmak iki yüzeyin sessizce
   ayrışması demektir.
10. **Geçerlilik sınırı sonucun İÇİNDE taşınır.** Tepe yük `KALİBRE DEĞİL`
   damgasıyla, B10 çap penceresiyle, türetilen boy kökeniyle basılır. Sayı
   gizlenmez; sınırı yanında yazılır.
11. **Tazeleme tek noktadan.** Kanvas kartları ve — açıksa — Kayış Tablosu
    penceresi HEP BİRLİKTE, `veFeadRefreshCards`'tan; port DOM'u ve kart
    imzası `updateAllConnections`'tan. **Pencere bir kare SONRA kurulur ve
    odağı anahtarıyla geri verir** — aynı anda kurulsa Sekme ile geçilen
    hücre sökülür, ikinci sayı yazılamazdı (`fead-tablo.spec.js`). Kart başına ayrı çağrı, altı düzenleme
    yolundan birinde birinin unutulması demek — ve fark sessiz: iki kart kendi
    başına tutarlı görünür, yalnız biri bir düzenleme geride kalır. Kaynak
    kapısı `fead-table.test.js` içinde.
    **GERİ YÜKLEME İMZAYI UNUTUR** (`veFeadTopoInvalidate`, `restoreState`'in
    sonunda): geri yükleme kartı düğümünü kurarken kuruyor ve açılış kartı
    örnekte yeniden kullanıldığı için kasnaklardan ÖNCE geliyor — o an model
    yarım, kart "henüz kasnak yok" basıyor. İmza kapısı imzaya girmeyen bir
    alanın (katman, çözücü alanı) geri alınmasında tazelemeyi atlıyordu.
    Kapı: `geri-al-yolu.test.js` + `fead-cizim-masasi.spec.js` → *"CTRL+Z"*.
    **SEÇİM DEĞİŞİNCE KART KURULMAZ, SINIF EŞİTLENİR** (`veFeadMarkSelectedRow`,
    `cp-core.js`'in `addToSelection`/`clearSelection` merkezlerinden çağrılır):
    kasnakların kutusu olmadığı için `addToSelection`'ın kutuya yazdığı
    `selected` sınıfı onlarda hiçbir şeye yazmıyor; işaret çizimde (`.is-sel` ·
    `.is-hov`, `veFeadCizimIsaretle`) ve tablo satırında. Tam yeniden kurmak
    düzenlenen hücrenin odağını, çizimde fare altındaki öğeyi düşürürdü. Ölçüldü: çağrı
    olmadan işaret hiç tazelenmiyor ve tabloda paneli AÇIK OLMAYAN bir satır
    işaretli kalıyor — işaretin hiç olmamasından kötü.
12. **Negatif kapı (kutu döneminden kalan): `veFeadApplyBadge` kasnak kutusuna
    kesikli çember ÇİZMEZ.** Kasnakların kutusu artık hiç yok, yani rozet de
    çizilmiyor; kapı yine de duruyor çünkü "gerçek çap hayaleti" fikri geri
    gelirse bu kez TABLOYA ya da karta konmak istenir ve gerekçesi aynı.
    Gerçek çap hayaleti kullanıcı isteğiyle kaldırıldı; kapı sınıf adına değil
    biçime de bakıyor (`border-radius:50%` + `dashed`).
13. Oturumluk sonuç globali **`window.veFeadResults` proje değişince
    temizlenmeli** (`_feadForgetResults`) — yoksa yeni projede önceki projenin
    tabloları durur.
14. **KAYIŞ TABLOSU BİR IZGARA DEĞİL, KART LİSTESİ** (2026-09-21, kullanıcı
    isteği: *"görseller hiç hoşuma gitmiyor, özellikle tablo kısmı çok amatör
    durdu"* → üç yönlü tasarım tezgâhından **C · Kart Listesi** seçildi).
    `<table>` kalktı: her satır bir `.ve-fead-krt` ve ÜÇ BÖLGESİ var —
    `kim` (sıra · ad düğmesi · rol çipi) · `gir` (X · Y · D · Yön) ·
    `coz` (Ø eff · Sarım · Span, gömülü zeminde). **Defterin sütun SIRASI
    bölgelerin İÇİNDE korunuyor**; bölge genişlikleri `veFeadKartBolgeW`
    ile sütun listesinden türeyip `--fead-krt-*` özel özellikleriyle geçiyor
    (`<colgroup>` genişliklerinin yerini alan şey). **`coz` bölgesi `1fr`** ve
    genişliği YAZILMAZ — artan ne ise o; sabit yazılsaydı genişletilen kartın
    sağında ölü bir şerit kalırdı (ölçüldü: 782 px kartta 12 px).
    **Kayış boyu ve Σ toplam listeden KÜNYEYE geçti** — ikisi de satıra değil
    çevrime ait; `rowspan`lı kayış boyu hücresi beş satır boyu bir
    dikdörtgenin ortasında tek sayı taşıyordu (~170 px boş).
    **Dönüş Yönü artık İKİ DURUMLU SEGMENT**, `<select>` değil: iki seçenek de
    tek bakışta sığıyor ve tarayıcının oku listedeki en göze batan parçaydı
    (altı satırda altı ok). Seçenek sayısı ikiden çıkarsa bu karar geri alınır.
    Aşağıdaki kuralların hepsi kart listesinde de GEÇERLİ — yalnız taşıyıcıları
    değişti (`<col class="coz">` → `coz` bölgesinin zemini, `<th>` → alan
    etiketi + `title`).
    **GÖRÜNÜM CSS'TE** (`css/styles.css` → `.ve-fead-krt*` / `.ve-fead-tbl*`),
    satır içi `style=` dizelerinde DEĞİL. Gerekçe kozmetik değil yapısal: satır
    içi CSS DURUM İFADE EDEMEZ (`:hover`, `:focus`, `:nth-child` yazılamaz),
    yani fare hangi satırdaysa, imleç hangi hücredeyse, hangi kasnağın paneli
    açıksa — hiçbiri görünmezdi. Kullanıcının "demode ve ilkel" dediği şey bir
    renk tercihi değil, tam olarak o taşıyıcının sınırıydı. Satır içinde kalan
    tek şey VERİ: `--fead-krt-*` bölge genişlikleri. Vurgular
    `--accent-tint-*` / `--focus-ring` jetonlarından gelir (sabit `#3b82f6`
    değil) — projenin kendi kuralı, on tema tek renk dilini konuşsun.
    Kapı ÇİFT ve ayrı ayrı hiçbir şey ifade etmezler: `fead-table.test.js` →
    *"kart HTML'i satır içi RENK yazmıyor"* (JS tarafı) + *"DURUM KURALLARI
    CSS'te"* (CSS tarafı); ilki tek başınayken CSS bloğunu silmek bütün
    testleri yeşil bırakırdı. Gerçek tarayıcı ölçümü `fead-tablo.spec.js` →
    *"Kayış Tablosu CANLI"* (jsdom `:hover`ı da `:focus`u da hiç hesaplamaz).
    **AD HÜCRESİ BİR BAĞLANTI**, okunur bir metin değil: kasnak paneline giden
    tek yol o ve metin hâlindeyken varlığı ancak deneyerek keşfediliyordu.
    **Ve hücre o sözü TUTAR: `veFeadTableOpen` seçmekle kalmaz,
    `veTogglePropertiesPanel(true)` ile pencereyi de AÇAR** — `addToSelection`
    panelin yalnız İÇERİĞİNİ doldurur, `#ve-properties-overlay` bir modaldır ve
    kapalı kalırdı (ölçüldü: satır işaretleniyor, panelin HTML'i kuruluyor,
    ekranda hiçbir şey olmuyor). Kalıp projede zaten var — solver.js çözüm
    sonrası aynı çağrıyı yapıyor. Kapı: `fead-table.test.js` → *"ad hücresi
    paneli AÇIYOR"*.
    Afordans DİNLENMEDE duran "pencere açılır" simgesi (yazı karakteri DEĞİL
    çizim — eksik bir glif afordansın kendisini yok ederdi); kutu, zemin ve
    gölge yalnız fare altında geliyor, kimlik bölgesi bu yüzden
    `overflow:visible` (bir `overflow:hidden` gölgeyi de 1 px kalkışı da
    keserdi, yani "gölge olsun" isteği sessizce hiçbir şey yapmazdı).
    **KUTULU HÂLİ ÖLÇÜLDÜ VE GERİ ALINDI** (2026-09-10, gerçek tarayıcı): sayı
    hücreleri dinlenmede çerçevesiz olduğu için çerçeveli ad hücresi bir METİN
    ALANI gibi okunuyordu — sağ uca itilmiş simgeyle birlikte bir `<select>`
    okundan ayırt edilemiyordu. Kural iki yönlü: DÜĞME dinlenmede DOLU
    (basılır), ALAN dinlenmede BOŞ (yazılır); ikisi birden dolu ya da ikisi
    birden boş, ikisini de belirsiz bırakır.
    **GİRDİ/ÇÖZÜM AYRIMI YERLEŞİMİN KENDİSİNDE**, sözlü bir lejanttan değil.
    Izgara döneminde taşıyıcı bir sütun şeridiydi (`<col class="coz">`) ve
    sebebi hâlâ geçerli: sütun SIRASI defterle birebir olmak zorunda, yani
    bitişik bir "GİRDİ" bandı çizilemez. Kart listesinde ayrım BÖLGE:
    `coz`un zemini gömülü ve içinde yazılabilir hiçbir şey yok. Kapı bunu bir
    KURAL olarak tutuyor (sabit liste değil — her sütunun `yer` alanı `coz`
    bayrağıyla tutarlı olmak zorunda, yeni bir türetilen sütun sessizce
    girdi bölgesine düşmesin). ZEBRA YOK: satır zaten kendi kabında ve ikinci
    bir ton fare/seçim vurgusunun üstüne binerdi.
    **ÇEVRİM DENETİMİ ÜST KÜNYEDE**, kartın altında değil: tablonun tek
    EVET/HAYIR sorusu "kayış yolu kapandı mı" ve cevabı künyenin devamında
    okunur Türkçeyle duruyor (`✓ Çevrim kapalı · Σsarım 360.0°`). Alt şerit
    dört sayıyı kısaltmalarla diziyordu ve üçü zaten başka yerde okunuyor.
    Denetim `T.ok`un kopyası DEĞİL — geometri çözülüp Σ 360'tan saptığı hâl
    ayrıca kapılı.
    **EKLENEN SATIR GÖRÜŞ ALANINA ALINIR** (`_feadScrollRowIntoView`,
    `veFeadTableAdd` içinde ve tazelemeden SONRA — satır o çağrıyla doğuyor).
    Ölçüldü: yedinci kasnak listenin dibinin 35 px altına düşüyor ve tablo hiç
    kaymıyordu; kullanıcı "＋ Kasnak ekle" diyor, paneli açılıyor, ama
    dolduracağı satır ekranda yok. `block:'nearest'` — görünen satır listeyi
    ZIPLATMAZ. Kapı: `fead-table.test.js` + `fead-tablo.spec.js` →
    *"KASNAK EKLE"*.
    **TABLO KANVASTAN İNDİ** (2026-09-23, Çizim Masası): kanvas kartıyken
    açılış yakınlaştırmasıyla küçülen bir formdu. Artık Kayış Yolu kartının
    yüzen çubuğundaki "Tablo" düğmesiyle açılan, MODAL OLMAYAN bir ÇEKMECE
    (`veFeadTabloAc`): kanvasla ölçeklenmez (sayılar arayüzün `--fs-lg` basamağında), tek başlık
    satırı taşır, alan etiketi panelin grameriyle aynı ölçüde kalır
    (`fead-panel-gramer.spec.js`). `fead-table` tipi, paneli ve kart ölçüsü
    sabitleri KALKTI; kayıtlı kart şema 6 → 7 göçüyle silinir
    (`veFeadMigrateTableOff`). Kapılar: `fead-table.test.js` → *"bir kanvas
    bileşeni DEĞİL"*, `fead-wire-order-migration.test.js` → *"şema 7"*.
    **ÇEKMECE TUVALİN ALTINDA, ÜSTÜNDE DEĞİL** (2026-09-24, kullanıcı: *"Tablo
    açılıyor fakat kötü bir yere geliyor"*): kanvas alanının bir SATIRI —
    tuvalin altına yapışık, başlığı kabuğun bandı; tuval o kadar kısalır,
    hiçbir şey örtülmez (müfettiş sütununun kuralı — yüzen kart tuvali ve
    minimap'i örtüyordu). Kamera yalnız açılışta TAM görünen bir çizim
    kesilirse sığdırır, hiç yakınlaşmaz, kapanınca döner. Üst kenar tutamak
    (boy oturumluk, tuvale en az 180 px). Çekmecede çözüm bölgesinin TAVANI
    var: `1fr` geniş çekmecede üç sayıyı yayıyordu. **FEAD'e AİT**: kullanıcı
    FEAD'den çıkınca kapanır; arka plan kaydının sessiz gidiş-dönüşünde
    kapanmaz (denetim bir kare sonra). Kapılar: `fead-cizim-masasi.test.js` →
    *"Kayış Tablosu çekmecesi"*, `fead-tablo.spec.js` → *"ÇEKMECE"*.
    **ÇOK DÜĞÜM KURAN HER KURUCU `veStateBatch` İLE SARILIR** —
    `veFeadLoadExample`, `veFeadWizCreate`, `veFeadPopulateStarter`. Sarılmazsa
    Ctrl+Z modeli düğüm düğüm söker ve Kayış Tablosu önce boşalır, sonra
    kaybolur (kullanıcı bildirimi, ölçüldü). Açılış yüzeyi ayrıca yığının
    TABANI (`veStateResetBaseline`): modüle girip araçları almak bir düzenleme
    değil. Kapılar: `cp-fead.test.js` / `fead-wizard.test.js` (kurucular
    mekanizmadan geçiyor mu) + `fead-tablo.spec.js` → *"CTRL+Z"*; mekanizmanın
    kendisi `state.test.js`'te ve kuralı kökteki `CLAUDE.md`'de.
15. **KART NE ÇİZECEĞİNE KENDİ KARAR VERİR** (`VE_FEAD_KATMANLAR` ·
    `node.data.kat`). Çizicinin katmanları zaten vardı; eksik olan seçimin
    SAHİBİYDİ — bayraklar kart kurucusunda sabitti, yani ikinci bir kart
    açmak aynı resmi ikinci kez çizmekti. Seçim artık düğümün alanında ve
    kart başına ayrı; iki kanvas yan yana farklı katmanlarla durabilir
    (`maxInstances` bu yüzden kalktı).
    **LİSTE TEK KAYNAK**: kutucuk, varsayılan ve çiziciye giden seçenek adı
    aynı satırdan gelir — ikinci bir liste, panelde görünüp çizimde hiçbir şey
    yapmayan bir katman demekti ve bu SESSİZ olurdu.
    **EKSİK ANAHTAR VARSAYILANA DÜŞER**, kapalıya değil: eski kayıtta `kat`
    hiç yok ve o kart bugünkü görünümünü aynen korumalı. "Varsayılan" işlemi
    de alanı SİLER, sıfırla doldurmaz (dolduran hâl bugünün varsayılanını
    dondurup yarınkini kaçırırdı).
    **PANELİN AÇIK OLMASI MODELDE DEĞİL** (`VE_FEAD_KAT_ACIK`): görünüm
    durumu kaydedilmez ve geri-al yığınına yazılmaz — ama kart her değişimde
    yeniden kurulduğu için bir yerde durmak ZORUNDA, yoksa ilk tıklamada
    panel kapanır ve ikinci kutucuk işaretlenemez.
    **KOL KONUMU KART BAŞINA** (`veFeadPosMode(node)`). Bir dönem çalışma
    kartı bunu geometri kartından devralıyordu (`veFeadPosModeShared`, artık
    YOK): tek kart varken doğruydu, ikinci kanvas ise kendi seçicisini yazıp
    BİRİNCİ kartın konumunu çiziyordu.
    Görünüm CSS'te (`css/styles.css` → `.ve-fead-kat*`), kural 14'ün aynı
    gerekçesiyle. Kapılar: `tests/unit/fead-katman.test.js` +
    `tests/e2e/fead-katman.spec.js`.
16. **Uygunluk kapıları TEK ÇAĞRIDAN** (`js/fead-checks.js` · `veFeadChecks`):
    panel canlı hesaplar, rapor ise çözüm anında yazılan `R.checks`'i OKUR —
    yeniden hesaplasaydı çözümden sonra değiştirilen bir devir sınırı belgeye
    sızardı. Üç kural: merkez mesafesi kuralı **iki kasnaklı** V-kayış
    tahriklerinden geldiği için ihlali `'warn'` (tasarımı reddetmez, payı
    yazılır); çevrim oranı **pitch çapından** gelir (defterin dış çaplı ve elle
    yazılmış oranları %2,2 ve %27,8 sapıyor); eksik veri `'wait'`'tir ve
    **uygun sayılmaz**. Kapı: `tests/unit/fead-checks.test.js`.
    **Pencerelerin sağ sütunu ÜÇÜNCÜ yüzeydir** ve çözücüyü modelin kendisinden
    alır (`build.solver`): global taramayla argümansız aranınca hiç bulunmuyor,
    kapılar boş çevrimle soruluyordu — çözücü "uygun" derken sütun
    "değerlendirilemedi" diyordu. Kaynak metnine bakan kapı bunu göremezdi;
    kapı CEVABIN aynılığını ölçer (aynı dosya, *"sağ sütunu çözücü kartıyla
    AYNI hükmü"*).
17. **Katalog bir KISIT değil bir ÖNERİ** — kayış, gergi, motor ve aksesuar
    kütüphanelerinin dördünde de aynı kural. Elle girilen değer katalogtan
    üstündür; "elle" demek için değerin katalogtan FARKLI olması gerekir
    (yalnız "dolu mu" bakan bir tespit, katalogun kendi yazdığı alanları
    kullanıcıya mal ediyordu). Kapı: `tests/unit/fead-catalogs.test.js`.
    **Sapma ÜÇÜNDE DE raporlanır**: motor `veFeadEngineDrift`, aksesuar
    `veFeadAccLimits(...).kaynak`, gergi `veFeadTensionerDrift`. Üçüncüsü
    2026-09-14'e kadar YOKTU — künye seçip kol boyunu değiştiren kullanıcıya
    panel hâlâ künyenin adını yazıyordu. Gergide parça (kol · ön yük ·
    katsayı · çap · temas) ile montaj (çalışma momenti) AYRI raporlanır;
    momenti sapma saymak doğru kurulmuş her modeli uyarırdı.
18. **KATALOG ÇAPI DIŞ ÇAPTIR (`od`), PITCH DEĞİL.** Gates raporu kasnak
    çapını iki sütunda basar — `Flat` (dış) ve `Pitch` — ve sırttan temas eden
    kasnakta aralarında tam `2·h_r` vardır (PK/GATES: 2,20 mm). Gergi
    kütüphanesinin `od` alanı **on dört kaydın on dördünde de PITCH sütununu
    taşıyordu**; künyeyi uygulayan her model gergi kasnağını 2,20 mm büyük
    kurup kayış boyunu 0,67 mm kaydırıyordu (AG00976: 1715,28 ≠ 1714,61).
    Sessizdi — çevrim kapanıyor, çözüm çıkıyor. Kütüphanenin beş alanı arşive
    bağlıydı, `od` bağlı DEĞİLDİ; fixture kıyası da `od`'yi fixture'ın PITCH
    alanıyla eşitleyerek hatayı KORUYORDU. Kapı üç açıdan:
    `gates-archive.test.js` (Flat sütunu + `od+2·h_r` Pitch sütununda),
    `fead-tensioners.test.js` (fixture ilişkisi açıkça yazılı + çekirdeğin
    ürettiği pitch).

18. **KANVASIN TEK TİPİ VAR** (`fead-layout`); geometri ↔ işletme ayrımı bir
    ÖN AYARDIR (`node.data.katOn`), tip değil. `fead-run` diye bir bileşen
    yok. Açılışta yine İKİ kanvas gelir (örnek · sihirbaz · göç) ve ayrım
    kullanıcının **değiştirebildiği** şeydir — kural 15 geldikten sonra ikinci
    bir TİP aynı işi ikinci kez yapıyordu.
    Ön ayar **adıyla** taşınır (kopyasıyla değil) ve **devri de belirler**:
    geometri `devir:'off'` — donukluk eskiden tipin içindeydi, taşınmasaydı
    açılıştaki iki kanvas da animasyonlu gelirdi. Yazılmış bir alan ön ayarı
    susturur; ön ayar yalnız SÖZ SÖYLEDİĞİ alanı temizler.
    Sihirbazın araç eşleşmesi **tip + ön ayara** bakar (`_fwAracAnahtar`):
    yalnız tipe bakan bir eşleşme ya her kurulumda fazladan kanvas kurar ya da
    `nodes` sırası ters olduğunda geometri kartının üstüne işletme ön ayarını
    yazar — ikisi de sessiz. Kayıtlı `fead-run` düğümleri şema 5 → 6 göçüyle
    çevrilir (`veFeadMigrateRunToLayout`); çevrilmeseydi tanımsız tipli bir
    düğüm olarak kalırlardı. Ayrıntı ve kapı listesi
    `references/kanvas-ve-kart.md` → *"İKİ KANVAS, TEK TİP"*.
19. **ÖRNEĞE SAYI YAZMAK İÇİN KAYNAĞIN ONU SÖYLEMESİ GEREKİR.** Aksesuar devir
    sınırları on iki örneğin altısına yazıldı ve altısı da raporun KENDİ
    bileşen dosyasından çözüldü (`SD7H15-AC.cmp` · `AG810-250Amp-ALT.cmp` ·
    `TM31.cmp`); kalan altısında rapor modeli söylemiyor (`A_C.cmp`,
    `7_9kW_A_C.cmp`, katalogda olmayan `220Amp` ve `TM32`) ve **sınır
    yazılmadı**. Aksesuarın adı kataloğun yazımını kullanır ("Sanden 7H15",
    raporun `SD7H15`'i değil) — bağ o zaman gizli bir eşleme tablosu olmadan
    makineyle denetlenebiliyor. `accLib` YAZILMAZ: künye uygulamak raporun
    ölçülmüş kW eğrisini ezer, ve aynı modelin iki kaydı varken birini seçmek
    doğrulanamayan bir parça numarası iddiasıdır.
    **Motorun governed devri HİÇBİR örneğe yazılmaz** — arşivdeki on bir
    raporun hiçbirinde yok ve BMC sayfasının krank çapı (197,32) motor
    kataloğunda tam eşleşmiyor; en yakın dört kayıt governed'da ayrışıyor
    (2100 · 2200). Çevrim oranı kapısının "değerlendirilemedi" demesi bu
    yüzden DOĞRU davranıştır. Kapı: `fead-example.test.js`.
20. **SİHİRBAZ TOHUMU ALAN ALAN KOPYALAR — yeni alan İKİ YÖNE de eklenir.**
    `veFeadWizNodes` (durum → düğüm) devir sınırlarını taşıyordu,
    `veFeadWizSeed` (örnek → durum) taşımıyordu; örnekteki sınır kullanıcının
    gördüğü yolda (sihirbazın 1. adımı) sessizce düşüyor ve kurulan modelde
    uygunluk kapısı "değerlendirilemedi" diyordu. Kapı GİDİŞ-DÖNÜŞ ölçer, tek
    yön değil: `fead-wizard-catalog.test.js` → *"TOHUM → DÜĞÜM gidiş-dönüş"*.
21. **ŞEMADA HEM AD HEM SARIM AÇISI TAŞINIR.** Ad üstü, açı altı tercih eder
    (sıralar TERS — aynı olsaydı ikisi aynı yere koşar ve kaçınma hiçbir şey
    çözmezdi); adlar önce yerleşir ve açı için sert engel olur. Hiçbir aday
    temiz değilken geri düşüş **en az örtüşen** adaydır, ilk aday değil:
    boole ölçüt 3 px payla sıyıran adayı yazıyı tamamen örtenle eşit sayıyordu.
    Ölçüldü (420 çizim): çivili açı 117 çakışma → kendi aday listesi 60 → alan
    ölçütlü geri düşüş **0**. Kapı: `fead-card-design.test.js` →
    *"sarım açısı da KAÇAR"*.
    **Kanvas kartının yazısı arayüz ölçeğinden** (2026-09-25): kart çizimi
    kartın 1/k ölçüsünde üretilir, viewBox büyütür (`veFeadYaziK` =
    `--fs-micro` / 9). Etiket boyları ve yerleştirme ofsetleri kullanıcı
    biriminde kalır — DEĞİŞTİRİLMEZ; süpürme o ölçüyü de tarıyor (396×412).
    Rapor, küçük resim ve sihirbaz önizlemesi zaten büyütülerek gösteriliyor,
    onlara uygulanmaz. Kapı: `fead-cizim-masasi.test.js` → *"YAZI KATSAYISI"*.
    **Yüzen çubuğun bandı (`altPay`) ad ve açı için SERT engel; alt not ile
    gerilme ölçeği bandın ÜSTÜNDE çizilir** ve onlar da engel — gülün kuralı
    yazılara da uygulandı (ölçülmüştü: 68 yazı çubuğun altında, görünmüyordu).
    Pay yalnız kartta; rapor ve küçük resim değişmez. Kapı:
    `fead-card-design.test.js` → *"yüzen çubuğun altında yazı yok"*.
22. **AÇILIŞ KADRAJI: büyük kartlar SÜTUN DEĞİL, tek sıra** — iki kanvas yan
    yana (`veFeadArrangeByCoords` → `sira`). Üst üste dizilen büyük kartlar
    dar-uzun bir blok üretiyor ve geniş görüşe sığdırma yükseklikten
    sınırlanıyordu (ölçüldü: açılış zoom'u 0,473, görüşün %29,9'u). İki
    kanvas aynı modelin iki resmi; yan yana karşılaştırılıyor. Kapı:
    `cp-fead.test.js` → *"BÜYÜK kartlar"*.
23. **HER FEAD PANELİ AYNI KİMLİK SATIRINI ALIR.** Kasnaklar ve Çözücü
    `VE_WIDE_PANEL_TYPES`'ta DEĞİLDİ ve eksiklik bir karar değil bir atlamaydı:
    ikisi varsayılan (ortalı-simge) kimliğe düşüyor, gergi ve kayış kompakt-sol
    satıra — aynı modülün panelleri iki ayrı pencere gibi açılıyordu (başlık
    92 px ↔ 44 px, gerçek tarayıcıda ölçüldü).
    Panel kozmetiğinde iki kural daha, ikisi de ölçülmüş kusura karşı:
    **açıklama satırının ölçü sınırı var** (`.ve-fead-not`, 68ch — sınırsızken
    satırlar 207 karaktere çıkıyordu) ve **açılır liste sabit piksel değil**
    (`_FEAD_SEL`: taban + `auto` + tavan — sabit genişlik üç seçeneğin metnini
    kırpıyordu, en uzunu 169 px gerek / 120 px alan). Kapı:
    `source-hygiene.test.js` → *"FEAD panel kozmetiği"*.

24. **BİR GİRDİ İKİ YÜZEYDE SORULUYORSA LİSTESİ TEK KAYNAKTAN GELİR.** FEAD
    tahrik düzeni sihirbazda ve Çözücü panelinde ayrı ayrı yazılıydı: sihirbaz
    `crankDirect` kuruyor, panelin listesinde o değer HİÇ YOK, hiçbir seçenek
    `selected` almıyor, tarayıcı ilk seçeneği gösteriyor ve listeye dokunmak
    modeli sessizce `derive`a çeviriyordu. Liste artık `VE_FEAD_DRIVE_MODES`
    (fead-model.js). **Elle oran (`direct`) hiçbir yüzeyde ÜRETİLEMEZ**
    (kullanıcı kararı 2026-09-01; §2.3'ün en ciddi bulgusu) ama köprü onu
    okumaya devam eder — arşivdeki 12 Gates örneği öyle yazılı — ve panel
    seçeneği yalnız düğüm onu TAŞIYORSA basar. Kapı: `fead-defaults.test.js`
    → *"panelin listesi SİHİRBAZIN listesiyle birebir aynı"*, *"her düzen
    panelde SEÇİLİ geliyor"*, *"eski `direct` kaydı"*.

25. **SORULAN HER ALANIN BİR TÜKETİCİSİ OLMAK ZORUNDA.** `noLoadGovernedRpm`
    iki yüzeyde soruluyordu ve değerini okuyan hiçbir hesap, uygunluk kapısı
    ya da rapor satırı yoktu; katalogda duruyor, künye onu modele yazmaya
    devam ediyor, ama SORULMUYOR. Aynı kuralın tersi de geçerli: bir notun
    canlı bir alanı "hesaba katmaz" diye ilan etmesi de yasak — krank ataleti
    burulma modelini, ivme/yavaşlama tepe yük tablosunu besliyor. Kapı:
    `cp-fead.test.js` → *"NO LOAD GOVERNED sorulmuyor"* + *"alanları ölü İLAN
    ETMİYOR"*, `fead-wizard.test.js` → *"no load governed SORULMUYOR"*.
    Tarama: panelin sorduğu 53 alandan tüketicisi olmayan tek alan buydu.

26. **KALDIRILAN BİR YAPININ DİLİ DE KALDIRILIR.** Tel dönemi 2026-09-09'da
    bitti (kasnaklar bağlanmaz, sıra `beltIndex`); Dönüş Yönü paneli ve
    toast'ı "kablolama sırası · tel from → to · bağlantıları ters çevirir ·
    kanvastaki gidiş okları" demeye devam ediyordu ve FEAD modül paneli
    yapısal olarak hep 0 olan bir "Bağlantı" satırı basıyordu (on iki tipin
    on ikisinde de `inputs:0, outputs:0`). Kasnak K/S rozeti de aynı sınıftan:
    kutu kalkınca `getElementById` hep null döndü, kod erişilemez hâlde kaldı.
    Kapı: `cp-fead.test.js` → *"BAĞLANTI satırı yok"* + *"HİÇBİRİNDE port
    yok"* + *"KASNAK rozet almaz"*.

27. **ÇEKİRDEĞİN KUSURU KÖPRÜDE KAPATILIR — VE BÜTÜN ÇAĞRI YERLERİNDE.**
    `peakEstimate` atalet adımına `driveRatio`yu İKİ KEZ uyguluyor (`alpha`da
    bir, `speedRatio`da bir); düzeltme ataletleri `1/driveRatio` ile
    ölçeklemek ve sözlüğü BÜTÜN kasnaklar için doldurmaktır
    (`veFeadPeakInertias`). Krank kendi ataletini değil çevrimi kapatan
    eşdeğeri taşır — kayış krank kasnağını hızlandırmaz. Geçici rejim aynı
    sözlüğü okur (`veFeadScnInertias` ona delege eder); iki sözlük tutmak,
    senaryonun gerginlik-ivme eğiminin özet tablosundan sessizce ayrışması
    demekti. Kalibrasyon takımı bu sınıfı göremez: **arşivdeki Gates
    örneklerinin tamamı `driveRatio = 1`.** Kapı:
    `fead-denetim-bulgular.test.js` → *"bulgu 1"*, `cp-fead-summary.test.js`.

28. **ZİNCİR ETKİN GERGİNLİK TAŞIR; AÇIKLIK FREKANSI GERÇEĞİNİ İSTER.**
    Kasnak yüzey kuvveti hareketli kayışta `N = T − m′v²`, dolayısıyla
    çekirdeğin `T = M/(dL/dθ)` zinciri etkin gerginliktir ve hubload · kapstan
    oranı · güç akışı onunla TUTARLIDIR — dokunulmaz. Enine dalga denklemi
    ise `c² = T/m′ + v²` ister: köprü farkı `veFeadSpanFreqRows`ta kapatır,
    `TN` zincirin sayısı kalır, merkezkaç payı `TcN` ile ayrı taşınır. Gevşek
    açıklığa (T ≤ 0) pay EKLENMEZ, yoksa negatif gerginlik uyarısı gizlenirdi.
    **Bu düzeltme türetilmiştir, tedarikçiye kalibre DEĞİLDİR**: 11 Gates
    raporunun hiçbirinde açıklık frekansı sayı olarak yok (grafik basılıyor).
    Bir Gates açıklık frekans tablosu geldiğinde sınanacak ilk yer burasıdır.
    Kapı: `fead-denetim-bulgular.test.js` → *"bulgu 2"*, `fead-vibration.test.js`.

29. **RİJİT CİSİM MODU SABİT SAYIYLA AYIKLANAMAZ.** Frekansı analitik olarak
    tam sıfır ama Jacobi artığı matris normuyla büyüyor ve çekirdeğin sabit
    `1e-6 Hz` eşiğini aşabiliyor; aştığında `firstElasticHz` ~0 Hz döner.
    Eşik `veFeadTorsionalNorm` içinde GÖRELİ (en büyük modun 10⁻⁶ katı) ve
    **burulma modelinin ÜÇ çağrı yeri de** oradan geçer — panel/rapor, mod
    listesi ve mod animasyonu. Üçüncüsü atlanırsa kullanıcının mod listesinin
    başına rijit mod düşer ve "1. mod" animasyonu titreşim değil topyekûn
    dönüş gösterir. Sayım sonuçta taşınır (ikinci bir sıfır özdeğer sessizce
    elastik yapılmaz). Kapı: `fead-denetim-bulgular.test.js` → *"bulgu 3"*.

30. **ÇEKİRDEKTE TUZAK, KÖPRÜDE KAPI OLAN ÜÇ ŞEY KAPISIZ BIRAKILMAZ.**
    Sayı olarak geçilen `mu` (`analyze` `opt.muGrooved` arar), aynı adlı iki
    kasnağın yüklerinin birleşmesi (`veFeadUniqueNames` tekilleştirir) ve duty
    kapsamının %100'den sapması (rapor hüküm verir, çekirdek uyarmaz) —
    üçü de bugün kapalı, ama kapatan şey bir sonraki düzenlemede sessizce
    kalkabilir. Yorulma defterindeki **açık ayrışma** da kaydedilir, KAPATILMAZ:
    `ribTensionExp = 1.13` (kontrollü kaburga deneyi) kullanılmıyor, mutlak
    ömür `absolute.tensionExp = 0.96` koşuyor; değiştirmek kalibrasyon sabiti
    C'yi yeniden uydurmayı gerektirir. Kapı: `fead-denetim-bulgular.test.js`
    → *"bulgu 4·5·6"*.

31. **HER FEAD PENCERESİ KRANK KASNAĞI AİLESİNDE — DAR KAPTA DA** (2026-09-23,
    kullanıcı isteği: *"kategori kategori pencereler"*). Kabuk TEK üreticiden
    (`veFeadPanelShell`: kategori sekmeleri · sağ sütun). **Tepede özet şeridi
    YOK** (kullanıcı kararı, aynı gün: *"tepede böyle özet bir açıklamaya gerek
    yok"* — çipleri pencerenin kendisinde zaten yazılı olanı tekrar ediyordu);
    Kayış Yolu (Şema · Geometri), Rapor
    (Tür · Künye), Dönüş Yönü (Yön · Etkisi), Sihirbaz (Taslak · Adımlar) ve
    kökteki modül kartı (İçerik · Model) da bu kabukta. Pencerenin tek EYLEMİ
    sağ sütunda. **Modül kartı modelini ALT TOPOLOJİDEN kurar** — kökte
    `veFeadBuildFromCanvas` boş modeli çözerdi. "Her pencere" bir LİSTE değil
    KURAL olarak kapılı: `tests/unit/fead-pencere-ailesi.test.js` tipleri
    `componentDefs`ten, kurucuyu `cp-core.js`'in dağıtımından okur. **Tek sütuna geçişi PANELİN genişliği
    söyler** (`@container vepanel`, ≤ 640 px) — ekran sorgusu 380 px'lik
    müfettiş sütununda hiç tetiklenmiyordu ve düzenlenen sütuna 42 px
    kalıyordu. Dar kapta sekmeler üste, pencerenin EYLEMİ (`.ve-fp-solve`:
    Hesapla · Raporu Oluştur) kaydırma alanının dibine yapışır. Kapı:
    `tests/e2e/mufettis-sigma.spec.js` (okunurluk: düzenlenen sütun · girdi ·
    etiket · başlık · yatay kaydırma, her sekme gezilerek) + `cp-fead-report.test.js`.
    **Veri tablosu (çevrim · güç eğrisi) bir BİRİMDİR** (`data-ve-tablo`,
    tablo + kendi düğmeleri): sütuna sığmazsa yerinde özet kartı kalır ve
    "Tabloyu aç" onu küçük bir pencereye TAŞIR (`js/tablo-pencere.js`) —
    sütunda yatay kaydırma YOK (2026-09-23; önce 785–1162 / 359 px).
    **Küçük resmin sorusu "bu kasnak nerede"** ve bu yüzden YALNIZ KASNAK
    PENCERESİNDE durur (`componentDefs.isFeadPulley` — gergi dâhil; kullanıcı:
    *"gerekli gereksiz her yere eklemişsin — Sonuç'ta buna ne ihtiyaç var?"*):
    pencerenin kasnağı vurgulu
    (`highlightId`), adlar kısa, sarım açısı yok, ad yerleşimi `nameSmart`
    (yay + disk engeli, 16 açı × 2 uzaklık, en az örtüşen geri düşüş).
    `nameSmart` KANVAS KARTINA VE RAPORA DOKUNMAZ — onların yerleşimi
    `fead-card-design.test.js`te ayrıca kapılı. Kapılar: `fead-panel-dili.test.js`
    → *"PENCERE DÜZENİ"* ve *"BİRİMİNDE"*, `fead-panel-gramer.spec.js`,
    `tablo-pencere.spec.js`; özet şeridinin YOKLUĞU ve küçük resmin YERİ
    `fead-pencere-ailesi.test.js`te, tipten okunan kural olarak.

32. **KASNAK ÇİZİMDE SEÇİLİR, TAŞINIR VE EKLENİR** (2026-09-23, kullanıcı
    kararı: *"Çizim Masası çok güzel"*). Kayış Yolu kartının çizimi giriş
    yüzeyi: tıklamak kasnağın penceresini açar, sürüklemek KONUM GİRDİSİNİ
    yazar (gergide avara merkezi `cenX/cenY` — montaj konumu ondan türer),
    ok 1 mm / Shift 10 mm, Delete siler; paletten kayışın ÜSTÜNE bırakılan
    kasnak iki komşunun ARASINA girer. Kurallar:
    • **Çizim kendi geometrisini hesaplamaz** — ters köprü çizicinin bastığı
      `data-fead-xf`ten; sürükleme boyunca ölçek DONAR (kasnak imleçten
      kaçmasın).
    • **Kayışı koparan hamle yazılmaz** (`veFeadYolDurumu`: çözüm + Σ işaretli
      sarım 360 + kayış hiçbir kasnağın içinden geçmez); sebebi durum
      şeridinde. Model başta bozuksa hamle serbest (onaran kilitlenmesin).
      Açıklığa ekleme adayı KOPYADA çözülür — canlı model reddedilen adayla
      hiç oynamaz.
    • **Gergi ↔ sürücü açıklığı kapalı** (tablo sürücüyle başlar, gergiyle
      biter); avara bırakıldığı taraftan değer — halkanın içinde kaburgalı,
      dışında sırt; iç/dış halkanın YÖNÜNDEN (arşivin on iki örneğinin on
      ikisi aynı yönde dolanıyor — aynalanmış düzen ayrıca kapılı). Çap
      yazılmaz: model eksik çapı tipe göre varsayar ve UYARIR.
    • **Bir hamle = bir geri-al adımı** (sürükleme bırakınca, ekleme
      `veStateBatch` içinde — tablonun ekleyicisi de).
    • **Ok tuşu ızgaraya yuvarlamaz** (sürükleme 0,1 mm ızgarada): ölçüldü,
      yuvarlayan hâl gerginin −161,97'sini tek basışta −163,0 yapıyordu.
    • **Etkileşim katmanı yalnız kartta ve görünmez sunum niteliğiyle**
      (`fill="transparent"` · `fill="none" opacity="0"`) — kılavuz kartı
      CSS'siz gömüyor, nitelik olmasa her kasnağın arkasına siyah disk
      çizilirdi (kılavuzun sahne kapısı yakaladı).
    Kapılar: `tests/unit/fead-cizim-masasi.test.js` +
    `tests/e2e/fead-cizim-masasi.spec.js`.

33. **SONUÇLAR SAYFASINDA FEAD SEKMESİ — PANO OKUR, HESAPLAMAZ** (2026-09-24,
    kullanıcı isteği: *"FEAD'e özel bir Sonuçlar penceresi"*). Veri kümeleri
    ÇÖZÜM ANINDA `R.signals`'a yazılır (`js/fead-signals.js`, yorum
    `js/fead-brief.js`, sunum `js/cp-fead-results.js`): çevrim (devir) ·
    Campbell (devir) · kol taraması (kol açısı) · senaryo (zaman) — panonun tek
    X ekseni kuralı yüzünden DÖRT küme. Kurallar:
    • Kararlı rejim sayıları `R.analysis`'ten BİREBİR; tarama raporun
      ızgarasıyla aynı (`veFeadArmSweep` tek kaynak), tepe yük Özet Rapor'un
      `_fsrPeak`'inden. `R.build` canlı düğümlere bağlı — sonradan kurulan
      küme çözümden sonra değişen alanı sızdırırdı.
    • **Sonuç bir MODEL İMZASI taşır** (`R.sig` · `veFeadModelSig`: kasnak,
      kayış, çözücü verisi; görünüm düğümleri DIŞARIDA) ve bayatlık TEK
      çağrıdan (`veFeadResultState`): çözücü penceresi, Sonuçlar sekmesi ve
      rapor aynı hükmü okur. Ölçülen kusur: çap +%10 → tablo %8 eski, damga yok.
    • **Kayış verisi kapısı TEK soru** (`veFeadBeltDataOn`): kapalıyken ne
      çözüm, ne kartın çırpması, ne senaryo, ne pano açıklık frekansı üretir.
      Ölçülen kusur: 11/11 örnekte senaryo "⚠ REZONANS" yazıyordu.
    • Çözücü penceresinin Sonuç sekmesi ÖZETTİR (durum · kartlar · hüküm ·
      "Sonuçlar'da aç"); tablolar Sonuç Özeti penceresinde. Kartlar İKİ
      yüzeyde aynı üreticiden (`veFeadSignals.summary`).
    • Ortak dosyalarda FEAD dalı YOK: kaynak tablosuna (`veResultSources`,
      js/results.js) girer — kök `CLAUDE.md` → ortak yüzey kuralları.
    • **Şerit yorumu YALNIZ kendi kanallarını anlatır**; kümenin geneline dair
      cümle (ankraj, kayma eşiği, SF hükmü, kalibrasyon notu) tek bir SAHİP
      kanalın şeridine ya da aileyi toplayan şeride düşer — sahipler: gerginin
      çıkış açıklığı (ankrajı o taşır; gergi yoksa `tmin`) · `sfmin` · `tc` ·
      `tmod.1`. Gerekçe: "Ayır" sonrası aynı paragraf kanal sayısı kadar
      yazılıyordu, zarfa bağlı sahip ise bölünen ön ayarda cümleyi hiç
      yazmıyordu, ve tek kasnaklı kayma şeridi zarfın değerini o kasnağın
      adıyla basıyordu (yanlış sayı, sessiz).
    Kapılar: `fead-sonuclar.test.js` (dört kusurun üçü + okuma sözleşmesi +
    "yorum TEKRAR ETMEZ": 11 örnek × iki kayış kipi × Ayır/ön ayar düzeni),
    `fead-sonuclar-sekme.test.js` (kablolama + "Sonuçları Temizle"),
    `tests/e2e/fead-sonuclar.spec.js` (sayfa boyu kart, gerçek çizim).

34. **STEP'TEN KASNAK GEOMETRİSİ — OKUYUCU ANLAM YÜKLEMEZ, TANIYICI MODEL
    KURMAZ** (2026-09-26, kullanıcı isteği: CATIA/3DEXPERIENCE montajından
    kasnakları okumak). `js/step-p21.js` (saf JS STEP okuyucusu: birim ·
    montaj dönüşümü · yüz) → `js/fead-step.js` (tanıyıcı) → çıktı FEAD ÖRNEK
    KAYDI biçiminde; sihirbaz onu örnek gibi yükler (2. adım), ikinci kurulum
    yolu açılmaz. OCCT gömülmez: hafifi bile tek dosyayı gönderim sınırının
    üstüne çıkarıyor ve STEP'i üçgene çevirip dosyada yazılı yarıçapı
    kaybediyordu. Kurallar — her biri gerçek dosyada ölçülmüş bir hataya karşı:
    • **Dış çap kaburga tepesidir**, en büyük çap değil (krank omzu Ø150,5 /
      tepe Ø147; klima çemberi Ø151 / tepe Ø137). Tepe iki kanal tabanı
      arasındaki yüzlerden; tor tepesi yüzün İÇİNDEyse R + r.
    • **Kanal = inen yanağı izleyen çıkan yanak** (70° ± 0,75°); tek yanak kanal
      değil — gevşek kural klimayı 9 kanallı okuyordu. Adım profili verir.
    • **Düz kasnak = kayışı taşıyan yüzey**: düzleme dik, kayış genişliğini
      (kanal × adım) kapsayan, düzlemde ortalanmış; aynı yarıçaplı basamaklar
      aralarında ÇIKINTI yoksa tek yüzeydir (bitişiklik ölçüt değil).
    • **Rol addan önerilir**, geometriden tahmin edilmez; **bakış yönü**
      görünür bir varsayılandır (motor = orijin düzlemin arkasında; orijin
      düzlemdeyse `bakis.kaynak: 'varsayilan'` + uyarı) — ayna modeli yine
      çözer, yalnız krankın dönüş yönünü çevirir.
    • **Birim dosyanın bağlamından**, tahmin edilmez; MAPPED_ITEM montajı
      desteklenmez ve uyarıyla söylenir.
    • **Kayışa dokunulmaz** (kullanıcı kararı): sıra ağaç sırasıdır ve
      `siraKaynagi: 'agac'` ile işaretlidir; kayış parçası kasnak sayılmaz.
    • Gerginin yay verisi STEP'te yok; `tenPart` yalnız parça kodu katalogda
      TEK ise yazılır (kural 19'un gerekçesi).
    Kapı: `tests/unit/fead-step.test.js` (sentetik dosyalar
    `tests/helpers/step-yaz.js` ile, gerçek dosyanın kalıbında) — en değerlisi
    Gates AG00686'nın STEP → köprü zinciri (span %0,5 · sarım 0,2°).

35. **SEKME ADI DURUMUNU TAŞIR — kural köprünün, kapı ANLAŞMA** (2026-09-26,
    kullanıcı: *"kullanıcı bu kısmı görmeyebilir ve eksik bilgi girebilir"* →
    tasarım tezgâhından B · Durumlu Sekmeler). `veFeadSekmeDurumlari`: ok ·
    eksik (boşluğun bir SONUCU var: köprü hatası, varsayılan uyarısı, kapının
    'wait'i, sessiz sıfır) · bos (isteğe bağlı) · yok (hiçbir hesap okumuyor).
    Eksik varsa şeridin altında sonucu ve oraya giden bağlantı. Kurallar:
    • **Yüklemler köprünün**: `veFeadHasOD` · `veFeadAccLimits` (katalogtan
      gelen sınır DOLU sayılır) · `veFeadResolveDriver` (işaretsiz krank da
      sürücü) · `veFeadBeltModeLocked` · `veFeadResultState`.
    • **Sürücüde devir sınırı ve güç eğrisi `yok` ve ALAN SORMAZ** (kural 25):
      iki kapı da sürücüyü atlar, sürücünün gücü toplamdan çıkar. Sekme kalır —
      sürücülük bir ROL, işaret geçince geri gelir.
    • **Güç eğrisi sessiz sıfırı yakalar**: eğri de katalog da yokken boş kW
      hücresine köprü 0 yazıyor (`veFeadDutyToCore`).
    • **Durum YERİNDE tazelenir** (`veFeadSekmeTazele`, `saveState`ten): sayı
      alanı paneli kurmaz, kursaydı Sekme ile geçilen alan sökülürdü.
    • **Köprüye yeni zorunlu alan ekleyen onu buraya da ekler.** Kapı her
      zorunlu alanı gerçek modelde tek tek boşaltıp köprünün sözü ile sekmenin
      hükmünü BİRLİKTE ölçer — biri olup öteki olmazsa kırmızı.
    Kapılar: `fead-sekme-durum.test.js` + `tests/e2e/fead-sekme-durum.spec.js`
    (gerçek klavye → `onchange` → kayıt kancası; dar müfettişte tek satır;
    iki temada kontrast).

**Bağımsız denetim aracı:** `npm run fead:denetim` (`tools/fead-denetim`) —
Gates'e hiç bakmadan koşan analitik + değişmezlik ölçümleri. 27–30 numaralı
kuralların hepsi oradan çıktı.

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
