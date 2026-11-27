#!/usr/bin/env sh
# Prepares course 4A-UJI on the running Moodle (#197), the F4-1 quiz (#209) and the F4-3 quizzes (#211). Safe to run again.
set -eu
cd "$(dirname "$0")"
. ./.env
docker compose cp setup/. moodle:/tmp/nemu-setup
docker compose exec -T -e TEACHER_PASSWORD="$TEACHER_PASSWORD" moodle php /tmp/nemu-setup/setup-4a-uji.php
docker compose exec -T moodle php /tmp/nemu-setup/setup-f4-1.php
docker compose exec -T moodle php /tmp/nemu-setup/setup-f4-3.php
