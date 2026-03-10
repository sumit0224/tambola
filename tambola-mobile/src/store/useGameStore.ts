import { create } from "zustand";
import type { ClaimType } from "../services/api";

export type GameStatus = "IDLE" | "LOBBY" | "ACTIVE" | "ENDED";

export type RoomPlayer = {
  userId: string;
  displayName: string;
};

export type Winner = {
  claimType: ClaimType;
  winner: {
    userId: string;
    displayName: string;
  };
};

type GameStore = {
  roomId: string | null;
  roomCode: string | null;
  players: RoomPlayer[];
  ticket: (number | null)[][] | null;
  calledNumbers: number[];
  winners: Winner[];
  gameStatus: GameStatus;
  lastCalledNumber: number | null;
  recentRooms: Array<{ roomId: string; roomCode?: string }>;
  setRoomContext: (input: { roomId: string; roomCode?: string }) => void;
  setPlayers: (players: RoomPlayer[]) => void;
  addOrUpdatePlayer: (player: RoomPlayer) => void;
  removePlayer: (userId: string) => void;
  setTicket: (grid: (number | null)[][]) => void;
  addCalledNumber: (number: number) => void;
  setCalledNumbers: (numbers: number[]) => void;
  setWinners: (winners: Winner[]) => void;
  addWinner: (winner: Winner) => void;
  setGameStatus: (status: GameStatus) => void;
  hydrateReconnect: (payload: { calledNumbers?: number[]; winners?: Winner[]; ticket?: { grid: (number | null)[][] } }) => void;
  resetRoom: () => void;
};

export const useGameStore = create<GameStore>((set, get) => ({
  roomId: null,
  roomCode: null,
  players: [],
  ticket: null,
  calledNumbers: [],
  winners: [],
  gameStatus: "IDLE",
  lastCalledNumber: null,
  recentRooms: [],

  setRoomContext: ({ roomId, roomCode }) => {
    const recentRooms = get().recentRooms.filter((entry) => entry.roomId !== roomId);
    set({
      roomId,
      roomCode: roomCode ?? get().roomCode,
      gameStatus: "LOBBY",
      recentRooms: [{ roomId, roomCode }, ...recentRooms].slice(0, 10)
    });
  },

  setPlayers: (players) => set({ players }),

  addOrUpdatePlayer: (player) =>
    set((state) => {
      const exists = state.players.find((entry) => entry.userId === player.userId);
      if (!exists) {
        return { players: [...state.players, player] };
      }

      return {
        players: state.players.map((entry) => (entry.userId === player.userId ? player : entry))
      };
    }),

  removePlayer: (userId) =>
    set((state) => ({ players: state.players.filter((player) => player.userId !== userId) })),

  setTicket: (grid) => set({ ticket: grid }),

  addCalledNumber: (number) =>
    set((state) => {
      if (state.calledNumbers.includes(number)) {
        return state;
      }

      return {
        calledNumbers: [...state.calledNumbers, number],
        lastCalledNumber: number
      };
    }),

  setCalledNumbers: (numbers) =>
    set({
      calledNumbers: numbers,
      lastCalledNumber: numbers[numbers.length - 1] ?? null
    }),

  setWinners: (winners) => set({ winners }),

  addWinner: (winner) =>
    set((state) => {
      const withoutCurrent = state.winners.filter((entry) => entry.claimType !== winner.claimType);
      return { winners: [...withoutCurrent, winner] };
    }),

  setGameStatus: (status) => set({ gameStatus: status }),

  hydrateReconnect: (payload) =>
    set((state) => ({
      calledNumbers: payload.calledNumbers ?? state.calledNumbers,
      lastCalledNumber: (payload.calledNumbers ?? state.calledNumbers).at(-1) ?? null,
      winners: payload.winners ?? state.winners,
      ticket: payload.ticket?.grid ?? state.ticket
    })),

  resetRoom: () =>
    set({
      roomId: null,
      roomCode: null,
      players: [],
      ticket: null,
      calledNumbers: [],
      winners: [],
      gameStatus: "IDLE",
      lastCalledNumber: null
    })
}));
