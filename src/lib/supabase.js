/**
 * Supabase backend.
 *
 * This is the only place the journal stores anything. Trades, daily notes,
 * cash flows, settings and screenshots all live in the Supabase project named
 * by the build-time env vars — there is no local fallback and nothing for the
 * user to choose. See `supabase/schema.sql` for the tables, the analysis
 * views and the image bucket.
 *
 * Because `VITE_*` values are inlined into the bundle at build time, the app
 * points at whichever project was configured when it was built. In Vercel,
 * set them under Project Settings → Environment Variables and redeploy.
 */

import { createClient } from '@supabase/supabase-js'

// Optional chaining on `import.meta.env` itself: Vite always defines it, but
// plain Node does not, and this module sits on the import path of the pure
// calculation code that gets exercised outside the bundler.
const URL = import.meta.env?.VITE_SUPABASE_URL?.trim() || ''
const KEY = import.meta.env?.VITE_SUPABASE_ANON_KEY?.trim() || ''

export const IMAGE_BUCKET = 'trade-images'

export const TABLES = {
  trades: 'trades',
  dayNotes: 'day_notes',
  cashFlows: 'cash_flows',
  settings: 'app_settings',
}

export const MISSING_CONFIG_MESSAGE =
  'Supabase no está configurado. Faltan VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en el build.'

let client = null

export function isSupabaseConfigured() {
  return Boolean(URL && KEY && URL.startsWith('http'))
}

export function getSupabase() {
  if (!isSupabaseConfigured()) return null
  if (!client) {
    client = createClient(URL, KEY, {
      auth: { persistSession: false },
      db: { schema: 'public' },
    })
  }
  return client
}

/**
 * Every read and write goes through here. Without credentials there is no
 * degraded mode to fall back to, so we fail loudly instead of writing data
 * somewhere the user would never find it again.
 */
export function requireSupabase() {
  const supabase = getSupabase()
  if (!supabase) throw new Error(MISSING_CONFIG_MESSAGE)
  return supabase
}

/** Host shown in Settings so you can tell which project you are pointed at. */
export function supabaseHost() {
  if (!URL) return ''
  try {
    // `URL` is shadowed by the env constant above, hence the global lookup.
    return new globalThis.URL(URL).host
  } catch {
    return URL
  }
}

/** Round-trip probe used by the Settings connection test. */
export async function pingSupabase() {
  const supabase = getSupabase()
  if (!supabase) return { ok: false, error: MISSING_CONFIG_MESSAGE }
  try {
    const { error } = await supabase.from(TABLES.trades).select('id').limit(1)
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err.message }
  }
}
