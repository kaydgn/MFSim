/**
 * yon-olcu.js — YÖNLENDİRME YUVALARI EKRANDA BOŞ MU?
 * ───────────────────────────────────────────────────────────────────────────
 * ARAYÜZ ANLATMAZ'ın dördüncü türü (kullanıcı kararı 2026-10-19) beş yuvada
 * yazılır. Kaynak taraması (tools/metin-dili.js → yön profili) yazılmış
 * cümlenin BİÇİMİNİ ölçer; yazılmamış cümleyi göremez. İki yuvanın boşluğu
 * ekranda ölçülebilir:
 *   · adsiz   düğme ne görünen yazı, ne aria-label, ne title taşıyor: ekran
 *             okuyucu yalnız "düğme" der, fare ipucu boş.
 *   · kapali  kapalı denetim (disabled · aria-disabled="true") sebebini ne
 *             kendi title'ında taşıyor (karar D5: sebep ipucunda) ne de ekranda
 *             yanında yazılı sebebe aria-describedby ile bağlı (görünür sebebi
 *             ipucuna kopyalamak tekrar olurdu).
 * Araştırma turunda (2026-10-18) 1 adsız düğme ve 12 tekil sebepsiz kapalı
 * denetim vardı. Kapsam dışı: görünmeyen öğe ve aria-hidden atanın içi.
 * Ölçüt BURADA tek yerde; yüzeyler yerleşim ve kontrast kapılarıyla aynı tur
 * (tests/e2e/helpers/yuzey-turu.js), kapı tests/e2e/yerlesim.spec.js.
 */

function yonKur() {
  const gorunur = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2 || el.closest('[aria-hidden="true"]')) return false;
    for (let e = el; e && e !== document.documentElement; e = e.parentElement) {
      const s = getComputedStyle(e);
      if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity === 0) return false;
    }
    return true;
  };
  const yazi = (el) => (el.innerText || '').replace(/\s+/g, ' ').trim();
  const nitelik = (el, a) => (el.getAttribute(a) || '').trim();
  // aria-describedby'nin gösterdiği öğelerden biri görünür ve yazı taşıyor mu
  const tarifli = (el) => nitelik(el, 'aria-describedby').split(/\s+/).some((id) => {
    const h = id && document.getElementById(id);
    return !!(h && gorunur(h) && yazi(h));
  });
  // Denetimin okunan adı: liste seçili seçeneğiyle, öteki görünen yazısıyla.
  const ad = (el) => (el.tagName === 'SELECT'
    ? ((el.options[el.selectedIndex] || {}).text || '')
    : yazi(el) || el.value || '') || nitelik(el, 'aria-label');
  const yol = (el, kok) => {
    const p = [];
    for (let e = el; e && e !== kok && p.length < 4; e = e.parentElement) {
      let s = e.tagName.toLowerCase();
      if (e.id) { p.unshift(s + '#' + e.id); break; }
      const c = [...e.classList].filter((x) => !/^(is-|on$|active|sel|hover)/.test(x)).slice(0, 2);
      if (c.length) s += '.' + c.join('.');
      p.unshift(s);
    }
    return p.join(' > ');
  };
  window.__yon = function (sel) {
    const kok = document.querySelector(sel);
    const out = { adsiz: [], kapali: [] };
    if (!kok) return out;
    const gor = new Set();
    const ekle = (liste, x) => { const k = x.ad + '|' + x.yol; if (!gor.has(k)) { gor.add(k); liste.push(x); } };
    kok.querySelectorAll('button, [role="button"], [role="tab"], [role="menuitem"], a[href]').forEach((el) => {
      if (!gorunur(el) || yazi(el) || nitelik(el, 'aria-label') || nitelik(el, 'title')) return;
      ekle(out.adsiz, { ad: '', yol: yol(el, kok) });
    });
    kok.querySelectorAll('button[disabled], input[disabled], select[disabled], textarea[disabled], [aria-disabled="true"]').forEach((el) => {
      if (!gorunur(el) || nitelik(el, 'title') || tarifli(el)) return;
      ekle(out.kapali, { ad: ad(el).slice(0, 40), yol: yol(el, kok) });
    });
    return out;
  };
}

const KAYNAK = '(function(){' + yonKur.toString() + '\nyonKur();})()';

async function yonOlcKur(page) { await page.evaluate(KAYNAK); }

// Okunur satırlar: yer · tür "ad" — yol.
function yonOzet(r, yer) {
  const on = yer ? yer + ' · ' : '';
  return [].concat(
    r.adsiz.map((x) => `${on}adsız düğme — ${x.yol}`),
    r.kapali.map((x) => `${on}sebepsiz kapalı "${x.ad}" — ${x.yol}`));
}

module.exports = { KAYNAK, yonOlcKur, yonOzet };
