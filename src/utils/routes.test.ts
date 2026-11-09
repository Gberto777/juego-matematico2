import { describe, expect, it } from 'vitest'
import { parseRoute, routeToHash, type Route } from './routes'

describe('rutas', () => {
  it.each<[string, Route]>([
    ['', { name: 'home' }],
    ['#/', { name: 'home' }],
    ['#descargas', { name: 'home' }],
    ['#/desconocida', { name: 'home' }],
    ['#/practica', { name: 'solo' }],
    ['#/unirse', { name: 'join', code: '' }],
    ['#/unirse/abc234', { name: 'join', code: 'ABC234' }],
    ['#/sala/ABC234', { name: 'classroom', code: 'ABC234' }],
    ['#/sala/xx', { name: 'join', code: 'XX' }],
    ['#/profesor', { name: 'teacher' }],
    ['#/profesor/ABC234', { name: 'dashboard', code: 'ABC234' }],
    ['#/profesor/nope', { name: 'teacher' }],
    ['#/entrar', { name: 'login' }],
    ['#/registro', { name: 'register' }],
    ['#/recuperar', { name: 'forgotPassword' }],
    ['#/restablecer', { name: 'resetPassword' }],
    ['#/cuenta', { name: 'account' }],
    ['#/admin', { name: 'admin' }],
    ['#/docente', { name: 'teacherPanel' }],
    ['#/docente/sala/mul4821', { name: 'teacherRoom', code: 'MUL-4821' }],
    ['#/docente/sala/MUL-4821', { name: 'teacherRoom', code: 'MUL-4821' }],
    ['#/docente/sala/nope', { name: 'teacherPanel' }],
    ['#/salas', { name: 'myRooms' }],
    ['#/salas/MIX-1234', { name: 'studentRoom', code: 'MIX-1234' }],
    ['#/salas/ABC234', { name: 'myRooms' }],
    ['#/constructor', { name: 'home' }],
    ['#/__proto__', { name: 'home' }],
  ])('%j', (hash, route) => {
    expect(parseRoute(hash)).toEqual(route)
  })

  it.each<Route>([
    { name: 'home' },
    { name: 'solo' },
    { name: 'join', code: '' },
    { name: 'join', code: 'ABC234' },
    { name: 'classroom', code: 'ABC234' },
    { name: 'teacher' },
    { name: 'dashboard', code: 'ABC234' },
    { name: 'login' },
    { name: 'register' },
    { name: 'forgotPassword' },
    { name: 'resetPassword' },
    { name: 'account' },
    { name: 'admin' },
    { name: 'teacherPanel' },
    { name: 'teacherRoom', code: 'MUL-4821' },
    { name: 'myRooms' },
    { name: 'studentRoom', code: 'SUM-1000' },
  ])('ida y vuelta: %j', (route) => {
    expect(parseRoute(routeToHash(route))).toEqual(route)
  })
})
