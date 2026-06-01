"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useRun, RunActions, type Run } from "@/contexts/RunContext";
import { Button } from "@/components/ui/button";
import { cn, generateRunCode } from "@/lib/utils";

export function CreateRun() {
  const { dispatch } = useRun();
  const router = useRouter();
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [format, setFormat] = useState<"winner-stays" | "rotation">("rotation");
  const [scoreGoal, setScoreGoal] = useState(21);
  const [timeLimit, setTimeLimit] = useState(15);
  const [timeEnabled, setTimeEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [goalBump, setGoalBump] = useState(false);

  async function handleCreate() {
    if (!name.trim() || !location.trim()) return;
    setLoading(true);
    setError(null);

    const code = generateRunCode();

    try {
      const res = await fetch("/api/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          location: location.trim(),
          format,
          scoreGoal,
          timeLimit: timeEnabled ? timeLimit : undefined,
          code,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to create run");
      }

      const { run: dbRun } = await res.json();

      const newRun: Run = {
        id: dbRun.id,
        name: dbRun.name,
        location: dbRun.location,
        format: dbRun.format as Run["format"],
        scoreGoal: dbRun.scoreGoal,
        timeLimit: dbRun.timeLimit ?? undefined,
        code: dbRun.code,
      };

      dispatch(RunActions.createRun(newRun));
      router.push(`/lobby?code=${dbRun.code}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  function adjustGoal(delta: number) {
    const newGoal = Math.max(5, Math.min(50, scoreGoal + delta));
    setScoreGoal(newGoal);
    setGoalBump(true);
    setTimeout(() => setGoalBump(false), 200);
  }

  if (loading) {
    return (
      <div className="app-shell">
        <div className="topbar">
          <div className="flex flex-col gap-0.5">
            <span className="font-display text-[11px] font-bold tracking-[0.12em] uppercase text-text-muted">
              OpenRun
            </span>
            <span className="font-display text-[20px] font-black tracking-[0.02em] uppercase text-text-primary leading-none">
              Creating Run
            </span>
          </div>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-6 pb-12">
          <div className="w-16 h-16 border-4 border-border border-t-accent rounded-full animate-spin" />
          <div className="flex flex-col items-center gap-2 text-center">
            <h2 className="font-display text-[22px] font-black uppercase text-text-primary">
              Setting up your run…
            </h2>
          </div>
        </div>
      </div>
    );
  }

  const isReady = name.trim().length > 0 && location.trim().length > 0;

  return (
    <div className="app-shell">
      {/* TOPBAR */}
      <div className="topbar">
        <div className="flex flex-col gap-0.5">
          <span className="font-display text-[11px] font-bold tracking-[0.12em] uppercase text-text-muted">
            OpenRun
          </span>
          <span className="font-display text-[20px] font-black tracking-[0.02em] uppercase text-text-primary leading-none">
            New Run
          </span>
        </div>
        <button
          className="w-[36px] h-[36px] rounded-sm border border-border bg-bg-surface text-text-secondary flex items-center justify-center cursor-pointer transition-all duration-150 hover:border-accent-dim hover:text-accent hover:bg-accent-glow"
          onClick={() => router.push("/")}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      {/* FORM BODY */}
      <div className="flex-1 flex flex-col gap-6 overflow-y-auto custom-scrollbar px-5">
        <div className="flex flex-col gap-6 pt-6 pb-2">
          {/* ERROR */}
          {error && (
            <div className="px-3.5 py-3 bg-[rgba(255,64,64,0.08)] border border-[rgba(255,64,64,0.3)] rounded-md">
              <span className="font-display text-[13px] font-bold tracking-[0.04em] text-[#ff6060]">
                {error}
              </span>
            </div>
          )}

          {/* RUN NAME */}
          <div className="flex flex-col gap-1.5">
            <label className="font-display text-[11px] font-bold tracking-[0.14em] uppercase text-text-muted">
              Run name
            </label>
            <input
              className={cn(
                "w-full h-12 bg-bg-surface border border-border rounded-md px-3.5",
                "font-display text-[17px] font-bold tracking-[0.02em] uppercase text-text-primary",
                "outline-none transition-all duration-150",
                "caret-accent",
                "placeholder:text-text-muted placeholder:font-semibold",
                "focus:border-border-accent focus:bg-bg-hover"
              )}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Friday Run"
              maxLength={32}
              autoComplete="off"
            />
          </div>

          {/* LOCATION */}
          <div className="flex flex-col gap-1.5">
            <label className="font-display text-[11px] font-bold tracking-[0.14em] uppercase text-text-muted">
              Location
            </label>
            <input
              className={cn(
                "w-full h-12 bg-bg-surface border border-border rounded-md px-3.5",
                "font-display text-[17px] font-bold tracking-[0.02em] uppercase text-text-primary",
                "outline-none transition-all duration-150",
                "caret-accent",
                "placeholder:text-text-muted placeholder:font-semibold",
                "focus:border-border-accent focus:bg-bg-hover"
              )}
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Rucker Park"
              maxLength={32}
              autoComplete="off"
            />
          </div>

          {/* FORMAT */}
          <div className="flex flex-col gap-1.5">
            <span className="font-display text-[11px] font-bold tracking-[0.14em] uppercase text-text-muted">
              Format
            </span>
            <div className="flex gap-1.5">
              <button
                className={cn(
                  "h-10 px-4 rounded-md border font-display text-[13px] font-bold tracking-[0.08em] uppercase",
                  "flex items-center gap-1.5 cursor-pointer transition-all duration-120",
                  "select-none",
                  format === "rotation"
                    ? "border-border-accent bg-accent-glow text-accent"
                    : "border-border bg-bg-surface text-text-secondary hover:border-text-muted hover:text-text-primary"
                )}
                onClick={() => setFormat("rotation")}
              >
                {format === "rotation" && (
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                )}
                Rotation
              </button>
              <button
                className={cn(
                  "h-10 px-4 rounded-md border font-display text-[13px] font-bold tracking-[0.08em] uppercase",
                  "flex items-center gap-1.5 cursor-pointer transition-all duration-120",
                  "select-none",
                  format === "winner-stays"
                    ? "border-border-accent bg-accent-glow text-accent"
                    : "border-border bg-bg-surface text-text-secondary hover:border-text-muted hover:text-text-primary"
                )}
                onClick={() => setFormat("winner-stays")}
              >
                {format === "winner-stays" && (
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                )}
                Winner Stays
              </button>
            </div>
          </div>

          {/* SCORE GOAL */}
          <div className="flex flex-col gap-1.5">
            <span className="font-display text-[11px] font-bold tracking-[0.14em] uppercase text-text-muted">
              Score goal
            </span>
            <div className="flex items-center gap-2.5">
              <button
                className={cn(
                  "w-11 h-11 rounded-md border border-border bg-bg-surface text-text-secondary",
                  "font-display text-[22px] font-bold flex items-center justify-center",
                  "cursor-pointer transition-all duration-120 select-none",
                  "hover:border-text-muted hover:text-text-primary",
                  "active:scale-95"
                )}
                onClick={() => adjustGoal(-1)}
              >
                −
              </button>
              <div className={cn(
                "flex-1 h-11 bg-bg-surface border border-border rounded-md",
                "flex items-center justify-center gap-1.5"
              )}>
                <span className={cn(
                  "font-display font-black leading-none tracking-[-0.01em] text-text-primary",
                  "transition-all duration-100",
                  goalBump && "scale-112 text-accent"
                )} style={{ fontSize: scoreGoal >= 100 ? "22px" : "28px" }}>
                  {scoreGoal}
                </span>
                <span className="font-display text-[12px] font-bold tracking-[0.1em] uppercase text-text-muted pt-1">
                  pts
                </span>
              </div>
              <button
                className={cn(
                  "w-11 h-11 rounded-md border border-border bg-bg-surface text-text-secondary",
                  "font-display text-[22px] font-bold flex items-center justify-center",
                  "cursor-pointer transition-all duration-120 select-none",
                  "hover:border-text-muted hover:text-text-primary",
                  "active:scale-95"
                )}
                onClick={() => adjustGoal(1)}
              >
                +
              </button>
            </div>
          </div>

          {/* TIME LIMIT */}
          <div className="flex flex-col gap-1.5">
            <span className="font-display text-[11px] font-bold tracking-[0.14em] uppercase text-text-muted">
              Time limit
            </span>
            <div
              className={cn(
                "flex items-center justify-between bg-bg-surface border border-border rounded-md px-3.5 py-3",
                "cursor-pointer transition-all duration-150 select-none",
                timeEnabled && "border-border-accent"
              )}
              onClick={() => setTimeEnabled(!timeEnabled)}
            >
              <div className="flex flex-col gap-0.5">
                <span className="font-display text-[15px] font-black tracking-[0.03em] uppercase text-text-primary leading-none">
                  Game clock
                </span>
                <span className="font-body text-[12px] text-text-muted">
                  Set a time limit per game
                </span>
              </div>
              <div className={cn(
                "w-toggle h-toggle rounded-[13px] bg-bg-hover border border-border",
                "relative transition-all duration-200",
                timeEnabled && "bg-accent border-accent"
              )}>
                <div className={cn(
                  "absolute top-[3px] left-[3px] w-toggle-knob h-toggle-knob rounded-full bg-text-muted",
                  "transition-all duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
                  timeEnabled && "translate-x-toggle-on bg-bg"
                )} />
              </div>
            </div>
            {timeEnabled && (
              <div className="flex gap-2.5 mt-2">
                {[10, 15, 20, 30].map((min) => (
                  <button
                    key={min}
                    className={cn(
                      "flex-1 h-10 rounded-md border font-display text-[13px] font-bold tracking-[0.08em] uppercase",
                      "cursor-pointer transition-all duration-120 select-none",
                      timeLimit === min
                        ? "border-border-accent bg-accent-glow text-accent"
                        : "border-border bg-bg-surface text-text-secondary hover:border-text-muted hover:text-text-primary"
                    )}
                    onClick={() => setTimeLimit(min)}
                  >
                    {min} min
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="h-2 flex-shrink-0" />
        </div>
      </div>

      {/* BOTTOM BAR */}
      <div className="bottom-bar">
        <Button
          variant="primary"
          size="lg"
          className="flex-1 h-13"
          onClick={handleCreate}
          disabled={!isReady || loading}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Create Run
        </Button>
      </div>
    </div>
  );
}
