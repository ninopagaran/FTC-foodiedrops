import { createClient } from '@supabase/supabase-js';

// Safe access to environment variables to prevent crash if import.meta.env is undefined
// Cast to any to avoid TypeScript errors regarding ImportMeta env property if types are missing
const env = (import.meta as any).env || {};
const supabaseUrl = env.VITE_SUPABASE_URL || '';
const supabaseAnonKey =
  env.VITE_SUPABASE_ANON_KEY ||
  env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY ||
  '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Supabase URL or API key is missing. Set VITE_SUPABASE_URL and either VITE_SUPABASE_ANON_KEY or VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY in .env.local.'
  );
}

// Initialize Supabase client
// We provide fallback values to prevent the app from crashing on startup if keys are missing.
// API calls will simply fail if the keys are invalid.
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key'
);
