import React, { useState } from 'react';
import {
  BotConfig,
  BotSimState,
  DEFAULT_BOT_CONFIG,
  createInitialSimState,
} from './utils/botEngine';
import { AppTab, TopBar } from './components/TopBar';
import { BotSimulatorView } from './components/BotSimulatorView';
import { ConfigBuilderView } from './components/ConfigBuilderView';
import { CliSystemdView } from './components/CliSystemdView';
import { CodeExplorerView } from './components/CodeExplorerView';

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>('simulator');
  const [config, setConfig] = useState<BotConfig>(DEFAULT_BOT_CONFIG);
  const [sim, setSim] = useState<BotSimState>(() => createInitialSimState(DEFAULT_BOT_CONFIG));

  const handleDownloadBundle = () => {
    window.location.assign('/api/download-bundle');
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <TopBar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onDownloadBundle={handleDownloadBundle}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {activeTab === 'simulator' && (
          <BotSimulatorView
            config={config}
            sim={sim}
            onChangeSim={setSim}
            onResetSim={() => setSim(createInitialSimState(config))}
          />
        )}

        {activeTab === 'config' && (
          <ConfigBuilderView config={config} onChangeConfig={setConfig} />
        )}

        {activeTab === 'cli' && (
          <CliSystemdView config={config} onChangeConfig={setConfig} />
        )}

        {activeTab === 'code' && (
          <CodeExplorerView onDownloadBundle={handleDownloadBundle} />
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <span>
            زیرساخت پایتون ۳ و aiogram 3.x · دیتابیس SQLite بهینه · اتصال با API Token · پروکسی SOCKS5 · ابزار vpn-bot و systemd
          </span>
          <span className="font-mono" dir="ltr">
            sudo bash install.sh
          </span>
        </div>
      </footer>
    </div>
  );
}
