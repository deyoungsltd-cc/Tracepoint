'use client';

import { useEffect, Suspense, lazy } from 'react';
import { useNavStore, useAuthStore } from '@/lib/store/app';
import { Sidebar } from '@/components/tracepoint/layout/Sidebar';
import { Header } from '@/components/tracepoint/layout/Header';

const AuthView = lazy(() => import('@/components/tracepoint/auth/AuthView'));
const DashboardView = lazy(() => import('@/components/tracepoint/layout/Dashboard'));
const InvestigationWorkspace = lazy(() => import('@/components/tracepoint/investigation/InvestigationWorkspace'));
const InvestigationDetail = lazy(() => import('@/components/tracepoint/investigation/InvestigationDetail'));
const HistoryView = lazy(() => import('@/components/tracepoint/layout/HistoryView'));
const DevicesView = lazy(() => import('@/components/tracepoint/layout/DevicesView'));
// Admin is now a separate route at /admin — no longer embedded in the main page
const SettingsView = lazy(() => import('@/components/tracepoint/layout/SettingsView'));
const ReportsView = lazy(() => import('@/components/tracepoint/layout/ReportsView'));

function Loading({ name }: { name: string }) {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="w-5 h-5 border-2 border-[#c8a24e]/20 border-t-[#c8a24e] rounded-full animate-spin" />
    </div>
  );
}

// Standard app shell with sidebar + header
function AppShell() {
  const { currentView, sidebarOpen } = useNavStore();

  return (
    <div className="h-screen flex bg-background overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="flex-1 overflow-hidden">
          <Suspense fallback={<Loading name={currentView} />}>
            {currentView === 'dashboard' && <DashboardView />}
            {currentView === 'investigation' && <InvestigationWorkspace />}
            {currentView === 'investigation-detail' && <InvestigationDetail />}
            {currentView === 'history' && <HistoryView />}
            {currentView === 'devices' && <DevicesView />}
            {currentView === 'settings' && <SettingsView />}
            {currentView === 'reports' && <ReportsView />}
          </Suspense>
        </main>
      </div>
    </div>
  );
}

function AppContent() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const currentView = useNavStore((s) => s.currentView);

  if (!isAuthenticated) {
    return (
      <Suspense fallback={<Loading name="Auth" />}>
        <AuthView />
      </Suspense>
    );
  }

  return <AppShell />;
}

export default function Home() {
  useEffect(() => {
    const handler = (e: Event) => {
      const d = (e as CustomEvent).detail;
      if (d?.view) useNavStore.getState().navigate(d.view, d.id);
    };
    window.addEventListener('tp-navigate', handler);
    return () => window.removeEventListener('tp-navigate', handler);
  }, []);

  return <AppContent />;
}
