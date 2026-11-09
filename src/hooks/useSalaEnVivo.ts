import { useCallback, useEffect, useRef, useState } from 'react'
import { mensajeDeError } from '../supabase/errores'
import type { ServicioSalas } from '../supabase/servicioSalas'
import type { MiembroSala, Sala } from '../supabase/tipos'

/** "Conectado" depende de la hora: se recalcula al menos con esta frecuencia aunque no haya cambios. */
export const REFRESCO_MS = 20_000

export type SalaEnVivo =
  | { estado: 'cargando' }
  | { estado: 'no-existe' }
  | { estado: 'error'; mensaje: string }
  | { estado: 'listo'; sala: Sala; miembros: MiembroSala[] }

/**
 * Sala y miembros para el panel del docente, al día: se recargan con cada aviso de Supabase
 * Realtime (alguien entra, responde o sale) y cada 20 s.
 */
export function useSalaEnVivo(servicio: ServicioSalas, codigo: string): [SalaEnVivo, () => void] {
  const [vivo, setVivo] = useState<SalaEnVivo>({ estado: 'cargando' })
  const salaId = vivo.estado === 'listo' ? vivo.sala.id : null
  const recargando = useRef(false)
  const pendiente = useRef(false)

  const cargar = useCallback(async (): Promise<void> => {
    // Varios avisos seguidos (p. ej. una respuesta cambia partida y miembro) se juntan en una
    // recarga más al terminar la actual, para no perder el último cambio.
    if (recargando.current) {
      pendiente.current = true
      return
    }
    recargando.current = true
    try {
      do {
        pendiente.current = false
        try {
          const sala = await servicio.buscarPorCodigo(codigo)
          if (!sala) {
            setVivo({ estado: 'no-existe' })
            return
          }
          const miembros = await servicio.miembros(sala.id)
          setVivo({ estado: 'listo', sala, miembros })
        } catch (error) {
          console.error('No se pudo cargar la sala', error)
          setVivo((actual) =>
            // Si ya había datos, se conservan: un fallo puntual de red no debe vaciar el panel.
            actual.estado === 'listo' ? actual : { estado: 'error', mensaje: mensajeDeError(error, 'No se pudo cargar la sala.') },
          )
        }
      } while (pendiente.current)
    } finally {
      recargando.current = false
    }
  }, [servicio, codigo])

  useEffect(() => {
    void cargar()
    const intervalo = setInterval(() => void cargar(), REFRESCO_MS)
    return () => clearInterval(intervalo)
  }, [cargar])

  useEffect(() => {
    if (!salaId) return
    return servicio.escucharSala(salaId, () => void cargar())
  }, [servicio, salaId, cargar])

  const recargar = useCallback(() => void cargar(), [cargar])
  return [vivo, recargar]
}
