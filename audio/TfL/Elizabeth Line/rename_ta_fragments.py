# Load csv from "ta_fragments.csv" and rename files in "ta_fragments" folder

import os
import csv
import re

# Load csv
with open("ta_fragments.csv", "r") as f:
    reader = csv.reader(f)
    data = list(reader)

# Make ta_fragments_renamed folder if it doesn't exist
if not os.path.exists("ta_fragments_renamed"):
    os.makedirs("ta_fragments_renamed")

# Rename files in folder
for file in os.listdir("ta_fragments"):
    for row in data:
        if file == row[1] + ".wav":
            name = re.sub(r"[/\\?%*:|\"<>\x7F\x00-\x1F]", "-", row[2]).lower()

            os.rename(
                "ta_fragments\\" + file,
                f"ta_fragments_renamed\\{row[0]}_{name}.wav",
            )
            print(file + " renamed to " + name + ".wav")
