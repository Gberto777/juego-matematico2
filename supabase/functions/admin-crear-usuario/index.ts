// Función Edge (Deno) de Supabase: el admin crea una cuenta con correo, contraseña, nombre y rol.
//
// Hace falta una función en el servidor porque crear cuentas ajenas requiere la clave secreta
// (service_role), que nunca debe llegar al navegador ni a la app.
//
// POST /functions/v1/admin-crear-usuario
//   Authorization: Bearer <access_token del admin>
//   { "email": "...", "password": "...", "nombre": "...", "rol": "alumno" | "docente" | "admin" }
// → 201 { "usuario": { id, email, nombre, rol, avatar, activo, ... } }
// → 4xx { "error": "CODIGO" }   (ver docs/arquitectura.md)
//
// Despliegue: npx supabase functions deploy admin-crear-usuario

import { createClient } from 'npm:@supabase/supabase-js@2'
import { CABECERAS_CORS, validarNuevoUsuario } from './validar.ts'

function responder(cuerpo: unknown, estado: number): Response {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { ...CABECERAS_CORS, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (peticion: Request) => {
  if (peticion.method === 'OPTIONS') return new Response('ok', { headers: CABECERAS_CORS })
  if (peticion.method !== 'POST') return responder({ error: 'METODO_NO_PERMITIDO' }, 405)

  // Estas variables las pone Supabase automáticamente en todas las funciones Edge.
  const url = Deno.env.get('SUPABASE_URL')
  const claveServicio = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !claveServicio) return responder({ error: 'CONFIGURACION_INCOMPLETA' }, 500)

  const servidor = createClient(url, claveServicio, { auth: { persistSession: false, autoRefreshToken: false } })

  // 1. ¿Quién llama? Se comprueba el token con Supabase Auth y luego su perfil.
  const token = (peticion.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  const { data: sesion, error: errorSesion } = await servidor.auth.getUser(token)
  if (errorSesion || !sesion.user) return responder({ error: 'NO_AUTENTICADO' }, 401)

  const { data: perfil } = await servidor.from('usuarios').select('rol, activo').eq('id', sesion.user.id).single()
  if (!perfil || perfil.rol !== 'admin' || !perfil.activo) return responder({ error: 'SOLO_ADMIN' }, 403)

  // 2. Datos de la cuenta nueva.
  let cuerpo: unknown
  try {
    cuerpo = await peticion.json()
  } catch {
    return responder({ error: 'CUERPO_INVALIDO' }, 400)
  }
  const validacion = validarNuevoUsuario(cuerpo)
  if (!validacion.ok) return responder({ error: validacion.error }, 400)
  const { email, password, nombre, rol } = validacion.datos

  // 3. Se crea la cuenta (ya confirmada: el admin responde por ella). El trigger crea el perfil.
  const { data: creado, error: errorCrear } = await servidor.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nombre },
  })
  if (errorCrear || !creado.user) {
    const yaExiste = errorCrear?.code === 'email_exists' || errorCrear?.status === 422
    return responder({ error: yaExiste ? 'EMAIL_YA_EXISTE' : 'NO_SE_PUDO_CREAR' }, yaExiste ? 409 : 500)
  }

  // 4. El rol se asigna aquí: el trigger siempre crea 'alumno'.
  const { data: usuario, error: errorRol } = await servidor
    .from('usuarios')
    .update({ rol })
    .eq('id', creado.user.id)
    .select()
    .single()
  if (errorRol) return responder({ error: 'NO_SE_PUDO_ASIGNAR_ROL' }, 500)

  return responder({ usuario }, 201)
})
