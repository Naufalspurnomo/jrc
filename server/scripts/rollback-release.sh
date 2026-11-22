#!/usr/bin/env bash
set -Eeuo pipefail
IFS=$'\n\t'
umask 077
export LC_ALL=C
usage() { printf 'Usage: rollback-release.sh --check ROLLBACK_RECORD | --apply ROLLBACK_RECORD\n'; }
fail() { printf 'Error: %s\n' "$1" >&2; exit 1; }
[[ $# == 2 ]] || { usage >&2; exit 2; }
case "$1" in --check) mode=check;; --apply) mode=apply;; *) usage >&2; exit 2;; esac
record=$2
for c in docker sha256sum mktemp mv rm readlink dirname; do command -v "$c" >/dev/null 2>&1 || fail "$c is required."; done
[[ -f "$record" && ! -L "$record" ]] || fail 'Rollback record must be a regular non-symlink file.'
[[ "$record" != *$'\n'* && "$record" != *$'\r'* ]] || fail 'Unsafe rollback record path.'
[[ "$record" == "$JRC_ROLLBACK_DIR"/rollback-*.record && "$(realpath -- "$record")" == "$record" ]] || fail 'Rollback record is outside JRC_ROLLBACK_DIR.'
declare -A data=(); required=(version release_sha previous_frontend previous_marker previous_api_image previous_migration_image new_api_image new_migration_image release_root current_symlink marker backup_dir repository_root compose_file compose_env_file)
while IFS='=' read -r key value; do [[ "$key" =~ ^[a-z_]+$ && -z "${data[$key]+x}" ]] || fail 'Malformed rollback record.'; data[$key]=$value; done <"$record"
for key in "${required[@]}"; do [[ -n "${data[$key]:-}" ]] || fail "Rollback record is missing $key."; done
[[ ${#data[@]} == ${#required[@]} && "${data[version]}" == 1 && "${data[release_sha]}" =~ ^[0-9a-f]{40}$ && "${data[previous_marker]}" =~ ^[A-Za-z0-9._-]+$ ]] || fail 'Malformed rollback record.'
for key in previous_frontend previous_api_image previous_migration_image new_api_image new_migration_image release_root current_symlink marker backup_dir repository_root compose_file compose_env_file; do value=${data[$key]}; [[ "$value" != *$'\n'* && "$value" != *$'\r'* && "$value" != *$'\t'* && "$value" != *';'* && "$value" != *'`'* && "$value" != *'$('* ]] || fail 'Unsafe value in rollback record.'; done
[[ -d "${data[previous_frontend]}" && ! -L "${data[previous_frontend]}" && "${data[previous_frontend]}" == "${data[release_root]}"/* ]] || fail 'Previous frontend target is invalid.'
[[ -d "${data[backup_dir]}" && ! -L "${data[backup_dir]}" && -f "${data[backup_dir]}/SHA256SUMS" && ! -L "${data[backup_dir]}/SHA256SUMS" ]] || fail 'Backup directory or manifest is unsafe.'
( cd -- "${data[backup_dir]}" && sha256sum --check --strict -- SHA256SUMS >/dev/null ) || fail 'Backup checksum verification failed.'
[[ -d "${data[repository_root]}" && ! -L "${data[repository_root]}" && -f "${data[compose_file]}" && ! -L "${data[compose_file]}" && -f "${data[compose_env_file]}" && ! -L "${data[compose_env_file]}" ]] || fail 'Compose paths are invalid.'
valid_image() { [[ "$1" =~ ^[A-Za-z0-9._/:@-]+$ ]] && { [[ "$1" =~ @sha256:[0-9a-f]{64}$ ]] || [[ "$1" =~ :.*[0-9a-f]{40}.*$ ]]; }; }
valid_image "${data[previous_api_image]}" && valid_image "${data[previous_migration_image]}" && valid_image "${data[new_api_image]}" && valid_image "${data[new_migration_image]}" || fail 'Rollback record contains a mutable or malformed image reference.'
[[ -L "${data[current_symlink]}" ]] || fail 'Current frontend pointer is not a symbolic link.'
[[ -f "${data[marker]}" && ! -L "${data[marker]}" ]] || fail 'Current release marker is invalid.'
[[ "$(<"${data[marker]}")" == "${data[release_sha]}" && "$(readlink -- "${data[current_symlink]}")" == "${data[release_root]}/${data[release_sha]}" ]] || fail 'Rollback record is stale.'
compose=(docker compose --project-directory "${data[repository_root]}" --file "${data[compose_file]}" --env-file "${data[compose_env_file]}")
JRC_API_IMAGE="${data[previous_api_image]}" JRC_MIGRATION_IMAGE="${data[previous_migration_image]}" API_IMAGE="${data[previous_api_image]}" MIGRATION_IMAGE="${data[previous_migration_image]}" "${compose[@]}" config --format json >/dev/null || fail 'Compose configuration does not resolve.'
printf 'Database migrations are not reversed by rollback.\n' >&2
[[ "$mode" == apply ]] || { printf 'Rollback preflight successful.\n'; exit 0; }
JRC_API_IMAGE="${data[previous_api_image]}" JRC_MIGRATION_IMAGE="${data[previous_migration_image]}" API_IMAGE="${data[previous_api_image]}" MIGRATION_IMAGE="${data[previous_migration_image]}" "${compose[@]}" up -d --no-deps --force-recreate jrc-api
retries="${JRC_HEALTH_RETRIES:-30}"; interval="${JRC_HEALTH_INTERVAL_SECONDS:-2}"; [[ "$retries" =~ ^[1-9][0-9]*$ && "$interval" =~ ^[0-9]+$ ]] || fail 'Health retry settings are invalid.'
healthy=0; for ((i=1;i<=retries;i++)); do cid="$("${compose[@]}" ps -q jrc-api)"; [[ -n "$cid" ]] && [[ "$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}running{{end}}' "$cid")" =~ ^(healthy|running)$ ]] && { healthy=1; break; }; sleep "$interval"; done
(( healthy == 1 )) || fail 'Previous API did not become healthy; frontend pointer was not changed.'
link_tmp="${data[current_symlink]}.tmp.$$"; marker_tmp="${data[marker]}.tmp.$$"; trap 'rm -f -- "$link_tmp" "$marker_tmp"' EXIT
ln -s -- "${data[previous_frontend]}" "$link_tmp"; printf '%s\n' "${data[previous_marker]}" >"$marker_tmp"
mv -Tf -- "$link_tmp" "${data[current_symlink]}"; mv -f -- "$marker_tmp" "${data[marker]}"
[[ "$(readlink -- "${data[current_symlink]}")" == "${data[previous_frontend]}" && "$(<"${data[marker]}")" == "${data[previous_marker]}" ]] || fail 'Rollback verification failed.'
trap - EXIT
printf 'Rollback completed. Database migrations were not reversed.\n'
