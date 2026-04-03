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
    id: 'gearbox-analysis', name: 'Şanzıman Detay Analizi', icon: '⚙️', priority: 'recommended',
    solverTab: 'performance',
    description: 'Şanzıman giriş/çıkış devir-tork, güç kaybı, verim ve vites oranı profilleri',
    requires: ['gearbox'],
    diagrams: [
      { id:'gb-io-torque', name:'Şanzıman Giriş/Çıkış Torku – Hız', xAxis:'Hız (km/h)', yAxis:'Tork (Nm)',
        significance:'Giriş ve çıkış torku farkı → şanzıman dişli kayıpları. Her vites geçişinde tork çarpanı değişimi görülür.' },
      { id:'gb-io-rpm', name:'Şanzıman Giriş/Çıkış Devri – Hız', xAxis:'Hız (km/h)', yAxis:'Devir (rpm)',
        significance:'Giriş devri (TC çıkışı) ve çıkış devri (propşaft). Oranları aktif vites oranını verir.' },
      { id:'gb-power-loss', name:'Şanzıman Güç Kaybı – Hız', xAxis:'Hız (km/h)', yAxis:'Güç Kaybı (kW)',
        significance:'Dişli, rulman ve yağ kayıpları toplamı. Yüksek torkta ve yüksek devirdeki kayıp artışı net olarak görülür.' },
      { id:'gb-efficiency', name:'Şanzıman Verimi – Hız', xAxis:'Hız (km/h)', yAxis:'Verim (%)',
        significance:'Vites bazında verim profili. Converter modda daha düşük, lockup modda daha yüksek verim beklenir.' },
      { id:'gb-ratio-t', name:'Vites Oranı – Zaman', xAxis:'Zaman (s)', yAxis:'Vites Oranı (−)',
        significance:'Anlık vites oranı profili. Basamak fonksiyonu şeklinde değişir, her shift noktası net görülür.' }
    ],
    sensors: [
      { target:'gearbox', attachment:'input', signal:'rpm_in', label:'Şanzıman Girişi → Giriş Devri (rpm)' },
      { target:'gearbox', attachment:'input', signal:'torque_in', label:'Şanzıman Girişi → Giriş Torku (Nm)' },
      { target:'gearbox', attachment:'component', signal:'power_in', label:'Şanzıman → Giriş Gücü (kW)' },
      { target:'gearbox', attachment:'component', signal:'power_out', label:'Şanzıman → Çıkış Gücü (kW)' },
      { target:'gearbox', attachment:'component', signal:'power_loss', label:'Şanzıman → Güç Kaybı (kW)' },
      { target:'gearbox', attachment:'component', signal:'gear', label:'Şanzıman → Aktif Vites (−)' },
      { target:'gearbox', attachment:'component', signal:'ratio', label:'Şanzıman → Vites Oranı (−)' },
      { target:'gearbox', attachment:'component', signal:'gear_mode', label:'Şanzıman → Vites Modu (C/L)' },
      { target:'gearbox', attachment:'component', signal:'efficiency', label:'Şanzıman → Verim (%)' }
    ]
  },
  {
    id: 'transfer-analysis', name: 'Transfer Kutusu Analizi', icon: '🔀', priority: 'recommended',
    solverTab: 'performance',
    description: 'Transfer kutusu giriş/çıkış devir-tork ve güç kaybı profilleri',
    requires: ['transfer'],
    diagrams: [
      { id:'tf-io-torque', name:'Transfer Giriş/Çıkış Torku – Hız', xAxis:'Hız (km/h)', yAxis:'Tork (Nm)',
        significance:'Kademe oranına bağlı tork çarpanı. Hi/Lo kademe geçişlerinde tork değişimi görülür.' },
      { id:'tf-power-loss', name:'Transfer Güç Kaybı – Hız', xAxis:'Hız (km/h)', yAxis:'Güç Kaybı (kW)',
        significance:'Transfer kutusu dişli ve rulman kayıpları. Yüksek tork bölgelerinde artan kayıp profili.' }
    ],
    sensors: [
      { target:'transfer', attachment:'input', signal:'rpm_in', label:'Transfer Girişi → Giriş Devri (rpm)' },
      { target:'transfer', attachment:'input', signal:'torque_in', label:'Transfer Girişi → Giriş Torku (Nm)' },
      { target:'transfer', attachment:'output', signal:'rpm_out', label:'Transfer Çıkışı → Çıkış Devri (rpm)' },
      { target:'transfer', attachment:'output', signal:'torque_out', label:'Transfer Çıkışı → Çıkış Torku (Nm)' },
      { target:'transfer', attachment:'component', signal:'power_in', label:'Transfer → Giriş Gücü (kW)' },
      { target:'transfer', attachment:'component', signal:'power_out', label:'Transfer → Çıkış Gücü (kW)' },
      { target:'transfer', attachment:'component', signal:'power_loss', label:'Transfer → Güç Kaybı (kW)' }
    ]
  },
  {
    id: 'propshaft-analysis', name: 'Propşaft Analizi', icon: '🔩', priority: 'optional',
    solverTab: 'performance',
    description: 'Propşaft devir-tork ve güç iletim kaybı profilleri',
    requires: ['propshaft'],
    diagrams: [
      { id:'ps-io-torque', name:'Propşaft Giriş/Çıkış Torku – Hız', xAxis:'Hız (km/h)', yAxis:'Tork (Nm)',
        significance:'Propşaft boyunca tork iletim kaybı. Burulma ve rulman kayıpları farktan okunur.' },
      { id:'ps-power-loss', name:'Propşaft Güç Kaybı – Hız', xAxis:'Hız (km/h)', yAxis:'Güç Kaybı (kW)',
        significance:'Propşaft mekanik kayıpları — genellikle küçük ama yüksek devirlerde artabilir.' }
    ],
    sensors: [
      { target:'propshaft', attachment:'input', signal:'rpm_in', label:'Propşaft Girişi → Giriş Devri (rpm)' },
      { target:'propshaft', attachment:'input', signal:'torque_in', label:'Propşaft Girişi → Giriş Torku (Nm)' },
      { target:'propshaft', attachment:'output', signal:'rpm_out', label:'Propşaft Çıkışı → Çıkış Devri (rpm)' },
      { target:'propshaft', attachment:'output', signal:'torque_out', label:'Propşaft Çıkışı → Çıkış Torku (Nm)' },
      { target:'propshaft', attachment:'component', signal:'power_in', label:'Propşaft → Giriş Gücü (kW)' },
      { target:'propshaft', attachment:'component', signal:'power_out', label:'Propşaft → Çıkış Gücü (kW)' },
      { target:'propshaft', attachment:'component', signal:'power_loss', label:'Propşaft → Güç Kaybı (kW)' }
    ]
  },
  {
    id: 'diff-analysis', name: 'Diferansiyel Analizi', icon: '⚙️', priority: 'optional',
    solverTab: 'performance',
    description: 'Diferansiyel giriş/çıkış devir-tork ve güç kaybı profilleri',
    requires: ['differential'],
    diagrams: [
      { id:'diff-io-torque', name:'Diferansiyel Giriş/Çıkış Torku – Hız', xAxis:'Hız (km/h)', yAxis:'Tork (Nm)',
        significance:'Diferansiyel oranı ve kayıpları sonrası yarım aks torku. Son kademe tork çarpanı görülür.' },
      { id:'diff-power-loss', name:'Diferansiyel Güç Kaybı – Hız', xAxis:'Hız (km/h)', yAxis:'Güç Kaybı (kW)',
        significance:'Konik dişli ve rulman kayıpları — genellikle yüksek hız ve yüksek torkta artar.' }
    ],
    sensors: [
      { target:'differential', attachment:'input', signal:'rpm_in', label:'Diferansiyel Girişi → Giriş Devri (rpm)' },
      { target:'differential', attachment:'input', signal:'torque_in', label:'Diferansiyel Girişi → Giriş Torku (Nm)' },
      { target:'differential', attachment:'output', signal:'rpm_out', label:'Diferansiyel Çıkışı → Yarım Aks Devri (rpm)' },
      { target:'differential', attachment:'output', signal:'torque_out', label:'Diferansiyel Çıkışı → Yarım Aks Torku (Nm)' },
      { target:'differential', attachment:'component', signal:'power_in', label:'Diferansiyel → Giriş Gücü (kW)' },
      { target:'differential', attachment:'component', signal:'power_out', label:'Diferansiyel → Çıkış Gücü (kW)' },
      { target:'differential', attachment:'component', signal:'power_loss', label:'Diferansiyel → Güç Kaybı (kW)' }
    ]
  },
  {
    id: 'wheel-analysis', name: 'Tekerlek Analizi', icon: '🛞', priority: 'recommended',
    solverTab: 'performance',
    description: 'Tekerlek devri, torku, çekiş kuvveti ve eğim kapasitesi profilleri',
    requires: ['wheel'],
    diagrams: [
      { id:'wh-force-v', name:'Tekerlek Çekiş Kuvveti – Hız', xAxis:'Hız (km/h)', yAxis:'Kuvvet (N)',
        significance:'Tekerlek yüzeyindeki net çekiş kuvveti. Lastik-zemin etkileşiminin doğrudan göstergesi.' },
      { id:'wh-torque-v', name:'Tekerlek Torku – Hız', xAxis:'Hız (km/h)', yAxis:'Tork (Nm)',
        significance:'Tekerleğe ulaşan net tork. Tüm drivetrain kayıpları sonrası nihai tork değeri.' },
      { id:'wh-te-dp-v', name:'TE ve DP – Hız', xAxis:'Hız (km/h)', yAxis:'Kuvvet (kN)',
        significance:'Çekiş Kuvveti (TE) ve Drawbar Pull (DP) tekerlekten ölçüm. DP = TE − direnç, sıfır noktası max hız.' },
      { id:'wh-grade-v', name:'Eğim Kapasitesi – Hız', xAxis:'Hız (km/h)', yAxis:'Eğim (%)',
        significance:'Her hızda aracın tırmanabildiği maksimum eğim yüzdesi. Düşük hızda yüksek, yüksek hızda düşen profil.' }
    ],
    sensors: [
      { target:'wheel', attachment:'component', signal:'rpm_in', label:'Tekerlek → Devir (rpm)' },
      { target:'wheel', attachment:'component', signal:'torque_in', label:'Tekerlek → Tork (Nm)' },
      { target:'wheel', attachment:'component', signal:'speed', label:'Tekerlek → Hız (km/h)' },
      { target:'wheel', attachment:'component', signal:'force', label:'Tekerlek → Çekiş Kuvveti (N)' },
      { target:'wheel', attachment:'component', signal:'power_out', label:'Tekerlek → Güç (kW)' },
      { target:'wheel', attachment:'component', signal:'tractive_effort', label:'Tekerlek → TE (kN)' },
      { target:'wheel', attachment:'component', signal:'drawbar_pull', label:'Tekerlek → DP (kN)' },
      { target:'wheel', attachment:'component', signal:'net_grade', label:'Tekerlek → Eğim Kapasitesi (%)' }
    ]
  },
  {
    id: 'vehicle-extended', name: 'Araç Ek Sinyaller', icon: '🚗', priority: 'optional',
    solverTab: 'performance',
    description: 'Kinetik enerji, yavaşlama (g) ve eşdeğer kütle profilleri',
    requires: ['vehicle'],
    diagrams: [
      { id:'ve-ke-v', name:'Kinetik Enerji – Hız', xAxis:'Hız (km/h)', yAxis:'Kinetik Enerji (kJ)',
        significance:'Araç kinetik enerjisinin hızla ilişkisi. Fren enerji geri kazanımı ve çarpışma güvenliği analizleri için temel veri.' },
      { id:'ve-decel-v', name:'Yavaşlama (g) – Hız', xAxis:'Hız (km/h)', yAxis:'Yavaşlama (g)',
        significance:'Aracın g cinsinden yavaşlama kapasitesi. Sürücü konforu ve yük güvenliği sınırlarının kontrolü.' }
    ],
    sensors: [
      { target:'vehicle', attachment:'component', signal:'v_accel_g', label:'Araç → İvme (g)' },
      { target:'vehicle', attachment:'component', signal:'v_decel_g', label:'Araç → Yavaşlama (g)' },
      { target:'vehicle', attachment:'component', signal:'v_kinetic_energy', label:'Araç → Kinetik Enerji (kJ)' },
      { target:'vehicle', attachment:'component', signal:'v_effective_mass', label:'Araç → Eşdeğer Kütle (kg)' }
    ]
  },
  {
    id: 'road-extended', name: 'Yol Ek Sinyaller', icon: '🛣️', priority: 'optional',
    solverTab: 'performance',
    description: 'Anlık eğim yüzdesi ve aktif segment numarası profilleri',
    requires: ['road'],
    diagrams: [
      { id:'rd-grade-t', name:'Anlık Eğim – Zaman', xAxis:'Zaman (s)', yAxis:'Eğim (%)',
        significance:'Zamana bağlı eğim profili. Sabit eğimli simülasyonda düz çizgi, segment bazlı simülasyonda basamak fonksiyonu.' }
    ],
    sensors: [
      { target:'road', attachment:'component', signal:'r_current_grade', label:'Yol → Anlık Eğim (%)' },
      { target:'road', attachment:'component', signal:'r_current_segment', label:'Yol → Aktif Segment (#)' }
    ]
  },
  {
    id: 'tc-extended', name: 'TC Ek Sinyaller', icon: '🌀', priority: 'optional',
    solverTab: 'performance',
    description: 'TC devir, güç ve K-Factor profilleri',
    requires: ['torque-converter'],
    diagrams: [
      { id:'tc-kfactor-v', name:'K-Factor – Hız', xAxis:'Hız (km/h)', yAxis:'K-Factor (rpm/√Nm)',
        significance:'Tork konvertörün K-Factor eğrisi. Stall K-factor motor-TC eşleşmesinin temel parametresidir.' },
      { id:'tc-power-loss-v', name:'TC Güç Kaybı – Hız', xAxis:'Hız (km/h)', yAxis:'Güç Kaybı (kW)',
        significance:'Tork konvertörde kaybedilen güç. Stall\'da en yüksek, lockup\'ta sıfıra yakın.' }
    ],
    sensors: [
      { target:'torque-converter', attachment:'input', signal:'rpm_in', label:'TC Girişi → Pompa Devri (rpm)' },
      { target:'torque-converter', attachment:'output', signal:'rpm_out', label:'TC Çıkışı → Türbin Devri (rpm)' },
      { target:'torque-converter', attachment:'component', signal:'power_in', label:'TC → Giriş Gücü (kW)' },
      { target:'torque-converter', attachment:'component', signal:'power_out', label:'TC → Çıkış Gücü (kW)' },
      { target:'torque-converter', attachment:'component', signal:'power_loss', label:'TC → Güç Kaybı (kW)' },
      { target:'torque-converter', attachment:'component', signal:'kfactor', label:'TC → K-Factor (rpm/√Nm)' }
    ]
  },
  {
    id: 'engine-extended', name: 'Motor Ek Sinyaller', icon: '⚙️', priority: 'optional',
    solverTab: 'performance',
    description: 'Motor açısal hız profili',
    requires: ['engine'],
    diagrams: [
      { id:'eng-angvel-t', name:'Açısal Hız – Zaman', xAxis:'Zaman (s)', yAxis:'Açısal Hız (rad/s)',
        significance:'Motorun açısal hız profili (rad/s). Atalet ve titreşim analizlerinde kullanılan temel büyüklük.' }
    ],
    sensors: [
      { target:'engine', attachment:'output', signal:'angular_vel', label:'Motor Çıkışı → Açısal Hız (rad/s)' }
    ]
  },
  {
    id: 'shift-ctrl-extended', name: 'Vites Kontrol Ek Sinyaller', icon: '🔄', priority: 'optional',
    solverTab: 'performance',
    description: 'Lockup durumu, şanzıman çıkış devri ve devir oranı profilleri',
    requires: ['shift-controller'],
    diagrams: [
      { id:'sc-lockup-t', name:'Lockup Durumu – Zaman', xAxis:'Zaman (s)', yAxis:'Lockup (0/1)',
        significance:'TC lockup clutch durumu. 0=converter modu (kaymalı), 1=lockup modu (kilitli). Geçiş noktaları kritik.' },
      { id:'sc-nout-t', name:'Şanzıman Çıkış Devri – Zaman', xAxis:'Zaman (s)', yAxis:'Çıkış Devri (rpm)',
        significance:'Şanzıman çıkış devri profili. Shift kalibrasyon ve vites oranı doğrulaması için kullanılır.' }
    ],
    sensors: [
      { target:'shift-controller', attachment:'component', signal:'gear_mode', label:'Vites Kontrol → Vites Modu' },
      { target:'shift-controller', attachment:'component', signal:'lockup_state', label:'Vites Kontrol → Lockup Durumu (0/1)' },
      { target:'shift-controller', attachment:'component', signal:'n_output', label:'Vites Kontrol → Çıkış Devri (rpm)' },
      { target:'shift-controller', attachment:'component', signal:'n_out_ratio', label:'Vites Kontrol → N_out Oranı (−)' }
    ]
  },
  {
    id: 'solver-extended', name: 'Çözücü Ek Sinyaller', icon: '📐', priority: 'optional',
    solverTab: 'performance',
    description: 'Eğim kapasitesi ve toplam ısı reddi profilleri',
    requires: ['solver'],
    diagrams: [
      { id:'sol-grade-v', name:'Net Eğim Kapasitesi – Hız', xAxis:'Hız (km/h)', yAxis:'Eğim (%)',
        significance:'Her hızda aracın tırmanabildiği maksimum eğim. Gradeability tablosunun diyagram karşılığı.' },
      { id:'sol-heat-v', name:'Toplam Isı Reddi – Hız', xAxis:'Hız (km/h)', yAxis:'Isı Reddi (kW)',
        significance:'Tüm bileşenlerden toplam ısı reddi. Soğutma sistemi boyutlandırmasının en temel verisi.' }
    ],
    sensors: [
      { target:'solver', attachment:'component', signal:'net_grade', label:'Çözücü → Eğim Kapasitesi (%)' },
      { target:'solver', attachment:'component', signal:'heat_rejection', label:'Çözücü → Toplam Isı Reddi (kW)' }
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
  },

  // ══════════════════════════════════════════════════════════════
  //  3B YÜZEY DİYAGRAMLARI — Performans
  // ══════════════════════════════════════════════════════════════
  {
    id: '3d-perf', name: '3D Performans Diyagramları', icon: '🔮', priority: 'advanced',
    solverTab: 'performance',
    description: '3 boyutlu diyagramlar: motor haritası, çekiş kuvveti, TC verimi, güç akışı, direnç ve ivme',
    requires: ['vehicle', 'engine'],
    diagrams: [
      { id:'3d-engine-map', name:'Motor Çalışma Haritası (3B)', xAxis:'RPM', yAxis:'Tork (Nm)', zAxis:'Güç (kW)',
        significance:'Motor devri × tork × güç yüzeyini 3 boyutlu gösterir. Heatmap üzerinden maksimum güç bölgesi kolayca okunur.' },
      { id:'3d-te-gear', name:'Çekiş Kuvveti Yüzeyi (3B)', xAxis:'Hız (km/h)', yAxis:'Vites', zAxis:'TE (kN)',
        significance:'Her viteste hıza bağlı çekiş kuvveti — gradeability ve tırmanma kapasitesi analizi. Vites geçiş bölgeleri renk geçişi olarak görülür.' },
      { id:'3d-tc-eff', name:'TC Verim Yüzeyi (3B)', xAxis:'Hız Oranı (SR)', yAxis:'Pump Torku (Nm)', zAxis:'Verim (%)',
        significance:'Tork konvertörün hangi SR-tork bölgesinde ne kadar verimli olduğu. Lockup stratejisi belirlemek için kritik yüzey.' },
      { id:'3d-power-flow', name:'Güç Akışı Yüzeyi (3B)', xAxis:'Hız (km/h)', yAxis:'Zaman (s)', zAxis:'Motor Gücü (kW)',
        significance:'Motor gücünün hız ve zamana göre dağılımı — drivetrain kayıp haritası. Yüksek güç bölgeleri kırmızı, düşük bölgeler mavi.' },
      { id:'3d-resist-map', name:'Direnç Dağılım Yüzeyi (3B)', xAxis:'Hız (km/h)', yAxis:'Zaman (s)', zAxis:'Toplam Direnç (N)',
        significance:'Yuvarlanma + aero + eğim dirençlerinin hız ve zamana göre evrimi. Aerodinamik baskınlık bölgesi net olarak görülür.' },
      { id:'3d-accel-rpm', name:'İvme-Hız-RPM Haritası (3B)', xAxis:'Hız (km/h)', yAxis:'Motor Devri (rpm)', zAxis:'İvme (m/s²)',
        significance:'Hangi hız-devir kombinasyonunda ne kadar ivme alındığı — vites geçiş noktalarının optimizasyonu için ideal yüzey.' }
    ],
    sensors: []
  },

  // ══════════════════════════════════════════════════════════════
  //  3B YÜZEY DİYAGRAMLARI — Hızlanma-Yavaşlama
  // ══════════════════════════════════════════════════════════════
  {
    id: '3d-sd', name: '3D Segment Diyagramları', icon: '🔮', priority: 'advanced',
    solverTab: 'accel-decel',
    description: '3 boyutlu diyagramlar: hız-mesafe-eğim, kuvvet, ısı, güç-devir, çekiş-direnç',
    requires: ['vehicle', 'engine'],
    diagrams: [
      { id:'3d-sd-speed-grade', name:'Hız-Mesafe-Eğim Profili (3B)', xAxis:'Mesafe (m)', yAxis:'Eğim Kuvveti (N)', zAxis:'Hız (km/h)',
        significance:'Yol profilinde eğime bağlı hız gelişimi. Segment geçişlerinde hız düşüşü/artışı renk değişimi olarak görülür.' },
      { id:'3d-sd-force-grade', name:'Kuvvet-Hız-Eğim Yüzeyi (3B)', xAxis:'Hız (km/h)', yAxis:'Eğim Kuvveti (N)', zAxis:'Net Kuvvet (N)',
        significance:'Farklı eğimlerde mevcut net kuvvet — tırmanamama sınırını gösteren kritik yüzey. Sıfır geçişi kırmızıdan maviye geçiş noktasıdır.' },
      { id:'3d-sd-heat', name:'TC Isı Reddi Haritası (3B)', xAxis:'Zaman (s)', yAxis:'Hız (km/h)', zAxis:'TC Isı Reddi (kW)',
        significance:'Hızlanma-yavaşlama çevrimlerinde TC termal yüklenme haritası. Yoğun ısı bölgeleri soğutma sistemi boyutlandırma girdisi.' },
      { id:'3d-sd-power-rpm', name:'Güç-RPM-Vites Yüzeyi (3B)', xAxis:'Motor Devri (rpm)', yAxis:'Vites', zAxis:'Motor Gücü (kW)',
        significance:'Her viteste motor devrinin güç üretimine etkisi. Shift kalibrasyon doğrulama — vites geçişlerinde güç kaybı görünür.' },
      { id:'3d-sd-te-resist', name:'Çekiş-Direnç Yüzeyi (3B)', xAxis:'Zaman (s)', yAxis:'Çekiş Kuvveti (kN)', zAxis:'Toplam Direnç (N)',
        significance:'Çekiş kuvveti ile direncin zamanla ilişkisi. Hızlanma/yavaşlama geçiş anları renk kontrastı olarak görülür.' }
    ],
    sensors: []
  },

  // ══════════════════════════════════════════════════════════════
  //  3B YÜZEY DİYAGRAMLARI — Engel Atlama
  // ══════════════════════════════════════════════════════════════
  {
    id: '3d-obs', name: '3D Engel Atlama Diyagramları', icon: '🔮', priority: 'advanced',
    solverTab: 'obstacle',
    description: '3 boyutlu diyagramlar: tork eşleme, kuvvet-açı, enerji, güç-verim, itme-reaksiyon',
    requires: ['torque-converter'],
    diagrams: [
      { id:'3d-obs-torque', name:'Tork Eşleme Yüzeyi (3B)', xAxis:'Hız Oranı (SR)', yAxis:'Motor Torku (Nm)', zAxis:'Tekerlek Torku (Nm)',
        significance:'Stall→lockup aralığında motor-tekerlek tork transferi. Engel aşma kapasitesinin temeli — yüksek tekerlek torku bölgeleri kırmızı renkte.' },
      { id:'3d-obs-force-angle', name:'Kuvvet-Açı-Zaman (3B)', xAxis:'Zaman (s)', yAxis:'Tekerlek Açısı (°)', zAxis:'Net Kuvvet (N)',
        significance:'Engel üzerinde ilerlerken kuvvetlerin açı ve zamanla değişimi. Kritik temas noktası ve kuvvet dağılımı net olarak görülür.' },
      { id:'3d-obs-energy', name:'Enerji-Hız-Açı (3B)', xAxis:'Tekerlek Açısı (°)', yAxis:'Hız (m/s)', zAxis:'Kinetik Enerji (J)',
        significance:'Engel tırmanırken kinetik enerji dağılımı. Momentum kaybının nerede gerçekleştiğini gösterir.' },
      { id:'3d-obs-power-eff', name:'Güç-SR-Verim Yüzeyi (3B)', xAxis:'Hız Oranı (SR)', yAxis:'Motor Gücü (kW)', zAxis:'TC Verimi (−)',
        significance:'Hız oranına göre güç ve verim ilişkisi. Optimum çalışma noktası seçimi için ideal yüzey.' },
      { id:'3d-obs-push-react', name:'İtme-Engel Kuvveti Yüzeyi (3B)', xAxis:'Zaman (s)', yAxis:'İtme Kuvveti (N)', zAxis:'Engel Reaksiyon (N)',
        significance:'Lastik itme kuvveti vs engel direnci. Aşma/aşamama sınırı renk geçişi olarak net şekilde görülür.' }
    ],
    sensors: []
  }
];

function swScanTopology() {
  var result = {
    hasEngine:false, hasTC:false, hasGearbox:false, hasTransfer:false,
    hasDiff:false, hasPropshaft:false, hasWheel:false, hasVehicle:false,
    hasRoad:false, hasShiftCtrl:false, hasSolver:false, hasScenario:false,
    hasGearShift:false, hasObstacleCrossing:false,
    engineNode:null, tcNode:null, gearboxNode:null, transferNode:null,
    diffNode:null, propshaftNode:null, wheelNode:null, vehicleNode:null,
    roadNode:null, shiftCtrlNode:null, solverNode:null, scenarioNode:null,
    gearShiftNode:null, obstacleCrossingNode:null,
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
      case 'propshaft': result.hasPropshaft=true; result.propshaftNode=n; break;
      case 'wheel': result.hasWheel=true; result.wheelNode=n; break;
      case 'vehicle': result.hasVehicle=true; result.vehicleNode=n; break;
      case 'road': result.hasRoad=true; result.roadNode=n; break;
      case 'shift-controller': result.hasShiftCtrl=true; result.shiftCtrlNode=n; break;
      case 'solver': result.hasSolver=true; result.solverNode=n; break;
      case 'scenario': result.hasScenario=true; result.scenarioNode=n; break;
      case 'gear-shift': result.hasGearShift=true; result.gearShiftNode=n; break;
      case 'obstacle-crossing': result.hasObstacleCrossing=true; result.obstacleCrossingNode=n; break;
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
  // Şanzıman Detay
  'gb-io-torque': { x:{target:'vehicle', signal:'v_speed', name:'Hız', unit:'km/h'}, y:[
    {target:'gearbox', signal:'torque_in', name:'Giriş Torku', unit:'Nm'},
    {target:'gearbox', signal:'torque_out', name:'Çıkış Torku', unit:'Nm'}
  ]},
  'gb-io-rpm':    { x:{target:'vehicle', signal:'v_speed', name:'Hız', unit:'km/h'}, y:[
    {target:'gearbox', signal:'rpm_in', name:'Giriş Devri', unit:'rpm'},
    {target:'gearbox', signal:'rpm_out', name:'Çıkış Devri', unit:'rpm'}
  ]},
  'gb-power-loss':{ x:{target:'vehicle', signal:'v_speed', name:'Hız', unit:'km/h'}, y:[{target:'gearbox', signal:'power_loss', name:'Güç Kaybı', unit:'kW'}] },
  'gb-efficiency':{ x:{target:'vehicle', signal:'v_speed', name:'Hız', unit:'km/h'}, y:[{target:'gearbox', signal:'efficiency', name:'Verim', unit:'%'}] },
  'gb-ratio-t':   { x:{target:'time'}, y:[{target:'gearbox', signal:'ratio', name:'Vites Oranı', unit:'−'}] },
  // Transfer Kutusu
  'tf-io-torque': { x:{target:'vehicle', signal:'v_speed', name:'Hız', unit:'km/h'}, y:[
    {target:'transfer', signal:'torque_in', name:'Giriş Torku', unit:'Nm'},
    {target:'transfer', signal:'torque_out', name:'Çıkış Torku', unit:'Nm'}
  ]},
  'tf-power-loss':{ x:{target:'vehicle', signal:'v_speed', name:'Hız', unit:'km/h'}, y:[{target:'transfer', signal:'power_loss', name:'Güç Kaybı', unit:'kW'}] },
  // Propşaft
  'ps-io-torque': { x:{target:'vehicle', signal:'v_speed', name:'Hız', unit:'km/h'}, y:[
    {target:'propshaft', signal:'torque_in', name:'Giriş Torku', unit:'Nm'},
    {target:'propshaft', signal:'torque_out', name:'Çıkış Torku', unit:'Nm'}
  ]},
  'ps-power-loss':{ x:{target:'vehicle', signal:'v_speed', name:'Hız', unit:'km/h'}, y:[{target:'propshaft', signal:'power_loss', name:'Güç Kaybı', unit:'kW'}] },
  // Diferansiyel
  'diff-io-torque':{ x:{target:'vehicle', signal:'v_speed', name:'Hız', unit:'km/h'}, y:[
    {target:'differential', signal:'torque_in', name:'Giriş Torku', unit:'Nm'},
    {target:'differential', signal:'torque_out', name:'Yarım Aks Torku', unit:'Nm'}
  ]},
  'diff-power-loss':{ x:{target:'vehicle', signal:'v_speed', name:'Hız', unit:'km/h'}, y:[{target:'differential', signal:'power_loss', name:'Güç Kaybı', unit:'kW'}] },
  // Tekerlek
  'wh-force-v':   { x:{target:'vehicle', signal:'v_speed', name:'Hız', unit:'km/h'}, y:[{target:'wheel', signal:'force', name:'Çekiş Kuvveti', unit:'N'}] },
  'wh-torque-v':  { x:{target:'vehicle', signal:'v_speed', name:'Hız', unit:'km/h'}, y:[{target:'wheel', signal:'torque_in', name:'Tekerlek Torku', unit:'Nm'}] },
  'wh-te-dp-v':   { x:{target:'vehicle', signal:'v_speed', name:'Hız', unit:'km/h'}, y:[
    {target:'wheel', signal:'tractive_effort', name:'Çekiş Kuvveti (TE)', unit:'kN'},
    {target:'wheel', signal:'drawbar_pull', name:'Drawbar Pull (DP)', unit:'kN'}
  ]},
  'wh-grade-v':   { x:{target:'vehicle', signal:'v_speed', name:'Hız', unit:'km/h'}, y:[{target:'wheel', signal:'net_grade', name:'Eğim Kapasitesi', unit:'%'}] },
  // Araç Ek
  've-ke-v':      { x:{target:'vehicle', signal:'v_speed', name:'Hız', unit:'km/h'}, y:[{target:'vehicle', signal:'v_kinetic_energy', name:'Kinetik Enerji', unit:'kJ'}] },
  've-decel-v':   { x:{target:'vehicle', signal:'v_speed', name:'Hız', unit:'km/h'}, y:[{target:'vehicle', signal:'v_decel_g', name:'Yavaşlama', unit:'g'}] },
  // Yol Ek
  'rd-grade-t':   { x:{target:'time'}, y:[{target:'road', signal:'r_current_grade', name:'Anlık Eğim', unit:'%'}] },
  // TC Ek
  'tc-kfactor-v':    { x:{target:'vehicle', signal:'v_speed', name:'Hız', unit:'km/h'}, y:[{target:'torque-converter', signal:'kfactor', name:'K-Factor', unit:'rpm/√Nm'}] },
  'tc-power-loss-v': { x:{target:'vehicle', signal:'v_speed', name:'Hız', unit:'km/h'}, y:[{target:'torque-converter', signal:'power_loss', name:'Güç Kaybı', unit:'kW'}] },
  // Motor Ek
  'eng-angvel-t':    { x:{target:'time'}, y:[{target:'engine', signal:'angular_vel', name:'Açısal Hız', unit:'rad/s'}] },
  // Vites Kontrol Ek
  'sc-lockup-t':     { x:{target:'time'}, y:[{target:'shift-controller', signal:'lockup_state', name:'Lockup Durumu', unit:'0/1'}] },
  'sc-nout-t':       { x:{target:'time'}, y:[{target:'shift-controller', signal:'n_output', name:'Çıkış Devri', unit:'rpm'}] },
  // Çözücü Ek
  'sol-grade-v':     { x:{target:'vehicle', signal:'v_speed', name:'Hız', unit:'km/h'}, y:[{target:'solver', signal:'net_grade', name:'Eğim Kapasitesi', unit:'%'}] },
  'sol-heat-v':      { x:{target:'vehicle', signal:'v_speed', name:'Hız', unit:'km/h'}, y:[{target:'solver', signal:'heat_rejection', name:'Toplam Isı Reddi', unit:'kW'}] },
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
  ], dataSource:'obstacleDynamic' },

  // ══════════════════════════════════════════════════════════════════════
  // 3B YÜZEY DİYAGRAMLARI (surface)  —  x, y[0], z formatı
  // ══════════════════════════════════════════════════════════════════════

  // ── Performans Analizi 3B ──
  '3d-engine-map':    { x:{target:'engine', signal:'rpm', name:'Motor Devri', unit:'rpm'},
    y:[{target:'engine', signal:'torque', name:'Motor Torku', unit:'Nm'}],
    z:{target:'engine', signal:'power', name:'Motor Gücü [kW]', unit:'kW'} },
  '3d-te-gear':       { x:{target:'vehicle', signal:'v_speed', name:'Hız', unit:'km/h'},
    y:[{target:'shift-controller', signal:'current_gear', name:'Aktif Vites', unit:'−'}],
    z:{target:'solver', signal:'tractive_effort', name:'Çekiş Kuvveti [kN]', unit:'kN'} },
  '3d-tc-eff':        { x:{target:'torque-converter', signal:'speed_ratio', name:'Hız Oranı (SR)', unit:'−'},
    y:[{target:'torque-converter', signal:'torque_in', name:'Pump Torku', unit:'Nm'}],
    z:{target:'torque-converter', signal:'efficiency', name:'TC Verimi [%]', unit:'%'} },
  '3d-power-flow':    { x:{target:'vehicle', signal:'v_speed', name:'Hız', unit:'km/h'},
    y:[{target:'time', signal:'time', name:'Zaman', unit:'s'}],
    z:{target:'engine', signal:'power', name:'Motor Gücü [kW]', unit:'kW'} },
  '3d-resist-map':    { x:{target:'vehicle', signal:'v_speed', name:'Hız', unit:'km/h'},
    y:[{target:'time', signal:'time', name:'Zaman', unit:'s'}],
    z:{target:'road', signal:'r_total_resist', name:'Toplam Direnç [N]', unit:'N'} },
  '3d-accel-rpm':     { x:{target:'vehicle', signal:'v_speed', name:'Hız', unit:'km/h'},
    y:[{target:'engine', signal:'rpm', name:'Motor Devri', unit:'rpm'}],
    z:{target:'vehicle', signal:'v_accel', name:'İvme [m/s²]', unit:'m/s²'} },

  // ── Hızlanma-Yavaşlama 3B ──
  '3d-sd-speed-grade': { x:{target:'vehicle', signal:'v_distance', name:'Mesafe', unit:'m'},
    y:[{target:'road', signal:'r_grade_force', name:'Eğim Kuvveti', unit:'N'}],
    z:{target:'vehicle', signal:'v_speed', name:'Hız [km/h]', unit:'km/h'}, dataSource:'segmentDrive' },
  '3d-sd-force-grade': { x:{target:'vehicle', signal:'v_speed', name:'Hız', unit:'km/h'},
    y:[{target:'road', signal:'r_grade_force', name:'Eğim Kuvveti', unit:'N'}],
    z:{target:'road', signal:'r_net_force', name:'Net Kuvvet [N]', unit:'N'}, dataSource:'segmentDrive' },
  '3d-sd-heat':        { x:{target:'time'},
    y:[{target:'vehicle', signal:'v_speed', name:'Hız', unit:'km/h'}],
    z:{target:'torque-converter', signal:'heat_rejection', name:'TC Isı Reddi [kW]', unit:'kW'}, dataSource:'segmentDrive' },
  '3d-sd-power-rpm':   { x:{target:'engine', signal:'rpm', name:'Motor Devri', unit:'rpm'},
    y:[{target:'shift-controller', signal:'current_gear', name:'Aktif Vites', unit:'−'}],
    z:{target:'engine', signal:'power', name:'Motor Gücü [kW]', unit:'kW'}, dataSource:'segmentDrive' },
  '3d-sd-te-resist':   { x:{target:'time'},
    y:[{target:'solver', signal:'tractive_effort', name:'Çekiş Kuvveti', unit:'kN'}],
    z:{target:'road', signal:'r_total_resist', name:'Toplam Direnç [N]', unit:'N'}, dataSource:'segmentDrive' },

  // ── Engel Atlama 3B ──
  '3d-obs-torque':     { x:{target:'obs-match', signal:'SR', name:'Hız Oranı (SR)', unit:'−'},
    y:[{target:'obs-match', signal:'T_engine', name:'Motor Torku', unit:'Nm'}],
    z:{target:'obs-match', signal:'T_wheel', name:'Tekerlek Torku [Nm]', unit:'Nm'}, dataSource:'obstacleDynamic' },
  '3d-obs-force-angle':{ x:{target:'obs-log', signal:'t', name:'Zaman', unit:'s'},
    y:[{target:'obs-log', signal:'phi_deg', name:'Tekerlek Açısı', unit:'°'}],
    z:{target:'obs-log', signal:'F_net', name:'Net Kuvvet [N]', unit:'N'}, dataSource:'obstacleDynamic' },
  '3d-obs-energy':     { x:{target:'obs-log', signal:'phi_deg', name:'Tekerlek Açısı', unit:'°'},
    y:[{target:'obs-log', signal:'v', name:'Hız', unit:'m/s'}],
    z:{target:'obs-log', signal:'KE', name:'Kinetik Enerji [J]', unit:'J'}, dataSource:'obstacleDynamic' },
  '3d-obs-power-eff':  { x:{target:'obs-match', signal:'SR', name:'Hız Oranı (SR)', unit:'−'},
    y:[{target:'obs-match', signal:'P_engine_kW', name:'Motor Gücü', unit:'kW'}],
    z:{target:'obs-match', signal:'eta_tc', name:'TC Verimi [−]', unit:'−'}, dataSource:'obstacleDynamic' },
  '3d-obs-push-react': { x:{target:'obs-log', signal:'t', name:'Zaman', unit:'s'},
    y:[{target:'obs-log', signal:'F_itme', name:'İtme Kuvveti', unit:'N'}],
    z:{target:'obs-log', signal:'F_engel', name:'Engel Reaksiyon [N]', unit:'N'}, dataSource:'obstacleDynamic' }
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
  var html = '<div style="background:var(--bg-primary,#fff);border-radius:0;padding:20px;max-width:440px;width:90%;box-shadow:0 8px 32px rgba(0,0,0,0.3);color:var(--text-primary,#333);">';
  html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">';
  var diagIcon = d.zAxis ? '🔮' : '📊';
  html += '<span style="font-weight:700;font-size:0.9rem;">' + diagIcon + ' ' + d.name + '</span>';
  html += '<button onclick="document.getElementById(\'sw-info-overlay\').remove()" style="background:none;border:none;font-size:1.1rem;cursor:pointer;color:var(--text-muted,#999);">✕</button>';
  html += '</div>';
  var axisInfo = '<b>X:</b> ' + d.xAxis + ' &nbsp; <b>Y:</b> ' + (Array.isArray(d.yAxis) ? d.yAxis.join(' / ') : d.yAxis);
  if(d.zAxis) axisInfo += ' &nbsp; <b>Z (renk):</b> ' + d.zAxis;
  html += '<div style="font-size:0.72rem;color:var(--text-secondary,#666);margin-bottom:8px;">' + axisInfo + '</div>';
  html += '<div style="font-size:0.72rem;line-height:1.5;color:var(--text-primary,#333);border-top:1px solid var(--border-color,#eee);padding-top:10px;">' + d.significance + '</div>';
  if(d.note) {
    html += '<div style="font-size:0.68rem;color:#f59e0b;margin-top:8px;padding:6px 8px;background:rgba(245,158,11,0.08);border-radius:0;">⚠️ ' + d.note + '</div>';
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
    {k:'Şanzıman', v:topo.hasGearbox}, {k:'Şanz. Kontrol', v:topo.hasShiftCtrl},
    {k:'Transfer Kutusu', v:topo.hasTransfer}, {k:'Propşaft', v:topo.hasPropshaft},
    {k:'Diferansiyel', v:topo.hasDiff}, {k:'Tekerlek', v:topo.hasWheel},
    {k:'Araç', v:topo.hasVehicle}, {k:'Yol / Ortam', v:topo.hasRoad},
    {k:'Senaryo', v:topo.hasScenario}, {k:'Vites Geçişleri', v:topo.hasGearShift}
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

