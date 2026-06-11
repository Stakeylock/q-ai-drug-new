interface CsvDownloadButtonProps {
  label?: string;
  filename: string;
  columns: string[];
  rows: Array<Record<string, string | number | null | undefined>>;
  disabled?: boolean;
}

export function CsvDownloadButton({
  label = "Download",
  filename,
  columns,
  rows,
  disabled = false,
}: CsvDownloadButtonProps) {
  function handleDownload() {
    if (disabled || rows.length === 0) return;

    import("./csv-utils").then(({ downloadCsv }) => {
      downloadCsv(filename, columns, rows);
    });
  }

  return (
    <button
      type="button"
      onClick={handleDownload}
      disabled={disabled || rows.length === 0}
      className="rounded-lg border border-white/15 bg-slate-950/70 px-3 py-2 text-xs font-medium text-slate-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {label}
    </button>
  );
}
