export function isMindTheGapStation(crs: string, platformNumber: string | null): boolean {
  if (platformNumber === null) return false

  return MindTheGapStations[crs]?.includes(platformNumber) ?? false
}

/**
 * Mind the gap stations data
 *
 * Mapped by CRS -> Platform
 */
const MindTheGapStations: Record<string, string[]> = {
  WVF: ['1', '2'],
  LWS: ['1', '2', '3', '4', '5'],
}
