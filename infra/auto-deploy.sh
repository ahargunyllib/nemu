#!/bin/sh
# Pulls main and, when infra/ or apps/wa-bot/ changed, rebuilds the stack, so a merge to main is
# the deploy and nobody needs SSH for it (README › Deploying without SSH). Run it from cron.
set -eu

main() {
  PATH=/usr/local/bin:/usr/bin:/bin
  infra=$(cd "$(dirname "$0")" && pwd)
  exec 9>"${TMPDIR:-/tmp}/nemu-vps-auto-deploy.lock"
  flock -n 9 || return 0

  cd "$infra/.."
  git fetch -q --depth 1 origin main
  old=$(git rev-parse HEAD)
  new=$(git rev-parse FETCH_HEAD)
  [ "$old" = "$new" ] && return 0
  changed=$(git diff --name-only "$old" "$new" -- infra apps/wa-bot || echo unknown)
  git reset -q --hard "$new"
  echo "$(date -Is) $old -> $new"
  if [ -z "$changed" ]; then
    echo "  no infra/ or apps/wa-bot/ change"
    return 0
  fi
  echo "$changed" | sed "s/^/  changed: /"

  cd "$infra"
  services=$(sed -n "s/^AUTO_DEPLOY_SERVICES=//p" .env)
  # shellcheck disable=SC2086 # the service list is meant to split into words
  docker compose up -d --build $services 2>&1 | sed "s/^/  /"
  echo "  deployed: ${services:-every service}"
}

# The whole body is read before it runs, so the git reset above can replace this file safely.
main "$@"
