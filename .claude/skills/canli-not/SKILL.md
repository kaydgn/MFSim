---
name: canli-not
description: MFSim CANLI NOT protokolü — kullanıcının claude.ai'da programın üstüne çizerek (daire, ok, kutu, kalem) bıraktığı değişiklik notlarını okuma ve SIRAYLA uygulama. Canlı Not sayfasından "Not N · …" yorumu Claude'a gönderildiğinde (oturum bu yorumla uyanır), kullanıcı "notları uygula / canlı notlar" dediğinde, ya da tools/canli-not.js, tools/canli-not.html, tools/canli-not-kopru.js, tools/canli-not-cekirdek.js, tests/unit/canli-not.test.js dosyalarına dokunmadan ÖNCE çağır. Yayın, notun okunması (kayıt + ekran fotoğrafı + yeniden çizim), durum geçişleri, soru-yanıt ve teslim buradadır.
---

# Canlı Not

Kullanıcı isteği (2026-11-04): *"programı bir arayüze alalım, açalım. Oraya
buraya girelim ve ben çizerek, yuvarlak içine alarak istediğim değişiklikleri
canlı olarak yazayım. Sen de bunları sırası ile uygula."*

```
claude.ai · Canlı Not sayfası                       Claude Code oturumu
┌───────────────────────────────┐   Send to Claude   ┌──────────────────────────┐
│ program (iframe: mfsim.html)  │ ── "Not N · yer" ─▶│ uyanır → kayıttan okur    │
│ + kırmızı kalem katmanı       │                    │ → ekranı yeniden çizer    │
│ + not kartı + kuyruk          │◀── durum · cevap ──│ → uygular → yeniden yayın │
└───────────────────────────────┘   (Artifact db)    └──────────────────────────┘
```

**Neden claude.ai:** kullanıcının ağı GitHub'a da Pages'e de çıkamıyor; çalışan
tek kanal claude.ai. **Neden iframe:** program sayfanın kendisi olsaydı yayının
iskeleti sahte `</body>`'ye ve `data-theme`'e takılırdı (Artifact önizlemesinin
emekli tuzakları, `docs/decisions/ortak-yuzeyler.md`); `files` ile yayınlanan
ikinci HTML iskeletsiz sunulur.

## 1 · Yayın — program ANA DALIN KENDİSİDİR

Kullanıcı 2026-11-05: *"güncelliğinden emin olalım, öyle devam edelim."* Eski
kopyanın üstüne yazılan not boşa gider (başka oturumun düzelttiği şeye not).

```bash
git fetch origin main && git checkout -B main origin/main
node tools/canli-not.js hazirla        # → .canli-not/yayin/{canli-not.html, mfsim.html}
```

- **Kapı:** `hazirla` HEAD `origin/main` değilse ya da commit edilmemiş değişiklik
  varsa DURUR; künyenin dalı `main` yazılır (yerel dalın adı değil). `--dal` yalnız
  yerel deneme içindir, çıktısı YAYINLANMAZ.
- **Denetim:** `Artifact read url:<adres> path:mfsim.html` (diske iner, bağlama
  girmez) → `node tools/canli-not.js denetle <dosya>`: *Güncel* · *ESKİ … yeniden
  yayınla* (programın girdileri değişti) · *yalnız künye eski* (belge birleşmesi;
  yayın gerekmez — her yayın kullanıcının açık görünümünü tazeler).
- **Ne zaman:** her birleşmeden sonra (CLAUDE.md → Teslim Akışı, 6) ve her
  uyanışın başında (§2). Ölçülen: 43b40ef'ten yeniden kurulan paket yayındakiyle
  bayt bayt aynı (11.982.428 bayt).

- `mfsim.html` = karşılama karesiz tek dosya (`MFSIM_KARSILAMA=yok`, 29,8 → 11,4 MB;
  Artifact'in dosya sınırı 16 MB — aşılırsa betik DURUR) + köprü `<meta charset>`'ın
  arkasında (önüne girince kodlama kayboluyordu: "MFSim aÃ§Ä±lÄ±yor").
- **İlk yayın:** `Artifact` publish, `file_path: .canli-not/yayin/canli-not.html`,
  `files: {"mfsim.html": ".canli-not/yayin/mfsim.html"}`,
  `capabilities: {db: {}, user: {}, comments: {}, assets: {}, downloads: true}`, `icon: "pen"`.
- **Yeniden yayın** (her uygulanan nottan sonra): aynı `file_path` + `files`,
  `capabilities` YAZILMAZ (saklı beyan korunur). Başka konuşmadan: önce
  `Artifact read url:<adres>`, sonra `url` ile publish.
- Yayın açık görünümü tazeler; sayfa programın projesini ve yarım notu taşır
  (`claude.hot` anlık görüntüsü), modülün içindeki gezinme taşınmaz (kök topoloji).
- Adres: **https://claude.ai/artifact/QGgtFrx2mV2ePnd7Lpjh91** (gizli; yalnız kullanıcı).

## 2 · Uyanış ve sıra

Uyandıran yorum yalnız işarettir; iş KAYITTAN okunur ve bütün bekleyenler sırayla
işlenir (aynı anda gelen iki yorum iki uyanış demek; ikincisi boş kuyruk bulur).
Önce **güncellik** (§1 · Denetim): yayın eskiyse notlardan ÖNCE yeniden yayınla —
notun `baglam.surum`u hangi kopyaya yazıldığını söyler.

```
ArtifactData list   url:<adres> collection:notlar out_dir:.canli-not/dokum
node tools/canli-not.js liste .canli-not/dokum      # işi kalanlar, sırayla
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
   CLAUDE.md'nin kuralları ve modül skill'leri yine geçerli. Not kayıtlı bir
   kararla çakışıyorsa ya da iki anlamlıysa UYGULAMA: `durum: "soru"`, `cevap` =
   tek soru. Kullanıcı sayfadan yanıtlar (`yanit` alanı, durum yeniden
   `bekliyor`); yanıtlı not yanıtıyla birlikte okunur.
5. **Uygula.** Modül skill'i (fead · arac-performans · kullanim) → değişiklik →
   modül testi → `npm run hazir`. Not başına TEK commit:
   `Canlı not N: <programdaki adıyla özet>`. Push.
6. **Yeniden yayınla** (§1) — kullanıcı değişikliği aynı sayfada görür.
7. `durum: "uygulandi"`, `cevap`, `surum` (commit'in kısa sha'sı). `cevap` en çok üç
   cümle, programda görünen adlarla; ölçüldüyse önce → sonra sayısı. Dosya adı,
   işlev, test adı YAZILMAZ (kullanıcı kararı 2026-10-19).
8. Notun konusu (`konu`) varsa `ArtifactComments reply` (aynı `cevap`) ve `resolve`.

**Kuyruk boşalınca:** PR + merge (CLAUDE.md → Teslim Akışı), birleşen notlara
`pr` yazılır. Notların `cevap`ı o turun ölçüm kaydıdır — ayrıca rapor sayfası
gerekmez; birden çok notluk bir tur bittiğinde kısa bir özet sohbette verilir.

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
  varlık deposunda (gzip + base64, bir not ~0,7 MB).

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
