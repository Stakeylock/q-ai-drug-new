"use client";

interface DatasetInsightsPanelProps {
  totalDatasets: number;
  activeDataset: string;
  totalMolecules: number | null;
}

interface InsightCardProps {
  label: string;
  value: string;
  note?: string;
}

function InsightCard({ label, value, note }: InsightCardProps) {
  return (
    <div className="ui-hover-lift ui-state-transition rounded-lg border border-slate-200/80 bg-slate-50 px-4 py-3 hover:bg-slate-100/80 dark:border-slate-800 dark:bg-slate-900/60 dark:hover:bg-slate-900/90">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-base font-semibold leading-6 text-slate-900 dark:text-slate-100">{value}</p>
      {note ? <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{note}</p> : null}
    </div>
  );
}

export default function DatasetInsightsPanel({
  totalDatasets,
  activeDataset,
  totalMolecules,
}: DatasetInsightsPanelProps) {
  return (
    <section className="ui-fade-in ui-hover-lift ui-state-transition rounded-xl border border-slate-200 bg-white p-5 shadow-lg hover:shadow-xl dark:border-[#1e293b] dark:bg-[#0b0f19]">
      <div className="mb-4">
        <h2 className="text-sm font-semibold tracking-[0.01em] text-slate-900 dark:text-slate-100">
          Dataset Insights
        </h2>
        <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
          Compact overview of dataset coverage and quality signals.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <InsightCard
          label="Total Datasets"
          value={totalDatasets.toLocaleString()}
          note="Available for exploration"
        />
        <InsightCard
          label="Active Dataset"
          value={activeDataset}
          note="Currently loaded in dashboard"
        />
        <InsightCard
          label="Total Molecules"
          value={(totalMolecules ?? 0).toLocaleString()}
          note="Count returned by GET /datasets/{name}"
        />
      </div>
    </section>
  );
}
