/**
 * Provenance Resolution Layer
 * Maps calculations, datasets, and endpoints to explicit scientific sources.
 * Derives scientific lineage following strict precedence rules.
 */

export type ProvenanceType =
  | "live_compute" // Real, verified backend execution state
  | "imported"     // Scientific data imported from q-ai-drug compute subsystem
  | "simulated"    // Demo/presentation fake data
  | "placeholder"  // Stubs for unimplemented workflows (marked "Not scientifically implemented")
  | "failed"       // Compute failure, network exception, or calculation error
  | "missing"      // Empty dataset or unregistered run evidence
  | "stale"        // Outdated imported artifacts
  | "outdated";    // Outdated imported artifacts (alias)

interface ResolveProvenanceOptions {
  items?: any[] | null;
  isDemo?: boolean;
  hasError?: boolean;
  isPlaceholder?: boolean;
}

/**
 * Resolves the overall provenance status of a data set.
 * Enforces strict precedence: Error -> Placeholder -> Demo/Simulated -> Missing -> Imported -> Live
 */
export function resolveProvenance(options: ResolveProvenanceOptions): ProvenanceType {
  const { items, isDemo = false, hasError = false, isPlaceholder = false } = options;

  if (hasError) {
    return "failed";
  }

  if (isPlaceholder) {
    return "placeholder";
  }

  if (isDemo) {
    return "simulated";
  }

  if (!items || items.length === 0) {
    return "missing";
  }

  // Check if any items indicate they were imported from the compute engine (q-ai-drug)
  const containsImported = items.some((item) => {
    if (!item) return false;
    const sourceVal = String(item.source || item.metadata?.source || "").toLowerCase();
    const isImportFlag = Boolean(item.import_id || item.metadata?.import_id || item.metadata?.is_imported);
    return sourceVal.includes("q_ai_drug") || sourceVal === "imported" || isImportFlag;
  });

  if (containsImported) {
    return "imported";
  }

  // Unknown provenance must NEVER default to LIVE COMPUTE
  // We explicitly require metadata indicating live compute.
  const containsLive = items.some((item) => {
    if (!item) return false;
    const sourceVal = String(item.source || item.metadata?.source || "").toLowerCase();
    return sourceVal === "backend-mnl" || sourceVal === "live" || Boolean(item.metadata?.is_live) || Boolean(item.is_live);
  });

  if (containsLive) {
    return "live_compute";
  }

  return "missing";
}
