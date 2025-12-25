#!/usr/bin/env sh
set -e

# Run Django database migrations (SQLite). Safe even if there are none.
python manage.py migrate --noinput

# Collect static assets into STATIC_ROOT (shared volume in prod compose).
python manage.py collectstatic --noinput

exec "$@"
