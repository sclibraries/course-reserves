# Isolated API test stack

This Compose stack uses MariaDB 10.3, an internal-only network, no host ports, synthetic
credentials, and project-scoped volumes. The API source and installed Composer dependencies are
mounted read-only. Its database starts from `packages/database/schema.sql`; Yii migrations and the
synthetic faculty workflow seed are explicit steps. `docker/test/app.env` is loaded into the
backend process before Yii reads its configuration and is also mounted at `/app/.env`.

Run the commands from the repository root. The official PHP 7.2 image needs Composer and ZIP
support installed for a clean dependency install. Debian Buster uses the archive mirrors. This
container command skips Yii's post-install script so it cannot write a generated cookie key into
`config/web.php`:

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

After installing dependencies, prepare the read-only source mount points and generated
Codeception actor traits:

```sh
test -e apps/api/.env || touch apps/api/.env
mkdir -p apps/api/runtime apps/api/tests/_output apps/api/web/assets
docker run --rm --network none \
  -v "$PWD/apps/api:/app" \
  -w /app \
  --entrypoint php php:7.2 vendor/bin/codecept build
```

Build and start the isolated project, then migrate and seed it:

```sh
docker compose -f docker-compose.test.yml -p cr-test up -d --build
docker compose -f docker-compose.test.yml -p cr-test exec -T backend php yii migrate/up --interactive=0
docker compose -f docker-compose.test.yml -p cr-test exec -T backend php yii test-data/seed-faculty-workflow
```

Run the API suites:

```sh
docker compose -f docker-compose.test.yml -p cr-test exec -T backend \
  php -d register_argc_argv=On vendor/bin/codecept run unit --no-colors
docker compose -f docker-compose.test.yml -p cr-test exec -T backend \
  php -d register_argc_argv=On vendor/bin/codecept run functional --no-colors
```

Remove this project's containers and volumes after the run:

```sh
docker compose -f docker-compose.test.yml -p cr-test down -v --remove-orphans
```

For a separate worktree, set `COURSE_RESERVES_TEST_SOURCE` to its path for every Compose command.
The default source is the current repository directory. This test project does not use the
development Compose file or its database volume.
