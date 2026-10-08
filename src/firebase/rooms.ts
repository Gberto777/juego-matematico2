import {
  Timestamp,
  collection,
  doc,
  getDoc,
  increment,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type DocumentData,
  type DocumentSnapshot,
  type Firestore,
  type Unsubscribe,
} from 'firebase/firestore'
import { generateRoomCode, type Player, type PlayerStatus, type Room, type RoomStatus } from '../utils/room'

/*
 * Modelo de datos del modo aula:
 *
 *   rooms/{code}                 Sala creada por un profesor. El id del documento ES el código.
 *     name, teacherId, status ('open' | 'closed'), createdAt
 *   rooms/{code}/players/{uid}   Un documento por alumno, escrito solo por ese alumno.
 *     name, status, métricas de la partida actual y acumulados (ver Player en utils/room.ts)
 *
 * El profesor escucha `players` con onSnapshot para ver los resultados en tiempo real.
 * Las reglas de seguridad están en firestore.rules.
 */

const MAX_CODE_ATTEMPTS = 5

const roomRef = (db: Firestore, code: string) => doc(db, 'rooms', code)
const playersRef = (db: Firestore, code: string) => collection(db, 'rooms', code, 'players')
const playerRef = (db: Firestore, code: string, uid: string) => doc(db, 'rooms', code, 'players', uid)

const toDate = (value: unknown): Date | null => (value instanceof Timestamp ? value.toDate() : null)
const toNumber = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) ? value : 0)

// 'estimate': con la caché local, un serverTimestamp recién escrito aún no tiene valor del servidor.
function toRoom(snap: DocumentSnapshot<DocumentData>): Room | null {
  const data = snap.data({ serverTimestamps: 'estimate' })
  if (!data) return null
  return {
    code: snap.id,
    name: String(data.name ?? ''),
    teacherId: String(data.teacherId ?? ''),
    status: data.status === 'closed' ? 'closed' : 'open',
    createdAt: toDate(data.createdAt),
  }
}

function toPlayer(snap: DocumentSnapshot<DocumentData>): Player | null {
  const data = snap.data({ serverTimestamps: 'estimate' })
  if (!data) return null
  const status: PlayerStatus = data.status === 'playing' || data.status === 'finished' ? data.status : 'waiting'
  return {
    id: snap.id,
    name: String(data.name ?? 'Sin nombre'),
    status,
    score: toNumber(data.score),
    level: toNumber(data.level),
    lives: toNumber(data.lives),
    totalCorrect: toNumber(data.totalCorrect),
    totalAnswered: toNumber(data.totalAnswered),
    gamesPlayed: toNumber(data.gamesPlayed),
    bestScore: toNumber(data.bestScore),
    bestLevel: toNumber(data.bestLevel),
    correctAllGames: toNumber(data.correctAllGames),
    answeredAllGames: toNumber(data.answeredAllGames),
    joinedAt: toDate(data.joinedAt),
    updatedAt: toDate(data.updatedAt),
  }
}

// --- Profesor ---

/** Crea una sala con un código libre. La transacción evita pisar una sala existente. */
export async function createRoom(db: Firestore, teacherId: string, name: string): Promise<string> {
  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
    const code = generateRoomCode()
    const created = await runTransaction(db, async (tx) => {
      const ref = roomRef(db, code)
      if ((await tx.get(ref)).exists()) return false
      tx.set(ref, { name, teacherId, status: 'open', createdAt: serverTimestamp() })
      return true
    })
    if (created) return code
  }
  throw new Error('No se pudo generar un código de sala libre. Inténtalo de nuevo.')
}

export function setRoomStatus(db: Firestore, code: string, status: RoomStatus): Promise<void> {
  return updateDoc(roomRef(db, code), { status })
}

export function subscribeToTeacherRooms(
  db: Firestore,
  teacherId: string,
  onChange: (rooms: Room[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  // Sin orderBy en la consulta para no necesitar un índice compuesto; se ordena en el cliente.
  return onSnapshot(
    query(collection(db, 'rooms'), where('teacherId', '==', teacherId)),
    (snap) => {
      const rooms = snap.docs.map(toRoom).filter((r): r is Room => r !== null)
      rooms.sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0))
      onChange(rooms)
    },
    onError,
  )
}

export function subscribeToPlayers(
  db: Firestore,
  code: string,
  onChange: (players: Player[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    playersRef(db, code),
    (snap) => onChange(snap.docs.map(toPlayer).filter((p): p is Player => p !== null)),
    onError,
  )
}

// --- Profesor y alumno ---

export async function getRoom(db: Firestore, code: string): Promise<Room | null> {
  return toRoom(await getDoc(roomRef(db, code)))
}

export function subscribeToRoom(
  db: Firestore,
  code: string,
  onChange: (room: Room | null) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(roomRef(db, code), (snap) => onChange(toRoom(snap)), onError)
}

// --- Alumno ---

export class JoinRoomError extends Error {
  readonly reason: 'not-found' | 'closed'

  constructor(reason: 'not-found' | 'closed') {
    super(reason === 'not-found' ? 'No existe ninguna sala con ese código.' : 'La sala está cerrada.')
    this.reason = reason
  }
}

export async function getPlayer(db: Firestore, code: string, uid: string): Promise<Player | null> {
  return toPlayer(await getDoc(playerRef(db, code, uid)))
}

/** Nombre con el que el alumno entró en su última sala (para no tener que escribirlo cada vez). */
export async function getLastStudentName(db: Firestore, uid: string): Promise<string | null> {
  const name: unknown = (await getDoc(doc(db, 'users', uid))).get('studentName')
  return typeof name === 'string' ? name : null
}

/** Une al alumno a la sala. Si ya estaba (p. ej. otro día), conserva sus acumulados. */
export async function joinRoom(db: Firestore, code: string, uid: string, name: string): Promise<void> {
  const room = await getRoom(db, code)
  if (!room) throw new JoinRoomError('not-found')
  if (room.status !== 'open') throw new JoinRoomError('closed')

  // No se espera: es solo una comodidad y no debe bloquear la entrada.
  setDoc(doc(db, 'users', uid), { studentName: name }, { merge: true }).catch(() => {})

  const ref = playerRef(db, code, uid)
  if ((await getDoc(ref)).exists()) {
    await updateDoc(ref, { name, updatedAt: serverTimestamp() })
    return
  }
  await setDoc(ref, {
    name,
    status: 'waiting',
    score: 0,
    level: 1,
    lives: 0,
    totalCorrect: 0,
    totalAnswered: 0,
    gamesPlayed: 0,
    bestScore: 0,
    bestLevel: 0,
    correctAllGames: 0,
    answeredAllGames: 0,
    joinedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export interface ProgressReport {
  status: PlayerStatus
  score: number
  level: number
  lives: number
  totalCorrect: number
  totalAnswered: number
}

/**
 * Envía el estado de la partida actual. Si `finished` es true, además suma la partida
 * a los acumulados; `best` son los mejores valores ya calculados por el cliente.
 */
export function reportProgress(
  db: Firestore,
  code: string,
  uid: string,
  progress: ProgressReport,
  finished?: { bestScore: number; bestLevel: number },
): Promise<void> {
  return updateDoc(playerRef(db, code, uid), {
    ...progress,
    ...(finished && {
      ...finished,
      gamesPlayed: increment(1),
      correctAllGames: increment(progress.totalCorrect),
      answeredAllGames: increment(progress.totalAnswered),
    }),
    updatedAt: serverTimestamp(),
  })
}
