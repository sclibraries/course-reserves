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

backend() {
    if [ "${API_TEST_DEPRECATIONS+x}" = "x" ]; then
        compose exec -T -e "API_TEST_DEPRECATIONS=$API_TEST_DEPRECATIONS" backend "$@"
    else
        compose exec -T backend "$@"
    fi
}

run_suite() {
    suite=$1
    if backend php -d register_argc_argv=On vendor/bin/codecept run "$suite" --no-colors; then
        printf '%s suite exit code: 0\n' "$suite"
        return 0
    else
        suite_exit_code=$?
        printf '%s suite exit code: %s\n' "$suite" "$suite_exit_code"
        return "$suite_exit_code"
    fi
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
backend php yii migrate/up --interactive=0
migration_output=$(backend php yii migrate/up --interactive=0)
printf '%s\n' "$migration_output"
case "$migration_output" in
    *"No new migrations found"*) ;;
    *)
        printf 'Second migrate/up did not report a no-op.\n' >&2
        exit 1
        ;;
esac
backend php yii dev-seed/test-courses

if run_suite unit; then
    unit_exit_code=0
else
    unit_exit_code=$?
fi

if run_suite functional; then
    functional_exit_code=0
else
    functional_exit_code=$?
fi

if run_suite concurrency; then
    concurrency_first_exit_code=0
else
    concurrency_first_exit_code=$?
fi

if run_suite concurrency; then
    concurrency_second_exit_code=0
else
    concurrency_second_exit_code=$?
fi

if [ "$unit_exit_code" -ne 0 ] \
    || [ "$functional_exit_code" -ne 0 ] \
    || [ "$concurrency_first_exit_code" -ne 0 ] \
    || [ "$concurrency_second_exit_code" -ne 0 ]; then
    exit 1
fi
