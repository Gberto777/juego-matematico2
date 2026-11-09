import type { Rol, Usuario } from '../supabase/tipos'

export interface FiltrosUsuarios {
  texto: string
  rol: Rol | 'todos'
  estado: 'todos' | 'activos' | 'inactivos'
}

export const FILTROS_INICIALES: FiltrosUsuarios = { texto: '', rol: 'todos', estado: 'todos' }

/** Minúsculas y sin tildes, para que "maria" encuentre a "María". */
export function normalizarBusqueda(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

export function filtrarUsuarios(usuarios: readonly Usuario[], filtros: FiltrosUsuarios): Usuario[] {
  const texto = normalizarBusqueda(filtros.texto)
  return usuarios.filter(
    (u) =>
      (filtros.rol === 'todos' || u.rol === filtros.rol) &&
      (filtros.estado === 'todos' || u.activo === (filtros.estado === 'activos')) &&
      (texto === '' || normalizarBusqueda(`${u.nombre} ${u.email}`).includes(texto)),
  )
}

export interface ResumenUsuarios {
  total: number
  admin: number
  docente: number
  alumno: number
  inactivos: number
}

export function resumirUsuarios(usuarios: readonly Usuario[]): ResumenUsuarios {
  const resumen: ResumenUsuarios = { total: usuarios.length, admin: 0, docente: 0, alumno: 0, inactivos: 0 }
  for (const u of usuarios) {
    resumen[u.rol] += 1
    if (!u.activo) resumen.inactivos += 1
  }
  return resumen
}

/** Sustituye en la lista el usuario actualizado (o lo añade al principio si es nuevo). */
export function reemplazarUsuario(usuarios: readonly Usuario[], usuario: Usuario): Usuario[] {
  return usuarios.some((u) => u.id === usuario.id)
    ? usuarios.map((u) => (u.id === usuario.id ? usuario : u))
    : [usuario, ...usuarios]
}
