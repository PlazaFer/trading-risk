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

### Cuentas

Un journal por cuenta. El backtest, la demo, el challenge de fondeo y la cuenta
real no se mezclan: cada una tiene sus trades, sus notas diarias, sus
movimientos de capital y sus estadísticas.

- **Selector en el encabezado** para cambiar de cuenta o crear una nueva. La
  cuenta activa se recuerda por dispositivo, así que podés dejar el fondeo
  abierto en la compu y el backtest en la notebook.
- **Parámetros propios de cada cuenta**: capital inicial, capital a arriesgar,
  comisiones, instrumento y R:R por defecto, pérdida máxima diaria y máximo de
  trades por día. Una cuenta de fondeo arranca con límite diario cargado; un
  backtest, con un capital de papel redondo.
- **Lo común sigue siendo común**: tema, zona horaria y el vocabulario del
  journal (setups, errores, etiquetas) valen para todas las cuentas.
- **Ajustes → Tus cuentas** para renombrar, abrir o eliminar. Eliminar una
  cuenta borra su journal completo; las demás no se tocan. Siempre queda al
  menos una.

Los CSV y los backups JSON son de la cuenta abierta, y llevan su nombre en el
archivo. Importar un backup lo restaura **en la cuenta activa** — así se clona
un journal de una cuenta a otra — sin cambiarle el nombre ni el tipo.

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

Cuatro pestañas, y cada una es una pregunta en vez de una categoría. La regla
que las mantiene legibles es que **cada número vive en una sola pestaña**: el
win rate llegó a aparecer seis veces en esta pantalla, y una cifra repetida en
cuatro lugares deja de ser énfasis para volverse una razón para saltearse las
cuatro.

**Resumen — ¿el sistema paga?**
P&L neto, balance, win rate, profit factor, expectativa y actividad, cada uno
con su variación contra el período anterior de la misma duración. Debajo: la
curva de resultado acumulado (por trade, día, semana o mes), el win rate de
equilibrio que tu ratio G/P exige, el R:R obtenido contra el planificado, la
captura del objetivo, ganadores contra perdedores y la grilla mes a mes.

**Cuándo — ¿en qué día y a qué hora?**
La pestaña que la mayoría de los journals no tiene, y donde suele estar la
mejora más barata que existe:

- **Matriz día de la semana × sesión.** Cada celda es un cruce concreto, con la
  cantidad de trades adentro. Un día no es bueno o malo por sí solo: el dinero
  se pierde en una intersección — «martes después del almuerzo» — que ni el
  desglose por día ni el de por sesión pueden mostrar por separado. Se puede
  ver por resultado, win rate, cantidad o promedio.
- **Perfil intradiario** en franjas de 30 minutos, agrupadas bajo su sesión y
  ordenadas desde la apertura de Globex (18:00 ET) para que Asia no quede
  partida en los dos extremos. Las franjas vacías dentro del rango se
  conservan: un horario que evitás también es información.
- **Por sesión**, con el rango horario a la vista — el horario es la
  definición, el nombre es sólo la etiqueta.
- **Por día de la semana** y **por duración de la posición**.
- **Conclusiones con la plata al lado**: la mejor y la peor franja, y cuánto
  cerraría el período sin ella. Nada se afirma con menos de 4 trades, y ninguna
  franja que cubra más del 60% del journal cuenta como hallazgo — eso describe
  el hábito, no un edge adentro de él.

**Qué — ¿qué setup, qué lado, qué tamaño?**
Rendimiento por setup (diciendo qué porcentaje de tu operativa no tiene setup
cargado, que es lo que el panel no puede explicar), long contra short, tamaño
de posición, distribución de R-múltiplos, etiquetas, estado mental e
instrumento.

**Riesgo — ¿qué costó aguantarlo y seguí mis reglas?**
Drawdown y proceso juntos, porque el drawdown es la consecuencia del sizing y
las reglas rotas que están al lado. Curva bajo el agua, rachas, los días más
caros, riesgo medio y máximo como % del capital, consistencia del sizing, si te
paga arriesgar más, los días en que rompiste tu límite diario, plan contra
improvisación, trades limpios contra trades con errores, y cuánto te cuesta
cada error del vocabulario.

Todo filtrable por presets (este mes, mes pasado, 30/90 días, este año) o por
un **rango de fechas exacto**. El rango es uno solo para toda la app: elegirlo
en el Dashboard y pasar a Analítica no cambia la pregunta a mitad de camino.
Los filtros son aditivos — «NY AM *y* NY PM» es una pregunta normal — y valen
para las cuatro pestañas a la vez.

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
   las tablas, los índices, el bucket de imágenes y las vistas de análisis
3. Copiá `.env.example` a `.env` y completá la URL y la anon key
4. Reiniciá el servidor

Vite inlinea las `VITE_*` en el bundle **al compilar**, no las lee en runtime.
Por eso en Vercel van en *Environment Variables* y hace falta redeployar para
que un cambio tome efecto.

`schema.sql` es idempotente y también es la migración: en un journal creado
antes de que existieran las cuentas, crea una cuenta a partir de tus ajustes
actuales y le adjudica **todos** los trades, notas y movimientos que ya tenías.
No se pierde nada, y al abrir la app esa cuenta es la que está activa. Volvé a
correrlo después de actualizar el código; hasta que lo hagas la app avisa que
falta la tabla `accounts` en vez de mostrarte un journal vacío.

El esquema incluye vistas listas para usar, todas desglosadas por cuenta:

```sql
select * from v_accounts;             -- una fila por cuenta, con su equity
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
│   ├── calc.js          Derivación de trades, estadísticas y análisis por horario
│   ├── imageStore.js    Compresión y subida de capturas al bucket
│   ├── repo.js          Repositorio: todas las lecturas y escrituras
│   ├── supabase.js      Cliente Supabase y configuración
│   ├── exporter.js      CSV / JSON, importación de backups
│   ├── accounts.js      Tipos de cuenta y qué ajuste vive en cuál
│   ├── taxonomy.js      Setups, errores, emociones por defecto
│   └── periods.js       Rangos de fechas
├── context/
│   ├── JournalContext   Cuentas, datos, ajustes y mutaciones
│   └── UIContext        Modales de trade y atajos globales
├── components/
│   ├── ui/              Modal, TagPicker, ImageUploader, Lightbox…
│   ├── charts/          Curva de capital, matriz día × sesión, perfil intradiario
│   ├── analytics/       Las cuatro pestañas: Resumen, Cuándo, Qué, Riesgo
│   ├── journal/         Calendario, formulario, tarjeta y detalle de trade
│   └── layout/          Shell, navegación y selector de cuentas
└── pages/               Dashboard, Calendario, Día, Trades, Analítica, Ajustes
```

---

## Deploy en Vercel

El repo ya trae `vercel.json` con el framework, el build y los headers de caché:
los archivos de `/assets` llevan hash en el nombre y cambian en cada build, así
que se cachean para siempre; el documento raíz se revalida siempre, o un deploy
nuevo nunca llegaría al usuario.

> `vercel.json` no admite comentarios: su schema rechaza cualquier propiedad
> extra dentro de `headers[]`, incluida la convención `"//"`. Por eso la
> explicación vive acá y no en el archivo.

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
