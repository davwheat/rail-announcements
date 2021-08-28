export interface IPlayOptions {
  delayStart: number
}

export default abstract class AnnouncementSystem {
  /**
   * Display name for the announcement system.
   */
  abstract readonly NAME: string

  /**
   * Internal ID for the announcement system.
   */
  abstract readonly ID: string

  /**
   * The announcement system's file prefix for assembling URLs.
   */
  abstract readonly FILE_PREFIX: string

  abstract readonly SYSTEM_TYPE: 'station' | 'train'

  /**
   * Generates a URL for the provided audio file ID.
   */
  generateAudioFileUrl(fileId: string): string {
    return `/audio/${this.FILE_PREFIX}/${fileId.replace(/\./g, '/')}.mp3`
  }

  playAudioFile(fileId: string, playOptions: Partial<IPlayOptions> = {}): HTMLAudioElement {
    const audio = new Audio(this.generateAudioFileUrl(fileId))

    if (playOptions.delayStart) {
      setTimeout(() => audio.play(), playOptions.delayStart)
    } else {
      audio.play()
    }

    return audio
  }

  playAudioFiles(fileIds: (string | { id: string; opts?: Partial<IPlayOptions> })[]): Promise<void> {
    const that = this

    return new Promise(resolve => {
      function playAudioFile(index: number): void {
        const d = fileIds[index]
        const data = typeof d === 'string' ? { id: d } : d

        const audio = that.playAudioFile(data.id, data.opts || {})

        if (index < fileIds.length - 1) {
          audio.addEventListener('ended', playAudioFile.bind(this, index + 1))
        } else {
          audio.addEventListener('ended', () => resolve())
        }
      }

      playAudioFile(0)
    })
  }
}
