// Tanpura string with jawari: finite-difference stiff string (two polarisations) whose
// vertical motion meets a curved bridge and a cotton thread (one-sided penalty contact,
// solved implicitly per node so it stays stable). Output: force the string puts into the
// bridge, at the simulation rate, as float32 on stdout.
// usage: tanpura f0 dur pluckpos amp_mm seed [thread_mm psi kc_bridge kc_thread rho_scale osr cmode s0 s1 B]
#include <stdio.h>
#include <stdlib.h>
#include <math.h>
#include <string.h>

static double urand(unsigned *s) { *s = *s * 1664525u + 1013904223u; return (*s >> 8) / 16777216.0; }

int main(int argc, char **argv) {
  double f0 = atof(argv[1]), dur = atof(argv[2]), xp = atof(argv[3]), amp = atof(argv[4]) * 1e-3;
  unsigned seed = (unsigned)atoi(argv[5]);
  double thread_mm = argc > 6 ? atof(argv[6]) : 6.0;   // thread distance from bridge back edge
  double psi = argc > 7 ? atof(argv[7]) : 0.4;          // bridge curvature: b(x) = -psi x^2
  double kcb = argc > 8 ? atof(argv[8]) : 1e9;          // bridge contact stiffness (N/m^2)
  double kct = argc > 9 ? atof(argv[9]) : 3e7;          // thread contact stiffness (N/m^2 over one node)
  double rsc = argc > 10 ? atof(argv[10]) : 1.0;        // string gauge scale (heavier for kharaj)
  int osr = argc > 11 ? atoi(argv[11]) : 4;
  int cmode = argc > 12 ? atoi(argv[12]) : 1;
  double body = 0; (void)body;
  double fs = 44100.0 * osr, k = 1.0 / fs, L = 1.0;
  double rad = 1.5e-4 * sqrt(rsc), rho = 7850, E = 2.0e11;     // steel; rsc > 1 = thicker string
  double A = M_PI * rad * rad, rA = rho * A, I = M_PI * pow(rad, 4) / 4;
  double c = 2 * L * f0, T = c * c * rA, kap = sqrt(E * I / rA);
  if (argc > 15) kap = sqrt(atof(argv[15])) * c * L / M_PI; // set by inharmonicity B instead
  double s0 = argc > 13 ? atof(argv[13]) : 0.35, s1 = argc > 14 ? atof(argv[14]) : 3.0e-4;
  double ck2 = c * c * k * k + 4 * s1 * k;
  double hmin = sqrt((ck2 + sqrt(ck2 * ck2 + 16 * kap * kap * k * k)) / 2);
  int N = (int)floor(L / (1.03 * hmin)); // margin: the horizontal polarisation is tuned a hair higher
  double h = L / N;
  double lam2 = c * c * k * k / (h * h), mu2 = kap * kap * k * k / (h * h * h * h), s1t = 2 * s1 * k / (h * h);
  fprintf(stderr, "N=%d h=%.2fmm T=%.1fN kappa=%.3f lam2=%.3f mu2=%.4f\n", N, h * 1e3, T, kap, lam2, mu2);
  // polarisation arrays: v = vertical (touches bridge), w = horizontal (free, tuned a hair apart)
  double *v0 = calloc(N + 3, 8), *v1 = calloc(N + 3, 8), *v2 = calloc(N + 3, 8);
  double *w0 = calloc(N + 3, 8), *w1 = calloc(N + 3, 8), *w2 = calloc(N + 3, 8);
  double *bar = calloc(N + 3, 8), *kc = calloc(N + 3, 8), *d2a = calloc(N + 3, 8), *d2b = calloc(N + 3, 8);
  // index i = node i (0..N), arrays offset by 1 for ghost nodes
  #define V(a, i) a[(i) + 1]
  int it = (int)lround(thread_mm * 1e-3 / h); if (it < 1) it = 1;
  int nb = (int)ceil(0.03 / h); // bridge surface under first 3 cm
  for (int i = 0; i <= N; i++) { V(bar, i) = -1e9; V(kc, i) = 0; }
  for (int i = 1; i <= nb; i++) { double x = i * h; V(bar, i) = -psi * x * x; V(kc, i) = kcb; }
  V(bar, it) = 0.0; V(kc, it) = kct; // thread holds the string up at its resting line
  // pluck: rounded triangle (finger pad ~1.5 cm), vertical and horizontal components
  double ang = (0.35 + 0.3 * urand(&seed)) * M_PI / 2; // mostly sideways pluck, some vertical
  double av = amp * sin(ang), aw = amp * cos(ang);
  double xpp = xp * L, wdt = 0.015;
  for (int i = 1; i < N; i++) {
    double x = i * h, tri = x < xpp ? x / xpp : (L - x) / (L - xpp);
    double r = fabs(x - xpp) / wdt; if (r < 1) tri -= (1 - r) * (1 - r) * wdt / (4 * xpp); // round the tip
    V(v1, i) = V(v0, i) = av * tri; V(w1, i) = V(w0, i) = aw * tri;
  }
  // horizontal polarisation: slightly different effective tension (no thread/bridge)
  double lam2w = lam2 * pow(1.0 + (urand(&seed) - 0.3) * 0.0012, 2);
  long M = (long)(dur * fs);
  float *out = malloc(M * sizeof(float));
  double norm = 1.0 / (1 + s0 * k);
  for (long n = 0; n < M; n++) {
    // ghost nodes for simply supported ends: u[-1] = -u[1], u[N+1] = -u[N-1]
    V(v1, -1) = -V(v1, 1); V(v1, N + 1) = -V(v1, N - 1); V(w1, -1) = -V(w1, 1); V(w1, N + 1) = -V(w1, N - 1);
    for (int i = 0; i <= N; i++) V(d2a, i) = (i == 0 || i == N) ? 0 : V(v1, i + 1) - 2 * V(v1, i) + V(v1, i - 1);
    double fb = 0;
    for (int i = 1; i < N; i++) {
      double d2 = V(d2a, i), d4 = V(d2a, i + 1) - 2 * d2 + V(d2a, i - 1);
      double d2p = V(v0, i + 1) - 2 * V(v0, i) + V(v0, i - 1);
      double u = (2 * V(v1, i) - (1 - s0 * k) * V(v0, i) + lam2 * d2 - mu2 * d4 + s1t * (d2 - d2p)) * norm;
      double b = V(bar, i);
      if (cmode == 0 && u < b) { // contact: implicit linear penalty, force at the new time step
        double be = k * k * V(kc, i) / rA * norm;
        double un = (u + be * b) / (1 + be);
        fb += V(kc, i) * (b - un) * h;
        u = un;
      } else if (cmode == 1 && u + V(v0, i) < 2 * b) { // energy-conserving: force on the mean of n+1, n-1
        double be = k * k * V(kc, i) / rA * norm;
        double un = (u + be * (b - 0.5 * V(v0, i))) / (1 + 0.5 * be);
        fb += V(kc, i) * (b - 0.5 * (un + V(v0, i))) * h;
        u = un;
      }
      V(v2, i) = u;
    }
    for (int i = 0; i <= N; i++) V(d2b, i) = (i == 0 || i == N) ? 0 : V(w1, i + 1) - 2 * V(w1, i) + V(w1, i - 1);
    for (int i = 1; i < N; i++) {
      double d2 = V(d2b, i), d4 = V(d2b, i + 1) - 2 * d2 + V(d2b, i - 1);
      double d2p = V(w0, i + 1) - 2 * V(w0, i) + V(w0, i - 1);
      V(w2, i) = (2 * V(w1, i) - (1 - s0 * k) * V(w0, i) + lam2w * d2 - mu2 * d4 + s1t * (d2 - d2p)) * norm;
    }
    // bridge force: tension pull at the back edge + contact forces (vertical); horizontal at a lower gain
    double Fv = T * V(v2, 1) / h + fb;
    double Fw = T * V(w2, 1) / h;
    out[n] = (float)(Fv + 0.35 * Fw);
    double *t = v0; v0 = v1; v1 = v2; v2 = t; t = w0; w0 = w1; w1 = w2; w2 = t;
  }
  fwrite(out, sizeof(float), M, stdout);
  return 0;
}
