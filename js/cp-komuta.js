// ═══════════════════════════════════════════════════════════════════════════
// KOMUTA PENCERESİ — "elimdeki kopyada ne var" + SİPARİŞ FİŞİ
// ═══════════════════════════════════════════════════════════════════════════
//
// Şeritten (Araçlar → Komuta) açılır, ikinci bir şifre ister. İçeride
// TEZGÂHLAR durur: her tezgâh programın bir veri yapısını ÖLÇER, kullanıcı
// üstünde işaretleme yapar ve pencere bir SİPARİŞ FİŞİ üretir — Claude Code'a
// yapıştırılan, makine tarafından ayrıştırılabilen düz metin.
//
// Pencere kendisi HİÇBİR ŞEY DEĞİŞTİRMEZ. `file://` ile açılan bir HTML'in
// diske yazma yetkisi yok; tel her zaman kullanıcıdır. Bu bir eksiklik değil:
// gözden geçirilmeden uygulanan bir değişiklik zaten istenmiyor.
//
// ── DÖRT KARAR ─────────────────────────────────────────────────────────────
//
// 1 · PENCERE ÖLÇER, BEYAN ETMEZ. Hiçbir tezgâh "FEAD modülü şunları yapar"
//     diye elle yazılmış bir özet tutmaz. Gösterilen her sayı çalışma anında
//     canlı veri yapısından okunur (VE_KARSILAMA_GORSELLER.length gibi).
//     Sebep ölçülmüş: CLAUDE.md bir kez 6.052 satıra çıktı ve %71'i elle
//     yazılmış bir ölçüm defteriydi — elle yazılan özet SESSİZCE bayatlar,
//     çünkü onu koda karşı denetleyen hiçbir şey yoktur. İnsan diliyle başlık
//     gerekiyorsa (kare adları) ayrı bir künyeden gelir ve o künyenin iki
//     yönlü test kapısı vardır (tests/unit/karsilama-secici.test.js).
//
// 2 · FİŞ KÜNYE TAŞIR — ASIL KAPI BU. Oturum konteyneri depoyu bir ANLIK
//     GÖRÜNTÜDEN klonluyor ve indirilen program da bir anlık görüntü; ikisi de
//     `main`in gerisinde olabilir (ölçüldü: bir oturum üç PR geriden açıldı,
//     CLAUDE.md). Elindeki kopya bayatsa bu pencere BAYAT BİR GERÇEĞİ kendinden
//     emin biçimde raporlar — "28 kare var" der, oysa main'de 31 vardır. Fişin
//     `kunye` satırı bunu ölçülebilir yapar: fişi alan taraf künyeyi
//     `origin/main` ile karşılaştırıp sapmayı UYGULAMADAN ÖNCE söyleyebilir.
//     Künye okunamıyorsa satır BOŞ BIRAKILMAZ, "doğrulanmalı" yazar.
//
// 3 · KAPAK, KİLİT DEĞİL. Hash bu dosyanın içinde açık duruyor; konsolu açan
//     biri kontrolü atlayabilir. Korunan şey HASAR değil KARIŞIKLIK: kapağı
//     atlayan biri kullanamayacağı bir metin üretir (deposu ve Claude Code'u
//     yok). js/auth.js'in aynı mekanizması, ayrı anahtar.
//     Şifreyi değiştirmek için:
//       node -e "console.log(require('crypto').createHash('sha256').update('YENISIFRE').digest('hex'))"
//     çıktıyı VE_KOMUTA_HASH'e yaz. Varsayılan: 'komuta'.
//
// 4 · FİŞ DİAKRİTİKSİZ ASCII. Alan adları 'kunye/tezgah/kaldir' — 'künye'
//     değil. Fiş kopyalanıp yapıştırılıyor, bazen elle yeniden yazılıyor;
//     kodlama bozulması ve yazım farkı en çok orada kaçar. Gövde (başlıklar,
//     not) Türkçe kalır — ayrıştırılan yalnız ALAN ADIDIR.
//
// Ad öneki `veKomuta…` / `_vk…` (source-hygiene kapısı: aynı adı iki dosyada
// üst-seviye bildirmek birincisini sessizce ezer).

// ── KAPI ───────────────────────────────────────────────────────────────────

var VE_KOMUTA_HASH = '4a8a20a037bfd77e43cf988795d9146bb3eedb25674259c8114093eaa73a0d69';
var VE_KOMUTA_KEY = 'mfsim_komuta_token';

// sessionStorage: sekme kapanınca düşer. localStorage OLMAMASI bilinçli —
// program şifresi "beni hatırla" sunuyor çünkü her açılışta gerekiyor; komuta
// penceresi seyrek açılıyor, kalıcı bir jeton tutmanın karşılığı yok.
function veKomutaYetkiliMi() {
  try { return sessionStorage.getItem(VE_KOMUTA_KEY) === VE_KOMUTA_HASH; } catch (e) { return false; }
}

async function veKomutaGiris() {
  var inp = document.getElementById('ve-komuta-sifre');
  var err = document.getElementById('ve-komuta-hata');
  if (!inp || !err) return;
  var pw = inp.value;
  if (!pw) { err.textContent = 'Şifre giriniz.'; return; }
  var hash = (typeof mfsimSHA256 === 'function') ? await mfsimSHA256(pw) : null;
  if (hash === VE_KOMUTA_HASH) {
    try { sessionStorage.setItem(VE_KOMUTA_KEY, hash); } catch (e) {}
    err.textContent = '';
    inp.value = '';
    _vkRender();
  } else {
    err.textContent = 'Hatalı şifre.';
    inp.value = '';
    inp.focus();
  }
}

function _vkGirisTus(e) { if (e && e.key === 'Enter') veKomutaGiris(); }

// ── KÜNYE ──────────────────────────────────────────────────────────────────

// Fişin ilk bilgi satırı. Gömülü künye yoksa (modüler index.html) SESSİZ
// KALMAZ — bir sonraki okuyucuya sapmanın ölçülmediğini söyler.
function veKomutaKunyeMetni(build) {
  var b = build;
  if (b === undefined) b = (typeof window !== 'undefined') ? window.__MFSIM_BUILD : null;
  if (!b || !(b.shortSha || b.sha)) return '(modüler kopya — main ile dogrulanmali)';
  var p = [String(b.shortSha || b.sha).slice(0, 7)];
  if (b.prNumber) p.push('PR #' + b.prNumber);
  if (b.date) p.push(String(b.date).slice(0, 10));
  return p.join(' · ');
}

// ── ÖLÇÜM ÖZETİ — fişin İKİNCİ ve asıl kapısı ──────────────────────────────
//
// `kunye` satırı kopyanın sürümünü söyler ama SORUYU CEVAPLAMAZ: "bu fiş hâlâ
// geçerli mi?" Ölçüldü — bir turda `main` altı PR ilerledi ve karşılama listesi
// HİÇ DEĞİŞMEDİ. Sha karşılaştırması orada "fiş altı PR eski" der; yanlış
// alarmdır ve birkaç kez tekrarlandığında kapı güvenilirliğini yitirir.
//
// Bu yüzden fiş, tezgâhın ÖLÇTÜĞÜ ŞEYİN özetini de taşır. Fiş uygulanırken
// aynı özet güncel çalışma ağacından yeniden hesaplanır (tools/komuta-dogrula.js):
// tutuyorsa liste değişmemiştir ve sha ne olursa olsun fiş geçerlidir;
// tutmuyorsa hangi kaydın gelip hangisinin gittiği ADIYLA söylenebilir.
//
// Anahtarlar SIRALANARAK özetlenir: `kaldir` küme anlamlıdır — dosyadaki
// sıranın değişmesi "06"nın hangi kare olduğunu değiştirmez, o yüzden yeniden
// sıralama bir sapma sayılmamalı.

// FNV-1a (32 bit). Kriptografi DEĞİL, değişiklik tespiti — tarayıcıda ve
// Node'da aynı sonucu vermesi, senkron olması ve `crypto.subtle`in secure
// context koşuluna takılmaması gerekiyor.
function veKomutaOzet(metin) {
  var s = String(metin == null ? '' : metin);
  var h = 0x811c9dc5;
  function kar(b) {
    h ^= b & 0xff;
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  for (var i = 0; i < s.length; i++) {
    var c = s.charCodeAt(i);
    kar(c); kar(c >> 8);          // iki bayt: Türkçe harf taşıyan bir tezgâh da bozulmasın
  }
  return ('0000000' + h.toString(16)).slice(-8);
}

function veKomutaOlcumOzeti(kayitlar) {
  var a = (kayitlar || []).map(function (k) { return String(k && k.anahtar); }).sort();
  return a.length + ' kayit \u00b7 ' + veKomutaOzet(a.join('\u0001')).slice(0, 6);
}

// ── SİPARİŞ FİŞİ — SAF ÇEKİRDEK (DOM'suz, test edilebilir) ─────────────────

var VE_KOMUTA_FIS_BASLIK = 'MFSIM-SIPARIS v1';
var VE_KOMUTA_BOS = '(yok)';

// Alan sırası SABİT ve ayrıştırıcıyla ortak. Değeri olmayan alan atlanmaz,
// '(yok)' yazar: eksik satır ile "bilerek boş" ayırt edilebilsin.
var VE_KOMUTA_ALANLAR = ['kunye', 'tezgah', 'dosya', 'olcum', 'kaldir', 'ekle', 'not'];
var _VK_LISTE_ALAN = { kaldir: 1, ekle: 1 };

function _vkTekSatir(s) {
  // Not alanındaki satır sonu fişin satır tabanlı ayrıştırmasını bozar —
  // bir sonraki satır alan adı sanılır. Temizlik ÜRETİMDE yapılır.
  return String(s == null ? '' : s).replace(/[\r\n]+/g, ' ').trim();
}

function veKomutaFisUret(siparis) {
  var s = siparis || {};
  var deger = {
    kunye: _vkTekSatir(s.kunye || veKomutaKunyeMetni()),
    tezgah: _vkTekSatir(s.tezgah),
    dosya: _vkTekSatir(s.dosya),
    olcum: _vkTekSatir(s.olcum),
    kaldir: (s.kaldir || []).map(_vkTekSatir).filter(Boolean),
    ekle: (s.ekle || []).map(_vkTekSatir).filter(Boolean),
    not: _vkTekSatir(s.not)
  };
  var en = VE_KOMUTA_ALANLAR.reduce(function (m, a) { return Math.max(m, a.length); }, 0);
  var satirlar = [VE_KOMUTA_FIS_BASLIK];
  VE_KOMUTA_ALANLAR.forEach(function (alan) {
    var v = deger[alan];
    if (_VK_LISTE_ALAN[alan]) v = v.length ? v.join(', ') : VE_KOMUTA_BOS;
    else if (!v) v = VE_KOMUTA_BOS;
    satirlar.push(alan + new Array(en - alan.length + 1).join(' ') + ': ' + v);
  });
  return satirlar.join('\n');
}

// Gidiş-dönüş kapısının diğer ucu. Başlık tutmuyorsa null döner — yanlış
// ayrıştırılmış bir nesne döndürmek, fişi bir sözleşme olmaktan çıkarırdı.
function veKomutaFisAyristir(metin) {
  var satirlar = String(metin == null ? '' : metin).split(/\r?\n/);
  var i = 0;
  while (i < satirlar.length && !satirlar[i].trim()) i++;
  if (i >= satirlar.length || satirlar[i].trim() !== VE_KOMUTA_FIS_BASLIK) return null;
  var out = { kunye: '', tezgah: '', dosya: '', olcum: '', kaldir: [], ekle: [], not: '' };
  for (i++; i < satirlar.length; i++) {
    var m = /^\s*([a-z]+)\s*:\s*(.*)$/.exec(satirlar[i]);
    if (!m) continue;
    var alan = m[1];
    if (VE_KOMUTA_ALANLAR.indexOf(alan) < 0) continue;
    var ham = m[2].trim();
    if (_VK_LISTE_ALAN[alan]) {
      out[alan] = (ham === VE_KOMUTA_BOS || !ham) ? []
        : ham.split(',').map(function (x) { return x.trim(); }).filter(Boolean);
    } else {
      out[alan] = (ham === VE_KOMUTA_BOS) ? '' : ham;
    }
  }
  return out;
}

// ── TEZGÂHLAR ──────────────────────────────────────────────────────────────
//
// Bir tezgâh şunları söyler:
//
//   dosya       fişin adres göstereceği yol — ve doğrulayıcının OKUYACAĞI modül
//   disaAktarim o modülün hangi adı dışa aktardığı
//   kaynak()    TARAYICIDA aynı veriyi nereden okuduğu
//   olc(veri)   veri → kayıt listesi. SAF: hiçbir global okumaz
//   duzen       'izgara' (görselli) | 'liste' (metin)
//
// `olc` NİYE ARGÜMAN ALIYOR: ilk yazımda veriyi üst-seviye bir addan kendisi
// okuyordu ve doğrulayıcı o adı `global`e koyarak Node'da koşturuyordu. Tek
// tezgâhla yürüdü; ikincisinde çöktü — arşivin verisi `programlar/kayit.json`
// içinde `programlar` adıyla duruyor ve onu global'e koymak `js/` genelinde
// bir ad çakışması demekti (source-hygiene kapısı zaten yasaklıyor). Veri
// artık ARGÜMAN: tarayıcı `kaynak()`ından, doğrulayıcı diskten getiriyor,
// `olc` ikisini de aynı biçimde görüyor.
//
// `dosya` + `disaAktarim` bir KAPIDIR: tests/unit/komuta.test.js yolun diskte
// var olduğunu VE o adın gerçekten dışa aktarıldığını ölçer — biri kayarsa fiş
// olmayan bir dosyayı adres gösterir ve bu SESSİZ olurdu.

function _vkKarsilamaKunye() {
  if (typeof window === 'undefined') return null;
  return window.__MFSIM_KARSILAMA_KUNYE || null;
}

var VE_KOMUTA_TEZGAHLAR = [
  {
    id: 'karsilama',
    ad: 'Karşılama Slaytı',
    dosya: 'js/karsilama-gorseller.js',
    disaAktarim: 'VE_KARSILAMA_GORSELLER',
    duzen: 'izgara',
    ipucu: 'Açılışta gösterilen kareler. Kaldırılacakları tıklayın.',
    kaynak: function () {
      return (typeof VE_KARSILAMA_GORSELLER !== 'undefined' && VE_KARSILAMA_GORSELLER) || [];
    },
    olc: function (veri) {
      var kunye = _vkKarsilamaKunye();
      return (veri || []).map(function (ad) {
        var mm = /(\d+)/.exec(ad);
        var no = mm ? mm[1] : ad;
        var k = (kunye && kunye.kareler) ? kunye.kareler[no] : null;
        return {
          anahtar: no,
          etiket: ad,
          baslik: k ? (k.baslik || '') : '',
          meta: k ? [k.grup, k.es ? 'eşi: ' + k.es : ''].filter(Boolean).join(' · ') : '',
          gorsel: (typeof veSlaytKaynak === 'function') ? veSlaytKaynak(ad) : 'assets/karsilama/' + ad
        };
      });
    }
  },
  {
    id: 'arsiv',
    ad: 'Program Arşivi',
    dosya: 'programlar/kayit.json',
    disaAktarim: 'programlar',
    duzen: 'liste',
    ipucu: 'Araçlar → Program Arşivi\'nde listelenen tek dosyalık programlar.',
    kaynak: function () {
      var k = (typeof veProgramlarKayit === 'function') ? veProgramlarKayit() : null;
      return (k && k.programlar) || [];
    },
    olc: function (veri) {
      return (veri || []).map(function (p) {
        return {
          anahtar: String(p.dosya || ''),
          etiket: String(p.dosya || ''),
          baslik: (p.simge ? p.simge + ' ' : '') + String(p.ad || p.dosya || ''),
          meta: [p.kume, p.tarih, p.not].filter(Boolean).join(' · ')
        };
      });
    }
  },
  {
    id: 'ap-ornek',
    ad: 'Araç Performans Örnekleri',
    dosya: 'js/cp-arac-example.js',
    disaAktarim: 'AP_EXAMPLES',
    duzen: 'liste',
    ipucu: 'Araç Performans modülünün örnek kartları.',
    kaynak: function () { return (typeof AP_EXAMPLES !== 'undefined' && AP_EXAMPLES) || []; },
    olc: function (veri) { return _vkOrnekKayitlari(veri); }
  },
  {
    id: 'takoz-ornek',
    ad: 'Takoz Örnekleri',
    dosya: 'js/mount-core.js',
    disaAktarim: 'MOUNT_EXAMPLES',
    duzen: 'liste',
    ipucu: 'Takoz Çökme-Titreşim modülünün örnek modelleri.',
    // `MOUNT_EXAMPLES` tarayıcıda GLOBAL DEĞİL: mount-core.js bir IIFE ve değer
    // `veMountCore` ad alanından geliyor (module.exports ise Node'da düz veriyor).
    // İlk yazımda çıplak ad okundu, tezgâh SESSİZCE "0 kayıt" gösterdi —
    // e2e'deki "tarayıcı sayısı = Node sayısı" kapısı tam bunun için var.
    kaynak: function () {
      return (typeof veMountCore !== 'undefined' && veMountCore && veMountCore.MOUNT_EXAMPLES) || {};
    },
    olc: function (veri) { return _vkOrnekKayitlari(veri); }
  }
];

// İki örnek kataloğu aynı biçimde okunuyor; biri DİZİ (AP_EXAMPLES), öteki
// id'ye göre NESNE (MOUNT_EXAMPLES). Fark burada eritiliyor, iki tezgâhta
// ayrı ayrı değil.
function _vkOrnekKayitlari(veri) {
  var dizi = Array.isArray(veri) ? veri : Object.keys(veri || {}).map(function (k) {
    return veri[k];
  });
  return dizi.map(function (o) {
    return {
      anahtar: String(o.id || ''),
      etiket: String(o.id || ''),
      baslik: String(o.name || o.id || ''),
      meta: [o.vehicle, o.subtitle].filter(Boolean).join(' · ')
    };
  });
}

// Tarayıcı tarafındaki TEK ölçüm çağrısı. Doğrulayıcı aynı `olc`u diskten
// gelen veriyle çağırıyor — iki taraf da bu fonksiyonun içinden geçmiyor ama
// AYNI sözleşmeyi kullanıyor.
function veKomutaOlc(t) {
  if (!t || typeof t.olc !== 'function') return [];
  try { return t.olc(typeof t.kaynak === 'function' ? t.kaynak() : null) || []; }
  catch (e) { return []; }
}

function veKomutaTezgah(id) {
  for (var i = 0; i < VE_KOMUTA_TEZGAHLAR.length; i++) {
    if (VE_KOMUTA_TEZGAHLAR[i].id === id) return VE_KOMUTA_TEZGAHLAR[i];
  }
  return null;
}

// ── PENCERE DURUMU ─────────────────────────────────────────────────────────

var _vkAktif = VE_KOMUTA_TEZGAHLAR[0] ? VE_KOMUTA_TEZGAHLAR[0].id : null;
var _vkSecim = {};    // { tezgahId: { anahtar: true } }
var _vkNot = '';

function _vkSecimSeti(id) {
  if (!_vkSecim[id]) _vkSecim[id] = {};
  return _vkSecim[id];
}

function veKomutaSecimDegistir(id, anahtar) {
  var set = _vkSecimSeti(id);
  if (set[anahtar]) delete set[anahtar]; else set[anahtar] = true;
  _vkFisTazele();
  // Kart yeniden ÇİZİLMİYOR (28 küçük resim yeniden kurulurdu) — durum elle
  // eşitleniyor. aria-pressed'in sınıfla BİRLİKTE yazılması şart: E2E'de
  // ölçüldü, yalnız sınıf çevrilince kart gözle seçili görünüyor ama ekran
  // okuyucuya "basılı değil" diyordu.
  var kap = document.getElementById('ve-komuta-content');
  var el = kap ? kap.querySelector('[data-vk-anahtar="' + anahtar + '"]') : null;
  if (el) {
    el.classList.toggle('secili', !!set[anahtar]);
    el.setAttribute('aria-pressed', set[anahtar] ? 'true' : 'false');
  }
}

function veKomutaSecimTemizle() {
  _vkSecim[_vkAktif] = {};
  _vkRender();
}

function veKomutaTezgahSec(id) {
  _vkAktif = id;
  _vkRender();
}

function veKomutaNotYaz(v) { _vkNot = v; _vkFisTazele(); }

// Fiş, seçimden TÜRETİLİR — ikinci bir yerde tutulmaz.
function veKomutaFisMetni() {
  var t = veKomutaTezgah(_vkAktif);
  if (!t) return '';
  return veKomutaFisUret({
    tezgah: t.id,
    dosya: t.dosya,
    olcum: veKomutaOlcumOzeti(veKomutaOlc(t)),
    kaldir: Object.keys(_vkSecimSeti(t.id)).sort(),
    not: _vkNot
  });
}

function _vkFisTazele() {
  var ta = document.getElementById('ve-komuta-fis');
  if (ta) ta.value = veKomutaFisMetni();
  var sayac = document.getElementById('ve-komuta-sayac');
  if (sayac) {
    var n = Object.keys(_vkSecimSeti(_vkAktif)).length;
    sayac.textContent = n ? (n + ' kayıt işaretli') : 'işaret yok';
    sayac.classList.toggle('dolu', n > 0);
  }
}

// ── FİŞİ ALMA ──────────────────────────────────────────────────────────────
// `file://` üzerinde navigator.clipboard çoğu tarayıcıda YOK (secure context
// değil). Bu yüzden asıl yol textarea'yı seçmek; pano varsa denenir, yoksa
// seçim zaten yapılmış olur ve kullanıcı Ctrl+C'ye basar.
function veKomutaFisKopyala() {
  var ta = document.getElementById('ve-komuta-fis');
  if (!ta) return;
  ta.focus();
  ta.select();
  var bildir = function (ok) {
    if (typeof showToast === 'function') {
      showToast(ok ? 'Sipariş fişi panoya kopyalandı.' : 'Fiş seçildi — Ctrl+C ile kopyalayın.');
    }
  };
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(ta.value).then(function () { bildir(true); }, function () { bildir(false); });
      return;
    }
  } catch (e) {}
  var ok = false;
  try { ok = document.execCommand('copy'); } catch (e) {}
  bildir(ok);
}

// ── ÇİZİM ──────────────────────────────────────────────────────────────────

function _vkKacir(s) {
  return (typeof escapeHTML === 'function') ? escapeHTML(String(s == null ? '' : s))
    : String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
}

function _vkGirisHTML() {
  return '<div class="ve-komuta-giris">' +
    '<div class="ve-komuta-giris-baslik">Komuta Penceresi</div>' +
    '<div class="ve-komuta-giris-alt">Bu pencere programı değiştirmez; yalnızca durum okur ve sipariş fişi yazar.</div>' +
    '<input type="password" id="ve-komuta-sifre" class="ve-komuta-sifre" placeholder="Şifre" ' +
    'autocomplete="off" onkeydown="_vkGirisTus(event)">' +
    '<button type="button" class="ve-komuta-btn ve-komuta-btn-birincil" onclick="veKomutaGiris()">Gir</button>' +
    '<div id="ve-komuta-hata" class="ve-komuta-hata" role="alert"></div>' +
    '</div>';
}

function _vkKayitHTML(t, k, secili) {
  var liste = t.duzen === 'liste';
  var h = '<button type="button" class="ve-komuta-kart' + (liste ? ' satir' : '') +
    (secili ? ' secili' : '') + '" ' +
    'data-vk-anahtar="' + _vkKacir(k.anahtar) + '" ' +
    'onclick="veKomutaSecimDegistir(\'' + _vkKacir(t.id) + '\',\'' + _vkKacir(k.anahtar) + '\')" ' +
    'aria-pressed="' + (secili ? 'true' : 'false') + '">';
  if (!liste && k.gorsel) {
    h += '<img class="ve-komuta-kare" src="' + _vkKacir(k.gorsel) + '" alt="" loading="lazy">';
  }
  h += '<span class="ve-komuta-no">' + _vkKacir(k.anahtar) + '</span>';
  h += '<span class="ve-komuta-ad">' + _vkKacir(k.baslik || k.etiket) + '</span>';
  if (k.meta) h += '<span class="ve-komuta-meta">' + _vkKacir(k.meta) + '</span>';
  h += '<span class="ve-komuta-isaret">kaldırılacak</span>';
  return h + '</button>';
}


function _vkRender() {
  var kap = document.getElementById('ve-komuta-content');
  if (!kap) return;
  if (!veKomutaYetkiliMi()) {
    kap.innerHTML = _vkGirisHTML();
    var inp = document.getElementById('ve-komuta-sifre');
    if (inp) setTimeout(function () { inp.focus(); }, 50);
    return;
  }

  var t = veKomutaTezgah(_vkAktif);
  var kayitlar = t ? veKomutaOlc(t) : [];
  var set = _vkSecimSeti(_vkAktif);

  var h = '';

  // Künye şeridi — pencerenin ölçtüğü her şey BU kopyaya aittir.
  h += '<div class="ve-komuta-kunye">' +
    '<span class="mf-ico mf-ico-activity"></span>' +
    '<span class="ve-komuta-kunye-metin">' + _vkKacir(veKomutaKunyeMetni()) + '</span>' +
    '<span class="ve-komuta-kunye-not">Ölçülen her sayı bu kopyaya ait — fiş bunu taşır.</span>' +
    '</div>';

  // Tezgâh seçimi (bugün tek tezgâh var; liste N için kuruldu)
  h += '<div class="ve-komuta-tezgahlar" role="tablist">';
  VE_KOMUTA_TEZGAHLAR.forEach(function (x) {
    h += '<button type="button" role="tab" class="ve-komuta-tezgah' + (x.id === _vkAktif ? ' etkin' : '') +
      '" aria-selected="' + (x.id === _vkAktif ? 'true' : 'false') + '" ' +
      'onclick="veKomutaTezgahSec(\'' + _vkKacir(x.id) + '\')">' +
      _vkKacir(x.ad) + ' <span class="ve-komuta-adet">' + veKomutaOlc(x).length + '</span></button>';
  });
  h += '</div>';

  if (t) {
    h += '<div class="ve-komuta-satir">' +
      '<span class="ve-komuta-ipucu">' + _vkKacir(t.ipucu || '') + '</span>' +
      '<code class="ve-komuta-dosya">' + _vkKacir(t.dosya) + '</code>' +
      '</div>';
    h += '<div class="ve-komuta-kaydir"><div class="ve-komuta-izgara ' +
      (t.duzen === 'liste' ? 've-komuta-liste' : '') + '">';
    kayitlar.forEach(function (k) { h += _vkKayitHTML(t, k, !!set[k.anahtar]); });
    h += '</div></div>';
  }

  // Sipariş fişi
  h += '<div class="ve-komuta-fis-kap">';
  h += '<div class="ve-komuta-fis-bas">' +
    '<span class="ve-komuta-fis-baslik">Sipariş Fişi</span>' +
    '<span id="ve-komuta-sayac" class="ve-komuta-sayac"></span>' +
    '<button type="button" class="ve-komuta-btn" onclick="veKomutaSecimTemizle()">İşaretleri Temizle</button>' +
    '<button type="button" class="ve-komuta-btn ve-komuta-btn-birincil" onclick="veKomutaFisKopyala()">Kopyala</button>' +
    '</div>';
  h += '<input type="text" class="ve-komuta-not" id="ve-komuta-not" placeholder="Not (isteğe bağlı) — örn. 05 ile 08 aynı kare" ' +
    'value="' + _vkKacir(_vkNot) + '" oninput="veKomutaNotYaz(this.value)">';
  h += '<textarea id="ve-komuta-fis" class="ve-komuta-fis" readonly spellcheck="false" rows="8"></textarea>';
  h += '<div class="ve-komuta-fis-alt">Bu metni Claude Code\'a yapıştırın. Künye satırı, fişin hangi sürüme karşı yazıldığını söyler.</div>';
  h += '</div>';

  kap.innerHTML = h;
  _vkFisTazele();
}

// ── AÇ / KAPAT ─────────────────────────────────────────────────────────────

function veKomutaAc() {
  var ov = document.getElementById('ve-komuta-overlay');
  if (!ov) return;
  ov.style.display = 'flex';
  _vkKunyeYukle(function () { _vkRender(); });
  document.addEventListener('keydown', _vkEscHandler);
}

function veKomutaKapat() {
  var ov = document.getElementById('ve-komuta-overlay');
  if (ov) ov.style.display = 'none';
  document.removeEventListener('keydown', _vkEscHandler);
}

function _vkEscHandler(e) {
  if (e.key !== 'Escape') return;
  var t = e.target;
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
  veKomutaKapat();
}

// Künye kaynağı: tek dosyada build.js gömüyor; modüler index.html'de gömme
// yok → fetch'e düşülür (programlar/kayit.json ile AYNI kural). Bulunamazsa
// pencere yine çalışır: kare numarası + görsel kimliği zaten taşır, başlık
// bir kolaylıktır — yokluğu pencereyi durdurmaz.
function _vkKunyeYukle(cb) {
  if (typeof window === 'undefined') { cb(); return; }
  if (window.__MFSIM_KARSILAMA_KUNYE || typeof fetch !== 'function') { cb(); return; }
  fetch('tools/karsilama-kunye.json').then(function (r) {
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }).then(function (j) {
    window.__MFSIM_KARSILAMA_KUNYE = j;
    cb();
  }).catch(function () { cb(); });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    veKomutaFisUret: veKomutaFisUret,
    veKomutaFisAyristir: veKomutaFisAyristir,
    veKomutaKunyeMetni: veKomutaKunyeMetni,
    veKomutaOzet: veKomutaOzet,
    veKomutaOlcumOzeti: veKomutaOlcumOzeti,
    VE_KOMUTA_TEZGAHLAR: VE_KOMUTA_TEZGAHLAR,
    veKomutaOlc: veKomutaOlc,
    VE_KOMUTA_FIS_BASLIK: VE_KOMUTA_FIS_BASLIK
  };
}
