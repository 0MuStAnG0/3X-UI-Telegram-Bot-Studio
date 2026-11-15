import React, { useState } from 'react';
import { Check, Copy, Plus, QrCode, RefreshCw, Send, Trash2, X } from 'lucide-react';
import {
  VpnConfigOrder,
  WebPanelState,
  buildSubUrl,
  calculateTieredPrice,
} from '../utils/webPanelEngine';
import { QrMatrix } from './QrMatrix';

interface PlansConfigsViewProps {
  state: WebPanelState;
  onUpdateState: (updater: (prev: WebPanelState) => WebPanelState) => void;
  onSaveState: (next?: WebPanelState) => Promise<void>;
}

export function PlansConfigsView({ state, onUpdateState, onSaveState }: PlansConfigsViewProps) {
  const [selectedOrderQr, setSelectedOrderQr] = useState<VpnConfigOrder | null>(null);
  const [copiedSub, setCopiedSub] = useState(false);
  const [opFeedback, setOpFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  const [newCfg, setNewCfg] = useState({
    telegramId: String(state.users[0]?.telegramId ?? 9001001),
    inboundId: String(state.inbounds[0]?.id ?? 1),
    clientEmail: '',
    gb: '30',
    days: '30',
    deductWallet: false,
  });

  const [newPlan, setNewPlan] = useState({
    name: '',
    gb: '30',
    days: '30',
    price: '225000',
    inboundId: String(state.inbounds[0]?.id ?? 1),
  });

  const [newDiscount, setNewDiscount] = useState({ code: '', percent: '20', maxUses: '50' });
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [broadcastAudience, setBroadcastAudience] = useState<'all' | 'active_buyers'>('all');
  const [sendingBroadcast, setSendingBroadcast] = useState(false);

  const commitState = (next: WebPanelState) => {
    onUpdateState(() => next);
    void onSaveState(next);
  };

  const handleCreateConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setOpFeedback(null);
    try {
      const res = await fetch('/api/panel/clients/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegramId: Number(newCfg.telegramId),
          inboundId: Number(newCfg.inboundId),
          clientEmail: newCfg.clientEmail.trim(),
          gb: Number(newCfg.gb),
          days: Number(newCfg.days),
          deductWallet: newCfg.deductWallet,
        }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        error?: string;
        panelMessage?: string;
        state?: WebPanelState;
        order?: VpnConfigOrder;
      };
      if (!res.ok || !data.ok || !data.state) {
        setOpFeedback({ ok: false, msg: data.error || 'خطا در ساخت کانفیگ' });
        return;
      }
      onUpdateState(() => data.state!);
      if (data.order) setSelectedOrderQr(data.order);
      setNewCfg((p) => ({ ...p, clientEmail: '' }));
      setOpFeedback({ ok: true, msg: data.panelMessage || 'کانفیگ جدید ساخته شد.' });
    } catch {
      setOpFeedback({ ok: false, msg: 'خطا در ارتباط با سرور برای ساخت کانفیگ.' });
    }
  };

  const handleRenewOrder = async (clientEmail: string) => {
    try {
      const res = await fetch('/api/panel/clients/renew', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientEmail, addGb: 20, addDays: 30 }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string; state?: WebPanelState };
      if (!res.ok || !data.ok || !data.state) {
        setOpFeedback({ ok: false, msg: data.error || 'خطا در تمدید کانفیگ' });
        return;
      }
      onUpdateState(() => data.state!);
      setOpFeedback({ ok: true, msg: `سرویس ${clientEmail} با +۲۰ گیگ و ۳۰ روز تمدید شد.` });
    } catch {
      setOpFeedback({ ok: false, msg: 'خطا در تمدید سرویس.' });
    }
  };

  const handleRotateLink = async (clientEmail: string) => {
    try {
      const res = await fetch('/api/panel/clients/rotate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientEmail }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string; state?: WebPanelState };
      if (!res.ok || !data.ok || !data.state) {
        setOpFeedback({ ok: false, msg: data.error || 'خطا در تغییر لینک اشتراک' });
        return;
      }
      onUpdateState(() => data.state!);
      setOpFeedback({ ok: true, msg: `لینک اتصال سرویس ${clientEmail} چرخانده شد.` });
    } catch {
      setOpFeedback({ ok: false, msg: 'خطا در تغییر لینک.' });
    }
  };

  const handleDeleteOrder = async (clientEmail: string) => {
    try {
      const res = await fetch(`/api/panel/clients/${encodeURIComponent(clientEmail)}`, {
        method: 'DELETE',
      });
      const data = (await res.json()) as { ok: boolean; error?: string; state?: WebPanelState };
      if (!res.ok || !data.ok || !data.state) {
        setOpFeedback({ ok: false, msg: data.error || 'خطا در حذف سرویس' });
        return;
      }
      onUpdateState(() => data.state!);
      if (selectedOrderQr?.clientEmail === clientEmail) setSelectedOrderQr(null);
      setOpFeedback({ ok: true, msg: `سرویس ${clientEmail} حذف شد.` });
    } catch {
      setOpFeedback({ ok: false, msg: 'خطا در حذف سرویس.' });
    }
  };

  const handleAddPlan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlan.name.trim()) return;
    const next: WebPanelState = {
      ...state,
      salesPlans: [
        ...state.salesPlans,
        {
          id: `plan-${Date.now()}`,
          name: newPlan.name.trim(),
          gb: Number(newPlan.gb) || 30,
          days: Number(newPlan.days) || 30,
          price: Number(newPlan.price) || 0,
          inboundId: Number(newPlan.inboundId) || 1,
          active: true,
        },
      ],
    };
    commitState(next);
    setNewPlan((p) => ({ ...p, name: '' }));
  };

  const handleAddDiscount = (e: React.FormEvent) => {
    e.preventDefault();
    const code = newDiscount.code.trim().toUpperCase();
    if (!code) return;
    const filtered = state.discountCodes.filter((d) => d.code !== code);
    const next: WebPanelState = {
      ...state,
      discountCodes: [
        {
          code,
          percent: Math.min(100, Math.max(1, Number(newDiscount.percent) || 10)),
          maxUses: Math.max(1, Number(newDiscount.maxUses) || 1),
          usedCount: 0,
        },
        ...filtered,
      ],
    };
    commitState(next);
    setNewDiscount({ code: '', percent: '20', maxUses: '50' });
  };

  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastMsg.trim()) return;
    setSendingBroadcast(true);
    try {
      const res = await fetch('/api/bot/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: broadcastMsg, audience: broadcastAudience }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        error?: string;
        state?: WebPanelState;
        entry?: { sentCount: number };
      };
      if (res.ok && data.ok && data.state) {
        onUpdateState(() => data.state!);
        setBroadcastMsg('');
        setOpFeedback({
          ok: true,
          msg: `پیام همگانی برای ${data.entry?.sentCount ?? 0} کاربر ثبت و ارسال شد.`,
        });
      } else {
        setOpFeedback({ ok: false, msg: data.error || 'خطا در ارسال پیام همگانی' });
      }
    } finally {
      setSendingBroadcast(false);
    }
  };

  const preview30Gb = calculateTieredPrice(30, state.pricing);

  return (
    <div className="space-y-8">
      <div className="border-b border-slate-200 pb-5">
        <h1 className="text-2xl font-bold text-slate-900">
          پلن‌های فروش، کانفیگ‌ها و امکانات مدیریتی ربات
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          مدیریت مستقیم کانفیگ‌های کاربران روی 3X-UI، بسته‌های فروش و قیمت‌گذاری پلکانی، کدهای تخفیف، تست رایگان، سیستم دعوت، یادآور و پیام همگانی.
        </p>
      </div>

      {opFeedback && (
        <div
          className={`px-4 py-3 rounded-xl border text-xs font-medium flex items-center justify-between gap-2 ${
            opFeedback.ok
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <span>{opFeedback.msg}</span>
          <button type="button" onClick={() => setOpFeedback(null)} className="p-0.5">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 1. VPN Configs Management & Creation */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-5">
        <div>
          <h2 className="text-base font-semibold text-slate-900">۱. ساخت و مدیریت کانفیگ‌ها (Orders / Clients)</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            ساخت مستقیم کانفیگ، تمدید حجم و زمان، تغییر لینک اشتراک و نمایش QR Code
          </p>
        </div>

        <form onSubmit={handleCreateConfig} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end bg-slate-50 p-4 rounded-xl border border-slate-200">
          <div className="sm:col-span-2">
            <label htmlFor="cfg-owner" className="block text-xs font-medium text-slate-700 mb-1">
              کاربر مالک
            </label>
            <select
              id="cfg-owner"
              value={newCfg.telegramId}
              onChange={(e) => setNewCfg((p) => ({ ...p, telegramId: e.target.value }))}
              className="w-full px-2.5 py-2 text-xs bg-white border border-slate-200 rounded-lg"
            >
              {state.users.map((u) => (
                <option key={u.telegramId} value={u.telegramId}>
                  {u.fullName} ({u.telegramId})
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-3">
            <label htmlFor="cfg-inbound" className="block text-xs font-medium text-slate-700 mb-1">
              اینباند مقصد
            </label>
            <select
              id="cfg-inbound"
              value={newCfg.inboundId}
              onChange={(e) => setNewCfg((p) => ({ ...p, inboundId: e.target.value }))}
              className="w-full px-2.5 py-2 text-xs bg-white border border-slate-200 rounded-lg"
            >
              {state.inbounds.map((ib) => (
                <option key={ib.id} value={ib.id}>
                  #{ib.id} · {ib.remark}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-3">
            <label htmlFor="cfg-email" className="block text-xs font-medium text-slate-700 mb-1">
              نام کانفیگ (انگلیسی)
            </label>
            <input
              id="cfg-email"
              type="text"
              required
              dir="ltr"
              placeholder="ali.mobile"
              value={newCfg.clientEmail}
              onChange={(e) => setNewCfg((p) => ({ ...p, clientEmail: e.target.value }))}
              className="w-full px-2.5 py-2 text-xs font-mono bg-white border border-slate-200 rounded-lg"
            />
          </div>
          <div className="sm:col-span-1">
            <label htmlFor="cfg-gb" className="block text-xs font-medium text-slate-700 mb-1">
              حجم (GB)
            </label>
            <input
              id="cfg-gb"
              type="number"
              min={1}
              required
              dir="ltr"
              value={newCfg.gb}
              onChange={(e) => setNewCfg((p) => ({ ...p, gb: e.target.value }))}
              className="w-full px-2 py-2 text-xs font-mono bg-white border border-slate-200 rounded-lg tabular-nums"
            />
          </div>
          <div className="sm:col-span-1">
            <label htmlFor="cfg-days" className="block text-xs font-medium text-slate-700 mb-1">
              روز
            </label>
            <input
              id="cfg-days"
              type="number"
              min={1}
              required
              dir="ltr"
              value={newCfg.days}
              onChange={(e) => setNewCfg((p) => ({ ...p, days: e.target.value }))}
              className="w-full px-2 py-2 text-xs font-mono bg-white border border-slate-200 rounded-lg tabular-nums"
            />
          </div>
          <div className="sm:col-span-2 flex flex-col gap-1.5">
            <label className="inline-flex items-center gap-1.5 text-[11px] text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={newCfg.deductWallet}
                onChange={(e) => setNewCfg((p) => ({ ...p, deductWallet: e.target.checked }))}
                className="accent-teal-700"
              />
              <span>کسر از کیف پول</span>
            </label>
            <button
              type="submit"
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium bg-teal-700 hover:bg-teal-800 text-white rounded-lg"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              <span>ساخت کانفیگ</span>
            </button>
          </div>
        </form>

        <div className="overflow-x-auto">
          <table className="w-full text-xs sm:text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500">
                <th className="px-3 py-2.5 text-right font-medium">نام کانفیگ</th>
                <th className="px-3 py-2.5 text-right font-medium">کاربر</th>
                <th className="px-3 py-2.5 text-right font-medium">اینباند</th>
                <th className="px-3 py-2.5 text-right font-medium">مصرف / حجم</th>
                <th className="px-3 py-2.5 text-right font-medium">اعتبار</th>
                <th className="px-3 py-2.5 text-left font-medium">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {state.orders.map((ord) => (
                <tr key={ord.id} className="hover:bg-slate-50/70">
                  <td className="px-3 py-3 font-mono font-semibold text-slate-900" dir="ltr">
                    {ord.clientEmail}
                  </td>
                  <td className="px-3 py-3 font-mono text-slate-600 tabular-nums" dir="ltr">
                    {ord.telegramId}
                  </td>
                  <td className="px-3 py-3 text-xs text-slate-700">{ord.inboundRemark}</td>
                  <td className="px-3 py-3 font-mono text-xs text-slate-700 tabular-nums" dir="ltr">
                    {ord.usedGb} / {ord.gb} GB
                  </td>
                  <td className="px-3 py-3 text-xs text-slate-700 tabular-nums">{ord.daysLeft} روز</td>
                  <td className="px-3 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleRenewOrder(ord.clientEmail)}
                        className="px-2 py-1 text-xs font-medium bg-teal-50 hover:bg-teal-100 text-teal-800 rounded"
                      >
                        +۲۰GB تمدید
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRotateLink(ord.clientEmail)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-800 rounded"
                      >
                        <RefreshCw className="w-3 h-3" aria-hidden="true" />
                        <span>تغییر لینک</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedOrderQr(ord)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-slate-900 hover:bg-slate-800 text-white rounded"
                      >
                        <QrCode className="w-3 h-3" aria-hidden="true" />
                        <span>QR / لینک</span>
                      </button>
                      <button
                        type="button"
                        aria-label={`حذف کانفیگ ${ord.clientEmail}`}
                        onClick={() => handleDeleteOrder(ord.clientEmail)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded"
                      >
                        <Trash2 className="w-4 h-4" aria-hidden="true" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {selectedOrderQr && (
          <div className="p-4 bg-slate-900 text-slate-100 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="space-y-2 flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">
                  لینک اشتراک و QR سرویس <code className="font-mono text-teal-300">{selectedOrderQr.clientEmail}</code>
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedOrderQr(null)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-2.5 bg-slate-950 rounded-lg font-mono text-xs text-emerald-300 break-all" dir="ltr">
                {buildSubUrl(state.panel.subBaseUrl, selectedOrderQr.subId)}
              </div>
              <button
                type="button"
                onClick={async () => {
                  await navigator.clipboard.writeText(buildSubUrl(state.panel.subBaseUrl, selectedOrderQr.subId));
                  setCopiedSub(true);
                  setTimeout(() => setCopiedSub(false), 1800);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-teal-700 hover:bg-teal-600 text-white rounded-md"
              >
                {copiedSub ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedSub ? 'لینک کپی شد' : 'کپی لینک اشتراک'}</span>
              </button>
            </div>
            <QrMatrix value={buildSubUrl(state.panel.subBaseUrl, selectedOrderQr.subId)} />
          </div>
        )}
      </section>

      {/* 2. Sales Plans & Tiered Pricing */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <section className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <h2 className="text-base font-semibold text-slate-900">۲. تعرفه پلکانی فروش حجم (هر گیگابایت)</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="pr-low" className="block text-xs font-medium text-slate-700 mb-1">
                پله اول (کمتر از {state.pricing.tier1Max}G)
              </label>
              <input
                id="pr-low"
                type="number"
                dir="ltr"
                value={state.pricing.low}
                onChange={(e) =>
                  onUpdateState((p) => ({
                    ...p,
                    pricing: { ...p.pricing, low: Number(e.target.value) || 0 },
                  }))
                }
                className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg tabular-nums"
              />
            </div>
            <div>
              <label htmlFor="pr-mid" className="block text-xs font-medium text-slate-700 mb-1">
                پله دوم ({state.pricing.tier1Max} تا {state.pricing.tier2Max}G)
              </label>
              <input
                id="pr-mid"
                type="number"
                dir="ltr"
                value={state.pricing.mid}
                onChange={(e) =>
                  onUpdateState((p) => ({
                    ...p,
                    pricing: { ...p.pricing, mid: Number(e.target.value) || 0 },
                  }))
                }
                className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg tabular-nums"
              />
            </div>
            <div>
              <label htmlFor="pr-high" className="block text-xs font-medium text-slate-700 mb-1">
                پله سوم (بالای {state.pricing.tier2Max}G)
              </label>
              <input
                id="pr-high"
                type="number"
                dir="ltr"
                value={state.pricing.high}
                onChange={(e) =>
                  onUpdateState((p) => ({
                    ...p,
                    pricing: { ...p.pricing, high: Number(e.target.value) || 0 },
                  }))
                }
                className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg tabular-nums"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="pr-t1" className="block text-xs font-medium text-slate-700 mb-1">
                  مرز ۱ (GB)
                </label>
                <input
                  id="pr-t1"
                  type="number"
                  dir="ltr"
                  value={state.pricing.tier1Max}
                  onChange={(e) =>
                    onUpdateState((p) => ({
                      ...p,
                      pricing: { ...p.pricing, tier1Max: Number(e.target.value) || 1 },
                    }))
                  }
                  className="w-full px-2 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg tabular-nums"
                />
              </div>
              <div>
                <label htmlFor="pr-t2" className="block text-xs font-medium text-slate-700 mb-1">
                  مرز ۲ (GB)
                </label>
                <input
                  id="pr-t2"
                  type="number"
                  dir="ltr"
                  value={state.pricing.tier2Max}
                  onChange={(e) =>
                    onUpdateState((p) => ({
                      ...p,
                      pricing: { ...p.pricing, tier2Max: Number(e.target.value) || 1 },
                    }))
                  }
                  className="w-full px-2 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg tabular-nums"
                />
              </div>
            </div>
          </div>
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 tabular-nums">
            نمونه قیمت ۳۰ گیگابایت: <strong className="text-slate-900">{preview30Gb.total.toLocaleString('fa-IR')} تومان</strong> ({preview30Gb.perGb.toLocaleString('fa-IR')} تومان/گیگ)
          </div>
        </section>

        <section className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <h2 className="text-base font-semibold text-slate-900">بسته‌ها و پلن‌های آماده فروش</h2>
          <div className="space-y-2">
            {state.salesPlans.map((plan) => (
              <div
                key={plan.id}
                className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs"
              >
                <div>
                  <span className="font-semibold text-slate-900">{plan.name}</span>
                  <span className="text-slate-500 mr-2 tabular-nums">
                    {plan.gb} GB · {plan.days} روز · {plan.price.toLocaleString('fa-IR')} تومان
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      commitState({
                        ...state,
                        salesPlans: state.salesPlans.map((pl) =>
                          pl.id === plan.id ? { ...pl, active: !pl.active } : pl
                        ),
                      })
                    }
                    className={`px-2 py-1 rounded text-[11px] font-medium ${
                      plan.active ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {plan.active ? 'فعال' : 'غیرفعال'}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      commitState({
                        ...state,
                        salesPlans: state.salesPlans.filter((pl) => pl.id !== plan.id),
                      })
                    }
                    className="p-1 text-slate-400 hover:text-rose-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <form onSubmit={handleAddPlan} className="grid grid-cols-1 sm:grid-cols-12 gap-2 pt-2 border-t border-slate-100">
            <input
              type="text"
              required
              placeholder="نام پلن (مثلاً ویژه ۳۰ گیگ)"
              value={newPlan.name}
              onChange={(e) => setNewPlan((p) => ({ ...p, name: e.target.value }))}
              className="sm:col-span-4 px-2.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg"
            />
            <input
              type="number"
              min={1}
              dir="ltr"
              placeholder="GB"
              value={newPlan.gb}
              onChange={(e) => setNewPlan((p) => ({ ...p, gb: e.target.value }))}
              className="sm:col-span-2 px-2 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg tabular-nums"
            />
            <input
              type="number"
              min={1}
              dir="ltr"
              placeholder="روز"
              value={newPlan.days}
              onChange={(e) => setNewPlan((p) => ({ ...p, days: e.target.value }))}
              className="sm:col-span-2 px-2 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg tabular-nums"
            />
            <input
              type="number"
              min={0}
              dir="ltr"
              placeholder="قیمت (تومان)"
              value={newPlan.price}
              onChange={(e) => setNewPlan((p) => ({ ...p, price: e.target.value }))}
              className="sm:col-span-2 px-2 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg tabular-nums"
            />
            <button
              type="submit"
              className="sm:col-span-2 px-3 py-2 text-xs font-medium bg-slate-900 hover:bg-slate-800 text-white rounded-lg"
            >
              افزودن پلن
            </button>
          </form>
        </section>
      </div>

      {/* 3. Bot Features brought into Web Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <section className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <h2 className="text-base font-semibold text-slate-900">۳. کدهای تخفیف</h2>
          <div className="space-y-2">
            {state.discountCodes.map((dc) => (
              <div
                key={dc.code}
                className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
              >
                <div className="flex items-center gap-3">
                  <code className="font-mono font-bold text-teal-800">{dc.code}</code>
                  <span className="tabular-nums text-slate-700">{dc.percent}٪ تخفیف</span>
                  <span className="tabular-nums text-slate-500">
                    ({dc.usedCount}/{dc.maxUses} مصرف)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    commitState({
                      ...state,
                      discountCodes: state.discountCodes.filter((d) => d.code !== dc.code),
                    })
                  }
                  className="p-1 text-slate-400 hover:text-rose-600"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
          <form onSubmit={handleAddDiscount} className="grid grid-cols-12 gap-2 pt-2 border-t border-slate-100">
            <input
              type="text"
              dir="ltr"
              required
              placeholder="CODE"
              value={newDiscount.code}
              onChange={(e) => setNewDiscount((p) => ({ ...p, code: e.target.value }))}
              className="col-span-5 px-2.5 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg uppercase"
            />
            <input
              type="number"
              min={1}
              max={100}
              dir="ltr"
              placeholder="٪"
              value={newDiscount.percent}
              onChange={(e) => setNewDiscount((p) => ({ ...p, percent: e.target.value }))}
              className="col-span-2 px-2 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg tabular-nums"
            />
            <input
              type="number"
              min={1}
              dir="ltr"
              placeholder="تعداد"
              value={newDiscount.maxUses}
              onChange={(e) => setNewDiscount((p) => ({ ...p, maxUses: e.target.value }))}
              className="col-span-2 px-2 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg tabular-nums"
            />
            <button
              type="submit"
              className="col-span-3 px-2 py-2 text-xs font-medium bg-slate-900 hover:bg-slate-800 text-white rounded-lg"
            >
              ساخت کد
            </button>
          </form>
        </section>

        <section className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5 space-y-5">
          <h2 className="text-base font-semibold text-slate-900">۴. امکانات هوشمند ربات (تست رایگان، دعوت و یادآور)</h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2.5">
              <label className="flex items-center justify-between text-xs font-semibold text-slate-900 cursor-pointer">
                <span>تست رایگان</span>
                <input
                  type="checkbox"
                  checked={state.features.trialEnabled}
                  onChange={(e) =>
                    onUpdateState((p) => ({
                      ...p,
                      features: { ...p.features, trialEnabled: e.target.checked },
                    }))
                  }
                  className="w-4 h-4 accent-teal-700"
                />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="block text-[11px] text-slate-500 mb-1">حجم (GB)</span>
                  <input
                    type="number"
                    step="0.1"
                    dir="ltr"
                    value={state.features.trialGb}
                    onChange={(e) =>
                      onUpdateState((p) => ({
                        ...p,
                        features: { ...p.features, trialGb: Number(e.target.value) || 0.5 },
                      }))
                    }
                    className="w-full px-2 py-1 text-xs font-mono bg-white border border-slate-200 rounded tabular-nums"
                  />
                </div>
                <div>
                  <span className="block text-[11px] text-slate-500 mb-1">مدت (روز)</span>
                  <input
                    type="number"
                    dir="ltr"
                    value={state.features.trialDays}
                    onChange={(e) =>
                      onUpdateState((p) => ({
                        ...p,
                        features: { ...p.features, trialDays: Number(e.target.value) || 1 },
                      }))
                    }
                    className="w-full px-2 py-1 text-xs font-mono bg-white border border-slate-200 rounded tabular-nums"
                  />
                </div>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2.5">
              <label className="flex items-center justify-between text-xs font-semibold text-slate-900 cursor-pointer">
                <span>سیستم دعوت دوستان</span>
                <input
                  type="checkbox"
                  checked={state.features.referralEnabled}
                  onChange={(e) =>
                    onUpdateState((p) => ({
                      ...p,
                      features: { ...p.features, referralEnabled: e.target.checked },
                    }))
                  }
                  className="w-4 h-4 accent-teal-700"
                />
              </label>
              <div>
                <span className="block text-[11px] text-slate-500 mb-1">درصد پاداش شارژ اول (٪)</span>
                <input
                  type="number"
                  min={0}
                  max={50}
                  dir="ltr"
                  value={state.features.referralPercent}
                  onChange={(e) =>
                    onUpdateState((p) => ({
                      ...p,
                      features: { ...p.features, referralPercent: Number(e.target.value) || 0 },
                    }))
                  }
                  className="w-full px-2 py-1 text-xs font-mono bg-white border border-slate-200 rounded tabular-nums"
                />
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2.5">
              <label className="flex items-center justify-between text-xs font-semibold text-slate-900 cursor-pointer">
                <span>یادآور انقضا و حجم</span>
                <input
                  type="checkbox"
                  checked={state.features.reminderEnabled}
                  onChange={(e) =>
                    onUpdateState((p) => ({
                      ...p,
                      features: { ...p.features, reminderEnabled: e.target.checked },
                    }))
                  }
                  className="w-4 h-4 accent-teal-700"
                />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="block text-[11px] text-slate-500 mb-1">آستانه GB</span>
                  <input
                    type="number"
                    dir="ltr"
                    value={state.features.reminderGbThreshold}
                    onChange={(e) =>
                      onUpdateState((p) => ({
                        ...p,
                        features: { ...p.features, reminderGbThreshold: Number(e.target.value) || 1 },
                      }))
                    }
                    className="w-full px-2 py-1 text-xs font-mono bg-white border border-slate-200 rounded tabular-nums"
                  />
                </div>
                <div>
                  <span className="block text-[11px] text-slate-500 mb-1">آستانه روز</span>
                  <input
                    type="number"
                    dir="ltr"
                    value={state.features.reminderDaysThreshold}
                    onChange={(e) =>
                      onUpdateState((p) => ({
                        ...p,
                        features: { ...p.features, reminderDaysThreshold: Number(e.target.value) || 1 },
                      }))
                    }
                    className="w-full px-2 py-1 text-xs font-mono bg-white border border-slate-200 rounded tabular-nums"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* 5. Broadcast & Tutorials */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <section className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <h2 className="text-base font-semibold text-slate-900">ارسال پیام همگانی به کاربران ربات</h2>
          <form onSubmit={handleSendBroadcast} className="space-y-3">
            <div className="flex items-center gap-3">
              <label className="text-xs text-slate-600">مخاطبان:</label>
              <select
                value={broadcastAudience}
                onChange={(e) => setBroadcastAudience(e.target.value as 'all' | 'active_buyers')}
                className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg"
              >
                <option value="all">همه کاربران فعال</option>
                <option value="active_buyers">دارندگان سرویس فعال</option>
              </select>
            </div>
            <textarea
              rows={3}
              value={broadcastMsg}
              onChange={(e) => setBroadcastMsg(e.target.value)}
              placeholder="متن پیام همگانی برای ارسال از طریق ربات تلگرام..."
              className="w-full p-3 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-600"
            />
            <button
              type="submit"
              disabled={sendingBroadcast || !broadcastMsg.trim()}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium bg-teal-700 hover:bg-teal-800 disabled:opacity-60 text-white rounded-lg"
            >
              <Send className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{sendingBroadcast ? 'در حال ارسال...' : 'ارسال پیام همگانی'}</span>
            </button>
          </form>

          {state.broadcastLogs.length > 0 && (
            <div className="pt-3 border-t border-slate-100 space-y-2">
              <div className="text-xs font-semibold text-slate-600">آخرین پیام‌های ارسالی</div>
              {state.broadcastLogs.slice(0, 4).map((b) => (
                <div key={b.id} className="p-2.5 bg-slate-50 rounded-lg text-xs flex items-center justify-between gap-2">
                  <span className="truncate text-slate-700">{b.message}</span>
                  <span className="text-slate-500 shrink-0 tabular-nums">
                    {b.sentCount} موفق · {b.createdAt}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <h2 className="text-base font-semibold text-slate-900">متن‌های آموزش اتصال در ربات</h2>
          <div className="space-y-3">
            <div>
              <label htmlFor="tut-and" className="block text-xs font-medium text-slate-700 mb-1">
                آموزش اندروید (V2rayNG / Hiddify)
              </label>
              <textarea
                id="tut-and"
                rows={2}
                value={state.features.tutorials.android}
                onChange={(e) =>
                  onUpdateState((p) => ({
                    ...p,
                    features: {
                      ...p.features,
                      tutorials: { ...p.features.tutorials, android: e.target.value },
                    },
                  }))
                }
                className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label htmlFor="tut-ios" className="block text-xs font-medium text-slate-700 mb-1">
                آموزش آیفون (Streisand / Hiddify)
              </label>
              <textarea
                id="tut-ios"
                rows={2}
                value={state.features.tutorials.ios}
                onChange={(e) =>
                  onUpdateState((p) => ({
                    ...p,
                    features: {
                      ...p.features,
                      tutorials: { ...p.features.tutorials, ios: e.target.value },
                    },
                  }))
                }
                className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label htmlFor="tut-win" className="block text-xs font-medium text-slate-700 mb-1">
                آموزش ویندوز (V2rayN / Hiddify)
              </label>
              <textarea
                id="tut-win"
                rows={2}
                value={state.features.tutorials.windows}
                onChange={(e) =>
                  onUpdateState((p) => ({
                    ...p,
                    features: {
                      ...p.features,
                      tutorials: { ...p.features.tutorials, windows: e.target.value },
                    },
                  }))
                }
                className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg"
              />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
