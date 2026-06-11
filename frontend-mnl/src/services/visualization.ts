export interface VisualizationMoleculeStructure {
  molecule_id: string;
  dataset: string;
  smiles: string;
  mw: number;
  logp: number;
  qed: number;
  pdb: string;
}

export interface VisualizationEmbeddingPoint {
  molecule_id: string;
  dataset: string;
  smiles: string;
  x: number;
  y: number;
  activity: number;
  drugLikeness: number;
}
