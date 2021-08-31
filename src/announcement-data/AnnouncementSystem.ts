import type { ICustomAnnouncementPaneProps } from '@components/PanelPanes/CustomAnnouncementPane'
import type { ICustomButtonPaneProps } from '@components/PanelPanes/CustomButtonPane'
import Crunker from 'crunker'

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

export type AudioItem = string | AudioItemObject

interface AudioItemObject {
  id: string
  opts?: Partial<IPlayOptions>
}

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

  private static readonly SAMPLE_RATE = 48000

  /**
   * Generates a URL for the provided audio file ID.
   */
  generateAudioFileUrl(fileId: string): string {
    return `/audio/${this.FILE_PREFIX}/${this.processAudioFileId(fileId).replace(/\./g, '/')}.mp3`
  }

  /**
   * Plays multiple audio files.
   *
   * Returns a promise which resolves when the last audio file has finished playing.
   *
   * @param fileIds Array of audio files to play.
   * @param download Whether to save the concatenated audio to the device.
   *
   * @returns Promise which resolves when the last audio file has finished playing.
   */
  async playAudioFiles(fileIds: AudioItem[], download: boolean = false): Promise<void> {
    const standardisedFileIds = fileIds.map(fileId => {
      if (typeof fileId === 'string') {
        return { id: fileId }
      } else {
        return fileId
      }
    })

    const crunker = new Crunker({ sampleRate: AnnouncementSystem.SAMPLE_RATE })
    const audio = await this.concatSoundClips(standardisedFileIds)

    if (audio.numberOfChannels > 1) {
      // This is stereo. We need to mux it to mono.

      audio.copyToChannel(audio.getChannelData(0), 1, 0)
    }

    if (download) {
      crunker.download(crunker.export(audio).blob, 'announcement')
    } else {
      const source = crunker.play(audio)

      return new Promise<void>(resolve => {
        source.addEventListener('ended', () => resolve())
      })
    }
  }

  async concatSoundClips(files: AudioItemObject[]): Promise<AudioBuffer> {
    const crunker = new Crunker({ sampleRate: AnnouncementSystem.SAMPLE_RATE })

    const filesWithUris: (AudioItemObject & { uri: string })[] = files.map(file => ({ ...file, uri: this.generateAudioFileUrl(file.id) }))

    const audioBuffers_P = crunker.fetchAudio(...filesWithUris.map(file => file.uri))

    const audioBuffers = (await audioBuffers_P).reduce((acc, curr, i) => {
      if (filesWithUris[i].opts?.delayStart !== undefined) {
        acc.push(this.createSilence(filesWithUris[i].opts.delayStart))
      }

      acc.push(curr)

      return acc
    }, [])

    return crunker.concatAudio(audioBuffers)
  }

  private createSilence(msLength: number): AudioBuffer {
    const SAMPLE_RATE = 48000
    const msToLength = (ms: number) => Math.ceil((ms / 1000) * SAMPLE_RATE)

    return new AudioContext().createBuffer(1, msToLength(msLength), SAMPLE_RATE)
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
