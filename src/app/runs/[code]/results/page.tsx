"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { Home } from "lucide-react";
import { formatTime } from "@/lib/utils";

type PlayerResult = { displayName: string; points: number };

type GameBreakdown = {
  id: string;
  gameNumber: number;
  scoreA: number;
  scoreB: number;
  winner: "team_a" | "team_b" | null;
  startedAt: string | null;
  endedAt: string | null;
  teamA: PlayerResult[];
  teamB: PlayerResult[];
};

type RunData = { name: string; location: string | null };
type UpNextEntry = { id: string; displayName: string; status: string; sittingOut: boolean };

function gameDuration(startedAt: string | null, endedAt: string | null): string {
  if (!startedAt || !endedAt) return "—";
  const ms = new Date(endedAt).getTime() - new Date(startedAt).getTime();
  return formatTime(Math.round(ms / 1000));
}

export default function ResultsPage() {
  return (
    <Suspense>
      <ResultsContent />
    </Suspense>
  );
}

function ResultsContent() {
  const { code } = useParams<{ code: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const gameId = searchParams.get("gameId");

  const [run, setRun] = useState<RunData | null>(null);
  const [game, setGame] = useState<GameBreakdown | null>(null);
  const [upNext, setUpNext] = useState<UpNextEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [ending, setEnding] = useState(false);

  useEffect(() => {
    if (!gameId) { setLoading(false); return; }
    async function load() {
      const [runRes, gameRes, queueRes] = await Promise.all([
        fetch(`/api/runs/${code}`),
        fetch(`/api/runs/${code}/games/${gameId}`),
        fetch(`/api/runs/${code}/queue`),
      ]);
      if (runRes.ok) setRun(await runRes.json());
      if (gameRes.ok) setGame(await gameRes.json());
      if (queueRes.ok) {
        const q = await queueRes.json();
        const candidates = (q.waiting ?? []).filter(
          (e: UpNextEntry) => e.status === "waiting" && !e.sittingOut,
        );
        setUpNext(candidates);
      }
      setLoading(false);
    }
    load();
  }, [code, gameId]);

  async function handleEndRun() {
    setEnding(true);
    await fetch(`/api/runs/${code}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "completed" }),
    });
    router.push("/history");
  }

  const isTeamAWinner = game?.winner === "team_a";
  const isTeamBWinner = game?.winner === "team_b";
  const winnerName = isTeamAWinner ? "Runs" : isTeamBWinner ? "Next" : "—";
  const topScorer = [...(game?.teamA ?? []), ...(game?.teamB ?? [])].sort(
    (a, b) => b.points - a.points,
  )[0];
  const totalBuckets = (game?.scoreA ?? 0) + (game?.scoreB ?? 0);
  const duration = game ? gameDuration(game.startedAt, game.endedAt) : "—";
  const previewEntries = upNext.slice(0, 5);
  const overflowCount = Math.max(0, upNext.length - 5);

  return (
    <div className="app-shell">

      {/* TOPBAR */}
      <div className="topbar">
        <div className="flex flex-col gap-0.5">
          {loading ? (
            <>
              <div className="h-[11px] w-20 bg-bg-hover rounded-sm animate-pulse" />
              <div className="h-5 w-36 bg-bg-hover rounded-sm mt-0.5 animate-pulse" />
            </>
          ) : (
            <>
              <span className="font-display text-[11px] font-bold tracking-[0.12em] uppercase text-text-muted">
                {run?.location ?? "Basketball Run"}
              </span>
              <span className="font-display text-[20px] font-black tracking-[0.02em] uppercase text-text-primary leading-none">
                {run?.name ?? "—"}
              </span>
            </>
          )}
        </div>
        {game && (
          <span className="font-display text-[12px] font-bold tracking-[0.1em] uppercase text-text-secondary bg-bg-surface border border-border px-2.5 py-1 rounded-[4px]">
            Game {game.gameNumber}
          </span>
        )}
      </div>

      {/* WINNER HERO */}
      <div className="relative flex flex-col items-center gap-1 pt-6 pb-5 flex-shrink-0">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[260px] h-[140px] bg-accent-glow rounded-full blur-[48px] pointer-events-none" />
        {loading ? (
          <>
            <div className="relative h-[11px] w-16 bg-bg-hover rounded-sm animate-pulse" />
            <div className="relative h-10 w-48 bg-bg-hover rounded-sm mt-1 animate-pulse" />
          </>
        ) : (
          <>
            <span className="relative font-display text-[11px] font-bold tracking-[0.16em] uppercase text-accent-dim">
              Winner
            </span>
            <span className="relative font-display text-[38px] font-black tracking-[0.02em] uppercase text-text-primary leading-none">
              {winnerName}
            </span>
          </>
        )}
      </div>

      {/* SCROLLABLE CONTENT */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">

        {/* FINAL SCORE BLOCK */}
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

        {/* META ROW */}
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

        {/* BREAKDOWN HEADER */}
        <div className="flex items-center px-5 pt-5 pb-2.5">
          <span className="font-display text-[12px] font-bold tracking-[0.14em] uppercase text-text-muted">Breakdown</span>
        </div>

        {/* SCORELINES */}
        <div className="px-5 grid grid-cols-2 gap-2.5">

          {/* Team A — Runs */}
          <div className="flex flex-col gap-[5px]">
            <div className={`flex items-center justify-between pb-1.5 mb-0.5 border-b font-display text-[11px] font-extrabold tracking-[0.14em] uppercase ${isTeamAWinner ? "text-accent-dim border-border-accent" : "text-text-muted border-border"}`}>
              Runs
              <span className={`text-[13px] font-black ${isTeamAWinner ? "text-accent" : "text-text-muted"}`}>
                {game?.scoreA ?? 0}
              </span>
            </div>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-[38px] bg-bg-hover rounded-md animate-pulse" />
              ))
            ) : (
              game?.teamA.map((player, i) => (
                <div
                  key={i}
                  className={`bg-bg-surface border rounded-md px-2.5 py-2 flex items-center justify-between gap-1.5 ${i === 0 ? "border-border-accent" : "border-border"}`}
                >
                  <span className="font-display text-[13px] font-extrabold tracking-[0.03em] uppercase text-text-primary leading-none flex-1 truncate min-w-0">
                    {player.displayName}
                  </span>
                  <span className={`font-display font-black tracking-[-0.01em] leading-none flex-shrink-0 ${i === 0 ? "text-[20px] text-accent" : player.points === 0 ? "text-[16px] text-text-muted" : "text-[20px] text-text-muted"}`}>
                    {player.points}
                  </span>
                </div>
              ))
            )}
          </div>

          {/* Team B — Next */}
          <div className="flex flex-col gap-[5px]">
            <div className={`flex items-center justify-between pb-1.5 mb-0.5 border-b font-display text-[11px] font-extrabold tracking-[0.14em] uppercase ${isTeamBWinner ? "text-accent-dim border-border-accent" : "text-text-muted border-border"}`}>
              Next
              <span className={`text-[13px] font-black ${isTeamBWinner ? "text-accent" : "text-text-muted"}`}>
                {game?.scoreB ?? 0}
              </span>
            </div>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-[38px] bg-bg-hover rounded-md animate-pulse" />
              ))
            ) : (
              game?.teamB.map((player, i) => (
                <div
                  key={i}
                  className={`bg-bg-surface border rounded-md px-2.5 py-2 flex items-center justify-between gap-1.5 ${i === 0 ? "border-border-accent" : "border-border"}`}
                >
                  <span className="font-display text-[13px] font-extrabold tracking-[0.03em] uppercase text-text-primary leading-none flex-1 truncate min-w-0">
                    {player.displayName}
                  </span>
                  <span className={`font-display font-black tracking-[-0.01em] leading-none flex-shrink-0 ${i === 0 ? "text-[20px] text-accent" : player.points === 0 ? "text-[16px] text-text-muted" : "text-[20px] text-text-muted"}`}>
                    {player.points}
                  </span>
                </div>
              ))
            )}
          </div>

        </div>

        {/* NEXT GAME BUTTON — below player lists */}
        <div className="px-5 mt-5">
          <button
            type="button"
            onClick={() => router.push(`/runs/${code}/team-assignment`)}
            className="w-full h-[56px] rounded-lg bg-accent text-bg font-display text-[18px] font-extrabold tracking-[0.1em] uppercase flex items-center justify-center transition-all hover:bg-[#d4f545] active:scale-[0.98]"
          >
            Next Game
          </button>
        </div>

        {/* QUEUE PREVIEW */}
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

      {/* BOTTOM BAR */}
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
          disabled={ending}
          className="flex-1 h-[52px] rounded-md bg-danger text-white font-display text-[16px] font-extrabold tracking-[0.1em] uppercase flex items-center justify-center transition-all hover:bg-[#cc3232] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {ending ? "Ending..." : "End Run"}
        </button>
      </div>

    </div>
  );
}
