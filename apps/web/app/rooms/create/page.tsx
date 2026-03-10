"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { ProtectedLayout } from "../../../components/Layout/ProtectedLayout";
import { createRoom } from "../../../lib/api";
import { getSession, type ClientSession } from "../../../lib/session";
import { claimTypes, type ClaimType } from "../../../types/game";

export default function CreateRoomPage() {
  const router = useRouter();
  const [session, setSession] = useState<ClientSession | null>(null);
  const [maxPlayers, setMaxPlayers] = useState(50);
  const [callInterval, setCallInterval] = useState(5);
  const [selectedPrizes, setSelectedPrizes] = useState<ClaimType[]>([...claimTypes]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSession(getSession());
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!session) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const room = await createRoom(session, {
        maxPlayers,
        callInterval,
        prizes: selectedPrizes
      });

      router.push(`/rooms/${room.roomId}?code=${room.roomCode}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create room");
    } finally {
      setLoading(false);
    }
  }

  function togglePrize(prize: ClaimType): void {
    setSelectedPrizes((prev) => {
      if (prev.includes(prize)) {
        return prev.filter((value) => value !== prize);
      }

      return [...prev, prize];
    });
  }

  return (
    <ProtectedLayout>
      <main className="container">
        <section className="panel">
          <h1>Advanced Room Setup</h1>
          <form className="form-stack" onSubmit={handleSubmit}>
            <label htmlFor="maxPlayers">Max Players</label>
            <input
              id="maxPlayers"
              type="number"
              min={2}
              max={50}
              value={maxPlayers}
              onChange={(event) => setMaxPlayers(Number(event.target.value))}
              required
            />

            <label htmlFor="callInterval">Call Interval (seconds)</label>
            <input
              id="callInterval"
              type="number"
              min={1}
              max={30}
              value={callInterval}
              onChange={(event) => setCallInterval(Number(event.target.value))}
              required
            />

            <div>
              <label>Prize Modes</label>
              <div className="checkbox-grid">
                {claimTypes.map((prize) => (
                  <label key={prize} className="checkline">
                    <input
                      type="checkbox"
                      checked={selectedPrizes.includes(prize)}
                      onChange={() => togglePrize(prize)}
                    />
                    {prize}
                  </label>
                ))}
              </div>
            </div>

            <button type="submit" className="btn" disabled={loading || selectedPrizes.length === 0 || !session}>
              {loading ? "Creating..." : "Create Room"}
            </button>
          </form>

          {error ? <p className="error-text">{error}</p> : null}
        </section>
      </main>
    </ProtectedLayout>
  );
}
