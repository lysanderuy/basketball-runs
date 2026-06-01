"use client";

import { useRun } from "@/contexts/RunContext";
import { cn } from "@/lib/utils";
import { formatTime } from "@/lib/utils";
import { useState, useEffect } from "react";

export function Feed() {
  const { state } = useRun();
  const { pastGames, currentRun, currentGame } = state;

  // Simulated live clock
  const [clockSeconds, setClockSeconds] = useState(767);

  useEffect(() => {
    const interval = setInterval(() => {
      setClockSeconds((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const hasPastGames = pastGames.length > 0;

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
          <span className="font-display text-[12px] font-bold tracking-[0.1em] uppercase text-accent bg-accent-glow border border-border-accent px-2.5 py-1 rounded-sm flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-live-pulse" />
            Live
          </span>
        </div>
      </div>

      {/* FEED CONTENT */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pb-6">
        {/* LIVE CARD */}
        <div className="mx-5 mt-4 bg-bg-surface border border-border-accent rounded-lg overflow-hidden relative cursor-pointer transition-colors hover:border-accent-dim">
          {/* Accent top bar */}
          <div className="h-0.75 bg-accent w-full" />

          <div className="p-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <span className="font-display text-[11px] font-bold tracking-[0.14em] uppercase text-text-muted">
                Game {currentGame?.id || 4} · In progress
              </span>
              <span className={cn(
                "font-display text-[14px] font-black tracking-[0.06em]",
                clockSeconds <= 60 ? "text-[#ff6b35] animate-pulse-warn" : "text-accent"
              )}>
                {formatTime(clockSeconds)}
              </span>
            </div>

            {/* Score Row */}
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1.5 mb-3">
              {/* Team A */}
              <div className="flex flex-col items-center gap-0.5">
                <span className="font-display text-[11px] font-bold tracking-[0.14em] uppercase text-text-muted">
                  Runs
                </span>
                <span
                  className="font-display font-black leading-none text-text-primary"
                  style={{ fontSize: "clamp(52px, 14vw, 72px)" }}
                >
                  {currentGame?.scoreA || 14}
                </span>
                <span className="font-display text-[11px] font-semibold tracking-[0.08em] uppercase text-text-muted">
                  to 21
                </span>
              </div>

              {/* Separator */}
              <span className="font-display text-[22px] font-black text-text-muted pb-2.5">
                —
              </span>

              {/* Team B */}
              <div className="flex flex-col items-center gap-0.5">
                <span className="font-display text-[11px] font-bold tracking-[0.14em] uppercase text-text-muted">
                  Next
                </span>
                <span
                  className="font-display font-black leading-none text-text-primary"
                  style={{ fontSize: "clamp(52px, 14vw, 72px)" }}
                >
                  {currentGame?.scoreB || 11}
                </span>
                <span className="font-display text-[11px] font-semibold tracking-[0.08em] uppercase text-text-muted">
                  to 21
                </span>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="h-0.75 bg-bg-hover rounded-sm overflow-hidden flex gap-0.5">
              <div
                className="h-full bg-accent"
                style={{ width: `${Math.min((currentGame?.scoreA || 14) / 21 * 47, 47)}%` }}
              />
              <div
                className="h-full bg-text-secondary"
                style={{ width: `${Math.min((currentGame?.scoreB || 11) / 21 * 47, 47)}%` }}
              />
            </div>

            {/* Last Score Line */}
            <div className="flex items-center gap-1.5 mt-2.5">
              <div className="w-1.25 h-1.25 rounded-full bg-accent flex-shrink-0" />
              <span className="font-display text-[12px] font-semibold tracking-[0.04em] text-text-muted flex-1">
                Marcus scored
              </span>
              <span className="font-display text-[11px] font-semibold tracking-[0.08em] uppercase text-text-muted">
                Tap to watch →
              </span>
            </div>
          </div>
        </div>

        {/* PAST GAMES SECTION */}
        <div className="flex items-center justify-between px-5 pt-6 pb-2.5">
          <span className="font-display text-[12px] font-bold tracking-[0.14em] uppercase text-text-muted">
            Past games
          </span>
          <span className="font-display text-[12px] font-bold tracking-[0.1em] uppercase text-text-muted">
            {hasPastGames ? pastGames.length : 0} played
          </span>
        </div>

        {hasPastGames ? (
          <div className="px-5 flex flex-col gap-2">
            {pastGames.map((game) => (
              <div
                key={game.id}
                className="bg-bg-surface border border-border rounded-md p-3 flex items-center gap-3 cursor-pointer transition-colors hover:border-border-accent active:scale-99 relative overflow-hidden"
              >
                {/* Main content */}
                <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                  <span className="font-display text-[10px] font-bold tracking-[0.14em] uppercase text-text-muted leading-none">
                    Game {game.id}
                  </span>
                  <span className="font-display text-[16px] font-extrabold tracking-[0.04em] uppercase text-text-primary leading-none truncate">
                    {game.winnerName} won
                  </span>
                  <span className="font-display text-[11px] font-semibold tracking-[0.06em] uppercase text-text-muted">
                    {game.duration}
                  </span>
                </div>

                {/* Score */}
                <span className="font-display text-[22px] font-black text-text-secondary flex-shrink-0">
                  {game.scoreA}–{game.scoreB}
                </span>

                {/* Chevron */}
                <div className="text-text-muted flex-shrink-0 transition-colors group-hover:text-text-secondary">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mx-5 mt-2 p-6 bg-bg-surface border border-dashed border-border rounded-md flex flex-col items-center gap-1.5 text-center">
            <span className="font-display text-[13px] font-bold tracking-[0.08em] uppercase text-text-muted">
              No past games
            </span>
            <span className="font-body text-[12px] text-text-muted">
              Completed games will appear here
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
