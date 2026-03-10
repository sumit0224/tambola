"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import { AuthLoading } from "../../../components/Common/AuthLoading";
import { ProtectedLayout } from "../../../components/Layout/ProtectedLayout";
import { NumberBoard } from "../../../components/NumberBoard/NumberBoard";
import { TicketGrid } from "../../../components/Ticket/TicketGrid";
import { WinnerBanner } from "../../../components/WinnerBanner/WinnerBanner";
import { claimPrize, getMyTicket, getRoomState, startGame } from "../../../lib/api";
import { getSession, type ClientSession } from "../../../lib/session";
import { createSocket, disconnectSocket } from "../../../lib/socket";
import {
  playGameStartSound,
  playNumberAnnouncementSound,
  playWinnerAnnouncementSound,
  unlockAnnouncementAudio
} from "../../../lib/sound";
import { claimTypes, type ClaimType, type Winner } from "../../../types/game";

const emptyGrid: (number | null)[][] = [
  Array(9).fill(null),
  Array(9).fill(null),
  Array(9).fill(null)
];

export default function RoomPage() {
  const params = useParams<{ roomId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const roomId = params.roomId;

  const socketRef = useRef<Socket | null>(null);
  const soundEnabledRef = useRef(true);

  const [session, setSession] = useState<ClientSession | null>(null);
  const [roomCode, setRoomCode] = useState(searchParams.get("code") ?? "");
  const [status, setStatus] = useState<"LOBBY" | "ACTIVE" | "ENDED" | "LOADING">("LOADING");
  const [players, setPlayers] = useState<Array<{ userId: string; displayName: string }>>([]);
  const [calledNumbers, setCalledNumbers] = useState<number[]>([]);
  const [winners, setWinners] = useState<Winner[]>([]);
  const [ticket, setTicket] = useState<(number | null)[][]>(emptyGrid);
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  useEffect(() => {
    setSession(getSession());
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const stored = window.localStorage.getItem("tambola.sound.enabled");
    if (stored === "false") {
      setSoundEnabled(false);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem("tambola.sound.enabled", soundEnabled ? "true" : "false");
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  useEffect(() => {
    if (!session) {
      return;
    }

    let mounted = true;

    getRoomState(roomId)
      .then((roomState) => {
        if (!mounted) {
          return;
        }

        setStatus(roomState.status);
        setCalledNumbers(roomState.calledNumbers);
        setWinners(roomState.winners);
      })
      .catch(() => {
        if (!mounted) {
          return;
        }

        setError("Failed to load room state");
      });

    getMyTicket(session, roomId)
      .then((result) => {
        if (!mounted) {
          return;
        }

        setTicket(result.grid);
      })
      .catch(() => {
        // Ticket may not exist before game starts.
      });

    const socket = createSocket(session.token, session.displayName);
    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("join-room", { roomId });
    });

    socket.on("room-joined", (payload) => {
      if (!mounted) {
        return;
      }

      if (payload.roomCode) {
        setRoomCode(payload.roomCode);
      }

      if (payload.status) {
        setStatus(payload.status);
      }

      if (Array.isArray(payload.players)) {
        setPlayers(payload.players);
      }

      setInfo(`Connected to room ${payload.roomId}`);
    });

    socket.on("reconnect-state", (payload) => {
      if (!mounted) {
        return;
      }

      setCalledNumbers(Array.isArray(payload.calledNumbers) ? payload.calledNumbers : []);
      setWinners(Array.isArray(payload.winners) ? payload.winners : []);
      if (payload.ticket?.grid) {
        setTicket(payload.ticket.grid);
      }
      setInfo("Recovered latest room state");
    });

    socket.on("player-joined", (payload) => {
      if (!mounted) {
        return;
      }

      setPlayers((prev) => {
        const exists = prev.some((player) => player.userId === payload.userId);
        if (exists) {
          return prev;
        }

        return [...prev, { userId: payload.userId, displayName: payload.displayName }];
      });
    });

    socket.on("player-left", (payload) => {
      if (!mounted) {
        return;
      }

      setPlayers((prev) => prev.filter((player) => player.userId !== payload.userId));
    });

    socket.on("game-started", (payload) => {
      if (!mounted) {
        return;
      }

      setStatus("ACTIVE");
      setInfo(`Game started at ${new Date(payload.startedAt).toLocaleTimeString()}`);

      if (soundEnabledRef.current) {
        void playGameStartSound();
      }
    });

    socket.on("ticket-assigned", (payload) => {
      if (!mounted) {
        return;
      }

      if (payload.grid) {
        setTicket(payload.grid);
      }
    });

    socket.on("number-called", (payload) => {
      if (!mounted) {
        return;
      }

      setCalledNumbers((prev) => {
        if (prev.includes(payload.number)) {
          return prev;
        }

        return [...prev, payload.number];
      });

      if (soundEnabledRef.current) {
        void playNumberAnnouncementSound(payload.number);
      }
    });

    socket.on("winner-announced", (payload) => {
      if (!mounted) {
        return;
      }

      setWinners((prev) => {
        const rest = prev.filter((item) => item.claimType !== payload.claimType);
        return [...rest, payload];
      });

      setInfo(`${payload.winner.displayName} won ${payload.claimType}`);

      if (soundEnabledRef.current) {
        void playWinnerAnnouncementSound();
      }
    });

    socket.on("game-ended", (payload) => {
      if (!mounted) {
        return;
      }

      setStatus("ENDED");
      if (Array.isArray(payload.winners)) {
        setWinners(payload.winners);
      }
      setInfo(`Game ended: ${payload.reason}`);

      if (soundEnabledRef.current) {
        void playWinnerAnnouncementSound();
      }
    });

    socket.on("error", (payload) => {
      if (!mounted) {
        return;
      }

      setError(payload?.code ? String(payload.code) : "Socket error");
    });

    const pingTimer = window.setInterval(() => {
      socket.emit("ping-presence", { roomId });
    }, 15_000);

    return () => {
      mounted = false;
      window.clearInterval(pingTimer);
      socket.emit("leave-room", { roomId });
      socket.off("room-joined");
      socket.off("reconnect-state");
      socket.off("player-joined");
      socket.off("player-left");
      socket.off("game-started");
      socket.off("ticket-assigned");
      socket.off("number-called");
      socket.off("winner-announced");
      socket.off("game-ended");
      socket.off("error");
      disconnectSocket();
      socketRef.current = null;
    };
  }, [roomId, session]);

  async function handleStartGame() {
    if (!session) {
      return;
    }

    await unlockAnnouncementAudio();

    setStarting(true);
    setError(null);

    try {
      const result = await startGame(session, roomId);
      setStatus("ACTIVE");
      setInfo(`Game started with ${result.totalPlayers} players`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to start game");
    } finally {
      setStarting(false);
    }
  }

  async function handleClaim(claimType: ClaimType) {
    if (!session) {
      return;
    }

    await unlockAnnouncementAudio();

    setError(null);

    try {
      const result = await claimPrize(session, roomId, claimType);
      setInfo(`${result.winner.displayName} won ${result.prize}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Claim failed");
    }
  }

  if (!session) {
    return <AuthLoading message="Validating your room session..." />;
  }

  return (
    <ProtectedLayout>
      <main className="container room-layout">
        <section className="panel">
          <div className="panel-header">
            <h1>Room {roomId.slice(0, 8)}</h1>
            <span className="pill">{status}</span>
          </div>

          <div className="stats-row">
            <span>
              Code: <strong>{roomCode || "Pending"}</strong>
            </span>
            <span>
              Players: <strong>{players.length}</strong>
            </span>
            <span>
              Calls: <strong>{calledNumbers.length}</strong>
            </span>
          </div>

          <div className="action-row">
            <button type="button" className="btn" disabled={status !== "LOBBY" || starting} onClick={handleStartGame}>
              {starting ? "Starting..." : "Start Game"}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={async () => {
                const next = !soundEnabled;
                setSoundEnabled(next);
                if (next) {
                  await unlockAnnouncementAudio();
                  void playGameStartSound();
                }
              }}
            >
              {soundEnabled ? "Sound: On" : "Sound: Off"}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => router.push("/")}>
              Back to Dashboard
            </button>
          </div>
        </section>

        {info ? <p className="success-text">{info}</p> : null}
        {error ? <p className="error-text">{error}</p> : null}

        <section className="grid room-grid">
          <NumberBoard calledNumbers={calledNumbers} />
          <TicketGrid grid={ticket} calledNumbers={calledNumbers} />
        </section>

        <WinnerBanner winners={winners} />

        <section className="panel">
          <div className="panel-header">
            <h2>Claims</h2>
          </div>
          <div className="claim-grid">
            {claimTypes.map((claimType) => (
              <button
                key={claimType}
                type="button"
                className="btn btn-secondary"
                disabled={status !== "ACTIVE"}
                onClick={() => handleClaim(claimType)}
              >
                Claim {claimType.replace("_", " ")}
              </button>
            ))}
          </div>
        </section>
      </main>
    </ProtectedLayout>
  );
}
