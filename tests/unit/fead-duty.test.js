/**
 * fead-duty.test.js — FEAD ÇALIŞMA ÇEVRİMİ KÜTÜPHANESİ
 *
 * Kullanıcı bildirimi (2026-08-31): *"Motor ve Çevrim kısmında aksesuar
 * seçtiğimizde çalışma çevrimini otomatik olarak hesaplamıyor. El ile girmek
 * gerekiyor. Bu olmamalı… Çalışma çevrimi sabit zaten, ona göre tabloyu
 * program otomatik olarak çıkarmalı."*
 *
 * BU DOSYANIN KİLİTLEDİĞİ İKİ ŞEY:
 *
 * 1. TABLO BOŞ AÇILMAZ. Kusur gerçekti ve ölçüldü: taze sihirbazda 0 devir
 *    noktası vardı, yani aksesuar modeli seçilse bile doldurulacak satır
 *    yoktu ve kullanıcı on iki satırı elle açıyordu.
 *
 * 2. ÇEVRİM UYDURULMAZ. Bildirimin *"çevrim sabit zaten"* yarısı TUTMADI:
 *    arşivdeki 14 sistemde ALTI ayrı devir/%zaman deseni var. Kütüphane bu
 *    yüzden tek bir "standart" gömmüyor, ölçülmüş kayıtları listeliyor —
 *    ve buradaki her sayı deponun başka bir yerinde zaten duruyor.
 *    İKİNCİ KOPYA sessizce ayrışırsa hata görünmez: kullanıcı çevrim seçer,
 *    model çözülür, uyarı çıkmaz, yalnız ömür ve yorulma payları raporundan
 *    başka çıkar. Aşağıdaki ilk kapı tam olarak onu tutuyor.
 */
const D = require('../../js/fead-duty.js');
const M = require('../../js/fead-model.js');
const FX = require('../../tests/fixtures/fead-validation.js');
const fs = require('fs');
const path = require('path');

const IDX = fs.readFileSync(path.join(__dirname, '../../index.html'), 'utf8');
const WIZ_SRC = fs.readFileSync(path.join(__dirname, '../../js/cp-fead-wizard.js'), 'utf8');
const PANEL_SRC = fs.readFileSync(path.join(__dirname, '../../js/cp-fead.js'), 'utf8');

// Fixture'daki BÜTÜN duty tablolarını topla (kaynak taraması).
function fixtureDesenleri() {
  const out = [];
  (function tara(o) {
    if (!o || typeof o !== 'object') return;
    if (Array.isArray(o.duty) && o.duty.length && o.duty[0] && o.duty[0].dcPct != null) {
      out.push({ rpm: o.duty.map((r) => r.engineRpm), dcPct: o.duty.map((r) => r.dcPct) });
    }
    Object.keys(o).forEach((k) => { if (k !== 'duty') tara(o[k]); });
  })(FX);
  // Tedarikçiye GİDEN sayfa (BMC) ayrı bir kaynak — örnek kayıt defterinden.
  const b = M.VE_FEAD_EXAMPLES.BMC_FEAD_2026.solver.duty;
  out.push({ rpm: b.map((r) => r.rpm), dcPct: b.map((r) => r.dcPct) });
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
describe('kütüphane ↔ kaynak', () => {
  test('YEDİ kaydın yedisi de kaynağında BİREBİR var', () => {
    // EN KRİTİK KAPI: buradaki diziler fixture'ın ve BMC örneğinin ikinci
    // kopyası. Ayrışırsa hata SESSİZ olur.
    const kaynak = new Set(fixtureDesenleri()
      .map((d) => d.rpm.join(',') + '|' + d.dcPct.join(',')));
    D.VE_FEAD_DUTY_DB.forEach((r) => {
      expect(kaynak.has(r.rpm.join(',') + '|' + r.dcPct.join(','))).toBe(true);
    });
    expect(D.VE_FEAD_DUTY_DB.length).toBe(7);
  });

  test('arşiv TEK bir çevrim göstermiyor — kütüphanenin var olma sebebi', () => {
    // Bir "standart" çevrim gömmek, ölçülen beş deseni yok saymak olurdu.
    const desen = new Set(fixtureDesenleri().map((d) => d.dcPct.join(',')));
    expect(desen.size).toBeGreaterThanOrEqual(6);
  });

  test('her kaydın %zaman toplamı 100', () => {
    D.VE_FEAD_DUTY_DB.forEach((r) => {
      const t = r.dcPct.reduce((a, b) => a + b, 0);
      expect(Math.abs(t - 100)).toBeLessThan(1e-6);
    });
  });

  test('devir dizisi ARTAN ve %zaman ile aynı uzunlukta', () => {
    D.VE_FEAD_DUTY_DB.forEach((r) => {
      expect(r.rpm.length).toBe(r.dcPct.length);
      expect(r.rpm.length).toBeGreaterThan(2);
      for (let i = 1; i < r.rpm.length; i++) expect(r.rpm[i]).toBeGreaterThan(r.rpm[i - 1]);
      r.dcPct.forEach((p) => expect(p).toBeGreaterThanOrEqual(0));
    });
  });

  test('anahtarlar tekil, künye alanları dolu', () => {
    const k = D.VE_FEAD_DUTY_DB.map((r) => r.key);
    expect(new Set(k).size).toBe(k.length);
    D.VE_FEAD_DUTY_DB.forEach((r) => {
      expect(r.ad.length).toBeGreaterThan(4);
      expect(r.kaynak.length).toBeGreaterThan(4);   // hangi ölçümden geldiği YAZILI
    });
  });

  test('varsayılan kayıt GERÇEKTEN listede', () => {
    expect(D.veFeadDutyOf(D.VE_FEAD_DUTY_DEFAULT)).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('okuyucular', () => {
  test('liste KOPYA döner — katalog güncellemesi eski projeyi bozmaz', () => {
    const a = D.veFeadDutyList();
    a[0].rpm[0] = 99999;
    a[0].ad = 'bozuldu';
    expect(D.veFeadDutyList()[0].rpm[0]).not.toBe(99999);
    expect(D.veFeadDutyList()[0].ad).not.toBe('bozuldu');
  });

  test('satırlar kW\'ı BOŞ üretir — güç elle girilmez, hesaplanır', () => {
    const rows = D.veFeadDutyRowsOf('AG00686-6');
    expect(rows.length).toBe(6);
    rows.forEach((r) => {
      expect(r.kw).toEqual({});
      expect(r.degC).toBe(D.VE_FEAD_DUTY_DEGC);
      expect(Number.isFinite(r.rpm)).toBe(true);
    });
  });

  test('bilinmeyen anahtar boş dizi — uydurma kayıt üretilmez', () => {
    expect(D.veFeadDutyRowsOf('yok-boyle-bir-sey')).toEqual([]);
    expect(D.veFeadDutyOf('yok-boyle-bir-sey')).toBeNull();
  });

  test('eşleme: gidiş-dönüş tutuyor, elle düzenlenen tablo NULL', () => {
    D.VE_FEAD_DUTY_DB.forEach((r) => {
      expect(D.veFeadDutyMatch(D.veFeadDutyRowsOf(r.key))).toBe(r.key);
    });
    // Tek bir devir değişince artık o kayıt DEĞİL.
    const rows = D.veFeadDutyRowsOf('AG00686-6');
    rows[2].rpm = 1234;
    expect(D.veFeadDutyMatch(rows)).toBeNull();
    expect(D.veFeadDutyMatch([])).toBeNull();
    expect(D.veFeadDutyMatch(null)).toBeNull();
  });

  test('eşleme kW\'a BAKMAZ — güç girilmiş olması çevrimi değiştirmez', () => {
    const rows = D.veFeadDutyRowsOf('AG00902-4');
    rows[0].kw = { p1: 3.4 };
    expect(D.veFeadDutyMatch(rows)).toBe('AG00902-4');
  });

  test('etiket TEK üreticiden ve kayıtları ayırt ediyor', () => {
    const et = D.veFeadDutyList().map(D.veFeadDutyLabel);
    expect(new Set(et).size).toBe(et.length);
    et.forEach((x) => expect(x).toMatch(/\d+ nokta · \d+–\d+ d\/dk/));
    // İki yüzey de AYNI üreticiyi çağırıyor; kendi kopyasını kurmuyor.
    expect(WIZ_SRC).toContain('veFeadDutyLabel');
    expect(PANEL_SRC).toContain('veFeadDutyLabel');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('bağlanma', () => {
  test('betik index.html\'de ve cp-fead.js\'ten ÖNCE yükleniyor', () => {
    // ÇIPA SCRIPT ETİKETİ, çıplak dosya adı DEĞİL: index.html'de `js/cp-fead.js`
    // bir YORUM içinde de geçiyor (satır ~953) ve çıplak arama o yorumu bulup
    // sırayı yanlış okuyor — kapı doğru sebepten değil, tesadüfen kırmızı olurdu.
    const etiket = (f) => IDX.indexOf('src="' + f + '"');
    expect(etiket('js/fead-duty.js')).toBeGreaterThan(-1);
    expect(etiket('js/fead-duty.js')).toBeLessThan(etiket('js/cp-fead.js'));
    expect(etiket('js/fead-duty.js')).toBeLessThan(etiket('js/cp-fead-wizard.js'));
  });

  test('panel çevrimi PANEL KURULURKEN tohumluyor, eylem yolunda değil', () => {
    // Tohum yalnız `_feadSolverNode`'a bağlansaydı tablo İLK açılışta yine boş
    // görünür, ancak bir düğmeye basıldıktan sonra dolardı.
    const govde = PANEL_SRC.slice(PANEL_SRC.indexOf('function getFeadSolverPropertiesHTML'),
                                  PANEL_SRC.indexOf('function getFeadSolverPropertiesHTML') + 900);
    expect(govde).toContain('veFeadDutySeed(node)');
  });
});
