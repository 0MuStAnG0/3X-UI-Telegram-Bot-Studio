import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, RotateCcw, Send, ShieldCheck, User, XCircle } from 'lucide-react';
import {
  BotConfig,
  BotSimState,
  approvePendingPayment,
  handleBotAction,
  handleBotTextInput,
  rejectPendingPayment,
} from '../utils/botEngine';
import { QrMatrix } from './QrMatrix';

interface BotSimulatorViewProps {
  config: BotConfig;
  sim: BotSimState;
  onChangeSim: React.Dispatch<React.SetStateAction<BotSimState>>;
  onResetSim: () => void;
}

const REPLY_KEYBOARD_ROWS = [
  ['🛒 خرید سرویس', '📋 سرویس های من'],
  ['💳 کیف پول', '🎁 تست رایگان'],
  ['📚 آموزش اتصال', '🔗 دعوت دوستان'],
  ['💬 پشتیبانی'],
];

export function BotSimulatorView({
  config,
  sim,
  onChangeSim,
  onResetSim,
}: BotSimulatorViewProps) {
  const [roleView, setRoleView] = useState<'user' | 'admin'>('user');
  const [inputText, setInputText] = useState('');
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [sim.messages.length]);

  const sendText = (value: string) => {
    if (!value.trim()) return;
    onChangeSim((prev) => handleBotTextInput(prev, value, config));
    setInputText('');
  };

  const triggerAction = (action: string) => {
    onChangeSim((prev) => handleBotAction(prev, action, config));
  };

  const quickSuggestions: { label: string; value: string }[] = (() => {
    if (sim.step === 'buy_gb') return [{ label: '۳۰ گیگ', value: '30' }, { label: '۶۰ گیگ', value: '60' }];
    if (sim.step === 'buy_name') return [{ label: 'ali.reza', value: 'ali.reza' }, { label: 'user-123', value: 'user-123' }];
    if (sim.step === 'buy_discount') return [{ label: 'SALE20', value: 'SALE20' }, { label: 'VIP10', value: 'VIP10' }];
    if (sim.step === 'wallet_amount') return [{ label: '۲۰۰,۰۰۰ تومان', value: '200000' }];
    if (sim.step === 'renew_gb') return [{ label: '۲۰ گیگ', value: '20' }];
    return [];
  })();

  const pendingQueue = sim.pendingPayments.filter((p) => p.status === 'pending');

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            شبیه‌ساز رابط کاربری ساده ربات تلگرام
          </h1>
          <p className="mt-1 text-sm text-slate-600 max-w-2xl">
            تجربه واقعی کاربر عادی و ادمین با اتصال مستقیم به منطق پایتون، دیتابیس SQLite و فراخوانی API Token پنل 3X-UI.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => setRoleView('user')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                roleView === 'user' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <User className="w-3.5 h-3.5" aria-hidden="true" />
              <span>کاربر عادی</span>
            </button>
            <button
              type="button"
              onClick={() => setRoleView('admin')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                roleView === 'admin' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="tabular-nums">ادمین ({pendingQueue.length})</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onResetSim}
            aria-label="بازنشانی شبیه‌ساز"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>بازنشانی</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <section
          aria-label="پنجره گفتگوی ربات"
          className="lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col"
        >
          <div className="px-4 sm:px-5 py-3.5 border-b border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">ربات فروش 3X-UI</h2>
              <div className="text-xs text-slate-500 flex flex-wrap items-center gap-2 mt-0.5">
                <span>aiogram 3.x async</span>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">
                  موجودی کیف پول: {sim.walletBalance.toLocaleString('fa-IR')} تومان
                </span>
              </div>
            </div>
            <div className="text-xs text-slate-500 font-mono whitespace-nowrap shrink-0" dir="ltr">
              {config.proxyEnabled ? `SOCKS5 ${config.proxyHost}:${config.proxyPort}` : 'Direct'}
            </div>
          </div>

          {roleView === 'user' ? (
            <>
              <div
                data-testid="sim-chat-messages"
                className="p-4 sm:p-5 space-y-3 h-[300px] sm:h-[320px] overflow-y-auto bg-slate-50/40"
              >
                {sim.messages.map((msg) => {
                  const isUser = msg.sender === 'user';
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isUser ? 'items-start' : 'items-end'}`}
                    >
                      <div
                        className={`max-w-[88%] rounded-xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words ${
                          isUser
                            ? 'bg-teal-700 text-white'
                            : 'bg-white text-slate-800 border border-slate-200'
                        }`}
                      >
                        <div>{msg.text}</div>
                        {msg.qrPayload && <QrMatrix value={msg.qrPayload} />}
                      </div>

                      {msg.buttons && msg.buttons.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1.5 max-w-[88%]">
                          {msg.buttons.map((btn, idx) => (
                            <button
                              key={`${msg.id}-btn-${idx}`}
                              type="button"
                              onClick={() => triggerAction(btn.action)}
                              className="px-3 py-1.5 text-xs font-medium bg-white hover:bg-teal-50 text-teal-800 border border-slate-200 hover:border-teal-300 rounded-lg transition-colors whitespace-nowrap shrink-0"
                            >
                              {btn.label}
                            </button>
                          ))}
                        </div>
                      )}
                      <span className="text-[11px] text-slate-400 mt-1 tabular-nums">{msg.timestamp}</span>
                    </div>
                  );
                })}
                <div ref={chatEndRef} />
              </div>

              {quickSuggestions.length > 0 && (
                <div className="px-4 py-2 bg-teal-50/60 border-t border-slate-200 flex items-center gap-2 overflow-x-auto">
                  <span className="text-xs text-slate-600 shrink-0">پیشنهاد سریع:</span>
                  {quickSuggestions.map((s) => (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => sendText(s.value)}
                      className="px-2.5 py-1 text-xs font-mono bg-white border border-slate-200 hover:border-teal-400 text-slate-800 rounded-md whitespace-nowrap shrink-0"
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              )}

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  sendText(inputText);
                }}
                className="p-3 border-t border-slate-200 bg-white flex items-center gap-2"
              >
                <label htmlFor="sim-chat-input" className="sr-only">
                  پیام به ربات
                </label>
                <input
                  id="sim-chat-input"
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="عدد حجم، نام سرویس، کد تخفیف یا دستور /stats بنویسید..."
                  className="flex-1 px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-600"
                />
                <button
                  type="submit"
                  aria-label="ارسال پیام"
                  className="inline-flex items-center justify-center w-10 h-10 bg-teal-700 hover:bg-teal-800 text-white rounded-lg transition-colors shrink-0"
                >
                  <Send className="w-4 h-4" aria-hidden="true" />
                </button>
              </form>

              <div className="p-3 bg-slate-100 border-t border-slate-200 space-y-2">
                {REPLY_KEYBOARD_ROWS.map((row, rIdx) => (
                  <div key={rIdx} className="grid grid-cols-2 gap-2">
                    {row.map((btnLabel) => (
                      <button
                        key={btnLabel}
                        type="button"
                        onClick={() => triggerAction(btnLabel)}
                        className={`py-2.5 px-3 text-xs sm:text-sm font-medium bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 rounded-lg transition-colors whitespace-nowrap truncate ${
                          row.length === 1 ? 'col-span-2' : ''
                        }`}
                      >
                        {btnLabel}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="p-5 space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  صف رسیدهای در انتظار تایید ادمین
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  تایید یا رد رسید بلافاصله جدول SQLite و پیام کاربر را به‌روزرسانی می‌کند.
                </p>

                {pendingQueue.length === 0 ? (
                  <div className="mt-4 p-6 text-center border border-dashed border-slate-200 rounded-lg text-sm text-slate-500">
                    هیچ رسید معلقی وجود ندارد. در حالت «کاربر عادی» کیف پول را شارژ یا خرید با کسری انجام دهید تا رسید اینجا ثبت شود.
                  </div>
                ) : (
                  <div className="mt-4 space-y-3">
                    {pendingQueue.map((p) => (
                      <div
                        key={p.id}
                        className="p-4 border border-slate-200 rounded-lg bg-slate-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                      >
                        <div className="space-y-1">
                          <div className="text-sm font-semibold text-slate-900 tabular-nums">
                            رسید #{p.id} · {p.amount.toLocaleString('fa-IR')} تومان
                          </div>
                          <div className="text-xs text-slate-600">
                            نوع: {p.purpose === 'wallet' ? 'شارژ کیف پول' : p.purpose === 'purchase' ? 'خرید سرویس' : 'تمدید سرویس'}
                            {p.meta.serviceName ? ` · سرویس: ${p.meta.serviceName}` : ''}
                            {p.meta.gb ? ` · ${p.meta.gb} گیگ` : ''}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => onChangeSim((prev) => approvePendingPayment(prev, p.id, config))}
                            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg whitespace-nowrap"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>تایید پرداخت</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => onChangeSim((prev) => rejectPendingPayment(prev, p.id))}
                            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-white border border-rose-200 text-rose-700 hover:bg-rose-50 rounded-lg whitespace-nowrap"
                          >
                            <XCircle className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>عدم تایید</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t border-slate-200 pt-5">
                <h3 className="text-sm font-semibold text-slate-900 mb-3">دستورات سریع ادمین</h3>
                <div className="flex flex-wrap gap-2">
                  {['/stats', '/codes', '/trial', '/referral', '/addcode NEW30 30 50'].map((cmd) => (
                    <button
                      key={cmd}
                      type="button"
                      onClick={() => {
                        sendText(cmd);
                        setRoleView('user');
                      }}
                      className="px-3 py-1.5 text-xs font-mono bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-md transition-colors"
                    >
                      {cmd}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>

        <aside className="lg:col-span-5 space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-slate-900">وضعیت دیتابیس SQLite (زنده)</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              سرویس‌ها، کیف پول و کدهای تخفیف با هر عملیات در ربات به‌روزرسانی می‌شوند.
            </p>

            <div className="mt-4 grid grid-cols-3 gap-3 border-b border-slate-200 pb-4">
              <div>
                <div className="text-xs text-slate-500">کیف پول</div>
                <div className="text-base font-bold text-slate-900 tabular-nums mt-0.5">
                  {sim.walletBalance.toLocaleString('fa-IR')}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">سرویس‌ها</div>
                <div className="text-base font-bold text-slate-900 tabular-nums mt-0.5">
                  {sim.orders.length}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">کدهای تخفیف</div>
                <div className="text-base font-bold text-slate-900 tabular-nums mt-0.5">
                  {sim.discountCodes.length}
                </div>
              </div>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-slate-500 border-b border-slate-200">
                    <th className="py-2 text-right font-medium">سرویس (orders)</th>
                    <th className="py-2 text-right font-medium">اینباند</th>
                    <th className="py-2 text-left font-medium">حجم</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sim.orders.map((order) => (
                    <tr key={order.id} className="hover:bg-slate-50">
                      <td className="py-2 font-mono text-slate-800">{order.clientEmail}</td>
                      <td className="py-2 text-slate-600 truncate max-w-[130px]">{order.inboundRemark}</td>
                      <td className="py-2 text-left font-mono tabular-nums text-slate-800">
                        {order.gb} GB
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-slate-900">
              ردیابی اتصال API Token به پنل 3X-UI
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              تمام درخواست‌ها صرفاً با هدر <code className="font-mono">Authorization: Bearer</code> ارسال می‌شوند.
            </p>

            <div className="mt-4 space-y-2.5 max-h-64 overflow-y-auto">
              {sim.apiTraces.map((trace) => (
                <div key={trace.id} className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                  <div className="flex items-center justify-between gap-2 text-xs font-mono" dir="ltr">
                    <span className="text-teal-700 font-semibold">
                      {trace.method} {trace.endpoint}
                    </span>
                    <span className="text-emerald-700 tabular-nums">{trace.status} OK</span>
                  </div>
                  <div className="text-xs text-slate-700">{trace.summary}</div>
                  <div className="text-[11px] text-slate-500 font-mono" dir="ltr">
                    Route: {trace.viaProxy}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
