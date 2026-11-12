import { beforeAll, describe, expect, it } from 'vitest'
import { crearBdPrueba, type BdPrueba } from './bdPrueba'

let bd: BdPrueba
beforeAll(async () => {
  bd = await crearBdPrueba()
}, 60000)

describe('registro y perfil', () => {
  it('cada cuenta nueva recibe un perfil de alumno con su nombre', async () => {
    const { rows } = await bd.pg.query<{ id: string }>(
      `insert into auth.users (email, raw_user_meta_data) values ('ana@prueba.test', '{"nombre": "  Ana  "}') returning id`,
    )
    const [perfil] = await bd.como(rows[0].id, 'select nombre, email, rol, activo, avatar from public.usuarios')
    expect(perfil).toEqual({ nombre: 'Ana', email: 'ana@prueba.test', rol: 'alumno', activo: true, avatar: 'buho' })
  })

  it('el rol nunca se toma de los metadatos del registro', async () => {
    const { rows } = await bd.pg.query<{ id: string }>(
      `insert into auth.users (email, raw_user_meta_data) values ('listo@prueba.test', '{"nombre": "Listo", "rol": "admin"}') returning id`,
    )
    const [perfil] = await bd.como(rows[0].id, 'select rol from public.usuarios')
    expect(perfil.rol).toBe('alumno')
  })

  it('sin nombre usa la parte del correo antes de la @', async () => {
    const { rows } = await bd.pg.query<{ id: string }>(
      `insert into auth.users (email) values ('pepe.perez@prueba.test') returning id`,
    )
    const [perfil] = await bd.como(rows[0].id, 'select nombre from public.usuarios')
    expect(perfil.nombre).toBe('pepe.perez')
  })

  it('si cambia el correo en Auth, se copia al perfil', async () => {
    const id = await bd.crearUsuario()
    await bd.admin(`update auth.users set email = 'nuevo@prueba.test' where id = $1`, [id])
    const [perfil] = await bd.como(id, 'select email from public.usuarios')
    expect(perfil.email).toBe('nuevo@prueba.test')
  })
})

describe('permisos sobre usuarios', () => {
  it('un alumno solo ve su propio perfil', async () => {
    const a = await bd.crearUsuario()
    await bd.crearUsuario()
    const filas = await bd.como<{ id: string }>(a, 'select id from public.usuarios')
    expect(filas.map((f) => f.id)).toEqual([a])
  })

  it('sin sesión no se ve nada', async () => {
    await expect(bd.como(null, 'select id from public.usuarios')).rejects.toThrow(/permission denied/)
  })

  it('el usuario cambia su nombre y avatar', async () => {
    const a = await bd.crearUsuario()
    await bd.como(a, `update public.usuarios set nombre = 'Nuevo', avatar = 'zorro' where id = $1`, [a])
    const [perfil] = await bd.como(a, 'select nombre, avatar from public.usuarios')
    expect(perfil).toEqual({ nombre: 'Nuevo', avatar: 'zorro' })
  })

  it('el usuario NO puede cambiarse el rol ni reactivarse', async () => {
    const a = await bd.crearUsuario()
    await expect(bd.como(a, `update public.usuarios set rol = 'admin' where id = $1`, [a])).rejects.toThrow(
      /permission denied/,
    )
    await expect(bd.como(a, `update public.usuarios set activo = true where id = $1`, [a])).rejects.toThrow(
      /permission denied/,
    )
  })

  it('no puede editar el perfil de otro', async () => {
    const a = await bd.crearUsuario()
    const b = await bd.crearUsuario('alumno', 'Original')
    await bd.como(a, `update public.usuarios set nombre = 'Hackeado' where id = $1`, [b])
    const [perfil] = await bd.admin<{ nombre: string }>('select nombre from public.usuarios where id = $1', [b])
    expect(perfil.nombre).toBe('Original')
  })

  it('el avatar debe ser un identificador válido', async () => {
    const a = await bd.crearUsuario()
    await expect(
      bd.como(a, `update public.usuarios set avatar = '<script>' where id = $1`, [a]),
    ).rejects.toThrow(/check/)
  })

  it('un docente sin alumnos solo se ve a sí mismo (no puede listar a todos)', async () => {
    const docente = await bd.crearUsuario('docente')
    const filas = await bd.como<{ id: string }>(docente, 'select id from public.usuarios')
    expect(filas.map((f) => f.id)).toEqual([docente])
  })

  it('el admin ve a todos los usuarios', async () => {
    const admin = await bd.crearUsuario('admin')
    const total = await bd.admin<{ n: number }>('select count(*)::int as n from public.usuarios')
    const visibles = await bd.como<{ n: number }>(admin, 'select count(*)::int as n from public.usuarios')
    expect(visibles[0].n).toBe(total[0].n)
  })
})

describe('admin_actualizar_usuario', () => {
  it('el admin cambia el rol y el nombre', async () => {
    const admin = await bd.crearUsuario('admin')
    const a = await bd.crearUsuario()
    const [u] = await bd.rpc(admin, 'admin_actualizar_usuario', { p_id: a, p_rol: 'docente', p_nombre: 'Profe Luis' })
    expect(u).toMatchObject({ id: a, rol: 'docente', nombre: 'Profe Luis', activo: true })
  })

  it('los parámetros vacíos no cambian nada', async () => {
    const admin = await bd.crearUsuario('admin')
    const a = await bd.crearUsuario('alumno', 'Sin cambios')
    const [u] = await bd.rpc(admin, 'admin_actualizar_usuario', { p_id: a })
    expect(u).toMatchObject({ nombre: 'Sin cambios', rol: 'alumno', activo: true })
  })

  it('un docente o un alumno no pueden usarla', async () => {
    const docente = await bd.crearUsuario('docente')
    const a = await bd.crearUsuario()
    await expect(bd.rpc(docente, 'admin_actualizar_usuario', { p_id: a, p_rol: 'admin' })).rejects.toThrow('SOLO_ADMIN')
    await expect(bd.rpc(a, 'admin_actualizar_usuario', { p_id: a, p_rol: 'admin' })).rejects.toThrow('SOLO_ADMIN')
  })

  it('el admin no puede quitarse su propio rol ni desactivarse', async () => {
    const admin = await bd.crearUsuario('admin')
    await expect(bd.rpc(admin, 'admin_actualizar_usuario', { p_id: admin, p_rol: 'docente' })).rejects.toThrow(
      'NO_PUEDES_QUITARTE_ADMIN',
    )
    await expect(bd.rpc(admin, 'admin_actualizar_usuario', { p_id: admin, p_activo: false })).rejects.toThrow(
      'NO_PUEDES_QUITARTE_ADMIN',
    )
  })

  it('valida el nombre y que el usuario exista', async () => {
    const admin = await bd.crearUsuario('admin')
    const a = await bd.crearUsuario()
    await expect(bd.rpc(admin, 'admin_actualizar_usuario', { p_id: a, p_nombre: '   ' })).rejects.toThrow(
      'NOMBRE_INVALIDO',
    )
    await expect(
      bd.rpc(admin, 'admin_actualizar_usuario', { p_id: '00000000-0000-0000-0000-000000000000', p_rol: 'docente' }),
    ).rejects.toThrow('USUARIO_NO_EXISTE')
  })

  it('un usuario desactivado ve su perfil pero nada más, ni puede editarlo', async () => {
    const admin = await bd.crearUsuario('admin')
    const docente = await bd.crearUsuario('docente')
    await bd.rpc(admin, 'admin_actualizar_usuario', { p_id: docente, p_activo: false })

    const [perfil] = await bd.como(docente, 'select activo from public.usuarios')
    expect(perfil.activo).toBe(false)
    await expect(bd.rpc(docente, 'crear_sala', { p_nombre: 'Sala' })).rejects.toThrow('SOLO_DOCENTES')
    await bd.como(docente, `update public.usuarios set nombre = 'Otro' where id = $1`, [docente])
    const [sinCambio] = await bd.admin<{ nombre: string }>('select nombre from public.usuarios where id = $1', [docente])
    expect(sinCambio.nombre).not.toBe('Otro')
  })
})

describe('permisos generales', () => {
  it('las funciones internas no se pueden llamar directamente', async () => {
    const a = await bd.crearUsuario()
    await expect(bd.como(a, 'select privado.otorgar_logros($1)', [a])).rejects.toThrow(/permission denied/)
  })

  it('sin sesión no se puede llamar a ninguna RPC', async () => {
    await expect(bd.rpc(null, 'unirse_sala', { p_codigo: 'MIX-1234' })).rejects.toThrow(/permission denied/)
  })

  it('cualquiera con sesión ve el catálogo de logros', async () => {
    const a = await bd.crearUsuario()
    const logros = await bd.como(a, 'select id from public.logros')
    expect(logros.length).toBeGreaterThanOrEqual(9)
  })
})
