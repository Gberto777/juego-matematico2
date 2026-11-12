import type { ApiPartidas, InicioPartida } from '../supabase/servicioSalas'
import type { Logro, NuevaRespuesta, Operacion } from '../supabase/tipos'
import type { Equation, Operator } from '../utils/mathUtils'

const OPERACION: Record<Operator, Operacion> = { '+': 'suma', '-': 'resta', '×': 'multiplicacion' }

export interface EstadoJuego {
  puntos: number
  nivel: number
  vidas: number
}

interface Callbacks {
  /** Un envío falló: el juego sigue, pero hay que avisar de que no se está guardando. */
  alFallar?: (error: unknown) => void
  /** La partida terminó y se concedieron logros nuevos. */
  alGanarLogros?: (logros: Logro[]) => void
}

/**
 * Envía a Supabase una partida del juego web, en el orden del contrato (docs/arquitectura.md):
 * iniciar_partida → respuestas → actualizar_partida → … → actualizar_partida(terminar).
 *
 * Todas las peticiones van en una cola: así las respuestas llegan siempre antes que los puntos
 * (que el servidor valida contra los aciertos registrados) aunque la red vaya lenta.
 */
export class ReportadorPartida {
  private readonly api: ApiPartidas
  private readonly callbacks: Callbacks
  private cola: Promise<void> = Promise.resolve()
  private partidaId: string | null = null
  /** Cambia con cada partida: las tareas de una partida anterior ya no hacen nada. */
  private generacion = 0
  private pendientes: Omit<NuevaRespuesta, 'partida_id'>[] = []

  constructor(api: ApiPartidas, callbacks: Callbacks = {}) {
    this.api = api
    this.callbacks = callbacks
  }

  /** Espera a que se hayan enviado (o fallado) todas las peticiones en cola. */
  terminado(): Promise<void> {
    return this.cola
  }

  private encolar(generacion: number, tarea: () => Promise<void>): void {
    this.cola = this.cola.then(async () => {
      if (generacion !== this.generacion) return
      try {
        await tarea()
      } catch (error) {
        console.warn('No se pudo guardar la partida en el servidor', error)
        this.callbacks.alFallar?.(error)
      }
    })
  }

  iniciar(datos: InicioPartida): void {
    const generacion = ++this.generacion
    this.partidaId = null
    this.pendientes = []
    this.encolar(generacion, async () => {
      this.partidaId = (await this.api.iniciar(datos)).id
    })
  }

  /** Guarda una respuesta a la operación `ecuacion`. Se envía junto con el siguiente progreso. */
  responder(ecuacion: Equation, respuesta: number, tiempoMs?: number): void {
    this.pendientes.push({
      operacion: OPERACION[ecuacion.operator],
      a: ecuacion.left,
      b: ecuacion.right,
      respuesta,
      ...(tiempoMs !== undefined && { tiempo_ms: Math.max(0, Math.min(600000, Math.round(tiempoMs))) }),
    })
  }

  /** Envía las respuestas pendientes y después el estado actual (o el final, si `terminar`). */
  progreso(estado: EstadoJuego, terminar = false): void {
    const generacion = this.generacion
    const respuestas = this.pendientes
    this.pendientes = []
    this.encolar(generacion, async () => {
      const partidaId = this.partidaId
      if (!partidaId) return // iniciar falló: ya se avisó.
      await this.api.enviarRespuestas(respuestas.map((r) => ({ ...r, partida_id: partidaId })))
      const resultado = await this.api.actualizar(partidaId, { ...estado, terminar })
      if (terminar) {
        this.partidaId = null
        if (resultado.logros_nuevos.length > 0) this.callbacks.alGanarLogros?.(resultado.logros_nuevos)
      }
    })
  }

  /** Olvida la partida en curso (el jugador volvió al menú). El servidor la marcará abandonada. */
  descartar(): void {
    this.generacion += 1
    this.partidaId = null
    this.pendientes = []
  }
}
