from __future__ import annotations

import asyncio
import logging
from aiogram import Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties
from aiogram.client.session.aiohttp import AiohttpSession
from aiogram.enums import ParseMode
from aiogram.fsm.storage.memory import MemoryStorage

from config import cfg
from database import init_db
from handlers import admin, admin_extra, purchase, services, start, trial, wallet
from middlewares.membership import MembershipMiddleware
from services.panel import panel
from utils.payment_reminder import payment_reminder_loop
from utils.reminder import reminder_loop
from web_panel import start_web_panel

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


async def main() -> None:
    await init_db()

    if cfg.proxy_enabled:
        session = AiohttpSession(proxy=cfg.socks5_url)
        logger.info("Using SOCKS5 proxy: %s:%s", cfg.proxy_host, cfg.proxy_port)
    else:
        session = AiohttpSession()
        logger.info("Direct connection mode (no SOCKS5 proxy configured)")

    bot = Bot(
        token=cfg.bot_token,
        session=session,
        default=DefaultBotProperties(parse_mode=ParseMode.HTML),
    )

    dp = Dispatcher(storage=MemoryStorage())
    dp.message.middleware(MembershipMiddleware())
    dp.callback_query.middleware(MembershipMiddleware())

    dp.include_router(admin.router)
    dp.include_router(admin_extra.router)
    dp.include_router(start.router)
    dp.include_router(wallet.router)
    dp.include_router(trial.router)
    dp.include_router(purchase.router)
    dp.include_router(services.router)

    @dp.startup()
    async def on_startup() -> None:
        logger.info("3X-UI Telegram Bot started (aiogram 3.x async)")

    web_runner = await start_web_panel()
    reminder_task = asyncio.create_task(reminder_loop(bot))
    payment_task = asyncio.create_task(payment_reminder_loop(bot))

    try:
        await dp.start_polling(bot, allowed_updates=dp.resolve_used_update_types())
    finally:
        reminder_task.cancel()
        payment_task.cancel()
        if web_runner:
            await web_runner.cleanup()
        await bot.session.close()
        await panel.close()


if __name__ == "__main__":
    asyncio.run(main())
