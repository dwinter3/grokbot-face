#!/usr/bin/env bash
# SPDX-License-Identifier: MIT
# Copyright (c) 2026 David Winter
#
# Grok Bot Face setup: check tools, collect config, deploy the optional Worker, build, install.
# Safe to re-run (idempotent). Writes only git-ignored files:
#   usage-feed/.env.local   (CF account, KV id, Worker name/subdomain, search term)   mode 600
#   android/local.env       (USAGE_FEED_URL, keystore path/alias/passwords)         mode 600
#   $TOKEN_FILE             (FEED_TOKEN, default ~/.grokbot-usage-feed/token.env)   mode 600
# Secrets (CURSOR_KEY, CLOUDFLARE_API_TOKEN) are read with hidden input and never written to disk
# by this script; CURSOR_KEY goes straight into `wrangler secret put`.
#
# Usage: scripts/setup.sh [all|doctor|config|deploy|build|install|verify]   (default: all)
# Non-interactive: set GBF_NONINTERACTIVE=1 and provide values as env vars:
#   GBF_FEED=none|deploy|url  USAGE_FEED_URL  CF_ACCOUNT_ID  CLOUDFLARE_API_TOKEN  CURSOR_KEY  SEARCH_TERM
#   FEED_TOKEN  WORKER_NAME  KEYSTORE  KS_PASS  KEY_PASS  KS_ALIAS  TABLET_ADDR (ip:port)  GBF_INSTALL=0|1
#   GBF_SCREENSAVER=0|1
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/.." && pwd)
FEED_ENV=$ROOT/usage-feed/.env.local; APP_ENV=$ROOT/android/local.env
PKG=dev.orion.grokbotface; APK=$ROOT/android/grokbot-face.apk
NI=${GBF_NONINTERACTIVE:-0}
if [ -t 1 ]; then G=$'\033[32m' R=$'\033[31m' Y=$'\033[33m' N=$'\033[0m'; else G= R= Y= N=; fi
c_ok() { printf '  %sok%s   %s\n' "$G" "$N" "$*"; }; c_no() { printf '  %smiss%s %s\n' "$R" "$N" "$*"; }; c_opt() { printf '  %sopt%s  %s\n' "$Y" "$N" "$*"; }
die() { echo "error: $*" >&2; exit 1; }
load() { [ -f "$FEED_ENV" ] && . "$FEED_ENV"; [ -f "$APP_ENV" ] && . "$APP_ENV"; TOKEN_FILE=${TOKEN_FILE:-$HOME/.grokbot-usage-feed/token.env}; [ -f "$TOKEN_FILE" ] && . "$TOKEN_FILE"; return 0; }
# ask VAR "prompt" [default] [secret]
ask() {
  local v=$1 p=$2 d=${3:-} s=${4:-} cur=${!1:-}
  [ -n "$cur" ] && return 0
  if [ "$NI" = 1 ]; then printf -v "$v" '%s' "$d"; return 0; fi
  local ans
  if [ "$s" = secret ]; then read -r -s -p "$p: " ans; echo; else read -r -p "$p${d:+ [$d]}: " ans; fi
  printf -v "$v" '%s' "${ans:-$d}"
}
yesno() { local a; [ "$NI" = 1 ] && { [ "${2:-n}" = y ]; return; }; read -r -p "$1 [${2:-n}] " a; a=${a:-${2:-n}}; [[ $a =~ ^[Yy] ]]; }
write_env() {  # file then KEY=VALUE pairs; values shell-quoted
  local f=$1; shift; umask 077; mkdir -p "$(dirname "$f")"; : > "$f.tmp"
  for kv in "$@"; do printf '%s=%q\n' "${kv%%=*}" "${kv#*=}" >> "$f.tmp"; done
  mv "$f.tmp" "$f"; chmod 600 "$f"
}
sdk() { echo "${ANDROID_SDK_ROOT:-${ANDROID_HOME:-$HOME/opt/android-sdk}}"; }
javabin() { if [ -n "${JAVA_HOME:-}" ]; then echo "$JAVA_HOME/bin/java"; elif J=$(ls -d ~/opt/jdk-17* 2>/dev/null | head -1) && [ -n "$J" ]; then echo "$J/bin/java"; else command -v java || true; fi; }

doctor() {
  load; local bad=0 S; S=$(sdk); echo "Build tools:"
  local J; J=$(javabin)
  if [ -n "$J" ] && "$J" -version 2>&1 | grep -qE 'version "(1[7-9]|2[0-9])'; then c_ok "JDK $("$J" -version 2>&1 | head -1 | sed 's/.*version "\([^"]*\)".*/\1/') ($J)"; else c_no "JDK 17+ (set JAVA_HOME)"; bad=1; fi
  for t in "build-tools/35.0.0/aapt2" "build-tools/35.0.0/d8" "build-tools/35.0.0/zipalign" "build-tools/35.0.0/apksigner" "platforms/android-34/android.jar"; do
    [ -e "$S/$t" ] && c_ok "Android SDK $t" || { c_no "Android SDK $t (sdkmanager \"build-tools;35.0.0\" \"platforms;android-34\", ANDROID_SDK_ROOT=$S)"; bad=1; }
  done
  for t in curl unzip zip python3 npm keytool; do
    if [ "$t" = keytool ]; then [ -n "$J" ] && [ -x "$(dirname "$J")/keytool" ] && c_ok keytool || { c_no keytool; bad=1; }; continue; fi
    command -v $t >/dev/null && c_ok "$t" || { c_no "$t"; bad=1; }
  done
  echo "Install / deploy (optional):"
  local A; A=$(command -v adb || { [ -x "$S/platform-tools/adb" ] && echo "$S/platform-tools/adb"; } || true)
  [ -n "$A" ] && c_ok "adb $("$A" version | sed -n 's/.*version \([0-9.]*\).*/\1/p' | head -1)" || c_opt "adb (platform-tools) - needed to install on a tablet/emulator"
  local NV; NV=$(node -v 2>/dev/null | tr -d v | cut -d. -f1)
  [ -n "$NV" ] && [ "$NV" -ge 22 ] && c_ok "node $(node -v) (wrangler OK)" || c_opt "node 22+ for wrangler (have: $(node -v 2>/dev/null || echo none)) - only for deploying the Worker"
  command -v jq >/dev/null && c_ok jq || c_opt "jq - only for usage-feed helper scripts"
  echo "Config:"
  [ -f "$APP_ENV" ] && c_ok "android/local.env" || c_opt "android/local.env (run: scripts/setup.sh config)"
  [ -n "${USAGE_FEED_URL:-}" ] && c_ok "USAGE_FEED_URL set (usage meter + news on)" || c_opt "USAGE_FEED_URL empty: app builds offline (no meter, no news)"
  [ -n "${KEYSTORE:-}" ] && { [ -f "$KEYSTORE" ] && c_ok "keystore $KEYSTORE" || c_no "keystore $KEYSTORE not found"; } || c_opt "no KEYSTORE: a throwaway android/debug.keystore is used (keep it!)"
  [ -f "$APK" ] && c_ok "APK built: $APK" || c_opt "APK not built yet"
  if command -v adb >/dev/null; then local n; n=$(adb devices | awk 'NR>1 && $2=="device"' | wc -l); [ "$n" -gt 0 ] && c_ok "$n adb device(s) connected" || c_opt "no adb device connected"; fi
  [ $bad = 0 ] && echo "doctor: build prerequisites OK" || { echo "doctor: missing build prerequisites"; return 1; }
}

config() {
  load
  echo "== Usage meter + news feed (optional Cloudflare Worker) =="
  local mode=${GBF_FEED:-}
  if [ -z "$mode" ]; then
    if [ -n "${USAGE_FEED_URL:-}" ]; then mode=url
    elif [ "$NI" = 1 ]; then mode=none
    else echo "  none   = offline app, no meter/news (simplest)"; echo "  deploy = deploy the Worker to your Cloudflare account now"; echo "  url    = you already have a feed URL"; ask mode "Feed mode (none/deploy/url)" none; fi
  fi
  case $mode in
    none) USAGE_FEED_URL= ;;
    url) ask USAGE_FEED_URL "Feed URL (https://.../<FEED_TOKEN>/usage.json)"; [[ $USAGE_FEED_URL =~ ^https://.+/usage\.json$ ]] || die "USAGE_FEED_URL must be https://.../usage.json" ;;
    deploy) ask CF_ACCOUNT_ID "Cloudflare account ID (dashboard sidebar, or: npx wrangler whoami)"
            ask SEARCH_TERM "Cursor team member to track (your email or name in the Cursor team)"
            ask WORKER_NAME "Worker name" grokbot-usage-feed
            [ -n "$CF_ACCOUNT_ID" ] && [ -n "$SEARCH_TERM" ] || die "CF_ACCOUNT_ID and SEARCH_TERM are required for deploy"
            write_env "$FEED_ENV" CF_ACCOUNT_ID="$CF_ACCOUNT_ID" KV_NAMESPACE_ID="${KV_NAMESPACE_ID:-}" WORKER_NAME="$WORKER_NAME" \
              WORKERS_SUBDOMAIN="${WORKERS_SUBDOMAIN:-}" SEARCH_TERM="$SEARCH_TERM" TOKEN_FILE="$TOKEN_FILE"
            GBF_DO_DEPLOY=1 ;;
    *) die "unknown feed mode: $mode" ;;
  esac
  echo "== Signing key =="
  echo "  The SAME key must sign every future build, or updates won't install over the app."
  ask KEYSTORE "Keystore path (empty = generate/keep android/debug.keystore)" ""
  if [ -n "$KEYSTORE" ]; then
    [ -f "$KEYSTORE" ] || die "keystore not found: $KEYSTORE"
    ask KS_ALIAS "Key alias"; ask KS_PASS "Keystore password" "" secret; KEY_PASS=${KEY_PASS:-$KS_PASS}
  fi
  echo "== Device =="
  ask TABLET_ADDR "Tablet/emulator adb address (ip:port from Wireless debugging; empty = USB/emulator/skip)" ""
  write_env "$APP_ENV" USAGE_FEED_URL="${USAGE_FEED_URL:-}" KEYSTORE="${KEYSTORE:-}" KS_ALIAS="${KS_ALIAS:-}" KS_PASS="${KS_PASS:-}" KEY_PASS="${KEY_PASS:-}" TABLET_ADDR="${TABLET_ADDR:-}"
  c_ok "wrote android/local.env (mode 600, git-ignored)"
  [ "${GBF_DO_DEPLOY:-0}" = 1 ] && deploy
  return 0
}

wr() { (cd "$ROOT/usage-feed" && npx --yes wrangler@4 "$@"); }
deploy() {
  load; [ -f "$FEED_ENV" ] || die "run: scripts/setup.sh config (feed mode deploy) first"
  local NV; NV=$(node -v 2>/dev/null | tr -d v | cut -d. -f1); [ -n "$NV" ] && [ "$NV" -ge 22 ] || die "wrangler needs Node 22+ (have $(node -v 2>/dev/null || echo none))"
  if [ -z "${CLOUDFLARE_API_TOKEN:-}" ] && ! wr whoami 2>/dev/null | grep -q 'You are logged in'; then
    if [ "$NI" = 1 ]; then die "set CLOUDFLARE_API_TOKEN or run 'npx wrangler login' first"; fi
    ask CLOUDFLARE_API_TOKEN "Cloudflare API token (hidden; empty = run 'wrangler login' in a browser)" "" secret
    if [ -n "$CLOUDFLARE_API_TOKEN" ]; then export CLOUDFLARE_API_TOKEN; else wr login; fi
  fi
  export CLOUDFLARE_ACCOUNT_ID=$CF_ACCOUNT_ID
  if [ -z "${KV_NAMESPACE_ID:-}" ]; then
    KV_NAMESPACE_ID=$(wr kv namespace list 2>/dev/null | python3 -c "import sys,json;d=json.load(sys.stdin);print(next((n['id'] for n in d if n['title'].endswith('FEED') or n['title']=='$WORKER_NAME'),''))" 2>/dev/null || true)
    [ -n "$KV_NAMESPACE_ID" ] || KV_NAMESPACE_ID=$(wr kv namespace create "$WORKER_NAME" 2>&1 | grep -oE '[0-9a-f]{32}' | head -1)
    [ -n "$KV_NAMESPACE_ID" ] || die "could not create a KV namespace"
  fi
  sed -e "s/^name = .*/name = \"$WORKER_NAME\"/" -e "s/<KV_NAMESPACE_ID>/$KV_NAMESPACE_ID/" -e "s|<your Cursor team member email or name>|$SEARCH_TERM|" \
    "$ROOT/usage-feed/wrangler.toml.example" > "$ROOT/usage-feed/wrangler.toml"
  local out url; out=$(wr deploy 2>&1) || { echo "$out"; die "wrangler deploy failed"; }
  url=$(echo "$out" | grep -oE "https://[A-Za-z0-9.-]+\.workers\.dev" | head -1)
  [ -n "$url" ] || { echo "$out"; die "no workers.dev URL in deploy output (enable your workers.dev subdomain in the dashboard)"; }
  WORKERS_SUBDOMAIN=$(echo "$url" | sed -E "s#https://$WORKER_NAME\.([^.]+)\.workers\.dev#\1#")
  if [ -z "${FEED_TOKEN:-}" ]; then FEED_TOKEN=$(python3 -c 'import secrets;print(secrets.token_urlsafe(33))'); fi
  printf '%s' "$FEED_TOKEN" | wr secret put FEED_TOKEN >/dev/null
  write_env "$TOKEN_FILE" FEED_TOKEN="$FEED_TOKEN"
  if ! wr secret list 2>/dev/null | grep -q CURSOR_KEY || [ -n "${CURSOR_KEY:-}" ]; then
    ask CURSOR_KEY "Cursor team Admin API key (hidden; cursor.com dashboard > Settings > Advanced > Admin API keys)" "" secret
    [ -n "$CURSOR_KEY" ] || die "CURSOR_KEY is required for the usage meter"
    printf '%s' "$CURSOR_KEY" | wr secret put CURSOR_KEY >/dev/null; unset CURSOR_KEY
  fi
  write_env "$FEED_ENV" CF_ACCOUNT_ID="$CF_ACCOUNT_ID" KV_NAMESPACE_ID="$KV_NAMESPACE_ID" WORKER_NAME="$WORKER_NAME" WORKERS_SUBDOMAIN="$WORKERS_SUBDOMAIN" SEARCH_TERM="$SEARCH_TERM" TOKEN_FILE="$TOKEN_FILE"
  USAGE_FEED_URL="$url/$FEED_TOKEN/usage.json"
  load; write_env "$APP_ENV" USAGE_FEED_URL="$USAGE_FEED_URL" KEYSTORE="${KEYSTORE:-}" KS_ALIAS="${KS_ALIAS:-}" KS_PASS="${KS_PASS:-}" KEY_PASS="${KEY_PASS:-}" TABLET_ADDR="${TABLET_ADDR:-}"
  local code; code=$(curl -s -o /dev/null -w '%{http_code}' "$USAGE_FEED_URL" || true)
  c_ok "Worker deployed: $url (usage.json HTTP $code; 200 = working, 503 = Cursor key/search term problem)"
}

build() { load; doctor >/dev/null || { doctor; die "fix the missing tools first"; }; "$ROOT/android/build.sh"; }

adbx() { command -v adb >/dev/null && adb "$@" || "$(sdk)/platform-tools/adb" "$@"; }
install() {
  load; [ -f "$APK" ] || build
  if [ -n "${TABLET_ADDR:-}" ]; then adbx connect "$TABLET_ADDR" | sed 's/^/  /'; fi
  local dev; dev=$(adbx devices | awk 'NR>1 && $2=="device"{print $1; exit}')
  [ -n "$dev" ] || die "no adb device. On the tablet: Settings > Developer options > Wireless debugging > Pair device with pairing code, then 'adb pair IP:PORT' and set TABLET_ADDR"
  local S=(-s "$dev")
  if ! adbx "${S[@]}" install -r "$APK"; then die "install failed. INSTALL_FAILED_UPDATE_INCOMPATIBLE = different signing key; uninstall the old app (loses its settings) or sign with the original key"; fi
  adbx "${S[@]}" shell pm grant $PKG android.permission.CAMERA 2>/dev/null && c_ok "camera granted" || c_opt "grant camera on the device when asked"
  adbx "${S[@]}" shell pm grant $PKG android.permission.RECORD_AUDIO 2>/dev/null && c_ok "microphone granted" || c_opt "grant microphone on the device when asked"
  if [ "${GBF_SCREENSAVER:-1}" = 1 ]; then
    adbx "${S[@]}" shell settings put secure screensaver_components $PKG/.FaceDreamService && adbx "${S[@]}" shell settings put secure screensaver_enabled 1 \
      && c_ok "screensaver set to Grok Bot Face" || c_opt "set screensaver by hand: Settings > Display > Screen saver"
  fi
  adbx "${S[@]}" shell am start -n $PKG/.MainActivity >/dev/null && c_ok "app launched on $dev"
}

verify() {
  load; echo "Verification:"
  [ -f "$APK" ] && c_ok "APK $(du -h "$APK" | cut -f1) $APK" || c_no "APK not built"
  if [ -f "$APK" ] && [ -x "$(sdk)/build-tools/35.0.0/aapt2" ]; then
    "$(sdk)/build-tools/35.0.0/aapt2" dump permissions "$APK" | grep -q INTERNET && c_ok "feed baked in (INTERNET permission present)" || c_opt "offline build (no INTERNET permission)"
  fi
  [ -n "${USAGE_FEED_URL:-}" ] && { local code; code=$(curl -s -o /dev/null -w '%{http_code}' "$USAGE_FEED_URL" || echo 000); [ "$code" = 200 ] && c_ok "feed reachable (HTTP 200)" || c_opt "feed HTTP $code"; }
  local dev; dev=$(adbx devices 2>/dev/null | awk 'NR>1 && $2=="device"{print $1; exit}' || true)
  if [ -n "$dev" ]; then
    adbx -s "$dev" shell pm list packages 2>/dev/null | grep -q "$PKG" && c_ok "installed on $dev ($(adbx -s "$dev" shell dumpsys package $PKG | sed -n 's/.*versionName=//p' | head -1))" || c_opt "not installed on $dev"
    adbx -s "$dev" shell dumpsys package $PKG 2>/dev/null | grep -E 'CAMERA: granted=true|RECORD_AUDIO: granted=true' | sed 's/^ */  ok   /'
  fi
  return 0
}

cmd=${1:-all}
case $cmd in
  doctor) doctor ;; config) config ;; deploy) deploy ;; build) build ;; install) install ;; verify) verify ;;
  all) doctor || die "install the missing build tools, then re-run"; config; build
       if [ "${GBF_INSTALL:-}" = 1 ] || { [ -z "${GBF_INSTALL:-}" ] && yesno "Install on a tablet/emulator now?" n; }; then install; fi
       verify ;;
  *) echo "usage: $0 [all|doctor|config|deploy|build|install|verify]"; exit 2 ;;
esac
