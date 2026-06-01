"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useRun, RunActions, Player } from "@/contexts/RunContext";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function TeamAssignment() {
  const { state, dispatch } = useRun();
  const router = useRouter();
  const { queue, currentRun } = state;

  const [teamA, setTeamA] = useState<string[]>([]);
  const [teamB, setTeamB] = useState<string[]>([]);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverZone, setDragOverZone] = useState<"a" | "b" | null>(null);
  const [scrambling, setScrambling] = useState(false);

  const zoneARef = useRef<HTMLDivElement>(null);
  const zoneBRef = useRef<HTMLDivElement>(null);

  const courtPlayers = queue.filter((p) => p.section === "court");

  // Initialize teams on mount
  useEffect(() => {
    const ids = courtPlayers.map((p) => p.id);
    setTeamA(ids.slice(0, 5));
    setTeamB(ids.slice(5, 10));
  }, []);

  function getPlayer(id: string) {
    return courtPlayers.find((p) => p.id === id);
  }

  function handleDragStart(id: string) {
    setDraggingId(id);
  }

  function handleDragEnd() {
    setDraggingId(null);
    setDragOverZone(null);
  }

  function handleDragOver(e: React.DragEvent, zone: "a" | "b") {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverZone(zone);
  }

  function handleDragLeave(e: React.DragEvent, zone: "a" | "b") {
    const zoneEl = zone === "a" ? zoneARef.current : zoneBRef.current;
    if (zoneEl && !zoneEl.contains(e.relatedTarget as Node)) {
      setDragOverZone(null);
    }
  }

  function handleDrop(e: React.DragEvent, toZone: "a" | "b") {
    e.preventDefault();
    setDragOverZone(null);

    if (draggingId === null) return;

    const fromZone = teamA.includes(draggingId) ? "a" : "b";
    if (fromZone === toZone) return;

    if (toZone === "a") {
      setTeamB(teamB.filter((id) => id !== draggingId));
      setTeamA([...teamA, draggingId]);
    } else {
      setTeamA(teamA.filter((id) => id !== draggingId));
      setTeamB([...teamB, draggingId]);
    }
    setDraggingId(null);
  }

  function handleMovePlayer(id: string, toZone: "a" | "b") {
    const fromZone = teamA.includes(id) ? "a" : "b";
    if (fromZone === toZone) return;

    if (toZone === "a") {
      setTeamB(teamB.filter((pid) => pid !== id));
      setTeamA([...teamA, id]);
    } else {
      setTeamA(teamA.filter((pid) => pid !== id));
      setTeamB([...teamB, id]);
    }
  }

  function handleScramble() {
    setScrambling(true);
    const ids = courtPlayers.map((p) => p.id);
    const shuffled = [...ids].sort(() => Math.random() - 0.5);

    setTimeout(() => {
      setTeamA(shuffled.slice(0, 5));
      setTeamB(shuffled.slice(5, 10));
      setScrambling(false);
    }, 350);
  }

  function handleConfirm() {
    const teamAPlayers = teamA.map((id) => getPlayer(id)!);
    const teamBPlayers = teamB.map((id) => getPlayer(id)!);
    dispatch(RunActions.startGame(teamAPlayers, teamBPlayers));
    router.push("/game");
  }

  // Balance calculations
  const cntA = teamA.length;
  const cntB = teamB.length;
  const total = cntA + cntB;
  const pctA = total > 0 ? (cntA / total) * 100 : 50;
  const diff = Math.abs(cntA - cntB);

  let statusText = "Even split";
  let statusClass = "even";
  if (diff === 1) {
    statusText = "Off by one";
    statusClass = "";
  } else if (diff > 1) {
    statusText = `${diff} apart`;
    statusClass = "uneven";
  }

  return (
    <div className="app-shell">
      {/* TOPBAR */}
      <div className="topbar">
        <div className="flex flex-col gap-0.5">
          <span className="font-display text-[11px] font-bold tracking-[0.12em] uppercase text-text-muted">
            {currentRun?.name}
          </span>
          <span className="font-display text-[20px] font-black tracking-[0.02em] uppercase text-text-primary leading-none">
            {currentRun?.location}
          </span>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="font-display text-[12px] font-bold tracking-[0.1em] uppercase text-text-secondary bg-bg-surface border border-border px-2.5 py-1 rounded-sm">
            Game 1
          </span>
          <button className="w-9 h-9 rounded-sm border border-border bg-bg-surface text-text-secondary flex items-center justify-center cursor-pointer transition-all duration-150 hover:border-accent-dim hover:text-accent hover:bg-accent-glow">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
        </div>
      </div>

      {/* BALANCE BAR */}
      <div className="mx-5 mt-4 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-0.5">
            <span className="font-display text-[11px] font-bold tracking-[0.14em] uppercase text-text-muted">
              Runs
            </span>
            <span className={cn(
              "font-display text-[28px] font-black leading-none",
              diff === 0 ? "text-accent" : diff > 1 ? "text-[#ff6b35]" : "text-text-secondary"
            )}>
              {cntA}
            </span>
          </div>
          <span className="font-display text-[13px] font-bold tracking-[0.1em] uppercase text-text-muted">
            vs
          </span>
          <div className="flex flex-col items-end gap-0.5">
            <span className="font-display text-[11px] font-bold tracking-[0.14em] uppercase text-text-muted">
              Next
            </span>
            <span className={cn(
              "font-display text-[28px] font-black leading-none",
              diff === 0 ? "text-accent" : diff > 1 ? "text-[#ff6b35]" : "text-text-secondary"
            )}>
              {cntB}
            </span>
          </div>
        </div>
        <div className="h-1 bg-bg-surface rounded-sm overflow-hidden flex gap-0.5">
          <div
            className="h-full bg-accent transition-all duration-300"
            style={{ width: `${pctA}%` }}
          />
          <div
            className="h-full bg-text-secondary transition-all duration-300"
            style={{ width: `${100 - pctA}%` }}
          />
        </div>
        <span className={cn(
          "font-display text-[11px] font-bold tracking-[0.1em] uppercase text-center",
          diff === 0 ? "text-accent-dim" : diff > 1 ? "text-[#ff6b35]" : "text-text-muted"
        )}>
          {statusText}
        </span>
      </div>

      {/* SECTION HEADER */}
      <div className="flex items-center justify-between px-5 pt-4 pb-2.5">
        <span className="font-display text-[12px] font-bold tracking-[0.14em] uppercase text-text-muted">
          Drag to balance
        </span>
        <button
          className={cn(
            "font-display text-[12px] font-bold tracking-[0.1em] uppercase transition-colors",
            scrambling ? "text-accent-dim" : "text-accent-dim hover:text-accent"
          )}
          onClick={handleScramble}
        >
          Scramble
        </button>
      </div>

      {/* TEAMS GRID */}
      <div className="flex-1 px-5 grid grid-cols-2 gap-0 pt-0 overflow-hidden">
        {/* TEAM A COLUMN */}
        <div className="flex flex-col gap-0 pr-1.5 border-r border-border">
          <div className="font-display text-[11px] font-extrabold tracking-[0.14em] uppercase text-accent-dim pb-2 border-b border-border-accent mb-2">
            Runs
          </div>
          <div
            ref={zoneARef}
            className={cn(
              "flex-1 flex flex-col gap-1.5 overflow-y-auto custom-scrollbar rounded-md p-0.5 transition-colors",
              dragOverZone === "a" && "bg-[rgba(200,241,53,0.04)] outline outline-1 outline-dashed outline-border-accent"
            )}
            onDragOver={(e) => handleDragOver(e, "a")}
            onDragLeave={(e) => handleDragLeave(e, "a")}
            onDrop={(e) => handleDrop(e, "a")}
          >
            {teamA.map((id) => {
              const player = getPlayer(id);
              if (!player) return null;
              return (
                <div
                  key={id}
                  className={cn(
                    "bg-bg-surface border border-border rounded-md px-2.5 py-2.5 flex items-center gap-2 cursor-grab active:cursor-grabbing transition-all duration-120 relative overflow-hidden",
                    draggingId === id && "opacity-35 scale-97 border-border-accent",
                    "hover:border-border-accent hover:-translate-y-px"
                  )}
                  draggable
                  onDragStart={() => handleDragStart(id)}
                  onDragEnd={handleDragEnd}
                >
                  <div className="text-text-muted flex items-center">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-2.75 h-2.75">
                      <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
                      <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
                    </svg>
                  </div>
                  <span className="font-display text-[14px] font-extrabold tracking-[0.03em] uppercase text-text-primary leading-none flex-1 truncate">
                    {player.name}
                  </span>
                  <button
                    className="w-6 h-6 rounded-sm border border-border bg-bg-hover text-text-muted flex items-center justify-center cursor-pointer transition-all duration-120 hover:border-text-muted hover:text-text-secondary"
                    onClick={() => handleMovePlayer(id, "b")}
                    title="Move to Next"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-2.75 h-2.75">
                      <polyline points="9 18 15 12 9 6"/>
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* TEAM B COLUMN */}
        <div className="flex flex-col gap-0 pl-1.5">
          <div className="font-display text-[11px] font-extrabold tracking-[0.14em] uppercase text-text-muted pb-2 border-b border-border mb-2">
            Next
          </div>
          <div
            ref={zoneBRef}
            className={cn(
              "flex-1 flex flex-col gap-1.5 overflow-y-auto custom-scrollbar rounded-md p-0.5 transition-colors",
              dragOverZone === "b" && "bg-[rgba(200,241,53,0.04)] outline outline-1 outline-dashed outline-border-accent"
            )}
            onDragOver={(e) => handleDragOver(e, "b")}
            onDragLeave={(e) => handleDragLeave(e, "b")}
            onDrop={(e) => handleDrop(e, "b")}
          >
            {teamB.map((id) => {
              const player = getPlayer(id);
              if (!player) return null;
              return (
                <div
                  key={id}
                  className={cn(
                    "bg-bg-surface border border-border rounded-md px-2.5 py-2.5 flex items-center gap-2 cursor-grab active:cursor-grabbing transition-all duration-120 relative overflow-hidden",
                    draggingId === id && "opacity-35 scale-97 border-border-accent",
                    "hover:border-border-accent hover:-translate-y-px"
                  )}
                  draggable
                  onDragStart={() => handleDragStart(id)}
                  onDragEnd={handleDragEnd}
                >
                  <div className="text-text-muted flex items-center">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-2.75 h-2.75">
                      <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
                      <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
                    </svg>
                  </div>
                  <span className="font-display text-[14px] font-extrabold tracking-[0.03em] uppercase text-text-primary leading-none flex-1 truncate">
                    {player.name}
                  </span>
                  <button
                    className="w-6 h-6 rounded-sm border border-border bg-bg-hover text-text-muted flex items-center justify-center cursor-pointer transition-all duration-120 hover:border-text-muted hover:text-text-secondary"
                    onClick={() => handleMovePlayer(id, "a")}
                    title="Move to Runs"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-2.75 h-2.75">
                      <polyline points="15 18 9 12 15 6"/>
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* BOTTOM BAR */}
      <div className="bottom-bar">
        <button
          className={cn(
            "h-[52px] px-4 rounded-md border border-border bg-bg-surface text-text-secondary font-display text-[13px] font-bold tracking-[0.08em] uppercase transition-all duration-150 flex items-center gap-1.5",
            scrambling && "border-border-accent text-accent-dim"
          )}
          onClick={handleScramble}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
            <polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/>
          </svg>
          Scramble
        </button>
        <Button
          variant="primary"
          size="lg"
          className="flex-1 h-[52px]"
          onClick={handleConfirm}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          Confirm
        </Button>
      </div>
    </div>
  );
}
