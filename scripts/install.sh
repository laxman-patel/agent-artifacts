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

CLI_PATH=""
LOGIN_STATUS=""
SKILL_STATUS=""
SELECTED=""
DISPLAY_DIR=""

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
warn() { printf '  %s!%s %s\n' "${C_ACCENT:-}" "${C_RESET:-}" "$1" >&2; }
fail() { printf '  %s!%s %s\n' "${C_ACCENT:-}" "${C_RESET:-}" "$1" >&2; exit 1; }
need() { command -v "$1" >/dev/null 2>&1 || fail "required command not found: $1"; }
node_major() { node -p 'Number(process.versions.node.split(".")[0])'; }

# ---------------------------------------------------------------------------
# Style
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
    G_ARROW='›'
  else
    C_RESET=""
    C_DIM=""
    C_BOLD=""
    C_ACCENT=""
    G_ARROW='>'
  fi
}

step() { printf '  %s%s%s %s\n' "$C_ACCENT" "$G_ARROW" "$C_RESET" "$1"; }

banner() {
  printf '\n  %sartifacts%s\n' "$C_BOLD" "$C_RESET"
  printf '  %sdurable homes for agent-generated artifacts%s\n\n' "$C_DIM" "$C_RESET"
}

# ---------------------------------------------------------------------------
# Network
# ---------------------------------------------------------------------------
download() {
  url="$1"; output="$2"
  case "$url" in
    https://*)
      curl -fsSL --proto '=https' --tlsv1.2 "$url" -o "$output"
      ;;
    *)
      case "$ALLOW_INSECURE" in
        1|true|TRUE|yes|YES) curl -fsSL "$url" -o "$output" ;;
        *) fail "refusing non-HTTPS download URL: $url" ;;
      esac ;;
  esac
}

sha256() {
  file="$1"
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$file" | awk '{print $1}'
  elif command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$file" | awk '{print $1}'
  else
    fail "sha256sum or shasum is required to verify the download"
  fi
}

release_path() {
  case "$DOWNLOAD_BASE_URL" in
    */releases)
      case "$VERSION" in
        latest) printf '%s/latest/download' "$DOWNLOAD_BASE_URL" ;;
        v*) printf '%s/download/%s' "$DOWNLOAD_BASE_URL" "$VERSION" ;;
        *) printf '%s/download/v%s' "$DOWNLOAD_BASE_URL" "$VERSION" ;;
      esac ;;
    *)
      case "$VERSION" in
        latest) printf '%s/latest' "$DOWNLOAD_BASE_URL" ;;
        v*) printf '%s/%s' "$DOWNLOAD_BASE_URL" "$VERSION" ;;
        *) printf '%s/v%s' "$DOWNLOAD_BASE_URL" "$VERSION" ;;
      esac ;;
  esac
}

manifest_get() {
  node -e 'const fs=require("fs");try{const m=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));const v=process.argv[2].split(".").reduce((a,k)=>(a==null?a:a[k]),m);process.stdout.write(v==null?"":String(v));}catch(e){process.exit(1);}' "$1" "$2"
}

verify_sha256() {
  file="$1"; expected="$2"
  actual="$(sha256 "$file")"
  [ "$actual" = "$expected" ] || fail "checksum mismatch for $(basename "$file")"
}

# ---------------------------------------------------------------------------
# CLI install
# ---------------------------------------------------------------------------
install_cli() {
  base_url="$1"; manifest="$2"

  asset_file="$(manifest_get "$manifest" cli.file)" || true
  asset_sha="$(manifest_get "$manifest" cli.sha256)" || true
  [ -n "$asset_file" ] || fail "manifest does not contain a CLI file"
  [ -n "$asset_sha" ] || fail "manifest does not contain a CLI checksum"

  step "Downloading CLI"
  tmp_cli="$TMP_DIR/$asset_file"
  download "$base_url/$asset_file" "$tmp_cli"
  verify_sha256 "$tmp_cli" "$asset_sha"

  mkdir -p "$INSTALL_DIR"
  target="$INSTALL_DIR/artifacts"
  CLI_PATH="$target"
  install_tmp="$target.tmp.$$"
  cp "$tmp_cli" "$install_tmp"
  chmod 755 "$install_tmp"
  mv "$install_tmp" "$target"

  DISPLAY_DIR="$(printf '%s' "$INSTALL_DIR" | sed "s#^$HOME#~#")"
  step "Installed to $DISPLAY_DIR/artifacts"

  case ":$PATH:" in
    *":$INSTALL_DIR:"*) ;;
    *) warn "$INSTALL_DIR is not on PATH; add it before running artifacts" ;;
  esac
}

# ---------------------------------------------------------------------------
# Login
# ---------------------------------------------------------------------------
is_interactive() {
  [ -t 1 ] || return 1
  [ -r "$TTY_DEV" ] || return 1
  return 0
}

run_login() {
  cli_path="$1"

  case "$SKIP_LOGIN" in
    1|true|TRUE|yes|YES) LOGIN_STATUS="skipped"; return ;;
  esac
  case "${AGENT_ARTIFACTS_NO_INPUT:-}" in
    1|true|TRUE|yes|YES) LOGIN_STATUS="skipped"; return ;;
  esac
  if [ -n "${AGENT_ARTIFACTS_TOKEN:-}" ]; then
    LOGIN_STATUS="token"; return
  fi
  if ! is_interactive; then
    LOGIN_STATUS="skipped"; return
  fi

  step "Opening browser for sign-in"
  if "$cli_path" login; then
    LOGIN_STATUS="ok"
  else
    LOGIN_STATUS="failed"
  fi
}

# ---------------------------------------------------------------------------
# Agent selection
# ---------------------------------------------------------------------------
agent_count() { printf '%s\n' "$AGENT_ROWS" | awk 'END { print NR }'; }
agent_line() { printf '%s\n' "$AGENT_ROWS" | sed -n "${1}p"; }

name_for_slug() {
  printf '%s\n' "$AGENT_ROWS" | awk -F'|' -v s="$1" '$1 == s { print $2; exit }'
}

join_names() {
  set -f
  _out=""
  for _s in $1; do
    if [ "$_s" = '*' ]; then
      _nm="all agents"
    else
      _nm="$(name_for_slug "$_s")"
      [ -n "$_nm" ] || _nm="$_s"
    fi
    _out="${_out:+$_out, }$_nm"
  done
  set +f
  printf '%s' "$_out"
}

detected_slugs() {
  _out=""
  _k=1
  while [ "$_k" -le "$AGENT_N" ]; do
    _line="$(agent_line "$_k")"
    _slug="${_line%%|*}"
    _path="${_line##*|}"
    if [ -d "$_path" ]; then _out="$_out $_slug"; fi
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
        _out="$_out ${_line%%|*}" ;;
    esac
    _k=$((_k + 1))
  done
  printf '%s' "$_out"
}

# Read one line from /dev/tty inside a subshell so that exec/fd failures
# cannot kill the parent shell (which runs with set -e).
read_tty() {
  (
    exec 3<"$TTY_DEV" 2>/dev/null || exit 0
    IFS= read -r _line <&3 2>/dev/null || exit 0
    printf '%s' "$_line"
  ) 2>/dev/null || true
}

choose_agents() {
  # Preselect detected agents
  SELECTED=""
  _k=1
  while [ "$_k" -le "$AGENT_N" ]; do
    _line="$(agent_line "$_k")"
    _path="${_line##*|}"
    if [ -d "$_path" ]; then SELECTED="$SELECTED $_k"; fi
    _k=$((_k + 1))
  done

  # Non-interactive: use detected agents as-is
  if ! is_interactive; then
    _det="$(detected_slugs)"
    if [ -n "$_det" ]; then
      step "Auto-selected: $(join_names "$_det")"
    fi
    return
  fi

  # Interactive: show list, single prompt, no redraw loop
  printf '\n  %sSelect agents to receive the skill%s\n' "$C_DIM" "$C_RESET"
  printf '  %sDetected agents are preselected — toggle to change%s\n\n' "$C_DIM" "$C_RESET"

  _k=1
  while [ "$_k" -le "$AGENT_N" ]; do
    _line="$(agent_line "$_k")"
    _name="${_line#*|}"; _name="${_name%|*}"
    _path="${_line##*|}"

    case " $SELECTED " in
      *" $_k "*) _box="${C_ACCENT}[x]${C_RESET} " ;;
      *) _box="[ ] " ;;
    esac
    if [ -d "$_path" ]; then
      _det="${C_DIM}detected${C_RESET}"
    else
      _det=""
    fi

    printf '   %s%s  %-16s %s\n' "$_box" "$_k" "$_name" "$_det"
    _k=$((_k + 1))
  done

  printf '\n  %sToggle: numbers (e.g. "1 3"), "a" all, "n" none, Enter to confirm:%s ' "$C_DIM" "$C_RESET"

  input="$(read_tty)"
  input="$(printf '%s' "$input" | tr ',' ' ')"

  case "$input" in
    a|A)
      SELECTED=""
      _k=1
      while [ "$_k" -le "$AGENT_N" ]; do SELECTED="$SELECTED $_k"; _k=$((_k + 1)); done
      ;;
    n|N)
      SELECTED=""
      ;;
    '')
      : # confirm preselected
      ;;
    *)
      for _t in $input; do
        case "$_t" in
          ''|*[!0-9]*) : ;;
          *)
            if [ "$_t" -ge 1 ] && [ "$_t" -le "$AGENT_N" ]; then
              case " $SELECTED " in
                *" $_t "*)
                  _new=""
                  for _x in $SELECTED; do
                    if [ "$_x" != "$_t" ]; then _new="$_new $_x"; fi
                  done
                  SELECTED="$_new"
                  ;;
                *)
                  SELECTED="$SELECTED $_t"
                  ;;
              esac
            fi
            ;;
        esac
      done
      ;;
  esac
}

# ---------------------------------------------------------------------------
# Skills
# ---------------------------------------------------------------------------
run_skills() {
  agents="$1"

  [ -n "$agents" ] || { warn "No coding agents selected; skipping skill installation."; return; }

  if ! command -v npx >/dev/null 2>&1; then
    SKILL_STATUS="npx-missing"
    warn "npx was not found; skipping skill installation"
    warn "Install later with: npx skills add $SKILL_SOURCE --skill $SKILL_NAME --agent '*' --global --copy -y"
    return
  fi

  step "Installing skill: $(join_names "$agents")"

  set -f
  set -- npx -y skills add "$SKILL_SOURCE" --skill "$SKILL_NAME" --global --copy -y
  for agent in $agents; do
    set -- "$@" --agent "$agent"
  done
  set +f

  if "$@" >/dev/null 2>&1; then
    SKILL_STATUS="ok"
  else
    SKILL_STATUS="failed"
    warn "skill installation failed; rerun with ARTIFACTS_SKIP_SKILLS=1 to install only the CLI"
  fi
}

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
summary() {
  _agents="$1"
  [ -n "$DISPLAY_DIR" ] || DISPLAY_DIR="$(printf '%s' "$INSTALL_DIR" | sed "s#^$HOME#~#")"

  printf '\n'
  printf '  %sCLI%s     %s%s/artifacts%s\n' "$C_DIM" "$C_RESET" "$C_DIM" "$DISPLAY_DIR" "$C_RESET"

  case "$LOGIN_STATUS" in
    ok)      printf '  %sAUTH%s    signed in\n' "$C_DIM" "$C_RESET" ;;
    token)   printf '  %sAUTH%s    AGENT_ARTIFACTS_TOKEN\n' "$C_DIM" "$C_RESET" ;;
    skipped) printf '  %sAUTH%s    %sskipped%s\n' "$C_DIM" "$C_RESET" "$C_DIM" "$C_RESET" ;;
    failed)  printf '  %sAUTH%s    %srun "artifacts login" to sign in%s\n' "$C_DIM" "$C_RESET" "$C_DIM" "$C_RESET" ;;
  esac

  case "$SKIP_SKILLS" in
    1|true|TRUE|yes|YES) printf '  %sSKILL%s   skipped\n' "$C_DIM" "$C_RESET" ;;
    *)
      if [ -z "$_agents" ]; then
        printf '  %sSKILL%s   none selected\n' "$C_DIM" "$C_RESET"
      elif [ "$SKILL_STATUS" = "failed" ] || [ "$SKILL_STATUS" = "npx-missing" ]; then
        printf '  %sSKILL%s   %s (%s)\n' "$C_DIM" "$C_RESET" "$(join_names "$_agents")" "$SKILL_STATUS"
      else
        printf '  %sSKILL%s   %s\n' "$C_DIM" "$C_RESET" "$(join_names "$_agents")"
      fi ;;
  esac

  printf '\n  %sNext:%s %sartifacts schema%s\n\n' "$C_DIM" "$C_RESET" "$C_BOLD" "$C_RESET"
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
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
  AGENT_N="$(agent_count)"

  TMP_DIR="$(mktemp -d)"
  trap 'rm -rf "$TMP_DIR"' EXIT HUP INT TERM

  RELEASE_URL="$(release_path)"
  MANIFEST="$TMP_DIR/manifest.json"

  banner

  # Fetch release metadata silently
  download "$RELEASE_URL/manifest.json" "$MANIFEST"

  # Use node.minMajor from manifest if present, otherwise default to 24
  manifest_node="$(manifest_get "$MANIFEST" node.minMajor)" || true
  [ -n "$manifest_node" ] || manifest_node="24"
  [ "$NODE_MAJOR" -ge "$manifest_node" ] || fail "Node.js $manifest_node+ required; found $(node -v)"

  # 1. Install CLI
  install_cli "$RELEASE_URL" "$MANIFEST"

  # 2. Login immediately after CLI install
  run_login "$CLI_PATH"

  # 3. Agent selection + skill installation
  agents=""
  case "$SKIP_SKILLS" in
    1|true|TRUE|yes|YES) : ;;
    *)
      if [ -n "$SKILL_AGENTS" ]; then
        agents="$SKILL_AGENTS"
      else
        choose_agents
        agents="$(selected_slugs)"
      fi
      ;;
  esac

  [ -z "$agents" ] || run_skills "$agents"

  # 4. Summary
  summary "$agents"
}

case "${ARTIFACTS_LIB_ONLY:-}" in
  1|true|TRUE|yes|YES) : ;;
  *) main ;;
esac
