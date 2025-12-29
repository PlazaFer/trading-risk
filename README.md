# 📈 Trading Risk Manager

Una aplicación web minimalista y elegante para gestionar y trackear tus trades de criptomonedas.

![Trading Risk Manager](https://img.shields.io/badge/React-18-blue?logo=react)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38bdf8?logo=tailwindcss)
![Vite](https://img.shields.io/badge/Vite-5-646cff?logo=vite)

## ✨ Características

- 📊 **Dashboard completo** - Balance actual, win rate, profit factor y más
- 📝 **Registro de trades** - Fecha, par, dirección, balance, comisiones
- 📈 **Estadísticas detalladas** - Por mes, por par, Long vs Short
- 🎨 **7 temas visuales** - Cambia el look con un click
- 💾 **Doble almacenamiento** - Local Storage o Supabase (nube)
- 📱 **Responsive** - Funciona en móvil y desktop
- 🔄 **Import/Export** - Backup de tus datos en JSON

## 🚀 Inicio Rápido

### 1. Instalar dependencias

```bash
npm install
```

### 2. Iniciar en desarrollo

```bash
npm run dev
```

La app se abrirá en `http://localhost:3000`

### 3. Build para producción

```bash
npm run build
```

## 🗄️ Configurar Base de Datos (Opcional)

Por defecto, la app usa **Local Storage** del navegador. Si quieres sincronizar entre dispositivos, configura Supabase:

### Paso 1: Crear proyecto en Supabase

1. Ve a [supabase.com](https://supabase.com) y crea una cuenta gratuita
2. Crea un nuevo proyecto

### Paso 2: Crear la tabla

Ve al **SQL Editor** en Supabase y ejecuta:

```sql
-- Create trades table
CREATE TABLE trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  pair VARCHAR(20) NOT NULL,
  direction VARCHAR(10) NOT NULL CHECK (direction IN ('Long', 'Short')),
  balance_trade DECIMAL(12, 4) NOT NULL,
  commission DECIMAL(12, 4) DEFAULT 0,
  final_result DECIMAL(12, 4) NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_trades_date ON trades(date DESC);
CREATE INDEX idx_trades_pair ON trades(pair);

-- Enable Row Level Security
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;

-- Allow all operations (for personal use)
CREATE POLICY "Allow all operations" ON trades
  FOR ALL USING (true) WITH CHECK (true);
```

### Paso 3: Configurar variables de entorno

1. Ve a **Project Settings > API** en Supabase
2. Copia la **Project URL** y la **anon public key**
3. Crea un archivo `.env` en la raíz del proyecto:

```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key
```

4. Reinicia el servidor de desarrollo

## 🌐 Deploy Gratuito

### Vercel (Recomendado)

1. Sube tu código a GitHub
2. Ve a [vercel.com](https://vercel.com)
3. Importa tu repositorio
4. Agrega las variables de entorno si usas Supabase
5. Deploy!

### Netlify

1. Ve a [netlify.com](https://netlify.com)
2. Arrastra la carpeta `dist/` (después de hacer build)
3. O conecta con GitHub para deploy automático

### Cloudflare Pages

1. Ve a [pages.cloudflare.com](https://pages.cloudflare.com)
2. Conecta tu repositorio de GitHub
3. Configura el build command: `npm run build`
4. Output directory: `dist`

## 🎨 Temas Disponibles

- 🌲 **Midnight Emerald** (default) - Verde esmeralda sobre fondo oscuro
- 🔮 **Cyber Purple** - Púrpura neón cyberpunk
- 🌊 **Ocean Blue** - Azul océano profundo
- 🌅 **Sunset Orange** - Naranja atardecer cálido
- 💻 **Matrix Green** - Verde Matrix hacker
- 🌸 **Rose Gold** - Rosa dorado elegante
- ☀️ **Light Mode** - Modo claro para el día

## 📁 Estructura del Proyecto

```
trading-risk/
├── public/
│   └── favicon.svg
├── src/
│   ├── components/
│   │   ├── Dashboard.jsx      # Panel principal con stats
│   │   ├── Header.jsx         # Header con tema y config
│   │   ├── MonthSelector.jsx  # Selector de mes
│   │   ├── SettingsPanel.jsx  # Panel de configuración
│   │   ├── StatsChart.jsx     # Gráfico de balance
│   │   ├── TradeForm.jsx      # Formulario de trade
│   │   └── TradesTable.jsx    # Tabla de trades
│   ├── context/
│   │   ├── ThemeContext.jsx   # Estado de temas
│   │   └── TradesContext.jsx  # Estado de trades y stats
│   ├── lib/
│   │   └── supabase.js        # Cliente de Supabase
│   ├── App.jsx
│   ├── index.css              # Variables CSS y estilos
│   └── main.jsx
├── .env.example
├── .gitignore
├── index.html
├── package.json
├── postcss.config.js
├── tailwind.config.js
└── vite.config.js
```

## 🛠️ Tecnologías

- **React 18** - UI library
- **Vite 5** - Build tool ultra rápido
- **Tailwind CSS 3.4** - Utility-first CSS
- **Supabase** - Backend as a Service (PostgreSQL)
- **Recharts** - Gráficos
- **date-fns** - Manejo de fechas
- **Lucide React** - Iconos
- **React Hot Toast** - Notificaciones

## 📝 Campos de un Trade

| Campo | Descripción |
|-------|-------------|
| `date` | Fecha del trade |
| `pair` | Par de criptomonedas (BTC, ETH, etc.) |
| `direction` | Long o Short |
| `balance_trade` | Ganancia/pérdida bruta |
| `commission` | Comisión pagada |
| `final_result` | Resultado neto (balance - comisión) |
| `notes` | Notas opcionales |

## 📄 Licencia

MIT - Úsalo como quieras 🚀

