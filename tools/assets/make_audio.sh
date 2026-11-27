#!/bin/sh
# サンプル音作品「Room Tone」を生成する（TMS 50）。外部の音源は使わず、ffmpeg の aevalsrc で正弦波の和音を合成する。
# どの音も 24 秒でちょうど整数回振動する周波数（1/24 Hz の倍数）にし、音量のゆらぎも 24 秒の約数の周期にしてあるので、
# ループ再生しても継ぎ目でプツッと鳴らない。
# 使い方: sh tools/assets/make_audio.sh   （ffmpeg と libmp3lame が必要）
set -eu
OUT="$(cd "$(dirname "$0")/../.." && pwd)/public/assets/audio/room-tone.mp3"
T='2*PI*t'
L="0.16*sin($T*110)*(0.7+0.3*sin($T/24))+0.11*sin($T*165)*(0.6+0.4*sin($T/12+1))+0.09*sin($T*220)*(0.6+0.4*sin($T/8+2))+0.07*sin($T*277.5)*(0.5+0.5*sin($T/6+0.5))+0.05*sin($T*330)*(0.5+0.5*sin($T/24*5+3))"
R="0.16*sin($T*110)*(0.7+0.3*sin($T/24+0.4))+0.11*sin($T*165)*(0.6+0.4*sin($T/12+1.6))+0.09*sin($T*220)*(0.6+0.4*sin($T/8+2.7))+0.07*sin($T*277.5)*(0.5+0.5*sin($T/6+1.2))+0.05*sin($T*330)*(0.5+0.5*sin($T/24*5+3.9))"
ffmpeg -y -hide_banner -loglevel error \
  -f lavfi -i "aevalsrc=exprs='$L|$R':s=44100:d=24" \
  -c:a libmp3lame -b:a 96k "$OUT"
ls -l "$OUT"
