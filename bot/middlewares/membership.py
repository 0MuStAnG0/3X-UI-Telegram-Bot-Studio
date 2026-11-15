from __future__ import annotations

import logging
from typing import Any, Callable
from aiogram import BaseMiddleware
from aiogram.types import CallbackQuery, Message, TelegramObject
import database as db
from config import cfg
from keyboards import channel_kb

logger = logging.getLogger(__name__)
BYPASS = {"check_member"}


class MembershipMiddleware(BaseMiddleware):
    async def __call__(self, handler: Callable, event: TelegramObject, data: dict) -> Any:
        bot = data.get("bot")
        user_id = None
        if isinstance(event, Message):
            user_id = event.from_user.id if event.from_user else None
        elif isinstance(event, CallbackQuery):
            user_id = event.from_user.id if event.from_user else None

        if user_id and user_id not in cfg.admin_ids:
            if await db.is_user_blocked(user_id):
                if isinstance(event, Message):
                    await event.answer("⛔️ دسترسی شما به ربات توسط مدیریت محدود شده است.")
                elif isinstance(event, CallbackQuery):
                    await event.answer("دسترسی شما محدود شده است.", show_alert=True)
                return

        if not cfg.required_channel_id:
            return await handler(event, data)
        if isinstance(event, CallbackQuery) and event.data in BYPASS:
            return await handler(event, data)
        if not user_id or not bot:
            return await handler(event, data)
        try:
            member = await bot.get_chat_member(cfg.required_channel_id, user_id)
            is_member = member.status not in ("left", "kicked", "banned")
        except Exception:
            is_member = False
        if not is_member:
            text = (
                "⛔️ برای استفاده از ربات باید عضو کانال ما باشید.\n\n"
                "بعد از عضویت روی «✅ تایید عضویت» بزنید."
            )
            kb = channel_kb(cfg.required_channel_invite)
            if isinstance(event, Message):
                await event.answer(text, reply_markup=kb)
            elif isinstance(event, CallbackQuery):
                await event.message.answer(text, reply_markup=kb)
                await event.answer()
            return
        return await handler(event, data)
