# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
yarn dev                  # Start Next.js dev server (webpack), port 3000
yarn build                # Build for production (static export when STATIC_EXPORT=true)
yarn format               # Format all files with Prettier
yarn format:check         # Check formatting without writing

yarn serve-audio          # Serve audio files locally on port 8088 (required for audio in dev)
yarn develop:workers      # Start Cloudflare Workers dev server on port 8787 (required for live trains & API)
```

There is no test suite in this project. Use `yarn build` to verify changes compile.

## Development Environment

Three services are needed for full local development:
1. `yarn dev` — Next.js dev server on port 3000
2. `yarn serve-audio` — HTTP server for audio files on port 8088. The dev audio CDN URL (`http://10.0.1.46:8088`) is hardcoded in `AnnouncementSystem.ts`
3. `yarn develop:workers` — Cloudflare Workers on port 8787 for API endpoints. Next.js proxies `/api/*` to this in dev (configured in `next.config.ts`)

Worker environment variables (`RTT_API_USERNAME`, `RTT_API_PASSWORD`, `RDM_*_API_KEY`) go in `.dev.vars`.

## Code Style

Prettier: no semicolons, single quotes, 145-character line width, trailing commas everywhere, arrow parens avoided. Run `yarn format` before committing. Emotion CSS-in-JS is used for component styling (via `css` prop, configured as the JSX pragma in `tsconfig.json`).

## Architecture

### Announcement System Class Hierarchy

All systems extend the abstract `AnnouncementSystem` base class in `src/announcement-data/AnnouncementSystem.ts`. Two intermediate base classes add domain-specific behaviour:

- **`StationAnnouncementSystem`** — for platform/station PA systems. Adds `showAudioNotExistsError(fileName)` for user-facing missing-audio alerts. Systems: AmeyPhil, AmeyCelia, ScotRail.
- **`TrainAnnouncementSystem`** — for on-train PA systems. Adds `validateStationExists(stationCrs, type?)` which checks high/low pitch audio availability via an `AvailableStationNames: { high: string[]; low: string[] }` property. Systems: BombardierXstar, ThameslinkClass700, TfWTrainFx, etc.
- Some systems (TfL Jubilee/Northern/Elizabeth lines) extend `AnnouncementSystem` directly.

Every system must define: `NAME`, `ID`, `FILE_PREFIX`, `SYSTEM_TYPE` (`'station'` | `'train'`), and populate `customAnnouncementTabs`.

Systems are registered in `src/announcement-data/AllSystems.ts` which exports `AllTrainAnnouncementSystems`, `AllStationAnnouncementSystems`, `AllOtherAnnouncementSystems`, and the combined `AllAnnouncementSystems`.

### Creating an Announcement System

A system class defines tabs, each with options and a play handler. The play handler reads option values, builds an `AudioItem[]` array of clip IDs, and calls `this.playAudioFiles(items)`. The pattern in every system:

```typescript
class MySystem extends TrainAnnouncementSystem {
  readonly NAME = 'Display Name'
  readonly ID = 'MY_SYSTEM_V1'
  readonly FILE_PREFIX = 'path/prefix'  // CDN subdirectory
  readonly SYSTEM_TYPE = 'train'

  readonly customAnnouncementTabs = {
    myTab: {
      name: 'Tab Name',
      component: CustomAnnouncementPane,
      props: {
        options: { /* option definitions */ },
        playHandler: this.playMyAnnouncement.bind(this),
      },
      defaultState: { /* initial option values */ },
    },
  }

  private async playMyAnnouncement(options: IMyOptions, download: boolean): Promise<void> {
    const files: AudioItem[] = []
    // ... build audio sequence from options ...
    await this.playAudioFiles(files, download)
  }
}
```

### Tabs & Options System

Each tab is a `CustomAnnouncementTab<OptionIds>` with one of two component types:

1. **`CustomAnnouncementPane`** — Options-driven UI. Props include:
   - `options`: Record of `OptionsExplanation` descriptors
   - `playHandler(options, download?)`: builds and plays audio from current state
   - `presets?`: array of built-in preset states
   - Personal preset support (save/load/delete via IndexedDB)
   - `importStateFromRttService?`: populate state from a Realtime Trains API response

2. **`CustomButtonPane`** — Button grid UI. Props include:
   - `buttons?` or `buttonSections?`: arrays of `CustomAnnouncementButton`
   - Each button has a `label` and either explicit `play`/`download` handlers or a `files: AudioItem[]` array (handlers auto-derived)

Option types: `select`, `multiselect`, `boolean`, `number`, `time`, `custom` (custom React component with state), `customNoState` (stateless component). All support `onlyShowWhen(activeState)` for conditional visibility. Options are rendered to UI by `src/helpers/createOptionField.tsx`.

### Audio Pipeline

**Flow:** user options → `AudioItem[]` → `playAudioFiles()` → `concatSoundClips()` → Crunker → Web Audio API

- `AudioItem` is either a string clip ID or `{ id: string, opts?: { delayStart: number, customPrefix?: string } }`
- Clip IDs use dot-notation (e.g. `station.BTN`) → CDN path `/{FILE_PREFIX}/station/BTN.mp3`
- `processAudioFileId()` can be overridden per-system to transform IDs before URL generation
- `pluraliseAudio(items, options?)` inserts "and" clips and applies delays between items in a list

**`MissingAudioMode`** controls behaviour when a clip can't be fetched:
- `skip-service` — abort the entire announcement (default)
- `play-silence` — silently omit the missing clip
- `repeat-last-station` — reuse the last station clip (matched by `station.` prefix) for missing station clips
- `repeat-last` — reuse the last successfully fetched clip of any type

### Crunker (Web Audio Wrapper)

`src/helpers/crunker.ts` — custom fork of the Crunker library with iOS/mobile enhancements.

**Singleton:** one instance lives on `window.__crunker`, accessed via `AnnouncementSystem.getCrunker()`. Never create instances directly.

**Key behaviours:**
- Sample rate: 48 000 Hz (configured at construction in `getCrunker()`)
- Lazy `AudioContext` creation (`_tryCreateContext` returns null instead of throwing if iOS blocks it pre-gesture)
- Auto-unlock on first user gesture (touchstart/touchend/click/keydown): plays a silent scratch buffer + calls `ctx.resume()` within the gesture handler
- `MediaStreamAudioDestinationNode` routing: audio is connected to a `MediaStreamDestination` feeding a hidden `<audio>` element, which tricks iOS Safari into allowing background playback (screen locked). A permanently-looping silent buffer keeps the stream alive between announcements. Falls back to direct `ctx.destination` when `MediaStreamAudioDestinationNode` is unavailable.
- Auto-suspend after 30 s of inactivity; auto-resume on next `play()` call
- Persistent `statechange` listener auto-resumes the context if it becomes `suspended` or `interrupted` (iOS) mid-playback
- `_cleanBuffer()` assigns a scratch buffer to finished sources on Apple devices for proper GC
- `play()` returns `CrunkerPlayResult { source, contextResume }` — `contextResume` is a promise that rejects after 1 s if the context stays suspended, so callers can show a "Resume audio" button
- SSR-safe: webpack's `null-loader` nullifies Crunker imports on the server (configured in `next.config.ts`)

### State Management

**Jotai atoms** in `src/atoms/index.ts`:
- `tabStateFamily(stateKey)` — per-tab option state, keyed as `${systemId}::${tabId}`. Returns `Record<string, unknown> | null`
- `selectedTabIdsState` — persisted to localStorage, maps `systemId` → selected `tabId`
- `isPlayingAnnouncementState` — global boolean preventing concurrent playback

**Persistence layers:**
- **localStorage** — selected tab per system
- **IndexedDB** — personal presets (`src/data/db/index.tsx`). Each preset has `presetId` (UUID), `name`, `systemId`, `tabId`, and the full state object
- **API (Cloudflare D1)** — shareable announcements. `SystemTabState` class (`src/data/SystemTabState.ts`) serialises state and saves/loads via `/api/save-announcement` and `/api/get-announcement`

### Pages & Routing

Next.js file-based routing under `src/pages/`. System pages live at:
- `/rolling-stock/{system-slug}` — train systems
- `/stations/{system-slug}` — station systems
- `/amey-live-train-announcements` — live departures page

All system pages use `SystemPageTemplate`, which instantiates the system class and renders `AnnouncementPanel`. `AnnouncementPanel` reads `customAnnouncementTabs`, renders tab navigation, initialises IndexedDB, and delegates to the appropriate pane component.

`SavedAnnouncementLoader` reads `?announcementId=` from the URL on mount, fetches the saved state from the API, navigates to the correct system page, and restores the state.

### Cloudflare Workers (API)

Functions in `functions/api/`:
- **`save-announcement.ts`** — `POST /api/save-announcement`. Validates body (100 kB state limit), stores in D1, returns UUID
- **`get-announcement.ts`** — `GET /api/get-announcement?id=<uuid>`. Fetches from D1, increments `load_count`
- **`get-service-rtt.ts`** — `GET /api/get-service-rtt?uid=<uid>&date=<date>`. Proxies Realtime Trains API with Basic Auth, enriches locations with CRS codes via tiploc mapping, recursively fetches associated (split/join) services
- **`get-services.ts`** — `GET /api/get-services?station=<crs>`. Fetches departure board from RDM API, processes service associations

### RTT Integration

`ImportStateFromRtt` component provides a dialog for pasting a Realtime Trains URL. It parses the UID and date, fetches the service via the Workers API, and calls the tab's `importStateFromRttService` function to populate option state from the live data.

`RttUtils` (`src/data/RttUtils.ts`) provides helpers: `getCallingPoints`, `getEligibleLocations`, `getCancelledCallingPoints`, `getScheduledDepartureTime`, `getRealtimeDepartureTime`, etc.

### Station Data

Station data comes from the `uk-railway-stations` npm package. `src/data/StationManipulators.ts` exports `AllStationsCrsToNameMap`, `AllStationsTitleValueMap`, `getStationByCrs()`, and `getStationByName()`.

`CallingAtSelector` (`src/components/CallingAtSelector.tsx`) is a drag-and-drop station picker used by most systems. Its `CallingAtPoint` type includes optional fields for short platforms, request stops, split details, and replacement bus continuations.

### Path Aliases

Configured in both `tsconfig.json` and `next.config.ts` webpack config:
- `@components` → `src/components`
- `@announcement-data` → `src/announcement-data`
- `@helpers` → `src/helpers`
- `@data` → `src/data`
- `@atoms` → `src/atoms`
- `@hooks` → `src/hooks`
- `@assets` → `src/assets`

### Global Window Properties

```typescript
window.__crunker    // Crunker singleton
window.__audio      // Currently playing AudioItem[] (set during playback, cleared on end)
window.__system     // Current AnnouncementSystem class
window.__audioDrivers // Record<systemId, AnnouncementSystem class> for all train systems
```

These are typed in `src/index.d.ts`.
