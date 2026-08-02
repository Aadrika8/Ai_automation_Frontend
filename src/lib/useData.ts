import { useEffect, useState } from 'react'

interface DataState<T> {
  data: T | null
  loading: boolean
  error: string | null
}

/** Minimal fetch-on-mount hook for the mock API. */
export function useData<T>(fetcher: () => Promise<T>, deps: readonly unknown[]): DataState<T> {
  const [state, setState] = useState<DataState<T>>({ data: null, loading: true, error: null })

  useEffect(() => {
    let alive = true
    setState(s => ({ ...s, loading: true, error: null }))
    fetcher().then(
      data => alive && setState({ data, loading: false, error: null }),
      (err: Error) => alive && setState({ data: null, loading: false, error: err.message }),
    )
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return state
}
