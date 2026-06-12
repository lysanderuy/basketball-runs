"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { SessionTopbar } from "@/components/ui/session-topbar";
import { useGameRealtime } from "@/hooks/use-game-realtime";
import { formatTime } from "@/lib/utils";
import {
  useClockMutation,
  useEndGameMutation,
  useGameDetails,
  useGames,
  useScoreMutation,
  useUndoScoreMutation,
  type GameData,
  type PlayerData,
} from "@/hooks/use-game";
import { useRun } from "@/hooks/use-run";
import { useSessionUser } from "@/hooks/use-session";

function scoreValuesFor(pointSystem: "one_two" | "two_three"): readonly number[] {
  return pointSystem === "one_two" ? [1, 2] : [2, 3];
}

// ─── Types ────────────────────────────────────────────────────────────────────

type PendingScore = {
  points: number;
};

// ─── Clock calculation ────────────────────────────────────────────────────────

function computeElapsed(game: GameData): number {
  if (!game.clockStartedAt) return 0;
  const startMs = new Date(game.clockStartedAt).getTime();
  const endMs = game.clockPausedAt
    ? new Date(game.clockPausedAt).getTime()
    : Date.now();
  return Math.max(0, Math.floor((endMs - startMs) / 1000) - game.totalPausedSeconds);
}

function getClockDisplay(game: GameData, timeLimitSeconds: number | null): number {
  const elapsed = computeElapsed(game);
  if (timeLimitSeconds !== null) {
    return Math.max(0, timeLimitSeconds - elapsed);
  }
  return elapsed;
}

function isClockRunning(game: GameData): boolean {
  return !!game.clockStartedAt && !game.clockPausedAt && game.status !== "completed";
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function GamePage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();

  const runQuery = useRun(code);
  const gamesQuery = useGames(code);
  const sessionQuery = useSessionUser();

  const run = runQuery.data ?? null;
  const userId = sessionQuery.data ?? null;

  const games = gamesQuery.data;
  const currentGameId = useMemo(() => {
    if (!games) return null;
    const current =
      games.find((g) => g.status === "active") ??
      games.find((g) => g.status === "pending") ??
      games[0] ??
      null;
    return current?.id ?? null;
  }, [games]);

  const detailsQuery = useGameDetails(code, currentGameId);
  const details = detailsQuery.data ?? null;

  const loading =
    runQuery.isPending ||
    gamesQuery.isPending ||
    sessionQuery.isPending ||
    (!!currentGameId && detailsQuery.isPending);

  const [clockDisplay, setClockDisplay] = useState(0);
  const [pendingScore, setPendingScore] = useState<PendingScore | null>(null);
  const [scoringId, setScoringId] = useState<string | null>(null);
  const [scoredTeam, setScoredTeam] = useState<"a" | "b" | null>(null);
  const [showEndConfirm, setShowEndConfirm] = useState(false);

  const autoEndCalledRef = useRef(false);

  // ─── Mutations ──────────────────────────────────────────────────────────────

  const scoreMutation = useScoreMutation(code, currentGameId ?? "");
  const undoMutation = useUndoScoreMutation(code, currentGameId ?? "");
  const clockMutation = useClockMutation(code, currentGameId ?? "");
  const endGameMutation = useEndGameMutation(code, currentGameId ?? "");

  const submitting = scoreMutation.isPending || undoMutation.isPending;
  // When adding a new mutation that should block the score/undo buttons, extend this
  // derivation. Buttons below gate on `submitting`; a missed entry enables them mid-flight.

  // ─── Realtime ──────────────────────────────────────────────────────────────

  useGameRealtime(code, currentGameId);

  // Reset auto-end flag when a new game starts
  useEffect(() => {
    autoEndCalledRef.current = false;
  }, [details?.game.id]);

  // ─── Score log reconstruction ──────────────────────────────────────────────

  const logEntries = useMemo(() => {
    if (!details) return [];
    let a = details.game.scoreA;
    let b = details.game.scoreB;
    return details.recentEvents.slice(0, 3).map((event) => {
      const entry = { ...event, displayA: a, displayB: b };
      if (event.team === "team_a") a -= event.points;
      else b -= event.points;
      return entry;
    });
  }, [details]);

  // ─── Handlers ──────────────────────────────────────────────────────────────

  function handleScoreButton(pts: number) {
    if (submitting || !details || details.game.status === "completed") return;
    if (pendingScore?.points === pts) {
      setPendingScore(null);
    } else {
      setPendingScore({ points: pts });
    }
  }

  async function scorePlayer(queueEntryId: string, team: "team_a" | "team_b") {
    if (submitting || !pendingScore || !details || details.game.status === "completed") return;

    const points = pendingScore.points;
    setPendingScore(null);
    setScoringId(queueEntryId);
    setScoredTeam(team === "team_a" ? "a" : "b");

    scoreMutation.mutate({ queueEntryId, team, points });

    setTimeout(() => {
      setScoringId(null);
      setScoredTeam(null);
    }, 500);
  }

  async function undo() {
    if (submitting || !details || details.recentEvents.length === 0) return;
    if (details.game.status === "completed") return;

    setPendingScore(null);
    undoMutation.mutate();
  }

  async function toggleClock() {
    if (!details) return;
    const { game } = details;
    const action = !game.clockStartedAt ? "start" : game.clockPausedAt ? "resume" : "pause";
    clockMutation.mutate(action);
  }

  const handleEndGame = useCallback(() => {
    if (!details) return;
    setShowEndConfirm(false);
    setPendingScore(null);
    endGameMutation.mutate();
  }, [details, endGameMutation]);

  // ─── Derived ───────────────────────────────────────────────────────────────

  const isHost = !!userId && !!run && userId === run.hostId;

  // ─── Clock ticker — driven by the game's own time limit ──────────────────────
  // Use games.time_limit_seconds (snapshotted at game creation), the same value
  // the server-side cron expiry checks. Reading run.timeLimitSeconds here would
  // diverge if run settings ever became editable mid-run.

  useEffect(() => {
    if (!details || !run) return;
    const timeLimit = details.game.timeLimitSeconds ?? null;

    const initial = getClockDisplay(details.game, timeLimit);
    setClockDisplay(initial);

    // Auto-end if time was already 0 when the page/game loaded
    if (timeLimit !== null && initial === 0 && isHost && isClockRunning(details.game) && !autoEndCalledRef.current) {
      autoEndCalledRef.current = true;
      handleEndGame();
      return;
    }

    if (!isClockRunning(details.game)) return;

    const interval = setInterval(() => {
      const newDisplay = getClockDisplay(details.game, timeLimit);
      setClockDisplay(newDisplay);

      if (timeLimit !== null && newDisplay === 0 && isHost && !autoEndCalledRef.current) {
        autoEndCalledRef.current = true;
        handleEndGame();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [details, run, isHost, handleEndGame]);

  // Navigate to /results when the game completes. All three triggers (goal,
  // clock, manual) update game.status to 'completed'; replace so back from
  // /results doesn't loop here. Applies to all viewers on this page.
  useEffect(() => {
    if (!details) return;
    if (details.game.status !== "completed") return;
    router.replace(`/runs/${code}/results?gameId=${currentGameId ?? ""}`);
  }, [details?.game.status, code, currentGameId, router]);

  const game = details?.game ?? null;
  const teamA = details?.players.filter((p) => p.team === "team_a") ?? [];
  const teamB = details?.players.filter((p) => p.team === "team_b") ?? [];
  const scoreGoal = game?.scoreGoal ?? run?.scoreGoal ?? 21;
  const hasTimeLimit = (game?.timeLimitSeconds ?? null) !== null;
  const clockWarning = hasTimeLimit && clockDisplay <= 60 && clockDisplay > 0;
  const clockAction = !game?.clockStartedAt ? "Start" : game.clockPausedAt ? "Resume" : "Pause";

  const canScore = isHost && !!game && game.status !== "completed";

  // ─── Loading ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <SessionTopbar run={null} loading={true} />
        <div className="flex-1 flex items-center justify-center">
          <div className="font-display text-[13px] font-bold tracking-[0.1em] uppercase text-text-muted animate-pulse">
            Loading…
          </div>
        </div>
      </div>
    );
  }

  // ─── No game ───────────────────────────────────────────────────────────────

  if (!details) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <SessionTopbar run={run} loading={false} />
        <div className="flex-1 flex flex-col items-center justify-center gap-5 px-5">
          <span className="font-display text-[14px] font-bold tracking-[0.1em] uppercase text-text-muted text-center">
            No active game
          </span>
          {isHost && (
            <Link
              href={`/runs/${code}/team-assignment`}
              className="h-12 px-6 flex items-center justify-center bg-accent text-bg font-display font-black tracking-[0.1em] uppercase text-[14px] rounded-md"
            >
              Start a game
            </Link>
          )}
        </div>
      </div>
    );
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full overflow-hidden relative">
      {/* Topbar */}
      <SessionTopbar
        run={run}
        loading={false}
        badge={
          <span className="font-display text-[12px] font-bold tracking-[0.1em] uppercase text-accent bg-accent/15 border border-accent/30 px-2.5 py-1 rounded-[4px]">
            Game {game!.gameNumber}
          </span>
        }
        onEndGame={isHost && game!.status !== "completed" ? () => setShowEndConfirm(true) : undefined}
      />

      {/* Scrollable content */}
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">

        {/* Scoreboard */}
        <div className="px-5 mt-1">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center py-2 gap-2">
            {/* Team A */}
            <div className="flex flex-col items-center gap-0.5">
              <span className="font-display text-[11px] font-bold tracking-[0.14em] uppercase text-text-muted">
                Runs
              </span>
              <span
                className="font-display font-black leading-[0.88] tracking-[-0.02em] select-none"
                style={{
                  fontSize: "clamp(80px, 20vw, 140px)",
                  transition: "transform 0.08s cubic-bezier(0.34, 1.56, 0.64, 1), color 0.15s",
                  color: scoredTeam === "a" ? "var(--accent)" : "var(--text-primary)",
                  transform: scoredTeam === "a" ? "scale(1.06)" : "scale(1)",
                }}
              >
                {game!.scoreA}
              </span>
              <span className="font-display text-[12px] font-semibold tracking-[0.08em] uppercase text-text-muted">
                to {scoreGoal}
              </span>
            </div>

            {/* Separator */}
            <div className="flex flex-col items-center gap-1.5 pt-3">
              <span className="font-display text-[32px] font-black text-text-muted leading-none tracking-[-0.04em]">
                —
              </span>
            </div>

            {/* Team B */}
            <div className="flex flex-col items-center gap-0.5">
              <span className="font-display text-[11px] font-bold tracking-[0.14em] uppercase text-text-muted">
                Next
              </span>
              <span
                className="font-display font-black leading-[0.88] tracking-[-0.02em] select-none"
                style={{
                  fontSize: "clamp(80px, 20vw, 140px)",
                  transition: "transform 0.08s cubic-bezier(0.34, 1.56, 0.64, 1), color 0.15s",
                  color: scoredTeam === "b" ? "var(--accent)" : "var(--text-primary)",
                  transform: scoredTeam === "b" ? "scale(1.06)" : "scale(1)",
                }}
              >
                {game!.scoreB}
              </span>
              <span className="font-display text-[12px] font-semibold tracking-[0.08em] uppercase text-text-muted">
                to {scoreGoal}
              </span>
            </div>
          </div>
        </div>

        {/* Clock */}
        {hasTimeLimit && (
          <div className="mx-5 mb-1 bg-bg-surface border border-border rounded-md px-4 py-2.5 flex items-center justify-between">
            <span
              className="font-display text-[40px] font-black tracking-[0.04em] leading-none"
              style={{
                color: clockWarning ? "var(--warning)" : "var(--accent)",
                ...(clockWarning ? { animation: "pulse-warn 0.8s ease-in-out infinite" } : {}),
              }}
            >
              {formatTime(clockDisplay)}
            </span>
            {isHost && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={toggleClock}
                  disabled={game!.status === "completed"}
                  className={[
                    "h-[38px] px-4 rounded-sm border font-display text-[13px] font-bold tracking-[0.08em] uppercase transition-all",
                    game!.clockStartedAt && !game!.clockPausedAt
                      ? "bg-accent/15 border-accent/30 text-accent"
                      : "bg-bg-hover border-border text-text-primary hover:border-accent-dim hover:text-accent",
                    game!.status === "completed" ? "opacity-40 cursor-not-allowed" : "",
                  ].join(" ")}
                >
                  {clockAction}
                </button>
              </div>
            )}
          </div>
        )}


        {/* Section header */}
        <div className="flex items-center justify-between px-5 pb-2.5">
          <span className="font-display text-[12px] font-bold tracking-[0.14em] uppercase text-text-muted">
            {pendingScore ? "Who scored?" : "Players"}
          </span>
        </div>

        {/* Teams grid */}
        <div className="px-5 pb-4 grid grid-cols-2 gap-2.5">
          {/* Team A */}
          <div className="flex flex-col gap-1.5">
            <div className="font-display text-[11px] font-black tracking-[0.14em] uppercase text-accent-dim border-b border-accent/30 pb-1 mb-0.5">
              Runs
            </div>
            {teamA.map((player) => (
              <PlayerCard
                key={player.queueEntryId}
                player={player}
                scoring={scoringId === player.queueEntryId}
                awaitingScorer={canScore && !!pendingScore}
                locked={!canScore}
                onScore={() => scorePlayer(player.queueEntryId, "team_a")}
              />
            ))}
          </div>

          {/* Team B */}
          <div className="flex flex-col gap-1.5">
            <div className="font-display text-[11px] font-black tracking-[0.14em] uppercase text-text-muted border-b border-border pb-1 mb-0.5">
              Next
            </div>
            {teamB.map((player) => (
              <PlayerCard
                key={player.queueEntryId}
                player={player}
                scoring={scoringId === player.queueEntryId}
                awaitingScorer={canScore && !!pendingScore}
                locked={!canScore}
                onScore={() => scorePlayer(player.queueEntryId, "team_b")}
              />
            ))}
          </div>
        </div>

        {/* Score log */}
        {logEntries.length > 0 && (
          <>
            <div className="flex items-center justify-between px-5 pb-2.5">
              <span className="font-display text-[12px] font-bold tracking-[0.14em] uppercase text-text-muted">
                Recent
              </span>
            </div>
            <div className="mx-5 mb-3 flex flex-col gap-1">
              {logEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center gap-2 px-2.5 py-1.5 bg-bg-surface rounded-md border border-border animate-slide-in"
                >
                  <span
                    className={`font-display text-[13px] font-black tracking-[0.06em] flex-shrink-0 ${
                      entry.team === "team_a" ? "text-accent" : "text-text-secondary"
                    }`}
                  >
                    +{entry.points}
                  </span>
                  <span className="font-display text-[13px] font-semibold tracking-[0.04em] text-text-secondary flex-1">
                    <span className="capitalize">{entry.displayName}</span>{" scored"}
                  </span>
                  <span className="font-display text-[13px] font-extrabold tracking-[0.06em] text-text-muted">
                    {entry.displayA} – {entry.displayB}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Bottom bar */}
      {isHost && game!.status !== "completed" && (
        <div className="bottom-bar">
          <button
            type="button"
            onClick={undo}
            disabled={submitting || details.recentEvents.length === 0}
            className="w-[52px] h-[52px] flex items-center justify-center rounded-md border border-border bg-bg-surface text-text-secondary transition-all hover:border-text-muted hover:text-text-primary disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          {scoreValuesFor(run!.pointSystem).map((pts) => {
            const isActive = pendingScore?.points === pts;
            const isOtherActive = !!pendingScore && pendingScore.points !== pts;
            return (
              <button
                key={pts}
                type="button"
                onClick={() => handleScoreButton(pts)}
                disabled={submitting}
                className={[
                  "flex-1 h-[52px] rounded-md border font-display text-[18px] font-black tracking-[0.06em] transition-all",
                  isActive
                    ? "bg-accent text-bg border-accent"
                    : isOtherActive || submitting
                    ? "bg-bg-surface border-border text-text-muted opacity-40 cursor-not-allowed"
                    : "bg-bg-surface border-accent/20 text-text-primary hover:border-accent/50 hover:text-accent active:scale-[0.97]",
                ].join(" ")}
              >
                +{pts}
              </button>
            );
          })}
        </div>
      )}

      {/* End confirm modal */}
      {showEndConfirm && (
        <>
          <div
            className="fixed inset-0 z-[110] bg-black/70 backdrop-blur-sm"
            onClick={() => setShowEndConfirm(false)}
          />
          <div className="fixed inset-0 z-[111] flex items-center justify-center px-5">
            <div className="w-full max-w-[320px] bg-bg-raised border border-border rounded-xl p-6 flex flex-col gap-5 animate-slide-up">
              <div className="flex flex-col gap-1.5">
                <span className="font-display text-[16px] font-black tracking-[0.06em] uppercase text-text-primary">
                  End this game?
                </span>
                <span className="font-body text-[13px] text-text-secondary leading-[1.5]">
                  This can&apos;t be undone. Current score:{" "}
                  <strong className="text-text-primary">
                    {game!.scoreA} – {game!.scoreB}
                  </strong>
                </span>
              </div>
              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowEndConfirm(false)}
                  className="flex-1 h-11 rounded-md border border-border bg-bg-surface text-text-secondary font-display text-[13px] font-bold tracking-[0.08em] uppercase transition-colors hover:border-text-muted hover:text-text-primary"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleEndGame}
                  className="flex-1 h-11 rounded-md border border-danger bg-danger/[0.08] text-[#ff6060] font-display text-[13px] font-black tracking-[0.1em] uppercase transition-all hover:bg-danger/[0.16]"
                >
                  End Game
                </button>
              </div>
            </div>
          </div>
        </>
      )}

    </div>
  );
}

// ─── Player Card ──────────────────────────────────────────────────────────────

function PlayerCard({
  player,
  scoring,
  awaitingScorer,
  locked,
  onScore,
}: {
  player: PlayerData;
  scoring: boolean;
  awaitingScorer: boolean;
  locked: boolean;
  onScore: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onScore}
      disabled={locked}
      className={[
        "w-full bg-bg-surface border rounded-md px-3 py-2.5 flex items-center justify-between",
        "transition-all duration-[120ms] relative overflow-hidden",
        "-webkit-tap-highlight-color-transparent select-none",
        locked ? "opacity-40 cursor-default" : "active:scale-[0.97]",
        scoring
          ? "animate-score-flash border-accent"
          : awaitingScorer
          ? "border-accent/60 bg-accent/[0.06] hover:bg-accent/[0.1] hover:border-accent"
          : "border-border",
      ].join(" ")}
      style={{ WebkitTapHighlightColor: "transparent" }}
    >
      <div className="flex flex-col gap-px text-left">
        <span className="font-display text-[15px] font-black tracking-[0.03em] uppercase text-text-primary leading-none">
          {player.displayName}
        </span>
        <span className="font-display text-[10px] font-semibold tracking-[0.12em] uppercase text-text-muted">
          pts
        </span>
      </div>
      <span
        className="font-display text-[22px] font-black tracking-[-0.01em] leading-none transition-colors duration-150"
        style={{ color: scoring || awaitingScorer ? "var(--accent)" : "var(--text-secondary)" }}
      >
        {player.points}
      </span>
    </button>
  );
}
