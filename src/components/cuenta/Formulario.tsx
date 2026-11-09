import { useState, type FormEvent, type InputHTMLAttributes, type ReactNode } from 'react'
import { mensajeDeError } from '../../supabase/errores'
import GameButton from '../GameButton'

const claseInput =
  'w-full rounded-2xl border-4 border-white/40 bg-white/95 px-5 py-3 text-lg font-semibold text-indigo-900 shadow-inner outline-none placeholder:font-normal placeholder:text-indigo-300 focus:border-amber-300 focus:ring-4 focus:ring-amber-300/40'

interface CampoTextoProps extends InputHTMLAttributes<HTMLInputElement> {
  etiqueta: string
}

export function CampoTexto({ etiqueta, className = '', ...props }: CampoTextoProps) {
  return (
    <label className="flex w-full flex-col gap-1.5 text-left">
      <span className="px-2 text-sm font-semibold tracking-widest text-amber-200 uppercase">{etiqueta}</span>
      <input className={`${claseInput} ${className}`} {...props} />
    </label>
  )
}

interface FormularioCuentaProps {
  icono: string
  titulo: string
  subtitulo?: ReactNode
  textoBoton: string
  textoEnviando: string
  /** Comprueba los campos; devuelve el error a mostrar o null para enviar. */
  validar: () => string | null
  /** Envío a Supabase. Si lanza un error, se traduce y se muestra bajo el formulario. */
  enviar: () => Promise<void>
  /** Mensaje para errores no reconocidos. */
  errorPorDefecto?: string
  children: ReactNode
  /** Enlaces bajo el botón (¿olvidaste tu contraseña?, crear cuenta…). */
  pie?: ReactNode
}

/** Estructura común de las pantallas de cuenta: título, campos, error y botón de enviar. */
export function FormularioCuenta({
  icono,
  titulo,
  subtitulo,
  textoBoton,
  textoEnviando,
  validar,
  enviar,
  errorPorDefecto,
  children,
  pie,
}: FormularioCuentaProps) {
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  const alEnviar = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault()
    const errorValidacion = validar()
    if (errorValidacion) {
      setError(errorValidacion)
      return
    }
    setError(null)
    setEnviando(true)
    try {
      await enviar()
    } catch (e) {
      console.error(e)
      setError(mensajeDeError(e, errorPorDefecto))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <section className="flex w-full max-w-md animate-pop flex-col items-center gap-5 text-center">
      <div className="text-6xl" aria-hidden="true">
        {icono}
      </div>
      <div className="space-y-2">
        <h1 className="text-4xl font-bold text-white drop-shadow-[0_4px_0_rgba(0,0,0,0.25)] sm:text-5xl">{titulo}</h1>
        {subtitulo && <p className="text-lg text-indigo-100">{subtitulo}</p>}
      </div>

      <form onSubmit={alEnviar} className="flex w-full flex-col items-center gap-4" noValidate>
        {children}
        <div className="min-h-7" role="alert">
          {error && <p className="animate-shake font-semibold text-rose-200">⚠️ {error}</p>}
        </div>
        <GameButton type="submit" disabled={enviando}>
          {enviando ? `⏳ ${textoEnviando}` : textoBoton}
        </GameButton>
      </form>

      {pie && <div className="flex flex-col items-center gap-2 text-indigo-100">{pie}</div>}
    </section>
  )
}

/** Enlace con aspecto de texto subrayado para moverse entre pantallas. */
export function EnlaceTexto({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      className="font-semibold text-white underline decoration-white/40 underline-offset-4 hover:decoration-amber-300 focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-white"
    >
      {children}
    </a>
  )
}
