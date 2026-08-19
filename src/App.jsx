import { useEffect } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'

import { JournalProvider, useJournal } from './context/JournalContext.jsx'
import { UIProvider } from './context/UIContext.jsx'
import { applyTheme } from './lib/themes.js'

import Shell from './components/layout/Shell.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import CalendarPage from './pages/CalendarPage.jsx'
import DayPage from './pages/DayPage.jsx'
import TradesPage from './pages/TradesPage.jsx'
import AnalyticsPage from './pages/AnalyticsPage.jsx'
import SettingsPage from './pages/SettingsPage.jsx'

/** Mirrors the stored theme onto <html> so CSS variables switch instantly. */
function ThemeSync() {
  const { settings } = useJournal()
  useEffect(() => {
    applyTheme(settings.theme)
  }, [settings.theme])
  return null
}

function Routing() {
  return (
    <Routes>
      <Route element={<Shell />}>
        <Route index element={<DashboardPage />} />
        <Route path="calendario" element={<CalendarPage />} />
        <Route path="dia/:date" element={<DayPage />} />
        <Route path="trades" element={<TradesPage />} />
        <Route path="analitica" element={<AnalyticsPage />} />
        <Route path="ajustes" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <JournalProvider>
      <ThemeSync />
      <UIProvider>
        {/* Hash routing keeps deep links (e.g. #/dia/2026-08-19) working on any
            static host without server rewrites. */}
        <HashRouter>
          <Routing />
        </HashRouter>
      </UIProvider>

      <Toaster
        position="bottom-right"
        toastOptions={{
          duration: 2600,
          style: {
            background: 'rgb(var(--c-bg-card))',
            color: 'rgb(var(--c-ink))',
            border: '1px solid rgb(var(--c-line))',
            fontSize: '13px',
            borderRadius: '10px',
          },
          success: { iconTheme: { primary: 'rgb(var(--c-success))', secondary: 'rgb(var(--c-bg-card))' } },
          error: { iconTheme: { primary: 'rgb(var(--c-danger))', secondary: 'rgb(var(--c-bg-card))' } },
        }}
      />
    </JournalProvider>
  )
}
