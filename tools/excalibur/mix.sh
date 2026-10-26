#!/usr/bin/env bash
# ./mix.sh [music.wav]  voice (with its own reverb) over the music bed, music ducked under the voice
set -e; MU="${1:-out/sound.wav}"
ffmpeg -y -loglevel error -i out/silent.mp4 -i "$MU" -i vo.mp3 -filter_complex \
 "[2:a]aformat=sample_rates=48000:channel_layouts=stereo,apad,asplit=2[vo][sc];\
  [1:a]aformat=sample_rates=48000:channel_layouts=stereo,volume=0.6[mu];[mu][sc]sidechaincompress=threshold=0.03:ratio=6:attack=20:release=400[duck];\
  [duck][vo]amix=inputs=2:normalize=0,loudnorm=I=-14:TP=-1.5:LRA=11[a]" \
 -map 0:v -map "[a]" -c:v copy -c:a aac -b:a 192k -ar 48000 -shortest final.mp4
ffprobe -v error -show_entries format=duration -of csv=p=0 final.mp4
