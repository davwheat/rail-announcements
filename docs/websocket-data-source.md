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
withdraws an announcement whose train is removed, cancelled, suppressed, replatformed or departed; that discards it from the queue, and stops it
if it has already started speaking. A revision replaces the details of one still waiting, so it announces the current time. Disconnect, recovery,
station/source/filter changes clear queued audio; reconnect does not replay it. Source/filter changes also stop audio from the previous WebSocket
session.

By default the station announces one train at a time. Select **Announce different platforms at the same time?** to give each platform its own
queue: announcements for different platforms then play together, while each platform still plays its own in turn. A fast-train warning holds
every platform it affects, and platforms that share a voice can still announce at the same time.

Existing per-platform voices, chimes, legacy TOC names, missing-audio preference, mind-the-gap and short-platform settings remain available.
Railway details are adapted directly from the message, including available split portions and via CRS codes. Missing associated-service data does
not cause a lookup. Passing messages use the selected platform voice's fast-train warning. Platform-alteration messages also have an adapter for
when the backend begins emitting them. An unsupported platform's audio is skipped rather than substituting another platform number, and a service
with no allocated platform is skipped for the same reason.

Production builds read `.env.production`, which sets `NEXT_PUBLIC_LIVE_SERVICE_URL` to `wss://darwinbrowser.com`. Neither variable holds a
secret, so both are committed. `NEXT_PUBLIC_LIVE_BOARD_URL` points at the raildotmatrix `/board` URL, which requires the matching raildotmatrix
branch to be deployed; point it at a `https://<branch>.raildotmatrix.pages.dev/board` preview to test before that branch merges. **Service URL**
is only shown in development builds. Existing saved URLs take precedence over new build defaults. Use HTTPS/WSS together for remote hosting;
local testing uses HTTP/WS.

Run `yarn test:live` for the reducer, reconnect, queue, expiry, withdrawal, revision and voice-adapter regressions. It uses Node's test runner
and Wrangler's existing esbuild compiler. Run `yarn build` for the production build.
