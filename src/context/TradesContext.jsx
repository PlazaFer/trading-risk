import { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react'
import { isSupabaseConfigured } from '../lib/supabase'
import toast from 'react-hot-toast'
import { 
  startOfMonth, 
  endOfMonth, 
  format, 
  parseISO,
  isWithinInterval,
  subMonths
} from 'date-fns'

const TradesContext = createContext()

// Default settings
const defaultSettings = {
  accountCapital: 170,
  riskPerTrade: 0.01,
  maxDailyRisk: 0.03,
  defaultLeverage: 3,
  maxMarginPercent: 0.25,
  // Capital inicial de la cuenta (primer mes)
  initialAccountBalance: 0,
}

export function TradesProvider({ children }) {
  const [trades, setTrades] = useState([])
  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('trading-risk-settings')
      return saved ? JSON.parse(saved) : defaultSettings
    } catch {
      return defaultSettings
    }
  })
  
  // Monthly deposits - key is "YYYY-MM", value is { deposit }
  // El saldo inicial ahora se calcula automáticamente
  const [monthlyDeposits, setMonthlyDeposits] = useState(() => {
    try {
      const saved = localStorage.getItem('trading-risk-monthly-deposits')
      return saved ? JSON.parse(saved) : {}
    } catch {
      return {}
    }
  })
  
  const [selectedMonth, setSelectedMonth] = useState(new Date())
  const [isLoading, setIsLoading] = useState(true)
  const [useLocalStorage, setUseLocalStorage] = useState(true)

  // Check if Supabase is available on mount
  useEffect(() => {
    const supabaseAvailable = isSupabaseConfigured()
    setUseLocalStorage(!supabaseAvailable)
  }, [])

  // Load trades and monthly deposits
  useEffect(() => {
    loadTrades()
    loadMonthlyDeposits()
  }, [useLocalStorage])

  // Save settings to localStorage and Supabase
  useEffect(() => {
    try {
      localStorage.setItem('trading-risk-settings', JSON.stringify(settings))
      if (!useLocalStorage && isSupabaseConfigured()) {
        saveSettingsToSupabase(settings)
      }
    } catch (e) {
      console.error('Error saving settings:', e)
    }
  }, [settings, useLocalStorage])

  // Save monthly deposits to localStorage and Supabase
  useEffect(() => {
    try {
      localStorage.setItem('trading-risk-monthly-deposits', JSON.stringify(monthlyDeposits))
      if (!useLocalStorage && isSupabaseConfigured()) {
        saveMonthlyDepositsToSupabase(monthlyDeposits)
      }
    } catch (e) {
      console.error('Error saving monthly deposits:', e)
    }
  }, [monthlyDeposits, useLocalStorage])

  // Get the month key for a given date
  function getMonthKey(date) {
    return format(date, 'yyyy-MM')
  }

  // Find the first month with activity (trades or explicitly set as base month)
  const getBaseMonth = useCallback(() => {
    // Use the configured base month if set
    if (settings.baseMonth) {
      return settings.baseMonth
    }
    
    // Otherwise, find the earliest month with trades
    if (trades.length > 0) {
      const tradeMonths = trades.map(t => {
        try {
          return format(parseISO(t.date), 'yyyy-MM')
        } catch {
          return null
        }
      }).filter(Boolean)
      
      if (tradeMonths.length > 0) {
        return tradeMonths.sort()[0]
      }
    }
    
    // Default to current month
    return format(new Date(), 'yyyy-MM')
  }, [trades, settings.baseMonth])

  // Helper function to calculate P&L for a specific month
  const getMonthPnL = useCallback((monthKey) => {
    const [year, month] = monthKey.split('-').map(Number)
    const monthDate = new Date(year, month - 1, 1)
    const start = startOfMonth(monthDate)
    const end = endOfMonth(monthDate)
    
    const monthTrades = trades.filter(trade => {
      try {
        const tradeDate = parseISO(trade.date)
        return isWithinInterval(tradeDate, { start, end })
      } catch {
        return false
      }
    })
    
    return monthTrades.reduce((sum, t) => sum + t.final_result, 0)
  }, [trades])

  // Internal function to get starting balance for a month
  // Returns the ending balance of the PREVIOUS month
  const getMonthStartingBalanceInternal = useCallback((monthKey) => {
    const baseMonth = getBaseMonth()
    
    // If this is the base month or before, return initial capital
    if (monthKey <= baseMonth) {
      return settings.initialAccountBalance || 0
    }
    
    // Calculate previous month's ending balance
    const [year, month] = monthKey.split('-').map(Number)
    const monthDate = new Date(year, month - 1, 1)
    const prevMonth = subMonths(monthDate, 1)
    const prevMonthKey = format(prevMonth, 'yyyy-MM')
    
    // If previous month is the base month, calculate its ending balance
    if (prevMonthKey === baseMonth) {
      const initialBalance = settings.initialAccountBalance || 0
      const baseDeposit = monthlyDeposits[baseMonth]?.deposit || 0
      const basePnL = getMonthPnL(baseMonth)
      return initialBalance + baseDeposit + basePnL
    }
    
    // Recursively get previous month's starting balance and add its P&L and deposits
    const prevStartingBalance = getMonthStartingBalanceInternal(prevMonthKey)
    const prevDeposit = monthlyDeposits[prevMonthKey]?.deposit || 0
    const prevPnL = getMonthPnL(prevMonthKey)
    
    return prevStartingBalance + prevDeposit + prevPnL
  }, [trades, monthlyDeposits, settings.initialAccountBalance, getBaseMonth, getMonthPnL])

  // Calculate the ending balance for a specific month
  const calculateMonthEndingBalance = useCallback((monthKey) => {
    const startingBalance = getMonthStartingBalanceInternal(monthKey)
    const monthDeposit = monthlyDeposits[monthKey]?.deposit || 0
    const monthPnL = getMonthPnL(monthKey)
    
    return startingBalance + monthDeposit + monthPnL
  }, [getMonthStartingBalanceInternal, monthlyDeposits, getMonthPnL])

  // Public function to get starting balance for a specific month
  const getMonthStartingBalance = useCallback((monthKey) => {
    return getMonthStartingBalanceInternal(monthKey)
  }, [getMonthStartingBalanceInternal])

  // Set deposit for a specific month
  function setMonthDeposit(monthKey, deposit) {
    setMonthlyDeposits(prev => ({
      ...prev,
      [monthKey]: { 
        deposit: parseFloat(deposit) || 0 
      }
    }))
    toast.success('Depósito actualizado')
  }

  // Get deposit for a specific month
  function getMonthDeposit(monthKey) {
    return monthlyDeposits[monthKey]?.deposit || 0
  }

  // Save settings to Supabase
  async function saveSettingsToSupabase(settingsData) {
    if (!isSupabaseConfigured()) return
    
    try {
      const { createClient } = await import('@supabase/supabase-js')
      const supabase = createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_ANON_KEY
      )
      
      await supabase
        .from('app_settings')
        .upsert([{ id: 'main', settings: settingsData }], { onConflict: 'id' })
    } catch (error) {
      console.error('Error saving settings to Supabase:', error)
    }
  }

  // Save monthly deposits to Supabase
  async function saveMonthlyDepositsToSupabase(depositsData) {
    if (!isSupabaseConfigured()) return
    
    try {
      const { createClient } = await import('@supabase/supabase-js')
      const supabase = createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_ANON_KEY
      )
      
      await supabase
        .from('app_settings')
        .upsert([{ id: 'monthly_deposits', settings: depositsData }], { onConflict: 'id' })
    } catch (error) {
      console.error('Error saving monthly deposits to Supabase:', error)
    }
  }

  // Load monthly deposits from Supabase
  async function loadMonthlyDeposits() {
    if (useLocalStorage || !isSupabaseConfigured()) {
      return
    }

    try {
      const { createClient } = await import('@supabase/supabase-js')
      const supabase = createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_ANON_KEY
      )
      
      // Load settings
      const { data: settingsData } = await supabase
        .from('app_settings')
        .select('settings')
        .eq('id', 'main')
        .single()
      
      if (settingsData?.settings) {
        setSettings(settingsData.settings)
      }
      
      // Load monthly deposits
      const { data: depositsData } = await supabase
        .from('app_settings')
        .select('settings')
        .eq('id', 'monthly_deposits')
        .single()
      
      if (depositsData?.settings) {
        setMonthlyDeposits(depositsData.settings)
      }
    } catch (error) {
      console.error('Error loading settings from Supabase:', error)
    }
  }

  async function loadTrades() {
    setIsLoading(true)
    
    if (useLocalStorage || !isSupabaseConfigured()) {
      try {
        const saved = localStorage.getItem('trading-risk-trades')
        setTrades(saved ? JSON.parse(saved) : [])
      } catch {
        setTrades([])
      }
      setIsLoading(false)
      return
    }

    try {
      const { createClient } = await import('@supabase/supabase-js')
      const supabase = createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_ANON_KEY
      )
      
      const { data, error } = await supabase
        .from('trades')
        .select('*')
        .order('date', { ascending: false })

      if (error) throw error
      setTrades(data || [])
    } catch (error) {
      console.error('Error loading trades:', error)
      toast.error('Error al cargar trades, usando almacenamiento local')
      setUseLocalStorage(true)
      try {
        const saved = localStorage.getItem('trading-risk-trades')
        setTrades(saved ? JSON.parse(saved) : [])
      } catch {
        setTrades([])
      }
    } finally {
      setIsLoading(false)
    }
  }

  async function addTrade(trade) {
    const newTrade = {
      ...trade,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
    }

    if (useLocalStorage || !isSupabaseConfigured()) {
      const updated = [newTrade, ...trades]
      setTrades(updated)
      try {
        localStorage.setItem('trading-risk-trades', JSON.stringify(updated))
      } catch (e) {
        console.error('Error saving trade:', e)
      }
      toast.success('Trade agregado')
      return newTrade
    }

    try {
      const { createClient } = await import('@supabase/supabase-js')
      const supabase = createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_ANON_KEY
      )
      
      const { data, error } = await supabase
        .from('trades')
        .insert([newTrade])
        .select()
        .single()

      if (error) throw error
      setTrades(prev => [data, ...prev])
      toast.success('Trade agregado')
      return data
    } catch (error) {
      console.error('Error adding trade:', error)
      toast.error('Error al agregar trade')
      throw error
    }
  }

  async function updateTrade(id, updates) {
    if (useLocalStorage || !isSupabaseConfigured()) {
      const updated = trades.map(t => t.id === id ? { ...t, ...updates } : t)
      setTrades(updated)
      try {
        localStorage.setItem('trading-risk-trades', JSON.stringify(updated))
      } catch (e) {
        console.error('Error updating trade:', e)
      }
      toast.success('Trade actualizado')
      return
    }

    try {
      const { createClient } = await import('@supabase/supabase-js')
      const supabase = createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_ANON_KEY
      )
      
      const { error } = await supabase
        .from('trades')
        .update(updates)
        .eq('id', id)

      if (error) throw error
      setTrades(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t))
      toast.success('Trade actualizado')
    } catch (error) {
      console.error('Error updating trade:', error)
      toast.error('Error al actualizar trade')
      throw error
    }
  }

  async function deleteTrade(id) {
    if (useLocalStorage || !isSupabaseConfigured()) {
      const updated = trades.filter(t => t.id !== id)
      setTrades(updated)
      try {
        localStorage.setItem('trading-risk-trades', JSON.stringify(updated))
      } catch (e) {
        console.error('Error deleting trade:', e)
      }
      toast.success('Trade eliminado')
      return
    }

    try {
      const { createClient } = await import('@supabase/supabase-js')
      const supabase = createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_ANON_KEY
      )
      
      const { error } = await supabase
        .from('trades')
        .delete()
        .eq('id', id)

      if (error) throw error
      setTrades(prev => prev.filter(t => t.id !== id))
      toast.success('Trade eliminado')
    } catch (error) {
      console.error('Error deleting trade:', error)
      toast.error('Error al eliminar trade')
      throw error
    }
  }

  // Filter trades by selected month
  const monthlyTrades = useMemo(() => {
    const start = startOfMonth(selectedMonth)
    const end = endOfMonth(selectedMonth)
    
    return trades.filter(trade => {
      try {
        const tradeDate = parseISO(trade.date)
        return isWithinInterval(tradeDate, { start, end })
      } catch {
        return false
      }
    })
  }, [trades, selectedMonth])

  // Current month key
  const currentMonthKey = useMemo(() => getMonthKey(selectedMonth), [selectedMonth])

  // Calculate statistics for the selected month
  const stats = useMemo(() => {
    const monthTrades = monthlyTrades
    const monthKey = currentMonthKey
    
    // Get starting balance (calculated from previous month automatically)
    const monthStartingBalance = getMonthStartingBalance(monthKey)
    const monthDeposit = getMonthDeposit(monthKey)
    
    // Capital operativo = saldo inicial (automático) + depósitos del mes
    const operatingCapital = monthStartingBalance + monthDeposit
    
    if (monthTrades.length === 0) {
      return {
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        winRate: 0,
        totalProfit: 0,
        totalLoss: 0,
        netResult: 0,
        totalCommissions: 0,
        averageWin: 0,
        averageLoss: 0,
        profitFactor: 0,
        largestWin: 0,
        largestLoss: 0,
        monthStartingBalance,
        monthDeposit,
        operatingCapital,
        monthEndingBalance: operatingCapital,
        monthPnL: 0,
        monthPnLPercent: 0,
        longTrades: 0,
        shortTrades: 0,
        longWinRate: 0,
        shortWinRate: 0,
        byPair: {},
      }
    }

    const winningTrades = monthTrades.filter(t => t.balance_trade > 0)
    const losingTrades = monthTrades.filter(t => t.balance_trade < 0)
    
    const totalProfit = winningTrades.reduce((sum, t) => sum + t.balance_trade, 0)
    const totalLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.balance_trade, 0))
    const totalCommissions = monthTrades.reduce((sum, t) => sum + (t.commission || 0), 0)
    const netResult = monthTrades.reduce((sum, t) => sum + t.final_result, 0)
    
    const longTrades = monthTrades.filter(t => t.direction === 'Long')
    const shortTrades = monthTrades.filter(t => t.direction === 'Short')
    const longWins = longTrades.filter(t => t.balance_trade > 0).length
    const shortWins = shortTrades.filter(t => t.balance_trade > 0).length

    // Stats by pair
    const byPair = monthTrades.reduce((acc, trade) => {
      if (!acc[trade.pair]) {
        acc[trade.pair] = { trades: 0, profit: 0, wins: 0 }
      }
      acc[trade.pair].trades++
      acc[trade.pair].profit += trade.final_result
      if (trade.balance_trade > 0) acc[trade.pair].wins++
      return acc
    }, {})

    // Month ending balance = capital operativo + P&L
    const monthEndingBalance = operatingCapital + netResult
    // % se calcula sobre el capital operativo (saldo + depósito)
    const monthPnLPercent = operatingCapital > 0 ? (netResult / operatingCapital) * 100 : 0

    return {
      totalTrades: monthTrades.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      winRate: monthTrades.length > 0 ? (winningTrades.length / monthTrades.length) * 100 : 0,
      totalProfit,
      totalLoss,
      netResult,
      totalCommissions,
      averageWin: winningTrades.length > 0 ? totalProfit / winningTrades.length : 0,
      averageLoss: losingTrades.length > 0 ? totalLoss / losingTrades.length : 0,
      profitFactor: totalLoss > 0 ? totalProfit / totalLoss : totalProfit > 0 ? Infinity : 0,
      largestWin: winningTrades.length > 0 ? Math.max(...winningTrades.map(t => t.balance_trade)) : 0,
      largestLoss: losingTrades.length > 0 ? Math.min(...losingTrades.map(t => t.balance_trade)) : 0,
      operatingCapital,
      monthStartingBalance,
      monthDeposit,
      monthEndingBalance,
      monthPnL: netResult,
      monthPnLPercent,
      longTrades: longTrades.length,
      shortTrades: shortTrades.length,
      longWinRate: longTrades.length > 0 ? (longWins / longTrades.length) * 100 : 0,
      shortWinRate: shortTrades.length > 0 ? (shortWins / shortTrades.length) * 100 : 0,
      byPair,
    }
  }, [monthlyTrades, currentMonthKey, getMonthStartingBalance, monthlyDeposits])

  // Calculate total account balance (current)
  const totalBalance = useMemo(() => {
    const allTimePnL = trades.reduce((sum, t) => sum + t.final_result, 0)
    const allDeposits = Object.values(monthlyDeposits).reduce((sum, m) => sum + (m.deposit || 0), 0)
    const initialCapital = settings.initialAccountBalance || 0
    
    return {
      initialCapital,
      totalDeposits: allDeposits,
      allTimePnL,
      currentBalance: initialCapital + allDeposits + allTimePnL,
    }
  }, [trades, monthlyDeposits, settings.initialAccountBalance])

  const value = {
    trades,
    monthlyTrades,
    settings,
    setSettings,
    selectedMonth,
    setSelectedMonth,
    stats,
    totalBalance,
    isLoading,
    useLocalStorage,
    setUseLocalStorage,
    addTrade,
    updateTrade,
    deleteTrade,
    loadTrades,
    // Monthly balance functions
    monthlyDeposits,
    currentMonthKey,
    getMonthKey,
    setMonthDeposit,
    getMonthStartingBalance,
    getMonthDeposit,
  }

  return (
    <TradesContext.Provider value={value}>
      {children}
    </TradesContext.Provider>
  )
}

export function useTrades() {
  const context = useContext(TradesContext)
  if (!context) {
    throw new Error('useTrades must be used within a TradesProvider')
  }
  return context
}
