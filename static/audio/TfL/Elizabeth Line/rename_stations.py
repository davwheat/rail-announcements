import pandas as pd
import numpy as np
import requests
import os

# open csv called "all stations.csv" and read it into a dataframe with no header
df = pd.read_csv("./all stations.csv", header=None)

# rename the columns
df.columns = ["pos", "filename", "name"]

station_crs_map = {}


def getCrs(stationName: str) -> str:
    stn = stationName.strip().lower()

    if stn in station_crs_map:
        return station_crs_map[stn]

    # use api at https://national-rail-api.davwheat.dev/crs/<name> to get crs code
    url = "https://national-rail-api.davwheat.dev/crs/" + stn
    response = requests.get(url)

    # get json
    json = response.json()

    # response is an array. if only one item, return the crsCode attribute, otherwise prompt for CRS
    if len(json) > 1:
        # find the station in the array that matches the name
        matchingCrs = [x for x in json if x["stationName"].lower() == stn]

        if len(matchingCrs) > 0:
            return matchingCrs[0]["crsCode"]

        crs = input(f"Enter CRS for {stn}: ")
    elif len(json) == 0:
        crs = input(f"Enter CRS for {stn}: ")
    else:
        crs = json[0]["crsCode"]

    station_crs_map[stn] = crs

    return crs


# iterate over each record in the dataframe and get the crs code for the station
df["crs"] = df["name"].apply(getCrs)

# replace blank string crs codes with the station's name
df["crs"] = df["crs"].str.strip().replace("", np.nan).fillna(df["name"])


# rename .wav files in the stations folder to the crs code
for index, row in df.iterrows():
    # get the filename and crs code
    filename = row["filename"]
    crs = row["crs"]
    pos = row["pos"]

    newName = f"{pos}_{crs}.wav"

    if not os.path.isfile(f"./stations/{filename}.wav"):
        continue

    i = 1

    # if file exists
    while os.path.isfile(f"./stations/{newName}"):
        newName = f"{pos}_{crs}_{i}.wav"
        i += 1

    # rename the file
    os.rename(f"stations/{filename}.wav", f"stations/{newName}")
