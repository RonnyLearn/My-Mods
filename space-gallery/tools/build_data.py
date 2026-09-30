#!/usr/bin/env python3
# Сборка данных для галереи: lib/data/hyg.js и lib/data/starmap.js (data URI внутри .js, чтобы работало с file://).
#
#   python3 tools/build_data.py --hyg hygdata_v41.csv                       # звёзды + синтетическая карта Млечного Пути
#   python3 tools/build_data.py --hyg hygdata_v41.csv --nasa starmap_2020_8k_gal.jpg   # реальная карта NASA SVS (Gaia)
#
# HYG v4.1: https://github.com/astronexus/HYG-Database (hyg/CURRENT/hygdata_v41.csv)
# NASA SVS Deep Star Maps 2020: https://svs.gsfc.nasa.gov/4851 (галактические координаты, l=0 в центре, l растёт влево).
# Зависимости: numpy, pillow.
import argparse, base64, csv, io, math, os, struct, sys
import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W, H = 6144, 3072  # основная карта; мипы 1536x768 и 384x192

# --- экваториальные J2000 -> галактические (IAU) ---
EQ2GAL = np.array([[-0.0548755604, -0.8734370902, -0.4838350155],
                   [+0.4941094279, -0.4448296300, +0.7469822445],
                   [-0.8676661490, -0.1980763734, +0.4559837762]])


def build_hyg(path, maglim=10.0):
    rows = []
    for r in csv.DictReader(open(path, newline='')):
        try:
            if r['id'] == '0': continue  # Солнце
            m = float(r['mag'])
            if m > maglim: continue
            ra = float(r['ra']) * 15.0; de = float(r['dec'])
            bv = float(r['ci']) if r['ci'] not in ('', None) else 0.65
        except ValueError:
            continue
        rows.append((ra, de, m, bv))
    a = np.array(rows, dtype=np.float64)
    ra, de = np.radians(a[:, 0]), np.radians(a[:, 1])
    v = np.stack([np.cos(de) * np.cos(ra), np.cos(de) * np.sin(ra), np.sin(de)])
    g = EQ2GAL @ v
    l = np.degrees(np.arctan2(g[1], g[0])) % 360.0
    b = np.degrees(np.arcsin(np.clip(g[2], -1, 1)))
    order = np.argsort(a[:, 2])  # яркие первыми
    buf = bytearray()
    for i in order:
        lq = int(round(l[i] / 360.0 * 65536)) % 65536
        bq = int(round((b[i] + 90.0) / 180.0 * 65535))
        mq = int(np.clip(round((a[i, 2] + 1.5) / 0.05), 0, 254))
        cq = int(np.clip(round((a[i, 3] + 0.5) / 3.0 * 255), 0, 255))
        buf += struct.pack('<HHBB', lq, bq, mq, cq)
    js = ('// HYG v4.1 (astronexus), %d звёзд до 10m. Формат: на звезду 6 байт LE: l(u16, 360/65536), '
          'b(u16, (b+90)/180*65535), mag=(u8*0.05-1.5), B-V=(u8/255*3-0.5). Отсортировано по яркости.\n'
          'window.SV=window.SV||{};SV.data=SV.data||{};SV.data.hyg={n:%d,b64:"%s"};\n'
          % (len(order), len(order), base64.b64encode(bytes(buf)).decode()))
    open(os.path.join(ROOT, 'lib/data/hyg.js'), 'w').write(js)
    print('hyg.js: %d stars, %.0f KB' % (len(order), len(js) / 1024))


# ---------------- синтетическая карта (если нет файла NASA) ----------------
def wrapd(x): return (x + 180.0) % 360.0 - 180.0


def fnoise(h, w, beta, sx=1.0, sy=1.0, seed=0, kmin=0.0):
    """Периодический по долготе шум со степенным спектром (FFT). Нормирован: среднее 0, СКО 1."""
    rng = np.random.default_rng(seed)
    ky = np.fft.fftfreq(h)[:, None] * h
    kx = np.fft.rfftfreq(w)[None, :] * w
    k = np.sqrt((kx * sx) ** 2 + (ky * sy) ** 2)
    amp = np.where(k > kmin, (k + 1e-6) ** (-beta / 2.0), 0.0).astype(np.float32)
    spec = (rng.standard_normal(amp.shape) + 1j * rng.standard_normal(amp.shape)).astype(np.complex64) * amp
    n = np.fft.irfft2(spec, s=(h, w)).astype(np.float32)
    n -= n.mean(); n /= n.std() + 1e-9
    return n


def up(a, w, h):
    return np.asarray(Image.fromarray(a.astype(np.float32), 'F').resize((w, h), Image.BILINEAR))


def synth_map():
    print('synthesizing Milky Way map %dx%d ...' % (W, H))
    hw, hh = W // 2, H // 2
    # шумы на половинном разрешении (0.117°/px), затем бикубически вверх
    lanes = fnoise(hh, hw, 3.1, sx=2.4, seed=1)          # вытянутые вдоль плоскости пылевые прожилки
    clump = fnoise(hh, hw, 3.4, sx=1.3, seed=2)          # комковатость пыли
    big = fnoise(hh, hw, 4.2, sx=1.0, seed=3)            # крупные вариации
    fil = fnoise(hh, hw, 2.7, sx=1.8, seed=4)            # тонкие волокна
    ridged = (1.0 - np.abs(np.tanh(fil * 0.9))) ** 4      # гребни -> тонкие тёмные нити
    lanes, clump, big, ridged = [up(x, W, H) for x in (lanes, clump, big, ridged)]
    grain = fnoise(H, W, 1.6, seed=5)                    # мелкая «звёздная» зернистость
    u = (np.arange(W, dtype=np.float32) + 0.5) / W
    v = (np.arange(H, dtype=np.float32) + 0.5) / H
    L = (180.0 - u * 360.0)[None, :].repeat(H, 0)        # l растёт влево, центр = 0
    B = (90.0 - v * 180.0)[:, None].repeat(W, 1)

    def g2(l0, b0, sl, sb, p=1.0):
        dl = wrapd(L - l0)
        return np.exp(-0.5 * ((dl / sl) ** 2 + ((B - b0) / sb) ** 2) ** p)

    aL = np.abs(L)
    mott = fnoise(hh, hw, 2.6, sx=1.6, seed=6)           # звёздные облака: пятнистость на масштабах 0.3-3°
    mott = up(mott, W, H)
    b0 = 1.6 * np.exp(-(wrapd(L - 100) / 45) ** 2) - 1.4 * np.exp(-(wrapd(L + 105) / 40) ** 2)  # варп диска
    hgt = 2.4 + 2.6 * np.exp(-(L / 40) ** 2) + 0.5 * big
    amp = 0.16 + 0.55 * np.exp(-(L / 62) ** 2) + 0.08 * np.exp(-(wrapd(L - 75) / 30) ** 2) + 0.05 * np.exp(-(wrapd(L + 65) / 30) ** 2)
    zb = np.abs(B - b0)
    disk = amp * (np.exp(-zb / hgt) + 0.28 * np.exp(-zb / (hgt * 3.2)))
    bulge = 0.95 * np.exp(-(((L / 9.5) ** 2 + (B / 6.5) ** 2) ** 0.62)) + 0.30 * np.exp(-((L / 22) ** 2 + (B / 13) ** 2))
    clouds = (0.50 * g2(2, -3.2, 5.5, 2.8) + 0.28 * g2(12, -1.0, 2.2, 1.2) + 0.40 * g2(27, -2.0, 4.0, 1.8)
              + 0.30 * g2(76, 1.5, 7.0, 2.2) + 0.30 * g2(-73, -0.8, 6.0, 1.6) + 0.24 * g2(-31, -1.0, 4.0, 1.5)
              + 0.22 * g2(-50, 0.5, 5.0, 1.8) + 0.12 * g2(125, -1, 7, 2) + 0.12 * g2(-20, 1, 4, 1.6))
    lum = (disk + bulge + clouds) * np.exp(0.45 * mott * np.exp(-zb / 12) + 0.10 * big) * (1.0 + 0.07 * grain)
    lum += 0.0035 * (1 + 0.3 * big)                      # фон неба (слабые звёзды, зодиак.)
    # --- пыль: логнормальные клочья вокруг плоскости + Большой Разрыв + тонкие нити ---
    bd = 0.4 + 1.6 * np.exp(-(wrapd(L - 25) / 35) ** 2) + 0.7 * lanes
    wd = 1.6 + 2.2 * np.exp(-(wrapd(L - 30) / 40) ** 2)
    env = np.exp(-np.abs(B - bd) / wd) + 0.35 * np.exp(-np.abs(B - b0) / 7.0)
    tauA = 0.45 + 1.9 * np.exp(-(L / 65) ** 2) + 1.2 * np.exp(-(wrapd(L - 75) / 16) ** 2) + 0.5 * np.exp(-(wrapd(L + 60) / 25) ** 2)
    tau = env * tauA * np.exp(1.35 * clump + 0.6 * lanes - 0.9) + 0.9 * env * tauA * ridged
    dark = [(-3.0, 5.0, 1.2, 3.8, 1.8), (-1.0, 3.0, 1.2, 1.6, 1.0), (-59, -0.8, 2.4, 3.0, 2.0),
            (-6.5, 15.5, 3.0, 1.8, 1.6), (-4, 21, 5, 2.0, 0.9), (172, -15, 7, 3.5, 1.0),
            (-22, 16, 5, 3, 0.7), (-63, -16, 4, 3, 0.8), (0.5, -18.5, 1.5, 1.0, 1.0), (80, 2, 5, 2, 0.8)]
    for l0, bb, sl, sb, t in dark:
        tau += t * g2(l0, bb, sl, sb) * np.exp(0.7 * clump)
    tau += 0.12 * np.exp(0.9 * big) * np.exp(-np.abs(B) / 25) * (0.4 + ridged)  # высокоширотные «перистые»
    # --- цвет ---
    wB = np.clip(bulge / (bulge + disk + 1e-6), 0, 1)[..., None]
    outer = np.clip((aL - 70) / 90, 0, 1)[..., None]
    col = (1 - wB) * np.array([0.96, 0.92, 0.84]) + wB * np.array([1.0, 0.80, 0.56])
    col = col * (1 - outer * 0.35) + outer * 0.35 * np.array([0.82, 0.88, 1.0])
    red = np.array([0.52, 0.72, 1.0], dtype=np.float32)
    img = lum[..., None] * col * np.exp(-tau[..., None] * red)
    img += (lum * (1 - np.exp(-tau)) * 0.04)[..., None] * np.array([0.9, 0.6, 0.35])  # рассеянный свет в пыли
    return img.astype(np.float32)


def load_nasa(path):
    print('loading NASA map', path)
    im = Image.open(path).convert('RGB')
    im = im.filter(ImageFilter.MedianFilter(3))  # убрать точечные звёзды (их рисует каталог HYG)
    im = im.resize((W, H), Image.LANCZOS)
    a = np.asarray(im).astype(np.float32) / 255.0
    return a ** 2.2  # в линейное


def enc(img_lin, q):
    a = np.clip(img_lin, 0, 1) ** (1 / 2.2)
    im = Image.fromarray((a * 255 + 0.5).astype(np.uint8), 'RGB')
    bio = io.BytesIO(); im.save(bio, 'JPEG', quality=q, subsampling=0 if q >= 90 else 2, optimize=True)
    return 'data:image/jpeg;base64,' + base64.b64encode(bio.getvalue()).decode()


def box(a, f):
    h, w, c = a.shape
    return a.reshape(h // f, f, w // f, f, c).mean(axis=(1, 3))


def build_starmap(nasa):
    img = load_nasa(nasa) if nasa else synth_map()
    img = img / np.percentile(img[..., 1], 99.97) * 0.95
    m1, m2 = box(img, 4), box(img, 16)   # мипы усреднением в линейном свете
    src = 'NASA SVS Deep Star Maps 2020 (Gaia), ' + os.path.basename(nasa) if nasa else 'синтетическая модель (tools/build_data.py)'
    js = ('// Карта Млечного Пути в галактических координатах, gamma 2.2. Источник: %s.\n'
          '// l=0 в центре, l растёт влево; сверху b=+90. Мипы получены усреднением в линейном свете.\n'
          'window.SV=window.SV||{};SV.data=SV.data||{};SV.data.starmap={src:%r,mips:[\n"%s",\n"%s",\n"%s"]};\n'
          % (src, src, enc(img, 88), enc(m1, 92), enc(m2, 95)))
    open(os.path.join(ROOT, 'lib/data/starmap.js'), 'w').write(js)
    print('starmap.js: %.1f MB' % (len(js) / 1048576))


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--hyg', help='hygdata_v41.csv')
    ap.add_argument('--nasa', help='карта NASA SVS в галактических координатах (jpg/png/tif, 8 бит)')
    ap.add_argument('--skip-map', action='store_true')
    a = ap.parse_args()
    if a.hyg: build_hyg(a.hyg)
    if not a.skip_map: build_starmap(a.nasa)
