"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { SessionTopbar } from "@/components/ui/session-topbar";
import { createClient } from "@/lib/supabase/client";
import { formatTime } from "@/lib/utils";

function scoreValuesFor(pointSystem: "one_two" | "two_three"): readonly number[] {
  return pointSystem === "one_two" ? [1, 2] : [2, 3];
}

// ─── Types ────────────────────────────────────────────────────────────────────

type RunData = {
  id: string;
  hostId: string;
  name: string;
  location: string | null;
  sessionCode: string;
  scoreGoal: number;
  pointSystem: "one_two" | "two_three";
  timeLimitSeconds: number | null;
};

type GameData = {
  id: string;
  gameNumber: number;
  status: "pending" | "active" | "completed";
  scoreGoal: number;
  timeLimitSeconds: number | null;
  scoreA: number;
  scoreB: number;
  winner: "team_a" | "team_b" | "tie" | null;
  clockStartedAt: string | null;
  clockPausedAt: string | null;
  totalPausedSeconds: number;
  startedAt: string | null;
  endedAt: string | null;
};

type PlayerData = {
  queueEntryId: string;
  displayName: string;
  team: "team_a" | "team_b";
  points: number;
};

type EventData = {
  id: string;
  queueEntryId: string;
  displayName: string;
  team: "team_a" | "team_b";
  points: number;
  createdAt: string;
};

type GameDetails = {
  game: GameData;
  players: PlayerData[];
  recentEvents: EventData[];
};

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

  const [run, setRun] = useState<RunData | null>(null);
  const [details, setDetails] = useState<GameDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [clockDisplay, setClockDisplay] = useState(0);
  const [pendingScore, setPendingScore] = useState<PendingScore | null>(null);
  const [scoringId, setScoringId] = useState<string | null>(null);
  const [scoredTeam, setScoredTeam] = useState<"a" | "b" | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);

  const supabaseRef = useRef(createClient());
  const gameIdRef = useRef<string | null>(null);
  const autoEndCalledRef = useRef(false);

  // ─── Load ──────────────────────────────────────────────────────────────────

  const loadGame = useCallback(
    async (gameId: string) => {
      const res = await fetch(`/api/runs/${code}/games/${gameId}`);
      if (res.ok) {
        const data: GameDetails = await res.json();
        setDetails(data);
      }
    },
    [code],
  );

  const load = useCallback(async () => {
    const [{ data: { session } }, runRes, gamesRes] = await Promise.all([
      supabaseRef.current.auth.getSession(),
      fetch(`/api/runs/${code}`),
      fetch(`/api/runs/${code}/games`),
    ]);

    setUserId(session?.user?.id ?? null);

    if (runRes.ok) setRun(await runRes.json());

    if (gamesRes.ok) {
      const games: GameData[] = await gamesRes.json();
      const current =
        games.find((g) => g.status === "active") ??
        games.find((g) => g.status === "pending") ??
        games[0] ??
        null;

      if (current) {
        gameIdRef.current = current.id;
        await loadGame(current.id);
      }
    }

    setLoading(false);
  }, [code, loadGame]);

  useEffect(() => {
    load();
  }, [load]);

  // ─── Realtime ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!gameIdRef.current) return;
    const gameId = gameIdRef.current;
    const supabase = supabaseRef.current;
    const channel = supabase
      .channel(`game-${gameId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "games", filter: `id=eq.${gameId}` },
        () => loadGame(gameId),
      )
      .subscribe((status) => {
        if (status !== "SUBSCRIBED" && status !== "CLOSED") {
          console.error(`Realtime channel game-${gameId} failed:`, status);
        }
      });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [details?.game.id, loadGame]); // re-subscribe if game changes

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

    setSubmitting(true);
    setScoringId(queueEntryId);
    setScoredTeam(team === "team_a" ? "a" : "b");

    // Optimistic update
    setDetails((prev) => {
      if (!prev) return prev;
      const newScoreA = prev.game.scoreA + (team === "team_a" ? points : 0);
      const newScoreB = prev.game.scoreB + (team === "team_b" ? points : 0);
      const scorer = prev.players.find((p) => p.queueEntryId === queueEntryId);
      const optimisticEvent: EventData = {
        id: `optimistic-${Date.now()}`,
        queueEntryId,
        displayName: scorer?.displayName ?? "",
        team,
        points,
        createdAt: new Date().toISOString(),
      };
      return {
        ...prev,
        game: {
          ...prev.game,
          scoreA: newScoreA,
          scoreB: newScoreB,
          status: prev.game.status === "pending" ? "active" : prev.game.status,
        },
        players: prev.players.map((p) =>
          p.queueEntryId === queueEntryId ? { ...p, points: p.points + points } : p,
        ),
        recentEvents: [optimisticEvent, ...prev.recentEvents].slice(0, 10),
      };
    });

    setTimeout(() => {
      setScoringId(null);
      setScoredTeam(null);
    }, 500);

    try {
      const res = await fetch(`/api/runs/${code}/games/${details.game.id}/score`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ queueEntryId, team, points }),
      });
      if (!res.ok) await loadGame(details.game.id);
    } catch {
      await loadGame(details.game.id);
    } finally {
      setSubmitting(false);
    }
  }

  async function undo() {
    if (submitting || !details || details.recentEvents.length === 0) return;
    if (details.game.status === "completed") return;

    const last = details.recentEvents[0];
    setPendingScore(null);
    setSubmitting(true);

    // Optimistic update
    setDetails((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        game: {
          ...prev.game,
          scoreA: Math.max(0, prev.game.scoreA - (last.team === "team_a" ? last.points : 0)),
          scoreB: Math.max(0, prev.game.scoreB - (last.team === "team_b" ? last.points : 0)),
        },
        players: prev.players.map((p) =>
          p.queueEntryId === last.queueEntryId
            ? { ...p, points: Math.max(0, p.points - last.points) }
            : p,
        ),
        recentEvents: prev.recentEvents.slice(1),
      };
    });

    try {
      const res = await fetch(`/api/runs/${code}/games/${details.game.id}/score`, {
        method: "PATCH",
      });
      if (!res.ok) await loadGame(details.game.id);
    } catch {
      await loadGame(details.game.id);
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleClock() {
    if (!details) return;
    const { game } = details;
    const action = !game.clockStartedAt ? "start" : game.clockPausedAt ? "resume" : "pause";

    try {
      const res = await fetch(`/api/runs/${code}/games/${game.id}/clock`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        const updated = await res.json();
        setDetails((prev) => (prev ? { ...prev, game: updated } : prev));
      }
    } catch {
      // silent — Realtime will sync
    }
  }

  const handleEndGame = useCallback(async () => {
    if (!details) return;
    setShowEndConfirm(false);
    setPendingScore(null);

    try {
      const res = await fetch(`/api/runs/${code}/games/${details.game.id}`, {
        method: "PATCH",
      });
      if (res.ok) {
        const updated = await res.json();
        setDetails((prev) => (prev ? { ...prev, game: updated } : prev));
      }
    } catch {
      // Realtime will sync
    }
  }, [code, details]);

  // ─── Derived ───────────────────────────────────────────────────────────────

  const isHost = !!userId && !!run && userId === run.hostId;

  // ─── Clock ticker — driven by run's timeLimitSeconds, not the game snapshot ──

  useEffect(() => {
    if (!details || !run) return;
    const timeLimit = run.timeLimitSeconds ?? null;

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
  const game = details?.game ?? null;
  const teamA = details?.players.filter((p) => p.team === "team_a") ?? [];
  const teamB = details?.players.filter((p) => p.team === "team_b") ?? [];
  const scoreGoal = game?.scoreGoal ?? run?.scoreGoal ?? 21;
  const hasTimeLimit = (run?.timeLimitSeconds ?? null) !== null;
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

      {/* Game over overlay */}
      {game!.status === "completed" && (
        <div className="absolute inset-0 z-50 bg-bg/85 backdrop-blur-sm flex items-center justify-center px-5">
          <div className="w-full max-w-[320px] bg-bg-raised border border-border rounded-xl p-6 flex flex-col items-center gap-5 animate-slide-up">
            <span className="font-display text-[11px] font-bold tracking-[0.2em] uppercase text-text-muted">
              Final Score
            </span>

            <div className="flex items-center gap-4">
              <div className="flex flex-col items-center gap-1">
                <span className="font-display text-[11px] font-bold tracking-[0.12em] uppercase text-text-muted">
                  Runs
                </span>
                <span
                  className="font-display font-black leading-none"
                  style={{
                    fontSize: "72px",
                    color: game!.winner === "team_a"
                      ? "var(--accent)"
                      : game!.winner === "tie"
                      ? "var(--warning)"
                      : "var(--text-primary)",
                  }}
                >
                  {game!.scoreA}
                </span>
              </div>
              <span className="font-display text-[36px] font-black text-text-muted leading-none">
                –
              </span>
              <div className="flex flex-col items-center gap-1">
                <span className="font-display text-[11px] font-bold tracking-[0.12em] uppercase text-text-muted">
                  Next
                </span>
                <span
                  className="font-display font-black leading-none"
                  style={{
                    fontSize: "72px",
                    color: game!.winner === "team_b"
                      ? "var(--accent)"
                      : game!.winner === "tie"
                      ? "var(--warning)"
                      : "var(--text-primary)",
                  }}
                >
                  {game!.scoreB}
                </span>
              </div>
            </div>

            <span
              className="font-display text-[14px] font-black tracking-[0.08em] uppercase"
              style={{
                color: game!.winner === "tie" ? "var(--warning)" : "var(--accent)",
              }}
            >
              {game!.winner === "team_a"
                ? "Runs Win"
                : game!.winner === "team_b"
                ? "Next Wins"
                : "Tie Game"}
            </span>

            <div className="flex gap-2.5 w-full">
              <Link
                href={`/runs/${code}/feed`}
                className="flex-1 h-11 flex items-center justify-center rounded-md border border-border bg-bg-surface text-text-secondary font-display text-[13px] font-bold tracking-[0.08em] uppercase transition-colors hover:border-text-muted hover:text-text-primary"
              >
                Feed
              </Link>
              {isHost && (
                <Link
                  href={`/runs/${code}/team-assignment`}
                  className="flex-1 h-11 flex items-center justify-center rounded-md bg-accent text-bg font-display text-[13px] font-black tracking-[0.08em] uppercase transition-opacity hover:opacity-90"
                >
                  Next Game
                </Link>
              )}
            </div>
          </div>
        </div>
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
