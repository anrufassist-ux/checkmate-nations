#!/usr/bin/env bash
# ./mix.sh  puts the General's voice over the rendered clip (tools/clip/explain_kq.mp4: music + effects from mix.py):
# parts S1-S6 of vo_raw.mp3 start at 1.0 s (the clip script's captions are timed to that), S7 ("Now you try …")
# starts half a second before the end card; the music ducks under the voice.
set -e; IN=../../tools/clip/explain_kq.mp4; OUT=../explain-kq.mp4
DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$IN"); END=$(python3 -c "print(int(($DUR-3.2-0.5)*1000))")
ffmpeg -y -loglevel error -i "$IN" -i vo_raw.mp3 -filter_complex \
 "[1:a]aformat=sample_rates=48000:channel_layouts=stereo,asplit=2[v1][v2];\
  [v1]atrim=0:49.6,adelay=1000:all=1[a1];[v2]atrim=50.0,asetpts=PTS-STARTPTS,adelay=$END:all=1[a2];\
  [a1][a2]amix=inputs=2:normalize=0,volume=1.6,apad,asplit=2[vo][sc];\
  [0:a]aformat=sample_rates=48000:channel_layouts=stereo,volume=0.8[mu];[mu][sc]sidechaincompress=threshold=0.03:ratio=6:attack=20:release=400[duck];\
  [duck][vo]amix=inputs=2:normalize=0,loudnorm=I=-14:TP=-1.5:LRA=11[a]" \
 -map 0:v -map "[a]" -c:v copy -c:a aac -b:a 192k -ar 48000 -t "$DUR" "$OUT"
ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUT"
