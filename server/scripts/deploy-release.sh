#!/usr/bin/env bash
set -Eeuo pipefail
IFS=$'\n\t'
umask 077
export LC_ALL=C

usage() {
  cat <<'EOF'
Usage: deploy-release.sh --check | --apply

Required environment:
  JRC_REPOSITORY_ROOT          Clean Git repository root
  JRC_COMPOSE_FILE             Compose YAML file
  JRC_COMPOSE_ENV_FILE         Compose environment file
  JRC_RELEASE_SHA              Exact 40-character lowercase Git SHA
  JRC_FRONTEND_SOURCE_DIR      Built frontend containing release.json
  JRC_RELEASE_ROOT             Immutable frontend release directory
  JRC_CURRENT_SYMLINK          Active frontend symbolic link
  JRC_CURRENT_RELEASE_MARKER   Active release marker file
  JRC_ROLLBACK_DIR             Private rollback-record directory
  JRC_BACKUP_DIR               Non-symlink backup with SHA256SUMS
  JRC_API_IMAGE                Immutable API image reference
  JRC_MIGRATION_IMAGE          Immutable migration image reference
Optional: JRC_HEALTH_RETRIES (30), JRC_HEALTH_INTERVAL_SECONDS (2).
--check performs the complete read-only preflight. Only literal --apply mutates state.
EOF
}
fail() { printf 'Error: %s\n' "$1" >&2; exit 1; }
[[ $# == 1 ]] || { usage >&2; exit 2; }
case "$1" in --help) usage; exit 0;; --check) mode=check;; --apply) mode=apply;; *) usage >&2; exit 2;; esac
for c in git docker sha256sum realpath mktemp mkdir chmod cp mv rm readlink dirname basename date grep env timeout; do command -v "$c" >/dev/null 2>&1 || fail "$c is required."; done
for name in JRC_REPOSITORY_ROOT JRC_COMPOSE_FILE JRC_COMPOSE_ENV_FILE JRC_RELEASE_SHA JRC_FRONTEND_SOURCE_DIR JRC_RELEASE_ROOT JRC_CURRENT_SYMLINK JRC_CURRENT_RELEASE_MARKER JRC_ROLLBACK_DIR JRC_BACKUP_DIR JRC_API_IMAGE JRC_MIGRATION_IMAGE; do [[ -n "${!name:-}" ]] || fail "$name is required."; done
[[ "$JRC_RELEASE_SHA" =~ ^[0-9a-f]{40}$ ]] || fail 'JRC_RELEASE_SHA must be exactly 40 lowercase hexadecimal characters.'
retries="${JRC_HEALTH_RETRIES:-30}"; interval="${JRC_HEALTH_INTERVAL_SECONDS:-2}"; command_timeout="${JRC_COMMAND_TIMEOUT_SECONDS:-60}"
[[ "$retries" =~ ^[1-9][0-9]?$ && "$interval" =~ ^[0-9]+$ && "$command_timeout" =~ ^[1-9][0-9]*$ ]] || fail 'Health and timeout settings are invalid.'
valid_plain() { [[ "$1" != *$'\n'* && "$1" != *$'\r'* && "$1" != *$'\t'* && "$1" != *';'* && "$1" != *'`'* && "$1" != *'$('* ]]; }
for value in "$JRC_REPOSITORY_ROOT" "$JRC_COMPOSE_FILE" "$JRC_COMPOSE_ENV_FILE" "$JRC_FRONTEND_SOURCE_DIR" "$JRC_RELEASE_ROOT" "$JRC_CURRENT_SYMLINK" "$JRC_CURRENT_RELEASE_MARKER" "$JRC_ROLLBACK_DIR" "$JRC_BACKUP_DIR" "$JRC_API_IMAGE" "$JRC_MIGRATION_IMAGE"; do valid_plain "$value" || fail 'Unsafe path or image value.'; done
real_dir() { [[ -d "$1" && ! -L "$1" ]] || fail "$2 must be a real, non-symbolic-link directory."; }
real_dir "$JRC_REPOSITORY_ROOT" JRC_REPOSITORY_ROOT; real_dir "$JRC_FRONTEND_SOURCE_DIR" JRC_FRONTEND_SOURCE_DIR; real_dir "$JRC_RELEASE_ROOT" JRC_RELEASE_ROOT; real_dir "$JRC_ROLLBACK_DIR" JRC_ROLLBACK_DIR; real_dir "$JRC_BACKUP_DIR" JRC_BACKUP_DIR
[[ "$JRC_RELEASE_ROOT" != *'/../'* && "$JRC_RELEASE_ROOT" != *'/./'* ]] || fail 'JRC_RELEASE_ROOT must be canonical.'
[[ "$JRC_RELEASE_ROOT" == "$(realpath -- "$JRC_RELEASE_ROOT")" ]] || fail 'JRC_RELEASE_ROOT must be canonical.'
[[ -f "$JRC_COMPOSE_FILE" && ! -L "$JRC_COMPOSE_FILE" ]] || fail 'JRC_COMPOSE_FILE must be a regular non-symlink file.'
[[ -f "$JRC_COMPOSE_ENV_FILE" && ! -L "$JRC_COMPOSE_ENV_FILE" ]] || fail 'JRC_COMPOSE_ENV_FILE must be a regular non-symlink file.'
[[ -L "$JRC_CURRENT_SYMLINK" ]] || fail 'JRC_CURRENT_SYMLINK must be a symbolic link.'
[[ -f "$JRC_CURRENT_RELEASE_MARKER" && ! -L "$JRC_CURRENT_RELEASE_MARKER" ]] || fail 'JRC_CURRENT_RELEASE_MARKER must be a regular non-symlink file.'
[[ -f "$JRC_BACKUP_DIR/SHA256SUMS" && ! -L "$JRC_BACKUP_DIR/SHA256SUMS" ]] || fail 'Backup SHA256SUMS is missing or unsafe.'
[[ "$(wc -l < "$JRC_BACKUP_DIR/SHA256SUMS")" == 2 ]] && grep -Eq '^[0-9a-f]{64}  database\.dump$' "$JRC_BACKUP_DIR/SHA256SUMS" && grep -Eq '^[0-9a-f]{64}  private-storage\.tar\.gz$' "$JRC_BACKUP_DIR/SHA256SUMS" || fail 'Backup manifest is incomplete or unsafe.'
( cd -- "$JRC_BACKUP_DIR" && sha256sum --check --strict -- SHA256SUMS >/dev/null ) || fail 'Backup checksum verification failed.'
[[ -z "$(git -C "$JRC_REPOSITORY_ROOT" status --porcelain)" ]] || fail 'Repository must be clean.'
[[ "$(git -C "$JRC_REPOSITORY_ROOT" rev-parse HEAD)" == "$JRC_RELEASE_SHA" ]] || fail 'Repository HEAD does not equal JRC_RELEASE_SHA.'
[[ -f "$JRC_FRONTEND_SOURCE_DIR/release.json" && ! -L "$JRC_FRONTEND_SOURCE_DIR/release.json" ]] || fail 'Frontend release.json is missing or unsafe.'
grep -Eq '^[[:space:]]*\{[[:space:]]*"sha"[[:space:]]*:[[:space:]]*"'"$JRC_RELEASE_SHA"'"[[:space:]]*\}[[:space:]]*$' "$JRC_FRONTEND_SOURCE_DIR/release.json" || fail 'Frontend release.json does not contain the exact release SHA.'
valid_image() { [[ "$1" =~ ^[A-Za-z0-9._/@-]+(:$JRC_RELEASE_SHA|@sha256:[0-9a-f]{64})$ ]]; }
valid_image "$JRC_API_IMAGE" || fail 'JRC_API_IMAGE must use a digest or SHA-bearing immutable tag.'
valid_image "$JRC_MIGRATION_IMAGE" || fail 'JRC_MIGRATION_IMAGE must use a digest or SHA-bearing immutable tag.'
for image in "$JRC_API_IMAGE" "$JRC_MIGRATION_IMAGE"; do [[ "$(docker image inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$image")" == "$JRC_RELEASE_SHA" ]] || fail "Image OCI revision does not match release SHA: $image"; done
compose=(docker compose --project-directory "$JRC_REPOSITORY_ROOT" --file "$JRC_COMPOSE_FILE" --env-file "$JRC_COMPOSE_ENV_FILE")
baseline="$(env -u JRC_API_IMAGE -u JRC_MIGRATION_IMAGE -u API_IMAGE -u MIGRATION_IMAGE "${compose[@]}" config --format json)" || fail 'Compose configuration does not resolve.'
[[ "$baseline" =~ \"jrc-api\":\{\"image\":\"([^\"]+)\" ]] || fail 'Baseline API image is missing.'; previous_api_image=${BASH_REMATCH[1]}
[[ "$baseline" =~ \"jrc-migrate\":\{\"image\":\"([^\"]+)\" ]] || fail 'Baseline migration image is missing.'; previous_migration_image=${BASH_REMATCH[1]}
[[ "$previous_api_image" != "$JRC_API_IMAGE" && "$previous_migration_image" != "$JRC_MIGRATION_IMAGE" ]] || fail 'Previous images must differ from new images.'
JRC_API_IMAGE="$JRC_API_IMAGE" JRC_MIGRATION_IMAGE="$JRC_MIGRATION_IMAGE" API_IMAGE="$JRC_API_IMAGE" MIGRATION_IMAGE="$JRC_MIGRATION_IMAGE" "${compose[@]}" config --format json >/dev/null || fail 'Compose configuration does not resolve.'
previous_frontend="$(readlink -- "$JRC_CURRENT_SYMLINK")"; [[ "$previous_frontend" == /* && -d "$previous_frontend" && ! -L "$previous_frontend" ]] || fail 'Current frontend target must be an absolute real directory.'
previous_marker="$(<"$JRC_CURRENT_RELEASE_MARKER")"; [[ "$previous_marker" =~ ^[A-Za-z0-9._-]+$ ]] || fail 'Current release marker is malformed.'
release_dir="$JRC_RELEASE_ROOT/$JRC_RELEASE_SHA"
if [[ -e "$release_dir" || -L "$release_dir" ]]; then [[ -d "$release_dir" && ! -L "$release_dir" && -f "$release_dir/release.json" ]] || fail 'Existing release path is unsafe.'; grep -Eq '"sha"[[:space:]]*:[[:space:]]*"'"$JRC_RELEASE_SHA"'"' "$release_dir/release.json" || fail 'Existing release directory does not match release SHA.'; fi
[[ "$mode" == apply ]] || { printf 'Preflight successful.\n'; exit 0; }
record_tmp="$(mktemp -- "$JRC_ROLLBACK_DIR/.rollback.tmp.XXXXXX")"; record="$JRC_ROLLBACK_DIR/rollback-$JRC_RELEASE_SHA.record"
printf 'version=1\nrelease_sha=%s\nprevious_frontend=%s\nprevious_marker=%s\nprevious_api_image=%s\nprevious_migration_image=%s\nnew_api_image=%s\nnew_migration_image=%s\nrelease_root=%s\ncurrent_symlink=%s\nmarker=%s\nbackup_dir=%s\nrepository_root=%s\ncompose_file=%s\ncompose_env_file=%s\n' "$JRC_RELEASE_SHA" "$previous_frontend" "$previous_marker" "$previous_api_image" "$previous_migration_image" "$JRC_API_IMAGE" "$JRC_MIGRATION_IMAGE" "$JRC_RELEASE_ROOT" "$JRC_CURRENT_SYMLINK" "$JRC_CURRENT_RELEASE_MARKER" "$JRC_BACKUP_DIR" "$JRC_REPOSITORY_ROOT" "$JRC_COMPOSE_FILE" "$JRC_COMPOSE_ENV_FILE" >"$record_tmp"
chmod 600 -- "$record_tmp"; mv -- "$record_tmp" "$record"
frontend_switched=0
temp_release=''
on_error() { local status=$?; [[ -z "$temp_release" || ! -e "$temp_release" ]] || rm -rf -- "$temp_release"; if (( frontend_switched == 0 )); then printf 'Deployment failed before frontend switch; current frontend pointer was unchanged.\nRollback record: %s\nDatabase migrations are not automatically reversed.\n' "$record" >&2; fi; exit "$status"; }
trap on_error ERR HUP INT TERM
if [[ ! -e "$release_dir" ]]; then temp_release="$(mktemp -d -- "$JRC_RELEASE_ROOT/.release-$JRC_RELEASE_SHA.XXXXXX")"; cp -a -- "$JRC_FRONTEND_SOURCE_DIR/." "$temp_release/"; mv -- "$temp_release" "$release_dir"; temp_release=''; fi
JRC_API_IMAGE="$JRC_API_IMAGE" JRC_MIGRATION_IMAGE="$JRC_MIGRATION_IMAGE" API_IMAGE="$JRC_API_IMAGE" MIGRATION_IMAGE="$JRC_MIGRATION_IMAGE" timeout "$command_timeout" "${compose[@]}" run --rm jrc-migrate
JRC_API_IMAGE="$JRC_API_IMAGE" JRC_MIGRATION_IMAGE="$JRC_MIGRATION_IMAGE" API_IMAGE="$JRC_API_IMAGE" MIGRATION_IMAGE="$JRC_MIGRATION_IMAGE" timeout "$command_timeout" "${compose[@]}" up -d --no-deps --force-recreate jrc-api
healthy=0; for ((i=1;i<=retries;i++)); do cid="$("${compose[@]}" ps -q jrc-api)"; [[ -n "$cid" ]] && [[ "$(docker inspect --format '{{.State.Health.Status}}' "$cid")" == healthy ]] && [[ "$(docker inspect --format '{{.Config.Image}}' "$cid")" == "$JRC_API_IMAGE" ]] && { healthy=1; break; }; sleep "$interval"; done; (( healthy == 1 )) || fail 'API did not become healthy within the retry limit.'
link_tmp="$JRC_CURRENT_SYMLINK.tmp.$$"; ln -s -- "$release_dir" "$link_tmp"; mv -Tf -- "$link_tmp" "$JRC_CURRENT_SYMLINK"; frontend_switched=1
marker_tmp="$JRC_CURRENT_RELEASE_MARKER.tmp.$$"; printf '%s\n' "$JRC_RELEASE_SHA" >"$marker_tmp"; mv -f -- "$marker_tmp" "$JRC_CURRENT_RELEASE_MARKER"
[[ "$(readlink -- "$JRC_CURRENT_SYMLINK")" == "$release_dir" && "$(<"$JRC_CURRENT_RELEASE_MARKER")" == "$JRC_RELEASE_SHA" ]] || fail 'Active release verification failed.'
trap - ERR HUP INT TERM
printf 'Deployment completed.\nRollback record: %s\n' "$record"
