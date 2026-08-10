import { create } from 'zustand';

export type AdminPage =
  | 'overview'
  | 'providers'
  | 'security'
  | 'audit'
  | 'features'
  | 'devices'
  | 'settings';

interface AdminNavStore {
  activePage: AdminPage;
  setActivePage: (page: AdminPage) => void;
}

export const useAdminNavStore = create<AdminNavStore>((set) => ({
  activePage: 'overview',
  setActivePage: (page) => set({ activePage: page }),
}));
