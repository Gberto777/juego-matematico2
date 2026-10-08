import { useEffect, useState, type FormEvent } from 'react'
import { getFirebase } from '../firebase/app'
import { JoinRoomError, getLastStudentName, joinRoom } from '../firebase/rooms'
import { PLAYER_NAME_MAX_LENGTH, ROOM_CODE_LENGTH, isValidRoomCode, normalizeName, normalizeRoomCode } from '../utils/room'
import GameButton from './GameButton'
import SecondaryButton from './SecondaryButton'

interface JoinRoomScreenProps {
  uid: string
  initialCode: string
  onJoined: (code: string) => void
  onBack: () => void
}

const inputClass =
  'w-full rounded-full border-4 border-white/40 bg-white/95 px-6 py-3 text-center text-2xl font-bold text-indigo-900 shadow-inner outline-none placeholder:text-indigo-200 focus:border-amber-300 focus:ring-4 focus:ring-amber-300/40'

function JoinRoomScreen({ uid, initialCode, onJoined, onBack }: JoinRoomScreenProps) {
  const [code, setCode] = useState(initialCode)
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isJoining, setIsJoining] = useState(false)

  // Rellena el nombre usado la última vez, salvo que el alumno ya haya empezado a escribir.
  useEffect(() => {
    let cancelled = false
    getLastStudentName(getFirebase().db, uid)
      .then((last) => !cancelled && last && setName((current) => current || last))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [uid])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const roomCode = normalizeRoomCode(code)
    const playerName = normalizeName(name, PLAYER_NAME_MAX_LENGTH)
    if (!isValidRoomCode(roomCode)) {
      setError(`El código tiene ${ROOM_CODE_LENGTH} letras y números. Revísalo en la pizarra.`)
      return
    }
    if (!playerName) {
      setError('Escribe tu nombre para que tu profe sepa quién eres.')
      return
    }

    setError(null)
    setIsJoining(true)
    try {
      await joinRoom(getFirebase().db, roomCode, uid, playerName)
      onJoined(roomCode)
    } catch (e) {
      console.error(e)
      setError(e instanceof JoinRoomError ? e.message : 'No se pudo conectar. Comprueba la conexión e inténtalo de nuevo.')
      setIsJoining(false)
    }
  }

  return (
    <section className="flex w-full max-w-md animate-pop flex-col items-center gap-6 text-center">
      <div className="text-6xl" aria-hidden="true">
        🎒
      </div>
      <h1 className="text-4xl font-bold text-white drop-shadow-[0_4px_0_rgba(0,0,0,0.25)] sm:text-5xl">Unirme a una clase</h1>

      <form onSubmit={handleSubmit} className="flex w-full flex-col items-center gap-4" noValidate>
        <label className="flex w-full flex-col gap-2 text-left">
          <span className="px-4 text-sm font-semibold tracking-widest text-amber-200 uppercase">Código de la sala</span>
          <input
            value={code}
            onChange={(e) => setCode(normalizeRoomCode(e.target.value).slice(0, ROOM_CODE_LENGTH))}
            placeholder="ABC123"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            autoFocus={!initialCode}
            className={`${inputClass} font-mono tracking-[0.3em] uppercase`}
          />
        </label>
        <label className="flex w-full flex-col gap-2 text-left">
          <span className="px-4 text-sm font-semibold tracking-widest text-amber-200 uppercase">Tu nombre</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ana G."
            maxLength={PLAYER_NAME_MAX_LENGTH}
            autoComplete="given-name"
            autoFocus={Boolean(initialCode)}
            className={inputClass}
          />
        </label>

        <div className="min-h-8" role="alert">
          {error && <p className="animate-shake font-semibold text-rose-200">⚠️ {error}</p>}
        </div>

        <GameButton type="submit" disabled={isJoining}>
          {isJoining ? '⏳ Entrando…' : '🚪 Entrar'}
        </GameButton>
      </form>

      <SecondaryButton onClick={onBack}>⬅ Volver</SecondaryButton>
    </section>
  )
}

export default JoinRoomScreen
