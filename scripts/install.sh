#!/bin/sh
set -eu

INSTALL_DIR="${ARTIFACTS_INSTALL_DIR:-$HOME/.local/bin}"
VERSION="${ARTIFACTS_VERSION:-latest}"
DOWNLOAD_BASE_URL="${ARTIFACTS_DOWNLOAD_BASE_URL:-https://github.com/laxman-patel/agent-artifacts/releases}"
SKILL_SOURCE="${ARTIFACTS_SKILL_SOURCE:-https://github.com/laxman-patel/agent-artifacts}"
SKILL_NAME="${ARTIFACTS_SKILL_NAME:-agent-artifacts}"
# Empty by default so the installer prompts (or auto-detects) which agents to
# target. Set to a space-separated list of `skills` slugs, or '*' for all, to
# bypass the interactive picker (handy for CI).
SKILL_AGENTS="${ARTIFACTS_SKILL_AGENTS:-}"
SKIP_SKILLS="${ARTIFACTS_SKIP_SKILLS:-0}"
SKIP_LOGIN="${ARTIFACTS_SKIP_LOGIN:-0}"
ALLOW_INSECURE="${ARTIFACTS_ALLOW_INSECURE:-0}"
TTY_DEV="${ARTIFACTS_TTY:-/dev/tty}"

# Curated set of common coding agents, encoded as `slug|Display Name|detect dir`.
# The detect dir is used only to preselect agents you already have installed;
# every agent remains selectable. See https://github.com/vercel-labs/skills for
# the full slug list (override with ARTIFACTS_SKILL_AGENTS for anything else).
AGENT_ROWS="cursor|Cursor|$HOME/.cursor
claude-code|Claude Code|$HOME/.claude
codex|Codex|$HOME/.codex
opencode|OpenCode|$HOME/.config/opencode
gemini-cli|Gemini CLI|$HOME/.gemini
github-copilot|GitHub Copilot|$HOME/.copilot
windsurf|Windsurf|$HOME/.codeium"

CLI_STATUS=""
LOGIN_STATUS=""
SKILL_STATUS=""
SELECTED=""

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

# ---------------------------------------------------------------------------
# Presentation (dark, thin-rule "spec sheet" styling per DESIGN.md). Color and
# box glyphs are disabled when NO_COLOR is set or stdout is not a terminal.
# ---------------------------------------------------------------------------
setup_style() {
  ESC=$(printf '\033')
  if [ -z "${NO_COLOR:-}" ] && [ -t 1 ]; then
    C_RESET="${ESC}[0m"
    C_DIM="${ESC}[90m"
    C_BOLD="${ESC}[1m"
    case "${COLORTERM:-}" in
      truecolor|24bit) C_ACCENT="${ESC}[38;2;255;87;10m" ;;
      *) C_ACCENT="${ESC}[38;5;202m" ;;
    esac
    G_RULE='─'
    G_ARROW='›'
  else
    C_RESET=""
    C_DIM=""
    C_BOLD=""
    C_ACCENT=""
    G_RULE='-'
    G_ARROW='>'
  fi
}

rule() {
  _r=""
  _k=0
  while [ "$_k" -lt 60 ]; do
    _r="$_r$G_RULE"
    _k=$((_k + 1))
  done
  printf '%s%s%s\n' "$C_DIM" "$_r" "$C_RESET"
}

status() {
  printf '  %s%s%s %s\n' "$C_ACCENT" "$G_ARROW" "$C_RESET" "$1"
}

banner() {
  printf '\n'
  rule
  printf '  %sartifacts%s %s*%s\n' "$C_BOLD" "$C_RESET" "$C_ACCENT" "$C_RESET"
  printf '  %sdurable homes for agent-generated artifacts%s\n' "$C_DIM" "$C_RESET"
  printf '  %sINSTALLER%s\n' "$C_DIM" "$C_RESET"
  rule
}

plan() {
  _ver="$1"
  _size="$2"
  _node="$3"
  case "$_size" in
    ''|*[!0-9]*) _sizetxt="—" ;;
    *) _sizetxt="$(((_size + 512) / 1024)) KB" ;;
  esac

  printf '\n'
  printf '  %sCLI%s\n' "$C_DIM" "$C_RESET"
  printf '    %sartifacts%s %s   %s%s · node >=%s%s\n' \
    "$C_BOLD" "$C_RESET" "$_ver" "$C_DIM" "$_sizetxt" "$_node" "$C_RESET"
  printf '    %s%s%s %s\n' "$C_ACCENT" "$G_ARROW" "$C_RESET" "$DISPLAY_DIR/artifacts"
  printf '\n'
  printf '  %sSKILL%s\n' "$C_DIM" "$C_RESET"
  printf '    %sagent-artifacts%s\n' "$C_BOLD" "$C_RESET"
  case "$SKIP_SKILLS" in
    1|true|TRUE|yes|YES)
      printf '    %sskill installation skipped (ARTIFACTS_SKIP_SKILLS)%s\n' "$C_DIM" "$C_RESET" ;;
    *)
      printf '    %schoose which coding agents receive this skill%s\n' "$C_DIM" "$C_RESET" ;;
  esac
}

summary() {
  _agents="$1"
  printf '\n'
  rule
  printf '  %sOK%s   %sCLI%s     %s\n' "$C_ACCENT" "$C_RESET" "$C_DIM" "$C_RESET" "$DISPLAY_DIR/artifacts"
  case "$LOGIN_STATUS" in
    ok)
      printf '  %sOK%s   %sAUTH%s    signed in\n' "$C_ACCENT" "$C_RESET" "$C_DIM" "$C_RESET" ;;
    token)
      printf '  %sOK%s   %sAUTH%s    AGENT_ARTIFACTS_TOKEN\n' "$C_ACCENT" "$C_RESET" "$C_DIM" "$C_RESET" ;;
    skipped)
      printf '  %s--%s   %sAUTH%s    skipped\n' "$C_DIM" "$C_RESET" "$C_DIM" "$C_RESET" ;;
    failed)
      printf '  %s!!%s   %sAUTH%s    run artifacts login\n' "$C_ACCENT" "$C_RESET" "$C_DIM" "$C_RESET" ;;
  esac
  case "$SKIP_SKILLS" in
    1|true|TRUE|yes|YES)
      printf '  %s--%s   %sSKILL%s   skipped\n' "$C_DIM" "$C_RESET" "$C_DIM" "$C_RESET" ;;
    *)
      if [ -z "$_agents" ]; then
        printf '  %s--%s   %sSKILL%s   no agents selected\n' "$C_DIM" "$C_RESET" "$C_DIM" "$C_RESET"
      elif [ "$SKILL_STATUS" = "failed" ] || [ "$SKILL_STATUS" = "npx-missing" ]; then
        printf '  %s!!%s   %sSKILL%s   %s (%s)\n' "$C_ACCENT" "$C_RESET" "$C_DIM" "$C_RESET" "$(join_names "$_agents")" "$SKILL_STATUS"
      else
        printf '  %sOK%s   %sSKILL%s   %s\n' "$C_ACCENT" "$C_RESET" "$C_DIM" "$C_RESET" "$(join_names "$_agents")"
      fi ;;
  esac
  rule
  printf '  %snext%s   %sartifacts schema%s\n\n' "$C_DIM" "$C_RESET" "$C_BOLD" "$C_RESET"
}

download() {
  url="$1"
  output="$2"
  case "$url" in
    https://*)
      curl -fsSL --proto '=https' --tlsv1.2 "$url" -o "$output"
      ;;
    *)
      case "$ALLOW_INSECURE" in
        1|true|TRUE|yes|YES)
          curl -fsSL "$url" -o "$output"
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

# Read a dotted path (e.g. cli.size) from the JSON manifest using Node, which is
# already a hard requirement for running the CLI.
manifest_get() {
  node -e 'const fs=require("fs");try{const m=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));const v=process.argv[2].split(".").reduce((a,k)=>(a==null?a:a[k]),m);process.stdout.write(v==null?"":String(v));}catch(e){process.exit(1);}' "$1" "$2"
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

  asset_file="$(manifest_get "$manifest" cli.file)" || true
  asset_sha="$(manifest_get "$manifest" cli.sha256)" || true

  [ -n "$asset_file" ] || fail "manifest does not contain a CLI file"
  [ -n "$asset_sha" ] || fail "manifest does not contain a CLI checksum"

  tmp_cli="$TMP_DIR/$asset_file"
  status "Downloading CLI"
  download "$base_url/$asset_file" "$tmp_cli"
  verify_sha256 "$tmp_cli" "$asset_sha"

  mkdir -p "$INSTALL_DIR"
  target="$INSTALL_DIR/artifacts"
  CLI_PATH="$target"
  install_tmp="$target.tmp.$$"
  cp "$tmp_cli" "$install_tmp"
  chmod 755 "$install_tmp"
  mv "$install_tmp" "$target"

  CLI_STATUS="ok"
  status "Installed CLI to $target"

  case ":$PATH:" in
    *":$INSTALL_DIR:"*) ;;
    *) warn "$INSTALL_DIR is not on PATH; add it before running artifacts" ;;
  esac
}

run_login() {
  cli_path="$1"

  case "$SKIP_LOGIN" in
    1|true|TRUE|yes|YES)
      LOGIN_STATUS="skipped"
      status "Skipping browser login (ARTIFACTS_SKIP_LOGIN)"
      return
      ;;
  esac

  case "${AGENT_ARTIFACTS_NO_INPUT:-}" in
    1|true|TRUE|yes|YES)
      LOGIN_STATUS="skipped"
      warn "Skipping browser login because AGENT_ARTIFACTS_NO_INPUT is set"
      return
      ;;
  esac

  if [ -n "${AGENT_ARTIFACTS_TOKEN:-}" ]; then
    LOGIN_STATUS="token"
    status "Skipping browser login because AGENT_ARTIFACTS_TOKEN is set"
    return
  fi

  if ! is_interactive; then
    LOGIN_STATUS="skipped"
    warn "Skipping browser login in non-interactive shell; run $cli_path login"
    return
  fi

  status "Starting browser login"
  if "$cli_path" login; then
    LOGIN_STATUS="ok"
  else
    LOGIN_STATUS="failed"
    warn "browser login failed; run later with: $cli_path login"
  fi
}

# ---------------------------------------------------------------------------
# Agent selection
# ---------------------------------------------------------------------------
agent_line() {
  printf '%s\n' "$AGENT_ROWS" | sed -n "${1}p"
}

name_for_slug() {
  printf '%s\n' "$AGENT_ROWS" | awk -F'|' -v s="$1" '$1 == s { print $2; exit }'
}

join_names() {
  # Disable globbing so a literal '*' agent value is not expanded to filenames.
  set -f
  _out=""
  for _s in $1; do
    if [ "$_s" = '*' ]; then
      _nm="all agents"
    else
      _nm="$(name_for_slug "$_s")"
      [ -n "$_nm" ] || _nm="$_s"
    fi
    if [ -z "$_out" ]; then
      _out="$_nm"
    else
      _out="$_out, $_nm"
    fi
  done
  set +f
  printf '%s' "$_out"
}

preselect_detected() {
  SELECTED=""
  _k=1
  while [ "$_k" -le "$AGENT_N" ]; do
    _line="$(agent_line "$_k")"
    _path="${_line##*|}"
    if [ -d "$_path" ]; then
      SELECTED="$SELECTED $_k"
    fi
    _k=$((_k + 1))
  done
}

detected_slugs() {
  _out=""
  _k=1
  while [ "$_k" -le "$AGENT_N" ]; do
    _line="$(agent_line "$_k")"
    _slug="${_line%%|*}"
    _path="${_line##*|}"
    if [ -d "$_path" ]; then
      _out="$_out $_slug"
    fi
    _k=$((_k + 1))
  done
  printf '%s' "$_out"
}

selected_slugs() {
  _out=""
  _k=1
  while [ "$_k" -le "$AGENT_N" ]; do
    case " $SELECTED " in
      *" $_k "*)
        _line="$(agent_line "$_k")"
        _out="$_out ${_line%%|*}"
        ;;
    esac
    _k=$((_k + 1))
  done
  printf '%s' "$_out"
}

select_all() {
  _all=""
  _k=1
  while [ "$_k" -le "$AGENT_N" ]; do
    _all="$_all $_k"
    _k=$((_k + 1))
  done
  SELECTED="$_all"
}

toggle() {
  _t="$1"
  case " $SELECTED " in
    *" $_t "*)
      _new=""
      for _x in $SELECTED; do
        if [ "$_x" != "$_t" ]; then
          _new="$_new $_x"
        fi
      done
      SELECTED="$_new"
      ;;
    *)
      SELECTED="$SELECTED $_t"
      ;;
  esac
}

render_rows() {
  _k=1
  while [ "$_k" -le "$AGENT_N" ]; do
    _line="$(agent_line "$_k")"
    _slug="${_line%%|*}"
    _rest="${_line#*|}"
    _name="${_rest%%|*}"
    _path="${_rest##*|}"

    case " $SELECTED " in
      *" $_k "*) _sel=1 ;;
      *) _sel=0 ;;
    esac
    if [ -d "$_path" ]; then _det=1; else _det=0; fi

    if [ "$_sel" -eq 1 ]; then
      _arrow="${C_ACCENT}${G_ARROW}${C_RESET} "
      _box="${C_ACCENT}[x]${C_RESET}"
    else
      _arrow="  "
      _box="[ ]"
    fi
    if [ "$_det" -eq 1 ]; then
      _state="detected"
      _statec="$C_RESET"
    else
      _state="not installed"
      _statec="$C_DIM"
    fi

    printf '   %s%s %s  %-16s %s%-15s%s %s%s%s\n' \
      "$_arrow" "$_box" "$_k" "$_name" \
      "$C_DIM" "$_slug" "$C_RESET" \
      "$_statec" "$_state" "$C_RESET"

    _k=$((_k + 1))
  done
}

is_interactive() {
  [ -t 1 ] || return 1
  [ -r "$TTY_DEV" ] || return 1
  return 0
}

choose_agents() {
  preselect_detected

  printf '\n  %sSELECT AGENTS%s   %stoggle numbers · a all · n none · enter confirm%s\n' \
    "$C_DIM" "$C_RESET" "$C_DIM" "$C_RESET"
  printf '  %smore agents → set ARTIFACTS_SKILL_AGENTS%s\n' "$C_DIM" "$C_RESET"

  # Open the terminal once on fd 3 and read sequentially from it. Re-opening
  # "$TTY_DEV" on every read would restart a regular file from the top.
  exec 3<"$TTY_DEV" || {
    warn "could not open $TTY_DEV for input; skipping agent selection"
    return
  }

  _first=1
  while :; do
    if [ "$_first" -eq 0 ] && [ -t 1 ]; then
      printf '%s[%dA%s[J' "$ESC" "$((AGENT_N + 1))" "$ESC"
    fi
    _first=0

    render_rows
    printf '   %s%s%s ' "$C_ACCENT" "$G_ARROW" "$C_RESET"

    if ! IFS= read -r _input <&3; then
      printf '\n'
      break
    fi

    _input="$(printf '%s' "$_input" | tr ',' ' ')"
    case "$_input" in
      ''|q|Q)
        break
        ;;
      a|A)
        select_all
        ;;
      n|N)
        SELECTED=""
        ;;
      *)
        for _t in $_input; do
          case "$_t" in
            ''|*[!0-9]*) : ;;
            *)
              if [ "$_t" -ge 1 ] && [ "$_t" -le "$AGENT_N" ]; then
                toggle "$_t"
              fi
              ;;
          esac
        done
        ;;
    esac
  done

  exec 3<&-
}

run_skills() {
  agents="$1"

  if [ -z "$agents" ]; then
    warn "No coding agents selected; skipping skill installation."
    warn "Install later with: ARTIFACTS_SKILL_AGENTS=\"cursor claude-code\" curl -fsSL https://hostartifacts.dev/install.sh | sh"
    return
  fi

  if ! command -v npx >/dev/null 2>&1; then
    SKILL_STATUS="npx-missing"
    warn "npx was not found; skipping skill installation"
    warn "Install later with: npx skills add $SKILL_SOURCE --skill $SKILL_NAME --agent '*' --global --copy -y"
    return
  fi

  status "Installing skill into: $(join_names "$agents")"

  set -f
  set -- npx -y skills add "$SKILL_SOURCE" --skill "$SKILL_NAME" --global --copy -y
  for agent in $agents; do
    set -- "$@" --agent "$agent"
  done
  set +f

  if "$@"; then
    SKILL_STATUS="ok"
  else
    SKILL_STATUS="failed"
    warn "skill installation failed; rerun with ARTIFACTS_SKIP_SKILLS=1 to install only the CLI"
  fi
}

main() {
  need curl
  need awk
  need sed
  need tr
  need node
  need mktemp
  need mkdir
  need cp
  need chmod
  need mv
  need rm
  need basename

  NODE_MAJOR="$(node_major)"
  [ "$NODE_MAJOR" -ge 24 ] || fail "Node.js 24 or newer is required; found $(node -v)"

  setup_style
  AGENT_N="$(printf '%s\n' "$AGENT_ROWS" | awk 'END { print NR }')"
  DISPLAY_DIR="$(printf '%s' "$INSTALL_DIR" | sed "s#^$HOME#~#")"

  TMP_DIR="$(mktemp -d)"
  trap 'rm -rf "$TMP_DIR"' EXIT HUP INT TERM

  RELEASE_URL="$(release_path)"
  MANIFEST="$TMP_DIR/manifest.json"

  banner
  status "Fetching release metadata"
  download "$RELEASE_URL/manifest.json" "$MANIFEST"

  manifest_version="$(manifest_get "$MANIFEST" version)" || true
  [ -n "$manifest_version" ] || manifest_version="$VERSION"
  manifest_size="$(manifest_get "$MANIFEST" cli.size)" || true
  manifest_node="$(manifest_get "$MANIFEST" node.minMajor)" || true
  [ -n "$manifest_node" ] || manifest_node="24"

  plan "$manifest_version" "$manifest_size" "$manifest_node"

  agents=""
  case "$SKIP_SKILLS" in
    1|true|TRUE|yes|YES)
      : ;;
    *)
      if [ -n "$SKILL_AGENTS" ]; then
        agents="$SKILL_AGENTS"
      elif is_interactive; then
        choose_agents
        agents="$(selected_slugs)"
      else
        agents="$(detected_slugs)"
        if [ -n "$agents" ]; then
          status "Auto-selected detected agents: $(join_names "$agents")"
        fi
      fi
      ;;
  esac

  printf '\n'
  rule
  install_cli "$RELEASE_URL" "$MANIFEST"
  run_login "$CLI_PATH"

  case "$SKIP_SKILLS" in
    1|true|TRUE|yes|YES) ;;
    *) run_skills "$agents" ;;
  esac

  summary "$agents"
}

case "${ARTIFACTS_LIB_ONLY:-}" in
  1|true|TRUE|yes|YES) : ;;
  *) main ;;
esac
