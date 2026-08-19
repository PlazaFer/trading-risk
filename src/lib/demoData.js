/**
 * Sample data generator.
 *
 * Purely for evaluating the app with a populated journal — it is opt-in from
 * Settings and every record it creates is removable with "Borrar journal
 * local". The numbers are shaped like a real, imperfect MNQ account: a
 * positive but noisy edge, a losing streak in the middle, a couple of
 * oversized losses on days the plan was ignored.
 */

import { deriveTrade } from './calc.js'
import { zonedToUtc, EXCHANGE_TZ, keyFromDate } from './time.js'

const SETUPS = [
  'Opening Range Breakout',
  'Barrido de liquidez',
  'Order Block',
  'FVG / Imbalance',
  'Retest de ruptura',
  'Reversión a VWAP',
]

const TAGS = ['A+', 'Tendencia clara', 'Rango', 'Alta volatilidad', 'Setup B']
const MISTAKES = [
  'Entrada tardía / FOMO',
  'Moví el stop loss',
  'Salí antes de tiempo',
  'Overtrading',
  'Revenge trade',
  'Demasiados contratos',
]
const EMOTIONS = ['calm', 'focused', 'confident', 'anxious', 'fomo', 'frustrated', 'impatient']

// Entry times cluster in the NY morning, the way an index-futures day does,
// with the occasional London-session and pre-market trade for variety.
const ENTRY_TIMES = ['09:34', '09:47', '10:02', '10:18', '10:41', '11:05', '13:47', '14:22', '15:06']
const EARLY_TIMES = ['04:15', '05:40', '08:12', '09:05']

let seed = 20260819

/**
 * Deterministic PRNG (mulberry32) so the sample set is identical on every run.
 *
 * A plain LCG was tried first and produced a 67% win rate from a 44% draw:
 * the loop consumes a near-constant number of values per trade, and an LCG's
 * lattice structure at a fixed stride is exactly the case it fails. Mulberry32
 * passes those correlations and costs the same four lines.
 */
function rand() {
  seed = (seed + 0x6d2b79f5) | 0
  let t = seed
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

const pick = (arr) => arr[Math.floor(rand() * arr.length)]
const between = (min, max) => min + rand() * (max - min)
const round2 = (n) => Math.round(n * 100) / 100

export function generateDemoTrades(settings, days = 45) {
  const trades = []
  const today = new Date()
  let price = 20150

  for (let d = days; d >= 0; d -= 1) {
    const date = new Date(today)
    date.setDate(date.getDate() - d)

    const weekday = date.getDay()
    if (weekday === 0 || weekday === 6) continue // futures weekend
    if (rand() < 0.22) continue // days off — nobody trades every session

    const dayKey = keyFromDate(date)
    const tradesToday = 1 + Math.floor(rand() * 3)

    // Index drift, so entry prices look like a real chart over two months.
    price += between(-160, 190)

    for (let i = 0; i < tradesToday; i += 1) {
      const symbol = rand() < 0.78 ? 'MNQ' : 'NQ'
      const contracts = symbol === 'MNQ' ? 1 + Math.floor(rand() * 3) : 1
      const direction = rand() < 0.55 ? 'Long' : 'Short'
      const long = direction === 'Long'

      const entry = Math.round((price + between(-45, 45)) * 4) / 4
      const stopDistance = Math.round(between(12, 26) * 4) / 4
      const stop = Math.round((long ? entry - stopDistance : entry + stopDistance) * 4) / 4
      const targetDistance = stopDistance * between(1.6, 3.2)
      const target = Math.round((long ? entry + targetDistance : entry - targetDistance) * 4) / 4

      // ~44% win rate carried by a payoff above 2:1 — a realistic profile
      // for a breakout trader on the Nasdaq.
      const won = rand() < 0.44
      const scratched = !won && rand() < 0.16

      let moveDistance
      if (won) moveDistance = stopDistance * between(1.2, 3.4)
      else if (scratched) moveDistance = between(-2, 3)
      else moveDistance = -stopDistance * between(0.75, 1.35)

      const exit = Math.round((long ? entry + moveDistance : entry - moveDistance) * 4) / 4

      const brokePlan = !won && rand() < 0.34
      const mistakes = brokePlan ? [pick(MISTAKES)] : rand() < 0.12 ? [pick(MISTAKES)] : []

      const time =
        rand() < 0.18
          ? pick(EARLY_TIMES)
          : ENTRY_TIMES[Math.min(i * 3 + Math.floor(rand() * 3), ENTRY_TIMES.length - 1)]
      const entryAt = zonedToUtc(`${dayKey}T${time}`, EXCHANGE_TZ)
      const holdMinutes = won ? between(14, 75) : between(5, 28)
      const exitAt = new Date(entryAt.getTime() + holdMinutes * 60000)

      // A third of the sample is logged the way many traders actually work:
      // net result copied from the broker, with the R:R used alongside it.
      // That exercises the R:R-derived risk path as well as the price path.
      // Only trades that resolved cleanly at target or at stop are logged in
      // manual mode: a scratch has no meaningful R:R to back-solve a risk from,
      // and inventing one would misrepresent what the feature does.
      const manual = !scratched && rand() < 0.34
      const grossPoints = long ? exit - entry : entry - exit
      const manualNet = round2(grossPoints * (symbol === 'MNQ' ? 2 : 20) * contracts - contracts * 1.34)
      const rrUsed = round2(targetDistance / stopDistance)

      trades.push(
        deriveTrade(
          {
            id: crypto.randomUUID(),
            symbol,
            direction,
            contracts,
            ...(manual
              ? { pnl_mode: 'manual', net_pnl: manualNet, rr_ratio: rrUsed }
              : {
                  pnl_mode: 'prices',
                  entry_price: entry,
                  exit_price: exit,
                  stop_price: stop,
                  target_price: target,
                }),
            entry_at: entryAt.toISOString(),
            exit_at: exitAt.toISOString(),
            setup: pick(SETUPS),
            tags: rand() < 0.6 ? [pick(TAGS)] : [],
            mistakes,
            emotion: won ? pick(['calm', 'focused', 'confident']) : pick(EMOTIONS),
            rating: won ? 3 + Math.floor(rand() * 3) : brokePlan ? 1 : 2 + Math.floor(rand() * 3),
            followed_plan: !brokePlan,
            notes: won
              ? 'Entrada en el retest del nivel, dejé correr hasta el objetivo parcial.'
              : brokePlan
                ? 'Entré sin confirmación por no querer perderme el movimiento. Se dio vuelta enseguida.'
                : 'Setup válido pero el mercado no acompañó. Stop respetado.',
            images: [],
            created_at: entryAt.toISOString(),
          },
          settings
        )
      )
    }
  }

  return trades
}

export function generateDemoDayNotes(trades) {
  const days = [...new Set(trades.map((t) => t.day))].sort()
  return days
    .filter((_, i) => i % 3 === 0)
    .map((date) => {
      const dayTrades = trades.filter((t) => t.day === date)
      const netPnl = dayTrades.reduce((s, t) => s + t.net_pnl, 0)
      return {
        date,
        bias: rand() < 0.45 ? 'bullish' : rand() < 0.75 ? 'bearish' : 'neutral',
        mood: netPnl >= 0 ? 'focused' : 'frustrated',
        discipline: netPnl >= 0 ? 4 : 2,
        plan: 'Marcar el rango asiático y los máximos/mínimos previos. Operar solo tras el barrido.',
        review:
          netPnl >= 0
            ? 'El mercado respetó el nivel y dio el movimiento esperado. Ejecución limpia.'
            : 'Choppy toda la mañana. Forcé entradas en un rango que no daba continuación.',
        lessons:
          netPnl >= 0
            ? 'Cuando el setup es claro, esperar el retest paga.'
            : 'Si a las 11:00 no hay dirección, cerrar la plataforma.',
        images: [],
      }
    })
}
