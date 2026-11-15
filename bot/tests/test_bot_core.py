import os
import sqlite3
import sys
import tempfile
import types
import unittest
from pathlib import Path

BOT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BOT_DIR))

# Allow running unit tests with Python stdlib even before pip install -r requirements.txt
if "dotenv" not in sys.modules:
    dotenv_stub = types.ModuleType("dotenv")
    dotenv_stub.load_dotenv = lambda *args, **kwargs: False
    sys.modules["dotenv"] = dotenv_stub

if "aiosqlite" not in sys.modules:
    aiosqlite_stub = types.ModuleType("aiosqlite")
    aiosqlite_stub.Row = sqlite3.Row
    sys.modules["aiosqlite"] = aiosqlite_stub

os.environ.setdefault("BOT_TOKEN", "123456:TEST_TOKEN")
os.environ.setdefault("PANEL_URL", "https://panel.example.com:2053")
os.environ.setdefault("PANEL_PATH", "/secret")
os.environ.setdefault("PANEL_API_TOKEN", "test_bearer_token_abc")
os.environ.setdefault("SUB_BASE_URL", "https://sub.example.com/sub")

from config import Config, _parse_cards, _parse_inbounds
from database import SCHEMA_SQL


class TestConfigParsing(unittest.TestCase):
    def test_parse_inbounds(self):
        parsed = _parse_inbounds("1:Germany-Reality:xtls-rprx-vision,2:Finland-WS:")
        self.assertEqual(
            parsed,
            [
                ("1", "Germany-Reality", "xtls-rprx-vision"),
                ("2", "Finland-WS", ""),
            ],
        )

    def test_parse_cards(self):
        cards = _parse_cards("6037-9911-0000-1111:علی رضایی,5022-2910-1234-5678:سارا")
        self.assertEqual(len(cards), 2)
        self.assertEqual(cards[0], ("6037-9911-0000-1111", "علی رضایی"))

    def test_socks5_proxy_properties(self):
        cfg_disabled = Config(proxy_host="", proxy_port="")
        self.assertFalse(cfg_disabled.proxy_enabled)
        self.assertEqual(cfg_disabled.socks5_url, "")

        cfg_enabled = Config(proxy_host="127.0.0.1", proxy_port="10808")
        self.assertTrue(cfg_enabled.proxy_enabled)
        self.assertEqual(cfg_enabled.socks5_url, "socks5://127.0.0.1:10808")

        cfg_auth = Config(proxy_host="127.0.0.1", proxy_port="10808", proxy_user="u", proxy_pass="p")
        self.assertEqual(cfg_auth.socks5_url, "socks5://u:p@127.0.0.1:10808")

    def test_web_panel_defaults(self):
        cfg_wp = Config()
        self.assertTrue(cfg_wp.web_panel_enabled)
        self.assertEqual(cfg_wp.web_panel_port, 8080)
        self.assertEqual(cfg_wp.web_panel_host, "0.0.0.0")


class TestSQLiteSchemaAndIndexes(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        self.tmp.close()
        self.conn = sqlite3.connect(self.tmp.name)
        self.conn.executescript(SCHEMA_SQL)

    def tearDown(self):
        self.conn.close()
        os.unlink(self.tmp.name)

    def test_optimized_indexes_created(self):
        rows = self.conn.execute(
            "SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%'"
        ).fetchall()
        index_names = {r[0] for r in rows}
        expected = {
            "idx_users_joined_at",
            "idx_transactions_tg_created",
            "idx_pending_payments_status_created",
            "idx_pending_payments_tg_id",
            "idx_referrals_inviter_id",
            "idx_orders_tg_id",
            "idx_orders_client_email",
            "idx_orders_created_at_type",
            "idx_discount_uses_tg",
        }
        self.assertTrue(expected.issubset(index_names), f"Missing indexes: {expected - index_names}")

    def test_query_plan_uses_index_for_orders_and_pending(self):
        plan_orders = self.conn.execute(
            "EXPLAIN QUERY PLAN SELECT DISTINCT client_email FROM orders WHERE telegram_id = 1001"
        ).fetchall()
        plan_text = " ".join(str(row) for row in plan_orders)
        self.assertIn("idx_orders_tg_id", plan_text)

        plan_pending = self.conn.execute(
            "EXPLAIN QUERY PLAN SELECT id FROM pending_payments WHERE status = 'pending'"
        ).fetchall()
        plan_pending_text = " ".join(str(row) for row in plan_pending)
        self.assertIn("idx_pending_payments_status_created", plan_pending_text)

    def test_users_blocked_and_sales_plans_schema(self):
        self.conn.execute("INSERT INTO users(telegram_id, username, full_name) VALUES(123, 'u1', 'User One')")
        row = self.conn.execute("SELECT blocked FROM users WHERE telegram_id=123").fetchone()
        self.assertEqual(row[0], 0)
        self.conn.execute(
            "INSERT INTO sales_plans(id, name, gb, days, price, inbound_id, active) VALUES('p1', '30G', 30, 30, 225000, 1, 1)"
        )
        plan = self.conn.execute("SELECT name, gb, price FROM sales_plans WHERE id='p1'").fetchone()
        self.assertEqual(plan, ("30G", 30, 225000))


class TestPricingLogic(unittest.TestCase):
    def test_tiered_pricing(self):
        prices = {"low": 8000, "mid": 7500, "high": 7000, "tier1_max": 20, "tier2_max": 60}

        def compute(gb: int) -> int:
            if gb < prices["tier1_max"]:
                return gb * prices["low"]
            elif gb <= prices["tier2_max"]:
                return gb * prices["mid"]
            return gb * prices["high"]

        self.assertEqual(compute(10), 80000)
        self.assertEqual(compute(30), 225000)
        self.assertEqual(compute(100), 700000)


if __name__ == "__main__":
    unittest.main()
