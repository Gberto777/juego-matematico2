import { beforeAll, describe, expect, it } from 'vitest'
import { crearBdPrueba, type BdPrueba } from './bdPrueba'

let bd: BdPrueba
beforeAll(async () => {
  bd = await crearBdPrueba()
}, 60000)

interface Opciones {
  sala?: string
  reto?: string
  modo?: string
  origen?: string
  /** [correctas, incorrectas] */
  respuestas?: [number, number]
  operacion?: 'suma' | 'resta' | 'multiplicacion'
  puntos?: number
}

/** Juega una partida completa: iniciar → respuestas → terminar. Devuelve su id. */
async function jugar(uid: string, o: Opciones = {}): Promise<string> {
  const args: Record<string, unknown> = { p_origen: o.origen ?? 'web' }
  if (o.sala) args.p_sala_id = o.sala
  if (o.reto) args.p_reto_id = o.reto
  if (o.modo) args.p_modo = o.modo
  const [partida] = await bd.rpc<{ id: string }>(uid, 'iniciar_partida', args)
  const [bien, mal] = o.respuestas ?? [3, 1]
  const op = o.operacion ?? 'suma'
  const calc = (a: number, b: number) => (op === 'suma' ? a + b : op === 'resta' ? a - b : a * b)
  for (let i = 0; i < bien + mal; i++) {
    const a = 7
    const b = 8
    await bd.como(uid, 'insert into public.respuestas (partida_id, operacion, a, b, respuesta) values ($1, $2, $3, $4, $5)', [
      partida.id,
      op,
      a,
      b,
      i < bien ? calc(a, b) : calc(a, b) + 1,
    ])
  }
  await bd.rpcValor(uid, 'actualizar_partida', {
    p_partida_id: partida.id,
    p_puntos: o.puntos ?? bien * 10,
    p_nivel: 1,
    p_vidas: 0,
    p_terminar: true,
  })
  return partida.id
}

async function salaCon(...alumnos: string[]) {
  const docente = await bd.crearUsuario('docente')
  const [sala] = await bd.rpc<{ id: string; codigo: string }>(docente, 'crear_sala', { p_nombre: 'Clase' })
  for (const a of alumnos) await bd.rpc(a, 'unirse_sala', { p_codigo: sala.codigo })
  return { docente, sala }
}

describe('ranking', () => {
  it('ordena por la mejor puntuación de cada jugador y marca la mía', async () => {
    const { docente, sala } = await salaCon()
    const ana = await bd.crearUsuario('alumno', 'Ana')
    const beto = await bd.crearUsuario('alumno', 'Beto')
    const caro = await bd.crearUsuario('alumno', 'Caro')
    for (const a of [ana, beto, caro]) await bd.rpc(a, 'unirse_sala', { p_codigo: (await bd.admin<{ codigo: string }>('select codigo from public.salas where id = $1', [sala.id]))[0].codigo })
    await jugar(ana, { sala: sala.id, respuestas: [5, 0], puntos: 50 })
    await jugar(ana, { sala: sala.id, respuestas: [2, 0], puntos: 20 })
    await jugar(beto, { sala: sala.id, respuestas: [8, 0], puntos: 80 })
    await jugar(caro, { sala: sala.id, respuestas: [5, 1], puntos: 50 })

    const filas = await bd.rpc<{ posicion: number; nombre: string; mejor_puntos: number; partidas: number; es_yo: boolean }>(
      ana,
      'ranking',
      { p_sala_id: sala.id },
    )
    expect(filas.map((f) => [Number(f.posicion), f.nombre, f.mejor_puntos, Number(f.partidas), f.es_yo])).toEqual([
      [1, 'Beto', 80, 1, false],
      [2, 'Ana', 50, 2, true],
      [2, 'Caro', 50, 1, false],
    ])
    // El docente también ve el ranking de su sala.
    expect(await bd.rpc(docente, 'ranking', { p_sala_id: sala.id })).toHaveLength(3)
  })

  it('el semanal solo cuenta las partidas desde el lunes', async () => {
    const vieja = await bd.crearUsuario('alumno', 'Vieja Gloria')
    const id = await jugar(vieja, { respuestas: [9, 0], puntos: 450 })
    await bd.admin(`update public.partidas set terminada_en = now() - interval '15 days' where id = $1`, [id])

    const global = await bd.rpc<{ nombre: string }>(vieja, 'ranking', { p_periodo: 'global', p_limite: 100 })
    const semanal = await bd.rpc<{ nombre: string }>(vieja, 'ranking', { p_periodo: 'semanal', p_limite: 100 })
    expect(global.map((f) => f.nombre)).toContain('Vieja Gloria')
    expect(semanal.map((f) => f.nombre)).not.toContain('Vieja Gloria')
  })

  it('no incluye cuentas desactivadas ni partidas abandonadas', async () => {
    const admin = await bd.crearUsuario('admin')
    const fuera = await bd.crearUsuario('alumno', 'Desactivada')
    await jugar(fuera, { respuestas: [9, 0], puntos: 440 })
    await bd.rpc(admin, 'admin_actualizar_usuario', { p_id: fuera, p_activo: false })
    const abandona = await bd.crearUsuario('alumno', 'Abandona')
    await bd.rpc(abandona, 'iniciar_partida', { p_origen: 'web' })
    await bd.rpc(abandona, 'iniciar_partida', { p_origen: 'web' })

    const nombres = (await bd.rpc<{ nombre: string }>(admin, 'ranking', { p_limite: 100 })).map((f) => f.nombre)
    expect(nombres).not.toContain('Desactivada')
    expect(nombres).not.toContain('Abandona')
  })

  it('valida el periodo y el acceso a la sala', async () => {
    const { sala } = await salaCon()
    const extraño = await bd.crearUsuario()
    await expect(bd.rpc(extraño, 'ranking', { p_periodo: 'mensual' })).rejects.toThrow('PERIODO_INVALIDO')
    await expect(bd.rpc(extraño, 'ranking', { p_sala_id: sala.id })).rejects.toThrow('SIN_ACCESO_A_SALA')
  })
})

describe('estadísticas del docente', () => {
  it('estadisticas_sala resume a cada alumno de la sala', async () => {
    const ana = await bd.crearUsuario('alumno', 'Ana')
    const beto = await bd.crearUsuario('alumno', 'Beto')
    const { docente, sala } = await salaCon(ana, beto)
    await jugar(ana, { sala: sala.id, respuestas: [3, 1], puntos: 30 })
    await jugar(ana, { sala: sala.id, respuestas: [6, 0], puntos: 60 })

    const filas = await bd.rpc<Record<string, unknown>>(docente, 'estadisticas_sala', { p_sala_id: sala.id })
    expect(filas.map((f) => [f.nombre, Number(f.partidas), Number(f.aciertos), Number(f.respuestas), f.porcentaje_aciertos, f.mejor_puntos])).toEqual([
      ['Ana', 2, 9, 10, 90, 60],
      ['Beto', 0, 0, 0, null, 0],
    ])
    await expect(bd.rpc(ana, 'estadisticas_sala', { p_sala_id: sala.id })).rejects.toThrow('SIN_ACCESO_A_SALA')
  })

  it('errores_por_operacion muestra dónde más se falla', async () => {
    const ana = await bd.crearUsuario('alumno', 'Ana')
    const { docente, sala } = await salaCon(ana)
    await jugar(ana, { sala: sala.id, respuestas: [3, 1], operacion: 'suma' })
    await jugar(ana, { sala: sala.id, respuestas: [1, 3], operacion: 'multiplicacion', puntos: 10 })

    const filas = await bd.rpc<{ operacion: string; respuestas: number; fallos: number; porcentaje_fallo: number }>(
      docente,
      'errores_por_operacion',
      { p_sala_id: sala.id },
    )
    expect(filas.map((f) => [f.operacion, Number(f.respuestas), Number(f.fallos), f.porcentaje_fallo])).toEqual([
      ['suma', 4, 1, 25],
      ['multiplicacion', 4, 3, 75],
    ])
  })

  it('operaciones_dificiles da las cuentas concretas más falladas', async () => {
    const ana = await bd.crearUsuario('alumno', 'Ana')
    await jugar(ana, { respuestas: [1, 3], operacion: 'multiplicacion', puntos: 10 })
    const [peor] = await bd.rpc<{ a: number; b: number; resultado: number; intentos: number; fallos: number }>(ana, 'operaciones_dificiles')
    expect([peor.a, peor.b, peor.resultado, Number(peor.intentos), Number(peor.fallos)]).toEqual([7, 8, 56, 4, 3])
  })

  it('cada uno ve sus propios errores, pero no los de otro', async () => {
    const ana = await bd.crearUsuario()
    const beto = await bd.crearUsuario()
    await jugar(ana, { respuestas: [2, 2] })
    const propios = await bd.rpc<{ fallos: number }>(ana, 'errores_por_operacion')
    expect(Number(propios[0].fallos)).toBe(2)
    await expect(bd.rpc(beto, 'errores_por_operacion', { p_usuario_id: ana })).rejects.toThrow('SIN_ACCESO')
    const admin = await bd.crearUsuario('admin')
    expect(await bd.rpc(admin, 'errores_por_operacion', { p_usuario_id: ana })).toHaveLength(1)
  })
})

describe('perfil y sistema', () => {
  it('estadisticas_usuario resume las partidas y trae las últimas', async () => {
    const ana = await bd.crearUsuario()
    await jugar(ana, { respuestas: [4, 0], puntos: 40, origen: 'godot' })
    await jugar(ana, { respuestas: [1, 1], puntos: 10 })
    const r = await bd.rpcValor<Record<string, unknown>>(ana, 'estadisticas_usuario')
    expect(r).toMatchObject({ partidas: 2, puntos_max: 40, aciertos: 5, respuestas: 6, precision: 83, por_origen: { web: 1, movil: 0, godot: 1 } })
    expect((r.ultimas as unknown[]).length).toBe(2)
  })

  it('el perfil ajeno solo lo ven el admin y sus docentes', async () => {
    const ana = await bd.crearUsuario()
    const beto = await bd.crearUsuario()
    await expect(bd.rpcValor(beto, 'estadisticas_usuario', { p_usuario_id: ana })).rejects.toThrow('SIN_ACCESO')
    const { docente } = await salaCon(ana)
    await expect(bd.rpcValor(docente, 'estadisticas_usuario', { p_usuario_id: ana })).resolves.toMatchObject({ partidas: 0 })
  })

  it('estadisticas_sistema es solo para el admin', async () => {
    const admin = await bd.crearUsuario('admin')
    const r = await bd.rpcValor<{ usuarios: { total: number }; partidas: { total: number }; por_dia: unknown[] }>(
      admin,
      'estadisticas_sistema',
    )
    expect(r.usuarios.total).toBeGreaterThan(5)
    expect(r.partidas.total).toBeGreaterThan(5)
    expect(r.por_dia).toHaveLength(14)
    await expect(bd.rpcValor(await bd.crearUsuario('docente'), 'estadisticas_sistema')).rejects.toThrow('SOLO_ADMIN')
  })
})

describe('retos', () => {
  it('retos_sala cuenta quién lo cumplió y cómo voy yo; progreso_reto da el detalle', async () => {
    const ana = await bd.crearUsuario('alumno', 'Ana')
    const beto = await bd.crearUsuario('alumno', 'Beto')
    const { docente, sala } = await salaCon(ana, beto)
    const [reto] = await bd.como<{ id: string }>(
      docente,
      `insert into public.retos (sala_id, titulo, meta_aciertos) values ($1, 'Cinco sumas', 5) returning id`,
      [sala.id],
    )
    await jugar(ana, { reto: reto.id, respuestas: [5, 0], puntos: 50 })
    await jugar(beto, { reto: reto.id, respuestas: [3, 0], puntos: 30 })

    const [deAna] = await bd.rpc<Record<string, unknown>>(ana, 'retos_sala', { p_sala_id: sala.id })
    expect([Number(deAna.cumplidos), Number(deAna.miembros), deAna.mi_mejor, deAna.cumplido_por_mi]).toEqual([1, 2, 5, true])
    const [deBeto] = await bd.rpc<Record<string, unknown>>(beto, 'retos_sala', { p_sala_id: sala.id })
    expect([deBeto.mi_mejor, deBeto.cumplido_por_mi]).toEqual([3, false])

    const progreso = await bd.rpc<Record<string, unknown>>(docente, 'progreso_reto', { p_reto_id: reto.id })
    expect(progreso.map((p) => [p.nombre, p.mejor_aciertos, p.cumplido])).toEqual([
      ['Ana', 5, true],
      ['Beto', 3, false],
    ])
    await expect(bd.rpc(ana, 'progreso_reto', { p_reto_id: reto.id })).rejects.toThrow('SIN_ACCESO_A_SALA')
  })

  it('el reto diario cambia con el día y se cumple con una partida en modo diario', async () => {
    const ana = await bd.crearUsuario()
    const lunes = await bd.rpcValor<Record<string, unknown>>(ana, 'reto_diario', { p_fecha: '2026-11-09' })
    const martes = await bd.rpcValor<Record<string, unknown>>(ana, 'reto_diario', { p_fecha: '2026-11-10' })
    expect(lunes.tema).not.toBe(martes.tema)

    const hoy = await bd.rpcValor<{ meta_aciertos: number; completado: boolean }>(ana, 'reto_diario')
    expect(hoy.completado).toBe(false)
    await jugar(ana, { modo: 'diario', respuestas: [hoy.meta_aciertos, 0], puntos: hoy.meta_aciertos * 10 })
    expect(await bd.rpcValor(ana, 'reto_diario')).toMatchObject({ completado: true, mi_mejor: hoy.meta_aciertos })
  })
})
