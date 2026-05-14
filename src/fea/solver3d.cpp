// ============================================================================
// MFSim FEA — 3D Lineer Elastik Çözücü
// ============================================================================
// Mevcut JS mesh boru hattının (js/fea-mesh.js) ürettiği 3D katı eleman
// mesh'lerini Eigen sparse çözücüsü ile çözer.
//
// Şu an desteklenen elemanlar:
//   tet4 — sabit gerinme tetrahedronu (4 düğüm × 3 DOF = 12 DOF/eleman)
//   hex8 — izoparametrik hex (8 düğüm × 3 DOF = 24 DOF/eleman, 2×2×2 Gauss)
//
// Eklemek için (gelecek faz):
//   tet10, hex20, wedge6, wedge15 — quadratic varyantlar
//   tri3 shell — plaka eğilmesi (farklı formülasyon)
//
// Algoritma:
//   1. Her eleman için lokal K_e = ∫ B^T D B dV → 2×2×2 Gauss (hex8) veya
//      sabit B (tet4)
//   2. Global K (CSR sparse) — Eigen::Triplet listesi → setFromTriplets
//   3. Dirichlet sınır koşulları (penalty yöntemi, çok büyük diagonal eki)
//   4. Eigen::SimplicialLDLT (SPD sparse çözücü)
//   5. Geri yer değiştirme alanı u (numNodes × 3)
//
// Çağrı sözleşmesi: solve_linear_elastic_3d  (bkz. aşağıda extern "C")
// ============================================================================

#include <emscripten/emscripten.h>
#include <Eigen/Sparse>
#include <Eigen/Dense>
#include <vector>
#include <cstring>
#include <cmath>

namespace mfsim {

using Vec3 = Eigen::Matrix<double, 3, 1>;
using Mat6 = Eigen::Matrix<double, 6, 6>;

enum ElementType {
    ELEM_TET4 = 0,
    ELEM_HEX8 = 1
};

// İzotropik lineer elastik malzeme. D matrisi (6×6) Voigt notasyonunda:
// {σ} = D {ε}  with σ = [σx σy σz τxy τyz τzx], ε = [εx εy εz γxy γyz γzx]
struct Material {
    double E;
    double nu;

    Mat6 stiffness() const {
        Mat6 D = Mat6::Zero();
        const double lambda = E * nu / ((1.0 + nu) * (1.0 - 2.0 * nu));
        const double mu     = E / (2.0 * (1.0 + nu));
        const double a      = lambda + 2.0 * mu;
        D(0,0) = a;  D(1,1) = a;  D(2,2) = a;
        D(0,1) = lambda; D(0,2) = lambda;
        D(1,0) = lambda; D(1,2) = lambda;
        D(2,0) = lambda; D(2,1) = lambda;
        D(3,3) = mu; D(4,4) = mu; D(5,5) = mu;
        return D;
    }
};

// ─── tet4 (sabit gerinme tetrahedronu) ──────────────────────────────────────
// Şekil fonksiyonları lineer: N_i = a_i + b_i*x + c_i*y + d_i*z
// Katsayılar [1 x_i y_i z_i] matrisinin tersinden gelir.
// B matrisi sabit; V = (1/6) |det(M)|.
static double tet4_B(const Vec3& p0, const Vec3& p1, const Vec3& p2, const Vec3& p3,
                     Eigen::Matrix<double, 6, 12>& B) {
    Eigen::Matrix4d M;
    M << 1.0, p0(0), p0(1), p0(2),
         1.0, p1(0), p1(1), p1(2),
         1.0, p2(0), p2(1), p2(2),
         1.0, p3(0), p3(1), p3(2);

    const double det6V = M.determinant();
    const double V     = std::abs(det6V) / 6.0;
    if (V < 1e-20) return 0.0;

    const Eigen::Matrix4d Minv = M.inverse();
    // Minv(0, i) = a_i, Minv(1, i) = b_i, Minv(2, i) = c_i, Minv(3, i) = d_i
    B.setZero();
    for (int i = 0; i < 4; ++i) {
        const double bi = Minv(1, i);
        const double ci = Minv(2, i);
        const double di = Minv(3, i);
        const int col = i * 3;
        B(0, col + 0) = bi;
        B(1, col + 1) = ci;
        B(2, col + 2) = di;
        B(3, col + 0) = ci; B(3, col + 1) = bi;
        B(4, col + 1) = di; B(4, col + 2) = ci;
        B(5, col + 0) = di; B(5, col + 2) = bi;
    }
    return V;
}

// ─── hex8 (izoparametrik 8-düğümlü hex) ─────────────────────────────────────
// Düğüm sıralaması: ANSYS/Abaqus standardı.
//   Alt yüz (ζ=-1):  0=(-,-,-), 1=(+,-,-), 2=(+,+,-), 3=(-,+,-)
//   Üst yüz (ζ=+1):  4=(-,-,+), 5=(+,-,+), 6=(+,+,+), 7=(-,+,+)
static const int HEX_NODES[8][3] = {
    {-1,-1,-1}, { 1,-1,-1}, { 1, 1,-1}, {-1, 1,-1},
    {-1,-1, 1}, { 1,-1, 1}, { 1, 1, 1}, {-1, 1, 1}
};
static const double GAUSS_PT = 0.5773502691896258;  // 1/sqrt(3)

struct HexShape {
    double dN[8][3];  // dN_i/dξ, dN_i/dη, dN_i/dζ
};

static void hex8_shape_derivs(double xi, double eta, double zeta, HexShape& sh) {
    for (int i = 0; i < 8; ++i) {
        const double xi_i   = HEX_NODES[i][0];
        const double eta_i  = HEX_NODES[i][1];
        const double zeta_i = HEX_NODES[i][2];
        const double a = 1.0 + xi_i * xi;
        const double b = 1.0 + eta_i * eta;
        const double c = 1.0 + zeta_i * zeta;
        sh.dN[i][0] = 0.125 * xi_i  * b * c;
        sh.dN[i][1] = 0.125 * a * eta_i  * c;
        sh.dN[i][2] = 0.125 * a * b * zeta_i;
    }
}

// hex8 için tek bir Gauss noktasında B matrisi + det(J) döner.
static double hex8_B_at(const Vec3 p[8], double xi, double eta, double zeta,
                       Eigen::Matrix<double, 6, 24>& B) {
    HexShape sh;
    hex8_shape_derivs(xi, eta, zeta, sh);

    Eigen::Matrix3d J = Eigen::Matrix3d::Zero();
    for (int k = 0; k < 8; ++k)
        for (int i = 0; i < 3; ++i)
            for (int j = 0; j < 3; ++j)
                J(i, j) += sh.dN[k][i] * p[k](j);

    const double detJ = J.determinant();
    if (detJ <= 0.0) return 0.0;

    const Eigen::Matrix3d Jinv = J.inverse();
    B.setZero();
    for (int k = 0; k < 8; ++k) {
        const double dNdx = Jinv(0,0)*sh.dN[k][0] + Jinv(0,1)*sh.dN[k][1] + Jinv(0,2)*sh.dN[k][2];
        const double dNdy = Jinv(1,0)*sh.dN[k][0] + Jinv(1,1)*sh.dN[k][1] + Jinv(1,2)*sh.dN[k][2];
        const double dNdz = Jinv(2,0)*sh.dN[k][0] + Jinv(2,1)*sh.dN[k][1] + Jinv(2,2)*sh.dN[k][2];
        const int col = k * 3;
        B(0, col + 0) = dNdx;
        B(1, col + 1) = dNdy;
        B(2, col + 2) = dNdz;
        B(3, col + 0) = dNdy; B(3, col + 1) = dNdx;
        B(4, col + 1) = dNdz; B(4, col + 2) = dNdy;
        B(5, col + 0) = dNdz; B(5, col + 2) = dNdx;
    }
    return detJ;
}

}  // namespace mfsim

// ─── C bağlamaları ──────────────────────────────────────────────────────────

extern "C" {

// Lineer elastik 3D katı çözücü.
//
// Giriş:
//   element_type    : 0=tet4, 1=hex8
//   num_nodes       : düğüm sayısı (N)
//   num_elements    : eleman sayısı (M)
//   node_coords     : N*3 double (x0,y0,z0, x1,y1,z1, ...)
//   element_conn    : M*nodesPerElem int (eleman başına düğüm indisleri)
//   E, nu           : Young modülü (Pa), Poisson oranı
//   num_fixed       : sabit düğüm sayısı
//   fixed_indices   : num_fixed int (sabitlenen düğümler; her birinin 3 DOF'u)
//   num_loaded      : yüklenen düğüm sayısı
//   loaded_indices  : num_loaded int (yük uygulanan düğümler)
//   nodal_loads     : num_loaded*3 double (her düğüm için fx,fy,fz)
//   u_out           : N*3 double (önceden tahsis edilmiş çıkış buffer'ı)
//
// Dönüş: 0 başarılı, < 0 hata
//   -1 geçersiz parametre
//   -3 desteklenmeyen eleman tipi
//   -4 dejenere eleman (negatif veya sıfır hacim)
//   -5 sparse decomposition başarısız
//   -6 sparse solve başarısız
EMSCRIPTEN_KEEPALIVE
int solve_linear_elastic_3d(
    int element_type,
    int num_nodes,
    int num_elements,
    const double* node_coords,
    const int* element_conn,
    double E, double nu,
    int num_fixed,
    const int* fixed_indices,
    int num_loaded,
    const int* loaded_indices,
    const double* nodal_loads,
    double* u_out
) {
    using namespace mfsim;
    using Eigen::SparseMatrix;
    using Eigen::VectorXd;
    using Eigen::Triplet;

    if (num_nodes <= 0 || num_elements <= 0 ||
        !node_coords || !element_conn || !u_out) return -1;
    if (!(E > 0.0) || nu <= -1.0 || nu >= 0.5) return -1;

    int nodes_per_elem;
    switch (element_type) {
        case ELEM_TET4: nodes_per_elem = 4; break;
        case ELEM_HEX8: nodes_per_elem = 8; break;
        default: return -3;
    }

    const int ndof = num_nodes * 3;
    const Material mat{ E, nu };
    const Mat6 D = mat.stiffness();

    std::vector<Triplet<double>> triplets;
    triplets.reserve(static_cast<size_t>(num_elements) * nodes_per_elem * nodes_per_elem * 9);

    if (element_type == ELEM_TET4) {
        Eigen::Matrix<double, 6, 12> B;
        for (int e = 0; e < num_elements; ++e) {
            int n[4];
            Vec3 p[4];
            for (int i = 0; i < 4; ++i) {
                n[i] = element_conn[e * 4 + i];
                if (n[i] < 0 || n[i] >= num_nodes) return -1;
                p[i] = Vec3(node_coords[n[i]*3 + 0],
                            node_coords[n[i]*3 + 1],
                            node_coords[n[i]*3 + 2]);
            }
            const double V = tet4_B(p[0], p[1], p[2], p[3], B);
            if (V <= 0.0) return -4;
            const Eigen::Matrix<double, 12, 12> Ke = V * B.transpose() * D * B;
            for (int i = 0; i < 4; ++i)
                for (int j = 0; j < 4; ++j)
                    for (int di = 0; di < 3; ++di)
                        for (int dj = 0; dj < 3; ++dj) {
                            const double val = Ke(i*3 + di, j*3 + dj);
                            if (val != 0.0)
                                triplets.emplace_back(n[i]*3 + di, n[j]*3 + dj, val);
                        }
        }
    } else if (element_type == ELEM_HEX8) {
        Eigen::Matrix<double, 6, 24> B;
        Vec3 p[8];
        const double gp[2] = { -GAUSS_PT, GAUSS_PT };
        for (int e = 0; e < num_elements; ++e) {
            int n[8];
            for (int i = 0; i < 8; ++i) {
                n[i] = element_conn[e * 8 + i];
                if (n[i] < 0 || n[i] >= num_nodes) return -1;
                p[i] = Vec3(node_coords[n[i]*3 + 0],
                            node_coords[n[i]*3 + 1],
                            node_coords[n[i]*3 + 2]);
            }
            Eigen::Matrix<double, 24, 24> Ke = Eigen::Matrix<double, 24, 24>::Zero();
            for (int gi = 0; gi < 2; ++gi)
                for (int gj = 0; gj < 2; ++gj)
                    for (int gk = 0; gk < 2; ++gk) {
                        const double detJ = hex8_B_at(p, gp[gi], gp[gj], gp[gk], B);
                        if (detJ <= 0.0) return -4;
                        Ke += detJ * (B.transpose() * D * B);  // Gauss ağırlığı 1
                    }
            for (int i = 0; i < 8; ++i)
                for (int j = 0; j < 8; ++j)
                    for (int di = 0; di < 3; ++di)
                        for (int dj = 0; dj < 3; ++dj) {
                            const double val = Ke(i*3 + di, j*3 + dj);
                            if (val != 0.0)
                                triplets.emplace_back(n[i]*3 + di, n[j]*3 + dj, val);
                        }
        }
    }

    SparseMatrix<double> K(ndof, ndof);
    K.setFromTriplets(triplets.begin(), triplets.end());

    VectorXd F = VectorXd::Zero(ndof);
    for (int l = 0; l < num_loaded; ++l) {
        const int idx = loaded_indices[l];
        if (idx < 0 || idx >= num_nodes) return -1;
        F(idx*3 + 0) += nodal_loads[l*3 + 0];
        F(idx*3 + 1) += nodal_loads[l*3 + 1];
        F(idx*3 + 2) += nodal_loads[l*3 + 2];
    }

    // Dirichlet (penalty yöntemi) — sabit düğümün 3 DOF'unun diagonalini
    // çok büyük yap, F'i sıfırla. Basit ve simetriyi korur.
    const double PENALTY = 1.0e30;
    for (int f = 0; f < num_fixed; ++f) {
        const int idx = fixed_indices[f];
        if (idx < 0 || idx >= num_nodes) return -1;
        for (int d = 0; d < 3; ++d) {
            const int gi = idx*3 + d;
            K.coeffRef(gi, gi) += PENALTY;
            F(gi) = 0.0;
        }
    }

    Eigen::SimplicialLDLT<SparseMatrix<double>> solver;
    solver.compute(K);
    if (solver.info() != Eigen::Success) return -5;
    VectorXd u = solver.solve(F);
    if (solver.info() != Eigen::Success) return -6;

    std::memcpy(u_out, u.data(), sizeof(double) * ndof);
    return 0;
}

EMSCRIPTEN_KEEPALIVE
int solve_linear_elastic_3d_nodes_per_element(int element_type) {
    switch (element_type) {
        case mfsim::ELEM_TET4: return 4;
        case mfsim::ELEM_HEX8: return 8;
        default: return -1;
    }
}

}  // extern "C"
