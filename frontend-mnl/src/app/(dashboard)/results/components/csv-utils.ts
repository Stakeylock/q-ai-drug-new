type CsvRow = Record<string, string | number | null | undefined>;

function escapeCsvValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";

  const text = String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }

  return text;
}

const WET_LAB_DISCLAIMER = "Computational decision-support only. This report is not clinical or medical advice and does not establish safety, efficacy, or suitability for human use. All candidates require wet-lab experimental validation before therapeutic conclusions can be drawn.";

export function buildCsv(columns: string[], rows: CsvRow[]): string {
  const processedRows = rows.map((row) => {
    const isOod =
      row.is_ood === "true" ||
      row.is_ood === "true" ||
      row.applicability_domain_violation === "true" ||
      row.applicability_domain_violation === "true" ||
      row.overall_risk === "high" ||
      row["Applicability Domain Violation"] === "true" ||
      row["Applicability Domain Violation"] === "true" ||
      row["Applicability Domain Violation"] === "OOD" ||
      row["Applicability Domain Violation"] === "OUT_OF_DOMAIN";

    if (isOod) {
      const newRow = { ...row };
      const idKeys = ["compound_id", "molecule_id", "moleculeId", "compoundId", "Molecule ID", "Compound ID", "Compound", "Molecule"];
      for (const key of idKeys) {
        if (typeof newRow[key] === "string" && !String(newRow[key]).startsWith("[OOD]")) {
          newRow[key] = `[OOD] ${newRow[key]}`;
        }
      }
      return newRow;
    }
    return row;
  });


  const header = columns.map(escapeCsvValue).join(",");
  const body = processedRows.map((row) => columns.map((column) => escapeCsvValue(row[column])).join(","));
  
  const timestamp = new Date().toISOString();
  const metadataFooter = [
    "",
    `# Export Time: ${timestamp}`,
    `# Execution System: backend-mnl / q-ai-drug`,
    `# Lineage Status: Standard verified execution`,
    `# WARNING: ${WET_LAB_DISCLAIMER}`
  ].join("\r\n");

  return [header, ...body].join("\r\n") + "\r\n" + metadataFooter;
}


export function downloadCsv(filename: string, columns: string[], rows: CsvRow[]): void {
  const csv = buildCsv(columns, rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
