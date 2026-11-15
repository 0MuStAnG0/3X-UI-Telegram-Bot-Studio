from __future__ import annotations

import asyncio
import hashlib
import hmac
import json
import logging
from pathlib import Path
from typing import Any, Optional
import aiosqlite
from aiohttp import web

from config import _int_list, _parse_cards, _parse_inbounds, cfg
import database as db
from services.panel import panel
from utils.pricing import get_prices

logger = logging.getLogger(__name__)
_BOT_REF: Any = None


def _auth_token() -> str:
    secret = f"{cfg.bot_token}:{cfg.web_panel_pass}".encode("utf-8")
    return hmac.new(secret, b"3xui-web-panel", hashlib.sha256).hexdigest()


def _is_authenticated(request: web.Request) -> bool:
    cookie = request.cookies.get("vpnbot_auth", "")
    header = request.headers.get("Authorization", "").removeprefix("Bearer ").strip()
    expected = _auth_token()
    return hmac.compare_digest(cookie, expected) or hmac.compare_digest(header, cfg.web_panel_pass)


def _update_env_file(updates: dict[str, str]) -> None:
    env_path = Path(".env")
    existing: dict[str, str] = {}
    order: list[str] = []
    if env_path.exists():
        for line in env_path.read_text(encoding="utf-8").splitlines():
            stripped = line.strip()
            if not stripped or stripped.startswith("#") or "=" not in stripped:
                continue
            k, v = stripped.split("=", 1)
            k = k.strip()
            existing[k] = v.strip()
            order.append(k)
    for k, v in updates.items():
        if k not in existing:
            order.append(k)
        existing[k] = str(v)
    env_path.write_text("\n".join(f"{k}={existing[k]}" for k in order) + "\n", encoding="utf-8")


DASHBOARD_HTML = """<!doctype html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>وب‌پنل مدیریت ربات و پنل 3X-UI</title>
<style>
  :root { --bg: #f8fafc; --card: #ffffff; --border: #e2e8f0; --text: #0f172a; --muted: #64748b; --teal: #0f766e; }
  * { box-sizing: border-box; }
  body { font-family: system-ui, -apple-system, sans-serif; background: var(--bg); color: var(--text); margin: 0; }
  header { background: #fff; border-bottom: 1px solid var(--border); position: sticky; top: 0; z-index: 20; }
  .top { max-width: 1200px; margin: 0 auto; padding: 0 20px; height: 60px; display: flex; align-items: center; justify-content: space-between; gap: 16px; }
  .brand { font-weight: 700; font-size: 16px; }
  .tabs { display: flex; gap: 16px; overflow-x: auto; }
  .tab { background: transparent; border: 0; border-bottom: 2px solid transparent; padding: 10px 4px; font-size: 13px; font-weight: 600; color: var(--muted); cursor: pointer; white-space: nowrap; }
  .tab.active { color: var(--text); border-bottom-color: var(--teal); }
  .wrap { max-width: 1200px; margin: 0 auto; padding: 24px 20px; }
  .card { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 18px; margin-bottom: 18px; }
  .grid4 { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px; margin-bottom: 18px; }
  .grid2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 16px; }
  .lbl { font-size: 12px; color: var(--muted); display: block; margin-bottom: 5px; }
  .val { font-size: 20px; font-weight: 700; margin-top: 4px; font-variant-numeric: tabular-nums; }
  input, select, textarea { width: 100%; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 13px; background: #f8fafc; font-family: inherit; }
  .mono { font-family: ui-monospace, monospace; direction: ltr; text-align: left; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { padding: 10px 8px; border-bottom: 1px solid #f1f5f9; text-align: right; }
  th { color: var(--muted); font-weight: 600; background: #f8fafc; }
  button { cursor: pointer; border: 0; border-radius: 8px; padding: 8px 13px; font-size: 12px; font-weight: 600; }
  .btn-ok { background: var(--teal); color: #fff; }
  .btn-dark { background: #0f172a; color: #fff; }
  .btn-soft { background: #f1f5f9; color: #0f172a; }
  .btn-no { background: #fee2e2; color: #991b1b; }
  .row { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
  .msg { font-size: 12px; margin-top: 8px; font-weight: 600; }
  .hidden { display: none !important; }
</style>
</head>
<body>
<header>
  <div class="top">
    <div class="brand">وب‌پنل مدیریت 3X-UI</div>
    <div class="tabs" id="navTabs">
      <button class="tab active" onclick="showTab('connections', this)">اتصال ربات و پنل</button>
      <button class="tab" onclick="showTab('inbounds', this)">مدیریت اینباندها</button>
      <button class="tab" onclick="showTab('users', this)">کاربران و مالی</button>
      <button class="tab" onclick="showTab('plans', this)">پلن‌ها، کانفیگ‌ها و امکانات</button>
    </div>
    <button class="btn-soft" onclick="loadAll()">بروزرسانی</button>
  </div>
</header>

<div class="wrap">
  <div id="loginBox" class="card hidden" style="max-width:400px;margin:48px auto">
    <h2 style="margin-top:0;font-size:16px">ورود به وب‌پنل</h2>
    <input id="passInput" type="password" placeholder="رمز عبور وب‌پنل" style="margin-bottom:12px" />
    <button class="btn-ok" style="width:100%" onclick="login()">ورود</button>
    <div id="loginErr" class="msg" style="color:#b91c1c"></div>
  </div>

  <div id="appBox" class="hidden">
    <div id="tab-connections" class="tab-pane">
      <div class="grid2">
        <div class="card">
          <h2 style="margin-top:0;font-size:15px">اتصال ربات تلگرام</h2>
          <label class="lbl">BOT_TOKEN</label><input id="cBotToken" class="mono" style="margin-bottom:10px" />
          <label class="lbl">ADMIN_IDS (جدا با کاما)</label><input id="cAdmins" class="mono" style="margin-bottom:10px" />
          <label class="lbl">آیدی پشتیبانی</label><input id="cSupport" class="mono" style="margin-bottom:10px" />
          <label class="lbl">کانال جوین اجباری (0 = غیرفعال)</label><input id="cChannelId" class="mono" style="margin-bottom:10px" />
          <label class="lbl">لینک دعوت کانال</label><input id="cChannelInv" class="mono" style="margin-bottom:10px" />
          <label class="lbl">شماره کارت‌ها (CARD:NAME,CARD2:NAME2)</label><input id="cCards" class="mono" style="margin-bottom:12px" />
          <button class="btn-dark" onclick="testBot()">تست توکن ربات</button>
          <div id="botTestMsg" class="msg"></div>
        </div>
        <div class="card">
          <h2 style="margin-top:0;font-size:15px">اتصال پنل سنایی / 3X-UI (API Token)</h2>
          <label class="lbl">PANEL_URL</label><input id="cPanelUrl" class="mono" style="margin-bottom:10px" />
          <label class="lbl">PANEL_PATH (webBasePath)</label><input id="cPanelPath" class="mono" style="margin-bottom:10px" />
          <label class="lbl">PANEL_API_TOKEN (Bearer)</label><input id="cPanelToken" class="mono" style="margin-bottom:10px" />
          <label class="lbl">SUB_BASE_URL</label><input id="cSubBase" class="mono" style="margin-bottom:10px" />
          <div class="row" style="margin-bottom:12px">
            <div style="flex:1"><label class="lbl">PROXY_HOST (اختیاری)</label><input id="cProxyHost" class="mono" /></div>
            <div style="width:110px"><label class="lbl">PROXY_PORT</label><input id="cProxyPort" class="mono" /></div>
          </div>
          <div class="row">
            <button class="btn-ok" onclick="saveConnections()">ذخیره در .env و اعمال</button>
            <button class="btn-dark" onclick="testPanel()">تست اتصال پنل سنایی</button>
          </div>
          <div id="connMsg" class="msg"></div>
        </div>
      </div>
    </div>

    <div id="tab-inbounds" class="tab-pane hidden">
      <div class="card">
        <div class="row" style="justify-content:space-between;margin-bottom:14px">
          <h2 style="margin:0;font-size:15px">مدیریت اینباندهای پنل 3X-UI</h2>
          <div class="row">
            <button class="btn-ok" onclick="syncInbounds()">همگام‌سازی زنده از 3X-UI</button>
            <button class="btn-dark" onclick="saveInbounds()">ذخیره لیست اینباندها</button>
          </div>
        </div>
        <div id="ibMsg" class="msg" style="margin-bottom:10px"></div>
        <div id="inboundsList"></div>
        <div class="row" style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border)">
          <input id="nIbId" type="number" placeholder="ID" style="width:90px" class="mono" />
          <input id="nIbRem" placeholder="نام سرور (مثلاً Germany Reality)" style="flex:1;min-width:160px" />
          <input id="nIbFlow" placeholder="xtls-rprx-vision" style="width:160px" class="mono" />
          <button class="btn-soft" onclick="addInboundRow()">+ افزودن اینباند</button>
        </div>
      </div>
    </div>

    <div id="tab-users" class="tab-pane hidden">
      <div class="grid4">
        <div class="card"><div class="lbl">کل کاربران</div><div class="val" id="stUsers">0</div></div>
        <div class="card"><div class="lbl">کل سفارشات</div><div class="val" id="stOrders">0</div></div>
        <div class="card"><div class="lbl">درآمد کل (تومان)</div><div class="val" id="stRev">0</div></div>
        <div class="card"><div class="lbl">رسیدهای معلق</div><div class="val" id="stPend">0</div></div>
      </div>

      <div class="card">
        <h2 style="margin-top:0;font-size:15px">مدیریت کاربران و کیف پول</h2>
        <div style="overflow-x:auto">
          <table>
            <thead><tr><th>شناسه</th><th>نام و یوزرنیم</th><th>موجودی (تومان)</th><th>سرویس</th><th>وضعیت</th><th>عملیات</th></tr></thead>
            <tbody id="userRows"></tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <h2 style="margin-top:0;font-size:15px">رسیدهای در انتظار تایید</h2>
        <div style="overflow-x:auto">
          <table>
            <thead><tr><th>شناسه</th><th>کاربر</th><th>مبلغ</th><th>نوع</th><th>جزئیات</th><th>عملیات</th></tr></thead>
            <tbody id="pendRows"></tbody>
          </table>
        </div>
      </div>
    </div>

    <div id="tab-plans" class="tab-pane hidden">
      <div class="card">
        <h2 style="margin-top:0;font-size:15px">ساخت کانفیگ جدید روی پنل 3X-UI</h2>
        <div class="row">
          <input id="ncUser" type="number" placeholder="شناسه تلگرام کاربر" style="width:160px" class="mono" />
          <input id="ncEmail" placeholder="نام کانفیگ (مثلاً ali.phone)" style="flex:1;min-width:150px" class="mono" />
          <input id="ncGb" type="number" value="30" placeholder="GB" style="width:90px" class="mono" />
          <input id="ncDays" type="number" value="30" placeholder="روز" style="width:90px" class="mono" />
          <button class="btn-ok" onclick="createConfig()">ساخت کانفیگ</button>
        </div>
        <div id="cfgMsg" class="msg"></div>
      </div>

      <div class="card">
        <h2 style="margin-top:0;font-size:15px">کانفیگ‌ها و سفارشات ثبت‌شده</h2>
        <div style="overflow-x:auto">
          <table>
            <thead><tr><th>سرویس</th><th>کاربر</th><th>حجم</th><th>مبلغ</th><th>عملیات</th></tr></thead>
            <tbody id="orderRows"></tbody>
          </table>
        </div>
      </div>

      <div class="grid2">
        <div class="card">
          <h2 style="margin-top:0;font-size:15px">تعرفه پلکانی و بسته‌های فروش</h2>
          <div class="row" style="margin-bottom:10px">
            <div style="flex:1"><label class="lbl">پله ۱ (کمتر از مرز۱)</label><input id="pLow" type="number" class="mono" /></div>
            <div style="flex:1"><label class="lbl">پله ۲</label><input id="pMid" type="number" class="mono" /></div>
            <div style="flex:1"><label class="lbl">پله ۳</label><input id="pHigh" type="number" class="mono" /></div>
          </div>
          <div class="row" style="margin-bottom:10px">
            <div style="flex:1"><label class="lbl">مرز ۱ (GB)</label><input id="pT1" type="number" class="mono" /></div>
            <div style="flex:1"><label class="lbl">مرز ۲ (GB)</label><input id="pT2" type="number" class="mono" /></div>
            <button class="btn-dark" style="margin-top:18px" onclick="savePricing()">ذخیره قیمت</button>
          </div>
          <hr style="border:0;border-top:1px solid var(--border);margin:14px 0" />
          <div id="plansList"></div>
          <div class="row" style="margin-top:10px">
            <input id="npName" placeholder="نام بسته" style="flex:1;min-width:110px" />
            <input id="npGb" type="number" placeholder="GB" style="width:70px" class="mono" />
            <input id="npPrice" type="number" placeholder="قیمت" style="width:110px" class="mono" />
            <button class="btn-soft" onclick="addPlan()">+ پلن</button>
          </div>
        </div>

        <div class="card">
          <h2 style="margin-top:0;font-size:15px">کد تخفیف، امکانات ربات و پیام همگانی</h2>
          <div class="row" style="margin-bottom:10px">
            <label class="row" style="font-size:12px"><input id="fTrial" type="checkbox" style="width:auto" /> تست رایگان</label>
            <label class="row" style="font-size:12px"><input id="fRef" type="checkbox" style="width:auto" /> دعوت دوستان</label>
            <button class="btn-soft" onclick="saveFeatures()">ذخیره امکانات</button>
          </div>
          <div class="row" style="margin-bottom:10px">
            <input id="ndCode" placeholder="کد تخفیف" style="flex:1" class="mono" />
            <input id="ndPct" type="number" placeholder="٪" style="width:70px" class="mono" />
            <input id="ndMax" type="number" placeholder="تعداد" style="width:80px" class="mono" />
            <button class="btn-dark" onclick="addDiscount()">ساخت کد</button>
          </div>
          <div id="discountsList" style="margin-bottom:14px"></div>
          <label class="lbl">ارسال پیام همگانی به کاربران ربات</label>
          <textarea id="bcText" rows="2" placeholder="متن پیام همگانی..." style="margin-bottom:8px"></textarea>
          <button class="btn-ok" onclick="sendBroadcast()">ارسال پیام همگانی</button>
          <div id="featMsg" class="msg"></div>
        </div>
      </div>
    </div>
  </div>
</div>

<script>
let STATE = null;
function showTab(name, btn) {
  document.querySelectorAll('.tab-pane').forEach(el => el.classList.add('hidden'));
  document.getElementById('tab-' + name).classList.remove('hidden');
  document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
}
async function api(url, opts = {}) {
  const r = await fetch(url, { headers: {'Content-Type':'application/json'}, ...opts });
  const d = await r.json().catch(() => ({}));
  return { status: r.status, ok: r.ok, data: d };
}
async function login() {
  const pass = document.getElementById('passInput').value;
  const r = await api('/api/login', { method: 'POST', body: JSON.stringify({password: pass}) });
  if (r.ok) loadAll(); else document.getElementById('loginErr').textContent = 'رمز عبور نادرست است.';
}
async function loadAll() {
  const r = await api('/api/overview');
  if (r.status === 401) {
    document.getElementById('loginBox').classList.remove('hidden');
    document.getElementById('appBox').classList.add('hidden');
    return;
  }
  document.getElementById('loginBox').classList.add('hidden');
  document.getElementById('appBox').classList.remove('hidden');
  const d = r.data; STATE = d;
  document.getElementById('cBotToken').value = d.config.bot_token || '';
  document.getElementById('cAdmins').value = (d.config.admin_ids || []).join(',');
  document.getElementById('cSupport').value = d.config.support || '';
  document.getElementById('cChannelId').value = d.config.required_channel_id || 0;
  document.getElementById('cChannelInv').value = d.config.required_channel_invite || '';
  document.getElementById('cCards').value = d.config.cards_raw || '';
  document.getElementById('cPanelUrl').value = d.config.panel_url || '';
  document.getElementById('cPanelPath').value = d.config.panel_path || '';
  document.getElementById('cPanelToken').value = d.config.panel_api_token || '';
  document.getElementById('cSubBase').value = d.config.sub_base_url || '';
  document.getElementById('cProxyHost').value = d.config.proxy_host || '';
  document.getElementById('cProxyPort').value = d.config.proxy_port || '';

  document.getElementById('stUsers').textContent = d.stats.users.toLocaleString('fa-IR');
  document.getElementById('stOrders').textContent = d.stats.orders.toLocaleString('fa-IR');
  document.getElementById('stRev').textContent = d.stats.revenue.toLocaleString('fa-IR');
  document.getElementById('stPend').textContent = d.stats.pending.toLocaleString('fa-IR');

  renderInbounds(d.inbounds || []);
  renderUsers(d.users || []);
  renderPending(d.pending || []);
  renderOrders(d.orders || []);

  document.getElementById('pLow').value = d.pricing.low;
  document.getElementById('pMid').value = d.pricing.mid;
  document.getElementById('pHigh').value = d.pricing.high;
  document.getElementById('pT1').value = d.pricing.tier1_max;
  document.getElementById('pT2').value = d.pricing.tier2_max;
  document.getElementById('fTrial').checked = d.features.trial_enabled;
  document.getElementById('fRef').checked = d.features.referral_enabled;

  document.getElementById('plansList').innerHTML = (d.sales_plans || []).map(p =>
    `<div class="row" style="justify-content:space-between;padding:6px 0;border-bottom:1px solid #f1f5f9;font-size:12px">
      <span><b>${p.name}</b> — ${p.gb} GB / ${p.price.toLocaleString('fa-IR')} تومان</span>
      <button class="btn-no" onclick="delPlan('${p.id}')">حذف</button>
    </div>`
  ).join('') || '<div style="font-size:12px;color:#64748b">بسته آماده‌ای ثبت نشده است</div>';

  document.getElementById('discountsList').innerHTML = (d.discounts || []).map(c =>
    `<div class="row" style="justify-content:space-between;padding:5px 0;border-bottom:1px solid #f1f5f9;font-size:12px">
      <span class="mono">${c.code} (${c.percent}% — ${c.used_count}/${c.max_uses})</span>
      <button class="btn-no" onclick="delDiscount('${c.code}')">حذف</button>
    </div>`
  ).join('');
}

function renderInbounds(list) {
  document.getElementById('inboundsList').innerHTML = list.map((ib, i) => `
    <div class="row" style="margin-bottom:8px">
      <input type="number" value="${ib.id}" data-ib-id="${i}" style="width:80px" class="mono" />
      <input value="${ib.remark}" data-ib-rem="${i}" style="flex:1;min-width:150px" />
      <input value="${ib.flow}" data-ib-flow="${i}" style="width:150px" class="mono" />
      <button class="btn-no" onclick="removeInbound(${i})">حذف</button>
    </div>
  `).join('');
}
function readInboundsInputs() {
  const ids = document.querySelectorAll('[data-ib-id]');
  const out = [];
  ids.forEach((el, i) => {
    out.push({
      id: el.value.trim(),
      remark: document.querySelector(`[data-ib-rem="${i}"]`).value.trim(),
      flow: document.querySelector(`[data-ib-flow="${i}"]`).value.trim(),
    });
  });
  return out;
}
function addInboundRow() {
  const cur = readInboundsInputs();
  cur.push({ id: document.getElementById('nIbId').value || '1', remark: document.getElementById('nIbRem').value || 'Server', flow: document.getElementById('nIbFlow').value });
  renderInbounds(cur);
}
function removeInbound(idx) {
  const cur = readInboundsInputs();
  cur.splice(idx, 1);
  renderInbounds(cur);
}
async function saveInbounds() {
  const r = await api('/api/inbounds/save', { method: 'POST', body: JSON.stringify({ inbounds: readInboundsInputs() }) });
  document.getElementById('ibMsg').textContent = r.ok ? 'لیست اینباندها ذخیره و اعمال شد.' : (r.data.error || 'خطا');
}
async function syncInbounds() {
  const r = await api('/api/inbounds/sync', { method: 'POST' });
  document.getElementById('ibMsg').textContent = r.ok ? `${r.data.inbounds.length} اینباند از 3X-UI همگام‌سازی شد.` : (r.data.error || 'خطا');
  if (r.ok) renderInbounds(r.data.inbounds);
}

function renderUsers(users) {
  document.getElementById('userRows').innerHTML = users.map(u => `
    <tr>
      <td class="mono">${u.telegram_id}</td>
      <td>${u.full_name || '-'} <span class="mono" style="color:#64748b">${u.username ? '@'+u.username : ''}</span></td>
      <td>${u.balance.toLocaleString('fa-IR')}</td>
      <td>${u.services_count}</td>
      <td>${u.blocked ? 'مسدود' : 'فعال'}</td>
      <td class="row">
        <button class="btn-soft" onclick="adjBal(${u.telegram_id}, 1)">+ شارژ</button>
        <button class="btn-soft" onclick="adjBal(${u.telegram_id}, -1)">- کسر</button>
        <button class="${u.blocked ? 'btn-ok' : 'btn-no'}" onclick="toggleBlock(${u.telegram_id}, ${u.blocked ? 0 : 1})">${u.blocked ? 'رفع مسدودیت' : 'مسدود'}</button>
      </td>
    </tr>
  `).join('') || '<tr><td colspan="6">کاربری ثبت نشده است</td></tr>';
}
async function adjBal(id, sign) {
  const amt = prompt(sign > 0 ? 'مبلغ افزایش (تومان):' : 'مبلغ کسر (تومان):', '50000');
  if (!amt || isNaN(Number(amt))) return;
  await api('/api/users/balance', { method: 'POST', body: JSON.stringify({ telegram_id: id, delta: sign * Number(amt) }) });
  loadAll();
}
async function toggleBlock(id, blocked) {
  await api('/api/users/block', { method: 'POST', body: JSON.stringify({ telegram_id: id, blocked: !!blocked }) });
  loadAll();
}

function renderPending(list) {
  document.getElementById('pendRows').innerHTML = list.map(p => `
    <tr>
      <td>#${p.id}</td><td class="mono">${p.telegram_id}</td>
      <td>${p.amount.toLocaleString('fa-IR')}</td><td>${p.purpose}</td>
      <td class="mono">${p.meta || '-'}</td>
      <td class="row">
        <button class="btn-ok" onclick="payAction('approve', ${p.id})">تایید</button>
        <button class="btn-no" onclick="payAction('reject', ${p.id})">رد</button>
      </td>
    </tr>
  `).join('') || '<tr><td colspan="6">موردی در انتظار نیست</td></tr>';
}
async function payAction(act, id) {
  await api('/api/payments/' + act, { method: 'POST', body: JSON.stringify({ id }) });
  loadAll();
}

function renderOrders(list) {
  document.getElementById('orderRows').innerHTML = list.map(o => `
    <tr>
      <td class="mono">${o.client_email}</td><td class="mono">${o.telegram_id}</td>
      <td>${o.gb} GB</td><td>${o.amount_paid.toLocaleString('fa-IR')}</td>
      <td class="row">
        <button class="btn-soft" onclick="cfgOp('renew', '${o.client_email}')">+۲۰GB تمدید</button>
        <button class="btn-dark" onclick="cfgOp('rotate', '${o.client_email}')">تغییر لینک</button>
        <button class="btn-no" onclick="cfgOp('delete', '${o.client_email}')">حذف</button>
      </td>
    </tr>
  `).join('') || '<tr><td colspan="5">سفارشی ثبت نشده است</td></tr>';
}
async function createConfig() {
  const r = await api('/api/configs/create', {
    method: 'POST',
    body: JSON.stringify({
      telegram_id: Number(document.getElementById('ncUser').value || 0),
      email: document.getElementById('ncEmail').value.trim(),
      gb: Number(document.getElementById('ncGb').value || 30),
      days: Number(document.getElementById('ncDays').value || 30),
    })
  });
  document.getElementById('cfgMsg').textContent = r.ok ? `ساخته شد: ${r.data.sub_url}` : (r.data.error || 'خطا');
  loadAll();
}
async function cfgOp(op, email) {
  const r = await api('/api/configs/' + op, { method: 'POST', body: JSON.stringify({ email, add_gb: 20 }) });
  document.getElementById('cfgMsg').textContent = r.ok ? 'عملیات انجام شد.' : (r.data.error || 'خطا');
  loadAll();
}

async function saveConnections() {
  const r = await api('/api/connections', {
    method: 'POST',
    body: JSON.stringify({
      bot_token: document.getElementById('cBotToken').value,
      admin_ids: document.getElementById('cAdmins').value,
      support: document.getElementById('cSupport').value,
      required_channel_id: document.getElementById('cChannelId').value,
      required_channel_invite: document.getElementById('cChannelInv').value,
      cards: document.getElementById('cCards').value,
      panel_url: document.getElementById('cPanelUrl').value,
      panel_path: document.getElementById('cPanelPath').value,
      panel_api_token: document.getElementById('cPanelToken').value,
      sub_base_url: document.getElementById('cSubBase').value,
      proxy_host: document.getElementById('cProxyHost').value,
      proxy_port: document.getElementById('cProxyPort').value,
    })
  });
  document.getElementById('connMsg').textContent = r.ok ? 'تنظیمات در .env ذخیره و اعمال شد.' : (r.data.error || 'خطا');
}
async function testPanel() {
  const r = await api('/api/test-panel', { method: 'POST' });
  document.getElementById('connMsg').textContent = r.ok ? `اتصال به 3X-UI موفق (${r.data.count} اینباند)` : (r.data.error || 'خطا');
}
async function testBot() {
  const r = await api('/api/test-bot', { method: 'POST', body: JSON.stringify({ bot_token: document.getElementById('cBotToken').value }) });
  document.getElementById('botTestMsg').textContent = r.ok ? `ربات متصل: @${r.data.username}` : (r.data.error || 'خطا');
}
async function savePricing() {
  await api('/api/pricing', { method: 'POST', body: JSON.stringify({
    low: Number(document.getElementById('pLow').value),
    mid: Number(document.getElementById('pMid').value),
    high: Number(document.getElementById('pHigh').value),
    tier1_max: Number(document.getElementById('pT1').value),
    tier2_max: Number(document.getElementById('pT2').value),
  }) });
  document.getElementById('featMsg').textContent = 'تعرفه‌ها ذخیره شد.';
}
async function addPlan() {
  await api('/api/plans/add', { method: 'POST', body: JSON.stringify({
    name: document.getElementById('npName').value,
    gb: Number(document.getElementById('npGb').value || 30),
    price: Number(document.getElementById('npPrice').value || 0),
  }) });
  loadAll();
}
async function delPlan(id) { await api('/api/plans/delete', { method: 'POST', body: JSON.stringify({ id }) }); loadAll(); }
async function addDiscount() {
  await api('/api/discounts/add', { method: 'POST', body: JSON.stringify({
    code: document.getElementById('ndCode').value,
    percent: Number(document.getElementById('ndPct').value || 10),
    max_uses: Number(document.getElementById('ndMax').value || 50),
  }) });
  loadAll();
}
async function delDiscount(code) { await api('/api/discounts/delete', { method: 'POST', body: JSON.stringify({ code }) }); loadAll(); }
async function saveFeatures() {
  await api('/api/features', { method: 'POST', body: JSON.stringify({
    trial_enabled: document.getElementById('fTrial').checked,
    referral_enabled: document.getElementById('fRef').checked,
  }) });
  document.getElementById('featMsg').textContent = 'تنظیمات امکانات ربات ذخیره شد.';
}
async function sendBroadcast() {
  const text = document.getElementById('bcText').value.trim();
  if (!text) return;
  const r = await api('/api/broadcast', { method: 'POST', body: JSON.stringify({ message: text }) });
  document.getElementById('featMsg').textContent = r.ok ? `ارسال شد: ${r.data.sent} موفق` : (r.data.error || 'خطا');
  document.getElementById('bcText').value = '';
}
loadAll();
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
        users_cnt = (await (await conn.execute("SELECT COUNT(*) FROM users")).fetchone())[0]
        orders_cnt = (await (await conn.execute("SELECT COUNT(*) FROM orders")).fetchone())[0]
        revenue = (await (await conn.execute("SELECT COALESCE(SUM(amount_paid),0) FROM orders")).fetchone())[0]
        pending_cnt = (
            await (await conn.execute("SELECT COUNT(*) FROM pending_payments WHERE status='pending'")).fetchone()
        )[0]
        pending_rows = await (
            await conn.execute(
                "SELECT id, telegram_id, amount, purpose, meta, created_at "
                "FROM pending_payments WHERE status='pending' ORDER BY id DESC LIMIT 30"
            )
        ).fetchall()

    users_list = await db.list_users_with_stats()
    orders_list = await db.list_all_orders()
    pricing = await get_prices()
    sales_plans = await db.list_sales_plans()
    discounts = [dict(r) for r in await db.list_discount_codes()]
    settings = await db.get_all_settings()

    cards_raw = ",".join(f"{n}:{nm}" for n, nm in cfg.cards)
    return web.json_response(
        {
            "ok": True,
            "config": {
                "bot_token": cfg.bot_token,
                "admin_ids": cfg.admin_ids,
                "support": cfg.support,
                "required_channel_id": cfg.required_channel_id,
                "required_channel_invite": cfg.required_channel_invite,
                "cards_raw": cards_raw,
                "panel_url": cfg.panel_url,
                "panel_path": cfg.panel_path,
                "panel_api_token": cfg.panel_api_token,
                "sub_base_url": cfg.sub_base_url,
                "proxy_host": cfg.proxy_host,
                "proxy_port": cfg.proxy_port,
            },
            "inbounds": [{"id": i, "remark": r, "flow": f} for i, r, f in cfg.inbounds],
            "stats": {"users": users_cnt, "orders": orders_cnt, "revenue": revenue, "pending": pending_cnt},
            "users": users_list,
            "pending": [dict(r) for r in pending_rows],
            "orders": orders_list,
            "pricing": pricing,
            "sales_plans": sales_plans,
            "discounts": discounts,
            "features": {
                "trial_enabled": settings.get("trial_enabled", "1") == "1",
                "referral_enabled": settings.get("referral_enabled", "1") == "1",
            },
        }
    )


async def handle_connections(request: web.Request) -> web.Response:
    if not _is_authenticated(request):
        return web.json_response({"ok": False}, status=401)
    body = await request.json()
    updates = {
        "BOT_TOKEN": str(body.get("bot_token", cfg.bot_token)).strip(),
        "ADMIN_IDS": str(body.get("admin_ids", "")).strip(),
        "SUPPORT": str(body.get("support", cfg.support)).strip(),
        "REQUIRED_CHANNEL_ID": str(body.get("required_channel_id", "0")).strip() or "0",
        "REQUIRED_CHANNEL_INVITE": str(body.get("required_channel_invite", "")).strip(),
        "CARDS": str(body.get("cards", "")).strip(),
        "PANEL_URL": str(body.get("panel_url", cfg.panel_url)).strip().rstrip("/"),
        "PANEL_PATH": str(body.get("panel_path", cfg.panel_path)).strip().rstrip("/"),
        "PANEL_API_TOKEN": str(body.get("panel_api_token", cfg.panel_api_token)).strip(),
        "SUB_BASE_URL": str(body.get("sub_base_url", cfg.sub_base_url)).strip().rstrip("/"),
        "PROXY_HOST": str(body.get("proxy_host", "")).strip(),
        "PROXY_PORT": str(body.get("proxy_port", "")).strip(),
    }
    _update_env_file(updates)
    cfg.bot_token = updates["BOT_TOKEN"]
    cfg.admin_ids = _int_list(updates["ADMIN_IDS"])
    cfg.support = updates["SUPPORT"]
    cfg.required_channel_id = int(updates["REQUIRED_CHANNEL_ID"]) if updates["REQUIRED_CHANNEL_ID"].lstrip("-").isdigit() else 0
    cfg.required_channel_invite = updates["REQUIRED_CHANNEL_INVITE"]
    cfg.cards = _parse_cards(updates["CARDS"])
    cfg.panel_url = updates["PANEL_URL"]
    cfg.panel_path = updates["PANEL_PATH"]
    cfg.panel_api_token = updates["PANEL_API_TOKEN"]
    cfg.sub_base_url = updates["SUB_BASE_URL"]
    cfg.proxy_host = updates["PROXY_HOST"]
    cfg.proxy_port = updates["PROXY_PORT"]
    await panel.close()
    panel._p = cfg.panel_path
    return web.json_response({"ok": True})


async def handle_test_panel(request: web.Request) -> web.Response:
    if not _is_authenticated(request):
        return web.json_response({"ok": False}, status=401)
    try:
        inbounds = await panel.list_inbounds()
        return web.json_response({"ok": True, "count": len(inbounds)})
    except Exception as exc:
        return web.json_response({"ok": False, "error": str(exc)}, status=502)


async def handle_test_bot(request: web.Request) -> web.Response:
    if not _is_authenticated(request):
        return web.json_response({"ok": False}, status=401)
    if not _BOT_REF:
        return web.json_response({"ok": False, "error": "Bot instance not running"}, status=400)
    try:
        me = await _BOT_REF.get_me()
        return web.json_response({"ok": True, "username": me.username or me.first_name})
    except Exception as exc:
        return web.json_response({"ok": False, "error": str(exc)}, status=502)


async def handle_sync_inbounds(request: web.Request) -> web.Response:
    if not _is_authenticated(request):
        return web.json_response({"ok": False}, status=401)
    try:
        raw = await panel.list_inbounds()
        out = []
        for ib in raw:
            flow = "xtls-rprx-vision" if ib.get("protocol") == "vless" else ""
            out.append({"id": str(ib["id"]), "remark": ib.get("remark") or f"inbound-{ib['id']}", "flow": flow})
        return web.json_response({"ok": True, "inbounds": out})
    except Exception as exc:
        return web.json_response({"ok": False, "error": str(exc)}, status=502)


async def handle_save_inbounds(request: web.Request) -> web.Response:
    if not _is_authenticated(request):
        return web.json_response({"ok": False}, status=401)
    body = await request.json()
    items = body.get("inbounds") or []
    raw_str = ",".join(f"{x['id']}:{x['remark']}:{x.get('flow','')}" for x in items if str(x.get("id", "")).strip())
    _update_env_file({"INBOUNDS": raw_str, "INBOUND_ID": str(items[0]["id"]) if items else "1"})
    cfg.inbounds = _parse_inbounds(raw_str, str(cfg.inbound_id))
    return web.json_response({"ok": True})


async def handle_user_balance(request: web.Request) -> web.Response:
    if not _is_authenticated(request):
        return web.json_response({"ok": False}, status=401)
    body = await request.json()
    tg_id = int(body["telegram_id"])
    delta = int(body["delta"])
    await db.add_balance(tg_id, delta, "تغییر موجودی از وب‌پنل")
    return web.json_response({"ok": True})


async def handle_user_block(request: web.Request) -> web.Response:
    if not _is_authenticated(request):
        return web.json_response({"ok": False}, status=401)
    body = await request.json()
    await db.set_user_blocked(int(body["telegram_id"]), bool(body["blocked"]))
    return web.json_response({"ok": True})


async def handle_payment_action(request: web.Request) -> web.Response:
    if not _is_authenticated(request):
        return web.json_response({"ok": False}, status=401)
    action = request.match_info["action"]
    body = await request.json()
    pid = int(body["id"])
    payment = await db.get_pending_payment(pid)
    if not payment or payment["status"] != "pending":
        return web.json_response({"ok": False, "error": "Payment not pending"}, status=400)
    tg_id = payment["telegram_id"]
    amount = payment["amount"]

    if action == "reject":
        await db.update_payment_status(pid, "rejected")
        if _BOT_REF:
            try:
                await _BOT_REF.send_message(tg_id, "❌ پرداخت شما در وب‌پنل تایید نشد.")
            except Exception:
                pass
        return web.json_response({"ok": True})

    await db.update_payment_status(pid, "approved")
    purpose = payment["purpose"]
    meta = json.loads(payment["meta"] or "{}")
    if purpose == "wallet":
        new_bal = await db.add_balance(tg_id, amount, "شارژ کیف پول (تایید وب‌پنل)")
        if await db.get_setting("referral_enabled", "1") == "1":
            inviter = await db.get_unpaid_inviter(tg_id)
            if inviter:
                bonus = int(amount * cfg.referral_percent / 100)
                if bonus > 0:
                    await db.add_balance(inviter, bonus, f"پاداش دعوت از {tg_id}")
                    await db.mark_referral_bonus_paid(tg_id)
        if _BOT_REF:
            try:
                await _BOT_REF.send_message(tg_id, f"✅ پرداخت تایید شد! موجودی: {new_bal:,} تومان")
            except Exception:
                pass
    elif purpose == "purchase":
        email, sub_id = await panel.create_client(
            gb=meta.get("gb", 30),
            days=30,
            email=meta.get("service_name", ""),
            inbound_ids=[int(meta["inbound_id"])] if meta.get("inbound_id") else None,
            flow=meta.get("flow"),
        )
        await db.create_order(tg_id, email, meta.get("gb", 30), amount, "new")
        if _BOT_REF:
            try:
                await _BOT_REF.send_message(tg_id, f"🎉 سرویس {email} آماده است!\n{panel.sub_url(sub_id)}")
            except Exception:
                pass
    elif purpose == "renew":
        email = meta["client_email"]
        gb = meta.get("gb", 20)
        await panel.renew_client(email, gb)
        await db.create_order(tg_id, email, gb, amount, "renew")
    return web.json_response({"ok": True})


async def handle_config_create(request: web.Request) -> web.Response:
    if not _is_authenticated(request):
        return web.json_response({"ok": False}, status=401)
    body = await request.json()
    try:
        email, sub_id = await panel.create_client(
            gb=float(body.get("gb", 30)),
            days=int(body.get("days", 30)),
            email=str(body.get("email", "")).strip(),
        )
        tg_id = int(body.get("telegram_id") or 0)
        await db.create_order(tg_id, email, int(body.get("gb", 30)), 0, "new")
        return web.json_response({"ok": True, "email": email, "sub_url": panel.sub_url(sub_id)})
    except Exception as exc:
        return web.json_response({"ok": False, "error": str(exc)}, status=502)


async def handle_config_op(request: web.Request) -> web.Response:
    if not _is_authenticated(request):
        return web.json_response({"ok": False}, status=401)
    op = request.match_info["op"]
    body = await request.json()
    email = str(body.get("email", "")).strip()
    try:
        if op == "renew":
            await panel.renew_client(email, int(body.get("add_gb", 20)))
        elif op == "rotate":
            await panel.change_link(email)
        elif op == "delete":
            await panel.delete_client(email)
            await db.delete_order_by_email(email)
        return web.json_response({"ok": True})
    except Exception as exc:
        return web.json_response({"ok": False, "error": str(exc)}, status=502)


async def handle_pricing(request: web.Request) -> web.Response:
    if not _is_authenticated(request):
        return web.json_response({"ok": False}, status=401)
    body = await request.json()
    for k, dbk in [("low", "price_low"), ("mid", "price_mid"), ("high", "price_high"), ("tier1_max", "price_tier1_max"), ("tier2_max", "price_tier2_max")]:
        if k in body:
            await db.set_setting(dbk, str(int(body[k])))
    return web.json_response({"ok": True})


async def handle_plans(request: web.Request) -> web.Response:
    if not _is_authenticated(request):
        return web.json_response({"ok": False}, status=401)
    op = request.match_info["op"]
    body = await request.json()
    if op == "add":
        pid = f"plan-{int(asyncio.get_event_loop().time() * 1000)}"
        await db.upsert_sales_plan(pid, str(body["name"]), int(body["gb"]), 30, int(body["price"]), cfg.inbound_id, True)
    elif op == "delete":
        await db.delete_sales_plan(str(body["id"]))
    return web.json_response({"ok": True})


async def handle_discounts(request: web.Request) -> web.Response:
    if not _is_authenticated(request):
        return web.json_response({"ok": False}, status=401)
    op = request.match_info["op"]
    body = await request.json()
    if op == "add":
        await db.create_discount_code(str(body["code"]), int(body["percent"]), int(body["max_uses"]))
    elif op == "delete":
        await db.delete_discount_code(str(body["code"]))
    return web.json_response({"ok": True})


async def handle_features(request: web.Request) -> web.Response:
    if not _is_authenticated(request):
        return web.json_response({"ok": False}, status=401)
    body = await request.json()
    await db.set_setting("trial_enabled", "1" if body.get("trial_enabled") else "0")
    await db.set_setting("referral_enabled", "1" if body.get("referral_enabled") else "0")
    return web.json_response({"ok": True})


async def handle_broadcast(request: web.Request) -> web.Response:
    if not _is_authenticated(request):
        return web.json_response({"ok": False}, status=401)
    if not _BOT_REF:
        return web.json_response({"ok": False, "error": "Bot not attached"}, status=400)
    body = await request.json()
    text = str(body.get("message", "")).strip()
    user_ids = await db.get_all_user_ids()
    sent = 0
    for uid in user_ids:
        try:
            await _BOT_REF.send_message(uid, text)
            sent += 1
        except Exception:
            pass
        await asyncio.sleep(0.05)
    async with aiosqlite.connect(cfg.db_path) as conn:
        await conn.execute("INSERT INTO broadcast_log(message, sent_count) VALUES(?,?)", (text, sent))
        await conn.commit()
    return web.json_response({"ok": True, "sent": sent})


async def handle_health(_request: web.Request) -> web.Response:
    panel_ok = False
    try:
        await panel.list_inbounds()
        panel_ok = True
    except Exception:
        panel_ok = False
    return web.json_response({"ok": True, "panel_connected": panel_ok, "db": cfg.db_path})


async def start_web_panel(bot: Any = None) -> Optional[web.AppRunner]:
    global _BOT_REF
    _BOT_REF = bot
    if not cfg.web_panel_enabled:
        return None
    app = web.Application()
    app.router.add_get("/", handle_index)
    app.router.add_post("/api/login", handle_login)
    app.router.add_get("/api/overview", handle_overview)
    app.router.add_post("/api/connections", handle_connections)
    app.router.add_post("/api/test-panel", handle_test_panel)
    app.router.add_post("/api/test-bot", handle_test_bot)
    app.router.add_post("/api/inbounds/sync", handle_sync_inbounds)
    app.router.add_post("/api/inbounds/save", handle_save_inbounds)
    app.router.add_post("/api/users/balance", handle_user_balance)
    app.router.add_post("/api/users/block", handle_user_block)
    app.router.add_post("/api/payments/{action}", handle_payment_action)
    app.router.add_post("/api/configs/create", handle_config_create)
    app.router.add_post("/api/configs/{op}", handle_config_op)
    app.router.add_post("/api/pricing", handle_pricing)
    app.router.add_post("/api/plans/{op}", handle_plans)
    app.router.add_post("/api/discounts/{op}", handle_discounts)
    app.router.add_post("/api/features", handle_features)
    app.router.add_post("/api/broadcast", handle_broadcast)
    app.router.add_get("/api/health", handle_health)

    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, cfg.web_panel_host, cfg.web_panel_port)
    await site.start()
    logger.info("Web panel running at http://%s:%s", cfg.web_panel_host, cfg.web_panel_port)
    return runner
