import type { ICustomAnnouncementPaneProps } from '@components/PanelPanes/CustomAnnouncementPane'
import type { ICustomButtonPaneProps } from '@components/PanelPanes/CustomButtonPane'

export interface IPlayOptions {
  delayStart: number
}

interface IOptionsExplanation {
  name: string
}

export type OptionsExplanation = IOptionsExplanation &
  (IMultiselectOptions | ISelectOptions | IBooleanOptions | INumberOptions | ITimeOptions | ICustomOptions)

interface IMultiselectOptions {
  type: 'multiselect'
  default: string[]
  options: { title: string; value: string }[]
}
interface ISelectOptions {
  type: 'select'
  default: string
  options: { title: string; value: string }[]
}
interface IBooleanOptions {
  type: 'boolean'
  default: boolean
}
interface ITimeOptions {
  type: 'time'
  default: `${string}:${string}`
}
interface INumberOptions {
  type: 'number'
  default: number
}

interface ICustomOptions {
  type: 'custom'
  component: (props: { onChange: (newVal: any) => void; value: any; [key: string]: any }) => JSX.Element
  props: Record<string, unknown>
  default: any
}

export type AudioItem = string | { id: string; opts?: Partial<IPlayOptions> }

export interface CustomAnnouncementTab {
  name: string
  component: (props: ICustomAnnouncementPaneProps | ICustomButtonPaneProps) => JSX.Element
  props: ICustomAnnouncementPaneProps | ICustomButtonPaneProps
}

export interface CustomAnnouncementButton {
  label: string
  onClick: () => Promise<void>
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

  /**
   * The announcement system type.
   */
  abstract readonly SYSTEM_TYPE: 'station' | 'train'

  /**
   * Generates a URL for the provided audio file ID.
   */
  generateAudioFileUrl(fileId: string): string {
    return `/audio/${this.FILE_PREFIX}/${this.processAudioFileId(fileId).replace(/\./g, '/')}.mp3`
  }

  /**
   * Plays a single audio file with the provided playback options.
   *
   * Returns the HTML Audio Element used to play the audio file.
   *
   * @param fileId Audio file ID
   * @param playOptions Playback options
   * @returns HTML Audio Element used to play the audio
   */
  private playAudioFile(fileId: string, playOptions: Partial<IPlayOptions> = {}): HTMLAudioElement {
    const audio = new Audio(this.generateAudioFileUrl(fileId))

    if (playOptions.delayStart) {
      setTimeout(() => audio.play(), playOptions.delayStart)
    } else {
      audio.play()
    }

    return audio
  }

  /**
   * Plays multiple audio files.
   *
   * Returns a promise which resolves when the last audio file has finished playing.
   *
   * @param fileIds Array of audio files to play.
   * @returns Promise which resolves when the last audio file has finished playing.
   */
  playAudioFiles(fileIds: AudioItem[]): Promise<void> {
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

  /**
   * Processes an audio file ID before playing it.
   *
   * Defaults to the identity function.
   */
  protected processAudioFileId(fileId: string): string {
    return fileId
  }

  readonly customAnnouncementTabs: Record<string, CustomAnnouncementTab> = {}
}
