import type { Winner } from "../../types/game";

export function WinnerBanner({ winners }: { winners: Winner[] }) {
  if (!winners.length) {
    return null;
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <h2>Winners</h2>
      </div>
      <div className="winner-list">
        {winners.map((entry) => (
          <div key={entry.claimType} className="winner-item">
            <span className="winner-claim">{entry.claimType.replace("_", " ")}</span>
            <strong>{entry.winner.displayName}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}
