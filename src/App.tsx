import GameOverScreen from './components/GameOverScreen'
import GameScreen from './components/GameScreen'
import StartScreen from './components/StartScreen'
import { useGameLogic } from './hooks/useGameLogic'

type Screen = 'start' | 'game' | 'game-over'

function App() {
  const game = useGameLogic()

  const screen: Screen = !game.isActive ? 'start' : game.isGameOver ? 'game-over' : 'game'

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-linear-to-br from-indigo-500 via-purple-500 to-pink-400 px-4 py-10 font-game">
      {/* Decoración de fondo */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 select-none">
        <span className="absolute top-[8%] left-[6%] text-7xl font-bold text-white/10">+</span>
        <span className="absolute top-[18%] right-[10%] text-8xl font-bold text-white/10">×</span>
        <span className="absolute bottom-[12%] left-[12%] text-8xl font-bold text-white/10">−</span>
        <span className="absolute right-[8%] bottom-[20%] text-7xl font-bold text-white/10">÷</span>
        <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-amber-300/20 blur-3xl" />
        <div className="absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-cyan-300/20 blur-3xl" />
      </div>

      <div className="relative z-10 flex w-full justify-center">
        {screen === 'start' && <StartScreen records={game.records} onStart={() => game.startGame()} />}

        {screen === 'game' && (
          <GameScreen
            equation={game.equation}
            level={game.level}
            score={game.score}
            lives={game.lives}
            correctInLevel={game.correctInLevel}
            lastResult={game.lastResult}
            wasRestored={game.wasRestored}
            onSubmit={game.submitAnswer}
          />
        )}

        {screen === 'game-over' && (
          <GameOverScreen
            score={game.score}
            level={game.level}
            totalCorrect={game.totalCorrect}
            totalAnswered={game.totalAnswered}
            highScore={game.records.highScore}
            isNewHighScore={game.isNewHighScore}
            onRetry={() => game.startGame()}
            onMenu={game.goToMenu}
          />
        )}
      </div>
    </main>
  )
}

export default App
