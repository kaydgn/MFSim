/**
 * fead-rozet.spec.js — FEAD: KANVASTAKİ İKİ ROZET (gerçek tarayıcı)
 *
 * Bu dosya `fead-canvas-drag.spec.js`'in yerini aldı ve devraldığı şey ADI
 * değil ÖLÇTÜĞÜ ŞEY: kanvasta duran, tıklanabilir iki rozet.
 *
 * ── NEDEN DEVİR OLDU ───────────────────────────────────────────────────────
 * Eski dosya "kanvas = kayış düzlemi" zincirini ölçüyordu: fare sürüklemesi →
 * veFeadSyncDrag → mm koordinatı → kart. O zincirin İKİ HALKASI 2026-09-09'da
 * kaldırıldı — kasnakların kanvasta kutusu yok (`noCanvasBox`), kanvas↔mm
 * köprüsü ve `fead-coordlink` bileşeni de onlarla birlikte gitti. Dosyanın
 * on iki testinden sekizi o kaldırılmış özellikleri ölçüyordu ve dosya
 * AÇILIŞTA duruyordu: `bootApp` `window.veFeadSyncDrag` bekliyor, o ad hiç
 * gelmiyor, 60 sn sonra her test düşüyordu. Gece E2E setinde olduğu için
 * CI'da görünmedi.
 *
 * ── NEDEN SİLİNMEDİ ────────────────────────────────────────────────────────
 * Kalan iki test canlı yüzeyleri ölçüyor ve BAŞKA HİÇBİR E2E onlara bakmıyor:
 *   • kayış boyu kipi anahtarı (SABİT / SERBEST) ve KİLİTLİ hâli — 2026-09-26'dan
 *     beri Kayış Tablosu'nun (Pafta) başlığında; kayışın kutusu kalktı
 *   • dönüş yönü rozeti — tıklanınca kayış sırasını gerçekten çeviriyor mu
 * İkisi de yalnız gerçek tarayıcıda ölçülebilir: tıklama kanvas düğümünün
 * `mousedown`ıyla yarışıyor ve pafta bir kare sonra yeniden kuruluyor. Node
 * tarafı `cp-fead.test.js` ve `fead-spin.test.js`'te.
 *
 * ── NE DEĞİŞTİ (yön çevirme testinde) ──────────────────────────────────────
 * Eski test yönün taşıyıcısı olarak KABLOLARI ve gidiş oklarını ölçüyordu.
 * İkisi de yok: sıra artık `node.data.beltIndex` alanında. Yeni kapı onu
 * ölçüyor — yani ölçüt gevşemedi, bugünkü taşıyıcıya taşındı.
 */
const { test, expect } = require('@playwright/test');

async function bootApp(page) {
  await page.goto('/index.html');
  await page.evaluate(() => {
    if (window.MFSimLoader && typeof window.MFSimLoader.start === 'function') window.MFSimLoader.start();
  });
  // BEKLENEN ADLAR YAŞAYAN ADLAR OLMALI. Eski dosya `veFeadSyncDrag` bekliyordu
  // ve o ad kaldırılınca bütün testler açılışta öldü — bekleme listesi bir
  // kapı değil bir TUZAK hâline gelmişti.
  await page.waitForFunction(() =>
    typeof window.createNode === 'function' &&
    typeof window.veFeadOpenEditor === 'function' &&
    typeof window.veFeadLoadExample === 'function' &&
    typeof window.veFeadCurrentSpin === 'function' &&
    Array.isArray(window.nodes),
    null, { timeout: 60000 });
  await page.evaluate(() => {
    if (typeof veSelectModuleFromOverlay === 'function') veSelectModuleFromOverlay('arac-performans');
  });
  await page.waitForFunction(() => {
    const s = document.getElementById('mfsim-loading-screen');
    return !s || s.style.display === 'none';
  }, null, { timeout: 60000 });
}

// FEAD alt topolojisini aç, BMC örneğini kur, sihirbazı KAPAT.
async function openFeadWithExample(page) {
  await page.evaluate(() => {
    const n = createNode('fead-analysis', 400, 300);
    veFeadOpenEditor(n.id);
  });
  await page.waitForFunction(() => Array.isArray(window.nodes), null, { timeout: 20000 });
  await page.evaluate(() => veFeadLoadExample('BMC_FEAD_2026'));
  await page.waitForFunction(() =>
    window.nodes.some((n) => n.type === 'fead-alternator') &&
    window.nodes.some((n) => n.type === 'fead-layout'),
    null, { timeout: 20000 });
  // BOŞ TOPOLOJİ SİHİRBAZLA KARŞILIYOR (2026-09-09) ve pencere kanvasın
  // üstünde duruyor: açık bırakılırsa gerçek fare olayı rozete değil modala
  // gider. Kullanıcı da aynı şeyi yapar — kapatıp kanvasa döner.
  await page.evaluate(() => { if (typeof veFeadWizClose === 'function') veFeadWizClose(true); });
  await page.waitForFunction(() => {
    const o = document.getElementById('ve-feadwiz-overlay');
    return !o || o.style.display === 'none';
  }, null, { timeout: 10000 });
  await page.evaluate(() => { if (typeof veFitViewToContent === 'function') veFitViewToContent(); });
  await page.waitForTimeout(300);
}

// Düğümü kanvasın açık ortasına taşı: rozet sidebar'ın ya da bir kartın
// altında kalırsa GERÇEK fare olayı oraya gitmez ve test tıklamayı hiç sınamaz.
async function ortayaTasi(page, id) {
  await page.evaluate((nid) => {
    const n = window.nodes.find((x) => x.id === nid);
    const c = document.getElementById('ve-canvas').getBoundingClientRect();
    const k = (typeof canvasZoom !== 'undefined' ? canvasZoom : 1);
    const off = (typeof canvasOffset !== 'undefined') ? canvasOffset : { x: 0, y: 0 };
    n.x = (c.width * 0.55 - off.x) / k;
    n.y = (c.height * 0.5 - off.y) / k;
    const el = document.getElementById(nid);
    el.style.left = n.x + 'px'; el.style.top = n.y + 'px';
    if (typeof updateAllConnections === 'function') updateAllConnections();
  }, id);
  await page.waitForTimeout(200);
}

test.describe('FEAD kanvas rozetleri', () => {
  // ── KAYIŞ BOYU KİPİ ANAHTARI — PAFTA'NIN BAŞLIĞINDA ─────────────────────
  //
  // Gergi avara merkezinden çözüldüğünde kayış boyu yapısal olarak bir ÇIKTI
  // ve kip KİLİTLİ. Anahtar o hâlde TIKLAMAYI REDDETMEK zorunda: tıklanabilir
  // kalsaydı kullanıcı "SABİT"e çevirir, anahtar öyle görünür, çözücü yine
  // serbest koşardı — bu modülün sessiz hata sınıfı. Eskiden kayış kutusunun
  // rozetiydi; kutu 2026-09-26'da kalktı.
  test('kayış boyu kipi anahtarı KİLİTLİ — gerçek tık kipi değiştirmiyor', async ({ page }) => {
    await bootApp(page);
    await openFeadWithExample(page);

    const beltId = await page.evaluate(() =>
      window.nodes.find((n) => n.type === 'fead-belt').id);
    // Kayışın kanvasta KUTUSU YOK — anahtarın tek yeri paftanın başlığı.
    expect(await page.evaluate((id) => !!document.getElementById(id), beltId)).toBe(false);

    const anahtar = page.locator('.ve-fead-pafta .ve-fead-pf-kip').first();
    await expect(anahtar).toHaveText('SERBEST');
    await expect(anahtar).toHaveAttribute('aria-disabled', 'true');
    // Boy TÜRETİLMİŞ ve gergi var → kip kilitli.
    expect(await page.evaluate(() => ({
      turetildi: veFeadBuildFromCanvas().beltLengthDerived,
      kilit: veFeadBeltModeLocked(window.nodes),
    }))).toEqual({ turetildi: true, kilit: true });
    // Rengi CSS'ten: SERBEST amber (kayışın rengi), sabit vurgu rengi değil.
    expect(await anahtar.evaluate((el) => getComputedStyle(el).backgroundColor))
      .toBe(await page.evaluate(() => {
        const d = document.createElement('div');
        d.style.color = 'var(--accent-warning)'; document.body.appendChild(d);
        const c = getComputedStyle(d).color; d.remove(); return c;
      }));

    // GERÇEK TIK — anahtar reddetmeli: ne metin ne de düğüm verisi değişir.
    // `force`: Playwright `aria-disabled`ı "etkin değil" sayıp beklerdi (yani
    // işaret doğru okunuyor); zorla tık gerçek fare olayını yine gönderir ve
    // reddi yapan şey işleyicinin kendi kilidi.
    await anahtar.click({ force: true });
    await page.waitForTimeout(250);
    await expect(page.locator('.ve-fead-pafta .ve-fead-pf-kip').first()).toHaveText('SERBEST');
    expect(await page.evaluate((id) => {
      const n = window.nodes.find((x) => x.id === id);
      return { kip: n.data.lengthMode, turetildi: veFeadBuildFromCanvas().beltLengthDerived };
    }, beltId)).toEqual({ kip: undefined, turetildi: true });
  });

  // ── DÖNÜŞ YÖNÜ ROZETİ ────────────────────────────────────────────────────
  //
  // Rozet bir BAYRAK YAZMIYOR, kayış SIRASINI çeviriyor (`beltIndex`). Bu
  // ayrımın bedeli ölçülmüş: yön bir alana yazılsaydı sıra ile bayrak
  // ayrışabilir ve kart bayrağı, çekirdek sırayı okurdu.
  //
  // ÖLÇÜLEN ÜÇ ŞEY AYRI AYRI GEREKLİ:
  //   1. rozetin metni döndü            → kullanıcı ne gördüğünü biliyor
  //   2. `beltIndex` sırası ters yürüdü → yönün gerçek taşıyıcısı
  //   3. `loop` ve L_eff KIL PAYI OYNAMADI → geometri yönden bağımsız
  // Üçüncüsü olmadan ilk ikisi "bir şeyler değişti" demekten ibaret kalırdı.
  test('dönüş yönü rozeti kayış SIRASINI çeviriyor, geometriyi çevirmiyor',
    async ({ page }) => {
      await bootApp(page);
      await openFeadWithExample(page);

      const spinId = await page.evaluate(() => createNode('fead-spin', 0, 0).id);
      await ortayaTasi(page, spinId);

      const rz = page.locator('#' + spinId + ' .ve-fead-badge');
      // BEKLENEN YÖN CANLI MODELDEN, METİN ETİKET ÜRETİCİSİNDEN. Sabit
      // yazılsaydı kapı, ölçtüğü ilişkiyi değil bir yön tercihini savunurdu.
      const et = await page.evaluate(() => {
        const s = veFeadCurrentSpin();
        return { spin: s, bas: veFeadSpinLabel(s).kisa, tersi: veFeadSpinLabel(-s).kisa,
                 basSense: veFeadSpinLabel(s).sense, tersSense: veFeadSpinLabel(-s).sense };
      });
      expect(et.spin).toBe(-1);                       // krank saat yönünde
      expect(et.bas).not.toBe(et.tersi);
      expect(et.basSense).toBe(-et.tersSense);
      await expect(rz).toHaveText(et.bas);

      const oku = () => page.evaluate(() => ({
        // YÖNÜN GERÇEK TAŞIYICISI: kasnakların kayış sırası.
        sira: window.nodes
          .filter((n) => ((window.componentDefs || {})[n.type] || {}).isFeadPulley)
          .slice()
          .sort((a, b) => (a.data.beltIndex || 0) - (b.data.beltIndex || 0))
          .map((n) => n.id).join(','),
        // Kartın KENDİ kinematik künyesi: `spin` kayışın gerçek dönüşü
        // (rozetle aynı işaret), `sense` yürüyüşün el yönü (onun tersi),
        // `loop` kayış çevresi.
        anim: (function () {
          const svg = document.querySelector('svg[data-fead-node]');
          const a = svg && svg.getAttribute('data-fead-anim');
          if (!a) return null;
          try { const j = JSON.parse(a); return { spin: j.spin, sense: j.sense, loop: j.loop }; }
          catch (e) { return null; }
        })(),
        L: (function () {
          // Künye DURUM ROZETİNİN KENDİSİNDEN: `title` her hâlde tamamını
          // taşıyor (cp-fead.js — "İKİ OKUMA DA KAYBOLMUYOR"). Eski yol svg'nin
          // dedesinin SON div'ini okuyordu; "BANT YOK — denetim üstte yüzer"
          // düzenlemesinden sonra o div yüzen DENETİM ÇUBUĞU oldu ve L
          // sessizce `null` döndü (main'de de kırmızıydı, 2026-09-23 ölçüldü).
          const r = document.querySelector('.ve-fead-kan-durum');
          const m = r && (r.getAttribute('title') || '').match(/L\s+([\d.]+)\s*mm/);
          return m ? Number(m[1]) : null;
        })(),
      }));

      const once = await oku();
      expect(once.sira.split(',').length).toBeGreaterThanOrEqual(5);
      expect(once.L).toBeGreaterThan(1000);
      expect(once.anim).not.toBeNull();

      await rz.click();
      await expect(rz).toHaveText(et.tersi);
      await page.waitForTimeout(300);
      const sonra = await oku();

      // 1) SIRA gerçekten çevrildi — ve "krank sabit, kalanı ters" kuralına
      //    göre: ilk kasnak yerinde, kalanı ayna.
      expect(sonra.sira).not.toBe(once.sira);
      const a = once.sira.split(','), b = sonra.sira.split(',');
      expect(b[0]).toBe(a[0]);
      expect(b.slice(1)).toEqual(a.slice(1).reverse());

      // 2) KART tazelendi ve çevrimin yönü çevrildi.
      expect(once.anim.spin).toBe(et.basSense);
      expect(once.anim.sense).toBe(-et.basSense);
      expect(sonra.anim.spin).toBe(et.tersSense);
      expect(sonra.anim.sense).toBe(-et.tersSense);

      // 3) …ama GEOMETRİ BİREBİR aynı — kayış çevresi de, durum şeridindeki
      //    L_eff de kılı kıpırdamıyor.
      expect(sonra.anim.loop).toBeCloseTo(once.anim.loop, 3);
      expect(sonra.L).toBeCloseTo(once.L, 3);

      // İkinci tık başa döndürür.
      await rz.click();
      await expect(rz).toHaveText(et.bas);
      await page.waitForTimeout(300);
      expect((await oku()).sira).toBe(once.sira);
    });
});
