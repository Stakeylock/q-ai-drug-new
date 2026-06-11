"use client";

type ColorMode = "dataset" | "qed";

interface FiltersPanelProps {
  datasets: string[];
  selectedDataset: string;
  onDatasetChange: (dataset: string) => void;
  mwMin: number;
  mwMax: number;
  mwBounds: { min: number; max: number };
  onMwRangeChange: (min: number, max: number) => void;
  logpMin: number;
  logpMax: number;
  logpBounds: { min: number; max: number };
  onLogpRangeChange: (min: number, max: number) => void;
  qedMin: number;
  qedMax: number;
  onQedRangeChange: (min: number, max: number) => void;
  colorMode: ColorMode;
  onColorModeChange: (mode: ColorMode) => void;
}

export default function FiltersPanel({
  datasets,
  selectedDataset,
  onDatasetChange,
  mwMin,
  mwMax,
  mwBounds,
  onMwRangeChange,
  logpMin,
  logpMax,
  logpBounds,
  onLogpRangeChange,
  qedMin,
  qedMax,
  onQedRangeChange,
  colorMode,
  onColorModeChange,
}: FiltersPanelProps) {
  const handleMinChange = (value: number) => {
    const clamped = Math.min(value, qedMax);
    onQedRangeChange(clamped, qedMax);
  };

  const handleMaxChange = (value: number) => {
    const clamped = Math.max(value, qedMin);
    onQedRangeChange(qedMin, clamped);
  };

  const handleMwMinChange = (value: number) => {
    onMwRangeChange(Math.min(value, mwMax), mwMax);
  };

  const handleMwMaxChange = (value: number) => {
    onMwRangeChange(mwMin, Math.max(value, mwMin));
  };

  const handleLogpMinChange = (value: number) => {
    onLogpRangeChange(Math.min(value, logpMax), logpMax);
  };

  const handleLogpMaxChange = (value: number) => {
    onLogpRangeChange(logpMin, Math.max(value, logpMin));
  };

  const resetFilters = () => {
    onDatasetChange("All");
    onMwRangeChange(mwBounds.min, mwBounds.max);
    onLogpRangeChange(logpBounds.min, logpBounds.max);
    onQedRangeChange(0, 1);
    onColorModeChange("dataset");
  };

  return (
    <div className="space-y-5 rounded-xl border p-4 shadow-sm" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
      <div>
        <h3 className="text-sm font-semibold" style={{ color: "var(--text)" }}>Filters</h3>
        <p className="mt-0.5 text-xs" style={{ color: "var(--muted-text)" }}>Refine the embedding map view</p>
      </div>

      <div>
        <label className="mb-2 block text-xs font-medium" style={{ color: "var(--muted-text)" }}>Dataset</label>
        <select
          value={selectedDataset}
          onChange={(event) => onDatasetChange(event.target.value)}
          className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1"
          style={{ borderColor: "var(--border)", backgroundColor: "var(--card)", color: "var(--text)" }}
        >
          <option value="All">All</option>
          {datasets.map((dataset) => (
            <option key={dataset} value={dataset}>
              {dataset}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-2 block text-xs font-medium" style={{ color: "var(--muted-text)" }}>Color by</label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onColorModeChange("dataset")}
            className="rounded-lg border px-3 py-2 text-sm font-medium transition-colors"
            style={{
              borderColor: colorMode === "dataset" ? "var(--accent-border)" : "var(--border)",
              backgroundColor: colorMode === "dataset" ? "var(--accent-bg)" : "var(--card)",
              color: colorMode === "dataset" ? "var(--accent-text)" : "var(--text)",
            }}
          >
            Dataset
          </button>
          <button
            type="button"
            onClick={() => onColorModeChange("qed")}
            className="rounded-lg border px-3 py-2 text-sm font-medium transition-colors"
            style={{
              borderColor: colorMode === "qed" ? "var(--success)" : "var(--border)",
              backgroundColor: colorMode === "qed" ? "var(--muted-bg)" : "var(--card)",
              color: colorMode === "qed" ? "var(--success)" : "var(--text)",
            }}
          >
            QED
          </button>
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between text-xs font-medium" style={{ color: "var(--muted-text)" }}>
          <span>MW range</span>
          <span>
            {mwMin.toFixed(0)} - {mwMax.toFixed(0)}
          </span>
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-[11px]" style={{ color: "var(--muted-text)" }}>Minimum</label>
            <input
              type="range"
              min={mwBounds.min}
              max={mwBounds.max}
              step={1}
              value={mwMin}
              onChange={(event) => handleMwMinChange(Number(event.target.value))}
              className="h-2 w-full cursor-pointer appearance-none rounded-lg"
              style={{ backgroundColor: "var(--border)" }}
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px]" style={{ color: "var(--muted-text)" }}>Maximum</label>
            <input
              type="range"
              min={mwBounds.min}
              max={mwBounds.max}
              step={1}
              value={mwMax}
              onChange={(event) => handleMwMaxChange(Number(event.target.value))}
              className="h-2 w-full cursor-pointer appearance-none rounded-lg"
              style={{ backgroundColor: "var(--border)" }}
            />
          </div>
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between text-xs font-medium" style={{ color: "var(--muted-text)" }}>
          <span>LogP range</span>
          <span>
            {logpMin.toFixed(2)} - {logpMax.toFixed(2)}
          </span>
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-[11px]" style={{ color: "var(--muted-text)" }}>Minimum</label>
            <input
              type="range"
              min={logpBounds.min}
              max={logpBounds.max}
              step={0.05}
              value={logpMin}
              onChange={(event) => handleLogpMinChange(Number(event.target.value))}
              className="h-2 w-full cursor-pointer appearance-none rounded-lg"
              style={{ backgroundColor: "var(--border)" }}
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px]" style={{ color: "var(--muted-text)" }}>Maximum</label>
            <input
              type="range"
              min={logpBounds.min}
              max={logpBounds.max}
              step={0.05}
              value={logpMax}
              onChange={(event) => handleLogpMaxChange(Number(event.target.value))}
              className="h-2 w-full cursor-pointer appearance-none rounded-lg"
              style={{ backgroundColor: "var(--border)" }}
            />
          </div>
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between text-xs font-medium" style={{ color: "var(--muted-text)" }}>
          <span>QED range</span>
          <span>
            {qedMin.toFixed(2)} - {qedMax.toFixed(2)}
          </span>
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-[11px]" style={{ color: "var(--muted-text)" }}>Minimum</label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={qedMin}
              onChange={(event) => handleMinChange(Number(event.target.value))}
              className="h-2 w-full cursor-pointer appearance-none rounded-lg"
              style={{ backgroundColor: "var(--border)" }}
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px]" style={{ color: "var(--muted-text)" }}>Maximum</label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={qedMax}
              onChange={(event) => handleMaxChange(Number(event.target.value))}
              className="h-2 w-full cursor-pointer appearance-none rounded-lg"
              style={{ backgroundColor: "var(--border)" }}
            />
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={resetFilters}
        className="w-full rounded-lg border px-3 py-2 text-sm font-medium transition-colors"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--card)", color: "var(--text)" }}
      >
        Reset filters
      </button>
    </div>
  );
}