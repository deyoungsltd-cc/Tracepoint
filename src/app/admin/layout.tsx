'use client';

import { useState, useCallback } from 'react';
import { Shield } from 'lucide-react';
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
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 rounded-full mx-auto flex items-center justify-center bg-[#c8a24e]/8 border border-[#c8a24e]/15">
            <Shield className="w-6 h-6 text-[#c8a24e]" />
          </div>
          <p className="text-sm font-medium text-foreground">Access Denied</p>
          <p className="text-xs text-muted-foreground">Admin role required to view this panel.</p>
          <button
            onClick={handleBackToApp}
            className="mt-2 px-4 py-1.5 rounded text-xs font-medium bg-[#c8a24e]/8 border border-[#c8a24e]/15 text-[#c8a24e] hover:bg-[#c8a24e]/12 transition-colors"
          >
            Return to App
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex overflow-hidden bg-background">
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
        <main className="flex-1 overflow-y-auto p-5">
          {children}
        </main>
      </div>

      {/* Portal root for admin modals / dropdowns */}
      <div id="admin-root" />
    </div>
  );
}
