# rail-announcements-backend

A Go service that speaks station announcements. It listens to
the announcement stream of Darwin Browser (darwinbrowser.com), builds each
announcement from the recordings that the website in this repository,
[railannouncements.co.uk](https://railannouncements.co.uk/), uses, and serves
the result as an HTTP Live Stream (HLS). It also renders a single announcement
from a posted website state, for every announcement system the website
registers, and it speaks a station's departure board the way a platform help
point does.

The announcement logic is a port of the website's TypeScript. The website stays
the reference, and the tests here fail on any clip that differs from it. See
[Keep the port in step with the website](#keep-the-port-in-step-with-the-website).

For the design and the decisions, see
[docs/architecture.md](docs/architecture.md). To run it in production, as two
replicas under rootless Docker with rolling updates, see
[deploy/README.md](deploy/README.md). A push to the `deploy` branch that
changes this directory or the audio deploys it, once the tests pass.

The service lives in the repository's `backend` directory. Run the commands in
this document there, and read its paths from there, unless the text names the
repository's root.

## Run the service

You need Go 1.26 and `ffmpeg` on your `PATH`. The service reads the recordings
from the repository's `audio` directory, which is `../audio`.

1.  Optional: copy `config.example.toml` to `config.toml` and edit it. Every
    key has a default.

1.  Start the service:

    ```sh
    go run ./cmd/rail-announcements-backend
    ```

The feed must speak protocol version 2 of the station streams. The service
refuses any other version and retries.

## Live streams

```
GET /v1/streams/live.m3u8?crs=KGX&zone=1:phil,2:celia&zone=3:phil
GET /v1/streams/live.mp3?crs=KGX&zone=1:phil,2:celia&zone=3:phil
```

A stream is one listener's mix of a station. It's made of *announcement zones*:
the platforms that share a loudspeaker and so take turns. Zones speak at the
same time, and the stream is their sum. Listeners who ask for the same zones
with the same choices share one stream. A stream starts on its first request
and stops 45 seconds after its last one.

Both URLs take the same parameters and carry the same audio:

- `live.m3u8` is an HLS playlist of one-second AAC segments. Safari plays it
  natively, and so does any HLS player.
- `live.mp3` is one endless response of constant bit rate MP3, the way internet
  radio is served. Every browser plays it from a plain `<audio>` element with
  no script, so it keeps playing in a background tab. It opens with the last
  three seconds of audio so that a player starts at once. It's MP3 and not AAC
  because AAC spends about 500 bytes a second on silence, and a browser that is
  waiting for enough bytes to recognize the format would take minutes to start.

A listener hears an announcement about two seconds after the service starts it
on `live.mp3`, and about three seconds after on `live.m3u8`. The first listener
of an MP3 stream that isn't running yet is about four seconds behind until they
reconnect.

A stream that stops and starts again keeps its URL and its place: a player
that is still polling the playlist carries on with the new stream's audio. See
[A restarted stream keeps its place](docs/architecture.md#a-restarted-stream-keeps-its-place).

| Parameter | Value | Default |
|---|---|---|
| `crs` | The station's CRS code. Required. | |
| `zone` | One zone: its platforms separated by commas, each as `NUMBER` or `NUMBER:VOICE`. Repeat it for each zone. Without it, the whole station is one zone. | Every platform |
| `platform` | Shorthand for a stream of one zone: a platform of that zone. Repeat it, or separate platforms with commas. It can't be combined with `zone`. | |
| `voice` | The voice for platforms that name none: `phil` or `celia`, or the website's system ID. | `phil` |
| `type` | The announcements to make: `next`, `approaching`, `standing`, `disrupted`, `passing`, `platform_alteration`. | All of them |
| `chime` | `three`, `four` or `none`. | The voice's own |
| `vias` | Whether to announce via points. | `true` |
| `legacy_tocs` | Whether to use the operators' former names. | `false` |
| `short_platforms_after_split` | Whether to announce short platforms for each portion of a dividing train. | `false` |
| `fast_train_approaching` | Whether a fast train warning ends with "fast train approaching". | `false` |
| `fanfare` | Whether a fast train warning starts with the Daktronics fanfare. | `false` |
| `missing_audio` | What to do when a recording is missing: `skip-service`, `play-silence`, `repeat-last-station` or `repeat-last`. | `skip-service` |
| `listener` | A name for one `live.mp3` response, so that its player can ask for silence to be left out of it: 8 to 64 letters, digits, hyphens or underscores. It doesn't change which stream is played. | None |

### Bring an MP3 player back to the present

```
POST /v1/streams/trim?crs=KGX&zone=1:phil,2:celia&zone=3:phil&listener=NAME&total=SECONDS
```

An MP3 response has no live edge. A player that stalls is that far behind for
as long as it plays the response, and only the player knows by how much. To
catch up without a new connection, and without losing anything that was said,
a player asks the service to leave silence out of its own response:

1.  Add `listener=NAME` to the `live.mp3` URL. Replace `NAME` with a name that
    only this player knows, such as a random one, and use a different name for
    each response.

1.  When the player is behind, send the request, with the stream's own
    parameters and the same `listener`. Replace `SECONDS` with how much shorter
    the response has to be in all, counted from its start, and not with how
    much more to leave out. Asking again with the same total then adds nothing.

The service leaves out silence between announcements as it comes, and never a
pause inside one. The response says how many seconds it has left out of the
response so far, and how many are still to come:

```json
{"trimmed": 1.5, "pending": 2.5}
```

A player's own clock doesn't show the silence that was left out, so subtract
`trimmed` from the lag that the player measures. Don't ask for more than the
player is behind: silence left out beyond what the player holds runs it dry.

| Status | Code | Meaning |
|---|---|---|
| 400 | `bad_zone` | The stream's parameters are wrong. |
| 400 | `bad_total` | `total` isn't a number of seconds. |
| 404 | `no_listener` | The stream isn't playing, or nobody is listening to it by that name. |

## Render one announcement

```
POST /v1/announcements
Content-Type: application/json

{"system": "AMEY_PHIL_V1", "announcement": "nextTrain", "state": { ... }}
```

Every system the website registers is served, one Go package for each under
`internal/systems`. `GET /v1/systems` lists them, with the tabs each one
accepts:

```json
{"systems": [{"id": "AMEY_PHIL_V1", "name": "Amey/Ditra - Phil Sayer",
              "announcements": ["nextTrain", "standingTrain", "..."]}]}
```

`announcement` is one of the system's tab IDs, and `state` is the option state
of that tab, unchanged. A button tab takes the button's own two names instead:

```json
{"system": "TFL_DLR_V1", "announcement": "announcementButtons",
 "state": {"section": "Safety", "label": "Mind the gap please"}}
```

`section` is the heading the button sits under, and `label` is the button's
label. The response is the MP3 (`audio/mpeg`), or a JSON error:

```json
{"error": {"code": "missing_audio", "message": "audio file not found: station/ketech/phil/station/e/ZZZ.mp3"}}
```

| Status | Code | Meaning |
|---|---|---|
| 400 | `bad_request` | The body isn't the JSON object shown. |
| 404 | `unknown_system`, `unknown_announcement` | `GET /v1/systems` lists what exists. |
| 422 | `invalid_state` | The state can't be read, or describes an announcement that can't be made. |
| 422 | `missing_audio` | A recording doesn't exist, and the state's `missingAudioMode` doesn't allow for that. |
| 422 | `empty_announcement` | The state describes nothing to say. |
| 500 | `render_failed` | The audio couldn't be produced. |

## Hear a station's departure board

```
GET /v1/help-points/KGX?voice=celia
```

The response is an MP3 (`audio/mpeg`) of the station's departure board, the way
the button on a platform help point speaks it. The CRS code in the path names
the station. `voice` is optional: `phil` for Phil Sayer, which is the default,
or `celia` for Celia Drummond. The website's **Help point** tab, on both
voices' pages, plays this response.

The board is the passenger trains that call at the station in the next 90
minutes, to a limit of eight, from Darwin Browser's `/v1/departures`. For each
one, the announcement gives the platform, the time, the operator, the
destinations and via points, and the number of coaches. A train that Darwin
gives a false destination is announced to that station, with no via points,
because the board's lie on the route to the real destination. It also says when a
train is delayed or cancelled, with the reason when Darwin gives one, and it
announces a train that terminates at the station as an arrival. A portion that
joins another train is announced to where that train goes, and is left out at
the station where it joins: it doesn't terminate there, and the train it joins
is announced as a departure. A train that is cut short is announced to the last
station that it still calls at, and as an arrival that terminates at that
station.

If the board can't be read, the response is still `200` and an MP3. It says
that the information facility isn't in operation, because a player has no way
to show a JSON error to a listener. Only these requests get a JSON error:

| Status | Code | Meaning |
|---|---|---|
| 400 | `bad_crs` | The path isn't a three-letter station code. |
| 400 | `bad_voice` | `voice` names neither `phil` nor `celia`. |
| 404 | `unknown_station` | Darwin Browser has no station with that code. |
| 500 | `render_failed` | The audio couldn't be produced. |

`GET /healthz` reports the number of running streams.

## Test

```sh
go test ./...
```

Tests that need `ffmpeg` or the audio directory skip themselves when either is
missing. `internal/api` holds the end-to-end test: a fake feed sends a
protobuf announcement, and the test decodes the HLS segments and checks that
they carry speech.

GitHub Actions runs the tests, with `ffmpeg` and the audio, for each pull
request and each push to `main` or `deploy` that changes this directory or the
audio.

## Keep the port in step with the website

The website is the reference for every announcement this service builds: each
package under `internal/systems` ports one of its systems, and
`internal/ketech` and `internal/queue` port the Amey/KeTech voices' live
announcement logic (`../src/live/playAnnouncement.ts`) and playback queue
(`../src/live/playbackQueue.ts`). The website generates what the ports are
tested against. At the repository's root, run the export:

```sh
npm run export:backend
```

The export writes into this directory, so a change to the website, the export's
output and the port can share one commit.

The export is generic. It runs every tab of every registered system
through the real TypeScript play handler, over the tab's default state, its
presets, every value of every dropdown, generated lists for custom options such
as calling points, and seeded random mixes, and records what each would play.
For each system it writes `internal/systems/PKG`, where `PKG` is the system's
ID in lower case without the version or the underscores (`TFL_DLR_V1` becomes
`tfldlr`):

- `testdata/parity.json.gz`: the tab, the state and the clips, for about 42,000
  cases over the 19 systems.
- `data/instance.json`: the system class's own fields and getters.
- `data/module.json`: the constants the handlers read from a module beside the
  class, for the systems that keep them there.
- `data/buttons.json`: the button tabs, as tab ID, section and label to clips.
  A button always plays the same clips, so no port writes one.

It writes one more table, which every port shares:

- `internal/systems/shared/data/stations.json`: the national CRS to station
  name table, which is what a "no recording for this station" message names a
  station by.

For the Amey/KeTech voices' live announcements and the playback queue, it
writes:

- `internal/ketech/data/*.json`: the voices' tables, such as operators,
  platforms, delay reasons and short platforms. The service embeds them.
- `internal/ketech/testdata/parity-*.json.gz`: the clips the website plays for
  about 2,700 live announcements and 800 tab states, and its answers for
  operator names and short platforms. The live announcements are built from
  `movements.json.gz`, which holds real movements captured from production.
- `internal/queue/testdata/parity-queue.json`: scripts run against the
  website's queue, with everything the queue did at each step.

To change how an announcement is worded, change the website, run the export,
and then port the change until `go test ./...` passes. A case that the website
alerted about and played anyway expects the plan: the website shows its own
alert and asks this service only for the audio, so the port builds the
announcement rather than refusing it.

### Add a system

1.  Register the system in the website's
    `../src/announcement-data/AllSystems.ts`. The export covers it from then
    on. If the system keeps its constants in a module beside its class, add
    that module to the export's `../tests/backend-parity/generate.ts` as well.

1.  Run the export, which writes the system's data and its record.

1.  Write `internal/systems/PKG` to the shape of the other ports: read the
    exported data, implement `system.System`, hand a button tab to
    `shared.Buttons`, and copy `parity_test.go` from another package.

1.  Register the system in `internal/system/system.go`, in `All`.

1.  Run `go test ./internal/systems/PKG ./internal/system` until the record and
    the render test pass.

## The protobuf code

`internal/feed/livepb` is generated from the feed's protobuf schema, which isn't
part of this repository. The generated code is committed, so you don't need the
schema to build or test. `buf.gen.yaml` holds the generator settings for
whoever has the schema.

## License

[MIT](../LICENSE).
