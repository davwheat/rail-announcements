# Production deployment

Two replicas of the service behind a proxy, run by rootless Docker. One replica
is always serving, including during a rollout.

```
host TLS proxy ──▶ 127.0.0.1:12000  proxy (Caddy)
                                     ├─▶ backend-1   (also 127.0.0.1:12001)
                                     └─▶ backend-2   (also 127.0.0.1:12002)
```

The service lives in the repository's `backend` directory. Run the commands in
this document there, and read its paths from there.

## How requests are routed

A stream is held in one replica's memory: its queue, its encoders and its
segments. A listener's playlist, segments and endless MP3 response must
therefore all reach the same replica.

Every stream URL carries the station as `crs`, including each segment URL in a
playlist, and the proxy hashes stream requests on it. Hashing on the station,
and not on the listener, also puts all of a station's listeners on one replica.
That replica then holds one feed connection for the station and one encoder for
each distinct stream, however many people listen.

`POST /v1/announcements` needs nothing from an earlier request, so it goes to
the replicas in turn.

The proxy checks each replica's `/healthz` every two seconds and hashes over
the replicas that are up. When a replica goes down, its stations move to the
other replica, and they move back when it returns. A listener's player sees
each move as a stream that ended, and reconnects: the website's player does so
after three seconds. A request that arrives while a replica is being replaced
is retried on the other one for up to five seconds.

## Set up the host

Do this once, as the user that runs the service.

1.  Install rootless Docker for that user. See
    [Rootless mode](https://docs.docker.com/engine/security/rootless/) in the
    Docker documentation.

1.  Keep the user's Docker daemon running when nobody is logged in, and start
    it at boot. Without this, the daemon and every container stop when the
    user's last session ends:

    ```sh
    sudo loginctl enable-linger "$USER"
    systemctl --user enable --now docker
    ```

1.  Point the Docker CLI at the rootless daemon, in the profile that a login
    shell reads, such as `~/.profile`. A deploy from GitHub runs the script in
    a login shell, so it reads this file too:

    ```sh
    export DOCKER_HOST=unix://$XDG_RUNTIME_DIR/docker.sock
    ```

1.  Clone the `deploy` branch of the repository, which is what production
    runs, into `~/rail-announcements`, which is where a deploy from GitHub
    looks for it:

    ```sh
    git clone --branch deploy REPOSITORY_URL ~/rail-announcements
    ```

    Replace `REPOSITORY_URL` with this repository's URL. The repository holds
    the audio as well as the service, and the download is about 1.7 GB.

1.  Create `deploy/config.toml`, the service's settings. See
    [Settings](#settings).

1.  Put a TLS proxy in front of `127.0.0.1:12000`. Rootless Docker can't publish
    a port below 1024, so the stack doesn't terminate TLS itself. The proxy in
    front must not buffer responses, because `live.mp3` is one response that
    never ends. For nginx:

    ```nginx
    location / {
        proxy_pass http://127.0.0.1:12000;
        proxy_http_version 1.1;
        proxy_buffering off;
    }
    ```

    The service also sends `X-Accel-Buffering: no` on that response, which
    nginx honors without the `proxy_buffering` line.

    Leave `proxy_read_timeout` at its default of 60 seconds. It isn't a limit
    on how long a response lasts: it's the longest wait between two reads from
    the service, and the MP3 response sends a frame about every 26
    milliseconds, silence included. It only fires when a replica hangs without
    closing the connection, and then a short timeout is what gets the listener
    reconnected. A proxy or CDN that does cap a response's total duration
    would cut listeners off at that limit, and their players would reconnect.

### What rootless mode changes

- **File ownership.** The containers run as user ID 10001, which rootless
  Docker maps to one of the host user's subordinate IDs, not to the host user.
  The audio is mounted read-only, so it only has to be readable by everyone,
  which a Git checkout is.
- **Nothing is written.** Each container's file system is read-only. The
  replicas get a `/tmp` in memory, where ffmpeg leaves a rendered MP3 for as
  long as it takes to read it back.
- **No resource limits.** The stack sets none, because rootless Docker only
  enforces them when cgroup v2 delegation is set up for the user. To cap
  memory, set that up first, and then add limits to the `x-replica` block.
  `Audio.CacheMB` and `Stream.MaxStreams` in `config.toml` bound what a
  replica uses in the meantime.

## Deploy and update

To deploy, push a change to the service or to the audio to the `deploy` branch.
GitHub Actions runs the tests, and if they pass, it runs the deploy script on
the host over SSH. To set that up, see
[Deploy from GitHub](#deploy-from-github). The same branch deploys the website,
through a workflow of its own.

To deploy by hand, run the script on the host:

```sh
./deploy/deploy.sh
```

The script pulls the checked-out branch, builds the image, and then replaces `backend-1` and `backend-2` in turn. It waits for each to
report healthy, and then ten more seconds for the proxy to send its stations
back, before it touches the next one. The same command performs the first
deploy.

- If a replica doesn't become healthy in 90 seconds, the script prints its logs
  and stops. The other replica is still serving the previous version.
- If either replica is unhealthy before the rollout starts, the script refuses
  to start, because replacing the healthy one would leave nothing serving.
- To deploy one commit and not the branch's latest, pass it:
  `./deploy/deploy.sh COMMIT`. The script fast-forwards to that commit, and
  refuses a commit that is behind the checkout.
- To deploy what is checked out without pulling, pass `--no-pull`.

During a rollout, a listener can hear up to two gaps of a few seconds: one when
their station's replica is replaced, and one when the station moves back. An
announcement that is being spoken at that moment is cut off, and isn't repeated.

Changing `Caddyfile` recreates the proxy at the end of the rollout, which drops
every connection for about a second.

### Deploy from GitHub

The `Backend` workflow, `.github/workflows/backend.yml` at the repository's
root, tests each pull request and each push to `main` or `deploy` that changes
the `backend` directory or the `audio` directory. A push that changes neither
doesn't run it, and the host stays at the commit that was last deployed. When
the tests of a push to `deploy` pass, the
workflow connects to the host as `railannouncements` and runs
`deploy/deploy.sh COMMIT` with the pushed commit. It deploys that commit, and
not the branch's latest, so that a push whose tests haven't finished is never
deployed. The workflow doesn't cancel a deploy that has started: a push to
`deploy` waits for the run before it to finish, and a newer push replaces one
that is waiting.

To follow a deploy, look at these:

- The **Deploy** step of the run's `deploy` job, which shows the script's
  output as it runs.
- The repository's `production` environment, which records each deploy and
  whether it succeeded.
- The run's summary, which shows the end of the script's output: the running
  containers after a deploy that succeeded, or the failed replica's logs.

To set it up, do this once:

1.  Create a key pair without a passphrase:

    ```sh
    ssh-keygen -t ed25519 -N '' -C github-actions-deploy -f deploy_key
    ```

1.  On the host, add the contents of `deploy_key.pub` to the service user's
    `~/.ssh/authorized_keys`, after the `restrict` option, which turns off
    forwarding and terminals for that key:

    ```
    restrict ssh-ed25519 AAAA... github-actions-deploy
    ```

1.  In the repository's settings on GitHub, create the `production`
    environment and limit its deployment branches to `deploy`. Add the contents
    of `deploy_key` as the environment's `DEPLOY_SSH_KEY` secret, so that a
    workflow on another branch can't read it. Then delete both key files.

1.  If the host's checkout is on another branch, switch it to `deploy`. The
    workflow runs the script that the host has checked out, at
    `~/rail-announcements/backend/deploy/deploy.sh`, and the script
    fast-forwards the checked-out branch to the pushed commit:

    ```sh
    cd ~/rail-announcements
    git fetch
    git switch deploy
    ```

The workflow trusts only the host key in its `DEPLOY_HOST_KEY` setting. If you
rebuild the host, replace that setting with the new key, which is in the host's
`/etc/ssh/ssh_host_ed25519_key.pub` file.

## Settings

The replicas read their settings from `deploy/config.toml`, which isn't in the
repository. Create it on the host, and set at least the websites whose pages
may call the API:

```toml
[API]
AllowedOrigins = [
    "https://railannouncements.co.uk",
    "https://www.railannouncements.co.uk",
    "https://*.rail-announcements.pages.dev",
]
```

Every other key is optional, and `config.example.toml` lists each one with its
default.

- `AllowedOrigins` defaults to `"*"`, which allows every website. Write each
  entry as a browser writes its `Origin` header, with the scheme and without a
  path. A host that starts with `*.` allows every subdomain of the rest of it.
- Leave `API.Port`, `Audio.Directory` and `Audio.FFmpeg` at their defaults. The
  health checks, the proxy, the audio mount and the image depend on them.
- The file must be readable by everyone, because rootless Docker runs the
  replicas as another user. `deploy.sh` refuses to deploy when the file is
  missing or when others can't read it.
- A replica reads the file when it starts. To apply a change, run
  `./deploy/deploy.sh --no-pull`, which replaces the replicas one at a time. If
  the file is invalid, the first replica doesn't start, and the script prints
  its logs, which name the key, and stops.

The addresses that the stack is published on are Docker Compose's settings, not
the service's. To change them, set these in a `.env` file in this directory:

| Variable | Meaning | Default |
|---|---|---|
| `LISTEN` | The host address and port that the proxy is published on. Send listeners here. | `127.0.0.1:12000` |
| `LISTEN_BACKEND_1`, `LISTEN_BACKEND_2` | Where each replica is published by itself, for looking at one replica. | `127.0.0.1:12001`, `127.0.0.1:12002` |

## Look at it

```sh
docker compose -f deploy/docker-compose.yml ps
docker compose -f deploy/docker-compose.yml logs -f backend-1 backend-2
curl -s http://127.0.0.1:12001/healthz   # backend-1
curl -s http://127.0.0.1:12002/healthz   # backend-2
```

`/healthz` on port 12000 goes through the proxy and answers from either
replica, so ask a replica's own port for its `streams` count. Don't point
listeners at those ports: only the proxy keeps a stream's requests on the
replica that holds it.
