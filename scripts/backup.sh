#!/usr/bin/env bash
set -euo pipefail
umask 077
: "${WHYLET_MYSQL_CONFIG:?Path file opsi client privat diperlukan}"
: "${WHYLET_BACKUP_DATABASE:?Nama database diperlukan}"
: "${WHYLET_BACKUP_RECIPIENT:?Public key age diperlukan}"
: "${WHYLET_BACKUP_DIR:?Direktori backup privat diperlukan}"
[[ "$WHYLET_BACKUP_DATABASE" =~ ^[a-zA-Z0-9_]+$ ]] || exit 1
command -v mysqldump >/dev/null
command -v age >/dev/null
python3 - "$WHYLET_MYSQL_CONFIG" <<'PY'
import os,sys,stat
info=os.stat(sys.argv[1])
if stat.S_IMODE(info.st_mode)&0o077: raise SystemExit('File opsi MySQL harus privat (0600).')
PY
mkdir -p "$WHYLET_BACKUP_DIR"
backup_file="$WHYLET_BACKUP_DIR/whylet-$(date -u +%Y%m%dT%H%M%SZ).sql.gz.age"
mysqldump --defaults-extra-file="$WHYLET_MYSQL_CONFIG" --single-transaction --no-tablespaces --routines --triggers --events "$WHYLET_BACKUP_DATABASE" | gzip | age -r "$WHYLET_BACKUP_RECIPIENT" -o "$backup_file"
echo "Backup terenkripsi selesai. Verifikasi dan uji restore terpisah sebelum mengandalkannya."
