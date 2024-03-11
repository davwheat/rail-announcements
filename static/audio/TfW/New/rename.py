import os
from preferredsoundplayer import soundplay


cy_files = []

for file in os.listdir("./en/station"):
    if file.endswith("b.mp3"):
        cy_files.append(file)

for f in cy_files:
    new_name = ""
    while new_name == "":
        soundplay(f"./en/station/{f}")
        new_name = input(f"({f}) Enter new name: ")

    # Rename english files and cy files, and both with b and without b
    # b is e, no b is and
    # -1000 for m inflection

    old_name = f.split(".")[0][:-1]
    num = int(old_name)

    os.rename(f"./en/station/{f}", f"./en/station/and/{new_name}.mp3")
    os.rename(f"./en/station/{f.replace('b.', '.')}", f"./en/station/e/{new_name}.mp3")
    os.rename(f"./en/station/{num - 1000}.mp3", f"./en/station/m/{new_name}.mp3")
    # os.rename(f"./cy/station/{f}", f"./cy/station/and/{new_name}.mp3")
    # os.rename(f"./cy/station/{f.replace('b.', '.')}", f"./cy/station/e/{new_name}.mp3")
    # os.rename(f"./cy/station/{num - 1000}.mp3", f"./cy/station/m/{new_name}.mp3")
