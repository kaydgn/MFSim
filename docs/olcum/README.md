# Ölçüm defteri — `boyut.csv`

Teslim edilen tek dosyanın (`MFSim_Code.html`) boyut geçmişi. **Satırı,
dosyayı kullanıcıya gönderen oturum yazar** — gönderim sırası zaten build alıp
boyutu ölçüyor, satır oradan bedavaya gelir.

Eskiden bunu günlük bir rutin yazıyordu; rutin 2026-09-28'de kaldırıldı (haftalık
limiti tüketiyordu) ve **18 günde deftere tek satır düşürememişti** — çıktısını
merge edilmeyen bir dala itiyordu. Defterin değeri ölçümde değil, ölçümün
MERGE EDİLMİŞ olmasında.

## Neden var

CLAUDE.md şunu söylüyor: *"Sebepsiz bir büyüme bir regresyon işaretidir; sayıyı
çıplak basmak onu gizler."* Ama bugüne kadar bunu **ölçen hiçbir şey yoktu** ve
belgedeki sayılar çoktan bayatlamıştı: CLAUDE.md karşılama slaytını "24 görsel,
2,3 MB" diye anıyor, disktekiler **28 kare, 6,7 MB**; `assets/music` (5,2 MB)
hiç geçmiyor; dosya "17,1 MB" yazıyor, ölçülen **18,2 MB**.

Defterin işi bir sayıyı saklamak değil, **sıçramayı sebebiyle yakalamak**.

## Sütunlar

| Sütun | Ne |
|-------|-----|
| `tarih` | UTC, `YYYY-MM-DD` |
| `sha` | ölçümün yapıldığı `origin/main` kısa SHA'sı |
| `ham_bayt` | `MFSim_Code.html` bayt |
| `gzip_bayt` | `gzip -9` bayt — **teslim edilen budur**, sınır 30 MiB |
| `assets_vendor_bayt` | `assets/` + `vendor/` toplamı (ham boyutun ana sürücüsü) |
| `not` | sıçrama varsa **sebebi** (hangi commit, hangi varlık); yoksa kısa |

Virgül `not` sütununda kullanılmaz — alan tırnaksız okunabilir kalsın.

## Eşikler (nöbetin bağırma kuralı)

- `gzip_bayt` > 25 MiB → teslim sınırına yaklaşıldı, raporda **uyarı**.
- Bir önceki satıra göre `ham_bayt` artışı > %2 **veya** > 300 KB → sebebi
  bulunmadan satır yazılmaz.
