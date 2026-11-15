from __future__ import annotations

import json
import logging
from aiogram import F, Router
from aiogram.fsm.context import FSMContext
from aiogram.types import BufferedInputFile, CallbackQuery, InlineKeyboardButton, Message, PhotoSize
from aiogram.utils.keyboard import InlineKeyboardBuilder

import database as db
from config import cfg
from keyboards import (
    admin_payment_kb,
    back_kb,
    confirm_chlink_kb,
    confirm_renew_kb,
    main_menu,
    paid_kb,
    service_kb,
)
from services.panel import panel
from utils.log_channel import log_change_link, log_renew
from utils.pricing import calc_price, price_breakdown
from utils.qr import make_qr
from utils.states import RenewSt

router = Router()
logger = logging.getLogger(__name__)


async def _send_services_list(target_msg: Message, tg_id: int) -> None:
    orders = await db.get_user_orders(tg_id)
    if not orders:
        await target_msg.answer(
            "📭 شما هنوز سرویسی خریداری نکرده‌اید.\nبرای خرید روی «🛒 خرید سرویس» بزنید.",
            reply_markup=main_menu(),
        )
        return
    b = InlineKeyboardBuilder()
    for row in orders:
        email = row["client_email"]
        b.row(InlineKeyboardButton(text=f"🔑 {email}", callback_data=f"view:{email}"))
    b.row(InlineKeyboardButton(text="🔙 بازگشت", callback_data="back_main"))
    await target_msg.answer("📋 <b>سرویس‌های شما:</b>", reply_markup=b.as_markup(), parse_mode="HTML")


@router.message(F.text == "📋 سرویس های من")
async def my_services_msg(message: Message, state: FSMContext) -> None:
    await state.clear()
    await _send_services_list(message, message.from_user.id)


@router.callback_query(F.data == "my_services")
async def my_services_cb(cb: CallbackQuery, state: FSMContext) -> None:
    await state.clear()
    await _send_services_list(cb.message, cb.from_user.id)
    await cb.answer()


@router.callback_query(F.data.startswith("view:"))
async def view_service(cb: CallbackQuery) -> None:
    email = cb.data.split(":", 1)[1]
    try:
        c = await panel.get_client(email)
        if not c:
            await cb.answer("❌ سرویس در پنل یافت نشد.", show_alert=True)
            return
        total_gb = panel.bytes_to_gb(c["totalGB"])
        used_gb = panel.bytes_to_gb(c["usedTraffic"])
        rem_gb = max(0.0, round(total_gb - used_gb, 2))
        days_left = panel.remaining_days(c["expiryTime"])
        exp_date = panel.expire_date(c["expiryTime"])
        status_text = "✅ فعال" if c["enable"] else "⛔️ غیرفعال"
        url = panel.sub_url(c["subId"])
        qr = make_qr(url)
        await cb.message.answer(
            f"🔑 <b>جزئیات سرویس</b>\n\n"
            f"📝 نام: <code>{email}</code>\n"
            f"📊 وضعیت: {status_text}\n"
            f"📦 حجم کل: {total_gb} GB\n"
            f"📈 مصرف‌شده: {used_gb} GB\n"
            f"💾 باقی‌مانده: <b>{rem_gb} GB</b>\n"
            f"⏳ زمان باقی‌مانده: {days_left} روز ({exp_date})\n\n"
            f"🔗 لینک اشتراک:\n<code>{url}</code>",
            reply_markup=service_kb(email),
            parse_mode="HTML",
        )
        await cb.message.answer_photo(
            BufferedInputFile(qr, filename="qr.png"),
            caption=f"📱 QR Code سرویس {email}",
        )
    except Exception as e:
        logger.exception("View service error: %s", e)
        await cb.message.answer("❌ خطا در دریافت اطلاعات از پنل.", reply_markup=main_menu())
    await cb.answer()


@router.callback_query(F.data.startswith("chlink:"))
async def chlink_prompt(cb: CallbackQuery) -> None:
    email = cb.data.split(":", 1)[1]
    await cb.message.answer(
        f"⚠️ آیا مطمئن هستید که می‌خواهید لینک سرویس <code>{email}</code> را تغییر دهید?\n"
        f"لینک قبلی بلافاصله از کار می‌افتد.",
        reply_markup=confirm_chlink_kb(email),
        parse_mode="HTML",
    )
    await cb.answer()


@router.callback_query(F.data.startswith("chlink_ok:"))
async def chlink_confirm(cb: CallbackQuery) -> None:
    email = cb.data.split(":", 1)[1]
    try:
        new_sub = await panel.change_link(email)
        url = panel.sub_url(new_sub)
        qr = make_qr(url)
        await cb.message.answer(
            f"✅ لینک با موفقیت تغییر کرد!\n\n🔗 لینک جدید:\n<code>{url}</code>",
            parse_mode="HTML",
            reply_markup=main_menu(),
        )
        await cb.message.answer_photo(BufferedInputFile(qr, filename="qr.png"), caption="📱 QR Code لینک جدید")
        u = cb.from_user
        await log_change_link(cb.bot, u.id, u.username or "", email, url)
    except Exception as e:
        logger.exception("Change link error: %s", e)
        await cb.message.answer("❌ خطا در تغییر لینک.", reply_markup=main_menu())
    await cb.answer()


@router.callback_query(F.data.startswith("renew:"))
async def renew_start(cb: CallbackQuery, state: FSMContext) -> None:
    email = cb.data.split(":", 1)[1]
    await state.clear()
    await state.set_state(RenewSt.gb)
    await state.update_data(email=email)
    await cb.message.answer(
        f"🔁 تمدید سرویس: <code>{email}</code>\n\nچند گیگابایت اضافه کنید؟",
        reply_markup=back_kb(),
        parse_mode="HTML",
    )
    await cb.answer()


@router.message(RenewSt.gb)
async def renew_gb(message: Message, state: FSMContext) -> None:
    raw = (message.text or "").strip()
    if not raw.isdigit() or int(raw) <= 0:
        await message.answer("❌ فقط عدد صحیح مثبت وارد کنید.", reply_markup=back_kb())
        return
    gb = int(raw)
    total = await calc_price(gb)
    data = await state.get_data()
    await state.update_data(gb=gb, total=total)
    await state.set_state(RenewSt.confirm)
    breakdown = await price_breakdown(gb)
    await message.answer(
        f"🔁 <b>جزئیات تمدید</b>\n\n📧 سرویس: <code>{data['email']}</code>\n{breakdown}\n\nتایید؟",
        reply_markup=confirm_renew_kb(),
        parse_mode="HTML",
    )


@router.callback_query(F.data == "renew_confirm", RenewSt.confirm)
async def renew_confirm(cb: CallbackQuery, state: FSMContext) -> None:
    data = await state.get_data()
    gb, total, email = data["gb"], data["total"], data["email"]
    tg_id = cb.from_user.id
    balance = await db.get_balance(tg_id)
    if balance >= total:
        await db.add_balance(tg_id, -total, f"تمدید {gb}GB {email}")
        await state.clear()
        await cb.message.answer("⏳ در حال تمدید...")
        await cb.answer()
        try:
            await panel.renew_client(email, gb)
            await db.create_order(tg_id, email, gb, total, "renew")
            await db.clear_reminder(tg_id, email)
            await cb.bot.send_message(
                tg_id,
                f"✅ تمدید شد!\n📦 {gb}GB اضافه شد\n📅 ۳۰ روز اضافه شد",
                reply_markup=main_menu(),
            )
            u = cb.from_user
            await log_renew(cb.bot, tg_id, u.username or "", email, gb, total)
        except Exception as e:
            logger.exception("Renew error: %s", e)
            await db.add_balance(tg_id, total, "بازگشت وجه - خطا در تمدید")
            await cb.bot.send_message(tg_id, f"❌ خطا: {e}", reply_markup=main_menu())
    else:
        shortfall = total - balance
        await state.update_data(shortfall=shortfall)
        await state.set_state(RenewSt.receipt)
        await cb.message.answer(
            f"💳 موجودی کافی نیست!\nکمبود: <b>{shortfall:,} تومان</b>\n\n"
            f"به یکی از کارت‌های زیر واریز کنید:\n\n{cfg.cards_text()}",
            reply_markup=paid_kb(),
            parse_mode="HTML",
        )
        await cb.answer()


@router.callback_query(F.data == "paid", RenewSt.receipt)
async def renew_paid(cb: CallbackQuery) -> None:
    await cb.message.answer("📷 تصویر رسید را ارسال کنید:", reply_markup=back_kb())
    await cb.answer()


@router.message(RenewSt.receipt)
async def renew_receipt(message: Message, state: FSMContext) -> None:
    if not message.photo:
        await message.answer("❌ فقط تصویر رسید قابل قبول است.", reply_markup=back_kb())
        return
    data = await state.get_data()
    gb, total, email = data["gb"], data["total"], data["email"]
    shortfall = data.get("shortfall", total)
    photo: PhotoSize = message.photo[-1]
    tg_id = message.from_user.id
    pid = await db.create_pending_payment(
        tg_id,
        shortfall,
        photo.file_id,
        "renew",
        json.dumps({"gb": gb, "total": total, "client_email": email}),
    )
    await state.clear()
    u = message.from_user
    caption = (
        f"📥 <b>رسید تمدید</b>\n\n👤 {u.full_name} | 🆔 <code>{u.id}</code>\n"
        f"💰 {shortfall:,} تومان | 📦 {gb}GB | 📧 {email} | 🔖 {pid}"
    )
    for admin_id in cfg.admin_ids:
        try:
            await message.bot.send_photo(
                admin_id,
                photo.file_id,
                caption=caption,
                reply_markup=admin_payment_kb(pid),
                parse_mode="HTML",
            )
        except Exception as e:
            logger.error("Notify admin %s: %s", admin_id, e)
    await message.answer("✅ رسید ارسال شد.", reply_markup=main_menu())
