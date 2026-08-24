// Motor / Motor Freni özellikleri - TAM VERSİYON
function getEnginePropertiesHTML(node) {
  var nodeData = node.data || {};
  var rows = nodeData.torqueData || [];
  var verim = nodeData.verim || 100;
  var governedRpm = nodeData.governedRpm || 2100;
  var fitMethod = nodeData.fitMethod || 'linear';
  var polyDegree = nodeData.polyDegree || 5;
  var tableHeight = nodeData.tableHeight || 180;
  var hasData = rows.length > 0;

  var isFullThrottle = veActiveModule === 'full-throttle';
  var sp = nodeData.motorSpecs || {};

  // ══════════════════════════════════════════════════════════════════════
  // TAM GAZ → ÜÇ SÜTUNLU HESAP TABLOSU (girdi rayı | veri ızgarası | doğrulama)
  // Brüt girdi (A–C) ve türetilen net (D–F) AYNI SATIRDA; önceki hâlde aynı 17
  // satır iki tabloda iki kez, aynı iki büyüklük iki kanvasta iki kez vardı.
  // MOTOR FRENİ dalı değişmez — orada iki sütunlu eski yerleşim sürüyor.
  // İçerik, ID'ler ve olay bağlayıcıları korunur; yalnız yerleşim değişir.
  // ══════════════════════════════════════════════════════════════════════

  // Aksesuar modeli ve governed devri chunk'lardan ÖNCE çözülür: ızgaranın ƒ
  // sütunları, özet şeridi ve doğrulama sütunu üçü de bunları okuyor.
  var accData = [], initGoverned = sp.governedSpeed || governedRpm || 2100;
  if(isFullThrottle) {
    // Bağlı aksesuar düğümlerinden (Klima/Alternatör/Hava Komp.) modeli güncelle
    if(typeof veSyncEngineAccessories === 'function') veSyncEngineAccessories(node);
    var defaultAcc = [
      {name: 'Fan (Kavramalı Fan)', standardLoss: 0, userLoss: 0},
      {name: 'Alternatör / Jeneratör', standardLoss: 0, userLoss: 0},
      {name: 'Hava Kompresörü', standardLoss: 0, userLoss: 0},
      {name: 'Direksiyon Pompası', standardLoss: 0, userLoss: 0},
      {name: 'Klima', standardLoss: 0, userLoss: 0},
      {name: 'Ek Tahrik', standardLoss: 0, userLoss: 0}
    ];
    accData = (nodeData.accessories && nodeData.accessories.length) ? nodeData.accessories : defaultAcc;
  }

  // ── CHUNK: Motor Seçimi (tam genişlik üst şerit) — yalnız Tam Gaz ──
  var selectHtml = '';
  if(isFullThrottle) {
    selectHtml += '<div class="sw-section-title">Motor Seçimi</div>';

    // Motor seçici
    var savedPreset = nodeData.ftMotorPreset || '';
    // min-width:0 ŞART. <select> içsel genişliğini EN UZUN SEÇENEĞİNDEN alır
    // ("Cummins ISB6.7 (Diesel) ISB6.7 340 - FR98387" gibi), esnek kutu ögesi
    // varsayılan min-width:auto ile o genişliğin altına inmeyi reddeder →
    // seçici 240px'lik sol sütundan 59px taşıp ORTA SÜTUNUN ALTINA giriyordu
    // ("motor seçimi kutucuğu arkada kalmış", kullanıcı 2026-08-19).
    selectHtml += '<div style="display:flex; gap:6px; margin-bottom:8px; align-items:center; min-width:0;">';
    // Sütuna sığdırılan seçicide uzun ad kırpılır ve <select> üç nokta koyamaz;
    // tam ad ipucu olarak durur (pencere başlığında da var).
    var _selTitle = (savedPreset && VE_FT_MOTOR_PRESETS[savedPreset])
      ? escapeHTML(VE_FT_MOTOR_PRESETS[savedPreset].name) : 'Hazır motor listesinden seçin';
    selectHtml += '<select id="ve-ft-motor-select-' + node.id + '" title="' + _selTitle +
                  '" onchange="onVEFTMotorSelect(\'' + node.id + '\', this.value)" style="flex:1; min-width:0; width:100%; font-size:var(--fs-body); padding:4px 6px; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:var(--radius-sm);">';
    selectHtml += '<option value="">-- Motor Seçiniz (' + Object.keys(VE_FT_MOTOR_PRESETS).length + ' preset) --</option>';
    // Aile bazlı gruplama
    var _ftFamilies = [
      {label: 'BMC / AZRA', prefix: ['azra_', 'bmc_']},
      {label: 'Cummins ISB 4.5L', prefix: ['isb45']},
      {label: 'Cummins ISB 6.7L', prefix: ['isb67']},
      {label: 'Cummins ISL 8.9L', prefix: ['isl']},
      {label: 'Cummins ISG 12L', prefix: ['isg']},
      {label: 'Cummins ISM 10.8L', prefix: ['ism']},
      {label: 'Cummins ISX 15L', prefix: ['isx']},
      {label: 'GM Duramax', prefix: ['duramax_']},
      {label: 'Diğer', prefix: []}
    ];
    var _ftUsed = {};
    _ftFamilies.forEach(function(fam) {
      var keys = Object.keys(VE_FT_MOTOR_PRESETS).filter(function(k) {
        if(_ftUsed[k]) return false;
        if(fam.prefix.length === 0) return true;
        return fam.prefix.some(function(p) { return k.indexOf(p) === 0; });
      });
      if(keys.length === 0) return;
      selectHtml += '<optgroup label="' + fam.label + ' (' + keys.length + ')">';
      keys.forEach(function(key) {
        _ftUsed[key] = true;
        var sel = (key === savedPreset) ? ' selected' : '';
        selectHtml += '<option value="' + key + '"' + sel + '>' + VE_FT_MOTOR_PRESETS[key].name + '</option>';
      });
      selectHtml += '</optgroup>';
    });
    var manualSel = (savedPreset === '__new__') ? ' selected' : '';
    selectHtml += '<option value="__new__"' + manualSel + '>+ Manuel Giriş</option>';
    selectHtml += '</select>';
    selectHtml += '</div>';

    // Placeholder (veri yoksa)
    selectHtml += '<div id="ve-motor-placeholder-' + node.id + '" style="display:' + (hasData ? 'none' : 'block') + '; padding:20px; text-align:center; background:var(--bg-tertiary); border-radius:var(--radius-sm); margin-bottom:12px;">';
    selectHtml += '<div style="font-size:var(--fs-h1); margin-bottom:8px;"><span class="mf-ico mf-ico-zap"></span></div>';
    // Kontrolün NEREDE olduğunu söyle: "Manuel Giriş" ayrı bir düğme değil,
    // yukarıdaki listenin son seçeneği.
    selectHtml += '<div style="font-size:var(--fs-md); color:var(--text-muted);">Motor seçilmedi — listeden bir motor<br>ya da son seçenek <strong>+ Manuel Giriş</strong>.</div>';
    selectHtml += '</div>';
  }

  // ── CHUNK: Motor Parametreleri (spec tablosu) — yalnız Tam Gaz ──
  // Kart çerçevesi yerine bölüm başlığı + düz tablo: üç sütun tek ekrana ancak
  // kart yığını kalkınca sığıyor. ID'ler ve onchange bağlayıcıları aynı.
  var specCardHtml = '';
  if(isFullThrottle) {
    specCardHtml += '<div class="sw-section-title">Motor Parametreleri</div>';
    specCardHtml += '<table style="width:100%; font-size:var(--fs-body); border-collapse:collapse; border:1px solid var(--border-color);">';

    var specRows = [
      {id: 'displacement', label: 'Silindir Hacmi', unit: 'L', val: sp.displacement || '', step: '0.01'},
      {id: 'idleRpm', label: 'Rölanti Devri', unit: 'rpm', val: sp.idleRpm || '', step: '50'},
      {id: 'governedSpeed', label: 'Governed Speed', unit: 'rpm', val: sp.governedSpeed || '', step: '50'},
      {id: 'noLoadGoverned', label: 'No-Load Governed', unit: 'rpm', val: sp.noLoadGoverned || '', step: '50'},
      {id: 'inertia', label: 'Motor Ataleti', unit: 'kg·m²', val: sp.inertia || '', step: '0.001'}
    ];
    specRows.forEach(function(r) {
      specCardHtml += '<tr style="border-bottom:1px solid var(--border-color);">';
      specCardHtml += '<th style="padding:6px 8px; text-align:left; background:var(--bg-tertiary); border-right:1px solid var(--border-color); width:55%; font-weight:500; color:var(--text-secondary);">' + r.label + ' <span style="color:var(--text-muted); font-weight:400;">[' + r.unit + ']</span></th>';
      specCardHtml += '<td style="padding:4px 6px; background:var(--bg-tertiary);"><input type="number" id="ve-ft-spec-' + r.id + '-' + node.id + '" value="' + r.val + '" step="' + r.step + '" min="0" style="width:100%; padding:4px; font-size:var(--fs-body); background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:var(--radius-sm); text-align:right;" onchange="onVEFTSpecChange(\'' + node.id + '\')"></td>';
      specCardHtml += '</tr>';
    });
    specCardHtml += '</table>';
  }

  // ── CHUNK: Veri alanı (Tork & Güç Verileri tablosu + butonlar) ──
  // YALNIZ Motor Freni dalı. Tam Gaz'da yerini ızgara (sheetHtml) alır.
  // ve-motor-data-area sarmalayıcısı ve ID'si korunur (JS göster/gizle buna bağlı).
  var showDataArea = hasData;
  var dataAreaHtml = '';
  if(!isFullThrottle) {
  dataAreaHtml += '<div id="ve-motor-data-area-' + node.id + '" style="display:' + (showDataArea ? 'block' : 'none') + ';">';
  dataAreaHtml += '<div class="sw-section-title">Tork & Güç Verileri</div>';
  dataAreaHtml += '<div id="ve-motor-table-wrapper-' + node.id + '" style="max-height:' + tableHeight + 'px; overflow-y:auto; margin-bottom:0; border:1px solid var(--border-color); border-radius:var(--radius-sm); border-bottom:none;">';
  dataAreaHtml += '<table style="width:100%; border-collapse:collapse; font-size:var(--fs-body);">';
  dataAreaHtml += '<thead style="position:sticky; top:0; background:var(--bg-tertiary); z-index:1;">';
  dataAreaHtml += '<tr>';
  dataAreaHtml += '<th style="padding:6px; border-bottom:1px solid var(--border-color); text-align:center;">Devir<br>[rpm]</th>';
  dataAreaHtml += '<th style="padding:6px; border-bottom:1px solid var(--border-color); text-align:center;">Tork<br>[Nm]</th>';
  dataAreaHtml += '<th style="padding:6px; border-bottom:1px solid var(--border-color); text-align:center;">Güç<br>[kW]</th>';
  dataAreaHtml += '<th style="padding:6px; border-bottom:1px solid var(--border-color); width:28px;"></th>';
  dataAreaHtml += '</tr></thead>';
  dataAreaHtml += '<tbody id="ve-motor-table-' + node.id + '">';

  // Sadece veri varsa satırları göster
  if(rows.length > 0) {
    rows.forEach(function(row) {
      dataAreaHtml += getVEMotorRowHTML(node.id,
        row.rpm !== undefined && row.rpm !== null ? row.rpm : '',
        row.torque !== undefined && row.torque !== null ? row.torque : '',
        row.power !== undefined && row.power !== null ? row.power : '');
    });
  }

  dataAreaHtml += '</tbody></table></div>';

  // Resize handle
  dataAreaHtml += '<div id="ve-table-resizer-' + node.id + '" style="height:8px; background:var(--bg-tertiary); border:1px solid var(--border-color); border-top:none; border-radius:var(--radius-sm); cursor:ns-resize; display:flex; align-items:center; justify-content:center;" onmousedown="startVETableResize(event, \'' + node.id + '\')">';
  dataAreaHtml += '<div style="width:30px; height:3px; background:var(--border-color); border-radius:var(--radius-sm);"></div>';
  dataAreaHtml += '</div>';

  // Tablo Butonları
  dataAreaHtml += '<div class="sw-btn-row" style="margin:8px 0 12px;">';
  dataAreaHtml += '<button class="sw-btn sw-btn-outline" onclick="addVEMotorRow(\'' + node.id + '\')">+ Satır Ekle</button>';
  dataAreaHtml += '<button class="sw-btn sw-btn-outline" onclick="clearVEMotorTable(\'' + node.id + '\')">Tümünü Sil</button>';
  dataAreaHtml += '<button class="sw-btn sw-btn-danger" onclick="deleteVEMotorSavedSet(\'' + node.id + '\')">Veriyi Temizle</button>';
  dataAreaHtml += '<button class="sw-btn sw-btn-primary" onclick="saveVEMotorData(\'' + node.id + '\')"><span class="mf-ico mf-ico-save"></span> Kaydet</button>';
  dataAreaHtml += '</div>';
  dataAreaHtml += '</div>'; // ve-motor-data-area kapatma (artık butonlardan hemen sonra)
  }

  // ── CHUNK: Veri Izgarası — A–C girdi, D–F türetilen (ƒ) — yalnız Tam Gaz ──
  var sheetHtml = '';
  if(isFullThrottle) {
    // data-show="flex": alanı gizleyip gösteren JS (showVEMotorPlaceholder /
    // veri yükleme yolları) eski hâlinde koşulsuz 'block' yazıyordu ve bu,
    // ızgaranın sütunu doldurmasını sağlayan esnek zinciri kırardı. Gösterim
    // değeri artık elemanın kendisinde duruyor (bkz. veEngShowDataArea);
    // Motor Freni dalı 'block' demeye devam ediyor.
    sheetHtml += '<div id="ve-motor-data-area-' + node.id + '" class="ve-eng-sheet-area" data-show="flex"' +
                 ' style="display:' + (hasData ? 'flex' : 'none') + ';">';
    sheetHtml += '<div class="sw-section-title" style="display:flex; justify-content:space-between;">Veri Izgarası' +
                 '<span id="ve-sheet-range-' + node.id + '" style="font-family:var(--font-mono); font-weight:400; text-transform:none; letter-spacing:0; color:var(--text-muted);">' +
                 'A1:C' + rows.length + ' girdi · ƒ D:F türetilen</span></div>';
    // Izgara VARSAYILAN OLARAK SÜTUNU DOLDURUR (.ve-eng-sheet-wrap → flex:1).
    // Eskiden sabit 352px'ti: 21 satırlık katalog verisi kaydırma çubuğuna
    // düşerken hemen yanındaki doğrulama sütunu 629px'ti ve ızgaranın altında
    // 177px boş alan duruyordu ("veri ızgarası yarım kalmış", kullanıcı).
    // Kullanıcı tutamağı sürüklerse SEÇİMİ KAZANIR: node.data.tableHeight
    // yazılır ve o andan sonra sabit yükseklik uygulanır.
    var sheetHeight = nodeData.tableHeight;
    sheetHtml += '<div id="ve-motor-table-wrapper-' + node.id + '"' +
                 (sheetHeight ? '' : ' class="ve-eng-sheet-wrap"') +
                 ' style="' + (sheetHeight ? 'max-height:' + sheetHeight + 'px; ' : '') +
                 'overflow-y:auto; overflow-x:hidden; border:1px solid var(--border-color);' +
                 ' border-radius:var(--radius-sm); border-bottom:none;">';
    sheetHtml += '<table class="ve-eng-sheet">';
    sheetHtml += '<colgroup><col class="c-n"><col class="c-a"><col class="c-b"><col class="c-c">' +
                 '<col class="c-d"><col class="c-e"><col class="c-f"><col class="c-x"></colgroup>';
    sheetHtml += '<thead><tr><th class="n"> </th>';
    [ {t:'A devir',   u:'rpm', c:'var(--text-secondary)'},
      {t:'B brüt T',  u:'Nm',  c:'var(--text-secondary)'},
      {t:'C brüt P',  u:'kW',  c:'var(--text-secondary)'},
      {t:'D kayıp ƒ', u:'kW',  c:'var(--accent-warning)'},
      {t:'E net T ƒ', u:'Nm',  c:VE_ENG_C.seri1},
      {t:'F net P ƒ', u:'kW',  c:VE_ENG_C.seri2}
    ].forEach(function(c) {
      sheetHtml += '<th style="color:' + c.c + ';">' + c.t +
                   '<div style="font-weight:400; font-size:var(--fs-micro); color:var(--text-muted);">' + c.u + '</div></th>';
    });
    sheetHtml += '<th></th></tr></thead><tbody id="ve-motor-table-' + node.id + '">';
    rows.forEach(function(row, i) {
      sheetHtml += veEngSheetRowHTML(node.id, i + 1,
        row.rpm !== undefined && row.rpm !== null ? row.rpm : '',
        row.torque !== undefined && row.torque !== null ? row.torque : '',
        row.power !== undefined && row.power !== null ? row.power : '',
        accData, initGoverned);
    });
    sheetHtml += '</tbody><tfoot><tr><td class="n">' + (rows.length + 1) + '</td>' +
                 '<td colspan="6">boş satır — yaz ya da “Yapıştır” ile ' +
                 '<span style="font-family:var(--font-mono);">devir ⇥ tork ⇥ güç</span> aktar</td>' +
                 '</tr></tfoot></table></div>';

    // Resize tutamacı — mevcut davranış (tablo yüksekliği node.data.tableHeight)
    sheetHtml += '<div id="ve-table-resizer-' + node.id + '" style="height:8px; background:var(--bg-tertiary); border:1px solid var(--border-color); border-top:none; border-radius:var(--radius-sm); cursor:ns-resize; display:flex; align-items:center; justify-content:center;" onmousedown="startVETableResize(event, \'' + node.id + '\')">';
    sheetHtml += '<div style="width:30px; height:3px; background:var(--border-color); border-radius:var(--radius-sm);"></div>';
    sheetHtml += '</div>';

    sheetHtml += '<div class="sw-btn-row" style="margin:8px 0 6px;">';
    sheetHtml += '<button class="sw-btn sw-btn-outline" onclick="addVEMotorRow(\'' + node.id + '\')">+ Satır Ekle</button>';
    sheetHtml += '<button class="sw-btn sw-btn-outline" onclick="onVEEngSheetPaste(\'' + node.id + '\')">Yapıştır</button>';
    sheetHtml += '<button class="sw-btn sw-btn-outline" onclick="clearVEMotorTable(\'' + node.id + '\')">Tümünü Sil</button>';
    sheetHtml += '<button class="sw-btn sw-btn-danger" onclick="deleteVEMotorSavedSet(\'' + node.id + '\')">Veriyi Temizle</button>';
    sheetHtml += '<button class="sw-btn sw-btn-primary" style="margin-left:auto;" onclick="saveVEMotorData(\'' + node.id +
                 '\')"><span class="mf-ico mf-ico-save"></span> Kaydet</button>';
    sheetHtml += '</div>';
    sheetHtml += '<div style="font-size:var(--fs-micro); color:var(--text-muted); line-height:1.5;">' +
                 'ƒ sütunları düzenlenemez, her hücre değişiminde yeniden hesaplanır: ' +
                 '<span style="font-family:var(--font-mono); color:var(--text-secondary);">D = aksesuar kaybı(devir)</span> · ' +
                 '<span style="font-family:var(--font-mono); color:var(--text-secondary);">F = max(0, C − D)</span> · ' +
                 '<span style="font-family:var(--font-mono); color:var(--text-secondary);">E = F × 9549.3 / A</span>. ' +
                 'Çözücü ve raporlar E–F sütunlarını okur.</div>';
    sheetHtml += '</div>';  // ve-motor-data-area
  }

  // ── CHUNK: Grafik (Tork & Güç Eğrisi) — yalnız Motor Freni ──
  // Tam Gaz'da brüt kanvas kalkar; brüt eğriler doğrulama sütunundaki tek
  // kanvasta kesik çizgi olarak zaten var (iki kanvas aynı iki büyüklüğü
  // çiziyordu). Etkileşim net kanvasa taşındı.
  var chartHtml = '';
  if(!isFullThrottle) {
  chartHtml += '<div class="sw-pkg-card" style="margin-bottom:10px;">';
  chartHtml += '<div class="sw-pkg-header" style="cursor:default;">';
  chartHtml += '<span class="sw-pkg-name">Tork & Güç Eğrisi</span>';
  chartHtml += '<button class="sw-btn sw-btn-outline" style="font-size:var(--fs-micro);padding:2px 8px;margin-left:auto;" onclick="updateVEMotorChart(\'' + node.id + '\')">Güncelle</button>';
  chartHtml += '</div>';
  chartHtml += '<div class="sw-pkg-body">';
  chartHtml += '<canvas id="ve-motor-chart-' + node.id + '" style="width:100%; height:200px; background:var(--bg-input);"></canvas>';
  chartHtml += '<div style="display:flex; justify-content:center; gap:16px; margin-top:6px; font-size:var(--fs-micro);">';
  chartHtml += '<span style="color:#4aa3ff;">● Tork [Nm]</span>';
  chartHtml += '<span style="color:#ff6b6b;">● Güç [kW]</span>';
  chartHtml += '</div>';
  // Etkileşim ipucu GERÇEK METİN olarak (canvas bitmap'indeki ipucu seçilemez,
  // çevrilemez ve ekran okuyucuya görünmez) — bkz. js/panel-chart.js
  chartHtml += '<div class="sw-pkg-desc" style="margin-top:4px;">' + (typeof PC_HINT_HTML !== 'undefined' ? PC_HINT_HTML : '') + '</div>';
  chartHtml += '</div></div>';
  }

  // ── CHUNK: Eğri Yaklaşımı ──
  // Gövde iki dalda ortak; kart çerçevesi yalnız Motor Freni'nde (Tam Gaz'da
  // doğrulama sütununun içine düz akıyor).
  var fitHtml = '';
  if(isFullThrottle) {
    fitHtml += '<div class="sw-section-title">Eğri Yaklaşımı</div>';
  } else {
  fitHtml += '<div class="sw-pkg-card" style="margin-bottom:10px;">';
  fitHtml += '<div class="sw-pkg-header" style="cursor:default;">';
  fitHtml += '<span class="sw-pkg-name">Eğri Yaklaşımı</span>';
  fitHtml += '</div>';
  fitHtml += '<div class="sw-pkg-body">';
  }

  fitHtml += '<div style="display:flex; gap:8px; align-items:center; margin-bottom:8px;">';
  fitHtml += '<select id="ve-fit-method-' + node.id + '" onchange="onVEFitMethodChange(\'' + node.id + '\')" style="flex:1; font-size:var(--fs-body); padding:4px; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:var(--radius-sm);">';
  fitHtml += '<option value="linear"' + (fitMethod === 'linear' ? ' selected' : '') + '>Parça-parça Lineer (İnterpolasyon)</option>';
  fitHtml += '<option value="pchip"' + (fitMethod === 'pchip' ? ' selected' : '') + '>Kübik Spline (PCHIP)</option>';
  fitHtml += '<option value="poly"' + (fitMethod === 'poly' ? ' selected' : '') + '>Polinom</option>';
  fitHtml += '</select>';
  fitHtml += '</div>';

  fitHtml += '<div id="ve-poly-degree-wrapper-' + node.id + '" style="display:' + (fitMethod === 'poly' ? 'flex' : 'none') + '; gap:8px; align-items:center; margin-bottom:8px;">';
  fitHtml += '<span style="font-size:var(--fs-body); color:var(--text-muted);">Polinom derecesi:</span>';
  fitHtml += '<select id="ve-poly-degree-' + node.id + '" onchange="updateVEMotorChart(\'' + node.id + '\')" style="width:60px; font-size:var(--fs-body); padding:3px; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:var(--radius-sm);">';
  for(var d = 2; d <= 5; d++) {
    fitHtml += '<option value="' + d + '"' + (polyDegree == d ? ' selected' : '') + '>' + d + '</option>';
  }
  fitHtml += '</select>';
  fitHtml += '</div>';

  fitHtml += '<div id="ve-motor-fit-' + node.id + '" style="font-size:var(--fs-tiny); color:var(--text-muted); padding:6px 8px; background:var(--bg-input); border:1px solid var(--border-color); font-family:var(--font-mono); word-break:break-all; line-height:1.5;">';
  fitHtml += 'Veri girildikten sonra denklem gösterilecek.';
  fitHtml += '</div>';
  if(!isFullThrottle) fitHtml += '</div></div>'; // sw-pkg-body + sw-pkg-card

  // ── CHUNK: Aksesuar Kayıpları (sol) + Net Değerler (sağ) — yalnız Tam Gaz ──
  var accHtml = '';
  var netHtml = '';
  var brakeHtml = '';

  if(isFullThrottle) {
    // ── TAM GAZ: AKSESUAR KAYIPLARI (girdi rayının alt yarısı) ──
    accHtml += '<div class="sw-section-title" style="display:flex; justify-content:space-between;">Aksesuar Kayıpları' +
               '<span style="font-weight:400; text-transform:none; letter-spacing:0; color:var(--text-muted);">kW</span></div>';

    accHtml += '<table class="ve-eng-acc" style="width:100%; table-layout:fixed; font-size:var(--fs-body); border-collapse:collapse; border:1px solid var(--border-color);">';
    accHtml += '<thead><tr style="background:var(--bg-secondary);">';
    accHtml += '<th style="text-align:left; border:1px solid var(--border-color); font-weight:500; color:var(--text-secondary);">Aksesuar</th>';
    accHtml += '<th style="text-align:right; border:1px solid var(--border-color); font-weight:500; color:var(--text-muted); width:56px;">Std</th>';
    accHtml += '<th style="text-align:right; border:1px solid var(--border-color); font-weight:500; color:var(--text-secondary); width:56px;">Kul.</th>';
    accHtml += '</tr></thead><tbody id="ve-acc-table-' + node.id + '">';

    accData.forEach(function(acc, idx) {
      // Kaybı 0 olan satır sessizleşir — hangi aksesuarın gerçekten güç
      // çektiği tek bakışta okunsun.
      var _tone = (acc.userLoss || 0) > 0 ? 'var(--text-secondary)' : 'var(--text-muted)';
      accHtml += '<tr style="border-bottom:1px solid var(--border-color);">';
      accHtml += '<td style="background:var(--bg-tertiary); border-right:1px solid var(--border-color); color:' + _tone + '; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">' + acc.name + '</td>';
      accHtml += '<td class="num" style="background:var(--bg-tertiary); border-right:1px solid var(--border-color);"><input type="number" class="ve-acc-std-' + node.id + '" data-idx="' + idx + '" value="' + (acc.standardLoss || 0) + '" step="0.1" min="0" style="width:100%; padding:3px; font-size:var(--fs-body); background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:var(--radius-sm); text-align:right;" onchange="onVEAccChange(\'' + node.id + '\')"></td>';
      accHtml += '<td class="num" style="background:var(--bg-tertiary);"><input type="number" class="ve-acc-user-' + node.id + '" data-idx="' + idx + '" value="' + (acc.userLoss || 0) + '" step="0.1" min="0" style="width:100%; padding:3px; font-size:var(--fs-body); background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:var(--radius-sm); text-align:right;" onchange="onVEAccChange(\'' + node.id + '\')"></td>';
      accHtml += '</tr>';
    });

    var totalStd = accData.reduce(function(s, a) { return s + (a.standardLoss || 0); }, 0);
    var totalUser = accData.reduce(function(s, a) { return s + (a.userLoss || 0); }, 0);
    accHtml += '<tr style="background:var(--bg-secondary); font-weight:600;">';
    accHtml += '<td style="border:1px solid var(--border-color); color:var(--text-heading);">Toplam</td>';
    accHtml += '<td id="ve-acc-total-std-' + node.id + '" style="border:1px solid var(--border-color); text-align:right; font-family:var(--font-mono); color:var(--text-muted);">' + totalStd.toFixed(1) + '</td>';
    accHtml += '<td id="ve-acc-total-user-' + node.id + '" style="border:1px solid var(--border-color); text-align:right; font-family:var(--font-mono); color:var(--accent-warning);">' + totalUser.toFixed(1) + '</td>';
    accHtml += '</tr>';
    accHtml += '</tbody></table>';
    // "Kayıpları Uygula" doğrulama sütununa taşındı — sonucu orada okunuyor.
    accHtml += '<div style="font-size:var(--fs-micro); color:var(--text-muted); line-height:1.45;' +
               ' background:var(--bg-tertiary); border:1px solid var(--border-color); padding:5px 7px;">' +
               'Fan kaybı devirle küp (devir/governed)³, diğerleri lineer ölçeklenir. ' +
               'Bağlı aksesuar düğümü varsa kayıp o düğümün eğrisinden okunur.</div>';

    // ── DOĞRULAMA SÜTUNU: tek kanvas + metrikler + eğri yaklaşımı + eylemler ──
    // Governed devirdeki toplam aksesuar kaybı (eğrili/manuel/legacy — tek kaynak).
    var lossAtGoverned = veCalcAccLossAtRPM(accData, initGoverned, initGoverned);
    netHtml += '<div class="sw-section-title" style="display:flex; justify-content:space-between;">Doğrulama' +
               '<span id="ve-net-badge-' + node.id + '" style="font-weight:400; text-transform:none; letter-spacing:0; font-family:var(--font-mono); color:var(--accent-warning);">−' +
               lossAtGoverned.toFixed(1) + ' kW @ ' + initGoverned + '</span></div>';

    netHtml += '<div style="background:var(--bg-input); border:1px solid var(--border-color); border-radius:var(--radius-sm); padding:4px;">';
    netHtml += '<canvas id="ve-net-chart-' + node.id + '" style="width:100%; height:200px;"></canvas>';
    netHtml += '</div>';
    netHtml += '<div style="display:flex; gap:10px; justify-content:center; font-size:var(--fs-micro); color:var(--text-muted);">';
    netHtml += '<span>┅ brüt</span>';
    netHtml += '<span style="color:' + VE_ENG_C.seri1 + ';">● net tork [Nm]</span>';
    netHtml += '<span style="color:' + VE_ENG_C.seri2 + ';">● net güç [kW]</span>';
    netHtml += '</div>';
    // Etkileşim ipucu GERÇEK METİN olarak (bkz. js/panel-chart.js)
    netHtml += '<div style="font-size:var(--fs-micro); color:var(--text-muted); line-height:1.45;">' +
               (typeof PC_HINT_HTML !== 'undefined' ? PC_HINT_HTML : '') + '</div>';

    netHtml += '<table class="ve-eng-metrics">';
    [ {k:'gp',   label:'Brüt tepe güç'},
      {k:'np',   label:'Net tepe güç'},
      {k:'gt',   label:'Brüt tepe tork'},
      {k:'nt',   label:'Net tepe tork'},
      {k:'loss', label:'Governed kaybı'},
      {k:'pts',  label:'Veri noktası'}
    ].forEach(function(m) {
      netHtml += '<tr><th>' + m.label + '</th>' +
                 '<td id="ve-eng-m-' + m.k + '-' + node.id + '">—</td></tr>';
    });
    netHtml += '</table>';

    netHtml += fitHtml;      // Eğri Yaklaşımı — kartsız gövde (yukarıda üretildi)

    netHtml += '<div class="sw-chain-bar ok" style="margin:0;">✓ Governed <span id="ve-eng-govbar-' +
               node.id + '">' + initGoverned + '</span> rpm şanzımana ve vites mantığına yayıldı</div>';
    netHtml += '<div class="sw-btn-row" style="margin:0;">';
    netHtml += '<button class="sw-btn sw-btn-primary" style="flex:1;" onclick="onVEApplyAccLosses(\'' + node.id + '\')">Kayıpları Uygula</button>';
    netHtml += '<button class="sw-btn sw-btn-outline" onclick="veTogglePropertiesPanel(false)">Kapat</button>';
    netHtml += '</div>';

  } else {
    // ── MOTOR FRENİ: Orijinal parametreler ──
    brakeHtml += '<div class="sw-pkg-card" style="margin-top:10px;">';
    brakeHtml += '<div class="sw-pkg-header" style="cursor:default;">';
    brakeHtml += '<span class="sw-pkg-name">Motor Freni Parametreleri</span>';
    brakeHtml += '</div>';
    brakeHtml += '<div class="sw-pkg-body">';

    // Kenarlıklı tablo - daha okunaklı renkler
    brakeHtml += '<table style="width:100%; font-size:var(--fs-body); border-collapse:collapse; border:1px solid var(--border-color);">';

    // Verim satırı
    brakeHtml += '<tr style="border-bottom:1px solid var(--border-color);">';
    brakeHtml += '<th style="padding:8px; text-align:left; background:var(--bg-tertiary); border-right:1px solid var(--border-color); width:65%; font-weight:500; color:var(--text-secondary);">Kabul edilen motor freni verimi [%]</th>';
    brakeHtml += '<td style="padding:8px; background:var(--bg-tertiary);"><input type="number" id="ve-mf-verim-' + node.id + '" value="' + verim + '" min="0" max="100" step="1" style="width:100%; padding:5px; font-size:var(--fs-body); background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:var(--radius-sm); text-align:right;" onchange="onVEMotorParamChange(\'' + node.id + '\')"></td>';
    brakeHtml += '</tr>';

    // Verim açıklama satırı
    brakeHtml += '<tr style="border-bottom:1px solid var(--border-color);">';
    brakeHtml += '<td colspan="2" style="padding:6px 8px; font-size:var(--fs-tiny); color:var(--text-secondary); background:var(--bg-secondary); line-height:1.4;">Katalog tork/güç değerleri bu oranla çarpılarak kullanılır (%95 → ×0,95).</td>';
    brakeHtml += '</tr>';

    // Governed RPM satırı
    brakeHtml += '<tr style="border-bottom:1px solid var(--border-color);">';
    brakeHtml += '<th style="padding:8px; text-align:left; background:var(--bg-tertiary); border-right:1px solid var(--border-color); font-weight:500; color:var(--text-secondary);">Governed RPM [d/d]</th>';
    brakeHtml += '<td style="padding:8px; background:var(--bg-tertiary);"><input type="number" id="ve-governed-rpm-' + node.id + '" value="' + governedRpm + '" min="500" max="5000" step="100" style="width:100%; padding:5px; font-size:var(--fs-body); background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:var(--radius-sm); text-align:right;" onchange="onVEMotorParamChange(\'' + node.id + '\')"></td>';
    brakeHtml += '</tr>';

    // Governed RPM açıklama satırı
    brakeHtml += '<tr>';
    brakeHtml += '<td colspan="2" style="padding:6px 8px; font-size:var(--fs-tiny); color:var(--text-secondary); background:var(--bg-secondary); line-height:1.4;">Motorun maksimum çalışma devri. Vites değişim mantığı:<br>• <b>Upshift:</b> Motor devri > Governed + 400 olunca üst vitese geçer<br>• <b>Downshift:</b> Motor devri < (Governed + 400) × (i<sub>mevcut</sub> / i<sub>alt</sub>) olunca alt vitese geçer</td>';
    brakeHtml += '</tr>';

    brakeHtml += '</table>';
    brakeHtml += '</div></div>'; // sw-pkg-body + sw-pkg-card
  }

  // ── CHUNK: Özet şeridi — brüt tepe − aksesuar = net tepe ──
  // ÜÇÜ AYNI DEVİRDE okunur (net tepe gücün devri). Ortadaki kayıp, governed
  // devrindeki kayıp DEĞİLDİR: fan kaybı devirle küp ölçeklendiği için tepe
  // devirde daha küçüktür ve − / = ile yazılan aritmetik ancak tek devirde
  // kapanır. Governed kaybı doğrulama başlığında ve metrik tablosunda durur.
  var headHtml = '';
  if(isFullThrottle) {
    var peakSum = veEngPeakSummary(rows, accData, initGoverned);
    var _fig = function(label, val, color) {
      return '<span style="display:inline-flex; gap:5px; align-items:baseline;">' +
             '<span style="font-size:var(--fs-micro); text-transform:uppercase; letter-spacing:0.4px; color:' +
             (color || 'var(--text-muted)') + ';">' + label + '</span>' +
             '<span style="font-family:var(--font-mono); color:' + (color || 'var(--text-primary)') + ';">' +
             val + '</span></span>';
    };
    headHtml += '<div id="ve-eng-headline-' + node.id + '" class="ve-ft-extra" data-node="' + node.id +
                '" style="display:' + (hasData ? 'flex' : 'none') +
                '; align-items:baseline; gap:8px; justify-content:flex-end; font-size:var(--fs-body);' +
                ' padding-bottom:7px; margin-bottom:8px; border-bottom:1px solid var(--border-color);">';
    headHtml += _fig('Brüt tepe', '<span id="ve-eng-m-gp2-' + node.id + '">' +
                (peakSum ? peakSum.grossPower.toFixed(1) : '—') + '</span> kW');
    headHtml += '<span style="color:var(--text-muted);">−</span>';
    headHtml += _fig('Aksesuar', '<span id="ve-eng-m-loss2-' + node.id + '">' +
                (peakSum ? peakSum.loss.toFixed(1) : '—') + '</span> kW', 'var(--accent-warning)');
    headHtml += '<span style="color:var(--text-muted);">=</span>';
    headHtml += _fig('Net tepe', '<span id="ve-eng-m-np2-' + node.id + '">' +
                (peakSum ? peakSum.netPower.toFixed(1) : '—') + '</span> kW', VE_ENG_C.seri2);
    headHtml += '<span style="color:var(--text-muted);">@ <span id="ve-eng-m-rpm2-' + node.id + '">' +
                (peakSum ? peakSum.rpm : '—') + '</span> rpm</span>';
    headHtml += '</div>';
  }

  // ══════════════════════════════════════════════════════════════════════
  // KOMPOZİSYON — Tam Gaz üç sütun (hesap tablosu), Motor Freni iki sütun
  // ══════════════════════════════════════════════════════════════════════
  var html = '<div class="sw-panel ve-cp-panel">';

  if(isFullThrottle) {
    // Motor Seçimi sol sütunun tepesinde (hep görünür). "Veri varsa görünen"
    // içerik her sütunda ayrı bir .ve-ft-extra sarmalayıcısında; üçü birlikte
    // açılıp kapanır (özet şeridi de aynı sarmalayıcı sınıfını taşır).
    html += headHtml;
    html += '<div class="ve-cp-grid ve-cp-grid--sheet">';
    html += '<div class="ve-cp-col ve-cp-col--in">';    // 1) girdi rayı
    html += selectHtml;                                   // Motor Seçimi + placeholder (hep görünür)
    html += '<div class="ve-ft-extra" data-node="' + node.id + '" style="display:' + (hasData ? 'flex' : 'none') + ';">';
    html += specCardHtml + accHtml;
    html += '</div>';
    html += '</div>';
    html += '<div class="ve-cp-col">';                    // 2) veri ızgarası
    html += '<div class="ve-ft-extra" data-node="' + node.id + '" style="display:' + (hasData ? 'flex' : 'none') + ';">';
    html += sheetHtml;
    html += '</div>';
    html += '</div>';
    html += '<div class="ve-cp-col ve-cp-col--out">';   // 3) doğrulama
    html += '<div class="ve-ft-extra" data-node="' + node.id + '" style="display:' + (hasData ? 'flex' : 'none') + ';">';
    html += netHtml;
    html += '</div>';
    html += '</div>';
    html += '</div>';                                     // ve-cp-grid
    // Dipnot da veriye bağlı: boş durumda (motor seçilmeden) yalnız seçim
    // diyaloğu kalsın.
    html += '<div class="sw-footer ve-ft-extra" data-node="' + node.id + '" style="display:' +
            (hasData ? 'block' : 'none') + ';">Brüt tork–güç verisi üreticinin katalog değeridir. ' +
            'Aksesuar kayıpları krank torkuna çevrilip her devirde brüt güçten düşülür; ' +
            'çözücü, vites mantığı ve raporlar net eğriyi kullanır.</div>';
  } else {
    html += '<div class="ve-cp-grid">';
    html += '<div class="ve-cp-col ve-cp-col--in">';    // sol: girdiler
    html += dataAreaHtml + brakeHtml;
    html += '</div>';
    html += '<div class="ve-cp-col ve-cp-col--out">';   // sağ: çıktı
    html += chartHtml + fitHtml;
    html += '</div>';
    html += '</div>';  // ve-cp-grid
  }

  html += '</div>';  // sw-panel
  return html;
}

// Tablo resize fonksiyonları
var veTableResizing = null;

// Veri alanını göster/gizle. Gösterim değeri elemanın KENDİSİNDE (data-show):
// Tam Gaz ızgarası esnek sütun ('flex'), Motor Freni tablosu blok ('block').
// Eskiden üç ayrı çağrı yeri koşulsuz 'block' yazıyordu; ızgara sütunu
// dolduran esnek zincir ilk gizle/göster turunda sessizce kırılırdı.
function veEngShowDataArea(el, show) {
  if(!el) return;
  el.style.display = show ? (el.getAttribute('data-show') || 'block') : 'none';
}

function startVETableResize(e, nodeId) {
  e.preventDefault();
  veTableResizing = {
    nodeId: nodeId,
    startY: e.clientY,
    startHeight: document.getElementById('ve-motor-table-wrapper-' + nodeId).offsetHeight
  };
  document.addEventListener('mousemove', doVETableResize);
  document.addEventListener('mouseup', stopVETableResize);
}

function doVETableResize(e) {
  if(!veTableResizing) return;
  var wrapper = document.getElementById('ve-motor-table-wrapper-' + veTableResizing.nodeId);
  if(!wrapper) return;
  
  var newHeight = veTableResizing.startHeight + (e.clientY - veTableResizing.startY);
  newHeight = Math.max(80, Math.min(400, newHeight)); // 80-400px arası
  // Kullanıcı tutamağa dokunduğu an SEÇİM ONUNDUR: ızgara artık sütunu
  // kendiliğinden doldurmaz, sürüklenen yükseklikte kalır. (Doldurma sınıfı
  // dururken esnek büyüme ile max-height birbiriyle çekişirdi.)
  wrapper.classList.remove('ve-eng-sheet-wrap');
  wrapper.style.maxHeight = newHeight + 'px';
  
  // Node data güncelle
  var node = nodes.find(function(n) { return n.id === veTableResizing.nodeId; });
  if(node) {
    if(!node.data) node.data = {};
    node.data.tableHeight = newHeight;
  }
}

function stopVETableResize() {
  veTableResizing = null;
  document.removeEventListener('mousemove', doVETableResize);
  document.removeEventListener('mouseup', stopVETableResize);
}

// Tam Gaz Hızlanma modülü motor preset'leri (net değerler — aksesuar kayıpları düşülmüş)
// 34 VPA Motor Kataloğu + 2 ek preset = 36 motor
var VE_FT_MOTOR_PRESETS = {
  'azra_i6_3000': {
    name: 'AZRA I6 (3000 Nm) | 3000Nm&448kW',
    specs: {
      displacement: 12.00,
      idleRpm: 550,
      governedSpeed: 2100,
      noLoadGoverned: 2150,
      inertia: 2.8000
    },
    data: [
      {rpm: 550, torque: 750, power: 43.2},
      {rpm: 700, torque: 1356, power: 99.4},
      {rpm: 800, torque: 1777, power: 148.9},
      {rpm: 900, torque: 2234, power: 210.6},
      {rpm: 1000, torque: 2701.4, power: 282.9},
      {rpm: 1100, torque: 3000, power: 345.6},
      {rpm: 1200, torque: 3000, power: 377},
      {rpm: 1300, torque: 2895.6, power: 394.2},
      {rpm: 1400, torque: 2791.2, power: 409.2},
      {rpm: 1500, torque: 2686.8, power: 422.1},
      {rpm: 1600, torque: 2582.4, power: 432.7},
      {rpm: 1700, torque: 2478, power: 441.2},
      {rpm: 1800, torque: 2373.6, power: 447.4},
      {rpm: 1900, torque: 1950, power: 388},
      {rpm: 2000, torque: 1550, power: 324.6},
      {rpm: 2100, torque: 1000, power: 219.9},
      {rpm: 2150, torque: 0, power: 0}
    ],
    accessories: [
      {name: 'Fan (Kavramalı Fan)', standardLoss: 22.4, userLoss: 22.4},
      {name: 'Alternatör / Jeneratör', standardLoss: 2.8, userLoss: 2.8},
      {name: 'Hava Kompresörü', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Direksiyon Pompası', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Klima', standardLoss: 0, userLoss: 0},
      {name: 'Ek Tahrik', standardLoss: 0, userLoss: 0}
    ]
  },
  'azra_i6_2500_studio': {
    name: 'AZRA I6 Base Studio (2500 Nm) | 2500Nm&448kW',
    specs: {
      displacement: 12.00,
      idleRpm: 550,
      governedSpeed: 2100,
      noLoadGoverned: 2150,
      inertia: 2.8000
    },
    data: [
      {rpm: 550, torque: 750, power: 43.2},
      {rpm: 700, torque: 1356, power: 99.4},
      {rpm: 800, torque: 1777, power: 148.9},
      {rpm: 900, torque: 2234, power: 210.6},
      {rpm: 1000, torque: 2500, power: 261.8},
      {rpm: 1100, torque: 2500, power: 288},
      {rpm: 1200, torque: 2500, power: 314.2},
      {rpm: 1300, torque: 2500, power: 340.3},
      {rpm: 1400, torque: 2500, power: 366.5},
      {rpm: 1500, torque: 2500, power: 392.7},
      {rpm: 1600, torque: 2500, power: 418.9},
      {rpm: 1700, torque: 2415, power: 429.9},
      {rpm: 1800, torque: 2282, power: 430.2},
      {rpm: 1900, torque: 1950, power: 388},
      {rpm: 2000, torque: 1550, power: 324.6},
      {rpm: 2100, torque: 1000, power: 219.9},
      {rpm: 2150, torque: 0, power: 0}
    ],
    accessories: [
      {name: 'Fan (Kavramalı Fan)', standardLoss: 22.4, userLoss: 22.4},
      {name: 'Alternatör / Jeneratör', standardLoss: 2.8, userLoss: 2.8},
      {name: 'Hava Kompresörü', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Direksiyon Pompası', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Klima', standardLoss: 0, userLoss: 0},
      {name: 'Ek Tahrik', standardLoss: 0, userLoss: 0}
    ]
  },
  'azra_i6_2500_panter': {
    name: 'AZRA I6 Panter Obüs (2500 Nm) | 2500Nm&448kW',
    specs: {
      displacement: 12.00,
      idleRpm: 550,
      governedSpeed: 2100,
      noLoadGoverned: 2150,
      inertia: 2.8000
    },
    data: [
      {rpm: 550, torque: 750, power: 43.2},
      {rpm: 700, torque: 1356, power: 99.4},
      {rpm: 800, torque: 1777, power: 148.9},
      {rpm: 900, torque: 2175, power: 205},
      {rpm: 1000, torque: 2350, power: 246.1},
      {rpm: 1100, torque: 2500, power: 288},
      {rpm: 1200, torque: 2500, power: 314.2},
      {rpm: 1300, torque: 2500, power: 340.3},
      {rpm: 1400, torque: 2500, power: 366.5},
      {rpm: 1500, torque: 2500, power: 392.7},
      {rpm: 1600, torque: 2500, power: 418.9},
      {rpm: 1700, torque: 2447, power: 435.6},
      {rpm: 1800, torque: 2374, power: 447.5},
      {rpm: 1900, torque: 1950, power: 388},
      {rpm: 2000, torque: 1550, power: 324.6},
      {rpm: 2100, torque: 1000, power: 219.9},
      {rpm: 2150, torque: 0, power: 0}
    ],
    accessories: [
      {name: 'Fan (Kavramalı Fan)', standardLoss: 22.4, userLoss: 22.4},
      {name: 'Alternatör / Jeneratör', standardLoss: 2.8, userLoss: 2.8},
      {name: 'Hava Kompresörü', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Direksiyon Pompası', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Klima', standardLoss: 0, userLoss: 0},
      {name: 'Ek Tahrik', standardLoss: 0, userLoss: 0}
    ]
  },
  'bmc_i4_1600': {
    name: 'BMC Power I4 | 1600Nm&280kW',
    specs: {
      displacement: 8.40,
      idleRpm: 800,
      governedSpeed: 2100,
      noLoadGoverned: 2150,
      inertia: 1.4310
    },
    data: [
      {rpm: 800, torque: 1000, power: 83.8},
      {rpm: 900, torque: 1200, power: 113.1},
      {rpm: 1000, torque: 1400, power: 146.6},
      {rpm: 1100, torque: 1600, power: 184.3},
      {rpm: 1200, torque: 1600, power: 201.1},
      {rpm: 1300, torque: 1600, power: 217.8},
      {rpm: 1400, torque: 1600, power: 234.6},
      {rpm: 1500, torque: 1554, power: 244.1},
      {rpm: 1600, torque: 1508, power: 252.7},
      {rpm: 1700, torque: 1462, power: 260.3},
      {rpm: 1800, torque: 1416, power: 266.9},
      {rpm: 1900, torque: 1370, power: 272.6},
      {rpm: 2000, torque: 1324, power: 277.3},
      {rpm: 2100, torque: 1275, power: 280.4},
      {rpm: 2150, torque: 0, power: 0}
    ],
    accessories: [
      {name: 'Fan (Kavramalı Fan)', standardLoss: 22.4, userLoss: 22.4},
      {name: 'Alternatör / Jeneratör', standardLoss: 2.8, userLoss: 2.8},
      {name: 'Hava Kompresörü', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Direksiyon Pompası', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Klima', standardLoss: 0, userLoss: 0},
      {name: 'Ek Tahrik', standardLoss: 0, userLoss: 0}
    ]
  },
  'isb45_250_fr94257': {
    name: 'ISB4.5 250 | FR94257',
    specs: {
      displacement: 4.50,
      idleRpm: 700,
      governedSpeed: 2590,
      noLoadGoverned: 2895,
      inertia: 0.8000
    },
    data: [
      {rpm: 700, torque: 361, power: 26},
      {rpm: 800, torque: 361, power: 30},
      {rpm: 900, torque: 401, power: 38},
      {rpm: 1000, torque: 450, power: 47},
      {rpm: 1100, torque: 479, power: 55},
      {rpm: 1200, torque: 486, power: 61},
      {rpm: 1300, torque: 590, power: 80},
      {rpm: 1400, torque: 750, power: 110},
      {rpm: 1500, torque: 800, power: 126},
      {rpm: 1800, torque: 800, power: 151},
      {rpm: 1900, torque: 800, power: 159},
      {rpm: 2000, torque: 800, power: 168},
      {rpm: 2100, torque: 790, power: 174},
      {rpm: 2200, torque: 781, power: 180},
      {rpm: 2300, torque: 761, power: 183},
      {rpm: 2400, torque: 740, power: 186},
      {rpm: 2500, torque: 713, power: 187},
      {rpm: 2530, torque: 707, power: 187},
      {rpm: 2590, torque: 545, power: 148},
      {rpm: 2895, torque: 0, power: 0}
    ],
    accessories: [
      {name: 'Fan (Kavramalı Fan)', standardLoss: 22.4, userLoss: 22.4},
      {name: 'Alternatör / Jeneratör', standardLoss: 2.8, userLoss: 2.8},
      {name: 'Hava Kompresörü', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Direksiyon Pompası', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Klima', standardLoss: 0, userLoss: 0},
      {name: 'Ek Tahrik', standardLoss: 0, userLoss: 0}
    ]
  },
  'isb45_210_fr94198': {
    name: 'ISB4.5 210 | FR94198',
    specs: {
      displacement: 4.50,
      idleRpm: 800,
      governedSpeed: 2500,
      noLoadGoverned: 2850,
      inertia: 0.4993
    },
    data: [
      {rpm: 800, torque: 366.0, power: 30.7},
      {rpm: 900, torque: 400.8, power: 37.7},
      {rpm: 1000, torque: 446.0, power: 46.7},
      {rpm: 1100, torque: 495.0, power: 57.0},
      {rpm: 1200, torque: 527.0, power: 66.2},
      {rpm: 1300, torque: 576.0, power: 78.4},
      {rpm: 1400, torque: 702.0, power: 102.9},
      {rpm: 1500, torque: 759.0, power: 119.2},
      {rpm: 1600, torque: 759.0, power: 127.2},
      {rpm: 1700, torque: 759.0, power: 135.1},
      {rpm: 1800, torque: 759.0, power: 143.1},
      {rpm: 1900, torque: 739.0, power: 147.8},
      {rpm: 2000, torque: 719.0, power: 150.6},
      {rpm: 2100, torque: 698.0, power: 153.5},
      {rpm: 2200, torque: 678.0, power: 156.2},
      {rpm: 2300, torque: 650.0, power: 156.6},
      {rpm: 2400, torque: 621.0, power: 156.1},
      {rpm: 2500, torque: 550.0, power: 144.0},
      {rpm: 2530, torque: 515.0, power: 136.4},
      {rpm: 2600, torque: 400.0, power: 108.9},
      {rpm: 2850, torque: 0.0, power: 0.0}
    ],
    accessories: [
      {name: 'Fan (Kavramalı Fan)', standardLoss: 16.1, userLoss: 16.1},
      {name: 'Alternatör / Jeneratör', standardLoss: 1.6, userLoss: 1.6},
      {name: 'Hava Kompresörü', standardLoss: 0.8, userLoss: 0.8},
      {name: 'Direksiyon Pompası', standardLoss: 0.8, userLoss: 0.8},
      {name: 'Klima', standardLoss: 0, userLoss: 0},
      {name: 'Ek Tahrik', standardLoss: 0, userLoss: 0}
    ]
  },
  'isb45e3_185_fr92152': {
    name: 'ISB4.5e3 185 | FR92152',
    specs: {
      displacement: 4.50,
      idleRpm: 1000,
      governedSpeed: 2500,
      noLoadGoverned: 2850,
      inertia: 0.8000
    },
    data: [
      {rpm: 1000, torque: 490, power: 51.3},
      {rpm: 1200, torque: 650, power: 81.7},
      {rpm: 1500, torque: 650, power: 102.1},
      {rpm: 1700, torque: 650, power: 115.7},
      {rpm: 1900, torque: 618, power: 123},
      {rpm: 2100, torque: 585, power: 128.7},
      {rpm: 2400, torque: 536, power: 134.7},
      {rpm: 2500, torque: 520, power: 136.1},
      {rpm: 2850, torque: 0, power: 0}
    ],
    accessories: [
      {name: 'Fan (Kavramalı Fan)', standardLoss: 22.4, userLoss: 22.4},
      {name: 'Alternatör / Jeneratör', standardLoss: 2.8, userLoss: 2.8},
      {name: 'Hava Kompresörü', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Direksiyon Pompası', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Klima', standardLoss: 0, userLoss: 0},
      {name: 'Ek Tahrik', standardLoss: 0, userLoss: 0}
    ]
  },
  'isb45e3_185_fr92154': {
    name: 'ISB4.5e3 185 | FR92154',
    specs: {
      displacement: 4.50,
      idleRpm: 1000,
      governedSpeed: 2500,
      noLoadGoverned: 2850,
      inertia: 0.8000
    },
    data: [
      {rpm: 1000, torque: 490, power: 51.3},
      {rpm: 1200, torque: 550, power: 69.1},
      {rpm: 1500, torque: 550, power: 86.4},
      {rpm: 1700, torque: 550, power: 97.9},
      {rpm: 1900, torque: 543, power: 108},
      {rpm: 2100, torque: 535, power: 117.7},
      {rpm: 2400, torque: 524, power: 131.7},
      {rpm: 2500, torque: 520, power: 136.1},
      {rpm: 2850, torque: 0, power: 0}
    ],
    accessories: [
      {name: 'Fan (Kavramalı Fan)', standardLoss: 22.4, userLoss: 22.4},
      {name: 'Alternatör / Jeneratör', standardLoss: 2.8, userLoss: 2.8},
      {name: 'Hava Kompresörü', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Direksiyon Pompası', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Klima', standardLoss: 0, userLoss: 0},
      {name: 'Ek Tahrik', standardLoss: 0, userLoss: 0}
    ]
  },
  'isb45e5_207_fr92473': {
    name: 'ISB4.5e5 207 | FR92473',
    specs: {
      displacement: 4.50,
      idleRpm: 700,
      governedSpeed: 2525,
      noLoadGoverned: 2850,
      inertia: 0.8000
    },
    data: [
      {rpm: 700, torque: 400, power: 29},
      {rpm: 900, torque: 450, power: 42},
      {rpm: 1000, torque: 550, power: 58},
      {rpm: 1100, torque: 625, power: 72},
      {rpm: 1200, torque: 700, power: 88},
      {rpm: 1400, torque: 760, power: 111},
      {rpm: 1500, torque: 760, power: 119},
      {rpm: 1800, torque: 760, power: 143},
      {rpm: 2000, torque: 705, power: 148},
      {rpm: 2100, torque: 690, power: 152},
      {rpm: 2200, torque: 659, power: 152},
      {rpm: 2300, torque: 632, power: 152},
      {rpm: 2500, torque: 535, power: 140},
      {rpm: 2525, torque: 515, power: 136},
      {rpm: 2850, torque: 0, power: 0}
    ],
    accessories: [
      {name: 'Fan (Kavramalı Fan)', standardLoss: 22.4, userLoss: 22.4},
      {name: 'Alternatör / Jeneratör', standardLoss: 2.8, userLoss: 2.8},
      {name: 'Hava Kompresörü', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Direksiyon Pompası', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Klima', standardLoss: 0, userLoss: 0},
      {name: 'Ek Tahrik', standardLoss: 0, userLoss: 0}
    ]
  },
  'isb67_fr98387': {
    name: 'ISB6.7 - FR98387',
    specs: {
      displacement: 6.70,
      idleRpm: 600,
      governedSpeed: 2800,
      noLoadGoverned: 2830,
      inertia: 0.9562
    },
    data: [
      {rpm: 800, torque: 610.0, power: 51.1},
      {rpm: 900, torque: 695.0, power: 65.5},
      {rpm: 1000, torque: 780.0, power: 81.7},
      {rpm: 1100, torque: 875.0, power: 100.8},
      {rpm: 1200, torque: 1000.0, power: 125.7},
      {rpm: 1300, torque: 1050.0, power: 142.9},
      {rpm: 1400, torque: 1100.0, power: 161.3},
      {rpm: 1500, torque: 1100.0, power: 172.8},
      {rpm: 1600, torque: 1100.0, power: 184.3},
      {rpm: 1700, torque: 1100.0, power: 195.8},
      {rpm: 1800, torque: 1075.0, power: 202.6},
      {rpm: 1900, torque: 1050.0, power: 208.9},
      {rpm: 2000, torque: 1025.0, power: 214.7},
      {rpm: 2100, torque: 1000.0, power: 219.9},
      {rpm: 2200, torque: 985.0, power: 226.9},
      {rpm: 2300, torque: 960.0, power: 231.2},
      {rpm: 2400, torque: 950.0, power: 238.8},
      {rpm: 2500, torque: 940.0, power: 246.1},
      {rpm: 2600, torque: 915.0, power: 249.1},
      {rpm: 2700, torque: 887.5, power: 250.9},
      {rpm: 2800, torque: 860.0, power: 252.2},
      {rpm: 2830, torque: 0, power: 0}
    ],
    accessories: [
      {name: 'Fan (Kavramalı Fan)', standardLoss: 20.2, userLoss: 20.2},
      {name: 'Alternatör / Jeneratör', standardLoss: 2.1, userLoss: 2.1},
      {name: 'Hava Kompresörü', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Direksiyon Pompası', standardLoss: 1.6, userLoss: 1.6},
      {name: 'Klima', standardLoss: 0, userLoss: 0},
      {name: 'Ek Tahrik', standardLoss: 0, userLoss: 0}
    ]
  },
  'isb67e3_185_fr95009': {
    name: 'ISB6.7e3 185 | FR95009',
    specs: {
      displacement: 6.70,
      idleRpm: 800,
      governedSpeed: 2500,
      noLoadGoverned: 2850,
      inertia: 1.2000
    },
    data: [
      {rpm: 800, torque: 600, power: 50.3},
      {rpm: 1000, torque: 650, power: 68.1},
      {rpm: 1200, torque: 700, power: 88},
      {rpm: 1400, torque: 700, power: 102.6},
      {rpm: 1600, torque: 700, power: 117.3},
      {rpm: 1700, torque: 700, power: 124.6},
      {rpm: 1900, torque: 660, power: 131.3},
      {rpm: 2100, torque: 617, power: 135.7},
      {rpm: 2500, torque: 520, power: 136.1},
      {rpm: 2850, torque: 0, power: 0}
    ],
    accessories: [
      {name: 'Fan (Kavramalı Fan)', standardLoss: 22.4, userLoss: 22.4},
      {name: 'Alternatör / Jeneratör', standardLoss: 2.8, userLoss: 2.8},
      {name: 'Hava Kompresörü', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Direksiyon Pompası', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Klima', standardLoss: 0, userLoss: 0},
      {name: 'Ek Tahrik', standardLoss: 0, userLoss: 0}
    ]
  },
  'isb67e3_210_fr95010': {
    name: 'ISB6.7e3 210 | FR95010',
    specs: {
      displacement: 6.70,
      idleRpm: 800,
      governedSpeed: 2500,
      noLoadGoverned: 2850,
      inertia: 1.2000
    },
    data: [
      {rpm: 800, torque: 600, power: 50.3},
      {rpm: 1000, torque: 700, power: 73.3},
      {rpm: 1200, torque: 800, power: 100.5},
      {rpm: 1400, torque: 800, power: 117.3},
      {rpm: 1600, torque: 800, power: 134},
      {rpm: 1700, torque: 800, power: 142.4},
      {rpm: 1900, torque: 748, power: 148.8},
      {rpm: 2100, torque: 694, power: 152.6},
      {rpm: 2500, torque: 590, power: 154.5},
      {rpm: 2850, torque: 0, power: 0}
    ],
    accessories: [
      {name: 'Fan (Kavramalı Fan)', standardLoss: 22.4, userLoss: 22.4},
      {name: 'Alternatör / Jeneratör', standardLoss: 2.8, userLoss: 2.8},
      {name: 'Hava Kompresörü', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Direksiyon Pompası', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Klima', standardLoss: 0, userLoss: 0},
      {name: 'Ek Tahrik', standardLoss: 0, userLoss: 0}
    ]
  },
  'isb67e3_230_fr95011': {
    name: 'ISB6.7e3 230 | FR95011',
    specs: {
      displacement: 6.70,
      idleRpm: 800,
      governedSpeed: 2500,
      noLoadGoverned: 2850,
      inertia: 1.2000
    },
    data: [
      {rpm: 800, torque: 600, power: 50.3},
      {rpm: 1000, torque: 750, power: 78.5},
      {rpm: 1200, torque: 900, power: 113.1},
      {rpm: 1400, torque: 900, power: 132},
      {rpm: 1600, torque: 900, power: 150.8},
      {rpm: 1700, torque: 900, power: 160.2},
      {rpm: 1900, torque: 838, power: 166.7},
      {rpm: 2100, torque: 774, power: 170.2},
      {rpm: 2500, torque: 646, power: 169.1},
      {rpm: 2850, torque: 0, power: 0}
    ],
    accessories: [
      {name: 'Fan (Kavramalı Fan)', standardLoss: 22.4, userLoss: 22.4},
      {name: 'Alternatör / Jeneratör', standardLoss: 2.8, userLoss: 2.8},
      {name: 'Hava Kompresörü', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Direksiyon Pompası', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Klima', standardLoss: 0, userLoss: 0},
      {name: 'Ek Tahrik', standardLoss: 0, userLoss: 0}
    ]
  },
  'isb67e3_245_fr95012': {
    name: 'ISB6.7e3 245 | FR95012',
    specs: {
      displacement: 6.70,
      idleRpm: 800,
      governedSpeed: 2500,
      noLoadGoverned: 2850,
      inertia: 1.2000
    },
    data: [
      {rpm: 800, torque: 600, power: 50.3},
      {rpm: 1000, torque: 750, power: 78.5},
      {rpm: 1200, torque: 925, power: 116.2},
      {rpm: 1400, torque: 925, power: 135.6},
      {rpm: 1600, torque: 925, power: 155},
      {rpm: 1700, torque: 925, power: 164.7},
      {rpm: 1900, torque: 867, power: 172.5},
      {rpm: 2100, torque: 808, power: 177.7},
      {rpm: 2500, torque: 688, power: 180.1},
      {rpm: 2850, torque: 0, power: 0}
    ],
    accessories: [
      {name: 'Fan (Kavramalı Fan)', standardLoss: 22.4, userLoss: 22.4},
      {name: 'Alternatör / Jeneratör', standardLoss: 2.8, userLoss: 2.8},
      {name: 'Hava Kompresörü', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Direksiyon Pompası', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Klima', standardLoss: 0, userLoss: 0},
      {name: 'Ek Tahrik', standardLoss: 0, userLoss: 0}
    ]
  },
  'isb67e3_285_fr95014': {
    name: 'ISB6.7e3 285 | FR95014',
    specs: {
      displacement: 6.70,
      idleRpm: 800,
      governedSpeed: 2500,
      noLoadGoverned: 2850,
      inertia: 1.2000
    },
    data: [
      {rpm: 800, torque: 600, power: 50.3},
      {rpm: 1000, torque: 780, power: 81.7},
      {rpm: 1200, torque: 970, power: 121.9},
      {rpm: 1400, torque: 970, power: 142.2},
      {rpm: 1600, torque: 970, power: 162.5},
      {rpm: 1700, torque: 970, power: 172.7},
      {rpm: 1900, torque: 928, power: 184.6},
      {rpm: 2100, torque: 886, power: 194.8},
      {rpm: 2500, torque: 801, power: 209.7},
      {rpm: 2850, torque: 0, power: 0}
    ],
    accessories: [
      {name: 'Fan (Kavramalı Fan)', standardLoss: 22.4, userLoss: 22.4},
      {name: 'Alternatör / Jeneratör', standardLoss: 2.8, userLoss: 2.8},
      {name: 'Hava Kompresörü', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Direksiyon Pompası', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Klima', standardLoss: 0, userLoss: 0},
      {name: 'Ek Tahrik', standardLoss: 0, userLoss: 0}
    ]
  },
  'isb67e3_360_fr93831': {
    name: 'ISB6.7e3 360 | FR93831',
    specs: {
      displacement: 6.70,
      idleRpm: 800,
      governedSpeed: 2630,
      noLoadGoverned: 2900,
      inertia: 1.2000
    },
    data: [
      {rpm: 800, torque: 670, power: 56},
      {rpm: 900, torque: 752, power: 71},
      {rpm: 1000, torque: 859, power: 90},
      {rpm: 1100, torque: 952, power: 110},
      {rpm: 1200, torque: 1000, power: 126},
      {rpm: 1400, torque: 1100, power: 161},
      {rpm: 1700, torque: 1100, power: 196},
      {rpm: 2000, torque: 1100, power: 230},
      {rpm: 2300, torque: 1100, power: 265},
      {rpm: 2400, torque: 1070, power: 269},
      {rpm: 2500, torque: 1027, power: 269},
      {rpm: 2600, torque: 985, power: 268},
      {rpm: 2630, torque: 930, power: 256},
      {rpm: 2900, torque: 0, power: 0}
    ],
    accessories: [
      {name: 'Fan (Kavramalı Fan)', standardLoss: 22.4, userLoss: 22.4},
      {name: 'Alternatör / Jeneratör', standardLoss: 2.8, userLoss: 2.8},
      {name: 'Hava Kompresörü', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Direksiyon Pompası', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Klima', standardLoss: 0, userLoss: 0},
      {name: 'Ek Tahrik', standardLoss: 0, userLoss: 0}
    ]
  },
  'isb67e3_360_fr97819': {
    name: 'ISB6.7e3 360 | FR97819',
    specs: {
      displacement: 6.70,
      idleRpm: 800,
      governedSpeed: 2630,
      noLoadGoverned: 2900,
      inertia: 1.2000
    },
    data: [
      {rpm: 800, torque: 670, power: 56},
      {rpm: 900, torque: 752, power: 71},
      {rpm: 1000, torque: 859, power: 90},
      {rpm: 1100, torque: 952, power: 110},
      {rpm: 1200, torque: 1000, power: 126},
      {rpm: 1400, torque: 1100, power: 161},
      {rpm: 1700, torque: 1100, power: 196},
      {rpm: 2000, torque: 1100, power: 230},
      {rpm: 2300, torque: 1100, power: 265},
      {rpm: 2400, torque: 1070, power: 269},
      {rpm: 2500, torque: 1027, power: 269},
      {rpm: 2600, torque: 985, power: 268},
      {rpm: 2630, torque: 930, power: 256},
      {rpm: 2900, torque: 0, power: 0}
    ],
    accessories: [
      {name: 'Fan (Kavramalı Fan)', standardLoss: 22.4, userLoss: 22.4},
      {name: 'Alternatör / Jeneratör', standardLoss: 2.8, userLoss: 2.8},
      {name: 'Hava Kompresörü', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Direksiyon Pompası', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Klima', standardLoss: 0, userLoss: 0},
      {name: 'Ek Tahrik', standardLoss: 0, userLoss: 0}
    ]
  },
  'isb67e3_360_fr97819_d2000': {
    name: 'ISB6.7e3 360 | FR97819 derate 2000m',
    specs: {
      displacement: 6.70,
      idleRpm: 800,
      governedSpeed: 2630,
      noLoadGoverned: 2900,
      inertia: 1.2000
    },
    data: [
      {rpm: 800, torque: 670, power: 56.1},
      {rpm: 900, torque: 730, power: 68.8},
      {rpm: 1000, torque: 800, power: 83.8},
      {rpm: 1100, torque: 950, power: 109.4},
      {rpm: 1200, torque: 1000, power: 125.7},
      {rpm: 1300, torque: 1050, power: 142.9},
      {rpm: 1400, torque: 1100, power: 161.3},
      {rpm: 1500, torque: 1100, power: 172.8},
      {rpm: 1600, torque: 1068, power: 179},
      {rpm: 1700, torque: 1036, power: 184.4},
      {rpm: 1800, torque: 1004, power: 189.3},
      {rpm: 1900, torque: 1021, power: 203.2},
      {rpm: 2000, torque: 1029, power: 215.5},
      {rpm: 2100, torque: 1044, power: 229.6},
      {rpm: 2200, torque: 982, power: 226.2},
      {rpm: 2300, torque: 965, power: 232.4},
      {rpm: 2400, torque: 887, power: 222.9},
      {rpm: 2630, torque: 750, power: 206.6},
      {rpm: 2900, torque: 0, power: 0}
    ],
    accessories: [
      {name: 'Fan (Kavramalı Fan)', standardLoss: 22.4, userLoss: 22.4},
      {name: 'Alternatör / Jeneratör', standardLoss: 2.8, userLoss: 2.8},
      {name: 'Hava Kompresörü', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Direksiyon Pompası', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Klima', standardLoss: 0, userLoss: 0},
      {name: 'Ek Tahrik', standardLoss: 0, userLoss: 0}
    ]
  },
  'isb67ex_300_fr93522': {
    name: 'ISB6.7ex 300 | FR93522',
    specs: {
      displacement: 6.70,
      idleRpm: 800,
      governedSpeed: 2800,
      noLoadGoverned: 3000,
      inertia: 1.2000
    },
    data: [
      {rpm: 800, torque: 695, power: 58},
      {rpm: 1000, torque: 731, power: 77},
      {rpm: 1200, torque: 813, power: 102},
      {rpm: 1400, torque: 813, power: 119},
      {rpm: 1600, torque: 813, power: 136},
      {rpm: 1800, torque: 813, power: 153},
      {rpm: 2000, torque: 813, power: 179},
      {rpm: 2200, torque: 813, power: 187},
      {rpm: 2400, torque: 813, power: 204},
      {rpm: 2500, torque: 813, power: 213},
      {rpm: 2600, torque: 813, power: 221},
      {rpm: 2700, torque: 755, power: 213},
      {rpm: 2800, torque: 719, power: 211},
      {rpm: 3000, torque: 0, power: 0}
    ],
    accessories: [
      {name: 'Fan (Kavramalı Fan)', standardLoss: 22.4, userLoss: 22.4},
      {name: 'Alternatör / Jeneratör', standardLoss: 2.8, userLoss: 2.8},
      {name: 'Hava Kompresörü', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Direksiyon Pompası', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Klima', standardLoss: 0, userLoss: 0},
      {name: 'Ek Tahrik', standardLoss: 0, userLoss: 0}
    ]
  },
  'isg12e3_380_fr20522': {
    name: 'ISG12e3 380 | FR20522',
    specs: {
      displacement: 11.80,
      idleRpm: 1000,
      governedSpeed: 1900,
      noLoadGoverned: 2100,
      inertia: 2.5000
    },
    data: [
      {rpm: 1000, torque: 2000, power: 209.4},
      {rpm: 1100, torque: 2000, power: 230.4},
      {rpm: 1200, torque: 2000, power: 251.3},
      {rpm: 1300, torque: 2000, power: 272.3},
      {rpm: 1400, torque: 1931, power: 283.1},
      {rpm: 1500, torque: 1803, power: 283.2},
      {rpm: 1600, torque: 1690, power: 283.2},
      {rpm: 1700, torque: 1591, power: 283.2},
      {rpm: 1800, torque: 1502, power: 283.1},
      {rpm: 1900, torque: 1405, power: 279.6},
      {rpm: 2100, torque: 0, power: 0}
    ],
    accessories: [
      {name: 'Fan (Kavramalı Fan)', standardLoss: 22.4, userLoss: 22.4},
      {name: 'Alternatör / Jeneratör', standardLoss: 2.8, userLoss: 2.8},
      {name: 'Hava Kompresörü', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Direksiyon Pompası', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Klima', standardLoss: 0, userLoss: 0},
      {name: 'Ek Tahrik', standardLoss: 0, userLoss: 0}
    ]
  },
  'isg12e3_400_fr20523': {
    name: 'ISG12e3 400 | FR20523',
    specs: {
      displacement: 11.80,
      idleRpm: 1000,
      governedSpeed: 1900,
      noLoadGoverned: 2100,
      inertia: 2.5000
    },
    data: [
      {rpm: 1000, torque: 2000, power: 209.4},
      {rpm: 1100, torque: 2000, power: 230.4},
      {rpm: 1200, torque: 2000, power: 251.3},
      {rpm: 1300, torque: 2000, power: 272.3},
      {rpm: 1400, torque: 2000, power: 293.2},
      {rpm: 1500, torque: 1896, power: 297.8},
      {rpm: 1600, torque: 1778, power: 297.9},
      {rpm: 1700, torque: 1673, power: 297.8},
      {rpm: 1800, torque: 1580, power: 297.8},
      {rpm: 1900, torque: 1479, power: 294.3},
      {rpm: 2100, torque: 0, power: 0}
    ],
    accessories: [
      {name: 'Fan (Kavramalı Fan)', standardLoss: 22.4, userLoss: 22.4},
      {name: 'Alternatör / Jeneratör', standardLoss: 2.8, userLoss: 2.8},
      {name: 'Hava Kompresörü', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Direksiyon Pompası', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Klima', standardLoss: 0, userLoss: 0},
      {name: 'Ek Tahrik', standardLoss: 0, userLoss: 0}
    ]
  },
  'isg12e3_430_fr20547': {
    name: 'ISG12e3 430 | FR20547',
    specs: {
      displacement: 11.80,
      idleRpm: 1000,
      governedSpeed: 1900,
      noLoadGoverned: 2100,
      inertia: 2.5000
    },
    data: [
      {rpm: 1000, torque: 2000, power: 209.4},
      {rpm: 1100, torque: 2000, power: 230.4},
      {rpm: 1200, torque: 2000, power: 251.3},
      {rpm: 1300, torque: 2000, power: 272.3},
      {rpm: 1400, torque: 2000, power: 293.2},
      {rpm: 1500, torque: 1955, power: 307.1},
      {rpm: 1600, torque: 1909, power: 319.9},
      {rpm: 1700, torque: 1797, power: 319.9},
      {rpm: 1800, torque: 1697, power: 319.9},
      {rpm: 1900, torque: 1589, power: 316.2},
      {rpm: 2100, torque: 0, power: 0}
    ],
    accessories: [
      {name: 'Fan (Kavramalı Fan)', standardLoss: 22.4, userLoss: 22.4},
      {name: 'Alternatör / Jeneratör', standardLoss: 2.8, userLoss: 2.8},
      {name: 'Hava Kompresörü', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Direksiyon Pompası', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Klima', standardLoss: 0, userLoss: 0},
      {name: 'Ek Tahrik', standardLoss: 0, userLoss: 0}
    ]
  },
  'isl89e3_375_fr94882': {
    name: 'ISL8.9e3 375 | FR94882',
    specs: {
      displacement: 8.90,
      idleRpm: 800,
      governedSpeed: 2100,
      noLoadGoverned: 2330,
      inertia: 1.6000
    },
    data: [
      {rpm: 800, torque: 950, power: 79.6},
      {rpm: 1000, torque: 1356, power: 142},
      {rpm: 1100, torque: 1550, power: 178.6},
      {rpm: 1200, torque: 1550, power: 194.8},
      {rpm: 1400, torque: 1550, power: 227.2},
      {rpm: 1500, torque: 1508, power: 236.9},
      {rpm: 1600, torque: 1466, power: 245.6},
      {rpm: 1700, torque: 1424, power: 253.5},
      {rpm: 1800, torque: 1380, power: 260.1},
      {rpm: 1900, torque: 1338, power: 266.2},
      {rpm: 2000, torque: 1296, power: 271.4},
      {rpm: 2100, torque: 1250, power: 274.9},
      {rpm: 2330, torque: 0, power: 0}
    ],
    accessories: [
      {name: 'Fan (Kavramalı Fan)', standardLoss: 22.4, userLoss: 22.4},
      {name: 'Alternatör / Jeneratör', standardLoss: 2.8, userLoss: 2.8},
      {name: 'Hava Kompresörü', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Direksiyon Pompası', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Klima', standardLoss: 0, userLoss: 0},
      {name: 'Ek Tahrik', standardLoss: 0, userLoss: 0}
    ]
  },
  'isle_t450_fr92598': {
    name: 'ISLe-T450 | FR92598',
    specs: {
      displacement: 8.90,
      idleRpm: 800,
      governedSpeed: 2200,
      noLoadGoverned: 2400,
      inertia: 1.6000
    },
    data: [
      {rpm: 800, torque: 1287, power: 107.8},
      {rpm: 900, torque: 1355, power: 127.7},
      {rpm: 1000, torque: 1423, power: 149},
      {rpm: 1100, torque: 1491, power: 171.8},
      {rpm: 1200, torque: 1559, power: 195.9},
      {rpm: 1300, torque: 1627, power: 221.5},
      {rpm: 1400, torque: 1627, power: 238.5},
      {rpm: 1500, torque: 1627, power: 255.6},
      {rpm: 1600, torque: 1603, power: 268.6},
      {rpm: 1700, torque: 1579, power: 281.1},
      {rpm: 1800, torque: 1555, power: 293.1},
      {rpm: 1900, torque: 1530, power: 304.4},
      {rpm: 2000, torque: 1506, power: 315.4},
      {rpm: 2100, torque: 1482, power: 325.9},
      {rpm: 2200, torque: 1458, power: 335.9},
      {rpm: 2400, torque: 0, power: 0}
    ],
    accessories: [
      {name: 'Fan (Kavramalı Fan)', standardLoss: 22.4, userLoss: 22.4},
      {name: 'Alternatör / Jeneratör', standardLoss: 2.8, userLoss: 2.8},
      {name: 'Hava Kompresörü', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Direksiyon Pompası', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Klima', standardLoss: 0, userLoss: 0},
      {name: 'Ek Tahrik', standardLoss: 0, userLoss: 0}
    ]
  },
  'isle3_400_fr95441': {
    name: 'ISLe3 400 | FR95441',
    specs: {
      displacement: 8.90,
      idleRpm: 700,
      governedSpeed: 2100,
      noLoadGoverned: 2330,
      inertia: 1.6000
    },
    data: [
      {rpm: 700, torque: 700, power: 51.3},
      {rpm: 800, torque: 950, power: 79.6},
      {rpm: 900, torque: 1153, power: 108.7},
      {rpm: 1000, torque: 1356, power: 142},
      {rpm: 1100, torque: 1550, power: 178.6},
      {rpm: 1200, torque: 1550, power: 194.8},
      {rpm: 1300, torque: 1550, power: 211},
      {rpm: 1400, torque: 1550, power: 227.2},
      {rpm: 1500, torque: 1508, power: 236.9},
      {rpm: 1600, torque: 1466, power: 245.6},
      {rpm: 1700, torque: 1424, power: 253.5},
      {rpm: 1800, torque: 1405, power: 264.8},
      {rpm: 1900, torque: 1389, power: 276.4},
      {rpm: 2000, torque: 1410, power: 295.3},
      {rpm: 2100, torque: 1355, power: 298},
      {rpm: 2330, torque: 0, power: 0}
    ],
    accessories: [
      {name: 'Fan (Kavramalı Fan)', standardLoss: 22.4, userLoss: 22.4},
      {name: 'Alternatör / Jeneratör', standardLoss: 2.8, userLoss: 2.8},
      {name: 'Hava Kompresörü', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Direksiyon Pompası', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Klima', standardLoss: 0, userLoss: 0},
      {name: 'Ek Tahrik', standardLoss: 0, userLoss: 0}
    ]
  },
  'ism_500_fr21020': {
    name: 'ISM 500 | FR21020',
    specs: {
      displacement: 10.80,
      idleRpm: 1100,
      governedSpeed: 2100,
      noLoadGoverned: 2300,
      inertia: 2.2000
    },
    data: [
      {rpm: 1100, torque: 1831, power: 210.9},
      {rpm: 1200, torque: 2102, power: 264.2},
      {rpm: 1300, torque: 2102, power: 286.2},
      {rpm: 1400, torque: 2102, power: 308.2},
      {rpm: 1500, torque: 2102, power: 330.2},
      {rpm: 1600, torque: 2102, power: 352.2},
      {rpm: 1700, torque: 2041, power: 363.4},
      {rpm: 1800, torque: 1980, power: 373.2},
      {rpm: 1900, torque: 1837, power: 365.5},
      {rpm: 2000, torque: 1709, power: 357.9},
      {rpm: 2100, torque: 1593, power: 350.3},
      {rpm: 2300, torque: 0, power: 0}
    ],
    accessories: [
      {name: 'Fan (Kavramalı Fan)', standardLoss: 22.4, userLoss: 22.4},
      {name: 'Alternatör / Jeneratör', standardLoss: 2.8, userLoss: 2.8},
      {name: 'Hava Kompresörü', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Direksiyon Pompası', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Klima', standardLoss: 0, userLoss: 0},
      {name: 'Ek Tahrik', standardLoss: 0, userLoss: 0}
    ]
  },
  'isme2_380_fr2695': {
    name: 'ISMe2 380 | FR2695',
    specs: {
      displacement: 10.80,
      idleRpm: 1000,
      governedSpeed: 1900,
      noLoadGoverned: 2130,
      inertia: 2.2000
    },
    data: [
      {rpm: 1000, torque: 1560, power: 163.4},
      {rpm: 1100, torque: 1763, power: 203.1},
      {rpm: 1200, torque: 1825, power: 229.3},
      {rpm: 1300, torque: 1817, power: 247.4},
      {rpm: 1400, torque: 1776, power: 260.4},
      {rpm: 1500, torque: 1708, power: 268.3},
      {rpm: 1600, torque: 1634, power: 273.8},
      {rpm: 1700, torque: 1558, power: 277.4},
      {rpm: 1800, torque: 1479, power: 278.8},
      {rpm: 1900, torque: 1406, power: 279.8},
      {rpm: 2130, torque: 0, power: 0}
    ],
    accessories: [
      {name: 'Fan (Kavramalı Fan)', standardLoss: 22.4, userLoss: 22.4},
      {name: 'Alternatör / Jeneratör', standardLoss: 2.8, userLoss: 2.8},
      {name: 'Hava Kompresörü', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Direksiyon Pompası', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Klima', standardLoss: 0, userLoss: 0},
      {name: 'Ek Tahrik', standardLoss: 0, userLoss: 0}
    ]
  },
  'isme2_440_fr2578': {
    name: 'ISMe2 440 | FR2578',
    specs: {
      displacement: 10.80,
      idleRpm: 800,
      governedSpeed: 1900,
      noLoadGoverned: 2130,
      inertia: 2.2000
    },
    data: [
      {rpm: 800, torque: 1250, power: 104.7},
      {rpm: 900, torque: 1464, power: 138},
      {rpm: 1000, torque: 1695, power: 177.5},
      {rpm: 1100, torque: 1910, power: 220},
      {rpm: 1200, torque: 2100, power: 263.9},
      {rpm: 1300, torque: 2100, power: 285.9},
      {rpm: 1400, torque: 2040, power: 299.1},
      {rpm: 1500, torque: 1975, power: 310.2},
      {rpm: 1600, torque: 1885, power: 315.8},
      {rpm: 1700, torque: 1798, power: 320.1},
      {rpm: 1800, torque: 1717, power: 323.7},
      {rpm: 1900, torque: 1600, power: 318.4},
      {rpm: 2130, torque: 0, power: 0}
    ],
    accessories: [
      {name: 'Fan (Kavramalı Fan)', standardLoss: 22.4, userLoss: 22.4},
      {name: 'Alternatör / Jeneratör', standardLoss: 2.8, userLoss: 2.8},
      {name: 'Hava Kompresörü', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Direksiyon Pompası', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Klima', standardLoss: 0, userLoss: 0},
      {name: 'Ek Tahrik', standardLoss: 0, userLoss: 0}
    ]
  },
  'isme3_385_fr20317': {
    name: 'ISMe3 385 | FR20317',
    specs: {
      displacement: 10.80,
      idleRpm: 1000,
      governedSpeed: 1900,
      noLoadGoverned: 2130,
      inertia: 2.2000
    },
    data: [
      {rpm: 1000, torque: 1572, power: 164},
      {rpm: 1100, torque: 1775, power: 204},
      {rpm: 1200, torque: 1835, power: 230},
      {rpm: 1300, torque: 1830, power: 249},
      {rpm: 1400, torque: 1790, power: 262},
      {rpm: 1500, torque: 1724, power: 270},
      {rpm: 1600, torque: 1652, power: 277},
      {rpm: 1700, torque: 1578, power: 281},
      {rpm: 1800, torque: 1501, power: 283},
      {rpm: 1900, torque: 1431, power: 283},
      {rpm: 2130, torque: 0, power: 0}
    ],
    accessories: [
      {name: 'Fan (Kavramalı Fan)', standardLoss: 22.4, userLoss: 22.4},
      {name: 'Alternatör / Jeneratör', standardLoss: 2.8, userLoss: 2.8},
      {name: 'Hava Kompresörü', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Direksiyon Pompası', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Klima', standardLoss: 0, userLoss: 0},
      {name: 'Ek Tahrik', standardLoss: 0, userLoss: 0}
    ]
  },
  'isme3_385_fr2855': {
    name: 'ISMe3 385 | FR2855',
    specs: {
      displacement: 10.80,
      idleRpm: 1000,
      governedSpeed: 1900,
      noLoadGoverned: 2130,
      inertia: 2.2000
    },
    data: [
      {rpm: 1000, torque: 1572, power: 164},
      {rpm: 1100, torque: 1775, power: 204},
      {rpm: 1200, torque: 1835, power: 230},
      {rpm: 1300, torque: 1830, power: 249},
      {rpm: 1400, torque: 1790, power: 262},
      {rpm: 1500, torque: 1724, power: 270},
      {rpm: 1600, torque: 1652, power: 277},
      {rpm: 1700, torque: 1578, power: 281},
      {rpm: 1800, torque: 1501, power: 283},
      {rpm: 1900, torque: 1431, power: 283},
      {rpm: 2130, torque: 0, power: 0}
    ],
    accessories: [
      {name: 'Fan (Kavramalı Fan)', standardLoss: 22.4, userLoss: 22.4},
      {name: 'Alternatör / Jeneratör', standardLoss: 2.8, userLoss: 2.8},
      {name: 'Hava Kompresörü', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Direksiyon Pompası', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Klima', standardLoss: 0, userLoss: 0},
      {name: 'Ek Tahrik', standardLoss: 0, userLoss: 0}
    ]
  },
  'isme3_420_fr2854': {
    name: 'ISMe3 420 | FR2854',
    specs: {
      displacement: 10.80,
      idleRpm: 1000,
      governedSpeed: 1900,
      noLoadGoverned: 2130,
      inertia: 2.2000
    },
    data: [
      {rpm: 1000, torque: 1707, power: 178.7},
      {rpm: 1100, torque: 1922, power: 221.4},
      {rpm: 1200, torque: 2010, power: 252.6},
      {rpm: 1300, torque: 1974, power: 268.7},
      {rpm: 1400, torque: 1942, power: 284.7},
      {rpm: 1500, torque: 1891, power: 297},
      {rpm: 1600, torque: 1785, power: 299.1},
      {rpm: 1700, torque: 1692, power: 301.2},
      {rpm: 1800, torque: 1607, power: 302.9},
      {rpm: 1900, torque: 1541, power: 306.6},
      {rpm: 2130, torque: 0, power: 0}
    ],
    accessories: [
      {name: 'Fan (Kavramalı Fan)', standardLoss: 22.4, userLoss: 22.4},
      {name: 'Alternatör / Jeneratör', standardLoss: 2.8, userLoss: 2.8},
      {name: 'Hava Kompresörü', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Direksiyon Pompası', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Klima', standardLoss: 0, userLoss: 0},
      {name: 'Ek Tahrik', standardLoss: 0, userLoss: 0}
    ]
  },
  'ism_380_fr20317': {
    name: 'ISM 380 | FR20317',
    specs: {
      displacement: 10.80,
      idleRpm: 1000,
      governedSpeed: 1900,
      noLoadGoverned: 2130,
      inertia: 2.2000
    },
    data: [
      {rpm: 1000, torque: 1530.7, power: 160.3},
      {rpm: 1100, torque: 1736.2, power: 200.0},
      {rpm: 1200, torque: 1798.2, power: 226.0},
      {rpm: 1300, torque: 1794.9, power: 244.4},
      {rpm: 1400, torque: 1756.4, power: 257.5},
      {rpm: 1500, torque: 1691.7, power: 265.7},
      {rpm: 1600, torque: 1620.8, power: 271.6},
      {rpm: 1700, torque: 1547.8, power: 275.6},
      {rpm: 1800, torque: 1471.7, power: 277.4},
      {rpm: 1900, torque: 1402.5, power: 279.1},
      {rpm: 2130, torque: 0, power: 0}
    ],
    accessories: [
      {name: 'Fan (Kavramalı Fan)', standardLoss: 0, userLoss: 0},
      {name: 'Alternatör / Jeneratör', standardLoss: 0, userLoss: 0},
      {name: 'Hava Kompresörü', standardLoss: 0, userLoss: 0},
      {name: 'Direksiyon Pompası', standardLoss: 0, userLoss: 0},
      {name: 'Klima', standardLoss: 0, userLoss: 0},
      {name: 'Ek Tahrik', standardLoss: 0, userLoss: 0}
    ]
  },
  'isl_330': {
    name: 'ISL 330',
    specs: {
      displacement: 8.90,
      idleRpm: 1200,
      governedSpeed: 2200,
      noLoadGoverned: 2400,
      inertia: 1.8000
    },
    data: [
      {rpm: 1200, torque: 1385.9, power: 174.2},
      {rpm: 1300, torque: 1461.9, power: 199.0},
      {rpm: 1400, torque: 1461.8, power: 214.3},
      {rpm: 1500, torque: 1430.3, power: 224.7},
      {rpm: 1600, torque: 1377.0, power: 230.7},
      {rpm: 1700, torque: 1356.9, power: 241.6},
      {rpm: 1900, torque: 1164.1, power: 231.6},
      {rpm: 2000, torque: 1073.5, power: 224.8},
      {rpm: 2200, torque: 883.9, power: 203.6},
      {rpm: 2400, torque: 0, power: 0}
    ],
    accessories: [
      {name: 'Fan (Kavramalı Fan)', standardLoss: 0, userLoss: 0},
      {name: 'Alternatör / Jeneratör', standardLoss: 0, userLoss: 0},
      {name: 'Hava Kompresörü', standardLoss: 0, userLoss: 0},
      {name: 'Direksiyon Pompası', standardLoss: 0, userLoss: 0},
      {name: 'Klima', standardLoss: 0, userLoss: 0},
      {name: 'Ek Tahrik', standardLoss: 0, userLoss: 0}
    ]
  },
  'isx_525_fr11926': {
    name: 'ISX 525 | FR11926',
    specs: {
      displacement: 15.00,
      idleRpm: 600,
      governedSpeed: 2000,
      noLoadGoverned: 2030,
      inertia: 3.0000
    },
    data: [
      {rpm: 600, torque: 1245, power: 78},
      {rpm: 700, torque: 1384, power: 101},
      {rpm: 800, torque: 1513, power: 127},
      {rpm: 900, torque: 1695, power: 160},
      {rpm: 965, torque: 1790, power: 181},
      {rpm: 1000, torque: 1871, power: 196},
      {rpm: 1100, torque: 2237, power: 258},
      {rpm: 1200, torque: 2237, power: 281},
      {rpm: 1300, torque: 2237, power: 305},
      {rpm: 1400, torque: 2237, power: 328},
      {rpm: 1500, torque: 2237, power: 351},
      {rpm: 1600, torque: 2237, power: 375},
      {rpm: 1700, torque: 2224, power: 396},
      {rpm: 1800, torque: 2101, power: 396},
      {rpm: 1900, torque: 1979, power: 394},
      {rpm: 2000, torque: 1868, power: 391},
      {rpm: 2030, torque: 0, power: 0}
    ],
    accessories: [
      {name: 'Fan (Kavramalı Fan)', standardLoss: 22.4, userLoss: 22.4},
      {name: 'Alternatör / Jeneratör', standardLoss: 2.8, userLoss: 2.8},
      {name: 'Hava Kompresörü', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Direksiyon Pompası', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Klima', standardLoss: 0, userLoss: 0},
      {name: 'Ek Tahrik', standardLoss: 0, userLoss: 0}
    ]
  },
  'isx_sig600_fr10149': {
    name: 'ISX Sig600 | FR10149',
    specs: {
      displacement: 15.00,
      idleRpm: 1100,
      governedSpeed: 2000,
      noLoadGoverned: 2030,
      inertia: 3.0000
    },
    data: [
      {rpm: 1100, torque: 2780, power: 320.2},
      {rpm: 1200, torque: 2780, power: 349.4},
      {rpm: 1300, torque: 2780, power: 378.5},
      {rpm: 1400, torque: 2780, power: 407.6},
      {rpm: 1500, torque: 2732, power: 429.2},
      {rpm: 1600, torque: 2679, power: 448.9},
      {rpm: 1700, torque: 2613, power: 465.2},
      {rpm: 1800, torque: 2496, power: 470.5},
      {rpm: 1900, torque: 2317, power: 461},
      {rpm: 2000, torque: 2137, power: 447.6},
      {rpm: 2030, torque: 0, power: 0}
    ],
    accessories: [
      {name: 'Fan (Kavramalı Fan)', standardLoss: 22.4, userLoss: 22.4},
      {name: 'Alternatör / Jeneratör', standardLoss: 2.8, userLoss: 2.8},
      {name: 'Hava Kompresörü', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Direksiyon Pompası', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Klima', standardLoss: 0, userLoss: 0},
      {name: 'Ek Tahrik', standardLoss: 0, userLoss: 0}
    ]
  },
  'isx15_600_fr11779': {
    name: 'ISX15 600 | FR11779',
    specs: {
      displacement: 15.00,
      idleRpm: 600,
      governedSpeed: 2000,
      noLoadGoverned: 2030,
      inertia: 3.0000
    },
    data: [
      {rpm: 600, torque: 1245, power: 78.2},
      {rpm: 700, torque: 1384, power: 101.5},
      {rpm: 800, torque: 1513, power: 126.8},
      {rpm: 900, torque: 1695, power: 159.8},
      {rpm: 965, torque: 1830, power: 184.9},
      {rpm: 1000, torque: 1966, power: 205.9},
      {rpm: 1100, torque: 2508, power: 288.9},
      {rpm: 1200, torque: 2508, power: 315.2},
      {rpm: 1400, torque: 2508, power: 367.7},
      {rpm: 1500, torque: 2508, power: 394},
      {rpm: 1600, torque: 2508, power: 420.2},
      {rpm: 1700, torque: 2429, power: 432.4},
      {rpm: 1800, torque: 2314, power: 436.2},
      {rpm: 1900, torque: 2230, power: 443.7},
      {rpm: 2000, torque: 2137, power: 447.6},
      {rpm: 2030, torque: 0, power: 0}
    ],
    accessories: [
      {name: 'Fan (Kavramalı Fan)', standardLoss: 22.4, userLoss: 22.4},
      {name: 'Alternatör / Jeneratör', standardLoss: 2.8, userLoss: 2.8},
      {name: 'Hava Kompresörü', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Direksiyon Pompası', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Klima', standardLoss: 0, userLoss: 0},
      {name: 'Ek Tahrik', standardLoss: 0, userLoss: 0}
    ]
  },
  'isx15_600_fr11860': {
    name: 'ISX15 600 | FR11860',
    specs: {
      displacement: 15.00,
      idleRpm: 600,
      governedSpeed: 2000,
      noLoadGoverned: 2030,
      inertia: 3.0000
    },
    data: [
      {rpm: 600, torque: 1245, power: 78.2},
      {rpm: 700, torque: 1383, power: 101.4},
      {rpm: 800, torque: 1695, power: 142},
      {rpm: 900, torque: 1966, power: 185.3},
      {rpm: 983, torque: 2229, power: 229.5},
      {rpm: 1150, torque: 2779, power: 334.7},
      {rpm: 1200, torque: 3000, power: 377},
      {rpm: 1300, torque: 2847, power: 387.6},
      {rpm: 1400, torque: 2712, power: 397.6},
      {rpm: 1500, torque: 2644, power: 415.3},
      {rpm: 1600, torque: 2576, power: 431.6},
      {rpm: 1700, torque: 2508, power: 446.5},
      {rpm: 1800, torque: 2434, power: 458.8},
      {rpm: 1900, torque: 2285, power: 454.7},
      {rpm: 2000, torque: 2137, power: 447.6},
      {rpm: 2030, torque: 0, power: 0}
    ],
    accessories: [
      {name: 'Fan (Kavramalı Fan)', standardLoss: 22.4, userLoss: 22.4},
      {name: 'Alternatör / Jeneratör', standardLoss: 2.8, userLoss: 2.8},
      {name: 'Hava Kompresörü', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Direksiyon Pompası', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Klima', standardLoss: 0, userLoss: 0},
      {name: 'Ek Tahrik', standardLoss: 0, userLoss: 0}
    ]
  },
  'isx15_675_fr12042': {
    name: 'ISX15 675 | FR12042',
    specs: {
      displacement: 15.00,
      idleRpm: 600,
      governedSpeed: 2000,
      noLoadGoverned: 2030,
      inertia: 3.0000
    },
    data: [
      {rpm: 600, torque: 1245, power: 78},
      {rpm: 700, torque: 1384, power: 101},
      {rpm: 800, torque: 1513, power: 127},
      {rpm: 900, torque: 1695, power: 160},
      {rpm: 965, torque: 1830, power: 185},
      {rpm: 1000, torque: 1966, power: 206},
      {rpm: 1100, torque: 2779, power: 320},
      {rpm: 1200, torque: 2779, power: 349},
      {rpm: 1300, torque: 2779, power: 378},
      {rpm: 1400, torque: 2779, power: 407},
      {rpm: 1500, torque: 2779, power: 436},
      {rpm: 1600, torque: 2752, power: 461},
      {rpm: 1700, torque: 2712, power: 483},
      {rpm: 1800, torque: 2671, power: 503},
      {rpm: 1900, torque: 2530, power: 503},
      {rpm: 2000, torque: 2403, power: 503},
      {rpm: 2030, torque: 0, power: 0}
    ],
    accessories: [
      {name: 'Fan (Kavramalı Fan)', standardLoss: 22.4, userLoss: 22.4},
      {name: 'Alternatör / Jeneratör', standardLoss: 2.8, userLoss: 2.8},
      {name: 'Hava Kompresörü', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Direksiyon Pompası', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Klima', standardLoss: 0, userLoss: 0},
      {name: 'Ek Tahrik', standardLoss: 0, userLoss: 0}
    ]
  },
  'weichai_i4': {
    name: 'Weichai I4',
    specs: {
      displacement: 4.50,
      idleRpm: 600,
      governedSpeed: 2100,
      noLoadGoverned: 2200,
      inertia: 0.8000
    },
    data: [
      {rpm: 600, torque: 671.6, power: 42.2},
      {rpm: 700, torque: 770.8, power: 56.5},
      {rpm: 800, torque: 875.0, power: 73.3},
      {rpm: 900, torque: 974.0, power: 91.8},
      {rpm: 1000, torque: 1095.3, power: 114.7},
      {rpm: 1100, torque: 1204.9, power: 138.8},
      {rpm: 1200, torque: 1192.1, power: 149.8},
      {rpm: 1300, torque: 1203.2, power: 163.8},
      {rpm: 1400, torque: 1204.6, power: 176.6},
      {rpm: 1500, torque: 1205.8, power: 189.4},
      {rpm: 1600, torque: 1205.6, power: 202.0},
      {rpm: 1700, torque: 1208.3, power: 215.1},
      {rpm: 1800, torque: 1180.9, power: 222.6},
      {rpm: 1900, torque: 1155.0, power: 229.8},
      {rpm: 2000, torque: 1107.2, power: 231.9},
      {rpm: 2100, torque: 1075.0, power: 236.4},
      {rpm: 2200, torque: 0, power: 0}
    ],
    accessories: [
      {name: 'Fan (Kavramalı Fan)', standardLoss: 22.4, userLoss: 22.4},
      {name: 'Alternatör / Jeneratör', standardLoss: 2.8, userLoss: 2.8},
      {name: 'Hava Kompresörü', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Direksiyon Pompası', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Klima', standardLoss: 0, userLoss: 0},
      {name: 'Ek Tahrik', standardLoss: 0, userLoss: 0}
    ]
  },
  'duramax_lz0_305': {
    name: '3.0L I6 Duramax Turbo Diesel LZ0 | 671Nm&227kW',
    specs: {
      displacement: 2.99,
      idleRpm: 700,
      governedSpeed: 4000,
      noLoadGoverned: 5000,
      inertia: 0.3500
    },
    // GM LZ0 (Chevrolet Silverado) — grafikten dijitalleştirilmiş, rated noktalara
    // sabit: 671 Nm (495 lb-ft) @ 2750, 227 kW (305 HP) @ 3750. Maks. motor devri 5000.
    // Yayınlanan eğri NET (araca kurulu) → aksesuar kayıpları 0 (net = brüt, çift-sayım yok).
    data: [
      {rpm: 700, torque: 200, power: 14.7},   // rölanti çapası (grafiğin altı — kalkışta eğri tanımlı olsun diye)
      {rpm: 1000, torque: 359, power: 37.6},
      {rpm: 1250, torque: 536, power: 70.2},
      {rpm: 1500, torque: 630, power: 99.0},
      {rpm: 1750, torque: 637, power: 116.7},
      {rpm: 2000, torque: 640, power: 134.0},
      {rpm: 2250, torque: 651, power: 153.4},
      {rpm: 2500, torque: 662, power: 173.3},
      {rpm: 2750, torque: 671, power: 193.2},
      {rpm: 3000, torque: 667, power: 209.5},
      {rpm: 3250, torque: 655, power: 222.9},
      {rpm: 3500, torque: 612, power: 224.3},
      {rpm: 3750, torque: 578, power: 227.0},
      {rpm: 4000, torque: 522, power: 218.7},
      {rpm: 5000, torque: 0, power: 0}
    ],
    accessories: [
      {name: 'Fan (Kavramalı Fan)', standardLoss: 0, userLoss: 0},
      {name: 'Alternatör / Jeneratör', standardLoss: 0, userLoss: 0},
      {name: 'Hava Kompresörü', standardLoss: 0, userLoss: 0},
      {name: 'Direksiyon Pompası', standardLoss: 0, userLoss: 0},
      {name: 'Klima', standardLoss: 0, userLoss: 0},
      {name: 'Ek Tahrik', standardLoss: 0, userLoss: 0}
    ]
  },
  'duramax_l5p_470': {
    name: '6.6L V8 Duramax Turbo Diesel L5P | 1322Nm&350kW',
    specs: {
      displacement: 6.60,
      idleRpm: 700,
      governedSpeed: 3450,       // "Maximum Powered Speed" (tahrik governor devri)
      noLoadGoverned: 3600,
      inertia: 0.5500
    },
    // GM L5P (Silverado/Sierra HD) — grafikten dijitalleştirilmiş, rated noktalara
    // sabit: 1322 Nm (975 lb-ft) @1600, 350 kW (470 HP) @2800. Maks powered 3450 rpm.
    // (Maks braking 4800 rpm ayrı motor-freni speki; tahrik eğrisi 3450'de governor'a girer.)
    // Yayınlanan eğri NET (araca kurulu) → aksesuar kayıpları 0 (net = brüt, çift-sayım yok).
    data: [
      {rpm: 700, torque: 203, power: 14.9},   // rölanti çapası (grafiğin altı)
      {rpm: 1000, torque: 271, power: 28.4},
      {rpm: 1200, torque: 583, power: 73.3},
      {rpm: 1400, torque: 1085, power: 159.0},
      {rpm: 1500, torque: 1247, power: 195.9},
      {rpm: 1600, torque: 1322, power: 221.5},
      {rpm: 1800, torque: 1322, power: 249.2},
      {rpm: 2000, torque: 1315, power: 275.4},
      {rpm: 2200, torque: 1302, power: 299.9},
      {rpm: 2400, torque: 1268, power: 318.6},
      {rpm: 2600, torque: 1247, power: 339.6},
      {rpm: 2800, torque: 1194, power: 350.2},
      {rpm: 3000, torque: 1085, power: 340.8},
      {rpm: 3200, torque: 922, power: 309.0},
      {rpm: 3400, torque: 597, power: 212.4},
      {rpm: 3600, torque: 0, power: 0}
    ],
    accessories: [
      {name: 'Fan (Kavramalı Fan)', standardLoss: 0, userLoss: 0},
      {name: 'Alternatör / Jeneratör', standardLoss: 0, userLoss: 0},
      {name: 'Hava Kompresörü', standardLoss: 0, userLoss: 0},
      {name: 'Direksiyon Pompası', standardLoss: 0, userLoss: 0},
      {name: 'Klima', standardLoss: 0, userLoss: 0},
      {name: 'Ek Tahrik', standardLoss: 0, userLoss: 0}
    ]
  },
  'duramax_l5d_470': {
    name: '6.6L V8 Duramax Turbo Diesel L5D | 1332Nm&350kW',
    specs: {
      displacement: 6.60,
      idleRpm: 700,
      governedSpeed: 3000,       // "Governed Speed" (rated) — spek
      noLoadGoverned: 3600,      // "No Load Governed" — spek
      inertia: 0.5792            // "Engine Inertia (estimated)" — spek
    },
    // GM 6.6L L5D Duramax (SEM/LRTP, 497-L042559-E) — üretici tablosundan BRÜT eğri.
    // Tepe güç/tork spek başlığıyla birebir: 1332 Nm@1600, 350.1 kW@2800 (brüt).
    // NET sürüş torku aksesuar kayıplarıyla hesaplanır: Fan (kavramalı, N³) 34.5 kW +
    // diğerleri 7.2 kW @governed → tablodaki "Net Fan On" ile eşleşir (fan=0 → "Net Fan Off").
    // Fan kaybı N³ olarak birebir doğrulanmıştır (34.5·(rpm/3000)³). US EPA On-Road 2024.
    data: [
      {rpm: 700, torque: 203.0, power: 14.9},
      {rpm: 1000, torque: 271.0, power: 28.4},
      {rpm: 1200, torque: 583.0, power: 73.3},
      {rpm: 1400, torque: 1085.0, power: 159.1},
      {rpm: 1500, torque: 1247.0, power: 195.9},
      {rpm: 1600, torque: 1332.0, power: 223.2},
      {rpm: 1800, torque: 1322.0, power: 249.2},
      {rpm: 2000, torque: 1315.0, power: 275.4},
      {rpm: 2200, torque: 1302.0, power: 300.0},
      {rpm: 2400, torque: 1268.0, power: 318.7},
      {rpm: 2600, torque: 1247.0, power: 339.5},
      {rpm: 2800, torque: 1194.0, power: 350.1},
      {rpm: 3000, torque: 1085.0, power: 340.9},
      {rpm: 3200, torque: 922.0, power: 309.0},
      {rpm: 3400, torque: 597.0, power: 212.6},
      {rpm: 3600, torque: 0, power: 0}
    ],
    accessories: [
      {name: 'Fan (Kavramalı Fan)', standardLoss: 34.5, userLoss: 34.5},
      {name: 'Alternatör / Jeneratör', standardLoss: 2.8, userLoss: 2.8},
      {name: 'Hava Kompresörü', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Direksiyon Pompası', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Klima', standardLoss: 1.6, userLoss: 1.6},
      {name: 'Ek Tahrik', standardLoss: 0, userLoss: 0}
    ]
  }
};

function onVEMotorCategoryChange(nodeId) {
  // Artık tek kategori — FT motor presetleri kullanılıyor
}

// Izgara satırı (Tam Gaz): A–C girdi (input), D–F türetilen (ƒ), ✕ sil.
// accData/governed verilmezse düğümden okunur (addVEMotorRow yolu).
function veEngSheetRowHTML(nodeId, idx, rpm, torque, power, accData, governed) {
  if(!accData || governed == null) {
    var _n = (typeof nodes !== 'undefined') ? nodes.find(function(n) { return n.id === nodeId; }) : null;
    var _d = (_n && _n.data) || {};
    accData = accData || _d.accessories || [];
    governed = governed || (_d.motorSpecs && _d.motorSpecs.governedSpeed) || _d.governedRpm || 2100;
  }
  var v = function(x) { return (x !== '' && x !== undefined && x !== null) ? x : ''; };
  var r = parseFloat(rpm), hasRpm = !isNaN(r) && r > 0;
  var loss = 0, netP = 0, netT = 0;
  if(hasRpm) {
    loss = veCalcAccLossAtRPM(accData, r, governed);
    netP = Math.max(0, (parseFloat(power) || 0) - loss);   // çözücüyle tutarlı: net ≥ 0
    netT = netP * 9549.3 / r;
  }
  var inCell = function(val) {
    return '<td class="in"><input type="number" value="' + v(val) +
           '" onchange="onVEMotorDataChange(\'' + nodeId + '\')"></td>';
  };
  var fCell = function(color, val) {
    return '<td class="f" style="color:' + color + ';">' + (hasRpm ? val : '—') + '</td>';
  };
  var h = '<tr>';
  h += '<td class="n">' + idx + '</td>';
  h += inCell(rpm) + inCell(torque) + inCell(power);
  h += fCell('var(--accent-warning)', loss.toFixed(1));
  h += fCell(VE_ENG_C.seri1, netT.toFixed(1));
  h += fCell(VE_ENG_C.seri2, netP.toFixed(1));
  h += '<td style="text-align:center;"><button class="ve-row-del" onclick="removeVEMotorRow(this, \'' +
       nodeId + '\')" title="Satırı sil">×</button></td>';
  return h + '</tr>';
}

// Ortak satır üreticisi: Tam Gaz'da 8 sütunlu ızgara satırı, Motor Freni'nde
// eski 4 sütunlu satır. addVEMotorRow / onVEFTMotorSelect / onVEMotorSelectChange
// hepsi buradan geçer → iki dal karışmaz.
function getVEMotorRowHTML(nodeId, rpm, torque, power) {
  if(typeof veActiveModule !== 'undefined' && veActiveModule === 'full-throttle') {
    var tb = (typeof document !== 'undefined') ? document.getElementById('ve-motor-table-' + nodeId) : null;
    return veEngSheetRowHTML(nodeId, tb ? tb.rows.length + 1 : 1, rpm, torque, power);
  }
  var html = '<tr>';
  html += '<td style="padding:3px; border-bottom:1px solid var(--border-color);"><input type="number" value="' + (rpm !== '' && rpm !== undefined ? rpm : '') + '" style="width:100%; padding:4px; font-size:var(--fs-body); background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:var(--radius-sm); text-align:center;" onchange="onVEMotorDataChange(\'' + nodeId + '\')"></td>';
  html += '<td style="padding:3px; border-bottom:1px solid var(--border-color);"><input type="number" value="' + (torque !== '' && torque !== undefined ? torque : '') + '" style="width:100%; padding:4px; font-size:var(--fs-body); background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:var(--radius-sm); text-align:center;" onchange="onVEMotorDataChange(\'' + nodeId + '\')"></td>';
  html += '<td style="padding:3px; border-bottom:1px solid var(--border-color);"><input type="number" value="' + (power !== '' && power !== undefined ? power : '') + '" style="width:100%; padding:4px; font-size:var(--fs-body); background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:var(--radius-sm); text-align:center;" onchange="onVEMotorDataChange(\'' + nodeId + '\')"></td>';
  html += '<td style="padding:3px; border-bottom:1px solid var(--border-color); text-align:center;"><button class="ve-row-del" onclick="removeVEMotorRow(this, \'' + nodeId + '\')" title="Satırı sil">×</button></td>';
  html += '</tr>';
  return html;
}

function addVEMotorRow(nodeId) {
  var tbody = document.getElementById('ve-motor-table-' + nodeId);
  if(!tbody) return;

  var tr = document.createElement('tr');
  tr.innerHTML = getVEMotorRowHTML(nodeId, '', '', '').replace('<tr>', '').replace('</tr>', '');
  tbody.appendChild(tr);
  // Izgarada satır numaraları ve ƒ sütunları tazelenir; odak yeni satırın
  // devir hücresine gider (boş satıra tıklamak için fare gerekmesin).
  veEngSheetSyncDerived(nodeId);
  var _first = tr.querySelector('input');
  if(_first && _first.focus) _first.focus();
}

function removeVEMotorRow(btn, nodeId) {
  var tr = btn.closest('tr');
  if(tr) {
    tr.remove();
    onVEMotorDataChange(nodeId);
    
    // Satır kalmadıysa placeholder göster
    var data = getVEMotorTableData(nodeId);
    if(data.length === 0) {
      showVEMotorPlaceholder(nodeId);
    }
  }
}

function showVEMotorPlaceholder(nodeId) {
  var dataArea = document.getElementById('ve-motor-data-area-' + nodeId);
  var placeholder = document.getElementById('ve-motor-placeholder-' + nodeId);
  veEngShowDataArea(dataArea, false);
  if(placeholder) placeholder.style.display = 'block';

  // Veri tamamen silindi → sağ (çıktı) sütunu da kapat ve pencereyi
  // "boş motor" dar haline döndür (onVEFTMotorSelect'teki büyümenin tersi).
  var ftExtras = document.querySelectorAll('.ve-ft-extra[data-node="' + nodeId + '"]');
  ftExtras.forEach(function(el){ el.style.display = 'none'; });
  var _propWin = document.getElementById('ve-properties');
  if(_propWin && _propWin.classList.contains('ve-properties--wide') && placeholder) {
    _propWin.classList.remove('ve-properties--wide');
    _propWin.classList.remove('ve-properties--engwide');   // 1040px → dar boş durum
    _propWin.classList.add('ve-properties--engine-empty');
  }
  
  // Motor dropdown'ını da sıfırla
  var selectEl = document.getElementById('ve-motor-select-' + nodeId);
  if(selectEl) selectEl.value = '';
}

function clearVEMotorTable(nodeId, skipConfirm) {
  var tbody = document.getElementById('ve-motor-table-' + nodeId);
  if(!tbody) return;
  
  function doClear() {
    tbody.innerHTML = '';
    
    // Node'un verisini temizle
    var node = nodes.find(function(n) { return n.id === nodeId; });
    if(node && node.data) {
      node.data.torqueData = [];
    }
    
    // TEK boş satır ekle (değer yok, sadece boş inputlar)
    addVEMotorRow(nodeId);
    
    // Dropdown'ı sıfırlama - veri alanı görünür kalsın
    // Grafiği güncelle
    updateVEMotorChart(nodeId);
    showToast('Tablo temizlendi');
  }
  
  if(skipConfirm) {
    doClear();
  } else {
    var data = getVEMotorTableData(nodeId);
    if(data.length > 0) {
      showConfirmToast('Tablodaki tüm verileri silmek istediğinize emin misiniz?', doClear);
    } else {
      showToast('Tablo zaten boş', 'warning');
    }
  }
}

function deleteVEMotorSavedSet(nodeId) {
  // Mevcut motor verisini temizle - toast onayı ile
  var node = nodes.find(function(n) { return n.id === nodeId; });
  if(!node) return;
  
  // Veri var mı kontrol et
  var data = getVEMotorTableData(nodeId);
  if(data.length === 0) {
    showToast('Temizlenecek veri yok', 'warning');
    return;
  }
  
  showConfirmToast('Tablodaki motor verilerini temizlemek istediğinize emin misiniz?', function() {
    // Onaylandı - temizle
    if(node.data) {
      node.data.torqueData = [];
      node.data.savedSetName = null;
    }
    
    // Tabloyu temizle ve TEK boş satır ekle
    var tbody = document.getElementById('ve-motor-table-' + nodeId);
    if(tbody) {
      tbody.innerHTML = '';
      addVEMotorRow(nodeId);
    }
    
    // Motor dropdown'ını sıfırla
    var selectEl = document.getElementById('ve-motor-select-' + nodeId);
    if(selectEl) selectEl.value = '';
    
    // Grafiği güncelle
    updateVEMotorChart(nodeId);
    showToast('Motor verisi temizlendi');
  });
}

function onVEMotorDataChange(nodeId) {
  var node = nodes.find(function(n) { return n.id === nodeId; });
  if(!node) return;

  if(!node.data) node.data = {};
  node.data.torqueData = getVEMotorTableData(nodeId);
  // Tam Gaz ızgarasında bir hücre değişince aynı satırın ƒ sütunları, metrikler
  // ve grafik ANINDA tazelenir (önceden yalnız "Kayıpları Uygula"/Güncelle ile).
  // updateVENetChart ƒ+metrik tazelemesini kanvastan bağımsız yapar.
  if(veActiveModule === 'full-throttle') updateVENetChart(nodeId);
}

function onVEMotorParamChange(nodeId) {
  var node = nodes.find(function(n) { return n.id === nodeId; });
  if(!node) return;
  
  if(!node.data) node.data = {};
  
  var verimEl = document.getElementById('ve-mf-verim-' + nodeId);
  var governedEl = document.getElementById('ve-governed-rpm-' + nodeId);
  
  var pf = function(v, def) { var n = parseFloat(v); return isNaN(n) ? def : n; };
  if(verimEl) node.data.verim = pf(verimEl.value, 100);
  if(governedEl) {
    node.data.governedRpm = pf(governedEl.value, 2100);
    // motorSpecs varsa orayı da güncelle
    if(node.data.motorSpecs) node.data.motorSpecs.governedSpeed = node.data.governedRpm;
    propagateGovernedSpeed();
  }
}

function onVEFitMethodChange(nodeId) {
  var node = nodes.find(function(n) { return n.id === nodeId; });
  var methodEl = document.getElementById('ve-fit-method-' + nodeId);
  var degreeWrapper = document.getElementById('ve-poly-degree-wrapper-' + nodeId);
  
  if(!node || !methodEl) return;
  
  if(!node.data) node.data = {};
  node.data.fitMethod = methodEl.value;
  
  if(degreeWrapper) {
    degreeWrapper.style.display = (methodEl.value === 'poly') ? 'flex' : 'none';
  }
  
  updateVEMotorChart(nodeId);
}

function saveVEMotorData(nodeId) {
  onVEMotorDataChange(nodeId);
  onVEMotorParamChange(nodeId);
  showToast('Motor freni verileri kaydedildi');
}

function getVEMotorTableData(nodeId) {
  var tbody = document.getElementById('ve-motor-table-' + nodeId);
  if(!tbody) return [];
  
  var data = [];
  var rows = tbody.querySelectorAll('tr');
  rows.forEach(function(tr) {
    var inputs = tr.querySelectorAll('input');
    if(inputs.length >= 3) {
      var rpm = parseFloat(inputs[0].value);
      var torque = parseFloat(inputs[1].value);
      var power = parseFloat(inputs[2].value);
      
      if(!isNaN(rpm) && rpm > 0) {
        data.push({
          rpm: rpm,
          torque: isNaN(torque) ? null : torque,
          power: isNaN(power) ? null : power
        });
      }
    }
  });
  
  return data.sort(function(a, b) { return a.rpm - b.rpm; });
}

function onVEMotorSelectChange(nodeId, value) {
  if(!value) return;
  
  // Seçilen preset key'i kaydet
  var node = nodes.find(function(n) { return n.id === nodeId; });
  if(node) {
    if(!node.data) node.data = {};
    node.data.mfMotorPreset = value;
  }
  
  var tbody = document.getElementById('ve-motor-table-' + nodeId);
  if(!tbody) return;
  
  // Veri alanını göster, placeholder'ı gizle
  var dataArea = document.getElementById('ve-motor-data-area-' + nodeId);
  var placeholder = document.getElementById('ve-motor-placeholder-' + nodeId);
  veEngShowDataArea(dataArea, true);
  if(placeholder) placeholder.style.display = 'none';
  
  tbody.innerHTML = '';
  
  // Yeni Motor seçildiyse boş tablo oluştur
  if(value === '__new__') {
    for(var i = 0; i < 5; i++) {
      var tr = document.createElement('tr');
      tr.innerHTML = getVEMotorRowHTML(nodeId, '', '', '').replace('<tr>', '').replace('</tr>', '');
      tbody.appendChild(tr);
    }
    onVEMotorDataChange(nodeId);
    updateVEMotorChart(nodeId);
    showToast('Yeni motor verisi için tablo hazır');
    return;
  }
  
  // Preset motor seçildiyse verileri yükle — artık sadece FT preset sistemi var
  var presets = {};
  var preset = null;

  // FT motor presetlerini kontrol et
  if(typeof VE_FT_MOTOR_PRESETS !== 'undefined' && VE_FT_MOTOR_PRESETS[value]) {
    preset = VE_FT_MOTOR_PRESETS[value];
  }
  if(!preset) return;
  
  preset.data.forEach(function(row) {
    var tr = document.createElement('tr');
    tr.innerHTML = getVEMotorRowHTML(nodeId, row.rpm, row.torque, row.power).replace('<tr>', '').replace('</tr>', '');
    tbody.appendChild(tr);
  });
  
  onVEMotorDataChange(nodeId);
  updateVEMotorChart(nodeId);
  showToast('Motor verisi yüklendi: ' + preset.name);
}

// Tam Gaz Hızlanma — Motor Seçici
function onVEFTMotorSelect(nodeId, value) {
  if(!value) return;
  
  // Seçilen preset key'i kaydet
  var node = nodes.find(function(n) { return n.id === nodeId; });
  if(node) {
    if(!node.data) node.data = {};
    node.data.ftMotorPreset = value;
  }
  
  var tbody = document.getElementById('ve-motor-table-' + nodeId);
  if(!tbody) return;
  
  var dataArea = document.getElementById('ve-motor-data-area-' + nodeId);
  var placeholder = document.getElementById('ve-motor-placeholder-' + nodeId);
  // İki sütuna dağılmış .ve-ft-extra sarmalayıcılarının ikisini de aç (sol+sağ)
  var ftExtras = document.querySelectorAll('.ve-ft-extra[data-node="' + nodeId + '"]');
  veEngShowDataArea(dataArea, true);
  if(placeholder) placeholder.style.display = 'none';
  // 'flex' — sütun sarmalayıcıları .ve-cp-grid--sheet altında dikey flex
  // (aralar `gap` ile); özet şeridi de zaten yatay flex.
  ftExtras.forEach(function(el){ el.style.display = 'flex'; });

  // Veri geldi → dar "boş motor" penceresini geniş yerleşime büyüt (yeniden
  // render yok; yalnız pencere sınıfı değişir, cp-core'daki engine-empty
  // kuralının tersi).
  var _propWin = document.getElementById('ve-properties');
  if(_propWin && _propWin.classList.contains('ve-properties--engine-empty')) {
    _propWin.classList.remove('ve-properties--engine-empty');
    _propWin.classList.add('ve-properties--wide');
    if(veActiveModule === 'full-throttle') _propWin.classList.add('ve-properties--engwide');
  }
  
  tbody.innerHTML = '';
  
  if(value === '__new__') {
    for(var i = 0; i < 5; i++) {
      var tr = document.createElement('tr');
      tr.innerHTML = getVEMotorRowHTML(nodeId, '', '', '').replace('<tr>', '').replace('</tr>', '');
      tbody.appendChild(tr);
    }
    onVEMotorDataChange(nodeId);
    updateVEMotorChart(nodeId);
    showToast('Manuel veri girişi için tablo hazır');
    return;
  }
  
  var preset = VE_FT_MOTOR_PRESETS[value];
  if(!preset) return;
  
  // Tork/güç verilerini yükle
  preset.data.forEach(function(row) {
    var tr = document.createElement('tr');
    tr.innerHTML = getVEMotorRowHTML(nodeId, row.rpm, row.torque, row.power).replace('<tr>', '').replace('</tr>', '');
    tbody.appendChild(tr);
  });
  
  onVEMotorDataChange(nodeId);
  updateVEMotorChart(nodeId);
  
  // Motor parametrelerini yükle (specs)
  if(preset.specs) {
    var node = nodes.find(function(n) { return n.id === nodeId; });
    if(node) {
      if(!node.data) node.data = {};
      node.data.motorSpecs = JSON.parse(JSON.stringify(preset.specs));
      node.data.governedRpm = preset.specs.governedSpeed || 2100;
    }
    var specFields = ['displacement','idleRpm','governedSpeed','noLoadGoverned','inertia'];
    specFields.forEach(function(fld) {
      var el = document.getElementById('ve-ft-spec-' + fld + '-' + nodeId);
      if(el && preset.specs[fld] !== undefined) el.value = preset.specs[fld];
    });
  }
  
  // Aksesuar kayıplarını yükle
  if(preset.accessories) {
    var node = nodes.find(function(n) { return n.id === nodeId; });
    if(node) {
      if(!node.data) node.data = {};
      node.data.accessories = JSON.parse(JSON.stringify(preset.accessories));
    }
    // Tablo inputlarını güncelle
    var stdInputs = document.querySelectorAll('.ve-acc-std-' + nodeId);
    var userInputs = document.querySelectorAll('.ve-acc-user-' + nodeId);
    preset.accessories.forEach(function(acc, idx) {
      if(stdInputs[idx]) stdInputs[idx].value = acc.standardLoss;
      if(userInputs[idx]) userInputs[idx].value = acc.userLoss;
    });
    // Toplamları güncelle
    veUpdateAccTotals(nodeId);
  }

  // Bağlı aksesuar düğümleri (Klima/Alternatör/Hava Komp.) varsa: motor preset'inin
  // aksesuar değerlerinin ÜSTÜNE bağlı düğümlerin eğri/oran modelini YENİDEN uygula
  // (kullanıcı bağlantıyı motor seçiminden önce yapmış olabilir → preset silmesin).
  var _engSync = nodes.find(function(n) { return n.id === nodeId; });
  if(_engSync && typeof veSyncEngineAccessories === 'function') {
    veSyncEngineAccessories(_engSync);
    var _uIn = document.querySelectorAll('.ve-acc-user-' + nodeId);
    (_engSync.data.accessories || []).forEach(function(a, idx) { if(_uIn[idx]) _uIn[idx].value = a.userLoss; });
    veUpdateAccTotals(nodeId);
    updateVENetChart(nodeId);
  }

  // Governed speed'i tüm bağımlı bileşenlere yay
  propagateGovernedSpeed();
  
  showToast('Motor verisi yüklendi: ' + preset.name);
}

// ═══════════════════════════════════════════════════════════════
// GOVERNED SPEED PROPAGATION — Motor → Şanzıman & diğer bileşenler
// ═══════════════════════════════════════════════════════════════
function getEngineGovernedSpeed() {
  // Motor bileşeninden governed speed oku
  var engineNode = nodes.find(function(n) { return n.type === 'engine'; });
  if(!engineNode || !engineNode.data) return 0;
  var specs = engineNode.data.motorSpecs || {};
  return parseFloat(specs.governedSpeed) || parseFloat(engineNode.data.governedRpm) || 0;
}

function propagateGovernedSpeed() {
  var govSpeed = getEngineGovernedSpeed();
  if(!govSpeed) return;
  
  // Şanzıman bileşenine yay
  var gbNode = nodes.find(function(n) { return n.type === 'gearbox'; });
  if(gbNode) {
    if(!gbNode.data) gbNode.data = {};
    gbNode.data.gbGovernedSpeed = govSpeed;
    // UI alanını güncelle (görünürse)
    var govEl = document.getElementById('ve-gb-governed-' + gbNode.id);
    if(govEl) {
      govEl.value = govSpeed;
      govEl.placeholder = 'Motordan: ' + govSpeed;
    }
  }
}

// Aksesuar kayıpları değişiklik handler
function onVEAccChange(nodeId) {
  var node = nodes.find(function(n) { return n.id === nodeId; });
  if(!node) return;
  if(!node.data) node.data = {};
  
  var accNames = ['Fan (Kavramalı Fan)', 'Alternatör / Jeneratör', 'Hava Kompresörü', 'Direksiyon Pompası', 'Klima', 'Ek Tahrik'];
  var stdInputs = document.querySelectorAll('.ve-acc-std-' + nodeId);
  var userInputs = document.querySelectorAll('.ve-acc-user-' + nodeId);
  
  // Bağlı aksesuar düğümünden gelen eğri/oran verisini KORU (isim ile eşleştir).
  // Aksi halde manuel bir satır düzenlemesi node-kaynaklı eğriyi silerdi.
  var _prevAcc = {};
  (node.data.accessories || []).forEach(function(a){ _prevAcc[a.name] = a; });

  var accessories = [];
  accNames.forEach(function(name, idx) {
    var row = {
      name: name,
      standardLoss: stdInputs[idx] ? parseFloat(stdInputs[idx].value) || 0 : 0,
      userLoss: userInputs[idx] ? parseFloat(userInputs[idx].value) || 0 : 0
    };
    var p = _prevAcc[name];
    if(p && p.sourceNodeId) {
      row.sourceNodeId = p.sourceNodeId;
      if(p.curve) row.curve = p.curve;
      if(p.driveRatio != null) row.driveRatio = p.driveRatio;
      if(p.kwConst != null) row.kwConst = p.kwConst;
      // Node-kaynaklı satırda kayıp bileşenden gelir → DOM değerini node değeri ezmesin
      if(p.userLoss != null) row.userLoss = p.userLoss;
    }
    accessories.push(row);
  });

  node.data.accessories = accessories;
  veUpdateAccTotals(nodeId);
  updateVENetChart(nodeId);
}

// Kayıpları Uygula butonu
function onVEApplyAccLosses(nodeId) {
  // Önce aksesuar verilerini kaydet
  onVEAccChange(nodeId);
  // Sonra motor specs'ten governed speed'i al
  var node = nodes.find(function(n) { return n.id === nodeId; });
  if(!node) return;
  // Net chart ve tabloyu güncelle
  updateVENetChart(nodeId);
  showToast('Aksesuar kayıpları net değerlere uygulandı');
}

function veUpdateAccTotals(nodeId) {
  var stdInputs = document.querySelectorAll('.ve-acc-std-' + nodeId);
  var userInputs = document.querySelectorAll('.ve-acc-user-' + nodeId);
  var totalStd = 0, totalUser = 0;
  stdInputs.forEach(function(el) { totalStd += parseFloat(el.value) || 0; });
  userInputs.forEach(function(el) { totalUser += parseFloat(el.value) || 0; });
  
  var stdEl = document.getElementById('ve-acc-total-std-' + nodeId);
  var userEl = document.getElementById('ve-acc-total-user-' + nodeId);
  if(stdEl) stdEl.textContent = totalStd.toFixed(1);
  if(userEl) userEl.textContent = totalUser.toFixed(1);
}

// Motor parametreleri (specs) değişiklik handler — Tam Gaz modülü
function onVEFTSpecChange(nodeId) {
  var node = nodes.find(function(n) { return n.id === nodeId; });
  if(!node) return;
  if(!node.data) node.data = {};
  if(!node.data.motorSpecs) node.data.motorSpecs = {};
  
  var specFields = ['displacement','idleRpm','governedSpeed','noLoadGoverned','inertia'];
  specFields.forEach(function(fld) {
    var el = document.getElementById('ve-ft-spec-' + fld + '-' + nodeId);
    if(el) node.data.motorSpecs[fld] = parseFloat(el.value) || 0;
  });
  
  // governedSpeed'i ana governedRpm alanına da yaz (solver kullanıyor)
  if(node.data.motorSpecs.governedSpeed) {
    node.data.governedRpm = node.data.motorSpecs.governedSpeed;
  }

  // Governed speed değiştiyse tüm bileşenlere yay
  propagateGovernedSpeed();

  // Governed kaybı devir oranına bağlı → ƒ sütunları, metrikler ve grafik
  // governed değişiminde de tazelenmeli (updateVENetChart ikisini de yapar).
  if(veActiveModule === 'full-throttle') updateVENetChart(nodeId);
}

// Grafik paleti — iki motor grafiği AYNI iki büyüklüğü çiziyor (tork/güç) ama
// biri mavi+kırmızı, öteki yeşil+somon kullanıyordu. Tek palet: tork = seri-1,
// güç = seri-2. EKSEN ve ETİKET renkleri nötr; renk YALNIZ eğride.
var VE_ENG_C = {
  seri1:  '#5b95fb',   // tork
  seri2:  '#e0725f',   // güç
  eksen:  '#5a6472',   // eksen çizgisi (nötr)
  etiket: '#8b949e',   // eksen sayıları (nötr)
  izgara: '#2a3140',   // ızgara
  governed: '#d97706'  // governed devri kılavuz çizgisi (amber)
};

// Net tepe gücün okunduğu devirdeki brüt/kayıp/net üçlüsü. Özet şeridinin
// aritmetiği (brüt − kayıp = net) YALNIZ bu tek devirde kapanır; governed
// devrindeki kaybı tepe güçten düşmek kapanmayan bir denklem üretirdi.
function veEngPeakSummary(rows, accData, governed) {
  var best = null;
  (rows || []).forEach(function(r) {
    var rpm = parseFloat(r.rpm) || 0;
    if(rpm <= 0) return;
    var gP = parseFloat(r.power) || 0;
    var loss = veCalcAccLossAtRPM(accData || [], rpm, governed);
    var nP = Math.max(0, gP - loss);
    if(!best || nP > best.netPower) {
      best = {rpm: rpm, grossPower: gP, loss: loss, netPower: nP, netTorque: nP * 9549.3 / rpm};
    }
  });
  return best;
}

// Izgaranın türetilen sütunlarını (D–F) ve satır numaralarını tazeler.
// DOM satır sırasıyla çalışır — getVEMotorTableData sıralayıp filtrelediği
// için indeks eşlemesi ona bağlanamaz. Izgara yoksa (Motor Freni / panel
// kapalı) sessizce çıkar.
function veEngSheetSyncDerived(nodeId) {
  if(typeof document === 'undefined') return;
  var tbody = document.getElementById('ve-motor-table-' + nodeId);
  if(!tbody) return;
  var node = nodes.find(function(n) { return n.id === nodeId; });
  var nd = (node && node.data) || {};
  var acc = nd.accessories || [];
  var governed = (nd.motorSpecs && nd.motorSpecs.governedSpeed) || nd.governedRpm || 2100;
  var i = 0;
  Array.prototype.forEach.call(tbody.rows, function(tr) {
    var no = tr.querySelector('td.n');
    if(no) no.textContent = ++i;
    var inputs = tr.querySelectorAll('input');
    var f = tr.querySelectorAll('td.f');
    if(inputs.length < 3 || f.length < 3) return;
    var rpm = parseFloat(inputs[0].value);
    if(!(rpm > 0)) { f[0].textContent = '—'; f[1].textContent = '—'; f[2].textContent = '—'; return; }
    var loss = veCalcAccLossAtRPM(acc, rpm, governed);
    var netP = Math.max(0, (parseFloat(inputs[2].value) || 0) - loss);
    f[0].textContent = loss.toFixed(1);
    f[1].textContent = (netP * 9549.3 / rpm).toFixed(1);
    f[2].textContent = netP.toFixed(1);
  });
  var range = document.getElementById('ve-sheet-range-' + nodeId);
  if(range) range.textContent = 'A1:C' + i + ' girdi · ƒ D:F türetilen';
  var table = tbody.parentNode;
  var foot = table ? table.querySelector('tfoot td.n') : null;
  if(foot) foot.textContent = i + 1;
}

// Doğrulama sütunundaki 6 metrik + özet şeridi + governed rozeti.
function veEngUpdateMetrics(nodeId) {
  if(typeof document === 'undefined') return;
  var node = nodes.find(function(n) { return n.id === nodeId; });
  var nd = (node && node.data) || {};
  var rows = (nd.torqueData || []).filter(function(r) { return (parseFloat(r.rpm) || 0) > 0; });
  var acc = nd.accessories || [];
  var governed = (nd.motorSpecs && nd.motorSpecs.governedSpeed) || nd.governedRpm || 2100;
  var set = function(k, v) {
    var el = document.getElementById('ve-eng-m-' + k + '-' + nodeId);
    if(el) el.textContent = v;
  };
  var lossGov = veCalcAccLossAtRPM(acc, governed, governed);
  set('loss', lossGov.toFixed(1) + ' kW @ ' + governed);   // metrik satırı: GOVERNED devri
  var badge = document.getElementById('ve-net-badge-' + nodeId);
  if(badge) badge.textContent = '−' + lossGov.toFixed(1) + ' kW @ ' + governed;
  // Yayılım şeridi render anındaki değerde DONUYORDU: governed 1600'e çekilince
  // rozet/metrik 1600 derken şerit hâlâ 2100 yazıyordu.
  var govBar = document.getElementById('ve-eng-govbar-' + nodeId);
  if(govBar) govBar.textContent = governed;
  if(!rows.length) {
    ['gp','np','gt','nt','pts','gp2','np2','loss2','rpm2'].forEach(function(k) { set(k, '—'); });
    return;
  }
  var net = rows.map(function(r) {
    var rpm = parseFloat(r.rpm), gP = parseFloat(r.power) || 0, gT = parseFloat(r.torque) || 0;
    var loss = veCalcAccLossAtRPM(acc, rpm, governed);
    var nP = Math.max(0, gP - loss);
    return {rpm: rpm, gT: gT, gP: gP, nP: nP, nT: nP * 9549.3 / rpm};
  });
  var top = function(key) { return net.reduce(function(m, r) { return r[key] > m[key] ? r : m; }, net[0]); };
  var gp = top('gP'), np = top('nP'), gt = top('gT'), nt = top('nT');
  set('gp',  gp.gP.toFixed(1) + ' kW @ ' + gp.rpm);
  set('np',  np.nP.toFixed(1) + ' kW @ ' + np.rpm);
  set('gt',  gt.gT.toFixed(0) + ' Nm @ ' + gt.rpm);
  set('nt',  nt.nT.toFixed(0) + ' Nm @ ' + nt.rpm);
  set('pts', rows.length + ' satır · ' + net[0].rpm + '–' + net[net.length - 1].rpm + ' rpm');
  // Özet şeridi: üç figür de NET TEPE devrinde okunur → brüt − kayıp = net kapanır
  var pk = veEngPeakSummary(rows, acc, governed);
  if(pk) {
    set('gp2',   pk.grossPower.toFixed(1));
    set('loss2', pk.loss.toFixed(1));
    set('np2',   pk.netPower.toFixed(1));
    set('rpm2',  pk.rpm);
  }
}

function updateVEMotorChart(nodeId) {
  var data = getVEMotorTableData(nodeId);
  var torquePoints = data.filter(function(d) { return d.torque !== null; }).map(function(d) { return {x: d.rpm, y: d.torque}; });
  var powerPoints = data.filter(function(d) { return d.power !== null; }).map(function(d) { return {x: d.rpm, y: d.power}; });

  // Denklem ve net grafik brüt kanvastan BAĞIMSIZ: Tam Gaz'ın hesap tablosu
  // yerleşiminde brüt kanvas yok, ama "Eğri Yaklaşımı" kutusu ve doğrulama
  // sütunu yine dolmalı. (Önceden ikisi de kanvas bulunduktan SONRA çağrılıyordu
  // → kanvas kalkınca denklem kutusu boş kalırdı.)
  updateVEMotorFitEquation(nodeId, torquePoints, powerPoints);
  if(veActiveModule === 'full-throttle') updateVENetChart(nodeId);

  var canvas = document.getElementById('ve-motor-chart-' + nodeId);
  if(!canvas) return;                     // Tam Gaz'da beklenen durum
  
  // Canvas ölçeği: veFitCanvas (js/graphics.js) gerçek yerleşim genişliğini
  // ve devicePixelRatio'yu kullanır. Eskiden buradaki sabit "2" ve yerleşim
  // oturmadan okunan rect.width yüzünden çizim 1,86× büyüyüp bulanıklaşıyordu.
  var fit = veFitCanvas(canvas, 200);
  if(!fit) return;
  canvas._veRedraw = function() { updateVEMotorChart(nodeId); };
  var ctx = fit.ctx;
  var rect = { width: fit.w };
  
  if(torquePoints.length < 2 && powerPoints.length < 2) {
    ctx.fillStyle = '#666';
    ctx.font = '12px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('En az 2 veri noktası gerekli', rect.width / 2, 100);
    return;
  }
  
  // Grafik çizimi - çift eksen
  var margin = {left: 50, right: 50, top: 20, bottom: 30};
  var plotWidth = rect.width - margin.left - margin.right;
  var plotHeight = 200 - margin.top - margin.bottom;
  
  // X ekseni (RPM) — taban aralık
  var allX = torquePoints.concat(powerPoints).map(function(p) { return p.x; });
  var xMinBase = Math.min.apply(null, allX);
  var xMaxBase = Math.max.apply(null, allX);
  
  // Y eksenleri — taban aralıklar
  var yMinTorque = 0;
  var yMaxTorque = torquePoints.length > 0 ? Math.max.apply(null, torquePoints.map(function(p) { return p.y; })) * 1.15 : 100;
  var yMinPower = 0;
  var yMaxPower = powerPoints.length > 0 ? Math.max.apply(null, powerPoints.map(function(p) { return p.y; })) * 1.15 : 100;

  // ── Zoom penceresi (js/panel-chart.js) ──
  // Grafik ÇİFT Y eksenli (tork + güç, farklı ölçekler). Zoom normalize [0,1]
  // Y üzerinden uygulanır ki iki eğri birbirine göre kaymadan yakınlaşsın.
  var _pcWin = (typeof pcZoomWindow === 'function')
    ? pcZoomWindow({ minX: xMinBase, maxX: xMaxBase, minY: 0, maxY: 1 }, pcZoomState(canvas))
    : { minX: xMinBase, maxX: xMaxBase, minY: 0, maxY: 1 };
  var xMin = _pcWin.minX, xMax = _pcWin.maxX;

  function _pcYFromNorm(n) { return margin.top + plotHeight - (n - _pcWin.minY) / (_pcWin.maxY - _pcWin.minY) * plotHeight; }
  function _pcNormTorque(y) { return (y - yMinTorque) / (yMaxTorque - yMinTorque); }
  function _pcNormPower(y) { return (y - yMinPower) / (yMaxPower - yMinPower); }
  // Görünen (zoom'lanmış) eksen aralıkları — etiketler bunları izler
  var visTorqueLo = yMinTorque + _pcWin.minY * (yMaxTorque - yMinTorque);
  var visTorqueHi = yMinTorque + _pcWin.maxY * (yMaxTorque - yMinTorque);
  var visPowerLo  = yMinPower  + _pcWin.minY * (yMaxPower  - yMinPower);
  var visPowerHi  = yMinPower  + _pcWin.maxY * (yMaxPower  - yMinPower);

  function xScale(x) { return margin.left + (x - xMin) / (xMax - xMin) * plotWidth; }
  function yScaleTorque(y) { return _pcYFromNorm(_pcNormTorque(y)); }
  function yScalePower(y) { return _pcYFromNorm(_pcNormPower(y)); }
  
  // Arka plan grid
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth = 1;
  for(var i = 0; i <= 5; i++) {
    var gy = margin.top + plotHeight * i / 5;
    ctx.beginPath();
    ctx.moveTo(margin.left, gy);
    ctx.lineTo(margin.left + plotWidth, gy);
    ctx.stroke();
  }
  
  // Eksen çizgileri NÖTR: eksenin rengi bir bilgi taşımıyordu; seri rengi
  // eğrinin kendisinde ve göstergede zaten var.
  ctx.strokeStyle = VE_ENG_C.eksen;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(margin.left, margin.top);
  ctx.lineTo(margin.left, margin.top + plotHeight);
  ctx.stroke();
  
  ctx.strokeStyle = VE_ENG_C.eksen;
  ctx.beginPath();
  ctx.moveTo(margin.left + plotWidth, margin.top);
  ctx.lineTo(margin.left + plotWidth, margin.top + plotHeight);
  ctx.stroke();
  
  // Alt eksen
  ctx.strokeStyle = VE_ENG_C.eksen;
  ctx.beginPath();
  ctx.moveTo(margin.left, margin.top + plotHeight);
  ctx.lineTo(margin.left + plotWidth, margin.top + plotHeight);
  ctx.stroke();
  
  // X ekseni etiketleri
  ctx.fillStyle = VE_ENG_C.etiket;
  ctx.font = '9px system-ui';
  ctx.textAlign = 'center';
  for(var i = 0; i <= 4; i++) {
    var xVal = xMin + (xMax - xMin) * i / 4;
    var xPos = xScale(xVal);
    ctx.fillText(Math.round(xVal), xPos, margin.top + plotHeight + 15);
  }
  ctx.fillText('Devir [rpm]', margin.left + plotWidth / 2, 200 - 5);
  
  // Sol Y ekseni etiketleri (Tork) — çok eksenli grafikte etiket, ait olduğu
  // eğrinin tonunu taşır (osiloskop/CANoe kuralı). Eksen ÇİZGİSİ nötr kaldı
  // ki tonlama iki kez tekrarlanmasın.
  ctx.fillStyle = VE_ENG_C.seri1;
  ctx.textAlign = 'right';
  for(var i = 0; i <= 4; i++) {
    var yVal = visTorqueLo + (visTorqueHi - visTorqueLo) * i / 4;
    var yPos = yScaleTorque(yVal);
    ctx.fillText(Math.round(yVal), margin.left - 5, yPos + 3);
  }
  
  // Sağ Y ekseni etiketleri (Güç)
  ctx.fillStyle = VE_ENG_C.seri2;
  ctx.textAlign = 'left';
  for(var i = 0; i <= 4; i++) {
    var yVal = visPowerLo + (visPowerHi - visPowerLo) * i / 4;
    var yPos = yScalePower(yVal);
    ctx.fillText(Math.round(yVal), margin.left + plotWidth + 5, yPos + 3);
  }
  
  // Eğriler plot alanına kırpılır — yakınlaştırınca eksen bölgesine taşmasın
  ctx.save();
  ctx.beginPath();
  ctx.rect(margin.left, margin.top, plotWidth, plotHeight);
  ctx.clip();

  // Tork eğrisi
  if(torquePoints.length >= 2) {
    ctx.strokeStyle = VE_ENG_C.seri1;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    torquePoints.forEach(function(p, i) {
      var x = xScale(p.x);
      var y = yScaleTorque(p.y);
      if(i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    
    // Noktalar
    ctx.fillStyle = VE_ENG_C.seri1;
    torquePoints.forEach(function(p) {
      ctx.beginPath();
      ctx.arc(xScale(p.x), yScaleTorque(p.y), 2, 0, Math.PI * 2);
      ctx.fill();
    });
  }
  
  // Güç eğrisi
  if(powerPoints.length >= 2) {
    ctx.strokeStyle = VE_ENG_C.seri2;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    powerPoints.forEach(function(p, i) {
      var x = xScale(p.x);
      var y = yScalePower(p.y);
      if(i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    
    // Noktalar
    ctx.fillStyle = VE_ENG_C.seri2;
    powerPoints.forEach(function(p) {
      ctx.beginPath();
      ctx.arc(xScale(p.x), yScalePower(p.y), 2, 0, Math.PI * 2);
      ctx.fill();
    });
  }
  
  ctx.restore();   // kırpma biter

  // ── Etkileşim (js/panel-chart.js): zoom + pan + crosshair + tooltip ──
  if(typeof pcAttach === 'function') {
    pcAttach(canvas, {
      uid: 've-motor-chart-' + nodeId,
      ml: margin.left, mr: margin.right, mt: margin.top, mb: margin.bottom,
      pw: plotWidth, ph: plotHeight,
      minX: xMin, maxX: xMax, minY: _pcWin.minY, maxY: _pcWin.maxY,
      xFromPx: function(px) { return xMin + (px - margin.left) / plotWidth * (xMax - xMin); },
      yFromPx: function(py) { return _pcWin.minY + (margin.top + plotHeight - py) / plotHeight * (_pcWin.maxY - _pcWin.minY); },
      tooltipWidth: 190,
      tooltipHTML: function(rpm) {
        var t = vePcInterpY(torquePoints, rpm);
        var pw2 = vePcInterpY(powerPoints, rpm);
        if(t === null && pw2 === null) return null;
        var h = '<div style="font-weight:700; color:var(--text-heading); margin-bottom:4px; padding-bottom:3px; border-bottom:1px solid var(--border-color);">' + Math.round(rpm) + ' rpm</div>';
        if(t !== null) h += '<div style="display:flex; gap:6px; align-items:center; padding:1px 0;"><span style="width:14px;height:3px;background:' + VE_ENG_C.seri1 + ';border-radius:1px;"></span><span style="color:' + VE_ENG_C.seri1 + '; font-weight:600; min-width:42px;">Tork</span><span>' + t.toFixed(0) + ' N·m</span></div>';
        if(pw2 !== null) h += '<div style="display:flex; gap:6px; align-items:center; padding:1px 0;"><span style="width:14px;height:3px;background:' + VE_ENG_C.seri2 + ';border-radius:1px;"></span><span style="color:' + VE_ENG_C.seri2 + '; font-weight:600; min-width:42px;">Güç</span><span>' + pw2.toFixed(1) + ' kW</span></div>';
        return h;
      }
    });
    pcDrawHint(ctx, canvas, margin.left, margin.top, plotWidth, true);
  }

  // NOT: updateVEMotorFitEquation ve updateVENetChart fonksiyonun BAŞINDA
  // çağrılıyor (kanvas kontrolünden önce) — burada tekrar edilmez.
}

// Net Değerler diyagramı — brüt + net overlay
// Aksesuar kaybı hesaplama — RPM bağımlı
// Fan (Kavramalı Fan): küp yasası (RPM/governed)^3
// Diğer aksesuarlar: lineer (RPM/governed)
// Pano metnini "devir ⇥ tork ⇥ güç" satırlarına ayrıştırır (Excel kopyası).
// Ayraç: tab, noktalı virgül veya boşluk — VİRGÜL DEĞİL, TR yerelinde ondalık
// ayracıdır ("1,38" iki sütuna bölünüp sessizce yanlış değer yazılırdı).
// Güç sütunu yoksa torktan türetilir: P = T × n / 9549.3.
function veEngParseSheetText(text) {
  var out = [];
  String(text == null ? '' : text).split(/\r?\n/).forEach(function(line) {
    line = line.trim();
    if(!line) return;
    var parts = line.split(/[\t;]+|\s+/).filter(function(s) { return s !== ''; })
                    .map(function(s) { return parseFloat(s.replace(',', '.')); });
    if(parts.length < 2) return;
    var rpm = parts[0], torque = parts[1];
    if(isNaN(rpm) || rpm <= 0 || isNaN(torque)) return;
    var power = (parts.length > 2 && !isNaN(parts[2])) ? parts[2] : (torque * rpm / 9549.3);
    out.push({rpm: rpm, torque: torque, power: power});
  });
  return out.sort(function(a, b) { return a.rpm - b.rpm; });
}

// Izgaraya pano yapıştırma (Tam Gaz). Mevcut satırların YERİNE geçer.
function onVEEngSheetPaste(nodeId) {
  var apply = function(txt) {
    var parsed = veEngParseSheetText(txt);
    if(!parsed.length) { showToast('Panoda "devir ⇥ tork" biçiminde satır bulunamadı', 'warning'); return; }
    var node = nodes.find(function(n) { return n.id === nodeId; });
    if(!node) return;
    if(!node.data) node.data = {};
    var acc = node.data.accessories || [];
    var gov = (node.data.motorSpecs && node.data.motorSpecs.governedSpeed) || node.data.governedRpm || 2100;
    var tbody = document.getElementById('ve-motor-table-' + nodeId);
    if(tbody) {
      var html = '';
      parsed.forEach(function(r, i) {
        html += veEngSheetRowHTML(nodeId, i + 1, r.rpm, r.torque, +r.power.toFixed(1), acc, gov);
      });
      tbody.innerHTML = html;
    }
    onVEMotorDataChange(nodeId);
    updateVEMotorChart(nodeId);
    showToast(parsed.length + ' satır yapıştırıldı');
  };
  var ask = function() {
    var t = (typeof prompt === 'function') ? prompt('Satırları yapıştırın (devir ⇥ tork ⇥ güç):') : '';
    apply(t || '');
  };
  if(typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.readText) {
    navigator.clipboard.readText().then(apply).catch(ask);
  } else {
    ask();
  }
}

function veCalcAccLossAtRPM(accessories, rpm, governedSpeed) {
  if(!accessories || accessories.length === 0 || !governedSpeed) return 0;
  // Eğrili/manuel/legacy aksesuarlar için tek doğruluk kaynağı (cp-accessories.js).
  if(typeof veAccessoryLossKw === 'function') return veAccessoryLossKw(accessories, rpm, governedSpeed);
  var ratio = rpm / governedSpeed;
  var totalLoss = 0;
  accessories.forEach(function(acc) {
    var loss = acc.userLoss || 0;
    if(loss <= 0) return;
    if(acc.name && acc.name.toLowerCase().indexOf('fan') >= 0) {
      totalLoss += loss * ratio * ratio * ratio;
    } else {
      totalLoss += loss * ratio;
    }
  });
  return totalLoss;
}

function updateVENetChart(nodeId) {
  // Izgaranın ƒ sütunları, satır numaraları ve doğrulama metrikleri KANVASTAN
  // BAĞIMSIZ tazelenir: kanvas henüz yoksa ya da satır sayısı grafiğe yetmiyorsa
  // bile sayılar doğru kalmalı. İkisi de ilgili DOM yoksa sessizce çıkar.
  veEngSheetSyncDerived(nodeId);
  veEngUpdateMetrics(nodeId);

  var canvas = document.getElementById('ve-net-chart-' + nodeId);
  if(!canvas) return;

  var node = nodes.find(function(n) { return n.id === nodeId; });
  if(!node) return;
  var nd = node.data || {};
  var rows = nd.torqueData || [];
  if(rows.length < 2) return;

  var acc = nd.accessories || [];
  var specs = nd.motorSpecs || {};
  var governed = specs.governedSpeed || nd.governedRpm || 2100;

  // Brüt ve net veri
  var grossTorque = [], grossPower = [], netTorque = [], netPower = [];
  rows.forEach(function(r) {
    var rpm = parseFloat(r.rpm) || 0;
    var gT = parseFloat(r.torque) || 0;
    var gP = parseFloat(r.power) || 0;
    if(rpm <= 0) return;
    var lossAtRPM = veCalcAccLossAtRPM(acc, rpm, governed);
    var nP = Math.max(0, gP - lossAtRPM);   // çözücüyle tutarlı: net ≥ 0
    var nT = rpm > 0 ? (nP * 9549.3 / rpm) : 0;
    grossTorque.push({x: rpm, y: gT});
    grossPower.push({x: rpm, y: gP});
    netTorque.push({x: rpm, y: nT});
    netPower.push({x: rpm, y: nP});
  });
  
  if(grossTorque.length < 2) return;
  
  var fit = veFitCanvas(canvas, 200);
  if(!fit) return;
  canvas._veRedraw = function() { updateVENetChart(nodeId); };
  var ctx = fit.ctx;
  var rect = { width: fit.w };
  
  var margin = {left: 50, right: 50, top: 20, bottom: 30};
  var plotWidth = rect.width - margin.left - margin.right;
  var plotHeight = 200 - margin.top - margin.bottom;
  
  var allX = grossTorque.map(function(p) { return p.x; });
  var xMin = Math.min.apply(null, allX);
  var xMax = Math.max.apply(null, allX);
  
  var yMaxTorque = Math.max.apply(null, grossTorque.map(function(p) { return p.y; })) * 1.15;
  var yMaxPower = Math.max.apply(null, grossPower.map(function(p) { return p.y; })) * 1.15;
  
  function xScale(x) { return margin.left + (x - xMin) / (xMax - xMin) * plotWidth; }
  function yScaleT(y) { return margin.top + plotHeight - y / yMaxTorque * plotHeight; }
  function yScaleP(y) { return margin.top + plotHeight - y / yMaxPower * plotHeight; }
  
  // Grid
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth = 1;
  for(var i = 0; i <= 5; i++) {
    var gy = margin.top + plotHeight * i / 5;
    ctx.beginPath(); ctx.moveTo(margin.left, gy); ctx.lineTo(margin.left + plotWidth, gy); ctx.stroke();
  }
  
  // Eksenler
  ctx.strokeStyle = VE_ENG_C.eksen; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(margin.left, margin.top); ctx.lineTo(margin.left, margin.top + plotHeight); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(margin.left + plotWidth, margin.top); ctx.lineTo(margin.left + plotWidth, margin.top + plotHeight); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(margin.left, margin.top + plotHeight); ctx.lineTo(margin.left + plotWidth, margin.top + plotHeight); ctx.stroke();
  
  // X etiketleri
  ctx.fillStyle = VE_ENG_C.etiket; ctx.font = '9px system-ui'; ctx.textAlign = 'center';
  for(var i = 0; i <= 4; i++) {
    var xVal = xMin + (xMax - xMin) * i / 4;
    ctx.fillText(Math.round(xVal), xScale(xVal), margin.top + plotHeight + 15);
  }
  ctx.fillText('Devir [rpm]', margin.left + plotWidth / 2, 200 - 5);
  
  // Sol Y (Tork)
  ctx.fillStyle = VE_ENG_C.seri1; ctx.textAlign = 'right';
  for(var i = 0; i <= 4; i++) { ctx.fillText(Math.round(yMaxTorque * i / 4), margin.left - 5, yScaleT(yMaxTorque * i / 4) + 3); }
  
  // Sağ Y (Güç)
  ctx.fillStyle = VE_ENG_C.seri2; ctx.textAlign = 'left';
  for(var i = 0; i <= 4; i++) { ctx.fillText(Math.round(yMaxPower * i / 4), margin.left + plotWidth + 5, yScaleP(yMaxPower * i / 4) + 3); }
  
  // Çizim yardımcısı
  function drawLine(pts, scaleFn, color, width, dash) {
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.setLineDash(dash || []);
    ctx.beginPath();
    pts.forEach(function(p, i) { var x = xScale(p.x), y = scaleFn(p.y); if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y); });
    ctx.stroke(); ctx.setLineDash([]);
  }
  function drawDots(pts, scaleFn, color, r) {
    ctx.fillStyle = color;
    pts.forEach(function(p) { ctx.beginPath(); ctx.arc(xScale(p.x), scaleFn(p.y), r, 0, Math.PI*2); ctx.fill(); });
  }
  
  // Brüt eğriler: NÖTR kesik çizgi. Renk yalnız net serilerde kalsın —
  // brüt/net aynı paletle çizilince hangisinin çözücüye girdiği okunmuyordu.
  drawLine(grossTorque, yScaleT, 'rgba(117,132,157,0.55)', 1.2, [4,3]);
  drawLine(grossPower, yScaleP, 'rgba(117,132,157,0.55)', 1.2, [4,3]);

  // Net eğriler (düz çizgi, parlak)
  drawLine(netTorque, yScaleT, VE_ENG_C.seri1, 1.5);
  drawDots(netTorque, yScaleT, VE_ENG_C.seri1, 2);
  drawLine(netPower, yScaleP, VE_ENG_C.seri2, 1.5);
  drawDots(netPower, yScaleP, VE_ENG_C.seri2, 2);

  // Governed devri çizgisi — kaybın okunduğu devir grafikte de görünsün
  if(governed > xMin && governed < xMax) {
    ctx.strokeStyle = VE_ENG_C.governed;
    ctx.lineWidth = 1; ctx.setLineDash([3,3]);
    ctx.beginPath();
    ctx.moveTo(xScale(governed), margin.top);
    ctx.lineTo(xScale(governed), margin.top + plotHeight);
    ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = VE_ENG_C.governed; ctx.font = '8px system-ui'; ctx.textAlign = 'right';
    ctx.fillText('governed', xScale(governed) - 3, margin.top + 8);
  }

  // ── Etkileşim (js/panel-chart.js): crosshair + tooltip ──
  // Brüt kanvas kalktığı için bu katman net kanvasa taşındı; tooltip brüt VE
  // net değerleri birlikte gösterir (brüt soluk).
  if(typeof pcAttach === 'function') {
    pcAttach(canvas, {
      uid: 've-net-chart-' + nodeId,
      ml: margin.left, mr: margin.right, mt: margin.top, mb: margin.bottom,
      pw: plotWidth, ph: plotHeight,
      minX: xMin, maxX: xMax, minY: 0, maxY: yMaxTorque,
      xFromPx: function(px) { return xMin + (px - margin.left) / plotWidth * (xMax - xMin); },
      yFromPx: function(py) { return (margin.top + plotHeight - py) / plotHeight * yMaxTorque; },
      tooltipWidth: 210,
      tooltipHTML: function(rpm) {
        var gT = vePcInterpY(grossTorque, rpm), nT = vePcInterpY(netTorque, rpm);
        var gP = vePcInterpY(grossPower, rpm),  nP = vePcInterpY(netPower, rpm);
        if(nT === null && nP === null) return null;
        var line = function(label, color, val, unit, dim) {
          return '<div style="display:flex; gap:6px; align-items:center; padding:1px 0;' + (dim ? ' opacity:0.65;' : '') + '">' +
                 '<span style="width:14px;height:3px;background:' + color + ';border-radius:1px;"></span>' +
                 '<span style="color:' + color + '; font-weight:600; min-width:58px;">' + label + '</span>' +
                 '<span>' + val + ' ' + unit + '</span></div>';
        };
        var h = '<div style="font-weight:700; color:var(--text-heading); margin-bottom:4px;' +
                ' padding-bottom:3px; border-bottom:1px solid var(--border-color);">' + Math.round(rpm) + ' rpm</div>';
        if(gT !== null) h += line('Brüt tork', VE_ENG_C.etiket, gT.toFixed(0), 'N·m', true);
        if(nT !== null) h += line('Net tork',  VE_ENG_C.seri1,  nT.toFixed(0), 'N·m');
        if(gP !== null) h += line('Brüt güç',  VE_ENG_C.etiket, gP.toFixed(1), 'kW', true);
        if(nP !== null) h += line('Net güç',   VE_ENG_C.seri2,  nP.toFixed(1), 'kW');
        return h;
      }
    });
    // NOT: pcDrawHint (kanvas üstüne yazılan ipucu) burada ÇAĞRILMAZ — ipucu
    // panelde gerçek metin olarak zaten var; ikisi birden governed etiketiyle
    // üst üste biniyordu.
  }
}

function updateVEMotorFitEquation(nodeId, torquePoints, powerPoints) {
  var fitDiv = document.getElementById('ve-motor-fit-' + nodeId);
  var methodEl = document.getElementById('ve-fit-method-' + nodeId);
  if(!fitDiv) return;
  
  var method = methodEl ? methodEl.value : 'linear';
  
  if(torquePoints.length < 2) {
    fitDiv.innerHTML = 'Yeterli veri yok.';
    return;
  }
  
  var html = '';
  
  if(method === 'linear') {
    html = '<b>Lineer İnterpolasyon:</b><br>';
    html += '<span style="color:var(--text-muted);">Veri noktaları arasında doğrusal geçiş.</span>';
  } else if(method === 'pchip') {
    html = '<b>PCHIP Spline:</b><br>';
    html += '<span style="color:var(--text-muted);">Monoton kübik interpolasyon (pürüzsüz).</span>';
  } else if(method === 'poly') {
    var degreeEl = document.getElementById('ve-poly-degree-' + nodeId);
    var degree = degreeEl ? parseInt(degreeEl.value) : 3;
    
    // Tork için polinom fit
    var torqueCoeffs = polyFit(
      torquePoints.map(function(p) { return p.x; }), 
      torquePoints.map(function(p) { return p.y; }), 
      Math.min(degree, torquePoints.length - 1)
    );
    
    if(torqueCoeffs) {
      var torqueR2 = computeVER2(
        torquePoints.map(function(p) { return p.x; }),
        torquePoints.map(function(p) { return p.y; }),
        torqueCoeffs
      );
      
      html += '<b style="color:#4aa3ff;">Tork [Nm]</b> (' + torqueCoeffs.length + '. derece)';
      html += ' <span style="color:var(--text-muted);">R²=' + torqueR2.toFixed(4) + '</span><br>';
      html += '<span style="font-size:var(--fs-tiny);">T(n) = ' + formatVEPolynomial(torqueCoeffs) + '</span>';
    }
    
    // Güç için polinom fit
    if(powerPoints.length >= 2) {
      var powerCoeffs = polyFit(
        powerPoints.map(function(p) { return p.x; }), 
        powerPoints.map(function(p) { return p.y; }), 
        Math.min(degree, powerPoints.length - 1)
      );
      
      if(powerCoeffs) {
        var powerR2 = computeVER2(
          powerPoints.map(function(p) { return p.x; }),
          powerPoints.map(function(p) { return p.y; }),
          powerCoeffs
        );
        
        html += '<br><b style="color:#ff6b6b;">Güç [kW]</b> (' + powerCoeffs.length + '. derece)';
        html += ' <span style="color:var(--text-muted);">R²=' + powerR2.toFixed(4) + '</span><br>';
        html += '<span style="font-size:var(--fs-tiny);">P(n) = ' + formatVEPolynomial(powerCoeffs) + '</span>';
      }
    }
  }
  
  fitDiv.innerHTML = html;
}

// R² hesaplama
function computeVER2(xs, ys, coeffs) {
  var n = xs.length;
  if(!coeffs || !coeffs.length || n === 0) return 0;
  
  // Ortalama y
  var meanY = 0;
  for(var i = 0; i < n; i++) {
    meanY += ys[i];
  }
  meanY /= n;
  
  var sse = 0;
  var sst = 0;
  
  for(var i = 0; i < n; i++) {
    var x = xs[i];
    var y = ys[i];
    
    // Polinomu değerlendir
    var yPred = 0;
    var xPow = 1;
    for(var k = 0; k < coeffs.length; k++) {
      yPred += coeffs[k] * xPow;
      xPow *= x;
    }
    
    var e = y - yPred;
    sse += e * e;
    
    var dy = y - meanY;
    sst += dy * dy;
  }
  
  return sst > 0 ? 1 - (sse / sst) : 1;
}

// Polinom formatla
function formatVEPolynomial(coeffs) {
  var parts = [];
  for(var i = 0; i < coeffs.length; i++) {
    var c = coeffs[i];
    if(Math.abs(c) < 1e-10) continue;
    
    var term = '';
    if(i === 0) {
      term = c.toFixed(2);
    } else {
      var sign = c >= 0 ? '+' : '-';
      var absC = Math.abs(c);
      if(absC < 0.001) {
        term = sign + absC.toExponential(2) + '·n';
      } else {
        term = sign + absC.toFixed(4) + '·n';
      }
      if(i > 1) term += '^' + i;
    }
    parts.push(term);
  }
  return parts.join(' ') || '0';
}

// Basit polinom fit (en küçük kareler)
function polyFit(x, y, degree) {
  if(x.length < degree + 1) return null;
  
  var n = x.length;
  var matrixSize = degree + 1;
  
  // Vandermonde matrisi oluştur
  var X = [];
  for(var i = 0; i < n; i++) {
    var row = [];
    for(var j = 0; j <= degree; j++) {
      row.push(Math.pow(x[i], j));
    }
    X.push(row);
  }
  
  // X^T * X
  var XtX = [];
  for(var i = 0; i <= degree; i++) {
    var row = [];
    for(var j = 0; j <= degree; j++) {
      var sum = 0;
      for(var k = 0; k < n; k++) {
        sum += X[k][i] * X[k][j];
      }
      row.push(sum);
    }
    XtX.push(row);
  }
  
  // X^T * y
  var Xty = [];
  for(var i = 0; i <= degree; i++) {
    var sum = 0;
    for(var k = 0; k < n; k++) {
      sum += X[k][i] * y[k];
    }
    Xty.push(sum);
  }
  
  // Gauss eliminasyonu ile çöz
  for(var i = 0; i < matrixSize; i++) {
    var maxRow = i;
    for(var k = i + 1; k < matrixSize; k++) {
      if(Math.abs(XtX[k][i]) > Math.abs(XtX[maxRow][i])) maxRow = k;
    }
    var temp = XtX[i]; XtX[i] = XtX[maxRow]; XtX[maxRow] = temp;
    var t = Xty[i]; Xty[i] = Xty[maxRow]; Xty[maxRow] = t;
    
    for(var k = i + 1; k < matrixSize; k++) {
      var c = XtX[k][i] / XtX[i][i];
      for(var j = i; j < matrixSize; j++) {
        XtX[k][j] -= c * XtX[i][j];
      }
      Xty[k] -= c * Xty[i];
    }
  }
  
  // Geri yerine koyma
  var coeffs = new Array(matrixSize);
  for(var i = matrixSize - 1; i >= 0; i--) {
    coeffs[i] = Xty[i];
    for(var j = i + 1; j < matrixSize; j++) {
      coeffs[i] -= XtX[i][j] * coeffs[j];
    }
    coeffs[i] /= XtX[i][i];
  }
  
  return coeffs;
}

