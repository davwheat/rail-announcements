import os

# all files ending with .mp3
allMp3Files = [f for f in os.listdir(".") if f.endswith(".MP3")]

for file in allMp3Files:
    newName = file.replace("E1", "").upper()
    newName = newName.replace(".MP3", ".mp3")

    os.rename(file, newName)
