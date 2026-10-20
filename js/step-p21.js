// ============================================================================
//  STEP (ISO 10303-21) OKUYUCUSU — DOM'suz, saf JS
// ============================================================================
// Bir STEP dosyasını BAYT olarak okur, varlıkları kimliğiyle dizine alır ve
// yalnız sorulanı çözer. Montaj ağacını, parçaların montajdaki konumunu ve bir
// yüzün analitik tanımını (eksen · yarıçap · sınır çemberleri) verir. Anlam
// yüklemez: "bu parça kasnak mı" sorusunun yeri js/fead-step.js.
//
// ── NEDEN OCCT DEĞİL ──────────────────────────────────────────────────────
// Yapısal Analiz döneminde STEP OpenCascade ile okunuyordu ve iki bedeli
// vardı: (1) BOYUT — hafif sürümü bile gömülü 3,96 MB, tam çekirdek 17,5 MB;
// tek dosya bugün gönderim sınırının ~2,7 MiB altında. (2) ÜÇGEN — o okuyucu
// STEP'i üçgene çevirip veriyordu; dosyada TAM SAYI olarak yazan yarıçap
// (`CYLINDRICAL_SURFACE(yerleşim, 73.5)`) kayboluyor, üçgenlerden geri tahmin
// edilmesi gerekiyordu. Kasnak bir torna parçası; yüzleri silindir, koni, tor
// ve düzlem. Ölçülecek her sayı dosyada zaten yazılı — okumak yeterli.
//
// ── DOSYA BAYT OLARAK DURUR, METNE ÇEVRİLMEZ ─────────────────────────────
// Dosya tek bir Uint8Array; kayıt dizini tipli dizilerde (kimlik · gövdenin
// başı · sonu · tip kodu — kayıt başına 14 bayt). Varlık ilk sorulduğunda
// baytlarından ayrıştırılır. Büyük dosyanın gövdesi B-spline kontrol
// noktalarıdır; FEAD onlara hiç dokunmaz. Gerekçe ölçüldü (420 MB'lık deneme
// montajı): dosyayı metin olarak tutmak okumadan sonra JS yığınında 1,7 GB
// demekti ve V8'in tek metin sınırı (~512 MiB) daha büyük dosyayı hiç
// açtırmıyordu ("Invalid string length").
// Ayrıştırılmış varlıkların önbelleği SINIRLI (iki nesil, VE_STEP_P21_ONBELLEK):
// sınırsız önbellek 3B kurulurken bütün kontrol noktalarını yığında tutuyordu.
//
// ── OKUMA BİR İŞTİR — DİLİMLENİR ─────────────────────────────────────────
// Tarama · dizin · montaj · ağaç evreleri kaldığı yerden sürer
// (veStepP21AgacIs). Senkron API (veStepP21Agac) işi sonuna kadar koşar;
// tarayıcıda veStepP21AgacDilimli ≤ VE_STEP_P21_DILIM ms'lik dilimlerle koşar
// ve arayüz donmaz (kökteki CLAUDE.md → UZUN İŞ ARAYÜZÜ KİLİTLEMEZ). Tek
// görevde okuma 420 MB'ta arayüzü 34 sn donduruyordu.
//
// ── BİRİM TAHMİN EDİLMEZ ─────────────────────────────────────────────────
// Uzunluk ve düzlem açısı birimi temsilin kendi bağlamından
// (GLOBAL_UNIT_ASSIGNED_CONTEXT) okunur. Aynı dosyada birden çok birim tanımı
// olabiliyor (NIST'in CATIA çıktısında mm ile inch yan yana duruyor); "ilk
// bulunan" birimi almak sessizce yanlış ölçek demekti. Çıktı her zaman
// mm ve DERECE'dir.
//
// ── MONTAJ: CDSR + RRWT + IDT ────────────────────────────────────────────
// Parçanın konumu CAx-IF'in önerdiği kalıptan okunur:
//   NEXT_ASSEMBLY_USAGE_OCCURRENCE (ebeveyn PD → çocuk PD)
//   → PRODUCT_DEFINITION_SHAPE → CONTEXT_DEPENDENT_SHAPE_REPRESENTATION
//   → REPRESENTATION_RELATIONSHIP_WITH_TRANSFORMATION → ITEM_DEFINED_TRANSFORMATION
// CATIA V5 ve 3DEXPERIENCE bu kalıbı yazıyor. MAPPED_ITEM ile konumlandırılmış
// montaj DESTEKLENMİYOR ve bu SESSİZ geçilmez: uyarı listesine yazılır.
// ============================================================================

var VE_STEP_P21_SURUM = '2.0.0';
var VE_STEP_P21_ONBELLEK = 65536;      // ayrıştırılmış varlık önbelleğinin nesli (kayıt)
var VE_STEP_P21_DILIM = 10;            // ms — tarayıcıda dilimin bütçesi

function _stpSimdi(){
  return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
}

// ── 1 · KAYIT DİZİNİ ─────────────────────────────────────────────────────
// Baytlar ';' ile biten ifadelere bölünür; dize ('...') ve yorum (/* */)
// içindeki karakterler ayırıcı sayılmaz. DATA kayıtları dizine girer (gövde
// metne çevrilmez); HEADER ifadeleri tarama bitince ayrıştırılır — dizelerin
// kodlaması (aşağıda) ancak o zaman bilinir.
//   model: { bayt, adet, enBuyukId, hatalar[], baslik{}, utf8,
//            kim · bas · son: Uint32Array, tip: Uint16Array (kayıt sırasıyla),
//            tipAd[] (kod → ad; 0 '' · 1 'COMPLEX'), yer (kimlik → sıra + 1) }
//
// KODLAMA: Part 21'in temel alfabesi ASCII, ASCII dışı karakter \X2\ ile
// kaçışlanır (3DEXPERIENCE böyle yazıyor). Standarda uymayan bir yazıcının
// dizelere bıraktığı ham bayt: dosyadaki bütün dizeler geçerli UTF-8 ise
// UTF-8, değilse ISO 8859-1 okunur (karar dosya başına, taramada).
var _STP_KARMASIK = 1;
var _STP_IMZA = 'ISO-10303-21';
var _STP_K_HEADER = [72, 69, 65, 68, 69, 82], _STP_K_ENDSEC = [69, 78, 68, 83, 69, 67],
    _STP_K_DATA = [68, 65, 84, 65], _STP_K_DATA_P = [68, 65, 84, 65, 40];

function _stpModel(bayt){
  return { bayt: bayt, adet: 0, enBuyukId: 0, hatalar: [], baslik: {}, utf8: true,
           kim: null, bas: null, son: null, tip: null, tipAd: ['', 'COMPLEX'], yer: null, yerMap: null,
           _ob1: new Map(), _ob2: null };
}

// Girdi: Uint8Array (ve her bayt görünümü) · ArrayBuffer · metin. Metin UTF-8
// baytlarına çevrilir; dizeleri UTF-8 okunur, yani çözülmüş bir metin aynen
// geri gelir (js/fead-step.js metinle okur).
function _stpGirdiBayt(girdi){
  if(girdi && ArrayBuffer.isView(girdi)) return new Uint8Array(girdi.buffer, girdi.byteOffset, girdi.byteLength);
  if(Object.prototype.toString.call(girdi) === '[object ArrayBuffer]') return new Uint8Array(girdi);
  return _stpMetinBayt(String(girdi == null ? '' : girdi));
}
function _stpMetinBayt(s){
  var n = s.length, i, c;
  for(i = 0; i < n; i++) if(s.charCodeAt(i) > 127) break;
  if(i === n){
    var a = new Uint8Array(n);
    for(i = 0; i < n; i++) a[i] = s.charCodeAt(i);
    return a;
  }
  var b = new Uint8Array(n * 3), k = 0;
  for(i = 0; i < n; i++){
    c = s.charCodeAt(i);
    if(c < 0x80) b[k++] = c;
    else if(c < 0x800){ b[k++] = 0xC0 | (c >> 6); b[k++] = 0x80 | (c & 63); }
    else if(c >= 0xD800 && c < 0xDC00 && i + 1 < n && (s.charCodeAt(i + 1) & 0xFC00) === 0xDC00){
      var cp = 0x10000 + ((c - 0xD800) << 10) + (s.charCodeAt(++i) - 0xDC00);
      b[k++] = 0xF0 | (cp >> 18); b[k++] = 0x80 | ((cp >> 12) & 63); b[k++] = 0x80 | ((cp >> 6) & 63); b[k++] = 0x80 | (cp & 63);
    } else {
      if(c >= 0xD800 && c < 0xE000) c = 0xFFFD;                  // eşsiz vekil
      b[k++] = 0xE0 | (c >> 12); b[k++] = 0x80 | ((c >> 6) & 63); b[k++] = 0x80 | (c & 63);
    }
  }
  return b.subarray(0, k);
}

// İmza dosyanın başında aranır (ilk 64 KiB) — STEP olmayan büyük bir dosya
// sonuna kadar taranmaz.
function _stpImzaVar(b){
  var L = _STP_IMZA.length, son = Math.min(b.length, 65536) - L;
  for(var i = 0; i <= son; i++){
    for(var k = 0; k < L && b[i + k] === _STP_IMZA.charCodeAt(k); k++);
    if(k === L) return true;
  }
  return false;
}

// TARAMA DURUMU — bir dilim `sinir` bayta kadar ilerler; ifadenin ortasında
// durabilir (kaldığı yer `i`, ifadenin ilk anlamlı baytı `bas`).
function _stpTarama(model){
  var kap = Math.max(1024, Math.ceil(model.bayt.length / 56));
  model.kim = new Uint32Array(kap); model.bas = new Uint32Array(kap);
  model.son = new Uint32Array(kap); model.tip = new Uint16Array(kap);
  return { model: model, b: model.bayt, i: 0, bas: -1, bolum: 0, kap: kap, baslik: [], tipKod: new Map() };
}
function _stpTaraDilim(D, sinir){
  var b = D.b, n = b.length, i = D.i, bas = D.bas, son = sinir < n ? sinir : n, c;
  while(i < son){
    c = b[i];
    if(c === 39){                                             // ' dize: kapanışa kadar
      if(bas < 0) bas = i;
      i = _stpDizeSonu(D, b, i + 1, n);
      continue;
    }
    if(c === 59){                                             // ;
      if(bas >= 0) _stpIfade(D, bas, i);
      bas = -1; i++;
      continue;
    }
    if(c === 47 && b[i + 1] === 42){ i = _stpYorumSonu(b, i + 2, n); continue; }   // /* yorum */
    if(bas < 0 && c !== 32 && c !== 10 && c !== 13 && c !== 9) bas = i;
    i++;
  }
  D.i = i; D.bas = bas;
  return i >= n;
}
// Dizenin kapanışından sonraki konum; '' kaçışlanmış tırnaktır. ASCII dışı
// bayt UTF-8 olarak sınanır (dosyanın kodlama kararı).
function _stpDizeSonu(D, b, j, n){
  for(;;){
    if(j >= n) return n;                                      // kapanmayan dize: ifade bitmez
    var c = b[j];
    if(c === 39){ if(b[j + 1] === 39){ j += 2; continue; } return j + 1; }
    if(c > 127 && D.model.utf8){
      var u = _stpUtf8Boy(b, j, n);
      if(u < 0){ D.model.utf8 = false; j++; } else j += u;
      continue;
    }
    j++;
  }
}
function _stpYorumSonu(b, j, n){
  for(; j + 1 < n; j++) if(b[j] === 42 && b[j + 1] === 47) return j + 2;
  return n;
}
// Boşluk ve yorum atlanır
function _stpAtla(b, j, son){
  while(j < son){
    var c = b[j];
    if(c === 32 || c === 10 || c === 13 || c === 9){ j++; continue; }
    if(c === 47 && j + 1 < son && b[j + 1] === 42){ j = _stpYorumSonu(b, j + 2, son); continue; }
    break;
  }
  return j;
}
function _stpEsitB(b, bas, son, k){
  if(son - bas !== k.length) return false;
  for(var i = 0; i < k.length; i++) if(b[bas + i] !== k[i]) return false;
  return true;
}
function _stpOnekB(b, bas, son, k){
  if(son - bas < k.length) return false;
  for(var i = 0; i < k.length; i++) if(b[bas + i] !== k[i]) return false;
  return true;
}
// Bir ifade [bas, son): bölüm anahtarı · başlık ifadesi · DATA kaydı
function _stpIfade(D, bas, son){
  var b = D.b, c;
  while(son > bas){ c = b[son - 1]; if(c === 32 || c === 10 || c === 13 || c === 9) son--; else break; }
  if(b[bas] === 35){                                          // #kimlik = gövde
    if(D.bolum !== 2) return;
    var j = bas + 1, id = 0, rakam = 0;
    while(j < son){ c = b[j]; if(c >= 48 && c <= 57){ id = id * 10 + (c - 48); j++; rakam++; } else break; }
    j = _stpAtla(b, j, son);
    if(!rakam || b[j] !== 61 || !(id > 0) || id > 4294967295) return;
    _stpKayitEkle(D, id, _stpAtla(b, j + 1, son), son);
    return;
  }
  if(_stpEsitB(b, bas, son, _STP_K_HEADER)){ D.bolum = 1; return; }
  if(_stpEsitB(b, bas, son, _STP_K_ENDSEC)){ D.bolum = 0; return; }
  if(_stpEsitB(b, bas, son, _STP_K_DATA) || _stpOnekB(b, bas, son, _STP_K_DATA_P)){ D.bolum = 2; return; }
  if(D.bolum === 1) D.baslik.push(bas, son);
}
function _stpKayitEkle(D, id, bas, son){
  var M = D.model, k = M.adet;
  if(k >= D.kap){
    var kap = Math.ceil(D.kap * 1.5) + 1024, buyut = function(a, T){ var y = new T(kap); y.set(a); return y; };
    M.kim = buyut(M.kim, Uint32Array); M.bas = buyut(M.bas, Uint32Array);
    M.son = buyut(M.son, Uint32Array); M.tip = buyut(M.tip, Uint16Array);
    D.kap = kap;
  }
  M.kim[k] = id; M.bas[k] = bas; M.son[k] = son; M.tip[k] = _stpTipKodu(D, bas, son);
  M.adet = k + 1;
  if(id > M.enBuyukId) M.enBuyukId = id;
}
// Tip adı kayıttan bir kez okunur ve koda çevrilir (özet + ad sınaması —
// özet çakışırsa sonraki yuva). Gövde '(' ile başlıyorsa karmaşık varlık.
function _stpTipKodu(D, bas, son){
  var b = D.b, c = b[bas];
  if(c === 40) return _STP_KARMASIK;
  var h = 0x811c9dc5 | 0, k = bas;
  while(k < son){
    c = b[k];
    if(c >= 97 && c <= 122) c -= 32;
    else if(!((c >= 65 && c <= 90) || (c >= 48 && c <= 57) || c === 95)) break;
    h = Math.imul(h ^ c, 16777619);
    k++;
  }
  var L = k - bas, ad = D.model.tipAd, kod;
  if(!L) return 0;
  for(;;){
    kod = D.tipKod.get(h);
    if(kod === undefined) break;
    if(_stpAdEsit(ad[kod], b, bas, L)) return kod;
    h = (h + 1) | 0;
  }
  if(ad.length > 65535) return 0;
  kod = ad.length;
  ad.push(_stpAscii(b, bas, bas + L).toUpperCase());
  D.tipKod.set(h, kod);
  return kod;
}
function _stpAdEsit(ad, b, bas, L){
  if(ad.length !== L) return false;
  for(var k = 0; k < L; k++){
    var c = b[bas + k];
    if(c >= 97 && c <= 122) c -= 32;
    if(ad.charCodeAt(k) !== c) return false;
  }
  return true;
}
// Kimlik → kayıt sırası. Kimlikler sıkışıksa düz dizi, seyrekse Map.
// Aynı kimlik iki kez yazılmışsa sonuncusu geçer.
function _stpDizinKur(D, bitis){
  var M = D.model, N = M.adet;
  if(D.k === undefined){
    D.k = 0;
    if(M.enBuyukId <= 4 * N + 1024) M.yer = new Int32Array(M.enBuyukId + 1);
    else M.yerMap = new Map();
  }
  while(D.k < N){
    var son = Math.min(N, D.k + 262144);
    if(M.yer) for(var k = D.k; k < son; k++) M.yer[M.kim[k]] = k + 1;
    else for(var q = D.k; q < son; q++) M.yerMap.set(M.kim[q], q + 1);
    D.k = son;
    if(_stpSimdi() > bitis) break;
  }
  return D.k >= N;
}
function _stpSira(m, id){
  if(m.yer){ var s = m.yer[id]; return s ? s - 1 : -1; }
  if(m.yerMap){ var t = m.yerMap.get(+id); return t ? t - 1 : -1; }
  return -1;
}
// Başlık ifadeleri: AD(argümanlar) — tarama bittikten sonra
function _stpBaslikKur(D){
  var M = D.model, b = M.bayt, L = D.baslik;
  for(var q = 0; q < L.length; q += 2){
    var bas = L[q], son = L[q + 1], p = bas;
    while(p < son && b[p] !== 40) p++;
    if(p >= son || p === bas) continue;
    var ad = _stpAscii(b, bas, p).trim().toUpperCase();
    try { M.baslik[ad] = _stpArg(M, p, son); } catch(e) { M.baslik[ad] = null; }
  }
}

// SENKRON: metin ya da bayt → model (dizin kurulmuş)
function veStepP21Oku(girdi){
  var model = _stpModel(_stpGirdiBayt(girdi));
  if(!_stpImzaVar(model.bayt)){
    model.hatalar.push('Dosya bir STEP dosyası değil (ISO-10303-21 başlığı yok).');
    return model;
  }
  var D = _stpTarama(model);
  _stpTaraDilim(D, Infinity);
  _stpDizinKur(D, Infinity);
  _stpBaslikKur(D);
  return model;
}

// ── 2 · ARGÜMANLAR ─────────────────────────────────────────────────────────
// Dönen biçim: sayı · {s: dize} · {ref: kimlik} · {e: numaralandırma} ·
// {tip: 'LENGTH_MEASURE', a: [...]} (tipli parametre) · [liste] · null ($ ve *)
// Ayrıştırıcının durumu modül düzeyinde (çağrı başına kapanış kurulmaz);
// bayt dizisine tutunmaz — dönüşte bırakılır. Sonun konumu `_stpPi`de kalır.
var _stpPb = null, _stpPi = 0, _stpPs = 0, _stpPm = null;
function _stpArg(m, bas, son){
  _stpPb = m.bayt; _stpPi = bas; _stpPs = son; _stpPm = m;
  try { return _stpDeger(); }
  finally { _stpPb = null; _stpPm = null; }
}
function _stpBosluk(){
  var b = _stpPb, i = _stpPi, s = _stpPs;
  while(i < s){
    var c = b[i];
    if(c === 32 || c === 9 || c === 10 || c === 13){ i++; continue; }
    if(c === 47 && i + 1 < s && b[i + 1] === 42){ i = _stpYorumSonu(b, i + 2, s); continue; }
    break;
  }
  _stpPi = i;
}
function _stpKarakter(c){ return c < 0 ? '' : String.fromCharCode(c); }
function _stpDeger(){
  _stpBosluk();
  var b = _stpPb, i = _stpPi, s = _stpPs, c = i < s ? b[i] : -1, j, v;
  if(c === 40){                                               // (
    _stpPi = i + 1;
    var liste = [];
    _stpBosluk();
    if(_stpPi < s && b[_stpPi] === 41){ _stpPi++; return liste; }
    for(;;){
      liste.push(_stpDeger());
      _stpBosluk();
      var d = _stpPi < s ? b[_stpPi] : -1;
      if(d === 44){ _stpPi++; continue; }
      if(d === 41){ _stpPi++; return liste; }
      throw new Error('STEP: listede beklenmeyen karakter "' + _stpKarakter(d) + '"');
    }
  }
  if(c === 39) return { s: veStepP21Coz(_stpDize()) };        // '...'
  if(c === 35){                                               // #kimlik
    j = i + 1; v = 0;
    while(j < s){ var q = b[j]; if(q >= 48 && q <= 57){ v = v * 10 + (q - 48); j++; } else break; }
    _stpPi = j;
    return { ref: v };
  }
  if(c === 46){                                               // .ENUM.
    j = i + 1;
    while(j < s && b[j] !== 46) j++;
    if(j >= s) throw new Error('STEP: kapanmayan numaralandırma');
    _stpPi = j + 1;
    return { e: _stpAscii(b, i + 1, j).toUpperCase() };
  }
  if(c === 36 || c === 42){ _stpPi = i + 1; return null; }    // $ ve *
  if(c === 34){                                               // "ikili"
    j = i + 1;
    while(j < s && b[j] !== 34) j++;
    _stpPi = j + 1;
    return { b: _stpAscii(b, i + 1, j) };
  }
  if(c === 45 || c === 43 || (c >= 48 && c <= 57)){          // sayı
    j = i + 1;
    while(j < s){
      var r = b[j];
      if((r >= 48 && r <= 57) || r === 46 || r === 69 || r === 101 || r === 45 || r === 43) j++; else break;
    }
    _stpPi = j;
    return _stpSayi(b, i, j);
  }
  if((c >= 65 && c <= 90) || (c >= 97 && c <= 122) || c === 95){   // TİP(...)
    j = i;
    while(j < s){
      var t = b[j];
      if((t >= 65 && t <= 90) || (t >= 97 && t <= 122) || (t >= 48 && t <= 57) || t === 95) j++; else break;
    }
    var tip = _stpAscii(b, i, j).toUpperCase();
    _stpPi = j;
    _stpBosluk();
    if(_stpPi < s && b[_stpPi] === 40) return { tip: tip, a: _stpDeger() };
    return { tip: tip, a: null };
  }
  throw new Error('STEP: beklenmeyen karakter "' + _stpKarakter(c) + '"');
}

// SAYI — hızlı yol KESİN: en çok 2^53'lük tam sayı mantis ve |üs| ≤ 22'de
// tek çarpma/bölme doğru yuvarlanır (Clinger), yani parseFloat'ın verdiği
// sayının aynısı. Öteki her biçim parseFloat'a gider.
var _STP_ON = [1, 1e1, 1e2, 1e3, 1e4, 1e5, 1e6, 1e7, 1e8, 1e9, 1e10, 1e11, 1e12, 1e13, 1e14, 1e15,
  1e16, 1e17, 1e18, 1e19, 1e20, 1e21, 1e22];
function _stpSayi(b, i, j){
  var k = i, c = b[k], eksi = false;
  if(c === 45){ eksi = true; k++; } else if(c === 43) k++;
  var m = 0, us = 0, rakam = 0, nokta = false;
  for(; k < j; k++){
    c = b[k];
    if(c >= 48 && c <= 57){
      if(m > 900719925474099) return _stpSayiYavas(b, i, j);
      m = m * 10 + (c - 48); rakam++;
      if(nokta) us--;
      continue;
    }
    if(c === 46 && !nokta){ nokta = true; continue; }
    break;
  }
  if(!rakam) return _stpSayiYavas(b, i, j);
  if(k < j){
    if(c !== 69 && c !== 101) return _stpSayiYavas(b, i, j);
    k++;
    var ueksi = false, e = 0, er = 0;
    if(k < j && (b[k] === 45 || b[k] === 43)){ ueksi = b[k] === 45; k++; }
    for(; k < j; k++){
      c = b[k];
      if(c < 48 || c > 57 || e > 400) return _stpSayiYavas(b, i, j);
      e = e * 10 + (c - 48); er++;
    }
    if(!er) return _stpSayiYavas(b, i, j);
    us += ueksi ? -e : e;
  }
  var v;
  if(us === 0) v = m;
  else if(us > 0 && us <= 22) v = m * _STP_ON[us];
  else if(us < 0 && us >= -22) v = m / _STP_ON[-us];
  else return _stpSayiYavas(b, i, j);
  return eksi ? -v : v;
}
function _stpSayiYavas(b, i, j){ return parseFloat(_stpAscii(b, i, j)); }

// Baytlar → metin, bir bayt bir karakter (ISO 8859-1)
function _stpAscii(b, i, j){
  if(j - i === 1) return String.fromCharCode(b[i]);
  if(j - i <= 4096) return String.fromCharCode.apply(null, b.subarray(i, j));
  var s = '';
  for(var k = i; k < j; k += 4096) s += String.fromCharCode.apply(null, b.subarray(k, Math.min(j, k + 4096)));
  return s;
}
// '...' → ham içerik ('' tek tırnak olur; kaçış çözümü veStepP21Coz'da)
function _stpDize(){
  var b = _stpPb, s = _stpPs, i = _stpPi + 1, bas = i, parca = null;
  for(;;){
    if(i >= s) throw new Error('STEP: kapanmayan dize');
    var c = b[i];
    if(c === 39){
      if(i + 1 < s && b[i + 1] === 39){ parca = (parca || '') + _stpDizeCoz(b, bas, i) + "'"; i += 2; bas = i; continue; }
      break;
    }
    i++;
  }
  _stpPi = i + 1;
  var son = _stpDizeCoz(b, bas, i);
  return parca === null ? son : parca + son;
}
function _stpDizeCoz(b, i, j){
  if(i === j) return '';
  if(_stpPm && _stpPm.utf8) for(var k = i; k < j; k++) if(b[k] > 127) return _stpUtf8Coz(b, i, j);
  return _stpAscii(b, i, j);
}
// Geçerli UTF-8 dizisinin bayt sayısı; geçersizse −1 (aşırı uzun ve aralık
// dışı kod noktası geçersiz)
function _stpUtf8Boy(b, i, n){
  var c = b[i], cp, ek;
  if(c >= 0xC2 && c < 0xE0){ cp = c & 0x1F; ek = 1; }
  else if(c >= 0xE0 && c < 0xF0){ cp = c & 0x0F; ek = 2; }
  else if(c >= 0xF0 && c < 0xF5){ cp = c & 0x07; ek = 3; }
  else return -1;
  if(i + ek >= n) return -1;
  for(var k = 1; k <= ek; k++){
    var d = b[i + k];
    if((d & 0xC0) !== 0x80) return -1;
    cp = (cp << 6) | (d & 0x3F);
  }
  if((ek === 2 && cp < 0x800) || (ek === 3 && (cp < 0x10000 || cp > 0x10FFFF))) return -1;
  return ek + 1;
}
function _stpUtf8Coz(b, i, j){
  var out = '', k = i;
  while(k < j){
    var c = b[k];
    if(c < 0x80){ out += String.fromCharCode(c); k++; continue; }
    var u = _stpUtf8Boy(b, k, j);
    if(u < 0){ out += String.fromCharCode(c); k++; continue; }
    var cp = u === 2 ? c & 0x1F : u === 3 ? c & 0x0F : c & 0x07;
    for(var q = 1; q < u; q++) cp = (cp << 6) | (b[k + q] & 0x3F);
    if(cp > 0xFFFF){ cp -= 0x10000; out += String.fromCharCode(0xD800 + (cp >> 10), 0xDC00 + (cp & 0x3FF)); }
    else out += String.fromCharCode(cp);
    k += u;
  }
  return out;
}

// Karmaşık varlık: (A(...) B(...) C()) → [{t, a}, ...]
function _stpKarmasik(m, bas, son){
  var b = m.bayt, parcalar = [], i = bas + 1;
  while(i < son){
    for(;;){
      var c = i < son ? b[i] : -1;
      if(c === 41 || c === 32 || c === 9 || c === 10 || c === 13 || c === 11 || c === 12){ i++; continue; }
      if(c === 47 && i + 1 < son && b[i + 1] === 42){ i = _stpYorumSonu(b, i + 2, son); continue; }
      break;
    }
    if(i >= son) break;
    var p = i;
    while(p < son && b[p] !== 40) p++;
    if(p >= son) break;
    var ad = _stpAscii(b, i, p).trim().toUpperCase();
    parcalar.push({ t: ad, a: _stpArg(m, p, son) });
    i = _stpPi;
  }
  return parcalar;
}

// ── 3 · DİZE ÇÖZÜCÜ ─────────────────────────────────────────────────────
// \X2\hhhh…\X0\ (UTF-16) · \X4\hhhhhhhh…\X0\ (UCS-4) · \X\hh (ISO 8859-1) ·
// \S\c (c + 128) · \P?\ (kod sayfası — yok sayılır) · \\ (ters bölü).
// CATIA/3DEXPERIENCE Türkçe harfleri ve "Ø"yu \X2\ ile yazıyor
// ("KRANK KASNAK-\X2\00D8\X0\147"). Dizenin içindeki fiziksel satır sonu
// değerin parçası DEĞİLDİR (dosya uzun satırı bölebilir).
function veStepP21Coz(ham){
  var s = String(ham == null ? '' : ham).replace(/[\r\n]/g, '');
  if(s.indexOf('\\') < 0) return s;
  var out = '', i = 0, n = s.length;
  while(i < n){
    var c = s.charAt(i);
    if(c === '\\'){
      var bas = s.substr(i, 4).toUpperCase();
      if(bas === '\\X2\\' || bas === '\\X4\\'){
        var son = s.toUpperCase().indexOf('\\X0\\', i + 4);
        if(son < 0) son = n;
        var hex = s.slice(i + 4, son), adim = bas === '\\X2\\' ? 4 : 8;
        for(var k = 0; k + adim <= hex.length; k += adim){
          var kod = parseInt(hex.substr(k, adim), 16);
          if(kod > 0xFFFF){ kod -= 0x10000; out += String.fromCharCode(0xD800 + (kod >> 10), 0xDC00 + (kod & 0x3FF)); }
          else out += String.fromCharCode(kod);
        }
        i = son + 4;
        continue;
      }
      var uc = s.substr(i, 3).toUpperCase();
      if(uc === '\\X\\'){ out += String.fromCharCode(parseInt(s.substr(i + 3, 2), 16)); i += 5; continue; }
      if(uc === '\\S\\'){ out += String.fromCharCode(s.charCodeAt(i + 3) + 128); i += 4; continue; }
      if(s.charAt(i + 1).toUpperCase() === 'P' && s.charAt(i + 3) === '\\'){ i += 4; continue; }
      if(s.charAt(i + 1) === '\\'){ out += '\\'; i += 2; continue; }
    }
    out += c;
    i++;
  }
  return out;
}

// ── 4 · VARLIK ERİŞİMİ ────────────────────────────────────────────────────
function veStepP21Tip(model, id){
  var s = _stpSira(model, id);
  return s < 0 ? null : model.tipAd[model.tip[s]];
}

// {t, a} — karmaşık varlıkta {t:'COMPLEX', parca:[{t, a}, ...]}.
// ÖNBELLEK İKİ NESİL: sorulan varlık yeni nesle yazılır; nesil dolunca eskisi
// atılır, eski nesilde bulunan yeniye taşınır (sık sorulan birim, bağlam,
// yerleşim kalır; bir kez sorulan kontrol noktası gider).
function veStepP21Varlik(model, id){
  var k = +id, v = model._ob1.get(k);
  if(v !== undefined) return v;
  if(model._ob2){
    v = model._ob2.get(k);
    if(v !== undefined){ _stpOnbellekYaz(model, k, v); return v; }
  }
  var s = _stpSira(model, k);
  if(s < 0) return null;
  var bas = model.bas[s], son = model.son[s], kod = model.tip[s];
  if(kod === _STP_KARMASIK) v = { t: 'COMPLEX', parca: _stpKarmasik(model, bas, son) };
  else {
    var b = model.bayt, p = bas;
    while(p < son && b[p] !== 40) p++;
    v = { t: model.tipAd[kod], a: p < son ? _stpArg(model, p, son) : null };
  }
  _stpOnbellekYaz(model, k, v);
  return v;
}
function _stpOnbellekYaz(model, k, v){
  if(model._ob1.size >= VE_STEP_P21_ONBELLEK){ model._ob2 = model._ob1; model._ob1 = new Map(); }
  model._ob1.set(k, v);
}

// Karmaşık varlığın adıyla istenen parçası
function veStepP21Parca(model, id, ad){
  var v = veStepP21Varlik(model, id);
  if(!v) return null;
  if(v.t !== 'COMPLEX') return v.t === ad ? v : null;
  for(var i = 0; i < v.parca.length; i++) if(v.parca[i].t === ad) return v.parca[i];
  return null;
}

function _stpRefler(a){
  var out = [];
  (Array.isArray(a) ? a : [a]).forEach(function(x){ if(x && x.ref) out.push(x.ref); });
  return out;
}

// ── 5 · BİRİMLER ─────────────────────────────────────────────────────────
// Temsil bağlamından: { mm: uzunluk → mm çarpanı, derece: açı → derece çarpanı }
var _STP_ONEK = { EXA: 1e18, PETA: 1e15, TERA: 1e12, GIGA: 1e9, MEGA: 1e6, KILO: 1e3,
  HECTO: 1e2, DECA: 1e1, DECI: 1e-1, CENTI: 1e-2, MILLI: 1e-3, MICRO: 1e-6, NANO: 1e-9 };

function veStepP21Birim(model, baglamId){
  var out = { mm: NaN, derece: NaN };
  var g = veStepP21Parca(model, baglamId, 'GLOBAL_UNIT_ASSIGNED_CONTEXT');
  if(!g) return out;
  _stpRefler(g.a[0]).forEach(function(u){
    var tur = _stpBirimTuru(model, u);
    if(tur === 'uzunluk') out.mm = _stpBirimCarpan(model, u, 'uzunluk');
    else if(tur === 'aci') out.derece = _stpBirimCarpan(model, u, 'aci');
  });
  return out;
}

function _stpBirimTuru(model, u){
  if(veStepP21Parca(model, u, 'LENGTH_UNIT')) return 'uzunluk';
  if(veStepP21Parca(model, u, 'PLANE_ANGLE_UNIT')) return 'aci';
  var v = veStepP21Varlik(model, u);
  if(v && v.t === 'LENGTH_UNIT') return 'uzunluk';
  if(v && v.t === 'PLANE_ANGLE_UNIT') return 'aci';
  return null;
}

// SI_UNIT(önek, ad) ya da CONVERSION_BASED_UNIT(ad, ölçü_ile_birim)
function _stpBirimCarpan(model, u, tur, derinlik){
  if((derinlik || 0) > 4) return NaN;
  var si = veStepP21Parca(model, u, 'SI_UNIT');
  if(si){
    var onek = si.a[0] && si.a[0].e ? (_STP_ONEK[si.a[0].e] || 1) : 1;
    var ad = si.a[1] && si.a[1].e;
    if(tur === 'uzunluk' && ad === 'METRE') return onek * 1000;
    if(tur === 'aci' && ad === 'RADIAN') return onek * 180 / Math.PI;
    return NaN;
  }
  var cb = veStepP21Parca(model, u, 'CONVERSION_BASED_UNIT');
  if(cb && cb.a[1] && cb.a[1].ref){
    var mwu = veStepP21Varlik(model, cb.a[1].ref);
    var govde = mwu.t === 'COMPLEX' ? veStepP21Parca(model, cb.a[1].ref, 'MEASURE_WITH_UNIT') : mwu;
    if(!govde || !govde.a) return NaN;
    var olcu = govde.a[0], deger = (olcu && olcu.tip) ? olcu.a[0] : olcu;
    var taban = govde.a[1] && govde.a[1].ref ? _stpBirimCarpan(model, govde.a[1].ref, tur, (derinlik || 0) + 1) : NaN;
    return deger * taban;
  }
  return NaN;
}

// ── 6 · ÇERÇEVE VE DÖNÜŞÜM ───────────────────────────────────────────────
// Dönüşüm {R: 3×3 satırlar, t: öteleme}; p' = R·p + t. Uzunluklar mm'ye
// `olcek` ile çevrilir (çerçevenin konumu dosya biriminde yazılı).
function veStepP21Cerceve(model, id, olcek){
  var k = olcek > 0 ? olcek : 1;
  var a = veStepP21Varlik(model, id).a;               // AXIS2_PLACEMENT_3D(ad, konum, eksen, ref)
  var o = veStepP21Varlik(model, a[1].ref).a[1];
  var z = a[2] && a[2].ref ? _stpBirimVek(veStepP21Varlik(model, a[2].ref).a[1]) : [0, 0, 1];
  var x;
  if(a[3] && a[3].ref) x = veStepP21Varlik(model, a[3].ref).a[1];
  else x = Math.abs(z[0]) < 1 - 1e-12 ? [1, 0, 0] : [0, 0, 1];     // ISO 10303-42 first_proj_axis
  x = _stpBirimVek(_stpCikar(x, _stpCarpS(z, _stpNokta(x, z))));
  var y = _stpVektorel(z, x);
  return { o: [o[0] * k, o[1] * k, (o.length > 2 ? o[2] : 0) * k], x: x, y: y, z: z };
}

function veStepP21Donusum(cerceve){
  var f = cerceve;
  return { R: [[f.x[0], f.y[0], f.z[0]], [f.x[1], f.y[1], f.z[1]], [f.x[2], f.y[2], f.z[2]]], t: f.o.slice() };
}
var VE_STEP_P21_BIRIM = { R: [[1, 0, 0], [0, 1, 0], [0, 0, 1]], t: [0, 0, 0] };

function veStepP21Bilesik(a, b){                          // a ∘ b
  var R = [0, 1, 2].map(function(i){ return [0, 1, 2].map(function(j){
    return a.R[i][0] * b.R[0][j] + a.R[i][1] * b.R[1][j] + a.R[i][2] * b.R[2][j]; }); });
  return { R: R, t: _stpTopla(_stpUygulaR(a.R, b.t), a.t) };
}
function veStepP21Ters(m){
  var Rt = [[m.R[0][0], m.R[1][0], m.R[2][0]], [m.R[0][1], m.R[1][1], m.R[2][1]], [m.R[0][2], m.R[1][2], m.R[2][2]]];
  return { R: Rt, t: _stpCarpS(_stpUygulaR(Rt, m.t), -1) };
}
function veStepP21NoktaUygula(m, p){ return _stpTopla(_stpUygulaR(m.R, p), m.t); }
function veStepP21YonUygula(m, d){ return _stpUygulaR(m.R, d); }

function _stpUygulaR(R, v){ return [R[0][0] * v[0] + R[0][1] * v[1] + R[0][2] * v[2],
  R[1][0] * v[0] + R[1][1] * v[1] + R[1][2] * v[2], R[2][0] * v[0] + R[2][1] * v[1] + R[2][2] * v[2]]; }
function _stpTopla(a, b){ return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
function _stpCikar(a, b){ return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function _stpCarpS(a, s){ return [a[0] * s, a[1] * s, a[2] * s]; }
function _stpNokta(a, b){ return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function _stpVektorel(a, b){ return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function _stpBirimVek(a){ var L = Math.sqrt(_stpNokta(a, a)); return L > 0 ? _stpCarpS(a, 1 / L) : a.slice(); }

// ── 7 · MONTAJ AĞACI ─────────────────────────────────────────────────────
// Her parça ÖRNEĞİ ayrı döner: aynı parça iki kez takılıysa iki kayıt, iki
// ayrı dünya dönüşümü. Döner:
//   { parcalar: [{ pd, urun:{id, ad, aciklama}, ornek, yol, M, sr, birim,
//                  yuzler:[kimlik], egriler:[kimlik] }], uyarilar: [] }
// İŞ İKİ EVRE: kayıtlar KİMLİK SIRASIYLA taranır (ilgili tipler koduyla
// seçilir, gövdeye bakılmaz), sonra ağaç yığınla yürünür — çocuğun konumu
// sırası gelince çözülür, yani parçaların ve uyarıların sırası özyinelemeli
// yürüyüşünkiyle aynı.
var _STP_MONTAJ_TIP = { PRODUCT_DEFINITION: 1, NEXT_ASSEMBLY_USAGE_OCCURRENCE: 2, ASSEMBLY_COMPONENT_USAGE: 2,
  SHAPE_DEFINITION_REPRESENTATION: 3, CONTEXT_DEPENDENT_SHAPE_REPRESENTATION: 4,
  SHAPE_REPRESENTATION_RELATIONSHIP: 5, MAPPED_ITEM: 6 };
function veStepP21Montaj(model){
  var J = _stpMontajIs(model);
  while(!_stpMontajAdim(J, Infinity));
  return J.out;
}
function _stpMontajIs(model){
  var ilgi = new Uint8Array(model.tipAd.length);
  model.tipAd.forEach(function(ad, kod){ ilgi[kod] = _STP_MONTAJ_TIP.hasOwnProperty(ad) ? _STP_MONTAJ_TIP[ad] : 0; });
  return { model: model, out: { parcalar: [], uyarilar: [] }, evre: 0, k: model.yer ? 1 : 0, sirali: null, ilgi: ilgi,
           pdler: [], pdSr: {}, cocuklar: {}, cocukMu: {}, nauoCdsr: {}, srrKomsu: {}, mapped: 0, ornekSay: 0,
           yigin: null, ziyaret: 0, toplam: 1 };
}
// Bir dilim; iş bittiyse true. `bitis`: saat (_stpSimdi) sınırı.
function _stpMontajAdim(J, bitis){
  if(J.evre === 0){
    if(!_stpMontajKayitlar(J, bitis)) return false;
    if(J.mapped)
      J.out.uyarilar.push('Dosyada ' + J.mapped + ' MAPPED_ITEM var; bu kalıpla konumlandırılmış '
        + 'parçalar okunmaz.');
    var kokler = J.pdler.filter(function(pd){ return !J.cocukMu[pd]; });
    J.yigin = [];
    for(var q = kokler.length - 1; q >= 0; q--) J.yigin.push({ pd: kokler[q], M: VE_STEP_P21_BIRIM, yol: [], atalar: [] });
    J.toplam = Math.max(1, kokler.length + J.ornekSay);
    J.evre = 1;
    if(_stpSimdi() > bitis) return false;
  }
  return _stpMontajYuru(J, bitis);
}
function _stpMontajKayitlar(J, bitis){
  var m = J.model, ilgi = J.ilgi, tip = m.tip, enb = m.enBuyukId, adim = 0, id, s, g;
  if(!m.yer && !J.sirali)                                   // seyrek kimlikler: sıralı liste
    J.sirali = Array.from(m.yerMap.keys()).sort(function(a, b){ return a - b; });
  for(;;){
    if(m.yer){
      if(J.k > enb) return true;
      id = J.k++; s = m.yer[id] - 1;
    } else {
      if(J.k >= J.sirali.length) return true;
      id = J.sirali[J.k++]; s = m.yerMap.get(id) - 1;
    }
    if(s >= 0 && (g = ilgi[tip[s]])) _stpMontajKayit(J, id, g);
    if(++adim >= 4096){ adim = 0; if(_stpSimdi() > bitis) return false; }
  }
}
function _stpMontajKayit(J, id, g){
  var m = J.model;
  if(g === 1) J.pdler.push(id);
  else if(g === 2){
    var a = veStepP21Varlik(m, id).a;
    var ebeveyn = a[3].ref, cocuk = a[4].ref;
    (J.cocuklar[ebeveyn] = J.cocuklar[ebeveyn] || []).push({ nauo: id, pd: cocuk, ad: a[0] && a[0].s });
    J.cocukMu[cocuk] = 1;
    J.ornekSay++;
  }
  else if(g === 3){
    var sd = veStepP21Varlik(m, id).a;
    var pds = veStepP21Varlik(m, sd[0].ref);
    if(pds && pds.a[2] && veStepP21Tip(m, pds.a[2].ref) === 'PRODUCT_DEFINITION')
      J.pdSr[pds.a[2].ref] = sd[1].ref;
  }
  else if(g === 4){
    var cd = veStepP21Varlik(m, id).a;
    var pds2 = veStepP21Varlik(m, cd[1].ref);
    if(pds2 && pds2.a[2]) J.nauoCdsr[pds2.a[2].ref] = cd[0].ref;
  }
  else if(g === 5){
    var rr = veStepP21Varlik(m, id).a;
    (J.srrKomsu[rr[2].ref] = J.srrKomsu[rr[2].ref] || []).push(rr[3].ref);
    (J.srrKomsu[rr[3].ref] = J.srrKomsu[rr[3].ref] || []).push(rr[2].ref);
  }
  else if(g === 6) J.mapped++;
}
// `atalar`: kökten bu parçaya kadar alt montajların ürünleri. Tedarikçi
// gergiyi çoğu zaman alt montaj olarak verir (kol · gövde · kasnak ayrı
// parça); "bu parça gergiye ait" bilgisi o zaman yalnız atanın adında durur.
function _stpMontajYuru(J, bitis){
  var m = J.model, out = J.out, Y = J.yigin, adim = 0;
  while(Y.length){
    var e = Y.pop();
    if(e.c){                                                  // çocuk: konumu sırası gelince
      var c = e.c, rrwt = J.nauoCdsr[c.nauo];
      var yerel = rrwt ? _stpYerelDonusum(m, rrwt, J.pdSr[c.pd], out.uyarilar) : null;
      if(!yerel) out.uyarilar.push('"' + (c.ad || ('#' + c.nauo)) + '" örneğinin konumu okunamadı; parça atlandı.');
      else Y.push({ pd: c.pd, M: veStepP21Bilesik(e.M, yerel), yol: e.yol.concat([c.ad || ('#' + c.nauo)]),
                    atalar: e.atalar.concat([e.urun]) });
    } else if(++J.ziyaret <= 100000){
      var pd = e.pd, sr = J.pdSr[pd];
      var geo = sr ? _stpGeometri(m, sr, J.srrKomsu, out.uyarilar) : { yuzler: [], egriler: [] };
      var cc = J.cocuklar[pd] || [];
      var urun = _stpUrun(m, pd);
      if(geo.yuzler.length || geo.egriler.length || !cc.length){
        out.parcalar.push({ pd: pd, urun: urun, ornek: e.yol.length ? e.yol[e.yol.length - 1] : urun.id,
          yol: e.yol.slice(), atalar: e.atalar.slice(), M: e.M, sr: sr || null,
          birim: sr ? _stpSrBirim(m, sr) : { mm: NaN, derece: NaN },
          yuzler: geo.yuzler, egriler: geo.egriler, altMontaj: cc.length > 0 });
      }
      for(var q = cc.length - 1; q >= 0; q--) Y.push({ c: cc[q], M: e.M, yol: e.yol, atalar: e.atalar, urun: urun });
    }
    if(++adim >= 4){ adim = 0; if(_stpSimdi() > bitis) return false; }
  }
  return true;
}

function _stpUrun(model, pd){
  var a = veStepP21Varlik(model, pd).a;                    // PRODUCT_DEFINITION(id, açıklama, pdf, bağlam)
  var pdf = veStepP21Varlik(model, a[2].ref).a;            // PDF(id, açıklama, ürün, ...)
  var u = veStepP21Varlik(model, pdf[2].ref).a;            // PRODUCT(id, ad, açıklama, bağlamlar)
  return { id: (u[0] && u[0].s) || '', ad: (u[1] && u[1].s) || '', aciklama: (u[2] && u[2].s) || '' };
}

function _stpSrBirim(model, sr){
  var v = veStepP21Varlik(model, sr);
  var govde = v.t === 'COMPLEX' ? null : v;
  if(!govde || !govde.a[2] || !govde.a[2].ref) return { mm: NaN, derece: NaN };
  return veStepP21Birim(model, govde.a[2].ref);
}

// RRWT → yerel dönüşüm (çocuk temsili → ebeveyn temsili). CAx-IF kalıbında
// rep_1 çocuk, rep_2 ebeveyndir; bazı yazıcılar TERS yazar — çocuğun temsili
// hangisiyse ona göre çevrilir.
function _stpYerelDonusum(model, rrwtId, cocukSr, uyarilar){
  var rr = veStepP21Parca(model, rrwtId, 'REPRESENTATION_RELATIONSHIP');
  var wt = veStepP21Parca(model, rrwtId, 'REPRESENTATION_RELATIONSHIP_WITH_TRANSFORMATION');
  if(!rr || !wt || !wt.a[0] || !wt.a[0].ref) return null;
  var idt = veStepP21Varlik(model, wt.a[0].ref);
  if(!idt || idt.t !== 'ITEM_DEFINED_TRANSFORMATION') {
    uyarilar.push('Montaj dönüşümü ITEM_DEFINED_TRANSFORMATION değil (' + (idt && idt.t) + '); desteklenmiyor.');
    return null;
  }
  var rep1 = rr.a[2].ref, rep2 = rr.a[3].ref;
  var k1 = _stpSrOlcek(model, rep1), k2 = _stpSrOlcek(model, rep2);
  var F1 = veStepP21Donusum(veStepP21Cerceve(model, idt.a[2].ref, k1));
  var F2 = veStepP21Donusum(veStepP21Cerceve(model, idt.a[3].ref, k2));
  if(cocukSr && rep2 === cocukSr && rep1 !== cocukSr) return veStepP21Bilesik(F1, veStepP21Ters(F2));
  return veStepP21Bilesik(F2, veStepP21Ters(F1));
}

function _stpSrOlcek(model, sr){
  var b = _stpSrBirim(model, sr);
  return b.mm > 0 ? b.mm : 1;
}

// Temsilin geometrisi: yüzler ve (geometrik setlerdeki) eğriler. Dönüşümsüz
// SHAPE_REPRESENTATION_RELATIONSHIP ile bağlı temsiller de dahil (CATIA V5
// geometriyi ayrı bir ADVANCED_BREP_SHAPE_REPRESENTATION'a koyar).
// Yalnız KAP tipleri (kabuk · katı · küme) ayrıştırılır: alt montajın temsili
// her çocuğun yerleşimini listeler (motor: ~9.000 öğe) ve hepsini ayrıştırmak
// tek düğümde 30 ms'yi aşıyordu (ölçüldü).
var _STP_GEO_KAP = { SHELL_BASED_SURFACE_MODEL: 1, GEOMETRIC_SET: 1, GEOMETRIC_CURVE_SET: 1, OPEN_SHELL: 1,
  CLOSED_SHELL: 1, CONNECTED_FACE_SET: 1, ORIENTED_CLOSED_SHELL: 1, ORIENTED_OPEN_SHELL: 1,
  MANIFOLD_SOLID_BREP: 1, FACETED_BREP: 1, BREP_WITH_VOIDS: 1 };
function _stpGeometri(model, sr, srrKomsu, uyarilar){
  var yuzler = [], egriler = [], gor = {}, temsilGor = {};
  function oge(id){
    if(gor[id]) return;
    gor[id] = 1;
    var t = veStepP21Tip(model, id);
    if(t === 'ADVANCED_FACE' || t === 'FACE_SURFACE'){ yuzler.push(id); return; }
    if(t === 'COMPOSITE_CURVE' || t === 'TRIMMED_CURVE' || t === 'CIRCLE' || t === 'LINE'
       || t === 'POLYLINE' || t === 'B_SPLINE_CURVE_WITH_KNOTS'){ egriler.push(id); return; }
    if(!_STP_GEO_KAP.hasOwnProperty(t)) return;           // yerleşim · MAPPED_ITEM (Montaj'da topluca uyarıldı) …
    var a = veStepP21Varlik(model, id).a;
    if(!a) return;
    if(t === 'SHELL_BASED_SURFACE_MODEL' || t === 'GEOMETRIC_SET' || t === 'GEOMETRIC_CURVE_SET'
       || t === 'OPEN_SHELL' || t === 'CLOSED_SHELL' || t === 'CONNECTED_FACE_SET'){ _stpRefler(a[1]).forEach(oge); return; }
    if(t === 'ORIENTED_CLOSED_SHELL' || t === 'ORIENTED_OPEN_SHELL'){ if(a[2] && a[2].ref) oge(a[2].ref); return; }
    if(t === 'MANIFOLD_SOLID_BREP' || t === 'FACETED_BREP'){ if(a[1] && a[1].ref) oge(a[1].ref); return; }
    if(t === 'BREP_WITH_VOIDS'){ if(a[1] && a[1].ref) oge(a[1].ref); _stpRefler(a[2]).forEach(oge); }
  }
  function temsil(r){
    if(temsilGor[r]) return;
    temsilGor[r] = 1;
    var v = veStepP21Varlik(model, r);
    if(v && v.t !== 'COMPLEX' && v.a && Array.isArray(v.a[1])) _stpRefler(v.a[1]).forEach(oge);
    (srrKomsu[r] || []).forEach(temsil);
  }
  temsil(sr);
  return { yuzler: yuzler, egriler: egriler };
}

// ── 8 · YÜZ ─────────────────────────────────────────────────────────────
// Bir yüzün dünya koordinatında analitik tanımı ve sınır çemberleri. Yalnız
// FEAD'in ihtiyaç duyduğu yüzey tipleri çözülür; diğerleri tipiyle döner.
//   { id, tip, o, z, r, yariAci, R, rk, cemberler: [{c, n, r}] }
function veStepP21Yuz(model, yuzId, M, birim){
  var k = birim && birim.mm > 0 ? birim.mm : 1;
  var dk = birim && birim.derece > 0 ? birim.derece : 180 / Math.PI;
  var a = veStepP21Varlik(model, yuzId).a;              // ADVANCED_FACE(ad, sınırlar, yüzey, aynı_yön)
  var sid = a[2].ref, st = veStepP21Tip(model, sid);
  var out = { id: yuzId, tip: st, cemberler: [] };
  if(st === 'CYLINDRICAL_SURFACE' || st === 'CONICAL_SURFACE' || st === 'TOROIDAL_SURFACE'
     || st === 'SPHERICAL_SURFACE' || st === 'PLANE'){
    var s = veStepP21Varlik(model, sid).a;
    var f = veStepP21Cerceve(model, s[1].ref, k);
    out.o = veStepP21NoktaUygula(M, f.o);
    out.z = _stpBirimVek(veStepP21YonUygula(M, f.z));
    if(st === 'CYLINDRICAL_SURFACE' || st === 'SPHERICAL_SURFACE') out.r = s[2] * k;
    if(st === 'CONICAL_SURFACE'){ out.r = s[2] * k; out.yariAci = s[3] * dk; }
    if(st === 'TOROIDAL_SURFACE'){ out.R = s[2] * k; out.rk = s[3] * k; }
  }
  _stpRefler(a[1]).forEach(function(b){
    var fb = veStepP21Varlik(model, b);
    if(!fb || !fb.a[1]) return;
    var dongu = veStepP21Varlik(model, fb.a[1].ref);
    if(!dongu || dongu.t !== 'EDGE_LOOP') return;
    _stpRefler(dongu.a[1]).forEach(function(oe){
      var kenar = veStepP21Varlik(model, oe).a[3];           // ORIENTED_EDGE(ad, *, *, kenar, yön)
      var c = kenar && kenar.ref ? _stpKenarCemberi(model, kenar.ref, M, k) : null;
      if(c) out.cemberler.push(c);
    });
  });
  return out;
}

// ── 8b · EĞRİ (geometrik kümedeki eskiz) ─────────────────────────────────
// COMPOSITE_CURVE (ya da tek TRIMMED_CURVE) → doğru ve çember yayları, dünya
// koordinatında, mm. Okuyucu ANLAM YÜKLEMEZ: hangi eskizin kayış olduğunu
// tanıyıcı söyler. Kırpma yalnız KARTEZYEN noktayla okunur (CATIA'nın
// yazdığı .CARTESIAN. tercihi); parametreyle kırpılmış parça `destek: false`.
//   { ad, parcalar: [{ tip, p1, p2, L, (çember) c, n, r, aci }], L, kapali, destek }
function veStepP21Egri(model, id, M, birim){
  var k = birim && birim.mm > 0 ? birim.mm : NaN;
  var out = { ad: '', parcalar: [], L: 0, kapali: false, destek: k > 0 };
  if(!(k > 0)) return out;
  var t = veStepP21Tip(model, id), segler = [];
  if(t === 'COMPOSITE_CURVE'){
    var a = veStepP21Varlik(model, id).a;
    out.ad = (a[0] && a[0].s) || '';
    _stpRefler(a[1]).forEach(function(sid){
      var sg = veStepP21Varlik(model, sid).a;               // (geçiş, aynı yön, ana eğri)
      segler.push({ ayni: !(sg[1] && sg[1].e === 'F'), egri: sg[2] && sg[2].ref });
    });
  } else if(t === 'TRIMMED_CURVE') segler.push({ ayni: true, egri: id });
  else { out.destek = false; return out; }
  segler.forEach(function(s){
    var p = _stpKirpik(model, s.egri, M, k);
    if(!s.ayni && p.p1){ var q = p.p1; p.p1 = p.p2; p.p2 = q; if(p.yon) p.yon = -p.yon; }
    out.parcalar.push(p);
    if(Number.isFinite(p.L)) out.L += p.L; else out.destek = false;
  });
  var P = out.parcalar;
  if(P.length && P[0].p1 && P[P.length - 1].p2){
    var d = _stpCikar(P[P.length - 1].p2, P[0].p1);
    out.kapali = Math.sqrt(_stpNokta(d, d)) <= 1e-3;
  }
  return out;
}
// TRIMMED_CURVE(ad, taban, kırpma1, kırpma2, yön_uyumu, tercih)
function _stpKirpik(model, id, M, k){
  var tt = id ? veStepP21Tip(model, id) : '';
  if(tt !== 'TRIMMED_CURVE') return { tip: tt || '?', L: NaN };
  var a = veStepP21Varlik(model, id).a;
  var taban = a[1] && a[1].ref, bt = taban ? veStepP21Tip(model, taban) : '';
  var nk = function(liste){
    var r = _stpRefler(liste).filter(function(x){ return veStepP21Tip(model, x) === 'CARTESIAN_POINT'; })[0];
    if(!r) return null;
    var v = veStepP21Varlik(model, r).a[1];
    return veStepP21NoktaUygula(M, [v[0] * k, v[1] * k, (v.length > 2 ? v[2] : 0) * k]);
  };
  var p1 = nk(a[2]), p2 = nk(a[3]);
  if(!p1 || !p2) return { tip: bt, L: NaN };
  var uyum = !(a[4] && a[4].e === 'F');
  if(bt === 'LINE'){
    var d = _stpCikar(p2, p1);
    return { tip: 'LINE', p1: p1, p2: p2, L: Math.sqrt(_stpNokta(d, d)) };
  }
  if(bt === 'CIRCLE'){
    var ca = veStepP21Varlik(model, taban).a;              // CIRCLE(ad, yerleşim, yarıçap)
    var f = veStepP21Cerceve(model, ca[1].ref, k);
    var c = veStepP21NoktaUygula(M, f.o), n = _stpBirimVek(veStepP21YonUygula(M, f.z)), r = ca[2] * k;
    // Tabanın yönüyle (n etrafında saat tersine) p1 → p2; yön uyuşmuyorsa
    // eğri p1'den p2'ye TERS yönde gider — süpürülen açı p2 → p1'in yayı.
    var yay = function(u, v){
      var A = _stpCikar(u, c), B = _stpCikar(v, c);
      var th = Math.atan2(_stpNokta(_stpVektorel(A, B), n), _stpNokta(A, B));
      return th <= 1e-12 ? th + 2 * Math.PI : th;
    };
    var aci = uyum ? yay(p1, p2) : yay(p2, p1);
    return { tip: 'CIRCLE', p1: p1, p2: p2, c: c, n: n, r: r, aci: aci, yon: uyum ? 1 : -1, L: aci * r };
  }
  return { tip: bt, L: NaN };
}

function _stpKenarCemberi(model, kenarId, M, k){
  var e = veStepP21Varlik(model, kenarId);
  if(!e || e.t !== 'EDGE_CURVE') return null;
  var g = e.a[3].ref, t = veStepP21Tip(model, g);
  if(t === 'SURFACE_CURVE' || t === 'SEAM_CURVE' || t === 'INTERSECTION_CURVE'){
    g = veStepP21Varlik(model, g).a[1].ref;
    t = veStepP21Tip(model, g);
  }
  if(t !== 'CIRCLE') return null;
  var c = veStepP21Varlik(model, g).a;                        // CIRCLE(ad, yerleşim, yarıçap)
  var f = veStepP21Cerceve(model, c[1].ref, k);
  return { c: veStepP21NoktaUygula(M, f.o), n: _stpBirimVek(veStepP21YonUygula(M, f.z)), r: c[2] * k };
}

// ── 9 · BAŞLIK ────────────────────────────────────────────────────────────
function veStepP21Baslik(model){
  var fn = model.baslik.FILE_NAME || [], fs = model.baslik.FILE_SCHEMA || [];
  var dz = function(v){ return v && v.s !== undefined ? v.s : ''; };
  var sema = Array.isArray(fs[0]) ? fs[0].map(dz).join(', ') : '';
  return { dosya: dz(fn[0]), tarih: dz(fn[1]), onisleyici: dz(fn[4]), sistem: dz(fn[5]), sema: sema };
}

// ── 10 · KAP: .stp · .step · .stpZ ─────────────────────────────────────────
// Dosya seçicisinden gelen baytlar. Kap UZANTIDAN değil İMZADAN tanınır —
// aynı `.stpZ` uzantısıyla gzip de zip de yazılıyor:
//   1F 8B        gzip (RFC 1952)
//   50 4B 03 04  zip; içindeki ilk .stp/.step/.p21 girişi (yoksa ilk giriş)
//   diğer        düz metin
// İKİ AÇICI, TEK HAM VERİ: `_stpKap` deflate akışının yerini bulur. Senkron
// yol ölçüm içe aktarmanın saf JS inflate'i (js/xlsx-read.js); dilimli yol
// tarayıcının DecompressionStream'i — parça parça açar, arayüz donmaz (saf JS
// açıcı 420 MB'lık açılmış dosyada arayüzü tek görevde tutuyordu). Akış
// yoksa ya da hata verirse (bozuk kuyruk) senkron açıcı.
function _stpAcici(){
  if(typeof veXlsInflateRaw === 'function')
    return { inflate: veXlsInflateRaw, zip: (typeof veXlsZipRead === 'function') ? veXlsZipRead : null };
  if(typeof require === 'function'){
    try { var x = require('./xlsx-read.js'); return { inflate: x.veXlsInflateRaw, zip: x.veXlsZipRead }; }
    catch(e){ return null; }
  }
  return null;
}
function _stpU32(b, p){ return (b[p] | (b[p + 1] << 8) | (b[p + 2] << 16)) + b[p + 3] * 16777216; }
// Döner: { kap, icerik?, yontem (0 saklı · 8 deflate), ham, akis (gzip'te
// kuyruksuz deflate), boy (açılmış boy, bilinmiyorsa 0) }
function _stpKap(b){
  if(b.length >= 2 && b[0] === 0x1F && b[1] === 0x8B){
    if(b.length < 18 || b[2] !== 8) throw new Error('gzip: desteklenmeyen sıkıştırma yöntemi ya da yarım dosya.');
    var flg = b[3], p = 10, n = b.length;
    if(flg & 4) p += 2 + (b[p] | (b[p + 1] << 8));              // FEXTRA
    if(flg & 8){ while(p < n && b[p] !== 0) p++; p++; }          // FNAME
    if(flg & 16){ while(p < n && b[p] !== 0) p++; p++; }         // FCOMMENT
    if(flg & 2) p += 2;                                          // FHCRC
    return { kap: 'gzip', yontem: 8, ham: b.subarray(p), akis: b.subarray(p, Math.max(p, n - 8)), boy: _stpU32(b, n - 4) };
  }
  if(b.length >= 4 && b[0] === 0x50 && b[1] === 0x4B && b[2] === 0x03 && b[3] === 0x04){
    var ac = _stpAcici();
    if(!ac || !ac.zip) throw new Error('Sıkıştırılmış STEP açılamadı: açıcı yüklenmemiş.');
    var zip = ac.zip(b);
    var adlar = zip.names.filter(function(a){ return !/\/$/.test(a); });
    var ad = adlar.filter(function(a){ return /\.(stp|step|p21)$/i.test(a); })[0] || adlar[0];
    if(!ad) throw new Error('zip: arşivde dosya yok.');
    var en = zip.entries[ad], lo = en.localOff;
    if(lo + 30 > b.length || _stpU32(b, lo) !== 0x04034b50) throw new Error('ZIP: yerel başlık bozuk — ' + ad);
    if(en.method !== 0 && en.method !== 8) throw new Error('ZIP: desteklenmeyen sıkıştırma yöntemi (' + en.method + ')');
    // Veri konumu YEREL başlıktan (ad/ek alan uzunlukları merkezi dizindekinden farklı olabilir)
    var bas = lo + 30 + (b[lo + 26] | (b[lo + 27] << 8)) + (b[lo + 28] | (b[lo + 29] << 8));
    var ham = b.subarray(bas, bas + en.compSize);
    var boy = (b[lo + 6] & 8) ? 0 : _stpU32(b, lo + 22);         // veri tanımlayıcılı girişte boy sonda
    return { kap: 'zip', icerik: ad, yontem: en.method, ham: ham, akis: ham, boy: boy === 0xFFFFFFFF ? 0 : boy };
  }
  return { kap: 'duz', yontem: 0, ham: b, akis: b, boy: b.length };
}

// SENKRON: baytlar → açılmış baytlar { bayt, kap: 'duz'|'gzip'|'zip', icerik? } —
// açılamayan kap ADRESLİ bir hata atar (sessiz boş dosya değil).
function veStepP21Ac(bayt){
  var k = _stpKap(_stpGirdiBayt(bayt || new Uint8Array(0)));
  var r = { bayt: k.ham, kap: k.kap };
  if(k.icerik !== undefined) r.icerik = k.icerik;
  if(k.yontem === 8){
    var ac = _stpAcici();
    if(!ac || !ac.inflate) throw new Error('Sıkıştırılmış STEP açılamadı: açıcı yüklenmemiş.');
    r.bayt = ac.inflate(k.ham);
  }
  return r;
}

// Baytlar → METİN (FEAD'in yolu: dosya küçük, tanıyıcı metinle okur). Ham
// bayt önce UTF-8 (geçerliyse), değilse ISO 8859-1 okunur; ikisinde de ASCII
// kısım birebir aynı kalır. Döner: { metin, kap, icerik? }
function _stpUtf8(b){
  var out = [], parca = '', i = 0, n = b.length;
  while(i < n){
    var c = b[i], cp, ek;
    if(c < 0x80){ cp = c; ek = 0; }
    else if(c >= 0xC2 && c < 0xE0){ cp = c & 0x1F; ek = 1; }
    else if(c >= 0xE0 && c < 0xF0){ cp = c & 0x0F; ek = 2; }
    else if(c >= 0xF0 && c < 0xF5){ cp = c & 0x07; ek = 3; }
    else return null;                                          // geçersiz başlangıç baytı
    if(ek && i + ek >= n) return null;                          // yarım dizi
    for(var k = 1; k <= ek; k++){
      var d = b[i + k];
      if((d & 0xC0) !== 0x80) return null;
      cp = (cp << 6) | (d & 0x3F);
    }
    if((ek === 2 && cp < 0x800) || (ek === 3 && (cp < 0x10000 || cp > 0x10FFFF))) return null;
    i += ek + 1;
    if(cp > 0xFFFF){ cp -= 0x10000; out.push(0xD800 + (cp >> 10), 0xDC00 + (cp & 0x3FF)); }
    else out.push(cp);
    if(out.length >= 8192){ parca += String.fromCharCode.apply(null, out); out.length = 0; }
  }
  return parca + String.fromCharCode.apply(null, out);
}
function _stpLatin1(b){
  var s = '';
  for(var i = 0; i < b.length; i += 8192)
    s += String.fromCharCode.apply(null, b.subarray(i, Math.min(b.length, i + 8192)));
  return s;
}
function _stpBaytMetin(b){
  var i = 0;
  while(i < b.length && b[i] < 0x80) i++;
  if(i === b.length) return _stpLatin1(b);                     // saf ASCII: hızlı yol
  var u = _stpUtf8(b);
  return u === null ? _stpLatin1(b) : u;
}
function veStepP21Metin(bayt){
  var a = veStepP21Ac(bayt), r = { metin: _stpBaytMetin(a.bayt), kap: a.kap };
  if(a.icerik !== undefined) r.icerik = a.icerik;
  return r;
}

// ── 11 · AĞAÇ — montajın düğümleri ve parçaların yüzleri (ANLAMSIZ) ──────
// Örnek yolunun her öneki bir düğüm (kök · alt montaj · parça); parça başına
// yüzlerin analitik tanımı ve görüntü ağı için gereken girdiler. Kim neyi
// arayacağını kendisi bilir: FEAD kasnak (js/fead-step.js), Takoz gövde ve
// takoz (js/mount-step.js). Okuma hiçbir şeye KARAR VERMEZ — ad dâhil.
// (2026-10-14'e kadar bu gövde FEAD tanıyıcısının `veFeadStpOku`suydu; Takoz
// aynı okumayı istediğinde ikinci bir kopya yerine buraya taşındı.)
// Döner (asla fırlatmaz):
//   { ok, hatalar[], uyarilar[], baslik, sureMs{oku,montaj,yuz}, agac[], parcalar[],
//     _yuz[] (parça başına yüz tanımları), _model,
//     _geo[] (üçgenleyicinin girdisi: { yuzler, M, birim, egriler, sr }) }
// `secenek.yuz === false`: parça başına yüz tanımı çıkarılmaz — `_yuz` boş,
// `yuzSayisi` yüz KİMLİĞİ sayısı. Takoz onları okumuyor; 420 MB'ta okumanın
// en uzun evresiydi (7,4 sn).
function _stpAd(s){ return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }
function veStepP21Agac(girdi, secenek){
  var is = veStepP21AgacIs(girdi, secenek);
  while(!is.adim(Infinity));
  return is.sonuc;
}

function _stpDugum(A, out, yol, urun, ebeveyn){
  var k = yol.join('\u0001');
  if(A.anahtar[k] !== undefined) return A.anahtar[k];
  var i = out.agac.length;
  out.agac.push({ i: i, ad: _stpAd(urun.aciklama || urun.ad || urun.id || yol[yol.length - 1] || ''),
    id: urun.id || '', ornek: yol.length ? yol[yol.length - 1] : '', derinlik: yol.length,
    ebeveyn: ebeveyn, cocuklar: [], parcalar: [] });
  A.anahtar[k] = i;
  if(ebeveyn >= 0) out.agac[ebeveyn].cocuklar.push(i);
  return i;
}
function _stpAgacAdim(A, out, model, bitis){
  var P = A.mt.parcalar;
  while(A.k < P.length){
    var p = P[A.k], e = -1;
    for(var k = 0; k < p.yol.length; k++)
      e = _stpDugum(A, out, p.yol.slice(0, k), p.atalar[k] || { id: '', ad: '', aciklama: '' }, e);
    var d = _stpDugum(A, out, p.yol, p.urun, e);
    var ad = out.agac[d].ad;
    var yuzler = [], sayi = 0;
    if(p.yuzler.length && !(p.birim.mm > 0))
      out.uyarilar.push('"' + ad + '" parçasının uzunluk birimi okunamadı; mm varsayılmadı, parça atlandı.');
    else if(A.yuz){
      try { p.yuzler.forEach(function(f){ yuzler.push(veStepP21Yuz(model, f, p.M, p.birim)); }); }
      catch(e3){ out.uyarilar.push('"' + ad + '" parçasının yüzleri okunamadı: ' + e3.message); }
      sayi = yuzler.length;
    } else sayi = p.yuzler.length;
    A.toplamYuz += sayi;
    var pi = out.parcalar.length;
    out.parcalar.push({ i: pi, ad: ad, id: p.urun.id, ornek: p.ornek, dugum: d, yuzSayisi: sayi });
    if(A.yuz) out._yuz.push(yuzler);
    // `sr`: şeklin temsili — aynı temsili taşıyan örnekler aynı yerel ağı paylaşır
    out._geo.push({ yuzler: sayi ? p.yuzler : [], M: p.M, birim: p.birim, egriler: p.egriler || [], sr: p.sr || null });
    for(var a = d; a >= 0; a = out.agac[a].ebeveyn) out.agac[a].parcalar.push(pi);
    A.k++;
    if(_stpSimdi() > bitis) break;
  }
  return A.k >= P.length;
}

// ── 12 · OKUMA İŞİ ───────────────────────────────────────────────────────
// Evreler: tara (baytlar → dizin) → montaj (kayıtlar · yürüyüş) → ağaç
// (düğümler; istenirse parça başına yüzler). `adim(ms)` en çok o kadar
// çalışır (her çağrıda en az bir parça iş) ve iş bittiyse true döner. Sonuç
// `is.sonuc` (veStepP21Agac'ın biçimi — hata `hatalar`a yazılır, fırlatılmaz);
// `is.ilerleme()` → { evre, oran (0–1), bayt, toplam, parca, parcaToplam }.
// Evrenin çubuktaki payı ölçülmüş sürelerinden (420 MB'lık deneme montajı).
var _STP_EVRE_PAY = { tara: [0, 0.6], montaj: [0.6, 0.85], agac: [0.85, 1] };
var _STP_EVRE_PAY_YUZ = { tara: [0, 0.35], montaj: [0.35, 0.5], agac: [0.5, 1] };
function veStepP21AgacIs(girdi, secenek){
  var yuz = !(secenek && secenek.yuz === false);
  var out = { ok: false, hatalar: [], uyarilar: [], baslik: null, sureMs: { oku: 0, montaj: 0, yuz: 0 },
              agac: [], parcalar: [], _yuz: [], _model: null, _geo: [] };
  var is = { sonuc: out, bitti: false, evre: 'tara' };
  var pay = yuz ? _STP_EVRE_PAY_YUZ : _STP_EVRE_PAY;
  var model = null, D = null, J = null, A = null, dizin = false;
  try {
    model = _stpModel(_stpGirdiBayt(girdi));
    if(!_stpImzaVar(model.bayt)){ out.hatalar.push('Dosya bir STEP dosyası değil (ISO-10303-21 başlığı yok).'); is.bitti = true; }
    else D = _stpTarama(model);
  } catch(e){ out.hatalar.push('Dosya okunamadı: ' + e.message); is.bitti = true; }

  function evreTara(bitis){
    while(!dizin){
      if(_stpTaraDilim(D, D.i + 262144)){ dizin = true; break; }
      if(_stpSimdi() > bitis) return false;
    }
    if(!_stpDizinKur(D, bitis)) return false;
    _stpBaslikKur(D);
    out.baslik = veStepP21Baslik(model);
    out._model = model;
    J = _stpMontajIs(model);
    return true;
  }
  is.adim = function(butce){
    if(is.bitti) return true;
    var t0 = _stpSimdi(), bitis = t0 + (butce > 0 ? butce : 0), t, tamam;
    try {
      for(;;){
        t = _stpSimdi();
        if(is.evre === 'tara'){
          tamam = evreTara(bitis);
          out.sureMs.oku += _stpSimdi() - t;
          if(tamam) is.evre = 'montaj';
        } else if(is.evre === 'montaj'){
          try { tamam = _stpMontajAdim(J, bitis); }
          catch(e2){ out.hatalar.push('Montaj ağacı okunamadı: ' + e2.message); is.bitti = true; return true; }
          out.sureMs.montaj += _stpSimdi() - t;
          if(tamam){
            out.uyarilar = out.uyarilar.concat(J.out.uyarilar);
            A = { mt: J.out, k: 0, anahtar: {}, toplamYuz: 0, yuz: yuz };
            is.evre = 'agac';
          }
        } else {
          tamam = _stpAgacAdim(A, out, model, bitis);
          out.sureMs.yuz += _stpSimdi() - t;
          if(tamam){
            if(!A.toplamYuz) out.hatalar.push('Okunabilir yüz yok; geometri üçgen (tessellated) olabilir.');
            else out.ok = true;
            is.bitti = true;
            return true;
          }
        }
        if(_stpSimdi() > bitis) return false;
      }
    } catch(e){
      out.hatalar.push('Dosya okunamadı: ' + e.message);
      is.bitti = true;
      return true;
    }
  };
  is.ilerleme = function(){
    var p = pay[is.evre] || [1, 1], f = 0;
    if(is.evre === 'tara' && D) f = dizin ? 1 : D.i / Math.max(1, D.b.length);
    else if(is.evre === 'montaj' && J)
      f = J.evre === 0 ? 0.25 * J.k / Math.max(1, J.sirali ? J.sirali.length : model.enBuyukId)
        : 0.25 + 0.75 * Math.min(1, J.ziyaret / J.toplam);
    else if(is.evre === 'agac' && A) f = A.k / Math.max(1, A.mt.parcalar.length);
    return { evre: is.evre, oran: is.bitti ? 1 : p[0] + (p[1] - p[0]) * f,
             bayt: D ? D.i : 0, toplam: model ? model.bayt.length : 0,
             parca: A ? A.k : 0, parcaToplam: A ? A.mt.parcalar.length : (J ? J.out.parcalar.length : 0) };
  };
  return is;
}

// ── 13 · TARAYICIDA: DİLİMLİ OKUMA ─────────────────────────────────────────
// Baytlar (düz ya da sıkıştırılmış) → veStepP21Agac'ın sonucu, ARAYÜZÜ
// KİLİTLEMEDEN: açma akışla, iş ≤ VE_STEP_P21_DILIM ms'lik dilimlerle; dönüş
// MessageChannel'la (iç içe setTimeout(0) 4 ms'ye kenetlenir).
// `secenek`: veStepP21AgacIs'inki + `ilerleme(o)` — { evre: 'ac' | 'tara' |
// 'montaj' | 'agac', oran (0–1, bütün iş), bayt, toplam, parca, parcaToplam }.
// Döner: { sonuc: Promise<sonuç | null (vazgeçildi)>, vazgec() }. Sonuç kabı
// (`kap`, `icerik`) ve açma dâhil toplam süreyi (`sureMs.toplam`) taşır;
// açılamayan kap Promise'i ADRESLİ hatayla reddeder.
var _stpKanal = null, _stpKuyruk = [];
function _stpSonraki(fn){
  if(typeof MessageChannel !== 'function'){ setTimeout(fn, 0); return; }
  if(!_stpKanal){
    _stpKanal = new MessageChannel();
    _stpKanal.port1.onmessage = function(){ var f = _stpKuyruk.shift(); if(f) f(); };
  }
  _stpKuyruk.push(fn);
  _stpKanal.port2.postMessage(0);
}
function _stpAcDilimli(b, D, bildir){
  var k = _stpKap(b);
  var bitir = function(bayt){ var r = { bayt: bayt, kap: k.kap }; if(k.icerik !== undefined) r.icerik = k.icerik; return r; };
  var senkron = function(){
    var ac = _stpAcici();
    if(!ac || !ac.inflate) throw new Error('Sıkıştırılmış STEP açılamadı: açıcı yüklenmemiş.');
    return bitir(ac.inflate(k.ham));
  };
  if(k.yontem !== 8) return Promise.resolve(bitir(k.ham));
  // Girdi 256 KB'lık parçalarla ve İSTENDİKÇE verilir; okuyan döngü bütçe
  // dolunca olay döngüsüne döner. Tek parça verilen akış 403 MB'ı tek görevde
  // açıyordu (ölçüldü: 1,2 sn).
  var akis = null, ham = k.akis, p = 0;
  try {
    if(typeof DecompressionStream === 'function' && typeof ReadableStream === 'function')
      akis = new ReadableStream({ pull: function(c){
        if(p >= ham.length){ c.close(); return; }
        var q = Math.min(ham.length, p + 262144);
        c.enqueue(ham.subarray(p, q));
        p = q;
      } }, { highWaterMark: 0 }).pipeThrough(new DecompressionStream('deflate-raw'));
  } catch(e){ akis = null; }
  if(!akis) return new Promise(function(ok){ ok(senkron()); });
  var okuyucu = D.okuyucu = akis.getReader();
  var tahmin = k.boy > 0 ? k.boy : k.ham.length * 6, out = new Uint8Array(Math.max(65536, tahmin)), n = 0;
  var t0 = _stpSimdi();
  function oku(){
    return okuyucu.read().then(function(r){
      if(D.vazgec) return null;
      if(r.done){
        D.okuyucu = null;
        return bitir(n === out.length || n > 0.75 * out.length ? out.subarray(0, n) : out.slice(0, n));
      }
      var parca = r.value;
      if(n + parca.length > out.length){
        var y = new Uint8Array(Math.max(Math.ceil(out.length * 1.5), n + parca.length));
        y.set(out.subarray(0, n));
        out = y;
      }
      out.set(parca, n);
      n += parca.length;
      if(_stpSimdi() - t0 < VE_STEP_P21_DILIM) return oku();
      bildir({ evre: 'ac', bayt: n, toplam: Math.max(n, tahmin) });
      return new Promise(function(ok){ _stpSonraki(function(){ t0 = _stpSimdi(); ok(oku()); }); });
    });
  }
  return oku().then(null, function(){ return D.vazgec ? null : senkron(); });
}
function veStepP21AgacDilimli(bayt, secenek){
  secenek = secenek || {};
  var D = { vazgec: false, okuyucu: null }, t0 = _stpSimdi();
  var bildir = function(o){ if(!D.vazgec && typeof secenek.ilerleme === 'function') secenek.ilerleme(o); };
  var sonuc = new Promise(function(ok){ ok(_stpGirdiBayt(bayt)); }).then(function(b){
    var sikisik = b.length >= 2 && ((b[0] === 0x1F && b[1] === 0x8B) || (b[0] === 0x50 && b[1] === 0x4B));
    var acPay = sikisik ? 0.2 : 0;
    return _stpAcDilimli(b, D, function(o){ o.oran = acPay * Math.min(1, o.bayt / Math.max(1, o.toplam)); bildir(o); })
      .then(function(acik){
        if(D.vazgec || !acik) return null;
        var is = veStepP21AgacIs(acik.bayt, secenek);
        return new Promise(function(ok){
          (function dilim(){
            if(D.vazgec){ ok(null); return; }
            var bitti = is.adim(VE_STEP_P21_DILIM), o = is.ilerleme();
            o.oran = acPay + (1 - acPay) * o.oran;
            bildir(o);
            if(!bitti){ _stpSonraki(dilim); return; }
            var s = is.sonuc;
            s.kap = acik.kap;
            if(acik.icerik !== undefined) s.icerik = acik.icerik;
            s.sureMs.toplam = _stpSimdi() - t0;
            ok(s);
          })();
        });
      });
  });
  return { sonuc: sonuc, vazgec: function(){
    D.vazgec = true;
    if(D.okuyucu){ try { D.okuyucu.cancel(); } catch(e){} D.okuyucu = null; }
  } };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    VE_STEP_P21_SURUM: VE_STEP_P21_SURUM,
    VE_STEP_P21_ONBELLEK: VE_STEP_P21_ONBELLEK,
    VE_STEP_P21_DILIM: VE_STEP_P21_DILIM,
    veStepP21Ac: veStepP21Ac,
    veStepP21Metin: veStepP21Metin,
    VE_STEP_P21_BIRIM: VE_STEP_P21_BIRIM,
    veStepP21Oku: veStepP21Oku,
    veStepP21Coz: veStepP21Coz,
    veStepP21Tip: veStepP21Tip,
    veStepP21Varlik: veStepP21Varlik,
    veStepP21Parca: veStepP21Parca,
    veStepP21Birim: veStepP21Birim,
    veStepP21Cerceve: veStepP21Cerceve,
    veStepP21Donusum: veStepP21Donusum,
    veStepP21Bilesik: veStepP21Bilesik,
    veStepP21Ters: veStepP21Ters,
    veStepP21NoktaUygula: veStepP21NoktaUygula,
    veStepP21Egri: veStepP21Egri,
    veStepP21YonUygula: veStepP21YonUygula,
    veStepP21Montaj: veStepP21Montaj,
    veStepP21Yuz: veStepP21Yuz,
    veStepP21Baslik: veStepP21Baslik,
    veStepP21Agac: veStepP21Agac,
    veStepP21AgacIs: veStepP21AgacIs,
    veStepP21AgacDilimli: veStepP21AgacDilimli
  };
}
