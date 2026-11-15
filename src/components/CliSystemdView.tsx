import React, { useState } from 'react';
import { Check, Copy, Terminal } from 'lucide-react';
import { BotConfig, generateSystemdUnit, simulateCliCommand } from '../utils/botEngine';

interface CliSystemdViewProps {
  config: BotConfig;
  onChangeConfig: React.Dispatch<React.SetStateAction<BotConfig>>;
}

const CLI_COMMANDS: { cmd: string; label: string; desc: string }[] = [
  { cmd: 'health', label: 'vpn-bot health', desc: 'بررسی سلامت سرویس، توکن تلگرام، پروکسی SOCKS5، توکن پنل و دیتابیس' },
  { cmd: 'status', label: 'vpn-bot status', desc: 'نمایش وضعیت سرویس systemd، مصرف رم و PID فعال' },
  { cmd: 'stats', label: 'vpn-bot stats', desc: 'گزارش سریع تعداد کاربران، سفارشات، درآمد و رسیدهای معلق از SQLite' },
  { cmd: 'logs', label: 'vpn-bot logs', desc: 'مشاهده لاگ زنده خروجی journalctl' },
  { cmd: 'backup', label: 'vpn-bot backup', desc: 'تهیه نسخه پشتیبان فشرده از کد، .env و فایل vpn_bot.db' },
  { cmd: 'restart', label: 'vpn-bot restart', desc: 'راه‌اندازی مجدد سرویس پس از تغییر تنظیمات' },
];

export function CliSystemdView({ config, onChangeConfig }: CliSystemdViewProps) {
  const [selectedCmd, setSelectedCmd] = useState('health');
  const [copiedUnit, setCopiedUnit] = useState(false);

  const unitContent = generateSystemdUnit(config.botDir);
  const terminalOutput = simulateCliCommand(selectedCmd, config);

  const handleCopyUnit = async () => {
    await navigator.clipboard.writeText(unitContent);
    setCopiedUnit(true);
    setTimeout(() => setCopiedUnit(false), 1800);
  };

  return (
    <div className="space-y-8">
      <div className="border-b border-slate-200 pb-5">
        <h1 className="text-2xl font-bold text-slate-900">
          ابزار خط‌فرمان اختصاصی <code className="font-mono text-teal-700">vpn-bot</code> و سرویس <code className="font-mono text-teal-700">systemd</code>
        </h1>
        <p className="mt-1 text-sm text-slate-600 max-w-3xl">
          مدیریت کامل سرویس بدون نیاز به دستورات پیچیده لینوکس، همراه با ری‌استارت خودکار در صورت کرش یا ریبوت سرور.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <section className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <h2 className="text-base font-semibold text-slate-900">دستورات خط‌فرمان vpn-bot</h2>
          <p className="text-xs text-slate-500">
            روی هر دستور کلیک کنید تا خروجی واقعی آن بر اساس تنظیمات فعلی نمایش داده شود.
          </p>

          <div className="space-y-2">
            {CLI_COMMANDS.map((item) => {
              const active = selectedCmd === item.cmd;
              return (
                <button
                  key={item.cmd}
                  type="button"
                  onClick={() => setSelectedCmd(item.cmd)}
                  className={`w-full text-right p-3 rounded-lg border transition-colors flex flex-col gap-1 ${
                    active
                      ? 'bg-teal-50/70 border-teal-300 text-slate-900'
                      : 'bg-slate-50/60 border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-semibold text-teal-800" dir="ltr">
                      {item.label}
                    </span>
                    <span className="text-[11px] text-slate-500 font-mono">{item.cmd}</span>
                  </div>
                  <span className="text-xs text-slate-600">{item.desc}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="lg:col-span-6 space-y-6">
          <div className="bg-slate-900 text-slate-100 rounded-xl overflow-hidden border border-slate-800">
            <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-mono text-slate-300" dir="ltr">
                <Terminal className="w-4 h-4 text-teal-400" aria-hidden="true" />
                <span>root@server:~# vpn-bot {selectedCmd}</span>
              </div>
            </div>
            <pre
              data-testid="cli-terminal-output"
              dir="ltr"
              className="p-4 text-xs font-mono leading-relaxed overflow-x-auto text-emerald-300 min-h-[220px]"
            >
              {terminalOutput}
            </pre>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900">فایل سرویس systemd</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  مسیر نصب <code className="font-mono">/etc/systemd/system/vpnbot.service</code>
                </p>
              </div>
              <button
                type="button"
                onClick={handleCopyUnit}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-900 hover:bg-slate-800 text-white rounded-lg whitespace-nowrap shrink-0"
              >
                {copiedUnit ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedUnit ? 'کپی شد' : 'کپی سرویس'}</span>
              </button>
            </div>

            <div>
              <label htmlFor="cli-bot-dir" className="block text-xs font-medium text-slate-700 mb-1.5">
                مسیر پروژه روی سرور (WorkingDirectory)
              </label>
              <input
                id="cli-bot-dir"
                type="text"
                dir="ltr"
                value={config.botDir}
                onChange={(e) => onChangeConfig((prev) => ({ ...prev, botDir: e.target.value }))}
                className="w-full px-3 py-2 text-sm font-mono bg-slate-50 border border-slate-200 rounded-lg"
              />
            </div>

            <pre
              dir="ltr"
              className="p-4 text-xs font-mono leading-relaxed bg-slate-900 text-slate-200 rounded-lg overflow-x-auto"
            >
              {unitContent}
            </pre>
          </div>
        </section>
      </div>
    </div>
  );
}
