"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

interface SearchBarProps {
  initialSmiles?: string;
  initialTopK?: number;
  isLoading?: boolean;
  onSearch: (smiles: string, topK: number) => void;
}


export default function SearchBar({
  initialSmiles = "",
  initialTopK = 10,
  isLoading = false,
  onSearch,
}: SearchBarProps) {
  const [smiles, setSmiles] = useState(initialSmiles);
  const [topK, setTopK] = useState(initialTopK);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSearch(smiles.trim(), topK);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="ui-card-surface flex flex-col gap-6 p-8 shadow-premium md:flex-row md:items-end"
    >
      <div className="flex-1">
        <Input
          id="smiles-input"
          label="SMILES Sequence"
          value={smiles}
          onChange={(event) => setSmiles(event.target.value)}
          placeholder="e.g. CC(=O)Oc1ccccc1C(=O)O"
          className="font-mono"
        />
      </div>

      <div className="w-full md:w-32">
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="top-k-select"
            className="text-xs font-bold uppercase tracking-widest text-text-secondary"
          >
            TOP K
          </label>
          <select
            id="top-k-select"
            value={topK}
            onChange={(event) => setTopK(Number(event.target.value))}
            className="w-full rounded-xl border-2 border-border/50 bg-surface px-4 py-3 text-sm font-semibold text-text outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all appearance-none"
          >
            {[5, 10, 20, 50].map((value) => (
              <option key={value} value={value}>
                {value} Results
              </option>
            ))}
          </select>
        </div>
      </div>

      <Button
        type="submit"
        isLoading={isLoading}
        className="w-full md:w-auto"
        size="lg"
      >
        Execute Search
      </Button>
    </form>
  );
}