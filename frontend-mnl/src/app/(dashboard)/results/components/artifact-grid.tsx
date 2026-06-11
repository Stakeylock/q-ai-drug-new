import type { ResultArtifact } from "@/types/api";

interface ArtifactGridProps {
  title: string;
  subtitle?: string;
  items: ResultArtifact[];
}

export function ArtifactGrid({ title, subtitle, items }: ArtifactGridProps) {
  return (
    <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 transition-colors duration-200 ease-out">
      <h2 className="text-lg font-semibold tracking-tight text-slate-100">{title}</h2>
      {subtitle ? <p className="mt-1 text-xs leading-5 text-slate-400">{subtitle}</p> : null}

      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((artifact) => (
          <article
            key={artifact.path}
            className="rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-cyan-300/20 hover:bg-white/[0.04] hover:shadow-[0_10px_24px_rgba(15,23,42,0.16)]"
          >
            <p className="truncate text-sm font-medium tracking-tight text-slate-100">{artifact.name}</p>
            <p className="truncate text-xs text-slate-400">{artifact.path}</p>
            <p className="mt-1 text-xs text-slate-300">{artifact.size_bytes.toLocaleString()} bytes</p>
          </article>
        ))}
      </div>

      {items.length === 0 ? (
        <p className="mt-3 rounded-lg border border-dashed border-white/15 bg-slate-950/50 px-3 py-4 text-sm text-slate-400">
          No matching artifacts found.
        </p>
      ) : null}
    </section>
  );
}
