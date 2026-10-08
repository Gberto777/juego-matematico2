import type { Level } from '../utils/mathUtils'
import GameButton from './GameButton'

interface GameOverScreenProps {
  score: number
  level: Level
  totalCorrect: number
  totalAnswered: number
  highScore: number
  isNewHighScore: boolean
  onRetry: () => void
  onMenu: () => void
}

function GameOverScreen({
  score,
  level,
  totalCorrect,
  totalAnswered,
  highScore,
  isNewHighScore,
  onRetry,
  onMenu,
}: GameOverScreenProps) {
  return (
    <section className="flex animate-pop flex-col items-center gap-8 text-center">
      <div className="text-7xl sm:text-8xl" aria-hidden="true">
        💥
      </div>

      <h1 className="text-5xl font-bold text-white drop-shadow-[0_4px_0_rgba(0,0,0,0.25)] sm:text-6xl">
        ¡Juego Terminado!
      </h1>

      <div className="relative w-full max-w-sm rounded-[2rem] bg-white px-8 py-6 shadow-[0_10px_0_0_rgba(0,0,0,0.15)]">
        {isNewHighScore && (
          <span className="absolute -top-4 left-1/2 -translate-x-1/2 animate-pop rounded-full bg-amber-400 px-4 py-1 text-sm font-bold whitespace-nowrap text-amber-950 shadow-[0_4px_0_0_var(--color-amber-600)]">
            🏆 ¡Nuevo récord!
          </span>
        )}
        <p className="text-sm font-semibold tracking-widest text-indigo-400 uppercase">Puntuación final</p>
        <p className="text-7xl font-bold text-indigo-900 tabular-nums">{score}</p>
        <div className="mt-4 flex flex-wrap justify-center gap-x-6 gap-y-1 text-indigo-700">
          <span>
            Nivel <strong>{level}</strong>
          </span>
          <span>
            Aciertos{' '}
            <strong>
              {totalCorrect}/{totalAnswered}
            </strong>
          </span>
          <span>
            Récord <strong>{highScore}</strong>
          </span>
        </div>
      </div>

      <div className="flex flex-col items-center gap-4">
        <GameButton onClick={onRetry} autoFocus>
          🔄 Volver a intentar
        </GameButton>
        <button
          type="button"
          onClick={onMenu}
          className="rounded-full px-6 py-2 text-lg font-semibold text-white/90 ring-2 ring-white/40 transition-colors hover:bg-white/15 focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-white"
        >
          🏠 Ir al inicio
        </button>
      </div>
    </section>
  )
}

export default GameOverScreen
