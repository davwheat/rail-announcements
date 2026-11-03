# CLAUDE.md

This service speaks station announcements: it reads Darwin Browser's protobuf
announcement stream, builds announcements from the website's recordings, and
serves them as one mixed stream for each listener, as HLS
(`GET /v1/streams/live.m3u8`) or as an endless MP3 response (`live.mp3`). It
also renders one MP3 for a posted tab state (`POST /v1/announcements`), for
every system the website registers, and speaks a station's departure board the
way a help point does (`GET /v1/help-points/CRS`). Read `README.md` for the API
and `docs/architecture.md` for the design and the decisions.

This directory, `backend/`, is the service. The rest of the repository is the
website, which the root `CLAUDE.md` covers. A path here is relative to
`backend/`, and a path into the website starts with `../`.

## Rules that aren't obvious

- **The website is the reference for announcement logic.** Every package under
  `internal/systems`, plus `internal/ketech` and `internal/queue`, is a port of
  the website's TypeScript (`../src`). Don't change their behavior here first:
  change the TypeScript, run `npm run export:backend` at the repository's root
  (not `yarn`: the root `CLAUDE.md` forbids it), and port until `go test ./...`
  passes.
  The quirks are deliberate. For example, Celia's named Great Western services
  are matched case-sensitively, and a short platform's wording uses the end
  inflection where the middle one looks right. A port reproduces an `alert()`
  message word for word, because the record holds it.
- **A recorded plan wins over a recorded alert.** A case holds both what the
  handler played and what it alerted. A handler that alerts and plays anyway
  hasn't refused the state — the website shows that alert itself and asks this
  service only for the audio — so the port has to build the plan. Only a case
  that played nothing expects a refusal.
- **Every planned clip must have a recording.** The parity tests fail for a
  clip that has none, because a listener who skips services with missing audio
  loses the whole announcement. There's no list of exceptions: fix the wording
  or the option in the website, or stop offering it, and export again. Only
  station names in the live record are exempt, because the feed names stations
  that nobody recorded.
- **`internal/helppoint` isn't a port.** The website's Help point tab plays the
  endpoint and builds nothing itself, so the wording is decided here and that
  package can change first. It speaks in either voice (`?voice=phil|celia`). It answers a
  failure to read the board with a spoken apology and status `200`, on purpose:
  an `<audio>` element plays nothing for an error status.
- **To add or change a system**, work in the website first: register it in
  `../src/announcement-data/AllSystems.ts` (and name its module in
  `../tests/backend-parity/generate.ts` if it keeps constants beside its class),
  run the export, write `internal/systems/PKG` to the shape of the other
  ports, and add it to `All` in `internal/system/system.go`. `PKG` is the
  system's ID in lower case without the version or the underscores. See
  "Keep the port in step with the website" in `README.md`.
- **Don't edit** `internal/ketech/data/`, `internal/systems/*/data/`,
  `internal/systems/shared/data/`, `internal/systems/*/testdata/` or
  `internal/*/testdata/parity-*` (the export writes them all), or
  `internal/feed/livepb/` (generated from the feed's protobuf schema, which
  isn't in this repository).
- **`queue.Queue` isn't safe for concurrent use.** `stream.Stream.run` is its
  only caller, on one goroutine. `start` callbacks must not call back into the
  queue: the stream collects started playbacks and handles them after the call
  returns.
- **A stream's queue hears the whole station.** An announcement for platforms
  outside the stream takes no lane but can still cut short or supersede one of
  the stream's. Each zone of the stream is one lane, and the mixer sums them.
- **Every stream URL carries `crs`, segment URLs included.** Production runs two
  replicas, a stream lives in one replica's memory, and the proxy routes stream
  requests by that parameter (`deploy/Caddyfile`). A new stream endpoint that
  lacks it would be sent to either replica.
- **A playlist's numbers come from the clock, and never from the stream's own
  start.** A restarted stream keeps its URL, and a player that is still polling
  reads its playlist as the old stream's next version. So a segment's sequence
  number, timestamp and date come from its place in the time since the Unix
  epoch, and `EXT-X-DISCONTINUITY-SEQUENCE` is different for each start. Count
  any of them from zero and AVPlayer stays silent for as long as the old stream
  had run. Don't use the first sequence number as the discontinuity sequence
  either: hls.js walks an array that long after every reload. See "A restarted
  stream keeps its place" in `docs/architecture.md`.
- **A silent MP3 frame is left out only when nothing reads from it.** A
  listener that is behind asks for silence to be left out of its response
  (`POST /v1/streams/trim`). A Layer III frame of speech keeps its audio in up
  to 511 bytes of the frames before it, so `hls.Broadcast` always sends the
  last frames of a silence, and counts a silence only once it has lasted two
  seconds, which is longer than any pause inside an announcement. Drop a frame
  next to speech and the speech loses its first syllable:
  `TestLeavingSilenceOutLosesNoSpeech` fails when that happens.
- **A push to `deploy` deploys to production.** It always deploys the website,
  and it deploys this service when it changes `backend/` or `../audio/`:
  `../.github/workflows/backend.yml` tests the service, and then runs
  `deploy/deploy.sh COMMIT` on the host over SSH. Don't push to that branch
  unless you're asked to deploy.
- **The endless response is MP3 on purpose.** AAC silence is about 500 bytes a
  second, and Chrome never starts playing a response that slow. Don't switch it
  to AAC to save an encoder.
- **The mixer catches up after a late tick instead of dropping audio.** An MP3
  listener holds the three seconds the response opened with, and a constant bit
  rate stream never refills them, so a second the mixer skips is a second that
  listener loses for the rest of the response — Firefox then waits about
  fifteen seconds to rebuffer. A late tick writes everything due in one block,
  up to `maxCatchUp` (ten seconds of audio), and warns that it was late; past
  that bound the clock jumped, and the audio dropped is logged. Don't reinstate
  the drop as an optimization. For the same reason clip decoding is three
  ffmpeg processes at nice 10, out of the encoders' way.
- **Logging** is `internal/logging`, a small logrus wrapper whose error methods
  take the error first. **Config** is Viper with validator tags. `config.toml` is gitignored, and
  production reads `deploy/config.toml`.
- **The recordings are `../audio/`**, and they're the only part of the website
  that the service reads. The image doesn't hold them: production mounts the
  checkout's directory at `/audio`, which is where the default
  `Audio.Directory`, `../audio`, leads from the image's `/app`.

## Commands

Run these in `backend/`:

```sh
go build ./... && go vet ./...
go test ./...                        # ffmpeg is optional: the tests that need it skip without it
go test ./internal/api -run Hears -v # end to end: fake feed to decoded HLS audio
go run ./cmd/rail-announcements-backend -config config.toml
```

Run the export at the repository's root. It writes into `backend/`:

```sh
npm run export:backend
```
