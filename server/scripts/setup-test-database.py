#!/usr/bin/env python3
"""Provisioning lokal eksplisit setelah persetujuan; tidak pernah membaca .env utama."""
import getpass
import os
from pathlib import Path
import re
import secrets
import shutil
import subprocess
import sys
import tempfile
from urllib.parse import quote

ROOT = Path(__file__).resolve().parents[1]


def stop(message):
    print(message)
    raise SystemExit(1)


def option(value):
    if any(c in value for c in '\r\n\0'):
        stop('Input mengandung karakter yang tidak diizinkan.')
    return '"' + value.replace('\\', '\\\\').replace('"', '\\"') + '"'


def main():
    if sys.argv[1:] != ['--approved']:
        stop('DITOLAK: persetujuan pembuatan database, akun, dan grant diperlukan (--approved).')
    if not sys.stdin.isatty() or not sys.stderr.isatty():
        stop('DITOLAK: jalankan dari terminal pribadi interaktif agar input rahasia tidak diecho atau direkam.')
    mysql = shutil.which('mysql')
    if not mysql:
        stop('MySQL client belum tersedia di PATH.')
    destination = ROOT / '.env.test'
    if destination.exists():
        stop('DITOLAK: .env.test sudah ada; konfigurasi lokal tidak ditimpa.')
    print('Target tetap: MySQL loopback 127.0.0.1, database whylet_test. Tidak menyentuh whylet_db.')
    admin = getpass.getpass('Identitas administrator MySQL (input disembunyikan): ')
    admin_password = getpass.getpass('Kata sandi administrator MySQL (boleh kosong hanya jika sesuai konfigurasi aktual): ')
    account = getpass.getpass('Pilih identitas akun MySQL testing baru (input disembunyikan): ')
    if not re.fullmatch(r'[a-z][a-z0-9_]{2,31}', account) or account.lower() == 'root' or account == admin:
        stop('DITOLAK: identitas testing harus baru, berbeda dari administrator, 3–32 karakter a-z/0-9/underscore.')
    port = input('Port MySQL lokal yang sudah diverifikasi: ').strip()
    if not port.isdigit() or not 1 <= int(port) <= 65535:
        stop('Port tidak valid.')
    # Berkas opsi sementara menghindari password pada argv/process list/log.
    with tempfile.TemporaryDirectory(prefix='whylet-test-admin-') as directory:
        config = Path(directory) / 'client.cnf'
        fd = os.open(config, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
        with os.fdopen(fd, 'w') as handle:
            handle.write('[client]\nuser=' + option(admin) + '\npassword=' + option(admin_password) + '\nhost=127.0.0.1\nport=' + port + '\nprotocol=TCP\n')
        def execute(sql):
            result = subprocess.run([mysql, '--defaults-file=' + str(config), '--no-login-paths', '--batch', '--skip-column-names', '--connect-timeout=5'], input=sql, text=True, capture_output=True, timeout=30)
            if result.returncode:
                stop('Operasi MySQL gagal; detail disembunyikan. Jangan mengulang provisioning tanpa memeriksa keadaan parsial melalui administrator.')
            return result.stdout.strip()
        existing = execute("SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = 'whylet_test';")
        if existing:
            stop('DITOLAK: whylet_test sudah ada. Tidak diubah; gunakan akun terbatas yang telah diverifikasi.')
        # CREATE USER juga akan menolak nama akun yang sudah ada, tanpa menimpanya.
        password = secrets.token_hex(32)
        url = 'mysql://' + quote(account, safe='') + ':' + quote(password, safe='') + '@127.0.0.1:' + port + '/whylet_test'
        # Simpan koneksi sebelum operasi agar keadaan parsial tetap dapat ditangani secara privat.
        fd = os.open(destination, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
        with os.fdopen(fd, 'w') as handle:
            handle.write('TEST_DATABASE_URL=' + url + '\n')
        sql = (
            'CREATE DATABASE `whylet_test` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;\n'
            + "CREATE USER '" + account + "'@'127.0.0.1' IDENTIFIED BY '" + password + "';\n"
            + 'GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, DROP, INDEX, REFERENCES ON `whylet\\_test`.* TO '
            + "'" + account + "'@'127.0.0.1';\n"
        )
        execute(sql)
    print('Setup selesai. Koneksi tersimpan privat di server/.env.test (0600); belum ada migrasi yang dijalankan.')
    print('Jalankan npm run test:integration:check dari server. Migrasi memerlukan persetujuan terpisah.')


if __name__ == '__main__':
    try:
        main()
    except (EOFError, KeyboardInterrupt):
        stop('Setup dibatalkan; detail input tidak dicetak.')
    except Exception:
        stop('Setup gagal; detail sensitif disembunyikan. Periksa keadaan parsial sebelum mencoba lagi.')
