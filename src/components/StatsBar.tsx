import type { ReactNode } from 'react'
import { CORRECT_ANSWERS_TO_LEVEL_UP, INITIAL_LIVES } from '../utils/gameLogic'
import { MAX_LEVEL, type Level } from '../utils/mathUtils'

interface StatsBarProps {
  level: Level
  score: number
  lives: number
  correctInLevel: number
}

function StatCard({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-2xl bg-white/15 px-3 py-2 ring-1 ring-white/20 backdrop-blur sm:px-5">
      <span className="text-xs font-semibold tracking-widest text-indigo-100 uppercase">{label}</span>
      <span className="text-2xl font-bold text-white sm:text-3xl">{children}</span>
    </div>
  )
}

function StatsBar({ level, score, lives, correctInLevel }: StatsBarProps) {
  const isMaxLevel = level === MAX_LEVEL
  const progress = isMaxLevel ? 100 : (correctInLevel / CORRECT_ANSWERS_TO_LEVEL_UP) * 100

  return (
    <header className="w-full space-y-3">
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <StatCard label="Nivel">{level}</StatCard>
        <StatCard label="Puntos">
          {/* key reinicia la animación cada vez que cambia la puntuación */}
          <span key={score} className="inline-block animate-pop">
            {score}
          </span>
        </StatCard>
        <StatCard label="Vidas">
          <span className="text-lg tracking-tight whitespace-nowrap sm:text-3xl" aria-label={`${lives} de ${INITIAL_LIVES} vidas`}>
            {Array.from({ length: INITIAL_LIVES }, (_, i) => (
              <span key={i} className={i < lives ? '' : 'opacity-30 grayscale'}>
                ❤️
              </span>
            ))}
          </span>
        </StatCard>
      </div>

      <div
        className="h-3 overflow-hidden rounded-full bg-white/20"
        role="progressbar"
        aria-label="Progreso hacia el siguiente nivel"
        aria-valuenow={Math.round(progress)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full bg-linear-to-r from-amber-300 to-emerald-400 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="text-center text-sm text-indigo-100">
        {isMaxLevel
          ? '¡Nivel máximo alcanzado! 🏆'
          : `${CORRECT_ANSWERS_TO_LEVEL_UP - correctInLevel} aciertos para el nivel ${level + 1}`}
      </p>
    </header>
  )
}

export default StatsBar
