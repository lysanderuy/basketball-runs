"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { useConfirmTeamsMutation, useGames } from "@/hooks/use-game";
import { useQueue, useUpdateQueueStatusMutation } from "@/hooks/use-queue";
import { useRun } from "@/hooks/use-run";
import { useTeamDraftStore, type Player } from "@/stores/team-draft.store";
import { ApiError } from "@/lib/api/client";

// ─── Types ────────────────────────────────────────────────────────────────────

type ActionModal = { player: Player; team: "a" | "b" };

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TeamAssignmentPage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();

  const runQuery   = useRun(code);
  const queueQuery = useQueue(code);
  const gamesQuery = useGames(code);
  const statusMutation = useUpdateQueueStatusMutation(code);
  const confirmMutation = useConfirmTeamsMutation(code);

  const run = runQuery.data ?? null;
  const gamesData = gamesQuery.data;
  const nextGameNumber =
    gamesData && gamesData.length > 0
      ? Math.max(...gamesData.map((g) => g.gameNumber)) + 1
      : 1;

  // Draft domain state — Zustand store
  const teams      = useTeamDraftStore((s) => s.teams);
  const bench      = useTeamDraftStore((s) => s.bench);
  const suggestion = useTeamDraftStore((s) => s.suggestion);
  const swapMode   = useTeamDraftStore((s) => s.swapMode);
  const undoToast  = useTeamDraftStore((s) => s.undoToast);

  const resetDraft             = useTeamDraftStore((s) => s.reset);
  const initFromQueue          = useTeamDraftStore((s) => s.initFromQueue);
  const movePlayerInStore      = useTeamDraftStore((s) => s.movePlayer);
  const scrambleInStore        = useTeamDraftStore((s) => s.scramble);
  const benchForGameInStore    = useTeamDraftStore((s) => s.benchForGame);
  const removeDraftPlayer      = useTeamDraftStore((s) => s.removeDraftPlayer);
  const acceptSuggestionInStore = useTeamDraftStore((s) => s.acceptSuggestion);
  const addFromBench           = useTeamDraftStore((s) => s.addFromBench);
  const executeSwapInStore     = useTeamDraftStore((s) => s.executeSwap);
  const setSuggestion          = useTeamDraftStore((s) => s.setSuggestion);
  const setSwapMode            = useTeamDraftStore((s) => s.setSwapMode);
  const commitUndo             = useTeamDraftStore((s) => s.commitUndo);
  const dismissUndo            = useTeamDraftStore((s) => s.dismissUndo);

  const [loading,        setLoading]        = useState(true);
  const [scrambling,     setScrambling]     = useState(false);
  const [justMovedId,    setJustMovedId]    = useState<string | null>(null);
  const [confirmError,   setConfirmError]   = useState<string | null>(null);

  // Drag
  const [dragId,     setDragId]     = useState<string | null>(null);
  const [dragOrigin, setDragOrigin] = useState<"a" | "b" | null>(null);
  const [dragTarget, setDragTarget] = useState<"a" | "b" | null>(null);

  // Arrival glow — triggered for any player added to a team
  const [arrivedIds,  setArrivedIds]  = useState<Set<string>>(new Set());
  // Removal flash — brief red glow before the card is removed from DOM
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());

  // Bench sheet (Manage Roster)
  const [showBenchSheet, setShowBenchSheet] = useState(false);

  // Single-× action modal
  const [actionModal, setActionModal] = useState<ActionModal | null>(null);

  const zoneARef = useRef<HTMLDivElement>(null);
  const zoneBRef = useRef<HTMLDivElement>(null);

  // ─── Touch drag polyfill ───────────────────────────────────────────────────────
  // HTML5 drag-and-drop fires no events on touchscreens, so the card drag was
  // desktop-only. This polyfill translates touch events into the same drag events
  // the handlers below already listen for. Loaded lazily in the browser — its
  // singleton attaches to `document` at import time, which would throw during SSR.
  useEffect(() => {
    import("drag-drop-touch");
  }, []);

  // ─── Seed draft ─────────────────────────────────────────────────────────────

  // The store is shared across visits — wipe any stale draft from a previous
  // assignment before this page seeds its own.
  const seededRef = useRef(false);
  useEffect(() => { resetDraft(); }, [resetDraft]);

  useEffect(() => {
    if (seededRef.current) return;
    if (runQuery.isPending || queueQuery.isPending || gamesQuery.isPending) return;
    seededRef.current = true;

    const queueData = queueQuery.data ?? { onCourt: [], waiting: [] };
    const waitingPlayers = queueData.waiting
      .filter((e) => e.status === "waiting")
      .map((e) => ({ id: e.id, displayName: e.displayName, gamesPlayed: e.gamesPlayed }));

    initFromQueue(waitingPlayers);
    setLoading(false);
  }, [runQuery.isPending, queueQuery.isPending, gamesQuery.isPending, queueQuery.data, initFromQueue]);

  // ─── Visual feedback helpers ──────────────────────────────────────────────────

  function markArrived(playerId: string) {
    setArrivedIds((prev) => new Set(prev).add(playerId));
    setTimeout(() => {
      setArrivedIds((prev) => { const n = new Set(prev); n.delete(playerId); return n; });
    }, 700);
  }

  // Flash red, wait for animation, then run the actual state removal.
  // Returns a promise that resolves after the 220ms flash so callers can sequence.
  function flashRemove(playerId: string): Promise<void> {
    setRemovingIds((prev) => new Set(prev).add(playerId));
    return new Promise((resolve) => {
      setTimeout(() => {
        setRemovingIds((prev) => { const n = new Set(prev); n.delete(playerId); return n; });
        resolve();
      }, 220);
    });
  }

  // ─── API helpers ─────────────────────────────────────────────────────────────

  // ─── Bench for this game (draft-only, no persistence) ─────────────────────────

  async function benchForGame(player: Player, team: "a" | "b") {
    setActionModal(null);
    // The flash animation runs purely for visual feedback before the card leaves.
    await flashRemove(player.id);
    benchForGameInStore(player, team);
  }

  // ─── Remove from run (hard) ───────────────────────────────────────────────────

  async function removeFromRun(player: Player, team: "a" | "b") {
    setActionModal(null);
    // Run the flash animation and API call in parallel.
    // State is only updated if the API succeeds — if it fails, the card
    // reappears naturally once the flash animation ends.
    const [, result] = await Promise.allSettled([
      flashRemove(player.id),
      statusMutation.mutateAsync({ entryId: player.id, status: "marked_out" }),
    ]);
    if (result.status === "rejected") return;
    removeDraftPlayer(player, team, async () => {
      await statusMutation.mutateAsync({ entryId: player.id, status: "waiting" });
    });
  }

  // ─── Suggestion ──────────────────────────────────────────────────────────────

  function acceptSuggestion() {
    if (!suggestion) return;
    const playerId = suggestion.player.id;
    acceptSuggestionInStore();
    markArrived(playerId);
  }

  // ─── Bench sheet ─────────────────────────────────────────────────────────────

  function handleBenchPlayerTap(benchPlayer: Player) {
    setShowBenchSheet(false);

    if (teams.a.length !== teams.b.length) {
      const targetTeam = teams.a.length < teams.b.length ? "a" : "b";
      addFromBench(benchPlayer, targetTeam);
      markArrived(benchPlayer.id);
    } else {
      // Even teams — host picks who sits out by tapping a card
      setSwapMode({ benchPlayer });
    }
  }

  // ─── Swap mode ───────────────────────────────────────────────────────────────

  function executeSwap(assignedPlayer: Player, assignedTeam: "a" | "b") {
    if (!swapMode) return;
    const incoming = swapMode.benchPlayer;
    executeSwapInStore(assignedPlayer, assignedTeam);
    markArrived(incoming.id);
  }

  function cancelSwapMode() { setSwapMode(null); }

  // ─── Drag ─────────────────────────────────────────────────────────────────────

  function movePlayer(playerId: string, toTeam: "a" | "b") {
    movePlayerInStore(playerId, toTeam);
    setJustMovedId(playerId);
    setTimeout(() => setJustMovedId(null), 350);
  }

  function handleDragStart(e: React.DragEvent, player: Player, team: "a" | "b") {
    if (swapMode) return;
    setDragId(player.id); setDragOrigin(team);
    e.dataTransfer.effectAllowed = "move";
  }
  function handleDragEnd() { setDragId(null); setDragOrigin(null); setDragTarget(null); }
  function handleDragOver(e: React.DragEvent, team: "a" | "b") {
    if (swapMode) return;
    e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragTarget(team);
  }
  function handleDragLeave(e: React.DragEvent, team: "a" | "b") {
    const zone = team === "a" ? zoneARef.current : zoneBRef.current;
    if (zone && !zone.contains(e.relatedTarget as Node)) setDragTarget(null);
  }
  function handleDrop(e: React.DragEvent, toTeam: "a" | "b") {
    e.preventDefault(); setDragTarget(null);
    if (dragId === null || dragOrigin === toTeam) return;
    movePlayer(dragId, toTeam);
    setDragId(null); setDragOrigin(null);
  }

  // ─── Scramble ─────────────────────────────────────────────────────────────────

  function scramble() {
    if (scrambling) return;
    setScrambling(true);
    setTimeout(() => {
      scrambleInStore();
      setScrambling(false);
    }, 250);
  }

  // ─── Confirm ──────────────────────────────────────────────────────────────────

  const CONFIRM_ERROR_BY_CODE: Record<string, string> = {
    ONGOING_GAME: "A game is already in progress. End it before starting a new one.",
    INVALID_ENTRY_IDS: "Your roster changed — a selected player is no longer available. Refresh and try again.",
    VALIDATION: "Your roster changed — a selected player is no longer available. Refresh and try again.",
    UNAUTHORIZED: "Your session expired or you're no longer the host. Refresh and sign in again.",
    FORBIDDEN: "Your session expired or you're no longer the host. Refresh and sign in again.",
  };
  const GENERIC_CONFIRM_ERROR = "Couldn't start the game. Please try again.";

  async function confirmTeams() {
    if (confirmMutation.isPending || teams.a.length === 0 || teams.b.length === 0) return;
    setConfirmError(null);
    try {
      await confirmMutation.mutateAsync({
        teamA: teams.a.map((p) => p.id),
        teamB: teams.b.map((p) => p.id),
      });
      router.push(`/runs/${code}/game`);
    } catch (e) {
      const code = e instanceof ApiError ? e.code : "UNKNOWN";
      setConfirmError(CONFIRM_ERROR_BY_CODE[code] ?? GENERIC_CONFIRM_ERROR);
    }
  }

  // ─── Derived ──────────────────────────────────────────────────────────────────

  const countA = teams.a.length;
  const countB = teams.b.length;
  const total  = countA + countB;
  const pctA   = total > 0 ? (countA / total) * 100 : 50;
  const pctB   = total > 0 ? (countB / total) * 100 : 50;
  const diff   = Math.abs(countA - countB);
  const balanceText      = diff === 0 ? "Even split" : diff === 1 ? "Off by one" : `${diff} apart`;
  const balanceTextClass = diff === 0 ? "text-accent-dim" : diff >= 2 ? "text-warning" : "text-text-muted";

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="app-shell">

      {/* TOPBAR */}
      <div className="topbar">
        <div className="flex flex-col gap-0.5 min-w-0 flex-1 mr-2">
          {loading ? (
            <>
              <div className="h-[11px] w-20 bg-bg-hover rounded-sm animate-pulse" />
              <div className="h-5 w-36 bg-bg-hover rounded-sm mt-0.5 animate-pulse" />
            </>
          ) : (
            <>
              <span className="font-display text-[11px] font-bold tracking-[0.12em] uppercase text-text-muted truncate">
                {run?.location ?? "Basketball Run"}
              </span>
              <span className="font-display text-[20px] font-black tracking-[0.02em] uppercase text-text-primary leading-none truncate">
                {run?.name ?? "—"}
              </span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="font-display text-[12px] font-bold tracking-[0.1em] uppercase text-accent bg-accent-glow border border-border-accent px-2.5 py-1 rounded-[4px]">
            Game {nextGameNumber}
          </span>
          <button
            type="button"
            onClick={() => router.back()}
            title="Back"
            className="w-9 h-9 flex items-center justify-center rounded-sm border border-border bg-bg-surface text-text-secondary transition-all hover:border-accent-dim hover:text-accent hover:bg-accent-glow"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
        </div>
      </div>

      {/* BALANCE BAR */}
      <div className="mx-5 mt-4 flex flex-col gap-2 flex-shrink-0 animate-fade-up" style={{ animationDelay: "0.06s" }}>
        <div className="flex justify-between items-center">
          <div className="flex flex-col gap-px">
            <span className="font-display text-[11px] font-bold tracking-[0.14em] uppercase text-accent-dim">Runs</span>
            <span className={`font-display text-[28px] font-black tracking-[-0.02em] leading-none transition-colors ${diff >= 2 && countA > countB ? "text-warning" : "text-accent"}`}>
              {countA}
            </span>
          </div>
          <span className="font-display text-[13px] font-bold tracking-[0.1em] uppercase text-text-muted">vs</span>
          <div className="flex flex-col gap-px items-end">
            <span className="font-display text-[11px] font-bold tracking-[0.14em] uppercase text-text-muted">Next</span>
            <span className={`font-display text-[28px] font-black tracking-[-0.02em] leading-none transition-colors ${diff >= 2 && countB > countA ? "text-warning" : "text-text-secondary"}`}>
              {countB}
            </span>
          </div>
        </div>
        <div className="h-1 bg-bg-surface rounded-sm flex gap-0.5 overflow-hidden">
          <div className="h-full bg-accent rounded-l-sm" style={{ width: `${pctA}%`, transition: "width 0.3s cubic-bezier(0.34,1.56,0.64,1)" }} />
          <div className="h-full bg-text-secondary rounded-r-sm" style={{ width: `${pctB}%`, transition: "width 0.3s cubic-bezier(0.34,1.56,0.64,1)" }} />
        </div>
        <span className={`font-display text-[11px] font-bold tracking-[0.1em] uppercase text-center transition-colors ${balanceTextClass}`}>
          {balanceText}
        </span>
      </div>

      {/* SECTION HEADER — in-place swap: normal vs swap mode. No layout shift. */}
      <div
        className="flex items-center justify-between px-5 pt-4 pb-2.5 flex-shrink-0 animate-fade-up"
        style={{ animationDelay: "0.10s" }}
      >
        {swapMode ? (
          <>
            <span className="font-display text-[12px] font-bold tracking-[0.08em] uppercase text-accent flex items-center gap-1.5 truncate min-w-0 mr-2">
              <SwapArrowsIcon />
              Tap to swap with {swapMode.benchPlayer.displayName}
            </span>
            <button
              type="button"
              onClick={cancelSwapMode}
              className="font-display text-[12px] font-bold tracking-[0.1em] uppercase text-text-muted hover:text-text-secondary transition-colors bg-transparent border-none cursor-pointer flex-shrink-0"
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <span className="font-display text-[12px] font-bold tracking-[0.14em] uppercase text-text-muted">
              Drag to balance
            </span>
            <button
              type="button"
              onClick={scramble}
              disabled={scrambling}
              className={`font-display text-[12px] font-bold tracking-[0.1em] uppercase transition-colors bg-transparent border-none cursor-pointer flex items-center gap-1.5 ${
                scrambling ? "text-accent-dim" : "text-accent-dim hover:text-accent"
              }`}
            >
              <ScrambleIcon />
              Scramble
            </button>
          </>
        )}
      </div>

      {/* TEAMS GRID */}
      <div
        className="flex-1 grid grid-cols-2 px-5 min-h-0 overflow-hidden animate-fade-up"
        style={{
          animationDelay: "0.14s",
          opacity: scrambling ? 0 : 1,
          transition: scrambling ? "opacity 0.15s ease-out" : "opacity 0.2s ease-in",
        }}
      >
        {/* TEAM A */}
        <div className="flex flex-col min-h-0 pr-1.5 border-r border-border">
          <div className="font-display text-[11px] font-extrabold tracking-[0.14em] uppercase text-accent-dim border-b border-border-accent pb-2 mb-2 flex-shrink-0">
            Runs
          </div>
          <div
            ref={zoneARef}
            className={`flex-1 flex flex-col gap-1.5 overflow-y-auto min-h-[120px] rounded-md p-1 custom-scrollbar transition-[background] ${
              dragTarget === "a" && !swapMode ? "bg-[rgba(200,241,53,0.04)] outline outline-1 outline-dashed outline-border-accent" : ""
            }`}
            onDragOver={(e) => handleDragOver(e, "a")}
            onDragLeave={(e) => handleDragLeave(e, "a")}
            onDrop={(e) => handleDrop(e, "a")}
          >
            {loading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-9 bg-bg-hover rounded-md animate-pulse flex-shrink-0" style={{ animationDelay: `${i * 60}ms` }} />
                ))
              : (
                <>
                  {teams.a.map((player) => (
                    <AssignCard
                      key={player.id}
                      player={player}
                      isDragging={dragId === player.id}
                      justMoved={justMovedId === player.id}
                      justArrived={arrivedIds.has(player.id)}
                      isRemoving={removingIds.has(player.id)}
                      isSwapTarget={!!swapMode}
                      onAction={() => setActionModal({ player, team: "a" })}
                      onSwapSelect={() => executeSwap(player, "a")}
                      onDragStart={(e) => handleDragStart(e, player, "a")}
                      onDragEnd={handleDragEnd}
                    />
                  ))}
                  {suggestion?.forTeam === "a" && !swapMode && (
                    <SuggestionCard
                      player={suggestion.player}
                      onAccept={acceptSuggestion}
                      onDismiss={() => setSuggestion(null)}
                    />
                  )}
                </>
              )}
          </div>
        </div>

        {/* TEAM B */}
        <div className="flex flex-col min-h-0 pl-1.5">
          <div className="font-display text-[11px] font-extrabold tracking-[0.14em] uppercase text-text-muted border-b border-border pb-2 mb-2 flex-shrink-0">
            Next
          </div>
          <div
            ref={zoneBRef}
            className={`flex-1 flex flex-col gap-1.5 overflow-y-auto min-h-[120px] rounded-md p-1 custom-scrollbar transition-[background] ${
              dragTarget === "b" && !swapMode ? "bg-[rgba(200,241,53,0.04)] outline outline-1 outline-dashed outline-border-accent" : ""
            }`}
            onDragOver={(e) => handleDragOver(e, "b")}
            onDragLeave={(e) => handleDragLeave(e, "b")}
            onDrop={(e) => handleDrop(e, "b")}
          >
            {loading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-9 bg-bg-hover rounded-md animate-pulse flex-shrink-0" style={{ animationDelay: `${i * 60}ms` }} />
                ))
              : (
                <>
                  {teams.b.map((player) => (
                    <AssignCard
                      key={player.id}
                      player={player}
                      isDragging={dragId === player.id}
                      justMoved={justMovedId === player.id}
                      justArrived={arrivedIds.has(player.id)}
                      isRemoving={removingIds.has(player.id)}
                      isSwapTarget={!!swapMode}
                      onAction={() => setActionModal({ player, team: "b" })}
                      onSwapSelect={() => executeSwap(player, "b")}
                      onDragStart={(e) => handleDragStart(e, player, "b")}
                      onDragEnd={handleDragEnd}
                    />
                  ))}
                  {suggestion?.forTeam === "b" && !swapMode && (
                    <SuggestionCard
                      player={suggestion.player}
                      onAccept={acceptSuggestion}
                      onDismiss={() => setSuggestion(null)}
                    />
                  )}
                </>
              )}
          </div>
        </div>
      </div>

      {/* BOTTOM BAR */}
      <div className="bottom-bar" style={{ animationDelay: "0.20s" }}>
        <button
          type="button"
          onClick={() => setShowBenchSheet(true)}
          title="Manage Roster"
          className="w-[52px] h-[52px] flex-shrink-0 flex items-center justify-center rounded-md border border-border bg-bg-surface text-text-secondary transition-all hover:border-accent-dim hover:text-accent hover:bg-accent-glow relative"
        >
          <RosterIcon />
          {bench.length > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[16px] h-4 bg-accent text-bg font-display text-[9px] font-black rounded-full flex items-center justify-center px-1 leading-none">
              {bench.length}
            </span>
          )}
        </button>

        <div className="flex-1 flex flex-col gap-1">
          {confirmError && (
            <p className="font-display text-[11px] font-bold tracking-[0.05em] text-warning text-center">{confirmError}</p>
          )}
          <button
            type="button"
            onClick={confirmTeams}
            disabled={confirmMutation.isPending || teams.a.length === 0 || teams.b.length === 0}
            // When adding a new mutation that should block the confirm button, extend the
            // `confirmMutation.isPending` check on both the disabled prop and className below.
            // A missed entry enables the button mid-flight.
            className={[
              "w-full h-[52px] rounded-md bg-accent text-bg font-display text-[16px] font-extrabold tracking-[0.1em] uppercase flex items-center justify-center gap-2 transition-opacity",
              confirmMutation.isPending || teams.a.length === 0 || teams.b.length === 0
                ? "opacity-40 cursor-not-allowed"
                : "hover:opacity-90 active:opacity-75",
            ].join(" ")}
          >
            <Check className="w-4 h-4" strokeWidth={2.5} />
            {confirmMutation.isPending ? "Starting…" : "Confirm teams"}
          </button>
        </div>
      </div>

      {/* UNDO TOAST */}
      {undoToast && (
        <UndoToastBar
          key={undoToast.key}
          message={undoToast.message}
          onUndo={commitUndo}
          onDismiss={dismissUndo}
        />
      )}

      {/* BENCH SHEET */}
      {showBenchSheet && (
        <BenchSheet
          bench={bench}
          onPlayerTap={handleBenchPlayerTap}
          onClose={() => setShowBenchSheet(false)}
        />
      )}

      {/* ACTION MODAL — centered */}
      {actionModal && (
        <PlayerActionModal
          player={actionModal.player}
          onBenchForGame={() => benchForGame(actionModal.player, actionModal.team)}
          onRemoveFromRun={() => removeFromRun(actionModal.player, actionModal.team)}
          onCancel={() => setActionModal(null)}
        />
      )}

    </div>
  );
}

// ─── Assign Card ──────────────────────────────────────────────────────────────

interface AssignCardProps {
  player:       Player;
  isDragging:   boolean;
  justMoved:    boolean;
  justArrived:  boolean;
  isRemoving:   boolean;   // red flash before DOM removal
  isSwapTarget: boolean;   // swap mode — whole card is tappable
  onAction:     () => void;
  onSwapSelect: () => void;
  onDragStart:  (e: React.DragEvent) => void;
  onDragEnd:    () => void;
}

function AssignCard({
  player, isDragging, justMoved, justArrived, isRemoving, isSwapTarget,
  onAction, onSwapSelect, onDragStart, onDragEnd,
}: AssignCardProps) {
  return (
    <div
      draggable={!isSwapTarget && !isRemoving}
      onClick={isSwapTarget && !isRemoving ? onSwapSelect : undefined}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`
        relative flex items-center gap-2 rounded-md border
        py-[9px] px-2.5 overflow-hidden flex-shrink-0
        select-none [-webkit-tap-highlight-color:transparent]
        transition-[border-color,transform,box-shadow,background] duration-[120ms] group
        ${isRemoving
          ? "pointer-events-none animate-remove-flash bg-bg-surface border-border"
          : isSwapTarget
            ? "bg-[rgba(200,241,53,0.05)] border-border-accent cursor-pointer hover:bg-[rgba(200,241,53,0.1)] hover:border-accent active:scale-[0.97]"
            : `bg-bg-surface border-border cursor-grab hover:border-border-accent hover:-translate-y-px
               active:scale-[0.97] active:shadow-[0_3px_12px_rgba(0,0,0,0.4)] active:cursor-grabbing
               ${isDragging  ? "opacity-35 scale-[0.97] !border-border-accent cursor-grabbing" : ""}
               ${justMoved   ? "animate-move-flash"   : ""}
               ${justArrived ? "animate-arrival-glow" : ""}`
        }
      `}
    >
      {/* Hover glow — normal mode only */}
      {!isSwapTarget && !isRemoving && (
        <div className="absolute inset-0 bg-accent-glow opacity-0 group-hover:opacity-100 transition-opacity duration-[120ms]" />
      )}

      {/* Left icon: swap arrows in swap mode, drag grip otherwise */}
      <div className={`relative z-10 flex-shrink-0 transition-colors duration-[120ms] ${
        isSwapTarget ? "text-accent-dim" : "text-text-muted group-hover:text-text-secondary"
      }`}>
        {isSwapTarget ? <SwapArrowsIcon /> : <GripIcon />}
      </div>

      {/* Name */}
      <span className={`relative z-10 font-display text-[14px] font-extrabold tracking-[0.03em] uppercase leading-none flex-1 truncate min-w-0 transition-colors ${
        isSwapTarget ? "text-accent" : "text-text-primary"
      }`}>
        {player.displayName}
      </span>

      {/* Right button — always present (same size), icon/behavior changes by mode */}
      <button
        type="button"
        title={isSwapTarget ? "Swap this player" : "Player options"}
        onClick={(e) => {
          e.stopPropagation();
          if (isRemoving) return;
          if (isSwapTarget) { onSwapSelect(); } else { onAction(); }
        }}
        className={`relative z-10 w-[22px] h-[22px] flex items-center justify-center rounded-sm border flex-shrink-0 cursor-pointer transition-all duration-[120ms] ${
          isSwapTarget
            ? "border-border-accent bg-[rgba(200,241,53,0.1)] text-accent-dim hover:border-accent hover:text-accent hover:bg-[rgba(200,241,53,0.18)]"
            : "border-border bg-bg-hover text-text-muted hover:border-text-muted hover:text-text-secondary"
        }`}
      >
        {isSwapTarget ? (
          <SwapArrowsIcon small />
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-[10px] h-[10px]">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        )}
      </button>
    </div>
  );
}

// ─── Player Action Modal ──────────────────────────────────────────────────────

interface PlayerActionModalProps {
  player:          Player;
  onBenchForGame:  () => void;
  onRemoveFromRun: () => void;
  onCancel:        () => void;
}

function PlayerActionModal({ player, onBenchForGame, onRemoveFromRun, onCancel }: PlayerActionModalProps) {
  return (
    <div
      className="fixed inset-0 z-[300] bg-black/70 flex items-center justify-center px-6"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-[320px] bg-bg-raised border border-border rounded-lg flex flex-col overflow-hidden animate-slide-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Player name header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border flex-shrink-0">
          <span className="font-display text-[15px] font-black tracking-[0.04em] uppercase text-text-primary">
            {player.displayName}
          </span>
          <button
            type="button"
            onClick={onCancel}
            className="w-6 h-6 flex items-center justify-center rounded-sm text-text-muted hover:text-text-secondary transition-colors flex-shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Options */}
        <div className="flex flex-col gap-2 px-4 py-3">
          {/* Bench — accent/yellow tint */}
          <button
            type="button"
            onClick={onBenchForGame}
            className="w-full flex items-center gap-3 rounded-md border border-[rgba(200,241,53,0.25)] bg-[rgba(200,241,53,0.06)] px-3 py-3 text-left cursor-pointer transition-all duration-[120ms] hover:border-[rgba(200,241,53,0.5)] hover:bg-[rgba(200,241,53,0.12)]"
          >
            <div className="w-7 h-7 rounded-sm border border-[rgba(200,241,53,0.3)] bg-[rgba(200,241,53,0.08)] flex items-center justify-center flex-shrink-0 text-accent-dim">
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
                <rect x="5" y="4" width="4" height="16" rx="1" />
                <rect x="15" y="4" width="4" height="16" rx="1" />
              </svg>
            </div>
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="font-display text-[12px] font-extrabold tracking-[0.06em] uppercase text-accent-dim leading-none">
                Bench for next game
              </span>
              <span className="font-body text-[11px] text-text-muted leading-snug">
                Back automatically next round
              </span>
            </div>
          </button>

          {/* Remove — danger/red tint */}
          <button
            type="button"
            onClick={onRemoveFromRun}
            className="w-full flex items-center gap-3 rounded-md border border-[rgba(255,64,64,0.25)] bg-[rgba(255,64,64,0.06)] px-3 py-3 text-left cursor-pointer transition-all duration-[120ms] hover:border-[rgba(255,64,64,0.5)] hover:bg-[rgba(255,64,64,0.12)]"
          >
            <div className="w-7 h-7 rounded-sm border border-[rgba(255,64,64,0.3)] bg-[rgba(255,64,64,0.08)] flex items-center justify-center flex-shrink-0 text-danger">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </div>
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="font-display text-[12px] font-extrabold tracking-[0.06em] uppercase text-danger leading-none">
                Remove from run
              </span>
              <span className="font-body text-[11px] text-text-muted leading-snug">
                Off the queue for today
              </span>
            </div>
          </button>
        </div>

        {/* Cancel */}
        <div className="px-4 pb-4 pt-1 flex-shrink-0">
          <button
            type="button"
            onClick={onCancel}
            className="w-full h-9 rounded-md border border-border bg-bg-surface text-text-secondary font-display text-[12px] tracking-[0.08em] uppercase font-bold cursor-pointer hover:border-text-muted hover:text-text-primary transition-all"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Suggestion Card ──────────────────────────────────────────────────────────

function SuggestionCard({ player, onAccept, onDismiss }: { player: Player; onAccept: () => void; onDismiss: () => void }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-accent bg-[rgba(200,241,53,0.04)] px-2.5 py-2 flex-shrink-0 animate-slide-in">
      <div className="flex items-center">
        <span className="font-display text-[9px] font-bold tracking-[0.18em] uppercase text-accent bg-[rgba(200,241,53,0.14)] px-1.5 py-[3px] rounded-[3px]">
          Suggested
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="font-display text-[13px] font-extrabold tracking-[0.03em] uppercase text-text-primary leading-none flex-1 truncate min-w-0">
          {player.displayName}
        </span>
        <button
          type="button"
          onClick={onAccept}
          title="Add to team"
          className="w-6 h-6 flex items-center justify-center rounded-sm border border-border bg-bg-surface text-text-muted flex-shrink-0 cursor-pointer transition-all duration-[120ms] hover:border-accent hover:text-accent hover:bg-accent-glow"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-[10px] h-[10px]">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </button>
        <button
          type="button"
          onClick={onDismiss}
          title="Dismiss"
          className="w-6 h-6 flex items-center justify-center rounded-sm border border-border bg-bg-surface text-text-muted flex-shrink-0 cursor-pointer transition-all duration-[120ms] hover:border-text-muted hover:text-text-secondary"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-[10px] h-[10px]">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ─── Undo Toast ───────────────────────────────────────────────────────────────

function UndoToastBar({ message, onUndo, onDismiss }: { message: string; onUndo: () => void; onDismiss: () => void }) {
  return (
    <div className="fixed bottom-[100px] inset-x-0 z-[190] flex justify-center px-5 pointer-events-none">
      <div className="w-full max-w-[480px] pointer-events-auto">
        <div className="flex items-center gap-2 bg-bg-raised border border-border rounded-md px-3 py-2.5 shadow-[0_8px_32px_rgba(0,0,0,0.5)] animate-slide-in">
          <span className="font-display text-[13px] font-bold tracking-[0.04em] uppercase text-text-secondary flex-1 truncate">
            {message}
          </span>
          <button type="button" onClick={onUndo} className="font-display text-[12px] font-bold tracking-[0.08em] uppercase text-accent hover:text-accent-dim transition-colors flex-shrink-0 cursor-pointer">
            Undo
          </button>
          <div className="w-px h-4 bg-border flex-shrink-0" />
          <button type="button" onClick={onDismiss} className="w-5 h-5 flex items-center justify-center text-text-muted hover:text-text-secondary transition-colors flex-shrink-0 cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Bench Sheet ──────────────────────────────────────────────────────────────

interface BenchSheetProps {
  bench:       Player[];
  onPlayerTap: (p: Player) => void;
  onClose:     () => void;
}

function BenchSheet({ bench, onPlayerTap, onClose }: BenchSheetProps) {
  return (
    <>
      <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed bottom-0 inset-x-0 z-[201] flex justify-center pointer-events-none">
        <div className="w-full max-w-[480px] bg-bg-raised border-t border-border rounded-t-xl flex flex-col pointer-events-auto animate-slide-up max-h-[60dvh]">
          <div className="w-10 h-1 bg-border rounded-full mx-auto mt-2.5 mb-0.5 flex-shrink-0" />
          <div className="flex items-start justify-between px-5 py-3 flex-shrink-0 border-b border-border">
            <div className="flex flex-col gap-0.5">
              <p className="font-display text-[15px] font-extrabold tracking-[0.06em] uppercase text-text-primary leading-none">
                On Bench
                {bench.length > 0 && (
                  <span className="ml-2 font-display text-[13px] font-bold text-text-muted">{bench.length}</span>
                )}
              </p>
              <p className="font-display text-[11px] font-bold tracking-[0.1em] uppercase text-text-muted">
                {bench.length === 0 ? "All players are assigned" : "Tap to bring into the game"}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-sm border border-border bg-bg-surface text-text-muted transition-colors hover:border-text-muted hover:text-text-primary flex-shrink-0 ml-3"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar px-5 py-3">
            {bench.length === 0 ? (
              <div className="py-8 flex flex-col items-center gap-1.5 text-center">
                <span className="font-display text-[13px] font-bold tracking-[0.08em] uppercase text-text-muted">Bench is empty</span>
                <span className="font-body text-[12px] text-text-muted leading-relaxed max-w-[200px]">All waiting players are already assigned to a team</span>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                {bench.map((player) => (
                  <button
                    key={player.id}
                    type="button"
                    onClick={() => onPlayerTap(player)}
                    className="w-full flex items-center gap-3 rounded-md border border-border bg-bg-surface px-3 py-2.5 cursor-pointer hover:border-accent-dim hover:bg-[rgba(200,241,53,0.04)] transition-all duration-[120ms] group"
                  >
                    <span className="font-display text-[15px] font-extrabold tracking-[0.03em] uppercase leading-none flex-1 text-left truncate min-w-0 text-text-primary group-hover:text-accent transition-colors">
                      {player.displayName}
                    </span>
                    <span className="font-display text-[11px] font-semibold tracking-[0.06em] text-text-muted flex-shrink-0 whitespace-nowrap">
                      {player.gamesPlayed} {player.gamesPlayed === 1 ? "game" : "games"}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function ScrambleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
      <polyline points="16 3 21 3 21 8" />
      <line x1="4" y1="20" x2="21" y2="3" />
      <polyline points="21 16 21 21 16 21" />
      <line x1="15" y1="15" x2="21" y2="21" />
    </svg>
  );
}

function SwapArrowsIcon({ small }: { small?: boolean }) {
  const size = small ? "w-[10px] h-[10px]" : "w-[11px] h-[11px]";
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`${size} flex-shrink-0`}>
      <path d="M7 16V4m0 0L3 8m4-4 4 4" />
      <path d="M17 8v12m0 0 4-4m-4 4-4-4" />
    </svg>
  );
}

function GripIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-[11px] h-[11px]">
      <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  );
}

function RosterIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
