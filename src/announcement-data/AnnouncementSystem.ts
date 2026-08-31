import Crunker from '../helpers/crunker'

import type { ICustomAnnouncementPaneProps } from '@components/PanelPanes/CustomAnnouncementPane'
import type { ICustomButtonPaneProps } from '@components/PanelPanes/CustomButtonPane'
import type React from 'react'
import { RttResponse } from '../api-types/get-service-rtt-types'

/**
 * Controls how missing audio files are handled during live announcements.
 *
 * - `skip-service`: Fail the entire announcement so it is not played (default behaviour for non-live).
 * - `play-silence`: Silently omit the missing clip and continue.
 * - `repeat-last-station`: Substitute a missing station-name clip with the last successfully fetched station-name clip (identified by `station.` prefix); other missing clips are omitted.
 * - `repeat-last`: Substitute any missing clip with the last successfully fetched clip of any type.
 */
export type MissingAudioMode = 'skip-service' | 'play-silence' | 'repeat-last-station' | 'repeat-last'

// Set audio session type as early as possible so the browser knows we intend playback
if (typeof window !== 'undefined' && 'audioSession' in window.navigator) {
  ;(window.navigator.audioSession as any).type = 'playback'
}

export interface IPlayOptions {
  delayStart: number
  customPrefix: string
}

/**
 * The option state of a single announcement tab: one entry per option shown in the tab's UI.
 *
 * State is serialised with `JSON.stringify` when a tab is saved as a personal preset or shared, so
 * every value must survive a JSON round trip.
 */
export type AnnouncementState = Record<string, any>

/**
 * Props that every `custom` option component receives, alongside its own `props`.
 *
 * `activeState` is optional so that components which ignore it still satisfy the option's type.
 */
export interface ICustomOptionComponentProps<Value, State extends AnnouncementState = AnnouncementState> {
  value: Value
  onChange: (value: Value) => void
  activeState?: State
}

interface IOptionsCommon<State extends AnnouncementState> {
  /**
   * Hides the option unless the tab's current state satisfies this predicate.
   */
  onlyShowWhen?: (activeState: State) => boolean
}

/**
 * Describes one option in an announcement tab.
 *
 * `Value` is the type of the state entry the option writes to, and rules out option types which
 * can't produce it: `select` needs a string entry, `boolean` a boolean one, and so on.
 */
export type OptionsExplanation<Value = any, State extends AnnouncementState = AnnouncementState> =
  | IMultiselectOptions<Value, State>
  | ISelectOptions<Value, State>
  | IBooleanOptions<Value, State>
  | INumberOptions<Value, State>
  | ITimeOptions<Value, State>
  | ICustomOptions<Value, State>
  | ICustomNoStateOptions<State>

type MultiselectValue<Value> = Extract<Value, readonly string[]>
type MultiselectItem<Value> = MultiselectValue<Value>[number]

interface IMultiselectOptions<Value, State extends AnnouncementState> extends IOptionsCommon<State> {
  name: string
  type: 'multiselect'
  default: MultiselectValue<Value>
  options: { title: string; value: MultiselectItem<Value> }[]
}

interface ISelectOptions<Value, State extends AnnouncementState> extends IOptionsCommon<State> {
  name: string
  type: 'select'
  default: Extract<Value, string>
  options: { title: string; value: Extract<Value, string> }[]
}

interface IBooleanOptions<Value, State extends AnnouncementState> extends IOptionsCommon<State> {
  name: string
  type: 'boolean'
  default: Extract<Value, boolean>
  disabled?: boolean | ((activeState: State) => boolean)
}

interface ITimeOptions<Value, State extends AnnouncementState> extends IOptionsCommon<State> {
  name: string
  type: 'time'
  default: Value extends string ? `${string}:${string}` : never
}

interface INumberOptions<Value, State extends AnnouncementState> extends IOptionsCommon<State> {
  name: string
  type: 'number'
  default: Extract<Value, number>
}

interface ICustomOptions<Value, State extends AnnouncementState> extends IOptionsCommon<State> {
  name: string
  type: 'custom'
  /**
   * Declared as a method so its props are compared bivariantly: a component may demand extra props
   * of its own, supplied through `props`, as long as it accepts the option's value type.
   */
  component(props: ICustomOptionComponentProps<Value, State>): React.ReactNode
  props?: object
  default: Value
}

interface ICustomNoStateOptions<State extends AnnouncementState> extends IOptionsCommon<State> {
  name?: string
  type: 'customNoState'
  /**
   * Declared as a method for the same reason as {@link ICustomOptions.component}.
   */
  component(props: { activeState: State }): React.ReactNode
  props?: object
}

/**
 * The option descriptors for a tab: one per key of the tab's state, plus any keys named in
 * `ExtraOptionIds`, which render UI without holding state of their own.
 */
export type TabOptions<State extends AnnouncementState, ExtraOptionIds extends string = never> = {
  [Key in keyof State]: OptionsExplanation<State[Key], State>
} & {
  [Key in ExtraOptionIds]: ICustomNoStateOptions<State>
}

export type AudioItem = string | AudioItemObject

export interface AudioItemObject {
  id: string
  opts?: Partial<IPlayOptions>
}

/**
 * Props which `AnnouncementPanel` supplies, rather than the announcement system itself.
 */
type PaneInjectedProps =
  | 'name'
  | 'systemId'
  | 'tabId'
  | 'isPersonalPresetsReady'
  | 'personalPresetsError'
  | 'savePersonalPreset'
  | 'getPersonalPresets'
  | 'deletePersonalPreset'
  | 'system'
  | 'defaultState'
  | 'importStateFromRttService'

/**
 * A tab of any shape, with its state type erased.
 *
 * Use it for collections holding a whole system's tabs, and declare each tab in the collection with
 * `satisfies CustomAnnouncementTab<...>` or `satisfies CustomButtonTab` so its own state type is
 * still checked.
 */
export interface AnyCustomAnnouncementTab {
  name: string
  component: React.ComponentType<any>
  props: object
  defaultState?: AnnouncementState
  importStateFromRttService?: (rttService: RttResponse, fromLocationIndex: number, existingOptions: any) => any
}

/**
 * An options-driven tab, rendered by `CustomAnnouncementPane`.
 *
 * `State` is the tab's option state, which types its options, presets, play handler and RTT import.
 * `ExtraOptionIds` names any `customNoState` options which render UI but hold no state.
 */
export interface CustomAnnouncementTab<
  State extends AnnouncementState = AnnouncementState,
  ExtraOptionIds extends string = never,
> extends AnyCustomAnnouncementTab {
  component: React.ComponentType<ICustomAnnouncementPaneProps<any>>
  props: Omit<ICustomAnnouncementPaneProps<State, ExtraOptionIds>, PaneInjectedProps>
  /**
   * Merged with any personal preset to allow migration if new features are added.
   */
  defaultState: State
  importStateFromRttService?: (rttService: RttResponse, fromLocationIndex: number, existingOptions: State) => State
}

/**
 * A tab of one-press announcement buttons, rendered by `CustomButtonPane`.
 */
export interface CustomButtonTab extends AnyCustomAnnouncementTab {
  component: React.ComponentType<ICustomButtonPaneProps>
  props: Omit<ICustomButtonPaneProps, 'system'>
  defaultState?: never
  importStateFromRttService?: never
}

/**
 * A constructible announcement system class.
 *
 * `typeof AnnouncementSystem` refers to the abstract base, which can't be instantiated; every
 * registered system can be, so components which construct one take this instead.
 */
export type AnnouncementSystemClass<System extends AnnouncementSystem = AnnouncementSystem> = new () => System

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

  /**
   * Short description of the announcement system, used for SEO meta tags.
   */
  readonly DESCRIPTION: string | undefined = undefined

  private static readonly SAMPLE_RATE = 44100

  /**
   * Returns the shared Crunker singleton, stored on `window` so
   * the AudioContext, unlock listeners and auto-suspend state
   * persist across the entire page lifecycle.
   */
  static getCrunker(): Crunker {
    if (!window.__crunker) {
      window.__crunker = new Crunker({ sampleRate: AnnouncementSystem.SAMPLE_RATE })
    }
    return window.__crunker
  }

  headerComponent(): React.ReactNode {
    return null
  }

  private readonly AUDIO_CDN = process.env.NODE_ENV === 'development' ? 'http://local.davw.network:8088' : 'https://cdn.railannouncements.co.uk'

  /**
   * Generates a URL for the provided audio file ID.
   */
  generateAudioFileUrl(fileId: string, customPrefix?: string): string {
    return `${this.AUDIO_CDN}/${customPrefix || this.FILE_PREFIX}/${this.processAudioFileId(fileId).replace(/\./g, '/')}.mp3`
  }

  /**
   * Plays multiple audio files.
   *
   * Returns a promise which resolves when the last audio file has finished playing.
   *
   * @param fileIds Array of audio files to play.
   * @param download Whether to save the concatenated audio to the device.
   * @param onPlaybackStart Called once the audio is audibly playing, so callers can start
   *   anything that has to stay in step with it.
   *
   * @returns Promise which resolves when the last audio file has finished playing.
   */
  async playAudioFiles(
    fileIds: AudioItem[],
    download: boolean = false,
    missingAudioMode: MissingAudioMode = 'skip-service',
    startDelay: number = 0,
    onPlaybackStart?: () => void,
  ): Promise<void> {
    if (fileIds.length === 0) {
      console.warn('No audio files to play.')
      return
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

    if (startDelay > 0 && standardisedFileIds.length > 0) {
      const first = standardisedFileIds[0]
      standardisedFileIds[0] = {
        ...first,
        opts: { ...first.opts, delayStart: (first.opts?.delayStart ?? 0) + startDelay },
      }
    }

    const crunker = AnnouncementSystem.getCrunker()
    const audio = await this.concatSoundClips(standardisedFileIds, missingAudioMode)

    if (audio.numberOfChannels > 1) {
      // This is stereo. We need to mux it to mono.
      audio.copyToChannel(audio.getChannelData(0), 1, 0)
    }

    if (download) {
      crunker.download(crunker.export(audio, 'audio/wav').blob, 'announcement')
      window.__audio = undefined
    } else {
      return new Promise<void>(resolve => {
        const { contextResume } = crunker.play(audio, source => {
          source.addEventListener('ended', () => {
            console.log('[Crunker] Finished playing audio')
            window.__audio = undefined
            resolve()
          })
        })

        contextResume.then(
          () => onPlaybackStart?.(),
          () => {},
        )

        contextResume.catch(err => {
          console.error('[Crunker]', err.message)

          document.getElementById('resume-audio-button')?.remove()

          const button = document.createElement('button')
          button.textContent = 'Resume audio'
          button.id = 'resume-audio-button'
          button.style.margin = '16px'
          button.onclick = () => {
            crunker.context.resume()
            button.remove()
          }

          const container = document.getElementById('resume-audio-container')
          if (container) container.appendChild(button)
          else document.body.appendChild(button)

          alert(
            "Your device or web browser is refusing to let the website play audio.\n\nThis is especially common on iPhones and iPads. We'd recommend you try using a desktop computer or an alternative device.\n\nTry scrolling to and pressing the 'Resume audio' button. If this doesn't help, there's nothing else that we can do. Sorry!",
          )

          button.scrollIntoView()
          resolve()
        })
      })
    }
  }

  async concatSoundClips(files: AudioItemObject[], missingAudioMode: MissingAudioMode = 'skip-service'): Promise<AudioBuffer> {
    const crunker = AnnouncementSystem.getCrunker()

    const filesWithUris: (AudioItemObject & { uri: string })[] = files.map(file => ({
      ...file,
      uri: this.generateAudioFileUrl(file.id, file?.opts?.customPrefix),
    }))

    let audioBuffers: AudioBuffer[]

    if (missingAudioMode === 'skip-service') {
      const audioBuffers_P = crunker.fetchAudio(...filesWithUris.map(file => file.uri))

      audioBuffers = (await audioBuffers_P).reduce((acc, curr, i) => {
        if (filesWithUris[i].opts?.delayStart!! > 0) {
          acc.push(this.createSilence(filesWithUris[i].opts!!.delayStart!!))
        }
        acc.push(curr)
        return acc
      }, [] as AudioBuffer[])
    } else {
      const results = await Promise.all(
        filesWithUris.map(async file => {
          try {
            const [buffer] = await crunker.fetchAudio(file.uri)
            return { buffer, file }
          } catch (e) {
            console.warn(`[AnnouncementSystem] Missing audio file (${missingAudioMode}): ${file.uri}`)
            return { buffer: null, file }
          }
        }),
      )

      let lastBuffer: AudioBuffer | null = null
      let lastStationBuffer: AudioBuffer | null = null
      audioBuffers = results.reduce((acc, { buffer, file }) => {
        const isStationClip = file.id.startsWith('station.')
        let resolved: AudioBuffer | null

        if (buffer !== null) {
          resolved = buffer
          lastBuffer = buffer
          if (isStationClip) lastStationBuffer = buffer
        } else if (missingAudioMode === 'repeat-last') {
          resolved = lastBuffer
        } else if (missingAudioMode === 'repeat-last-station') {
          resolved = isStationClip ? lastStationBuffer : null
        } else {
          resolved = null // play-silence
        }

        if (resolved === null) return acc
        if ((file.opts?.delayStart ?? 0) > 0) {
          acc.push(this.createSilence(file.opts!.delayStart!))
        }
        acc.push(resolved)
        return acc
      }, [] as AudioBuffer[])
    }

    if (audioBuffers.length === 0) {
      return this.createSilence(0)
    }

    return crunker.concatAudio(audioBuffers)
  }

  private createSilence(msLength: number): AudioBuffer {
    const msToLength = (ms: number) => Math.ceil((ms / 1000) * AnnouncementSystem.SAMPLE_RATE)

    return AnnouncementSystem.getCrunker().context.createBuffer(1, msToLength(msLength), AnnouncementSystem.SAMPLE_RATE)
  }

  /**
   * Processes an audio file ID before playing it.
   *
   * Defaults to the identity function.
   */
  protected processAudioFileId(fileId: string): string {
    return fileId
  }

  readonly customAnnouncementTabs: Record<string, AnyCustomAnnouncementTab> = {}

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
