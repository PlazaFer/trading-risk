import { useEffect, useMemo, useState } from 'react'
import { Check, ChevronsUpDown, Plus, Wallet } from 'lucide-react'

import { useJournal } from '../../context/JournalContext.jsx'
import { accountKind, kindClasses } from '../../lib/accounts.js'
import { compactMoney, money } from '../../lib/format.js'
import NewAccountDialog from './NewAccountDialog.jsx'

/**
 * The account selector.
 *
 * It sits in the header because switching accounts changes the meaning of
 * every number on the page — the balance, the calendar, the analytics — and
 * that is not something to bury inside a settings screen. The balance next to
 * each name comes from the `v_accounts` view, so the menu can show what every
 * account is worth without loading every account's trades.
 */
export default function AccountSwitcher() {
  const {
    accounts,
    activeAccountId,
    account,
    accountSummaries,
    switchAccount,
    refreshAccountSummaries,
  } = useJournal()

  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)

  // The active account's totals are live in memory and newer than the view.
  const balanceFor = (id) =>
    id === activeAccountId ? account.balance : accountSummaries[id]?.equity ?? null

  useEffect(() => {
    if (open) refreshAccountSummaries()
  }, [open, refreshAccountSummaries])

  const sorted = useMemo(
    () => [...accounts].sort((a, b) => Number(a.archived) - Number(b.archived)),
    [accounts]
  )

  const current = accounts.find((a) => a.id === activeAccountId)
  const kind = accountKind(current?.kind)

  return (
    <>
      <div className="relative">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex max-w-[13rem] items-center gap-2 rounded-lg border border-line bg-bg-sub px-2.5 py-1.5 text-left transition-colors hover:bg-bg-hover sm:max-w-[16rem]"
          title="Cambiar de cuenta"
        >
          <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-md ${kindClasses(current?.kind)}`}>
            <Wallet className="h-3.5 w-3.5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-semibold leading-tight text-ink">
              {current?.name || 'Sin cuenta'}
            </span>
            <span className="block truncate text-[10px] leading-tight text-ink-faint">
              {kind.label} · {compactMoney(account.balance)}
            </span>
          </span>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-ink-faint" />
        </button>

        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <div className="absolute right-0 z-50 mt-2 w-72 animate-scale-in rounded-xl border border-line bg-bg-card p-1.5 shadow-pop">
              <p className="px-2.5 py-1.5 eyebrow">Cuentas</p>

              <div className="max-h-72 space-y-0.5 overflow-y-auto">
                {sorted.map((a) => {
                  const active = a.id === activeAccountId
                  const balance = balanceFor(a.id)
                  const trades = active ? null : accountSummaries[a.id]?.trades
                  return (
                    <button
                      key={a.id}
                      onClick={() => {
                        setOpen(false)
                        switchAccount(a.id)
                      }}
                      className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors ${
                        active ? 'bg-bg-hover' : 'hover:bg-bg-hover'
                      }`}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className="truncate text-[13px] font-medium text-ink">{a.name}</span>
                          <span className={`chip shrink-0 ${kindClasses(a.kind)}`}>
                            {accountKind(a.kind).label}
                          </span>
                        </span>
                        <span className="tnum mt-0.5 block text-[11px] text-ink-faint">
                          {balance === null ? '—' : money(balance)}
                          {trades !== undefined && trades !== null && ` · ${trades} trades`}
                        </span>
                      </span>
                      {active && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
                    </button>
                  )
                })}
              </div>

              <div className="my-1.5 border-t border-line" />

              <button
                onClick={() => {
                  setOpen(false)
                  setCreating(true)
                }}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium text-ink-soft transition-colors hover:bg-bg-hover hover:text-ink"
              >
                <Plus className="h-4 w-4" />
                Nueva cuenta
              </button>
            </div>
          </>
        )}
      </div>

      {creating && <NewAccountDialog onClose={() => setCreating(false)} />}
    </>
  )
}
