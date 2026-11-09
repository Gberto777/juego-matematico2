import { createContext, useContext } from 'react'
import type { EstadoAuth } from '../utils/acceso'

export interface ContextoAuth {
  auth: EstadoAuth
  iniciarSesion(email: string, password: string): Promise<void>
  registrarse(email: string, password: string, nombre: string): Promise<{ necesitaConfirmar: boolean }>
  enviarRecuperacion(email: string): Promise<void>
  cambiarPassword(password: string): Promise<void>
  cerrarSesion(): Promise<void>
  /** Vuelve a leer el perfil (tras editarlo o si falló la carga). */
  refrescarPerfil(): Promise<void>
}

export const AuthContext = createContext<ContextoAuth | null>(null)

export function useAuth(): ContextoAuth {
  const contexto = useContext(AuthContext)
  if (!contexto) throw new Error('useAuth debe usarse dentro de <AuthProvider>.')
  return contexto
}
