"use client";

import { useWorkspaceStore } from "@/store";

const statusMeta: Record<
  ReturnType<typeof useWorkspaceStore.getState>["pipelineState"],
  {
    badgeLabel: string;
    badgeStyle: React.CSSProperties;
    detail: string;
  }
> = {
  idle: {
    badgeLabel: "Idle",
    badgeStyle: {
      borderColor: "var(--border)",
      backgroundColor: "var(--muted-bg)",
      color: "var(--text)",
    },
    detail: "Waiting for a pipeline action.",
  },
  generating: {
    badgeLabel: "Generating",
    badgeStyle: {
      borderColor: "var(--accent-border)",
      backgroundColor: "var(--accent-bg)",
      color: "var(--accent-text)",
    },
    detail: "Creating new candidate molecules from input constraints.",
  },
  docking: {
    badgeLabel: "Docking",
    badgeStyle: {
      borderColor: "var(--warning)",
      backgroundColor: "var(--muted-bg)",
      color: "var(--warning)",
    },
    detail: "Evaluating binding affinity across selected targets.",
  },
  running_full_pipeline: {
    badgeLabel: "Full Pipeline",
    badgeStyle: {
      borderColor: "var(--info)",
      backgroundColor: "var(--muted-bg)",
      color: "var(--info)",
    },
    detail: "Running generation, docking, and post-processing steps.",
  },
  completed: {
    badgeLabel: "Completed",
    badgeStyle: {
      borderColor: "var(--success)",
      backgroundColor: "var(--muted-bg)",
      color: "var(--success)",
    },
    detail: "Latest run finished successfully.",
  },
  error: {
    badgeLabel: "Error",
    badgeStyle: {
      borderColor: "var(--error)",
      backgroundColor: "var(--error-bg)",
      color: "var(--error-text)",
    },
    detail: "Run failed. Inspect logs and retry.",
  },
};

function formatPipelineState(state: ReturnType<typeof useWorkspaceStore.getState>["pipelineState"]) {
  return state.replace(/_/g, " ");
}

const actionDisplayMap = {
  generate: "generate molecules",
  docking: "run docking",
  pipeline: "run full pipeline",
} as const;

export default function WorkspaceStatusPanel() {
  const pipelineState = useWorkspaceStore((s) => s.pipelineState);
  const lastAction = useWorkspaceStore((s) => s.lastAction);
  const errorMessage = useWorkspaceStore((s) => s.errorMessage);

  const meta = statusMeta[pipelineState];
  const isRunning =
    pipelineState === "generating" ||
    pipelineState === "docking" ||
    pipelineState === "running_full_pipeline";

  const statusCards = [
    {
      label: "Run State",
      value: formatPipelineState(pipelineState),
      detail: meta.detail,
    },
    {
      label: "Model",
      value: "qforge-v4",
      detail: "Latent diffusion with property guidance",
    },
    {
      label: "Last Action",
      value: lastAction ? actionDisplayMap[lastAction] : "none",
      detail: "Most recent action triggered from controls",
    },
    {
      label: "Execution",
      value: isRunning ? "In progress" : "Stopped",
      detail: isRunning ? "Pipeline task currently running" : "No active pipeline task",
    },
  ];

  return (
    <article className="rounded-2xl border p-5 shadow-xl shadow-slate-950/40" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--accent)" }}>Output</p>
          <h2 className="mt-1 text-lg font-semibold" style={{ color: "var(--text)" }}>Run Status</h2>
          <p className="mt-1 text-xs" style={{ color: "var(--muted-text)" }}>
            Current status: <span className="font-semibold" style={{ color: "var(--text)" }}>{formatPipelineState(pipelineState)}</span>
          </p>
        </div>
        <span
          className="rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide"
          style={meta.badgeStyle}
        >
          {meta.badgeLabel}
        </span>
      </div>

      {pipelineState === "error" && errorMessage ? (
        <div className="mb-3 rounded-lg border px-3 py-2 text-xs" style={{ borderColor: "var(--error)", backgroundColor: "var(--error-bg)", color: "var(--error-text)" }}>
          {errorMessage}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        {statusCards.map((card) => (
          <div key={card.label} className="rounded-xl border p-3" style={{ borderColor: "var(--border)", backgroundColor: "var(--muted-bg)" }}>
            <p className="text-[11px] uppercase tracking-wide" style={{ color: "var(--muted-text)" }}>{card.label}</p>
            <p className="mt-1 text-lg font-semibold capitalize" style={{ color: "var(--text)" }}>{card.value}</p>
            <p className="mt-1 text-xs" style={{ color: "var(--muted-text)" }}>{card.detail}</p>
          </div>
        ))}
      </div>
    </article>
  );
}
