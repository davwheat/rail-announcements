#!/bin/bash

for file in *.wav; do
    # Extract file name without extension
    filename=$(basename -- "$file")
    filename_no_ext="${filename%.*}"

    # Convert to mono mp3 using ffmpeg
    ffmpeg -i "$file" -ac 1 "mp3/$filename_no_ext.mp3"
done
