import { useState } from 'react'
import { useAuth } from '../../auth/contexto'
import type { Usuario } from '../../supabase/tipos'
import { NOMBRE_ROL } from '../../utils/acceso'
import { emojiAvatar } from '../../utils/avatares'
import SecondaryButton from '../SecondaryButton'

const claseAccion =
  'flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-4 text-lg font-bold text-indigo-900 shadow-[0_5px_0_0_rgba(0,0,0,0.15)] transition-transform hover:-translate-y-0.5 focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-white'

function PantallaCuenta({ usuario }: { usuario: Usuario }) {
  const { cerrarSesion } = useAuth()
  const [saliendo, setSaliendo] = useState(false)
  const esDocente = usuario.rol === 'docente' || usuario.rol === 'admin'

  return (
    <section className="flex w-full max-w-md animate-pop flex-col items-center gap-6 text-center">
      <div className="flex size-28 items-center justify-center rounded-full bg-white/20 text-7xl ring-4 ring-white/40" aria-hidden="true">
        {emojiAvatar(usuario.avatar)}
      </div>
      <div className="space-y-2">
        <h1 className="text-4xl font-bold text-white drop-shadow-[0_4px_0_rgba(0,0,0,0.25)] sm:text-5xl">{usuario.nombre}</h1>
        <p className="text-indigo-100">{usuario.email}</p>
        <p className="inline-block rounded-full bg-amber-300 px-4 py-1 text-sm font-bold tracking-wide text-amber-950 uppercase">
          {NOMBRE_ROL[usuario.rol]}
        </p>
      </div>

      <nav aria-label="Opciones de la cuenta" className="grid w-full gap-3">
        {usuario.rol === 'admin' && (
          <a href="#/admin" className={claseAccion}>
            🛠️ Panel de administración
          </a>
        )}
        {esDocente && (
          <a href="#/docente" className={claseAccion}>
            👩‍🏫 Panel docente
          </a>
        )}
        <a href="#/" className={claseAccion}>
          🎮 Práctica rápida
        </a>
        <a href="#/restablecer" className={claseAccion}>
          🔏 Cambiar contraseña
        </a>
      </nav>

      <SecondaryButton
        disabled={saliendo}
        onClick={() => {
          setSaliendo(true)
          cerrarSesion().catch((e: unknown) => {
            console.error(e)
            setSaliendo(false)
          })
        }}
      >
        {saliendo ? '⏳ Saliendo…' : '🚪 Cerrar sesión'}
      </SecondaryButton>
    </section>
  )
}

export default PantallaCuenta
