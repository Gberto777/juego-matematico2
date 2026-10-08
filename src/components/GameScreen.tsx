import { useRef, useState, type FormEvent } from 'react'
import type { AnswerResult } from '../utils/gameLogic'
import type { Equation, Level } from '../utils/mathUtils'
import StatsBar from './StatsBar'

interface GameScreenProps {
  equation: Equation
  level: Level
  score: number
  lives: number
  correctInLevel: number
  lastResult: AnswerResult | null
  wasRestored: boolean
  onSubmit: (answer: string) => void
}

/** Signos tipográficos para que la ecuación se lea mejor en grande. */
const DISPLAY_OPERATOR: Record<Equation['operator'], string> = {
  '+': '+',
  '-': '−',
  '×': '×',
}

function formatEquation({ left, operator, right }: Equation): string {
  return `${left} ${DISPLAY_OPERATOR[operator]} ${right}`
}

interface FeedbackProps {
  result: AnswerResult | null
  /** Ecuación a la que se respondió (la pantalla ya muestra la siguiente). */
  answered: Equation | null
  level: Level
  wasRestored: boolean
}

function Feedback({ result, answered, level, wasRestored }: FeedbackProps) {
  if (!result) {
    return wasRestored ? (
      <p className="animate-pop rounded-full bg-white/15 px-5 py-2 text-lg font-semibold text-white ring-1 ring-white/20">
        💾 ¡Partida recuperada! Sigue donde lo dejaste
      </p>
    ) : (
      <p className="text-lg text-indigo-100">Escribe tu respuesta y pulsa Enter ⏎</p>
    )
  }

  switch (result.kind) {
    case 'correct':
      return (
        <p className="animate-pop text-2xl font-bold text-emerald-300 sm:text-3xl">
          {result.leveledUp ? `🚀 ¡Subiste al nivel ${level}!` : '✅ ¡Correcto!'}{' '}
          <span className="text-amber-300">+{result.pointsEarned}</span>
        </p>
      )
    case 'incorrect':
      return (
        <p className="animate-shake text-2xl font-bold text-rose-300 sm:text-3xl">
          ❌ ¡Uy! {answered && `${formatEquation(answered)} = `}
          <span className="text-white">{result.expected}</span>
        </p>
      )
    case 'invalid':
      return <p className="animate-pop text-xl font-semibold text-amber-200">✏️ Escribe un número entero</p>
  }
}

function GameScreen({
  equation,
  level,
  score,
  lives,
  correctInLevel,
  lastResult,
  wasRestored,
  onSubmit,
}: GameScreenProps) {
  const [answer, setAnswer] = useState('')
  // Contador de envíos: sirve como key para relanzar las animaciones aunque el resultado se repita.
  const [submissions, setSubmissions] = useState(0)
  const [answered, setAnswered] = useState<Equation | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setAnswered(equation)
    onSubmit(answer)
    setSubmissions((n) => n + 1)
    setAnswer('')
    inputRef.current?.focus()
  }

  const isWrong = submissions > 0 && lastResult?.kind === 'incorrect'
  const isRight = submissions > 0 && lastResult?.kind === 'correct'

  return (
    <section className="flex w-full max-w-2xl flex-col items-center gap-8">
      <StatsBar level={level} score={score} lives={lives} correctInLevel={correctInLevel} />

      <div
        key={submissions}
        className={`w-full rounded-[2rem] bg-white px-6 py-10 text-center shadow-[0_10px_0_0_rgba(0,0,0,0.15)] ring-8 transition-colors sm:py-14 ${
          isWrong ? 'animate-shake ring-rose-400' : isRight ? 'animate-pop ring-emerald-400' : 'ring-white/30'
        }`}
      >
        <p
          className="text-6xl font-bold tracking-wide text-indigo-900 tabular-nums sm:text-8xl"
          aria-live="polite"
          aria-label={`¿Cuánto es ${equation.text}?`}
        >
          {equation.left} <span className="text-pink-500">{DISPLAY_OPERATOR[equation.operator]}</span> {equation.right}{' '}
          <span className="text-indigo-300">= ?</span>
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex w-full max-w-md flex-col items-center gap-4 sm:flex-row">
        <label htmlFor="answer" className="sr-only">
          Tu respuesta
        </label>
        <input
          id="answer"
          ref={inputRef}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          autoFocus
          maxLength={4}
          placeholder="?"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          className="w-full flex-1 rounded-full border-4 border-white/40 bg-white/95 px-6 py-4 text-center text-4xl font-bold text-indigo-900 shadow-inner outline-none placeholder:text-indigo-200 focus:border-amber-300 focus:ring-4 focus:ring-amber-300/40"
        />
        <button
          type="submit"
          className="w-full rounded-full bg-emerald-400 px-8 py-4 text-2xl font-bold text-emerald-950 shadow-[0_6px_0_0_var(--color-emerald-600)] transition-all hover:bg-emerald-300 focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-white active:translate-y-1.5 active:shadow-none sm:w-auto"
        >
          Responder
        </button>
      </form>

      <div className="flex min-h-12 items-center justify-center text-center" role="status">
        <Feedback
          key={submissions}
          result={submissions > 0 ? lastResult : null}
          answered={answered}
          level={level}
          wasRestored={wasRestored}
        />
      </div>
    </section>
  )
}

export default GameScreen
