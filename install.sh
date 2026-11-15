#!/bin/bash
set -e

REPO_URL="${REPO_URL:-https://github.com/0MuStAnG0/3X-UI-Telegram-Bot-Studio.git}"
REPO_BRANCH="${REPO_BRANCH:-main}"
BOT_DIR="${BOT_DIR:-/opt/3xui-vpn-bot}"

if [ "$EUID" -ne 0 ]; then
    echo "[X] Please run as root:"
    echo "    sudo bash install.sh"
    echo "    or: bash <(curl -fsSL https://raw.githubusercontent.com/0MuStAnG0/3X-UI-Telegram-Bot-Studio/main/install.sh)"
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd || true)"
mkdir -p "$BOT_DIR"

if [ -n "$SCRIPT_DIR" ] && [ -f "$SCRIPT_DIR/bot/install.sh" ] && [ -f "$SCRIPT_DIR/bot/main.py" ]; then
    echo "[*] Installing from local repository directory ($SCRIPT_DIR/bot)..."
    SRC_BOT="$SCRIPT_DIR/bot"
else
    echo "[*] Downloading 3X-UI Telegram Bot from GitHub ($REPO_URL)..."
    if ! command -v git &> /dev/null; then
        if command -v apt-get &> /dev/null; then
            export DEBIAN_FRONTEND=noninteractive
            apt-get update -qq && apt-get install -y -qq git curl
        elif command -v dnf &> /dev/null; then
            dnf install -y -q git curl
        elif command -v yum &> /dev/null; then
            yum install -y -q git curl
        fi
    fi

    TMP_CLONE="$(mktemp -d)"
    trap 'rm -rf "$TMP_CLONE"' EXIT
    git clone --branch "$REPO_BRANCH" --depth 1 "$REPO_URL" "$TMP_CLONE"
    if [ ! -f "$TMP_CLONE/bot/install.sh" ]; then
        echo "[X] bot/install.sh not found in repository."
        exit 1
    fi
    SRC_BOT="$TMP_CLONE/bot"
fi

# Preserve existing .env and SQLite database on updates
TMP_ENV=""
TMP_DB=""
[ -f "$BOT_DIR/.env" ] && { TMP_ENV="$(mktemp)"; cp "$BOT_DIR/.env" "$TMP_ENV"; }
[ -f "$BOT_DIR/vpn_bot.db" ] && { TMP_DB="$(mktemp)"; cp "$BOT_DIR/vpn_bot.db" "$TMP_DB"; }

cp -r "$SRC_BOT"/. "$BOT_DIR"/

[ -n "$TMP_ENV" ] && { cp "$TMP_ENV" "$BOT_DIR/.env"; rm -f "$TMP_ENV"; }
[ -n "$TMP_DB" ] && { cp "$TMP_DB" "$BOT_DIR/vpn_bot.db"; rm -f "$TMP_DB"; }

chmod +x "$BOT_DIR/install.sh" "$BOT_DIR/scripts/vpn-bot.sh" "$BOT_DIR/scripts/utils.sh"
exec bash "$BOT_DIR/install.sh"
