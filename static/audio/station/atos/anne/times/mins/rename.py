import os

# all files ending with .mp3
allMp3Files = [f for f in os.listdir(".") if f.endswith(".mp3")]

for file in allMp3Files:
    newName = file.replace("EZM", "")
    os.rename(file, newName)
