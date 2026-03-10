import { TicketCell } from "./TicketCell";

export function TicketGrid({ grid, calledNumbers }: { grid: (number | null)[][]; calledNumbers: number[] }) {
  const calledSet = new Set(calledNumbers);

  return (
    <section className="panel">
      <div className="panel-header">
        <h2>My Ticket</h2>
      </div>
      <div className="ticket-grid">
        {grid.flat().map((value, idx) => (
          <TicketCell key={idx} value={value} marked={value !== null && calledSet.has(value)} />
        ))}
      </div>
    </section>
  );
}
