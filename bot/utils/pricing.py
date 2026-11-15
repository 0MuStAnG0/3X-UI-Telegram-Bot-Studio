from __future__ import annotations

from typing import Dict, Optional
import database as db
from config import cfg


async def get_prices(db_path: Optional[str] = None) -> Dict[str, int]:
    return {
        "low": int(await db.get_setting("price_low", str(cfg.price_low), db_path=db_path)),
        "mid": int(await db.get_setting("price_mid", str(cfg.price_mid), db_path=db_path)),
        "high": int(await db.get_setting("price_high", str(cfg.price_high), db_path=db_path)),
        "tier1_max": int(await db.get_setting("price_tier1_max", str(cfg.price_tier1_max), db_path=db_path)),
        "tier2_max": int(await db.get_setting("price_tier2_max", str(cfg.price_tier2_max), db_path=db_path)),
    }


def compute_tier_price(gb: int, prices: Dict[str, int]) -> int:
    if gb < prices["tier1_max"]:
        per_gb = prices["low"]
    elif gb <= prices["tier2_max"]:
        per_gb = prices["mid"]
    else:
        per_gb = prices["high"]
    return gb * per_gb


async def calc_price(gb: int, db_path: Optional[str] = None) -> int:
    p = await get_prices(db_path=db_path)
    return compute_tier_price(gb, p)


async def price_breakdown(gb: int, db_path: Optional[str] = None) -> str:
    p = await get_prices(db_path=db_path)
    if gb < p["tier1_max"]:
        per_gb = p["low"]
    elif gb <= p["tier2_max"]:
        per_gb = p["mid"]
    else:
        per_gb = p["high"]
    total = gb * per_gb
    return (
        f"📦 حجم: <b>{gb} گیگابایت</b>\n"
        f"💰 قیمت هر گیگ: {per_gb:,} تومان\n"
        f"🧾 مبلغ کل: <b>{total:,} تومان</b>\n"
        f"📅 مدت: ۳۰ روز"
    )
