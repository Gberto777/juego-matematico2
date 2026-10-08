import type { ReactNode } from 'react'
import type { UseGameLogicResult } from '../hooks/useGameLogic'
import GameOverScreen from './GameOverScreen'
import GameScreen from './GameScreen'
import StartScreen from './StartScreen'

interface GameViewProps {
  game: UseGameLogicResult
  /** Se muestra sobre el título de la pantalla de inicio. */
  startBanner?: ReactNode
  /** Acciones extra en la pantalla de inicio. */
  startActions?: ReactNode
}

/** Pantallas del juego (inicio, partida y fin), comunes al modo individual y al de aula. */
function GameView({ game, startBanner, startActions }: GameViewProps) {
  if (!game.isActive) {
    return (
      <StartScreen records={game.records} isLoading={game.isLoading} banner={startBanner} onStart={() => game.startGame()}>
        {startActions}
      </StartScreen>
    )
  }

  if (game.isGameOver) {
    return (
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
    )
  }

  return (
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
  )
}

export default GameView
