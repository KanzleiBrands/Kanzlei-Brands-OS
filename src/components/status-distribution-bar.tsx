export function StatusDistributionBar({ segments }: { segments: { name: string; color: string; count: number }[] }) {
  const total = segments.reduce((sum, s) => sum + s.count, 0);
  if (total === 0) {
    return <p className="text-sm text-muted-foreground">Noch keine Kontakte.</p>;
  }

  return (
    <div>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
        {segments.map((s) => (
          <div
            key={s.name}
            style={{ width: `${(s.count / total) * 100}%`, backgroundColor: s.color }}
            title={`${s.name}: ${s.count}`}
          />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {segments.map((s) => (
          <span key={s.name} className="flex items-center gap-1.5">
            <span className="inline-block size-2 rounded-full" style={{ backgroundColor: s.color }} />
            {s.name} <span className="font-semibold">{s.count}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
