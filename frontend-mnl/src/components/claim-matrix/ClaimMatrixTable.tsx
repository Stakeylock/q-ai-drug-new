"use client";

import React, { useState, useMemo } from "react";
import type { ClaimMatrixEntry } from "@/types/claimMatrix";
import { StatusBadge, SectionHeader } from "@/components/ui";

interface ClaimMatrixTableProps {
  claims: ClaimMatrixEntry[];
}

export function ClaimMatrixTable({ claims }: ClaimMatrixTableProps) {
  const [search, setSearch] = useState("");
  const [evidenceFilter, setEvidenceFilter] = useState("all");
  const [sortConfig, setSortConfig] = useState<{ key: keyof ClaimMatrixEntry; direction: "asc" | "desc" } | null>(null);

  const filteredAndSortedClaims = useMemo(() => {
    let result = [...claims];

    // Search
    if (search) {
      const lowerSearch = search.toLowerCase();
      result = result.filter(c => 
        (c.name && c.name.toLowerCase().includes(lowerSearch)) ||
        (c.definition && c.definition.toLowerCase().includes(lowerSearch)) ||
        (c.allowed_claim && c.allowed_claim.toLowerCase().includes(lowerSearch)) ||
        (c.forbidden_claim && c.forbidden_claim.toLowerCase().includes(lowerSearch))
      );
    }

    // Evidence Filter
    if (evidenceFilter !== "all") {
      result = result.filter(c => c.evidence_level?.toLowerCase() === evidenceFilter.toLowerCase());
    }

    // Sort
    if (sortConfig) {
      result.sort((a, b) => {
        const aVal = a[sortConfig.key] ?? "";
        const bVal = b[sortConfig.key] ?? "";
        
        if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [claims, search, evidenceFilter, sortConfig]);

  const requestSort = (key: keyof ClaimMatrixEntry) => {
    let direction: "asc" | "desc" = "asc";
    if (sortConfig && sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const evidenceLevels = Array.from(new Set(claims.map(c => c.evidence_level))).filter(Boolean);

  const getSortIcon = (key: keyof ClaimMatrixEntry) => {
    if (sortConfig?.key !== key) {
      return <svg className="h-3 w-3 opacity-30 inline ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" /></svg>;
    }
    if (sortConfig.direction === "asc") {
      return <svg className="h-3 w-3 text-accent inline ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>;
    }
    return <svg className="h-3 w-3 text-accent inline ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>;
  };

  const formatStatus = (status: string) => {
    return status.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  };

  return (
    <div className="space-y-4">
      <SectionHeader title="Claim Matrix Details" description="Detailed list of scientific claims derived from the pipeline." />
      
      {/* Controls */}
      <div className="flex flex-col md:flex-row gap-4 items-end bg-surface-subtle/20 p-4 rounded-lg border border-border/40">
        <div className="flex-1 w-full space-y-1">
          <label className="text-[10px] font-black uppercase tracking-widest text-muted-text/60">Search</label>
          <input 
            type="text" 
            placeholder="Search claims name, definition, or actions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-bg border border-border/60 rounded px-3 py-2 text-[11px] text-text focus:outline-none focus:border-accent transition-colors"
          />
        </div>
        
        <div className="w-full md:w-48 space-y-1">
          <label className="text-[10px] font-black uppercase tracking-widest text-muted-text/60">Evidence Level</label>
          <select 
            value={evidenceFilter}
            onChange={(e) => setEvidenceFilter(e.target.value)}
            className="w-full bg-bg border border-border/60 rounded px-3 py-2 text-[11px] text-text focus:outline-none focus:border-accent transition-colors"
          >
            <option value="all">All Levels</option>
            {evidenceLevels.map(lvl => (
              <option key={lvl} value={lvl}>{lvl}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="ui-card-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-subtle/40 border-b border-border/60">
                <th className="py-3 px-4 text-[10px] font-black uppercase tracking-widest text-muted-text/60 whitespace-nowrap cursor-pointer hover:text-accent transition-colors" onClick={() => requestSort("evidence_level")}>
                  Level {getSortIcon("evidence_level")}
                </th>
                <th className="py-3 px-4 text-[10px] font-black uppercase tracking-widest text-muted-text/60 cursor-pointer hover:text-accent transition-colors" onClick={() => requestSort("name")}>
                  Claim Name {getSortIcon("name")}
                </th>
                <th className="py-3 px-4 text-[10px] font-black uppercase tracking-widest text-muted-text/60 min-w-[250px]">
                  Definition
                </th>
                <th className="py-3 px-4 text-[10px] font-black uppercase tracking-widest text-muted-text/60 whitespace-nowrap">
                  Status
                </th>
                <th className="py-3 px-4 text-[10px] font-black uppercase tracking-widest text-muted-text/60">
                  Allowed Claim
                </th>
                <th className="py-3 px-4 text-[10px] font-black uppercase tracking-widest text-muted-text/60">
                  Forbidden Claim
                </th>
                <th className="py-3 px-4 text-[10px] font-black uppercase tracking-widest text-muted-text/60">
                  Required Next Evidence
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/20">
              {filteredAndSortedClaims.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-[12px] text-muted-text/50 italic">
                    No claims found matching the filters.
                  </td>
                </tr>
              ) : (
                filteredAndSortedClaims.map((claim) => (
                  <tr key={claim._id} className="hover:bg-surface-subtle/10 transition-colors">
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="text-[11px] font-bold font-mono text-text/80">{claim.evidence_level}</span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="text-[11px] font-bold text-accent">{claim.name}</span>
                    </td>
                    <td className="py-3 px-4">
                      <p className="text-[11px] font-medium text-text/90 leading-snug">{claim.definition}</p>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded border ${
                        claim.current_status.includes('available') ? 'bg-success/10 text-success border-success/20' :
                        claim.current_status.includes('partial') ? 'bg-warning/10 text-warning border-warning/20' :
                        'bg-error/10 text-error border-error/20'
                      }`}>
                        {formatStatus(claim.current_status)}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-[11px] font-medium text-success">{claim.allowed_claim}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-[11px] font-medium text-error">{claim.forbidden_claim}</span>
                    </td>
                    <td className="py-3 px-4 text-muted-text/80">
                      <span className="text-[11px] font-medium">{formatStatus(claim.required_next_evidence)}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
