from __future__ import annotations

import asyncio
import logging
import aiosqlite
from aiogram import Router
from aiogram.filters import Command, Filter
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.types import Message

import database as db
from config import cfg
from utils.pricing import get_prices

router = Router()
logger = logging.getLogger(__name__)


class IsAdminMsg(Filter):
    async def __call__(self, message: Message) -> bool:
        return bool(message.from_user and message.from_user.id in cfg.admin_ids)


router.message.filter(IsAdminMsg())


class BroadcastSt(StatesGroup):
    waiting_text = State()


@router.message(Command("broadcast"))
async def broadcast_start(message: Message, state: FSMContext) -> None:
    await state.set_state(BroadcastSt.waiting_text)
    await message.answer("📢 متن پیام همگانی را ارسال کنید (یا /cancel بزنید):")


@router.message(BroadcastSt.waiting_text)
async def broadcast_send(message: Message, state: FSMContext) -> None:
    if message.text and message.text.strip() == "/cancel":
        await state.clear()
        await message.answer("❌ ارسال همگانی لغو شد.")
        return
    await state.clear()
    user_ids = await db.get_all_user_ids()
    sent = 0
    failed = 0
    status = await message.answer(f"⏳ در حال ارسال به {len(user_ids)} کاربر...")
    for uid in user_ids:
        try:
            await message.bot.send_message(uid, message.text or "")
            sent += 1
        except Exception:
            failed += 1
        await asyncio.sleep(0.05)
    async with aiosqlite.connect(cfg.db_path) as dbconn:
        await dbconn.execute("INSERT INTO broadcast_log(message, sent_count) VALUES(?,?)", (message.text or "", sent))
        await dbconn.commit()
    await status.edit_text(f"✅ ارسال تمام شد\n📤 موفق: {sent}\n❌ ناموفق: {failed}")


@router.message(Command("addcode"))
async def add_code(message: Message) -> None:
    parts = (message.text or "").split()
    if len(parts) != 4:
        await message.answer("استفاده:\n/addcode CODE PERCENT MAX_USES\nمثال: /addcode SALE20 20 100")
        return
    _, code, percent, max_uses = parts
    if not percent.isdigit() or not max_uses.isdigit():
        await message.answer("❌ درصد و تعداد باید عدد باشند.")
        return
    await db.create_discount_code(code, int(percent), int(max_uses))
    await message.answer(f"✅ کد <code>{code.upper()}</code> با {percent}% تخفیف ساخته شد.", parse_mode="HTML")


@router.message(Command("delcode"))
async def del_code(message: Message) -> None:
    parts = (message.text or "").split()
    if len(parts) != 2:
        await message.answer("استفاده: /delcode CODE")
        return
    await db.delete_discount_code(parts[1])
    await message.answer(f"✅ کد <code>{parts[1].upper()}</code> حذف شد.", parse_mode="HTML")


@router.message(Command("codes"))
async def list_codes(message: Message) -> None:
    codes = await db.list_discount_codes()
    if not codes:
        await message.answer("هیچ کد تخفیفی وجود ندارد.")
        return
    text = "📋 <b>کدهای تخفیف:</b>\n\n"
    for c in codes:
        text += f"🏷 <code>{c['code']}</code> — {c['percent']}% — {c['used_count']}/{c['max_uses']}\n"
    await message.answer(text, parse_mode="HTML")


@router.message(Command("referral"))
async def toggle_referral(message: Message) -> None:
    current = await db.get_setting("referral_enabled", "1")
    new_val = "0" if current == "1" else "1"
    await db.set_setting("referral_enabled", new_val)
    status = "✅ فعال" if new_val == "1" else "❌ غیرفعال"
    await message.answer(f"🔗 سیستم دعوت: <b>{status}</b>", parse_mode="HTML")


@router.message(Command("trial"))
async def toggle_trial(message: Message) -> None:
    current = await db.get_setting("trial_enabled", "1")
    new_val = "0" if current == "1" else "1"
    await db.set_setting("trial_enabled", new_val)
    status = "✅ فعال" if new_val == "1" else "❌ غیرفعال"
    await message.answer(f"🎁 تست رایگان: <b>{status}</b>", parse_mode="HTML")


@router.message(Command("setprice"))
async def set_price(message: Message) -> None:
    parts = (message.text or "").split()
    if len(parts) != 3:
        p = await get_prices()
        await message.answer(
            f"📊 <b>قیمت‌های فعلی:</b>\n\n"
            f"کمتر از {p['tier1_max']} گیگ: {p['low']:,} تومان/گیگ\n"
            f"بین {p['tier1_max']} تا {p['tier2_max']} گیگ: {p['mid']:,} تومان/گیگ\n"
            f"بیشتر از {p['tier2_max']} گیگ: {p['high']:,} تومان/گیگ\n\n"
            f"برای تغییر:\n"
            f"/setprice low 8000\n"
            f"/setprice mid 7500\n"
            f"/setprice high 7000\n"
            f"/setprice tier1 20\n"
            f"/setprice tier2 60",
            parse_mode="HTML",
        )
        return
    _, key, val = parts
    if not val.isdigit():
        await message.answer("❌ مقدار باید عدد باشد.")
        return
    key_map = {
        "low": "price_low",
        "mid": "price_mid",
        "high": "price_high",
        "tier1": "price_tier1_max",
        "tier2": "price_tier2_max",
    }
    if key not in key_map:
        await message.answer("❌ کلید نامعتبر. از: low, mid, high, tier1, tier2 استفاده کنید.")
        return
    await db.set_setting(key_map[key], val)
    await message.answer(f"✅ مقدار <b>{key}</b> به <b>{int(val):,}</b> تغییر کرد.", parse_mode="HTML")


@router.message(Command("stats"))
async def admin_stats(message: Message) -> None:
    async with aiosqlite.connect(cfg.db_path) as dbconn:
        async with dbconn.execute("SELECT COUNT(*) FROM users") as cur:
            total_users = (await cur.fetchone())[0]
        async with dbconn.execute("SELECT COUNT(*) FROM users WHERE joined_at >= date('now')") as cur:
            new_users_today = (await cur.fetchone())[0]
        async with dbconn.execute("SELECT COUNT(*) FROM orders") as cur:
            total_orders = (await cur.fetchone())[0]
        async with dbconn.execute("SELECT COUNT(*) FROM orders WHERE order_type='new'") as cur:
            new_orders = (await cur.fetchone())[0]
        async with dbconn.execute("SELECT COUNT(*) FROM orders WHERE order_type='renew'") as cur:
            renew_orders = (await cur.fetchone())[0]
        async with dbconn.execute("SELECT COALESCE(SUM(amount_paid),0) FROM orders") as cur:
            total_revenue = (await cur.fetchone())[0]
        async with dbconn.execute("SELECT COALESCE(SUM(amount_paid),0) FROM orders WHERE created_at >= date('now')") as cur:
            today_revenue = (await cur.fetchone())[0]
        async with dbconn.execute("SELECT COUNT(*) FROM orders WHERE created_at >= date('now')") as cur:
            today_orders = (await cur.fetchone())[0]
        async with dbconn.execute("SELECT COUNT(*) FROM free_trials") as cur:
            trials = (await cur.fetchone())[0]
        async with dbconn.execute("SELECT COUNT(*) FROM pending_payments WHERE status='pending'") as cur:
            pending = (await cur.fetchone())[0]
        async with dbconn.execute("SELECT COALESCE(SUM(balance),0) FROM wallets") as cur:
            total_wallet = (await cur.fetchone())[0]
        async with dbconn.execute("SELECT COUNT(*) FROM referrals") as cur:
            referrals = (await cur.fetchone())[0]

    referral_status = "✅" if await db.get_setting("referral_enabled", "1") == "1" else "❌"
    trial_status = "✅" if await db.get_setting("trial_enabled", "1") == "1" else "❌"
    p = await get_prices()

    await message.answer(
        f"📊 <b>آمار کامل ربات</b>\n\n"
        f"👥 <b>کاربران:</b>\n"
        f"   کل: {total_users} نفر | امروز: {new_users_today} نفر\n\n"
        f"🛒 <b>سفارشات:</b>\n"
        f"   کل: {total_orders} (جدید: {new_orders} | تمدید: {renew_orders} | امروز: {today_orders})\n\n"
        f"💰 <b>مالی:</b>\n"
        f"   درآمد کل: {total_revenue:,} تومان\n"
        f"   درآمد امروز: {today_revenue:,} تومان\n"
        f"   موجودی کل کیف پول‌ها: {total_wallet:,} تومان\n\n"
        f"📋 <b>سایر:</b>\n"
        f"   تست رایگان: {trials} | پرداخت معلق: {pending} | دعوت‌ها: {referrals}\n\n"
        f"⚙️ <b>سیستم‌ها:</b> دعوت {referral_status} | تست {trial_status}\n\n"
        f"💎 <b>قیمت‌ها:</b> زیر {p['tier1_max']}G: {p['low']:,} | {p['tier1_max']}-{p['tier2_max']}G: {p['mid']:,} | بالای {p['tier2_max']}G: {p['high']:,}",
        parse_mode="HTML",
    )
