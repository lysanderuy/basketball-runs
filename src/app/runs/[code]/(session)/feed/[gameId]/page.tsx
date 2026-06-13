"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SessionTopbar } from "@/components/ui/session-topbar";
import { useGameRealtime } from "@/hooks/use-game-realtime";
import { formatTime } from "@/lib/utils";
import { useGameDetails } from "@/hooks/use-game";
import { useRun } from "@/hooks/use-run";
import { useSessionUser } from "@/hooks/use-session";

function gameDuration(startedAt: string | null, endedAt: string | null): string {
  if (!startedAt || !endedAt) return "—";
  const ms = new Date(endedAt).getTime() - new Date(startedAt).getTime();
  return formatTime(Math.round(ms / 1000));
}

function winnerLabel(winner: "team_a" | "team_b" | "tie" | null): string {
  if (winner === "team_a") return "Runs won";
  if (winner === "team_b") return "Next won";
  if (winner === "tie") return "Tie game";
  return "—";
}

export default function PastGamePage() {
  const { code, gameId } = useParams<{ code: string; gameId: string }>();

  const runQuery = useRun(code);
  const detailsQuery = useGameDetails(code, gameId ?? null);
  const sessionQuery = useSessionUser();

  // Subscribe to per-game changes so the stats refresh on the rare case
  // a voided score on a completed game is edited by an admin tool.
  useGameRealtime(code, gameId ?? null);

  const run = runQuery.data ?? null;
  const details = detailsQuery.data ?? null;
  const userId = sessionQuery.data ?? null;
  const loading =
    runQuery.isPending || detailsQuery.isPending || sessionQuery.isPending;

  const game = details?.game ?? null;
  // details.players is already sorted leader-first by getGameWithDetails
  // (points DESC, displayName ASC), so the top scorer is always index 0.
  const players = details?.players ?? [];
  const winner = game?.winner ?? null;
  const winnerTextClass =
    winner === "tie"
      ? "text-warning"
      : winner !== null
        ? "text-accent"
        : "text-text-muted";

  return (
    <>
      <SessionTopbar
        run={run}
        loading={loading}
        exitHref={!loading && userId !== null ? "/" : undefined}
      />

      <div className="flex-1 overflow-y-auto custom-scrollbar pb-8">
        <div className="px-5 pt-3">
          <Link
            href={`/runs/${code}/feed`}
            className="inline-flex items-center gap-1.5 font-display text-[11px] font-bold tracking-[0.12em] uppercase text-text-muted transition-colors hover:text-text-secondary"
          >
            <ArrowLeft className="w-3.5 h-3.5" strokeWidth={2.5} />
            Back to feed
          </Link>
        </div>

        {!details ? (
          <div className="px-5 pt-6 font-display text-[12px] text-text-muted">
            {detailsQuery.isError ? "Couldn't load game." : "Loading…"}
          </div>
        ) : (
          <>
            {/* HEADER — game number + winner */}
            <div
              className="px-5 pt-3 pb-1 flex flex-col gap-0.5 animate-fade-up"
              style={{ animationDelay: "0.04s" }}
            >
              <span className="font-display text-[10px] font-bold tracking-[0.18em] uppercase text-text-muted">
                Game {game!.gameNumber}
              </span>
              <span
                className={`font-display text-[22px] font-black tracking-[0.02em] uppercase leading-none ${winnerTextClass}`}
              >
                {winnerLabel(winner)}
              </span>
            </div>

            {/* SCORE BLOCK — mirrors the live game's score layout */}
            <div
              className="mx-5 mt-4 bg-bg-surface border border-border rounded-lg overflow-hidden animate-fade-up"
              style={{ animationDelay: "0.08s" }}
            >
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1.5 px-4 py-5">
                <div className="flex flex-col items-center gap-0.5">
                  <span className="font-display text-[11px] font-bold tracking-[0.14em] uppercase text-text-muted">
                    Runs
                  </span>
                  <span
                    className="font-display font-black leading-[0.88] tracking-[-0.02em] text-text-primary select-none"
                    style={{ fontSize: "clamp(52px, 14vw, 72px)" }}
                  >
                    {game!.scoreA}
                  </span>
                </div>
                <span className="font-display text-[22px] font-black text-text-muted tracking-[-0.04em] pb-2.5">
                  —
                </span>
                <div className="flex flex-col items-center gap-0.5">
                  <span className="font-display text-[11px] font-bold tracking-[0.14em] uppercase text-text-muted">
                    Next
                  </span>
                  <span
                    className="font-display font-black leading-[0.88] tracking-[-0.02em] text-text-primary select-none"
                    style={{ fontSize: "clamp(52px, 14vw, 72px)" }}
                  >
                    {game!.scoreB}
                  </span>
                </div>
              </div>
              <div className="border-t border-border px-4 py-2.5 flex items-center justify-center gap-2">
                <span className="font-display text-[10px] font-bold tracking-[0.16em] uppercase text-text-muted">
                  Final
                </span>
                <span className="font-display text-[11px] font-semibold tracking-[0.08em] uppercase text-text-muted">
                  · to {game!.scoreGoal}
                </span>
                {game!.timeLimitSeconds !== null && game!.startedAt && game!.endedAt && (
                  <>
                    <span className="font-display text-[11px] font-semibold tracking-[0.08em] uppercase text-text-muted">
                      ·
                    </span>
                    <span className="font-display text-[11px] font-semibold tracking-[0.08em] uppercase text-text-muted">
                      {gameDuration(game!.startedAt, game!.endedAt)}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* STATS LIST — single column, leader pinned first */}
            <div
              className="mx-5 mt-4 flex flex-col gap-2 animate-fade-up"
              style={{ animationDelay: "0.12s" }}
            >
              <span className="font-display text-[10px] font-bold tracking-[0.18em] uppercase text-text-muted">
                Stats
              </span>
              <div className="bg-bg-surface border border-border rounded-lg overflow-hidden flex flex-col">
                {players.length === 0 ? (
                  <span className="px-3.5 py-3 font-display text-[12px] font-semibold tracking-[0.04em] text-text-muted">
                    —
                  </span>
                ) : (
                  players.map((p, idx) => {
                    const isLeader = idx === 0;
                    return (
                      <div
                        key={p.queueEntryId}
                        className={`flex items-center justify-between gap-2 px-3.5 py-2.5 ${idx > 0 ? "border-t border-border" : ""}`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {isLeader && (
                            <span className="font-display text-[9px] font-extrabold tracking-[0.14em] uppercase px-1.5 py-0.5 rounded-sm flex-shrink-0 text-bg bg-accent">
                              MVP
                            </span>
                          )}
                          <span
                            className={`font-display text-[13px] font-bold tracking-[0.02em] truncate ${
                              isLeader ? "text-text-primary" : "text-text-secondary"
                            }`}
                          >
                            {p.displayName}
                          </span>
                        </div>
                        <span
                          className={`font-display text-[15px] font-black tracking-[-0.01em] flex-shrink-0 ${
                            isLeader ? "text-accent" : "text-text-primary"
                          }`}
                        >
                          {p.points}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
