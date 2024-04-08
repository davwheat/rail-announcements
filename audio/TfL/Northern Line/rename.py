from preferredsoundplayer import *
from pathlib import Path

mypath = "E:\\New Git Repos\\rail-announcements\\static\\audio\\TfL\\Northern Line\\NL AA 20150804 v9B"

from os import listdir
from os.path import isfile, join

onlyfiles = [f for f in listdir(mypath) if isfile(join(mypath, f))]

for filename in onlyfiles:
    playsound(f"NL AA 20150804 v9B/{filename}")
    name = input(f"Name file ({filename}): ")

    if (name == "") or (name == " "):
        continue

    p = Path(f"NL AA 20150804 v9B/{filename}")

    newName = f"NL AA 20150804 v9B/{name}.wav"

    newP = Path(newName)
    counter = 0

    while newP.exists():
        counter += 1
        newName = f"NL AA 20150804 v9B/{name} {counter}.wav"
        newP = Path(newName)

    p.rename(newName)
