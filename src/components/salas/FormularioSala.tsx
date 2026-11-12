import { useState, type FormEvent } from 'react'
import { mensajeDeError } from '../../supabase/errores'
import type { DatosSala } from '../../supabase/servicioSalas'
import type { Dificultad, TemaOperacion } from '../../supabase/tipos'
import {
  ICONO_TEMA,
  MAX_JUGADORES_LIMITE,
  NOMBRE_DIFICULTAD,
  NOMBRE_SALA_MAX,
  NOMBRE_TEMA,
  validarDatosSala,
} from '../../utils/codigoSala'

const TEMAS: TemaOperacion[] = ['mixta', 'suma', 'resta', 'multiplicacion']
const DIFICULTADES: Dificultad[] = ['facil', 'media', 'dificil']

const claseCampo =
  'w-full rounded-xl border-2 border-indigo-100 bg-white px-4 py-2.5 text-base font-semibold text-indigo-950 outline-none placeholder:font-normal placeholder:text-indigo-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20'

interface FormularioSalaProps {
  inicial?: DatosSala
  textoBoton: string
  alGuardar: (datos: DatosSala) => Promise<void>
  alCancelar?: () => void
}

const VACIO: DatosSala = { nombre: '', tema: 'mixta', dificultad: 'media', max_jugadores: 30 }

/** Campos de una sala: nombre, tema, dificultad y límite de jugadores. */
function FormularioSala({ inicial = VACIO, textoBoton, alGuardar, alCancelar }: FormularioSalaProps) {
  const [nombre, setNombre] = useState(inicial.nombre)
  const [tema, setTema] = useState(inicial.tema)
  const [dificultad, setDificultad] = useState(inicial.dificultad)
  const [maxJugadores, setMaxJugadores] = useState(String(inicial.max_jugadores))
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  const alEnviar = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault()
    const datos: DatosSala = { nombre: nombre.trim().replace(/\s+/g, ' '), tema, dificultad, max_jugadores: Number(maxJugadores) }
    const errorValidacion = validarDatosSala(datos)
    if (errorValidacion) {
      setError(errorValidacion)
      return
    }
    setError(null)
    setGuardando(true)
    try {
      await alGuardar(datos)
    } catch (e) {
      console.error(e)
      setError(mensajeDeError(e, 'No se pudo guardar la sala.'))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <form onSubmit={alEnviar} noValidate className="grid gap-4 text-left sm:grid-cols-2">
      <label className="flex flex-col gap-1 sm:col-span-2">
        <span className="text-sm font-bold text-indigo-900">Nombre de la sala</span>
        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          maxLength={NOMBRE_SALA_MAX}
          placeholder="4.º B · Tablas"
          className={claseCampo}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-bold text-indigo-900">Tema</span>
        <select value={tema} onChange={(e) => setTema(e.target.value as TemaOperacion)} className={claseCampo}>
          {TEMAS.map((t) => (
            <option key={t} value={t}>
              {ICONO_TEMA[t]} {NOMBRE_TEMA[t]}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-bold text-indigo-900">Dificultad</span>
        <select value={dificultad} onChange={(e) => setDificultad(e.target.value as Dificultad)} className={claseCampo}>
          {DIFICULTADES.map((d) => (
            <option key={d} value={d}>
              {NOMBRE_DIFICULTAD[d]}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-bold text-indigo-900">Límite de jugadores</span>
        <input
          type="number"
          min={1}
          max={MAX_JUGADORES_LIMITE}
          value={maxJugadores}
          onChange={(e) => setMaxJugadores(e.target.value)}
          className={claseCampo}
        />
      </label>

      <div className="flex flex-wrap items-center justify-end gap-3 sm:col-span-2">
        <p role="alert" className="mr-auto font-semibold text-rose-600">
          {error && `⚠️ ${error}`}
        </p>
        {alCancelar && (
          <button
            type="button"
            onClick={alCancelar}
            className="rounded-full px-5 py-2 font-bold text-indigo-700 hover:bg-indigo-50 focus-visible:outline-4 focus-visible:outline-indigo-500"
          >
            Cancelar
          </button>
        )}
        <button
          type="submit"
          disabled={guardando}
          className="rounded-full bg-indigo-600 px-6 py-2 font-bold text-white shadow-[0_4px_0_0_var(--color-indigo-800)] hover:bg-indigo-500 focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 active:translate-y-1 active:shadow-none disabled:opacity-60"
        >
          {guardando ? '⏳ Guardando…' : textoBoton}
        </button>
      </div>
    </form>
  )
}

export default FormularioSala
