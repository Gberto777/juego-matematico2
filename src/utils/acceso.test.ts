import { describe, expect, it } from 'vitest'
import type { Usuario } from '../supabase/tipos'
import { evaluarAcceso, requisitoDe, type EstadoAuth, type Requisito } from './acceso'
import type { Route } from './routes'

function sesion(rol: Usuario['rol'], activo = true): EstadoAuth {
  return {
    estado: 'sesion',
    usuario: {
      id: 'u1',
      email: 'a@b.c',
      nombre: 'Ana',
      rol,
      avatar: 'buho',
      activo,
      creado_en: '2026-01-01T00:00:00Z',
      actualizado_en: '2026-01-01T00:00:00Z',
    },
  }
}

describe('requisitoDe', () => {
  it.each<[Route, Requisito]>([
    [{ name: 'solo' }, 'publico'],
    [{ name: 'join', code: '' }, 'publico'],
    [{ name: 'teacher' }, 'publico'],
    [{ name: 'login' }, 'sin-sesion'],
    [{ name: 'register' }, 'sin-sesion'],
    [{ name: 'forgotPassword' }, 'sin-sesion'],
    [{ name: 'resetPassword' }, 'sesion'],
    [{ name: 'account' }, 'sesion'],
    [{ name: 'admin' }, ['admin']],
    [{ name: 'teacherPanel' }, ['docente', 'admin']],
    [{ name: 'teacherRoom', code: 'MUL-4821' }, ['docente', 'admin']],
    [{ name: 'myRooms' }, 'sesion'],
    [{ name: 'studentRoom', code: 'MUL-4821' }, 'sesion'],
  ])('%j → %j', (route, requisito) => {
    expect(requisitoDe(route)).toEqual(requisito)
  })
})

describe('evaluarAcceso', () => {
  it('lo público se ve siempre, aunque no haya Supabase', () => {
    expect(evaluarAcceso('publico', { estado: 'desactivado' })).toBe('permitido')
    expect(evaluarAcceso('publico', { estado: 'cargando' })).toBe('permitido')
  })

  it('sin Supabase, las cuentas no están disponibles', () => {
    expect(evaluarAcceso('sesion', { estado: 'desactivado' })).toBe('no-disponible')
    expect(evaluarAcceso('sin-sesion', { estado: 'desactivado' })).toBe('no-disponible')
  })

  it('mientras carga la sesión, espera', () => {
    expect(evaluarAcceso(['admin'], { estado: 'cargando' })).toBe('cargando')
  })

  it('sin sesión pide entrar, salvo en las pantallas de entrar y registrarse', () => {
    expect(evaluarAcceso('sesion', { estado: 'anonimo' })).toBe('pedir-login')
    expect(evaluarAcceso(['admin'], { estado: 'anonimo' })).toBe('pedir-login')
    expect(evaluarAcceso('sin-sesion', { estado: 'anonimo' })).toBe('permitido')
  })

  it('con sesión, entrar o registrarse lleva a "Mi cuenta"', () => {
    expect(evaluarAcceso('sin-sesion', sesion('alumno'))).toBe('ya-con-sesion')
  })

  it.each<[Requisito, Usuario['rol'], string]>([
    ['sesion', 'alumno', 'permitido'],
    [['admin'], 'admin', 'permitido'],
    [['admin'], 'docente', 'prohibido'],
    [['admin'], 'alumno', 'prohibido'],
    [['docente', 'admin'], 'docente', 'permitido'],
    [['docente', 'admin'], 'admin', 'permitido'],
    [['docente', 'admin'], 'alumno', 'prohibido'],
  ])('%j con rol %s → %s', (requisito, rol, acceso) => {
    expect(evaluarAcceso(requisito, sesion(rol))).toBe(acceso)
  })

  it('una cuenta desactivada no entra a nada, aunque sea admin', () => {
    expect(evaluarAcceso('sesion', sesion('admin', false))).toBe('inactivo')
    expect(evaluarAcceso(['admin'], sesion('admin', false))).toBe('inactivo')
  })

  it('un error al cargar el perfil se muestra como error', () => {
    expect(evaluarAcceso('sesion', { estado: 'error', error: new Error('x') })).toBe('error')
  })
})
