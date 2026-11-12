import type { SupabaseClient } from '@supabase/supabase-js'
import { getSupabase, isSupabaseConfigured } from './cliente'
import { urlDeLaApp } from './servicioAuth'
import type { Rol, Usuario } from './tipos'

export interface NuevoUsuario {
  nombre: string
  email: string
  password: string
  rol: Rol
}

export interface CambiosUsuario {
  nombre?: string
  rol?: Rol
  activo?: boolean
}

/** Operaciones del panel de administración sobre las cuentas. Interfaz para poder probar sin red. */
export interface ServicioUsuarios {
  listar(): Promise<Usuario[]>
  crear(datos: NuevoUsuario): Promise<Usuario>
  actualizar(id: string, cambios: CambiosUsuario): Promise<Usuario>
  /** Envía al usuario el correo para elegir una contraseña nueva. */
  enviarRecuperacion(email: string): Promise<void>
}

/** Suficiente para un colegio; si algún día hay más, se pagina en el servidor. */
export const MAX_USUARIOS_LISTADO = 1000

/**
 * La función Edge responde { error: "CODIGO" } con un estado 4xx. supabase-js lo envuelve en un
 * FunctionsHttpError; aquí se recupera el código para traducirlo con mensajeDeError().
 */
async function codigoDeFuncionEdge(error: unknown): Promise<string> {
  const respuesta = (error as { context?: unknown }).context
  if (respuesta instanceof Response) {
    try {
      const cuerpo: unknown = await respuesta.json()
      const codigo = (cuerpo as { error?: unknown } | null)?.error
      if (typeof codigo === 'string') return codigo
    } catch {
      // Respuesta sin JSON: se usa el código genérico.
    }
  }
  return 'NO_SE_PUDO_CREAR'
}

export function crearServicioUsuarios(sb: SupabaseClient): ServicioUsuarios {
  return {
    async listar() {
      // La RLS ya limita: solo un admin recibe todas las filas.
      const { data, error } = await sb
        .from('usuarios')
        .select('*')
        .order('creado_en', { ascending: false })
        .limit(MAX_USUARIOS_LISTADO)
        .returns<Usuario[]>()
      if (error) throw error
      return data
    },

    async crear(datos) {
      const { data, error } = await sb.functions.invoke<{ usuario: Usuario }>('admin-crear-usuario', { body: datos })
      if (error) throw new Error(await codigoDeFuncionEdge(error))
      if (!data?.usuario) throw new Error('NO_SE_PUDO_CREAR')
      return data.usuario
    },

    async actualizar(id, cambios) {
      const { data, error } = await sb
        .rpc('admin_actualizar_usuario', {
          p_id: id,
          p_nombre: cambios.nombre ?? null,
          p_rol: cambios.rol ?? null,
          p_activo: cambios.activo ?? null,
        })
        .single<Usuario>()
      if (error) throw error
      return data
    },

    async enviarRecuperacion(email) {
      const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: urlDeLaApp('#/restablecer') })
      if (error) throw error
    },
  }
}

let servicioPorDefecto: ServicioUsuarios | null | undefined

export function obtenerServicioUsuarios(): ServicioUsuarios | null {
  if (servicioPorDefecto === undefined) {
    servicioPorDefecto = isSupabaseConfigured ? crearServicioUsuarios(getSupabase()) : null
  }
  return servicioPorDefecto
}
