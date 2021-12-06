import type { AudioItem, CustomAnnouncementButton } from '@announcement-data/AnnouncementSystem'

export default function createAnnouncementButton(
  playHandler: (items: AudioItem[], download?: boolean) => Promise<void>,
  label: string,
  items: AudioItem[],
): CustomAnnouncementButton {
  return {
    label,
    play: async () => {
      playHandler(items)
    },
    download: async () => {
      playHandler(items, true)
    },
  }
}
