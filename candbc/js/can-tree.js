// ═══════════════════════════════════════════════════════════════════════════
// SİNYAL GEZGİNİ — kayıttaki kanalların ağacı
// ═══════════════════════════════════════════════════════════════════════════
//
// Yerleşim MFSim'in Veri Gezgini'yle AYNI sınıfları kullanır (vsig-*), çünkü
// kurallar da aynı (UI_PATTERN_GUIDE, "Ölçüm Kanalı Listesi"):
//   · Tek satır ritmi — grup başlığı da sinyal satırı da 22px.
//   · Girinti tek kuralla (--vsig-indent); JS'te padding hesabı YOK.
//   · Durum satırın kendisinde okunur: onay kutusu, renk kutucuğu, rozet.
//   · Renk TEK KAYNAKTAN — listedeki kutucuk ile grafikteki eğri aynı
//     fonksiyondan (cdbSigColor) gelir.
//   · Ağaç panelin AYNASIDIR: grafiği değiştiren her yol cdbRefreshTree() çağırır.
//
// ── AĞAÇ DBC'DEN DEĞİL KAYITTAN SÜRÜLÜR ──────────────────────────────────
// Gruplar KANALLARDIR (bkz. can-match.js): kayıtta gerçekten geçen kimlikler,
// DBC tanımına çözülmüş hâlleri. Gerekçesi ölçüldü — gerçek bir J1939
// veritabanında 950 mesaj var, kullanıcının kaydında 81 kimlik geçiyor.
// Ağacı DBC'den sürmek 869 satırı boşuna göstermek, üstelik aynı mesajı
// gönderen yedi ayrı kaynağı tek satırda gizlemek olurdu.
//
// Eşleşmenin NASIL kurulduğu satırda görünür: "PGN" rozeti, kaynak adresi
// etikette, tam ipucu başlıkta. PGN eşleşmesi bir VARSAYIMDIR (kaynak adresi
// yok sayıldı) ve kullanıcı bunu bilmeden okumamalı.

var cdbTree = {
  open: {},          // kanal anahtarı → açık mı
  query: '',
  filter: 'all'      // 'all' | 'known' (DBC'de tanımlı) | 'on' (çizili)
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
    .replace(/[çÇ]/g, 'c').replace(/[ğĞ]/g, 'g').replace(/[ıİI]/g, 'i')
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

function cdbThousands(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

// ── Ağaç kurulumu ─────────────────────────────────────────────────────────

function cdbRefreshTree() {
  var host = document.getElementById('cdb-tree');
  if (!host) return;

  if (!cdbState.db && !cdbState.store) {
    host.innerHTML = '<div class="vsig-empty">Bir <b>.dbc</b> ve bir <b>CAN kaydı</b> yükleyin.<br>' +
                     'Tanımlar DBC\'den, kanallar kayıttan gelir.</div>';
    cdbUpdateTreeCount();
    return;
  }
  if (!cdbState.store) {
    host.innerHTML = '<div class="vsig-empty">DBC yüklendi — <b>' + cdbState.db.messages.length +
                     ' mesaj</b>.<br>Ağaç <b>kayıttan</b> sürülür; bir CAN kaydı yükleyin.</div>';
    cdbUpdateTreeCount();
    return;
  }

  var q = cdbTree.query;
  var chans = cdbState.channels || [];
  var html = '';
  var shownCh = 0, shownSigs = 0;

  for (var i = 0; i < chans.length; i++) {
    var ch = chans[i];
    var msg = ch.msg;

    if (cdbTree.filter === 'on' && !cdbChSelectedCount(ch)) continue;
    if (cdbTree.filter === 'known' && !msg) continue;

    var sigs = msg ? msg.signals : [];
    var sigHits = [];
    for (var j = 0; j < sigs.length; j++)
      if (cdbMatches(sigs[j].name, q)) sigHits.push(sigs[j]);
    var headHit = cdbMatches(ch.label, q) || cdbMatches(cdbFmtId(ch.id, ch.ext), q) ||
                  (ch.j ? cdbMatches('pgn ' + ch.j.pgn, q) : false);
    if (q && !headHit && !sigHits.length) continue;
    var list = (q && !headHit) ? sigHits : sigs;

    shownCh++; shownSigs += list.length;
    var open = cdbTree.open[ch.key] || (q && sigHits.length > 0);
    var sel = cdbChSelectedCount(ch);

    html += '<div class="vsig-group' + (open ? ' open' : '') + '">';
    html += '<div class="vsig-ghead" tabindex="0" data-ch="' + cdbEsc(ch.key) + '" role="button" aria-expanded="' + (open ? 'true' : 'false') + '">';
    html += '<span class="vsig-arrow">' + (sigs.length ? '▶' : '·') + '</span>';
    html += '<span class="vsig-gname" title="' + cdbEsc(cdbChannelTitle(ch)) + '">' +
            cdbHighlight(ch.label, headHit ? q : '');
    // Ham kimlik YALNIZ çözülemeyen kanalda satırda durur — orada kimliğin
    // kendisi zaten tek bilgi. Çözülen kanalda ad + kaynak adresi satırı
    // dolduruyor ve kimliği de basmak rozetleri (PGN / MUX) ekranın dışına
    // itiyordu; kimlik ipucunda ve Mesaj İstatistiği sekmesinde duruyor.
    if (!msg)
      html += '<span style="color:var(--text-muted);font-weight:400;font-family:var(--font-mono);">' +
              cdbEsc(cdbFmtId(ch.id, ch.ext)) + '</span>';
    if (ch.match === 'pgn')
      html += '<span style="color:var(--ink-accent, var(--accent-primary));font-size:var(--fs-micro);" title="J1939 PGN eşleşmesi — kaynak adresi yok sayıldı">PGN</span>';
    if (msg && msg.multiplexed)
      html += '<span style="color:var(--accent-warning);font-size:var(--fs-micro);" title="Çoklanmış mesaj">MUX</span>';
    if (!msg)
      html += '<span style="color:var(--text-muted);font-size:var(--fs-micro);" title="Yüklü DBC bu kimliği tanımlamıyor">?</span>';
    html += '</span>';
    if (sigs.length) html += '<span class="vsig-badge' + (sel ? ' on' : '') + '">' + sel + '/' + sigs.length + '</span>';
    html += '<span class="vsig-badge" title="Kayıttaki kare sayısı">' + cdbThousands(ch.count) + '</span>';
    html += '</div>';

    html += '<div class="vsig-list">';
    if (!msg) html += '<div class="vsig-orphan">DBC\'de tanımı yok — çözülemez</div>';
    else if (!list.length) html += '<div class="vsig-orphan">sinyal tanımı yok</div>';
    for (var k = 0; k < list.length; k++) {
      var sig = list[k];
      var sk = cdbSigKey(ch, sig);
      var on = cdbChartHasSignal(sk);
      html += '<div class="vsig-row' + (on ? ' on' : '') + '" tabindex="0" data-sig="' + cdbEsc(sk) + '"' +
              ' title="' + cdbEsc(cdbSigTitle(ch, sig)) + '">';
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

  if (!shownCh) {
    html = '<div class="vsig-empty">' + (q ? 'Aramaya uyan kanal/sinyal yok.' :
      cdbTree.filter === 'known' ? 'Kayıttaki hiçbir kimlik yüklü DBC\'de tanımlı değil.<br>' +
        'Süzgeci <b>Tümü</b> yapıp ham kimlikleri görebilirsiniz.' :
      'Gösterilecek kanal yok.') + '</div>';
  }

  host.innerHTML = html;
  cdbBindTree(host);
  cdbUpdateTreeCount(shownCh, shownSigs);
}

function cdbSigTitle(ch, sig) {
  var p = [(ch.msg ? ch.msg.name : '?') + '.' + sig.name];
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
  p.push('', 'Kanal: ' + cdbFmtId(ch.id, ch.ext) + ' · ' + cdbThousands(ch.count) + ' kare');
  if (sig.comment) p.push('', sig.comment);
  return p.join('\n');
}

function cdbChSelectedCount(ch) {
  if (!ch.msg) return 0;
  var n = 0;
  for (var i = 0; i < ch.msg.signals.length; i++)
    if (cdbChartHasSignal(cdbSigKey(ch, ch.msg.signals[i]))) n++;
  return n;
}

// ── Etkileşim ─────────────────────────────────────────────────────────────

function cdbBindTree(host) {
  host.querySelectorAll('.vsig-ghead').forEach(function(el) {
    var toggle = function() {
      var k = el.getAttribute('data-ch');
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
  if (cdbChartHasSignal(sigKey)) {
    cdbChartRemoveSignal(sigKey);
  } else {
    cdbChartAddSignal(found.ch, found.sig);
    var ser = cdbSeriesOf(sigKey);
    if (ser && !ser.n)
      cdbToast(found.sig.name + ': kanal var ama sinyal hiçbir karede çözülemedi ' +
               '(çoklama uyuşmuyor ya da kare sinyali taşıyacak kadar uzun değil).', 'warn');
  }
  cdbRefreshTree();
}

// 'kanalAnahtarı.SinyalAdı' → { ch, sig }
function cdbFindSignal(sigKey) {
  var chans = cdbState.channels || [];
  var dot = sigKey.indexOf('.');
  if (dot < 0) return null;
  var ck = sigKey.slice(0, dot), sn = sigKey.slice(dot + 1);
  for (var i = 0; i < chans.length; i++) {
    if (chans[i].key !== ck || !chans[i].msg) continue;
    var sig = chans[i].msg.sigByName[sn];
    return sig ? { ch: chans[i], sig: sig } : null;
  }
  return null;
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

function cdbUpdateTreeCount(chans, sigs) {
  var el = document.getElementById('cdb-tree-count');
  if (!el) return;
  if (chans === undefined) { el.textContent = ''; return; }
  el.textContent = chans + ' kanal · ' + sigs + ' sinyal';
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { cdbNorm: cdbNorm, cdbHighlight: cdbHighlight, cdbMatches: cdbMatches, cdbThousands: cdbThousands, cdbEsc: cdbEsc };
}
