import { announcementPlatforms } from './playAnnouncement'
import type { Announcement, AnnouncementType, Instant, Movement } from './types'

const names: Record<AnnouncementType, string> = {
  next: 'next train',
  approaching: 'approaching train',
  standing: 'standing train',
  disrupted: 'disruption',
  passing: 'fast train warning',
  platform_alteration: 'platform alteration',
}

const clock = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })

export function announcementName(type: AnnouncementType): string {
  return names[type] || type
}

/** Railway instants are UTC on the wire, so a log the reader checks against the platform needs a London clock. */
export function describeTime(instant: Instant | null): string {
  const parsed = instant ? Date.parse(instant) : NaN
  return Number.isFinite(parsed) ? clock.format(parsed) : '??:??'
}

function listOf(items: string[]): string {
  if (items.length < 2) return items.join('')
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

/** Names a train the way its platform sees it: headcode, booked time and where it is going. */
export function describeMovement(movement: Movement): string {
  const destination = movement.destinations.find(endpoint => !endpoint.assoc_rid) || movement.destinations[0]
  const time = describeTime(movement.departure.planned || movement.arrival.planned || movement.passing.planned)
  return `${movement.headcode || movement.rid || movement.id} (${time} to ${destination?.name || 'an unknown destination'})`
}

export function describeAnnouncement(announcement: Announcement): string {
  const train = describeMovement(announcement.details)
  if (announcement.announcement_type === 'platform_alteration') {
    return `platform alteration for ${train}, platform ${announcement.previous_platform || '?'} to ${announcement.new_platform || '?'}`
  }

  const platforms = announcementPlatforms(announcement).filter((platform): platform is string => !!platform)
  const where = platforms.length ? ` on platform ${listOf(platforms)}` : ', with no platform allocated'
  return `${announcementName(announcement.announcement_type)} for ${train}${where}`
}
