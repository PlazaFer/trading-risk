import { useState } from 'react'
import { Settings, Palette, TrendingUp, Database, HardDrive } from 'lucide-react'
import { useTheme, themes } from '../context/ThemeContext'
import { useTrades } from '../context/TradesContext'

export default function Header({ onSettingsClick }) {
  const { theme, setTheme } = useTheme()
  const { useLocalStorage } = useTrades()
  const [showThemes, setShowThemes] = useState(false)

  return (
    <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-lg border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/20 rounded-lg">
              <TrendingUp className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="font-display text-xl font-bold text-text">
                Trading Risk
              </h1>
              <p className="text-xs text-text-muted">Manager</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {/* Storage Indicator */}
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-background-secondary border border-border text-xs text-text-secondary">
              {useLocalStorage ? (
                <>
                  <HardDrive className="w-3.5 h-3.5" />
                  <span>Local</span>
                </>
              ) : (
                <>
                  <Database className="w-3.5 h-3.5 text-primary" />
                  <span>Supabase</span>
                </>
              )}
            </div>

            {/* Theme Selector */}
            <div className="relative">
              <button
                onClick={() => setShowThemes(!showThemes)}
                className="p-2.5 rounded-lg bg-background-secondary border border-border hover:border-primary/50 transition-colors"
                title="Cambiar tema"
              >
                <Palette className="w-5 h-5 text-text-secondary" />
              </button>

              {showThemes && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setShowThemes(false)} 
                  />
                  <div className="absolute right-0 mt-2 w-56 bg-background-card border border-border rounded-xl shadow-xl z-50 overflow-hidden animate-fade-in">
                    <div className="p-2">
                      <p className="px-3 py-2 text-xs font-semibold text-text-muted uppercase tracking-wider">
                        Tema
                      </p>
                      {themes.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => {
                            setTheme(t.id)
                            setShowThemes(false)
                          }}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                            theme === t.id 
                              ? 'bg-primary/20 text-primary' 
                              : 'hover:bg-background-secondary text-text'
                          }`}
                        >
                          <span className="text-lg">{t.icon}</span>
                          <span className="text-sm font-medium">{t.name}</span>
                          {theme === t.id && (
                            <div className="ml-auto w-2 h-2 rounded-full bg-primary" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Settings Button */}
            <button
              onClick={onSettingsClick}
              className="p-2.5 rounded-lg bg-background-secondary border border-border hover:border-primary/50 transition-colors"
              title="Configuración"
            >
              <Settings className="w-5 h-5 text-text-secondary" />
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}

