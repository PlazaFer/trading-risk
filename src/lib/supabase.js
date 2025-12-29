// Supabase Configuration
// These will be set when you configure Supabase
// Create a .env file with:
// VITE_SUPABASE_URL=your-project-url
// VITE_SUPABASE_ANON_KEY=your-anon-key

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

// Only create client if configured
let supabase = null

export function isSupabaseConfigured() {
  return Boolean(supabaseUrl && supabaseAnonKey && supabaseUrl.length > 0 && supabaseAnonKey.length > 0)
}

// Lazy initialization - only create client when needed and configured
export function getSupabase() {
  if (!isSupabaseConfigured()) {
    return null
  }
  
  if (!supabase) {
    // Dynamic import to avoid loading supabase-js if not needed
    import('@supabase/supabase-js').then(({ createClient }) => {
      supabase = createClient(supabaseUrl, supabaseAnonKey)
    })
  }
  
  return supabase
}

// For backwards compatibility - but returns null if not configured
export { supabase }

/*
===========================================
SUPABASE SETUP INSTRUCTIONS
===========================================

1. Go to https://supabase.com and create a free account
2. Create a new project
3. Go to SQL Editor and run:

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

-- Create index for faster queries
CREATE INDEX idx_trades_date ON trades(date DESC);
CREATE INDEX idx_trades_pair ON trades(pair);

-- Enable Row Level Security (optional but recommended)
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations (for personal use)
CREATE POLICY "Allow all operations" ON trades
  FOR ALL
  USING (true)
  WITH CHECK (true);

4. Go to Project Settings > API
5. Copy the Project URL and anon public key
6. Create a .env file in the project root:

VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

7. Restart the dev server

===========================================
*/
