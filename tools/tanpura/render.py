# Render the riyaz tanpura sample set from the physical model (tanpura.c).
# Grid: every odd MIDI note 25..71 (two semitones apart, so playback never shifts more than
# one semitone), two plucks each. Output: tanpura/p<midi>_<take>.mp3 + tanpura/samples.json
# Build and run: gcc -O3 -o tanpura tanpura.c -lm && python3 render.py ./tanpura ../../tanpura
# (needs numpy, scipy, soundfile and ffmpeg with libmp3lame)
import numpy as np, subprocess, json, os, sys, math, tempfile
from multiprocessing import Pool
from scipy.signal import resample_poly, butter, sosfilt, tf2sos
import soundfile as sf

BIN = sys.argv[1]; OUT = sys.argv[2]
SR = 32000; DUR = 9.5; B = 1.8e-5
os.makedirs(OUT, exist_ok=True)

def peaking(f, q, db, fs):
    A = 10 ** (db / 40); w = 2 * np.pi * f / fs; al = np.sin(w) / (2 * q)
    b = [1 + al * A, -2 * np.cos(w), 1 - al * A]; a = [1 + al / A, -2 * np.cos(w), 1 - al / A]
    return tf2sos(b, a)
def shelf_hi(f, db, fs):
    A = 10 ** (db / 40); w = 2 * np.pi * f / fs; al = np.sin(w) / 2 * np.sqrt(2)
    c = np.cos(w); sA = 2 * np.sqrt(A) * al
    b = [A * ((A + 1) + (A - 1) * c + sA), -2 * A * ((A - 1) + (A + 1) * c), A * ((A + 1) + (A - 1) * c - sA)]
    a = [(A + 1) - (A - 1) * c + sA, 2 * ((A - 1) - (A + 1) * c), (A + 1) - (A - 1) * c - sA]
    return tf2sos(b, a)
# The tanpura body: no deep bass (the gourd can't radiate it), a woody low-mid, the
# bridge force's built-in brightness tamed so the jawari shimmers instead of hissing.
BODY = np.vstack([butter(2, 150, 'hp', fs=SR, output='sos'), butter(1, 60, 'hp', fs=SR, output='sos'),
                  peaking(320, 1.2, 2.0, SR), peaking(1400, 0.9, 3.0, SR),
                  butter(1, 3500, 'lp', fs=SR, output='sos'), shelf_hi(5000, -3.0, SR),
                  butter(2, 11000, 'lp', fs=SR, output='sos')])

def hmin(f0, osr):
    k = 1 / (44100 * osr); c = 2 * f0; kap = math.sqrt(B) * c / math.pi; s1 = 3e-4
    ck2 = c * c * k * k + 4 * s1 * k
    return math.sqrt((ck2 + math.sqrt(ck2 * ck2 + 16 * kap * kap * k * k)) / 2)

def measure_hz(x, f0):
    # pitch from the first four harmonics of the settled tone (1.5-6 s), stiffness removed
    seg = x[int(1.5 * SR):int(6 * SR)]; seg = seg * np.hanning(len(seg))
    n = 1 << 21; S = np.abs(np.fft.rfft(seg, n)); fr = np.fft.rfftfreq(n, 1 / SR)
    est, wsum = 0.0, 0.0
    for k in range(1, 5):
        lo, hi = np.searchsorted(fr, [k * f0 * 0.98, k * f0 * 1.02])
        i = lo + int(np.argmax(S[lo:hi]))
        a, b, c = np.log(S[i - 1:i + 2] + 1e-12); den = a - 2 * b + c
        p = 0.5 * (a - c) / den if den < 0 else 0.0
        fk = (i + p) * SR / n / math.sqrt(1 + B * k * k)
        est += fk / k * S[i]; wsum += S[i]
    return est / wsum

def job(a):
    midi, take = a
    f0 = 440 * 2 ** ((midi - 69) / 12)
    rng = np.random.default_rng(midi * 10 + take)
    osr = next(o for o in range(2, 20) if 1.03 * hmin(f0, o) <= 2.4e-3)
    xp = 0.34 + 0.14 * rng.random()
    amp = (2.1 if f0 < 90 else 1.7 if f0 < 160 else 1.4) * (0.9 + 0.2 * rng.random())
    thread = 5.0 + 2.0 * rng.random()
    rsc = 2.0 if f0 < 90 else 1.0
    args = [BIN, f'{f0:.4f}', str(DUR), f'{xp:.3f}', f'{amp:.3f}', str(midi * 7 + take * 3 + 1),
            f'{thread:.2f}', '0.4', '1e9', '3e7', str(rsc), str(osr), '1', '0.35', '3e-4', str(B)]
    raw = subprocess.run(args, capture_output=True, check=True).stdout
    x = np.frombuffer(raw, dtype=np.float32).astype(float)
    x = resample_poly(x, 320, 441 * osr)
    x = sosfilt(BODY, x)
    x = x[:int(DUR * SR)]
    hz = measure_hz(x, f0)
    # loudness: RMS over the first 3 s to -20 dBFS; keep peaks under -1 dBFS
    rms = np.sqrt(np.mean(x[:3 * SR] ** 2)); x *= 10 ** (-20 / 20) / rms
    pk = np.max(np.abs(x)); gain = 1.0
    if pk > 0.89: gain = 0.89 / pk; x *= gain
    fade = int(1.5 * SR); x[-fade:] *= np.cos(np.linspace(0, np.pi / 2, fade)) ** 2
    name = f'p{midi}_{take}'
    wav = os.path.join(tempfile.gettempdir(), name + '.wav'); sf.write(wav, x, SR, subtype='PCM_16')
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', wav, '-c:a', 'libmp3lame', '-b:a', '80k',
                    os.path.join(OUT, name + '.mp3')], check=True)
    return {'file': name + '.mp3', 'midi': midi, 'hz': round(float(hz), 3),
            'cents': round(float(1200 * math.log2(hz / f0)), 1), 'level': round(float(gain), 3), 'dur': DUR}

if __name__ == '__main__':
    jobs = [(m, t) for m in range(25, 72, 2) for t in (0, 1)]
    with Pool(os.cpu_count()) as p: res = p.map(job, jobs)
    for r in res: print(r)
    json.dump(res, open(os.path.join(OUT, 'samples.json'), 'w'), indent=1)
