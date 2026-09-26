/**
 * mufettis-sigma.spec.js — SÜTUNA GİREN HER PENCERE SÜTUNA SIĞIYOR MU?
 * ─────────────────────────────────────────────────────────────────────
 *
 * ÖLÇÜLEN KUSUR (2026-09-23, kullanıcının ekran görüntüsü): motor penceresi
 * 380 px'lik müfettiş sütununda okunamıyordu — iki sütunlu düzen sıkışmış,
 * grafik kesik, düğmeler dağınık, yatay kaydırma çubuğu. Tur C'nin kapısı
 * yalnız BOŞ motor penceresini ölçmüştü.
 *
 * Her tipin penceresi GERÇEK veriyle açılıp ölçülünce 54 tipten 14'ü sütunda
 * taşıyor ya da kesiliyordu. Bu halka her modülün örneğini yükler, paletteki
 * HER tipten bir düğüm kurar, penceresini açar ve iki şeyi ölçer:
 *   · sütuna giren pencerenin yatay taşması 0 ve dışarı kesilen öğesi yok
 *   · VE_SUTUNA_SIGMAYAN listesindeki tip MODAL açılıyor
 * Başarısızlıkta suçluları ADIYLA söyler.
 *
 * Node'da koşamaz: jsdom yerleşim hesaplamaz, `scrollWidth` hep 0.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const BUILD = path.join(__dirname, '../..', 'MFSim_Code.html');
test.beforeAll(() => {
  if (!fs.existsSync(BUILD)) throw new Error('MFSim_Code.html yok. Önce: npm run build');
});
test.setTimeout(240000);

const MODULLER = {
  'arac-performans': {
    ornek: "let ex = nodes.find((x) => x.type === 'ap-example'); if (!ex) ex = createNode('ap-example', 300, 200);"
         + " ex.data = ex.data || {}; ex.data.exampleKey = 'isb340_tc411'; veApLoadExample(ex.id);",
    tip: (t) => !/^(mnt-|fead-)/.test(t),
  },
  'mount-analysis': {
    ornek: "let ex = nodes.find((x) => x.type === 'mnt-example'); if (!ex) ex = createNode('mnt-example', 300, 200);"
         + " ex.data = ex.data || {}; ex.data.exampleKey = 'tulga'; veMntLoadExample(ex.id);",
    tip: (t) => /^mnt-/.test(t),
  },
  'fead-analysis': {
    ornek: "if (typeof veFeadWizClose === 'function') veFeadWizClose(false); veFeadLoadExample('AG00976_GATES_2025');",
    tip: (t) => /^fead-/.test(t),
  },
};

// Bir pencereyi aç ve ölç — tarama da, kökteki modül kartı da BU işlevden
// geçer (ikinci bir ölçüm kopyası, iki kapının ayrı şeyleri ölçmesi demekti).
const pencereOlc = async (tip) => {
  const n = nodes.find((x) => x.type === tip);
  clearSelection(); addToSelection(n); veTogglePropertiesPanel(true);
  await new Promise((r) => setTimeout(r, 650));
  const ov = document.getElementById('ve-properties-overlay');
  const pn = document.querySelector('.ve-properties'), ic = document.querySelector('.ve-properties-content');
  const pr = pn.getBoundingClientRect();
  let kesik = 0, enSag = 0;
  ic.querySelectorAll('*').forEach((el) => { const q = el.getBoundingClientRect();
    if (q.width < 2 || q.height < 2) return;
    if (q.right > pr.right + 1) { kesik++; enSag = Math.max(enSag, Math.round(q.right - pr.right)); } });
  // OKUNURLUK — taşma sıfır diye okunur değil. FEAD pencereleri sütunda
  // HİÇ TAŞMIYORDU ama EZİLİYORDU: özet sütunu sabit 296 px'ini alıyor,
  // düzenlenen sütuna 42 px kalıyordu (tek sütuna geçiş EKRAN sorgusuydu,
  // panelin değil). Sekmeler alt alta kayıyor, girdiler parmak ucu kadar
  // kalıyor, etiketler SOLDAN kırpılıyordu — `scrollWidth` başlangıç
  // yönüne taşmayı hiç saymaz. Bu yüzden her sekme gezilir ve ölçü
  // ÇİZİLMİŞ kutudan alınır.
  const sorun = [];
  if (ov.getBoundingClientRect().width < innerWidth) {
    const icW = ic.clientWidth - parseFloat(getComputedStyle(ic).paddingLeft) - parseFloat(getComputedStyle(ic).paddingRight);
    const sekmeler = [...ic.querySelectorAll('.ve-fp-tab')].map((t) => t.getAttribute('data-k'));
    for (const k of (sekmeler.length ? sekmeler : [null])) {
      if (k) { veFeadPanelTab(n.id, k); await new Promise((r) => setTimeout(r, 60)); }
      const ana = ic.querySelector('.ve-fp-main');
      if (ana && ana.offsetWidth < icW * 0.9) sorun.push(`${k}: düzenlenen sütun ${ana.offsetWidth}/${Math.round(icW)} px`);
      ic.querySelectorAll('input:not([type=checkbox]):not([type=radio]):not([type=hidden]), select, textarea').forEach((e) => {
        if (e.offsetWidth && e.offsetWidth < 56) sorun.push(`${k}: ${e.tagName.toLowerCase()} ${e.offsetWidth} px`); });
      ic.querySelectorAll('.ve-fp-l').forEach((l) => {
        if (!l.offsetWidth) return;
        const q = l.getBoundingClientRect(), rg = document.createRange(); rg.selectNodeContents(l); const t = rg.getBoundingClientRect();
        if (q.left - t.left > 0.5 || t.right - q.right > 0.5) sorun.push(`${k}: etiket kırpık "${l.textContent.trim().slice(0, 24)}"`); });
      ic.querySelectorAll('.ve-fp-sect').forEach((h) => {
        if (h.offsetWidth && h.offsetWidth < icW * 0.9) sorun.push(`${k}: başlık büzük ${h.offsetWidth} px`); });
      // İÇERİDE YATAY KAYDIRMA YOK (2026-09-23). Taşma ve kesik ölçümü
      // yalnız AÇILIŞ sekmesine bakıyordu ve kendi kabında kayan bir tablo
      // pencereyi hiç taşırmıyor: çalışma çevrimi "Çevrim" sekmesinde
      // 1162/359 px kayıyordu, tarama yeşildi. Sığmayan tablo artık açılır
      // pencerede (js/tablo-pencere.js); sütunda kayan kap kalmamalı.
      ic.querySelectorAll('*').forEach((el) => {
        if (!el.offsetWidth || el === ic) return;
        if (/(auto|scroll)/.test(getComputedStyle(el).overflowX) && el.scrollWidth > el.clientWidth + 1)
          sorun.push(`${k}: yatay kaydırma ${el.scrollWidth}/${el.clientWidth} px`); });
    }
  }
  // DÜĞME YAZISI KIRILMAZ (2026-09-26) — sütunda da modalda da. Motor
  // penceresinde "+ Satır Ekle", "Tümünü Sil", "Veriyi Temizle" 89–104 px'e
  // sıkışıp iki satıra iniyordu (düğme satırı kaydırmasız bir flex'ti).
  // Metnin satır sayısı çizilmiş kutulardan sayılır; başlık + açıklama taşıyan
  // kart düğmeleri (blok çocuklu) bilerek çok satırlı, onlar hariç.
  ic.querySelectorAll('button').forEach((b) => {
    if (!b.offsetWidth || [...b.children].some((c) => /^(block|flex|grid)$/.test(getComputedStyle(c).display))) return;
    const rs = []; const tw = document.createTreeWalker(b, NodeFilter.SHOW_TEXT); let t;
    while ((t = tw.nextNode())) {
      if (!t.nodeValue.trim()) continue;
      const rg = document.createRange(); rg.selectNodeContents(t);
      [...rg.getClientRects()].forEach((x) => { if (x.width > 1) rs.push([x.top, x.bottom]); });
    }
    rs.sort((p, q) => p[0] - q[0]);
    let satir = rs.length ? 1 : 0, alt = rs.length ? rs[0][1] : 0;
    for (let i = 1; i < rs.length; i++) { if (rs[i][0] >= alt - 2) { satir++; alt = rs[i][1]; } else alt = Math.max(alt, rs[i][1]); }
    if (satir > 1) sorun.push(`düğme yazısı ${satir} satır "${b.innerText.replace(/\s+/g, ' ').trim().slice(0, 24)}"`);
  });
  // DENETİMLER TEK DİLDE (2026-09-26, kullanıcı kararı 11·B): açılır liste
  // programın okuyla çizilir (Windows'un kendi oku ile yan yana iki görünüş
  // vardı), sayı alanı tarayıcının yukarı/aşağı oklarını açmaz (fare üstüne
  // gelince sağa yaslı rakamların yanına biniyordu).
  ic.querySelectorAll('select:not([multiple]):not([size])').forEach((s) => {
    if (s.offsetWidth && getComputedStyle(s).appearance !== 'none') sorun.push(`yerel liste "${(s.options[s.selectedIndex] || {}).text || ''}"`.slice(0, 40));
  });
  ic.querySelectorAll('input[type=number]').forEach((s) => {
    if (s.offsetWidth && getComputedStyle(s).appearance !== 'textfield') sorun.push('sayı alanı oklu');
  });
  // VERİ IZGARASI TABLO GİBİ (2026-09-26, kullanıcı kararı 13·B): satır başına
  // iki ya da daha çok düzenlenebilir alan taşıyan tabloda hücrenin kutusu
  // DİNLENMEDE yok — yalnız fare üstünde ve yazarken. Önce beş ızgarada 189
  // girdinin 189'u çerçeveli ve zeminliydi. Form tabloları kapsam dışı:
  // orada kutu alanın kendisini gösterir. Formun TEK satırında yan yana iki
  // alan olabilir (çözücünün "ATol / RTol"u) — ızgara sayılmak için çok
  // alanlı satır en az iki tane ve alanlı satırların en az yarısı olmalı.
  const bos = (c) => /^(transparent|rgba\(\d+, \d+, \d+, 0\))$/.test(c);
  const zemin = (el) => { for (let e = el; e; e = e.parentElement) { const b = getComputedStyle(e).backgroundColor; if (!bos(b)) return b; } return ''; };
  ic.querySelectorAll('table').forEach((t) => {
    if (!t.offsetWidth) return;
    const DUZ = 'input[type=number]:not([readonly]), input[type=text]:not([readonly])';
    const cok = [...t.rows].filter((tr) => tr.querySelectorAll(DUZ).length >= 2).length;
    const alanli = [...t.rows].filter((tr) => tr.querySelector(DUZ)).length;
    if (cok < 2 || cok * 2 < alanli) return;
    let kutu = 0;
    t.querySelectorAll('td input:not([type=hidden]):not([type=checkbox]):not([type=radio])').forEach((g) => {
      if (!g.offsetWidth || g === document.activeElement || g.matches(':hover')) return;
      const c = getComputedStyle(g), hz = zemin(g.parentElement);
      const kenar = parseFloat(c.borderTopWidth) > 0 && !bos(c.borderTopColor) && c.borderTopColor !== hz;
      if (kenar || (!bos(c.backgroundColor) && c.backgroundColor !== hz)) kutu++;
    });
    if (kutu) sorun.push(`ızgarada kutulu hücre ${kutu}`);
  });
  const r = { tip, sutun: ov.getBoundingClientRect().width < innerWidth, tasma: ic.scrollWidth - ic.clientWidth, kesik, enSag,
    listede: VE_SUTUNA_SIGMAYAN.indexOf(tip) >= 0, sorun: [...new Set(sorun)].slice(0, 4) };
  veTogglePropertiesPanel(false); await new Promise((res) => setTimeout(res, 260));
  return r;
};

for (const [modul, M] of Object.entries(MODULLER)) {
  test(`${modul}: sütuna giren her pencere SIĞIYOR, sığmayan MODAL`, async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1032 });
    page.on('dialog', (d) => d.accept());
    await page.goto('file://' + BUILD);
    await page.fill('#mfsim-login-password', 'mfsim2024');
    await page.press('#mfsim-login-password', 'Enter');
    await page.waitForSelector('#mfsim-loading-screen', { state: 'hidden', timeout: 90000 });
    await page.click(`.ve-module-card[data-module="${modul}"]`);
    await page.waitForSelector('#mfsim-module-loading', { state: 'hidden', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(800);
    await page.evaluate(M.ornek);
    await page.waitForTimeout(3500);

    const tipler = await page.evaluate(`(() => { const on = ${M.tip.toString()};
      Object.keys(componentDefs).filter((t) => on(t) && !componentDefs[t].isSubsystem && !/wizard$/.test(t))
        .forEach((t, i) => { if (!nodes.some((n) => n.type === t)) { try { createNode(t, 200 + (i % 8) * 90, 700 + Math.floor(i / 8) * 90); } catch (e) {} } });
      return [...new Set(nodes.map((n) => n.type))]; })()`);
    expect(tipler.length).toBeGreaterThan(8);          // tarama gerçekten bir şey açtı
    // SİHİRBAZ TİPLERİ KURULMAZ (kurulunca kendi modalını açıyor), ama FEAD'in
    // sihirbaz düğümü açılış yüzeyinde ZATEN var ve ölçülüyor. Dönüş Yönü
    // (`fead-spin`) bir dönem taramanın DIŞINDAYDI; Krank Kasnağı kabuğuna
    // geçince içeri alındı. İkisinin de gerçekten ölçüldüğü burada tutulur —
    // kurulamayan bir tip sessizce taramadan düşerdi.
    if (modul === 'fead-analysis') expect(tipler).toEqual(expect.arrayContaining(['fead-spin', 'fead-wizard']));

    const olcum = [];
    for (const tip of tipler) {
      olcum.push(await page.evaluate(pencereOlc, tip));
    }
    // MODÜL KARTI KÖK TUVALDE — içeriden yapılan tarama ona hiç ulaşmıyor
    // (`isSubsystem` tipleri kurulmuyor). FEAD'inki Krank Kasnağı kabuğunda ve
    // modelini ALT TOPOLOJİDEN kuruyor; köke dönüp aynı işlevle ölçülür.
    if (modul === 'fead-analysis') {
      await page.evaluate(() => veFeadCloseEditor());
      await page.waitForTimeout(600);
      const kart = await page.evaluate(pencereOlc, 'fead-analysis');
      expect(kart.sutun).toBe(true);
      olcum.push(kart);
    }
    const tasan = olcum.filter((r) => r.sutun && (r.tasma > 0 || r.kesik > 0))
      .map((r) => `${r.tip}: taşma ${r.tasma} px, ${r.kesik} kesik öğe (en ${r.enSag} px)`);
    const listedeAmaSutunda = olcum.filter((r) => r.listede && r.sutun).map((r) => r.tip);
    const okunmaz = olcum.filter((r) => r.sorun && r.sorun.length).map((r) => `${r.tip} → ${r.sorun.join(' · ')}`);
    expect(tasan).toEqual([]);
    expect(okunmaz).toEqual([]);
    expect(listedeAmaSutunda).toEqual([]);
    // BOŞLUK BEKÇİSİ: tarama sütunu GERÇEKTEN kullandı (Takoz'da bilerek yalnız 4
    // pencere sütunda — gerisi kendi tasarımına kadar modal).
    expect(olcum.filter((r) => r.sutun).length).toBeGreaterThanOrEqual(3);
  });
}
