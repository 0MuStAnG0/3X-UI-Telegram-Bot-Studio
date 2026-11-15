import React from 'react';
import { Check, Save } from 'lucide-react';

export type WebPanelTab = 'connections' | 'inbounds' | 'users' | 'plans_configs';

interface TopBarProps {
  activeTab: WebPanelTab;
  onSelectTab: (tab: WebPanelTab) => void;
  saving: boolean;
  savedNotice: boolean;
  onSaveAll: () => void;
}

const NAV_ITEMS: { id: WebPanelTab; label: string }[] = [
  { id: 'connections', label: 'اتصال ربات و پنل' },
  { id: 'inbounds', label: 'مدیریت اینباندها' },
  { id: 'users', label: 'کاربران و مالی' },
  { id: 'plans_configs', label: 'پلن‌ها، کانفیگ‌ها و امکانات' },
];

export function TopBar({
  activeTab,
  onSelectTab,
  saving,
  savedNotice,
  onSaveAll,
}: TopBarProps) {
  return (
    <header className="md:sticky md:top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4 sm:gap-8">
        <button
          type="button"
          onClick={() => onSelectTab('connections')}
          className="text-base sm:text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 rounded"
        >
          وب‌پنل 3X-UI
        </button>

        <nav
          aria-label="ناوبری پنل مدیریت"
          className="hidden md:flex items-center gap-6 overflow-x-auto"
        >
          {NAV_ITEMS.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`py-2 text-sm font-medium whitespace-nowrap shrink-0 border-b-2 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 ${
                  isActive
                    ? 'border-teal-600 text-slate-900'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onSaveAll}
            disabled={saving}
            className="inline-flex items-center gap-2 px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-medium text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600"
          >
            {savedNotice ? (
              <Check className="w-4 h-4 shrink-0" aria-hidden="true" />
            ) : (
              <Save className="w-4 h-4 shrink-0" aria-hidden="true" />
            )}
            <span>{savedNotice ? 'ذخیره شد' : saving ? 'در حال ذخیره...' : 'ذخیره تنظیمات'}</span>
          </button>
        </div>
      </div>

      <div className="md:hidden border-t border-slate-100 px-3 py-2 grid grid-cols-2 gap-1.5">
        {NAV_ITEMS.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              className={`px-2.5 py-2 text-xs font-medium rounded-md whitespace-nowrap text-center transition-colors ${
                isActive ? 'bg-teal-50 text-teal-800' : 'text-slate-600 hover:text-slate-900 bg-slate-50/70'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </header>
  );
}
