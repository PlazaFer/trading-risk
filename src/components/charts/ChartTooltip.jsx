/** Shared tooltip shell so every chart in the app reads the same way. */
export default function ChartTooltip({ title, rows = [], footer }) {
  return (
    <div className="pointer-events-none rounded-lg border border-line bg-bg-card px-3 py-2 shadow-pop">
      {title && <p className="mb-1.5 text-[11px] font-medium text-ink-soft">{title}</p>}
      <div className="space-y-0.5">
        {rows.map((row, i) => (
          <div key={i} className="flex items-center justify-between gap-6 text-xs">
            <span className="text-ink-soft">{row.label}</span>
            <span className={`tnum font-semibold ${row.className || 'text-ink'}`}>{row.value}</span>
          </div>
        ))}
      </div>
      {footer && <p className="mt-1.5 border-t border-line pt-1.5 text-[11px] text-ink-faint">{footer}</p>}
    </div>
  )
}
