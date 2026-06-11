import { create } from "zustand";

interface UiState {
  selectedDataset: string | null;
  selectedMoleculeId: string | null;
  isRightPanelOpen: boolean;

  setSelectedDataset: (dataset: string | null) => void;
  setSelectedMolecule: (moleculeId: string | null) => void;
  setRightPanelOpen: (open: boolean) => void;
  toggleRightPanel: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  selectedDataset: null,
  selectedMoleculeId: null,
  isRightPanelOpen: false,

  setSelectedDataset: (dataset) => set({ selectedDataset: dataset }),
  setSelectedMolecule: (moleculeId) =>
    set({ selectedMoleculeId: moleculeId }),
  setRightPanelOpen: (open) => set({ isRightPanelOpen: open }),
  toggleRightPanel: () =>
    set((state) => ({ isRightPanelOpen: !state.isRightPanelOpen })),
}));
