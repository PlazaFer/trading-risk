/**
 * The calculation engine: turns raw trade input into a fully derived record,
 * and turns a set of records into the statistics a journal is actually for.
 *
 * Derived fields are stored on the trade rather than recomputed on render.
 * That keeps exports self-describing (a CSV row carries its own R-multiple)
 * and keeps tables cheap when the journal grows to thousands of rows.
 */

import { getInstrument, commissionFor } from './instruments.js'
import { sessionOf, tradingDayKey, durationMinutes, exchangeWeekday, exchangeHour, EXCHANGE_TZ } from './time.js'

export const DIRECTIONS = ['Long', 'Short']

export const OUTCOMES = {
  win: { id: 'win', label: 'Ganador', tone: 'success' },
  loss: { id: 'loss', label: 'Perdedor', tone: 'danger' },
  breakeven: { id: 'breakeven', label: 'Breakeven', tone: 'ink-soft' },
}

/**
 * Price movement in points, expressed in the trade's favor.
 * A short that fell 30 points made +30.
 */
export function signedPoints({ direction, entry_price, exit_price }) {
  const entry = Number(entry_price)
  const exit = Number(exit_price)
  if (!Number.isFinite(entry) || !Number.isFinite(exit)) return null
  const raw = exit - entry
  return direction === 'Short' ? -raw : raw
}

/**
 * Compute every derived field for a trade.
 *
 * Two entry modes are supported:
 *  - `prices`  — entry/exit prices drive P&L (the accurate path)
 *  - `manual`  — the trader types the net result straight from the broker
 *
 * Manual mode exists because a fill on a partial scale-out is often easier
 * to copy from a statement than to reconstruct from an average price.
 */
export function deriveTrade(input, settings = {}) {
  const symbol = input.symbol || 'MNQ'
  const spec = getInstrument(symbol)
  const contracts = Math.max(Number(input.contracts) || 0, 0)
  const direction = input.direction === 'Short' ? 'Short' : 'Long'
  const mode = input.pnl_mode === 'manual' ? 'manual' : 'prices'

  const pts = signedPoints({ direction, entry_price: input.entry_price, exit_price: input.exit_price })

  // Commission: explicit value wins, otherwise seed from the per-contract
  // round-turn rate so the trader is never silently trading cost-free.
  let commission = Number(input.commission)
  if (!Number.isFinite(commission) || commission < 0) {
    commission = commissionFor(symbol, settings.commissions) * contracts
  }

  let grossPnl
  let netPnl
  if (mode === 'manual') {
    netPnl = Number(input.net_pnl)
    if (!Number.isFinite(netPnl)) netPnl = 0
    grossPnl = netPnl + commission
  } else {
    grossPnl = pts === null ? 0 : pts * spec.pointValue * contracts
    netPnl = grossPnl - commission
  }

  /* ------------------------------------------------------------------
     Risk in dollars.

     Four sources, most specific first. Whichever resolves first wins, so a
     trader can be as precise or as quick as the situation allows:

       1. an explicit dollar amount typed on the trade
       2. the real stop distance, when prices were entered
       3. the R:R used, back-solved from the manual result (see below)
       4. the account-wide default from Settings

     Source 3 is the one that makes manual P&L entry viable. Given an R:R of
     1:1.5 and a +$525 result, the trade must have risked $350 — you collected
     one and a half times what you put up. A loser is different: hitting your
     stop costs exactly the 1R you risked, never 1.5R, so the loss itself IS
     the risk. Both cases land on the same $350, which is the point — risk is
     a property of the position, not of how it happened to resolve.
     ------------------------------------------------------------------ */
  const stop = Number(input.stop_price)
  const entryPrice = Number(input.entry_price)
  const rrRatio = Number(input.rr_ratio)
  const manualRisk = Number(input.manual_risk)

  let riskAmount = null
  let riskSource = null

  if (Number.isFinite(manualRisk) && manualRisk > 0) {
    riskAmount = manualRisk
    riskSource = 'manual'
  } else if (Number.isFinite(stop) && Number.isFinite(entryPrice) && contracts > 0) {
    riskAmount = Math.abs(entryPrice - stop) * spec.pointValue * contracts
    riskSource = 'stop'
  } else if (Number.isFinite(rrRatio) && rrRatio > 0 && netPnl !== 0) {
    riskAmount = netPnl > 0 ? netPnl / rrRatio : Math.abs(netPnl)
    riskSource = 'rr'
  } else if (Number(settings.defaultRiskAmount) > 0) {
    riskAmount = Number(settings.defaultRiskAmount)
    riskSource = 'default'
  }
  if (riskAmount !== null && riskAmount <= 0) {
    riskAmount = null
    riskSource = null
  }

  const rMultiple = riskAmount ? netPnl / riskAmount : null

  /**
   * Risk as a share of the capital you actually put at risk.
   *
   * Measured against `riskCapital` when set, so a trader funding a $50k prop
   * account from a larger balance sizes against the number that matters.
   */
  const riskCapital = Number(settings.riskCapital) > 0
    ? Number(settings.riskCapital)
    : Number(settings.startingBalance) || 0
  const riskPct = riskAmount && riskCapital > 0 ? (riskAmount / riskCapital) * 100 : null

  /**
   * Planned reward:risk.
   *
   * Real prices beat a typed ratio: if the stop and target are on the record,
   * they ARE the plan, and a default carried over from Settings must not
   * overwrite them. The typed ratio is the fallback for manual entry, where
   * there are no prices to read it from.
   */
  const target = Number(input.target_price)
  let plannedRR = null
  if (Number.isFinite(target) && Number.isFinite(stop) && Number.isFinite(entryPrice)) {
    const risk = Math.abs(entryPrice - stop)
    const reward = Math.abs(target - entryPrice)
    if (risk > 0) plannedRR = reward / risk
  }
  if (plannedRR === null && Number.isFinite(rrRatio) && rrRatio > 0) {
    plannedRR = rrRatio
  }

  const outcome = netPnl > 0 ? 'win' : netPnl < 0 ? 'loss' : 'breakeven'
  const entryAt = input.entry_at || null
  const exitAt = input.exit_at || null

  return {
    ...input,
    symbol,
    direction,
    contracts,
    pnl_mode: mode,
    entry_price: toNumberOrNull(input.entry_price),
    exit_price: toNumberOrNull(input.exit_price),
    stop_price: toNumberOrNull(input.stop_price),
    target_price: toNumberOrNull(input.target_price),
    commission: round(commission, 2),
    gross_pnl: round(grossPnl, 2),
    net_pnl: round(netPnl, 2),
    points: pts === null ? null : round(pts, 4),
    ticks: pts === null ? null : round(pts / spec.tickSize, 2),
    rr_ratio: Number.isFinite(rrRatio) && rrRatio > 0 ? round(rrRatio, 2) : null,
    manual_risk: Number.isFinite(manualRisk) && manualRisk > 0 ? round(manualRisk, 2) : null,
    risk_amount: riskAmount === null ? null : round(riskAmount, 2),
    risk_source: riskSource,
    risk_pct: riskPct === null ? null : round(riskPct, 4),
    r_multiple: rMultiple === null ? null : round(rMultiple, 3),
    planned_rr: plannedRR === null ? null : round(plannedRR, 2),
    outcome,
    session: input.session || sessionOf(entryAt),
    day: tradingDayKey(entryAt, {
      futuresSessionDay: settings.futuresSessionDay === true,
      timeZone: settings.timezone || EXCHANGE_TZ,
    }),
    duration_min: durationMinutes(entryAt, exitAt),
    tags: Array.isArray(input.tags) ? input.tags : [],
    mistakes: Array.isArray(input.mistakes) ? input.mistakes : [],
    images: Array.isArray(input.images) ? input.images.slice(0, 3) : [],
    rating: clampInt(input.rating, 0, 5),
    updated_at: new Date().toISOString(),
  }
}

function toNumberOrNull(v) {
  if (v === '' || v === null || v === undefined) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function clampInt(v, min, max) {
  const n = Math.round(Number(v))
  if (!Number.isFinite(n)) return 0
  return Math.min(Math.max(n, min), max)
}

export function round(value, decimals = 2) {
  const f = 10 ** decimals
  return Math.round((Number(value) + Number.EPSILON) * f) / f
}

/** Chronological order, oldest first — the order P&L accumulates in. */
export function chronological(trades) {
  return [...trades].sort((a, b) => {
    const at = new Date(a.exit_at || a.entry_at || 0).getTime()
    const bt = new Date(b.exit_at || b.entry_at || 0).getTime()
    if (at !== bt) return at - bt
    return String(a.created_at || '').localeCompare(String(b.created_at || ''))
  })
}

const EMPTY_STATS = {
  count: 0,
  wins: 0,
  losses: 0,
  breakeven: 0,
  winRate: 0,
  lossRate: 0,
  grossProfit: 0,
  grossLoss: 0,
  netPnl: 0,
  commissions: 0,
  avgWin: 0,
  avgLoss: 0,
  avgTrade: 0,
  payoff: 0,
  profitFactor: 0,
  expectancy: 0,
  expectancyR: 0,
  totalR: 0,
  largestWin: 0,
  largestLoss: 0,
  contracts: 0,
  avgContracts: 0,
  totalPoints: 0,
  avgHold: null,
  avgHoldWin: null,
  avgHoldLoss: null,
  maxWinStreak: 0,
  maxLossStreak: 0,
  currentStreak: 0,
  maxDrawdown: 0,
  maxDrawdownPct: 0,
  avgRiskPct: null,
  maxRiskPct: null,
  avgRisk: null,
  tradesWithRisk: 0,
  tradingDays: 0,
  greenDays: 0,
  redDays: 0,
  dayWinRate: 0,
  bestDay: null,
  worstDay: null,
  avgDailyPnl: 0,
  avgTradesPerDay: 0,
}

/**
 * The full statistics block for a set of trades.
 * `startingBalance` only affects percentage-based figures (drawdown %).
 */
export function computeStats(trades, { startingBalance = 0 } = {}) {
  if (!trades?.length) return { ...EMPTY_STATS }

  const ordered = chronological(trades)
  const wins = []
  const losses = []
  const breakeven = []

  let netPnl = 0
  let commissions = 0
  let contracts = 0
  let totalPoints = 0
  let totalR = 0
  let rCount = 0

  for (const t of ordered) {
    const net = Number(t.net_pnl) || 0
    netPnl += net
    commissions += Number(t.commission) || 0
    contracts += Number(t.contracts) || 0
    totalPoints += Number(t.points) || 0
    if (t.r_multiple !== null && t.r_multiple !== undefined && Number.isFinite(Number(t.r_multiple))) {
      totalR += Number(t.r_multiple)
      rCount += 1
    }
    if (net > 0) wins.push(t)
    else if (net < 0) losses.push(t)
    else breakeven.push(t)
  }

  const grossProfit = wins.reduce((s, t) => s + Number(t.net_pnl), 0)
  const grossLoss = Math.abs(losses.reduce((s, t) => s + Number(t.net_pnl), 0))

  const avgWin = wins.length ? grossProfit / wins.length : 0
  const avgLoss = losses.length ? grossLoss / losses.length : 0
  // Breakeven trades count in the denominator: they consumed a decision.
  const winRate = (wins.length / ordered.length) * 100
  const lossRate = (losses.length / ordered.length) * 100

  const profitFactorValue = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0

  const streaks = computeStreaks(ordered)
  const dd = computeDrawdown(ordered, startingBalance)
  const daily = computeDailyBreakdown(ordered)

  // Position-sizing discipline: how much of the risk capital each trade put
  // up, and whether that number stayed put.
  const riskPcts = ordered.map((t) => Number(t.risk_pct)).filter((v) => Number.isFinite(v))
  const riskAmounts = ordered.map((t) => Number(t.risk_amount)).filter((v) => Number.isFinite(v))

  const holdAll = avgOf(ordered.map((t) => t.duration_min))
  const holdWin = avgOf(wins.map((t) => t.duration_min))
  const holdLoss = avgOf(losses.map((t) => t.duration_min))

  return {
    count: ordered.length,
    wins: wins.length,
    losses: losses.length,
    breakeven: breakeven.length,
    winRate,
    lossRate,
    grossProfit,
    grossLoss,
    netPnl,
    commissions,
    avgWin,
    avgLoss,
    avgTrade: netPnl / ordered.length,
    payoff: avgLoss > 0 ? avgWin / avgLoss : avgWin > 0 ? Infinity : 0,
    profitFactor: profitFactorValue,
    // Expectancy: the dollar value of taking one more trade of this kind.
    expectancy: (winRate / 100) * avgWin - (lossRate / 100) * avgLoss,
    expectancyR: rCount ? totalR / rCount : 0,
    totalR,
    largestWin: wins.length ? Math.max(...wins.map((t) => Number(t.net_pnl))) : 0,
    largestLoss: losses.length ? Math.min(...losses.map((t) => Number(t.net_pnl))) : 0,
    contracts,
    avgContracts: contracts / ordered.length,
    totalPoints,
    avgHold: holdAll,
    avgHoldWin: holdWin,
    avgHoldLoss: holdLoss,
    avgRiskPct: riskPcts.length ? riskPcts.reduce((a, b) => a + b, 0) / riskPcts.length : null,
    maxRiskPct: riskPcts.length ? Math.max(...riskPcts) : null,
    avgRisk: riskAmounts.length ? riskAmounts.reduce((a, b) => a + b, 0) / riskAmounts.length : null,
    tradesWithRisk: riskAmounts.length,
    ...streaks,
    ...dd,
    ...daily,
  }
}

/**
 * Trades whose stored `risk_pct` no longer matches the current risk capital.
 *
 * The percentage is persisted rather than derived at render time, so that a
 * CSV row or a SQL query carries it without needing the app's settings. The
 * cost of that choice is drift: change the risk capital and every existing
 * row is stale until recalculated. This finds them so the UI can offer the fix
 * instead of quietly showing wrong numbers.
 */
export function countStaleRiskPct(trades, riskCapital) {
  const capital = Number(riskCapital) || 0
  let stale = 0

  for (const t of trades) {
    const amount = Number(t.risk_amount)
    if (!Number.isFinite(amount) || amount <= 0) continue

    const expected = capital > 0 ? (amount / capital) * 100 : null
    const stored = t.risk_pct === undefined ? null : t.risk_pct

    if (expected === null) {
      if (stored !== null) stale += 1
    } else if (stored === null || Math.abs(Number(stored) - expected) > 0.005) {
      stale += 1
    }
  }

  return stale
}

/**
 * Days where the account's own rules were broken.
 *
 * A journal that only records outcomes lets a trader forget the process. This
 * surfaces the two limits that matter most on a futures account — the daily
 * loss cap and the trade count — as concrete dates you can click through to.
 * Limits set to 0 are treated as "not configured" rather than as zero.
 */
export function computeRuleBreaks(trades, { maxDailyLoss = 0, maxTradesPerDay = 0 } = {}) {
  const lossLimit = Number(maxDailyLoss) || 0
  const countLimit = Number(maxTradesPerDay) || 0
  if (!lossLimit && !countLimit) return []

  const byDay = new Map()
  for (const t of trades) {
    if (!t.day) continue
    const b = byDay.get(t.day) || { day: t.day, netPnl: 0, count: 0 }
    b.netPnl += Number(t.net_pnl) || 0
    b.count += 1
    byDay.set(t.day, b)
  }

  const breaks = []
  for (const day of byDay.values()) {
    const reasons = []
    if (lossLimit && day.netPnl < -Math.abs(lossLimit)) {
      reasons.push({ type: 'loss', limit: Math.abs(lossLimit), actual: day.netPnl })
    }
    if (countLimit && day.count > countLimit) {
      reasons.push({ type: 'count', limit: countLimit, actual: day.count })
    }
    if (reasons.length) breaks.push({ ...day, reasons })
  }

  return breaks.sort((a, b) => b.day.localeCompare(a.day))
}

function avgOf(values) {
  const nums = values.filter((v) => Number.isFinite(Number(v))).map(Number)
  if (!nums.length) return null
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

/**
 * Longest run of wins and of losses, plus the streak currently in progress
 * (positive = winning run, negative = losing run). Breakeven trades are
 * transparent: they neither extend nor break a run.
 */
function computeStreaks(ordered) {
  let maxWin = 0
  let maxLoss = 0
  let run = 0

  for (const t of ordered) {
    const net = Number(t.net_pnl) || 0
    if (net === 0) continue
    if (net > 0) run = run > 0 ? run + 1 : 1
    else run = run < 0 ? run - 1 : -1
    if (run > maxWin) maxWin = run
    if (run < maxLoss) maxLoss = run
  }

  return { maxWinStreak: maxWin, maxLossStreak: Math.abs(maxLoss), currentStreak: run }
}

/**
 * Peak-to-trough decline of the closed-trade equity curve.
 * The percentage is measured against equity at the peak, which is the number
 * that actually matters for prop-firm drawdown rules.
 */
function computeDrawdown(ordered, startingBalance = 0) {
  let equity = startingBalance
  let peak = startingBalance
  let maxDd = 0
  let maxDdPct = 0

  for (const t of ordered) {
    equity += Number(t.net_pnl) || 0
    if (equity > peak) peak = equity
    const dd = peak - equity
    if (dd > maxDd) {
      maxDd = dd
      maxDdPct = peak > 0 ? (dd / peak) * 100 : 0
    }
  }

  return { maxDrawdown: maxDd, maxDrawdownPct: maxDdPct }
}

/** Per-trading-day aggregation — green/red day counts, best and worst day. */
function computeDailyBreakdown(ordered) {
  const byDay = new Map()
  for (const t of ordered) {
    const key = t.day
    if (!key) continue
    const bucket = byDay.get(key) || { day: key, netPnl: 0, count: 0 }
    bucket.netPnl += Number(t.net_pnl) || 0
    bucket.count += 1
    byDay.set(key, bucket)
  }

  const days = [...byDay.values()]
  if (!days.length) {
    return {
      tradingDays: 0,
      greenDays: 0,
      redDays: 0,
      dayWinRate: 0,
      bestDay: null,
      worstDay: null,
      avgDailyPnl: 0,
      avgTradesPerDay: 0,
    }
  }

  const green = days.filter((d) => d.netPnl > 0).length
  const red = days.filter((d) => d.netPnl < 0).length
  const total = days.reduce((s, d) => s + d.netPnl, 0)
  const sorted = [...days].sort((a, b) => b.netPnl - a.netPnl)

  return {
    tradingDays: days.length,
    greenDays: green,
    redDays: red,
    dayWinRate: (green / days.length) * 100,
    bestDay: sorted[0],
    worstDay: sorted[sorted.length - 1],
    avgDailyPnl: total / days.length,
    avgTradesPerDay: ordered.length / days.length,
  }
}

/**
 * Running equity after each closed trade, seeded with `startingBalance`.
 * The leading point anchors the chart so the first trade shows as a move
 * rather than as the origin.
 */
export function buildEquityCurve(trades, { startingBalance = 0 } = {}) {
  const ordered = chronological(trades)
  let equity = startingBalance
  let peak = startingBalance

  const series = [
    {
      index: 0,
      label: 'Inicio',
      equity: round(equity, 2),
      pnl: 0,
      cumulative: 0,
      drawdown: 0,
      trade: null,
    },
  ]

  ordered.forEach((t, i) => {
    const net = Number(t.net_pnl) || 0
    equity += net
    if (equity > peak) peak = equity
    series.push({
      index: i + 1,
      label: t.day || '',
      date: t.day,
      equity: round(equity, 2),
      pnl: round(net, 2),
      cumulative: round(equity - startingBalance, 2),
      drawdown: round(equity - peak, 2),
      trade: t,
    })
  })

  return series
}

/** Cumulative P&L per trading day, for the daily bar chart. */
export function buildDailySeries(trades) {
  const byDay = new Map()
  for (const t of chronological(trades)) {
    if (!t.day) continue
    const b = byDay.get(t.day) || { day: t.day, netPnl: 0, count: 0, wins: 0 }
    b.netPnl += Number(t.net_pnl) || 0
    b.count += 1
    if (Number(t.net_pnl) > 0) b.wins += 1
    byDay.set(t.day, b)
  }

  let cumulative = 0
  return [...byDay.values()]
    .sort((a, b) => a.day.localeCompare(b.day))
    .map((d) => {
      cumulative += d.netPnl
      return { ...d, netPnl: round(d.netPnl, 2), cumulative: round(cumulative, 2) }
    })
}

/**
 * Group trades by any key and summarize each bucket.
 * Powers every "performance by X" panel: setup, session, weekday, symbol, tag.
 */
export function groupPerformance(trades, keyFn, { labelFn } = {}) {
  const buckets = new Map()

  for (const t of trades) {
    const keys = keyFn(t)
    const list = Array.isArray(keys) ? keys : [keys]
    for (const key of list) {
      if (key === null || key === undefined || key === '') continue
      const b = buckets.get(key) || { key, label: labelFn ? labelFn(key) : String(key), trades: [] }
      b.trades.push(t)
      buckets.set(key, b)
    }
  }

  return [...buckets.values()]
    .map((b) => {
      const wins = b.trades.filter((t) => Number(t.net_pnl) > 0)
      const losses = b.trades.filter((t) => Number(t.net_pnl) < 0)
      const netPnl = b.trades.reduce((s, t) => s + (Number(t.net_pnl) || 0), 0)
      const grossProfit = wins.reduce((s, t) => s + Number(t.net_pnl), 0)
      const grossLoss = Math.abs(losses.reduce((s, t) => s + Number(t.net_pnl), 0))
      const rs = b.trades
        .map((t) => Number(t.r_multiple))
        .filter((r) => Number.isFinite(r))
      return {
        key: b.key,
        label: b.label,
        count: b.trades.length,
        wins: wins.length,
        losses: losses.length,
        netPnl: round(netPnl, 2),
        avgPnl: round(netPnl / b.trades.length, 2),
        winRate: (wins.length / b.trades.length) * 100,
        profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0,
        avgR: rs.length ? round(rs.reduce((a, c) => a + c, 0) / rs.length, 2) : null,
        trades: b.trades,
      }
    })
    .sort((a, b) => b.netPnl - a.netPnl)
}

/** Histogram of R-multiples, bucketed to whole R. */
export function buildRDistribution(trades) {
  const rs = trades.map((t) => Number(t.r_multiple)).filter((r) => Number.isFinite(r))
  if (!rs.length) return []

  const min = Math.floor(Math.min(...rs))
  const max = Math.ceil(Math.max(...rs))
  const buckets = []

  for (let r = Math.min(min, -3); r < Math.max(max, 3); r += 1) {
    const inBucket = rs.filter((v) => v >= r && v < r + 1).length
    buckets.push({
      bucket: r,
      label: r >= 0 ? `+${r}R` : `${r}R`,
      count: inBucket,
      positive: r >= 0,
    })
  }

  return buckets
}

export const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 0, 6]

export function weekdayPerformance(trades) {
  const groups = groupPerformance(trades, (t) => exchangeWeekday(t.entry_at))
  const order = new Map(WEEKDAY_ORDER.map((d, i) => [d, i]))
  return groups.sort((a, b) => (order.get(a.key) ?? 9) - (order.get(b.key) ?? 9))
}

export function hourPerformance(trades) {
  return groupPerformance(trades, (t) => exchangeHour(t.entry_at)).sort((a, b) => a.key - b.key)
}
