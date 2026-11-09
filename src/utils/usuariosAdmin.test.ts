import { describe, expect, it } from 'vitest'
import type { Usuario } from '../supabase/tipos'
import { FILTROS_INICIALES, filtrarUsuarios, normalizarBusqueda, reemplazarUsuario, resumirUsuarios } from './usuariosAdmin'

function u(id: string, nombre: string, rol: Usuario['rol'], activo = true): Usuario {
  return {
    id,
    nombre,
    rol,
    activo,
    email: `${id}@colegio.edu`,
    avatar: 'buho',
    creado_en: '2026-11-09T10:00:00Z',
    actualizado_en: '2026-11-09T10:00:00Z',
  }
}

const lista = [u('ana', 'Ana', 'alumno'), u('maria', 'María José', 'docente'), u('root', 'Admin', 'admin'), u('beto', 'Beto', 'alumno', false)]

describe('filtrarUsuarios', () => {
  it('sin filtros devuelve todos', () => {
    expect(filtrarUsuarios(lista, FILTROS_INICIALES)).toHaveLength(4)
  })

  it('busca en nombre y correo sin importar tildes ni mayúsculas', () => {
    expect(filtrarUsuarios(lista, { ...FILTROS_INICIALES, texto: 'MARIA' }).map((x) => x.id)).toEqual(['maria'])
    expect(filtrarUsuarios(lista, { ...FILTROS_INICIALES, texto: 'beto@' }).map((x) => x.id)).toEqual(['beto'])
  })

  it('filtra por rol y por estado', () => {
    expect(filtrarUsuarios(lista, { ...FILTROS_INICIALES, rol: 'alumno' }).map((x) => x.id)).toEqual(['ana', 'beto'])
    expect(filtrarUsuarios(lista, { ...FILTROS_INICIALES, estado: 'inactivos' }).map((x) => x.id)).toEqual(['beto'])
    expect(filtrarUsuarios(lista, { texto: '', rol: 'alumno', estado: 'activos' }).map((x) => x.id)).toEqual(['ana'])
  })

  it('normalizarBusqueda quita tildes y espacios', () => {
    expect(normalizarBusqueda('  Ñandú Pérez ')).toBe('nandu perez')
  })
})

describe('resumirUsuarios y reemplazarUsuario', () => {
  it('cuenta por rol y desactivados', () => {
    expect(resumirUsuarios(lista)).toEqual({ total: 4, admin: 1, docente: 1, alumno: 2, inactivos: 1 })
  })

  it('sustituye un usuario existente o añade uno nuevo al principio', () => {
    const editado = { ...lista[0], nombre: 'Ana Lucía' }
    expect(reemplazarUsuario(lista, editado)[0].nombre).toBe('Ana Lucía')
    expect(reemplazarUsuario(lista, editado)).toHaveLength(4)
    const nuevo = u('nuevo', 'Nuevo', 'alumno')
    expect(reemplazarUsuario(lista, nuevo).map((x) => x.id)[0]).toBe('nuevo')
  })
})
