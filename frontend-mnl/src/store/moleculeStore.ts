import { create } from "zustand";
import type { Molecule } from "@/types/api";

interface MoleculeState {
  molecules: Molecule[];
  isLoading: boolean;

  setMolecules: (molecules: Molecule[]) => void;
  setLoading: (loading: boolean) => void;
}

export const useMoleculeStore = create<MoleculeState>((set) => ({
  molecules: [],
  isLoading: false,

  setMolecules: (molecules) => set({ molecules }),
  setLoading: (isLoading) => set({ isLoading }),
}));
