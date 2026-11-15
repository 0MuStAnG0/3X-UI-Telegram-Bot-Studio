from __future__ import annotations

import logging
from typing import List, Optional
import aiosqlite
from config import cfg

logger = logging.getLogger(__name__)
DB = cfg.db_path

SCHEMA_SQL = """
PRAGMA journal_mode=WAL;
PRAGMA cache_size=-8000;
PRAGMA synchronous=NORMAL;
PRAGMA temp_store=MEMORY;
PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS users (
    telegram_id INTEGER PRIMARY KEY,
    username    TEXT,
    full_name   TEXT,
    joined_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS wallets (
    telegram_id INTEGER PRIMARY KEY,
    balance     INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS transactions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    telegram_id INTEGER NOT NULL,
    amount      INTEGER NOT NULL,
    description TEXT,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pending_payments (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    telegram_id     INTEGER NOT NULL,
    amount          INTEGER NOT NULL,
    receipt_file_id TEXT,
    purpose         TEXT NOT NULL,
    meta            TEXT,
    status          TEXT NOT NULL DEFAULT 'pending',
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reviewed_at     TIMESTAMP
);

CREATE TABLE IF NOT EXISTS free_trials (
    telegram_id  INTEGER PRIMARY KEY,
    client_email TEXT NOT NULL,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS reminder_sent (
    telegram_id  INTEGER NOT NULL,
    client_email TEXT NOT NULL,
    reason       TEXT NOT NULL,
    sent_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (telegram_id, client_email, reason)
);

CREATE TABLE IF NOT EXISTS bot_settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS referrals (
    inviter_id     INTEGER NOT NULL,
    invitee_id     INTEGER NOT NULL PRIMARY KEY,
    bonus_paid     INTEGER NOT NULL DEFAULT 0,
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS discount_codes (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    code        TEXT NOT NULL UNIQUE,
    percent     INTEGER NOT NULL,
    max_uses    INTEGER NOT NULL DEFAULT 1,
    used_count  INTEGER NOT NULL DEFAULT 0,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS discount_uses (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    code        TEXT NOT NULL,
    telegram_id INTEGER NOT NULL,
    used_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(code, telegram_id)
);

CREATE TABLE IF NOT EXISTS orders (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    telegram_id  INTEGER NOT NULL,
    client_email TEXT NOT NULL,
    gb           INTEGER NOT NULL,
    amount_paid  INTEGER NOT NULL,
    order_type   TEXT NOT NULL DEFAULT 'new',
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS broadcast_log (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    message     TEXT,
    sent_count  INTEGER DEFAULT 0,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Optimized Indexes for High-Speed Lookups
CREATE INDEX IF NOT EXISTS idx_users_joined_at
    ON users(joined_at);

CREATE INDEX IF NOT EXISTS idx_transactions_tg_created
    ON transactions(telegram_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pending_payments_status_created
    ON pending_payments(status, created_at);

CREATE INDEX IF NOT EXISTS idx_pending_payments_tg_id
    ON pending_payments(telegram_id);

CREATE INDEX IF NOT EXISTS idx_referrals_inviter_id
    ON referrals(inviter_id);

CREATE INDEX IF NOT EXISTS idx_orders_tg_id
    ON orders(telegram_id, id DESC);

CREATE INDEX IF NOT EXISTS idx_orders_client_email
    ON orders(client_email, id DESC);

CREATE INDEX IF NOT EXISTS idx_orders_created_at_type
    ON orders(created_at, order_type);

CREATE INDEX IF NOT EXISTS idx_discount_uses_tg
    ON discount_uses(telegram_id, code);
"""


async def init_db(db_path: Optional[str] = None) -> None:
    target = db_path or DB
    async with aiosqlite.connect(target) as db:
        await db.executescript(SCHEMA_SQL)
        await db.commit()
    logger.info("DB ready with optimized indexes: %s", target)


async def upsert_user(telegram_id: int, username: Optional[str], full_name: str, db_path: Optional[str] = None) -> None:
    target = db_path or DB
    async with aiosqlite.connect(target) as db:
        await db.execute(
            "INSERT INTO users(telegram_id, username, full_name) VALUES(?,?,?) "
            "ON CONFLICT(telegram_id) DO UPDATE SET username=excluded.username, full_name=excluded.full_name",
            (telegram_id, username, full_name),
        )
        await db.execute("INSERT OR IGNORE INTO wallets(telegram_id, balance) VALUES(?, 0)", (telegram_id,))
        await db.commit()


async def get_user(telegram_id: int, db_path: Optional[str] = None) -> Optional[aiosqlite.Row]:
    target = db_path or DB
    async with aiosqlite.connect(target) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM users WHERE telegram_id=?", (telegram_id,)) as cur:
            return await cur.fetchone()


async def get_balance(telegram_id: int, db_path: Optional[str] = None) -> int:
    target = db_path or DB
    async with aiosqlite.connect(target) as db:
        async with db.execute("SELECT balance FROM wallets WHERE telegram_id=?", (telegram_id,)) as cur:
            row = await cur.fetchone()
            return int(row[0]) if row else 0


async def add_balance(telegram_id: int, amount: int, description: str = "", db_path: Optional[str] = None) -> int:
    target = db_path or DB
    async with aiosqlite.connect(target) as db:
        await db.execute("INSERT OR IGNORE INTO wallets(telegram_id, balance) VALUES(?, 0)", (telegram_id,))
        await db.execute("UPDATE wallets SET balance = balance + ? WHERE telegram_id=?", (amount, telegram_id))
        await db.execute(
            "INSERT INTO transactions(telegram_id, amount, description) VALUES(?,?,?)",
            (telegram_id, amount, description),
        )
        await db.commit()
        async with db.execute("SELECT balance FROM wallets WHERE telegram_id=?", (telegram_id,)) as cur:
            row = await cur.fetchone()
            return int(row[0]) if row else 0


async def create_pending_payment(
    telegram_id: int, amount: int, receipt_file_id: str, purpose: str, meta: str = "", db_path: Optional[str] = None
) -> int:
    target = db_path or DB
    async with aiosqlite.connect(target) as db:
        cur = await db.execute(
            "INSERT INTO pending_payments(telegram_id, amount, receipt_file_id, purpose, meta) VALUES(?,?,?,?,?)",
            (telegram_id, amount, receipt_file_id, purpose, meta),
        )
        await db.commit()
        return int(cur.lastrowid)


async def get_pending_payment(payment_id: int, db_path: Optional[str] = None) -> Optional[aiosqlite.Row]:
    target = db_path or DB
    async with aiosqlite.connect(target) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM pending_payments WHERE id=?", (payment_id,)) as cur:
            return await cur.fetchone()


async def update_payment_status(payment_id: int, status: str, db_path: Optional[str] = None) -> None:
    target = db_path or DB
    async with aiosqlite.connect(target) as db:
        await db.execute(
            "UPDATE pending_payments SET status=?, reviewed_at=CURRENT_TIMESTAMP WHERE id=?",
            (status, payment_id),
        )
        await db.commit()


async def has_free_trial(telegram_id: int, db_path: Optional[str] = None) -> bool:
    target = db_path or DB
    async with aiosqlite.connect(target) as db:
        async with db.execute("SELECT 1 FROM free_trials WHERE telegram_id=?", (telegram_id,)) as cur:
            return await cur.fetchone() is not None


async def record_free_trial(telegram_id: int, client_email: str, db_path: Optional[str] = None) -> None:
    target = db_path or DB
    async with aiosqlite.connect(target) as db:
        await db.execute(
            "INSERT OR IGNORE INTO free_trials(telegram_id, client_email) VALUES(?,?)",
            (telegram_id, client_email),
        )
        await db.commit()


async def create_order(
    telegram_id: int, client_email: str, gb: int, amount_paid: int, order_type: str = "new", db_path: Optional[str] = None
) -> int:
    target = db_path or DB
    async with aiosqlite.connect(target) as db:
        cur = await db.execute(
            "INSERT INTO orders(telegram_id, client_email, gb, amount_paid, order_type) VALUES(?,?,?,?,?)",
            (telegram_id, client_email, gb, amount_paid, order_type),
        )
        await db.commit()
        return int(cur.lastrowid)


async def get_user_orders(telegram_id: int, db_path: Optional[str] = None) -> List[aiosqlite.Row]:
    target = db_path or DB
    async with aiosqlite.connect(target) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT DISTINCT client_email FROM orders WHERE telegram_id=? ORDER BY id DESC", (telegram_id,)
        ) as cur:
            return await cur.fetchall()


async def create_discount_code(code: str, percent: int, max_uses: int, db_path: Optional[str] = None) -> None:
    target = db_path or DB
    async with aiosqlite.connect(target) as db:
        await db.execute(
            "INSERT INTO discount_codes(code, percent, max_uses) VALUES(?,?,?) "
            "ON CONFLICT(code) DO UPDATE SET percent=excluded.percent, max_uses=excluded.max_uses",
            (code.upper(), percent, max_uses),
        )
        await db.commit()


async def get_discount_code(code: str, db_path: Optional[str] = None) -> Optional[aiosqlite.Row]:
    target = db_path or DB
    async with aiosqlite.connect(target) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT * FROM discount_codes WHERE code=? AND used_count < max_uses",
            (code.upper(),),
        ) as cur:
            return await cur.fetchone()


async def use_discount_code(code: str, telegram_id: int, db_path: Optional[str] = None) -> bool:
    target = db_path or DB
    async with aiosqlite.connect(target) as db:
        try:
            await db.execute(
                "INSERT INTO discount_uses(code, telegram_id) VALUES(?,?)",
                (code.upper(), telegram_id),
            )
            await db.execute(
                "UPDATE discount_codes SET used_count = used_count + 1 WHERE code=?",
                (code.upper(),),
            )
            await db.commit()
            return True
        except Exception:
            return False


async def release_discount_use(code: str, telegram_id: int, db_path: Optional[str] = None) -> None:
    target = db_path or DB
    async with aiosqlite.connect(target) as db:
        cur = await db.execute(
            "DELETE FROM discount_uses WHERE code=? AND telegram_id=?",
            (code.upper(), telegram_id),
        )
        if cur.rowcount and cur.rowcount > 0:
            await db.execute(
                "UPDATE discount_codes SET used_count = MAX(0, used_count - 1) WHERE code=?",
                (code.upper(),),
            )
        await db.commit()


async def delete_discount_code(code: str, db_path: Optional[str] = None) -> None:
    target = db_path or DB
    async with aiosqlite.connect(target) as db:
        await db.execute("DELETE FROM discount_codes WHERE code=?", (code.upper(),))
        await db.commit()


async def list_discount_codes(db_path: Optional[str] = None) -> List[aiosqlite.Row]:
    target = db_path or DB
    async with aiosqlite.connect(target) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM discount_codes ORDER BY id DESC") as cur:
            return await cur.fetchall()


async def get_all_user_ids(db_path: Optional[str] = None) -> List[int]:
    target = db_path or DB
    async with aiosqlite.connect(target) as db:
        async with db.execute("SELECT telegram_id FROM users") as cur:
            rows = await cur.fetchall()
            return [int(r[0]) for r in rows]


async def get_expiring_orders(db_path: Optional[str] = None) -> List[aiosqlite.Row]:
    target = db_path or DB
    async with aiosqlite.connect(target) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            """
            SELECT telegram_id, client_email
            FROM orders
            GROUP BY client_email
            HAVING MAX(id)
            """
        ) as cur:
            return await cur.fetchall()


async def add_referral(inviter_id: int, invitee_id: int, db_path: Optional[str] = None) -> bool:
    target = db_path or DB
    async with aiosqlite.connect(target) as db:
        try:
            await db.execute(
                "INSERT OR IGNORE INTO referrals(inviter_id, invitee_id) VALUES(?,?)",
                (inviter_id, invitee_id),
            )
            await db.commit()
            return True
        except Exception:
            return False


async def get_unpaid_inviter(invitee_id: int, db_path: Optional[str] = None) -> Optional[int]:
    target = db_path or DB
    async with aiosqlite.connect(target) as db:
        async with db.execute(
            "SELECT inviter_id FROM referrals WHERE invitee_id=? AND bonus_paid=0",
            (invitee_id,),
        ) as cur:
            row = await cur.fetchone()
            return int(row[0]) if row else None


async def mark_referral_bonus_paid(invitee_id: int, db_path: Optional[str] = None) -> None:
    target = db_path or DB
    async with aiosqlite.connect(target) as db:
        await db.execute("UPDATE referrals SET bonus_paid=1 WHERE invitee_id=?", (invitee_id,))
        await db.commit()


async def get_referral_count(inviter_id: int, db_path: Optional[str] = None) -> int:
    target = db_path or DB
    async with aiosqlite.connect(target) as db:
        async with db.execute("SELECT COUNT(*) FROM referrals WHERE inviter_id=?", (inviter_id,)) as cur:
            row = await cur.fetchone()
            return int(row[0]) if row else 0


async def get_setting(key: str, default: str = "", db_path: Optional[str] = None) -> str:
    target = db_path or DB
    async with aiosqlite.connect(target) as db:
        async with db.execute("SELECT value FROM bot_settings WHERE key=?", (key,)) as cur:
            row = await cur.fetchone()
            return str(row[0]) if row else default


async def set_setting(key: str, value: str, db_path: Optional[str] = None) -> None:
    target = db_path or DB
    async with aiosqlite.connect(target) as db:
        await db.execute(
            "INSERT INTO bot_settings(key, value) VALUES(?,?) "
            "ON CONFLICT(key) DO UPDATE SET value=excluded.value",
            (key, value),
        )
        await db.commit()


async def has_reminder_sent(telegram_id: int, client_email: str, reason: str, db_path: Optional[str] = None) -> bool:
    target = db_path or DB
    async with aiosqlite.connect(target) as db:
        async with db.execute(
            "SELECT 1 FROM reminder_sent WHERE telegram_id=? AND client_email=? AND reason=?",
            (telegram_id, client_email, reason),
        ) as cur:
            return await cur.fetchone() is not None


async def mark_reminder_sent(telegram_id: int, client_email: str, reason: str, db_path: Optional[str] = None) -> None:
    target = db_path or DB
    async with aiosqlite.connect(target) as db:
        await db.execute(
            "INSERT OR IGNORE INTO reminder_sent(telegram_id, client_email, reason) VALUES(?,?,?)",
            (telegram_id, client_email, reason),
        )
        await db.commit()


async def clear_reminder(telegram_id: int, client_email: str, db_path: Optional[str] = None) -> None:
    target = db_path or DB
    async with aiosqlite.connect(target) as db:
        await db.execute(
            "DELETE FROM reminder_sent WHERE telegram_id=? AND client_email=?",
            (telegram_id, client_email),
        )
        await db.commit()
