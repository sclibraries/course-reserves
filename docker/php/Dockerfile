FROM yiisoftware/yii2-php:7.2-apache

# ── Fix EOL Debian Buster repos → archive ───────────────────────────────────
RUN sed -i 's|http://deb.debian.org/debian|http://archive.debian.org/debian|g' /etc/apt/sources.list \
    && sed -i 's|http://security.debian.org/debian-security|http://archive.debian.org/debian-security|g' /etc/apt/sources.list \
    && sed -i '/buster-updates/d' /etc/apt/sources.list

# ── System dependencies ─────────────────────────────────────────────────────
RUN apt-get update && apt-get install -y \
    libzip-dev \
    unzip \
    curl \
    && rm -rf /var/lib/apt/lists/*

# ── PHP extensions ──────────────────────────────────────────────────────────
# pdo_mysql, zip, and opcache are required by Yii2
RUN docker-php-ext-install \
    pdo_mysql \
    zip \
    opcache

# ── Apache configuration ────────────────────────────────────────────────────
# Enable mod_rewrite (required by Yii2 pretty URLs via .htaccess)
RUN a2enmod rewrite

# Copy our virtual host config — this replaces the default 000-default.conf
COPY apache-vhost.conf /etc/apache2/sites-available/000-default.conf

# Copy PHP development settings
COPY php.ini /usr/local/etc/php/conf.d/app.ini

# ── Document root ───────────────────────────────────────────────────────────
# The Yii2 web root is /app/web (volume-mounted from ./backend/course-reserves/backend)
WORKDIR /app

EXPOSE 80
