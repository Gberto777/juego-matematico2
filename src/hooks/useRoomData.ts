import { useEffect, useState } from 'react'
import type { Unsubscribe } from 'firebase/firestore'
import { getFirebase } from '../firebase/app'
import { subscribeToPlayers, subscribeToRoom, subscribeToTeacherRooms } from '../firebase/rooms'
import type { Player, Room } from '../utils/room'

export type LiveData<T> = { status: 'loading' } | { status: 'ready'; data: T } | { status: 'error'; error: Error }

type Subscribe<T> = (key: string, onChange: (data: T) => void, onError: (error: Error) => void) => Unsubscribe

/** Suscripción en tiempo real a Firestore. `subscribe` debe ser estable (definida fuera del componente). */
function useSubscription<T>(key: string, subscribe: Subscribe<T>): LiveData<T> {
  const [state, setState] = useState<{ key: string; value: LiveData<T> }>({ key, value: { status: 'loading' } })

  useEffect(() => {
    return subscribe(
      key,
      (data) => setState({ key, value: { status: 'ready', data } }),
      (error) => {
        console.error(error)
        setState({ key, value: { status: 'error', error } })
      },
    )
  }, [key, subscribe])

  // Al cambiar de sala no se muestran los datos de la anterior.
  return state.key === key ? state.value : { status: 'loading' }
}

const roomSubscription: Subscribe<Room | null> = (code, onChange, onError) =>
  subscribeToRoom(getFirebase().db, code, onChange, onError)
const playersSubscription: Subscribe<Player[]> = (code, onChange, onError) =>
  subscribeToPlayers(getFirebase().db, code, onChange, onError)
const teacherRoomsSubscription: Subscribe<Room[]> = (uid, onChange, onError) =>
  subscribeToTeacherRooms(getFirebase().db, uid, onChange, onError)

export function useRoom(code: string): LiveData<Room | null> {
  return useSubscription(code, roomSubscription)
}

export function useRoomPlayers(code: string): LiveData<Player[]> {
  return useSubscription(code, playersSubscription)
}

export function useTeacherRooms(uid: string): LiveData<Room[]> {
  return useSubscription(uid, teacherRoomsSubscription)
}
