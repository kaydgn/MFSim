// ============================================================================
// MFSim FEA — 1D Bar Element Prototype
// ============================================================================
// Tek eksenli çubuk elemanı için lineer elastik FEA çözücüsü.
//
// Problem:
//   Uzunluk L, kesit alanı A, Young modülü E olan bir çubuk N adet eşit
//   elemana bölünür. Sol uç sabit (u_0 = 0), sağ uca eksenel F kuvveti
//   uygulanır. Düğüm yer değiştirmeleri u_0..u_N hesaplanır.
//
// Yöntem:
//   Eleman rijitliği:  K_e = (E*A / L_e) * [[ 1, -1], [-1, 1]]
//   Global K (N+1) x (N+1) tridiagonal. Dirichlet u_0 = 0 → bilinmeyen
//   sistem N x N tridiagonal → Thomas algoritması O(N).
//
// Analitik çözüm (doğrulama için):
//   u(x) = F * x / (E * A)   →   u_i = F * (i*L/N) / (E*A)
//
// WebAssembly bağlama:
//   solve_bar_1d  → düğüm yer değiştirmelerini hesaplar
//   mfsim_fea_version → sürüm dizgisi döner
// ============================================================================

#include <emscripten/emscripten.h>
#include <cstdlib>

extern "C" {

EMSCRIPTEN_KEEPALIVE
int solve_bar_1d(int N, double E, double A, double L, double F, double* u_out) {
    if (N <= 0 || E <= 0.0 || A <= 0.0 || L <= 0.0 || u_out == 0) {
        return -1;
    }

    const double Le = L / static_cast<double>(N);
    const double k  = E * A / Le;   // her elemanın eksenel rijitliği

    // Bilinmeyen sistem boyutu n = N (düğüm 1..N; u_0 sabit)
    // Tridiagonal: a[i] = alt köşegen, b[i] = ana köşegen, c[i] = üst köşegen
    const int n = N;
    double* a = static_cast<double*>(std::malloc(n * sizeof(double)));
    double* b = static_cast<double*>(std::malloc(n * sizeof(double)));
    double* c = static_cast<double*>(std::malloc(n * sizeof(double)));
    double* d = static_cast<double*>(std::malloc(n * sizeof(double)));
    if (!a || !b || !c || !d) {
        std::free(a); std::free(b); std::free(c); std::free(d);
        return -2;
    }

    // K matrisini doldur. İç düğümlerde K_ii = 2k, son düğümde K_NN = k.
    // Üst/alt köşegen sabit -k.
    for (int i = 0; i < n; ++i) {
        b[i] = (i == n - 1) ? k : 2.0 * k;
        a[i] = (i == 0)     ? 0.0 : -k;
        c[i] = (i == n - 1) ? 0.0 : -k;
        d[i] = 0.0;
    }
    d[n - 1] = F;  // dış yük yalnızca sağ uçta

    // Thomas algoritması — ileri eleme
    for (int i = 1; i < n; ++i) {
        const double m = a[i] / b[i - 1];
        b[i] -= m * c[i - 1];
        d[i] -= m * d[i - 1];
    }

    // Geri yerine koyma
    u_out[0] = 0.0;                      // Dirichlet BC
    u_out[N] = d[n - 1] / b[n - 1];      // son düğüm
    for (int i = n - 2; i >= 0; --i) {
        u_out[i + 1] = (d[i] - c[i] * u_out[i + 2]) / b[i];
    }

    std::free(a); std::free(b); std::free(c); std::free(d);
    return 0;
}

EMSCRIPTEN_KEEPALIVE
const char* mfsim_fea_version(void) {
    return "0.1.0-prototype";
}

}  // extern "C"
