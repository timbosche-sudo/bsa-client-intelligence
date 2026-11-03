import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemePref = 'dark' | 'light';

interface Preferences {
  theme: ThemePref;
  sidebarCollapsed: boolean;
  lastClientId: string | null;
  setTheme(t: ThemePref): void;
  toggleSidebar(): void;
  setLastClientId(id: string): void;
}

/** Per-browser UI preferences. Not business data; not included in backups. */
export const usePreferences = create<Preferences>()(
  persist(
    (set) => ({
      theme: 'dark',
      sidebarCollapsed: false,
      lastClientId: null,
      setTheme: (theme) => set({ theme }),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setLastClientId: (lastClientId) => set({ lastClientId }),
    }),
    { name: 'bsa-ci:prefs' },
  ),
);
