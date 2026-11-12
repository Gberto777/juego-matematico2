import type { DatosReto } from '../supabase/servicioSalas'
import type { RetoConProgreso } from '../supabase/tipos'

/** Comprueba los datos de un reto con los mismos límites que la base de datos. */
export function validarReto(datos: DatosReto): string | null {
  if (!datos.titulo.trim()) return 'Ponle un título al reto.'
  if (datos.titulo.trim().length > 80) return 'El título puede tener como máximo 80 caracteres.'
  if (datos.descripcion.length > 500) return 'La descripción puede tener como máximo 500 caracteres.'
  if (!Number.isInteger(datos.meta_aciertos) || datos.meta_aciertos < 1 || datos.meta_aciertos > 500) {
    return 'La meta debe ser de 1 a 500 aciertos.'
  }
  return null
}

export const plazo = (r: Pick<RetoConProgreso, 'fecha_limite'>) =>
  r.fecha_limite ? `Hasta el ${new Date(r.fecha_limite).toLocaleDateString('es', { day: 'numeric', month: 'long' })}` : 'Sin plazo'
