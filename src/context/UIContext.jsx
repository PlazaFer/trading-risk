import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

import TradeForm from '../components/journal/TradeForm.jsx'
import TradeDetail from '../components/journal/TradeDetail.jsx'
import { useJournal } from './JournalContext.jsx'

const UIContext = createContext(null)

/**
 * Owns the trade modals — and the date range — for the whole app.
 *
 * Every page needs "add a trade" and "open this trade", and each mounting its
 * own copy would mean three modals fighting over Escape and body scroll lock.
 * One owner, one keyboard shortcut, one source of truth.
 *
 * The period lives here for the same reason. It used to be local state on
 * each page, which meant the Dashboard opened on "this month" and Analytics
 * on "everything", and answering a question on one screen and then checking
 * it on the other silently changed the question. One range, followed
 * everywhere, is what makes the two screens comparable at all.
 */
export function UIProvider({ children }) {
  const { trades } = useJournal()
  const [formState, setFormState] = useState(null) // { trade, defaultDate } | null
  const [detailId, setDetailId] = useState(null)

  // 90 days by default: recent enough that the conclusions still describe how
  // you trade now, long enough that a per-session breakdown has a sample
  // instead of three trades in a cell.
  const [period, setPeriod] = useState('90d')
  const [customRange, setCustomRange] = useState({ from: '', to: '' })

  const newTrade = useCallback((defaultDate = null) => {
    setDetailId(null)
    setFormState({ trade: null, defaultDate })
  }, [])

  const editTradeModal = useCallback((trade) => {
    setDetailId(null)
    setFormState({ trade, defaultDate: null })
  }, [])

  const openTrade = useCallback((trade) => setDetailId(trade?.id ?? null), [])

  const closeAll = useCallback(() => {
    setFormState(null)
    setDetailId(null)
  }, [])

  // `N` opens a new trade from anywhere, as long as you are not typing.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'n' && e.key !== 'N') return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const el = document.activeElement
      const typing =
        el &&
        (el.tagName === 'INPUT' ||
          el.tagName === 'TEXTAREA' ||
          el.tagName === 'SELECT' ||
          el.isContentEditable)
      if (typing || formState || detailId) return
      e.preventDefault()
      newTrade()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [newTrade, formState, detailId])

  // Resolve the detail modal from live state so an edit reflects immediately.
  const detailTrade = useMemo(
    () => (detailId ? trades.find((t) => t.id === detailId) || null : null),
    [detailId, trades]
  )

  const value = useMemo(
    () => ({
      newTrade,
      editTradeModal,
      openTrade,
      closeAll,
      period,
      setPeriod,
      customRange,
      setCustomRange,
    }),
    [newTrade, editTradeModal, openTrade, closeAll, period, customRange]
  )

  return (
    <UIContext.Provider value={value}>
      {children}

      {formState && (
        <TradeForm
          open
          trade={formState.trade}
          defaultDate={formState.defaultDate}
          onClose={() => setFormState(null)}
        />
      )}

      <TradeDetail
        open={Boolean(detailTrade)}
        trade={detailTrade}
        onClose={() => setDetailId(null)}
        onEdit={editTradeModal}
      />
    </UIContext.Provider>
  )
}

export function useUI() {
  const ctx = useContext(UIContext)
  if (!ctx) throw new Error('useUI debe usarse dentro de <UIProvider>')
  return ctx
}
