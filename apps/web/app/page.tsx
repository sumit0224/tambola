"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { ProtectedLayout } from "../components/Layout/ProtectedLayout";
import { createRoom, joinRoom } from "../lib/api";
import { getSession, type ClientSession } from "../lib/session";

export default function HomePage() {
  const router = useRouter();
  const [session, setSession] = useState<ClientSession | null>(null);
  const [roomCode, setRoomCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSession(getSession());
  }, []);

  async function handleQuickCreate() {
    if (!session) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const room = await createRoom(session, {
        maxPlayers: 50,
        callInterval: 5,
        prizes: ["TOP_ROW", "MIDDLE_ROW", "BOTTOM_ROW", "EARLY_FIVE", "FULL_HOUSE"]
      });

      router.push(`/rooms/${room.roomId}?code=${room.roomCode}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create room");
    } finally {
      setLoading(false);
    }
  }

  async function handleJoinSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!session) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const joined = await joinRoom(session, roomCode.trim().toUpperCase());
      router.push(`/rooms/${joined.roomId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to join room");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ProtectedLayout>
      <main className="container">
        <section className="hero">
          <p className="eyebrow">Real-Time Multiplayer</p>
          <h1>Tambola Control Deck</h1>
          <p>
            Spin up rooms, share 6-character codes, and run live number calls with synchronized winner announcements.
          </p>
        </section>

        <section className="panel">
          <div className="panel-header">
            <h2>Player Session</h2>
          </div>
          <p>
            Signed in as <strong>{session?.displayName ?? "-"}</strong> ({session?.userId ?? "-"})
          </p>
        </section>

        <section className="grid two-col">
          <section className="panel">
            <div className="panel-header">
              <h2>Create Room</h2>
            </div>
            <p>Start quickly with defaults or use advanced config.</p>
            <div className="action-row">
              <button type="button" className="btn" onClick={handleQuickCreate} disabled={loading || !session}>
                {loading ? "Creating..." : "Quick Create"}
              </button>
            </div>
          </section>

          <section className="panel">
            <div className="panel-header">
              <h2>Join Room</h2>
            </div>
            <form onSubmit={handleJoinSubmit} className="form-stack">
              <label htmlFor="roomCode">Room Code</label>
              <input
                id="roomCode"
                placeholder="AB3X7Q"
                value={roomCode}
                onChange={(event) => setRoomCode(event.target.value.toUpperCase())}
                maxLength={6}
                required
              />
              <button type="submit" className="btn" disabled={loading || roomCode.length !== 6 || !session}>
                {loading ? "Joining..." : "Join"}
              </button>
            </form>
          </section>
        </section>

        {error ? <p className="error-text">{error}</p> : null}
      </main>
    </ProtectedLayout>
  );
}
