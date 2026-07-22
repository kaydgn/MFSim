// ═══════════════════════════════════════════════════════════════════════════
// MFSim Easter Egg — Deniz Harp Okulu Onur Penceresi ⚓
// ───────────────────────────────────────────────────────────────────────────
// "Bilenin bildiği" bir sürpriz: editördeyken (bir metin alanına yazmıyorken)
// klavyeden gizli diziyi (varsayılan: "denizharp") yazınca, denizci temalı şık
// bir onur penceresi açılır. Konami-kod mantığı: son N tuş vuruşu bir tampona
// yazılır, hedef diziyle bitince pencere açılır.
//
// Tasarım kalıbı js/shortcuts-help.js ("?" yardımı) ile birebir aynıdır:
//   • Kendi DOM'unu ve kendi <style>'ını LAZY (ilk açılışta) kurar.
//   • Yalnız keydown'ı dinler; hiçbir global fonksiyona bağımlı değildir.
//   • Temaya uyumludur (uygulamanın --bg / --text / --border değişkenleri).
//
// ┌─────────────────────────────────────────────────────────────────────────┐
// │  KİŞİSELLEŞTİRME — yalnızca aşağıdaki MF_DHO_CONFIG'i düzenle.            │
// │  Metnin/yılın birebir doğruluğu senin elinde; gerisi kendiliğinden       │
// │  güncellenir. (Değişiklikten sonra: npm run build)                       │
// └─────────────────────────────────────────────────────────────────────────┘
// ═══════════════════════════════════════════════════════════════════════════

var MF_DHO_CONFIG = {
  // Gizli tetikleyici dizi — yalnız a–z harfleri sayılır (boşluk/rakam yok
  // sayılır), büyük/küçük harf farksız. "deniz harp" yazsan da tutar.
  sequence: 'denizharp',

  // Amblemin ve pencerenin taşıdığı sözler
  okulAdi:     'Deniz Harp Okulu',
  altBaslik:   'Türk Deniz Kuvvetleri',
  kurulusYili: '1773',               // ← doğruluğunu teyit et
  kurulusEtiketi: 'Kuruluş',

  // Onur sözü (opsiyonel) — boş bırakırsan hiç gösterilmez.
  soz:       'Denizciliği Türk’ün büyük millî ülküsü olarak düşünmeli ve onu az zamanda başarmalıyız.',
  sozSahibi: 'Mustafa Kemal Atatürk',

  // Sana özel ithaf satırı (opsiyonel) — örn. mezuniyet yılın, filon, gemin.
  // Boş bırakırsan gösterilmez. Örnek: 'Bir DHO mezununun emeğiyle · 1998'
  ithaf: 'Bir Deniz Harp Okulu mezununun emeğiyle. ⚓',

  // Onur penceresindeki "temaya geç" düğmesi (opsiyonel). Uygulamanın
  // "Donanma Mavisi" temasına tek tıkla geçer. temaButonu:false ile gizlenir.
  temaButonu: true,
  temaId: 'navy',
  temaButonEtiketi: '⚓ Donanma Mavisi temasına geç'
};

var _mfDhoBuilt = false;
var _mfDhoBuf = '';   // son tuş vuruşlarının kayan tamponu

// ── Saf eşleşme motoru (test edilebilir) ─────────────────────────────────────
// Tek bir tuşu tampona işler; hedef diziyle biterse true döner ve tamponu
// sıfırlar. Yalnız tek karakterli a–z tuşları sayılır; gerisi yok sayılır
// (yani "deniz harp" ↔ "denizharp" aynıdır). Saf: yan etkisi yalnız _mfDhoBuf.
function _mfDhoFeed(key) {
  if (!key || key.length !== 1) return false;
  var c = key.toLowerCase();
  if (c < 'a' || c > 'z') return false;            // harf değilse yok say
  var target = (MF_DHO_CONFIG.sequence || '').toLowerCase();
  if (!target) return false;
  _mfDhoBuf = (_mfDhoBuf + c).slice(-target.length);
  if (_mfDhoBuf === target) { _mfDhoBuf = ''; return true; }
  return false;
}

function _mfDhoEsc(s) {
  return ('' + (s == null ? '' : s))
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ── Kendi <style>'ını bir kez enjekte et (scoped: .mf-dho-*) ─────────────────
function _mfDhoInjectCSS() {
  if (document.getElementById('mf-dho-style')) return;
  var st = document.createElement('style');
  st.id = 'mf-dho-style';
  st.textContent = [
    '.mf-dho-overlay{position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;',
      'background:rgba(4,8,16,0.62);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);',
      'opacity:0;transition:opacity .22s ease;padding:24px;}',
    '.mf-dho-overlay.open{opacity:1;}',
    '.mf-dho-overlay[hidden]{display:none;}',
    '.mf-dho-panel{position:relative;width:min(430px,100%);box-sizing:border-box;',
      'background:var(--bg-secondary,#0f1218);color:var(--text-primary,#c8d1dc);',
      'border:1px solid var(--border-light,#222b3a);border-radius:16px;',
      'box-shadow:0 24px 70px rgba(0,0,0,.55),0 2px 0 rgba(255,255,255,.03) inset;',
      'padding:30px 30px 22px;text-align:center;',
      'transform:translateY(14px) scale(.97);opacity:0;transition:transform .28s cubic-bezier(.2,.9,.3,1),opacity .28s ease;}',
    '.mf-dho-overlay.open .mf-dho-panel{transform:none;opacity:1;}',
    // Üst ince altın şerit (deniz feneri hattı)
    '.mf-dho-panel::before{content:"";position:absolute;left:24px;right:24px;top:0;height:2px;border-radius:2px;',
      'background:linear-gradient(90deg,transparent,#c9a24b 25%,#e6cf8f 50%,#c9a24b 75%,transparent);opacity:.8;}',
    // Amblem — lacivert madalyon + altın çember + salınan çapa
    '.mf-dho-badge{width:104px;height:104px;margin:6px auto 18px;border-radius:50%;position:relative;',
      'background:radial-gradient(circle at 50% 34%,#1b477c 0%,#123c66 40%,#0d2a4c 72%,#081a30 100%);',
      'box-shadow:0 0 0 2px #0a1f38,0 0 0 5px #c9a24b,0 0 0 6px rgba(201,162,75,.35),0 12px 26px rgba(0,0,0,.45);',
      'display:flex;align-items:center;justify-content:center;}',
    '.mf-dho-badge svg{width:52px;height:52px;color:#f2e2b3;filter:drop-shadow(0 2px 3px rgba(0,0,0,.5));',
      'transform-origin:50% 12%;animation:mf-dho-sway 4.5s ease-in-out infinite;}',
    '@keyframes mf-dho-sway{0%,100%{transform:rotate(-6deg);}50%{transform:rotate(6deg);}}',
    '@media (prefers-reduced-motion: reduce){.mf-dho-badge svg{animation:none;}}',
    '.mf-dho-title{font-size:1.28rem;font-weight:700;letter-spacing:.5px;color:var(--text-heading,#e2e8f0);margin:0;}',
    '.mf-dho-sub{font-size:.72rem;letter-spacing:2.5px;text-transform:uppercase;color:var(--text-secondary,#7a8599);margin:6px 0 0;}',
    // Yıl rozeti
    '.mf-dho-year{display:inline-flex;align-items:baseline;gap:8px;margin:16px 0 4px;padding:6px 16px;',
      'border:1px solid var(--border-light,#222b3a);border-radius:999px;background:var(--bg-tertiary,#151a22);}',
    '.mf-dho-year b{font-size:1.16rem;font-weight:700;color:#d9b968;letter-spacing:1px;}',
    '.mf-dho-year span{font-size:.64rem;letter-spacing:2px;text-transform:uppercase;color:var(--text-muted,#4a5568);}',
    // Halat ayıracı
    '.mf-dho-rope{display:flex;align-items:center;gap:10px;margin:18px 2px 14px;color:var(--text-muted,#4a5568);}',
    '.mf-dho-rope::before,.mf-dho-rope::after{content:"";flex:1;height:1px;',
      'background:linear-gradient(90deg,transparent,var(--border-hover,#2d3a4f),transparent);}',
    '.mf-dho-rope svg{width:16px;height:16px;color:#c9a24b;opacity:.85;}',
    // Söz
    '.mf-dho-quote{font-size:.92rem;line-height:1.6;font-style:italic;color:var(--text-primary,#c8d1dc);margin:0;}',
    '.mf-dho-quote-mark{color:#c9a24b;font-weight:700;font-style:normal;}',
    '.mf-dho-author{font-size:.72rem;letter-spacing:1px;color:var(--text-secondary,#7a8599);margin:10px 0 0;}',
    '.mf-dho-author::before{content:"— ";}',
    // İthaf + marka altlığı
    '.mf-dho-foot{margin-top:20px;padding-top:14px;border-top:1px solid var(--border-color,#1c2333);',
      'display:flex;flex-direction:column;gap:8px;}',
    '.mf-dho-dedication{font-size:.74rem;color:var(--text-secondary,#7a8599);}',
    '.mf-dho-brand{font-size:.64rem;letter-spacing:1.5px;text-transform:uppercase;color:var(--text-muted,#4a5568);}',
    // Temaya geç düğmesi — altın hayalet düğme
    '.mf-dho-cta{align-self:center;margin:2px 0 6px;padding:9px 18px;border-radius:10px;cursor:pointer;',
      'font-size:.8rem;font-weight:600;letter-spacing:.3px;color:#f2e2b3;',
      'background:linear-gradient(180deg,rgba(217,178,90,.16),rgba(217,178,90,.05));',
      'border:1px solid rgba(217,178,90,.55);transition:background .15s,border-color .15s,transform .1s;}',
    '.mf-dho-cta:hover{background:linear-gradient(180deg,rgba(217,178,90,.30),rgba(217,178,90,.12));border-color:rgba(217,178,90,.9);}',
    '.mf-dho-cta:active{transform:translateY(1px);}',
    // Kapat düğmesi
    '.mf-dho-close{position:absolute;top:12px;right:12px;width:30px;height:30px;border-radius:8px;cursor:pointer;',
      'display:flex;align-items:center;justify-content:center;background:transparent;border:1px solid transparent;',
      'color:var(--text-secondary,#7a8599);transition:background .15s,border-color .15s,color .15s;}',
    '.mf-dho-close:hover{background:var(--bg-tertiary,#151a22);border-color:var(--border-light,#222b3a);color:var(--text-primary,#c8d1dc);}'
  ].join('\n');
  document.head.appendChild(st);
}

// Çapa ikonu (nautical anchor)
function _mfDhoAnchorSVG() {
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<circle cx="12" cy="4.2" r="1.9"/>' +
    '<line x1="12" y1="6.1" x2="12" y2="21"/>' +
    '<line x1="8.4" y1="9.4" x2="15.6" y2="9.4"/>' +
    '<path d="M4 13.2c0 4.4 3.6 7.8 8 7.8s8-3.4 8-7.8"/>' +
    '<polyline points="4 13.2 6.4 13.2 5 15.4"/>' +
    '<polyline points="20 13.2 17.6 13.2 19 15.4"/>' +
  '</svg>';
}

function _mfDhoBuild() {
  if (_mfDhoBuilt) return;
  _mfDhoInjectCSS();

  var c = MF_DHO_CONFIG;
  var body = '';
  body += '<div class="mf-dho-badge">' + _mfDhoAnchorSVG() + '</div>';
  body += '<h3 class="mf-dho-title">' + _mfDhoEsc(c.okulAdi) + '</h3>';
  if (c.altBaslik) body += '<p class="mf-dho-sub">' + _mfDhoEsc(c.altBaslik) + '</p>';
  if (c.kurulusYili) {
    body += '<div class="mf-dho-year"><b>' + _mfDhoEsc(c.kurulusYili) + '</b>';
    if (c.kurulusEtiketi) body += '<span>' + _mfDhoEsc(c.kurulusEtiketi) + '</span>';
    body += '</div>';
  }
  if (c.soz) {
    body += '<div class="mf-dho-rope"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l2.2 6.8H21l-5.5 4 2.1 6.9L12 15.6 6.4 19.7l2.1-6.9L3 8.8h6.8z"/></svg></div>';
    body += '<p class="mf-dho-quote"><span class="mf-dho-quote-mark">“</span>' + _mfDhoEsc(c.soz) + '<span class="mf-dho-quote-mark">”</span></p>';
    if (c.sozSahibi) body += '<p class="mf-dho-author">' + _mfDhoEsc(c.sozSahibi) + '</p>';
  }
  body += '<div class="mf-dho-foot">';
  if (c.temaButonu && c.temaId) {
    body += '<button class="mf-dho-cta" type="button" onclick="veDenizHarpApplyTheme()">' + _mfDhoEsc(c.temaButonEtiketi || 'Temayı uygula') + '</button>';
  }
  if (c.ithaf) body += '<div class="mf-dho-dedication">' + _mfDhoEsc(c.ithaf) + '</div>';
  body += '<div class="mf-dho-brand">MFSim ⚓ Sancak selamda</div>';
  body += '</div>';

  var ov = document.createElement('div');
  ov.className = 'mf-dho-overlay';
  ov.id = 'mf-dho';
  ov.setAttribute('hidden', '');
  ov.innerHTML =
    '<div class="mf-dho-panel" role="dialog" aria-modal="true" aria-label="' + _mfDhoEsc(c.okulAdi) + '">' +
      '<button class="mf-dho-close" type="button" title="Kapat (Esc)" aria-label="Kapat" onclick="veDenizHarpClose()">' +
        '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
      '</button>' + body +
    '</div>';
  document.body.appendChild(ov);
  ov.addEventListener('mousedown', function(e) { if (e.target === ov) veDenizHarpClose(); });
  _mfDhoBuilt = true;
}

function veDenizHarpOpen() {
  if (typeof veCloseFileMenu === 'function') { try { veCloseFileMenu(); } catch (e) {} }
  _mfDhoBuild();
  var ov = document.getElementById('mf-dho');
  if (!ov) return;
  ov.removeAttribute('hidden');
  void ov.offsetWidth;      // reflow → geçiş tetiklensin
  ov.classList.add('open');
}

function veDenizHarpClose() {
  var ov = document.getElementById('mf-dho');
  if (!ov || !ov.classList.contains('open')) return;
  ov.classList.remove('open');
  setTimeout(function() { if (ov && !ov.classList.contains('open')) ov.setAttribute('hidden', ''); }, 240);
}

function veDenizHarpToggle() {
  var ov = document.getElementById('mf-dho');
  if (ov && ov.classList.contains('open')) veDenizHarpClose();
  else veDenizHarpOpen();
}

// Onur penceresindeki düğme → uygulamanın "Donanma Mavisi" temasına geç.
function veDenizHarpApplyTheme() {
  var id = MF_DHO_CONFIG.temaId || 'navy';
  if (typeof changeTheme === 'function') changeTheme(id);
  if (typeof showToast === 'function') showToast('Donanma Mavisi teması uygulandı ⚓', 'success');
  veDenizHarpClose();
}

// ── Dinleyici: gizli diziyi yakala; Esc ile kapat ────────────────────────────
// Yalnız bir metin alanına yazmıyorken sayılır (arama/başka easter egg ile
// çakışmasın). preventDefault yalnız eşleşme anında (nötr; girdi alanı yok).
if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      var ovOpen = document.getElementById('mf-dho');
      if (ovOpen && ovOpen.classList.contains('open')) { e.preventDefault(); veDenizHarpClose(); }
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
    if (_mfDhoFeed(e.key)) { e.preventDefault(); veDenizHarpOpen(); }
  });
}

// Test (Node/Jest) için dışa aç — tarayıcıda üst-seviye global'ler zaten erişilebilir.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    MF_DHO_CONFIG: MF_DHO_CONFIG,
    _mfDhoFeed: _mfDhoFeed,
    _mfDhoResetBuffer: function() { _mfDhoBuf = ''; },
    veDenizHarpOpen: veDenizHarpOpen,
    veDenizHarpClose: veDenizHarpClose,
    veDenizHarpToggle: veDenizHarpToggle,
    veDenizHarpApplyTheme: veDenizHarpApplyTheme
  };
}
