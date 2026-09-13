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

The client connects to `/v1/announcements/live?crs=...` for new triggers and `/v1/cis/live?crs=...` to validate queued announcements. The
embedded board opens its own CIS connection, with the same source mode and service URL. In this mode neither page requests train information from
the original APIs or from any other provider. Static station/audio mappings and audio asset downloads remain local client responsibilities.
Failed connections never switch to the original API.

Connecting establishes a silent baseline. Announcements are deduplicated and queued with a bound of 64 items. Their server expiry is checked on
receipt, before preparing audio and after loading clips. New standing/approaching messages supersede earlier pending stages. CIS removals,
cancellation, suppression and platform changes discard incompatible queued messages. Disconnect, recovery, station/source/filter changes clear
queued audio; reconnect does not replay it. Source/filter changes also stop audio from the previous WebSocket session.

Existing per-platform voices, chimes, legacy TOC names, missing-audio preference, mind-the-gap and short-platform settings remain available.
Railway details are adapted directly from the message, including available split portions and via CRS codes. Missing associated-service data does
not cause a lookup. Passing messages use the selected platform voice's fast-train warning. Platform-alteration messages also have an adapter for
when the backend begins emitting them. An unsupported platform's audio is skipped rather than substituting another platform number, and a service
with no allocated platform is skipped for the same reason.

To point at a remote service later, change **Service URL**, or set `NEXT_PUBLIC_LIVE_SERVICE_URL` before building. Set
`NEXT_PUBLIC_LIVE_BOARD_URL` to the deployed raildotmatrix `/board` URL when that branch is deployed. Existing saved URLs take precedence over
new build defaults. Use HTTPS/WSS together for remote hosting; local testing uses HTTP/WS.

Run `yarn test:live` for the reducer, reconnect, queue, expiry, departure, cancellation and voice-adapter regressions. It uses Node's test runner
and Wrangler's existing esbuild compiler. Run `yarn build` for the production build.
