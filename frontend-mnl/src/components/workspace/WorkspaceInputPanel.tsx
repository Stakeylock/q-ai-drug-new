"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui";
import { useWorkspaceStore } from "@/store";
import {
  NumberSliderField,
  SelectField,
} from "@/components/workspace/WorkspaceInputFields";

const proteinOptions = [
  { label: "EGFR", value: "EGFR" },
  { label: "HER2", value: "HER2" },
] as const;

const toxicityOptions = [
  { label: "Low", value: "Low" },
  { label: "Medium", value: "Medium" },
  { label: "High", value: "High" },
] as const;

type ProteinOptionValue = (typeof proteinOptions)[number]["value"];
type ToxicityOptionValue = (typeof toxicityOptions)[number]["value"];

function isProteinOptionValue(value: string): value is ProteinOptionValue {
  return proteinOptions.some((option) => option.value === value);
}

function isToxicityOptionValue(value: string): value is ToxicityOptionValue {
  return toxicityOptions.some((option) => option.value === value);
}

export default function WorkspaceInputPanel() {
  const workspaceInput = useWorkspaceStore((s) => s.workspaceInput);
  const setWorkspaceInput = useWorkspaceStore((s) => s.setWorkspaceInput);

  const [selectedProtein, setSelectedProtein] = useState(
    isProteinOptionValue(workspaceInput.protein) ? workspaceInput.protein : "EGFR"
  );
  const [logP, setLogP] = useState(Number(workspaceInput.constraints.logP ?? 2.4));
  const [qed, setQed] = useState(Number(workspaceInput.constraints.qed ?? 0.78));
  const [toxicity, setToxicity] = useState(String(workspaceInput.constraints.toxicity ?? "Low"));

  const pipelineState = useWorkspaceStore((s) => s.pipelineState);
  const isPipelineRunning =
    pipelineState === "generating" ||
    pipelineState === "docking" ||
    pipelineState === "running_full_pipeline";

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const rerunInput = window.sessionStorage.getItem("qdrugforge.workspace.rerunInput");
    if (!rerunInput) {
      return;
    }

    try {
      const parsed = JSON.parse(rerunInput) as {
        protein?: string;
        constraints?: Record<string, string | number | boolean>;
      };

      if (parsed.protein) {
        setSelectedProtein(isProteinOptionValue(parsed.protein) ? parsed.protein : "EGFR");
      }

      if (parsed.constraints) {
        if (typeof parsed.constraints.logP === "number") {
          setLogP(parsed.constraints.logP);
        }
        if (typeof parsed.constraints.qed === "number") {
          setQed(parsed.constraints.qed);
        }
        if (
          typeof parsed.constraints.toxicity === "string" &&
          isToxicityOptionValue(parsed.constraints.toxicity)
        ) {
          setToxicity(parsed.constraints.toxicity);
        }
      }

      setWorkspaceInput({
        protein:
          typeof parsed.protein === "string" && isProteinOptionValue(parsed.protein)
            ? parsed.protein
            : selectedProtein,
        constraints: {
          logP: typeof parsed.constraints?.logP === "number" ? parsed.constraints.logP : logP,
          qed: typeof parsed.constraints?.qed === "number" ? parsed.constraints.qed : qed,
          toxicity:
            typeof parsed.constraints?.toxicity === "string" &&
            isToxicityOptionValue(parsed.constraints.toxicity)
              ? parsed.constraints.toxicity
              : toxicity,
        },
      });
    } catch {
      // Ignore invalid session payload.
    } finally {
      window.sessionStorage.removeItem("qdrugforge.workspace.rerunInput");
    }
  }, [logP, qed, selectedProtein, setWorkspaceInput, toxicity]);

  useEffect(() => {
    setWorkspaceInput({
      protein: selectedProtein,
      constraints: {
        logP,
        qed,
        toxicity,
      },
    });
  }, [logP, qed, selectedProtein, setWorkspaceInput, toxicity]);

  return (
    <Card className="shadow-xl shadow-slate-950/40 transition-all duration-300" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
      <CardHeader>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--accent)" }}>Input</p>
        <h2 className="mt-1 text-xl font-semibold tracking-tight" style={{ color: "var(--text)" }}>Protein + Constraints</h2>
        <p className="mt-1.5 text-xs leading-6" style={{ color: "var(--muted-text)" }}>
          Define biological context and property thresholds before launching a run.
        </p>
      </CardHeader>

      <CardContent className="space-y-6">
        <SelectField
          id="workspace-protein-target"
          label="Protein Target"
          value={selectedProtein}
          onChange={(nextValue) =>
            setSelectedProtein(isProteinOptionValue(nextValue) ? nextValue : "EGFR")
          }
          disabled={isPipelineRunning}
          options={[...proteinOptions]}
          helperText="Select target protein identifier sent to the backend pipeline."
        />

        <Card className="transition-all duration-300" style={{ backgroundColor: "var(--muted-bg)", borderColor: "var(--border)" }}>
          <CardHeader className="px-4 py-3">
            <h3 className="text-sm font-semibold" style={{ color: "var(--text)" }}>Constraints</h3>
            <p className="mt-1 text-xs" style={{ color: "var(--muted-text)" }}>Tune chemistry and safety bounds for candidate generation.</p>
          </CardHeader>
          <CardContent className="grid gap-4 px-4 py-4">
            <NumberSliderField
              id="workspace-logp"
              label="LogP"
              value={logP}
              onChange={setLogP}
              disabled={isPipelineRunning}
              min={-2}
              max={7}
              step={0.1}
              helperText="Controls lipophilicity. Typical drug-like range is around 1 to 3."
            />

            <NumberSliderField
              id="workspace-qed"
              label="QED"
              value={qed}
              onChange={setQed}
              disabled={isPipelineRunning}
              min={0}
              max={1}
              step={0.01}
              helperText="Higher values prioritize compounds with stronger drug-likeness."
            />

            <SelectField
              id="workspace-toxicity"
              label="Toxicity"
              value={toxicity}
              onChange={(nextValue) =>
                setToxicity(isToxicityOptionValue(nextValue) ? nextValue : "Low")
              }
              disabled={isPipelineRunning}
              options={[...toxicityOptions]}
              helperText="Low is strictest; High allows broader exploration."
            />
          </CardContent>
        </Card>
      </CardContent>
    </Card>
  );
}
