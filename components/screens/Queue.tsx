"use client";

import { useRun, RunActions } from "@/contexts/RunContext";
import { cn } from "@/lib/utils";

export function Queue() {
  const { state, dispatch } = useRun();
  const { currentRun, queue } = state;

  const courtPlayers = queue.filter((p) => p.section === "court");
  const nextPlayers = queue.filter((p) => p.section === "next");
  const waitingPlayers = queue.filter((p) => p.section === "waiting");

  return (
    <div className="app-shell">
      {/* TOPBAR */}
      <div className="topbar">
        <div className="flex flex-col gap-0.5">
          <span className="font-display text-[11px] font-bold tracking-[0.12em] uppercase text-text-muted">
            {currentRun?.name}
          </span>
          <span className="font-display text-[20px] font-black tracking-[0.02em] uppercase text-text-primary leading-none">
            Queue
          </span>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="font-display text-[12px] font-bold tracking-[0.1em] uppercase text-accent bg-accent-glow border border-border-accent px-2.5 py-1 rounded-sm">
            Game 4
          </span>
          <button className="w-9 h-9 rounded-sm border border-border bg-bg-surface text-text-secondary flex items-center justify-center cursor-pointer transition-all duration-150 hover:border-accent-dim hover:text-accent hover:bg-accent-glow">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </button>
        </div>
      </div>

      {/* STATS STRIP */}
      <div className="mx-5 mt-5 grid grid-cols-4 gap-0 bg-bg-surface border border-border rounded-md overflow-hidden">
        <div className="px-2.5 py-2.5 flex flex-col items-center border-r border-border last:border-r-0">
          <span className="font-display text-[10px] font-bold tracking-[0.14em] uppercase text-text-muted">
            On court
          </span>
          <span className="font-display text-[22px] font-black text-accent leading-none mt-0.5">
            {courtPlayers.length}
          </span>
        </div>
        <div className="px-2.5 py-2.5 flex flex-col items-center border-r border-border last:border-r-0">
          <span className="font-display text-[10px] font-bold tracking-[0.14em] uppercase text-text-muted">
            Up next
          </span>
          <span className="font-display text-[22px] font-black text-text-primary leading-none mt-0.5">
            {nextPlayers.length}
          </span>
        </div>
        <div className="px-2.5 py-2.5 flex flex-col items-center border-r border-border last:border-r-0">
          <span className="font-display text-[10px] font-bold tracking-[0.14em] uppercase text-text-muted">
            Waiting
          </span>
          <span className="font-display text-[22px] font-black text-text-primary leading-none mt-0.5">
            {waitingPlayers.length}
          </span>
        </div>
        <div className="px-2.5 py-2.5 flex flex-col items-center border-r border-border last:border-r-0">
          <span className="font-display text-[10px] font-bold tracking-[0.14em] uppercase text-text-muted">
            Total
          </span>
          <span className="font-display text-[22px] font-black text-accent leading-none mt-0.5">
            {queue.length}
          </span>
        </div>
      </div>

      {/* QUEUE BODY */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pb-6">
        {/* ON COURT SECTION */}
        <div className="mt-5">
          <div className="flex items-center justify-between px-5 pb-2">
            <span className="font-display text-[12px] font-bold tracking-[0.14em] uppercase text-text-muted flex items-center gap-1.5">
              On Court
              <span className="font-display text-[11px] font-bold tracking-[0.08em] text-accent-dim bg-accent-glow border border-border-accent px-1.5 py-0.5 rounded-sm">
                {courtPlayers.length}
              </span>
            </span>
          </div>
          <div className="px-5 flex flex-col gap-1.5">
            {courtPlayers.map((player, idx) => (
              <div
                key={player.id}
                className="bg-bg-surface border border-border-accent rounded-md px-3 py-2.5 flex items-center gap-2.5 relative transition-all duration-120 select-none group bg-[rgba(200,241,53,0.04)]"
              >
                <div className="text-text-muted flex items-center cursor-grab active:cursor-grabbing hover:text-text-secondary transition-colors">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
                    <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
                    <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
                  </svg>
                </div>
                <span className="font-display text-[13px] font-bold tracking-[0.04em] text-accent-dim w-4.5 text-center flex-shrink-0">
                  {idx + 1}
                </span>
                <span className="font-display text-[16px] font-black tracking-[0.03em] uppercase text-text-primary leading-none flex-1">
                  {player.name}
                </span>
                <span className="font-display text-[12px] font-semibold tracking-[0.06em] text-text-muted flex-shrink-0">
                  {player.games === 1 ? "1 game" : `${player.games} games`}
                </span>
                <div className="hidden group-hover:flex items-center gap-1">
                  <button className="w-7 h-7 rounded-sm border border-border bg-bg-hover text-text-muted flex items-center justify-center cursor-pointer transition-all duration-120 hover:border-text-muted hover:text-text-secondary">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                  </button>
                  <button className="w-7 h-7 rounded-sm border border-border bg-bg-hover text-text-muted flex items-center justify-center cursor-pointer transition-all duration-120 hover:border-text-muted hover:text-text-secondary">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
                      <circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
                    </svg>
                  </button>
                  <button
                    className="w-7 h-7 rounded-sm border border-border bg-bg-hover text-danger flex items-center justify-center cursor-pointer transition-all duration-120 hover:border-danger hover:bg-danger-light"
                    onClick={() => dispatch(RunActions.removePlayer(player.id))}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
                      <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* UP NEXT SECTION */}
        <div className="mt-5">
          <div className="flex items-center justify-between px-5 pb-2">
            <span className="font-display text-[12px] font-bold tracking-[0.14em] uppercase text-text-muted flex items-center gap-1.5">
              Up Next
              <span className="font-display text-[11px] font-bold tracking-[0.08em] text-text-muted bg-bg-surface border border-border px-1.5 py-0.5 rounded-sm">
                {nextPlayers.length}
              </span>
            </span>
          </div>
          <div className="px-5 flex flex-col gap-1.5">
            {nextPlayers.map((player, idx) => (
              <div
                key={player.id}
                className="bg-bg-surface border border-border rounded-md px-3 py-2.5 flex items-center gap-2.5 relative transition-all duration-120 select-none group"
              >
                <div className="text-text-muted flex items-center cursor-grab active:cursor-grabbing hover:text-text-secondary transition-colors">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
                    <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
                    <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
                  </svg>
                </div>
                <span className="font-display text-[13px] font-bold tracking-[0.04em] text-text-muted w-4.5 text-center flex-shrink-0">
                  {idx + 1}
                </span>
                <span className="font-display text-[16px] font-black tracking-[0.03em] uppercase text-text-primary leading-none flex-1">
                  {player.name}
                </span>
                <span className="font-display text-[12px] font-semibold tracking-[0.06em] text-text-muted flex-shrink-0">
                  {player.games === 1 ? "1 game" : `${player.games} games`}
                </span>
                <div className="hidden group-hover:flex items-center gap-1">
                  <button className="w-7 h-7 rounded-sm border border-border bg-bg-hover text-text-muted flex items-center justify-center cursor-pointer transition-all duration-120 hover:border-text-muted hover:text-text-secondary">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                  </button>
                  <button className="w-7 h-7 rounded-sm border border-border bg-bg-hover text-text-muted flex items-center justify-center cursor-pointer transition-all duration-120 hover:border-text-muted hover:text-text-secondary">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
                      <circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
                    </svg>
                  </button>
                  <button
                    className="w-7 h-7 rounded-sm border border-border bg-bg-hover text-danger flex items-center justify-center cursor-pointer transition-all duration-120 hover:border-danger hover:bg-danger-light"
                    onClick={() => dispatch(RunActions.removePlayer(player.id))}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
                      <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* WAITING SECTION */}
        <div className="mt-5">
          <div className="flex items-center justify-between px-5 pb-2">
            <span className="font-display text-[12px] font-bold tracking-[0.14em] uppercase text-text-muted flex items-center gap-1.5">
              Waiting
              <span className="font-display text-[11px] font-bold tracking-[0.08em] text-text-muted bg-bg-surface border border-border px-1.5 py-0.5 rounded-sm">
                {waitingPlayers.length}
              </span>
            </span>
          </div>
          <div className="px-5 flex flex-col gap-1.5">
            {waitingPlayers.map((player, idx) => (
              <div
                key={player.id}
                className="bg-bg-surface border border-border rounded-md px-3 py-2.5 flex items-center gap-2.5 relative transition-all duration-120 select-none group"
              >
                <div className="text-text-muted flex items-center cursor-grab active:cursor-grabbing hover:text-text-secondary transition-colors">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
                    <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
                    <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
                  </svg>
                </div>
                <span className="font-display text-[13px] font-bold tracking-[0.04em] text-text-muted w-4.5 text-center flex-shrink-0">
                  {courtPlayers.length + nextPlayers.length + idx + 1}
                </span>
                <span className="font-display text-[16px] font-black tracking-[0.03em] uppercase text-text-primary leading-none flex-1">
                  {player.name}
                </span>
                <span className="font-display text-[12px] font-semibold tracking-[0.06em] text-text-muted flex-shrink-0">
                  {player.games === 1 ? "1 game" : `${player.games} games`}
                </span>
                <div className="hidden group-hover:flex items-center gap-1">
                  <button className="w-7 h-7 rounded-sm border border-border bg-bg-hover text-text-muted flex items-center justify-center cursor-pointer transition-all duration-120 hover:border-text-muted hover:text-text-secondary">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                  </button>
                  <button className="w-7 h-7 rounded-sm border border-border bg-bg-hover text-text-muted flex items-center justify-center cursor-pointer transition-all duration-120 hover:border-text-muted hover:text-text-secondary">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
                      <circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
                    </svg>
                  </button>
                  <button
                    className="w-7 h-7 rounded-sm border border-border bg-bg-hover text-danger flex items-center justify-center cursor-pointer transition-all duration-120 hover:border-danger hover:bg-danger-light"
                    onClick={() => dispatch(RunActions.removePlayer(player.id))}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
                      <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {queue.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-8 text-center px-5">
            <div className="w-10 h-10 rounded-full border border-dashed border-border flex items-center justify-center text-text-muted">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4.5 h-4.5">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </div>
            <p className="font-display text-[14px] font-bold tracking-[0.06em] uppercase text-text-muted">
              No players yet
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
