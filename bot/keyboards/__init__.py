from __future__ import annotations

from aiogram.types import (
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    KeyboardButton,
    ReplyKeyboardMarkup,
)
from aiogram.utils.keyboard import InlineKeyboardBuilder, ReplyKeyboardBuilder


def main_menu() -> ReplyKeyboardMarkup:
    b = ReplyKeyboardBuilder()
    b.row(
        KeyboardButton(text="🛒 خرید سرویس"),
        KeyboardButton(text="📋 سرویس های من"),
    )
    b.row(
        KeyboardButton(text="💳 کیف پول"),
        KeyboardButton(text="🎁 تست رایگان"),
    )
    b.row(
        KeyboardButton(text="📚 آموزش اتصال"),
        KeyboardButton(text="🔗 دعوت دوستان"),
    )
    b.row(KeyboardButton(text="💬 پشتیبانی"))
    return b.as_markup(resize_keyboard=True)


def back_kb() -> InlineKeyboardMarkup:
    b = InlineKeyboardBuilder()
    b.row(InlineKeyboardButton(text="🔙 بازگشت به منوی اصلی", callback_data="back_main"))
    return b.as_markup()


def channel_kb(invite_link: str) -> InlineKeyboardMarkup:
    b = InlineKeyboardBuilder()
    if invite_link:
        b.row(InlineKeyboardButton(text="📢 عضویت در کانال", url=invite_link))
    b.row(InlineKeyboardButton(text="✅ تایید عضویت", callback_data="check_member"))
    return b.as_markup()


def wallet_kb() -> InlineKeyboardMarkup:
    b = InlineKeyboardBuilder()
    b.row(InlineKeyboardButton(text="➕ شارژ کیف پول", callback_data="wallet_topup"))
    b.row(InlineKeyboardButton(text="🔙 بازگشت", callback_data="back_main"))
    return b.as_markup()


def paid_kb() -> InlineKeyboardMarkup:
    b = InlineKeyboardBuilder()
    b.row(InlineKeyboardButton(text="✅ واریز کردم / ارسال رسید", callback_data="paid"))
    b.row(InlineKeyboardButton(text="❌ انصراف", callback_data="back_main"))
    return b.as_markup()


def confirm_buy_kb() -> InlineKeyboardMarkup:
    b = InlineKeyboardBuilder()
    b.row(
        InlineKeyboardButton(text="✅ تایید", callback_data="buy_confirm"),
        InlineKeyboardButton(text="❌ انصراف", callback_data="back_main"),
    )
    return b.as_markup()


def confirm_renew_kb() -> InlineKeyboardMarkup:
    b = InlineKeyboardBuilder()
    b.row(
        InlineKeyboardButton(text="✅ تایید تمدید", callback_data="renew_confirm"),
        InlineKeyboardButton(text="❌ انصراف", callback_data="back_main"),
    )
    return b.as_markup()


def admin_payment_kb(pid: int) -> InlineKeyboardMarkup:
    b = InlineKeyboardBuilder()
    b.row(
        InlineKeyboardButton(text="✅ تایید پرداخت", callback_data=f"ap:{pid}"),
        InlineKeyboardButton(text="❌ عدم تایید", callback_data=f"rp:{pid}"),
    )
    return b.as_markup()


def service_kb(email: str) -> InlineKeyboardMarkup:
    b = InlineKeyboardBuilder()
    b.row(InlineKeyboardButton(text="🔄 تغییر لینک اتصال", callback_data=f"chlink:{email}"))
    b.row(InlineKeyboardButton(text="🔁 تمدید سرویس", callback_data=f"renew:{email}"))
    b.row(InlineKeyboardButton(text="🔙 بازگشت به لیست", callback_data="my_services"))
    return b.as_markup()


def confirm_chlink_kb(email: str) -> InlineKeyboardMarkup:
    b = InlineKeyboardBuilder()
    b.row(
        InlineKeyboardButton(text="✅ تایید تغییر", callback_data=f"chlink_ok:{email}"),
        InlineKeyboardButton(text="❌ انصراف", callback_data=f"view:{email}"),
    )
    return b.as_markup()


def tutorial_os_kb() -> InlineKeyboardMarkup:
    b = InlineKeyboardBuilder()
    b.row(InlineKeyboardButton(text="🤖 اندروید", callback_data="tutorial:android"))
    b.row(InlineKeyboardButton(text="🍎 iOS / iPhone", callback_data="tutorial:ios"))
    b.row(InlineKeyboardButton(text="🪟 ویندوز", callback_data="tutorial:windows"))
    b.row(InlineKeyboardButton(text="🍏 مک", callback_data="tutorial:mac"))
    b.row(InlineKeyboardButton(text="🔙 بازگشت", callback_data="back_main"))
    return b.as_markup()


def inbound_choice_kb(inbounds, prefix: str = "pick_inbound") -> InlineKeyboardMarkup:
    b = InlineKeyboardBuilder()
    for ib_id, remark, _flow in inbounds:
        b.row(InlineKeyboardButton(text=f"🌍 {remark}", callback_data=f"{prefix}:{ib_id}"))
    b.row(InlineKeyboardButton(text="❌ انصراف", callback_data="back_main"))
    return b.as_markup()
