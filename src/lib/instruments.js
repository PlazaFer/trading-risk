/**
 * Futures contract specifications.
 *
 * `pointValue` is the dollar value of a 1.00 move in the underlying index,
 * per contract. `tickSize` is the minimum price increment and `tickValue`
 * is just `pointValue * tickSize` — kept explicit because that is the number
 * printed on the exchange spec sheet and the one traders sanity-check against.
 *
 * `commission` is a DEFAULT round-turn cost per contract (entry + exit).
 * Brokers differ, so it is only a seed value — Settings overrides it.
 */

export const INSTRUMENTS = {
  MNQ: {
    symbol: 'MNQ',
    name: 'Micro E-mini Nasdaq-100',
    group: 'Nasdaq 100',
    tickSize: 0.25,
    pointValue: 2,
    commission: 1.34,
    decimals: 2,
    exchange: 'CME',
  },
  NQ: {
    symbol: 'NQ',
    name: 'E-mini Nasdaq-100',
    group: 'Nasdaq 100',
    tickSize: 0.25,
    pointValue: 20,
    commission: 4.28,
    decimals: 2,
    exchange: 'CME',
  },
  MES: {
    symbol: 'MES',
    name: 'Micro E-mini S&P 500',
    group: 'S&P 500',
    tickSize: 0.25,
    pointValue: 5,
    commission: 1.34,
    decimals: 2,
    exchange: 'CME',
  },
  ES: {
    symbol: 'ES',
    name: 'E-mini S&P 500',
    group: 'S&P 500',
    tickSize: 0.25,
    pointValue: 50,
    commission: 4.28,
    decimals: 2,
    exchange: 'CME',
  },
  MYM: {
    symbol: 'MYM',
    name: 'Micro E-mini Dow',
    group: 'Dow 30',
    tickSize: 1,
    pointValue: 0.5,
    commission: 1.34,
    decimals: 0,
    exchange: 'CBOT',
  },
  YM: {
    symbol: 'YM',
    name: 'E-mini Dow',
    group: 'Dow 30',
    tickSize: 1,
    pointValue: 5,
    commission: 4.28,
    decimals: 0,
    exchange: 'CBOT',
  },
  M2K: {
    symbol: 'M2K',
    name: 'Micro E-mini Russell 2000',
    group: 'Russell 2000',
    tickSize: 0.1,
    pointValue: 5,
    commission: 1.34,
    decimals: 1,
    exchange: 'CME',
  },
  RTY: {
    symbol: 'RTY',
    name: 'E-mini Russell 2000',
    group: 'Russell 2000',
    tickSize: 0.1,
    pointValue: 50,
    commission: 4.28,
    decimals: 1,
    exchange: 'CME',
  },
  MGC: {
    symbol: 'MGC',
    name: 'Micro Gold',
    group: 'Metales',
    tickSize: 0.1,
    pointValue: 10,
    commission: 1.34,
    decimals: 1,
    exchange: 'COMEX',
  },
  GC: {
    symbol: 'GC',
    name: 'Gold',
    group: 'Metales',
    tickSize: 0.1,
    pointValue: 100,
    commission: 4.28,
    decimals: 1,
    exchange: 'COMEX',
  },
  MCL: {
    symbol: 'MCL',
    name: 'Micro Crude Oil',
    group: 'Energía',
    tickSize: 0.01,
    pointValue: 100,
    commission: 1.34,
    decimals: 2,
    exchange: 'NYMEX',
  },
  CL: {
    symbol: 'CL',
    name: 'Crude Oil',
    group: 'Energía',
    tickSize: 0.01,
    pointValue: 1000,
    commission: 4.28,
    decimals: 2,
    exchange: 'NYMEX',
  },
}

/** Symbols offered first in the picker — this is a Nasdaq-100 journal. */
export const FAVORITE_SYMBOLS = ['MNQ', 'NQ']

export const INSTRUMENT_LIST = Object.values(INSTRUMENTS)

export function getInstrument(symbol) {
  return (
    INSTRUMENTS[symbol] || {
      symbol: symbol || '—',
      name: symbol || 'Instrumento personalizado',
      group: 'Otros',
      tickSize: 0.25,
      pointValue: 1,
      commission: 0,
      decimals: 2,
      exchange: '',
    }
  )
}

/** Dollar value of one tick for a given instrument. */
export function tickValue(symbol) {
  const i = getInstrument(symbol)
  return i.pointValue * i.tickSize
}

/** Convert a price distance in points to ticks. */
export function pointsToTicks(symbol, points) {
  const i = getInstrument(symbol)
  return points / i.tickSize
}

/**
 * Per-contract round-turn commission, honoring a Settings override.
 * `overrides` is `{ MNQ: 1.10, ... }`.
 */
export function commissionFor(symbol, overrides = {}) {
  const override = overrides?.[symbol]
  if (override !== undefined && override !== null && override !== '') {
    const n = Number(override)
    if (Number.isFinite(n)) return n
  }
  return getInstrument(symbol).commission
}
