import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/*
 * Conexión con el backend común de MathQuest (Supabase), el mismo que usan la app móvil y Godot.
 * La URL y la clave pública vienen de .env.local (ver .env.example). La clave pública no es secreta:
 * acaba en el JavaScript del navegador; la seguridad la dan las políticas RLS de la base de datos.
 */
const url = import.meta.env.VITE_SUPABASE_URL
const clavePublica = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

export const isSupabaseConfigured = Boolean(url && clavePublica)

let cliente: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  if (cliente) return cliente
  if (!url || !clavePublica) {
    throw new Error('Supabase no está configurado: copia .env.example a .env.local y rellena los valores.')
  }
  cliente = createClient(url, clavePublica, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      // PKCE: el enlace de recuperación de contraseña vuelve con ?code=... en lugar de poner los tokens
      // en el #hash, que la app usa para sus rutas (#/login, #/admin...).
      flowType: 'pkce',
    },
  })
  return cliente
}
