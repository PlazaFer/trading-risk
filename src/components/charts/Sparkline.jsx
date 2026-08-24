import { useId } from 'react'

/**
 * A trend line with no axes, no labels and no tooltip.
 *
 * Hand-drawn SVG rather than a charting library: at 40px tall a Recharts
 * instance costs a container observer and a re-render on every resize to
 * draw eleven pixels of information. The card it sits in already carries the
 * numbers — this only has to say "rising" or "sagging".
 */
export default function Sparkline({ values = [], color = 'currentColor', height = 52, fill = true }) {
  // React's useId emits colons, which are legal in an id but break the
  // `url(#…)` reference in some engines. Strip them.
  const id = useId().replace(/[^a-zA-Z0-9]/g, '')
  const points = values.filter((v) => Number.isFinite(Number(v))).map(Number)
  if (points.length < 2) return <div style={{ height }} />

  const W = 100
  const H = 100
  const min = Math.min(...points)
  const max = Math.max(...points)
  // A flat series would divide by zero; give it a band so it draws centred.
  const span = max - min || Math.max(Math.abs(max), 1)
  const pad = span * 0.15

  const x = (i) => (i / (points.length - 1)) * W
  const y = (v) => H - ((v - (min - pad)) / (span + pad * 2)) * H

  const line = points.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(2)},${y(v).toFixed(2)}`).join(' ')
  const area = `${line} L${W},${H} L0,${H} Z`

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      style={{ height }}
      className="w-full overflow-visible"
      aria-hidden
    >
      {fill && (
        <>
          <defs>
            <linearGradient id={`spark-${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.28} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <path d={area} fill={`url(#spark-${id})`} />
        </>
      )}
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth={2}
        vectorEffect="non-scaling-stroke"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={x(points.length - 1)}
        cy={y(points[points.length - 1])}
        r={2.5}
        fill={color}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}
