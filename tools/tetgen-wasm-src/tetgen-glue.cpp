// MFSim TetGen WASM köprüsü — bu dosya MFSim'in kendi kaynağıdır (MIT).
// tetgen.cxx/tetgen.h/predicates.cxx AGPL-3, dışarıdan geldi, dokunulmadı.
#include <emscripten/bind.h>
#include <emscripten/val.h>
#include <vector>
#include <string>
#include "tetgen.h"

using namespace emscripten;

static val toFloat64Array(const double* data, size_t n){
  if(!data || !n) return val::global("Float64Array").new_(0);
  val view = val(typed_memory_view(n, data));
  return val::global("Float64Array").new_(view);
}
static val toInt32Array(const int* data, size_t n){
  if(!data || !n) return val::global("Int32Array").new_(0);
  val view = val(typed_memory_view(n, data));
  return val::global("Int32Array").new_(view);
}

// terminatetetgen() TETLIBRARY altında yalnız `throw x` yapar (mesaj YAZMAZ —
// mesajlar CLI moduna özel). Kodlar tetgen.h'deki terminatetetgen()'den.
static std::string tetErrorMessage(int code){
  switch(code){
    case 1:   return "Bellek yetersiz.";
    case 2:   return "TetGen içi bir hata oluştu.";
    case 3:   return "Yüzey ağı kendi kendini kesiyor — ağ oluşturulamadı.";
    case 4:   return "Girdi geometrisinde çok küçük bir özellik tespit edildi.";
    case 5:   return "İki girdi yüzeyi birbirine aşırı yakın.";
    case 10:  return "Girdi bozuk (geçersiz yüzey/köşe verisi).";
    case 200: return "Sınırda beklenmeyen ek nokta tespit edildi.";
    default:  return std::string("TetGen bilinmeyen bir hatayla durdu (kod ") + std::to_string(code) + ").";
  }
}

val veTetRun(val pointsVal, val triVal, val triMarkerVal, val holesVal, std::string switchesStr){
  val result = val::object();

  std::vector<double> pts = vecFromJSArray<double>(pointsVal);
  std::vector<int> tri = vecFromJSArray<int>(triVal);
  std::vector<int> triMarker = vecFromJSArray<int>(triMarkerVal);
  std::vector<double> holes = vecFromJSArray<double>(holesVal);

  if(pts.size() < 12 || (pts.size() % 3) != 0){
    result.set("ok", false);
    result.set("error", std::string("Geçersiz girdi: en az 4 nokta (x,y,z) gerekli."));
    return result;
  }
  if(tri.empty() || (tri.size() % 3) != 0 || triMarker.size() != tri.size() / 3){
    result.set("ok", false);
    result.set("error", std::string("Geçersiz girdi: üçgen/işaretçi dizileri uyuşmuyor."));
    return result;
  }

  tetgenio in, out;

  in.numberofpoints = (int)(pts.size() / 3);
  in.pointlist = new double[pts.size()];
  for(size_t i = 0; i < pts.size(); i++) in.pointlist[i] = pts[i];

  int nf = (int)(tri.size() / 3);
  in.numberoffacets = nf;
  in.facetlist = new tetgenio::facet[nf];
  in.facetmarkerlist = new int[nf];
  for(int f = 0; f < nf; f++){
    tetgenio::init(&in.facetlist[f]);
    in.facetlist[f].numberofpolygons = 1;
    in.facetlist[f].polygonlist = new tetgenio::polygon[1];
    tetgenio::init(&in.facetlist[f].polygonlist[0]);
    in.facetlist[f].polygonlist[0].numberofvertices = 3;
    int* vl = new int[3];
    vl[0] = tri[(size_t)f * 3];
    vl[1] = tri[(size_t)f * 3 + 1];
    vl[2] = tri[(size_t)f * 3 + 2];
    in.facetlist[f].polygonlist[0].vertexlist = vl;
    in.facetmarkerlist[f] = triMarker[f];
  }

  if(!holes.empty()){
    in.numberofholes = (int)(holes.size() / 3);
    in.holelist = new double[holes.size()];
    for(size_t i = 0; i < holes.size(); i++) in.holelist[i] = holes[i];
  }

  std::vector<char> sw(switchesStr.begin(), switchesStr.end());
  sw.push_back('\0');

  try {
    tetrahedralize(sw.data(), &in, &out);
  } catch(int code){
    result.set("ok", false);
    result.set("errorCode", code);
    result.set("error", tetErrorMessage(code));
    return result;
  } catch(...){
    result.set("ok", false);
    result.set("error", std::string("TetGen bilinmeyen bir istisna fırlattı."));
    return result;
  }

  if(out.numberoftetrahedra <= 0){
    result.set("ok", false);
    result.set("error", std::string("TetGen boş bir sonuç üretti (tetrahedron yok)."));
    return result;
  }

  result.set("ok", true);
  result.set("points", toFloat64Array(out.pointlist, (size_t)out.numberofpoints * 3));
  result.set("numberOfPoints", out.numberofpoints);
  result.set("tets", toInt32Array(out.tetrahedronlist, (size_t)out.numberoftetrahedra * out.numberofcorners));
  result.set("cornersPerTet", out.numberofcorners);
  result.set("numberOfTets", out.numberoftetrahedra);
  result.set("triFaces", toInt32Array(out.trifacelist, (size_t)out.numberoftrifaces * 3));
  result.set("triMarkers", toInt32Array(out.trifacemarkerlist, (size_t)out.numberoftrifaces));
  result.set("numberOfTriFaces", out.numberoftrifaces);
  return result;
}

EMSCRIPTEN_BINDINGS(tetgen_module){
  function("veTetRun", &veTetRun);
}
