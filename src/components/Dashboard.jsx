import { useState } from 'react'
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  BarChart3, 
  Target, 
  Percent,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  Calendar,
  Edit3,
  Check,
  X,
  Info,
  HelpCircle
} from 'lucide-react'
import { useTrades } from '../context/TradesContext'
import MonthSelector from './MonthSelector'
import StatsChart from './StatsChart'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export default function Dashboard({ onAddTrade }) {
  const { 
    stats, 
    totalBalance, 
    settings, 
    monthlyTrades, 
    selectedMonth,
    currentMonthKey,
    setMonthDeposit,
    getMonthDeposit
  } = useTrades()

  const [editingDeposit, setEditingDeposit] = useState(false)
  const [tempDeposit, setTempDeposit] = useState('')
  const [showProfitFactorHelp, setShowProfitFactorHelp] = useState(false)

  const formatCurrency = (value) => {
    const absValue = Math.abs(value)
    return `${value < 0 ? '-' : ''}$${absValue.toFixed(2)}`
  }

  const formatPercent = (value) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
  }

  // Calcular rentabilidad sobre capital operativo
  const rentabilityPercent = stats.operatingCapital > 0 
    ? (stats.monthPnL / stats.operatingCapital) * 100 
    : 0

  const handleEditDeposit = () => {
    setTempDeposit(getMonthDeposit(currentMonthKey).toString())
    setEditingDeposit(true)
  }

  const handleSaveDeposit = () => {
    setMonthDeposit(currentMonthKey, tempDeposit)
    setEditingDeposit(false)
  }

  const handleCancelEdit = () => {
    setEditingDeposit(false)
  }

  const monthName = format(selectedMonth, 'MMMM yyyy', { locale: es })

  return (
    <div className="space-y-6">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-bold text-text">Dashboard</h2>
          <p className="text-text-secondary text-sm">Resumen de tu rendimiento</p>
        </div>
        
        <div className="flex items-center gap-3">
          <MonthSelector />
          <button
            onClick={onAddTrade}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Trade</span>
          </button>
        </div>
      </div>

      {/* Monthly Configuration - All stats inside */}
      <div className="card border-primary/30">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            <h3 className="font-medium text-text capitalize">
              {monthName}
            </h3>
          </div>
          {!editingDeposit ? (
            <button
              onClick={handleEditDeposit}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-background-secondary border border-border text-sm text-text-secondary hover:text-primary hover:border-primary/50 transition-colors"
            >
              <Edit3 className="w-4 h-4" />
              Editar Depósito
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={handleSaveDeposit}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-success/20 text-success text-sm hover:bg-success/30 transition-colors"
              >
                <Check className="w-4 h-4" />
                Guardar
              </button>
              <button
                onClick={handleCancelEdit}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-danger/20 text-danger text-sm hover:bg-danger/30 transition-colors"
              >
                <X className="w-4 h-4" />
                Cancelar
              </button>
            </div>
          )}
        </div>

        {editingDeposit ? (
          <div className="max-w-sm">
            <label className="label">Depósito/Aporte del Mes ($)</label>
            <input
              type="number"
              value={tempDeposit}
              onChange={(e) => setTempDeposit(e.target.value)}
              placeholder="Ej: 200.00"
              step="0.01"
              min="0"
              className="input"
            />
            <p className="text-xs text-text-muted mt-1 flex items-center gap-1">
              <Info className="w-3 h-3" />
              Dinero nuevo que agregaste a tu cuenta este mes
            </p>
          </div>
        ) : (
          <>
            {/* Balance Info Row */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
              <div className="p-3 rounded-lg bg-background-secondary">
                <p className="text-xs text-text-muted mb-1">Saldo Anterior</p>
                <p className="text-lg font-bold text-text">
                  ${stats.monthStartingBalance.toFixed(2)}
                </p>
                <p className="text-xs text-text-muted">Automático</p>
              </div>
              <div className="p-3 rounded-lg bg-background-secondary">
                <p className="text-xs text-text-muted mb-1">Depósito</p>
                <p className="text-lg font-bold text-primary">
                  +${stats.monthDeposit.toFixed(2)}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-background-secondary border border-primary/30">
                <p className="text-xs text-text-muted mb-1">Capital Operativo</p>
                <p className="text-lg font-bold text-primary">
                  ${stats.operatingCapital.toFixed(2)}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-background-secondary">
                <p className="text-xs text-text-muted mb-1">P&L del Mes</p>
                <p className={`text-lg font-bold ${stats.monthPnL >= 0 ? 'text-success' : 'text-danger'}`}>
                  {stats.monthPnL >= 0 ? '+' : ''}{stats.monthPnL.toFixed(2)}
                </p>
              </div>
              {/* NEW: Rentabilidad % */}
              <div className="p-3 rounded-lg bg-background-secondary border border-success/30">
                <p className="text-xs text-text-muted mb-1">Rentabilidad</p>
                <p className={`text-lg font-bold ${rentabilityPercent >= 0 ? 'text-success' : 'text-danger'}`}>
                  {rentabilityPercent >= 0 ? '+' : ''}{rentabilityPercent.toFixed(2)}%
                </p>
                <p className="text-xs text-text-muted">Sobre capital</p>
              </div>
              <div className="p-3 rounded-lg bg-background-secondary">
                <p className="text-xs text-text-muted mb-1">Saldo Final</p>
                <p className="text-lg font-bold text-text">
                  ${stats.monthEndingBalance.toFixed(2)}
                </p>
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-border my-4"></div>

            {/* Stats Row - Moved inside the month card */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {/* Total Trades */}
              <div className="p-3 rounded-lg bg-background">
                <div className="flex items-center gap-2 text-text-secondary mb-2">
                  <BarChart3 className="w-4 h-4" />
                  <span className="text-xs font-medium uppercase">Trades</span>
                </div>
                <span className="text-xl font-bold text-text">{stats.totalTrades}</span>
                <div className="flex items-center gap-2 text-xs mt-1">
                  <span className="text-success">{stats.winningTrades}W</span>
                  <span className="text-text-muted">/</span>
                  <span className="text-danger">{stats.losingTrades}L</span>
                </div>
              </div>

              {/* Win Rate */}
              <div className="p-3 rounded-lg bg-background">
                <div className="flex items-center gap-2 text-text-secondary mb-2">
                  <Target className="w-4 h-4" />
                  <span className="text-xs font-medium uppercase">Win Rate</span>
                </div>
                <span className={`text-xl font-bold ${
                  stats.winRate >= 50 ? 'text-success' : 'text-danger'
                }`}>
                  {stats.winRate.toFixed(1)}%
                </span>
                <div className="w-full bg-background-secondary rounded-full h-1.5 mt-2">
                  <div 
                    className={`h-1.5 rounded-full transition-all ${
                      stats.winRate >= 50 ? 'bg-success' : 'bg-danger'
                    }`}
                    style={{ width: `${Math.min(stats.winRate, 100)}%` }}
                  />
                </div>
              </div>

              {/* Profit Factor with Help */}
              <div className="p-3 rounded-lg bg-background relative">
                <div className="flex items-center gap-2 text-text-secondary mb-2">
                  <Percent className="w-4 h-4" />
                  <span className="text-xs font-medium uppercase">Profit Factor</span>
                  <button 
                    onClick={() => setShowProfitFactorHelp(!showProfitFactorHelp)}
                    className="text-text-muted hover:text-primary transition-colors"
                  >
                    <HelpCircle className="w-3.5 h-3.5" />
                  </button>
                </div>
                <span className={`text-xl font-bold ${
                  stats.profitFactor >= 1 ? 'text-success' : 'text-danger'
                }`}>
                  {stats.profitFactor === Infinity ? '∞' : stats.profitFactor.toFixed(2)}
                </span>
                <span className="text-xs text-text-muted block mt-1">
                  {stats.profitFactor >= 1.5 ? 'Excelente' : stats.profitFactor >= 1 ? 'Bueno' : 'Mejorar'}
                </span>
                
                {/* Profit Factor Tooltip */}
                {showProfitFactorHelp && (
                  <div className="absolute z-10 bottom-full left-0 mb-2 p-3 bg-background-secondary border border-border rounded-lg shadow-lg text-xs w-64">
                    <p className="font-medium text-text mb-1">¿Qué es el Profit Factor?</p>
                    <p className="text-text-secondary mb-2">
                      Es la relación entre tus ganancias brutas y tus pérdidas brutas.
                    </p>
                    <p className="text-text-secondary mb-2">
                      <span className="text-primary font-mono">PF = Ganancias ÷ Pérdidas</span>
                    </p>
                    <ul className="text-text-secondary space-y-1">
                      <li>• <span className="text-success">≥ 1.5:</span> Excelente</li>
                      <li>• <span className="text-primary">1.0 - 1.5:</span> Bueno</li>
                      <li>• <span className="text-danger">&lt; 1.0:</span> Perdiendo dinero</li>
                    </ul>
                    <p className="text-text-muted mt-2 text-[10px]">
                      Ej: PF de 1.82 = por cada $1 que pierdes, ganas $1.82
                    </p>
                  </div>
                )}
              </div>

              {/* Total Profit */}
              <div className="p-3 rounded-lg bg-background">
                <div className="flex items-center gap-2 text-success mb-2">
                  <TrendingUp className="w-4 h-4" />
                  <span className="text-xs font-medium uppercase">Ganancias</span>
                </div>
                <span className="text-xl font-bold text-success">
                  ${stats.totalProfit.toFixed(2)}
                </span>
                <span className="text-xs text-text-muted block mt-1">
                  Avg: ${stats.averageWin.toFixed(2)}
                </span>
              </div>

              {/* Total Loss */}
              <div className="p-3 rounded-lg bg-background">
                <div className="flex items-center gap-2 text-danger mb-2">
                  <TrendingDown className="w-4 h-4" />
                  <span className="text-xs font-medium uppercase">Pérdidas</span>
                </div>
                <span className="text-xl font-bold text-danger">
                  -${stats.totalLoss.toFixed(2)}
                </span>
                <span className="text-xs text-text-muted block mt-1">
                  Avg: -${stats.averageLoss.toFixed(2)}
                </span>
              </div>

              {/* Commissions */}
              <div className="p-3 rounded-lg bg-background">
                <div className="flex items-center gap-2 text-warning mb-2">
                  <DollarSign className="w-4 h-4" />
                  <span className="text-xs font-medium uppercase">Comisiones</span>
                </div>
                <span className="text-xl font-bold text-warning">
                  -${stats.totalCommissions.toFixed(2)}
                </span>
                <span className="text-xs text-text-muted block mt-1">
                  Total pagado
                </span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Main Balance Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Monthly Balance Card */}
        <div className="card bg-gradient-to-br from-background-card to-background-secondary border-primary/30">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-primary/20 rounded-lg">
                <Calendar className="w-5 h-5 text-primary" />
              </div>
              <span className="text-text-secondary font-medium capitalize">Balance {monthName}</span>
            </div>
            
            <div className="flex items-baseline gap-4">
              <span className={`font-display text-3xl sm:text-4xl font-bold ${
                stats.monthPnL >= 0 ? 'text-success' : 'text-danger'
              }`}>
                {formatCurrency(stats.monthEndingBalance)}
              </span>
              <span className={`flex items-center gap-1 text-base font-semibold ${
                rentabilityPercent >= 0 ? 'text-success' : 'text-danger'
              }`}>
                {rentabilityPercent >= 0 ? (
                  <ArrowUpRight className="w-4 h-4" />
                ) : (
                  <ArrowDownRight className="w-4 h-4" />
                )}
                {formatPercent(rentabilityPercent)}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-sm">
              <div>
                <span className="text-text-muted">Capital Operativo: </span>
                <span className="text-primary font-medium">${stats.operatingCapital.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-text-muted">P&L: </span>
                <span className={`font-medium ${stats.monthPnL >= 0 ? 'text-success' : 'text-danger'}`}>
                  {formatCurrency(stats.monthPnL)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Total Account Balance Card */}
        <div className="card bg-gradient-to-br from-background-card to-background-secondary border-secondary/30">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-secondary/20 rounded-lg">
                <Wallet className="w-5 h-5 text-secondary" />
              </div>
              <span className="text-text-secondary font-medium">Balance Total Cuenta</span>
            </div>
            
            <div className="flex items-baseline gap-4">
              <span className={`font-display text-3xl sm:text-4xl font-bold ${
                totalBalance.allTimePnL >= 0 ? 'text-success' : 'text-danger'
              }`}>
                {formatCurrency(totalBalance.currentBalance)}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-sm">
              <div>
                <span className="text-text-muted">Capital Inicial: </span>
                <span className="text-text font-medium">${totalBalance.initialCapital.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-text-muted">Depósitos: </span>
                <span className="text-primary font-medium">+${totalBalance.totalDeposits.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-text-muted">P&L Total: </span>
                <span className={`font-medium ${totalBalance.allTimePnL >= 0 ? 'text-success' : 'text-danger'}`}>
                  {formatCurrency(totalBalance.allTimePnL)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Long vs Short Stats - Now above the chart */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-text flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-success" />
              Trades Long
            </h3>
            <span className="text-2xl font-bold text-text">{stats.longTrades}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-text-secondary">Win Rate</span>
            <span className={`font-medium ${stats.longWinRate >= 50 ? 'text-success' : 'text-danger'}`}>
              {stats.longWinRate.toFixed(1)}%
            </span>
          </div>
          <div className="w-full bg-background-secondary rounded-full h-2 mt-2">
            <div 
              className="h-2 rounded-full bg-success transition-all"
              style={{ width: `${Math.min(stats.longWinRate, 100)}%` }}
            />
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-text flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-danger" />
              Trades Short
            </h3>
            <span className="text-2xl font-bold text-text">{stats.shortTrades}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-text-secondary">Win Rate</span>
            <span className={`font-medium ${stats.shortWinRate >= 50 ? 'text-success' : 'text-danger'}`}>
              {stats.shortWinRate.toFixed(1)}%
            </span>
          </div>
          <div className="w-full bg-background-secondary rounded-full h-2 mt-2">
            <div 
              className="h-2 rounded-full bg-danger transition-all"
              style={{ width: `${Math.min(stats.shortWinRate, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Performance by Pair */}
      {Object.keys(stats.byPair).length > 0 && (
        <div className="card">
          <h3 className="font-medium text-text mb-4">Rendimiento por Par</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {Object.entries(stats.byPair)
              .sort((a, b) => b[1].profit - a[1].profit)
              .map(([pair, data]) => (
                <div 
                  key={pair}
                  className={`p-3 rounded-lg border ${
                    data.profit >= 0 
                      ? 'bg-success/10 border-success/30' 
                      : 'bg-danger/10 border-danger/30'
                  }`}
                >
                  <div className="font-medium text-text">{pair}</div>
                  <div className={`text-lg font-bold ${
                    data.profit >= 0 ? 'text-success' : 'text-danger'
                  }`}>
                    {data.profit >= 0 ? '+' : ''}{data.profit.toFixed(2)}
                  </div>
                  <div className="text-xs text-text-secondary">
                    {data.trades} trades · {((data.wins / data.trades) * 100).toFixed(0)}% WR
                  </div>
                </div>
              ))
            }
          </div>
        </div>
      )}

      {/* Chart - Now at the bottom, just before trades table */}
      {monthlyTrades.length > 0 && (
        <div className="card">
          <h3 className="font-medium text-text mb-4">Evolución del Balance - {monthName}</h3>
          <div className="h-48">
            <StatsChart trades={monthlyTrades} startingBalance={stats.operatingCapital} />
          </div>
        </div>
      )}
    </div>
  )
}
