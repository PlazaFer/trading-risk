# NQ Journal

Journal de trading para futuros del Nasdaq 100 (**NQ** y **MNQ**), con calendario,
capturas de gráfico por trade y analítica de rendimiento.

![React](https://img.shields.io/badge/React-18-61dafb?logo=react&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5-646cff?logo=vite&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind-3.4-38bdf8?logo=tailwindcss&logoColor=white)

---

## Arranque

```bash
npm install
cp .env.example .env    # completá la URL y la anon key de tu proyecto
npm run dev             # http://localhost:3000
```

**Supabase es obligatorio.** Todo el journal vive ahí — trades, notas diarias,
movimientos de capital, ajustes y capturas — y no hay almacenamiento local de
respaldo. Sin las variables de entorno la app arranca pero no puede leer ni
escribir nada; ver [Supabase](#supabase) más abajo.

Para ver la app con contenido antes de cargar tus trades reales:
**Ajustes → Datos → Cargar datos de ejemplo**.

---

## Qué hace

### Journal

- **Calendario mensual** con el P&L de cada día, coloreado por intensidad
  relativa al mes, resumen semanal en la columna lateral, y un clic para entrar
  al detalle del día.
- **Hasta 3 capturas por trade**, con drag & drop, selector de archivos o
  `Ctrl/⌘ + V` directo desde TradingView. Se comprimen a WebP (~200 KB) antes de
  guardarse y se ven en un visor a pantalla completa con zoom y navegación por
  teclado.
- **Diario del día**: sesgo de mercado, estado mental, disciplina, plan
  pre-market, cómo se desarrolló y la lección del día. Se guarda solo.
- **Registro completo del trade**: setup, etiquetas, errores cometidos, emoción
  dominante, calidad de ejecución (1–5), si seguiste el plan, y notas libres.

### Cálculo

Pensado para futuros, no adaptado desde cripto:

- Especificaciones reales de cada contrato — MNQ ($2/punto), NQ ($20/punto), más
  ES, MES, YM, RTY, GC, CL y sus micros.
- P&L desde precios de entrada y salida (puntos → ticks → dólares × contratos),
  o carga manual del neto si preferís copiarlo del bróker.
- Comisión por contrato ida y vuelta, prellenada y editable.
- **R-múltiplo** calculado desde tu stop real, y RR planificado desde el target.
- **Sesión de mercado** detectada automáticamente en hora de Nueva York
  (Asia / Londres / Pre-Market / NY AM / Lunch / NY PM / After Hours), sin
  importar en qué zona horaria cargues los datos.
- **Día de trading Globex**: una entrada a las 21:30 ET del lunes cuenta como
  martes, igual que en tu estado de cuenta.

### Riesgo deducido del R:R

Si cargás por P&L manual, alcanza con el resultado y el R:R utilizado para que
el journal sepa cuánto arriesgaste:

| Resultado | R:R | Riesgo deducido | R obtenido | % del capital |
|---|---|---|---|---|
| +$525 | 1 : 1.5 | $350 | +1.5R | 0,70% |
| −$350 | 1 : 1.5 | $350 | −1.0R | 0,70% |

En la ganancia el riesgo sale de dividir el resultado por el R:R; en la pérdida
no se divide, porque cuando te saca el stop perdés exactamente el 1R que
pusiste, no 1.5R. Por eso los dos casos dan el mismo 0,70%: el riesgo es una
propiedad de la posición, no de cómo terminó.

El porcentaje se mide contra el **capital a arriesgar**, configurable aparte del
capital inicial, para cuando dimensionás contra una cuenta fondeada o contra una
porción del balance.

El riesgo se resuelve en este orden, y gana el primero que aplique:

1. **Riesgo real ($)** cargado a mano en el trade
2. **Distancia al stop**, cuando cargaste precios
3. **R:R utilizado**, con la regla de arriba
4. **Riesgo por defecto** de Ajustes

### Analítica

Win rate, profit factor, expectativa por trade, R promedio y acumulado, payoff,
máximo drawdown ($ y %), rachas, días verdes vs rojos, duración media de
ganadores contra perdedores, y curva de capital.

Filtrable por presets (este mes, mes pasado, 30/90 días, este año) o por un
**rango de fechas exacto**.

Desglose de rendimiento por setup, sesión, hora de entrada, día de la semana,
dirección, tamaño de posición, tamaño del riesgo, instrumento, etiqueta y estado
mental.

Tres análisis que la mayoría de los journals no trae:

- **Cuánto te cuesta cada error** — el total en dólares de los trades marcados
  con cada error del vocabulario.
- **Disciplina** — el resultado promedio de los trades donde seguiste el plan
  contra aquellos donde improvisaste.
- **Gestión de riesgo** — riesgo medio y máximo como % del capital, trades que
  superaron tu límite, y los días en que rompiste tu pérdida máxima diaria o tu
  tope de trades. Cada día roto enlaza a su página.

### Exportar

- **CSV de trades** — una fila por trade con los 33 campos, incluidos los
  derivados (puntos, ticks, R-múltiplo, sesión, duración). Listo para Excel,
  Google Sheets o pandas.
- **CSV diario** — resumen agregado por día de trading.
- **Backup JSON** — trades, diario, movimientos de capital y ajustes.
  Opcionalmente con las capturas embebidas en base64.
- Todo respeta los filtros activos en la pantalla de Trades.

---

## Supabase

Es el único almacenamiento de la app. No hay nada que elegir en Ajustes: si las
credenciales están, el journal funciona; si no, avisa y no guarda nada.

1. Creá un proyecto en [supabase.com](https://supabase.com)
2. Ejecutá [`supabase/schema.sql`](supabase/schema.sql) en el SQL Editor — crea
   las tablas, los índices, el bucket de imágenes y tres vistas de análisis
3. Copiá `.env.example` a `.env` y completá la URL y la anon key
4. Reiniciá el servidor

Vite inlinea las `VITE_*` en el bundle **al compilar**, no las lee en runtime.
Por eso en Vercel van en *Environment Variables* y hace falta redeployar para
que un cambio tome efecto.

El esquema incluye vistas listas para usar:

```sql
select * from v_daily_pnl;            -- P&L por día
select * from v_setup_performance;    -- rendimiento por setup
select * from v_session_performance;  -- rendimiento por sesión
```

> ⚠️ **El deploy no tiene login.** La anon key queda visible en el JavaScript
> público y las policies de `schema.sql` son permisivas (`using (true)`), así que
> cualquiera que abra la URL puede leer, editar y borrar el journal completo. No
> compartas el link. Para cerrarlo: agregá una columna `user_id`, cambiá las
> policies a `auth.uid() = user_id` y poné Supabase Auth adelante.

---

## Atajos

| Tecla | Acción |
|---|---|
| `N` | Nuevo trade |
| `Ctrl/⌘ + V` | Pegar captura en el formulario |
| `Esc` | Cerrar modal o visor |
| `←` `→` | Navegar capturas en el visor |
| `+` `−` | Zoom en el visor |

---

## Estructura

```
src/
├── lib/
│   ├── instruments.js   Especificaciones de contratos de futuros
│   ├── time.js          Zonas horarias, sesiones y día de trading Globex
│   ├── calc.js          Derivación de trades y motor de estadísticas
│   ├── imageStore.js    Compresión y subida de capturas al bucket
│   ├── repo.js          Repositorio: todas las lecturas y escrituras
│   ├── supabase.js      Cliente Supabase y configuración
│   ├── exporter.js      CSV / JSON, importación de backups
│   ├── taxonomy.js      Setups, errores, emociones por defecto
│   └── periods.js       Rangos de fechas
├── context/
│   ├── JournalContext   Datos, ajustes y mutaciones
│   └── UIContext        Modales de trade y atajos globales
├── components/
│   ├── ui/              Modal, TagPicker, ImageUploader, Lightbox…
│   ├── charts/          Curva de capital, P&L diario, distribución de R
│   ├── journal/         Calendario, formulario, tarjeta y detalle de trade
│   └── layout/          Shell y navegación
└── pages/               Dashboard, Calendario, Día, Trades, Analítica, Ajustes
```

---

## Deploy en Vercel

El repo ya trae `vercel.json` con el framework, el build y los headers de caché.

**Desde la web (recomendado):**

1. `git push` de la rama `main`
2. Entrá a [vercel.com/new](https://vercel.com/new) e importá `trading-risk`
3. Vercel detecta Vite y lee `vercel.json` — no toques nada
4. Agregá `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` en **Environment
   Variables** antes de deployar — sin eso el build sale sin credenciales y la
   app no puede guardar nada
5. **Deploy**

Cada push a `main` redeploya solo. Las ramas obtienen su propia preview URL.

**Desde la terminal:**

```bash
npx vercel          # preview
npx vercel --prod   # producción
```

Usa hash routing, así que los enlaces profundos (`#/dia/2026-08-19`) funcionan
sin configurar redirecciones.

> Los datos viven en Supabase, no en el deploy: podés redeployar, cambiar de
> dominio o abrir la app desde otro equipo y el journal es el mismo. El backup
> JSON con capturas de Ajustes → Datos sigue siendo útil para archivar o para
> mudarte a otro proyecto de Supabase.
