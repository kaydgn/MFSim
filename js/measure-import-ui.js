// ═══════════════════════════════════════════════════════════════════════════
// ÖLÇÜM İÇE AKTARMA — sihirbaz arayüzü
// ═══════════════════════════════════════════════════════════════════════════
//
// Akış (kullanıcının tarif ettiği sıra):
//   1. "İçe Aktar" → gözat penceresi (.xlsx / .csv / .tsv)
//   2. Dosya okunur, sayfa seçilir, İLK SATIRDAKİ sütun adları taranır
//   3. "X ekseni ne olsun?" → açılır liste, ön seçim genelde Time sütunu
//   4. Y eksenine gidecek sütunlar TİKLİ KUTUlarla seçilir (çok sütunlu
//      dosyalarda arama + Tümü/Hiçbiri ile)
//   5. "Diyagramlara Aktar" → seçilenler ölçüm penceresinde şeritlere düşer
//
// Neden tek pencerede: dosya→sayfa→başlık→X→Y beş ayrı adıma bölünürse
// kullanıcı X'i seçerken sütun listesini göremez. Önizleme tablosu üstte
// durduğu için "hangi sütun neydi" sorusu hep ekranda yanıtlı.

var veImpUI = {
  fileName: '',
  wb: null,            // veXlsOpen sonucu (xlsx) — CSV'de null
  sheetIdx: 0,
  sheets: [],
  rows: null,
  dateCols: {},
  truncated: false,
  commaDecimal: false,
  layout: null,        // { headerRow, unitRow, dataRow }
  columns: [],
  xIndex: -1,
  ySel: {},            // index → true
  query: '',
  holdSparse: true,
  busy: false,
  error: ''
};

// Çok büyük dosyada tarayıcı sekmesini kilitlememek için üst sınır. Aşılırsa
// kullanıcıya AÇIKÇA söylenir — sessizce kırpmak "veri eksik" demenin en kötü
// yoludur.
var VE_IMP_MAX_ROWS = 400000;
var VE_IMP_PREVIEW_ROWS = 6;

function veImpEsc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Giriş: dosya seçtir ───────────────────────────────────────────────────

function veImpOpenPicker() {
  var input = document.createElement('input');
  input.type = 'file';
  input.accept = '.xlsx,.xlsm,.csv,.tsv,.txt';
  input.addEventListener('change', function(e) {
    var f = e.target.files && e.target.files[0];
    if(f) veImpLoadFile(f);
  });
  input.click();
}

function veImpLoadFile(file) {
  veImpUI.fileName = file.name || 'ölçüm';
  veImpUI.error = '';
  veImpUI.busy = true;
  veImpOpenModal();

  var reader = new FileReader();
  reader.onerror = function() {
    veImpUI.busy = false;
    veImpUI.error = 'Dosya okunamadı.';
    veImpRender();
  };
  reader.onload = function(ev) {
    // Ayrıştırma senkron ve uzun sürebilir; önce "okunuyor" ekranı boyansın.
    setTimeout(function() {
      try {
        veImpIngest(new Uint8Array(ev.target.result));
      } catch(err) {
        veImpUI.error = (err && err.message) ? err.message : 'Dosya çözümlenemedi.';
        veImpUI.rows = null;
      }
      veImpUI.busy = false;
      veImpRender();
    }, 20);
  };
  reader.readAsArrayBuffer(file);
}

// ZIP imzası (PK\3\4) → xlsx; değilse metin kabul edilip CSV olarak çözülür.
function veImpIngest(bytes) {
  var isZip = bytes.length > 4 && bytes[0] === 0x50 && bytes[1] === 0x4b &&
              bytes[2] === 0x03 && bytes[3] === 0x04;

  if(isZip) {
    veImpUI.wb = veXlsOpen(bytes);
    veImpUI.sheets = veImpUI.wb.sheets.map(function(s) { return s.name; });
    veImpUI.sheetIdx = 0;
    veImpReadSheet(0);
  } else {
    veImpUI.wb = null;
    veImpUI.sheets = [];
    var text = veXlsUtf8(bytes);
    var parsed = veXlsCsvParse(text);
    veImpApplyParsed(parsed);
  }
}

function veImpReadSheet(i) {
  if(!veImpUI.wb) return;
  veImpUI.sheetIdx = i;
  veImpApplyParsed(veImpUI.wb.readSheet(i, VE_IMP_MAX_ROWS));
}

// Ham satırlardan başlık/sütun çözümüne kadar olan tüm tahminleri yapar.
function veImpApplyParsed(parsed) {
  veImpUI.rows = parsed.rows || [];
  veImpUI.dateCols = parsed.dateCols || {};
  veImpUI.truncated = !!parsed.truncated;

  if(veImpUI.rows.length === 0) throw new Error('Sayfa boş — okunacak satır yok.');

  veImpUI.commaDecimal = veImpDetectCommaDecimal(veImpUI.rows, 0);
  veImpUI.layout = veImpDetectHeaderRow(veImpUI.rows, veImpUI.commaDecimal);
  veImpRebuildColumns();
}

// Başlık satırı değişince (tahmin ya da kullanıcı eliyle) sütunlar yeniden
// çözülür ve X/Y ön seçimi tazelenir.
function veImpRebuildColumns(keepSelection) {
  var rows = veImpUI.rows, layout = veImpUI.layout;
  veImpUI.columns = veImpBuildColumns(rows, layout, veImpUI.commaDecimal);

  // Zaman ekseni tahmini için artan-sıralılık bilgisi (ilk 2000 satır yeter)
  veImpUI.columns.forEach(function(c) {
    if(c.kind !== 'num') return;
    var sample = [];
    var end = Math.min(rows.length, layout.dataRow + 2000);
    for(var r = layout.dataRow; r < end; r++) {
      sample.push(veImpToNumber((rows[r] || [])[c.index], veImpUI.commaDecimal));
    }
    c._monotonic = veImpIsMonotonic(sample);
    var mn = Infinity, mx = -Infinity, seen = 0;
    sample.forEach(function(v) { if(v !== null) { seen++; if(v < mn) mn = v; if(v > mx) mx = v; } });
    c._min = seen ? mn : null;
    c._max = seen ? mx : null;
  });

  if(!keepSelection) {
    veImpUI.xIndex = veImpGuessXColumn(veImpUI.columns);
    veImpUI.ySel = {};
    // Varsayılan: X dışındaki TÜM okunabilir sütunlar seçili gelsin.
    // Kullanıcı az sütunlu dosyada hiçbir şey tıklamadan sonuca ulaşır;
    // çok sütunlu dosyada da eleme yapmak eklemekten hızlıdır.
    veImpUI.columns.forEach(function(c, i) {
      if(i !== veImpUI.xIndex && c.kind !== 'empty') veImpUI.ySel[i] = true;
    });
  }
}

// ── Modal ─────────────────────────────────────────────────────────────────

function veImpOpenModal() {
  var ov = document.getElementById('ve-import-overlay');
  if(!ov) return;
  ov.style.display = 'flex';
  document.addEventListener('keydown', veImpEscHandler);
  veImpRender();
}

function veImpCloseModal() {
  var ov = document.getElementById('ve-import-overlay');
  if(ov) ov.style.display = 'none';
  document.removeEventListener('keydown', veImpEscHandler);
}

function veImpEscHandler(e) {
  if(e.key === 'Escape') veImpCloseModal();
}

function veImpRender() {
  var el = document.getElementById('ve-import-content');
  if(!el) return;
  // Alt çubuk her çizimde durumla eşitlenir: "Diyagramlara Aktar" seçim
  // yokken etkin görünürse kullanıcı boş bir aktarım deneyip hata alır.
  setTimeout(veImpSyncFooter, 0);

  if(veImpUI.busy) {
    el.innerHTML = '<div class="ve-imp-state"><div class="ve-imp-spin"></div>' +
      '<div>' + veImpEsc(veImpUI.fileName) + ' okunuyor…</div>' +
      '<div class="ve-imp-dim">Büyük dosyalarda birkaç saniye sürebilir.</div></div>';
    return;
  }
  if(veImpUI.error) {
    el.innerHTML = '<div class="ve-imp-state"><div class="ve-imp-err-ico">!</div>' +
      '<div><b>Dosya açılamadı</b></div>' +
      '<div class="ve-imp-dim">' + veImpEsc(veImpUI.error) + '</div>' +
      '<button type="button" class="ve-imp-btn" onclick="veImpOpenPicker()">Başka dosya seç</button></div>';
    return;
  }
  if(!veImpUI.rows) {
    el.innerHTML = '<div class="ve-imp-state">' +
      '<div class="ve-imp-drop-ico"><span class="mf-ico mf-ico-upload"></span></div>' +
      '<div><b>Ölçüm dosyası seçin</b></div>' +
      '<div class="ve-imp-dim">Vector CANoe ve benzeri araçların Excel çıktısı · .xlsx, .csv, .tsv</div>' +
      '<button type="button" class="ve-imp-btn ve-imp-btn-primary" onclick="veImpOpenPicker()">Gözat…</button></div>';
    return;
  }

  el.innerHTML = veImpHeaderHTML() + veImpPreviewHTML() + veImpAxisHTML() + veImpColumnListHTML();
}

function veImpHeaderHTML() {
  var h = '<div class="ve-imp-file">';
  h += '<span class="mf-ico mf-ico-grid-cells"></span>';
  h += '<span class="ve-imp-fname" title="' + veImpEsc(veImpUI.fileName) + '">' +
       veImpEsc(veImpUI.fileName) + '</span>';

  if(veImpUI.sheets.length > 1) {
    h += '<label class="ve-imp-inline">Sayfa';
    h += '<select onchange="veImpChangeSheet(this.selectedIndex)">';
    veImpUI.sheets.forEach(function(n, i) {
      h += '<option' + (i === veImpUI.sheetIdx ? ' selected' : '') + '>' + veImpEsc(n) + '</option>';
    });
    h += '</select></label>';
  }

  var dataRows = Math.max(0, veImpUI.rows.length - veImpUI.layout.dataRow);
  h += '<span class="ve-imp-badge">' + dataRows.toLocaleString('tr-TR') + ' satır</span>';
  h += '<span class="ve-imp-badge">' + veImpUI.columns.length + ' sütun</span>';
  if(veImpUI.commaDecimal) h += '<span class="ve-imp-badge" title="Sayılar 1.234,56 biçiminde okunuyor">ondalık virgül</span>';
  h += '<button type="button" class="ve-imp-mini" onclick="veImpOpenPicker()">Başka dosya…</button>';
  h += '</div>';

  if(veImpUI.truncated) {
    h += '<div class="ve-imp-warn">Dosya çok büyük: ilk ' +
         VE_IMP_MAX_ROWS.toLocaleString('tr-TR') + ' satır alındı, gerisi okunmadı.</div>';
  }
  return h;
}

// Önizleme: başlık satırı vurgulu, üstteki üstbilgi satırları soluk.
// Kullanıcı yanlış satırın başlık seçildiğini burada GÖRÜR ve düzeltir.
function veImpPreviewHTML() {
  var L = veImpUI.layout;
  var start = Math.max(0, Math.min(L.headerRow, L.dataRow - 1));
  var end = Math.min(veImpUI.rows.length, start + VE_IMP_PREVIEW_ROWS);
  var maxCols = Math.min(veImpUI.columns.length, 12);

  var h = '<div class="ve-imp-sec"><div class="ve-imp-sec-head">' +
          '<span>Önizleme</span>' +
          '<label class="ve-imp-inline">Başlık satırı' +
          '<input type="number" min="1" max="' + veImpUI.rows.length + '" value="' + (L.headerRow + 1) + '"' +
          ' onchange="veImpSetHeaderRow(this.value)" style="width:64px;">' +
          '</label></div>';

  h += '<div class="ve-imp-tablewrap"><table class="ve-imp-table"><tbody>';
  for(var r = start; r < end; r++) {
    var cls = r === L.headerRow ? ' class="hdr"' : (r === L.unitRow ? ' class="unit"' : '');
    h += '<tr' + cls + '><th>' + (r + 1) + '</th>';
    for(var c = 0; c < maxCols; c++) {
      var v = (veImpUI.rows[r] || [])[c];
      h += '<td' + (c === veImpUI.xIndex ? ' class="xcol"' : '') + '>' +
           veImpEsc(v === null || v === undefined ? '' : v) + '</td>';
    }
    if(veImpUI.columns.length > maxCols) h += '<td class="more">…</td>';
    h += '</tr>';
  }
  h += '</tbody></table></div></div>';
  return h;
}

function veImpAxisHTML() {
  var h = '<div class="ve-imp-sec"><div class="ve-imp-sec-head"><span>X ekseni (yatay)</span></div>';
  h += '<div class="ve-imp-xrow">';
  h += '<select class="ve-imp-xsel" onchange="veImpSetX(this.value)">';
  veImpUI.columns.forEach(function(c, i) {
    if(c.kind !== 'num') return;
    h += '<option value="' + i + '"' + (i === veImpUI.xIndex ? ' selected' : '') + '>' +
         veImpEsc(c.name) + (c.unit ? ' [' + veImpEsc(c.unit) + ']' : '') + '</option>';
  });
  h += '</select>';

  var xc = veImpUI.columns[veImpUI.xIndex];
  if(xc) {
    var note = xc._monotonic ? 'artan — zaman ekseni için uygun'
                             : 'artan DEĞİL — imleç ve zaman ölçeği beklenmedik davranabilir';
    h += '<span class="ve-imp-xnote' + (xc._monotonic ? '' : ' bad') + '">' + note + '</span>';
  }
  if(veImpUI.dateCols[xc ? xc.index : -1]) {
    h += '<span class="ve-imp-badge">tarih/saat biçimi → saniyeye çevrilecek</span>';
  }
  h += '</div>';
  h += '<label class="ve-imp-check"><input type="checkbox"' + (veImpUI.holdSparse ? ' checked' : '') +
       ' onchange="veImpUI.holdSparse=this.checked;"> Boş hücreleri son değerle doldur ' +
       '<span class="ve-imp-dim">(örnekle-ve-tut — farklı periyotla gelen sinyaller için)</span></label>';
  h += '</div>';
  return h;
}

function veImpColumnListHTML() {
  var q = veImpNorm(veImpUI.query);
  var total = 0, sel = 0;
  veImpUI.columns.forEach(function(c, i) {
    if(i === veImpUI.xIndex || c.kind === 'empty') return;
    total++;
    if(veImpUI.ySel[i]) sel++;
  });

  var h = '<div class="ve-imp-sec ve-imp-grow"><div class="ve-imp-sec-head">' +
          '<span>Y ekseni sinyalleri</span>' +
          '<input type="search" class="ve-imp-search" placeholder="Sütun ara…" value="' + veImpEsc(veImpUI.query) + '"' +
          ' oninput="veImpSetQuery(this.value)">' +
          '<button type="button" class="ve-imp-mini" onclick="veImpSelectAll(true)">Tümü</button>' +
          '<button type="button" class="ve-imp-mini" onclick="veImpSelectAll(false)">Hiçbiri</button>' +
          '<span class="ve-imp-count">' + sel + ' / ' + total + '</span>' +
          '</div>';

  h += '<div class="ve-imp-list">';
  var shown = 0;
  veImpUI.columns.forEach(function(c, i) {
    if(i === veImpUI.xIndex || c.kind === 'empty') return;
    if(q && veImpNorm(c.name + ' ' + c.group + ' ' + c.unit).indexOf(q) < 0) return;
    shown++;
    var on = !!veImpUI.ySel[i];
    h += '<label class="ve-imp-item' + (on ? ' on' : '') + '">';
    h += '<input type="checkbox"' + (on ? ' checked' : '') + ' onchange="veImpToggleY(' + i + ', this.checked)">';
    h += '<span class="ve-imp-iname">' + veImpEsc(c.name) +
         (c.group ? '<span class="ve-imp-grp">' + veImpEsc(c.group) + '</span>' : '') + '</span>';
    h += '<span class="ve-imp-iunit">' + veImpEsc(c.unit || '−') + '</span>';
    if(c.kind === 'text') h += '<span class="ve-imp-tag text">metin</span>';
    else if(c._min !== null && c._min !== undefined) {
      h += '<span class="ve-imp-irange">' + veImpFmtNum(c._min) + ' … ' + veImpFmtNum(c._max) + '</span>';
    }
    if(c.sparse) h += '<span class="ve-imp-tag sparse" title="Hücrelerin bir kısmı boş">seyrek</span>';
    h += '</label>';
  });
  if(shown === 0) h += '<div class="ve-imp-empty">Aramayla eşleşen sütun yok.</div>';
  h += '</div></div>';
  return h;
}

function veImpFmtNum(v) {
  if(v === null || v === undefined || !isFinite(v)) return '—';
  var a = Math.abs(v);
  if(a !== 0 && (a < 0.001 || a >= 1e6)) return v.toExponential(2);
  return String(Math.round(v * 1000) / 1000);
}

// ── Etkileşim ─────────────────────────────────────────────────────────────

function veImpChangeSheet(i) {
  try {
    veImpReadSheet(i);
    veImpUI.error = '';
  } catch(err) {
    veImpUI.error = (err && err.message) || 'Sayfa okunamadı.';
  }
  veImpRender();
}

function veImpSetHeaderRow(v) {
  var n = parseInt(v, 10);
  if(!isFinite(n)) return;
  var idx = Math.max(0, Math.min(veImpUI.rows.length - 1, n - 1));
  var L = veImpUI.layout;
  L.headerRow = idx;
  L.unitRow = -1;
  // Başlığın hemen altı birim satırıysa veri bir alttan başlar.
  if(idx + 1 < veImpUI.rows.length && veImpLooksLikeUnitRow(veImpUI.rows[idx + 1], veImpUI.commaDecimal)) {
    L.unitRow = idx + 1;
    L.dataRow = idx + 2;
  } else {
    L.dataRow = idx + 1;
  }
  veImpRebuildColumns();
  veImpRender();
}

function veImpSetX(v) {
  var i = parseInt(v, 10);
  if(!isFinite(i)) return;
  veImpUI.xIndex = i;
  // X olarak seçilen sütun Y listesinden düşer; eskisi geri gelir.
  delete veImpUI.ySel[i];
  veImpRender();
}

function veImpToggleY(i, on) {
  if(on) veImpUI.ySel[i] = true; else delete veImpUI.ySel[i];
  // Yalnızca sayaç ve düğme durumu değişir; listeyi yeniden çizmek
  // kaydırma konumunu başa atardı.
  veImpSyncFooter();
  var el = document.querySelectorAll('.ve-imp-count')[0];
  if(el) {
    var total = 0, sel = 0;
    veImpUI.columns.forEach(function(c, k) {
      if(k === veImpUI.xIndex || c.kind === 'empty') return;
      total++; if(veImpUI.ySel[k]) sel++;
    });
    el.textContent = sel + ' / ' + total;
  }
}

function veImpSelectAll(on) {
  var q = veImpNorm(veImpUI.query);
  veImpUI.columns.forEach(function(c, i) {
    if(i === veImpUI.xIndex || c.kind === 'empty') return;
    // Arama açıkken yalnızca GÖRÜNEN sütunlar etkilenir — "Tümü" gizli
    // sütunları da seçseydi kullanıcı ne seçtiğini göremezdi.
    if(q && veImpNorm(c.name + ' ' + c.group + ' ' + c.unit).indexOf(q) < 0) return;
    if(on) veImpUI.ySel[i] = true; else delete veImpUI.ySel[i];
  });
  veImpRender();
  veImpSyncFooter();
}

function veImpSetQuery(v) {
  veImpUI.query = v || '';
  veImpRender();
  veImpSyncFooter();
  var s = document.querySelector('.ve-imp-search');
  if(s) { s.focus(); s.setSelectionRange(s.value.length, s.value.length); }
}

// "Diyagramlara Aktar" yalnızca seçim varken etkin.
function veImpSyncFooter() {
  var btn = document.getElementById('ve-import-apply');
  if(!btn) return;
  var n = 0;
  Object.keys(veImpUI.ySel).forEach(function(k) { if(veImpUI.ySel[k]) n++; });
  btn.disabled = !veImpUI.rows || n === 0;
  btn.textContent = n > 0 ? ('Diyagramlara Aktar (' + n + ')') : 'Diyagramlara Aktar';
}

// ── Uygulama ──────────────────────────────────────────────────────────────

function veImpConfirm() {
  if(!veImpUI.rows) return;
  var yIdx = Object.keys(veImpUI.ySel)
    .filter(function(k) { return veImpUI.ySel[k]; })
    .map(function(k) { return parseInt(k, 10); })
    .sort(function(a, b) { return a - b; });

  if(yIdx.length === 0) {
    if(typeof showToast === 'function') showToast('En az bir Y ekseni sütunu seçin', 'warning');
    return;
  }

  var ds;
  try {
    ds = veImpBuildDataset({
      rows: veImpUI.rows,
      layout: veImpUI.layout,
      columns: veImpUI.columns,
      commaDecimal: veImpUI.commaDecimal,
      dateCols: veImpUI.dateCols,
      xIndex: veImpUI.xIndex,
      yIndexes: yIdx,
      holdSparse: veImpUI.holdSparse,
      truncated: veImpUI.truncated,
      fileName: veImpUI.fileName,
      sheetName: veImpUI.sheets[veImpUI.sheetIdx] || '',
      name: veImpDatasetName()
    });
  } catch(err) {
    if(typeof showToast === 'function') showToast((err && err.message) || 'İçe aktarma başarısız', 'error');
    return;
  }

  veImpAdd(ds);
  veImpCloseModal();
  veImpApplyToBoard(ds);
}

function veImpDatasetName() {
  var base = veImpUI.fileName.replace(/\.[^.]+$/, '');
  var sheet = veImpUI.sheets[veImpUI.sheetIdx];
  return sheet && veImpUI.sheets.length > 1 ? (base + ' — ' + sheet) : base;
}

// Veri kümesini ölçüm penceresine bağlar.
//
// Pano TEK bir X ekseninde çalışır (js/measure-core.js). İçe aktarılan ölçüm
// kendi zaman eksenini getirdiği için, panoda BAŞKA bir eksene bağlı şeritler
// varsa onlar kalamaz. Sessizce silmek kabul edilemez — kaç şeridin neden
// kalktığı söylenir.
function veImpApplyToBoard(ds) {
  if(typeof veTrBoard !== 'function') return;
  var slot = veTrBoard();
  var wantKey = 'time@' + ds.dataSource;
  var curKey = (typeof veCursorXKey === 'function') ? veCursorXKey(slot) : null;
  var had = (slot.sensors || []).length;

  if(had > 0 && curKey !== wantKey) {
    slot.sensors = [];
    slot.lanes = [];
    slot.yAxisLock = {};
    if(typeof showToast === 'function') {
      showToast(had + ' şerit kaldırıldı: içe aktarılan ölçüm kendi zaman eksenini ' +
                'getiriyor ve pencere tek X ekseninde çalışır.', 'info');
    }
  }

  slot.type = 'line';
  if(!slot.sensors) slot.sensors = [];
  slot._dataSource = ds.dataSource;
  slot.xAxis = {
    id: 'time',
    name: ds.x.name + (ds.x.unit ? ' [' + ds.x.unit + ']' : ''),
    unit: ds.x.unit || '',
    _dataSource: ds.dataSource
  };

  ds.columns.forEach(function(c) {
    var dup = slot.sensors.some(function(s) { return s.id === ds.sensorId && s.signal === c.key; });
    if(dup) return;
    slot.sensors.push({
      id: ds.sensorId,
      signal: c.key,
      name: c.name,
      unit: c.unit || '',
      _dataSource: ds.dataSource
    });
  });

  if(typeof veTrResetCache === 'function') veTrResetCache();
  if(typeof veSigResetCache === 'function') veSigResetCache();
  if(typeof veTrResetView === 'function') veTrResetView();

  // Sonuçlar sayfası açık değilse oraya geç — kullanıcı "aktar" dedi, sonucu
  // görmek için ayrıca gezinmek zorunda kalmamalı.
  if(typeof veSubTabDegistir === 'function' && typeof currentSubTab !== 'undefined' &&
     currentSubTab !== 'sonuclar') {
    veSubTabDegistir('sonuclar');
  } else {
    if(typeof veUpdateResultsTree === 'function') veUpdateResultsTree();
    if(typeof veTrEnter === 'function') veTrEnter();
    if(typeof veTrRefresh === 'function') veTrRefresh();
  }
  if(typeof veSyncBoardState === 'function') veSyncBoardState();

  if(typeof showToast === 'function') {
    showToast(ds.columns.length + ' sinyal içe aktarıldı — X ekseni: ' + ds.x.name, 'success');
  }
}

// Veri kümesini kaldır (Veri Gezgini'ndeki grup başlığından).
function veImpDropDataset(id) {
  var ds = veImpFind(id);
  if(!ds) return;
  veImpRemove(id);
  if(typeof veResultSlots !== 'undefined') veImpPruneSlots(veResultSlots);
  if(typeof veTrResetCache === 'function') veTrResetCache();
  if(typeof veSigResetCache === 'function') veSigResetCache();
  if(typeof veUpdateResultsTree === 'function') veUpdateResultsTree();
  if(typeof veTrRefresh === 'function') veTrRefresh();
  if(typeof showToast === 'function') showToast(ds.name + ' kaldırıldı', 'info');
}
