from __future__ import annotations

import os
from dataclasses import dataclass, field
from typing import List, Tuple
from dotenv import load_dotenv

load_dotenv()


def _int_list(raw: str) -> List[int]:
    return [int(x.strip()) for x in raw.split(",") if x.strip().lstrip("-").isdigit()]


def _parse_inbounds(raw: str, fallback_id: str = "") -> List[Tuple[str, str, str]]:
    """
    Parse INBOUNDS env format: "ID:REMARK:FLOW,ID:REMARK:FLOW,..."
    FLOW may be empty for non-Reality inbounds.
    """
    inbounds: List[Tuple[str, str, str]] = []
    if raw:
        for entry in raw.split(","):
            entry = entry.strip()
            if not entry:
                continue
            parts = entry.split(":")
            ib_id = parts[0].strip()
            remark = parts[1].strip() if len(parts) > 1 and parts[1].strip() else f"inbound-{ib_id}"
            flow = parts[2].strip() if len(parts) > 2 else ""
            if ib_id:
                inbounds.append((ib_id, remark, flow))
    if not inbounds and fallback_id:
        inbounds = [(fallback_id.strip(), "default", "xtls-rprx-vision")]
    return inbounds


def _parse_cards(raw: str) -> List[Tuple[str, str]]:
    """
    Parse CARDS env format: "NUMBER:NAME,NUMBER:NAME,..."
    """
    cards: List[Tuple[str, str]] = []
    if not raw:
        return cards
    for entry in raw.split(","):
        entry = entry.strip()
        if not entry:
            continue
        if ":" in entry:
            number, name = entry.split(":", 1)
        else:
            number, name = entry, ""
        cards.append((number.strip(), name.strip()))
    return cards


def _parse_bool(raw: str, default: bool = True) -> bool:
    val = raw.strip().lower()
    if not val:
        return default
    return val in ("y", "yes", "1", "true", "on")


@dataclass
class Config:
    bot_token: str = field(default_factory=lambda: os.environ.get("BOT_TOKEN", ""))
    support: str = field(default_factory=lambda: os.environ.get("SUPPORT", "@support"))
    admin_ids: List[int] = field(default_factory=lambda: _int_list(os.getenv("ADMIN_IDS", "")))
    required_channel_id: int = field(default_factory=lambda: int(os.getenv("REQUIRED_CHANNEL_ID", "0") or "0"))
    required_channel_invite: str = field(default_factory=lambda: os.getenv("REQUIRED_CHANNEL_INVITE", ""))

    panel_url: str = field(default_factory=lambda: os.environ.get("PANEL_URL", "").rstrip("/"))
    panel_path: str = field(default_factory=lambda: os.getenv("PANEL_PATH", "").rstrip("/"))
    panel_api_token: str = field(default_factory=lambda: os.environ.get("PANEL_API_TOKEN", ""))
    inbound_id: int = field(default_factory=lambda: int(os.getenv("INBOUND_ID", "1") or "1"))
    inbounds: List[Tuple[str, str, str]] = field(
        default_factory=lambda: _parse_inbounds(os.getenv("INBOUNDS", ""), os.getenv("INBOUND_ID", "1"))
    )
    sub_base_url: str = field(default_factory=lambda: os.getenv("SUB_BASE_URL", "").rstrip("/"))

    proxy_host: str = field(default_factory=lambda: os.getenv("PROXY_HOST", "").strip())
    proxy_port: str = field(default_factory=lambda: os.getenv("PROXY_PORT", "").strip())
    proxy_user: str = field(default_factory=lambda: os.getenv("PROXY_USER", "").strip())
    proxy_pass: str = field(default_factory=lambda: os.getenv("PROXY_PASS", "").strip())

    cards: List[Tuple[str, str]] = field(default_factory=lambda: _parse_cards(os.getenv("CARDS", "")))
    card_number: str = field(default_factory=lambda: os.getenv("CARD_NUMBER", ""))
    log_channel_id: int = field(default_factory=lambda: int(os.getenv("LOG_CHANNEL_ID", "0") or "0"))

    reminder_enabled: bool = field(default_factory=lambda: _parse_bool(os.getenv("REMINDER_ENABLED", "y"), True))
    reminder_gb_threshold: float = field(default_factory=lambda: float(os.getenv("REMINDER_GB_THRESHOLD", "3") or "3"))
    reminder_days_threshold: int = field(default_factory=lambda: int(os.getenv("REMINDER_DAYS_THRESHOLD", "3") or "3"))

    web_panel_enabled: bool = field(default_factory=lambda: _parse_bool(os.getenv("WEB_PANEL_ENABLED", "y"), True))
    web_panel_host: str = field(default_factory=lambda: os.getenv("WEB_PANEL_HOST", "0.0.0.0").strip() or "0.0.0.0")
    web_panel_port: int = field(default_factory=lambda: int(os.getenv("WEB_PANEL_PORT", "8080") or "8080"))
    web_panel_pass: str = field(default_factory=lambda: os.getenv("WEB_PANEL_PASS", "admin1234").strip())

    db_path: str = field(default_factory=lambda: os.getenv("DB_PATH", "vpn_bot.db"))

    price_low: int = 8000
    price_mid: int = 7500
    price_high: int = 7000
    price_tier1_max: int = 20
    price_tier2_max: int = 60
    trial_gb: float = 0.5
    trial_days: int = 1
    referral_percent: int = 5

    @property
    def proxy_enabled(self) -> bool:
        return bool(self.proxy_host and self.proxy_port.isdigit())

    @property
    def socks5_url(self) -> str:
        if not self.proxy_enabled:
            return ""
        if self.proxy_user and self.proxy_pass:
            return f"socks5://{self.proxy_user}:{self.proxy_pass}@{self.proxy_host}:{self.proxy_port}"
        return f"socks5://{self.proxy_host}:{self.proxy_port}"

    def cards_text(self) -> str:
        if self.cards:
            lines = []
            for number, name in self.cards:
                if name:
                    lines.append(f"<code>{number}</code>\nبه نام: {name}")
                else:
                    lines.append(f"<code>{number}</code>")
            return "\n\n".join(lines)
        return f"<code>{self.card_number or 'XXXX-XXXX-XXXX-XXXX'}</code>"


cfg = Config()
