import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api, type ReleaseInfo } from '../api'
import { useData } from './useData'

export interface ReleaseState {
  releases: ReleaseInfo[] | null
  /** the release being viewed, resolved from ?release= or the current one */
  active: ReleaseInfo | null
  activeId: string
  loading: boolean
  error: string | null
  select: (releaseId: string) => void
}

/**
 * Which release the page is looking at.
 *
 * The release lives in the `release` query parameter, so every layer and data
 * URL is a deep link to one release's data, and switching release keeps the
 * rest of the query (the Dashboard/Data tab, for one) intact. Without the
 * parameter the app opens the release marked current — the one being tested
 * now — falling back to the newest.
 */
export function useReleases(appId: string, reloadKey = 0): ReleaseState {
  const [params, setParams] = useSearchParams()
  const { data: releases, loading, error } = useData(
    () => api.getReleases(appId), [appId, reloadKey])

  const requested = params.get('release')
  const active =
    releases?.find(r => r.id === requested)
    ?? releases?.find(r => r.current)
    ?? releases?.[0]
    ?? null

  const select = useCallback((releaseId: string) => {
    const next = new URLSearchParams(params)
    next.set('release', releaseId)
    setParams(next)
  }, [params, setParams])

  return { releases: releases ?? null, active, activeId: active?.id ?? '', loading, error, select }
}

/** Append the release to a path, so navigating away does not lose it. */
export function withRelease(path: string, releaseId: string): string {
  return releaseId ? `${path}?release=${encodeURIComponent(releaseId)}` : path
}
