import { useMemo } from 'react'
import { getFirebase } from '../firebase/app'
import { createFirestoreRepository } from '../firebase/gameRepository'
import { useGameLogic } from '../hooks/useGameLogic'
import GameView from './GameView'
import SecondaryButton from './SecondaryButton'

interface SoloGameProps {
  /** Usuario de Firebase; null si no hay Firebase y se juega sin guardar. */
  uid: string | null
  onJoinClass: () => void
  onTeacher: () => void
}

function SoloGame({ uid, onJoinClass, onTeacher }: SoloGameProps) {
  const repository = useMemo(() => (uid ? createFirestoreRepository(getFirebase().db, uid, 'solo') : null), [uid])
  const game = useGameLogic({ repository })

  return (
    <GameView
      game={game}
      startActions={
        <div className="flex flex-wrap justify-center gap-3">
          <SecondaryButton onClick={onJoinClass}>🎒 Unirme a una clase</SecondaryButton>
          <SecondaryButton onClick={onTeacher}>👩‍🏫 Soy profesor</SecondaryButton>
        </div>
      }
    />
  )
}

export default SoloGame
