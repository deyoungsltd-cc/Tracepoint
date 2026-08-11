'use client';

import React, { useEffect, Suspense, lazy, Component } from 'react';
import { useNavStore, useAuthStore } from '@/lib/store/app';
import { Sidebar } from '@/components/tracepoint/layout/Sidebar';
import { Header } from '@/components/tracepoint/layout/Header';

const AuthView = lazy(() => import('@/components/tracepoint/auth/AuthView'));
const DashboardView = lazy(() => import('@/components/tracepoint/layout/Dashboard'));
const InvestigationWorkspace = lazy(() => import('@/components/tracepoint/investigation/InvestigationWorkspace'));
const InvestigationDetail = lazy(() => import('@/components/tracepoint/investigation/InvestigationDetail'));
const BatchLookup = lazy(() => import('@/components/tracepoint/investigation/BatchLookup'));
const HistoryView = lazy(() => import('@/components/tracepoint/layout/HistoryView'));
const DevicesView = lazy(() => import('@/components/tracepoint/layout/DevicesView'));
const DeviceFingerprint = lazy(() => import('@/components/tracepoint/shared/DeviceFingerprint'));
const SettingsView = lazy(() => import('@/components/tracepoint/layout/SettingsView'));
const ReportsView = lazy(() => import('@/components/tracepoint/layout/ReportsView'));

function Loading({ name }: { name: string }) {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="w-5 h-5 border-2 border-[#c8a24e]/20 border-t-[#c8a24e] rounded-full animate-spin" />
    </div>
  );
}

class ViewErrorBoundary extends Component<React.PropsWithChildren, { hasError: boolean; error?: string }> {
  state = { hasError: false, error: '' };
  static getDerivedStateFromError(e: any) { return { hasError: true, error: e?.message || 'Unknown error' }; }
  componentDidCatch(e: any) { console.error('[ViewErrorBoundary]', e); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center max-w-md">
            <div className="w-10 h-10 rounded-full bg-[#b83a3a]/10 border border-[#b83a3a]/15 flex items-center justify-center mx-auto mb-3">
              <span className="text-[#b83a3a] text-lg font-bold">!</span>
            </div>
            <p className="text-sm text-foreground mb-1">Something went wrong</p>
            <p className="text-xs text-muted-foreground/60 mb-3">{this.state.error}</p>
            <button
              onClick={() => { this.setState({ hasError: false, error: '' }); }}
              className="text-xs text-[#c8a24e] hover:text-foreground transition-colors"
            >
              Try again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
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
          <ViewErrorBoundary>
            <Suspense fallback={<Loading name={currentView} />}>
              {currentView === 'dashboard' && <DashboardView />}
              {currentView === 'investigation' && <InvestigationWorkspace />}
              {currentView === 'investigation-detail' && <InvestigationDetail />}
              {currentView === 'batch-lookup' && <BatchLookup />}
              {currentView === 'history' && <HistoryView />}
              {currentView === 'devices' && <DevicesView />}
              {currentView === 'device-fingerprint' && <DeviceFingerprint />}
              {currentView === 'settings' && <SettingsView />}
              {currentView === 'reports' && <ReportsView />}
            </Suspense>
          </ViewErrorBoundary>
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