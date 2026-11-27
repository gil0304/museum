#!/bin/sh
# サンプル動画作品「Slow Weather」を生成する（TMS 49）。外部の映像は使わず、ffmpeg の数式（geq）で色の流れを描く。
# 12 秒で元に戻る周期にしてあるので、ループ再生しても継ぎ目が出ない。音声トラックは無し。
# 使い方: sh tools/assets/make_video.sh   （ffmpeg が必要）
set -eu
OUT="$(cd "$(dirname "$0")/../.." && pwd)/public/assets/video/slow-weather.mp4"
P='2*PI*T/12'
ffmpeg -y -hide_banner -loglevel error \
  -f lavfi -i "color=c=black:s=480x270:r=24:d=12" \
  -vf "geq=\
r='clip(118+70*sin(2*PI*X/W*1.3+$P)+40*sin(2*PI*Y/H*0.9-$P*2+1.1),0,255)':\
g='clip(132+55*sin(2*PI*(X+Y)/W*0.8+$P+2.0)+30*sin(2*PI*Y/H*1.7+$P*3),0,255)':\
b='clip(150+70*sin(2*PI*(X-Y*0.6)/W*1.1-$P+0.5)+25*cos(2*PI*X/W*2.3+$P*2),0,255)',\
gblur=sigma=14,hue=s=0.5,eq=brightness=0.02:contrast=0.92,scale=960:540:flags=bicubic,format=yuv420p" \
  -c:v libx264 -preset slow -crf 26 -movflags +faststart -an "$OUT"
ls -l "$OUT"
