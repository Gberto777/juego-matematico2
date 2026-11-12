import { useEffect, useState, type ReactNode } from 'react'
import { getFirebase } from '../firebase/app'
import { setRoomStatus } from '../firebase/rooms'
import { useRoom, useRoomPlayers } from '../hooks/useRoomData'
import { INITIAL_LIVES } from '../utils/gameLogic'
import { accuracy, isPlayerActive, playerTotals, rankPlayers, type Player, type Room } from '../utils/room'
import { routeToHash } from '../utils/routes'
import SecondaryButton from './SecondaryButton'
import StatusMessage from './StatusMessage'

interface TeacherDashboardProps {
  code: string
  uid: string
  onBack: () => void
}

/** Cada cuánto se recalcula "hace X" y quién sigue conectado. */
const CLOCK_TICK_MS = 15_000

const relativeTime = new Intl.RelativeTimeFormat('es', { numeric: 'auto' })

function timeAgo(date: Date | null, now: number): string {
  if (!date) return '—'
  const seconds = Math.round((date.getTime() - now) / 1000)
  if (seconds > -60) return 'ahora'
  if (seconds > -3600) return relativeTime.format(Math.round(seconds / 60), 'minute')
  if (seconds > -86400) return relativeTime.format(Math.round(seconds / 3600), 'hour')
  return relativeTime.format(Math.round(seconds / 86400), 'day')
}

function useNow(): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), CLOCK_TICK_MS)
    return () => clearInterval(id)
  }, [])
  return now
}

function TeacherDashboard({ code, uid, onBack }: TeacherDashboardProps) {
  const room = useRoom(code)

  if (room.status === 'loading') return <StatusMessage icon="⏳" title="Cargando sala…" />
  if (room.status === 'error' || !room.data || room.data.teacherId !== uid) {
    return (
      <StatusMessage icon="🔒" title="No puedes ver esta sala">
        <p>No existe o la creó otro profesor (o se creó en otro navegador).</p>
        <SecondaryButton onClick={onBack}>⬅ Mis salas</SecondaryButton>
      </StatusMessage>
    )
  }
  return <Dashboard room={room.data} onBack={onBack} />
}

function Dashboard({ room, onBack }: { room: Room; onBack: () => void }) {
  const players = useRoomPlayers(room.code)
  const now = useNow()
  const [copied, setCopied] = useState(false)
  const [isToggling, setIsToggling] = useState(false)

  const joinUrl = `${window.location.origin}${window.location.pathname}${routeToHash({ name: 'join', code: room.code })}`
  const isOpen = room.status === 'open'

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(joinUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Sin permiso de portapapeles: el enlace sigue visible para copiarlo a mano.
    }
  }

  const toggleRoom = async () => {
    setIsToggling(true)
    try {
      await setRoomStatus(getFirebase().db, room.code, isOpen ? 'closed' : 'open')
    } catch (e) {
      console.error(e)
    } finally {
      setIsToggling(false)
    }
  }

  return (
    <section className="flex w-full max-w-6xl flex-col gap-6">
      <header className="flex flex-col gap-4 rounded-[2rem] bg-white p-6 shadow-[0_10px_0_0_rgba(0,0,0,0.15)] lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold tracking-widest text-indigo-400 uppercase">Panel del profesor</p>
          <h1 className="truncate text-3xl font-bold text-indigo-900">{room.name}</h1>
          <p className="mt-1 text-indigo-600">
            Los alumnos entran en <strong className="break-all">{joinUrl.replace(/^https?:\/\//, '')}</strong> o pulsan
            «Unirme a una clase» y escriben el código.
          </p>
        </div>
        <div className="flex flex-col items-center gap-2">
          <p className="text-xs font-semibold tracking-widest text-indigo-400 uppercase">Código de la sala</p>
          <p
            className={`rounded-2xl px-5 py-2 font-mono text-5xl font-bold tracking-[0.2em] tabular-nums sm:text-6xl ${
              isOpen ? 'bg-amber-100 text-indigo-900' : 'bg-slate-100 text-slate-400 line-through'
            }`}
            aria-label={`Código ${[...room.code].join(' ')}`}
          >
            {room.code}
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={copyLink}
              className="rounded-full bg-indigo-100 px-4 py-1.5 text-sm font-bold text-indigo-700 hover:bg-indigo-200"
            >
              {copied ? '✅ ¡Copiado!' : '🔗 Copiar enlace'}
            </button>
            <button
              type="button"
              onClick={toggleRoom}
              disabled={isToggling}
              className={`rounded-full px-4 py-1.5 text-sm font-bold disabled:opacity-50 ${
                isOpen ? 'bg-rose-100 text-rose-700 hover:bg-rose-200' : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
              }`}
            >
              {isOpen ? '🔒 Cerrar sala' : '🔓 Reabrir sala'}
            </button>
          </div>
        </div>
      </header>

      {players.status === 'loading' && <StatusMessage icon="⏳" title="Conectando…" />}
      {players.status === 'error' && (
        <StatusMessage icon="📡" title="No se pudieron cargar los resultados">
          <p>Revisa la conexión; los datos aparecerán en cuanto vuelva.</p>
        </StatusMessage>
      )}
      {players.status === 'ready' && <Results players={players.data} now={now} />}

      <div className="flex justify-center">
        <SecondaryButton onClick={onBack}>⬅ Mis salas</SecondaryButton>
      </div>
    </section>
  )
}

function SummaryTile({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col justify-between rounded-2xl bg-white px-4 py-3 shadow-[0_5px_0_0_rgba(0,0,0,0.15)]">
      <dt className="text-xs font-semibold tracking-wide text-indigo-400 uppercase">{label}</dt>
      <dd className="text-4xl font-bold text-indigo-900 tabular-nums">{children}</dd>
    </div>
  )
}

const STATUS_LABEL: Record<Player['status'], { text: string; className: string }> = {
  playing: { text: '🎮 Jugando', className: 'bg-emerald-100 text-emerald-700' },
  finished: { text: '🏁 Terminó', className: 'bg-amber-100 text-amber-800' },
  waiting: { text: '⏸️ En espera', className: 'bg-slate-100 text-slate-600' },
}

function Results({ players, now }: { players: Player[]; now: number }) {
  if (players.length === 0) {
    return (
      <StatusMessage icon="👀" title="Esperando alumnos…">
        <p>En cuanto alguien entre con el código aparecerá aquí.</p>
      </StatusMessage>
    )
  }

  const ranked = rankPlayers(players)
  const playingNow = players.filter((p) => p.status === 'playing' && isPlayerActive(p, now)).length
  const totals = players.map(playerTotals).reduce(
    (acc, t) => ({ correct: acc.correct + t.correct, answered: acc.answered + t.answered }),
    { correct: 0, answered: 0 },
  )
  const classAccuracy = accuracy(totals.correct, totals.answered)
  const topScore = Math.max(...players.map((p) => Math.max(p.bestScore, p.score)))

  return (
    <>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryTile label="👥 Alumnos">{players.length}</SummaryTile>
        <SummaryTile label="🎮 Jugando ahora">{playingNow}</SummaryTile>
        <SummaryTile label="🎯 Aciertos de la clase">{classAccuracy === null ? '—' : `${classAccuracy}%`}</SummaryTile>
        <SummaryTile label="🏆 Mejor puntuación">{topScore}</SummaryTile>
      </dl>

      <div className="overflow-x-auto rounded-[2rem] bg-white shadow-[0_10px_0_0_rgba(0,0,0,0.15)]">
        <table className="w-full min-w-[720px] text-left text-indigo-900">
          <caption className="sr-only">Resultados de los alumnos, actualizados en tiempo real</caption>
          <thead className="text-xs font-semibold tracking-wide text-indigo-400 uppercase">
            <tr className="border-b border-indigo-100">
              <th scope="col" className="px-4 py-3">#</th>
              <th scope="col" className="px-4 py-3">Alumno</th>
              <th scope="col" className="px-4 py-3">Estado</th>
              <th scope="col" className="px-4 py-3 text-right">Puntos</th>
              <th scope="col" className="px-4 py-3 text-right">Nivel</th>
              <th scope="col" className="px-4 py-3">Vidas</th>
              <th scope="col" className="px-4 py-3 text-right">Aciertos</th>
              <th scope="col" className="px-4 py-3 text-right">Mejor</th>
              <th scope="col" className="px-4 py-3 text-right">Partidas</th>
              <th scope="col" className="px-4 py-3">Actividad</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((player, i) => {
              const active = isPlayerActive(player, now)
              const { correct, answered } = playerTotals(player)
              const pct = accuracy(correct, answered)
              const status = STATUS_LABEL[player.status]
              const hasGame = player.status !== 'waiting'
              return (
                <tr key={player.id} className="border-b border-indigo-50 last:border-0 odd:bg-indigo-50/40">
                  <td className="px-4 py-3 font-bold text-indigo-400 tabular-nums">{i + 1}</td>
                  <td className="max-w-48 truncate px-4 py-3 font-bold">
                    <span
                      className={`mr-2 inline-block h-2.5 w-2.5 rounded-full ${active ? 'bg-emerald-500' : 'bg-slate-300'}`}
                      title={active ? 'Conectado' : 'Desconectado'}
                      aria-label={active ? 'Conectado' : 'Desconectado'}
                    />
                    {player.name}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-bold whitespace-nowrap ${status.className}`}>
                      {status.text}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-xl font-bold tabular-nums">{hasGame ? player.score : '—'}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{hasGame ? player.level : '—'}</td>
                  <td className="px-4 py-3 whitespace-nowrap" aria-label={hasGame ? `${player.lives} vidas` : 'Sin partida'}>
                    {player.status === 'playing'
                      ? Array.from({ length: INITIAL_LIVES }, (_, n) => (
                          <span key={n} className={n < player.lives ? '' : 'opacity-25 grayscale'}>
                            ❤️
                          </span>
                        ))
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {pct === null ? '—' : (
                      <>
                        <strong>{pct}%</strong> <span className="text-sm text-indigo-400">({correct}/{answered})</span>
                      </>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-bold tabular-nums">{Math.max(player.bestScore, player.score)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{player.gamesPlayed}</td>
                  <td className="px-4 py-3 text-sm whitespace-nowrap text-indigo-500">{timeAgo(player.updatedAt, now)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}

export default TeacherDashboard
