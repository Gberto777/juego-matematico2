import { useEffect, useMemo, useState } from 'react'
import { getFirebase } from '../firebase/app'
import { createFirestoreRepository } from '../firebase/gameRepository'
import { getPlayer } from '../firebase/rooms'
import { useGameLogic } from '../hooks/useGameLogic'
import { useRoom } from '../hooks/useRoomData'
import { useRoomReporter } from '../hooks/useRoomReporter'
import type { Player, Room } from '../utils/room'
import GameView from './GameView'
import SecondaryButton from './SecondaryButton'
import StatusMessage from './StatusMessage'

interface ClassroomScreenProps {
  code: string
  uid: string
  /** El alumno no está registrado en la sala: hay que pasar por la pantalla de unirse. */
  onNotJoined: () => void
  onLeave: () => void
}

/** Comprueba que el alumno pertenece a la sala y carga sus acumulados antes de jugar. */
function ClassroomScreen({ code, uid, onNotJoined, onLeave }: ClassroomScreenProps) {
  const room = useRoom(code)
  const [player, setPlayer] = useState<Player | null | 'loading' | 'error'>('loading')

  useEffect(() => {
    let cancelled = false
    getPlayer(getFirebase().db, code, uid).then(
      (p) => !cancelled && setPlayer(p),
      (error: unknown) => {
        console.error(error)
        if (!cancelled) setPlayer('error')
      },
    )
    return () => {
      cancelled = true
    }
  }, [code, uid])

  useEffect(() => {
    if (player === null) onNotJoined()
  }, [player, onNotJoined])

  if (player === 'error' || room.status === 'error') {
    return (
      <StatusMessage icon="📡" title="No se pudo conectar con la sala">
        <p>Comprueba la conexión a internet y vuelve a intentarlo.</p>
        <SecondaryButton onClick={onLeave}>⬅ Salir</SecondaryButton>
      </StatusMessage>
    )
  }
  if (player === 'loading' || player === null || room.status === 'loading') {
    return <StatusMessage icon="⏳" title="Entrando en la sala…" />
  }
  if (!room.data) {
    return (
      <StatusMessage icon="🔍" title="Esta sala ya no existe">
        <SecondaryButton onClick={onLeave}>⬅ Salir</SecondaryButton>
      </StatusMessage>
    )
  }

  return <ClassroomGame room={room.data} uid={uid} player={player} onLeave={onLeave} />
}

interface ClassroomGameProps {
  room: Room
  uid: string
  player: Player
  onLeave: () => void
}

function ClassroomGame({ room, uid, player, onLeave }: ClassroomGameProps) {
  const repository = useMemo(() => createFirestoreRepository(getFirebase().db, uid, `sala-${room.code}`), [uid, room.code])
  const game = useGameLogic({ repository })
  useRoomReporter(room.code, uid, player, game)

  const isClosed = room.status === 'closed'

  return (
    <GameView
      game={game}
      startBanner={
        <div className="flex flex-col items-center gap-1 rounded-3xl bg-white/15 px-6 py-3 text-white ring-1 ring-white/20 backdrop-blur">
          <span className="text-sm font-semibold tracking-widest text-amber-200 uppercase">
            🏫 {room.name || 'Clase'} · <span className="font-mono">{room.code}</span>
          </span>
          <span className="text-lg">
            Jugando como <strong>{player.name}</strong>
          </span>
          {isClosed && (
            <span className="text-sm text-rose-200">🔒 La sala está cerrada: tus resultados ya no se envían.</span>
          )}
        </div>
      }
      startActions={<SecondaryButton onClick={onLeave}>🚪 Salir de la clase</SecondaryButton>}
    />
  )
}

export default ClassroomScreen
