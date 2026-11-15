import React, { useState } from 'react';
import { Check, Copy, Download, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { BotConfig, generateEnvFile } from '../utils/botEngine';

interface ConfigBuilderViewProps {
  config: BotConfig;
  onChangeConfig: React.Dispatch<React.SetStateAction<BotConfig>>;
}

const SQLITE_INDEXES = [
  { name: 'idx_orders_tg_id', table: 'orders(telegram_id, id DESC)', purpose: 'واکشی فوری سرویس‌های هر کاربر در منوی سرویس‌های من' },
  { name: 'idx_orders_client_email', table: 'orders(client_email, id DESC)', purpose: 'بررسی آخرین سفارش هر کلاینت در حلقه یادآور انقضا' },
  { name: 'idx_orders_created_at_type', table: 'orders(created_at, order_type)', purpose: 'گزارش‌گیری سریع آمار روزانه و درآمد در دستور /stats' },
  { name: 'idx_pending_payments_status_created', table: 'pending_payments(status, created_at)', purpose: 'پایش پرداخت‌های معلق بیشتر از ۲ ساعت برای یادآور ادمین' },
  { name: 'idx_pending_payments_tg_id', table: 'pending_payments(telegram_id)', purpose: 'پیگیری تاریخچه رسیدهای هر کاربر' },
  { name: 'idx_transactions_tg_created', table: 'transactions(telegram_id, created_at DESC)', purpose: 'دفتر کل تراکنش‌های کیف پول با مرتب‌سازی نزولی' },
  { name: 'idx_referrals_inviter_id', table: 'referrals(inviter_id)', purpose: 'محاسبه آنی تعداد زیرمجموعه‌های دعوت‌شده' },
  { name: 'idx_discount_uses_tg', table: 'discount_uses(telegram_id, code)', purpose: 'کنترل یک‌بارمصرف بودن کد تخفیف برای هر کاربر' },
  { name: 'idx_users_joined_at', table: 'users(joined_at)', purpose: 'محاسبه کاربران جدید امروز بدون اسکن کل جدول' },
];

export function ConfigBuilderView({ config, onChangeConfig }: ConfigBuilderViewProps) {
  const [copiedEnv, setCopiedEnv] = useState(false);
  const [testState, setTestState] = useState<{
    loading: boolean;
    message: string;
    ok: boolean | null;
  }>({ loading: false, message: '', ok: null });

  const envContent = generateEnvFile(config);

  const handleCopyEnv = async () => {
    await navigator.clipboard.writeText(envContent);
    setCopiedEnv(true);
    setTimeout(() => setCopiedEnv(false), 1800);
  };

  const handleDownloadEnv = () => {
    const blob = new Blob([envContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '.env';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleTestPanel = async () => {
    setTestState({ loading: true, message: 'در حال تست اتصال Bearer Token به پنل 3X-UI...', ok: null });
    try {
      const res = await fetch('/api/test-panel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          panelUrl: config.panelUrl,
          panelPath: config.panelPath,
          apiToken: config.panelApiToken,
        }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        error?: string;
        inbounds?: Array<{ id: number; remark: string; protocol: string; port: number }>;
      };
      if (!res.ok || !data.ok) {
        setTestState({
          loading: false,
          ok: false,
          message: data.error || 'اتصال به پنل ناموفق بود.',
        });
        return;
      }
      const list = data.inbounds || [];
      setTestState({
        loading: false,
        ok: true,
        message: `اتصال موفق با API Token! ${list.length} اینباند از پنل دریافت شد.`,
      });
      if (list.length > 0) {
        onChangeConfig((prev) => ({
          ...prev,
          inbounds: list.map((ib) => ({
            id: ib.id,
            remark: ib.remark,
            flow: ib.protocol === 'vless' ? 'xtls-rprx-vision' : '',
          })),
        }));
      }
    } catch {
      setTestState({
        loading: false,
        ok: false,
        message: 'خطا در برقراری ارتباط با سرور برای تست پنل.',
      });
    }
  };

  const updateField = <K extends keyof BotConfig>(key: K, value: BotConfig[K]) => {
    onChangeConfig((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="space-y-8">
      <div className="border-b border-slate-200 pb-5">
        <h1 className="text-2xl font-bold text-slate-900">
          پیکربندی پنل 3X-UI، پروکسی SOCKS5 و دیتابیس SQLite
        </h1>
        <p className="mt-1 text-sm text-slate-600 max-w-3xl">
          تمامی تنظیمات ارتباط با پنل صرفاً با API Token (بدون نام کاربری و رمز عبور)، پروکسی اختیاری SOCKS5 برای سرورهای ایران و تولید فایل <code className="font-mono">.env</code> را در این بخش انجام دهید.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 space-y-6">
          <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <h2 className="text-base font-semibold text-slate-900">۱. اتصال به پنل 3X-UI (فقط API Token)</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="cfg-panel-url" className="block text-xs font-medium text-slate-700 mb-1.5">
                  آدرس پنل (PANEL_URL)
                </label>
                <input
                  id="cfg-panel-url"
                  type="url"
                  dir="ltr"
                  value={config.panelUrl}
                  onChange={(e) => updateField('panelUrl', e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-600"
                />
              </div>
              <div>
                <label htmlFor="cfg-panel-path" className="block text-xs font-medium text-slate-700 mb-1.5">
                  مسیر وب پنل (PANEL_PATH)
                </label>
                <input
                  id="cfg-panel-path"
                  type="text"
                  dir="ltr"
                  value={config.panelPath}
                  onChange={(e) => updateField('panelPath', e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-600"
                />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="cfg-api-token" className="block text-xs font-medium text-slate-700 mb-1.5">
                  توکن API پنل (PANEL_API_TOKEN)
                </label>
                <input
                  id="cfg-api-token"
                  type="text"
                  dir="ltr"
                  value={config.panelApiToken}
                  onChange={(e) => updateField('panelApiToken', e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-600"
                />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="cfg-sub-url" className="block text-xs font-medium text-slate-700 mb-1.5">
                  آدرس پایه سابسکریپشن (SUB_BASE_URL)
                </label>
                <input
                  id="cfg-sub-url"
                  type="url"
                  dir="ltr"
                  value={config.subBaseUrl}
                  onChange={(e) => updateField('subBaseUrl', e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-600"
                />
              </div>
            </div>

            <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100">
              <button
                type="button"
                onClick={handleTestPanel}
                disabled={testState.loading}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white rounded-lg transition-colors whitespace-nowrap"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${testState.loading ? 'animate-spin' : ''}`} aria-hidden="true" />
                <span>تست اتصال زنده با Bearer Token</span>
              </button>

              {testState.message && (
                <span
                  className={`text-xs font-medium ${
                    testState.ok === true
                      ? 'text-emerald-700'
                      : testState.ok === false
                      ? 'text-rose-700'
                      : 'text-slate-600'
                  }`}
                >
                  {testState.message}
                </span>
              )}
            </div>
          </section>

          <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">۲. اینباندها (Inbounds)</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  لیست سرورها و اینباندهای قابل انتخاب توسط کاربر در ربات
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  updateField('inbounds', [
                    ...config.inbounds,
                    { id: config.inbounds.length + 1, remark: 'New-Server', flow: 'xtls-rprx-vision' },
                  ])
                }
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-teal-50 text-teal-800 hover:bg-teal-100 rounded-lg whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                <span>افزودن اینباند</span>
              </button>
            </div>

            <div className="space-y-2.5">
              {config.inbounds.map((ib, index) => (
                <div key={index} className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-2">
                    <label className="sr-only" htmlFor={`ib-id-${index}`}>شناسه اینباند</label>
                    <input
                      id={`ib-id-${index}`}
                      type="number"
                      min={1}
                      value={ib.id}
                      onChange={(e) => {
                        const next = [...config.inbounds];
                        next[index] = { ...ib, id: Number(e.target.value) || 1 };
                        updateField('inbounds', next);
                      }}
                      className="w-full px-2.5 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg tabular-nums"
                    />
                  </div>
                  <div className="col-span-5">
                    <label className="sr-only" htmlFor={`ib-remark-${index}`}>نام نمایشی سرور</label>
                    <input
                      id={`ib-remark-${index}`}
                      type="text"
                      value={ib.remark}
                      onChange={(e) => {
                        const next = [...config.inbounds];
                        next[index] = { ...ib, remark: e.target.value };
                        updateField('inbounds', next);
                      }}
                      placeholder="نام سرور"
                      className="w-full px-2.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div className="col-span-4">
                    <label className="sr-only" htmlFor={`ib-flow-${index}`}>Flow</label>
                    <input
                      id={`ib-flow-${index}`}
                      type="text"
                      dir="ltr"
                      value={ib.flow}
                      onChange={(e) => {
                        const next = [...config.inbounds];
                        next[index] = { ...ib, flow: e.target.value };
                        updateField('inbounds', next);
                      }}
                      placeholder="xtls-rprx-vision"
                      className="w-full px-2.5 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div className="col-span-1 flex justify-end">
                    <button
                      type="button"
                      aria-label={`حذف اینباند ${ib.remark}`}
                      disabled={config.inbounds.length <= 1}
                      onClick={() =>
                        updateField(
                          'inbounds',
                          config.inbounds.filter((_, idx) => idx !== index)
                        )
                      }
                      className="p-2 text-slate-400 hover:text-rose-600 disabled:opacity-30 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  ۳. پروکسی SOCKS5 (اختیاری — دور زدن تحریم)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  برای سرورهای ایران جهت اتصال پایدار aiogram و aiohttp به تلگرام و پنل
                </p>
              </div>
              <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.proxyEnabled}
                  onChange={(e) => updateField('proxyEnabled', e.target.checked)}
                  className="w-4 h-4 accent-teal-700 rounded"
                />
                <span>فعال‌سازی SOCKS5</span>
              </label>
            </div>

            {config.proxyEnabled && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="cfg-proxy-host" className="block text-xs font-medium text-slate-700 mb-1.5">
                    میزبان پروکسی (PROXY_HOST)
                  </label>
                  <input
                    id="cfg-proxy-host"
                    type="text"
                    dir="ltr"
                    value={config.proxyHost}
                    onChange={(e) => updateField('proxyHost', e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label htmlFor="cfg-proxy-port" className="block text-xs font-medium text-slate-700 mb-1.5">
                    پورت پروکسی (PROXY_PORT)
                  </label>
                  <input
                    id="cfg-proxy-port"
                    type="text"
                    dir="ltr"
                    value={config.proxyPort}
                    onChange={(e) => updateField('proxyPort', e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono bg-slate-50 border border-slate-200 rounded-lg tabular-nums"
                  />
                </div>
              </div>
            )}
          </section>

          <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <h2 className="text-base font-semibold text-slate-900">۴. ربات تلگرام، ادمین‌ها و کارت واریز</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label htmlFor="cfg-bot-token" className="block text-xs font-medium text-slate-700 mb-1.5">
                  توکن ربات تلگرام (BOT_TOKEN)
                </label>
                <input
                  id="cfg-bot-token"
                  type="text"
                  dir="ltr"
                  value={config.botToken}
                  onChange={(e) => updateField('botToken', e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono bg-slate-50 border border-slate-200 rounded-lg"
                />
              </div>
              <div>
                <label htmlFor="cfg-admin-ids" className="block text-xs font-medium text-slate-700 mb-1.5">
                  آیدی عددی ادمین‌ها (ADMIN_IDS)
                </label>
                <input
                  id="cfg-admin-ids"
                  type="text"
                  dir="ltr"
                  value={config.adminIds}
                  onChange={(e) => updateField('adminIds', e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono bg-slate-50 border border-slate-200 rounded-lg"
                />
              </div>
              <div>
                <label htmlFor="cfg-support" className="block text-xs font-medium text-slate-700 mb-1.5">
                  آیدی پشتیبانی (SUPPORT)
                </label>
                <input
                  id="cfg-support"
                  type="text"
                  dir="ltr"
                  value={config.support}
                  onChange={(e) => updateField('support', e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono bg-slate-50 border border-slate-200 rounded-lg"
                />
              </div>
              <div>
                <label htmlFor="cfg-card-num" className="block text-xs font-medium text-slate-700 mb-1.5">
                  شماره کارت پرداخت
                </label>
                <input
                  id="cfg-card-num"
                  type="text"
                  dir="ltr"
                  value={config.cards[0]?.number ?? ''}
                  onChange={(e) =>
                    updateField('cards', [{ number: e.target.value, name: config.cards[0]?.name ?? '' }])
                  }
                  className="w-full px-3 py-2 text-sm font-mono bg-slate-50 border border-slate-200 rounded-lg tabular-nums"
                />
              </div>
              <div>
                <label htmlFor="cfg-card-name" className="block text-xs font-medium text-slate-700 mb-1.5">
                  نام صاحب کارت
                </label>
                <input
                  id="cfg-card-name"
                  type="text"
                  value={config.cards[0]?.name ?? ''}
                  onChange={(e) =>
                    updateField('cards', [{ number: config.cards[0]?.number ?? '', name: e.target.value }])
                  }
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg"
                />
              </div>
            </div>
          </section>

          <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  ۵. وب‌پنل مدیریت سرور (چاپ آدرس در پایان نصب)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  در پایان نصب، آدرس <code className="font-mono">http://SERVER_IP:{config.webPanelPort}</code> و رمز ورود در ترمینال چاپ می‌شود.
                </p>
              </div>
              <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.webPanelEnabled}
                  onChange={(e) => updateField('webPanelEnabled', e.target.checked)}
                  className="w-4 h-4 accent-teal-700 rounded"
                />
                <span>فعال‌سازی وب‌پنل</span>
              </label>
            </div>

            {config.webPanelEnabled && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="cfg-wp-port" className="block text-xs font-medium text-slate-700 mb-1.5">
                    پورت وب‌پنل (WEB_PANEL_PORT)
                  </label>
                  <input
                    id="cfg-wp-port"
                    type="number"
                    min={1}
                    max={65535}
                    dir="ltr"
                    value={config.webPanelPort}
                    onChange={(e) => updateField('webPanelPort', Number(e.target.value) || 8080)}
                    className="w-full px-3 py-2 text-sm font-mono bg-slate-50 border border-slate-200 rounded-lg tabular-nums"
                  />
                </div>
                <div>
                  <label htmlFor="cfg-wp-pass" className="block text-xs font-medium text-slate-700 mb-1.5">
                    رمز عبور وب‌پنل (WEB_PANEL_PASS)
                  </label>
                  <input
                    id="cfg-wp-pass"
                    type="text"
                    dir="ltr"
                    value={config.webPanelPass}
                    onChange={(e) => updateField('webPanelPass', e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>
              </div>
            )}
          </section>
        </div>

        <aside className="lg:col-span-5 lg:sticky lg:top-20 space-y-6">
          <div className="bg-slate-900 text-slate-100 rounded-xl overflow-hidden border border-slate-800">
            <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between gap-2">
              <span className="text-xs font-mono text-slate-300" dir="ltr">
                .env (Generated)
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyEnv}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-md whitespace-nowrap"
                >
                  {copiedEnv ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedEnv ? 'کپی شد' : 'کپی'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadEnv}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-teal-700 hover:bg-teal-600 text-white rounded-md whitespace-nowrap"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>دانلود .env</span>
                </button>
              </div>
            </div>
            <pre
              data-testid="generated-env-preview"
              dir="ltr"
              className="p-4 text-xs font-mono leading-relaxed whitespace-pre-wrap break-all text-slate-200"
            >
              {envContent}
            </pre>
          </div>
        </aside>
      </div>

      <section className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-200">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              معماری دیتابیس SQLite و ایندکس‌گذاری بهینه
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              تنظیم با حالت WAL، کش ۸ مگابایتی در رم، <code className="font-mono">synchronous=NORMAL</code> و ۹ ایندکس B-Tree اختصاصی
            </p>
          </div>
          <div className="text-xs font-mono text-slate-600" dir="ltr">
            PRAGMA journal_mode=WAL · PRAGMA temp_store=MEMORY
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-slate-500 border-b border-slate-200">
                <th className="py-2.5 text-right font-medium">نام ایندکس</th>
                <th className="py-2.5 text-right font-medium">ستون‌های هدف</th>
                <th className="py-2.5 text-right font-medium">کاربرد بهینه‌سازی</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {SQLITE_INDEXES.map((idx) => (
                <tr key={idx.name} className="hover:bg-slate-50">
                  <td className="py-2.5 font-mono text-teal-800">{idx.name}</td>
                  <td className="py-2.5 font-mono text-slate-700" dir="ltr">
                    {idx.table}
                  </td>
                  <td className="py-2.5 text-slate-600">{idx.purpose}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
