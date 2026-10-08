import type { GameRecords } from '../utils/gameLogic'
import GameButton from './GameButton'

interface StartScreenProps {
  records: GameRecords
  onStart: () => void
}

const LEVELS = [
  { icon: '➕', label: 'Sumas' },
  { icon: '➖', label: 'Restas' },
  { icon: '✖️', label: 'Multiplicar' },
  { icon: '🔀', label: 'Mixtas' },
]

function RecordsPanel({ records }: { records: GameRecords }) {
  const hasPlayed = records.maxLevel > 0

  return (
    <div className="w-full max-w-md rounded-3xl bg-indigo-950/30 p-4 ring-1 ring-white/20 backdrop-blur">
      <h2 className="mb-3 text-sm font-semibold tracking-widest text-amber-200 uppercase">Tus récords</h2>
      {hasPlayed ? (
        <dl className="grid grid-cols-2 gap-3">
          <div className="flex flex-col justify-between rounded-2xl bg-white px-3 py-3 shadow-[0_5px_0_0_rgba(0,0,0,0.15)]">
            <dt className="text-xs font-semibold tracking-wide text-indigo-400 uppercase">🏆 Puntuación máxima</dt>
            <dd className="text-4xl font-bold text-indigo-900 tabular-nums">{records.highScore}</dd>
          </div>
          <div className="flex flex-col justify-between rounded-2xl bg-white px-3 py-3 shadow-[0_5px_0_0_rgba(0,0,0,0.15)]">
            <dt className="text-xs font-semibold tracking-wide text-indigo-400 uppercase">⭐ Nivel máximo</dt>
            <dd className="text-4xl font-bold text-indigo-900 tabular-nums">
              {records.maxLevel}
              <span className="text-xl text-indigo-300">/{LEVELS.length}</span>
            </dd>
          </div>
        </dl>
      ) : (
        <p className="py-2 text-indigo-100">Aún no tienes récords. ¡Juega tu primera partida! 🎯</p>
      )}
    </div>
  )
}

function StartScreen({ records, onStart }: StartScreenProps) {
  return (
    <section className="flex flex-col items-center gap-6 text-center sm:gap-8">
      <div className="animate-float text-6xl sm:text-8xl" aria-hidden="true">
        🧮
      </div>

      <div className="space-y-3">
        <h1 className="text-5xl font-bold tracking-tight text-white drop-shadow-[0_4px_0_rgba(0,0,0,0.25)] sm:text-7xl">
          Juego <span className="text-amber-300">Matemático</span>
        </h1>
        <p className="text-lg text-indigo-100 sm:text-xl">¡Resuelve operaciones, sube de nivel y no pierdas tus vidas!</p>
      </div>

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {LEVELS.map(({ icon, label }, i) => (
          <li
            key={label}
            className="flex flex-col items-center gap-1 rounded-2xl bg-white/15 px-4 py-3 text-indigo-50 ring-1 ring-white/20 backdrop-blur"
          >
            <span className="text-2xl" aria-hidden="true">
              {icon}
            </span>
            <span className="text-sm font-semibold">
              Nivel {i + 1}: {label}
            </span>
          </li>
        ))}
      </ul>

      <RecordsPanel records={records} />

      <GameButton onClick={onStart} autoFocus>
        ▶ Comenzar Juego
      </GameButton>
    </section>
  )
}

export default StartScreen
