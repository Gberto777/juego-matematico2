import { useEffect, useRef, useState, type ComponentProps, type FormEvent, type ReactNode } from 'react'
import { mensajeDeError } from '../../supabase/errores'
import type { CambiosUsuario, NuevoUsuario } from '../../supabase/servicioUsuarios'
import type { Rol, Usuario } from '../../supabase/tipos'
import { NOMBRE_ROL } from '../../utils/acceso'
import {
  NOMBRE_MAX,
  PASSWORD_MAX,
  errorEmail,
  errorNombre,
  errorPassword,
  normalizarEmail,
  normalizarNombre,
  primerError,
} from '../../utils/validacionCuenta'

const ROLES: Rol[] = ['alumno', 'docente', 'admin']

const claseCampo =
  'w-full rounded-xl border-2 border-indigo-100 bg-white px-4 py-2.5 text-base font-semibold text-indigo-950 outline-none placeholder:font-normal placeholder:text-indigo-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20 disabled:bg-indigo-50 disabled:text-indigo-400'

function Campo({ etiqueta, ayuda, children }: { etiqueta: string; ayuda?: string; children: ReactNode }) {
  return (
    // La ayuda va fuera de <label> para no formar parte del nombre del campo al leerlo en voz alta.
    <div className="flex flex-col gap-1 text-left">
      <label className="flex flex-col gap-1">
        <span className="text-sm font-bold text-indigo-900">{etiqueta}</span>
        {children}
      </label>
      {ayuda && <p className="text-xs text-indigo-500">{ayuda}</p>}
    </div>
  )
}

function Entrada(props: ComponentProps<'input'>) {
  return <input className={claseCampo} {...props} />
}

type DialogoUsuarioProps =
  | {
      modo: 'crear'
      alGuardar: (datos: NuevoUsuario) => Promise<void>
      alCerrar: () => void
    }
  | {
      modo: 'editar'
      usuario: Usuario
      /** El admin no puede quitarse su propio rol (también lo impide el servidor). */
      esUnoMismo: boolean
      alGuardar: (cambios: CambiosUsuario) => Promise<void>
      alCerrar: () => void
    }

/** Ventana para crear una cuenta o editar el nombre y el rol de una existente. */
function DialogoUsuario(props: DialogoUsuarioProps) {
  const editando = props.modo === 'editar' ? props.usuario : null
  const [nombre, setNombre] = useState(editando?.nombre ?? '')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rol, setRol] = useState<Rol>(editando?.rol ?? 'alumno')
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const primerCampo = useRef<HTMLInputElement>(null)
  const { alCerrar } = props

  useEffect(() => {
    primerCampo.current?.focus()
    const alPulsar = (e: KeyboardEvent) => e.key === 'Escape' && alCerrar()
    window.addEventListener('keydown', alPulsar)
    return () => window.removeEventListener('keydown', alPulsar)
  }, [alCerrar])

  const alEnviar = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault()
    const errorValidacion =
      props.modo === 'crear'
        ? primerError(errorNombre(nombre), errorEmail(email), errorPassword(password))
        : errorNombre(nombre)
    if (errorValidacion) {
      setError(errorValidacion)
      return
    }
    setError(null)
    setGuardando(true)
    try {
      if (props.modo === 'crear') {
        await props.alGuardar({ nombre: normalizarNombre(nombre), email: normalizarEmail(email), password, rol })
      } else {
        const cambios: CambiosUsuario = {}
        if (normalizarNombre(nombre) !== props.usuario.nombre) cambios.nombre = normalizarNombre(nombre)
        if (rol !== props.usuario.rol) cambios.rol = rol
        await props.alGuardar(cambios)
      }
    } catch (e) {
      console.error(e)
      setError(mensajeDeError(e, 'No se pudieron guardar los cambios.'))
      setGuardando(false)
    }
  }

  const titulo = props.modo === 'crear' ? 'Nuevo usuario' : 'Editar usuario'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-indigo-950/60 p-4 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && alCerrar()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-dialogo-usuario"
        className="w-full max-w-md animate-pop rounded-3xl bg-white p-6 text-left shadow-2xl"
      >
        <h2 id="titulo-dialogo-usuario" className="mb-1 text-2xl font-bold text-indigo-950">
          {titulo}
        </h2>
        {editando && <p className="mb-4 text-sm text-indigo-500">{editando.email}</p>}

        <form onSubmit={alEnviar} className="mt-4 flex flex-col gap-4" noValidate>
          <Campo etiqueta="Nombre">
            <Entrada ref={primerCampo} value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={NOMBRE_MAX} />
          </Campo>

          {props.modo === 'crear' && (
            <>
              <Campo etiqueta="Correo">
                <Entrada type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ana@colegio.edu" />
              </Campo>
              <Campo etiqueta="Contraseña inicial" ayuda="Mínimo 8 caracteres. El usuario podrá cambiarla desde «Mi cuenta».">
                <Entrada
                  type="text"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  maxLength={PASSWORD_MAX}
                  autoComplete="off"
                  spellCheck={false}
                />
              </Campo>
            </>
          )}

          <Campo
            etiqueta="Rol"
            ayuda={props.modo === 'editar' && props.esUnoMismo ? 'No puedes cambiar tu propio rol.' : undefined}
          >
            <select
              value={rol}
              onChange={(e) => setRol(e.target.value as Rol)}
              disabled={props.modo === 'editar' && props.esUnoMismo}
              className={claseCampo}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {NOMBRE_ROL[r]}
                </option>
              ))}
            </select>
          </Campo>

          <div className="min-h-6" role="alert">
            {error && <p className="font-semibold text-rose-600">⚠️ {error}</p>}
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={alCerrar}
              className="rounded-full px-5 py-2 font-bold text-indigo-700 hover:bg-indigo-50 focus-visible:outline-4 focus-visible:outline-indigo-500"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardando}
              className="rounded-full bg-indigo-600 px-6 py-2 font-bold text-white shadow-[0_4px_0_0_var(--color-indigo-800)] hover:bg-indigo-500 focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 active:translate-y-1 active:shadow-none disabled:opacity-60"
            >
              {guardando ? '⏳ Guardando…' : props.modo === 'crear' ? 'Crear cuenta' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default DialogoUsuario
