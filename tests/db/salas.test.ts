import { beforeAll, describe, expect, it } from 'vitest'
import { crearBdPrueba, type BdPrueba } from './bdPrueba'

interface Sala {
  id: string
  codigo: string
  nombre: string
  docente_id: string
  tema: string
  dificultad: string
  max_jugadores: number
  estado: string
  cerrada_en: Date | null
}

let bd: BdPrueba
beforeAll(async () => {
  bd = await crearBdPrueba()
}, 60000)

async function nuevaSala(docente: string, args: Record<string, unknown> = {}): Promise<Sala> {
  const [sala] = await bd.rpc<Sala>(docente, 'crear_sala', { p_nombre: '4.º B', ...args })
  return sala
}

describe('crear_sala', () => {
  it('el docente crea una sala abierta con un código según el tema', async () => {
    const docente = await bd.crearUsuario('docente')
    const sala = await nuevaSala(docente, { p_tema: 'multiplicacion', p_dificultad: 'dificil', p_max_jugadores: 25 })
    expect(sala).toMatchObject({
      nombre: '4.º B',
      docente_id: docente,
      tema: 'multiplicacion',
      dificultad: 'dificil',
      max_jugadores: 25,
      estado: 'abierta',
    })
    expect(sala.codigo).toMatch(/^MUL-\d{4}$/)
  })

  it('usa valores por defecto: mixta, media y 30 jugadores', async () => {
    const docente = await bd.crearUsuario('docente')
    const sala = await nuevaSala(docente)
    expect(sala).toMatchObject({ tema: 'mixta', dificultad: 'media', max_jugadores: 30 })
    expect(sala.codigo).toMatch(/^MIX-\d{4}$/)
  })

  it('el admin también puede crear salas', async () => {
    const admin = await bd.crearUsuario('admin')
    expect((await nuevaSala(admin)).docente_id).toBe(admin)
  })

  it('un alumno no puede crear salas', async () => {
    const alumno = await bd.crearUsuario()
    await expect(nuevaSala(alumno)).rejects.toThrow('SOLO_DOCENTES')
  })

  it('valida el nombre y el límite de jugadores', async () => {
    const docente = await bd.crearUsuario('docente')
    await expect(nuevaSala(docente, { p_nombre: '  ' })).rejects.toThrow('NOMBRE_INVALIDO')
    await expect(nuevaSala(docente, { p_max_jugadores: 0 })).rejects.toThrow('LIMITE_INVALIDO')
    await expect(nuevaSala(docente, { p_max_jugadores: 101 })).rejects.toThrow('LIMITE_INVALIDO')
  })

  it('no se pueden insertar salas directamente (sin pasar por crear_sala)', async () => {
    const docente = await bd.crearUsuario('docente')
    await expect(
      bd.como(docente, `insert into public.salas (codigo, nombre, docente_id) values ('MIX-0001', 'x', $1)`, [docente]),
    ).rejects.toThrow(/permission denied/)
  })
})

describe('unirse_sala', () => {
  it('acepta el código en minúsculas, sin guion o con espacios', async () => {
    const docente = await bd.crearUsuario('docente')
    const sala = await nuevaSala(docente)
    for (const variante of [sala.codigo.toLowerCase(), sala.codigo.replace('-', ''), sala.codigo.replace('-', ' ')]) {
      const alumno = await bd.crearUsuario()
      const [unida] = await bd.rpc<Sala>(alumno, 'unirse_sala', { p_codigo: variante })
      expect(unida.id).toBe(sala.id)
    }
  })

  it('al unirse, el alumno ve la sala; otros alumnos no', async () => {
    const docente = await bd.crearUsuario('docente')
    const sala = await nuevaSala(docente)
    const dentro = await bd.crearUsuario()
    const fuera = await bd.crearUsuario()
    await bd.rpc(dentro, 'unirse_sala', { p_codigo: sala.codigo })

    expect(await bd.como(dentro, 'select id from public.salas')).toEqual([{ id: sala.id }])
    expect(await bd.como(fuera, 'select id from public.salas')).toEqual([])
  })

  it('volver a unirse no duplica ni cuenta para el límite', async () => {
    const docente = await bd.crearUsuario('docente')
    const sala = await nuevaSala(docente, { p_max_jugadores: 1 })
    const alumno = await bd.crearUsuario()
    await bd.rpc(alumno, 'unirse_sala', { p_codigo: sala.codigo })
    await bd.rpc(alumno, 'unirse_sala', { p_codigo: sala.codigo })
    const miembros = await bd.admin('select * from public.sala_miembros where sala_id = $1', [sala.id])
    expect(miembros).toHaveLength(1)
  })

  it('respeta el límite de jugadores', async () => {
    const docente = await bd.crearUsuario('docente')
    const sala = await nuevaSala(docente, { p_max_jugadores: 2 })
    await bd.rpc(await bd.crearUsuario(), 'unirse_sala', { p_codigo: sala.codigo })
    await bd.rpc(await bd.crearUsuario(), 'unirse_sala', { p_codigo: sala.codigo })
    await expect(bd.rpc(await bd.crearUsuario(), 'unirse_sala', { p_codigo: sala.codigo })).rejects.toThrow('SALA_LLENA')
  })

  it('rechaza códigos inexistentes y salas cerradas', async () => {
    const docente = await bd.crearUsuario('docente')
    const sala = await nuevaSala(docente)
    const alumno = await bd.crearUsuario()
    await expect(bd.rpc(alumno, 'unirse_sala', { p_codigo: 'XYZ-0000' })).rejects.toThrow('SALA_NO_EXISTE')

    await bd.como(docente, `update public.salas set estado = 'cerrada' where id = $1`, [sala.id])
    await expect(bd.rpc(alumno, 'unirse_sala', { p_codigo: sala.codigo })).rejects.toThrow('SALA_CERRADA')
  })

  it('el docente de la sala no se cuenta como miembro', async () => {
    const docente = await bd.crearUsuario('docente')
    const sala = await nuevaSala(docente)
    await bd.rpc(docente, 'unirse_sala', { p_codigo: sala.codigo })
    expect(await bd.admin('select * from public.sala_miembros where sala_id = $1', [sala.id])).toEqual([])
  })

  it('un alumno no puede meterse en una sala insertando la fila a mano', async () => {
    const docente = await bd.crearUsuario('docente')
    const sala = await nuevaSala(docente)
    const alumno = await bd.crearUsuario()
    await expect(
      bd.como(alumno, 'insert into public.sala_miembros (sala_id, usuario_id) values ($1, $2)', [sala.id, alumno]),
    ).rejects.toThrow(/permission denied/)
  })
})

describe('gestión de la sala', () => {
  it('el docente abre y cierra la sala; se guarda cuándo se cerró', async () => {
    const docente = await bd.crearUsuario('docente')
    const sala = await nuevaSala(docente)
    await bd.como(docente, `update public.salas set estado = 'cerrada' where id = $1`, [sala.id])
    let [actual] = await bd.como<Sala>(docente, 'select * from public.salas where id = $1', [sala.id])
    expect(actual.estado).toBe('cerrada')
    expect(actual.cerrada_en).toBeInstanceOf(Date)

    await bd.como(docente, `update public.salas set estado = 'abierta' where id = $1`, [sala.id])
    ;[actual] = await bd.como<Sala>(docente, 'select * from public.salas where id = $1', [sala.id])
    expect(actual.cerrada_en).toBeNull()
  })

  it('otro docente no puede cerrar ni borrar una sala ajena', async () => {
    const docente = await bd.crearUsuario('docente')
    const otro = await bd.crearUsuario('docente')
    const sala = await nuevaSala(docente)
    await bd.como(otro, `update public.salas set estado = 'cerrada' where id = $1`, [sala.id])
    await bd.como(otro, 'delete from public.salas where id = $1', [sala.id])
    const [actual] = await bd.admin<Sala>('select * from public.salas where id = $1', [sala.id])
    expect(actual.estado).toBe('abierta')
  })

  it('un miembro no puede cambiar la sala', async () => {
    const docente = await bd.crearUsuario('docente')
    const sala = await nuevaSala(docente)
    const alumno = await bd.crearUsuario()
    await bd.rpc(alumno, 'unirse_sala', { p_codigo: sala.codigo })
    await bd.como(alumno, `update public.salas set estado = 'cerrada' where id = $1`, [sala.id])
    const [actual] = await bd.admin<Sala>('select * from public.salas where id = $1', [sala.id])
    expect(actual.estado).toBe('abierta')
  })

  it('el código y el docente no se pueden cambiar', async () => {
    const docente = await bd.crearUsuario('docente')
    const sala = await nuevaSala(docente)
    await expect(
      bd.como(docente, `update public.salas set codigo = 'MIX-0000' where id = $1`, [sala.id]),
    ).rejects.toThrow(/permission denied/)
  })

  it('el admin gestiona cualquier sala', async () => {
    const docente = await bd.crearUsuario('docente')
    const admin = await bd.crearUsuario('admin')
    const sala = await nuevaSala(docente)
    await bd.como(admin, `update public.salas set max_jugadores = 5 where id = $1`, [sala.id])
    const [actual] = await bd.admin<Sala>('select * from public.salas where id = $1', [sala.id])
    expect(actual.max_jugadores).toBe(5)
  })

  it('el docente expulsa a un alumno y el alumno puede salirse', async () => {
    const docente = await bd.crearUsuario('docente')
    const sala = await nuevaSala(docente)
    const a = await bd.crearUsuario()
    const b = await bd.crearUsuario()
    await bd.rpc(a, 'unirse_sala', { p_codigo: sala.codigo })
    await bd.rpc(b, 'unirse_sala', { p_codigo: sala.codigo })

    await bd.como(docente, 'delete from public.sala_miembros where sala_id = $1 and usuario_id = $2', [sala.id, a])
    await bd.como(b, 'delete from public.sala_miembros where sala_id = $1 and usuario_id = $2', [sala.id, b])
    expect(await bd.admin('select * from public.sala_miembros where sala_id = $1', [sala.id])).toEqual([])
  })

  it('un alumno no puede expulsar a otro', async () => {
    const docente = await bd.crearUsuario('docente')
    const sala = await nuevaSala(docente)
    const a = await bd.crearUsuario()
    const b = await bd.crearUsuario()
    await bd.rpc(a, 'unirse_sala', { p_codigo: sala.codigo })
    await bd.rpc(b, 'unirse_sala', { p_codigo: sala.codigo })
    await bd.como(a, 'delete from public.sala_miembros where usuario_id = $1', [b])
    expect(await bd.admin('select * from public.sala_miembros where sala_id = $1', [sala.id])).toHaveLength(2)
  })
})

describe('miembros_sala y latido_sala', () => {
  it('el docente ve quién está conectado', async () => {
    const docente = await bd.crearUsuario('docente')
    const sala = await nuevaSala(docente)
    const activo = await bd.crearUsuario('alumno', 'Beatriz')
    const dormido = await bd.crearUsuario('alumno', 'Abel')
    await bd.rpc(activo, 'unirse_sala', { p_codigo: sala.codigo })
    await bd.rpc(dormido, 'unirse_sala', { p_codigo: sala.codigo })
    await bd.admin(
      `update public.sala_miembros set ultima_actividad = now() - interval '10 minutes' where usuario_id = $1`,
      [dormido],
    )

    const miembros = await bd.rpc<{ nombre: string; conectado: boolean; jugando: boolean }>(docente, 'miembros_sala', {
      p_sala_id: sala.id,
    })
    expect(miembros.map((m) => [m.nombre, m.conectado, m.jugando])).toEqual([
      ['Abel', false, false],
      ['Beatriz', true, false],
    ])
  })

  it('el latido marca al alumno como conectado y devuelve el estado de la sala', async () => {
    const docente = await bd.crearUsuario('docente')
    const sala = await nuevaSala(docente)
    const alumno = await bd.crearUsuario()
    await bd.rpc(alumno, 'unirse_sala', { p_codigo: sala.codigo })
    await bd.admin(`update public.sala_miembros set ultima_actividad = now() - interval '1 hour'`)

    expect(await bd.rpcValor(alumno, 'latido_sala', { p_sala_id: sala.id })).toBe('abierta')
    const [m] = await bd.rpc<{ conectado: boolean }>(alumno, 'miembros_sala', { p_sala_id: sala.id })
    expect(m.conectado).toBe(true)

    await bd.como(docente, `update public.salas set estado = 'cerrada' where id = $1`, [sala.id])
    expect(await bd.rpcValor(alumno, 'latido_sala', { p_sala_id: sala.id })).toBe('cerrada')
  })

  it('el latido de alguien que no es miembro devuelve null', async () => {
    const docente = await bd.crearUsuario('docente')
    const sala = await nuevaSala(docente)
    expect(await bd.rpcValor(await bd.crearUsuario(), 'latido_sala', { p_sala_id: sala.id })).toBeNull()
  })

  it('quien no es de la sala no puede ver sus miembros', async () => {
    const docente = await bd.crearUsuario('docente')
    const sala = await nuevaSala(docente)
    await expect(bd.rpc(await bd.crearUsuario(), 'miembros_sala', { p_sala_id: sala.id })).rejects.toThrow(
      'SIN_ACCESO_A_SALA',
    )
    await expect(bd.rpc(await bd.crearUsuario('docente'), 'miembros_sala', { p_sala_id: sala.id })).rejects.toThrow(
      'SIN_ACCESO_A_SALA',
    )
  })

  it('el docente ve el perfil de sus alumnos, pero no el de alumnos ajenos', async () => {
    const docente = await bd.crearUsuario('docente')
    const sala = await nuevaSala(docente)
    const mio = await bd.crearUsuario()
    const ajeno = await bd.crearUsuario()
    await bd.rpc(mio, 'unirse_sala', { p_codigo: sala.codigo })
    const visibles = await bd.como<{ id: string }>(docente, 'select id from public.usuarios where id = any($1)', [
      [mio, ajeno],
    ])
    expect(visibles.map((v) => v.id)).toEqual([mio])
  })
})

describe('retos', () => {
  it('el docente crea un reto en su sala y sus alumnos lo ven', async () => {
    const docente = await bd.crearUsuario('docente')
    const sala = await nuevaSala(docente)
    const alumno = await bd.crearUsuario()
    const fuera = await bd.crearUsuario()
    await bd.rpc(alumno, 'unirse_sala', { p_codigo: sala.codigo })

    await bd.como(
      docente,
      `insert into public.retos (sala_id, titulo, tema, meta_aciertos) values ($1, 'Tablas del 7', 'multiplicacion', 15)`,
      [sala.id],
    )
    const [reto] = await bd.como<{ titulo: string; docente_id: string }>(alumno, 'select * from public.retos')
    expect(reto).toMatchObject({ titulo: 'Tablas del 7', docente_id: docente })
    expect(await bd.como(fuera, 'select * from public.retos')).toEqual([])
  })

  it('no se pueden crear retos en salas ajenas ni siendo alumno', async () => {
    const docente = await bd.crearUsuario('docente')
    const sala = await nuevaSala(docente)
    const insertar = (uid: string) =>
      bd.como(uid, `insert into public.retos (sala_id, titulo, meta_aciertos) values ($1, 'x', 5)`, [sala.id])
    await expect(insertar(await bd.crearUsuario('docente'))).rejects.toThrow(/row-level security/)
    const alumno = await bd.crearUsuario()
    await bd.rpc(alumno, 'unirse_sala', { p_codigo: sala.codigo })
    await expect(insertar(alumno)).rejects.toThrow(/row-level security/)
  })
})
