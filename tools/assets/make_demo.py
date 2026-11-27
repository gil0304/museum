"""提出用の短いデモ動画（TMS 71）。実際の操作画面のスクリーンショット（docs/media/*.jpg、Claude in Chrome で撮影）に
字幕を重ね、フェードでつないだ約 26 秒の動画を docs/media/demo.mp4 に作る。
使い方: python3 tools/assets/make_demo.py   （Pillow・ffmpeg が必要）
"""
import subprocess, tempfile
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
MEDIA = ROOT / 'docs' / 'media'
FONT = '/System/Library/Fonts/ヒラギノ角ゴシック W6.ttc'
W, H = 1280, 720
SLIDES = [
    ('01-title.jpg', '自分の世界を、美術館にする。', 'ブラウザで開いてすぐ、1 クリックで展示室へ'),
    ('02-enter-sample.jpg', 'サンプル美術館を歩く', 'ドラッグで見回し、W A S D で歩く'),
    ('03-html-in-canvas.jpg', '3D の壁の上で、HTML をそのまま操作', 'HTML in Canvas：ボタンもスライダーも本物の DOM'),
    ('04-walk-text-video.jpg', '6 種類の作品を同じ部屋に', '画像・文章・動画・音・3D・HTML'),
    ('05-3d-closeup.jpg', '3D 作品は近くで回して見る', 'クリックで作品のまわりを回る視点に'),
    ('06-edit-move.jpg', '床と壁を置いて、部屋から作る', '編集モード：マス目に建て、作品を動かす'),
    ('07-edit-library.jpg', '作品ライブラリから飾る', '編集はブラウザに自動保存、JSON で持ち運べる'),
    ('08-about.jpg', 'MUSEUM', 'PC の Google Chrome で、ぜひ歩いてみてください'),
]
SEC, FADE = 3.2, 0.5


def frame(src, title, sub, out):
    img = Image.open(MEDIA / src).convert('RGB')
    img = img.resize((W, round(img.height * W / img.width)))
    canvas = Image.new('RGB', (W, H), (16, 18, 20))
    canvas.paste(img, (0, (H - img.height) // 2))
    bar = Image.new('RGBA', (W, 132), (16, 18, 20, 215))
    canvas.paste(bar, (0, H - 132), bar)
    d = ImageDraw.Draw(canvas)
    d.text((48, H - 112), title, font=ImageFont.truetype(FONT, 36), fill=(243, 241, 235))
    d.text((48, H - 58), sub, font=ImageFont.truetype(FONT, 22), fill=(201, 168, 106))
    canvas.save(out, quality=92)


with tempfile.TemporaryDirectory() as tmp:
    frames = []
    for i, (src, title, sub) in enumerate(SLIDES):
        p = Path(tmp) / f'{i:02d}.jpg'
        frame(src, title, sub, p)
        frames.append(p)
    args = ['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error']
    for p in frames:
        args += ['-loop', '1', '-t', str(SEC), '-i', str(p)]
    # 各画面をフェードイン・フェードアウトさせて順につなぐ（古い ffmpeg にも xfade が無くても動くように）
    parts = [f'[{i}:v]fps=30,fade=t=in:st=0:d={FADE / 2},fade=t=out:st={SEC - FADE / 2}:d={FADE / 2}[s{i}]' for i in range(len(frames))]
    joined = ''.join(f'[s{i}]' for i in range(len(frames))) + f'concat=n={len(frames)}:v=1:a=0,format=yuv420p[out]'
    args += ['-filter_complex', ';'.join(parts + [joined]), '-map', '[out]',
             '-c:v', 'libx264', '-crf', '24', '-preset', 'slow', '-movflags', '+faststart', str(MEDIA / 'demo.mp4')]
    subprocess.run(args, check=True)
print(MEDIA / 'demo.mp4', round((MEDIA / 'demo.mp4').stat().st_size / 1024), 'KB')
