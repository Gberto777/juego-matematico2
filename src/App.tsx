import { useCallback, useMemo, type ReactNode } from 'react'
import { AuthProvider } from './auth/AuthProvider'
import ClassroomScreen from './components/ClassroomScreen'
import BotonCuenta from './components/cuenta/BotonCuenta'
import PantallaCuenta from './components/cuenta/PantallaCuenta'
import PantallaEntrar from './components/cuenta/PantallaEntrar'
import PantallaRecuperar from './components/cuenta/PantallaRecuperar'
import PantallaRegistro from './components/cuenta/PantallaRegistro'
import PantallaRestablecer, { EnlaceRecuperacionInvalido } from './components/cuenta/PantallaRestablecer'
import { PanelAdmin, PanelDocente } from './components/cuenta/Paneles'
import RequiereAcceso from './components/cuenta/RequiereAcceso'
import JoinRoomScreen from './components/JoinRoomScreen'
import SecondaryButton from './components/SecondaryButton'
import SoloGame from './components/SoloGame'
import StatusMessage from './components/StatusMessage'
import TeacherDashboard from './components/TeacherDashboard'
import TeacherHomeScreen from './components/TeacherHomeScreen'
import { useFirebaseUser, type FirebaseUserState } from './hooks/useFirebaseUser'
import { useHashRoute } from './hooks/useHashRoute'
import { obtenerServicioAuth, type ServicioAuth } from './supabase/servicioAuth'
import { requisitoDe } from './utils/acceso'
import type { Route } from './utils/routes'

type Navigate = (route: Route) => void

/** Las pantallas de aula necesitan Firebase y un usuario; aquí se resuelven los demás casos. */
function RequireUser({ user, onBack, children }: { user: FirebaseUserState; onBack: () => void; children: (uid: string) => ReactNode }) {
  switch (user.status) {
    case 'ready':
      return children(user.uid)
    case 'loading':
      return <StatusMessage icon="⏳" title="Conectando…" />
    case 'disabled':
      return (
        <StatusMessage icon="🔌" title="Modo aula no disponible">
          <p>Falta configurar Firebase (copia .env.example a .env.local y rellena los datos del proyecto).</p>
          <SecondaryButton onClick={onBack}>⬅ Volver al juego</SecondaryButton>
        </StatusMessage>
      )
    case 'error':
      return (
        <StatusMessage icon="📡" title="No se pudo conectar">
          <p>Comprueba la conexión a internet y recarga la página.</p>
          <SecondaryButton onClick={onBack}>⬅ Volver al juego</SecondaryButton>
        </StatusMessage>
      )
  }
}

/** Pantallas de cuentas (Supabase), protegidas según la sesión y el rol. */
function AccountScreen({ route }: { route: Route }) {
  const requisito = requisitoDe(route)
  switch (route.name) {
    case 'login':
      return <RequiereAcceso requisito={requisito}>{() => <PantallaEntrar />}</RequiereAcceso>
    case 'register':
      return <RequiereAcceso requisito={requisito}>{() => <PantallaRegistro />}</RequiereAcceso>
    case 'forgotPassword':
      return <RequiereAcceso requisito={requisito}>{() => <PantallaRecuperar />}</RequiereAcceso>
    case 'resetPassword':
      return (
        <RequiereAcceso requisito={requisito} sinSesion={<EnlaceRecuperacionInvalido />}>
          {() => <PantallaRestablecer />}
        </RequiereAcceso>
      )
    case 'account':
      return <RequiereAcceso requisito={requisito}>{(usuario) => usuario && <PantallaCuenta usuario={usuario} />}</RequiereAcceso>
    case 'admin':
      return <RequiereAcceso requisito={requisito}>{() => <PanelAdmin />}</RequiereAcceso>
    case 'teacherPanel':
      return <RequiereAcceso requisito={requisito}>{() => <PanelDocente />}</RequiereAcceso>
    default:
      return null
  }
}

const ACCOUNT_ROUTES = new Set<Route['name']>([
  'login',
  'register',
  'forgotPassword',
  'resetPassword',
  'account',
  'admin',
  'teacherPanel',
])

function Screen({ route, navigate, user }: { route: Route; navigate: Navigate; user: FirebaseUserState }) {
  const goSolo = useCallback(() => navigate({ name: 'solo' }), [navigate])
  const goJoin = useCallback(
    () => navigate({ name: 'join', code: 'code' in route ? route.code : '' }),
    [navigate, route],
  )

  if (ACCOUNT_ROUTES.has(route.name)) return <AccountScreen route={route} />

  if (route.name === 'solo') {
    // Se espera a la sesión para no empezar sin guardar y luego pisar la partida al cargar.
    if (user.status === 'loading') return <StatusMessage icon="⏳" title="Cargando…" />
    return (
      <SoloGame
        uid={user.status === 'ready' ? user.uid : null}
        onJoinClass={() => navigate({ name: 'join', code: '' })}
        onTeacher={() => navigate({ name: 'teacher' })}
      />
    )
  }

  return (
    <RequireUser user={user} onBack={goSolo}>
      {(uid) => {
        switch (route.name) {
          case 'join':
            return (
              <JoinRoomScreen
                uid={uid}
                initialCode={route.code}
                onJoined={(code) => navigate({ name: 'classroom', code })}
                onBack={goSolo}
              />
            )
          case 'classroom':
            return <ClassroomScreen key={route.code} code={route.code} uid={uid} onNotJoined={goJoin} onLeave={goSolo} />
          case 'teacher':
            return <TeacherHomeScreen uid={uid} onOpenRoom={(code) => navigate({ name: 'dashboard', code })} onBack={goSolo} />
          case 'dashboard':
            return <TeacherDashboard key={route.code} code={route.code} uid={uid} onBack={() => navigate({ name: 'teacher' })} />
        }
      }}
    </RequireUser>
  )
}

interface AppProps {
  /** Para los tests: servicio de cuentas falso. Por defecto, Supabase (o null si no está configurado). */
  servicioAuth?: ServicioAuth | null
}

function App({ servicioAuth }: AppProps) {
  const [route, navigate] = useHashRoute()
  const user = useFirebaseUser()
  const servicio = useMemo(() => (servicioAuth === undefined ? obtenerServicioAuth() : servicioAuth), [servicioAuth])
  const goResetPassword = useCallback(() => navigate({ name: 'resetPassword' }), [navigate])

  return (
    <AuthProvider servicio={servicio} alRecuperar={goResetPassword}>
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-linear-to-br from-indigo-500 via-purple-500 to-pink-400 px-4 pt-16 pb-10 font-game">
        {/* Decoración de fondo */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 select-none">
          <span className="absolute top-[8%] left-[6%] text-7xl font-bold text-white/10">+</span>
          <span className="absolute top-[18%] right-[10%] text-8xl font-bold text-white/10">×</span>
          <span className="absolute bottom-[12%] left-[12%] text-8xl font-bold text-white/10">−</span>
          <span className="absolute right-[8%] bottom-[20%] text-7xl font-bold text-white/10">÷</span>
          <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-amber-300/20 blur-3xl" />
          <div className="absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-cyan-300/20 blur-3xl" />
        </div>

        {!ACCOUNT_ROUTES.has(route.name) && (
          <div className="absolute top-3 right-3 z-20">
            <BotonCuenta />
          </div>
        )}

        <div className="relative z-10 flex w-full justify-center">
          <Screen route={route} navigate={navigate} user={user} />
        </div>
      </main>
    </AuthProvider>
  )
}

export default App
