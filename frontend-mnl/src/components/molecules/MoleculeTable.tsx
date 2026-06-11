"use client";

import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import type { Molecule } from "@/types/api";
import { MOCK_MOLECULES } from "./mockMolecules";

const getDatasetBadge = (dataset: string) => {
  const base = "inline-flex items-center rounded-lg border-2 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider transition-all shadow-sm";
  switch (dataset) {
    case "FDA Approved":
      return <span className={`${base} border-emerald-500/20 bg-emerald-500/10 text-emerald-500`}>FDA Approved</span>;
    case "Natural Products":
      return <span className={`${base} border-cyan-500/20 bg-cyan-500/10 text-cyan-500`}>Natural Products</span>;
    case "Screening":
      return <span className={`${base} border-amber-500/20 bg-amber-500/10 text-amber-500`}>Screening</span>;
    default:
      return <span className={`${base} border-border/50 bg-surface-subtle text-text-secondary`}>{dataset}</span>;
  }
};

const columns: ColumnDef<Molecule>[] = [
  {
    accessorKey: "molecule_id",
    header: "Molecule ID",
    cell: ({ getValue }) => (
      <span className="font-bold text-sm tracking-tight text-text">
        {getValue() as string}
      </span>
    ),
  },
  {
    accessorKey: "smiles",
    header: "SMILES Sequence",
    cell: ({ getValue }) => (
      <span className="font-mono text-[11px] truncate max-w-[240px] block text-text-secondary opacity-70">
        {getValue() as string}
      </span>
    ),
  },
  {
    accessorKey: "mw",
    header: "Mass (Da)",
    cell: ({ getValue }) => (
      <span className="text-sm font-semibold text-text">
        {(getValue() as number).toFixed(2)}
      </span>
    ),
  },
  {
    accessorKey: "logp",
    header: "LogP",
    cell: ({ getValue }) => (
      <span className="text-sm font-semibold text-text">
        {(getValue() as number).toFixed(2)}
      </span>
    ),
  },
  {
    accessorKey: "qed",
    header: "QED Score",
    cell: ({ getValue }) => (
      <span className="text-sm font-black text-primary">
        {(getValue() as number).toFixed(3)}
      </span>
    ),
  },
  {
    accessorKey: "dataset",
    header: "Origin",
    cell: ({ getValue }) => getDatasetBadge(getValue() as string),
  },
];

interface MoleculeTableProps {
  data?: Molecule[];
  onRowSelect?: (molecule: Molecule) => void;
  selectedId?: string | null;
  isLoading?: boolean;
}

export default function MoleculeTable({
  data = MOCK_MOLECULES,
  onRowSelect,
  selectedId,
  isLoading = false,
}: MoleculeTableProps) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 20 } },
  });

  return (
    <div className="ui-card-surface flex flex-col h-full overflow-hidden shadow-premium">
      <div className="flex-1 overflow-auto scrollbar-thin">
        <table className="w-full min-w-[700px] border-separate border-spacing-0">
          <thead className="sticky top-0 z-10 bg-card/95 backdrop-blur-sm shadow-sm">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="whitespace-nowrap px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-text-secondary border-b border-border/50"
                  >
                    {header.column.columnDef.header as string}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-border/30">
            {isLoading
              ? Array.from({ length: 12 }).map((_, index) => (
                  <tr key={`skeleton-${index}`}>
                    <td className="px-6 py-4"><div className="skeleton-shimmer h-4 w-24 rounded-full" /></td>
                    <td className="px-6 py-4"><div className="skeleton-shimmer h-4 w-48 rounded-full" /></td>
                    <td className="px-6 py-4"><div className="skeleton-shimmer h-4 w-16 rounded-full" /></td>
                    <td className="px-6 py-4"><div className="skeleton-shimmer h-4 w-14 rounded-full" /></td>
                    <td className="px-6 py-4"><div className="skeleton-shimmer h-4 w-14 rounded-full" /></td>
                    <td className="px-6 py-4"><div className="skeleton-shimmer h-5 w-24 rounded-lg" /></td>
                  </tr>
                ))
              : table.getRowModel().rows.map((row) => {
              const molecule = row.original;
              const isSelected = selectedId === molecule.molecule_id;
              return (
                <tr
                  key={row.id}
                  onClick={() => onRowSelect?.(molecule)}
                  className={`group cursor-pointer transition-all duration-200 ${
                    isSelected 
                      ? "bg-primary/10" 
                      : "hover:bg-surface-subtle"
                  }`}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="whitespace-nowrap px-6 py-4 transition-transform duration-200 group-hover:translate-x-0.5">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

