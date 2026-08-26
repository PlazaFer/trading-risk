import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import {
  BarChart3,
  CalendarDays,
  CandlestickChart,
  Check,
  Cloud,
  CloudOff,
  LayoutDashboard,
  Palette,
  Plus,
  Settings,
} from 'lucide-react'

import { useJournal } from '../../context/JournalContext.jsx'
import { useUI } from '../../context/UIContext.jsx'
import { THEMES } from '../../lib/themes.js'
import { accountKind, kindClasses } from '../../lib/accounts.js'
import { money, percent, pnlText } from '../../lib/format.js'
import AccountSwitcher from './AccountSwitcher.jsx'

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/calendario', label: 'Calendario', icon: CalendarDays },
  { to: '/trades', label: 'Trades', icon: CandlestickChart },
  { to: '/analitica', label: 'Analítica', icon: BarChart3 },
  { to: '/ajustes', label: 'Ajustes', icon: Settings },
]

export default function Shell() {
  const { account, trades, loadError, refresh } = useJournal()
  const { newTrade } = useUI()

  return (
    <div className="min-h-screen lg:flex">
      {/* ───────────────────────── Sidebar (desktop) ───────────────────────── */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-line bg-bg-sub lg:flex">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/12 text-primary">
            <CandlestickChart className="h-5 w-5" strokeWidth={2} />
          </div>
          <div className="min-w-0">
            <p className="font-display text-sm font-bold leading-tight text-ink">NQ Journal</p>
            <p className="truncate text-[11px] text-ink-faint">Nasdaq 100 Futures</p>
          </div>
        </div>

        <nav className="flex-1 space-y-0.5 px-3">
          {NAV.map((item) => (
            <NavItem key={item.to} {...item} />
          ))}
        </nav>

        <div className="border-t border-line p-3">
          <div className="rounded-lg bg-bg-card p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate eyebrow">{account.name}</p>
              <span className={`chip shrink-0 ${kindClasses(account.kind)}`}>
                {accountKind(account.kind).label}
              </span>
            </div>
            <p className="tnum mt-1 font-display text-lg font-bold text-ink">
              {money(account.balance)}
            </p>
            <p
              className={`tnum mt-0.5 text-[11px] font-medium ${
                trades.length ? pnlText(account.pnl) : 'text-ink-faint'
              }`}
            >
              {money(account.pnl, { sign: true })}
              {account.startingBalance > 0 && ` · ${percent(account.returnPct, { sign: true })}`}
            </p>
          </div>

          <div className="mt-2 flex items-center gap-1.5 px-1 text-[11px] text-ink-faint">
            {loadError ? (
              <>
                <CloudOff className="h-3 w-3 text-danger" />
                <span className="text-danger">Sin conexión</span>
              </>
            ) : (
              <>
                <Cloud className="h-3 w-3 text-primary" />
                Supabase
              </>
            )}
            <span className="ml-auto tabular-nums">{trades.length} trades</span>
          </div>
        </div>
      </aside>

      {/* ─────────────────────────────── Main ─────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur-lg">
          <div className="flex h-14 items-center gap-3 px-4 sm:px-6">
            <div className="flex items-center gap-2 lg:hidden">
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary/12 text-primary">
                <CandlestickChart className="h-4 w-4" strokeWidth={2} />
              </div>
              <span className="font-display text-sm font-bold text-ink">NQ Journal</span>
            </div>

            <div className="ml-auto flex items-center gap-2">
              <AccountSwitcher />

              <ThemeMenu />

              <button onClick={() => newTrade()} className="btn-primary btn-sm sm:px-4 sm:py-2.5 sm:text-sm">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Nuevo trade</span>
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 pb-24 pt-6 sm:px-6 lg:pb-10">
          {/* Supabase is the only store, so a failed load means the page is
              showing nothing rather than stale data — say so instead of
              rendering an empty journal that looks like a fresh account. */}
          {loadError && (
            <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-danger/30 bg-danger/8 p-4">
              <CloudOff className="h-5 w-5 shrink-0 text-danger" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-danger">No se pudo conectar con Supabase</p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-ink-soft">{loadError}</p>
              </div>
              <button onClick={refresh} className="btn-ghost btn-sm shrink-0">
                Reintentar
              </button>
            </div>
          )}
          <Outlet />
        </main>
      </div>

      {/* ──────────────────────── Bottom nav (mobile) ──────────────────────── */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-bg-sub/95 backdrop-blur-lg lg:hidden">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors ${
                isActive ? 'text-primary' : 'text-ink-faint'
              }`
            }
          >
            <Icon className="h-5 w-5" strokeWidth={1.9} />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

function NavItem({ to, label, icon: Icon, end }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
          isActive
            ? 'bg-primary/12 text-primary'
            : 'text-ink-soft hover:bg-bg-hover hover:text-ink'
        }`
      }
    >
      <Icon className="h-4.5 w-4.5" strokeWidth={1.9} />
      {label}
    </NavLink>
  )
}

function ThemeMenu() {
  const { settings, updateSettings } = useJournal()
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="icon-btn border border-line bg-bg-sub"
        title="Cambiar tema"
        aria-label="Cambiar tema"
      >
        <Palette className="h-4.5 w-4.5" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-2 w-48 animate-scale-in rounded-xl border border-line bg-bg-card p-1.5 shadow-pop">
            <p className="px-2.5 py-1.5 eyebrow">Tema</p>
            {THEMES.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  updateSettings({ theme: t.id })
                  setOpen(false)
                }}
                className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors ${
                  settings.theme === t.id
                    ? 'bg-bg-hover text-ink'
                    : 'text-ink-soft hover:bg-bg-hover hover:text-ink'
                }`}
              >
                <span
                  className="h-4 w-4 shrink-0 rounded-full border border-line"
                  style={{
                    background: `linear-gradient(135deg, ${t.swatch[0]} 50%, ${t.swatch[1]} 50%)`,
                  }}
                />
                {t.name}
                {settings.theme === t.id && <Check className="ml-auto h-3.5 w-3.5 text-primary" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
