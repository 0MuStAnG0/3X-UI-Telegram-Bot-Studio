from __future__ import annotations

import hashlib
import hmac
import json
import logging
from typing import Optional
import aiosqlite
from aiohttp import web

from config import cfg
import database as db
from services.panel import panel

logger = logging.getLogger(__name__)


def _auth_token() -> str:
    secret = f"{cfg.bot_token}:{cfg.web_panel_pass}".encode("utf-8")
    return hmac.new(secret, b"3xui-web-panel", hashlib.sha256).hexdigest()


def _is_authenticated(request: web.Request) -> bool:
    cookie = request.cookies.get("vpnbot_auth", "")
    header = request.headers.get("Authorization", "").removeprefix("Bearer ").strip()
    expected = _auth_token()
    return hmac.compare_digest(cookie, expected) or hmac.compare_digest(header, cfg.web_panel_pass)


DASHBOARD_HTML = """<!doctype html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>وب‌پنل مدیریت ربات 3X-UI</title>
<style>
  body { font-family: system-ui, -apple-system, sans-serif; background: #f8fafc; color: #0f172a; margin: 0; padding: 24px; }
  .wrap { max-width: 1080px; margin: 0 auto; }
  .card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 20px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 14px; }
  .stat-lbl { font-size: 12px; color: #64748b; }
  .stat-val { font-size: 22px; font-weight: 700; margin-top: 4px; font-variant-numeric: tabular-nums; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { padding: 10px 8px; border-bottom: 1px solid #f1f5f9; text-align: right; }
  th { color: #64748b; font-weight: 600; }
  button { cursor: pointer; border: 0; border-radius: 8px; padding: 8px 14px; font-size: 12px; font-weight: 600; }
  .btn-ok { background: #0f766e; color: #fff; }
  .btn-no { background: #fee2e2; color: #991b1b; }
  .btn-sec { background: #0f172a; color: #fff; }
  input { padding: 9px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 14px; }
  .mono { font-family: ui-monospace, monospace; direction: ltr; display: inline-block; }
</style>
</head>
<body>
<div class="wrap">
  <div class="card" style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
    <div>
      <h1 style="margin:0;font-size:20px">وب‌پنل مدیریت ربات 3X-UI</h1>
      <div style="font-size:12px;color:#64748b;margin-top:4px">
        پنل: <span class="mono" id="panelUrl">-</span> · پروکسی: <span class="mono" id="proxyInfo">-</span>
      </div>
    </div>
    <button class="btn-sec" onclick="loadData()">بروزرسانی آمار</button>
  </div>

  <div id="loginBox" class="card" style="display:none;max-width:420px;margin:40px auto">
    <h2 style="margin-top:0;font-size:16px">ورود به وب‌پنل</h2>
    <input id="passInput" type="password" placeholder="رمز عبور وب‌پنل" style="width:100%;box-sizing:border-box;margin-bottom:12px" />
    <button class="btn-ok" style="width:100%" onclick="login()">ورود</button>
    <div id="loginErr" style="color:#b91c1c;font-size:12px;margin-top:8px"></div>
  </div>

  <div id="appBox" style="display:none">
    <div class="grid" style="margin-bottom:20px">
      <div class="card"><div class="stat-lbl">کل کاربران</div><div class="stat-val" id="stUsers">0</div></div>
      <div class="card"><div class="stat-lbl">کل سفارشات</div><div class="stat-val" id="stOrders">0</div></div>
      <div class="card"><div class="stat-lbl">درآمد کل (تومان)</div><div class="stat-val" id="stRev">0</div></div>
      <div class="card"><div class="stat-lbl">رسیدهای معلق</div><div class="stat-val" id="stPend">0</div></div>
    </div>

    <div class="card">
      <h2 style="margin-top:0;font-size:15px">پرداخت‌های در انتظار بررسی</h2>
      <table>
        <thead><tr><th>شناسه</th><th>کاربر</th><th>مبلغ (تومان)</th><th>نوع</th><th>تاریخ</th></tr></thead>
        <tbody id="pendRows"></tbody>
      </table>
    </div>

    <div class="card">
      <h2 style="margin-top:0;font-size:15px">آخرین سفارشات</h2>
      <table>
        <thead><tr><th>سرویس</th><th>کاربر</th><th>حجم</th><th>مبلغ</th><th>نوع</th></tr></thead>
        <tbody id="orderRows"></tbody>
      </table>
    </div>
  </div>
</div>
<script>
async function login() {
  const pass = document.getElementById('passInput').value;
  const r = await fetch('/api/login', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({password: pass}) });
  if (r.ok) { loadData(); } else { document.getElementById('loginErr').textContent = 'رمز عبور نادرست است.'; }
}
async function loadData() {
  const r = await fetch('/api/overview');
  if (r.status === 401) {
    document.getElementById('loginBox').style.display = 'block';
    document.getElementById('appBox').style.display = 'none';
    return;
  }
  const d = await r.json();
  document.getElementById('loginBox').style.display = 'none';
  document.getElementById('appBox').style.display = 'block';
  document.getElementById('panelUrl').textContent = d.panel_url;
  document.getElementById('proxyInfo').textContent = d.proxy;
  document.getElementById('stUsers').textContent = d.stats.users.toLocaleString('fa-IR');
  document.getElementById('stOrders').textContent = d.stats.orders.toLocaleString('fa-IR');
  document.getElementById('stRev').textContent = d.stats.revenue.toLocaleString('fa-IR');
  document.getElementById('stPend').textContent = d.stats.pending.toLocaleString('fa-IR');

  const pBody = document.getElementById('pendRows');
  pBody.innerHTML = d.pending.length ? d.pending.map(p =>
    `<tr><td>#${p.id}</td><td class="mono">${p.telegram_id}</td><td>${p.amount.toLocaleString('fa-IR')}</td><td>${p.purpose}</td><td>${p.created_at}</td></tr>`
  ).join('') : '<tr><td colspan="5" style="color:#64748b">موردی در انتظار نیست</td></tr>';

  const oBody = document.getElementById('orderRows');
  oBody.innerHTML = d.orders.length ? d.orders.map(o =>
    `<tr><td class="mono">${o.client_email}</td><td class="mono">${o.telegram_id}</td><td>${o.gb} GB</td><td>${o.amount_paid.toLocaleString('fa-IR')}</td><td>${o.order_type}</td></tr>`
  ).join('') : '<tr><td colspan="5" style="color:#64748b">سفارشی ثبت نشده است</td></tr>';
}
loadData();
</script>
</body>
</html>
"""


async def handle_index(_request: web.Request) -> web.Response:
    return web.Response(text=DASHBOARD_HTML, content_type="text/html", charset="utf-8")


async def handle_login(request: web.Request) -> web.Response:
    try:
        body = await request.json()
    except Exception:
        return web.json_response({"ok": False}, status=400)
    password = str(body.get("password", ""))
    if not hmac.compare_digest(password, cfg.web_panel_pass):
        return web.json_response({"ok": False, "error": "Invalid password"}, status=401)
    resp = web.json_response({"ok": True})
    resp.set_cookie("vpnbot_auth", _auth_token(), httponly=True, samesite="Lax", max_age=86400 * 7)
    return resp


async def handle_overview(request: web.Request) -> web.Response:
    if not _is_authenticated(request):
        return web.json_response({"ok": False, "error": "Unauthorized"}, status=401)
    async with aiosqlite.connect(cfg.db_path) as conn:
        conn.row_factory = aiosqlite.Row
        users = (await (await conn.execute("SELECT COUNT(*) FROM users")).fetchone())[0]
        orders_count = (await (await conn.execute("SELECT COUNT(*) FROM orders")).fetchone())[0]
        revenue = (await (await conn.execute("SELECT COALESCE(SUM(amount_paid),0) FROM orders")).fetchone())[0]
        pending_count = (
            await (await conn.execute("SELECT COUNT(*) FROM pending_payments WHERE status='pending'")).fetchone()
        )[0]
        pending_rows = await (
            await conn.execute(
                "SELECT id, telegram_id, amount, purpose, created_at "
                "FROM pending_payments WHERE status='pending' ORDER BY id DESC LIMIT 20"
            )
        ).fetchall()
        order_rows = await (
            await conn.execute(
                "SELECT telegram_id, client_email, gb, amount_paid, order_type "
                "FROM orders ORDER BY id DESC LIMIT 25"
            )
        ).fetchall()

    return web.json_response(
        {
            "ok": True,
            "panel_url": f"{cfg.panel_url}{cfg.panel_path}",
            "proxy": f"SOCKS5 {cfg.proxy_host}:{cfg.proxy_port}" if cfg.proxy_enabled else "Direct",
            "stats": {
                "users": users,
                "orders": orders_count,
                "revenue": revenue,
                "pending": pending_count,
            },
            "pending": [dict(r) for r in pending_rows],
            "orders": [dict(r) for r in order_rows],
        }
    )


async def handle_health(_request: web.Request) -> web.Response:
    panel_ok = False
    try:
        await panel.list_inbounds()
        panel_ok = True
    except Exception:
        panel_ok = False
    return web.json_response({"ok": True, "panel_connected": panel_ok, "db": cfg.db_path})


async def start_web_panel() -> Optional[web.AppRunner]:
    if not cfg.web_panel_enabled:
        return None
    app = web.Application()
    app.router.add_get("/", handle_index)
    app.router.add_post("/api/login", handle_login)
    app.router.add_get("/api/overview", handle_overview)
    app.router.add_get("/api/health", handle_health)

    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, cfg.web_panel_host, cfg.web_panel_port)
    await site.start()
    logger.info("Web panel running at http://%s:%s", cfg.web_panel_host, cfg.web_panel_port)
    return runner
