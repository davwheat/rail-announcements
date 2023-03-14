import os

# all files ending with .mp3
allMp3Files = [f for f in os.listdir(".") if f.endswith(".mp3")]

for file in allMp3Files:
    newName = file.replace("ED00", "")
    newName = newName.replace("ED0", "")
    newName = newName.replace("ED", "")
    newName = newName.replace(".mp3", "")

    numVal = int(newName)

    if numVal == 1:
        newName += " minute.mp3"
    else:
        newName += " minutes.mp3"

    os.rename(file, newName)
