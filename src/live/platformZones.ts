/** Merges saved per station, as CRS -> the groups of platforms that share a queue.
 *  A platform named in no group announces on its own, so only merges are stored. */
export type PlatformZoneStore = Record<string, string[][]>

export function isPlatformZoneStore(value: any): value is PlatformZoneStore {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every(
      zones => Array.isArray(zones) && zones.every(zone => Array.isArray(zone) && zone.every(platform => typeof platform === 'string')),
    )
  )
}

/** Orders platforms the way a station numbers them: 1, 2, 9, 10, 10a, a. */
export function comparePlatforms(a: string, b: string): number {
  const aInt = parseInt(a)
  const bInt = parseInt(b)

  if (!isNaN(aInt) && !isNaN(bInt)) {
    const diff = aInt - bInt

    if (diff !== 0) return diff
  }

  return a.localeCompare(b)
}

/** A zone's lowest platform in station order. It names the zone and places it in the list,
 *  so merging two zones leaves the survivor where the earlier of the two already was. */
export function zoneKey(zone: string[]): string {
  return [...zone].sort(comparePlatforms)[0]
}

/** Expands the saved merges into a zone for every platform, ordered by the lowest platform
 *  in each. A platform the station no longer has drops out, and one the save never mentioned
 *  gets its own zone, so a station whose platform list changes still starts from one queue
 *  per platform.
 *
 *  Members keep the order they were dropped in. A zone is a set, so their order carries no
 *  meaning — but re-sorting them would land a dragged platform somewhere other than where it
 *  was dropped, and the jump on release is worth more than tidiness. */
export function resolveZones(saved: string[][] | undefined, platforms: string[]): string[][] {
  const known = new Set(platforms)
  const placed = new Set<string>()
  const zones: string[][] = []

  for (const zone of saved ?? []) {
    const members = zone.filter(platform => known.has(platform) && !placed.has(platform))
    members.forEach(platform => placed.add(platform))
    if (members.length > 0) zones.push(members)
  }

  for (const platform of platforms) {
    if (!placed.has(platform)) zones.push([platform])
  }

  return zones.sort((a, b) => comparePlatforms(zoneKey(a), zoneKey(b)))
}

/** Moves one platform to `position` within the zone at `target`, or into a new zone of its
 *  own when target is null. Zones left empty disappear.
 *
 *  The position matters even though a zone is unordered: it is where the drag put the
 *  platform, and rendering it anywhere else shows as a jump the moment the drag is released. */
export function moveToZone(zones: string[][], platform: string, target: number | null, position = 0): string[][] {
  const without = zones.map(zone => zone.filter(member => member !== platform))
  // A target outside the list — including the -1 of a zone that has since been renamed —
  // gives the platform a zone of its own. Dropping it from every zone would lose it.
  const next =
    target === null || target < 0 || target >= without.length
      ? [...without, [platform]]
      : without.map((zone, index) => {
          if (index !== target) return zone

          const members = [...zone]
          members.splice(Math.min(Math.max(position, 0), members.length), 0, platform)

          return members
        })

  return next.filter(zone => zone.length > 0)
}

/** Only merges are worth saving: a zone of one is what an unmentioned platform already gets,
 *  and storing every singleton would freeze today's platform list into the save. */
export function zonesToSave(zones: string[][]): string[][] {
  return zones.filter(zone => zone.length > 1)
}

/** The queue lane each platform announces on. Platforms sharing a lane take turns; a lone
 *  platform keeps its own name as its lane, which is what the station did before zones. */
export function zoneLanes(zones: string[][]): Map<string, string> {
  const lanes = new Map<string, string>()

  for (const zone of zones) {
    // Sorted, so the lane of a zone does not change when its members are rearranged.
    const lane = [...zone].sort(comparePlatforms).join('+')
    for (const platform of zone) lanes.set(platform, lane)
  }

  return lanes
}
