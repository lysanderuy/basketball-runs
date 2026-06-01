"use client";

import React, { createContext, useContext, useReducer, ReactNode } from "react";

// Types
export interface Player {
  id: string;
  name: string;
  games: number;
  section: "court" | "next" | "waiting";
  out: boolean;
}

export interface Run {
  id: string;
  name: string;
  location: string;
  format: "winner-stays" | "rotation";
  scoreGoal: number;
  timeLimit?: number;
  code: string;
}

export interface Game {
  id: number;
  scoreA: number;
  scoreB: number;
  clockSeconds: number;
  clockRunning: boolean;
  teamA: Player[];
  teamB: Player[];
  history: ScoreEvent[];
  finished: boolean;
}

export interface ScoreEvent {
  team: "a" | "b";
  playerId: string;
  playerName: string;
  scoreA: number;
  scoreB: number;
  timestamp: number;
}

export interface RunState {
  currentRun: Run | null;
  queue: Player[];
  currentGame: Game | null;
  pastGames: PastGame[];
}

export interface PastGame {
  id: number;
  winner: "a" | "b";
  scoreA: number;
  scoreB: number;
  duration: string;
  winnerName: string;
  playerScores: { name: string; points: number; team: "a" | "b" }[];
}

// Initial state
const initialState: RunState = {
  currentRun: null,
  queue: [],
  currentGame: null,
  pastGames: [],
};

// Actions
type Action =
  | { type: "CREATE_RUN"; payload: Run }
  | { type: "JOIN_RUN"; payload: string }
  | { type: "SET_QUEUE"; payload: Player[] }
  | { type: "ADD_PLAYER"; payload: Player }
  | { type: "REMOVE_PLAYER"; payload: string }
  | { type: "REORDER_QUEUE"; payload: Player[] }
  | { type: "MOVE_PLAYER_SECTION"; payload: { playerId: string; section: "court" | "next" | "waiting" } }
  | { type: "START_GAME"; payload: { teamA: Player[]; teamB: Player[] } }
  | { type: "SCORE_POINT"; payload: { team: "a" | "b"; playerId: string; playerName: string } }
  | { type: "UNDO_SCORE" }
  | { type: "TOGGLE_CLOCK" }
  | { type: "TICK_CLOCK" }
  | { type: "END_GAME"; payload: PastGame }
  | { type: "RESET_RUN" };

// Reducer
function runReducer(state: RunState, action: Action): RunState {
  switch (action.type) {
    case "CREATE_RUN":
      return { ...state, currentRun: action.payload };

    case "JOIN_RUN":
      return {
        ...state,
        currentRun: {
          id: "run-1",
          name: "Friday Run",
          location: "Rucker Park",
          format: "winner-stays",
          scoreGoal: 21,
          code: action.payload,
        },
        queue: generateMockPlayers(),
      };

    case "SET_QUEUE":
      return { ...state, queue: action.payload };

    case "ADD_PLAYER":
      return {
        ...state,
        queue: [...state.queue, action.payload],
      };

    case "REMOVE_PLAYER":
      return {
        ...state,
        queue: state.queue.filter((p) => p.id !== action.payload),
      };

    case "REORDER_QUEUE":
      return { ...state, queue: action.payload };

    case "MOVE_PLAYER_SECTION":
      return {
        ...state,
        queue: state.queue.map((p) =>
          p.id === action.payload.playerId ? { ...p, section: action.payload.section } : p
        ),
      };

    case "START_GAME":
      return {
        ...state,
        currentGame: {
          id: state.pastGames.length + 1,
          scoreA: 0,
          scoreB: 0,
          clockSeconds: state.currentRun?.timeLimit ? state.currentRun.timeLimit * 60 : 900,
          clockRunning: false,
          teamA: action.payload.teamA,
          teamB: action.payload.teamB,
          history: [],
          finished: false,
        },
      };

    case "SCORE_POINT": {
      if (!state.currentGame) return state;
      const newScore = { ...state.currentGame };
      if (action.payload.team === "a") {
        newScore.scoreA++;
      } else {
        newScore.scoreB++;
      }
      newScore.history = [
        {
          team: action.payload.team,
          playerId: action.payload.playerId,
          playerName: action.payload.playerName,
          scoreA: newScore.scoreA,
          scoreB: newScore.scoreB,
          timestamp: Date.now(),
        },
        ...newScore.history,
      ];
      const goal = state.currentRun?.scoreGoal || 21;
      if (newScore.scoreA >= goal || newScore.scoreB >= goal) {
        newScore.finished = true;
      }
      return { ...state, currentGame: newScore };
    }

    case "UNDO_SCORE": {
      if (!state.currentGame || state.currentGame.history.length === 0) return state;
      const newGame = { ...state.currentGame };
      const lastEvent = newGame.history[0];
      newGame.history = newGame.history.slice(1);
      newGame.scoreA = lastEvent.scoreA - (lastEvent.team === "a" ? 1 : 0);
      newGame.scoreB = lastEvent.scoreB - (lastEvent.team === "b" ? 1 : 0);
      newGame.finished = false;
      return { ...state, currentGame: newGame };
    }

    case "TOGGLE_CLOCK":
      if (!state.currentGame) return state;
      return {
        ...state,
        currentGame: {
          ...state.currentGame,
          clockRunning: !state.currentGame.clockRunning,
        },
      };

    case "TICK_CLOCK":
      if (!state.currentGame || !state.currentGame.clockRunning) return state;
      if (state.currentGame.clockSeconds <= 0) return state;
      return {
        ...state,
        currentGame: {
          ...state.currentGame,
          clockSeconds: state.currentGame.clockSeconds - 1,
        },
      };

    case "END_GAME": {
      if (!state.currentGame) return state;
      return {
        ...state,
        pastGames: [action.payload, ...state.pastGames],
        currentGame: null,
      };
    }

    case "RESET_RUN":
      return initialState;

    default:
      return state;
  }
}

function generateMockPlayers(): Player[] {
  const names = ["Marcus", "Kel", "Tone", "D. Webb", "Junie", "Dre", "Ray", "Big Ty", "C. Mills", "Poke"];
  return names.map((name, i) => ({
    id: `mock-${i + 1}`,
    name,
    games: Math.floor(Math.random() * 3),
    section: i < 5 ? "court" : i < 8 ? "next" : "waiting",
    out: false,
  }));
}

// Context
const RunContext = createContext<{
  state: RunState;
  dispatch: React.Dispatch<Action>;
} | null>(null);

export function RunProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(runReducer, initialState);

  React.useEffect(() => {
    if (state.currentGame?.clockRunning) {
      const interval = setInterval(() => {
        dispatch({ type: "TICK_CLOCK" });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [state.currentGame?.clockRunning]);

  return (
    <RunContext.Provider value={{ state, dispatch }}>{children}</RunContext.Provider>
  );
}

export function useRun() {
  const context = useContext(RunContext);
  if (!context) {
    throw new Error("useRun must be used within a RunProvider");
  }
  return context;
}

export const RunActions = {
  createRun: (run: Run) => ({ type: "CREATE_RUN" as const, payload: run }),
  joinRun: (code: string) => ({ type: "JOIN_RUN" as const, payload: code }),
  setQueue: (players: Player[]) => ({ type: "SET_QUEUE" as const, payload: players }),
  addPlayer: (player: Player) => ({ type: "ADD_PLAYER" as const, payload: player }),
  removePlayer: (id: string) => ({ type: "REMOVE_PLAYER" as const, payload: id }),
  startGame: (teamA: Player[], teamB: Player[]) =>
    ({ type: "START_GAME" as const, payload: { teamA, teamB } }),
  scorePoint: (team: "a" | "b", playerId: string, playerName: string) =>
    ({ type: "SCORE_POINT" as const, payload: { team, playerId, playerName } }),
  undoScore: () => ({ type: "UNDO_SCORE" as const }),
  toggleClock: () => ({ type: "TOGGLE_CLOCK" as const }),
  endGame: (pastGame: PastGame) => ({ type: "END_GAME" as const, payload: pastGame }),
  resetRun: () => ({ type: "RESET_RUN" as const }),
};
