import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'
import { emptyLibrary, type Library } from './types'
import { isLibrary } from './validation'

interface Cache {
  data: Library
  revision: number
  dirty: boolean
}
export type SyncStatus = 'loading' | 'synced' | 'saving' | 'offline' | 'error' | 'conflict'
const keyFor = (id: string) => `studard:library:${id}:v1`
function readCache(key: string): Cache | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Cache
    if (
      isLibrary(parsed.data) &&
      Number.isInteger(parsed.revision) &&
      parsed.revision >= 0 &&
      typeof parsed.dirty === 'boolean'
    )
      return parsed
  } catch {
    /* The UI reports unavailable storage on the next write. */
  }
  return null
}
export function useLibrary(userId: string) {
  const cacheKey = keyFor(userId)
  const [initial] = useState(() => readCache(cacheKey))
  const [data, setData] = useState<Library>(() => initial?.data || emptyLibrary())
  const current = useRef(data)
  const revision = useRef(initial?.revision || 0)
  const dirty = useRef(initial?.dirty || false)
  const generation = useRef(0)
  const saving = useRef(false)
  const [ready, setReady] = useState(false)
  const [online, setOnline] = useState(navigator.onLine)
  const [status, setStatus] = useState<SyncStatus>('loading')
  const [message, setMessage] = useState('')
  const [tick, setTick] = useState(0)
  const [refresh, setRefresh] = useState(0)
  const [storageError, setStorageError] = useState(false)
  const conflict = useRef(false)
  const readFailed = useRef(false)

  const persist = useCallback(() => {
    // Preserve the shared cache if another tab has written a different version.
    if (conflict.current) return
    try {
      localStorage.setItem(
        cacheKey,
        JSON.stringify({ data: current.current, revision: revision.current, dirty: dirty.current }),
      )
      setStorageError(false)
    } catch {
      setStorageError(true)
    }
  }, [cacheKey])

  const update = useCallback(
    (change: Library | ((previous: Library) => Library)) => {
      const next = typeof change === 'function' ? change(current.current) : change
      current.current = next
      generation.current++
      dirty.current = true
      persist()
      setData(next)
    },
    [persist],
  )

  useEffect(() => {
    const connected = () => {
      setOnline(navigator.onLine)
      setTick((t) => t + 1)
    }
    const focused = () => {
      if (!dirty.current && !saving.current && !conflict.current) setRefresh((r) => r + 1)
    }
    window.addEventListener('focus', focused)
    window.addEventListener('online', connected)
    window.addEventListener('offline', connected)
    // A second tab must never silently overwrite this tab's edits.
    const changed = (event: StorageEvent) => {
      if (event.key === cacheKey) {
        conflict.current = true
        setStatus('conflict')
        setMessage('A biblioteca foi alterada em outra aba. Exporte uma cópia antes de recarregar.')
      }
    }
    window.addEventListener('storage', changed)
    return () => {
      window.removeEventListener('focus', focused)
      window.removeEventListener('online', connected)
      window.removeEventListener('offline', connected)
      window.removeEventListener('storage', changed)
    }
  }, [cacheKey])

  useEffect(() => {
    if (!supabase) return
    let cancelled = false
    const load = async () => {
      if (conflict.current) {
        setStatus('conflict')
        setReady(true)
        return
      }
      if (!navigator.onLine) {
        setStatus('offline')
        setReady(true)
        return
      }
      // Refresh in the background after the first load. Removing the page here can
      // swallow the click that brought focus back to the browser window.
      readFailed.current = false
      setStatus('loading')
      const generationAtRead = generation.current
      const revisionAtRead = revision.current
      const savingAtRead = saving.current
      const { data: remote, error } = await supabase!
        .from('study_libraries')
        .select('content, revision')
        .eq('user_id', userId)
        .maybeSingle()
      if (cancelled) return
      // An edit or save made while this request was in flight is newer than
      // its response. Preserve it and let the pending save finish normally.
      if (
        conflict.current ||
        savingAtRead ||
        saving.current ||
        generation.current !== generationAtRead ||
        revision.current !== revisionAtRead
      ) {
        setReady(true)
        return
      }
      if (error) {
        readFailed.current = true
        setStatus('error')
        setMessage(
          'Não foi possível carregar a nuvem. Confira sua conexão e a configuração do banco.',
        )
        setReady(true)
        return
      }
      if (remote && !isLibrary(remote.content)) {
        readFailed.current = true
        setStatus('error')
        setMessage(
          'Os dados na nuvem têm um formato não reconhecido. Exporte seus dados e confira o banco.',
        )
        setReady(true)
        return
      }
      if (dirty.current && (remote?.revision || 0) !== revision.current) {
        conflict.current = true
        setStatus('conflict')
        setMessage(
          'Há alterações em outro dispositivo. Exporte sua cópia local antes de carregar a versão da nuvem.',
        )
      } else {
        if (!dirty.current) {
          current.current = remote?.content || emptyLibrary()
          revision.current = remote?.revision || 0
          setData(current.current)
        }
        setStatus('synced')
        persist()
      }
      setReady(true)
    }
    void load().catch(() => {
      if (!cancelled) {
        readFailed.current = true
        setStatus('error')
        setMessage('Não foi possível carregar a nuvem. Suas alterações locais foram preservadas.')
        setReady(true)
      }
    })
    return () => {
      cancelled = true
    }
  }, [userId, persist, online, refresh])

  useEffect(() => {
    if (!supabase || !ready || conflict.current || readFailed.current) return
    if (!online) {
      setStatus('offline')
      return
    }
    if (!dirty.current) return
    const timer = window.setTimeout(async () => {
      if (saving.current || conflict.current) return
      saving.current = true
      setStatus('saving')
      const capturedGeneration = generation.current
      try {
        const { data: nextRevision, error } = await supabase!.rpc('save_study_library', {
          library_content: current.current,
          expected_revision: revision.current,
        })
        if (error) {
          if (error.code === '40001') {
            conflict.current = true
            setStatus('conflict')
            setMessage(
              'A biblioteca mudou em outro dispositivo. Exporte sua cópia antes de carregar a nuvem.',
            )
          } else {
            setStatus('error')
            setMessage('Não foi possível sincronizar. Suas alterações continuam neste dispositivo.')
          }
        } else {
          revision.current = Number(nextRevision)
          dirty.current = generation.current !== capturedGeneration
          persist()
          setStatus('synced')
          if (dirty.current) setTick((t) => t + 1)
        }
      } catch {
        setStatus('error')
        setMessage('Não foi possível sincronizar. Tente novamente quando estiver online.')
      } finally {
        saving.current = false
      }
    }, 650)
    return () => window.clearTimeout(timer)
  }, [data, userId, online, ready, tick, persist])

  const reloadCloud = async () => {
    if (!supabase) {
      window.location.reload()
      return
    }
    if (saving.current) return
    setStatus('loading')
    const { data: remote, error } = await supabase
      .from('study_libraries')
      .select('content, revision')
      .eq('user_id', userId)
      .maybeSingle()
    if (error || (remote && !isLibrary(remote.content))) {
      setStatus('error')
      setMessage('Não foi possível carregar a versão da nuvem. Sua cópia local foi mantida.')
      return
    }
    current.current = remote?.content || emptyLibrary()
    revision.current = remote?.revision || 0
    dirty.current = false
    conflict.current = false
    generation.current++
    persist()
    setData(current.current)
    setStatus('synced')
    setMessage('')
  }
  return {
    data,
    update,
    ready,
    online,
    status,
    message,
    storageError,
    retry: () => {
      setRefresh((r) => r + 1)
      setTick((t) => t + 1)
    },
    reloadCloud,
  }
}
