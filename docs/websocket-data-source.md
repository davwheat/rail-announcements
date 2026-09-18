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

Run `yarn test:live` for the reducer, reconnect, queue, expiry, withdrawal, revision and voice-adapter regressions. It uses Node's test runner
and Wrangler's existing esbuild compiler. Run `yarn build` for the production build.
