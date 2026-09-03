// ═══════════════════════════════════════════════════════════════════════════
// SİNYAL GEZGİNİ — DBC mesaj ağacı
// ═══════════════════════════════════════════════════════════════════════════
//
// Yerleşim MFSim'in Veri Gezgini'yle AYNI sınıfları kullanır (vsig-*), çünkü
// kurallar da aynı (UI_PATTERN_GUIDE, "Ölçüm Kanalı Listesi"):
//   · Tek satır ritmi — grup başlığı da sinyal satırı da 22px.
//   · Girinti tek kuralla (--vsig-indent); JS'te padding hesabı YOK.
//   · Durum satırın kendisinde okunur: onay kutusu, renk kutucuğu, rozet.
//   · Renk TEK KAYNAKTAN — listedeki kutucuk ile grafikteki eğri aynı
//     fonksiyondan (cdbSigColor) gelir.
//   · Ağaç panelin AYNASIDIR: grafiği değiştiren her yol sonunda
//     cdbRefreshTree() çağırır.
//
// ── ÜÇ KÜME ──────────────────────────────────────────────────────────────
// Ağaç mesajları üç kümeye ayırır ve bunu SÖYLER:
//   1. DBC'de tanımlı VE kayıtta geçen  → normal
//   2. DBC'de tanımlı ama kayıtta YOK   → sönük, onay kutusu kapalı
//   3. Kayıtta geçen ama DBC'de YOK     → "Tanımsız kimlikler" bölümü
// Üçüncüsü olmadan kullanıcı "sinyalim neden yok" sorusunu cevaplayamaz:
// yanlış DBC yüklemekle boş kayıt yüklemek aynı görünürdü.

var cdbTree = {
  open: {},          // mesaj anahtarı → açık mı
  query: '',
  filter: 'log'      // 'all' | 'log' | 'on'
};

function cdbEsc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Arama normalleştirmesi UZUNLUK KORUYUCUDUR: vurgulama indeksleri ham metne
// uygulanıyor. toLocaleLowerCase('tr') kullanılamaz — 'İ' iki karakter üretir
// ve vurgu bir karakter kayar (MFSim'de ölçülmüş tuzak).
function cdbNorm(s) {
  return String(s || '').toLowerCase()
    .replace(/[çÇ]/g, 'c').replace(/[ğĞ]/g, 'g').replace(/[ıİıI]/g, 'i')
    .replace(/[öÖ]/g, 'o').replace(/[şŞ]/g, 's').replace(/[üÜ]/g, 'u');
}

function cdbHighlight(text, q) {
  if (!q) return cdbEsc(text);
  var i = cdbNorm(text).indexOf(cdbNorm(q));
  if (i < 0) return cdbEsc(text);
  return cdbEsc(text.slice(0, i)) + '<span class="vsig-hit">' +
         cdbEsc(text.slice(i, i + q.length)) + '</span>' + cdbEsc(text.slice(i + q.length));
}

function cdbMatches(text, q) {
  return !q || cdbNorm(text).indexOf(cdbNorm(q)) >= 0;
}

// ── Ağaç kurulumu ─────────────────────────────────────────────────────────

function cdbRefreshTree() {
  var host = document.getElementById('cdb-tree');
  if (!host) return;
  var db = cdbState.db, st = cdbState.store;

  if (!db) {
    host.innerHTML = '<div class="vsig-empty">Önce bir <b>.dbc</b> dosyası yükleyin.<br>' +
                     'Mesaj ve sinyal tanımları oradan gelir.</div>';
    cdbUpdateTreeCount();
    return;
  }

  var q = cdbTree.query;
  var html = '';
  var shownMsgs = 0, shownSigs = 0;

  for (var i = 0; i < db.messages.length; i++) {
    var msg = db.messages[i];
    var key = cdbMsgKey(msg.id, msg.extended);
    var count = (st && st.counts[key]) || 0;

    if (cdbTree.filter === 'log' && !count) continue;
    if (cdbTree.filter === 'on' && !cdbMsgSelectedCount(msg)) continue;

    // Arama: mesaj adı VEYA sinyal adı eşleşiyorsa grup görünür.
    var sigHits = [];
    for (var j = 0; j < msg.signals.length; j++)
      if (cdbMatches(msg.signals[j].name, q)) sigHits.push(msg.signals[j]);
    var msgHit = cdbMatches(msg.name, q) || cdbMatches(cdbFmtId(msg.id, msg.extended), q);
    if (q && !msgHit && !sigHits.length) continue;
    var list = (q && !msgHit) ? sigHits : msg.signals;

    shownMsgs++; shownSigs += list.length;
    var open = cdbTree.open[key] || (q && sigHits.length > 0);
    var sel = cdbMsgSelectedCount(msg);

    html += '<div class="vsig-group' + (open ? ' open' : '') + '">';
    html += '<div class="vsig-ghead" tabindex="0" data-msg="' + key + '" role="button" aria-expanded="' + (open ? 'true' : 'false') + '">';
    html += '<span class="vsig-arrow">▶</span>';
    html += '<span class="vsig-gname" title="' + cdbEsc(cdbMsgTitle(msg, count)) + '">' +
            cdbHighlight(msg.name, msgHit ? q : '') +
            '<span style="color:var(--text-muted);font-weight:400;font-family:var(--font-mono);">' +
            cdbEsc(cdbFmtId(msg.id, msg.extended)) + '</span>';
    if (msg.multiplexed) html += '<span style="color:var(--accent-warning);font-size:var(--fs-micro);" title="Çoklanmış mesaj">MUX</span>';
    html += '</span>';
    html += '<span class="vsig-badge' + (sel ? ' on' : '') + '">' + sel + '/' + msg.signals.length + '</span>';
    html += '<span class="vsig-badge" title="Kayıttaki kare sayısı"' +
            (count ? '' : ' style="opacity:.45"') + '>' + (count ? cdbThousands(count) : '—') + '</span>';
    html += '</div>';

    html += '<div class="vsig-list">';
    if (!list.length) html += '<div class="vsig-orphan">sinyal tanımı yok</div>';
    for (var k = 0; k < list.length; k++) {
      var sig = list[k];
      var sk = cdbSigKey(msg, sig);
      var on = cdbChartHasSignal(sk);
      var can = count > 0;
      html += '<div class="vsig-row' + (on ? ' on' : '') + '" tabindex="0" data-sig="' + cdbEsc(sk) + '"' +
              (can ? '' : ' style="opacity:.45"') +
              ' title="' + cdbEsc(cdbSigTitle(msg, sig, can)) + '">';
      html += '<span class="vsig-ck' + (on ? ' on' : '') + '" data-act="tog"></span>';
      html += '<span class="vsig-sw' + (on ? '' : ' off') + '"' +
              (on ? ' style="background:' + cdbSigColor(sk) + '"' : '') + '></span>';
      html += '<span class="vsig-name">' + cdbHighlight(sig.name, q) + '</span>';
      html += '<span class="vsig-unit">' + cdbEsc(sig.unit || '') + '</span>';
      html += '<span class="vsig-unit" style="opacity:.55;">' + sig.length + 'b' +
              (sig.littleEndian ? '' : ' M') + '</span>';
      html += '</div>';
    }
    html += '</div></div>';
  }

  // Kayıtta geçen ama DBC'de tanımı olmayan kimlikler
  var orphans = cdbOrphanIds();
  if (orphans.length && !q) {
    html += '<div class="vsig-orphan-head" title="Bu kimlikler kayıtta var ama yüklü DBC bunları tanımlamıyor">' +
            'Tanımsız kimlikler (' + orphans.length + ')</div>';
    for (var o = 0; o < orphans.length && o < 60; o++) {
      html += '<div class="vsig-orphan"><span style="font-family:var(--font-mono);">' +
              cdbEsc(orphans[o].label) + '</span>' +
              '<span style="margin-left:auto;padding-right:8px;">' + cdbThousands(orphans[o].count) + ' kare</span></div>';
    }
    if (orphans.length > 60) html += '<div class="vsig-orphan">… ve ' + (orphans.length - 60) + ' tane daha</div>';
  }

  if (!shownMsgs) {
    html = '<div class="vsig-empty">' + (q ? 'Aramaya uyan mesaj/sinyal yok.' :
      cdbTree.filter === 'log' ? 'Yüklü DBC\'deki hiçbir mesaj kayıtta geçmiyor.<br>Süzgeci <b>Tümü</b> yapıp tanımları görebilirsiniz.' :
      'Gösterilecek mesaj yok.') + '</div>';
  }

  host.innerHTML = html;
  cdbBindTree(host);
  cdbUpdateTreeCount(shownMsgs, shownSigs);
}

function cdbMsgTitle(msg, count) {
  var p = [msg.name + '  ' + cdbFmtId(msg.id, msg.extended) +
           (msg.extended ? '  (29 bit)' : '  (11 bit)')];
  p.push('DLC ' + msg.dlc + ' bayt · gönderen: ' + msg.transmitter);
  if (msg.cycleTime) p.push('Çevrim: ' + msg.cycleTime + ' ms');
  p.push(count ? ('Kayıtta ' + cdbThousands(count) + ' kare') : 'Bu kayıtta hiç geçmiyor');
  if (msg.comment) p.push('', msg.comment);
  return p.join('\n');
}

function cdbSigTitle(msg, sig, can) {
  var p = [msg.name + '.' + sig.name];
  p.push('Bit ' + sig.startBit + ' · ' + sig.length + ' bit · ' +
         (sig.littleEndian ? 'Intel (@1)' : 'Motorola (@0)') + ' · ' +
         (sig.signed ? 'işaretli' : 'işaretsiz'));
  p.push('Fiziksel = ham × ' + sig.factor + ' + ' + sig.offset + (sig.unit ? '  [' + sig.unit + ']' : ''));
  if (sig.min !== null && sig.max !== null) p.push('Aralık: ' + sig.min + ' … ' + sig.max);
  if (sig.muxValue !== null) p.push('Yalnız çoklayıcı = ' + sig.muxValue + ' iken geçerli');
  if (sig.isMuxor) p.push('Bu sinyal mesajın ÇOKLAYICISIdır');
  if (sig.valueType !== 'int') p.push('IEEE ' + sig.valueType);
  if (sig.values) {
    var ks = Object.keys(sig.values).slice(0, 8);
    p.push('Değerler: ' + ks.map(function(k) { return k + '=' + sig.values[k]; }).join(', ') +
           (Object.keys(sig.values).length > 8 ? ' …' : ''));
  }
  if (!can) p.push('', 'Bu mesaj kayıtta geçmiyor — çizilemez.');
  if (sig.comment) p.push('', sig.comment);
  return p.join('\n');
}

function cdbMsgSelectedCount(msg) {
  var n = 0;
  for (var i = 0; i < msg.signals.length; i++)
    if (cdbChartHasSignal(cdbSigKey(msg, msg.signals[i]))) n++;
  return n;
}

// Kayıtta olup DBC'de olmayan kimlikler, kare sayısına göre azalan.
function cdbOrphanIds() {
  var st = cdbState.store, db = cdbState.db;
  if (!st) return [];
  var out = [];
  for (var key in st.counts) {
    if (!st.counts.hasOwnProperty(key)) continue;
    if (db && db.byKey[key]) continue;
    var ext = key.charAt(0) === 'E';
    var id = parseInt(key.slice(1), 16);
    out.push({ key: key, label: cdbFmtId(id, ext) + (ext ? ' (29b)' : ' (11b)'), count: st.counts[key] });
  }
  out.sort(function(a, b) { return b.count - a.count; });
  return out;
}

function cdbThousands(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

// ── Etkileşim ─────────────────────────────────────────────────────────────

function cdbBindTree(host) {
  host.querySelectorAll('.vsig-ghead').forEach(function(el) {
    var toggle = function() {
      var k = el.getAttribute('data-msg');
      cdbTree.open[k] = !cdbTree.open[k];
      cdbRefreshTree();
    };
    el.addEventListener('click', toggle);
    el.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
    });
  });
  host.querySelectorAll('.vsig-row').forEach(function(el) {
    var toggle = function() { cdbToggleSignal(el.getAttribute('data-sig')); };
    el.addEventListener('click', toggle);
    el.addEventListener('keydown', function(e) {
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggle(); }
    });
  });
}

function cdbToggleSignal(sigKey) {
  var found = cdbFindSignal(sigKey);
  if (!found) return;
  var count = cdbState.store ? (cdbState.store.counts[cdbMsgKey(found.msg.id, found.msg.extended)] || 0) : 0;
  if (cdbChartHasSignal(sigKey)) {
    cdbChartRemoveSignal(sigKey);
  } else {
    if (!count) { cdbToast(found.msg.name + ' bu kayıtta hiç geçmiyor — çizilecek veri yok.'); return; }
    cdbChartAddSignal(found.msg, found.sig);
    var ser = cdbSeriesOf(sigKey);
    if (ser && !ser.n) cdbToast(found.sig.name + ': mesaj var ama sinyal hiçbir karede çözülemedi (çoklama ya da kısa DLC).');
  }
  cdbRefreshTree();
}

function cdbFindSignal(sigKey) {
  var db = cdbState.db;
  if (!db) return null;
  var dot = sigKey.indexOf('.');
  var msg = db.byKey[sigKey.slice(0, dot)];
  if (!msg) return null;
  var sig = msg.sigByName[sigKey.slice(dot + 1)];
  return sig ? { msg: msg, sig: sig } : null;
}

function cdbSetTreeQuery(v) {
  cdbTree.query = String(v || '').trim();
  cdbRefreshTree();
}

function cdbSetTreeFilter(f) {
  cdbTree.filter = f;
  var host = document.getElementById('cdb-tree-filter');
  if (host) host.querySelectorAll('button').forEach(function(b) {
    b.setAttribute('aria-pressed', b.getAttribute('data-f') === f ? 'true' : 'false');
  });
  cdbRefreshTree();
}

function cdbUpdateTreeCount(msgs, sigs) {
  var el = document.getElementById('cdb-tree-count');
  if (!el) return;
  if (msgs === undefined) { el.textContent = ''; return; }
  el.textContent = msgs + ' mesaj · ' + sigs + ' sinyal';
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { cdbNorm: cdbNorm, cdbHighlight: cdbHighlight, cdbMatches: cdbMatches, cdbThousands: cdbThousands, cdbEsc: cdbEsc };
}
