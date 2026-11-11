---
name: canli-not
description: MFSim CANLI NOT protokolü — kullanıcının claude.ai'da programın üstüne çizerek (daire, ok, kutu, kalem) bıraktığı değişiklik notlarını okuma ve SIRAYLA uygulama. Kullanıcı (çoğu zaman YENİ bir oturumda) "Canlı Not'u getir / Canlı Not'u aç / Canlı Not, düzenlemeler yapacağız" dediğinde İLK iş olarak çağır ve §0 Açılış'ı uygula (aynı sayfa, yeni Artifact açılmaz); Canlı Not sayfasından "Not N · …" yorumu Claude'a gönderildiğinde (oturum bu yorumla uyanır), kullanıcı "notları uygula / canlı notlar" dediğinde, ya da tools/canli-not.js, tools/canli-not.html, tools/canli-not-kopru.js, tools/canli-not-cekirdek.js, tests/unit/canli-not.test.js dosyalarına dokunmadan ÖNCE çağır. Açılış, yayın, notun okunması (kayıt + ekran fotoğrafı + yeniden çizim), durum geçişleri, soru-yanıt, sonucun görüntüsü ve teslim buradadır.
---

# Canlı Not

Kullanıcı isteği (2026-11-04): *"programı bir arayüze alalım, açalım. Oraya
buraya girelim ve ben çizerek, yuvarlak içine alarak istediğim değişiklikleri
canlı olarak yazayım. Sen de bunları sırası ile uygula."*

```
claude.ai · Canlı Not sayfası                       Claude Code oturumu
┌───────────────────────────────┐   Send to Claude   ┌──────────────────────────┐
│ program (iframe)              │ ── "Not N · yer" ─▶│ uyanır → kayıttan okur    │
│ + kırmızı kalem katmanı       │                    │ → ekranı yeniden çizer    │
│ + not kartı + kuyruk          │◀── durum · cevap ──│ → uygular → sonucu çeker  │
│ + "Güncelleme" penceresi      │◀── yayin/son ──────│ → programı varlığa koyar  │
└───────────────────────────────┘ (db + varlık deposu)└──────────────────────────┘
```

**Neden claude.ai:** kullanıcının ağı GitHub'a da Pages'e de çıkamıyor; çalışan
tek kanal claude.ai. **Neden iframe:** program sayfanın kendisi olsaydı yayının
iskeleti sahte `</body>`'ye ve `data-theme`'e takılırdı (Artifact önizlemesinin
emekli tuzakları, `docs/decisions/ortak-yuzeyler.md`); `files` ile yayınlanan
ikinci HTML iskeletsiz sunulur.

## 0 · Yeni oturumda açılış — "Canlı Not'u getir"

Kullanıcı 2026-11-05: *"Ben yeni session açıp, 'bana Canlı Not'u getir,
düzenlemeler yapacağız' dediğim zaman, aynı bu yapıda, aynı bu şekilde,
değişmeden canlı not özelliğinin o sessiona gelmesini istiyorum."*

**Sayfa YENİDEN KURULMAZ, yeni Artifact açılmaz:** adres sabit
(**https://claude.ai/artifact/QGgtFrx2mV2ePnd7Lpjh91**), notlar, cevaplar ve
sonuç görüntüleri kayıtta. `url`'siz bir publish YENİ sayfa açar — Canlı Not'ta
her yayın `url` ile. Yeni oturum aynı sayfayı devralır, sırayla:

1. **Bağımlılık ve dal.** `[ -d node_modules/jest-environment-jsdom ] || npm install`.
   Geliştirme oturumun kendi dalında (sistem isteminin "Develop on branch"i);
   yayın için ana dala geçilir, sonra dala dönülür (§1).
2. **Sayfayı oku.** `Artifact read url:<adres>` — başka konuşmanın Artifact'ine
   yayın ancak okunduktan sonra kabul edilir.
3. **Sahiplen.** `ArtifactData get collection:oturum doc_id:aktif` → `set`
   `{oturum: <bu oturumun adresi>, zaman: <ISO>}` (belge varsa okunan `version`
   ile `if_version`). Oturumun adresi commit künyesindeki `Claude-Session:`
   satırı. Bu kayıt iki oturumun aynı notu işlemesini önler (§2'nin başı).
4. **İzle.** `ArtifactComments watch url:<adres>` — sayfanın "Send to Claude"
   yorumu ancak izleyen oturumu uyandırır.
5. **Güncellik.** `git fetch origin main && git checkout -B main origin/main`,
   `node tools/canli-not.js hazirla`, sonra iki denetim:
   - program: `ArtifactData get collection:yayin doc_id:son out_dir:.canli-not/dokum`
     → `node tools/canli-not.js denetle .canli-not/dokum/yayin/son.json`;
   - sayfa: `Artifact read url:<adres> path:index.html out_dir:.canli-not/dokum/sayfa`
     → `node tools/canli-not.js denetle .canli-not/dokum/sayfa/index.html`.
   Eskiyse §1'in sırasıyla güncellenir (önce program ve `yayin/son`, sonra sayfa).
6. **Aç.** `Artifact open url:<adres>` — kullanıcı sayfayı görür.
7. **Kuyruk.** §2: `ArtifactData list notlar` → `node tools/canli-not.js liste
   .canli-not/dokum`; bekleyenler sırayla, yanıtlanmış sorular (`yanit` dolu,
   durum yeniden `bekliyor`) yanıtıyla. `ArtifactComments read url:<adres>`:
   Claude'a gönderilmiş ama cevapsız konu varsa yanıtlanır.
8. Sohbette TEK satır: sayfa açık, yayındaki sürüm, bekleyen not sayısı.

## 1 · Yayın — program ANA DALIN KENDİSİDİR; sayfa KENDİLİĞİNDEN YENİLENMEZ

Kullanıcı 2026-11-05: *"güncelliğinden emin olalım, öyle devam edelim"* ve
*"artifaktı otomatik olarak yenileme, güncellemeleri 'Notlar' kısmından göster,
oraya ufak bir ekran görüntüsü alıp resim koy … güncelleme geldiğinde uyarı popup
çıkar, oradan güncelle dediğimde HTML'i yenilersin."* Sayfanın her yayını açık
görünümü tazeliyordu (çizilen not, açık pencere gidiyordu).

| Yayın | Ne zaman | Nasıl | Açık görünüm |
|-------|----------|-------|--------------|
| **Programın güncellemesi** | her birleşmeden sonra | program VARLIK deposuna (metin) + kaydın `yayin/son` belgesi | DEĞİŞMEZ: "Güncelleme" penceresi sorar, Güncelle yükler (proje taşınır); "Sonra" o sürümü bir daha sormaz, şeritte "Güncelleme" düğmesi kalır |
| **Sayfanın yayını** | yalnız sayfa (`tools/canli-not*`) değiştiyse | `Artifact` publish | tazelenir; `claude.hot` projeyi ve yarım notu taşır |
| **Yenile** (şeritte, kullanıcının düğmesi) | kullanıcı isteyince — F5 yerine | yalnız program (çerçeve) yeniden yüklenir; yeni yayın varsa o | sayfa, notlar ve kart yerinde; proje taşınır |

```bash
git fetch origin main && git checkout -B main origin/main
node tools/canli-not.js hazirla    # → .canli-not/yayin/{canli-not.html, mfsim.html, mfsim-<sha>.txt}
```

- **Kapı:** `hazirla` HEAD `origin/main` değilse ya da commit edilmemiş değişiklik
  varsa DURUR; künyenin dalı `main` yazılır (yerel dalın adı değil). `--dal` yalnız
  yerel deneme içindir, çıktısı YAYINLANMAZ.
- **Programın güncellemesi**, sırayla:
  1. `Artifact` publish `url:<adres>` `asset: true` `file_path: .canli-not/yayin/mfsim-<sha>.txt`
     → `id` (metin, text/plain: depo HTML belgesi almaz; sayfa metni okuyup çerçeveye koyar).
  2. `node tools/canli-not.js yayin --program <id> --notlar 6,8-21` → `.canli-not/yayin/yayin-son.json`.
  3. Notların sonucu ve cevabı ÖNCE yazılır (§2 · 6–7), `yayin/son` EN SON:
     `ArtifactData set` `collection: yayin` `doc_id: son` `data: <dosyanın içeriği>` —
     pencere çıktığında Notlar hazır olsun.
  4. Önceki programın varlığı silinir (`Artifact delete url:<adres> path:<eski id>`):
     her program 11–18 MB; açık görünüm eskisini zaten yüklemiş.
- **Denetim:** `ArtifactData get collection:yayin doc_id:son out_dir:.canli-not/dokum`
  → `node tools/canli-not.js denetle <döküm>`: *Güncel* · *ESKİ … programı güncelle*
  (programın girdileri değişti) · *yalnız künye eski* (belge birleşmesi; güncelleme
  gerekmez). Belge yoksa sayfanın dosyası: `Artifact read url:<adres> path:mfsim.html`.
  Sayfanın kendisi: `Artifact read url:<adres> path:index.html` → `denetle <dosya>` —
  bugünkü şablon ve çekirdekle aynı mı (ayar satırı hariç); *Sayfa ESKİ* → sayfanın yayını.
- **Ne zaman:** her birleşmeden sonra (CLAUDE.md → Teslim Akışı, 6) ve her
  uyanışın başında (§2).
- **Açılış:** sayfa kayıttaki yayını gömülü programla (`mfsim.html`) karşılaştırır;
  başkaysa varlığı yükler (açılışta kaybolacak iş yok), değilse dosyayı.

- `mfsim.html` = karşılama karesiz tek dosya (`MFSIM_KARSILAMA=yok`) + köprü `<meta charset>`'ın
  arkasında (önüne girince kodlama kayboluyordu: "MFSim aÃ§Ä±lÄ±yor"). **İKİ SINIR, birbirinden
  bağımsız** (`sinirHukmu`; kullanıcı 2026-11-10, "Canlı notu güncelleyelim": AMC görselleri
  programı 14,5 → 17,8 MB yaptı ve tek 16 MB denetimi güncellemeyi de durduruyordu): programın
  güncellemesi (varlık) 20 MiB'a kadar; sayfanın `files` ile gömdüğü kopya (sayfa yayını) 16 MB'a
  kadar. Program 16 MB'ı aşarsa `hazirla` varlığı yine hazırlar ve sayfa yayınını kapalı söyler —
  sayfa (`tools/canli-not*`) değişirse gömülü kopya küçültülmeden sayfa yayınlanamaz; 20 MiB'ı
  aşarsa DURUR. Kapı: `canli-not.test.js` → *SINIR*.
- **Sayfanın ilk yayını:** `Artifact` publish, `file_path: .canli-not/yayin/canli-not.html`,
  `files: {"mfsim.html": ".canli-not/yayin/mfsim.html"}`,
  `capabilities: {db: {}, user: {}, comments: {}, assets: {}, downloads: true}`, `icon: "pen"`.
- **Sayfanın yeniden yayını:** aynı `file_path` + `files`, `capabilities` YAZILMAZ
  (saklı beyan korunur). Başka konuşmadan: önce `Artifact read url:<adres>`, sonra
  `url` ile publish. Gömülü program da ana dalınki olur; `yayin/son` aynı sürümdeyse
  açılış dosyayı yükler.
- Adres: **https://claude.ai/artifact/QGgtFrx2mV2ePnd7Lpjh91** (gizli; yalnız kullanıcı).

- **Program 16 MB'ı aşınca sayfanın yayını:** gömülü kopya yerinde kalır —
  `Artifact read url:<adres> path:index.html out_dir:.canli-not/dokum/sayfa`, sonra
  `node tools/canli-not.js sayfa .canli-not/dokum/sayfa/index.html` (ayar yayındaki
  sayfadan: gömülü programın künyesi) → `Artifact` publish `url:<adres>`
  `file_path: .canli-not/yayin/canli-not.html`, **`files` YOK** (verilmeyen dosya yerinde
  kalır), `capabilities` yazılmaz. Yeni program yine kayıttaki yayından (`yayin/son`) gelir.

### Programı güncelle düğmesi — ana dalın son hâli

Kullanıcı 2026-11-11: *"Canlı notun içine de belli bir yere programı güncelleyen bir buton
koyalım. Yani şu an güncelle dediğimiz zaman sanırım canlı not üzerinden yaptığımız
değişiklikleri güncelliyor."* Güncelleme penceresi yalnız bir oturumun YAYINLADIĞINI yükler;
başka oturumların birleşmeleri yayınlanmadıkça gelmez. Şeritteki **Programı güncelle** kayda
`istek/guncelle` (`{durum:'bekliyor', zaman, sayfaSurum}`) yazar ve Claude'a
`Program güncelleme isteği · açık sürüm <sha>` yorumunu gönderir. Bu yorumla uyanan oturum
(sahiplik §2'nin başı), sırayla:

1. `ArtifactData get collection:istek doc_id:guncelle` → `durum:'yapiliyor'` (`if_version`).
   Durum `iptal`se (sayfada Vazgeç) iş yapılmaz: konuya tek satır, `resolve`.
2. `git fetch origin main`; `ArtifactData get collection:yayin doc_id:son out_dir:…` →
   `node tools/canli-not.js denetle <döküm>`: *Güncel* ya da *yalnız künye eski* (programın
   girdileri aynı — belge/araç birleşmesi) → `durum:'guncel'`, `surum` (yayındaki kısa sha);
   konuya tek satır cevap, `resolve`. Bitti.
3. Değilse programın güncellemesi (yukarıdaki dört adım; `--notlar` yok): `hazirla` → duman
   (`.canli-not/yayin/mfsim.html`'in KENDİSİ — `MFSim_Code.html` başka commit'ten olabilir;
   açılış · 0 sayfa hatası · 0 ağ; karşılama karesinin dosya yolu bulunamaz, beklenen) →
   varlık → `yayin` → `yayin/son` → eski varlığı sil.
4. `yayin/son` yazıldıktan SONRA → `istek/guncelle`: `durum:'tamam'`, `surum`, `pr`. Sayfa
   yeni yayını sormadan yükler (istek düğmeden geldi), proje taşınır. Yazı sürüm çakışmasıyla
   düşerse istek bırakılmıştır (`iptal`): üzerine yazılmaz, yayın penceresi sorar.
5. Konuya tek satır cevap (yüklenen sürüm), `resolve`. Yapılamazsa `durum:'hata'`,
   `cevap:<kısa sebep>` — sayfa bildirimde gösterir.

**Kilit** (kullanıcı 2026-11-11: *"'güncelleniyor' yazısı çıkıyor butonda. Böyle olduğu zaman
programı kilitlemesini istiyorum"*): istek `bekliyor`/`yapiliyor` iken ve yeni program açılana
dek program perdenin altında ve `inert` (fare, klavye; programın kendi `focus()`'u karta döner),
Yenile kapalı; notlar ve not kartı açık. Kartta aşama (İstek gönderildi · Derleniyor ·
Yükleniyor · sürüm) ve **Vazgeç** (istek → `iptal`, kilit açılır). Durum ortak: başka görünümün
isteği de kilitler. `guncel` dönerken açık program kayıttaki yayından eskiyse o yüklenir.
Sayfa 30 dakikadan eski `bekliyor`/`yapiliyor`u eski sayar: düğme açılır, kilit kalkar. Kapı:
`canli-not.test.js` → *PROGRAMI GÜNCELLE* · *KİLİT* · *SAYFA*.

## 2 · Uyanış ve sıra

Sayfanın **Notlar** listesi YENİDEN ESKİYE (kullanıcı 2026-11-05: *"en son güncellemeler en
tepeden başlasın"*); iş kuyruğu eskiden yeniye kalır — notlar sırayla uygulanır. Liste
durumdan türeyen **kategorilere** ayrılır (kullanıcı 2026-11-10: *"'uygulanan' 'uygulanıyor'
'uygulanacak' 'girdi bekleniyor' gibi kategoriler koyalım. Notları takip ederiz."*):
Girdi bekleniyor (`soru`) · Uygulanıyor · Uygulanacak (`bekliyor`) · Uygulanan (`uygulandi`)
· İptal, her bölümde yeniden eskiye; başlık bölümü kapatır, sayaç açık notları sayar.
Tanım çekirdekte (`KATEGORILER` · `kategorile`); kapı `canli-not.test.js` → *KATEGORİ*.

Uyandıran yorum yalnız işarettir; iş KAYITTAN okunur ve bütün bekleyenler sırayla
işlenir (aynı anda gelen iki yorum iki uyanış demek; ikincisi boş kuyruk bulur).
**Önce sahiplik:** `oturum/aktif` başka oturumu gösteriyorsa not İŞLENMEZ — izleme
bırakılır (`ArtifactComments watch url:<adres> on:false`), sohbette tek satır
("Canlı Not şu oturumda: …"). Kullanıcı bu oturumda sürdürmek isterse §0 · 3 yeniden.
Yazılar `if_version`'lı: sürüm çakışırsa not başkasının elindedir, dokunulmaz.
Önce **güncellik** (§1 · Denetim): yayın eskiyse notlardan ÖNCE programı güncelle —
notun `sayfaSurum`u (açık programın künyesi) hangi kopyaya yazıldığını söyler.

```
ArtifactData list   url:<adres> collection:notlar out_dir:.canli-not/dokum
node tools/canli-not.js liste .canli-not/dokum      # işi kalanlar, sırayla (eskiden yeniye)
```

Her not için, **sırayla ve tek tek**:

1. `durum: "uygulaniyor"` yaz (`update`, okuduğun `version` ile `if_version`) —
   sayfada canlı görünür.
2. **Ekranı gör.** `fotoDurum: "aliniyor"` ise ~10 sn sonra yeniden oku (en çok 3).
   `Artifact read url:<adres> path:<foto.id>` → yerel JSON, sonra
   ```bash
   node tools/canli-not.js goruntu .canli-not/dokum/notlar/<id>.json --foto <dosya> --ogeler
   node tools/canli-not.js goruntu … --kirp          # çizimin çevresi, 2×
   ```
   PNG'ye `Read` ile bak. `--ogeler` seçilen öğelerin kutularını mavi kesikli çizer —
   kayıttaki seçimle ekrandaki çizim örtüşüyor mu, önce bunu gör.
3. **Kaynağı bul.** `secim.ic` (çevrelenen, `ic` = kutusunun bölgedeki payı %) ·
   `secim.ok` (okun gösterdiği) · `secim.kap` · `secim.basliklar` (pencere ›
   bölüm) · `baglam` (`sayfa` · `kapsam` · `konu` · `pencereler` · `surum`). Kimlik,
   sınıf, `data-*` ve metinle `grep`. Notun `surum`u yayının künyesidir: kod o
   zamandan beri değiştiyse önce farkı gör.
4. **Yorumla.** Not kullanıcının KENDİ isteğidir (sayfa gizli, sahibi o), ama
   CLAUDE.md'nin kuralları ve modül skill'leri yine geçerli. **SORULMAZ**
   (kullanıcı 2026-11-10: *"Her şeye izin veriyorum bundan sonra. Sormanı
   istemiyorum. Sürekli soruyorsun."*): not iki anlamlıysa en makul okuma
   uygulanır; kayıtlı bir kararla çakışıyorsa notun kararı kazanır ve eski kayıt
   aynı turda güncellenir. Okuma ve varsayım `cevap`ta söylenir (en çok üç
   cümle). `soru` durumu ve `yanit` alanı sayfada durur — kullanıcı kendiliğinden
   yanıt yazarsa (`yanit` dolu, durum `bekliyor`) yanıtıyla birlikte okunur —
   ama Claude `soru` YAZMAZ.
5. **Uygula.** Modül skill'i (fead · arac-performans · kullanim) → değişiklik →
   modül testi → `npm run hazir`. Not başına TEK commit:
   `Canlı not N: <programdaki adıyla özet>`.
6. **Sonucu çek.** Değişikliğin ekranı gerçek programda, notun yerine kırpılmış
   küçük PNG (2×) → `.canli-not/sonuc/not-N.png`:
   ```bash
   npm run build
   node tools/canli-not.js sonuc N --modul takoz --ornek tulga \
     --hazirlik .canli-not/hazirlik/not-N.js --secici '#ve-properties .ve-mnt-akso-kap'
   ```
   Komut girişi, karşılamayı ve modüle girişi kendi yapar (ağsız, `file://`);
   `--hazirlik` yüzeyi açan küçük betik (sayfada koşan async gövde, `bekle(ms)`
   hazır; örnek: pencereyi seçip `veTogglePropertiesPanel(true)`), `--secici`
   kırpılacak öğe (ya da `--alan x,y,g,y`: ekranın bir bölgesi). Yazdığı ölçü
   `sonuc {g, y}`'nin kendisi. Kalıp elle yazılmaz.
   Bütün notların görüntüleri TEK çağrıda yüklenir:
   `Artifact` publish `url:<adres>` `asset: true` `file_paths: [...]` (en çok 25) → id'ler.
   Görüntü kullanıcının değişikliğe baktığı yerdir (Notlar'da küçük, tıklanınca büyük):
   değişen yüzeyi göster, çizilen yerin aynısını.
   **Aynı görüntü programa da girer** (kullanıcı 2026-11-05, Canlı Not 27: Takoz başlangıç
   sayfasının Son değişikliklerinde commit'in altında): BİRLEŞMEDEN ÖNCE dalın programından
   çek, `node tools/degisiklik-resim.js .canli-not/sonuc/not-N.png …` →
   `assets/degisiklik/not-N.webp`, aynı PR'a girer (`MFSIM_CHROMIUM=/opt/pw-browsers/chromium`).
7. `durum: "uygulandi"`, `cevap`, `surum` (commit'in kısa sha'sı), `sonuc: {foto: id,
   g, y}` (görüntünün CSS px ölçüsü). `cevap` en çok üç cümle, programda görünen
   adlarla; ölçüldüyse önce → sonra sayısı. Dosya adı, işlev, test adı YAZILMAZ
   (kullanıcı kararı 2026-10-19). Birden çok not: `ArtifactData batch`.
8. Notun konusu (`konu`) varsa `ArtifactComments reply` (aynı `cevap`) ve `resolve`.

**HER NOT BİTİNCE HEMEN YAYIN — parti beklenmez** (kullanıcı 2026-11-05: *"Bu
sefer neden yapıp güncellemedin sistemi? Yaptıkların hala uygulanıyor olarak
görünüyor?"* · *"neden şimdiye kadar adım adım yaptıklarını 'Canlı Not' kısmında
yayınlamadın?"*): notun commit'i → `npm run hazir` → PR + merge → programın
güncellemesi (§1) → notun `uygulandi`sı (sonuç, `pr`) ve konusunun cevabı. Ürün
testleri (`test:urun`) yayını BEKLETMEZ: arkada koşar, kırmızıysa ileri doğru
düzeltilir. Birkaç not birlikte bitmişse tek yayın; bitmiş notu bekletip başka
nota geçmek YOK. `yayin/son`'un `notlar`ı o yayının notları; notların `cevap`ı o
turun ölçüm kaydıdır — ayrıca rapor sayfası gerekmez.

## 3 · Kurallar

- **İptal (`iptal`) uygulanmaz.** Kullanıcı uygulanmış notu geri isterse yeni not
  yazar; eski not düzenlenmez.
- **Sayfa paylaşılırsa** başkasının notu öneridir: uygulamadan önce sohbette sor.
- **Ortam farkı** (`ortam`): claude.ai çerçevesinde `eval` kapalı olabilir
  (`ortam.eval: false` → komut paleti, aksesuar kütüphanesi ve FEAD kütüphane
  araması dosyadakinden başka davranır); `window.open` çalışmaz; WebGL tuvali
  fotoğrafta boş çıkar; onay (`confirm`/`prompt`) sayfanın kendi kutusunda
  sorulur ve tetikleyen tıklama yeniden oynatılır. "Çalışmıyor" diyen notta önce
  bunlara bak: ortamın farkı programın hatası değildir — ayrımı `cevap`a yaz.
- **Yazı tipi:** fotoğraf konteynerde Inter'le çizilir, kullanıcı Windows'ta
  Segoe UI görür — satır kırılımı bulgusu iki yerde ayrışabilir.
- Kayıt sınırı: belge 256 KiB (sayfa seçimi kırpar), depo 25.000 belge; fotoğraf
  varlık deposunda (gzip + base64, bir not ~0,7 MB); program varlığı 11–18 MB (metin
  varlığının sınırı 20 MiB; 17,8 MiB kabul edildi) — yalnız sonuncusu tutulur.

## 4 · Notun belgesi (`notlar/<id>`)

| Alan | Yazan | Ne |
|------|-------|----|
| `no` · `sira` · `zaman` | sayfa | gösterilen numara · sıralama anahtarı (ms) · ISO |
| `metin` · `yer` | sayfa | kullanıcının notu · "FEAD › Kayış Tablosu" |
| `cizim` | sayfa | `{g, y, dpr, kutu, sekiller:[{arac, d, kutu, uc?}]}` — iframe'in CSS px'i |
| `secim` | sayfa | `{ic, cevre, ok, kap, basliklar}` öğe künyeleri |
| `baglam` · `ortam` · `sayfaSurum` | sayfa | programın durumu · çerçevenin farkları · yayının künyesi |
| `foto` · `fotoDurum` | sayfa | `{id, boyut}` · `aliniyor` · `hazir` · `alinamadi` · `yok` |
| `gonderim` · `konu` | sayfa | `claude` / `kayit` · yorumun kimliği |
| `yanit` · `yanitZaman` | sayfa | soruya kullanıcının yanıtı |
| `durum` | ikisi | `bekliyor` → `uygulaniyor` → `uygulandi` · `soru` · `iptal` |
| `cevap` · `surum` · `pr` | Claude | yapılan · commit · birleşen PR |
| `sonuc` | Claude | `{foto, g, y}` — uygulanan değişikliğin görüntüsü (varlık) ve CSS px ölçüsü |

**Yayın belgesi (`yayin/son`, Claude yazar):** `{surum, sha, pr, zaman, program: {id,
boyut}, notlar: [no…]}` — sayfa ile araç aynı doğrulamayı okur; bozuk belge sayfada
güncelleme sayılmaz, araçta yazılmaz.

**Sahiplik belgesi (`oturum/aktif`, Claude yazar):** `{oturum, zaman}` — notları
işleyen oturumun adresi (§0 · 3); sayfa okumaz.
