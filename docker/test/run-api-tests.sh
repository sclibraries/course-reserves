#!/bin/sh
set -eu

if [ "$#" -gt 1 ]; then
    printf 'Usage: %s [project-name]\n' "$0" >&2
    exit 2
fi

project_name=${1:-cr-test-$$}

compose() {
    docker compose -f docker-compose.test.yml -p "$project_name" "$@"
}

cleanup() {
    exit_code=$?
    trap - EXIT
    if [ "${KEEP_STACK:-0}" != "1" ]; then
        compose down -v --remove-orphans || exit_code=$?
    fi
    exit "$exit_code"
}
trap cleanup EXIT

compose up -d --build --wait
compose exec -T backend php yii migrate/up --interactive=0
migration_output=$(compose exec -T backend php yii migrate/up --interactive=0)
printf '%s\n' "$migration_output"
case "$migration_output" in
    *"No new migrations found"*) ;;
    *)
        printf 'Second migrate/up did not report a no-op.\n' >&2
        exit 1
        ;;
esac
compose exec -T backend php yii dev-seed/test-courses

if compose exec -T backend php -d register_argc_argv=On vendor/bin/codecept run unit --no-colors; then
    unit_exit_code=0
else
    unit_exit_code=$?
fi
printf 'Unit suite exit code: %s\n' "$unit_exit_code"

if compose exec -T backend php -d register_argc_argv=On vendor/bin/codecept run functional --no-colors; then
    functional_exit_code=0
else
    functional_exit_code=$?
fi
printf 'Functional suite exit code: %s\n' "$functional_exit_code"

if [ "$unit_exit_code" -ne 0 ] || [ "$functional_exit_code" -ne 0 ]; then
    exit 1
fi
