import { percent, pnl, pnlText } from '../../lib/format.js'
import { SESSION_BY_ID, sessionRange } from '../../lib/time.js'

/**
 * Results by half hour of the trading day, grouped under the session each
 * slot belongs to.
 *
 * Drawn as grouped rows rather than as a forty-eight bar chart on purpose.
 * The question is "which half hour should I stop taking entries in", and the
 * answer has to be readable as a label — `10:00–10:30` — not inferred from a
 * tick position. Grouping under the session keeps the two levels of the same
 * question together: the session is the habit, the slot is the evidence.
 *
 * Slots run from the Globex open (18:00 ET), so Asia stays contiguous instead
 * of being split across midnight.
 */
export default function IntradayProfile({ profile, onSelect }) {
  const slots = profile?.slots ?? []
  if (!slots.length) {
    return (
      <p className="py-12 text-center text-xs text-ink-faint">
        Sin trades con hora de entrada registrada.
      </p>
    )
  }

  // Consecutive slots of the same session become one group. Built by walking
  // the list rather than by bucketing, so the clock order is preserved.
  const groups = []
  for (const slot of slots) {
    const last = groups[groups.length - 1]
    if (last && last.session === slot.session) last.slots.push(slot)
    else groups.push({ session: slot.session, slots: [slot] })
  }

  const scale = Math.max(...slots.map((s) => Math.abs(s.netPnl)), 1)

  return (
    <div className="space-y-4">
      {groups.map((group) => {
        const session = SESSION_BY_ID[group.session]
        const total = group.slots.reduce((s, x) => s + x.netPnl, 0)
        const count = group.slots.reduce((s, x) => s + x.count, 0)

        return (
          <div key={`${group.session}-${group.slots[0].key}`}>
            <header className="mb-1.5 flex items-baseline justify-between gap-3 border-b border-line pb-1">
              <span className="flex items-baseline gap-2">
                <span className="text-[11px] font-semibold text-ink">
                  {session?.label ?? group.session}
                </span>
                <span className="tnum text-[10px] text-ink-faint">
                  {sessionRange(group.session)} ET
                </span>
              </span>
              <span className="flex items-baseline gap-2">
                <span className="text-[10px] text-ink-faint">{count} trades</span>
                <span className={`tnum text-[11px] font-semibold ${pnlText(total)}`}>
                  {pnl(total)}
                </span>
              </span>
            </header>

            <div className="space-y-0.5">
              {group.slots.map((slot) => (
                <SlotRow key={slot.key} slot={slot} scale={scale} onSelect={onSelect} />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function SlotRow({ slot, scale, onSelect }) {
  const empty = !slot.count
  const width = (Math.abs(slot.netPnl) / scale) * 100
  const positive = slot.netPnl > 0
  const flat = slot.netPnl === 0 && slot.count > 0

  const Row = onSelect && !empty ? 'button' : 'div'

  return (
    <Row
      {...(onSelect && !empty ? { type: 'button', onClick: () => onSelect(slot) } : {})}
      className={`flex w-full items-center gap-2.5 rounded px-1 py-0.5 text-left ${
        onSelect && !empty ? 'transition-colors hover:bg-bg-hover' : ''
      }`}
    >
      <span
        className={`tnum w-[4.5rem] shrink-0 text-[11px] ${
          empty ? 'text-ink-faint/40' : 'font-medium text-ink-soft'
        }`}
      >
        {slot.label}
      </span>

      {/* Bars grow rightwards from a shared left edge, with losses drawn in
          red on the same axis: at this row height a diverging axis would
          leave every bar too short to compare. */}
      <span className="relative h-4 flex-1 overflow-hidden rounded-sm bg-bg-sub/60">
        {!empty && (
          <span
            className={`absolute inset-y-0.5 left-0 rounded-sm ${
              flat ? 'bg-warning/70' : positive ? 'bg-success/70' : 'bg-danger/70'
            }`}
            style={{ width: `${Math.max(width, 1.5)}%` }}
          />
        )}
      </span>

      <span
        className={`tnum w-20 shrink-0 text-right text-[11px] font-semibold ${
          empty ? 'text-ink-faint/40' : pnlText(slot.netPnl)
        }`}
      >
        {empty ? '—' : pnl(slot.netPnl)}
      </span>

      <span
        className={`tnum w-16 shrink-0 text-right text-[10px] ${
          empty ? 'text-ink-faint/40' : 'text-ink-faint'
        }`}
        title={empty ? 'Sin operar en esta franja' : `${slot.wins}G / ${slot.losses}P`}
      >
        {empty ? '' : `${slot.count} · ${percent(slot.winRate, { decimals: 0 })}`}
      </span>
    </Row>
  )
}
