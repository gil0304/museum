# 同梱素材の出どころ

MUSEUM に同梱しているサンプル作品の素材は、すべてこのアプリのために新しく作ったものです。外部の画像・映像・音源・3D モデル・フォントは使っていません。生成に使ったスクリプトはリポジトリの `tools/assets/` にあり、同じ素材を作り直せます。

| ファイル | 作品 | 作り方 |
|---|---|---|
| images/first-light.jpg | First Light | `tools/assets/make_images.py`（Pillow で描画。乱数の種を固定） |
| images/tidal-notes.jpg | Tidal Notes | `tools/assets/make_images.py` |
| video/slow-weather.mp4 | Slow Weather | `tools/assets/make_video.sh`（ffmpeg の数式 geq で色の流れを描画。12 秒ループ、音声なし） |
| audio/room-tone.mp3 | Room Tone | `tools/assets/make_audio.sh`（ffmpeg の aevalsrc で正弦波の和音を合成。24 秒ループ） |
| models/knot.glb | Knot No.3 | `tools/assets/make_glb.mjs`（three.js の形状を GLTFExporter で GLB に書き出し） |
