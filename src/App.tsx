import React, { useEffect, useState } from 'react';
import { WebPanelState, createDefaultPanelState } from './utils/webPanelEngine';
import { TopBar, WebPanelTab } from './components/TopBar';
import { ConnectionSettingsView } from './components/ConnectionSettingsView';
import { InboundsView } from './components/InboundsView';
import { UsersFinanceView } from './components/UsersFinanceView';
import { PlansConfigsView } from './components/PlansConfigsView';

export default function App() {
  const [activeTab, setActiveTab] = useState<WebPanelTab>('connections');
  const [panelState, setPanelState] = useState<WebPanelState>(() => createDefaultPanelState());
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);

  useEffect(() => {
    let mounted = true;
    fetch('/api/panel-state')
      .then((res) => res.json())
      .then((data: { ok: boolean; state?: WebPanelState }) => {
        if (mounted && data.ok && data.state) {
          setPanelState(data.state);
        }
      })
      .catch(() => {
        // Keep default initial state on transient fetch error
      });
    return () => {
      mounted = false;
    };
  }, []);

  const handleSaveState = async (override?: WebPanelState) => {
    const target = override ?? panelState;
    setSaving(true);
    try {
      const res = await fetch('/api/panel-state', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: target }),
      });
      if (res.ok) {
        setSavedNotice(true);
        setTimeout(() => setSavedNotice(false), 1800);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <TopBar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        saving={saving}
        savedNotice={savedNotice}
        onSaveAll={() => handleSaveState()}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {activeTab === 'connections' && (
          <ConnectionSettingsView
            state={panelState}
            onUpdateState={setPanelState}
            onSaveState={handleSaveState}
          />
        )}

        {activeTab === 'inbounds' && (
          <InboundsView
            state={panelState}
            onUpdateState={setPanelState}
            onSaveState={handleSaveState}
          />
        )}

        {activeTab === 'users' && (
          <UsersFinanceView
            state={panelState}
            onUpdateState={setPanelState}
            onSaveState={handleSaveState}
          />
        )}

        {activeTab === 'plans_configs' && (
          <PlansConfigsView
            state={panelState}
            onUpdateState={setPanelState}
            onSaveState={handleSaveState}
          />
        )}
      </main>
    </div>
  );
}
