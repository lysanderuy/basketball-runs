"use client";

import { useRouter } from "next/navigation";
import { useRun, RunActions } from "@/contexts/RunContext";
import { cn } from "@/lib/utils";
import { formatTime } from "@/lib/utils";

export function Game() {
  const { state, dispatch } = useRun();
  const router = useRouter();
  const { currentGame, currentRun } = state;

  if (!currentGame) return null;

  const { scoreA, scoreB, clockSeconds, clockRunning, teamA, teamB, history } = currentGame;
  const goal = currentRun?.scoreGoal || 21;
  const goalReached = scoreA >= goal || scoreB >= goal;

  function handleScore(team: "a" | "b", player: any) {
    if (goalReached) return;
    dispatch(RunActions.scorePoint(team, player.id, player.name));
  }

  function handleUndo() {
    if (history.length === 0) return;
    dispatch(RunActions.undoScore());
  }

  function handleEndGame() {
    const winner = scoreA >= goal ? "a" : "b";
    const pastGame = {
      id: currentGame!.id,
      winner: winner as "a" | "b",
      scoreA,
      scoreB,
      duration: formatTime(900 - clockSeconds),
      winnerName: winner === "a" ? "Team A" : "Team B",
      playerScores: [
        ...teamA.map((p) => ({
          name: p.name,
          points: history.filter((e) => e.playerId === p.id && e.team === "a").length,
          team: "a" as const,
        })),
        ...teamB.map((p) => ({
          name: p.name,
          points: history.filter((e) => e.playerId === p.id && e.team === "b").length,
          team: "b" as const,
        })),
      ],
    };
    dispatch(RunActions.endGame(pastGame));
    router.push("/results");
  }

  const getPlayerPoints = (player: any, team: "a" | "b") => {
    return history.filter((e) => e.playerId === player.id && e.team === team).length;
  };

  const aProgress = Math.min(scoreA / goal, 1) * 47;
  const bProgress = Math.min(scoreB / goal, 1) * 47;

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
          <span className="font-display text-[12px] font-bold tracking-[0.1em] uppercase text-accent bg-accent-glow border border-border-accent px-2.5 py-1 rounded-sm">
            Game {currentGame.id}
          </span>
          <button className="w-9 h-9 rounded-sm border border-border bg-bg-surface text-text-secondary flex items-center justify-center cursor-pointer transition-all duration-150 hover:border-accent-dim hover:text-accent hover:bg-accent-glow">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <circle cx="18" cy="5" r="3"/>
              <circle cx="6" cy="12" r="3"/>
              <circle cx="18" cy="19" r="3"/>
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
            </svg>
          </button>
        </div>
      </div>

      {/* SCOREBOARD */}
      <div className="px-5 pt-4">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 py-2">
          {/* Team A */}
          <div className="flex flex-col items-center gap-1">
            <span className="font-display text-[11px] font-bold tracking-[0.14em] uppercase text-text-muted">
              Runs
            </span>
            <span
              className={cn(
                "font-display font-black leading-none transition-colors",
                scoreA >= scoreB ? "text-accent" : "text-text-secondary"
              )}
              style={{ fontSize: scoreA >= 100 ? "72px" : "96px" }}
            >
              {scoreA}
            </span>
            <span className="font-display text-[12px] font-semibold tracking-[0.08em] uppercase text-text-muted">
              to {goal}
            </span>
          </div>

          {/* Court Divider - Circle with dash */}
          <div className="flex flex-col items-center pt-3">
            <div className="w-[72px] h-[72px] rounded-full border-2 border-border flex items-center justify-center">
              <span className="font-display text-[28px] font-black text-text-muted">—</span>
            </div>
          </div>

          {/* Team B */}
          <div className="flex flex-col items-center gap-1">
            <span className="font-display text-[11px] font-bold tracking-[0.14em] uppercase text-text-muted">
              Next
            </span>
            <span
              className={cn(
                "font-display font-black leading-none transition-colors",
                scoreB >= scoreA ? "text-accent" : "text-text-secondary"
              )}
              style={{ fontSize: scoreB >= 100 ? "72px" : "96px" }}
            >
              {scoreB}
            </span>
            <span className="font-display text-[12px] font-semibold tracking-[0.08em] uppercase text-text-muted">
              to {goal}
            </span>
          </div>
        </div>
      </div>

      {/* CLOCK BAR */}
      <div className="mx-5 mt-2 bg-bg-surface border border-border rounded-md px-4 py-2.5 flex items-center justify-between">
        <span
          className={cn(
            "font-display text-[42px] font-bold leading-none",
            clockRunning ? "text-accent" : "text-text-secondary",
            clockSeconds <= 60 && "text-[#ff6b35] animate-pulse-warn"
          )}
        >
          {formatTime(clockSeconds)}
        </span>
        <button
          className={cn(
            "h-[38px] px-4 rounded-sm border font-display text-[13px] font-bold tracking-[0.08em] uppercase transition-all",
            clockRunning
              ? "bg-accent-glow border-border-accent text-accent"
              : "bg-bg-hover border-border text-text-primary hover:border-accent-dim hover:text-accent"
          )}
          onClick={() => dispatch(RunActions.toggleClock())}
        >
          {clockRunning ? "Pause" : "Resume"}
        </button>
      </div>

      {/* PROGRESS BAR */}
      <div className="mx-5 mt-1 flex flex-col gap-1.5">
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
        <div className="h-[5px] bg-bg-surface rounded-sm overflow-visible flex gap-[3px]">
          <div
            className="h-full bg-accent transition-all duration-300 ease-out"
            style={{ width: `${aProgress}%` }}
          />
          <div
            className="h-full bg-text-secondary transition-all duration-300 ease-out"
            style={{ width: `${bProgress}%` }}
          />
        </div>
      </div>

      {/* SCORE LOG */}
      {history.length > 0 && (
        <div className="px-5 pt-4">
          <div className="flex items-center pb-2">
            <span className="font-display text-[12px] font-bold tracking-[0.14em] uppercase text-text-muted">
              Recent
            </span>
          </div>
          <div className="flex flex-col gap-1">
            {history.slice(0, 3).map((event, idx) => (
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
      )}

      {/* SECTION HEADER */}
      <div className="px-5 flex items-center justify-between pt-4 pb-2">
        <span className="font-display text-[12px] font-bold tracking-[0.14em] uppercase text-text-muted">
          Tap to score
        </span>
        <button
          className="font-display text-[12px] font-bold tracking-[0.1em] uppercase text-accent-dim hover:text-accent transition-colors"
          onClick={() => router.push("/team-assignment")}
        >
          Edit teams
        </button>
      </div>

      {/* TEAMS - 2 COLUMN GRID */}
      <div className="px-5 grid grid-cols-2 gap-2.5 pb-4">
        {/* Team A Column */}
        <div className="flex flex-col gap-1.5">
          <div className="font-display text-[11px] font-extrabold tracking-[0.14em] uppercase text-accent-dim pb-1 border-b border-border-accent mb-0.5">
            Runs
          </div>
          {teamA.map((player) => (
            <div
              key={player.id}
              onClick={() => handleScore("a", player)}
              className={cn(
                "bg-bg-surface border border-border rounded-md px-3 py-2.5 cursor-pointer transition-all duration-120 relative overflow-hidden",
                "hover:border-border-accent hover:-translate-y-px hover:bg-accent-glow active:scale-98 active:border-accent",
                goalReached && "opacity-50 cursor-not-allowed"
              )}
            >
              <div className="flex flex-col gap-0.5 relative z-10">
                <span className="font-display text-[15px] font-extrabold tracking-[0.03em] uppercase text-text-primary leading-none">
                  {player.name}
                </span>
                <span className="font-display text-[10px] font-semibold tracking-[0.12em] uppercase text-text-muted">
                  pts
                </span>
              </div>
              <span
                className={cn(
                  "font-display font-black leading-none transition-colors relative z-10",
                  "text-[22px] tracking-[-0.01em]",
                  getPlayerPoints(player, "a") > 0 ? "text-accent" : "text-text-secondary"
                )}
              >
                {getPlayerPoints(player, "a")}
              </span>
            </div>
          ))}
        </div>

        {/* Team B Column */}
        <div className="flex flex-col gap-1.5">
          <div className="font-display text-[11px] font-extrabold tracking-[0.14em] uppercase text-text-muted pb-1 border-b border-border mb-0.5">
            Next
          </div>
          {teamB.map((player) => (
            <div
              key={player.id}
              onClick={() => handleScore("b", player)}
              className={cn(
                "bg-bg-surface border border-border rounded-md px-3 py-2.5 cursor-pointer transition-all duration-120 relative overflow-hidden",
                "hover:border-border-accent hover:-translate-y-px hover:bg-accent-glow active:scale-98 active:border-accent",
                goalReached && "opacity-50 cursor-not-allowed"
              )}
            >
              <div className="flex flex-col gap-0.5 relative z-10">
                <span className="font-display text-[15px] font-extrabold tracking-[0.03em] uppercase text-text-primary leading-none">
                  {player.name}
                </span>
                <span className="font-display text-[10px] font-semibold tracking-[0.12em] uppercase text-text-muted">
                  pts
                </span>
              </div>
              <span
                className={cn(
                  "font-display font-black leading-none transition-colors relative z-10",
                  "text-[22px] tracking-[-0.01em]",
                  getPlayerPoints(player, "b") > 0 ? "text-accent" : "text-text-secondary"
                )}
              >
                {getPlayerPoints(player, "b")}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* BOTTOM BAR */}
      <div className="bottom-bar">
        <button
          className={cn(
            "h-[52px] px-4 rounded-md border border-border bg-bg-surface text-text-secondary font-display text-[13px] font-bold tracking-[0.08em] uppercase transition-all duration-150 flex items-center gap-1.5",
            history.length === 0 && "opacity-40 cursor-not-allowed",
            history.length > 0 && "hover:border-text-muted hover:text-text-primary"
          )}
          onClick={handleUndo}
          disabled={history.length === 0}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
            <polyline points="9 14 4 9 9 4"/>
            <path d="M20 20v-7a4 4 0 0 0-4-4H4"/>
          </svg>
          Undo
        </button>
        <button
          className="flex-1 h-[52px] rounded-md border border-[#ff4040] bg-[rgba(255,64,64,0.08)] text-[#ff6060] font-display text-[15px] font-bold tracking-[0.1em] uppercase transition-all duration-150 hover:bg-[rgba(255,64,64,0.16)] hover:text-[#ff8080]"
          onClick={handleEndGame}
        >
          End Game
        </button>
      </div>
    </div>
  );
}
