import AllStationsJSON, { StationData } from 'uk-railway-stations'

export const AllStationsCrsToNameMap: { [crs: string]: string } = AllStationsJSON.reduce((acc, stn) => {
  acc[stn.crsCode] = stn.stationName
  return acc
}, {})

export const AllStationsTitleValueMap: { title: string; value: string }[] = AllStationsJSON.reduce((acc, stn) => {
  acc.push({ value: stn.crsCode, title: `${stn.stationName} (${stn.crsCode})` })
  return acc
}, [])

export function getStationByCrs(crs: string): StationData | null {
  const stn = AllStationsJSON.find(station => station.crsCode === crs)

  if (stn === null) {
    console.warn(`Station with CRS code ${crs} not found`)
  }

  return stn
}

export function getStationByName(name: string): StationData | null {
  return AllStationsJSON.find(station => station.stationName.includes(name))
}
