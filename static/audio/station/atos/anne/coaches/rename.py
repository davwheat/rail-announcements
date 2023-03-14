import os

# all files ending with .mp3
allMp3Files = [f for f in os.listdir(".") if f.endswith(".mp3")]

for file in allMp3Files:
    if not file.startswith("ece"):
        continue

    newName = file.replace("ece0", "")
    newName = newName.replace("ece", "")
    newName = newName.replace(".mp3", "")

    numVal = int(newName)

    if numVal == 1:
        newName += " carriage.mp3"
    else:
        newName += " carriages.mp3"

    os.rename(file, newName)
