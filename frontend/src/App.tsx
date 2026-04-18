// ════════════════════════════════════════════════════════════════════════
//  JATAYU GCS — App Shell (Rewritten)
// ════════════════════════════════════════════════════════════════════════

import { Suspense, lazy, useEffect } from 'react';
import { useMissionStore } from '@/store/missionStore';
import { connectWebSocket } from '@/services/websocket';
import Sidebar from '@/components/layout/Sidebar';
import Topbar from '@/components/layout/Topbar';
import Ticker from '@/components/layout/Ticker';
import ActionLogPanel from '@/components/layout/ActionLogPanel';
import { LoadingState } from '@/components/shared';

const OverviewPage = lazy(() => import('@/pages/OverviewPage'));
const MissionControlPage = lazy(() => import('@/pages/MissionControlPage'));
const TacticalMapPage = lazy(() => import('@/pages/TacticalMapPage'));
const SavedTargetsPage = lazy(() => import('@/pages/SavedTargetsPage'));
const PayloadDropPage = lazy(() => import('@/pages/PayloadDropPage'));
const RecordingsPage = lazy(() => import('@/pages/RecordingsPage'));
const SettingsPage = lazy(() => import('@/pages/SettingsPage'));
const RoutePlannerPage = lazy(() => import('@/pages/RoutePlannerPage'));

const PAGE_MAP: Record<string, React.LazyExoticComponent<React.ComponentType>> = {
  'overview': OverviewPage,
  'mission': MissionControlPage,
  'tactical-map': TacticalMapPage,
  'targets': SavedTargetsPage,
  'payload': PayloadDropPage,
  'recordings': RecordingsPage,
  'settings': SettingsPage,
  'route-planner': RoutePlannerPage,
};

export default function App() {
  const activeTab = useMissionStore((s) => s.activeTab);
  const setActiveTab = useMissionStore((s) => s.setActiveTab);

  useEffect(() => { connectWebSocket(); }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!e.altKey) return;
      const tabs = ['overview', 'mission', 'tactical-map', 'targets', 'payload', 'recordings', 'settings', 'route-planner'] as const;
      const idx = parseInt(e.key) - 1;
      if (idx >= 0 && idx < tabs.length) {
        e.preventDefault();
        setActiveTab(tabs[idx]);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [setActiveTab]);

  const ActivePage = PAGE_MAP[activeTab] || OverviewPage;

  return (
    <div className="gcs-shell">
      <Sidebar />
      <main className="gcs-main" style={{ display: 'flex', flexDirection: 'column' }}>
        <Topbar />
        <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
          <Suspense fallback={<LoadingState text="Loading module..." />}>
            <ActivePage key={activeTab} />
          </Suspense>
        </div>
        <Ticker />
      </main>
      <ActionLogPanel />
    </div>
  );
}
