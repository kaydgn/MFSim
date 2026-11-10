// ═══════════════════════════════════════════════════════════════════════════
// TAKOZ ÇÖKME-TİTREŞİM KULLANIM KILAVUZU — rapor kozmetiğinde, yönlendirici
// ═══════════════════════════════════════════════════════════════════════════
//
// Kullanıcı isteği (2026-11-09): *"kullanıcı kılavuzunu baştan sona okuyan
// birisi, programı açtığı andan itibaren ne yaptığını bilmeli … bol bol
// görseller ile, yönlendirmeler ile, işaretler ile kullanıcı hep
// bilgilendirilmeli."* Belge bu yüzden bir İLK TURLA başlar (açılış →
// başlangıç sayfası → örnek → pencere → Hesapla → Sonuçlar → rapor → kayıt) ve
// her konu bir şekille anlatılır: şeklin üstünde numaralı işaret, altında
// lejant, metinde aynı numara (js/guide-kit.js → İŞARETLER).
//
// ŞEKİLLER İKİ KAYNAKTAN, İKİSİ DE PROGRAMDAN:
//   • Pencereler ve başlangıç sayfası programın KENDİ üreticisinden, örnek
//     modelde (BMC Siper) çizilir (`_gmPencere` → veGuideScene). Eskimez.
//   • HTML olarak çizilemeyen yüzeyler (karşılama, tuval, sihirbazın masası,
//     Sonuçlar, 3B, rapor) programın ekran görüntüsüdür — işaretlerin kutuları
//     görüntü alınırken DOM'dan ölçülür (tools/kilavuz-resim.js →
//     assets/kilavuz/, derlemede __MFSIM_KILAVUZ). Eskidiğini e2e kapısı söyler.
//
// FEAD ve Araç Performans kılavuzlarıyla aynı iki kural:
//   1 · ÇÖZÜLMÜŞ MODEL GEREKTİRMEZ — tuval bomboşken okunabilir.
//   2 · ÖRNEĞİN SAYILARI ELLE YAZILMAZ — Sayısal örnek bölümü gerçek çekirdeği koşturur.
//
// KULLANICININ TUVALİ DEĞİŞMEZ: pencere sahneleri `nodes`/`connections`
// global'lerini örneğin KOPYASIYLA takas eder ve `finally` ile geri verir
// (FEAD kılavuzunun `_gfSahneHTML` kuralı); çekirdek açık model alır.
//
// BÖLÜM VE ŞEKİL NUMARASI YAZILMAZ: gönderme kimlikle (`_gmB('rapor')`,
// `_gmS('tuval')`), alt bölüm başlığı sırayla numaralanır (`_gmH3`); belge
// bitince numaralar yerine konur. Bölüm sırası değişince göndermeler kaymaz.
//
// Ad öneki `_gm…` / `veGuideMount…` (source-hygiene: `_gf` FEAD kılavuzunun,
// `_ga` Araç Performans kılavuzunun, `_gk` kabuğun, `_mnt` sunumun,
// `_r` Takoz raporunun).

function _gmF(v, d){ return (typeof _frF === 'function') ? _frF(v, d) : String(v); }
function _gmFs(v, d){ return (typeof _frFs === 'function') ? _frFs(v, d) : String(v); }
function _gmE(s){ return (typeof _gkEsc === 'function') ? _gkEsc(s) : String(s); }

var _gmTblNo = 0;
function _gmTbl(){ return ++_gmTblNo; }

function _gmAdimlar(satirlar){
  return '<ol>' + satirlar.map(function(s){ return '<li>' + s + '</li>'; }).join('') + '</ol>';
}

// HER SÜTUN `td.l` — raporun `td` varsayılanı bir SAYIDIR (mono, sağa dayalı,
// nowrap) ve cümle taşıyan hücrede yatay taşma üretir.
function _gmAlanTablo(baslik, satirlar, basliklar){
  var b = basliklar || ['Alan', 'Ne yazılır', 'Nereden bulunur'];
  var h = '<table><caption>Tablo ' + _gmTbl() + ' — ' + _gmE(baslik) + '</caption>';
  h += '<tr>' + b.map(function(t){ return '<th>' + _gmE(t) + '</th>'; }).join('') + '</tr>';
  satirlar.forEach(function(r){
    h += '<tr>' + r.map(function(c){ return '<td class="l">' + c + '</td>'; }).join('') + '</tr>';
  });
  return h + '</table>';
}

function _gmTablo(baslik, basliklar, satirlar, hizalar){
  var h = '<table><caption>Tablo ' + _gmTbl() + ' — ' + _gmE(baslik) + '</caption>';
  h += '<tr>' + basliklar.map(function(t){ return '<th>' + _gmE(t) + '</th>'; }).join('') + '</tr>';
  satirlar.forEach(function(r){
    h += '<tr>' + r.map(function(c, i){
      var cls = (hizalar && hizalar[i]) ? ' class="' + hizalar[i] + '"' : '';
      return '<td' + cls + '>' + c + '</td>';
    }).join('') + '</tr>';
  });
  return h + '</table>';
}

function _gmNot(baslik, govde){ return veGuideNote('', baslik, govde); }
function _gmUyari(baslik, govde){ return veGuideNote('warn', baslik, govde); }
function _gmOnay(baslik, govde){ return veGuideNote('check', baslik, govde); }

// ═══════════════════════════════════════════════════════════════════════════
//  BÖLÜMLER · GÖNDERMELER · ŞEKİLLER — numara kimlikten
// ═══════════════════════════════════════════════════════════════════════════

var VE_GUIDE_MOUNT_SECTIONS = [
  ['m1',  '1',    'Bu kılavuz nasıl okunur'],
  ['m2',  '2',    'Programı açmak ve Takoz’a girmek'],
  ['m3',  '3',    'İlk tur: örnekten rapora'],
  ['m4',  '4',    'Ekranın düzeni ve tuvalde çalışmak'],
  ['m5',  '5',    'Modelin parçaları'],
  ['m6',  '6',    'Kütle gövdelerini tanımlamak'],
  ['m7',  '7',    'Tahrik ve tork'],
  ['m8',  '8',    'Takozları yerleştirmek'],
  ['m9',  '9',    'Takoz kütüphanesi ve nonlineer eğri'],
  ['m10', '10',   'Yük durumları'],
  ['m11', '11',   'Çözücü'],
  ['m12', '12',   'Sehim sonuçlarını okumak'],
  ['m13', '13',   'Modal analiz ve izolasyon'],
  ['m14', '14',   'Rapor üretmek'],
  ['m15', '15',   'Sihirbazla kurmak'],
  ['m16', '16',   'CAD dosyasından model: 3D Görüntüleyici'],
  ['m17', '17',   'Parametrik analiz: katalogdan seçim'],
  ['m18', '18',   'Sık yapılan hatalar'],
  ['m19', '19',   'Sayısal örnek: BMC Siper'],
  ['mEk', 'Ek A', 'Alan → pencere hızlı başvurusu']
];

// Kimlik → numara. Bölümler listeden, alt bölümler `_gmH3` ile yazılırken.
var _gmNumara = {};
var _gmSekilNo = {};
var _gmBolumNo = '', _gmAltNo = 0;
var _gmKayipListe = [];

// Bölüm kimlikleri (gönderme için okunur adlar)
var _GM_BOLUM = {
  okuma: 'm1', acilis: 'm2', tur: 'm3', ekran: 'm4', parcalar: 'm5', govde: 'm6',
  tork: 'm7', takoz: 'm8', kutuphane: 'm9', yuk: 'm10', cozucu: 'm11', sehim: 'm12',
  modal: 'm13', rapor: 'm14', sihirbaz: 'm15', cad: 'm16', parametrik: 'm17',
  hata: 'm18', ornek: 'm19', ek: 'mEk'
};

function _gmH2(id){
  var s = null;
  VE_GUIDE_MOUNT_SECTIONS.forEach(function(x){ if(x[0] === id) s = x; });
  _gmBolumNo = s ? s[1] : '';
  _gmAltNo = 0;
  return s ? veGuideH2(s[0], s[1], s[2]) : '';
}

// Alt bölüm: numara sıradan; `id` verilirse göndermesi `_gmB(id)`.
function _gmH3(baslik, id){
  _gmAltNo++;
  var no = _gmBolumNo + '.' + _gmAltNo;
  if(id) _gmNumara[id] = no;
  return '<h3>' + no + ' ' + _gmE(baslik) + '</h3>';
}

// GÖNDERME: belge bitince çözülür (ileri gönderme de olur).
function _gmB(id){ return '\u0001B' + id + '\u0001'; }
function _gmS(id){ return '\u0001S' + id + '\u0001'; }

function _gmCoz(html){
  return html.replace(/\u0001([BS])([^\u0001]+)\u0001/g, function(m, tur, id){
    if(tur === 'S'){
      if(_gmSekilNo[id]) return 'Şekil ' + _gmSekilNo[id];
      _gmKayipListe.push('Şekil ' + id);
      return 'Şekil ?';
    }
    var no = _GM_BOLUM[id] ? null : _gmNumara[id];
    if(_GM_BOLUM[id]){
      VE_GUIDE_MOUNT_SECTIONS.forEach(function(x){ if(x[0] === _GM_BOLUM[id]) no = x[1]; });
    }
    if(no) return 'Bölüm ' + no;
    _gmKayipListe.push('Bölüm ' + id);
    return 'Bölüm ?';
  });
}

// Belgenin üretimi sırasında çözülemeyen gönderme, numara ve şekil (testte boş).
function veGuideMountKayip(){ return _gmKayipListe.slice(); }

// Şekildeki işaretin numarası metinde: `_gmN(TUVAL, 'motor')` → ①.
// Başka bir şeklin numarası: "(Şekil 3, ③)".
function _gmNS(sekil, liste, k){ return '(' + _gmS(sekil) + ', ' + _gmN(liste, k) + ')'; }

function _gmN(liste, k){
  for(var i = 0; i < liste.length; i++) if(liste[i].k === k) return veGuideNo(i + 1);
  _gmKayipListe.push('işaret ' + k);
  return veGuideNo('?');
}

// Şekil: programın üreticisinden (sahne) ya da ekran görüntüsünden (ekran).
function _gmSahne(id, html, altyazi, en, isaretler){
  var h = (typeof veGuideScene === 'function') ? veGuideScene(html, altyazi, en, isaretler) : '';
  if(h) _gmSekilNo[id] = veGuideSceneCount();
  else _gmKayipListe.push('sahne ' + id);
  return h;
}

function _gmResim(ad){
  var R = (typeof window !== 'undefined' && window.__MFSIM_KILAVUZ) ? window.__MFSIM_KILAVUZ : null;
  return R && R[ad] ? R[ad] : null;
}

function _gmEkran(id, ad, isaretler, altyazi, en){
  var r = _gmResim(ad);
  var h = (r && typeof veGuideEkran === 'function') ? veGuideEkran(r, isaretler, altyazi, en) : '';
  if(h) _gmSekilNo[id] = veGuideSceneCount();
  else _gmKayipListe.push('ekran ' + ad);
  return h;
}

// ═══════════════════════════════════════════════════════════════════════════
//  SAHNELER — programın penceresi, örnek modelde
// ═══════════════════════════════════════════════════════════════════════════

// Kılavuzun sahne önekleri (seçicinin içinde aranır — guide-kit.js
// `veGuideSceneCSS(_, ek)`): pencerelerin kuralları `.ve-properties-content`
// altında yazılı, aksonometrik çizim `.ve-ak-*`, başlangıç sayfası `.ve-bas*`.
var VE_GUIDE_MOUNT_SAHNE_ON = ['.ve-bas', '.ve-mnt', '.ve-ak', '.ve-izgara', '.ve-mw', '.ve-fw',
  '.ve-tablo', '.ve-prop', '.ve-help', '.sw-btn', '.ve-prm'];

// Sahnenin kabı programda kaydırılan bir sütun; belgede akışta durur.
var _GM_SAHNE_CSS =
    '.appfig .gk-sahne .ve-properties-content{flex:none !important; overflow:visible !important;'
  + ' height:auto !important; max-height:none !important; padding:0 !important;}\n'
  + '.appfig .gk-sahne .ve-bas-ic{height:auto !important; min-height:0 !important;'
  + ' grid-template-columns:minmax(0,1fr) !important;}\n'
  + '.appfig .gk-sahne .ve-bas-panel{position:static !important; height:auto !important;'
  + ' max-height:none !important; overflow:visible !important;}\n'
  + '.appfig .gk-sahne .ve-help-group{break-inside:avoid;}\n';

var _GM_KURUCU = {
  'mnt-motor': 'getMntMassPropertiesHTML', 'mnt-gearbox': 'getMntMassPropertiesHTML',
  'mnt-mount': 'getMntMountPropertiesHTML', 'mnt-library': 'getMntLibraryPropertiesHTML',
  'mnt-solver': 'getMntSolverPropertiesHTML',
  'mnt-2dview': 'getMnt2DViewPropertiesHTML', 'mnt-report': 'getMntReportPropertiesHTML',
  'mnt-parametric': 'getMntParamPropertiesHTML'
};

var _gmPaketOnbellek = null;

// Örneğin (BMC Siper) tuvaldeki hâli: kayıtlı topolojinin KOPYASI. Başlangıç
// sayfasının "Yükle"si aynı kaydı kurar.
function _gmPaket(){
  if(_gmPaketOnbellek !== null) return _gmPaketOnbellek || null;
  _gmPaketOnbellek = false;
  try {
    var c = _gmCore();
    var ex = (c && c.getMountExample) ? c.getMountExample('siper') : null;
    var T = (ex && ex.topology && typeof window !== 'undefined' && window.__MNT_TOPOLOGIES)
      ? window.__MNT_TOPOLOGIES[ex.topology] : null;
    if(!T || !T.nodes || typeof componentDefs === 'undefined') return null;
    _gmPaketOnbellek = {
      nodes: JSON.parse(JSON.stringify(T.nodes)).map(function(n){ n.def = componentDefs[n.type]; return n; }),
      connections: JSON.parse(JSON.stringify(T.connections || []))
    };
  } catch(e){ _gmPaketOnbellek = false; }
  return _gmPaketOnbellek || null;
}

// Üreticiyi örnek modelde koştur; global'ler `finally` ile geri verilir.
// `coz`: Çözücü ve Rapor'un çözülmüş hâli (son hesap güncel) — sonuç
// programın kendi yolundan (`_mntComputeResults`), bildirim susar.
function _gmSahneHTML(fn, coz){
  var P = _gmPaket();
  if(!P || typeof window === 'undefined') return '';
  var w = window;
  var eski = { n: w.nodes, c: w.connections, t: w.showToast, l: w._veMntLast };
  try {
    w.nodes = P.nodes;
    w.connections = P.connections;
    w.showToast = function(){};
    w._veMntLast = null;
    if(coz && typeof _mntComputeResults === 'function'){
      var s = P.nodes.filter(function(n){ return n.type === 'mnt-solver'; })[0];
      try { w._veMntLast = s ? _mntComputeResults(s.id) : null; } catch(e2){ w._veMntLast = null; }
    }
    return fn(P) || '';
  } catch(e){
    return '';
  } finally {
    w.nodes = eski.n;
    w.connections = eski.c;
    w.showToast = eski.t;
    w._veMntLast = eski.l;
  }
}

// Pencerenin bölümlerinden bir kısmı: `tut` ana bölümlerin adları (yoksa
// hepsi), `yanYok` sağ sütunu atar. Yapı (bölünmüş gövde · kategori) korunur.
// SAYI ALANI programdaki gibi Türkçe: alanın değeri kaynakta makine
// biçiminde ("3.5"), programda js/sayi-alan.js gösterir ("3,5") — sahnede
// o kod koşmaz, gösterimi aynı yazıcı (`veSayiAlanGoster`) yapar.
function _gmKes(html, tut, yanYok){
  if(typeof document === 'undefined') return html;
  var t = document.createElement('template');
  t.innerHTML = html;
  var k = t.content;
  var dizi = function(sec){ return Array.prototype.slice.call(k.querySelectorAll(sec)); };
  if(typeof veSayiAlanGoster === 'function'){
    dizi('input[inputmode="decimal"][value]').forEach(function(a){
      a.setAttribute('value', veSayiAlanGoster(a.getAttribute('value')));
    });
  }
  if(tut){
    dizi('.ve-fp-main section.ve-fp-card').forEach(function(s){
      var b = s.querySelector('.ve-fp-sect > b');
      if(tut.indexOf(b ? b.textContent.trim() : '') < 0) s.parentNode.removeChild(s);
    });
    dizi('.ve-fp-kat').forEach(function(kat){
      if(!kat.querySelector('section')) kat.parentNode.removeChild(kat);
    });
  }
  if(yanYok){
    dizi('.ve-fp-side').forEach(function(y){ y.parentNode.removeChild(y); });
    dizi('.ve-fp-split').forEach(function(s){ s.classList.add('ve-fp-split--tek'); });
  }
  var kap = document.createElement('div');
  kap.appendChild(k.cloneNode(true));
  return kap.innerHTML;
}

// Bileşenin penceresi, örnek modelde. opt: { tut, yan (false: sağ sütun yok),
// coz, yeni ({ type, data }: örneğe eklenen, çizimden sonra çıkarılan düğüm) }.
function _gmPencere(tip, opt){
  var o = opt || {};
  return _gmSahneHTML(function(P){
    var fn = _GM_KURUCU[tip];
    if(!fn || typeof window[fn] !== 'function') return '';
    var n = null, eklendi = false;
    if(o.yeni){
      n = { id: 'gm-yeni', type: o.yeni.type, def: componentDefs[o.yeni.type], data: o.yeni.data || {},
            x: 0, y: 0, width: 60, height: 60 };
      P.nodes.push(n);
      eklendi = true;
    } else {
      n = P.nodes.filter(function(x){ return x.type === tip; })[0];
      // Örnekte olmayan araç (Takoz Özellikleri, Parametrik Analiz) çizim süresince eklenir
      if(!n && componentDefs[tip]){
        n = { id: 'gm-' + tip, type: tip, def: componentDefs[tip], data: {}, x: 0, y: 0, width: 60, height: 60 };
        P.nodes.push(n);
        eklendi = true;
      }
    }
    try {
      if(!n) return '';
      var html = _gmKes(window[fn](n), o.tut, o.yan === false);
      return '<div class="ve-properties-content">' + html + '</div>';
    } finally {
      if(eklendi) P.nodes.splice(P.nodes.indexOf(n), 1);
    }
  }, o.coz);
}

// Başlangıç sayfasının sol sütunu (seçenekler, örnekler, dönüş, Kılavuz).
// Son değişiklikler derlemenin künyesinden: sahnede yok, metinde anlatılır.
function _gmBaslangicHTML(){
  if(typeof veMntBaslangicSayfa !== 'function' || typeof veBasSayfaHTML !== 'function') return '';
  var S = veMntBaslangicSayfa();
  S.degisiklik = { baslik: 'Son değişiklikler', kayitlar: [] };
  var html = veBasSayfaHTML(S);
  if(typeof document === 'undefined') return html;
  var t = document.createElement('template');
  t.innerHTML = html;
  Array.prototype.slice.call(t.content.querySelectorAll('.ve-bas-masa')).forEach(function(m){
    m.parentNode.removeChild(m);
  });
  var kap = document.createElement('div');
  kap.appendChild(t.content.cloneNode(true));
  return kap.innerHTML;
}

// ═══════════════════════════════════════════════════════════════════════════
//  İŞARET LİSTELERİ — şeklin numaraları ve metnin numaraları aynı listeden
// ═══════════════════════════════════════════════════════════════════════════

var _GM_KARSILAMA = [
  { k: 'moduller', ad: 'Modüller', not: 'Programın üç modülü.' },
  { k: 'takoz', ad: 'Takoz Çökme-Titreşim', not: 'Tık modülü açar; başlangıç sayfası gelir.', yer: 'sag' },
  { k: 'proje', ad: 'Kayıtlı proje aç', not: 'Kaydedilmiş bir projeyi (.json) açar.' },
  { k: 'kilavuzlar', ad: 'Kılavuzlar', not: 'Modüllerin kullanım kılavuzları; bu belge oradan da açılır.' }
];

var _GM_BASLANGIC = [
  { k: 'sihirbaz', s: '.ve-bas-kapi[data-ey="sihirbaz"]', ad: 'Sihirbazla kur',
    not: 'Modeli beş adımda kurar.' },
  { k: 'step', s: '.ve-bas-kapi[data-ey="step"]', ad: 'STEP’ten başla',
    not: 'Güç grubunun STEP dosyasını 3B’de açar.' },
  { k: 'bos', s: '.ve-bas-kapi[data-ey="bos"]', ad: 'Boş kanvas',
    not: 'Çözücü, Rapor ve öteki araçları kurar; gövde ve takoz elle eklenir.' },
  { k: 'liste', s: '.ve-bas-sekmeler', ad: 'Araçlar · Kurgu', yer: 'sag',
    not: 'Gerçek araçların ve doğrulama modellerinin listesi.' },
  { k: 'ad', s: '.ve-bas-satir-ac', ad: 'Satırın adı',
    not: 'Güç grubunun künyesini, gövdeleri ve takozları açar.' },
  { k: 'yukle', s: '.ve-bas-satir-yukle', ad: 'Yükle', yer: 'sag',
    not: 'Örneği tuvale kurar; sayfa kapanır.' },
  { k: 'donus', s: '.ve-bas-donus', ad: 'Ana topoloji', yer: 'alt',
    not: 'Modülden çıkar; ana tuvale döner.' },
  { k: 'kilavuz', s: '.ve-bas-kilavuz', ad: 'Kılavuz', yer: 'alt-sag', not: 'Bu belgeyi açar.' }
];

var _GM_TUVAL = [
  { k: 'motor', ad: 'Motor', not: 'Kütle gövdesi. Şasi çerçevesindeki öteki kutular da gövdedir: Şanzıman, Şaft payı, cradle’lar.' },
  { k: 'takoz', ad: 'Takozlar', not: 'Her biri konumu ve rijitliğiyle; altı takoz.', yer: 'sag' },
  { k: 'cozucu', ad: 'Çözücü', not: 'Yük kitabı, yöntem ve Hesapla.' },
  { k: 'sihirbaz', ad: 'Başlangıç Sihirbazı', not: 'Çift tıkla Takoz Başlangıç Sihirbazı’nı açar.' },
  { k: 'rapor', ad: 'Rapor', not: 'Çevrimdışı HTML rapor.' },
  { k: 'gorunumler', ad: 'Görünümler', not: 'Modelin aksonometrik çizimi.' },
  { k: 'goruntuleyici', ad: '3D Görüntüleyici', not: 'Güç grubunun STEP dosyası.' },
  { k: 'geri', ad: 'Ana topolojiye dön', not: 'Modülden çıkar; Takoz kartı ana tuvalde kalır.' }
];

var _GM_EKRAN = [
  { k: 'komutlar', ad: 'Komutlar', not: 'Proje, düzen ve dışa aktarma komutları.', yer: 'sol-orta' },
  { k: 'bilesenler', ad: 'Bileşenler’i aç', not: 'Tuvale sürüklenen bileşenlerin sütunu.', yer: 'sag' },
  { k: 'topoloji', ad: 'Topoloji', not: 'Tuval: modeli kurmak ve pencereleri açmak.', yer: 'sag' },
  { k: 'sonuclar', ad: 'Sonuçlar', not: 'Çözümün sinyalleri ve diyagramları.', yer: 'sag' },
  { k: 'geri', ad: 'Ana topolojiye dön', not: 'Modülden çıkar.' },
  { k: 'uyarilar', ad: 'Uyarılar', not: 'Doğrulamanın uyarı sayısı; tık listeyi açar.', yer: 'sag' },
  { k: 'sayac', ad: 'Bileşen sayacı', not: 'Tuvaldeki bileşen ve bağlantı sayısı.', cerceve: false },
  { k: 'yakinlik', ad: 'Yakınlık', not: 'Tuvalin ölçeği; tık %100’e döner.', cerceve: false },
  { k: 'harita', ad: 'Genel görünüm', not: 'Tuvalin küçük haritası; çerçeve görünen alan.' }
];

var _GM_PENCERE = [
  { k: 'konu', ad: 'Seçili bileşen', not: 'Pencerenin konusu; tuvalde işaretli.' },
  { k: 'pencere', ad: 'Bileşen penceresi', not: 'Sağ sütunda açılır; başka bileşene tık içeriği değiştirir.', yer: 'sol-orta' }
];

var _GM_PENCERE_UST = [
  { k: 'baslik', ad: 'Başlık', not: 'Bileşenin adı.', yer: 'sol-orta' },
  { k: 'kapat', ad: 'Kapat', not: 'Esc de kapatır.', yer: 'sol-orta' },
  { k: 'kimlik', ad: 'Kimlik', not: 'Sembol, ad ve tip.', yer: 'alt' },
  { k: 'adlandir', ad: 'Adı düzenle', not: 'Bileşenin tuvaldeki adı.', yer: 'sag' },
  { k: 'sil', ad: 'Bileşeni sil', not: 'Delete tuşu da siler; Ctrl+Z geri alır.', yer: 'sol-orta' },
  { k: 'ilkbolum', ad: 'Bölümler', not: 'Pencerenin bütün bölümleri alt alta: Kütle, Ağırlık merkezi …', yer: 'sol-orta' }
];

var _GM_COZUCU = [
  { k: 'eksen', bolum: 'Araç ekseni', ad: 'Araç ekseni', not: 'İleri yön ve tork yönü.' },
  { k: 'kaldirim', bolum: 'Kaldırım darbesi', ad: 'Kaldırım darbesi', not: 'Yanal darbenin ivmesi ve yönü.' },
  { k: 'kitap', bolum: 'Yük kitabı', ad: 'Yük kitabı', not: 'Çözülecek yük durumları: ivme n ve tork T.' },
  { k: 'yontem', bolum: 'Yöntem', ad: 'Yöntem', not: 'Çözüm modu ve sönüm oranı ζ.' },
  { k: 'sok', bolum: 'Şok darbesi', ad: 'Şok darbesi', not: 'Yarım sinüs darbenin tepe ivmesi ve süresi.' },
  { k: 'hesapla', metin: 'Hesapla', ad: 'Hesapla', yer: 'sag', not: 'Bütün yük durumlarını ve modları çözer.' },
  { k: 'not', s: '.ve-fp-solve-not', ad: 'Durum notu', not: 'Toplam kütle, gövde ve takoz sayısı, son hesabın durumu.' }
];

var _GM_SONUC = [
  { k: 'ray', ad: 'Sonuçlar', not: 'Rayda Sonuçlar sayfası.', yer: 'sag' },
  { k: 'gezgin', ad: 'Veri Gezgini', not: 'Çözümün sinyalleri, gruplu.', cerceve: false, yer: 'ic' },
  { k: 'durum', ad: 'Çözümün durumu', not: 'Güncel: sinyaller son hesaptan.', yer: 'sag' },
  { k: 'grup', ad: 'Frekans yanıtı', not: 'İletilebilirlik ve izolasyon verimi; takoz başına da.' },
  { k: 'sinyal', ad: 'Sinyal', not: 'Kutu sinyali diyagrama ekler.' },
  { k: 'eksen', ad: 'X ekseni', not: 'Frekans yanıtında frekans.' },
  { k: 'gorunum', ad: 'İz · Tablo · 3B', not: 'Diyagram, değer tablosu ya da 3B.', yer: 'sag' },
  { k: 'cizim', ad: 'Diyagram', not: 'Dikey çizgiler modlar ve rölanti ateşleme frekansı.', cerceve: false, yer: 'ic' },
  { k: 'yorum', ad: 'Yorum', not: 'Tepe, izolasyon başlangıcı ve rölantide izolasyon.', yer: 'sol-orta' }
];

var _GM_RAPOR_P = [
  { k: 'cozum', bolum: 'Çözüm', ad: 'Çözüm', not: 'Raporun hangi çözümden üretileceği.' },
  { k: 'frekans', bolum: 'Frekans yerleşimi ve izolasyon', ad: 'Frekans yerleşimi ve izolasyon',
    not: 'Rölanti devri, silindir sayısı ve ζ’nın kaynağı.' },
  { k: 'indir', metin: 'Raporu oluştur ve indir', ust: 'button', ad: 'Raporu oluştur ve indir', yer: 'sag',
    not: 'Tek dosyalık HTML rapor indirilir.' }
];

var _GM_RAPOR = [
  { k: 'antet', ad: 'Antet', not: 'Model, toplam kütle, çözüm yöntemi ve tarih.' },
  { k: 'icindekiler', ad: 'İçindekiler', not: 'Kuram bölümleri ve modelin çözümü.' },
  { k: 'uygunluk', ad: 'Uygunluk', not: 'Raporun “Motor Takozu Uygunluğu” bölümü: kriterlerin hükmü.', yer: 'sag' },
  { k: 'bolum', ad: 'Bölümler', not: 'Her bölüm numarasıyla.' }
];

var _GM_KOMUT = [
  { k: 'dugme', ad: 'Komutlar', not: 'Ekranın sağ üst köşesi.', yer: 'sol-orta' },
  { k: 'yeni', ad: 'Yeni proje', not: 'Boş bir proje açar.', yer: 'sag-orta' },
  { k: 'ac', ad: 'Proje aç', not: 'Kaydedilmiş .json dosyasını açar.', yer: 'sag-orta' },
  { k: 'kaydet', ad: 'Kaydet', not: 'Ctrl+S; proje .json olarak kaydedilir.', yer: 'sag-orta' },
  { k: 'geri', ad: 'Geri al', not: 'Ctrl+Z.', yer: 'sag-orta' },
  { k: 'ileri', ad: 'İleri al', not: 'Ctrl+Y.', yer: 'sag-orta' },
  { k: 'duzenle', ad: 'Otomatik düzenle', not: 'Tuvaldeki bileşenleri düzene sokar.', yer: 'sag-orta' }
];

var _GM_PALET = [
  { k: 'palet', ad: 'Bileşenler', not: 'Modülün bileşenleri, gruplu.', cerceve: false, yer: 'alt' },
  { k: 'grup', ad: 'Takoz alt bileşenleri', not: 'Gövdeler, takoz ve araçlar.' },
  { k: 'motor', ad: 'Motor', not: 'Tuvale sürüklenir.', yer: 'sag' },
  { k: 'takoz', ad: 'Takoz', not: 'Her takoz için bir tane.', yer: 'sag' },
  { k: 'ozellik', ad: 'Takoz Özellikleri', not: 'Takoz tiplerinin kataloğu.', yer: 'sag' },
  { k: 'parametrik', ad: 'Parametrik Analiz', not: 'Katalogdan takoz seçimi.', yer: 'sag' },
  { k: 'daralt', ad: 'Daralt', not: 'Sütunu kapatır.', yer: 'sol-orta' },
  { k: 'tuval', ad: 'Tuval', not: 'Bileşen buraya bırakılır.', cerceve: false, yer: 'sol-orta' }
];

var _GM_YENI_TAKOZ = [
  { k: 'eksik', s: '.ve-fp-eksik', ad: 'Eksik bandı', not: 'Boş alanın sonucu; Doldur o alana götürür.' },
  { k: 'bolum', bolum: 'Rijitlik', ad: 'Bölüm', not: 'Başlığıyla; eksik bölüm sol kenarında kehribar çizgi taşır.' },
  { k: 'alan', bolum: 'Konum', s: 'input', ad: 'Alan', not: 'Değer yazılır; Enter ya da Tab ile onaylanır.' },
  { k: 'yer', bolum: 'Güç grubundaki yeri', ad: 'Güç grubundaki yeri', yer: 'sag',
    not: 'Bileşenin modeldeki yeri; Görünümler’in çizimi.' }
];

// Kütle gövdesi — Motor penceresinin ilk üç bölümü ve sağ sütun.
var _GM_GOVDE = [
  { k: 'kutle', bolum: 'Kütle', ad: 'Kütle', not: 'kg; yanında toplamdaki payı.' },
  { k: 'cg', bolum: 'Ağırlık merkezi', ad: 'Ağırlık merkezi', not: 'x · y · z (mm), modelin ortak çerçevesinde; sağ sütun birleşik CG’ye farkı.' },
  { k: 'atalet', bolum: 'Atalet tensörü', ad: 'Atalet tensörü', not: 'kg·m², parçanın kendi CG’sinde; üst üçgen girilir.' },
  { k: 'nokta', bolum: 'Atalet tensörü', s: 'label', ad: 'Nokta kütle', not: 'İşaretlenince atalet sıfır sayılır.' },
  { k: 'yer', bolum: 'Güç grubundaki yeri', ad: 'Güç grubundaki yeri', yer: 'sag',
    not: 'Bu gövde aydınlık, model gölgede; sürükle: döndür.' }
];

var _GM_MOTOR = [
  { k: 'katalog', bolum: 'Katalog', ad: 'Katalog', not: 'Motor seçimi tepe torku, gücü ve rölantiyi doldurur.' },
  { k: 'noktalar', bolum: 'Motor noktaları', ad: 'Motor noktaları', not: 'Tepe tork, maks. güç, rölanti, silindir sayısı.' },
  { k: 'zincir', bolum: 'Tork zinciri', ad: 'Tork zinciri', not: 'Mil torkunu oluşturan çarpanlar ve kaynakları.' },
  { k: 'atesleme', bolum: 'Ateşleme', ad: 'Ateşleme', not: 'Rölantide ateşleme frekansı ve mod sınırı.' }
];

var _GM_SANZ = [
  { k: 'katalog', bolum: 'Katalog', ad: 'Katalog', not: 'Vites konfigürasyonu ve konvertör.' },
  { k: 'vites', bolum: 'Vites oranları', ad: 'Vites oranları', not: 'Yedi ileri vites ve geri; vites başına mil torku.' },
  { k: 'konvertor', bolum: 'Konvertör', ad: 'Konvertör', not: 'Stall oranı.' },
  { k: 'bag', bolum: 'Bağlantı yüzü', ad: 'Bağlantı yüzü', not: 'Motora bağlandığı düzlem: merkez ve eksen.' },
  { k: 'moment', bolum: 'Statik eğilme momenti', ad: 'Statik eğilme momenti', not: 'Veri sayfasının sınırı.' }
];

var _GM_TAKOZ = [
  { k: 'tip', bolum: 'Takoz tipi', ad: 'Takoz tipi', not: 'Künye seçimi rijitliği, kapasiteyi ve yasayı doldurur.' },
  { k: 'rijitlik', bolum: 'Rijitlik', ad: 'Rijitlik', not: 'Üç eksen: statik ve dinamik (N/mm), dinamik/statik oranı.' },
  { k: 'kapasite', bolum: 'Kapasite', ad: 'Kapasite', not: 'Azami eksenel yük (kg).' },
  { k: 'konum', bolum: 'Konum', ad: 'Konum', not: 'Elastik merkez x · y · z (mm); birleşik CG’ye farkı.' },
  { k: 'yer', bolum: 'Güç grubundaki yeri', ad: 'Güç grubundaki yeri', yer: 'sag', not: 'Takozun modeldeki yeri.' }
];

var _GM_KUTUPHANE = [
  { k: 'tip', bolum: 'Takoz tipi', ad: 'Takoz tipi', not: 'Marka seçilir; tip o markanın tiplerinden seçilir.' },
  { k: 'yeni', metin: 'Yeni takoz', ust: 'button', ad: 'Yeni takoz', yer: 'sag-orta', not: 'Özel takoz tipi ekler.' },
  { k: 'rijitlik', bolum: 'Rijitlik', ad: 'Rijitlik', not: 'Tipin üç eksendeki statik ve dinamik rijitliği.' },
  { k: 'egri', bolum: 'Kuvvet–sehim', ad: 'Kuvvet–sehim', not: 'Üç eksen tek diyagramda; z-eğrisi özel takozda girilir.' }
];

var _GM_GORUNUM = [
  { k: 'bakis', s: '[data-ak3b-ad]', ad: 'Bakış', not: 'Bakışın adı; sürüklenince serbest bakış.' },
  { k: 'dugme', s: '.ve-mnt2d-zoomctl', ad: 'Görünüm düğmeleri', yer: 'sag',
    not: 'Yakınlaştır · uzaklaştır · dimetrik bakışa sıfırla · tam ekran.' },
  { k: 'cizim', s: 'svg.ve-mnt2d-akso', ad: 'Çizim', yer: 'alt',
    not: 'Gövdeler eşdeğer kutu, takozlar T, birleşik CG G.' },
  { k: 'foy', bolum: 'İşaretler', ad: 'İşaretler', not: 'Her işaretin numarası, adı ve konumu (mm).' }
];

var _GM_SIHIRBAZ = [
  { k: 'adimlar', ad: 'Adımlar', not: 'Adın altında adımda girilenler; rozet eksik sayısı, yeşil onay tamam.', yer: 'alt' },
  { k: 'masa', ad: 'Önizleme', not: 'Modelin aksonometrik çizimi, adım adım dolar.', cerceve: false, yer: 'alt' },
  { k: 'durum', ad: 'Çözülebilirlik', not: 'Çözülüyor ya da Çözülemiyor; toplam kütle, takoz sayısı.' },
  { k: 'gorunus', ad: '3B · Üstten · Yandan · Önden', not: 'Önizlemenin bakışı.', yer: 'sag' },
  { k: 'step', ad: 'STEP’ten başla', not: 'Modeli STEP dosyasından doldurur.', yer: 'sag' },
  { k: 'ornek', ad: 'Örnekten doldur', not: 'Kayıtlı örneklerden biri; oklar listede gezer.', yer: 'sag' },
  { k: 'ileri', ad: 'İleri', not: 'Sonraki adım; son adımda Modeli kur.', yer: 'sol-orta' },
  { k: 'kapat', ad: 'Kapat', not: 'Sihirbazı kapatır; tuval değişmez.', yer: 'sol-orta' },
  { k: 'talimat', ad: 'Talimat', not: 'Açık adımda yapılacaklar, sırayla.', cerceve: false, yer: 'sag-dis' },
  { k: 'eksikler', ad: 'Eksikler', not: 'Adımın eksik ve hatalı girdileri, sayısıyla; yoksa Eksik yok.', cerceve: false, yer: 'sag-orta' }
];

var _GM_3B_HIZLI = [
  { k: 'kart', ad: 'Hızlı atama', not: 'Sorulan rol, sırası ve ne yapılacağı.', cerceve: false, yer: 'ust' },
  { k: 'rol', ad: 'Sorulan rol', not: 'Önünde sırası: beş rolün kaçıncısı.', cerceve: false, yer: 'ust' },
  { k: 'say', ad: 'Seçili sayısı', not: 'Takoz ve braket adımında.', cerceve: false, yer: 'ust-sag' },
  { k: 'geri', ad: 'Geri', not: 'Önceki rol.', yer: 'alt' },
  { k: 'ileri', ad: 'Sonraki · Atla', not: 'Sıradaki rol; seçim yokken Atla.', yer: 'alt' },
  { k: 'bitir', ad: 'Bitir', not: 'Kartı kapatır; Esc de kapatır.', yer: 'alt' },
  { k: 'agacrol', ad: 'Verilen rol', not: 'Ağaçta satırın yanında, rolün renginde.', cerceve: false, yer: 'sol-dis' }
];

var _GM_3B = [
  { k: 'agac', ad: 'Ürün ağacı', not: 'Dosyanın parça ağacı; satırın yanında rolü.', yer: 'alt' },
  { k: 'dosya', ad: 'Dosya', not: 'Dosyanın adı ve parça sayısı.', yer: 'sag-orta' },
  { k: 'ara', ad: 'Ağaçta ara', not: 'Ad ya da örnek adı; Esc temizler.', yer: 'alt-sag' },
  { k: 'tuval', ad: '3B tuval', not: 'Sürükle: döndür · Tekerlek: yakınlaştır · Sağ tık: menü.', cerceve: false, yer: 'alt' },
  { k: 'kapat', ad: 'Kapat', not: 'Esc de kapatır.', yer: 'sol-orta' },
  { k: 'eksen', ad: 'Eksen işareti', not: '+X arka · +Y sağ · +Z yukarı.', yer: 'ic' },
  { k: 'ozellikler', ad: 'Özellikler', not: 'Seçimin özellikleri ve birimler.', cerceve: false, yer: 'ic-sag' },
  { k: 'rol', ad: 'Rol', not: 'Seçime rol verir: gövde, takoz, aktarma, aksesuar.' },
  { k: 'birimler', ad: 'Birimler', not: 'Rol verilen birimler, kütle ve CG’leriyle.', yer: 'sol-orta' },
  { k: 'eylem', ad: 'Hesap ve aktarım', not: 'Yeniden hesapla · Sihirbaza aktar.', yer: 'sol-orta' },
  { k: 'durum', ad: 'Durum çubuğu', not: 'İmlecin koordinatı ve birimler.', yer: 'sag-orta' }
];

var _GM_3B_MENU = [
  { k: 'tumu', ad: 'Tümünü göster', not: 'Gizlenen parçaları geri getirir.', yer: 'sol-orta' },
  { k: 'sigdir', ad: 'Tümünü sığdır', not: 'Modeli tuvale sığdırır.', yer: 'sol-orta' },
  { k: 'bakis', ad: 'Bakış', not: 'Ön · Arka · Sol · Sağ · Üst · Alt · İzometrik.', yer: 'sol-orta' },
  { k: 'gorunus', ad: 'Görünüş', not: 'Gölgeli ve kenar · Gölgeli · X-ışını.', yer: 'sol-orta' },
  { k: 'zemin', ad: 'Arka plan', not: 'Tuvalin zemini.', yer: 'sol-orta' },
  { k: 'suzgec', ad: 'Seçim', not: 'Parça ya da Yüzey.', yer: 'sol-orta' },
  { k: 'olcu', ad: 'Ölçü', not: 'İki nokta arası uzaklık.', yer: 'sol-orta' },
  { k: 'kesit', ad: 'Kesit', not: 'X, Y ya da Z düzlemiyle kesit.', yer: 'sol-orta' },
  { k: 'hizli', ad: 'Hızlı atama', not: 'Rolleri sırayla soran kartı açar ya da kapatır.', yer: 'sol-orta' }
];

var _GM_PARAM = [
  { k: 'gruplar', bolum: 'Gruplar', ad: 'Gruplar', not: 'Sağ/sol çiftler ve tek takozlar; Tara işareti.' },
  { k: 'katalog', bolum: 'Katalogdan seçim', ad: 'Katalogdan seçim', not: 'Grup, tip ve kombinasyon sayısı.' },
  { k: 'tara', metin: 'Tara', ust: 'button', ad: 'Tara', yer: 'sag', not: 'Kombinasyonları çözer; sürerken Durdur.' }
];

var _GM_PARAM_KISIT = [
  { k: 'kesin', bolum: 'Kesin kriterler', ad: 'Kesin kriterler', not: 'Kriter 1 · 1a · 1b · 2; kapatılamaz.' },
  { k: 'ek', bolum: 'Ek kısıtlar', ad: 'Ek kısıtlar', not: 'E1 … E9; kutu kısıtı açar, sınır sağda.' }
];

// ═══════════════════════════════════════════════════════════════════════════
//  BÖLÜMLER
// ═══════════════════════════════════════════════════════════════════════════

function _gmSec1(){
  var h = _gmH2('m1');
  h += '<p>Bu belge, MFSim’in <strong>Takoz Çökme-Titreşim</strong> modülünü programın açıldığı andan '
    + 'raporun indirilmesine kadar <strong>adım adım</strong> anlatır. Model 6 serbestlik dereceli bir '
    + '<strong>rijit gövde</strong> modelidir: güç grubu tek bir katı cisim, takozlar onu şasiye bağlayan '
    + 'üç eksenli yaylardır.</p>';
  h += _gmH3('Şekiller ve işaretler', 'isaretler');
  h += '<p>Şekiller programın kendi pencereleri ve ekranlarıdır. Şeklin üstündeki turuncu numara '
    + veGuideNo(1) + ' anlatılan öğeyi çerçeveler; aynı numara şeklin altındaki listede adıyla, metnin '
    + 'içinde de adımla birlikte geçer: “' + veGuideNo(6) + ' <strong>Yükle</strong>’ye basın.” '
    + 'Numaralı adımlar sırayla uygulanır; her adımın sonunda ekranda görülen şey yazılıdır.</p>';
  h += _gmAlanTablo('Kutular', [
    ['<strong>Not</strong>', 'Ek bilgi: birim, kaynak, ayrıntı', 'Mavi kenar'],
    ['<strong>Uyarı</strong>', 'Hata vermeden yanlış sonuç üreten girdi', 'Kehribar kenar'],
    ['<strong>Denetim</strong>', 'Sonucu doğrulamanın yolu', 'Yeşil kenar']
  ], ['Kutu', 'Ne taşır', 'Görünüş']);
  h += _gmH3('Okuma yolu', 'yol');
  h += _gmAlanTablo('Hedefe göre bölümler', [
    ['Programı ilk kez açmak', _gmB('acilis') + ' · ' + _gmB('tur') + ' · ' + _gmB('ekran'),
      'Açılış, ilk tur ve ekranın düzeni'],
    ['Modeli elle kurmak', _gmB('parcalar') + ' – ' + _gmB('cozucu'), 'Gövde, tork, takoz, yük ve çözücü'],
    ['Modeli sihirbazla kurmak', _gmB('sihirbaz'), 'Beş adım'],
    ['Modeli STEP dosyasından kurmak', _gmB('cad'), 'Roller, kütle, takoz noktası'],
    ['Sonucu okumak', _gmB('sehim') + ' · ' + _gmB('modal') + ' · ' + _gmB('rapor'), 'Sehim, modlar, rapor'],
    ['Takoz tipini katalogdan seçmek', _gmB('parametrik'), 'Tarama ve öneri'],
    ['Sonucu denetlemek', _gmB('hata') + ' · ' + _gmB('ornek'), 'Uyarı vermeyen hatalar, işlenmiş örnek']
  ], ['Hedef', 'Bölüm', 'Konu']);
  h += _gmNot('Sayısal örneğin sayıları',
      'Belge üretilirken çekirdek (<code>veMountCore</code>) <strong>bellekte</strong> kurulan '
    + 'örnekle koşturulur; sayısal örneğin (' + _gmB('ornek') + ') bütün değerleri bu hesabın çıktısıdır. '
    + 'Açık proje değişmez.');
  h += _gmH3('Bu modül neyi hesaplar', 'kapsam');
  h += _gmAlanTablo('Kapsam', [
    ['<strong>Statik sehim</strong>', 'Ağırlık ve ivme altında güç grubunun 6 serbestlik '
      + 'derecesindeki yer değiştirmesi', _gmB('sehim')],
    ['<strong>Takoz kuvvetleri</strong>', 'Her takozda üç eksenli kuvvet; çekme ve durdurucu '
      + 'teması', _gmB('sehim')],
    ['<strong>Doğal frekanslar</strong>', '6 rijit gövde modu ve mod biçimleri', _gmB('modal')],
    ['<strong>İzolasyon</strong>', 'Ateşleme frekansında iletim oranı', _gmB('modal')],
    ['<strong>Taşıma kapasitesi</strong>', 'Takoz başına eksenel yük kullanımı', _gmB('takoz')],
    ['<strong>Şok yanıtı</strong>', 'Darbe altında geçici rejim', _gmB('cozucu')]
  ], ['Ne', 'Neyi verir', 'Nerede']);
  h += _gmUyari('Rijit gövde varsayımı',
      'Güç grubu <strong>tek bir katı cisim</strong> kabul edilir; gövdenin kendi esnemesi, '
    + 'blok burulması ve şasi esnekliği modelde <strong>yoktur</strong>. Bu, takoz seçimi ve '
    + 'yerleşimi için standart ve yeterli bir yaklaşımdır — ama bir gövde modu takoz '
    + 'modlarının bandına giriyorsa sonuç yanıltıcı olur. Elastomerlerin sıcaklık ve yaşlanma '
    + 'bağımlılığı da modelde yoktur.');
  return h;
}

function _gmSec2(){
  var h = _gmH2('m2');
  h += _gmH3('Programı açmak', 'program');
  h += _gmAdimlar([
    '<code>MFSim_Code.html</code> dosyasını çift tıklayın. Program tarayıcıda açılır; internet '
      + 'bağlantısı gerekmez. Önce yükleme ekranı, ardından karşılama ekranı gelir (' + _gmS('karsilama') + ').',
    'Soldaki ' + _gmN(_GM_KARSILAMA, 'moduller') + ' <strong>Modüller</strong> listesinde '
      + _gmN(_GM_KARSILAMA, 'takoz') + ' <strong>Takoz Çökme-Titreşim</strong> satırına tıklayın. '
      + 'Ekranda: modül açılır ve başlangıç sayfası gelir (' + _gmS('baslangic') + ').'
  ]);
  h += _gmEkran('karsilama', 'karsilama', _GM_KARSILAMA,
    'Karşılama ekranı, soldaki sütun.', 300);
  h += '<p>Kaydedilmiş bir proje varsa ' + _gmN(_GM_KARSILAMA, 'proje') + ' <strong>Kayıtlı proje aç</strong> '
    + 'onu açar; kayıtta Takoz modülü varsa ana tuvalde Takoz kartı durur, karta çift tık modüle girer.</p>';
  h += _gmH3('Başlangıç sayfası', 'baslangic');
  h += '<p>Boş bir Takoz modülünde <strong>başlangıç sayfası</strong> açılır. Solda üç seçenek, '
    + 'örnek modellerin listesi ve altta <strong>Ana topoloji</strong> ile <strong>Kılavuz</strong> durur '
    + '(' + _gmS('baslangic') + '). Sağda modülün son değişiklikleri: tarih, başlık ve PR numarası; '
    + 'satıra tıklamak birleşmenin içeriğini notun görüntüsüyle açar.</p>';
  h += _gmSahne('baslangic', _gmBaslangicHTML(), 'Takoz başlangıç sayfası, soldaki sütun.', 400, _GM_BASLANGIC);
  h += '<p>Örnekler iki listede: <em>Araçlar</em> gerçek araçlar, <em>Kurgu</em> doğrulama modelleri. '
    + 'Her satırda araç, gövde ve takoz sayısı ve toplam kütle durur. Sayfa açıkken soldaki '
    + '<em>Topoloji · Sonuçlar</em> rayı ve <strong>Bileşenler</strong> sütunu görünmez; bir seçenek modeli '
    + 'kurunca gelirler. Kurulum Ctrl+Z ile geri alınınca sayfa yeniden açılır.</p>';
  h += _gmH3('Hangi yoldan başlanır', 'yollar');
  h += _gmAlanTablo('Modeli kurmanın dört yolu (numaralar: ' + _gmS('baslangic') + ')', [
    [_gmN(_GM_BASLANGIC, 'yukle') + ' <strong>Yükle</strong> (örnek)', 'Programı tanımak; benzer bir güç '
      + 'grubunu başlangıç almak', _gmB('tur')],
    [_gmN(_GM_BASLANGIC, 'sihirbaz') + ' <strong>Sihirbazla kur</strong>', 'Kütle ve takoz verisi elde, '
      + 'STEP dosyası yok', _gmB('sihirbaz')],
    [_gmN(_GM_BASLANGIC, 'step') + ' <strong>STEP’ten başla</strong>', 'Güç grubunun CATIA montajı var; '
      + 'kütle ve konumlar dosyadan', _gmB('cad')],
    [_gmN(_GM_BASLANGIC, 'bos') + ' <strong>Boş kanvas</strong>', 'Bileşenleri tek tek yerleştirmek',
      _gmB('kanvas')]
  ], ['Seçenek', 'Ne zaman', 'Bölüm']);
  var liste = _gmOrnekListe();
  if(liste.length){
    var satir = liste.map(function(e){
      return [_gmE(e.name), _gmE(e.vehicle || '—'), _gmE(e.subtitle || '—')];
    });
    h += _gmTablo('Kayıtlı örnek modeller', ['Örnek', 'Araç', 'Yapılandırma'], satir,
      ['l', 'l', 'l']);
  }
  return h;
}

function _gmSec3(){
  var h = _gmH2('m3');
  h += '<p>Bu tur kayıtlı <strong>BMC Siper</strong> örneğini yükler, denetler, çözer, sonucuna bakar, '
    + 'raporunu indirir ve projeyi kaydeder. Turdaki şekillerin hepsi bu örnektendir; aynı adımlar her '
    + 'modelde geçerlidir.</p>';
  h += _gmH3('Örneği yüklemek', 'tur-yukle');
  h += _gmAdimlar([
    'Başlangıç sayfasında <em>Araçlar</em> listesinde <strong>BMC Siper</strong> satırının '
      + _gmN(_GM_BASLANGIC, 'yukle') + ' <strong>Yükle</strong> düğmesine basın (' + _gmS('baslangic') + ').',
    'Ekranda: sayfa kapanır, model tuvale kurulur ve sağ üstte “Örnek yüklendi — BMC Siper.” bildirimi '
      + 'çıkar (' + _gmS('tuval') + '). Tuvalin sol üstündeki ' + _gmN(_GM_TUVAL, 'geri') + ' <strong>Ana '
      + 'topolojiye dön</strong> düğmesi modülden çıkar.'
  ]);
  h += _gmEkran('tuval', 'tuval', _GM_TUVAL, 'Örnek yüklendikten sonra tuval: gövdeler Şasi '
    + 'çerçevesinde, takozlar çevresinde, araçlar sağda.');
  h += _gmUyari('Bağlantılar burada salt görseldir',
      'Diğer modüllerde tel bir akışı anlatır (FEAD’de kayış yolu, Araç Performans’ta güç '
    + 'akışı). Burada öyle <strong>değildir</strong>: çözücü bileşenleri '
    + '<strong>tipinden</strong> toplar, teli okumaz. Tel çekmek modeli değiştirmez; yalnız '
    + 'hangi kütlenin hangi takoza oturduğunu gözle anlatır. Eksik bağlantı sonucu '
    + '<strong>etkilemez</strong>; eksik bileşen etkiler.');
  h += _gmH3('Bir bileşenin penceresini açmak', 'tur-pencere');
  h += _gmAdimlar([
    'Tuvalde <strong>Motor</strong>’a ' + _gmNS('tuval', _GM_TUVAL, 'motor') + ' çift tıklayın.',
    'Ekranda: penceresi sağdaki sütunda açılır ve Motor tuvalde seçili kalır (' + _gmS('pencere') + '). '
      + 'Pencerenin bölümleri tek gövdede alt alta durur; kaydırarak hepsine ulaşılır.',
    'Başka bir bileşene tıklamak pencerenin içeriğini o bileşenle değiştirir; '
      + _gmN(_GM_PENCERE_UST, 'kapat') + ' <strong>Kapat</strong> ya da Esc pencereyi kapatır (' + _gmS('pencere-ust') + ').'
  ]);
  h += _gmEkran('pencere', 'pencere', _GM_PENCERE, 'Motor’un penceresi sağ sütunda.');
  h += _gmEkran('pencere-ust', 'pencere-ust', _GM_PENCERE_UST, 'Pencerenin üst kısmı: başlık, kimlik ve ilk bölüm.', 380);
  h += _gmNot('Tek tık ve çift tık',
      'Her bileşende tek tık seçer, <strong>çift tık</strong> açar: kütle gövdeleri, takozlar ve '
    + 'araçlar — Çözücü, Rapor, Görünümler, 3D Görüntüleyici, Takoz Özellikleri ve Parametrik '
    + 'Analiz — penceresini, Başlangıç Sihirbazı sihirbazı. Pencere seçim boşalınca da '
    + 'açık kalır; konusu tuvalde kesikli kenarla işaretlidir.');
  h += _gmH3('Sihirbazı yeniden açmak', 'tur-sihirbaz');
  h += _gmAdimlar([
    'Tuvalde <strong>Başlangıç Sihirbazı</strong>’na ' + _gmNS('tuval', _GM_TUVAL, 'sihirbaz') + ' çift tıklayın.',
    'Ekranda: Takoz Başlangıç Sihirbazı açılır; tuvaldeki model adımları doldurur. '
      + '<strong>Modeli kur</strong> tuvaldeki düğümleri yerinde günceller.'
  ]);
  h += _gmNot('Pencere açılmaz',
      'Başlangıç Sihirbazı bir özellik penceresi taşımaz: çift tık sihirbazı açar. '
    + 'Örnek modeller başlangıç sayfasının listesindedir; model kurulduktan sonra başka örnek '
    + 'yüklemek için tuval boşaltılır ya da yeni proje açılır.');
  h += _gmH3('Modeli çözmek', 'tur-coz');
  h += _gmAdimlar([
    'Tuvalde <strong>Çözücü</strong>’ye ' + _gmNS('tuval', _GM_TUVAL, 'cozucu') + ' çift tıklayın: penceresi sağ '
      + 'sütunda açılır (' + _gmS('cozucu') + ').',
    'Sağ sütundaki ' + _gmN(_GM_COZUCU, 'hesapla') + ' <strong>Hesapla</strong>’ya basın. İlerleme '
      + 'düğmenin solundaki çubukta akar: çözülen yük durumu, sırası ve oranı.',
    'Ekranda: ' + _gmN(_GM_COZUCU, 'not') + ' durum notu “son hesap güncel” olur. Sonuç pencerede '
      + 'gösterilmez: Sonuçlar sayfasında ve raporda okunur.'
  ]);
  h += _gmSahne('cozucu', _gmPencere('mnt-solver', { coz: true }), 'Çözücü penceresi, örnek çözülmüş hâlde.',
    null, _GM_COZUCU);
  h += _gmH3('Sonuçlara bakmak', 'tur-sonuc');
  h += _gmAdimlar([
    'Soldaki rayda ' + _gmN(_GM_SONUC, 'ray') + ' <strong>Sonuçlar</strong>’a tıklayın.',
    _gmN(_GM_SONUC, 'gezgin') + ' <strong>Veri Gezgini</strong>’nde Takoz Çökme-Titreşim altındaki '
      + _gmN(_GM_SONUC, 'grup') + ' <strong>Frekans yanıtı</strong> grubunu açın ve bir sinyalin kutusunu '
      + 'işaretleyin ' + _gmN(_GM_SONUC, 'sinyal') + '.',
    'Ekranda: eğri çizilir; modların frekansları ve rölanti ateşleme frekansı dikey çizgilerle, eğrinin '
      + _gmN(_GM_SONUC, 'yorum') + ' yorumu altta (' + _gmS('sonuclar') + '). Tuvale dönmek için rayda '
      + '<strong>Topoloji</strong>.'
  ]);
  h += _gmEkran('sonuclar', 'sonuclar', _GM_SONUC, 'Sonuçlar sayfası: düşey iletilebilirlik, örnek çözülmüş.');
  h += _gmH3('Raporu üretmek', 'tur-rapor');
  h += _gmAdimlar([
    'Rayda <strong>Topoloji</strong>’ye dönün ve tuvalde <strong>Rapor</strong>’a ' + _gmNS('tuval', _GM_TUVAL, 'rapor')
      + ' çift tıklayın: penceresi açılır (' + _gmS('rapor-p') + ').',
    _gmN(_GM_RAPOR_P, 'indir') + ' <strong>Raporu oluştur ve indir</strong>’e basın. Rapor tek dosyalık '
      + 'HTML olarak indirilir; dosya internet bağlantısı olmadan açılır (' + _gmS('rapor') + ').'
  ]);
  h += _gmSahne('rapor-p', _gmPencere('mnt-report', { coz: true }), 'Rapor penceresi, örnek çözülmüş hâlde.',
    null, _GM_RAPOR_P);
  h += _gmEkran('rapor', 'rapor', _GM_RAPOR, 'İndirilen raporun ilk sayfası.');
  h += _gmH3('Kaydetmek ve modülden çıkmak', 'tur-kaydet');
  h += _gmAdimlar([
    'Sağ üstteki ' + _gmN(_GM_KOMUT, 'dugme') + ' <strong>Komutlar</strong> düğmesine basın (' + _gmS('komut') + ').',
    _gmN(_GM_KOMUT, 'kaydet') + ' <strong>Kaydet</strong>’e (Ctrl+S) basın: proje <code>.json</code> '
      + 'dosyası olarak kaydedilir. ' + _gmN(_GM_KOMUT, 'ac') + ' <strong>Proje aç</strong> onu geri yükler.',
    'Tuvalin sol üstündeki düğme (' + _gmS('tuval') + ', ' + _gmN(_GM_TUVAL, 'geri') + ') ana topolojiye '
      + 'döner; Takoz kartı ana tuvalde kalır, karta çift tık modüle geri götürür.'
  ]);
  h += _gmEkran('komut', 'komutlar', _GM_KOMUT, 'Komutlar penceresi.');
  return h;
}

function _gmSec4(){
  var h = _gmH2('m4');
  h += _gmH3('Ekranın bölümleri', 'ekran-bolum');
  h += '<p>Model kurulduktan sonra ekranın her bölümü yerinde durur (' + _gmS('ekran') + '). Pencereler '
    + 'sağ sütunda açılır, uyarılar ve tuvalin ölçeği durum çubuğundadır.</p>';
  h += _gmEkran('ekran', 'tuval', _GM_EKRAN, 'Ekranın bölümleri.');
  h += _gmH3('Fare ve klavye', 'fare');
  h += _gmAlanTablo('Tuvalde fare', [
    ['Tek tık', 'Bileşeni seçer', 'Ctrl + tık seçime ekler'],
    ['Çift tık', 'Bileşenin penceresini açar; Başlangıç Sihirbazı’nda sihirbazı', 'Ana tuvaldeki Takoz kartında modüle girer'],
    ['Sürükle', 'Bileşeni taşır; boşlukta seçim kutusu çizer', 'Hesabı etkilemez'],
    ['Sağ tık + sürükle', 'Görünümü kaydırır', ''],
    ['Tekerlek', 'Yakınlaştırır ve uzaklaştırır', 'Durum çubuğunda ölçek; tık %100’e döner']
  ], ['Hareket', 'Ne yapar', 'Not']);
  h += '<p>Klavye kısayollarının listesi programdadır (<strong>?</strong> tuşu); ' + _gmS('kisayol') + ' aynı '
    + 'listedir.</p>';
  h += _gmSahne('kisayol', (typeof veKisayolGruplariHTML === 'function')
    ? '<div class="ve-help-body">' + veKisayolGruplariHTML() + '</div>' : '', 'Klavye kısayolları.');
  h += _gmH3('Boş kanvastan kurmak', 'kanvas');
  h += _gmAdimlar([
    'Başlangıç sayfasında <strong>Boş kanvas</strong>’a ' + _gmNS('baslangic', _GM_BASLANGIC, 'bos') + ' basın: araç '
      + 'bileşenleri (Çözücü, Rapor, Görünümler …) kurulur.',
    'Soldaki rayda <strong>Sonuçlar</strong>’ın altındaki düğmeyle ' + _gmNS('ekran', _GM_EKRAN, 'bilesenler') + ' <strong>Bileşenler</strong> '
      + 'sütununu açın (' + _gmS('palet') + ').',
    'Güç grubunun her parçası için bir <strong>kütle gövdesi</strong>ni ' + _gmN(_GM_PALET, 'motor')
      + ' tuvale sürükleyin (Motor, Şanzıman, Şaft, Braket …).',
    'Her takoz için bir ' + _gmN(_GM_PALET, 'takoz') + ' <strong>Takoz</strong> sürükleyin. <strong>En az '
      + 'üç</strong> takoz gerekir: daha azında rijit gövde kinematik olarak serbest kalır ve rijitlik '
      + 'matrisi tekil olur.',
    'Her bileşenin penceresini açıp alanlarını doldurun (' + _gmB('govde') + ' – ' + _gmB('takoz') + '). '
      + 'Kütleler takozlara tel çekilerek gözle eşlenebilir — <em>hesabı etkilemez</em>.'
  ]);
  h += _gmEkran('palet', 'palet', _GM_PALET, 'Bileşenler sütunu açık.');
  h += _gmH3('Bileşen penceresinin yapısı', 'pencere-yapi');
  h += '<p>Her pencere aynı iskeleti taşır: kimlik, <strong>eksik bandı</strong> (yalnız eksik varken), '
    + 'bölümler alt alta ve sağda bağlam sütunu (' + _gmS('yeni-takoz') + '). Alana yazılan değer Enter, '
    + 'Tab ya da alandan çıkışla modele yazılır; her değişiklik Ctrl+Z ile geri alınır.</p>';
  h += _gmSahne('yeni-takoz', _gmPencere('mnt-mount', { yeni: { type: 'mnt-mount', data: {} } }),
    'Yeni eklenmiş, alanları boş bir takozun penceresi.', null, _GM_YENI_TAKOZ);
  h += _gmUyari('Boş alan çözücüde sıfırdır',
      'Eksik bandı boş alanın <strong>sonucunu</strong> yazar (“Rijitlik — çözücü bu takozu '
    + 'reddeder” gibi); <strong>Doldur</strong> o alana götürür ve eksik bölüm sol kenarında kehribar '
    + 'bir çizgi taşır. Bant boşalmadan çözülen model ya reddedilir ya da sıfır değerle çözülür.');
  return h;
}

function _gmSec5(){
  var h = _gmH2('m5');
  h += '<p>Modülün iç topolojisi kütle gövdelerinden, takozlardan ve araçlardan oluşur. Çözücü '
    + 'bileşenleri tipinden toplar; tuvaldeki yerleri ve bağlantıları hesabı etkilemez.</p>';
  h += _gmH3('Bileşenler', 'bilesenler');
  h += _gmAlanTablo('İç topolojideki bileşenler', [
    ['<strong>Kütle gövdeleri</strong>', 'Motor · Şanzıman · Şaft · Braket · Transfer · '
      + 'PTO · Pompa · PTO grubu', 'Hepsi aynı “Kütle”, “Ağırlık merkezi” ve “Atalet” bölümlerini '
      + 'taşır; farkları altlarındaki tipe özel bölümlerde (' + _gmB('govde') + ' · ' + _gmB('tork') + ')'],
    ['<strong>Motorun aksesuarları</strong>', 'Alternatör · Alternatör Braketi · Klima Kompresörü · '
      + 'Isı Sacı', 'Motora civatalı kütleler; her biri kendi bileşeni, nokta kütle'],
    ['<strong>Takoz</strong>', 'Konum ve üç eksenli rijitlik', 'En az 3, tipik olarak 3–4 (' + _gmB('takoz') + ')'],
    ['<strong>Takoz Özellikleri</strong>', 'Takoz tiplerinin kataloğu: rijitlik, kuvvet–sehim '
      + 'yasası', _gmB('kutuphane')],
    ['<strong>Çözücü</strong>', 'Yük kitabı, çözüm modu, sönüm, şok', 'Tuvalde bir tane (' + _gmB('cozucu') + ')'],
    ['<strong>Başlangıç Sihirbazı</strong>', 'Takoz Başlangıç Sihirbazı’nı açar; penceresi yoktur', _gmB('sihirbaz')],
    ['<strong>Görünümler</strong>', 'Modelin aksonometrik çizimi ve işaretlerin föyü', 'Hesaba girmez'],
    ['<strong>3D Görüntüleyici</strong>', 'Güç grubunun STEP dosyası: parçaların rolleri, takoz noktaları, '
      + 'gövdelerin hacmi, ağırlık merkezi ve ataleti; modelle karşılaştırma ve modele uygulama', _gmB('cad')],
    ['<strong>Rapor</strong>', 'Çevrimdışı HTML rapor', _gmB('rapor')],
    ['<strong>Parametrik Analiz</strong>', 'Katalogdan seçim: takoz gruplarına kütüphanedeki '
      + 'tipler, kısıtlar, iletilebilirlik–sehim dengesi; öneri, kriterler ve iki grafik pencerenin '
      + 'Sonuç bölümünde, on diyagram tam ekranda, ayrıntı ayrı bir raporda', _gmB('parametrik')]
  ], ['Bileşen', 'Ne', 'Not']);
  h += _gmH3('Girdiler ve türeyenler', 'girdi');
  h += _gmAlanTablo('Girdi / türeyen ayrımı', [
    ['Kütle gövdeleri', 'kütle · ağırlık merkezi · atalet tensörü',
      '<strong>birleşik kütle özellikleri</strong> (toplam kütle, ortak CG, paralel-eksen '
      + 'teoremiyle birleştirilmiş atalet)'],
    ['Takozlar', 'konum · statik ve dinamik rijitlik (x, y, z) · kapasite',
      '<strong>rijitlik matrisi K</strong> (CG etrafında, 6×6)'],
    ['Yük durumları', 'ivme vektörü ve tork', '<strong>sehim q</strong> · takoz kuvvetleri'],
    ['Çözücü', 'çözüm modu · sönüm oranı', '<strong>doğal frekanslar</strong> · mod '
      + 'biçimleri · izolasyon']
  ], ['Konu', 'Girdi', 'Türeyen']);
  h += _gmNot('Sonuçlar raporda',
      'Bileşen pencereleri yalnız girdiyi ve girdiden türeyeni gösterir (birleşik kütle, '
    + 'CG farkı, dinamik/statik oranı, mil torku). Sehim, takoz kuvvetleri, modlar ve '
    + 'uygunluk hükmü <strong>ayrıntılı raporda</strong>dır (' + _gmB('rapor') + '); pencerelerde çözümle '
    + 'değişen tek şey Çözücü’nün ve Rapor’un son hesabın güncel olup olmadığını söyleyen satırıdır.');
  h += _gmH3('Koordinat sistemi ve Görünümler', 'koordinat');
  h += '<p>Bütün konumlar ve ağırlık merkezleri <strong>aynı çerçevede</strong> ve <strong>mm</strong> '
    + 'cinsinden girilir. Eksenlerin yönü <strong>Görünümler</strong>’in ve 3B görüntüleyicinin eksen '
    + 'işaretinde: +X arkaya, +Y sağa, +Z yukarı. <strong>Görünümler</strong> modeli aksonometrik çizer '
    + '(' + _gmS('gorunumler') + '): sol tık + sürükle döndürür, tekerlek yakınlaştırır, sağ tık kaydırır. '
    + 'Föyün satırının üstüne gelince o parça çizimde aydınlanır, modelin geri kalanı gölgeye düşer. Bir '
    + 'gövdenin arkasında kalan takoz ve nokta kütle çizimde görünmez ve yazısızdır; föyün satırı onu yine '
    + 'gösterir. Gövde kutusunun içinde duran işaret, kutunun en yakın yüzünde sayılır.</p>';
  h += _gmSahne('gorunumler', _gmPencere('mnt-2dview'), 'Görünümler penceresi, örnek model.', 560, _GM_GORUNUM);
  h += _gmUyari('Çerçeveler karışmamalı',
      'Çerçevenin nerede olduğu önemli değildir — çözüm merkez farklarından kurulur — ama bir kütlenin '
    + 'CG’si parça çerçevesinde, bir takozun konumu araç çerçevesindeyse model hata vermeden yanlış '
    + 'çözülür. Görünümler’in çizimi bu karışıklığı gözle gösterir: takoz gövdeden uzakta durur.');
  return h;
}

function _gmSec6(){
  var h = _gmH2('m6');
  h += '<p>Güç grubunun her parçası bir <strong>kütle gövdesi</strong> düğümüdür. İlk üç bölüm her '
    + 'gövdede aynıdır (<strong>Kütle</strong> · <strong>Ağırlık merkezi</strong> · '
    + '<strong>Atalet</strong>); tipe göre değişenler onların altındadır (' + _gmB('tork') + '). Sağ '
    + 'sütundaki <strong>Güç grubundaki yeri</strong> Görünümler’in çizimidir ve onunla aynı açıda döner: '
    + 'bu gövde aydınlık ve adıyla, modelin geri kalanı gölgede (' + _gmS('govde') + ').</p>';
  h += _gmSahne('govde', _gmPencere('mnt-motor', { tut: ['Kütle', 'Ağırlık merkezi', 'Atalet tensörü'] }),
    'Motor penceresi: ilk üç bölüm ve sağ sütun.', null, _GM_GOVDE);
  h += _gmAdimlar([
    'Gövdeye çift tıklayın.',
    _gmN(_GM_GOVDE, 'kutle') + ' <strong>Kütle</strong> bölümüne kütleyi (kg), '
      + _gmN(_GM_GOVDE, 'cg') + ' <strong>Ağırlık merkezi</strong> föyüne CG’yi (mm, x/y/z) yazın — '
      + 'yanındaki sütun birleşik ağırlık merkezine farkı gösterir.',
    'Gövde ince ya da hafifse ' + _gmN(_GM_GOVDE, 'nokta') + ' <strong>Nokta kütle</strong> kutusunu '
      + 'işaretleyin — atalet tensörü sıfır kabul edilir, kütle CG’de toplanır; grubun ataleti gövdelerin '
      + 'CG yayılımından (paralel eksen) yine doğar.',
    'Nokta kütle değilse ' + _gmN(_GM_GOVDE, 'atalet') + ' <strong>Atalet tensörü</strong> matrisinin üst '
      + 'üçgenine köşegen (I<sub>xx</sub>, I<sub>yy</sub>, I<sub>zz</sub>) ve çarpım (I<sub>xy</sub>, '
      + 'I<sub>xz</sub>, I<sub>yz</sub>) terimlerini kg·m² cinsinden girin; alt üçgen simetriden '
      + 'kendiliğinden dolar.',
    'Pencerenin üstündeki <strong>eksik bandını</strong> okuyun (' + _gmB('pencere-yapi') + ').'
  ]);
  h += _gmAlanTablo('Kütle gövdesi penceresi — alanlar', [
    ['Kütle [kg]', 'Parçanın kütlesi', 'CAD ölçümü ya da parça künyesi'],
    ['Ağırlık merkezi [mm]', 'x / y / z — <strong>modelin ortak çerçevesinde</strong>',
      'CAD ölçümü (CATIA <em>Measure Inertia</em> gibi)'],
    ['Nokta kütle', 'Atalet ihmal edilsin mi',
      'Şaft, PTO parçası gibi ince/hafif gövdeler için uygun'],
    ['Atalet köşegen [kg·m²]', 'I<sub>xx</sub> · I<sub>yy</sub> · I<sub>zz</sub>',
      'CAD ölçümü — <strong>parçanın kendi CG’sinde</strong>'],
    ['Atalet çarpım [kg·m²]', 'I<sub>xy</sub> · I<sub>xz</sub> · I<sub>yz</sub>',
      'Simetrik gövdelerde çoğu sıfırdır'],
    ['Asal momentler · eşdeğer kutu', 'Tensörden türetilir (salt okunur)',
      'Tensör fiziksel değilse (ör. I<sub>yy</sub> + I<sub>zz</sub> &lt; I<sub>xx</sub>) bant uyarır']
  ]);
  h += _gmUyari('Atalet parçanın kendi CG’sinde girilir',
      'Gövdeler birleştirilirken <strong>paralel-eksen teoremi</strong> uygulanır: her parçanın '
    + 'ataleti parçanın CG’sinden ortak CG’ye taşınır. Ortak CG’ye taşınmış atalet girilirse '
    + 'taşıma <strong>iki kez</strong> yapılır ve atalet şişer. Belirtisi yalnız modal analizde '
    + 'görünür: dönme modları beklenenden <strong>düşük</strong> çıkar; sehim sonuçları '
    + 'etkilenmez.');
  h += _gmNot('Birimler: kg · mm · kg·m² · N/mm',
      'Pencere bu birimlerde çalışır ve çekirdeğe geçerken SI’ya çevirir. Atalet '
    + '<strong>kg·m²</strong>’dir (kg·mm² değil): 10⁶ kat fark eder ve karıştırıldığında '
    + 'dönme modları anlamsız yerlere gider.');
  return h;
}

function _gmSec7(){
  var h = _gmH2('m7');
  h += '<p>Bazı kütle gövdeleri, kütlelerine ek olarak <strong>tork</strong> üretir ya da '
    + 'iletir. Bu bilgiler pencerede atalet bölümünün altındadır ve gövdenin tipine göre değişir '
    + '(' + _gmS('motor') + ' · ' + _gmS('sanziman') + '). Motor kataloğundan bir motor seçmek tepe torku, '
    + 'maks. gücü ve rölantiyi doldurur; <strong>kütle, CG ve atalet doldurulmaz</strong> — kataloğun '
    + 'ataleti krank milinin döner ataletidir, gövdenin tensörü değil.</p>';
  h += _gmSahne('motor', _gmPencere('mnt-motor', { tut: ['Katalog', 'Motor noktaları', 'Tork zinciri', 'Ateşleme'],
    yan: false }), 'Motor penceresi: tahrik bölümleri.', null, _GM_MOTOR);
  h += _gmAlanTablo('Tipe özel bölümler', [
    ['Motor', '<strong>Katalog</strong>, <strong>Motor noktaları</strong> (tepe tork, maks. güç, '
      + 'rölanti, silindir sayısı), <strong>Tork zinciri</strong>, <strong>Ateşleme</strong>', 'Motor künyesi'],
    ['Şanzıman', '<strong>Katalog</strong> (vites konfigürasyonu · konvertör), <strong>Vites oranları</strong> (yedi ileri '
      + 'vites ve geri; vites başına mil torku), <strong>Konvertör</strong> (stall oranı), <strong>Bağlantı yüzü</strong> · '
      + '<strong>Statik eğilme momenti</strong>', 'Şanzımanın veri sayfası ve konvertör'],
    ['Transfer Kutusu', '<strong>Oran ve aks payı</strong> (transfer oranı, aks payı φ), '
      + '<strong>Mil torku</strong>', 'Transfer künyesi'],
    ['PTO · Pompa · PTO grubu', '<strong>Giriş yolu</strong> ve <strong>ASR-SR-116 referansı</strong>',
      'Toplu ya da parça parça — <strong>ikisi birden değil</strong>'],
    ['Alternatör · Klima Kompresörü', '<strong>Kayıtlı aksesuar</strong> (kütle)',
      'Programın aksesuar kataloğu']
  ], ['Gövde', 'Bölümler', 'Nereden']);
  h += '<p>Motorun ' + _gmN(_GM_MOTOR, 'zincir') + ' <strong>Tork zinciri</strong> föyü, mil torkunu '
    + 'oluşturan her çarpanın hangi gövdeden okunduğunu yazar. Aynı alan iki gövdede birden doluysa '
    + 'çözücü ilkini okur; pencerenin üstündeki bant bunu <strong>çakışma</strong> olarak, hangi gövdenin '
    + 'okunduğuyla birlikte yazar.</p>';
  h += '<p>Motorun aksesuarları (alternatör, alternatör braketi, klima kompresörü, ısı sacı) her biri kendi '
    + 'bileşenidir: motora civatalı kütle olarak güç grubunun '
    + 'kütlesine katılır, takoza oturmaz. Kütle ve ağırlık merkezi aksesuarın teknik resminden girilir; '
    + 'teknik resim ağırlık merkezini vermiyorsa aksesuarın <strong>orta noktası</strong> alınır. Atalet '
    + 'girilmez: aksesuar nokta kütledir ve toplam atalete paralel eksen teoremiyle katılır. Alternatör '
    + 've klima kompresörünün kütlesi programda kayıtlı modellerden de seçilir '
    + '(<strong>Kayıtlı aksesuar</strong>). Motorun kütlesi veri sayfasından geliyorsa aksesuarlar '
    + 'onun içinde değildir.</p>';
  h += _gmSahne('sanziman', _gmPencere('mnt-gearbox', { tut: ['Katalog', 'Vites oranları', 'Konvertör',
    'Bağlantı yüzü', 'Statik eğilme momenti'], yan: false }), 'Şanzıman penceresi: tahrik bölümleri.', null, _GM_SANZ);
  h += '<p>Şanzımanın ' + _gmN(_GM_SANZ, 'katalog') + ' <strong>Katalog</strong> bölümü veri sayfasının vites '
    + 'konfigürasyonlarını ve konvertörlerini listeler (Allison 4000: <em lang="en">Close Ratio (CR)</em>, '
    + '<em lang="en">Wide Ratio (WR)</em>, <em lang="en">7-Speed</em>; TC-521 … TC-571). Vites konfigürasyonu '
    + 'ileri vitesleri ve geriyi doldurur; <em lang="en">7-Speed</em>’de 1. vites LO’dur (7,63). Altı vitesli '
    + 'konfigürasyon seçilince 7. vites alanı boşalır. Konvertör stall oranını doldurur. Bağ kaldırılınca '
    + 'girilen değerler kalır; elle değişen alan bölümün notunda <strong>Katalogdan sapıldı</strong> olarak '
    + 'adıyla yazar.</p>';
  h += '<p>' + _gmN(_GM_SANZ, 'bag') + ' <strong>Bağlantı yüzü</strong> şanzımanın motora bağlandığı düzlemdir: '
    + 'merkezi ve eksenin yönü. STEP’ten veri sayfasıyla kurulan şanzımanda (Allison 4000, '
    + '<em lang="en">Direct mount</em>) iki değer aktarımla gelir: merkez, şanzıman ekseninin konvertör '
    + 'muhafazasının ön yüzünü kestiği nokta; yön, eksen boyunca şanzımanın içine. '
    + _gmN(_GM_SANZ, 'moment') + ' <strong>Statik eğilme momenti</strong> sınırı veri sayfasındandır (3.500 N·m). '
    + 'Merkez elle de yazılır; yön verilmemişse boyuna eksendir (+X). Momentin kendisi raporda '
    + '(' + _gmB('rapor') + ').</p>';
  h += '<p>Tork bilgisi <strong>vites tork durumlarını</strong> üretir: program her vites '
    + 'için tepki torkunu hesaplar ve ayrı bir yük durumu olarak çözer (' + _gmB('yuk') + ').</p>';
  h += _gmUyari('PTO kütlesi iki kez sayılabilir',
      'PTO grubunun kütlesi iki yoldan verilir: tek bir <strong>PTO grubu</strong> '
    + 'gövdesiyle toplu olarak, ya da ayrı <strong>PTO</strong> ve <strong>Pompa</strong> '
    + 'gövdeleriyle parça parça. Toplu girişte grubun kütlesi, CG’si ve atalet tensörü tek '
    + 'kalemdir; ayrıntılı girişte parça başına kütle ve CG girilir ve grubun ataleti parçaların '
    + 'yayılımından doğar. <strong>İkisi birden</strong> tanımlanırsa aynı kütle iki kez '
    + 'sayılır ve çözücü “makul ama yanlış” bir toplam üretir; tutarlılık uyarıları bunu '
    + 'adıyla yazar.');
  return h;
}

function _gmSec8(){
  var h = _gmH2('m8');
  h += '<p>Takoz, güç grubunu şasiye bağlayan üç eksenli bir yaydır. Her takoz kendi '
    + 'konumunu ve üç eksende iki ayrı rijitliğini taşır. Penceresi hepsini tek gövdede alt '
    + 'alta taşır; sağ sütunda takozu vurgulayan <strong>Güç grubundaki yeri</strong> krokisi '
    + '(' + _gmS('takoz') + ').</p>';
  h += _gmSahne('takoz', _gmPencere('mnt-mount'), 'Takoz penceresi, örneğin bir takozu.', null, _GM_TAKOZ);
  h += _gmAdimlar([
    'Takoza çift tıklayın.',
    _gmN(_GM_TAKOZ, 'tip') + ' <strong>Takoz tipi</strong> listesinden hazır bir künye seçin — konum hariç bütün '
      + 'alanlar dolar (' + _gmB('kutuphane') + '). Altındaki durum satırı değerlerin kaçının künyeyle aynı '
      + 'kaldığını söyler. Altı rijitliği bir künyeyle birebir aynı olan takozda liste o künyeyi gösterir.',
    _gmN(_GM_TAKOZ, 'konum') + ' <strong>Konum</strong> föyüne takozun x / y / z koordinatını yazın (mm, modelin '
      + 'ortak çerçevesinde).',
    'Künye kütüphanede yoksa ' + _gmN(_GM_TAKOZ, 'rijitlik') + ' <strong>Rijitlik</strong> föyüne üç eksenin '
      + 'statik ve dinamik değerlerini girin (N/mm); her satırın dinamik/statik oranı yanında türetilir.',
    'Varsa ' + _gmN(_GM_TAKOZ, 'kapasite') + ' <strong>Kapasite</strong> bölümüne takozun azami eksenel yükünü '
      + 'yazın — raporun uygunluğunda kullanım yüzdesi olarak görünür.'
  ]);
  h += _gmAlanTablo('Takoz penceresi — alanlar', [
    ['Konum [mm]', 'x / y / z — takozun <strong>elastik merkezi</strong>',
      'Montaj resmi; kütle CG’leriyle <strong>aynı çerçevede</strong>'],
    ['Rijitlik · statik [N/mm]', 'k<sub>x</sub> · k<sub>y</sub> · k<sub>z</sub>',
      'Takoz kataloğu — <strong>yavaş yükleme</strong> değeri'],
    ['Rijitlik · dinamik [N/mm]', 'k<sub>x</sub> · k<sub>y</sub> · k<sub>z</sub>',
      'Aynı katalog — <strong>titreşim frekansındaki</strong> değer'],
    ['Maks. eksenel yük [kg]', 'Takozun taşıyabileceği azami yük',
      'Katalog; boş bırakılabilir, o zaman kullanım yüzdesi basılmaz']
  ]);
  h += _gmUyari('Statik ve dinamik rijitlik aynı değildir',
      'Elastomer bir takoz, hızlı yüklemede yavaş yüklemeden <strong>daha rijittir</strong> — '
    + 'tipik oran 1,4–1,8. <strong>Sehim</strong> statik rijitlikle, <strong>doğal '
    + 'frekanslar</strong> dinamik rijitlikle hesaplanır. İkisine aynı değer yazılırsa model '
    + 'yine çözülür: ya sehim fazla küçük çıkar ya frekanslar fazla düşük; <strong>hata '
    + 'verilmez</strong>. Pencere oranın eksenler '
    + 'arasında 1,5 kattan fazla yayıldığını işaretler: eksenlerin takaslı girildiğinin izidir.');
  h += _gmNot('Üç takoz alt sınırdır, dört üst sınır değildir',
      'Rijit gövdeyi 6 serbestlik derecesinde kısıtlamak için en az üç takoz gerekir; daha '
    + 'azında rijitlik matrisi <strong>tekildir</strong> ve çözücü açıkça “singular” der. '
    + 'Dörtten fazla takoz ise <em>aşırı-kısıtlı</em> bir modeldir: çözülür, ama yük dağılımı '
    + 'takozların birbirine göre rijitliğine çok duyarlı hâle gelir. Tipik bir güç grubu 3–4 '
    + 'takozla bağlanır ve model bunun dışını uyarı olarak yazar.');
  return h;
}

function _gmSec9(){
  var h = _gmH2('m9');
  h += _gmH3('Takoz Özellikleri', 'ozellikler');
  h += '<p><strong>Takoz Özellikleri</strong> bileşeni takoz tiplerinin kataloğunu taşır: '
    + 'katalogdaki künyeler ve eklenen özel takozlar (' + _gmS('kutuphane') + '). Tipler markaya '
    + 'göre ayrılır: önce <strong>Marka</strong>, sonra o markanın tipi seçilir. Seçilen tip takoza '
    + 'uygulanınca rijitlikler dolar; <strong>konum dolmaz</strong> — o motorun verisidir, parçanın '
    + 'değil.</p>';
  h += _gmSahne('kutuphane', _gmPencere('mnt-library'), 'Takoz Özellikleri penceresi.', null, _GM_KUTUPHANE);
  h += _gmAlanTablo('Takoz Özellikleri penceresi', [
    ['Takoz tipi', 'Marka listesi, o markanın tiplerinin listesi ve <strong>Yeni takoz</strong>; özel '
      + 'tipte ad alanı ve <strong>Sil</strong>', 'Katalogdaki tipin adı değişmez; alttaki bölümler '
      + 'seçili tipin adını başlıklarında taşır'],
    ['Rijitlik', 'Üç eksenin statik ve dinamik rijitliği, dinamik/statik oranı',
      'Boş ya da ≤ 0 değer varsa bant bunu yazar: çözücü bu tipi taşıyan takozu reddeder. '
      + 'Oran eksenler arasında 1,5 kattan fazla yayılıyorsa da yazar: eksenler takaslı '
      + 'girilmiş olabilir. Eğik ve soluk yazılı değer <strong>tahminidir</strong>; '
      + '<strong>Radyal tahmini</strong> (A+P’de <strong>Dinamik tahmini</strong>) satırı oranı ve kaynağını yazar'],
    ['Kuvvet–sehim', 'X · Y · Z kuvvet–sehim eğrileri tek diyagramda; aynı eğriyi çizen eksenler tek çizgidir',
      'Statik düz, dinamik kesikli çizgidir. Katalogdaki takozun eğrisi salt okunurdur; z-eğrisinin '
      + 'noktaları yalnız özel takozda girilir']
  ], ['Bölüm', 'Ne taşır', 'Ne söyler']);
  h += _gmNot('Künye kopya olarak gider',
      'Takoz Özellikleri’nden uygulanan değerler takoz düğümüne <strong>kopyalanır</strong>: '
    + 'katalog güncellense de kaydedilmiş proje <strong>değişmez</strong>; hangi künyeden '
    + 'geldiğinin izi kalır. Tip sonradan değişirse takoz eski değerinde kalır; Takoz '
    + 'penceresinin tip notu kaç değerin tiple aynı olduğunu yazar. Taşıma kapasitesi de kopyalanır; tipte '
    + 'tanımsızsa takozdaki eski değer silinir. Katalogdaki bir takozda yapılan değişiklik bu '
    + 'Takoz Özellikleri düğümüne yazılır, katalogun kendi değeri bozulmaz.');
  h += _gmNot('Radyal rijitlik tahmini',
      'AMC radyal rijitliği (k<sub>x</sub>, k<sub>y</sub>) yalnız ölçtüğü on kod için verir; eksenel '
    + 'k<sub>z</sub> = Z, dik takılı takozda yukarı–aşağı. Öteki kodlarda radyal rijitlik '
    + '<strong>eksenel × oran</strong> alınır: aynı geometride bütün yönler kauçuğun sertliğiyle birlikte '
    + 'değiştiği için oran tipin özelliğidir (Cone 39’un üç sertliğinde 1,86 · 1,91 · 1,78). Oran sırayla '
    + 'aynı tipin AMC değerinden, yoksa aynı ailenin AMC-EO’daki tiplerinden, yoksa AMC-EO’daki bütün '
    + 'tiplerden (medyan) gelir; dinamik değer statik × dinamik/statik oranıdır. Tahminli tip çözülür, '
    + 'raporda değeri ≈ ile yazılır; katalog taramasına aday olmaz. Üreticinin değeri girilince o eksen '
    + 'tahmin olmaktan çıkar.');
  h += _gmH3('Nonlineer z-eğrisi', 'egri');
  h += '<p>Elastomer takozlar büyük sehimde <strong>sertleşir</strong>: kuvvet–sehim ilişkisi '
    + 'doğru değil, yukarı bükülen bir eğridir. Takoza <strong>kuvvet–sehim eğrisi</strong> '
    + 'girilince çözücü nonlineer yola (Newton iterasyonu) geçer.</p>';
  h += _gmAlanTablo('Doğrusal ↔ nonlineer', [
    ['Hiçbir takozda eğri yok', 'Doğrusal çözüm — tek adımda',
      'Küçük sehimlerde (statik ağırlık) doğru ve hızlı'],
    ['En az bir takozda eğri var', 'Newton iterasyonu — bütün model nonlineer çözülür',
      'Büyük sehim (3,5 g düşey gibi) için gerekli'],
    ['Metal-metal durdurucu', 'Her zaman açık: her takozda düşeyde ±15 mm boşluk',
      'Takozun mekanik sınırına dayanmasını modeller; boşluk ayarlanmaz, yanal durdurucu yok']
  ], ['Durum', 'Çözüm yolu', 'Ne zaman']);
  h += _gmUyari('Doğrusal model büyük sehimde iyimserdir',
      'Eğri girilmemişse takoz <strong>her sehimde aynı rijitlikte</strong> sayılır. Gerçek '
    + 'takoz sertleştiği için doğrusal model büyük ivmelerde sehimi <strong>fazla</strong>, '
    + 'takoz kuvvetini <strong>az</strong> gösterir. Raporun <em>Lineerlik (±10 mm)</em> '
    + 'satırı bunu bildirir; aşım varsa eğri girin.');
  h += _gmNot('Eğrinin noktaları',
      'z-eğrisi özel bir takoz tipinde, ' + _gmN(_GM_KUTUPHANE, 'egri') + ' <strong>Takoz Özellikleri → '
    + 'Kuvvet–sehim</strong> bölümünde tanımlanır ve tip bir takoza uygulanınca onunla birlikte kopyalanır. '
    + 'Çözücü noktaları sehime (δ) göre sıralar; monoton bir eğri girin (basma eksi).');
  return h;
}

function _gmSec10(){
  var h = _gmH2('m10');
  h += '<p>Bir yük durumu iki şeyden oluşur: bir <strong>ivme vektörü</strong> (g cinsinden, '
    + 'x/y/z) ve bir <strong>tork</strong> (N·m, x/y/z). Program bunlardan güç grubuna etki '
    + 'eden kuvvet ve momenti kurar, sonra sehimi çözer. Çözülecek durumların listesi Çözücü’nün '
    + _gmN(_GM_COZUCU, 'kitap') + ' <strong>Yük kitabı</strong> bölümündedir (' + _gmS('cozucu') + ').</p>';
  h += _gmTablo('Standart yük durumları (ileri yön −X)',
    ['Durum', 'İvme n = [x, y, z]', 'Ne anlatıyor'],
    [
      ['Static', '[0, 0, −1]', 'Yalnız ağırlık — sehimin temel hâli'],
      ['Max Bump', '[0, 0, −3,5]', 'Düşey darbe (3,5 g)'],
      ['Braking', '[−1, 0, −1]', 'Fren'],
      ['Acceleration', '[+1, 0, −1]', 'Boyuna hızlanma'],
      ['Cornering L / R', '[0, ±0,6, −1]', 'Yanal viraj'],
      ['Brake in Turn L / R', '[−0,4, ±0,4, −1]', 'Virajda fren'],
      ['Pothole Braking', '[−3, 0, −3,5]', 'Çukurda fren'],
      ['Kerb Strike L / R', '[0, ∓1,55, −1]', 'Yanal kaldırım darbesi (varsayılan: virajın tersi yönde)'],
      ['Max Rebound', '[0, 0, +1]', 'Düşey geri sıçrama'],
      ['Forward / Reverse Torque', '[0, 0, −1] + T', 'Tahrik tepki torku']
    ], ['l', 'c', 'l']);
  h += '<p>Bunlara ek olarak <strong>vites tork durumları</strong> (her vites için ayrı) ve '
    + 'üç <strong>tasarım yük durumu</strong> (3,5 g düşey · 1 g yanal · 1 g boyuna fren) '
    + 'kendiliğinden kurulur.</p>';
  h += _gmNot('İvme işareti',
      'n, güç grubuna etkiyen yükün yönüdür (g cinsinden). Düşey bileşen <strong>−1</strong>’dir: '
    + 'ağırlık aşağı yöndedir; “3,5 g düşey” n<sub>z</sub> = −3,5 demektir. Fren güç grubunu '
    + '<strong>ileri</strong> iter: ileri yön −X iken fren durumunda n<sub>x</sub> = −1; sol viraj '
    + 'onu sağa iter: n<sub>y</sub> = +0,6.');
  h += _gmH3('Aracın ileri yönü', 'ileri');
  h += '<p>Tablo, aracın ileri yönü modelin <strong>−X</strong> ekseni olan bir CAD düzenine '
    + 'göre yazılıdır (sağ +Y). Modelin ekseninde araç <strong>+X</strong>’e gidiyorsa '
    + 'Çözücü’de <strong>Araç ekseni → İleri yön</strong> ' + _gmNS('cozucu', _GM_COZUCU, 'eksen') + ' +X seçilir: '
    + 'program boyuna ve yanal bileşenleri çevirir (n<sub>x</sub> → −n<sub>x</sub>, n<sub>y</sub> → '
    + '−n<sub>y</sub>; düşey aynı). Yanlış yön fren ve viraj yükünü ters uygular — sayı makul görünür, '
    + 'ama başka bir yük durumunun sonucudur.</p>';
  h += _gmAlanTablo('İleri yönün etkisi', [
    ['Fren · hızlanma · viraj · kaldırım', 'n<sub>x</sub> ve n<sub>y</sub> çevrilir',
      'Yük kitabının sütunlarında görünür'],
    ['Tasarım yük durumları ve ivme süpürmeleri', 'Aynı çeviri', 'Rapor ve Sonuçlar'],
    ['Tork durumları', 'Değişmez — tork yönü ayrı ayardır', _gmB('tork-yonu')]
  ], ['Ne', 'Nasıl', 'Nerede görünür']);
  h += _gmH3('Kaldırım darbesi', 'kaldirim');
  h += '<p>Kerb Strike L / R tekerleğin kaldırıma yandan çarpmasıdır. Büyüklüğü ve yönü '
    + 'yük kitabına göre değişir; Çözücü’nün <strong>Kaldırım darbesi</strong> bölümü '
    + _gmNS('cozucu', _GM_COZUCU, 'kaldirim') + ' ikisini ayrı tutar: <strong>İvme</strong> (varsayılan 1,55 g) ve '
    + '<strong>Yön</strong> — <em>Virajın tersi</em> (Kerb Strike L, Cornering Left’in ters işaretinde; '
    + 'varsayılan) ya da <em>Virajla aynı</em>.</p>';
  h += _gmH3('Tork yönü', 'tork-yonu');
  h += '<p>Tahrik torku güç grubuna X ekseni etrafında bir <strong>reaksiyon momenti</strong> '
    + 'olarak etkir: T<sub>x</sub> = ±T<sub>mil</sub>. İşareti aracın gidiş yönünden değil, '
    + '<strong>krankın modeldeki dönüş yönünden</strong> ve aktarmanın dönüşü çevirip '
    + 'çevirmediğinden gelir. Çözücü’nün <strong>Tork yönü</strong> ayarı ileri vites '
    + 'momentinin yönüdür; geri viteste moment kendiliğinden ters döner.</p>';
  h += _gmAlanTablo('Tork yönü', [
    ['−X (varsayılan)', 'Krank önden bakınca saat yönünde, motorun önü −X’te, çıkış krankla aynı yönde',
      'İleri viteste +Y tarafındaki takozlar basar'],
    ['+X', 'Motorun önü +X’te ya da güç grubundaki aktarma (iki dişlili transfer) dönüşü çeviriyor',
      'İleri viteste −Y tarafındaki takozlar basar']
  ], ['Seçim', 'Ne zaman', 'Etkisi']);
  h += _gmNot('Örneklerin ayarı',
      'Tulga örneği ileri −X, tork yönü +X ve varsayılan kaldırım darbesiyle; BMC SİPER örneği '
    + 'ileri +X, tork yönü −X ve 3,5 g virajla aynı yönde kaldırım darbesiyle gelir: ikisi de '
    + 'kendi Adams analizinin yük kitabıdır.');
  return h;
}

function _gmSec11(){
  var h = _gmH2('m11');
  h += '<p><strong>Çözücü</strong> bileşenine çift tıklayın. Pencere beş bölümü alt alta taşır; '
    + 'sağ sütunda ön denetim ve <strong>Hesapla</strong> düğmesi (' + _gmS('cozucu') + '). Pencere '
    + 'sonucu göstermez — sonuç Sonuçlar sayfasında ve raporda (' + _gmB('rapor') + ').</p>';
  h += _gmAlanTablo('Çözücü penceresi — bölümler', [
    [_gmN(_GM_COZUCU, 'eksen') + ' Araç ekseni', 'İleri yön ve tork yönü: −X · +X',
      'Yük kitabı hemen değişir (' + _gmB('ileri') + ' · ' + _gmB('tork-yonu') + ')'],
    [_gmN(_GM_COZUCU, 'kaldirim') + ' Kaldırım darbesi', 'Yanal ivme (g) ve yönü: virajın tersi · virajla aynı',
      'Kerb Strike L / R satırları (' + _gmB('kaldirim') + ')'],
    [_gmN(_GM_COZUCU, 'kitap') + ' Yük kitabı', 'Çözülecek durumlar, ivme (n) ve tork (T)',
      'Modelin girdisinden; tork durumları tork girildiyse'],
    [_gmN(_GM_COZUCU, 'yontem') + ' Yöntem', 'Çözüm modu, sönüm oranı ζ', 'Bir sonraki Hesapla’da uygulanır'],
    [_gmN(_GM_COZUCU, 'sok') + ' Şok darbesi', 'Yarım sinüs darbenin tepe ivmesi (g) ve süresi (ms)',
      'Bir sonraki Hesapla’da uygulanır']
  ], ['Bölüm', 'Ne', 'Not']);
  h += _gmAdimlar([
    _gmN(_GM_COZUCU, 'yontem') + ' <strong>Yöntem</strong> bölümünde çözüm modunu seçin; sönüm oranı ve şok '
      + 'darbesi varsayılan değerleriyle durur (yanındaki <em>i</em> kaynağını söyler).',
    'Sönüm oranı yalnız şok ve izolasyon hesabına girer, sehime girmez; her takozun viskoz sönüm '
      + 'katsayısı ondan türer: c = 2ζ√(k<sub>din</sub>·m<sub>pay</sub>).',
    _gmN(_GM_COZUCU, 'hesapla') + ' <strong>Hesapla</strong> düğmesine basın — ilerleme düğmenin solundaki '
      + 'çubukta akar: çözülen yük durumu, sırası ve oranı.',
    _gmN(_GM_COZUCU, 'not') + ' Hesapla’nın solundaki not toplam kütleyi, gövde ve takoz sayısını ve son '
      + 'hesabın güncel olup olmadığını söyler; sonucu <strong>Rapor</strong> bileşeninden okuyun.'
  ]);
  h += _gmUyari('Çekme, durdurucu ve yakınsamama raporda bir hükümdür',
      'Raporun yük durumu tabloları <strong>çekme</strong> (bir takoz çekiye giriyor), '
    + '<strong>durdurucu teması</strong> ve <strong>doğrusal aralık aşımı</strong> işaretlerini, '
    + '<strong>yakınsamama</strong> ve <strong>f ≈ 0 modu</strong> uyarılarını taşır. Bunlar '
    + 'hata değil, modelin bulgularıdır.');
  h += _gmNot('Sonuç eski modelin olabilir',
      'Hesaptan sonra modelde bir alan değişirse Çözücü ve Rapor son hesabın güncel olmadığını '
    + 'işaretler: raporun sayıları eski modelin olur. Adı değiştirmek sonucu etkilemez — '
    + 'ad fiziğe girmez. Yeniden <strong>Hesapla</strong>’ya basın.');
  return h;
}

function _gmSec12(){
  var h = _gmH2('m12');
  h += '<p>Her yük durumu için çözülen şey <strong>q</strong> vektörüdür: güç grubunun '
    + 'ortak CG’sinin üç ötelenmesi (mm) ve üç dönmesi (derece). Değerler raporun yük durumu '
    + 'tablolarındadır (' + _gmB('rapor') + ').</p>';
  h += _gmAlanTablo('Sehim sonuçları', [
    ['q<sub>x</sub> · q<sub>y</sub> · q<sub>z</sub>', 'CG’nin ötelenmesi, mm',
      'Statik durumda z genellikle en büyüğüdür'],
    ['θ<sub>x</sub> · θ<sub>y</sub> · θ<sub>z</sub>', 'Roll · pitch · yaw dönmesi, derece',
      'Tork durumlarında roll belirgin büyür'],
    ['Takoz kuvvetleri', 'Her takozda üç eksenli kuvvet, N',
      'İşaret yönü verir: negatif z basma, pozitif z <strong>çekme</strong>'],
    ['Kuvvet dengesi', 'Σ F ≈ dış kuvvet', 'Sıfıra yakın olmalı — çözümün iç denetimi'],
    ['Kapasite kullanımı', 'Takoz başına %', 'Kapasite girildiyse']
  ], ['Büyüklük', 'Ne', 'Nasıl okunur']);
  h += _gmUyari('Çekme bir tasarım uyarısıdır',
      'Elastomer takozlar basmada çalışmak üzere tasarlanır. Bir takozun düşey kuvveti '
    + '<strong>çekiye</strong> dönüyorsa (gövde o köşeden kalkıyorsa) takoz ya kopar ya da '
    + 'ömrü kısalır. Raporun <em>Çekme / lift-off</em> satırı çekiye giren yük durumlarını '
    + 'adıyla yazar. Genellikle çare takozu yeniden konumlandırmaktır, rijitliği büyütmek '
    + 'değil.');
  h += _gmNot('Kuvvet dengesi çözümün kendi denetimidir',
      'Takoz kuvvetlerinin toplamı, uygulanan dış kuvvete eşit olmak <strong>zorundadır</strong> '
    + '— denge denkleminin kendisi. Artık rapora yazılır; sıfırdan belirgin farklıysa çözüm '
    + 'yakınsamamıştır.');
  return h;
}

function _gmSec13(){
  var h = _gmH2('m13');
  h += '<p>Modal analiz, güç grubunun <strong>dinamik rijitlikle</strong> hesaplanan altı '
    + 'rijit gövde modunu verir. Her mod bir frekans ve bir biçimden oluşur.</p>';
  h += _gmAlanTablo('Mod etiketleri', [
    ['bounce', 'Ağırlıklı olarak düşey öteleme', 'Genellikle en düşük üç modun içinde'],
    ['roll', 'Boyuna eksen etrafında dönme',
      'Tahrik torkunun uyardığı mod — en kritik olanı budur'],
    ['pitch', 'Yanal eksen etrafında dönme', ''],
    ['yaw', 'Düşey eksen etrafında dönme', ''],
    ['fore-aft · lateral', 'Boyuna ve yanal öteleme', ''],
    ['Karma etiketler', 'İki hareket birlikte (örn. <em>pitch+bounce</em>)',
      'Modlar saf değilse etiket ikisini de yazar']
  ], ['Etiket', 'Ne anlatır', 'Not']);
  h += _gmH3('İzolasyon', 'izolasyon');
  h += '<p>Takozun işi motorun ateşleme titreşimini şasiden yalıtmaktır. Klasik kural: '
    + 'iletim oranının 1’in altına inmesi için <strong>uyarma frekansı, doğal frekansın '
    + '√2 katından büyük</strong> olmalıdır. Pratikte hedef genellikle '
    + '<strong>f<sub>ateşleme</sub> / f<sub>en yüksek mod</sub> ≥ 2,5–3</strong>’tür.</p>';
  h += _gmNot('Ateşleme frekansı',
      'Dört zamanlı bir motorda ateşleme frekansı <em>f = devir × silindir sayısı / 120</em>’dir. '
    + 'Rölanti devri en kritik durumdur: orada uyarma frekansı en düşüktür ve modlara en çok '
    + 'yaklaşır.');
  h += _gmUyari('f ≈ 0 çıkan bir mod modelin serbest kaldığını söyler',
      'Altı modun biri sıfıra çok yakınsa güç grubu o serbestlik derecesinde '
    + '<strong>kısıtlanmamıştır</strong> — genellikle takozlar tek bir düzlemde ya da tek bir '
    + 'doğru üzerinde dizilmiştir. Sonuç sayısal olarak üretilir ama fiziksel değildir; '
    + 'takoz yerleşimine dönün.');
  h += _gmH3('Duyarlılık — hangi takoz hangi modu oynatıyor', 'duyarlilik');
  h += '<p>Her takozun her ekseni için <strong>esneklik</strong> verilir: o rijitlik %1 '
    + 'artınca modun frekansı yüzde kaç artar. Esneklik, yayın o moddaki şekil değiştirme '
    + 'enerjisi payının yarısıdır; her modda bütün takoz ve eksenlerin toplamı 0,5’tir. Bir '
    + 'yayın sertleşmesi hiçbir frekansı düşürmez.</p>';
  h += '<p>Duyarlılık raporun <strong>§8.17</strong> bölümündedir: takoz ve eksen başına altı '
    + 'moddaki esneklik matrisi (kalın hücre modun en etkili kaldıracı) ve frekans kriterlerinin '
    + 'kaldıraçları — tek kaldıraçla sınıra kadar yüzde kaç, yeniden çözülerek.</p>';
  h += _gmNot('Esneklik bir eğimdir',
      'Küçük değişimde doğrudur. İki mod birbirine 0,5 Hz’ten yakınsa rijitlik değişince '
    + 'birbirinden kaçarlar ve eğim çabuk değişir; büyük değişimde raporun kaldıraç tablosundaki '
    + 'yeniden çözülmüş değeri okuyun. Statik sehim bu hesaba girmez: yumuşatılan takozun sehimi artar.');
  h += _gmH3('Frekans yanıtı ve Campbell diyagramı', 'frf');
  h += '<p>Frekans yanıtı ve Campbell diyagramı Sonuçlar sayfasında (' + _gmS('sonuclar') + ') ve raporda '
    + 'durur. <strong>İletilebilirlik</strong> T, şasiye geçen kuvvetin motor kuvvetine oranıdır: '
    + 'T = 1 azalma yok, T &lt; 1 izolasyon. İzolasyon verimi (1 − T) × 100’dür ve rezonansta '
    + '(T &gt; 1) eksiye iner. Sönümsüz sistemin tepesi rezonansta sınırsızdır: çizilen sönümsüz '
    + 'tepe yüksekliği frekans örneklemesine bağlıdır, tepeyi yalnız sönüm sınırlar.</p>';
  h += '<p><strong>Takoz başına iletilebilirlik</strong> her takozun şasiye geçirdiği kuvvettir. '
    + 'Tepe frekansları bütün takozlarda ortaktır: tepeler takoza değil, yapının modlarına '
    + 'aittir. Takoz eğrilerinin aritmetik toplamı sistem eğrisini vermez: kuvvetler genlik ve faz '
    + 'taşır, toplam vektöreldir; zıt fazlı iki takozda tekil genlikler büyük, sistem toplamı küçük çıkar.</p>';
  h += '<p><strong>Campbell diyagramında</strong> eğik çizgiler motorun uyarma mertebeleridir '
    + '(frekansları devirle büyür), yatay çizgiler güç grubunun doğal frekanslarıdır. İkisinin '
    + 'kesiştiği devirde motor o modu tam frekansından besler. Çalışma bandının altındaki kesişimler '
    + 'yalnız kalkış ve durmada geçilir; bandın içindekiler motor o devirde çalıştıkça sürer.</p>';
  return h;
}

function _gmSec14(){
  var h = _gmH2('m14');
  h += '<p><strong>Rapor</strong> bileşeni çevrimdışı, tek dosyalık bir HTML rapor üretir: '
    + 'teori bölümleri, modelin künyesi, bütün yük durumları, takoz kuvvetleri, modal sonuçlar '
    + 've uygunluk hükmü (' + _gmS('rapor') + ').</p>';
  h += _gmAdimlar([
    'Önce modeli <strong>çözün</strong> — rapor bir sonuç belgesidir ve çözümsüz üretilmez.',
    'Rapor bileşenine çift tıklayın (' + _gmS('rapor-p') + '): ' + _gmN(_GM_RAPOR_P, 'cozum') + ' <strong>Çözüm</strong> '
      + 'bölümü raporun hangi çözümden üretileceğini, ' + _gmN(_GM_RAPOR_P, 'frekans') + ' <strong>Frekans '
      + 'yerleşimi ve izolasyon</strong> bölümü raporun §8.8’indeki girdilerin (rölanti devri, '
      + 'silindir sayısı, ζ) nereden geldiğini gösterir; çözümün güncel olup olmadığı sağ '
      + 'sütunda, düğmenin üstündedir. Uygunluk hükmü raporun kendisinde.',
    _gmN(_GM_RAPOR_P, 'indir') + ' <strong>Raporu oluştur ve indir</strong>. Dosya tek başına açılır; internet '
      + 'gerekmez. Raporun “Motor Takozu Uygunluğu” bölümü ' + _gmNS('rapor', _GM_RAPOR, 'uygunluk')
      + ' kriterlerin hükmünü taşır.'
  ]);
  h += '<p>Şanzımanın <strong>Bağlantı yüzü</strong> tanımlıysa raporun <strong>§8.18</strong> bölümü güç grubunu '
    + 'o düzlemde keser: düzlemin şanzıman tarafındaki kütlelerin yükü ve takoz kuvvetlerinin bağlantı '
    + 'yüzünün merkezine göre momenti, eksene dik bileşeni <strong>eğilme momenti</strong>, eksen boyunca '
    + 'bileşeni burulmadır. Tablo torksuz bütün yük durumlarını verir; tork durumları tabloda yoktur. '
    + 'Sınır statik duruma uygulanır ve uygunluk tablosunun 5. satırıdır. Şanzıman tarafında takoz yoksa '
    + 'moment konsolunkidir: şanzımanın ağırlığı × ağırlık merkezinin bağlantı yüzüne uzaklığı.</p>';
  h += '<p>Güç grubunun <strong>hareket zarfı</strong> raporun <strong>§8.19</strong> bölümündedir: her gövdenin ağırlık '
    + 'merkezi ve eşdeğer kutusunun köşeleri bütün yük durumlarında, vites durumlarında ve tasarım yük koşullarında '
    + 'statik konuma göre ne kadar yer değiştiriyor — ±X, ±Y, ±Z, belirleyen nokta ve durumla. Aynı bölümde '
    + '<strong>takoz sehim zarfı</strong> vardır: her takozun her eksendeki en küçük ve en büyük sehimi, yüksüz konumdan.</p>';
  h += _gmUyari('Rapor çözümün fotoğrafıdır',
      'Rapor üretildikten sonra değişen alan rapora <strong>girmez</strong>. Değişiklik için '
    + 'yeniden çözün ve raporu yeniden üretin.');
  return h;
}

function _gmSec15(){
  var h = _gmH2('m15');
  h += '<p><strong>Takoz Başlangıç Sihirbazı</strong> modeli beş adımda kurar: girdiler sağda, '
    + 'model ortadaki önizlemede adım adım dolar (' + _gmS('sihirbaz') + '). Sihirbaz başlangıç '
    + 'sayfasının <strong>Sihirbazla kur</strong> seçeneğiyle ' + _gmNS('baslangic', _GM_BASLANGIC, 'sihirbaz') + ' ya da '
    + 'tuvaldeki <strong>Başlangıç Sihirbazı</strong> bileşenine ' + _gmNS('tuval', _GM_TUVAL, 'sihirbaz') + ' tıklayarak açılır.</p>';
  h += _gmEkran('sihirbaz', 'sihirbaz', _GM_SIHIRBAZ, 'Sihirbazın ilk adımı, BMC Siper örneğiyle doldurulmuş.');
  h += _gmAlanTablo('Sihirbazın adımları', [
    ['1 · Başlangıç', 'Modelin kaynağı: ' + _gmN(_GM_SIHIRBAZ, 'step') + ' STEP dosyası, '
      + _gmN(_GM_SIHIRBAZ, 'ornek') + ' kayıtlı bir örnek ya da boş başlangıç', 'Örnek bütün adımları doldurur'],
    ['2 · Kütle gövdeleri', 'Gövde başına tip, kütle, ağırlık merkezi ve atalet; nokta kütle',
      _gmB('govde')],
    ['3 · Takozlar', 'Takoz başına konum, katalogdan tip ya da statik ve dinamik rijitlik, kapasite',
      _gmB('takoz')],
    ['4 · Tork ve çalışma', 'Motor torku ve devirleri, rölanti, silindir sayısı; vites oranları, stall oranı, '
      + 'transfer oranı ve aks payı', _gmB('tork')],
    ['5 · Özet ve kurulum', 'Modelin özeti ve denetimi; <strong>Modeli kur</strong>', 'Kurulum tek geri-al adımıdır']
  ], ['Adım', 'Ne girilir', 'Not']);
  h += _gmAdimlar([
    'Başlangıç sayfasında <strong>Sihirbazla kur</strong>’a basın.',
    'İlk adımda modelin kaynağını seçin: ' + _gmN(_GM_SIHIRBAZ, 'ornek') + ' <strong>Örnekten doldur</strong> '
      + 'listesinden bir örnek, ' + _gmN(_GM_SIHIRBAZ, 'step') + ' <strong>STEP’ten başla</strong> ile bir dosya '
      + 'ya da hiçbiri. Ekranda: önizleme dolar, ' + _gmN(_GM_SIHIRBAZ, 'durum') + ' çip modelin çözülüp '
      + 'çözülemediğini söyler.',
    _gmN(_GM_SIHIRBAZ, 'ileri') + ' <strong>İleri</strong> ile adımları sırayla doldurun. Soldaki '
      + _gmN(_GM_SIHIRBAZ, 'adimlar') + ' listede her adımın rozeti eksik sayısıdır; adıma tıklamak oraya '
      + 'gider.',
    'Her adımda listenin altındaki ' + _gmN(_GM_SIHIRBAZ, 'talimat') + ' talimatı izleyin: o adımda '
      + 'yapılacaklar sırayla, denetimler ekrandaki adıyla. ' + _gmN(_GM_SIHIRBAZ, 'eksikler')
      + ' <strong>Eksikler</strong> adımın eksik ve hatalı girdilerini sayısıyla listeler; eksik yoksa '
      + '<em>Eksik yok.</em> yazar.',
    'Son adımda <strong>Modeli kur</strong>’a basın. Ekranda: sihirbaz kapanır, model tuvale kurulur; '
      + 'Ctrl+Z kurulumu tek adımda geri alır.'
  ]);
  h += _gmNot('Önizlemenin bakışı',
      _gmN(_GM_SIHIRBAZ, 'gorunus') + ' <strong>3B · Üstten · Yandan · Önden</strong> önizlemenin bakışını '
    + 'değiştirir; sürüklemek döndürür, sağdaki düğmeler yakınlaştırır. Çipler parçaların adını ve '
    + 'kütlesini taşır; G birleşik ağırlık merkezidir.');
  return h;
}

// ═══ 16 — 3D GÖRÜNTÜLEYİCİ ════════════════════════════════════════════════
function _gmSec16(){
  var h = _gmH2('m16');
  h += '<p><strong>3D Görüntüleyici</strong> güç grubunun STEP dosyasını açar (CATIA çıktısı, AP214 ya da AP242; '
    + '.stp, .step, sıkıştırılmış .stpZ). Parçalara rol verilir; rol verilen birimlerin konumu, hacmi, ağırlık '
    + 'merkezi ve ataleti dosyanın geometrisinden ölçülür ve modelle karşılaştırılır. Sihirbazın '
    + '<em>STEP’ten başla</em> kartı aynı dosyayı, aynı rolleri ve aynı tabloları gösterir: dosya iki yerden '
    + 'açılır, rol birinde verilince ötekinde görünür.</p>';
  h += _gmH3('Dosyayı açmak', '3b-ac');
  h += '<p>Boş bir modelde başlangıç sayfasındaki <strong>STEP’ten başla</strong> ' + _gmNS('baslangic', _GM_BASLANGIC, 'step') + ' '
    + 'dosyayı doğrudan 3B’de okur: tuvale araçlar (3D Görüntüleyici dâhil) kurulur, 3B tam ekran açılır; '
    + 'okumanın çubuğu ve <strong>Vazgeç</strong> tuvalin sağ altındaki iş kartındadır. Roller ve hesap 3B’de '
    + 'verilir; <strong>Sihirbaza aktar</strong> sihirbazı takoz tipleri ve yükler için açar.</p>';
  h += _gmAdimlar([
    'Tuvaldeki <strong>3D Görüntüleyici</strong>’ye ' + _gmNS('tuval', _GM_TUVAL, 'goruntuleyici') + ' çift tıklayın; penceresinde '
      + '<strong>STEP dosyası seç…</strong>’e basın ya da dosyayı <strong>STEP dosyası</strong> bölümüne bırakın.',
    'Okunurken eylem satırında çubuk ve <strong>Vazgeç</strong> durur; okuma ekranı dondurmaz.',
    'Dosya okununca 3B tam ekran açılır (' + _gmS('3b') + '). Dosyada henüz rol yoksa tuvalin sol üstünde '
      + '<strong>Hızlı atama</strong> kartı açılır ve rolleri sırayla sorar (' + _gmB('3b-hizli') + ').',
    _gmN(_GM_3B, 'kapat') + ' <strong>Kapat</strong> ya da Esc yalnız 3B’yi kapatır; pencerenin '
      + '<strong>3B’de aç</strong> düğmesi yeniden açar.'
  ]);
  h += _gmEkran('3b', '3b', _GM_3B, '3B görüntüleyici: motor bloğu seçili, roller verilmiş, hesap yapılmış.');
  h += _gmAlanTablo('3D Görüntüleyici penceresi — bölümler', [
    ['<strong>STEP dosyası</strong>', 'Dosyanın künyesi: yazan sistem, parça sayısı, okuma süresi; kayıtlı '
      + 'rollerin durumu', 'Dosya açık değilken <strong>Kayıtlı roller</strong> föyü'],
    ['<strong>Parçalar</strong>', 'Parça ağacı ve rolleri; <strong>Hesapla</strong>; uyarılar',
      'Ağaç kapalı açılır, dal dal açılır; rollü düğüm dal kapalıyken de görünür'],
    ['<strong>Kütle</strong>', 'Gövde başına hacim, kütlenin kaynağı, kütle ve atalet', 'Hesaptan sonra'],
    ['<strong>Model</strong>', 'Birimlerin modeldeki karşılığı, fark, kütle; öteleme; '
      + '<strong>Modele uygula</strong> · <strong>Dosyanın sistemine taşı</strong>', 'Hesaptan sonra']
  ], ['Bölüm', 'Ne', 'Not']);
  h += _gmAlanTablo('3B görüntüleyici — düzen', [
    [_gmN(_GM_3B, 'agac') + ' <strong>Ürün ağacı</strong>', 'Solda; başlığında dosyanın adı ve parça sayısı, altında arama alanı',
      'Seçim ağaçla 3B arasında ortak. 3B tam ekran; başlık bandı ve komut çubuğu yok, araçlar boşluğa sağ tıkta'],
    [_gmN(_GM_3B, 'kapat') + ' <strong>Kapat</strong>', 'Tuvalin sağ üst köşesinde', 'Esc de kapatır'],
    ['Kesit kartı', 'Tuvalin sol üstünde, kesit açıkken: eksen, konum, <strong>Ters</strong>', 'Kesit kapanınca kalkar'],
    [_gmN(_GM_3B, 'ozellikler') + ' <strong>Özellikler</strong>', 'Sağda; seçimin adı ve türü, özellik satırları '
      + '(<strong>Rol</strong>, atanmışsa <strong>Malzeme</strong>, takozun noktası, <strong>Motor modeli</strong> ve '
      + 'referansı, katalog), birimin kütlesi ve CG’si, <strong>Birimler</strong> (role göre gruplu, açılır kapanır)',
      'Kapalı başlar: şerit açar, başlığındaki düğme daraltır; açıklık tarayıcıda saklanır. Satırlar seçime göre'],
    [_gmN(_GM_3B, 'eylem') + ' Eylem', '<strong>Özellikler</strong>’in dibinde, rol verilince; <strong>Hesapla</strong> ve '
      + '<strong>Sihirbaza aktar</strong>, üstünde hesabın engeli ve rolün eksiği', 'Sıradaki adımın düğmesi dolu '
      + 'renkte; panel kapalıyken şeridin dibinde yalnız onun simgesi'],
    ['İş kartı', 'Tuvalin sağ altında; <strong>STEP okuma</strong> ve <strong>3B kurulumu</strong>: çubuk, '
      + '<strong>Vazgeç</strong> · <strong>Durdur</strong> · <strong>Devam</strong>', 'İş bitince kalkar'],
    [_gmN(_GM_3B, 'durum') + ' Durum çubuğu', 'İmlecin altındaki noktanın koordinatı; çizim yazılımsalsa durumu; birimler', 'mm · kg']
  ], ['Yer', 'Ne', 'Not']);
  h += _gmAlanTablo('3B görüntüleyici — işaretler', [
    ['Ağırlık merkezi', 'Dörde bölünmüş daire', 'Gövdenin ağırlık merkezi; parçanın içinde kalsa da görünür'],
    ['Takoz noktası', 'Takozun renginde artılı halka', 'Üst bağlantı yüzeyinin merkezi (' + _gmB('3b-nokta') + ')'],
    ['Modelin noktası', 'Kesikli halka', 'Tuvaldeki modelde aynı birim (' + _gmB('3b-model') + ')'],
    ['Referans noktası', 'Eşkenar dörtgen', 'Veri sayfasının referansı (' + _gmB('3b-veri') + ')'],
    ['Koordinat ekseni', 'Sol alt köşe', '+X arka · +Y sağ · +Z yukarı; eksi yönler soluk, kamerayla döner; yazılar fare üstündeyken'],
    ['Dönüş merkezi', 'Vurgu renginde nokta', 'Görünüm bu noktanın çevresinde döner; orta tıkla kurulunca ve döndürürken görünür']
  ], ['İşaret', 'Görünüş', 'Ne']);
  h += '<p>Boşluğa sağ tıkla açılan menü (' + _gmS('3b-menu') + ') görünümün komutlarını taşır: '
    + _gmN(_GM_3B_MENU, 'bakis') + ' <strong>Bakış</strong> (Ön · Arka · Sol · Sağ · Üst · Alt · İzometrik; model '
    + 'seçilen bakışta sığar, yakınlık tekerlekle), ' + _gmN(_GM_3B_MENU, 'gorunus') + ' <strong>Görünüş</strong> '
    + '(<em>Gölgeli ve kenar</em>, <em>Gölgeli</em> — kenar çizgisi yok, <em>X-ışını</em> — seçimin dışındaki parçalar '
    + 'saydam; içteki parçalar dıştakilerin arkasından görünür), ' + _gmN(_GM_3B_MENU, 'kesit') + ' <strong>Kesit</strong> '
    + '(montajı X, Y ya da Z düzlemiyle keser: ayarı tuvalin sol üstündeki kartta — kaydırıcı düzlemi taşır, '
    + '<strong>Ters</strong> öteki yanı bırakır, çarpı kesiti kapatır; kesilen yan çizilmez ve seçilmez).</p>';
  h += _gmEkran('3b-menu', '3b-menu', _GM_3B_MENU, 'Boşluğa sağ tık menüsü.', 260);
  h += _gmAlanTablo('3B görüntüleyici — seçim ve ölçü', [
    ['<strong>Parça</strong>', 'Tık parçayı seçer; rol ve ağaç bu seçimle', 'Olağan süzgeç'],
    ['<strong>Yüzey</strong>', 'Fare altındaki yüz açık vurgulanır, tık yüzü seçer; yüz önündeki parçaların '
      + 'ardında kalmaz, öteki parçalar soluklaşır; kartta yüzün tipi '
      + '(düzlem, silindir, koni, küre, tor), ölçüsü, normali ya da ekseni ve alanı', 'Tanım dosyadan, alan '
      + 'üçgen ağından (≈); parçanın seçimi değişmez'],
    ['<strong>Ölçü</strong>', 'İki tık arası uzaklık ve Δx · Δy · Δz; üçüncü tık yeni ölçü', 'Dairesel kenarda '
      + 'dairenin merkezi, yüzün köşesinde köşe, başka yerde yüzeydeki nokta'],
    ['Orta tık', 'Tıklanan nokta dönüş merkezi olur; görünüm noktayı tuvalin ortasına kaydırır, bakış ve ölçek aynı kalır',
      'Parçanın üstünde yüzeyin noktası; orta tuşla sürüklemek kaydırır'],
    ['Sağ tık', 'Parçada ya da ağacın satırında: <strong>Gizle</strong> · <strong>Göster</strong>, <strong>Yalnız bunu '
      + 'göster</strong>, <strong>Tümünü göster</strong>, <strong>Ağaçta göster</strong>, <strong>Seçime yakınlaştır</strong>, '
      + '<strong>Tümünü sığdır</strong>, <strong>Rol</strong>, <strong>Malzeme</strong>, <strong>Seçimi temizle</strong>',
      'Komut seçimin hepsine; gizli parça çizilmez, seçilmez, ağaçta soluk; sağ tuşla sürüklemek kaydırır'],
    ['Boşluğa sağ tık', '<strong>Tümünü göster</strong>, <strong>Tümünü sığdır</strong>, <strong>Bakış</strong>, '
      + '<strong>Görünüş</strong>, <strong>Arka plan</strong> (Stüdyo · Düz beyaz · Beyaz–mavi · Beyaz–sıcak · Açık gri '
      + 'geçiş), <strong>Seçim</strong> (Parça · Yüzey), <strong>Ölçü</strong>, <strong>Kesit</strong>, '
      + '<strong>Hızlı atama</strong>', 'Açık kip işaretli; arka plan tercihi bu tarayıcıda kalır']
  ], ['Araç', 'Ne', 'Not']);
  h += '<p>Esc önce ölçüyü, sonra yüzey süzgecini, sonra ağaçtaki aramayı kapatır. Ölçü ya da yüzey süzgeci açıkken parça '
    + '<strong>Ürün ağacı</strong>ndan seçilir.</p>';
  h += '<p>Seçilen parça kendi renginde, kenarları koyu çizilir; öteki parçalar tek kat soluk kalır. Hesaptan sonra '
    + 'her birimin işareti çizilir; etiketi yalnız fare birimin işaretinin, parçasının ya da satırının üstündeyken ve '
    + 'birim seçiliyken görünür. Etiket birimin adını ve konumunu taşır; adın önündeki nokta birimin rol rengindedir, '
    + 'seçili birimin etiketi vurgu renginde dolu.</p>';
  h += _gmH3('Hızlı atama', '3b-hizli');
  h += '<p>Dosyada ana rollerin (motor, şanzıman, transfer kutusu, takoz, braket) hiçbiri verilmemişse 3B '
    + 'açılınca tuvalin sol üstünde ' + _gmN(_GM_3B_HIZLI, 'kart') + ' <strong>Hızlı atama</strong> kartı açılır '
    + '(' + _gmS('3b-hizli') + '). Kart rolleri sırayla sorar: <strong>Motor</strong> → <strong>Şanzıman</strong> → '
    + '<strong>Transfer Kutusu</strong> → <strong>Takoz</strong> → <strong>Braket</strong>. 3B’de parçaya ya da '
    + 'ağaçta satıra tek tık ' + _gmN(_GM_3B_HIZLI, 'rol') + ' sorulan rolü verir.</p>';
  h += _gmAdimlar([
    'Kartın sorduğu gövdeye — motor, şanzıman, transfer kutusu — 3B’de ya da ağaçta tıklayın. Ekranda: '
      + 'satırın yanında ' + _gmN(_GM_3B_HIZLI, 'agacrol') + ' rol belirir, kart sıradaki role geçer. Aynı rol '
      + 'başka düğümdeyse oradan kalkar.',
    'Takoz adımında her takoza tek tek tıklayın: her tık bir tane ekler, ' + _gmN(_GM_3B_HIZLI, 'say')
      + ' sayaç seçili sayısını yazar; aynı takoza ikinci tık rolü kaldırır. Bitince '
      + _gmN(_GM_3B_HIZLI, 'ileri') + ' <strong>Sonraki</strong>’ye basın. Braket adımı aynıdır.',
    'Dosyada olmayan rolü ' + _gmN(_GM_3B_HIZLI, 'ileri') + ' <strong>Atla</strong> ile geçin; '
      + _gmN(_GM_3B_HIZLI, 'geri') + ' <strong>Geri</strong> önceki role döner.',
    _gmN(_GM_3B_HIZLI, 'bitir') + ' <strong>Bitir</strong> ya da Esc kartı kapatır. Sonra '
      + '<strong>Özellikler</strong>’in dibindeki <strong>Hesapla</strong> ile rollü birimleri ölçün ('
      + _gmS('3b') + ', ' + _gmN(_GM_3B, 'eylem') + ').'
  ]);
  h += _gmEkran('3b-hizli', '3b-hizli', _GM_3B_HIZLI, 'Hızlı atama: motor, şanzıman ve transfer kutusu '
    + 'verildi, Takoz adımında iki takoz seçili.');
  h += _gmNot('Kart açıkken',
      'Ctrl’li tık seçimdir, rol vermez. Yanlış verilen rol <strong>Özellikler</strong>’in <strong>Rol</strong> '
    + 'listesinden düzeltilir; kart açık kalır. Boşluğa sağ tık menüsündeki ' + _gmN(_GM_3B_MENU, 'hizli')
    + ' <strong>Hızlı atama</strong> (' + _gmS('3b-menu') + ') kartı yeniden açar.');
  h += _gmH3('Roller', '3b-rol');
  h += '<p>Rol bir düğüme verilir: 3B’de parçaya ya da soldaki ' + _gmN(_GM_3B, 'agac') + ' <strong>Ürün ağacı</strong>nda '
    + 'satıra tıklayıp ' + _gmN(_GM_3B, 'rol') + ' <strong>Özellikler</strong>’in <strong>Rol</strong> listesinden '
    + '(gruplu: Gövdeler · Takoz · Aktarma · Motor aksesuarları), sağ tık menüsünün <strong>Rol</strong> satırından ya '
    + 'da pencerenin ağacındaki satırın <strong>Rol</strong> listesinden. Ctrl (Mac’te ⌘) ile tıklanan '
    + 'düğüm seçime eklenir ya da seçimden çıkar; liste rolü seçimin hepsine verir. Alt montaja verilen rol bütün '
    + 'parçalarına geçer. Roller iç içe verilebilir: motor alt montajının içindeki takoz kendi biriminde sayılır, '
    + 'parça en yakın rollü atasının birimine girer; aynı rol iç içe verilmez. <strong>Hesapla</strong> '
    + 'yalnız rol verilen birimleri ölçer; rol değişince hesap yenilenir.</p>';
  h += '<p>Ürün ağacı pencerenin ağacıyla aynı dalları açık tutar. 3B’de seçilen parçanın dalı açılır ve satırı '
    + 'görünür olur; satırın üstüne gelince düğümün parçaları 3B’de vurgulanır, çift tık kamerayı düğüme sığdırır. '
    + _gmN(_GM_3B, 'ara') + ' Arama alanı bütün ağaçta adı ya da örnek adı arar (büyük-küçük harf ayırmaz); sonuç '
    + 'satırı düğümün atasını da yazar, tık düğümü seçer. Arama boşalınca seçili düğümün dalı açılır.</p>';
  h += _gmH3('Takoz noktası', '3b-nokta');
  h += '<p>Takozun noktası <strong>üst bağlantı yüzeyinin merkezidir</strong>: dosyada yazılı dairenin merkezi, '
    + 'CATIA’daki ölçümün aynısı. Program onu takozun ekseninden önerir. 3B’de takoz seçiliyken '
    + '<em>Daireden nokta</em> açılır; fare dairesel bir kenara gelince halka belirir, tıklanan dairenin '
    + 'merkezi takozun noktası olur. <em>Öneriye dön</em> seçimi kaldırır. Takozun ekseni bulunamazsa (dairesel '
    + 'kenar yok ya da eksen düşey değil) nokta takozun <strong>dış ölçülerinin merkezidir</strong>; ağırlık merkezi '
    + 'kullanılmaz, uyarı satırı sebebi söyler. Ağaçtaki <strong>Konum</strong> hücresinin ipucu kaynağı söyler: '
    + '<em>Üst yüz</em> (öneri), <em>Daire</em> (seçim) ya da <em>Dış ölçü merkezi</em>.</p>';
  h += _gmH3('Kütle, ağırlık merkezi ve atalet', '3b-kutle');
  h += '<p>Gövdenin hacmi, ağırlık merkezi ve ataleti parçaların <strong>katı gövdelerinden</strong> toplanır; '
    + 'yüzey gövdeleri hacme girmez, döküm içindeki boşluklar hacimden çıkar. Ağı kapalı olmayan katı gövdenin '
    + 'açıklığı kapatılır; kapatılan yüzey gövdenin yüzeyinin %10’unu aşmıyorsa gövde hacme katılır. Aşan gövde '
    + 've katısı olmayan açık parça (açık yüzey) hacme katılmaz; uyarı satırı adını, sebebini ve birim yüzeyindeki '
    + 'payını yazar. Dosya CATIA’nın '
    + 'doğrulama özelliklerini taşıyorsa parçanın hacmi ve ağırlık merkezi oradan alınır.</p>';
  h += _gmAlanTablo('Kütlenin kaynağı', [
    ['<em>Elle</em>', 'Veri sayfasındaki kütle', 'Ağırlık merkezi hacimden; atalet kütle yazılınca türer'],
    ['Malzeme', 'Birimin malzemesi (aşağıdaki liste): kütle = yoğunluk × hacim',
      'İçindeki parçaya başka malzeme atanmışsa o parça kendi yoğunluğuyla'],
    ['<em>Dosyadan</em>', 'Parçaların dosyadaki yoğunlukları; ağırlık merkezi kütleyle ağırlıklı',
      'Parçaların yoğunluğu dosyadaysa seçili gelir; yoğunluğu olmayan parçayı atanan malzeme tamamlar, atanan malzeme dosyanınkinin yerine geçer'],
    ['<em>Parçalardan</em>', 'Parçalara atanan malzemeler; ağırlık merkezi kütleyle ağırlıklı',
      'Bütün parçalara malzeme atanmışsa seçilir'],
    ['Motor modeli', 'Modelin veri sayfasındaki ıslak kütle',
      'Ağırlık merkezi ve atalet veri sayfasından (' + _gmB('3b-veri') + ')']
  ], ['Kaynak', 'Kütle', 'Not']);
  h += '<p>3B’de gövde seçiliyken <strong>Özellikler</strong>’in <strong>Kütle ve ağırlık merkezi</strong> bölümü '
    + 'kaynağı, kütleyi (<em>Elle</em> ise yazılır) ve CG’yi gösterir; takoz seçiliyken noktasını ve kaynağını. '
    + _gmN(_GM_3B, 'birimler') + ' <strong>Birimler</strong> listesi rol verilen birimleri gruplarıyla (Gövdeler · '
    + 'Braketler · Takozlar · Aktarma) taşır: grup başlığı sayıyı yazar ve tıkla açılır; seçili birimin grubu açıktır. '
    + 'Motorun aksesuarları motorun satırının altındadır. Satır kütleyi ve CG’yi (takozda noktayı) yazar, satırdaki '
    + 'çarpı rolü kaldırır. Bütün gövdelerin kütlesi biliniyorsa listenin başında toplam kütle ve ortak CG; kütlesi '
    + 'eksik gövde varken toplam yazılmaz.</p>';
  h += '<p><strong>Malzeme ataması.</strong> Malzeme yalnız istenen parçaya verilir: 3B’de ya da ürün ağacında '
    + 'parçaya veya alt montaja sağ tık, <strong>Malzeme</strong> satırından malzeme — seçimin hepsine. Takoz, motor ve '
    + 'şanzıman malzeme almaz (kütleleri başka yoldan). Parça birimin içindeki en yakın atamayı alır, ataması yoksa '
    + 'birimin malzemesini. <strong>Özellikler</strong>’in <strong>Malzeme</strong> satırı yalnız atanmış ya da '
    + 'devralınan malzemede görünür: <em>üstten</em> (atanmış alt montaj), <em>birimden</em> (birimin kaynağı); '
    + 'kendi ataması varsa yanında kaldırma düğmesi. Hesaptan sonra birimin kendisi seçiliyken malzeme '
    + '<strong>Kütle ve ağırlık merkezi</strong> bölümünün <strong>Kaynak</strong> listesinden de seçilir '
    + '(Elle · Dosyadan · Parçalardan · malzemeler · katalog); malzemede kütle hacim × yoğunluk. '
    + 'Atanan malzeme ürün ağacında satırın yanında görünür ve rollerle birlikte projeye kaydedilir; rol '
    + 'değişince düğümün malzemesi kalır.</p>';
  h += _gmAlanTablo('Malzemeler', (typeof VE_MNT_STP_MALZEME !== 'undefined' ? VE_MNT_STP_MALZEME : []).map(function(m){
    return [m.ad, m.sinif, veSayi(m.rho, 0)];
  }), ['Malzeme', 'Sınıf', 'Yoğunluk [kg/m³]']);
  h += _gmNot('CATIA’da doğrulama özellikleri',
      'STEP ayarlarında <em>Validation Properties</em> açılıp <em>Geometric Validation Properties</em> '
    + 'işaretlenince dosya her katının hacmini, alanını ve ağırlık merkezini taşır; program parçanın hacmini '
    + 've ağırlık merkezini bu sayılardan alır. Parçalara malzeme atanmışsa ve dışa aktarım yoğunluğu da '
    + 'yazıyorsa <em>Dosyadan</em> kaynağı açılır.');
  h += _gmH3('Veri sayfası: motor ve şanzıman', '3b-veri');
  h += '<p>Motorun ve şanzımanın veri sayfası ağırlık merkezini bir <strong>referanstan</strong> verir: motorda '
    + 'bloğun ön yüzünden (X12’de arka yüzünden) krank ekseni boyunca ve krank ekseninin üstüne. Referansın '
    + 'yeri STEP dosyasından alınır: referans noktası krank ekseninin referans yüzünün düzlemini kestiği '
    + 'noktadır, ağırlık merkezi bu noktaya veri sayfasındaki uzaklıklar eklenerek bulunur. Boy, seçilen '
    + 'yüzden birimin içine doğru ölçülür: yüzün dışa bakan tarafı veri sayfasının yüzü olmalıdır (ön yüz öne, '
    + 'arka yüz arkaya bakar). Veri sayfası yanal kaçıklık veriyorsa artı yönü motorun sağıdır, önden bakınca. '
    + 'Uzaklıklar ve atalet (roll, pitch, yaw) motorun kendi eksenlerindedir; motor eğik takılıysa ağırlık '
    + 'merkezi ve atalet tensörü o açıyla döner.</p>';
  h += _gmAdimlar([
    '3B’de motor birimini seçin; <strong>Özellikler</strong>’in <strong>Motor modeli</strong> listesinden modeli seçin. Aynı '
      + 'liste <strong>Kütle</strong> bölümünün <strong>Kaynak</strong> sütunundadır.',
    'Referans yüzünün düğmesine (<em>Bloğun ön yüzü</em> ya da <em>Bloğun arka yüzü</em>) basın ve düzlem '
      + 'yüzü tıklayın: fare düzlem bir yüze gelince yüz Yüzey süzgecindeki gibi vurgulanır, parçası odakta '
      + 'kalır ve yüzün konumu belirir. Seçim yalnız birimin parçalarındadır; kamera birime sığar.',
    '<em>Krank ekseni</em>’ne basın ve krankla eş eksenli silindir bir yüzü ya da dairesel bir kenarı (krank '
      + 'kasnağı, volan muhafazası) tıklayın; silindirde eksen yüzün sınır çemberinden alınır. Bu seçim bütün '
      + 'parçalarda yapılır: kasnak motor biriminin dışında olabilir.',
    '<strong>Hesapla</strong>: ağırlık merkezi, atalet ve kütle (ıslak) veri sayfasından. '
      + 'Motorun aksesuarları ayrı bileşen olarak girilir (' + _gmB('3b-aksesuar') + ').',
    'Gerçek kütle biliniyorsa <strong>Kütle ve ağırlık merkezi</strong> bölümünün <strong>Kaynak</strong> '
      + 'listesinden <em>Elle</em> seçilir ve kütle yazılır: ağırlık merkezi veri sayfasının referansından kalır, '
      + 'atalet kütleyle ölçeklenir.'
  ]);
  h += '<p>İki referanstan biri eksikse ağırlık merkezi hacimden bulunur ve uyarı satırı eksik referansın adını '
    + 'yazar. Hesaptan sonra 3B’de eksenin dairesi halka, referans noktası işaret olarak çizilir. Ağırlık '
    + 'merkezi veri sayfasından gelen gövde <strong>Model</strong> bölümünde işaretli gelir.</p>';
  h += '<p>Şanzımanda veri sayfası bir <strong>ailedir</strong>: listede tek satır (<em>Allison 4000</em>), modeli '
    + 'seçenekler belirler. Seçenekler 3B’nin <strong>Özellikler</strong>’inde modelin altında ve kartın '
    + '<strong>Kütle</strong> tablosunda şanzımanın satırının altında durur. Kütle toplanır: belgenin kuru '
    + 'kütleleri ve çıkış flanşı kuru kütleyi, yağ (ilk dolum hacmi × yoğunluk) ıslak kütleyi verir; uzak '
    + 'soğutucu şasidedir, gövdeye girmez. Ağırlık merkezi ve atalet seçeneklerin satırından okunur: '
    + 'konvertör muhafazasının ön yüzünden eksen boyunca arkaya (X), eksenin altına (Y) ve sağa (Z). '
    + 'Bağdaşmayan seçenek listede kapalıdır, sebebi ipucundadır; bir seçenek ötekini geçersiz kılarsa '
    + 'öteki ilk geçerli değerine döner. Birimin <strong>Kütle ve ağırlık merkezi</strong> bölümü kuru '
    + 'kütleyi ve yağı ayrıca yazar.</p>';
  h += '<p>Aile listeden seçilince ailenin belgesi tuvalin üstünde açılır (<em lang="en">4000 Product Family '
    + 'Transmission Data</em>, 15.10.2020): kuru kütleler (8.0), ağırlık merkezi (9.0), atalet (11.0), vites '
    + 'oranları (12.0), yağ (13.0) ve soğutucuların sayfaları (17.3–17.8, resimleriyle). Sayfa belgenin '
    + 'kendisidir; seçilebilen her maddenin solunda bir işaret vardır (vites oranları tablosunda sütunun '
    + 'başlığının altında): birbirini dışlayan maddelerde yuvarlak, ötekilerde onay kutusu. İşarete ya da '
    + 'satıra tık o seçenekleri yazar: ağırlık merkezi tablosunun satırı bağlamayı, retarderi, PTO’yu ve '
    + 'soğutucuyu birlikte, vites oranları tablosunun sütunu vites konfigürasyonunu, soğutucunun sayfası '
    + 'soğutucuyu. Tabloların başlık satırları (bağlama; retarder ve PTO) yalnız seçimi gösterir. Seçimin '
    + 'maddeleri işaretli ve hafif vurguludur. Yuvarlak işaretli maddelerden biri hep seçilidir; başka biri '
    + 'seçilince öteki düşer. <em lang="en">Retarder Option</em> seçiliyken retarderin iki soğutucusundan biri '
    + 'zorunludur: ikisi <em lang="en">Retarder Option</em>’a çizgiyle bağlıdır, çizgi o seçiliyken vurguludur. '
    + 'İşaretli onay kutusuna tık seçimi kaldırır — en özel seçenek varsayılanına döner (akümülatörü kaldırmak '
    + 'retarderi bırakır, retarderi kaldırmak soğutucuyu <em lang="en">Remote</em>’a döndürür); uzak soğutucunun '
    + 'sayfaları varsayılandır, kaldırılmaz. Fare bir maddenin üstündeyken o tıkla seçime girecek öteki maddeler '
    + 'vurgulanır, seçimden düşeceklerin işareti boşalır. Bağdaşmayan madde kapalıdır, sebebi ipucundadır '
    + '(<em lang="en">7-Speed</em>’de altı vitesin tabloları). Özellikler yanda açık kalır ve seçimle birlikte değişir. '
    + '<strong>Özellikler</strong>’in <strong>Belge</strong> satırı belgeyi yeniden açar; başka bir birim '
    + 'seçilince, Esc’le ya da <strong>Kapat</strong>’la tuvale dönülür. Ctrl + tekerlek ve bandın düğmeleri '
    + 'yakınlaştırır.</p>';
  var A4 = typeof VE_MNT_A4K !== 'undefined' ? VE_MNT_A4K : null;
  if(A4) h += _gmAlanTablo(A4.ad + ' seçenekleri', A4.secenek.map(function(o){
    var etki = { dizi:'Temel kuru kütle ' + _gmF(A4.kutle.temel.cr, 0) + ' / ' + _gmF(A4.kutle.temel.wr, 0) + ' / '
                   + _gmF(A4.kutle.temel['7'], 0) + ' kg; ağırlık merkezi ve atalet tablosu; vites oranları (listenin altında)',
                 bag:'<span lang="en">Remote mount</span> ' + _gmF(A4.kutle.uzak, 0) + ' kg (6 vitesliye arka braket ' + _gmF(A4.kutle.uzakArka6, 0)
                   + ' kg); ağırlık merkezi tablosu; bağlantı yüzü yalnız <span lang="en">Direct mount</span>’ta',
                 pto:_gmF(A4.kutle.pto, 0) + ' kg; ağırlık merkezi, atalet, yağ (+3 L)',
                 ret:_gmF(A4.kutle.ret, 0) + ' kg; ağırlık merkezi ve atalet',
                 sog:'Standart ' + _gmF(A4.kutle.sog.s, 0) + ' kg · yüksek kapasite ' + _gmF(A4.kutle.sog.y, 0)
                   + ' kg · retarder/karter ' + _gmF(A4.kutle.sog.r, 0) + ' kg; ek yağ',
                 kar:'Yağın hacmi (7-Speed’e yalnız derin)',
                 aku:'Akümülatör ' + _gmF(A4.kutle.aku, 1) + ' kg + solenoid ' + _gmF(A4.kutle.akuSol, 1) + ' kg; ek yağ '
                   + _gmF(A4.yag.aku, 1) + ' L',
                 flans:'Kuru kütleye eklenir; belge 5–12 kg verir',
                 yag:'Yağın kütlesi' }[o.k] || '';
    var deg = o.d ? o.d.map(function(e){ return _gmE(e[1]); }).join(' · ')
      : _gmF(o.min, 2) + '–' + _gmF(o.max, 2) + ' ' + _gmE(o.birim) + ' (varsayılan ' + _gmF(o.vars, 2) + ')';
    return ['<strong>' + _gmE(o.ad) + '</strong>', deg, etki];
  }), ['Seçenek', 'Değerler', 'Etkisi']);
  var kat = typeof VE_MNT_VERI_SAYFASI !== 'undefined' ? VE_MNT_VERI_SAYFASI : [];
  if(kat.length) h += _gmAlanTablo('Veri sayfaları', kat.map(function(v){
    return [v.uretici + ' ' + v.ad + ' <em>' + _gmE(v.konfig) + '</em>',
      (v.kutle.kuru != null ? _gmF(v.kutle.kuru, 0) + ' / ' + _gmF(v.kutle.islak, 0) + ' kg (kuru / ıslak)'
        : _gmF(v.kutle.islak, 0) + ' kg (ıslak)') + ' · ' + _gmE(v.ref.yuz) + ': '
        + _gmF(v.cg.boy, 0) + ' mm · ' + _gmE(v.ref.eksen) + ': ' + _gmF(v.cg.yukari, 0) + ' mm üstü'
        + (v.cg.yan != null ? ' · yanal ' + _gmF(v.cg.yan, 0) + ' mm' : '') + ' · atalet '
        + _gmF(v.atalet.x, 1) + ' / ' + _gmF(v.atalet.y, 1) + ' / ' + _gmF(v.atalet.z, 1) + ' kg·m²',
      _gmE(v.kaynak)];
  }), ['Model', 'Değerler', 'Kaynak']);
  h += _gmH3('Motorun aksesuarları', '3b-aksesuar');
  h += '<p>Aksesuar parçasına 3B’de kendi rolü verilir (<strong>Rol</strong> listesinin <em>Motor aksesuarları</em> grubu: Alternatör, Alternatör '
    + 'Braketi, Klima Kompresörü, Isı Sacı). Motor montajının '
    + 'içindeki parça kendi rolünü alınca motorun biriminden çıkar. Ağırlık merkezi parçanın <strong>orta '
    + 'noktasıdır</strong>: dosyadaki dış ölçülerinin merkezi. Kütle <strong>Kütle</strong> bölümünde '
    + 'yazılır, malzemeden bulunur ya da alternatör ve klima kompresöründe <strong>Katalog</strong> '
    + 'grubundan seçilir; atalet hesaplanmaz (nokta kütle). Teknik resim ağırlık merkezini veriyorsa '
    + 'değer modele uygulandıktan sonra bileşenin penceresinde yazılır.</p>';
  h += _gmH3('Model ile karşılaştırmak', '3b-model');
  h += '<p><strong>Model</strong> bölümü her birimi modeldeki karşılığıyla aynı satıra koyar: bileşenin adı, '
    + 'konum farkı (takozda nokta, gövdede ağırlık merkezi) ve kütle. Eşleme tip içinde, en yakın bileşenle '
    + 'yapılır. Dosyanın ve modelin referansı farklıysa aradaki <strong>öteleme</strong> takozlardan '
    + 'bulunur ve bölümün başında yazar; fark modelin sisteminde ölçülür.</p>';
  h += _gmAdimlar([
    'Uygulanacak satırları işaretleyin: takozlar ve ağırlık merkezi veri sayfasından gelen gövdeler işaretli '
      + 'gelir, öteki gövdeler gelmez.',
    '<strong>Modele uygula</strong>’ya basın: seçili satırların değerleri modelin sisteminde bileşenlere '
      + 'yazılır, değeri aynı olan alan değişmez. Ctrl+Z bütün uygulamayı tek adımda geri alır.',
    'Model dosyanın sistemine geçirilecekse <strong>Dosyanın sistemine taşı</strong>’ya basın: modelin bütün '
      + 'takoz noktaları ve ağırlık merkezleri öteleme kadar kayar. Göreli konumlar aynı kaldığı için çözüm '
      + 'değişmez.'
  ]);
  h += '<p>3B’de modelin noktaları CAD’in üstünde tel kafes işaretle çizilir: CAD noktası dolu, modelinki '
    + 'onun çevresinde. Sihirbazın kartında aynı tablo durur; tuvaldeki modelden açılan sihirbazda '
    + _gmN(_GM_3B, 'eylem') + ' <strong>Sihirbaza aktar</strong> mevcut bileşenlere yazar (rijitlik, braketler ve '
    + 'adlar yerinde), modelde olmayan birimi ekler. Sihirbaz STEP’ten kurulmuşsa aktarım durumu baştan kurar.</p>';
  h += _gmH3('Kayıt', '3b-kayit');
  h += '<p>Roller, kütle kaynakları, seçilen daireler ve veri sayfasının referansları projeyle kaydedilir; STEP '
    + 'dosyası kaydedilmez. Proje '
    + 'yeniden açılınca pencere kayıtlı rolleri <strong>Kayıtlı roller</strong> föyünde gösterir; aynı dosya '
    + 'seçilince roller parça yolundan geri gelir. Başka bir dosyanın kaydı, o dosyada rol verilene dek '
    + 'korunur.</p>';
  return h;
}

// ═══ 17 — PARAMETRİK ANALİZ: KATALOGDAN SEÇİM ════════════════════════════
// Kısıtların adı ve varsayılan sınırı çekirdekten (js/mount-katalog.js): kılavuz
// ile pencere aynı tablodan okur.
function _gmSec17(){
  var K = (typeof veMntKatalog !== 'undefined') ? veMntKatalog : require('./mount-katalog.js');
  var V = K.SINIR_VARSAYILAN;
  var h = _gmH2('m17');
  h += '<p><strong>Parametrik Analiz</strong> bileşeninin ilk analizi <strong>Katalogdan seçim</strong>dir: '
    + 'takoz gruplarına kütüphanedeki tipleri tek tek takar, her kombinasyonu Çözücü’nün çözüm yolundan '
    + 'geçirir ve kısıtları sağlayanlar arasında iletilebilirlik ile statik sehim arasındaki dengeyi arar. '
    + 'Tarama bitince pencerenin <strong>Sonuç</strong> bölümü önerinin tiplerini, kriterlerin mevcut tasarımla '
    + 'karşılaştırmasını ve iki grafiği taşır; taramanın on diyagramı tam ekranda açılır; ayrıntılı rapor ayrı '
    + 'bir belgedir (<em>takoz_katalogdan_secim.html</em>). Bileşen <strong>Bileşenler</strong> sütunundan tuvale '
    + 'sürüklenir (' + _gmS('palet') + ', ' + _gmN(_GM_PALET, 'parametrik') + ').</p>';
  h += _gmSahne('parametrik', _gmPencere('mnt-parametric', { tut: ['Gruplar'] }),
    'Parametrik Analiz penceresi, örnek modelde: gruplar ve tarama.', null, _GM_PARAM);
  h += _gmAlanTablo('Parametrik Analiz penceresi', [
    [_gmN(_GM_PARAM, 'gruplar') + ' <strong>Gruplar</strong>', 'Sağ/sol çiftler ve tek takozlar, x konumu, mevcut tip (Takoz penceresinin listesindeki tip)',
      '“Tara” işareti kalkan grup modeldeki takoz verisiyle kalır'],
    ['<strong>Adaylar</strong>', 'Kütüphanenin bütün tipleri: gömülü, değiştirilmiş, özel',
      'İşareti kalkan tip hiçbir gruba takılmaz'],
    ['<strong>Kısıtlar</strong> (' + _gmS('param-kisit') + ')', 'Kesin kriterler (1 · 1a · 1b · 2), ek kısıtlar ve sınırları, amaç ağırlığı',
      'Kesin kriterler kapatılamaz'],
    [_gmN(_GM_PARAM, 'katalog') + ' <strong>Katalogdan seçim</strong>', 'Grup · tip · kombinasyon sayısı',
      'Kombinasyon = tip sayısı ^ taranan grup sayısı; üst sınır ' + _gmF(K.MAKS_KOMB, 0)],
    ['Sonuç', 'Öneri, kriterler, modlar, statik sehim ve iletilebilirlik, yakın seçenekler, eleme, '
      + 'diyagramların listesi; seçimin modele uygulanması, raporun indirilmesi', 'Yalnız taramadan sonra (' + _gmB('p-sonuc') + ')']
  ], ['Kısım', 'Ne', 'Not']);
  h += _gmH3('Gruplar', 'p-grup');
  h += '<p>Bir grubun takozları aynı tiptir. Adında tek bir yan sözcüğü (<em>sağ</em> ya da <em>sol</em>) bulunan '
    + 'iki takoz, o sözcük çıkınca kalan adları aynıysa çifttir: “Sağ Ön Takoz” ile “Sol Ön Takoz”, '
    + '“Ön Sağ · 57RS313774” ile “Ön Sol · 57RS313774”. Adla eşleşmeyen iki takoz y’de ayna, x ve z’de '
    + _gmF(K.TOL_MM, 0) + ' mm içinde aynıysa çifttir. Kalan takoz tek başına bir gruptur (orta hattaki '
    + 'takoz). Gruplar önden arkaya, x’e göre sıralanır. Takoz konumları değişmez; yalnız tip değişir.</p>';
  h += _gmH3('Kısıtlar', 'p-kisit');
  h += '<p>Kısıtlar pencerenin ' + _gmN(_GM_PARAM_KISIT, 'kesin') + ' <strong>Kesin kriterler</strong> ve '
    + _gmN(_GM_PARAM_KISIT, 'ek') + ' <strong>Ek kısıtlar</strong> bölümlerindedir (' + _gmS('param-kisit') + '); '
    + 'ek kısıtın kutusu onu açar ya da kapatır, sınırı satırında yazılır.</p>';
  h += _gmSahne('param-kisit', _gmPencere('mnt-parametric', { tut: ['Kesin kriterler', 'Ek kısıtlar'], yan: false }),
    'Parametrik Analiz penceresi: kesin kriterler ve ek kısıtlar.', null, _GM_PARAM_KISIT);
  var olcut = {
    k1: ['bütün modlar &lt; 0,5·f<sub>ateş</sub>', 'kesin'],
    k1a: ['komşu iki mod arası &gt; 0,5 Hz', 'kesin'],
    k1b: ['hiçbir mod 8–10 Hz bandında değil', 'kesin'],
    k2: ['T(f<sub>ateş</sub>) &lt; %50', 'kesin'],
    sehimAlt: ['en büyük 1 g statik düşey sehim δ<sub>s</sub>', '≥ ' + _gmF(V.sehimAlt, 1) + ' mm'],
    sehim: ['δ<sub>s</sub>', '≤ ' + _gmF(V.sehimUst, 1) + ' mm'],
    altMod: ['en düşük mod', '≥ ' + _gmF(V.altMod, 1) + ' Hz'],
    kapasite: ['1 g statik yük / kapasite', '≤ %' + _gmF(V.kapasite * 100, 0)],
    ayrisma: ['zıplama ve yalpa modlarında kinetik enerji payı', '≥ %' + _gmF(V.ayrisma * 100, 0)],
    isletme: ['işletme yüklerinde en büyük |δ|', '≤ ' + _gmF(V.isletmeUst, 1) + ' mm'],
    durdurucu: ['aynısı, sürünmüş çalışma noktasında', '≤ ' + _gmF(V.durdurucuUst, 1) + ' mm'],
    cekme: ['işletme yüklerinde düşey çekme', '0 mm'],
    darbe: ['darbe yüklerinde en büyük yük / kapasite', '≤ %' + _gmF(V.darbe * 100, 0)]
  };
  h += _gmTablo('Kısıtlar ve varsayılan sınırlar', ['No', 'Kısıt', 'Ölçüt', 'Varsayılan', 'Açık'],
    K.KISITLAR.map(function(x){
      return [x.no, x.ad, olcut[x.k][0], olcut[x.k][1], x.zorunlu ? 'her zaman' : (K.ACIK_VARSAYILAN[x.k] ? 'evet' : 'hayır')];
    }), ['c', 'l', 'l', '', 'c']);
  h += '<p>Ek kısıtların dayanağı raporun Kısıtlar bölümündedir: statik sehim bandı ve en düşük mod ticari araç ve ağır '
    + 'kamyon çalışmalarından, sürünme payı (bir yılda +%20 · 45 ShA … +%33 · 75 ShA) ile darbe yükü sınırı (2 × anma yükü) '
    + 'üretici kataloğundan, işletme sehimi sınırı ±15 mm durdurucuya 5 mm pay bırakan doğrusal banttan; durdurucu payı '
    + 'sürünmüş takozun işletmede metal–metal durdurucuya oturmamasıdır. '
    + 'Kapasite kısıtları kapasitesi tanımlı tiplerde değerlendirilir.</p>';
  h += _gmTablo('Değerlendirme parametreleri', ['Parametre', 'Varsayılan', 'Etkisi'], [
    ['Sürünme payı', '%' + _gmF(V.surunme * 100, 0), 'E7’de işletme yüklerinin düşey çalışma noktası statik sehimin bu kadarı aşağıda'],
    ['Rijitlik toleransı', '±%' + _gmF(V.tolerans * 100, 0) + ' (kapalı)', 'Açıksa bütün takozlar sert ve yumuşak köşede de çözülür; '
      + 'frekans üstü ve T sertte, sehim ve alt frekans yumuşakta sınanır'],
    ['İletilebilirlik ağırlığı w', _gmF(V.agirlik, 1), 'Uzlaşı uzaklığında T’nin ağırlığı; sehiminki 1 − w']
  ], ['l', 'c', 'l']);
  h += '<p><strong>İşletme yükleri</strong> 1 g düşey ile birlikte en çok 1 g yatay ivme ve tahrik torkudur: statik, '
    + 'frenleme, hızlanma, viraj, fren + viraj, ileri ve geri tork, vites başına tork, 1 g yanal ve 1 g boyuna. '
    + '<strong>Darbe yükleri</strong> (3,5 g düşey, çukur + fren, bordür darbesi, geri esneme) ±15 mm metal–metal '
    + 'durdurucuyla sınırlanır; raporda yalnız en büyük sehimleri ve durdurucuya oturan takoz sayısı yazılır.</p>';
  h += _gmH3('Amaç ve sıra', 'p-amac');
  h += '<p>İki büyüklük birlikte küçültülür: rölanti iletilebilirliği <strong>T</strong> (Kriter 2’nin tanımı) ve '
    + 'en büyük statik sehim <strong>δ<sub>s</sub></strong>. Yumuşak takoz T’yi düşürür ve sehimi büyütür. '
    + 'Bütün kısıtları sağlayan kombinasyonlardan, iki amaçta da kendisinden iyi başka bir kombinasyon '
    + 'bulunmayanlar <strong>Pareto cephesi</strong>dir. <strong>Uzlaşı çözümü</strong>, iki amaç uygun kümenin '
    + 'en küçüğü ile en büyüğü arasında 0–1’e çekildikten sonra ideal noktaya ağırlıklı uzaklığı en küçük olan '
    + 'kombinasyondur; ağırlık <em>w</em> iletilebilirliğindir (varsayılan ' + _gmF(V.agirlik, 1) + '), sehiminki 1 − w.</p>';
  h += _gmNot('Uygun kombinasyon yoksa',
      'Rapor kısıtların normalleştirilmiş ihlallerinin toplamına göre en az ihlalli kombinasyonları '
    + 'sıralar ve her birinin hangi kısıtı sağlamadığını yazar.');
  h += _gmH3('Tarama', 'p-tarama');
  h += _gmAdimlar([
    'Motor bileşenine rölanti devri ve silindir sayısı girilir: Kriter 1 ve 2 ateşleme frekansından türer.',
    _gmN(_GM_PARAM, 'gruplar') + ' <strong>Gruplar</strong> ve <strong>Adaylar</strong> '
      + 'bölümlerinde taranacaklar işaretlenir (' + _gmS('parametrik') + '); sağ sütundaki '
      + _gmN(_GM_PARAM, 'katalog') + ' kombinasyon sayısı tarama süresinin ölçüsüdür '
      + '(kombinasyon başına yaklaşık 0,5 ms).',
    _gmN(_GM_PARAM, 'tara') + ' <strong>Tara</strong>: her kombinasyonda önce statik denge ve modal analiz (birinci aşama), '
      + 'kombinasyon çözülürse ardından işletme ve darbe yükleri (ikinci aşama). Düğmenin solundaki çubuk taranan '
      + 'kombinasyon sayısını ve oranı gösterir; düğme tarama sürerken <strong>Durdur</strong>dur. Tarama '
      + 'sürerken pencere ve tuval kullanılabilir.',
    'Pencerenin <strong>Sonuç</strong> bölümü açılır: öneri (uygun kombinasyon yoksa en az ihlalli '
      + 'kombinasyon), kriterler ve iki grafik.',
    '<strong>Modele uygula</strong> (<strong>Öneri</strong> bölümünde) ya da yakın seçeneğin <strong>Uygula</strong>sı: '
      + 'kombinasyonun tipleri taranan grupların takozlarına yazılır (' + _gmB('p-sonuc') + '). Ardından Çözücü’de '
      + '<strong>Hesapla</strong> ve ana rapor: Çözücü taramanın ölçtüğü modları ve sehimleri bulur.',
    '<strong>Raporu indir</strong> (<strong>Öneri</strong> bölümünde): kapsam, yöntem, kısıtlar, eleme, sonuç '
      + '(uzlaşı çözümü ve mevcut tasarım yan yana, Pareto şekli), sıralama, varsayımlar ve kaynaklar.',
    '<strong>Excel’i indir</strong> (<strong>Öneri</strong> bölümünde): konfigürasyonların karşılaştırması ve her '
      + 'birinin sonucu, tarama tablosu ve Tarama’da seçilen kombinasyonun sonucu (' + _gmB('p-sonuc') + ', '
      + '<em>Excel çıktısı</em>).'
  ]);
  h += '<p>Kısıtların sınırı, açık/kapalı durumu ve amaç ağırlığı değişince Sonuç bölümü taramanın sakladığı '
    + 'ölçülerden yeniden kurulur; tarama yinelenmez. Model, adaylar, sabit gruplar, tolerans ya da sürünme payı '
    + 'değişince tarama eskir ve Sonuç bölümü yalnız bu durumu yazar. Taranan bir grubun takoz tipi değişince '
    + 'tarama eskimez; mevcut tasarım yeniden ölçülür. '
    + 'Tarama proje dosyasına kaydedilmez.</p>';
  h += _gmH3('Sonuç ve diyagramlar', 'p-sonuc');
  h += '<p><strong>Öneri</strong> uzlaşı çözümüdür (' + _gmB('p-amac') + '); uygun kombinasyon yoksa sıranın birincisi, en az '
    + 'ihlalli kombinasyondur ve bölümün, kriter sütununun ve grafiklerdeki işaretin adı <strong>En az ihlalli</strong>dir. '
    + 'Kısıtlar Sonuç bölümünde adlarıyla yazılır; tam ekrandaki diyagramlar kodlarıyla (K1 … E9), kodların '
    + 'adları diyagram listesinin altındadır.</p>';
  h += _gmAlanTablo('Sonuç bölümü', [
    ['<strong>Öneri</strong>', 'Grup başına tip: değişen grupta mevcut tip üstü çizili, önerinin tipi kalın; '
      + 'tipi aynı kalan grup <em>Aynı</em>, taranmayan grup <em>Sabit</em>. İletilebilirlik ve statik sehim: '
      + 'mevcut → öneri', '<strong>Modele uygula</strong>, <strong>Raporu indir</strong> ve <strong>Excel’i indir</strong> bu bölümde'],
    ['<strong>Kriterler</strong>', 'Açık kısıt başına satır: sınır, mevcut tasarımın ve önerinin değeri; ✓ sağlıyor, '
      + '✗ sağlamıyor (hücre kırmızı). Statik sehimin alt ve üst sınırı tek satırdır',
      'Değeri olmayan kısıt (kapasitesi tanımsız tip) —; değer sınıra yuvarlanıyorsa ondalığı uzar'],
    ['<strong>Modlar</strong>', 'Mevcut tasarımın ve önerinin modları, çentik başına bir mod; gri bölge '
      + 'sınır dışıdır (en düşük modun altı, 8–10 Hz bandı, 0,5·f<sub>ateş</sub>’in üstü); kırmızı çentik '
      + 'sınırı bozan mod', 'Kırmızı köprü 0,5 Hz’ten yakın iki mod; tolerans açıksa gri çizgi modun '
      + '±tolerans köşelerindeki yeri'],
    ['<strong>Statik sehim ve iletilebilirlik</strong>', 'Karo mevcut tasarım, halka öneri, boş daireler yakın '
      + 'seçenekler; ok mevcut tasarımdan öneriye. Yeşil bant statik sehimin sınırları', ''],
    ['<strong>Yakın seçenekler</strong>', 'Sıranın ikinci–altıncı kombinasyonu: grup başına tip (önerininkiyle '
      + 'aynı olan soluk), iletilebilirlik ve statik sehim; uygun değilse sağlamadığı kısıtlar; <strong>Uygula</strong>',
      'Uygun kombinasyon beşten azsa en az ihlalli uygun olmayanlarla tamamlanır'],
    ['<strong>Eleme</strong>', 'Kısıtlar sırayla uygulanınca kalan kombinasyon sayısı; yalnız eleyen kısıtlar',
      'Son satır uygun kombinasyon sayısı'],
    ['<strong>Diyagramlar</strong>', 'Taramanın on diyagramının listesi; ad, diyagramı tam ekranda açar',
      'Tam ekranda soldaki listeden öteki diyagrama geçilir']
  ], ['Bölüm', 'Ne', 'Not']);
  h += _gmAlanTablo('Diyagramlar (tam ekran)', [
    ['Pareto cephesi', 'Çözülen her kombinasyon δ<sub>s</sub>–T düzleminde: gri nokta kesin '
      + 'kriterlerden birini, açık mavi bir ek kısıtı sağlamıyor, mavi bütün kısıtları sağlıyor; koyu basamak çizgisi '
      + 'Pareto cephesi, halka öneri, karo mevcut tasarım; kesikli çizgiler E1, E2 ve Kriter 2',
      'Sıranın ilk on kombinasyonunda ince çizgi ±tolerans rijitlik köşelerini birleştirir (yumuşak ↔ sert)'],
    ['Mod yerleşimi', 'Satır başına bir tasarım, çentik başına bir mod: mevcut tasarım ve sıranın '
      + 'ilk beşi; uygun kombinasyon beşten azsa en az ihlalli yakın kombinasyonlar (adlarında sağlamadıkları '
      + 'kısıtlar). Mavi çentik zıplama ya da baş-kıç ağırlıklı mod',
      'Gölge: E3’ün altı, 8–10 Hz bandı, 0,5·f<sub>ateş</sub>’in üstü; kırmızı köprü 0,5 Hz’ten yakın iki mod; '
      + 'gri çizgi ±tolerans köşelerinde modun yeri'],
    ['Bağlayıcı kısıtlar', 'Açık kısıt başına kısıtı sağlamayan kombinasyon sayısı ve yalnız o '
      + 'kısıtı sağlamayan (öteki bütün açık kısıtları sağlayan) kombinasyon sayısı',
      'İkinci sayı, sınırı gevşeyen kısıtın uygun kümeye katacağı kombinasyonlardır'],
    ['Sınır duyarlılığı', 'Sınırı olan her açık ek kısıt için uygun kombinasyon sayısı, '
      + 'o sınırın değerine göre; öteki sınırlar bugünkü değerinde',
      'Kesikli dikey çizgi bugünkü sınır; ölçüsü olmayan kısıt (kapasitesiz tipler) çizilmez'],
    ['Ana etkiler', 'Sıranın birincisinden yalnız bir grubun tipi değişir: yatay eksen o grubun '
      + 'tipi (statik düşey rijitlik sırasıyla), düşey eksen T ve δ<sub>s</sub>; çizgiler grup numarasıyla',
      'Dolu işaret uygun, boş işaret uygun değil; halka sıranın birincisi'],
    ['Kısıt haritaları', 'Kesitte açık kısıt başına bir harita: dolu hücre kısıtı sağlıyor; '
      + 'son harita bütün kısıtların kesişimi',
      'Kesitin her hücresinde sağlanan kısıtlar haritaların altında adlarıyla'],
    ['İletilebilirlik haritası', 'Kesitte hücre rengi T (%10 adım; en koyu sınıf Kriter 2’nin '
      + 'ötesi); çizgiler Kriter 1, E1, E2 ve E3 sınırları', 'Boş daire kesin kriterleri, dolu daire bütün kısıtları '
      + 'sağlayan hücre'],
    ['Kısıt penceresi', '3B: δ<sub>s</sub>, en yüksek mod f<sub>maks</sub> ve T; kesikli kutu '
      + 'E1–E2, Kriter 1 ve Kriter 2’nin bıraktığı pencere', 'Kutudaki nokta öteki kısıtları da sağlamıyorsa uygun değildir'],
    ['Tepki yüzeyi', '3B: kesitte seçilen büyüklüğün (T · δ<sub>s</sub> · f<sub>maks</sub>) yüzeyi',
      'Kesikli çerçeve büyüklüğün sınırı: Kriter 2 · E2 · Kriter 1'],
    ['Tasarım uzayı', '3B: üç taranan grubun tipi eksende, nokta başına bir kombinasyon; rengi '
      + 'eleme durumu', 'Kriter 1’de elenenler kutucukla görünür']
  ], ['Diyagram', 'Ne', 'Not']);
  h += '<p><strong>Kesit.</strong> Kısıt haritaları, İletilebilirlik haritası, Tepki yüzeyi ve Tasarım uzayı iki '
    + 'taranan grubu eksenlere koyar (tipler statik düşey rijitlik sırasıyla); öteki taranan gruplar seçilen tipte '
    + 'durur, varsayılan sıranın birincisinin tipidir. <em>Eksenler</em> ve <em>Grup</em> seçimi dört diyagramda '
    + 'ortaktır. Tek grup taranıyorsa kesit diyagramları çizilmez; Tasarım uzayı üç taranan grup ister.</p>';
  h += _gmNot('Excel çıktısı',
      '<strong>Excel’i indir</strong> taramayı bugünkü sınırlarla <code>takoz_konfigurasyonlari.xlsx</code> '
    + 'dosyasına yazar; tarama yinelenmez, satırların ölçümü sürerken çubuk eylem satırındadır. '
    + '<strong>Özet</strong>: mevcut tasarım (K0) ve dört kesin kriteri sağlayan kombinasyonlardan statik sehimi '
    + 'en küçük dokuzu (K1 … K9); grupların tipi, <em>Uygunluk</em>, statik sehim, dört kesin kriter, frekans '
    + 'payı, TR ve en düşük mod. <em>Statik sehim</em>: 1 g statik yükte takozların düşey sehiminin en büyüğü '
    + '(max |δ<sub>z</sub>|). <em>Uygunluk</em>: dört kesin kriter sağlanıyorsa <em>Uygun</em>, statik sehimi en '
    + 'küçük olan <em>En uygun</em> (koyu yeşil); yeşil, sehim arttıkça açılır; <em>Uygun değil</em> renksizdir. '
    + 'Kriterin tanımı başlığın notundadır (fareyle başlığın üstüne gelin). K ve <em>Sonuç</em> hücresi '
    + 'konfigürasyonun kendi sayfasını (K0 … K9) açar: her yük durumunda takoz başına X, Y, Z yer değiştirmesi, '
    + 'modlar ve TR; <em>Özet sayfasına dön</em>, <em>Geri</em> ve <em>İleri konfigürasyon</em> düğmeleri. '
    + '<strong>Tarama</strong>: çözülen kombinasyonlar, sağlanan kesin kriter sayısına sonra statik sehime göre '
    + 'sıralı (en çok 20.000 satır); modlar, f<sub>b</sub>, TR, statik sehim, dört kriter (✓ / ✗), frekans payı, '
    + 'grup başına statik ve azami yük, kapasite; başlık satırında filtre. <em>Sonuçlar →</em> Sonuç sayfasını '
    + 'açar. <strong>Sonuç</strong>: Tarama’nın filtresinde TEK satır kalınca o kombinasyonun sonucu — dört '
    + 'kriter, TR, statik sehim, frekans payı, her yük durumunda takoz başına X, Y, Z yer değiştirmesi ve modlar; '
    + 'birden çok satır görünürken boştur. Tek satır bırakmak için kombinasyonun <em>No</em> hücresine sağ '
    + 'tıklayıp Excel’in <em>Filtre</em> menüsünden seçili hücrenin değerine göre filtreleyin ya da grupların '
    + 'sütunlarında birer tip seçin. Kitabın alt çubuğunda sayfa adları yoktur; sayfalar düğmelerle açılır. '
    + 'Bütün kombinasyonların sonucu gizli '
    + '<strong>Veri</strong> sayfasındadır. Izgara çizgileri kapalı, tablonun dışındaki satır ve sütunlar gizli '
    + 'açılır.');
  h += _gmNot('Seçimi modele uygulamak',
      '<strong>Modele uygula</strong> önerinin tiplerini, yakın seçeneğin <strong>Uygula</strong>sı o seçeneğin '
    + 'tiplerini taranan grupların takozlarına yazar; yazım Takoz penceresinin <strong>Takoz tipi</strong> '
    + 'listesindeki seçimin aynısıdır (rijitlik, kapasite, yasa). Bütün takozlar tek geri-al adımıdır (Ctrl+Z). '
    + 'Sabit grup değişmez. Tarama eskimez: uygulanan kombinasyon mevcut tasarım olur, <strong>Öneri</strong> '
    + 'her grupta <em>Aynı</em> yazar ve <strong>Kriterler</strong>’in iki sütunu eşitlenir. Kombinasyon zaten '
    + 'modeldeyse düğme kapalıdır.');
  h += _gmNot('Etkileşim',
      '<strong>Diyagramlar</strong> bölümündeki ad diyagramı tam ekranda açar; soldaki listeden öteki diyagrama '
    + 'geçilir. 3B diyagramlar sol tık + sürükle ile döner; çizim odaktayken oklar döndürür; <em>Sıfırla</em> '
    + 'başlangıç bakışına döner. Grafikte ve diyagramda işaretin üstüne gelince kombinasyonun grup başına tipi, T, '
    + 'δ<sub>s</sub> ve sağlamadığı kısıtlar görünür; mod çentiğinin üstünde modun frekansı ve adı.');
  return h;
}

function _gmSec18(){
  var h = _gmH2('m18');
  h += '<p>Bu modülde de en pahalı hata sınıfı çöken model değil, <strong>“makul ama yanlış” '
    + 'sayıdır</strong>.</p>';
  h += _gmTablo('Uyarı vermeyen hatalar',
    ['Alan', 'Yanlış verilirse ne olur', 'Belirtisi'],
    [
      ['Karışık koordinat çerçevesi', 'Bir CG parça çerçevesinde, bir takoz araç '
        + 'çerçevesinde', 'Sehim ve modlar birlikte anlamsızlaşır — ama hata çıkmaz'],
      ['Atalet zaten taşınmış girilir', 'Paralel-eksen teoremi iki kez uygulanır',
        'Yalnız <strong>dönme modları</strong> düşer; sehim normal görünür'],
      ['Atalet birimi kg·mm²', 'Atalet 10⁶ kat büyür',
        'Dönme modları sıfıra yakın çıkar'],
      ['Statik = dinamik rijitlik', 'İki ayrı büyüklüğe aynı sayı',
        'Ya sehim küçük ya frekanslar düşük — ikisi birden doğru olamaz'],
      ['PTO kütlesi iki yoldan', 'Aynı kütle iki kez sayılır',
        'Toplam kütle beklenenden büyük — tutarlılık uyarısı bunu söyler'],
      ['Üçten az takoz', 'Rijit gövde serbest kalır', 'K tekil — çözücü açıkça söyler'],
      ['Takozlar tek düzlemde', 'Bir serbestlik derecesi kısıtlanmaz',
        'Bir mod <strong>f ≈ 0</strong> çıkar'],
      ['Doğrusal model, büyük ivme', 'Sertleşme modellenmez',
        'Raporun <em>Lineerlik (±10 mm)</em> satırı “aşım” yazar']
    ], ['l', 'l', 'l']);
  h += _gmOnay('Gözden geçirme: raporun tutarlılık özeti',
      'Yukarıdaki sınıfların çoğu raporun tutarlılık özetinde adıyla görünür. Çözülmüş model tek '
    + 'başına “model doğru” demek değildir.');
  return h;
}

// ═══════════════════════════════════════════════════════════════════════════
//  19 — CANLI ÖRNEK
// ═══════════════════════════════════════════════════════════════════════════
//
// Çekirdek DOM'suz ve açık model kabul ediyor, yani Araç Performans
// kılavuzunun yapmak zorunda kaldığı global takası burada GEREKMİYOR.

function _gmCore(){
  if(typeof veMountCore !== 'undefined' && veMountCore && veMountCore.getMountExampleList)
    return veMountCore;
  return null;
}

function _gmOrnekListe(){
  var c = _gmCore();
  if(!c) return [];
  try { return c.getMountExampleList() || []; } catch(e){ return []; }
}

// UI birimlerinden (mm · kg · N/mm) SI'ya çevirip çözüme hazır model kur.
// Çeviri çekirdeğin KENDİ yardımcılarıyla yapılır (mmToM · nPerMmToNPerM);
// elle 1e-3 yazmak ikinci bir birim kaynağı olurdu.
function _gmModelKur(ex){
  var c = _gmCore();
  if(!c || !ex || !ex.model || !ex.model.components) return null;
  var m = ex.model;
  var mm = c.mmToM, kk = c.nPerMmToNPerM;
  var comps = m.components.map(function(x){
    return { name: x.name, mass: x.mass,
             cg: [mm(x.cg[0]), mm(x.cg[1]), mm(x.cg[2])],
             I: [[x.Ixx, x.Ixy, x.Ixz], [x.Ixy, x.Iyy, x.Iyz], [x.Ixz, x.Iyz, x.Izz]],
             pointMass: !!x.pointMass };
  });
  var mnts = m.mounts.map(function(x){
    return { name: x.name,
             pos: [mm(x.pos[0]), mm(x.pos[1]), mm(x.pos[2])],
             kstat: x.kstat.map(kk), kdyn: x.kdyn.map(kk) };
  });
  try {
    var model = c.buildModel(comps, mnts, m.g);
    if(!model) return null;
    return { core: c, ex: ex, ui: m, model: model, mounts: mnts, comps: comps };
  } catch(e){ return null; }
}

function _gmSec19(){
  var h = _gmH2('m19');
  var liste = _gmOrnekListe();
  var ex = null;
  for(var i = 0; i < liste.length; i++) if(liste[i].id === 'siper') ex = liste[i];
  if(!ex) ex = liste[0];
  var P = ex ? _gmModelKur(ex) : null;
  if(!P){
    h += '<p>Örnek bu kurulumda bulunamadı; sayılar üretilmedi.</p>';
    return h;
  }

  var c = P.core, model = P.model, ui = P.ui;
  h += '<p>Kılavuzun tamamı tek bir gerçek güç grubunda: <strong>' + _gmE(ex.name) + '</strong> — '
    + 'ilk turun örneği (' + _gmB('tur') + '). Bütün sayılar belge üretilirken çekirdekle hesaplanır.</p>';

  // ── Girdiler ────────────────────────────────────────────────────────────
  h += _gmH3('Model — ne girildi', 'o-girdi');
  var cSat = ui.components.map(function(x){
    return [_gmE(x.name), _gmFs(x.mass, 1),
            _gmFs(x.cg[0], 1) + ' / ' + _gmFs(x.cg[1], 1) + ' / ' + _gmFs(x.cg[2], 1),
            x.pointMass ? '<em>nokta kütle</em>'
              : (_gmFs(x.Ixx, 1) + ' / ' + _gmFs(x.Iyy, 1) + ' / ' + _gmFs(x.Izz, 1))];
  });
  h += _gmTablo('Kütle gövdeleri — girilen değerler',
    ['Gövde', 'Kütle [kg]', 'CG x / y / z [mm]', 'Ixx / Iyy / Izz [kg·m²]'],
    cSat, ['l', 'c', 'c', 'c']);

  var mSat = ui.mounts.map(function(x){
    return [_gmE(x.name),
            _gmFs(x.pos[0], 1) + ' / ' + _gmFs(x.pos[1], 1) + ' / ' + _gmFs(x.pos[2], 1),
            x.kstat.map(function(v){ return _gmFs(v, 0); }).join(' / '),
            x.kdyn.map(function(v){ return _gmFs(v, 0); }).join(' / '),
            _gmFs(x.kdyn[2] / x.kstat[2], 2)];
  });
  h += _gmTablo('Takozlar — girilen değerler',
    ['Takoz', 'Konum x / y / z [mm]', 'Statik k [N/mm]', 'Dinamik k [N/mm]',
     'Dinamik / statik (z)'],
    mSat, ['l', 'c', 'c', 'c', 'c']);
  h += _gmNot('Dinamik/statik oranı bir sağlık göstergesidir',
      'Son sütun her takozda 1’den büyük olmalı ve tipik olarak 1,4–1,8 bandında durmalıdır '
    + '(' + _gmB('takoz') + '). Bire eşit çıkıyorsa iki alana aynı sayı girilmiş demektir; banttan çok '
    + 'uzaksa katalog yanlış okunmuştur.');

  // ── Birleşik kütle özellikleri ──────────────────────────────────────────
  h += _gmH3('Birleşik kütle özellikleri', 'o-kutle');
  var toplamUI = ui.components.reduce(function(s, x){ return s + (x.mass || 0); }, 0);
  h += _gmTablo('Birleşik kütle özellikleri',
    ['Büyüklük', 'Değer', 'Nasıl çıktı'],
    [
      ['Gövde sayısı', String(ui.components.length), 'Girilen kütle gövdeleri'],
      ['Toplam kütle', _gmFs(model.m, 1) + ' kg',
        'Gövde kütlelerinin toplamı (' + _gmFs(toplamUI, 1) + ' kg)'],
      ['Ortak ağırlık merkezi',
        _gmFs(model.cg[0] * 1000, 1) + ' / ' + _gmFs(model.cg[1] * 1000, 1) + ' / '
        + _gmFs(model.cg[2] * 1000, 1) + ' mm',
        'Kütlelerle ağırlıklı ortalama'],
      ['Takoz sayısı', String(ui.mounts.length), 'Rijit gövde kısıtı için ≥ 3 gerekir']
    ], ['l', 'c', 'l']);
  h += _gmOnay('Ataletler paralel-eksen teoremiyle taşındı',
      'Her gövdenin ataleti kendi CG’sinde girildi; ataletler ortak CG’ye taşınıp toplandı '
    + '(' + _gmB('govde') + '). Taşınmış atalet girilirse taşıma <strong>iki kez</strong> yapılır.');

  // ── Sehim ───────────────────────────────────────────────────────────────
  var lc = ui.loadCases || [];
  var cozum = null;
  try { cozum = c.solveAllCases(model, lc, {}); } catch(e){ cozum = null; }
  if(cozum && cozum.length){
    h += _gmH3('Sehim — bütün yük durumları', 'o-sehim');
    var qSat = cozum.map(function(rc){
      var q = rc.res && rc.res.q;
      if(!q) return [_gmE(rc.name), '—', '—', '—', '—', '—', '—'];
      var ck = (rc.res.checks) || {};
      return [_gmE(rc.name),
              _gmFs(q[0] * 1000, 2), _gmFs(q[1] * 1000, 2), _gmFs(q[2] * 1000, 2),
              _gmFs(q[3] * 180 / Math.PI, 3), _gmFs(q[4] * 180 / Math.PI, 3),
              (ck.tensionCount > 0)
                ? ('<strong>' + ck.tensionCount + ' takoz</strong>')
                : '<span class="ok">yok</span>'];
    });
    h += _gmTablo('Sehim ve çekme — yük durumu başına',
      ['Yük durumu', 'qx [mm]', 'qy [mm]', 'qz [mm]', 'θx [°]', 'θy [°]', 'Çekme'],
      qSat, ['l', 'c', 'c', 'c', 'c', 'c', 'c']);

    var st = cozum[0] && cozum[0].res;
    if(st && st.checks){
      h += _gmNot('Statik durum, sehimin temel hâli',
          'İlk satır yalnız ağırlık altındaki sehimdir: düşey ötelenme '
        + '<strong>' + _gmFs(st.q[2] * 1000, 3) + ' mm</strong>. Kuvvet dengesi artığı '
        + '<strong>' + _gmFs(st.checks.sumFzResidual || 0, 6) + '</strong> — sıfıra eşit '
        + 'olması çözümün kendi iç denetimidir (' + _gmB('sehim') + '), bir yaklaşıklık değil.');
    }
  }

  // ── Modal ───────────────────────────────────────────────────────────────
  var modes = null;
  try {
    var M6 = c.buildM6(model.m, model.I_G);
    modes = c.solveModal(model.Kdyn, M6, P.mounts, model.cg);
  } catch(e){ modes = null; }
  if(modes && modes.length){
    h += _gmH3('Doğal frekanslar', 'o-modal');
    var fSat = modes.map(function(m2, i){
      return [String(i + 1), _gmFs(m2.f_Hz, 2), _gmE(m2.label || '—'),
              m2.warning ? ('<strong>' + _gmE(m2.warning) + '</strong>')
                         : '<span class="ok">—</span>'];
    });
    h += _gmTablo('Rijit gövde modları (dinamik rijitlikle)',
      ['#', 'f [Hz]', 'Baskın hareket', 'Uyarı'], fSat, ['c', 'c', 'l', 'c']);

    var enYuksek = modes[modes.length - 1].f_Hz;
    var Te = (ui.torque && ui.torque.Te) ? ui.torque.Te : null;
    h += _gmNot('İzolasyon nasıl okunur',
        'En yüksek rijit gövde modu <strong>' + _gmFs(enYuksek, 2) + ' Hz</strong>. '
      + 'İzolasyon kuralı gereği (' + _gmB('modal') + ') rölanti ateşleme frekansının bunun en az '
      + '<strong>√2</strong> katı — pratikte 2,5–3 katı — olması istenir. Altı silindirli '
      + 'dört zamanlı bir motorda ateşleme frekansı <em>devir × 6 / 120</em> olduğundan, '
      + 'bu model için gereken rölanti yaklaşık <strong>'
      + _gmFs(enYuksek * 2.5 * 120 / 6, 0) + ' dev/dk</strong> mertebesindedir'
      + (Te ? ' (modelin motor torku ' + _gmFs(Te, 0) + ' N·m).' : '.'));
    h += _gmUyari('Bu sayı bir hedef değil, bir ölçüttür',
        'Değer, bu takoz setinin altı silindir varsayımıyla yalıttığı en düşük rölanti devridir. '
      + 'Gerçek rölanti daha düşükse ya takoz yumuşatılır ya da yerleşim değiştirilir.');
  }

  // ── Örneği programda kurmak ─────────────────────────────────────────────
  h += _gmH3('Örneği programda kurmak', 'o-kur');
  h += _gmAdimlar([
    'Boş bir Takoz modülünde başlangıç sayfasının listesinde <strong>' + _gmE(ex.vehicle || ex.name) + '</strong> '
      + 'satırının <strong>Yükle</strong> düğmesine ' + _gmNS('baslangic', _GM_BASLANGIC, 'yukle') + ' basın.',
    'Çözücüde <strong>Hesapla</strong>’ya basın; bir kütle gövdesinin penceresinde toplam '
      + 'kütleyi ve birleşik CG farkını yukarıdaki birleşik kütle tablosuyla karşılaştırın.',
    'Ayrıntı için <strong>Rapor</strong> bileşeninden çevrimdışı HTML raporu üretin.'
  ]);
  return h;
}

function _gmEkA(){
  var h = _gmH2('mEk');
  h += '<p>Pencereler bölümlerini tek gövdede alt alta taşır; kalın yazılan bölüm adları '
    + 'programdaki başlıklarla birebir aynıdır.</p>';
  h += _gmTablo('Alan → pencere eşlemesi',
    ['Alan', 'Pencere', 'Bölüm'],
    [
      ['Kütle ve ağırlık merkezi', 'Kütle gövdesi', '<strong>Kütle</strong> · <strong>Ağırlık merkezi</strong>'],
      ['Atalet tensörü', 'Kütle gövdesi', '<strong>Atalet tensörü</strong>'],
      ['Nokta kütle anahtarı', 'Kütle gövdesi', '<strong>Atalet tensörü</strong> (işaretliyken bölümün adı <strong>Atalet</strong>)'],
      ['Güç grubundaki yeri (kroki)', 'Kütle gövdesi · Takoz', 'Sağ sütun'],
      ['Motor torku', 'Motor', '<strong>Motor noktaları</strong> · <strong>Tork zinciri</strong>'],
      ['Vites oranları', 'Şanzıman', '<strong>Vites oranları</strong>'],
      ['Transfer oranı', 'Transfer Kutusu', '<strong>Oran ve aks payı</strong>'],
      ['PTO giriş yolu', 'PTO grubu', '<strong>Giriş yolu</strong>'],
      ['Aksesuarın kayıtlı modeli', 'Alternatör · Klima Kompresörü', '<strong>Kayıtlı aksesuar</strong>'],
      ['Takoz konumu', 'Takoz', '<strong>Konum</strong>'],
      ['Statik ve dinamik rijitlik', 'Takoz', '<strong>Rijitlik</strong>'],
      ['Taşıma kapasitesi', 'Takoz', '<strong>Kapasite</strong>'],
      ['Kuvvet–sehim eğrisi', 'Takoz Özellikleri', '<strong>Kuvvet–sehim</strong> (takozda <strong>Rijitlik</strong>’in altındaki not)'],
      ['Takoz tipleri (künyeler)', 'Takoz Özellikleri', '<strong>Takoz tipi</strong> · <strong>Rijitlik</strong> · <strong>Kuvvet–sehim</strong>'],
      ['Çözüm modu, sönüm oranı', 'Çözücü', '<strong>Yöntem</strong>'],
      ['Şok darbesi', 'Çözücü', '<strong>Şok darbesi</strong>'],
      ['Aracın ileri yönü, tork yönü, kaldırım darbesi', 'Çözücü', '<strong>Araç ekseni</strong> · <strong>Kaldırım darbesi</strong>'],
      ['Örnek modeller', 'Başlangıç sayfası', '<em>Araçlar</em> · <em>Kurgu</em> · <em>Yükle</em>'],
      ['STEP dosyası, parça rolleri', '3D Görüntüleyici · sihirbazın STEP kartı', '<strong>STEP dosyası</strong> · <strong>Parçalar</strong>'],
      ['Takoz noktası (daire)', '3D Görüntüleyici (3B)', '<em>Daireden nokta</em>'],
      ['Kütlenin kaynağı', '3D Görüntüleyici · sihirbazın STEP kartı', '<strong>Kütle</strong>'],
      ['Motor modeli, veri sayfasının referansı', '3D Görüntüleyici (3B)', '<em>Bloğun ön yüzü</em> (X12: <em>Bloğun arka yüzü</em>) · <em>Krank ekseni</em>'],
      ['Şanzıman ailesi ve seçenekleri', '3D Görüntüleyici (3B) · sihirbazın STEP kartı',
        '<em>Şanzıman ailesi</em> · <em>Konvertör muhafazasının ön yüzü</em> · <em>Şanzıman ekseni</em>'],
      ['Şanzıman ailesinin belgesi', '3D Görüntüleyici (3B)', '<em>Belge</em>'],
      ['Vites konfigürasyonu, konvertör', 'Şanzıman · sihirbazın Tork adımı', '<strong>Katalog</strong>'],
      ['Bağlantı yüzü, eğilme momenti sınırı', 'Şanzıman', '<strong>Bağlantı yüzü</strong> · <strong>Statik eğilme momenti</strong>'],
      ['Model ile karşılaştırma, öteleme', '3D Görüntüleyici · sihirbazın STEP kartı', '<strong>Model</strong>'],
      ['Raporun frekans girdileri (rölanti, silindir, ζ)', 'Motor · Çözücü',
        'Rapor penceresinin <strong>Frekans yerleşimi ve izolasyon</strong> bölümü kaynağını gösterir'],
      ['Takoz grupları, taranan grup', 'Parametrik Analiz', '<strong>Gruplar</strong>'],
      ['Aday takoz tipleri', 'Parametrik Analiz', '<strong>Adaylar</strong>'],
      ['Ek kısıtların sınırı, sürünme, tolerans, amaç ağırlığı', 'Parametrik Analiz',
        '<strong>Ek kısıtlar</strong> · <strong>Değerlendirme</strong> · <strong>Amaç</strong>'],
      ['Taramanın sonucu', 'Parametrik Analiz', '<strong>Öneri</strong> · <strong>Kriterler</strong> · <strong>Modlar</strong> · <strong>Statik sehim ve iletilebilirlik</strong>'],
      ['Seçimin takozlara uygulanması', 'Parametrik Analiz', '<strong>Öneri</strong> (Modele uygula) · <strong>Yakın seçenekler</strong> (Uygula)'],
      ['Yakın kombinasyonlar ve eleme', 'Parametrik Analiz', '<strong>Yakın seçenekler</strong> · <strong>Eleme</strong>'],
      ['Taramanın on diyagramı (tam ekran)', 'Parametrik Analiz', '<strong>Diyagramlar</strong>: Pareto cephesi · Mod yerleşimi · Bağlayıcı kısıtlar · Sınır duyarlılığı · Ana etkiler · Kısıt haritaları · İletilebilirlik haritası · Kısıt penceresi · Tepki yüzeyi · Tasarım uzayı']
    ], ['l', 'c', 'l']);
  return h;
}

// ═══════════════════════════════════════════════════════════════════════════
//  BELGE MONTAJI
// ═══════════════════════════════════════════════════════════════════════════

function veGuideMountHTML(){
  _gmTblNo = 0;
  _gmNumara = {};
  _gmSekilNo = {};
  _gmKayipListe = [];
  _gmPaketOnbellek = null;
  if(typeof veGuideSceneReset === 'function') veGuideSceneReset();

  var tarih = new Date().toLocaleDateString('tr-TR',
    { year: 'numeric', month: 'long', day: 'numeric' });

  var govde = veGuideAntet({
    eyebrow: 'MFSim · Takoz modülü · Kullanım kılavuzu',
    h1: 'Takoz Çökme-Titreşim Kılavuzu',
    sub: 'Programın açılışından rapora: adım adım kullanım, işaretli şekiller, girdi haritası, '
       + 'sonuçların okunması ve işlenmiş örnek',
    fields: [
      ['Belge', 'Kullanım kılavuzu'],
      ['Modül', 'Takoz Çökme-Titreşim'],
      ['Kapsam', VE_GUIDE_MOUNT_SECTIONS.length + ' bölüm'],
      ['Örnek', 'canlı çözülür'],
      ['Tarih', tarih]
    ]
  });

  govde += veGuideToc(VE_GUIDE_MOUNT_SECTIONS);
  govde += _gmSec1() + _gmSec2() + _gmSec3() + _gmSec4() + _gmSec5() + _gmSec6()
         + _gmSec7() + _gmSec8() + _gmSec9() + _gmSec10() + _gmSec11() + _gmSec12()
         + _gmSec13() + _gmSec14() + _gmSec15() + _gmSec16() + _gmSec17() + _gmSec18()
         + _gmSec19() + _gmEkA();
  govde = _gmCoz(govde);

  var css = '';
  if(govde.indexOf('gk-sahne') >= 0 || govde.indexOf('gk-ekran') >= 0){
    try { css = veGuideSceneCSS(undefined, VE_GUIDE_MOUNT_SAHNE_ON) + _GM_SAHNE_CSS; }
    catch(e){ css = ''; }
  }
  return veGuideDocHTML({
    title: 'MFSim — Takoz Çökme-Titreşim kılavuzu',
    body: govde,
    extraCss: css
  });
}

if(typeof module !== 'undefined' && module.exports){
  module.exports = {
    veGuideMountHTML: veGuideMountHTML,
    VE_GUIDE_MOUNT_SECTIONS: VE_GUIDE_MOUNT_SECTIONS,
    VE_GUIDE_MOUNT_SAHNE_ON: VE_GUIDE_MOUNT_SAHNE_ON,
    veGuideMountKayip: veGuideMountKayip,
    _gmOrnekListe: _gmOrnekListe, _gmModelKur: _gmModelKur,
    _gmAlanTablo: _gmAlanTablo, _gmTablo: _gmTablo, _gmKes: _gmKes
  };
}
