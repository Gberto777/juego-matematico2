// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import App from './App'

// En los tests no hay .env.local, así que Firebase no está configurado.
afterEach(() => {
  cleanup()
  window.location.hash = ''
})

describe('App sin Firebase', () => {
  it('el modo individual funciona sin guardar', () => {
    render(<App />)
    const start = screen.getByRole('button', { name: /comenzar juego/i })
    expect((start as HTMLButtonElement).disabled).toBe(false)
    act(() => start.click())
    expect(screen.getByRole('button', { name: /responder/i })).toBeTruthy()
  })

  it.each(['#/profesor', '#/unirse', '#/sala/ABC234', '#/profesor/ABC234'])('%s avisa de que el modo aula no está disponible', (hash) => {
    window.location.hash = hash
    render(<App />)
    expect(screen.getByText(/modo aula no disponible/i)).toBeTruthy()
  })
})
