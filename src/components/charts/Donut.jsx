/**
 * Proportional donut with a value parked in the hole.
 *
 * Pie charts are usually the wrong answer, but "how did my trades split
 * between long and short" is the one question they answer well: two or three
 * slices of one whole, where the reader wants the ratio and not the exact
 * counts. Anything with more categories goes to PerformanceList instead.
 */
export default function Donut({ slices = [], size = 168, thickness = 22, centerValue, centerLabel }) {
  const data = slices.filter((s) => Number(s.value) > 0)
  const total = data.reduce((s, d) => s + Number(d.value), 0)
  if (!total) return null

  const r = (size - thickness) / 2
  const circumference = 2 * Math.PI * r
  let offset = 0

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          {data.map((d) => {
            const share = Number(d.value) / total
            const dash = share * circumference
            const el = (
              <circle
                key={d.key}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={d.color}
                strokeWidth={thickness}
                // A hair of separation reads as distinct slices without a
                // stroke gap that lies about the proportions.
                strokeDasharray={`${Math.max(dash - 2, 0)} ${circumference - Math.max(dash - 2, 0)}`}
                strokeDashoffset={-offset}
                strokeLinecap="butt"
              />
            )
            offset += dash
            return el
          })}
        </svg>

        <div className="absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="tnum font-display text-xl font-bold text-ink">{centerValue}</p>
            {centerLabel && <p className="mt-0.5 text-[10px] text-ink-faint">{centerLabel}</p>}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
        {data.map((d) => (
          <span key={d.key} className="flex items-center gap-1.5 text-[11px] text-ink-soft">
            <span className="h-2 w-2 rounded-full" style={{ background: d.color }} />
            {d.label}
            <span className="tnum font-medium text-ink">
              {((Number(d.value) / total) * 100).toFixed(1)}%
            </span>
          </span>
        ))}
      </div>
    </div>
  )
}
