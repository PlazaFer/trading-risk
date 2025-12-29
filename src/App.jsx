import { useState } from 'react'
import Header from './components/Header'
import Dashboard from './components/Dashboard'
import TradeForm from './components/TradeForm'
import TradesTable from './components/TradesTable'
import SettingsPanel from './components/SettingsPanel'
import { useTrades } from './context/TradesContext'

export default function App() {
  const [showSettings, setShowSettings] = useState(false)
  const [showTradeForm, setShowTradeForm] = useState(false)
  const { isLoading } = useTrades()

  return (
    <div className="min-h-screen bg-background">
      {/* Background Pattern */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-secondary/5 rounded-full blur-3xl" />
      </div>

      <Header 
        onSettingsClick={() => setShowSettings(true)} 
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
              <p className="text-text-secondary">Cargando datos...</p>
            </div>
          </div>
        ) : (
          <div className="space-y-8 animate-fade-in">
            {/* Dashboard Stats */}
            <Dashboard onAddTrade={() => setShowTradeForm(true)} />
            
            {/* Trades Table */}
            <TradesTable />
          </div>
        )}
      </main>

      {/* Trade Form Modal */}
      {showTradeForm && (
        <TradeForm onClose={() => setShowTradeForm(false)} />
      )}

      {/* Settings Panel */}
      {showSettings && (
        <SettingsPanel onClose={() => setShowSettings(false)} />
      )}
    </div>
  )
}

