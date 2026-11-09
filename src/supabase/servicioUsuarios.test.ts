import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import { crearServicioUsuarios } from './servicioUsuarios'

/** Cliente de Supabase mínimo con solo lo que usa el servicio. */
function clienteFalso(partes: Record<string, unknown>) {
  return partes as unknown as SupabaseClient
}

describe('servicioUsuarios', () => {
  it('crear: devuelve el usuario que responde la función Edge', async () => {
    const usuario = { id: 'u1', nombre: 'Ana' }
    const invoke = vi.fn().mockResolvedValue({ data: { usuario }, error: null })
    const servicio = crearServicioUsuarios(clienteFalso({ functions: { invoke } }))
    const datos = { nombre: 'Ana', email: 'ana@x.edu', password: 'secreta123', rol: 'docente' as const }

    await expect(servicio.crear(datos)).resolves.toEqual(usuario)
    expect(invoke).toHaveBeenCalledWith('admin-crear-usuario', { body: datos })
  })

  it('crear: convierte el error de la función en su código (EMAIL_YA_EXISTE…)', async () => {
    const respuesta = new Response(JSON.stringify({ error: 'EMAIL_YA_EXISTE' }), { status: 409 })
    const invoke = vi.fn().mockResolvedValue({ data: null, error: { name: 'FunctionsHttpError', context: respuesta } })
    const servicio = crearServicioUsuarios(clienteFalso({ functions: { invoke } }))
    await expect(servicio.crear({ nombre: 'A', email: 'a@x.edu', password: '12345678', rol: 'alumno' })).rejects.toThrow(
      'EMAIL_YA_EXISTE',
    )
  })

  it('crear: si la respuesta no trae código, usa uno genérico', async () => {
    const invoke = vi.fn().mockResolvedValue({ data: null, error: { name: 'FunctionsFetchError', context: null } })
    const servicio = crearServicioUsuarios(clienteFalso({ functions: { invoke } }))
    await expect(servicio.crear({ nombre: 'A', email: 'a@x.edu', password: '12345678', rol: 'alumno' })).rejects.toThrow(
      'NO_SE_PUDO_CREAR',
    )
  })

  it('actualizar: llama a la RPC con nulos en lo que no cambia', async () => {
    const single = vi.fn().mockResolvedValue({ data: { id: 'u1', rol: 'docente' }, error: null })
    const rpc = vi.fn().mockReturnValue({ single })
    const servicio = crearServicioUsuarios(clienteFalso({ rpc }))

    await expect(servicio.actualizar('u1', { rol: 'docente' })).resolves.toEqual({ id: 'u1', rol: 'docente' })
    expect(rpc).toHaveBeenCalledWith('admin_actualizar_usuario', {
      p_id: 'u1',
      p_nombre: null,
      p_rol: 'docente',
      p_activo: null,
    })
  })

  it('actualizar: propaga el error de la base de datos', async () => {
    const error = { code: 'P0001', message: 'NO_PUEDES_QUITARTE_ADMIN' }
    const rpc = vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: null, error }) })
    const servicio = crearServicioUsuarios(clienteFalso({ rpc }))
    await expect(servicio.actualizar('yo', { activo: false })).rejects.toBe(error)
  })
})
