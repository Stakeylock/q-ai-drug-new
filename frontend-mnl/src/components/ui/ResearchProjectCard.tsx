import Link from "next/link";
import StatusBadge, { StatusType } from "./StatusBadge";
import { CardLift } from "./SafeMotion";

interface ResearchProjectProps {
  id: string;
  name: string;
  disease: string;
  target: string;
  stage: string;
  status: StatusType;
  progress: number;
  candidates: {
    generated: number;
    filtered: number;
  };
  lastRun: string;
  owner: string;
  tags: string[];
  className?: string;
}

export default function ResearchProjectCard({ 
  id,
  name, 
  disease,
  target, 
  stage,
  status, 
  progress, 
  candidates, 
  lastRun,
  owner,
  tags,
  className = "" 
}: ResearchProjectProps) {
  return (
    <Link href={`/research-projects/${id}`} className={`block ${className}`}>
      <CardLift className="h-full">
        <div className="ui-card-surface group flex flex-col gap-4 p-5 transition-all hover:border-accent/40 hover:shadow-xl hover:shadow-accent/5 h-full">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-bold tracking-tight text-text group-hover:text-accent transition-colors">{name}</h3>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[9px] font-black uppercase tracking-widest text-accent/80 bg-accent/5 px-1.5 py-0.5 rounded-sm">{disease}</span>
              <span className="text-[9px] font-bold uppercase tracking-widest text-muted-text/50">{target}</span>
            </div>
          </div>
          <StatusBadge status={status} size="sm" />
        </div>

        <div className="flex flex-wrap gap-1">
          {tags.map((tag, i) => (
            <span key={i} className="text-[8px] font-bold uppercase tracking-tighter text-muted-text/40 border border-border/20 px-1 py-0.5 rounded-sm group-hover:border-border/60 transition-colors">
              {tag}
            </span>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-3 border-y border-border/40 py-3 my-1">
          <div className="flex flex-col gap-1">
            <span className="text-[9px] font-bold uppercase tracking-widest text-muted-text/50">Discovery Stage</span>
            <span className="text-[11px] font-bold text-text/80">{stage}</span>
          </div>
          <div className="flex flex-col gap-1 text-right">
            <span className="text-[9px] font-bold uppercase tracking-widest text-muted-text/50">Candidates</span>
            <div className="flex flex-col">
              <span className="text-[11px] font-bold text-text/80">{candidates.generated.toLocaleString()} total</span>
              <span className="text-[9px] font-medium text-success/80">{candidates.filtered.toLocaleString()} filtered</span>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[9px] font-bold uppercase tracking-widest text-muted-text/50">Owner</span>
            <span className="text-[11px] font-bold text-text/80">{owner}</span>
          </div>
          <div className="flex flex-col gap-1 text-right">
            <span className="text-[9px] font-bold uppercase tracking-widest text-muted-text/50">Last Run</span>
            <span className="text-[11px] font-bold text-text/80">{lastRun}</span>
          </div>
        </div>

        <div className="mt-auto space-y-2">
          <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest">
            <span className="text-muted-text/50">Program Progress</span>
            <span className="text-accent">{progress}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted-bg">
            <div 
              className="h-full bg-accent transition-all duration-1000 ease-out shadow-[0_0_8px_rgba(34,211,238,0.5)]" 
              style={{ width: `${progress}%` }} 
            />
          </div>
        </div>
        </div>
      </CardLift>
    </Link>
  );
}
