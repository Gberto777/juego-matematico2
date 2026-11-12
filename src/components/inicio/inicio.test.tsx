// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { AuthProvider } from '../../auth/AuthProvider'
import type { ServicioAuth } from '../../supabase/servicioAuth'
import PaginaInicio from './PaginaInicio'

function abrir(servicio: ServicioAuth | null = null) {
  return render(
    <AuthProvider servicio={servicio}>
      <PaginaInicio />
    </AuthProvider>,
  )
}

/** Lee la operación del portal ("7 + 5 = ?") y calcula su resultado. */
function resultadoDelPortal(): number {
  const texto = document.getElementById('portal-pregunta')?.textContent ?? ''
  const [, a, op, b] = /(\d+) ([+−×]) (\d+)/.exec(texto) ?? []
  const x = Number(a)
  const y = Number(b)
  return op === '+' ? x + y : op === '−' ? x - y : x * y
}

const puertas = () => within(screen.getByRole('group', { name: /elige la puerta/i })).getAllByRole('button')

afterEach(() => {
  cleanup()
  window.location.hash = ''
})

describe('página de inicio', () => {
  it('dice qué es MathQuest y tiene una sección por cada tema', () => {
    abrir()
    expect(screen.getByRole('heading', { level: 1, name: 'MathQuest: corre y calcula' })).toBeTruthy()
    for (const titulo of ['Cuatro regiones', 'Dónde se juega', 'Así se juega', 'Descargas', 'Preguntas', '¿Ya tienes el código?']) {
      expect(screen.getByRole('heading', { level: 2, name: titulo })).toBeTruthy()
    }
    expect(screen.getByRole('link', { name: 'Jugar en la web' }).getAttribute('href')).toBe('#/practica')
  })

  it('todas las imágenes del juego tienen texto alternativo o son decorativas', () => {
    abrir()
    const imagenes = Array.from(document.querySelectorAll('img'))
    expect(imagenes.length).toBeGreaterThanOrEqual(10)
    for (const imagen of imagenes) expect(imagen.getAttribute('alt')).not.toBeNull()
  })

  it('el portal se puede jugar: la puerta correcta suma un acierto', () => {
    abrir()
    expect(puertas()).toHaveLength(3)
    const correcta = puertas().find((p) => Number(p.textContent) === resultadoDelPortal())!
    fireEvent.click(correcta)
    expect(screen.getByText(/^¡Bien!/)).toBeTruthy()
    expect(correcta.getAttribute('data-resultado')).toBe('bien')
  })

  it('una puerta equivocada muestra el resultado correcto', () => {
    abrir()
    const resultado = resultadoDelPortal()
    const equivocada = puertas().find((p) => Number(p.textContent) !== resultado)!
    fireEvent.click(equivocada)
    expect(screen.getByText(new RegExp(`^Casi\\. .* = ${resultado}\\.`))).toBeTruthy()
    // Mientras se muestra la respuesta no se puede elegir otra puerta.
    expect(puertas().filter((p) => (p as HTMLButtonElement).disabled)).toHaveLength(2)
  })

  it('las pestañas cambian la pantalla que se muestra', () => {
    abrir()
    fireEvent.click(screen.getByRole('button', { name: 'La sala de clase' }))
    expect(screen.getByRole('button', { name: 'La sala de clase' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByText('Código para entrar')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'La práctica web' }))
    expect(screen.getByText('9 − 4')).toBeTruthy()
  })

  it('el formulario del código valida y lleva a la sala', () => {
    abrir()
    const campo = screen.getByLabelText('Mi sala es')
    fireEvent.change(campo, { target: { value: 'mul48' } })
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(screen.getByText(/3 letras y 4 números/)).toBeTruthy()

    fireEvent.change(campo, { target: { value: 'mul4821' } })
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(window.location.hash).toBe('#/salas/MUL-4821')
  })

  it('sin Supabase el botón de la barra lleva a jugar', () => {
    abrir(null)
    const barra = screen.getByRole('navigation', { name: 'Secciones' })
    expect(within(barra).getByRole('link', { name: 'Jugar' }).getAttribute('href')).toBe('#/practica')
  })
})
