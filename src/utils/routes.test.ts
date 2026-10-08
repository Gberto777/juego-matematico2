import { describe, expect, it } from 'vitest'
import { parseRoute, routeToHash, type Route } from './routes'

describe('rutas', () => {
  it.each<[string, Route]>([
    ['', { name: 'solo' }],
    ['#/', { name: 'solo' }],
    ['#/desconocida', { name: 'solo' }],
    ['#/unirse', { name: 'join', code: '' }],
    ['#/unirse/abc234', { name: 'join', code: 'ABC234' }],
    ['#/sala/ABC234', { name: 'classroom', code: 'ABC234' }],
    ['#/sala/xx', { name: 'join', code: 'XX' }],
    ['#/profesor', { name: 'teacher' }],
    ['#/profesor/ABC234', { name: 'dashboard', code: 'ABC234' }],
    ['#/profesor/nope', { name: 'teacher' }],
  ])('%j', (hash, route) => {
    expect(parseRoute(hash)).toEqual(route)
  })

  it.each<Route>([
    { name: 'solo' },
    { name: 'join', code: '' },
    { name: 'join', code: 'ABC234' },
    { name: 'classroom', code: 'ABC234' },
    { name: 'teacher' },
    { name: 'dashboard', code: 'ABC234' },
  ])('ida y vuelta: %j', (route) => {
    expect(parseRoute(routeToHash(route))).toEqual(route)
  })
})
