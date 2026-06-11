import { create } from "zustand";

export interface DashboardUser {
  id: string;
  name: string;
  email: string;
  role?: string;
}

export interface UiPreferences {
  theme: "dark" | "light" | "system";
  compactMode: boolean;
  sidebarCollapsed: boolean;
}

export interface DashboardStoreState {
  user: DashboardUser | null;
  currentDataset: string | null;
  uiPreferences: UiPreferences;

  setUser: (user: DashboardUser | null) => void;
  setCurrentDataset: (dataset: string | null) => void;
  setUiPreferences: (preferences: Partial<UiPreferences>) => void;
  resetDashboardState: () => void;
}

const DEFAULT_UI_PREFERENCES: UiPreferences = {
  theme: "dark",
  compactMode: false,
  sidebarCollapsed: false,
};

export const useDashboardStore = create<DashboardStoreState>((set) => ({
  user: null,
  currentDataset: null,
  uiPreferences: DEFAULT_UI_PREFERENCES,

  setUser: (user) => set({ user }),
  setCurrentDataset: (dataset) => set({ currentDataset: dataset }),
  setUiPreferences: (preferences) =>
    set((state) => ({
      uiPreferences: {
        ...state.uiPreferences,
        ...preferences,
      },
    })),
  resetDashboardState: () =>
    set({
      user: null,
      currentDataset: null,
      uiPreferences: DEFAULT_UI_PREFERENCES,
    }),
}));
