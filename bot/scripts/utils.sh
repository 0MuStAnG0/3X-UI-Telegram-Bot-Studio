#!/bin/bash

C_GREEN='\033[0;32m'
C_YELLOW='\033[1;33m'
C_RED='\033[0;31m'
C_CYAN='\033[0;36m'
C_NC='\033[0m'

info() { echo -e "${C_CYAN}[*]${C_NC} $1"; }
ok()   { echo -e "${C_GREEN}[OK]${C_NC} $1"; }
warn() { echo -e "${C_YELLOW}[!]${C_NC} $1"; }
err()  { echo -e "${C_RED}[X]${C_NC} $1"; }

tty_read() {
    local prompt="$1" __var="$2" tmp=""
    if [ -r /dev/tty ]; then
        read -rp "$prompt" tmp < /dev/tty
    else
        read -rp "$prompt" tmp
    fi
    printf -v "$__var" '%s' "$tmp"
}

ask_required() {
    local prompt="$1" __resultvar="$2" value=""
    while [ -z "$value" ]; do
        tty_read "$prompt: " value
        value="$(echo -n "$value" | xargs)"
        [ -z "$value" ] && warn "This field is required and cannot be empty."
    done
    printf -v "$__resultvar" '%s' "$value"
}

ask_optional() {
    local prompt="$1" default="$2" __resultvar="$3" value=""
    tty_read "$prompt [$default]: " value
    value="$(echo -n "$value" | xargs)"
    [ -z "$value" ] && value="$default"
    printf -v "$__resultvar" '%s' "$value"
}

ask_yesno() {
    local prompt="$1" __resultvar="$2" value=""
    while [[ "$value" != "y" && "$value" != "n" ]]; do
        tty_read "$prompt (y/n): " value
        value="$(echo -n "$value" | xargs | tr '[:upper:]' '[:lower:]')"
        [[ "$value" != "y" && "$value" != "n" ]] && warn "Please enter y or n only."
    done
    printf -v "$__resultvar" '%s' "$value"
}

ask_number() {
    local prompt="$1" __resultvar="$2" value=""
    while [[ ! "$value" =~ ^[0-9]+$ ]]; do
        tty_read "$prompt: " value
        value="$(echo -n "$value" | xargs)"
        [[ ! "$value" =~ ^[0-9]+$ ]] && warn "Please enter a whole number."
    done
    printf -v "$__resultvar" '%s' "$value"
}
