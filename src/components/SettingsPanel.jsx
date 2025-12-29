import { useState } from 'react'
import { X, Save, Database, HardDrive, RefreshCw, AlertTriangle, Wallet, Info } from 'lucide-react'
import { useTrades } from '../context/TradesContext'
import { isSupabaseConfigured } from '../lib/supabase'
import toast from 'react-hot-toast'

export default function SettingsPanel({ onClose }) {
  const { 
    settings, 
    setSettings, 
    useLocalStorage, 
    setUseLocalStorage,
    loadTrades,
    trades,
    monthlyDeposits 
  } = useTrades()
  
  const [formData, setFormData] = useState({
    accountCapital: settings.accountCapital?.toString() || '170',
    riskPerTrade: ((settings.riskPerTrade || 0.01) * 100).toString(),
    maxDailyRisk: ((settings.maxDailyRisk || 0.03) * 100).toString(),
    defaultLeverage: settings.defaultLeverage?.toString() || '3',
    maxMarginPercent: ((settings.maxMarginPercent || 0.25) * 100).toString(),
    initialAccountBalance: settings.initialAccountBalance?.toString() || '0',
  })

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSave = () => {
    setSettings({
      ...settings,
      accountCapital: parseFloat(formData.accountCapital) || 170,
      riskPerTrade: (parseFloat(formData.riskPerTrade) || 1) / 100,
      maxDailyRisk: (parseFloat(formData.maxDailyRisk) || 3) / 100,
      defaultLeverage: parseFloat(formData.defaultLeverage) || 3,
      maxMarginPercent: (parseFloat(formData.maxMarginPercent) || 25) / 100,
      initialAccountBalance: parseFloat(formData.initialAccountBalance) || 0,
    })
    toast.success('Configuración guardada')
    onClose()
  }

  const handleExportData = () => {
    const data = {
      settings,
      trades,
      monthlyDeposits,
      exportDate: new Date().toISOString(),
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `trading-risk-backup-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Datos exportados')
  }

  const handleImportData = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result)
        
        if (data.settings) {
          setSettings(data.settings)
        }
        
        if (data.trades && Array.isArray(data.trades)) {
          localStorage.setItem('trading-risk-trades', JSON.stringify(data.trades))
        }

        if (data.monthlyDeposits) {
          localStorage.setItem('trading-risk-monthly-deposits', JSON.stringify(data.monthlyDeposits))
        }
        
        loadTrades()
        toast.success('Datos importados correctamente')
      } catch (error) {
        toast.error('Error al importar datos')
        console.error(error)
      }
    }
    reader.readAsText(file)
  }

  const riskAmount = (parseFloat(formData.accountCapital) || 0) * ((parseFloat(formData.riskPerTrade) || 0) / 100)
  const maxDailyRiskAmount = (parseFloat(formData.accountCapital) || 0) * ((parseFloat(formData.maxDailyRisk) || 0) / 100)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Panel */}
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-background-card border border-border rounded-2xl shadow-2xl animate-slide-up">
        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between p-6 border-b border-border bg-background-card z-10">
          <h2 className="font-display text-xl font-bold text-text">Configuración</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-background-secondary transition-colors"
          >
            <X className="w-5 h-5 text-text-secondary" />
          </button>
        </div>

        <div className="p-6 space-y-8">
          {/* Initial Capital - IMPORTANT */}
          <section className="p-4 rounded-xl bg-primary/10 border border-primary/30">
            <h3 className="text-lg font-semibold text-text mb-2 flex items-center gap-2">
              <Wallet className="w-5 h-5 text-primary" />
              Capital Inicial de la Cuenta
            </h3>
            <p className="text-sm text-text-secondary mb-4 flex items-start gap-2">
              <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
              Este es el saldo con el que abriste tu cuenta de trading por primera vez. 
              Se usa para calcular automáticamente el saldo de cada mes.
            </p>
            <div className="max-w-xs">
              <input
                type="number"
                name="initialAccountBalance"
                value={formData.initialAccountBalance}
                onChange={handleChange}
                className="input"
                min="0"
                step="0.01"
                placeholder="Ej: 177.00"
              />
              <p className="text-xs text-text-muted mt-1">
                Ejemplo: Si empezaste en Diciembre con $177, poné 177
              </p>
            </div>
          </section>

          {/* Risk Management Settings */}
          <section>
            <h3 className="text-lg font-semibold text-text mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-warning" />
              Gestión de Riesgo
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Capital Actual de Cuenta (USDT)</label>
                <input
                  type="number"
                  name="accountCapital"
                  value={formData.accountCapital}
                  onChange={handleChange}
                  className="input"
                  min="0"
                  step="0.01"
                />
                <p className="text-xs text-text-muted mt-1">
                  Para calcular el riesgo por trade
                </p>
              </div>

              <div>
                <label className="label">Riesgo por Trade (%)</label>
                <input
                  type="number"
                  name="riskPerTrade"
                  value={formData.riskPerTrade}
                  onChange={handleChange}
                  className="input"
                  min="0"
                  max="100"
                  step="0.1"
                />
                <p className="text-xs text-text-muted mt-1">
                  = ${riskAmount.toFixed(2)} por trade
                </p>
              </div>

              <div>
                <label className="label">Riesgo Diario Máximo (%)</label>
                <input
                  type="number"
                  name="maxDailyRisk"
                  value={formData.maxDailyRisk}
                  onChange={handleChange}
                  className="input"
                  min="0"
                  max="100"
                  step="0.1"
                />
                <p className="text-xs text-text-muted mt-1">
                  = ${maxDailyRiskAmount.toFixed(2)} máximo/día
                </p>
              </div>

              <div>
                <label className="label">Apalancamiento por Defecto</label>
                <input
                  type="number"
                  name="defaultLeverage"
                  value={formData.defaultLeverage}
                  onChange={handleChange}
                  className="input"
                  min="1"
                  max="125"
                  step="1"
                />
              </div>

              <div>
                <label className="label">Máx % Capital como Margen</label>
                <input
                  type="number"
                  name="maxMarginPercent"
                  value={formData.maxMarginPercent}
                  onChange={handleChange}
                  className="input"
                  min="0"
                  max="100"
                  step="1"
                />
              </div>
            </div>
          </section>

          {/* Storage Settings */}
          <section>
            <h3 className="text-lg font-semibold text-text mb-4 flex items-center gap-2">
              <Database className="w-5 h-5 text-primary" />
              Almacenamiento
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                onClick={() => setUseLocalStorage(true)}
                className={`p-4 rounded-xl border-2 transition-all text-left ${
                  useLocalStorage 
                    ? 'border-primary bg-primary/10' 
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <HardDrive className={`w-6 h-6 ${useLocalStorage ? 'text-primary' : 'text-text-secondary'}`} />
                  <span className="font-medium text-text">Local Storage</span>
                  {useLocalStorage && <div className="ml-auto w-2 h-2 rounded-full bg-primary" />}
                </div>
                <p className="text-sm text-text-secondary">
                  Datos guardados en tu navegador. Solo en este dispositivo.
                </p>
              </button>

              <button
                onClick={() => {
                  if (isSupabaseConfigured()) {
                    setUseLocalStorage(false)
                    loadTrades()
                  } else {
                    toast.error('Configura Supabase primero (ver README)')
                  }
                }}
                className={`p-4 rounded-xl border-2 transition-all text-left ${
                  !useLocalStorage 
                    ? 'border-primary bg-primary/10' 
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <Database className={`w-6 h-6 ${!useLocalStorage ? 'text-primary' : 'text-text-secondary'}`} />
                  <span className="font-medium text-text">Supabase</span>
                  {!useLocalStorage && <div className="ml-auto w-2 h-2 rounded-full bg-primary" />}
                </div>
                <p className="text-sm text-text-secondary">
                  Base de datos en la nube. Sincronizado entre dispositivos.
                </p>
                {!isSupabaseConfigured() && (
                  <p className="text-xs text-warning mt-2">
                    ⚠️ No configurado
                  </p>
                )}
              </button>
            </div>
          </section>

          {/* Data Management */}
          <section>
            <h3 className="text-lg font-semibold text-text mb-4 flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-secondary" />
              Datos
            </h3>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleExportData}
                className="btn-secondary"
              >
                Exportar Datos (JSON)
              </button>
              
              <label className="btn-secondary cursor-pointer">
                Importar Datos
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportData}
                  className="hidden"
                />
              </label>
            </div>

            <p className="text-xs text-text-muted mt-3">
              Total de trades almacenados: {trades.length}
            </p>
          </section>

          {/* Supabase Setup Info */}
          {isSupabaseConfigured() && !useLocalStorage && (
            <section className="p-4 rounded-xl bg-success/10 border border-success/30">
              <h4 className="font-medium text-success mb-2">✅ Supabase Conectado</h4>
              <p className="text-sm text-text-secondary">
                Tus datos se sincronizan automáticamente. Podés acceder desde cualquier dispositivo.
              </p>
            </section>
          )}

          {!isSupabaseConfigured() && (
            <section className="p-4 rounded-xl bg-background-secondary border border-border">
              <h4 className="font-medium text-text mb-2">📋 Configurar Supabase (opcional)</h4>
              <p className="text-sm text-text-secondary mb-2">
                Para sincronizar entre dispositivos, necesitás crear una tabla adicional:
              </p>
              <pre className="text-xs bg-background-card p-2 rounded overflow-x-auto text-text-muted">
{`-- En SQL Editor de Supabase, ejecutá:
CREATE TABLE app_settings (
  id TEXT PRIMARY KEY,
  settings JSONB NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON app_settings FOR ALL USING (true);`}
              </pre>
            </section>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 flex gap-3 p-6 border-t border-border bg-background-card">
          <button
            onClick={onClose}
            className="btn-secondary flex-1"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="btn-primary flex-1 flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" />
            Guardar Cambios
          </button>
        </div>
      </div>
    </div>
  )
}
