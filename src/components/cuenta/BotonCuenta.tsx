import { useAuth } from '../../auth/contexto'
import { emojiAvatar } from '../../utils/avatares'

const clase =
  'flex items-center gap-2 rounded-full bg-white/15 px-4 py-1.5 text-base font-semibold text-white ring-2 ring-white/30 backdrop-blur transition-colors hover:bg-white/25 focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-white'

/** Acceso a la cuenta en la esquina: "Entrar" sin sesión, o el avatar y el nombre con ella. */
function BotonCuenta() {
  const { auth } = useAuth()

  if (auth.estado === 'anonimo') {
    return (
      <a href="#/entrar" className={clase}>
        🔑 Entrar
      </a>
    )
  }
  if (auth.estado === 'sesion') {
    return (
      <a href="#/cuenta" className={clase} aria-label={`Mi cuenta (${auth.usuario.nombre})`}>
        <span aria-hidden="true">{emojiAvatar(auth.usuario.avatar)}</span>
        <span className="max-w-[12ch] truncate">{auth.usuario.nombre}</span>
      </a>
    )
  }
  // Sin Supabase, cargando o con error: no se muestra nada.
  return null
}

export default BotonCuenta
