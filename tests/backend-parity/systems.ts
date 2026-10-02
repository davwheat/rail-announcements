/**
 * Expected output for every registered announcement system, for rail-announcements-backend's Go
 * ports to be held to. Nothing here knows any one system: a tab's states come from its own
 * defaults, presets and option descriptors, and a button tab's come from its buttons.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'
import { AllAnnouncementSystems } from '../../src/announcement-data/AllSystems'
import AnnouncementSystem from '../../src/announcement-data/AnnouncementSystem'
import type { AudioItem, CustomAnnouncementButton, MissingAudioMode } from '../../src/announcement-data/AnnouncementSystem'
import { AllStationsTitleValueMap } from '../../src/data/StationManipulators'

interface Plan {
  clips: { id: string; delay: number; prefix: string }[]
  startDelay: number
  missingAudioMode: MissingAudioMode
}

interface Case {
  tab: string
  /** The tab's option state, or `{ section, label }` for a button. */
  state: unknown
  /** One plan for each time the handler asked for audio to be played. */
  calls: Plan[]
  /**
   * What the handler alerted or threw. A handler which alerts and plays anyway is not refusing:
   * the alert is recorded alongside the plan, and the plan is the expected outcome.
   */
  error: string | null
}

const STATES_PER_TAB = 3600
const RANDOM_MIXES = 240

/**
 * A select of up to this many choices is tried whole, which covers a station list and so the rules
 * keyed on one station. Only the national station lists are longer, and those are sampled.
 */
const SELECT_IN_FULL = 600
const SELECT_SPREAD = 100
const SELECT_PICKS = 60

/** The lengths at which a custom option holding a list of stops is tried. */
const LIST_LENGTHS = [1, 2, 3, 6]

/** A small seeded generator, so that the export is the same on every run. */
function random(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hash(text: string): number {
  let value = 2166136261
  for (const char of text) value = Math.imul(value ^ char.charCodeAt(0), 16777619)
  return value >>> 0
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value, (key, entry) => (key === 'randomId' ? 'id' : entry)))
}

function sample<T>(items: T[], count: number): T[] {
  if (items.length <= count) return items
  return Array.from({ length: count }, (_, index) => items[Math.floor((index * (items.length - 1)) / (count - 1))])
}

function picks<T>(items: T[], count: number, next: () => number): T[] {
  return Array.from({ length: count }, () => items[Math.floor(next() * items.length)])
}

function distinctPicks<T>(items: T[], count: number, next: () => number): T[] {
  const out: T[] = []
  const wanted = Math.min(count, new Set(items).size)
  while (out.length < wanted) {
    const item = items[Math.floor(next() * items.length)]
    if (!out.includes(item)) out.push(item)
  }
  return out
}

function unique<T>(items: T[]): T[] {
  const seen = new Set<string>()
  return items.filter(item => {
    const key = JSON.stringify(item)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

interface Choice {
  key: string
  /** Values tried one at a time against the tab's default state. */
  values: unknown[]
  /** Everything the option can hold, which the random mixes draw from. */
  pool: unknown[]
}

/** Every choice where that is affordable, and a dense sample where it is not. */
function trials(all: unknown[], next: () => number): unknown[] {
  if (all.length <= SELECT_IN_FULL) return all
  return unique([...sample(all, SELECT_SPREAD), ...picks(all, SELECT_PICKS, next)])
}

/** An option short enough that the mixes can draw from the same list the single states are tried at. */
const fixed = (values: unknown[]): Omit<Choice, 'key'> => ({ values, pool: values })

/** The stops a calling-point selector offers, named as the selector itself names them. */
function stopChoices(props: any): { title: string; value: string }[] {
  const available = new Set<string>(Array.isArray(props.availableStations) ? props.availableStations : [])
  const choices = AllStationsTitleValueMap.filter(entry => available.has(entry.value))
  if (!Array.isArray(props.additionalOptions)) return choices
  return [...choices, ...props.additionalOptions].sort((a, b) => a.title.localeCompare(b.title))
}

/**
 * Calling-point lists for a selector, covering each shape its props enable: a plain list at several
 * lengths, then request stops, short platforms, divisions and rail replacement continuations.
 */
function stopLists(props: any, next: () => number): unknown[] {
  const choices = stopChoices(props)
  if (choices.length === 0) return []

  const stop = (extra: Record<string, unknown>) => {
    const choice = choices[Math.floor(next() * choices.length)]
    return { crsCode: choice.value, name: choice.title, randomId: choice.value, ...extra }
  }
  const list = (length: number, extras: Record<string, unknown>[] = []) => Array.from({ length }, (_, index) => stop(extras[index] ?? {}))

  const lists: unknown[] = LIST_LENGTHS.map(length => list(length))

  if (props.enableRequestStops) {
    lists.push(list(3, [{}, { requestStop: true }]))
    lists.push(list(3, [{ requestStop: true }, { requestStop: true }, { requestStop: true }]))
  }

  const shortPlatforms: string[] = Array.isArray(props.enableShortPlatforms) ? props.enableShortPlatforms.map((entry: any) => entry.value) : []
  for (const shortPlatform of sample(shortPlatforms, 4)) lists.push(list(3, [{}, { shortPlatform }]))
  if (shortPlatforms.length > 0)
    lists.push(
      list(
        3,
        sample(shortPlatforms, 3).map(shortPlatform => ({ shortPlatform })),
      ),
    )

  const splitForms: string[] = Array.isArray(props.enableSplits) ? props.enableSplits.map((entry: any) => entry.value) : []
  for (const splitForm of sample(splitForms, 3)) {
    for (const splitType of ['splits', 'splitTerminates']) lists.push(list(3, [{}, { splitType, splitForm, splitCallingPoints: list(2) }]))
  }
  if (splitForms.length > 0) {
    // A division with nothing behind it, and one whose own calling points carry the same extras.
    lists.push(list(1, [{ splitType: 'splits', splitForm: splitForms[0], splitCallingPoints: [] }]))
    const inner = list(3, [
      props.enableRequestStops ? { requestStop: true } : {},
      shortPlatforms.length > 0 ? { shortPlatform: shortPlatforms[0] } : {},
    ])
    lists.push(list(2, [{}, { splitType: 'splits', splitForm: splitForms[splitForms.length - 1], splitCallingPoints: inner }]))
  }

  if (props.enableRrbContinuations) {
    lists.push(list(5, [{}, { continuesAsRrbAfterHere: true }]))
    lists.push(list(5, [{}, { continuesAsRrbAfterHere: true }, {}, { continuesAsTrainAfterHere: true }]))
    lists.push(list(1, [{ continuesAsRrbAfterHere: true }]))
  }

  return lists
}

/** Lists of codes for a picker which offers its own choices, at every length it allows. */
function codeLists(props: any, next: () => number): unknown[] {
  const values: string[] = props.options.map((entry: any) => entry.value)
  const max = typeof props.max === 'number' ? props.max : 3
  const lists: unknown[] = []
  for (let length = 1; length <= max; length++) {
    lists.push(distinctPicks(values, length, next), distinctPicks(values, length, next))
  }
  return unique(lists)
}

/** The choices a sibling select offers for the same kind of value, which a one-item option names. */
function siblingValues(option: any, options: Record<string, any>): unknown[] {
  const found = new Set<string>()
  for (const sibling of Object.values<any>(options)) {
    if (sibling?.type !== 'select') continue
    const values: unknown[] = sibling.options.map((entry: any) => entry.value)
    if (!values.includes(option.default)) continue
    for (const value of values) if (typeof value === 'string') found.add(value)
  }
  return [...found]
}

/**
 * Values for a `custom` option, from the option's own props and default. A component holding a list
 * of stops takes them from the stations it offers, and one holding a list of codes from its own
 * choices. A component naming a single item narrows a longer list itself and cannot be run here, so
 * it takes the choices of the sibling select which already offers its default.
 */
function customValues(option: any, options: Record<string, any>, next: () => number): Omit<Choice, 'key'> {
  const props: any = option.props ?? {}
  if (Array.isArray(option.default)) {
    if (Array.isArray(props.availableStations) || Array.isArray(props.additionalOptions)) return fixed(stopLists(props, next))
    if (Array.isArray(props.options)) return fixed(codeLists(props, next))
  }
  if (typeof option.default === 'string') {
    const all = siblingValues(option, options)
    return { values: trials(all, next), pool: all }
  }
  return fixed([])
}

/** Values worth trying for one option, read from its own descriptor. */
function valuesFor(option: any, options: Record<string, any>, next: () => number): Omit<Choice, 'key'> {
  switch (option?.type) {
    case 'boolean':
      return fixed([true, false])
    case 'select': {
      // A rule can turn on one particular station, platform or reason, so try each choice rather
      // than a handful of them.
      const all: unknown[] = option.options.map((entry: any) => entry.value)
      return { values: trials(all, next), pool: all }
    }
    case 'multiselect': {
      const all: unknown[] = option.options.map((entry: any) => entry.value)
      return fixed([[], all.slice(0, 1), all, all.filter(() => next() < 0.4)])
    }
    case 'number':
      return fixed([0, 1, 2, 5, 12, 37])
    case 'time':
      return fixed(['00:00', '07:05', '12:30', '23:59'])
    case 'custom':
      return customValues(option, options, next)
    default:
      return fixed([])
  }
}

function statesFor(tab: any, seed: string): unknown[] {
  const base = tab.defaultState
  if (!base) return []
  const next = random(hash(seed))
  const options: Record<string, any> = tab.props.options || {}
  const presets: unknown[] = (tab.props.presets || []).map((preset: any) => ({ ...base, ...preset.state }))
  const states: unknown[] = [base, ...presets]

  const choices: Choice[] = Object.entries(options)
    .map(([key, option]) => ({ key, ...valuesFor(option, options, next) }))
    .filter(choice => choice.values.length > 0)

  // One option at a time, round by round: a cap then trims every option evenly instead of leaving
  // the last of them at its default.
  const longest = Math.max(0, ...choices.map(choice => choice.values.length))
  for (let index = 0; index < longest; index++) {
    for (const choice of choices) if (index < choice.values.length) states.push({ ...base, [choice.key]: choice.values[index] })
  }

  // Options interact, so also try them together, starting from a preset as often as from the default.
  for (let index = 0; index < RANDOM_MIXES && choices.length > 0; index++) {
    const mixed: Record<string, unknown> = { ...(states[Math.floor(next() * (1 + presets.length))] as object) }
    for (const choice of choices) if (next() < 0.5) mixed[choice.key] = choice.pool[Math.floor(next() * choice.pool.length)]
    states.push(mixed)
  }

  const seen = new Set<string>()
  return states
    .map(clone)
    .filter(state => {
      const key = JSON.stringify(state)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .slice(0, STATES_PER_TAB)
}

const alerts: string[] = []

let calls: Plan[] = []

/**
 * Replaces the player for every system. It has to be the base class's method, and in place before
 * any system is constructed: some buttons bind `this.playAudioFiles` as they are built, which
 * would otherwise hold on to the real player.
 */
function recordPlays() {
  AnnouncementSystem.prototype.playAudioFiles = async function (
    files: AudioItem[],
    _download = false,
    missingAudioMode: MissingAudioMode = 'skip-service',
    startDelay = 0,
  ) {
    calls.push({
      clips: files.map(file =>
        typeof file === 'string'
          ? { id: file, delay: 0, prefix: '' }
          : { id: file.id, delay: file.opts?.delayStart ?? 0, prefix: file.opts?.customPrefix ?? '' },
      ),
      startDelay,
      missingAudioMode,
    })
  }
}

async function capture(run: () => Promise<void> | void): Promise<Pick<Case, 'calls' | 'error'>> {
  calls = []
  alerts.length = 0
  try {
    await run()
  } catch (error) {
    return { calls, error: error instanceof Error ? error.message : String(error) }
  }
  return { calls, error: alerts.length ? alerts[0] : null }
}

/**
 * Data as the backend reads it: without the code, the React elements or anything cyclic. A preset's
 * calling points carry a fresh `randomId` on every construction, so they are normalised as the
 * recorded states are, and the export stays the same from one run to the next.
 */
function serialise(value: unknown): unknown {
  const text = JSON.stringify(value, (key, entry) =>
    key === 'randomId' ? 'id' : typeof entry === 'function' || entry?.$$typeof ? undefined : entry,
  )
  return text === undefined ? undefined : JSON.parse(text)
}

/** Everything a system holds that is data: its fields and getters, without its tabs or its code. */
function instanceData(system: AnnouncementSystem): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  const skip = new Set(['customAnnouncementTabs', 'constructor'])
  for (let target: any = system; target && target !== Object.prototype; target = Object.getPrototypeOf(target)) {
    for (const [name, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(target))) {
      if (skip.has(name) || name in out) continue
      let value: unknown
      try {
        value = descriptor.get ? descriptor.get.call(system) : descriptor.value
      } catch {
        continue
      }
      if (typeof value === 'function' || value === undefined) continue
      try {
        const data = serialise(value)
        if (data !== undefined) out[name] = data
      } catch {
        // Not data: a cycle, or something that refuses to be serialised.
      }
    }
  }
  return out
}

/** The directory of a system's Go package: its ID in lower case, without the version or underscores. */
export function packageName(id: string): string {
  return id
    .replace(/_V\d+$/i, '')
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase()
}

export async function exportSystems(backend: string, moduleData: Record<string, unknown>): Promise<string[]> {
  Object.assign(globalThis, { alert: (message: string) => alerts.push(String(message)), confirm: () => true })
  recordPlays()
  const summary: string[] = []

  for (const SystemClass of AllAnnouncementSystems) {
    const system = new SystemClass()
    const tabs: { id: string; name: string; kind: 'options' | 'buttons' }[] = []
    const cases: Case[] = []
    // A button always plays the same clips, so a button tab is data and no port has to write it:
    // tab ID -> section -> label -> what it plays.
    const buttonPlans: Record<string, Record<string, Record<string, Plan>>> = {}

    for (const [tabId, tab] of Object.entries<any>(system.customAnnouncementTabs)) {
      if (typeof tab.props?.playHandler === 'function') {
        tabs.push({ id: tabId, name: tab.name, kind: 'options' })
        for (const state of statesFor(tab, `${system.ID}/${tabId}`)) {
          cases.push({ tab: tabId, state, ...(await capture(() => tab.props.playHandler(clone(state)))) })
        }
        continue
      }

      const sections: Record<string, CustomAnnouncementButton[]> = { ...(tab.props?.buttonSections || {}) }
      if (tab.props?.buttons?.length) sections.Announcements = [...(sections.Announcements || []), ...tab.props.buttons]
      if (Object.keys(sections).length === 0) continue
      tabs.push({ id: tabId, name: tab.name, kind: 'buttons' })
      for (const [section, buttons] of Object.entries(sections)) {
        for (const button of buttons) {
          const play = 'play' in button ? button.play : () => system.playAudioFiles(button.files!)
          const played = await capture(play)
          cases.push({ tab: tabId, state: { section, label: button.label }, ...played })
          if (played.calls.length === 1) ((buttonPlans[tabId] ??= {})[section] ??= {})[button.label] ??= played.calls[0]
        }
      }
    }

    const directory = join(backend, 'internal/systems', packageName(system.ID))
    mkdirSync(join(directory, 'testdata'), { recursive: true })
    mkdirSync(join(directory, 'data'), { recursive: true })
    const header = { id: system.ID, name: system.NAME, filePrefix: system.FILE_PREFIX, type: system.SYSTEM_TYPE, tabs }
    writeFileSync(join(directory, 'testdata/parity.json.gz'), gzipSync(JSON.stringify({ system: header, cases }) + '\n', { level: 9 }))
    writeFileSync(join(directory, 'data/instance.json'), JSON.stringify(instanceData(system), null, 1) + '\n')
    writeFileSync(join(directory, 'data/buttons.json'), JSON.stringify(buttonPlans) + '\n')
    if (moduleData[system.ID])
      writeFileSync(join(directory, 'data/module.json'), JSON.stringify(serialise(moduleData[system.ID]), null, 1) + '\n')

    const multi = cases.filter(entry => entry.calls.length > 1).length
    const silent = cases.filter(entry => entry.calls.length === 0 && !entry.error).length
    const refused = cases.filter(entry => entry.calls.length === 0 && entry.error).length
    const alerted = cases.filter(entry => entry.calls.length > 0 && entry.error).length
    summary.push(
      `${packageName(system.ID).padEnd(22)} ${String(tabs.length).padStart(2)} tabs ${String(cases.length).padStart(5)} cases` +
        ` (${refused} errors, ${silent} silent, ${alerted} alerted but played, ${multi} with more than one play)`,
    )
  }
  return summary
}
