import { createClient } from '@supabase/supabase-js'
import { normalizeSupabaseUrl } from './supabaseUrl'

const supabaseUrl = normalizeSupabaseUrl(import.meta.env.VITE_SUPABASE_URL)
const supabaseAnonKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim()

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
