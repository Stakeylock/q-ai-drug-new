function formatValue(value: string | number | undefined): string {
  if (value === undefined) return "-";
  if (typeof value === "number") {
    if (Number.isInteger(value)) return String(value);
    return value.toFixed(4);
  }
  return value;
}

interface ResultsTableProps {
  title: string;
  subtitle?: string;
  rows: Array<Record<string, string | number>>;
}

export function ResultsTable({ title, subtitle, rows }: ResultsTableProps) {
  const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

  return (
    <section className="rounded-xl border border-white/10 bg-slate-900/60 p-4">
      <h2 className="text-lg font-semibold text-slate-100">{title}</h2>
      {subtitle ? <p className="mt-1 text-xs text-slate-400">{subtitle}</p> : null}

      <div className="mt-3 overflow-auto">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  key={column}
                  className="border-b border-white/10 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-400"
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index} className="odd:bg-white/[0.03]">
                {columns.map((column) => (
                  <td key={`${index}-${column}`} className="border-b border-white/5 px-3 py-2 text-slate-200">
                    {formatValue(row[column])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rows.length === 0 ? (
        <p className="mt-3 rounded-lg border border-dashed border-white/15 bg-slate-950/50 px-3 py-4 text-sm text-slate-400">
          No records available for this section.
        </p>
      ) : null}
    </section>
  );
}
