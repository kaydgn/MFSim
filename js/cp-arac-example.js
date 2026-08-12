// ============================================================================
//  ARAÇ PERFORMANS — BAŞLANGIÇ VE ÖRNEKLER
// ============================================================================
// Takoz modülündeki "Başlangıç ve Örnekler" (mnt-example) bileşeninin Araç
// Performans karşılığı. Aynı kalıp:
//   • kayıt defteri (AP_EXAMPLES) → panel açılır listesi
//   • her girdi bir JSON topolojiye (assets/examples/ap_*.json) işaret eder
//   • "Örneği Aktar" o JSON'u İÇ topolojiye birebir kurar
//   • "İç Topolojiyi JSON Dışa Aktar" ile kullanıcı yeni örnek üretir
//
// Örneklerin tamamı gerçek Allison iSCAAN raporlarından çıkarıldı; bileşen
// değerleri (motor eğrisi, K-faktörü, vites oranları/verimleri, aks, transfer,
// lastik, Crr) rapordan ölçüldü ya da türetildi. Ayrıntı: assets/examples/README.md.

var AP_EXAMPLES = [
    {
      id: 'turan', name: 'TURAN — ISB6.7 340 / 3000 SP',
      vehicle: 'BMC TURAN', subtitle: '4×4 · 13.06 t · TC413',
      description: 'Programın kalibrasyon referansı. Cummins ISB6.7 340 (FR98387), Allison 3000 SP, TC413 konvertör, 5.904 aks, 1.257/2.337 iki kademeli transfer. iSCAAN 497-A321222-1 raporundan birebir kuruldu.',
      specs: [
        ['Motor', '252 kW · 1100 N·m · governed 2800 rpm'],
        ['Aksesuar kaybı', '25.3 kW'],
        ['Tork konvertörü', 'TC413 · stall τ 2.440 · K 73.3'],
        ['Şanzıman', '3000 SP · 6 ileri vites (3.487 … 0.652)'],
        ['Aks / transfer', '5.904 · 1.257 / 2.337'],
        ['Lastik', 'r 0.531 m · Crr 0.00356'],
        ['Araç', '13.06 t · A 6.111 m² · Cd 0.75'],
      ],
      image: 'assets/examples/ap_turan.png',
      topology: 'assets/examples/ap_turan_topoloji.json'
    },
    {
      id: 'bmc10ton_380_32t', name: 'BMC 10TON 6×6 — ISG12 380HP',
      vehicle: 'BMC 10TON 6×6', subtitle: '6×6 · 32 t · 4500 SP / TC551',
      description: 'Üç akslı askeri kamyon: transfer kutusu üç çıkışlı, üç diferansiyel, altı tekerlek. Cummins ISG12 380HP, Allison 4500 SP, 8.337 aks, 0.874/1.536 transfer. iSCAAN 497-A355435-1.',
      specs: [
        ['Motor', '283 kW · 1998 N·m · governed 1900 rpm'],
        ['Aksesuar kaybı', '41.6 kW'],
        ['Tork konvertörü', 'TC551 · stall τ 1.794 · K 38.3'],
        ['Şanzıman', 'Allison 4500 SP · 6 ileri vites (4.695 … 0.672)'],
        ['Aks / transfer', '8.337 · 0.874 / 1.536'],
        ['Lastik', 'r 0.608 m · Crr 0.00422'],
        ['Araç', '32 t · A 7.020 m² · Cd 0.75'],
      ],
      image: 'assets/examples/ap_bmc10ton_380_32t.png',
      topology: 'assets/examples/ap_bmc10ton_380_32t_topoloji.json'
    },
    {
      id: 'bmc10ton_380_30t', name: 'BMC 10TON 6×6 — 30 t (5. Nesil)',
      vehicle: 'BMC 10TON 6×6', subtitle: '6×6 · 30 t · 5. Nesil kontrol',
      description: '32 t sürümün hafifletilmiş hâli, Allison 5. Nesil kontrollerle. Geçiş noktaları 6. Nesille birebir aynı çıkar — kontrol nesli vites programını değiştirmiyor. iSCAAN 497-A355294-1.',
      specs: [
        ['Motor', '283 kW · 1998 N·m · governed 1900 rpm'],
        ['Aksesuar kaybı', '41.6 kW'],
        ['Tork konvertörü', 'TC551 · stall τ 1.794 · K 38.3'],
        ['Şanzıman', 'Allison 4500 SP · 6 ileri vites (4.695 … 0.672)'],
        ['Aks / transfer', '8.337 · 0.874 / 1.536'],
        ['Lastik', 'r 0.608 m · Crr 0.00422'],
        ['Araç', '30 t · A 7.020 m² · Cd 0.75'],
      ],
      image: 'assets/examples/ap_bmc10ton_380_30t.png',
      topology: 'assets/examples/ap_bmc10ton_380_30t_topoloji.json'
    },
    {
      id: 'bmc10ton_400', name: 'BMC 10TON 6×6 — ISG12 400HP',
      vehicle: 'BMC 10TON 6×6', subtitle: '6×6 · 32 t · 298 kW',
      description: '380HP sürümüyle aynı güç aktarma organları, daha güçlü motor (298 kW, mekanik kontrol). Tork platosu 1400 rpm’e kadar uzuyor. iSCAAN 497-A355435-1 Iter. 3.',
      specs: [
        ['Motor', '298 kW · 1998 N·m · governed 1900 rpm'],
        ['Aksesuar kaybı', '43.9 kW'],
        ['Tork konvertörü', 'TC551 · stall τ 1.794 · K 38.3'],
        ['Şanzıman', 'Allison 4500 SP · 6 ileri vites (4.695 … 0.672)'],
        ['Aks / transfer', '8.337 · 0.874 / 1.536'],
        ['Lastik', 'r 0.608 m · Crr 0.00422'],
        ['Araç', '32 t · A 7.020 m² · Cd 0.75'],
      ],
      image: 'assets/examples/ap_bmc10ton_400.png',
      topology: 'assets/examples/ap_bmc10ton_400_topoloji.json'
    },
    {
      id: 'bmc10ton_430_32t', name: 'BMC 10TON 6×6 — ISG12 430HP',
      vehicle: 'BMC 10TON 6×6', subtitle: '6×6 · 32 t · 320 kW',
      description: 'Aynı 6×6 platformun 430HP motorlu sürümü. Aksesuar yükü 47 kW’a çıkıyor. iSCAAN 497-A355435-1 Iter. 4.',
      specs: [
        ['Motor', '320 kW · 1998 N·m · governed 1900 rpm'],
        ['Aksesuar kaybı', '47.0 kW'],
        ['Tork konvertörü', 'TC551 · stall τ 1.794 · K 38.2'],
        ['Şanzıman', '4500 SP · 6 ileri vites (4.695 … 0.672)'],
        ['Aks / transfer', '8.337 · 0.874 / 1.536'],
        ['Lastik', 'r 0.608 m · Crr 0.00422'],
        ['Araç', '32 t · A 7.020 m² · Cd 0.75'],
      ],
      image: 'assets/examples/ap_bmc10ton_430_32t.png',
      topology: 'assets/examples/ap_bmc10ton_430_32t_topoloji.json'
    },
    {
      id: 'bmc10ton_430_30t', name: 'BMC 10TON 6×6 — 430HP / 30 t',
      vehicle: 'BMC 10TON 6×6', subtitle: '6×6 · 30 t · 5. Nesil kontrol',
      description: '430HP motor + 30 t kütle + 5. Nesil kontroller. iSCAAN 497-A355294-1 Iter. 3.',
      specs: [
        ['Motor', '320 kW · 1998 N·m · governed 1900 rpm'],
        ['Aksesuar kaybı', '47.0 kW'],
        ['Tork konvertörü', 'TC551 · stall τ 1.794 · K 38.2'],
        ['Şanzıman', '4500 SP · 6 ileri vites (4.695 … 0.672)'],
        ['Aks / transfer', '8.337 · 0.874 / 1.536'],
        ['Lastik', 'r 0.608 m · Crr 0.00422'],
        ['Araç', '30 t · A 7.020 m² · Cd 0.75'],
      ],
      image: 'assets/examples/ap_bmc10ton_430_30t.png',
      topology: 'assets/examples/ap_bmc10ton_430_30t_topoloji.json'
    },
    {
      id: 'bmc10ton_460', name: 'BMC 10TON 6×6 — ISG12 460HP',
      vehicle: 'BMC 10TON 6×6', subtitle: '6×6 · 32 t · 343 kW',
      description: 'Platformun en güçlü sürümü (343 kW). iSCAAN bu eşleşmede TC551’i "Unacceptable" işaretliyor — konvertör motora göre küçük kalıyor; örnek bunu göstermek için de değerli. iSCAAN 497-A355435-1 Iter. 5.',
      specs: [
        ['Motor', '343 kW · 2101 N·m · governed 1900 rpm'],
        ['Aksesuar kaybı', '37.7 kW'],
        ['Tork konvertörü', 'TC551 · stall τ 1.794 · K 38.3'],
        ['Şanzıman', '4500 SP · 6 ileri vites (4.695 … 0.672)'],
        ['Aks / transfer', '8.337 · 0.874 / 1.536'],
        ['Lastik', 'r 0.608 m · Crr 0.00422'],
        ['Araç', '32 t · A 7.020 m² · Cd 0.75'],
      ],
      image: 'assets/examples/ap_bmc10ton_460.png',
      topology: 'assets/examples/ap_bmc10ton_460_topoloji.json'
    },
    {
      id: 'tta2', name: 'BMC TTA2 — AZRA I4 280 kW',
      vehicle: 'BMC TTA2', subtitle: '4×4 · 21.1 t · 3200 SP / TC421',
      description: 'Yerli BMC AZRA I4 motor (280 kW @2100), Allison 3200 SP, 6.54 aks, 1.054/2.337 transfer. Programın en iyi eşleşen örneği: hızlanma süreleri iSCAAN ile %1 içinde. iSCAAN 497-A299082-1.',
      specs: [
        ['Motor', '280 kW · 1600 N·m · governed 2100 rpm'],
        ['Aksesuar kaybı', '28.0 kW'],
        ['Tork konvertörü', 'TC421 · stall τ 1.770 · K 47.9'],
        ['Şanzıman', '3200 SP · 6 ileri vites (3.487 … 0.653)'],
        ['Aks / transfer', '6.54 · 1.054 / 2.337'],
        ['Lastik', 'r 0.608 m · Crr 0.00419'],
        ['Araç', '21.1 t · A 9.000 m² · Cd 0.75'],
      ],
      image: 'assets/examples/ap_tta2.png',
      topology: 'assets/examples/ap_tta2_topoloji.json'
    },
    {
      id: 'isb340_tc411', name: 'ISB6.7 340 — 3200 SP / TC411',
      vehicle: 'BMC 4×4', subtitle: '4×4 · 13.15 t · TC411 (Recommended)',
      description: 'TURAN ile aynı motor, farklı şanzıman ve konvertör: 3200 SP + TC411. iSCAAN konvertörü "Recommended" işaretliyor. 497-A380681-1.',
      specs: [
        ['Motor', '252 kW · 1100 N·m · governed 2800 rpm'],
        ['Aksesuar kaybı', '25.3 kW'],
        ['Tork konvertörü', 'TC411 · stall τ 2.710 · K 98.1'],
        ['Şanzıman', '3200 SP · 6 ileri vites (3.487 … 0.652)'],
        ['Aks / transfer', '5.833 · 1.09 / 2.47'],
        ['Lastik', 'r 0.522 m · Crr 0.00355'],
        ['Araç', '13.15 t · A 6.111 m² · Cd 0.75'],
      ],
      image: 'assets/examples/ap_isb340_tc411.png',
      topology: 'assets/examples/ap_isb340_tc411_topoloji.json'
    },
    {
      id: 'isb340_tc413', name: 'ISB6.7 340 — 3200 SP / TC413',
      vehicle: 'BMC 4×4', subtitle: '4×4 · 13.15 t · TC413',
      description: 'Bir öncekiyle aynı araç, TC413 konvertörle. İki konvertörün etkisini yan yana karşılaştırmak için ikisi birlikte duruyor. iSCAAN 497-A380684-1.',
      specs: [
        ['Motor', '252 kW · 1100 N·m · governed 2800 rpm'],
        ['Aksesuar kaybı', '25.3 kW'],
        ['Tork konvertörü', 'TC413 · stall τ 2.440 · K 73.3'],
        ['Şanzıman', '3200 SP · 6 ileri vites (3.487 … 0.652)'],
        ['Aks / transfer', '5.833 · 1.09 / 2.47'],
        ['Lastik', 'r 0.522 m · Crr 0.00355'],
        ['Araç', '13.15 t · A 6.111 m² · Cd 0.75'],
      ],
      image: 'assets/examples/ap_isb340_tc413.png',
      topology: 'assets/examples/ap_isb340_tc413_topoloji.json'
    },
    {
      id: 'isg430_4000sp', name: 'ISG12 430 — 4000 SP / TC571',
      vehicle: 'BMC 6×6', subtitle: '6×6 · 30 t · 4000 SP',
      description: 'Allison 4000 SP ailesinin örneği (3.51/1.906/1.429/1.0/0.737/0.639), TC571 konvertör. Altı vites geçişi de raporla ±2 rpm uyuşuyor. iSCAAN 497-A380787-1.',
      specs: [
        ['Motor', '320 kW · 2000 N·m · governed 1900 rpm'],
        ['Aksesuar kaybı', '34.8 kW'],
        ['Tork konvertörü', 'TC571 · stall τ 1.620 · K 32.5'],
        ['Şanzıman', '4000 SP · 6 ileri vites (3.51 … 0.639)'],
        ['Aks / transfer', '8.337 · 0.874 / 1.536'],
        ['Lastik', 'r 0.608 m · Crr 0.00422'],
        ['Araç', '30 t · A 7.020 m² · Cd 0.75'],
      ],
      image: 'assets/examples/ap_isg430_4000sp.png',
      topology: 'assets/examples/ap_isg430_4000sp_topoloji.json'
    },
    {
      id: 'duramax', name: 'GM Duramax 6.6L — 3200 SP',
      vehicle: 'GM Duramax L5D', subtitle: '4×4 · 11.5 t · 470 hp @2800',
      description: 'Yüksek devirli benzin-benzeri dizel (470 hp @2800, ESL 3000). Konvertör stall’ı 1023 rpm’de — TC415 bu motora göre çok büyük, iSCAAN "Unacceptable" diyor. Uç eşleşmelerin nasıl göründüğünü gösteren örnek. iSCAAN 497-A392415-1.',
      specs: [
        ['Motor', '350 kW · 1332 N·m · governed 3000 rpm'],
        ['Aksesuar kaybı', '41.6 kW'],
        ['Tork konvertörü', 'TC415 · stall τ 2.350 · K 66.7'],
        ['Şanzıman', '3200 SP · 6 ileri vites (3.487 … 0.652)'],
        ['Aks / transfer', '7.37 · 1 / 2.47'],
        ['Lastik', 'r 0.513 m · Crr 0.00359'],
        ['Araç', '11.5 t · A 6.111 m² · Cd 0.75'],
      ],
      image: 'assets/examples/ap_duramax.png',
      topology: 'assets/examples/ap_duramax_topoloji.json'
    },
    {
      id: 'ypa4x4', name: 'BMC YPA 4×4 — 2957 SP (9 vites)',
      vehicle: 'BMC YPA', subtitle: '4×4 · 7.65 t · 2957 SP Wide',
      description: 'Dokuz ileri vitesli 2957 SP Wide, TC221, tek kademeli 3.43 transfer. iSCAAN 497-A336126-1.',
      warning: 'Bu şanzımanın vites geçiş profili programda YOK ("2400 rpm Variable" stratejisi); program allison3200sp_s1’e düşüyor ve geçiş noktaları yanlış oluyor. Topoloji ve bileşen değerleri doğru — geçiş programı kalibre edilene kadar hızlanma izine güvenme.',
      specs: [
        ['Motor', '157 kW · 759 N·m · governed 2500 rpm'],
        ['Aksesuar kaybı', '19.3 kW'],
        ['Tork konvertörü', 'TC221 · stall τ 1.730 · K 84.0'],
        ['Şanzıman', '2957 SP · 9 ileri vites (4.822 … 0.568)'],
        ['Aks / transfer', '1.706 · 3.43 (tek kademe)'],
        ['Lastik', 'r 0.436 m · Crr 0.00335'],
        ['Araç', '7.65 t · A 5.750 m² · Cd 0.75'],
      ],
      image: 'assets/examples/ap_ypa4x4.png',
      topology: 'assets/examples/ap_ypa4x4_topoloji.json'
    },
    {
      id: 'jmma', name: 'BMC 4x4-JMMA — 3000 SP / TC413',
      vehicle: 'BMC 4x4-JMMA', subtitle: '4×4 · 12.3 t · Goodyear 335/80R20',
      description: 'TURAN ile aynı motor/konvertör/şanzıman üçlüsü, farklı aks (7.370), transfer (1.000/2.470) ve lastik. iSCAAN 497-A392127-1.',
      warning: 'Kaynak rapor yalnız "Input Summary" — performans tabloları yok. TK eğrisi ve vites oranları TURAN raporundan alındı (aynı donanım), Crr varsayıldı. DOĞRULANMADI.',
      specs: [
        ['Motor', '252 kW · 1100 N·m · governed 2800 rpm'],
        ['Aksesuar kaybı', '25.3 kW'],
        ['Tork konvertörü', 'TC413 · stall τ 2.440 · K 73.3'],
        ['Şanzıman', '3000 SP · 6 ileri vites (3.487 … 0.652)'],
        ['Aks / transfer', '7.37 · 1 / 2.47'],
        ['Lastik', 'r 0.513 m · Crr 0.00355'],
        ['Araç', '12.3 t · A 6.111 m² · Cd 0.75'],
      ],
      image: 'assets/examples/ap_jmma.png',
      topology: 'assets/examples/ap_jmma_topoloji.json'
    },
    {
      id: 'bmc4x4_25t', name: 'BMC 4X4 2.5T — AZRA I4 / 3200 SP',
      vehicle: 'BMC 4X4 2.5T', subtitle: '4×4 · 17 t · TC421',
      description: 'AZRA I4 280 kW, Allison 3200 SP, 7.75 aks, 0.880/1.769 transfer. iSCAAN 497-A339391-1.',
      warning: 'Kaynak rapor yalnız "Input Summary". TK eğrisi ve vites oranları TTA2 raporundan alındı (aynı 3200 SP + TC421). DOĞRULANMADI.',
      specs: [
        ['Motor', '280 kW · 1600 N·m · governed 2100 rpm'],
        ['Aksesuar kaybı', '28.0 kW'],
        ['Tork konvertörü', 'TC421 · stall τ 1.770 · K 47.9'],
        ['Şanzıman', '3200 SP · 6 ileri vites (3.487 … 0.653)'],
        ['Aks / transfer', '7.75 · 0.88 / 1.769'],
        ['Lastik', 'r 0.608 m · Crr 0.00419'],
        ['Araç', '17 t · A 9.000 m² · Cd 0.75'],
      ],
      image: 'assets/examples/ap_bmc4x4_25t.png',
      topology: 'assets/examples/ap_bmc4x4_25t_topoloji.json'
    },
];

// ── Kayıt defteri erişimi ───────────────────────────────────────────────────
function veApExampleList(){ return AP_EXAMPLES; }
function veApExample(id){
  for(var i=0;i<AP_EXAMPLES.length;i++) if(AP_EXAMPLES[i].id===id) return AP_EXAMPLES[i];
  return AP_EXAMPLES[0];
}

function _apEsc(s){
  return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Panel ───────────────────────────────────────────────────────────────────
function getApExamplePropertiesHTML(node){
  if(!node.data) node.data = {};
  var list = veApExampleList();
  var sel = node.data.exampleKey || (list[0] && list[0].id);
  var ex = veApExample(sel);
  var nid = node.id;

  var left = '';
  left += '<div style="font-size:var(--fs-micro); font-weight:700; color:var(--text-secondary); letter-spacing:0.04em; text-transform:uppercase; margin-bottom:5px;">Örnek Araç</div>';
  left += '<select id="ve-ap-example-sel" onchange="veApSetExample(\'' + nid + '\',this.value)" style="width:100%; padding:5px 8px; font-size:var(--fs-body); background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:var(--radius-sm); margin-bottom:11px;">';
  list.forEach(function(e){
    left += '<option value="' + _apEsc(e.id) + '"' + (sel===e.id?' selected':'') + '>' + _apEsc(e.name) + (e.warning?' ⚠':'') + '</option>';
  });
  left += '</select>';

  left += '<div style="margin-bottom:12px;">';
  left += '<div style="font-size:var(--fs-lg); font-weight:700; color:var(--text-heading); line-height:1.25;">' + _apEsc(ex.vehicle) + '</div>';
  if(ex.subtitle) left += '<div style="font-size:var(--fs-tiny); color:var(--accent-primary); font-weight:600; margin-top:2px;">' + _apEsc(ex.subtitle) + '</div>';
  if(ex.description) left += '<div style="font-size:var(--fs-tiny); color:var(--text-secondary); line-height:1.5; margin-top:7px;">' + _apEsc(ex.description) + '</div>';
  left += '</div>';

  if(ex.warning){
    left += '<div style="padding:8px 10px; margin-bottom:12px; font-size:var(--fs-tiny); line-height:1.45; color:var(--text-secondary); background:var(--bg-secondary); border:1px solid var(--border-color); border-left:3px solid var(--accent-warning);">'
         +  '<b style="color:var(--accent-warning);">Dikkat.</b> ' + _apEsc(ex.warning) + '</div>';
  }

  var specs = ex.specs || [];
  if(specs.length){
    left += '<table style="width:100%; font-size:var(--fs-tiny); border-collapse:collapse; border:1px solid var(--border-color); margin-bottom:13px;">';
    specs.forEach(function(r){
      left += '<tr style="border-bottom:1px solid var(--border-color);">'
           +  '<th style="padding:5px 9px; text-align:left; background:var(--bg-tertiary); border-right:1px solid var(--border-color); width:38%; font-weight:500; color:var(--text-secondary); white-space:nowrap;">' + _apEsc(r[0]) + '</th>'
           +  '<td style="padding:5px 9px; color:var(--text-primary); font-weight:600;">' + _apEsc(r[1]) + '</td></tr>';
    });
    left += '</table>';
  }

  left += '<button onclick="veApLoadExample(\'' + nid + '\')" style="width:100%; padding:11px 14px; font-size:var(--fs-md); font-weight:700; background:var(--accent-warning); color:#111; border:none; cursor:pointer; border-radius:var(--radius-sm); letter-spacing:0.02em;" onmouseover="this.style.filter=\'brightness(1.1)\'" onmouseout="this.style.filter=\'none\'">▶ Örneği Aktar</button>';
  left += '<button onclick="veApExportTopology()" title="Kanvastaki iç topolojiyi JSON dosyası olarak indir — yeni örnek üretmek için" style="width:100%; margin-top:8px; padding:8px 14px; font-size:var(--fs-body); font-weight:600; background:var(--bg-tertiary); color:var(--text-secondary); border:1px solid var(--border-color); cursor:pointer; border-radius:var(--radius-sm);" onmouseover="this.style.borderColor=\'var(--accent-primary)\'; this.style.color=\'var(--text-primary)\'" onmouseout="this.style.borderColor=\'var(--border-color)\'; this.style.color=\'var(--text-secondary)\'">↓ İç Topolojiyi JSON Dışa Aktar</button>';

  var right = '';
  if(ex.image){
    right += '<div style="font-size:var(--fs-micro); font-weight:700; color:var(--text-muted); letter-spacing:0.03em; text-transform:uppercase; margin-bottom:5px;">Topoloji</div>';
    right += '<div style="width:100%; padding:14px; box-sizing:border-box; border:1px solid var(--border-color); background:var(--bg-primary); border-radius:var(--radius-md); overflow:hidden; text-align:center;">'
          +  '<img src="' + _apEsc(ex.image) + '" alt="Topoloji şeması" loading="lazy" style="display:block; width:100%; height:auto;" onerror="this.style.display=\'none\';"/>'
          +  '</div>';
  }

  var html = '<div class="sw-panel">';
  html += '<div class="ve-cp-grid">';
  html += '<div class="ve-cp-col ve-cp-col--in">' + left + '</div>';
  html += '<div class="ve-cp-col ve-cp-col--out">' + right + '</div>';
  html += '</div></div>';
  return html;
}

function veApSetExample(nodeId, key){
  var node = (typeof nodes!=='undefined') ? nodes.find(function(n){ return n.id===nodeId; }) : null;
  if(!node) return;
  if(!node.data) node.data = {};
  node.data.exampleKey = key;
  if(typeof selectNode==='function') selectNode(node);
  else if(typeof showNodeProperties==='function') showNodeProperties(node);
}

// ── Topoloji çözümü: gömülü tablo → fetch ──────────────────────────────────
// build.js bütün assets/examples/*.json dosyalarını window.__MNT_TOPOLOGIES'e
// gömüyor (ad takoz tarafından kalma; harita URL→JSON, tipten bağımsız).
// file:// üzerinde fetch engelli olduğu için gömülü tablo şart.
function _apResolveTopology(ref, cb){
  if(ref && typeof ref==='object'){ cb(_apTopoState(ref)); return; }
  var url = String(ref||''); if(!url){ cb(null); return; }
  var emb = (typeof window!=='undefined' && window.__MNT_TOPOLOGIES) ? window.__MNT_TOPOLOGIES[url] : null;
  if(emb){ cb(_apTopoState(emb)); return; }
  if(typeof fetch==='function'){
    fetch(url).then(function(r){ if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); })
      .then(function(j){ cb(_apTopoState(j)); })
      .catch(function(){ cb(null); });
  } else { cb(null); }
}

// Örnek dosyası ya da tam proje kaydı → veLoadTabState'in beklediği durum.
function _apTopoState(j){
  if(!j || typeof j!=='object') return null;
  if(j.nodes && j.nodes.length) {
    return { schemaVersion: (typeof VE_SCHEMA_VERSION!=='undefined'?VE_SCHEMA_VERSION:2),
             nodes: j.nodes, connections: j.connections||[],
             compCounter: j.compCounter || j.nodes.length,
             canvasOffset: j.canvasOffset, canvasZoom: j.canvasZoom,
             undoStack: [], redoStack: [], simResults: null, resultSlots: [{},{},{},{}],
             annotations: j.annotations||[] };
  }
  // Proje kaydı ({tabs:[{state:…}]}) — ilk dolu sekmenin arac-performans alt topolojisi
  var tabs = j.tabs||[];
  for(var i=0;i<tabs.length;i++){
    var st = tabs[i] && tabs[i].state;
    if(!st || !st.nodes) continue;
    for(var k=0;k<st.nodes.length;k++){
      var n = st.nodes[k];
      if(n.type==='arac-performans' && n.data && n.data.subTopology) return _apTopoState(n.data.subTopology);
    }
  }
  return null;
}

function veApLoadExample(nodeId){
  var node = (typeof nodes!=='undefined') ? nodes.find(function(n){ return n.id===nodeId; }) : null;
  var key = (node && node.data && node.data.exampleKey) || (veApExampleList()[0]||{}).id;
  var ex = veApExample(key);
  if(!ex || !ex.topology){ if(typeof showToast==='function') showToast('Örnek topolojisi tanımlı değil.','warning'); return; }

  // Kanvasta güç aktarma bileşeni varsa üzerine yazmadan önce sor.
  var POWER = { engine:1, 'torque-converter':1, gearbox:1, propshaft:1, transfer:1, differential:1, wheel:1 };
  var hasChain = (typeof nodes!=='undefined') && nodes.some(function(n){ return POWER[n.type]; });
  if(hasChain && typeof confirm==='function'){
    if(!confirm('İç topoloji, seçilen örnekle DEĞİŞTİRİLECEK. Devam edilsin mi?')) return;
  }

  _apResolveTopology(ex.topology, function(state){
    if(!state || !state.nodes || !state.nodes.length){
      if(typeof showToast==='function') showToast('Örnek topolojisi yüklenemedi.','warning');
      return;
    }
    if(typeof veLoadTabState==='function') veLoadTabState({ state: state });
    // Başka örnek yüklenebilsin diye "Başlangıç ve Örnekler" düğümünü geri koy.
    if(typeof nodes!=='undefined' && !nodes.some(function(n){ return n.type==='ap-example'; })
       && typeof createNode==='function'){
      var base = (typeof veArrangeModuleBase==='function' && typeof VE_ARAC_PERFORMANS_LAYOUT!=='undefined')
        ? veArrangeModuleBase(VE_ARAC_PERFORMANS_LAYOUT) : { x:3000, y:3000 };
      var created = createNode('ap-example', base.x + 30, base.y - 40);
      if(created){ created.data = created.data || {}; created.data.exampleKey = ex.id; }
    }
    if(typeof saveState==='function') saveState();
    if(typeof updateAllConnections==='function') updateAllConnections();
    // Kamera: kayıttaki kamera örneği ÜRETEN pencerenin ölçüsüne göreydi.
    if(typeof veFitViewToContent==='function') veFitViewToContent({ maxZoom:1 });
    if(typeof veUpdateWarnings==='function') veUpdateWarnings();
    if(typeof showToast==='function') showToast('Örnek yüklendi — ' + ex.vehicle + '.','info');
  });
}

// İç topolojiyi JSON olarak dışa aktar — kullanıcı bununla yeni örnek üretir.
function veApExportTopology(){
  if(typeof veSerializeCurrentState!=='function'){
    if(typeof showToast==='function') showToast('Dışa aktarma kullanılamıyor.','warning'); return;
  }
  if(typeof veFlushOpenPanelData==='function') veFlushOpenPanelData();
  var st = veSerializeCurrentState();
  var out = { format:'mfsim-arac-example', version:1,
    nodes: st.nodes, connections: st.connections,
    compCounter: st.compCounter, canvasOffset: st.canvasOffset, canvasZoom: st.canvasZoom,
    annotations: st.annotations || [] };
  var json = JSON.stringify(out, null, 2);
  if(typeof document==='undefined') return json;
  var blob = new Blob([json], { type:'application/json' });
  if(typeof veShowSaveDialog==='function')
    veShowSaveDialog('arac-ornek-topoloji.json', blob, 'İç topoloji JSON olarak kaydedildi (' + (st.nodes||[]).length + ' düğüm)');
  return json;
}

// Jest/Node köprüsü (tarayıcıda no-op)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    AP_EXAMPLES: AP_EXAMPLES,
    veApExampleList: veApExampleList,
    veApExample: veApExample,
    getApExamplePropertiesHTML: getApExamplePropertiesHTML,
    _apTopoState: _apTopoState
  };
}
