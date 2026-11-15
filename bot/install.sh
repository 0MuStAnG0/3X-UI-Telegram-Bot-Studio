#!/bin/bash
set -e

BOT_DIR="/opt/3xui-vpn-bot"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ "$EUID" -ne 0 ]; then
    echo "Please run as root (sudo bash install.sh)"
    exit 1
fi

mkdir -p "$BOT_DIR"
if [ "$SCRIPT_DIR" != "$BOT_DIR" ]; then
    cp -r "$SCRIPT_DIR"/. "$BOT_DIR"/
fi

source "$BOT_DIR/scripts/utils.sh"

echo ""
info "3X-UI VPN Telegram Bot & Web Panel Installer"
echo ""

if [ ! -f "$BOT_DIR/.env" ]; then
    info "Telegram bot configuration"
    ask_required "Bot token (BOT_TOKEN)" BOT_TOKEN
    ask_required "Admin numeric IDs (comma-separated)" ADMIN_IDS
    ask_required "Support username (@support)" SUPPORT

    ask_yesno "Enable mandatory channel membership check?" WANT_CHANNEL
    if [ "$WANT_CHANNEL" == "y" ]; then
        ask_required "Channel numeric ID" REQUIRED_CHANNEL_ID
        ask_required "Channel invite link" REQUIRED_CHANNEL_INVITE
    else
        REQUIRED_CHANNEL_ID="0"
        REQUIRED_CHANNEL_INVITE=""
    fi

    echo ""
    info "3X-UI Panel configuration (API Token only)"
    ask_required "Panel URL (e.g. https://example.com:2053)" PANEL_URL
    ask_optional "Panel webBasePath (e.g. /secret or empty)" "" PANEL_PATH
    ask_required "Panel API Token (Bearer)" PANEL_API_TOKEN
    ask_required "Subscription base URL (e.g. https://sub.example.com:2096/sub)" SUB_BASE_URL
    PANEL_URL="${PANEL_URL%/}"
    PANEL_PATH="${PANEL_PATH%/}"
    SUB_BASE_URL="${SUB_BASE_URL%/}"

    info "Fetching inbounds from panel..."
    INBOUNDS_JSON=$(curl -sk --max-time 15 -H "Authorization: Bearer ${PANEL_API_TOKEN}" "${PANEL_URL}${PANEL_PATH}/panel/api/inbounds/list" 2>/dev/null || true)
    INBOUNDS=""
    if echo "$INBOUNDS_JSON" | grep -q '"success":true'; then
        ok "Connected to 3X-UI panel via API Token."
        python3 "$BOT_DIR/scripts/parse_panel.py" --action list --json "$INBOUNDS_JSON"
        tty_read "Enter inbound ID(s) comma-separated: " INB_CHOICES
        ask_yesno "Enable xtls-rprx-vision flow for Reality inbounds?" WANT_VISION
        FLOW=""
        [ "$WANT_VISION" == "y" ] && FLOW="xtls-rprx-vision"
        IFS=',' read -ra CHOICE_ARR <<< "$INB_CHOICES"
        for idx in "${CHOICE_ARR[@]}"; do
            idx="$(echo -n "$idx" | xargs)"
            [ -z "$idx" ] && continue
            LINE=$(python3 "$BOT_DIR/scripts/parse_panel.py" --action validate --json "$INBOUNDS_JSON" --id "$idx")
            [ "$LINE" == "INVALID" ] && continue
            IB_ID=$(echo "$LINE" | cut -d'|' -f1)
            IB_REMARK=$(echo "$LINE" | cut -d'|' -f2)
            IB_IS_REALITY=$(echo "$LINE" | cut -d'|' -f3)
            [ "$IB_IS_REALITY" == "y" ] && ENTRY_FLOW="$FLOW" || ENTRY_FLOW=""
            ENTRY="${IB_ID}:${IB_REMARK}:${ENTRY_FLOW}"
            [ -z "$INBOUNDS" ] && INBOUNDS="$ENTRY" || INBOUNDS="${INBOUNDS},${ENTRY}"
        done
    fi
    if [ -z "$INBOUNDS" ]; then
        ask_required "Enter Inbound ID manually" INBOUND_ID_MANUAL
        INBOUNDS="${INBOUND_ID_MANUAL}:default:xtls-rprx-vision"
    fi
    INBOUND_ID="${INBOUNDS%%:*}"

    echo ""
    info "Optional SOCKS5 proxy (for Iran servers)"
    ask_yesno "Enable local SOCKS5 proxy?" WANT_PROXY
    if [ "$WANT_PROXY" == "y" ]; then
        ask_required "Proxy host" PROXY_HOST
        ask_required "Proxy port" PROXY_PORT
    else
        PROXY_HOST=""
        PROXY_PORT=""
    fi

    ask_yesno "Enable log channel?" WANT_LOG
    [ "$WANT_LOG" == "y" ] && ask_required "Log channel numeric ID" LOG_CHANNEL_ID || LOG_CHANNEL_ID="0"

    ask_required "Card number" CARD_NUM
    ask_required "Cardholder name" CARD_NAME
    CARDS="${CARD_NUM}:${CARD_NAME}"

    echo ""
    info "Built-in Web Panel configuration"
    ask_optional "Web panel port" "8080" WEB_PANEL_PORT
    DEFAULT_WP_PASS=$(tr -dc 'A-Za-z0-9' </dev/urandom | head -c 12 2>/dev/null || echo "admin1234")
    ask_optional "Web panel password" "$DEFAULT_WP_PASS" WEB_PANEL_PASS

    cat > "$BOT_DIR/.env" << ENVEOF
BOT_TOKEN=${BOT_TOKEN}
ADMIN_IDS=${ADMIN_IDS}
SUPPORT=${SUPPORT}
REQUIRED_CHANNEL_ID=${REQUIRED_CHANNEL_ID}
REQUIRED_CHANNEL_INVITE=${REQUIRED_CHANNEL_INVITE}
PANEL_URL=${PANEL_URL}
PANEL_PATH=${PANEL_PATH}
PANEL_API_TOKEN=${PANEL_API_TOKEN}
INBOUND_ID=${INBOUND_ID}
INBOUNDS=${INBOUNDS}
SUB_BASE_URL=${SUB_BASE_URL}
PROXY_HOST=${PROXY_HOST}
PROXY_PORT=${PROXY_PORT}
CARDS=${CARDS}
LOG_CHANNEL_ID=${LOG_CHANNEL_ID}
REMINDER_ENABLED=y
REMINDER_GB_THRESHOLD=3
REMINDER_DAYS_THRESHOLD=3
WEB_PANEL_ENABLED=y
WEB_PANEL_HOST=0.0.0.0
WEB_PANEL_PORT=${WEB_PANEL_PORT}
WEB_PANEL_PASS=${WEB_PANEL_PASS}
DB_PATH=vpn_bot.db
ENVEOF
    ok "Created $BOT_DIR/.env"
else
    set -a
    source "$BOT_DIR/.env"
    set +a
    WEB_PANEL_PORT="${WEB_PANEL_PORT:-8080}"
    WEB_PANEL_PASS="${WEB_PANEL_PASS:-admin1234}"
fi

info "Installing system dependencies..."
if command -v apt-get &> /dev/null; then
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -qq
    apt-get install -y -qq python3 python3-pip python3-venv sqlite3 curl nano
elif command -v dnf &> /dev/null; then
    dnf install -y -q python3 python3-pip python3-virtualenv sqlite curl nano
elif command -v yum &> /dev/null; then
    yum install -y -q python3 python3-pip sqlite curl nano
fi

cd "$BOT_DIR"
[ ! -d ".venv" ] && python3 -m venv .venv
.venv/bin/python3 -m pip install --upgrade pip -q
.venv/bin/python3 -m pip install -r requirements.txt -q

info "Configuring systemd service (vpnbot.service)..."
cp "$BOT_DIR/scripts/vpnbot.service" /etc/systemd/system/vpnbot.service
sed -i "s|{{BOT_DIR}}|$BOT_DIR|g" /etc/systemd/system/vpnbot.service
systemctl daemon-reload
systemctl enable vpnbot -q

info "Installing vpn-bot CLI command..."
cp "$BOT_DIR/scripts/vpn-bot.sh" /usr/local/bin/vpn-bot
sed -i "s|{{BOT_DIR}}|$BOT_DIR|g" /usr/local/bin/vpn-bot
chmod +x /usr/local/bin/vpn-bot

if command -v ufw &> /dev/null && ufw status 2>/dev/null | grep -qi "Status: active"; then
    ufw allow "${WEB_PANEL_PORT}/tcp" >/dev/null 2>&1 || true
fi

systemctl restart vpnbot
sleep 2

SERVER_IP=$(curl -s4 --max-time 4 https://api.ipify.org 2>/dev/null || curl -s4 --max-time 4 https://ifconfig.me 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}' || echo "YOUR_SERVER_IP")
[ -z "$SERVER_IP" ] && SERVER_IP="YOUR_SERVER_IP"

echo ""
echo "======================================================"
ok "Installation complete!"
echo "  CLI Control : vpn-bot"
echo "  Systemd     : systemctl status vpnbot"
echo "  Web Panel   : http://${SERVER_IP}:${WEB_PANEL_PORT}"
echo "  Web Password: ${WEB_PANEL_PASS}"
echo "======================================================"
