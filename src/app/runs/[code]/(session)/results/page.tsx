"use client";

import { Suspense, useMemo, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { Home } from "lucide-react";
import { SessionTopbar } from "@/components/ui/session-topbar";
import { useCloseRunMutation, useRun } from "@/hooks/use-run";
import { useGameDetails, useEndGameMutation, type PlayerData } from "@/hooks/use-game";
import { useQueue } from "@/hooks/use-queue";
import { useSessionUser } from "@/hooks/use-session";
import { formatTime, winnerLabel } from "@/lib/utils";

function gameDuration(startedAt: string | null, endedAt: string | null): string {
  if (!startedAt || !endedAt) return "—";
  const ms = new Date(endedAt).getTime() - new Date(startedAt).getTime();
  return formatTime(Math.round(ms / 1000));
}

export default function ResultsPage() {
  return (
    <Suspense fallback={<SessionTopbar run={null} loading={true} />}>
      <ResultsContent />
    </Suspense>
  );
}

function ResultsContent() {
  const { code } = useParams<{ code: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const gameId = searchParams.get("gameId");

  const runQuery = useRun(code);
  const sessionQuery = useSessionUser();
  const detailsQuery = useGameDetails(code, gameId);
  const queueQuery = useQueue(code);

  const run = runQuery.data ?? null;
  const userId = sessionQuery.data ?? null;
  const details = detailsQuery.data ?? null;
  const queue = queueQuery.data ?? null;

  const loading =
    runQuery.isPending ||
    sessionQuery.isPending ||
    (!!gameId && detailsQuery.isPending) ||
    queueQuery.isPending;

  const endGameMutation = useEndGameMutation(code, gameId ?? "");
  const closeRunMutation = useCloseRunMutation(code);
  const [endingRun, setEndingRun] = useState(false);

  const game = details?.game ?? null;
  const teamA = useMemo(
    () => (details?.players ?? []).filter((p) => p.team === "team_a") as PlayerData[],
    [details],
  );
  const teamB = useMemo(
    () => (details?.players ?? []).filter((p) => p.team === "team_b") as PlayerData[],
    [details],
  );

  const isTeamAWinner = game?.winner === "team_a";
  const isTeamBWinner = game?.winner === "team_b";
  const totalBuckets = (game?.scoreA ?? 0) + (game?.scoreB ?? 0);
  const duration = game ? gameDuration(game.startedAt, game.endedAt) : "—";

  const upNext = useMemo(
    () => (queue?.waiting ?? []).filter((e) => e.status === "waiting"),
    [queue],
  );
  const topScorer = useMemo(
    () => [...teamA, ...teamB].sort((a, b) => b.points - a.points)[0] ?? null,
    [teamA, teamB],
  );
  const previewEntries = upNext.slice(0, 5);
  const overflowCount = Math.max(0, upNext.length - 5);

  const isHost = !!userId && !!run && userId === run.hostId;

  async function handleNextGame() {
    if (!gameId || !game || game.status !== "completed") {
      router.push(`/runs/${code}/team-assignment`);
      return;
    }
    await endGameMutation.mutateAsync();
    router.push(`/runs/${code}/team-assignment`);
  }

  async function handleEndRun() {
    setEndingRun(true);
    try {
      await closeRunMutation.mutateAsync();
      router.push("/history");
    } catch {
      setEndingRun(false);
    }
  }

  if (loading) {
    return (
      <>
        <SessionTopbar run={null} loading={true} />
        <div className="flex-1 flex items-center justify-center">
          <div className="font-display text-[13px] font-bold tracking-[0.1em] uppercase text-text-muted animate-pulse">
            Loading…
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <SessionTopbar
        run={run}
        loading={false}
        badge={game ? (
          <span className="font-display text-[12px] font-bold tracking-[0.1em] uppercase text-text-secondary bg-bg-surface border border-border px-2.5 py-1 rounded-[4px]">
            Game {game.gameNumber}
          </span>
        ) : undefined}
      />

      <div className="flex-1 overflow-y-auto custom-scrollbar pb-4">

        <div className="relative flex flex-col items-center gap-1 pt-6 pb-5 flex-shrink-0">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[260px] h-[140px] bg-accent-glow rounded-full blur-[48px] pointer-events-none" />
          <span className="relative font-display text-[11px] font-bold tracking-[0.16em] uppercase text-accent-dim">
            Winner
          </span>
          <span className="relative font-display text-[38px] font-black tracking-[0.02em] uppercase text-text-primary leading-none">
            {winnerLabel(game?.winner ?? null)}
          </span>
        </div>

        <div className="mx-5 bg-bg-surface border border-border rounded-lg px-5 py-4 relative overflow-hidden">
          <div className={`absolute top-0 bottom-0 w-[3px] bg-accent ${isTeamBWinner ? "right-0 rounded-r-sm" : "left-0 rounded-l-sm"}`} />
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            <div className="flex flex-col items-center gap-0.5">
              <span className={`font-display text-[11px] font-bold tracking-[0.14em] uppercase ${isTeamAWinner ? "text-accent-dim" : "text-text-muted"}`}>
                Runs
              </span>
              <span
                className={`font-display font-black leading-[0.9] tracking-[-0.02em] ${isTeamAWinner ? "text-text-primary" : "text-text-secondary"}`}
                style={{ fontSize: "clamp(56px, 14vw, 80px)" }}
              >
                {game?.scoreA ?? 0}
              </span>
            </div>
            <span className="font-display text-[24px] font-black text-text-muted tracking-[-0.04em] pb-2">—</span>
            <div className="flex flex-col items-center gap-0.5">
              <span className={`font-display text-[11px] font-bold tracking-[0.14em] uppercase ${isTeamBWinner ? "text-accent-dim" : "text-text-muted"}`}>
                Next
              </span>
              <span
                className={`font-display font-black leading-[0.9] tracking-[-0.02em] ${isTeamBWinner ? "text-text-primary" : "text-text-secondary"}`}
                style={{ fontSize: "clamp(56px, 14vw, 80px)" }}
              >
                {game?.scoreB ?? 0}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center gap-4 mt-2.5 mx-5">
          <div className="flex flex-col items-center gap-px">
            <span className="font-display text-[10px] font-bold tracking-[0.14em] uppercase text-text-muted">Duration</span>
            <span className="font-display text-[18px] font-black tracking-[0.02em] text-text-secondary leading-none">{duration}</span>
          </div>
          <div className="w-px h-6 bg-border flex-shrink-0" />
          <div className="flex flex-col items-center gap-px">
            <span className="font-display text-[10px] font-bold tracking-[0.14em] uppercase text-text-muted">Buckets</span>
            <span className="font-display text-[18px] font-black tracking-[0.02em] text-text-secondary leading-none">{totalBuckets}</span>
          </div>
          <div className="w-px h-6 bg-border flex-shrink-0" />
          <div className="flex flex-col items-center gap-px">
            <span className="font-display text-[10px] font-bold tracking-[0.14em] uppercase text-text-muted">Top Scorer</span>
            <span className="font-display text-[18px] font-black tracking-[0.02em] text-text-secondary leading-none truncate max-w-[90px]">
              {topScorer?.displayName ?? "—"}
            </span>
          </div>
        </div>

        <div className="flex items-center px-5 pt-5 pb-2.5">
          <span className="font-display text-[12px] font-bold tracking-[0.14em] uppercase text-text-muted">Breakdown</span>
        </div>

        <div className="px-5 grid grid-cols-2 gap-2.5">

          <div className="flex flex-col gap-[5px]">
            <div className={`flex items-center justify-between pb-1.5 mb-0.5 border-b font-display text-[11px] font-extrabold tracking-[0.14em] uppercase ${isTeamAWinner ? "text-accent-dim border-border-accent" : "text-text-muted border-border"}`}>
              Runs
              <span className={`text-[13px] font-black ${isTeamAWinner ? "text-accent" : "text-text-muted"}`}>
                {game?.scoreA ?? 0}
              </span>
            </div>
            {teamA.map((player, i) => (
              <div
                key={player.queueEntryId}
                className={`bg-bg-surface border rounded-md px-2.5 py-2 flex items-center justify-between gap-1.5 ${i === 0 ? "border-border-accent" : "border-border"}`}
              >
                <span className="font-display text-[13px] font-extrabold tracking-[0.03em] uppercase text-text-primary leading-none flex-1 truncate min-w-0">
                  {player.displayName}
                </span>
                <span className={`font-display font-black tracking-[-0.01em] leading-none flex-shrink-0 ${i === 0 ? "text-[20px] text-accent" : player.points === 0 ? "text-[16px] text-text-muted" : "text-[20px] text-text-muted"}`}>
                  {player.points}
                </span>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-[5px]">
            <div className={`flex items-center justify-between pb-1.5 mb-0.5 border-b font-display text-[11px] font-extrabold tracking-[0.14em] uppercase ${isTeamBWinner ? "text-accent-dim border-border-accent" : "text-text-muted border-border"}`}>
              Next
              <span className={`text-[13px] font-black ${isTeamBWinner ? "text-accent" : "text-text-muted"}`}>
                {game?.scoreB ?? 0}
              </span>
            </div>
            {teamB.map((player, i) => (
              <div
                key={player.queueEntryId}
                className={`bg-bg-surface border rounded-md px-2.5 py-2 flex items-center justify-between gap-1.5 ${i === 0 ? "border-border-accent" : "border-border"}`}
              >
                <span className="font-display text-[13px] font-extrabold tracking-[0.03em] uppercase text-text-primary leading-none flex-1 truncate min-w-0">
                  {player.displayName}
                </span>
                <span className={`font-display font-black tracking-[-0.01em] leading-none flex-shrink-0 ${i === 0 ? "text-[20px] text-accent" : player.points === 0 ? "text-[16px] text-text-muted" : "text-[20px] text-text-muted"}`}>
                  {player.points}
                </span>
              </div>
            ))}
          </div>

        </div>

        {isHost && game && game.status === "completed" && (
          <div className="px-5 mt-5">
            <button
              type="button"
              onClick={handleNextGame}
              disabled={endGameMutation.isPending}
              className="w-full h-[56px] rounded-lg bg-accent text-bg font-display text-[18px] font-extrabold tracking-[0.1em] uppercase flex items-center justify-center transition-opacity hover:opacity-90 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {endGameMutation.isPending ? "Ending..." : "Next Game"}
            </button>
          </div>
        )}

        {upNext.length > 0 && (
          <div className="mx-5 mt-4 bg-bg-surface border border-border rounded-md px-3.5 py-2.5 flex items-center gap-2.5">
            <span className="font-display text-[10px] font-bold tracking-[0.14em] uppercase text-text-muted flex-shrink-0">
              Up next
            </span>
            <span className="font-display text-[13px] font-bold tracking-[0.04em] uppercase text-text-secondary whitespace-nowrap overflow-hidden text-ellipsis flex-1 min-w-0">
              {previewEntries.map((e) => e.displayName).join(", ")}{overflowCount > 0 ? "..." : ""}
            </span>
            {overflowCount > 0 && (
              <span className="font-display text-[11px] font-bold tracking-[0.08em] uppercase text-text-muted flex-shrink-0">
                +{overflowCount}
              </span>
            )}
          </div>
        )}

        <div className="h-6" />
      </div>

      {isHost && (
        <div className="bottom-bar">
          <button
            type="button"
            onClick={() => router.push(`/runs/${code}/feed`)}
            className="h-[52px] px-[18px] flex-shrink-0 rounded-md border border-border bg-bg-surface text-text-secondary font-display text-[13px] font-bold tracking-[0.08em] uppercase flex items-center justify-center gap-1.5 transition-all hover:border-text-muted hover:text-text-primary"
          >
            <Home className="w-3.5 h-3.5" />
            Lobby
          </button>
          <button
            type="button"
            onClick={handleEndRun}
            disabled={endingRun}
            className="flex-1 h-[52px] rounded-md bg-danger text-bg font-display text-[16px] font-extrabold tracking-[0.1em] uppercase flex items-center justify-center transition-opacity hover:opacity-90 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {endingRun ? "Ending..." : "End Run"}
          </button>
        </div>
      )}
    </>
  );
}
