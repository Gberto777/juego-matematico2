import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { ServicioAuth } from '../supabase/servicioAuth'
import type { EstadoAuth } from '../utils/acceso'
import { normalizarEmail, normalizarNombre } from '../utils/validacionCuenta'
import { AuthContext, type ContextoAuth } from './contexto'

interface AuthProviderProps {
  /** null: no hay Supabase configurado y las cuentas quedan desactivadas. */
  servicio: ServicioAuth | null
  /** Se llama al abrir el enlace de recuperación de contraseña del correo. */
  alRecuperar?: () => void
  children: ReactNode
}

const aError = (e: unknown) => (e instanceof Error ? e : new Error(String(e)))

function sinServicio(): never {
  throw new Error('Las cuentas no están disponibles: falta configurar Supabase.')
}

/**
 * Mantiene la sesión de Supabase y el perfil (tabla `usuarios`) del usuario actual.
 * El rol y si la cuenta está activa salen SIEMPRE del perfil de la base de datos, nunca del token.
 */
export function AuthProvider({ servicio, alRecuperar, children }: AuthProviderProps) {
  const [auth, setAuth] = useState<EstadoAuth>(servicio ? { estado: 'cargando' } : { estado: 'desactivado' })
  // undefined = todavía no se sabe nada; null = sin sesión.
  const uidActual = useRef<string | null | undefined>(undefined)
  const alRecuperarRef = useRef(alRecuperar)
  useEffect(() => {
    alRecuperarRef.current = alRecuperar
  })

  const cargarPerfil = useCallback(
    async (uid: string) => {
      if (!servicio) return
      try {
        const usuario = await servicio.cargarPerfil(uid)
        // Si mientras tanto cambió la sesión, este resultado ya no sirve.
        if (uidActual.current !== uid) return
        setAuth(usuario ? { estado: 'sesion', usuario } : { estado: 'error', error: new Error('No se encontró tu perfil.') })
      } catch (error) {
        console.error('No se pudo cargar el perfil', error)
        if (uidActual.current === uid) setAuth({ estado: 'error', error: aError(error) })
      }
    },
    [servicio],
  )

  useEffect(() => {
    if (!servicio) return
    return servicio.escuchar((uid, recuperacion) => {
      if (recuperacion) alRecuperarRef.current?.()
      // Renovar el token (cada hora) avisa con el mismo usuario: no hace falta recargar el perfil.
      if (uid === uidActual.current) return
      uidActual.current = uid
      if (uid) {
        setAuth({ estado: 'cargando' })
        void cargarPerfil(uid)
      } else {
        setAuth({ estado: 'anonimo' })
      }
    })
  }, [servicio, cargarPerfil])

  const valor = useMemo<ContextoAuth>(() => {
    const s = () => servicio ?? sinServicio()
    return {
      auth,
      iniciarSesion: (email, password) => s().iniciarSesion(normalizarEmail(email), password),
      registrarse: (email, password, nombre) => s().registrarse(normalizarEmail(email), password, normalizarNombre(nombre)),
      enviarRecuperacion: (email) => s().enviarRecuperacion(normalizarEmail(email)),
      cambiarPassword: (password) => s().cambiarPassword(password),
      cerrarSesion: () => s().cerrarSesion(),
      refrescarPerfil: async () => {
        const uid = uidActual.current
        if (!uid) return
        setAuth({ estado: 'cargando' })
        await cargarPerfil(uid)
      },
    }
  }, [auth, servicio, cargarPerfil])

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>
}
