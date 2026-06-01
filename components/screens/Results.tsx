"use client";

import { useRouter } from "next/navigation";
import { useRun, RunActions } from "@/contexts/RunContext";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Results() {
  const { state, dispatch } = useRun();
  const router = useRouter();
  const { currentGame, pastGames, currentRun, queue } = state;

  const finishedGame = pastGames[0];

  if (!finishedGame) {
    return null;
  }

  const winnerTeam = finishedGame.winner === "a" ? "Runs" : "Next";
  const isWinnerA = finishedGame.winner === "a";

  function handleNextGame() {
    router.push("/team-assignment");
  }

  function handleEndRun() {
    dispatch(RunActions.resetRun());
    router.push("/");
  }

  // Player scores by team
  const teamAPlayers = finishedGame.playerScores.filter((p) => p.team === "a");
  const teamBPlayers = finishedGame.playerScores.filter((p) => p.team === "b");

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
        <span className="font-display text-[12px] font-bold tracking-[0.1em] uppercase text-text-secondary bg-bg-surface border border-border px-2.5 py-1 rounded-sm">
          Game {finishedGame.id}
        </span>
      </div>

      {/* WINNER HERO */}
      <div className="px-5 pt-6 pb-4 text-center relative">
        {/* Glow background */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[260px] h-[140px] bg-accent-glow rounded-full blur-[48px] pointer-events-none" />

        <span className="font-display text-[11px] font-bold tracking-[0.16em] uppercase text-accent-dim relative z-10 block mb-1">
          Winner
        </span>
        <span className="font-display text-[38px] font-black uppercase text-text-primary leading-none relative z-10">
          {winnerTeam}
        </span>
      </div>

      {/* FINAL SCORE BLOCK */}
      <div className="mx-5 bg-bg-surface border border-border rounded-lg p-4 relative overflow-hidden before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[3px] before:bg-accent">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 relative z-10">
          {/* Team A */}
          <div className="flex flex-col items-center gap-1">
            <span className={cn(
              "font-display text-[11px] font-bold tracking-[0.14em] uppercase",
              isWinnerA ? "text-accent-dim" : "text-text-muted"
            )}>
              Runs
            </span>
            <span
              className={cn(
                "font-display font-black leading-none",
                isWinnerA ? "text-text-primary" : "text-text-secondary"
              )}
              style={{ fontSize: "clamp(56px, 14vw, 80px)" }}
            >
              {finishedGame.scoreA}
            </span>
          </div>

          {/* Separator */}
          <span className="font-display text-[24px] font-black text-text-muted pb-2">
            —
          </span>

          {/* Team B */}
          <div className="flex flex-col items-center gap-1">
            <span className={cn(
              "font-display text-[11px] font-bold tracking-[0.14em] uppercase",
              !isWinnerA ? "text-accent-dim" : "text-text-muted"
            )}>
              Next
            </span>
            <span
              className={cn(
                "font-display font-black leading-none",
                !isWinnerA ? "text-text-primary" : "text-text-secondary"
              )}
              style={{ fontSize: "clamp(56px, 14vw, 80px)" }}
            >
              {finishedGame.scoreB}
            </span>
          </div>
        </div>
      </div>

      {/* META ROW */}
      <div className="mx-5 mt-2.5 flex items-center justify-center gap-4">
        <div className="flex flex-col items-center gap-0.5">
          <span className="font-display text-[10px] font-bold tracking-[0.14em] uppercase text-text-muted">
            Duration
          </span>
          <span className="font-display text-[18px] font-black text-text-secondary leading-none">
            {finishedGame.duration}
          </span>
        </div>
        <div className="w-px h-6 bg-border" />
        <div className="flex flex-col items-center gap-0.5">
          <span className="font-display text-[10px] font-bold tracking-[0.14em] uppercase text-text-muted">
            Buckets
          </span>
          <span className="font-display text-[18px] font-black text-text-secondary leading-none">
            {finishedGame.scoreA + finishedGame.scoreB}
          </span>
        </div>
        <div className="w-px h-6 bg-border" />
        <div className="flex flex-col items-center gap-0.5">
          <span className="font-display text-[10px] font-bold tracking-[0.14em] uppercase text-text-muted">
            Top scorer
          </span>
          <span className="font-display text-[18px] font-black text-text-secondary leading-none">
            {finishedGame.playerScores.sort((a, b) => b.points - a.points)[0]?.name}
          </span>
        </div>
      </div>

      {/* BREAKDOWN SECTION */}
      <div className="px-5 pt-5">
        <span className="font-display text-[12px] font-bold tracking-[0.14em] uppercase text-text-muted">
          Breakdown
        </span>
      </div>

      {/* SCORELINES - 2 COLUMN GRID */}
      <div className="px-5 grid grid-cols-2 gap-2.5 overflow-y-auto custom-scrollbar">
        {/* Team A Column */}
        <div className="flex flex-col gap-1.5">
          <div className={cn(
            "font-display text-[11px] font-extrabold tracking-[0.14em] uppercase pb-1.5 border-b flex items-center justify-between",
            isWinnerA ? "text-accent-dim border-border-accent" : "text-text-muted border-border"
          )}>
            Runs
            <span className={cn(
              "font-display text-[13px] font-black",
              isWinnerA ? "text-accent" : "text-text-muted"
            )}>
              {finishedGame.scoreA}
            </span>
          </div>
          {teamAPlayers.sort((a, b) => b.points - a.points).map((player, idx) => (
            <div
              key={player.name}
              className={cn(
                "bg-bg-surface border border-border rounded-md px-2.5 py-2 flex items-center justify-between",
                idx === 0 && "border-border-accent"
              )}
            >
              <span className="font-display text-[13px] font-extrabold tracking-[0.03em] uppercase text-text-primary truncate flex-1">
                {player.name}
              </span>
              <span className={cn(
                "font-display font-black leading-none",
                idx === 0 ? "text-accent text-[20px]" : "text-text-muted text-[16px]"
              )}>
                {player.points}
              </span>
            </div>
          ))}
        </div>

        {/* Team B Column */}
        <div className="flex flex-col gap-1.5">
          <div className={cn(
            "font-display text-[11px] font-extrabold tracking-[0.14em] uppercase pb-1.5 border-b flex items-center justify-between",
            !isWinnerA ? "text-accent-dim border-border-accent" : "text-text-muted border-border"
          )}>
            Next
            <span className={cn(
              "font-display text-[13px] font-black",
              !isWinnerA ? "text-accent" : "text-text-muted"
            )}>
              {finishedGame.scoreB}
            </span>
          </div>
          {teamBPlayers.sort((a, b) => b.points - a.points).map((player, idx) => (
            <div
              key={player.name}
              className={cn(
                "bg-bg-surface border border-border rounded-md px-2.5 py-2 flex items-center justify-between",
                idx === 0 && "border-border-accent"
              )}
            >
              <span className="font-display text-[13px] font-extrabold tracking-[0.03em] uppercase text-text-primary truncate flex-1">
                {player.name}
              </span>
              <span className={cn(
                "font-display font-black leading-none",
                idx === 0 ? "text-accent text-[20px]" : "text-text-muted text-[16px]"
              )}>
                {player.points}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* QUEUE PREVIEW */}
      <div className="mx-5 mt-4 bg-bg-surface border border-border rounded-md px-3.5 py-2.5 flex items-center gap-2.5">
        <span className="font-display text-[10px] font-bold tracking-[0.14em] uppercase text-text-muted flex-shrink-0">
          Up next
        </span>
        <span className="font-display text-[13px] font-bold tracking-[0.04em] uppercase text-text-secondary flex-1 truncate">
          {queue.slice(0, 5).map((p) => p.name).join(", ")}...
        </span>
        <span className="font-display text-[11px] font-bold tracking-[0.08em] uppercase text-text-muted flex-shrink-0">
          +{Math.max(0, queue.length - 5)}
        </span>
      </div>

      {/* BOTTOM BAR */}
      <div className="bottom-bar">
        <Button
          variant="secondary"
          size="lg"
          className="flex-1 h-[52px]"
          onClick={handleEndRun}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
          Lobby
        </Button>
        <Button
          variant="primary"
          size="lg"
          className="flex-1 h-[52px]"
          onClick={handleNextGame}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <polygon points="5 3 19 12 5 21 5 3"/>
          </svg>
          Next Game
        </Button>
      </div>
    </div>
  );
}
