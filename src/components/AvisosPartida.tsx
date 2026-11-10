import type { Logro } from '../supabase/tipos'

interface AvisosPartidaProps {
  /** Algo no se pudo guardar en el servidor (el juego sigue). */
  error?: string | null
  logrosNuevos: Logro[]
}

/** Avisos sobre el juego: logros conseguidos al terminar y fallos al guardar. */
function AvisosPartida({ error, logrosNuevos }: AvisosPartidaProps) {
  return (
    <>
      {error && (
        <p role="alert" className="max-w-md rounded-2xl bg-rose-900/40 px-4 py-2 text-center font-semibold text-rose-100">
          ⚠️ {error}
        </p>
      )}
      {logrosNuevos.length > 0 && (
        <div role="status" className="flex max-w-md animate-pop flex-col gap-1 rounded-2xl bg-amber-300 px-5 py-3 text-amber-950">
          <p className="font-bold">🏅 ¡Logro conseguido!</p>
          {logrosNuevos.map((l) => (
            <p key={l.id}>
              {l.icono} <strong>{l.nombre}</strong>: {l.descripcion}
            </p>
          ))}
        </div>
      )}
    </>
  )
}

export default AvisosPartida
