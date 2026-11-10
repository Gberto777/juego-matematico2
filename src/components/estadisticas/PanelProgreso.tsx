import { useCallback, useState } from 'react'
import { useCarga } from '../../hooks/useCarga'
import { mensajeDeError } from '../../supabase/errores'
import type { ServicioEstadisticas } from '../../supabase/servicioEstadisticas'
import type { Sala } from '../../supabase/tipos'
import { emojiAvatar } from '../../utils/avatares'
import { haceCuanto } from '../../utils/codigoSala'
import { descargarExcel, hojasDeProgreso, nombreArchivo, textoOperacion } from '../../utils/excel'
import { BarrasErrores, Panel, SegunCarga } from './Comunes'

interface PanelProgresoProps {
  servicio: ServicioEstadisticas
  sala: Sala
  /** Para los tests: sustituye la descarga real del archivo. */
  descargar?: typeof descargarExcel
}

/** Progreso de la clase: cada alumno, las operaciones donde más se falla y la exportación a Excel. */
function PanelProgreso({ servicio, sala, descargar = descargarExcel }: PanelProgresoProps) {
  const [alumnos, recargarAlumnos] = useCarga(useCallback(() => servicio.estadisticasSala(sala.id), [servicio, sala.id]))
  const [errores, recargarErrores] = useCarga(useCallback(() => servicio.erroresPorOperacion({ salaId: sala.id }), [servicio, sala.id]))
  const [dificiles, recargarDificiles] = useCarga(useCallback(() => servicio.operacionesDificiles({ salaId: sala.id }), [servicio, sala.id]))
  const [exportando, setExportando] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)

  const listo = alumnos.estado === 'listo' && errores.estado === 'listo' && dificiles.estado === 'listo'

  const exportar = async () => {
    if (!listo) return
    setExportando(true)
    setAviso(null)
    try {
      await descargar(hojasDeProgreso(alumnos.datos, errores.datos, dificiles.datos), nombreArchivo(sala))
      setAviso('✅ Se descargó el Excel con el progreso de la clase.')
    } catch (error) {
      console.error(error)
      setAviso(`⚠️ ${mensajeDeError(error, 'No se pudo crear el Excel.')}`)
    } finally {
      setExportando(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <Panel
        titulo="Progreso por alumno"
        accion={
          <button
            type="button"
            onClick={() => void exportar()}
            disabled={!listo || exportando}
            className="rounded-full bg-emerald-600 px-5 py-2 font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {exportando ? '⏳ Preparando…' : '⬇ Exportar a Excel'}
          </button>
        }
      >
        <p className={aviso ? 'mb-3 text-sm font-semibold text-indigo-700' : 'sr-only'} role="status">
          {aviso}
        </p>
        <SegunCarga carga={alumnos} recargar={recargarAlumnos}>
          {(filas) =>
            filas.length === 0 ? (
              <p className="text-indigo-500">Todavía no hay alumnos en la sala.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[36rem] text-left">
                  <thead className="text-sm text-indigo-500">
                    <tr>
                      <th className="py-2 pr-3 font-semibold">Alumno</th>
                      <th className="py-2 pr-3 text-right font-semibold">Partidas</th>
                      <th className="py-2 pr-3 text-right font-semibold">Aciertos</th>
                      <th className="py-2 pr-3 text-right font-semibold">Mejor</th>
                      <th className="py-2 pr-3 text-right font-semibold">Nivel</th>
                      <th className="py-2 font-semibold">Última partida</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filas.map((a) => (
                      <tr key={a.usuario_id} className="border-t border-indigo-50">
                        <td className="py-2 pr-3 font-semibold">
                          <span aria-hidden="true">{emojiAvatar(a.avatar)} </span>
                          {a.nombre}
                        </td>
                        <td className="py-2 pr-3 text-right tabular-nums">{a.partidas}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">
                          {a.porcentaje_aciertos === null ? (
                            '—'
                          ) : (
                            <span className={a.porcentaje_aciertos < 60 ? 'font-bold text-rose-600' : ''}>
                              {a.porcentaje_aciertos} %
                            </span>
                          )}
                          <span className="block text-xs text-indigo-400">
                            {a.aciertos}/{a.respuestas}
                          </span>
                        </td>
                        <td className="py-2 pr-3 text-right font-bold tabular-nums">{a.mejor_puntos}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{a.nivel_max || '—'}</td>
                        <td className="py-2 text-sm text-indigo-600">{a.ultima_partida ? haceCuanto(a.ultima_partida) : 'Nunca'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          }
        </SegunCarga>
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel titulo="Fallos por operación">
          <SegunCarga carga={errores} recargar={recargarErrores}>
            {(e) => <BarrasErrores errores={e} />}
          </SegunCarga>
        </Panel>
        <Panel titulo="Las cuentas más falladas">
          <SegunCarga carga={dificiles} recargar={recargarDificiles}>
            {(lista) =>
              lista.length === 0 ? (
                <p className="text-indigo-500">Aún no hay cuentas que se repitan con fallos.</p>
              ) : (
                <ol className="flex flex-col gap-2" aria-label="Cuentas más falladas">
                  {lista.map((d) => (
                    <li key={`${d.operacion}-${d.a}-${d.b}`} className="flex items-baseline justify-between gap-3">
                      <span className="text-lg font-bold tabular-nums">{textoOperacion(d)}</span>
                      <span className="text-sm text-indigo-600">
                        {d.fallos} de {d.intentos} fallos
                      </span>
                    </li>
                  ))}
                </ol>
              )
            }
          </SegunCarga>
        </Panel>
      </div>
    </div>
  )
}

export default PanelProgreso
