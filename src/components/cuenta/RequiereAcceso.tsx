import { useEffect, type ReactNode } from 'react'
import { useAuth } from '../../auth/contexto'
import type { Usuario } from '../../supabase/tipos'
import { evaluarAcceso, type Requisito } from '../../utils/acceso'
import SecondaryButton from '../SecondaryButton'
import StatusMessage from '../StatusMessage'
import { EnlaceTexto } from './Formulario'
import PantallaEntrar from './PantallaEntrar'

interface RequiereAccesoProps {
  requisito: Requisito
  /** Contenido cuando el acceso está permitido. Recibe el usuario si hay sesión. */
  children: (usuario: Usuario | null) => ReactNode
  /** Qué mostrar si hace falta sesión y no la hay (por defecto, el formulario para entrar). */
  sinSesion?: ReactNode
}

/** Lleva a "Mi cuenta" (p. ej. al abrir "Entrar" con la sesión ya iniciada). */
function IrACuenta() {
  useEffect(() => {
    window.location.hash = '#/cuenta'
  }, [])
  return null
}

/**
 * Protege una pantalla según la sesión y el rol. Si falta la sesión muestra el formulario de
 * entrar en el mismo sitio: al iniciar sesión aparece directamente la pantalla que se pedía.
 */
function RequiereAcceso({ requisito, children, sinSesion }: RequiereAccesoProps) {
  const { auth, cerrarSesion, refrescarPerfil } = useAuth()
  const salir = () => void cerrarSesion().catch((e: unknown) => console.error(e))

  switch (evaluarAcceso(requisito, auth)) {
    case 'permitido':
      return children(auth.estado === 'sesion' ? auth.usuario : null)
    case 'ya-con-sesion':
      return <IrACuenta />
    case 'cargando':
      return <StatusMessage icon="⏳" title="Cargando tu cuenta…" />
    case 'pedir-login':
      return sinSesion ?? <PantallaEntrar aviso="Inicia sesión para ver esta página." />
    case 'prohibido':
      return (
        <StatusMessage icon="🔒" title="No tienes permiso">
          <p>Esta página es solo para otro tipo de cuenta. Si crees que es un error, habla con el administrador.</p>
          <EnlaceTexto href="#/cuenta">⬅ Ir a mi cuenta</EnlaceTexto>
        </StatusMessage>
      )
    case 'inactivo':
      return (
        <StatusMessage icon="🚫" title="Cuenta desactivada">
          <p>Un administrador desactivó tu cuenta. Habla con tu docente o con el administrador.</p>
          <SecondaryButton onClick={salir}>🚪 Cerrar sesión</SecondaryButton>
        </StatusMessage>
      )
    case 'no-disponible':
      return (
        <StatusMessage icon="🔌" title="Cuentas no disponibles">
          <p>Falta configurar Supabase (copia .env.example a .env.local y rellena los datos del proyecto).</p>
          <EnlaceTexto href="#/">⬅ Volver al juego</EnlaceTexto>
        </StatusMessage>
      )
    case 'error':
      return (
        <StatusMessage icon="📡" title="No se pudo cargar tu cuenta">
          <p>Comprueba la conexión e inténtalo de nuevo.</p>
          <SecondaryButton onClick={() => void refrescarPerfil()}>🔄 Reintentar</SecondaryButton>
          <SecondaryButton onClick={salir}>🚪 Cerrar sesión</SecondaryButton>
        </StatusMessage>
      )
  }
}

export default RequiereAcceso
