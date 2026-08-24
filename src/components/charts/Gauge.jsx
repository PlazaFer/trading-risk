/**
 * A single ratio drawn as a ring.
 *
 * Used for the two numbers that have a meaningful "good enough" line rather
 * than a natural maximum — profit factor and win rate. The ring encodes
 * progress toward that line, so a glance says "above water" or "not yet"
 * before the digits are read.
 */
export default function Gauge({
  value,
  max = 3,
  size = 128,
  thickness = 11,
  color,
  track,
  label,
  sublabel,
  display,
}) {
  const n = Number(value)
  const safe = Number.isFinite(n) ? Math.max(n, 0) : max
  const share = Math.min(safe / max, 1)

  const r = (size - thickness) / 2
  const circumference = 2 * Math.PI * r

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={track}
            strokeWidth={thickness}
            opacity={0.35}
          />
          {/* Skipped at zero: a zero-length arc with a round cap still
              paints a dot, which reads as a tiny nonzero value. */}
          {share > 0 && (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={color}
              strokeWidth={thickness}
              strokeLinecap="round"
              strokeDasharray={`${share * circumference} ${circumference}`}
              className="transition-[stroke-dasharray] duration-500"
            />
          )}
        </svg>
        <div className="absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="tnum font-display text-2xl font-bold leading-none text-ink">{display}</p>
            {label && <p className="mt-1 text-[10px] uppercase tracking-wider text-ink-faint">{label}</p>}
          </div>
        </div>
      </div>
      {sublabel && <p className="mt-2 text-center text-[11px] text-ink-soft">{sublabel}</p>}
    </div>
  )
}
