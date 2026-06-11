"use client";

import { create } from "zustand";

export type Player = {
  id: string;
  displayName: string;
  gamesPlayed: number;
};

export type Suggestion = { player: Player; forTeam: "a" | "b" };
export type UndoToast = { key: number; message: string; undo: () => Promise<void> };
export type SwapMode = { benchPlayer: Player };

type TeamDraftState = {
  teams: { a: Player[]; b: Player[] };
  bench: Player[];
  suggestion: Suggestion | null;
  swapMode: SwapMode | null;
  undoToast: UndoToast | null;
  reset: () => void;
  initFromQueue: (waitingPlayers: Player[]) => void;
  movePlayer: (playerId: string, toTeam: "a" | "b") => void;
  scramble: () => void;
  benchForGame: (player: Player, team: "a" | "b") => void;
  removeDraftPlayer: (player: Player, team: "a" | "b", onUndo?: () => Promise<void>) => void;
  acceptSuggestion: () => void;
  addFromBench: (benchPlayer: Player, targetTeam: "a" | "b") => void;
  executeSwap: (assignedPlayer: Player, assignedTeam: "a" | "b") => void;
  setSuggestion: (suggestion: Suggestion | null) => void;
  setSwapMode: (swapMode: SwapMode | null) => void;
  pushUndo: (message: string, undo: () => Promise<void>) => void;
  commitUndo: () => Promise<void>;
  dismissUndo: () => void;
};

let undoTimer: ReturnType<typeof setTimeout> | null = null;

const initialState = {
  teams: { a: [], b: [] },
  bench: [],
  suggestion: null,
  swapMode: null,
  undoToast: null,
} satisfies Pick<TeamDraftState, "teams" | "bench" | "suggestion" | "swapMode" | "undoToast">;

export const useTeamDraftStore = create<TeamDraftState>((set, get) => ({
  ...initialState,

  reset: () => {
    if (undoTimer) clearTimeout(undoTimer);
    set({ ...initialState });
  },

  initFromQueue: (waitingPlayers) => {
    if (undoTimer) clearTimeout(undoTimer);
    // First 10 waiting players seed the two teams; any overflow waits on the
    // bench. Benching is a draft-only action (local state) — it never persists,
    // so an abandoned assignment leaves no trace and a benched player is simply
    // first in line again next time.
    const eligible = waitingPlayers.slice(0, 10);
    const benchPlayers = waitingPlayers.slice(10);

    const half = Math.ceil(eligible.length / 2);
    set({
      teams: { a: eligible.slice(0, half), b: eligible.slice(half) },
      bench: benchPlayers,
      suggestion: null,
      swapMode: null,
      undoToast: null,
    });
  },

  movePlayer: (playerId, toTeam) => {
    set((s) => {
      const fromTeam = toTeam === "a" ? "b" : "a";
      const player = s.teams[fromTeam].find((p) => p.id === playerId);
      if (!player) return s;
      return {
        teams: {
          ...s.teams,
          [fromTeam]: s.teams[fromTeam].filter((p) => p.id !== playerId),
          [toTeam]: [...s.teams[toTeam], player],
        },
      };
    });
  },

  scramble: () => {
    set((s) => {
      const all = [...s.teams.a, ...s.teams.b];
      for (let i = all.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [all[i], all[j]] = [all[j], all[i]];
      }
      const half = Math.ceil(all.length / 2);
      return { teams: { a: all.slice(0, half), b: all.slice(half) } };
    });
  },

  benchForGame: (player, team) => {
    const firstBench = get().bench[0] ?? null;
    // Benching only edits the local draft — the player is left untouched in the
    // DB (still 'waiting') and is simply not included when teams are confirmed.
    set((s) => ({
      teams: { ...s.teams, [team]: s.teams[team].filter((p) => p.id !== player.id) },
      suggestion: firstBench ? { player: firstBench, forTeam: team } : null,
    }));
    get().pushUndo(`Benched ${player.displayName}`, async () => {
      set((s) => ({
        teams: { ...s.teams, [team]: [...s.teams[team], player] },
        suggestion: null,
      }));
    });
  },

  removeDraftPlayer: (player, team, onUndo) => {
    set((s) => ({
      suggestion: s.suggestion?.player.id === player.id ? null : s.suggestion,
      teams: { ...s.teams, [team]: s.teams[team].filter((p) => p.id !== player.id) },
    }));
    get().pushUndo(`Removed ${player.displayName}`, async () => {
      set((s) => ({ teams: { ...s.teams, [team]: [...s.teams[team], player] } }));
      await onUndo?.();
    });
  },

  acceptSuggestion: () => {
    const sug = get().suggestion;
    if (!sug) return;
    const { player, forTeam } = sug;
    set((s) => ({
      teams: { ...s.teams, [forTeam]: [...s.teams[forTeam], player] },
      bench: s.bench.filter((b) => b.id !== player.id),
      suggestion: null,
    }));
    get().pushUndo(`Added ${player.displayName}`, async () => {
      set((s) => ({
        teams: { ...s.teams, [forTeam]: s.teams[forTeam].filter((p) => p.id !== player.id) },
        bench: [player, ...s.bench],
      }));
    });
  },

  addFromBench: (benchPlayer, targetTeam) => {
    set((s) => ({
      teams: { ...s.teams, [targetTeam]: [...s.teams[targetTeam], benchPlayer] },
      bench: s.bench.filter((b) => b.id !== benchPlayer.id),
      suggestion: s.suggestion?.player.id === benchPlayer.id ? null : s.suggestion,
    }));
    get().pushUndo(`Added ${benchPlayer.displayName}`, async () => {
      set((s) => ({
        teams: { ...s.teams, [targetTeam]: s.teams[targetTeam].filter((p) => p.id !== benchPlayer.id) },
        bench: [benchPlayer, ...s.bench],
      }));
    });
  },

  executeSwap: (assignedPlayer, assignedTeam) => {
    const mode = get().swapMode;
    if (!mode) return;
    const incoming = mode.benchPlayer;
    set((s) => ({
      swapMode: null,
      teams: {
        ...s.teams,
        [assignedTeam]: s.teams[assignedTeam].map((p) => (p.id === assignedPlayer.id ? incoming : p)),
      },
      bench: s.bench.map((b) => (b.id === incoming.id ? assignedPlayer : b)),
      suggestion: s.suggestion?.player.id === incoming.id ? null : s.suggestion,
    }));
    get().pushUndo(`Swapped ${incoming.displayName} ↔ ${assignedPlayer.displayName}`, async () => {
      set((s) => ({
        swapMode: null,
        teams: {
          ...s.teams,
          [assignedTeam]: s.teams[assignedTeam].map((p) => (p.id === incoming.id ? assignedPlayer : p)),
        },
        bench: s.bench.map((b) => (b.id === assignedPlayer.id ? incoming : b)),
      }));
    });
  },

  setSuggestion: (suggestion) => set({ suggestion }),

  setSwapMode: (swapMode) => set({ swapMode }),

  pushUndo: (message, undo) => {
    if (undoTimer) clearTimeout(undoTimer);
    set({ undoToast: { key: Date.now(), message, undo } });
    undoTimer = setTimeout(() => set({ undoToast: null }), 4500);
  },

  commitUndo: async () => {
    const toast = get().undoToast;
    if (!toast) return;
    if (undoTimer) clearTimeout(undoTimer);
    set({ undoToast: null });
    await toast.undo();
  },

  dismissUndo: () => {
    if (undoTimer) clearTimeout(undoTimer);
    set({ undoToast: null });
  },
}));
