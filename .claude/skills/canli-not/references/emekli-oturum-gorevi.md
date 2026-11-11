# Emekli: sayfadan oturum BAŞLATMAK (görevle)

Kullanıcı 2026-11-11: değişiklik için her seferinde yeni oturum açmak pratik değil;
sayfanın oturumu kendisinin başlatması istendi. İki yol ölçüldü, ikisi de kapalı.

## 1 · Sayfanın doğrudan komutları

Sayfa, kullanıcının Claude Code bağlayıcısından yedi komut istedi; kullanıcının
hesabında (izin verildi, bağlayıcı bağlı) açık olanlar:

| Komut | Açık |
|-------|------|
| ortamları listele · görevleri listele | evet (salt okur) |
| kayıtlı görevi çalıştır | evet |
| oturum aç · oturuma yaz · oturumları listele · oturumu oku | hayır |

## 2 · Kayıtlı görev

Takvimsiz bir görev kuruldu ("Canlı Not oturumu"), Canlı Not'un oturumuna bağlandı
(var olan oturuma çalışacak biçimde) ve bir kez elle çalıştırıldı (bağlı oturum o sırada
not işliyordu).

- Var olan oturum uyanmadı. **Yeni bir oturum açıldı ve depo bağlı değildi.**
- O oturum protokolü okuyamadı; sahiplik kaydına, sayfaya ve notlara dokunmadan durdu;
  kullanıcının telefonuna iki bildirim gönderdi.
- Araçla kurulan göreve depo bağlanamıyor (kaynak listesi boş kuruluyor, alanı yok).
- Görevi kurmak ve çalıştırmak oturumda ayrıca izin istiyor.

Görev aynı gün silindi. Hesapta görev yok (CLAUDE.md → *Zamanlanmış rutin YOK*).

## Yeniden denenecekse

- Bağlı oturum BOŞTAYKEN elle çalıştırmanın onu uyandırıp uyandırmadığı ölçülmedi. Her
  deneme, tutmazsa, bir boş oturum ve telefon bildirimi demek.
- Deposu bağlı yeni oturum açan bir görev ancak kullanıcının claude.ai arayüzünde, depo
  seçilerek kurduğu bir görevle olur; o zaman her basış YENİ bir oturumdur (§0'ın tamamı).
- Yorum yolu (§1 · Oturumu çağır) bağlı oturum varken bunların hepsinden ucuz ve kesin.
