"""サンプル画像作品を生成する（TMS 45）。このアプリのために新しく描いた抽象画で、外部の素材は使っていない。
使い方: python3 tools/assets/make_images.py   （Pillow が必要。乱数の種を固定しているので毎回同じ画像になる）
"""
import math, random
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

OUT = Path(__file__).resolve().parents[2] / 'public' / 'assets' / 'images'
OUT.mkdir(parents=True, exist_ok=True)


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def first_light(w=1600, h=1200):
    """夜明けの空の色の帯が重なる抽象画"""
    rnd = random.Random(7)
    stops = [(0.0, (24, 38, 64)), (0.38, (64, 102, 128)), (0.58, (196, 140, 112)), (0.72, (236, 196, 150)), (1.0, (246, 232, 206))]
    img = Image.new('RGB', (w, h))
    px = img.load()
    for y in range(h):
        t = y / (h - 1)
        for i in range(len(stops) - 1):
            if stops[i][0] <= t <= stops[i + 1][0]:
                u = (t - stops[i][0]) / (stops[i + 1][0] - stops[i][0])
                c = lerp(stops[i][1], stops[i + 1][1], u * u * (3 - 2 * u))
                break
        for x in range(w):
            px[x, y] = c
    layer = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    for k in range(14):
        y0 = h * (0.2 + 0.6 * rnd.random())
        amp = 20 + 60 * rnd.random()
        freq = 1 + 2.5 * rnd.random()
        phase = rnd.random() * math.tau
        thick = 18 + 70 * rnd.random()
        col = rnd.choice([(250, 214, 165), (120, 160, 180), (215, 120, 96), (255, 240, 220), (40, 70, 100)])
        alpha = int(40 + 70 * rnd.random())
        pts_top = [(x, y0 + amp * math.sin(freq * x / w * math.tau + phase)) for x in range(0, w + 20, 20)]
        pts_bot = [(x, y + thick) for x, y in reversed(pts_top)]
        d.polygon(pts_top + pts_bot, fill=col + (alpha,))
    layer = layer.filter(ImageFilter.GaussianBlur(6))
    img = Image.alpha_composite(img.convert('RGBA'), layer)
    # 太陽の光の名残（右寄りの柔らかい光）
    glow = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    ImageDraw.Draw(glow).ellipse((w * 0.58, h * 0.5, w * 0.86, h * 0.88), fill=(255, 236, 200, 150))
    img = Image.alpha_composite(img, glow.filter(ImageFilter.GaussianBlur(90)))
    img.convert('RGB').save(OUT / 'first-light.jpg', quality=86, optimize=True, progressive=True)


def tidal_notes(w=1100, h=1400):
    """潮のリズムを円と線の揺らぎで記録した図"""
    rnd = random.Random(3)
    img = Image.new('RGB', (w, h), (240, 233, 220))
    d = ImageDraw.Draw(img)
    ink = (38, 52, 84)
    ochre = (196, 140, 72)
    # 横線の揺らぎ（潮位の記録）
    for i in range(26):
        y0 = 120 + i * 44
        amp = 6 + 26 * (0.5 + 0.5 * math.sin(i / 26 * math.pi * 2.2))
        pts = [(x, y0 + amp * math.sin(x / w * math.tau * 2 + i * 0.45)) for x in range(80, w - 79, 6)]
        d.line(pts, fill=ink if i % 5 else ochre, width=2 if i % 5 else 4)
    # 月の満ち欠けの円
    for j in range(7):
        cx, cy, r = 160 + j * 130, 1290, 46
        d.ellipse((cx - r, cy - r, cx + r, cy + r), outline=ink, width=3)
        half = r * abs(1 - 2 * j / 6)  # 満ち欠け：塗る楕円の横幅を変える
        d.ellipse((cx - half, cy - r, cx + half + 1, cy + r), fill=ink)
    # 大きな円（満潮）
    d.ellipse((w * 0.56, 220, w * 0.56 + 330, 550), outline=ochre, width=10)
    img = img.filter(ImageFilter.SMOOTH)
    # 紙の質感
    noise = Image.effect_noise((w, h), 14).convert('RGB')
    img = Image.blend(img, noise, 0.05)
    img.save(OUT / 'tidal-notes.jpg', quality=86, optimize=True, progressive=True)


if __name__ == '__main__':
    first_light()
    tidal_notes()
    for f in sorted(OUT.iterdir()):
        print(f.name, f.stat().st_size // 1024, 'KB')
