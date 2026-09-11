---
name: fead
description: MFSim FEAD (kayış-kasnak / accessory belt drive) modülünün karar kaydı ve dokunulmazlıkları. js/fead-core.js, js/fead-model.js, js/fead-belts.js, js/fead-duty.js, js/fead-tensioners.js, js/cp-fead.js, js/cp-fead-report.js, js/cp-fead-summary.js, js/cp-fead-wizard.js, js/guide-fead.js dosyalarından birine ya da FEAD testlerine (tests/unit/fead-*, cp-fead*, gates-archive, guide-fead, tests/e2e/fead-*) dokunmadan ÖNCE çağır. Çekirdeğin birebir durma kuralı, 2095 referans değerlik doğrulama kapısı, kasnakların kanvasta KUTUSU OLMAMASI (veri girişi Kayış Tablosu'ndan), gergi tanımı, katalog ve rapor kuralları buradadır.
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
   components.js). Koordinat yalnız **Kayış Tablosu**'ndan girilir; detay
   panele tablodaki ADA tıklanarak gidilir. Kutuları eklemek/silmek de tablonun
   işi (satır ✕ · "＋ Kasnak ekle").
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
   bir pencere karşılamayı engele çevirirdi. Karşılayan şey eskiden BOŞ bir
   Kayış Tablosuydu: doldurulacak satırı yok, ne yapılacağını da söylemiyordu.
   Açılış yüzeyi yine kurulur (sihirbaz + Kayış Tablosu) — kapatan kullanıcı
   boş bir kanvasa düşmesin. **"Başlangıç ve Örnekler" (`fead-example`)
   KALDIRILDI**: sunduğu iki şey (sihirbaz düğmesi + örnek listesi) sihirbazın
   1. adımında zaten vardı. Örnek KURUCUSU (`veFeadLoadExample`) duruyor.
   Kapılar: `cp-fead.test.js` → *"FEAD editörü açılışı"* ve *"Başlangıç ve
   Örnekler bileşeni kaldırıldı"*, `fead-sihirbaz-tablo.spec.js`.
6. **"Otomatik Düzenle" artık yalnız ARAÇ KARTLARINI dizer** — dizilecek kasnak
   yok. Kayış Yolu şeması + Kayış Tablosu sağda, künyeler solda.
   **Dikey adım KUTUYU DEĞİL, kutu+ADI sayar** (`veFeadArrangeByCoords` →
   `adPayi`): ad kutunun ALTINDA duruyor, adım onu saymayınca araç kartlarında
   adın altında 2 px kalıyor ve komşunun dekorasyonu (seçim tutamağı ~5 px
   dışarı taşar, kayış kipi rozeti üst kenara oturur) adın üstüne biniyordu.
   Ölçü sınır çerçevesiyle AYNI kaynaktan (`veMeasureNodeLabel` +
   `veNodeLabelOverflow`); ölçülemezse pay 0 ve davranış birebir eski hâli.
   Kapı: `cp-fead.test.js` → *"ad KUTUNUN ALTINDA duruyor"*.
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
11. **Tazeleme tek noktadan.** İki kart (Kayış Yolu şeması + Kayış Tablosu)
    HEP BİRLİKTE, `veFeadRefreshCards`'tan; port DOM'u ve kart imzası
    `updateAllConnections`'tan. Kart başına ayrı çağrı, altı düzenleme
    yolundan birinde birinin unutulması demek — ve fark sessiz: iki kart kendi
    başına tutarlı görünür, yalnız biri bir düzenleme geride kalır. Kaynak
    kapısı `fead-table.test.js` içinde.
    **SEÇİM DEĞİŞİNCE KART KURULMAZ, SINIF EŞİTLENİR** (`veFeadMarkSelectedRow`,
    `cp-core.js`'in `addToSelection`/`clearSelection` merkezlerinden çağrılır):
    kasnakların kutusu olmadığı için `addToSelection`'ın kutuya yazdığı
    `selected` sınıfı onlarda hiçbir şeye yazmıyor, işaretin tek yeri tablo. Tam
    yeniden kurmak düzenlenen hücrenin odağını düşürürdü. Ölçüldü: çağrı
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
14. **KAYIŞ TABLOSUNUN GÖRÜNÜMÜ CSS'TE** (`css/styles.css` → `.ve-fead-tbl*`),
    satır içi `style=` dizelerinde DEĞİL. Gerekçe kozmetik değil yapısal: satır
    içi CSS DURUM İFADE EDEMEZ (`:hover`, `:focus`, `:nth-child` yazılamaz),
    yani fare hangi satırdaysa, imleç hangi hücredeyse, hangi kasnağın paneli
    açıksa — hiçbiri görünmezdi. Kullanıcının "demode ve ilkel" dediği şey bir
    renk tercihi değil, tam olarak o taşıyıcının sınırıydı. Satır içinde kalan
    tek şey VERİ: `<colgroup>` genişlikleri ve hücre payı. Vurgular
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
    gölge yalnız fare altında geliyor, hücre bu yüzden `overflow:visible`
    (genel `td` kuralı gölgeyi de 1 px kalkışı da keserdi, yani "gölge olsun"
    isteği sessizce hiçbir şey yapmazdı).
    **KUTULU HÂLİ ÖLÇÜLDÜ VE GERİ ALINDI** (2026-09-10, gerçek tarayıcı): sayı
    hücreleri dinlenmede çerçevesiz olduğu için çerçeveli ad hücresi bir METİN
    ALANI gibi okunuyordu — sağ uca itilmiş simgeyle birlikte bir `<select>`
    okundan ayırt edilemiyordu. Kural iki yönlü: DÜĞME dinlenmede DOLU
    (basılır), ALAN dinlenmede BOŞ (yazılır); ikisi birden dolu ya da ikisi
    birden boş, ikisini de belirsiz bırakır.
    **GİRDİ/ÇÖZÜM AYRIMI SÜTUN ŞERİDİNDEN** (`<col class="coz">`), sözlü bir
    lejanttan değil: sütun SIRASI defterle birebir olmak zorunda, yani bitişik
    bir "GİRDİ" bandı çizilemez. Bant tam olarak DEĞERİ ÇÖZÜMDEN GELEN
    sütunlarda ve kapı bunu bir KURAL olarak tutuyor (sabit liste değil — yeni
    bir türetilen sütun sessizce bantsız kalmasın). `<col>` zemini `<td>`
    zemininin ALTINDA çizilir: gövde hücresi opak bir zemin alırsa şerit
    sessizce kaybolur, bu yüzden ZEBRA DA YOK (ayrıca `rowspan`lı kayış boyu
    hücresi zebrayı atlıyor ve kartın sağ ucunda merdiven bırakıyordu).
    **ÇEVRİM DENETİMİ ÜST KÜNYEDE**, kartın altında değil: tablonun tek
    EVET/HAYIR sorusu "kayış yolu kapandı mı" ve cevabı künyenin devamında
    okunur Türkçeyle duruyor (`✓ Çevrim kapalı · Σsarım 360.0°`). Alt şerit
    dört sayıyı kısaltmalarla diziyordu ve üçü zaten başka yerde okunuyor:
    L_pitch birleşik hücrede, L_eff künyede ("efektif boy"), konum künyenin
    devamında. Denetim `T.ok`un kopyası DEĞİL — geometri çözülüp Σ 360'tan
    saptığı hâl ayrıca kapılı.
    **EKLENEN SATIR GÖRÜŞ ALANINA ALINIR** (`_feadScrollRowIntoView`,
    `veFeadTableAdd` içinde ve tazelemeden SONRA — satır o çağrıyla doğuyor).
    Ölçüldü: yedinci kasnak listenin dibinin 35 px altına düşüyor ve tablo hiç
    kaymıyordu; kullanıcı "＋ Kasnak ekle" diyor, paneli açılıyor, ama
    dolduracağı satır ekranda yok. `block:'nearest'` — görünen satır listeyi
    ZIPLATMAZ. Kapı: `fead-table.test.js` + `fead-tablo.spec.js` →
    *"KASNAK EKLE"*.
    **KART TABANININ ALTINA İNİLEMEZ** (`componentDefs.minWidth/minHeight`);
    gerekçesi ve genel mekanizması `docs/decisions/ortak-yuzeyler.md` içinde.
    Tekerlek de artık listeye ait — aynı belge.
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
17. **Katalog bir KISIT değil bir ÖNERİ** — kayış, gergi, motor ve aksesuar
    kütüphanelerinin dördünde de aynı kural. Elle girilen değer katalogtan
    üstündür; "elle" demek için değerin katalogtan FARKLI olması gerekir
    (yalnız "dolu mu" bakan bir tespit, katalogun kendi yazdığı alanları
    kullanıcıya mal ediyordu). Kapı: `tests/unit/fead-catalogs.test.js`.

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
