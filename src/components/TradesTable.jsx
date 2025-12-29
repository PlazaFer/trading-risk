import { useState, useMemo } from 'react'
import { 
  Trash2, 
  Edit2, 
  TrendingUp, 
  TrendingDown, 
  Search,
  Filter,
  ChevronDown,
  ChevronUp
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { useTrades } from '../context/TradesContext'
import TradeForm from './TradeForm'

export default function TradesTable() {
  const { monthlyTrades, deleteTrade } = useTrades()
  const [editingTrade, setEditingTrade] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [directionFilter, setDirectionFilter] = useState('all')
  const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' })
  const [showFilters, setShowFilters] = useState(false)
  const [deletingId, setDeletingId] = useState(null)

  // Filter and sort trades
  const filteredTrades = useMemo(() => {
    let result = [...monthlyTrades]

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      result = result.filter(trade => 
        trade.pair.toLowerCase().includes(term) ||
        trade.notes?.toLowerCase().includes(term)
      )
    }

    // Direction filter
    if (directionFilter !== 'all') {
      result = result.filter(trade => trade.direction === directionFilter)
    }

    // Sort
    result.sort((a, b) => {
      let aValue = a[sortConfig.key]
      let bValue = b[sortConfig.key]

      if (sortConfig.key === 'date') {
        aValue = new Date(aValue)
        bValue = new Date(bValue)
      }

      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1
      return 0
    })

    return result
  }, [monthlyTrades, searchTerm, directionFilter, sortConfig])

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }))
  }

  const handleDelete = async (id) => {
    if (window.confirm('¿Estás seguro de eliminar este trade?')) {
      setDeletingId(id)
      try {
        await deleteTrade(id)
      } finally {
        setDeletingId(null)
      }
    }
  }

  const SortIcon = ({ columnKey }) => {
    if (sortConfig.key !== columnKey) {
      return <ChevronDown className="w-4 h-4 opacity-30" />
    }
    return sortConfig.direction === 'asc' 
      ? <ChevronUp className="w-4 h-4 text-primary" />
      : <ChevronDown className="w-4 h-4 text-primary" />
  }

  if (monthlyTrades.length === 0) {
    return (
      <div className="card text-center py-12">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-background-secondary flex items-center justify-center">
          <TrendingUp className="w-8 h-8 text-text-muted" />
        </div>
        <h3 className="text-lg font-medium text-text mb-2">Sin trades este mes</h3>
        <p className="text-text-secondary">
          Agrega tu primer trade para comenzar a trackear tu rendimiento
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h3 className="font-display text-lg font-bold text-text">
          Historial de Trades
          <span className="ml-2 text-sm font-normal text-text-secondary">
            ({filteredTrades.length} trades)
          </span>
        </h3>

        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative flex-1 sm:flex-none">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar par..."
              className="w-full sm:w-48 bg-background-secondary border border-border rounded-lg pl-10 pr-4 py-2 text-text placeholder-text-muted focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-sm"
            />
          </div>

          {/* Filter Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-2 rounded-lg border transition-colors flex-shrink-0 ${
              showFilters || directionFilter !== 'all'
                ? 'bg-primary/20 border-primary text-primary'
                : 'bg-background-secondary border-border text-text-secondary hover:border-primary/50'
            }`}
          >
            <Filter className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="flex flex-wrap gap-2 p-4 bg-background-secondary rounded-lg border border-border animate-fade-in">
          <span className="text-sm text-text-secondary mr-2">Dirección:</span>
          {['all', 'Long', 'Short'].map(option => (
            <button
              key={option}
              onClick={() => setDirectionFilter(option)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                directionFilter === option
                  ? 'bg-primary text-white'
                  : 'bg-background-card text-text-secondary hover:text-text'
              }`}
            >
              {option === 'all' ? 'Todos' : option}
            </button>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="table-container bg-background-card">
        <table className="table">
          <thead>
            <tr>
              <th 
                className="cursor-pointer select-none"
                onClick={() => handleSort('date')}
              >
                <div className="flex items-center gap-1">
                  Fecha
                  <SortIcon columnKey="date" />
                </div>
              </th>
              <th 
                className="cursor-pointer select-none"
                onClick={() => handleSort('pair')}
              >
                <div className="flex items-center gap-1">
                  Par
                  <SortIcon columnKey="pair" />
                </div>
              </th>
              <th>Dirección</th>
              <th 
                className="cursor-pointer select-none text-right"
                onClick={() => handleSort('balance_trade')}
              >
                <div className="flex items-center justify-end gap-1">
                  Balance
                  <SortIcon columnKey="balance_trade" />
                </div>
              </th>
              <th className="text-right">Comisión</th>
              <th 
                className="cursor-pointer select-none text-right"
                onClick={() => handleSort('final_result')}
              >
                <div className="flex items-center justify-end gap-1">
                  Resultado
                  <SortIcon columnKey="final_result" />
                </div>
              </th>
              <th className="text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredTrades.map((trade, index) => (
              <tr 
                key={trade.id}
                className="animate-fade-in"
                style={{ animationDelay: `${index * 30}ms` }}
              >
                <td className="font-medium text-text">
                  {format(parseISO(trade.date), 'dd/MM/yyyy', { locale: es })}
                </td>
                <td>
                  <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-background-secondary font-medium text-text">
                    {trade.pair}
                  </span>
                </td>
                <td>
                  <span className={`badge ${
                    trade.direction === 'Long' ? 'badge-success' : 'badge-danger'
                  }`}>
                    {trade.direction === 'Long' ? (
                      <TrendingUp className="w-3.5 h-3.5 mr-1" />
                    ) : (
                      <TrendingDown className="w-3.5 h-3.5 mr-1" />
                    )}
                    {trade.direction}
                  </span>
                </td>
                <td className={`text-right font-medium ${
                  trade.balance_trade >= 0 ? 'text-success' : 'text-danger'
                }`}>
                  {trade.balance_trade >= 0 ? '+' : ''}${trade.balance_trade.toFixed(4)}
                </td>
                <td className="text-right text-warning">
                  -${(trade.commission || 0).toFixed(4)}
                </td>
                <td className={`text-right font-bold ${
                  trade.final_result >= 0 ? 'text-success' : 'text-danger'
                }`}>
                  {trade.final_result >= 0 ? '+' : ''}${trade.final_result.toFixed(4)}
                </td>
                <td className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => setEditingTrade(trade)}
                      className="p-1.5 rounded-lg hover:bg-background-secondary text-text-secondary hover:text-primary transition-colors"
                      title="Editar"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(trade.id)}
                      className="p-1.5 rounded-lg hover:bg-danger/20 text-text-secondary hover:text-danger transition-colors"
                      title="Eliminar"
                      disabled={deletingId === trade.id}
                    >
                      {deletingId === trade.id ? (
                        <div className="w-4 h-4 border-2 border-danger/30 border-t-danger rounded-full animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit Modal */}
      {editingTrade && (
        <TradeForm 
          editTrade={editingTrade} 
          onClose={() => setEditingTrade(null)} 
        />
      )}
    </div>
  )
}
