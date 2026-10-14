#!/bin/sh
set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
project_name=${1:-api054fr-entrypoints}
case "$project_name" in
    api054fr-*) ;;
    *) printf 'Compose project name must start with api054fr-.\n' >&2; exit 2 ;;
esac

compose() {
    docker compose -f "$ROOT/docker-compose.test.yml" -p "$project_name" "$@"
}

cleanup() {
    exit_code=$?
    trap - EXIT
    compose down -v --remove-orphans >/dev/null 2>&1 || exit_code=$?
    exit "$exit_code"
}
trap cleanup EXIT

compose up -d --build --wait
compose exec -T backend php /app/yii migrate/up --interactive=0

probe="require '/app/config/environment.php'; echo YII_ENV . ':' . (YII_DEBUG ? '1' : '0');"
config_probe="require '/app/config/environment.php'; require '/app/vendor/yiisoft/yii2/Yii.php'; \$web = require '/app/config/web.php'; \$console = require '/app/config/console.php'; echo (isset(\$web['modules']['debug']) ? '1' : '0') . ':' . (isset(\$web['modules']['gii']) ? '1' : '0') . ':' . (in_array('gii', \$console['bootstrap'], true) ? '1' : '0');"
for environment in unset staging dev test prod; do
    if [ "$environment" = unset ]; then
        actual=$(compose exec -T backend env -u YII_ENV php -r "$probe")
        compose exec -T backend env -u YII_ENV php /app/yii help >/dev/null
        compose exec -T backend env -u YII_ENV php /app/tests/bin/yii help >/dev/null
    else
        actual=$(compose exec -T backend env YII_ENV="$environment" php -r "$probe")
        modules=$(compose exec -T backend env YII_ENV="$environment" php -r "$config_probe")
        compose exec -T backend env YII_ENV="$environment" php /app/yii help >/dev/null
        compose exec -T backend env YII_ENV="$environment" php /app/tests/bin/yii help >/dev/null
    fi
    if [ "$environment" = unset ]; then
        modules=$(compose exec -T backend env -u YII_ENV php -r "$config_probe")
    fi
    expected=prod:0
    case "$environment" in
        dev) expected=dev:1 ;;
        test) expected=test:0 ;;
    esac
    [ "$actual" = "$expected" ] || {
        printf 'environment %s: expected %s, got %s\n' "$environment" "$expected" "$actual" >&2
        exit 1
    }
    expected_modules=0:0:0
    [ "$environment" = dev ] && expected_modules=1:1:1
    [ "$modules" = "$expected_modules" ] || {
        printf 'debug/gii config %s: expected %s, got %s\n' "$environment" "$expected_modules" "$modules" >&2
        exit 1
    }
    printf 'config/environment.php + yii (%s) -> %s; console=0\n' "$environment" "$actual"
done

for environment in unset staging dev test prod; do
    compose exec -T backend sh -s -- "$environment" <<'CONTAINER_SCRIPT'
set -eu
environment=$1
port=18080
log=/tmp/api054-entrypoints-server.log
if [ "$environment" = unset ]; then
    env -u YII_ENV php -S "127.0.0.1:$port" -t /app >"$log" 2>&1 &
else
    env YII_ENV="$environment" php -S "127.0.0.1:$port" -t /app >"$log" 2>&1 &
fi
server_pid=$!
trap 'kill "$server_pid" 2>/dev/null || true' EXIT
attempt=0
until curl -sS -o /dev/null "http://127.0.0.1:$port/web/index.php" 2>/dev/null; do
    attempt=$((attempt + 1))
    if [ "$attempt" -ge 30 ]; then cat "$log" >&2; exit 1; fi
    sleep 0.2
done

check_status() {
    path=$1
    expected=$2
    headers=/tmp/api054-entrypoints-headers
    body=/tmp/api054-entrypoints-body
    status=$(curl -sS -D "$headers" -o "$body" -w '%{http_code}' "http://127.0.0.1:$port$path")
    case " $expected " in
        *" $status "*) ;;
        *) printf '%s (%s) returned %s; expected %s\n' "$path" "$environment" "$status" "$expected" >&2; cat "$body" >&2; exit 1 ;;
    esac
    printf '%s (%s) -> %s\n' "$path" "$environment" "$status"
    if [ "$environment" = dev ] && [ "$path" = /admin/authorize-local.php ]; then
        grep -qi '^Set-Cookie: accessToken=' "$headers" || {
            printf 'dev local login did not issue its seeded-user access cookie\n' >&2
            exit 1
        }
    fi
}

check_post_status() {
    path=$1
    expected=$2
    shift 2
    body=/tmp/api054-entrypoints-post-body
    status=$(curl -sS -X POST -d "$*" -o "$body" -w '%{http_code}' "http://127.0.0.1:$port$path")
    case " $expected " in
        *" $status "*) ;;
        *) printf 'POST %s (%s) returned %s; expected %s\n' "$path" "$environment" "$status" "$expected" >&2; cat "$body" >&2; exit 1 ;;
    esac
    printf 'POST %s (%s) -> %s\n' "$path" "$environment" "$status"
}

check_status /web/index.php/__api054_probe 404
if [ "$environment" = test ]; then
    check_status /web/index-test.php 200
else
    check_status /web/index-test.php 404
fi
check_status /admin/authorize.php '400 401'
check_status /admin/faculty-authorize.php '400 401'
check_status /admin/faculty-refresh-token.php '400 401'
check_status /admin/refresh-token.php '400 401'
if [ "$environment" = dev ]; then
    check_post_status /web/index.php/dev-auth/login 200 'username=devadmin'
else
    check_post_status /web/index.php/dev-auth/login 403 'username=devadmin'
fi
if [ "$environment" = dev ] || [ "$environment" = test ]; then
    check_post_status /web/index.php/faculty-submission/mock-login 200 'full_name=Synthetic+Faculty&role=faculty'
    check_post_status /web/index.php/faculty-submission/mock-login 400 'full_name=Synthetic+Admin&role=admin'
else
    check_post_status /web/index.php/faculty-submission/mock-login 404 'full_name=Synthetic+Faculty&role=faculty'
fi
if [ "$environment" = dev ]; then
    check_status /admin/authorize-local.php 302
    check_status /admin/authorize-dev.php '400 401'
    check_status /admin/refresh-token-local.php '400 401'
    check_status /admin/refresh-token-dev.php '400 401'
else
    check_status /admin/authorize-local.php 404
    check_status /admin/authorize-dev.php 400
    check_status /admin/refresh-token-local.php 404
    check_status /admin/refresh-token-dev.php 400
fi
CONTAINER_SCRIPT
done

for environment in unset staging dev test prod; do
    if [ "$environment" = unset ]; then
        bootstrap_result=$(docker run --rm --network none \
            -v "$ROOT/apps/api:/app:ro" -v "$ROOT/apps/api/vendor:/app/vendor:ro" \
            php:7.2 php -r 'require "/app/tests/_bootstrap.php"; echo YII_ENV . ":" . (YII_DEBUG ? "1" : "0");')
        docker_bootstrap_result=$(docker run --rm --network none \
            -v "$ROOT/apps/api:/app:ro" -v "$ROOT/apps/api/vendor:/app/vendor:ro" \
            -v "$ROOT/docker/test/bootstrap.php:/app/tests/_bootstrap.php:ro" \
            php:7.2 php -r 'require "/app/tests/_bootstrap.php"; echo YII_ENV . ":" . (YII_DEBUG ? "1" : "0");')
    else
        bootstrap_result=$(docker run --rm --network none -e YII_ENV="$environment" \
            -v "$ROOT/apps/api:/app:ro" -v "$ROOT/apps/api/vendor:/app/vendor:ro" \
            php:7.2 php -r 'require "/app/tests/_bootstrap.php"; echo YII_ENV . ":" . (YII_DEBUG ? "1" : "0");')
        docker_bootstrap_result=$(docker run --rm --network none -e YII_ENV="$environment" \
            -v "$ROOT/apps/api:/app:ro" -v "$ROOT/apps/api/vendor:/app/vendor:ro" \
            -v "$ROOT/docker/test/bootstrap.php:/app/tests/_bootstrap.php:ro" \
            php:7.2 php -r 'require "/app/tests/_bootstrap.php"; echo YII_ENV . ":" . (YII_DEBUG ? "1" : "0");')
    fi
    [ "$bootstrap_result" = 'test:0' ] || { printf 'tests/_bootstrap.php (%s) -> %s\n' "$environment" "$bootstrap_result" >&2; exit 1; }
    [ "$docker_bootstrap_result" = 'test:0' ] || { printf 'docker/test/bootstrap.php (%s) -> %s\n' "$environment" "$docker_bootstrap_result" >&2; exit 1; }
    printf 'test bootstraps (%s) -> test:0\n' "$environment"
done

compose exec -T backend sh -s <<'CONTAINER_SCRIPT'
set -eu
port=18081
log=/tmp/api054-missing-secret-server.log
env -u YII_ENV JWT_SECRET_KEY= php -S "127.0.0.1:$port" -t /app >"$log" 2>&1 &
server_pid=$!
trap 'kill "$server_pid" 2>/dev/null || true' EXIT
attempt=0
until curl -sS -o /dev/null "http://127.0.0.1:$port/web/index.php" 2>/dev/null; do
    attempt=$((attempt + 1))
    if [ "$attempt" -ge 30 ]; then cat "$log" >&2; exit 1; fi
    sleep 0.2
done
body=/tmp/api054-missing-secret-body
status=$(curl -sS -o "$body" -w '%{http_code}' "http://127.0.0.1:$port/web/index.php")
[ "$status" = 500 ] || { printf 'missing production secret returned HTTP %s\n' "$status" >&2; cat "$body" >&2; exit 1; }
grep -q 'JWT_SECRET_KEY' "$body"
if grep -Eq 'isolated-test-|test-only-' "$body"; then
    printf 'missing-setting response exposed a setting value\n' >&2
    exit 1
fi
printf 'web/index.php (prod, missing JWT_SECRET_KEY) -> HTTP 500; name only\n'
CONTAINER_SCRIPT

compose exec -T backend sh -s <<'CONTAINER_SCRIPT'
set -eu
set +e
output=$(env -u YII_ENV JWT_SECRET_KEY= php /app/yii help 2>&1)
status=$?
set -e
[ "$status" = 1 ] || { printf 'yii with a missing production secret exited %s\n' "$status" >&2; exit 1; }
printf '%s\n' "$output" | grep -q 'JWT_SECRET_KEY'
if printf '%s\n' "$output" | grep -Eq 'isolated-test-|test-only-'; then
    printf 'console missing-setting response exposed a setting value\n' >&2
    exit 1
fi
printf 'yii (prod, missing JWT_SECRET_KEY) -> exit 1; name only\n'
CONTAINER_SCRIPT

printf 'API-054 entry-point environment matrix: all checks passed.\n'
