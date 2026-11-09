import { beforeAll, describe, expect, it } from 'vitest'
import { crearBdPrueba, type BdPrueba } from './bdPrueba'

interface Partida {
  id: string
  usuario_id: string
  sala_id: string | null
  reto_id: string | null
  origen: string
  modo: string
  estado: string
  nivel_inicial: number
  nivel: number
  puntos: number
  vidas: number
  aciertos: number
  respuestas_total: number
}

interface ResultadoActualizar {
  partida: Partida
  logros_nuevos: { id: string; nombre: string; icono: string }[]
}

let bd: BdPrueba
beforeAll(async () => {
  bd = await crearBdPrueba()
}, 60000)

async function iniciar(uid: string, args: Record<string, unknown> = {}): Promise<Partida> {
  const [partida] = await bd.rpc<Partida>(uid, 'iniciar_partida', { p_origen: 'web', ...args })
  return partida
}

/** Inserta respuestas como POST /rest/v1/respuestas. `[a, b, respuesta]` con la operación indicada. */
async function responder(uid: string, partidaId: string, respuestas: [number, number, number][], operacion = 'suma') {
  for (const [a, b, respuesta] of respuestas) {
    await bd.como(
      uid,
      'insert into public.respuestas (partida_id, operacion, a, b, respuesta, tiempo_ms) values ($1, $2, $3, $4, $5, 1500)',
      [partidaId, operacion, a, b, respuesta],
    )
  }
}

function actualizar(uid: string, partidaId: string, args: Record<string, unknown>) {
  return bd.rpcValor<ResultadoActualizar>(uid, 'actualizar_partida', {
    p_partida_id: partidaId,
    p_puntos: 0,
    p_nivel: 1,
    p_vidas: 3,
    ...args,
  })
}

async function salaConAlumno() {
  const docente = await bd.crearUsuario('docente')
  const alumno = await bd.crearUsuario()
  const [sala] = await bd.rpc<{ id: string; codigo: string }>(docente, 'crear_sala', { p_nombre: 'Clase' })
  await bd.rpc(alumno, 'unirse_sala', { p_codigo: sala.codigo })
  return { docente, alumno, sala }
}

describe('iniciar_partida', () => {
  it('crea una partida de práctica en curso', async () => {
    const alumno = await bd.crearUsuario()
    const partida = await iniciar(alumno, { p_origen: 'godot', p_nivel_inicial: 3 })
    expect(partida).toMatchObject({
      usuario_id: alumno,
      origen: 'godot',
      modo: 'practica',
      estado: 'en_curso',
      nivel_inicial: 3,
      nivel: 3,
      vidas: 3,
      puntos: 0,
    })
  })

  it('valida el nivel inicial', async () => {
    const alumno = await bd.crearUsuario()
    await expect(iniciar(alumno, { p_nivel_inicial: 5 })).rejects.toThrow('NIVEL_INVALIDO')
  })

  it('marca como abandonada la partida anterior del mismo origen, no la de otro origen', async () => {
    const alumno = await bd.crearUsuario()
    const web = await iniciar(alumno, { p_origen: 'web' })
    const godot = await iniciar(alumno, { p_origen: 'godot' })
    await iniciar(alumno, { p_origen: 'web' })
    const estados = await bd.admin<{ id: string; estado: string }>(
      'select id, estado from public.partidas where id = any($1)',
      [[web.id, godot.id]],
    )
    expect(Object.fromEntries(estados.map((e) => [e.id, e.estado]))).toEqual({
      [web.id]: 'abandonada',
      [godot.id]: 'en_curso',
    })
  })

  it('con sala: solo miembros y con la sala abierta', async () => {
    const { docente, alumno, sala } = await salaConAlumno()
    expect((await iniciar(alumno, { p_sala_id: sala.id })).modo).toBe('sala')
    await expect(iniciar(await bd.crearUsuario(), { p_sala_id: sala.id })).rejects.toThrow('NO_ES_MIEMBRO')

    await bd.como(docente, `update public.salas set estado = 'cerrada' where id = $1`, [sala.id])
    await expect(iniciar(alumno, { p_sala_id: sala.id })).rejects.toThrow('SALA_CERRADA')
  })

  it('los modos sala y reto exigen su sala o reto', async () => {
    const alumno = await bd.crearUsuario()
    await expect(iniciar(alumno, { p_modo: 'sala' })).rejects.toThrow('SALA_REQUERIDA')
    await expect(iniciar(alumno, { p_modo: 'reto' })).rejects.toThrow('RETO_REQUERIDO')
  })

  it('no se pueden crear partidas directamente', async () => {
    const alumno = await bd.crearUsuario()
    await expect(
      bd.como(alumno, `insert into public.partidas (usuario_id, origen, puntos) values ($1, 'web', 9999)`, [alumno]),
    ).rejects.toThrow(/permission denied/)
  })
})

describe('respuestas', () => {
  it('la base de datos calcula el resultado, si es correcta y los contadores de la partida', async () => {
    const alumno = await bd.crearUsuario()
    const partida = await iniciar(alumno)
    await responder(alumno, partida.id, [
      [3, 4, 7],
      [5, 5, 11],
    ])
    await responder(alumno, partida.id, [[9, 4, 5]], 'resta')
    await responder(alumno, partida.id, [[6, 7, 42]], 'multiplicacion')

    const respuestas = await bd.como<{ resultado: number; correcta: boolean }>(
      alumno,
      'select resultado, correcta from public.respuestas where partida_id = $1 order by id',
      [partida.id],
    )
    expect(respuestas).toEqual([
      { resultado: 7, correcta: true },
      { resultado: 10, correcta: false },
      { resultado: 5, correcta: true },
      { resultado: 42, correcta: true },
    ])
    const [actual] = await bd.como<Partida>(alumno, 'select * from public.partidas where id = $1', [partida.id])
    expect(actual).toMatchObject({ aciertos: 3, respuestas_total: 4 })
  })

  it('el cliente no puede escribir el campo "correcta" ni los aciertos', async () => {
    const alumno = await bd.crearUsuario()
    const partida = await iniciar(alumno)
    await expect(
      bd.como(
        alumno,
        `insert into public.respuestas (partida_id, operacion, a, b, respuesta, correcta) values ($1, 'suma', 1, 1, 5, true)`,
        [partida.id],
      ),
    ).rejects.toThrow()
    await expect(
      bd.como(alumno, 'update public.partidas set aciertos = 100 where id = $1', [partida.id]),
    ).rejects.toThrow(/permission denied/)
  })

  it('no se puede responder en la partida de otro ni en una terminada', async () => {
    const alumno = await bd.crearUsuario()
    const otro = await bd.crearUsuario()
    const partida = await iniciar(alumno)
    await expect(responder(otro, partida.id, [[1, 1, 2]])).rejects.toThrow(/row-level security/)

    await actualizar(alumno, partida.id, { p_terminar: true })
    await expect(responder(alumno, partida.id, [[1, 1, 2]])).rejects.toThrow(/row-level security/)
  })

  it('si el docente cierra la sala, ya no se aceptan respuestas', async () => {
    const { docente, alumno, sala } = await salaConAlumno()
    const partida = await iniciar(alumno, { p_sala_id: sala.id })
    await responder(alumno, partida.id, [[1, 1, 2]])
    await bd.como(docente, `update public.salas set estado = 'cerrada' where id = $1`, [sala.id])
    await expect(responder(alumno, partida.id, [[1, 1, 2]])).rejects.toThrow('SALA_CERRADA')
  })

  it('cada respuesta en una sala marca al alumno como conectado', async () => {
    const { alumno, sala } = await salaConAlumno()
    const partida = await iniciar(alumno, { p_sala_id: sala.id })
    await bd.admin(`update public.sala_miembros set ultima_actividad = now() - interval '1 hour'`)
    await responder(alumno, partida.id, [[2, 2, 4]])
    const [m] = await bd.admin<{ reciente: boolean }>(
      `select ultima_actividad > now() - interval '1 minute' as reciente from public.sala_miembros where usuario_id = $1`,
      [alumno],
    )
    expect(m.reciente).toBe(true)
  })
})

describe('actualizar_partida', () => {
  it('guarda el progreso sin terminar la partida', async () => {
    const alumno = await bd.crearUsuario()
    const partida = await iniciar(alumno)
    await responder(alumno, partida.id, [
      [1, 1, 2],
      [2, 2, 4],
    ])
    const { partida: actual, logros_nuevos } = await actualizar(alumno, partida.id, { p_puntos: 20, p_vidas: 2 })
    expect(actual).toMatchObject({ estado: 'en_curso', puntos: 20, vidas: 2 })
    expect(logros_nuevos).toEqual([])
  })

  it('rechaza puntos imposibles para los aciertos registrados', async () => {
    const alumno = await bd.crearUsuario()
    const partida = await iniciar(alumno)
    await responder(alumno, partida.id, [[1, 1, 2]])
    // 1 acierto → máximo 40 + 100 de margen.
    await expect(actualizar(alumno, partida.id, { p_puntos: 141 })).rejects.toThrow('PUNTOS_INVALIDOS')
    await expect(actualizar(alumno, partida.id, { p_puntos: 140 })).resolves.toBeTruthy()
  })

  it('valida nivel, vidas y el jefe (solo en el nivel 4)', async () => {
    const alumno = await bd.crearUsuario()
    const partida = await iniciar(alumno, { p_nivel_inicial: 2 })
    await expect(actualizar(alumno, partida.id, { p_nivel: 1 })).rejects.toThrow('NIVEL_INVALIDO')
    await expect(actualizar(alumno, partida.id, { p_nivel: 2, p_vidas: -1 })).rejects.toThrow('VIDAS_INVALIDAS')
    await expect(actualizar(alumno, partida.id, { p_nivel: 3, p_jefe_derrotado: true })).rejects.toThrow(
      'DATOS_INVALIDOS',
    )
  })

  it('no se puede actualizar la partida de otro ni una ya terminada', async () => {
    const alumno = await bd.crearUsuario()
    const partida = await iniciar(alumno)
    await expect(actualizar(await bd.crearUsuario(), partida.id, {})).rejects.toThrow('PARTIDA_NO_EXISTE')
    await actualizar(alumno, partida.id, { p_terminar: true })
    await expect(actualizar(alumno, partida.id, {})).rejects.toThrow('PARTIDA_TERMINADA')
  })

  it('al terminar concede los logros que se cumplen, una sola vez', async () => {
    const alumno = await bd.crearUsuario()
    const partida = await iniciar(alumno, { p_origen: 'godot', p_nivel_inicial: 4 })
    await responder(alumno, partida.id, Array.from({ length: 20 }, (_, i) => [i, 1, i + 1] as [number, number, number]))
    const resultado = await actualizar(alumno, partida.id, {
      p_puntos: 250,
      p_nivel: 4,
      p_vidas: 1,
      p_monedas: 37,
      p_duracion_seg: 300,
      p_jefe_derrotado: true,
      p_terminar: true,
    })
    expect(resultado.partida).toMatchObject({ estado: 'terminada', aciertos: 20, respuestas_total: 20 })
    expect(resultado.logros_nuevos.map((l) => l.id)).toEqual([
      'primera_partida',
      'nivel_mixtas',
      'precision_90',
      'rey_derrotado',
    ])

    const segunda = await iniciar(alumno)
    const otra = await actualizar(alumno, segunda.id, { p_terminar: true })
    expect(otra.logros_nuevos).toEqual([])
    const logros = await bd.como(alumno, 'select logro_id from public.usuario_logros')
    expect(logros).toHaveLength(4)
  })

  it('completar un reto concede "Misión cumplida"', async () => {
    const { docente, alumno, sala } = await salaConAlumno()
    const [reto] = await bd.como<{ id: string }>(
      docente,
      `insert into public.retos (sala_id, titulo, meta_aciertos) values ($1, 'Tres sumas', 3) returning id`,
      [sala.id],
    )
    const partida = await iniciar(alumno, { p_reto_id: reto.id })
    expect(partida).toMatchObject({ modo: 'reto', sala_id: sala.id, reto_id: reto.id })
    await responder(alumno, partida.id, [
      [1, 1, 2],
      [1, 2, 3],
      [1, 3, 4],
    ])
    const { logros_nuevos } = await actualizar(alumno, partida.id, { p_puntos: 30, p_terminar: true })
    expect(logros_nuevos.map((l) => l.id)).toContain('reto_cumplido')
  })

  it('un reto vencido no se puede jugar', async () => {
    const { docente, alumno, sala } = await salaConAlumno()
    const [reto] = await bd.como<{ id: string }>(
      docente,
      `insert into public.retos (sala_id, titulo, meta_aciertos, fecha_limite) values ($1, 'Ayer', 3, now() - interval '1 day') returning id`,
      [sala.id],
    )
    await expect(iniciar(alumno, { p_reto_id: reto.id })).rejects.toThrow('RETO_VENCIDO')
  })
})

describe('quién ve las partidas', () => {
  it('el docente ve las partidas de su sala, pero no la práctica personal del alumno', async () => {
    const { docente, alumno, sala } = await salaConAlumno()
    const enSala = await iniciar(alumno, { p_sala_id: sala.id })
    const practica = await iniciar(alumno, { p_origen: 'movil' })

    const delDocente = await bd.como<{ id: string }>(docente, 'select id from public.partidas')
    expect(delDocente.map((p) => p.id)).toEqual([enSala.id])
    const delAlumno = await bd.como<{ id: string }>(alumno, 'select id from public.partidas order by iniciada_en')
    expect(delAlumno.map((p) => p.id).sort()).toEqual([enSala.id, practica.id].sort())
  })

  it('las respuestas siguen la misma regla que su partida', async () => {
    const { docente, alumno, sala } = await salaConAlumno()
    const partida = await iniciar(alumno, { p_sala_id: sala.id })
    await responder(alumno, partida.id, [[1, 1, 2]])
    expect(await bd.como(docente, 'select id from public.respuestas')).toHaveLength(1)
    expect(await bd.como(await bd.crearUsuario(), 'select id from public.respuestas')).toEqual([])
  })

  it('miembros_sala muestra la partida en curso de cada alumno', async () => {
    const { docente, alumno, sala } = await salaConAlumno()
    const partida = await iniciar(alumno, { p_sala_id: sala.id })
    await responder(alumno, partida.id, [[1, 1, 2]])
    await actualizar(alumno, partida.id, { p_puntos: 10, p_vidas: 2 })
    const [m] = await bd.rpc(docente, 'miembros_sala', { p_sala_id: sala.id })
    expect(m).toMatchObject({ jugando: true, puntos: 10, vidas: 2, nivel: 1, partidas_terminadas: 0 })

    await actualizar(alumno, partida.id, { p_puntos: 10, p_vidas: 0, p_terminar: true })
    const [despues] = await bd.rpc(docente, 'miembros_sala', { p_sala_id: sala.id })
    expect(despues).toMatchObject({ jugando: false, partidas_terminadas: 1, mejor_puntos: 10 })
  })
})
