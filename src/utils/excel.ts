import type { ErroresOperacion, EstadisticaAlumno, OperacionDificil, Operacion, Sala } from '../supabase/tipos'

export const NOMBRE_OPERACION: Record<Operacion, string> = {
  suma: 'Sumas',
  resta: 'Restas',
  multiplicacion: 'Multiplicaciones',
}

export const SIMBOLO_OPERACION: Record<Operacion, string> = { suma: '+', resta: '−', multiplicacion: '×' }

export const textoOperacion = (o: Pick<OperacionDificil, 'operacion' | 'a' | 'b' | 'resultado'>) =>
  `${o.a} ${SIMBOLO_OPERACION[o.operacion]} ${o.b} = ${o.resultado}`

type Celda = string | number | Date | null | { value: string; fontWeight: 'bold' }
export interface Hoja {
  sheet: string
  data: Celda[][]
  columns: { width: number }[]
}

const cabecera = (...titulos: string[]): Celda[] => titulos.map((t) => ({ value: t, fontWeight: 'bold' as const }))

/** Las tres hojas del Excel del docente: progreso por alumno, fallos por operación y cuentas más falladas. */
export function hojasDeProgreso(
  alumnos: EstadisticaAlumno[],
  errores: ErroresOperacion[],
  dificiles: OperacionDificil[],
): Hoja[] {
  return [
    {
      sheet: 'Alumnos',
      columns: [{ width: 28 }, { width: 10 }, { width: 10 }, { width: 12 }, { width: 13 }, { width: 14 }, { width: 12 }, { width: 20 }],
      data: [
        cabecera('Alumno', 'Partidas', 'Aciertos', 'Respuestas', '% aciertos', 'Mejor puntuación', 'Nivel máx.', 'Última partida'),
        ...alumnos.map((a) => [
          a.nombre,
          a.partidas,
          a.aciertos,
          a.respuestas,
          a.porcentaje_aciertos,
          a.mejor_puntos,
          a.nivel_max,
          a.ultima_partida ? new Date(a.ultima_partida) : null,
        ]),
      ],
    },
    {
      sheet: 'Por operación',
      columns: [{ width: 18 }, { width: 12 }, { width: 10 }, { width: 10 }],
      data: [
        cabecera('Operación', 'Respuestas', 'Fallos', '% fallos'),
        ...errores.map((e) => [NOMBRE_OPERACION[e.operacion], e.respuestas, e.fallos, e.porcentaje_fallo]),
      ],
    },
    {
      sheet: 'Más falladas',
      columns: [{ width: 16 }, { width: 10 }, { width: 10 }, { width: 10 }],
      data: [
        cabecera('Cuenta', 'Intentos', 'Fallos', '% fallos'),
        ...dificiles.map((d) => [textoOperacion(d), d.intentos, d.fallos, Math.round((100 * d.fallos) / d.intentos)]),
      ],
    },
  ]
}

/** "MathQuest-MUL-4821-2026-11-09.xlsx" */
export function nombreArchivo(sala: Pick<Sala, 'codigo'>, fecha = new Date()): string {
  const dia = [fecha.getFullYear(), String(fecha.getMonth() + 1).padStart(2, '0'), String(fecha.getDate()).padStart(2, '0')].join('-')
  return `MathQuest-${sala.codigo}-${dia}.xlsx`
}

/** Descarga el Excel. La librería se carga solo al pulsar el botón, para no hacer más pesada la web. */
export async function descargarExcel(hojas: Hoja[], archivo: string): Promise<void> {
  const { default: escribir } = await import('write-excel-file/browser')
  await escribir(hojas as Parameters<typeof escribir>[0]).toFile(archivo)
}
