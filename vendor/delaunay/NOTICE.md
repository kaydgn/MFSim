# Delaunay Triangulation Bundle — Üçüncü Taraf Bildirimi

`delaunay-bundle.js` aşağıdaki MIT lisanslı npm paketlerini içerir
(esbuild ile bundle edilmiştir):

| Paket | Yazar | Lisans |
|---|---|---|
| delaunay-triangulate | Mikola Lysenko | MIT |
| incremental-convex-hull | Mikola Lysenko | MIT |
| uniq | Mikola Lysenko | MIT |
| robust-orientation | Mikola Lysenko | MIT |
| two-product, two-sum, robust-sum/subtract/scale | Mikola Lysenko | MIT |

Algoritma: Robust adaptive predicates (Shewchuk benzeri exact arithmetic
expansions) kullanan incremental Bowyer-Watson 3D Delaunay. Floating-point
dejenere durumlara (coplanar/cocircular noktalar) dayanıklı.

Tam lisans metni: `LICENSE-delaunay-triangulate.txt`

Yeniden bundle etmek için: `npm run vendor:sync`
