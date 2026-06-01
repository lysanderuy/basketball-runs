"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useRun, RunActions, type Player } from "@/contexts/RunContext";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ─── helpers ────────────────────────────────────────────────────────────────

type DbPlayer = {
  id: string;
  name: string;
  section: string;
  games_played: number;
};

type PrismaPlayer = {
  id: string;
  name: string;
  section: string;
  gamesPlayed: number;
};

function fromPrismaPlayer(p: PrismaPlayer): Player {
  return { id: p.id, name: p.name, section: p.section as Player["section"], games: p.gamesPlayed, out: false };
}

function fromRealtimePlayer(p: DbPlayer): Player {
  return { id: p.id, name: p.name, section: p.section as Player["section"], games: p.games_played, out: false };
}

// ─── component ──────────────────────────────────────────────────────────────

export function LobbyHost({ code }: { code?: string }) {
  const { state, dispatch } = useRun();
  const router = useRouter();
  const { currentRun, queue } = state;

  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const [runId, setRunId] = useState<string | null>(currentRun?.id ?? null);

  // modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [playerName, setPlayerName] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── fetch run + players on mount ──────────────────────────────────────────
  useEffect(() => {
    if (!code) return;

    async function fetchRun() {
      setFetching(true);
      setFetchError(false);
      try {
        const res = await fetch(`/api/runs/${code}`);
        if (!res.ok) { setFetchError(true); return; }
        const { run } = await res.json();

        if (!currentRun || currentRun.code !== code) {
          dispatch(RunActions.createRun({
            id: run.id,
            name: run.name,
            location: run.location,
            format: run.format,
            scoreGoal: run.scoreGoal,
            timeLimit: run.timeLimit ?? undefined,
            code: run.code,
          }));
        }

        dispatch(RunActions.setQueue(run.players.map(fromPrismaPlayer)));
        setRunId(run.id);
      } catch {
        setFetchError(true);
      } finally {
        setFetching(false);
      }
    }

    fetchRun();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  // ── Supabase Realtime — listen for remote player changes ──────────────────
  useEffect(() => {
    if (!runId) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`run-players-${runId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "run_players", filter: `run_id=eq.${runId}` },
        (payload) => {
          const incoming = fromRealtimePlayer(payload.new as DbPlayer);
          // avoid duplicate if we already added locally
          dispatch({ type: "ADD_PLAYER", payload: incoming });
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "run_players", filter: `run_id=eq.${runId}` },
        (payload) => {
          dispatch(RunActions.removePlayer((payload.old as { id: string }).id));
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [runId, dispatch]);

  // ── focus input when modal opens ──────────────────────────────────────────
  useEffect(() => {
    if (modalOpen) setTimeout(() => inputRef.current?.focus(), 50);
    else { setPlayerName(""); setAddError(null); }
  }, [modalOpen]);

  // ── add player ────────────────────────────────────────────────────────────
  async function handleAddPlayer() {
    if (!playerName.trim() || !code) return;
    setAdding(true);
    setAddError(null);

    try {
      const res = await fetch(`/api/runs/${code}/players`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: playerName.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to add player");
      }

      const { player } = await res.json();
      // Realtime will also fire for other clients; dispatch locally for instant feedback
      dispatch(RunActions.addPlayer(fromPrismaPlayer(player)));
      setModalOpen(false);
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setAdding(false);
    }
  }

  // ── remove player ─────────────────────────────────────────────────────────
  async function handleRemovePlayer(id: string) {
    // optimistic
    dispatch(RunActions.removePlayer(id));
    await fetch(`/api/runs/${code}/players/${id}`, { method: "DELETE" });
  }

  // ── derived ───────────────────────────────────────────────────────────────
  const courtPlayers = queue.filter((p) => p.section === "court");
  const nextPlayers  = queue.filter((p) => p.section === "next");
  const waitingPlayers = queue.filter((p) => p.section === "waiting");
  const inNextGame = [...courtPlayers, ...nextPlayers];
  const canStart = courtPlayers.length >= 2;

  // ── loading / error ───────────────────────────────────────────────────────
  if (fetching) {
    return (
      <div className="app-shell">
        <div className="flex-1 flex items-center justify-center">
          <div className="w-10 h-10 border-[3px] border-border border-t-accent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="app-shell">
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-5">
          <p className="font-display text-[16px] font-bold uppercase text-text-muted text-center">
            Run not found
          </p>
          <Button variant="primary" size="lg" onClick={() => router.push("/")}>
            Go home
          </Button>
        </div>
      </div>
    );
  }

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <>
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
              Lobby
            </span>
            <button className="w-9 h-9 rounded-sm border border-border bg-bg-surface text-text-secondary flex items-center justify-center cursor-pointer transition-all duration-150 hover:border-accent-dim hover:text-accent hover:bg-accent-glow">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l-.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
            </button>
          </div>
        </div>

        {/* QR BLOCK */}
        <div className="mx-5 mt-5 bg-bg-surface border border-border rounded-lg p-5 flex flex-col items-center gap-3.5 relative overflow-hidden">
          <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[200px] h-[200px] bg-accent-glow rounded-full blur-[40px] pointer-events-none" />
          <span className="font-display text-[11px] font-bold tracking-[0.14em] uppercase text-text-muted relative z-10">
            Scan to join
          </span>
          <div className="relative z-10 w-[180px] h-[180px] rounded-md overflow-hidden border-[3px] border-bg shadow-[0_0_0_1px_rgba(200,241,53,0.3)]">
            <svg viewBox="0 0 41 41" xmlns="http://www.w3.org/2000/svg" className="w-full h-full" style={{ background: "#f0f0e8" }}>
              <rect x="1" y="1" width="7" height="7" fill="#0e0f0c"/><rect x="2" y="2" width="5" height="5" fill="#f0f0e8"/><rect x="3" y="3" width="3" height="3" fill="#0e0f0c"/>
              <rect x="33" y="1" width="7" height="7" fill="#0e0f0c"/><rect x="34" y="2" width="5" height="5" fill="#f0f0e8"/><rect x="35" y="3" width="3" height="3" fill="#0e0f0c"/>
              <rect x="1" y="33" width="7" height="7" fill="#0e0f0c"/><rect x="2" y="34" width="5" height="5" fill="#f0f0e8"/><rect x="3" y="35" width="3" height="3" fill="#0e0f0c"/>
              <rect x="9" y="9" width="1" height="1" fill="#0e0f0c"/><rect x="11" y="9" width="2" height="1" fill="#0e0f0c"/><rect x="15" y="9" width="1" height="1" fill="#0e0f0c"/><rect x="17" y="9" width="3" height="1" fill="#0e0f0c"/><rect x="22" y="9" width="2" height="1" fill="#0e0f0c"/><rect x="26" y="9" width="1" height="1" fill="#0e0f0c"/><rect x="28" y="9" width="3" height="1" fill="#0e0f0c"/>
              <rect x="18" y="18" width="5" height="5" fill="#0e0f0c"/><rect x="19" y="19" width="3" height="3" fill="#f0f0e8"/><rect x="20" y="20" width="1" height="1" fill="#0e0f0c"/>
            </svg>
          </div>
          <div className="flex flex-col items-center gap-1 relative z-10">
            <span className="font-display text-[11px] font-bold tracking-[0.12em] uppercase text-text-muted">
              Session code
            </span>
            <span className="font-display text-[32px] font-black tracking-[0.18em] uppercase text-accent leading-none">
              {currentRun?.code}
            </span>
          </div>
          <span className="font-body text-[13px] text-text-muted text-center relative z-10">
            Share this screen or send the code — players join from any browser
          </span>
        </div>

        {/* FORMAT STRIP */}
        <div className="mx-5 mt-3 bg-bg-surface border border-border rounded-md px-3.5 py-2.5 flex items-center justify-between">
          <div className="flex flex-col gap-0.5">
            <span className="font-display text-[10px] font-bold tracking-[0.14em] uppercase text-text-muted">
              Format
            </span>
            <span className="font-display text-[16px] font-black tracking-[0.04em] uppercase text-text-primary leading-none">
              {currentRun?.format === "winner-stays" ? "Winner Stays" : "Rotation"}
            </span>
          </div>
          <button className="font-display text-[12px] font-bold tracking-[0.1em] uppercase text-accent-dim hover:text-accent transition-colors bg-none border-none p-0 cursor-pointer">
            Change
          </button>
        </div>

        {/* QUEUE HEADER */}
        <div className="flex items-center justify-between px-5 pt-5">
          <span className="font-display text-[12px] font-bold tracking-[0.14em] uppercase text-text-muted">
            Queue
          </span>
          <span className="font-display text-[12px] font-bold tracking-[0.1em] uppercase text-text-muted">
            <span className="text-text-secondary">{queue.length}</span> players
          </span>
        </div>

        {/* QUEUE LIST */}
        <div className="flex-1 px-5 flex flex-col gap-1.5 overflow-y-auto custom-scrollbar pb-2">
          {inNextGame.map((player, idx) => (
            <QueueRow
              key={player.id}
              player={player}
              index={idx}
              highlighted={idx < 5}
              onRemove={handleRemovePlayer}
            />
          ))}

          {waitingPlayers.length > 0 && (
            <div className="flex items-center gap-2.5 py-1">
              <div className="flex-1 h-px bg-border" />
              <span className="font-display text-[10px] font-bold tracking-[0.14em] uppercase text-text-muted">
                Waiting
              </span>
              <div className="flex-1 h-px bg-border" />
            </div>
          )}

          {waitingPlayers.map((player, idx) => (
            <QueueRow
              key={player.id}
              player={player}
              index={inNextGame.length + idx}
              highlighted={false}
              onRemove={handleRemovePlayer}
            />
          ))}

          {queue.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <div className="w-10 h-10 rounded-full border border-dashed border-border flex items-center justify-center text-text-muted">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4.5 h-4.5">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
              </div>
              <p className="font-display text-[14px] font-bold tracking-[0.06em] uppercase text-text-muted">
                No players yet
              </p>
            </div>
          )}
        </div>

        {/* BOTTOM BAR */}
        <div className="bottom-bar">
          <button
            className="h-[52px] px-4 rounded-md border border-border bg-bg-surface text-text-secondary font-display text-[13px] font-bold tracking-[0.08em] uppercase transition-all duration-150 flex items-center gap-1.5 hover:border-text-muted hover:text-text-primary"
            onClick={() => setModalOpen(true)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Add
          </button>
          <Button
            variant="primary"
            size="lg"
            className={cn("flex-1 h-[52px]", !canStart && "opacity-50 cursor-not-allowed")}
            onClick={() => router.push("/team-assignment")}
            disabled={!canStart}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
            Start Game
          </Button>
        </div>
      </div>

      {/* ADD PLAYER MODAL */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center"
          onClick={(e) => { if (e.target === e.currentTarget) setModalOpen(false); }}
        >
          {/* backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" />

          {/* sheet */}
          <div className="relative z-10 w-full max-w-[480px] bg-bg border-t border-border rounded-t-2xl px-5 pt-5 pb-8 flex flex-col gap-5 animate-slide-up">
            {/* handle */}
            <div className="w-10 h-1 rounded-full bg-border self-center -mt-1" />

            <div className="flex items-center justify-between">
              <span className="font-display text-[18px] font-black tracking-[0.02em] uppercase text-text-primary">
                Add Player
              </span>
              <button
                className="w-8 h-8 rounded-sm border border-border bg-bg-surface text-text-muted flex items-center justify-center cursor-pointer hover:text-text-primary transition-colors"
                onClick={() => setModalOpen(false)}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-display text-[11px] font-bold tracking-[0.14em] uppercase text-text-muted">
                Player name
              </label>
              <input
                ref={inputRef}
                className={cn(
                  "w-full h-12 bg-bg-surface border border-border rounded-md px-3.5",
                  "font-display text-[17px] font-bold tracking-[0.02em] uppercase text-text-primary",
                  "outline-none transition-all duration-150 caret-accent",
                  "placeholder:text-text-muted placeholder:font-semibold",
                  "focus:border-border-accent focus:bg-bg-hover"
                )}
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleAddPlayer(); }}
                placeholder="Marcus"
                maxLength={32}
                autoComplete="off"
              />
              {addError && (
                <span className="font-display text-[12px] font-bold tracking-[0.04em] text-[#ff6060]">
                  {addError}
                </span>
              )}
            </div>

            <div className="flex gap-2">
              <button
                className="h-12 px-5 rounded-md border border-border bg-bg-surface text-text-secondary font-display text-[13px] font-bold tracking-[0.08em] uppercase transition-all hover:border-text-muted hover:text-text-primary"
                onClick={() => setModalOpen(false)}
              >
                Cancel
              </button>
              <Button
                variant="primary"
                size="lg"
                className="flex-1 h-12"
                onClick={handleAddPlayer}
                disabled={!playerName.trim() || adding}
              >
                {adding ? (
                  <div className="w-4 h-4 border-2 border-bg border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                    </svg>
                    Add to Queue
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── queue row sub-component ─────────────────────────────────────────────────

function QueueRow({
  player,
  index,
  highlighted,
  onRemove,
}: {
  player: Player;
  index: number;
  highlighted: boolean;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="bg-bg-surface border border-border rounded-md px-3 py-2.5 flex items-center gap-2.5 transition-all duration-120 select-none">
      <div className="text-text-muted flex items-center cursor-grab active:cursor-grabbing hover:text-text-secondary transition-colors">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
          <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
          <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
        </svg>
      </div>
      <span className={cn(
        "font-display text-[13px] font-bold tracking-[0.04em] text-text-muted w-5 text-center flex-shrink-0",
        highlighted && "text-accent-dim"
      )}>
        {index + 1}
      </span>
      <span className="font-display text-[16px] font-black tracking-[0.03em] uppercase text-text-primary leading-none flex-1">
        {player.name}
      </span>
      <span className="font-display text-[11px] font-bold tracking-[0.08em] uppercase text-text-muted flex-shrink-0">
        Just now
      </span>
      <button
        className="w-7 h-7 rounded-sm border border-border bg-bg-hover text-text-muted flex items-center justify-center cursor-pointer transition-all duration-120 hover:border-text-muted hover:text-text-secondary"
        onClick={() => onRemove(player.id)}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
  );
}
