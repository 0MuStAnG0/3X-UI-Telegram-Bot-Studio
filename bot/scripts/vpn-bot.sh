#!/bin/bash
set -e

BOT_DIR="{{BOT_DIR}}"
SERVICE="vpnbot"
BACKUP_DIR="$BOT_DIR/backups"

C_GREEN='\033[0;32m'
C_YELLOW='\033[1;33m'
C_RED='\033[0;31m'
C_CYAN='\033[0;36m'
C_BLUE='\033[0;34m'
C_BOLD='\033[1m'
C_DIM='\033[2m'
C_NC='\033[0m'

mkdir -p "$BACKUP_DIR"

ok()   { echo -e "${C_GREEN}[OK]${C_NC} $1"; }
warn() { echo -e "${C_YELLOW}[!]${C_NC} $1"; }
err()  { echo -e "${C_RED}[X]${C_NC} $1"; }
pause() { read -rp "Press Enter to continue..." _; }

env_get() {
    [ -f "$BOT_DIR/.env" ] || { echo ""; return; }
    grep -E "^${1}=" "$BOT_DIR/.env" | head -n1 | cut -d'=' -f2-
}

env_set() {
    python3 -c "
import sys
key, val, path = sys.argv[1], sys.argv[2], sys.argv[3]
lines = []
found = False
try:
    with open(path, 'r', encoding='utf-8') as f:
        lines = f.read().splitlines()
except FileNotFoundError:
    pass
out = []
for line in lines:
    if line.startswith(key + '='):
        out.append(f'{key}={val}')
        found = True
    elif line.strip() != '':
        out.append(line)
if not found:
    out.append(f'{key}={val}')
with open(path, 'w', encoding='utf-8') as f:
    f.write('\n'.join(out) + '\n')
" "$1" "$2" "$BOT_DIR/.env"
}

mask() {
    local v="$1"
    local len=${#v}
    if [ "$len" -le 8 ]; then
        echo "****"
    else
        echo "${v:0:4}****${v: -4}"
    fi
}

maybe_restart() {
    read -rp "Restart the bot now to apply changes? (y/n): " R
    if [ "$R" == "y" ]; then
        systemctl restart "$SERVICE"
        ok "Restarted."
    fi
}

status_line() {
    if systemctl is-active --quiet "$SERVICE" 2>/dev/null; then
        echo -e "${C_GREEN}${C_BOLD}● RUNNING${C_NC}"
    else
        echo -e "${C_RED}${C_BOLD}● STOPPED${C_NC}"
    fi
}

do_backup() {
    TS=$(date +%Y%m%d_%H%M%S)
    OUT="$BACKUP_DIR/backup_${TS}.tar.gz"
    echo -e "${C_CYAN}Creating backup...${C_NC}"
    tar -czf "$OUT" -C "$BOT_DIR" \
        .env config.py database.py main.py requirements.txt vpn_bot.db \
        handlers keyboards middlewares services utils scripts 2>/dev/null || true
    ok "Backup saved: $OUT"
}

do_restore() {
    echo -e "${C_CYAN}Available backups:${C_NC}"
    ls -1t "$BACKUP_DIR" 2>/dev/null | nl
    echo ""
    read -rp "Enter backup number (or full file path): " CHOICE
    if [[ "$CHOICE" =~ ^[0-9]+$ ]]; then
        FILE=$(ls -1t "$BACKUP_DIR" | sed -n "${CHOICE}p")
        FILE="$BACKUP_DIR/$FILE"
    else
        FILE="$CHOICE"
    fi
    [ ! -f "$FILE" ] && { err "File not found."; return; }
    warn "This will overwrite current bot files."
    read -rp "Are you sure? (y/n): " CONFIRM
    [ "$CONFIRM" != "y" ] && { echo "Cancelled."; return; }
    systemctl stop "$SERVICE"
    tar -xzf "$FILE" -C "$BOT_DIR"
    systemctl start "$SERVICE"
    ok "Restore complete, bot restarted."
}

view_db_stats() {
    DB="$BOT_DIR/vpn_bot.db"
    [ ! -f "$DB" ] && { err "Database not found."; return; }
    echo -e "${C_CYAN}--- Quick database stats ---${C_NC}"
    printf "%-18s: " "Users";            sqlite3 "$DB" "SELECT COUNT(*) FROM users;" 2>/dev/null || echo "N/A"
    printf "%-18s: " "Orders";           sqlite3 "$DB" "SELECT COUNT(*) FROM orders;" 2>/dev/null || echo "N/A"
    printf "%-18s: " "Total revenue";    sqlite3 "$DB" "SELECT COALESCE(SUM(amount_paid),0) FROM orders;" 2>/dev/null || echo "N/A"
    printf "%-18s: " "Pending payments"; sqlite3 "$DB" "SELECT COUNT(*) FROM pending_payments WHERE status='pending';" 2>/dev/null || echo "N/A"
}

reinstall_deps() {
    cd "$BOT_DIR"
    echo -e "${C_CYAN}Updating Python packages...${C_NC}"
    .venv/bin/python3 -m pip install --upgrade pip -q
    .venv/bin/python3 -m pip install -r requirements.txt -q --upgrade
    ok "Packages updated."
    maybe_restart
}

health_check() {
    echo -e "${C_CYAN}Running health checks...${C_NC}"
    echo ""
    printf "%-30s" "Bot service:"
    systemctl is-active --quiet "$SERVICE" 2>/dev/null && echo -e "${C_GREEN}running${C_NC}" || echo -e "${C_RED}not running${C_NC}"

    printf "%-30s" ".env file:"
    [ -f "$BOT_DIR/.env" ] && echo -e "${C_GREEN}found${C_NC}" || echo -e "${C_RED}missing${C_NC}"

    if [ -f "$BOT_DIR/.env" ]; then
        set -a
        source "$BOT_DIR/.env"
        set +a
    fi

    printf "%-30s" "Telegram bot token:"
    if [ -n "$BOT_TOKEN" ]; then
        TG=$(curl -s --max-time 10 "https://api.telegram.org/bot${BOT_TOKEN}/getMe" 2>/dev/null || true)
        if echo "$TG" | grep -q '"ok":true'; then
            U=$(echo "$TG" | python3 -c "import sys,json; print(json.load(sys.stdin)['result']['username'])" 2>/dev/null || echo "bot")
            echo -e "${C_GREEN}valid (@${U})${C_NC}"
        else
            echo -e "${C_RED}invalid or unreachable${C_NC}"
        fi
    else
        echo -e "${C_YELLOW}not set${C_NC}"
    fi

    printf "%-30s" "SOCKS5 proxy:"
    if [ -n "$PROXY_HOST" ] && [ -n "$PROXY_PORT" ]; then
        if timeout 3 bash -c "cat < /dev/null > /dev/tcp/$PROXY_HOST/$PROXY_PORT" 2>/dev/null; then
            echo -e "${C_GREEN}reachable (${PROXY_HOST}:${PROXY_PORT})${C_NC}"
        else
            echo -e "${C_RED}cannot connect${C_NC}"
        fi
    else
        echo -e "${C_DIM}disabled (direct connection)${C_NC}"
    fi

    printf "%-30s" "3X-UI panel API token:"
    if [ -n "$PANEL_URL" ] && [ -n "$PANEL_API_TOKEN" ]; then
        RES=$(curl -sk --max-time 10 -H "Authorization: Bearer ${PANEL_API_TOKEN}" "${PANEL_URL}${PANEL_PATH}/panel/api/inbounds/list" 2>/dev/null || true)
        echo "$RES" | grep -q '"success":true' && echo -e "${C_GREEN}valid${C_NC}" || echo -e "${C_RED}invalid or unreachable${C_NC}"
    else
        echo -e "${C_YELLOW}not set${C_NC}"
    fi

    printf "%-30s" "Database file:"
    if [ -f "$BOT_DIR/vpn_bot.db" ]; then
        SZ=$(du -h "$BOT_DIR/vpn_bot.db" 2>/dev/null | cut -f1)
        echo -e "${C_GREEN}found (${SZ})${C_NC}"
    else
        echo -e "${C_YELLOW}not initialized yet${C_NC}"
    fi

    printf "%-30s" "Web panel:"
    WP_PORT="${WEB_PANEL_PORT:-8080}"
    if [ "${WEB_PANEL_ENABLED:-y}" == "y" ]; then
        WP_IP=$(curl -s4 --max-time 3 https://api.ipify.org 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}' || echo "127.0.0.1")
        echo -e "${C_GREEN}http://${WP_IP}:${WP_PORT}${C_NC}"
    else
        echo -e "${C_DIM}disabled${C_NC}"
    fi

    printf "%-30s" "Disk space:"
    echo -e "${C_CYAN}$(df -h "$BOT_DIR" 2>/dev/null | awk 'NR==2 {print $4}') free${C_NC}"
    echo ""
}

uninstall_bot() {
    warn "This removes the systemd service and the vpn-bot command."
    echo "Bot files in $BOT_DIR will NOT be deleted."
    read -rp "Are you sure? (y/n): " CONFIRM
    if [ "$CONFIRM" == "y" ]; then
        systemctl stop "$SERVICE" 2>/dev/null || true
        systemctl disable "$SERVICE" 2>/dev/null || true
        rm -f "/etc/systemd/system/${SERVICE}.service"
        systemctl daemon-reload
        rm -f /usr/local/bin/vpn-bot
        echo "Removed. Bot files remain in $BOT_DIR."
    fi
}

settings_bot() {
    clear
    echo -e "${C_CYAN}--- Bot & Admins ---${C_NC}"
    echo "Token: $(mask "$(env_get BOT_TOKEN)")"
    echo "Admin IDs: $(env_get ADMIN_IDS)"
    echo "Support: $(env_get SUPPORT)"
    echo "1) Change BOT_TOKEN | 2) Change ADMIN_IDS | 3) Change SUPPORT | 0) Back"
    read -rp "Choose: " C
    case $C in
        1) read -rp "New BOT_TOKEN: " V; env_set BOT_TOKEN "$V"; maybe_restart ;;
        2) read -rp "New ADMIN_IDS (comma-separated): " V; env_set ADMIN_IDS "$V"; maybe_restart ;;
        3) read -rp "New SUPPORT (@user): " V; env_set SUPPORT "$V"; maybe_restart ;;
    esac
}

settings_panel() {
    clear
    echo -e "${C_CYAN}--- 3X-UI Panel (API Token) ---${C_NC}"
    echo "URL: $(env_get PANEL_URL)"
    echo "Path: $(env_get PANEL_PATH)"
    echo "API Token: $(mask "$(env_get PANEL_API_TOKEN)")"
    echo "Sub URL: $(env_get SUB_BASE_URL)"
    echo "1) Change PANEL_URL | 2) Change PANEL_PATH | 3) Change PANEL_API_TOKEN | 4) Change SUB_BASE_URL | 0) Back"
    read -rp "Choose: " C
    case $C in
        1) read -rp "New PANEL_URL: " V; env_set PANEL_URL "${V%/}"; maybe_restart ;;
        2) read -rp "New PANEL_PATH: " V; env_set PANEL_PATH "${V%/}"; maybe_restart ;;
        3) read -rp "New PANEL_API_TOKEN: " V; env_set PANEL_API_TOKEN "$V"; maybe_restart ;;
        4) read -rp "New SUB_BASE_URL: " V; env_set SUB_BASE_URL "${V%/}"; maybe_restart ;;
    esac
}

settings_proxy() {
    clear
    echo -e "${C_CYAN}--- SOCKS5 Proxy ---${C_NC}"
    echo "Host: $(env_get PROXY_HOST) | Port: $(env_get PROXY_PORT)"
    echo "1) Enable / update proxy | 2) Disable proxy | 0) Back"
    read -rp "Choose: " C
    case $C in
        1) read -rp "Proxy host: " H; read -rp "Proxy port: " P; env_set PROXY_HOST "$H"; env_set PROXY_PORT "$P"; maybe_restart ;;
        2) env_set PROXY_HOST ""; env_set PROXY_PORT ""; ok "Disabled."; maybe_restart ;;
    esac
}

edit_env() {
    while true; do
        clear
        echo -e "${C_CYAN}${C_BOLD}--- Edit Settings ---${C_NC}"
        echo "1) Bot & Admins"
        echo "2) 3X-UI Panel (API Token)"
        echo "3) SOCKS5 Proxy"
        echo "4) Raw .env editor"
        echo "0) Back"
        read -rp "Choose: " C
        case $C in
            1) settings_bot; pause ;;
            2) settings_panel; pause ;;
            3) settings_proxy; pause ;;
            4) "${EDITOR:-nano}" "$BOT_DIR/.env"; maybe_restart ;;
            0) break ;;
        esac
    done
}

show_menu() {
    clear
    echo -e "${C_BLUE}${C_BOLD}======================================================${C_NC}"
    echo -e "${C_BLUE}${C_BOLD}          3X-UI VPN Bot — Control CLI (vpn-bot)       ${C_NC}"
    echo -e "${C_BLUE}${C_BOLD}======================================================${C_NC}"
    echo -e "  Service status: $(status_line)"
    echo -e "${C_DIM}------------------------------------------------------${C_NC}"
    echo -e "  ${C_GREEN}1)${C_NC}  Start bot"
    echo -e "  ${C_GREEN}2)${C_NC}  Stop bot"
    echo -e "  ${C_GREEN}3)${C_NC}  Restart bot"
    echo -e "  ${C_GREEN}4)${C_NC}  Service status"
    echo -e "  ${C_GREEN}5)${C_NC}  Live logs (Ctrl+C to exit)"
    echo -e "  ${C_GREEN}6)${C_NC}  Last 100 log lines"
    echo -e "  ${C_GREEN}7)${C_NC}  Edit settings"
    echo -e "  ${C_GREEN}8)${C_NC}  Create backup"
    echo -e "  ${C_GREEN}9)${C_NC}  Restore from backup"
    echo -e "  ${C_GREEN}10)${C_NC} Quick database stats"
    echo -e "  ${C_GREEN}11)${C_NC} Update Python packages"
    echo -e "  ${C_GREEN}12)${C_NC} Health check"
    echo -e "  ${C_GREEN}13)${C_NC} Uninstall CLI & service"
    echo -e "  ${C_RED}0)${C_NC}  Exit"
    echo -e "${C_DIM}------------------------------------------------------${C_NC}"
}

if [ -n "${1:-}" ]; then
    case "$1" in
        start)   systemctl start "$SERVICE"; ok "Started." ;;
        stop)    systemctl stop "$SERVICE"; warn "Stopped." ;;
        restart) systemctl restart "$SERVICE"; ok "Restarted." ;;
        status)  systemctl status "$SERVICE" --no-pager ;;
        logs)    journalctl -u "$SERVICE" -f ;;
        backup)  do_backup ;;
        restore) do_restore ;;
        stats)   view_db_stats ;;
        health)  health_check ;;
        *)       err "Unknown command: $1" && exit 1 ;;
    esac
    exit 0
fi

while true; do
    show_menu
    read -rp "Choose an option: " CHOICE
    case $CHOICE in
        1)  systemctl start "$SERVICE"; ok "Started."; pause ;;
        2)  systemctl stop "$SERVICE"; warn "Stopped."; pause ;;
        3)  systemctl restart "$SERVICE"; ok "Restarted."; pause ;;
        4)  systemctl status "$SERVICE" --no-pager; pause ;;
        5)  journalctl -u "$SERVICE" -f ;;
        6)  journalctl -u "$SERVICE" -n 100 --no-pager; pause ;;
        7)  edit_env ;;
        8)  do_backup; pause ;;
        9)  do_restore; pause ;;
        10) view_db_stats; pause ;;
        11) reinstall_deps; pause ;;
        12) health_check; pause ;;
        13) uninstall_bot; exit 0 ;;
        0)  exit 0 ;;
        *)  err "Invalid option."; pause ;;
    esac
done
