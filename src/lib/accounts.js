/**
 * Accounts — one journal per trading account.
 *
 * A backtest, a demo, a funded challenge and a live account are the same
 * activity measured against different capital, different limits and different
 * stakes. Averaging them together produces statistics that describe none of
 * them, so each one owns its trades, its notes, its cash flows and the
 * settings that only make sense next to its own capital.
 *
 * This module owns the split: which preferences follow *you* across every
 * account, and which belong to the account you happen to be looking at.
 */

import { EXCHANGE_TZ } from './time.js'
import { DEFAULT_SETUPS, DEFAULT_MISTAKES, DEFAULT_TAGS } from './taxonomy.js'

export const ACCOUNT_KINDS = [
  {
    id: 'backtest',
    label: 'Backtesting',
    description: 'Operativa simulada sobre datos históricos.',
    tone: 'info',
  },
  {
    id: 'demo',
    label: 'Demo',
    description: 'Cuenta de práctica en tiempo real, sin dinero propio.',
    tone: 'accent',
  },
  {
    id: 'real',
    label: 'Real',
    description: 'Tu capital, tu broker.',
    tone: 'success',
  },
  {
    id: 'fondeo',
    label: 'Fondeo',
    description: 'Challenge o cuenta fondeada, con reglas de pérdida diaria.',
    tone: 'warning',
  },
  {
    id: 'otro',
    label: 'Otra',
    description: 'Cualquier otro tipo de cuenta.',
    tone: 'neutral',
  },
]

export function accountKind(id) {
  return ACCOUNT_KINDS.find((k) => k.id === id) || ACCOUNT_KINDS[ACCOUNT_KINDS.length - 1]
}

/** Tailwind classes for a kind's badge, resolved from the theme tokens. */
export function kindClasses(id) {
  switch (accountKind(id).tone) {
    case 'info':
      return 'bg-info/12 text-info'
    case 'accent':
      return 'bg-accent/12 text-accent'
    case 'success':
      return 'bg-success/12 text-success'
    case 'warning':
      return 'bg-warning/12 text-warning'
    default:
      return 'bg-ink-faint/15 text-ink-soft'
  }
}

/* ----------------------------------------------------------- the split */

/**
 * App-wide preferences. They describe you and your screen, not your capital,
 * so they stay identical no matter which account is open — switching to the
 * backtest should not repaint the app or re-ask for your timezone.
 */
export const GLOBAL_SETTINGS = {
  // The clock you read on your platform. Times you type are interpreted in
  // this zone, and a trade is filed under the date you typed on it; session
  // analytics always convert to exchange time.
  timezone: EXCHANGE_TZ,

  // Off by default: the calendar day is the date on the form. Turn it on to
  // file trades by the CME session instead (18:00 ET → next day).
  futuresSessionDay: false,

  // Marks the one-time migration off the old Globex-day default as done. It
  // belongs to this half so it survives a save: dropped, the migration would
  // re-run on every load and keep undoing a deliberate opt-in.
  dayConventionOptIn: false,

  setups: DEFAULT_SETUPS,
  mistakeTypes: DEFAULT_MISTAKES,
  tagTypes: DEFAULT_TAGS,

  theme: 'terminal',
}

/**
 * Per-account preferences. Every one of these is measured in the account's own
 * money, so they travel with the account and are re-asked when you create a
 * new one.
 */
export const ACCOUNT_SETTINGS = {
  startingBalance: 0,

  /**
   * The capital risk percentages are measured against. Left at 0 it follows
   * `startingBalance`; set it explicitly when the account you size against
   * differs from the balance you actually hold (a funded prop account, or a
   * deliberate carve-out of a bigger balance).
   */
  riskCapital: 0,

  defaultSymbol: 'MNQ',
  defaultContracts: 1,
  defaultRR: 2,

  // Fallback dollar risk used for R-multiples when a trade has no stop
  // and no R:R to back-solve from.
  defaultRiskAmount: 0,
  riskPerTradePct: 1,

  // Daily guardrails. 0 disables the check.
  maxDailyLoss: 0,
  maxTradesPerDay: 0,

  commissions: {},
}

/** The shape the rest of the app reads: both halves, flattened. */
export const DEFAULT_SETTINGS = {
  ...GLOBAL_SETTINGS,
  ...ACCOUNT_SETTINGS,
  accountName: 'Mi cuenta',
  accountKind: 'real',
}

const GLOBAL_KEYS = new Set(Object.keys(GLOBAL_SETTINGS))
const ACCOUNT_KEYS = new Set(Object.keys(ACCOUNT_SETTINGS))

/** Keep only the keys that half owns, so a stale key never leaks across. */
export function pickGlobal(settings = {}) {
  return pick(settings, GLOBAL_KEYS)
}

export function pickAccount(settings = {}) {
  return pick(settings, ACCOUNT_KEYS)
}

function pick(source, keys) {
  const out = {}
  for (const key of keys) if (key in source) out[key] = source[key]
  return out
}

/**
 * Route a `updateSettings({ ... })` patch to the store that owns each key.
 * `name`/`kind` are columns on the account rather than settings, which is why
 * they come back separately.
 */
export function splitPatch(patch = {}) {
  const global = {}
  const account = {}
  const columns = {}

  for (const [key, value] of Object.entries(patch)) {
    if (key === 'accountName') columns.name = value
    else if (key === 'accountKind') columns.kind = value
    else if (GLOBAL_KEYS.has(key)) global[key] = value
    else if (ACCOUNT_KEYS.has(key)) account[key] = value
    // Anything else is a legacy key from an old settings row or an imported
    // backup. Dropping it here is what keeps the two stores clean.
  }

  return { global, account, columns }
}

/** The single flattened object every page reads through `useJournal()`. */
export function mergeSettings(globalSettings, account) {
  return {
    ...GLOBAL_SETTINGS,
    ...pickGlobal(globalSettings || {}),
    ...ACCOUNT_SETTINGS,
    ...pickAccount(account?.settings || {}),
    accountName: account?.name || DEFAULT_SETTINGS.accountName,
    accountKind: account?.kind || DEFAULT_SETTINGS.accountKind,
  }
}

/**
 * Starting parameters for a brand-new account. A funded challenge arrives with
 * a daily loss limit and conservative sizing; a backtest arrives with a round
 * paper balance. They are only a starting point — Ajustes edits all of them.
 */
export function defaultsForKind(kind) {
  switch (kind) {
    case 'backtest':
      return { ...ACCOUNT_SETTINGS, startingBalance: 100000, riskPerTradePct: 1 }
    case 'demo':
      return { ...ACCOUNT_SETTINGS, startingBalance: 50000, riskPerTradePct: 1 }
    case 'fondeo':
      return {
        ...ACCOUNT_SETTINGS,
        startingBalance: 50000,
        riskPerTradePct: 0.5,
        maxDailyLoss: 1000,
        maxTradesPerDay: 5,
      }
    default:
      return { ...ACCOUNT_SETTINGS }
  }
}
