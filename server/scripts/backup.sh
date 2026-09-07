#!/usr/bin/env bash

set -Eeuo pipefail
umask 077
export LC_ALL=C

fail() {
  printf 'Error: %s\n' "$1" >&2
  exit 1
}

if (( $# > 1 )); then
  fail 'Usage: backup.sh [destination]'
fi

[[ -n "${DATABASE_URL:-}" ]] || fail 'DATABASE_URL is required.'
[[ -n "${STORAGE_PATH:-}" ]] || fail 'STORAGE_PATH is required.'

for required_command in pg_dump realpath tar sha256sum mktemp mv date mkdir chmod rm; do
  command -v "$required_command" >/dev/null 2>&1 || fail "$required_command is required."
done

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
server_dir="$(cd -- "$script_dir/.." && pwd -P)"
timestamp="$(date -u +'%Y%m%dT%H%M%SZ')"
destination="${1:-$server_dir/backups/$timestamp}"

if [[ -e "$destination" || -L "$destination" ]]; then
  fail 'Destination already exists.'
fi

destination_parent="$(dirname -- "$destination")"
destination_name="$(basename -- "$destination")"
mkdir -p -- "$destination_parent" || fail 'Could not create the destination parent directory.'

if [[ ! -d "$destination_parent" ]]; then
  fail 'Destination parent is not a directory.'
fi
if [[ -e "$destination" || -L "$destination" ]]; then
  fail 'Destination already exists.'
fi

storage_input="$STORAGE_PATH"
while [[ "$storage_input" != '/' && "$storage_input" == */ ]]; do
  storage_input="${storage_input%/}"
done
if [[ -L "$storage_input" ]]; then
  fail 'STORAGE_PATH must not be a symbolic link.'
fi
if ! storage_dir="$(realpath -e -- "$storage_input" 2>/dev/null)"; then
  fail 'STORAGE_PATH could not be resolved.'
fi
if [[ ! -d "$storage_dir" || -L "$storage_dir" ]]; then
  fail 'STORAGE_PATH must resolve to a real, non-symbolic-link directory.'
fi

temp_dir=''
cleanup() {
  if [[ -n "$temp_dir" && ( -d "$temp_dir" || -L "$temp_dir" ) ]]; then
    rm -rf -- "$temp_dir"
  fi
}
trap cleanup EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM

temp_dir="$(mktemp -d -- "$destination_parent/.${destination_name}.tmp.XXXXXX")" \
  || fail 'Could not create the temporary backup directory.'
chmod 700 -- "$temp_dir"

if ! (
  cd -- "$temp_dir"
  pg_dump --dbname "$DATABASE_URL" --format=custom --no-owner --no-privileges --file database.dump
) >/dev/null 2>&1; then
  fail 'Database backup failed.'
fi

if ! tar --create \
  --file "$temp_dir/storage.tar" \
  --directory "$storage_dir" \
  --transform='s|^\.$|storage|' \
  --transform='s|^\./|storage/|' \
  . >/dev/null 2>&1; then
  fail 'Storage backup failed.'
fi

if ! (
  cd -- "$temp_dir"
  sha256sum -- database.dump storage.tar > manifest.sha256
) >/dev/null 2>&1; then
  fail 'Could not create the SHA-256 manifest.'
fi

chmod 600 -- "$temp_dir/database.dump" "$temp_dir/storage.tar" "$temp_dir/manifest.sha256"

if ! mv --no-clobber --no-target-directory -- "$temp_dir" "$destination"; then
  fail 'Could not finalize the backup.'
fi
if [[ -e "$temp_dir" || -L "$temp_dir" ]]; then
  fail 'Destination already exists.'
fi

temp_dir=''
printf '%s\n' "$destination"