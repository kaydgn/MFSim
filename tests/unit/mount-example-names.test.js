/**
 * Gömülü örnek modellerde AD ↔ KONUM tutarlılığı
 * ──────────────────────────────────────────────
 * TULGA örneğinde bir ön takoz kaynak kayıttan "Sağ Ön Takoz" adıyla gelmişti
 * ama y = −355.957, yani SOL taraftaydı. İki sonucu vardı:
 *
 *   1. Aynı ad İKİ takozda birden görünüyordu. Kanal kimliği ada bağlıdır
 *      (js/mount-signals.js _mountKeys) — kimlik "_2" ekiyle ayrıldığı için
 *      veri çakışmıyordu, ama ETİKET ayrılmıyordu: pano şeridinde ve raporda
 *      iki satır "Sağ Ön Takoz" yazıyor, hangisinin hangisi olduğu okunamıyordu.
 *   2. İkisinden biri YANLIŞ TARAFI gösteriyordu. Viraj ve bordür yük
 *      durumlarında sağ/sol takozlar zıt yüklenir; adı ters olan takozun
 *      sonucunu okuyan kişi işareti ters yorumlar.
 *
 * Ad bir etikettir, çözüme girmez — bu yüzden hiçbir sayısal test bunu
 * yakalayamazdı. Kilit burada: ad, KOORDİNATINA karşı denetleniyor.
 *
 * Aynı model İKİ yerde saklanıyor: js/mount-core.js (panel önizlemesi) ve
 * assets/examples/*.json ("Örneği Aktar" bunu önceliklendirir). İkisi ayrışırsa
 * kullanıcı ekranda JSON'daki adı görür — bu yüzden İKİSİ de denetleniyor ve
 * ayrıca birbirleriyle karşılaştırılıyor.
 *
 * İŞARET SÖZLEŞMESİ (js/cp-mount.js ve js/cp-mount-viewer.js'te üç yerde yazılı):
 *   +X araç ARKASI · +Y SAĞ · +Z YUKARI
 */
const fs = require('fs');
const path = require('path');
const core = require('../../js/mount-core.js');

const ROOT = path.join(__dirname, '..', '..');
const JSON_DIR = path.join(ROOT, 'assets', 'examples');

// Adı sözcüklerine ayır.
//
// DİKKAT — \b KULLANILAMAZ. JavaScript'te \w = [A-Za-z0-9_]; 'ğ', 'ş', 'ö' gibi
// harfler sözcük karakteri SAYILMAZ, dolayısıyla /\bSağ\b/ "Sağ Ön Takoz"
// içinde HİÇ eşleşmez (sonundaki 'ğ' non-word olduğu için orada sınır yoktur).
// Bu testin ilk hâli tam olarak bu tuzağa düşmüştü: denetim sessizce hiçbir
// şeye bakmıyor, her veri "temiz" çıkıyordu. Unicode harf sınıfıyla bölüyoruz.
function kelimeler(ad) {
  return String(ad == null ? '' : ad).split(/[^\p{L}]+/u).filter(Boolean);
}

// Adın iddia ettiği taraf ile koordinatın söylediği taraf çelişiyor mu?
// Yalnız Y (sağ/sol) denetlenir: "Ön/Arka" eşiği modele göre değişir (üç
// istasyonlu ASFAT'ta bir de orta istasyon var), sağ/sol ise mutlaktır.
function yanCelisiyorMu(ad, y) {
  if (!Number.isFinite(y)) return false;
  const w = kelimeler(ad).map((s) => s.toLocaleLowerCase('tr'));
  if (w.indexOf('sağ') >= 0 && y < 0) return true;
  if (w.indexOf('sol') >= 0 && y > 0) return true;
  return false;
}

function tekrarli(adlar) {
  const say = {};
  adlar.forEach((a) => { say[a] = (say[a] || 0) + 1; });
  return Object.keys(say).filter((a) => say[a] > 1).sort();
}

const ORNEKLER = core.getMountExampleList();

// JSON topolojisindeki takoz düğümleri (alt-topoloji dahil).
function jsonTakozlari(dosya) {
  const d = JSON.parse(fs.readFileSync(path.join(JSON_DIR, dosya), 'utf8'));
  const out = [];
  (function gez(ns) {
    (ns || []).forEach((n) => {
      const dd = n.data || {};
      if (n.type === 'mnt-mount') out.push({ id: n.id, ad: n.customName || '', y: parseFloat(dd.y) });
      const alt = (dd.subTopology || {}).nodes;
      if (alt) gez(alt);
    });
  })(d.nodes || []);
  return out;
}

describe('denetim mekanizmasının kendisi çalışıyor mu', () => {
  // Bir denetim testinin en sinsi hâli SESSİZCE HİÇBİR ŞEYE BAKMAMASIDIR.
  // Bu testin ilk sürümü /\bSağ\b/ kullanıyordu ve Türkçe harfler yüzünden
  // hiç eşleşmiyordu; bütün veriler "temiz" çıkıyordu. Önce ölçeri ölçüyoruz.
  test('yanCelisiyorMu gerçekten yakalıyor', () => {
    expect(yanCelisiyorMu('Sağ Ön Takoz', -355.957)).toBe(true);   // ASIL HATA
    expect(yanCelisiyorMu('Sol Arka Takoz', 304.131)).toBe(true);
    expect(yanCelisiyorMu('sağ orta', -357.1)).toBe(true);         // küçük harf
    expect(yanCelisiyorMu('Ön Sağ · 57RS313774', -50.67)).toBe(true);
    expect(yanCelisiyorMu('Sağ Ön Takoz', 356.042)).toBe(false);
    expect(yanCelisiyorMu('Ön Takoz', 0.047)).toBe(false);
    expect(yanCelisiyorMu('Motor', NaN)).toBe(false);
    // "Solenoid" gibi içinde 'sol' GEÇEN ama taraf bildirmeyen ad yanmasın
    expect(yanCelisiyorMu('Solenoid Braketi', 120)).toBe(false);
  });

  test('tekrarli() ölçeri de çalışıyor', () => {
    expect(tekrarli(['A', 'B', 'A'])).toEqual(['A']);
    expect(tekrarli(['A', 'B'])).toEqual([]);
  });
});

describe('örnek kartları — denetim gerçekten koşuyor', () => {
  test('üç örnek de model ve topoloji taşıyor', () => {
    // Bu test kendi kendini doğrular: kartlar boşalırsa aşağıdaki denetimler
    // sessizce hiçbir şeyi kontrol etmemeye başlardı.
    expect(ORNEKLER.length).toBeGreaterThanOrEqual(3);
    ORNEKLER.forEach((e) => {
      expect(e.model.mounts.length).toBeGreaterThanOrEqual(3);
      expect(e.model.components.length).toBeGreaterThanOrEqual(2);
      expect(fs.existsSync(path.join(JSON_DIR, path.basename(e.topology)))).toBe(true);
    });
  });
});

describe('mount-core.js gömülü örnekleri — ad ↔ konum', () => {
  ORNEKLER.forEach((e) => {
    const takoz = e.model.mounts.map((m) => ({ ad: m.name, y: m.pos[1] }));
    const govde = e.model.components.map((c) => ({ ad: c.name, y: (c.cg || [])[1] }));

    test(`${e.id}: "Sağ"/"Sol" adı Y işaretiyle çelişmiyor`, () => {
      const hatali = takoz.concat(govde).filter((n) => yanCelisiyorMu(n.ad, n.y))
        .map((n) => `${n.ad} @ y=${n.y}`);
      expect(hatali).toEqual([]);
    });

    test(`${e.id}: iki takoz aynı adı taşımıyor`, () => {
      // Kanal kimliği ada bağlı (mount-signals _mountKeys): tekrarlı ad,
      // ayırt edilemeyen iki şerit ve iki rapor satırı demek.
      expect(tekrarli(takoz.map((m) => m.ad))).toEqual([]);
    });
  });
});

describe('assets/examples/*.json — "Örneği Aktar"ın kullandığı kopya', () => {
  ORNEKLER.forEach((e) => {
    const dosya = path.basename(e.topology);
    const takozlar = jsonTakozlari(dosya);

    test(`${dosya}: takoz düğümleri okunabiliyor`, () => {
      expect(takozlar.length).toBe(e.model.mounts.length);
      takozlar.forEach((t) => expect(Number.isFinite(t.y)).toBe(true));
    });

    test(`${dosya}: "Sağ"/"Sol" adı Y işaretiyle çelişmiyor`, () => {
      const hatali = takozlar.filter((t) => yanCelisiyorMu(t.ad, t.y))
        .map((t) => `${t.id} "${t.ad}" @ y=${t.y}`);
      expect(hatali).toEqual([]);
    });

    test(`${dosya}: iki takoz aynı adı taşımıyor`, () => {
      expect(tekrarli(takozlar.map((t) => t.ad))).toEqual([]);
    });

    test(`${dosya}: iki kopyanın GEOMETRİSİ aynı`, () => {
      // "Örneği Aktar" JSON'u önceliklendirir; yalnız mount-core düzeltilirse
      // kullanıcı ekranda eski hâli görür. Burada geometri kilitleniyor.
      //
      // ADLAR birebir karşılaştırılMIYOR: SİPER'in iki kopyası bilerek farklı
      // stil kullanıyor ('sağ ön' ↔ 'Sağ Ön Takoz'). Bu bir hata değil, kozmetik
      // fark — ve ikisi de yukarıdaki taraf denetiminden geçiyor. Adları eşitlemek
      // ayrı bir iş; burada kilitlenen şey KONUM.
      const jy = takozlar.map((t) => t.y).sort((a, b) => a - b);
      const cy = e.model.mounts.map((m) => m.pos[1]).sort((a, b) => a - b);
      expect(jy).toHaveLength(cy.length);
      cy.forEach((v, i) => expect(jy[i]).toBeCloseTo(v, 3));
    });
  });
});

describe('TULGA ön takoz çifti — düzeltmenin kilidi', () => {
  const tulga = ORNEKLER.find((e) => e.id === 'tulga');

  test('y<0 olan ön takoz "Sol Ön Takoz", y>0 olan "Sağ Ön Takoz"', () => {
    const sol = tulga.model.mounts.find((m) => Math.abs(m.pos[1] + 355.957) < 1e-3);
    const sag = tulga.model.mounts.find((m) => Math.abs(m.pos[1] - 356.042) < 1e-3);
    expect(sol.name).toBe('Sol Ön Takoz');
    expect(sag.name).toBe('Sağ Ön Takoz');
  });

  test('konum ve rijitlik DEĞİŞMEDİ — yalnız etiket düzeltildi', () => {
    // Düzeltme bir veri değişikliği değil; sayılar kaynak kayıtla birebir kalmalı.
    const sol = tulga.model.mounts.find((m) => m.name === 'Sol Ön Takoz');
    expect(sol.pos).toEqual([439.961, -355.957, 499.855]);
    expect(sol.kstat).toEqual([515, 260, 242]);
    expect(sol.kdyn).toEqual([335, 355, 740]);

    const t = jsonTakozlari('tulga_topoloji.json').find((x) => x.ad === 'Sol Ön Takoz');
    const d = JSON.parse(fs.readFileSync(path.join(JSON_DIR, 'tulga_topoloji.json'), 'utf8'));
    const dugum = (d.nodes || []).find((n) => n.id === t.id);
    expect(parseFloat(dugum.data.x)).toBeCloseTo(439.961, 6);
    expect(parseFloat(dugum.data.y)).toBeCloseTo(-355.957, 6);
    expect(parseFloat(dugum.data.z)).toBeCloseTo(499.855, 6);
    expect(parseFloat(dugum.data.kzs)).toBeCloseTo(242, 6);
  });

  test('iki kopya AYNI adları taşıyor — düzeltme tek dosyada kalmadı', () => {
    // Hata iki yerdeydi; biri düzeltilip öteki unutulsaydı "Örneği Aktar"
    // kullanıcıya hâlâ yanlış adı gösterirdi.
    const json = jsonTakozlari('tulga_topoloji.json').map((t) => t.ad).sort();
    const core_ = tulga.model.mounts.map((m) => m.name).sort();
    expect(json).toEqual(core_);
    expect(json).toContain('Sol Ön Takoz');
    expect(json.filter((a) => a === 'Sağ Ön Takoz')).toHaveLength(1);
  });

  test('beş takozun tamamı benzersiz adlı — kanal kimliği "_2" ekine düşmüyor', () => {
    const adlar = tulga.model.mounts.map((m) => m.name);
    expect(adlar).toHaveLength(5);
    expect(new Set(adlar).size).toBe(5);
  });
});
