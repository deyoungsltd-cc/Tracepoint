'use client';

import { useState, useCallback } from 'react';
import { useAuthStore, useNavStore } from '@/lib/store/app';
import { useAdminNavStore } from '@/lib/store/admin-nav';
import { AdminSidebar } from '@/components/tracepoint/admin/AdminSidebar';
import { AdminHeader } from '@/components/tracepoint/admin/AdminHeader';
import type { AdminPage } from '@/lib/store/admin-nav';

const pageTitles: Record<AdminPage, string> = {
  overview: 'System Overview',
  providers: 'Provider Management',
  security: 'Security Events',
  audit: 'Audit Log',
  features: 'Feature Flags',
  devices: 'Device Authorizations',
  settings: 'Admin Settings',
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const { navigate } = useNavStore();
  const { activePage, setActivePage } = useAdminNavStore();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((c) => !c);
  }, []);

  const handleBackToApp = useCallback(() => {
    navigate('dashboard');
  }, [navigate]);

  // Auth guard
  if (!user || user.role !== 'admin') {
    return (
      <div className="h-screen flex items-center justify-center" style={{ background: '#f8f8f6' }}>
        <div className="text-center space-y-3">
          <div
            className="w-12 h-12 rounded-full mx-auto flex items-center justify-center"
            style={{ background: 'rgba(180, 83, 9, 0.08)' }}
          >
            <svg className="w-6 h-6" style={{ color: '#b45309' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <p className="text-sm font-medium" style={{ color: '#1a1a1a' }}>Access Denied</p>
          <p className="text-xs" style={{ color: '#6b6b6b' }}>Admin role required to view this panel.</p>
          <button
            onClick={handleBackToApp}
            className="mt-2 px-4 py-1.5 rounded-md text-xs font-medium transition-colors"
            style={{
              background: 'rgba(180, 83, 9, 0.08)',
              color: '#b45309',
              border: '1px solid rgba(180, 83, 9, 0.15)',
            }}
          >
            Return to App
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex overflow-hidden" style={{ background: '#f0f0ec' }}>
      {/* Admin Sidebar */}
      <AdminSidebar
        activePage={activePage}
        onPageChange={setActivePage}
        collapsed={sidebarCollapsed}
        onToggleCollapse={toggleSidebar}
        onBackToApp={handleBackToApp}
      />

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0">
        <AdminHeader title={pageTitles[activePage]} />

        <main className="flex-1 overflow-y-auto p-5" style={{ background: '#f0f0ec' }}>
          {children}
        </main>
      </div>

      {/* Portal root for admin modals / dropdowns */}
      <div id="admin-root" />
    </div>
  );
}
