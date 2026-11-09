import type { SupabaseClient } from '@supabase/supabase-js'
import { getSupabase, isSupabaseConfigured } from './cliente'
import type { Usuario } from './tipos'

/**
 * Lo que la app necesita de Supabase Auth. Es una interfaz para poder probar las pantallas
 * con un servicio falso, sin red.
 */
export interface ServicioAuth {
  iniciarSesion(email: string, password: string): Promise<void>
  /** `necesitaConfirmar`: el proyecto pide confirmar el correo antes de entrar. */
  registrarse(email: string, password: string, nombre: string): Promise<{ necesitaConfirmar: boolean }>
  enviarRecuperacion(email: string): Promise<void>
  cambiarPassword(password: string): Promise<void>
  cerrarSesion(): Promise<void>
  cargarPerfil(uid: string): Promise<Usuario | null>
  /**
   * Avisa de cada cambio de sesión (también del estado inicial al suscribirse).
   * `recuperacion` es true cuando se abre el enlace del correo de "olvidé mi contraseña".
   */
  escuchar(alCambiar: (uid: string | null, recuperacion: boolean) => void): () => void
}

/** URL absoluta de una pantalla de la app (para los enlaces de los correos de Supabase). */
export function urlDeLaApp(hash: string, origen = window.location.origin, base = import.meta.env.BASE_URL): string {
  return `${origen}${base}${hash}`
}

/**
 * El enlace del correo vuelve con ?code=... (flujo PKCE). Supabase lo canjea por la sesión;
 * después se quita de la barra de direcciones para que no quede a la vista ni se reutilice.
 */
function limpiarCodigoDeUrl(): void {
  const url = new URL(window.location.href)
  if (!url.searchParams.has('code')) return
  url.searchParams.delete('code')
  window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash)
}

export function crearServicioSupabase(sb: SupabaseClient): ServicioAuth {
  return {
    async iniciarSesion(email, password) {
      const { error } = await sb.auth.signInWithPassword({ email, password })
      if (error) throw error
    },

    async registrarse(email, password, nombre) {
      const { data, error } = await sb.auth.signUp({
        email,
        password,
        // El trigger de la base de datos crea el perfil con este nombre (y siempre con rol alumno).
        options: { data: { nombre }, emailRedirectTo: urlDeLaApp('#/cuenta') },
      })
      if (error) throw error
      return { necesitaConfirmar: data.session === null }
    },

    async enviarRecuperacion(email) {
      const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: urlDeLaApp('#/restablecer') })
      if (error) throw error
    },

    async cambiarPassword(password) {
      const { error } = await sb.auth.updateUser({ password })
      if (error) throw error
    },

    async cerrarSesion() {
      const { error } = await sb.auth.signOut()
      if (error) throw error
    },

    async cargarPerfil(uid) {
      const { data, error } = await sb.from('usuarios').select('*').eq('id', uid).maybeSingle<Usuario>()
      if (error) throw error
      return data
    },

    escuchar(alCambiar) {
      const { data } = sb.auth.onAuthStateChange((evento, sesion) => {
        limpiarCodigoDeUrl()
        // Supabase recomienda no llamar a otros métodos suyos dentro de este callback (puede
        // bloquearse); con setTimeout la carga del perfil se hace justo después.
        setTimeout(() => alCambiar(sesion?.user.id ?? null, evento === 'PASSWORD_RECOVERY'), 0)
      })
      return () => data.subscription.unsubscribe()
    },
  }
}

let servicioPorDefecto: ServicioAuth | null | undefined

/** Servicio real si hay Supabase configurado; null si no (la app funciona sin cuentas). */
export function obtenerServicioAuth(): ServicioAuth | null {
  if (servicioPorDefecto === undefined) {
    servicioPorDefecto = isSupabaseConfigured ? crearServicioSupabase(getSupabase()) : null
  }
  return servicioPorDefecto
}
