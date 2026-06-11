"use client";

import MoleculeViewer from "../molecules/MoleculeViewer";
import { useUiStore } from "@/store/uiStore";

interface RightPanelProps {
  isOpen: boolean;
  onToggle: () => void;
}

const ChevronLeftIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="m15 18-6-6 6-6" />
  </svg>
);

const ChevronRightIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="m9 18 6-6-6-6" />
  </svg>
);

export default function RightPanel({ isOpen, onToggle }: RightPanelProps) {
  const selectedMoleculeId = useUiStore((s) => s.selectedMoleculeId);

  return (
    <aside
      className={`flex flex-shrink-0 flex-col border-l border-border bg-card transition-all duration-300 ease-out ${
        isOpen ? "w-80 md:w-96" : "w-12"
      }`}
    >
      {!isOpen ? (
        <div className="flex flex-1 flex-col items-center justify-start pt-4">
          <button
            type="button"
            onClick={onToggle}
            className="flex items-center justify-center rounded-xl p-2 text-text-secondary transition-all duration-200 hover:bg-surface-subtle hover:text-text hover:-translate-x-[1px]"
            aria-label="Open molecule viewer"
          >
            <ChevronLeftIcon />
          </button>
        </div>
      ) : (
        <>
          <div className="flex h-16 flex-shrink-0 items-center justify-between border-b border-border/50 px-5">
            <h2 className="text-xs font-bold uppercase tracking-widest text-text-secondary">
              Research Analytics
            </h2>
            <button
              type="button"
              onClick={onToggle}
              className="rounded-xl p-2 text-text-secondary transition-all hover:bg-surface-subtle hover:text-text"
              aria-label="Close panel"
            >
              <ChevronRightIcon />
            </button>
          </div>
          <div className="panel-enter flex min-h-0 flex-1 flex-col p-4">
            <MoleculeViewer moleculeId={selectedMoleculeId} />
          </div>
        </>
      )}
    </aside>

  );
}
