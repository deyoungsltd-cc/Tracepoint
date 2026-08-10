'use client';

import { useEffect, Suspense, lazy } from 'react';
import { useNavStore, useAuthStore } from '@/lib/store/app';
import { Sidebar } from '@/components/tracepoint/layout/Sidebar';
import { Header } from '@/components/tracepoint/layout/Header';

// Lazy-load view components for code splitting
const AuthView = lazy(() => import('@/components/tracepoint/auth/AuthView'));
const DashboardView = lazy(() => import('@/components/tracepoint/layout/Dashboard'));
const InvestigationWorkspace = lazy(() => import('@/components/tracepoint/investigation/InvestigationWorkspace'));
const InvestigationDetail = lazy(() => import('@/components/tracepoint/investigation/InvestigationDetail'));
const HistoryView = lazy(() => import('@/components/tracepoint/layout/HistoryView'));
const DevicesView = lazy(() => import('@/components/tracepoint/layout/DevicesView'));
const AdminDashboard = lazy(() => import('@/components/tracepoint/admin/AdminDashboard'));
const SettingsView = lazy(() => import('@/components/tracepoint/layout/SettingsView'));
const ReportsView = lazy(() => import('@/components/tracepoint/layout/ReportsView'));

function LoadingFallback({ name }: { name: string }) {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center space-y-2">
        <div className="w-6 h-6 border-2 border-tp-amber/30 border-t-tp-amber rounded-full animate-spin mx-auto" />
        <span className="tp-hud text-xs">Loading {name}...</span>
      </div>
    </div>
  );
}

function AppContent() {
  const { currentView, sidebarOpen } = useNavStore();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  // Auth gate
  if (!isAuthenticated) {
    return (
      <Suspense fallback={<LoadingFallback name="Authentication" />}>
        <AuthView />
      </Suspense>
    );
  }

  // Main application shell
  return (
    <div className="min-h-screen flex bg-background">
      <Sidebar />
      <div
        className={`flex-1 flex flex-col min-h-screen transition-all duration-300 ${
          sidebarOpen ? 'lg:ml-56' : 'lg:ml-14'
        }`}
      >
        <Header />
        <main className="flex-1 overflow-hidden">
          <Suspense fallback={<LoadingFallback name={currentView} />}>
            {currentView === 'dashboard' && <DashboardView />}
            {currentView === 'investigation' && <InvestigationWorkspace />}
            {currentView === 'investigation-detail' && <InvestigationDetail />}
            {currentView === 'history' && <HistoryView />}
            {currentView === 'devices' && <DevicesView />}
            {currentView === 'admin' && <AdminDashboard />}
            {currentView === 'settings' && <SettingsView />}
            {currentView === 'reports' && <ReportsView />}
          </Suspense>
        </main>
      </div>
    </div>
  );
}

export default function Home() {
  // Listen for custom navigation events from child components
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.view) {
        useNavStore.getState().navigate(detail.view, detail.id);
      }
    };
    window.addEventListener('tp-navigate', handler);
    return () => window.removeEventListener('tp-navigate', handler);
  }, []);

  return <AppContent />;
}