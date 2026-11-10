import { useCallback, useEffect, useState } from 'react'
import { mensajeDeError } from '../supabase/errores'

export type Carga<T> = { estado: 'cargando' } | { estado: 'listo'; datos: T } | { estado: 'error'; mensaje: string }

/**
 * Carga datos al montar (y cada vez que cambia `cargar`), con estado de carga, error traducido y
 * `recargar()`. Ignora respuestas que llegan tarde de una carga anterior.
 * `cargar` debe venir de useCallback, con sus dependencias.
 */
export function useCarga<T>(cargar: () => Promise<T>): [Carga<T>, () => void] {
  const [carga, setCarga] = useState<Carga<T>>({ estado: 'cargando' })
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let vigente = true
    cargar().then(
      (datos) => vigente && setCarga({ estado: 'listo', datos }),
      (error: unknown) => {
        console.error(error)
        if (vigente) setCarga({ estado: 'error', mensaje: mensajeDeError(error, 'No se pudieron cargar los datos.') })
      },
    )
    return () => {
      vigente = false
    }
  }, [cargar, version])

  const recargar = useCallback(() => setVersion((v) => v + 1), [])
  return [carga, recargar]
}
