/** Avatares predefinidos (ver docs/arquitectura.md). Los mismos identificadores en web, móvil y Godot. */
export const AVATARES = {
  buho: '🦉',
  zorro: '🦊',
  gato: '🐱',
  perro: '🐶',
  panda: '🐼',
  leon: '🦁',
  rana: '🐸',
  pulpo: '🐙',
  robot: '🤖',
  dragon: '🐉',
} as const

export type IdAvatar = keyof typeof AVATARES

/** Emoji del avatar; uno genérico si el identificador no está en la lista. */
export function emojiAvatar(id: string): string {
  return Object.hasOwn(AVATARES, id) ? AVATARES[id as IdAvatar] : '🙂'
}
