import React, { useState } from 'react';
import { Plus, RefreshCw, Trash2 } from 'lucide-react';
import { InboundItem, WebPanelState, syncInboundsFromPanel } from '../utils/webPanelEngine';

interface InboundsViewProps {
  state: WebPanelState;
  onUpdateState: (updater: (prev: WebPanelState) => WebPanelState) => void;
  onSaveState: (next?: WebPanelState) => Promise<void>;
}

export function InboundsView({ state, onUpdateState, onSaveState }: InboundsViewProps) {
  const [syncStatus, setSyncStatus] = useState<{ loading: boolean; ok: boolean | null; msg: string }>({
    loading: false,
    ok: null,
    msg: '',
  });
  const [newInbound, setNewInbound] = useState<{
    id: string;
    remark: string;
    protocol: string;
    port: string;
    flow: string;
  }>({
    id: String((state.inbounds[state.inbounds.length - 1]?.id ?? 0) + 1),
    remark: '',
    protocol: 'vless',
    port: '443',
    flow: 'xtls-rprx-vision',
  });

  const handleSyncFrom3xui = async () => {
    setSyncStatus({ loading: true, ok: null, msg: 'در حال دریافت لیست اینباندها از پنل 3X-UI...' });
    try {
      const res = await fetch('/api/test-panel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          panelUrl: state.panel.panelUrl,
          panelPath: state.panel.panelPath,
          apiToken: state.panel.panelApiToken,
        }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        error?: string;
        inbounds?: Array<{ id: number; remark: string; protocol: string; port: number; clientCount?: number }>;
      };
      if (!res.ok || !data.ok) {
        setSyncStatus({ loading: false, ok: false, msg: data.error || 'خطا در همگام‌سازی اینباندها از پنل' });
        return;
      }
      const list = data.inbounds || [];
      if (list.length === 0) {
        setSyncStatus({ loading: false, ok: true, msg: 'هیچ اینباندی در پنل سنایی یافت نشد.' });
        return;
      }
      const merged = syncInboundsFromPanel(state.inbounds, list);
      const nextState: WebPanelState = { ...state, inbounds: merged };
      onUpdateState(() => nextState);
      await onSaveState(nextState);
      setSyncStatus({ loading: false, ok: true, msg: `${merged.length} اینباند از پنل سنایی همگام‌سازی و ذخیره شد.` });
    } catch {
      setSyncStatus({ loading: false, ok: false, msg: 'خطا در ارتباط با پنل 3X-UI.' });
    }
  };

  const handleAddInbound = (e: React.FormEvent) => {
    e.preventDefault();
    const id = Number(newInbound.id);
    if (!Number.isInteger(id) || id <= 0) return;
    if (state.inbounds.some((ib) => ib.id === id)) return;
    const item: InboundItem = {
      id,
      remark: newInbound.remark.trim() || `Inbound-${id}`,
      protocol: newInbound.protocol.trim() || 'vless',
      port: Number(newInbound.port) || 443,
      flow: newInbound.flow.trim(),
      enabled: true,
      clientCount: 0,
    };
    const nextState: WebPanelState = { ...state, inbounds: [...state.inbounds, item] };
    onUpdateState(() => nextState);
    void onSaveState(nextState);
    setNewInbound({
      id: String(id + 1),
      remark: '',
      protocol: 'vless',
      port: '443',
      flow: 'xtls-rprx-vision',
    });
  };

  const updateInboundField = <K extends keyof InboundItem>(id: number, key: K, val: InboundItem[K]) => {
    onUpdateState((prev) => ({
      ...prev,
      inbounds: prev.inbounds.map((ib) => (ib.id === id ? { ...ib, [key]: val } : ib)),
    }));
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">مدیریت اینباندهای پنل 3X-UI</h1>
          <p className="mt-1 text-sm text-slate-600">
            اینباندهای فعال در این لیست مستقیماً هنگام خرید و ساخت کانفیگ در ربات تلگرام و وب‌پنل نمایش داده می‌شوند.
          </p>
        </div>

        <button
          type="button"
          onClick={handleSyncFrom3xui}
          disabled={syncStatus.loading}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-medium bg-teal-700 hover:bg-teal-800 disabled:opacity-60 text-white rounded-lg whitespace-nowrap shrink-0"
        >
          <RefreshCw className={`w-4 h-4 ${syncStatus.loading ? 'animate-spin' : ''}`} aria-hidden="true" />
          <span>همگام‌سازی زنده از پنل سنایی</span>
        </button>
      </div>

      {syncStatus.msg && (
        <div
          className={`px-4 py-3 rounded-xl border text-xs font-medium ${
            syncStatus.ok === true
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : syncStatus.ok === false
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-slate-50 border-slate-200 text-slate-700'
          }`}
        >
          {syncStatus.msg}
        </div>
      )}

      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-slate-900">
            اینباندهای ثبت‌شده ({state.inbounds.length})
          </h2>
          <span className="text-xs text-slate-500 font-mono" dir="ltr">
            {state.panel.panelUrl}{state.panel.panelPath}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs sm:text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500">
                <th className="px-4 py-3 text-right font-medium">شناسه (ID)</th>
                <th className="px-4 py-3 text-right font-medium">نام نمایشی (Remark)</th>
                <th className="px-4 py-3 text-right font-medium">پروتکل</th>
                <th className="px-4 py-3 text-right font-medium">پورت</th>
                <th className="px-4 py-3 text-right font-medium">Flow (Reality)</th>
                <th className="px-4 py-3 text-right font-medium">وضعیت فروش</th>
                <th className="px-4 py-3 text-left font-medium">حذف</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {state.inbounds.map((ib) => (
                <tr key={ib.id} className="hover:bg-slate-50/70">
                  <td className="px-4 py-3 font-mono font-semibold text-slate-900 tabular-nums">#{ib.id}</td>
                  <td className="px-4 py-3">
                    <input
                      type="text"
                      aria-label={`نام اینباند ${ib.id}`}
                      value={ib.remark}
                      onChange={(e) => updateInboundField(ib.id, 'remark', e.target.value)}
                      className="w-full min-w-[160px] px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <select
                      aria-label={`پروتکل اینباند ${ib.id}`}
                      value={ib.protocol}
                      onChange={(e) => updateInboundField(ib.id, 'protocol', e.target.value)}
                      className="px-2 py-1.5 text-xs font-mono bg-slate-50 border border-slate-200 rounded-md"
                      dir="ltr"
                    >
                      <option value="vless">vless</option>
                      <option value="vmess">vmess</option>
                      <option value="trojan">trojan</option>
                      <option value="shadowsocks">shadowsocks</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      aria-label={`پورت اینباند ${ib.id}`}
                      dir="ltr"
                      value={ib.port}
                      onChange={(e) => updateInboundField(ib.id, 'port', Number(e.target.value) || 443)}
                      className="w-20 px-2 py-1.5 text-xs font-mono bg-slate-50 border border-slate-200 rounded-md tabular-nums"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="text"
                      aria-label={`فلو اینباند ${ib.id}`}
                      dir="ltr"
                      placeholder="اختیاری"
                      value={ib.flow}
                      onChange={(e) => updateInboundField(ib.id, 'flow', e.target.value)}
                      className="w-36 px-2.5 py-1.5 text-xs font-mono bg-slate-50 border border-slate-200 rounded-md"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => updateInboundField(ib.id, 'enabled', !ib.enabled)}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md ${
                        ib.enabled
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : 'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}
                    >
                      {ib.enabled ? 'فعال در ربات' : 'غیرفعال'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-left">
                    <button
                      type="button"
                      aria-label={`حذف اینباند ${ib.remark}`}
                      disabled={state.inbounds.length <= 1}
                      onClick={() =>
                        onUpdateState((prev) => ({
                          ...prev,
                          inbounds: prev.inbounds.filter((item) => item.id !== ib.id),
                        }))
                      }
                      className="p-1.5 text-slate-400 hover:text-rose-600 disabled:opacity-30 rounded"
                    >
                      <Trash2 className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <h2 className="text-base font-semibold text-slate-900">افزودن دستی اینباند</h2>
        <form onSubmit={handleAddInbound} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
          <div className="sm:col-span-2">
            <label htmlFor="new-ib-id" className="block text-xs font-medium text-slate-700 mb-1">
              شناسه در 3X-UI
            </label>
            <input
              id="new-ib-id"
              type="number"
              min={1}
              required
              dir="ltr"
              value={newInbound.id}
              onChange={(e) => setNewInbound((p) => ({ ...p, id: e.target.value }))}
              className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg tabular-nums"
            />
          </div>
          <div className="sm:col-span-4">
            <label htmlFor="new-ib-remark" className="block text-xs font-medium text-slate-700 mb-1">
              نام نمایشی برای کاربر
            </label>
            <input
              id="new-ib-remark"
              type="text"
              required
              placeholder="مثلاً: Netherlands · VLESS Reality"
              value={newInbound.remark}
              onChange={(e) => setNewInbound((p) => ({ ...p, remark: e.target.value }))}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg"
            />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="new-ib-proto" className="block text-xs font-medium text-slate-700 mb-1">
              پروتکل
            </label>
            <select
              id="new-ib-proto"
              dir="ltr"
              value={newInbound.protocol}
              onChange={(e) => setNewInbound((p) => ({ ...p, protocol: e.target.value }))}
              className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg"
            >
              <option value="vless">vless</option>
              <option value="vmess">vmess</option>
              <option value="trojan">trojan</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="new-ib-flow" className="block text-xs font-medium text-slate-700 mb-1">
              Flow
            </label>
            <input
              id="new-ib-flow"
              type="text"
              dir="ltr"
              value={newInbound.flow}
              onChange={(e) => setNewInbound((p) => ({ ...p, flow: e.target.value }))}
              className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg"
            />
          </div>
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium bg-slate-900 hover:bg-slate-800 text-white rounded-lg"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              <span>افزودن</span>
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
