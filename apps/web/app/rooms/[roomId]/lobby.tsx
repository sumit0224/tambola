export function LobbyView({ roomId }: { roomId: string }) {
  return (
    <section>
      <h2>Lobby</h2>
      <p>Waiting for host to start room {roomId}.</p>
    </section>
  );
}
