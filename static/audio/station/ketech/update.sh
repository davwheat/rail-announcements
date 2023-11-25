#!/bin/bash

# This script is used to update the audio files for the KeTech/Amey systems
# from the master copy.
#
# It assumes you have a copy of https://github.com/Rail-Announcements/ketech-llpa-announcements
# cloned under ~/ketech-llpa-announcements

# Current pwd
pwd=$(pwd)

# Get script dir
dir="$(cd -P -- "$(dirname -- "$0")" && pwd -P)"

# Set working dir to script dir
cd $dir

# Remove existing files
rm -rf phil/* celia/*

# Copy renamed files
cp -r ~/ketech-llpa-announcements/renamed/Male1/* ./phil/
cp -r ~/ketech-llpa-announcements/renamed/Female1/* ./celia/

# Copy extra custom files
cp -r ~/ketech-llpa-announcements/custom/Male1/* ./phil/
cp -r ~/ketech-llpa-announcements/custom/Female1/* ./celia/

# Set working dir back to original
cd $pwd