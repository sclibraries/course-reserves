#!/bin/sh
set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
project_name=${1:-api054fr-entrypoints}
case "$project_name" in
    api054fr-*|api093-*) ;;
    *) printf 'Compose project name must start with api054fr- or api093-.\n' >&2; exit 2 ;;
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

apache_status=$(compose exec -T backend curl -sS -o /dev/null -w '%{http_code}' http://127.0.0.1/index-test.php)
[ "$apache_status" = 403 ] || {
    printf 'Apache /index-test.php returned %s; expected 403 from web/.htaccess\n' "$apache_status" >&2
    exit 1
}
printf 'Apache /index-test.php -> 403 (web/.htaccess)\n'

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
faculty_entrypoint_failures=0
if [ "$environment" = unset ]; then
    env -u YII_ENV php -S "127.0.0.1:$port" -t /app >"$log" 2>&1 &
elif [ "$environment" = test ]; then
    cat >/tmp/api054-shibboleth-server-vars.php <<'PHP'
<?php
if (isset($_SERVER["SCRIPT_NAME"]) && $_SERVER["SCRIPT_NAME"] === "/admin/faculty-authorize.php") {
    foreach (["fcIdNumber", "uid", "givenName", "sn", "fcPersonAffiliation", "mail"] as $name) {
        $value = getenv($name);
        if ($value !== false) {
            $_SERVER[$name] = $value;
        }
    }
}
PHP
    env YII_ENV=test fcIdNumber=999000130@smith.edu uid=test-api130-faculty \
        givenName=Synthetic sn=Faculty fcPersonAffiliation=faculty \
        mail=test-api130-faculty@example.test \
        php -d auto_prepend_file=/tmp/api054-shibboleth-server-vars.php \
        -S "127.0.0.1:$port" -t /app >"$log" 2>&1 &
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
    if [ "$environment" = test ] && [ "$path" = /admin/faculty-authorize.php ]; then
        status=$(curl -sS -H 'Host: libtools2.smith.edu' -H 'X-Forwarded-Proto: https' \
            -D "$headers" -o "$body" -w '%{http_code}' "http://127.0.0.1:$port$path")
    else
        status=$(curl -sS -D "$headers" -o "$body" -w '%{http_code}' "http://127.0.0.1:$port$path")
    fi
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
    if [ "$environment" = test ] && [ "$path" = /admin/faculty-authorize.php ]; then
        check_faculty_authorize_lifetime "$headers"
        check_faculty_refresh_tokens
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

check_faculty_authorize_lifetime() {
    headers=$1
    validation=$(php -r '
        require "/app/config/environment.php";
        require "/app/vendor/autoload.php";
        $headers = file_get_contents($argv[1]);
        $cookies = [];
        foreach (preg_split("/\\r?\\n/", $headers) as $line) {
            if (stripos($line, "Set-Cookie:") !== 0) {
                continue;
            }
            $parts = explode(";", trim(substr($line, strlen("Set-Cookie:"))));
            $pair = array_shift($parts);
            $separator = strpos($pair, "=");
            if ($separator === false) {
                continue;
            }
            $name = substr($pair, 0, $separator);
            $cookies[$name] = [
                "value" => rawurldecode(substr($pair, $separator + 1)),
                "attributes" => array_map("trim", $parts),
            ];
        }

        $failures = [];
        foreach (["facultyAccessToken", "facultyRefreshToken"] as $name) {
            if (!isset($cookies[$name])) {
                $failures[] = "faculty-authorize did not issue its $name cookie";
            }
        }
        foreach (["accessToken", "refreshToken"] as $name) {
            if (isset($cookies[$name])) {
                $failures[] = "faculty-authorize still issued the $name cookie";
            }
        }
        $accessCookie = $cookies["facultyAccessToken"] ?? $cookies["accessToken"] ?? null;
        $refreshCookie = $cookies["facultyRefreshToken"] ?? $cookies["refreshToken"] ?? null;
        if ($accessCookie !== null) {
            if (!in_array("Path=/", $accessCookie["attributes"], true)
                || !in_array("SameSite=Strict", $accessCookie["attributes"], true)
                || !in_array("Domain=libtools2.smith.edu", $accessCookie["attributes"], true)
                || !in_array("Secure", $accessCookie["attributes"], true)
                || in_array("HttpOnly", $accessCookie["attributes"], true)) {
                $failures[] = "faculty access cookie attributes changed";
            }
            $expires = null;
            foreach ($accessCookie["attributes"] as $attribute) {
                if (stripos($attribute, "Expires=") === 0) {
                    $expires = substr($attribute, strlen("Expires="));
                }
            }
            try {
                $claims = (array) \Firebase\JWT\JWT::decode(
                    $accessCookie["value"],
                    new \Firebase\JWT\Key(getenv("JWT_SECRET_KEY"), "HS256")
                );
                if ($claims["exp"] - $claims["iat"] !== 28800) {
                    $failures[] = "faculty-authorize access token lifetime was not 28800 seconds";
                }
                if ($expires === null || strtotime($expires) !== $claims["exp"]) {
                    $failures[] = "faculty access cookie Expires did not match token exp";
                }
                if (strpos($headers, "Location: https://libtools2.smith.edu/course-reserves/faculty") === false) {
                    $failures[] = "faculty-authorize redirect changed";
                }
            } catch (\Throwable $error) {
                $failures[] = "faculty-authorize access token could not be decoded";
            }
        }
        if ($refreshCookie !== null) {
            if (!in_array("Path=/", $refreshCookie["attributes"], true)
                || !in_array("HttpOnly", $refreshCookie["attributes"], true)
                || !in_array("SameSite=Strict", $refreshCookie["attributes"], true)
                || !in_array("Domain=libtools2.smith.edu", $refreshCookie["attributes"], true)
                || !in_array("Secure", $refreshCookie["attributes"], true)) {
                $failures[] = "faculty refresh cookie attributes changed";
            }
            $expires = null;
            foreach ($refreshCookie["attributes"] as $attribute) {
                if (stripos($attribute, "Expires=") === 0) {
                    $expires = substr($attribute, strlen("Expires="));
                }
            }
            try {
                $claims = (array) \Firebase\JWT\JWT::decode(
                    $refreshCookie["value"],
                    new \Firebase\JWT\Key(getenv("JWT_REFRESH_SECRET_KEY"), "HS256")
                );
                if ($claims["exp"] - $claims["iat"] !== 86400) {
                    $failures[] = "faculty-authorize refresh token lifetime was not 86400 seconds";
                }
                if ($expires === null || strtotime($expires) !== $claims["exp"]) {
                    $failures[] = "faculty refresh cookie Expires did not match token exp";
                }
            } catch (\Throwable $error) {
                $failures[] = "faculty-authorize refresh token could not be decoded";
            }
            file_put_contents("/tmp/api054-faculty-refresh-token", $refreshCookie["value"]);
        }
        foreach ($failures as $failure) {
            echo "FAIL: $failure\n";
        }
        if (!$failures) {
            echo "faculty-authorize -> faculty cookies, attributes and 28800-second access lifetime passed\n";
        }
    ' "$headers")
    printf '%s\n' "$validation"
    case "$validation" in
        *FAIL:*) faculty_entrypoint_failures=1 ;;
    esac
    if [ -s /tmp/api054-faculty-refresh-token ]; then
        faculty_refresh_token=$(php -r 'echo file_get_contents($argv[1]);' /tmp/api054-faculty-refresh-token)
    else
        printf 'FAIL: faculty-authorize did not provide a refresh token for refresh checks\n' >&2
        faculty_entrypoint_failures=1
        faculty_refresh_token=
    fi
}

check_faculty_refresh_tokens() {
    if [ -z "$faculty_refresh_token" ]; then
        return
    fi

    sleep 1
    headers=/tmp/api054-faculty-refresh-headers
    body=/tmp/api054-faculty-refresh-body
    status=$(curl -sS -X POST -D "$headers" -o "$body" -w '%{http_code}' \
        -H 'Host: libtools2.smith.edu' -H 'X-Forwarded-Proto: https' \
        --cookie "facultyRefreshToken=$faculty_refresh_token" \
        "http://127.0.0.1:$port/admin/faculty-refresh-token.php")
    if [ "$status" != 200 ]; then
        printf 'FAIL: faculty refresh cookie returned HTTP %s; expected 200\n' "$status" >&2
        faculty_entrypoint_failures=1
    else
        rotation=$(php -r '
            $headers = file_get_contents($argv[1]);
            $body = json_decode(file_get_contents($argv[2]), true);
            $original = $argv[3];
            $cookie = null;
            $attributes = [];
            foreach (preg_split("/\\r?\\n/", $headers) as $line) {
                $prefix = "Set-Cookie: facultyRefreshToken=";
                if (stripos($line, $prefix) === 0) {
                    $parts = explode(";", trim(substr(trim($line), strlen($prefix))));
                    $cookie = rawurldecode(array_shift($parts));
                    $attributes = array_map("trim", $parts);
                }
            }
            $failures = [];
            if (!is_array($body) || !isset($body["accessToken"], $body["refreshToken"])) {
                $failures[] = "faculty refresh JSON fields accessToken/refreshToken were missing";
            }
            if ($cookie === null) {
                $failures[] = "faculty refresh did not set the facultyRefreshToken cookie";
            } elseif ($cookie === $original) {
                $failures[] = "faculty refresh did not rotate its refresh token";
            }
            if (!in_array("Path=/", $attributes, true)
                || !in_array("HttpOnly", $attributes, true)
                || !in_array("SameSite=Strict", $attributes, true)
                || !in_array("Domain=libtools2.smith.edu", $attributes, true)
                || !in_array("Secure", $attributes, true)) {
                $failures[] = "faculty refresh cookie attributes changed";
            }
            if ($cookie !== null && isset($body["refreshToken"]) && $cookie !== $body["refreshToken"]) {
                $failures[] = "faculty refresh cookie did not match JSON refreshToken";
            }
            foreach ($failures as $failure) {
                echo "FAIL: $failure\n";
            }
            if (!$failures) {
                echo "faculty refresh cookie -> 200, facultyRefreshToken rotated; JSON accessToken/refreshToken preserved\n";
            }
        ' "$headers" "$body" "$faculty_refresh_token")
        printf '%s\n' "$rotation"
        case "$rotation" in
            *FAIL:*) faculty_entrypoint_failures=1 ;;
        esac
    fi

    status=$(curl -sS -X POST -H 'Content-Type: application/json' \
        -H 'Host: libtools2.smith.edu' -H 'X-Forwarded-Proto: https' \
        -d "{\"refreshToken\":\"$faculty_refresh_token\"}" \
        -o "$body" -w '%{http_code}' "http://127.0.0.1:$port/admin/faculty-refresh-token.php")
    if [ "$status" != 200 ]; then
        printf 'FAIL: faculty JSON body refreshToken fallback returned HTTP %s; expected 200\n' "$status" >&2
        faculty_entrypoint_failures=1
    else
        body_fields=$(php -r '
            $body = json_decode(file_get_contents($argv[1]), true);
            if (!is_array($body) || !isset($body["accessToken"], $body["refreshToken"])) {
                echo "FAIL: faculty JSON body fallback did not return accessToken/refreshToken\n";
            } else {
                echo "faculty JSON body refreshToken fallback -> 200; accessToken/refreshToken preserved\n";
            }
        ' "$body")
        printf '%s\n' "$body_fields"
        case "$body_fields" in
            *FAIL:*) faculty_entrypoint_failures=1 ;;
        esac
    fi

    status=$(curl -sS -X POST -H 'Host: libtools2.smith.edu' -H 'X-Forwarded-Proto: https' \
        --cookie "refreshToken=$faculty_refresh_token" \
        -o "$body" -w '%{http_code}' "http://127.0.0.1:$port/admin/faculty-refresh-token.php")
    if [ "$status" != 401 ]; then
        printf 'FAIL: staff-named refreshToken cookie returned HTTP %s; expected 401\n' "$status" >&2
        faculty_entrypoint_failures=1
    else
        printf 'staff-named refreshToken cookie only -> HTTP 401\n'
    fi
}

check_status /web/index.php/__api054_probe 404
if [ "$environment" = test ]; then
    check_status /web/index-test.php 200
else
    check_status /web/index-test.php 404
fi
check_status /admin/authorize.php '400 401'
if [ "$environment" = test ]; then
    check_status /admin/faculty-authorize.php 302
else
    check_status /admin/faculty-authorize.php '400 401'
fi
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
if [ "$faculty_entrypoint_failures" -ne 0 ]; then
    exit 1
fi
CONTAINER_SCRIPT
done

for environment in unset staging dev test prod; do
    if [ "$environment" = unset ]; then
        bootstrap_result=$(docker run --rm --network none \
            -v "$ROOT/apps/api:/app:ro" -v "$ROOT/apps/api/vendor:/app/vendor:ro" \
            php:7.4 php -r 'require "/app/tests/_bootstrap.php"; echo YII_ENV . ":" . (YII_DEBUG ? "1" : "0");')
        docker_bootstrap_result=$(docker run --rm --network none \
            -v "$ROOT/apps/api:/app:ro" -v "$ROOT/apps/api/vendor:/app/vendor:ro" \
            -v "$ROOT/docker/test/bootstrap.php:/app/tests/_bootstrap.php:ro" \
            php:7.4 php -r 'require "/app/tests/_bootstrap.php"; echo YII_ENV . ":" . (YII_DEBUG ? "1" : "0");')
    else
        bootstrap_result=$(docker run --rm --network none -e YII_ENV="$environment" \
            -v "$ROOT/apps/api:/app:ro" -v "$ROOT/apps/api/vendor:/app/vendor:ro" \
            php:7.4 php -r 'require "/app/tests/_bootstrap.php"; echo YII_ENV . ":" . (YII_DEBUG ? "1" : "0");')
        docker_bootstrap_result=$(docker run --rm --network none -e YII_ENV="$environment" \
            -v "$ROOT/apps/api:/app:ro" -v "$ROOT/apps/api/vendor:/app/vendor:ro" \
            -v "$ROOT/docker/test/bootstrap.php:/app/tests/_bootstrap.php:ro" \
            php:7.4 php -r 'require "/app/tests/_bootstrap.php"; echo YII_ENV . ":" . (YII_DEBUG ? "1" : "0");')
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
