---
name: kullanim
description: MFSim'i KULLANICI GÖZÜYLE kullanma ve geri bildirim protokolü (kullanım masası + karar tahtası). Kullanıcı programı "kullan / mühendis gibi kullan / geri bildirim ver / kullanıcı gözüyle bak" dediğinde, ya da tools/kullanim.js, tools/kullanim-tahta.js, tools/kullanim-tahta.html, tests/unit/kullanim-masa.test.js dosyalarına dokunmadan ÖNCE çağır. Masanın açılışı, adım yardımcıları, ölçülerin anlamı ve sınırları, bulgu biçimi, kayıtlı kullanıcı kararlarıyla çakışma denetimi ve tahtanın yayını buradadır.
---

# Kullanım masası ve karar tahtası

Kullanıcı isteği (2026-11-02): *"programı konfor, kalite ve estetik arayan,
işinin ehli bir mühendis gibi kullanmanı ve geri bildirimler yapmanı
istiyorum."* Masa programı kullanıcının koşullarında açar; tahta bulguları
kullanıcının karar verdiği tek yer.

## 1 · Masayı aç

```bash
npm run build                                     # masa MFSim_Code.html'i açar
node tools/kullanim.js baslat --temiz             # Bash run_in_background ile
node tools/kullanim.js durum                      # hazır mı (açılış ~20 sn)
```

- **Kullanıcının koşulu:** aynı tek dosya `file://` ile, çevrimdışı (her http(s)
  isteği kesilir ve adımda yazılır), insan açılışı (`navigator.webdriver` yok —
  yükleyici süs beklemelerini yapar), tr-TR, kalıcı profil (`.kullanim/profil`).
- **Ekran ön ayarı** (`--ekran`): `masaustu` 1920×945 (varsayılan) · `dizustu`
  1536×756 %125 · `kucuk` 1366×633 · `tam` 1920×1080. Tam pencere tarayıcının
  görünür alanı, tahmindir; kullanıcının gerçek ölçüsü biliniyorsa
  `--genislik/--yukseklik/--dpr`.
- `--temiz` = ilk açılış deneyimi (profil silinir). `--otomasyon` yalnız
  karşılaştırma için (bekleme kapalı açılış).
- Kaynak değişince masa ESKİ kodu koşar: `dur` + `baslat`.

## 2 · Adım = bir kullanıcı niyeti

```bash
node tools/kullanim.js adim "Kayış boyunu 1.716 mm yap" - <<'JS'
await yaz(etiket('Boy'), '1716', { enter: true });
return await metin(yazi('Kayış boyu').locator('..'));
JS
```

- **EYLEM gerçek girdiyle** (`tikla · ciftTikla · sagTikla · yaz · bas · tuslar ·
  ustune · surukle · teker · sec · dosyaSec`). Programın işlevini doğrudan
  çağırmak kullanıcının yaşamadığı bir yolu ölçer. **OKUMA serbest**
  (`olc(fn)`, `metin`, `kutu`, `odak`, `imlec`, `ipucuOku`, `secenekler`, `pano`).
- Hedef: `rol('button', 'Hesapla')` · `yazi('…')` · `etiket('…')` · `ipucu('…')`
  (yalnız görünenler, tam eşleşme) ya da CSS. Birden çok eşleşme HATA verir —
  hedefi daralt, `.first()` ile susturma.
- Adımı kullanıcının niyetiyle adlandır; numara ve görüntü adı ondan türer.
  Görüntüye bakmadan hüküm verme: `Read .kullanim/goruntu/<no>-<ad>.png`.
- Ayrıntı: `buyut --kutu x,y,g,y --kat 3` (1× piksel, yumuşatmasız) ·
  `adim … --secici <css>` (yalnız o yüzey) · `pdf(ad)` (baskı önizlemesi;
  rapor ve pano için) · `sekme(i)` (yeni açılan pencere).
- Diyalog varsayılan kabul (`diyalog('red')` sonrakini reddeder); sistem kaydet
  penceresi önerilen adı kabul eder (`kaydetPenceresi('iptal' | 'ad.json')`),
  dosya `.kullanim/indirilen/`e düşer.

## 3 · Ölçülerin anlamı ve sınırı

| Satır | Ne | Güvenilirlik |
|-------|----|--------------|
| `donma` | ≥ 50 ms uzun görevler (adet · en uzun · toplam) | İşlemciye bağlı; konteyner 4 çekirdek — yüzeyleri birbiriyle kıyasla |
| `etkileşim` | girdiden sonraki boyamaya süre (Event Timing) | Yazılım çizimi şişirir; ≥ 200 ms güvenilir işaret |
| `kare` | yalnız hareketli adımda (sürükle · tekerlek · üstüne gel) | 60 fps tavan |
| `sakinleşme` | son uzun görev + sonlu animasyon bitene dek | Görüntü bundan sonra |
| `bellek` | JS yığını | Yaklaşık |

**Görüntüye girmeyenler** (işletim sistemi çizer): `title` ipucu, açık
`<select>` listesi, yerel sağ tık menüsü, kaydet ve yazdır pencereleri —
okunur ya da adım çıktısında yazılır. **Yazı tipi Inter** (Segoe UI yok): satır
kırılımı ve sığma bulgusu kullanıcının ekranında farklı çıkabilir; bulguda söyle.

## 4 · Mühendis gibi kullan

- **Gerçek iş yap, düğme gezme.** Modülün alanından bir görev seç (gerçek bir
  motorun FEAD'i, bir aracın 0–80 km/h'i, bir güç grubunun takozları) ve baştan
  sona bitir; sürtünme işin ortasında çıkar.
- **Sayıyı elle doğrula** (doğruluk): kayış boyu, oran, frekans, birim, işaret
  yönü — en az bir değeri bağımsız hesapla karşılaştır.
- **Tür:** `konfor` (adım sayısı, bekleme, donma, odak kaybı, geri-al tanesi,
  klavye) · `kalite` (hata, tutarsız durum, veri kaybı, konsol) · `estetik`
  (hiza, boşluk, tipografi, renk, ailenin tekliği) · `dogruluk` (değer, birim,
  gelenek).
- **Önem:** `yuksek` işi durdurur, yanlış sonuç ya da veri kaybı · `orta`
  tekrarlayan sürtünme, göze batan kusur · `dusuk` rötuş.
- **Kanıt şart:** her bulgu görsel ya da ölçüm taşır (tahta kanıtsızı reddeder);
  yeniden üretme adımları ve beklenti yazılır. Ölçmeden "yavaş", "kalabalık" denmez.

## 5 · Önermeden önce kayıtlı kararlara bak

Kök CLAUDE.md'deki ortak kurallar ve modülün skill'i kullanıcının KARARLARIDIR.
Bir öneri bir kararla çakışıyorsa bulgu düşürülmez, yeni diye de sunulmaz:
`kural` alanına kararın kendisi yazılır, kullanıcı tahtada yeniden karar verir.
Sık çakışanlar: ARAYÜZ ANLATMAZ (açıklama metni önerilmez; yönlendirme yalnız
yuvasında) · bileşen penceresinde sekme yok · Takoz penceresi sonuç göstermez ·
açılış beklemesi bilerek · FEAD'de kasnak kutusu yok.

## 6 · Bulgu biçimi ve tahta

`.kullanim/bulgular.json` (elle yazılır):

```json
{ "modul": "FEAD", "tarih": "02.11.2026", "surum": "7c94ad5 · PR #1206",
  "ekran": "1920×1080 · %100 · tam pencere", "kosul": "Chromium · Inter · çevrimdışı",
  "dpr": 1, "izlenim": "isteğe bağlı genel hüküm",
  "bulgular": [ { "id": "F01", "baslik": "…", "tur": "konfor", "onem": "orta",
    "yuzey": "Kayış Tablosu", "gozlem": "…", "beklenti": "…",
    "olcum": "…", "oneri": "…", "kural": "…", "adimlar": ["…"],
    "gorseller": [ { "yol": ".kullanim/goruntu/0012-x.png",
                     "kirp": [x, y, g, y], "isaret": [[x, y, g, y]], "not": "…" } ] } ] }
```

Kırpma ve işaret CSS px, ekran görüntüsünün koordinatında (`kutu()` verir);
işaret kırmızı revizyon bulutu olur.

```bash
node tools/kullanim-tahta.js          # → .kullanim/tahta.html (doğrulamadan geçmezse DURUR)
```

Yayın: Artifact, `file_path` `.kullanim/tahta.html`, `capabilities {db: {}}`;
aynı yol aynı adres. Oturumun tahtası tektir: yeni bulgu aynı tahtaya eklenir,
kimlik değişmez (karar `karar/<id>`'ye bağlı). Kararlar:
`ArtifactData list karar` → `{karar: duzelt|kalsin|sonra|null, not}`.
**Düzelt** olağan teslim akışıyla uygulanır (ölçüm + PR + tahtada önce/sonra);
**Kalsın** dokunulmaz; **Sonra** tahtada kalır. Sayfa açık renk, tek tema ve
geliştirme ayrıntısı taşımaz (kök CLAUDE.md → *HER DEĞİŞİKLİKTEN SONRA ARTIFACT*).

Kapı: `tests/unit/kullanim-masa.test.js` (ayrıştırma, sayı okuma, ölçü özeti,
bulgu doğrulama, şablonun çapaları ve tek teması).
