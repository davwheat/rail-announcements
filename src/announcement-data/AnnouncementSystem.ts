import Crunker from '../helpers/crunker'

import type { ICustomAnnouncementPaneProps } from '@components/PanelPanes/CustomAnnouncementPane'
import type { ICustomButtonPaneProps } from '@components/PanelPanes/CustomButtonPane'
import type React from 'react'

export interface IPlayOptions {
  delayStart: number
  customPrefix: string
}

export type OptionsExplanation<P extends {}, C extends React.ComponentType<P>> =
  | IMultiselectOptions
  | ISelectOptions
  | IBooleanOptions
  | INumberOptions
  | ITimeOptions
  | ICustomOptions<P, C>
  | ICustomNoStateOptions

interface IMultiselectOptions {
  name: string
  type: 'multiselect'
  default: string[]
  options: { title: string; value: string }[]
  onlyShowWhen?: (activeState: Record<string, unknown>) => boolean
}
interface ISelectOptions {
  name: string
  type: 'select'
  default: string
  options: { title: string; value: string }[]
  onlyShowWhen?: (activeState: Record<string, unknown>) => boolean
}
interface IBooleanOptions {
  name: string
  type: 'boolean'
  default: boolean
  onlyShowWhen?: (activeState: Record<string, unknown>) => boolean
  disabled?: boolean
}
interface ITimeOptions {
  name: string
  type: 'time'
  default: `${string}:${string}`
  onlyShowWhen?: (activeState: Record<string, unknown>) => boolean
}
interface INumberOptions {
  name: string
  type: 'number'
  default: number
  onlyShowWhen?: (activeState: Record<string, unknown>) => boolean
}

interface ICustomOptions<Props extends {}, Component extends React.ComponentType<Props>> {
  name: string
  type: 'custom'
  component: Component
  props?: Props
  default: any
  onlyShowWhen?: (activeState: Record<string, unknown>) => boolean
}

interface ICustomNoStateOptions {
  type: 'customNoState'
  component: (props: { activeState: Record<string, unknown>; [key: string]: any }) => JSX.Element
  props?: Record<string, unknown>
  onlyShowWhen?: (activeState: Record<string, unknown>) => boolean
}

export type AudioItem = string | AudioItemObject

export interface AudioItemObject {
  id: string
  opts?: Partial<IPlayOptions>
}

export interface CustomAnnouncementTab<OptionIds extends string> {
  name: string
  component: React.ComponentType<ICustomAnnouncementPaneProps<OptionIds> | ICustomButtonPaneProps>
  props:
    | Omit<
        ICustomAnnouncementPaneProps<OptionIds>,
        | 'name'
        | 'systemId'
        | 'tabId'
        | 'isPersonalPresetsReady'
        | 'savePersonalPreset'
        | 'getPersonalPresets'
        | 'deletePersonalPreset'
        | 'system'
      >
    | ICustomButtonPaneProps
}

export type CustomAnnouncementButton = {
  label: string
} & (
  | {
      play: () => Promise<void>
      download: () => Promise<void>
      files?: AudioItem[]
    }
  | {
      files: AudioItem[]
    }
)

export interface PluraliseOptions {
  andId: string
  prefix: string
  finalPrefix: string
  firstItemDelay: number
  beforeItemDelay: number
  beforeAndDelay: number
  afterAndDelay: number
}

const DefaultPluraliseOptions = {
  andId: 'and',
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

  headerComponent(): React.ReactNode {
    return null
  }

  /**
   * Generates a URL for the provided audio file ID.
   */
  generateAudioFileUrl(fileId: string, customPrefix?: string): string {
    return `https://cdn.railannouncements.co.uk/${customPrefix || this.FILE_PREFIX}/${this.processAudioFileId(fileId).replace(/\./g, '/')}.mp3`
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
    if (fileIds.length === 0) {
      console.warn('No audio files to play.')
      return
    }

    window.Crunker = Crunker

    if ('audioSession' in window.navigator) {
      window.navigator.audioSession.type = 'playback'
    }

    window.__audio = fileIds
    console.info('Playing audio files:', fileIds)

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
      crunker.download(crunker.export(audio, 'audio/wav').blob, 'announcement')
      window.__audio = undefined
    } else {
      return new Promise<void>(resolve => {
        crunker.play(audio, source => {
          console.log('[Crunker] About to play audio...')
          crunker._context.onstatechange = () => console.log('state changed to: ', audioContext.state)
          console.log('Context state: ', crunker._context.state)

          if (crunker._context.state === 'suspended') {
            console.log('[Crunker] Resuming audio context')
            crunker._context.resume()
            console.log('Context state: ', crunker._context.state)

            if (crunker._context.state === 'suspended') {
              console.error('[Crunker] Failed to resume audio context')

              document.getElementById('resume-audio-button')?.remove()

              const button = document.createElement('button')
              button.textContent = 'Resume audio'
              button.id = 'resume-audio-button'
              button.style.margin = '16px'
              button.onclick = () => {
                crunker._context.resume()
                button.remove()
              }
              document.body.appendChild(button)

              alert(
                "Your device or web browser is refusing to let the website play audio.\n\nThis is especially common on iPhones and iPads. We'd recommend you try using a desktop computer or an alterantive device.\n\nTry scrolling to the bottom of the page and pressing the 'Resume audio' button. If this doesn't help, there's nothing else that we can do. Sorry!",
              )

              button.scrollIntoView()
            }
          }

          source.addEventListener('ended', () => {
            console.log('[Crunker] Finished playing audio')
            window.__audio = undefined
            resolve()
          })
        })
      })
    }
  }

  async concatSoundClips(files: AudioItemObject[]): Promise<AudioBuffer> {
    const crunker = new Crunker({ sampleRate: AnnouncementSystem.SAMPLE_RATE })

    const filesWithUris: (AudioItemObject & { uri: string })[] = files.map(file => ({
      ...file,
      uri: this.generateAudioFileUrl(file.id, file?.opts?.customPrefix),
    }))

    const audioBuffers_P = crunker.fetchAudio(...filesWithUris.map(file => file.uri))

    const audioBuffers = (await audioBuffers_P).reduce((acc, curr, i) => {
      if (filesWithUris[i].opts?.delayStart!! > 0) {
        acc.push(this.createSilence(filesWithUris[i].opts!!.delayStart!!))
      }

      acc.push(curr)

      return acc
    }, [] as AudioBuffer[])

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

  readonly customAnnouncementTabs: Record<string, CustomAnnouncementTab<string>> = {}

  /**
   * Takes an array of audio files, and adds an `and` audio file where needed.
   *
   * @example
   * pluraliseAudioItems(['a', 'b', 'c']) // returns ['a', 'b', 'and', 'c']
   *
   * @example
   * pluraliseAudioItems(['a']) // returns ['a']
   *
   * @example
   * pluraliseAudioItems(['a', 'b']) // returns ['a', 'and', 'b']
   *
   * @param items Array of audio files
   * @returns Pluralised array of audio files
   */
  protected pluraliseAudio(items: AudioItem[], options: Partial<PluraliseOptions> = DefaultPluraliseOptions): AudioItem[] {
    const _options = { ...DefaultPluraliseOptions, ...options }

    const _items = items
      .map(item => {
        if (typeof item === 'string') {
          return { id: item }
        } else {
          return item
        }
      })
      .map((item, i) => {
        if (items.length - 1 === i) {
          if (_options.finalPrefix !== undefined) {
            item.id = `${_options.finalPrefix}${item.id}`
          }
        } else {
          if (_options.prefix !== undefined) {
            item.id = `${_options.prefix}${item.id}`
          }
        }

        if (i === 0 && _options.firstItemDelay !== undefined) {
          item.opts = {
            ...item.opts,
            delayStart: _options.firstItemDelay,
          }
        } else if (_options.beforeItemDelay !== undefined) {
          item.opts = {
            ...item.opts,
            delayStart: _options.beforeItemDelay,
          }
        }

        return item
      })

    if (_items.length > 1) {
      _items.splice(_items.length - 1, 0, { id: _options.andId, opts: { delayStart: _options.beforeAndDelay } })

      if (_options.afterAndDelay !== undefined || _options.beforeItemDelay !== undefined) {
        _items[_items.length - 1].opts ??= {}
        _items[_items.length - 1].opts!!.delayStart = _options.afterAndDelay ?? _options.beforeItemDelay
      }
    }

    console.log(options)
    console.log(_items)

    return _items
  }
}
