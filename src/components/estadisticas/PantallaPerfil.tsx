import { useCallback, useState } from 'react'
import { useAuth } from '../../auth/contexto'
import { useCarga } from '../../hooks/useCarga'
import { mensajeDeError } from '../../supabase/errores'
import type { ServicioEstadisticas } from '../../supabase/servicioEstadisticas'
import type { OrigenPartida, PartidaResumen, Usuario } from '../../supabase/tipos'
import { NOMBRE_ROL } from '../../utils/acceso'
import { AVATARES, emojiAvatar, type IdAvatar } from '../../utils/avatares'
import { ICONO_TEMA, NOMBRE_TEMA } from '../../utils/codigoSala'
import { NOMBRE_MAX, errorNombre, normalizarNombre } from '../../utils/validacionCuenta'
import { BarrasErrores, Cifra, Panel, SegunCarga } from './Comunes'

const NOMBRE_ORIGEN: Record<OrigenPartida, string> = { web: 'Web', movil: 'App', godot: 'MathQuest 3D' }

const fechaCorta = (iso: string) =>
  new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

function EditarPerfil({ servicio, usuario, alTerminar }: { servicio: ServicioEstadisticas; usuario: Usuario; alTerminar: () => void }) {
  const { refrescarPerfil } = useAuth()
  const [nombre, setNombre] = useState(usuario.nombre)
  const [avatar, setAvatar] = useState(usuario.avatar)
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  const guardar = async () => {
    const e = errorNombre(nombre)
    if (e) {
      setError(e)
      return
    }
    setGuardando(true)
    try {
      await servicio.actualizarPerfil(usuario.id, { nombre: normalizarNombre(nombre), avatar })
      await refrescarPerfil()
      alTerminar()
    } catch (err) {
      console.error(err)
      setError(mensajeDeError(err, 'No se pudo guardar tu perfil.'))
      setGuardando(false)
    }
  }

  return (
    <Panel titulo="Editar mi perfil">
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-bold">Nombre</span>
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            maxLength={NOMBRE_MAX}
            className="rounded-xl border-2 border-indigo-100 px-4 py-2.5 font-semibold outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20"
          />
        </label>
        <fieldset>
          <legend className="mb-2 text-sm font-bold">Avatar</legend>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(AVATARES) as IdAvatar[]).map((id) => (
              <button
                key={id}
                type="button"
                aria-pressed={avatar === id}
                aria-label={`Avatar ${id}`}
                onClick={() => setAvatar(id)}
                className={`flex size-14 items-center justify-center rounded-2xl text-3xl transition-transform hover:-translate-y-0.5 ${
                  avatar === id ? 'bg-amber-300 ring-4 ring-amber-500' : 'bg-indigo-50'
                }`}
              >
                {AVATARES[id]}
              </button>
            ))}
          </div>
        </fieldset>
        <p role="alert" className="min-h-6 font-semibold text-rose-600">
          {error && `⚠️ ${error}`}
        </p>
        <div className="flex justify-end gap-3">
          <button type="button" onClick={alTerminar} className="rounded-full px-5 py-2 font-bold text-indigo-700 hover:bg-indigo-50">
            Cancelar
          </button>
          <button
            type="button"
            disabled={guardando}
            onClick={() => void guardar()}
            className="rounded-full bg-indigo-600 px-6 py-2 font-bold text-white hover:bg-indigo-500 disabled:opacity-60"
          >
            {guardando ? '⏳ Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </Panel>
  )
}

function Historial({ partidas }: { partidas: PartidaResumen[] }) {
  if (partidas.length === 0) return <p className="text-indigo-500">Aún no has terminado ninguna partida.</p>
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[30rem] text-left">
        <thead className="text-sm text-indigo-500">
          <tr>
            <th className="py-2 pr-3 font-semibold">Cuándo</th>
            <th className="py-2 pr-3 font-semibold">Dónde</th>
            <th className="py-2 pr-3 text-right font-semibold">Puntos</th>
            <th className="py-2 pr-3 text-right font-semibold">Aciertos</th>
            <th className="py-2 text-right font-semibold">Nivel</th>
          </tr>
        </thead>
        <tbody>
          {partidas.map((p) => (
            <tr key={p.id} className="border-t border-indigo-50">
              <td className="py-2 pr-3">{fechaCorta(p.terminada_en)}</td>
              <td className="py-2 pr-3">
                {NOMBRE_ORIGEN[p.origen]}
                {p.modo !== 'practica' && <span className="text-indigo-400"> · {p.modo === 'diario' ? 'reto del día' : p.modo}</span>}
              </td>
              <td className="py-2 pr-3 text-right font-bold tabular-nums">{p.puntos}</td>
              <td className="py-2 pr-3 text-right tabular-nums">
                {p.aciertos}/{p.respuestas_total}
              </td>
              <td className="py-2 text-right tabular-nums">
                {p.nivel}
                {p.jefe_derrotado && ' 👑'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Perfil del jugador: sus números, el reto del día, sus logros, dónde falla y su historial. */
function PantallaPerfil({ servicio, usuario }: { servicio: ServicioEstadisticas; usuario: Usuario }) {
  const [editando, setEditando] = useState(false)
  const [stats, recargarStats] = useCarga(useCallback(() => servicio.estadisticasUsuario(), [servicio]))
  const [logros, recargarLogros] = useCarga(useCallback(() => servicio.logros(usuario.id), [servicio, usuario.id]))
  const [errores, recargarErrores] = useCarga(useCallback(() => servicio.erroresPorOperacion(), [servicio]))
  const [diario, recargarDiario] = useCarga(useCallback(() => servicio.retoDiario(), [servicio]))

  return (
    <section className="flex w-full max-w-5xl flex-col gap-5">
      <header className="flex flex-wrap items-center gap-5 text-left">
        <span className="flex size-24 items-center justify-center rounded-full bg-white/20 text-6xl ring-4 ring-white/40" aria-hidden="true">
          {emojiAvatar(usuario.avatar)}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-4xl font-bold text-white drop-shadow-[0_3px_0_rgba(0,0,0,0.2)]">{usuario.nombre}</h1>
          <p className="text-indigo-100">
            {NOMBRE_ROL[usuario.rol]} · {usuario.email}
          </p>
        </div>
        <div className="flex gap-3">
          {!editando && (
            <button
              type="button"
              onClick={() => setEditando(true)}
              className="rounded-full px-5 py-2 font-bold text-white ring-2 ring-white/40 hover:bg-white/15"
            >
              ✏️ Editar perfil
            </button>
          )}
          <a href="#/cuenta" className="self-center font-semibold text-white underline decoration-white/40 underline-offset-4">
            ⬅ Mi cuenta
          </a>
        </div>
      </header>

      {editando && <EditarPerfil servicio={servicio} usuario={usuario} alTerminar={() => setEditando(false)} />}

      <SegunCarga carga={stats} recargar={recargarStats}>
        {(s) => (
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Cifra etiqueta="Partidas" valor={s.partidas} />
            <Cifra etiqueta="Mejor puntuación" valor={s.puntos_max} />
            <Cifra etiqueta="Nivel máximo" valor={s.nivel_max} />
            <Cifra etiqueta="Aciertos" valor={s.precision === null ? '—' : `${s.precision} %`} nota={`${s.aciertos} de ${s.respuestas}`} />
            <Cifra etiqueta="Monedas" valor={s.monedas} />
            <Cifra etiqueta="Minutos" valor={s.minutos_jugados} nota={s.jefe_derrotado ? '👑 Rey vencido' : undefined} />
          </dl>
        )}
      </SegunCarga>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel
          titulo="Reto del día"
          accion={
            <a href="#/reto-diario" className="rounded-full bg-amber-400 px-4 py-1.5 text-sm font-bold text-amber-950 hover:bg-amber-300">
              ▶ Jugar
            </a>
          }
        >
          <SegunCarga carga={diario} recargar={recargarDiario}>
            {(r) => (
              <div className="flex flex-col gap-2">
                <p className="text-lg">
                  {ICONO_TEMA[r.tema]} <strong>{NOMBRE_TEMA[r.tema]}</strong>: consigue {r.meta_aciertos} aciertos en una partida.
                </p>
                <p className={r.completado ? 'font-bold text-emerald-700' : 'text-indigo-600'}>
                  {r.completado ? '✅ ¡Reto de hoy cumplido!' : `Tu mejor hoy: ${r.mi_mejor} de ${r.meta_aciertos}.`}
                </p>
              </div>
            )}
          </SegunCarga>
        </Panel>

        <Panel titulo="Dónde fallo más">
          <SegunCarga carga={errores} recargar={recargarErrores}>
            {(e) => <BarrasErrores errores={e} />}
          </SegunCarga>
        </Panel>
      </div>

      <Panel titulo="Logros">
        <SegunCarga carga={logros} recargar={recargarLogros}>
          {(lista) => (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Logros">
              {lista.map((l) => (
                <li
                  key={l.id}
                  className={`flex items-center gap-3 rounded-2xl px-4 py-3 ${l.obtenido_en ? 'bg-amber-100' : 'bg-slate-100 text-slate-500'}`}
                >
                  <span className={`text-3xl ${l.obtenido_en ? '' : 'opacity-40 grayscale'}`} aria-hidden="true">
                    {l.icono}
                  </span>
                  <span>
                    <span className="block font-bold">{l.nombre}</span>
                    <span className="block text-sm">{l.descripcion}</span>
                    <span className="sr-only">{l.obtenido_en ? 'Conseguido' : 'Sin conseguir'}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SegunCarga>
      </Panel>

      <Panel titulo="Últimas partidas">
        <SegunCarga carga={stats} recargar={recargarStats}>
          {(s) => <Historial partidas={s.ultimas} />}
        </SegunCarga>
      </Panel>
    </section>
  )
}

export default PantallaPerfil
