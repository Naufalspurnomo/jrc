#!/usr/bin/env bash
set -Eeuo pipefail
IFS=$'\n\t'
umask 077
export LC_ALL=C

usage() {
    printf 'Usage: %s BACKUP_DIR --confirm-restore\n' "${0##*/}" >&2
}

fail() {
    printf 'Error: %s\n' "$1" >&2
    exit 1
}

if (( $# != 2 )) || [[ "$2" != "--confirm-restore" ]]; then
    usage
    exit 2
fi

[[ -n "${DATABASE_URL:-}" ]] || fail 'DATABASE_URL is required.'
[[ -n "${STORAGE_PATH:-}" ]] || fail 'STORAGE_PATH is required.'

backup_arg=$1
[[ -d "$backup_arg" ]] || fail 'BACKUP_DIR must be a directory.'
backup_dir=$(cd -- "$backup_arg" && pwd -P) || fail 'Cannot resolve BACKUP_DIR.'

for required_file in manifest.sha256 database.dump storage.tar; do
    [[ -f "$backup_dir/$required_file" && ! -L "$backup_dir/$required_file" ]] \
        || fail "Backup file is missing or not a regular file: $required_file"
done

command -v sha256sum >/dev/null 2>&1 || fail 'sha256sum is required.'
command -v python3 >/dev/null 2>&1 || fail 'python3 is required.'
command -v tar >/dev/null 2>&1 || fail 'tar is required.'
command -v pg_restore >/dev/null 2>&1 || fail 'pg_restore is required.'

printf 'Verifying backup checksums...\n'
(
    cd -- "$backup_dir"
    sha256sum --check --strict -- manifest.sha256
) || fail 'Backup checksum verification failed.'

printf 'Validating storage archive...\n'
python3 - "$backup_dir/storage.tar" <<'PY'
import sys
import tarfile
from pathlib import PurePosixPath

archive_path = sys.argv[1]

try:
    with tarfile.open(archive_path, mode="r:*") as archive:
        members = archive.getmembers()
        for member in members:
            name = member.name
            path = PurePosixPath(name)
            parts = path.parts

            if not name:
                raise ValueError("empty archive entry name")
            if "\\" in name:
                raise ValueError(f"backslash in archive entry: {name!r}")
            if path.is_absolute() or name.startswith("/"):
                raise ValueError(f"absolute archive entry: {name!r}")
            if ".." in parts:
                raise ValueError(f"parent traversal in archive entry: {name!r}")
            if not parts or parts[0] != "storage":
                raise ValueError(f"archive entry outside storage/: {name!r}")
            if len(parts) == 1 and not member.isdir():
                raise ValueError("storage archive root is not a directory")
            if member.issym() or member.islnk():
                raise ValueError(f"link entry is not allowed: {name!r}")
            if not (member.isfile() or member.isdir()):
                raise ValueError(f"unsupported archive entry type: {name!r}")
except (tarfile.TarError, OSError, ValueError) as exc:
    print(f"Error: invalid storage archive: {exc}", file=sys.stderr)
    raise SystemExit(1)
PY

storage_path=${STORAGE_PATH}
while [[ "$storage_path" != "/" && "$storage_path" == */ ]]; do
    storage_path=${storage_path%/}
done
[[ "$storage_path" != "/" ]] || fail 'STORAGE_PATH cannot be the filesystem root.'

storage_name=$(basename -- "$storage_path")
[[ "$storage_name" != "." && "$storage_name" != ".." ]] \
    || fail 'STORAGE_PATH must name a storage directory.'
storage_parent_arg=$(dirname -- "$storage_path")
[[ -d "$storage_parent_arg" ]] || fail 'The parent directory of STORAGE_PATH does not exist.'
storage_parent=$(cd -- "$storage_parent_arg" && pwd -P) \
    || fail 'Cannot resolve the parent directory of STORAGE_PATH.'
storage_path="$storage_parent/$storage_name"

if [[ -e "$storage_path" || -L "$storage_path" ]]; then
    [[ -d "$storage_path" && ! -L "$storage_path" ]] \
        || fail 'Existing STORAGE_PATH must be a real directory.'
fi

temp_dir=''
rollback_saved=0
restore_complete=0

cleanup() {
    local status=$?
    local rollback_ok=1
    trap - EXIT INT TERM HUP

    if (( restore_complete == 0 && rollback_saved == 1 )) \
        && [[ -d "$temp_dir/rollback" && ! -L "$temp_dir/rollback" ]]; then
        if [[ -e "$storage_path" || -L "$storage_path" ]]; then
            if ! mv -- "$storage_path" "$temp_dir/failed-storage"; then
                printf 'Error: could not move the incomplete restored storage aside.\n' >&2
                rollback_ok=0
            fi
        fi
        if (( rollback_ok == 1 )); then
            if mv -- "$temp_dir/rollback" "$storage_path"; then
                printf 'Previous storage restored after failure.\n' >&2
            else
                printf 'Error: automatic storage rollback failed; rollback remains in the temporary directory.\n' >&2
                rollback_ok=0
            fi
        fi
    fi

    if [[ -n "$temp_dir" && -d "$temp_dir" ]]; then
        if (( restore_complete == 1 || rollback_ok == 1 )); then
            rm -rf -- "$temp_dir"
        else
            printf 'Recovery data retained at: %s\n' "$temp_dir" >&2
        fi
    fi

    exit "$status"
}

trap cleanup EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM

temp_dir=$(mktemp -d -- "$storage_parent/.restore.${storage_name}.XXXXXXXX") \
    || fail 'Could not create the temporary restore directory.'
chmod 0700 -- "$temp_dir"

printf 'Extracting storage backup...\n'
tar --extract --file "$backup_dir/storage.tar" --directory "$temp_dir"
[[ -d "$temp_dir/storage" && ! -L "$temp_dir/storage" ]] \
    || fail 'The storage archive did not produce a storage directory.'

printf 'Restoring database...\n'
pg_restore --dbname "$DATABASE_URL" --clean --if-exists --no-owner --no-privileges --exit-on-error \
    "$backup_dir/database.dump"

printf 'Installing restored storage...\n'
if [[ -d "$storage_path" && ! -L "$storage_path" ]]; then
    rollback_saved=1
    mv -- "$storage_path" "$temp_dir/rollback"
fi

mv -- "$temp_dir/storage" "$storage_path"
restore_complete=1

rm -rf -- "$temp_dir"
temp_dir=''
printf 'Restore completed successfully.\n'
