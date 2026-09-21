# Live WebSocket train data

On **Amey Live Train Announcements**, select **Live WebSocket feed** under **Train data source**, then press **Start live trains**. **Original**
remains the default. The selection and service URL are saved on the device.

Local defaults:

| Component                     | URL                                                   |
| ----------------------------- | ----------------------------------------------------- |
| Darwin Browser                | `ws://localhost:8080`                                 |
| Embedded raildotmatrix board  | `http://localhost:8000/board`                         |
| Announcement development site | `http://localhost:3000/amey-live-train-announcements` |

Run the corresponding raildotmatrix feature branch on port 8000 and Darwin Browser with its movement backfill complete. Start this site with
`yarn dev`, which serves it on port 3000. Keep the existing local audio server running for clip playback.

The client opens one connection, `/v1/announcements/live?crs=...`, which carries triggers and the withdrawals and revisions that keep queued
audio honest. It asks for a 30-second heartbeat, so a quiet station is still told apart from a dead connection. The embedded board opens its own
CIS connection, with the same source mode and service URL. In this mode neither page requests train information from the original APIs or from
any other provider. Static station/audio mappings and audio asset downloads remain local client responsibilities. Failed connections never switch
to the original API.

Connecting establishes a silent baseline. Announcements are deduplicated and queued with a bound of 64 items. Their server expiry is checked on
receipt, before preparing audio and after loading clips. New standing/approaching messages supersede earlier pending stages. The service
withdraws an announcement whose train is removed, cancelled, suppressed, replatformed or departed; that discards it from the queue, and an
announcement that has already started speaking is left to finish, because a half-spoken announcement is heard as a broken station rather than as
a correction. Only two announcements cut a speaking one short: a platform alteration for the same train, whose platform is now the wrong one to
send anybody to, and a fast train warning for a platform that is reading disruption information. A revision replaces the details of one still
waiting, so it announces the current time. Disconnect, recovery, station/source/filter changes clear queued audio; reconnect does not replay it.
Source/filter changes also stop audio from the previous WebSocket session.

By default the station announces one train at a time. Select **Announce different platforms at the same time?** to give each platform its own
queue: announcements for different platforms then play together, while each platform still plays its own in turn. A fast-train warning holds
every platform it affects, and platforms that share a voice can still announce at the same time.

### Announcement zones

That setting also reveals **Announcement zones**, where platforms are grouped into the areas that can only speak one at a time. Every platform
starts in a zone of its own, which is the behaviour described above. Drag a platform onto another to put the two in one zone, or onto **Drop here
for a zone of its own** to separate it again; the whole chip is the drag handle, so a keyboard works too — tab to a platform, then space, arrow,
space. **Give every platform its own zone** undoes all the grouping for the station.

Spacing between the platform chips is a margin on each chip, never a `gap` on the row. A `Droppable` shifts its children by their margins while a
drag is in progress and cannot see the container's `gap`, so a gap is missing from the drag preview and appears all at once on release — the
chips settle touching each other and then jump apart. Keep the spacing on the chip if this is ever restyled.

A zone sits in the list under its lowest platform, and its platforms stay in the order they were dropped. Both are deliberate: re-sorting the
members would land a dragged platform somewhere other than where it was dropped, and naming a zone after anything else would move the surviving
row when two zones merge. Either one shows as the layout jumping the moment the drag is released.

Platforms in one zone take turns; separate zones speak together. A warning naming two platforms of the same zone holds that zone once rather than
twice, and one naming platforms in two zones holds both, as it always did. Zoning is saved per station on the device, under
`amey.live-trains.platform-zones`, and only the groupings are stored — a platform the save doesn't name gets a zone of its own, so a station
whose platforms change never leaves one unqueued. Zones group the station's own platforms, so they need the platform list described below;
without it every platform announces on its own.

## Station platform lists

The page reads `GET /v1/platforms?crs=` from the same service, over HTTP rather than WebSocket, whenever the station or service URL changes.
Darwin Browser answers it from Network Rail's SMART berth-stepping data, which maps every berth a train describer can report a train into, so it
lists the platforms a station has rather than only the ones a train is due at. This request runs in both data-source modes, and the settings are
saved on the device.

**Only show this station's platforms** narrows the per-platform voice list to that station: East Croydon shows six platforms instead of the full
seventy-seven. It's on by default. The bulk buttons — "Use _voice_ on all platforms", "Randomise (on)" and "All off" — act on the platforms
shown, so they configure the station in front of you. A voice already set on a hidden platform stays set, and a train that arrives there still
announces with it.

**Board layout** chooses between one board for the whole station and one board per platform. Per-platform boards render a grid of boards, one for
each platform SMART describes, each filtered to its own platform. The option needs a platform list, so it stays unavailable while the list is
loading or the service can't supply one. In the legacy polling mode, every board on the page receives the service data.

Anything other than a platform list means _unknown_, and the page narrows nothing: the service returns 404 for a station SMART doesn't describe,
503 while it's still loading the datasets, and an empty list for a station whose berths carry no platform. In each case the full platform list is
shown and one board per platform is unavailable. The page says only "We don't know which platforms this station has" — SMART, STANOX and the
`shared_with` codes mean nothing to someone choosing a voice, so none of them reach the UI.

Existing per-platform voices, chimes, legacy TOC names, missing-audio preference, mind-the-gap and short-platform settings remain available.
Railway details are adapted directly from the message, including available split portions and via CRS codes. Missing associated-service data does
not cause a lookup. Passing messages use the selected platform voice's fast-train warning. Select **Announce "fast train approaching"?** to end
that warning with the phrase; it is on by default. Selecting the **Daktronics/Data Display DMI** board type opens the warning with the British
Rail fanfare. The **Missing audio** preference governs fast-train warnings as it does every other type: a clip the CDN does not hold is reported
as a missing file, so the selected mode decides whether to substitute, omit or abandon it, and the log names the clip. A disruption reason the
voice cannot say is an exception: the announcement is said again without the reason rather than lost, and the log says so. Platform-alteration
messages also have an adapter for when the backend begins emitting them. An unsupported platform's audio is skipped rather than substituting
another platform number, and a service with no allocated platform is skipped for the same reason.

Production builds read `.env.production`, which sets `NEXT_PUBLIC_LIVE_SERVICE_URL` to `wss://darwinbrowser.com`. Neither variable holds a
secret, so both are committed. `NEXT_PUBLIC_LIVE_BOARD_URL` points at the raildotmatrix `/board` URL, which requires the matching raildotmatrix
branch to be deployed; point it at a `https://<branch>.raildotmatrix.pages.dev/board` preview to test before that branch merges. **Service URL**
is only shown in development builds. Existing saved URLs take precedence over new build defaults. Use HTTPS/WSS together for remote hosting;
local testing uses HTTP/WS.

## Wire format

The streams are Darwin Browser's protocol version 2: every frame is a protobuf message, defined in that repository's
`proto/darwin/live/v2/live.proto` and described in its `docs/live/protocol.md`. `src/live/wire.ts` decodes each frame into the types in
`src/live/types.ts`, which the rest of the page reads, so `null` still means unknown there. A text frame means a version 1 service, and the
connection is closed and retried rather than read. A message this build doesn't know is ignored, and still counts as proof that the connection is
alive.

`src/live/gen` is generated and `src/live/wire.ts` is shared with the other website, so don't edit either here. To pick up a schema change, run
`buf generate ../darwin-browser/proto` with Darwin Browser checked out beside this repository, then copy `docs/live/examples/wire.ts`, with its
type import pointed at `./types`, and the fixtures in `docs/live/fixtures` that `tests/fixtures` holds. Keep the plugin version in `buf.gen.yaml`
no newer than the `@bufbuild/protobuf` version in `package.json`. The `.pb` fixtures are frames written by the service's own encoder, and the
tests check that this decoder reads each one as the JSON beside it.

### Audio rendered by the service

An announcement can arrive with audio that the service has already rendered. The page then plays that audio once, in place of assembling the
announcement from a platform voice's clips, and the queue treats it like any other announcement: it waits its turn, expires, and is withdrawn the
same way. A revision replaces the audio together with the details. A revision without audio discards the audio that the page holds, and the
announcement is assembled from the revised details instead.

The service sends audio only to a connection that asks for it with `audio=mp3`, which `connectAnnouncements` does when its `serviceAudio`
argument is true. Nothing sets it: the service has no renderer, and its audio would replace the voices chosen on the page, so turning it on is a
setting for the listener to choose.

## Announcements streamed from the announcement service

With **Announcement audio** set to **Streamed from the announcement service**, the live trains page doesn't build announcements. The announcement
service (`../rail-announcements-backend`) listens to the same feed, builds each announcement from the same recordings, and serves the audio as a
live stream. The page doesn't open the announcement stream in this mode, and its queue stays empty.

`src/live/audioStreams.ts` asks for one stream for the whole station, and `AnnouncementStreams` plays it through one audio element. The stream's
URL lists the announcement zones that have a voice. The service lets zones speak over each other and mixes them, and the platforms within a zone
take turns, which is what the page's own queue does. With zones turned off, or at a station whose platforms aren't known, the whole station takes
turns. The URL also carries each platform's voice, the announcement types and the preferences, so changing any of them starts a different stream.

One stream and one element is what keeps announcements playing in a background tab: the browser plays a URL by itself, and no script has to keep
running. Every browser plays the one endless MP3 response (`live.mp3`), the way it plays internet radio. The service also serves the same audio
as an HLS playlist, which the page leaves alone: a browser's claim to play HLS is unreliable — Firefox says it can, starts, then fails part-way
through an announcement for want of a decoder — and a browser that can't play a playlist itself needs a script to feed it segments, which a
background tab throttles. A listener hears an announcement about two seconds after the service starts it.

The page works out how far behind the MP3 player is from the clock: the service sends audio as it's made, so the player starts 3 seconds behind
and falls further behind only by stalling or pausing. The browser's buffered range can't show this lag, because Chrome reads only a couple of
seconds ahead and leaves the rest of a backlog in the network buffers. When the player is more than 10 seconds behind, the page starts the stream
again, which drops the audio in between. It checks every 10 seconds, and also when the player starts playing, so a listener who resumes after a
long pause, or plays the stream long after the browser refused to autoplay it, doesn't hear out-of-date announcements first. A player that runs
dry and stays that way for 4 seconds also starts the stream again, because a browser that runs dry on a live response can wait many seconds for
audio that never arrives faster than real time. Either way the page starts the stream at most once a minute: a player that's behind again that
soon needs a deeper buffer or a faster network, which another response doesn't supply.

Set `NEXT_PUBLIC_ANNOUNCEMENT_SERVICE_URL` to the service's URL. A production build offers the **Announcement audio** setting only when this is
set, and ignores a saved choice of streamed audio without it, so the page never tries to stream from a service that isn't deployed. In
development, the **Announcement service URL** setting overrides it, and the default is `http://localhost:8090`.

### The same setting, for the rest of the site

**Announcement audio** is one setting for the whole site, held in `serviceAudioState` and also shown as a checkbox in the footer. With it on, a
tab asks the service to build its announcement: the pane names the tab and its state on `AnnouncementSystem.serviceRequest`, and `playAudioFiles`
posts them to `POST /v1/announcements` and plays or saves the MP3 in place of the clips it was given. `src/live/announcementService.ts` holds
that client.

The player reads the request, rather than the pane calling the service, so that the tab's play handler still runs: the handler is what refuses a
state it cannot announce, and what keeps the Piccadilly line's passenger information display in step with the audio. Button tabs are built the
same way, from a state of `{ section, label }` naming the heading the button sits under and the button itself.

Every system registered in `src/announcement-data/AllSystems.ts` is ported, and `GET /v1/systems` says which tabs the service knows. The page
asks once, and builds a tab the service doesn't know without a request. If the service can't be reached, or refuses the state, the page also
builds the announcement itself, so the setting never costs a listener the announcement. A download from the service is an MP3, where the page's
own is a WAV.

### The Help point tab

The Phil Sayer and Celia Drummond system pages have a **Help point** tab, which draws the yellow information point found on station platforms.
Pressing its button asks the service for `GET /v1/help-points/CRS?voice=phil` or `voice=celia`, and the response is an MP3 of the station's
departure board, spoken from live running information. `renderHelpPoint` in `src/live/announcementService.ts` makes the request, and
`src/components/PanelPanes/HelpPointPane.tsx` plays the MP3 through `playRenderedAudio`, the way that the page plays any audio the service
renders.

The tab builds nothing itself and has no play handler. The wording lives only in the service, in `internal/helppoint`, so
`npm run export:backend` has no cases for the tab and there is nothing to port. A production build registers the tab only when
`NEXT_PUBLIC_ANNOUNCEMENT_SERVICE_URL` is set, because the tab has nothing to say without the service.

The station list is the voice's own, and the chosen station is saved on the device under `help-point.selected-crs`. While the service reads the
board and while the announcement plays, the button ignores presses, as the button on a platform does. A board that the service can't read still
plays: the service answers with a spoken apology. The tab shows a message of its own only when the service can't be reached, or when the live
feed has no such station.

### Keep the service's copy of the logic in step

The service holds a Go port of every registered system, of `src/live/playAnnouncement.ts` and of `src/live/playbackQueue.ts`, and this repository
is the reference for all of it. `npm run export:backend` runs every tab of every registered system through its real play handler — over the tab's
default state, its presets, every value of every dropdown, generated lists for custom options such as calling points, and seeded random mixes —
and runs the Amey voices over captured movements as well. It writes each system's own data tables, the voices' tables and the expected clips into
`../rail-announcements-backend`, whose tests replay about 41,000 cases. After you change any system's play handler, or how a live announcement is
worded, queued or interrupted, run the export and port the change there. `tests/backend-parity` holds the generator: `systems.ts` covers the
systems, and `generate.ts` the Amey voices, the queue and the data they read.

Run `yarn test:live` for the decoder, reducer, reconnect, queue, expiry, withdrawal, revision, rendered-audio, stream URL and voice-adapter
regressions. It uses Node's test runner and Wrangler's existing esbuild compiler. Run `yarn build` for the production build.
