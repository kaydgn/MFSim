// ============================================================================
//  YAPISAL ANALİZ — GEOMETRİ KÖPRÜSÜ (STEP içe aktarma)
// ============================================================================
// Üç katmanın ORTASI (bkz. cp-structural.js başlığı ve CLAUDE.md):
//
//   vendor/opencascade.*     HESAP ÇEKİRDEĞİ — DIŞARIDAN GELDİ, BİREBİR DURUR.
//                            OpenCascade'in emscripten arayüzü. B-rep okur,
//                            KATILARI BİRLEŞTİRİR (boolean) ve üçgenler.
//   js/structural-model.js   BU DOSYA. KÖPRÜ: ham occt çıktısını MFSim'in
//                            modeline çevirir, yüz kimliğini kurar, hatayı
//                            Türkçeleştirir. DOM'suz, saf.
//   js/cp-structural.js      SUNUM. Yalnız HTML kurar; kendi geometrisini
//                            HESAPLAMAZ.
//
// ── ÇEKİRDEK NEDEN DEĞİŞTİ (2026-08-25) ─────────────────────────────────────
// Önceki çekirdek `occt-import-js` idi (7,6 MB) ve SALT OKUYUCUYDU: dışa
// verdiği üç fonksiyon ReadStepFile / ReadIgesFile / ReadBrepFile. Kullanıcı
// çok gövdeli CAD dosyalarının TEK KATI olarak gelmesini istedi (ağ örme
// sorunları yüzünden) — ve bunun ucuz bir çaresi yok: değen ama ayrı duran
// katıların yüzey üçgenlemesi arayüzde uyuşmuyor (ÖLÇÜLDÜ, as1-tu-203:
// 1 800 köşeden yalnız 204'ü ortak), yani üçgenleri tek tampona yığmak bir tet
// ağ örücüsü için hâlâ kendi kendini kesen girdi. Uyumlu arayüz ancak B-Rep
// seviyesinde imprint & merge ile kurulur.
//
// `opencascade.js@1.1.1` bunu veriyor (BRepAlgoAPI_Fuse, BOPAlgo,
// ShapeUpgrade_UnifySameDomain) ama 62,8 MB — tek dosya 12,6 → 26,8 MB.
// Karar kullanıcınındı, ölçümlerle alındı (CLAUDE.md).
//
// ── VENDORLU KÜTÜPHANE DOKUNULMAZ ───────────────────────────────────────────
// `vendor/opencascade.js` MFSim içinde yazılmadı ve MFSim stiline ÇEVRİLMEZ —
// `js/fead-core.js` ile aynı kural, aynı gerekçe: değeri OCCT'nin B-rep
// çekirdeğini birebir üretmesi. Güncelleme de dışarıdan gelir (npm:
// opencascade.js). Lisans LGPL-2.1 (MFSim MIT): kütüphane uygulamaya GÖMÜLÜ
// ama DEĞİŞTİRİLEBİLİR — kaynak `vendor/opencascade.wasm.gz` depoda duruyor
// (62,8 MB ham depoya konmaz), lisans metinleri dağıtımla gidiyor ve
// `npm run build:occt-wasm` gömülü blob'u o dosyadan yeniden üretiyor. LGPL'in
// istediği "ayrı dosya" değil, değiştirilebilirliktir.
//
// ── .wasm UYGULAMAYA GÖMÜLÜ — ÇEVRİMDIŞI ÇALIŞIR ───────────────────────────
// `js/structural-occt-wasm.js` (gzip+base64, 17,5 MB; ham 62,8 MB) uygulamanın
// içinde taşınır ve İLK içe aktarmada talep üzerine çalıştırılır. Eskiden
// `vendor/` yolundan indiriliyordu; iki sorunu vardı:
//   1) ÇEVRİMDIŞI ÇALIŞMIYORDU — MFSim tek dosya olarak indirilip kullanılıyor,
//      yanında vendor/ olmayan bir kurulumda STEP hiç açılmıyordu.
//   2) Kullanıcıya YANLIŞ ŞEYİ anlatıyordu: yükleme göstergesi PARÇANIN
//      işlendiğini söylemeli, kütüphanenin indiğini değil.
// Derleme bedeli ÖLÇÜLDÜ (gerçek tarayıcı): 7,8 s, oturumda BİR KEZ.
//
// ── WASM `wasmBinary` İLE VERİLİR, `locateFile` İLE DEĞİL ───────────────────
// Emscripten glue'u .wasm yolunu normalde `document.currentScript.src`'den
// tahmin eder. MFSim'in TEK DOSYA sürümünde (MFSim_Code.html) bütün script'ler
// INLINE'dır → `currentScript.src` yoktur ve tahmin sessizce yanlış yere gider.
// Bu yüzden baytları KENDİMİZ verip `wasmBinary` ile geçiyoruz.
//
// ── ÖLÇÜLDÜ: YÜZ KİMLİĞİ AĞ İNCELİĞİNDEN BAĞIMSIZ ──────────────────────────
// Bu modülün EN KRİTİK özelliği. Sınır koşulu mesh düğümüne değil CAD YÜZÜNE
// bağlanacak (CLAUDE.md); yakınsama çalışması ise ağı defalarca yeniler. Yüz
// kimliği ağ inceliğiyle değişseydi her yenilemede bütün sınır koşulları
// düşerdi. `brep_faces` bunu sağlıyor — üç ayrı incelikte ölçüldü:
//
//   as1-tu-203.stp   defl 0.001 → 4688 üçgen / 160 yüz
//                    defl 0.01  → 4408 üçgen / 160 yüz
//                    defl 0.1   → 2456 üçgen / 160 yüz
//   → yüz KİMLİKLERİ üçünde de AYNI, yüz başına ÜÇGEN sayısı değişiyor.
//
// Kapı: tests/unit/structural-model.test.js bunu iki dosyada da koşturuyor.
//
// ── ÖLÇÜLDÜ: BİRİM ÇEVRİMİ OCCT'DE DOĞRU, REGEX'LE OKUNMAZ ─────────────────
// Aynı küp mm / inch / metre birimleriyle yazılmış üç STEP dosyasında da
// occt 1000.0000 mm veriyor — yani dosyanın kendi birimini okuyup mm'ye
// çeviriyor. Sessiz 25.4× hatası YOK.
// STEP başlığından birimi regex ile okuma denendi ve BIRAKILDI: `cube-m.step`
// hiçbir `SI_UNIT(...METRE)` kalıbına uymuyor (birim dolaylı tanımlı). Yanlış
// okuyan bir regex, doğru çalışan bir çevrimin üstüne yanlış künye basardı.
// Biz yalnız İSTENEN çıktı birimini (millimeter) kaydediyoruz — MFSim'in UI
// birimi de mm.
// ----------------------------------------------------------------------------

// İstenen çıktı birimi. MFSim'in yapısal analiz UI birimi mm (CLAUDE.md).
var VE_STR_GEOM_UNIT = 'millimeter';

// Ağ inceliği varsayılanı. `bounding_box_ratio` → değer, parçanın ortalama
// sınır kutusuna ORANDIR; yani küçük bir braket ile büyük bir şasi aynı
// göreli kalitede üçgenlenir. Mutlak değer verilseydi (absolute_value) aynı
// sayı küçük parçayı aşırı, büyüğü yetersiz bölerdi.
//
// DİKKAT — BU AĞ FEA AĞI DEĞİL: OCCT'nin RENDER tessellation'ıdır, yalnız
// GÖRÜNTÜLEMEK ve yüz aralıklarını kurmak içindir. CLAUDE.md'de ölçüldü:
// bu üçgenlerin min açısı 2.81° ve parametreyi sıkmak İYİLEŞTİRMİYOR,
// BOZUYOR (2.50° → 0.14°, tet 11.8k → 1.32M). Hesaplama Ağı bileşeni araya
// yüzey yeniden-mesh'leme koyacak; buradaki üçgen doğrudan TetGen'e GİTMEZ.
var VE_STR_GEOM_DEFLECTION = { type: 'bounding_box_ratio', linear: 0.002, angular: 0.5 };

// AĞDAN İNDİRME YOLU YOK — çekirdek yalnız gömülü varlıktan gelir.
//
// Eskiden bir yedek vardı: gömülü varlık okunamazsa `vendor/…wasm` indirilirdi.
// Tek gerekçesi `DecompressionStream` bilmeyen tarayıcıydı; ama vendor'daki
// dosya artık ZATEN gzip'li (62,8 MB ham depoya konmaz), yani o tarayıcıda
// yedek de açılamazdı. Yani yedek, var olmayan bir durumu kurtarıyordu.
// Kaldırıldı; eksik yetenek SEBEBİYLE yazılıyor (aşağıda _sgGunzip).
//
// Vendor dosyası depoda KALIYOR: gömülü varlığın kaynağı ve LGPL-2.1'in
// "kütüphane değiştirilebilir olmalı" koşulunun karşılığı.

// Tek seferlik yükleme sözü. İkinci çağrı aynı sözü döner → varlık iki kez
// açılmaz, WASM iki kez derlenmez.
var _sgOcctPromise = null;

function _sgNum(v){
  if(v === null || v === undefined || v === '') return NaN;
  var n = Number(v);
  return isFinite(n) ? n : NaN;
}

// Tipli diziye çevir — ZATEN doğru tipteyse olduğu gibi bırak. Worker yolunda
// diziler tipli geliyor; `new Float32Array(f32)` onları gereksizce kopyalardı.
function _sgTyped(Ctor, arr){
  if(arr === null || arr === undefined) return null;
  return (arr instanceof Ctor) ? arr : new Ctor(arr);
}

// OCCT fabrikasını bul: tarayıcıda vendorlu glue global `opencascade`
// bırakır. Node tarafında (testler) glue bir ESM DEĞİL — `export default`
// satırı vendor'a alınırken çıkarıldı — ama yine de `require` ile alınamıyor
// (modül.exports yazmıyor), bu yüzden testler fabrikayı `opts.factory` ile
// veriyor. Sessiz bir `null` yerine sebep yazılıyor.
function _sgOcctFactory(){
  if(typeof opencascade !== 'undefined') return opencascade;
  if(typeof self !== 'undefined' && self.opencascade) return self.opencascade;
  if(typeof window !== 'undefined' && window.opencascade) return window.opencascade;
  return null;
}

// ─── İLERLEME AŞAMALARI ─────────────────────────────────────────────────────
// Panel bu adlara göre yazı seçiyor:
//   reader   çekirdek hazırlanıyor — YALNIZ ilk içe aktarmada, gömülü .wasm
//            açılıp derlenirken (worker'da). Ağ YOK. ÖLÇÜLDÜ: 7,8 s.
//   parse    STEP çözümleniyor.
//   fuse     katılar TEK KATIYA birleştiriliyor (boolean). Yalnız dosyada
//            birden çok katı varsa görülür.
//   build    ağ örülüp sahne kuruluyor.
// Belirsiz aşamalara uydurma bir yüzde koymak — "%60" deyip 8 saniye
// beklemek — yalan olurdu; orada akan çubuk + geçen süre gösteriliyor.
var VE_STR_STAGES = ['reader', 'parse', 'fuse', 'build'];

// ═══════════════════════════════════════════════════════════════════════════
//  GEOMETRİ BORU HATTI — oku → BİRLEŞTİR → ağ ör → çıkar
// ═══════════════════════════════════════════════════════════════════════════
// TEK KAYNAK, İKİ ORTAM. Bu fonksiyon hem ana iş parçacığında doğrudan
// çağrılıyor hem de `toString()` ile worker Blob'una yazılıyor. İkinci bir
// kopya tutmak, iki yolun zamanla ayrışması demekti — ve ayrışma sessiz
// olurdu: worker yolu çalışırken yedek yol başka bir geometri üretirdi.
// Bu yüzden DIŞARIDAN HİÇBİR ŞEYE BAŞVURMAZ (yalnız `oc`, `bytes`, `opts`).
//
// ÇOK GÖVDELİ CAD DOSYASI TEK KATIYA İNER (kullanıcı kararı, 2026-08-25).
// Sebep ağ örme: birbirine değen ama AYRI duran katıların yüzey üçgenlemesi
// arayüzde uyuşmuyor (ÖLÇÜLDÜ, as1-tu-203: 1 800 köşeden yalnız 204'ü ortak),
// ve uyumsuz arayüz bir tet ağ örücüsü için kendi kendini kesen girdi demek.
// Uyumlu arayüz ancak B-Rep seviyesinde imprint & merge ile kurulur:
//
//   BRepAlgoAPI_Fuse (tek BOP, arguments=ilk · tools=geri kalanı)
//     → ShapeUpgrade_UnifySameDomain (iç duvarlar ve dikişler silinir)
//
// ÖLÇÜLDÜ (gerçek OCCT):
//   plaka + 2 kulak + 4 göbek (7 gövde) → 1 katı · 18 yüz ·  135 ms
//   3 değen kutu                        → 1 katı ·  6 yüz ·  119 ms
//   as1-tu-203 montajı (18 katı)        → 1 katı · 104 yüz · 15,5 s
//   hacim sapması: %0,00002
// Yani çok gövdeli bir PARÇADA birleştirme fark edilmiyor; saniyeler ancak
// cıvataları deliklerden geçen gerçek bir MONTAJDA görülüyor.
function _sgOcctPipeline(oc, bytes, opts){
  opts = opts || {};
  var ANY = oc.TopAbs_ShapeEnum.TopAbs_SHAPE;
  var SOLID = oc.TopAbs_ShapeEnum.TopAbs_SOLID;
  var FACE = oc.TopAbs_ShapeEnum.TopAbs_FACE;
  var simdi = function(){ return (typeof Date !== 'undefined' && Date.now) ? Date.now() : 0; };
  var sure = {};

  function sayim(shape, tip){
    var n = 0, ex = new oc.TopExp_Explorer_2(shape, tip, ANY);
    for(; ex.More(); ex.Next()) n++;
    ex.delete();
    return n;
  }
  function hacim(shape){
    var g = new oc.GProp_GProps_1();
    oc.BRepGProp.VolumeProperties_1(shape, g, false, false, false);
    var v = g.Mass();
    g.delete();
    return v;
  }
  // Emscripten C++ istisnası JS'e SAYI (işaretçi) olarak gelir; `err.message`
  // yoktur ve String(err) çıplak bir sayı basar. Kullanıcıya "20736120" demek,
  // hiçbir şey dememekten kötü: hata gibi değil, bozulmuş bir sayı gibi okunur.
  function hataMetni(err){
    if(err && err.message) return String(err.message);
    if(typeof err === 'number') return 'OCCT iç istisnası (#' + err + ')';
    return String(err);
  }

  function sinirKutusu(shape){
    var b = new oc.Bnd_Box_1();
    oc.BRepBndLib.Add(shape, b, true);
    if(b.IsVoid()){ b.delete(); return null; }
    var a = b.CornerMin(), c = b.CornerMax();
    var mn = [a.X(), a.Y(), a.Z()], mx = [c.X(), c.Y(), c.Z()];
    a.delete(); c.delete(); b.delete();
    var dx = mx[0] - mn[0], dy = mx[1] - mn[1], dz = mx[2] - mn[2];
    return { min: mn, max: mx, size: [dx, dy, dz], center: [(mn[0]+mx[0])/2, (mn[1]+mx[1])/2, (mn[2]+mx[2])/2],
             diag: Math.sqrt(dx*dx + dy*dy + dz*dz) };
  }

  // ── 1) OKU ────────────────────────────────────────────────────────────────
  var t = simdi();
  try { oc.FS.unlink('ve-in.step'); } catch(e){}
  oc.FS.writeFile('ve-in.step', bytes);
  var rd = new oc.STEPControl_Reader_1();
  if(rd.ReadFile('ve-in.step') !== oc.IFSelect_ReturnStatus.IFSelect_RetDone){
    // OCCT KENDİ TEŞHİSİNİ İSTENMEDEN YAZMIYOR (eski okuyucu yazıyordu).
    // PrintCheckLoad onu stdout'a döker, print/printErr kancası yakalar ve
    // hata mesajına iliştirilir — kullanıcı "dosya okunamadı" yerine SEBEBİ
    // görür. Çağrı `try` içinde: teşhis alınamaması asıl hatayı gizlemesin.
    try { rd.PrintCheckLoad(false, oc.IFSelect_PrintCount.IFSelect_ItemsByEntity); } catch(e2){}
    throw new Error('Dosya STEP olarak okunamadı. Dosya bozuk olabilir ya da desteklenmeyen bir sürümde yazılmış olabilir.');
  }
  rd.TransferRoots();
  var shape = rd.OneShape();
  sure.read = simdi() - t;
  if(!shape || shape.IsNull()){
    try { rd.PrintCheckTransfer(false, oc.IFSelect_PrintCount.IFSelect_ItemsByEntity); } catch(e2){}
    throw new Error('STEP dosyası okundu ama içinde katı/yüzey geometrisi yok (yalnız eğri, nokta ya da boş montaj olabilir).');
  }

  // ── 2) KATILARI TOPLA ─────────────────────────────────────────────────────
  var kati = [], ex = new oc.TopExp_Explorer_2(shape, SOLID, ANY);
  for(; ex.More(); ex.Next()) kati.push(oc.TopoDS.Solid_1(ex.Current()));
  ex.delete();
  var onceKati = kati.length;
  var onceHacim = onceKati ? hacim(shape) : 0;

  // ── 3) BOOLEAN ────────────────────────────────────────────────────────────
  var fuse = { istendi: false, ok: false, once: onceKati, sonra: onceKati, ms: 0, hata: '',
               hacimOnce: onceHacim, hacimSonra: onceHacim };
  if(onceKati > 1 && opts.fuse !== false){
    fuse.istendi = true;
    if(opts.onStage) opts.onStage('fuse');
    t = simdi();
    try {
      var arg = new oc.TopTools_ListOfShape_1(); arg.Append_1(kati[0]);
      var tool = new oc.TopTools_ListOfShape_1();
      for(var i = 1; i < kati.length; i++) tool.Append_1(kati[i]);
      var bop = new oc.BRepAlgoAPI_Fuse_1();
      bop.SetArguments(arg); bop.SetTools(tool);
      bop.Build();
      if(bop.IsDone()){
        // BİRLEŞTİRME BURADA BİTTİ. Şekil buradan itibaren TEK KATI ve bu
        // sonuç KORUNUR — aşağıdaki sadeleştirme onu bozamaz.
        shape = bop.Shape();
        fuse.ok = true;

        // ── DİKİŞ SADELEŞTİRME AYRI VE İSTEĞE BAĞLI ────────────────────────
        // UnifySameDomain, iç arayüzden kalan dikiş yüzeylerini birleştirir
        // (aynı düzlemin iki parçası tek CAD yüzü olur). Güzel ama ŞART DEĞİL.
        //
        // ÖLÇÜLDÜ (kullanıcının braketi, AP242, 7 gövde): fuse 668 ms'de
        // sorunsuz 1 katı üretiyor, ama YÜZ sadeleştirme OCCT içinde istisna
        // atıyor. Eskiden ikisi tek try içindeydi → başarılı birleştirme de
        // çöpe gidiyor ve panel "7 ayrı katı — birleştirilemedi (20736120)"
        // diyordu. O sayı bir mesaj bile değildi: emscripten'in istisna
        // işaretçisi.
        //
        // Kademeler ölçülerek seçildi (aynı braket):
        //   kenar+yüz          → İSTİSNA
        //   yalnız yüz         → İSTİSNA
        //   yalnız KENAR       → OK, 1 katı · 238 yüz · 41 ms
        // Yani en agresif kademeden başlayıp düşüyoruz; hiçbiri tutmazsa
        // sadeleştirme ATLANIR ve birleştirme yine geçerlidir.
        fuse.sadelestirme = 'atlandı';
        var kademeler = [
          { ad: 'tam',   kenar: true, yuz: true  },
          { ad: 'kenar', kenar: true, yuz: false }
        ];
        for(var ki = 0; ki < kademeler.length; ki++){
          try {
            var u = new oc.ShapeUpgrade_UnifySameDomain_2(shape, kademeler[ki].kenar, kademeler[ki].yuz, false);
            u.Build();
            var us = u.Shape();
            if(us && !us.IsNull()){
              shape = us;
              fuse.sadelestirme = kademeler[ki].ad;
              break;
            }
          } catch(e2){ /* bir alt kademeyi dene */ }
        }
      } else {
        fuse.hata = 'çekirdek birleştirmeyi tamamlayamadı';
      }
    } catch(err){
      fuse.hata = hataMetni(err);
    }
    fuse.ms = simdi() - t;
    sure.fuse = fuse.ms;
    fuse.sonra = sayim(shape, SOLID);
    fuse.hacimSonra = hacim(shape);
  }

  // ── 4) AĞ ÖR ──────────────────────────────────────────────────────────────
  if(opts.onStage) opts.onStage('build');
  var bb = sinirKutusu(shape);
  // Oran → MUTLAK sapma. occt-import-js `bounding_box_ratio`'yu kendi
  // çeviriyordu; ham OCCT mutlak mm istiyor, çeviri artık burada ve AÇIK.
  var oran = (opts.deflection && opts.deflection.linear) || 0.0005;
  var linear = Math.max(1e-4, (bb ? bb.diag : 100) * oran);
  var angular = (opts.deflection && opts.deflection.angular) || 0.5;
  t = simdi();
  new oc.BRepMesh_IncrementalMesh_2(shape, linear, false, angular, false);
  sure.mesh = simdi() - t;

  // ── 5) ÜÇGENLERİ VE YÜZ ARALIKLARINI ÇIKAR ───────────────────────────────
  // Normaller YÜZ İÇİNDE ortalanıyor: CAD'in doğru gölgelemesi budur —
  // yüzey içinde pürüzsüz, yüz sınırında keskin. Bütün parçada ortalamak
  // keskin kenarları yuvarlatır ve teknik görüntüyü yalanlar.
  t = simdi();
  var pos = [], nrm = [], idx = [], yuzler = [], triTop = 0;
  var fe = new oc.TopExp_Explorer_2(shape, FACE, ANY), fi = 0;
  for(; fe.More(); fe.Next(), fi++){
    var f = oc.TopoDS.Face_1(fe.Current());
    var loc = new oc.TopLoc_Location_1();
    var h = oc.BRep_Tool.Triangulation(f, loc);
    if(h.IsNull()){
      // Üçgenlenemeyen yüz SESSİZCE atlanmaz: kimliği listede kalır, yalnız
      // üçgeni yoktur. Aksi hâlde sonraki yüzlerin kimliği KAYAR.
      yuzler.push({ index: fi, first: -1, last: -1, triCount: 0 });
      loc.delete();
      continue;
    }
    var tri = h.get();
    var kimlik = loc.IsIdentity();
    var trsf = kimlik ? null : loc.Transformation();
    var ters = (f.Orientation_1() === oc.TopAbs_Orientation.TopAbs_REVERSED);
    var nN = tri.NbNodes(), nT = tri.NbTriangles();
    var v0 = pos.length / 3;

    var yerel = new Float64Array(nN * 3);
    for(var k = 1; k <= nN; k++){
      var pt = tri.Node(k);
      if(!kimlik){ var pt2 = pt.Transformed(trsf); pt.delete(); pt = pt2; }
      yerel[(k-1)*3] = pt.X(); yerel[(k-1)*3+1] = pt.Y(); yerel[(k-1)*3+2] = pt.Z();
      pt.delete();
    }
    var acc = new Float64Array(nN * 3);
    var yt = new Int32Array(nT * 3);
    for(var j = 1; j <= nT; j++){
      var tr = tri.Triangle(j);
      var a = tr.Value(1) - 1, b = tr.Value(2) - 1, c = tr.Value(3) - 1;
      tr.delete();
      // Ters yönelimli yüzde sarım çevriliyor: yoksa normal parçanın İÇİNE
      // bakar ve tek yüzlü çizimde o yüzey görünmez olur.
      if(ters){ var sw = b; b = c; c = sw; }
      yt[(j-1)*3] = a; yt[(j-1)*3+1] = b; yt[(j-1)*3+2] = c;
      var ax = yerel[a*3], ay = yerel[a*3+1], az = yerel[a*3+2];
      var ux = yerel[b*3] - ax, uy = yerel[b*3+1] - ay, uz = yerel[b*3+2] - az;
      var vx = yerel[c*3] - ax, vy = yerel[c*3+1] - ay, vz = yerel[c*3+2] - az;
      var nx = uy*vz - uz*vy, ny = uz*vx - ux*vz, nz = ux*vy - uy*vx;
      acc[a*3] += nx; acc[a*3+1] += ny; acc[a*3+2] += nz;
      acc[b*3] += nx; acc[b*3+1] += ny; acc[b*3+2] += nz;
      acc[c*3] += nx; acc[c*3+1] += ny; acc[c*3+2] += nz;
    }
    for(var q = 0; q < nN; q++){
      pos.push(yerel[q*3], yerel[q*3+1], yerel[q*3+2]);
      var gx = acc[q*3], gy = acc[q*3+1], gz = acc[q*3+2];
      var L = Math.sqrt(gx*gx + gy*gy + gz*gz) || 1;
      nrm.push(gx/L, gy/L, gz/L);
    }
    for(var w = 0; w < nT; w++) idx.push(v0 + yt[w*3], v0 + yt[w*3+1], v0 + yt[w*3+2]);
    yuzler.push({ index: fi, first: triTop, last: triTop + nT - 1, triCount: nT });
    triTop += nT;
    loc.delete();
  }
  fe.delete();
  sure.extract = simdi() - t;

  // ── 6) İÇ ARAYÜZ TEMİZLİĞİ ───────────────────────────────────────────────
  // Birbirine DEĞEN gövdeler birleşince ortak yüzey iki KOPYA olarak kalabilir
  // (her gövdeden bir tane, normalleri ters). Normalde UnifySameDomain'in yüz
  // kademesi bunları siler — ama o kademe bu geometride istisna atıyor
  // (yukarıda), yani kopyalar yüzeyde kalıyor.
  //
  // ÖLÇÜLDÜ (kullanıcının braketi): 6 çakışan yüz çifti → üçgenlemede 26
  // NON-MANIFOLD kenar (bir kenarı 4 üçgen paylaşıyor). Yüzey bu hâldeyken
  // TetGen "kendini kesiyor" diyip duruyor — yani birleştirme başarılı olsa
  // bile AĞ ÖRÜLEMİYOR, ki bu işin bütün amacıydı.
  //
  // Çift bulunursa İKİSİ DE atılır: bu yüzey artık parçanın İÇİNDE kalıyor,
  // dış sınırın parçası değil. Kalan yüzlerin KİMLİĞİ DEĞİŞMEZ (`f.index`
  // TopExp sırasından geliyor, silmekten etkilenmiyor) — sınır koşulları
  // kimliğe bağlanacak, kimlik kayarsa hepsi düşerdi.
  t = simdi();
  var temizlik = { cift: 0, atilanYuz: 0, atilanUcgen: 0 };
  (function(){
    var ozet = [];
    yuzler.forEach(function(f){
      if(!f.triCount) return;
      var A = 0, cx = 0, cy = 0, cz = 0, nx = 0, ny = 0, nz = 0;
      for(var tr = f.first; tr <= f.last; tr++){
        var ia = idx[tr*3], ib = idx[tr*3+1], ic = idx[tr*3+2];
        var ax = pos[ia*3], ay = pos[ia*3+1], az = pos[ia*3+2];
        var ux = pos[ib*3] - ax, uy = pos[ib*3+1] - ay, uz = pos[ib*3+2] - az;
        var vx = pos[ic*3] - ax, vy = pos[ic*3+1] - ay, vz = pos[ic*3+2] - az;
        var X = uy*vz - uz*vy, Y = uz*vx - ux*vz, Z = ux*vy - uy*vx;
        var ar = Math.sqrt(X*X + Y*Y + Z*Z) / 2;
        A += ar; nx += X; ny += Y; nz += Z;
        cx += ar * (ax + pos[ib*3] + pos[ic*3]) / 3;
        cy += ar * (ay + pos[ib*3+1] + pos[ic*3+1]) / 3;
        cz += ar * (az + pos[ib*3+2] + pos[ic*3+2]) / 3;
      }
      if(A > 0) ozet.push({ f: f, A: A, c: [cx/A, cy/A, cz/A], n: [nx, ny, nz] });
    });
    var tol = Math.max(1e-4, (bb ? bb.diag : 100) * 1e-6);
    var at = {};
    for(var i = 0; i < ozet.length; i++){
      if(at[ozet[i].f.index]) continue;
      for(var j = i + 1; j < ozet.length; j++){
        if(at[ozet[j].f.index]) continue;
        var a = ozet[i], c = ozet[j];
        if(Math.abs(a.A - c.A) > 1e-6 * Math.max(a.A, c.A)) continue;
        var d = Math.sqrt(Math.pow(a.c[0]-c.c[0],2) + Math.pow(a.c[1]-c.c[1],2) + Math.pow(a.c[2]-c.c[2],2));
        if(d > tol) continue;
        var la = Math.sqrt(a.n[0]*a.n[0]+a.n[1]*a.n[1]+a.n[2]*a.n[2]);
        var lc = Math.sqrt(c.n[0]*c.n[0]+c.n[1]*c.n[1]+c.n[2]*c.n[2]);
        if(!la || !lc) continue;
        // TERS normal ŞART: aynı yöne bakan iki çakışık yüz iç arayüz değil,
        // sıfır kalınlıklı bir kabuk olurdu — onu atmak parçayı delerdi.
        if((a.n[0]*c.n[0] + a.n[1]*c.n[1] + a.n[2]*c.n[2]) / (la*lc) > -0.99) continue;
        at[a.f.index] = 1; at[c.f.index] = 1;
        temizlik.cift++;
        break;
      }
    }
    if(!temizlik.cift) return;

    // Üçgenleri süz, köşeleri yeniden numarala (kullanılmayan köşe bırakmak
    // ağ üretecinde "başıboş nokta" demek).
    var yeniIdx = [], yeniYuz = [], top = 0;
    var kullanilan = {}, harita = {};
    yuzler.forEach(function(f){
      if(!f.triCount || at[f.index]){
        if(at[f.index]){ temizlik.atilanYuz++; temizlik.atilanUcgen += f.triCount; }
        return;
      }
      for(var tr = f.first; tr <= f.last; tr++)
        for(var k = 0; k < 3; k++) kullanilan[idx[tr*3+k]] = 1;
      yeniYuz.push({ index: f.index, first: top, last: top + f.triCount - 1, triCount: f.triCount });
      top += f.triCount;
    });
    var yeniPos = [], yeniNrm = [], say = 0;
    for(var v = 0; v < pos.length / 3; v++){
      if(!kullanilan[v]) continue;
      harita[v] = say++;
      yeniPos.push(pos[v*3], pos[v*3+1], pos[v*3+2]);
      yeniNrm.push(nrm[v*3], nrm[v*3+1], nrm[v*3+2]);
    }
    yuzler.forEach(function(f){
      if(!f.triCount || at[f.index]) return;
      for(var tr = f.first; tr <= f.last; tr++)
        yeniIdx.push(harita[idx[tr*3]], harita[idx[tr*3+1]], harita[idx[tr*3+2]]);
    });
    pos = yeniPos; nrm = yeniNrm; idx = yeniIdx; yuzler = yeniYuz; triTop = top;
  })();
  sure.clean = simdi() - t;

  return {
    positions: new Float32Array(pos),
    normals: new Float32Array(nrm),
    indices: new Uint32Array(idx),
    faces: yuzler,
    triCount: triTop,
    solidCount: fuse.istendi ? fuse.sonra : onceKati,
    bbox: bb,
    volume: fuse.hacimSonra,
    fuse: fuse,
    interfaceCleanup: temizlik,
    deflectionLinearMm: linear,
    ms: sure
  };
}

// ─── WORKER ─────────────────────────────────────────────────────────────────
// STEP çözümlemesi ANA İŞ PARÇACIĞINDA yapılmaz. Ölçüldü: 4 688 üçgenlik bir
// montaj 396 ms; gerçek bir braket bunun 10–50 katı olabilir, yani saniyelerce
// donmuş arayüz. Donma yalnız çirkin değil YANILTICI: kullanıcı programın
// çöktüğünü sanıp sekmeyi kapatır.
//
// PAKETİN KENDİ WORKER'I (`occt-import-js-worker.js`) KULLANILMIYOR — üç
// eksiği var: (a) `locateFile` ile GÖRELİ yol çözüyor, yani worker dosyasının
// glue'nun yanında durmasını şart koşuyor; MFSim'in tek dosya sürümünde o
// dosya yok. (b) ilerleme bildirmiyor. (c) sonucu KOPYALAYARAK geri veriyor;
// yüz binlerce üçgende bu ikinci bir maliyet.
//
// Bizimki BLOB'DAN kuruluyor: glue metni + aşağıdaki köprü tek bir Blob'a
// yazılıp `new Worker(blobURL)` ile açılıyor. Böylece hiçbir dosya yolu
// varsayımı yok — glue nereden geldiyse worker da oradan gelmiş oluyor.
var VE_STR_WORKER_BRIDGE = [
  'var _oc = null, _log = [];',
  // base64 çözme ve gzip açma DA worker'da: 17,5 MB'lık dizgiyi ana iş
  // parçacığında çözmek saniyelik bir donma demekti — kaçındığımız şeyin
  // ta kendisi.
  'function _b64(s){ var b = atob(s), u = new Uint8Array(b.length);',
  '  for(var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }',
  'function _gunzip(u){',
  '  if(typeof DecompressionStream !== "function") return Promise.reject(new Error("Bu tarayici gomulu cekirdegi acamiyor (DecompressionStream yok)."));',
  '  return new Response(new Blob([u]).stream().pipeThrough(new DecompressionStream("gzip"))).arrayBuffer();',
  '}',
  'self.onmessage = function(e){',
  '  var d = e.data || {};',
  '  if(d.type === "init"){',
  '    try {',
  '      var bin = d.wasmBinary ? Promise.resolve(d.wasmBinary) : _gunzip(_b64(d.wasmB64));',
  '      bin.then(function(wasm){',
  '        return opencascade({ wasmBinary: new Uint8Array(wasm),',
  '          print: function(s){ _log.push(String(s)); },',
  '          printErr: function(s){ _log.push(String(s)); } });',
  '      })',
  '      .then(function(m){ _oc = m; self.postMessage({ type:"ready" }); })',
  '      ["catch"](function(err){ self.postMessage({ type:"fatal", error:String((err && err.message) || err) }); });',
  '    } catch(err){ self.postMessage({ type:"fatal", error:String((err && err.message) || err) }); }',
  '    return;',
  '  }',
  '  if(d.type === "step"){',
  '    if(!_oc){ self.postMessage({ type:"error", id:d.id, error:"cekirdek hazir degil" }); return; }',
  '    _log.length = 0;',
  '    var g;',
  // Aşama bildirimi worker'dan geliyor: boolean saniyeler sürebiliyor ve
  // kullanıcı o sırada NE olduğunu görmeli ("çözümleniyor" yazıp 15 saniye
  // beklemek, ilerleme göstergesinin var oluş sebebini yok ederdi).
  '    var onStage = function(ad){ self.postMessage({ type:"stage", id:d.id, stage:ad }); };',
  '    try { g = _sgOcctPipeline(_oc, new Uint8Array(d.bytes), { deflection:d.deflection, fuse:d.fuse, onStage:onStage }); }',
  '    catch(err){ self.postMessage({ type:"error", id:d.id, error:String((err && err.message) || err), log:_log.slice(0,4) }); return; }',
  // Tipli diziler TRANSFER ediliyor — sıfır kopya. Kopyalanan bir dizi yüz
  // binlerce üçgende hem bellek hem duraklama demek.
  '    self.postMessage({ type:"result", id:d.id, geom:g, log:_log.slice(0,4) },',
  '      [g.positions.buffer, g.normals.buffer, g.indices.buffer]);',
  '  }',
  '};'
].join('\n');

var _sgWorkerPromise = null;
var _sgWorkerUrl = '';
var _sgJobSeq = 0;

// ─── GÖMÜLÜ OKUYUCU ─────────────────────────────────────────────────────────
// .wasm ARTIK UYGULAMANIN İÇİNDE (js/structural-occt-wasm.js, gzip+base64).
// Eskiden `vendor/` yolundan çekiliyordu; iki sorunu vardı:
//   1) ÇEVRİMDIŞI ÇALIŞMIYORDU — MFSim tek dosya olarak indirilip kullanılıyor,
//      yanında vendor/ olmayan bir kurulumda STEP hiç açılmıyordu.
//   2) Kullanıcıya YANLIŞ ŞEYİ anlatıyordu: yükleme göstergesi PARÇANIN
//      işlendiğini söylemeli, kütüphanenin indiğini değil.
//
// AÇILIŞTA YÜKLENMEZ: index.html'de `type="text/x-mfsim-asset"` ile işaretli,
// yani ne tarayıcı ne de MFSimLoader onu çalıştırır. İlk STEP içe aktarmasında
// buradan talep üzerine çalıştırılıyor (js/mount-report-assets.js ile aynı
// kalıp — bkz. cp-mount-report.js _mntReportEnsureAssets).
var _sgAssetPromise = null;

function _sgRunAsset(sel, hazirMi){
  return new Promise(function(resolve, reject){
    if(typeof document === 'undefined') return reject(new Error('Gömülü varlık yalnız tarayıcıda okunur.'));
    if(hazirMi()) return resolve();
    var ph = document.querySelector(sel);
    if(!ph) return reject(new Error('Gömülü varlık sayfada yok: ' + sel));
    var s = document.createElement('script');
    if(ph.src){
      // Modüler kurulum (index.html): yer tutucunun src'si var.
      s.src = ph.src;
      s.onload = function(){ hazirMi() ? resolve() : reject(new Error('Gömülü varlık çalıştı ama içerik gelmedi: ' + sel)); };
      s.onerror = function(){ reject(new Error('Gömülü varlık yüklenemedi: ' + ph.src)); };
      document.head.appendChild(s);
    } else {
      // Tek dosya sürümü: içerik ZATEN sayfada, yalnız çalıştırılmamış
      // (type javascript değil). Kopyala ve çalıştır — AĞ YOK.
      s.textContent = ph.textContent;
      document.head.appendChild(s);
      hazirMi() ? resolve() : reject(new Error('Gömülü varlık çalıştı ama içerik gelmedi: ' + sel));
    }
  });
}

// Gömülü .wasm'ın gzip+base64 dizgisini döndürür. AÇMAZ — açma işi worker'da
// (3,96 MB'lık dizgiyi ana iş parçacığında çözmek yüz milisaniyelik donma).
function _sgEmbeddedWasmB64(){
  if(_sgAssetPromise) return _sgAssetPromise;
  var hazir = function(){ return typeof window !== 'undefined' && !!window.VE_STR_OCCT_WASM_GZ_B64; };
  var p = _sgRunAsset('script[data-mfsim-asset="occt-wasm"]', hazir)
    .then(function(){ return window.VE_STR_OCCT_WASM_GZ_B64; });
  _sgAssetPromise = p;
  p['catch'](function(){ if(_sgAssetPromise === p) _sgAssetPromise = null; });
  return p;
}

// Worker'a verilecek glue KAYNAĞI — AĞSIZ. Tek dosya sürümünde vendor script'i
// sayfada INLINE durur (type="text/x-mfsim-defer" olduğu için tarayıcı onu
// çalıştırmaz, MFSimLoader kopyasını çalıştırır → yer tutucunun metni yerinde
// kalır). Modüler kurulumda src'den çekilir.
function _sgGlueSource(){
  var ph = (typeof document !== 'undefined')
    ? document.querySelector('script[data-mfsim-occt-glue]') : null;
  if(ph && ph.textContent && ph.textContent.length > 1000) return Promise.resolve(ph.textContent);
  var url = (ph && ph.src) || 'vendor/opencascade.js';
  if(typeof fetch !== 'function') return Promise.reject(new Error('OCCT çekirdeğinin kod dosyası okunamadı.'));
  return fetch(url).then(function(res){
    if(!res.ok) throw new Error('OCCT çekirdeğinin kod dosyası bulunamadı: ' + url);
    return res.text();
  });
}

// Ana iş parçacığında gzip açma — yalnız worker YOKSA kullanılır.
function _sgGunzipMain(b64){
  if(typeof DecompressionStream !== 'function'){
    return Promise.reject(new Error('Bu tarayıcı gömülü okuyucuyu açamıyor (DecompressionStream yok).'));
  }
  var bin = atob(b64), u = new Uint8Array(bin.length);
  for(var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return new Response(new Blob([u]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
}

function _sgWorkerSupported(){
  return typeof Worker === 'function' && typeof Blob === 'function'
      && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function'
      && typeof fetch === 'function';
}

// Worker'ı TEK SEFER kur ve yaşat: ikinci içe aktarma 7,3 MB'ı yeniden
// indirmez, WASM'ı yeniden derlemez.
function veStrOcctWorker(opts){
  opts = opts || {};
  if(_sgWorkerPromise && !opts.force) return _sgWorkerPromise;
  if(!_sgWorkerSupported()) return Promise.reject(new Error('Bu tarayıcıda Worker yok.'));

  var onp = opts.onProgress || function(){};

  // GÖMÜLÜ okuyucu ÖNCE denenir — ağ yok, çevrimdışı çalışır. Yalnız o
  // bulunamazsa (varlık üretilmemiş, tarayıcı DecompressionStream bilmiyor)
  // `vendor/` yolundan indirmeye düşülür; o zaman panel "indiriliyor" der.
  var kaynak = opts.wasmBinary
    ? Promise.resolve({ wasmBinary: opts.wasmBinary, url: '(bellek)' })
    : _sgEmbeddedWasmB64().then(function(b64){ return { wasmB64: b64, url: '(gömülü)' }; });

  var out = kaynak.then(function(got){
    onp('reader', {});
    return _sgGlueSource().then(function(glue){
      // Boru hattı worker'a KAYNAK METİN olarak gidiyor (toString). Tek
      // kaynak kuralı: ana iş parçacığı yedeği ile worker aynı fonksiyonu
      // koşuyor, ikinci bir kopya yok.
      var blob = new Blob([glue, '\n;var _sgOcctPipeline = ', _sgOcctPipeline.toString(), ';\n',
                           VE_STR_WORKER_BRIDGE], { type: 'text/javascript' });
      var url = URL.createObjectURL(blob);
      var w = new Worker(url);
      // Blob URL'i KURULUMDAN HEMEN SONRA bırak: worker çalışmaya devam eder
      // (URL yalnız `new Worker` anında gerekli), tutulursa 96 KB'lık blob
      // her yeniden kurulumda bellekte birikirdi.
      try { URL.revokeObjectURL(url); } catch(e){}
      return new Promise(function(resolve, reject){
        function bitir(err){
          // Kurulum başarısızsa worker'ı ÖLDÜR — yaşayan bir worker WASM
          // belleğini tutmaya devam eder.
          try { w.terminate(); } catch(e2){}
          reject(err);
        }
        w.onmessage = function(e){
          if(e.data && e.data.type === 'ready'){ w.onmessage = null; w.onerror = null; resolve({ worker: w, wasmUrl: got.url }); }
          else if(e.data && e.data.type === 'fatal'){ bitir(new Error(e.data.error)); }
        };
        w.onerror = function(err){ bitir(new Error('OCCT çekirdeği worker içinde açılamadı: ' + ((err && err.message) || 'bilinmeyen hata'))); };
        // Gömülü yolda worker'a giden şey 3,96 MB'lık BASE64 DİZGİ; açma
        // (atob + gunzip) ve derleme worker'da yapılıyor → ana iş parçacığı
        // hiç durmuyor. Yedek yolda hazır .wasm tamponu gider; transfer
        // EDİLMİYOR (tek seferlik memcpy ucuz, çağıranın tamponu detach olmasın).
        w.postMessage({ type: 'init', wasmBinary: got.wasmBinary, wasmB64: got.wasmB64 });
      });
    });
  });

  if(!opts.force) _sgWorkerPromise = out;
  // Kurulum başarısızsa sözü UNUT: kullanıcı dosyayı yerine koyup yeniden
  // denediğinde ilk denemenin hatası sonsuza kadar yapışmasın.
  out['catch'](function(){ if(_sgWorkerPromise === out) _sgWorkerPromise = null; });
  return out;
}

// Worker üzerinden içe aktar. Ana iş parçacığı BOŞTA kalır → panelin ilerleme
// animasyonu gerçekten akar (donmuş bir çubuk, çubuk olmamasından kötüdür).
function _sgImportViaWorker(bytes, meta, opts, onp){
  return veStrOcctWorker(opts).then(function(ctx){
    var id = ++_sgJobSeq;
    onp('parse', {});
    return new Promise(function(resolve, reject){
      function onMsg(e){
        var d = e.data || {};
        if(d.id !== id) return;
        // Aşama bildirimi worker'dan geliyor: boolean saniyeler sürebiliyor,
        // kullanıcı o sırada NE olduğunu görmeli.
        if(d.type === 'stage'){ onp(d.stage, {}); return; }
        ctx.worker.removeEventListener('message', onMsg);
        if(d.type === 'error'){ resolve({ ok: false, error: _sgWithDiag('OCCT çekirdeği dosyayı işlerken durdu: ' + d.error, d.log) }); return; }
        if(d.type !== 'result'){ reject(new Error('Worker beklenmeyen yanıt verdi: ' + d.type)); return; }
        meta.wasmUrl = ctx.wasmUrl;
        meta.worker = true;
        var res = veStrNormalizeImport(d.geom, meta);
        if(!res.ok) res.error = _sgWithDiag(res.error, d.log);
        resolve(res);
      }
      ctx.worker.addEventListener('message', onMsg);
      // STEP baytları TRANSFER EDİLİYOR (kopya yok). Çağıranın tamponu
      // detach olur; bu yüzden panel kaynağı ayrıca saklıyor.
      var copy = bytes.slice();
      ctx.worker.postMessage({ type: 'step', id: id, bytes: copy.buffer,
                               deflection: meta.deflection, fuse: opts.fuse }, [copy.buffer]);
    });
  });
}

// STEP okuyucusunu TALEP ÜZERİNE yükler (7.3 MB — açılışta yüklenmez).
// opts.wasmUrls   : aday yolları ez (test/kurulum)
// opts.factory    : occt fabrikasını ez (test)
// opts.wasmBinary : .wasm'ı doğrudan ver (Node testleri — fetch yok)
function veStrOcctReady(opts, onProgress){
  opts = opts || {};
  var onp = onProgress || opts.onProgress || function(){};
  if(_sgOcctPromise && !opts.force) return _sgOcctPromise;

  var factory = opts.factory || _sgOcctFactory();
  if(!factory){
    return Promise.reject(new Error('OCCT çekirdeği yüklenemedi: vendor/opencascade.js sayfaya eklenmemiş.'));
  }

  var p;
  if(opts.wasmBinary){
    p = Promise.resolve({ buffer: opts.wasmBinary, url: '(bellek)' });
  } else {
    p = _sgEmbeddedWasmB64()
      .then(function(b64){ return _sgGunzipMain(b64).then(function(buf){ return { buffer: new Uint8Array(buf), url: '(gömülü)' }; }); });
  }
  p = p.then(function(got){ onp('reader', {}); return got; });

  // OCCT kendi teşhisini stdout'a yazar ("Line 2: Incorrect syntax: unexpected
  // QUID, expecting STEP" gibi). Varsayılanda bu console'a düşer ve KULLANICI
  // GÖRMEZ — kullanıcı yalnız "dosya okunamadı" der. Oysa okuyanın ihtiyacı
  // olan tek şey o satırdır. Yakalanıp hata mesajına ekleniyor (ham İngilizce:
  // kütüphanenin kendi teşhisi, çevirmek yanlış tercüme riski demek).
  var log = [];
  var out = p.then(function(got){
    return factory({
      wasmBinary: got.buffer,
      print: function(s){ log.push(String(s)); },
      printErr: function(s){ log.push(String(s)); }
    }).then(function(occt){
      occt._veWasmUrl = got.url;
      occt._veLog = log;
      return occt;
    });
  });

  if(!opts.force) _sgOcctPromise = out;
  // Yükleme başarısızsa sözü UNUT: kullanıcı .wasm'ı yerine koyup yeniden
  // denediğinde ilk denemenin hatası sonsuza kadar yapışmasın.
  out['catch'](function(){ if(_sgOcctPromise === out) _sgOcctPromise = null; });
  return out;
}

// OCCT'nin ham teşhisini hata mesajına iliştirir. Gürültüyü eler ("ERR
// StepFile :" öneki, boş satır, tekrar) ve en fazla iki satır alır — panelin
// durum satırı tek cümlelik, oraya on satır dökmek sebebi gizlerdi.
function _sgWithDiag(msg, log){
  if(!log || !log.length) return msg;
  var seen = {}, keep = [];
  for(var i = 0; i < log.length && keep.length < 2; i++){
    var s = String(log[i]).replace(/^\s*\*+\s*/, '').replace(/\s*\*+\s*$/, '').trim();
    s = s.replace(/^ERR\s+\w+\s*:\s*/i, '').replace(/^Undefined\s+/i, '').trim();
    if(!s || seen[s]) continue;
    seen[s] = 1;
    keep.push(s);
  }
  return keep.length ? (msg + ' — okuyucunun teşhisi: ' + keep.join(' / ')) : msg;
}

// Yüklenmiş okuyucuyu BIRAK. İki kullanımı var: (a) kullanıcı .wasm'ı yerine
// koyup yeniden denemek istediğinde önbelleğe alınmış sözü temizlemek,
// (b) testlerde derlenmiş WASM örneğinin (7.3 MB) suite sonunda toplanabilmesi
// — yoksa jest worker'ı teardown'da zorla kapatılıyor.
function veStrOcctForget(){
  _sgOcctPromise = null;
  // Worker'ı da kapat — yaşayan bir worker WASM belleğini (yüzlerce MB'a
  // çıkabilir) tutmaya devam eder. Blob URL'i de bırakılır.
  var wp = _sgWorkerPromise;
  _sgWorkerPromise = null;
  if(wp && wp.then){
    wp.then(function(ctx){ try { ctx.worker.terminate(); } catch(e){} })['catch'](function(){});
  }
  if(_sgWorkerUrl && typeof URL !== 'undefined' && URL.revokeObjectURL){
    try { URL.revokeObjectURL(_sgWorkerUrl); } catch(e){}
    _sgWorkerUrl = '';
  }
}

// ─── Yüz kimliği ────────────────────────────────────────────────────────────
// Sınır koşulu bu dizgiye bağlanacak. mesh indisi + yüz indisi: ikisi de
// OCCT'nin B-rep gezinme sırasından gelir ve ağ inceliğiyle DEĞİŞMEZ (yukarıda
// ölçüldü). Ağ düğümü indisine bağlanmanın neden yanlış olduğu CLAUDE.md'de.
function veStrFaceKey(meshIndex, faceIndex){
  return 'm' + meshIndex + '/f' + faceIndex;
}

// ─── Sınır kutusu ───────────────────────────────────────────────────────────
// Kamerayı çerçevelemek, ölçek yazmak ve "parça gerçekten geldi mi" demek için.
function veStrGeomBBox(meshes){
  var mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  (meshes || []).forEach(function(m){
    var p = m.positions;
    if(!p) return;
    for(var i = 0; i < p.length; i += 3){
      for(var k = 0; k < 3; k++){
        var v = p[i + k];
        if(v < mn[k]) mn[k] = v;
        if(v > mx[k]) mx[k] = v;
      }
    }
  });
  if(!isFinite(mn[0])) return null;
  var size = [mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]];
  return {
    min: mn, max: mx, size: size,
    center: [(mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, (mn[2] + mx[2]) / 2],
    diag: Math.sqrt(size[0] * size[0] + size[1] * size[1] + size[2] * size[2])
  };
}

// ─── Ham occt çıktısı → MFSim modeli ───────────────────────────────────────
// SAF: DOM yok, THREE yok, yan etki yok. Testler bunu doğrudan koşturuyor.
//
// Tipli diziye ÇEVİRİYOR (Float32Array/Uint32Array): occt düz JS dizisi döner,
// bir braketin 100 bin üçgeninde bu dizi 2.4 MB'lık kutulanmış sayı demektir;
// THREE'ye vermeden önce zaten çevrilecek — bir kez, burada.
function veStrNormalizeImport(raw, meta){
  meta = meta || {};
  if(!raw || !raw.positions || !raw.indices){
    return { ok: false, error: 'Dosya STEP olarak okunamadı. Dosya bozuk olabilir ya da desteklenmeyen bir sürümde yazılmış olabilir.' };
  }
  if(!raw.triCount){
    return { ok: false, error: 'STEP dosyası okundu ama içinde katı/yüzey geometrisi yok (yalnız eğri, nokta ya da boş montaj olabilir).' };
  }

  // TEK PARÇA. Boolean'dan sonra dosyada kaç gövde olursa olsun model TEK bir
  // üçgen tamponu taşıyor; "kaç katı" bilgisi künyede AYRI duruyor (stats +
  // fuse). Eskiden her katı ayrı bir mesh'ti ve yüz kimliği `m<katı>/f<yüz>`
  // idi; birleştirmeden sonra katı diye bir bölünme kalmadığı için hepsi m0.
  var name = (meta.partName && String(meta.partName).trim()) || 'Parça';
  var faces = (raw.faces || []).map(function(f){
    return {
      id: veStrFaceKey(0, f.index),
      meshIndex: 0, meshName: name, faceIndex: f.index,
      first: f.first, last: f.last,
      triCount: f.triCount,
      color: null
    };
  });

  var mesh = {
    index: 0, name: name, color: null,
    positions: _sgTyped(Float32Array, raw.positions),
    normals: _sgTyped(Float32Array, raw.normals),
    indices: _sgTyped(Uint32Array, raw.indices),
    triCount: raw.triCount,
    faces: faces
  };

  var bbox = raw.bbox || veStrGeomBBox([mesh]);
  var fuse = raw.fuse || { istendi: false, ok: false, once: raw.solidCount || 1, sonra: raw.solidCount || 1, ms: 0, hata: '' };

  return {
    ok: true,
    fileName: meta.fileName || '',
    fileSize: _sgNum(meta.fileSize) || 0,
    importedAt: meta.importedAt || null,
    unit: VE_STR_GEOM_UNIT,
    deflection: meta.deflection || VE_STR_GEOM_DEFLECTION,
    deflectionLinearMm: raw.deflectionLinearMm || 0,
    wasmUrl: meta.wasmUrl || '',
    worker: !!meta.worker,
    root: null,
    meshes: [mesh],
    faces: faces,
    bbox: bbox,
    volume: raw.volume || 0,
    fuse: fuse,
    interfaceCleanup: raw.interfaceCleanup || { cift: 0, atilanYuz: 0, atilanUcgen: 0 },
    ms: raw.ms || {},
    stats: {
      meshCount: 1,
      solidCount: raw.solidCount || 1,
      solidCountBefore: fuse.once,
      faceCount: faces.length,
      triCount: raw.triCount,
      vertexCount: Math.floor((raw.positions.length || 0) / 3)
    }
  };
}

function veStrFaceOfTriangle(geom, meshIndex, triIndex){
  if(!geom || !geom.meshes || !geom.meshes[meshIndex]) return null;
  var fs = geom.meshes[meshIndex].faces || [];
  for(var i = 0; i < fs.length; i++){
    if(triIndex >= fs[i].first && triIndex <= fs[i].last) return fs[i];
  }
  return null;
}

// ─── Kalıcı künye ───────────────────────────────────────────────────────────
// node.data'ya YAZILAN kayıt. Üçgenler BURAYA GİRMEZ: bir braketin 100 bin
// üçgeni JSON'a çevrilince onlarca MB olur, üstelik alt-topolojiye GÖMÜLÜR
// (veSanitizeEmbeddedState'in hafifletmeye çalıştığı çarpımsal büyümenin ta
// kendisi). Ağır olan iki şey ayrı yerde durur:
//   • STEP KAYNAĞI  → node.data.geometry.source (kullanıcı isterse; asıl gerçek)
//   • ÜÇGENLER      → oturumluk önbellek (window.veStrGeometryCache)
// Üçgen zaten TÜRETİLMİŞ veridir: kaynaktan her an yeniden üretilir ve
// yakınsama çalışması için ZATEN farklı inceliklerde yeniden üretilecek.
function veStrGeomRecord(geom){
  if(!geom || !geom.ok) return null;
  return {
    fileName: geom.fileName,
    fileSize: geom.fileSize,
    importedAt: geom.importedAt,
    unit: geom.unit,
    deflection: geom.deflection,
    stats: geom.stats,
    bbox: geom.bbox,
    volume: geom.volume,
    // Birleştirmenin künyesi: kaç katı vardı, kaça indi, ne kadar sürdü,
    // hacim korundu mu. Panel bunu YAZIYOR — "1 katı" demek yetmez, boolean
    // sessizce başarısız olduysa kullanıcı bunu ancak ağ örerken anlardı.
    fuse: geom.fuse ? {
      istendi: !!geom.fuse.istendi, ok: !!geom.fuse.ok,
      once: geom.fuse.once, sonra: geom.fuse.sonra,
      ms: geom.fuse.ms, hata: geom.fuse.hata || '',
      hacimOnce: geom.fuse.hacimOnce, hacimSonra: geom.fuse.hacimSonra
    } : null,
    // Yüz künyesi HAFİF: kimlik + üçgen sayısı. Sınır koşulu kimliğe bağlanır,
    // üçgen sayısı yalnız "aynı dosya mı" denetimi için.
    faces: (geom.faces || []).map(function(f){
      return { id: f.id, meshName: f.meshName, triCount: f.triCount };
    })
  };
}

// ═══════════════════════════════════════════════════════════════════════════
//  STEP KAYNAĞI — node.data'DA DURMAZ
// ═══════════════════════════════════════════════════════════════════════════
// İlk sürümde STEP metni `node.data.geometry.source`'a yazılıyordu. ÖLÇÜLDÜ ve
// bu bir hataydı — üstelik dosya yalnız 140 KB'ken:
//
//   saveState() süresi        0,03 ms → 2,17 ms   (72×)
//   20 adımlık undo yığını    22 KB   → 3,14 MB
//
// Sebep: `saveState()` bütün `node.data`'yı `JSON.parse(JSON.stringify(...))`
// ile DERİN KOPYALIYOR ve yığın 50 adım tutuyor (js/state.js MAX_UNDO_STEPS).
// 3 MB'lık bir kaynakta bu ~150 MB yığın ve her mutasyonda ~46 ms demek.
//
// İKİNCİ VE DAHA SESSİZ SORUN: otomatik yedek `localStorage`'a yazılıyor
// (kota ~5-10 MB, js/settings.js) ve aynı temizleyiciden geçiyor. Çok MB'lık
// bir kaynak yedeği SESSİZCE bozardı — `simResults`'ın oraya hiç yazılmama
// sebebinin ta kendisi (settings.js'teki yorum bunu anlatıyor).
//
// ÇÖZÜM: kaynak OTURUMLUK depoda durur; yalnız kullanıcı projeyi DOSYAYA
// kaydederken içeri enjekte edilir (veStrSrcAttach) ve yüklenirken geri
// toplanır (veStrSrcHarvest). Undo yığını ve localStorage yedeği hafif kalır.
//
// Dosyaya gzip+base64 yazılır: STEP metni ~4,6–5,3× sıkışıyor, base64'ten
// sonra net kazanç ~4× (ölçüldü).
var _sgSrc = {};

// Saklanan (sıkıştırılmış) kaynağın üst sınırı. Sınır SIKIŞTIRILMIŞ boyuta
// konuyor çünkü proje dosyasına giden şey o; ~4× kazançla bu, kabaca 30 MB'lık
// ham STEP'e karşılık geliyor. Üstündekiler yalnız oturumda kalır ve panel
// bunu AÇIKÇA yazar.
var VE_STR_SRC_STORE_LIMIT = 8 * 1024 * 1024;

function _sgGzipB64(bytes){
  if(typeof CompressionStream !== 'function' || typeof Blob !== 'function'){
    return Promise.reject(new Error('Bu tarayıcıda CompressionStream yok.'));
  }
  return new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip')))
    .arrayBuffer()
    .then(function(buf){
      var u = new Uint8Array(buf), s = '';
      // Parça parça: tek `apply` çağrısında 30 MB'lık dizi yığın taşırır.
      for(var i = 0; i < u.length; i += 0x8000){
        s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
      }
      return btoa(s);
    });
}

// Kaynağı depola ve sıkıştırılmış biçimini ARKA PLANDA hazırla. Kaydetme
// senkron olduğu için sıkıştırma içe aktarma anında bir kez yapılıyor;
// kaydederken yalnız hazır dizgi okunuyor.
function veStrSrcSet(nodeId, bytes, name, size){
  var rec = { bytes: bytes, name: name || '', size: Number(size) || (bytes ? bytes.length : 0), gzB64: null };
  _sgSrc[nodeId] = rec;
  _sgGzipB64(bytes).then(function(b64){
    if(_sgSrc[nodeId] === rec) rec.gzB64 = (b64.length <= VE_STR_SRC_STORE_LIMIT) ? b64 : null;
  })['catch'](function(){ /* sıkıştırılamadı → dosyaya ham metin yazılır */ });
  return rec;
}
function veStrSrcGet(nodeId){ return _sgSrc[nodeId] || null; }
function veStrSrcClear(nodeId){
  if(nodeId) delete _sgSrc[nodeId];
  else _sgSrc = {};
}
// Kaynağın projeye YAZILIP yazılmayacağı — panel bunu kullanıcıya söylüyor.
function veStrSrcWillPersist(nodeId){
  var r = _sgSrc[nodeId];
  return !!(r && (r.gzB64 || r.bytes));
}

// Düğüm ağacında (alt-topolojiler dahil) `data.geometry` taşıyan her düğümü gez.
function _sgWalkGeomNodes(nodeArr, fn, _depth){
  _depth = _depth || 0;
  if(!nodeArr || !nodeArr.length || _depth > 8) return;
  nodeArr.forEach(function(n){
    if(n && n.data){
      if(n.data.geometry) fn(n);
      if(n.data.subTopology && n.data.subTopology.nodes){
        _sgWalkGeomNodes(n.data.subTopology.nodes, fn, _depth + 1);
      }
    }
  });
}

// PROJE DOSYASINA yazarken kaynağı enjekte et. YALNIZ dosya yolundan çağrılır
// (js/toolbar.js veSaveTopology) — otomatik localStorage yedeğinden ÇAĞRILMAZ,
// yoksa kota taşar (yukarıdaki gerekçe).
//
// KOPYALA-YAZ, ZORUNLU. Çağıranın verdiği yapı "temizlenmiş" görünse de CANLI
// nesneleri paylaşabiliyor: `veSanitizeNodesSubtopology` (topology.js) hiçbir
// şey değişmediyse AYNI diziyi döndürüyor ("gereksiz kopya üretme"). İlk
// sürümde yerinde yazılıyordu ve ÖLÇÜLDÜ: kaynak canlı `tab.state`'e sızıp
// otomatik localStorage yedeğine de giriyordu (yedek 46 KB — yani düzeltmenin
// tamamı boşa çıkıyordu). Burada dokunulan her düğüm KOPYALANIYOR; canlı
// duruma tek bir yazma bile yapılmıyor.
function veStrSrcAttach(tabs){
  var n = 0;

  function srcFor(nodeId){
    var r = _sgSrc[nodeId];
    if(!r) return null;
    if(r.gzB64) return { sourceGz: r.gzB64 };
    if(r.bytes && typeof TextDecoder !== 'undefined'){
      // Sıkıştırma henüz bitmediyse ya da tarayıcı desteklemiyorsa HAM yaz:
      // büyük ama DOĞRU. Veri kaybetmektense dosya şişsin.
      try { return { source: new TextDecoder('utf-8').decode(r.bytes) }; } catch(e){}
    }
    return null;
  }

  // Diziyi gez; yalnız DEĞİŞEN dal kopyalanır, gerisi paylaşılır (ucuz).
  function mapNodes(arr, _depth){
    if(!arr || !arr.length || _depth > 8) return arr;
    var degisti = false;
    var out = arr.map(function(node){
      if(!node || !node.data) return node;
      var yeniData = null;

      if(node.data.geometry){
        var ek = srcFor(node.id);
        if(ek){
          var g = {};
          for(var k in node.data.geometry) if(Object.prototype.hasOwnProperty.call(node.data.geometry, k)) g[k] = node.data.geometry[k];
          for(var k2 in ek) g[k2] = ek[k2];
          yeniData = {};
          for(var dk in node.data) if(Object.prototype.hasOwnProperty.call(node.data, dk)) yeniData[dk] = node.data[dk];
          yeniData.geometry = g;
          n++;
        }
      }

      var sub = node.data.subTopology;
      if(sub && sub.nodes){
        var altYeni = mapNodes(sub.nodes, _depth + 1);
        if(altYeni !== sub.nodes){
          if(!yeniData){
            yeniData = {};
            for(var dk2 in node.data) if(Object.prototype.hasOwnProperty.call(node.data, dk2)) yeniData[dk2] = node.data[dk2];
          }
          var yeniSub = {};
          for(var sk in sub) if(Object.prototype.hasOwnProperty.call(sub, sk)) yeniSub[sk] = sub[sk];
          yeniSub.nodes = altYeni;
          yeniData.subTopology = yeniSub;
        }
      }

      if(!yeniData) return node;
      degisti = true;
      var yeniNode = {};
      for(var nk in node) if(Object.prototype.hasOwnProperty.call(node, nk)) yeniNode[nk] = node[nk];
      yeniNode.data = yeniData;
      return yeniNode;
    });
    return degisti ? out : arr;
  }

  (tabs || []).forEach(function(t){
    var st = t && t.state;
    if(!st || !st.nodes) return;
    // `t.state` veBuildCleanTabState'in ürettiği YENİ nesne → alanını değiştirmek
    // güvenli; içindeki DİZİ canlı olabilir, o yüzden yerine kopyası konuyor.
    st.nodes = mapNodes(st.nodes, 0);
  });
  return n;
}

// PROJE YÜKLENİRKEN kaynağı node.data'dan ÇIKAR ve oturumluk depoya al.
// Böylece yüklenen proje de undo yığınını şişirmez. Eski projelerde alan ham
// metin (`source`), yenilerde gzip+base64 (`sourceGz`) — ikisi de kabul edilir.
function veStrSrcHarvest(state){
  if(!state || !state.nodes) return Promise.resolve(0);
  var isler = [];
  _sgWalkGeomNodes(state.nodes, function(node){
    var g = node.data.geometry;
    if(g.sourceGz){
      var gz = g.sourceGz;
      delete g.sourceGz;
      isler.push(_sgGunzipMain(gz).then(function(buf){
        _sgSrc[node.id] = { bytes: new Uint8Array(buf), name: g.fileName || '', size: g.fileSize || 0, gzB64: gz };
      })['catch'](function(){}));
    } else if(g.source){
      var txt = g.source;
      delete g.source;
      try {
        var bytes = new TextEncoder().encode(txt);
        veStrSrcSet(node.id, bytes, g.fileName || '', g.fileSize || bytes.length);
      } catch(e){}
    }
  });
  return Promise.all(isler).then(function(){ return isler.length; });
}

// ─── Oturumluk üçgen önbelleği ──────────────────────────────────────────────
// Takoz'un veMountResults'ı ve FEAD'in veFeadResults'ı ile AYNI kalıp ve AYNI
// TUZAK: proje değişince temizlenmezse yeni projede önceki projenin parçası
// görüntüleyicide durur. Kanca cp-structural.js _strForgetResults'ta.
function veStrGeomCacheSet(nodeId, geom){
  if(typeof window === 'undefined') return;
  if(!window.veStrGeometryCache) window.veStrGeometryCache = {};
  window.veStrGeometryCache[nodeId] = geom;
}
function veStrGeomCacheGet(nodeId){
  if(typeof window === 'undefined' || !window.veStrGeometryCache) return null;
  return window.veStrGeometryCache[nodeId] || null;
}
function veStrGeomCacheClear(nodeId){
  if(typeof window === 'undefined' || !window.veStrGeometryCache) return;
  if(nodeId) delete window.veStrGeometryCache[nodeId];
  else window.veStrGeometryCache = {};
}

// Ana iş parçacığı YEDEĞİ. Worker olmayan ortamlarda (eski tarayıcı, jsdom
// altındaki birim testleri) kullanılır. Donma pahasına ÇALIŞIR — hiç
// çalışmamasından iyidir; panel bu yola düşüldüğünü künyeye yazıyor.
function _sgImportMainThread(bytes, meta, opts, onp){
  return veStrOcctReady(opts, onp).then(function(oc){
    onp('parse', {});
    // Teşhis tamponunu bu okumadan ÖNCE boşalt: önceki dosyanın hatası bu
    // dosyanın mesajına yapışmasın.
    if(oc._veLog) oc._veLog.length = 0;
    var geom;
    try {
      geom = _sgOcctPipeline(oc, bytes, {
        deflection: meta.deflection,
        fuse: opts.fuse,
        onStage: function(ad){ onp(ad, {}); }
      });
    } catch(e){
      return { ok: false, error: _sgWithDiag('OCCT çekirdeği dosyayı işlerken durdu: ' + (e && e.message ? e.message : e), oc._veLog) };
    }
    meta.wasmUrl = oc._veWasmUrl || '';
    meta.worker = false;
    var res = veStrNormalizeImport(geom, meta);
    if(!res.ok) res.error = _sgWithDiag(res.error, oc._veLog);
    return res;
  });
}

// ─── Uçtan uca içe aktarma ──────────────────────────────────────────────────
// Dosya içeriği (Uint8Array) → normalize model. Tek giriş noktası: sunum
// katmanı occt'yi doğrudan çağırmaz.
//
// opts.onProgress(stage, info) — VE_STR_STAGES sırasıyla çağrılır. Yalnız
// 'download' belirli bir yüzde taşır (info.pct); diğerleri belirsizdir.
// opts.noWorker — yedeğe zorla (test/ölçüm).
function veStrImportStep(bytes, meta, opts){
  meta = meta || {};
  opts = opts || {};
  var onp = opts.onProgress || function(){};
  var defl = meta.deflection || VE_STR_GEOM_DEFLECTION;
  meta.deflection = defl;
  // Parça adı DOSYA ADINDAN. Birleştirmeden sonra STEP'in ürün adları
  // anlamını yitiriyor (yedi gövde tek katı oldu, hangisinin adı taşınsın?);
  // kullanıcının o parçayı tanıdığı ad zaten dosya adı.
  if(!meta.partName && meta.fileName){
    meta.partName = String(meta.fileName).replace(/\.(stp|step)$/i, '');
  }

  var useWorker = !opts.noWorker && !opts.wasmBinary && !opts.factory && _sgWorkerSupported();
  var run = useWorker
    ? _sgImportViaWorker(bytes, meta, opts, onp)
        // Worker kurulamadıysa (CSP blob'u engelliyor, dosya yok, eski tarayıcı)
        // SESSİZCE değil ama ÇALIŞARAK yedeğe düş: kullanıcı için "hiç
        // açılmadı" ile "donarak açıldı" arasında dağlar kadar fark var.
        ['catch'](function(e){
          if(opts.noFallback) throw e;
          onp('reader', { fallback: true });
          return _sgImportMainThread(bytes, meta, opts, onp);
        })
    : _sgImportMainThread(bytes, meta, opts, onp);

  return run['catch'](function(e){
    return { ok: false, error: (e && e.message) ? e.message : String(e) };
  });
}

// ── Test köprüsü ────────────────────────────────────────────────────────────
// Tarayıcıda düz <script>; Node'da testler require ile alır. Üst-seviye
// bildirim EKLEMEZ → source-hygiene kapısına takılmaz.
if(typeof module !== 'undefined' && module.exports) {
  module.exports = {
    VE_STR_GEOM_UNIT: VE_STR_GEOM_UNIT,
    VE_STR_GEOM_DEFLECTION: VE_STR_GEOM_DEFLECTION,
    veStrOcctReady: veStrOcctReady,
    veStrOcctForget: veStrOcctForget,
    veStrOcctWorker: veStrOcctWorker,
    VE_STR_STAGES: VE_STR_STAGES,
    VE_STR_WORKER_BRIDGE: VE_STR_WORKER_BRIDGE,
    _sgOcctPipeline: _sgOcctPipeline,
    _sgTyped: _sgTyped,
    veStrFaceKey: veStrFaceKey,
    veStrGeomBBox: veStrGeomBBox,
    veStrNormalizeImport: veStrNormalizeImport,
    veStrFaceOfTriangle: veStrFaceOfTriangle,
    veStrGeomRecord: veStrGeomRecord,
    VE_STR_SRC_STORE_LIMIT: VE_STR_SRC_STORE_LIMIT,
    veStrSrcSet: veStrSrcSet,
    veStrSrcGet: veStrSrcGet,
    veStrSrcClear: veStrSrcClear,
    veStrSrcWillPersist: veStrSrcWillPersist,
    veStrSrcAttach: veStrSrcAttach,
    veStrSrcHarvest: veStrSrcHarvest,
    veStrGeomCacheSet: veStrGeomCacheSet,
    veStrGeomCacheGet: veStrGeomCacheGet,
    veStrGeomCacheClear: veStrGeomCacheClear,
    veStrImportStep: veStrImportStep,
    _sgWithDiag: _sgWithDiag
  };
}
