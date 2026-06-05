"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";


type RunSummary = {
  id: string;
  name: string;
  location: string | null;
  status: "lobby" | "active" | "completed";
  sessionCode: string;
  createdAt: string;
  gameCount: number;
};

type PageState = "loading" | "ready";

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(iso));
}

function InlineStatus({ status }: { status: RunSummary["status"] }) {
  if (status === "active") {
    return (
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <span className="w-[6px] h-[6px] rounded-full bg-[#3ddc84] flex-shrink-0 animate-live-pulse" />
        <span className="font-display text-[11px] font-bold tracking-[0.14em] uppercase text-accent-dim">Live</span>
      </div>
    );
  }
  if (status === "lobby") {
    return (
      <span className="font-display text-[11px] font-bold tracking-[0.14em] uppercase text-text-muted flex-shrink-0">
        Lobby
      </span>
    );
  }
  return null;
}

export default function HistoryPage() {
  const router = useRouter();
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [pageState, setPageState] = useState<PageState>("loading");

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/runs");
      const data: RunSummary[] = res.ok ? await res.json() : [];
      const sorted = [...data].sort((a, b) => {
        const aActive = a.status === "active" || a.status === "lobby" ? 0 : 1;
        const bActive = b.status === "active" || b.status === "lobby" ? 0 : 1;
        if (aActive !== bActive) return aActive - bActive;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      setRuns(sorted);
      setPageState("ready");
    }
    load();
  }, []);

  return (
    <div className="app-shell px-5">
      <div className="topbar h-15">

      </div>

      <div className="flex-1 overflow-y-auto pt-4 pb-8">
        {pageState === "loading" && (
          <div className="flex flex-col gap-2">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-[72px] rounded-md border border-border bg-bg-surface animate-pulse"
              />
            ))}
          </div>
        )}

        {pageState === "ready" && runs.length === 0 && (
          <div className="flex flex-col items-center justify-center h-48 gap-2">
            <span className="font-display text-[14px] font-bold tracking-[0.08em] uppercase text-text-muted">
              No runs yet
            </span>
            <span className="font-body text-[13px] text-text-muted">
              Start a run to see it here
            </span>
          </div>
        )}

        {pageState === "ready" && runs.length > 0 && (
          <div className="flex flex-col gap-2">
            {runs.map((run, i) => (
              <button
                key={run.id}
                onClick={() => router.push(`/runs/${run.sessionCode}/feed`)}
                className="w-full flex flex-col gap-2 px-[18px] py-4 rounded-md border border-border bg-bg-surface hover:bg-bg-hover text-left transition-colors animate-fade-up"
                style={{ animationDelay: `${i * 0.04}s` }}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-display text-[20px] font-extrabold tracking-[0.02em] uppercase text-text-primary leading-none truncate">
                    {run.name}
                  </span>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <InlineStatus status={run.status} />
                    <ChevronRight className="w-3.5 h-3.5 text-text-muted" />
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {run.location && (
                    <span className="font-display text-[11px] font-bold tracking-[0.1em] uppercase text-text-muted">{run.location}</span>
                  )}
                  {run.location && <span className="text-border/60 select-none text-[10px]">·</span>}
                  <span className="font-display text-[11px] font-bold tracking-[0.1em] uppercase text-text-muted">{formatDate(run.createdAt)}</span>
                  {run.gameCount > 0 && (
                    <>
                      <span className="text-border/60 select-none text-[10px]">·</span>
                      <span className="font-display text-[11px] font-bold tracking-[0.1em] uppercase text-text-muted">
                        {run.gameCount} {run.gameCount === 1 ? "Game" : "Games"}
                      </span>
                    </>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
