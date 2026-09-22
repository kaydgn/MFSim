# FEAD — üç katman ve hesap çekirdeği

> Kök `CLAUDE.md`'den taşındı. Metin birebir korunmuştur.

#### Üç katman — hangi dosya neyi yapar

| Dosya | Katman | Kural |
|-------|--------|-------|
| `js/fead-core.js` | Hesap çekirdeği | Dışarıdan geldi, **birebir** durur, dokunulmaz (güncelleme de dışarıdan gelir) |
| `js/fead-model.js` | Köprü (DOM'suz) | Kanvas düğümü → `FEADCore.makeSystem()`; temas/sürücü/çap çözümü, hata çevirisi |
| `js/cp-fead.js` | Sunum | Yalnız HTML kurar; **kendi geometrisini hesaplamaz** |

Yükleme sırası (index.html): `fead-model.js` → `fead-core.js` → `cp-fead.js`.
Model katmanı, `cp-fead.js`'in de kullandığı saf yardımcıları (`_feadNum`,
`_feadDefOf`, `_feadIsPulley`, `veFeadContactOf`, `veFeadOD`,
`veFeadRouteOrder`…) bildirir — aynı adı iki dosyada bildirmek üst-seviye
çakışması olurdu (`source-hygiene` kapısı).

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

> **KAYNAK BELGELER DEPODA:** bu bölümde adı geçen Gates raporlarının onu
> `docs/gates-reports/pdf/` altında duruyor ve testler onları **doğrudan
> okuyor**. Bir sayının kökenini merak ettiğinde ya da yeni bir referans değer
> gerektiğinde önce `docs/gates-reports/README.md`'ye bak — hangi raporda hangi
> sayfada ne olduğu orada yazılı. Fixture'ın 284 statik değeri kaynağına karşı
> ölçüldü: **0 uyuşmazlık**.

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

**Mutlak B10 ömrü KAPI DIŞINDA** — yalnız tüm çaplar 79.6–176 mm iken geçerli,
dışında sistematik 0.55×.

##### Sürtünme katsayıları — DEĞER doğru, çekirdeğin NOTUNDAKİ teşhis yanlış

`CALIBRATION.muEffGrooved = 0.90` (kaburgalı, **etkin** = düz-kayış eşdeğeri;
Euler–Eytelwein'e doğrudan girer, ayrıca kama düzeltmesi uygulanmaz) ve
`muBackside = 0.35` (sırt, **kalibre edilmemiş**).

**0,90 DOĞRU ve emniyetli tarafta** — literatür taraması (2026-09) üç bağımsız
ölçümle tutarlı buldu ve üçünün de altında: Gerbert & Hansson 1990 ham μ 0,31 →
0,31/sin20° = **0,906**; Tabatabaei Lotfy 1996 (Leeds PhD §5.3.3) **0,934**;
Kubas 2019 (Arch. Automot. Eng. 84(2), Tab. 1) kaburga başına eşleştirilmiş
yükte **0,97**. Kubas 2026 (Sci. Rep. 16:10933) on üreticinin 5PK'sında
0,49–2,49 ölçtü — 0,90 o bandın alt ucunda, yani "on kayıştan en kötüsü"
varsayımı. Bir kayma EMNİYET faktöründe doğru taraf budur.

**ÇEKİRDEĞİN NOTUNDAKİ ŞU HÜKÜM YANLIŞ** (`js/fead-core.js`, `muEffGrooved.note`):
*"mu/sin(alpha/2) seklindeki V-kayis kama faktoru PK icin GECERSIZDIR (~1.17
verir, fazla iyimser)."* Formül geçersiz değil — **girdisi** yanlıştı: 1,17
sayısı kaynağı olmayan bir ham μ = 0,40 varsayımından geliyor (0,40/sin20°).
Literatürün ÖLÇTÜĞÜ ham μ 0,31–0,32'dir ve aynı formül 0,906–0,936 verir, yani
çekirdeğin kendi 0,90'ını. Kama bağıntısını PK'ya açıkça uygulayan kaynaklar:
Kubas 2019 dn.(1), Kubas 2026 dn.(2)–(4), Tabatabaei 1996 §5.3.3. Gerçek sınır
başka: kama etkisi yalnız **kaburga dibi ile kanal tepesi temas etmediği**
sürece geçerlidir; temas başlayınca etkin μ düz-kayış değerine doğru iner
(Tabatabaei 1996, Özet).

**NOT DÜZELTİLMEDİ, DÜZELTİLEMEZ:** `fead-core.js` dışarıdan geliyor ve birebir
duruyor (kural 1) — düzeltmesi de dışarıdan gelmeli. Kayıt burada, ve doğru
köken **rapora basılıyor** (§8.12) ki okuyucu yanlış gerekçeyi görmesin.

**İKİ AÇIK SINIR, ikisi de §8.12'de yazılı:** (1) `e^(μφ)` bir **tam kayma**
(gross slip) eşiğidir, "hiç kayma yok" değil — sürünme her yük düzeyinde var
(Balta ve ark. 2015; Leamy & Wasfy 2002). (2) **Merkezkaç terimi yok**: ölçüt
`(T₁−T_c)/(T₂−T_c) ≤ e^(μφ)` olmalı, `T_c = m′v²`. İhmal gereken μ'yü DÜŞÜK
gösteriyor (emniyetsiz yön) ve devirle büyüyor — 8PK/ø160/φ=2,5 rad için
hesaplandı: 1500 d/d %1,2 · 2500 d/d %3,4 · 3500 d/d %7,5.

**Gates bu sayıyı doğrulayamaz:** 11 raporun metin katmanında `friction` geçişi
**sıfır** — Gates bir μ basmıyor, dolayısıyla 2095 değerlik kapı kaymayı
kapsamıyor ve kapsayamaz.

Kapı: `fead-core.test.js` → *"CALIBRATION — sürtünme katsayıları"* (değeri adıyla
çiviler, kökenin yazılı olmasını şart koşar, 1,17'ye kaymayı ÜST SINIRLA keser,
ve `opt.muGrooved` geçiş yolunun SF'yi `e^(Δμ·φ)` oranında sürdüğünü ölçer) +
`cp-fead-report.test.js` → *"§8.12 — sürtünme katsayısının künyesi"* (değer
CALIBRATION'dan okunuyor, rapora kopyalanmamış).

##### Burulma modeli — çekirdeğe SONRADAN girdi, kapısı AYRI

Eskiden doğal frekans da kapı dışındaydı: "çekirdek yalnız kol modu verir,
raporla karşılaştırılamaz". Artık `torsionalModel()` var — kayış spanlarıyla
kuplajlı N kasnak + kol serbestliği, enerji formülasyonundan
(`K = Bᵀ diag(k) B + yay`, `M = diag(I)`, Jacobi özdeğer). Gates raporunun
"System Resonance (Mode 1)" satırıyla **karşılaştırılabilir**.

Ama **statik zincirle aynı güven düzeyinde DEĞİL** ve bu ayrım korunmalı:

| | Statik zincir | Burulma modeli |
|---|---|---|
| Doğrulama | 17 rapor / 2095 değer | 6 sistem / tek sayı (Mode 1) |
| Sapma | %0.33 | RMS ~%8 |
| Serbest parametre | yok | kord rijitliği, kavis payı (`beltFactor`) |

Testi bu yüzden **iki katmanlı** (`tests/unit/fead-core.test.js`):
kalibrasyondan BAĞIMSIZ yapısal özdeşlikler sıkı toleransla (tam 1 rijit cisim
modu; take-up özdeşliği `Σ(∂span/∂kol) = take-up oranı` %0.01 içinde; yalnız
gergiye komşu iki spanın türevi sıfırdan farklı), kalibrasyon ise gevşek
(5 sistem RMS <%8). Kalibrasyon takımı doğrulama fixture'ında **zaten
duruyordu** (`AG_MISC` içindeki `NF` ve `inertia` alanları) ama koşucu onları
beslemiyordu; test besliyor.

**İKİ SESSİZ GİRDİ — ikisi de ölçüldü:**

| Girdi | İhmal edilirse | Neden sessiz |
|-------|----------------|--------------|
| Gergi **kasnak kütlesi** (`pulleyMass`) | 1. mod **+%32** (BMC 15.3 → 20.3 Hz) | model yine çözülür |
| **Krank mili** ataleti (kasnağınki değil) | AG0868 ailesi 29/36/41 → **41/50/57 Hz**, RMS %5 → %33 | model yine çözülür |

İkincisi MFSim'de **ölü girdiydi**: Çözücü panelindeki "Krank ataleti" alanı
soruluyor ama hiçbir yere gitmiyordu (burulma modeli yoktu). Şimdi
`veFeadTorsionalOpt` ile çekirdeğe `inertias` üzerinden geçiyor — kasnağın kendi
`inertiaKgM2` alanına YAZILMIYOR ki `peakEstimate` kasnak ataletini istediğinde
karşısında krank milini bulmasın.

Kol→span uzama türevi **PROJEKSİYONLA** alınır (`u·v`), serbest span boyunun
sonlu farkıyla değil: ikisi aynı şey değil (sarım değişimi teğet noktalarını
kaydırır, kavis terimi dışarıda kalır) ve sonlu fark take-up kontrolünde
%3–49 sapıyordu. Projeksiyonla **%0.000**.

`analyze()` burulmayı kendisi de hesaplayabiliyor ama **seçeneksiz** — krank
ataleti geçilemediği için kasnak ataletiyle koşar. Köprü onu `torsional: false`
ile kapatıyor: panelde tek frekans olsun, iki farklı cevap değil.

**AG00810 kalibrasyon takımının dışında** ve sebebi model değil VERİ: gergisinin
kol ataleti (0.004) çekirdeğin ölçülmüş iki gergisinden hiçbiri değil, yani
kasnak kütlesi bilinmiyor → nokta kütle terimi eksik → 20.3 Hz (Gates 13.29).
Testi bunu belgeliyor ki biri "AG00810 tutmuyor" diye modeli suçlamasın.

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

