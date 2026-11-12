import { generateEquation, randomInt, type Equation, type Level, type RandomFn } from './mathUtils'

/*
 * El portal de la página de inicio: una operación y tres respuestas, como los portales de
 * MathQuest en Godot (scripts/math_generator.gd). Los distractores imitan los errores típicos.
 */

export interface Portal {
  ecuacion: Equation
  /** Las tres respuestas en orden aleatorio; una es ecuacion.answer. */
  opciones: [number, number, number]
}

export const REGIONES = [
  { nivel: 1, nombre: 'Bosque de las Sumas', corto: 'Bosque' },
  { nivel: 2, nombre: 'Cueva de las Restas', corto: 'Cueva' },
  { nivel: 3, nombre: 'Volcán de la Multiplicación', corto: 'Volcán' },
  { nivel: 4, nombre: 'Castillo del Caos', corto: 'Castillo' },
] as const

/** Aciertos en el portal de la portada para pasar a la región siguiente. */
export const ACIERTOS_POR_REGION = 2

function mezclar<T>(lista: T[], random: RandomFn): T[] {
  const copia = [...lista]
  for (let i = copia.length - 1; i > 0; i--) {
    const j = randomInt(0, i, random)
    ;[copia[i], copia[j]] = [copia[j], copia[i]]
  }
  return copia
}

/** Dos respuestas incorrectas, distintas entre sí y de la correcta, y nunca negativas. */
export function distractores(ecuacion: Equation, random: RandomFn = Math.random): [number, number] {
  const r = ecuacion.answer
  const { left: a, right: b } = ecuacion
  // Multiplicar: equivocarse de fila o columna en la tabla, o sumar en vez de multiplicar.
  // Sumar y restar: equivocarse por 1, 2 o 3 al contar.
  const candidatos = ecuacion.operator === '×' ? [r + a, r - a, r + b, r - b, a + b] : [r + 1, r - 1, r + 2, r - 2, r + 3, r - 3]
  const minimo = ecuacion.operator === '×' ? 1 : 0
  const validos = mezclar(
    [...new Set(candidatos)].filter((c) => c >= minimo && c !== r),
    random,
  )
  // Respaldo por si no hubo bastantes candidatos (por ejemplo 1 × 1).
  for (let paso = 1; validos.length < 2; paso++) {
    for (const c of [r + paso, r - paso]) {
      if (validos.length < 2 && c >= minimo && c !== r && !validos.includes(c)) validos.push(c)
    }
  }
  return [validos[0], validos[1]]
}

export function crearPortal(nivel: Level, random: RandomFn = Math.random, anterior?: Equation | null): Portal {
  const ecuacion = generateEquation(nivel, random, anterior)
  const opciones = mezclar([ecuacion.answer, ...distractores(ecuacion, random)], random) as [number, number, number]
  return { ecuacion, opciones }
}

/** Región en la que está el visitante según sus aciertos (1–4; se queda en el castillo). */
export function nivelPorAciertos(aciertos: number): Level {
  return Math.min(4, 1 + Math.floor(aciertos / ACIERTOS_POR_REGION)) as Level
}
