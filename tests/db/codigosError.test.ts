import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { MENSAJES_ERROR } from '../../src/supabase/errores'

// Códigos que solo aparecen por un error de programación del cliente, no del usuario.
const INTERNOS = new Set(['ORIGEN_REQUERIDO', 'RETO_REQUERIDO', 'SALA_REQUERIDA', 'DEMASIADAS_RESPUESTAS'])

it('todos los códigos de error de las migraciones tienen un mensaje para el usuario', () => {
  const carpeta = join(import.meta.dirname, '..', '..', 'supabase', 'migrations')
  const sql = readdirSync(carpeta)
    .filter((f) => f.endsWith('.sql'))
    .map((f) => readFileSync(join(carpeta, f), 'utf8'))
    .join('\n')
  const codigos = new Set([...sql.matchAll(/raise exception '([A-Z_]+)'/g)].map((m) => m[1]))
  expect(codigos.size).toBeGreaterThan(10)
  const sinMensaje = [...codigos].filter((c) => !INTERNOS.has(c) && !(c in MENSAJES_ERROR))
  expect(sinMensaje).toEqual([])
})
