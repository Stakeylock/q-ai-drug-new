"use client";

import { useEffect, useRef, useState } from "react";
import { useUiStore } from "@/store";
import { getDatasets } from "@/services/api";

export default function DatasetSelector() {
  const selectedDataset = useUiStore((s) => s.selectedDataset);
  const setSelectedDataset = useUiStore((s) => s.setSelectedDataset);

  const [datasets, setDatasets] = useState<string[]>([]);
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    if (hasLoadedRef.current) {
      return;
    }
    hasLoadedRef.current = true;

    let active = true;
    getDatasets()
      .then((data) => {
        if (!active) {
          return;
        }

        setDatasets(data.datasets);

        const fallbackDataset = data.datasets[0] ?? null;
        if (!selectedDataset && fallbackDataset) {
          setSelectedDataset(fallbackDataset);
        } else if (selectedDataset && !data.datasets.includes(selectedDataset) && fallbackDataset) {
          setSelectedDataset(fallbackDataset);
        }
      })
      .catch((err) => {
        console.error("Failed to fetch datasets:", err);
      });
    return () => {
      active = false;
    };
  }, [selectedDataset, setSelectedDataset]);

  return (
    <div className="relative flex items-center">
      <div className="pointer-events-none absolute left-3 flex items-center">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-teal-500">
          <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
          <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path>
          <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>
        </svg>
      </div>
      <select
        id="dataset-select"
        value={selectedDataset ?? datasets[0] ?? ""}
        onChange={(e) => setSelectedDataset(e.target.value)}
        className="h-10 cursor-pointer appearance-none rounded-lg border border-slate-200 bg-white px-10 text-sm font-medium text-slate-900 shadow-sm transition-colors hover:border-slate-300 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 dark:border-[#1e293b] dark:bg-[#0b0f19] dark:text-slate-200 dark:hover:border-[#334155]"
      >
        {datasets.map((ds) => (
          <option key={ds} value={ds}>
            {ds}
          </option>
        ))}
      </select>
      <div className="pointer-events-none absolute right-3 flex items-center">
        <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </div>
  );
}
