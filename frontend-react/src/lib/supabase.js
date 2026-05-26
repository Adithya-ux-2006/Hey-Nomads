import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://anifwbqwzhnqjkyrqgcx.supabase.co'
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_QeR9F1TevWMSOjuVvxC5iQ_uHUDNktn'

export const supabase = createClient(
  supabaseUrl,
  supabaseKey
)