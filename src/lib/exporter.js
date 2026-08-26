/**
 * Export / import.
 *
 * Two shapes, two purposes:
 *  - CSV  → one flat row per trade, every derived metric included, so you can
 *           pivot it in Excel/Sheets or load it into pandas without rebuilding
 *           any formulas.
 *  - JSON → a complete backup (trades + daily notes + cash flows + settings,
 *           optionally with screenshots inlined as base64) that this app can
 *           restore byte-for-byte.
 */

import { imageToDataUrl, importDataUrl } from './imageStore.js'
import { zonedTimeLabel, zonedDateKey, sessionLabel, EXCHANGE_TZ } from './time.js'

const CSV_COLUMNS = [
  { key: 'day', label: 'Trading Day' },
  { key: 'entry_date_et', label: 'Entry Date (ET)', get: (t) => zonedDateKey(t.entry_at, EXCHANGE_TZ) },
  { key: 'entry_time_et', label: 'Entry Time (ET)', get: (t) => zonedTimeLabel(t.entry_at, EXCHANGE_TZ) },
  { key: 'exit_time_et', label: 'Exit Time (ET)', get: (t) => zonedTimeLabel(t.exit_at, EXCHANGE_TZ) },
  { key: 'entry_at', label: 'Entry UTC' },
  { key: 'exit_at', label: 'Exit UTC' },
  { key: 'symbol', label: 'Symbol' },
  { key: 'direction', label: 'Direction' },
  { key: 'contracts', label: 'Contracts' },
  { key: 'entry_price', label: 'Entry Price' },
  { key: 'exit_price', label: 'Exit Price' },
  { key: 'stop_price', label: 'Stop' },
  { key: 'target_price', label: 'Target' },
  { key: 'points', label: 'Points' },
  { key: 'ticks', label: 'Ticks' },
  { key: 'gross_pnl', label: 'Gross P&L' },
  { key: 'commission', label: 'Commission' },
  { key: 'net_pnl', label: 'Net P&L' },
  { key: 'risk_amount', label: 'Risk $' },
  { key: 'risk_pct', label: 'Risk % of Capital' },
  { key: 'risk_source', label: 'Risk Source' },
  { key: 'rr_ratio', label: 'RR Used' },
  { key: 'r_multiple', label: 'R Multiple' },
  { key: 'planned_rr', label: 'Planned RR' },
  { key: 'outcome', label: 'Outcome' },
  { key: 'session', label: 'Session', get: (t) => sessionLabel(t.session) },
  { key: 'duration_min', label: 'Duration (min)' },
  { key: 'setup', label: 'Setup' },
  { key: 'tags', label: 'Tags', get: (t) => (t.tags || []).join(' | ') },
  { key: 'mistakes', label: 'Mistakes', get: (t) => (t.mistakes || []).join(' | ') },
  { key: 'emotion', label: 'Emotion' },
  { key: 'rating', label: 'Rating' },
  { key: 'followed_plan', label: 'Followed Plan' },
  { key: 'notes', label: 'Notes' },
  { key: 'image_count', label: 'Screenshots', get: (t) => (t.images || []).length },
  { key: 'id', label: 'ID' },
]

/**
 * RFC-4180 escaping. A leading `=`, `+`, `-` or `@` is prefixed with a quote
 * so spreadsheet apps treat pasted notes as text instead of formulas.
 */
function csvCell(value) {
  if (value === null || value === undefined) return ''
  let s = String(value)
  if (/^[=+\-@]/.test(s)) s = `'${s}`
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export function tradesToCsv(trades) {
  const header = CSV_COLUMNS.map((c) => csvCell(c.label)).join(',')
  const rows = trades.map((t) =>
    CSV_COLUMNS.map((c) => csvCell(c.get ? c.get(t) : t[c.key])).join(',')
  )
  return [header, ...rows].join('\r\n')
}

/** Daily aggregate CSV — the view most people actually chart. */
export function dailyToCsv(days) {
  const header = ['Date', 'Trades', 'Wins', 'Losses', 'Win Rate %', 'Net P&L', 'Cumulative']
  const rows = days.map((d) =>
    [
      d.day,
      d.count,
      d.wins,
      d.count - d.wins,
      d.count ? ((d.wins / d.count) * 100).toFixed(1) : '0.0',
      d.netPnl,
      d.cumulative,
    ]
      .map(csvCell)
      .join(',')
  )
  return [header.map(csvCell).join(','), ...rows].join('\r\n')
}

export function downloadFile(filename, content, mime) {
  // The BOM makes Excel open UTF-8 CSVs without mangling accented text.
  const parts = mime.includes('csv') ? ['﻿', content] : [content]
  const blob = new Blob(parts, { type: `${mime};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function stamp() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`
}

/**
 * Filenames carry the account, because the moment you keep more than one
 * journal, three files called `nq-journal-backup` are indistinguishable.
 */
function slug(name) {
  return (
    String(name || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || 'cuenta'
  )
}

export function exportCsv(trades, account) {
  downloadFile(`nq-${slug(account?.name)}-trades-${stamp()}.csv`, tradesToCsv(trades), 'text/csv')
}

export function exportDailyCsv(days, account) {
  downloadFile(`nq-${slug(account?.name)}-daily-${stamp()}.csv`, dailyToCsv(days), 'text/csv')
}

/**
 * Full backup. `includeImages` inlines every screenshot as a data URL, which
 * makes the file large but completely self-contained — the right choice for
 * an archive you might restore on a different machine.
 */
export async function exportJson({
  trades,
  dayNotes,
  cashFlows,
  settings,
  account,
  includeImages = false,
}) {
  let payload = { trades, dayNotes, cashFlows, settings }

  if (includeImages) {
    const assets = {}
    for (const trade of trades) {
      for (const img of trade.images || []) {
        if (assets[img.id]) continue
        const dataUrl = await imageToDataUrl(img)
        if (dataUrl) assets[img.id] = dataUrl
      }
    }
    payload = { ...payload, assets }
  }

  const doc = {
    app: 'nq-journal',
    version: 3,
    exported_at: new Date().toISOString(),
    // Which journal these rows came from. The importer does not read it —
    // a backup restores into whichever account is open — but without it you
    // cannot tell two backups apart six months from now.
    account: account ? { name: account.name, kind: account.kind } : null,
    counts: {
      trades: trades.length,
      dayNotes: dayNotes.length,
      cashFlows: cashFlows.length,
    },
    ...payload,
  }

  downloadFile(
    `nq-${slug(account?.name)}-backup-${stamp()}${includeImages ? '-full' : ''}.json`,
    JSON.stringify(doc, null, 2),
    'application/json'
  )
}

export async function parseBackup(file) {
  const text = await file.text()
  const doc = JSON.parse(text)

  if (!doc || typeof doc !== 'object') throw new Error('Archivo inválido')
  if (!Array.isArray(doc.trades)) throw new Error('El backup no contiene trades')

  // Restore inlined screenshots before the trades that reference them. The
  // upload assigns a fresh bucket path and public URL, so the descriptors on
  // the trades have to be re-pointed at it — a backup taken from a different
  // Supabase project carries URLs that mean nothing here.
  const restored = new Map()
  if (doc.assets && typeof doc.assets === 'object') {
    for (const [id, dataUrl] of Object.entries(doc.assets)) {
      if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) continue
      const patch = await importDataUrl(id, dataUrl).catch(() => null)
      if (patch) restored.set(id, patch)
    }
  }

  const trades = restored.size
    ? doc.trades.map((t) =>
        t.images?.length
          ? { ...t, images: t.images.map((img) => ({ ...img, ...(restored.get(img.id) || {}) })) }
          : t
      )
    : doc.trades

  return {
    trades,
    dayNotes: Array.isArray(doc.dayNotes) ? doc.dayNotes : [],
    cashFlows: Array.isArray(doc.cashFlows) ? doc.cashFlows : [],
    settings: doc.settings && typeof doc.settings === 'object' ? doc.settings : null,
  }
}
