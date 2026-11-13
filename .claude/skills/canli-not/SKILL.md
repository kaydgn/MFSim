---
name: canli-not
description: MFSim CANLI NOT protokolü — kullanıcının claude.ai'da programın üstüne çizerek (daire, ok, kutu, kalem) bıraktığı değişiklik notlarını okuma ve SIRAYLA uygulama. Kullanıcı (çoğu zaman YENİ bir oturumda) "Canlı Not'u getir / Canlı Not'u aç / Canlı Not, düzenlemeler yapacağız" dediğinde İLK iş olarak çağır ve §0 Açılış'ı uygula (aynı sayfa, yeni Artifact açılmaz); bir bileşene ayrılmış Canlı Not istenince ya da getirilince (§5 · Odaklı sayfa — örn. Parametrik Analiz); Canlı Not sayfasından "Not N · …" yorumu Claude'a gönderildiğinde (oturum bu yorumla uyanır), sayfanın "Oturum çağrısı" yorumuyla uyanınca (§1 · Oturumu çağır), kullanıcı "notları uygula / canlı notlar" dediğinde, ya da tools/canli-not.js, tools/canli-not.html, tools/canli-not-kopru.js, tools/canli-not-cekirdek.js, tests/unit/canli-not.test.js dosyalarına dokunmadan ÖNCE çağır. Açılış, yayın, notun okunması (kayıt + ekran fotoğrafı + yeniden çizim), durum geçişleri, soru-yanıt, sonucun görüntüsü ve teslim buradadır.
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
│ + "Güncelleme" penceresi      │◀── yayin/son ──────│ → değişen parçayı yükler  │
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

Odaklı sayfa (§5 — bir bileşene ayrılmış Canlı Not) aynı adımlarla açılır: kendi adresi,
araç komutlarında `--odak <ad>`.

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
   satırı. Bu kayıt iki oturumun aynı notu işlemesini önler (§2'nin başı) ve
   yayının TEK yazarını belirler (§1 · iki kapı): sahibi olmayan oturum yayınlayamaz.
   Sayfa çağırdığı oturumun geldiğini bu yazımdan okur (§1 · Oturumu çağır).
4. **İzle.** `ArtifactComments watch url:<adres>` — sayfanın "Send to Claude"
   yorumu ancak izleyen oturumu uyandırır. Çıplak `watch` listesinde sayfa görünmeli.
5. **Güncellik.** `git fetch origin main && git checkout -B main origin/main`, dökümler
   (`ArtifactData get` · `out_dir:.canli-not/dokum`): `collection:oturum doc_id:aktif`
   (3. adımdan SONRA) ve `collection:yayin doc_id:son`; sonra iki denetim:
   - program: `node tools/canli-not.js denetle .canli-not/dokum/yayin/son.json`;
   - sayfa: `Artifact read url:<adres> path:index.html out_dir:.canli-not/dokum/sayfa`
     → `node tools/canli-not.js denetle .canli-not/dokum/sayfa/index.html`.
   Eskiyse §1'in sırasıyla güncellenir (önce program ve `yayin/son`, sonra sayfa).
6. **Aç.** `Artifact open url:<adres>` — kullanıcı sayfayı görür.
7. **Kuyruk.** §2: `ArtifactData list notlar` → `node tools/canli-not.js liste
   .canli-not/dokum`; bekleyenler sırayla, yanıtlanmış sorular (`yanit` dolu,
   durum yeniden `bekliyor`) yanıtıyla. `ArtifactComments read url:<adres>`:
   Claude'a gönderilmiş ama cevapsız konu varsa yanıtlanır.
8. Sohbette TEK satır: sayfa açık, yayındaki sürüm, bekleyen not sayısı.

## 1 · Yayın — program ANA DALIN KENDİSİDİR; TEK YAZAR; sayfa KENDİLİĞİNDEN YENİLENMEZ

Kullanıcı 2026-11-05: *"güncelliğinden emin olalım, öyle devam edelim"* ve
*"artifaktı otomatik olarak yenileme, güncellemeleri 'Notlar' kısmından göster,
oraya ufak bir ekran görüntüsü alıp resim koy … güncelleme geldiğinde uyarı popup
çıkar, oradan güncelle dediğimde HTML'i yenilersin."* Sayfanın her yayını açık
görünümü tazeliyordu (çizilen not, açık pencere gidiyordu).

| Yayın | Ne zaman | Nasıl | Açık görünüm |
|-------|----------|-------|--------------|
| **Programın güncellemesi** | sahibi oturum: her nottan ve her güncelleme isteğinden sonra | DEĞİŞEN parçalar VARLIK deposuna + kaydın `yayin/son` belgesi | DEĞİŞMEZ: "Güncelleme" penceresi sorar, Güncelle yükler (yalnız değişen parça iner, proje taşınır); "Sonra" o sürümü bir daha sormaz, şeritte "Güncelleme" düğmesi kalır |
| **Sayfanın yayını** | yalnız sayfa (`tools/canli-not*`) değiştiyse | `Artifact` publish, `files` YOK | tazelenir; `claude.hot` projeyi ve yarım notu taşır |
| **Yenile** (şeritte, kullanıcının düğmesi) | kullanıcı isteyince — F5 yerine | yalnız program (çerçeve) yeniden yüklenir, parçalar bellekten; yeni yayın varsa o | sayfa, notlar ve kart yerinde; proje taşınır |

### İki kapı: TEK YAZAR · SIRA

Kullanıcı 2026-11-11: *"diğer sessionlardan gelen güncellemelerle de bazen
karışabiliyor."* Her oturum her birleşmeden sonra Canlı Not'taki programı da
yeniliyordu (üç günde 57 birleşme; yayın kaydı 6 günde 74 kez yazıldı) ve kaydın
sırası denetlenmiyordu: son yazan kazanıyor, eski sürüm yenisinin üstüne yazabiliyordu.

- **TEK YAZAR.** Programı, kaydı ve sayfayı yalnız Canlı Not'un sahibi oturum
  (`oturum/aktif`) yayınlar. Sahibi olmayan oturum birleştirir, Canlı Not'a DOKUNMAZ;
  onun birleşmesi sayfaya kullanıcının **Programı güncelle**'siyle gelir (sahibi ana
  dalı yayınlar). `yayin` komutu sahibi olmayanı reddeder (dökümden okur).
- **SIRA.** Yayın geri gitmez: yayındaki sürüm derlemeden yeniyse `yayin` kaydı yazmaz.
  `yayin/son` hep `if_version` ile yazılır; çakışma = araya başka yayın girdi → kaydı
  yeniden oku, `yayin`i yeniden çalıştır.
- Kapı: `canli-not.test.js` → *İKİ KAPI*.

### Programın güncellemesi — PARÇALI

Kullanıcı 2026-11-11 (boyut sınırı): program tek metin varlığıydı (sınırı 20 MiB) ve
17,2 MiB'a gelmişti — bir haftada 5,3 MiB görsel; sayfanın gömdüğü kopya 16 MB'ı
çoktan aşmıştı. Program artık yuvalara ayrılır: **yuva 0 kod** (iskelet), 512 KiB'tan
uzun her satır (gömülü görseller, kütüphaneler — `build.js` her birini tek satıra
yazar) kendi yuvasında. Sıkışan yuva gzip → taban64 saklanır, 12 MiB'ı aşan bölünür.
`ozet` yuvanın içeriğinin özeti: **değişmeyen yuva yeniden yüklenmez, sayfa onu
yeniden indirmez.** Ölçü: 17,2 MiB program → 6 yuva, saklanan 10,3 MiB; tipik
güncelleme yalnız kod, 4,4 MiB. Kapı: `canli-not.test.js` → *PARÇALI YAYIN*.

```bash
git fetch origin main && git checkout -B main origin/main
# dökümler: sahiplik ve önceki yayın — hazirla yerinde duranı, yayin iki kapıyı bunlardan okur
#   ArtifactData get url:<adres> collection:oturum doc_id:aktif out_dir:.canli-not/dokum
#   ArtifactData get url:<adres> collection:yayin  doc_id:son   out_dir:.canli-not/dokum
node tools/canli-not.js hazirla   # → mfsim.html · parca/*.txt · yayin-plan.json · canli-not.html; YÜKLE listesi
node tools/canli-not.js duman     # sayfa + parçalar gerçek tarayıcıda: indirir, açar, birleştirir, program başlar
```

- **Kapı:** `hazirla` HEAD `origin/main` değilse ya da commit edilmemiş değişiklik
  varsa DURUR; künyenin dalı `main` yazılır. Parçalar diskten okunup geri kurulur —
  program bire bir çıkmazsa DURUR. `--dal` yalnız yerel deneme içindir, YAYINLANMAZ.
- **Duman** yayından ÖNCE: sıkıştırılmış yuvayı açan kod tarayıcının akışıdır, Node'daki
  geri kurma onu koşmaz. Sayfa hatası ya da açılmayan program DURDURUR.
- Sırayla:
  1. `hazirla`nın **YÜKLE** dediği her dosya AYRI çağrıda:
     `Artifact` publish `url:<adres>` `asset: true` `file_path: .canli-not/yayin/parca/<…>.txt` → `id`.
     *yerinde* denen yuva yüklenmez.
  2. `node tools/canli-not.js yayin --parca <özet>=<id> [--parca …] --notlar 6,8-21`
     → `.canli-not/yayin/yayin-son.json`; yazım satırını (`if_version`) ve artık
     kullanılmayan varlıkları basar. Bölünmüş yuvanın parçası `<özet>.2` gibi anılır.
  3. Notların sonucu ve cevabı ÖNCE yazılır (§2 · 6–7), `yayin/son` EN SON:
     `ArtifactData set` `collection: yayin` `doc_id: son`
     `file_path: .canli-not/yayin/yayin-son.json` `if_version: <dökümdeki sürüm>` —
     pencere çıktığında Notlar hazır olsun.
  4. Yazım BAŞARILI olduktan sonra `yayin`in listelediği artık varlıklar silinir
     (`Artifact delete url:<adres> path:<id>`): açık görünüm eskisini zaten yüklemiş.
- **Denetim:** `node tools/canli-not.js denetle .canli-not/dokum/yayin/son.json`:
  *Güncel* · *ESKİ … programı güncelle* (programın girdileri değişti) · *yalnız künye
  eski* (belge ya da yalnız sayfa birleşmesi; güncelleme gerekmez — sayfanın şablonu ve
  çekirdeği programa girmez). Sayfanın kendisi:
  `Artifact read url:<adres> path:index.html out_dir:.canli-not/dokum/sayfa` →
  `denetle .canli-not/dokum/sayfa/index.html` — bugünkü şablon ve çekirdekle aynı mı
  (ayar satırı hariç); *Sayfa ESKİ* → sayfanın yayını.
- **Ne zaman:** sahibi oturumda her nottan sonra (CLAUDE.md → Teslim Akışı, 6) ve her
  uyanışın başında (§2).
- **Açılış:** sayfa kayıttaki yayını yükler. Sayfa program GÖMMEZ: geçerli yayın
  yoksa "Program yayını yok." yazar, yayın gelince yükler.
- `mfsim.html` = karşılama karesiz tek dosya (`MFSIM_KARSILAMA=yok`) + köprü `<meta charset>`'ın
  arkasında (önüne girince kodlama kayboluyordu: "MFSim aÃ§Ä±lÄ±yor"). Yerelde durur
  (parçaların kaynağı, duman); yayınlanmaz.
- **Sınır:** parça başına 20 MiB (deponun metin varlığı; 12 MiB'ta bölünür). Programın
  toplamını yalnız depo sınırlar (1 GiB · 5000 dosya).

### Sayfanın yayını

`node tools/canli-not.js sayfa` (ya da `hazirla`nın yazdığı `canli-not.html`) →
`Artifact` publish `url:<adres>` `file_path: .canli-not/yayin/canli-not.html`,
**`files` YOK**, `capabilities` HER yayında tam kümeyle (aşağıda). Başka konuşmadan: önce
`Artifact read url:<adres>`. Sayfanın ayar satırı sayfanın KENDİ künyesidir (şeritteki
sürümün ipucunda); açık programın sürümü kayıttan.

- **Yetki beyanı** (tam küme — yazılmayan düşer): `capabilities: {db: {}, user: {},
  comments: {}, assets: {}, downloads: true}`, `icon: "pen"`. Her sayfa yayınında yazılır:
  saklı beyan 2026-11-11 yoklamasından kalan bağlayıcı komutlarını taşıyabilir ve sayfa
  artık hiçbirini kullanmıyor.
- **Yayın, yayınlayan oturumu sayfanın İZLEYİCİSİ yapar** (kalıcı kayıt arka planda
  kurulur). Sahipliği geçici alan oturum işi bitince `oturum/aktif`'i geri yazar, sonra
  `ArtifactComments watch url:<adres>` → `watch url:<adres> on:false` ve çıplak `watch`
  listesinde sayfanın OLMADIĞINI görür: yayından hemen sonra verilen `on:false`
  kurulmakta olan kaydı düşürmüyor (bir oturum başkasının notuyla böyle uyandı).
- Adres: **https://claude.ai/artifact/QGgtFrx2mV2ePnd7Lpjh91** (gizli; yalnız kullanıcı).

### Oturumu çağır — sayfa BAĞLI oturumu uyandırır, oturum AÇAMAZ

Kullanıcı 2026-11-11: *"HTML üzerinden Claude'a komutlar göndersin"* · *"bu iş
olabildiğince kolay olsun artık"* — değişiklik için her seferinde yeni oturum açmak
pratik değil.

**Sayfa oturum açamaz — iki ölçüm (2026-11-11; ayrıntı `references/emekli-oturum-gorevi.md`):**
sayfaya Claude Code'un oturum açan ve oturuma yazan komutları kapalı (istenen yedi
komuttan üçü açık); elle çalıştırılan görev de var olan oturumu UYANDIRMADI, depo bağlı
olmayan yeni bir oturum açtı. Görev silindi; hesapta görev yok.

**Çalışan yol yorumdur.** Sayfayı izleyen oturum Claude'a giden her yorumla uyanır; tek
oturum açık kaldıkça yeni oturum gerekmez (her not onu uyandırır).

- **Sayfa.** Şeritteki **Oturumu çağır** Claude'a `Oturum çağrısı · bekleyen N not`
  yorumunu gönderir ve `oturum/cagri`'ya `{zaman, onceki: <o anki oturum/aktif.zaman>,
  konu}` yazar; düğme "Çağrılıyor…". `oturum/aktif`'in zamanı değişince "Oturum geldi."
  (iki makinenin saati karşılaştırılmaz); 10 dakikada gelmeyen çağrı eskir. Bağlı oturum
  yoksa çağrı gitmez, durum ve çare söylenir: "Claude oturumu bağlı değil. Yeni oturumda
  “Canlı Not’u getir” yazın." — o durumda tek yol §0.
- **Oturum, bu yorumla uyanınca:** §2'nin kendisi (sahiplik → güncellik → kuyruk). Sahibi
  ise `oturum/aktif`'i ŞİMDİKİ zamanla yeniden yazar (sayfanın "geldi"si); konuya tek
  satır cevap, `resolve`.
- **Ne zaman işe yarar:** notlar kayıtta bekliyor ve oturum durmuşsa (kullanım sınırı,
  yarım kalan tur) not yazmadan yeniden başlatır.
- Kapı: `canli-not.test.js` → *çağrı* · *OTURUMU ÇAĞIR*.

### Programı güncelle düğmesi — ana dalın son hâli

Kullanıcı 2026-11-11: *"Canlı notun içine de belli bir yere programı güncelleyen bir buton
koyalım. Yani şu an güncelle dediğimiz zaman sanırım canlı not üzerinden yaptığımız
değişiklikleri güncelliyor."* Güncelleme penceresi yalnız sahibi oturumun YAYINLADIĞINI
yükler; başka oturumların birleşmeleri kendiliğinden gelmez (tek yazar). Şeritteki
**Programı güncelle** kayda `istek/guncelle` (`{durum:'bekliyor', zaman, sayfaSurum}`)
yazar ve Claude'a `Program güncelleme isteği · açık sürüm <sha>` yorumunu gönderir. Bu
yorumla uyanan oturum (sahiplik §2'nin başı), sırayla:

1. `ArtifactData get collection:istek doc_id:guncelle` → `durum:'yapiliyor'` (`if_version`).
   Durum `iptal`se (sayfada Vazgeç) iş yapılmaz: konuya tek satır, `resolve`.
2. `git fetch origin main`; `ArtifactData get collection:yayin doc_id:son out_dir:…` →
   `node tools/canli-not.js denetle <döküm>`: *Güncel* ya da *yalnız künye eski* (programın
   girdileri aynı — belge/araç birleşmesi) → `durum:'guncel'`, `surum` (yayındaki kısa sha);
   konuya tek satır cevap, `resolve`. Bitti.
3. Değilse programın güncellemesi (yukarıdaki adımlar; `--notlar` yok): `hazirla` →
   `duman` (hazırlanan sayfa ve parçaların KENDİSİ: açılış · 0 sayfa hatası · 0 ağ;
   karşılama karesinin isteği sayılmaz — bu yayında kare yok) → YÜKLE parçaları →
   `yayin` → `yayin/son` → artık varlıkları sil.
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

### Notlar sırayla, bu oturumda — ajan YOK

Kullanıcı 2026-11-13: *"Ayrıca 'ajan' muhabbetini de kaldıralım. Tokenlerim çok hızlı bitmeye
başladı, normal sıra sıra devam etsin."* Not başına ajan (2026-11-11) kaldırıldı: notlar
bu oturumda, eskiden yeniye, TEK TEK uygulanır; Agent ya da Workflow aracı kullanıcı
istemedikçe başlatılmaz. Her not kendi commit'i, PR'ı ve yayınıyla (aşağıda *HER NOT BİTİNCE
HEMEN YAYIN*) biter, sonraki not ondan sonra başlar. Sonucun görüntüsü
`node tools/canli-not.js sonuc N` ile, kılavuz ve görsel adımları birleştirmeden önce.

Her not için:

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
   **Notun ekran fotoğrafı silinir** (kullanıcı 2026-11-11: depo 1 GiB, ilk haftada
   188 MB doldu; fotoğraf not başına ~0,7 MB ve uygulanan notta işi kalmaz):
   `Artifact delete url:<adres> path:<foto.id>`, aynı yazımda `foto: {"__delete__": true}`
   ve `fotoDurum: "silindi"`. Sonucun görüntüsü (`sonuc.foto`) KALIR.
8. Notun konusu (`konu`) varsa `ArtifactComments reply` (aynı `cevap`) ve `resolve`.

**HER NOT BİTİNCE HEMEN YAYIN — parti beklenmez** (kullanıcı 2026-11-05: *"Bu
sefer neden yapıp güncellemedin sistemi? Yaptıkların hala uygulanıyor olarak
görünüyor?"* · *"neden şimdiye kadar adım adım yaptıklarını 'Canlı Not' kısmında
yayınlamadın?"*): notun commit'i → `npm run hazir` → PR + merge → programın
güncellemesi (§1: `hazirla` → `duman` → değişen parçalar → `yayin`) → notun
`uygulandi`sı (sonuç, `pr`) ve konusunun cevabı. Ürün
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
- Kayıt sınırı: belge 256 KiB (sayfa seçimi kırpar), depo 25.000 belge. Varlık deposu
  1 GiB · 5000 dosya: fotoğraf (gzip + base64, bir not ~0,7 MB) not uygulanınca
  silinir (§2 · 7); sonucun görüntüsü kalır; program parçaları (saklanan ~10 MiB,
  parça başına 20 MiB) — eskiyen parça yayından sonra silinir.

## 4 · Notun belgesi (`notlar/<id>`)

| Alan | Yazan | Ne |
|------|-------|----|
| `no` · `sira` · `zaman` | sayfa | gösterilen numara · sıralama anahtarı (ms) · ISO |
| `metin` · `yer` | sayfa | kullanıcının notu · "FEAD › Kayış Tablosu" |
| `cizim` | sayfa | `{g, y, dpr, kutu, sekiller:[{arac, d, kutu, uc?}]}` — iframe'in CSS px'i |
| `secim` | sayfa | `{ic, cevre, ok, kap, basliklar}` öğe künyeleri |
| `baglam` · `ortam` · `sayfaSurum` | sayfa | programın durumu · çerçevenin farkları · yayının künyesi |
| `foto` · `fotoDurum` | sayfa · Claude | `{id, boyut}` · `aliniyor` · `hazir` · `alinamadi` · `yok` · `silindi` (not uygulanınca Claude siler) |
| `gonderim` · `konu` | sayfa | `claude` / `kayit` · yorumun kimliği |
| `yanit` · `yanitZaman` | sayfa | soruya kullanıcının yanıtı |
| `durum` | ikisi | `bekliyor` → `uygulaniyor` → `uygulandi` · `soru` · `iptal` |
| `cevap` · `surum` · `pr` | Claude | yapılan · commit · birleşen PR |
| `sonuc` | Claude | `{foto, g, y}` — uygulanan değişikliğin görüntüsü (varlık) ve CSS px ölçüsü |

**Yayın belgesi (`yayin/son`, Claude yazar — `yayin` komutu kurar):** `{surum, sha, pr,
zaman, oturum, program: {boyut, uzunluk, parcalar: [{yuva, id, ozet, boyut, sik, ad}]},
notlar: [no…]}` — yuva 0 iskelet (kod), aynı yuvanın parçaları sırayla eklenir, `sik`
`gzip` (taban64) ya da `yok`; `uzunluk` birleşen programın karakter sayısı (sayfa
denetler). Eski biçim (`program: {id, boyut}` — tek varlık) okunur, yazılmaz. Sayfa ile
araç aynı doğrulamayı okur; bozuk belge sayfada güncelleme sayılmaz, araçta yazılmaz.

**Sahiplik belgesi (`oturum/aktif`, Claude yazar):** `{oturum, zaman}` — notları
işleyen ve yayınlayan oturumun adresi (§0 · 3; §1 · tek yazar). Sayfa yalnız `zaman`ın
değiştiğine bakar (çağrılan oturum geldi mi).

**Çağrı belgesi (`oturum/cagri`, sayfa yazar — §1 · Oturumu çağır):** `{zaman, onceki,
konu}` ya da gitmeyen çağrıda `{zaman, durum: 'hata', hata}`.

## 5 · Odaklı sayfa — bir bileşene ayrılmış Canlı Not

Kullanıcı 2026-11-11: *"Bu sessionumuzda seninle 'takoz çökme ve titreşim' modülünün sadece
'parametrik analiz' bileşeni ile uğraşacağız … sadece bu bileşene ait bir 'canlı not'
oluşturmanı istiyorum."*

| Sayfa | Odak | Adres |
|-------|------|-------|
| MFSim Canlı Not | — | https://claude.ai/artifact/QGgtFrx2mV2ePnd7Lpjh91 |
| Canlı Not · Parametrik Analiz | `parametrik` | https://claude.ai/artifact/MP2etxUfqMpw2nTmcE3GXT |
| Canlı Not · HTML raporu (belge odağı) | `param-html` | https://claude.ai/artifact/3APYVTsSGtfvSiKQEc89Bu |
| Canlı Not · Çözücü | `cozucu` | https://claude.ai/artifact/5USDxFN6pzjquT7xWNaR6z |

- **Ayrı Artifact:** kendi kaydı (`notlar` · `yayin/son` · `oturum/aktif` · `istek/guncelle`),
  varlık deposu ve sahibi; §0–§3 aynen geçerli, adres o sayfanınki. Araç komutları
  `--odak <ad>` alır (`hazirla` · `sayfa` · `duman` · `yayin` · `sonuc`); yerel dizinler
  `.canli-not/<ad>/yayin` · `.canli-not/<ad>/dokum`. TEK YAZAR sayfa başına: iki sayfanın
  sahibi ayrı oturum olabilir.
- **Program bileşende açılır:** her açılışta (Güncelle · Yenile dâhil) taşınan proje
  yüklendikten SONRA köprünün tarifi (`ODAKLAR`) bileşenin penceresini açar. Tarif yerindekini
  kullanır — Takoz'daysa modüle yeniden girmez, model varsa örnek yüklemez, bileşen varsa
  kurmaz. İlk açılışta: karşılamanın Takoz yolu → Tulga örneği → bileşen araç şeridinde Rapor'un
  altında (çerçeve çizgisine değmeden); açılış geri alınamaz.
- **Not numarası sayfanın aralığında** (`taban`; Parametrik Analiz 1001'den, HTML raporu 2001'den, Çözücü 3001'den): "Canlı not N"
  commit'i ve `assets/degisiklik/not-N.webp` iki sayfada çakışmaz; ana sayfa odakların
  aralığını atlar.
- **Sonucun görüntüsü** sayfanın açtığı yerden: `node tools/canli-not.js sonuc N --odak <ad>
  [--secici …]`.
- **Oturumu çağır** odaklı sayfada da çalışır: yorum o sayfayı izleyen oturumu uyandırır (§1).
- **İlk yayın** (sayfa yoksa): ana daldan `hazirla --odak <ad>` → `duman --odak <ad>` (pencere
  açılmazsa DURUR) → sayfa `Artifact publish` **url'siz** (yeni adres; `capabilities: {db: {},
  user: {}, comments: {}, assets: {}, downloads: true}`, `icon: "pen"`) → parçalar `asset: true`
  o adrese → `oturum/aktif` yazılır ve dökülür → `yayin --odak <ad> --ilk --parca …` →
  `yayin/son` → `ArtifactComments watch` → tabloya adres → `Artifact open`. Sonraki her yayın
  `url` ile (§1).
- **Yeni odak:** çekirdeğe (`ODAKLAR`: `ad` · `baslik` · `tip` · `taban` — öbür aralıkların
  dışında) ve köprüye (aynı adla tarif) birer kayıt. Kapı: `canli-not.test.js` → *ODAK*.
- **Belge odağı** (`belge: true`, `tip` yok; kullanıcı 2026-11-11: *"Bu HTML belgesini 'canlı not'
  tarzına alsana. Üzerinde göstererek değişiklikler yaparız."*): çerçevede program değil programın
  ÜRETTİĞİ belge. `hazirla --odak <ad>` programı derler, belgeyi gerçek tarayıcıda programın kendi
  yolundan üretir (`canli-not.js` → `BELGE_URET`; `param-html`: Tulga, varsayılan adaylar, tarama,
  HTML'in indirme yolu), künyeyi ve köprüyü belgeye koyar — denetim, yayın, TEK YAZAR ve SIRA
  programınkiyle aynı. Köprü işaretli belgeyi yüklenince hazır sayar, tarif belgenin görüntüleyicisini
  bekler. Notun kaynağı belgenin kurucusu (`param-html` → `js/mount-param-html.js`); sonucun görüntüsü
  dalın belgesinden: `hazirla --dal --odak <ad>` → `sonuc N --odak <ad> [--hazirlik …] [--secici …]`
  (hazırlık belgenin içinde koşar: `veRapor.goster()`, `location.hash`). Kapı: `canli-not.test.js` →
  *BELGE ODAĞI*.
