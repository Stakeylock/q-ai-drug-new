"use client";

const DATASETS = ["All", "ZINC250k", "ChEMBL", "PDBbind", "DrugBank"] as const;

interface ChemicalSpaceFiltersProps {
  dataset: string;
  onDatasetChange: (dataset: string) => void;
  qedMin: number;
  qedMax: number;
  onQedChange: (min: number, max: number) => void;
}

export default function ChemicalSpaceFilters({
  dataset,
  onDatasetChange,
  qedMin,
  qedMax,
  onQedChange,
}: ChemicalSpaceFiltersProps) {
  const handleQedMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    onQedChange(val, Math.max(val, qedMax));
  };

  const handleQedMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    onQedChange(Math.min(val, qedMin), val);
  };

  const resetFilters = () => {
    onDatasetChange("All");
    onQedChange(0, 1);
  };

  return (
    <div className="space-y-6 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
      <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300">
        Filters
      </h3>

      <div>
        <label className="mb-2 block text-xs font-medium text-slate-500 dark:text-slate-400">
          Dataset
        </label>
        <select
          value={dataset}
          onChange={(e) => onDatasetChange(e.target.value)}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition-colors focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
        >
          {DATASETS.map((ds) => (
            <option key={ds} value={ds}>
              {ds}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-2 block text-xs font-medium text-slate-500 dark:text-slate-400">
          QED range: {qedMin.toFixed(2)} – {qedMax.toFixed(2)}
        </label>
        <div className="space-y-3">
          <div>
            <span className="mb-1 block text-[10px] text-slate-400">Min</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={qedMin}
              onChange={handleQedMinChange}
              className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 dark:bg-slate-600"
            />
          </div>
          <div>
            <span className="mb-1 block text-[10px] text-slate-400">Max</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={qedMax}
              onChange={handleQedMaxChange}
              className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 dark:bg-slate-600"
            />
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={resetFilters}
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-700"
      >
        Reset filters
      </button>
    </div>
  );
}
