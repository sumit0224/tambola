export function TicketCell({ value, marked }: { value: number | null; marked: boolean }) {
  const className = value === null ? "ticket-cell ticket-cell-empty" : marked ? "ticket-cell ticket-cell-marked" : "ticket-cell";

  return <div className={className}>{value ?? ""}</div>;
}
