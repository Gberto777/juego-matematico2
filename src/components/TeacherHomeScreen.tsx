import { useState, type FormEvent } from 'react'
import { getFirebase } from '../firebase/app'
import { createRoom } from '../firebase/rooms'
import { useTeacherRooms } from '../hooks/useRoomData'
import { ROOM_NAME_MAX_LENGTH, normalizeName } from '../utils/room'
import GameButton from './GameButton'
import SecondaryButton from './SecondaryButton'

interface TeacherHomeScreenProps {
  uid: string
  onOpenRoom: (code: string) => void
  onBack: () => void
}

const dateFormat = new Intl.DateTimeFormat('es', { dateStyle: 'medium', timeStyle: 'short' })

function TeacherHomeScreen({ uid, onOpenRoom, onBack }: TeacherHomeScreenProps) {
  const rooms = useTeacherRooms(uid)
  const [name, setName] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsCreating(true)
    setError(null)
    try {
      const roomName = normalizeName(name, ROOM_NAME_MAX_LENGTH) ?? `Clase del ${dateFormat.format(new Date())}`
      onOpenRoom(await createRoom(getFirebase().db, uid, roomName))
    } catch (e) {
      console.error(e)
      setError(e instanceof Error ? e.message : 'No se pudo crear la sala.')
      setIsCreating(false)
    }
  }

  return (
    <section className="flex w-full max-w-2xl animate-pop flex-col items-center gap-6 text-center">
      <div className="text-6xl" aria-hidden="true">
        👩‍🏫
      </div>
      <h1 className="text-4xl font-bold text-white drop-shadow-[0_4px_0_rgba(0,0,0,0.25)] sm:text-5xl">Modo profesor</h1>
      <p className="text-lg text-indigo-100">
        Crea una sala, proyecta el código y sigue en directo cómo juega tu clase.
      </p>

      <form
        onSubmit={handleCreate}
        className="flex w-full flex-col items-center gap-4 rounded-[2rem] bg-white p-6 shadow-[0_10px_0_0_rgba(0,0,0,0.15)]"
      >
        <label className="flex w-full flex-col gap-2 text-left">
          <span className="text-sm font-semibold tracking-widest text-indigo-400 uppercase">Nombre de la clase (opcional)</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="4.º B · Matemáticas"
            maxLength={ROOM_NAME_MAX_LENGTH}
            className="w-full rounded-full border-4 border-indigo-100 px-5 py-3 text-xl text-indigo-900 outline-none placeholder:text-indigo-200 focus:border-amber-300"
          />
        </label>
        <GameButton type="submit" disabled={isCreating}>
          {isCreating ? '⏳ Creando…' : '✨ Crear sala'}
        </GameButton>
        {error && (
          <p className="font-semibold text-rose-600" role="alert">
            ⚠️ {error}
          </p>
        )}
      </form>

      <div className="w-full rounded-3xl bg-indigo-950/30 p-4 text-left ring-1 ring-white/20 backdrop-blur">
        <h2 className="mb-3 text-sm font-semibold tracking-widest text-amber-200 uppercase">Tus salas</h2>
        {rooms.status === 'loading' && <p className="text-indigo-100">⏳ Cargando…</p>}
        {rooms.status === 'error' && <p className="text-rose-200">⚠️ No se pudieron cargar tus salas.</p>}
        {rooms.status === 'ready' && rooms.data.length === 0 && (
          <p className="text-indigo-100">Todavía no has creado ninguna sala.</p>
        )}
        {rooms.status === 'ready' && rooms.data.length > 0 && (
          <ul className="flex flex-col gap-2">
            {rooms.data.map((room) => (
              <li key={room.code}>
                <button
                  type="button"
                  onClick={() => onOpenRoom(room.code)}
                  className="flex w-full items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 text-left shadow-[0_4px_0_0_rgba(0,0,0,0.15)] transition-transform hover:-translate-y-0.5 focus-visible:outline-4 focus-visible:outline-white"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-bold text-indigo-900">{room.name}</span>
                    <span className="block text-sm text-indigo-400">
                      {room.createdAt ? dateFormat.format(room.createdAt) : '—'}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="font-mono text-lg font-bold tracking-widest text-indigo-700">{room.code}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                        room.status === 'open' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {room.status === 'open' ? 'Abierta' : 'Cerrada'}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-indigo-200">
          Tus salas quedan asociadas a este navegador. Usa siempre el mismo para volver a verlas.
        </p>
      </div>

      <SecondaryButton onClick={onBack}>⬅ Volver al juego</SecondaryButton>
    </section>
  )
}

export default TeacherHomeScreen
