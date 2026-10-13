# Isolated API test stack

This standalone Compose stack uses MariaDB 10.3, an internal-only network, no host ports,
synthetic credentials and project-scoped volumes. The test database starts from
`packages/database/schema.sql` plus `docker/test/seed-test-users.sql`; the runner then applies Yii
migrations and the synthetic faculty workflow seed. The backend loads only the synthetic
configuration in `docker/test/app.env`.

Run setup and tests from the repository root. Tests must never run against the development stack.
Do not use `docker/start.sh` or `docker-compose.yml` for API tests.

## Prerequisites

Install Composer dependencies with the PHP 7.2 image. The image needs Composer and ZIP support;
Debian Buster uses the archive mirrors. The install skips Yii's post-install script so it cannot
write a generated cookie key into `config/web.php`:

```sh
docker run --rm \
  -v "$PWD/apps/api:/app" \
  -w /app \
  --entrypoint sh php:7.2 -c '
    set -e
    sed -i "s|http://deb.debian.org/debian|http://archive.debian.org/debian|g" /etc/apt/sources.list
    sed -i "s|http://security.debian.org/debian-security|http://archive.debian.org/debian-security|g" /etc/apt/sources.list
    sed -i "/buster-updates/d" /etc/apt/sources.list
    apt-get -o Acquire::Check-Valid-Until=false update
    apt-get install -y --no-install-recommends libzip-dev unzip
    docker-php-ext-install zip
    php -r "copy(\"https://getcomposer.org/installer\", \"/tmp/composer-setup.php\");"
    php /tmp/composer-setup.php --version=2.2.24 --install-dir=/usr/local/bin --filename=composer
    COMPOSER_MAX_PARALLEL_HTTP=1 php -d disable_functions=curl_multi_init,curl_multi_exec \
      /usr/local/bin/composer install --no-interaction --prefer-dist --no-scripts
  '
```

The disabled cURL multi functions make Composer use PHP's HTTPS stream transport. In this
PHP 7.2 container, the cURL downloader can terminate with an illegal-instruction signal while
requesting the locked Bootstrap archive from the npm registry.

Prepare the read-only source mount points and generated Codeception actor traits:

```sh
test -e apps/api/.env || touch apps/api/.env
mkdir -p apps/api/runtime apps/api/tests/_output apps/api/web/assets
docker run --rm --network none \
  -v "$PWD/apps/api:/app" \
  -w /app \
  --entrypoint php php:7.2 vendor/bin/codecept build
```

## Run the API suites

```sh
docker/test/run-api-tests.sh [project-name]
```

The runner builds and starts the isolated stack, applies migrations, verifies that a second
migration run is a no-op, seeds the synthetic faculty workflow fixture, runs both API suites and
removes its containers and volumes on exit. Set `KEEP_STACK=1` to keep the stack for debugging;
remove it manually when finished.

To test a separate worktree, set `COURSE_RESERVES_TEST_SOURCE` to its path for the runner
and every Compose command. The default source is the current repository directory.

## Manual steps for debugging

Use a project name reserved for this test run, such as `cr-test-debug`, and include the test Compose
file on every command:

```sh
docker compose -f docker-compose.test.yml -p cr-test-debug up -d --build --wait
docker compose -f docker-compose.test.yml -p cr-test-debug exec -T backend php yii migrate/up --interactive=0
docker compose -f docker-compose.test.yml -p cr-test-debug exec -T backend php yii test-data/seed-faculty-workflow
docker compose -f docker-compose.test.yml -p cr-test-debug exec -T backend php -d register_argc_argv=On vendor/bin/codecept run unit --no-colors
docker compose -f docker-compose.test.yml -p cr-test-debug exec -T backend php -d register_argc_argv=On vendor/bin/codecept run functional --no-colors
docker compose -f docker-compose.test.yml -p cr-test-debug down -v --remove-orphans
```
