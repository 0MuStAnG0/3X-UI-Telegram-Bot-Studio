from __future__ import annotations

import json
import logging
import re
from aiogram import F, Router
from aiogram.fsm.context import FSMContext
from aiogram.types import CallbackQuery, InlineKeyboardButton, Message, PhotoSize
from aiogram.utils.keyboard import InlineKeyboardBuilder

import database as db
from config import cfg
from handlers.admin import _deliver_service
from keyboards import admin_payment_kb, back_kb, inbound_choice_kb, main_menu, paid_kb
from services.panel import panel
from utils.pricing import calc_price, price_breakdown
from utils.states import PurchaseSt

router = Router()
logger = logging.getLogger(__name__)


@router.message(F.text == "🛒 خرید سرویس")
async def buy_start(message: Message, state: FSMContext) -> None:
    await state.clear()
    if len(cfg.inbounds) > 1:
        await state.set_state(PurchaseSt.server)
        await message.answer(
            "🌍 سرور مورد نظر خود را انتخاب کنید:",
            reply_markup=inbound_choice_kb(cfg.inbounds, prefix="pick_inbound"),
        )
        return
    default_ib = cfg.inbounds[0] if cfg.inbounds else (str(cfg.inbound_id), "default", "")
    await state.update_data(inbound_id=int(default_ib[0]), flow=default_ib[2])
    await state.set_state(PurchaseSt.gb)
    await message.answer(
        "📦 چند گیگابایت سرویس می‌خواهید؟\n\n"
        "💡 مدت همه سرویس‌ها <b>۳۰ روز</b> است.\n"
        "فقط عدد صحیح مثبت وارد کنید:",
        reply_markup=back_kb(),
        parse_mode="HTML",
    )


@router.callback_query(F.data.startswith("pick_inbound:"), PurchaseSt.server)
async def buy_pick_inbound(cb: CallbackQuery, state: FSMContext) -> None:
    ib_id = cb.data.split(":", 1)[1]
    match = next((x for x in cfg.inbounds if str(x[0]) == str(ib_id)), None)
    flow = match[2] if match else ""
    await state.update_data(inbound_id=int(ib_id), flow=flow)
    await state.set_state(PurchaseSt.gb)
    await cb.message.answer(
        "📦 چند گیگابایت سرویس می‌خواهید؟\n\n"
        "💡 مدت همه سرویس‌ها <b>۳۰ روز</b> است.\n"
        "فقط عدد صحیح مثبت وارد کنید:",
        reply_markup=back_kb(),
        parse_mode="HTML",
    )
    await cb.answer()


@router.message(PurchaseSt.gb)
async def buy_gb(message: Message, state: FSMContext) -> None:
    raw = (message.text or "").strip()
    if not raw.isdigit() or int(raw) <= 0:
        await message.answer("❌ فقط عدد صحیح مثبت وارد کنید (مثال: 30)", reply_markup=back_kb())
        return
    gb = int(raw)
    total = await calc_price(gb)
    await state.update_data(gb=gb, total=total, discount=0)
    await state.set_state(PurchaseSt.service_name)
    await message.answer(
        "✏️ یک نام برای سرویس خود انتخاب کنید:\n\n"
        "✅ مجاز: حروف انگلیسی کوچک، اعداد و <code>. - _ + @</code>\n"
        "❌ غیرمجاز: حروف بزرگ، فاصله، کاراکتر خاص\n"
        "📏 طول: ۳ تا ۳۰ کاراکتر\n\n"
        "مثال: <code>ali.reza</code> یا <code>user-123</code>",
        reply_markup=back_kb(),
        parse_mode="HTML",
    )


@router.message(PurchaseSt.service_name)
async def buy_service_name(message: Message, state: FSMContext) -> None:
    name = (message.text or "").strip().lower()
    if not re.match(r"^[a-z0-9._%+\-@]{3,30}$", name):
        await message.answer(
            "❌ نام نامعتبر!\n\n"
            "✅ مجاز: حروف انگلیسی کوچک، اعداد و کاراکترهای <code>. - _ + @</code>\n"
            "📏 طول: ۳ تا ۳۰ کاراکتر\n\n"
            "مثال: <code>ali.reza</code> یا <code>user-123</code>",
            reply_markup=back_kb(),
            parse_mode="HTML",
        )
        return
    try:
        existing = await panel.get_client(name)
        if existing:
            await message.answer(
                f"❌ نام <code>{name}</code> قبلاً استفاده شده است.\nلطفاً نام دیگری انتخاب کنید:",
                reply_markup=back_kb(),
                parse_mode="HTML",
            )
            return
    except Exception:
        pass

    data = await state.get_data()
    gb = data["gb"]
    breakdown = await price_breakdown(gb)
    await state.update_data(service_name=name)
    await state.set_state(PurchaseSt.confirm)

    b = InlineKeyboardBuilder()
    b.row(InlineKeyboardButton(text="🏷 دارم کد تخفیف", callback_data="enter_discount"))
    b.row(InlineKeyboardButton(text="✅ تایید و پرداخت", callback_data="buy_confirm"))
    b.row(InlineKeyboardButton(text="❌ انصراف", callback_data="back_main"))

    await message.answer(
        f"🛒 <b>جزئیات سفارش</b>\n\n"
        f"📝 نام سرویس: <code>{name}</code>\n\n"
        f"{breakdown}\n\nکد تخفیف دارید؟",
        reply_markup=b.as_markup(),
        parse_mode="HTML",
    )


@router.callback_query(F.data == "enter_discount", PurchaseSt.confirm)
async def enter_discount_cb(cb: CallbackQuery) -> None:
    await cb.message.answer("🏷 کد تخفیف را وارد کنید:", reply_markup=back_kb())
    await cb.answer()


@router.message(PurchaseSt.confirm)
async def apply_discount(message: Message, state: FSMContext) -> None:
    code = (message.text or "").strip().upper()
    tg_id = message.from_user.id
    disc = await db.get_discount_code(code)
    if not disc:
        await message.answer("❌ کد تخفیف نامعتبر یا تمام شده است.", reply_markup=back_kb())
        return
    ok = await db.use_discount_code(code, tg_id)
    if not ok:
        await message.answer("❌ شما قبلاً از این کد استفاده کرده‌اید.", reply_markup=back_kb())
        return

    data = await state.get_data()
    gb = data["gb"]
    orig_total = await calc_price(gb)
    percent = disc["percent"]
    discounted_total = max(1000, int(orig_total * (100 - percent) / 100))
    await state.update_data(total=discounted_total, discount=percent, discount_code=code)

    b = InlineKeyboardBuilder()
    b.row(InlineKeyboardButton(text="✅ تایید و پرداخت", callback_data="buy_confirm"))
    b.row(InlineKeyboardButton(text="❌ انصراف", callback_data="back_main"))

    await message.answer(
        f"✅ کد تخفیف <b>{code}</b> ({percent}٪) اعمال شد!\n\n"
        f"💰 مبلغ قبلی: <s>{orig_total:,} تومان</s>\n"
        f"💳 مبلغ نهایی: <b>{discounted_total:,} تومان</b>",
        reply_markup=b.as_markup(),
        parse_mode="HTML",
    )


@router.callback_query(F.data == "buy_confirm", PurchaseSt.confirm)
async def buy_confirm(cb: CallbackQuery, state: FSMContext) -> None:
    data = await state.get_data()
    gb = data["gb"]
    total = data["total"]
    service_name = data["service_name"]
    inbound_id = data.get("inbound_id", cfg.inbound_id)
    flow = data.get("flow")
    discount = data.get("discount", 0)
    tg_id = cb.from_user.id
    balance = await db.get_balance(tg_id)

    if balance >= total:
        await db.add_balance(tg_id, -total, f"خرید {gb}GB ({service_name})")
        await state.clear()
        await cb.message.answer("⏳ در حال ساخت سرویس...")
        await cb.answer()
        try:
            await _deliver_service(
                cb.bot,
                tg_id,
                gb,
                total,
                "new",
                service_name,
                inbound_ids=[inbound_id],
                flow=flow,
                discount=discount,
            )
        except Exception as e:
            logger.exception("Deliver service error: %s", e)
            await db.add_balance(tg_id, total, "بازگشت وجه - خطا در ساخت سرویس")
            await cb.bot.send_message(
                tg_id,
                f"❌ خطا در ساخت سرویس: {e}\nمبلغ به کیف پول شما بازگردانده شد.",
                reply_markup=main_menu(),
            )
    else:
        shortfall = total - balance
        await state.update_data(shortfall=shortfall)
        await state.set_state(PurchaseSt.receipt)
        await cb.message.answer(
            f"💳 موجودی کیف پول کافی نیست!\n"
            f"مبلغ کسری: <b>{shortfall:,} تومان</b>\n\n"
            f"لطفاً مبلغ را به یکی از کارت‌های زیر واریز کنید:\n\n{cfg.cards_text()}",
            reply_markup=paid_kb(),
            parse_mode="HTML",
        )
        await cb.answer()


@router.callback_query(F.data == "paid", PurchaseSt.receipt)
async def buy_paid(cb: CallbackQuery) -> None:
    await cb.message.answer("📷 تصویر رسید پرداخت را ارسال کنید:", reply_markup=back_kb())
    await cb.answer()


@router.message(PurchaseSt.receipt)
async def buy_receipt(message: Message, state: FSMContext) -> None:
    if not message.photo:
        await message.answer("❌ فقط تصویر رسید قابل قبول است.", reply_markup=back_kb())
        return
    data = await state.get_data()
    gb = data["gb"]
    total = data["total"]
    service_name = data["service_name"]
    shortfall = data.get("shortfall", total)
    inbound_id = data.get("inbound_id", cfg.inbound_id)
    flow = data.get("flow")
    photo: PhotoSize = message.photo[-1]
    pid = await db.create_pending_payment(
        message.from_user.id,
        shortfall,
        photo.file_id,
        "purchase",
        json.dumps(
            {
                "gb": gb,
                "total": total,
                "service_name": service_name,
                "inbound_id": inbound_id,
                "flow": flow,
            }
        ),
    )
    await state.clear()
    u = message.from_user
    caption = (
        f"📥 <b>رسید خرید سرویس</b>\n\n"
        f"👤 {u.full_name} | 🆔 <code>{u.id}</code>\n"
        f"💰 {shortfall:,} تومان | 📦 {gb}GB | 📝 <code>{service_name}</code> | 🔖 {pid}"
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
    await message.answer("✅ رسید ارسال شد. پس از تایید ادمین سرویس برایتان ارسال می‌شود.", reply_markup=main_menu())
