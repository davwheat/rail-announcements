from preferredsoundplayer import *
import os
from shutil import copy

path = "./audio/number"
# we shall store all the file names in this list
filelist = []
mid = True

for root, dirs, files in os.walk(path):
    for file in files:
        # append the file name to the list
        filelist.append(os.path.join(root, file))

    # Only process the files in the root directory
    break

# for f in filelist:
#     if not f.endswith("_0.mp3"):
#         continue

#     secondName = f[:-6] + "_1.mp3"

#     # print(secondName)

#     if secondName in filelist:
#         hiLoList.append(f)
#     else:
#         oneOnlyList.append(f)

# for name in hiLoList:
# print(name)

# if len(oneOnlyList) > 0:
#     print("Some stations have only one recording. Please fix this to continue.")
#     for name in oneOnlyList:
#         print(name)

for stn in filelist:
    inp = ""

    while (inp not in ["h", "l"] and not mid) or (inp not in ["h", "l", "m"]):
        playsound(stn)

        prompt = "high (h) or low (l)"

        if mid:
            prompt += " or mid (m)"

        inp = input(prompt)

    if inp == "h":
        copy(stn, f"{path}/high")
    elif inp == "l":
        copy(stn, f"{path}/low")
    else:
        copy(stn, f"{path}/mid")
