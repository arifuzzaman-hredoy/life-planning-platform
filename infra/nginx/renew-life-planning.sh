#!/bin/sh
# Certbot deploy hook: only this project's renewal triggers a graceful reload.
set -eu
if [ "${RENEWED_LINEAGE:-}" = /etc/letsencrypt/live/myplan.oxytumzone.com ]; then
    /usr/sbin/nginx -t
    /usr/bin/systemctl reload nginx
fi
