import type { Molecule } from "@/types/api";

export const MOCK_MOLECULES: Molecule[] = [
  { molecule_id: "MOL-001", smiles: "CC(=O)Oc1ccccc1C(=O)O", mw: 180.16, logp: 1.19, qed: 0.55, dataset: "FDA Approved" },
  { molecule_id: "MOL-002", smiles: "CC1=CC=C(C=C1)CC(=NN2C3=CC=CC=C3C(=O)C2=O)...", mw: 381.37, logp: 3.53, qed: 0.62, dataset: "FDA Approved" },
  { molecule_id: "MOL-003", smiles: "CN1C=NC2=C1C(=O)N(C(=O)N2C)C", mw: 194.19, logp: -0.07, qed: 0.54, dataset: "Natural Products" },
  { molecule_id: "MOL-004", smiles: "CC(C)CC1=CC=C(C=C1)C(C)C(=O)O", mw: 206.29, logp: 3.97, qed: 0.74, dataset: "FDA Approved" },
  { molecule_id: "MOL-005", smiles: "CN1C2CCC1C(C2)OC(=O)C3=CC=CC=C3C(=O)OCC", mw: 303.35, logp: 2.28, qed: 0.48, dataset: "Natural Products" },
  { molecule_id: "MOL-006", smiles: "CC(=O)NC1=CC=C(C=C1)O", mw: 151.16, logp: 0.46, qed: 0.73, dataset: "FDA Approved" },
  { molecule_id: "MOL-007", smiles: "C1=CC=C(C=C1)CC(C(=O)O)NC(=O)C(CC2=CC=CC=C2)NC...", mw: 432.51, logp: 4.21, qed: 0.38, dataset: "Screening" },
  { molecule_id: "MOL-008", smiles: "COC1=C(C=C2C(=C1)C(=NC=N2)NC3=CC(=C(C=C3)F)Cl)...", mw: 446.9, logp: 3.75, qed: 0.44, dataset: "FDA Approved" },
  { molecule_id: "MOL-009", smiles: "CC1=C(C(=C(C=C1)C)C)C2=CC=CC=C2", mw: 196.29, logp: 4.85, qed: 0.81, dataset: "Screening" },
  { molecule_id: "MOL-010", smiles: "CC(=O)OC1=CC=CC=C1C(=O)OC", mw: 194.18, logp: 1.89, qed: 0.68, dataset: "Screening" },
  { molecule_id: "MOL-011", smiles: "CN(C)CCC1=CNC2=C1C=C(C=C2)O", mw: 176.22, logp: 0.21, qed: 0.65, dataset: "Natural Products" },
  { molecule_id: "MOL-012", smiles: "C1=CC=C(C(=C1)C(=O)O)NC2=CC=CC=C2C1", mw: 261.11, logp: 5.12, qed: 0.52, dataset: "FDA Approved" },
  { molecule_id: "MOL-013", smiles: "CC1=CC2=C(C=C1C)N(C=N2)C3=CC=CC=C3", mw: 222.28, logp: 3.21, qed: 0.77, dataset: "Screening" },
  { molecule_id: "MOL-014", smiles: "COC1=CC=C(C=C1)C2=CC(=O)C3=C(O2)C=C(C=C3O)O", mw: 286.24, logp: 1.97, qed: 0.58, dataset: "Natural Products" },
  { molecule_id: "MOL-015", smiles: "CC(C)NCC(O)C1=CC=C(O)C=C1", mw: 193.27, logp: 0.64, qed: 0.71, dataset: "FDA Approved" },
];
