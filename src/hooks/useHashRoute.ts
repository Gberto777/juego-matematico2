import { useCallback, useEffect, useState } from 'react'
import { parseRoute, routeToHash, type Route } from '../utils/routes'

export function useHashRoute(): [Route, (route: Route) => void] {
  const [route, setRoute] = useState(() => parseRoute(window.location.hash))

  useEffect(() => {
    const onChange = () => setRoute(parseRoute(window.location.hash))
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])

  const navigate = useCallback((next: Route) => {
    window.location.hash = routeToHash(next)
  }, [])

  return [route, navigate]
}
