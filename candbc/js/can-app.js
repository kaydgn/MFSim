// ═══════════════════════════════════════════════════════════════════════════
// UYGULAMA KATMANI — dosya yükleme, sekmeler, durum çubuğu, dışa aktarma
// ═══════════════════════════════════════════════════════════════════════════
//
// Bu dosya HTML kurar ve olayları bağlar; HESAP YAPMAZ. Çözümleme
// can-dbc.js / can-log.js / can-decode.js'te, çizim can-chart.js'te.
//
// ── VERİ BİLGİSAYARDAN ÇIKMAZ ────────────────────────────────────────────
// Program tek HTML dosyasıdır ve hiçbir ağ isteği yapmaz: dosyalar
// FileReader ile okunur, çözümleme tarayıcıda koşar. Bir CAN kaydı çoğu zaman
// bir aracın kalibrasyon verisidir; sunucuya gitmemesi bir özellik.

var cdbState = {
  db: null, dbcName: '', dbcWarnCount: 0,
  store: null, logName: '', logDetect: null,
  channels: [], match: null,     // bkz. can-match.js
  j1939: true,                   // PGN yedek eşleştirmesi açık mı
  tab: 'chart',
  framesChKey: null, framesPage: 0
};

// DBC ya da kayıt değiştiğinde kanallar YENİDEN kurulur. Tek giriş noktası:
// iki yerde ayrı ayrı kurulsaydı biri unutulur ve ağaç eski eşleşmeyi
// gösterirdi.
function cdbRebuildChannels() {
  var r = cdbBuildChannels(cdbState.db, cdbState.store, { j1939: cdbState.j1939 });
  cdbState.channels = r.channels;
  cdbState.match = r.report;
  cdbSeriesCache = {};
  return r.report;
}

// ── Küçük yardımcılar ─────────────────────────────────────────────────────

function cdbToast(msg, kind) {
  var host = document.getElementById('cdb-toast');
  if (!host) return;
  host.textContent = msg;
  host.className = 'cdb-toast on' + (kind ? ' ' + kind : '');
  clearTimeout(cdbToast._t);
  cdbToast._t = setTimeout(function() { host.className = 'cdb-toast'; }, 5200);
}

function cdbBytesHuman(n) {
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
  return (n / 1024 / 1024).toFixed(1) + ' MB';
}

// Metin çözümü: DBC dosyaları sıklıkla Windows-1252/Latin-1'dir (Almanca ve
// Türkçe birim adları, açıklamalar). UTF-8 olarak zorla okumak "Ã¼" gibi
// bozuk adlar üretir; katı UTF-8 çözücü hata verirse 1252'ye düşülür.
function cdbDecodeText(buf) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch (e) {
    try { return new TextDecoder('windows-1252').decode(buf); }
    catch (e2) {
      var u = new Uint8Array(buf), s = '';
      for (var i = 0; i < u.length; i++) s += String.fromCharCode(u[i]);
      return s;
    }
  }
}

function cdbReadFile(file, done) {
  var r = new FileReader();
  r.onload = function() { done(cdbDecodeText(r.result)); };
  r.onerror = function() { cdbToast('Dosya okunamadı: ' + file.name, 'err'); };
  r.readAsArrayBuffer(file);
}

// ── Dosya yükleme ─────────────────────────────────────────────────────────

function cdbPickDbc() { document.getElementById('cdb-file-dbc').click(); }
function cdbPickLog() { document.getElementById('cdb-file-log').click(); }

function cdbOnDbcFile(input) {
  var f = input.files && input.files[0];
  input.value = '';
  if (f) cdbLoadDbcFile(f);
}

function cdbOnLogFile(input) {
  var f = input.files && input.files[0];
  input.value = '';
  if (f) cdbLoadLogFile(f);
}

function cdbLoadDbcFile(file) {
  cdbReadFile(file, function(text) {
    cdbApplyDbc(cdbParseDbc(text), file.name);
  });
}

function cdbApplyDbc(db, name) {
  cdbState.db = db;
  cdbState.dbcName = name;
  cdbState.dbcWarnCount = db.warnings.length;
  // Yeni veritabanı → eski sinyal seçimleri ve seri önbelleği ARTIK GEÇERSİZ.
  // Temizlenmezse eski sinyal nesneleri çizilmeye devam eder ve kullanıcı
  // yüklediği DBC'nin uygulanmadığını fark etmez.
  cdbChartClear();
  cdbSeriesCache = {};
  cdbSigMeta = {};
  cdbColorSeq = 0;
  var sigs = 0;
  for (var i = 0; i < db.messages.length; i++) sigs += db.messages[i].signals.length;
  cdbSetChip('cdb-chip-dbc', name + ' · ' + db.messages.length + ' mesaj / ' + sigs + ' sinyal');
  var rep = cdbRebuildChannels();
  if (!db.messages.length) cdbToast('Bu DBC dosyasında hiç mesaj tanımı bulunamadı.', 'err');
  else if (cdbState.store) cdbToast(cdbMatchSummary(rep));
  else cdbToast(db.messages.length + ' mesaj, ' + sigs + ' sinyal okundu. Şimdi bir CAN kaydı yükleyin.');
  cdbRefreshTree();
  cdbRenderTab();
  cdbUpdateStatus();
}

function cdbLoadLogFile(file) {
  cdbShowProgress(true, 'Okunuyor: ' + file.name + ' (' + cdbBytesHuman(file.size) + ')');
  cdbReadFile(file, function(text) {
    cdbShowProgress(true, 'Çözümleniyor…');
    var opts = {};
    var sel = document.getElementById('cdb-fmt-select');
    if (sel && sel.value && sel.value !== 'auto') opts.formatId = sel.value;
    var rel = document.getElementById('cdb-time-rel');
    if (rel) opts.relativeTime = rel.getAttribute('aria-pressed') === 'true';
    cdbParseLogAsync(text, opts, function(p) {
      cdbShowProgress(true, 'Çözümleniyor… %' + Math.round(p * 100));
    }, function(res) {
      cdbShowProgress(false);
      if (res.error) {
        cdbState.logDetect = res.detect;
        cdbToast(res.error + ' Tanı sekmesinde denenen biçimler listeleniyor.', 'err');
        cdbState.tab = 'diag'; cdbRenderTab();
        return;
      }
      cdbApplyStore(res.store, file.name, res.detect);
    });
  });
}

function cdbApplyStore(store, name, detect) {
  cdbState.store = store;
  cdbState.logName = name;
  cdbState.logDetect = detect;
  cdbState.framesChKey = null;
  cdbState.framesPage = 0;
  var rep = cdbRebuildChannels();            // seriler eski kayda aitti
  cdbSetChip('cdb-chip-log', name + ' · ' + cdbThousands(store.n) + ' kare · ' + store.formatName);
  cdbChartFitAll(true);
  cdbChartLayout();
  cdbRefreshTree();
  cdbRenderTab();

  var msg = cdbThousands(store.n) + ' kare okundu (' + store.formatName + ').';
  if (store.skipped) msg += ' ' + cdbThousands(store.skipped) + ' satır çözülemedi.';
  if (!store.timeMonotonic) msg += ' Zaman damgaları artan sırada DEĞİL.';
  if (cdbState.db) msg += ' ' + cdbMatchSummary(rep);
  cdbToast(msg, (store.skipped || !store.timeMonotonic) ? 'warn' : '');
  if (!store.n) cdbToast('Dosya okundu ama hiç CAN karesi çözülemedi. Tanı sekmesine bakın.', 'err');
}

// Eşleştirmenin bir cümlelik özeti. PGN eşleşmesi bir VARSAYIMDIR — kaç
// tanesinin öyle kurulduğu söylenmezse kullanıcı hepsini tam eşleşme sanar.
function cdbMatchSummary(rep) {
  if (!rep || !rep.total) return '';
  var p = [];
  p.push(rep.total + ' kanal: ' + rep.exact + ' tam kimlik');
  if (rep.pgn) p.push(rep.pgn + ' J1939 PGN (kaynak adresi yok sayıldı)');
  if (rep.unmatched) p.push(rep.unmatched + ' tanımsız');
  return p.join(' · ') + '.';
}

function cdbSetChip(id, text) {
  var el = document.getElementById(id);
  if (!el) return;
  el.textContent = text;
  el.classList.add('on');
}

function cdbShowProgress(on, text) {
  var el = document.getElementById('cdb-progress');
  if (!el) return;
  el.style.display = on ? 'flex' : 'none';
  if (text) el.querySelector('.cdb-prog-text').textContent = text;
}

// Uzantıdan hangi dosya olduğunu çıkarır. Sürükle-bırakta kullanıcı iki
// dosyayı birden bırakabiliyor; hangisinin DBC hangisinin kayıt olduğunu
// sormak yerine uzantıdan okunuyor.
function cdbClassifyFile(name) {
  var n = String(name || '').toLowerCase();
  if (/\.dbc$/.test(n)) return 'dbc';
  if (/\.(log|asc|trc|txt|csv|dump|blf)$/.test(n)) return 'log';
  return 'log';
}

function cdbAcceptFiles(files) {
  var list = Array.prototype.slice.call(files || []);
  var dbc = null, log = null;
  for (var i = 0; i < list.length; i++) {
    var kind = cdbClassifyFile(list[i].name);
    if (kind === 'dbc' && !dbc) dbc = list[i];
    else if (!log) log = list[i];
  }
  if (dbc) cdbLoadDbcFile(dbc);
  if (log) {
    // DBC ile kayıt aynı anda bırakıldıysa önce DBC uygulansın: kayıt
    // yüklenirken ağaç zaten yeni tanımlarla kurulur.
    if (dbc) setTimeout(function() { cdbLoadLogFile(log); }, 60);
    else cdbLoadLogFile(log);
  }
  if (!dbc && !log) cdbToast('Tanınan bir dosya bırakılmadı (.dbc, .log, .asc, .trc, .txt).', 'err');
}

function cdbInitDropzone() {
  var overlay = document.getElementById('cdb-drop');
  var depth = 0;
  window.addEventListener('dragenter', function(e) {
    if (!e.dataTransfer || Array.prototype.indexOf.call(e.dataTransfer.types || [], 'Files') < 0) return;
    depth++; overlay.classList.add('on');
  });
  window.addEventListener('dragover', function(e) { e.preventDefault(); });
  window.addEventListener('dragleave', function() { if (--depth <= 0) { depth = 0; overlay.classList.remove('on'); } });
  window.addEventListener('drop', function(e) {
    e.preventDefault(); depth = 0; overlay.classList.remove('on');
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) cdbAcceptFiles(e.dataTransfer.files);
  });
}

// ── Sekmeler ──────────────────────────────────────────────────────────────

function cdbSetTab(tab) {
  cdbState.tab = tab;
  var bar = document.getElementById('cdb-tabs');
  if (bar) bar.querySelectorAll('button').forEach(function(b) {
    b.setAttribute('aria-pressed', b.getAttribute('data-tab') === tab ? 'true' : 'false');
  });
  document.getElementById('cdb-pane-chart').style.display = tab === 'chart' ? 'flex' : 'none';
  document.getElementById('cdb-pane-alt').style.display = tab === 'chart' ? 'none' : 'block';
  cdbRenderTab();
  if (tab === 'chart') cdbChartRedraw();
}

function cdbRenderTab() {
  if (cdbState.tab === 'chart') { cdbUpdateStatus(); return; }
  var host = document.getElementById('cdb-pane-alt');
  if (!host) return;
  if (cdbState.tab === 'frames') host.innerHTML = cdbRenderFrames();
  else if (cdbState.tab === 'stats') host.innerHTML = cdbRenderStats();
  else host.innerHTML = cdbRenderDiag();
  host.querySelectorAll('[data-frames-ch]').forEach(function(el) {
    el.addEventListener('change', function() {
      cdbState.framesChKey = el.value || null;
      cdbState.framesPage = 0;
      cdbRenderTab();
    });
  });
  host.querySelectorAll('[data-page]').forEach(function(el) {
    el.addEventListener('click', function() {
      cdbState.framesPage = parseInt(el.getAttribute('data-page'), 10);
      cdbRenderTab();
    });
  });
}

var CDB_PAGE = 200;

// Kanal anahtarı → kanal (sekmelerin hızlı erişimi için)
function cdbChanByKey(key) {
  var c = cdbState.channels || [];
  for (var i = 0; i < c.length; i++) if (c[i].key === key) return c[i];
  return null;
}

function cdbRenderFrames() {
  var st = cdbState.store;
  if (!st || !st.n) return cdbAltEmpty('Kare listesi için önce bir CAN kaydı yükleyin.');

  // Seçici KANALLARDAN kurulur: kayıtta gerçekten geçen kimlikler, çözülmüş
  // adlarıyla ve kaynak adresleriyle.
  var chans = cdbState.channels || [];
  var opts = '<option value="">Tüm kareler (' + cdbThousands(st.n) + ')</option>';
  for (var i = 0; i < chans.length; i++) {
    var c = chans[i];
    opts += '<option value="' + cdbEsc(c.key) + '"' + (cdbState.framesChKey === c.key ? ' selected' : '') + '>' +
            cdbEsc(c.label + '  ' + cdbFmtId(c.id, c.ext)) + '  (' + cdbThousands(c.count) + ')</option>';
  }

  var idx = cdbState.framesChKey ? st.byKey[cdbState.framesChKey] : null;
  var total = idx ? idx.length : st.n;
  var pages = Math.max(1, Math.ceil(total / CDB_PAGE));
  var page = Math.min(cdbState.framesPage, pages - 1);
  var from = page * CDB_PAGE, to = Math.min(total, from + CDB_PAGE);

  var h = '<div class="cdb-alt-bar">';
  h += '<span class="cdb-alt-lbl">Kanal</span>';
  h += '<select class="cdb-sel" data-frames-ch>' + opts + '</select>';
  h += '<span class="cdb-alt-lbl">' + cdbThousands(total) + ' kare · sayfa ' + (page + 1) + '/' + pages + '</span>';
  h += '<span style="flex:1"></span>';
  if (page > 0) h += '<button class="ve-trace-btn" data-page="' + (page - 1) + '">◀ Önceki</button>';
  if (page < pages - 1) h += '<button class="ve-trace-btn" data-page="' + (page + 1) + '">Sonraki ▶</button>';
  h += '</div>';

  h += '<table class="cdb-table"><thead><tr>' +
       '<th style="width:92px">Zaman (s)</th><th style="width:96px">Kimlik</th>' +
       '<th style="width:150px">Kanal</th><th style="width:34px">DLC</th>' +
       '<th style="width:186px">Ham veri</th><th>Çözülen sinyaller</th></tr></thead><tbody>';

  for (var r = from; r < to; r++) {
    var fi = idx ? idx[r] : r;
    var ch = cdbChanByKey(cdbMsgKey(st.id[fi], st.ext[fi] === 1));
    var hex = '';
    for (var b = 0; b < st.len[fi]; b++) {
      var v = st.data[st.off[fi] + b].toString(16).toUpperCase();
      hex += (v.length < 2 ? '0' + v : v) + ' ';
    }
    var dec = '';
    if (ch && ch.msg) {
      var rows = cdbDecodeFrame(st, ch.msg, fi);
      var parts = [];
      for (var q = 0; q < rows.length && q < 10; q++) {
        parts.push('<b>' + cdbEsc(rows[q].sig.name) + '</b>=' +
                   cdbEsc(cdbFmtSigVal(rows[q].sig, rows[q].value)));
      }
      if (rows.length > 10) parts.push('…');
      dec = parts.join('<span class="cdb-sep">·</span>');
    } else {
      dec = '<span class="cdb-dim">DBC\'de tanımsız</span>';
    }
    h += '<tr><td class="num">' + st.t[fi].toFixed(6) + '</td>' +
         '<td class="mono">' + cdbFmtId(st.id[fi], st.ext[fi] === 1) + '</td>' +
         '<td>' + cdbEsc(ch ? ch.label : '—') + '</td>' +
         '<td class="num">' + st.len[fi] + '</td>' +
         '<td class="mono">' + hex.trim() + '</td>' +
         '<td>' + dec + '</td></tr>';
  }
  h += '</tbody></table>';
  return h;
}

function cdbRenderStats() {
  var st = cdbState.store;
  if (!st || !st.n) return cdbAltEmpty('İstatistik için önce bir CAN kaydı yükleyin.');
  var chans = cdbState.channels || [];
  var h = '<div class="cdb-alt-bar"><span class="cdb-alt-lbl">' + chans.length +
          ' kanal · ' + cdbThousands(st.n) + ' kare · ' +
          (st.t1 - st.t0).toFixed(3) + ' s</span></div>';
  h += '<table class="cdb-table"><thead><tr>' +
       '<th style="width:96px">Kimlik</th><th style="width:170px">Kanal</th>' +
       '<th style="width:66px">Kare</th><th style="width:84px">Ort. periyot</th>' +
       '<th style="width:80px">En kısa</th><th style="width:80px">En uzun</th>' +
       '<th style="width:88px">DBC çevrimi</th><th>Durum</th></tr></thead><tbody>';
  for (var i = 0; i < chans.length; i++) {
    var ch = chans[i];
    var idx = st.byKey[ch.key];
    var lo = Infinity, hi = 0, sum = 0, n = 0;
    for (var j = 1; j < idx.length; j++) {
      var d = st.t[idx[j]] - st.t[idx[j - 1]];
      if (d < 0) continue;
      sum += d; n++;
      if (d < lo) lo = d;
      if (d > hi) hi = d;
    }
    var avg = n ? sum / n : 0;
    var ms = function(v) { return n ? (v * 1000).toFixed(1) + ' ms' : '—'; };
    var durum;
    if (!ch.msg) durum = '<span class="cdb-warn">DBC\'de tanımsız</span>' +
      (ch.ext && cdbJ1939Proprietary(ch.id) ? ' <span class="cdb-dim">· üretici tanımlı PGN</span>' : '');
    else {
      durum = ch.msg.signals.length + ' sinyal' + (ch.msg.multiplexed ? ' · MUX' : '');
      if (ch.match === 'pgn') durum += ' <span class="cdb-dim">· PGN eşleşmesi</span>';
      if (ch.msg.cycleTime && n && Math.abs(avg * 1000 - ch.msg.cycleTime) > ch.msg.cycleTime * 0.25)
        durum += ' <span class="cdb-warn">· ölçülen periyot DBC çevriminden sapıyor</span>';
    }
    h += '<tr><td class="mono">' + cdbFmtId(ch.id, ch.ext) + '</td>' +
         '<td>' + cdbEsc(ch.label) + '</td>' +
         '<td class="num">' + cdbThousands(ch.count) + '</td>' +
         '<td class="num">' + ms(avg) + '</td><td class="num">' + ms(lo === Infinity ? 0 : lo) + '</td>' +
         '<td class="num">' + ms(hi) + '</td>' +
         '<td class="num">' + (ch.msg && ch.msg.cycleTime ? ch.msg.cycleTime + ' ms' : '—') + '</td>' +
         '<td>' + durum + '</td></tr>';
  }
  h += '</tbody></table>';
  return h;
}

function cdbRenderDiag() {
  var h = '';
  var st = cdbState.store, det = cdbState.logDetect, db = cdbState.db, rep = cdbState.match;

  h += '<div class="cdb-diag-sec"><h3>Kayıt dosyası</h3>';
  if (!st && !det) h += '<p class="cdb-dim">Henüz kayıt yüklenmedi.</p>';
  else {
    if (st) {
      h += '<table class="cdb-kv">';
      h += cdbKv('Dosya', cdbEsc(cdbState.logName));
      h += cdbKv('Seçilen biçim', cdbEsc(st.formatName));
      h += cdbKv('Okunan satır', cdbThousands(st.lines));
      h += cdbKv('Çözülen kare', cdbThousands(st.n));
      h += cdbKv('Çözülemeyen satır', st.skipped ? '<span class="cdb-warn">' + cdbThousands(st.skipped) + '</span>' : '0');
      h += cdbKv('Zaman aralığı', st.noTime ? 'Kayıtta zaman damgası yok — kare sırası eksen olarak kullanıldı'
                : st.t0.toFixed(6) + ' … ' + st.t1.toFixed(6) + ' s  (' + (st.t1 - st.t0).toFixed(3) + ' s)');
      h += cdbKv('Zaman artan sırada mı', st.timeMonotonic ? 'Evet' :
                '<span class="cdb-warn">HAYIR — damgalar geriye atlıyor</span>');
      h += '</table>';
    }
    if (det && det.scores) {
      h += '<h4>Biçim yarışı (ilk 400 satır üzerinde)</h4>';
      h += '<table class="cdb-table"><thead><tr><th>Biçim</th><th style="width:110px">Çözülen / denenen</th><th style="width:70px">Oran</th></tr></thead><tbody>';
      det.scores.slice().sort(function(a, b) { return b.hit - a.hit; }).forEach(function(sc) {
        h += '<tr><td>' + cdbEsc(sc.name) + '</td><td class="num">' + sc.hit + ' / ' + sc.seen +
             '</td><td class="num">%' + Math.round(sc.ratio * 100) + '</td></tr>';
      });
      h += '</tbody></table>';
    }
    if (st && st.skippedSamples.length) {
      h += '<h4>Çözülemeyen satırlardan örnekler</h4><pre class="cdb-pre">';
      st.skippedSamples.forEach(function(sm) { h += cdbEsc(sm.line + ': ' + sm.text) + '\n'; });
      h += '</pre>';
    }
  }
  h += '</div>';

  // ── Eşleştirme ──
  if (rep && rep.total) {
    h += '<div class="cdb-diag-sec"><h3>Kimlik eşleştirmesi</h3>';
    h += '<table class="cdb-kv">';
    h += cdbKv('Kayıttaki ayrı kimlik', rep.total);
    h += cdbKv('Tam kimlik eşleşmesi', rep.exact);
    h += cdbKv('J1939 PGN eşleşmesi', rep.pgn +
          (cdbState.j1939 ? ' <span class="cdb-dim">(kaynak adresi yok sayıldı)</span>'
                          : ' <span class="cdb-dim">(kapalı)</span>'));
    h += cdbKv('Eşleşmeyen', rep.unmatched ? '<span class="cdb-warn">' + rep.unmatched + '</span>' +
          (rep.proprietary ? ' <span class="cdb-dim">· ' + rep.proprietary + ' tanesi üretici tanımlı PGN</span>' : '') : '0');
    h += '</table>';
    h += '<p class="cdb-dim">J1939\'da bir DBC mesajının kimliği KAYNAK ADRESİ içerir ve o adres veritabanını ' +
         'yazanın seçimidir; gerçek otobüste aynı mesaj başka adresten gelir. Bu yüzden tam eşleşme bulunamayan ' +
         '29 bitlik çerçevelerde kaynak adresi (PDU1\'de hedef adresi de) yok sayılıp PGN eşleştirilir. ' +
         'Bu bir VARSAYIMDIR — üst banttaki <b>PGN</b> düğmesiyle kapatabilirsiniz.</p>';

    if (rep.ambiguous.length) {
      h += '<h4>Aynı PGN\'i birden fazla tanım paylaşıyor (' + rep.ambiguous.length + ')</h4>';
      h += '<p class="cdb-dim">Seçim öncelik, DLC, adın kopya olup olmaması ve ad uzunluğuna göre puanlandı. ' +
           'Seçilen <b>kalın</b>. Son sütun asıl soruyu cevaplıyor: seçim SAYIYI değiştiriyor mu?</p>';
      h += '<table class="cdb-table"><thead><tr><th style="width:110px">Kimlik</th><th style="width:80px">PGN</th>' +
           '<th>Adaylar</th><th style="width:190px">Sonuç</th></tr></thead><tbody>';
      rep.ambiguous.slice(0, 40).forEach(function(a) {
        var names = a.cands.map(function(m) {
          return m === a.ch.msg ? '<b>' + cdbEsc(m.name) + '</b>' : cdbEsc(m.name);
        }).join(', ');
        var sonuc = a.identical
          ? '<span class="cdb-dim">Yerleşim birebir aynı — sayı değişmez</span>'
          : '<span class="cdb-warn">Tanımlar FARKLI — seçim sayıyı etkiler</span>';
        h += '<tr><td class="mono">' + cdbFmtId(a.ch.id, a.ch.ext) + '</td>' +
             '<td class="num">' + a.ch.j.pgn + '</td><td>' + names + '</td><td>' + sonuc + '</td></tr>';
      });
      h += '</tbody></table>';
    }

    if (rep.multiSource.length) {
      h += '<h4>Aynı mesajı birden fazla kaynak gönderiyor (' + rep.multiSource.length + ')</h4>';
      h += '<p class="cdb-dim">BİRLEŞTİRİLMEDİ: her kaynak ağaçta kendi satırında durur. Tek eğriye toplamak ' +
           'ayrı ECU\'ların değerlerini karıştırmak olurdu.</p>';
      h += '<table class="cdb-table"><thead><tr><th style="width:170px">Mesaj</th><th>Kaynaklar</th></tr></thead><tbody>';
      rep.multiSource.slice(0, 40).forEach(function(m) {
        h += '<tr><td>' + cdbEsc(m.name) + '</td><td class="mono">' +
             m.chans.map(function(c) {
               return cdbFmtId(c.id, c.ext) + (c.j ? ' (SA ' + cdbFmtAddr(c.j.sa) + ')' : '') +
                      ' · ' + cdbThousands(c.count);
             }).join('<span class="cdb-sep">·</span>') + '</td></tr>';
      });
      h += '</tbody></table>';
    }

    var yok = (cdbState.channels || []).filter(function(c) { return !c.msg; });
    if (yok.length) {
      h += '<h4>DBC\'de tanımı olmayan kimlikler (' + yok.length + ')</h4>';
      h += '<p class="cdb-dim">Bu kareler okundu ama çözülemedi. Yanlış veritabanı yüklendiyse belirti tam olarak budur.</p>';
      h += '<table class="cdb-table"><thead><tr><th style="width:110px">Kimlik</th><th style="width:90px">PGN</th>' +
           '<th style="width:80px">Kare</th><th style="width:70px">Payı</th><th>Not</th></tr></thead><tbody>';
      yok.slice(0, 60).forEach(function(c) {
        h += '<tr><td class="mono">' + cdbFmtId(c.id, c.ext) + '</td>' +
             '<td class="num">' + (c.j ? c.j.pgn : '—') + '</td>' +
             '<td class="num">' + cdbThousands(c.count) + '</td>' +
             '<td class="num">%' + (c.count / st.n * 100).toFixed(1) + '</td>' +
             '<td class="cdb-dim">' + (c.ext && cdbJ1939Proprietary(c.id) ? 'üretici tanımlı (proprietary) PGN' : '') + '</td></tr>';
      });
      h += '</tbody></table>';
    }
    h += '</div>';
  }

  // ── DBC ──
  h += '<div class="cdb-diag-sec"><h3>DBC dosyası</h3>';
  if (!db) h += '<p class="cdb-dim">Henüz DBC yüklenmedi.</p>';
  else {
    var sigs = 0;
    for (var i = 0; i < db.messages.length; i++) sigs += db.messages[i].signals.length;
    h += '<table class="cdb-kv">';
    h += cdbKv('Dosya', cdbEsc(cdbState.dbcName));
    h += cdbKv('Sürüm', cdbEsc(db.version) || '—');
    h += cdbKv('Düğüm', db.nodes.length ? db.nodes.length + ' adet' : '—');
    h += cdbKv('Mesaj / sinyal', db.messages.length + ' / ' + sigs);
    h += cdbKv('Uyarı', db.warnings.length ? '<span class="cdb-warn">' + db.warnings.length + '</span>' : '0');
    h += '</table>';
    if (db.warnings.length) {
      h += '<h4>Ayrıştırıcı uyarıları</h4><pre class="cdb-pre">';
      db.warnings.slice(0, 120).forEach(function(w) { h += cdbEsc('satır ' + w.line + ': ' + w.text) + '\n'; });
      if (db.warnings.length > 120) h += '… ve ' + (db.warnings.length - 120) + ' uyarı daha\n';
      h += '</pre>';
    }
  }
  h += '</div>';
  return h || cdbAltEmpty('Gösterilecek tanı bilgisi yok.');
}

function cdbKv(k, v) { return '<tr><th>' + cdbEsc(k) + '</th><td>' + v + '</td></tr>'; }
function cdbAltEmpty(text) { return '<div class="cdb-alt-empty">' + cdbEsc(text) + '</div>'; }

// ── Durum çubuğu ──────────────────────────────────────────────────────────

function cdbUpdateStatus() {
  var el = document.getElementById('cdb-status');
  if (!el) return;
  var st = cdbState.store;
  var g = function(k, v, cls) {
    return '<span class="ve-trace-st-group"><span class="ve-trace-st-k' + (cls ? ' ' + cls : '') + '">' +
           k + '</span><span class="ve-trace-st-v">' + v + '</span></span>';
  };
  var h = '';
  h += g('Başlangıç', cdbChart.x0.toFixed(4) + ' s');
  h += g('Bitiş', cdbChart.x1.toFixed(4) + ' s');
  h += g('Genişlik', (cdbChart.x1 - cdbChart.x0).toFixed(4) + ' s');
  if (cdbChart.cursorT !== null) h += g('İmleç', cdbChart.cursorT.toFixed(4) + ' s', 'cur');
  if (cdbChart.pinT !== null) {
    h += g('Sabit', cdbChart.pinT.toFixed(4) + ' s', 'pin');
    if (cdbChart.cursorT !== null)
      h += g('Δt', (cdbChart.cursorT - cdbChart.pinT).toFixed(4) + ' s', 'pin');
  }
  h += '<span class="ve-trace-st-group right">';
  h += '<span class="ve-trace-st-k">Şerit</span><span class="ve-trace-st-v">' + cdbChart.lanes.length + '</span>';
  if (st) h += '<span class="ve-trace-st-k" style="margin-left:12px">Kare</span><span class="ve-trace-st-v">' + cdbThousands(st.n) + '</span>';
  h += '</span>';
  el.innerHTML = h;
}

// ── Araç çubuğu eylemleri ─────────────────────────────────────────────────

function cdbToggleYScope() {
  cdbChart.yScope = cdbChart.yScope === 'window' ? 'all' : 'window';
  var b = document.getElementById('cdb-yscope');
  if (b) b.textContent = cdbChart.yScope === 'window' ? 'Y: pencere' : 'Y: tüm kayıt';
  cdbChartRedraw();
}

// PGN yedek eşleştirmesini aç/kapat. J1939 OLMAYAN ama 29 bit kullanan bir
// otobüste PGN yorumu anlamsız eşleşmeler üretebilir; kapatılabilir olması
// bu yüzden.
function cdbToggleJ1939() {
  cdbState.j1939 = !cdbState.j1939;
  var b = document.getElementById('cdb-j1939');
  if (b) {
    b.setAttribute('aria-pressed', cdbState.j1939 ? 'true' : 'false');
    b.title = cdbState.j1939
      ? 'J1939 PGN eşleştirmesi AÇIK — tam kimlik bulunamazsa kaynak adresi yok sayılarak PGN eşleştirilir'
      : 'J1939 PGN eşleştirmesi KAPALI — yalnız birebir kimlik eşleşmesi';
  }
  cdbChartClear();
  var rep = cdbRebuildChannels();
  cdbRefreshTree();
  cdbRenderTab();
  cdbToast(cdbMatchSummary(rep));
}

function cdbToggleTimeRel(btn) {
  var on = btn.getAttribute('aria-pressed') !== 'true';
  btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  if (cdbState.store) cdbToast('Zaman ekseni ayarı bir sonraki kayıt yüklemesinde geçerli olur.');
}

// ── Dışa aktarma ──────────────────────────────────────────────────────────

function cdbDownload(name, blob) {
  var a = document.createElement('a');
  var url = URL.createObjectURL(blob);
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click();
  setTimeout(function() { document.body.removeChild(a); URL.revokeObjectURL(url); }, 400);
}

// Seçili sinyalleri CSV'ye yazar. Sinyaller AYRI zaman damgalarında gelir
// (her mesajın kendi periyodu var); ortak bir zaman ızgarasına zorlamak
// olmayan ölçüm noktaları uydurmak olurdu. Bu yüzden CSV UZUN BİÇİMDEdir:
// her satır bir ölçüm — zaman, sinyal, değer.
function cdbExportCsv() {
  if (!cdbChart.lanes.length) { cdbToast('Önce grafiğe sinyal ekleyin.', 'err'); return; }
  var rows = ['zaman_s;mesaj;sinyal;deger;birim;metin'];
  var n = 0;
  for (var li = 0; li < cdbChart.lanes.length; li++) {
    var lane = cdbChart.lanes[li];
    for (var k = 0; k < lane.keys.length; k++) {
      var key = lane.keys[k], meta = cdbSigMeta[key], ser = cdbSeriesOf(key);
      if (!ser) continue;
      for (var i = 0; i < ser.n; i++) {
        if (ser.t[i] < cdbChart.x0 || ser.t[i] > cdbChart.x1) continue;
        var txt = cdbValueText(meta.sig, ser.v[i]);
        // CSV'de basamak SINIRLANMAZ: dosya okunmak için değil, başka bir
        // araçta işlenmek için üretiliyor. Ekrandaki üç basamak sınırı
        // (cdbFmtSigVal) burada bilgi kaybı olurdu.
        rows.push(ser.t[i].toFixed(6) + ';' + meta.msg.name + ';' + meta.sig.name + ';' +
                  ser.v[i].toFixed(cdbSigDecimals(meta.sig)).replace('.', ',') + ';' +
                  (meta.sig.unit || '') + ';' + (txt || ''));
        n++;
      }
    }
  }
  cdbDownload((cdbState.logName || 'can') + '_sinyaller.csv',
              new Blob(['﻿' + rows.join('\r\n')], { type: 'text/csv;charset=utf-8' }));
  cdbToast(cdbThousands(n) + ' ölçüm noktası CSV olarak indirildi (görünen zaman aralığı).');
}

function cdbExportPng() {
  var cv = document.getElementById('cdb-canvas');
  var ax = document.getElementById('cdb-axis');
  if (!cdbChart.lanes.length) { cdbToast('Önce grafiğe sinyal ekleyin.', 'err'); return; }
  var out = document.createElement('canvas');
  out.width = cv.width;
  out.height = cv.height + ax.height;
  var c = out.getContext('2d');
  c.fillStyle = cdbCssVar('--bg-primary', '#fff');
  c.fillRect(0, 0, out.width, out.height);
  c.drawImage(cv, 0, 0);
  c.drawImage(ax, 0, cv.height);
  out.toBlob(function(b) {
    cdbDownload((cdbState.logName || 'can') + '_diyagram.png', b);
    cdbToast('Diyagram PNG olarak indirildi.');
  });
}

// ── Örnek veri ────────────────────────────────────────────────────────────
// Programı ilk açan kişinin elinde DBC de kayıt da olmayabilir. Örnek, iki
// dosyayı da yerinde üretir: bir J1939 benzeri veritabanı ve ona uyan bir
// candump kaydı. Gerçek bir araç kaydı DEĞİLDİR ve öyle sunulmaz — üretilmiş
// bir gösteri verisidir.
// 'MesajAdi.SinyalAdi' → { msg, sig }. Yalnız örnek yükleyicinin işine yarar;
// ağaç, anahtar tabanlı cdbFindSignal'i (can-tree.js) kullanır.
function cdbFindByNames(path) {
  var chans = cdbState.channels || [];
  var dot = path.indexOf('.');
  var mn = path.slice(0, dot), sn = path.slice(dot + 1);
  for (var i = 0; i < chans.length; i++) {
    if (!chans[i].msg || chans[i].msg.name !== mn) continue;
    var sg = chans[i].msg.sigByName[sn];
    if (sg) return { ch: chans[i], sig: sg };
  }
  return null;
}

function cdbLoadExample() {
  var dbc = CDB_EXAMPLE_DBC;
  var log = cdbMakeExampleLog();
  cdbApplyDbc(cdbParseDbc(dbc), 'ornek_motor.dbc (üretilmiş gösteri verisi)');
  cdbShowProgress(true, 'Örnek kayıt çözümleniyor…');
  cdbParseLogAsync(log, {}, null, function(res) {
    cdbShowProgress(false);
    if (res.error) { cdbToast(res.error, 'err'); return; }
    cdbApplyStore(res.store, 'ornek_kayit.log (üretilmiş)', res.detect);
    // Birkaç sinyali kendiliğinden aç: boş bir grafik "çalışmıyor" görünür.
    // Sinyaller ADLARIYLA aranıyor, mesaj SIRASIYLA değil — sıraya bağlı bir
    // seçim, veritabanına bir mesaj eklendiğinde sessizce yanlış sinyali
    // açardı. Ölçüldü: ilk sürüm tam olarak böyle patladı (SogutucuSicakligi
    // messages[0]'da aranıyordu, oysa ET1'de).
    ['EEC1.MotorDevri', 'CCVS.AracHizi', 'ET1.SogutucuSicakligi',
     'SanzimanDurumu.Vites', 'SanzimanDurumu.HatBasinci'].forEach(function(ad) {
      var found = cdbFindByNames(ad);
      if (!found) return;
      cdbTree.open[found.ch.key] = true;
      cdbChartAddSignal(found.ch, found.sig);
    });
    cdbRefreshTree();
    cdbToast('Örnek yüklendi: gerçek bir araç kaydı değil, gösteri için üretilmiş veridir.');
  });
}

// ── Başlangıç ─────────────────────────────────────────────────────────────

function cdbInit() {
  cdbInitTheme();
  cdbChartBindEvents();
  cdbInitDropzone();
  cdbSetTreeFilter('all');
  cdbRefreshTree();
  cdbChartLayout();
  cdbSetTab('chart');

  var sel = document.getElementById('cdb-fmt-select');
  if (sel) {
    var o = '<option value="auto">Biçim: otomatik</option>';
    for (var i = 0; i < CDB_LOG_FORMATS.length; i++)
      o += '<option value="' + CDB_LOG_FORMATS[i].id + '">' + cdbEsc(CDB_LOG_FORMATS[i].name) + '</option>';
    sel.innerHTML = o;
  }

  document.addEventListener('keydown', function(e) {
    if (e.target && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
    if (e.key === 'f' || e.key === 'F') cdbChartFitAll();
    else if (e.key === '+' || e.key === '=') cdbChartZoom(0.7, cdbChart.cursorT);
    else if (e.key === '-') cdbChartZoom(1.4, cdbChart.cursorT);
    else if (e.key === 'Backspace') { e.preventDefault(); cdbChartBack(); }
    else if (e.key === 'Escape') { cdbChart.pinT = null; cdbDrawOverlay(); cdbUpdateStatus(); }
  });
}
