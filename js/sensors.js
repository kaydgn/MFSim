// ═══════════════════════════════════════════════════════════════════════════════
// SENSÖR SİHİRBAZI — Paketler, Topoloji Tarama, Otomatik Yerleştirme
// ═══════════════════════════════════════════════════════════════════════════════

var SENSOR_PACKAGES = [
  // ══════════════════════════════════════════════════════════════
  //  PERFORMANS ANALİZİ (Tam Gaz Hızlanma) — solverTab: 'performance'
  // ══════════════════════════════════════════════════════════════
  {
    id: 'performance', name: 'Performans eğrileri', icon: '<span class="mf-ico mf-ico-flag"></span>', priority: 'essential',
    solverTab: 'performance',
    requires: ['vehicle'],
    diagrams: [
      { id:'v-t', name:'Araç hızı – Zaman', xAxis:'Zaman (s)', yAxis:'Hız (km/h)' },
      { id:'s-t', name:'Mesafe – Zaman', xAxis:'Zaman (s)', yAxis:'Mesafe (m)' },
      { id:'a-v', name:'İvme – Araç hızı', xAxis:'Hız (km/h)', yAxis:'İvme (m/s²)' },
      { id:'a-t', name:'İvme – Zaman', xAxis:'Zaman (s)', yAxis:'İvme (m/s²)' }
    ],
    sensors: [
      { target:'vehicle', attachment:'component', signal:'v_speed', label:'Araç → Araç hızı (km/h)' },
      { target:'vehicle', attachment:'component', signal:'v_distance', label:'Araç → Kat edilen mesafe (m)' },
      { target:'vehicle', attachment:'component', signal:'v_accel', label:'Araç → İvme (m/s²)' }
    ]
  },
  {
    id: 'engine-analysis', name: 'Motor çalışma analizi', icon: '<span class="mf-ico mf-ico-settings"></span>', priority: 'essential',
    solverTab: 'performance',
    requires: ['engine'],
    diagrams: [
      { id:'rpm-v', name:'Motor devri – Araç hızı', xAxis:'Hız (km/h)', yAxis:'Motor devri (rpm)' },
      { id:'rpm-t', name:'Motor devri – Zaman', xAxis:'Zaman (s)', yAxis:'Motor devri (rpm)' },
      { id:'torque-v', name:'Motor torku – Araç hızı', xAxis:'Hız (km/h)', yAxis:'Motor torku (Nm)' },
      { id:'power-v', name:'Motor gücü – Araç hızı', xAxis:'Hız (km/h)', yAxis:'Motor gücü (kW)' }
    ],
    sensors: [
      { target:'engine', attachment:'output', signal:'rpm', label:'Motor çıkışı → Devir (rpm)' },
      { target:'engine', attachment:'output', signal:'torque', label:'Motor çıkışı → Tork (Nm)' },
      { target:'engine', attachment:'output', signal:'power', label:'Motor çıkışı → Güç (kW)' }
    ]
  },
  {
    id: 'tc-analysis', name: 'Tork konvertör analizi', icon: '<span class="mf-ico mf-ico-disc"></span>', priority: 'recommended',
    solverTab: 'performance',
    requires: ['torque-converter'],
    diagrams: [
      { id:'sr-v', name:'Hız oranı (SR) – Araç hızı', xAxis:'Hız (km/h)', yAxis:'Speed Ratio (SR)' },
      { id:'tr-v', name:'Tork oranı (TR) – Araç hızı', xAxis:'Hız (km/h)', yAxis:'Torque Ratio (TR)' },
      { id:'eta-tc-v', name:'TC verimi – Araç hızı', xAxis:'Hız (km/h)', yAxis:'Verim η (%)' },
      { id:'tc-slip-v', name:'TC kayma – Araç hızı', xAxis:'Hız (km/h)', yAxis:'Kayma (%)' },
      { id:'tc-io-torque', name:'TC giriş/çıkış torku – Araç hızı', xAxis:'Hız (km/h)', yAxis:'Tork (Nm)' }
    ],
    sensors: [
      { target:'torque-converter', attachment:'component', signal:'speed_ratio', label:'TC → Hız oranı (SR)' },
      { target:'torque-converter', attachment:'component', signal:'torque_ratio', label:'TC → Tork oranı (TR)' },
      { target:'torque-converter', attachment:'component', signal:'efficiency', label:'TC → Verim η (%)' },
      { target:'torque-converter', attachment:'component', signal:'slip', label:'TC → Kayma (%)' },
      { target:'torque-converter', attachment:'input', signal:'torque_in', label:'TC girişi → Pump torku (Nm)' },
      { target:'torque-converter', attachment:'output', signal:'torque_out', label:'TC çıkışı → Türbin torku (Nm)' }
    ]
  },
  {
    id: 'traction-analysis', name: 'Çekiş kuvveti analizi', icon: '<span class="mf-ico mf-ico-activity"></span>', priority: 'essential',
    solverTab: 'performance',
    requires: ['vehicle'],
    diagrams: [
      { id:'te-v', name:'Çekiş kuvveti (TE) – Araç hızı', xAxis:'Hız (km/h)', yAxis:'Çekiş kuvveti (kN)' },
      { id:'dp-v', name:'Net çekiş (DP) – Araç hızı', xAxis:'Hız (km/h)', yAxis:'Drawbar Pull (kN)' },
      { id:'resistances-v', name:'Direnç kuvvetleri – Araç hızı', xAxis:'Hız (km/h)', yAxis:'Kuvvet (kN)' },
      { id:'power-balance-v', name:'Güç dengesi – Araç hızı', xAxis:'Hız (km/h)', yAxis:'Güç (kW)' }
    ],
    sensors: [
      { target:'solver', attachment:'component', signal:'tractive_effort', label:'Çözücü → Çekiş kuvveti TE (kN)' },
      { target:'solver', attachment:'component', signal:'drawbar_pull', label:'Çözücü → Net çekiş DP (kN)' },
      { target:'road', attachment:'component', signal:'r_rolling_force', label:'Yol → Yuvarlanma direnci (N)' },
      { target:'road', attachment:'component', signal:'r_aero_force', label:'Yol → Aerodinamik direnç (N)' },
      { target:'road', attachment:'component', signal:'r_total_resist', label:'Yol → Toplam direnç (N)' },
      { target:'engine', attachment:'output', signal:'power', label:'Motor çıkışı → Güç (kW)' },
      { target:'solver', attachment:'component', signal:'wheel_power', label:'Çözücü → Tekerlekte güç (kW)' }
    ]
  },
  {
    id: 'shift-analysis', name: 'Vites geçiş analizi', icon: '<span class="mf-ico mf-ico-refresh"></span>', priority: 'recommended',
    solverTab: 'performance',
    requires: ['gearbox', 'shift-controller'],
    diagrams: [
      { id:'gear-t', name:'Aktif vites – Zaman', xAxis:'Zaman (s)', yAxis:'Vites numarası' },
      { id:'gear-v', name:'Aktif vites – Araç hızı', xAxis:'Hız (km/h)', yAxis:'Vites numarası' },
      { id:'trans-out-v', name:'Şanzıman çıkış torku – Araç hızı', xAxis:'Hız (km/h)', yAxis:'Çıkış torku (Nm)' },
      { id:'shift-rpm-t', name:'Vites geçiş RPM profili – Zaman', xAxis:'Zaman (s)', yAxis:'Motor devri + vites' }
    ],
    sensors: [
      { target:'shift-controller', attachment:'component', signal:'current_gear', label:'Şanzıman Kontrol → Aktif vites' },
      { target:'gearbox', attachment:'output', signal:'torque_out', label:'Şanzıman çıkışı → Çıkış torku (Nm)' },
      { target:'gearbox', attachment:'output', signal:'rpm_out', label:'Şanzıman çıkışı → Çıkış devri (rpm)' }
    ]
  },
  {
    id: 'gearbox-analysis', name: 'Şanzıman detay analizi', icon: '<span class="mf-ico mf-ico-settings"></span>', priority: 'recommended',
    solverTab: 'performance',
    requires: ['gearbox'],
    diagrams: [
      { id:'gb-io-torque', name:'Şanzıman giriş/çıkış torku – Hız', xAxis:'Hız (km/h)', yAxis:'Tork (Nm)' },
      { id:'gb-io-rpm', name:'Şanzıman giriş/çıkış devri – Hız', xAxis:'Hız (km/h)', yAxis:'Devir (rpm)' },
      { id:'gb-power-loss', name:'Şanzıman güç kaybı – Hız', xAxis:'Hız (km/h)', yAxis:'Güç kaybı (kW)' },
      { id:'gb-efficiency', name:'Şanzıman verimi – Hız', xAxis:'Hız (km/h)', yAxis:'Verim (%)' },
      { id:'gb-ratio-t', name:'Vites oranı – Zaman', xAxis:'Zaman (s)', yAxis:'Vites oranı (−)' }
    ],
    sensors: [
      { target:'gearbox', attachment:'input', signal:'rpm_in', label:'Şanzıman girişi → Giriş devri (rpm)' },
      { target:'gearbox', attachment:'input', signal:'torque_in', label:'Şanzıman girişi → Giriş torku (Nm)' },
      { target:'gearbox', attachment:'component', signal:'power_in', label:'Şanzıman → Giriş gücü (kW)' },
      { target:'gearbox', attachment:'component', signal:'power_out', label:'Şanzıman → Çıkış gücü (kW)' },
      { target:'gearbox', attachment:'component', signal:'power_loss', label:'Şanzıman → Güç kaybı (kW)' },
      { target:'gearbox', attachment:'component', signal:'gear', label:'Şanzıman → Aktif vites (−)' },
      { target:'gearbox', attachment:'component', signal:'ratio', label:'Şanzıman → Vites oranı (−)' },
      { target:'gearbox', attachment:'component', signal:'gear_mode', label:'Şanzıman → Vites modu (C/L)' },
      { target:'gearbox', attachment:'component', signal:'efficiency', label:'Şanzıman → Verim (%)' }
    ]
  },
  {
    id: 'transfer-analysis', name: 'Transfer Kutusu analizi', icon: '<span class="mf-ico mf-ico-shuffle"></span>', priority: 'recommended',
    solverTab: 'performance',
    requires: ['transfer'],
    diagrams: [
      { id:'tf-io-torque', name:'Transfer giriş/çıkış torku – Hız', xAxis:'Hız (km/h)', yAxis:'Tork (Nm)' },
      { id:'tf-power-loss', name:'Transfer güç kaybı – Hız', xAxis:'Hız (km/h)', yAxis:'Güç kaybı (kW)' }
    ],
    sensors: [
      { target:'transfer', attachment:'input', signal:'rpm_in', label:'Transfer girişi → Giriş devri (rpm)' },
      { target:'transfer', attachment:'input', signal:'torque_in', label:'Transfer girişi → Giriş torku (Nm)' },
      { target:'transfer', attachment:'output', signal:'rpm_out', label:'Transfer çıkışı → Çıkış devri (rpm)' },
      { target:'transfer', attachment:'output', signal:'torque_out', label:'Transfer çıkışı → Çıkış torku (Nm)' },
      { target:'transfer', attachment:'component', signal:'power_in', label:'Transfer → Giriş gücü (kW)' },
      { target:'transfer', attachment:'component', signal:'power_out', label:'Transfer → Çıkış gücü (kW)' },
      { target:'transfer', attachment:'component', signal:'power_loss', label:'Transfer → Güç kaybı (kW)' }
    ]
  },
  {
    id: 'propshaft-analysis', name: 'Propşaft analizi', icon: '<span class="mf-ico mf-ico-nut"></span>', priority: 'optional',
    solverTab: 'performance',
    requires: ['propshaft'],
    diagrams: [
      { id:'ps-io-torque', name:'Propşaft giriş/çıkış torku – Hız', xAxis:'Hız (km/h)', yAxis:'Tork (Nm)' },
      { id:'ps-power-loss', name:'Propşaft güç kaybı – Hız', xAxis:'Hız (km/h)', yAxis:'Güç kaybı (kW)' }
    ],
    sensors: [
      { target:'propshaft', attachment:'input', signal:'rpm_in', label:'Propşaft girişi → Giriş devri (rpm)' },
      { target:'propshaft', attachment:'input', signal:'torque_in', label:'Propşaft girişi → Giriş torku (Nm)' },
      { target:'propshaft', attachment:'output', signal:'rpm_out', label:'Propşaft çıkışı → Çıkış devri (rpm)' },
      { target:'propshaft', attachment:'output', signal:'torque_out', label:'Propşaft çıkışı → Çıkış torku (Nm)' },
      { target:'propshaft', attachment:'component', signal:'power_in', label:'Propşaft → Giriş gücü (kW)' },
      { target:'propshaft', attachment:'component', signal:'power_out', label:'Propşaft → Çıkış gücü (kW)' },
      { target:'propshaft', attachment:'component', signal:'power_loss', label:'Propşaft → Güç kaybı (kW)' }
    ]
  },
  {
    id: 'diff-analysis', name: 'Diferansiyel analizi', icon: '<span class="mf-ico mf-ico-settings"></span>', priority: 'optional',
    solverTab: 'performance',
    requires: ['differential'],
    diagrams: [
      { id:'diff-io-torque', name:'Diferansiyel giriş/çıkış torku – Hız', xAxis:'Hız (km/h)', yAxis:'Tork (Nm)' },
      { id:'diff-power-loss', name:'Diferansiyel güç kaybı – Hız', xAxis:'Hız (km/h)', yAxis:'Güç kaybı (kW)' }
    ],
    sensors: [
      { target:'differential', attachment:'input', signal:'rpm_in', label:'Diferansiyel girişi → Giriş devri (rpm)' },
      { target:'differential', attachment:'input', signal:'torque_in', label:'Diferansiyel girişi → Giriş torku (Nm)' },
      { target:'differential', attachment:'output', signal:'rpm_out', label:'Diferansiyel çıkışı → Yarım aks devri (rpm)' },
      { target:'differential', attachment:'output', signal:'torque_out', label:'Diferansiyel çıkışı → Yarım aks torku (Nm)' },
      { target:'differential', attachment:'component', signal:'power_in', label:'Diferansiyel → Giriş gücü (kW)' },
      { target:'differential', attachment:'component', signal:'power_out', label:'Diferansiyel → Çıkış gücü (kW)' },
      { target:'differential', attachment:'component', signal:'power_loss', label:'Diferansiyel → Güç kaybı (kW)' }
    ]
  },
  {
    id: 'wheel-analysis', name: 'Tekerlek analizi', icon: '<span class="mf-ico mf-ico-wheel"></span>', priority: 'recommended',
    solverTab: 'performance',
    requires: ['wheel'],
    diagrams: [
      { id:'wh-force-v', name:'Tekerlek çekiş kuvveti – Hız', xAxis:'Hız (km/h)', yAxis:'Kuvvet (N)' },
      { id:'wh-torque-v', name:'Tekerlek torku – Hız', xAxis:'Hız (km/h)', yAxis:'Tork (Nm)' },
      { id:'wh-te-dp-v', name:'TE ve DP – Hız', xAxis:'Hız (km/h)', yAxis:'Kuvvet (kN)' },
      { id:'wh-grade-v', name:'Eğim kapasitesi – Hız', xAxis:'Hız (km/h)', yAxis:'Eğim (%)' }
    ],
    sensors: [
      { target:'wheel', attachment:'component', signal:'rpm_in', label:'Tekerlek → Devir (rpm)' },
      { target:'wheel', attachment:'component', signal:'torque_in', label:'Tekerlek → Tork (Nm)' },
      { target:'wheel', attachment:'component', signal:'speed', label:'Tekerlek → Hız (km/h)' },
      { target:'wheel', attachment:'component', signal:'force', label:'Tekerlek → Çekiş kuvveti (N)' },
      { target:'wheel', attachment:'component', signal:'power_out', label:'Tekerlek → Güç (kW)' },
      { target:'wheel', attachment:'component', signal:'tractive_effort', label:'Tekerlek → TE (kN)' },
      { target:'wheel', attachment:'component', signal:'drawbar_pull', label:'Tekerlek → DP (kN)' },
      { target:'wheel', attachment:'component', signal:'net_grade', label:'Tekerlek → Eğim kapasitesi (%)' }
    ]
  },
  {
    id: 'vehicle-extended', name: 'Araç ek sinyaller', icon: '<span class="mf-ico mf-ico-car"></span>', priority: 'optional',
    solverTab: 'performance',
    requires: ['vehicle'],
    diagrams: [
      { id:'ve-ke-v', name:'Kinetik enerji – Hız', xAxis:'Hız (km/h)', yAxis:'Kinetik enerji (kJ)' },
      { id:'ve-decel-v', name:'Yavaşlama (g) – Hız', xAxis:'Hız (km/h)', yAxis:'Yavaşlama (g)' }
    ],
    sensors: [
      { target:'vehicle', attachment:'component', signal:'v_accel_g', label:'Araç → İvme (g)' },
      { target:'vehicle', attachment:'component', signal:'v_decel_g', label:'Araç → Yavaşlama (g)' },
      { target:'vehicle', attachment:'component', signal:'v_kinetic_energy', label:'Araç → Kinetik enerji (kJ)' },
      { target:'vehicle', attachment:'component', signal:'v_effective_mass', label:'Araç → Eşdeğer kütle (kg)' }
    ]
  },
  {
    id: 'road-extended', name: 'Yol ek sinyaller', icon: '<span class="mf-ico mf-ico-route"></span>', priority: 'optional',
    solverTab: 'performance',
    requires: ['road'],
    diagrams: [
      { id:'rd-grade-t', name:'Anlık eğim – Zaman', xAxis:'Zaman (s)', yAxis:'Eğim (%)' }
    ],
    sensors: [
      { target:'road', attachment:'component', signal:'r_current_grade', label:'Yol → Anlık eğim (%)' },
      { target:'road', attachment:'component', signal:'r_current_segment', label:'Yol → Aktif segment (#)' }
    ]
  },
  {
    id: 'tc-extended', name: 'TC ek sinyaller', icon: '<span class="mf-ico mf-ico-disc"></span>', priority: 'optional',
    solverTab: 'performance',
    requires: ['torque-converter'],
    diagrams: [
      { id:'tc-kfactor-v', name:'K-Factor – Hız', xAxis:'Hız (km/h)', yAxis:'K-Factor (rpm/√Nm)' },
      { id:'tc-power-loss-v', name:'TC güç kaybı – Hız', xAxis:'Hız (km/h)', yAxis:'Güç kaybı (kW)' }
    ],
    sensors: [
      { target:'torque-converter', attachment:'input', signal:'rpm_in', label:'TC girişi → Pompa devri (rpm)' },
      { target:'torque-converter', attachment:'output', signal:'rpm_out', label:'TC çıkışı → Türbin devri (rpm)' },
      { target:'torque-converter', attachment:'component', signal:'power_in', label:'TC → Giriş gücü (kW)' },
      { target:'torque-converter', attachment:'component', signal:'power_out', label:'TC → Çıkış gücü (kW)' },
      { target:'torque-converter', attachment:'component', signal:'power_loss', label:'TC → Güç kaybı (kW)' },
      { target:'torque-converter', attachment:'component', signal:'kfactor', label:'TC → K-Factor (rpm/√Nm)' }
    ]
  },
  {
    id: 'engine-extended', name: 'Motor ek sinyaller', icon: '<span class="mf-ico mf-ico-settings"></span>', priority: 'optional',
    solverTab: 'performance',
    requires: ['engine'],
    diagrams: [
      { id:'eng-angvel-t', name:'Açısal hız – Zaman', xAxis:'Zaman (s)', yAxis:'Açısal hız (rad/s)' }
    ],
    sensors: [
      { target:'engine', attachment:'output', signal:'angular_vel', label:'Motor çıkışı → Açısal hız (rad/s)' }
    ]
  },
  {
    id: 'shift-ctrl-extended', name: 'Vites kontrol ek sinyaller', icon: '<span class="mf-ico mf-ico-refresh"></span>', priority: 'optional',
    solverTab: 'performance',
    requires: ['shift-controller'],
    diagrams: [
      { id:'sc-lockup-t', name:'Lockup durumu – Zaman', xAxis:'Zaman (s)', yAxis:'Lockup (0/1)' },
      { id:'sc-nout-t', name:'Şanzıman çıkış devri – Zaman', xAxis:'Zaman (s)', yAxis:'Çıkış devri (rpm)' }
    ],
    sensors: [
      { target:'shift-controller', attachment:'component', signal:'gear_mode', label:'Vites kontrol → Vites modu' },
      { target:'shift-controller', attachment:'component', signal:'lockup_state', label:'Vites kontrol → Lockup durumu (0/1)' },
      { target:'shift-controller', attachment:'component', signal:'n_output', label:'Vites kontrol → Çıkış devri (rpm)' },
      { target:'shift-controller', attachment:'component', signal:'n_out_ratio', label:'Vites kontrol → N_out oranı (−)' }
    ]
  },
  {
    id: 'solver-extended', name: 'Çözücü ek sinyaller', icon: '<span class="mf-ico mf-ico-ruler"></span>', priority: 'optional',
    solverTab: 'performance',
    requires: ['solver'],
    diagrams: [
      { id:'sol-grade-v', name:'Net eğim kapasitesi – Hız', xAxis:'Hız (km/h)', yAxis:'Eğim (%)' },
      { id:'sol-heat-v', name:'Toplam ısı reddi – Hız', xAxis:'Hız (km/h)', yAxis:'Isı reddi (kW)' }
    ],
    sensors: [
      { target:'solver', attachment:'component', signal:'net_grade', label:'Çözücü → Eğim kapasitesi (%)' },
      { target:'solver', attachment:'component', signal:'heat_rejection', label:'Çözücü → Toplam ısı reddi (kW)' }
    ]
  },
  {
    id: 'comparison', name: 'Karşılaştırma diyagramları', icon: '<span class="mf-ico mf-ico-contrast"></span>', priority: 'advanced',
    solverTab: 'performance',
    requires: ['vehicle', 'engine', 'torque-converter'],
    dependsOn: ['performance', 'engine-analysis', 'tc-analysis', 'traction-analysis'],
    diagrams: [
      { id:'transfer-compare', name:'Yüksek / düşük kademe hız karşılaştırması', xAxis:'Zaman (s)', yAxis:'Hız (km/h)',
        note:'İki ayrı simülasyon gerektirir.' },
      { id:'efficiency-chain', name:'Güç aktarma verim zinciri – Araç hızı', xAxis:'Hız (km/h)', yAxis:'Verim (%)' },
      { id:'te-envelope', name:'TE zarf eğrisi – Araç hızı', xAxis:'Hız (km/h)', yAxis:'Çekiş kuvveti (kN)' },
      { id:'bsfc-map', name:'Motor BSFC çalışma haritası', xAxis:'Motor devri (rpm)', yAxis:'Motor torku (Nm)',
        note:'Arka plan BSFC kontur haritası motor veritabanından gelir.' }
    ],
    sensors: []
  },

  // ══════════════════════════════════════════════════════════════
  //  HIZLANMA-YAVAŞLAMA (Segment-Drive) — solverTab: 'accel-decel'
  // ══════════════════════════════════════════════════════════════
  {
    id: 'sd-speed-profile', name: 'Hız ve mesafe profili', icon: '<span class="mf-ico mf-ico-route"></span>', priority: 'essential',
    solverTab: 'accel-decel',
    requires: ['vehicle'],
    diagrams: [
      { id:'sd-v-t', name:'Araç hızı – Zaman', xAxis:'Zaman (s)', yAxis:'Hız (km/h)' },
      { id:'sd-s-t', name:'Mesafe – Zaman', xAxis:'Zaman (s)', yAxis:'Mesafe (m)' },
      { id:'sd-a-t', name:'İvme – Zaman', xAxis:'Zaman (s)', yAxis:'İvme (m/s²)' }
    ],
    sensors: [
      { target:'vehicle', attachment:'component', signal:'v_speed', label:'Araç → Araç hızı (km/h)' },
      { target:'vehicle', attachment:'component', signal:'v_distance', label:'Araç → Mesafe (m)' },
      { target:'vehicle', attachment:'component', signal:'v_accel', label:'Araç → İvme (m/s²)' }
    ]
  },
  {
    id: 'sd-forces', name: 'Kuvvet ve direnç analizi', icon: '<span class="mf-ico mf-ico-zap"></span>', priority: 'essential',
    solverTab: 'accel-decel',
    requires: ['vehicle', 'engine'],
    diagrams: [
      { id:'sd-fnet-t', name:'Net kuvvet – Zaman', xAxis:'Zaman (s)', yAxis:'Kuvvet (N)' },
      { id:'sd-forces-t', name:'Kuvvet bileşenleri – Zaman', xAxis:'Zaman (s)', yAxis:'Kuvvet (N)' },
      { id:'sd-grade-t', name:'Eğim kuvveti – Zaman', xAxis:'Zaman (s)', yAxis:'Kuvvet (N)' }
    ],
    sensors: [
      { target:'road', attachment:'component', signal:'r_rolling_force', label:'Yol → Yuvarlanma direnci (N)' },
      { target:'road', attachment:'component', signal:'r_aero_force', label:'Yol → Aerodinamik direnç (N)' },
      { target:'road', attachment:'component', signal:'r_grade_force', label:'Yol → Eğim kuvveti (N)' },
      { target:'road', attachment:'component', signal:'r_net_force', label:'Yol → Net kuvvet (N)' }
    ]
  },
  {
    id: 'sd-powertrain', name: 'Güç aktarma profili', icon: '<span class="mf-ico mf-ico-settings"></span>', priority: 'recommended',
    solverTab: 'accel-decel',
    requires: ['engine', 'gearbox'],
    diagrams: [
      { id:'sd-rpm-t', name:'Motor devri – Zaman', xAxis:'Zaman (s)', yAxis:'Motor devri (rpm)' },
      { id:'sd-power-t', name:'Motor ve tekerlek gücü – Zaman', xAxis:'Zaman (s)', yAxis:'Güç (kW)' },
      { id:'sd-gear-t', name:'Vites profili – Zaman', xAxis:'Zaman (s)', yAxis:'Vites' },
      { id:'sd-te-t', name:'Çekiş kuvveti – Zaman', xAxis:'Zaman (s)', yAxis:'Çekiş kuvveti (kN)' }
    ],
    sensors: [
      { target:'engine', attachment:'output', signal:'rpm', label:'Motor → Devir (rpm)' },
      { target:'engine', attachment:'output', signal:'power', label:'Motor → Güç (kW)' },
      { target:'shift-controller', attachment:'component', signal:'current_gear', label:'Vites kontrol → Aktif vites' },
      { target:'solver', attachment:'component', signal:'tractive_effort', label:'Çözücü → Çekiş kuvveti (kN)' }
    ]
  },
  {
    id: 'sd-thermal', name: 'Isı reddi ve verimlilik', icon: '<span class="mf-ico mf-ico-thermometer"></span>', priority: 'advanced',
    solverTab: 'accel-decel',
    requires: ['torque-converter', 'engine'],
    diagrams: [
      { id:'sd-heat-t', name:'TC ısı reddi – Zaman', xAxis:'Zaman (s)', yAxis:'Isı reddi (kW)' },
      { id:'sd-edrag-t', name:'Motor fren kuvveti – Zaman', xAxis:'Zaman (s)', yAxis:'Kuvvet (N)' }
    ],
    sensors: [
      { target:'torque-converter', attachment:'component', signal:'heat_rejection', label:'TC → Isı reddi (kW)' },
      { target:'engine', attachment:'output', signal:'torque', label:'Motor → Fren torku (Nm)' }
    ]
  },

  // ══════════════════════════════════════════════════════════════
  //  ENGEL ATLAMA — solverTab: 'obstacle'
  // ══════════════════════════════════════════════════════════════
  {
    id: 'obs-torque', name: 'Tork ve kuvvet analizi', icon: '<span class="mf-ico mf-ico-barrier"></span>', priority: 'essential',
    solverTab: 'obstacle',
    requires: ['vehicle', 'engine', 'torque-converter'],
    diagrams: [
      { id:'obs-match-torque', name:'Motor-TC eşleşme tork profili', xAxis:'Hız oranı (SR)', yAxis:'Tork (Nm)' },
      { id:'obs-match-power', name:'Motor-TC eşleşme güç profili', xAxis:'Hız oranı (SR)', yAxis:'Güç (kW)' }
    ],
    sensors: [
      { target:'engine', attachment:'output', signal:'torque', label:'Motor → Tork (Nm)' },
      { target:'torque-converter', attachment:'output', signal:'torque_out', label:'TC → Türbin torku (Nm)' },
      { target:'torque-converter', attachment:'component', signal:'heat_rejection', label:'TC → Isı reddi (kW)' }
    ]
  },
  {
    id: 'obs-thermal', name: 'Termal ve verimlilik analizi', icon: '<span class="mf-ico mf-ico-thermometer"></span>', priority: 'recommended',
    solverTab: 'obstacle',
    requires: ['torque-converter'],
    diagrams: [
      { id:'obs-match-heat', name:'TC ısı reddi – Hız oranı', xAxis:'Hız oranı (SR)', yAxis:'Isı reddi (kW)' },
      { id:'obs-match-eta', name:'TC verimi – Hız oranı', xAxis:'Hız oranı (SR)', yAxis:'Verim (%)' }
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
    id: '3d-perf', name: '3D performans diyagramları', icon: '<span class="mf-ico mf-ico-box"></span>', priority: 'advanced',
    solverTab: 'performance',
    requires: ['vehicle', 'engine'],
    diagrams: [
      { id:'3d-engine-map', name:'Motor çalışma haritası (3B)', xAxis:'RPM', yAxis:'Tork (Nm)', zAxis:'Güç (kW)' },
      { id:'3d-te-gear', name:'Çekiş kuvveti yüzeyi (3B)', xAxis:'Hız (km/h)', yAxis:'Vites', zAxis:'TE (kN)' },
      { id:'3d-tc-eff', name:'TC verim yüzeyi (3B)', xAxis:'Hız oranı (SR)', yAxis:'Pump torku (Nm)', zAxis:'Verim (%)' },
      { id:'3d-power-flow', name:'Güç akışı yüzeyi (3B)', xAxis:'Hız (km/h)', yAxis:'Zaman (s)', zAxis:'Motor Gücü (kW)' },
      { id:'3d-resist-map', name:'Direnç dağılım yüzeyi (3B)', xAxis:'Hız (km/h)', yAxis:'Zaman (s)', zAxis:'Toplam Direnç (N)' },
      { id:'3d-accel-rpm', name:'İvme-hız-RPM haritası (3B)', xAxis:'Hız (km/h)', yAxis:'Motor devri (rpm)', zAxis:'İvme (m/s²)' }
    ],
    sensors: []
  },

  // ══════════════════════════════════════════════════════════════
  //  3B YÜZEY DİYAGRAMLARI — Hızlanma-Yavaşlama
  // ══════════════════════════════════════════════════════════════
  {
    id: '3d-sd', name: '3D segment diyagramları', icon: '<span class="mf-ico mf-ico-box"></span>', priority: 'advanced',
    solverTab: 'accel-decel',
    requires: ['vehicle', 'engine'],
    diagrams: [
      { id:'3d-sd-speed-grade', name:'Hız-mesafe-eğim profili (3B)', xAxis:'Mesafe (m)', yAxis:'Eğim kuvveti (N)', zAxis:'Hız (km/h)' },
      { id:'3d-sd-force-grade', name:'Kuvvet-hız-eğim yüzeyi (3B)', xAxis:'Hız (km/h)', yAxis:'Eğim kuvveti (N)', zAxis:'Net Kuvvet (N)' },
      { id:'3d-sd-heat', name:'TC ısı reddi haritası (3B)', xAxis:'Zaman (s)', yAxis:'Hız (km/h)', zAxis:'TC Isı Reddi (kW)' },
      { id:'3d-sd-power-rpm', name:'Güç-RPM-vites yüzeyi (3B)', xAxis:'Motor devri (rpm)', yAxis:'Vites', zAxis:'Motor Gücü (kW)' },
      { id:'3d-sd-te-resist', name:'Çekiş-direnç yüzeyi (3B)', xAxis:'Zaman (s)', yAxis:'Çekiş kuvveti (kN)', zAxis:'Toplam Direnç (N)' }
    ],
    sensors: []
  },

  // ══════════════════════════════════════════════════════════════
  //  3B YÜZEY DİYAGRAMLARI — Engel Atlama
  // ══════════════════════════════════════════════════════════════
  {
    id: '3d-obs', name: '3D engel atlama diyagramları', icon: '<span class="mf-ico mf-ico-box"></span>', priority: 'advanced',
    solverTab: 'obstacle',
    requires: ['torque-converter'],
    diagrams: [
      { id:'3d-obs-torque', name:'Tork eşleme yüzeyi (3B)', xAxis:'Hız oranı (SR)', yAxis:'Motor torku (Nm)', zAxis:'Tekerlek Torku (Nm)' },
      { id:'3d-obs-force-angle', name:'Kuvvet-açı-zaman (3B)', xAxis:'Zaman (s)', yAxis:'Tekerlek açısı (°)', zAxis:'Net Kuvvet (N)' },
      { id:'3d-obs-energy', name:'Enerji-hız-açı (3B)', xAxis:'Tekerlek açısı (°)', yAxis:'Hız (m/s)', zAxis:'Kinetik Enerji (J)' },
      { id:'3d-obs-power-eff', name:'Güç-SR-verim yüzeyi (3B)', xAxis:'Hız oranı (SR)', yAxis:'Motor gücü (kW)', zAxis:'TC Verimi (−)' },
      { id:'3d-obs-push-react', name:'İtme-engel kuvveti yüzeyi (3B)', xAxis:'Zaman (s)', yAxis:'İtme kuvveti (N)', zAxis:'Engel Reaksiyon (N)' }
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
  'v-t':  { x:{target:'time'}, y:[{target:'vehicle', signal:'v_speed', name:'Araç hızı', unit:'km/h'}] },
  's-t':  { x:{target:'time'}, y:[{target:'vehicle', signal:'v_distance', name:'Mesafe', unit:'m'}] },
  'a-v':  { x:{target:'vehicle', signal:'v_speed', name:'Hız', unit:'km/h'}, y:[{target:'vehicle', signal:'v_accel', name:'İvme', unit:'m/s²'}] },
  'a-t':  { x:{target:'time'}, y:[{target:'vehicle', signal:'v_accel', name:'İvme', unit:'m/s²'}] },
  // Motor Analizi
  'rpm-v':   { x:{target:'vehicle', signal:'v_speed', name:'Hız', unit:'km/h'}, y:[{target:'engine', signal:'rpm', name:'Motor devri', unit:'rpm'}] },
  'rpm-t':   { x:{target:'time'}, y:[{target:'engine', signal:'rpm', name:'Motor devri', unit:'rpm'}] },
  'torque-v':{ x:{target:'vehicle', signal:'v_speed', name:'Hız', unit:'km/h'}, y:[{target:'engine', signal:'torque', name:'Motor torku', unit:'Nm'}] },
  'power-v': { x:{target:'vehicle', signal:'v_speed', name:'Hız', unit:'km/h'}, y:[{target:'engine', signal:'power', name:'Motor gücü', unit:'kW'}] },
  // TC Analizi
  'sr-v':        { x:{target:'vehicle', signal:'v_speed', name:'Hız', unit:'km/h'}, y:[{target:'torque-converter', signal:'speed_ratio', name:'Hız oranı (SR)', unit:'−'}] },
  'tr-v':        { x:{target:'vehicle', signal:'v_speed', name:'Hız', unit:'km/h'}, y:[{target:'torque-converter', signal:'torque_ratio', name:'Tork oranı (TR)', unit:'−'}] },
  'eta-tc-v':    { x:{target:'vehicle', signal:'v_speed', name:'Hız', unit:'km/h'}, y:[{target:'torque-converter', signal:'efficiency', name:'TC verimi η', unit:'%'}] },
  'tc-slip-v':   { x:{target:'vehicle', signal:'v_speed', name:'Hız', unit:'km/h'}, y:[{target:'torque-converter', signal:'slip', name:'Kayma', unit:'%'}] },
  'tc-io-torque':{ x:{target:'vehicle', signal:'v_speed', name:'Hız', unit:'km/h'}, y:[
    {target:'torque-converter', signal:'torque_in', name:'Pump torku', unit:'Nm'},
    {target:'torque-converter', signal:'torque_out', name:'Türbin torku', unit:'Nm'}
  ]},
  // Çekiş Kuvveti
  'te-v':           { x:{target:'vehicle', signal:'v_speed', name:'Hız', unit:'km/h'}, y:[{target:'solver', signal:'tractive_effort', name:'Çekiş kuvveti (TE)', unit:'kN'}] },
  'dp-v':           { x:{target:'vehicle', signal:'v_speed', name:'Hız', unit:'km/h'}, y:[{target:'solver', signal:'drawbar_pull', name:'Net çekiş (DP)', unit:'kN'}] },
  'resistances-v':  { x:{target:'vehicle', signal:'v_speed', name:'Hız', unit:'km/h'}, y:[
    {target:'road', signal:'r_rolling_force', name:'Yuvarlanma direnci', unit:'N'},
    {target:'road', signal:'r_aero_force', name:'Aerodinamik direnç', unit:'N'},
    {target:'road', signal:'r_total_resist', name:'Toplam direnç', unit:'N'}
  ]},
  'power-balance-v':{ x:{target:'vehicle', signal:'v_speed', name:'Hız', unit:'km/h'}, y:[
    {target:'engine', signal:'power', name:'Motor gücü', unit:'kW'},
    {target:'solver', signal:'wheel_power', name:'Tekerlekte güç', unit:'kW'}
  ]},
  // Vites Geçiş
  'gear-t':      { x:{target:'time'}, y:[{target:'shift-controller', signal:'current_gear', name:'Aktif vites', unit:'−'}] },
  'gear-v':      { x:{target:'vehicle', signal:'v_speed', name:'Hız', unit:'km/h'}, y:[{target:'shift-controller', signal:'current_gear', name:'Aktif vites', unit:'−'}] },
  'trans-out-v': { x:{target:'vehicle', signal:'v_speed', name:'Hız', unit:'km/h'}, y:[{target:'gearbox', signal:'torque_out', name:'Şanzıman çıkış torku', unit:'Nm'}] },
  'shift-rpm-t': { x:{target:'time'}, y:[
    {target:'engine', signal:'rpm', name:'Motor devri', unit:'rpm'},
    {target:'shift-controller', signal:'current_gear', name:'Aktif vites', unit:'−'}
  ]},
  // Şanzıman Detay
  'gb-io-torque': { x:{target:'vehicle', signal:'v_speed', name:'Hız', unit:'km/h'}, y:[
    {target:'gearbox', signal:'torque_in', name:'Giriş torku', unit:'Nm'},
    {target:'gearbox', signal:'torque_out', name:'Çıkış torku', unit:'Nm'}
  ]},
  'gb-io-rpm':    { x:{target:'vehicle', signal:'v_speed', name:'Hız', unit:'km/h'}, y:[
    {target:'gearbox', signal:'rpm_in', name:'Giriş devri', unit:'rpm'},
    {target:'gearbox', signal:'rpm_out', name:'Çıkış devri', unit:'rpm'}
  ]},
  'gb-power-loss':{ x:{target:'vehicle', signal:'v_speed', name:'Hız', unit:'km/h'}, y:[{target:'gearbox', signal:'power_loss', name:'Güç kaybı', unit:'kW'}] },
  'gb-efficiency':{ x:{target:'vehicle', signal:'v_speed', name:'Hız', unit:'km/h'}, y:[{target:'gearbox', signal:'efficiency', name:'Verim', unit:'%'}] },
  'gb-ratio-t':   { x:{target:'time'}, y:[{target:'gearbox', signal:'ratio', name:'Vites oranı', unit:'−'}] },
  // Transfer Kutusu
  'tf-io-torque': { x:{target:'vehicle', signal:'v_speed', name:'Hız', unit:'km/h'}, y:[
    {target:'transfer', signal:'torque_in', name:'Giriş torku', unit:'Nm'},
    {target:'transfer', signal:'torque_out', name:'Çıkış torku', unit:'Nm'}
  ]},
  'tf-power-loss':{ x:{target:'vehicle', signal:'v_speed', name:'Hız', unit:'km/h'}, y:[{target:'transfer', signal:'power_loss', name:'Güç kaybı', unit:'kW'}] },
  // Propşaft
  'ps-io-torque': { x:{target:'vehicle', signal:'v_speed', name:'Hız', unit:'km/h'}, y:[
    {target:'propshaft', signal:'torque_in', name:'Giriş torku', unit:'Nm'},
    {target:'propshaft', signal:'torque_out', name:'Çıkış torku', unit:'Nm'}
  ]},
  'ps-power-loss':{ x:{target:'vehicle', signal:'v_speed', name:'Hız', unit:'km/h'}, y:[{target:'propshaft', signal:'power_loss', name:'Güç kaybı', unit:'kW'}] },
  // Diferansiyel
  'diff-io-torque':{ x:{target:'vehicle', signal:'v_speed', name:'Hız', unit:'km/h'}, y:[
    {target:'differential', signal:'torque_in', name:'Giriş torku', unit:'Nm'},
    {target:'differential', signal:'torque_out', name:'Yarım aks torku', unit:'Nm'}
  ]},
  'diff-power-loss':{ x:{target:'vehicle', signal:'v_speed', name:'Hız', unit:'km/h'}, y:[{target:'differential', signal:'power_loss', name:'Güç kaybı', unit:'kW'}] },
  // Tekerlek
  'wh-force-v':   { x:{target:'vehicle', signal:'v_speed', name:'Hız', unit:'km/h'}, y:[{target:'wheel', signal:'force', name:'Çekiş kuvveti', unit:'N'}] },
  'wh-torque-v':  { x:{target:'vehicle', signal:'v_speed', name:'Hız', unit:'km/h'}, y:[{target:'wheel', signal:'torque_in', name:'Tekerlek torku', unit:'Nm'}] },
  'wh-te-dp-v':   { x:{target:'vehicle', signal:'v_speed', name:'Hız', unit:'km/h'}, y:[
    {target:'wheel', signal:'tractive_effort', name:'Çekiş kuvveti (TE)', unit:'kN'},
    {target:'wheel', signal:'drawbar_pull', name:'Drawbar Pull (DP)', unit:'kN'}
  ]},
  'wh-grade-v':   { x:{target:'vehicle', signal:'v_speed', name:'Hız', unit:'km/h'}, y:[{target:'wheel', signal:'net_grade', name:'Eğim kapasitesi', unit:'%'}] },
  // Araç Ek
  've-ke-v':      { x:{target:'vehicle', signal:'v_speed', name:'Hız', unit:'km/h'}, y:[{target:'vehicle', signal:'v_kinetic_energy', name:'Kinetik enerji', unit:'kJ'}] },
  've-decel-v':   { x:{target:'vehicle', signal:'v_speed', name:'Hız', unit:'km/h'}, y:[{target:'vehicle', signal:'v_decel_g', name:'Yavaşlama', unit:'g'}] },
  // Yol Ek
  'rd-grade-t':   { x:{target:'time'}, y:[{target:'road', signal:'r_current_grade', name:'Anlık eğim', unit:'%'}] },
  // TC Ek
  'tc-kfactor-v':    { x:{target:'vehicle', signal:'v_speed', name:'Hız', unit:'km/h'}, y:[{target:'torque-converter', signal:'kfactor', name:'K-Factor', unit:'rpm/√Nm'}] },
  'tc-power-loss-v': { x:{target:'vehicle', signal:'v_speed', name:'Hız', unit:'km/h'}, y:[{target:'torque-converter', signal:'power_loss', name:'Güç kaybı', unit:'kW'}] },
  // Motor Ek
  'eng-angvel-t':    { x:{target:'time'}, y:[{target:'engine', signal:'angular_vel', name:'Açısal hız', unit:'rad/s'}] },
  // Vites Kontrol Ek
  'sc-lockup-t':     { x:{target:'time'}, y:[{target:'shift-controller', signal:'lockup_state', name:'Lockup durumu', unit:'0/1'}] },
  'sc-nout-t':       { x:{target:'time'}, y:[{target:'shift-controller', signal:'n_output', name:'Çıkış devri', unit:'rpm'}] },
  // Çözücü Ek
  'sol-grade-v':     { x:{target:'vehicle', signal:'v_speed', name:'Hız', unit:'km/h'}, y:[{target:'solver', signal:'net_grade', name:'Eğim kapasitesi', unit:'%'}] },
  'sol-heat-v':      { x:{target:'vehicle', signal:'v_speed', name:'Hız', unit:'km/h'}, y:[{target:'solver', signal:'heat_rejection', name:'Toplam ısı reddi', unit:'kW'}] },
  // Karşılaştırma
  'transfer-compare':  { x:{target:'time'}, y:[{target:'vehicle', signal:'v_speed', name:'Araç hızı', unit:'km/h'}] },
  'efficiency-chain':  { x:{target:'vehicle', signal:'v_speed', name:'Hız', unit:'km/h'}, y:[{target:'torque-converter', signal:'efficiency', name:'TC verimi', unit:'%'}] },
  'te-envelope':       { x:{target:'vehicle', signal:'v_speed', name:'Hız', unit:'km/h'}, y:[{target:'solver', signal:'tractive_effort', name:'TE zarf', unit:'kN'}] },
  'bsfc-map':          { x:{target:'engine', signal:'rpm', name:'Motor devri', unit:'rpm'}, y:[{target:'engine', signal:'torque', name:'Motor torku', unit:'Nm'}] },

  // ── Hızlanma-Yavaşlama (Segment-Drive) ──
  'sd-v-t':      { x:{target:'time'}, y:[{target:'vehicle', signal:'v_speed', name:'Araç hızı', unit:'km/h'}], dataSource:'segmentDrive' },
  'sd-s-t':      { x:{target:'time'}, y:[{target:'vehicle', signal:'v_distance', name:'Mesafe', unit:'m'}], dataSource:'segmentDrive' },
  'sd-a-t':      { x:{target:'time'}, y:[{target:'vehicle', signal:'v_accel', name:'İvme', unit:'m/s²'}], dataSource:'segmentDrive' },
  'sd-fnet-t':   { x:{target:'time'}, y:[{target:'road', signal:'r_net_force', name:'Net kuvvet', unit:'N'}], dataSource:'segmentDrive' },
  'sd-forces-t': { x:{target:'time'}, y:[
    {target:'road', signal:'r_grade_force', name:'Eğim kuvveti', unit:'N'},
    {target:'road', signal:'r_rolling_force', name:'Yuvarlanma direnci', unit:'N'},
    {target:'road', signal:'r_aero_force', name:'Aerodinamik direnç', unit:'N'}
  ], dataSource:'segmentDrive' },
  'sd-grade-t':  { x:{target:'time'}, y:[{target:'road', signal:'r_grade_force', name:'Eğim kuvveti', unit:'N'}], dataSource:'segmentDrive' },
  'sd-rpm-t':    { x:{target:'time'}, y:[{target:'engine', signal:'rpm', name:'Motor devri', unit:'rpm'}], dataSource:'segmentDrive' },
  'sd-power-t':  { x:{target:'time'}, y:[
    {target:'engine', signal:'power', name:'Motor gücü', unit:'kW'},
    {target:'solver', signal:'wheel_power', name:'Tekerlek gücü', unit:'kW'}
  ], dataSource:'segmentDrive' },
  'sd-gear-t':   { x:{target:'time'}, y:[{target:'shift-controller', signal:'current_gear', name:'Aktif vites', unit:'−'}], dataSource:'segmentDrive' },
  'sd-te-t':     { x:{target:'time'}, y:[{target:'solver', signal:'tractive_effort', name:'Çekiş kuvveti', unit:'kN'}], dataSource:'segmentDrive' },
  'sd-heat-t':   { x:{target:'time'}, y:[{target:'torque-converter', signal:'heat_rejection', name:'Isı reddi', unit:'kW'}], dataSource:'segmentDrive' },
  'sd-edrag-t':  { x:{target:'time'}, y:[{target:'solver', signal:'engine_drag_force', name:'Motor fren kuvveti', unit:'N'}], dataSource:'segmentDrive' },

  // ── Engel Atlama (Obstacle) — matchTable tabanlı ──
  'obs-match-torque': { x:{target:'obs-match', signal:'SR', name:'Hız oranı (SR)', unit:'−'}, y:[
    {target:'obs-match', signal:'T_engine', name:'Motor torku', unit:'Nm'},
    {target:'obs-match', signal:'T_pump', name:'Pump torku', unit:'Nm'},
    {target:'obs-match', signal:'T_turbine', name:'Türbin torku', unit:'Nm'},
    {target:'obs-match', signal:'T_wheel', name:'Tekerlek torku', unit:'Nm'}
  ], dataSource:'obstacleDynamic' },
  'obs-match-power':  { x:{target:'obs-match', signal:'SR', name:'Hız oranı (SR)', unit:'−'}, y:[
    {target:'obs-match', signal:'P_engine_kW', name:'Motor gücü', unit:'kW'},
    {target:'obs-match', signal:'P_turbine_kW', name:'Türbin gücü', unit:'kW'}
  ], dataSource:'obstacleDynamic' },
  'obs-match-heat':   { x:{target:'obs-match', signal:'SR', name:'Hız oranı (SR)', unit:'−'}, y:[
    {target:'obs-match', signal:'Q_reject_kW', name:'Isı reddi', unit:'kW'}
  ], dataSource:'obstacleDynamic' },
  'obs-match-eta':    { x:{target:'obs-match', signal:'SR', name:'Hız oranı (SR)', unit:'−'}, y:[
    {target:'obs-match', signal:'eta_tc', name:'TC verimi', unit:'−'}
  ], dataSource:'obstacleDynamic' },

  // ══════════════════════════════════════════════════════════════════════
  // 3B YÜZEY DİYAGRAMLARI (surface)  —  x, y[0], z formatı
  // ══════════════════════════════════════════════════════════════════════

  // ── Performans Analizi 3B ──
  '3d-engine-map':    { x:{target:'engine', signal:'rpm', name:'Motor devri', unit:'rpm'},
    y:[{target:'engine', signal:'torque', name:'Motor torku', unit:'Nm'}],
    z:{target:'engine', signal:'power', name:'Motor gücü [kW]', unit:'kW'} },
  '3d-te-gear':       { x:{target:'vehicle', signal:'v_speed', name:'Hız', unit:'km/h'},
    y:[{target:'shift-controller', signal:'current_gear', name:'Aktif vites', unit:'−'}],
    z:{target:'solver', signal:'tractive_effort', name:'Çekiş kuvveti [kN]', unit:'kN'} },
  '3d-tc-eff':        { x:{target:'torque-converter', signal:'speed_ratio', name:'Hız oranı (SR)', unit:'−'},
    y:[{target:'torque-converter', signal:'torque_in', name:'Pump torku', unit:'Nm'}],
    z:{target:'torque-converter', signal:'efficiency', name:'TC verimi [%]', unit:'%'} },
  '3d-power-flow':    { x:{target:'vehicle', signal:'v_speed', name:'Hız', unit:'km/h'},
    y:[{target:'time', signal:'time', name:'Zaman', unit:'s'}],
    z:{target:'engine', signal:'power', name:'Motor gücü [kW]', unit:'kW'} },
  '3d-resist-map':    { x:{target:'vehicle', signal:'v_speed', name:'Hız', unit:'km/h'},
    y:[{target:'time', signal:'time', name:'Zaman', unit:'s'}],
    z:{target:'road', signal:'r_total_resist', name:'Toplam direnç [N]', unit:'N'} },
  '3d-accel-rpm':     { x:{target:'vehicle', signal:'v_speed', name:'Hız', unit:'km/h'},
    y:[{target:'engine', signal:'rpm', name:'Motor devri', unit:'rpm'}],
    z:{target:'vehicle', signal:'v_accel', name:'İvme [m/s²]', unit:'m/s²'} },

  // ── Hızlanma-Yavaşlama 3B ──
  '3d-sd-speed-grade': { x:{target:'vehicle', signal:'v_distance', name:'Mesafe', unit:'m'},
    y:[{target:'road', signal:'r_grade_force', name:'Eğim kuvveti', unit:'N'}],
    z:{target:'vehicle', signal:'v_speed', name:'Hız [km/h]', unit:'km/h'}, dataSource:'segmentDrive' },
  '3d-sd-force-grade': { x:{target:'vehicle', signal:'v_speed', name:'Hız', unit:'km/h'},
    y:[{target:'road', signal:'r_grade_force', name:'Eğim kuvveti', unit:'N'}],
    z:{target:'road', signal:'r_net_force', name:'Net kuvvet [N]', unit:'N'}, dataSource:'segmentDrive' },
  '3d-sd-heat':        { x:{target:'time'},
    y:[{target:'vehicle', signal:'v_speed', name:'Hız', unit:'km/h'}],
    z:{target:'torque-converter', signal:'heat_rejection', name:'TC ısı reddi [kW]', unit:'kW'}, dataSource:'segmentDrive' },
  '3d-sd-power-rpm':   { x:{target:'engine', signal:'rpm', name:'Motor devri', unit:'rpm'},
    y:[{target:'shift-controller', signal:'current_gear', name:'Aktif vites', unit:'−'}],
    z:{target:'engine', signal:'power', name:'Motor gücü [kW]', unit:'kW'}, dataSource:'segmentDrive' },
  '3d-sd-te-resist':   { x:{target:'time'},
    y:[{target:'solver', signal:'tractive_effort', name:'Çekiş kuvveti', unit:'kN'}],
    z:{target:'road', signal:'r_total_resist', name:'Toplam direnç [N]', unit:'N'}, dataSource:'segmentDrive' },

  // ── Engel Atlama 3B ──
  '3d-obs-torque':     { x:{target:'obs-match', signal:'SR', name:'Hız oranı (SR)', unit:'−'},
    y:[{target:'obs-match', signal:'T_engine', name:'Motor torku', unit:'Nm'}],
    z:{target:'obs-match', signal:'T_wheel', name:'Tekerlek torku [Nm]', unit:'Nm'}, dataSource:'obstacleDynamic' },
  '3d-obs-force-angle':{ x:{target:'obs-log', signal:'t', name:'Zaman', unit:'s'},
    y:[{target:'obs-log', signal:'phi_deg', name:'Tekerlek açısı', unit:'°'}],
    z:{target:'obs-log', signal:'F_net', name:'Net kuvvet [N]', unit:'N'}, dataSource:'obstacleDynamic' },
  '3d-obs-energy':     { x:{target:'obs-log', signal:'phi_deg', name:'Tekerlek açısı', unit:'°'},
    y:[{target:'obs-log', signal:'v', name:'Hız', unit:'m/s'}],
    z:{target:'obs-log', signal:'KE', name:'Kinetik enerji [J]', unit:'J'}, dataSource:'obstacleDynamic' },
  '3d-obs-power-eff':  { x:{target:'obs-match', signal:'SR', name:'Hız oranı (SR)', unit:'−'},
    y:[{target:'obs-match', signal:'P_engine_kW', name:'Motor gücü', unit:'kW'}],
    z:{target:'obs-match', signal:'eta_tc', name:'TC verimi [−]', unit:'−'}, dataSource:'obstacleDynamic' },
  '3d-obs-push-react': { x:{target:'obs-log', signal:'t', name:'Zaman', unit:'s'},
    y:[{target:'obs-log', signal:'F_itme', name:'İtme kuvveti', unit:'N'}],
    z:{target:'obs-log', signal:'F_engel', name:'Engel reaksiyon [N]', unit:'N'}, dataSource:'obstacleDynamic' }
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

// Diyagramın künyesi — eksenler ve (varsa) not; satırın ipucunda (title).
function swDiagramKunye(d) {
  var k = 'X: ' + d.xAxis + ' · Y: ' + (Array.isArray(d.yAxis) ? d.yAxis.join(' / ') : d.yAxis);
  if(d.zAxis) k += ' · Z: ' + d.zAxis;
  return d.note ? k + ' · ' + d.note : k;
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
  var html = '<div class="sw-panel ve-cp-panel">';

  // İKİ SÜTUN: SOL = durum + topoloji + kur/kaldır, SAĞ = diyagram paketleri + footer
  html += '<div class="ve-cp-grid"><div class="ve-cp-col ve-cp-col--in">';
  // ── Durum Çubuğu ──
  if(isInstalled) {
    var sCount = (node.data.activeSensors || []).length;
    html += '<div class="sw-status-bar installed">';
    html += '<span class="sw-status-dot"></span>';
    html += '<span>Sensörler kurulu</span>';
    html += '<span style="margin-left:auto;font-weight:400;font-size:var(--fs-micro);">' + installedPkgs.length + ' paket, ' + sCount + ' sensör</span>';
    html += '</div>';
  } else {
    html += '<div class="sw-status-bar not-installed">';
    html += '<span class="sw-status-dot"></span>';
    html += '<span>Sensörler kurulmadı</span>';
    html += '</div>';
  }

  // ── Topoloji Durumu ──
  html += '<div class="sw-section">';
  html += '<div class="sw-section-title">Topoloji durumu</div>';
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
    html += '<span style="' + (ti.v ? '' : 'color:var(--text-muted);') + '">' + ti.k + '</span>';
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
    html += '<button class="sw-btn sw-btn-primary" onclick="var w=nodes.find(function(n){return n.type===\'sensor-wizard\';});if(w)swInstallSensors(w);">Sensörleri kur</button>';
  } else {
    html += '<button class="sw-btn sw-btn-danger" onclick="var w=nodes.find(function(n){return n.type===\'sensor-wizard\';});if(w)swRemoveSensors(w);">Kaldır</button>';
    html += '<button class="sw-btn sw-btn-outline" onclick="var w=nodes.find(function(n){return n.type===\'sensor-wizard\';});if(w)swInstallSensors(w);">Yeniden kur</button>';
  }
  html += '</div>';

  // ── Çözüm Kümesi Tabları ──
  var activeTabs = swGetActiveSolverTabs();
  var solverTabs = [
    { id:'performance', name:'Performans', icon:'<span class="mf-ico mf-ico-gauge"></span>' },
    { id:'accel-decel', name:'Hızl.-Yavaşl.', icon:'<span class="mf-ico mf-ico-route"></span>' },
    { id:'obstacle', name:'Engel Atlama', icon:'<span class="mf-ico mf-ico-barrier"></span>' }
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

  html += '</div>';                                   // ve-cp-col--in kapat
  html += '<div class="ve-cp-col ve-cp-col--out">';   // SAĞ: diyagram paketleri + footer
  html += '<div class="sw-section">';
  html += '<div class="sw-section-title">Diyagram paketleri</div>';
  html += '<div class="sw-tab-bar">';
  solverTabs.forEach(function(st) {
    var isActive = swActiveTab === st.id;
    var disabled = !st.enabled;
    html += '<button class="sw-tab' + (isActive ? ' active' : '') + (disabled ? ' disabled' : '') + '"';
    if(disabled) {
      // aria-disabled, disabled DEĞİL: devre dışı düğme ipucunu göstermiyor ve
      // ipucu kümenin NEREDE kapalı olduğunu söyleyen TEK yer (yer verisi, tarif değil).
      html += ' aria-disabled="true" title="Çözücü\'de kapalı"';
    } else {
      html += ' onclick="swSwitchTab(\'' + st.id + '\')"';
    }
    html += '>';
    html += st.icon + ' ' + st.name;
    if(disabled) {
      html += '<span class="sw-tab-count">kapalı</span>';
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
    html += veIkon(expanded ? 'chevron-down' : 'chevron-right', 'sw-pkg-arrow');
    html += '<span class="sw-pkg-name">' + pkg.name + '</span>';
    html += '<span class="sw-pkg-badge ' + badgeClass + '">' + badgeText + '</span>';
    html += '</div>';

    // Genişletilmiş içerik
    if(expanded) {
      html += '<div class="sw-pkg-body">';

      // Sensörler
      if(pkg.sensors.length > 0) {
        html += '<div class="sw-pkg-sub">Sensörler</div>';
        pkg.sensors.forEach(function(sReq, sIdx) {
          var matched = sensorStatuses[sIdx];
          html += '<div class="sw-sensor-row">';
          html += '<span class="sw-dot ' + (matched ? 'green' : (reqsMet ? 'gray' : 'red')) + '"></span>';
          html += '<span style="' + (matched ? '' : 'color:var(--text-muted);') + '">' + sReq.label + '</span>';
          html += '</div>';
        });
      } else if(pkg.dependsOn) {
        html += '<div class="sw-pkg-desc" style="font-style:italic;">Ek sensör gerekmez</div>';
      }

      // Diyagramlar
      html += '<div class="sw-pkg-sub">Diyagramlar</div>';
      pkg.diagrams.forEach(function(d) {
        var ready = pkgInstalled || ((pkgTotal === 0 && pkg.dependsOn) ? false : (pkgMatched === pkgTotal && pkgTotal > 0));
        html += '<div class="sw-diag-row">';
        html += '<span class="sw-dot ' + (ready ? 'green' : 'gray') + '"></span>';
        html += '<span style="flex:1;' + (ready ? '' : 'color:var(--text-muted);') + '" title="' + escapeHTML(swDiagramKunye(d)) + '">' + d.name + '</span>';
        html += '</div>';
      });

      html += '</div>';
    }

    html += '</div>';
  });

  html += '</div>'; // sw-section

  // Yenile
  html += '<div style="text-align:center;margin-top:6px;">';
  html += '<button class="sw-btn sw-btn-outline" style="font-size:var(--fs-micro);padding:3px 10px;" onclick="var w=nodes.find(function(n){return n.type===\'sensor-wizard\';});if(w)showNodeProperties(w);">Durumu yenile</button>';
  html += '</div>';
  html += '</div>';                                   // ve-cp-col--out kapat
  html += '</div>';                                   // ve-cp-grid kapat

  html += '</div>';
  return html;
}

