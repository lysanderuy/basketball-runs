"use client";

import { useRun } from "@/contexts/RunContext";
import { cn } from "@/lib/utils";
import { formatTime } from "@/lib/utils";
import { useState, useEffect } from "react";

export function Spectator() {
  const { state } = useRun();
  const { currentGame, currentRun } = state;

  const [clockSeconds, setClockSeconds] = useState(767);

  useEffect(() => {
    const interval = setInterval(() => {
      setClockSeconds((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  if (!currentGame) return null;

  const { scoreA, scoreB, teamA, teamB } = currentGame;
  const goal = currentRun?.scoreGoal || 21;
  const isClose = Math.abs(scoreA - scoreB) <= 2 && (scoreA >= 15 || scoreB >= 15);

  const aProgress = Math.min(scoreA / goal, 1) * 47;
  const bProgress = Math.min(scoreB / goal, 1) * 47;

  // Queue position (placeholder)
  const userPosition = 7;
  const gamesAway = Math.ceil((userPosition - 5) / 5);

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

      {/* SCOREBOARD */}
      <div className="flex-1 flex flex-col justify-center px-5 py-6">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          {/* Team A */}
          <div className="flex flex-col items-center gap-1">
            <span className="font-display text-[12px] font-bold tracking-[0.16em] uppercase text-text-muted">
              Runs
            </span>
            <span
              className="font-display font-black leading-none text-text-primary"
              style={{ fontSize: "clamp(110px, 28vw, 180px)" }}
            >
              {scoreA}
            </span>
            <span className="font-display text-[12px] font-semibold tracking-[0.1em] uppercase text-text-muted">
              to {goal}
            </span>
          </div>

          {/* Separator */}
          <div className="flex flex-col items-center pb-4">
            <span className="font-display text-[32px] font-black text-text-muted leading-none">
              —
            </span>
          </div>

          {/* Team B */}
          <div className="flex flex-col items-center gap-1">
            <span className="font-display text-[12px] font-bold tracking-[0.16em] uppercase text-text-muted">
              Next
            </span>
            <span
              className="font-display font-black leading-none text-text-primary"
              style={{ fontSize: "clamp(110px, 28vw, 180px)" }}
            >
              {scoreB}
            </span>
            <span className="font-display text-[12px] font-semibold tracking-[0.1em] uppercase text-text-muted">
              to {goal}
            </span>
          </div>
        </div>
      </div>

      {/* CLOCK */}
      <div className="flex justify-center px-5 pt-2">
        <span className={cn(
          "font-display text-[36px] font-black tracking-[0.06em]",
          clockSeconds <= 60 ? "text-[#ff6b35] animate-pulse-warn" : "text-accent"
        )}>
          {formatTime(clockSeconds)}
        </span>
      </div>

      {/* PROGRESS BAR */}
      <div className="mx-5 mt-3 flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="font-display text-[11px] font-bold tracking-[0.1em] uppercase text-text-muted">
            Runs — {scoreA}
          </span>
          <span className="font-display text-[11px] font-bold tracking-[0.1em] uppercase text-text-muted">
            Goal: {goal}
          </span>
          <span className="font-display text-[11px] font-bold tracking-[0.1em] uppercase text-text-muted">
            {scoreB} — Next
          </span>
        </div>
        <div className="h-[5px] bg-bg-surface rounded-sm overflow-hidden flex gap-[3px]">
          <div
            className="h-full bg-accent transition-all duration-300"
            style={{ width: `${aProgress}%` }}
          />
          <div
            className="h-full bg-text-secondary transition-all duration-300"
            style={{ width: `${bProgress}%` }}
          />
        </div>
      </div>

      {/* RECENT LOG */}
      <div className="px-5 pt-4">
        <div className="flex items-center pb-2">
          <span className="font-display text-[12px] font-bold tracking-[0.14em] uppercase text-text-muted">
            Recent
          </span>
        </div>
        <div className="flex flex-col gap-1">
          {currentGame.history.slice(0, 3).map((event, idx) => (
            <div
              key={idx}
              className="flex items-center gap-2 px-2.5 py-1.5 bg-bg-surface border border-border rounded-sm"
            >
              <div
                className={cn(
                  "w-1.5 h-1.5 rounded-full flex-shrink-0",
                  event.team === "a" ? "bg-accent" : "bg-text-secondary"
                )}
              />
              <span className="font-display text-[13px] font-semibold tracking-[0.04em] text-text-secondary flex-1">
                {event.playerName} scored
              </span>
              <span className="font-display text-[13px] font-bold tracking-[0.06em] text-text-muted tabular-nums">
                {event.scoreA} – {event.scoreB}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* QUEUE POSITION */}
      <div className="mx-5 mt-4 bg-bg-surface border border-border rounded-md px-4 py-3 flex items-center justify-between">
        <div className="flex flex-col gap-0.5">
          <span className="font-display text-[10px] font-bold tracking-[0.14em] uppercase text-text-muted">
            Your position
          </span>
          <span className="font-display text-[22px] font-black text-text-primary leading-none">
            #{userPosition} in queue
          </span>
        </div>
        <span className="font-display text-[12px] font-bold tracking-[0.1em] uppercase text-text-muted text-right">
          ~{gamesAway} {gamesAway === 1 ? "game" : "games"} away
        </span>
      </div>

      {/* Bottom spacer */}
      <div className="h-6" />
    </div>
  );
}
