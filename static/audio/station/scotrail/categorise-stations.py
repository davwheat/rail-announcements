from preferredsoundplayer import *
import os
from shutil import copy

path = "./audio/stations"
# we shall store all the file names in this list
filelist = []

oneOnlyList = []
hiLoList = []

for root, dirs, files in os.walk(path):
    for file in files:
        # append the file name to the list
        filelist.append(os.path.join(root, file))

    # Only process the files in the root directory
    break

for f in filelist:
    if not f.endswith("_0.mp3"):
        continue

    secondName = f[:-6] + "_1.mp3"

    # print(secondName)

    if secondName in filelist:
        hiLoList.append(f)
    else:
        oneOnlyList.append(f)

# for name in hiLoList:
# print(name)

if len(oneOnlyList) > 0:
    print("Some stations have only one recording. Please fix this to continue.")
    for name in oneOnlyList:
        print(name)

for stn in hiLoList:
    inp = ""
    playingVer = 0
    notPlayingVer = 1

    while inp != "h" and inp != "l":
        playsound(f"{stn[:-6]}_{playingVer}.mp3")
        inp = input(f"high (h) or low (l) OR listen to other (o) [{playingVer}] ")

        if inp == "o":
            temp = playingVer
            playingVer = notPlayingVer
            notPlayingVer = temp

    if inp == "h":
        copy(f"{stn[:-6]}_{playingVer}.mp3", "./audio/stations/high")
        copy(f"{stn[:-6]}_{notPlayingVer}.mp3", "./audio/stations/low")
    else:
        copy(f"{stn[:-6]}_{playingVer}.mp3", "./audio/stations/low")
        copy(f"{stn[:-6]}_{notPlayingVer}.mp3", "./audio/stations/high")
