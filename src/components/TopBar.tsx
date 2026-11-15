import React from 'react';
import { Download } from 'lucide-react';

export type AppTab = 'simulator' | 'config' | 'cli' | 'code';

interface TopBarProps {
  activeTab: AppTab;
  onSelectTab: (tab: AppTab) => void;
  onDownloadBundle: () => void;
}

const NAV_ITEMS: { id: AppTab; label: string }[] = [
  { id: 'simulator', label: 'شبیه‌ساز ربات' },
  { id: 'config', label: 'پیکربندی و توکن' },
  { id: 'cli', label: 'سرویس و ابزار CLI' },
  { id: 'code', label: 'کد پروژه و نصب' },
];

export function TopBar({ activeTab, onSelectTab, onDownloadBundle }: TopBarProps) {
  return (
    <header className="md:sticky md:top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4 sm:gap-8">
        <button
          type="button"
          onClick={() => onSelectTab('simulator')}
          className="text-base sm:text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 rounded"
        >
          مدیریت ربات 3X-UI
        </button>

        <nav
          aria-label="ناوبری اصلی"
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
            onClick={onDownloadBundle}
            className="inline-flex items-center gap-2 px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600"
          >
            <Download className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>دانلود بسته نصب</span>
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
