#!/bin/sh
set -eu

INSTALL_DIR="${ARTIFACTS_INSTALL_DIR:-$HOME/.local/bin}"
VERSION="${ARTIFACTS_VERSION:-latest}"
DOWNLOAD_BASE_URL="${ARTIFACTS_DOWNLOAD_BASE_URL:-https://github.com/laxman-patel/agent-artifacts/releases}"
SKILL_SOURCE="${ARTIFACTS_SKILL_SOURCE:-https://github.com/laxman-patel/agent-artifacts}"
SKILL_NAME="${ARTIFACTS_SKILL_NAME:-agent-artifacts}"
SKILL_AGENTS="${ARTIFACTS_SKILL_AGENTS:-*}"
SKIP_SKILLS="${ARTIFACTS_SKIP_SKILLS:-0}"
ALLOW_INSECURE="${ARTIFACTS_ALLOW_INSECURE:-0}"

say() {
  printf '%s\n' "$*"
}

warn() {
  printf 'warning: %s\n' "$*" >&2
}

fail() {
  printf 'error: %s\n' "$*" >&2
  exit 1
}

need() {
  command -v "$1" >/dev/null 2>&1 || fail "required command not found: $1"
}

node_major() {
  node -p 'Number(process.versions.node.split(".")[0])'
}

download() {
  url="$1"
  output="$2"
  case "$url" in
    https://*)
      curl -fL --proto '=https' --tlsv1.2 "$url" -o "$output"
      ;;
    *)
      case "$ALLOW_INSECURE" in
        1|true|TRUE|yes|YES)
          curl -fL "$url" -o "$output"
          ;;
        *)
          fail "refusing non-HTTPS download URL: $url"
          ;;
      esac
      ;;
  esac
}

sha256() {
  file="$1"
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$file" | awk '{print $1}'
    return
  fi
  if command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$file" | awk '{print $1}'
    return
  fi
  fail "sha256sum or shasum is required to verify the download"
}

release_path() {
  case "$DOWNLOAD_BASE_URL" in
    */releases)
      case "$VERSION" in
        latest)
          printf '%s/latest/download' "$DOWNLOAD_BASE_URL"
          ;;
        v*)
          printf '%s/download/%s' "$DOWNLOAD_BASE_URL" "$VERSION"
          ;;
        *)
          printf '%s/download/v%s' "$DOWNLOAD_BASE_URL" "$VERSION"
          ;;
      esac
      ;;
    *)
      case "$VERSION" in
        latest)
          printf '%s/latest' "$DOWNLOAD_BASE_URL"
          ;;
        v*)
          printf '%s/%s' "$DOWNLOAD_BASE_URL" "$VERSION"
          ;;
        *)
          printf '%s/v%s' "$DOWNLOAD_BASE_URL" "$VERSION"
          ;;
      esac
      ;;
  esac
}

manifest_field() {
  section="$1"
  field="$2"
  manifest="$3"
  sed -n "/\"$section\": {/,/}/ s/.*\"$field\": \"\\([^\"]*\\)\".*/\\1/p" "$manifest" | sed -n '1p'
}

verify_sha256() {
  file="$1"
  expected="$2"
  actual="$(sha256 "$file")"
  if [ "$actual" != "$expected" ]; then
    fail "checksum mismatch for $(basename "$file"): expected $expected, got $actual"
  fi
}

install_cli() {
  base_url="$1"
  manifest="$2"

  asset_file="$(manifest_field "cli" "file" "$manifest")"
  asset_sha="$(manifest_field "cli" "sha256" "$manifest")"

  [ -n "$asset_file" ] || fail "manifest does not contain a CLI file"
  [ -n "$asset_sha" ] || fail "manifest does not contain a CLI checksum"

  tmp_cli="$TMP_DIR/$asset_file"
  download "$base_url/$asset_file" "$tmp_cli"
  verify_sha256 "$tmp_cli" "$asset_sha"

  mkdir -p "$INSTALL_DIR"
  target="$INSTALL_DIR/artifacts"
  install_tmp="$target.tmp.$$"
  cp "$tmp_cli" "$install_tmp"
  chmod 755 "$install_tmp"
  mv "$install_tmp" "$target"

  say "Installed artifacts CLI to $target"

  case ":$PATH:" in
    *":$INSTALL_DIR:"*) ;;
    *) warn "$INSTALL_DIR is not on PATH; add it before running artifacts" ;;
  esac
}

install_skills() {
  case "$SKIP_SKILLS" in
    1|true|TRUE|yes|YES)
      say "Skipped skill installation because ARTIFACTS_SKIP_SKILLS=$SKIP_SKILLS"
      return
      ;;
  esac

  if ! command -v npx >/dev/null 2>&1; then
    warn "npx was not found; skipping multi-agent skill installation"
    warn "Install later with: npx skills add $SKILL_SOURCE --skill $SKILL_NAME --agent '*' --global --copy -y"
    return
  fi

  set -f
  set -- npx -y skills add "$SKILL_SOURCE" --skill "$SKILL_NAME" --global --copy -y
  for agent in $SKILL_AGENTS; do
    set -- "$@" --agent "$agent"
  done
  set +f

  "$@" || warn "skill installation failed; rerun with ARTIFACTS_SKIP_SKILLS=1 to install only the CLI"
}

need curl
need awk
need sed
need node
need mktemp
need mkdir
need cp
need chmod
need mv
need rm
need basename

TMP_DIR="$(mktemp -d)"
cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT HUP INT TERM

NODE_MAJOR="$(node_major)"
[ "$NODE_MAJOR" -ge 24 ] || fail "Node.js 24 or newer is required; found $(node -v)"
RELEASE_URL="$(release_path)"
MANIFEST="$TMP_DIR/manifest.json"

say "Downloading artifacts CLI release metadata from $RELEASE_URL"
download "$RELEASE_URL/manifest.json" "$MANIFEST"

install_cli "$RELEASE_URL" "$MANIFEST"
install_skills

say "Done. Try: artifacts schema"
