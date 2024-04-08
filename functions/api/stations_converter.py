import pandas as pd

df = pd.read_csv("stations.csv", dtype=str)

# Print head
print(df.head())

# Merge columns tiplocs/0,tiplocs/1,tiplocs/2,tiplocs/3,tiplocs/4 into array, removing nans
df["tiplocs"] = df[
    ["tiplocs/0", "tiplocs/1", "tiplocs/2", "tiplocs/3", "tiplocs/4"]
].values.tolist()
df["tiplocs"] = df["tiplocs"].apply(lambda x: [y for y in x if str(y) != "nan"])

# Remove columns tiplocs/0,tiplocs/1,tiplocs/2,tiplocs/3,tiplocs/4
df.drop(
    columns=["tiplocs/0", "tiplocs/1", "tiplocs/2", "tiplocs/3", "tiplocs/4"],
    inplace=True,
)

df.drop(columns=["uic"], inplace=True)

print(df.head())

# New empty df
df2 = pd.DataFrame(columns=["tiploc", "crs", "fullName"], index=["tiploc"])

# Loop through df
items = []
for index, row in df.iterrows():
    # Loop through tiplocs array
    for tiploc in row["tiplocs"]:
        # Append to items list
        items.append([tiploc, row["crs"], row["fullName"]])

df2 = pd.DataFrame(items, columns=["tiploc", "crs", "fullName"])
df2.set_index("tiploc", inplace=True)

# Print head
print(df2.head())

# Save to JSON
df2.to_json("tiploc_to_station.json", orient="index")
