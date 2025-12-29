import { useState, useRef } from 'react'
import { X, Save, TrendingUp, TrendingDown, Calendar } from 'lucide-react'
import { format } from 'date-fns'
import { useTrades } from '../context/TradesContext'

// Popular crypto pairs
const PAIRS = [
  'BTC', 'ETH', 'BNB', 'XRP', 'SOL', 'ADA', 'DOGE', 'DOT', 
  'AVAX', 'MATIC', 'LINK', 'LTC', 'XMR', 'ZEC', 'BAT', 
  'HBAR', 'PIPPIN', 'ATOM', 'UNI', 'AAVE', 'FTM', 'NEAR',
  'ALGO', 'VET', 'ICP', 'FIL', 'SAND', 'MANA', 'AXS', 'APE'
]

export default function TradeForm({ onClose, editTrade = null }) {
  const { addTrade, updateTrade, settings } = useTrades()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const dateInputRef = useRef(null)
  
  const [formData, setFormData] = useState({
    date: editTrade?.date || format(new Date(), 'yyyy-MM-dd'),
    pair: editTrade?.pair || '',
    direction: editTrade?.direction || 'Long',
    balance_trade: editTrade?.balance_trade?.toString() || '',
    commission: editTrade?.commission?.toString() || '',
    notes: editTrade?.notes || '',
  })

  const [customPair, setCustomPair] = useState('')
  const [showCustomPair, setShowCustomPair] = useState(false)

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handlePairChange = (e) => {
    const value = e.target.value
    if (value === 'custom') {
      setShowCustomPair(true)
      setFormData(prev => ({ ...prev, pair: '' }))
    } else {
      setShowCustomPair(false)
      setFormData(prev => ({ ...prev, pair: value }))
    }
  }

  const handleDateClick = () => {
    dateInputRef.current?.showPicker()
  }

  const calculateFinalResult = () => {
    const balance = parseFloat(formData.balance_trade) || 0
    const commission = parseFloat(formData.commission) || 0
    return balance - commission
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const pair = showCustomPair ? customPair.toUpperCase() : formData.pair
      const balance_trade = parseFloat(formData.balance_trade) || 0
      const commission = parseFloat(formData.commission) || 0
      const final_result = balance_trade - commission

      const tradeData = {
        date: formData.date,
        pair,
        direction: formData.direction,
        balance_trade,
        commission,
        final_result,
        notes: formData.notes,
      }

      if (editTrade) {
        await updateTrade(editTrade.id, tradeData)
      } else {
        await addTrade(tradeData)
      }

      onClose()
    } catch (error) {
      console.error('Error saving trade:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const finalResult = calculateFinalResult()

  // Format date for display
  const formatDisplayDate = (dateString) => {
    try {
      const [year, month, day] = dateString.split('-')
      return `${day}/${month}/${year}`
    } catch {
      return dateString
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-lg bg-background-card border border-border rounded-2xl shadow-2xl animate-slide-up max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between p-6 border-b border-border bg-background-card z-10">
          <h2 className="font-display text-xl font-bold text-text">
            {editTrade ? 'Editar Trade' : 'Nuevo Trade'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-background-secondary transition-colors"
          >
            <X className="w-5 h-5 text-text-secondary" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Date */}
          <div>
            <label className="label">Fecha</label>
            <div 
              className="relative cursor-pointer"
              onClick={handleDateClick}
            >
              <input
                ref={dateInputRef}
                type="date"
                name="date"
                value={formData.date}
                onChange={handleChange}
                className="w-full bg-background-secondary border border-border rounded-lg px-4 py-2.5 text-text focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all cursor-pointer [color-scheme:dark]"
                required
                style={{ colorScheme: 'dark' }}
              />
              <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted pointer-events-none" />
            </div>
          </div>

          {/* Pair */}
          <div>
            <label className="label">Par</label>
            {!showCustomPair ? (
              <select
                name="pair"
                value={formData.pair}
                onChange={handlePairChange}
                className="select"
                required
              >
                <option value="">Seleccionar par...</option>
                {PAIRS.map(pair => (
                  <option key={pair} value={pair}>{pair}</option>
                ))}
                <option value="custom">+ Otro par...</option>
              </select>
            ) : (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customPair}
                  onChange={(e) => setCustomPair(e.target.value.toUpperCase())}
                  placeholder="Ej: PEPE"
                  className="input flex-1"
                  required
                />
                <button
                  type="button"
                  onClick={() => {
                    setShowCustomPair(false)
                    setCustomPair('')
                  }}
                  className="btn-secondary"
                >
                  Cancelar
                </button>
              </div>
            )}
          </div>

          {/* Direction */}
          <div>
            <label className="label">Dirección</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, direction: 'Long' }))}
                className={`flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all ${
                  formData.direction === 'Long'
                    ? 'border-success bg-success/20 text-success'
                    : 'border-border bg-background-secondary text-text-secondary hover:border-success/50'
                }`}
              >
                <TrendingUp className="w-5 h-5" />
                <span className="font-medium">Long</span>
              </button>
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, direction: 'Short' }))}
                className={`flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all ${
                  formData.direction === 'Short'
                    ? 'border-danger bg-danger/20 text-danger'
                    : 'border-border bg-background-secondary text-text-secondary hover:border-danger/50'
                }`}
              >
                <TrendingDown className="w-5 h-5" />
                <span className="font-medium">Short</span>
              </button>
            </div>
          </div>

          {/* Balance Trade & Commission */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Balance Trade ($)</label>
              <input
                type="number"
                name="balance_trade"
                value={formData.balance_trade}
                onChange={handleChange}
                placeholder="0.00"
                step="0.0001"
                className="input"
                required
              />
              <p className="text-xs text-text-muted mt-1">
                Positivo = ganancia, Negativo = pérdida
              </p>
            </div>
            <div>
              <label className="label">Comisión ($)</label>
              <input
                type="number"
                name="commission"
                value={formData.commission}
                onChange={handleChange}
                placeholder="0.00"
                step="0.0001"
                min="0"
                className="input"
              />
            </div>
          </div>

          {/* Final Result Preview */}
          <div className={`p-4 rounded-lg border ${
            finalResult >= 0 
              ? 'bg-success/10 border-success/30' 
              : 'bg-danger/10 border-danger/30'
          }`}>
            <div className="flex items-center justify-between">
              <span className="text-text-secondary font-medium">Resultado Final</span>
              <span className={`text-2xl font-bold ${
                finalResult >= 0 ? 'text-success' : 'text-danger'
              }`}>
                {finalResult >= 0 ? '+' : ''}${finalResult.toFixed(4)}
              </span>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="label">Notas (opcional)</label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              placeholder="Observaciones sobre el trade..."
              rows={2}
              className="input resize-none"
            />
          </div>

          {/* Risk Info */}
          <div className="p-3 rounded-lg bg-background-secondary border border-border text-xs text-text-muted">
            <p>
              <span className="font-medium text-text-secondary">Riesgo por trade:</span>{' '}
              {(settings.riskPerTrade * 100).toFixed(1)}% = ${(settings.accountCapital * settings.riskPerTrade).toFixed(2)}
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary flex-1"
              disabled={isSubmitting}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn-primary flex-1 flex items-center justify-center gap-2"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>{editTrade ? 'Guardar' : 'Agregar Trade'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
