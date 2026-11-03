#!/usr/bin/env bash
# Rolls the checked-out branch out to production, one replica at a time, so
# that one replica is always serving. Production checks out the deploy branch.
#
#   ./deploy/deploy.sh             pull, build and roll out
#   ./deploy/deploy.sh COMMIT      fast-forward to COMMIT, build and roll out
#   ./deploy/deploy.sh --no-pull   build and roll out what is checked out
#
# Run it on the production host, as the user that owns the rootless Docker
# daemon. CI runs it with the pushed commit for each push to the deploy branch
# that changes the service or the audio.
# It stops at the first replica that fails to become healthy, which leaves the
# other replica serving the previous version.
set -euo pipefail

cd "$(dirname "$0")/.."
replicas=(backend-1 backend-2)
healthy_within=90
settle=10

pull=true
commit=
for argument in "$@"; do
	case "$argument" in
	--no-pull) pull=false ;;
	-*)
		echo "unknown option: $argument" >&2
		exit 2
		;;
	*) commit="$argument" ;;
	esac
done
if ! "$pull" && [ -n "$commit" ]; then
	echo "--no-pull deploys what is checked out, so it takes no commit" >&2
	exit 2
fi

compose() { docker compose -f deploy/docker-compose.yml "$@"; }

health() {
	local container
	container="$(compose ps -q "$1")"
	[ -n "$container" ] && docker inspect -f '{{.State.Health.Status}}' "$container" 2>/dev/null || echo missing
}

wait_until_healthy() {
	local service="$1" waited=0
	until [ "$(health "$service")" = healthy ]; do
		if [ "$waited" -ge "$healthy_within" ]; then
			echo "$service is $(health "$service") after ${healthy_within}s. Its last logs:" >&2
			compose logs --tail 40 "$service" >&2
			return 1
		fi
		sleep 2
		waited=$((waited + 2))
	done
}

if "$pull"; then
	if [ -n "$commit" ]; then
		git fetch
		git merge --ff-only "$commit"
		# A commit that is already behind the checkout would otherwise deploy the
		# newer checkout under the older commit's name.
		if [ "$(git rev-parse HEAD)" != "$(git rev-parse "$commit^{commit}")" ]; then
			echo "$commit is behind the checked-out $(git rev-parse --short HEAD), and a deploy only moves forward" >&2
			exit 1
		fi
	else
		git pull --ff-only
	fi
fi
if [ ! -d ../audio/station/ketech ]; then
	echo "audio/station/ketech is missing from the checkout, and the replicas mount the repository's audio directory" >&2
	exit 1
fi
if [ ! -f deploy/config.toml ]; then
	echo "deploy/config.toml is missing: create it as deploy/README.md describes" >&2
	exit 1
fi
# Rootless Docker runs the replicas as a user that reads the file as "others".
if [ -z "$(find deploy/config.toml -perm -o=r)" ]; then
	echo "deploy/config.toml must be readable by everyone: run chmod o+r deploy/config.toml" >&2
	exit 1
fi

VERSION="$(git rev-parse --short HEAD)"
export VERSION
echo "Building $VERSION"
compose build "${replicas[0]}"

# The replicas take over from each other, so both must be well before one is
# taken away. On a first deploy neither exists yet, and that is fine.
for replica in "${replicas[@]}"; do
	case "$(health "$replica")" in
	healthy | missing) ;;
	*)
		echo "$replica is $(health "$replica"). Fix it before rolling out, or the rollout would leave nothing serving." >&2
		exit 1
		;;
	esac
done

for replica in "${replicas[@]}"; do
	echo "Replacing $replica"
	compose up -d --no-deps --force-recreate "$replica"
	wait_until_healthy "$replica"
	# The proxy checks health every two seconds. Give it time to see this replica
	# and send its stations back, before the other replica's stations arrive too.
	sleep "$settle"
done

# Created on a first deploy, and recreated only when its configuration changed.
# Recreating it drops every connection for about a second.
compose up -d --no-deps proxy
wait_until_healthy proxy

docker image prune -f --filter "label=com.docker.compose.project=rail-announcements-backend" >/dev/null
echo "Deployed $VERSION"
compose ps
