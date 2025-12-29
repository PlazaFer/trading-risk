import { createContext, useContext, useState, useEffect } from 'react'

const ThemeContext = createContext()

export const themes = [
  { id: 'default', name: 'Midnight Emerald', icon: '🌲' },
  { id: 'cyber-purple', name: 'Cyber Purple', icon: '🔮' },
  { id: 'ocean-blue', name: 'Ocean Blue', icon: '🌊' },
  { id: 'sunset-orange', name: 'Sunset Orange', icon: '🌅' },
  { id: 'matrix-green', name: 'Matrix Green', icon: '💻' },
  { id: 'rose-gold', name: 'Rose Gold', icon: '🌸' },
  { id: 'light', name: 'Light Mode', icon: '☀️' },
]

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('trading-risk-theme')
    return saved || 'default'
  })

  useEffect(() => {
    localStorage.setItem('trading-risk-theme', theme)
    
    if (theme === 'default') {
      document.documentElement.removeAttribute('data-theme')
    } else {
      document.documentElement.setAttribute('data-theme', theme)
    }
  }, [theme])

  return (
    <ThemeContext.Provider value={{ theme, setTheme, themes }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}

