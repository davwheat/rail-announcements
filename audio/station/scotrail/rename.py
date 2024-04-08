import pandas as pd
from pathlib import Path


def does_file_exist(filename: str) -> bool:
    file = Path(filename)

    if file.exists():
        return True
    else:
        return False


df = pd.read_csv("scotrail.csv")


# stations_df = df.loc[df["NRE_ID"].isnull() == False]
# tocs_df = df.loc[(df["Category"] == "Train operating company")]
# tocs_df = df.loc[(df["Category"] == "Heritage Railway")]
# tocs_df = df.loc[(df["Category"] == "Special train")]
# tocs_df = df.loc[(df["Category"] == "Strathclyde metro")]
# conjoiner_df = df.loc[(df["Category"] == "Conjoining")]
# disruption_reason_df = df.loc[(df["Category"] == "Reason")]
# disruption_apology_df = df.loc[(df["Category"] == "Apology")]
# platform_info_df = df.loc[(df["Category"] == "Platform information")]
# formation_df = df.loc[(df["Category"] == "Train formation")]
time_df = df.loc[(df["Category"] == "Time")]
num_df = df.loc[(df["Category"] == "Number")]

# region Stations

if False:
    station_id = {}

    for index, row in stations_df.iterrows():
        exists = does_file_exist("audio/" + row["File"])

        if not exists:
            continue

        if row["NRE_ID"] not in station_id:
            station_id[row["NRE_ID"]] = []

        station_id[row["NRE_ID"]].append(row["ID"])

    for key, value in station_id.items():
        i = 0
        for file in value:
            print(
                "Renaming " + str(file).zfill(4) + " to " + key + "_" + str(i) + ".mp3"
            )
            p = Path("audio/" + str(file).zfill(4) + ".mp3")

            if p.exists():
                p.rename("audio/stations/" + key + "_" + str(i) + ".mp3")

            i += 1

        # if len(value) > 2:
        #     print(key, value)

# endregion

# region TOCs

if False:
    for index, row in tocs_df.iterrows():
        exists = does_file_exist("audio/" + row["File"])

        if not exists:
            continue

        print("Renaming " + row["File"] + " to " + row["Transcription"] + ".mp3")

        p = Path("audio/" + row["File"])

        t = row["Transcription"].lower()

        if p.exists():
            newName = f"audio/tocs/{t}.mp3"

            newP = Path(newName)
            counter = 0

            while newP.exists():
                counter += 1
                newName = f"audio/tocs/{t} {counter}.mp3"
                newP = Path(newName)

            p.rename(newName)

# endregion

# region Conjoiners

if False:
    for index, row in conjoiner_df.iterrows():
        exists = does_file_exist("audio/" + row["File"])

        if not exists:
            continue

        print("Renaming " + row["File"] + " to " + row["Transcription"] + ".mp3")

        p = Path("audio/" + row["File"])

        t = row["Transcription"].lower()

        if p.exists():
            newName = f"audio/conjoiner/{t}.mp3"

            newP = Path(newName)
            counter = 0

            while newP.exists():
                counter += 1
                newName = f"audio/conjoiner/{t} {counter}.mp3"
                newP = Path(newName)

            p.rename(newName)

# endregion

# region Disruption reasons

if False:
    for index, row in disruption_reason_df.iterrows():
        exists = does_file_exist("audio/" + row["File"])

        if not exists:
            continue

        print("Renaming " + row["File"] + " to " + row["Transcription"] + ".mp3")

        p = Path("audio/" + row["File"])

        t = row["Transcription"].lower()

        if p.exists():
            newName = f"audio/disruption/reason/{t}.mp3"

            newP = Path(newName)
            counter = 0

            while newP.exists():
                counter += 1
                newName = f"audio/disruption/reason/{t} {counter}.mp3"
                newP = Path(newName)

            p.rename(newName)

# endregion


# region Disruption apologies

if False:
    for index, row in disruption_apology_df.iterrows():
        exists = does_file_exist("audio/" + row["File"])

        if not exists:
            continue

        print("Renaming " + row["File"] + " to " + row["Transcription"] + ".mp3")

        p = Path("audio/" + row["File"])

        t = row["Transcription"].lower()

        if p.exists():
            newName = f"audio/disruption/apology/{t}.mp3"

            newP = Path(newName)
            counter = 0

            while newP.exists():
                counter += 1
                newName = f"audio/disruption/apology/{t} {counter}.mp3"
                newP = Path(newName)

            p.rename(newName)

# endregion


# region Platform info

if False:
    for index, row in platform_info_df.iterrows():
        exists = does_file_exist("audio/" + row["File"])

        if not exists:
            continue

        print("Renaming " + row["File"] + " to " + row["Transcription"] + ".mp3")

        p = Path("audio/" + row["File"])

        t = row["Transcription"].lower()

        if p.exists():
            newName = f"audio/platform info/{t}.mp3"

            newP = Path(newName)
            counter = 0

            while newP.exists():
                counter += 1
                newName = f"audio/platform info/{t} {counter}.mp3"
                newP = Path(newName)

            p.rename(newName)

# endregion


# region Train formation

if False:
    for index, row in formation_df.iterrows():
        exists = does_file_exist("audio/" + row["File"])

        if not exists:
            continue

        print("Renaming " + row["File"] + " to " + row["Transcription"] + ".mp3")

        p = Path("audio/" + row["File"])

        t = row["Transcription"].lower()

        if p.exists():
            newName = f"audio/formation/{t}.mp3"

            newP = Path(newName)
            counter = 0

            while newP.exists():
                counter += 1
                newName = f"audio/formation/{t} {counter}.mp3"
                newP = Path(newName)

            p.rename(newName)

# endregion


# region Nums

if True:
    for index, row in num_df.iterrows():
        exists = does_file_exist("audio/" + row["File"])

        if not exists:
            continue

        print("Renaming " + row["File"] + " to " + row["Transcription"] + ".mp3")

        p = Path("audio/" + row["File"])

        t = row["Transcription"].lower()

        if p.exists():
            newName = f"audio/number/{t}.mp3"

            newP = Path(newName)
            counter = 0

            while newP.exists():
                counter += 1
                newName = f"audio/number/{t} {counter}.mp3"
                newP = Path(newName)

            p.rename(newName)

# endregion


# region Time

if True:
    for index, row in time_df.iterrows():
        exists = does_file_exist("audio/" + row["File"])

        if not exists:
            continue

        print("Renaming " + row["File"] + " to " + row["Transcription"] + ".mp3")

        p = Path("audio/" + row["File"])

        t = row["Transcription"].lower()

        if p.exists():
            newName = f"audio/time/{t}.mp3"

            newP = Path(newName)
            counter = 0

            while newP.exists():
                counter += 1
                newName = f"audio/time/{t} {counter}.mp3"
                newP = Path(newName)

            p.rename(newName)

# endregion
