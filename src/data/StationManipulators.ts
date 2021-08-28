import AllStationsJSON, { StationData } from 'uk-railway-stations'

export const AllStationsCrsToNameMap: { [crs: string]: string } = AllStationsJSON.reduce((acc, stn) => {
  acc[stn.crsCode] = stn.stationName
  return acc
}, {})

export const AllStationsTitleValueMap: { title: string; value: string }[] = AllStationsJSON.reduce((acc, stn) => {
  acc.push({ value: stn.crsCode, title: stn.stationName })
  return acc
}, [])

export function getStationByCrs(crs: string): StationData | null {
  return AllStationsJSON.find(station => station.crsCode === crs)
}

export function getStationByName(name: string): StationData | null {
  return AllStationsJSON.find(station => station.stationName.includes(name))
}
