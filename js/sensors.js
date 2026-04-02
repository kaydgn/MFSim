// ═══════════════════════════════════════════════════════════════════════════════
// SENSÖR SİHİRBAZI — Paketler, Topoloji Tarama, Otomatik Yerleştirme
// ═══════════════════════════════════════════════════════════════════════════════

var SENSOR_PACKAGES = [
  // ══════════════════════════════════════════════════════════════
  //  PERFORMANS ANALİZİ (Tam Gaz Hızlanma) — solverTab: 'performance'
  // ══════════════════════════════════════════════════════════════
  {
    id: 'performance', name: 'Performans Eğrileri', icon: '🏁', priority: 'essential',
    solverTab: 'performance',
    description: 'Temel hızlanma performansı: hız-zaman, mesafe-zaman, ivme eğrileri',
    requires: ['vehicle'],
    diagrams: [
      { id:'v-t', name:'Araç Hızı – Zaman', xAxis:'Zaman (s)', yAxis:'Hız (km/h)',
        significance:'En temel performans göstergesi. 0→100 km/h süresini direkt okuyabilirsiniz. Eğrinin eğimi ivmeyi, düzleştiği nokta max hızı verir.' },
      { id:'s-t', name:'Mesafe – Zaman', xAxis:'Zaman (s)', yAxis:'Mesafe (m)',
        significance:'400m veya 1/4 mile süresi gibi standart metrikleri elde etmek için. Eğrinin eğimi anlık hıza eşittir.' },
      { id:'a-v', name:'İvme – Araç Hızı', xAxis:'Hız (km/h)', yAxis:'İvme (m/s²)',
        significance:'Hangi hız aralığında aracın en güçlü/zayıf ivmelendiğini gösterir. Vites geçişleri anlık düşüş olarak görünür.' },
      { id:'a-t', name:'İvme – Zaman', xAxis:'Zaman (s)', yAxis:'İvme (m/s²)',
        significance:'Zamana bağlı ivme profili. Sürücü konforu ve yük güvenliği analizi için — ani ivme değişimleri yük kaymasına neden olabilir.' }
    ],
    sensors: [
      { target:'vehicle', attachment:'component', signal:'v_speed', label:'Araç → Araç Hızı (km/h)' },
      { target:'vehicle', attachment:'component', signal:'v_distance', label:'Araç → Kat Edilen Mesafe (m)' },
      { target:'vehicle', attachment:'component', signal:'v_accel', label:'Araç → İvme (m/s²)' }
    ]
  },
  {
    id: 'engine-analysis', name: 'Motor Çalışma Analizi', icon: '⚙️', priority: 'essential',
    solverTab: 'performance',
    description: 'Motor devri, tork ve güç eğrileri — motorun hızlanma boyunca nasıl çalıştığını gösterir',
    requires: ['engine'],
    diagrams: [
      { id:'rpm-v', name:'Motor Devri – Araç Hızı', xAxis:'Hız (km/h)', yAxis:'Motor Devri (rpm)',
        significance:'Her viteste motorun hangi devir aralığında çalıştığını gösterir. Vites geçişlerinde testere dişi deseni oluşur.' },
      { id:'rpm-t', name:'Motor Devri – Zaman', xAxis:'Zaman (s)', yAxis:'Motor Devri (rpm)',
        significance:'Zamana bağlı devir profili. Testere dişi şeklinde yükselen pattern: her vites tırmanır → shift → düşer → tekrar tırmanır.' },
      { id:'torque-v', name:'Motor Torku – Araç Hızı', xAxis:'Hız (km/h)', yAxis:'Motor Torku (Nm)',
        significance:'Motorun tam gaz tork eğrisinin hangi bölümünde çalıştığını gösterir. Fan ve AC kayıplarının etkisi görülür.' },
      { id:'power-v', name:'Motor Gücü – Araç Hızı', xAxis:'Hız (km/h)', yAxis:'Motor Gücü (kW)',
        significance:'Hıza bağlı efektif güç çıktısı. Fan/AC gibi aksesuarların ne kadar güç çaldığını gösterir.' }
    ],
    sensors: [
      { target:'engine', attachment:'output', signal:'rpm', label:'Motor Çıkışı → Devir (rpm)' },
      { target:'engine', attachment:'output', signal:'torque', label:'Motor Çıkışı → Tork (Nm)' },
      { target:'engine', attachment:'output', signal:'power', label:'Motor Çıkışı → Güç (kW)' }
    ]
  },
  {
    id: 'tc-analysis', name: 'Tork Konvertör Analizi', icon: '🌀', priority: 'recommended',
    solverTab: 'performance',
    description: 'TC çalışma noktası, tork çarpanı, verim ve kayma analizi',
    requires: ['torque-converter'],
    diagrams: [
      { id:'sr-v', name:'Hız Oranı (SR) – Araç Hızı', xAxis:'Hız (km/h)', yAxis:'Speed Ratio (SR)',
        significance:'TC çalışma noktası. SR=0 stall, SR≈0.85-0.90 coupling point, SR=1.0 lockup. Converter→lockup geçişi SR\'nin aniden 1.0\'a sıçraması olarak görülür.' },
      { id:'tr-v', name:'Tork Oranı (TR) – Araç Hızı', xAxis:'Hız (km/h)', yAxis:'Torque Ratio (TR)',
        significance:'TC tork çarpanı. Stall\'da en yüksek (tipik 2.0–3.5×), coupling point\'te 1.0\'a düşer. Lockup\'ta TR tam 1.0 olur.' },
      { id:'eta-tc-v', name:'TC Verimi – Araç Hızı', xAxis:'Hız (km/h)', yAxis:'Verim η (%)',
        significance:'Stall\'da η≈0 (tüm enerji ısıya), coupling point\'te peak (~85-88%), lockup\'ta η=100%. TC\'nin ne kadar verimsiz çalıştığını gösterir.' },
      { id:'tc-slip-v', name:'TC Kayma – Araç Hızı', xAxis:'Hız (km/h)', yAxis:'Kayma (%)',
        significance:'Kayma = (1 - SR) × 100. Stall\'da %100 kayma, lockup\'ta %0. Enerji kaybı ve ısınma profili için önemli.' },
      { id:'tc-io-torque', name:'TC Giriş/Çıkış Torku – Araç Hızı', xAxis:'Hız (km/h)', yAxis:'Tork (Nm)',
        significance:'Pump ve türbin torkları. Aradaki fark TC tork çarpım etkisi. Düşük hızlarda türbin torku pump\'tan çok yüksek (TR > 1).' }
    ],
    sensors: [
      { target:'torque-converter', attachment:'component', signal:'speed_ratio', label:'TC → Hız Oranı (SR)' },
      { target:'torque-converter', attachment:'component', signal:'torque_ratio', label:'TC → Tork Oranı (TR)' },
      { target:'torque-converter', attachment:'component', signal:'efficiency', label:'TC → Verim η (%)' },
      { target:'torque-converter', attachment:'component', signal:'slip', label:'TC → Kayma (%)' },
      { target:'torque-converter', attachment:'input', signal:'torque_in', label:'TC Girişi → Pump Torku (Nm)' },
      { target:'torque-converter', attachment:'output', signal:'torque_out', label:'TC Çıkışı → Türbin Torku (Nm)' }
    ]
  },
  {
    id: 'traction-analysis', name: 'Çekiş Kuvveti Analizi', icon: '💪', priority: 'essential',
    solverTab: 'performance',
    description: 'Tekerlekte çekiş kuvveti, direnç kuvvetleri ve net çekiş gücü',
    requires: ['vehicle'],
    diagrams: [
      { id:'te-v', name:'Çekiş Kuvveti (TE) – Araç Hızı', xAxis:'Hız (km/h)', yAxis:'Çekiş Kuvveti (kN)',
        significance:'İSCAAN temel diyagramı. Her vites ayrı eğri. Converter mod düz, lockup dik iniş. Zarf eğrisi aracın gerçek çekiş kapasitesi.' },
      { id:'dp-v', name:'Net Çekiş (DP) – Araç Hızı', xAxis:'Hız (km/h)', yAxis:'Drawbar Pull (kN)',
        significance:'DP = TE − F_direnç. Sıfıra düştüğü nokta max hız. Gradeability tablosunun doğrudan kaynağı.' },
      { id:'resistances-v', name:'Direnç Kuvvetleri – Araç Hızı', xAxis:'Hız (km/h)', yAxis:'Kuvvet (kN)',
        significance:'Yuvarlanma direnci (sabit), hava direnci (V² ile artar), toplam direnç. Düşük hızlarda yuvarlanma, yüksek hızlarda aero baskın.' },
      { id:'power-balance-v', name:'Güç Dengesi – Araç Hızı', xAxis:'Hız (km/h)', yAxis:'Güç (kW)',
        significance:'Motor gücü, tekerlekte güç, direnç gücü. Aradaki farklar TC kaybı, şanzıman kaybı olarak görülür. Drivetrain verimliliği analizi.' }
    ],
    sensors: [
      { target:'solver', attachment:'component', signal:'tractive_effort', label:'Çözücü → Çekiş Kuvveti TE (kN)' },
      { target:'solver', attachment:'component', signal:'drawbar_pull', label:'Çözücü → Net Çekiş DP (kN)' },
      { target:'road', attachment:'component', signal:'r_rolling_force', label:'Yol → Yuvarlanma Direnci (N)' },
      { target:'road', attachment:'component', signal:'r_aero_force', label:'Yol → Aerodinamik Direnç (N)' },
      { target:'road', attachment:'component', signal:'r_total_resist', label:'Yol → Toplam Direnç (N)' },
      { target:'engine', attachment:'output', signal:'power', label:'Motor Çıkışı → Güç (kW)' },
      { target:'solver', attachment:'component', signal:'wheel_power', label:'Çözücü → Tekerlekte Güç (kW)' }
    ]
  },
  {
    id: 'shift-analysis', name: 'Vites Geçiş Analizi', icon: '🔄', priority: 'recommended',
    solverTab: 'performance',
    description: 'Vites değişim noktaları, şanzıman çıkış parametreleri ve shift kalitesi',
    requires: ['gearbox', 'shift-controller'],
    diagrams: [
      { id:'gear-t', name:'Aktif Vites – Zaman', xAxis:'Zaman (s)', yAxis:'Vites Numarası',
        significance:'Adım fonksiyonu: 1C→2C→2L→3L→… Her adımın genişliği o viteste geçirilen süre. C→L geçişleri de görünür.' },
      { id:'gear-v', name:'Aktif Vites – Araç Hızı', xAxis:'Hız (km/h)', yAxis:'Vites Numarası',
        significance:'Hangi hızda hangi vitese geçildiğini gösterir. Shift hız eşiklerini doğrulamak için kullanılır.' },
      { id:'trans-out-v', name:'Şanzıman Çıkış Torku – Araç Hızı', xAxis:'Hız (km/h)', yAxis:'Çıkış Torku (Nm)',
        significance:'TC tork çarpımı + dişli oranı sonrası net tork. Her vites geçişinde ani değişim görülür.' },
      { id:'shift-rpm-t', name:'Vites Geçiş RPM Profili – Zaman', xAxis:'Zaman (s)', yAxis:'Motor Devri + Vites',
        significance:'Testere dişi devir patterninin her tepesi shift-up noktası. Shift kalibrasyon doğrulamasının temel aracı.' }
    ],
    sensors: [
      { target:'shift-controller', attachment:'component', signal:'current_gear', label:'Şanzıman Kontrol → Aktif Vites' },
      { target:'gearbox', attachment:'output', signal:'torque_out', label:'Şanzıman Çıkışı → Çıkış Torku (Nm)' },
      { target:'gearbox', attachment:'output', signal:'rpm_out', label:'Şanzıman Çıkışı → Çıkış Devri (rpm)' }
    ]
  },
  {
    id: 'comparison', name: 'Karşılaştırma Diyagramları', icon: '⚖️', priority: 'advanced',
    solverTab: 'performance',
    description: 'Transfer kademe karşılaştırması, verimlilik zinciri ve ileri analizler',
    requires: ['vehicle', 'engine', 'torque-converter'],
    dependsOn: ['performance', 'engine-analysis', 'tc-analysis', 'traction-analysis'],
    diagrams: [
      { id:'transfer-compare', name:'Yüksek / Düşük Kademe Hız Karşılaştırması', xAxis:'Zaman (s)', yAxis:'Hız (km/h)',
        significance:'İki transfer kademe V(t) eğrilerinin üst üste bindirilmesi. Kesişim noktası taktik karar sınırı.',
        note:'İki ayrı simülasyon gerektirir.' },
      { id:'efficiency-chain', name:'Güç Aktarma Verim Zinciri – Araç Hızı', xAxis:'Hız (km/h)', yAxis:'Verim (%)',
        significance:'Her bileşenin verimi ayrı eğri: TC η, şanzıman η, toplam η. Enerji kayıp analizi için vazgeçilmez.' },
      { id:'te-envelope', name:'TE Zarf Eğrisi – Araç Hızı', xAxis:'Hız (km/h)', yAxis:'Çekiş Kuvveti (kN)',
        significance:'Tüm viteslerin TE eğrileri + zarf eğrisi. Vites aralıklarının uygunluğunu gösterir.' },
      { id:'bsfc-map', name:'Motor BSFC Çalışma Haritası', xAxis:'Motor Devri (rpm)', yAxis:'Motor Torku (Nm)',
        significance:'Verimlilik haritası üzerine çalışma noktası yörüngesi. Motorun ne kadar verimli kullanıldığını gösterir.',
        note:'Arka plan BSFC kontur haritası motor veritabanından gelir.' }
    ],
    sensors: []
  },

  // ══════════════════════════════════════════════════════════════
  //  HIZLANMA-YAVAŞLAMA (Segment-Drive) — solverTab: 'accel-decel'
  // ══════════════════════════════════════════════════════════════
  {
    id: 'sd-speed-profile', name: 'Hız ve Mesafe Profili', icon: '🛤️', priority: 'essential',
    solverTab: 'accel-decel',
    description: 'Segment bazlı hız, mesafe ve ivme profilleri — sürüş çevriminin genel görünümü',
    requires: ['vehicle'],
    diagrams: [
      { id:'sd-v-t', name:'Araç Hızı – Zaman', xAxis:'Zaman (s)', yAxis:'Hız (km/h)',
        significance:'Sürüş çevriminin ana profili. Tam gaz segmentlerinde hız yükselir, serbest segmentlerde düşer. Segment sınırları kırılma noktaları olarak görünür.' },
      { id:'sd-s-t', name:'Mesafe – Zaman', xAxis:'Zaman (s)', yAxis:'Mesafe (m)',
        significance:'Toplam kat edilen mesafe. Eğimi hıza eşit. Tam gaz bölümlerinde dik, serbest bölümlerde düzleşir. Segment mesafelerini doğrulamak için kullanılır.' },
      { id:'sd-a-t', name:'İvme – Zaman', xAxis:'Zaman (s)', yAxis:'İvme (m/s²)',
        significance:'Segment geçişlerinde ani ivme değişimleri, yük güvenliği ve sürücü konforu analizi. Negatif değerler yavaşlama fazlarını gösterir.' }
    ],
    sensors: [
      { target:'vehicle', attachment:'component', signal:'v_speed', label:'Araç → Araç Hızı (km/h)' },
      { target:'vehicle', attachment:'component', signal:'v_distance', label:'Araç → Mesafe (m)' },
      { target:'vehicle', attachment:'component', signal:'v_accel', label:'Araç → İvme (m/s²)' }
    ]
  },
  {
    id: 'sd-forces', name: 'Kuvvet ve Direnç Analizi', icon: '⚡', priority: 'essential',
    solverTab: 'accel-decel',
    description: 'Segment bazlı çekiş, direnç ve eğim kuvvetleri — arazi etkisini gösterir',
    requires: ['vehicle', 'engine'],
    diagrams: [
      { id:'sd-fnet-t', name:'Net Kuvvet – Zaman', xAxis:'Zaman (s)', yAxis:'Kuvvet (N)',
        significance:'Pozitif değerler hızlanma, negatif değerler yavaşlama. Eğim değişimlerinde ani sıçrama görülür. Serbest segmentlerde motor freni etkisi.' },
      { id:'sd-forces-t', name:'Kuvvet Bileşenleri – Zaman', xAxis:'Zaman (s)', yAxis:'Kuvvet (N)',
        significance:'Eğim, yuvarlanma ve aero dirençlerinin zamana bağlı profili. Eğimli segmentlerde F_grade baskın, yüksek hızda F_aero baskın.' },
      { id:'sd-grade-t', name:'Eğim Kuvveti – Zaman', xAxis:'Zaman (s)', yAxis:'Kuvvet (N)',
        significance:'Her segmentteki eğimin yarattığı kuvvet. Pozitif değer yokuş yukarı, negatif yokuş aşağı. Segment geçişlerinde basamak değişimi.' }
    ],
    sensors: [
      { target:'road', attachment:'component', signal:'r_rolling_force', label:'Yol → Yuvarlanma Direnci (N)' },
      { target:'road', attachment:'component', signal:'r_aero_force', label:'Yol → Aerodinamik Direnç (N)' },
      { target:'road', attachment:'component', signal:'r_grade_force', label:'Yol → Eğim Kuvveti (N)' },
      { target:'road', attachment:'component', signal:'r_net_force', label:'Yol → Net Kuvvet (N)' }
    ]
  },
  {
    id: 'sd-powertrain', name: 'Güç Aktarma Profili', icon: '⚙️', priority: 'recommended',
    solverTab: 'accel-decel',
    description: 'Motor devri, tork, güç ve vites değişimleri — segment bazlı güç aktarma davranışı',
    requires: ['engine', 'gearbox'],
    diagrams: [
      { id:'sd-rpm-t', name:'Motor Devri – Zaman', xAxis:'Zaman (s)', yAxis:'Motor Devri (rpm)',
        significance:'Serbest fazda devir düşer, tam gaz fazında tırmanır. Segment geçişlerinde devir profili yeniden şekillenir. Motorun hangi bölgede çalıştığını gösterir.' },
      { id:'sd-power-t', name:'Motor ve Tekerlek Gücü – Zaman', xAxis:'Zaman (s)', yAxis:'Güç (kW)',
        significance:'Tam gaz segmentlerinde motor tam güçte, serbest segmentlerde güç düşer. İkisi arası fark drivetrain kaybı.' },
      { id:'sd-gear-t', name:'Vites Profili – Zaman', xAxis:'Zaman (s)', yAxis:'Vites',
        significance:'Segment bazlı vites değişim profili. Yavaşlama sonrası düşük vitese iniş, tekrar hızlanmada adım adım yükseliş.' },
      { id:'sd-te-t', name:'Çekiş Kuvveti – Zaman', xAxis:'Zaman (s)', yAxis:'Çekiş Kuvveti (kN)',
        significance:'Tam gaz segmentlerinde yüksek TE, serbest segmentlerde sıfıra yakın veya negatif (motor freni). Segment sınırlarında ani değişim.' }
    ],
    sensors: [
      { target:'engine', attachment:'output', signal:'rpm', label:'Motor → Devir (rpm)' },
      { target:'engine', attachment:'output', signal:'power', label:'Motor → Güç (kW)' },
      { target:'shift-controller', attachment:'component', signal:'current_gear', label:'Vites Kontrol → Aktif Vites' },
      { target:'solver', attachment:'component', signal:'tractive_effort', label:'Çözücü → Çekiş Kuvveti (kN)' }
    ]
  },
  {
    id: 'sd-thermal', name: 'Isı Reddi ve Verimlilik', icon: '🌡️', priority: 'advanced',
    solverTab: 'accel-decel',
    description: 'TC ısı kaybı ve motor fren kuvveti — termal yük ve enerji dağılımı',
    requires: ['torque-converter', 'engine'],
    diagrams: [
      { id:'sd-heat-t', name:'TC Isı Reddi – Zaman', xAxis:'Zaman (s)', yAxis:'Isı Reddi (kW)',
        significance:'Tork konvertördeki enerji kaybının termal profili. Düşük hızlarda ve serbest fazlarda yüksek ısı üretimi. Soğutma sistemi tasarımı için kritik.' },
      { id:'sd-edrag-t', name:'Motor Fren Kuvveti – Zaman', xAxis:'Zaman (s)', yAxis:'Kuvvet (N)',
        significance:'Serbest (coast) fazında motorun yarattığı fren kuvveti. Motor frenli yokuş iniş analizleri için temel veri.' }
    ],
    sensors: [
      { target:'torque-converter', attachment:'component', signal:'heat_rejection', label:'TC → Isı Reddi (kW)' },
      { target:'engine', attachment:'output', signal:'torque', label:'Motor → Fren Torku (Nm)' }
    ]
  },

  // ══════════════════════════════════════════════════════════════
  //  ENGEL ATLAMA — solverTab: 'obstacle'
  // ══════════════════════════════════════════════════════════════
  {
    id: 'obs-torque', name: 'Tork ve Kuvvet Analizi', icon: '🧱', priority: 'essential',
    solverTab: 'obstacle',
    description: 'Engel atlama için gerekli tork, mevcut tork kapasitesi ve güvenlik marjı',
    requires: ['vehicle', 'engine', 'torque-converter'],
    diagrams: [
      { id:'obs-match-torque', name:'Motor-TC Eşleşme Tork Profili', xAxis:'Hız Oranı (SR)', yAxis:'Tork (Nm)',
        significance:'SR=0 (stall) → SR=1.0 (lockup) aralığında motor torku, pump torku, türbin torku ve tekerlek torku. Stall noktasındaki tekerlek torku engel atlama kapasitesini belirler.' },
      { id:'obs-match-power', name:'Motor-TC Eşleşme Güç Profili', xAxis:'Hız Oranı (SR)', yAxis:'Güç (kW)',
        significance:'Motor gücü ve türbin gücünün SR\'ye bağlı değişimi. Stall\'da güç sıfır (v=0), artan SR ile güç yükselir. TC verim kaybı iki eğri arası fark.' }
    ],
    sensors: [
      { target:'engine', attachment:'output', signal:'torque', label:'Motor → Tork (Nm)' },
      { target:'torque-converter', attachment:'output', signal:'torque_out', label:'TC → Türbin Torku (Nm)' },
      { target:'torque-converter', attachment:'component', signal:'heat_rejection', label:'TC → Isı Reddi (kW)' }
    ]
  },
  {
    id: 'obs-thermal', name: 'Termal ve Verimlilik Analizi', icon: '🌡️', priority: 'recommended',
    solverTab: 'obstacle',
    description: 'Engel atlama sırasında TC ısı üretimi, verim ve kayma profilleri',
    requires: ['torque-converter'],
    diagrams: [
      { id:'obs-match-heat', name:'TC Isı Reddi – Hız Oranı', xAxis:'Hız Oranı (SR)', yAxis:'Isı Reddi (kW)',
        significance:'Stall\'da tüm enerji ısıya dönüşür. SR arttıkça ısı azalır. Engel atlama genelde düşük SR bölgesinde gerçekleşir — soğutma kapasitesi kritik.' },
      { id:'obs-match-eta', name:'TC Verimi – Hız Oranı', xAxis:'Hız Oranı (SR)', yAxis:'Verim (%)',
        significance:'TC verimi engel atlama bölgesinde (SR<0.3) çok düşük. Enerji kaybının büyüklüğünü gösterir. Soğutma sistemi boyutlandırma girdisi.' }
    ],
    sensors: [
      { target:'torque-converter', attachment:'component', signal:'efficiency', label:'TC → Verim (%)' },
      { target:'torque-converter', attachment:'component', signal:'slip', label:'TC → Kayma (%)' }
    ]
  }
];

function swScanTopology() {
  var result = {
    hasEngine:false, hasTC:false, hasGearbox:false, hasTransfer:false,
    hasDiff:false, hasVehicle:false, hasRoad:false, hasShiftCtrl:false, hasSolver:false,
    engineNode:null, tcNode:null, gearboxNode:null, transferNode:null,
    diffNode:null, vehicleNode:null, roadNode:null, shiftCtrlNode:null, solverNode:null,
    existingSensors: [],
    chainComplete: false
  };
  nodes.forEach(function(n) {
    switch(n.type) {
      case 'engine': case 'engine-brake': result.hasEngine=true; result.engineNode=n; break;
      case 'torque-converter': result.hasTC=true; result.tcNode=n; break;
      case 'gearbox': result.hasGearbox=true; result.gearboxNode=n; break;
      case 'transfer': result.hasTransfer=true; result.transferNode=n; break;
      case 'differential': result.hasDiff=true; result.diffNode=n; break;
      case 'vehicle': result.hasVehicle=true; result.vehicleNode=n; break;
      case 'road': result.hasRoad=true; result.roadNode=n; break;
      case 'shift-controller': result.hasShiftCtrl=true; result.shiftCtrlNode=n; break;
      case 'solver': result.hasSolver=true; result.solverNode=n; break;
      case 'sensor':
        result.existingSensors.push({
          node:n,
          attachedConn: n.data ? n.data.attachedConnection : null,
          attachedComp: n.data ? n.data.attachedComponent : null,
          direction: n.data ? n.data.sensorDirection : 'from',
          signal: n.data ? n.data.selectedSignal : null
        });
        break;
    }
  });
  result.chainComplete = result.hasEngine && result.hasTC && result.hasGearbox && result.hasVehicle;
  return result;
}

// Çözücü bileşeninde aktif olan çözüm kümelerini döndür
function swGetActiveSolverTabs() {
  var active = {};
  var solverNode = nodes.find(function(n) { return n.type === 'solver'; });
  if(!solverNode) return active;
  var d = solverNode.data || {};

  // Performans Analizi — varsayılan olarak açık
  if(d.performanceAnalysis !== false) {
    active['performance'] = true;
  }

  // Hızlanma-Yavaşlama — çözücüde tıklanmış + senaryo yol segmentleri var
  if(d.accelDecelAnalysis) {
    var scenNode = nodes.find(function(n) { return n.type === 'scenario'; });
    if(scenNode && scenNode.data && scenNode.data.roadSegments && scenNode.data.roadSegments.length > 0) {
      active['accel-decel'] = true;
    }
  }

  // Engel Atlama — çözücüde tıklanmış + engel bileşeni mevcut
  if(d.obstacleCrossingAnalysis) {
    var obsNode = nodes.find(function(n) { return n.type === 'obstacle-crossing'; });
    if(obsNode) {
      active['obstacle'] = true;
    }
  }

  return active;
}

function swCheckSensorExists(sensorReq, topology) {
  for(var i=0; i<topology.existingSensors.length; i++) {
    var s = topology.existingSensors[i];
    var targetMatch = false;
    
    if(sensorReq.attachment === 'component' && s.attachedComp) {
      var compNode = nodes.find(function(n) { return n.id === s.attachedComp; });
      if(compNode && (compNode.type === sensorReq.target || (false))) targetMatch = true;
    } else if(s.attachedConn) {
      var conn = connections.find(function(c) { return c.id === s.attachedConn; });
      if(conn) {
        var fromNode = nodes.find(function(n) { return n.id === conn.from; });
        var toNode = nodes.find(function(n) { return n.id === conn.to; });
        if(sensorReq.attachment === 'output' && fromNode) {
          if(fromNode.type === sensorReq.target || (false)) {
            if(s.direction === 'from' || !s.direction) targetMatch = true;
          }
        }
        if(sensorReq.attachment === 'input' && toNode) {
          if(toNode.type === sensorReq.target || (false)) {
            if(s.direction === 'to') targetMatch = true;
          }
        }
      }
    }
    if(targetMatch && s.signal === sensorReq.signal) {
      return { matched:true, sensorNode: s.node };
    }
  }
  return { matched:false, sensorNode:null };
}

// ── Diyagram → Sinyal Haritası ──
// Her diyagramın hangi sinyallerden oluştuğunu tanımlar.
// x.target='time' → veSimResults.time kullanılır
// x/y target bir bileşen tipi ise → o bileşenin sinyal verisi
var SW_DIAGRAM_SIGNALS = {
  // Performans
  'v-t':  { x:{target:'time'}, y:[{target:'vehicle', signal:'v_speed', name:'Araç Hızı', unit:'km/h'}] },
  's-t':  { x:{target:'time'}, y:[{target:'vehicle', signal:'v_distance', name:'Mesafe', unit:'m'}] },
  'a-v':  { x:{target:'vehicle', signal:'v_speed', name:'Hız', unit:'km/h'}, y:[{target:'vehicle', signal:'v_accel', name:'İvme', unit:'m/s²'}] },
  'a-t':  { x:{target:'time'}, y:[{target:'vehicle', signal:'v_accel', name:'İvme', unit:'m/s²'}] },
  // Motor Analizi
  'rpm-v':   { x:{target:'vehicle', signal:'v_speed', name:'Hız', unit:'km/h'}, y:[{target:'engine', signal:'rpm', name:'Motor Devri', unit:'rpm'}] },
  'rpm-t':   { x:{target:'time'}, y:[{target:'engine', signal:'rpm', name:'Motor Devri', unit:'rpm'}] },
  'torque-v':{ x:{target:'vehicle', signal:'v_speed', name:'Hız', unit:'km/h'}, y:[{target:'engine', signal:'torque', name:'Motor Torku', unit:'Nm'}] },
  'power-v': { x:{target:'vehicle', signal:'v_speed', name:'Hız', unit:'km/h'}, y:[{target:'engine', signal:'power', name:'Motor Gücü', unit:'kW'}] },
  // TC Analizi
  'sr-v':        { x:{target:'vehicle', signal:'v_speed', name:'Hız', unit:'km/h'}, y:[{target:'torque-converter', signal:'speed_ratio', name:'Hız Oranı (SR)', unit:'−'}] },
  'tr-v':        { x:{target:'vehicle', signal:'v_speed', name:'Hız', unit:'km/h'}, y:[{target:'torque-converter', signal:'torque_ratio', name:'Tork Oranı (TR)', unit:'−'}] },
  'eta-tc-v':    { x:{target:'vehicle', signal:'v_speed', name:'Hız', unit:'km/h'}, y:[{target:'torque-converter', signal:'efficiency', name:'TC Verimi η', unit:'%'}] },
  'tc-slip-v':   { x:{target:'vehicle', signal:'v_speed', name:'Hız', unit:'km/h'}, y:[{target:'torque-converter', signal:'slip', name:'Kayma', unit:'%'}] },
  'tc-io-torque':{ x:{target:'vehicle', signal:'v_speed', name:'Hız', unit:'km/h'}, y:[
    {target:'torque-converter', signal:'torque_in', name:'Pump Torku', unit:'Nm'},
    {target:'torque-converter', signal:'torque_out', name:'Türbin Torku', unit:'Nm'}
  ]},
  // Çekiş Kuvveti
  'te-v':           { x:{target:'vehicle', signal:'v_speed', name:'Hız', unit:'km/h'}, y:[{target:'solver', signal:'tractive_effort', name:'Çekiş Kuvveti (TE)', unit:'kN'}] },
  'dp-v':           { x:{target:'vehicle', signal:'v_speed', name:'Hız', unit:'km/h'}, y:[{target:'solver', signal:'drawbar_pull', name:'Net Çekiş (DP)', unit:'kN'}] },
  'resistances-v':  { x:{target:'vehicle', signal:'v_speed', name:'Hız', unit:'km/h'}, y:[
    {target:'road', signal:'r_rolling_force', name:'Yuvarlanma Direnci', unit:'N'},
    {target:'road', signal:'r_aero_force', name:'Aerodinamik Direnç', unit:'N'},
    {target:'road', signal:'r_total_resist', name:'Toplam Direnç', unit:'N'}
  ]},
  'power-balance-v':{ x:{target:'vehicle', signal:'v_speed', name:'Hız', unit:'km/h'}, y:[
    {target:'engine', signal:'power', name:'Motor Gücü', unit:'kW'},
    {target:'solver', signal:'wheel_power', name:'Tekerlekte Güç', unit:'kW'}
  ]},
  // Vites Geçiş
  'gear-t':      { x:{target:'time'}, y:[{target:'shift-controller', signal:'current_gear', name:'Aktif Vites', unit:'−'}] },
  'gear-v':      { x:{target:'vehicle', signal:'v_speed', name:'Hız', unit:'km/h'}, y:[{target:'shift-controller', signal:'current_gear', name:'Aktif Vites', unit:'−'}] },
  'trans-out-v': { x:{target:'vehicle', signal:'v_speed', name:'Hız', unit:'km/h'}, y:[{target:'gearbox', signal:'torque_out', name:'Şanzıman Çıkış Torku', unit:'Nm'}] },
  'shift-rpm-t': { x:{target:'time'}, y:[
    {target:'engine', signal:'rpm', name:'Motor Devri', unit:'rpm'},
    {target:'shift-controller', signal:'current_gear', name:'Aktif Vites', unit:'−'}
  ]},
  // Karşılaştırma
  'transfer-compare':  { x:{target:'time'}, y:[{target:'vehicle', signal:'v_speed', name:'Araç Hızı', unit:'km/h'}] },
  'efficiency-chain':  { x:{target:'vehicle', signal:'v_speed', name:'Hız', unit:'km/h'}, y:[{target:'torque-converter', signal:'efficiency', name:'TC Verimi', unit:'%'}] },
  'te-envelope':       { x:{target:'vehicle', signal:'v_speed', name:'Hız', unit:'km/h'}, y:[{target:'solver', signal:'tractive_effort', name:'TE Zarf', unit:'kN'}] },
  'bsfc-map':          { x:{target:'engine', signal:'rpm', name:'Motor Devri', unit:'rpm'}, y:[{target:'engine', signal:'torque', name:'Motor Torku', unit:'Nm'}] },

  // ── Hızlanma-Yavaşlama (Segment-Drive) ──
  'sd-v-t':      { x:{target:'time'}, y:[{target:'vehicle', signal:'v_speed', name:'Araç Hızı', unit:'km/h'}], dataSource:'segmentDrive' },
  'sd-s-t':      { x:{target:'time'}, y:[{target:'vehicle', signal:'v_distance', name:'Mesafe', unit:'m'}], dataSource:'segmentDrive' },
  'sd-a-t':      { x:{target:'time'}, y:[{target:'vehicle', signal:'v_accel', name:'İvme', unit:'m/s²'}], dataSource:'segmentDrive' },
  'sd-fnet-t':   { x:{target:'time'}, y:[{target:'road', signal:'r_net_force', name:'Net Kuvvet', unit:'N'}], dataSource:'segmentDrive' },
  'sd-forces-t': { x:{target:'time'}, y:[
    {target:'road', signal:'r_grade_force', name:'Eğim Kuvveti', unit:'N'},
    {target:'road', signal:'r_rolling_force', name:'Yuvarlanma Direnci', unit:'N'},
    {target:'road', signal:'r_aero_force', name:'Aerodinamik Direnç', unit:'N'}
  ], dataSource:'segmentDrive' },
  'sd-grade-t':  { x:{target:'time'}, y:[{target:'road', signal:'r_grade_force', name:'Eğim Kuvveti', unit:'N'}], dataSource:'segmentDrive' },
  'sd-rpm-t':    { x:{target:'time'}, y:[{target:'engine', signal:'rpm', name:'Motor Devri', unit:'rpm'}], dataSource:'segmentDrive' },
  'sd-power-t':  { x:{target:'time'}, y:[
    {target:'engine', signal:'power', name:'Motor Gücü', unit:'kW'},
    {target:'solver', signal:'wheel_power', name:'Tekerlek Gücü', unit:'kW'}
  ], dataSource:'segmentDrive' },
  'sd-gear-t':   { x:{target:'time'}, y:[{target:'shift-controller', signal:'current_gear', name:'Aktif Vites', unit:'−'}], dataSource:'segmentDrive' },
  'sd-te-t':     { x:{target:'time'}, y:[{target:'solver', signal:'tractive_effort', name:'Çekiş Kuvveti', unit:'kN'}], dataSource:'segmentDrive' },
  'sd-heat-t':   { x:{target:'time'}, y:[{target:'torque-converter', signal:'heat_rejection', name:'Isı Reddi', unit:'kW'}], dataSource:'segmentDrive' },
  'sd-edrag-t':  { x:{target:'time'}, y:[{target:'solver', signal:'engine_drag_force', name:'Motor Fren Kuvveti', unit:'N'}], dataSource:'segmentDrive' },

  // ── Engel Atlama (Obstacle) — matchTable tabanlı ──
  'obs-match-torque': { x:{target:'obs-match', signal:'SR', name:'Hız Oranı (SR)', unit:'−'}, y:[
    {target:'obs-match', signal:'T_engine', name:'Motor Torku', unit:'Nm'},
    {target:'obs-match', signal:'T_pump', name:'Pump Torku', unit:'Nm'},
    {target:'obs-match', signal:'T_turbine', name:'Türbin Torku', unit:'Nm'},
    {target:'obs-match', signal:'T_wheel', name:'Tekerlek Torku', unit:'Nm'}
  ], dataSource:'obstacleDynamic' },
  'obs-match-power':  { x:{target:'obs-match', signal:'SR', name:'Hız Oranı (SR)', unit:'−'}, y:[
    {target:'obs-match', signal:'P_engine_kW', name:'Motor Gücü', unit:'kW'},
    {target:'obs-match', signal:'P_turbine_kW', name:'Türbin Gücü', unit:'kW'}
  ], dataSource:'obstacleDynamic' },
  'obs-match-heat':   { x:{target:'obs-match', signal:'SR', name:'Hız Oranı (SR)', unit:'−'}, y:[
    {target:'obs-match', signal:'Q_reject_kW', name:'Isı Reddi', unit:'kW'}
  ], dataSource:'obstacleDynamic' },
  'obs-match-eta':    { x:{target:'obs-match', signal:'SR', name:'Hız Oranı (SR)', unit:'−'}, y:[
    {target:'obs-match', signal:'eta_tc', name:'TC Verimi', unit:'−'}
  ], dataSource:'obstacleDynamic' }
};

// ═══════════════════════════════════════════════════════════════════════════════
// SENSÖR KURULUMU — Sanal sensörleri sihirbaz içinde etkinleştirme
// ═══════════════════════════════════════════════════════════════════════════════

function swInstallSensors(node) {
  if(!node || node.type !== 'sensor-wizard') return;
  var topo = swScanTopology();
  var activeTabs = swGetActiveSolverTabs();

  var installedPkgs = [];
  var activeSensors = [];
  var skippedTabs = [];

  SENSOR_PACKAGES.forEach(function(pkg) {
    // Çözüm kümesi aktif mi?
    if(pkg.solverTab && !activeTabs[pkg.solverTab]) {
      if(skippedTabs.indexOf(pkg.solverTab) === -1) skippedTabs.push(pkg.solverTab);
      return;
    }

    // Bileşen gereksinimleri karşılanıyor mu?
    var reqsMet = true;
    for(var r = 0; r < pkg.requires.length; r++) {
      var rt = pkg.requires[r];
      if(!nodes.some(function(n) { return n.type === rt || (rt === 'engine' && n.type === 'engine'); })) {
        reqsMet = false; break;
      }
    }
    if(!reqsMet) return;

    installedPkgs.push(pkg.id);
    pkg.sensors.forEach(function(sReq) {
      activeSensors.push({
        packageId: pkg.id,
        target: sReq.target,
        attachment: sReq.attachment,
        signal: sReq.signal,
        label: sReq.label
      });
    });
  });

  node.data.sensorsInstalled = true;
  node.data.installedPackages = installedPkgs;
  node.data.activeSensors = activeSensors;

  swUpdateWizardVisual(node);
  if(typeof saveState === 'function') saveState();
  var toastMsg = installedPkgs.length + ' paket kuruldu (' + activeSensors.length + ' sensör)';
  if(skippedTabs.length > 0) toastMsg += ' — ' + skippedTabs.length + ' çözüm kümesi devre dışı';
  if(typeof showToast === 'function') showToast(toastMsg, 'success');

  // Properties panelini yenile
  showNodeProperties(node);
}

function swRemoveSensors(node) {
  if(!node || node.type !== 'sensor-wizard') return;

  node.data.sensorsInstalled = false;
  node.data.installedPackages = [];
  node.data.activeSensors = [];

  swUpdateWizardVisual(node);
  if(typeof saveState === 'function') saveState();
  if(typeof showToast === 'function') showToast('Sensörler kaldırıldı', 'info');

  showNodeProperties(node);
}

function swUpdateWizardVisual(node) {
  if(!node || node.type !== 'sensor-wizard') return;
  var el = document.getElementById(node.id);
  if(!el) return;

  // Mevcut rozeti kaldır
  var oldBadge = el.querySelector('.sw-check-badge');
  if(oldBadge) oldBadge.remove();

  if(node.data && node.data.sensorsInstalled) {
    var box = el.querySelector('.ve-node-box');
    if(box) {
      var badge = document.createElement('span');
      badge.className = 'sw-check-badge';
      badge.textContent = '\u2705';
      box.appendChild(badge);
    }
  }
}

// Tüm sihirbaz node'larının görselini güncelle (restoreState sonrası için)
function swRefreshAllWizardVisuals() {
  nodes.forEach(function(n) {
    if(n.type === 'sensor-wizard') swUpdateWizardVisual(n);
  });
}

var swExpandedPkg = {};

function swTogglePkg(pkgId) {
  swExpandedPkg[pkgId] = !swExpandedPkg[pkgId];
  var wizNode = nodes.find(function(n) { return n.type === 'sensor-wizard'; });
  if(wizNode) showNodeProperties(wizNode);
}

function swShowDiagramInfo(pkgId, diagIdx) {
  var pkg = SENSOR_PACKAGES.find(function(p) { return p.id === pkgId; });
  if(!pkg || !pkg.diagrams[diagIdx]) return;
  var d = pkg.diagrams[diagIdx];
  var ov = document.getElementById('sw-info-overlay');
  if(!ov) {
    ov = document.createElement('div');
    ov.id = 'sw-info-overlay';
    ov.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:99999;display:flex;align-items:center;justify-content:center;';
    document.body.appendChild(ov);
  }
  var html = '<div style="background:var(--bg-primary,#fff);border-radius:2px;padding:20px;max-width:440px;width:90%;box-shadow:0 8px 32px rgba(0,0,0,0.3);color:var(--text-primary,#333);">';
  html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">';
  html += '<span style="font-weight:700;font-size:0.9rem;">📊 ' + d.name + '</span>';
  html += '<button onclick="document.getElementById(\'sw-info-overlay\').remove()" style="background:none;border:none;font-size:1.1rem;cursor:pointer;color:var(--text-muted,#999);">✕</button>';
  html += '</div>';
  html += '<div style="font-size:0.72rem;color:var(--text-secondary,#666);margin-bottom:8px;"><b>X:</b> ' + d.xAxis + ' &nbsp; <b>Y:</b> ' + (Array.isArray(d.yAxis) ? d.yAxis.join(' / ') : d.yAxis) + '</div>';
  html += '<div style="font-size:0.72rem;line-height:1.5;color:var(--text-primary,#333);border-top:1px solid var(--border-color,#eee);padding-top:10px;">' + d.significance + '</div>';
  if(d.note) {
    html += '<div style="font-size:0.68rem;color:#f59e0b;margin-top:8px;padding:6px 8px;background:rgba(245,158,11,0.08);border-radius:2px;">⚠️ ' + d.note + '</div>';
  }
  html += '</div>';
  ov.innerHTML = html;
  ov.onclick = function(e) { if(e.target === ov) ov.remove(); };
}

var swActiveTab = 'performance';

function swSwitchTab(tabId) {
  swActiveTab = tabId;
  var wizNode = nodes.find(function(n) { return n.type === 'sensor-wizard'; });
  if(wizNode) showNodeProperties(wizNode);
}

function getSensorWizardPropertiesHTML(node) {
  var topo = swScanTopology();
  var isInstalled = node.data && node.data.sensorsInstalled;
  var installedPkgs = (node.data && node.data.installedPackages) || [];
  var html = '<div class="sw-panel">';

  // ── Durum Çubuğu ──
  if(isInstalled) {
    var sCount = (node.data.activeSensors || []).length;
    html += '<div class="sw-status-bar installed">';
    html += '<span class="sw-status-dot"></span>';
    html += '<span>Sensörler Kurulu</span>';
    html += '<span style="margin-left:auto;font-weight:400;font-size:0.56rem;opacity:0.8;">' + installedPkgs.length + ' paket, ' + sCount + ' sensör</span>';
    html += '</div>';
  } else {
    html += '<div class="sw-status-bar not-installed">';
    html += '<span class="sw-status-dot"></span>';
    html += '<span>Sensörler Kurulmadı</span>';
    html += '</div>';
  }

  // ── Topoloji Durumu ──
  html += '<div class="sw-section">';
  html += '<div class="sw-section-title">Topoloji Durumu</div>';
  html += '<div class="sw-topo-grid">';
  var topoItems = [
    {k:'Motor', v:topo.hasEngine}, {k:'Tork Konvertör', v:topo.hasTC},
    {k:'Şanzıman', v:topo.hasGearbox}, {k:'Transfer Kutusu', v:topo.hasTransfer},
    {k:'Diferansiyel', v:topo.hasDiff}, {k:'Araç', v:topo.hasVehicle},
    {k:'Yol / Ortam', v:topo.hasRoad}, {k:'Şanz. Kontrol', v:topo.hasShiftCtrl}
  ];
  topoItems.forEach(function(ti) {
    html += '<div class="sw-topo-item">';
    html += '<span class="sw-dot ' + (ti.v ? 'ok' : 'missing') + '"></span>';
    html += '<span style="' + (ti.v ? '' : 'opacity:0.5;') + '">' + ti.k + '</span>';
    html += '</div>';
  });
  html += '</div>';
  html += '<div class="sw-chain-bar ' + (topo.chainComplete ? 'ok' : 'fail') + '">';
  html += topo.chainComplete ? 'Zincir tamamlanmış: Motor → TC → Şanzıman → Araç' : 'Güç aktarma zinciri tamamlanmamış';
  html += '</div>';
  html += '</div>';

  // ── Butonlar ──
  html += '<div class="sw-btn-row">';
  if(!isInstalled) {
    html += '<button class="sw-btn sw-btn-primary" onclick="var w=nodes.find(function(n){return n.type===\'sensor-wizard\';});if(w)swInstallSensors(w);">Sensörleri Kur</button>';
  } else {
    html += '<button class="sw-btn sw-btn-danger" onclick="var w=nodes.find(function(n){return n.type===\'sensor-wizard\';});if(w)swRemoveSensors(w);">Kaldır</button>';
    html += '<button class="sw-btn sw-btn-outline" onclick="var w=nodes.find(function(n){return n.type===\'sensor-wizard\';});if(w)swInstallSensors(w);" title="Topoloji değişikliği sonrası yeniden kur">Yeniden Kur</button>';
  }
  html += '</div>';

  // ── Çözüm Kümesi Tabları ──
  var activeTabs = swGetActiveSolverTabs();
  var solverTabs = [
    { id:'performance', name:'Performans', icon:'🏎️' },
    { id:'accel-decel', name:'Hızl.-Yavaşl.', icon:'🛤️' },
    { id:'obstacle', name:'Engel Atlama', icon:'🧱' }
  ];

  // Her tab için paket sayısını hesapla
  solverTabs.forEach(function(st) {
    st.enabled = !!activeTabs[st.id];
    st.pkgCount = SENSOR_PACKAGES.filter(function(p) { return p.solverTab === st.id; }).length;
    st.installedCount = SENSOR_PACKAGES.filter(function(p) {
      return p.solverTab === st.id && installedPkgs.indexOf(p.id) > -1;
    }).length;
  });

  // Aktif tab devre dışıysa ilk aktif tab'a geç
  var currentTabInfo = solverTabs.find(function(st) { return st.id === swActiveTab; });
  if(currentTabInfo && !currentTabInfo.enabled) {
    var firstEnabled = solverTabs.find(function(st) { return st.enabled; });
    if(firstEnabled) { swActiveTab = firstEnabled.id; }
  }

  html += '<div class="sw-section">';
  html += '<div class="sw-section-title">Diyagram Paketleri</div>';
  html += '<div class="sw-tab-bar">';
  solverTabs.forEach(function(st) {
    var isActive = swActiveTab === st.id;
    var disabled = !st.enabled;
    html += '<button class="sw-tab' + (isActive ? ' active' : '') + (disabled ? ' disabled' : '') + '"';
    if(disabled) {
      html += ' title="Çözücü bileşeninden bu çözüm kümesini etkinleştirin"';
    } else {
      html += ' onclick="swSwitchTab(\'' + st.id + '\')"';
    }
    html += '>';
    html += st.icon + ' ' + st.name;
    if(disabled) {
      html += '<span class="sw-tab-count" style="opacity:0.5;">kapalı</span>';
    } else {
      html += '<span class="sw-tab-count">' + (isInstalled ? st.installedCount : st.pkgCount) + '</span>';
    }
    html += '</button>';
  });
  html += '</div>';

  // ── Aktif Tab'ın Paketleri ──
  var tabPkgs = SENSOR_PACKAGES.filter(function(p) { return p.solverTab === swActiveTab; });

  tabPkgs.forEach(function(pkg) {
    var pkgInstalled = isInstalled && installedPkgs.indexOf(pkg.id) > -1;
    var pkgMatched = 0, pkgTotal = pkg.sensors.length;
    var sensorStatuses = [];

    if(isInstalled) {
      pkg.sensors.forEach(function(sReq) {
        sensorStatuses.push(pkgInstalled);
        if(pkgInstalled) pkgMatched++;
      });
    } else {
      pkg.sensors.forEach(function(sReq) {
        var chk = swCheckSensorExists(sReq, topo);
        sensorStatuses.push(chk.matched);
        if(chk.matched) pkgMatched++;
      });
    }

    var reqsMet = true;
    for(var r=0; r<pkg.requires.length; r++) {
      var rt = pkg.requires[r];
      if(!nodes.some(function(n) { return n.type === rt || (rt === 'engine' && n.type === 'engine'); })) {
        reqsMet = false; break;
      }
    }

    // Badge durumu
    var badgeClass = 'miss', badgeText = '--';
    if(!reqsMet) { badgeClass = 'miss'; badgeText = 'eksik'; }
    else if(pkgInstalled) { badgeClass = 'ok'; badgeText = 'kurulu'; }
    else if(pkgTotal > 0 && pkgMatched === pkgTotal) { badgeClass = 'ok'; badgeText = pkgMatched + '/' + pkgTotal; }
    else if(pkgMatched > 0) { badgeClass = 'partial'; badgeText = pkgMatched + '/' + pkgTotal; }
    else if(pkgTotal > 0) { badgeText = '0/' + pkgTotal; }
    else if(pkg.dependsOn) { badgeText = 'bağımlı'; }

    var expanded = swExpandedPkg[pkg.id];

    html += '<div class="sw-pkg-card">';

    // Başlık
    html += '<div class="sw-pkg-header" onclick="swTogglePkg(\'' + pkg.id + '\')">';
    html += '<span class="sw-pkg-arrow">' + (expanded ? '▼' : '▶') + '</span>';
    html += '<span class="sw-pkg-name">' + pkg.name + '</span>';
    html += '<span class="sw-pkg-badge ' + badgeClass + '">' + badgeText + '</span>';
    html += '</div>';

    // Genişletilmiş içerik
    if(expanded) {
      html += '<div class="sw-pkg-body">';
      html += '<div class="sw-pkg-desc">' + pkg.description + '</div>';

      // Sensörler
      if(pkg.sensors.length > 0) {
        html += '<div class="sw-pkg-sub">Sensörler</div>';
        pkg.sensors.forEach(function(sReq, sIdx) {
          var matched = sensorStatuses[sIdx];
          html += '<div class="sw-sensor-row">';
          html += '<span class="sw-dot ' + (matched ? 'green' : (reqsMet ? 'gray' : 'red')) + '"></span>';
          html += '<span style="' + (matched ? '' : 'opacity:0.6;') + '">' + sReq.label + '</span>';
          html += '</div>';
        });
      } else if(pkg.dependsOn) {
        html += '<div class="sw-pkg-desc" style="font-style:italic;">Ek sensör gerektirmez — diğer paketlerin verilerini kullanır.</div>';
      }

      // Diyagramlar
      html += '<div class="sw-pkg-sub">Diyagramlar</div>';
      pkg.diagrams.forEach(function(d, dIdx) {
        var ready = pkgInstalled || ((pkgTotal === 0 && pkg.dependsOn) ? false : (pkgMatched === pkgTotal && pkgTotal > 0));
        html += '<div class="sw-diag-row">';
        html += '<span class="sw-dot ' + (ready ? 'green' : 'gray') + '"></span>';
        html += '<span style="flex:1;' + (ready ? '' : 'opacity:0.6;') + '">' + d.name + '</span>';
        html += '<button class="sw-info-btn" onclick="event.stopPropagation();swShowDiagramInfo(\'' + pkg.id + '\',' + dIdx + ')" title="Diyagram bilgisi">i</button>';
        html += '</div>';
      });

      html += '</div>';
    }

    html += '</div>';
  });

  html += '</div>'; // sw-section

  // ── Alt bilgi ──
  if(isInstalled) {
    html += '<div class="sw-footer">';
    html += 'Simülasyon tamamlandıktan sonra <b>Sonuçlar</b> sekmesinde Sihirbaz Diyagramları ağacından diyagramları sürükle-bırak ile panellere ekleyebilirsiniz.';
    html += '</div>';
  } else {
    html += '<div class="sw-footer">';
    html += '<b>Sensörleri Kur</b> ile tüm uygun sensörleri otomatik kurabilirsiniz. Sensörler topoloji üzerinde görünmez — sihirbaz bileşeni içinde yönetilir.';
    html += '</div>';
  }

  // Yenile
  html += '<div style="text-align:center;margin-top:6px;">';
  html += '<button class="sw-btn sw-btn-outline" style="font-size:0.56rem;padding:3px 10px;" onclick="var w=nodes.find(function(n){return n.type===\'sensor-wizard\';});if(w)showNodeProperties(w);">Durumu Yenile</button>';
  html += '</div>';

  html += '</div>';
  return html;
}

