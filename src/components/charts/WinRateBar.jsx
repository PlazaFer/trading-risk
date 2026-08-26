import { percent } from '../../lib/format.js'

/** Wins / breakeven / losses as one proportional bar. */
export default function WinRateBar({ wins = 0, losses = 0, breakeven = 0, showLegend = true }) {
  const total = wins + losses + breakeven
  if (!total) return null

  const pct = (n) => (n / total) * 100

  return (
    <div>
      <div className="flex h-2 overflow-hidden rounded-full bg-bg-sub">
        {wins > 0 && <div className="bg-success" style={{ width: `${pct(wins)}%` }} />}
        {breakeven > 0 && <div className="bg-warning" style={{ width: `${pct(breakeven)}%` }} />}
        {losses > 0 && <div className="bg-danger" style={{ width: `${pct(losses)}%` }} />}
      </div>

      {showLegend && (
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
          <span className="flex items-center gap-1.5 text-ink-soft">
            <span className="h-2 w-2 rounded-full bg-success" />
            {wins} ganadores
            <span className="tnum text-ink-faint">{percent(pct(wins), { decimals: 0 })}</span>
          </span>
          {breakeven > 0 && (
            <span className="flex items-center gap-1.5 text-ink-soft">
              <span className="h-2 w-2 rounded-full bg-warning" />
              {breakeven} BE
              <span className="tnum text-ink-faint">{percent(pct(breakeven), { decimals: 0 })}</span>
            </span>
          )}
          <span className="flex items-center gap-1.5 text-ink-soft">
            <span className="h-2 w-2 rounded-full bg-danger" />
            {losses} perdedores
            <span className="tnum text-ink-faint">{percent(pct(losses), { decimals: 0 })}</span>
          </span>
        </div>
      )}
    </div>
  )
}
