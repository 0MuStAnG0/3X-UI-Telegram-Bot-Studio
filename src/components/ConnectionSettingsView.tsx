import React, { useState } from 'react';
import { Check, Copy, Download, RefreshCw } from 'lucide-react';
import {
  WebPanelState,
  buildEnvFile,
  syncInboundsFromPanel,
} from '../utils/webPanelEngine';

interface ConnectionSettingsViewProps {
  state: WebPanelState;
  onUpdateState: (updater: (prev: WebPanelState) => WebPanelState) => void;
  onSaveState: (next?: WebPanelState) => Promise<void>;
}

export function ConnectionSettingsView({
  state,
  onUpdateState,
  onSaveState,
}: ConnectionSettingsViewProps) {
  const [botTest, setBotTest] = useState<{ loading: boolean; ok: boolean | null; msg: string }>({
    loading: false,
    ok: null,
    msg: '',
  });
  const [panelTest, setPanelTest] = useState<{ loading: boolean; ok: boolean | null; msg: string }>({
    loading: false,
    ok: null,
    msg: '',
  });
  const [copiedEnv, setCopiedEnv] = useState(false);

  const envContent = buildEnvFile(state);

  const handleTestBot = async () => {
    setBotTest({ loading: true, ok: null, msg: 'در حال بررسی توکن ربات با API تلگرام...' });
    try {
      const res = await fetch('/api/test-bot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botToken: state.bot.botToken }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        error?: string;
        bot?: { id: number; username: string; firstName: string };
      };
      if (!res.ok || !data.ok || !data.bot) {
        setBotTest({ loading: false, ok: false, msg: data.error || 'خطا در اتصال به ربات تلگرام' });
        return;
      }
      const username = data.bot.username ? `@${data.bot.username}` : data.bot.firstName;
      onUpdateState((prev) => ({
        ...prev,
        bot: { ...prev.bot, botUsername: data.bot?.username || prev.bot.botUsername },
      }));
      setBotTest({
        loading: false,
        ok: true,
        msg: `متصل شد: ${username} (شناسه ${data.bot.id})`,
      });
    } catch {
      setBotTest({ loading: false, ok: false, msg: 'امکان ارتباط با API تلگرام برقرار نشد.' });
    }
  };

  const handleTestPanel = async () => {
    setPanelTest({ loading: true, ok: null, msg: 'در حال اتصال به پنل 3X-UI با Bearer Token...' });
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
        setPanelTest({ loading: false, ok: false, msg: data.error || 'اتصال به پنل سنایی ناموفق بود.' });
        return;
      }
      const list = data.inbounds || [];
      if (list.length > 0) {
        onUpdateState((prev) => ({
          ...prev,
          inbounds: syncInboundsFromPanel(prev.inbounds, list),
        }));
      }
      setPanelTest({
        loading: false,
        ok: true,
        msg: `اتصال موفق! ${list.length} اینباند از پنل 3X-UI همگام‌سازی شد.`,
      });
    } catch {
      setPanelTest({ loading: false, ok: false, msg: 'خطا در ارتباط با سرور برای تست پنل 3X-UI.' });
    }
  };

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

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">تنظیمات اتصال ربات تلگرام و پنل سنایی (3X-UI)</h1>
          <p className="mt-1 text-sm text-slate-600">
            اطلاعات اتصال ربات، ادمین‌ها، کانال جوین اجباری و توکن API پنل سنایی (بدون نیاز به نام کاربری و رمز پنل) را تنظیم و تست کنید.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onSaveState()}
          className="px-4 py-2 text-xs sm:text-sm font-medium bg-slate-900 hover:bg-slate-800 text-white rounded-lg whitespace-nowrap shrink-0"
        >
          ذخیره همه تنظیمات
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-6 space-y-6">
          <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <h2 className="text-base font-semibold text-slate-900">اتصال به ربات تلگرام</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label htmlFor="wp-bot-token" className="block text-xs font-medium text-slate-700 mb-1.5">
                  توکن ربات تلگرام (BOT_TOKEN)
                </label>
                <input
                  id="wp-bot-token"
                  type="text"
                  dir="ltr"
                  placeholder="123456789:AAH..."
                  value={state.bot.botToken}
                  onChange={(e) =>
                    onUpdateState((prev) => ({
                      ...prev,
                      bot: { ...prev.bot, botToken: e.target.value },
                    }))
                  }
                  className="w-full px-3 py-2 text-sm font-mono bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-600"
                />
              </div>

              <div>
                <label htmlFor="wp-admin-ids" className="block text-xs font-medium text-slate-700 mb-1.5">
                  آیدی عددی ادمین‌ها (ADMIN_IDS)
                </label>
                <input
                  id="wp-admin-ids"
                  type="text"
                  dir="ltr"
                  value={state.bot.adminIds}
                  onChange={(e) =>
                    onUpdateState((prev) => ({
                      ...prev,
                      bot: { ...prev.bot, adminIds: e.target.value },
                    }))
                  }
                  className="w-full px-3 py-2 text-sm font-mono bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-600"
                />
              </div>

              <div>
                <label htmlFor="wp-support" className="block text-xs font-medium text-slate-700 mb-1.5">
                  آیدی پشتیبانی (SUPPORT)
                </label>
                <input
                  id="wp-support"
                  type="text"
                  dir="ltr"
                  value={state.bot.support}
                  onChange={(e) =>
                    onUpdateState((prev) => ({
                      ...prev,
                      bot: { ...prev.bot, support: e.target.value },
                    }))
                  }
                  className="w-full px-3 py-2 text-sm font-mono bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-600"
                />
              </div>

              <div>
                <label htmlFor="wp-req-channel" className="block text-xs font-medium text-slate-700 mb-1.5">
                  آیدی کانال عضویت اجباری (0 = غیرفعال)
                </label>
                <input
                  id="wp-req-channel"
                  type="text"
                  dir="ltr"
                  value={state.bot.requiredChannelId}
                  onChange={(e) =>
                    onUpdateState((prev) => ({
                      ...prev,
                      bot: { ...prev.bot, requiredChannelId: e.target.value },
                    }))
                  }
                  className="w-full px-3 py-2 text-sm font-mono bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-600"
                />
              </div>

              <div>
                <label htmlFor="wp-req-invite" className="block text-xs font-medium text-slate-700 mb-1.5">
                  لینک دعوت کانال اجباری
                </label>
                <input
                  id="wp-req-invite"
                  type="text"
                  dir="ltr"
                  placeholder="https://t.me/..."
                  value={state.bot.requiredChannelInvite}
                  onChange={(e) =>
                    onUpdateState((prev) => ({
                      ...prev,
                      bot: { ...prev.bot, requiredChannelInvite: e.target.value },
                    }))
                  }
                  className="w-full px-3 py-2 text-sm font-mono bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-600"
                />
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="wp-log-channel" className="block text-xs font-medium text-slate-700 mb-1.5">
                  آیدی کانال گزارش و لاگ (LOG_CHANNEL_ID)
                </label>
                <input
                  id="wp-log-channel"
                  type="text"
                  dir="ltr"
                  value={state.bot.logChannelId}
                  onChange={(e) =>
                    onUpdateState((prev) => ({
                      ...prev,
                      bot: { ...prev.bot, logChannelId: e.target.value },
                    }))
                  }
                  className="w-full px-3 py-2 text-sm font-mono bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-600"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleTestBot}
                disabled={botTest.loading}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white rounded-lg"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${botTest.loading ? 'animate-spin' : ''}`} aria-hidden="true" />
                <span>تست اتصال ربات تلگرام</span>
              </button>
              {botTest.msg && (
                <span
                  className={`text-xs font-medium ${
                    botTest.ok === true
                      ? 'text-emerald-700'
                      : botTest.ok === false
                      ? 'text-rose-700'
                      : 'text-slate-600'
                  }`}
                >
                  {botTest.msg}
                </span>
              )}
            </div>
          </section>

          <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">پروکسی SOCKS5 (اختیاری)</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  مناسب سرورهای داخل ایران برای عبور ترافیک ربات و پنل
                </p>
              </div>
              <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={state.panel.proxyEnabled}
                  onChange={(e) =>
                    onUpdateState((prev) => ({
                      ...prev,
                      panel: { ...prev.panel, proxyEnabled: e.target.checked },
                    }))
                  }
                  className="w-4 h-4 accent-teal-700 rounded"
                />
                <span>فعال</span>
              </label>
            </div>

            {state.panel.proxyEnabled && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="wp-proxy-host" className="block text-xs font-medium text-slate-700 mb-1.5">
                    میزبان (PROXY_HOST)
                  </label>
                  <input
                    id="wp-proxy-host"
                    type="text"
                    dir="ltr"
                    value={state.panel.proxyHost}
                    onChange={(e) =>
                      onUpdateState((prev) => ({
                        ...prev,
                        panel: { ...prev.panel, proxyHost: e.target.value },
                      }))
                    }
                    className="w-full px-3 py-2 text-sm font-mono bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label htmlFor="wp-proxy-port" className="block text-xs font-medium text-slate-700 mb-1.5">
                    پورت (PROXY_PORT)
                  </label>
                  <input
                    id="wp-proxy-port"
                    type="text"
                    dir="ltr"
                    value={state.panel.proxyPort}
                    onChange={(e) =>
                      onUpdateState((prev) => ({
                        ...prev,
                        panel: { ...prev.panel, proxyPort: e.target.value },
                      }))
                    }
                    className="w-full px-3 py-2 text-sm font-mono bg-slate-50 border border-slate-200 rounded-lg tabular-nums"
                  />
                </div>
                <div>
                  <label htmlFor="wp-proxy-user" className="block text-xs font-medium text-slate-700 mb-1.5">
                    نام کاربری پروکسی (اختیاری)
                  </label>
                  <input
                    id="wp-proxy-user"
                    type="text"
                    dir="ltr"
                    value={state.panel.proxyUser}
                    onChange={(e) =>
                      onUpdateState((prev) => ({
                        ...prev,
                        panel: { ...prev.panel, proxyUser: e.target.value },
                      }))
                    }
                    className="w-full px-3 py-2 text-sm font-mono bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label htmlFor="wp-proxy-pass" className="block text-xs font-medium text-slate-700 mb-1.5">
                    رمز عبور پروکسی (اختیاری)
                  </label>
                  <input
                    id="wp-proxy-pass"
                    type="password"
                    dir="ltr"
                    value={state.panel.proxyPass}
                    onChange={(e) =>
                      onUpdateState((prev) => ({
                        ...prev,
                        panel: { ...prev.panel, proxyPass: e.target.value },
                      }))
                    }
                    className="w-full px-3 py-2 text-sm font-mono bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>
              </div>
            )}
          </section>
        </div>

        <div className="lg:col-span-6 space-y-6">
          <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <h2 className="text-base font-semibold text-slate-900">اتصال به پنل سنایی / 3X-UI (با API Token)</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="wp-panel-url" className="block text-xs font-medium text-slate-700 mb-1.5">
                  آدرس پنل (PANEL_URL)
                </label>
                <input
                  id="wp-panel-url"
                  type="url"
                  dir="ltr"
                  value={state.panel.panelUrl}
                  onChange={(e) =>
                    onUpdateState((prev) => ({
                      ...prev,
                      panel: { ...prev.panel, panelUrl: e.target.value },
                    }))
                  }
                  className="w-full px-3 py-2 text-sm font-mono bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-600"
                />
              </div>

              <div>
                <label htmlFor="wp-panel-path" className="block text-xs font-medium text-slate-700 mb-1.5">
                  مسیر وب پنل (webBasePath)
                </label>
                <input
                  id="wp-panel-path"
                  type="text"
                  dir="ltr"
                  placeholder="/secret"
                  value={state.panel.panelPath}
                  onChange={(e) =>
                    onUpdateState((prev) => ({
                      ...prev,
                      panel: { ...prev.panel, panelPath: e.target.value },
                    }))
                  }
                  className="w-full px-3 py-2 text-sm font-mono bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-600"
                />
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="wp-panel-token" className="block text-xs font-medium text-slate-700 mb-1.5">
                  توکن API پنل 3X-UI (Authorization: Bearer)
                </label>
                <input
                  id="wp-panel-token"
                  type="text"
                  dir="ltr"
                  placeholder="API Token..."
                  value={state.panel.panelApiToken}
                  onChange={(e) =>
                    onUpdateState((prev) => ({
                      ...prev,
                      panel: { ...prev.panel, panelApiToken: e.target.value },
                    }))
                  }
                  className="w-full px-3 py-2 text-sm font-mono bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-600"
                />
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="wp-sub-base" className="block text-xs font-medium text-slate-700 mb-1.5">
                  آدرس پایه سابسکریپشن (SUB_BASE_URL)
                </label>
                <input
                  id="wp-sub-base"
                  type="url"
                  dir="ltr"
                  value={state.panel.subBaseUrl}
                  onChange={(e) =>
                    onUpdateState((prev) => ({
                      ...prev,
                      panel: { ...prev.panel, subBaseUrl: e.target.value },
                    }))
                  }
                  className="w-full px-3 py-2 text-sm font-mono bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-600"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleTestPanel}
                disabled={panelTest.loading}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium bg-teal-700 hover:bg-teal-800 disabled:opacity-60 text-white rounded-lg"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${panelTest.loading ? 'animate-spin' : ''}`} aria-hidden="true" />
                <span>تست اتصال پنل سنایی و دریافت اینباندها</span>
              </button>
              {panelTest.msg && (
                <span
                  className={`text-xs font-medium ${
                    panelTest.ok === true
                      ? 'text-emerald-700'
                      : panelTest.ok === false
                      ? 'text-rose-700'
                      : 'text-slate-600'
                  }`}
                >
                  {panelTest.msg}
                </span>
              )}
            </div>
          </section>

          <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-slate-900">تنظیمات دسترسی وب‌پنل و خروجی پیکربندی</h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyEnv}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-md"
                >
                  {copiedEnv ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedEnv ? 'کپی شد' : 'کپی .env'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadEnv}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-900 hover:bg-slate-800 text-white rounded-md"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>دانلود .env</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="wp-port" className="block text-xs font-medium text-slate-700 mb-1.5">
                  پورت وب‌پنل
                </label>
                <input
                  id="wp-port"
                  type="number"
                  min={1}
                  max={65535}
                  dir="ltr"
                  value={state.bot.webPanelPort}
                  onChange={(e) =>
                    onUpdateState((prev) => ({
                      ...prev,
                      bot: { ...prev.bot, webPanelPort: Number(e.target.value) || 8080 },
                    }))
                  }
                  className="w-full px-3 py-2 text-sm font-mono bg-slate-50 border border-slate-200 rounded-lg tabular-nums"
                />
              </div>
              <div>
                <label htmlFor="wp-pass" className="block text-xs font-medium text-slate-700 mb-1.5">
                  رمز ورود وب‌پنل
                </label>
                <input
                  id="wp-pass"
                  type="text"
                  dir="ltr"
                  value={state.bot.webPanelPass}
                  onChange={(e) =>
                    onUpdateState((prev) => ({
                      ...prev,
                      bot: { ...prev.bot, webPanelPass: e.target.value },
                    }))
                  }
                  className="w-full px-3 py-2 text-sm font-mono bg-slate-50 border border-slate-200 rounded-lg"
                />
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
