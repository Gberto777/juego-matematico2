import { describe, expect, it, vi } from 'vitest'
import type { ApiPartidas } from '../supabase/servicioSalas'
import type { NuevaRespuesta, Partida } from '../supabase/tipos'
import { createEquation } from '../utils/mathUtils'
import { ReportadorPartida } from './reportadorPartida'

/** API falsa que anota el orden de las llamadas. */
function apiFalsa() {
  const llamadas: string[] = []
  let n = 0
  const api = {
    iniciar: vi.fn(async () => {
      n += 1
      llamadas.push(`iniciar p${n}`)
      return { id: `p${n}` } as Partida
    }),
    enviarRespuestas: vi.fn(async (respuestas: NuevaRespuesta[]) => {
      llamadas.push(`respuestas ${respuestas.length} → ${respuestas[0]?.partida_id ?? '-'}`)
    }),
    actualizar: vi.fn(async (id: string, p: { puntos: number; terminar: boolean }) => {
      llamadas.push(`actualizar ${id} ${p.puntos}${p.terminar ? ' fin' : ''}`)
      return { partida: { id } as Partida, logros_nuevos: [] as { id: string; nombre: string; descripcion: string; icono: string }[] }
    }),
  } satisfies ApiPartidas
  return { api, llamadas }
}

const suma = createEquation(3, 4, '+')
const resta = createEquation(9, 4, '-')
const mult = createEquation(6, 7, '×')

describe('ReportadorPartida', () => {
  it('envía en orden: iniciar, respuestas y luego el progreso', async () => {
    const { api, llamadas } = apiFalsa()
    const r = new ReportadorPartida(api)
    r.iniciar({ origen: 'web', nivelInicial: 1, salaId: 's1' })
    r.responder(suma, 7, 1500)
    r.progreso({ puntos: 10, nivel: 1, vidas: 3 })
    r.responder(resta, 4)
    r.responder(mult, 42)
    r.progreso({ puntos: 30, nivel: 1, vidas: 2 }, true)
    await r.terminado()

    expect(llamadas).toEqual([
      'iniciar p1',
      'respuestas 1 → p1',
      'actualizar p1 10',
      'respuestas 2 → p1',
      'actualizar p1 30 fin',
    ])
    expect(api.iniciar).toHaveBeenCalledWith({ origen: 'web', nivelInicial: 1, salaId: 's1' })
    expect(api.enviarRespuestas.mock.calls[0][0]).toEqual([
      { partida_id: 'p1', operacion: 'suma', a: 3, b: 4, respuesta: 7, tiempo_ms: 1500 },
    ])
    expect(api.enviarRespuestas.mock.calls[1][0].map((x) => x.operacion)).toEqual([
      'resta',
      'multiplicacion',
    ])
  })

  it('si iniciar falla, avisa y no envía nada más', async () => {
    const { api } = apiFalsa()
    api.iniciar.mockRejectedValueOnce(new Error('SALA_CERRADA'))
    const alFallar = vi.fn()
    const r = new ReportadorPartida(api, { alFallar })
    r.iniciar({ origen: 'web', nivelInicial: 1 })
    r.responder(suma, 7)
    r.progreso({ puntos: 10, nivel: 1, vidas: 3 })
    await r.terminado()
    expect(alFallar).toHaveBeenCalledWith(new Error('SALA_CERRADA'))
    expect(api.enviarRespuestas).not.toHaveBeenCalled()
    expect(api.actualizar).not.toHaveBeenCalled()
  })

  it('un fallo de red no detiene la cola: la siguiente petición se intenta', async () => {
    const { api, llamadas } = apiFalsa()
    api.enviarRespuestas.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    const alFallar = vi.fn()
    const r = new ReportadorPartida(api, { alFallar })
    r.iniciar({ origen: 'web', nivelInicial: 1 })
    r.responder(suma, 7)
    r.progreso({ puntos: 10, nivel: 1, vidas: 3 })
    r.responder(suma, 7)
    r.progreso({ puntos: 20, nivel: 1, vidas: 3 })
    await r.terminado()
    expect(alFallar).toHaveBeenCalledTimes(1)
    expect(llamadas.at(-1)).toBe('actualizar p1 20')
  })

  it('al empezar otra partida, lo pendiente de la anterior se descarta', async () => {
    const { api, llamadas } = apiFalsa()
    const r = new ReportadorPartida(api)
    r.iniciar({ origen: 'web', nivelInicial: 1 })
    r.responder(suma, 7)
    r.descartar()
    r.iniciar({ origen: 'web', nivelInicial: 2 })
    r.responder(resta, 5)
    r.progreso({ puntos: 20, nivel: 2, vidas: 3 })
    await r.terminado()
    expect(llamadas).toEqual(['iniciar p1', 'respuestas 1 → p1', 'actualizar p1 20'])
  })

  it('avisa de los logros nuevos al terminar', async () => {
    const { api } = apiFalsa()
    const logro = { id: 'primera_partida', nombre: 'Primeros pasos', descripcion: '', icono: '🎮' }
    api.actualizar.mockResolvedValueOnce({ partida: { id: 'p1' } as Partida, logros_nuevos: [logro] })
    const alGanarLogros = vi.fn()
    const r = new ReportadorPartida(api, { alGanarLogros })
    r.iniciar({ origen: 'web', nivelInicial: 1 })
    r.progreso({ puntos: 0, nivel: 1, vidas: 0 }, true)
    await r.terminado()
    expect(alGanarLogros).toHaveBeenCalledWith([logro])
  })

  it('limita el tiempo de respuesta al rango que acepta la base de datos', async () => {
    const { api } = apiFalsa()
    const r = new ReportadorPartida(api)
    r.iniciar({ origen: 'web', nivelInicial: 1 })
    r.responder(suma, 7, 99999999)
    r.progreso({ puntos: 10, nivel: 1, vidas: 3 })
    await r.terminado()
    expect(api.enviarRespuestas.mock.calls[0][0][0].tiempo_ms).toBe(600000)
  })
})
