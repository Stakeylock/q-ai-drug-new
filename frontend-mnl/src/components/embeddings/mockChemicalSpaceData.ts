import { MOCK_MOLECULES } from "@/components/molecules/mockMolecules";

export interface ChemicalSpacePoint {
  molecule_id: string;
  smiles: string;
  dataset: string;
  x: number;
  y: number;
  activity: number;
  drugLikeness: number;
}

export const MOCK_CHEMICAL_SPACE_DATA: ChemicalSpacePoint[] = MOCK_MOLECULES.map(
  (molecule, index) => {
    const angle = (index + 1) * 0.58;
    const radial = 0.9 + (index % 5) * 0.28;
    const x = Number((Math.cos(angle) * radial + (molecule.logp - 2) * 0.22).toFixed(3));
    const y = Number((Math.sin(angle) * radial + (molecule.mw - 260) / 340).toFixed(3));
    const activity = Math.max(
      0,
      Math.min(1, Number((0.18 + molecule.qed * 0.72 + (4.5 - Math.abs(molecule.logp - 2.2)) * 0.03).toFixed(3))),
    );

    return {
      molecule_id: molecule.molecule_id,
      smiles: molecule.smiles,
      dataset: molecule.dataset,
      x,
      y,
      activity,
      drugLikeness: Number(molecule.qed.toFixed(3)),
    };
  },
);
