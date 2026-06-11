import type { EmbeddingPoint } from "@/types/api";

/** Mock UMAP embedding points for chemical space visualization */
export const MOCK_EMBEDDINGS: EmbeddingPoint[] = (() => {
  const datasets = ["ZINC250k", "ChEMBL", "PDBbind", "DrugBank"] as const;
  const sources: EmbeddingPoint["source"][] = ["dataset", "dataset", "fda", "generated"];
  const points: EmbeddingPoint[] = [];
  let i = 0;

  for (let j = 0; j < 400; j++) {
    const dataset = datasets[j % datasets.length];
    const source = sources[j % sources.length];
    const qed = 0.2 + Math.random() * 0.7;
    const mw = 150 + Math.random() * 400;
    const x = (Math.random() - 0.5) * 2;
    const y = (Math.random() - 0.5) * 2;

    points.push({
      x,
      y,
      molecule_id: `mol_${String(1000 + i).padStart(4, "0")}`,
      dataset,
      qed,
      mw,
      source,
    });
    i++;
  }

  return points;
})();
