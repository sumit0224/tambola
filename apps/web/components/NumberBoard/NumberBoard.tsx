export function NumberBoard({ calledNumbers }: { calledNumbers: number[] }) {
  const calledSet = new Set(calledNumbers);
  const lastCalled = calledNumbers[calledNumbers.length - 1] ?? null;

  return (
    <section className="panel">
      <div className="panel-header">
        <h2>Number Board</h2>
        <div className="pill">Calls: {calledNumbers.length}</div>
      </div>

      <div className="last-called">{lastCalled === null ? "--" : String(lastCalled).padStart(2, "0")}</div>

      <div className="number-grid">
        {Array.from({ length: 90 }, (_, idx) => idx + 1).map((number) => (
          <div key={number} className={calledSet.has(number) ? "number-cell number-cell-called" : "number-cell"}>
            {number}
          </div>
        ))}
      </div>
    </section>
  );
}
