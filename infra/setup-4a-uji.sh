#!/usr/bin/env sh
# Prepares course 4A-UJI on the running Moodle (#197). Safe to run again.
set -eu
cd "$(dirname "$0")"
. ./.env
docker compose cp setup/. moodle:/tmp/nemu-setup
docker compose exec -T -e TEACHER_PASSWORD="$TEACHER_PASSWORD" moodle php /tmp/nemu-setup/setup-4a-uji.php
