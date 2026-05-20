// ============================================================================
// MFSim TetGen WASM Wrapper
// ============================================================================
// TetGen (Hang Si, AGPL-3.0) için C arayüzü. Emscripten ile derlenir,
// tarayıcıdan js/fea-tetgen.js üzerinden çağrılır.
//
// Giriş: PLC (Piecewise Linear Complex) — üçgenleştirilmiş kapalı yüzey
//        (STEP/STL'den gelen surface triangulation).
//   - points:   düz double dizisi [x0,y0,z0, x1,y1,z1, ...]
//   - triangles: düz int dizisi [i0,i1,i2, j0,j1,j2, ...] (point indislerine)
//   - switches:  TetGen switch string. Tipik: "pq1.4YQ"
//
// Çıkış: tetrahedral mesh (her tet 4 düğüm indisi).
//
// Bellek modeli: tetrahedralize() çıktısı tetgenio struct'ları handle ID'leri
// ile saklanır. JS tarafı malloc/free yapmaz; sadece read-only pointer alır.
// tetgen_free(handle) çağrısı ile temizlenir.
//
// LICENSE NOTU: Bu wrapper TetGen'i static link eder → AGPL-3.0 yayılır.
// Ticari kullanım için WIAS Berlin'den lisans alın (vendor/tetgen/NOTICE.md).
// ============================================================================

#ifndef TETLIBRARY
#define TETLIBRARY  // Library mode: extern void tetrahedralize(char*, ...)
#endif

#include "tetgen.h"
#if __has_include(<emscripten/emscripten.h>)
  #include <emscripten/emscripten.h>
#else
  // Emscripten yoksa (sistem g++ syntax check için): EMSCRIPTEN_KEEPALIVE stub.
  // Bu modül zaten yalnızca emcc ile derlenmek üzere tasarlandı; sistem g++
  // build'i sadece statik analiz amacıyla mümkün.
  #define EMSCRIPTEN_KEEPALIVE
#endif
#include <vector>
#include <string>
#include <cstring>
#include <cstdio>
#include <new>

namespace {

struct TetgenResult {
    tetgenio out;
    std::string error;
    int status;  // 0 = OK, !=0 = error
    TetgenResult() : status(0) {}
};

// Handle tablosu (sade slot reuse, JS deterministik handle alır)
std::vector<TetgenResult*> g_results;
std::string g_last_error;

int allocate_handle(TetgenResult* r) {
    for (size_t i = 0; i < g_results.size(); ++i) {
        if (g_results[i] == nullptr) {
            g_results[i] = r;
            return static_cast<int>(i + 1);  // 0 = invalid
        }
    }
    g_results.push_back(r);
    return static_cast<int>(g_results.size());
}

TetgenResult* lookup(int handle) {
    if (handle <= 0) return nullptr;
    size_t idx = static_cast<size_t>(handle - 1);
    if (idx >= g_results.size()) return nullptr;
    return g_results[idx];
}

}  // namespace

extern "C" {

// Versiyon bilgisi: 'TetGen-1.6.0/MFSim-wrapper-v1' gibi sabit string döner.
EMSCRIPTEN_KEEPALIVE
const char* tetgen_version() {
    return "TetGen-1.6.0/MFSim-wrapper-v1";
}

// Ana giriş noktası. Başarılıysa handle ID (>0), hata durumunda 0 döner.
// Hata mesajı tetgen_last_error() ile okunabilir.
EMSCRIPTEN_KEEPALIVE
int tetgen_tetrahedralize(
    const double* points, int point_count,
    const int* triangles, int triangle_count,
    const char* switches)
{
    g_last_error.clear();
    if (points == nullptr || point_count <= 0) {
        g_last_error = "boş veya geçersiz point listesi";
        return 0;
    }
    if (triangles == nullptr || triangle_count <= 0) {
        g_last_error = "boş veya geçersiz triangle listesi";
        return 0;
    }
    if (switches == nullptr) {
        g_last_error = "switches NULL";
        return 0;
    }

    tetgenio in;
    in.numberofpoints = point_count;
    in.pointlist = new (std::nothrow) REAL[point_count * 3];
    if (in.pointlist == nullptr) {
        g_last_error = "pointlist allocation başarısız";
        return 0;
    }
    for (int i = 0; i < point_count * 3; ++i) {
        in.pointlist[i] = static_cast<REAL>(points[i]);
    }

    // Üçgenleri facet listesine dönüştür (her üçgen 1 facet = 1 polygon)
    in.numberoffacets = triangle_count;
    in.facetlist = new (std::nothrow) tetgenio::facet[triangle_count];
    in.facetmarkerlist = new (std::nothrow) int[triangle_count];
    if (in.facetlist == nullptr || in.facetmarkerlist == nullptr) {
        g_last_error = "facetlist allocation başarısız";
        return 0;
    }

    for (int t = 0; t < triangle_count; ++t) {
        tetgenio::facet& f = in.facetlist[t];
        f.numberofpolygons = 1;
        f.polygonlist = new (std::nothrow) tetgenio::polygon[1];
        f.numberofholes = 0;
        f.holelist = nullptr;

        if (f.polygonlist == nullptr) {
            g_last_error = "polygon allocation başarısız (facet " +
                std::to_string(t) + ")";
            return 0;
        }

        tetgenio::polygon& p = f.polygonlist[0];
        p.numberofvertices = 3;
        p.vertexlist = new (std::nothrow) int[3];
        if (p.vertexlist == nullptr) {
            g_last_error = "vertexlist allocation başarısız (facet " +
                std::to_string(t) + ")";
            return 0;
        }
        p.vertexlist[0] = triangles[t * 3];
        p.vertexlist[1] = triangles[t * 3 + 1];
        p.vertexlist[2] = triangles[t * 3 + 2];

        in.facetmarkerlist[t] = 1;  // Tüm facet'ler boundary olarak işaretli
    }

    TetgenResult* result = new (std::nothrow) TetgenResult();
    if (result == nullptr) {
        g_last_error = "TetgenResult allocation başarısız";
        return 0;
    }

    // TetGen exception ile çıkmayı sever; yakala ve hata olarak raporla.
    try {
        // tetrahedralize char* alıyor; const_cast güvenli (TetGen modifiye etmez).
        char* sw_mut = const_cast<char*>(switches);
        ::tetrahedralize(sw_mut, &in, &result->out, nullptr, nullptr);
        result->status = 0;
    } catch (int code) {
        char buf[64];
        std::snprintf(buf, sizeof(buf), "TetGen exception code %d", code);
        result->error = buf;
        result->status = code != 0 ? code : -1;
        g_last_error = result->error;
        delete result;
        return 0;
    } catch (...) {
        result->error = "TetGen bilinmeyen exception";
        result->status = -1;
        g_last_error = result->error;
        delete result;
        return 0;
    }

    if (result->out.numberoftetrahedra <= 0) {
        g_last_error = "TetGen 0 tetrahedron üretti (yüzey kapalı mı?)";
        delete result;
        return 0;
    }

    return allocate_handle(result);
}

// Çıktı düğüm sayısı (her düğüm 3 double — x,y,z).
EMSCRIPTEN_KEEPALIVE
int tetgen_out_point_count(int handle) {
    TetgenResult* r = lookup(handle);
    return r ? r->out.numberofpoints : 0;
}

// Çıktı tet sayısı (her tet 4 int — düğüm indisleri, 0-based).
EMSCRIPTEN_KEEPALIVE
int tetgen_out_tet_count(int handle) {
    TetgenResult* r = lookup(handle);
    return r ? r->out.numberoftetrahedra : 0;
}

// Çıktı düğüm koordinatları (read-only pointer). Length = 3 * point_count.
// TetGen first_number 0 olduğunda 0-based indisleme; biz bunu varsayıyoruz.
EMSCRIPTEN_KEEPALIVE
double* tetgen_out_points(int handle) {
    TetgenResult* r = lookup(handle);
    if (!r) return nullptr;
    return reinterpret_cast<double*>(r->out.pointlist);
}

// Çıktı tet bağlantı listesi (read-only pointer). Length = 4 * tet_count.
// NOT: TetGen int* yerine int'i kullanır; pointer aynı.
EMSCRIPTEN_KEEPALIVE
int* tetgen_out_tets(int handle) {
    TetgenResult* r = lookup(handle);
    if (!r) return nullptr;
    return r->out.tetrahedronlist;
}

// Çıktı tet eleman düğüm sayısı (lineer = 4, quadratic = 10).
EMSCRIPTEN_KEEPALIVE
int tetgen_out_nodes_per_tet(int handle) {
    TetgenResult* r = lookup(handle);
    return r ? r->out.numberofcorners : 0;
}

// Hata mesajı (son tetgen_tetrahedralize çağrısı için).
EMSCRIPTEN_KEEPALIVE
const char* tetgen_last_error() {
    return g_last_error.c_str();
}

// Handle'ı serbest bırak. Tüm tetgenio buffer'larını dealloc eder.
EMSCRIPTEN_KEEPALIVE
void tetgen_free(int handle) {
    if (handle <= 0) return;
    size_t idx = static_cast<size_t>(handle - 1);
    if (idx >= g_results.size()) return;
    delete g_results[idx];
    g_results[idx] = nullptr;
}

}  // extern "C"
