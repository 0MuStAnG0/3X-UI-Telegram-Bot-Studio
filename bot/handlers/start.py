from __future__ import annotations

import logging
from aiogram import F, Router
from aiogram.filters import CommandStart
from aiogram.fsm.context import FSMContext
from aiogram.types import CallbackQuery, InlineKeyboardButton, Message
from aiogram.utils.keyboard import InlineKeyboardBuilder

import database as db
from config import cfg
from keyboards import main_menu, tutorial_os_kb
from utils.log_channel import log_new_user

router = Router()
logger = logging.getLogger(__name__)

TUTORIALS = {
    "android": {
        "title": "🤖 آموزش اتصال - اندروید",
        "apps": [
            ("V2rayNG", "https://play.google.com/store/apps/details?id=com.v2ray.ang"),
            ("Hiddify", "https://play.google.com/store/apps/details?id=app.hiddify.com"),
        ],
        "steps": (
            "1️⃣ اپلیکیشن <b>V2rayNG</b> یا <b>Hiddify</b> را نصب کنید\n\n"
            "2️⃣ لینک اشتراک خود را از بخش «📋 سرویس های من» کپی کنید\n\n"
            "3️⃣ در V2rayNG:\n"
            "   • روی آیکون <b>+</b> بزنید\n"
            "   • گزینه <b>Import config from clipboard</b> را انتخاب کنید\n\n"
            "   در Hiddify:\n"
            "   • روی <b>+</b> بزنید و لینک را Paste کنید\n\n"
            "4️⃣ روی دکمه اتصال بزنید ✅"
        ),
    },
    "ios": {
        "title": "🍎 آموزش اتصال - iOS",
        "apps": [
            ("Streisand", "https://apps.apple.com/us/app/streisand/id6450534064"),
            ("Hiddify", "https://apps.apple.com/us/app/hiddify-proxy-vpn/id6596777532"),
            ("V2Box", "https://apps.apple.com/us/app/v2box-v2ray-client/id6446814690"),
        ],
        "steps": (
            "1️⃣ اپلیکیشن <b>Streisand</b> یا <b>Hiddify</b> را از App Store نصب کنید\n\n"
            "2️⃣ لینک اشتراک خود را از بخش «📋 سرویس های من» کپی کنید\n\n"
            "3️⃣ در Streisand:\n"
            "   • روی <b>+</b> بزنید و <b>Import from clipboard</b> را انتخاب کنید\n\n"
            "4️⃣ روی دکمه اتصال بزنید ✅"
        ),
    },
    "windows": {
        "title": "🪟 آموزش اتصال - ویندوز",
        "apps": [
            ("Hiddify", "https://github.com/hiddify/hiddify-app/releases/latest"),
            ("V2rayN", "https://github.com/2dust/v2rayN/releases/latest"),
        ],
        "steps": (
            "1️⃣ اپلیکیشن <b>Hiddify</b> یا <b>V2rayN</b> را دانلود و نصب کنید\n\n"
            "2️⃣ لینک اشتراک خود را از بخش «📋 سرویس های من» کپی کنید\n\n"
            "3️⃣ در Hiddify روی <b>+</b> بزنید و لینک را Paste کنید\n\n"
            "4️⃣ اتصال را فعال کنید ✅"
        ),
    },
    "mac": {
        "title": "🍏 آموزش اتصال - مک",
        "apps": [
            ("Hiddify", "https://github.com/hiddify/hiddify-app/releases/latest"),
            ("V2rayU", "https://github.com/yanue/V2rayU/releases/latest"),
        ],
        "steps": (
            "1️⃣ اپلیکیشن <b>Hiddify</b> یا <b>V2rayU</b> را دانلود و نصب کنید\n\n"
            "2️⃣ لینک اشتراک خود را از بخش «📋 سرویس های من» کپی کنید\n\n"
            "3️⃣ لینک را وارد کرده و اتصال را فعال کنید ✅"
        ),
    },
}


async def _cleanup_discount(state: FSMContext, tg_id: int) -> None:
    data = await state.get_data()
    code = data.get("discount_code")
    if code:
        await db.release_discount_use(code, tg_id)


@router.message(CommandStart())
async def cmd_start(message: Message, state: FSMContext) -> None:
    u = message.from_user
    await _cleanup_discount(state, u.id)
    await state.clear()

    is_new = await db.get_user(u.id) is None
    await db.upsert_user(u.id, u.username, u.full_name)

    args = message.text.split() if message.text else []
    if len(args) > 1 and is_new:
        try:
            inviter_id = int(args[1].replace("ref", ""))
            if inviter_id != u.id:
                await db.add_referral(inviter_id, u.id)
        except Exception:
            pass

    if is_new:
        await log_new_user(message.bot, u.id, u.username or "", u.full_name)

    await message.answer(
        f"سلام <b>{u.first_name}</b> عزیز! 👋\n\n"
        f"به ربات مدیریت و فروش سرویس خوش آمدید.\n"
        f"برای شروع یکی از گزینه‌های زیر را انتخاب کنید:",
        reply_markup=main_menu(),
        parse_mode="HTML",
    )


@router.callback_query(F.data == "check_member")
async def check_member(cb: CallbackQuery) -> None:
    try:
        member = await cb.bot.get_chat_member(cfg.required_channel_id, cb.from_user.id)
        ok = member.status not in ("left", "kicked", "banned")
    except Exception:
        ok = False

    if ok:
        u = cb.from_user
        await db.upsert_user(u.id, u.username, u.full_name)
        try:
            await cb.message.delete()
        except Exception:
            pass
        await cb.message.answer("✅ عضویت تایید شد! خوش آمدید 🎉", reply_markup=main_menu())
    else:
        await cb.answer("⛔️ هنوز عضو نشده‌اید!", show_alert=True)


@router.callback_query(F.data == "back_main")
async def back_main(cb: CallbackQuery, state: FSMContext) -> None:
    await _cleanup_discount(state, cb.from_user.id)
    await state.clear()
    await cb.message.answer("منوی اصلی:", reply_markup=main_menu())
    await cb.answer()


@router.message(F.text == "💬 پشتیبانی")
async def support_handler(message: Message) -> None:
    await message.answer(
        f"💬 <b>پشتیبانی</b>\n\n"
        f"برای دریافت راهنمایی و پیگیری سفارشات به آیدی زیر پیام دهید:\n"
        f"👤 {cfg.support}",
        reply_markup=main_menu(),
        parse_mode="HTML",
    )


@router.message(F.text == "🔗 دعوت دوستان")
async def referral_handler(message: Message) -> None:
    enabled = await db.get_setting("referral_enabled", "1")
    if enabled != "1":
        await message.answer("❌ سیستم دعوت از دوستان در حال حاضر غیرفعال است.", reply_markup=main_menu())
        return
    me = await message.bot.get_me()
    link = f"https://t.me/{me.username}?start=ref{message.from_user.id}"
    count = await db.get_referral_count(message.from_user.id)
    await message.answer(
        f"🔗 <b>لینک دعوت اختصاصی شما</b>\n\n"
        f"<code>{link}</code>\n\n"
        f"👥 تعداد دعوت‌شدگان: <b>{count} نفر</b>\n\n"
        f"💡 به ازای اولین شارژ کیف پول هر دعوت‌شده، <b>{cfg.referral_percent}٪</b> از مبلغ به کیف پول شما هدیه اضافه می‌شود!",
        parse_mode="HTML",
        reply_markup=main_menu(),
    )


@router.message(F.text == "📚 آموزش اتصال")
async def tutorial_start(message: Message) -> None:
    await message.answer(
        "📚 <b>آموزش اتصال به VPN</b>\n\nسیستم عامل خود را انتخاب کنید:",
        reply_markup=tutorial_os_kb(),
        parse_mode="HTML",
    )


@router.callback_query(F.data.startswith("tutorial:"))
async def tutorial_os(cb: CallbackQuery) -> None:
    os_key = cb.data.split(":")[1]
    t = TUTORIALS.get(os_key)
    if not t:
        await cb.answer()
        return
    b = InlineKeyboardBuilder()
    for app_name, app_url in t["apps"]:
        b.row(InlineKeyboardButton(text=f"⬇️ دانلود {app_name}", url=app_url))
    b.row(InlineKeyboardButton(text="🔙 بازگشت", callback_data="tutorial_back"))
    await cb.message.answer(
        f"{t['title']}\n\n"
        f"📱 <b>اپلیکیشن‌های پیشنهادی:</b>\n"
        + "\n".join(f"• {a[0]}" for a in t["apps"])
        + f"\n\n<b>مراحل اتصال:</b>\n\n{t['steps']}",
        reply_markup=b.as_markup(),
        parse_mode="HTML",
    )
    await cb.answer()


@router.callback_query(F.data == "tutorial_back")
async def tutorial_back(cb: CallbackQuery) -> None:
    await cb.message.answer(
        "📚 <b>آموزش اتصال به VPN</b>\n\nسیستم عامل خود را انتخاب کنید:",
        reply_markup=tutorial_os_kb(),
        parse_mode="HTML",
    )
    await cb.answer()
